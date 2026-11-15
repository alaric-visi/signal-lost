/* Seeded random numbers for anything that decides how a run plays out: which
   alien fires, what drops, which upgrades are offered. Cosmetic randomness
   (particles, shake) keeps using Math.random so it never disturbs the sequence.
   The same seed gives the same sequence, which is what makes the daily run the
   same for everyone. */
let s = 1;

export function seedRun(seed: number): void {
  s = seed >>> 0 || 1;
}

/* mulberry32: small, fast, and good enough for a game. Returns 0..1. */
export function sr(): number {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const srand = (a: number, b: number): number => a + sr() * (b - a);
export const srandi = (a: number, b: number): number => Math.floor(srand(a, b));
export const spick = <T>(a: readonly T[]): T => a[srandi(0, a.length)];
