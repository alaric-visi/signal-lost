import { V, ctx, cv, view } from '../core/view';
import { G, player, stars, surging } from '../game/state';
import { C, cycle, theme } from './palette';

/* Background, back to front:
   1. a static layer (gradient, nebula, planet limb) painted once per resize or
      theme change and then drawn as a single image;
   2. parallax stars that twinkle and lean against the ship's movement;
   3. the carrier wave — interference lines that swell during a surge. */

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ---------- nebula (value-noise clouds, generated once) ---------------- */
const NEB_W = 256, NEB_H = 160, LATTICE = 64;
let nebula: HTMLCanvasElement | null = null;

function buildNebula(): HTMLCanvasElement {
  const grid = new Float32Array(LATTICE * LATTICE);
  for (let i = 0; i < grid.length; i++) grid[i] = Math.random();
  const at = (x: number, y: number): number => grid[(y & (LATTICE - 1)) * LATTICE + (x & (LATTICE - 1))];
  const noise = (x: number, y: number): number => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x: number, y: number): number =>
    noise(x, y) * 0.5 + noise(x * 2, y * 2) * 0.25 + noise(x * 4, y * 4) * 0.125 + noise(x * 8, y * 8) * 0.0625;

  const c = document.createElement('canvas');
  c.width = NEB_W;
  c.height = NEB_H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(NEB_W, NEB_H);
  const d = img.data;
  for (let y = 0; y < NEB_H; y++) {
    for (let x = 0; x < NEB_W; x++) {
      const n = fbm(x / 46, y / 46) / 0.9375;
      const m = fbm(x / 60 + 19, y / 60 + 7) / 0.9375;
      const k = smooth(0.35, 0.7, m); // violet -> pink
      const t = smooth(0.55, 0.85, 1 - m) * 0.6; // a little teal in the gaps
      const i = (y * NEB_W + x) * 4;
      d[i] = (157 + (255 - 157) * k) * (1 - t) + 40 * t;
      d[i + 1] = (92 + (46 - 92) * k) * (1 - t) + 170 * t;
      d[i + 2] = (255 + (136 - 255) * k) * (1 - t) + 210 * t;
      d[i + 3] = smooth(0.46, 0.82, n) * 0.4 * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* ---------- static layer ------------------------------------------------ */
const layer = document.createElement('canvas');
const lx = layer.getContext('2d', { alpha: false })!;
let stale = true;
export function invalidateBackdrop(): void {
  stale = true;
}

function paintLayer(): void {
  stale = false;
  const w = (layer.width = cv.width);
  const h = (layer.height = cv.height);
  const dark = theme.dark;

  lx.setTransform(1, 0, 0, 1, 0, 0);
  const grad = lx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, h * 0.95);
  grad.addColorStop(0, C.bg0);
  grad.addColorStop(1, C.bg1);
  lx.fillStyle = grad;
  lx.fillRect(0, 0, w, h);

  if (dark) {
    nebula ??= buildNebula();
    lx.imageSmoothingEnabled = true;
    lx.imageSmoothingQuality = 'high';
    /* cover the canvas without stretching the clouds */
    const k = Math.max(w / NEB_W, h / NEB_H);
    lx.drawImage(nebula, (w - NEB_W * k) / 2, (h - NEB_H * k) / 2, NEB_W * k, NEB_H * k);
  }

  /* planet limb: a huge circle whose top edge is the horizon */
  lx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  const R = V.w * 4;
  const cx = V.w / 2;
  const top = V.h - 58;
  const cy = top + R;

  const atm = lx.createRadialGradient(cx, cy, R - 2, cx, cy, R + 110);
  atm.addColorStop(0, dark ? 'rgba(157,92,255,.34)' : 'rgba(0,102,204,.16)');
  atm.addColorStop(0.35, dark ? 'rgba(157,92,255,.12)' : 'rgba(0,102,204,.06)');
  atm.addColorStop(1, dark ? 'rgba(157,92,255,0)' : 'rgba(0,102,204,0)');
  lx.fillStyle = atm;
  lx.fillRect(-V.w * 2, top - 130, V.w * 5, 400);

  const body = lx.createLinearGradient(0, top, 0, V.h + 60);
  body.addColorStop(0, dark ? '#1d0d42' : '#c5cfdf');
  body.addColorStop(1, dark ? '#04020c' : '#dfe5ee');
  lx.beginPath();
  lx.arc(cx, cy, R, 0, Math.PI * 2);
  lx.fillStyle = body;
  lx.fill();
  lx.strokeStyle = dark ? 'rgba(157,92,255,.20)' : 'rgba(0,102,204,.12)';
  lx.lineWidth = 9;
  lx.stroke();
  lx.strokeStyle = dark ? 'rgba(142,246,255,.6)' : 'rgba(0,102,204,.5)';
  lx.lineWidth = 2;
  lx.stroke();
}

/* Draw in canvas pixels, before the world transform is applied. */
export function drawBackdrop(): void {
  if (stale) paintLayer();
  ctx.drawImage(layer, 0, 0);
}

/* ---------- stars -------------------------------------------------------- */
export function drawStars(): void {
  const lean = (player.x + player.w / 2) / V.w - 0.5;
  for (const s of stars) {
    const tw = 0.75 + 0.25 * Math.sin(G.t * (1.5 + s.z * 3) + s.ph);
    ctx.globalAlpha = (0.2 + s.z * 0.75) * tw;
    ctx.fillStyle = s.z > 0.75 ? C.ink : C.white;
    let x = s.x * V.w - lean * 46 * s.z;
    if (x < 0) x += V.w;
    else if (x > V.w) x -= V.w;
    ctx.fillRect(x, s.y * V.h, s.s, s.s);
  }
  ctx.globalAlpha = 1;
}

/* ---------- carrier wave ------------------------------------------------- */
const LINES = [
  { y: 0.2, k: 0.011, w: 1.3, amp: 9 },
  { y: 0.37, k: 0.017, w: -0.9, amp: 7 },
  { y: 0.55, k: 0.008, w: 0.7, amp: 11 },
];
const SEGMENTS = 56;

export function drawCarrier(): void {
  const full = surging();
  const boost = full ? 2.6 : 1 + G.charge * 0.8;
  ctx.save();
  if (theme.dark) ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2;
  for (let i = 0; i < LINES.length; i++) {
    const L = LINES[i];
    ctx.strokeStyle = full ? cycle(G.t, 9, i) : C.violet;
    ctx.globalAlpha = full ? 0.3 : 0.13;
    ctx.beginPath();
    for (let j = 0; j <= SEGMENTS; j++) {
      const x = (j / SEGMENTS) * V.w;
      /* an amplitude-modulated carrier: a fast wave inside a slow envelope */
      const y = L.y * V.h +
        L.amp * boost * Math.sin(x * L.k * 4 + G.t * L.w * 5) * Math.sin(x * L.k * 0.6 - G.t * L.w);
      if (j) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
