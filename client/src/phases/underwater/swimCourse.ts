// The swim's course (Tejas): a continuous trail of coins that weaves between rows of jellyfish and
// pufferfish. Built from the room seed, so everyone in a room gets the same swim (brief §9).
//
// Hard on purpose: creature rows come often and usually block two lanes, the trail hops lanes every
// few coins, and some coins lead right up to a creature ("bait"), so grabbing them means dodging late.
// It only ever moves one lane at a time, so every coin is collectable with sharp play. About 120
// coins per swim: the 100-coin laser needs a near-perfect swim.

import type { SeededRandom } from '../../core/seededRandom';
import type { Lane } from '../../course/types';

export type SwimItemKind = 'coin' | 'jelly' | 'puffer';

export interface SwimItem {
  distance: number;
  lane: Lane;
  kind: SwimItemKind;
}

export interface SwimCourse {
  length: number;
  items: SwimItem[];
}

const RUNWAY = 16;
const END_CLEAR = 18;
const COIN_GAP = 1.95;
/** Creature rows: frequent. Still close to 0.7 s apart at full swim speed. */
const ROW_GAP: [number, number] = [10, 13];
const TWO_LANE_CHANCE = 0.7;
/** The trail hops to a neighbouring lane every few coins, even with no creature in the way. */
const HOP_EVERY: [number, number] = [3, 5];
/** Bait coins stay in a creature's lane until this close to it, then the trail ducks out. */
const BAIT_GAP = 3.1;
/** When the escape needs two lanes, the trail moves this early instead (still fair). */
const EARLY_SWITCH = 8;
/** Coins this close to a creature in the same lane are left out (you'd be hit taking them). */
const CREATURE_CLEAR = 1.2;

export function buildSwimCourse(rng: SeededRandom, length: number): SwimCourse {
  const items: SwimItem[] = [];

  // 1. Rows of creatures: one or (usually) two lanes blocked, never three.
  const rows: { distance: number; blocked: Lane[] }[] = [];
  for (let d = RUNWAY + 10; d < length - END_CLEAR; d += rng.int(ROW_GAP[0], ROW_GAP[1])) {
    const lanes = rng.shuffle([0, 1, 2] as Lane[]);
    const blocked = lanes.slice(0, rng.next() < TWO_LANE_CHANCE ? 2 : 1);
    rows.push({ distance: d, blocked });
    for (const lane of blocked) items.push({ distance: d, lane, kind: rng.next() < 0.5 ? 'jelly' : 'puffer' });
  }

  // 2. The coin trail.
  let lane: Lane = 1;
  let rowIndex = 0;
  let sinceHop = 0;
  let hopAt = rng.int(HOP_EVERY[0], HOP_EVERY[1]);
  for (let d = RUNWAY; d < length - END_CLEAR; d += COIN_GAP) {
    while (rows[rowIndex] && d > rows[rowIndex].distance + CREATURE_CLEAR) rowIndex++;
    const row = rows[rowIndex];
    const toRow = row ? row.distance - d : Infinity;
    const blockedHere = row ? row.blocked.includes(lane) : false;

    if (row && blockedHere) {
      const open = ([0, 1, 2] as Lane[]).filter((l) => !row.blocked.includes(l));
      const adjacent = open.filter((l) => Math.abs(l - lane) === 1);
      if (adjacent.length && toRow <= BAIT_GAP) {
        // Bait: the coins led right up to the creature; now duck into a neighbouring open lane.
        lane = rng.pick(adjacent);
        sinceHop = 0;
      } else if (!adjacent.length && toRow <= EARLY_SWITCH) {
        // The only way out is two lanes over: move one lane now; the next coin moves again.
        lane = 1;
        sinceHop = 0;
      }
    } else if (++sinceHop >= hopAt && toRow > EARLY_SWITCH) {
      // A random hop to a neighbouring lane, as long as it doesn't run into the next row.
      const options = ([0, 1, 2] as Lane[]).filter((l) => Math.abs(l - lane) === 1 && !(row && row.blocked.includes(l) && toRow < EARLY_SWITCH + 4));
      if (options.length) lane = rng.pick(options);
      sinceHop = 0;
      hopAt = rng.int(HOP_EVERY[0], HOP_EVERY[1]);
    }

    const at = Math.round(d * 100) / 100; // check the position the coin will really have
    const tooClose = rows.some((r) => r.blocked.includes(lane) && Math.abs(r.distance - at) < CREATURE_CLEAR);
    if (!tooClose) items.push({ distance: at, lane, kind: 'coin' });
  }

  items.sort((a, b) => a.distance - b.distance);
  return { length, items };
}

/** No row of creatures may block all three lanes (there is always a way through). */
export function swimCourseHasPath(course: SwimCourse): boolean {
  const rows = new Map<number, Set<Lane>>();
  for (const it of course.items) {
    if (it.kind === 'coin') continue;
    const row = rows.get(it.distance) ?? new Set<Lane>();
    row.add(it.lane);
    rows.set(it.distance, row);
  }
  return [...rows.values()].every((row) => row.size < 3);
}

/** No coin sits on top of a creature (collecting a coin must never mean taking a hit). */
export function coinsAvoidCreatures(course: SwimCourse): boolean {
  const creatures = course.items.filter((i) => i.kind !== 'coin');
  return course.items
    .filter((i) => i.kind === 'coin')
    .every((c) => !creatures.some((k) => k.lane === c.lane && Math.abs(k.distance - c.distance) < CREATURE_CLEAR));
}

/** Consecutive coins are never more than one lane apart, so the whole trail can be followed. */
export function trailIsFollowable(course: SwimCourse): boolean {
  const coins = course.items.filter((i) => i.kind === 'coin');
  return coins.every((c, i) => i === 0 || Math.abs(c.lane - coins[i - 1].lane) <= 1);
}
