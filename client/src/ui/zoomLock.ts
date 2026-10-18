// No zooming on phones (Tejas). Double-tapping near the lane buttons, or a stray pinch mid-run, zoomed
// the whole page in. The viewport meta (index.html) asks for no zoom, and lobby.css/ui.css only allow
// panning, but iPhone Safari ignores user-scalable=no, so this blocks its pinch gestures and the
// second tap of a double-tap too. Text fields still behave normally.

/** Two taps closer together than this would zoom on iPhone. */
export const DOUBLE_TAP_MS = 300;

const isTextField = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable === true);
};

/** Returns a function that removes the listeners again. */
export function lockZoom(target: EventTarget = document, now: () => number = () => performance.now()): () => void {
  const block = (e: Event) => e.preventDefault();
  const noPinch = (e: Event) => {
    if ((e as TouchEvent).touches?.length > 1) e.preventDefault(); // two fingers = a pinch
  };
  let lastTapEnd = -Infinity;
  const noDoubleTap = (e: Event) => {
    const t = now();
    if (t - lastTapEnd < DOUBLE_TAP_MS && !isTextField(e.target)) e.preventDefault();
    lastTapEnd = t;
  };

  const active = { passive: false } as const;
  const listeners: [string, (e: Event) => void][] = [
    // iPhone Safari's pinch-zoom arrives as these non-standard gesture events.
    ['gesturestart', block],
    ['gesturechange', block],
    ['gestureend', block],
    ['touchmove', noPinch],
    ['touchend', noDoubleTap],
    ['dblclick', block],
  ];
  for (const [type, fn] of listeners) target.addEventListener(type, fn, active);
  return () => {
    for (const [type, fn] of listeners) target.removeEventListener(type, fn);
  };
}
