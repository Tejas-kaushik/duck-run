// Shared contracts (brief §11, TEAM_SPLIT §4). Owned by Tejas: ask before changing anything here,
// because every phase, the HUD and the network code are written against these types.

import type * as THREE from 'three';
import type { CharacterView } from '../render/character';
import type { SeededRandom } from './seededRandom';

/** Every state the game can be in, in run order. Only core/Game.ts moves between them. */
export type Stage =
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'RUNNER_1'
  | 'DIVE' // Bill dives into a pond that pops up at the end of Runner 1
  | 'UNDERWATER' // swimming: A/D lanes, dodge, collect coins for a power-up
  | 'SURFACE_RETURN'
  | 'RUNNER_2'
  | 'BOSS' // the boss phase switches between dodging and attacking itself, via requestInputMode()
  | 'FINISHED'
  | 'FAILED';

/** The four gameplay sections the scoreboard talks about. */
export type PhaseId = 'runner1' | 'underwater' | 'runner2' | 'boss';

export type RunStatus = 'waiting' | 'running' | 'failed' | 'finished';

/** The game has two buttons, A and D. lanes = they change lane. timing = either one fires. none = either one continues. */
export type InputMode = 'none' | 'lanes' | 'timing';

export type FailReason = 'lives';

/** What took Bill's life, so the ending can show how he went out. */
export type DamageCause = 'log' | 'dog' | 'boss';

/** What the coins from the swim buy: the best one you can afford, automatically (DESIGN_CHANGES.md). */
export type PowerUp = 'none' | 'shield' | 'boost' | 'laser';

export type RandomSection = 'runner1' | 'runner2' | 'underwater' | 'boss';

/** Rebuilt once per frame by core/Input.ts and already filtered by the current input mode. */
export interface InputSnapshot {
  /** Fresh A keydown this frame (key repeat ignored). Always false outside 'lanes' mode. */
  leftPressed: boolean;
  /** Fresh D keydown this frame. Always false outside 'lanes' mode. */
  rightPressed: boolean;
  /** Fresh press of EITHER button this frame. Always false outside 'timing' mode. */
  firePressed: boolean;
  /** A button pressed during 'timing' mode is still held. The boss needs it: held through FIRE = Miss. */
  fireHeld: boolean;
}

export interface RunState {
  roomId: string;
  playerId: string;
  attemptId: string;
  seed: number;
  stage: Stage;
  /** The gameplay section the player is in (or heading into), for the scoreboard. */
  phase: PhaseId;
  status: RunStatus;
  elapsedMs: number;
  lives: number;
  /** Coins collected underwater this attempt. They decide the power-up. */
  coins: number;
  score: number;
  /** Distance travelled in the current section, and that section's total, for progress bars. */
  phaseDistance: number;
  phaseLength: number;
  bossHealth: number;
  /** Runner speed carries from Runner 1 into Runner 2 (brief §8). */
  runnerSpeed: number;
  invulnerableUntilMs: number;
  heartCollected: boolean;
  failReason: FailReason | null;
}

/** Everything other parts of the game may want to react to: HUD, audio, network, effects. */
export type GameEvent =
  | { type: 'stageChanged'; stage: Stage; previous: Stage }
  | { type: 'attemptStarted'; attemptId: string }
  | { type: 'inputModeChanged'; mode: InputMode }
  | { type: 'damaged'; lives: number; cause?: DamageCause }
  | { type: 'lifeGained'; lives: number }
  | { type: 'coinsChanged'; coins: number; delta: number }
  | { type: 'scoreChanged'; score: number; delta: number }
  | { type: 'bossDamaged'; damage: number; health: number }
  | { type: 'runFinished'; elapsedMs: number; score: number }
  | { type: 'runFailed'; reason: FailReason; elapsedMs: number; cause?: DamageCause }
  /** Phase-specific moments for sound and effects, e.g. 'laneChange', 'boost', 'perfect', 'shot'. */
  | { type: 'cue'; name: string };

/** What every phase gets. Phases read through it and ASK core to change shared state. */
export interface PhaseContext {
  readonly scene: THREE.Scene;
  setCamera(camera: THREE.Camera): void;
  /** The default third-person camera, already in the scene's coordinate system. */
  readonly defaultCamera: THREE.PerspectiveCamera;
  readonly input: Readonly<InputSnapshot>;
  readonly run: Readonly<RunState>;
  /** A fresh generator for that section, seeded from the room seed. Same every attempt. */
  rng(section: RandomSection): SeededRandom;
  /** Bill. Core resets his position, pose and visibility when a stage starts. */
  readonly bill: CharacterView;
  /** The sky dome. Visible again at every stage start; underwater stages hide it. */
  readonly sky: THREE.Object3D;

  requestInputMode(mode: InputMode): void;
  /** Returns false (and does nothing) while invulnerable. Fails the run at 0 lives. */
  damagePlayer(cause?: DamageCause): boolean;
  addScore(points: number): void;
  /** Coins can go up (pickups) or down (hits underwater), never below 0. */
  addCoins(delta: number): void;
  /** The heart. Returns false if it was already collected this attempt. */
  gainLife(): boolean;
  setRunnerSpeed(speed: number): void;
  setPhaseProgress(distance: number, length: number): void;
  /** Clamps at 0. The first hit that reaches 0 stops the timer and finishes the run, once. */
  damageBoss(amount: number): void;
  /** Move on to the next stage. */
  completePhase(): void;
  failRun(reason: FailReason): void;
  emit(event: GameEvent): void;
}

/**
 * A gameplay stage. Core creates a NEW instance every time the stage starts (so a retry can never
 * see old state), calls enter(), update() every frame, then exit() and dispose() when it ends.
 * Remove everything you added to the scene in exit(). Never start your own animation loop.
 */
export interface Phase {
  enter(): void;
  update(dtSeconds: number): void;
  exit(): void;
  dispose(): void;
}

export type PhaseFactory = (ctx: PhaseContext) => Phase;
