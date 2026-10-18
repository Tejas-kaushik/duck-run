// Every sound effect, as a recipe on the Synth (Vansh). Tweak freely: nothing else depends on these.

import type { SoundName } from './soundMap';
import { midiToFreq, type Synth } from './synth';

/** Bill's voice: two detuned saws through a nasal band-pass. `pitch` 1 = normal quack. */
function quack(s: Synth, pitch = 1, at = 0, dur = 0.16): void {
  const filter = { type: 'bandpass' as const, freq: 1300 * pitch, q: 4 };
  s.tone({ freq: 620 * pitch, to: 380 * pitch, type: 'sawtooth', at, dur, gain: 0.35, filter });
  s.tone({ freq: 640 * pitch, to: 360 * pitch, type: 'sawtooth', at, dur, gain: 0.25, detune: 18, filter });
}

function bell(s: Synth, freq: number, at = 0, dur = 0.6, gain = 0.18): void {
  s.tone({ freq, type: 'triangle', at, dur, gain });
  s.tone({ freq: freq * 2.01, type: 'sine', at, dur: dur * 0.6, gain: gain * 0.4 });
}

function arpeggio(s: Synth, notes: number[], step: number, type: OscillatorType, gain: number, dur = 0.25): void {
  notes.forEach((n, i) => s.tone({ freq: midiToFreq(n), type, at: i * step, dur, gain }));
}

export const SOUNDS: Record<SoundName, (s: Synth) => void> = {
  laneChange: (s) => s.noise({ dur: 0.08, gain: 0.13, filter: { type: 'bandpass', freq: 900, to: 3200, q: 2 } }),

  branchHit: (s) => {
    s.tone({ freq: 190, to: 45, dur: 0.16, gain: 0.6 });
    s.noise({ dur: 0.07, gain: 0.45, filter: { type: 'lowpass', freq: 1200 } });
  },

  hurtQuack: (s) => {
    // A thud, a harsh alarm blip, then a panicked double quack.
    s.tone({ freq: 120, to: 40, dur: 0.18, gain: 0.5 });
    s.tone({ freq: 880, to: 440, type: 'square', dur: 0.12, gain: 0.1, filter: { type: 'lowpass', freq: 3000 } });
    quack(s, 1.45, 0.02, 0.09);
    quack(s, 1.25, 0.1, 0.12);
  },

  crumb: (s) => {
    s.tone({ freq: 988, type: 'square', dur: 0.05, gain: 0.08 });
    s.tone({ freq: 1480, type: 'square', at: 0.05, dur: 0.08, gain: 0.08 });
  },

  heart: (s) => arpeggio(s, [72, 76, 79, 84], 0.07, 'triangle', 0.2, 0.3),

  splash: (s) => {
    s.noise({ dur: 0.55, gain: 0.45, filter: { type: 'lowpass', freq: 2500, to: 250 } });
    s.tone({ freq: 300, to: 90, dur: 0.25, gain: 0.25 });
  },

  quack: (s) => quack(s),

  hatch: (s) => {
    s.tone({ freq: 240, to: 120, type: 'square', dur: 0.14, gain: 0.12, filter: { type: 'lowpass', freq: 1200 } });
    s.noise({ dur: 0.08, gain: 0.2, filter: { type: 'highpass', freq: 2000 } });
  },

  clang: (s) => {
    // Inharmonic partials = metal. The sub's hatch slamming shut.
    for (const [f, g] of [[523, 0.2], [1237, 0.12], [1781, 0.08], [2614, 0.05]] as const) {
      s.tone({ freq: f, dur: 0.7, gain: g });
    }
    s.noise({ dur: 0.05, gain: 0.3, filter: { type: 'highpass', freq: 3000 } });
  },

  cash: (s) => {
    // Cha-ching: the dollar hook.
    s.noise({ dur: 0.06, gain: 0.25, filter: { type: 'highpass', freq: 4000 } });
    s.noise({ at: 0.08, dur: 0.06, gain: 0.25, filter: { type: 'highpass', freq: 4000 } });
    bell(s, 1568, 0.14, 0.5, 0.2);
    bell(s, 2093, 0.2, 0.7, 0.2);
  },

  grab: (s) => {
    s.tone({ freq: 120, to: 60, dur: 0.15, gain: 0.4 });
    s.tone({ freq: 880, dur: 0.25, gain: 0.08 });
    quack(s, 1.1, 0.05, 0.12);
  },

  bark: (s) => {
    // The dog: two gruff woofs.
    for (const at of [0, 0.16]) {
      s.tone({ freq: 260, to: 150, type: 'sawtooth', at, dur: 0.11, gain: 0.3, filter: { type: 'bandpass', freq: 700, q: 2 } });
      s.noise({ at, dur: 0.06, gain: 0.15, filter: { type: 'bandpass', freq: 1200, q: 1 } });
    }
  },

  chomp: (s) => {
    s.noise({ dur: 0.08, gain: 0.45, filter: { type: 'lowpass', freq: 1500 } });
    s.tone({ freq: 140, to: 60, dur: 0.15, gain: 0.45 });
    s.noise({ at: 0.1, dur: 0.06, gain: 0.3, filter: { type: 'lowpass', freq: 1100 } });
  },

  pondPop: (s) => {
    s.tone({ freq: 300, to: 1200, dur: 0.12, gain: 0.25 });
    s.noise({ at: 0.05, dur: 0.25, gain: 0.15, filter: { type: 'bandpass', freq: 1500, to: 600, q: 2 } });
  },

  coin: (s) => {
    // Classic two-note coin blip, kept quiet: you collect a lot of these.
    s.tone({ freq: midiToFreq(83), type: 'square', dur: 0.05, gain: 0.035 });
    s.tone({ freq: midiToFreq(88), type: 'square', at: 0.05, dur: 0.12, gain: 0.035 });
  },

  swish: (s) => s.noise({ dur: 0.15, gain: 0.05, filter: { type: 'bandpass', freq: 400, to: 1400, q: 1.5 } }),

  zap: (s) => {
    // Jellyfish sting: buzzy and jittery.
    s.tone({ freq: 90, type: 'sawtooth', dur: 0.3, gain: 0.2, detune: 40, filter: { type: 'highpass', freq: 600 } });
    s.noise({ dur: 0.25, gain: 0.25, filter: { type: 'bandpass', freq: 3500, q: 4 } });
    quack(s, 1.3, 0.15, 0.12);
  },

  ouch: (s) => {
    s.tone({ freq: 200, to: 80, dur: 0.2, gain: 0.35 });
    quack(s, 1.25, 0.05, 0.14);
  },

  powerUp: (s) => arpeggio(s, [72, 76, 79, 84, 88, 91], 0.055, 'square', 0.09, 0.2),

  noPower: (s) => {
    s.tone({ freq: midiToFreq(67), type: 'triangle', dur: 0.18, gain: 0.15 });
    s.tone({ freq: midiToFreq(60), type: 'triangle', at: 0.18, dur: 0.35, gain: 0.15 });
  },

  shieldUp: (s) => {
    s.tone({ freq: 300, to: 1200, type: 'sine', dur: 0.45, gain: 0.18 });
    s.tone({ freq: 450, to: 1800, type: 'triangle', dur: 0.45, gain: 0.08, detune: 12 });
  },

  ricochet: (s) => {
    s.tone({ freq: 3200, to: 900, type: 'triangle', dur: 0.22, gain: 0.15 });
    s.noise({ dur: 0.04, gain: 0.25, filter: { type: 'highpass', freq: 4000 } });
  },

  shieldDown: (s) => s.tone({ freq: 1000, to: 250, type: 'sine', dur: 0.35, gain: 0.15 }),

  boost: (s) => {
    s.tone({ freq: 220, to: 880, type: 'sawtooth', dur: 0.35, gain: 0.12, filter: { type: 'lowpass', freq: 2400 } });
    s.noise({ dur: 0.4, gain: 0.15, filter: { type: 'bandpass', freq: 600, to: 3000, q: 1.5 } });
  },

  perfect: (s) => {
    SOUNDS.boost(s);
    arpeggio(s, [84, 88, 91, 96], 0.05, 'triangle', 0.16, 0.4);
  },

  shotgun: (s) => {
    s.noise({ dur: 0.35, gain: 0.7, filter: { type: 'lowpass', freq: 3500, to: 400 } });
    s.tone({ freq: 130, to: 38, dur: 0.25, gain: 0.6 });
  },

  reload: (s) => {
    // Pump-action click-clack as the pigeon reloads, under the "Ready" prompt.
    s.noise({ dur: 0.04, gain: 0.35, filter: { type: 'bandpass', freq: 2500, q: 3 } });
    s.noise({ at: 0.14, dur: 0.05, gain: 0.4, filter: { type: 'bandpass', freq: 1800, q: 3 } });
    s.tone({ freq: 440, at: 0.3, dur: 0.12, gain: 0.12, type: 'square', filter: { type: 'lowpass', freq: 1500 } });
  },

  aim: (s) => s.tone({ freq: 587, dur: 0.12, gain: 0.12, type: 'square', filter: { type: 'lowpass', freq: 1800 } }),

  // Fire must be instant and unmistakable: the player reacts to it.
  fire: (s) => {
    s.tone({ freq: 1175, dur: 0.18, gain: 0.22, type: 'square', filter: { type: 'lowpass', freq: 4000 } });
    s.tone({ freq: 1760, dur: 0.18, gain: 0.12, type: 'sine' });
  },

  laser: (s) => {
    s.tone({ freq: 2400, to: 140, type: 'sawtooth', dur: 0.3, gain: 0.2, filter: { type: 'lowpass', freq: 5000 } });
    s.tone({ freq: 2410, to: 135, type: 'square', dur: 0.3, gain: 0.1, detune: 25 });
    s.tone({ freq: 55, dur: 0.3, gain: 0.3, type: 'sawtooth', filter: { type: 'lowpass', freq: 300 } });
  },

  pigeonHurt: (s) => {
    // Don Crumb squawks.
    const filter = { type: 'bandpass' as const, freq: 1800, q: 3 };
    s.tone({ freq: 900, to: 1500, type: 'sawtooth', at: 0.08, dur: 0.1, gain: 0.25, filter });
    s.tone({ freq: 1400, to: 600, type: 'sawtooth', at: 0.18, dur: 0.2, gain: 0.25, filter });
  },

  miss: (s) => {
    s.tone({ freq: 196, type: 'square', dur: 0.18, gain: 0.15, filter: { type: 'lowpass', freq: 900 } });
    s.tone({ freq: 147, type: 'square', at: 0.18, dur: 0.3, gain: 0.15, filter: { type: 'lowpass', freq: 900 } });
  },

  bossDefeated: (s) => {
    s.noise({ dur: 1.2, gain: 0.6, filter: { type: 'lowpass', freq: 2000, to: 120 } });
    s.tone({ freq: 90, to: 30, dur: 1, gain: 0.5 });
    s.tone({ freq: 1500, to: 300, type: 'sawtooth', at: 0.1, dur: 0.6, gain: 0.2, filter: { type: 'bandpass', freq: 1500, q: 3 } });
  },

  victory: (s) => {
    arpeggio(s, [67, 72, 76, 79], 0.12, 'square', 0.1, 0.2);
    s.tone({ freq: midiToFreq(84), type: 'square', at: 0.48, dur: 0.8, gain: 0.12, filter: { type: 'lowpass', freq: 3000 } });
    bell(s, midiToFreq(88), 0.48, 1.2, 0.12);
    quack(s, 1, 1.0);
    quack(s, 1.2, 1.2);
  },

  failed: (s) => {
    // Sad trombone, then a sad quack.
    [62, 61, 60].forEach((n, i) =>
      s.tone({ freq: midiToFreq(n), type: 'sawtooth', at: i * 0.32, dur: 0.3, gain: 0.15, filter: { type: 'lowpass', freq: 1200 } }),
    );
    s.tone({ freq: midiToFreq(59), to: midiToFreq(57), type: 'sawtooth', at: 0.96, dur: 0.9, gain: 0.15, filter: { type: 'lowpass', freq: 1000 } });
    quack(s, 0.8, 1.9, 0.3);
  },

  countdownTick: (s) => {
    s.tone({ freq: 660, dur: 0.1, gain: 0.22, type: 'square', filter: { type: 'lowpass', freq: 2500 } });
    s.tone({ freq: 80, to: 40, dur: 0.15, gain: 0.4 });
  },

  go: (s) => {
    s.tone({ freq: 1320, dur: 0.3, gain: 0.22, type: 'square', filter: { type: 'lowpass', freq: 3000 } });
    s.tone({ freq: 150, to: 40, dur: 0.3, gain: 0.6 });
    s.noise({ dur: 0.3, gain: 0.25, filter: { type: 'highpass', freq: 3000 } });
    quack(s, 1.1, 0.05);
  },

  // Story intro: a noir piano "dun dun DUN" for dramatic reveals.
  sting: (s) => {
    [[50, 0], [50, 0.22], [49, 0.44]].forEach(([n, at], i) => {
      const dur = i === 2 ? 1.1 : 0.2;
      for (const note of [n, n + 12, n + 15]) {
        s.tone({ freq: midiToFreq(note), type: 'triangle', at, dur, gain: 0.12 });
        s.tone({ freq: midiToFreq(note) * 2.01, type: 'sine', at, dur: dur * 0.5, gain: 0.04 });
      }
    });
  },

  // The title card: a big low hit with a cymbal wash.
  titleHit: (s) => {
    s.tone({ freq: 110, to: 30, dur: 1.2, gain: 0.7 });
    s.noise({ dur: 1.6, gain: 0.25, filter: { type: 'highpass', freq: 5000 } });
    for (const n of [38, 45, 50, 53]) s.tone({ freq: midiToFreq(n), type: 'sawtooth', dur: 1.5, gain: 0.07, filter: { type: 'lowpass', freq: 1200 } });
  },

  smash: (s) => {
    s.noise({ dur: 0.25, gain: 0.5, filter: { type: 'bandpass', freq: 1200, to: 300, q: 1 } });
    s.tone({ freq: 220, to: 60, dur: 0.18, gain: 0.45 });
    s.noise({ at: 0.05, dur: 0.08, gain: 0.3, filter: { type: 'highpass', freq: 3000 } });
  },

  boostEnd: (s) => s.tone({ freq: 880, to: 220, type: 'sawtooth', dur: 0.35, gain: 0.1, filter: { type: 'lowpass', freq: 2000 } }),

  // Boss intro: the Don swoops in, lands, gets a name card and taunts.
  swoop: (s) => {
    s.noise({ dur: 1.1, gain: 0.3, filter: { type: 'bandpass', freq: 3000, to: 300, q: 1.5 } });
    for (let i = 0; i < 5; i++) s.noise({ at: 0.15 + i * 0.16, dur: 0.06, gain: 0.25, filter: { type: 'lowpass', freq: 700 } });
  },

  bossLand: (s) => {
    s.tone({ freq: 90, to: 28, dur: 0.6, gain: 0.8 });
    s.noise({ dur: 0.4, gain: 0.4, filter: { type: 'lowpass', freq: 600, to: 100 } });
  },

  pigeonLaugh: (s) => {
    // Coo-coo-COO: a smug pigeon chuckle.
    const filter = { type: 'bandpass' as const, freq: 700, q: 3 };
    [0, 0.14, 0.28].forEach((at, i) =>
      s.tone({ freq: 380 + i * 40, to: 300, type: 'sawtooth', at, dur: 0.12 + i * 0.05, gain: 0.25, filter }),
    );
  },

  fight: (s) => {
    s.tone({ freq: 120, to: 35, dur: 0.6, gain: 0.7 });
    s.noise({ dur: 0.8, gain: 0.3, filter: { type: 'highpass', freq: 4000 } });
    for (const n of [50, 57, 62]) s.tone({ freq: midiToFreq(n), type: 'sawtooth', dur: 0.7, gain: 0.08, filter: { type: 'lowpass', freq: 2500 } });
  },
};
