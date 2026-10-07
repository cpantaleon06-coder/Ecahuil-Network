import { z } from 'zod';
import { text } from './internal.js';
import { CentsSchema, ConfidenceBandSchema, ConfidenceSchema, IdSchema } from './primitives.js';

export const DecisionOutcomeSchema = z.enum([
  'pay_full',
  'pay_partial_provisional',
  'request_more_evidence',
  'deny',
]);
export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;

/** `fallback_rule` authorizes when the reasoner is unavailable or its output is invalid. */
export const AuthorizerSchema = z.enum(['rule', 'fallback_rule']);
export type Authorizer = z.infer<typeof AuthorizerSchema>;

/** True for the outcomes that send money to the member. */
export function outcomePays(outcome: DecisionOutcome): boolean {
  return outcome === 'pay_full' || outcome === 'pay_partial_provisional';
}

/** The authorized result for a claim. Paying outcomes carry a positive amount, others zero. */
export const DecisionSchema = z
  .object({
    claimId: IdSchema,
    memberId: IdSchema,
    outcome: DecisionOutcomeSchema,
    payAmountCents: CentsSchema,
    confidence: ConfidenceSchema,
    band: ConfidenceBandSchema,
    rationale: text(2000),
    authorizedBy: AuthorizerSchema,
    /** False when paying would overspend the public error budget. */
    withinErrorBudget: z.boolean(),
    auditRequired: z.boolean(),
  })
  .refine(
    (decision) =>
      outcomePays(decision.outcome) ? decision.payAmountCents > 0 : decision.payAmountCents === 0,
    {
      message: 'payAmountCents must be positive for paying outcomes and zero otherwise',
      path: ['payAmountCents'],
    },
  );
export type Decision = z.infer<typeof DecisionSchema>;
