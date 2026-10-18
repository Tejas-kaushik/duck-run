// Online rooms (Mayank): the real backend behind the same RoomApi as localRooms.ts, so the lobby
// doesn't change. Rooms, players and the shared start live in Supabase (supabase/migrations).
//
// How it stays in sync:
//   * create/join/start/leave go through the database functions, never direct table writes.
//   * Realtime tells us when room_players or rooms change; we then re-read both tables.
//   * A heartbeat every 5 s marks us as present, keeps the server clock offset fresh, and
//     re-reads the room too (Realtime can't filter delete events, so leaves are caught here).
//   * The start time comes from the server and is converted to this tab's Date.now() time.
//   * Races (Tejas): each player's run is an `attempts` row, sent a couple of times a second. The
//     leaderboard is the attempts created since the latest start. After a race the host reopens the
//     room (reset_room, migration 20261017210000) so it can race again and new players can join.

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '../core/config';
import { cleanNickname } from './localRooms';
import { rankStandings, type ScoreboardEntry } from './ranking';
import { watchScoreboard } from './supabaseScoreboard';
import { createServerClock, type ServerClock } from './serverClock';
import { ensureSignedIn, getSupabase } from './supabase';
import type { RoomApi, RoomInfo, RoomPlayer, RunUpdate } from './types';

const HEARTBEAT_MS = 5000;
/** Realtime often sends several changes at once (e.g. a host handover); re-read once for all of them. */
const REFRESH_DEBOUNCE_MS = 150;
const CODE_PATTERN = /^[A-HJ-NP-Z]{4}$/;
/** Start times this close together are the same race (reported twice, e.g. by the reply and by Realtime). */
const SAME_RACE_MS = 5000;
/** A run's final result (finished/failed) that fails to send is re-sent this often, up to this many times (about a minute). */
export const FINAL_RETRY_MS = 2000;
export const FINAL_RETRIES = 30;

/** The error codes raised by the database functions, as messages the lobby can show as-is. */
const ERROR_MESSAGES: Record<string, string> = {
  not_signed_in: 'You are not signed in. Refresh the page and try again.',
  invalid_nickname: 'Nicknames can use letters, numbers, spaces and _ . - (1 to 16 characters).',
  nickname_taken: 'Someone in this room already has that nickname. Pick another one.',
  room_not_found: 'No room with that code. Check the code with your host.',
  room_already_started: 'That room has already started. Ask the host to start a new challenge.',
  room_full: 'That room is full (20 players).',
  not_host: 'Only the host can start.',
  rate_limited: 'Too many tries. Wait a minute and try again.',
  could_not_create_room: 'Could not make a room code. Try again.',
};

/** Turns a Supabase error into a readable Error. Unknown errors are logged and shown generically. */
export function readableError(error: unknown): Error {
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
  for (const [code, text] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(code)) return new Error(text);
  }
  console.error('[rooms]', error);
  return new Error('Could not reach the game server. Check your connection and try again.');
}

/** What create_room, join_room and start_room return (private.room_json in the migration). */
interface RoomRow {
  room_id: string;
  code: string;
  seed: number;
  is_host: boolean;
  status: 'waiting' | 'started';
  start_at_ms: number | null;
  server_now_ms: number;
}

/** PostgREST timestamps have microseconds; keep milliseconds so every browser can parse them. */
export function parseTimestamp(value: string): number {
  return Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
}

export interface OnlineRoomApi extends RoomApi {
  readonly mode: 'online';
  /** The database id of the room we're in (attempts and the scoreboard use it), or null. */
  roomId(): string | null;
  /** Server time of the latest race's start (its attempts are the ones created after it), or null before the first. */
  raceStartServerMs(): number | null;
  /** Server time, for comparing against server timestamps such as last_seen_at. */
  readonly clock: ServerClock;
  readonly supabase: SupabaseClient;
}

interface CurrentRoom {
  roomId: string;
  info: RoomInfo;
}

export function createSupabaseRooms(supabase: SupabaseClient = getSupabase()): OnlineRoomApi {
  const clock = createServerClock();
  const playerListeners = new Set<(players: RoomPlayer[]) => void>();
  const startListeners = new Set<(startAt: number) => void>();

  let current: CurrentRoom | null = null;
  let channel: RealtimeChannel | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let players: RoomPlayer[] = [];
  let playersKey = '';
  /** The start time already handed to the lobby, in Date.now() time. */
  /** The room whose first race (the one with the story) has been started, so rematches skip it. */
  let storyPlayedIn: string | null = null;
  let startAt: number | null = null;
  /** The server start time of the race already announced: one announcement per race. */
  let announcedServerStart: number | null = null;
  let raceStart: number | null = null;
  const standingListeners = new Set<(rows: ScoreboardEntry[]) => void>();
  let standings: ScoreboardEntry[] | null = null;
  let stopStandings: (() => void) | null = null;
  /** Per attempt: the last seq sent, whether its row exists yet, and whether it has ended. */
  const sentRuns = new Map<string, { seq: number; inserted: boolean; final: boolean }>();
  let nextRun: RunUpdate | null = null;
  let sendingRuns = false;
  let finalRetryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Failed sends of each attempt's final result, so a result the server keeps refusing isn't retried forever. */
  const finalFailures = new Map<string, number>();

  /** Calls a database function and records the server time it returns. */
  const call = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
    const sentAt = Date.now();
    const { data, error } = await supabase.rpc(fn, args);
    const receivedAt = Date.now();
    if (error) throw readableError(error);
    const serverNow = typeof data === 'number' ? data : (data as { server_now_ms?: unknown } | null)?.server_now_ms;
    if (typeof serverNow === 'number') clock.sample(sentAt, receivedAt, serverNow);
    return data as T;
  };

  const setPlayers = (list: RoomPlayer[]) => {
    const key = JSON.stringify(list);
    if (key === playersKey) return;
    players = list;
    playersKey = key;
    playerListeners.forEach((l) => l(list));
  };

  /**
   * Hand the shared start to the lobby, once. Rejoining a room that started a while ago (a page
   * refresh mid-race) gets a fresh countdown instead of a start time in the past.
   */
  const announceStart = (serverStartMs: number) => {
    if (announcedServerStart !== null && Math.abs(announcedServerStart - serverStartMs) < SAME_RACE_MS) return;
    announcedServerStart = serverStartMs;
    raceStart = serverStartMs;
    const local = clock.toLocal(serverStartMs);
    startAt = local > Date.now() ? local : Date.now() + CONFIG.flow.countdownSec * 1000;
    const at = startAt;
    startListeners.forEach((l) => l(at));
  };

  /** Re-read the player list, the host and the start time. Offline? Keep the last list and retry later. */
  const refresh = async () => {
    const room = current;
    if (!room) return;
    const [playerRows, roomRow] = await Promise.all([
      supabase
        .from('room_players')
        .select('user_id, nickname')
        .eq('room_id', room.roomId)
        .order('joined_at')
        .order('user_id'),
      supabase.from('rooms').select('host_id, status, start_at').eq('id', room.roomId).maybeSingle(),
    ]);
    if (room !== current || playerRows.error || roomRow.error || !roomRow.data) return;

    const hostId = roomRow.data.host_id as string;
    // A leaving host hands over to the next player; keep isHost honest for startRoom().
    room.info.isHost = hostId === room.info.playerId;
    setPlayers(
      (playerRows.data as { user_id: string; nickname: string }[]).map((p) => ({
        id: p.user_id,
        nickname: p.nickname,
        isHost: p.user_id === hostId,
      })),
    );
    if (roomRow.data.status === 'started' && roomRow.data.start_at) {
      announceStart(parseTimestamp(roomRow.data.start_at as string));
    }
  };

  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void refresh();
    }, REFRESH_DEBOUNCE_MS);
  };

  const beat = async () => {
    const room = current;
    if (!room) return;
    try {
      await call<number>('heartbeat', { p_room_id: room.roomId });
    } catch {
      // Offline for a moment: the next beat tries again. Other players see us as disconnected after 15 s.
    }
    await refresh();
  };

  /** Stop listening to the current room. Doesn't tell the server (leaveRoom() does that). */
  const teardown = () => {
    if (heartbeat) clearInterval(heartbeat);
    if (refreshTimer) clearTimeout(refreshTimer);
    if (channel) void supabase.removeChannel(channel);
    if (finalRetryTimer) clearTimeout(finalRetryTimer);
    heartbeat = null;
    refreshTimer = null;
    finalRetryTimer = null;
    channel = null;
    current = null;
    startAt = null;
    announcedServerStart = null;
    raceStart = null;
    stopStandings?.();
    stopStandings = null;
    standings = null;
    setPlayers([]);
  };

  /** Everyone on 0 until the first attempts arrive. */
  const zeroStandings = (): ScoreboardEntry[] => {
    const now = clock.serverNow();
    return rankStandings(players.map((p) => ({ userId: p.id, nickname: p.nickname, lastSeenMs: now })), [], now);
  };

  const emitStandings = (rows: ScoreboardEntry[]) => {
    standings = rows;
    standingListeners.forEach((l) => l(rows));
  };

  /** The leaderboard feed runs while someone is listening and we're in a room. */
  const watchStandings = () => {
    if (stopStandings || !current || standingListeners.size === 0) return;
    stopStandings = watchScoreboard(api, emitStandings);
  };

  /**
   * Sends one run update: the row is created (as 'running') on its first update, then updated.
   * Returns false if it didn't reach the server.
   */
  const sendRun = async (run: RunUpdate): Promise<boolean> => {
    const room = current;
    if (!room) return true; // left the room: nothing to send to
    const sent = sentRuns.get(run.attemptId) ?? { seq: 0, inserted: false, final: false };
    sentRuns.set(run.attemptId, sent);
    if (sent.final) return true;
    const fields = {
      phase: run.phase,
      phase_progress: Math.min(1, Math.max(0, run.phaseProgress)),
      elapsed_ms: Math.max(0, Math.round(run.elapsedMs)),
      lives: Math.min(4, Math.max(0, run.lives)),
      score: Math.max(0, Math.round(run.score)),
      boss_health: Math.max(0, Math.round(run.bossHealth)),
    };
    if (!sent.inserted) {
      const { error } = await supabase
        .from('attempts')
        .insert({ ...fields, room_id: room.roomId, client_attempt_id: run.attemptId, seq: sent.seq, status: 'running' });
      if (error) {
        console.warn('[rooms] could not start the attempt', error.message);
        return false; // tried again with the next update
      }
      sent.inserted = true;
      if (run.status === 'running') return true;
    }
    sent.seq += 1;
    const { error } = await supabase
      .from('attempts')
      .update({ ...fields, seq: sent.seq, status: run.status, fail_reason: run.status === 'failed' ? 'lives' : null })
      .eq('room_id', room.roomId)
      .eq('client_attempt_id', run.attemptId);
    if (error) {
      console.warn('[rooms] could not update the attempt', error.message);
      return false;
    }
    if (run.status !== 'running') sent.final = true;
    return true;
  };

  /**
   * The last update of a run is never followed by another, so if it fails nobody would re-send it and
   * the player would show as "running" forever. Re-send it every couple of seconds until it lands.
   */
  const retryFinal = (run: RunUpdate) => {
    const failures = (finalFailures.get(run.attemptId) ?? 0) + 1;
    finalFailures.set(run.attemptId, failures);
    if (failures > FINAL_RETRIES) {
      console.warn('[rooms] gave up sending the final result after', FINAL_RETRIES, 'retries');
      return;
    }
    if (finalRetryTimer) clearTimeout(finalRetryTimer);
    finalRetryTimer = setTimeout(() => {
      finalRetryTimer = null;
      if (!current) return;
      nextRun ??= run; // a newer update (a new attempt) goes first
      void flushRuns();
    }, FINAL_RETRY_MS);
  };

  /** One request at a time; only the newest waiting update is sent (older ones are out of date). */
  const flushRuns = async () => {
    if (sendingRuns) return;
    sendingRuns = true;
    try {
      while (nextRun) {
        const run = nextRun;
        nextRun = null;
        const delivered = await sendRun(run).catch((e: unknown) => {
          console.warn('[rooms] could not send the run', e);
          return false;
        });
        if (!delivered && run.status !== 'running') retryFinal(run);
      }
    } finally {
      sendingRuns = false;
    }
  };

  const enter = async (row: RoomRow, playerId: string): Promise<RoomInfo> => {
    teardown();
    const room: CurrentRoom = {
      roomId: row.room_id,
      info: { code: row.code, seed: row.seed, playerId, isHost: row.is_host },
    };
    current = room;

    channel = supabase
      .channel(`room:${room.roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${room.roomId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.roomId}` }, scheduleRefresh)
      // Anything that changed between our first read and the subscription going live.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') scheduleRefresh();
      });
    heartbeat = setInterval(() => void beat(), HEARTBEAT_MS);

    await refresh();
    if (row.status === 'started' && row.start_at_ms !== null) announceStart(row.start_at_ms);
    watchStandings();
    return room.info;
  };

  const api: OnlineRoomApi = {
    mode: 'online',
    clock,
    supabase,

    roomId: () => current?.roomId ?? null,
    raceStartServerMs: () => raceStart,

    async createRoom(nickname) {
      const name = cleanNickname(nickname);
      const playerId = await ensureSignedIn(supabase);
      const row = await call<RoomRow>('create_room', { p_nickname: name });
      return enter(row, playerId);
    },

    async joinRoom(rawCode, nickname) {
      const name = cleanNickname(nickname);
      const code = rawCode.trim().toUpperCase();
      const notFound = new Error(`No room called ${code || '(blank)'}. Check the code with your host.`);
      if (!CODE_PATTERN.test(code)) throw notFound;
      const playerId = await ensureSignedIn(supabase);
      const row = await call<RoomRow | { error: string }>('join_room', { p_code: code, p_nickname: name });
      // A wrong code is returned, not raised, so the server's rate limit still counts it.
      if ('error' in row) throw notFound;
      return enter(row, playerId);
    },

    onPlayersChanged(listener) {
      playerListeners.add(listener);
      listener(players);
      return () => playerListeners.delete(listener);
    },

    async startRoom() {
      const room = current;
      if (!room) throw new Error('You are not in a room.');
      if (!room.info.isHost) throw new Error('Only the host can start.');
      // The room's first race leaves time for everyone to watch the story; rematches start quickly.
      const delaySec = storyPlayedIn === room.roomId ? CONFIG.flow.countdownSec : CONFIG.flow.storyStartSec;
      const start = () => call<RoomRow | null>('start_room', { p_room_id: room.roomId, p_delay_ms: delaySec * 1000 });
      let row: RoomRow | null;
      try {
        row = await start();
      } catch (e) {
        // Still marked as racing from last time (the host never reopened it): reopen, then start.
        if (!(e instanceof Error) || e.message !== ERROR_MESSAGES.room_already_started) throw e;
        await call<unknown>('reset_room', { p_room_id: room.roomId });
        row = await start();
      }
      storyPlayedIn = room.roomId;
      // Realtime announces it too, if this reply is lost.
      if (room === current && typeof row?.start_at_ms === 'number') announceStart(row.start_at_ms);
    },

    onStart(listener) {
      startListeners.add(listener);
      // Rejoining an already-started room announces the start before the lobby has subscribed.
      const at = startAt;
      if (at !== null) queueMicrotask(() => listener(at > Date.now() ? at : Date.now() + CONFIG.flow.countdownSec * 1000));
      return () => startListeners.delete(listener);
    },

    async reopenRoom() {
      const room = current;
      if (!room?.info.isHost) return;
      await call<unknown>('reset_room', { p_room_id: room.roomId });
    },

    publishRun(run) {
      if (!current) return;
      nextRun = run;
      void flushRuns();
    },

    onStandings(listener) {
      standingListeners.add(listener);
      listener(standings ?? zeroStandings());
      watchStandings();
      return () => {
        standingListeners.delete(listener);
        if (standingListeners.size === 0) {
          stopStandings?.();
          stopStandings = null;
        }
      };
    },

    async leaveRoom() {
      const room = current;
      if (!room) return;
      teardown();
      try {
        // Before the start this removes us (and hands over host); after it, the server keeps us for results.
        await call<void>('leave_room', { p_room_id: room.roomId });
      } catch {
        // The page may be closing; the server treats a silent player as disconnected anyway.
      }
    },
  };

  return api;
}
