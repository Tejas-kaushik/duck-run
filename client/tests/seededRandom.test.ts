import { describe, expect, it } from 'vitest';
import { createRandom, deriveSeed } from '../src/core/seededRandom';

const take = (seed: number, n: number) => {
  const r = createRandom(seed);
  return Array.from({ length: n }, () => r.next());
};

describe('seededRandom', () => {
  it('gives the same numbers for the same seed', () => {
    expect(take(42, 50)).toEqual(take(42, 50));
  });

  it('gives different numbers for different seeds', () => {
    expect(take(42, 10)).not.toEqual(take(43, 10));
  });

  it('keeps floats in [0, 1) and ints inside their bounds', () => {
    const r = createRandom(7);
    for (let i = 0; i < 2000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(0, 2);
      expect([0, 1, 2]).toContain(n);
    }
  });

  it('shuffles deterministically without touching the input', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const a = createRandom(9).shuffle(items);
    const b = createRandom(9).shuffle(items);
    expect(a).toEqual(b);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...a].sort()).toEqual(items);
  });

  it('derives a separate, stable seed per section', () => {
    const runner = deriveSeed(123, 'runner1');
    expect(deriveSeed(123, 'runner1')).toBe(runner);
    expect(deriveSeed(123, 'boss')).not.toBe(runner);
    expect(deriveSeed(124, 'runner1')).not.toBe(runner);
  });
});
