import { afterAll, describe, expect } from 'vitest';
import { guardPaymentsPort } from '../src/index.js';
import { runPaymentsPortContract } from '../src/testing/index.js';
import { InMemoryPaymentsPort } from './support/in-memory-payments-port.js';

describe('InMemoryPaymentsPort without a settle hook (polled)', () => {
  runPaymentsPortContract(() => new InMemoryPaymentsPort(10_000));
});

describe('InMemoryPaymentsPort behind guardPaymentsPort', () => {
  runPaymentsPortContract(() => guardPaymentsPort(new InMemoryPaymentsPort(10_000)), {
    amountCents: 1_250,
    pollIntervalMs: 10,
  });
});

describe('InMemoryPaymentsPort with a settle hook', () => {
  // Manual settlement never happens on its own, so these tests only pass if the suite calls the
  // hook before asserting final statuses.
  let port: InMemoryPaymentsPort | undefined;
  let settleCalls = 0;

  runPaymentsPortContract(
    () => (port = new InMemoryPaymentsPort(10_000, { settlement: 'manual' })),
    {
      settle: () => {
        settleCalls += 1;
        port?.settleAll();
        return Promise.resolve();
      },
      timeoutMs: 5_000,
    },
  );

  afterAll(() => {
    // Once per contract test that sends payouts.
    expect(settleCalls).toBe(4);
  });
});
