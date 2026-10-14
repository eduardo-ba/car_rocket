// The built-in stadium beat: an original 4-bar loop in A minor, used when no song is chosen.
import { A, tone, noise } from './audio.js';

const STEP_TIME = .135;   // seconds per 16th note
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [
  { root: 45, arp: [69, 72, 76] },   // Am
  { root: 41, arp: [65, 69, 72] },   // F
  { root: 48, arp: [67, 72, 76] },   // C
  { root: 43, arp: [67, 71, 74] }    // G
];
const LEAD = [0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1];
const BASS_STEPS = new Set([0, 3, 6, 8, 11, 14]);

export const beat = {
  on: false, step: 0, next: 0, timer: null,

  start(){
    if (!A.ctx || this.on) return;
    this.on = true;
    this.step = 0;
    this.next = A.ctx.currentTime + .08;
    this.timer = setInterval(() => this.schedule(), 40);
  },

  stop(){
    if (!this.on) return;
    this.on = false;
    clearInterval(this.timer);
  },

  /* schedules the notes of the next 0.2 s, so the rhythm stays steady */
  schedule(){
    const ctx = A.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + .05;
    while (this.next < ctx.currentTime + .2){
      this.play(this.step, this.next - ctx.currentTime);
      this.next += STEP_TIME;
      this.step = (this.step + 1) % 64;
    }
  },

  play(i, when){
    const chord = CHORDS[Math.floor(i / 16)], s = i % 16, bus = A.musicBus;
    if (BASS_STEPS.has(s)) tone(midi(chord.root), .24, 'triangle', .18, null, when, bus);
    if (s % 2 === 0 || s > 12){
      const li = LEAD[s];
      tone(midi(li === 3 ? chord.arp[0] + 12 : chord.arp[li]), .12, 'square', .05, null, when, bus);
    }
    if (s % 4 === 2) noise(.04, .05, 7000, .7, 'highpass', when, null, bus);
    if (s === 4 || s === 12) noise(.1, .1, 1800, 1, 'bandpass', when, null, bus);
    if (s === 0 || s === 8 || s === 10) tone(130, .13, 'sine', .22, 40, when, bus);
  }
};
