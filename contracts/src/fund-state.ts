import { z } from 'zod';
import { CentsSchema } from './primitives.js';

/** A snapshot of the fund's health, published alongside the ledger. */
export const FundStateSchema = z
  .object({
    memberCount: z.int().nonnegative(),
    /** Money available to pay claims right away. */
    liquidReserveCents: CentsSchema,
    /** Money placed to earn yield. Simulated in this project. */
    yieldReserveCents: CentsSchema,
    /** Sponsor capital that absorbs losses before members' money does. */
    firstLossCapitalCents: CentsSchema,
    /** Public allowance for overpayments in the current period. */
    errorBudgetTotalCents: CentsSchema,
    errorBudgetRemainingCents: CentsSchema,
    solvencyRatio: z.number().nonnegative(),
    /** Money owed to members who asked to leave the fund. */
    pendingExitsCents: CentsSchema,
  })
  .refine((state) => state.errorBudgetRemainingCents <= state.errorBudgetTotalCents, {
    message: 'errorBudgetRemainingCents must not exceed errorBudgetTotalCents',
    path: ['errorBudgetRemainingCents'],
  });
export type FundState = z.infer<typeof FundStateSchema>;
