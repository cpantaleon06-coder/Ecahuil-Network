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
  contributionFailureRate: 0.02,
  contributionFailMemberIds: ['member-023'],
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
- Contributions settle at once. A contribution from a member in `contributionFailMemberIds`, or
  one that loses the `contributionFailureRate` draw, comes back with status `failed`: it keeps its
  id, member and amount, adds nothing to the balance, and a retry with the same idempotency key
  returns it unchanged. Contributions draw from their own PRNG stream (derived from `seed`), once
  per new contribution even when the outcome is forced, so they never shift any other outcome.
- Reusing an idempotency key with a different payload throws.

In contract tests, the settle hook advances the clock past the delay:

```ts
runPaymentsPortContract(() => new SimPaymentsAdapter({ settlementDelayMs: 60_000 }), {
  settle: async (port) => {
    if (port instanceof SimPaymentsAdapter) port.advanceTime(60_000);
  },
});
```

## Synthetic members

`zones` lists eight Mexico City boroughs (approximate centroids, for demo use only). The list and
its zones are frozen; copy them if you need to change anything.
`generateMembers({ count, seed, paypalEmails })` returns schema-valid members spread over those
zones and all occupations. Incomes and contribution rates are synthetic placeholders, to be
calibrated later.

```bash
pnpm --filter @ecahuil/sim generate:members
```

The script builds the package, then generates 100 members with seed 42 and prints which file it
wrote:

- Without `data/sandbox-accounts.local.json`, it writes the committed
  `data/synthetic-members.json`, where every member has a `member-###@example.invalid` address.
  The output is byte-identical between runs.
- With that file (a JSON array of email strings, or of objects with an `email` property), its
  emails go to the first members in order, and the result is written to the git-ignored
  `data/synthetic-members.local.json`. The committed dataset is not touched, so local emails never
  reach the repository.
