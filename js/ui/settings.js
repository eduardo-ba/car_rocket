// Settings in three tabs: GAME (difficulty, graphics), MUSIC (your song, volume) and VOICE (the
// narrator). The same controls appear in the menu and in the pause screen; every copy stays in
// sync and the choices are saved in the browser. Each setting has an "i" button that explains it.
import { h } from './dom.js';
import { icon } from './icons.js';
import { infoButton } from './tooltip.js';
import { createTabs } from './tabs.js';
import { on } from '../core/events.js';
import { prefs } from '../core/storage.js';
import { clamp } from '../core/math.js';
import { DIFFICULTY } from '../config.js';
import { G } from '../game/state.js';
import { view, setQuality } from '../engine/renderer.js';
import { initAudio } from '../audio/audio.js';
import { bgm, useSongFile, clearSong } from '../audio/music.js';
import {
  voice, setNarratorMode, setVoiceVolume, setCaptions
} from '../audio/voice.js';

const DIFFICULTY_TEXT = {
  easy: 'The orange car is slow and often misses the goal.',
  normal: 'A fair match for most players.',
  hard: 'The orange car is fast, aims well and uses turbo.'
};
const GRAPHICS_TEXT = {
  high: 'Real lights, reflections, glow, shadows and smooth edges.',
  low: 'Faster on old or school computers.'
};
const NARRATOR_TEXT = {
  all: 'Reads a button the first time you use it, every rule you break, and a rule at each kickoff.',
  rules: 'Reads only the rules: when you break one, and at each kickoff.',
  off: 'The game is quiet. The speaker buttons still work.'
};

const updaters = [];
let uid = 0, volume = 60, lastSong = null;

function syncAll(){ for (const update of updaters) update(); }

/** Reads the saved choices. Call once before building any settings. */
export function initSettings(){
  const d = prefs.get('diff', 'normal');
  if (DIFFICULTY[d]) G.difficulty = d;
  volume = clamp(Math.round(Number(prefs.get('vol', 60)) || 0), 0, 100);
  bgm.setVolume(volume / 100);
  on('song:changed', info => { lastSong = info; syncAll(); });
  for (const name of ['voice:settings', 'voice:files']) on(name, syncAll);
}

function setDifficulty(d){
  G.difficulty = d;
  prefs.set('diff', d);
}

function setVolume(v){
  volume = clamp(Math.round(Number(v) || 0), 0, 100);
  bgm.setVolume(volume / 100);
  prefs.set('vol', volume);
  syncAll();
}

/** A legend (or label) with an "i" button next to it. */
const labelWithInfo = (tag, props, text, name, tip) =>
  h(tag, { class: 'field-label field-label-info', ...props }, h('span', {}, text), infoButton(name, tip));

/* A group of radio buttons that looks like one segmented button. */
function segmented({ name, legend, options, get, set, texts, tip }){
  const desc = h('p', { class: 'field-desc', id: `${name}-desc` });
  const group = h('div', { class: 'seg' });
  const inputs = options.map(([value, label]) => {
    const id = `${name}-${value}`;
    const input = h('input', { type: 'radio', class: 'seg-input', name, id, value, 'aria-describedby': desc.id });
    input.addEventListener('change', () => { if (input.checked){ set(value); syncAll(); } });
    group.append(input, h('label', { class: 'seg-option', for: id }, label));
    return input;
  });
  updaters.push(() => {
    const v = get();
    for (const input of inputs) input.checked = input.value === v;
    desc.textContent = texts[v];
  });
  return h('fieldset', { class: 'field' }, labelWithInfo('legend', {}, legend, legend, tip), group, desc);
}

/* A slider with its value shown as a percentage. */
function slider({ id, label, min, max, step, get, set, tip }){
  const input = h('input', { type: 'range', id, class: 'slider', min, max, step });
  const out = h('output', { for: id, class: 'slider-value' });
  input.addEventListener('input', () => { set(Number(input.value)); syncAll(); });
  updaters.push(() => {
    const v = get();
    input.value = v;
    out.textContent = v + '%';
    input.setAttribute('aria-valuetext', v + '%');
  });
  return h('div', { class: 'slider-row' },
    tip ? labelWithInfo('label', { for: id, style: 'margin:0' }, label, label, tip)
        : h('label', { for: id, class: 'field-label', style: 'margin:0' }, label),
    input, out);
}

/* An on/off switch (a real checkbox). */
function toggle({ id, label, get, set, tip }){
  const input = h('input', { type: 'checkbox', id, class: 'switch-input', role: 'switch' });
  input.addEventListener('change', () => { set(input.checked); syncAll(); });
  updaters.push(() => { input.checked = get(); });
  return h('div', { class: 'switch-row' },
    input, h('label', { for: id, class: 'switch' }, h('span', { class: 'switch-track', 'aria-hidden': 'true' }), h('span', {}, label)),
    infoButton(label, tip));
}

/* ---------- GAME ---------- */
function gamePanel(prefix, difficulty){
  const root = h('div', { class: 'settings' });
  if (difficulty){
    root.append(segmented({
      name: `${prefix}-diff`, legend: 'Difficulty', texts: DIFFICULTY_TEXT,
      options: [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']],
      get: () => G.difficulty, set: setDifficulty,
      tip: { title: 'Difficulty', body: 'How fast and how smart the orange car is.', note: 'It changes the next match you start.' }
    }));
  }
  root.append(segmented({
    name: `${prefix}-gfx`, legend: 'Graphics', texts: GRAPHICS_TEXT,
    options: [['high', 'High'], ['low', 'Low']],
    get: () => view.quality, set: setQuality,
    tip: { title: 'Graphics', body: 'HIGH looks better. LOW runs faster on old or school computers.', note: 'If the game is slow on HIGH, it lowers the resolution by itself and suggests LOW.' }
  }));
  return root;
}

/* ---------- MUSIC ---------- */
function musicPanel(prefix){
  const fileId = `${prefix}-song`;
  const name = h('strong', { class: 'song-name' });
  const hint = h('p', { class: 'field-desc' });
  const input = h('input', { type: 'file', id: fileId, accept: 'audio/*,.mp3,.m4a,.ogg,.wav', hidden: true });
  const choose = h('label', { for: fileId, class: 'btn btn-sm', tabindex: '0', role: 'button', html: icon('music') }, 'Choose song');
  const reset = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Use built-in beat');

  // the label opens the hidden file input; make it work with Enter and Space too
  choose.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    input.click();
  });
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    initAudio();
    useSongFile(file);
  });
  reset.addEventListener('click', clearSong);

  updaters.push(() => {
    const info = lastSong || bgm.info();
    name.textContent = info.name;
    hint.textContent = info.error
      || (info.hasSong ? (info.saved ? 'Saved in this browser.' : 'Playing from this computer.')
                       : 'Choose an MP3 from your computer. It plays in the menu and during the match.');
    reset.hidden = !info.hasSong;
  });

  return h('fieldset', { class: 'field field-music' },
    labelWithInfo('legend', {}, 'Background music', 'Background music', {
      title: 'Background music',
      body: 'Choose an MP3 from your computer. The game saves it in this browser.',
      note: 'In the match, RADIO (R) makes it louder and double-clicking RADIO breaks rule 3: no music for 10 seconds. With the SUBMARINE it sounds like under water.'
    }),
    h('div', { class: 'song' },
      h('div', { class: 'song-info' }, h('span', { class: 'song-now' }, 'Now playing'), name),
      h('div', { class: 'song-actions' }, choose, reset, input)),
    hint,
    slider({ id: `${prefix}-vol`, label: 'Volume', min: 0, max: 100, step: 5, get: () => volume, set: setVolume }));
}

/* ---------- VOICE ---------- */
function voicePanel(prefix){
  const root = h('div', { class: 'settings' });
  const narrator = segmented({
    name: `${prefix}-narr`, legend: 'Narrator', texts: NARRATOR_TEXT,
    options: [['all', 'All'], ['rules', 'Rules'], ['off', 'Off']],
    get: () => voice.mode, set: setNarratorMode,
    tip: {
      title: 'Narrator',
      body: 'A voice reads the instructions of the game in English: the sentences of the 10 buttons and the 5 rules.',
      note: 'Every sentence is a recording of our team. There is no computer voice.'
    }
  });

  const volumeField = h('div', { class: 'field' },
    slider({
      id: `${prefix}-vvol`, label: 'Voice volume', min: 0, max: 100, step: 5,
      get: () => Math.round(voice.volume * 100), set: v => setVoiceVolume(v / 100),
      tip: { title: 'Voice volume', body: 'How loud the narrator is.', note: 'The music goes down by itself while the narrator speaks.' }
    }));

  root.append(h('div', { class: 'field-stack' }, narrator,
    toggle({
      id: `${prefix}-cap`, label: 'Captions', get: () => voice.captions, set: setCaptions,
      tip: { title: 'Captions', body: 'Shows the sentence on the screen while the narrator speaks, so you can read it too.' }
    })), volumeField);
  return root;
}

/** Builds the settings tabs. difficulty: false in the pause screen (it applies to new matches). */
export function buildSettings({ difficulty = true } = {}){
  const prefix = 'set' + (++uid);
  const tabs = createTabs([
    { id: 'game', label: 'Game', content: gamePanel(prefix, difficulty) },
    { id: 'music', label: 'Music', content: musicPanel(prefix) },
    { id: 'voice', label: 'Voice', content: voicePanel(prefix) }
  ], { label: 'Settings' });
  syncAll();
  return tabs;
}
