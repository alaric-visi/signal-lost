import { clamp } from '../core/math';
import { srand as rand, srandi as randi } from '../core/rng';
import { V } from '../core/view';
import { alienH, alienX, alienY, grid } from './grid';
import { killPlayer } from './player';
import { spawnBomb } from './spawn';
import { G, player, raiders, type Enemy } from './state';

/* Free-flying enemies: diving Watchers and Splitter shards. */

const SHARD_SIZE = 26;
const RETURN_SPEED = 560;

/* A Watcher leaves its slot and swoops at the player. */
export function launchDiver(e: Enemy): void {
  e.away = true;
  const r = raiders.spawn();
  r.kind = 'dive';
  r.home = e;
  r.w = grid.alienW;
  r.h = alienH(e.type);
  r.x = alienX(e);
  r.y = alienY(e);
  r.vx = 0;
  r.vy = -120; // a little hop up before the plunge
  r.t = 0;
  r.ph = rand(0, 6.28);
  r.fired = false;
}

export function spawnShard(x: number, y: number, push: number): void {
  const r = raiders.spawn();
  r.kind = 'shard';
  r.home = null;
  r.w = r.h = SHARD_SIZE;
  r.x = x - SHARD_SIZE / 2;
  r.y = y - SHARD_SIZE / 2;
  r.vx = push;
  r.vy = -60;
  r.t = 0;
  r.ph = rand(0, 6.28);
  r.fired = false;
}

/* Returns true if a raider rammed the player this tick. */
export function updateRaiders(dt: number): boolean {
  const pcx = player.x + player.w / 2;
  for (let i = raiders.count - 1; i >= 0; i--) {
    const r = raiders.items[i];
    r.t += dt;

    if (r.kind === 'dive') {
      r.vx = clamp((pcx - r.w / 2 - r.x) * 2.4, -280, 280) + Math.sin(r.t * 5 + r.ph) * 130;
      r.vy = Math.min(r.vy + 620 * dt, 340 + G.level * 8);
      if (!r.fired && r.y > V.h * 0.42) {
        r.fired = true;
        spawnBomb(r.x + r.w / 2, r.y + r.h, 0, 400, randi(0, 3));
      }
      if (r.y > V.h + 40) {
        r.y = -70; // wraps round and comes back in from the top
        r.kind = 'return';
      }
    } else if (r.kind === 'return') {
      const home = r.home!;
      const dx = alienX(home) - r.x, dy = alienY(home) - r.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) {
        home.away = false;
        raiders.kill(i);
        continue;
      }
      r.vx = (dx / d) * RETURN_SPEED;
      r.vy = (dy / d) * RETURN_SPEED;
    } else {
      /* shard: flutters down; the push it was born with fades */
      const push = r.vx * Math.pow(0.05, dt);
      r.x += Math.sin(r.t * 4 + r.ph) * 170 * dt;
      r.vx = push;
      r.vy = Math.min(r.vy + 500 * dt, 190 + G.level * 6);
      if (r.y > V.h + 30) {
        raiders.kill(i);
        continue;
      }
    }
    r.x += r.vx * dt;
    r.y += r.vy * dt;

    if (
      player.inv <= 0 &&
      r.x < player.x + player.w && r.x + r.w > player.x &&
      r.y < player.y + player.h && r.y + r.h > player.y
    ) {
      killPlayer(); // also sends every raider home
      return true;
    }
  }
  return false;
}
