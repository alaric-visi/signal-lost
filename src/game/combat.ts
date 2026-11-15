import { Snd } from '../audio/sfx';
import { sr } from '../core/rng';
import { V } from '../core/view';
import { C } from '../gfx/palette';
import { burst, debris } from '../gfx/particles';
import { SP } from '../gfx/sprites';
import { damageBoss } from './boss';
import { GAIN_KILL, addCharge, mult } from './charge';
import { freeze, kick, popup, ring, shockwave } from './fx';
import { alienH, alienX, alienY, grid, present } from './grid';
import { spawnShard } from './raiders';
import { noteDiveKill, notePulse } from './records';
import { spawnDrop } from './spawn';
import { G, TYPES, T_SPLITTER, aims, bombs, enemies, form, fx, player, raiders, type Enemy } from './state';
import { run } from './upgrades';

const DROP_CHANCE = 0.065;
const SHARD_POINTS = 5;
export const PULSE_RADIUS = 440;
export const PULSE_TIME = 0.5;

/* Remove an enemy from the wave with all the trimmings. (x, y) is where it is
   on screen: its slot, or wherever it was flying. */
function destroy(e: Enemy, x: number, y: number, inFlight: boolean): void {
  const T = TYPES[e.type];
  const w = grid.alienW, h = alienH(e.type);
  const mx = x + w / 2, my = y + h / 2;
  const pts = T.pts * (inFlight ? 2 : 1) * mult(); // a Watcher shot mid-dive is worth double
  G.score += pts;
  e.alive = false;
  e.away = false;
  form.alive--;

  debris(T.sp[form.frame], x, y, w, h, C[T.col]);
  burst(mx, my, 5, C.white, 0.7);
  ring(mx, my, w * 0.25, w * 0.95, C[T.col]);
  popup(mx, my, '+' + pts, C[T.col]);
  shockwave(mx, my, 0.22);
  kick(0.36);
  Snd.kill(mx);
  addCharge(GAIN_KILL);

  if (e.type === T_SPLITTER) {
    spawnShard(mx - 14, my, -150);
    spawnShard(mx + 14, my, 150);
  }
  if (sr() < DROP_CHANCE * (1 + 0.5 * run.magnet)) spawnDrop(mx, my);
  if (inFlight) noteDiveKill();
}

/* One point of damage to an enemy sitting in the formation. */
export function hitEnemy(e: Enemy): void {
  if (--e.hp > 0) {
    /* armour cracks but holds */
    const mx = alienX(e) + grid.alienW / 2, my = alienY(e) + alienH(e.type) / 2;
    ring(mx, my, grid.alienW * 0.5, grid.alienW * 0.8, C.white, 0.18);
    burst(mx, my, 6, C[TYPES[e.type].col], 0.6);
    kick(0.2);
    Snd.clank(mx);
    return;
  }
  destroy(e, alienX(e), alienY(e), false);
}

export function killRaider(i: number): void {
  const r = raiders.items[i];
  if (r.home) destroy(r.home, r.x, r.y, true);
  else {
    const mx = r.x + r.w / 2, my = r.y + r.h / 2;
    const pts = SHARD_POINTS * mult();
    G.score += pts;
    debris(SP.shard[0], r.x, r.y, r.w, r.h, C.violet);
    ring(mx, my, 6, 34, C.violet, 0.2);
    popup(mx, my, '+' + pts, C.violet, 14);
    Snd.kill(mx);
    addCharge(GAIN_KILL * 0.5);
  }
  raiders.kill(i);
}

/* Spend a full signal meter: wipes every enemy shot, destroys raiders and
   damages everything near the ship. The multiplier goes with it. */
export function firePulse(): void {
  if (G.state !== 'play' || G.charge < 1) return;
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  const r2 = PULSE_RADIUS * PULSE_RADIUS;
  const inRange = (x: number, y: number): boolean => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2;

  G.charge = 0;
  G.pulse = PULSE_TIME;
  bombs.clear();
  aims.clear();
  let hits = 0;
  for (let i = raiders.count - 1; i >= 0; i--) {
    const r = raiders.items[i];
    if (inRange(r.x + r.w / 2, r.y + r.h / 2)) {
      killRaider(i);
      hits++;
    }
  }
  /* collect first: destroying a Splitter adds shards, which should survive */
  const struck = enemies.filter(
    (e) => present(e) && inRange(alienX(e) + grid.alienW / 2, alienY(e) + alienH(e.type) / 2),
  );
  for (const e of struck) hitEnemy(e);
  damageBoss(8);
  notePulse(hits + struck.length);

  ring(cx, cy, 30, PULSE_RADIUS, C.white, PULSE_TIME);
  burst(cx, cy, 40, null, 2);
  shockwave(cx, cy, 1.6);
  kick(0.8);
  freeze(0.05);
  fx.glitch = 0.3;
  popup(cx, V.h * 0.5, 'PULSE', C.white, 30);
  Snd.pulse(cx);
}
