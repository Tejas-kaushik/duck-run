// Central input routing (brief §3). The only place that listens to the keyboard.
// Phases never add their own key listeners: they read ctx.input, which is already filtered by mode.
//
// The whole game is two buttons, LEFT (A) and RIGHT (D), and nothing else:
//   lanes  = LEFT and RIGHT change lane.
//   timing = EITHER button fires (the boss's FIRE).
//   none   = EITHER button dismisses an instruction card.
// Phones press the same two buttons with the left and right halves of the screen (ui/touchControls.ts).

import type { InputMode, InputSnapshot } from './types';

type GameKey = 'left' | 'right';

const KEY_CODES: Record<string, GameKey> = {
  KeyA: 'left',
  KeyD: 'right',
};

const EMPTY: InputSnapshot = Object.freeze({
  leftPressed: false,
  rightPressed: false,
  firePressed: false,
  fireHeld: false,
});

/** Keyboard state with no DOM in it, so it can be unit tested. */
export class InputState {
  private mode: InputMode = 'none';
  private held = new Set<GameKey>();
  private pressed = new Set<GameKey>();
  /** Buttons pressed down while in timing mode and still held. A lane key held over from dodging doesn't count. */
  private heldSinceTiming = new Set<GameKey>();
  private current: InputSnapshot = EMPTY;

  getMode(): InputMode {
    return this.mode;
  }

  /** Instruction cards: either button continues. Consume before beginFrame(), without enabling gameplay inputs. */
  consumeContinuePress(): boolean {
    if (this.mode !== 'none') return false;
    const left = this.pressed.delete('left');
    const right = this.pressed.delete('right');
    return left || right;
  }

  /** Changing mode drops any press not yet consumed, so it can't leak into the next phase. */
  setMode(mode: InputMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.pressed.clear();
    this.heldSinceTiming.clear();
    this.current = EMPTY;
  }

  /** Returns true if the key is one of ours, so the caller can stop the browser default. */
  keyDown(code: string, repeat: boolean): boolean {
    const key = KEY_CODES[code];
    if (!key) return false;
    if (!repeat && !this.held.has(key)) {
      this.pressed.add(key);
      if (this.mode === 'timing') this.heldSinceTiming.add(key);
    }
    this.held.add(key);
    return true;
  }

  keyUp(code: string): boolean {
    const key = KEY_CODES[code];
    if (!key) return false;
    this.held.delete(key);
    this.heldSinceTiming.delete(key);
    return true;
  }

  /** Window lost focus: forget everything, so no key is stuck down when the player comes back. */
  clear(): void {
    this.held.clear();
    this.pressed.clear();
    this.heldSinceTiming.clear();
    this.current = EMPTY;
  }

  /** Called once per frame by the game loop. Presses are consumed here. */
  beginFrame(): InputSnapshot {
    const lanes = this.mode === 'lanes';
    const timing = this.mode === 'timing';
    this.current = {
      leftPressed: lanes && this.pressed.has('left'),
      rightPressed: lanes && this.pressed.has('right'),
      firePressed: timing && this.pressed.size > 0,
      fireHeld: timing && this.heldSinceTiming.size > 0,
    };
    this.pressed.clear();
    return this.current;
  }

  get snapshot(): InputSnapshot {
    return this.current;
  }
}

/** Wires the real keyboard to an InputState. Returns a function that removes the listeners. */
export function attachKeyboard(input: InputState, target: Window = window): () => void {
  const typingInField = (e: KeyboardEvent): boolean => {
    const el = e.target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  };

  const onDown = (e: KeyboardEvent): void => {
    if (typingInField(e)) return; // let people type nicknames with A and D
    // Ignore Ctrl+R, Cmd+D etc. so browser shortcuts still work and don't count as moves.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    input.keyDown(e.code, e.repeat);
  };
  const onUp = (e: KeyboardEvent): void => {
    input.keyUp(e.code);
  };
  const onBlur = (): void => input.clear();

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onDown);
    target.removeEventListener('keyup', onUp);
    target.removeEventListener('blur', onBlur);
  };
}
