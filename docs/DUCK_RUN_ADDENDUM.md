# Duck Run — additional implementation context

This addendum supplements the original **Dollar Duck — team implementation brief**. The game is now called **Duck Run**. Where this document changes a rule, follow this document; all other confirmed mechanics in the original brief remain in effect.

This is design context for the team and their AI coding assistants, not an instruction to begin implementation. Do not invent missing rules or treat suggestions as confirmed requirements.

## 1. Boss attack: reaction timing during reload

The boss attack uses a reaction prompt, replacing any assumed circle-based timing mechanic for the boss. The submarine retains its original circle-based timing mechanic.

Each boss cycle follows this sequence:

1. The pigeon fires three shots, with one bullet per shot. The player dodges using A/D.
2. Finish or clear the volley so no bullet can damage the duck during the attack window.
3. The pigeon reloads. Disable A/D; Space is the only active gameplay input.
4. Display **Ready**, then **Aim**, then **Fire**. The **Fire** prompt is green.
5. The player reacts to the green Fire prompt with a fresh Space press.
6. Resolve the attack, then return to the next boss cycle if neither participant has been defeated.

The duck cannot move during the attack window. Preserve the original stage-specific input restriction: A/D during dodging, Space alone during attacking, and never all three together.

### Accuracy and damage

- The laser has **100% accuracy** on a valid attack; do not calculate aim accuracy from the reaction time.
- Damage depends on elapsed time between the green Fire prompt appearing and the player's Space press.
- Faster reactions deal more damage.
- Ready lasts one second. Aim lasts at least one second, with an additional random wait before green Fire so players must react rather than follow a fixed rhythm. The current extra wait is 0.25–1.5 seconds, adjustable in config.
- A fresh press during Ready or Aim ends the attack and deals **1 damage**.
- Space already held when Fire appears also ends the attack and deals **1 damage**. This latest clarification replaces the earlier Miss/zero-damage rule. A held key must never automatically produce a full reaction attack.
- Do not allow keyboard repeat or repeated presses to produce multiple attacks within one reload window.
- The boss retains **30,000 starting health** from the original brief. The new score cap does not change boss health.

### Still to decide before implementation

- How long the Fire response window remains open; tuning the random wait range.
- Minimum and maximum damage, the reaction-time-to-damage formula, and the no-response outcome.

Do not silently choose these as agreed game rules. Ask the team when implementing this mechanic.

## 2. Boss bullets target the player

Boss bullets target the player rather than using an unrelated predetermined lane pattern.

The original requirements still apply: three single bullets per cycle, readable wind-up, enough travel time to dodge, no shotgun spread, one shared life lost per damaging hit, and one second of invulnerability after a hit.

**Targeting behaviour remains unresolved:** the team has not yet confirmed when the target lane is sampled or whether bullets track after firing. A proposed interpretation is to aim at the player's lane when each shot is fired, then travel straight; this is a suggestion, not a confirmed rule.

## 3. Score scale and successful completion

- The maximum attainable score is **300,000 points**. Design all score contributions relative to this cap.
- A successful attempt means completing the entire game, including defeating the pigeon boss.
- Successful completion displays the player's **score** and **time taken to complete the game**.
- Breadcrumbs remain score-only collectibles; they do not increase speed.
- Travel stages still end at fixed distances, not score thresholds.
- Keep the original latest-attempt, personal-best, and room-leaderboard requirements. Their detailed behaviour remains unspecified.

### Still to decide before implementation

- Which actions contribute to score and how the 300,000 points are allocated.
- Whether 300,000 requires a perfect run; this has been suggested but not confirmed.
- Whether reaction damage, underwater performance, remaining lives, or completion time affect score.
- How failed attempts are scored, how leaderboard ties are resolved, and when the completion timer starts/stops, including treatment of transitions or pauses.

Do not invent a scoring breakdown and present it as approved. The score cap is confirmed; the formula is not.

## 4. Scope and remaining decisions

The team intends to add further details later. Preserve the original runner, submarine, oxygen, heart, lives, and transition rules unless explicitly updated.

The technology stack, task assignments, room/multiplayer behaviour, persistence, retry flow, assets, and numeric tuning not specified in the original brief remain open. Ask focused questions when those decisions become necessary; do not assume they have already been agreed.
