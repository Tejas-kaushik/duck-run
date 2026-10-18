# Duck Run: design changes (17 Oct, decided by Tejas)

These replace the matching parts of `GAME_BRIEF.md` / `PROJECT_BRIEF.md` / `DUCK_RUN_ADDENDUM.md`.
Everything not listed here is unchanged.

## The run now

1. **Runner 1** on a muddy forest road. **A dog chases Bill** (see below).
2. **Pond dive** (stage `DIVE`, was `SUB_ENTRY`): a natural pond sits in the road just past the end of Runner 1 (you see it coming); Bill runs up, leaps and dives in with a splash. **No submarine, no portal.**
3. **Swim** (stage `UNDERWATER`): Bill swims with **A/D in three lanes**, collects **coins** and dodges **jellyfish and pufferfish**.
4. **Dollar hook** (`SURFACE_RETURN`): Bill's eyes turn to `$`, his tongue flops out (greedy duck), he grabs the dollar and gets yanked up.
5. **Runner 2** on the same road, with breadcrumbs (bread slices) and the heart. Gets the **speed boost** if it was bought.
6. **Boss: Don Crumbs, "The Mafia Pigeon"** (fedora, pinstripe suit, cigar, tommy gun). **Intro (~4 s):** Bill skids to a stop, the Don swoops down from the sky onto his crate and lands with a thump; letterbox bars, his name card, and the taunt *"You're going down, birdie!"*; then FIGHT!. Real bullets. His face shows the damage: smug → furious → battered → wrecked.

## Swim, coins and power-ups

- **The timing ring and oxygen are dropped.** Space can't be live while A/D steer (two-button rule), so the swim is A/D only.
  Zubair's old `sim/underwater.ts` and `sim/timing-ring.ts` were removed after being superseded by `phases/underwater/SwimPhase.ts`. `sim/boss.ts` still supplies the boss rules.
- **A hit underwater costs 5 coins and slows Bill**, never a life, so lives still pass through the swim unchanged.
- Coins buy **the best power-up you can afford, automatically** (no menu):

| Coins | Power-up | Effect |
|---|---|---|
| 100+ | 💥 Laser +50% | Every laser hit on the boss does 1.5× damage |
| 50+ | ⚡ Speed boost | Runner 2 starts at 1.3× top speed for 4 s, and Bill smashes through branches while it lasts |
| 20+ | 🛡️ Shield | A bubble for the first 5 s of the boss fight; bullets bounce off |

The swim is **hard on purpose**: about 120 coins on a trail that hops lanes every few coins and leads right up to creatures ("bait"), with creature rows every ~12 units, mostly blocking two lanes, and the pace rising through the swim. The trail only moves one lane at a time, so every coin is collectable, but the 100-coin laser needs a near-perfect swim. In test runs, a perfect bot got 99–109 coins and a slower one 44–72.

## Pacing (latest)

Players see the stages as **Stage 1 · Forest road**, **Underwater**, **Stage 2 · Back on the road** and **Boss · Don Crumbs** (`ui/stageNames.ts`); the code keeps its ids (RUNNER_1, runner1…).

| Stage | Length | Top speed |
|---|---|---|
| Stage 1 (Runner 1) | ~20 s (410 units) | 22 |
| Underwater (swim) | ~15 s (270 units) | 18 |
| Stage 2 (Runner 2) | ~15 s (385 units) | 26: the duck gets faster each stage |
| Boss | ~5 s per round | 3 quick shots (0.75 s apart), then a short Ready → Aim → FIRE |

About 60 s to reach the boss, including the dive and surfacing; a full run is about 75–95 s. Solo practice and room races use the same course (`CONFIG.flow.roomCourseScale` can shorten room races if ever needed).

## The dog (Runner 1)

- It chases at the start, then drops back out of sight.
- **First branch hit:** it catches up and stays right behind Bill for 5 s.
- **Another hit while it's close:** it bites once Bill's 1 s invulnerability ends, costing one extra life.

## Still undecided (unchanged)

The boss timings, damage curve, no-press outcome, bullet aim and the 300,000-point score split. Placeholders are marked UNDECIDED in `client/src/core/config.ts`.

## Multiplayer (rooms on phones)

1. **Title screen:** a looping chase (Bill, Biscuit and the Don) behind the logo. Solo practice, Create room, or Join with a code.
2. **Create room → the pond lobby.** Every player is a Bill floating on a pond, in their own coat colour. The host's screen shows a **QR code**; phones scan it, land on a "You're invited" screen, type a name and jump in.
3. **Leaderboard** beside the pond: everyone on 0 before the first race.
4. **The host starts the race.** Everyone gets the same **3-2-1** and plays the same course on their own device. The story intro plays in solo practice, not before room races, so judges get straight into the action.
5. **End of a run:** your score, your place (live while others are still racing) and the standings. Then **back to the pond** (button, or after 20 s), where the leaderboard shows the last race. The host can start the next race; new players can join between races.

**Big-screen mode** (`ui/stadium.ts`): on the laptop that's on the projector, switch on "📺 Big-screen mode" in the pond lobby (laptops only; remembered per tab). That screen then doesn't play: it shows every racer as a duck moving along one track (road → pond → road → Don Crumbs), a live clock, a QR to join the next race, and commentary ("Mayank dives into the pond!", "Don Crumbs got Rayyan!", lead changes). When everyone is done (or the host presses "End race"), a podium rises with confetti and the Don roasts whoever came last. Once a race has started, the leaderboard lists only the people who raced, so the big screen and late joiners never sit on it at 0.

**Race score** (`RunState.raceScore`, ranks the leaderboard): 25,000 per section completed (pro rata; the boss by damage dealt) + 250 per coin + breadcrumbs. A finish adds 50,000 + 5,000 per life left + 1,000 per second under 2:00, so any finish beats any run that died.

**Needs:** Supabase keys in `client/.env.local` and every migration run on the live project (`supabase/apply_to_live.sql` brings it up to date; `race_rounds` is what lets a room race again). Phones must be on the same Wi-Fi as the laptop running `npm run dev` (it now listens on the network, and the QR uses the laptop's network address). `VITE_PUBLIC_URL` overrides the QR's address for a deployed build.

## Two buttons, strictly

The whole game is two buttons, **A and D**, and nothing else (SPACE no longer does anything):

- Dodging: A = left, D = right.
- Boss FIRE: **either** button fires. Pressing during Ready/Aim is "too early"; a button pressed during the wind-up and still held at FIRE is a miss. A lane key still held from dodging doesn't count.
- Instruction cards, the story intro and the endings: either button continues.
- Phones: the **left and right halves of the screen** are the two buttons. A marker in each corner shows what a tap does right now (◀ ▶, a red 🎯 at FIRE, a green TAP on a card).

That makes the pitch line literal: every decision in the game is left or right. It also means anyone with any two buttons can play: two keys, two thumbs, or two accessibility switches.
