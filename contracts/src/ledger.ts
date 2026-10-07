import { z } from 'zod';
import { text } from './internal.js';
import { CentsSchema, IdSchema, IsoTimestampSchema } from './primitives.js';

export const LedgerEntryKindSchema = z.enum(['contribution', 'payout', 'yield', 'adjustment']);
export type LedgerEntryKind = z.infer<typeof LedgerEntryKindSchema>;

/** `credit` adds money to the fund, `debit` removes it. */
export const LedgerEntryDirectionSchema = z.enum(['credit', 'debit']);
export type LedgerEntryDirection = z.infer<typeof LedgerEntryDirectionSchema>;

/** Kinds whose direction is fixed. Adjustments may go either way. */
const REQUIRED_DIRECTION: Partial<Record<LedgerEntryKind, LedgerEntryDirection>> = {
  contribution: 'credit',
  yield: 'credit',
  payout: 'debit',
};

/**
 * One line of the public ledger. It names members only by pseudonym. `amountCents` is never
 * negative: `direction` says which way the money moves.
 */
export const LedgerEntrySchema = z
  .object({
    id: IdSchema,
    at: IsoTimestampSchema,
    kind: LedgerEntryKindSchema,
    direction: LedgerEntryDirectionSchema,
    amountCents: CentsSchema,
    pseudonym: text(64),
    claimId: IdSchema.optional(),
    note: z.string().max(280),
  })
  .refine(
    (entry) => {
      const required = REQUIRED_DIRECTION[entry.kind];
      return required === undefined || entry.direction === required;
    },
    {
      message: 'Contribution and yield entries must be credits, payout entries debits',
      path: ['direction'],
    },
  )
  .refine((entry) => entry.kind !== 'payout' || entry.claimId !== undefined, {
    message: 'Payout entries must reference a claim',
    path: ['claimId'],
  });
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
