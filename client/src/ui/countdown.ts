// The 3-2-1 before a run. Driven by the game's frame info, so a room's shared start time just works.

import type { Game } from '../core/Game';
import { el } from './dom';

export function mountCountdown(root: HTMLElement, game: Game): void {
  const node = el('div', { className: 'countdown' });
  game.onFrame(({ run, countdownSec }) => {
    if (run.stage !== 'COUNTDOWN') {
      if (node.isConnected) node.remove();
      return;
    }
    if (!node.isConnected) root.appendChild(node);
    const text = String(Math.ceil(countdownSec));
    if (node.textContent !== text) node.textContent = text;
  });
}
