/* Clickable regions on the canvas. The HUD re-registers them every frame as it
   draws, so what can be tapped is always exactly what is on screen. */
interface Hot {
  x: number; y: number; w: number; h: number;
  act: (x: number) => void;
}
const hots: Hot[] = [];

export function clearHot(): void {
  hots.length = 0;
}

/* `act` receives the tap's x in world units (sliders need it). */
export function addHot(x: number, y: number, w: number, h: number, act: (x: number) => void): void {
  hots.push({ x, y, w, h, act });
}

/* Runs the topmost region under (x, y). Returns true if there was one. */
export function hitHot(x: number, y: number): boolean {
  for (let i = hots.length - 1; i >= 0; i--) {
    const r = hots[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      r.act(x);
      return true;
    }
  }
  return false;
}
