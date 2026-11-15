import { audio, bootAudio, duckMusic, panOf, resumeAudio, setAudioOn } from './engine';

/* Sound effects. Every call takes an optional world x so the sound sits where
   the thing is on screen; pitches are nudged at random so repeats don't sound
   stamped out. */

interface Opt {
  delay?: number;
  x?: number; // world x, for stereo position
  rev?: number; // reverb send, 0..1
}

interface UfoNode {
  o: OscillatorNode;
  lfo: OscillatorNode;
  g: GainNode;
  pan: StereoPannerNode | null;
}
let ufoNode: UfoNode | null = null;
let stepIx = 0;

const vary = (f: number, amount = 0.05): number => f * (1 + (Math.random() * 2 - 1) * amount);

/* Stops one sound firing dozens of times in the same instant (a pulse can
   destroy twenty enemies in a single tick). */
const lastPlayed: Record<string, number> = {};
function gate(name: string, gap: number): boolean {
  const ac = audio.ac;
  if (!ac || !audio.on) return false;
  if (ac.currentTime - (lastPlayed[name] || 0) < gap) return false;
  lastPlayed[name] = ac.currentTime;
  return true;
}

function route(node: AudioNode, o: Opt): void {
  const ac = audio.ac!;
  let tail = node;
  if (o.x !== undefined && ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = panOf(o.x);
    tail.connect(p);
    tail = p;
  }
  tail.connect(audio.sfx!);
  if (o.rev) {
    const g = ac.createGain();
    g.gain.value = o.rev;
    tail.connect(g);
    g.connect(audio.reverb!);
  }
}

function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, o: Opt = {}): void {
  const ac = audio.ac;
  if (!audio.on || !ac) return;
  const t = ac.currentTime + (o.delay || 0);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  route(g, o);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, f0: number, f1: number, vol: number, o: Opt = {}): void {
  const ac = audio.ac;
  if (!audio.on || !ac || !audio.noise) return;
  const t = ac.currentTime + (o.delay || 0);
  const s = ac.createBufferSource();
  s.buffer = audio.noise;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  route(g, o);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur);
}

const STEP_NOTES = [110, 98, 87, 78];

export const Snd = {
  get on(): boolean {
    return audio.on;
  },
  set on(v: boolean) {
    audio.on = v;
  },
  boot: bootAudio,
  resume: resumeAudio,
  setOn(on: boolean): void {
    if (!on) this.ufoStop();
    setAudioOn(on);
  },

  shoot(x?: number): void {
    if (gate('shoot', 0.03)) tone(vary(900), 180, 0.1, 'square', 0.055, { x });
  },
  /* the formation's footstep: felt more than heard under the music */
  step(): void {
    if (!gate('step', 0.075)) return;
    const n = STEP_NOTES[stepIx++ % 4];
    tone(n, n * 0.94, 0.09, 'triangle', 0.07);
  },
  kill(x?: number): void {
    if (!gate('kill', 0.035)) return;
    noise(0.22, vary(2600, 0.2), 220, 0.2, { x, rev: 0.25 });
    tone(vary(420, 0.15), 120, 0.14, 'square', 0.05, { x });
  },
  hurt(x?: number): void {
    duckMusic(0.2, 1.1);
    noise(0.55, 900, 80, 0.34, { x, rev: 0.5 });
    tone(200, 40, 0.5, 'sawtooth', 0.16, { x });
  },
  drop(): void {
    tone(70, 52, 0.14, 'square', 0.09);
  },
  power(x?: number): void {
    [523, 659, 880].forEach((f, i) => tone(f, f, 0.1, 'square', 0.08, { x, delay: i * 0.055, rev: 0.2 }));
  },
  wave(): void {
    duckMusic(0.5, 0.8);
    [330, 440, 554, 660, 880].forEach((f, i) => tone(f, f, 0.13, 'triangle', 0.1, { delay: i * 0.075, rev: 0.3 }));
  },
  over(): void {
    [440, 392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.7, 0.32, 'sawtooth', 0.1, { delay: i * 0.16, rev: 0.4 }));
  },
  clank(x?: number): void {
    if (gate('clank', 0.04)) tone(vary(1500, 0.08), 700, 0.06, 'square', 0.055, { x });
  },
  graze(x?: number): void {
    if (gate('graze', 0.05)) tone(vary(1900, 0.06), 2600, 0.07, 'sine', 0.05, { x, rev: 0.3 });
  },
  aim(x?: number): void {
    if (!gate('aim', 0.1)) return;
    tone(1250, 1250, 0.07, 'sine', 0.05, { x });
    tone(1250, 1250, 0.07, 'sine', 0.05, { x, delay: 0.14 });
  },
  bolt(x?: number): void {
    tone(vary(1800), 300, 0.12, 'sawtooth', 0.06, { x, rev: 0.2 });
  },
  lob(x?: number): void {
    tone(vary(220), 90, 0.2, 'triangle', 0.09, { x });
  },
  ready(): void {
    [660, 990, 1320].forEach((f, i) => tone(f, f, 0.09, 'square', 0.07, { delay: i * 0.06, rev: 0.3 }));
  },
  pulse(x?: number): void {
    duckMusic(0.15, 1.2);
    noise(0.7, 3200, 90, 0.32, { x, rev: 0.7 });
    tone(140, 36, 0.7, 'sine', 0.22, { x });
  },
  bossHit(x?: number): void {
    if (gate('bossHit', 0.04)) tone(vary(190, 0.1), 95, 0.05, 'square', 0.05, { x });
  },
  bossDown(x?: number): void {
    duckMusic(0.1, 2.2);
    noise(1.4, 1800, 60, 0.36, { x, rev: 0.8 });
    [392, 330, 262, 196, 131].forEach((f, i) => tone(f, f * 0.6, 0.4, 'sawtooth', 0.1, { delay: i * 0.18, rev: 0.5 }));
  },
  relayDown(x?: number): void {
    duckMusic(0.4, 0.6);
    noise(0.35, 3000, 200, 0.26, { x, rev: 0.5 });
    [880, 1109, 1319].forEach((f, i) => tone(f, f, 0.09, 'square', 0.06, { x, delay: i * 0.05 }));
  },
  pick(): void {
    tone(660, 660, 0.04, 'square', 0.04);
  },

  /* The Relay's warble follows it across the stereo field. */
  ufoStart(): void {
    const ac = audio.ac;
    if (!audio.on || !ac || ufoNode) return;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    const lfo = ac.createOscillator();
    const la = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 520;
    lfo.type = 'sine';
    lfo.frequency.value = 11;
    la.gain.value = 140;
    lfo.connect(la);
    la.connect(o.frequency);
    g.gain.value = 0.04;
    o.connect(g);
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (pan) {
      g.connect(pan);
      pan.connect(audio.sfx!);
    } else g.connect(audio.sfx!);
    o.start(t);
    lfo.start(t);
    ufoNode = { o, lfo, g, pan };
  },
  ufoPan(x: number): void {
    if (ufoNode && ufoNode.pan) ufoNode.pan.pan.value = panOf(x);
  },
  ufoStop(): void {
    const ac = audio.ac;
    if (!ufoNode || !ac) return;
    const { o, lfo, g } = ufoNode;
    const t = ac.currentTime;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.stop(t + 0.2);
    lfo.stop(t + 0.2);
    ufoNode = null;
  },
};
