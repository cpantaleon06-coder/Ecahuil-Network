import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import {
  ContractViolationError,
  guardEvidenceSourcePort,
  guardPaymentsPort,
  guardReasonerPort,
  type EvidenceSourcePort,
  type PaymentsPort,
  type ReasonerPort,
} from '../src/index.js';
import * as fx from './fixtures.js';
import { InMemoryPaymentsPort } from './support/in-memory-payments-port.js';

describe('guardPaymentsPort', () => {
  it('passes valid calls through', async () => {
    const port = guardPaymentsPort(new InMemoryPaymentsPort(10_000));

    const { contribution } = await port.collectContribution(fx.collectContributionRequest);
    const batch = await port.sendPayouts([fx.payoutRequest], 'batch-1');

    expect(contribution.amountCents).toBe(fx.collectContributionRequest.amountCents);
    expect(batch.payouts).toHaveLength(1);
    expect(await port.getPayoutStatus(batch.batchId)).toMatchObject({ batchId: batch.batchId });
    expect(await port.getPayoutStatus('unknown')).toBeNull();
    expect((await port.getBalance()).availableCents).toBe(10_000 + 300 - 3_000);
  });

  it('rejects an invalid request without calling the port', async () => {
    const inner = new InMemoryPaymentsPort(10_000);
    const sendPayouts = vi.spyOn(inner, 'sendPayouts');
    const port = guardPaymentsPort(inner);

    const error: unknown = await port
      .sendPayouts([{ ...fx.payoutRequest, amountCents: 10.5 }], 'batch-1')
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ContractViolationError);
    expect((error as ContractViolationError).cause).toBeInstanceOf(ZodError);
    await expect(port.sendPayouts([fx.payoutRequest], 'not a key')).rejects.toThrow(
      'PaymentsPort.sendPayouts request',
    );
    expect(sendPayouts).not.toHaveBeenCalled();
  });

  it('rejects results that do not answer the request', async () => {
    const inner = new InMemoryPaymentsPort(10_000);
    const port = guardPaymentsPort({
      collectContribution: async (request) => {
        const result = await inner.collectContribution(request);
        return { contribution: { ...result.contribution, amountCents: request.amountCents + 1 } };
      },
      sendPayouts: async (requests, key) => {
        const batch = await inner.sendPayouts(requests, key);
        return { ...batch, payouts: [...batch.payouts].reverse() };
      },
      getPayoutStatus: async () =>
        inner.getPayoutStatus((await inner.sendPayouts([fx.payoutRequest], 'other')).batchId),
      getBalance: () => Promise.resolve({ availableCents: -1, asOf: '2026-10-07T00:00:00Z' }),
    } satisfies PaymentsPort);

    await expect(port.collectContribution(fx.collectContributionRequest)).rejects.toThrow(
      'does not match the request',
    );
    await expect(
      port.sendPayouts([fx.payoutRequest, { ...fx.payoutRequest, claimId: 'clm-0002' }], 'b-1'),
    ).rejects.toThrow('payouts[i] must answer requests[i]');
    await expect(port.getPayoutStatus('batch-requested')).rejects.toThrow('different batch');
    await expect(port.getBalance()).rejects.toThrow('PaymentsPort.getBalance result');
  });
});

describe('guardEvidenceSourcePort', () => {
  it('passes independent evidence through', async () => {
    const port = guardEvidenceSourcePort({
      corroborate: () => Promise.resolve([fx.roadClosureReport]),
    });

    await expect(port.corroborate(fx.claim)).resolves.toEqual([fx.roadClosureReport]);
  });

  it('rejects member-submitted evidence', async () => {
    const port = guardEvidenceSourcePort({
      corroborate: () => Promise.resolve([fx.photo] as never),
    } satisfies EvidenceSourcePort);

    await expect(port.corroborate(fx.claim)).rejects.toThrow(ContractViolationError);
  });

  it('rejects evidence ids that collide with the claim', async () => {
    const port = guardEvidenceSourcePort({
      corroborate: () => Promise.resolve([{ ...fx.roadClosureReport, id: fx.photo.id }]),
    });

    await expect(port.corroborate(fx.claim)).rejects.toThrow('must not reuse the claim evidence');
  });
});

describe('guardReasonerPort', () => {
  function reasonerReturning(result: unknown): ReasonerPort {
    return { assess: () => Promise.resolve(result as never) };
  }

  it('passes a valid assessment through', async () => {
    const port = guardReasonerPort(reasonerReturning(fx.assessment));

    await expect(port.assess(fx.assessRequest)).resolves.toEqual(fx.assessment);
  });

  it('rejects an inconsistent request', async () => {
    const assess = vi.fn<ReasonerPort['assess']>();
    const port = guardReasonerPort({ assess });

    await expect(
      port.assess({ ...fx.assessRequest, lossEstimate: { ...fx.lossEstimate, claimId: 'clm-9' } }),
    ).rejects.toThrow('ReasonerPort.assess request');
    expect(assess).not.toHaveBeenCalled();
  });

  it('rejects malformed reasoner output', async () => {
    const port = guardReasonerPort(reasonerReturning({ ...fx.assessment, confidence: 1.4 }));

    await expect(port.assess(fx.assessRequest)).rejects.toThrow('ReasonerPort.assess result');
  });

  it('rejects an assessment of another claim', async () => {
    const port = guardReasonerPort(reasonerReturning({ ...fx.assessment, claimId: 'clm-0002' }));

    await expect(port.assess(fx.assessRequest)).rejects.toThrow('Assessed a different claim');
  });

  it('rejects an assessment that cites unknown evidence', async () => {
    const port = guardReasonerPort(
      reasonerReturning({ ...fx.assessment, evidenceUsed: [fx.photo.id, 'ev-invented'] }),
    );

    await expect(port.assess(fx.assessRequest)).rejects.toThrow('ev-invented');
  });
});
