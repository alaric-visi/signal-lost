import { Snd } from '../audio/sfx';
import { clamp, lerp } from '../core/math';
import { V } from '../core/view';
import { C } from '../gfx/palette';
import { burst, crumbs, debris } from '../gfx/particles';
import { SP } from '../gfx/sprites';
import { damageBoss } from './boss';
import { BLOB_BOMB, BLOB_SHOT, bunkerHit, hit } from './bunkers';
import { GAIN_GRAZE, GAIN_RELAY, addCharge, mult } from './charge';
import { hitEnemy, killRaider } from './combat';
import { freeze, kick, popup, ring, shockwave } from './fx';
import { alienH, alienX, alienY, grid, present } from './grid';
import { SHOT_LANCE, SHOT_SEEKER, killPlayer } from './player';
import { noteGraze } from './records';
import { G, bombs, boss, enemies, fx, player, raiders, shots, sky, type Shot } from './state';

const GRAZE_MARGIN = 30;
const SEEK_RANGE = 520;

/* x of the nearest thing a seeker could chase, or NaN if nothing is in range. */
function seekTarget(s: Shot): number {
  let best = SEEK_RANGE * SEEK_RANGE, tx = NaN;
  const sx = s.x + s.w / 2;
  const consider = (x: number, y: number): void => {
    if (y > s.y) return; // only chase what is still ahead
    const d = (x - sx) * (x - sx) + (y - s.y) * (y - s.y);
    if (d < best) {
      best = d;
      tx = x;
    }
  };
  for (const e of enemies) if (present(e)) consider(alienX(e) + grid.alienW / 2, alienY(e) + alienH(e.type) / 2);
  for (let i = 0; i < raiders.count; i++) {
    const r = raiders.items[i];
    consider(r.x + r.w / 2, r.y + r.h / 2);
  }
  if (sky.ufo) consider(sky.ufo.x + sky.ufo.w / 2, sky.ufo.y + sky.ufo.h / 2);
  if (boss.active) consider(boss.x + boss.w / 2, boss.y + boss.h / 2);
  return tx;
}

/* A shot that can still pierce carries on; otherwise it is spent. */
function spend(s: Shot, i: number, target: object): void {
  if (s.pierce > 0) {
    s.pierce--;
    s.last = target;
  } else shots.kill(i);
}

export function updateShots(dt: number): void {
  for (let i = shots.count - 1; i >= 0; i--) {
    const s = shots.items[i];
    if (s.kind === SHOT_SEEKER) {
      const tx = seekTarget(s);
      if (tx === tx) s.vx = lerp(s.vx, clamp((tx - (s.x + s.w / 2)) * 7, -560, 560), Math.min(1, dt * 9));
    }
    const px = s.x, py = s.y;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.y < -30 || s.x < -20 || s.x > V.w + 20) {
      shots.kill(i);
      continue;
    }
    if (bunkerHit(px + s.w / 2, py, s.x + s.w / 2, s.y, BLOB_SHOT)) {
      burst(hit.x, hit.y, 4, C.violet, 0.45);
      crumbs(hit.x, hit.y, 3, C.violet, 4.6);
      shots.kill(i);
      continue;
    }

    /* Box covering everything the shot swept through this tick, so a hit can't
       be missed between ticks. */
    const x0 = Math.min(px, s.x), x1 = Math.max(px, s.x) + s.w;
    const y0 = Math.min(py, s.y), y1 = Math.max(py, s.y) + s.h;

    const ufo = sky.ufo;
    if (ufo && x0 < ufo.x + ufo.w && x1 > ufo.x && y0 < ufo.y + ufo.h && y1 > ufo.y) {
      const ux = ufo.x + ufo.w / 2, uy = ufo.y + ufo.h / 2;
      const pts = ufo.pts * mult();
      G.score += pts;
      debris(SP.relay, ufo.x, ufo.y, ufo.w, ufo.h, C.amber, 1.5);
      burst(ux, uy, 34, C.amber, 1.3);
      ring(ux, uy, ufo.w * 0.3, ufo.w * 1.6, C.amber, 0.4);
      popup(ux, uy, '+' + pts, C.amber, 26);
      shockwave(ux, uy, 1);
      kick(0.65);
      freeze(0.06);
      fx.glitch = 0.35;
      addCharge(GAIN_RELAY);
      Snd.relayDown(ux);
      Snd.ufoStop();
      sky.ufo = null;
      shots.kill(i);
      continue;
    }

    if (
      boss.active && boss.dying <= 0 &&
      x0 < boss.x + boss.w && x1 > boss.x && y0 < boss.y + boss.h && y1 > boss.y
    ) {
      const landed = damageBoss(s.kind === SHOT_LANCE ? 2 : 1);
      burst(s.x + s.w / 2, boss.y + boss.h, landed ? 5 : 2, landed ? C.white : C.dim, 0.6);
      shots.kill(i); // nothing passes through the Carrier
      continue;
    }

    let gone = false;
    for (let j = raiders.count - 1; j >= 0; j--) {
      const r = raiders.items[j];
      if (r === s.last) continue;
      if (x0 < r.x + r.w && x1 > r.x && y0 < r.y + r.h && y1 > r.y) {
        const pierced = s.pierce > 0;
        spend(s, i, r);
        killRaider(j);
        gone = !pierced;
        break;
      }
    }
    if (gone) continue;

    const w = grid.alienW;
    for (const e of enemies) {
      if (e === s.last || !present(e)) continue;
      const ex = alienX(e), ey = alienY(e);
      if (x0 < ex + w && x1 > ex && y0 < ey + alienH(e.type) && y1 > ey) {
        spend(s, i, e);
        hitEnemy(e);
        break;
      }
    }
  }
}

/* Returns true if an enemy shot killed the player this tick. */
export function updateBombs(dt: number): boolean {
  const px0 = player.x, px1 = player.x + player.w;
  const py0 = player.y, py1 = player.y + player.h;
  for (let i = bombs.count - 1; i >= 0; i--) {
    const b = bombs.items[i];
    const ox = b.x, oy = b.y;
    b.vy += b.g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > V.h + 20 || b.x < -60 || b.x > V.w + 60) {
      bombs.kill(i);
      continue;
    }
    if (bunkerHit(ox + b.w / 2, oy + b.h, b.x + b.w / 2, b.y + b.h, BLOB_BOMB)) {
      burst(hit.x, hit.y, 6, C.hot, 0.55);
      crumbs(hit.x, hit.y, 5, C.violet, 4.6);
      bombs.kill(i);
      continue;
    }
    if (player.inv > 0) continue;
    if (b.x < px1 && b.x + b.w > px0 && b.y < py1 && b.y + b.h > py0) {
      killPlayer(); // clears every bomb
      return true;
    }
    /* graze: a shot that passes close without hitting feeds the signal meter */
    const near =
      b.x < px1 + GRAZE_MARGIN && b.x + b.w > px0 - GRAZE_MARGIN &&
      b.y < py1 + GRAZE_MARGIN && b.y + b.h > py0 - GRAZE_MARGIN;
    if (b.graze === 0 && near) b.graze = 1;
    else if (b.graze === 1 && !near) {
      b.graze = 2;
      addCharge(GAIN_GRAZE);
      noteGraze();
      popup(player.x + player.w / 2, player.y - 12, 'GRAZE', C.white, 14);
      Snd.graze(player.x + player.w / 2);
    }
  }
  return false;
}
