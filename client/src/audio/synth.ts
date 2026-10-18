// Tiny Web Audio toolkit (Vansh). Every sound is synthesised, so there are no files to load.

export interface ToneOptions {
  freq: number;
  /** Glide to this frequency by the end of the note. */
  to?: number;
  type?: OscillatorType;
  /** Seconds after now. */
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
  detune?: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  dest?: AudioNode;
}

export interface NoiseOptions {
  at?: number;
  dur: number;
  gain?: number;
  filter?: { type: BiquadFilterType; freq: number; to?: number; q?: number };
  dest?: AudioNode;
}

export class Synth {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly sfx: GainNode;
  readonly music: GainNode;
  private readonly noiseBuffer: AudioBuffer;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    // A gentle limiter so stacked sounds (shotgun + hurt + music) never clip.
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    this.master.connect(limiter).connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.35;
    this.music.connect(this.master);

    this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  tone(o: ToneOptions): void {
    const t = this.now + (o.at ?? 0);
    const end = t + o.dur;
    const osc = this.ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), end);
    if (o.detune) osc.detune.value = o.detune;
    const amp = this.envelope(t, o.dur, o.gain ?? 0.3, o.attack ?? 0.005);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.value = o.filter.freq;
      f.Q.value = o.filter.q ?? 1;
      node = node.connect(f);
    }
    node.connect(amp).connect(o.dest ?? this.sfx);
    osc.start(t);
    osc.stop(end + 0.05);
  }

  noise(o: NoiseOptions): void {
    const t = this.now + (o.at ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const amp = this.envelope(t, o.dur, o.gain ?? 0.3, 0.003);
    let node: AudioNode = src;
    if (o.filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.setValueAtTime(o.filter.freq, t);
      if (o.filter.to) f.frequency.exponentialRampToValueAtTime(o.filter.to, t + o.dur);
      f.Q.value = o.filter.q ?? 1;
      node = node.connect(f);
    }
    node.connect(amp).connect(o.dest ?? this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.05);
  }

  /** Quick attack, exponential decay to silence by the end of the note. */
  private envelope(t: number, dur: number, peak: number, attack: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }
}

export const midiToFreq = (note: number): number => 440 * 2 ** ((note - 69) / 12);
