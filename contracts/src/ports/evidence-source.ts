import { z } from 'zod';
import { ClaimSchema, type Claim } from '../claim.js';
import { EvidenceSchema, EvidenceSourceSchema } from '../evidence.js';
import { allUnique } from '../internal.js';
import { ContractViolationError, parseOrThrow } from './contract-violation.js';

/** Evidence whose source is independent of the member. */
export const IndependentEvidenceSchema = EvidenceSchema.extend({
  source: EvidenceSourceSchema.extend({ type: z.literal('independent_source') }),
});
export type IndependentEvidence = z.infer<typeof IndependentEvidenceSchema>;

/** Result of `corroborate`. */
export const CorroborationSchema = z.array(IndependentEvidenceSchema);
export type Corroboration = z.infer<typeof CorroborationSchema>;

/**
 * Looks up independent sources (road closure feeds, delivery platform status, weather
 * observations and so on) for evidence about a claim.
 */
export interface EvidenceSourcePort {
  /**
   * Returns independent evidence about the claim's cause, place and date; an empty array when
   * nothing relevant is found. Ids must not collide with the claim's own evidence ids, so the
   * caller can append the results to the claim.
   */
  corroborate(claim: Claim): Promise<Corroboration>;
}

/**
 * Wraps an EvidenceSourcePort so that every request and result is validated. Throws
 * ContractViolationError on the first violation.
 */
export function guardEvidenceSourcePort(port: EvidenceSourcePort): EvidenceSourcePort {
  return {
    async corroborate(claim) {
      const location = 'EvidenceSourcePort.corroborate';
      const validClaim = parseOrThrow(ClaimSchema, claim, `${location} request`);
      const evidence = parseOrThrow(
        CorroborationSchema,
        await port.corroborate(validClaim),
        `${location} result`,
      );
      const ids = [...validClaim.evidence, ...evidence].map((item) => item.id);
      if (!allUnique(ids)) {
        throw new ContractViolationError(
          `${location} result`,
          'Evidence ids must be unique and must not reuse the claim evidence ids',
        );
      }
      return evidence;
    },
  };
}
