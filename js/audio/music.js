// Background music: the player's own song (MP3 chosen in the menu, or assets/music/cancion.mp3),
// or the built-in beat when there is no song. The volume follows the game:
// louder with the RADIO on, silent when the radio is broken, muffled under water.
import { A } from './audio.js';
import { beat } from './beat.js';
import { on, emit } from '../core/events.js';
import { songStore } from '../core/storage.js';
import { clamp, lerp, damp } from '../core/math.js';

const LOCAL_SONG = 'assets/music/cancion.mp3';
const BUILT_IN = 'Built-in stadium beat';

export const bgm = {
  el: null, name: '', url: null,
  routable: false, routed: false, node: null,
  vol: .6, cur: 0, pending: false, saved: false,

  info(){ return { hasSong: !!this.el, name: this.el ? this.name : BUILT_IN, saved: this.saved }; },

  /** Switches to another <audio> element (or to the built-in beat with null). */
  set(el, { name = '', routable = false, url = null, saved = false } = {}){
    if (this.el){
      const old = this.el;
      this.el = null;
      old.pause();
      if (this.node){ try { this.node.disconnect(); } catch (e) {} this.node = null; }
      old.removeAttribute('src');
      try { old.load(); } catch (e) {}
    }
    if (this.url && this.url !== url) URL.revokeObjectURL(this.url);
    Object.assign(this, { el, name, url, routable, saved, routed: false, cur: 0, pending: false });
    if (el){
      el.loop = true;
      el.volume = 0;
      el.addEventListener('error', () => {
        if (this.el !== el) return;
        this.set(null);
        songStore.clear().catch(() => {});
        emit('song:changed', { ...this.info(), error: "That file can't be played. Try an MP3 file." });
      });
    }
    this.route();
    emit('song:changed', this.info());
  },

  /* Sends the song through Web Audio so it can be muffled under water.
     Only same-origin files can be routed; others play directly at reduced features. */
  route(){
    if (!this.el || this.routed || !this.routable || !A.ctx || !A.songFilter) return;
    try {
      this.node = A.ctx.createMediaElementSource(this.el);
      this.node.connect(A.songFilter);
      this.routed = true;
      this.el.volume = 1;
    } catch (e) { this.routed = false; }
  },

  setVolume(v){ this.vol = clamp(v, 0, 1); },
  cut(){ this.cur = 0; },

  /** level: 0..1 from the game state. hardPause: the match is paused. */
  update(dt, level, underwater, hardPause){
    if (hardPause){
      this.cur = 0;
      if (this.el && !this.el.paused) this.el.pause();
      return;
    }
    const target = level * this.vol;
    this.cur = lerp(this.cur, target, damp(4, dt));
    if (Math.abs(this.cur - target) < .002) this.cur = target;
    const ctx = A.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    A.songFilter.frequency.setTargetAtTime(underwater ? 450 : 18000, t, .1);
    A.beatFilter.frequency.setTargetAtTime(underwater ? 450 : 3200, t, .1);

    if (this.el){
      if (beat.on) beat.stop();
      A.musicBus.gain.setTargetAtTime(0, t, .05);
      if (target > .001 && this.el.paused && !this.pending){
        this.pending = true;
        const p = this.el.play();
        if (p && p.then) p.then(() => { this.pending = false; }, () => { this.pending = false; });
        else this.pending = false;
      }
      if (target <= .001 && this.cur <= .005 && !this.el.paused) this.el.pause();
      if (this.routed) A.songGain.gain.setTargetAtTime(this.cur, t, .05);
      else this.el.volume = A.muted ? 0 : clamp(this.cur, 0, 1);
    } else {
      if (target > .001 && !beat.on) beat.start();
      if (target <= .001 && this.cur <= .005 && beat.on) beat.stop();
      A.musicBus.gain.setTargetAtTime(this.cur * .8, t, .05);
    }
  }
};

on('audio:ready', () => bgm.route());

/** Loads the song saved in this browser, or assets/music/cancion.mp3 when served locally. */
export async function loadSavedSong(){
  try {
    const rec = await songStore.get();
    if (rec && rec.blob){
      const url = URL.createObjectURL(rec.blob);
      bgm.set(new Audio(url), { name: rec.name, routable: true, url, saved: true });
      return;
    }
  } catch (e) {}
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1'){
    const el = new Audio();
    el.preload = 'auto';
    el.addEventListener('canplay', () => { if (!bgm.el) bgm.set(el, { name: 'cancion.mp3', routable: true }); }, { once: true });
    el.src = LOCAL_SONG;
  }
}

/** Uses a song file chosen by the player and saves it in this browser. */
export async function useSongFile(file){
  const url = URL.createObjectURL(file);
  const name = file.name.replace(/\.[^.]+$/, '');
  bgm.set(new Audio(url), { name, routable: true, url });
  try {
    await songStore.set({ name, blob: file });
    bgm.saved = true;
    emit('song:changed', bgm.info());
  } catch (e) {}
}

export function clearSong(){
  bgm.set(null);
  songStore.clear().catch(() => {});
}
