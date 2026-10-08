import {
  CentsSchema,
  CollectContributionRequestSchema,
  SendPayoutsRequestSchema,
  type Balance,
  type CollectContributionRequest,
  type CollectContributionResult,
  type Contribution,
  type PaymentsPort,
  type Payout,
  type PayoutBatch,
  type PayoutBatchLookup,
  type PayoutStatus,
  type SendPayoutsRequest,
} from '@ecahuil/contracts';
import { ManualClock, type SimClock } from '../clock.js';
import { mulberry32, type Random } from '../random.js';

export interface SimPaymentsAdapterOptions {
  /** Seed for the PRNG behind `failureRate`. Default: 1. */
  seed?: number;
  /** Available balance at start, in integer USD cents. Default: 0. */
  initialBalanceCents?: number;
  /** Probability, from 0 to 1, that a funded payout ends `failed`. Default: 0. */
  failureRate?: number;
  /** Members whose funded payouts always end `failed`. */
  alwaysFailMemberIds?: readonly string[];
  /** Members whose funded payouts always end `unclaimed`. */
  unclaimedMemberIds?: readonly string[];
  /** Members whose funded payouts always end `held`. */
  heldMemberIds?: readonly string[];
  /** Simulated milliseconds a funded payout stays `pending`. Default: 0. */
  settlementDelayMs?: number;
  /** Simulated time. Default: a ManualClock starting at SIM_EPOCH_MS. */
  clock?: SimClock;
}

type FinalPayoutStatus = Exclude<PayoutStatus, 'pending'>;

interface StoredPayout {
  payout: Omit<Payout, 'status'>;
  finalStatus: FinalPayoutStatus;
  settlesAtMs: number;
}

interface StoredBatch {
  batchId: string;
  fingerprint: string;
  payouts: StoredPayout[];
}

/**
 * In-memory PaymentsPort for simulations and tests. Deterministic: random failures come from a
 * seeded PRNG and all timestamps from the injected clock.
 *
 * - A payout that exceeds the available balance is `failed` at once and never reserves funds.
 * - Every other payout reserves its amount, stays `pending` for `settlementDelayMs`, then takes
 *   its final status. Member lists win over `failureRate`. A payout that ends `failed` releases
 *   its reservation; `success`, `unclaimed` and `held` keep it.
 * - Statuses follow the clock: call `advanceTime(ms)` (or advance a shared clock) to settle.
 * - Contributions succeed at once.
 * - Reusing an idempotency key with a different payload throws.
 */
export class SimPaymentsAdapter implements PaymentsPort {
  readonly #clock: SimClock;
  readonly #random: Random;
  readonly #initialBalanceCents: number;
  readonly #failureRate: number;
  readonly #settlementDelayMs: number;
  readonly #forcedStatus = new Map<string, FinalPayoutStatus>();
  readonly #contributions = new Map<string, Contribution>();
  readonly #batchesByKey = new Map<string, StoredBatch>();
  readonly #batchesById = new Map<string, StoredBatch>();
  #sequence = 0;

  constructor(options: SimPaymentsAdapterOptions = {}) {
    const failureRate = options.failureRate ?? 0;
    if (!(failureRate >= 0 && failureRate <= 1)) {
      throw new RangeError(`failureRate must be between 0 and 1, got ${failureRate}`);
    }
    const settlementDelayMs = options.settlementDelayMs ?? 0;
    if (!Number.isSafeInteger(settlementDelayMs) || settlementDelayMs < 0) {
      throw new RangeError(
        `settlementDelayMs must be a non-negative integer, got ${settlementDelayMs}`,
      );
    }

    this.#random = mulberry32(options.seed ?? 1);
    this.#clock = options.clock ?? new ManualClock();
    this.#initialBalanceCents = CentsSchema.parse(options.initialBalanceCents ?? 0);
    this.#failureRate = failureRate;
    this.#settlementDelayMs = settlementDelayMs;
    this.#forceStatus(options.alwaysFailMemberIds, 'failed');
    this.#forceStatus(options.unclaimedMemberIds, 'unclaimed');
    this.#forceStatus(options.heldMemberIds, 'held');
  }

  /** Moves simulated time forward; payouts whose delay has elapsed take their final status. */
  advanceTime(ms: number): void {
    this.#clock.advance(ms);
  }

  collectContribution(request: CollectContributionRequest): Promise<CollectContributionResult> {
    return run(() => {
      const valid = CollectContributionRequestSchema.parse(request);
      let contribution = this.#contributions.get(valid.idempotencyKey);
      if (contribution === undefined) {
        contribution = {
          id: this.#nextId('sim-contribution'),
          memberId: valid.memberId,
          amountCents: valid.amountCents,
          createdAt: toIsoTimestamp(this.#clock.now()),
          status: 'success',
        };
        this.#contributions.set(valid.idempotencyKey, contribution);
      } else if (
        contribution.memberId !== valid.memberId ||
        contribution.amountCents !== valid.amountCents
      ) {
        throw idempotencyConflict(valid.idempotencyKey);
      }
      return { contribution: { ...contribution } };
    });
  }

  sendPayouts(request: SendPayoutsRequest): Promise<PayoutBatch> {
    return run(() => {
      const valid = SendPayoutsRequestSchema.parse(request);
      const fingerprint = JSON.stringify(valid.requests);
      const existing = this.#batchesByKey.get(valid.idempotencyKey);
      if (existing !== undefined) {
        if (existing.fingerprint !== fingerprint) {
          throw idempotencyConflict(valid.idempotencyKey);
        }
        return this.#view(existing, this.#clock.now());
      }

      const nowMs = this.#clock.now();
      const createdAt = toIsoTimestamp(nowMs);
      const batchId = this.#nextId('SIM-BATCH');
      let availableCents = this.#availableCents(nowMs);
      const payouts = valid.requests.map((item): StoredPayout => {
        // Draw for every item, so one member's outcome never shifts another member's draw.
        const draw = this.#random();
        const funded = item.amountCents <= availableCents;
        if (funded) {
          availableCents -= item.amountCents;
        }
        return {
          payout: {
            id: this.#nextId('sim-payout'),
            claimId: item.claimId,
            memberId: item.memberId,
            amountCents: item.amountCents,
            providerBatchId: batchId,
            providerItemId: this.#nextId('SIM-ITEM'),
            createdAt,
          },
          finalStatus: funded ? this.#outcomeFor(item.memberId, draw) : 'failed',
          settlesAtMs: funded ? nowMs + this.#settlementDelayMs : nowMs,
        };
      });

      const batch: StoredBatch = { batchId, fingerprint, payouts };
      this.#batchesByKey.set(valid.idempotencyKey, batch);
      this.#batchesById.set(batchId, batch);
      return this.#view(batch, nowMs);
    });
  }

  getPayoutStatus(batchId: string): Promise<PayoutBatchLookup> {
    return run(() => {
      const batch = this.#batchesById.get(batchId);
      return batch === undefined ? null : this.#view(batch, this.#clock.now());
    });
  }

  getBalance(): Promise<Balance> {
    return run(() => {
      const nowMs = this.#clock.now();
      return { availableCents: this.#availableCents(nowMs), asOf: toIsoTimestamp(nowMs) };
    });
  }

  #forceStatus(memberIds: readonly string[] | undefined, status: FinalPayoutStatus): void {
    for (const memberId of memberIds ?? []) {
      const previous = this.#forcedStatus.get(memberId);
      if (previous !== undefined && previous !== status) {
        throw new RangeError(`Member ${memberId} is configured as both ${previous} and ${status}`);
      }
      this.#forcedStatus.set(memberId, status);
    }
  }

  #outcomeFor(memberId: string, draw: number): FinalPayoutStatus {
    return this.#forcedStatus.get(memberId) ?? (draw < this.#failureRate ? 'failed' : 'success');
  }

  #availableCents(nowMs: number): number {
    let balance = this.#initialBalanceCents;
    for (const contribution of this.#contributions.values()) {
      if (contribution.status === 'success') {
        balance += contribution.amountCents;
      }
    }
    for (const batch of this.#batchesById.values()) {
      for (const stored of batch.payouts) {
        if (statusAt(stored, nowMs) !== 'failed') {
          balance -= stored.payout.amountCents;
        }
      }
    }
    return balance;
  }

  #view(batch: StoredBatch, nowMs: number): PayoutBatch {
    return {
      batchId: batch.batchId,
      payouts: batch.payouts.map((stored) => ({
        ...stored.payout,
        status: statusAt(stored, nowMs),
      })),
    };
  }

  #nextId(prefix: string): string {
    this.#sequence += 1;
    return `${prefix}-${String(this.#sequence).padStart(6, '0')}`;
  }
}

function statusAt(stored: StoredPayout, nowMs: number): PayoutStatus {
  return nowMs >= stored.settlesAtMs ? stored.finalStatus : 'pending';
}

function toIsoTimestamp(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

function idempotencyConflict(idempotencyKey: string): Error {
  return new Error(`Idempotency key "${idempotencyKey}" was already used with a different payload`);
}

/** Runs synchronous work as a promise, turning a thrown error into a rejection. */
function run<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(work());
  });
}
