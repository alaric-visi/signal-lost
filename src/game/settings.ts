import { mix, applyMix } from '../audio/engine';
import { Snd } from '../audio/sfx';
import { RESERVED } from '../core/input';
import { persist, saved, type Action } from '../core/storage';
import { V } from '../core/view';
import { G, fx, type GameState } from './state';

/* The settings screen: what the rows are and what happens when you use them.
   Drawing lives in ui/screens.ts. */

export type Row =
  | { kind: 'slider'; label: string; key: 'music' | 'sfx' | 'shake' }
  | { kind: 'toggle'; label: string; key: 'fx' | 'calm' }
  | { kind: 'key'; label: string; action: Action }
  | { kind: 'back'; label: string };

export const ROWS: readonly Row[] = [
  { kind: 'slider', label: 'MUSIC', key: 'music' },
  { kind: 'slider', label: 'SOUND', key: 'sfx' },
  { kind: 'slider', label: 'SCREEN SHAKE', key: 'shake' },
  { kind: 'toggle', label: 'CRT FILTER', key: 'fx' },
  { kind: 'toggle', label: 'REDUCE FLASHING', key: 'calm' },
  { kind: 'key', label: 'MOVE LEFT', action: 'left' },
  { kind: 'key', label: 'MOVE RIGHT', action: 'right' },
  { kind: 'key', label: 'FIRE', action: 'fire' },
  { kind: 'key', label: 'PULSE', action: 'pulse' },
  { kind: 'back', label: 'BACK' },
];

/* `listening`: the action waiting for a key press, while rebinding. */
export const settings = { sel: 0, listening: null as Action | null };

/* Called whenever a setting changes, so the page chrome can follow. */
let changed: () => void = () => {};
export function onSettingsChange(fn: () => void): void {
  changed = fn;
}

/* Push the saved settings into the systems that use them. */
export function applySettings(): void {
  mix.music = saved.music / 7; // 7 is the default, and the level the mix was balanced at
  mix.sfx = saved.sfx / 10;
  applyMix();
  fx.on = saved.fx;
  changed();
}

function commit(): void {
  applySettings();
  persist();
}

export function openSettings(): void {
  if (G.state !== 'menu' && G.state !== 'pause') return;
  G.back = G.state;
  G.state = 'settings';
  settings.sel = 0;
  settings.listening = null;
}

export function closeSettings(): void {
  settings.listening = null;
  G.state = G.back as GameState;
}

export function setSlider(row: Row, value: number): void {
  if (row.kind !== 'slider') return;
  const v = Math.max(0, Math.min(10, Math.round(value)));
  if (v === saved[row.key]) return;
  saved[row.key] = v;
  commit();
  Snd.pick();
}

/* Left / right on the selected row. */
export function adjust(dir: number): void {
  const row = ROWS[settings.sel];
  if (row.kind === 'slider') setSlider(row, saved[row.key] + dir);
  else if (row.kind === 'toggle') activate(settings.sel);
}

/* Confirm on a row: flip a toggle, start listening for a key, or leave. */
export function activate(i: number): void {
  settings.sel = i;
  const row = ROWS[i];
  if (row.kind === 'toggle') {
    saved[row.key] = !saved[row.key];
    commit();
    Snd.pick();
  } else if (row.kind === 'key') {
    settings.listening = row.action;
    Snd.pick();
  } else if (row.kind === 'back') closeSettings();
}

export function moveSel(dir: number): void {
  settings.sel = (settings.sel + ROWS.length + dir) % ROWS.length;
  Snd.pick();
}

/* While rebinding, the next key press becomes the binding. Escape cancels;
   reserved keys are refused. If another action already had that key, the two
   swap so nothing is left unbound. */
export function captureKey(k: string): boolean {
  const action = settings.listening;
  if (!action || G.state !== 'settings') return false;
  if (k === 'Escape') {
    settings.listening = null;
    return true;
  }
  if (RESERVED.has(k)) return true;
  for (const other of Object.keys(saved.keys) as Action[]) {
    if (other !== action && saved.keys[other] === k) saved.keys[other] = saved.keys[action];
  }
  saved.keys[action] = k;
  settings.listening = null;
  persist();
  Snd.power();
  return true;
}

/* Row layout, shared by drawing and hit-testing. */
export const ROW_H = 54;
export function rowRect(i: number, out: { x: number; y: number; w: number; h: number }): void {
  out.w = Math.min(640, V.w - 60);
  out.h = ROW_H - 8;
  out.x = (V.w - out.w) / 2;
  out.y = V.h * 0.23 + i * ROW_H;
}
