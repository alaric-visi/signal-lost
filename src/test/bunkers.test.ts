import { beforeEach, describe, expect, it } from 'vitest';
import { BLOB_SHOT, buildBunkers, bunkerHit, bunkers, bunkersDamaged, hit, razeBunkersAt } from '../game/bunkers';

const solid = (): number => bunkers[0].cells.reduce((n, c) => n + c, 0);

describe('shield pylons', () => {
  beforeEach(buildBunkers);

  it('start undamaged', () => {
    expect(bunkers).toHaveLength(4);
    expect(bunkersDamaged()).toBe(false);
  });

  it('stop a shot, report where, and lose some cells', () => {
    const b = bunkers[0];
    const x = b.x + b.w / 2;
    const before = solid();
    expect(bunkerHit(x, b.y - 40, x, b.y + 12, BLOB_SHOT)).toBe(true);
    expect(hit.y).toBeGreaterThanOrEqual(b.y);
    expect(hit.y).toBeLessThanOrEqual(b.y + 12);
    expect(solid()).toBeLessThan(before);
    expect(bunkersDamaged()).toBe(true);
  });

  it('catch a fast shot that would jump clean over in one step', () => {
    const b = bunkers[0];
    const x = b.x + b.w / 2;
    /* start below the pylon, end above it: both end points are in empty space */
    expect(bunkerHit(x, b.y + b.h + 60, x, b.y - 60, BLOB_SHOT)).toBe(true);
  });

  it('let a shot through a hole that has been carved out', () => {
    const b = bunkers[0];
    const x = b.x + b.w / 2;
    let hits = 0;
    while (bunkerHit(x, b.y - 10, x, b.y + b.h + 10, BLOB_SHOT)) {
      if (++hits > 200) throw new Error('never tunnelled through');
    }
    expect(hits).toBeGreaterThan(1); // it takes more than one shot
    expect(bunkerHit(x, b.y - 10, x, b.y + b.h + 10, BLOB_SHOT)).toBe(false);
  });

  it('miss when the path does not touch a pylon', () => {
    const b = bunkers[0];
    expect(bunkerHit(b.x - 30, b.y - 40, b.x - 30, b.y + b.h + 40, BLOB_SHOT)).toBe(false);
    expect(bunkersDamaged()).toBe(false);
  });

  it('are flattened from the top by a descending formation', () => {
    const b = bunkers[0];
    razeBunkersAt(b.y + b.cell * 4);
    for (let x = 0; x < b.cols; x++) for (let r = 0; r < 4; r++) expect(b.cells[r * b.cols + x]).toBe(0);
    expect(solid()).toBeGreaterThan(0); // the lower rows survive
  });
});
