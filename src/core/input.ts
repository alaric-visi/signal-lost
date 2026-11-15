import { saved, type Action } from './storage';
import { screenEl, view } from './view';

/* Keyboard, pointer/touch and gamepad, merged into a few questions the game
   asks: is this action held, and where is the touch steering. */

export const keys: Record<string, boolean> = Object.create(null);
/* Touch steering: drag anywhere to steer, holding fires. */
export const touch = { x: null as number | null, fire: false, used: false };
/* Filled in by gamepad.ts each frame. */
export const pad = { axis: 0, fire: false };

/* Keys with a fixed job; they can't be bound to an action. */
export const RESERVED = new Set(['p', 'm', 'f', 'g', '`', 'Escape', 'Enter', 'Tab']);
/* Extra keys that always work, unless the player has bound them elsewhere. */
const ALT: Record<Action, readonly string[]> = { left: ['a'], right: ['d'], fire: [], pulse: ['Shift'] };
const ACTIONS: readonly Action[] = ['left', 'right', 'fire', 'pulse'];

const boundElsewhere = (k: string): boolean => ACTIONS.some((a) => saved.keys[a] === k);

/* Does key `k` trigger action `a`? */
export function isAction(k: string, a: Action): boolean {
  return k === saved.keys[a] || (ALT[a].includes(k) && !boundElsewhere(k));
}
export function held(a: Action): boolean {
  if (keys[saved.keys[a]]) return true;
  for (const k of ALT[a]) if (keys[k] && !boundElsewhere(k)) return true;
  return false;
}

const KEY_NAMES: Record<string, string> = {
  ' ': 'SPACE', ArrowLeft: '←', ArrowRight: '→', ArrowUp: 'UP', ArrowDown: 'DOWN',
};
export const keyLabel = (k: string): string => KEY_NAMES[k] || k.toUpperCase();

export interface InputHandlers {
  /* A key went down while something is waiting to capture one (rebinding).
     Return true to swallow it. */
  capture(k: string): boolean;
  /* A click or tap landed at (x, y) in world units. Return true if a button
     took it, so it doesn't also steer or start the game. */
  tap(x: number, y: number): boolean;
  /* start / confirm; (x, y) in world units when it came from a pointer */
  press(x?: number, y?: number): void;
  /* any key going down (single characters lower-cased) */
  key(k: string): void;
  pulse(): void;
  pause(): void;
  togglePause(): void;
  toggleSound(): void;
  toggleFull(): void;
  toggleFx(): void;
  toggleDebug(): void;
}

export const norm = (k: string): string => (k.length === 1 ? k.toLowerCase() : k);
const SCROLL_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']);

function ptrX(e: PointerEvent): number {
  const r = screenEl.getBoundingClientRect();
  const px = (e.clientX - r.left) * (screenEl.width / r.width);
  return (px - view.ox) / view.scale;
}
function ptrY(e: PointerEvent): number {
  const r = screenEl.getBoundingClientRect();
  const py = (e.clientY - r.top) * (screenEl.height / r.height);
  return (py - view.oy) / view.scale;
}

let steerId = -1; // the pointer that is steering

export function initInput(h: InputHandlers): void {
  addEventListener('keydown', (e) => {
    const k = norm(e.key);
    if (SCROLL_KEYS.has(e.key) || k === saved.keys.fire) e.preventDefault();
    if (e.repeat) return;
    if (h.capture(k)) {
      e.preventDefault();
      return;
    }
    keys[k] = true;

    if (k === ' ' || k === 'Enter') h.press();
    else if (k === 'p' || k === 'Escape') h.togglePause();
    else if (k === 'm') h.toggleSound();
    else if (k === 'f') h.toggleFull();
    else if (k === 'g') h.toggleFx();
    else if (k === '`') h.toggleDebug();
    h.key(k);
  });
  addEventListener('keyup', (e) => {
    keys[norm(e.key)] = false;
  });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    h.pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) h.pause();
  });

  screenEl.addEventListener('pointerdown', (e) => {
    /* A mouse click only claims keyboard focus and starts or resumes the round.
       Steering by pointer is touch-only, so clicking never yanks the ship away
       from the keys. */
    try {
      window.focus();
    } catch {
      /* ignored */
    }
    screenEl.focus();
    e.preventDefault();
    const x = ptrX(e), y = ptrY(e);
    const isTouch = e.pointerType === 'touch';
    if (isTouch) touch.used = true;
    if (h.tap(x, y)) return; // an on-screen button took it
    if (isTouch) {
      if (touch.fire) {
        h.pulse(); // a second finger while the first is steering
        return;
      }
      steerId = e.pointerId;
      screenEl.setPointerCapture(e.pointerId);
      touch.x = x;
      touch.fire = true;
    }
    h.press(x, y);
  });
  screenEl.addEventListener('pointermove', (e) => {
    if (touch.fire && e.pointerId === steerId) touch.x = ptrX(e);
  });
  const endPtr = (e: PointerEvent): void => {
    if (e.pointerId !== steerId) return; // another finger lifting changes nothing
    steerId = -1;
    touch.fire = false;
    touch.x = null;
  };
  screenEl.addEventListener('pointerup', endPtr);
  screenEl.addEventListener('pointercancel', endPtr);
  screenEl.addEventListener('pointerleave', endPtr);
  screenEl.addEventListener('contextmenu', (e) => e.preventDefault());
}
