import { Snd } from '../audio/sfx';
import { persist, saved } from '../core/storage';
import { dateKey, insertScore } from './leaderboard';
import { G } from './state';

/* Achievements, per-run statistics, and what happens when a run ends. */

export interface Achievement {
  id: string;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'carrier', name: 'CARRIER DOWN', desc: 'DESTROY THE CARRIER' },
  { id: 'deep', name: 'DEEP SIGNAL', desc: 'REACH WAVE 10' },
  { id: 'full', name: 'FULL STRENGTH', desc: 'FILL THE SIGNAL METER' },
  { id: 'graze', name: 'CLOSE CALL', desc: '20 GRAZES IN ONE RUN' },
  { id: 'shock', name: 'SHOCKWAVE', desc: 'HIT 10 WITH ONE PULSE' },
  { id: 'dive', name: 'INTERCEPTOR', desc: 'SHOOT 10 DIVERS IN ONE RUN' },
  { id: 'clean', name: 'UNTOUCHED', desc: 'CLEAR 3 WAVES IN A ROW UNHURT' },
  { id: 'arsenal', name: 'ARSENAL', desc: 'USE EVERY WEAPON IN ONE RUN' },
  { id: 'static', name: 'STATIC KING', desc: 'SCORE 50,000' },
  { id: 'daily', name: 'ON SCHEDULE', desc: 'FINISH A DAILY RUN' },
];

export const stats = { grazes: 0, diveKills: 0, cleanWaves: 0, weapons: 0 };
/* The banner shown when something unlocks. */
export const toast = { str: '', t: 0 };
/* How the run that just ended placed. */
export const last = { rank: 0, newBest: false };

const ALL_WEAPONS = 0b11110; // weapons 1..4

export function resetStats(): void {
  stats.grazes = 0;
  stats.diveKills = 0;
  stats.cleanWaves = 0;
  stats.weapons = 0;
  last.rank = 0;
  last.newBest = false;
}

export const unlocked = (id: string): boolean => saved.ach.includes(id);

export function unlock(id: string): void {
  if (unlocked(id)) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  saved.ach.push(id);
  persist();
  toast.str = a.name;
  toast.t = 3.2;
  Snd.ready();
}

/* ---------- things the game reports ------------------------------------ */

export function noteGraze(): void {
  if (++stats.grazes >= 20) unlock('graze');
}
export function noteDiveKill(): void {
  if (++stats.diveKills >= 10) unlock('dive');
}
export function noteWeapon(weapon: number): void {
  stats.weapons |= 1 << weapon;
  if ((stats.weapons & ALL_WEAPONS) === ALL_WEAPONS) unlock('arsenal');
}
export function notePulse(hits: number): void {
  if (hits >= 10) unlock('shock');
}
export function noteDeath(): void {
  stats.cleanWaves = 0;
}
/* `level` is the wave about to start. */
export function noteWaveClear(level: number): void {
  if (++stats.cleanWaves >= 3) unlock('clean');
  if (level >= 10) unlock('deep');
}
export function noteScore(score: number): void {
  if (score >= 50000) unlock('static');
}

/* Game over: file the score. */
export function finishRun(): void {
  const today = dateKey();
  last.newBest = G.score > saved.best;
  saved.best = Math.max(saved.best, G.score);
  last.rank = insertScore(saved.scores, { score: G.score, wave: G.level, date: today, daily: G.daily });
  if (G.daily) {
    if (saved.daily.date !== today) saved.daily = { date: today, best: 0 };
    saved.daily.best = Math.max(saved.daily.best, G.score);
    unlock('daily');
  }
  persist();
}

export function updateToast(dt: number): void {
  if (toast.t > 0) toast.t -= dt;
}
