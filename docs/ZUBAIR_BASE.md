# Zubair's gameplay base — handoff to Tejas

> Historical handoff: the underwater and timing-ring modules described below were removed after the swim redesign. Use `phases/underwater/SwimPhase.ts` for current underwater gameplay and see `DESIGN_CHANGES.md`. The boss module and its rendering adapter remain active.

These modules contain gameplay state and rules only. **Tejas owns all frontend presentation for this contribution:** scenes, cameras, submarine/pigeon models, animations, timing-ring drawing, prompt text, HUD, and input wiring. No existing frontend or shared controller files are changed.

## Files

| Module | Responsibility |
| --- | --- |
| `client/src/sim/timing-ring.ts` | One underwater timing attempt, accuracy, result locking, expiry. |
| `client/src/sim/underwater.ts` | Fixed-step underwater travel, oxygen, boost replacement/expiry, completion/failure events. |
| `client/src/sim/boss.ts` | Three-shot volley bookkeeping, projectile-clear gate, Ready/Aim/Fire timing, attack damage and boss HP. |

Each module owns its own state. They do not access the DOM, Three.js, network, keyboard, or wall-clock time. Tejas adapts them to his shared controller; these are local module interfaces, not replacements for team-wide types/protocols.

The dev merge now includes actual contracts in `client/src/core/types.ts` and registration in `client/src/phases/registry.ts`. Phase updates use seconds; this underwater base uses 60 Hz ticks, and boss advance uses milliseconds. The adapters must convert these units explicitly. Consume each fresh `ctx.input.spacePressed` once, even when several simulation ticks run in one frame.

Route underwater oxygen-loss events through `ctx.loseOxygen()`, progress through `ctx.setPhaseProgress()`, and terminal events through the central controller. Do not subtract oxygen both from the callback and directly from shared run state. For boss results, call `ctx.damageBoss(result.damage)` once to mirror the local boss model into shared health; do not subtract again directly. Central lives/invulnerability remain in `ctx.damagePlayer()`. The base is not wired into the phase registry by this merge; existing placeholders remain until Tejas adds the adapters/frontend.

## Underwater

```ts
import { createUnderwater, stepUnderwater, UNDERWATER_TICK_MS } from './sim/underwater';
import { getTimingAccuracy } from './sim/timing-ring';

const underwater = createUnderwater();
// From the central controller, once per 60 Hz gameplay tick:
const events = stepUnderwater(underwater, freshSpacePress);
const accuracy = getTimingAccuracy(underwater.timing);
const ringProgress = underwater.timing.elapsedMs / underwater.timing.durationMs;
const stageProgress = underwater.distance / underwater.tuning.distance;
```

`freshSpacePress` is supplied by the input router, not a held/repeated key. Consume each edge on one tick only; do not pass it to every catch-up tick. A/D have no effect here. Clear old input edges on stage entry, without converting a physically held key into a fresh press. `UNDERWATER_TICK_MS` is 1000/60; use an accumulator if rendering has a different rate. Do not also advance the ring separately: `stepUnderwater` already does so.

Read `oxygen`, `speed`, `distance`, `windowNumber`, and `timing` to render. A resolved ring remains frozen until the next window. If a press occurs on the old window's deadline, expiry wins; a new window opens after processing that tick, and requires a subsequent fresh edge.

Events are returned **once** by the step that produces them:

- `timing-result`: already applied to boost/oxygen; use it for visual/audio feedback only.
- `failed` with reason `oxygen`: fail the whole attempt through the central controller.
- `complete`: request the dollar-hook transition through the central controller.

Terminal stages stop moving and emit no further events. This module never reads, heals, or resets runner/boss lives. It does not award points because the scoring formula is undecided.

### Adjustable development defaults

600-unit route; speed 20 units/s; small/strong boosts 28/36 units/s; boost 120 ticks (2 s); timing window 180 ticks (3 s); gap 60 ticks (1 s). All are provisional. Pass a complete `UnderwaterTuning` to `createUnderwater` to tune them. Three starting oxygen bubbles and the agreed timing thresholds are preserved.

Success replaces/refreshes the boost using the latest result; it does not stack. Failure leaves the active boost and its original expiry untouched. Oxygen is consumed only by a failed/expired window.

## Boss

`createBoss(rules)` requires Ready/Aim/Fire durations, a `damageForReaction(reactionMs)` function, and `noPressDamage`. **No production damage curve or no-response damage is guessed.** Agree these before supplying production rules. Faster valid reactions must receive greater or equal damage.

1. Create the boss. It starts at 30,000 HP in `volley`.
2. After each readable wind-up, call `fireBossShot(boss)`. It returns a unique projectile ID, or null if firing is disallowed. Render one player-targeted bullet per returned ID. There are exactly three accepted shots per volley.
3. Handle each bullet's flight/collision. Send hits to the shared life/invulnerability controller. Only call `resolveBossProjectile(boss, id)` once that bullet can no longer damage the player. Duplicate/stale IDs are ignored.
4. Call `beginBossReload(boss, fireDelayMs)`. It returns false until all three shots have fired and all projectile IDs are resolved. Sample the delay once per cleared volley, not once per frame. BossPhase uses the seeded boss RNG and config's extra 0.25–1.5-second range. Ready lasts one second; Aim lasts at least one second and remains visible during the random wait. On success, disable A/D, enable Space, and start reading `getBossPrompt(boss)`. Omitting the delay defaults to zero for other callers/tests.
5. Advance with `advanceBossReload(boss, elapsedMs, spaceHeld)`. Pass elapsed gameplay time since the previous advance, not total elapsed time. The prompt is `ready`, `aim`, or `fire`; render Fire in green. Use the same clock for visible prompts and timing.
6. For a fresh Space keydown, first advance to that input's time using the held state **before** the edge, then call `pressBossAttack(boss)`. This prevents a fresh Fire press from being mistaken for a previously held key. Ignore keyboard repeat.
7. A non-null return from either advance/press is the one attack result. HP is already updated; use the result for feedback, not another subtraction.
8. After feedback, call `beginNextBossVolley(boss)`. It resets the volley only after a resolved attack. It returns false if the boss is defeated. When phase becomes `defeated`, the central controller handles victory once.

An early Ready/Aim press ends the attack and deals **1 damage**. Space already held when Fire begins also ends the attack and deals **1 damage**, replacing the older Miss/zero rule. A valid Fire press always hits; the supplied reaction curve determines damage. Attacks lock after resolution; repeated calls do not damage again. HP cannot drop below zero.

The frontend must report projectile clearance honestly: the base cannot know whether a rendered bullet is still dangerous. Shot spacing/wind-up, target-lane sampling/tracking, projectile motion, collision shapes, and the shared one-second hit invulnerability need integration. Targeting policy and numeric tuning remain to be agreed; this base does not silently choose homing or lane locking.

## Transitions and remaining integration

Tejas renders the hatch entry and dollar-hook animations, disabling gameplay inputs throughout. The central controller starts underwater after hatch entry completes, and starts Runner 2 after the hook animation completes. Zubair's underwater completion event supplies the second transition trigger; the first comes from Runner 1's distance completion. There is no transition animation code or timer policy imposed here.

Connect the base to the shared lives/HUD, results, 300,000-point scoring scheme, and run controller once those interfaces are agreed. No module creates rooms, changes another player's run, or implements persistence.

For learning: [TIMING_RING.md](TIMING_RING.md) explains the accuracy calculation. The important distinction is that the simulation decides outcomes, while the frontend displays those outcomes and supplies correctly timed input.
