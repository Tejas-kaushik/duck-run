// In-run HUD (Tejas): lives, coins + power-up track, score, timer, boss health and which keys work now.
// Functional first; Vansh restyles it later through ui.css.

import type { Game } from '../core/Game';
import { CONFIG } from '../core/config';
import type { InputMode, Stage } from '../core/types';
import { powerUpFor, raceScore } from '../core/RunState';
import type { PowerUp } from '../core/types';
import { el, formatTime } from './dom';
import { STAGE_LABEL } from './stageNames';

const POWER_LABEL: Record<PowerUp, string> = {
  none: '',
  shield: '🛡️ Shield ready for the boss',
  boost: '⚡ Speed boost',
  laser: '💥 Laser +50% on the boss',
};

/** The swim's coin track: how close you are to each power-up (20 shield, 50 boost, 100 laser). */
function mountCoinTrack() {
  const tiers: [number, string][] = [
    [CONFIG.powerUps.shieldCoins, '🛡️'],
    [CONFIG.powerUps.boostCoins, '⚡'],
    [CONFIG.powerUps.laserCoins, '💥'],
  ];
  const max = CONFIG.powerUps.laserCoins;
  const fill = el('div', { className: 'coin-fill' });
  const marks = tiers.map(([at, icon]) => {
    const mark = el('div', { className: 'coin-mark' }, [el('span', { text: icon }), el('small', { text: String(at) })]);
    mark.style.left = `${(100 * at) / max}%`;
    return mark;
  });
  const element = el('div', { className: 'coin-track' }, [el('div', { className: 'coin-bar' }, [fill]), ...marks]);
  return {
    element,
    show(visible: boolean, coins: number) {
      element.style.display = visible ? '' : 'none';
      if (!visible) return;
      fill.style.width = `${Math.min(100, (100 * coins) / max)}%`;
      marks.forEach((m, i) => m.classList.toggle('reached', coins >= tiers[i][0]));
    },
  };
}

const IN_RUN: ReadonlySet<Stage> = new Set([
  'RUNNER_1',
  'DIVE',
  'UNDERWATER',
  'SURFACE_RETURN',
  'RUNNER_2',
  'BOSS',
]);

const KEY_HINT: Record<InputMode, string> = {
  none: '',
  lanes: 'A ◀   ▶ D',
  timing: 'A or D = FIRE',
};

export function mountHud(root: HTMLElement, game: Game): void {
  const lives = el('div');
  const coins = el('div', { className: 'coins' });
  const power = el('div', { className: 'power' });
  const coinTrack = mountCoinTrack();
  const stage = el('div', { className: 'stage' });
  const time = el('div');
  const score = el('div');
  const bossFill = el('div', { className: 'boss-fill' });
  const bossHp = el('span');
  const boss = el('div', { className: 'boss' }, [
    el('div', { className: 'boss-name' }, ['🎩 DON CRUMBS ', bossHp]),
    el('div', { className: 'boss-bar' }, [bossFill]),
  ]);
  const scoreBox = el('div', { className: 'score-box' }, [time, score]);
  const hud = el('div', { className: 'hud' }, [
    el('div', {}, [lives, coins, power, stage]),
    coinTrack.element,
    scoreBox,
    boss,
  ]);
  const keys = el('div', { className: 'keys' });

  // A pickup's points (a breadcrumb) pop up under the score, so the jump is easy to see.
  let pop: HTMLElement | null = null;
  game.onEvent((event) => {
    if (event.type !== 'scoreChanged' || event.delta <= 0 || !hud.isConnected) return;
    pop?.remove();
    const next = el('div', { className: 'score-pop', text: `+${event.delta.toLocaleString()}` });
    next.addEventListener('animationend', () => next.remove());
    scoreBox.appendChild(next);
    pop = next;
  });

  // Only touch the DOM when a value actually changes.
  const set = (node: HTMLElement, text: string) => {
    if (node.textContent !== text) node.textContent = text;
  };

  game.onFrame(({ run, inputMode }) => {
    const visible = IN_RUN.has(run.stage);
    if (visible !== hud.isConnected) {
      if (visible) root.append(hud, keys);
      else {
        hud.remove();
        keys.remove();
      }
    }
    if (!visible) return;

    set(lives, '❤️'.repeat(run.lives));
    // Coins show from the swim onwards; the power-up they bought is named after the swim.
    const swimming = run.stage === 'UNDERWATER';
    const afterSwim = run.stage === 'SURFACE_RETURN' || run.stage === 'RUNNER_2' || run.stage === 'BOSS';
    set(coins, swimming || afterSwim ? `🪙 ${run.coins}` : '');
    coinTrack.show(swimming, run.coins);
    // The boss arena shows its power-up in the scene (shield, red eyes), so the label stays out of the way there.
    set(power, afterSwim && run.stage !== 'BOSS' ? POWER_LABEL[powerUpFor(run.coins)] : '');
    set(stage, STAGE_LABEL[run.stage]);
    set(time, formatTime(run.elapsedMs));
    set(score, `${raceScore(run).toLocaleString()} pts`); // the race score rooms rank by
    set(keys, KEY_HINT[inputMode]);
    boss.style.display = run.stage === 'BOSS' ? '' : 'none';
    set(bossHp, `${run.bossHealth.toLocaleString()} / ${CONFIG.boss.health.toLocaleString()}`);
    bossFill.style.width = `${(100 * run.bossHealth) / CONFIG.boss.health}%`;
  });
}
