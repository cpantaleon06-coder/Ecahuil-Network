import { describe, expect, it } from 'vitest';
import { MemberSchema, OccupationSchema } from '@ecahuil/contracts';
import { generateMembers } from '../src/members/generate-members.js';
import { zones } from '../src/members/zones.js';

describe('generateMembers', () => {
  it('generates identical members for the same seed', () => {
    const first = generateMembers({ seed: 42 });
    const second = generateMembers({ seed: 42 });

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('generates different members for a different seed', () => {
    expect(generateMembers({ seed: 43 })).not.toEqual(generateMembers({ seed: 42 }));
  });

  it('generates the requested number of members, 100 by default', () => {
    expect(generateMembers({ seed: 1 })).toHaveLength(100);
    expect(generateMembers({ seed: 1, count: 7 })).toHaveLength(7);
    expect(generateMembers({ seed: 1, count: 250 })).toHaveLength(250);
    expect(generateMembers({ seed: 1, count: 0 })).toEqual([]);
  });

  it('rejects an invalid count', () => {
    expect(() => generateMembers({ seed: 1, count: -1 })).toThrow(RangeError);
    expect(() => generateMembers({ seed: 1, count: 2.5 })).toThrow(RangeError);
  });

  it('only generates schema-valid members with unique ids', () => {
    const members = generateMembers({ seed: 42, count: 300 });

    for (const member of members) {
      expect(MemberSchema.safeParse(member).error).toBeUndefined();
    }
    expect(new Set(members.map((member) => member.id)).size).toBe(members.length);
  });

  it('represents every zone and every occupation', () => {
    const members = generateMembers({ seed: 42 });

    expect(new Set(members.map((member) => member.zoneId))).toEqual(
      new Set(zones.map((zone) => zone.id)),
    );
    expect(new Set(members.map((member) => member.occupation))).toEqual(
      new Set(OccupationSchema.options),
    );
  });

  it('still represents every zone and occupation at the smallest count that allows it', () => {
    const zoneIds = generateMembers({ seed: 9, count: zones.length }).map((m) => m.zoneId);
    const occupations = generateMembers({ seed: 9, count: OccupationSchema.options.length }).map(
      (member) => member.occupation,
    );

    expect(new Set(zoneIds).size).toBe(zones.length);
    expect(new Set(occupations).size).toBe(OccupationSchema.options.length);
  });

  it('declares work sites near the member zone centroid', () => {
    for (const member of generateMembers({ seed: 42 })) {
      const zone = zones.find((candidate) => candidate.id === member.zoneId);
      expect(zone).toBeDefined();
      expect(member.declaredWorkSites.length).toBeGreaterThan(0);
      for (const site of member.declaredWorkSites) {
        expect(Math.abs(site.latitude - (zone?.centroid.latitude ?? 0))).toBeLessThanOrEqual(0.02);
        expect(Math.abs(site.longitude - (zone?.centroid.longitude ?? 0))).toBeLessThanOrEqual(
          0.02,
        );
      }
    }
  });

  it('keeps contributions a small share of expected weekly income', () => {
    for (const member of generateMembers({ seed: 42 })) {
      const weeklyIncome = member.baselineDailyIncomeCents * member.workSchedule.days.length;
      expect(member.contributionCentsPerWeek).toBeGreaterThanOrEqual(100);
      expect(member.contributionCentsPerWeek).toBeLessThanOrEqual(weeklyIncome * 0.05);
    }
  });

  it('uses Mexico City local time for joinedAt', () => {
    for (const member of generateMembers({ seed: 42 })) {
      expect(member.joinedAt).toMatch(/^202[56]-\d{2}-\d{2}T\d{2}:\d{2}:00-06:00$/);
    }
  });

  it('assigns the given emails to the first members and placeholders to the rest', () => {
    const members = generateMembers({
      seed: 42,
      count: 5,
      paypalEmails: ['sandbox-a@example.com', 'sandbox-b@example.com'],
    });

    expect(members.map((member) => member.paypalEmail)).toEqual([
      'sandbox-a@example.com',
      'sandbox-b@example.com',
      'member-003@example.invalid',
      'member-004@example.invalid',
      'member-005@example.invalid',
    ]);
  });

  it('ignores extra emails and rejects invalid ones', () => {
    const emails = ['a@example.com', 'b@example.com', 'c@example.com'];

    expect(generateMembers({ seed: 1, count: 2, paypalEmails: emails })).toHaveLength(2);
    expect(() => generateMembers({ seed: 1, count: 1, paypalEmails: ['not-an-email'] })).toThrow();
  });

  it('does not change other fields when emails are given', () => {
    const withoutEmails = generateMembers({ seed: 42, count: 10 });
    const withEmails = generateMembers({
      seed: 42,
      count: 10,
      paypalEmails: ['sandbox-a@example.com'],
    });

    expect(withEmails.map(({ paypalEmail: _, ...rest }) => rest)).toEqual(
      withoutEmails.map(({ paypalEmail: _, ...rest }) => rest),
    );
  });
});
