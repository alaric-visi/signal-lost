import { Snd } from '../audio/sfx';
import { held, pad, touch } from '../core/input';
import { clamp } from '../core/math';
import { persist, saved } from '../core/storage';
import { V } from '../core/view';
import { C } from '../gfx/palette';
import { burst, debris } from '../gfx/particles';
import { SP } from '../gfx/sprites';
import { freeze, kick, shockwave } from './fx';
import { finishRun, noteDeath } from './records';
import { G, aims, bombs, fx, player, raiders, shots } from './state';
import { run } from './upgrades';

const ACCEL = 5200;
const MAX_SPEED = 640;
const SHOT_SPEED = 1150;
/* seconds between shots, by weapon: standard, rapid, spread, lance, seeker */
const COOLDOWN = [0.26, 0.11, 0.26, 0.3, 0.2];
const DRONE_COOLDOWN = 0.7;
export const SHOT_LANCE = 1, SHOT_SEEKER = 2;

export const speedScale = (): number => 1 + 0.12 * run.thrusters;
/* Wingman drones fly either side of the ship. */
export const droneX = (i: number, shipCx: number): number => shipCx + (i === 0 ? -1 : 1) * player.w * 0.95;

function shoot(cx: number, vx: number, kind: number): void {
  const s = shots.spawn();
  s.w = kind === SHOT_LANCE ? 6 : 4;
  s.h = kind === SHOT_LANCE ? 28 : 16;
  s.x = cx - s.w / 2;
  s.y = player.y - 6;
  s.vx = vx;
  s.vy = -SHOT_SPEED;
  s.kind = kind;
  s.pierce = run.pierce + (kind === SHOT_LANCE ? 3 : 0);
  s.last = null;
}

function fire(): void {
  const cx = player.x + player.w / 2;
  const kind = player.weapon === 3 ? SHOT_LANCE : player.weapon === 4 ? SHOT_SEEKER : 0;
  if (player.weapon === 2) {
    shoot(cx, -190, 0);
    shoot(cx, 0, 0);
    shoot(cx, 190, 0);
  } else shoot(cx, 0, kind);
  if (run.wingman > 0 && player.droneCool <= 0) {
    for (let i = 0; i < run.wingman; i++) shoot(droneX(i, cx), 0, 0);
    player.droneCool = DRONE_COOLDOWN;
  }
  player.cool = COOLDOWN[player.weapon] * Math.pow(0.88, run.overclock);
  player.flash = 0.05;
  Snd.shoot(cx);
}

export function recordBest(): void {
  if (G.best > saved.best) {
    saved.best = G.best;
    persist();
  }
}

export function killPlayer(): void {
  G.lives--;
  G.charge = 0;
  noteDeath();
  player.inv = 2.6;
  player.weapon = 0;
  player.wt = 0;
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  debris(SP.ship, player.x, player.y, player.w, player.h, C.ink, 1.9);
  burst(cx, cy, 46, C.hot, 1.5);
  shockwave(cx, cy, 1.4);
  kick(1);
  freeze(0.14);
  fx.glitch = 0.5;
  Snd.hurt(cx);
  bombs.clear();
  aims.clear();
  /* shards scatter; divers break off and fly home */
  for (let i = raiders.count - 1; i >= 0; i--) {
    const r = raiders.items[i];
    if (r.kind === 'shard') raiders.kill(i);
    else r.kind = 'return';
  }
  if (G.lives <= 0) {
    G.state = 'over';
    G.timer = 0;
    Snd.ufoStop();
    Snd.over();
    G.best = Math.max(G.best, G.score);
    finishRun();
  } else {
    G.state = 'dead';
    G.timer = 1.1;
  }
}

export function updatePlayer(dt: number): void {
  let want = pad.axis;
  if (held('left')) want -= 1;
  if (held('right')) want += 1;
  want = clamp(want, -1, 1);
  if (touch.x !== null) {
    const target = clamp(touch.x - player.w / 2, 0, V.w - player.w);
    want = clamp((target - player.x) / 40, -1, 1);
  }
  const k = speedScale();
  player.vx += want * ACCEL * k * dt;
  player.vx *= Math.pow(0.0009, dt); // frame-rate independent drag
  player.vx = clamp(player.vx, -MAX_SPEED * k, MAX_SPEED * k);
  player.x = clamp(player.x + player.vx * dt, 0, V.w - player.w);
  if (player.x <= 0 || player.x >= V.w - player.w) player.vx = 0;

  if (player.inv > 0) player.inv -= dt;
  if (player.wt > 0) {
    player.wt -= dt;
    if (player.wt <= 0) player.weapon = 0;
  }
  player.cool -= dt;
  player.droneCool -= dt;
  if (player.flash > 0) player.flash -= dt;
  if ((held('fire') || touch.fire || pad.fire) && player.cool <= 0) fire();
}
