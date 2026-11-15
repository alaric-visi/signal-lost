import { V } from '../core/view';

/* Audio graph (everything is synthesised; there are no assets):

     sfx bus ───────────────────────────────┐
     music filter ─ duck ─ music level ─────┼─ compressor ─ master ─ out
     reverb send ─ convolver ─ reverb level ┘

   Sound effects and music notes connect to the sfx bus / music filter, and
   optionally to the reverb send as well. */

const MASTER = 0.9;

export const audio = {
  ac: null as AudioContext | null,
  on: true,
  master: null as GainNode | null,
  sfx: null as GainNode | null,
  musicIn: null as BiquadFilterNode | null, // music voices connect here
  duck: null as GainNode | null,
  musicLevel: null as GainNode | null,
  reverb: null as GainNode | null, // send
  noise: null as AudioBuffer | null,
};

/* User volume settings: music is a multiplier on the soundtrack's own level,
   sfx is the effects bus gain. */
export const mix = { music: 1, sfx: 0.8 };
export function applyMix(): void {
  if (audio.sfx && audio.ac) audio.sfx.gain.setTargetAtTime(mix.sfx, audio.ac.currentTime, 0.02);
}

const bootListeners: (() => void)[] = [];
export function onAudioBoot(fn: () => void): void {
  bootListeners.push(fn);
}

/* A decaying burst of stereo noise makes a serviceable room. */
function impulse(ac: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

/* Must first be called from a user gesture. */
export function bootAudio(): void {
  if (audio.ac) return;
  const AC: typeof AudioContext | undefined =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    audio.on = false;
    return;
  }
  const ac = (audio.ac = new AC());

  const master = (audio.master = ac.createGain());
  master.gain.value = audio.on ? MASTER : 0;
  master.connect(ac.destination);

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  comp.connect(master);

  const sfx = (audio.sfx = ac.createGain());
  sfx.gain.value = mix.sfx;
  sfx.connect(comp);

  const filter = (audio.musicIn = ac.createBiquadFilter());
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  filter.Q.value = 0.7;
  const duck = (audio.duck = ac.createGain());
  const level = (audio.musicLevel = ac.createGain());
  level.gain.value = 0.6;
  filter.connect(duck);
  duck.connect(level);
  level.connect(comp);

  const send = (audio.reverb = ac.createGain());
  const conv = ac.createConvolver();
  conv.buffer = impulse(ac, 1.7);
  const wet = ac.createGain();
  wet.gain.value = 0.5;
  send.connect(conv);
  conv.connect(wet);
  wet.connect(comp);

  const len = Math.floor(ac.sampleRate * 1.2);
  const noise = ac.createBuffer(1, len, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  audio.noise = noise;

  for (const fn of bootListeners) fn();
}

export function resumeAudio(): void {
  if (audio.ac && audio.ac.state === 'suspended') void audio.ac.resume();
}

export function setAudioOn(on: boolean): void {
  audio.on = on;
  if (audio.master && audio.ac) audio.master.gain.setTargetAtTime(on ? MASTER : 0, audio.ac.currentTime, 0.02);
}

/* World x -> stereo position. Kept short of hard left/right. */
export const panOf = (x: number): number => Math.max(-0.8, Math.min(0.8, (x / V.w) * 2 - 1));

/* Pull the music down for a moment so a big hit reads clearly. */
export function duckMusic(depth = 0.35, seconds = 0.6): void {
  const { ac, duck } = audio;
  if (!ac || !duck) return;
  const t = ac.currentTime;
  duck.gain.cancelScheduledValues(t);
  duck.gain.setValueAtTime(Math.min(duck.gain.value, depth), t);
  duck.gain.linearRampToValueAtTime(1, t + seconds);
}
