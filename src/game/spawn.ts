import { spick as pick, sr } from '../core/rng';
import { aims, bombs, drops, type DropKind, type Enemy } from './state';

/* Constructors for pooled things, so every field is always set. */

export const BOMB_BOLT = 3;
export const BOMB_SHELL = 4;

export function spawnBomb(x: number, y: number, vx: number, vy: number, kind: number, g = 0): void {
  const b = bombs.spawn();
  b.w = kind === BOMB_BOLT ? 6 : kind === BOMB_SHELL ? 13 : 8;
  b.h = kind === BOMB_BOLT ? 26 : kind === BOMB_SHELL ? 13 : 20;
  b.x = x - b.w / 2;
  b.y = y;
  b.vx = vx;
  b.vy = vy;
  b.g = g;
  b.kind = kind;
  b.graze = 0;
}

export function spawnAim(e: Enemy | null, bx: number, tx: number, ty: number, time: number): void {
  const a = aims.spawn();
  a.e = e;
  a.bx = bx;
  a.tx = tx;
  a.ty = ty;
  a.t = a.max = time;
}

const WEAPON_DROPS: readonly DropKind[] = ['rapid', 'triple', 'lance', 'seeker', 'shield'];
const LIFE_CHANCE = 0.08;

/* Centre a pickup on (x, y). Omit `kind` for a random one. */
export function spawnDrop(x: number, y: number, kind?: DropKind): void {
  const d = drops.spawn();
  d.w = 26;
  d.h = 26;
  d.x = x - d.w / 2;
  d.y = y;
  d.vy = 150;
  d.kind = kind || (sr() < LIFE_CHANCE ? 'life' : pick(WEAPON_DROPS));
}
