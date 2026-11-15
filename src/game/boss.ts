import { Snd } from '../audio/sfx';
import { rand } from '../core/math';
import { srandi as randi } from '../core/rng';
import { V } from '../core/view';
import { C } from '../gfx/palette';
import { burst, debris } from '../gfx/particles';
import { SP } from '../gfx/sprites';
import { GAIN_BOSS_HIT, addCharge, mult } from './charge';
import { freeze, kick, popup, ring, shockwave } from './fx';
import { spawnShard } from './raiders';
import { unlock } from './records';
import { spawnAim, spawnBomb, spawnDrop } from './spawn';
import { BOSS_Y, G, aims, bombs, boss, fx, player } from './state';

/* The Carrier: arrives every fifth wave. Three phases by remaining health —
   each one moves faster, attacks more often and adds to every pattern. */

const DEATH_TIME = 1.6;
const MARGIN = 30;

export function spawnBoss(tier: number): void {
  const w = Math.min(V.w * 0.42, 340);
  boss.active = true;
  boss.tier = tier;
  boss.w = w;
  boss.h = w * (SP.carrier.height / SP.carrier.width);
  boss.x = V.w / 2 - w / 2;
  boss.y = -boss.h - 20;
  boss.vx = 120;
  boss.hp = boss.max = 36 + tier * 22;
  boss.phase = 0;
  boss.t = 0;
  boss.attackT = 1.2;
  boss.pattern = 0;
  boss.flash = 0;
  boss.shield = 0;
  boss.dying = 0;
}

const vulnerable = (): boolean => boss.active && boss.dying <= 0 && boss.shield <= 0 && boss.y >= BOSS_Y;

/* Returns true if the damage landed (false while shielded or arriving). */
export function damageBoss(n: number): boolean {
  if (!vulnerable()) return false;
  boss.hp -= n;
  boss.flash = 0.08;
  addCharge(GAIN_BOSS_HIT * n);
  Snd.bossHit(boss.x + boss.w / 2);
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.dying = DEATH_TIME;
    bombs.clear();
    aims.clear();
    freeze(0.12);
    kick(0.8);
    Snd.bossDown(boss.x + boss.w / 2);
  }
  return true;
}

function attack(): void {
  const cx = boss.x + boss.w / 2;
  const bottom = boss.y + boss.h;
  const pcx = player.x + player.w / 2;
  const p = boss.phase;
  switch (boss.pattern++ % 3) {
    case 0: {
      /* a fan of bombs */
      const n = 5 + p * 2;
      const speed = 320 + boss.tier * 14;
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * 0.17;
        spawnBomb(cx, bottom - 10, Math.sin(a) * speed, Math.cos(a) * speed, randi(0, 3));
      }
      break;
    }
    case 1:
      /* telegraphed bolts: one at the ship, more either side in later phases */
      for (let j = -p; j <= p; j++) {
        spawnAim(null, j * boss.w * 0.3, pcx + j * 130, player.y + player.h / 2, 0.85);
      }
      Snd.aim(cx);
      break;
    default: {
      const n = 2 + p;
      for (let i = 0; i < n; i++) {
        const k = i - (n - 1) / 2;
        spawnShard(cx + k * 70, bottom, k * 160);
      }
    }
  }
}

function finish(): void {
  const cx = boss.x + boss.w / 2, cy = boss.y + boss.h / 2;
  const pts = 1500 * boss.tier * mult();
  boss.active = false;
  G.score += pts;
  unlock('carrier');
  debris(SP.carrier, boss.x, boss.y, boss.w, boss.h, C.hot, 2.4);
  burst(cx, cy, 80, null, 2);
  ring(cx, cy, boss.w * 0.3, boss.w * 1.8, C.white, 0.6);
  popup(cx, cy, '+' + pts, C.amber, 34);
  shockwave(cx, cy, 1.6);
  kick(1);
  freeze(0.18);
  fx.glitch = 0.5;
  spawnDrop(cx - 40, cy, 'life');
  spawnDrop(cx + 40, cy);
}

export function updateBoss(dt: number): void {
  if (!boss.active) return;
  boss.t += dt;
  if (boss.flash > 0) boss.flash -= dt;

  if (boss.dying > 0) {
    boss.dying -= dt;
    if (Math.random() < dt * 14) {
      const bx = boss.x + rand(0, boss.w);
      burst(bx, boss.y + rand(0, boss.h), 14, null, 1.2);
      kick(0.5);
      Snd.kill(bx);
    }
    if (boss.dying <= 0) finish();
    return;
  }

  if (boss.y < BOSS_Y) {
    boss.y = Math.min(BOSS_Y, boss.y + 150 * dt); // arriving
    return;
  }
  if (boss.shield > 0) boss.shield -= dt;

  boss.x += boss.vx * dt;
  if (boss.x < MARGIN) {
    boss.x = MARGIN;
    boss.vx = Math.abs(boss.vx);
  } else if (boss.x + boss.w > V.w - MARGIN) {
    boss.x = V.w - MARGIN - boss.w;
    boss.vx = -Math.abs(boss.vx);
  }

  const f = boss.hp / boss.max;
  const phase = f > 0.66 ? 0 : f > 0.33 ? 1 : 2;
  if (phase !== boss.phase) {
    boss.phase = phase;
    boss.shield = 0.9;
    boss.vx = Math.sign(boss.vx) * (120 + phase * 55);
    fx.glitch = 0.4;
    shockwave(boss.x + boss.w / 2, boss.y + boss.h / 2, 1);
    kick(0.6);
    Snd.drop();
  }

  boss.attackT -= dt;
  if (boss.attackT <= 0) {
    attack();
    boss.attackT = Math.max(0.9, 2.3 - phase * 0.45 - boss.tier * 0.12);
  }
}

/* Where a boss-fired telegraph starts. */
export const bossMuzzleX = (bx: number): number => boss.x + boss.w / 2 + bx;
export const bossMuzzleY = (): number => boss.y + boss.h - 8;
