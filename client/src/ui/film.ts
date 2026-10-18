// Tiny film player (Vansh) for the story intro and the endings. Each shot has a moving camera and
// characters on a timeline (Web Animations, so it runs on the compositor and stays smooth), with comic
// subtitles, speech bubbles and sound-effect bursts timed in. Shots hard-cut with a flash.
// A or D (the game's two buttons) or a click cuts to the next shot and "Skip" ends it, unless the film
// follows a fixed clock, where it is seeked to match. Only the two buttons and clicks.

import type { AudioHandle } from '../audio';
import type { MusicTrack, SoundName } from '../audio/soundMap';
import { el, onButton } from './dom';
import { usesTouch } from './touchControls';

export interface Line {
  /** Speaker name; narration has none and becomes a subtitle box. */
  who?: string;
  text: string;
  /** Seconds into the shot when it pops in. */
  t: number;
  /** Speech bubbles only: where the bubble sits over the art, in % of the frame. */
  at?: [number, number];
  /** Which side the bubble's tail points from. */
  tail?: 'left' | 'right';
}

/** One animated element in a shot: a CSS selector inside the shot, and its keyframes. */
export interface Move {
  sel: string;
  frames: Keyframe[];
  /** Seconds; defaults to the whole shot. */
  start?: number;
  dur?: number;
  easing?: string;
  iterations?: number;
}

export interface Shot<S extends string = string> {
  /** Which art to show, or 'title' for a big two-word title card. */
  scene: S | 'title';
  /** The title card's two words (default DUCK RUN). */
  title?: [string, string];
  /** Seconds the shot lasts. */
  dur: number;
  /** Camera: the whole frame's transform at the start and end of the shot. */
  camera?: [string, string];
  moves?: Move[];
  lines: Line[];
  sound?: SoundName;
  /** A big comic sound effect, e.g. WOOF!, popped over the art at [x%, y%] at time t. */
  fx?: { text: string; at: [number, number]; t: number };
  /**
   * A phone held upright shows the middle two-thirds of the picture, bigger, centred on this point
   * (% across the art, default 50), so the shot's characters stay in view.
   */
  focus?: number;
}

export const OUT_BACK = 'cubic-bezier(0.2, 1.4, 0.4, 1)';
export const SLAM = 'cubic-bezier(0.3, 1.8, 0.5, 1)';
export const shake = (x = 6): Keyframe[] => [
  { transform: 'translate(0, 0)' },
  { transform: `translate(${-x}px, ${x / 2}px)` },
  { transform: `translate(${x}px, ${-x / 2}px)` },
  { transform: `translate(${-x / 2}px, ${x / 3}px)` },
  { transform: 'translate(0, 0)' },
];
const ms = (sec: number) => sec * 1000;

/** Must match the upright-phone media query in ui.css. */
const UPRIGHT = '(max-aspect-ratio: 4/5)';

/** How many films are on screen. While any is, body has .film-open and the 3D world isn't drawn. */
let openFilms = 0;
const setFilmOpen = (open: boolean) => {
  openFilms = Math.max(0, openFilms + (open ? 1 : -1));
  document.body.classList.toggle('film-open', openFilms > 0);
};

/** Build one shot and start all of its animations. Returns them so they can be seeked. */
function playShot(shot: Shot, frame: HTMLElement, art: Record<string, string>): { node: HTMLElement; anims: Animation[] } {
  const node = el('div', { className: `shot scene-${shot.scene}` });
  // The 16:9 picture (art, speech bubbles, sound effects). Subtitles sit on the shot itself, so on a
  // phone held upright they can move into the space above and below the picture (ui.css).
  const stage = el('div', { className: 'shot-stage' });
  const cam = el('div', { className: 'shot-cam' });
  // A phone held upright: the picture is small, so every line (narration and speech) goes in a
  // stack under it instead of on top of the art, where it would cover the characters.
  const upright = typeof matchMedia !== 'undefined' && matchMedia(UPRIGHT).matches;
  const talk = upright ? el('div', { className: 'shot-talk' }) : null;
  if (upright) node.style.setProperty('--focus', String((shot.focus ?? 50) / 100));
  cam.innerHTML =
    shot.scene === 'title'
      ? `<div class="intro-title"><span>${(shot.title ?? ['DUCK', 'RUN'])[0]}</span><span>${(shot.title ?? ['DUCK', 'RUN'])[1]}</span></div>`
      : art[shot.scene];
  stage.appendChild(cam);
  node.appendChild(stage);

  const anims: Animation[] = [];
  // The first move on an element also holds its start pose before it begins; later moves on the same
  // element only hold their end pose, so they don't overwrite the earlier one before their turn.
  const moved = new Set<Element>();
  const opts = (start = 0, dur = shot.dur, easing = 'ease-in-out', iterations = 1, first = true): KeyframeAnimationOptions => ({
    delay: ms(start),
    duration: ms(dur),
    easing,
    iterations,
    fill: iterations === Infinity ? 'none' : first ? 'both' : 'forwards',
  });

  if (shot.camera) {
    anims.push(cam.animate([{ transform: shot.camera[0] }, { transform: shot.camera[1] }], opts(0, shot.dur, 'ease-in-out')));
  }
  for (const m of shot.moves ?? []) {
    cam.querySelectorAll<SVGElement>(m.sel).forEach((target) => {
      anims.push(target.animate(m.frames, opts(m.start, m.dur, m.easing, m.iterations, !moved.has(target))));
      moved.add(target);
    });
  }

  let captions = 0;
  for (const line of shot.lines) {
    let box: HTMLElement;
    if (line.who) {
      box = el('div', { className: `bubble tail-${line.tail ?? 'left'}` }, [
        el('span', { className: 'who', text: line.who }),
        el('span', { text: line.text }),
      ]);
      const [x, y] = line.at ?? [50, 15];
      if (!talk) {
        box.style.left = `${x}%`;
        box.style.top = `${y}%`;
      }
      (talk ?? stage).appendChild(box);
    } else {
      box = el('div', { className: `subtitle n${captions++}`, text: line.text });
      (talk ?? node).appendChild(box);
    }
    anims.push(box.animate([{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], opts(line.t, 0.25, OUT_BACK)));
  }
  if (shot.fx) {
    const fx = el('div', { className: 'fx', text: shot.fx.text });
    fx.style.left = `${shot.fx.at[0]}%`;
    fx.style.top = `${shot.fx.at[1]}%`;
    stage.appendChild(fx);
    anims.push(fx.animate([{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], opts(shot.fx.t, 0.3, SLAM)));
  }

  if (talk) node.appendChild(talk);
  frame.appendChild(node);
  return { node, anims };
}

export interface FilmOptions {
  /** performance.now() time to end exactly on. The film then follows the clock and can't be skipped. */
  endsAt?: number;
  /** A music track to play for the length of the film. */
  music?: MusicTrack;
  /**
   * Stay on the last shot when it ends (its looping parts keep moving) instead of closing, so the
   * caller can put an end card on it; onDone gets the frame for that. stop() closes it.
   */
  hold?: boolean;
}

/** Play `shots` over `root`, then call onDone (after the last shot, a skip, or at endsAt). */
export function playFilm(
  root: HTMLElement,
  audio: AudioHandle,
  shots: Shot[],
  art: Record<string, string>,
  onDone: (frame: HTMLElement) => void,
  options: FilmOptions = {},
): { stop(): void } {
  const durs = shots.map((s) => s.dur);
  const total = durs.reduce((a, b) => a + b, 0);
  const timed = options.endsAt !== undefined;
  const startedAt = performance.now();
  // Stretch or squeeze every shot evenly so the last one ends right on endsAt.
  const stretch = timed ? Math.max(0.2, (options.endsAt! - startedAt) / 1000 / total) : 1;

  const frame = el('div', { className: 'film' });
  const skip = el('button', { className: 'intro-skip', text: 'Skip ⏭' });
  // Phones have no A and D keys: they tap the screen to move on.
  const hint = el('div', { className: 'intro-hint', text: usesTouch() ? 'TAP ▸' : 'A / D ▸' });
  const progress = el('div', { className: 'intro-progress' }, [el('span')]);
  const overlay = el('div', { className: 'intro' }, [frame, progress, hint, skip]);
  const bar = progress.firstElementChild as HTMLElement;
  const barAnim = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
    duration: ms(total * stretch),
    fill: 'both',
  });

  let index = -1;
  let current: { node: HTMLElement; anims: Animation[] } | null = null;
  let shownAt = performance.now();
  let raf = 0;
  let done = false;

  let closed = false;
  /** Close the film for good. */
  const close = () => {
    if (closed) return;
    closed = true;
    const wasDone = done;
    done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    overlay.classList.add('closing');
    setFilmOpen(false);
    if (options.music) audio.setMusicOverride(null);
    setTimeout(() => overlay.remove(), 450);
    if (!wasDone) onDone(frame);
  };

  /** The film has run out: close it, or hold the last frame for an end card. */
  const finish = () => {
    if (!options.hold) return close();
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    skip.remove();
    hint.remove();
    progress.remove();
    overlay.classList.add('held');
    onDone(frame);
  };

  /** Hard cut to shot i, starting `into` seconds in (rooms join the film where the clock says). */
  const cut = (i: number, into = 0) => {
    if (done) return;
    if (i >= shots.length) return finish();
    index = i;
    shownAt = performance.now() - ms(into);
    const old = current;
    if (old) {
      old.anims.forEach((a) => a.cancel());
      old.node.remove();
    }
    current = playShot(shots[i], frame, art);
    if (into > 0) current.anims.forEach((a) => (a.currentTime = ms(into)));
    if (stretch !== 1) current.anims.forEach((a) => (a.playbackRate = 1 / stretch));
    // A white flash on every cut sells the hard edit.
    frame.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 120 });
    const sound = shots[i].sound;
    if (sound) audio.playSound(sound);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'KeyA' && e.code !== 'KeyD') return;
    e.preventDefault();
    e.stopPropagation(); // the run hasn't started; keep the buttons to ourselves
    if (!timed && !e.repeat) cut(index + 1);
  };

  const tick = (now: number) => {
    if (timed) {
      if (now >= options.endsAt!) return finish();
      let t = (now - startedAt) / 1000;
      let i = 0;
      while (i < shots.length - 1 && t >= durs[i] * stretch) t -= durs[i++] * stretch;
      if (i !== index) cut(i, t / stretch);
    } else {
      if ((now - shownAt) / 1000 >= shots[index].dur) cut(index + 1);
      if (!done) barAnim.currentTime = ms(durs.slice(0, index).reduce((a, b) => a + b, 0) + (now - shownAt) / 1000);
    }
    if (!done) raf = requestAnimationFrame(tick);
  };

  if (timed) {
    skip.remove();
    hint.remove();
  } else {
    barAnim.pause();
    // Skip: straight to the end card when there is one, otherwise close.
    onButton(skip, () => {
      if (!options.hold) return close();
      const last = shots.length - 1;
      if (index !== last) cut(last, shots[last].dur);
      current?.anims.forEach((a) => {
        if (a.effect?.getTiming().iterations !== Infinity) a.finish();
      });
      finish();
    });
    overlay.addEventListener('click', (e) => {
      if (!done && e.target !== skip) cut(index + 1);
    });
  }
  window.addEventListener('keydown', onKey, true);

  root.appendChild(overlay);
  setFilmOpen(true);
  if (options.music) audio.setMusicOverride(options.music);
  cut(0);
  raf = requestAnimationFrame(tick);
  return { stop: close };
}
