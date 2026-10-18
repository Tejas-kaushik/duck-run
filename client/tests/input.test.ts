import { describe, expect, it } from 'vitest';
import { InputState } from '../src/core/Input';

describe('InputState: the whole game is two buttons, A and D (brief §3)', () => {
  it('only knows A and D: Space and every other key are not game keys', () => {
    const input = new InputState();
    expect(input.keyDown('KeyA', false)).toBe(true);
    expect(input.keyDown('KeyD', false)).toBe(true);
    expect(input.keyDown('Space', false)).toBe(false);
    expect(input.keyDown('KeyW', false)).toBe(false);
    expect(input.keyDown('Enter', false)).toBe(false);
  });

  it('changes lane with A/D in lanes mode, and never fires there', () => {
    const input = new InputState();
    input.setMode('lanes');
    input.keyDown('KeyA', false);
    const s = input.beginFrame();
    expect(s.leftPressed).toBe(true);
    expect(s.rightPressed).toBe(false);
    expect(s.firePressed).toBe(false);
  });

  it('fires with EITHER button in timing mode, and never changes lane there', () => {
    for (const key of ['KeyA', 'KeyD']) {
      const input = new InputState();
      input.setMode('timing');
      input.keyDown(key, false);
      const s = input.beginFrame();
      expect(s.firePressed).toBe(true);
      expect(s.leftPressed || s.rightPressed).toBe(false);
    }
  });

  it('never reports anything in none mode', () => {
    const input = new InputState();
    input.keyDown('KeyA', false);
    input.keyDown('KeyD', false);
    const s = input.beginFrame();
    expect(s.leftPressed || s.rightPressed || s.firePressed || s.fireHeld).toBe(false);
  });

  it('consumes a press once and ignores key repeat', () => {
    const input = new InputState();
    input.setMode('lanes');
    input.keyDown('KeyA', false);
    expect(input.beginFrame().leftPressed).toBe(true);
    input.keyDown('KeyA', true); // auto-repeat while held
    expect(input.beginFrame().leftPressed).toBe(false);
    input.keyUp('KeyA');
    input.keyDown('KeyA', false);
    expect(input.beginFrame().leftPressed).toBe(true);
  });

  it('drops unconsumed presses when the mode changes', () => {
    const input = new InputState();
    input.setMode('timing');
    input.keyDown('KeyD', false);
    input.setMode('lanes');
    input.setMode('timing');
    expect(input.beginFrame().firePressed).toBe(false);
  });

  it('counts a button pressed during timing and still held, for the boss "held through FIRE" rule', () => {
    const input = new InputState();
    input.setMode('timing');
    input.keyDown('KeyA', false);
    expect(input.beginFrame()).toMatchObject({ firePressed: true, fireHeld: true });
    expect(input.beginFrame()).toMatchObject({ firePressed: false, fireHeld: true }); // holding is not a fresh press
    input.keyUp('KeyA');
    expect(input.beginFrame().fireHeld).toBe(false);
  });

  it('does not count a lane key still held from dodging as held at FIRE', () => {
    const input = new InputState();
    input.setMode('lanes');
    input.keyDown('KeyD', false);
    input.beginFrame();
    input.setMode('timing'); // still holding D from the last lane change
    expect(input.beginFrame()).toMatchObject({ firePressed: false, fireHeld: false });
  });

  it('forgets everything when the window loses focus', () => {
    const input = new InputState();
    input.setMode('timing');
    input.keyDown('KeyA', false);
    input.clear();
    const s = input.beginFrame();
    expect(s.fireHeld).toBe(false);
    expect(s.firePressed).toBe(false);
  });

  it('continues an instruction card with either button, once, without leaking into gameplay', () => {
    for (const key of ['KeyA', 'KeyD']) {
      const input = new InputState();
      input.keyDown(key, false);
      input.keyUp(key); // both events may arrive before the next render frame
      expect(input.consumeContinuePress()).toBe(true);
      expect(input.consumeContinuePress()).toBe(false);
      input.setMode('lanes');
      expect(input.beginFrame().leftPressed || input.beginFrame().rightPressed).toBe(false);
    }
  });

  it('a press of both buttons at once continues only once', () => {
    const input = new InputState();
    input.keyDown('KeyA', false);
    input.keyDown('KeyD', false);
    expect(input.consumeContinuePress()).toBe(true);
    expect(input.consumeContinuePress()).toBe(false);
  });

  it('requires a fresh press after a key held across the instruction boundary', () => {
    const input = new InputState();
    input.setMode('lanes');
    input.keyDown('KeyA', false);
    input.setMode('none'); // stage entry drops the old edge but preserves physical held state
    input.keyDown('KeyA', true);
    expect(input.consumeContinuePress()).toBe(false);
    input.keyUp('KeyA');
    input.keyDown('KeyA', false);
    expect(input.consumeContinuePress()).toBe(true);
    input.keyDown('KeyA', true);
    expect(input.consumeContinuePress()).toBe(false);
  });

  it('does not steal presses from active gameplay', () => {
    const input = new InputState();
    input.setMode('timing');
    input.keyDown('KeyA', false);
    expect(input.consumeContinuePress()).toBe(false);
    expect(input.beginFrame().firePressed).toBe(true);

    input.setMode('lanes');
    input.keyDown('KeyD', false);
    expect(input.consumeContinuePress()).toBe(false);
    expect(input.beginFrame().rightPressed).toBe(true);
  });

  it('clears pending card presses on focus loss', () => {
    const input = new InputState();
    input.keyDown('KeyA', false);
    input.clear();
    expect(input.consumeContinuePress()).toBe(false);
  });
});
