import { fx, popups, rings, shocks } from './state';

/* Screen shake: raise trauma to at least `level` (0..1). Shake scales with
   trauma squared, so small hits barely move and big ones kick. */
export function kick(level: number): void {
  fx.trauma = Math.min(1, Math.max(fx.trauma, level));
}

/* Hit-stop: hold the simulation still for a moment to sell an impact. */
export function freeze(seconds: number): void {
  fx.freeze = Math.max(fx.freeze, seconds);
}

const SHOCK_SPEED = 1100;
const shockStrength = (s: (typeof shocks)[number]): number => {
  const k = 1 - s.age / s.life;
  return s.power * k * k;
};
export const shockRadius = (age: number): number => age * SHOCK_SPEED;
export { shockStrength };

/* Only four distortion rings exist; a new one takes the weakest slot. */
export function shockwave(x: number, y: number, power: number): void {
  let slot = shocks[0];
  let weakest = Infinity;
  for (const s of shocks) {
    const k = s.power > 0 ? shockStrength(s) : 0;
    if (k < weakest) {
      weakest = k;
      slot = s;
    }
  }
  if (weakest > power) return;
  slot.x = x;
  slot.y = y;
  slot.age = 0;
  slot.life = 0.5 + power * 0.35;
  slot.power = power;
}

export function ring(x: number, y: number, r0: number, r1: number, col: string, life = 0.28): void {
  const r = rings.spawn();
  r.x = x;
  r.y = y;
  r.r0 = r0;
  r.r1 = r1;
  r.col = col;
  r.life = r.max = life;
}

export function popup(x: number, y: number, str: string, col: string, size = 18): void {
  const p = popups.spawn();
  p.x = x;
  p.y = y;
  p.str = str;
  p.col = col;
  p.size = size;
  p.life = 0.8;
}

export function clearFx(): void {
  rings.clear();
  popups.clear();
  for (const s of shocks) s.power = 0;
}

export function updateFx(dt: number): void {
  fx.trauma = Math.max(0, fx.trauma - dt * 1.5);
  fx.glitch = Math.max(0, fx.glitch - dt);
  for (const s of shocks) {
    if (s.power <= 0) continue;
    s.age += dt;
    if (s.age >= s.life) s.power = 0;
  }
  for (let i = rings.count - 1; i >= 0; i--) {
    const r = rings.items[i];
    r.life -= dt;
    if (r.life <= 0) rings.kill(i);
  }
  for (let i = popups.count - 1; i >= 0; i--) {
    const p = popups.items[i];
    p.y -= 46 * dt;
    p.life -= dt;
    if (p.life <= 0) popups.kill(i);
  }
}
