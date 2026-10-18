// The room lobby's pond (Tejas): every player is a Bill floating on the pond, in their own coat colour.
// New players splash down, leavers fade out, and everyone drifts to make room. Styles in lobby.css.

import type { RoomPlayer } from '../network/types';
import { el } from './dom';
import { bill } from './introArt';

/** Coat, lapel and tie per player, so ducks are easy to tell apart. */
const OUTFITS: [string, string, string][] = [
  ['#7a5c3e', '#6a4e33', '#c0392b'], // Bill's own brown
  ['#2c4a7a', '#223a61', '#f1c40f'],
  ['#2e7d4f', '#24633e', '#e67e22'],
  ['#6c3d8f', '#552f72', '#1abc9c'],
  ['#a5332b', '#852822', '#ecf0f1'],
  ['#1f7a7a', '#186262', '#e84393'],
  ['#4b4f58', '#3a3d44', '#e74c3c'],
  ['#b06a1f', '#8e5518', '#2c3e50'],
];

export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Bill dressed in this player's outfit, cropped at the waterline. */
export function duckSvg(id: string): string {
  const [coat, lapel, tie] = OUTFITS[hashId(id) % OUTFITS.length];
  const art = bill(0, 0, 1, 'cool').replace(/#7a5c3e/g, coat).replace(/#6a4e33/g, lapel).replace(/#c0392b/g, tie);
  return `<svg viewBox="-66 -160 132 136" aria-hidden="true">${art}</svg>`;
}

/**
 * Spots on the pond for n ducks: a sunflower spiral squashed into the pond's oval, so any number
 * spreads out evenly. Percentages of the pond's box.
 */
export function pondSpots(n: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const r = n === 1 ? 0 : Math.sqrt((i + 0.5) / n);
    const a = i * 2.39996 + 0.6;
    return { x: 50 + Math.cos(a) * r * 36, y: 60 + Math.sin(a) * r * 30 };
  });
}

export interface PondHandle {
  element: HTMLElement;
  update(players: readonly RoomPlayer[], meId: string, offline: ReadonlySet<string>): void;
}

export function mountPond(): PondHandle {
  const ducks = new Map<string, HTMLElement>();
  const water = el('div', { className: 'pond-water' }, [
    ...[0, 1, 2].map((i) => {
      const ring = el('div', { className: 'pond-ripple' });
      ring.style.animationDelay = `${i * 1.3}s`;
      return ring;
    }),
    ...[
      [14, 30, 1],
      [80, 26, 0.8],
      [86, 70, 1.1],
      [18, 74, 0.9],
    ].map(([x, y, s]) => {
      const pad = el('div', { className: 'lily' });
      pad.style.left = `${x}%`;
      pad.style.top = `${y}%`;
      pad.style.transform = `translate(-50%, -50%) scale(${s})`;
      return pad;
    }),
  ]);
  const element = el('div', { className: 'pond' }, [
    el('div', { className: 'reeds left' }),
    el('div', { className: 'reeds right' }),
    water,
  ]);

  return {
    element,
    update(players, meId, offline) {
      const present = new Set(players.map((p) => p.id));
      for (const [id, duck] of ducks) {
        if (present.has(id)) continue;
        ducks.delete(id);
        duck.classList.add('leaving');
        setTimeout(() => duck.remove(), 600);
      }
      // Stable order (join order from the room), so ducks don't swap places on every update.
      const spots = pondSpots(players.length);
      players.forEach((p, i) => {
        let duck = ducks.get(p.id);
        if (!duck) {
          duck = el('div', { className: 'duck splash' }, [
            el('div', { className: 'duck-bob' }),
            el('div', { className: 'duck-tag' }),
          ]);
          duck.querySelector('.duck-bob')!.innerHTML = duckSvg(p.id);
          duck.style.setProperty('--bob-delay', `${-(hashId(p.id) % 1000) / 400}s`);
          setTimeout(() => duck?.classList.remove('splash'), 900);
          water.appendChild(duck);
          ducks.set(p.id, duck);
        }
        duck.style.left = `${spots[i].x}%`;
        duck.style.top = `${spots[i].y}%`;
        duck.style.zIndex = String(Math.round(spots[i].y)); // nearer ducks in front
        duck.classList.toggle('me', p.id === meId);
        duck.classList.toggle('host', p.isHost);
        duck.classList.toggle('offline', offline.has(p.id));
        const tag = duck.querySelector('.duck-tag')!;
        tag.textContent = `${p.isHost ? '👑 ' : ''}${p.nickname}${p.id === meId ? ' (you)' : ''}`;
      });
    },
  };
}
