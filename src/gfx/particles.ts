import { pick, rand } from '../core/math';
import { parts } from '../game/state';
import { SURGE } from './palette';
import { pixelsOf, type Sprite } from './sprites';

const MAX_PARTS = 2400;

/* Sparks: a radial spray of small glowing squares. */
export function burst(x: number, y: number, n: number, color: string | null, power = 1): void {
  for (let i = 0; i < n && parts.count < MAX_PARTS; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(40, 300) * power;
    const p = parts.spawn();
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.life = rand(0.28, 0.75);
    p.max = 0.75;
    p.col = color || pick(SURGE);
    p.sz = rand(1.6, 4.2);
    p.g = 240;
  }
}

/* Shatter a sprite: one particle per pixel, thrown outward from its centre,
   so the thing that was hit visibly comes apart. */
export function debris(s: Sprite, x: number, y: number, w: number, h: number, color: string, power = 1): void {
  const px = pixelsOf(s);
  const pw = w / s.width;
  const ph = h / s.height;
  const cx = s.width / 2;
  const cy = s.height / 2;
  for (let i = 0; i < px.length && parts.count < MAX_PARTS; i += 2) {
    const dx = px[i] + 0.5 - cx;
    const dy = px[i + 1] + 0.5 - cy;
    const d = Math.hypot(dx, dy) || 1;
    const sp = rand(50, 240) * power;
    const p = parts.spawn();
    p.x = x + px[i] * pw;
    p.y = y + px[i + 1] * ph;
    p.vx = (dx / d) * sp + rand(-40, 40);
    p.vy = (dy / d) * sp - 70 + rand(-40, 40);
    p.life = rand(0.3, 0.75);
    p.max = 0.75;
    p.col = color;
    p.sz = pw;
    p.g = 520;
  }
}

/* Chunks knocked off a shield pylon: heavy, and they fall. */
export function crumbs(x: number, y: number, n: number, color: string, size: number): void {
  for (let i = 0; i < n && parts.count < MAX_PARTS; i++) {
    const p = parts.spawn();
    p.x = x + rand(-6, 6);
    p.y = y + rand(-4, 4);
    p.vx = rand(-70, 70);
    p.vy = rand(-90, 30);
    p.life = rand(0.5, 0.95);
    p.max = 0.95;
    p.col = color;
    p.sz = size;
    p.g = 900;
  }
}

export function updateParts(dt: number): void {
  const drag = 1 - 1.6 * dt;
  for (let i = parts.count - 1; i >= 0; i--) {
    const p = parts.items[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy = p.vy * drag + p.g * dt;
    p.life -= dt;
    if (p.life <= 0) parts.kill(i);
  }
}
