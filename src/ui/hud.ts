import { keyLabel, touch } from '../core/input';
import { saved } from '../core/storage';
import { V, ctx } from '../core/view';
import { isBossWave } from '../data/waves';
import { mult } from '../game/charge';
import { firePulse } from '../game/combat';
import { last, toast } from '../game/records';
import { openSettings } from '../game/settings';
import { openRecords, reset } from '../game/update';
import { WEAPON_LABEL } from '../game/extras';
import { G, TYPES, WEAPON_TIME, player, surging } from '../game/state';
import { cardRect, cardsStacked, offer, owned } from '../game/upgrades';
import { C, cycle } from '../gfx/palette';
import { SP, blit } from '../gfx/sprites';
import { text } from '../gfx/text';
import { addHot, clearHot } from './hot';
import { drawRecords, drawSettings, veil } from './screens';

/* Colours cycle on everything while the signal meter is full. */
export function surgeCol(base: string, seed: number): string {
  return surging() && !saved.calm ? cycle(G.t, 11, seed) : base;
}

const pad5 = (n: number): string => String(n).padStart(5, '0');
const blinkOn = (): boolean => Math.floor(G.t * 2) % 2 === 0;
const PROMPT_DIM = 'rgba(168,255,54,.28)';
const WEAPON_COL = ['ink', 'ink', 'hot', 'violet', 'frost'] as const;
const MULT_COL = ['dim', 'ink', 'acid', 'amber'] as const;

function startPrompt(verb: string): string {
  if (touch.used) return `TAP TO ${verb}`;
  return document.hasFocus() ? `PRESS SPACE TO ${verb}` : 'CLICK HERE, THEN PRESS SPACE';
}

/* A row of tappable text links, each with its keyboard shortcut. */
function links(y: number, items: readonly (readonly [string, string, () => void])[]): void {
  const gap = Math.min(250, V.w * 0.31);
  const x0 = V.w / 2 - (gap * (items.length - 1)) / 2;
  items.forEach(([key, label, act], i) => {
    const x = x0 + gap * i;
    text(touch.used ? label : key + ' ' + label, x, y, 14, C.ink, 'center');
    addHot(x - gap / 2 + 5, y - 30, gap - 10, 46, act);
  });
}

const TAGLINE = 'THEY CAME DOWN THROUGH THE CARRIER WAVE';

function drawMenu(): void {
  const cx = V.w / 2;
  const top = V.h * 0.25;

  /* title drops in, one word after the other */
  ctx.save();
  ctx.globalAlpha = 0.92 * Math.min(1, G.t * 2.5);
  text('SIGNAL', cx, top, 92, C.hot, 'center');
  ctx.globalAlpha = 0.92 * Math.min(1, Math.max(0, (G.t - 0.35) * 2.5));
  text('LOST', cx, top + 90, 92, C.ink, 'center');
  ctx.restore();

  /* tagline types itself out */
  const typed = Math.max(0, Math.floor((G.t - 0.9) * 26));
  text(TAGLINE.slice(0, typed), cx, top + 142, 18, C.dim, 'center');

  /* the cast and what each is worth */
  const frame = Math.floor(G.t * 2.2) % 2;
  const gap = Math.min(190, V.w * 0.21);
  const y = V.h * 0.5;
  const x0 = cx - gap * 1.5;
  for (let i = 0; i < 4; i++) {
    if (G.t < 1.6 + i * 0.22) break;
    const x = x0 + gap * i;
    const bob = Math.sin(G.t * 3 + i * 1.4) * 4;
    if (i < 3) {
      const T = TYPES[i];
      const s = T.sp[frame];
      const w = 46, h = w * (s.height / s.width);
      blit(s, C[T.col], x - 48, y + bob - h / 2, w, h, 0.3);
      text('=' + T.pts, x + 6, y + 9, 18, C[T.col]);
    } else {
      const w = 58, h = w * (7 / 16);
      blit(SP.relay, cycle(G.t, 8), x - 60, y + bob - h / 2, w, h, 0.4);
      text('=???', x + 6, y + 9, 18, C.amber);
    }
  }

  text(startPrompt('BEGIN'), cx, V.h * 0.635, 26, blinkOn() ? C.acid : PROMPT_DIM, 'center');
  const k = saved.keys;
  text(
    touch.used
      ? 'DRAG TO STEER  ·  HOLD TO FIRE'
      : `${keyLabel(k.left)} ${keyLabel(k.right)} MOVE   ${keyLabel(k.fire)} FIRE   ${keyLabel(k.pulse)} PULSE   P PAUSE`,
    cx, V.h * 0.635 + 50, 16, C.dim, 'center',
  );
  links(V.h * 0.635 + 104, [
    ['D', 'DAILY RUN', () => reset(true)],
    ['R', 'RECORDS', openRecords],
    ['O', 'SETTINGS', openSettings],
  ]);
  if (G.best) text('BEST  ' + G.best, cx, V.h * 0.635 + 150, 17, C.amber, 'center');
}

/* Signal meter: three segments, one per multiplier step. */
function drawMeter(cx: number): void {
  const w = 190, h = 7, x = cx - w / 2, y = 94;
  const m = mult();
  const full = surging();
  const col = full ? cycle(G.t, 13) : C[MULT_COL[m - 1]];
  ctx.fillStyle = 'rgba(142,246,255,.14)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w * G.charge, h);
  ctx.fillStyle = C.bg1;
  ctx.fillRect(x + w / 3 - 1, y, 2, h);
  ctx.fillRect(x + (w * 2) / 3 - 1, y, 2, h);
  text('×' + m, x + w + 12, y + 10, 17, col);
  if (full && blinkOn()) {
    text(touch.used ? 'PULSE READY' : 'PULSE READY · PRESS ' + keyLabel(saved.keys.pulse), cx, y + 30, 13, col, 'center');
  }
}

const rect = { x: 0, y: 0, w: 0, h: 0 };

function drawUpgrades(): void {
  veil(0.78);
  const cx = V.w / 2;
  text('WAVE CLEARED', cx, V.h * 0.22, 40, C.acid, 'center');
  text('CHOOSE AN UPGRADE', cx, V.h * 0.22 + 44, 18, C.dim, 'center');

  for (let i = 0; i < offer.cards.length; i++) {
    const u = offer.cards[i];
    cardRect(i, rect);
    const sel = i === offer.sel;
    const col = sel ? C.acid : C.ink;
    const stacked = cardsStacked();
    const lift = sel && !stacked ? -8 : 0;
    const x = rect.x, y = rect.y + lift, w = rect.w, h = rect.h;
    const mid = x + w / 2;

    ctx.fillStyle = sel ? 'rgba(168,255,54,.10)' : 'rgba(142,246,255,.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = col;
    ctx.globalAlpha = sel ? 1 : 0.45;
    ctx.lineWidth = sel ? 3 : 2;
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = 1;

    /* pips: how many of this you hold, out of the most you can */
    const pip = 12, gap = 6;
    const pipsW = u.max * pip + (u.max - 1) * gap;
    let pipX: number, pipY: number;
    if (stacked) {
      text(String(i + 1), x + 44, y + 76, 34, sel ? C.acid : C.dim, 'center');
      text(u.name, x + 92, y + 50, 22, col);
      text(u.desc[0] + (u.desc[1] ? ' ' + u.desc[1] : ''), x + 92, y + 88, 13, C.white);
      pipX = x + w - 24 - pipsW;
      pipY = y + 30;
    } else {
      text(String(i + 1), mid, y + 48, 30, sel ? C.acid : C.dim, 'center');
      text(u.name, mid, y + 104, 20, col, 'center');
      text(u.desc[0], mid, y + 146, 13, C.white, 'center');
      text(u.desc[1], mid, y + 168, 13, C.white, 'center');
      pipX = mid - pipsW / 2;
      pipY = y + h - 36;
    }
    const n = owned(u);
    for (let j = 0; j < u.max; j++) {
      ctx.fillStyle = j < n ? C.amber : 'rgba(255,255,255,.16)';
      ctx.fillRect(pipX + j * (pip + gap), pipY, pip, pip);
    }
  }

  if (offer.lock <= 0) {
    text(
      touch.used ? 'TAP A CARD' : '← → CHOOSE   SPACE CONFIRM   OR PRESS 1-3',
      cx, rect.y + rect.h + 56, 15, blinkOn() ? C.acid : PROMPT_DIM, 'center',
    );
  }
}

/* On touch screens: a button for the pulse, lit when the meter is full. */
function drawPulseButton(): void {
  const r = 46, bx = V.w - 78, by = V.h - 200;
  const ready = surging();
  const col = ready ? C.acid : C.dim;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fillStyle = ready ? 'rgba(168,255,54,.16)' : 'rgba(142,246,255,.05)';
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = ready ? 3 : 2;
  ctx.stroke();
  /* fills like a dial as the meter charges */
  if (!ready && G.charge > 0) {
    ctx.beginPath();
    ctx.arc(bx, by, r - 6, -Math.PI / 2, -Math.PI / 2 + G.charge * Math.PI * 2);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  text('PULSE', bx, by + 6, 13, col, 'center');
  addHot(bx - r - 8, by - r - 8, r * 2 + 16, r * 2 + 16, firePulse);
}

function drawToast(cx: number): void {
  if (toast.t <= 0) return;
  ctx.globalAlpha = Math.min(1, toast.t * 2, (3.2 - toast.t) * 4);
  text('UNLOCKED · ' + toast.str, cx, 168, 18, C.amber, 'center');
  ctx.globalAlpha = 1;
}

export function drawHud(): void {
  clearHot();
  if (G.state === 'settings' && G.back === 'menu') {
    drawSettings();
    return;
  }
  if (G.state === 'records' && G.back === 'menu') {
    drawRecords();
    return;
  }
  if (G.state === 'menu') {
    drawMenu();
    drawToast(V.w / 2);
    return;
  }
  const pad = 28;
  const cx = V.w / 2;

  text('SCORE', pad, 44, 15, C.dim);
  /* best score sits under the score: the top-right corner belongs to the
     page's control buttons */
  text('BEST ' + pad5(G.best), pad, 104, 13, C.amber);
  if (G.daily) text('DAILY RUN', pad, 126, 12, C.amber);
  /* the counter runs white while it is still catching up */
  text(pad5(G.shown), pad, 78, 32, G.shown < G.score ? C.white : C.ink);

  text('WAVE', cx, 44, 15, C.dim, 'center');
  text(String(G.level).padStart(2, '0'), cx, 78, 32, surgeCol(C.violet, 1), 'center');
  drawMeter(cx);

  /* lives as ship icons */
  for (let i = 0; i < G.lives; i++) blit(SP.ship, C.ink, pad + i * 40, V.h - 46, 30, 16, 0.25);

  /* weapon timer */
  if (player.wt > 0) {
    const w = 180, x = V.w - pad - w, y = V.h - 42;
    const col = C[WEAPON_COL[player.weapon]];
    ctx.fillStyle = 'rgba(142,246,255,.15)';
    ctx.fillRect(x, y, w, 7);
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w * (player.wt / WEAPON_TIME), 7);
    text(WEAPON_LABEL[player.weapon], V.w - pad, y - 10, 14, col, 'right');
  }

  if (G.state === 'wave') {
    if (isBossWave(G.level)) {
      text('WARNING', cx, V.h / 2, 64, blinkOn() ? C.hot : C.ember, 'center');
      text('CARRIER INBOUND', cx, V.h / 2 + 44, 18, C.white, 'center');
    } else {
      text('WAVE ' + G.level, cx, V.h / 2, 64, C.acid, 'center');
      text('SIGNAL INCOMING', cx, V.h / 2 + 44, 18, C.dim, 'center');
    }
  }
  if (G.state === 'play' && touch.used) drawPulseButton();
  drawToast(cx);
  if (G.state === 'upgrade') drawUpgrades();
  if (G.state === 'pause') {
    veil(0.72);
    text('PAUSED', cx, V.h / 2, 58, C.ink, 'center');
    text(touch.used ? 'TAP TO RESUME' : 'PRESS P OR CLICK TO RESUME', cx, V.h / 2 + 46, 18, C.dim, 'center');
    links(V.h / 2 + 110, [['O', 'SETTINGS', openSettings]]);
  }
  if (G.state === 'settings') drawSettings();
  if (G.state === 'over') {
    veil(0.7);
    text('SIGNAL LOST', cx, V.h / 2 - 34, 68, cycle(G.t, 6), 'center');
    text('SCORE  ' + G.score, cx, V.h / 2 + 26, 28, C.white, 'center');
    text('WAVE ' + G.level + '  ·  BEST ' + G.best, cx, V.h / 2 + 64, 18, C.dim, 'center');
    if (last.newBest) text('NEW BEST', cx, V.h / 2 + 96, 18, C.amber, 'center');
    else if (last.rank) text('RANK ' + last.rank + ' ON THIS DEVICE', cx, V.h / 2 + 96, 15, C.ink, 'center');
    text(startPrompt('RETRY'), cx, V.h / 2 + 146, 24, blinkOn() ? C.acid : 'rgba(168,255,54,.25)', 'center');
    links(V.h / 2 + 200, [
      ['D', 'DAILY RUN', () => reset(true)],
      ['R', 'RECORDS', openRecords],
    ]);
  }
  if (G.state === 'records') drawRecords();
}
