import { rand } from '../core/math';
import { Pool } from '../core/pool';
import type { ColorKey } from '../gfx/palette';
import { SP, type Sprite } from '../gfx/sprites';

/* All mutable game state lives here, so the systems that act on it can import
   it without importing each other. */

export type GameState =
  | 'menu' | 'play' | 'pause' | 'wave' | 'upgrade' | 'dead' | 'over'
  | 'settings' | 'records';

export const G = {
  state: 'menu' as GameState,
  t: 0, timer: 0, score: 0, best: 0, level: 1, lives: 3, anim: 0,
  shown: 0, // the score as displayed: counts up toward `score`
  /* Signal meter, 0..1. Its level sets the score multiplier; when full it can
     be spent on a pulse. `chargeIdle` is seconds since it last grew. */
  charge: 0, chargeIdle: 0,
  pulse: 0, // seconds left on the pulse's visual
  back: 'menu' as GameState, // where the settings / records screen returns to
  daily: false, // this run uses today's shared seed
};
export const MAX_LIVES = 6;
/* A full meter: colours cycle and the carrier wave swells. */
export const surging = (): boolean => G.charge >= 1;

/* Screen-level effects. `trauma` (0..1) drives screen shake; `freeze` is a
   hit-stop: seconds for which the whole simulation holds still. */
export const fx = { trauma: 0, glitch: 0, freeze: 0, on: true };

export const WEAPON_TIME = 11;
/* weapon: 0 standard, 1 rapid, 2 spread, 3 lance, 4 seeker */
export const player = {
  x: 0, y: 0, w: 64, h: 34, vx: 0, inv: 0, cool: 0, droneCool: 0,
  weapon: 0, wt: 0, flash: 0,
};

/* kind: 0 standard, 1 lance, 2 seeker. `pierce` is how many more targets the
   shot can pass through; `last` is the target it is currently passing. */
export interface Shot {
  x: number; y: number; w: number; h: number; vx: number; vy: number;
  kind: number; pierce: number; last: object | null;
}
/* kind: 0-2 zigzag bombs, 3 sniper bolt, 4 mortar shell.
   graze: 0 not near the ship yet, 1 passing close, 2 already rewarded. */
export interface Bomb {
  x: number; y: number; w: number; h: number; vx: number; vy: number; g: number;
  kind: number; graze: number;
}
export type DropKind = 'rapid' | 'triple' | 'lance' | 'seeker' | 'shield' | 'life';
export interface Drop { x: number; y: number; w: number; h: number; vy: number; kind: DropKind }
export interface Part {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; col: string; sz: number; g: number;
}
/* Expanding ring flash. */
export interface Ring { x: number; y: number; r0: number; r1: number; life: number; max: number; col: string }
/* Floating score / pickup label. */
export interface Popup { x: number; y: number; str: string; col: string; size: number; life: number }
/* Screen-space distortion ring, drawn by the post-processing pass. */
export interface Shock { x: number; y: number; age: number; life: number; power: number }

export const COLS = 11;
export const ROWS = 5;
/* `away`: a Watcher that has left its slot to dive (a Raider carries it).
   `cool`: seconds until this enemy's special attack. */
export interface Enemy {
  col: number; row: number; type: number; alive: boolean;
  hp: number; away: boolean; cool: number;
}
export const enemies: Enemy[] = [];
/* `alive` is kept in step with the enemies' flags so nothing has to count.
   `intro` is seconds since the wave was built (aliens materialise one by one);
   `pulse` is 1 right after a march step and decays, for the squash. */
export const form = { x: 0, y: 140, dir: 1, step: 0, frame: 0, alive: 0, intro: 0, pulse: 0, diveT: 5 };

/* Free-flying enemies: a diving Watcher (`home` is its slot in the formation),
   one flying back to that slot, or a Splitter shard. */
export interface Raider {
  kind: 'dive' | 'return' | 'shard';
  x: number; y: number; vx: number; vy: number; w: number; h: number;
  home: Enemy | null; t: number; ph: number; fired: boolean;
}
/* A telegraphed shot: a line is shown for `t` seconds, then a bolt flies down
   it. Fired by a Sniper (`e`) or, when `e` is null, by the boss at offset bx. */
export interface Aim { e: Enemy | null; bx: number; tx: number; ty: number; t: number; max: number }

export const shots = new Pool<Shot>(() => ({ x: 0, y: 0, w: 4, h: 16, vx: 0, vy: 0, kind: 0, pierce: 0, last: null }));
export const bombs = new Pool<Bomb>(() => ({ x: 0, y: 0, w: 8, h: 20, vx: 0, vy: 0, g: 0, kind: 0, graze: 0 }));
export const drops = new Pool<Drop>(() => ({ x: 0, y: 0, w: 26, h: 26, vy: 0, kind: 'rapid' }));
export const parts = new Pool<Part>(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, col: '#fff', sz: 1, g: 0 }));
export const rings = new Pool<Ring>(() => ({ x: 0, y: 0, r0: 0, r1: 0, life: 0, max: 1, col: '#fff' }));
export const popups = new Pool<Popup>(() => ({ x: 0, y: 0, str: '', col: '#fff', size: 18, life: 0 }));
export const raiders = new Pool<Raider>(() => ({
  kind: 'shard', x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0, home: null, t: 0, ph: 0, fired: false,
}));
export const aims = new Pool<Aim>(() => ({ e: null, bx: 0, tx: 0, ty: 0, t: 0, max: 1 }));
export const shocks: Shock[] = [];
for (let i = 0; i < 4; i++) shocks.push({ x: 0, y: 0, age: 0, life: 1, power: 0 });

export interface AlienType { name: string; sp: Sprite[]; pts: number; col: ColorKey; hp: number }
/* Order matches CODES in data/waves.ts. `col` is a palette key, resolved at
   draw time so theme changes apply. */
export const TYPES: AlienType[] = [
  { name: 'WATCHER', sp: SP.watcher, pts: 30, col: 'hot', hp: 1 },
  { name: 'RECEIVER', sp: SP.receiver, pts: 20, col: 'ink', hp: 1 },
  { name: 'CORRUPTOR', sp: SP.corruptor, pts: 10, col: 'acid', hp: 1 },
  { name: 'BULWARK', sp: SP.bulwark, pts: 40, col: 'amber', hp: 2 },
  { name: 'SPLITTER', sp: SP.splitter, pts: 30, col: 'violet', hp: 1 },
  { name: 'LOBBER', sp: SP.lobber, pts: 40, col: 'ember', hp: 1 },
  { name: 'SNIPER', sp: SP.sniper, pts: 50, col: 'frost', hp: 1 },
];
export const T_WATCHER = 0, T_SPLITTER = 4, T_LOBBER = 5, T_SNIPER = 6;

/* The Carrier. `shield` is seconds of invulnerability (entry, phase change);
   `dying` counts down through its death sequence. */
export const boss = {
  active: false, tier: 1,
  x: 0, y: 0, w: 300, h: 150, vx: 0,
  hp: 1, max: 1, phase: 0,
  t: 0, attackT: 0, pattern: 0, flash: 0, shield: 0, dying: 0,
};
export const BOSS_Y = 150;

export interface Ufo { x: number; y: number; w: number; h: number; vx: number; pts: number }
export const sky = { ufo: null as Ufo | null, ufoTimer: 12 };

export interface Star { x: number; y: number; z: number; s: number; ph: number }
export const stars: Star[] = [];
for (let i = 0; i < 170; i++) {
  stars.push({ x: Math.random(), y: Math.random(), z: rand(0.2, 1), s: rand(0.6, 2.3), ph: rand(0, 6.28) });
}
