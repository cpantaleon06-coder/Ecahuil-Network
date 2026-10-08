import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PayoutRequest } from '@ecahuil/contracts';
import { SimPaymentsAdapter } from '../src/adapters/sim-payments-adapter.js';
import { ManualClock, SIM_EPOCH_MS } from '../src/clock.js';

function payoutRequest(memberId: string, amountCents: number, claimId = `claim-${memberId}`) {
  return {
    claimId,
    memberId,
    receiverEmail: `${memberId}@example.invalid`,
    amountCents,
  } satisfies PayoutRequest;
}

async function statuses(adapter: SimPaymentsAdapter, batchId: string): Promise<string[]> {
  const batch = await adapter.getPayoutStatus(batchId);
  return batch?.payouts.map((payout) => payout.status) ?? [];
}

async function available(adapter: SimPaymentsAdapter): Promise<number> {
  return (await adapter.getBalance()).availableCents;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SimPaymentsAdapter determinism', () => {
  async function scenario(seed: number) {
    const adapter = new SimPaymentsAdapter({
      seed,
      initialBalanceCents: 1_000_000,
      failureRate: 0.3,
      settlementDelayMs: 1_000,
    });
    const contribution = await adapter.collectContribution({
      memberId: 'member-001',
      amountCents: 300,
      idempotencyKey: 'contribution-1',
    });
    const sent = await adapter.sendPayouts({
      requests: Array.from({ length: 40 }, (_, index) =>
        payoutRequest(`member-${String(index + 1).padStart(3, '0')}`, 1_000 + index),
      ),
      idempotencyKey: 'batch-1',
    });
    adapter.advanceTime(1_000);
    const settled = await adapter.getPayoutStatus(sent.batchId);
    return { contribution, sent, settled, balance: await adapter.getBalance() };
  }

  it('produces identical results for the same seed, whatever the real time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    const first = await scenario(42);
    vi.setSystemTime(new Date('2031-06-15T12:34:56Z'));
    const second = await scenario(42);

    expect(second).toEqual(first);
    expect(first.contribution.contribution.createdAt).toBe(new Date(SIM_EPOCH_MS).toISOString());
    const finalStatuses = first.settled?.payouts.map((payout) => payout.status);
    expect(finalStatuses).toContain('failed');
    expect(finalStatuses).toContain('success');
  });

  it('changes the random outcomes with a different seed', async () => {
    const outcomes = async (seed: number) =>
      (await scenario(seed)).settled?.payouts.map((payout) => payout.status);

    expect(await outcomes(43)).not.toEqual(await outcomes(42));
  });

  it('keeps other members outcomes stable when one member is forced to fail', async () => {
    const outcomes = async (alwaysFailMemberIds: string[]) => {
      const adapter = new SimPaymentsAdapter({
        seed: 5,
        initialBalanceCents: 100_000,
        failureRate: 0.5,
        alwaysFailMemberIds,
      });
      const sent = await adapter.sendPayouts({
        requests: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => payoutRequest(`member-${id}`, 100)),
        idempotencyKey: 'batch-1',
      });
      return sent.payouts.map((payout) => payout.status);
    };

    const baseline = await outcomes([]);
    const forced = await outcomes(['member-c']);
    expect(forced[2]).toBe('failed');
    expect(forced.filter((_, index) => index !== 2)).toEqual(
      baseline.filter((_, index) => index !== 2),
    );
  });
});

describe('SimPaymentsAdapter settlement delay', () => {
  it('keeps funded payouts pending until the delay has elapsed', async () => {
    const adapter = new SimPaymentsAdapter({
      initialBalanceCents: 10_000,
      settlementDelayMs: 60_000,
    });

    const sent = await adapter.sendPayouts({
      requests: [payoutRequest('member-001', 2_500)],
      idempotencyKey: 'batch-1',
    });
    expect(sent.payouts[0]?.status).toBe('pending');
    expect(await available(adapter)).toBe(7_500);

    adapter.advanceTime(59_999);
    expect(await statuses(adapter, sent.batchId)).toEqual(['pending']);

    adapter.advanceTime(1);
    expect(await statuses(adapter, sent.batchId)).toEqual(['success']);
    expect(await available(adapter)).toBe(7_500);
  });

  it('settles at once when there is no delay', async () => {
    const adapter = new SimPaymentsAdapter({ initialBalanceCents: 10_000 });

    const sent = await adapter.sendPayouts({
      requests: [payoutRequest('member-001', 2_500)],
      idempotencyKey: 'batch-1',
    });

    expect(sent.payouts[0]?.status).toBe('success');
  });

  it('follows a shared clock advanced from outside', async () => {
    const clock = new ManualClock();
    const adapter = new SimPaymentsAdapter({
      initialBalanceCents: 10_000,
      settlementDelayMs: 5_000,
      clock,
    });

    const sent = await adapter.sendPayouts({
      requests: [payoutRequest('member-001', 1_000)],
      idempotencyKey: 'batch-1',
    });
    clock.advance(5_000);

    expect(await statuses(adapter, sent.batchId)).toEqual(['success']);
    expect((await adapter.getBalance()).asOf).toBe(new Date(SIM_EPOCH_MS + 5_000).toISOString());
  });
});

describe('SimPaymentsAdapter forced outcomes', () => {
  it('fails payouts of alwaysFail members and then releases their reservation', async () => {
    const adapter = new SimPaymentsAdapter({
      initialBalanceCents: 10_000,
      settlementDelayMs: 1_000,
      alwaysFailMemberIds: ['member-bad'],
    });

    const sent = await adapter.sendPayouts({
      requests: [payoutRequest('member-bad', 3_000), payoutRequest('member-ok', 1_000)],
      idempotencyKey: 'batch-1',
    });
    expect(await available(adapter)).toBe(6_000);

    adapter.advanceTime(1_000);
    expect(await statuses(adapter, sent.batchId)).toEqual(['failed', 'success']);
    expect(await available(adapter)).toBe(9_000);
  });

  it('ends payouts as unclaimed or held and keeps them debited', async () => {
    const adapter = new SimPaymentsAdapter({
      initialBalanceCents: 10_000,
      settlementDelayMs: 1_000,
      unclaimedMemberIds: ['member-away'],
      heldMemberIds: ['member-review'],
    });

    const sent = await adapter.sendPayouts({
      requests: [payoutRequest('member-away', 2_000), payoutRequest('member-review', 3_000)],
      idempotencyKey: 'batch-1',
    });
    adapter.advanceTime(1_000);

    expect(await statuses(adapter, sent.batchId)).toEqual(['unclaimed', 'held']);
    expect(await available(adapter)).toBe(5_000);
  });

  it('fails every funded payout with failureRate 1 and none with failureRate 0', async () => {
    const outcomes = async (failureRate: number) => {
      const adapter = new SimPaymentsAdapter({ seed: 3, initialBalanceCents: 10_000, failureRate });
      const sent = await adapter.sendPayouts({
        requests: ['a', 'b', 'c', 'd'].map((id) => payoutRequest(`member-${id}`, 100)),
        idempotencyKey: 'batch-1',
      });
      return sent.payouts.map((payout) => payout.status);
    };

    expect(await outcomes(1)).toEqual(['failed', 'failed', 'failed', 'failed']);
    expect(await outcomes(0)).toEqual(['success', 'success', 'success', 'success']);
  });

  it('rejects invalid configuration', () => {
    expect(() => new SimPaymentsAdapter({ failureRate: 1.5 })).toThrow(RangeError);
    expect(() => new SimPaymentsAdapter({ settlementDelayMs: -1 })).toThrow(RangeError);
    expect(() => new SimPaymentsAdapter({ initialBalanceCents: 10.5 })).toThrow();
    expect(
      () =>
        new SimPaymentsAdapter({ unclaimedMemberIds: ['member-x'], heldMemberIds: ['member-x'] }),
    ).toThrow('both unclaimed and held');
  });
});

describe('SimPaymentsAdapter insufficient funds', () => {
  it('fails items that exceed the available balance at once, without reserving funds', async () => {
    const adapter = new SimPaymentsAdapter({
      initialBalanceCents: 5_000,
      settlementDelayMs: 1_000,
    });

    const sent = await adapter.sendPayouts({
      requests: [
        payoutRequest('member-001', 3_000),
        payoutRequest('member-002', 3_000),
        payoutRequest('member-003', 2_000),
      ],
      idempotencyKey: 'batch-1',
    });

    expect(sent.payouts.map((payout) => payout.status)).toEqual(['pending', 'failed', 'pending']);
    expect(await available(adapter)).toBe(0);
    adapter.advanceTime(1_000);
    expect(await statuses(adapter, sent.batchId)).toEqual(['success', 'failed', 'success']);
    expect(await available(adapter)).toBe(0);
  });
});

describe('SimPaymentsAdapter idempotency', () => {
  it('collects a contribution once per idempotency key', async () => {
    const adapter = new SimPaymentsAdapter();
    const request = { memberId: 'member-001', amountCents: 300, idempotencyKey: 'c-1' };

    const first = await adapter.collectContribution(request);
    const retry = await adapter.collectContribution(request);

    expect(retry).toEqual(first);
    expect(await available(adapter)).toBe(300);
    await expect(adapter.collectContribution({ ...request, amountCents: 301 })).rejects.toThrow(
      'already used with a different payload',
    );
  });

  it('sends a batch once per idempotency key and reports its current statuses', async () => {
    const adapter = new SimPaymentsAdapter({
      initialBalanceCents: 10_000,
      settlementDelayMs: 1_000,
    });
    const request = { requests: [payoutRequest('member-001', 4_000)], idempotencyKey: 'b-1' };

    const first = await adapter.sendPayouts(request);
    adapter.advanceTime(1_000);
    const retry = await adapter.sendPayouts(request);

    expect(retry.batchId).toBe(first.batchId);
    expect(retry.payouts.map((payout) => payout.id)).toEqual(first.payouts.map((p) => p.id));
    expect(retry.payouts[0]?.status).toBe('success');
    expect(await available(adapter)).toBe(6_000);
    await expect(
      adapter.sendPayouts({ ...request, requests: [payoutRequest('member-001', 4_001)] }),
    ).rejects.toThrow('already used with a different payload');
  });

  it('returns null for an unknown batch', async () => {
    expect(await new SimPaymentsAdapter().getPayoutStatus('SIM-BATCH-999999')).toBeNull();
  });
});

describe('SimPaymentsAdapter integer cents', () => {
  it('rejects fractional amounts', async () => {
    const adapter = new SimPaymentsAdapter({ initialBalanceCents: 10_000 });

    await expect(
      adapter.sendPayouts({ requests: [payoutRequest('member-001', 10.5)], idempotencyKey: 'b-1' }),
    ).rejects.toThrow();
    await expect(
      adapter.collectContribution({
        memberId: 'member-001',
        amountCents: 0.5,
        idempotencyKey: 'c',
      }),
    ).rejects.toThrow();
    expect(await available(adapter)).toBe(10_000);
  });
});
