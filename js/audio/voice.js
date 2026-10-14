// The narrator: reads the instructions of the game out loud, in English.
//
// Every line (js/data/voice-lines.js) is the team's own recording in assets/voices/ (jump.mp3,
// rule1.mp3...). There is no computer voice: a line without a recording is not spoken.
// Lines started by the game have priorities: a broken rule interrupts a button, a button never
// interrupts a rule, and the same button is not narrated again for a while.
import { on, emit } from '../core/events.js';
import { prefs } from '../core/storage.js';
import { clamp } from '../core/math.js';
import { A } from './audio.js';
import { VOICE_LINES, LINE_BY_ID, lineForButton, lineForRule } from '../data/voice-lines.js';

const FILE_TYPES = ['mp3', 'm4a', 'wav', 'ogg', 'webm'];
const BUTTON_COOLDOWN = 20000;   // ms before the game narrates the same button again
const FILE_TIMEOUT = 30000;      // ms: a voice file that never ends is stopped after this

/** button < kickoff < rule < user (a click on a Listen button always plays) */
export const PRIO = { button: 1, kickoff: 2, rule: 3, user: 9 };

export const voice = {
  mode: 'all',       // what the game narrates by itself: all | rules | off
  volume: .9,
  captions: true,    // show the sentence on screen while it is spoken
  current: null      // the line playing now: {id, text, prio, source}
};

const files = {};    // id -> url of its file in assets/voices/
const lastSaid = {};
let job = 0;         // grows every time something starts, so old callbacks are ignored
let audioEl = null, safety = 0, seq = null;

/* ---------- which voice each line uses ---------- */
/** 'file' | 'none' */
export const sourceOf = id => files[id] ? 'file' : 'none';

/* ---------- playing ---------- */
function halt(){
  job++;
  clearTimeout(safety);
  if (audioEl){ audioEl.onended = audioEl.onerror = null; audioEl.pause(); audioEl = null; }
  if (voice.current){
    const done = voice.current;
    voice.current = null;
    emit('voice:end', done);
  }
}

/** entry: {id, text, prio, onEnd}. Returns false when the line has no recording. */
function start(entry){
  const url = files[entry.id];
  if (!url) return false;
  halt();
  const my = ++job;
  voice.current = { id: entry.id, text: entry.text, prio: entry.prio, source: 'file' };
  emit('voice:start', voice.current);

  const finish = () => {
    if (my !== job) return;
    clearTimeout(safety);
    audioEl = null;
    const done = voice.current;
    voice.current = null;
    emit('voice:end', done);
    if (entry.onEnd) entry.onEnd();
  };

  const el = audioEl = new Audio(url);
  el.volume = voice.volume;
  el.onended = finish;
  el.onerror = finish;
  const p = el.play();
  if (p && p.catch) p.catch(finish);
  safety = setTimeout(finish, FILE_TIMEOUT);
  return true;
}

function endSequence(){
  if (!seq) return;
  seq = null;
  emit('voice:sequence', false);
}

export function stopVoice(){
  endSequence();
  halt();
}

/**
 * Says one line. A line from the game (prio below PRIO.user) obeys the narrator setting and
 * never cuts a more important line. Returns true when it started.
 */
export function say(id, prio = PRIO.user){
  const line = LINE_BY_ID[id];
  if (!line) return false;
  if (prio < PRIO.user){
    if (A.muted || seq) return false;
    if (voice.mode === 'off' || (voice.mode === 'rules' && prio === PRIO.button)) return false;
    const cur = voice.current;
    if (cur && (prio < cur.prio || (prio === cur.prio && prio < PRIO.rule))) return false;
    if (prio === PRIO.button){
      const now = performance.now();
      if (now - (lastSaid[id] || -1e9) < BUTTON_COOLDOWN) return false;
      lastSaid[id] = now;
    }
  } else endSequence();
  return start({ ...line, prio });
}

/** Plays several lines one after the other (Listen to all). */
export function playAll(ids){
  stopVoice();
  const list = ids.filter(id => LINE_BY_ID[id]);
  const s = seq = { list, i: 0 };
  emit('voice:sequence', true);
  const next = () => {
    if (seq !== s) return;
    if (s.i >= list.length){ endSequence(); return; }
    if (!start({ ...LINE_BY_ID[list[s.i++]], prio: PRIO.user, onEnd: () => setTimeout(next, 450) })) next();
  };
  next();
}
export const isSequencePlaying = () => !!seq;

/**
 * The tutorial's narration: lines of the game (the team's recordings), one after the other.
 * items: line ids ('jump', 'rule4'...). It follows the narrator setting, and the lines it reads
 * don't repeat when you press the button.
 */
export function narrate(items){
  if (voice.mode === 'off') return false;
  stopVoice();
  const now = performance.now();
  const list = items.filter(id => LINE_BY_ID[id]);
  for (const id of list) lastSaid[id] = now;
  const s = seq = { list, i: 0 };
  emit('voice:sequence', true);
  const next = () => {
    if (seq !== s) return;
    if (s.i >= list.length){ endSequence(); return; }
    if (!start({ ...LINE_BY_ID[list[s.i++]], prio: PRIO.user, onEnd: () => setTimeout(next, 300) })) next();
  };
  next();
  return true;
}

/** How loud the background music may be (it goes down while somebody speaks). */
export function duckLevel(){
  return voice.current ? .3 : 1;
}

/* ---------- settings ---------- */
function changed(key, value){
  prefs.set(key, value);
  emit('voice:settings');
}
export function setNarratorMode(mode){ voice.mode = mode; changed('voice-mode', mode); if (mode === 'off' && voice.current && voice.current.prio < PRIO.user) halt(); }
export function setVoiceVolume(v){ voice.volume = clamp(Number(v), 0, 1); if (audioEl) audioEl.volume = voice.volume; changed('voice-vol', voice.volume); }
export function setCaptions(onOff){ voice.captions = onOff; changed('captions', onOff ? '1' : '0'); }

/* ---------- start ---------- */
/**
 * Finds the voice files: reads the folder listing of assets/voices/ (the local server makes one) in
 * a single request. Where there is no listing (the game hosted online), it asks for <id>.mp3 directly.
 */
async function findFiles(){
  try {
    const res = await fetch('assets/voices/', { cache: 'no-store' });
    const html = res.ok ? await res.text() : '';
    const names = {};
    for (const m of html.matchAll(/href="([^"?#]+)"/gi)){
      const name = decodeURIComponent(m[1]).split('/').pop();
      names[name.toLowerCase()] = name;
    }
    for (const line of VOICE_LINES){
      const ext = FILE_TYPES.find(e => names[`${line.id}.${e}`.toLowerCase()]);
      if (ext) files[line.id] = 'assets/voices/' + encodeURIComponent(names[`${line.id}.${ext}`.toLowerCase()]);
    }
  } catch (e) {}
  if (Object.keys(files).length) return;
  await Promise.all(VOICE_LINES.map(async line => {
    const url = `assets/voices/${line.id}.mp3`;
    try { if ((await fetch(url, { method: 'HEAD' })).ok) files[line.id] = url; } catch (e) {}
  }));
}

export async function initVoice(){
  const mode = prefs.get('voice-mode', 'all');
  voice.mode = ['all', 'rules', 'off'].includes(mode) ? mode : 'all';
  const vol = Number(prefs.get('voice-vol', .9));
  voice.volume = Number.isFinite(vol) ? clamp(vol, 0, 1) : .9;
  voice.captions = prefs.get('captions', '1') !== '0';

  // what the game narrates by itself
  on('rule', n => say(lineForRule(n).id, PRIO.rule));
  on('button:used', id => { const line = lineForButton(id); if (line) say(line.id, PRIO.button); });
  on('kickoff', n => say(lineForRule(n).id, PRIO.kickoff));
  const quiet = () => { if (voice.current && voice.current.prio < PRIO.user) halt(); };
  on('match:menu', quiet);
  on('match:end', quiet);

  await findFiles();
  emit('voice:files');
}
