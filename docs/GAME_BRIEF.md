# Duck Run — shared game design and implementation brief

## 1. Authority and scope

Build a funny, colourful **3D browser game** for a **24-hour JPMorgan hackathon**. Four developers start initially; a fifth joins later. Target a successful run of approximately **3–4 minutes**.

This document consolidates Zubair's confirmed Dollar Duck brief and subsequent Duck Run updates. It replaces the older Two Keys design previously in this file. Confirmed mechanics below take precedence over older flight, boost-gate, A/D-only, and boss-circle designs.

Read this with [ADDITIONAL_INFO.md](../ADDITIONAL_INFO.md) for clarification details and [TEAM_SPLIT.md](TEAM_SPLIT.md) for ownership. The confirmed addendum updates are already incorporated here. Flag future contradictions rather than silently selecting a rule.

Technical recommendations and unresolved decisions are labelled separately. This documentation update does not instruct AI assistants to start implementation without an assigned task.

## 2. Concept and complete run

The player is **Bill, a duck wearing a suit**, running on water, entering a submarine, being lured back up by money, and fighting a pigeon with a shotgun.

| Order | Stage | Confirmed behaviour |
| --- | --- | --- |
| 1 | Runner 1 | Third-person automatic water running in three lanes; dodge branches with A/D. |
| 2 | Submarine entry | Reach an open submarine top hatch and enter. No fishing hook here. |
| 3 | Underwater | First-person submarine viewport; automatic travel/alignment; Space-only circle timing for boosts; separate oxygen. |
| 4 | Surface transition | A fishing hook with a dollar attracts Bill; his eyes become dollar signs, he grabs the dollar, and is pulled up. |
| 5 | Runner 2 | Return to three-lane water running; dodge branches and collect breadcrumbs for score. |
| 6 | Optional heart | A clearly visible heart in one lane near the boss adds one life if collected. |
| 7 | Pigeon boss | Dodge three player-targeted single bullets, then react to Ready → Aim → green Fire during reload to attack with Space. |
| 8 | Results | Show latest attempt, personal best, room leaderboard, and score/completion time for successful runs. |

Travel stages end at **fixed distances**, never score thresholds. The old 50,000-point space transition is removed; the submarine replaces space/flight. Both runners are confirmed stages. Do not silently remove stages under the old cut list.

## 3. Inputs — confirmed

At most **two gameplay buttons may be available at any stage**. This is not a limit of two different keys across the whole game.

| State | Active gameplay inputs | Disabled inputs |
| --- | --- | --- |
| Runner 1 / Runner 2 | A and D | Space |
| Underwater timing | Space | A and D |
| Boss shooting/dodging | A and D | Space |
| Boss reload/attack | Space | A and D |
| Countdown/transitions/results | None | All gameplay inputs |

Never enable A, D, and Space together. The duck cannot move during the boss attack window, and no bullet may remain capable of damaging it then.

Menu buttons handle joining, host start, and retry outside active gameplay. Do not add a gameplay reset hotkey until organiser rules for non-gameplay inputs are confirmed. Browser reload is not an in-game retry implementation. Touch controls remain to be agreed.

Centralise input routing. Track fresh keydown edges separately from held state, ignore keyboard repeat, clear state on focus loss, and prevent Space scrolling while playing. Prevent stale presses from leaking into another phase. Preserve enough held-state information to enforce the boss hold penalty; clearing pending events must not turn a held key into a fresh press.

## 4. Runners and shared lives — confirmed

- Third-person view, three lanes, automatic forward motion, A/D lane changes.
- Bill runs on the **water surface**, dodging branches lying across his path.
- Naturally accelerate towards a normal maximum speed.
- A damaging runner collision removes **one life** and reduces current speed by **30%**, then normal acceleration resumes.
- Every damaging runner/boss hit grants **one second of invulnerability**. Overlapping hits during that second cannot remove additional lives.
- Start each attempt with **three lives**. Zero lives fails the attempt.
- Lives persist through the submarine, Runner 2, and the boss. Oxygen neither replaces nor resets them.
- Neither runner has boost gates in the initial design.
- Runner 2 adds breadcrumbs for **score only**, never extra speed.
- The optional heart adds exactly **one life**, once per attempt, only when collected. An untouched player can reach four lives.
- There is **no automatic boss-entry healing**.

Recommended implementation: one lane per fresh A/D press, short interpolation, no movement outside the lanes, and simple collision boxes/spheres rather than full mesh physics. Exact movement speeds, acceleration, obstacle spacing, and distances need tuning.

## 5. Underwater — confirmed

- First-person submarine cockpit/viewport; automatic travel over a fixed distance.
- Automatic alignment with timing challenges; no steering. Only Space is active.
- Display a static target circle and a larger circle closing towards it.
- Live accuracy rises towards alignment, reaches **100%**, then decreases if the circle passes the target.
- Freeze/show achieved accuracy when pressed.
- **One attempt per timing window.** Early presses consume it; holding/mashing cannot create further attempts.

| Accuracy/outcome | Effect |
| --- | --- |
| 90–100% | Strong temporary boost |
| 50–89% | Smaller temporary boost |
| Below 50% | Lose one oxygen bubble; no new boost |
| No press before expiry | Lose one oxygen bubble; no new boost |

These thresholds are agreed starting points, subject to playtesting. Define treatment of fractional percentages consistently before implementation.

Start underwater with **three oxygen bubbles**, separate from lives. Zero oxygen fails the **entire run**. There is no passive oxygen drain.

Boosts exceed regular underwater speed. Failure does not cancel an existing boost; it expires at its original time. Recommended successful-boost rule: replace/refresh based on the latest result, never accumulate unlimited speed. Exact speeds, durations, and timing-window cadence remain open.

Require a fresh press after entry and between windows. Holding Space before a window does not count; if never released and freshly pressed, the window expires and costs one bubble. This differs from the boss hold penalty.

## 6. Pigeon boss — confirmed

The boss is a **pigeon holding a shotgun**, with **30,000 starting health**. Score scale does not change boss health.

### Shooting/dodging

1. Fire **three shots**, with **one bullet per shot**, targeting the player.
2. Allow A/D lane dodges; disable Space.
3. Give readable wind-up and enough travel time to dodge. Do not implement shotgun spread.
4. Hits remove one shared life and grant one second of invulnerability.
5. Finish/clear the volley before enabling attack. No bullet may damage the stationary attacker.

Targeting the player is confirmed; when the target lane is sampled and whether bullets track after firing remain unresolved. A proposed interpretation is to aim at the player's lane when fired, then travel straight. This is not yet agreed.

### Reload/attack

1. Disable A/D. **Space alone** is active.
2. Show **Ready**, then **Aim**, then **Fire**, with **Fire in green**.
   Ready lasts one second; Aim lasts at least one second, then continues for a newly sampled random wait before Fire. The extra 0.25–1.5-second range is tuning, not a fixed rhythm.
3. The player reacts to green Fire with a fresh Space press.
4. A valid laser attack has **100% accuracy**. Damage depends on reaction delay from the green prompt; faster reactions deal more damage.
5. A fresh Ready/Aim press ends the attack for **1 damage**. Space already held when Fire appears also ends it for **1 damage**. This supersedes the earlier Miss/zero rule; held keys cannot produce a full reaction attack.
6. Resolve damage once per reload window. Repeated presses/keyboard repeat cannot produce extra attacks.
7. Repeat until the boss is defeated or the attempt fails.

The boss does **not** use the submarine circles. The old perfect/imperfect damage table, held-key damage of 10, no-press damage of 1, and guaranteed three-perfect-attack kill are superseded.

### Decisions needed before boss timing implementation

- Fire expiry, the no-response outcome, and tuning of the random pre-Fire wait.
- Minimum/maximum damage and reaction-delay-to-damage formula.
- Exact targeting behaviour, shot cadence, and projectile speed.

## 7. Score, completion, and results

- **300,000 points is the maximum attainable score.** Scale scoring contributions relative to that cap.
- Success means completing the whole game, including defeating the boss.
- Successful results display **score and time taken to complete**.
- Retain latest attempt, personal best, and room leaderboard displays.
- Breadcrumbs award score only. Score never controls stage transitions.

Still unresolved: scoring weights/formula; whether a perfect run is required for 300,000; whether underwater accuracy, reaction damage, lives, or time affect points; failed-attempt scoring; primary leaderboard ordering; ties; personal-best replacement; timer boundaries; transition/pause/focus treatment.

The older fastest-time-only ranking and never-pausing tick timer are not established as confirmed rules by the updated brief.

## 8. Team ownership

See [TEAM_SPLIT.md](TEAM_SPLIT.md) for the full current split.

- **Tejas:** core setup, both runners, Bill, integration/merges, all lobby UI, HUD.
- **Mayank + Rayyan:** backend pair. Mayank owns Supabase setup, security rules, room logic, live scoreboard, deployment. Rayyan owns network code, offline mode, progress updates, course generator, results.
- **Zubair:** shared timing ring, underwater, submarine/dollar-hook transitions, pigeon boss. The boss reaction prompt does not use the ring.
- **Vansh (joins later):** all tests/sound, Bill's new poses, game feel, browser testing, balancing, demo.

Coordinate shared types, phase routing, input gating, life/oxygen updates, scoring, and network contracts with their owners. Exact file ownership/interfaces remain open; the old generic Dev 1–5 split is superseded.

## 9. Existing code and engineering recommendations

### Present in the merged checkout

The dev integration now also includes Tejas's core controller, input routing, runners, lobby, and tests. Read `client/src/core/types.ts`, `client/src/core/config.ts`, and `client/src/phases/registry.ts` for actual contracts. `PROJECT_BRIEF.md` preserves the original full implementation brief; `DUCK_RUN_ADDENDUM.md` carries the current clarifications. The gameplay base in `src/sim/` still needs phase adapters; see [ZUBAIR_BASE.md](ZUBAIR_BASE.md).

- TypeScript/Vite/Three.js client setup: `client/package.json`.
- Bill's primitive-based character: `client/src/render/character.ts`.
- Browser preview: `client/character-preview.html` and `client/src/dev/character-preview.ts`.
- Character reference: [CHARACTER.md](character/CHARACTER.md).

The character files are assets/setup; the dev checkout also has the core, runner, and lobby implementation described above. A legacy fly pose does not restore the flight stage. Keep character appearance independent from gameplay collision shapes.

### Recommendations retained for team agreement

The earlier engineering plan proposed these approaches. Coordinate them with current owners; they are not implemented or final contracts merely because they appear here:

- Separate simulation, rendering, input routing, networking, and UI.
- Fixed 60-tick simulation with render interpolation. Keep rendering/DOM separate from gameplay rules. If deterministic replay is adopted, use seeded gameplay randomness and recorded input ticks rather than wall-clock time or unseeded randomness in simulation.
- Common section lifecycle such as `enter`, `step`, `isComplete`; Tejas's central run controller owns transitions and shared state.
- Explicit gameplay events so rendering/networking do not duplicate rules.
- Distance-based obstacle placement and validated courses with a reachable safe route at the actual maximum runner speed; Rayyan owns the generator.
- Separate gameplay/cosmetic randomness if seeded courses are adopted.
- Attempt identifiers to reject stale updates from earlier retries.
- Meaningful invariant checks and replay checks if determinism is adopted; coordinate testing with Vansh.

The earlier FastAPI/WebSocket/SQLite backend and example protocol are **not current agreed requirements**. The updated split assigns Supabase setup to Mayank. Mayank and Rayyan must agree the backend/network contract before integration; do not build a competing backend from the old document.

The old LEFT/RIGHT-only and FLIGHT simulation examples are not valid contracts for Space input, oxygen, transitions, or reaction-based boss attacks. Use the actual dev contracts in `client/src/core/types.ts`; coordinate any changes with Tejas.

## 10. Open systems and proposals

The following appeared in earlier planning or remain unspecified; do not present them as confirmed scope:

- Shared-course seed policy; identical courses across players/attempts.
- Independent local races versus other multiplayer interaction; exact room, countdown, late-join, retry, reconnect, offline behaviour.
- Ghost replay/storage, race-view routes, QR joining, splits, replay verification.
- Leaderboard persistence/validation, identity, ranking, ties.
- Final hosting, network transport/protocol, touch controls, sound library, test tooling.
- Stage distances/durations, submarine boost/window tuning, difficulty, focus/pause behaviour, transition choreography, failure/victory animations.

Named owners remain responsible for their assigned features. Unresolved implementation details do not remove those features from scope. Ask focused questions when a decision becomes necessary.

## 11. Verification expectations

Coordinate implementation/tests with Vansh. Verify confirmed rules rather than preserving obsolete expectations:

- Per-phase inputs; no stale/repeated attack or boost.
- One life per damaging hit, one-second invulnerability, 30% runner speed reduction.
- Persistent lives; separate oxygen; three oxygen losses fail the run.
- Heart grants one life only on collection, once; no automatic boss healing.
- Underwater thresholds, one attempt/window, fresh presses, existing boosts survive failures.
- Three single player-targeted bullets/cycle; no damaging bullets during attack.
- Green Fire reaction timing; faster valid reactions deal more damage; early presses or Space held when Fire appears end the attack for one damage.
- Completion displays score/time; scoring respects 300,000 once the formula is agreed.
- Room, scoring, retry, persistence checks after their contracts are agreed.

Do not encode unresolved penalties, damage numbers, or ranking rules in tests as approved requirements.

## 12. Instructions for AI coding assistants

- Read this brief, the addendum, team split, and relevant code before implementing an assigned task.
- Implement only assigned scope; coordinate shared interfaces/cross-owner edits.
- Follow per-phase A/D/Space rules; do not restore A/D-only controls.
- Preserve confirmed stages/mechanics rather than redesigning to match older code/docs.
- Distinguish recommendations and unresolved choices from confirmed requirements; ask when a missing decision blocks work.
- Do not add unapproved ghost systems, accounts, actions, backend services, or scoring formulas.
- Keep secrets out of Git. Make small changes, review scope, and report appropriate verification.
