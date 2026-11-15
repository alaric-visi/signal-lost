import { saved } from '../core/storage';

export interface Palette {
  bg0: string;
  bg1: string;
  ink: string;
  hot: string;
  acid: string;
  amber: string;
  violet: string;
  ember: string;
  frost: string;
  white: string;
  dim: string;
}
export type ColorKey = keyof Palette;

const DARK: Palette = {
  bg0: '#0a0320', bg1: '#02010a',
  ink: '#8ef6ff', hot: '#ff2e88', acid: '#a8ff36', amber: '#ffb020',
  violet: '#9d5cff', ember: '#ff6a3d', frost: '#7d95ff', white: '#ffffff', dim: '#4a5f6b',
};
const LIGHT: Palette = {
  bg0: '#f4f7fa', bg1: '#e6ebf0',
  ink: '#0066cc', hot: '#cc0044', acid: '#228800', amber: '#cc6600',
  violet: '#6a0dad', ember: '#c8431a', frost: '#2a3fbf', white: '#000000', dim: '#8b9bb4',
};
const SURGE_DARK = ['#ff2e88', '#a8ff36', '#8ef6ff', '#ffb020', '#9d5cff'];
const SURGE_LIGHT = ['#cc0044', '#228800', '#0066cc', '#cc6600', '#6a0dad'];

/* Live palette. These two objects are mutated in place on a theme change, so
   always read colours from them at draw time — never copy a value at load. */
export const C: Palette = { ...DARK };
export const SURGE: string[] = [...SURGE_DARK];
export const theme = { dark: true };

/* A colour that cycles through SURGE `rate` times a second. With "reduce
   flashing" on it holds one steady colour instead. */
export function cycle(t: number, rate: number, seed = 0): string {
  const n = SURGE.length;
  return SURGE[(saved.calm ? seed : Math.floor(t * rate) + seed) % n];
}

const listeners: (() => void)[] = [];
export function onTheme(fn: () => void): void {
  listeners.push(fn);
}

/* When embedded, follow the host page's `dark` class; standalone (or when the
   host is cross-origin) follow the OS colour scheme. */
function isDarkMode(): boolean {
  try {
    if (window.parent !== window) {
      return window.parent.document.documentElement.classList.contains('dark');
    }
  } catch {
    /* cross-origin host */
  }
  return !window.matchMedia || !window.matchMedia('(prefers-color-scheme: light)').matches;
}

let lastDark: boolean | null = null;
function applyTheme(): void {
  const dark = isDarkMode();
  if (dark === lastDark) return;
  lastDark = dark;
  theme.dark = dark;
  Object.assign(C, dark ? DARK : LIGHT);
  SURGE.splice(0, SURGE.length, ...(dark ? SURGE_DARK : SURGE_LIGHT));
  document.body.classList.toggle('light-mode', !dark);
  for (const fn of listeners) fn();
}

export function initTheme(): void {
  applyTheme();
  setInterval(applyTheme, 300);
}
