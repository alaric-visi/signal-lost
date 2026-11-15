import { ctx, view } from '../core/view';
import { ADVANCE, GLYPHS, GLYPH_H, GLYPH_W } from '../data/font';

/* Glowing pixel-font text. shadowBlur is the most expensive thing Canvas2D
   does, so each distinct (string, size, colour) is rendered once — glow baked
   in, on whole device pixels — and then drawn as a plain image every frame. */
const MAX_ENTRIES = 400;
/* `size` matches the old font-size convention: cap height is ~0.73 of it. */
const PIXEL_PER_SIZE = 0.105;

interface Entry {
  c: HTMLCanvasElement;
  pad: number;
  base: number;
}
const cache = new Map<string, Entry>();

/* Call when view.scale changes: entries are rasterised at device scale. */
export function clearTextCache(): void {
  cache.clear();
}

function rasterise(str: string, size: number, color: string): Entry {
  const p = Math.max(1, Math.round(size * PIXEL_PER_SIZE * view.scale));
  const blur = size * 0.5;
  const pad = Math.ceil(blur * 1.5) + 2;
  const c = document.createElement('canvas');
  c.width = (str.length * ADVANCE - (ADVANCE - GLYPH_W)) * p + pad * 2;
  c.height = GLYPH_H * p + pad * 2;
  const g = c.getContext('2d')!;
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < str.length; i++) {
    const px = GLYPHS.get(str[i]);
    if (!px) continue; // spaces and unknown characters
    const ox = pad + i * ADVANCE * p;
    for (let j = 0; j < px.length; j += 2) g.rect(ox + px[j] * p, pad + px[j + 1] * p, p, p);
  }
  g.fill(); // one fill, so the glow is computed once for the whole string
  return { c, pad, base: pad + GLYPH_H * p };
}

export type Align = 'left' | 'center' | 'right';

/* x, y and size are in world units; y is the text baseline. */
export function text(str: string, x: number, y: number, size: number, color: string, align: Align = 'left'): void {
  if (!str) return;
  str = str.toUpperCase();
  const k = `${str}|${size}|${color}`;
  let e = cache.get(k);
  if (!e) {
    if (cache.size >= MAX_ENTRIES) cache.clear();
    e = rasterise(str, size, color);
    cache.set(k, e);
  }
  const s = view.scale;
  const w = e.c.width / s;
  const h = e.c.height / s;
  const pad = e.pad / s;
  const dx = align === 'center' ? x - w / 2 : align === 'right' ? x - w + pad : x - pad;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(e.c, dx, y - e.base / s, w, h);
  ctx.imageSmoothingEnabled = false;
}
