// Valid, fully synthetic examples of every contract type. Tests derive invalid variants from them.
import type {
  Appeal,
  AssessRequest,
  Assessment,
  Balance,
  Claim,
  CollectContributionRequest,
  Contribution,
  Coverage,
  Decision,
  Evidence,
  FundState,
  IndependentEvidence,
  LedgerEntry,
  LossEstimate,
  Member,
  Payout,
  PayoutBatch,
  PayoutRequest,
  SendPayoutsRequest,
  Verification,
} from '../src/index.js';

export const member: Member = {
  id: 'mem-0001',
  displayName: 'Synthetic Vendor 01',
  occupation: 'street_vendor',
  zoneId: 'zone-centro',
  paypalEmail: 'vendor.0001@example.com',
  joinedAt: '2026-03-02T09:00:00-06:00',
  contributionCentsPerWeek: 300,
  baselineDailyIncomeCents: 3_500,
  workSchedule: { days: [1, 2, 3, 4, 5, 6], startHour: 7, endHour: 16 },
  declaredWorkSites: [{ label: 'Market stall 14', latitude: 19.4326, longitude: -99.1332 }],
};

export const coverage: Coverage = {
  id: 'cov-street-vendor-road-closure-v1',
  version: 1,
  occupation: 'street_vendor',
  cause: 'road_closure',
  requiredEvidenceKinds: ['member_statement', 'road_closure_report'],
  maxDailyPayoutCents: 4_000,
  waitingPeriodDays: 14,
  effectiveFrom: '2026-01-01',
};

export const memberStatement: Evidence = {
  id: 'ev-0001',
  kind: 'member_statement',
  summary: 'The avenue in front of the market was closed all morning, so no customers came.',
  source: { type: 'member_submitted', name: 'Member app' },
  capturedAt: '2026-09-14T16:20:00-06:00',
  attributes: {},
};

export const photo: Evidence = {
  id: 'ev-0002',
  kind: 'photo',
  summary: 'Photo of barriers across the avenue next to the stall.',
  source: { type: 'member_submitted', name: 'Member app' },
  capturedAt: '2026-09-14T08:05:00-06:00',
  location: { latitude: 19.4327, longitude: -99.1331, label: 'Market entrance' },
  attributes: { fileName: 'barriers.jpg' },
};

export const roadClosureReport: IndependentEvidence = {
  id: 'ev-0003',
  kind: 'road_closure_report',
  summary: 'Traffic feed reports a full closure of the avenue from 06:45 to 15:30.',
  source: {
    type: 'independent_source',
    name: 'Synthetic city traffic feed',
    url: 'https://traffic.example.org/closures/RC-118',
  },
  capturedAt: '2026-09-14T06:50:00-06:00',
  location: { latitude: 19.4325, longitude: -99.1335 },
  attributes: { closureId: 'RC-118', durationMinutes: 525 },
};

export const claim: Claim = {
  id: 'clm-0001',
  memberId: member.id,
  coverageId: coverage.id,
  cause: 'road_closure',
  lossDate: '2026-09-14',
  submittedAt: '2026-09-14T16:25:00-06:00',
  description: 'A road closure kept customers away from my stall for most of the day.',
  evidence: [memberStatement, photo],
  status: 'submitted',
};

export const verification: Verification = {
  claimId: claim.id,
  checks: [
    {
      name: 'loss_date_is_scheduled_workday',
      result: 'pass',
      detail: 'Monday is a scheduled working day.',
    },
    {
      name: 'closure_overlaps_work_site',
      result: 'pass',
      detail: 'The reported closure is 40 m from the declared stall.',
    },
  ],
  independentCorroboration: true,
  fraudSignals: [],
};

export const lossEstimate: LossEstimate = {
  claimId: claim.id,
  baselineIncomeCents: 3_500,
  actualIncomeCents: 500,
  estimatedLossCents: 3_000,
};

export const assessment: Assessment = {
  claimId: claim.id,
  confidence: 0.86,
  band: 'high',
  recommendedPayoutCents: 3_000,
  rationale: 'Your photo and an independent traffic report both show the avenue was closed.',
  evidenceUsed: [memberStatement.id, photo.id],
  openQuestions: [],
};

export const decision: Decision = {
  claimId: claim.id,
  memberId: member.id,
  outcome: 'pay_full',
  payAmountCents: 3_000,
  confidence: 0.86,
  band: 'high',
  rationale: 'High confidence and an amount below the coverage limit: paid in full.',
  authorizedBy: 'rule',
  withinErrorBudget: true,
  auditRequired: false,
};

export const payout: Payout = {
  id: 'po-0001',
  claimId: claim.id,
  memberId: member.id,
  amountCents: 3_000,
  status: 'success',
  providerBatchId: 'BATCH-0001',
  providerItemId: 'ITEM-0001',
  createdAt: '2026-09-15T10:00:00Z',
};

export const contribution: Contribution = {
  id: 'ctb-0001',
  memberId: member.id,
  amountCents: 300,
  createdAt: '2026-09-07T12:00:00Z',
  status: 'success',
};

export const ledgerEntry: LedgerEntry = {
  id: 'led-0001',
  at: '2026-09-15T10:00:00Z',
  kind: 'payout',
  amountCents: 3_000,
  pseudonym: 'vendor-7f3a',
  claimId: claim.id,
  note: 'Road closure on 2026-09-14',
};

export const appeal: Appeal = {
  id: 'apl-0001',
  claimId: claim.id,
  reason: 'The payout did not include the afternoon I also lost.',
  status: 'open',
  reviewedBy: 'member_panel',
};

export const fundState: FundState = {
  memberCount: 120,
  liquidReserveCents: 450_000,
  yieldReserveCents: 200_000,
  firstLossCapitalCents: 100_000,
  errorBudgetTotalCents: 20_000,
  errorBudgetRemainingCents: 17_500,
  solvencyRatio: 1.32,
  pendingExitsCents: 0,
};

export const collectContributionRequest: CollectContributionRequest = {
  memberId: member.id,
  amountCents: 300,
  idempotencyKey: 'contribution-2026-w37-mem-0001',
};

export const payoutRequest: PayoutRequest = {
  claimId: claim.id,
  memberId: member.id,
  receiverEmail: member.paypalEmail,
  amountCents: 3_000,
};

export const sendPayoutsRequest: SendPayoutsRequest = {
  requests: [payoutRequest],
  idempotencyKey: 'payouts-2026-09-15-batch-1',
};

export const payoutBatch: PayoutBatch = {
  batchId: 'BATCH-0001',
  payouts: [payout],
};

export const balance: Balance = {
  availableCents: 450_000,
  asOf: '2026-09-15T10:00:00Z',
};

export const assessRequest: AssessRequest = {
  member,
  coverage,
  claim,
  verification,
  lossEstimate,
};
