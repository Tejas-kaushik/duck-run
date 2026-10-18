import { describe, expect, it } from 'vitest';
import {
  DISCONNECT_AFTER_MS,
  rankScoreboard,
  sectionProgress,
  type ScoreboardAttempt,
  type ScoreboardPlayer,
} from '../src/network/ranking';
import { describeEntry } from '../src/ui/scoreboard';

const NOW = 1_000_000;

const player = (userId: string, lastSeenMs = NOW): ScoreboardPlayer => ({ userId, nickname: userId, lastSeenMs });

let created = 0;
const attempt = (userId: string, fields: Partial<ScoreboardAttempt> = {}): ScoreboardAttempt => ({
  userId,
  status: 'running',
  phase: 'runner1',
  phaseProgress: 0,
  elapsedMs: 0,
  score: 0,
  bossHealth: 30000,
  createdMs: ++created,
  updatedMs: NOW,
  ...fields,
});

const finished = (userId: string, elapsedMs: number, score = 0, fields: Partial<ScoreboardAttempt> = {}) =>
  attempt(userId, { status: 'finished', phase: 'boss', bossHealth: 0, elapsedMs, score, ...fields });

const order = (players: ScoreboardPlayer[], attempts: ScoreboardAttempt[]) =>
  rankScoreboard(players, attempts, NOW).map((e) => e.userId);

describe('scoreboard ranking', () => {
  it('ranks completed runs by fastest time', () => {
    const ranked = rankScoreboard([player('slow'), player('fast')], [finished('slow', 90000), finished('fast', 60000)], NOW);
    expect(ranked.map((e) => [e.rank, e.userId, e.timeMs])).toEqual([
      [1, 'fast', 60000],
      [2, 'slow', 90000],
    ]);
  });

  it('breaks a tied time with the higher score', () => {
    expect(order([player('a'), player('b')], [finished('a', 60000, 100), finished('b', 60000, 900)])).toEqual(['b', 'a']);
  });

  it('puts any completed run above any run still going', () => {
    const attempts = [finished('done', 999999), attempt('boss', { phase: 'boss', bossHealth: 1 })];
    expect(order([player('boss'), player('done')], attempts)).toEqual(['done', 'boss']);
  });

  it("keeps a player's best completed time while they retry", () => {
    const ranked = rankScoreboard([player('a')], [finished('a', 70000), attempt('a', { phaseProgress: 0.2 })], NOW);
    expect(ranked[0]).toMatchObject({ state: 'finished', timeMs: 70000 });
  });

  it('ranks unfinished players by section before progress', () => {
    const attempts = [
      attempt('early', { phase: 'runner1', phaseProgress: 0.99 }),
      attempt('later', { phase: 'underwater', phaseProgress: 0.01 }),
    ];
    expect(order([player('early'), player('later')], attempts)).toEqual(['later', 'early']);
  });

  it('ranks by progress within the same section', () => {
    const attempts = [
      attempt('behind', { phase: 'runner2', phaseProgress: 0.3 }),
      attempt('ahead', { phase: 'runner2', phaseProgress: 0.6 }),
    ];
    expect(order([player('behind'), player('ahead')], attempts)).toEqual(['ahead', 'behind']);
  });

  it('measures boss progress as the share of health removed', () => {
    expect(sectionProgress({ phase: 'boss', phaseProgress: 0, bossHealth: 30000 })).toBe(0);
    expect(sectionProgress({ phase: 'boss', phaseProgress: 0, bossHealth: 7500 })).toBe(0.75);
    const attempts = [
      attempt('hurt-a-bit', { phase: 'boss', bossHealth: 20000, phaseProgress: 0.9 }),
      attempt('hurt-a-lot', { phase: 'boss', bossHealth: 5000, phaseProgress: 0.1 }),
    ];
    expect(order([player('hurt-a-bit'), player('hurt-a-lot')], attempts)).toEqual(['hurt-a-lot', 'hurt-a-bit']);
  });

  it("uses each player's latest attempt, and failed runs keep the section they failed in", () => {
    const attempts = [
      attempt('a', { phase: 'boss', bossHealth: 100, createdMs: 1 }), // older, further
      attempt('a', { phase: 'runner1', phaseProgress: 0.1, createdMs: 2 }), // latest
      attempt('b', { status: 'failed', phase: 'underwater', phaseProgress: 0.5, createdMs: 3 }),
    ];
    const ranked = rankScoreboard([player('a'), player('b')], attempts, NOW);
    expect(ranked.map((e) => [e.userId, e.state, e.phase])).toEqual([
      ['b', 'failed', 'underwater'],
      ['a', 'running', 'runner1'],
    ]);
  });

  it('lists players without an attempt last, as waiting', () => {
    const ranked = rankScoreboard([player('idle'), player('going')], [attempt('going')], NOW);
    expect(ranked.map((e) => [e.userId, e.state])).toEqual([
      ['going', 'running'],
      ['idle', 'waiting'],
    ]);
  });

  it('marks a player disconnected after 15 s without contact', () => {
    const at = (ms: number) => rankScoreboard([player('p', NOW - ms)], [], NOW)[0].disconnected;
    expect(at(DISCONNECT_AFTER_MS)).toBe(false);
    expect(at(DISCONNECT_AFTER_MS + 1)).toBe(true);
  });

  it('counts attempt updates as contact', () => {
    const ranked = rankScoreboard([player('p', NOW - 60000)], [attempt('p', { updatedMs: NOW - 1000 })], NOW);
    expect(ranked[0].disconnected).toBe(false);
  });

  it('ignores attempts from people no longer in the player list', () => {
    expect(order([player('here')], [attempt('gone', { phase: 'boss' })])).toEqual(['here']);
  });
});

describe('scoreboard labels', () => {
  const entry = rankScoreboard([player('p')], [attempt('p', { phase: 'underwater', phaseProgress: 0.456 })], NOW)[0];

  it('says what each player is doing', () => {
    expect(describeEntry(entry)).toBe('Underwater 46%');
    expect(describeEntry({ ...entry, state: 'finished', timeMs: 83450 })).toBe('1:23.45');
    expect(describeEntry({ ...entry, state: 'failed', phase: 'runner2' })).toBe('Out in Stage 2');
    expect(describeEntry({ ...entry, state: 'waiting' })).toBe('Ready');
  });
});
