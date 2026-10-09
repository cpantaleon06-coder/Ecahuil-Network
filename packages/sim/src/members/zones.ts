import { ZoneSchema, type Zone } from '@ecahuil/contracts';

/**
 * Mexico City boroughs (alcaldías) used as demo zones. Mexico City has no daylight saving time
 * since 2022, so America/Mexico_City is UTC-06:00 all year.
 *
 * The centroid coordinates are approximate and for demo use only. The list and every zone in it
 * are frozen; copy them if you need to change anything.
 */
export const zones: ReadonlyArray<Zone> = freezeZones([
  {
    id: 'cdmx-cuauhtemoc',
    name: 'Cuauhtémoc',
    timezone: 'America/Mexico_City',
    centroid: { latitude: 19.433, longitude: -99.15 },
  },
  {
    id: 'cdmx-miguel-hidalgo',
    name: 'Miguel Hidalgo',
    timezone: 'America/Mexico_City',
    centroid: { latitude: 19.425, longitude: -99.2 },
  },
  {
    id: 'cdmx-benito-juarez',
    name: 'Benito Juárez',
    timezone: 'America/Mexico_City',
    centroid: { latitude: 19.372, longitude: -99.158 },
  },
  {
    id: 'cdmx-coyoacan',
    name: 'Coyoacán',
    timezone: 'America/Mexico_City',
    centroid: { latitude: 19.33, longitude: -99.16 },
  },
  {
    id: 'cdmx-iztapalapa',
    name: 'Iztapalapa',
    timezone: 'America/Mexico_City',
    centroid: { latitude: 19.355, longitude: -99.065 },
  },
  {
    id: 'cdmx-gustavo-a-madero',
    name: 'Gustavo A. Madero',
    timezone: 'America/Mexico_City',
    centroid: { latitude: 19.49, longitude: -99.11 },
  },
  {
    id: 'cdmx-azcapotzalco',
    name: 'Azcapotzalco',
    timezone: 'America/Mexico_City',
    centroid: { latitude: 19.485, longitude: -99.185 },
  },
  {
    id: 'cdmx-venustiano-carranza',
    name: 'Venustiano Carranza',
    timezone: 'America/Mexico_City',
    centroid: { latitude: 19.43, longitude: -99.1 },
  },
]);

function freezeZones(candidates: unknown[]): ReadonlyArray<Zone> {
  return Object.freeze(
    ZoneSchema.array()
      .parse(candidates)
      .map((zone) => Object.freeze({ ...zone, centroid: Object.freeze({ ...zone.centroid }) })),
  );
}
