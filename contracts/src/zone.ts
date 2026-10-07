import { z } from 'zod';
import { text } from './internal.js';
import { GeoPointSchema, IdSchema } from './primitives.js';

// IANA names look like "America/Mexico_City" or "UTC". The shape check keeps out raw offsets
// such as "+05:00", which Intl accepts but which are not IANA names.
const TIME_ZONE_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

function isIanaTimeZone(value: string): boolean {
  if (!TIME_ZONE_NAME.test(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** IANA time zone name known to the runtime, e.g. `America/Mexico_City`. */
export const TimeZoneSchema = z
  .string()
  .refine(isIanaTimeZone, 'Expected an IANA time zone such as "America/Mexico_City"');
export type TimeZone = z.infer<typeof TimeZoneSchema>;

/** An area where members work. `Member.zoneId` refers to `id`; work schedules use `timezone`. */
export const ZoneSchema = z.object({
  id: IdSchema,
  name: text(80),
  timezone: TimeZoneSchema,
  centroid: GeoPointSchema,
});
export type Zone = z.infer<typeof ZoneSchema>;
