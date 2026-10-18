export interface BossRules {
  readyMs: number;
  aimMs: number;
  fireMs: number;
  // Required: the team has not agreed these two damage rules yet.
  damageForReaction: (reactionMs: number) => number;
  noPressDamage: number;
}

export interface BossAttackResult {
  reason: 'reaction' | 'early' | 'held' | 'expired';
  reactionMs: number | null;
  damage: number;
}

export interface BossState {
  phase: 'volley' | 'reload' | 'defeated';
  hp: number;
  rules: Readonly<BossRules>;
  shotsFired: number;
  nextProjectileId: number;
  activeProjectiles: number[];
  reloadElapsedMs: number;
  fireDelayMs: number;
  attackResult: BossAttackResult | null;
}

export function createBoss(rules: Readonly<BossRules>): BossState {
  if ([rules.readyMs, rules.aimMs, rules.fireMs].some(
    (value) => !Number.isFinite(value) || value <= 0,
  ) || !Number.isFinite(rules.noPressDamage) || rules.noPressDamage < 0) {
    throw new RangeError('Boss durations must be positive; damage must be non-negative.');
  }
  return {
    phase: 'volley', hp: 30_000, rules: { ...rules }, shotsFired: 0,
    nextProjectileId: 1, activeProjectiles: [], reloadElapsedMs: 0, fireDelayMs: 0, attackResult: null,
  };
}

// Tejas schedules the visible wind-up/shot and creates one targeted bullet per ID.
export function fireBossShot(state: BossState): number | null {
  if (state.phase !== 'volley' || state.shotsFired === 3) return null;
  const id = state.nextProjectileId++;
  state.shotsFired += 1;
  state.activeProjectiles.push(id);
  return id;
}

// A bullet must be incapable of causing damage before its ID is resolved.
export function resolveBossProjectile(state: BossState, id: number): boolean {
  const index = state.activeProjectiles.indexOf(id);
  if (index === -1) return false;
  state.activeProjectiles.splice(index, 1);
  return true;
}

export function beginBossReload(state: BossState, fireDelayMs = 0): boolean {
  if (state.phase !== 'volley' || state.shotsFired !== 3
    || state.activeProjectiles.length !== 0) return false;
  if (!Number.isFinite(fireDelayMs) || fireDelayMs < 0) {
    throw new RangeError('Fire delay must be non-negative and finite.');
  }
  state.phase = 'reload';
  state.reloadElapsedMs = 0;
  state.fireDelayMs = fireDelayMs;
  state.attackResult = null;
  return true;
}

export function getBossPrompt(state: BossState): 'ready' | 'aim' | 'fire' | null {
  if (state.phase !== 'reload' || state.attackResult) return null;
  if (state.reloadElapsedMs < state.rules.readyMs) return 'ready';
  if (state.reloadElapsedMs < state.rules.readyMs + state.rules.aimMs + state.fireDelayMs) return 'aim';
  return 'fire';
}

function resolveAttack(state: BossState, result: BossAttackResult): BossAttackResult {
  if (!Number.isFinite(result.damage) || result.damage < 0) {
    throw new RangeError('Boss damage must be finite and non-negative.');
  }
  state.attackResult = result;
  state.hp = Math.max(0, state.hp - result.damage);
  if (state.hp === 0) state.phase = 'defeated';
  return result;
}

// Advance before processing an input edge, using the held state BEFORE that edge.
// The caller uses the same gameplay clock for visual prompts and this function.
export function advanceBossReload(
  state: BossState, deltaMs: number, spaceHeld = false,
): BossAttackResult | null {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    throw new RangeError('Elapsed time must be non-negative and finite.');
  }
  if (state.phase !== 'reload' || state.attackResult) return null;
  const fireAtMs = state.rules.readyMs + state.rules.aimMs + state.fireDelayMs;
  const expiryMs = fireAtMs + state.rules.fireMs;
  const wasBeforeFire = state.reloadElapsedMs < fireAtMs;
  state.reloadElapsedMs = Math.min(expiryMs, state.reloadElapsedMs + deltaMs);
  if (wasBeforeFire && state.reloadElapsedMs >= fireAtMs && spaceHeld) {
    return resolveAttack(state, { reason: 'held', reactionMs: null, damage: 1 });
  }
  if (state.reloadElapsedMs >= expiryMs) {
    return resolveAttack(state, {
      reason: 'expired', reactionMs: null, damage: state.rules.noPressDamage,
    });
  }
  return null;
}

// Call only for a fresh fire press (either button). Repeats/held keys are filtered by input routing.
export function pressBossAttack(state: BossState): BossAttackResult | null {
  if (state.phase !== 'reload' || state.attackResult) return null;
  const fireAtMs = state.rules.readyMs + state.rules.aimMs + state.fireDelayMs;
  if (state.reloadElapsedMs < fireAtMs) {
    return resolveAttack(state, { reason: 'early', reactionMs: null, damage: 1 });
  }
  const reactionMs = state.reloadElapsedMs - fireAtMs;
  return resolveAttack(state, {
    reason: 'reaction', reactionMs, damage: state.rules.damageForReaction(reactionMs),
  });
}

export function beginNextBossVolley(state: BossState): boolean {
  if (state.phase !== 'reload' || state.attackResult === null) return false;
  state.phase = 'volley';
  state.shotsFired = 0;
  state.reloadElapsedMs = 0;
  state.fireDelayMs = 0;
  state.attackResult = null;
  return true;
}
