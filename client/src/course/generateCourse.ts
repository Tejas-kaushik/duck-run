// Shared seeded runner generator. Extend this implementation when adding course chunks.

import { CONFIG } from '../core/config';
import type { SeededRandom } from '../core/seededRandom';
import type { Chunk, Course, CourseItem, Lane } from './types';

/** Empty water at the start (time to settle in) and at the end (room for the heart and transitions). */
const RUNWAY = 40;
const END_CLEAR = 30;

/**
 * Every chunk keeps its first branch row at >= 10 and its last row <= length - 10, so rows from
 * neighbouring chunks are always at least 20 units apart.
 */
export const STARTER_CHUNKS: readonly Chunk[] = [
  {
    name: 'breather',
    length: 30,
    items: [
      { at: 10, lanes: [1], kind: 'crumb' },
      { at: 15, lanes: [1], kind: 'crumb' },
      { at: 20, lanes: [1], kind: 'crumb' },
    ],
  },
  {
    name: 'left-then-right',
    length: 45,
    items: [
      { at: 10, lanes: [0], kind: 'branch' },
      { at: 30, lanes: [2], kind: 'branch' },
      { at: 10, lanes: [2], kind: 'crumb' },
      { at: 30, lanes: [0], kind: 'crumb' },
    ],
  },
  {
    name: 'centre-gate',
    length: 35,
    items: [
      { at: 15, lanes: [0, 2], kind: 'branch' },
      { at: 11, lanes: [1], kind: 'crumb' },
      { at: 15, lanes: [1], kind: 'crumb' },
      { at: 19, lanes: [1], kind: 'crumb' },
    ],
  },
  {
    name: 'double-swap',
    length: 50,
    items: [
      { at: 12, lanes: [0, 1], kind: 'branch' },
      { at: 34, lanes: [1, 2], kind: 'branch' },
      { at: 12, lanes: [2], kind: 'crumb' },
      { at: 34, lanes: [0], kind: 'crumb' },
    ],
  },
  {
    name: 'zigzag',
    length: 62,
    items: [
      { at: 10, lanes: [0, 1], kind: 'branch' },
      { at: 30, lanes: [1, 2], kind: 'branch' },
      { at: 50, lanes: [0, 1], kind: 'branch' },
      { at: 20, lanes: [2], kind: 'crumb' },
      { at: 40, lanes: [0], kind: 'crumb' },
    ],
  },
  {
    name: 'slalom',
    length: 48,
    items: [
      { at: 10, lanes: [1], kind: 'branch' },
      { at: 28, lanes: [0, 2], kind: 'branch' },
      { at: 10, lanes: [0], kind: 'crumb' },
      { at: 28, lanes: [1], kind: 'crumb' },
    ],
  },
  {
    name: 'late-switch',
    length: 40,
    items: [
      { at: 10, lanes: [1, 2], kind: 'branch' },
      { at: 28, lanes: [0, 1], kind: 'branch' },
      { at: 19, lanes: [1], kind: 'crumb' },
    ],
  },
];

export interface StarterCourseOptions {
  length: number;
  crumbs: boolean;
  heart: boolean;
}

export function buildStarterCourse(rng: SeededRandom, options: StarterCourseOptions): Course {
  const items: CourseItem[] = [];
  const end = options.length - END_CLEAR;
  let bag: Chunk[] = [];
  let pos = RUNWAY;

  for (;;) {
    if (bag.length === 0) bag = rng.shuffle(STARTER_CHUNKS);
    const chunk = bag.pop()!;
    if (pos + chunk.length > end) break;
    for (const item of chunk.items) {
      if (item.kind === 'crumb' && !options.crumbs) continue;
      items.push({ distance: pos + item.at, lanes: item.lanes, kind: item.kind });
    }
    pos += chunk.length;
  }

  if (options.heart) {
    // One clearly visible heart in the empty water just before the boss (brief §4).
    items.push({ distance: options.length - 20, lanes: [rng.int(0, 2) as Lane], kind: 'heart' });
  }

  items.sort((a, b) => a.distance - b.distance);
  return { length: options.length, items };
}

export interface ReachabilityOptions {
  maxSpeed: number;
  laneChangeSec: number;
  /** Time a player needs to see a branch and press a key. */
  reactionSec: number;
}

export const DEFAULT_REACHABILITY: ReachabilityOptions = {
  maxSpeed: CONFIG.runner.runner2MaxSpeed, // the fastest stage (boosted Bill smashes branches instead)
  laneChangeSec: CONFIG.runner.laneChangeSec,
  reactionSec: 0.35,
};

/**
 * True if a player at full speed can always get through: no row blocks all three lanes, and
 * between rows there is time to reach an open lane (brief §9).
 */
export function isCourseBeatable(course: Course, opts: ReachabilityOptions = DEFAULT_REACHABILITY): boolean {
  const rows = new Map<number, Set<Lane>>();
  for (const item of course.items) {
    if (item.kind !== 'branch') continue;
    const row = rows.get(item.distance) ?? new Set<Lane>();
    item.lanes.forEach((l) => row.add(l));
    rows.set(item.distance, row);
  }

  let reachable = new Set<Lane>([0, 1, 2]);
  let lastDistance = 0;
  for (const distance of [...rows.keys()].sort((a, b) => a - b)) {
    const seconds = (distance - lastDistance) / opts.maxSpeed - opts.reactionSec;
    const moves = Math.max(0, Math.floor(seconds / opts.laneChangeSec));
    const expanded = new Set<Lane>();
    reachable.forEach((l) => {
      for (let to = Math.max(0, l - moves); to <= Math.min(2, l + moves); to++) expanded.add(to as Lane);
    });
    const blocked = rows.get(distance)!;
    reachable = new Set([...expanded].filter((l) => !blocked.has(l)));
    if (reachable.size === 0) return false;
    lastDistance = distance;
  }
  return true;
}
