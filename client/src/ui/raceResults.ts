// End of a room race (Tejas): your score, your place, and the room's standings, live while others are
// still racing. Then everyone heads back to the pond lobby (a button, or on its own after a while).
// Solo runs keep the plain results screen (results.ts).

import type { Game } from '../core/Game';
import { raceScore } from '../core/RunState';
import type { ScoreboardEntry } from '../network/ranking';
import type { RoomApi, RoomInfo } from '../network/types';
import { el, onButton } from './dom';
import { mountStandings } from './standings';

const AUTO_BACK_SEC = 20;
const ORDINAL = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

export interface RaceResultsOptions {
  rooms: RoomApi;
  /** The room race being played, or null for solo. */
  race(): RoomInfo | null;
  onBack(): void;
}

export function mountRaceResults(root: HTMLElement, game: Game, options: RaceResultsOptions): void {
  let overlay: HTMLElement | null = null;
  let cleanup: (() => void) | null = null;

  const close = () => {
    cleanup?.();
    cleanup = null;
    overlay?.remove();
    overlay = null;
  };

  game.onEvent((e) => {
    if (e.type !== 'stageChanged') return;
    close();
    const room = options.race();
    if (!room || (e.stage !== 'FINISHED' && e.stage !== 'FAILED')) return;

    const finished = e.stage === 'FINISHED';
    const myScore = raceScore(game.run);
    const place = el('p', { className: 'my-place', text: 'Waiting for the others…' });
    const scoreText = el('p', { className: 'my-score', text: myScore.toLocaleString() });
    const board = mountStandings();
    const back = el('button', { className: 'big', text: '🦆  Back to the pond' });
    onButton(back, () => {
      close();
      options.onBack();
    });

    overlay = el('div', { className: 'race-results' }, [
      el('div', { className: 'card' }, [
        el('p', { className: 'verdict', text: finished ? '🏁 You beat the Don!' : '💀 Out of lives!' }),
        scoreText,
        place,
        board.element,
        back,
      ]),
    ]);
    root.appendChild(overlay);

    // Count the score up, for a bit of drama.
    const t0 = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const k = Math.min(1, (now - t0) / 1200);
      scoreText.textContent = Math.round(myScore * (1 - Math.pow(1 - k, 3))).toLocaleString();
      if (k < 1) raf = requestAnimationFrame(tick);
    });

    const onRows = (rows: ScoreboardEntry[]) => {
      board.update(rows, room.playerId, 5);
      const me = rows.find((r) => r.userId === room.playerId);
      const racing = rows.filter((r) => r.state === 'running' && !r.disconnected && r.userId !== room.playerId).length;
      if (!me) return;
      if (rows.length === 1) place.textContent = 'Solo race: invite friends for next time!';
      else if (racing) place.textContent = `${ORDINAL(me.rank)} so far · ${racing} still racing…`;
      else place.textContent = me.rank === 1 ? '🥇 You won the race!' : `You came ${ORDINAL(me.rank)} of ${rows.length}`;
    };
    const stopRows = options.rooms.onStandings(onRows);

    let left = AUTO_BACK_SEC;
    const timer = setInterval(() => {
      left -= 1;
      back.textContent = `🦆  Back to the pond (${left})`;
      if (left <= 0) back.click();
    }, 1000);

    cleanup = () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      stopRows();
    };
  });
}
