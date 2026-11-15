import { randi } from '../core/math';
import { V } from '../core/view';
import { BUNKER_MASK } from '../data/sprites';

export interface Bunker {
  frac: number;
  x: number; y: number; w: number; h: number;
  cols: number; rows: number; cell: number;
  cells: Uint8Array;
  cn: HTMLCanvasElement;
  dirty: boolean;
  col: string | null;
}

export const bunkers: Bunker[] = [];
const BUNKER_Y_FROM_BOTTOM = 250;

export function buildBunkers(): void {
  bunkers.length = 0;
  const cols = BUNKER_MASK[0].length;
  const rows = BUNKER_MASK.length;
  const cell = 4.6;
  const w = cols * cell;
  const h = rows * cell;
  for (const frac of [0.2, 0.4, 0.6, 0.8]) {
    const cells = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) cells[y * cols + x] = BUNKER_MASK[y][x] === 'X' ? 1 : 0;
    const cn = document.createElement('canvas');
    cn.width = cols;
    cn.height = rows;
    bunkers.push({
      frac, x: V.w * frac - w / 2, y: V.h - BUNKER_Y_FROM_BOTTOM, w, h,
      cols, rows, cell, cells, cn, dirty: true, col: null,
    });
  }
}

export function placeBunkers(): void {
  for (const b of bunkers) {
    b.x = V.w * b.frac - b.w / 2;
    b.y = V.h - BUNKER_Y_FROM_BOTTOM;
  }
}

export function markBunkersDirty(): void {
  for (const b of bunkers) b.dirty = true;
}

export function bunkersDamaged(): boolean {
  for (const b of bunkers) {
    for (let y = 0; y < b.rows; y++)
      for (let x = 0; x < b.cols; x++)
        if (BUNKER_MASK[y][x] === 'X' && !b.cells[y * b.cols + x]) return true;
  }
  return false;
}

/* Repainted only when the barrier is damaged or its colour changes, so this
   costs nothing on a normal frame. Deliberately not a tinted sprite: that
   cache is for immutable sprites, and a barrier changes every hit. */
export function paintBunker(b: Bunker, col: string): void {
  const g = b.cn.getContext('2d')!;
  g.clearRect(0, 0, b.cols, b.rows);
  g.fillStyle = col;
  for (let y = 0; y < b.rows; y++)
    for (let x = 0; x < b.cols; x++) if (b.cells[y * b.cols + x]) g.fillRect(x, y, 1, 1);
  b.dirty = false;
  b.col = col;
}

/* Blast shapes, in barrier cells. A player shot nibbles a small notch and
   takes many hits to tunnel through, while an alien bomb splashes wider. */
export type Blob = readonly (readonly [number, number])[];
export const BLOB_SHOT: Blob = [
  [0, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];
export const BLOB_BOMB: Blob = [
  [-1, -1], [0, -1], [1, -1],
  [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
  [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
  [-1, 2], [0, 2], [1, 2],
];

function carve(b: Bunker, cx: number, cy: number, blob: Blob): void {
  for (const o of blob) {
    const x = cx + o[0];
    const y = cy + o[1];
    if (x < 0 || y < 0 || x >= b.cols || y >= b.rows) continue;
    b.cells[y * b.cols + x] = 0;
  }
  /* a few random nibbles so edges crumble instead of staying geometric */
  for (let i = 0; i < 5; i++) {
    const x = cx + randi(-2, 3);
    const y = cy + randi(-2, 3);
    if (x < 0 || y < 0 || x >= b.cols || y >= b.rows) continue;
    if (Math.random() < 0.4) b.cells[y * b.cols + x] = 0;
  }
  b.dirty = true;
}

/* Swept test: walks the segment the projectile covered this tick in half-cell
   steps, so fast shots can't skip over a barrier. On a hit it carves the
   barrier, writes the impact point to `hit` and returns true. Shots pass
   straight through carved-out holes. */
export const hit = { x: 0, y: 0 };
export function bunkerHit(x0: number, y0: number, x1: number, y1: number, blob: Blob): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2.2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    for (const b of bunkers) {
      if (px < b.x || px > b.x + b.w || py < b.y || py > b.y + b.h) continue;
      const cx = Math.floor((px - b.x) / b.cell);
      const cy = Math.floor((py - b.y) / b.cell);
      if (cx < 0 || cy < 0 || cx >= b.cols || cy >= b.rows) continue;
      if (!b.cells[cy * b.cols + cx]) continue;
      carve(b, cx, cy, blob);
      hit.x = px;
      hit.y = py;
      return true;
    }
  }
  return false;
}

/* The formation flattens whatever barrier rows it has descended past. */
export function razeBunkersAt(y: number): void {
  for (const b of bunkers) {
    if (y < b.y) continue;
    let any = false;
    const upto = Math.min(b.rows, Math.ceil((y - b.y) / b.cell));
    for (let r = 0; r < upto; r++)
      for (let x = 0; x < b.cols; x++)
        if (b.cells[r * b.cols + x]) {
          b.cells[r * b.cols + x] = 0;
          any = true;
        }
    if (any) b.dirty = true;
  }
}
