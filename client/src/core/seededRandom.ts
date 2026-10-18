// Deterministic random numbers for gameplay (brief §9). Same seed in, same numbers out, on every machine.
// Never use Math.random() for anything that changes the course, pickups or boss patterns.

export interface SeededRandom {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Returns a new shuffled array; the input is left alone. */
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32: tiny, fast and good enough for a game. */
export function createRandom(seed: number): SeededRandom {
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  return {
    next,
    int,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick() needs at least one item');
      return items[int(0, items.length - 1)];
    },
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/**
 * Gives each section its own seed derived from the room seed, so a change in how one
 * section uses random numbers can never shift another section's course.
 */
export function deriveSeed(roomSeed: number, label: string): number {
  // FNV-1a over the label, mixed with the room seed.
  let h = 0x811c9dc5 ^ (roomSeed >>> 0);
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A fresh random room seed. Only the host calls this; everyone else receives the seed. */
export function newRoomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
