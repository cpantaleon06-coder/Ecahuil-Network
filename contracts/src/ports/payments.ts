import { z } from 'zod';
import { ContributionSchema } from '../contribution.js';
import { PayoutSchema } from '../payout.js';
import {
  CentsSchema,
  IdSchema,
  IsoTimestampSchema,
  PositiveCentsSchema,
  ProviderRefSchema,
  type ProviderRef,
} from '../primitives.js';
import { ContractViolationError, parseOrThrow } from './contract-violation.js';

/** Identifies one logical operation, so that retrying it never moves money twice. */
export const IdempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9._:-]{1,64}$/, 'Expected 1 to 64 letters, digits, ".", "_", ":" or "-"');
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

export const CollectContributionRequestSchema = z.object({
  memberId: IdSchema,
  amountCents: PositiveCentsSchema,
  idempotencyKey: IdempotencyKeySchema,
});
export type CollectContributionRequest = z.infer<typeof CollectContributionRequestSchema>;

export const CollectContributionResultSchema = z.object({
  contribution: ContributionSchema,
});
export type CollectContributionResult = z.infer<typeof CollectContributionResultSchema>;

export const PayoutRequestSchema = z.object({
  claimId: IdSchema,
  memberId: IdSchema,
  /** The member's `paypalEmail`: a synthetic or sandbox address. */
  receiverEmail: z.email(),
  amountCents: PositiveCentsSchema,
});
export type PayoutRequest = z.infer<typeof PayoutRequestSchema>;

export const SendPayoutsRequestSchema = z.object({
  requests: z.array(PayoutRequestSchema).min(1),
  idempotencyKey: IdempotencyKeySchema,
});
export type SendPayoutsRequest = z.infer<typeof SendPayoutsRequestSchema>;

/** Result of `sendPayouts`. Every payout carries the batch id as `providerBatchId`. */
export const PayoutBatchSchema = z
  .object({
    batchId: ProviderRefSchema,
    payouts: z.array(PayoutSchema).min(1),
  })
  .refine((batch) => batch.payouts.every((payout) => payout.providerBatchId === batch.batchId), {
    message: 'Every payout must carry the batch id as providerBatchId',
    path: ['payouts'],
  });
export type PayoutBatch = z.infer<typeof PayoutBatchSchema>;

/** Result of `getPayoutStatus`: the batch, or null when the batch id is unknown. */
export const PayoutBatchLookupSchema = PayoutBatchSchema.nullable();
export type PayoutBatchLookup = z.infer<typeof PayoutBatchLookupSchema>;

/** Result of `getBalance`. */
export const BalanceSchema = z.object({
  availableCents: CentsSchema,
  asOf: IsoTimestampSchema,
});
export type Balance = z.infer<typeof BalanceSchema>;

/**
 * Moves money into and out of the fund. Only `packages/core` implements it against PayPal; tests
 * and simulations use in-memory implementations. Every implementation must pass
 * `runPaymentsPortContract` from `@ecahuil/contracts/testing`.
 *
 * Idempotency: retrying an operation with the same idempotency key returns the original result
 * and never moves money twice. Reusing a key with a different payload is a caller error;
 * implementations may reject it or return the original result.
 *
 * Balance: `availableCents` equals the starting balance, plus contributions whose status is
 * `success`, minus payouts whose status is anything but `failed`.
 */
export interface PaymentsPort {
  collectContribution(request: CollectContributionRequest): Promise<CollectContributionResult>;

  /**
   * Sends one payout per request in a single batch; `payouts[i]` answers `requests[i]`. It does
   * not reject for lack of funds: an item that exceeds the available balance ends as `failed`.
   */
  sendPayouts(request: SendPayoutsRequest): Promise<PayoutBatch>;

  getPayoutStatus(batchId: ProviderRef): Promise<PayoutBatchLookup>;

  getBalance(): Promise<Balance>;
}

/**
 * Wraps a PaymentsPort so that every request and result is validated against the schemas above.
 * Throws ContractViolationError on the first violation.
 */
export function guardPaymentsPort(port: PaymentsPort): PaymentsPort {
  return {
    async collectContribution(request) {
      const location = 'PaymentsPort.collectContribution';
      const valid = parseOrThrow(CollectContributionRequestSchema, request, `${location} request`);
      const result = parseOrThrow(
        CollectContributionResultSchema,
        await port.collectContribution(valid),
        `${location} result`,
      );
      const { contribution } = result;
      if (
        contribution.memberId !== valid.memberId ||
        contribution.amountCents !== valid.amountCents
      ) {
        throw new ContractViolationError(
          `${location} result`,
          'The contribution does not match the request',
        );
      }
      return result;
    },

    async sendPayouts(request) {
      const location = 'PaymentsPort.sendPayouts';
      const valid = parseOrThrow(SendPayoutsRequestSchema, request, `${location} request`);
      const batch = parseOrThrow(
        PayoutBatchSchema,
        await port.sendPayouts(valid),
        `${location} result`,
      );
      const matches =
        batch.payouts.length === valid.requests.length &&
        valid.requests.every((item, index) => {
          const payout = batch.payouts[index];
          return (
            payout !== undefined &&
            payout.claimId === item.claimId &&
            payout.memberId === item.memberId &&
            payout.amountCents === item.amountCents
          );
        });
      if (!matches) {
        throw new ContractViolationError(
          `${location} result`,
          'payouts[i] must answer requests[i] with the same claim, member and amount',
        );
      }
      return batch;
    },

    async getPayoutStatus(batchId) {
      const location = 'PaymentsPort.getPayoutStatus';
      const validBatchId = parseOrThrow(ProviderRefSchema, batchId, `${location} request`);
      const batch = parseOrThrow(
        PayoutBatchLookupSchema,
        await port.getPayoutStatus(validBatchId),
        `${location} result`,
      );
      if (batch !== null && batch.batchId !== validBatchId) {
        throw new ContractViolationError(`${location} result`, 'Returned a different batch');
      }
      return batch;
    },

    async getBalance() {
      return parseOrThrow(BalanceSchema, await port.getBalance(), 'PaymentsPort.getBalance result');
    },
  };
}
