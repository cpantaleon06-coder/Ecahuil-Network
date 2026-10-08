import { describe, expect, it } from 'vitest';
import { ManualClock, SIM_EPOCH_MS } from '../src/clock.js';
import { mulberry32, pick, randomInt, shuffle } from '../src/random.js';

function draws(seed: number, count: number): number[] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => random());
}

describe('mulberry32', () => {
  it('repeats the same sequence for the same seed', () => {
    expect(draws(42, 20)).toEqual(draws(42, 20));
  });

  it('yields a different sequence for a different seed', () => {
    expect(draws(42, 20)).not.toEqual(draws(43, 20));
  });

  it('stays within [0, 1)', () => {
    for (const value of draws(7, 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('rejects a seed that is not a safe integer', () => {
    expect(() => mulberry32(1.5)).toThrow(RangeError);
  });
});

describe('random helpers', () => {
  it('draws integers within inclusive bounds', () => {
    const random = mulberry32(3);
    const values = Array.from({ length: 2_000 }, () => randomInt(random, 2, 5));

    expect(new Set(values)).toEqual(new Set([2, 3, 4, 5]));
  });

  it('picks from the array and rejects an empty one', () => {
    const random = mulberry32(3);

    expect(['a', 'b', 'c']).toContain(pick(random, ['a', 'b', 'c']));
    expect(() => pick(random, [])).toThrow(RangeError);
  });

  it('shuffles a copy deterministically', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffle(mulberry32(9), items);

    expect(shuffled).toEqual(shuffle(mulberry32(9), items));
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('ManualClock', () => {
  it('starts at the simulation epoch and only moves when advanced', () => {
    const clock = new ManualClock();

    expect(clock.now()).toBe(SIM_EPOCH_MS);
    clock.advance(1_500);
    expect(clock.now()).toBe(SIM_EPOCH_MS + 1_500);
  });

  it('rejects negative or fractional advances', () => {
    const clock = new ManualClock(0);

    expect(() => clock.advance(-1)).toThrow(RangeError);
    expect(() => clock.advance(0.5)).toThrow(RangeError);
  });
});
