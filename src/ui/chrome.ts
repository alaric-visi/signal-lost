import { Snd } from '../audio/sfx';
import { persist, saved } from '../core/storage';
import { fx } from '../game/state';
import { togglePause } from '../game/update';

const el = (id: string): HTMLElement => document.getElementById(id)!;

function showSound(): void {
  el('bSound').classList.toggle('dim', !Snd.on);
}
function showFx(): void {
  el('scan').classList.toggle('fx-off', !fx.on);
  el('vig').classList.toggle('fx-off', !fx.on);
  el('bFx').classList.toggle('dim', !fx.on);
}

/* Bring the buttons in line with the current settings. */
export function syncChrome(): void {
  showSound();
  showFx();
}

export function toggleSound(): void {
  Snd.boot();
  Snd.setOn(!Snd.on);
  saved.sound = Snd.on;
  persist();
  showSound();
}

export function toggleFx(): void {
  fx.on = !fx.on;
  saved.fx = fx.on;
  persist();
  showFx();
}

export async function toggleFull(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    /* sandboxed frames may refuse; the layout already fills the viewport */
  }
}

export function initChrome(): void {
  Snd.on = saved.sound;
  fx.on = saved.fx;
  showSound();
  showFx();

  const bind = (id: string, fn: () => void): void => {
    el(id).addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
  };
  bind('bPause', togglePause);
  bind('bSound', toggleSound);
  bind('bFx', toggleFx);
  bind('bFull', () => void toggleFull());
  if (!document.fullscreenEnabled) el('bFull').style.display = 'none';
}
