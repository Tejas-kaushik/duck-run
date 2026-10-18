// The race leaderboard list (Tejas), used by the pond lobby and the end-of-race screen.
// Rows come ranked from network/ranking.ts (rankStandings): highest race score first.

import type { ScoreboardEntry } from '../network/ranking';
import { el, formatTime } from './dom';
import { describeEntry } from './scoreboard';

const MEDALS = ['🥇', '🥈', '🥉'];

/** The status chip for one row. */
export function standingStatus(e: ScoreboardEntry): string {
  switch (e.state) {
    case 'waiting':
      return 'Ready';
    case 'running':
      return `🏃 ${describeEntry(e)}`;
    case 'finished':
      return `🏁 ${formatTime(e.timeMs ?? 0)}`;
    case 'failed':
      return `💀 ${describeEntry(e)}`;
  }
}

export interface StandingsHandle {
  element: HTMLOListElement;
  update(rows: readonly ScoreboardEntry[], meId: string, limit?: number): void;
}

export function mountStandings(): StandingsHandle {
  const element = el('ol', { className: 'standings' });
  return {
    element,
    update(rows, meId, limit = Infinity) {
      // Always keep my own row, even when the list is cut short.
      const shown = rows.filter((r, i) => i < limit || r.userId === meId);
      const anyScore = rows.some((r) => r.state !== 'waiting');
      element.replaceChildren(
        ...shown.map((r) => {
          const classes = ['standing', r.state];
          if (r.userId === meId) classes.push('me');
          if (r.disconnected) classes.push('offline');
          if (r.left) classes.push('left');
          return el('li', { className: classes.join(' ') }, [
            el('span', { className: 'place', text: anyScore && r.rank <= 3 ? MEDALS[r.rank - 1] : String(r.rank) }),
            el('span', { className: 'who' }, [
              el('span', { className: 'name', text: r.nickname + (r.userId === meId ? ' (you)' : '') }),
              el('span', { className: 'chip', text: r.left ? `${standingStatus(r)} · left` : r.disconnected ? `${standingStatus(r)} · offline` : standingStatus(r) }),
            ]),
            el('span', { className: 'points', text: r.score.toLocaleString() }),
          ]);
        }),
      );
    },
  };
}
