import { sr } from '../core/rng';
import { V } from '../core/view';
import { buildBunkers, bunkersDamaged } from './bunkers';
import { G, MAX_LIVES } from './state';

/* Upgrades picked between waves. They stack and last for the whole run. */
export const run = { overclock: 0, pierce: 0, wingman: 0, magnet: 0, resonance: 0, thrusters: 0 };
type Stat = keyof typeof run;

export interface Upgrade {
  id: Stat | 'repair' | 'life';
  name: string;
  desc: readonly [string, string];
  max: number; // 0 = can be taken any number of times
}

export const UPGRADES: readonly Upgrade[] = [
  { id: 'overclock', name: 'OVERCLOCK', desc: ['FIRE RATE +12%', ''], max: 4 },
  { id: 'pierce', name: 'PIERCE', desc: ['SHOTS PASS THROUGH', 'ONE MORE TARGET'], max: 2 },
  { id: 'wingman', name: 'WINGMAN', desc: ['A DRONE THAT', 'FIRES WITH YOU'], max: 2 },
  { id: 'magnet', name: 'MAGNET', desc: ['PICKUPS COME TO', 'YOU, AND MORE DROP'], max: 2 },
  { id: 'resonance', name: 'RESONANCE', desc: ['SIGNAL METER', 'FILLS 25% FASTER'], max: 3 },
  { id: 'thrusters', name: 'THRUSTERS', desc: ['MOVE SPEED +12%', ''], max: 3 },
  { id: 'repair', name: 'REPAIR', desc: ['REBUILD ALL', 'SHIELD PYLONS'], max: 0 },
  { id: 'life', name: 'EXTRA LIFE', desc: ['ONE MORE SHIP', ''], max: 0 },
];

export function resetRun(): void {
  for (const k in run) run[k as Stat] = 0;
}

/* How many of this upgrade the player holds (0 for one-off effects). */
export const owned = (u: Upgrade): number => (u.id === 'repair' || u.id === 'life' ? 0 : run[u.id]);

function available(u: Upgrade): boolean {
  if (u.id === 'repair') return bunkersDamaged();
  if (u.id === 'life') return G.lives < MAX_LIVES;
  return run[u.id] < u.max;
}

/* The current choice on screen. `lock` swallows input for a moment so a held
   fire key can't pick a card by accident. */
export const offer = { cards: [] as Upgrade[], sel: 0, lock: 0 };

export function rollOffer(): void {
  const pool = UPGRADES.filter(available);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(sr() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  offer.cards = pool.slice(0, 3);
  offer.sel = Math.min(1, offer.cards.length - 1);
  offer.lock = 0.7;
}

export function applyUpgrade(u: Upgrade): void {
  if (u.id === 'repair') buildBunkers();
  else if (u.id === 'life') G.lives = Math.min(MAX_LIVES, G.lives + 1);
  else run[u.id]++;
}

/* Card layout, shared by the HUD (drawing) and input (hit-testing). */
const CARD_GAP = 16;
/* On a narrow (portrait) screen the cards stack as full-width rows. */
export const cardsStacked = (): boolean => V.w < 900;
export function cardRect(i: number, out: { x: number; y: number; w: number; h: number }): void {
  const n = offer.cards.length;
  if (cardsStacked()) {
    out.w = V.w - 80;
    out.h = 120;
    out.x = 40;
    out.y = V.h * 0.33 + i * (out.h + CARD_GAP);
    return;
  }
  const w = Math.min(280, (V.w - 60 - (n - 1) * CARD_GAP) / n);
  const total = n * w + (n - 1) * CARD_GAP;
  out.x = (V.w - total) / 2 + i * (w + CARD_GAP);
  out.y = V.h * 0.36;
  out.w = w;
  out.h = 250;
}

const hitRect = { x: 0, y: 0, w: 0, h: 0 };
export function cardAt(x: number, y: number): number {
  for (let i = 0; i < offer.cards.length; i++) {
    cardRect(i, hitRect);
    if (x >= hitRect.x && x <= hitRect.x + hitRect.w && y >= hitRect.y && y <= hitRect.y + hitRect.h) return i;
  }
  return -1;
}
