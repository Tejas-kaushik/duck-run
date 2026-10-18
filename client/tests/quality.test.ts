import { describe, expect, it } from 'vitest';
import { QUALITY, shouldStepDown, startingQuality } from '../src/render/pipeline';

describe('adaptive render quality', () => {
  it('goes from best to cheapest', () => {
    expect(QUALITY.map((q) => q.name)).toEqual(['high', 'medium', 'low']);
    const low = QUALITY[QUALITY.length - 1];
    expect(low.bloomScale).toBe(0);
    expect(low.shadowSize).toBe(0);
    expect(low.samples).toBe(0);
  });

  it('only steps down after a sustained run of slow frames', () => {
    expect(shouldStepDown(Array(30).fill(40))).toBe(false); // not enough frames yet
    expect(shouldStepDown(Array(90).fill(16.7))).toBe(false); // 60 fps is fine
    expect(shouldStepDown(Array(90).fill(33))).toBe(true); // 30 fps is not
    // A few long hitches (GC, shader compile) in an otherwise smooth run don't count.
    expect(shouldStepDown([...Array(80).fill(16.7), ...Array(10).fill(200)])).toBe(false);
  });

  it('starts phones and huge screens a level down, and honours ?quality=', () => {
    expect(startingQuality('', false, 1920 * 1080)).toBe(0);
    expect(startingQuality('', true, 1920 * 1080)).toBe(1);
    expect(startingQuality('', false, 3840 * 2160)).toBe(1);
    expect(startingQuality('?quality=low', false, 1920 * 1080)).toBe(2);
    expect(startingQuality('?quality=nonsense', false, 1920 * 1080)).toBe(0);
  });
});
