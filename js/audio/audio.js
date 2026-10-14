// Web Audio: the shared audio context, the sound effects, the engine hum and the crowd.
// Everything is synthesized, so the game works without sound files; the buttons play the team's
// own effects from assets/sfx/ when they are there (samples.js).
import { emit } from '../core/events.js';

/** Shared audio nodes. `ctx` stays null until the first click or key press. */
export const A = {
  ctx: null, master: null, noiseBuf: null, muted: false,
  musicBus: null, beatFilter: null,     // built-in beat
  songFilter: null, songGain: null      // the player's own song
};
let engOsc = null, engGain = null, crowdGain = null;

export function initAudio(){
  if (A.ctx){
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return;
  }
  try {
    const ctx = A.ctx = new (window.AudioContext || window.webkitAudioContext)();
    A.master = ctx.createGain();
    A.master.gain.value = A.muted ? 0 : .9;
    A.master.connect(ctx.destination);

    A.musicBus = ctx.createGain(); A.musicBus.gain.value = 0;
    A.beatFilter = ctx.createBiquadFilter(); A.beatFilter.type = 'lowpass'; A.beatFilter.frequency.value = 3200;
    A.musicBus.connect(A.beatFilter); A.beatFilter.connect(A.master);

    A.songFilter = ctx.createBiquadFilter(); A.songFilter.type = 'lowpass'; A.songFilter.frequency.value = 18000;
    A.songGain = ctx.createGain(); A.songGain.gain.value = 0;
    A.songFilter.connect(A.songGain); A.songGain.connect(A.master);

    A.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    engOsc = ctx.createOscillator(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 50;
    const engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 520;
    engGain = ctx.createGain(); engGain.gain.value = 0;
    engOsc.connect(engFilter); engFilter.connect(engGain); engGain.connect(A.master);
    engOsc.start();

    const crowdSrc = ctx.createBufferSource(); crowdSrc.buffer = A.noiseBuf; crowdSrc.loop = true;
    const crowdFilter = ctx.createBiquadFilter(); crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 700; crowdFilter.Q.value = .6;
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
    crowdSrc.connect(crowdFilter); crowdFilter.connect(crowdGain); crowdGain.connect(A.master);
    crowdSrc.start();

    emit('audio:ready');
  } catch (e) { A.ctx = null; }
}

export function suspendAudio(){ if (A.ctx) A.ctx.suspend(); }
export function resumeAudio(){ if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); }

export function setMuted(muted){
  A.muted = muted;
  if (A.master) A.master.gain.value = muted ? 0 : .9;
}

/** A short synth note. `when` is seconds from now, `dest` defaults to the master volume. */
export function tone(freq, dur, type = 'square', vol = .08, slideTo = null, when = 0, dest = null){
  const ctx = A.ctx;
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(dest || A.master);
  o.start(t); o.stop(t + dur + .03);
}

/** A burst of filtered noise (hits, explosions, hi-hats, static). */
export function noise(dur, vol = .2, freq = 1200, q = .7, type = 'lowpass', when = 0, sweepTo = null, dest = null){
  const ctx = A.ctx;
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = A.noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || A.master);
  s.start(t); s.stop(t + dur + .03);
}

export const sfx = {
  jump(){ tone(320, .15, 'square', .05, 640); },
  flip(){ tone(500, .2, 'triangle', .07, 1100); },
  hit(p){ noise(.09, Math.min(.35, .08 + p * .006), 900, 1, 'lowpass'); tone(120, .1, 'sine', .15, 60); },
  boom(){ noise(1.1, .55, 2000, .5, 'lowpass', 0, 70); tone(90, .7, 'sine', .35, 28); },
  horn(){ [261.6, 329.6, 392, 523.3].forEach((f, i) => tone(f, 1.2, i === 3 ? 'square' : 'sawtooth', .045)); },
  buzzer(){ tone(140, .5, 'square', .09); tone(147, .5, 'square', .07); },
  transform(){ tone(200, .35, 'sawtooth', .05, 900); tone(400, .35, 'square', .03, 1600, .05); },
  beep(high){ tone(high ? 880 : 440, high ? .45 : .18, 'square', .07); },
  pickup(){ tone(660, .12, 'square', .05, 990); },
  turbo(on){ if (on) noise(.45, .16, 400, 1, 'bandpass', 0, 2600); else tone(300, .15, 'sine', .05, 150); },
  shot(){ noise(.3, .3, 3000, 1, 'bandpass', 0, 500); tone(700, .35, 'sawtooth', .05, 180); },
  radioStatic(){ noise(1.2, .2, 3500, .4, 'highpass'); },
  firework(){ noise(.4, .14, 1400, .8, 'lowpass'); },
  error(){ tone(220, .12, 'square', .05, 170); }
};

/** Engine hum follows the player's speed; the crowd gets louder after goals. */
export function updateAmbience({ engineOn, speed, burning, crowdOn, hype, menu }){
  const ctx = A.ctx;
  if (!ctx || !engGain) return;
  const t = ctx.currentTime;
  engGain.gain.setTargetAtTime(engineOn ? .016 + Math.min(speed / 40, 1) * .024 : 0, t, .06);
  engOsc.frequency.setTargetAtTime(42 + speed * 3.2 + (burning ? 35 : 0), t, .08);
  crowdGain.gain.setTargetAtTime(crowdOn ? .016 + Math.max(0, hype) * .03 : menu ? .008 : 0, t, .3);
}
