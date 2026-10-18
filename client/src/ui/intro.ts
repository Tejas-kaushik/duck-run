// The story intro (Vansh): a short animated film before every first run, like the opening of a Mario
// game. Bill owes the Don, the Don sends the dog, and the pond is full of coins. The player is film.ts.
// Rooms play it on a fixed clock that ends on the shared start, so everyone starts running together.

import type { AudioHandle } from '../audio';
import { OUT_BACK, SLAM, playFilm, shake, type Move, type Shot } from './film';
import { POND_COINS, SCENES, type SceneName } from './introArt';

const POND_SEC = 2.6;
/** Bill dives for the first quarter, then swims 250 units right; each coin vanishes as he reaches it. */
const coinPickups: Move[] = POND_COINS.map(([cx], i) => ({
  sel: `.a-coin-${i}`,
  start: POND_SEC * (0.25 + ((cx - 70) / 250) * 0.75),
  dur: 0.22,
  frames: [
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'translateY(-14px) scale(1.6)', opacity: 0 },
  ],
}));

export const SHOTS: Shot<SceneName>[] = [
  {
    scene: 'bill',
    focus: 33,
    dur: 2.3,
    camera: ['scale(1.05)', 'scale(1.2) translate(-2%, 2%)'],
    moves: [
      { sel: '.a-bill', dur: 0.7, easing: 'ease-out', frames: [{ transform: 'translateX(-260px)' }, { transform: 'translateX(0)' }] },
      { sel: '.a-bill', start: 0.7, dur: 0.4, iterations: 4, frames: [{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }] },
      { sel: '.a-sun', frames: [{ transform: 'translateY(20px)' }, { transform: 'translateY(0)' }] },
      { sel: '.a-joke', start: 1.1, dur: 0.3, frames: [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }] },
    ],
    lines: [
      { text: 'This is Bill.', t: 0.3 },
      { text: 'Duck. Suit. No job.', t: 1.0 },
    ],
  },
  {
    scene: 'iou',
    dur: 2.6,
    sound: 'sting',
    camera: ['scale(1)', 'scale(1.12)'],
    moves: [
      { sel: '.a-iou', dur: 0.5, easing: OUT_BACK, frames: [{ transform: 'translateY(-280px) rotate(-12deg)' }, { transform: 'translateY(0) rotate(0)' }] },
      { sel: '.a-stamp', start: 1.0, dur: 0.25, easing: SLAM, frames: [{ transform: 'scale(3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }] },
      { sel: '.a-iou', start: 1.2, dur: 0.25, frames: shake(5) },
    ],
    lines: [
      { text: 'Three weeks ago, Bill borrowed 1,000 breadcrumbs from the Don.', t: 0.3 },
      { text: 'Interest: 400% a week. Bill cannot read.', t: 1.3 },
    ],
  },
  {
    scene: 'don',
    dur: 2.8,
    camera: ['scale(1)', 'scale(1.25) translate(0, 8%)'],
    moves: [
      { sel: '.a-light', dur: 0.5, frames: [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }] },
      { sel: '.a-don', dur: 0.8, easing: 'ease-out', frames: [{ transform: 'translateX(90px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }] },
    ],
    lines: [
      { who: 'The Don', text: 'Bill, Bill, Bill...', t: 0.6, at: [18, 14], tail: 'right' },
      { who: 'The Don', text: 'WHERE. IS. MY. BREAD?', t: 1.5, at: [68, 30], tail: 'left' },
    ],
  },
  {
    scene: 'dog',
    focus: 60,
    dur: 2.2,
    sound: 'bark',
    camera: ['scale(1)', 'scale(1.08)'],
    fx: { text: 'WOOF!', at: [26, 40], t: 0.35 },
    moves: [
      { sel: '.a-dog', dur: 0.35, easing: OUT_BACK, frames: [{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }] },
      { sel: '.a-dog', start: 0.35, dur: 0.12, iterations: 5, frames: shake(7) },
      { sel: '.a-don', start: 0.5, dur: 0.4, frames: [{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'translateX(0)' }] },
    ],
    lines: [
      { who: 'The Don', text: 'Biscuit. Fetch.', t: 0.7, at: [70, 16], tail: 'right' },
      { text: '(Translation: "You are dead, feathers.")', t: 1.2 },
    ],
  },
  {
    scene: 'pond',
    dur: POND_SEC,
    camera: ['scale(1.15) translate(6%, 4%)', 'scale(1) translate(0, 0)'],
    moves: [
      {
        sel: '.a-diver',
        easing: 'linear',
        frames: [
          { offset: 0, transform: 'translate(0, -230px) rotate(90deg)', easing: 'ease-in' },
          { offset: 0.25, transform: 'translate(0, -20px) rotate(10deg)', easing: 'ease-out' },
          { offset: 1, transform: 'translate(250px, -24px) rotate(0)' },
        ],
      },
      { sel: '.a-splash', start: 0.1, dur: 0.5, frames: [{ transform: 'scale(0.2)', opacity: 1 }, { transform: 'scale(2.4)', opacity: 0 }] },
      ...coinPickups,
    ],
    lines: [
      { text: 'The pond floor is full of lost coins.', t: 0.4 },
      { text: 'Enough to pay the Don. Maybe.', t: 1.3 },
    ],
  },
  {
    scene: 'hook',
    dur: 2.5,
    sound: 'sting',
    camera: ['scale(1)', 'scale(1.3) translate(-6%, 0)'],
    moves: [
      { sel: '.a-hook', dur: 0.8, easing: 'ease-out', frames: [{ transform: 'translateY(-170px)' }, { transform: 'translateY(0)' }] },
      { sel: '.a-hook', start: 0.8, dur: 0.85, iterations: 2, frames: [{ transform: 'rotate(0)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(0)' }] },
      { sel: '.a-bill', start: 0.9, dur: 1.6, easing: 'ease-in', frames: [{ transform: 'translate(0, 0)' }, { transform: 'translate(70px, -30px)' }] },
    ],
    lines: [
      { text: 'One problem.', t: 0.3 },
      { text: 'Bill has never once said no to a dollar.', t: 1.0 },
    ],
  },
  {
    scene: 'run',
    focus: 42,
    dur: 2.3,
    sound: 'quack',
    camera: ['scale(1.1)', 'scale(1.1) translate(-1%, 0)'],
    moves: [
      { sel: '.a-scroll', dur: 0.5, iterations: Infinity, easing: 'linear', frames: [{ transform: 'translateX(0)' }, { transform: 'translateX(-100px)' }] },
      { sel: '.a-runner', dur: 0.18, iterations: Infinity, frames: [{ transform: 'translateY(0)' }, { transform: 'translateY(-7px)' }, { transform: 'translateY(0)' }] },
      { sel: '.a-chaser', easing: 'ease-in', frames: [{ transform: 'translateX(-70px)' }, { transform: 'translateX(70px)' }] },
    ],
    lines: [
      { who: 'Bill', text: 'QUACK!', t: 0.3, at: [84, 6], tail: 'left' },
      { text: '(Translation: "RUN.")', t: 0.9 },
    ],
  },
  { scene: 'title', dur: 2.2, sound: 'titleHit', camera: ['scale(1.15)', 'scale(1)'], lines: [{ text: 'Pay the Don. Or become dinner.', t: 0.7 }] },
];

/** Kept for the tests and the room timing: the shots, and how long each lasts. */
export const PANELS = SHOTS;
export const PANEL_SEC = SHOTS.map((s) => s.dur);
/** The whole film. Rooms add this to the shared start so everyone watches it in sync. */
export const INTRO_SEC = PANEL_SEC.reduce((a, b) => a + b, 0);

export interface IntroOptions {
  /** performance.now() time to end exactly on. The film then follows the clock and can't be skipped. */
  endsAt?: number;
}

/** Show the intro over `root`, then call onDone (after the last shot, a skip, or at endsAt). */
export function playIntro(root: HTMLElement, audio: AudioHandle, onDone: () => void, options: IntroOptions = {}): { stop(): void } {
  return playFilm(root, audio, SHOTS, SCENES, onDone, { ...options, music: 'intro' });
}

/** Before a rematch in a room: one quick title card, ROUND 2 and so on, ending on the shared start. */
export function playRoundCard(root: HTMLElement, audio: AudioHandle, round: number, endsAt: number): void {
  const card: Shot<SceneName> = {
    scene: 'title',
    title: ['ROUND', String(round)],
    dur: 2.5,
    sound: 'titleHit',
    camera: ['scale(1.15)', 'scale(1)'],
    lines: [{ text: 'The debt is still unpaid. RUN!', t: 0.4 }],
  };
  playFilm(root, audio, [card], SCENES, () => {}, { endsAt });
}
