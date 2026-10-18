import { describe, expect, it } from 'vitest';
import { FixedStep } from '../src/core/fixedStep';

const run = (step: FixedStep, dt: number, press: boolean) => {
  const presses: boolean[] = [];
  step.advance(dt, press, (p) => presses.push(p));
  return presses;
};

describe('FixedStep (ZUBAIR_BASE.md: one fresh press = one tick)', () => {
  it('runs one tick per 1/60 s, carrying leftovers', () => {
    const step = new FixedStep(1 / 60);
    expect(run(step, 1 / 120, false)).toHaveLength(0);
    expect(run(step, 1 / 120 + 1e-9, false)).toHaveLength(1);
    expect(run(step, 3 / 60 + 1e-9, false)).toHaveLength(3);
  });

  it('gives a press to the first tick only when a frame runs several ticks', () => {
    const step = new FixedStep(1 / 60);
    expect(run(step, 3 / 60 + 1e-9, true)).toEqual([true, false, false]);
  });

  it('keeps a press for the next tick when a frame runs no ticks', () => {
    const step = new FixedStep(1 / 60);
    expect(run(step, 1 / 240, true)).toEqual([]);
    expect(run(step, 1 / 60, false)).toEqual([true]);
    expect(run(step, 1 / 60, false)).toEqual([false]);
  });
});
