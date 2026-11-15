import type { ScoreEntry } from '../game/leaderboard';

/* Everything that persists between sessions, in one blob. Storage can be
   missing or blocked (private windows, sandboxed frames), so every access is
   guarded and the game runs fine without it. */
const KEY = 'signal-lost:v1';

export type Action = 'left' | 'right' | 'fire' | 'pulse';

export interface Saved {
  best: number;
  sound: boolean; // master mute (the M key)
  fx: boolean; // CRT filter
  music: number; // 0..10
  sfx: number; // 0..10
  shake: number; // 0..10
  calm: boolean; // reduce flashing
  keys: Record<Action, string>;
  scores: ScoreEntry[];
  daily: { date: string; best: number };
  ach: string[];
}

export const DEFAULT_KEYS: Readonly<Record<Action, string>> = {
  left: 'ArrowLeft', right: 'ArrowRight', fire: ' ', pulse: 'x',
};

export const saved: Saved = {
  best: 0, sound: true, fx: true,
  music: 7, sfx: 8, shake: 10, calm: false,
  keys: { ...DEFAULT_KEYS },
  scores: [],
  daily: { date: '', best: 0 },
  ach: [],
};

const level = (v: unknown, fallback: number): number =>
  typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : fallback;

export function loadSaved(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const d = JSON.parse(raw) as Partial<Saved>;
    if (typeof d.best === 'number' && isFinite(d.best)) saved.best = Math.max(0, Math.floor(d.best));
    if (typeof d.sound === 'boolean') saved.sound = d.sound;
    if (typeof d.fx === 'boolean') saved.fx = d.fx;
    if (typeof d.calm === 'boolean') saved.calm = d.calm;
    saved.music = level(d.music, saved.music);
    saved.sfx = level(d.sfx, saved.sfx);
    saved.shake = level(d.shake, saved.shake);
    if (d.keys && typeof d.keys === 'object') {
      for (const a of Object.keys(DEFAULT_KEYS) as Action[]) {
        if (typeof d.keys[a] === 'string' && d.keys[a]) saved.keys[a] = d.keys[a];
      }
    }
    if (Array.isArray(d.scores)) {
      saved.scores = d.scores
        .filter((s) => s && typeof s.score === 'number' && typeof s.wave === 'number')
        .map((s) => ({ score: s.score, wave: s.wave, date: String(s.date || ''), daily: !!s.daily }))
        .slice(0, 10);
    }
    if (d.daily && typeof d.daily.date === 'string' && typeof d.daily.best === 'number') {
      saved.daily = { date: d.daily.date, best: d.daily.best };
    }
    if (Array.isArray(d.ach)) saved.ach = d.ach.filter((s) => typeof s === 'string');
  } catch {
    /* keep defaults */
  }
}

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* nothing to do */
  }
}
