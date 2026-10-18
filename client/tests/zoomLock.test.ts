// No zooming on phones (Tejas): pinches and the second tap of a double-tap are cancelled; text fields
// and ordinary single taps are left alone.

import { describe, expect, it } from 'vitest';
import { DOUBLE_TAP_MS, lockZoom } from '../src/ui/zoomLock';

/** A cancelable event, optionally with touches and a target element. */
function fire(target: EventTarget, type: string, extra: { touches?: number; on?: { tagName: string } } = {}): boolean {
  const e = new Event(type, { cancelable: true });
  if (extra.touches !== undefined) Object.defineProperty(e, 'touches', { value: { length: extra.touches } });
  if (extra.on) Object.defineProperty(e, 'target', { value: extra.on });
  target.dispatchEvent(e);
  return e.defaultPrevented;
}

describe('zoom lock', () => {
  it("cancels iPhone Safari's pinch gestures and double-clicks", () => {
    const page = new EventTarget();
    lockZoom(page, () => 0);
    expect(fire(page, 'gesturestart')).toBe(true);
    expect(fire(page, 'gesturechange')).toBe(true);
    expect(fire(page, 'dblclick')).toBe(true);
  });

  it('cancels two-finger moves but not one-finger scrolling', () => {
    const page = new EventTarget();
    lockZoom(page, () => 0);
    expect(fire(page, 'touchmove', { touches: 2 })).toBe(true);
    expect(fire(page, 'touchmove', { touches: 1 })).toBe(false);
  });

  it('cancels only the second tap of a quick double-tap', () => {
    const page = new EventTarget();
    let t = 1000;
    lockZoom(page, () => t);
    const button = { tagName: 'BUTTON' };
    expect(fire(page, 'touchend', { on: button })).toBe(false); // first tap
    t += DOUBLE_TAP_MS - 50;
    expect(fire(page, 'touchend', { on: button })).toBe(true); // too soon: would zoom
    t += DOUBLE_TAP_MS + 50;
    expect(fire(page, 'touchend', { on: button })).toBe(false); // a fresh tap
  });

  it('leaves double-taps in text fields alone (selecting a word in your nickname)', () => {
    const page = new EventTarget();
    let t = 0;
    lockZoom(page, () => t);
    const input = { tagName: 'INPUT' };
    fire(page, 'touchend', { on: input });
    t += 100;
    expect(fire(page, 'touchend', { on: input })).toBe(false);
  });

  it('can be removed again', () => {
    const page = new EventTarget();
    const unlock = lockZoom(page, () => 0);
    unlock();
    expect(fire(page, 'gesturestart')).toBe(false);
  });
});
