import { describe, expect, it } from 'vitest';
import { ZoneSchema } from '@ecahuil/contracts';
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
