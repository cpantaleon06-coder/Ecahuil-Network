import { describe, expect, it } from 'vitest';
import { ZoneSchema, type Zone } from '@ecahuil/contracts';
import { zones } from '../src/members/zones.js';

describe('zones', () => {
  it('lists 6 to 8 schema-valid zones', () => {
    expect(zones.length).toBeGreaterThanOrEqual(6);
    expect(zones.length).toBeLessThanOrEqual(8);
    for (const zone of zones) {
      expect(ZoneSchema.safeParse(zone).error).toBeUndefined();
    }
  });

  it('uses unique ids and names', () => {
    expect(new Set(zones.map((zone) => zone.id)).size).toBe(zones.length);
    expect(new Set(zones.map((zone) => zone.name)).size).toBe(zones.length);
  });

  it('is frozen, list and zones alike', () => {
    expect(Object.isFrozen(zones)).toBe(true);
    for (const zone of zones) {
      expect(Object.isFrozen(zone)).toBe(true);
      expect(Object.isFrozen(zone.centroid)).toBe(true);
    }
    const first = zones[0] as Zone;
    expect(() => {
      (zones as Zone[]).push(first);
    }).toThrow(TypeError);
    expect(() => {
      first.name = 'Renamed';
    }).toThrow(TypeError);
    expect(() => {
      first.centroid.latitude = 0;
    }).toThrow(TypeError);
  });

  it('places every zone in Mexico City', () => {
    for (const zone of zones) {
      expect(zone.timezone).toBe('America/Mexico_City');
      expect(zone.centroid.latitude).toBeGreaterThan(19.0);
      expect(zone.centroid.latitude).toBeLessThan(19.6);
      expect(zone.centroid.longitude).toBeGreaterThan(-99.4);
      expect(zone.centroid.longitude).toBeLessThan(-98.9);
    }
  });
});
