import { describe, expect, it } from 'vitest';
import { SOUNDS } from '../src/audio/sounds';
import { ENDING_SCENES } from '../src/ui/endingArt';
import { DEATH_FILMS, WIN_FILM } from '../src/ui/endings';

const films = { ...DEATH_FILMS, win: WIN_FILM };

describe('endings', () => {
  it('has a death film for every way Bill can lose his last life', () => {
    expect(Object.keys(DEATH_FILMS).sort()).toEqual(['boss', 'dog', 'log']);
  });

  for (const [name, shots] of Object.entries(films)) {
    it(`${name}: only animates parts that exist and fits every line in`, () => {
      for (const shot of shots) {
        if (shot.scene !== 'title') {
          for (const move of shot.moves ?? []) expect(ENDING_SCENES[shot.scene]).toContain(move.sel.slice(1));
        }
        for (const line of shot.lines) expect(line.t).toBeLessThan(shot.dur - 0.5);
        if (shot.sound) expect(SOUNDS[shot.sound]).toBeTypeOf('function');
      }
    });
  }
});
