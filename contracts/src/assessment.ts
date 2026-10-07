import { z } from 'zod';
import { text } from './internal.js';
import { CentsSchema, ConfidenceBandSchema, ConfidenceSchema, IdSchema } from './primitives.js';

/**
 * The reasoner's recommendation for a claim. It never authorizes a payment on its own: a fixed
 * rule turns it into a Decision.
 */
export const AssessmentSchema = z.object({
  claimId: IdSchema,
  confidence: ConfidenceSchema,
  band: ConfidenceBandSchema,
  recommendedPayoutCents: CentsSchema,
  /** Plain-English explanation addressed to the member. */
  rationale: text(2000),
  /** Ids of the claim's evidence items the recommendation relies on. */
  evidenceUsed: z.array(IdSchema),
  /** What would raise confidence, phrased as questions for the member or a reviewer. */
  openQuestions: z.array(text(500)),
});
export type Assessment = z.infer<typeof AssessmentSchema>;
