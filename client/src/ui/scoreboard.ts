// Live scoreboard (Mayank): the room's ranking in the top-right corner during a room race.
// Draws whatever rows it is given; network/supabaseScoreboard.ts feeds it, network/ranking.ts orders them.

import type { PhaseId } from '../core/types';
import type { ScoreboardEntry } from '../network/ranking';
import { el, formatTime } from './dom';
import './scoreboard.css';
import { SECTION_LABEL } from './stageNames';

const SECTION_NAME: Record<PhaseId, string> = SECTION_LABEL;

export interface ScoreboardHandle {
  update(entries: readonly ScoreboardEntry[]): void;
  destroy(): void;
}

/** What the right-hand column says for one player. */
export function describeEntry(entry: ScoreboardEntry): string {
  const section = SECTION_NAME[entry.phase];
  switch (entry.state) {
    case 'finished':
      return formatTime(entry.timeMs ?? 0);
    case 'running':
      return `${section} ${Math.round(entry.progress * 100)}%`;
    case 'failed':
      return `Out in ${section}`;
    case 'waiting':
      return 'Ready';
  }
}

export function mountScoreboard(root: HTMLElement, playerId: string): ScoreboardHandle {
  const list = el('ol');
  const board = el('div', { className: 'scoreboard' }, [el('div', { className: 'scoreboard-title', text: 'Room' }), list]);
  root.appendChild(board);

  return {
    update(entries) {
      list.replaceChildren(
        ...entries.map((e) => {
          const classes = ['row', e.state];
          if (e.userId === playerId) classes.push('me');
          if (e.disconnected) classes.push('offline');
          return el('li', { className: classes.join(' ') }, [
            el('span', { className: 'rank', text: String(e.rank) }),
            el('span', { className: 'name', text: e.nickname }),
            el('span', { className: 'status', text: e.disconnected ? `${describeEntry(e)} · offline` : describeEntry(e) }),
          ]);
        }),
      );
    },
    destroy() {
      board.remove();
    },
  };
}
