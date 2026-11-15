import { clamp } from '../core/math';
import { V } from '../core/view';
import { placeBunkers } from './bunkers';
import { COLS, ROWS, TYPES, boss, form, player, type Enemy } from './state';

/* Formation geometry: where each slot is, and how big things are. */
export const grid = { gapX: 90, gapY: 62, alienW: 54 };

const typeH: number[] = TYPES.map(() => 0);
export const alienH = (type: number): number => typeH[type];
export const formWidth = (): number => (COLS - 1) * grid.gapX + grid.alienW;

/* Alien rectangle is (alienX, alienY, grid.alienW, alienH(type)). */
export const alienX = (e: Enemy): number => form.x + e.col * grid.gapX;
export const alienY = (e: Enemy): number => form.y + e.row * grid.gapY;

/* Aliens materialise one at a time, bottom row first. */
const SPAWN_TIME = 0.3;
const spawnDelay = (e: Enemy): number => e.col * 0.035 + (ROWS - 1 - e.row) * 0.07;
export const INTRO_TIME = (COLS - 1) * 0.035 + (ROWS - 1) * 0.07 + SPAWN_TIME;
/* 0 = not there yet, 1 = fully materialised. */
export const spawnT = (e: Enemy): number => clamp((form.intro - spawnDelay(e)) / SPAWN_TIME, 0, 1);
/* In its slot and able to be hit or to act. */
export const present = (e: Enemy): boolean => e.alive && !e.away && spawnT(e) >= 1;

/* Reposition everything that depends on world size. */
export function reflow(): void {
  grid.gapX = Math.min(102, (V.w * 0.8) / COLS);
  grid.gapY = 62;
  grid.alienW = grid.gapX * 0.6;
  for (let t = 0; t < TYPES.length; t++) {
    const s = TYPES[t].sp[0];
    typeH[t] = grid.alienW * (s.height / s.width);
  }
  player.w = clamp(V.w * 0.042, 52, 76);
  player.h = player.w * (8 / 15);
  player.y = V.h - 96;
  player.x = clamp(player.x || V.w / 2 - player.w / 2, 0, V.w - player.w);

  const totalW = formWidth();
  form.x = clamp(form.x || (V.w - totalW) / 2, 40, V.w - totalW - 40);
  boss.x = clamp(boss.x, 30, Math.max(30, V.w - 30 - boss.w));
  placeBunkers();
}
