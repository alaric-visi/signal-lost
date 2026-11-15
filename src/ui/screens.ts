import { keyLabel, touch } from '../core/input';
import { saved } from '../core/storage';
import { V, ctx } from '../core/view';
import { dateKey } from '../game/leaderboard';
import { ACHIEVEMENTS, unlocked } from '../game/records';
import { ROWS, activate, rowRect, setSlider, settings } from '../game/settings';
import { G } from '../game/state';
import { C } from '../gfx/palette';
import { text } from '../gfx/text';
import { addHot } from './hot';

/* Full-screen menus: settings and records. */

const rect = { x: 0, y: 0, w: 0, h: 0 };
const PIPS = 10, PIP_W = 14, PIP_GAP = 5;
const BAR_W = PIPS * PIP_W + (PIPS - 1) * PIP_GAP;

export function veil(alpha: number): void {
  ctx.fillStyle = `rgba(4,1,10,${alpha})`;
  ctx.fillRect(-V.w, -V.h, V.w * 3, V.h * 3);
}

export function drawSettings(): void {
  veil(0.88);
  const cx = V.w / 2;
  text('SETTINGS', cx, V.h * 0.16, 44, C.ink, 'center');

  for (let i = 0; i < ROWS.length; i++) {
    const row = ROWS[i];
    rowRect(i, rect);
    const { x, y, w, h } = rect;
    const sel = i === settings.sel;
    const col = sel ? C.acid : C.ink;
    const base = y + h * 0.7;
    const right = x + w - 18;

    if (sel) {
      ctx.fillStyle = 'rgba(168,255,54,.09)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = C.acid;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }

    if (row.kind === 'back') {
      text(row.label, cx, base, 18, col, 'center');
      addHot(x, y, w, h, () => activate(i));
      continue;
    }
    text(row.label, x + 18, base, 17, col);

    if (row.kind === 'slider') {
      const v = saved[row.key];
      const bx = right - BAR_W;
      for (let j = 0; j < PIPS; j++) {
        ctx.fillStyle = j < v ? col : 'rgba(255,255,255,.14)';
        ctx.fillRect(bx + j * (PIP_W + PIP_GAP), y + h * 0.28, PIP_W, h * 0.44);
      }
      /* tap along the bar to set it; tap the label just to select the row */
      addHot(x, y, w, h, (px) => {
        settings.sel = i;
        if (px >= bx - PIP_W) setSlider(row, Math.ceil(((px - bx) / BAR_W) * PIPS));
      });
    } else if (row.kind === 'toggle') {
      text(saved[row.key] ? 'ON' : 'OFF', right, base, 17, saved[row.key] ? C.acid : C.dim, 'right');
      addHot(x, y, w, h, () => activate(i));
    } else {
      const waiting = settings.listening === row.action;
      text(
        waiting ? (Math.floor(G.t * 3) % 2 ? 'PRESS A KEY' : '') : keyLabel(saved.keys[row.action]),
        right, base, 17, waiting ? C.amber : C.white, 'right',
      );
      addHot(x, y, w, h, () => activate(i));
    }
  }

  rowRect(ROWS.length, rect);
  text(
    touch.used ? 'TAP A ROW TO CHANGE IT' : 'UP/DOWN SELECT · ← → ADJUST · SPACE CHANGE · ESC BACK',
    cx, rect.y + 30, 13, C.dim, 'center',
  );
}

export function drawRecords(): void {
  veil(0.9);
  const cx = V.w / 2;
  const wide = V.w >= 1100;
  text('RECORDS', cx, V.h * 0.12, 44, C.ink, 'center');

  /* ---- scores ---- */
  const sx = wide ? cx - 460 : cx - 250;
  let y = V.h * 0.2;
  text('TOP SCORES', sx, y, 18, C.amber);
  y += 12;
  if (!saved.scores.length) text('NO RUNS YET', sx, y + 28, 15, C.dim);
  for (let i = 0; i < saved.scores.length; i++) {
    const s = saved.scores[i];
    y += 27;
    const col = i === 0 ? C.acid : C.white;
    text(String(i + 1).padStart(2, ' '), sx, y, 15, C.dim);
    text(String(s.score).padStart(6, '0'), sx + 44, y, 15, col);
    text('W' + String(s.wave).padStart(2, '0'), sx + 150, y, 15, C.ink);
    text(s.date, sx + 212, y, 15, C.dim);
    if (s.daily) text('DAILY', sx + 340, y, 12, C.amber);
  }
  const today = saved.daily.date === dateKey() ? saved.daily.best : 0;
  text('DAILY BEST TODAY  ' + (today || '-'), sx, V.h * 0.2 + 12 + 27 * 10 + 40, 15, C.amber);

  /* ---- achievements ---- */
  const ax = wide ? cx + 30 : sx;
  y = wide ? V.h * 0.2 : V.h * 0.2 + 12 + 27 * 10 + 86;
  const have = ACHIEVEMENTS.filter((a) => unlocked(a.id)).length;
  text('ACHIEVEMENTS  ' + have + '/' + ACHIEVEMENTS.length, ax, y, 18, C.amber);
  y += 10;
  for (const a of ACHIEVEMENTS) {
    y += 30;
    const got = unlocked(a.id);
    ctx.fillStyle = got ? C.amber : 'rgba(255,255,255,.16)';
    ctx.fillRect(ax, y - 11, 11, 11);
    text(a.name, ax + 24, y, 14, got ? C.white : C.dim);
    text(a.desc, ax + 190, y, 11, got ? C.ink : C.dim);
  }

  text(touch.used ? 'TAP TO GO BACK' : 'PRESS ANY KEY', cx, V.h * 0.96, 14, C.dim, 'center');
  addHot(-V.w, -V.h, V.w * 3, V.h * 3, () => {
    G.state = G.back;
  });
}
