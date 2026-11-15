import { ctx } from '../core/view';
import { SPRITE_ROWS } from '../data/sprites';

export type Sprite = HTMLCanvasElement;

const ids = new WeakMap<Sprite, number>();
const pixels = new WeakMap<Sprite, number[]>();
let nextId = 0;

function sprite(rows: readonly string[]): Sprite {
  const h = rows.length;
  const w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  const px: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (rows[y][x] !== '.') {
        g.fillRect(x, y, 1, 1);
        px.push(x, y);
      }
  ids.set(c, ++nextId);
  pixels.set(c, px);
  return c;
}

/* Flat (x, y) list of a sprite's set pixels — used to shatter it into debris. */
export const pixelsOf = (s: Sprite): number[] => pixels.get(s) || [];

/* One tinted copy per (sprite, colour). Only for immutable sprites drawn in a
   small fixed set of colours, so the cache stays tiny. */
const tintCache = new Map<string, Sprite>();
function tint(s: Sprite, color: string): Sprite {
  const k = ids.get(s) + '|' + color;
  let c = tintCache.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = s.width;
    c.height = s.height;
    const g = c.getContext('2d')!;
    g.drawImage(s, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    tintCache.set(k, c);
  }
  return c;
}

/* The halo drawn by blit() stands in for bloom. When the real bloom pass is
   running it is turned down so the two don't stack. */
let glowScale = 1;
export function setGlowScale(s: number): void {
  glowScale = s;
}

export function blit(s: Sprite, color: string, x: number, y: number, w: number, h: number, glow = 0): void {
  const t = tint(s, color);
  if (glow) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow * glowScale;
    ctx.drawImage(t, x - w * 0.14, y - h * 0.14, w * 1.28, h * 1.28);
    ctx.restore();
  }
  ctx.drawImage(t, x, y, w, h);
}

const frames = (f: readonly (readonly string[])[]): Sprite[] => f.map(sprite);

export const SP = {
  watcher: frames(SPRITE_ROWS.watcher),
  receiver: frames(SPRITE_ROWS.receiver),
  corruptor: frames(SPRITE_ROWS.corruptor),
  bulwark: frames(SPRITE_ROWS.bulwark),
  splitter: frames(SPRITE_ROWS.splitter),
  lobber: frames(SPRITE_ROWS.lobber),
  sniper: frames(SPRITE_ROWS.sniper),
  shard: frames(SPRITE_ROWS.shard),
  carrier: sprite(SPRITE_ROWS.carrier),
  ship: sprite(SPRITE_ROWS.ship),
  relay: sprite(SPRITE_ROWS.relay),
  bomb: frames(SPRITE_ROWS.bomb),
  bombAlt: frames(SPRITE_ROWS.bombAlt),
};
