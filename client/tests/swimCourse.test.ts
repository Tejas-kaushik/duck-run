import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createRandom, deriveSeed } from '../src/core/seededRandom';
import { buildSwimCourse, coinsAvoidCreatures, swimCourseHasPath, trailIsFollowable } from '../src/phases/underwater/swimCourse';

const swim = (seed: number) => buildSwimCourse(createRandom(deriveSeed(seed, 'underwater')), CONFIG.swim.distance);

describe('swim course (DESIGN_CHANGES.md)', () => {
  it('is the same for everyone in a room (same seed)', () => {
    expect(swim(3)).toEqual(swim(3));
    expect(swim(3)).not.toEqual(swim(4));
  });

  it('always leaves a way through, for 1,000 seeds', () => {
    for (let seed = 0; seed < 1000; seed++) expect(swimCourseHasPath(swim(seed)), `seed ${seed}`).toBe(true);
  });

  it('has just enough coins that the 100-coin laser needs a near-perfect swim', () => {
    for (let seed = 0; seed < 200; seed++) {
      const coins = swim(seed).items.filter((i) => i.kind === 'coin').length;
      expect(coins, `seed ${seed}`).toBeGreaterThanOrEqual(CONFIG.powerUps.laserCoins + 8);
      expect(coins, `seed ${seed}`).toBeLessThanOrEqual(140);
    }
  });

  it('keeps the coin trail followable: never more than one lane between coins', () => {
    for (let seed = 0; seed < 1000; seed++) expect(trailIsFollowable(swim(seed)), `seed ${seed}`).toBe(true);
  });

  it('is busy: creature rows come often', () => {
    const rows = new Set(swim(1).items.filter((i) => i.kind !== 'coin').map((i) => i.distance));
    expect(rows.size).toBeGreaterThanOrEqual(15);
  });

  it('never puts a coin on top of a creature, for 1,000 seeds', () => {
    for (let seed = 0; seed < 1000; seed++) expect(coinsAvoidCreatures(swim(seed)), `seed ${seed}`).toBe(true);
  });
});
