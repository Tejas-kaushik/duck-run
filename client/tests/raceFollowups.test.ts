// Mayank's review of the room races (Tejas): players who leave after racing stay on the board,
// a run's final result is re-sent until it lands, and the host role passes on when the host leaves.

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createLocalRooms, memoryRoomStore } from '../src/network/localRooms';
import { LEFT_PLAYER_NAME, rankStandings, type ScoreboardAttempt } from '../src/network/ranking';
import { FINAL_RETRIES, FINAL_RETRY_MS, createSupabaseRooms } from '../src/network/supabaseRooms';
import type { RunUpdate } from '../src/network/types';

const attempt = (userId: string, fields: Partial<ScoreboardAttempt> = {}): ScoreboardAttempt => ({
  userId,
  status: 'finished',
  phase: 'boss',
  phaseProgress: 0,
  elapsedMs: 70000,
  score: 150000,
  bossHealth: 0,
  createdMs: 1000,
  updatedMs: 1000,
  ...fields,
});

const run = (fields: Partial<RunUpdate> = {}): RunUpdate => ({
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

describe('players who leave after racing', () => {
  it('keep their result on the board, by name when known', () => {
    const rows = rankStandings(
      [{ userId: 'stay', nickname: 'Tejas', lastSeenMs: 1000 }],
      [attempt('stay', { score: 90000, status: 'failed' }), attempt('gone'), attempt('ghost', { score: 50, status: 'failed' })],
      1000,
      new Map([['gone', 'Mayank']]),
    );
    expect(rows.map((r) => [r.rank, r.nickname, r.score, !!r.left])).toEqual([
      [1, 'Mayank', 150000, true],
      [2, 'Tejas', 90000, false],
      [3, LEFT_PLAYER_NAME, 50, true],
    ]);
  });

  it('stay on a test room\'s board after leaving a reopened room', async () => {
    const store = memoryRoomStore();
    const host = createLocalRooms(store);
    const guest = createLocalRooms(store);
    const room = await host.createRoom('Tejas');
    await guest.joinRoom(room.code, 'Mayank');
    await host.startRoom();
    guest.publishRun(run({ status: 'failed', score: 30000 }));
    await host.reopenRoom();
    await guest.leaveRoom();

    let seen: { name: string; score: number; left: boolean }[] = [];
    host.onStandings((rows) => (seen = rows.map((r) => ({ name: r.nickname, score: r.score, left: !!r.left }))));
    expect(seen).toContainEqual({ name: 'Mayank', score: 30000, left: true });
  });
});

describe('host handover in test rooms', () => {
  it('makes the earliest joiner the host when the host leaves', async () => {
    const store = memoryRoomStore();
    const host = createLocalRooms(store);
    const first = createLocalRooms(store);
    const second = createLocalRooms(store);
    const room = await host.createRoom('Tejas');
    const a = await first.joinRoom(room.code, 'Mayank');
    const b = await second.joinRoom(room.code, 'Rayyan');

    let players: { nickname: string; isHost: boolean }[] = [];
    first.onPlayersChanged((p) => (players = p.map(({ nickname, isHost }) => ({ nickname, isHost }))));
    await host.leaveRoom();

    expect(players).toEqual([
      { nickname: 'Mayank', isHost: true },
      { nickname: 'Rayyan', isHost: false },
    ]);
    expect(a.isHost).toBe(true); // the lobby shows Start from this
    expect(b.isHost).toBe(false);
    await first.startRoom(); // and the new host really can start
    expect(store.read(room.code)?.startAt).not.toBeNull();
  });
});

describe("a run's final result", () => {
  /** Just enough of Supabase for one room, with attempt updates that fail `failUpdates` times first. */
  function fakeServer(failUpdates: number) {
    const updates: Record<string, unknown>[] = [];
    let failures = 0;
    const tables: Record<string, Record<string, unknown>[]> = {
      rooms: [{ id: 'room-1', host_id: 'me', status: 'started', start_at: new Date().toISOString() }],
      room_players: [{ room_id: 'room-1', user_id: 'me', nickname: 'Tejas' }],
    };
    const select = (table: string) => {
      const b = {
        select: () => b,
        eq: () => b,
        order: () => b,
        limit: () => b,
        maybeSingle: async () => ({ data: tables[table]?.[0] ?? null, error: null }),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(ok),
      };
      return b;
    };
    const client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } } }) },
      rpc: async (fn: string) =>
        fn === 'create_room'
          ? { data: { room_id: 'room-1', code: 'QUAK', seed: 1, is_host: true, status: 'waiting', start_at_ms: null, server_now_ms: Date.now() }, error: null }
          : { data: Date.now(), error: null },
      from: (table: string) => ({
        ...select(table),
        insert: async () => ({ error: null }),
        update: (row: Record<string, unknown>) => {
          const chain = {
            eq: () => chain,
            then: (ok: (v: unknown) => unknown) => {
              const fail = failures < failUpdates;
              if (fail) failures++;
              else updates.push(row);
              return Promise.resolve({ error: fail ? { message: 'network down' } : null }).then(ok);
            },
          };
          return chain;
        },
      }),
      channel: () => {
        const c = { on: () => c, subscribe: () => c };
        return c;
      },
      removeChannel: async () => 'ok',
    };
    return { client: client as unknown as SupabaseClient, updates };
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is re-sent every couple of seconds until it lands', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const server = fakeServer(3);
    const rooms = createSupabaseRooms(server.client);
    await rooms.createRoom('Tejas');

    rooms.publishRun(run({ status: 'failed', phase: 'boss', score: 76500, lives: 0 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(server.updates).toHaveLength(0); // the first send failed

    await vi.advanceTimersByTimeAsync(FINAL_RETRY_MS * 3);
    expect(server.updates).toHaveLength(1);
    expect(server.updates[0]).toMatchObject({ status: 'failed', score: 76500 });

    // Once it has landed, nothing more is sent.
    await vi.advanceTimersByTimeAsync(FINAL_RETRY_MS * 5);
    expect(server.updates).toHaveLength(1);
    await rooms.leaveRoom();
  });

  it('gives up after about a minute if the server keeps refusing it', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const server = fakeServer(Infinity);
    const rooms = createSupabaseRooms(server.client);
    await rooms.createRoom('Tejas');

    rooms.publishRun(run({ status: 'failed', phase: 'boss', lives: 0 }));
    await vi.advanceTimersByTimeAsync(FINAL_RETRY_MS * (FINAL_RETRIES + 5));
    expect(warn).toHaveBeenCalledWith('[rooms] gave up sending the final result after', FINAL_RETRIES, 'retries');
    await rooms.leaveRoom();
  });

  it('does not retry ordinary progress updates (the next one replaces it)', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const server = fakeServer(1);
    const rooms = createSupabaseRooms(server.client);
    await rooms.createRoom('Tejas');

    rooms.publishRun(run()); // inserts the row
    rooms.publishRun(run({ score: 13000 })); // this update fails
    await vi.advanceTimersByTimeAsync(FINAL_RETRY_MS * 5);
    expect(server.updates).toHaveLength(0);
    await rooms.leaveRoom();
  });
});
