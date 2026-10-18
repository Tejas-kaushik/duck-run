// Sound for the whole game (Vansh). Call mountAudio(root, game) once: it listens to GameEvents and
// frame info, and never needs to be called from gameplay code. It returns a volume slider for the lobby.
//
// Browsers only allow audio after a user gesture, so nothing plays until the first key or click.
// The mute button is a click target, not a key, so the game still uses only its two buttons, A and D.

import type { Game } from '../core/Game';
import { onButton } from '../ui/dom';
import { Music } from './music';
import { musicFor, musicMood, soundsFor, type MusicTrack, type SoundName } from './soundMap';
import { SOUNDS } from './sounds';
import { Synth } from './synth';

const MUTE_KEY = 'duckrun.muted';
const VOLUME_KEY = 'duckrun.volume';
const DEFAULT_VOLUME = 0.8;

export interface AudioHandle {
  /** A labelled volume slider, for the home menu. */
  volumeControl: HTMLElement;
  /** Play a track regardless of the stage (the story intro), or null to go back to the stage's music. */
  setMusicOverride(track: MusicTrack | null): void;
  /** Play one sound effect now, if audio is unlocked. */
  playSound(name: SoundName): void;
}

function loadVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return localStorage.getItem(VOLUME_KEY) !== null && v >= 0 && v <= 1 ? v : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

function saveVolume(volume: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // blocked storage: the slider still works for this visit
  }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // private window or blocked storage: muting still works for this visit
  }
}

export function mountAudio(root: HTMLElement, game: Game): AudioHandle {
  let synth: Synth | null = null;
  let music: Music | null = null;
  let muted = loadMuted();
  let volume = loadVolume();
  let override: MusicTrack | null = null;
  const wantedTrack = () => override ?? musicFor(game.stage);

  const applyMute = () => {
    if (!synth) return;
    synth.master.gain.setTargetAtTime(muted ? 0 : volume, synth.now, 0.02);
  };

  // Create the AudioContext on the first gesture, then start whatever music the stage wants.
  const unlock = () => {
    if (!synth) {
      try {
        synth = new Synth();
      } catch {
        return; // no Web Audio: the game simply stays silent
      }
      music = new Music(synth);
      applyMute();
      music.play(wantedTrack());
    }
    if (synth.ctx.state === 'suspended') void synth.ctx.resume();
  };
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('pointerdown', unlock, true);

  document.addEventListener('visibilitychange', () => {
    if (!synth) return;
    if (document.hidden) void synth.ctx.suspend();
    else void synth.ctx.resume();
  });

  game.onEvent((event) => {
    if (!synth) return;
    for (const name of soundsFor(event)) SOUNDS[name](synth);
    if (event.type === 'stageChanged') music?.play(wantedTrack());
  });

  // No 3-2-1 ticks: the story covers the wait before a race, and the run starts with GO.
  game.onFrame(({ run }) => music?.setMood(musicMood(run)));

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Toggle sound');
  Object.assign(button.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '50',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '0',
    background: 'rgba(0,0,0,0.35)',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    pointerEvents: 'auto',
  });
  const render = () => {
    button.textContent = muted ? '🔇' : '🔊';
    button.title = muted ? 'Sound off' : 'Sound on';
  };
  render();
  onButton(button, () => {
    unlock();
    muted = !muted;
    if (!muted && volume === 0) volume = DEFAULT_VOLUME; // unmuting a slider dragged to zero
    saveMuted(muted);
    applyMute();
    render();
  });
  root.appendChild(button);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = String(Math.round((muted ? 0 : volume) * 100));
  slider.setAttribute('aria-label', 'Volume');
  const volumeControl = document.createElement('label');
  volumeControl.className = 'volume';
  volumeControl.append('🔈', slider, '🔊');
  slider.addEventListener('input', () => {
    unlock();
    volume = Number(slider.value) / 100;
    muted = volume === 0;
    saveVolume(volume);
    saveMuted(muted);
    applyMute();
    render();
  });
  // Let go of focus so A/D go to the game, not the slider.
  slider.addEventListener('change', () => {
    slider.blur();
    if (synth && !muted) SOUNDS.crumb(synth);
  });
  // Keep the slider in step with the mute button.
  onButton(button, () => {
    slider.value = String(Math.round((muted ? 0 : volume) * 100));
  });

  return {
    volumeControl,
    setMusicOverride(track) {
      override = track;
      music?.play(wantedTrack());
    },
    playSound(name) {
      if (synth) SOUNDS[name](synth);
    },
  };
}
