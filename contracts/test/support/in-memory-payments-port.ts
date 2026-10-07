import type {
  Balance,
  CollectContributionRequest,
  CollectContributionResult,
  Contribution,
  PaymentsPort,
  Payout,
  PayoutBatch,
  PayoutBatchLookup,
  PayoutStatus,
  SendPayoutsRequest,
} from '../../src/index.js';

interface StoredBatch {
  batchId: string;
  items: Array<{ payout: Payout; finalStatus: PayoutStatus }>;
  lookedUp: boolean;
}

/**
 * Reference PaymentsPort used to test the contract suite. Funds are reserved when a batch is sent,
 * and payouts report `pending` until their batch has been looked up once, so callers must poll.
 */
export class InMemoryPaymentsPort implements PaymentsPort {
  #availableCents: number;
  #sequence = 0;
  readonly #contributionsByKey = new Map<string, Contribution>();
  readonly #batchIdsByKey = new Map<string, string>();
  readonly #batches = new Map<string, StoredBatch>();

  constructor(initialBalanceCents: number) {
    this.#availableCents = initialBalanceCents;
  }

  collectContribution(request: CollectContributionRequest): Promise<CollectContributionResult> {
    let contribution = this.#contributionsByKey.get(request.idempotencyKey);
    if (contribution === undefined) {
      contribution = {
        id: this.#nextId('contribution'),
        memberId: request.memberId,
        amountCents: request.amountCents,
        createdAt: new Date().toISOString(),
        status: 'success',
      };
      this.#contributionsByKey.set(request.idempotencyKey, contribution);
      this.#availableCents += request.amountCents;
    }
    return Promise.resolve({ contribution: { ...contribution } });
  }

  sendPayouts({ requests, idempotencyKey }: SendPayoutsRequest): Promise<PayoutBatch> {
    const existingId = this.#batchIdsByKey.get(idempotencyKey);
    if (existingId !== undefined) {
      return Promise.resolve(this.#view(this.#mustGet(existingId)));
    }

    const batchId = this.#nextId('batch');
    const createdAt = new Date().toISOString();
    const items = requests.map((request) => {
      const affordable = request.amountCents <= this.#availableCents;
      if (affordable) {
        this.#availableCents -= request.amountCents;
      }
      const payout: Payout = {
        id: this.#nextId('payout'),
        claimId: request.claimId,
        memberId: request.memberId,
        amountCents: request.amountCents,
        status: 'pending',
        providerBatchId: batchId,
        providerItemId: this.#nextId('item'),
        createdAt,
      };
      return { payout, finalStatus: affordable ? ('success' as const) : ('failed' as const) };
    });
    const batch: StoredBatch = { batchId, items, lookedUp: false };
    this.#batches.set(batchId, batch);
    this.#batchIdsByKey.set(idempotencyKey, batchId);
    return Promise.resolve(this.#view(batch));
  }

  getPayoutStatus(batchId: string): Promise<PayoutBatchLookup> {
    const batch = this.#batches.get(batchId);
    if (batch === undefined) {
      return Promise.resolve(null);
    }
    const view = this.#view(batch);
    batch.lookedUp = true;
    return Promise.resolve(view);
  }

  getBalance(): Promise<Balance> {
    return Promise.resolve({
      availableCents: this.#availableCents,
      asOf: new Date().toISOString(),
    });
  }

  #view(batch: StoredBatch): PayoutBatch {
    return {
      batchId: batch.batchId,
      payouts: batch.items.map(({ payout, finalStatus }) => ({
        ...payout,
        status: batch.lookedUp ? finalStatus : payout.status,
      })),
    };
  }

  #mustGet(batchId: string): StoredBatch {
    const batch = this.#batches.get(batchId);
    if (batch === undefined) {
      throw new Error(`Unknown batch ${batchId}`);
    }
    return batch;
  }

  #nextId(prefix: string): string {
    this.#sequence += 1;
    return `${prefix}-${this.#sequence}`;
  }
}
