import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSupabaseRooms, parseTimestamp, readableError, type OnlineRoomApi } from '../src/network/supabaseRooms';
import type { RoomPlayer } from '../src/network/types';

type Row = Record<string, unknown>;
type RpcResult = { data?: unknown; error?: { message: string } };

/** The server's clock runs this far ahead of the test's, to prove the start time is corrected. */
const SERVER_AHEAD_MS = 10000;
const ME = 'user-me';
const ROOM = 'room-1';

/**
 * Just enough of a Supabase client: rpc() answers from `handler`, from() reads `tables`, and
 * Realtime handlers can be fired by hand. Stands in for the real database functions.
 */
function fakeSupabase(handler: (fn: string, args: Row) => RpcResult) {
  const tables: Record<string, Row[]> = { rooms: [], room_players: [] };
  const calls: string[] = [];
  const realtime: (() => void)[] = [];

  const query = (table: string) => {
    const filters: [string, unknown][] = [];
    const rows = () => tables[table].filter((r) => filters.every(([c, v]) => r[c] === v));
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => (filters.push([column, value]), builder),
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
    };
    return builder;
  };

  const channel = {
    on: (_type: string, _filter: unknown, callback: () => void) => (realtime.push(callback), channel),
    subscribe: () => channel,
  };

  const client = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: ME } } } }),
      signInAnonymously: async () => ({ data: { user: { id: ME } }, error: null }),
    },
    rpc: async (fn: string, args: Row) => {
      calls.push(fn);
      const result = handler(fn, args);
      return { data: result.data ?? null, error: result.error ?? null };
    },
    from: query,
    channel: () => channel,
    removeChannel: async () => 'ok',
  };

  return { client: client as unknown as SupabaseClient, tables, calls, realtime };
}

const serverNow = () => Date.now() + SERVER_AHEAD_MS;

const roomRow = (fields: Row = {}): Row => ({
  room_id: ROOM,
  code: 'QUAK',
  seed: 42,
  is_host: true,
  status: 'waiting',
  start_at_ms: null,
  server_now_ms: serverNow(),
  ...fields,
});

const opened: OnlineRoomApi[] = [];
const open = (client: SupabaseClient) => {
  const api = createSupabaseRooms(client);
  opened.push(api);
  return api;
};

afterEach(async () => {
  await Promise.all(opened.splice(0).map((api) => api.leaveRoom())); // stops heartbeats
});

describe('online rooms', () => {
  it('creates a room, with the signed-in player as host', async () => {
    const fake = fakeSupabase((fn) => (fn === 'create_room' ? { data: roomRow() } : {}));
    fake.tables.rooms.push({ id: ROOM, host_id: ME, status: 'waiting', start_at: null });
    fake.tables.room_players.push({ room_id: ROOM, user_id: ME, nickname: 'Mayank' });
    const rooms = open(fake.client);

    const info = await rooms.createRoom('  Mayank ');
    expect(info).toEqual({ code: 'QUAK', seed: 42, playerId: ME, isHost: true });
    expect(rooms.roomId()).toBe(ROOM);

    let seen: RoomPlayer[] = [];
    rooms.onPlayersChanged((p) => (seen = p));
    expect(seen).toEqual([{ id: ME, nickname: 'Mayank', isHost: true }]);
  });

  it('gives readable errors for a wrong code, a bad code and a taken nickname', async () => {
    const fake = fakeSupabase((fn, args) => {
      if (fn !== 'join_room') return {};
      if (args.p_code === 'ZZZZ') return { data: { error: 'room_not_found' } };
      return { error: { message: 'nickname_taken' } };
    });
    const rooms = open(fake.client);

    await expect(rooms.joinRoom('zzzz', 'Rayyan')).rejects.toThrow(/No room called ZZZZ/);
    await expect(rooms.joinRoom('IOIO', 'Rayyan')).rejects.toThrow(/No room called IOIO/);
    expect(fake.calls).toEqual(['join_room']); // IOIO can't be a code, so the server isn't asked
    await expect(rooms.joinRoom('QUAK', 'Mayank')).rejects.toThrow(/already has that nickname/);
    await expect(rooms.joinRoom('QUAK', ' ')).rejects.toThrow(/nickname/);
  });

  it('maps every server error code, and hides unknown ones behind a generic message', () => {
    expect(readableError({ message: 'room_full' }).message).toMatch(/full/);
    expect(readableError({ message: 'rate_limited' }).message).toMatch(/Wait a minute/);
    expect(readableError({ message: 'not_host' }).message).toMatch(/host/);
    const quiet = console.error;
    console.error = () => {};
    expect(readableError(new TypeError('Failed to fetch')).message).toMatch(/connection/);
    console.error = quiet;
  });

  it("starts the host's countdown in local time, corrected for the server's clock, once", async () => {
    const fake = fakeSupabase((fn) => {
      if (fn === 'create_room') return { data: roomRow() };
      if (fn === 'start_room') return { data: roomRow({ status: 'started', start_at_ms: serverNow() + 3000 }) };
      return {};
    });
    fake.tables.rooms.push({ id: ROOM, host_id: ME, status: 'waiting', start_at: null });
    const rooms = open(fake.client);
    await rooms.createRoom('Mayank');

    const starts: number[] = [];
    rooms.onStart((at) => starts.push(at));
    await rooms.startRoom();
    expect(starts).toHaveLength(1);
    expect(Math.abs(starts[0] - (Date.now() + 3000))).toBeLessThan(100);

    // Realtime then reports the same start: it must not start the run a second time.
    fake.tables.rooms[0] = { id: ROOM, host_id: ME, status: 'started', start_at: new Date(serverNow() + 3000).toISOString() };
    fake.realtime.forEach((notify) => notify());
    await new Promise((r) => setTimeout(r, 200));
    expect(starts).toHaveLength(1);
  });

  it('only lets the host start, and picks up a host handover', async () => {
    const fake = fakeSupabase((fn) => (fn === 'join_room' ? { data: roomRow({ is_host: false }) } : {}));
    fake.tables.rooms.push({ id: ROOM, host_id: 'someone-else', status: 'waiting', start_at: null });
    const rooms = open(fake.client);
    await rooms.joinRoom('QUAK', 'Rayyan');
    await expect(rooms.startRoom()).rejects.toThrow(/host/);

    // The host left: the server handed host to us and removed them.
    fake.tables.rooms[0].host_id = ME;
    fake.tables.room_players.push({ room_id: ROOM, user_id: ME, nickname: 'Rayyan' });
    fake.realtime.forEach((notify) => notify());
    await new Promise((r) => setTimeout(r, 200));
    let seen: RoomPlayer[] = [];
    rooms.onPlayersChanged((p) => (seen = p));
    expect(seen).toEqual([{ id: ME, nickname: 'Rayyan', isHost: true }]);
    await expect(rooms.startRoom()).resolves.toBeUndefined();
  });

  it('gives a fresh countdown when rejoining a room that started a while ago', async () => {
    const longAgo = serverNow() - 60000;
    const fake = fakeSupabase((fn) =>
      fn === 'join_room' ? { data: roomRow({ is_host: false, status: 'started', start_at_ms: longAgo }) } : {},
    );
    fake.tables.rooms.push({ id: ROOM, host_id: 'host', status: 'started', start_at: new Date(longAgo).toISOString() });
    const rooms = open(fake.client);
    await rooms.joinRoom('QUAK', 'Rayyan'); // e.g. after a page refresh

    // The lobby subscribes only after joinRoom resolves; it still hears about the start.
    const starts: number[] = [];
    rooms.onStart((at) => starts.push(at));
    await Promise.resolve();
    expect(starts).toHaveLength(1);
    expect(starts[0]).toBeGreaterThanOrEqual(Date.now() + CONFIG.flow.countdownSec * 1000 - 100);
  });

  it('tells the server when leaving and empties the player list', async () => {
    const fake = fakeSupabase((fn) => (fn === 'create_room' ? { data: roomRow() } : {}));
    fake.tables.rooms.push({ id: ROOM, host_id: ME, status: 'waiting', start_at: null });
    fake.tables.room_players.push({ room_id: ROOM, user_id: ME, nickname: 'Mayank' });
    const rooms = open(fake.client);
    await rooms.createRoom('Mayank');
    let seen: RoomPlayer[] = [];
    rooms.onPlayersChanged((p) => (seen = p));

    await rooms.leaveRoom();
    expect(fake.calls).toContain('leave_room');
    expect(seen).toEqual([]);
    expect(rooms.roomId()).toBeNull();
  });
});

describe('timestamps from the database', () => {
  it('parses microsecond timestamps to the millisecond', () => {
    expect(parseTimestamp('2026-10-17T16:00:00.123456+00:00')).toBe(Date.UTC(2026, 9, 17, 16, 0, 0, 123));
    expect(parseTimestamp('2026-10-17T16:00:00+00:00')).toBe(Date.UTC(2026, 9, 17, 16, 0, 0));
  });
});
