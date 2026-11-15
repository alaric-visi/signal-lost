/* Local high-score table. Pure functions, so they are easy to test. */

export interface ScoreEntry {
  score: number;
  wave: number;
  date: string; // YYYY-MM-DD
  daily: boolean;
}

export const MAX_SCORES = 10;

/* Inserts an entry into a table sorted high-to-low (ties: earlier entry stays
   ahead). Returns its 1-based rank, or 0 if it did not make the table. */
export function insertScore(list: ScoreEntry[], entry: ScoreEntry, max = MAX_SCORES): number {
  if (entry.score <= 0) return 0;
  let i = 0;
  while (i < list.length && list[i].score >= entry.score) i++;
  if (i >= max) return 0;
  list.splice(i, 0, entry);
  if (list.length > max) list.length = max;
  return i + 1;
}

/* Local calendar date as YYYY-MM-DD. */
export function dateKey(d = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* The daily run's seed: the same number for everyone on the same date. */
export function dailySeed(key = dateKey()): number {
  return Number(key.replace(/-/g, ''));
}
