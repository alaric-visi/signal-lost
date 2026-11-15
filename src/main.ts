/* ==========================================================================
   SIGNAL LOST — boot and wiring.
   ========================================================================== */
import { audio } from './audio/engine';
import { Music, type MusicMode } from './audio/music';
import { pollGamepad } from './core/gamepad';
import { initInput, type InputHandlers } from './core/input';
import { startLoop } from './core/loop';
import { loadSaved, saved } from './core/storage';
import { initView, layout, onLayout } from './core/view';
import { buildBunkers, markBunkersDirty } from './game/bunkers';
import { firePulse } from './game/combat';
import { offer, run } from './game/upgrades';
import { buildWave } from './game/formation';
import { reflow } from './game/grid';
import { recordBest } from './game/player';
import * as state from './game/state';
import { G } from './game/state';
import { applySettings, captureKey, onSettingsChange } from './game/settings';
import { onKey, pause, press, tap, togglePause, update } from './game/update';
import { initTheme, onTheme } from './gfx/palette';
import { invalidateBackdrop } from './gfx/background';
import { initPost, post, resizePost } from './gfx/post';
import { render } from './gfx/render';
import { setGlowScale } from './gfx/sprites';
import { clearTextCache } from './gfx/text';
import { initChrome, syncChrome, toggleFull, toggleFx, toggleSound } from './ui/chrome';
import { debugFrame, toggleDebug } from './ui/debug';

loadSaved();
G.best = saved.best;

onLayout(reflow);
onLayout(clearTextCache);
onLayout(invalidateBackdrop);
onLayout(resizePost);
onTheme(markBunkersDirty);
onTheme(invalidateBackdrop);

initView();
initPost();
if (post.active) {
  document.body.classList.add('gl'); // the shader replaces the CSS scanline and vignette layers
  setGlowScale(0.5);
}
initTheme();
initChrome();
onSettingsChange(syncChrome);
applySettings();
const handlers: InputHandlers = {
  capture: captureKey,
  tap,
  toggleDebug,
  press,
  key: onKey,
  pulse: firePulse,
  pause,
  togglePause,
  toggleSound,
  toggleFx,
  toggleFull: () => void toggleFull(),
};
initInput(handlers);
addEventListener('pagehide', recordBest);

layout();
buildBunkers();
buildWave();
/* Tell the soundtrack what the game is doing, once a frame. */
function syncMusic(): void {
  const s = G.state;
  const mode: MusicMode =
    s === 'menu' ? 'menu'
    : s === 'over' ? 'over'
    : s === 'pause' || (s === 'settings' && G.back === 'pause') ? 'pause'
    : s === 'settings' || s === 'records' ? 'menu'
    : s === 'upgrade' || s === 'wave' ? 'calm'
    : state.boss.active ? 'boss'
    : 'play';
  const total = state.enemies.length;
  const intensity = state.boss.active ? state.boss.phase / 2 : total ? 1 - state.form.alive / total : 0;
  Music.set(mode, intensity, G.charge);
}

startLoop(
  update,
  (ahead) => {
    render(ahead);
    syncMusic();
  },
  () => pollGamepad(handlers),
  debugFrame,
);

/* Dev builds only: poke at the game from the console, e.g.
   __game.G.level = 5; __game.buildWave()   to jump straight to the boss,
   or step the simulation by hand with __game.update(1 / 120). */
if (import.meta.env.DEV) {
  Object.assign(window, { __game: { ...state, buildWave, update, render, press, onKey, firePulse, offer, run, audio } });
}

/* Production only: a service worker caches the game so it runs offline and can
   be installed. Files already loaded on this first visit are added to the
   cache straight away, so going offline works without a second visit. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => caches.open('signal-lost-v1'))
      .then((cache) => {
        const loaded = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin));
        return cache.addAll([location.href, ...new Set(loaded)]);
      })
      .catch(() => {
        /* offline support is a bonus; the game works without it */
      });
  });
}
