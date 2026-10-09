import { describe, expect, it } from 'vitest';
import {
  SimPaymentsAdapter,
  type SimPaymentsAdapterOptions,
} from '../src/adapters/sim-payments-adapter.js';

const MEMBERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => `member-${id}`);

async function available(adapter: SimPaymentsAdapter): Promise<number> {
  return (await adapter.getBalance()).availableCents;
}

/** Collects one contribution per member, in order, and returns their statuses. */
async function contributionStatuses(options: SimPaymentsAdapterOptions): Promise<string[]> {
  const adapter = new SimPaymentsAdapter({ seed: 11, ...options });
  const statuses: string[] = [];
  for (const memberId of MEMBERS) {
    const { contribution } = await adapter.collectContribution({
      memberId,
      amountCents: 300,
      idempotencyKey: `c-${memberId}`,
    });
    statuses.push(contribution.status);
  }
  return statuses;
}

describe('SimPaymentsAdapter contribution failures', () => {
  it('fails contributions of listed members without changing the balance', async () => {
    const adapter = new SimPaymentsAdapter({
      initialBalanceCents: 1_000,
      contributionFailMemberIds: ['member-bad'],
    });

    const bad = await adapter.collectContribution({
      memberId: 'member-bad',
      amountCents: 300,
      idempotencyKey: 'c-bad',
    });
    const ok = await adapter.collectContribution({
      memberId: 'member-ok',
      amountCents: 200,
      idempotencyKey: 'c-ok',
    });

    expect(bad.contribution).toMatchObject({
      memberId: 'member-bad',
      amountCents: 300,
      status: 'failed',
    });
    expect(ok.contribution.status).toBe('success');
    expect(await available(adapter)).toBe(1_200);
  });

  it('fails every contribution with rate 1 and none with rate 0', async () => {
    expect(await contributionStatuses({ contributionFailureRate: 1 })).toEqual(
      MEMBERS.map(() => 'failed'),
    );
    expect(await contributionStatuses({ contributionFailureRate: 0 })).toEqual(
      MEMBERS.map(() => 'success'),
    );
  });

  it('is deterministic for a seed', async () => {
    const first = await contributionStatuses({ contributionFailureRate: 0.5 });

    expect(await contributionStatuses({ contributionFailureRate: 0.5 })).toEqual(first);
    expect(first).toContain('failed');
    expect(first).toContain('success');
  });

  it('keeps other members outcomes stable when one member is forced to fail', async () => {
    const baseline = await contributionStatuses({ contributionFailureRate: 0.5 });
    const forced = await contributionStatuses({
      contributionFailureRate: 0.5,
      contributionFailMemberIds: ['member-c'],
    });

    expect(forced[2]).toBe('failed');
    expect(forced.filter((_, index) => index !== 2)).toEqual(
      baseline.filter((_, index) => index !== 2),
    );
  });

  it('returns the same failed contribution on retry and never credits it', async () => {
    const adapter = new SimPaymentsAdapter({ contributionFailureRate: 1 });
    const request = { memberId: 'member-001', amountCents: 300, idempotencyKey: 'c-1' };

    const first = await adapter.collectContribution(request);
    const retry = await adapter.collectContribution(request);

    expect(first.contribution.status).toBe('failed');
    expect(retry).toEqual(first);
    expect(await available(adapter)).toBe(0);
  });

  it('never shifts payout outcomes', async () => {
    const payoutStatuses = async (contributions: number) => {
      const adapter = new SimPaymentsAdapter({
        seed: 5,
        initialBalanceCents: 100_000,
        failureRate: 0.5,
        contributionFailureRate: 0.5,
      });
      for (let index = 0; index < contributions; index += 1) {
        await adapter.collectContribution({
          memberId: 'member-001',
          amountCents: 100,
          idempotencyKey: `c-${index}`,
        });
      }
      const sent = await adapter.sendPayouts({
        requests: MEMBERS.map((memberId) => ({
          claimId: `claim-${memberId}`,
          memberId,
          receiverEmail: `${memberId}@example.invalid`,
          amountCents: 100,
        })),
        idempotencyKey: 'batch-1',
      });
      return sent.payouts.map((payout) => payout.status);
    };

    expect(await payoutStatuses(5)).toEqual(await payoutStatuses(0));
  });

  it('rejects an invalid contribution failure rate', () => {
    expect(() => new SimPaymentsAdapter({ contributionFailureRate: -0.1 })).toThrow(RangeError);
  });
});
