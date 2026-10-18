// What players see the stages called (Tejas). The code keeps its ids (RUNNER_1, runner1…); every
// screen that names a stage (HUD, results, scoreboards, big screen) uses these.

import type { PhaseId, Stage } from '../core/types';

/** The HUD's label for where you are right now. */
export const STAGE_LABEL: Record<Stage, string> = {
  LOBBY: '',
  COUNTDOWN: 'Get ready',
  RUNNER_1: 'Stage 1 · Forest road',
  DIVE: 'Into the pond',
  UNDERWATER: 'Underwater',
  SURFACE_RETURN: 'Back to the surface',
  RUNNER_2: 'Stage 2 · Back on the road',
  BOSS: 'Boss · Don Crumbs',
  FINISHED: 'Finished',
  FAILED: 'Out',
};

/** The four scored sections, as leaderboards and results name them. */
export const SECTION_LABEL: Record<PhaseId, string> = {
  runner1: 'Stage 1',
  underwater: 'Underwater',
  runner2: 'Stage 2',
  boss: 'Boss',
};
