import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createRandom, deriveSeed } from '../src/core/seededRandom';
import type { Course } from '../src/course/types';
import { STARTER_CHUNKS, buildStarterCourse, isCourseBeatable } from '../src/course/generateCourse';

const runner1 = (seed: number) =>
  buildStarterCourse(createRandom(deriveSeed(seed, 'runner1')), {
    length: CONFIG.runner.runner1Distance,
    crumbs: false,
    heart: false,
  });
const runner2 = (seed: number) =>
  buildStarterCourse(createRandom(deriveSeed(seed, 'runner2')), {
    length: CONFIG.runner.runner2Distance,
    crumbs: true,
    heart: true,
  });

describe('starter course (brief §4, §9)', () => {
  it('gives the same course for the same seed', () => {
    expect(runner1(7)).toEqual(runner1(7));
    expect(runner2(7)).toEqual(runner2(7));
  });

  it('gives different courses for different seeds', () => {
    expect(runner1(7)).not.toEqual(runner1(8));
  });

  it('is beatable at full speed for 1,000 seeds', () => {
    for (let seed = 0; seed < 1000; seed++) {
      expect(isCourseBeatable(runner1(seed)), `runner1 seed ${seed}`).toBe(true);
      expect(isCourseBeatable(runner2(seed)), `runner2 seed ${seed}`).toBe(true);
    }
  });

  it('never blocks all three lanes in any chunk', () => {
    for (const chunk of STARTER_CHUNKS) {
      const rows = new Map<number, Set<number>>();
      for (const item of chunk.items) {
        if (item.kind !== 'branch') continue;
        const row = rows.get(item.at) ?? new Set<number>();
        item.lanes.forEach((l) => row.add(l));
        rows.set(item.at, row);
      }
      rows.forEach((row) => expect(row.size, chunk.name).toBeLessThan(3));
    }
  });

  it('keeps items inside the section, with empty water at both ends', () => {
    const course = runner1(3);
    expect(course.items.length).toBeGreaterThan(0);
    expect(course.items[0].distance).toBeGreaterThanOrEqual(40);
    expect(course.items[course.items.length - 1].distance).toBeLessThanOrEqual(course.length - 20);
  });

  it('has breadcrumbs and exactly one heart only in Runner 2', () => {
    const one = runner1(5);
    const two = runner2(5);
    expect(one.items.some((i) => i.kind !== 'branch')).toBe(false);
    expect(two.items.filter((i) => i.kind === 'heart')).toHaveLength(1);
    expect(two.items.some((i) => i.kind === 'crumb')).toBe(true);
  });

  it('rejects a course with an impossible switch', () => {
    const impossible: Course = {
      length: 200,
      items: [
        { distance: 100, lanes: [1, 2], kind: 'branch' }, // only lane 0 open
        { distance: 104, lanes: [0, 1], kind: 'branch' }, // only lane 2 open, 4 units later
      ],
    };
    expect(isCourseBeatable(impossible)).toBe(false);
    expect(isCourseBeatable({ length: 200, items: [{ distance: 100, lanes: [0, 1, 2], kind: 'branch' }] })).toBe(false);
  });
});
