import { describe } from 'vitest';
import { guardPaymentsPort } from '../src/index.js';
import { runPaymentsPortContract } from '../src/testing/index.js';
import { InMemoryPaymentsPort } from './support/in-memory-payments-port.js';

describe('InMemoryPaymentsPort', () => {
  runPaymentsPortContract(() => new InMemoryPaymentsPort(10_000));
});

describe('InMemoryPaymentsPort behind guardPaymentsPort', () => {
  runPaymentsPortContract(() => guardPaymentsPort(new InMemoryPaymentsPort(10_000)), {
    amountCents: 1_250,
    pollIntervalMs: 10,
  });
});
