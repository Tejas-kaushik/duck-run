// Big-screen mode (Tejas): the laptop on the projector watches the race instead of playing it.
// Every racer is a duck on one track (road → pond → road → Don Crumbs), moving live from the room's
// standings, with a commentary ticker. When everyone is done: a podium, confetti, and the Don roasting
// whoever came last. Then back to the pond for the next race. Styles in stadium.css.

import { SECTION_ORDER, type ScoreboardEntry } from '../network/ranking';
import type { RoomApi, RoomInfo, RoomPlayer } from '../network/types';
import { el, formatTime, onButton } from './dom';
import { don } from './introArt';
import { joinUrl, qrSvg } from './invite';
import { duckSvg } from './pond';
import './stadium.css';

/** A racer that hasn't started this long after GO (phone asleep, wrong tab) no longer holds up the podium. */
const NO_SHOW_SEC = 20;
/** A pause on the finished track before the podium rises. */
const PODIUM_DELAY_MS = 1800;
const TICKER_LINES = 4;
/** The clock and the race-over check run on a timer, not animation frames, so they keep going in a background tab. */
const TICK_MS = 50;

/** 0..1 along the whole track: the four sections, then how far through the current one. */
export function trackPosition(e: Pick<ScoreboardEntry, 'state' | 'phase' | 'progress'>): number {
  if (e.state === 'finished') return 1;
  if (e.state === 'waiting') return 0;
  const section = Math.max(0, SECTION_ORDER.indexOf(e.phase));
  return Math.min(1, (section + Math.min(1, Math.max(0, e.progress))) / SECTION_ORDER.length);
}

/** True once nobody can still change the result. */
export function raceIsOver(lanes: readonly ScoreboardEntry[], secondsSinceGo: number): boolean {
  if (secondsSinceGo < 2 || lanes.length === 0) return false;
  const done = (l: ScoreboardEntry) =>
    l.state === 'finished' ||
    l.state === 'failed' ||
    !!l.left ||
    (l.disconnected && l.state !== 'waiting') ||
    (l.state === 'waiting' && secondsSinceGo > NO_SHOW_SEC);
  return lanes.some((l) => l.state === 'finished' || l.state === 'failed') && lanes.every(done);
}

const FAIL_LINE: Record<string, (n: string) => string> = {
  runner1: (n) => `🪵 ${n} is out in Stage 1!`,
  underwater: (n) => `🫧 ${n} sank in the pond!`,
  runner2: (n) => `🪵 ${n} crashed out in Stage 2!`,
  boss: (n) => `💀 Don Crumbs got ${n}!`,
};

const SECTION_LINE: Record<string, (n: string) => string> = {
  underwater: (n) => `🌊 ${n} dives into the pond!`,
  runner2: (n) => `💵 ${n} grabbed the dollar and is into Stage 2!`,
  boss: (n) => `🎩 ${n} has reached Don Crumbs!`,
};

/** No lead calls in the opening seconds (everyone's near 0), and at most one every few seconds. */
const LEAD_QUIET_START_SEC = 6;
const LEAD_CALL_GAP_MS = 5000;

/**
 * Whether to shout "X takes the lead!": a new leader with points on the board, not in the scramble at
 * the start, and not so soon after the last call that two close racers would flip-flop the ticker.
 */
export function shouldCallLead(
  leader: Pick<ScoreboardEntry, 'userId' | 'score'> | undefined,
  lastCalled: string | null,
  msSinceLastCall: number,
  secondsSinceGo: number,
): boolean {
  return (
    !!leader &&
    leader.score > 0 &&
    leader.userId !== lastCalled &&
    secondsSinceGo >= LEAD_QUIET_START_SEC &&
    msSinceLastCall >= LEAD_CALL_GAP_MS
  );
}

/**
 * What's worth shouting about between two snapshots of the standings (lead changes: shouldCallLead).
 * `furthest` remembers the furthest section announced per racer, so each section is called once even
 * if a late, stale update sends a duck back for a moment.
 */
export function commentary(
  previous: readonly ScoreboardEntry[],
  next: readonly ScoreboardEntry[],
  furthest: Map<string, number> = new Map(),
): string[] {
  const before = new Map(previous.map((e) => [e.userId, e]));
  const lines: string[] = [];
  for (const n of next) {
    const p = before.get(n.userId);
    if (!p) continue;
    if (n.left && !p.left) lines.push(`👋 ${n.nickname} left the race.`);
    else if (n.state === 'finished' && p.state !== 'finished') {
      lines.push(`🏆 ${n.nickname} beat the Don in ${formatTime(n.timeMs ?? 0)}!`);
    } else if (n.state === 'failed' && p.state !== 'failed') lines.push((FAIL_LINE[n.phase] ?? FAIL_LINE.runner1)(n.nickname));
    else if (n.state === 'running' && p.state === 'running' && n.phase !== p.phase && SECTION_LINE[n.phase]) {
      // Only forwards, and only once per section: a stale update arriving late must not repeat a call.
      const section = SECTION_ORDER.indexOf(n.phase);
      const known = Math.max(furthest.get(n.userId) ?? 0, SECTION_ORDER.indexOf(p.phase));
      if (section > known) {
        furthest.set(n.userId, section);
        lines.push(SECTION_LINE[n.phase](n.nickname));
      }
    }
  }
  return lines;
}

/** One lane per player in the room (except this screen), plus anyone who raced and then left. */
export function stadiumLanes(players: readonly RoomPlayer[], standings: readonly ScoreboardEntry[], meId: string): ScoreboardEntry[] {
  const byId = new Map(standings.map((s) => [s.userId, s]));
  const lanes: ScoreboardEntry[] = players
    .filter((p) => p.id !== meId)
    .map((p) => byId.get(p.id) ?? {
      rank: 0, userId: p.id, nickname: p.nickname, state: 'waiting', timeMs: null, score: 0,
      phase: 'runner1', progress: 0, disconnected: false,
    });
  const present = new Set(lanes.map((l) => l.userId));
  for (const s of standings) if (!present.has(s.userId) && s.userId !== meId) lanes.push(s);
  // Players who left (or have been gone 15 s) are out of the room, unless they already finished or
  // crashed out: their result still counts.
  return lanes.filter((l) => !(l.left || l.disconnected) || l.state === 'finished' || l.state === 'failed');
}

export interface StadiumHandle {
  /** Show the race that starts at `startsAt` (performance.now() time). */
  start(room: RoomInfo, startsAt: number): void;
  hide(): void;
}

export function mountStadium(root: HTMLElement, rooms: RoomApi, onBack: () => void): StadiumHandle {
  let screen: HTMLElement | null = null;
  let stop: (() => void) | null = null;

  const hide = () => {
    stop?.();
    stop = null;
    screen?.remove();
    screen = null;
  };

  const start = (room: RoomInfo, startsAt: number) => {
    hide();
    let players: RoomPlayer[] = [];
    let standings: ScoreboardEntry[] = [];
    let lastStandings: ScoreboardEntry[] = [];
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastLeader: string | null = null;
    let lastLeadCall = -Infinity;
    const announced = new Map<string, number>();
    let podiumTimer: ReturnType<typeof setTimeout> | null = null;
    let over = false;
    let endedAt: number | null = null;
    const ticker: string[] = [];

    // Header: what this is, the clock, and a QR so people can join the next race.
    const clock = el('div', { className: 'st-clock', text: '0:00.00' });
    const qr = el('div', { className: 'st-qr' });
    qr.innerHTML = qrSvg(joinUrl(room.code));
    const endNow = el('button', { className: 'st-end', text: 'End race ▸ podium' });
    onButton(endNow, () => showPodium());
    const header = el('div', { className: 'st-header' }, [
      el('div', { className: 'st-title' }, [el('strong', { text: '🏁 DUCK RUN · LIVE' }), el('span', { text: `Room ${room.code}` })]),
      clock,
      el('div', { className: 'st-join' }, [qr, el('span', { text: 'Scan to join the next race' })]),
    ]);

    // The track: four sections, one lane per racer.
    const sections = el('div', { className: 'st-sections' }, [
      el('span', { text: '🌲 Stage 1' }),
      el('span', { text: '🌊 Underwater' }),
      el('span', { text: '🌲 Stage 2' }),
      el('span', { text: '🎩 Boss' }),
    ]);
    const lanesBox = el('div', { className: 'st-lanes' });
    const laneEls = new Map<string, { row: HTMLElement; token: HTMLElement; place: HTMLElement; name: HTMLElement; score: HTMLElement; status: HTMLElement }>();
    const tickerBox = el('div', { className: 'st-ticker' });
    const count = el('div', { className: 'st-count' });

    screen = el('div', { className: 'stadium' }, [
      header,
      el('div', { className: 'st-track' }, [sections, lanesBox]),
      tickerBox,
      el('div', { className: 'st-footer' }, [endNow]),
      count,
    ]);
    root.appendChild(screen);

    const say = (lines: string[]) => {
      if (!lines.length) return;
      ticker.unshift(...lines.reverse());
      ticker.length = Math.min(ticker.length, TICKER_LINES);
      tickerBox.replaceChildren(...ticker.map((t, i) => el('p', { className: i === 0 ? 'new' : '', text: t })));
    };

    const lanes = () => stadiumLanes(players, standings, room.playerId);

    const renderLanes = () => {
      const list = lanes();
      const keep = new Set(list.map((l) => l.userId));
      for (const [id, l] of laneEls) {
        if (!keep.has(id)) {
          l.row.remove();
          laneEls.delete(id);
        }
      }
      for (const lane of list) {
        let l = laneEls.get(lane.userId);
        if (!l) {
          const token = el('div', { className: 'st-token' });
          token.innerHTML = duckSvg(lane.userId);
          const place = el('span', { className: 'st-place' });
          const name = el('span', { className: 'st-name' });
          const score = el('span', { className: 'st-score' });
          const status = el('span', { className: 'st-status' });
          const row = el('div', { className: 'st-lane' }, [
            el('div', { className: 'st-who' }, [place, el('div', {}, [name, status])]),
            el('div', { className: 'st-road' }, [token, el('span', { className: 'st-flag', text: '🏁' })]),
            score,
          ]);
          lanesBox.appendChild(row);
          l = { row, token, place, name, score, status };
          laneEls.set(lane.userId, l);
        }
        const started = lane.state !== 'waiting';
        l.row.className = `st-lane ${lane.state}${lane.left ? ' left' : ''}${lane.disconnected && !lane.left ? ' offline' : ''}${lane.rank === 1 && started ? ' leader' : ''}`;
        l.place.textContent = started ? ['🥇', '🥈', '🥉'][lane.rank - 1] ?? String(lane.rank) : '';
        l.name.textContent = lane.nickname;
        l.score.textContent = lane.score.toLocaleString();
        l.status.textContent =
          lane.state === 'finished' ? `🏁 ${formatTime(lane.timeMs ?? 0)}`
            : lane.state === 'failed' ? '💀 out'
              : lane.left ? 'left'
                : lane.state === 'running' ? (lane.disconnected ? 'offline' : '')
                  : 'ready';
        l.token.style.setProperty('--pos', String(trackPosition(lane)));
      }
      lanesBox.style.setProperty('--lanes', String(Math.max(1, list.length)));
    };

    const showPodium = () => {
      if (!screen || screen.querySelector('.st-podium')) return;
      over = true;
      endedAt ??= performance.now();
      const ranked = [...standings].filter((s) => s.state !== 'waiting').sort((a, b) => a.rank - b.rank);
      const top = ranked.slice(0, 3);
      const block = (e: ScoreboardEntry | undefined, place: 1 | 2 | 3) => {
        const duck = el('div', { className: 'pd-duck' });
        if (e) duck.innerHTML = duckSvg(e.userId);
        return el('div', { className: `pd-spot p${place}` }, [
          duck,
          el('div', { className: 'pd-name', text: e ? e.nickname : '—' }),
          el('div', { className: 'pd-score', text: e ? `${e.score.toLocaleString()} pts` : '' }),
          el('div', { className: 'pd-block', text: ['🥇', '🥈', '🥉'][place - 1] }),
        ]);
      };
      const last = ranked.length >= 2 ? ranked[ranked.length - 1] : null;
      const roast = el('div', { className: 'pd-roast' });
      if (last) {
        const art = el('div', { className: 'pd-don' });
        art.innerHTML = `<svg viewBox="-70 -150 140 160" aria-hidden="true">${don(0, 0, 1, true)}</svg>`;
        roast.append(art, el('p', { className: 'pd-bubble', text: `${last.nickname}… you still owe me breadcrumbs.` }));
      }
      const rest = el('ol', { className: 'pd-rest' }, ranked.slice(3).map((e) =>
        el('li', {}, [el('span', { text: `${e.rank}. ${e.nickname}` }), el('span', { text: e.score.toLocaleString() })])));
      const back = el('button', { className: 'pd-back', text: '🦆  Back to the pond' });
      onButton(back, onBack);
      const confetti = el('div', { className: 'pd-confetti' }, Array.from({ length: 60 }, (_, i) => {
        const bit = el('i');
        bit.style.left = `${(i * 37) % 100}%`;
        bit.style.animationDelay = `${(i % 12) * 0.18}s`;
        bit.style.background = ['#ffd23f', '#ff7aa8', '#46c7ff', '#7be37b', '#ff9f43'][i % 5];
        return bit;
      }));
      screen.append(
        el('div', { className: 'st-podium' }, [
          confetti,
          el('h1', { text: top[0] ? `🏆 ${top[0].nickname} wins!` : 'Race over' }),
          el('div', { className: 'pd-stage' }, [block(top[1], 2), block(top[0], 1), block(top[2], 3)]),
          rest,
          roast,
          back,
        ]),
      );
    };

    const tick = () => {
      const now = performance.now();
      const toGo = (startsAt - now) / 1000;
      // No 3-2-1 (Vansh): the story covers the wait, then just GO!
      if (toGo > 0) {
        count.className = 'st-count';
      } else if (toGo > -0.9) {
        count.textContent = 'GO!';
        count.className = 'st-count on go';
      } else count.className = 'st-count';
      const since = Math.max(0, -toGo);
      clock.textContent = formatTime(Math.max(0, (endedAt ?? now) - startsAt));
      if (!over && raceIsOver(lanes(), since)) {
        over = true;
        endedAt = now;
        say(['🏁 That\'s the race!']);
        podiumTimer = setTimeout(showPodium, PODIUM_DELAY_MS);
      }
    };

    const offPlayers = rooms.onPlayersChanged((list) => {
      players = list;
      renderLanes();
    });
    const offStandings = rooms.onStandings((rows) => {
      standings = rows;
      say(commentary(lastStandings, rows, announced));
      const leader = rows.find((r) => r.rank === 1 && r.state !== 'waiting');
      const now = performance.now();
      if (!over && shouldCallLead(leader, lastLeader, now - lastLeadCall, (now - startsAt) / 1000)) {
        say([`👑 ${leader!.nickname} takes the lead!`]);
        lastLeader = leader!.userId;
        lastLeadCall = now;
      }
      lastStandings = rows;
      renderLanes();
    });
    say([`🦆 ${lanes().length} duck${lanes().length === 1 ? '' : 's'} on the start line…`]);
    timer = setInterval(tick, TICK_MS);
    tick();

    stop = () => {
      if (timer) clearInterval(timer);
      if (podiumTimer) clearTimeout(podiumTimer);
      offPlayers();
      offStandings();
    };
  };

  return { start, hide };
}
