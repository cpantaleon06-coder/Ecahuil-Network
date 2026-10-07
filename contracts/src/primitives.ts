import { z } from 'zod';

/** Every amount in the contracts is in this currency. */
export const CURRENCY = 'USD';

/** Synthetic identifier: letters, digits and `_ . : -`, starting with a letter or digit. */
export const IdSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/,
    'Expected an id of letters, digits, "_", ".", ":" or "-" (max 128 characters)',
  );
export type Id = z.infer<typeof IdSchema>;

/** Identifier issued by an external provider, such as a PayPal payout batch id. */
export const ProviderRefSchema = z
  .string()
  .regex(/^\S{1,128}$/, 'Expected a provider reference without whitespace (max 128 characters)');
export type ProviderRef = z.infer<typeof ProviderRefSchema>;

/** Money in integer USD cents. Never negative: the field or record kind gives the direction. */
export const CentsSchema = z.int().nonnegative();
export type Cents = z.infer<typeof CentsSchema>;

/** Money in integer USD cents, strictly positive. */
export const PositiveCentsSchema = z.int().positive();
export type PositiveCents = z.infer<typeof PositiveCentsSchema>;

/** ISO 8601 timestamp with an explicit offset, e.g. `2026-10-07T09:30:00-05:00` or `...Z`. */
export const IsoTimestampSchema = z.iso.datetime({ offset: true });
export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;

/** Calendar date as `YYYY-MM-DD`. */
export const CalendarDateSchema = z.iso.date();
export type CalendarDate = z.infer<typeof CalendarDateSchema>;

/** A point on the map in decimal degrees (WGS 84). */
export const GeoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;

/** Probability-like confidence between 0 and 1, inclusive. */
export const ConfidenceSchema = z.number().min(0).max(1);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ConfidenceBandSchema = z.enum(['high', 'medium', 'low']);
export type ConfidenceBand = z.infer<typeof ConfidenceBandSchema>;
