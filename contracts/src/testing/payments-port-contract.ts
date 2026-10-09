import { describe, expect, it, vi } from 'vitest';
import type { Contribution } from '../contribution.js';
import type { PaymentsPort, PayoutBatch, PayoutRequest } from '../ports/payments.js';
import {
  BalanceSchema,
  CollectContributionResultSchema,
  PayoutBatchLookupSchema,
  PayoutBatchSchema,
} from '../ports/payments.js';

export type PaymentsPortFactory = () => PaymentsPort | Promise<PaymentsPort>;

export interface PaymentsPortContractOptions {
  /**
   * Synthetic member used for contributions and payouts. Against a sandbox, `receiverEmail` must
   * be a sandbox account that can receive payouts.
   */
  member?: { memberId: string; receiverEmail: string };
  /** Amount used for contributions and affordable payouts. Default: 500 (USD 5.00). */
  amountCents?: number;
  /**
   * Brings every pending payout to its final status, for adapters with delayed settlement: for
   * example by advancing a simulated clock, or by polling a real sandbox until statuses are final.
   * When provided, the suite calls it after sending payouts and before asserting final statuses,
   * passing the port the factory created for the current test, and expects `getPayoutStatus` to
   * report no `pending` payout once it resolves. A hook that ignores the argument works too. When
   * omitted, the suite polls `getPayoutStatus` instead (see `settleTimeoutMs` and
   * `pollIntervalMs`).
   */
  settle?: (port: PaymentsPort) => Promise<void>;
  /** Without `settle`: how long to poll for payouts to leave `pending`. Default: 10 000 ms. */
  settleTimeoutMs?: number;
  /** Without `settle`: delay between status lookups while polling. Default: 100 ms. */
  pollIntervalMs?: number;
  /**
   * Maximum duration of each contract test, including `settle`. Raise it for adapters that talk
   * to a real network. Default: three times `settleTimeoutMs`.
   */
  timeoutMs?: number;
}

const DEFAULT_MEMBER = {
  memberId: 'contract-test-member',
  receiverEmail: 'contract-test-member@example.com',
};

/**
 * Registers the PaymentsPort contract tests in the calling Vitest file. `factory` must return a
 * port whose available balance is at least four times `amountCents`; it is called once per test.
 *
 * @example
 * runPaymentsPortContract(() => new SimulatedPayments({ delayMs: 60_000 }), {
 *   settle: async (port) => {
 *     if (port instanceof SimulatedPayments) port.advanceTime(60_000);
 *   },
 * });
 */
export function runPaymentsPortContract(
  factory: PaymentsPortFactory,
  options: PaymentsPortContractOptions = {},
): void {
  const member = options.member ?? DEFAULT_MEMBER;
  const amountCents = options.amountCents ?? 500;
  const settleTimeoutMs = options.settleTimeoutMs ?? 10_000;
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const timeoutMs = options.timeoutMs ?? settleTimeoutMs * 3;
  const minimumBalanceCents = amountCents * 4;

  async function freshPort(): Promise<PaymentsPort> {
    const port = await factory();
    expect(
      await availableCents(port),
      `the factory must return a port with at least ${minimumBalanceCents} cents available`,
    ).toBeGreaterThanOrEqual(minimumBalanceCents);
    return port;
  }

  function payoutRequest(claimId: string, amount = amountCents): PayoutRequest {
    return {
      claimId,
      memberId: member.memberId,
      receiverEmail: member.receiverEmail,
      amountCents: amount,
    };
  }

  async function send(
    port: PaymentsPort,
    requests: PayoutRequest[],
    idempotencyKey = newKey('batch'),
  ): Promise<PayoutBatch> {
    return PayoutBatchSchema.parse(await port.sendPayouts({ requests, idempotencyKey }));
  }

  /** Reads the batch and requires that no payout in it is still pending. */
  async function settledBatch(port: PaymentsPort, batchId: string): Promise<PayoutBatch> {
    const batch = PayoutBatchLookupSchema.parse(await port.getPayoutStatus(batchId));
    if (batch === null) {
      throw new Error(`Batch ${batchId} is unknown`);
    }
    const pending = batch.payouts.filter((payout) => payout.status === 'pending').length;
    if (pending > 0) {
      throw new Error(`${pending} payout(s) in batch ${batchId} are still pending`);
    }
    return batch;
  }

  /** Waits for final statuses: through the settle hook when given, otherwise by polling. */
  async function settle(port: PaymentsPort, batchId: string): Promise<PayoutBatch> {
    if (options.settle !== undefined) {
      await options.settle(port);
      return settledBatch(port, batchId);
    }
    return vi.waitFor(() => settledBatch(port, batchId), {
      timeout: settleTimeoutMs,
      interval: pollIntervalMs,
    });
  }

  describe('PaymentsPort contract', { timeout: timeoutMs }, () => {
    it('collects a contribution once when it is retried with the same idempotency key', async () => {
      const port = await freshPort();
      const before = await availableCents(port);
      const request = {
        memberId: member.memberId,
        amountCents,
        idempotencyKey: newKey('contribution'),
      };

      const first = CollectContributionResultSchema.parse(await port.collectContribution(request));
      const retry = CollectContributionResultSchema.parse(await port.collectContribution(request));

      expect(first.contribution).toMatchObject({ memberId: member.memberId, amountCents });
      expect(retry.contribution.id).toBe(first.contribution.id);
      expect(retry.contribution.amountCents).toBe(amountCents);
      expect(await availableCents(port)).toBe(before + successfulAmount(retry.contribution));

      const other = CollectContributionResultSchema.parse(
        await port.collectContribution({ ...request, idempotencyKey: newKey('contribution') }),
      );
      expect(other.contribution.id).not.toBe(first.contribution.id);
    });

    it('sends a payout batch once when it is retried with the same idempotency key', async () => {
      const port = await freshPort();
      const before = await availableCents(port);
      const requests = [payoutRequest('contract-claim-idempotent')];
      const idempotencyKey = newKey('batch');

      const first = await send(port, requests, idempotencyKey);
      const retry = await send(port, requests, idempotencyKey);

      expect(retry.batchId).toBe(first.batchId);
      expect(payoutIds(retry)).toEqual(payoutIds(first));
      const settled = await settle(port, first.batchId);
      expect(await availableCents(port)).toBe(before - committedAmount(settled));
    });

    it('marks payout items that exceed the available balance as failed', async () => {
      const port = await freshPort();
      const before = await availableCents(port);

      const sent = await send(port, [
        payoutRequest('contract-claim-affordable'),
        payoutRequest('contract-claim-excessive', before + 1),
      ]);
      const settled = await settle(port, sent.batchId);

      const excessive = settled.payouts.find((payout) => payout.id === sent.payouts[1]?.id);
      expect(excessive?.status).toBe('failed');
      expect(await availableCents(port)).toBe(before - committedAmount(settled));
    });

    it('looks up payout status by batch id', async () => {
      const port = await freshPort();
      const sent = await send(port, [payoutRequest('contract-claim-status')]);

      const lookup = PayoutBatchLookupSchema.parse(await port.getPayoutStatus(sent.batchId));
      expect(lookup?.batchId).toBe(sent.batchId);
      expect(lookup && payoutIds(lookup)).toEqual(payoutIds(sent));

      const settled = await settle(port, sent.batchId);
      expect(settled.payouts).toEqual([
        expect.objectContaining({
          id: sent.payouts[0]?.id,
          claimId: 'contract-claim-status',
          memberId: member.memberId,
          amountCents,
          status: 'success',
        }),
      ]);

      const unknown = PayoutBatchLookupSchema.parse(
        await port.getPayoutStatus(newKey('unknown-batch')),
      );
      expect(unknown).toBeNull();
    });

    it('keeps the balance consistent with contributions and payouts', async () => {
      const port = await freshPort();
      const before = await availableCents(port);
      expect(await availableCents(port)).toBe(before);

      const { contribution } = CollectContributionResultSchema.parse(
        await port.collectContribution({
          memberId: member.memberId,
          amountCents,
          idempotencyKey: newKey('contribution'),
        }),
      );
      const sent = await send(port, [
        payoutRequest('contract-claim-balance-1'),
        payoutRequest('contract-claim-balance-2'),
      ]);
      const settled = await settle(port, sent.batchId);

      expect(await availableCents(port)).toBe(
        before + successfulAmount(contribution) - committedAmount(settled),
      );
    });
  });
}

async function availableCents(port: PaymentsPort): Promise<number> {
  return BalanceSchema.parse(await port.getBalance()).availableCents;
}

/** Unique per run, so a shared sandbox never sees the same key twice. */
function newKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function payoutIds(batch: PayoutBatch): string[] {
  return batch.payouts.map((payout) => payout.id).sort();
}

function successfulAmount(contribution: Contribution): number {
  return contribution.status === 'success' ? contribution.amountCents : 0;
}

/** Money that left the available balance: every payout that did not fail. */
function committedAmount(batch: PayoutBatch): number {
  return batch.payouts
    .filter((payout) => payout.status !== 'failed')
    .reduce((sum, payout) => sum + payout.amountCents, 0);
}
