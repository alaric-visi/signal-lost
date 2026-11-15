import { Snd } from '../audio/sfx';
import { unlock } from './records';
import { G } from './state';
import { run } from './upgrades';

/* The signal meter. Kills and near-misses fill it; it drains if you stop
   scoring. Its level is the score multiplier (x1 to x4), so keeping it high is
   "banking" it. A full meter can instead be spent on a pulse (see combat.ts),
   which empties it. */
const IDLE_BEFORE_DRAIN = 2.5;
const DRAIN_PER_SEC = 0.05;

export const GAIN_KILL = 0.03;
export const GAIN_GRAZE = 0.05;
export const GAIN_RELAY = 0.3;
export const GAIN_BOSS_HIT = 0.004;
export const GAIN_WAVE = 0.15;

export const mult = (): number => Math.min(4, 1 + Math.floor(G.charge * 3 + 1e-6));

export function addCharge(amount: number): void {
  const was = G.charge;
  G.charge = Math.min(1, G.charge + amount * (1 + 0.25 * run.resonance));
  G.chargeIdle = 0;
  if (was < 1 && G.charge >= 1) {
    Snd.ready();
    unlock('full');
  }
}

export function updateCharge(dt: number): void {
  G.chargeIdle += dt;
  if (G.chargeIdle > IDLE_BEFORE_DRAIN) G.charge = Math.max(0, G.charge - DRAIN_PER_SEC * dt);
}
