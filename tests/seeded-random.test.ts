import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../src/utils/random';

describe('createSeededRandom', () => {
  it('replays the same sequence for the same seed', () => {
    const first = createSeededRandom(12345);
    const second = createSeededRandom(12345);
    const takeTen = (source: () => number) => Array.from({ length: 10 }, () => source());

    expect(takeTen(first)).toEqual(takeTen(second));
  });

  it('gives different sequences for different seeds', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);

    expect(Array.from({ length: 5 }, () => a())).not.toEqual(Array.from({ length: 5 }, () => b()));
  });

  it('stays inside [0, 1)', () => {
    const random = createSeededRandom(98765);

    for (let i = 0; i < 500; i += 1) {
      const value = random();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('does not get stuck on one value', () => {
    const random = createSeededRandom(0);
    const values = new Set(Array.from({ length: 50 }, () => random()));

    expect(values.size).toBeGreaterThan(40);
  });
});
