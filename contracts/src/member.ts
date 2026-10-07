import { z } from 'zod';
import { allUnique, text } from './internal.js';
import { GeoPointSchema, IdSchema, IsoTimestampSchema, PositiveCentsSchema } from './primitives.js';

export const OccupationSchema = z.enum([
  'delivery_courier',
  'construction_worker',
  'street_vendor',
  'other',
]);
export type Occupation = z.infer<typeof OccupationSchema>;

/**
 * Usual working hours in the local time of the member's zone (`Zone.timezone`).
 * `days` uses 0 = Sunday to 6 = Saturday. `endHour` is exclusive and may be 24.
 * When `endHour` is lower than `startHour` the shift crosses midnight (e.g. 22 to 6).
 */
export const WorkScheduleSchema = z
  .object({
    days: z.array(z.int().min(0).max(6)).min(1).max(7),
    startHour: z.int().min(0).max(23),
    endHour: z.int().min(1).max(24),
  })
  .refine((schedule) => allUnique(schedule.days), {
    message: 'Days must not repeat',
    path: ['days'],
  })
  .refine((schedule) => schedule.startHour !== schedule.endHour, {
    message: 'endHour must differ from startHour',
    path: ['endHour'],
  });
export type WorkSchedule = z.infer<typeof WorkScheduleSchema>;

/** A place where the member usually works, such as a market stall or a construction site. */
export const WorkSiteSchema = GeoPointSchema.extend({
  label: text(80),
});
export type WorkSite = z.infer<typeof WorkSiteSchema>;

export const MemberSchema = z.object({
  id: IdSchema,
  displayName: text(80),
  occupation: OccupationSchema,
  /** Id of the member's `Zone`. */
  zoneId: IdSchema,
  /** Synthetic or sandbox address that receives payouts. */
  paypalEmail: z.email(),
  joinedAt: IsoTimestampSchema,
  contributionCentsPerWeek: PositiveCentsSchema,
  /** Typical income on a normal working day, used to quantify losses. */
  baselineDailyIncomeCents: PositiveCentsSchema,
  workSchedule: WorkScheduleSchema,
  declaredWorkSites: z.array(WorkSiteSchema).max(20),
});
export type Member = z.infer<typeof MemberSchema>;
