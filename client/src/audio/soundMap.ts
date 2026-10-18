// Which sound plays for which game event (Vansh). Pure: no Web Audio here, so it's unit-tested.
// Audio only ever LISTENS to GameEvents, so nobody else has to call audio code (TEAM_SPLIT §5).

import { CONFIG } from '../core/config';
import type { GameEvent, RunState, Stage } from '../core/types';

export type SoundName =
  | 'laneChange'
  | 'branchHit'
  | 'hurtQuack'
  | 'crumb'
  | 'heart'
  | 'splash'
  | 'quack'
  | 'hatch'
  | 'clang'
  | 'cash'
  | 'grab'
  | 'bark'
  | 'chomp'
  | 'pondPop'
  | 'coin'
  | 'swish'
  | 'zap'
  | 'ouch'
  | 'powerUp'
  | 'noPower'
  | 'shieldUp'
  | 'ricochet'
  | 'shieldDown'
  | 'boost'
  | 'perfect'
  | 'shotgun'
  | 'reload'
  | 'aim'
  | 'fire'
  | 'laser'
  | 'pigeonHurt'
  | 'miss'
  | 'bossDefeated'
  | 'victory'
  | 'failed'
  | 'countdownTick'
  | 'go'
  | 'sting'
  | 'titleHit'
  | 'smash'
  | 'boostEnd'
  | 'swoop'
  | 'bossLand'
  | 'pigeonLaugh'
  | 'fight';

export type MusicTrack = 'lobby' | 'intro' | 'runner' | 'underwater' | 'boss';

/** `cue` names the phases emit, and the sound each one plays. Unknown cues stay silent. */
export const CUE_SOUNDS: Record<string, SoundName> = {
  laneChange: 'laneChange',
  hit: 'branchHit', // the runner's branch; the life itself is the 'damaged' event
  crumb: 'crumb',
  splash: 'splash',
  jump: 'quack',
  hatch: 'hatch',
  clang: 'clang',
  cash: 'cash',
  grab: 'grab',
  boost: 'boost',
  perfect: 'perfect',
  shot: 'shotgun',
  ready: 'reload',
  aim: 'aim',
  fire: 'fire',
  laser: 'laser',
  miss: 'miss',
  bossDefeated: 'bossDefeated',
  bark: 'bark', // the dog closing in; the bite itself is 'bite'
  bite: 'chomp',
  pondPop: 'pondPop',
  coin: 'coin',
  swish: 'swish',
  zap: 'zap', // jellyfish
  ouch: 'ouch', // any other sea creature
  powerup: 'powerUp',
  nopower: 'noPower',
  shield: 'shieldUp',
  ricochet: 'ricochet',
  shieldDown: 'shieldDown',
  smash: 'smash', // boosted Bill crashing through a branch
  boostEnd: 'boostEnd',
  bossIncoming: 'swoop',
  bossLand: 'bossLand',
  bossName: 'sting',
  bossTaunt: 'pigeonLaugh',
  fight: 'fight',
};

/**
 * The sounds one event plays. Cues that duplicate a core event ('heart' = lifeGained) are left to
 * the core event so nothing plays twice.
 */
export function soundsFor(event: GameEvent): SoundName[] {
  switch (event.type) {
    case 'cue': {
      const sound = CUE_SOUNDS[event.name];
      return sound ? [sound] : [];
    }
    case 'damaged':
      return ['hurtQuack'];
    case 'lifeGained':
      return ['heart'];
    case 'bossDamaged':
      return event.damage > 1 ? ['pigeonHurt'] : [];
    case 'runFinished':
      return ['victory'];
    case 'runFailed':
      return ['failed'];
    case 'stageChanged':
      return event.previous === 'COUNTDOWN' ? ['go'] : [];
    default:
      return [];
  }
}

/** The music for a stage. null = silence (countdown, results). Transitions keep the track they lead into. */
export function musicFor(stage: Stage): MusicTrack | null {
  switch (stage) {
    case 'LOBBY':
      return 'lobby';
    case 'RUNNER_1':
    case 'RUNNER_2':
      return 'runner';
    case 'DIVE':
    case 'UNDERWATER':
    case 'SURFACE_RETURN':
      return 'underwater';
    case 'BOSS':
      return 'boss';
    default:
      return null;
  }
}

/** True when the 3-2-1 countdown has just shown a new number (one tick per number). */
export function countdownTicked(previousSec: number, sec: number): boolean {
  return sec > 0 && Math.ceil(sec) !== Math.ceil(previousSec);
}

/** How hard the music should push right now, so it follows the run instead of looping blindly. */
export interface MusicMood {
  /** Multiplies the track's bpm. */
  tempo: number;
  /** 0 = calm start of a section, 1 = about to finish it. Opens the filter and adds drum layers. */
  tension: number;
  /** On your last life: a heartbeat joins the track. */
  danger: boolean;
}

type MoodInput = Pick<RunState, 'stage' | 'runnerSpeed' | 'phaseDistance' | 'phaseLength' | 'lives'>;

export function musicMood(run: MoodInput): MusicMood {
  const progress = run.phaseLength > 0 ? Math.min(1, Math.max(0, run.phaseDistance / run.phaseLength)) : 0;
  const danger = run.lives === 1;
  let tempo = 1;
  if (run.stage === 'RUNNER_1' || run.stage === 'RUNNER_2') {
    // The track speeds up with Bill: up to 20% faster at top speed.
    const { startSpeed, maxSpeed } = CONFIG.runner;
    const t = Math.min(1, Math.max(0, (run.runnerSpeed - startSpeed) / (maxSpeed - startSpeed)));
    tempo = 1 + 0.2 * t;
  } else if (run.stage === 'BOSS') {
    // The closer Don Crumb is to falling, the faster the fight gets.
    tempo = 1 + 0.12 * progress;
  }
  if (danger) tempo += 0.05;
  return { tempo, tension: danger ? Math.max(progress, 0.8) : progress, danger };
}
