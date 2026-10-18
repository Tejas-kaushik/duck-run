// Every tuning number in one place (brief §8 + DUCK_RUN_ADDENDUM). These are the values the game
// ships with, tuned in playtests: change them here, never hard-code a copy inside a phase.

export const CONFIG = {
  lives: {
    start: 3,
    invulnerableSec: 1, // confirmed
  },
  /**
   * Pacing (Tejas, 18 Oct): about 20 s for Stage 1 (Runner 1), 15 s for the swim, 15 s for Stage 2
   * (Runner 2), then the boss. The duck gets a little faster each stage (22 → 26 top speed); its speed
   * carries from Stage 1 into Stage 2. Distances are fixed; times vary with hits and the boost.
   */
  runner: {
    lanes: [-2.5, 0, 2.5] as const,
    laneChangeSec: 0.15,
    startSpeed: 13,
    maxSpeed: 22, // Runner 1
    runner2MaxSpeed: 26,
    acceleration: 1.4,
    hitSpeedMultiplier: 0.7, // confirmed: a hit removes 30% of current speed
    runner1Distance: 410, // ~20 s
    runner2Distance: 385, // ~15 s (starts at ~22, builds to 26)
  },
  /** The swim (DESIGN_CHANGES.md): A/D lanes, dodge sea creatures, collect coins. */
  swim: {
    speed: 18,
    distance: 270, // ~15 s
    coinsLostOnHit: 5,
    hitSlowdown: 0.6,
  },
  /** Bought automatically with swim coins: the best one you can afford (DESIGN_CHANGES.md). */
  powerUps: {
    shieldCoins: 20,
    boostCoins: 50,
    laserCoins: 100,
    shieldSec: 5, // at the start of the boss fight
    boostSec: 4, // at the start of Runner 2; Bill smashes through branches while it lasts
    boostSpeedMultiplier: 1.3,
    laserDamageMultiplier: 1.5,
  },
  boss: {
    health: 30000, // confirmed (addendum §1)
    shotsPerVolley: 3, // confirmed: three single bullets per cycle
    shotIntervalSec: 0.75, // faster rounds (Tejas): 3 quick shots, then Ready → Aim → FIRE
    /**
     * Reaction attack: Ready → Aim → Fire (green), decided by Zubair's sim/boss.ts.
     * Agreed: early press or a button held through Fire = 1 damage (that lives in sim/boss.ts).
     * Ready/Aim last one second each, followed by a random wait before Fire, so nobody can time it
     * by rhythm. Damage falls in a straight line from maxDamage (instant) to minDamage (the end of
     * Fire); no press at all does noPressDamage.
     */
    reaction: {
      readySec: 1,
      aimSec: 1,
      fireDelayMinSec: 0.25,
      fireDelayMaxSec: 1.5,
      fireWindowSec: 1.0,
      maxDamage: 10000, // at a 0 ms reaction
      minDamage: 1000, // at the end of the fire window
      noPressDamage: 0,
    },
    bulletSpeed: 21, // units per second
    windUpSec: 0.35, // readable warning before each shot
  },
  score: {
    max: 300000, // confirmed cap (addendum §3); the database refuses anything above it
    perBreadcrumb: 5000, // Stage 2's breadcrumbs (15 per course, so up to 75,000)
    // The race score rooms are ranked by (RunState.raceScore). Tejas, for the multiplayer leaderboard.
    perSection: 25000, // each of the 4 sections, pro rata (the boss by damage dealt)
    perCoin: 250,
    finishBonus: 50000,
    perLifeLeft: 5000, // on a finish
    parSec: 120, // a finish earns timeBonusPerSec for every second under this
    timeBonusPerSec: 1000,
  },
  flow: {
    countdownSec: 3,
    /**
     * A room's first race starts this far ahead so every screen can watch the story together (Vansh).
     * The server allows up to 15 s. Later races in the same room start after countdownSec.
     */
    storyStartSec: 15,
    /**
     * The first race starts this much after the shared start time, on every screen, so the story has
     * room to breathe: about 25 s in all, a little slower than solo so players can read every line.
     */
    storyExtraSec: 10,
    /**
     * Room races use the full course (1). Below 1 shortens every section for a quicker party race,
     * e.g. 0.5 for about 25 s before the boss.
     */
    roomCourseScale: 1,
  },
} as const;
