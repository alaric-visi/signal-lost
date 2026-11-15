import { clamp, lerp, rand, randi } from '../core/math';
import { saved } from '../core/storage';
import { V, ctx, cv, view } from '../core/view';
import { bunkers, paintBunker } from '../game/bunkers';
import { PULSE_TIME } from '../game/combat';
import { aimX, aimY } from '../game/formation';
import { shockRadius, shockStrength } from '../game/fx';
import { alienH, alienX, alienY, grid, spawnT } from '../game/grid';
import { SHOT_LANCE, SHOT_SEEKER, droneX } from '../game/player';
import { BOMB_BOLT, BOMB_SHELL } from '../game/spawn';
import {
  BOSS_Y, G, TYPES, aims, bombs, boss, drops, enemies, form, fx, parts, player, popups, raiders, rings,
  shocks, shots, sky,
} from '../game/state';
import { run } from '../game/upgrades';
import { drawHud, surgeCol } from '../ui/hud';
import { drawBackdrop, drawCarrier, drawStars } from './background';
import { C, cycle, theme } from './palette';
import { post, present, type PostParams } from './post';
import { SP, blit } from './sprites';
import { text } from './text';

const DROP_COL = { rapid: 'ink', triple: 'hot', lance: 'violet', seeker: 'frost', shield: 'amber', life: 'acid' } as const;
const DROP_CHAR = { rapid: 'R', triple: 'W', lance: 'L', seeker: 'H', shield: 'S', life: '+' } as const;
const BOSS_COL = ['hot', 'ember', 'amber'] as const;

const MAX_SHAKE = 26; // world units at full trauma
const MAX_TILT = 0.018; // radians
/* Smooth pseudo-noise in -1..1, so shake rolls instead of jittering. */
const wobble = (t: number, a: number, b: number): number => (Math.sin(t * a) + Math.sin(t * b + 1.3)) / 2;

const params: PostParams = { time: 0, crt: 1, glitch: 0, light: 0, dpr: 1, waves: new Float32Array(16) };

/* `ahead` is the fraction of a simulation tick (in seconds) not yet simulated;
   moving things are drawn that far along their velocity so motion stays smooth
   whatever the display refresh rate. */
export function render(ahead: number): void {
  const now = performance.now() / 1000;
  if (fx.freeze > 0) ahead = 0;
  const live = G.state === 'play' ? ahead : 0; // gameplay is frozen in other states

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackdrop();

  /* world transform, with trauma-driven shake and a slight tilt about centre */
  const tr = fx.trauma * fx.trauma * (saved.shake / 10);
  const sx = tr * MAX_SHAKE * wobble(now, 61, 97);
  const sy = tr * MAX_SHAKE * wobble(now, 71, 113);
  const rot = tr * MAX_TILT * wobble(now, 53, 89);
  const s = view.scale;
  const cos = Math.cos(rot) * s, sin = Math.sin(rot) * s;
  const wx = V.w / 2, wy = V.h / 2;
  ctx.setTransform(
    cos, sin, -sin, cos,
    view.ox + (wx + sx) * s - (cos * wx - sin * wy),
    view.oy + (wy + sy) * s - (sin * wx + cos * wy),
  );

  drawStars();
  drawCarrier();
  if (G.state !== 'menu') drawWorld(live);
  drawEffects(ahead);
  if (G.pulse > 0 && !saved.calm) {
    /* the pulse whites the screen out for an instant */
    ctx.fillStyle = C.white;
    ctx.globalAlpha = 0.28 * (G.pulse / PULSE_TIME);
    ctx.fillRect(-V.w, -V.h, V.w * 3, V.h * 3);
    ctx.globalAlpha = 1;
  }
  drawHud();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!post.active && fx.on && fx.glitch > 0 && !saved.calm) glitchPass();

  /* hand the frame to the post-processing pass */
  params.time = now;
  params.crt = fx.on ? 1 : 0;
  params.glitch = fx.on && !saved.calm ? clamp(fx.glitch / 0.5, 0, 1) : 0;
  params.light = theme.dark ? 0 : 1;
  params.dpr = view.dpr;
  for (let i = 0; i < shocks.length; i++) {
    const k = shocks[i];
    const o = i * 4;
    params.waves[o] = (k.x * s + view.ox) / cv.width;
    params.waves[o + 1] = 1 - (k.y * s + view.oy) / cv.height;
    params.waves[o + 2] = (shockRadius(k.age) * s) / cv.height;
    params.waves[o + 3] = k.power > 0 ? shockStrength(k) : 0;
  }
  present(params);
}

function drawWorld(live: number): void {
  /* shield pylons */
  const bunkerCol = surgeCol(C.violet, 3);
  for (const b of bunkers) {
    if (b.dirty || b.col !== bunkerCol) paintBunker(b, bunkerCol);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2;
    ctx.drawImage(b.cn, b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    ctx.restore();
    ctx.drawImage(b.cn, b.x, b.y, b.w, b.h);
  }

  /* aliens: stretched scanline while materialising, squash on each step */
  for (const e of enemies) {
    if (!e.alive || e.away) continue;
    const k = spawnT(e);
    if (k <= 0) continue;
    const T = TYPES[e.type];
    let w = grid.alienW, h = alienH(e.type), x = alienX(e), y = alienY(e);
    if (k < 1) {
      const ww = w * (1 + (1 - k) * 1.1), hh = Math.max(2, h * k * k);
      x -= (ww - w) / 2;
      y += (h - hh) / 2;
      w = ww;
      h = hh;
    } else if (form.pulse > 0) {
      const hh = h * (1 - 0.12 * form.pulse);
      y += h - hh;
      h = hh;
    }
    blit(T.sp[form.frame], k < 1 ? C.white : surgeCol(C[T.col], e.col + e.row * 3), x, y, w, h, 0.3);
    if (e.hp > 1 && k >= 1) {
      /* armour plating, gone after the first hit */
      ctx.strokeStyle = C.white;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
      ctx.globalAlpha = 1;
    }
  }

  /* raiders: diving Watchers and Splitter shards */
  const flap = Math.floor(G.t * 9) % 2;
  for (let i = 0; i < raiders.count; i++) {
    const r = raiders.items[i];
    const x = r.x + r.vx * live, y = r.y + r.vy * live;
    if (r.home) blit(TYPES[r.home.type].sp[flap], C[TYPES[r.home.type].col], x, y, r.w, r.h, 0.45);
    else blit(SP.shard[flap], C.violet, x, y, r.w, r.h, 0.4);
  }

  drawBoss();

  /* telegraphs: a line that tightens and brightens until the bolt flies */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < aims.count; i++) {
    const a = aims.items[i];
    const k = 1 - a.t / a.max; // 0 -> 1 as it is about to fire
    const x = aimX(a), y = aimY(a);
    ctx.strokeStyle = k > 0.75 ? C.white : C.hot;
    ctx.globalAlpha = (0.25 + 0.6 * k) * (saved.calm || Math.floor(G.t * (8 + k * 22)) % 2 ? 1 : 0.45);
    ctx.lineWidth = 1 + 3 * (1 - k);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(a.tx, a.ty);
    ctx.stroke();
    const s = 26 - 16 * k;
    ctx.strokeRect(a.tx - s, a.ty - s, s * 2, s * 2);
  }
  ctx.restore();

  /* relay */
  const ufo = sky.ufo;
  if (ufo) {
    blit(SP.relay, cycle(G.t, 14),
      ufo.x + ufo.vx * live, ufo.y + Math.sin(G.t * 6) * 4, ufo.w, ufo.h, 0.55);
  }

  /* bombs, with a short fading tail above */
  const frames = Math.floor(G.anim * 14) % 2 ? SP.bombAlt : SP.bomb;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = C.hot;
  for (let i = 0; i < bombs.count; i++) {
    const b = bombs.items[i];
    if (b.kind > 2) continue;
    const x = b.x + b.vx * live, y = b.y + b.vy * live;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(x + 2, y - 14, b.w - 4, 14);
    ctx.globalAlpha = 0.1;
    ctx.fillRect(x + 3, y - 30, b.w - 6, 16);
  }
  ctx.restore();
  for (let i = 0; i < bombs.count; i++) {
    const b = bombs.items[i];
    const x = b.x + b.vx * live, y = b.y + b.vy * live;
    if (b.kind === BOMB_BOLT) {
      /* sniper bolt: a hard white core in a hot sleeve */
      ctx.fillStyle = C.hot;
      ctx.fillRect(x - 2, y - 6, b.w + 4, b.h + 12);
      ctx.fillStyle = C.white;
      ctx.fillRect(x, y, b.w, b.h);
    } else if (b.kind === BOMB_SHELL) {
      /* mortar shell: spins, with a marker on the ground where it will land */
      const blink = saved.calm ? 1 : Math.floor(G.t * 16) % 2;
      ctx.fillStyle = blink ? C.ember : C.white;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = C.bg1;
      ctx.fillRect(x + 4, y + 4, b.w - 8, b.h - 8);
    } else blit(frames[b.kind], C.hot, x, y, b.w, b.h, 0.35);
  }

  /* player shots: white core, glow, and a tail that follows the flight path */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < shots.count; i++) {
    const sh = shots.items[i];
    const x = sh.x + sh.vx * live, y = sh.y + sh.vy * live;
    ctx.fillStyle = sh.kind === SHOT_LANCE ? C.violet : sh.kind === SHOT_SEEKER ? C.frost : C.ink;
    const slope = sh.vx / sh.vy; // x drift per unit of y travelled
    for (let j = 0; j < 4; j++) {
      const dy = sh.h + j * 13;
      ctx.globalAlpha = 0.3 - j * 0.07;
      ctx.fillRect(x - 1 + dy * slope, y + dy, sh.w + 2, 13);
    }
    ctx.globalAlpha = 0.45;
    ctx.fillRect(x - 3, y - 4, sh.w + 6, sh.h + 10);
  }
  ctx.restore();
  ctx.fillStyle = C.white;
  for (let i = 0; i < shots.count; i++) {
    const sh = shots.items[i];
    ctx.fillRect(sh.x + sh.vx * live, sh.y + sh.vy * live, sh.w, sh.h);
  }

  /* drops */
  const pulse = 0.6 + 0.4 * Math.sin(G.t * 9);
  for (let i = 0; i < drops.count; i++) {
    const d = drops.items[i];
    const col = C[DROP_COL[d.kind]];
    const y = d.y + d.vy * live;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * pulse;
    ctx.fillStyle = col;
    ctx.fillRect(d.x - 5, y - 5, d.w + 10, d.h + 10);
    ctx.restore();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(d.x, y, d.w, d.h);
    text(DROP_CHAR[d.kind], d.x + d.w / 2, y + d.h * 0.76, 17, col, 'center');
  }

  if (G.state !== 'dead' && G.state !== 'over') drawPlayer(live);
}

function drawBoss(): void {
  if (!boss.active) return;
  const cx = boss.x + boss.w / 2;
  const y = boss.y + Math.sin(boss.t * 2.2) * 6;
  const dying = boss.dying > 0;
  /* flickers out while dying, blinks while shielded */
  if (dying && !saved.calm && Math.floor(G.t * 30) % 2) return;
  const shielded = boss.shield > 0 || boss.y < BOSS_Y;
  const col = boss.flash > 0 || dying ? C.white : C[BOSS_COL[boss.phase]];
  ctx.globalAlpha = shielded && (saved.calm || Math.floor(G.t * 16) % 2) ? 0.45 : 1;
  blit(SP.carrier, col, boss.x + (dying ? rand(-6, 6) : 0), y, boss.w, boss.h, 0.4);
  ctx.globalAlpha = 1;
  if (dying) return;

  /* core: the eye in the middle glows hotter each phase */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = C.white;
  ctx.globalAlpha = 0.35 + 0.25 * Math.sin(G.t * (6 + boss.phase * 5));
  ctx.fillRect(cx - boss.w * 0.09, y + boss.h * 0.455, boss.w * 0.18, boss.h * 0.18);
  ctx.restore();

  /* health bar, split into its three phases */
  const bw = boss.w * 0.8, bx = cx - bw / 2, by = boss.y - 22;
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.fillRect(bx, by, bw, 6);
  ctx.fillStyle = C[BOSS_COL[boss.phase]];
  ctx.fillRect(bx, by, bw * (boss.hp / boss.max), 6);
  ctx.fillStyle = C.bg1;
  ctx.fillRect(bx + bw * 0.33, by, 2, 6);
  ctx.fillRect(bx + bw * 0.66, by, 2, 6);
}

function drawPlayer(live: number): void {
  const px = clamp(player.x + player.vx * live, 0, V.w - player.w);
  const cx = px + player.w / 2;
  const blink = !saved.calm && player.inv > 0 && player.inv < 1.2 && Math.floor(G.t * 14) % 2 === 0;
  if (!blink) {
    /* banks into a turn: the hull narrows as it gathers speed */
    const w = player.w * (1 - 0.14 * Math.min(1, Math.abs(player.vx) / 640));
    blit(SP.ship, player.inv > 0 ? C.amber : C.ink, cx - w / 2, player.y, w, player.h, 0.4);
    for (let i = 0; i < run.wingman; i++) {
      const dw = player.w * 0.5, dh = player.h * 0.5;
      blit(SP.ship, C.acid, droneX(i, cx) - dw / 2, player.y + player.h * 0.45 + Math.sin(G.t * 5 + i * 2) * 3, dw, dh, 0.4);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    /* thruster: hot plume with a white core */
    const th = 7 + Math.abs(player.vx) / 60 + rand(0, 6);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = C.hot;
    ctx.fillRect(cx - player.w * 0.1, player.y + player.h, player.w * 0.2, th);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = C.white;
    ctx.fillRect(cx - player.w * 0.04, player.y + player.h, player.w * 0.08, th * 0.55);
    /* muzzle flash */
    if (player.flash > 0) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = C.white;
      ctx.fillRect(cx - 5, player.y - 16, 10, 16);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = C.ink;
      ctx.fillRect(cx - 13, player.y - 10, 26, 10);
    }
    ctx.restore();
  }
  if (player.inv > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = 0.22 + 0.16 * Math.sin(G.t * 11);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.amber;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(cx, player.y + player.h / 2, player.w * 0.85, player.h * 1.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = a * 0.4;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.restore();
  }
}

/* particles, ring flashes and floating labels — drawn in every state */
function drawEffects(ahead: number): void {
  ctx.save();
  ctx.globalCompositeOperation = theme.dark ? 'lighter' : 'source-over';
  for (let i = 0; i < parts.count; i++) {
    const p = parts.items[i];
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x + p.vx * ahead, p.y + p.vy * ahead, p.sz, p.sz);
  }
  for (let i = 0; i < rings.count; i++) {
    const r = rings.items[i];
    const k = r.life / r.max;
    ctx.globalAlpha = k;
    ctx.strokeStyle = r.col;
    ctx.lineWidth = 1 + 5 * k;
    ctx.beginPath();
    ctx.arc(r.x, r.y, lerp(r.r1, r.r0, k * k), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  for (let i = 0; i < popups.count; i++) {
    const p = popups.items[i];
    ctx.globalAlpha = clamp(p.life * 3, 0, 1);
    text(p.str, p.x, p.y, p.size, p.col, 'center');
  }
  ctx.globalAlpha = 1;
}

/* 2D stand-in for the shader's glitch tear, used only without WebGL. */
function glitchPass(): void {
  const a = clamp(fx.glitch / 0.5, 0, 1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const y = randi(0, cv.height - 4);
    const h = randi(4, Math.max(8, cv.height * 0.09));
    const dx = (Math.random() - 0.5) * 90 * a * view.dpr;
    ctx.globalAlpha = 0.4 * a;
    ctx.drawImage(cv, 0, y, cv.width, h, dx, y, cv.width, h);
  }
  ctx.globalAlpha = 0.16 * a;
  ctx.fillStyle = C.hot;
  ctx.fillRect(0, randi(0, cv.height), cv.width, randi(2, 10));
  ctx.restore();
}
