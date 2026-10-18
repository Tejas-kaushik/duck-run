import { describe, expect, it } from 'vitest';
import { CUE_SOUNDS, countdownTicked, musicFor, musicMood, soundsFor } from '../src/audio/soundMap';
import { CONFIG } from '../src/core/config';
import { SOUNDS } from '../src/audio/sounds';
import { TRACKS } from '../src/audio/music';

describe('audio sound map', () => {
  it('has a recipe for every sound a cue can play', () => {
    for (const sound of Object.values(CUE_SOUNDS)) expect(SOUNDS[sound]).toBeTypeOf('function');
  });

  it('plays each cue the phases emit', () => {
    const emitted = ['laneChange', 'hit', 'crumb', 'bark', 'bite', 'boost', 'pondPop', 'jump', 'splash',
      'swish', 'coin', 'zap', 'ouch', 'powerup', 'nopower', 'cash', 'grab', 'shot', 'shield', 'ricochet',
      'shieldDown', 'ready', 'aim', 'fire', 'laser', 'miss', 'bossDefeated', 'smash', 'boostEnd',
      'bossIncoming', 'bossLand', 'bossName', 'bossTaunt', 'fight'];
    for (const name of emitted) expect(soundsFor({ type: 'cue', name })).toHaveLength(1);
  });

  it('never plays a sound twice for cues that duplicate a core event', () => {
    expect(soundsFor({ type: 'cue', name: 'heart' })).toEqual([]);
    expect(soundsFor({ type: 'lifeGained', lives: 4 })).toEqual(['heart']);
  });

  it('stays silent for unknown cues', () => {
    expect(soundsFor({ type: 'cue', name: 'somethingNew' })).toEqual([]);
  });

  it('squawks only for real boss damage, not the 1-damage miss', () => {
    expect(soundsFor({ type: 'bossDamaged', damage: 1, health: 29999 })).toEqual([]);
    expect(soundsFor({ type: 'bossDamaged', damage: 6000, health: 24000 })).toEqual(['pigeonHurt']);
  });

  it('plays go only when the countdown ends', () => {
    expect(soundsFor({ type: 'stageChanged', stage: 'RUNNER_1', previous: 'COUNTDOWN' })).toEqual(['go']);
    expect(soundsFor({ type: 'stageChanged', stage: 'BOSS', previous: 'RUNNER_2' })).toEqual([]);
  });

  it('picks music per stage group', () => {
    expect(musicFor('RUNNER_1')).toBe('runner');
    expect(musicFor('RUNNER_2')).toBe('runner');
    expect(musicFor('DIVE')).toBe('underwater');
    expect(musicFor('UNDERWATER')).toBe('underwater');
    expect(musicFor('BOSS')).toBe('boss');
    expect(musicFor('LOBBY')).toBe('lobby');
    expect(musicFor('COUNTDOWN')).toBeNull();
    expect(musicFor('FINISHED')).toBeNull();
    expect(musicFor('FAILED')).toBeNull();
  });

  it('ticks once per countdown number', () => {
    let last = 0;
    let ticks = 0;
    for (let t = 3; t > 0; t -= 1 / 60) {
      if (countdownTicked(last, t)) ticks++;
      last = t;
    }
    if (countdownTicked(last, 0)) ticks++;
    expect(ticks).toBe(3);
  });

  it('has a well-formed loop for every track', () => {
    for (const track of Object.values(TRACKS)) {
      for (const lane of [track.bass, track.lead, track.chords, track.drone ?? []]) expect(lane.length % 16).toBe(0);
      for (const lane of [...Object.values(track.drums), ...Object.values(track.tense ?? {})]) expect(lane).toMatch(/^[x-]{16}$/);
      const notes = [...track.bass, ...track.lead, ...track.chords.flat()].filter((n) => n !== null);
      for (const n of notes) expect(n).toBeGreaterThanOrEqual(24);
      expect(track.swing).toBeLessThan(0.5);
    }
  });

  it('speeds the runner music up with Bill and builds tension through a section', () => {
    const base = { stage: 'RUNNER_1' as const, phaseDistance: 0, phaseLength: 100, lives: 3 };
    const slow = musicMood({ ...base, runnerSpeed: CONFIG.runner.startSpeed });
    const fast = musicMood({ ...base, runnerSpeed: CONFIG.runner.maxSpeed, phaseDistance: 90 });
    expect(slow).toEqual({ tempo: 1, tension: 0, danger: false });
    expect(fast.tempo).toBeCloseTo(1.2);
    expect(fast.tension).toBeCloseTo(0.9);
  });

  it('turns the danger on for the last life', () => {
    const mood = musicMood({ stage: 'UNDERWATER', runnerSpeed: 12, phaseDistance: 0, phaseLength: 100, lives: 1 });
    expect(mood.danger).toBe(true);
    expect(mood.tension).toBeGreaterThanOrEqual(0.8);
    expect(mood.tempo).toBeGreaterThan(1);
  });
});
