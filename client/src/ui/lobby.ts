// Lobby (Tejas): the title screen, the join screen (from a QR code / invite link) and the room's
// pond lobby: players float on the pond, the leaderboard sits beside it (everyone on 0 until the first
// race), the host shows the QR code and starts the race. After a race everyone comes back here.
// Talks only to a RoomApi, so it works the same with local test rooms or Supabase.

import type { RoomApi, RoomInfo, RoomPlayer } from '../network/types';
import type { ScoreboardEntry } from '../network/ranking';
import { el, onButton } from './dom';
import { joinUrl, linkIsLocalOnly, qrSvg } from './invite';
import { mountPond } from './pond';
import { mountStandings } from './standings';
import { TITLE_SCENE } from './titleScene';
import './lobby.css';

const NICKNAME_KEY = 'duck-run-nickname';
const BIG_SCREEN_KEY = 'duck-run-big-screen';

export interface LobbyOptions {
  rooms: RoomApi;
  /** Practice run on your own (local seed, no room). */
  onSolo(nickname: string): void;
  /** The host pressed Start: everyone's countdown ends at `startAtEpochMs`. */
  onRoomStart(room: RoomInfo, startAtEpochMs: number): void;
  /** You're in a room that has already raced (you joined late, or came back after a race). */
  onRoomHadRace?(): void;
  /** Pre-filled join code, e.g. from a ?room=QUAK link or QR code. */
  initialCode?: string;
  /** Extra controls under the home menu, e.g. the volume slider. */
  footer?: HTMLElement;
}

export interface LobbyHandle {
  hide(): void;
  /** Back to whichever screen was showing: the pond if still in a room, else the title screen. */
  show(): void;
  /** The room we're in, if any. */
  room(): RoomInfo | null;
  /** Big-screen mode: this screen shows the race live (ui/stadium.ts) instead of playing it. */
  bigScreen(): boolean;
}

function loadNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return ''; // storage blocked (private window)
  }
}

function saveNickname(name: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, name);
  } catch {
    // not important
  }
}

const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/**
 * Remembered for this tab (sessionStorage), so the projector tab stays the big screen race after race,
 * while other tabs on the same laptop can still play. Phones always play.
 */
function loadBigScreen(): boolean {
  if (isTouch()) return false;
  try {
    return sessionStorage.getItem(BIG_SCREEN_KEY) === '1';
  } catch {
    return false;
  }
}

function saveBigScreen(on: boolean): void {
  try {
    sessionStorage.setItem(BIG_SCREEN_KEY, on ? '1' : '0');
  } catch {
    // not important
  }
}

/** The big bouncy logo: one span per letter so they can hop in turn. */
function logo(): HTMLElement {
  const word = (text: string, offset: number) =>
    el(
      'span',
      { className: 'logo-word' },
      [...text].map((ch, i) => {
        const s = el('span', { className: 'logo-letter', text: ch });
        s.style.animationDelay = `${(offset + i) * 0.07}s, ${0.8 + (offset + i) * 0.12}s`;
        return s;
      }),
    );
  return el('div', { className: 'title-logo' }, [
    el('h1', {}, [word('DUCK', 0), word('RUN', 5)]),
    el('p', { className: 'tagline', text: 'Run · Dive · Grab the cash · Beat the Don' }),
  ]);
}

export function mountLobby(root: HTMLElement, options: LobbyOptions): LobbyHandle {
  const { rooms } = options;
  const screen = el('div', { className: 'lobby-screen' });
  let room: RoomInfo | null = null;
  let unsubscribe: (() => void)[] = [];
  let visible = false;
  let bigScreen = loadBigScreen();
  /** A QR/invite code still waiting to be used (cleared once used or dismissed). */
  let pendingCode = options.initialCode?.trim().toUpperCase() || '';

  const error = el('p', { className: 'lobby-error' });
  const showError = (e: unknown) => {
    error.textContent = e instanceof Error ? e.message : 'Something went wrong. Try again.';
  };

  /** Disable every button while a request is in flight, so nothing gets double-tapped. */
  const busy = async (work: () => Promise<void>) => {
    const buttons = [...screen.querySelectorAll('button')];
    buttons.forEach((b) => (b.disabled = true));
    error.textContent = '';
    try {
      await work();
    } catch (e) {
      showError(e);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  };

  const nicknameInput = () => {
    const input = el('input', { className: 'nickname' });
    input.placeholder = 'Your duck name';
    input.maxLength = 16;
    input.value = loadNickname();
    input.autocomplete = 'off';
    return input;
  };
  const takeName = (input: HTMLInputElement) => {
    const value = input.value.trim();
    saveNickname(value);
    return value;
  };

  const footer = () => {
    const children: Node[] = [
      el('p', { className: 'controls-hint', text: isTouch() ? 'Two buttons: tap left or right · either fires' : 'Two buttons: A and D · either one fires' }),
    ];
    if (options.footer) children.push(options.footer);
    return el('div', { className: 'title-footer' }, children);
  };

  // --- Title screen: nickname, solo, create, join -------------------------------------------

  const renderHome = () => {
    screen.className = 'lobby-screen title-screen';
    const nickname = nicknameInput();

    const code = el('input', { className: 'code-input' });
    code.placeholder = 'CODE';
    code.maxLength = 4;
    code.autocomplete = 'off';
    code.addEventListener('input', () => (code.value = code.value.toUpperCase()));

    const solo = el('button', { className: 'big play', text: '▶  SOLO PRACTICE' });
    const create = el('button', { className: 'big host', text: '🦆  CREATE ROOM' });
    const join = el('button', { className: 'join', text: 'JOIN' });

    onButton(solo, () => options.onSolo(takeName(nickname) || 'Duck'));
    onButton(create, () => busy(async () => enterRoom(await rooms.createRoom(takeName(nickname)))));
    onButton(join, () => busy(async () => enterRoom(await rooms.joinRoom(code.value, takeName(nickname)))));
    code.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join.click();
    });

    const menu = el('div', { className: 'title-menu' }, [
      nickname,
      solo,
      create,
      el('div', { className: 'join-row' }, [code, join]),
      error,
    ]);
    if (rooms.mode === 'local') {
      menu.append(el('p', { className: 'lobby-note', text: 'Test rooms: only tabs in this browser can join. Add the Supabase keys to play on phones.' }));
    }
    screen.replaceChildren(el('div'), logo(), menu, footer());
    screen.firstElementChild!.innerHTML = TITLE_SCENE;
  };

  // --- Join screen: opened from a QR code or invite link --------------------------------------

  const renderJoin = (code: string) => {
    screen.className = 'lobby-screen title-screen join-screen';
    const nickname = nicknameInput();
    const jump = el('button', { className: 'big host', text: '🦆  JUMP IN' });
    const menuLink = el('button', { className: 'link', text: 'No thanks, take me to the menu' });
    onButton(jump, () =>
      busy(async () => {
        enterRoom(await rooms.joinRoom(code, takeName(nickname)));
        pendingCode = '';
      }),
    );
    onButton(menuLink, () => {
      pendingCode = '';
      history.replaceState(null, '', window.location.pathname);
      renderHome();
    });
    nickname.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') jump.click();
    });

    const card = el('div', { className: 'title-menu' }, [
      el('p', { className: 'invite-line', text: "You're invited to room" }),
      el('div', { className: 'invite-code', text: code }),
      nickname,
      jump,
      error,
      menuLink,
    ]);
    screen.replaceChildren(el('div'), logo(), card, footer());
    screen.firstElementChild!.innerHTML = TITLE_SCENE;
    if (!isTouch()) nickname.focus();
  };

  // --- Room: the pond lobby ------------------------------------------------------------------

  const enterRoom = (info: RoomInfo) => {
    room = info;
    error.textContent = '';
    screen.className = 'lobby-screen pond-lobby';
    const link = joinUrl(info.code);

    const pond = mountPond();
    const board = mountStandings();
    let players: RoomPlayer[] = [];
    let rows: ScoreboardEntry[] = [];
    let offline = new Set<string>();

    // Header: room code, player count, leave.
    const count = el('span', { className: 'count' });
    const leave = el('button', { className: 'leave', text: 'Leave' });
    onButton(leave, () =>
      busy(async () => {
        await leaveRoom();
        renderHome();
      }),
    );
    const header = el('div', { className: 'pond-header' }, [
      el('div', { className: 'room-tag' }, [el('small', { text: 'ROOM' }), el('strong', { text: info.code })]),
      count,
      leave,
    ]);

    // Invite: the QR code phones scan, and the link to copy.
    const qr = el('div', { className: 'qr' });
    qr.innerHTML = qrSvg(link);
    const copy = el('button', { className: 'copy', text: 'Copy link' });
    onButton(copy, () => {
      navigator.clipboard?.writeText(link).then(
        () => (copy.textContent = 'Copied!'),
        () => (copy.textContent = link),
      );
    });
    const inviteNotes: Node[] = [];
    if (rooms.mode === 'local') {
      inviteNotes.push(el('p', { className: 'lobby-note', text: "Test room: phones can't join yet. Add the Supabase keys to client/.env.local." }));
    } else if (linkIsLocalOnly(link)) {
      inviteNotes.push(el('p', { className: 'lobby-note', text: 'No network address found: connect to Wi-Fi so phones can reach this computer.' }));
    }
    const invite = el('div', { className: 'card invite' }, [
      el('h2', { text: '📱 Scan to join' }),
      qr,
      el('p', { className: 'link-text', text: link.replace(/^https?:\/\//, '') }),
      copy,
      ...inviteNotes,
    ]);
    // On phones the QR is folded away for players (the host's big screen shows it).
    const folded = isTouch() && !info.isHost;
    invite.classList.toggle('folded', folded);
    const unfold = el('button', { className: 'unfold', text: '📱 Show invite QR' });
    onButton(unfold, () => invite.classList.toggle('folded'));

    // Leaderboard.
    const boardTitle = el('h2', { text: '🏆 Leaderboard' });
    const boardNote = el('p', { className: 'board-note' });
    const boardCard = el('div', { className: 'card board' }, [boardTitle, boardNote, board.element]);

    // Footer: Start for the host, a waiting line for everyone else.
    const start = el('button', { className: 'big start', text: '🏁  START RACE' });
    onButton(start, () => busy(() => rooms.startRoom()));
    const waiting = el('p', { className: 'waiting', text: 'Waiting for the host to start…' });
    const action = el('div', { className: 'pond-action' }, [error]);
    // Big-screen mode: on the laptop that's on the projector, watch the race instead of playing it.
    // A real on/off switch, only on the host's screen (Vansh).
    const toggleState = el('span', { className: 'state' });
    const screenToggle = el('button', { className: 'screen-toggle' }, [
      el('span', { className: 'label', text: '📺 Big-screen mode' }),
      el('span', { className: 'switch' }, [el('span', { className: 'knob' })]),
      toggleState,
    ]);
    screenToggle.setAttribute('role', 'switch');
    onButton(screenToggle, () => {
      bigScreen = !bigScreen;
      saveBigScreen(bigScreen);
      render();
    });

    let reportedRace = false;
    const render = () => {
      // Anyone who left or has been gone 15 s is out of the room: not in the pond, not on the board.
      const here = players.filter((p) => p.id === info.playerId || !offline.has(p.id));
      count.textContent = `${here.length} duck${here.length === 1 ? '' : 's'} in the pond`;
      pond.update(here, info.playerId, offline);

      // Before the first race: rows for players missing from the feed (just joined), so everyone is on 0.
      // After a race the board is that race's results, so only the people who raced.
      const known = new Set(rows.map((r) => r.userId));
      const hadRace = rows.some((r) => r.state !== 'waiting');
      if (hadRace && !reportedRace) {
        reportedRace = true;
        options.onRoomHadRace?.();
      }
      const extra = here
        .filter((p) => !hadRace && !known.has(p.id))
        .map<ScoreboardEntry>((p) => ({
          rank: 0, userId: p.id, nickname: p.nickname, state: 'waiting', timeMs: null, score: 0,
          phase: 'runner1', progress: 0, disconnected: false,
        }));
      const present = new Set(here.map((p) => p.id));
      // Someone who finished or crashed out and then left keeps their result, as on the big screen's
      // podium (stadium.ts): the winner closing the tab mustn't vanish from the results.
      const counts = (r: ScoreboardEntry) => present.has(r.userId) || r.state === 'finished' || r.state === 'failed';
      const all = [...rows.filter(counts), ...extra].map((r, i) => ({ ...r, rank: i + 1 }));
      // The big screen isn't racing, so it isn't on its own board. (Only the host's screen can be one.)
      const isHost = room?.isHost ?? false;
      const watching = bigScreen && isHost;
      board.update(watching ? all.filter((r) => r.userId !== info.playerId).map((r, i) => ({ ...r, rank: i + 1 })) : all, info.playerId);

      const raced = all.some((r) => r.state !== 'waiting');
      const racing = all.filter((r) => r.state === 'running' && !r.disconnected).length;
      boardTitle.textContent = raced ? '🏆 Last race' : '🏆 Leaderboard';
      boardNote.textContent = racing
        ? `🏃 ${racing} still racing…`
        : raced
          ? 'Highest score wins. Race again?'
          : 'Everyone starts on 0. Highest score wins.';

      toggleState.textContent = bigScreen ? 'ON' : 'OFF';
      screenToggle.setAttribute('aria-checked', String(bigScreen));
      screenToggle.title = bigScreen ? 'This screen shows the race live' : 'This screen plays too';
      screenToggle.classList.toggle('on', bigScreen);
      const hint = watching
        ? 'Everyone races on their phones; this screen shows the race and the podium.'
        : isHost
          ? players.length < 2 ? 'You can start alone, or wait for friends to scan in.' : 'Everyone races the same course.'
          : 'Same course for everyone. Get ready!';
      action.replaceChildren(
        ...(isHost ? [start] : [waiting]),
        el('p', { className: 'action-hint', text: hint }),
        ...(isHost && !isTouch() ? [screenToggle] : []),
        error,
      );
    };

    screen.replaceChildren(
      header,
      el('div', { className: 'pond-main' }, [pond.element]),
      el('div', { className: 'pond-side' }, [boardCard, ...(isTouch() && !info.isHost ? [unfold] : []), invite]),
      action,
    );
    render();

    unsubscribe.forEach((u) => u());
    unsubscribe = [
      rooms.onPlayersChanged((list) => {
        players = list;
        render();
      }),
      rooms.onStandings((list) => {
        rows = list;
        offline = new Set(list.filter((r) => r.disconnected).map((r) => r.userId));
        render();
      }),
      rooms.onStart((startAt) => {
        if (room) options.onRoomStart(room, startAt);
      }),
    ];
  };

  const leaveRoom = async () => {
    unsubscribe.forEach((u) => u());
    unsubscribe = [];
    room = null;
    await rooms.leaveRoom();
  };

  window.addEventListener('pagehide', () => {
    void rooms.leaveRoom();
  });

  if (pendingCode) renderJoin(pendingCode);
  else renderHome();
  root.appendChild(screen);
  visible = true;

  return {
    hide: () => {
      visible = false;
      screen.remove();
    },
    show: () => {
      if (visible) return;
      visible = true;
      root.appendChild(screen);
    },
    room: () => room,
    // Only the host's screen can be the big screen.
    bigScreen: () => bigScreen && (room?.isHost ?? false),
  };
}
