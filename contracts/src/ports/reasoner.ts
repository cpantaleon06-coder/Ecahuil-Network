import { z } from 'zod';
import { AssessmentSchema, type Assessment } from '../assessment.js';
import { ClaimSchema } from '../claim.js';
import { CoverageSchema } from '../coverage.js';
import { LossEstimateSchema } from '../loss-estimate.js';
import { MemberSchema } from '../member.js';
import { VerificationSchema } from '../verification.js';
import { ContractViolationError, parseOrThrow } from './contract-violation.js';

/** Everything the reasoner sees about a claim. All parts must refer to the same claim. */
export const AssessRequestSchema = z
  .object({
    member: MemberSchema,
    coverage: CoverageSchema,
    claim: ClaimSchema,
    verification: VerificationSchema,
    lossEstimate: LossEstimateSchema,
  })
  .refine((request) => request.claim.memberId === request.member.id, {
    message: 'The claim belongs to a different member',
    path: ['claim', 'memberId'],
  })
  .refine((request) => request.claim.coverageId === request.coverage.id, {
    message: 'The claim references a different coverage',
    path: ['claim', 'coverageId'],
  })
  .refine((request) => request.verification.claimId === request.claim.id, {
    message: 'The verification is for a different claim',
    path: ['verification', 'claimId'],
  })
  .refine((request) => request.lossEstimate.claimId === request.claim.id, {
    message: 'The loss estimate is for a different claim',
    path: ['lossEstimate', 'claimId'],
  });
export type AssessRequest = z.infer<typeof AssessRequestSchema>;

/**
 * The AI claims analyst. It recommends; it never authorizes. Implementations validate their
 * output with AssessmentSchema before returning it (guardReasonerPort does this for them).
 */
export interface ReasonerPort {
  assess(request: AssessRequest): Promise<Assessment>;
}

/**
 * Wraps a ReasonerPort so that every request and result is validated. Also rejects assessments
 * for another claim and assessments that cite evidence the claim does not contain. Throws
 * ContractViolationError on the first violation.
 */
export function guardReasonerPort(port: ReasonerPort): ReasonerPort {
  return {
    async assess(request) {
      const location = 'ReasonerPort.assess';
      const valid = parseOrThrow(AssessRequestSchema, request, `${location} request`);
      const assessment = parseOrThrow(
        AssessmentSchema,
        await port.assess(valid),
        `${location} result`,
      );
      if (assessment.claimId !== valid.claim.id) {
        throw new ContractViolationError(`${location} result`, 'Assessed a different claim');
      }
      const knownEvidence = new Set(valid.claim.evidence.map((item) => item.id));
      const unknown = assessment.evidenceUsed.filter((id) => !knownEvidence.has(id));
      if (unknown.length > 0) {
        throw new ContractViolationError(
          `${location} result`,
          `Cites evidence the claim does not contain: ${unknown.join(', ')}`,
        );
      }
      return assessment;
    },
  };
}
