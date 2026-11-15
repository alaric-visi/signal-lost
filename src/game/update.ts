import { Snd } from '../audio/sfx';
import { isAction } from '../core/input';
import { rand } from '../core/math';
import { seedRun } from '../core/rng';
import { V } from '../core/view';
import { isBossWave } from '../data/waves';
import { updateParts } from '../gfx/particles';
import { updateBoss } from './boss';
import { buildBunkers } from './bunkers';
import { GAIN_WAVE, addCharge, updateCharge } from './charge';
import { firePulse } from './combat';
import { updateDrops, updateUfo } from './extras';
import { alienFire, buildWave, stepFormation, updateAims } from './formation';
import { clearFx, shockwave, updateFx } from './fx';
import { INTRO_TIME } from './grid';
import { dailySeed } from './leaderboard';
import { recordBest, updatePlayer } from './player';
import { updateBombs, updateShots } from './projectiles';
import { updateRaiders } from './raiders';
import { noteScore, noteWaveClear, resetStats, updateToast } from './records';
import { activate, adjust, closeSettings, moveSel, openSettings, settings } from './settings';
import { G, aims, bombs, boss, drops, form, fx, parts, player, raiders, shots, sky, stars } from './state';
import { applyUpgrade, cardAt, offer, resetRun, rollOffer } from './upgrades';
import { hitHot } from '../ui/hot';

const WAVE_BANNER_TIME = 1.6;

/* ---------- flow: start, pause, resume --------------------------------- */

/* Start a run. A daily run uses today's date as its seed, so everyone who
   plays it gets the same enemy fire, drops and upgrade offers. */
export function reset(daily = false): void {
  G.daily = daily;
  seedRun(daily ? dailySeed() : (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
  resetStats();
  G.score = 0;
  G.shown = 0;
  G.level = 1;
  G.lives = 3;
  G.charge = 0;
  G.chargeIdle = 0;
  G.pulse = 0;
  resetRun();
  player.x = V.w / 2 - player.w / 2;
  player.vx = 0;
  player.inv = 2;
  player.weapon = 0;
  player.wt = 0;
  player.cool = 0;
  player.droneCool = 0;
  shots.clear();
  bombs.clear();
  drops.clear();
  parts.clear();
  clearFx();
  boss.active = false;
  sky.ufo = null;
  sky.ufoTimer = 14;
  Snd.ufoStop();
  buildBunkers();
  buildWave(); // also clears raiders and telegraphs
  G.state = 'play';
}

export function pause(): void {
  if (G.state !== 'play') return;
  G.state = 'pause';
  Snd.ufoStop();
}

export function resume(): void {
  if (G.state !== 'pause') return;
  G.state = 'play';
  if (sky.ufo) Snd.ufoStart();
}

/* P / Escape / Start: pause, resume, or back out of a screen. */
export function togglePause(): void {
  if (G.state === 'play') pause();
  else if (G.state === 'settings') closeSettings();
  else if (G.state === 'records') G.state = G.back;
  else resume();
}

export function openRecords(): void {
  if (G.state !== 'menu' && G.state !== 'over') return;
  G.back = G.state;
  G.state = 'records';
}

/* A click or tap. On-screen buttons get first refusal. */
export function tap(x: number, y: number): boolean {
  Snd.boot();
  Snd.resume();
  return hitHot(x, y);
}

function chooseUpgrade(i: number): void {
  const card = offer.cards[i];
  if (!card || offer.lock > 0) return;
  applyUpgrade(card);
  Snd.power();
  G.state = 'wave';
  G.timer = WAVE_BANNER_TIME;
}

/* Space, Enter, click or tap: start, retry, resume, or pick an upgrade.
   (x, y) is where the pointer was, in world units, when there was one. */
export function press(x?: number, y?: number): void {
  Snd.boot();
  Snd.resume();
  if (G.state === 'menu' || G.state === 'over') reset();
  else if (G.state === 'pause') resume();
  else if (G.state === 'records') G.state = G.back;
  else if (G.state === 'settings') {
    if (x === undefined) activate(settings.sel); // pointer taps are handled by the rows themselves
  } else if (G.state === 'upgrade') {
    if (x === undefined || y === undefined) chooseUpgrade(offer.sel);
    else {
      const i = cardAt(x, y);
      if (i >= 0) {
        offer.sel = i;
        chooseUpgrade(i);
      }
    }
  }
}

/* Any other key going down. `k` is lower-cased for single characters. */
export function onKey(k: string): void {
  if (G.state === 'records') G.state = G.back;
  else if (G.state === 'upgrade') {
    const n = offer.cards.length;
    if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'a' || k === 'w') {
      offer.sel = (offer.sel + n - 1) % n;
      Snd.pick();
    } else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'd' || k === 's') {
      offer.sel = (offer.sel + 1) % n;
      Snd.pick();
    }
    else if (k === '1' || k === '2' || k === '3') {
      const i = Number(k) - 1;
      if (i < n) {
        offer.sel = i;
        chooseUpgrade(i);
      }
    }
  } else if (G.state === 'settings') {
    if (k === 'ArrowUp') moveSel(-1);
    else if (k === 'ArrowDown') moveSel(1);
    else if (k === 'ArrowLeft') adjust(-1);
    else if (k === 'ArrowRight') adjust(1);
  } else if (G.state === 'menu' || G.state === 'over') {
    if (k === 'd') reset(true);
    else if (k === 'r') openRecords();
    else if (k === 'o' && G.state === 'menu') openSettings();
  } else if (G.state === 'pause') {
    if (k === 'o') openSettings();
  } else if (G.state === 'play' && isAction(k, 'pulse')) firePulse();
}


function waveCleared(): void {
  const wasBoss = isBossWave(G.level);
  G.level++;
  G.score += 100 * G.level;
  G.best = Math.max(G.best, G.score);
  recordBest();
  addCharge(GAIN_WAVE);
  noteWaveClear(G.level);
  bombs.clear();
  aims.clear();
  Snd.wave();
  Snd.ufoStop();
  sky.ufo = null;
  shockwave(V.w / 2, V.h * 0.4, 0.9);
  if (wasBoss) buildBunkers(); // fresh pylons after every boss

  rollOffer();
  if (offer.cards.length) G.state = 'upgrade';
  else {
    G.state = 'wave';
    G.timer = WAVE_BANNER_TIME;
  }
}

/* ---------- one simulation tick ---------------------------------------- */

let menuGlitch = 2;

export function update(dt: number): void {
  /* hit-stop: everything holds still for a few ticks after a big impact */
  if (fx.freeze > 0) {
    fx.freeze -= dt;
    return;
  }
  G.t += dt;
  G.anim += dt;
  if (G.pulse > 0) G.pulse -= dt;
  updateFx(dt);
  updateToast(dt);
  if (G.shown < G.score) G.shown = Math.min(G.score, G.shown + Math.max(1, Math.ceil((G.score - G.shown) * dt * 9)));

  /* the title screen loses signal every few seconds */
  if (G.state === 'menu') {
    menuGlitch -= dt;
    if (menuGlitch <= 0) {
      fx.glitch = 0.28;
      menuGlitch = rand(2.5, 5.5);
    }
  }

  /* stars and particles drift always, even on menus */
  const drift = G.state === 'play' ? 1 : 0.4;
  for (const s of stars) {
    s.y += dt * (0.012 + s.z * 0.05) * drift;
    if (s.y > 1) {
      s.y -= 1;
      s.x = Math.random();
    }
  }
  updateParts(dt);

  if (G.state === 'dead') {
    G.timer -= dt;
    if (G.timer <= 0) {
      player.x = V.w / 2 - player.w / 2;
      player.vx = 0;
      G.state = 'play';
    }
    return;
  }
  if (G.state === 'wave') {
    G.timer -= dt;
    if (G.timer <= 0) {
      buildWave();
      G.state = 'play';
    }
    return;
  }
  if (G.state === 'upgrade') {
    if (offer.lock > 0) offer.lock -= dt;
    return;
  }
  if (G.state !== 'play') return;

  updatePlayer(dt);
  updateShots(dt);
  updateCharge(dt);

  if (form.alive === 0 && raiders.count === 0 && !boss.active) {
    waveCleared();
    return;
  }

  form.pulse = Math.max(0, form.pulse - dt * 9);
  if (form.alive > 0) {
    if (form.intro < INTRO_TIME) form.intro += dt; // still materialising: no marching or fire yet
    else {
      if (stepFormation(dt)) return;
      alienFire(dt);
    }
  }
  updateAims(dt);
  updateBoss(dt);
  if (updateRaiders(dt)) return;
  if (updateBombs(dt)) return;
  if (!boss.active) updateUfo(dt);
  updateDrops(dt);
  G.best = Math.max(G.best, G.score);
  noteScore(G.score);
}
