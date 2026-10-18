// Big-screen mode (Tejas): where each duck sits on the track, when the race is over, what the
// commentary shouts, and who gets a lane.

import { describe, expect, it } from 'vitest';
import type { ScoreboardEntry } from '../src/network/ranking';
import { commentary, raceIsOver, shouldCallLead, stadiumLanes, trackPosition } from '../src/ui/stadium';

const entry = (userId: string, fields: Partial<ScoreboardEntry> = {}): ScoreboardEntry => ({
  rank: 1,
  userId,
  nickname: userId.toUpperCase(),
  state: 'running',
  timeMs: null,
  score: 0,
  phase: 'runner1',
  progress: 0,
  disconnected: false,
  ...fields,
});

describe('track position', () => {
  it('moves through the four sections in order, from start to finish', () => {
    expect(trackPosition(entry('a', { state: 'waiting' }))).toBe(0);
    expect(trackPosition(entry('a', { phase: 'runner1', progress: 0.5 }))).toBe(0.125);
    expect(trackPosition(entry('a', { phase: 'underwater', progress: 0 }))).toBe(0.25);
    expect(trackPosition(entry('a', { phase: 'boss', progress: 0.5 }))).toBe(0.875);
    expect(trackPosition(entry('a', { state: 'finished', phase: 'boss', progress: 1 }))).toBe(1);
  });

  it('keeps a racer who is out where they went out', () => {
    expect(trackPosition(entry('a', { state: 'failed', phase: 'runner2', progress: 0.4 }))).toBeCloseTo(0.6);
  });
});

describe('race over', () => {
  it('waits until everyone has finished or is out', () => {
    const lanes = [entry('a', { state: 'finished' }), entry('b', { state: 'running' })];
    expect(raceIsOver(lanes, 30)).toBe(false);
    expect(raceIsOver([entry('a', { state: 'finished' }), entry('b', { state: 'failed' })], 30)).toBe(true);
  });

  it("doesn't wait for someone who left or whose phone dropped out", () => {
    const lanes = [entry('a', { state: 'failed' }), entry('b', { left: true }), entry('c', { disconnected: true })];
    expect(raceIsOver(lanes, 30)).toBe(true);
  });

  it('only gives up on a no-show after a while', () => {
    const lanes = [entry('a', { state: 'finished' }), entry('b', { state: 'waiting' })];
    expect(raceIsOver(lanes, 5)).toBe(false);
    expect(raceIsOver(lanes, 25)).toBe(true);
  });

  it('is never over before it starts, or with nobody racing', () => {
    expect(raceIsOver([entry('a', { state: 'waiting' })], 0)).toBe(false);
    expect(raceIsOver([], 60)).toBe(false);
    expect(raceIsOver([entry('a', { state: 'waiting' })], 60)).toBe(false); // no result to show yet
  });
});

describe('commentary', () => {
  it('calls out sections, crashes and wins', () => {
    const before = [
      entry('ann', { rank: 1, score: 30000, phase: 'runner1' }),
      entry('bob', { rank: 2, score: 20000, phase: 'runner2' }),
      entry('cat', { rank: 3, score: 10000, phase: 'boss' }),
    ];
    const after = [
      entry('cat', { rank: 1, score: 190000, phase: 'boss', state: 'finished', timeMs: 72340 }),
      entry('ann', { rank: 2, score: 31000, phase: 'underwater' }),
      entry('bob', { rank: 3, score: 21000, phase: 'runner2', state: 'failed' }),
    ];
    expect(commentary(before, after)).toEqual([
      '🏆 CAT beat the Don in 1:12.34!',
      '🌊 ANN dives into the pond!',
      '🪵 BOB crashed out in Stage 2!',
    ]);
  });

  it('never announces a section going backwards (a late, stale update)', () => {
    expect(commentary([entry('ann', { phase: 'boss' })], [entry('ann', { phase: 'runner2' })])).toEqual([]);
  });

  it('calls each section once per racer, even if a stale update sends them back and forward again', () => {
    const furthest = new Map<string, number>();
    const r1 = entry('ann', { phase: 'runner1' });
    const pond = entry('ann', { phase: 'underwater' });
    expect(commentary([r1], [pond], furthest)).toEqual(['🌊 ANN dives into the pond!']);
    expect(commentary([pond], [r1], furthest)).toEqual([]);
    expect(commentary([r1], [pond], furthest)).toEqual([]);
  });

  it('stays quiet when nothing has changed, or for players it has not seen before', () => {
    const rows = [entry('ann', { score: 5000 })];
    expect(commentary(rows, rows)).toEqual([]);
    expect(commentary([], rows)).toEqual([]);
  });

  it("says when the Don gets someone, and when someone leaves", () => {
    expect(commentary([entry('ann', { phase: 'boss' })], [entry('ann', { phase: 'boss', state: 'failed' })])).toEqual([
      '💀 Don Crumbs got ANN!',
    ]);
    expect(commentary([entry('ann', { state: 'failed' })], [entry('ann', { state: 'failed', left: true })])).toEqual([
      '👋 ANN left the race.',
    ]);
  });
});

describe('lead calls', () => {
  const cat = { userId: 'cat', score: 50000 };

  it('calls a new leader once the race has settled', () => {
    expect(shouldCallLead(cat, 'ann', 10000, 20)).toBe(true);
  });

  it('stays quiet at the start, for the same leader, with no points, or too soon after the last call', () => {
    expect(shouldCallLead(cat, null, Infinity, 3)).toBe(false); // the scramble off the line
    expect(shouldCallLead(cat, 'cat', Infinity, 20)).toBe(false); // already called
    expect(shouldCallLead({ userId: 'cat', score: 0 }, null, Infinity, 20)).toBe(false);
    expect(shouldCallLead(cat, 'ann', 1500, 20)).toBe(false); // two close racers would flip-flop
    expect(shouldCallLead(undefined, null, Infinity, 20)).toBe(false);
  });
});

describe('lanes', () => {
  it('gives everyone in the room a lane except the big screen, plus anyone who raced and left', () => {
    const players = [
      { id: 'screen', nickname: 'Tejas', isHost: true },
      { id: 'ann', nickname: 'Ann', isHost: false },
      { id: 'bob', nickname: 'Bob', isHost: false },
    ];
    const standings = [entry('ann', { score: 900 }), entry('gone', { left: true, state: 'failed' })];
    const lanes = stadiumLanes(players, standings, 'screen');
    expect(lanes.map((l) => [l.userId, l.state])).toEqual([
      ['ann', 'running'],
      ['bob', 'waiting'],
      ['gone', 'failed'],
    ]);
  });
});
