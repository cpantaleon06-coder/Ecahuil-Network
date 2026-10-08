# @ecahuil/sim

Deterministic simulations for Ecahuil Network. Nothing here touches the network or the real
clock, and all data is synthetic.

## SimPaymentsAdapter

An in-memory `PaymentsPort` that passes `runPaymentsPortContract`.

```ts
import { SimPaymentsAdapter } from '@ecahuil/sim';

const payments = new SimPaymentsAdapter({
  seed: 42,
  initialBalanceCents: 500_000,
  failureRate: 0.05,
  alwaysFailMemberIds: ['member-007'],
  unclaimedMemberIds: ['member-012'],
  heldMemberIds: ['member-019'],
  settlementDelayMs: 60_000,
});

const batch = await payments.sendPayouts({ requests, idempotencyKey: 'payouts-2026-10-08' });
payments.advanceTime(60_000); // pending payouts now take their final status
```

- Random failures come from a seeded PRNG (mulberry32), and timestamps from an injectable
  `SimClock` (default: a `ManualClock` starting at 2026-01-01T00:00:00Z).
- A payout that exceeds the available balance is `failed` at once and never reserves funds.
  Every other payout reserves its amount, stays `pending` for `settlementDelayMs`, then takes its
  final status. Member lists take precedence over `failureRate`. `failed` releases the reservation;
  `success`, `unclaimed` and `held` keep it.
- Statuses follow the clock, so advancing a shared clock settles payouts too.
- Contributions succeed at once. Reusing an idempotency key with a different payload throws.

## Synthetic members

`zones` lists eight Mexico City boroughs (approximate centroids, for demo use only).
`generateMembers({ count, seed, paypalEmails })` returns schema-valid members spread over those
zones and all occupations. Incomes and contribution rates are synthetic placeholders, to be
calibrated later.

```bash
pnpm --filter @ecahuil/sim generate:members
```

The script builds the package, then writes `data/synthetic-members.json` with seed 42. If
`data/sandbox-accounts.local.json` exists (a JSON array of email strings, or of objects with an
`email` property), its emails go to the first members in order; everyone else gets
`member-###@example.invalid`. The output is byte-identical between runs.
