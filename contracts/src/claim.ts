import { z } from 'zod';
import { CoverageCauseSchema } from './coverage.js';
import { EvidenceSchema } from './evidence.js';
import { allUnique, text } from './internal.js';
import { CalendarDateSchema, IdSchema, IsoTimestampSchema } from './primitives.js';

export const ClaimStatusSchema = z.enum([
  'submitted',
  'under_review',
  'needs_more_evidence',
  'approved',
  'partially_approved',
  'denied',
  'paid',
  'appealed',
]);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

/** A member's request to be compensated for one lost working day. */
export const ClaimSchema = z
  .object({
    id: IdSchema,
    memberId: IdSchema,
    coverageId: IdSchema,
    cause: CoverageCauseSchema,
    /** The working day that was lost, in the member's local calendar. */
    lossDate: CalendarDateSchema,
    submittedAt: IsoTimestampSchema,
    description: text(2000),
    evidence: z.array(EvidenceSchema).min(1),
    status: ClaimStatusSchema,
  })
  .refine((claim) => allUnique(claim.evidence.map((item) => item.id)), {
    message: 'Evidence ids must not repeat',
    path: ['evidence'],
  });
export type Claim = z.infer<typeof ClaimSchema>;
