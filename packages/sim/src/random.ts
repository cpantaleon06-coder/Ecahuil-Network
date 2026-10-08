/** A source of pseudo-random numbers in [0, 1). */
export type Random = () => number;

/**
 * Mulberry32: a small, fast, seeded 32-bit PRNG. The same seed always yields the same sequence,
 * which keeps simulations reproducible. Not suitable for anything security related.
 */
export function mulberry32(seed: number): Random {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError(`Seed must be a safe integer, got ${seed}`);
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Integer in [min, max], both inclusive. */
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** One element of a non-empty array. */
export function pick<T>(random: Random, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new RangeError('Cannot pick from an empty array');
  }
  return item;
}

/** Shuffles a copy of `items` (Fisher-Yates). */
export function shuffle<T>(random: Random, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
  }
  return copy;
}
