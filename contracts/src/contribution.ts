import { z } from 'zod';
import { IdSchema, IsoTimestampSchema, PositiveCentsSchema } from './primitives.js';

/** Only `success` contributions count towards the fund's balance. */
export const ContributionStatusSchema = z.enum(['pending', 'success', 'failed']);
export type ContributionStatus = z.infer<typeof ContributionStatusSchema>;

/** Money a member pays into the fund. */
export const ContributionSchema = z.object({
  id: IdSchema,
  memberId: IdSchema,
  amountCents: PositiveCentsSchema,
  createdAt: IsoTimestampSchema,
  status: ContributionStatusSchema,
});
export type Contribution = z.infer<typeof ContributionSchema>;
