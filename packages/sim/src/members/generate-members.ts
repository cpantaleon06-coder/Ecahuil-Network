import {
  MemberSchema,
  OccupationSchema,
  type Member,
  type Occupation,
  type WorkSite,
  type Zone,
} from '@ecahuil/contracts';
import { mulberry32, pick, randomInt, shuffle, type Random } from '../random.js';
import { zones } from './zones.js';

export interface GenerateMembersOptions {
  /** How many members to generate. Default: 100. */
  count?: number;
  /** PRNG seed. The same seed always yields the same members. */
  seed: number;
  /** Payout emails for the first members, in order (for example sandbox accounts). */
  paypalEmails?: readonly string[];
}

interface OccupationProfile {
  /** Prefix of the synthetic display name. */
  title: string;
  /** Relative share of members with this occupation. */
  weight: number;
  /** Range of the placeholder daily income distribution, in USD cents. */
  dailyIncomeCents: { min: number; max: number };
  /** Candidate working days (0 = Sunday). */
  workDays: readonly (readonly number[])[];
  /** Candidate shifts in local time; `endHour` lower than `startHour` crosses midnight. */
  shifts: readonly { startHour: number; endHour: number }[];
  siteLabels: readonly string[];
  maxSites: number;
}

const MONDAY_TO_FRIDAY = [1, 2, 3, 4, 5];
const MONDAY_TO_SATURDAY = [1, 2, 3, 4, 5, 6];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

// SYNTHETIC PLACEHOLDERS: the income ranges and shares below are rough guesses, not data. Calibrate
// them against real income surveys before drawing any conclusion from simulations.
const PROFILES: Record<Occupation, OccupationProfile> = {
  delivery_courier: {
    title: 'Courier',
    weight: 35,
    dailyIncomeCents: { min: 1_800, max: 4_500 },
    workDays: [MONDAY_TO_SATURDAY, EVERY_DAY, [0, 1, 2, 3, 4, 5], [0, 2, 3, 4, 5, 6]],
    shifts: [
      { startHour: 9, endHour: 18 },
      { startHour: 11, endHour: 22 },
      { startHour: 12, endHour: 23 },
      { startHour: 17, endHour: 1 },
    ],
    siteLabels: ['Restaurant pickup area', 'Delivery app hub', 'Shopping mall pickup point'],
    maxSites: 2,
  },
  construction_worker: {
    title: 'Builder',
    weight: 25,
    dailyIncomeCents: { min: 2_000, max: 4_000 },
    workDays: [MONDAY_TO_FRIDAY, MONDAY_TO_SATURDAY],
    shifts: [
      { startHour: 7, endHour: 17 },
      { startHour: 8, endHour: 18 },
      { startHour: 7, endHour: 15 },
    ],
    siteLabels: ['Residential construction site', 'Road works site', 'Commercial building site'],
    maxSites: 1,
  },
  street_vendor: {
    title: 'Vendor',
    weight: 30,
    dailyIncomeCents: { min: 1_200, max: 5_000 },
    workDays: [EVERY_DAY, MONDAY_TO_SATURDAY, [0, 2, 3, 4, 5, 6], [0, 3, 5, 6]],
    shifts: [
      { startHour: 6, endHour: 15 },
      { startHour: 8, endHour: 18 },
      { startHour: 9, endHour: 20 },
      { startHour: 18, endHour: 24 },
      { startHour: 19, endHour: 2 },
    ],
    siteLabels: ['Open-air market stall', 'Street food stand', 'Corner stall'],
    maxSites: 1,
  },
  other: {
    title: 'Worker',
    weight: 10,
    dailyIncomeCents: { min: 1_500, max: 3_500 },
    workDays: [MONDAY_TO_FRIDAY, MONDAY_TO_SATURDAY, [0, 4, 5, 6]],
    shifts: [
      { startHour: 9, endHour: 18 },
      { startHour: 8, endHour: 16 },
      { startHour: 14, endHour: 22 },
    ],
    siteLabels: ['Car wash', 'Repair workshop', 'Household where the member works'],
    maxSites: 1,
  },
};

// SYNTHETIC PLACEHOLDER: weekly contribution as a share of expected weekly income.
const CONTRIBUTION_RATE = 0.02;
const MIN_CONTRIBUTION_CENTS = 100;

/** Work sites are scattered up to about 1.6 km (0.015 degrees) around the zone centroid. */
const WORK_SITE_SPREAD_DEGREES = 0.015;

/** Members joined between 2025-10-01 and 2026-09-30, in Mexico City local time (UTC-06:00). */
const JOIN_WINDOW_START_LOCAL_MS = Date.UTC(2025, 9, 1);
const JOIN_WINDOW_DAYS = 365;
const MEXICO_CITY_OFFSET = '-06:00';

/**
 * Generates synthetic members spread over the demo zones. Deterministic for a given seed. Every
 * occupation and zone appears once `count` is at least the number of occupations or zones.
 * Each member is validated against MemberSchema.
 */
export function generateMembers({
  count = 100,
  seed,
  paypalEmails = [],
}: GenerateMembersOptions): Member[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(`count must be a non-negative integer, got ${count}`);
  }
  const random = mulberry32(seed);
  const occupations = spread(random, count, OccupationSchema.options, (o) => PROFILES[o].weight);
  const memberZones = spread(random, count, zones, () => 1);

  return occupations.map((occupation, index) => {
    const zone = memberZones[index];
    if (zone === undefined) {
      throw new Error(`No zone assigned to member ${index + 1}`);
    }
    const profile = PROFILES[occupation];
    const number = String(index + 1).padStart(3, '0');
    const days = [...pick(random, profile.workDays)];
    const shift = pick(random, profile.shifts);
    const baselineDailyIncomeCents = placeholderDailyIncome(random, profile);
    const siteCount = randomInt(random, 1, profile.maxSites);
    const siteLabels = shuffle(random, profile.siteLabels).slice(0, siteCount);

    return MemberSchema.parse({
      id: `member-${number}`,
      displayName: `${profile.title} ${number}`,
      occupation,
      zoneId: zone.id,
      paypalEmail: paypalEmails[index] ?? `member-${number}@example.invalid`,
      joinedAt: randomJoinedAt(random),
      contributionCentsPerWeek: weeklyContribution(baselineDailyIncomeCents, days.length),
      baselineDailyIncomeCents,
      workSchedule: { days, ...shift },
      declaredWorkSites: siteLabels.map((label) => workSiteNear(random, zone, label)),
    });
  });
}

/**
 * Assigns a category to each of `count` members: one of each category first, so every category
 * appears when `count` allows it, the rest by weight, then shuffled.
 */
function spread<T>(
  random: Random,
  count: number,
  categories: readonly T[],
  weightOf: (category: T) => number,
): T[] {
  const guaranteed = categories.slice(0, Math.min(count, categories.length));
  const totalWeight = categories.reduce((sum, category) => sum + weightOf(category), 0);
  const weighted = Array.from({ length: count - guaranteed.length }, () => {
    let remaining = random() * totalWeight;
    for (const category of categories) {
      remaining -= weightOf(category);
      if (remaining < 0) {
        return category;
      }
    }
    return pick(random, categories);
  });
  return shuffle(random, [...guaranteed, ...weighted]);
}

/** Triangular distribution over the profile's range, rounded to 50 cents. Synthetic placeholder. */
function placeholderDailyIncome(random: Random, profile: OccupationProfile): number {
  const { min, max } = profile.dailyIncomeCents;
  const cents = min + ((random() + random()) / 2) * (max - min);
  return Math.round(cents / 50) * 50;
}

/** A share of expected weekly income, rounded to 25 cents, with a floor. */
function weeklyContribution(baselineDailyIncomeCents: number, workDaysPerWeek: number): number {
  const cents = baselineDailyIncomeCents * workDaysPerWeek * CONTRIBUTION_RATE;
  return Math.max(MIN_CONTRIBUTION_CENTS, Math.round(cents / 25) * 25);
}

function workSiteNear(random: Random, zone: Zone, label: string): WorkSite {
  const jitter = () => (random() * 2 - 1) * WORK_SITE_SPREAD_DEGREES;
  return {
    label,
    latitude: roundCoordinate(zone.centroid.latitude + jitter()),
    longitude: roundCoordinate(zone.centroid.longitude + jitter()),
  };
}

function roundCoordinate(degrees: number): number {
  return Math.round(degrees * 100_000) / 100_000;
}

/** A local daytime moment inside the join window, as an ISO 8601 string with offset. */
function randomJoinedAt(random: Random): string {
  const day = randomInt(random, 0, JOIN_WINDOW_DAYS - 1);
  const hour = randomInt(random, 7, 21);
  const minute = randomInt(random, 0, 59);
  const localMs = JOIN_WINDOW_START_LOCAL_MS + ((day * 24 + hour) * 60 + minute) * 60_000;
  return `${new Date(localMs).toISOString().slice(0, 19)}${MEXICO_CITY_OFFSET}`;
}
