import { clamp } from './math';

/* The virtual world is 1000 units tall; its width adapts to the viewport
   aspect ratio so the playfield fills the screen instead of letterboxing.

   Two canvases: the game draws into `cv` (an offscreen 2D scene), and the
   post-processing pass presents that scene on `screenEl`, the visible one. */
export const screenEl = document.getElementById('game') as HTMLCanvasElement;
screenEl.tabIndex = 0;
export const cv = document.createElement('canvas');
export const ctx = cv.getContext('2d', { alpha: false })!;

export const V = { w: 1600, h: 1000 };
export const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

const listeners: (() => void)[] = [];
export function onLayout(fn: () => void): void {
  listeners.push(fn);
}

export function layout(): void {
  const cw = Math.max(1, window.innerWidth);
  const ch = Math.max(1, window.innerHeight);
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = screenEl.width = Math.floor(cw * view.dpr);
  cv.height = screenEl.height = Math.floor(ch * view.dpr);
  screenEl.style.width = cw + 'px';
  screenEl.style.height = ch + 'px';

  V.h = 1000;
  V.w = clamp(1000 * (cw / ch), 660, 2400);
  view.scale = Math.min(cv.width / V.w, cv.height / V.h);
  view.ox = (cv.width - V.w * view.scale) / 2;
  view.oy = (cv.height - V.h * view.scale) / 2;

  ctx.imageSmoothingEnabled = false;
  for (const fn of listeners) fn();
}

export function initView(): void {
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));
}
