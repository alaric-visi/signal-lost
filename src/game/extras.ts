import { Snd } from '../audio/sfx';
import { clamp } from '../core/math';
import { spick as pick, sr, srand as rand } from '../core/rng';
import { V } from '../core/view';
import { C } from '../gfx/palette';
import { burst } from '../gfx/particles';
import { popup, ring } from './fx';
import { noteWeapon } from './records';
import { G, MAX_LIVES, WEAPON_TIME, drops, form, player, sky, type DropKind } from './state';
import { run } from './upgrades';

export const DROP_LABEL: Record<DropKind, string> = {
  rapid: 'RAPID', triple: 'SPREAD', lance: 'LANCE', seeker: 'SEEKER', shield: 'SHIELD', life: '1UP',
};
const DROP_WEAPON: Partial<Record<DropKind, number>> = { rapid: 1, triple: 2, lance: 3, seeker: 4 };
export const WEAPON_LABEL = ['', 'RAPID', 'SPREAD', 'LANCE', 'SEEKER'];
const UFO_POINTS = [50, 100, 150, 200, 300] as const;
const MAGNET_RANGE = 240;
const MAGNET_PULL = 300;

/* The Relay satellite that crosses the top of the screen. */
export function updateUfo(dt: number): void {
  sky.ufoTimer -= dt;
  if (!sky.ufo && sky.ufoTimer <= 0 && form.alive > 4) {
    const dir = sr() < 0.5 ? 1 : -1;
    const w = clamp(V.w * 0.048, 58, 84);
    sky.ufo = {
      x: dir > 0 ? -w : V.w, y: 78, w, h: w * (7 / 16), vx: dir * 230,
      pts: pick(UFO_POINTS),
    };
    sky.ufoTimer = rand(18, 32);
    Snd.ufoStart();
  }
  const ufo = sky.ufo;
  if (ufo) {
    ufo.x += ufo.vx * dt;
    Snd.ufoPan(ufo.x + ufo.w / 2);
    if (ufo.x < -ufo.w - 10 || ufo.x > V.w + 10) {
      sky.ufo = null;
      Snd.ufoStop();
    }
  }
}

/* Falling power-ups. */
export function updateDrops(dt: number): void {
  const pcx = player.x + player.w / 2;
  for (let i = drops.count - 1; i >= 0; i--) {
    const d = drops.items[i];
    d.y += d.vy * dt;
    if (run.magnet > 0) {
      const dx = pcx - (d.x + d.w / 2);
      if (Math.abs(dx) < MAGNET_RANGE * run.magnet) {
        d.x += Math.sign(dx) * Math.min(Math.abs(dx), MAGNET_PULL * run.magnet * dt);
      }
    }
    if (d.y > V.h + 30) {
      drops.kill(i);
      continue;
    }
    if (
      d.x < player.x + player.w && d.x + d.w > player.x &&
      d.y < player.y + player.h && d.y + d.h > player.y
    ) {
      const weapon = DROP_WEAPON[d.kind];
      if (weapon) {
        player.weapon = weapon;
        noteWeapon(weapon);
        player.wt = WEAPON_TIME;
      } else if (d.kind === 'shield') player.inv = Math.max(player.inv, 7);
      else G.lives = Math.min(MAX_LIVES, G.lives + 1);
      const dx = d.x + d.w / 2, dy = d.y + d.h / 2;
      burst(dx, dy, 16, C.amber, 0.8);
      ring(dx, dy, 14, 90, C.amber, 0.35);
      popup(dx, player.y - 14, DROP_LABEL[d.kind], C.amber, 20);
      Snd.power(dx);
      drops.kill(i);
    }
  }
}
