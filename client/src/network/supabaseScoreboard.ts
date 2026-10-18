// Live scoreboard feed (Mayank): reads a room's players and attempts from Supabase, keeps them
// current with Realtime, and hands ranked rows to the UI. Ranking itself is in ranking.ts.
//
// Realtime on `attempts` gives instant updates. A re-read every few seconds catches anything
// Realtime missed and refreshes last_seen_at, which drives the "disconnected" marker.

import type { PhaseId } from '../core/types';
import { rankStandings, type ScoreboardAttempt, type ScoreboardEntry, type ScoreboardPlayer } from './ranking';
import { parseTimestamp, type OnlineRoomApi } from './supabaseRooms';

const PLAYERS_EVERY_MS = 5000;
const ATTEMPTS_EVERY_MS = 15000;
/** Re-rank this often even without new data, so players turn "disconnected" on time. */
const TICK_MS = 1000;
/** Newest attempts read per refresh. Realtime fills in anything newer. */
const ATTEMPT_LIMIT = 500;
/** Attempts are created when the run starts, after the shared start; this much slack covers clock jitter. */
const RACE_SLACK_MS = 10000;

const ATTEMPT_COLUMNS =
  'id, user_id, status, phase, phase_progress, elapsed_ms, score, boss_health, created_at, updated_at';

interface AttemptRow {
  id: string;
  user_id: string;
  status: ScoreboardAttempt['status'];
  phase: PhaseId;
  phase_progress: number;
  elapsed_ms: number;
  score: number;
  boss_health: number;
  created_at: string;
  updated_at: string;
}

const toAttempt = (row: AttemptRow): ScoreboardAttempt => ({
  userId: row.user_id,
  status: row.status,
  phase: row.phase,
  phaseProgress: row.phase_progress,
  elapsedMs: row.elapsed_ms,
  score: row.score,
  bossHealth: row.boss_health,
  createdMs: parseTimestamp(row.created_at),
  updatedMs: parseTimestamp(row.updated_at),
});

/**
 * Starts watching the room `rooms` is in. `listener` gets the ranked rows straight away (once the
 * first read lands) and on every change. Returns a stop function.
 */
export function watchScoreboard(rooms: OnlineRoomApi, listener: (entries: ScoreboardEntry[]) => void): () => void {
  const roomId = rooms.roomId();
  if (!roomId) return () => {};
  const { supabase, clock } = rooms;

  let players: ScoreboardPlayer[] = [];
  /** Every nickname seen in this room, so players who leave after racing keep their name on the board. */
  const names = new Map<string, string>();
  const attempts = new Map<string, ScoreboardAttempt>();
  let loaded = false;
  let stopped = false;
  let lastKey = '';

  const emit = () => {
    if (!loaded || stopped) return;
    // Only the latest race counts (Tejas): attempts created since it started. None before the first race.
    const since = rooms.raceStartServerMs();
    const race = since === null ? [] : [...attempts.values()].filter((a) => a.createdMs >= since - RACE_SLACK_MS);
    const entries = rankStandings(players, race, clock.serverNow(), names, since !== null);
    const key = JSON.stringify(entries);
    if (key === lastKey) return;
    lastKey = key;
    listener(entries);
  };

  const readPlayers = async () => {
    const { data, error } = await supabase
      .from('room_players')
      .select('user_id, nickname, last_seen_at')
      .eq('room_id', roomId);
    if (error || !data) return;
    players = (data as { user_id: string; nickname: string; last_seen_at: string }[]).map((p) => ({
      userId: p.user_id,
      nickname: p.nickname,
      lastSeenMs: parseTimestamp(p.last_seen_at),
    }));
    for (const p of players) names.set(p.userId, p.nickname);
  };

  const readAttempts = async () => {
    const [latest, finished] = await Promise.all([
      supabase
        .from('attempts')
        .select(ATTEMPT_COLUMNS)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(ATTEMPT_LIMIT),
      // Best times are kept even if a player has retried hundreds of times since.
      supabase
        .from('attempts')
        .select(ATTEMPT_COLUMNS)
        .eq('room_id', roomId)
        .eq('status', 'finished')
        .order('elapsed_ms')
        .limit(ATTEMPT_LIMIT),
    ]);
    for (const result of [latest, finished]) {
      if (result.error || !result.data) continue;
      for (const row of result.data as AttemptRow[]) attempts.set(row.id, toAttempt(row));
    }
  };

  const channel = supabase
    .channel(`scoreboard:${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attempts', filter: `room_id=eq.${roomId}` }, (payload) => {
      const row = payload.new as Partial<AttemptRow>;
      if (!row.id || !row.user_id) return; // deletes carry no row (and attempts are never deleted)
      attempts.set(row.id, toAttempt(row as AttemptRow));
      emit();
    })
    .subscribe();

  let sinceAttempts = 0;
  const poll = setInterval(() => {
    sinceAttempts += PLAYERS_EVERY_MS;
    const reads = [readPlayers()];
    if (sinceAttempts >= ATTEMPTS_EVERY_MS) {
      sinceAttempts = 0;
      reads.push(readAttempts());
    }
    void Promise.all(reads).then(emit);
  }, PLAYERS_EVERY_MS);
  const tick = setInterval(emit, TICK_MS);

  void Promise.all([readPlayers(), readAttempts()]).then(() => {
    loaded = true;
    emit();
  });

  return () => {
    stopped = true;
    clearInterval(poll);
    clearInterval(tick);
    void supabase.removeChannel(channel);
  };
}
