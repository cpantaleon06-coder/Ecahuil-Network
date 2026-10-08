import { describe } from 'vitest';
import { guardPaymentsPort } from '@ecahuil/contracts';
import { runPaymentsPortContract } from '@ecahuil/contracts/testing';
import { SimPaymentsAdapter } from '../src/adapters/sim-payments-adapter.js';
import { ManualClock } from '../src/clock.js';

/** A clock that moves forward on every read, so polling alone lets pending payouts settle. */
class TickingClock extends ManualClock {
  readonly #stepMs: number;

  constructor(stepMs: number) {
    super();
    this.#stepMs = stepMs;
  }

  override now(): number {
    const nowMs = super.now();
    this.advance(this.#stepMs);
    return nowMs;
  }
}

describe('SimPaymentsAdapter without a settlement delay', () => {
  runPaymentsPortContract(() => new SimPaymentsAdapter({ seed: 7, initialBalanceCents: 10_000 }));
});

describe('SimPaymentsAdapter with a settlement delay', () => {
  runPaymentsPortContract(
    () =>
      new SimPaymentsAdapter({
        seed: 7,
        initialBalanceCents: 10_000,
        settlementDelayMs: 250,
        clock: new TickingClock(50),
      }),
    { pollIntervalMs: 1 },
  );
});

describe('SimPaymentsAdapter behind guardPaymentsPort', () => {
  runPaymentsPortContract(() =>
    guardPaymentsPort(new SimPaymentsAdapter({ seed: 7, initialBalanceCents: 10_000 })),
  );
});
