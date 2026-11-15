import { cv, screenEl } from '../core/view';

/* Post-processing. The 2D scene canvas is uploaded as a texture each frame and
   run through: bright-pass -> two-level blur (bloom) -> a final pass that adds
   bloom, CRT curvature, chromatic aberration, scanlines, vignette, grain,
   glitch tearing and shockwave distortion.
   Without WebGL the scene is copied straight to the screen instead. */

export const post = { active: false };

export interface PostParams {
  time: number;
  crt: number; // 0 or 1: the CRT filter toggle
  glitch: number; // 0..1
  light: number; // 0 or 1: light theme
  dpr: number;
  waves: Float32Array; // 4 x (u, v, radius, strength); u/v in GL texture space
}

const VS = `
attribute vec2 p;
varying vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

/* 2x2 box downsample that keeps only what is bright enough to glow. */
const FS_BRIGHT = `
precision mediump float;
varying vec2 uv;
uniform sampler2D t;
uniform vec2 px;
void main(){
  vec3 c = (texture2D(t, uv + px * vec2(-0.5, -0.5)).rgb + texture2D(t, uv + px * vec2(0.5, -0.5)).rgb +
            texture2D(t, uv + px * vec2(-0.5, 0.5)).rgb + texture2D(t, uv + px * vec2(0.5, 0.5)).rgb) * 0.25;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(0.22, 0.8, l), 1.0);
}`;

/* 9-tap gaussian in 5 bilinear samples. */
const FS_BLUR = `
precision mediump float;
varying vec2 uv;
uniform sampler2D t;
uniform vec2 dir;
void main(){
  vec3 c = texture2D(t, uv).rgb * 0.227027;
  c += (texture2D(t, uv + dir * 1.3846).rgb + texture2D(t, uv - dir * 1.3846).rgb) * 0.316216;
  c += (texture2D(t, uv + dir * 3.2308).rgb + texture2D(t, uv - dir * 3.2308).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`;

const FS_FINAL = `
precision highp float;
varying vec2 uv;
uniform sampler2D scene;
uniform sampler2D bloomA;
uniform sampler2D bloomB;
uniform vec2 res;
uniform float time;
uniform float crt;
uniform float glitch;
uniform float light;
uniform float dpr;
uniform vec4 waves[4];

float hash(float n){ return fract(sin(n) * 43758.5453); }

void main(){
  /* barrel curvature */
  vec2 u = uv * 2.0 - 1.0;
  u += u * (u.yx * u.yx) * vec2(0.022, 0.034) * crt;
  u = u * 0.5 + 0.5;
  vec3 edge = mix(vec3(0.0), vec3(0.86, 0.89, 0.93), light);
  if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0) { gl_FragColor = vec4(edge, 1.0); return; }

  /* shockwaves: an expanding ring that pushes pixels outward */
  float asp = res.x / res.y;
  for (int i = 0; i < 4; i++) {
    vec4 w = waves[i];
    if (w.w <= 0.0) continue;
    vec2 d = u - w.xy;
    d.x *= asp;
    float band = length(d) - w.z;
    float f = exp(-band * band * 700.0) * w.w;
    u += normalize(d + 1e-5) / vec2(asp, 1.0) * f * 0.03;
  }

  /* glitch: tear random rows sideways */
  if (glitch > 0.0) {
    float row = floor(u.y * 26.0);
    float r = hash(row + floor(time * 30.0) * 7.13);
    if (r > 1.0 - glitch * 0.45) u.x += (hash(row * 3.7 + floor(time * 30.0)) - 0.5) * 0.14 * glitch;
  }

  /* chromatic aberration grows toward the edges and with glitch */
  vec2 c = u - 0.5;
  vec2 off = c * dot(c, c) * 0.012 * crt + vec2(glitch * 0.007, 0.0);
  vec3 col = vec3(texture2D(scene, u + off).r, texture2D(scene, u).g, texture2D(scene, u - off).b);

  vec3 glow = texture2D(bloomA, u).rgb * 0.6 + texture2D(bloomB, u).rgb * 0.75;
  col += glow * (1.0 - light);

  float line = 0.5 + 0.5 * sin(gl_FragCoord.y / dpr * 2.0944);
  col *= 1.0 - crt * line * mix(0.2, 0.05, light);

  float v = smoothstep(0.45, 1.25, length(c * vec2(1.7, 2.0)));
  col = mix(col, mix(vec3(0.01, 0.0, 0.03), vec3(1.0), light), v * mix(0.8, 0.45, light) * crt);

  col += (hash(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + time) - 0.5) * 0.03 * crt;
  gl_FragColor = vec4(col, 1.0);
}`;

interface Prog {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}
interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

let gl: WebGLRenderingContext | null = null;
let flat: CanvasRenderingContext2D | null = null;
let pBright: Prog, pBlur: Prog, pFinal: Prog;
let sceneTex: WebGLTexture;
let targets: Target[] = [];

function shader(g: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = g.createShader(type)!;
  g.shaderSource(s, src);
  g.compileShader(s);
  if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) || 'shader');
  return s;
}

function program(g: WebGLRenderingContext, fs: string, uniforms: string[]): Prog {
  const p = g.createProgram()!;
  g.attachShader(p, shader(g, g.VERTEX_SHADER, VS));
  g.attachShader(p, shader(g, g.FRAGMENT_SHADER, fs));
  g.bindAttribLocation(p, 0, 'p');
  g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p) || 'link');
  const u: Prog['u'] = {};
  for (const n of uniforms) u[n] = g.getUniformLocation(p, n);
  return { p, u };
}

function texture(g: WebGLRenderingContext): WebGLTexture {
  const t = g.createTexture()!;
  g.bindTexture(g.TEXTURE_2D, t);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  return t;
}

function setup(g: WebGLRenderingContext): void {
  pBright = program(g, FS_BRIGHT, ['t', 'px']);
  pBlur = program(g, FS_BLUR, ['t', 'dir']);
  pFinal = program(g, FS_FINAL, [
    'scene', 'bloomA', 'bloomB', 'res', 'time', 'crt', 'glitch', 'light', 'dpr', 'waves',
  ]);
  const buf = g.createBuffer();
  g.bindBuffer(g.ARRAY_BUFFER, buf);
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
  g.enableVertexAttribArray(0);
  g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
  g.disable(g.DEPTH_TEST);
  g.disable(g.BLEND);
  sceneTex = texture(g);
  targets = [];
  resizePost();
}

/* Bloom buffers: [0] half-res bright pass, [1,2] quarter-res, [3,4] eighth. */
export function resizePost(): void {
  const g = gl;
  if (!g) return;
  for (const t of targets) {
    g.deleteFramebuffer(t.fb);
    g.deleteTexture(t.tex);
  }
  targets = [2, 4, 4, 8, 8].map((div) => {
    const w = Math.max(1, Math.floor(cv.width / div));
    const h = Math.max(1, Math.floor(cv.height / div));
    const tex = texture(g);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
    const fb = g.createFramebuffer()!;
    g.bindFramebuffer(g.FRAMEBUFFER, fb);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
    return { fb, tex, w, h };
  });
  g.bindFramebuffer(g.FRAMEBUFFER, null);
}

/* Shows the scene canvas itself, stacked over the dead WebGL canvas. */
function showSceneDirectly(): void {
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;image-rendering:pixelated';
  screenEl.after(cv);
}

export function initPost(): void {
  let g: WebGLRenderingContext | null = null;
  try {
    g = screenEl.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'high-performance',
    });
  } catch {
    g = null;
  }
  if (!g) {
    flat = screenEl.getContext('2d', { alpha: false });
    return;
  }
  try {
    gl = g;
    setup(g);
    post.active = true;
  } catch (err) {
    console.warn('Post-processing unavailable, drawing without it.', err);
    gl = null;
    showSceneDirectly();
    return;
  }
  screenEl.addEventListener('webglcontextlost', (e) => e.preventDefault());
  screenEl.addEventListener('webglcontextrestored', () => {
    if (gl) setup(gl);
  });
}

function draw(g: WebGLRenderingContext, target: Target | null): void {
  g.bindFramebuffer(g.FRAMEBUFFER, target ? target.fb : null);
  if (target) g.viewport(0, 0, target.w, target.h);
  else g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
  g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
}

function blur(g: WebGLRenderingContext, src: Target, dst: Target, dx: number, dy: number): void {
  g.bindTexture(g.TEXTURE_2D, src.tex);
  g.uniform2f(pBlur.u.dir, dx, dy);
  draw(g, dst);
}

export function present(o: PostParams): void {
  const g = gl;
  if (!g) {
    if (flat) flat.drawImage(cv, 0, 0);
    return;
  }
  if (g.isContextLost() || targets.length < 5) return;
  const [a, b1, b2, c1, c2] = targets;

  g.activeTexture(g.TEXTURE0);
  g.bindTexture(g.TEXTURE_2D, sceneTex);
  g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, 1);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, cv);

  g.useProgram(pBright.p);
  g.uniform1i(pBright.u.t, 0);
  g.uniform2f(pBright.u.px, 1 / cv.width, 1 / cv.height);
  draw(g, a);

  g.useProgram(pBlur.p);
  g.uniform1i(pBlur.u.t, 0);
  blur(g, a, b1, 1 / b1.w, 0);
  blur(g, b1, b2, 0, 1 / b2.h);
  blur(g, b2, c1, 1 / c1.w, 0);
  blur(g, c1, c2, 0, 1 / c2.h);

  g.useProgram(pFinal.p);
  g.activeTexture(g.TEXTURE2);
  g.bindTexture(g.TEXTURE_2D, c2.tex);
  g.activeTexture(g.TEXTURE1);
  g.bindTexture(g.TEXTURE_2D, b2.tex);
  g.activeTexture(g.TEXTURE0);
  g.bindTexture(g.TEXTURE_2D, sceneTex);
  g.uniform1i(pFinal.u.scene, 0);
  g.uniform1i(pFinal.u.bloomA, 1);
  g.uniform1i(pFinal.u.bloomB, 2);
  g.uniform2f(pFinal.u.res, cv.width, cv.height);
  g.uniform1f(pFinal.u.time, o.time % 1000);
  g.uniform1f(pFinal.u.crt, o.crt);
  g.uniform1f(pFinal.u.glitch, o.glitch);
  g.uniform1f(pFinal.u.light, o.light);
  g.uniform1f(pFinal.u.dpr, o.dpr);
  g.uniform4fv(pFinal.u.waves, o.waves);
  draw(g, null);
}
