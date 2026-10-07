import { z } from 'zod';
import { text } from './internal.js';
import { GeoPointSchema, IdSchema, IsoTimestampSchema } from './primitives.js';

export const EvidenceKindSchema = z.enum([
  'weather_observation',
  'road_closure_report',
  'platform_activity_log',
  'work_order',
  'photo',
  'member_statement',
]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidenceSourceTypeSchema = z.enum(['member_submitted', 'independent_source']);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;

/** Where a piece of evidence came from. `url` must be http or https. */
export const EvidenceSourceSchema = z.object({
  type: EvidenceSourceTypeSchema,
  name: text(120),
  url: z.url({ protocol: /^https?$/ }).optional(),
});
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const EvidenceSchema = z.object({
  id: IdSchema,
  kind: EvidenceKindSchema,
  /** Plain-English summary a member or reviewer can read. */
  summary: text(500),
  source: EvidenceSourceSchema,
  capturedAt: IsoTimestampSchema,
  location: GeoPointSchema.extend({ label: text(80).optional() }).optional(),
  /** Source-specific facts, e.g. `{ ordersCompleted: 3, closureId: "RC-118" }`. */
  attributes: z.record(z.string().min(1).max(64), z.union([z.string().max(500), z.number()])),
});
export type Evidence = z.infer<typeof EvidenceSchema>;
