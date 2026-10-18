// Multiplayer races (Tejas): the race score, the score-sorted leaderboard, races in test rooms,
// the QR join link and the pond layout.

import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { raceScore, type RaceScoreInput } from '../src/core/RunState';
import { createLocalRooms, memoryRoomStore } from '../src/network/localRooms';
import { rankStandings, type ScoreboardAttempt } from '../src/network/ranking';
import type { RunUpdate } from '../src/network/types';
import { joinUrl, linkIsLocalOnly } from '../src/ui/invite';
import { pondSpots } from '../src/ui/pond';

const run = (fields: Partial<RaceScoreInput> = {}): RaceScoreInput => ({
  phase: 'runner1',
  status: 'running',
  phaseDistance: 0,
  phaseLength: 100,
  bossHealth: CONFIG.boss.health,
  coins: 0,
  score: 0,
  lives: 3,
  elapsedMs: 0,
  ...fields,
});

describe('race score', () => {
  it('grows with distance through the run, coins and breadcrumbs', () => {
    const s = CONFIG.score;
    expect(raceScore(run())).toBe(0);
    expect(raceScore(run({ phaseDistance: 50 }))).toBe(s.perSection / 2);
    expect(raceScore(run({ phase: 'runner2', phaseDistance: 0, coins: 10, score: 300 }))).toBe(2 * s.perSection + 10 * s.perCoin + 300);
    // The boss section counts the damage dealt.
    expect(raceScore(run({ phase: 'boss', bossHealth: CONFIG.boss.health / 2 }))).toBe(3.5 * s.perSection);
  });

  it('ranks any finish above any run that died, and faster finishes higher', () => {
    const bestDeath = raceScore(run({ phase: 'boss', bossHealth: 1, coins: 130, score: 2000, status: 'failed' }));
    const slowFinish = raceScore(run({ phase: 'boss', bossHealth: 0, status: 'finished', lives: 1, elapsedMs: 600000 }));
    const fastFinish = raceScore(run({ phase: 'boss', bossHealth: 0, status: 'finished', lives: 1, elapsedMs: 70000 }));
    expect(slowFinish).toBeGreaterThan(bestDeath);
    expect(fastFinish).toBeGreaterThan(slowFinish);
    expect(fastFinish).toBeLessThanOrEqual(CONFIG.score.max);
  });
});

describe('race leaderboard', () => {
  const players = ['ann', 'bob', 'cat', 'dan'].map((id) => ({ userId: id, nickname: id.toUpperCase(), lastSeenMs: 1000 }));
  const attempt = (userId: string, fields: Partial<ScoreboardAttempt>): ScoreboardAttempt => ({
    userId,
    status: 'running',
    phase: 'runner1',
    phaseProgress: 0,
    elapsedMs: 0,
    score: 0,
    bossHealth: CONFIG.boss.health,
    createdMs: 1000,
    updatedMs: 1000,
    ...fields,
  });

  it('puts everyone on 0 before the race', () => {
    const rows = rankStandings(players, [], 1000);
    expect(rows.map((r) => [r.nickname, r.score, r.state])).toEqual([
      ['ANN', 0, 'waiting'],
      ['BOB', 0, 'waiting'],
      ['CAT', 0, 'waiting'],
      ['DAN', 0, 'waiting'],
    ]);
  });

  it('sorts by score, highest first, using each player\'s latest attempt', () => {
    const rows = rankStandings(
      players,
      [
        attempt('ann', { score: 40000, status: 'failed' }),
        attempt('bob', { score: 150000, status: 'finished', elapsedMs: 70000 }),
        attempt('cat', { score: 90000 }),
        attempt('cat', { score: 5000, createdMs: 500 }), // an older attempt doesn't count
      ],
      1000,
    );
    expect(rows.map((r) => `${r.rank}:${r.nickname}:${r.score}`)).toEqual(['1:BOB:150000', '2:CAT:90000', '3:ANN:40000', '4:DAN:0']);
    expect(rows[0].timeMs).toBe(70000);
  });

  it('breaks a tie with a finish, then the faster time', () => {
    const rows = rankStandings(
      players.slice(0, 3),
      [
        attempt('ann', { score: 100, status: 'failed' }),
        attempt('bob', { score: 100, status: 'finished', elapsedMs: 90000 }),
        attempt('cat', { score: 100, status: 'finished', elapsedMs: 80000 }),
      ],
      1000,
    );
    expect(rows.map((r) => r.nickname)).toEqual(['CAT', 'BOB', 'ANN']);
  });
});

describe('races in test rooms', () => {
  const update = (fields: Partial<RunUpdate>): RunUpdate => ({
    attemptId: 'a1',
    status: 'running',
    phase: 'runner1',
    phaseProgress: 0.5,
    lives: 3,
    score: 12000,
    bossHealth: CONFIG.boss.health,
    elapsedMs: 5000,
    ...fields,
  });

  it('shares each player\'s run, keeps final results, and clears them for the next race', async () => {
    const store = memoryRoomStore();
    const host = createLocalRooms(store);
    const guest = createLocalRooms(store);
    const room = await host.createRoom('Tejas');
    await guest.joinRoom(room.code, 'Mayank');

    let seen: { name: string; score: number; state: string }[] = [];
    host.onStandings((rows) => (seen = rows.map((r) => ({ name: r.nickname, score: r.score, state: r.state }))));
    expect(seen.every((r) => r.score === 0 && r.state === 'waiting')).toBe(true);

    await host.startRoom();
    guest.publishRun(update({ score: 20000 }));
    host.publishRun(update({ score: 9000 }));
    expect(seen).toEqual([
      { name: 'Mayank', score: 20000, state: 'running' },
      { name: 'Tejas', score: 9000, state: 'running' },
    ]);

    guest.publishRun(update({ status: 'failed', score: 30000 }));
    guest.publishRun(update({ status: 'running', score: 1 })); // stale, after the run ended
    expect(seen[0]).toEqual({ name: 'Mayank', score: 30000, state: 'failed' });

    // The host reopens the room: results stay on the board, and late players can join. The board is
    // still the last race's results, so the newcomer isn't on it until they race.
    await host.reopenRoom();
    expect(seen[0].score).toBe(30000);
    const late = createLocalRooms(store);
    await late.joinRoom(room.code, 'Rayyan');
    expect(seen.map((r) => r.name)).toEqual(['Mayank', 'Tejas']);

    // The next race clears the board; everyone who races shows up on it, the newcomer included.
    const starts: number[] = [];
    guest.onStart((at) => starts.push(at));
    await host.startRoom();
    expect(starts).toHaveLength(1);
    expect(seen).toEqual([]);
    late.publishRun(update({ score: 500 }));
    guest.publishRun(update({ score: 400 }));
    expect(seen.map((r) => [r.name, r.score])).toEqual([
      ['Rayyan', 500],
      ['Mayank', 400],
    ]);
  });

  it('keeps someone who never raced (a big-screen host) off the board once a race has started', async () => {
    const store = memoryRoomStore();
    const host = createLocalRooms(store);
    const guest = createLocalRooms(store);
    const room = await host.createRoom('Big Screen');
    await guest.joinRoom(room.code, 'Mayank');
    let seen: string[] = [];
    guest.onStandings((rows) => (seen = rows.map((r) => r.nickname)));
    expect(seen).toEqual(['Big Screen', 'Mayank']); // before any race, everyone on 0

    await host.startRoom();
    guest.publishRun(update({ status: 'failed', score: 9000 }));
    expect(seen).toEqual(['Mayank']);
  });

  it('only lets the host reopen the room', async () => {
    const store = memoryRoomStore();
    const host = createLocalRooms(store);
    const guest = createLocalRooms(store);
    const room = await host.createRoom('Tejas');
    await guest.joinRoom(room.code, 'Mayank');
    await host.startRoom();
    await guest.reopenRoom();
    expect(store.read(room.code)?.startAt).not.toBeNull();
  });
});

describe('QR join link', () => {
  const at = (href: string) => {
    const u = new URL(href);
    return { protocol: u.protocol, hostname: u.hostname, port: u.port, origin: u.origin, pathname: u.pathname };
  };

  it('links to the room on the address the page was opened on', () => {
    expect(joinUrl('QUAK', at('https://duckrun.example/'))).toBe('https://duckrun.example/?room=QUAK');
    expect(linkIsLocalOnly('https://duckrun.example/?room=QUAK')).toBe(false);
  });

  it('knows a localhost link only works on this computer', () => {
    expect(linkIsLocalOnly('http://localhost:5173/?room=QUAK')).toBe(true);
  });
});

describe('pond layout', () => {
  it('gives every duck its own spot inside the pond', () => {
    for (const n of [1, 2, 5, 12, 20]) {
      const spots = pondSpots(n);
      expect(spots).toHaveLength(n);
      for (const s of spots) {
        // Inside the pond's oval (centre 50,60; radii 36,30).
        expect(((s.x - 50) / 36) ** 2 + ((s.y - 60) / 30) ** 2).toBeLessThanOrEqual(1.0001);
      }
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThan(3);
        }
      }
    }
  });
});
