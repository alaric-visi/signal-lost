import { audio, mix, onAudioBoot } from './engine';

/* Adaptive soundtrack: a 16-step sequencer over a four-bar chord loop. What
   plays depends on what the game is doing —
     tempo      rises as the wave thins out (and again for the boss)
     drums      kick, then snare, then busier hats as intensity climbs
     arpeggio   joins at x2, doubles speed at x3, gains a lead when the signal
                meter is full
     filter     opens as the meter fills, closes right down when paused
   Notes are scheduled slightly ahead on the audio clock, so timing stays tight
   even when the frame rate does not. */

export type MusicMode = 'menu' | 'calm' | 'play' | 'boss' | 'over' | 'pause';

const state = { mode: 'menu' as MusicMode, intensity: 0, charge: 0 };

const LOOKAHEAD = 0.14; // seconds scheduled in advance
const TICK_MS = 30;
const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

/* Each chord: bass root, then three chord tones for the arpeggio and pad. */
type Chord = readonly [number, number, number, number];
const PROG_PLAY: readonly Chord[] = [
  [33, 57, 60, 64], // A minor
  [29, 53, 57, 60], // F
  [36, 55, 60, 64], // C
  [31, 55, 59, 62], // G
];
const PROG_BOSS: readonly Chord[] = [
  [33, 57, 60, 64], // A minor
  [33, 57, 60, 63], // A diminished colour
  [29, 53, 56, 60], // F minor
  [28, 52, 56, 59], // E
];
const BASS_HITS = [1, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 1, 0, 0, 2, 0]; // 2 = octave up
const ARP_ORDER = [1, 2, 3, 2, 1, 3, 2, 3];

let timer = 0;
let nextTime = 0;
let step = 0;

function voice(
  freq: number, t: number, dur: number, type: OscillatorType, vol: number,
  rev = 0, attack = 0.005,
): void {
  const ac = audio.ac!;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(audio.musicIn!);
  if (rev) {
    const s = ac.createGain();
    s.gain.value = rev;
    g.connect(s);
    s.connect(audio.reverb!);
  }
  o.start(t);
  o.stop(t + dur + 0.05);
}

function kick(t: number, vol: number): void {
  const ac = audio.ac!;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g);
  g.connect(audio.musicIn!);
  o.start(t);
  o.stop(t + 0.22);
}

/* Filtered noise: a high, short one is a hat; lower and longer is a snare. */
function hiss(t: number, dur: number, cutoff: number, vol: number): void {
  const ac = audio.ac!;
  const s = ac.createBufferSource();
  s.buffer = audio.noise;
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = cutoff;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  /* drums bypass the music filter so they stay crisp when it closes */
  g.connect(audio.duck!);
  s.start(t, Math.random());
  s.stop(t + dur);
}

function bpm(): number {
  switch (state.mode) {
    case 'menu': return 84;
    case 'calm': return 92;
    case 'over': return 66;
    case 'boss': return 148 + state.intensity * 14;
    default: return 104 + state.intensity * 50;
  }
}

function pad(c: Chord, t: number, barLen: number, vol: number): void {
  for (let k = 1; k <= 3; k++) voice(midi(c[k]), t, barLen * 1.05, 'triangle', vol, 0.5, barLen * 0.25);
}

function playStep(s: number, t: number, stepLen: number): void {
  const i = s % 16;
  const bar = (s >> 4) % 4;
  const mode = state.mode;
  const charge = state.charge;
  const x = state.intensity;
  if (mode === 'pause') return;

  if (mode === 'menu' || mode === 'calm' || mode === 'over') {
    const c = PROG_PLAY[bar];
    const quiet = mode === 'over' ? 0.6 : 1;
    if (i === 0) {
      pad(c, t, stepLen * 16, 0.05 * quiet);
      voice(midi(c[0]), t, stepLen * 7, 'sine', 0.16 * quiet);
    }
    if (i === 8 && mode !== 'over') voice(midi(c[0] + 12), t, stepLen * 5, 'sine', 0.09);
    /* a slow, sparse arpeggio: the signal, faint */
    if (mode !== 'over' && i % 4 === 2) {
      voice(midi(c[ARP_ORDER[(i >> 2) + bar] % 3 + 1] + 12), t, stepLen * 3, 'sine', 0.035, 0.6);
    }
    return;
  }

  const boss = mode === 'boss';
  const c = (boss ? PROG_BOSS : PROG_PLAY)[bar];

  /* bass */
  if (boss) {
    if (i % 2 === 0) voice(midi(c[0] + (i % 8 === 6 ? 12 : 0)), t, stepLen * 1.7, 'sawtooth', 0.11);
  } else if (BASS_HITS[i]) {
    voice(midi(c[0] + (BASS_HITS[i] === 2 ? 12 : 0)), t, stepLen * 2.4, 'triangle', 0.2);
  }

  /* drums build with intensity */
  if (i % 4 === 0 && (boss || x > 0.08)) kick(t, 0.32);
  if ((i === 4 || i === 12) && (boss || x > 0.5)) hiss(t, 0.13, 1800, 0.09);
  if (boss || x > 0.3) {
    const sixteenths = boss || x > 0.72;
    if (sixteenths || i % 2 === 0) hiss(t, 0.035, 7000, i % 4 === 2 ? 0.05 : 0.028);
  }

  /* arpeggio: in at x2, twice as fast at x3 */
  if (charge >= 1 / 3) {
    const fast = charge >= 2 / 3;
    if (fast || i % 2 === 0) {
      const n = c[ARP_ORDER[(fast ? i : i >> 1) % ARP_ORDER.length]];
      voice(midi(n + 12), t, stepLen * (fast ? 1.4 : 2.6), 'square', 0.035, 0.35);
    }
  }
  /* lead: only while the meter is full */
  if (charge >= 1 && i % 4 === 0) {
    voice(midi(c[((i >> 2) + bar) % 3 + 1] + 24), t, stepLen * 3.6, 'sawtooth', 0.03, 0.5, 0.02);
  }
  /* a pad underneath keeps the harmony readable when little else is playing */
  if (i === 0) pad(c, t, stepLen * 16, boss ? 0.03 : 0.035);
}

function schedule(): void {
  const ac = audio.ac;
  if (!ac || !audio.on || document.hidden) return;
  const now = ac.currentTime;
  if (nextTime < now) nextTime = now + 0.05; // first run, or we fell behind while hidden
  while (nextTime < now + LOOKAHEAD) {
    const stepLen = 60 / bpm() / 4;
    playStep(step, nextTime, stepLen);
    nextTime += stepLen;
    step = (step + 1) % 64;
  }
}

export const Music = {
  /* Call every frame with what the game is doing. intensity and charge are 0..1. */
  set(mode: MusicMode, intensity: number, charge: number): void {
    const changed = mode !== state.mode;
    state.mode = mode;
    state.intensity = intensity;
    state.charge = charge;
    const { ac, musicIn, musicLevel } = audio;
    if (!ac || !musicIn || !musicLevel) return;

    const cutoff =
      mode === 'pause' ? 320
      : mode === 'over' ? 900
      : mode === 'menu' || mode === 'calm' ? 2400
      : 1300 + charge * 5200 + intensity * 1400;
    musicIn.frequency.setTargetAtTime(cutoff, ac.currentTime, 0.12);
    const base = mode === 'pause' ? 0.2 : mode === 'over' ? 0.45 : 0.6;
    musicLevel.gain.setTargetAtTime(base * mix.music, ac.currentTime, 0.15);
    if (changed) {
      /* land on a bar line when the fight starts or ends */
      if (mode === 'boss' || mode === 'play' || mode === 'over') step = (step + 15) & ~15;
    }
  },
};

onAudioBoot(() => {
  if (!timer) timer = window.setInterval(schedule, TICK_MS);
});
