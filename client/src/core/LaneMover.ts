// Three-lane movement shared by the runners and the boss (brief §4, §6).
// One lane per fresh A/D press, a short slide between lanes, never outside the lanes.
// Lane 0 is the left of the screen when the camera looks down -Z (the default camera).

import { CONFIG } from './config';
import type { InputSnapshot } from './types';

export type Lane = 0 | 1 | 2;

export class LaneMover {
  private _lane: Lane;
  private fromX: number;
  private t = 1; // 0..1 progress of the current slide

  constructor(
    private readonly lanes: readonly number[] = CONFIG.runner.lanes,
    private readonly changeSec: number = CONFIG.runner.laneChangeSec,
    startLane: Lane = 1,
  ) {
    this._lane = startLane;
    this.fromX = lanes[startLane];
  }

  /** The lane used for collision: switches the moment the key is pressed. */
  get lane(): Lane {
    return this._lane;
  }

  /** The position to draw at, sliding smoothly towards the lane. */
  get x(): number {
    const eased = 1 - (1 - this.t) * (1 - this.t);
    return this.fromX + (this.lanes[this._lane] - this.fromX) * eased;
  }

  /** -1 while sliding left, 1 while sliding right, 0 when settled. Handy for Bill's lean. */
  get direction(): -1 | 0 | 1 {
    if (this.t >= 1) return 0;
    return this.lanes[this._lane] < this.fromX ? -1 : 1;
  }

  /** Returns -1, 0 or 1: which way the lane changed this call, if it did. */
  handle(input: Readonly<InputSnapshot>): -1 | 0 | 1 {
    let step = 0;
    if (input.leftPressed) step -= 1;
    if (input.rightPressed) step += 1;
    return this.move(step);
  }

  move(step: number): -1 | 0 | 1 {
    const target = Math.min(this.lanes.length - 1, Math.max(0, this._lane + step)) as Lane;
    if (target === this._lane) return 0;
    this.fromX = this.x;
    this.t = 0;
    const dir = target < this._lane ? -1 : 1;
    this._lane = target;
    return dir;
  }

  update(dtSeconds: number): void {
    if (this.t < 1) this.t = Math.min(1, this.t + dtSeconds / this.changeSec);
  }

  reset(lane: Lane = 1): void {
    this._lane = lane;
    this.fromX = this.lanes[lane];
    this.t = 1;
  }
}
