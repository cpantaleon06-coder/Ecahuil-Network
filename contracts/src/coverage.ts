import { z } from 'zod';
import { EvidenceKindSchema } from './evidence.js';
import { allUnique } from './internal.js';
import { OccupationSchema } from './member.js';
import { CalendarDateSchema, IdSchema, PositiveCentsSchema } from './primitives.js';

/** Covered causes of a lost working day. */
export const CoverageCauseSchema = z.enum([
  'road_closure',
  'severe_rain',
  'extreme_heat',
  'platform_outage',
  'member_reported',
]);
export type CoverageCause = z.infer<typeof CoverageCauseSchema>;

/**
 * One version of the terms for an occupation and a cause. `id` names this exact version, so a
 * claim that references it keeps pointing at the terms it was filed under.
 */
export const CoverageSchema = z
  .object({
    id: IdSchema,
    version: z.int().positive(),
    occupation: OccupationSchema,
    cause: CoverageCauseSchema,
    requiredEvidenceKinds: z.array(EvidenceKindSchema).min(1),
    maxDailyPayoutCents: PositiveCentsSchema,
    /** Days a new member waits after joining before this coverage applies. */
    waitingPeriodDays: z.int().min(0).max(365),
    effectiveFrom: CalendarDateSchema,
  })
  .refine((coverage) => allUnique(coverage.requiredEvidenceKinds), {
    message: 'Evidence kinds must not repeat',
    path: ['requiredEvidenceKinds'],
  });
export type Coverage = z.infer<typeof CoverageSchema>;
