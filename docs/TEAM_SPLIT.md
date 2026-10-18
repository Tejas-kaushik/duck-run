# Duck Run: who builds what

> **Read `DESIGN_CHANGES.md` first.** The sub and the underwater timing ring/oxygen are gone: the swim is now A/D lanes with coins that buy power-ups, Runner 1 has a chasing dog, and the boss is a mafia pigeon.

Read `PROJECT_BRIEF.md` for the original full brief, `DUCK_RUN_ADDENDUM.md` for the latest clarifications, and `GAME_BRIEF.md` for the consolidated Duck Run design. Current confirmed rules override historical examples.

**Latest Zubair handoff:** Zubair supplies the gameplay-only modules in `client/src/sim/`; Tejas owns frontend presentation and input wiring for this contribution. See [ZUBAIR_BASE.md](ZUBAIR_BASE.md). Preserve the existing core contracts below and add phase adapters; do not replace Tejas's controller or introduce a second animation loop. The older rendering tasks for Zubair below are superseded by this boundary. Early Ready/Aim presses and Space held when Fire appears each end the duck's attack for **1 damage**.

## 1. The team

| Person | Role |
|---|---|
| **Tejas** | Integration + runners + Bill + **all lobby UI** (lobby, room code, nickname, waiting list, host start, countdown) + HUD |
| **Mayank + Rayyan** | **Backend pair:** Supabase, rooms, network code, live scoreboard, results, deployment, plus the seeded course generator |
| **Zubair** | The timing ring + underwater, the sub and hook transitions, and the pigeon boss (aimed shots + Ready/Aim/Fire reaction attack) |
| **Vansh** (joins later) | **Tests + sound**, plus Bill's new poses, game feel, cross-browser QA, balancing and the demo |

> **Why the course generator moved to the backend pair:** Zubair now owns two full sections (underwater and boss), so he can't also take the generator. The generator is pure logic built on the room's seed, and the room seed is created in Supabase, so it fits the pair.

---

## 2. Hour 0: everyone together (30 minutes, before any feature code)

1. **Baseline:** Tejas merges `tejas-br` into `dev` (client setup, Bill, character preview). Everyone branches from that `dev`. **Nobody runs `npm create vite`**, because it would overwrite `client/package.json`.
2. **Layout:** the brief's folder layout lives inside `client/`, so it's `client/src/core/...` and `client/src/phases/...`. Bill stays at `client/src/render/character.ts`.
3. **Agree these contracts out loud** (each is sketched in §4):

| Contract | Agreed between | Lives in |
|---|---|---|
| `PhaseContext` (what every phase receives) | Tejas + Zubair | `core/types.ts` |
| Timing ring API (underwater only; the boss now uses Ready/Aim/Fire) | Zubair | `shared/timing/` |
| Lane mover (runners **and** boss) | Tejas + Zubair | `core/LaneMover.ts` |
| Obstacle chunk format | Rayyan + Tejas | `course/types.ts` |
| Network calls the lobby UI uses (create, join, start, players list) | Mayank/Rayyan + Tejas | `network/types.ts` |
| Progress/result events sent to the network | Mayank/Rayyan + Tejas | `core/types.ts` |
| Test setup (Vitest, `npm test`) | Tejas sets it up at hour 0, and Vansh owns it after | `client/vitest.config.ts` |

---

## 3. Files each person owns

Only touch your own folders. To change a shared contract, ask the owner first.

```
client/
  src/
    main.ts                                                           Tejas
    core/        Game.ts types.ts Input.ts RunState.ts config.ts
                 seededRandom.ts LaneMover.ts                         Tejas
    phases/runner/                                                    Tejas
    ui/          lobby.ts countdown.ts hud.ts                         Tejas
    ui/          scoreboard.ts results.ts                             Mayank + Rayyan
    network/     types.ts supabase.ts rooms.ts progress.ts            Mayank + Rayyan
    course/      types.ts chunks.ts generate.ts validate.ts           Rayyan
    shared/timing/  accuracy.ts TimingWindow.ts TimingRingView.ts     Zubair
    phases/underwater/                                                Zubair
    phases/transitions/   (sub hatch entry, dollar-hook exit)         Zubair
    phases/boss/          (pigeon, shotgun, bullets, laser)           Zubair
    render/character.ts   (Bill)          Tejas now; Vansh adds the new poses when he joins
    audio/                                                            Vansh
  tests/                                                              Vansh (see §5)
supabase/migrations/                                                  Mayank
```

`client/package.json` and the lockfile are **owned by Tejas**. Ask before adding a dependency.

---

## 4. The contracts (now real code: read these files, not a sketch)

The skeleton is built, so the contracts live in code. **Read the file, not this summary.**

| Contract | File | What to know |
|---|---|---|
| `PhaseContext`, `Phase`, `GameEvent`, `RunState`, `InputSnapshot` | `client/src/core/types.ts` | Core creates a **new phase instance every time a stage starts** (so a retry never sees old state). Phases read `ctx.input` / `ctx.run` and **ask** core to change things: `damagePlayer()`, `loseOxygen()`, `gainLife()`, `addScore()`, `damageBoss()`, `requestInputMode()`, `completePhase()`, `failRun()`. |
| Plugging your phase in | `client/src/phases/registry.ts` | Change only your own line. Placeholders keep the run playable until then. |
| Lane movement | `client/src/core/LaneMover.ts` | `handle(ctx.input)`, `update(dt)`, `x` to draw, `lane` for collision. Used by the runners and the boss. |
| Tuning numbers | `client/src/core/config.ts` | Every number lives here. Values marked **UNDECIDED** are placeholders the team hasn't agreed on yet. |
| Input rules | `client/src/core/Input.ts` | `lanes` mode = A/D only, `timing` mode = Space only. A press can't leak into the next phase, and key repeat never counts. `spaceHeld` is reported in every mode. |

```ts
// shared/timing/TimingWindow.ts (Zubair; UNDERWATER ONLY)
// The boss no longer uses a closing ring: it uses Ready → Aim → Fire (DUCK_RUN_ADDENDUM §1).
export interface TimingResult { accuracy: number; early: boolean } // accuracy 0–100

export class TimingWindow {
  constructor(opts: { durationSec: number; perfectAtSec: number; perfectToleranceSec: number });
  update(dtSeconds: number): void;
  press(): TimingResult | null;         // null if this window already used its one attempt
  readonly liveAccuracy: number;        // rises to 100 at alignment, falls after
  readonly progress: number;            // 0..1 for drawing the closing ring
  readonly state: 'open' | 'used' | 'expired';
}
// Underwater: Space held before the window opens does NOT count (brief §5).
```

```ts
// phases/boss/ (Zubair): the reaction attack, per DUCK_RUN_ADDENDUM §1
// Confirmed: Ready → Aim → Fire (green). Space only, the duck can't move. 100% accuracy.
//   Damage comes from the reaction time after Fire appears: faster = more.
//   Early Ready/Aim press or Space held when Fire appears = 1 damage, ending the attack.
//   One attack per reload window. Boss HP 30,000.
// UNDECIDED (ask the team, don't pick silently): Ready/Aim/Fire durations,
//   the damage formula + min/max, the no-press outcome,
//   and exactly how bullets aim at the player.
```

```ts
// network/types.ts (Mayank + Rayyan; the lobby UI calls these)
export interface RoomApi {
  createRoom(nickname: string): Promise<{ roomCode: string; seed: number; isHost: true }>;
  joinRoom(code: string, nickname: string): Promise<{ roomCode: string; seed: number; isHost: false }>;
  onPlayersChanged(cb: (players: { id: string; nickname: string }[]) => void): () => void;
  startRoom(): Promise<void>;                          // host only
  onStart(cb: (startAtMs: number) => void): () => void; // everyone, drives the countdown
}
// offline mode implements the same interface with fake data, so Tejas can build the
// lobby before Supabase is ready
```

---

## 5. Each person's plan

### 🦆 Tejas: Integration + runners + Bill + lobby UI + HUD (critical path)

| Hours | Do this | Done when |
|---|---|---|
| **0–2** | Merge `tejas-br` → `dev`. Write `core/`: state machine with **placeholder phases that finish on their own after 5 s**; `Input.ts` (modes, keydown edges, ignore repeat, clear on focus loss, stop Space scrolling); `RunState.ts` (monotonic timer, lives, 1 s invulnerability, score, attempt reset); `config.ts`; `seededRandom.ts`; `LaneMover`; Vitest set up. Add a dev URL **`?phase=underwater`** (etc.) that jumps straight into a phase. **Push `dev` by hour 2.** | Placeholder flow runs LOBBY → … → FINISHED; retry works |
| **2–6** | Runner 1: water plane, 3 lanes, third-person camera, acceleration, branches from **3–4 hand-written chunks**, box collision, damage + 30% slow + hit flash. Bill running on water. | Runner 1 is fun on its own |
| **6–10** | Wire in Zubair's phases, Runner 2 (same code, breadcrumbs + heart), death, retry, victory. **Basic HUD** (lives, oxygen, score, timer, boss HP, and a hint showing which keys work right now: `A ◀ ▶ D` or `SPACE`) | **One full local run works end to end** |
| **10–14** | **Lobby UI** on the `RoomApi` (offline mode first, then real Supabase): create room, room code + QR, nickname, waiting list, host Start, countdown. Swap in Rayyan's course generator. Give the network code its events | Two browsers join one room and start together |
| **14–24** | Merge everyone's work into `dev`, triage bugs, promote `dev` → `dev-test` → `main`; style the lobby with Vansh | Deployed build passes brief §16 checks |

> Tejas has the heaviest load. If the full run slips past hour 10, **the HUD moves to Vansh** and Tejas keeps the lobby.

### 📡 Mayank + Rayyan: Backend pair

| Hours | Mayank | Rayyan | Done when |
|---|---|---|---|
| **0–2** | Supabase project, anonymous auth on, migrations (`rooms`, `room_players`, `attempts`), row-level security, `join_room(code, nickname)` function. Vercel deploy of the `dev` skeleton. **Share only the URL + anon key**; never commit the service-role key | Agree `RoomApi` with Tejas. Write `network/types.ts` + **offline mode** (fake rooms), so Tejas can build the lobby straight away | Deployed URL loads; offline `RoomApi` works |
| **2–6** | `rooms.ts`: create/join/start with a scheduled start time, players list via Realtime | `progress.ts`: publish progress 1/s plus instant phase/fail/finish events; attempt IDs; ignore stale attempts | Two browsers see each other in a room |
| **6–10** | Scoreboard ranking (section → distance → boss HP; finishers by time); stale/disconnected players | **Course generator:** `chunks.ts` (12–20 hand-made chunks: branches, breadcrumbs), `generate.ts` (seeded shuffle, one seed per section, heart lane before boss), `validate.ts` + **test over 1,000 seeds at max speed** | Generator ready for Tejas; ranking correct |
| **10–14** | `scoreboard.ts` UI (live during play) | `results.ts` UI (latest attempt, personal best, failed label, Retry button) | Two-client check in brief §16 passes |
| **14–24** | Deployment checks in a fresh browser on the demo machine; security rules re-checked | Help balance chunk difficulty; two-client and stale-player tests | Demo URL works on the demo machine |

### 🐦 Zubair: Timing ring + underwater + transitions + pigeon boss

| Hours | Do this | Done when |
|---|---|---|
| **0–2** | `accuracy.ts` + `TimingWindow.ts` (pure, no Three.js) with quick tests: live accuracy rises to 100 then falls, one attempt per window, early press uses it, perfect band. Agree `LaneMover` with Tejas | Ring logic works in tests |
| **2–5** | `TimingRingView` (big closing ring + target + live %, frozen on press). **Underwater:** first-person cockpit from shapes, automatic travel, ~10 windows, **3 oxygen bubbles**, boosts (90–100% = 1.5×, 50–89% = 1.25×, 3 s, refresh not stack), under 50% or no press loses a bubble, 0 oxygen fails the run | Playable via `?phase=underwater` |
| **5–9** | **Pigeon boss** (rules from `DUCK_RUN_ADDENDUM.md`): 3 single shots with wind-up that **aim at the player**, dodging with `LaneMover`, **all bullets cleared before the attack**, then the reload **Ready → Aim → Fire (green)** prompt, Space only. Damage from reaction time (faster = more), early Ready/Aim presses or Space held when Fire appears = 1 damage, one attack per reload, HP 30,000, victory once. Pigeon with shotgun from shapes, laser, damage popup. **Before coding, get the team to decide the open questions** (addendum §1–2) | Playable via `?phase=boss`; fast reactions beat it |
| **9–10** | **Simple transitions** (input mode `none`, under 4 s): sub entry (Bill drops into the hatch) and surface return (dollar hook pulls Bill up). Bill's existing poses are fine for now | Full run flows through both transitions |
| **10–24** | Pigeon animations (aim, reload, flinch, defeat), cockpit polish, boss and window tuning toward a 3–4 min run | Underwater and boss checks in brief §16 pass |

> Zubair has the most gameplay. If he's behind at hour 10, **the transitions go to Vansh**. They're mostly Bill animation, which Vansh is doing anyway.

### 🎨 Vansh (joins later): Tests + sound + polish

Do these in order, and don't take anything that blocks the core build:
1. **Pull `dev`, play the whole game and write a bug list** for the owners.
2. **Tests (he owns `client/tests/`):** turn the brief's §16 checklist into Vitest tests wherever it's pure logic: input modes per phase, 30% slow, invulnerability, lives across underwater, oxygen separate, heart once (3 → 4), underwater timing thresholds, held-key rules (underwater: held doesn't count; boss: early press or held at Fire = 1 damage), boss reaction damage (faster = more, one attack per reload), score never above 300,000, retry resets everything, same seed = same course. Write a **manual checklist** for full runs and two-client play, and run it every few hours.
3. **Sound (`audio/`):** quack, splash, branch hit, ring tick, perfect chime, oxygen pop, shotgun, reload click, "Ready… Aim… Fire!" call-outs, laser, boss defeat, music. Play sounds by listening to the `GameEvent`s, so nobody else has to call audio code.
4. **Bill's new poses** in `render/character.ts` (check with Tejas first): run on water, dive into hatch, dollar eyes, hanging from hook, firing laser. Test them in `npm run character`.
5. **Game feel:** screen shake, hit flash, damage-number styling, lobby/HUD/results styling.
6. **QA, balance and demo:** Chrome, Edge and Safari, the demo resolution, tuning toward 3–4 minutes, demo script, slides and a recorded backup video.

> Until Vansh joins, **each owner still writes a quick test for their own pure logic** (the timing ring, boss reaction damage, generator). Vansh then owns the whole suite and fills in the gaps.

---

## 6. Team checkpoints

| Hour | Whole-team check |
|---|---|
| **2** | `dev` has the skeleton and contracts; everyone has pulled; offline `RoomApi` exists |
| **6** | Runner 1 and underwater are playable alone via `?phase=`; two browsers see each other in a room |
| **10** | **One full local run: Runner 1 → sub → underwater → surface → Runner 2 → boss → results** |
| **14** | Two clients, same room, same course, lobby → countdown → live scoreboard → results |
| **19** | **Feature freeze.** Bug fixes, balance, sound and polish only |
| **22** | Deployed build tested in a fresh browser; demo rehearsed twice; backup video recorded |

**If behind:** cut transition length, chunk variety, Runner 2 length and visual extras. **Never cut:** a complete run, lives/oxygen/retry, the input rules, the scoreboard.

---

## 7. Prompt to give your AI assistant

> Read `docs/PROJECT_BRIEF.md`, `docs/DUCK_RUN_ADDENDUM.md` (it wins where they differ) and `docs/TEAM_SPLIT.md`. I am **[NAME]**, role **[ROLE]**. I own only these paths: **[PATHS from §3]**. Build my next task from §5 against the shared contracts in `client/src/core/types.ts` and `client/src/network/types.ts`. Keep the phase input rules (A/D only in lane phases, Space only in timing phases, never all three), the separate lives and oxygen, deterministic seeded courses and individual retries. Don't scaffold a new app, don't run `npm create vite`, don't edit files I don't own, don't add dependencies or change shared types without asking, never put secrets in code, and don't invent rules the addendum lists as undecided: ask me instead. Make a small, playable change, tell me how it plugs into the rest of the game, and list the checks you actually ran.
