import { describe, expect, it } from 'vitest';
import {
  advanceBossReload, beginBossReload, beginNextBossVolley, createBoss,
  fireBossShot, getBossPrompt, pressBossAttack, resolveBossProjectile,
} from '../src/sim/boss';

function clearedBoss() {
  const boss = createBoss({
    readyMs: 1000, aimMs: 1000, fireMs: 1000,
    damageForReaction: (ms) => Math.max(1000, 10000 - ms * 9),
    noPressDamage: 0,
  });
  for (let i = 0; i < 3; i++) resolveBossProjectile(boss, fireBossShot(boss)!);
  return boss;
}

describe('boss reaction timing with a per-reload random wait', () => {
  it('keeps Ready for one second, then Aim through the extra wait', () => {
    const boss = clearedBoss();
    beginBossReload(boss, 500);
    advanceBossReload(boss, 999);
    expect(getBossPrompt(boss)).toBe('ready');
    advanceBossReload(boss, 1);
    expect(getBossPrompt(boss)).toBe('aim');
    advanceBossReload(boss, 1499);
    expect(getBossPrompt(boss)).toBe('aim');
    advanceBossReload(boss, 1);
    expect(getBossPrompt(boss)).toBe('fire');
  });

  it('treats an anticipated press before the actual random Fire as early', () => {
    const boss = clearedBoss();
    beginBossReload(boss, 1000);
    advanceBossReload(boss, 2000);
    expect(pressBossAttack(boss)).toMatchObject({ reason: 'early', damage: 1 });
    expect(pressBossAttack(boss)).toBeNull();
    expect(boss.hp).toBe(29999);
  });

  it('measures reaction time from the delayed Fire, not the old fixed deadline', () => {
    const boss = clearedBoss();
    beginBossReload(boss, 750);
    advanceBossReload(boss, 2850);
    expect(pressBossAttack(boss)).toMatchObject({ reason: 'reaction', reactionMs: 100, damage: 9100 });
  });

  it('applies the held-key penalty only when the actual Fire time is reached', () => {
    const boss = clearedBoss();
    beginBossReload(boss, 500);
    expect(advanceBossReload(boss, 2499, true)).toBeNull();
    expect(advanceBossReload(boss, 1, true)).toMatchObject({ reason: 'held', damage: 1 });
    expect(advanceBossReload(boss, 500, true)).toBeNull();
    expect(boss.hp).toBe(29999);
  });

  it('preserves the full Fire response window after the random wait', () => {
    const boss = clearedBoss();
    beginBossReload(boss, 1000);
    expect(advanceBossReload(boss, 3999)).toBeNull();
    expect(getBossPrompt(boss)).toBe('fire');
    expect(advanceBossReload(boss, 1)).toMatchObject({ reason: 'expired', damage: 0 });
  });

  it('resets the wait before accepting a new value for the next volley', () => {
    const boss = clearedBoss();
    beginBossReload(boss, 500);
    pressBossAttack(boss);
    expect(beginNextBossVolley(boss)).toBe(true);
    expect(boss.fireDelayMs).toBe(0);
    for (let i = 0; i < 3; i++) resolveBossProjectile(boss, fireBossShot(boss)!);
    beginBossReload(boss, 1200);
    expect(boss.fireDelayMs).toBe(1200);
  });

  it('does not allow live bullets or invalid wait values into reload', () => {
    const active = clearedBoss();
    beginBossReload(active);
    pressBossAttack(active);
    beginNextBossVolley(active);
    fireBossShot(active);
    expect(beginBossReload(active, 500)).toBe(false);
    for (const invalid of [-1, NaN, Infinity]) {
      expect(() => beginBossReload(clearedBoss(), invalid)).toThrow(RangeError);
    }
  });
});
