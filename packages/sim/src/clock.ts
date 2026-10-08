/** Simulated time. Simulations never read the real clock. */
export interface SimClock {
  /** Current simulated time, in epoch milliseconds. */
  now(): number;
  /** Moves simulated time forward by `ms` milliseconds. */
  advance(ms: number): void;
}

/** Default start of simulated time: 2026-01-01T00:00:00Z. */
export const SIM_EPOCH_MS = Date.UTC(2026, 0, 1);

/** A clock that only moves when `advance` is called. */
export class ManualClock implements SimClock {
  #nowMs: number;

  constructor(startMs: number = SIM_EPOCH_MS) {
    if (!Number.isSafeInteger(startMs)) {
      throw new RangeError(`Start time must be integer epoch milliseconds, got ${startMs}`);
    }
    this.#nowMs = startMs;
  }

  now(): number {
    return this.#nowMs;
  }

  advance(ms: number): void {
    if (!Number.isSafeInteger(ms) || ms < 0) {
      throw new RangeError(`Can only advance by a non-negative integer of ms, got ${ms}`);
    }
    this.#nowMs += ms;
  }
}
