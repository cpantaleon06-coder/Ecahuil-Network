import { z } from 'zod';
import { text } from './internal.js';
import { IdSchema } from './primitives.js';

export const CheckResultSchema = z.enum(['pass', 'fail', 'inconclusive']);
export type CheckResult = z.infer<typeof CheckResultSchema>;

/** One deterministic check of the claim, e.g. "loss date is a scheduled working day". */
export const VerificationCheckSchema = z.object({
  name: text(120),
  result: CheckResultSchema,
  detail: text(500),
});
export type VerificationCheck = z.infer<typeof VerificationCheckSchema>;

/** Something that warrants a closer look. `code` is a stable snake_case identifier. */
export const FraudSignalSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/, 'Expected a snake_case code'),
  detail: text(500),
});
export type FraudSignal = z.infer<typeof FraudSignalSchema>;

export const VerificationSchema = z.object({
  claimId: IdSchema,
  checks: z.array(VerificationCheckSchema).min(1),
  /** True when at least one independent source supports the claimed cause. */
  independentCorroboration: z.boolean(),
  fraudSignals: z.array(FraudSignalSchema),
});
export type Verification = z.infer<typeof VerificationSchema>;
