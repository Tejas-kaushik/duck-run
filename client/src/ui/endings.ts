// Endings (Vansh): a short film for how Bill went out (a log, Biscuit or the Don) and one for the win.
// A, D or a click moves through it and Skip jumps to the end. The film then holds its last frame and
// the results card (with Retry) moves onto it, so Retry sits on the animation's own background.
// Played with the same film player as the intro.

import type { AudioHandle } from '../audio';
import type { Game } from '../core/Game';
import type { DamageCause } from '../core/types';
import { CONFETTI_COUNT, ENDING_SCENES, FEATHER_PATHS, type EndingScene } from './endingArt';
import { OUT_BACK, SLAM, playFilm, shake, type Move, type Shot } from './film';

/** Stars fade in once, then circle forever. */
const circlingStars = (start: number): Move[] => [
  { sel: '.a-stars', start, dur: 0.1, frames: [{ opacity: 0 }, { opacity: 1 }] },
  { sel: '.a-stars', start, dur: 0.6, iterations: Infinity, easing: 'linear', frames: [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }] },
];

const feathersFly: Move[] = FEATHER_PATHS.map(([dx, dy, turn], i) => ({
  sel: `.a-feather-${i}`,
  start: 0.5,
  dur: 1.1,
  easing: 'ease-out',
  frames: [
    { opacity: 0, transform: 'translate(0, 0) rotate(0)' },
    { offset: 0.1, opacity: 1 },
    { opacity: 0, transform: `translate(${dx * 2}px, ${dy * 1.5}px) rotate(${turn * 4}deg)` },
  ],
}));

const confetti: Move[] = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  sel: `.a-conf-${i}`,
  start: 0.4 + (i % 6) * 0.08,
  dur: 1.4 + (i % 4) * 0.2,
  iterations: Infinity,
  easing: 'linear',
  frames: [
    { transform: 'translate(0, 0) rotate(0)' },
    { transform: `translate(${((i * 37) % 60) - 30}px, 250px) rotate(${i % 2 ? 720 : -720}deg)` },
  ],
}));

export const DEATH_FILMS: Record<DamageCause, Shot<EndingScene>[]> = {
  log: [
    {
      scene: 'logHit',
      focus: 55,
      dur: 2.8,
      camera: ['scale(1)', 'scale(1.15) translate(6%, -4%)'],
      fx: { text: 'BONK!', at: [60, 28], t: 0.45 },
      moves: [
        { sel: '.a-log', dur: 0.45, easing: 'ease-in', frames: [{ transform: 'translateX(260px) rotate(0)' }, { transform: 'translateX(-110px) rotate(-200deg)' }] },
        { sel: '.a-log', start: 0.45, dur: 0.8, easing: 'ease-out', frames: [{ transform: 'translateX(-110px) rotate(-200deg)' }, { transform: 'translate(-420px, -80px) rotate(-420deg)' }] },
        { sel: '.a-bill', start: 0.42, dur: 0.22, frames: [{ opacity: 1, transform: 'translate(0, 0) rotate(0)' }, { opacity: 0, transform: 'translate(-60px, -30px) rotate(-40deg)' }] },
        { sel: '.a-ko', start: 0.55, dur: 0.3, easing: OUT_BACK, frames: [{ opacity: 0, transform: 'translateY(-30px)' }, { opacity: 1, transform: 'translateY(0)' }] },
        { sel: '.a-ko', start: 0.85, dur: 0.8, iterations: 3, frames: [{ transform: 'translateY(0)' }, { transform: 'translateY(3px)' }, { transform: 'translateY(0)' }] },
        { sel: '.a-splash', start: 0.55, dur: 0.5, frames: [{ transform: 'scale(0.2)', opacity: 1 }, { transform: 'scale(2.2)', opacity: 0 }] },
        ...circlingStars(0.9),
      ],
      lines: [
        { text: 'Bill met a log.', t: 0.9 },
        { text: 'The log is fine.', t: 1.7 },
      ],
    },
  ],
  dog: [
    {
      scene: 'dogBite',
      focus: 47,
      dur: 1.8,
      camera: ['scale(1)', 'scale(1.15)'],
      fx: { text: 'CHOMP!', at: [52, 18], t: 0.45 },
      moves: [
        { sel: '.a-dog', dur: 0.45, easing: 'ease-in', frames: [{ transform: 'translateX(-140px)' }, { transform: 'translateX(60px)' }] },
        { sel: '.a-cloud', start: 0.4, dur: 0.25, easing: OUT_BACK, frames: [{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }] },
        { sel: '.a-cloud', start: 0.65, dur: 0.1, iterations: 10, frames: shake(6) },
        { sel: '.a-bill', start: 0.4, dur: 0.1, frames: [{ opacity: 1 }, { opacity: 0 }] },
        ...feathersFly,
      ],
      lines: [{ text: 'Biscuit fetched.', t: 0.9 }],
    },
    {
      scene: 'dogAfter',
      focus: 60,
      dur: 2.4,
      camera: ['scale(1.1)', 'scale(1)'],
      moves: [
        { sel: '.a-dog', dur: 0.5, iterations: 5, frames: [{ transform: 'rotate(-3deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(-3deg)' }] },
        { sel: '.a-don', start: 0.2, dur: 0.4, frames: [{ opacity: 0 }, { opacity: 1 }] },
      ],
      lines: [
        { who: 'The Don', text: 'Good boy.', t: 0.4, at: [78, 34], tail: 'right' },
        { text: 'Biscuit got a new hat.', t: 1.0 },
      ],
    },
  ],
  boss: [
    {
      scene: 'bossShot',
      focus: 55,
      dur: 1.9,
      camera: ['scale(1)', 'scale(1.1) translate(8%, 0)'],
      fx: { text: 'BANG!', at: [55, 24], t: 0.4 },
      moves: [
        { sel: '.a-flash', start: 0.4, dur: 0.25, frames: [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }] },
        { sel: '.a-don', start: 0.4, dur: 0.15, frames: [{ transform: 'translateX(0)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }] },
        {
          sel: '.a-bill',
          start: 0.45,
          dur: 0.9,
          easing: 'ease-in',
          frames: [
            { transform: 'translate(0, 0) rotate(0)' },
            { offset: 0.5, transform: 'translate(-20px, -30px) rotate(-360deg)' },
            { transform: 'translate(-30px, 20px) rotate(-450deg)' },
          ],
        },
      ],
      lines: [{ who: 'The Don', text: 'Say goodnight, Bill.', t: 0.05, at: [70, 6], tail: 'right' }],
    },
    {
      scene: 'bossAfter',
      focus: 52,
      dur: 2.6,
      camera: ['scale(1)', 'scale(1.1)'],
      moves: [
        { sel: '.a-ghost', easing: 'ease-out', frames: [{ transform: 'translateY(30px)', opacity: 0 }, { offset: 0.2, opacity: 1 }, { transform: 'translateY(-40px)', opacity: 1 }] },
      ],
      lines: [
        { who: 'The Don', text: 'Nothing personal, Bill.', t: 0.5, at: [70, 8], tail: 'right' },
        { text: 'Bill is now a ghost duck.', t: 1.2 },
      ],
    },
  ],
};

export const WIN_FILM: Shot<EndingScene>[] = [
  {
    scene: 'bossDown',
    dur: 2.2,
    camera: ['scale(1.1)', 'scale(1)'],
    fx: { text: 'K.O.!', at: [28, 26], t: 0.3 },
    moves: [
      { sel: '.a-hat', dur: 0.9, easing: 'ease-out', frames: [{ transform: 'translate(0, 0) rotate(0)' }, { transform: 'translate(130px, -170px) rotate(220deg)' }] },
      { sel: '.a-topple', start: 0.2, dur: 0.6, easing: 'ease-in', frames: [{ transform: 'rotate(0)' }, { transform: 'rotate(80deg)' }] },
      ...circlingStars(0.8),
    ],
    lines: [{ text: 'The Don is down.', t: 0.8 }],
  },
  {
    scene: 'paid',
    dur: 3,
    sound: 'cash',
    camera: ['scale(1)', 'scale(1.08)'],
    moves: [
      { sel: '.a-paid', start: 0.5, dur: 0.25, easing: SLAM, frames: [{ transform: 'scale(3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }] },
      { sel: '.a-bill', dur: 0.4, iterations: 7, frames: [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-10px) rotate(-6deg)' }, { transform: 'translateY(0) rotate(0)' }] },
      ...confetti,
    ],
    lines: [
      { who: 'Bill', text: 'Quack.', t: 0.9, at: [80, 12], tail: 'left' },
      { text: '(Translation: "Keep the change.")', t: 1.5 },
    ],
  },
  {
    scene: 'title',
    title: ['YOU', 'WIN!'],
    dur: 2,
    sound: 'titleHit',
    camera: ['scale(1.15)', 'scale(1)'],
    lines: [{ text: 'Debt: paid. Bread: safe. Duck: legend.', t: 0.5 }],
  },
];

/** Play the right ending whenever a run fails or finishes, over the results screen. */
export function mountEndings(root: HTMLElement, game: Game, audio: AudioHandle): void {
  let cause: DamageCause = 'log';
  let playing: { stop(): void } | null = null;
  const play = (shots: Shot<EndingScene>[]) => {
    playing?.stop();
    const film = playFilm(root, audio, shots, ENDING_SCENES, (frame) => {
      // The results card (ui/results.ts, or ui/raceResults.ts in a room race) is already up behind the
      // film: bring it onto the last frame.
      const card =
        [...root.children].find((n) => n.classList.contains('panel') && !n.classList.contains('lobby')) ??
        root.querySelector('.race-results .card');
      if (card) {
        card.classList.add('end-card');
        frame.appendChild(card);
      }
    }, { hold: true });
    playing = film;
  };

  game.onEvent((event) => {
    if (event.type === 'runFailed') cause = event.cause ?? 'log';
    else if (event.type === 'attemptStarted') {
      playing?.stop(); // Retry: straight back into the run
      playing = null;
    }
    else if (event.type === 'stageChanged' && event.stage === 'LOBBY') {
      playing?.stop(); // back to the menu or the room's pond
      playing = null;
    }
    else if (event.type === 'stageChanged' && event.stage === 'FAILED') play(DEATH_FILMS[cause]);
    else if (event.type === 'stageChanged' && event.stage === 'FINISHED') play(WIN_FILM);
  });
}
