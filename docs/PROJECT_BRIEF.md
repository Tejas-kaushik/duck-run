# Dollar Duck — team implementation brief

> ⚠️ **Read `docs/DUCK_RUN_ADDENDUM.md` too.** The game is now called **Duck Run**. The addendum replaces this brief's boss attack (§6: no closing circle for the boss, a Ready → Aim → Fire reaction prompt instead), makes boss bullets target the player, and caps the score at **300,000**. Where the two disagree, the addendum wins. Names and roles are in `docs/TEAM_SPLIT.md`.

## 1. Purpose and authority

Working title: **Dollar Duck**. Build a funny, colourful 3D browser game for a 24-hour JPMorgan hackathon. Four developers start now; a fifth joins later. Target a successful run of approximately 3–4 minutes.

This is the shared handoff document for teammates and their Claude Code/Codex assistants. No gameplay code has been built as part of this planning task. The owner has requested this brief so the team can begin assigned implementation work.

**Confirmed requirements** below reflect the agreed design. Technical choices, numeric tuning defaults, and operational defaults are recommendations selected to make development actionable; they can be adjusted together without changing the confirmed mechanics. Do not silently redesign confirmed mechanics.

## 2. Core concept and complete run

The player is a **duck wearing a suit**, running on water, diving into a submarine, being lured back up by money, and fighting a pigeon with a shotgun.

1. **Runner 1:** automatically run on water in three lanes; dodge branches using A/D. No boost gates.
2. **Submarine entry:** reach an open submarine top hatch and enter. No fishing hook at this transition.
3. **Underwater:** first-person submarine view; automatic travel and alignment. Time Space presses against closing circles to boost. Oxygen is a separate three-mistake resource.
4. **Surface transition:** after completing underwater distance, a fishing hook with a dollar attracts the duck. Its eyes become dollar signs; it grabs the dollar and is pulled up.
5. **Runner 2:** return to the three-lane water course. Dodge branches and collect breadcrumbs for score.
6. **Heart:** near the boss entrance, an optional heart in a specific lane grants one life if collected.
7. **Boss:** a pigeon with a shotgun fires three single bullets, then reloads. Dodge with A/D during shooting; time a Space-only laser attack during reload.
8. **Results:** show latest attempt, personal best, and room leaderboard.

Travel stages end at **fixed distances**, not score thresholds. The original 50,000-point space transition has been removed; space is replaced by the underwater submarine stage.

## 3. Non-negotiable input rule

**At most two gameplay buttons may be available at any stage. This is not a limit on the total number of different keys used across the whole game.**

| Stage/state | Only active gameplay inputs | Disabled inputs |
| --- | --- | --- |
| Runner 1 / Runner 2 | A and D | Space |
| Underwater timing | Space | A and D |
| Boss shooting/dodging | A and D | Space |
| Boss reload/laser timing | Space | A and D |
| Countdown / transitions / results | None | All gameplay inputs |

Never enable A, D, and Space together. During the attack window the duck cannot dodge, and does not need to: no bullets may remain capable of hitting it during that window.

Menu buttons handle joining, host start, and retry outside active gameplay. Do not add a gameplay reset hotkey until organiser rules for non-gameplay inputs are confirmed. Ctrl+R is a browser reload, not a reliable in-game retry implementation.

Centralise input routing. Track fresh keydown edges and held state separately, ignore keyboard repeat, clear state on focus loss, and prevent Space scrolling while playing. A phase must never accidentally consume an input intended for the preceding phase.

## 4. Runner mechanics and lives — confirmed

- Third-person view, three lanes, automatic forward motion, A/D lane changes.
- Suit-wearing duck runs **on the water surface**, dodging branches lying across its path.
- Naturally accelerate towards a normal maximum speed.
- Collision removes one life and reduces current speed by **30%**, then normal acceleration resumes.
- Grant **one second of invulnerability** after a damaging hit. Multiple overlaps cannot consume multiple lives during that second.
- Start each attempt with **three lives**.
- Runner lives persist through the submarine section and return unchanged for Runner 2. Oxygen does not replace or reset them.
- At zero runner/boss lives, fail the attempt.
- Runner 1 has **no boost gates**.
- Runner 2 adds breadcrumbs for **score only**. They do not increase speed. For the initial build, use natural acceleration in both runners and no runner boost gates.
- Place the heart in one clearly visible lane before the boss. Collecting it grants exactly one life, once per attempt. It is optional and can bring an untouched player from three to **four** lives. There is no automatic boss-entry healing.
- Reaching the boss preserves the remaining lives plus the collected heart, if any.

Recommended movement: one lane per fresh A/D press, short interpolation between lanes, no movement outside lanes. Use simple bounding boxes/spheres for gameplay collision rather than full mesh physics.

## 5. Underwater mechanics — confirmed

- First-person submarine cockpit or viewport; the player pilots from inside.
- Automatic forward travel over a fixed distance; automatically aligned with the timing challenges. No steering.
- Only Space is active.
- Display a static target circle and a larger circle closing towards it.
- Display a live accuracy percentage rising towards alignment, reaching 100%, and decreasing if the circle passes the target.
- Freeze/show the achieved percentage when pressed.
- **One attempt per timing window.** An early press consumes the attempt. Holding/mashing cannot produce additional attempts.

| Timing result | Effect |
| --- | --- |
| 90–100% | Strong temporary boost |
| 50–89% | Smaller temporary boost |
| Below 50% | Lose one oxygen bubble; no boost |
| No press by window expiry | Lose one oxygen bubble; no boost |

These initial thresholds are agreed starting points, subject to playtesting.

Start underwater with **three oxygen bubbles**, separate from lives. At zero oxygen fail the entire run. There is no passive oxygen drain in the initial design; bubbles are consumed by bad/missed timing windows.

Boosts exceed regular underwater speed. A failed attempt does not cancel an existing boost: it expires at its original time, then speed returns to regular speed. Recommended stacking rule: successful attempts replace/refresh the temporary boost, never add unlimited speed; choose a smaller/stronger effect based on the latest result.

Require a fresh press after entry and between windows. Holding Space before a window does not count as a successful attempt; if never released and pressed, that window expires and costs one bubble. This differs deliberately from the boss hold penalty below.

## 6. Boss mechanics — confirmed

- Pigeon holding a shotgun; health starts at **30,000**.
- Duck uses the same three-lane dodge system.
- Each cycle: **three shots**, **one bullet per shot**, then a reload/timing window.
- Bullets must have readable wind-up and enough travel time to dodge. Do not implement a shotgun spread.
- Projectile hits remove one shared life and grant one second of invulnerability.
- Before enabling the attack window, finish/clear the volley so no live bullet can damage a stationary attacker.
- During reload, disable A/D and enable Space alone.
- Show a large closing circle approaching a static small target circle. Press Space at alignment to fire the duck's **laser**.
- Apply damage once, show precision/damage, then return to the next volley if the boss survives.

| Attack outcome | Damage |
| --- | ---: |
| Perfect / 100% accuracy | 10,000 |
| Any other registered press | Proportional to accuracy, minimum 10 |
| Space held when attack window opens | Trigger immediately once for exactly 10 |
| No press throughout the window | Exactly 1 |

Suggested formula for a registered normal press: `max(10, round(10000 * accuracy / 100))`. Held-at-entry and no-input outcomes are separate cases. Three perfect attacks defeat the boss. Clamp displayed boss health to zero and emit victory once.

Use an achievable perfect-timing band rather than equality on a single frame. Calculate precision from elapsed time. The moving ring should pass through alignment before the window ends so late presses lose accuracy too.

## 7. Failure, retry, and clock

- Death from lives or oxygen fails the whole attempt; no checkpoints.
- Retry resets only that player's game, from Runner 1, with three lives, fresh score/time, and the same room course.
- Other players continue unaffected.
- Reset projectiles, pickups, boosts, pending timers, key states, boss health, oxygen, and phase state. Apply the heart at most once per attempt.
- A host starts the initial attempts together using a shared countdown. Individual retries do not require another host start.

Recommended competitive clock: start at the end of countdown/first movement, stop on the defeating boss attack or failure. Include in-run transitions and do not allow pausing the timer during a competitive run. Use a monotonic clock, not accumulated rendered frames. On tab blur clear inputs; warn that the timer continues. Consider lag/background behaviour during playtesting.

## 8. Score, ranking, and pacing defaults

**Confirmed:** track completion time and score; breadcrumbs add score; show a live scoreboard, latest result, and personal best/high score after attempts.

**Recommended initial ranking:** completed attempts ranked by fastest elapsed time, score as a tie-breaker. Display best completed time, highest score, and latest result separately. Failed attempts are labelled failed and do not replace a completed best time. This reconciles speedrunning with breadcrumb collection; confirm with the team before final UI copy.

Recommended initial points: 10 points per unit of travel plus 100 per breadcrumb. No score for farming repeated boss cycles. Freeze distance score at travel-stage bounds. Keep constants configurable. A high-score record should be labelled as completed-only if excluding failed attempts.

Recommended tuning baseline (world units are arbitrary):

| Parameter | Starting value |
| --- | --- |
| Runner lane positions | -2.5, 0, +2.5 |
| Lane-change duration | 0.15 seconds |
| Runner start / maximum speed | 12 / 22 units per second |
| Runner acceleration | 1 unit per second squared |
| Runner 1 distance | 1,400 units, approximately 65–70 seconds without hits |
| Runner 2 distance | 850 units, approximately 40–45 seconds without hits |
| Underwater regular speed | 15 units per second |
| Underwater distance | 1,000 units |
| Smaller / strong underwater boost | 1.25x / 1.5x regular speed for 3 seconds |
| Underwater timing windows | Approximately 10 per course; 2-second ring animation |
| Boss shot cadence | Approximately 1.5 seconds between shots |
| Boss timing window | Approximately 2 seconds |
| Accuracy perfect tolerance | Start at ±0.05 seconds, tune for accessibility |
| Collision invulnerability | 1 second, confirmed |

Keep runner acceleration state across Runner 1 and Runner 2 for the first build; underwater has its own speed. Distances are fixed while durations vary. These numbers are tuning proposals, not promises of an exact run length. Playtest the full run and adjust boss cycle pacing/distances to reach approximately 3–4 minutes without adding excessive waiting.

## 9. Seeded course generation and fairness

**Confirmed:** everyone in one hosted challenge gets the same course and boss behaviour; a retry keeps that course.

- Host creates/stores a seed and game version with the room.
- Use a deterministic seeded random generator, not unseeded `Math.random()` for gameplay.
- Generate a sequence of small, authored obstacle chunks with a guaranteed reachable safe route.
- Validate transitions between chunks and reaction time at maximum speed.
- Place objects by travelled distance, not global wall-clock time.
- Seed breadcrumbs, heart lane, underwater window positions, and boss pattern selection consistently.
- Boss patterns are relative to each player's boss cycle, not host wall-clock time. Players reaching it at different times still receive equivalent patterns.
- Isolate cosmetic randomness from gameplay randomness. Do not consume gameplay random values based on frame rate.
- Store a separate seed per section or derive it from the room seed to prevent one module changing all subsequent generation.
- Avoid impossible all-lane blocks and instant alternating patterns requiring unreachable lane changes.

For the MVP, authored chunks shuffled deterministically are sufficient. Do not build a complex procedural-generation framework.

## 10. Recommended stack — use one consistent stack

**Frontend:** TypeScript + Vite + Three.js.

**Backend:** Supabase Postgres + Realtime, with anonymous authentication for stable player identity. Room code and nickname are the visible login experience; no email/password accounts.

**UI:** normal HTML/CSS overlay for lobby, HUD, scoreboard, and results. Avoid adding React unless the UI owner already knows it and the team agrees before the skeleton is built.

**Deployment:** Vercel static deployment of Vite's `dist/`, with Supabase as the external service.

**Tooling:** Node.js 22 LTS, npm, committed `package-lock.json`, `npm ci` after the initial dependency setup. Standardise scripts: `dev`, `build`, `typecheck`, `test`, and `preview`. Use Vitest for pure timing/damage/generation tests. No physics engine is needed initially.

Use primitive geometry and a consistent cartoon palette first. Suit duck, submarine cockpit, pigeon, shotgun, dollar hook, and laser can be assembled from shapes. Use external assets only with permission/licensing and reasonable file size.

This stack is an actionable recommendation, not something already installed or verified. The integration owner establishes the package files once; teammates should coordinate dependency changes to avoid lockfile conflicts.

## 11. Architecture and shared contracts

The integration owner creates and merges the skeleton **before** phase owners write against it.

Suggested layout and ownership:

```text
src/
  main.ts                    # integration owner
  core/
    Game.ts                  # state machine and lifecycle
    types.ts                 # shared contracts: agree before editing
    Input.ts                 # central input routing
    RunState.ts              # timer, lives, score, attempt reset
    config.ts                # tuning constants
    seededRandom.ts
  phases/
    runner/                  # developer 1
    underwater/              # developer 2
    boss/                    # developer 3
    transitions/             # developer 2, coordinated with integration
  ui/                        # developer 4
  network/                   # developer 4
  assets/                    # developer 5, agreed names/paths
supabase/
  migrations/                # developer 4
```

State flow:

```text
LOBBY -> COUNTDOWN -> RUNNER_1 -> SUB_ENTRY -> UNDERWATER
      -> SURFACE_RETURN -> RUNNER_2 -> BOSS_DODGE
      -> BOSS_ATTACK -> BOSS_DODGE ... -> FINISHED

Any damaging gameplay state -> FAILED when its failure condition is met.
FAILED / FINISHED -> local retry -> COUNTDOWN -> RUNNER_1.
```

Suggested TypeScript contracts:

```ts
type PhaseId = 'runner1' | 'underwater' | 'runner2' | 'boss';
type RunStatus = 'waiting' | 'running' | 'failed' | 'finished';
type InputMode = 'none' | 'lanes' | 'timing';

interface RunState {
  roomId: string;
  playerId: string;
  attemptId: string;
  seed: number;
  phase: PhaseId;
  status: RunStatus;
  elapsedMs: number;
  lives: number;
  oxygen: number;
  score: number;
  phaseDistance: number;
  bossHealth: number;
}

interface Phase {
  enter(): void;
  update(deltaSeconds: number): void;
  exit(): void;
  dispose(): void;
}
```

Before coding phases, agree a context passed into their constructors: shared renderer/scene access, camera ownership, input snapshots, read-only run state access, seeded generator, and callbacks such as `damagePlayer()`, `addScore()`, `completePhase()`, and `failRun(reason)`.

Only the core mutates global lives, timer, phase, and attempt status. Only the core changes input mode. Gameplay phases request those operations through callbacks. Each phase cleans up its objects/listeners on exit/disposal; no independent animation loops or renderers per phase.

Use one animation loop, seconds for delta time, and simple collision volumes. Separate pure calculations from rendering so damage, accuracy, reset, and generation can be tested.

## 12. Multiplayer/backend contract

This is a **live scoreboard**, not networked movement. Do not synchronise duck positions, physics, or every frame.

Recommended tables:

| Table | Important fields |
| --- | --- |
| rooms | id, unique code, host user ID, seed, game version, status, scheduled start time |
| room_players | room ID, user ID, nickname, joined/last-seen timestamps |
| attempts | attempt ID, room/player IDs, status, phase, phase progress, elapsed milliseconds, lives, score, boss health, update timestamp, finish timestamp |

Each retry creates a new attempt ID. Network code ignores stale updates belonging to older attempts. Keep completed records instead of overwriting history with current progress.

- Host alone may schedule the room start/change its challenge.
- Use a server-stored start timestamp several seconds ahead, accounting for client clock offset where practical.
- Approximately once per second publish progress, plus immediate phase/fail/finish updates.
- Subscribe through Supabase Realtime for scoreboard changes.
- Use a seeded local course; server does not send obstacles continuously.
- Rank active progress by phase order, then distance fraction; in boss use health depleted. Rank finishers by elapsed time.
- Display nickname, phase, progress, elapsed time, and running/finished/failed/disconnected status.
- Mark stale presence after a timeout; do not label an old player active forever.
- For MVP, late joiners wait for a new challenge; an already-started player can individually retry.
- For MVP, the host leaving does not cancel ongoing attempts. Host migration can wait.
- New challenge/seed requires an explicit host action; do not reset others when one player retries.

Supabase environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or the provider's public publishable key). Public browser configuration is not an admin credential. Enable row-level security: players can update their own membership/attempts, room members can read their room's data, and host-only actions are enforced server-side. Anonymous authentication must be enabled in Supabase.

Never put a service-role/admin key in frontend code, a `VITE_` variable, or Git. Room join can use a server-side database function to validate codes without exposing every room. Validate nickname length/content, rates, and basic score/time ranges. A nickname is not proof of identity.

Client-reported scores/times are acceptable for a friendly prototype but not cheat-proof. Full authoritative anti-cheat is outside the 24-hour scope. Provide a local/offline test mode so gameplay development is not blocked by backend credentials; it must not pretend to be a working shared scoreboard.

## 13. Team split and branch ownership

Assign these roles to actual names immediately; four active developers should cover roles 1–4.

> **Superseded by `docs/TEAM_SPLIT.md`**, which assigns names and rebalances the roles below.

| Person | Owns | Deliverable |
| --- | --- | --- |
| 1: integration + runners | core, runner, app skeleton, shared contracts | Complete local run lifecycle, lanes, branches, collisions, breadcrumbs, heart, combined build |
| 2: underwater + transitions | underwater and transition modules | First-person submarine, oxygen/timing/boosts, hatch entry, dollar-hook exit |
| 3: boss | boss module | Pigeon visuals, three-shot volleys, readable bullets, reload window, laser/precision/damage |
| 4: UI + rooms + deployment | UI, network, migrations, hosting | Lobby/room codes, host countdown, HUD, live scoreboard, latest/best results, deployed build |
| 5: joins later | assets, audio, QA and polish | Suit duck/pigeon polish, sound, feedback, cross-browser tests, balancing, demo preparation |

Person 1 has the heaviest integration load: keep runner art simple. Person 5 should take runner visual polish/testing first. If person 4 is overloaded, defer long-term records and visual UI polish, not basic room flow.

### Branch workflow

README names integration branch `dev`, testing counterpart `dev-test`, and member branches `tejas-br`, `rayyan-br`, `mayank-br`, `Zubair-br`, `Vansh-br`. Verify these remotely; names are case-sensitive. Roles are not assigned to names by this document.

1. Integration owner creates/verifies `dev`, establishes the skeleton and contracts, and pushes it.
2. Each teammate creates their member branch from the shared `dev` baseline.
3. Work only in owned modules; coordinate changes to `core/types.ts`, package files, and shared config.
4. Merge small working increments into `dev`, including a useful vertical slice early. Avoid waiting until an entire phase is polished.
5. Integrate latest `dev` into each branch regularly, especially before a pull request.
6. Use `dev-test` for testing the same candidate as `dev`; avoid separate features there. Publish the tested release to `main` at the agreed release point.
7. Do not force-push shared branches or overwrite a teammate's files.

Commands after the integration owner has pushed `dev`:

```bash
git fetch origin
git switch -c YOUR-MEMBER-BRANCH origin/dev
# If your member branch already exists locally, switch to it instead.
git push -u origin YOUR-MEMBER-BRANCH
```

To bring in current integration work on your member branch:

```bash
git fetch origin
git merge origin/dev
# Resolve any conflicts, run relevant checks, then commit and push.
```

In VS Code, open the actual cloned repository folder before running Git commands. If Git says “not a git repository”, use `cd` to enter the clone. Avoid having AI assistants edit the same shared files concurrently.

## 14. First tasks and integration checkpoints

**Person 1 first:** scaffold Vite/TypeScript/Three.js, create the shared types/input/state loop, placeholder scene, local start/retry, phase callbacks, and build scripts. Push the baseline quickly.

**Person 2 first:** prototype timing/oxygen using agreed interfaces and placeholder geometry. Ensure phase entry/exit works before adding hatch/hook animation.

**Person 3 first:** implement one full dodge/reload/attack cycle. Verify all damage outcomes and safe input switching before visual polish.

**Person 4 first:** create Supabase project/schema/policies and stub room service, then basic lobby/countdown/HUD. Coordinate configuration with the team without sharing admin secrets in chat or Git.

Each AI helper receives this file plus its assigned role and allowed files. One owner approves interface changes; feature assistants do not each scaffold separate applications.

## 15. 24-hour delivery schedule

| Time | Required milestone |
| --- | --- |
| 0–2 hours | Stack/service configured; skeleton deployed; contracts and role names agreed |
| 2–6 hours | Rough independent runner, underwater, and boss slices; local room/UI stubs |
| 6–10 hours | Complete local run including death, oxygen failure, heart, retry, and victory |
| 10–14 hours | Shared room start, deterministic course, live progress, latest/best results |
| 14–19 hours | Visual identity, audio/feedback, balance to 3–4 minutes, two-client testing |
| 19–24 hours | Freeze features, fix bugs, test deployed build, rehearse demo and keep backup |

Required demo: one player can finish the full game; two clients can join one room, start together, see progress, finish/fail/retry independently, and see results.

If behind: reduce asset complexity, chunk variety, transition duration, and second-runner length. Cut global records, elaborate menus, fancy effects, host migration, and anti-cheat before cutting core rules or final testing. No live avatars, chat, accounts UI, physics simulation, or additional game modes for the MVP.

## 16. Required checks

### Gameplay

- Correct keys only in each phase; A/D never work in Space-only phases.
- Lane changes respect bounds; paths remain reachable at maximum speed.
- Runner hits reduce speed by exactly 30%; invulnerability prevents stacked damage.
- Lives persist through underwater; oxygen stays separate; third oxygen loss fails.
- Heart is lane-dependent, optional, and grants once, including 3 -> 4 lives.
- Timing accuracy rises/falls around alignment; thresholds and boost expiry behave correctly.
- Early/missed underwater input consumes exactly one bubble; held key cannot farm boosts.
- Three single boss bullets, then a safe attack window; no live bullet during attack.
- Boss perfect = 10,000; any normal press >= 10; held at entry = 10 once; no input = 1.
- Three perfect attacks defeat a fresh boss; victory/failure fire once.
- Retry clears old timers, objects, inputs, score, boosts, and heart state.

### Multiplayer and delivery

- Two browsers share the seed/course and equivalent boss sequence.
- Host starts all initial runs; one player's retry does not reset others.
- Late/stale updates cannot overwrite newer attempts or completed results.
- Latest attempt and personal best remain distinct; failed attempts are clearly marked.
- Row-level security blocks changing another player's attempt or host-only room settings.
- `npm ci`, typecheck, relevant tests, and production build succeed.
- Test the deployed URL in a fresh browser, at the demo resolution, with sound permissions and keyboard focus checked.

Automate pure accuracy/damage calculations, resource accounting/reset, and seeded safe generation. Use manual full-run and two-client checks for rendered gameplay and networking. Do not mistake a successful build for validated gameplay.

## 17. Copy/paste prompt for each AI coding helper

> Read PROJECT_BRIEF.md and repository instructions. My assigned role is [ROLE], and my owned files are [PATHS]. Implement my module against the existing shared skeleton and contracts. Preserve confirmed mechanics, especially phase-specific input limits, resource separation, deterministic courses, and individual retries. Do not scaffold a competing app, edit another owner's modules, change shared types/dependencies without coordination, add extra gameplay buttons, or embed secrets. Use the recommended defaults where no confirmed value exists. Deliver a small playable increment, explain integration points, and report the checks actually run.
