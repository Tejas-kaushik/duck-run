import { describe, expect, it } from 'vitest';
import { LaneMover } from '../src/core/LaneMover';
import type { InputSnapshot } from '../src/core/types';

const press = (left: boolean, right: boolean): InputSnapshot => ({
  leftPressed: left,
  rightPressed: right,
  firePressed: false,
  fireHeld: false,
});

describe('LaneMover', () => {
  it('moves one lane per press and never leaves the lanes', () => {
    const m = new LaneMover([-2.5, 0, 2.5], 0.15);
    expect(m.lane).toBe(1);
    m.handle(press(true, false));
    expect(m.lane).toBe(0);
    m.handle(press(true, false));
    expect(m.lane).toBe(0);
    m.handle(press(false, true));
    m.handle(press(false, true));
    m.handle(press(false, true));
    expect(m.lane).toBe(2);
  });

  it('switches the collision lane at once but slides the drawn position', () => {
    const m = new LaneMover([-2.5, 0, 2.5], 0.15);
    m.handle(press(false, true));
    expect(m.lane).toBe(2);
    expect(m.x).toBe(0);
    m.update(0.075);
    expect(m.x).toBeGreaterThan(0);
    expect(m.x).toBeLessThan(2.5);
    m.update(0.1);
    expect(m.x).toBe(2.5);
    expect(m.direction).toBe(0);
  });

  it('cancels out when both keys are pressed in the same frame', () => {
    const m = new LaneMover();
    expect(m.handle(press(true, true))).toBe(0);
    expect(m.lane).toBe(1);
  });
});
