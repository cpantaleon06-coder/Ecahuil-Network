import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index.js';
import * as fx from './fixtures.js';

type SchemaName = Extract<keyof typeof contracts, `${string}Schema`>;

interface SchemaCase {
  valid: unknown[];
  /** Label of what is wrong, mapped to the invalid value. */
  invalid: Record<string, unknown>;
}

function without(value: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([entryKey]) => entryKey !== key));
}

/** Every exported schema must appear here; the type makes a missing one a compile error. */
const cases: Record<SchemaName, SchemaCase> = {
  IdSchema: {
    valid: ['mem-0001', 'clm_2026.09:01', 'a'],
    invalid: {
      empty: '',
      whitespace: 'mem 0001',
      'leading dash': '-mem',
      'too long': 'a'.repeat(129),
      number: 1,
    },
  },
  ProviderRefSchema: {
    valid: ['5UXD2E8A7EBQJ', 'batch/2026#1'],
    invalid: { empty: '', whitespace: 'BATCH 1', 'too long': 'B'.repeat(129) },
  },
  CentsSchema: {
    valid: [0, 1, 3_000],
    invalid: { negative: -1, fraction: 10.5, 'unsafe integer': 2 ** 53, string: '100', NaN: NaN },
  },
  PositiveCentsSchema: {
    valid: [1, 450_000],
    invalid: { zero: 0, negative: -5, fraction: 0.5 },
  },
  IsoTimestampSchema: {
    valid: ['2026-10-07T14:30:00Z', '2026-10-07T09:30:00-05:00', '2026-10-07T09:30:00.123+01:00'],
    invalid: {
      'no offset': '2026-10-07T09:30:00',
      'date only': '2026-10-07',
      'not ISO': 'October 7, 2026',
      'epoch millis': 1_791_000_000_000,
    },
  },
  CalendarDateSchema: {
    valid: ['2026-09-14', '2028-02-29'],
    invalid: {
      'with time': '2026-09-14T00:00:00Z',
      'impossible date': '2026-02-30',
      'day first': '14-09-2026',
    },
  },
  GeoPointSchema: {
    valid: [
      { latitude: 0, longitude: 0 },
      { latitude: -90, longitude: 180 },
    ],
    invalid: {
      'latitude out of range': { latitude: 91, longitude: 0 },
      'longitude out of range': { latitude: 0, longitude: -181 },
      'missing longitude': { latitude: 10 },
    },
  },
  ConfidenceSchema: {
    valid: [0, 0.5, 1],
    invalid: { 'above 1': 1.01, negative: -0.1, percent: '85%' },
  },
  ConfidenceBandSchema: {
    valid: ['high', 'medium', 'low'],
    invalid: { unknown: 'very_high', uppercase: 'HIGH' },
  },

  TimeZoneSchema: {
    valid: ['America/Mexico_City', 'America/Argentina/Buenos_Aires', 'UTC', 'Etc/GMT+5'],
    invalid: {
      'offset with colon': '+05:00',
      'offset without colon': '-0300',
      'unknown zone': 'Mars/Olympus',
      'unknown city': 'America/Not_A_City',
      'leading space': ' America/Bogota',
      empty: '',
      number: -5,
    },
  },
  ZoneSchema: {
    valid: [fx.zone, { ...fx.zone, timezone: 'UTC', centroid: { latitude: -90, longitude: 180 } }],
    invalid: {
      'unknown timezone': { ...fx.zone, timezone: 'Mars/Olympus' },
      'offset timezone': { ...fx.zone, timezone: '-06:00' },
      'blank name': { ...fx.zone, name: ' ' },
      'latitude out of range': { ...fx.zone, centroid: { latitude: 90.5, longitude: 0 } },
      'longitude out of range': { ...fx.zone, centroid: { latitude: 0, longitude: -180.5 } },
      'missing centroid': without(fx.zone, 'centroid'),
      'invalid id': { ...fx.zone, id: 'zone centro' },
    },
  },

  OccupationSchema: {
    valid: ['delivery_courier', 'construction_worker', 'street_vendor', 'other'],
    invalid: { unknown: 'taxi_driver', empty: '' },
  },
  WorkScheduleSchema: {
    valid: [
      fx.member.workSchedule,
      { days: [0, 6], startHour: 22, endHour: 6 },
      { days: [3], startHour: 0, endHour: 24 },
    ],
    invalid: {
      'no days': { days: [], startHour: 8, endHour: 16 },
      'day out of range': { days: [7], startHour: 8, endHour: 16 },
      'repeated day': { days: [1, 1], startHour: 8, endHour: 16 },
      'start equals end': { days: [1], startHour: 8, endHour: 8 },
      'hour out of range': { days: [1], startHour: 8, endHour: 25 },
      'fractional hour': { days: [1], startHour: 8.5, endHour: 16 },
    },
  },
  WorkSiteSchema: {
    valid: fx.member.declaredWorkSites,
    invalid: {
      'blank label': { label: '  ', latitude: 0, longitude: 0 },
      'missing label': { latitude: 0, longitude: 0 },
    },
  },
  MemberSchema: {
    valid: [fx.member, { ...fx.member, declaredWorkSites: [], occupation: 'delivery_courier' }],
    invalid: {
      'invalid email': { ...fx.member, paypalEmail: 'not-an-email' },
      'joinedAt without offset': { ...fx.member, joinedAt: '2026-03-02T09:00:00' },
      'zero contribution': { ...fx.member, contributionCentsPerWeek: 0 },
      'fractional baseline': { ...fx.member, baselineDailyIncomeCents: 3_500.5 },
      'unknown occupation': { ...fx.member, occupation: 'pilot' },
      'missing zoneId': without(fx.member, 'zoneId'),
    },
  },

  CoverageCauseSchema: {
    valid: ['road_closure', 'severe_rain', 'extreme_heat', 'platform_outage', 'member_reported'],
    invalid: { unknown: 'earthquake' },
  },
  CoverageSchema: {
    valid: [fx.coverage],
    invalid: {
      'version zero': { ...fx.coverage, version: 0 },
      'no required evidence': { ...fx.coverage, requiredEvidenceKinds: [] },
      'repeated evidence kind': {
        ...fx.coverage,
        requiredEvidenceKinds: ['photo', 'photo'],
      },
      'negative waiting period': { ...fx.coverage, waitingPeriodDays: -1 },
      'effectiveFrom as timestamp': { ...fx.coverage, effectiveFrom: '2026-01-01T00:00:00Z' },
      'zero max payout': { ...fx.coverage, maxDailyPayoutCents: 0 },
    },
  },

  EvidenceKindSchema: {
    valid: [
      'weather_observation',
      'road_closure_report',
      'platform_activity_log',
      'work_order',
      'photo',
      'member_statement',
    ],
    invalid: { unknown: 'video' },
  },
  EvidenceSourceTypeSchema: {
    valid: ['member_submitted', 'independent_source'],
    invalid: { unknown: 'anonymous' },
  },
  EvidenceSourceSchema: {
    valid: [fx.memberStatement.source, fx.roadClosureReport.source],
    invalid: {
      'non-http url': { type: 'independent_source', name: 'Feed', url: 'javascript:alert(1)' },
      'blank name': { type: 'member_submitted', name: '' },
      'unknown type': { type: 'rumor', name: 'Neighbor' },
    },
  },
  EvidenceSchema: {
    valid: [fx.memberStatement, fx.photo, fx.roadClosureReport],
    invalid: {
      'unknown kind': { ...fx.photo, kind: 'video' },
      'capturedAt without offset': { ...fx.photo, capturedAt: '2026-09-14T08:05:00' },
      'boolean attribute': { ...fx.photo, attributes: { verified: true } },
      'location out of range': { ...fx.photo, location: { latitude: 100, longitude: 0 } },
      'missing attributes': without(fx.photo, 'attributes'),
      'blank summary': { ...fx.photo, summary: '' },
    },
  },

  ClaimStatusSchema: {
    valid: [
      'submitted',
      'under_review',
      'needs_more_evidence',
      'approved',
      'partially_approved',
      'denied',
      'paid',
      'appealed',
    ],
    invalid: { unknown: 'closed' },
  },
  ClaimSchema: {
    valid: [fx.claim, { ...fx.claim, status: 'paid' }],
    invalid: {
      'no evidence': { ...fx.claim, evidence: [] },
      'repeated evidence id': { ...fx.claim, evidence: [fx.photo, fx.photo] },
      'lossDate as timestamp': { ...fx.claim, lossDate: '2026-09-14T00:00:00Z' },
      'unknown cause': { ...fx.claim, cause: 'flood' },
      'invalid evidence item': { ...fx.claim, evidence: [{ ...fx.photo, kind: 'video' }] },
    },
  },

  CheckResultSchema: {
    valid: ['pass', 'fail', 'inconclusive'],
    invalid: { unknown: 'skipped' },
  },
  VerificationCheckSchema: {
    valid: fx.verification.checks,
    invalid: {
      'unknown result': { name: 'x', result: 'maybe', detail: 'y' },
      'blank detail': { name: 'x', result: 'pass', detail: ' ' },
    },
  },
  FraudSignalSchema: {
    valid: [{ code: 'duplicate_photo', detail: 'The photo was also attached to claim clm-0007.' }],
    invalid: {
      'code with spaces': { code: 'duplicate photo', detail: 'x' },
      'uppercase code': { code: 'DUPLICATE_PHOTO', detail: 'x' },
    },
  },
  VerificationSchema: {
    valid: [
      fx.verification,
      {
        ...fx.verification,
        fraudSignals: [{ code: 'late_filing', detail: 'Filed 9 days later.' }],
      },
    ],
    invalid: {
      'no checks': { ...fx.verification, checks: [] },
      'corroboration as string': { ...fx.verification, independentCorroboration: 'yes' },
    },
  },

  LossEstimateSchema: {
    valid: [fx.lossEstimate, { ...fx.lossEstimate, actualIncomeCents: 0, estimatedLossCents: 0 }],
    invalid: {
      'negative loss': { ...fx.lossEstimate, estimatedLossCents: -100 },
      'decimal dollars': { ...fx.lossEstimate, baselineIncomeCents: 35.0001 },
    },
  },

  AssessmentSchema: {
    valid: [fx.assessment, { ...fx.assessment, band: 'low', openQuestions: ['Which hours?'] }],
    invalid: {
      'confidence above 1': { ...fx.assessment, confidence: 1.2 },
      'unknown band': { ...fx.assessment, band: 'certain' },
      'blank rationale': { ...fx.assessment, rationale: '' },
      'negative payout': { ...fx.assessment, recommendedPayoutCents: -1 },
      'missing evidenceUsed': without(fx.assessment, 'evidenceUsed'),
    },
  },

  DecisionOutcomeSchema: {
    valid: ['pay_full', 'pay_partial_provisional', 'request_more_evidence', 'deny'],
    invalid: { unknown: 'pay_later' },
  },
  AuthorizerSchema: {
    valid: ['rule', 'fallback_rule'],
    invalid: { 'the reasoner itself': 'ai' },
  },
  DecisionSchema: {
    valid: [
      fx.decision,
      { ...fx.decision, outcome: 'pay_partial_provisional', payAmountCents: 1_500 },
      { ...fx.decision, outcome: 'deny', payAmountCents: 0, authorizedBy: 'fallback_rule' },
      { ...fx.decision, outcome: 'request_more_evidence', payAmountCents: 0 },
    ],
    invalid: {
      'deny with money': { ...fx.decision, outcome: 'deny', payAmountCents: 100 },
      'pay with zero': { ...fx.decision, outcome: 'pay_full', payAmountCents: 0 },
      'authorized by ai': { ...fx.decision, authorizedBy: 'ai' },
      'missing auditRequired': without(fx.decision, 'auditRequired'),
    },
  },

  PayoutStatusSchema: {
    valid: ['pending', 'success', 'failed', 'unclaimed', 'held'],
    invalid: { 'provider spelling': 'SUCCESS' },
  },
  PayoutSchema: {
    valid: [fx.payout, without(without(fx.payout, 'providerBatchId'), 'providerItemId')],
    invalid: {
      'zero amount': { ...fx.payout, amountCents: 0 },
      'decimal string amount': { ...fx.payout, amountCents: '30.00' },
      'unknown status': { ...fx.payout, status: 'returned' },
    },
  },

  ContributionStatusSchema: {
    valid: ['pending', 'success', 'failed'],
    invalid: { unknown: 'refunded' },
  },
  ContributionSchema: {
    valid: [fx.contribution, { ...fx.contribution, status: 'pending' }],
    invalid: {
      'negative amount': { ...fx.contribution, amountCents: -300 },
      'createdAt without offset': { ...fx.contribution, createdAt: '2026-09-07 12:00' },
    },
  },

  LedgerEntryKindSchema: {
    valid: ['contribution', 'payout', 'yield', 'adjustment'],
    invalid: { unknown: 'fee' },
  },
  LedgerEntryDirectionSchema: {
    valid: ['credit', 'debit'],
    invalid: { unknown: 'in', uppercase: 'CREDIT' },
  },
  LedgerEntrySchema: {
    valid: [
      fx.ledgerEntry,
      { ...fx.ledgerEntry, kind: 'yield', direction: 'credit', note: 'Simulated yield' },
      { ...fx.ledgerEntry, kind: 'adjustment', direction: 'credit' },
      { ...fx.ledgerEntry, kind: 'adjustment', direction: 'debit' },
      {
        ...without(fx.ledgerEntry, 'claimId'),
        kind: 'contribution',
        direction: 'credit',
        amountCents: 300,
        note: '',
      },
    ],
    invalid: {
      'negative amount': { ...fx.ledgerEntry, amountCents: -3_000 },
      'payout without claim': without(fx.ledgerEntry, 'claimId'),
      'payout as credit': { ...fx.ledgerEntry, direction: 'credit' },
      'contribution as debit': { ...fx.ledgerEntry, kind: 'contribution', direction: 'debit' },
      'yield as debit': { ...fx.ledgerEntry, kind: 'yield', direction: 'debit' },
      'unknown direction': { ...fx.ledgerEntry, kind: 'adjustment', direction: 'out' },
      'missing direction': without(fx.ledgerEntry, 'direction'),
      'blank pseudonym': { ...fx.ledgerEntry, pseudonym: '' },
      'note too long': { ...fx.ledgerEntry, note: 'x'.repeat(281) },
    },
  },

  AppealStatusSchema: {
    valid: ['open', 'upheld', 'overturned'],
    invalid: { unknown: 'closed' },
  },
  AppealReviewerSchema: {
    valid: ['rule', 'member_panel'],
    invalid: { unknown: 'reasoner' },
  },
  AppealSchema: {
    valid: [fx.appeal, { ...fx.appeal, status: 'overturned', reviewedBy: 'rule' }],
    invalid: {
      'blank reason': { ...fx.appeal, reason: '' },
      'unknown reviewer': { ...fx.appeal, reviewedBy: 'admin' },
    },
  },

  FundStateSchema: {
    valid: [fx.fundState, { ...fx.fundState, errorBudgetRemainingCents: 0 }],
    invalid: {
      'remaining above total': { ...fx.fundState, errorBudgetRemainingCents: 20_001 },
      'negative reserve': { ...fx.fundState, liquidReserveCents: -1 },
      'fractional member count': { ...fx.fundState, memberCount: 1.5 },
      'negative solvency': { ...fx.fundState, solvencyRatio: -0.1 },
    },
  },

  IdempotencyKeySchema: {
    valid: ['batch-2b6f0e1c-8a4f-4c55-9a52-1d2f3e4a5b6c', 'k'],
    invalid: { empty: '', 'too long': 'k'.repeat(65), whitespace: 'batch 1' },
  },
  CollectContributionRequestSchema: {
    valid: [fx.collectContributionRequest],
    invalid: {
      'zero amount': { ...fx.collectContributionRequest, amountCents: 0 },
      'missing key': without(fx.collectContributionRequest, 'idempotencyKey'),
    },
  },
  CollectContributionResultSchema: {
    valid: [{ contribution: fx.contribution }],
    invalid: {
      'bare contribution': fx.contribution,
      'invalid contribution': { contribution: { ...fx.contribution, status: 'done' } },
    },
  },
  PayoutRequestSchema: {
    valid: [fx.payoutRequest],
    invalid: {
      'invalid receiver': { ...fx.payoutRequest, receiverEmail: 'vendor' },
      'zero amount': { ...fx.payoutRequest, amountCents: 0 },
    },
  },
  SendPayoutsRequestSchema: {
    valid: [
      fx.sendPayoutsRequest,
      {
        ...fx.sendPayoutsRequest,
        requests: [fx.payoutRequest, { ...fx.payoutRequest, claimId: 'clm-0002' }],
      },
    ],
    invalid: {
      'no requests': { ...fx.sendPayoutsRequest, requests: [] },
      'invalid item': {
        ...fx.sendPayoutsRequest,
        requests: [{ ...fx.payoutRequest, amountCents: -1 }],
      },
      'missing key': without(fx.sendPayoutsRequest, 'idempotencyKey'),
      'positional array': [fx.payoutRequest],
    },
  },
  PayoutBatchSchema: {
    valid: [fx.payoutBatch],
    invalid: {
      'no payouts': { ...fx.payoutBatch, payouts: [] },
      'payout from another batch': {
        ...fx.payoutBatch,
        payouts: [{ ...fx.payout, providerBatchId: 'BATCH-0002' }],
      },
      'payout without batch id': {
        ...fx.payoutBatch,
        payouts: [without(fx.payout, 'providerBatchId')],
      },
    },
  },
  PayoutBatchLookupSchema: {
    valid: [fx.payoutBatch, null],
    invalid: { undefined: undefined, 'no payouts': { ...fx.payoutBatch, payouts: [] } },
  },
  BalanceSchema: {
    valid: [fx.balance, { ...fx.balance, availableCents: 0 }],
    invalid: {
      'negative balance': { ...fx.balance, availableCents: -1 },
      'decimal string': { ...fx.balance, availableCents: '4500.00' },
      'missing asOf': without(fx.balance, 'asOf'),
    },
  },

  IndependentEvidenceSchema: {
    valid: [fx.roadClosureReport],
    invalid: { 'member submitted': fx.photo },
  },
  CorroborationSchema: {
    valid: [[], [fx.roadClosureReport]],
    invalid: { 'member submitted item': [fx.memberStatement] },
  },

  AssessRequestSchema: {
    valid: [fx.assessRequest],
    invalid: {
      'claim of another member': { ...fx.assessRequest, member: { ...fx.member, id: 'mem-0002' } },
      'other coverage': { ...fx.assessRequest, coverage: { ...fx.coverage, id: 'cov-other' } },
      'verification of another claim': {
        ...fx.assessRequest,
        verification: { ...fx.verification, claimId: 'clm-0002' },
      },
      'loss estimate of another claim': {
        ...fx.assessRequest,
        lossEstimate: { ...fx.lossEstimate, claimId: 'clm-0002' },
      },
      'missing verification': without(fx.assessRequest, 'verification'),
    },
  },
};

describe('contract schemas', () => {
  it('has examples for every exported schema', () => {
    const exported = Object.keys(contracts).filter((name) => name.endsWith('Schema'));
    expect(Object.keys(cases).sort()).toEqual(exported.sort());
  });

  for (const [name, { valid, invalid }] of Object.entries(cases)) {
    const schema = contracts[name as SchemaName];

    describe(name, () => {
      it.each(valid.map((value, index) => [index + 1, value] as const))(
        'accepts valid example %i',
        (_index, value) => {
          expect(schema.safeParse(value).error).toBeUndefined();
        },
      );

      it.each(Object.entries(invalid))('rejects %s', (_label, value) => {
        expect(schema.safeParse(value).success).toBe(false);
      });
    });
  }
});
