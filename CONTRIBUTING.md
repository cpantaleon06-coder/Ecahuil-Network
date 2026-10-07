# Contributing to Ecahuil Network

## Ground rules

1. **English only.** Code, identifiers, comments, commit messages, docs, tests, issues and pull
   requests are all written in English.
2. **Contracts first.** `contracts/` is the shared language between packages. Any change to
   `contracts/` goes in its own pull request, separate from the implementation work that depends
   on it, and is announced to the other contributors before it is merged.
3. **One branch per task, small pull requests.** Name branches after the task (for example
   `c3-claims-pipeline`). Keep commits small, with short imperative messages ("Add claim schema").
4. **Only `packages/core` talks to PayPal.** Every other package goes through the ports defined in
   `@ecahuil/contracts` (for example `PaymentsPort`).
5. **Secrets live only in `.env`.** `.env` is ignored by git. `.env.example` lists the variable
   names with no values. Never commit, print or log a secret.
6. **Tests, lint and typecheck must pass before merging:**

   ```bash
   pnpm test && pnpm lint && pnpm typecheck
   ```

   Run `pnpm format` before pushing so diffs stay readable.

7. **Money is integer cents.** Amounts are integers in USD cents, and field names end in `Cents`
   (for example `amountCents`). Conversion to PayPal decimal strings happens only inside
   `packages/core`.

## Other conventions

- Timestamps are ISO 8601 strings with an offset (`2026-10-07T14:30:00Z` or
  `2026-10-07T09:30:00-05:00`). Calendar dates are `YYYY-MM-DD` strings.
- All data is synthetic. Never add real personal data (names, emails, locations, photos) to the
  repository, fixtures or tests.
- Validate data at package boundaries with the zod schemas from `@ecahuil/contracts`.
