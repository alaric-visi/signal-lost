import { describe, expect, it } from 'vitest';
import { Pool } from '../core/pool';
import { seedRun, sr, srandi } from '../core/rng';
import { dailySeed, dateKey, insertScore, type ScoreEntry } from '../game/leaderboard';

describe('seeded rng', () => {
  it('repeats exactly for the same seed', () => {
    seedRun(20261115);
    const a = Array.from({ length: 50 }, sr);
    seedRun(20261115);
    const b = Array.from({ length: 50 }, sr);
    expect(b).toEqual(a);
  });

  it('differs between seeds and stays in range', () => {
    seedRun(1);
    const a = Array.from({ length: 200 }, sr);
    seedRun(2);
    const b = Array.from({ length: 200 }, sr);
    expect(b).not.toEqual(a);
    for (const v of a) expect(v >= 0 && v < 1).toBe(true);
    for (let i = 0; i < 200; i++) {
      const n = srandi(3, 7);
      expect(n >= 3 && n < 7).toBe(true);
    }
  });
});

describe('pool', () => {
  it('recycles objects instead of allocating', () => {
    let made = 0;
    const pool = new Pool(() => ({ id: ++made }));
    const a = pool.spawn();
    pool.spawn();
    pool.kill(0);
    expect(pool.count).toBe(1);
    pool.spawn();
    expect(made).toBe(2); // the killed object was reused
    expect(pool.items).toContain(a);
  });

  it('keeps the survivors when killing mid-iteration', () => {
    const pool = new Pool(() => ({ v: 0 }));
    for (let i = 0; i < 6; i++) pool.spawn().v = i;
    for (let i = pool.count - 1; i >= 0; i--) if (pool.items[i].v % 2 === 0) pool.kill(i);
    const left = pool.items.slice(0, pool.count).map((o) => o.v).sort();
    expect(left).toEqual([1, 3, 5]);
  });
});

describe('leaderboard', () => {
  const entry = (score: number): ScoreEntry => ({ score, wave: 1, date: '2026-11-15', daily: false });

  it('keeps scores sorted and reports the rank', () => {
    const list: ScoreEntry[] = [];
    expect(insertScore(list, entry(500))).toBe(1);
    expect(insertScore(list, entry(900))).toBe(1);
    expect(insertScore(list, entry(700))).toBe(2);
    expect(list.map((s) => s.score)).toEqual([900, 700, 500]);
  });

  it('puts a tie behind the earlier score', () => {
    const list = [entry(500)];
    expect(insertScore(list, entry(500))).toBe(2);
  });

  it('caps the table and rejects scores that miss it', () => {
    const list: ScoreEntry[] = [];
    for (let i = 1; i <= 10; i++) insertScore(list, entry(i * 100));
    expect(insertScore(list, entry(50))).toBe(0);
    expect(insertScore(list, entry(0))).toBe(0);
    expect(insertScore(list, entry(550))).toBe(6);
    expect(list).toHaveLength(10);
    expect(list[9].score).toBe(200); // the old lowest fell off
  });

  it('derives the daily seed from the date', () => {
    expect(dateKey(new Date(2026, 10, 5))).toBe('2026-11-05');
    expect(dailySeed('2026-11-05')).toBe(20261105);
    expect(dailySeed('2026-11-06')).not.toBe(dailySeed('2026-11-05'));
  });
});
