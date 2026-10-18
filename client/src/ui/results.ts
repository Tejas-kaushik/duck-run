// Solo results: time, race score, best time, Retry and back to the menu.
// Room races use raceResults.ts instead (standings, back to the pond).

import type { Game } from '../core/Game';
import { raceScore } from '../core/RunState';
import { el, formatTime, onButton } from './dom';
import { SECTION_LABEL } from './stageNames';

export interface ResultsOptions {
  onRetry(): void;
  onMenu(): void;
  /** True while playing a room race (raceResults.ts shows the results then). */
  inRace(): boolean;
}

export function mountResults(root: HTMLElement, game: Game, options: ResultsOptions): void {
  let bestMs: number | null = null;
  let panel: HTMLElement | null = null;

  game.onEvent((e) => {
    if (e.type !== 'stageChanged') return;
    panel?.remove();
    panel = null;
    if (e.stage !== 'FINISHED' && e.stage !== 'FAILED') return;
    if (options.inRace()) return;

    const run = game.run;
    const finished = e.stage === 'FINISHED';
    if (finished && (bestMs === null || run.elapsedMs < bestMs)) bestMs = run.elapsedMs;

    const retry = el('button', { text: finished ? 'Play again' : 'Retry' });
    onButton(retry, options.onRetry);
    const menu = el('button', { className: 'secondary', text: 'Main menu' });
    onButton(menu, () => {
      panel?.remove();
      panel = null;
      options.onMenu();
    });
    panel = el('div', { className: 'panel' }, [
      el('h1', { text: finished ? 'Made it!' : 'Failed' }),
      el('p', {
        text: finished
          ? `Time ${formatTime(run.elapsedMs)} · ${raceScore(run).toLocaleString()} pts`
          : `Out of lives in ${SECTION_LABEL[run.phase]} · ${raceScore(run).toLocaleString()} pts`,
      }),
      el('p', { className: 'muted', text: bestMs === null ? 'No completed run yet' : `Best ${formatTime(bestMs)}` }),
      retry,
      menu,
    ]);
    root.appendChild(panel);
  });
}
