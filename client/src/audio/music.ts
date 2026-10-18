// Looping background music, sequenced on the Web Audio clock (Vansh). A tense track per stage group,
// plus a laid-back funk groove for the lobby.

import type { MusicMood, MusicTrack } from './soundMap';
import { midiToFreq, type Synth } from './synth';

/** One drum lane per voice; 'x' plays on that 16th, anything else rests. Lanes loop on their own length. */
export interface Drums {
  kick?: string;
  snare?: string;
  /** Quiet snare between the backbeats: the funk "ghost note". */
  ghost?: string;
  hat?: string;
  openHat?: string;
  /** Deep war drum. */
  tom?: string;
}

export interface Track {
  bpm: number;
  /** 0 = straight 16ths, ~0.15-0.25 = funky swing on the off 16ths. */
  swing: number;
  /** 16th-note steps. Each array loops on its own length; null = rest. */
  bass: (number | null)[];
  /** Optional sustained sub note (MIDI) held for a bar, for menace. */
  drone?: (number | null)[];
  /** Short staccato bass, filtered like a slap/synth bass. */
  bassCutoff: number;
  lead: (number | null)[];
  leadType: OscillatorType;
  /** Chord stabs (clavinet/horn style): MIDI notes played together on that step. */
  chords: (number[] | null)[];
  /** Stab length in steps: short for clav chops, long for electric piano pads. */
  chordLen: number;
  drums: Drums;
  /** Extra drums that join once the section gets tense (past halfway, or on your last life). */
  tense?: Drums;
  /** Lowpass on the whole track: underwater sounds muffled. */
  cutoff: number;
}

const _ = null;

// Chord voicings (MIDI), named for readability in the patterns below.
const Em9 = [62, 66, 67, 71];
const A13 = [61, 66, 67, 69];
const Cm = [60, 63, 67];
const Ab = [60, 63, 68];
const Gm = [58, 62, 67];
const DmPad = [62, 65, 69];
const CsDim = [61, 64, 67];
const EbPad = [63, 67, 70];
const CmNoir = [60, 63, 67, 70];
const AbNoir = [60, 63, 68, 72];
const G7b9 = [59, 62, 65, 68];

export const TRACKS: Record<MusicTrack, Track> = {
  // Lobby: a lazy E dorian vamp to bob your head to while everyone joins.
  lobby: {
    bpm: 100,
    swing: 0.22,
    bass: [
      40, _, _, 40, 52, _, 40, _, _, 40, 43, _, 45, _, 47, _,
      40, _, _, 40, 52, _, 40, _, _, 52, 50, _, 47, _, 45, 43,
    ],
    bassCutoff: 900,
    lead: [
      _, _, _, _, _, _, _, _, 71, _, 74, _, 76, _, 74, 71,
      _, _, _, _, _, _, _, _, 79, _, 76, _, 74, _, 71, _,
      _, _, _, _, _, _, _, _, 71, _, 74, _, 76, _, 79, _,
      81, _, 79, _, 76, _, 74, _, 76, _, _, _, _, _, _, _,
    ],
    leadType: 'triangle',
    chords: [
      _, _, Em9, _, _, _, Em9, _, _, _, Em9, _, _, _, _, _,
      _, _, A13, _, _, _, A13, _, _, _, A13, _, _, _, A13, _,
    ],
    chordLen: 0.9,
    drums: {
      kick: 'x-----x---x-----',
      snare: '----x-------x---',
      ghost: '-------x-x----x-',
      hat: 'x-x-x-x-x-x-x---',
      openHat: '--------------x-',
    },
    cutoff: 5000,
  },
  // Story intro: a sneaky noir walk in C minor. Walking bass, brushed hats, muted horn. Trouble is coming.
  intro: {
    bpm: 84,
    swing: 0.3,
    bass: [
      36, _, _, _, 39, _, _, _, 41, _, _, _, 42, _, _, _,
      43, _, _, _, 41, _, _, _, 39, _, _, _, 38, _, _, _,
    ],
    bassCutoff: 700,
    lead: [
      _, _, _, _, _, _, _, _, 67, _, 70, _, 66, _, _, _,
      _, _, _, _, _, _, _, _, 67, _, 63, _, 62, _, _, _,
      _, _, _, _, _, _, _, _, 67, _, 70, _, 72, _, 71, _,
      70, _, _, _, 67, _, _, _, 66, _, _, _, 67, _, _, _,
    ],
    leadType: 'sawtooth',
    chords: [
      CmNoir, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
      AbNoir, _, _, _, _, _, _, _, G7b9, _, _, _, _, _, _, _,
    ],
    chordLen: 6,
    drums: {
      kick: 'x-------x-------',
      ghost: '----x-------x---',
      hat: 'x--xx--xx--xx--x',
    },
    cutoff: 2200,
  },
  // Runner: a fast, driving C minor chase. The dog is behind you and the track never lets up.
  runner: {
    bpm: 150,
    swing: 0.03,
    bass: [
      36, 36, 48, 36, 36, 48, 36, 36, 39, 39, 51, 39, 41, 41, 43, _,
      36, 36, 48, 36, 36, 48, 36, 36, 44, 44, 56, 44, 43, 43, 42, _,
    ],
    bassCutoff: 1400,
    lead: [
      72, _, 75, _, 77, _, 78, 77, 75, _, 72, _, 70, _, 72, _,
      72, _, 75, _, 77, _, 79, _, 80, _, 79, _, 78, _, 77, _,
    ],
    leadType: 'square',
    chords: [
      _, _, Cm, _, _, _, Cm, _, _, _, Cm, _, _, _, Cm, _,
      _, _, Ab, _, _, _, Ab, _, _, _, Gm, _, _, _, Gm, _,
    ],
    chordLen: 0.5,
    drums: {
      kick: 'x---x---x---x---',
      snare: '----x-------x---',
      hat: 'xxxxxxxxxxxxxxxx',
      openHat: '--x---x---x---x-',
    },
    // Second half: extra kicks and a snare roll into every bar.
    tense: {
      kick: '--x-------x--x--',
      snare: '------------xxxx',
      ghost: 'x-x-x-x-x-x-x-x-',
    },
    cutoff: 7000,
  },
  // Underwater: a ticking-clock D minor pulse under sonar pings. Muffled, tight, holding your breath.
  underwater: {
    bpm: 116,
    swing: 0,
    bass: [
      38, _, 38, _, 38, _, 38, _, 39, _, 39, _, 38, _, 41, _,
      38, _, 38, _, 38, _, 38, _, 36, _, 36, _, 37, _, 37, _,
    ],
    bassCutoff: 500,
    lead: [
      86, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
      86, _, _, _, _, _, _, _, 85, _, _, _, _, _, _, _,
    ],
    leadType: 'sine',
    chords: [
      DmPad, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
      CsDim, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    ],
    chordLen: 14,
    drums: {
      kick: 'x-------x-------',
      ghost: '----x-------x---',
      hat: 'x-x-x-x-x-x-x-x-',
    },
    tense: {
      kick: 'x---x---x---x---',
      hat: '-x-x-x-x-x-x-x-x',
    },
    cutoff: 1800,
  },
  // Boss: do or die. A halftime D phrygian march: low drone, war drums, a dark choir and a tritone hook.
  boss: {
    bpm: 128,
    swing: 0,
    bass: [
      38, _, _, _, _, _, 38, _, 39, _, _, _, 38, _, _, _,
      38, _, _, _, _, _, 38, _, 44, _, _, _, 43, _, 42, _,
    ],
    bassCutoff: 900,
    drone: [26, ...Array(15).fill(_), 27, ...Array(15).fill(_)],
    lead: [
      62, _, _, 63, _, _, 62, _, _, _, _, _, 68, _, _, _,
      62, _, _, 63, _, _, 62, _, _, _, _, _, 69, _, 67, _,
    ],
    leadType: 'sawtooth',
    chords: [
      DmPad, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
      EbPad, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    ],
    chordLen: 14,
    drums: {
      kick: 'x-----x---x-----',
      snare: '--------x-------',
      tom: '----x--------x-x',
      hat: '--x---x---x---x-',
    },
    // Don Crumb is nearly down: everything doubles up.
    tense: {
      kick: 'x-x-x-x-x-x-x-x-',
      snare: '------------xxxx',
      tom: 'x---x---x---x---',
      hat: 'xxxxxxxxxxxxxxxx',
    },
    cutoff: 4000,
  },
};

const LOOKAHEAD_SEC = 0.12;

const hits = (lane: string | undefined, i: number): boolean => !!lane && lane[i % lane.length] === 'x';

export class Music {
  private track: MusicTrack | null = null;
  private bus: GainNode | null = null;
  private step = 0;
  private nextStepAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private filter: BiquadFilterNode | null = null;
  private mood: MusicMood = { tempo: 1, tension: 0, danger: false };
  /** Eased towards mood.tempo so speed-ups glide instead of jumping. */
  private tempo = 1;

  constructor(private readonly synth: Synth) {}

  get current(): MusicTrack | null {
    return this.track;
  }

  /** Follow the run: tempo, tension and danger come from musicMood(). */
  setMood(mood: MusicMood): void {
    const opened = mood.tension !== this.mood.tension;
    this.mood = mood;
    if (opened && this.filter && this.track) {
      const cutoff = TRACKS[this.track].cutoff * (0.6 + 0.6 * mood.tension);
      this.filter.frequency.setTargetAtTime(cutoff, this.synth.now, 0.3);
    }
  }

  /** Crossfade to a track (or to silence with null). Asking for the playing track does nothing. */
  play(track: MusicTrack | null): void {
    if (track === this.track) return;
    this.fadeOut();
    this.track = track;
    if (!track) return;

    const ctx = this.synth.ctx;
    const def = TRACKS[track];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = def.cutoff * (0.6 + 0.6 * this.mood.tension);
    bus.connect(filter).connect(this.synth.music);
    this.bus = bus;
    this.filter = filter;
    this.tempo = this.mood.tempo;
    this.step = 0;
    this.nextStepAt = ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(def, bus), 25);
  }

  private fadeOut(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const bus = this.bus;
    if (!bus) return;
    const t = this.synth.ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    setTimeout(() => bus.disconnect(), 700);
    this.bus = null;
    this.filter = null;
  }

  private schedule(def: Track, bus: GainNode): void {
    const s = this.synth;
    // After a long tab switch, skip ahead rather than playing a burst of missed notes.
    if (this.nextStepAt < s.now) this.nextStepAt = s.now + 0.02;
    while (this.nextStepAt < s.now + LOOKAHEAD_SEC) {
      const i = this.step;
      this.tempo += (this.mood.tempo - this.tempo) * 0.05;
      const stepSec = 60 / (def.bpm * this.tempo) / 4;
      // Swing: push every off 16th late, which is what makes it groove instead of march.
      const at = this.nextStepAt - s.now + (i % 2 === 1 ? def.swing * stepSec : 0);
      this.playStep(def, bus, i, at, stepSec);
      this.step++;
      this.nextStepAt += stepSec;
    }
  }

  private playStep(def: Track, dest: GainNode, i: number, at: number, stepSec: number): void {
    const s = this.synth;

    const bass = def.bass[i % def.bass.length];
    if (bass !== null) {
      // Plucky, resonant and short: rests between notes are half the funk.
      s.tone({ freq: midiToFreq(bass), type: 'sawtooth', at, dur: stepSec * 1.1, gain: 0.32,
        filter: { type: 'lowpass', freq: def.bassCutoff, q: 6 }, dest });
      s.tone({ freq: midiToFreq(bass), type: 'sine', at, dur: stepSec * 1.3, gain: 0.28, dest });
    }

    const drone = def.drone?.[i % def.drone.length];
    if (drone != null) {
      for (const detune of [-12, 12]) {
        s.tone({ freq: midiToFreq(drone), type: 'sawtooth', at, detune, dur: stepSec * 16, gain: 0.09, attack: 0.4,
          filter: { type: 'lowpass', freq: 380, q: 2 }, dest });
      }
    }

    const chord = def.chords[i % def.chords.length];
    if (chord) {
      const long = def.chordLen > 1;
      for (const note of chord) {
        // One voice per note (not a detuned pair): half the audio nodes, barely audible difference.
        s.tone({ freq: midiToFreq(note), type: long ? 'triangle' : 'square', at, detune: 5,
          dur: stepSec * def.chordLen, gain: long ? 0.05 : 0.035, attack: long ? 0.04 : 0.003,
          filter: { type: 'lowpass', freq: long ? 1800 : 2600, q: long ? 1 : 5 }, dest });
      }
    }

    const lead = def.lead[i % def.lead.length];
    if (lead !== null) {
      s.tone({ freq: midiToFreq(lead), type: def.leadType, at, dur: stepSec * 1.7, gain: 0.08, dest });
      s.tone({ freq: midiToFreq(lead), type: def.leadType, at, dur: stepSec * 1.7, gain: 0.05, detune: 9, dest });
    }

    this.playDrums(def.drums, dest, i, at);
    if (def.tense && (this.mood.tension >= 0.5 || this.mood.danger)) this.playDrums(def.tense, dest, i, at);
    // Last life: a heartbeat on every beat, lub-dub.
    if (this.mood.danger && i % 4 === 0) {
      s.tone({ freq: 70, to: 40, at, dur: 0.12, gain: 0.4, dest });
      s.tone({ freq: 60, to: 35, at: at + 0.14, dur: 0.1, gain: 0.3, dest });
    }
  }

  private playDrums(d: Drums, dest: GainNode, i: number, at: number): void {
    const s = this.synth;
    if (hits(d.kick, i)) s.tone({ freq: 160, to: 42, at, dur: 0.16, gain: 0.7, dest });
    if (hits(d.snare, i)) {
      s.noise({ at, dur: 0.14, gain: 0.28, filter: { type: 'highpass', freq: 1400 }, dest });
      s.tone({ freq: 190, to: 130, at, dur: 0.08, gain: 0.2, dest });
    }
    if (hits(d.tom, i)) {
      s.tone({ freq: 110, to: 52, at, dur: 0.4, gain: 0.55, dest });
      s.noise({ at, dur: 0.12, gain: 0.2, filter: { type: 'lowpass', freq: 450 }, dest });
    }
    if (hits(d.ghost, i)) s.noise({ at, dur: 0.05, gain: 0.07, filter: { type: 'highpass', freq: 1800 }, dest });
    if (hits(d.hat, i)) s.noise({ at, dur: 0.03, gain: 0.08, filter: { type: 'highpass', freq: 7500 }, dest });
    if (hits(d.openHat, i)) s.noise({ at, dur: 0.2, gain: 0.08, filter: { type: 'highpass', freq: 6500 }, dest });
  }
}
