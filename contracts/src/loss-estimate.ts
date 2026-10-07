import { z } from 'zod';
import { CentsSchema, IdSchema } from './primitives.js';

/** How much income the member lost on the loss date. */
export const LossEstimateSchema = z.object({
  claimId: IdSchema,
  /** Expected income for a normal working day. */
  baselineIncomeCents: CentsSchema,
  /** Income the member still earned on the loss date. */
  actualIncomeCents: CentsSchema,
  estimatedLossCents: CentsSchema,
});
export type LossEstimate = z.infer<typeof LossEstimateSchema>;
