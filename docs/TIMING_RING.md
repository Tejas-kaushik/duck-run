# Underwater timing ring — gameplay logic

> Historical design: this implementation was removed after the A/D lane swim replaced the timing ring. See `DESIGN_CHANGES.md` and `client/src/phases/underwater/SwimPhase.ts` for current gameplay.

The implementation is `client/src/sim/timing-ring.ts`. It has no UI, renderer, keyboard listener, or system clock. Tejas owns the frontend; the standalone timing-preview page has been removed.

## API

- `createTimingWindow(durationMs = 3000)`: create one unresolved window.
- `advanceTimingWindow(window, deltaMs)`: advance from the caller's gameplay clock; expiry resolves once.
- `getTimingAccuracy(window)`: live accuracy, or the frozen accuracy after resolution.
- `pressTimingWindow(window)`: resolve a fresh press once; return null for further attempts.

A result contains accuracy, outcome (`strong-boost`, `small-boost`, `oxygen-loss`), and reason (`pressed`, `expired`).

## Provisional tuning

Alignment is halfway through the window. Accuracy rises linearly to 100%, then falls to zero:

`100 × (1 − |elapsed − halfway| / halfway)`

Clamp to at least zero and round down to a whole percentage. The displayed integer must also be used for reward thresholds. The duration, curve, and rounding are adjustable implementation choices, not additional confirmed requirements.

For a 3,000 ms window, a press at 1,350 ms achieves 90% and gives the strong-boost outcome. At the deadline, expiry wins. A resolved window freezes its elapsed time and result.

## Frontend integration

Tejas draws the stationary target and shrinking circle from the same elapsed time used by the model. For example, with progress `elapsedMs / durationMs`, an approach radius `142 − 120 × progress` crosses a target radius of 82 at halfway. Those radii are only an example.

The central input router must pass fresh Space edges only, ignore repeat, prevent Space scrolling during play, and clear stale events across phases. Holding Space before a window is not a fresh press.

Use the underwater controller in [ZUBAIR_BASE.md](ZUBAIR_BASE.md) to apply oxygen/boost effects. Do not apply the timing result again in the UI. The boss uses Ready/Aim/Fire rather than this ring.

Presentation explanation: “Accuracy comes from the press's distance in time from perfect alignment. A resolved window locks its result, preventing mashing. The rules are separate from drawing and input, so Tejas can build the visuals without duplicating gameplay logic.”
