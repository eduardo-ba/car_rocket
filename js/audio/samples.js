// The sound effects of the 10 buttons: the team's files in assets/sfx/ (jump.mp3, turbo.mp3...).
// They load when the audio starts (first click or key). A button without its file, or a sound
// that is still loading, uses the synthesized effect from audio.js.
import { A } from './audio.js';
import { on } from '../core/events.js';

/** button id -> file name in assets/sfx/ (the same names as the voice lines) */
const FILES = {
  jump: 'jump', turbo: 'turbo', goal: 'goal', sub: 'sub', radio: 'radio',
  robot: 'robot', '4x4': 'fourbyfour', plane: 'plane', madmax: 'madmax', tuning: 'tuning'
};
const VOLUME = .5;

const buffers = {};   // id -> AudioBuffer
const playing = {};   // id -> the source playing now, so spamming a button does not pile up sounds
let loading = false;

function load(){
  if (loading || !A.ctx) return;
  loading = true;
  for (const [id, name] of Object.entries(FILES)){
    fetch(`assets/sfx/${name}.mp3`)
      .then(res => res.ok ? res.arrayBuffer() : null)
      .then(data => data && A.ctx.decodeAudioData(data))
      .then(buf => { if (buf) buffers[id] = buf; })
      .catch(() => {});
  }
}
on('audio:ready', load);
load();

/** Plays the sound effect of a button. Returns false when it has none (use the synthesized one). */
export function buttonSound(id){
  const buf = buffers[id], ctx = A.ctx;
  if (!ctx || !buf) return false;
  if (playing[id]){ try { playing[id].stop(); } catch (e) {} }
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = buf;
  g.gain.value = VOLUME;
  s.connect(g); g.connect(A.master);
  s.onended = () => { if (playing[id] === s) delete playing[id]; };
  s.start();
  playing[id] = s;
  return true;
}
