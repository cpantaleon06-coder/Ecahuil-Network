import { z } from 'zod';
import { text } from './internal.js';
import { IdSchema } from './primitives.js';

/** `upheld`: the original decision stands. `overturned`: the appeal succeeded. */
export const AppealStatusSchema = z.enum(['open', 'upheld', 'overturned']);
export type AppealStatus = z.infer<typeof AppealStatusSchema>;

export const AppealReviewerSchema = z.enum(['rule', 'member_panel']);
export type AppealReviewer = z.infer<typeof AppealReviewerSchema>;

/** A member's request to review the decision on a claim. */
export const AppealSchema = z.object({
  id: IdSchema,
  claimId: IdSchema,
  reason: text(2000),
  status: AppealStatusSchema,
  reviewedBy: AppealReviewerSchema,
});
export type Appeal = z.infer<typeof AppealSchema>;
