// Which phase runs in which stage. Tejas renders every stage (ZUBAIR_BASE.md handoff); the boss's
// RULES live in Zubair's sim/boss.ts and BossPhase only adapts and draws them.
// To swap in a new phase, change only that stage's line.

import { CONFIG } from '../core/config';
import type { PhaseFactory, Stage } from '../core/types';
import { createBossPhase } from './boss/BossPhase';
import { createRunner } from './runner/RunnerPhase';
import { createDive } from './transitions/DivePhase';
import { createSurfaceReturn } from './transitions/SurfaceReturnPhase';
import { createSwimPhase } from './underwater/SwimPhase';

/**
 * Dev only: `?short` cuts the runners and the swim to a fifth of their length (a ~15 s run). Ignored in a
 * production build, so nobody can shorten their own course in a room race.
 */
const SHORT =
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('short');

/** Every stage, with the runners and the swim at `scale` of their full length. */
export function buildPhases(scale: number): Partial<Record<Stage, PhaseFactory>> {
  const length = (full: number) => Math.round(full * scale);
  return {
    RUNNER_1: createRunner({ section: 'runner1', length: length(CONFIG.runner.runner1Distance), crumbs: false, heart: false, dog: true, pond: true, maxSpeed: CONFIG.runner.maxSpeed }),
    DIVE: createDive(),
    UNDERWATER: createSwimPhase(length(CONFIG.swim.distance)),
    SURFACE_RETURN: createSurfaceReturn(),
    RUNNER_2: createRunner({ section: 'runner2', length: length(CONFIG.runner.runner2Distance), crumbs: true, heart: true, boost: true, maxSpeed: CONFIG.runner.runner2MaxSpeed }),
    BOSS: createBossPhase(),
  };
}

/** Solo practice: the full run. */
export const PHASES = buildPhases(SHORT ? 0.2 : 1);
/** Room races: CONFIG.flow.roomCourseScale of the full course (the full run by default). Everyone in a room uses the same lengths. */
export const ROOM_PHASES = buildPhases(SHORT ? 0.2 : CONFIG.flow.roomCourseScale);

/** `?phase=` values for jumping straight into a stage while developing. */
export const DEV_JUMPS: Record<string, Stage> = {
  runner1: 'RUNNER_1',
  dive: 'DIVE',
  underwater: 'UNDERWATER',
  swim: 'UNDERWATER',
  'surface-return': 'SURFACE_RETURN',
  runner2: 'RUNNER_2',
  boss: 'BOSS',
};
