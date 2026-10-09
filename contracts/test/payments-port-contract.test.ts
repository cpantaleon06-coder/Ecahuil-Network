import { afterAll, describe, expect } from 'vitest';
import { guardPaymentsPort, type PaymentsPort } from '../src/index.js';
import { runPaymentsPortContract } from '../src/testing/index.js';
import { InMemoryPaymentsPort } from './support/in-memory-payments-port.js';

// Manual settlement never happens on its own, so the hook runs below only pass if the suite calls
// the hook before asserting final statuses.
function manualPort(): InMemoryPaymentsPort {
  return new InMemoryPaymentsPort(10_000, { settlement: 'manual' });
}

describe('InMemoryPaymentsPort without a settle hook (polled)', () => {
  runPaymentsPortContract(() => new InMemoryPaymentsPort(10_000));
});

describe('InMemoryPaymentsPort behind guardPaymentsPort', () => {
  runPaymentsPortContract(() => guardPaymentsPort(new InMemoryPaymentsPort(10_000)), {
    amountCents: 1_250,
    pollIntervalMs: 10,
  });
});

describe('InMemoryPaymentsPort with a settle hook that uses the port', () => {
  const created: PaymentsPort[] = [];
  const settled: PaymentsPort[] = [];

  runPaymentsPortContract(
    () => {
      const port = manualPort();
      created.push(port);
      return port;
    },
    {
      settle: (port) => {
        settled.push(port);
        if (port instanceof InMemoryPaymentsPort) {
          port.settleAll();
        }
        return Promise.resolve();
      },
      timeoutMs: 5_000,
    },
  );

  afterAll(() => {
    // Once per contract test that sends payouts, each time with that test's own port.
    expect(settled).toHaveLength(4);
    expect(settled.every((port) => created.includes(port))).toBe(true);
    expect(new Set(settled).size).toBe(4);
  });
});

describe('InMemoryPaymentsPort with a zero-argument settle hook', () => {
  let current: InMemoryPaymentsPort | undefined;
  let settleCalls = 0;

  runPaymentsPortContract(() => (current = manualPort()), {
    settle: () => {
      settleCalls += 1;
      current?.settleAll();
      return Promise.resolve();
    },
    timeoutMs: 5_000,
  });

  afterAll(() => {
    expect(settleCalls).toBe(4);
  });
});
