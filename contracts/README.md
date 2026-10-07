# @ecahuil/contracts

The shared language of Ecahuil Network: zod schemas, the TypeScript types inferred from them, and
the port interfaces that separate the claims pipeline from PayPal, evidence sources and the AI
reasoner. `zod` is the only runtime dependency.

```ts
import { ClaimSchema, type Claim } from '@ecahuil/contracts';

const claim: Claim = ClaimSchema.parse(untrustedInput);
```

Every type `X` has a schema `XSchema`. Parse data whenever it crosses a package boundary or comes
from outside (forms, files, providers, the reasoner).

## Conventions

- **Money** is integer USD cents in fields ending in `Cents`, and is never negative: the field
  name or the record's `kind` gives the direction. `CURRENCY` is `"USD"`. Conversion to PayPal
  decimal strings happens only inside `packages/core`.
- **Timestamps** are ISO 8601 strings with an offset (`2026-10-07T09:30:00-05:00` or `...Z`).
  **Calendar dates** are `YYYY-MM-DD`. **Time zones** are IANA names such as
  `America/Mexico_City`; raw offsets such as `+05:00` are rejected.
- **Ids** are synthetic strings of letters, digits and `_ . : -` (`IdSchema`). Ids issued by a
  provider such as PayPal use `ProviderRefSchema`.
- **Synthetic data only.** No field requires real personal data. Use `example.com` or sandbox
  addresses for emails, and made-up names and places.
- **Unknown keys are stripped** when parsing (zod's default).
- The schemas enforce shape, ranges and facts that are true by definition (for example, a
  `deny` decision pays zero). Policy, such as payout caps, confidence bands and the error budget,
  lives in `packages/core`.

## The claims pipeline

```
member ──► 1 intake ──► 2 coverage check ──► 3 verification ──► 4 loss quantification
                                                │
                                                ▼
           9 appeal ◄── 8 payout ◄── 7 rule authorization ◄── 6 assessment ◄── 5 fraud signals
```

| Step                   | What happens                                                                                                                                                                                                                                                                     | Contracts                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1. Intake              | The member files a `Claim` (status `submitted`) for one lost working day, with member-submitted `Evidence`.                                                                                                                                                                      | `Claim`, `Evidence`, `Member`                 |
| 2. Coverage check      | The claim's `Coverage` must match the member's occupation and the cause, be effective on the loss date, and be past its waiting period since `joinedAt`. Missing `requiredEvidenceKinds` lead to `needs_more_evidence`.                                                          | `Coverage`                                    |
| 3. Verification        | `EvidenceSourcePort.corroborate(claim)` returns independent evidence, which is appended to `claim.evidence`. Deterministic checks (scheduled working day, distance to a declared work site, time overlap) are recorded with `pass`, `fail` or `inconclusive`.                    | `EvidenceSourcePort`, `Verification`          |
| 4. Loss quantification | Baseline income versus what the member still earned that day (for example from a platform activity log).                                                                                                                                                                         | `LossEstimate`                                |
| 5. Fraud signals       | Anything that warrants a closer look is recorded as a `FraudSignal` with a stable code, for the reasoner and the rule to weigh.                                                                                                                                                  | `Verification.fraudSignals`                   |
| 6. Assessment          | The AI claims analyst (`ReasonerPort.assess`) reads the member, coverage, claim, verification and loss estimate, and recommends a payout with a confidence, a plain-English rationale, the evidence it relied on and open questions. It recommends; it never authorizes.         | `ReasonerPort`, `AssessRequest`, `Assessment` |
| 7. Rule authorization  | A fixed, public rule turns the assessment into a `Decision`. If the reasoner fails or breaks the contract, `fallback_rule` decides instead. When in doubt the rule prefers to overpay slightly, within the public error budget; `auditRequired` marks decisions to review later. | `Decision`, `FundState`                       |
| 8. Payout              | `PaymentsPort.sendPayouts` sends the money. Each payout is recorded in the public ledger under the member's pseudonym, and the claim becomes `paid`.                                                                                                                             | `PaymentsPort`, `Payout`, `LedgerEntry`       |
| 9. Appeal              | The member can appeal a decision. A rule or a member panel reviews it: `upheld` keeps the decision, `overturned` changes it.                                                                                                                                                     | `Appeal`                                      |

Decision outcomes map to claim statuses: `pay_full` to `approved` (then `paid`),
`pay_partial_provisional` to `partially_approved`, `request_more_evidence` to
`needs_more_evidence`, `deny` to `denied`. An open appeal sets the claim to `appealed`.

On the funding side, members pay a `Contribution` every week through
`PaymentsPort.collectContribution`; it is recorded as a `contribution` ledger entry, and
`FundState` publishes the fund's health.

## Types

| Type            | Purpose and rules                                                                                                                                                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Zone`          | An area where members work: id, name, IANA `timezone` and a `centroid` (latitude -90 to 90, longitude -180 to 180). `Member.zoneId` refers to a zone id.                                                                                                                                                                    |
| `Member`        | A worker in the fund: occupation, zone (`zoneId`), payout email, weekly contribution, baseline daily income, `workSchedule` and `declaredWorkSites`. Hours are in the local time of the member's zone (`Zone.timezone`); days run 0 (Sunday) to 6; `endHour` is exclusive, and lower than `startHour` for overnight shifts. |
| `Occupation`    | `delivery_courier`, `construction_worker`, `street_vendor`, `other`.                                                                                                                                                                                                                                                        |
| `Coverage`      | One version of the terms for an occupation and a cause: required evidence kinds, maximum daily payout, waiting period, effective date. `id` names that exact version.                                                                                                                                                       |
| `CoverageCause` | `road_closure`, `severe_rain`, `extreme_heat`, `platform_outage`, `member_reported`.                                                                                                                                                                                                                                        |
| `Evidence`      | One piece of evidence: kind, plain-English summary, source (`member_submitted` or `independent_source`, with an optional http(s) URL), capture time, optional location, and source-specific `attributes` (strings or numbers).                                                                                              |
| `Claim`         | A request for one lost working day: member, coverage, cause, loss date, description, at least one evidence item (ids unique) and status.                                                                                                                                                                                    |
| `Verification`  | At least one check (`pass`, `fail`, `inconclusive`), whether an independent source corroborates the claim, and fraud signals (`code` in snake_case).                                                                                                                                                                        |
| `LossEstimate`  | Baseline income, actual income and estimated loss for the claim.                                                                                                                                                                                                                                                            |
| `Assessment`    | The reasoner's output: confidence 0 to 1, band (`high`, `medium`, `low`), recommended payout, rationale for the member, ids of the evidence used, open questions.                                                                                                                                                           |
| `Decision`      | The authorized result. Paying outcomes (`pay_full`, `pay_partial_provisional`) carry a positive `payAmountCents`; `request_more_evidence` and `deny` carry zero. Records who authorized it (`rule` or `fallback_rule`), `withinErrorBudget` and `auditRequired`.                                                            |
| `Payout`        | Money sent for a claim, with status `pending`, `success`, `failed`, `unclaimed` or `held`, and the provider's batch and item ids once known.                                                                                                                                                                                |
| `Contribution`  | Money a member pays in, with status `pending`, `success` or `failed`. Only `success` counts towards the balance.                                                                                                                                                                                                            |
| `LedgerEntry`   | One line of the public ledger: kind (`contribution`, `payout`, `yield`, `adjustment`), non-negative amount, pseudonym instead of member id, note. Payout entries must reference a claim.                                                                                                                                    |
| `Appeal`        | A request to review a claim's decision, with status `open`, `upheld` or `overturned`, reviewed by a `rule` or a `member_panel`.                                                                                                                                                                                             |
| `FundState`     | Member count, liquid reserve, simulated yield reserve, first-loss capital, error budget total and remaining (never above the total), solvency ratio, pending exits.                                                                                                                                                         |
| Primitives      | `Id`, `ProviderRef`, `Cents`, `PositiveCents`, `IsoTimestamp`, `CalendarDate`, `TimeZone`, `GeoPoint`, `Confidence`, `ConfidenceBand`.                                                                                                                                                                                      |

## Ports

Each port method has a schema for its arguments and one for its result.

| Port                 | Method                                                            | Argument schemas                   | Result schema                     |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------- | --------------------------------- |
| `PaymentsPort`       | `collectContribution(request)`                                    | `CollectContributionRequestSchema` | `CollectContributionResultSchema` |
|                      | `sendPayouts({ requests, idempotencyKey })`                       | `SendPayoutsRequestSchema`         | `PayoutBatchSchema`               |
|                      | `getPayoutStatus(batchId)`                                        | `ProviderRefSchema`                | `PayoutBatchLookupSchema`         |
|                      | `getBalance()`                                                    | (none)                             | `BalanceSchema`                   |
| `EvidenceSourcePort` | `corroborate(claim)`                                              | `ClaimSchema`                      | `CorroborationSchema`             |
| `ReasonerPort`       | `assess({ member, coverage, claim, verification, lossEstimate })` | `AssessRequestSchema`              | `AssessmentSchema`                |

`PaymentsPort` semantics, which every implementation must honour:

- **Idempotency.** Retrying with the same idempotency key returns the original result and never
  moves money twice. Reusing a key with a different payload is a caller error.
- **Insufficient funds.** `sendPayouts` does not reject for lack of funds. An item that exceeds
  the available balance ends as `failed`. `payouts[i]` answers `requests[i]`.
- **Status lookup.** `getPayoutStatus` returns the batch, or `null` for an unknown batch id.
- **Balance.** `availableCents` is the starting balance, plus `success` contributions, minus
  payouts that are not `failed`.

`EvidenceSourcePort.corroborate` returns only `independent_source` evidence, possibly none, with
ids that do not collide with the claim's evidence. `AssessRequest` requires every part to refer to
the same claim, member and coverage.

**Guards.** `guardPaymentsPort`, `guardEvidenceSourcePort` and `guardReasonerPort` wrap an
implementation and validate every argument and result, plus a few cross-checks (a result answers
its request; an assessment is for the same claim and cites only the claim's evidence). A violation
throws `ContractViolationError`, with the `ZodError` as `cause` when a schema rejected the value.
`packages/core` can wrap the reasoner and fall back to `fallback_rule` on this error.

## Testing entry point

`@ecahuil/contracts/testing` exports `runPaymentsPortContract`, a reusable Vitest suite that every
`PaymentsPort` implementation must pass. Vitest is an optional peer dependency, needed only by
packages that import this entry point.

```ts
import { runPaymentsPortContract } from '@ecahuil/contracts/testing';

runPaymentsPortContract(() => new MyPaymentsPort(/* fresh, funded account */), {
  member: { memberId: 'mem-0001', receiverEmail: 'sandbox-receiver@example.com' },
  settleTimeoutMs: 30_000, // allow for a slow sandbox
});
```

It checks idempotent contributions, idempotent payout batches, that items exceeding the available
balance end as `failed`, status lookup (including `null` for unknown batches), and balance
consistency. It polls `getPayoutStatus` until no payout is `pending`. The factory is called once
per test and must return a port with at least four times `amountCents` (default 500) available.
Against a sandbox, `receiverEmail` must be an account that can receive payouts.

## Changing the contracts

A change to `contracts/` goes in its own pull request and is announced to the other contributors
before it is merged (see `CONTRIBUTING.md`). Every exported schema needs valid and invalid examples
in `test/schemas.test.ts`; typechecking fails until a new schema has them.
