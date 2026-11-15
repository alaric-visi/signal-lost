import { aims, bombs, drops, enemies, form, parts, raiders, shots } from '../game/state';

/* Performance overlay, toggled with the backquote key. */
let el: HTMLDivElement | null = null;
let on = false;
let frames = 0;
let work = 0;
let worst = 0;
let since = performance.now();

export function toggleDebug(): void {
  on = !on;
  if (on && !el) {
    el = document.createElement('div');
    el.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:9;pointer-events:none;white-space:pre;' +
      'font:11px/1.5 ui-monospace,Menlo,monospace;color:#8ef6ff;background:rgba(2,0,8,.72);' +
      'padding:6px 9px;border:1px solid rgba(120,240,255,.28);border-radius:6px';
    document.body.appendChild(el);
  }
  if (el) el.style.display = on ? 'block' : 'none';
  frames = work = worst = 0;
  since = performance.now();
}

/* Call once a frame with how long the frame's work took, in milliseconds. */
export function debugFrame(ms: number): void {
  if (!on || !el) return;
  frames++;
  work += ms;
  worst = Math.max(worst, ms);
  const now = performance.now();
  if (now - since < 500) return;
  el.textContent =
    `${Math.round((frames * 1000) / (now - since))} fps   ` +
    `${(work / frames).toFixed(2)} ms avg   ${worst.toFixed(1)} ms worst\n` +
    `enemies ${form.alive}/${enemies.length}   raiders ${raiders.count}   aims ${aims.count}\n` +
    `shots ${shots.count}   bombs ${bombs.count}   drops ${drops.count}   particles ${parts.count}`;
  frames = work = worst = 0;
  since = now;
}
