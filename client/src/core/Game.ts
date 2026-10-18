// The state machine, the one animation loop and the one renderer (brief §11).
// Only this file moves between stages, changes the input mode, or changes lives, coins, timer and status.

import * as THREE from 'three';
import { createCharacter, type CharacterView } from '../render/character';
import { RenderPipeline } from '../render/pipeline';
import { SKY, createEnvironmentScene, createOutdoorLights, createSky } from '../render/sky';
import { CONFIG } from './config';
import { InputState, attachKeyboard } from './Input';
import {
  STAGE_PHASE,
  addCoins,
  addScore,
  applyBossDamage,
  applyDamage,
  collectHeart,
  createRunState,
  fail,
  resetForAttempt,
  updateElapsed,
  type RunIdentity,
} from './RunState';
import { createRandom, deriveSeed } from './seededRandom';
import type {
  DamageCause,
  FailReason,
  GameEvent,
  InputMode,
  Phase,
  PhaseContext,
  PhaseFactory,
  RunState,
  Stage,
} from './types';

/** The gameplay stages in run order. */
export const RUN_ORDER: readonly Stage[] = [
  'RUNNER_1',
  'DIVE',
  'UNDERWATER',
  'SURFACE_RETURN',
  'RUNNER_2',
  'BOSS',
  'FINISHED',
];

/** The input mode each stage starts in, and the modes a phase may ask for (brief §3). */
const STAGE_INPUT: Record<Stage, { start: InputMode; allowed: readonly InputMode[] }> = {
  LOBBY: { start: 'none', allowed: ['none'] },
  COUNTDOWN: { start: 'none', allowed: ['none'] },
  RUNNER_1: { start: 'lanes', allowed: ['lanes', 'none'] },
  DIVE: { start: 'none', allowed: ['none'] },
  UNDERWATER: { start: 'lanes', allowed: ['lanes', 'none'] },
  SURFACE_RETURN: { start: 'none', allowed: ['none'] },
  RUNNER_2: { start: 'lanes', allowed: ['lanes', 'none'] },
  BOSS: { start: 'lanes', allowed: ['lanes', 'timing', 'none'] },
  FINISHED: { start: 'none', allowed: ['none'] },
  FAILED: { start: 'none', allowed: ['none'] },
};

const INSTRUCTION_STAGES: ReadonlySet<Stage> = new Set([
  'RUNNER_1', 'UNDERWATER', 'RUNNER_2', 'BOSS',
]);

export interface FrameInfo {
  run: Readonly<RunState>;
  inputMode: InputMode;
  /** Seconds left on the countdown, or 0 when not counting down. */
  countdownSec: number;
  /** Gameplay stays paused until a fresh press of either button dismisses the instructions. */
  waitingForInstructions: boolean;
}

export interface GameOptions {
  container: HTMLElement;
  identity: RunIdentity;
  phases: Partial<Record<Stage, PhaseFactory>>;
}

export interface StartOptions {
  /** performance.now() time the countdown ends. Rooms set this so everyone starts together. */
  countdownEndsAt?: number;
  /** Dev only: skip the countdown and start straight in this stage (?phase=boss). */
  jumpTo?: Stage;
}

let attemptCounter = 0;

export class Game {
  readonly scene = new THREE.Scene();
  readonly defaultCamera: THREE.PerspectiveCamera;
  readonly bill: CharacterView;
  readonly input = new InputState();
  readonly sky: THREE.Mesh;

  private readonly pipeline: RenderPipeline;
  private readonly state: RunState;
  private phases: Partial<Record<Stage, PhaseFactory>>;
  private readonly eventListeners = new Set<(e: GameEvent) => void>();
  private readonly frameListeners = new Set<(f: FrameInfo) => void>();
  private readonly detachKeyboard: () => void;

  private camera: THREE.Camera;
  private phase: Phase | null = null;
  /** Each phase instance gets a token; callbacks from an old instance are ignored. */
  private phaseToken = 0;
  private startedAtMs = 0;
  private countdownEndsAt = 0;
  private lastFrameMs = 0;
  private waitingForInstructions = false;
  private inputAfterInstructions: InputMode = 'none';
  /** Stage changes asked for during a phase's update() are applied after it returns. */
  private pendingStage: Stage | null = null;

  constructor(options: GameOptions) {
    this.phases = options.phases;
    this.state = createRunState(options.identity);

    this.defaultCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
    this.camera = this.defaultCamera;
    this.resetCamera();
    this.pipeline = new RenderPipeline(options.container, this.scene, this.camera, createEnvironmentScene());

    this.sky = createSky();
    this.scene.add(this.sky, createOutdoorLights());
    this.resetAtmosphere();

    this.bill = createCharacter();
    this.scene.add(this.bill.object);
    this.resetBill();

    this.detachKeyboard = attachKeyboard(this.input);
    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  get run(): Readonly<RunState> {
    return this.state;
  }

  get stage(): Stage {
    return this.state.stage;
  }

  /** HUD, audio and network subscribe here. Returns an unsubscribe function. */
  onEvent(listener: (e: GameEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** Called after every frame's update, for HUD-style readouts. Returns an unsubscribe function. */
  onFrame(listener: (f: FrameInfo) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  /** Start the render loop. The game sits in the lobby until startAttempt() is called. */
  start(): void {
    this.lastFrameMs = performance.now();
    this.pipeline.renderer.setAnimationLoop(this.frame);
  }

  /**
   * Join a room's challenge: its seed decides the course for everyone in it (brief §9).
   * Only allowed between runs, so nobody's course changes mid-attempt.
   */
  setIdentity(identity: RunIdentity): void {
    if (this.state.status === 'running' || this.state.stage === 'COUNTDOWN') {
      console.warn('[core] setIdentity() ignored during a run');
      return;
    }
    this.state.roomId = identity.roomId;
    this.state.playerId = identity.playerId;
    this.state.seed = identity.seed;
  }

  /** Which stages to play: the full run (solo) or the sprint (room races). Only between runs, like setIdentity. */
  setPhases(phases: Partial<Record<Stage, PhaseFactory>>): void {
    if (this.state.status === 'running' || this.state.stage === 'COUNTDOWN') {
      console.warn('[core] setPhases() ignored during a run');
      return;
    }
    this.phases = phases;
  }

  /** A fresh attempt on the same course: used for the first start and for every retry. */
  startAttempt(options: StartOptions = {}): void {
    const attemptId = `a${Date.now().toString(36)}${(attemptCounter++).toString(36)}`;
    this.exitPhase();
    resetForAttempt(this.state, attemptId);
    this.input.clear();
    this.emit({ type: 'attemptStarted', attemptId });

    if (options.jumpTo) {
      this.state.status = 'running';
      this.startedAtMs = performance.now();
      this.goTo(options.jumpTo);
      return;
    }
    this.countdownEndsAt = options.countdownEndsAt ?? performance.now() + CONFIG.flow.countdownSec * 1000;
    this.goTo('COUNTDOWN');
  }

  /** Back to the lobby (e.g. leaving a room). */
  toLobby(): void {
    this.exitPhase();
    this.state.status = 'waiting';
    this.goTo('LOBBY');
  }

  destroy(): void {
    this.pipeline.renderer.setAnimationLoop(null);
    this.exitPhase();
    this.detachKeyboard();
    window.removeEventListener('resize', this.onResize);
    this.pipeline.dispose();
  }

  // ---------------------------------------------------------------------------------------------

  private frame = (): void => {
    const now = performance.now();
    const frameElapsedMs = now - this.lastFrameMs;
    // Clamp so a background tab or a long GC pause can't teleport anything through obstacles.
    const dt = Math.min(frameElapsedMs / 1000, 0.1);
    this.lastFrameMs = now;

    // Reading instructions must not add arbitrary time to a player's ranked run.
    if (this.waitingForInstructions && this.state.status === 'running') {
      this.startedAtMs += frameElapsedMs;
    }
    const continuePressed = this.waitingForInstructions && this.input.consumeContinuePress();
    this.input.beginFrame();
    updateElapsed(this.state, now, this.startedAtMs);

    if (this.state.stage === 'COUNTDOWN' && now >= this.countdownEndsAt) {
      this.state.status = 'running';
      this.startedAtMs = this.countdownEndsAt; // the clock starts the moment the countdown ends
      this.goTo('RUNNER_1');
    }

    if (continuePressed) {
      this.waitingForInstructions = false;
      this.setInputMode(this.inputAfterInstructions);
    }
    // The acknowledgement frame still belongs to the pause; gameplay advances next frame.
    if (!this.waitingForInstructions) this.phase?.update(continuePressed ? 0 : dt);
    if (this.pendingStage) {
      const stage = this.pendingStage;
      this.pendingStage = null;
      this.goTo(stage);
    }
    this.bill.update(dt);

    const info: FrameInfo = {
      run: this.state,
      inputMode: this.input.getMode(),
      countdownSec: this.state.stage === 'COUNTDOWN' ? Math.max(0, (this.countdownEndsAt - now) / 1000) : 0,
      waitingForInstructions: this.waitingForInstructions,
    };
    this.frameListeners.forEach((l) => l(info));

    this.pipeline.render(this.camera);
  };

  /**
   * Called from inside a phase: the stage changes once that phase's update() has returned, so it
   * never has its scene objects removed mid-update. The phase's context goes dead immediately,
   * so nothing else it calls this frame can change the run. The first request in a frame wins.
   */
  private requestStage(stage: Stage): void {
    if (this.pendingStage) return;
    this.pendingStage = stage;
    this.phaseToken++;
  }

  private goTo(stage: Stage): void {
    const previous = this.state.stage;
    this.pendingStage = null;
    this.exitPhase();
    this.waitingForInstructions = false;

    this.state.stage = stage;
    if (stage !== 'FAILED') this.state.phase = STAGE_PHASE[stage];
    // A run that ends keeps how far it got, for its score and the room's leaderboard.
    if (stage !== 'FAILED' && stage !== 'FINISHED') {
      this.state.phaseDistance = 0;
      this.state.phaseLength = 0;
    }
    this.camera = this.defaultCamera;
    this.resetCamera();
    // Transitions pick Bill up from the lane the runner left him in, instead of snapping him to the middle.
    this.resetBill(stage === 'DIVE' || stage === 'SURFACE_RETURN');
    this.resetAtmosphere();
    this.setInputMode(STAGE_INPUT[stage].start);
    this.emit({ type: 'stageChanged', stage, previous });

    const factory = this.phases[stage];
    if (factory) {
      const token = ++this.phaseToken;
      this.phase = factory(this.makeContext(token));
      this.phase.enter();
    }
    if (INSTRUCTION_STAGES.has(stage)) {
      // enter() prepares the scenery with course items hidden. Keep updates/input gated
      // until the help is gone, preserving course positions, power-up time, and boss volleys.
      this.inputAfterInstructions = this.input.getMode();
      this.setInputMode('none');
      this.waitingForInstructions = true;
    }
  }

  private next(): void {
    const i = RUN_ORDER.indexOf(this.state.stage);
    if (i < 0 || i >= RUN_ORDER.length - 1) return;
    const nextStage = RUN_ORDER[i + 1];
    if (nextStage === 'FINISHED' && this.state.status !== 'finished') {
      console.warn('[core] the boss called completePhase() before its health reached 0');
      return;
    }
    this.requestStage(nextStage);
  }

  private exitPhase(): void {
    if (!this.phase) return;
    const phase = this.phase;
    this.phase = null;
    this.phaseToken++;
    phase.exit();
    phase.dispose();
  }

  private setInputMode(mode: InputMode): void {
    if (this.input.getMode() === mode) return;
    this.input.setMode(mode);
    this.emit({ type: 'inputModeChanged', mode });
  }

  private emit(event: GameEvent): void {
    this.eventListeners.forEach((l) => l(event));
  }

  private failRun(reason: FailReason): void {
    if (this.state.status !== 'running') return;
    this.stopClock();
    fail(this.state, reason);
    this.afterFail();
  }

  private afterFail(cause?: DamageCause): void {
    this.emit({ type: 'runFailed', reason: this.state.failReason!, elapsedMs: this.state.elapsedMs, cause });
    this.requestStage('FAILED');
  }

  /** Bring elapsed time up to this exact moment. Call before anything that ends the run. */
  private stopClock(): void {
    updateElapsed(this.state, performance.now(), this.startedAtMs);
  }

  /** A context bound to one phase instance. Once that instance has ended, every call is a no-op. */
  private makeContext(token: number): PhaseContext {
    const game = this;
    const live = (): boolean => token === game.phaseToken;
    const state = this.state;

    return {
      scene: this.scene,
      defaultCamera: this.defaultCamera,
      bill: this.bill,
      sky: this.sky,
      get input() {
        return game.input.snapshot;
      },
      get run() {
        return state;
      },
      setCamera(camera) {
        if (live()) game.camera = camera;
      },
      rng(section) {
        return createRandom(deriveSeed(state.seed, section));
      },
      requestInputMode(mode) {
        if (!live()) return;
        if (!STAGE_INPUT[state.stage].allowed.includes(mode)) {
          console.warn(`[core] ${state.stage} may not use input mode '${mode}'`);
          return;
        }
        game.setInputMode(mode);
      },
      damagePlayer(cause) {
        if (!live()) return false;
        game.stopClock();
        const result = applyDamage(state, performance.now());
        if (result === 'ignored') return false;
        game.emit({ type: 'damaged', lives: state.lives, cause });
        if (result === 'dead') game.afterFail(cause);
        return true;
      },
      addScore(points) {
        if (!live()) return;
        const delta = addScore(state, points);
        if (delta !== 0) game.emit({ type: 'scoreChanged', score: state.score, delta });
      },
      addCoins(delta) {
        if (!live()) return;
        const change = addCoins(state, delta);
        if (change !== 0) game.emit({ type: 'coinsChanged', coins: state.coins, delta: change });
      },
      gainLife() {
        if (!live() || !collectHeart(state)) return false;
        game.emit({ type: 'lifeGained', lives: state.lives });
        return true;
      },
      setRunnerSpeed(speed) {
        if (live()) state.runnerSpeed = speed;
      },
      setPhaseProgress(distance, length) {
        if (!live()) return;
        state.phaseDistance = distance;
        state.phaseLength = length;
      },
      damageBoss(amount) {
        if (!live()) return;
        // Stop the clock on the exact hit that wins, before the status changes.
        game.stopClock();
        const result = applyBossDamage(state, amount);
        if (result.applied === 0 && !result.defeated) return;
        game.emit({ type: 'bossDamaged', damage: result.applied, health: state.bossHealth });
        if (result.defeated) game.emit({ type: 'runFinished', elapsedMs: state.elapsedMs, score: state.score });
      },
      completePhase() {
        if (live()) game.next();
      },
      failRun(reason) {
        if (live()) game.failRun(reason);
      },
      emit(event) {
        if (live()) game.emit(event);
      },
    };
  }

  /** Open sky and light haze. Phases that go underwater change these and core puts them back. */
  private resetAtmosphere(): void {
    this.sky.visible = true;
    this.scene.background = new THREE.Color(SKY.horizon);
    this.scene.fog = new THREE.Fog(SKY.fog, 70, 260);
  }

  /** Behind and above Bill, looking down the track (-Z). Phases can move it or swap cameras. */
  private resetCamera(): void {
    this.defaultCamera.position.set(0, 3.4, 6.5);
    this.defaultCamera.lookAt(0, 1, -8);
    if (this.defaultCamera.fov !== 60) {
      this.defaultCamera.fov = 60;
      this.defaultCamera.updateProjectionMatrix();
    }
  }

  /** Bill faces -Z (away from the camera) at the origin, visible and idle. */
  private resetBill(keepLane = false): void {
    const o = this.bill.object;
    o.position.set(keepLane ? o.position.x : 0, 0, 0);
    o.rotation.set(0, Math.PI, 0);
    o.scale.set(1, 1, 1);
    o.visible = true;
    this.bill.setGhost(false);
    this.bill.setPose('idle');
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.pipeline.setSize(w, h);
    this.defaultCamera.aspect = w / h;
    this.defaultCamera.updateProjectionMatrix();
  };
}
