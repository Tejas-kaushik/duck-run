// Phone controls (Tejas): the game's two buttons are the two halves of the screen. Tap the left half
// for LEFT (A) and the right half for RIGHT (D), through the game's InputState, so a phone plays
// exactly like a laptop: the halves change lane, either half fires at the boss's FIRE, and either half
// gets past an instruction card. A marker in each bottom corner shows what a tap does right now.
// Shown on touch screens, or anywhere with ?touch.

import type { Game } from '../core/Game';
import type { Stage } from '../core/types';
import { el } from './dom';

const IN_RUN: ReadonlySet<Stage> = new Set(['RUNNER_1', 'DIVE', 'UNDERWATER', 'SURFACE_RETURN', 'RUNNER_2', 'BOSS']);

const SCOPE = `<svg viewBox="-50 -50 100 100" aria-hidden="true" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round">
  <circle r="34"/><circle r="10" fill="#fff" stroke="none"/>
  <line x1="0" y1="-46" x2="0" y2="-22"/><line x1="0" y1="22" x2="0" y2="46"/>
  <line x1="-46" y1="0" x2="-22" y2="0"/><line x1="22" y1="0" x2="46" y2="0"/></svg>`;

export function usesTouch(): boolean {
  if (new URLSearchParams(window.location.search).has('touch')) return true;
  return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches;
}

/** What a tap does right now, shown in each half's marker. */
type ZoneLook = 'lane' | 'fire' | 'next' | 'idle';

export function mountTouchControls(root: HTMLElement, game: Game): void {
  if (!usesTouch()) return;
  document.body.classList.add('touch');

  /** One half of the screen: pressing it is pressing that key. Extra fingers on the same half don't double-press. */
  const zone = (side: 'left' | 'right', keyCode: string) => {
    const marker = el('div', { className: 'touch-marker' });
    const z = el('div', { className: `touch-zone ${side}` }, [marker]);
    z.setAttribute('role', 'button');
    z.setAttribute('aria-label', side === 'left' ? 'Left button' : 'Right button');
    const pointers = new Set<number>();
    const release = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId) || pointers.size > 0) return;
      z.classList.remove('down');
      game.input.keyUp(keyCode);
    };
    z.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (pointers.size === 0) {
        z.classList.add('down');
        game.input.keyDown(keyCode, false);
        navigator.vibrate?.(8);
      }
      pointers.add(e.pointerId);
      try {
        z.setPointerCapture(e.pointerId); // the press ends where the thumb lifts, even outside the half
      } catch {
        // pointer already gone
      }
    });
    z.addEventListener('pointerup', release);
    z.addEventListener('pointercancel', release);
    z.addEventListener('lostpointercapture', release);
    z.addEventListener('contextmenu', (e) => e.preventDefault());
    return {
      element: z,
      show(look: ZoneLook) {
        z.dataset.look = look;
        marker.innerHTML = look === 'fire' ? SCOPE : look === 'next' ? 'TAP' : side === 'left' ? '◀' : '▶';
      },
    };
  };

  const left = zone('left', 'KeyA');
  const right = zone('right', 'KeyD');
  const pad = el('div', { className: 'touch-controls' }, [left.element, right.element]);

  let shownFor: ZoneLook | null = null;
  game.onFrame(({ run, inputMode, waitingForInstructions }) => {
    const inRun = IN_RUN.has(run.stage);
    if (inRun !== pad.isConnected) {
      if (inRun) root.appendChild(pad);
      else pad.remove();
    }
    const look: ZoneLook = !inRun
      ? 'idle'
      : waitingForInstructions
        ? 'next'
        : inputMode === 'timing'
          ? 'fire'
          : inputMode === 'lanes'
            ? 'lane'
            : 'idle';
    if (look === shownFor) return;
    shownFor = look;
    left.show(look);
    right.show(look);
  });
}
