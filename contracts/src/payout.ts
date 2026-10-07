import { z } from 'zod';
import {
  IdSchema,
  IsoTimestampSchema,
  PositiveCentsSchema,
  ProviderRefSchema,
} from './primitives.js';

/**
 * `pending`: sent, not settled yet. `success`: delivered. `failed`: not delivered and not debited.
 * `unclaimed`: the receiver has not claimed it yet. `held`: the provider is holding it for review.
 */
export const PayoutStatusSchema = z.enum(['pending', 'success', 'failed', 'unclaimed', 'held']);
export type PayoutStatus = z.infer<typeof PayoutStatusSchema>;

/** Money sent to a member for a claim. */
export const PayoutSchema = z.object({
  id: IdSchema,
  claimId: IdSchema,
  memberId: IdSchema,
  amountCents: PositiveCentsSchema,
  status: PayoutStatusSchema,
  providerBatchId: ProviderRefSchema.optional(),
  providerItemId: ProviderRefSchema.optional(),
  createdAt: IsoTimestampSchema,
});
export type Payout = z.infer<typeof PayoutSchema>;
