import { z } from 'zod';
import { text } from './internal.js';
import { CentsSchema, IdSchema, IsoTimestampSchema } from './primitives.js';

/** `contribution` and `yield` add money to the fund, `payout` removes it. */
export const LedgerEntryKindSchema = z.enum(['contribution', 'payout', 'yield', 'adjustment']);
export type LedgerEntryKind = z.infer<typeof LedgerEntryKindSchema>;

/**
 * One line of the public ledger. It names members only by pseudonym. `amountCents` is never
 * negative: `kind` gives the direction.
 */
export const LedgerEntrySchema = z
  .object({
    id: IdSchema,
    at: IsoTimestampSchema,
    kind: LedgerEntryKindSchema,
    amountCents: CentsSchema,
    pseudonym: text(64),
    claimId: IdSchema.optional(),
    note: z.string().max(280),
  })
  .refine((entry) => entry.kind !== 'payout' || entry.claimId !== undefined, {
    message: 'Payout entries must reference a claim',
    path: ['claimId'],
  });
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
