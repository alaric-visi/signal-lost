import { Snd } from '../audio/sfx';
import { clamp, lerp } from '../core/math';
import { sr, srand as rand, srandi as randi } from '../core/rng';
import { V } from '../core/view';
import { CODES, isBossWave, layoutFor } from '../data/waves';
import { bossMuzzleX, bossMuzzleY, spawnBoss } from './boss';
import { razeBunkersAt } from './bunkers';
import { alienH, alienX, alienY, formWidth, grid, present } from './grid';
import { killPlayer } from './player';
import { launchDiver } from './raiders';
import { BOMB_BOLT, BOMB_SHELL, spawnAim, spawnBomb } from './spawn';
import {
  COLS, G, ROWS, TYPES, T_LOBBER, T_SNIPER, T_WATCHER,
  aims, boss, enemies, form, player, raiders, type Enemy,
} from './state';

const FULL_WAVE = COLS * ROWS;
const STEP_X = 20;
const DROP_Y = 28;
const EDGE = 36;
const FULL_TRAVEL = 447; // sideways room on a wide screen, where a drop is DROP_Y
const MAX_DIVERS = 2;
const AIM_TIME = 0.9;
const BOLT_SPEED = 1000;
const SHELL_GRAVITY = 520;

/* Special attacks come quicker on later waves. */
const pace = (): number => Math.max(0.55, 1 - G.level * 0.03);

export function buildWave(): void {
  enemies.length = 0;
  raiders.clear();
  aims.clear();
  form.dir = 1;
  form.step = 0;
  form.intro = 0;
  form.pulse = 0;
  form.diveT = rand(4, 7);
  form.y = 130 + Math.min(120, (G.level - 1) * 12);
  form.x = (V.w - formWidth()) / 2;
  form.alive = 0;

  if (isBossWave(G.level)) {
    spawnBoss(G.level / 5);
    return;
  }
  const layout = layoutFor(G.level);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const type = CODES.indexOf(layout[r][c] || '.');
      if (type < 0) continue;
      enemies.push({ col: c, row: r, type, alive: true, hp: TYPES[type].hp, away: false, cool: rand(2, 6) });
    }
  }
  form.alive = enemies.length;
}

/* Marches the formation. Returns true if it reached the player (game over). */
export function stepFormation(dt: number): boolean {
  const interval = clamp(lerp(0.045, 0.5, form.alive / FULL_WAVE) * Math.pow(0.93, G.level - 1), 0.03, 0.5);
  form.step += dt;
  if (form.step < interval) return false;
  form.step -= interval;
  form.frame ^= 1;
  form.pulse = 1;

  let minC = COLS, maxC = -1, bottom = -Infinity;
  for (const e of enemies) {
    if (!e.alive || e.away) continue;
    if (e.col < minC) minC = e.col;
    if (e.col > maxC) maxC = e.col;
    bottom = Math.max(bottom, alienY(e) + alienH(e.type));
  }
  if (maxC < 0) return false; // everyone left is out diving

  const left = form.x + minC * grid.gapX;
  const right = form.x + maxC * grid.gapX + grid.alienW;
  if ((form.dir > 0 && right + STEP_X > V.w - EDGE) || (form.dir < 0 && left - STEP_X < EDGE)) {
    /* On a narrow screen the formation has little room to travel and reverses
       often, so each drop is smaller: the descent rate stays about the same. */
    const drop = DROP_Y * clamp((V.w - 2 * EDGE - formWidth()) / FULL_TRAVEL, 0.25, 1);
    form.dir *= -1;
    form.y += drop;
    bottom += drop;
    Snd.drop();
    razeBunkersAt(bottom);
  } else {
    form.x += form.dir * STEP_X;
    Snd.step();
  }

  if (bottom >= player.y) {
    G.lives = 0;
    killPlayer();
    return true;
  }
  return false;
}

/* ---------- attacks ----------------------------------------------------- */

const lowest: (Enemy | null)[] = new Array<Enemy | null>(COLS).fill(null);
const occupied: number[] = [];

/* Standard fire: the bottom alien of a random occupied column. */
function columnFire(dt: number): void {
  const rate = (0.5 + Math.min(G.level, 12) * 0.08) * clamp(1.4 - (form.alive / FULL_WAVE) * 0.6, 0.7, 1.4);
  if (sr() >= rate * dt) return;

  lowest.fill(null);
  for (const e of enemies) {
    if (!present(e)) continue;
    const cur = lowest[e.col];
    if (!cur || e.row > cur.row) lowest[e.col] = e;
  }
  occupied.length = 0;
  for (let c = 0; c < COLS; c++) if (lowest[c]) occupied.push(c);
  if (!occupied.length) return;

  const e = lowest[occupied[randi(0, occupied.length)]]!;
  spawnBomb(alienX(e) + grid.alienW / 2, alienY(e) + alienH(e.type), 0, 300 + Math.min(G.level, 14) * 18, randi(0, 3));
}

/* A Lobber's shell goes up, then comes down where the ship is standing. */
function lob(e: Enemy): void {
  const x = alienX(e) + grid.alienW / 2, y = alienY(e);
  const vy = -300;
  const fall = player.y - y;
  const t = (-vy + Math.sqrt(vy * vy + 2 * SHELL_GRAVITY * fall)) / SHELL_GRAVITY; // time until it lands
  spawnBomb(x, y, (player.x + player.w / 2 - x) / t, vy, BOMB_SHELL, SHELL_GRAVITY);
  Snd.lob(x);
}

/* Watchers peel off and dive, from wave 2 on. */
const watchers: Enemy[] = [];
function dive(dt: number): void {
  if (G.level < 2) return;
  form.diveT -= dt;
  if (form.diveT > 0) return;
  form.diveT = rand(3.5, 6.5) * pace();

  let flying = 0;
  for (let i = 0; i < raiders.count; i++) if (raiders.items[i].kind !== 'shard') flying++;
  if (flying >= MAX_DIVERS) return;
  watchers.length = 0;
  for (const e of enemies) if (e.type === T_WATCHER && present(e)) watchers.push(e);
  if (watchers.length) launchDiver(watchers[randi(0, watchers.length)]);
}

export function alienFire(dt: number): void {
  columnFire(dt);
  dive(dt);
  for (const e of enemies) {
    if (e.type !== T_SNIPER && e.type !== T_LOBBER) continue;
    if (!present(e)) continue;
    e.cool -= dt;
    if (e.cool > 0) continue;
    if (e.type === T_SNIPER) {
      spawnAim(e, 0, player.x + player.w / 2, player.y + player.h / 2, AIM_TIME);
      Snd.aim(alienX(e));
      e.cool = rand(4, 7) * pace();
    } else {
      lob(e);
      e.cool = rand(3.5, 6) * pace();
    }
  }
}

/* ---------- telegraphed shots ------------------------------------------- */

export const aimX = (a: { e: Enemy | null; bx: number }): number =>
  a.e ? alienX(a.e) + grid.alienW / 2 : bossMuzzleX(a.bx);
export const aimY = (a: { e: Enemy | null }): number => (a.e ? alienY(a.e) + alienH(a.e.type) : bossMuzzleY());

export function updateAims(dt: number): void {
  for (let i = aims.count - 1; i >= 0; i--) {
    const a = aims.items[i];
    /* the shooter died, left its slot, or the boss went down: cancel */
    if (a.e ? !a.e.alive || a.e.away : !boss.active || boss.dying > 0) {
      aims.kill(i);
      continue;
    }
    a.t -= dt;
    if (a.t > 0) continue;
    const x = aimX(a), y = aimY(a);
    const dx = a.tx - x, dy = a.ty - y;
    const d = Math.hypot(dx, dy) || 1;
    spawnBomb(x, y, (dx / d) * BOLT_SPEED, (dy / d) * BOLT_SPEED, BOMB_BOLT);
    Snd.bolt(x);
    aims.kill(i);
  }
}
