import { describe } from 'vitest';
import { guardPaymentsPort } from '@ecahuil/contracts';
import { runPaymentsPortContract } from '@ecahuil/contracts/testing';
import { SimPaymentsAdapter } from '../src/adapters/sim-payments-adapter.js';

const SETTLEMENT_DELAY_MS = 60_000;

describe('SimPaymentsAdapter without a settlement delay', () => {
  runPaymentsPortContract(() => new SimPaymentsAdapter({ seed: 7, initialBalanceCents: 10_000 }));
});

describe('SimPaymentsAdapter with a settlement delay, settled through the hook', () => {
  runPaymentsPortContract(
    () =>
      new SimPaymentsAdapter({
        seed: 7,
        initialBalanceCents: 10_000,
        settlementDelayMs: SETTLEMENT_DELAY_MS,
      }),
    {
      settle: (port) => {
        if (port instanceof SimPaymentsAdapter) {
          port.advanceTime(SETTLEMENT_DELAY_MS);
        }
        return Promise.resolve();
      },
    },
  );
});

describe('SimPaymentsAdapter behind guardPaymentsPort', () => {
  runPaymentsPortContract(() =>
    guardPaymentsPort(new SimPaymentsAdapter({ seed: 7, initialBalanceCents: 10_000 })),
  );
});
