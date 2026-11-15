import { describe, expect, it } from 'vitest';
import { GLYPHS, GLYPH_H, GLYPH_W } from '../data/font';
import { BUNKER_MASK, SPRITE_ROWS } from '../data/sprites';
import { CODES, LAYOUTS, isBossWave, layoutFor } from '../data/waves';

describe('wave layouts', () => {
  it('are five rows of eleven known cells', () => {
    for (const layout of LAYOUTS) {
      expect(layout).toHaveLength(5);
      for (const row of layout) {
        expect(row).toHaveLength(11);
        for (const ch of row) expect(ch === '.' || CODES.includes(ch)).toBe(true);
      }
    }
  });

  it('never leave a wave empty', () => {
    for (const layout of LAYOUTS) expect(layout.join('').replace(/\./g, '').length).toBeGreaterThan(0);
  });

  it('put the boss on every fifth wave and cycle layouts through the rest', () => {
    expect([5, 10, 15].every(isBossWave)).toBe(true);
    expect([1, 4, 6, 9, 11].some(isBossWave)).toBe(false);
    expect(layoutFor(1)).toBe(LAYOUTS[0]);
    expect(layoutFor(4)).toBe(LAYOUTS[3]);
    expect(layoutFor(6)).toBe(LAYOUTS[4]); // wave 5 was the boss, so nothing is skipped
    expect(layoutFor(11)).toBe(LAYOUTS[0]); // and the cycle wraps
    for (let level = 1; level < 200; level++) {
      if (!isBossWave(level)) expect(layoutFor(level)).toBeDefined();
    }
  });
});

describe('pixel art', () => {
  const rectangular = (rows: readonly string[]): boolean => rows.every((r) => r.length === rows[0].length);

  it('has rectangular sprites', () => {
    for (const value of Object.values(SPRITE_ROWS)) {
      const frames = (typeof value[0] === 'string' ? [value] : value) as readonly (readonly string[])[];
      for (const frame of frames) expect(rectangular(frame)).toBe(true);
    }
    expect(rectangular(BUNKER_MASK)).toBe(true);
  });

  it('gives animated sprites frames of the same size', () => {
    for (const value of Object.values(SPRITE_ROWS)) {
      if (typeof value[0] === 'string') continue;
      const frames = value as readonly (readonly string[])[];
      for (const f of frames) {
        expect(f.length).toBe(frames[0].length);
        expect(f[0].length).toBe(frames[0][0].length);
      }
    }
  });

  it('keeps every font glyph inside its 5x7 cell', () => {
    expect(GLYPHS.size).toBeGreaterThan(40);
    for (const px of GLYPHS.values()) {
      for (let i = 0; i < px.length; i += 2) {
        expect(px[i]).toBeLessThan(GLYPH_W);
        expect(px[i + 1]).toBeLessThan(GLYPH_H);
      }
    }
  });
});
