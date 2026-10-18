import { CONFIG } from '../core/config';
import type { Game } from '../core/Game';
import type { Stage } from '../core/types';
import { el } from './dom';
import { usesTouch } from './touchControls';

/** On phones the card names the screen halves (ui/touchControls.ts) instead of keys. */
const forTouch = (controls: string) =>
  controls
    .replace(/A and D to dodge/g, 'Tap left / right to dodge')
    .replace(/A and D/g, 'Tap left / right')
    .replace(/A or D on FIRE/g, 'tap either side on FIRE')
    .replace(/press A or D/g, 'tap either side of the screen');

interface Instructions {
  title: string;
  subtitle?: string;
  details: string[];
  controls: string;
}

const STAGE_INSTRUCTIONS: Partial<Record<Stage, Instructions>> = {
  RUNNER_1: {
    title: 'Dodge the logs',
    details: [],
    controls: 'A and D',
  },
  UNDERWATER: {
    title: 'Collect coins to gain items',
    subtitle: 'Dodge the enemies',
    details: [
      `Coins: ${CONFIG.powerUps.shieldCoins} = Shield · ${CONFIG.powerUps.boostCoins} = Boost · ${CONFIG.powerUps.laserCoins} = Laser`,
    ],
    controls: 'A and D',
  },
  RUNNER_2: {
    title: 'Dodge the logs',
    details: [],
    controls: 'A and D',
  },
  BOSS: {
    title: 'Dodge the bullets',
    details: ['When FIRE appears, press A or D as fast as you can.'],
    controls: 'A and D to dodge · A or D on FIRE',
  },
};
const touch = typeof window !== 'undefined' && usesTouch();

/** The core's safe lead-in controls both this card's lifetime and the start of gameplay. */
export function mountStageInstructions(root: HTMLElement, game: Game): void {
  const card = el('aside', { className: 'stage-instructions' });
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  card.setAttribute('aria-atomic', 'true');

  let currentStage: Stage | null = null;
  let instructions: Instructions | undefined;

  // A direct dev jump can restart the same stage without a countdown in between.
  game.onEvent((event) => {
    if (event.type === 'attemptStarted') currentStage = null;
  });

  game.onFrame(({ run, waitingForInstructions }) => {
    if (run.stage !== currentStage) {
      currentStage = run.stage;
      instructions = STAGE_INSTRUCTIONS[run.stage];
      card.remove();
      if (instructions) {
        card.replaceChildren(
          el('h2', { text: instructions.title }),
          ...(instructions.subtitle
            ? [el('p', { className: 'stage-instructions-goal', text: instructions.subtitle })]
            : []),
          ...instructions.details.map((text) => el('p', { text: touch ? forTouch(text) : text })),
          el('p', { className: 'stage-instructions-controls' }, [
            el('span', { className: 'stage-instructions-label', text: touch ? 'BUTTONS' : 'ALLOWED KEYS' }),
            el('strong', { text: touch ? forTouch(instructions.controls) : instructions.controls }),
          ]),
          el('p', { className: 'stage-instructions-continue' }, touch
            ? ['Tap ', el('kbd', { text: 'either side' }), ' to go']
            : ['Press ', el('kbd', { text: 'A' }), ' or ', el('kbd', { text: 'D' }), ' to continue']),
        );
      }
    }

    if (!instructions || run.status !== 'running') {
      card.remove();
      return;
    }
    if (!waitingForInstructions) {
      card.remove();
      return;
    }
    if (!card.isConnected) root.appendChild(card);
  });
}
