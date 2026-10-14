// "Listen" buttons: a speaker button that reads one line (or a list of lines) out loud.
// Every copy of a button for the same line lights up while that line is playing, wherever it
// is (guide, end screen), and a second click stops it.
import { h } from './dom.js';
import { icon } from './icons.js';
import { setTip } from './tooltip.js';
import { on } from '../core/events.js';
import { LINE_BY_ID } from '../data/voice-lines.js';
import { voice, say, stopVoice, playAll, sourceOf, isSequencePlaying } from '../audio/voice.js';
import { initAudio } from '../audio/audio.js';

export const SOURCE = {
  file: { label: 'Our voice', text: 'Recorded by our team.' },
  none: { label: 'No recording', text: 'The file of this line is missing in assets/voices/.' }
};

/** Tooltip lines that say which voice will be used. */
export function sourceState(id){
  const src = sourceOf(id);
  return `${SOURCE[src].label}: ${SOURCE[src].text}`;
}

const playingNow = id => !!(voice.current && voice.current.id === id);

/** A speaker button for one line. */
export function listenButton(id, { label = 'Listen', small = false } = {}){
  const line = LINE_BY_ID[id];
  const btn = h('button', {
    type: 'button', class: 'listen-btn' + (small ? ' listen-sm' : ''), 'data-listen': id,
    'aria-label': `${label}: ${line.text}`, 'aria-pressed': 'false', html: icon('voice')
  });
  btn.addEventListener('click', () => {
    initAudio();
    if (playingNow(id)) stopVoice(); else say(id);
  });
  setTip(btn, () => ({
    title: playingNow(id) ? 'Stop' : label,
    quote: line.text,
    state: sourceState(id)
  }));
  return btn;
}

/** A text button that plays several lines in a row ("Listen to all"). */
export function listenAllButton(ids, text, tip){
  const btn = h('button', { type: 'button', class: 'btn btn-sm btn-listen-all', 'data-listen-all': '' },
    h('span', { class: 'lab-icon', html: icon('play') }), h('span', { class: 'lab-text' }, text));
  btn.dataset.text = text;
  btn.addEventListener('click', () => {
    initAudio();
    if (isSequencePlaying() && btn.classList.contains('is-playing')) stopVoice();
    else {
      playAll(ids);
      document.querySelectorAll('[data-listen-all]').forEach(b => b.classList.toggle('is-playing', b === btn));
      refreshAll();
    }
  });
  setTip(btn, () => ({
    title: btn.classList.contains('is-playing') ? 'Stop' : text,
    body: tip,
    note: 'Every line plays with the voices our team recorded.'
  }));
  return btn;
}

function refreshAll(){
  document.querySelectorAll('[data-listen-all]').forEach(b => {
    const playing = b.classList.contains('is-playing') && isSequencePlaying();
    if (!playing) b.classList.remove('is-playing');
    b.querySelector('.lab-icon').innerHTML = icon(playing ? 'stop' : 'play');
    b.querySelector('.lab-text').textContent = playing ? 'Stop' : b.dataset.text;
  });
}

function mark(id, playing){
  document.querySelectorAll(`[data-listen="${id}"]`).forEach(b => {
    b.classList.toggle('is-playing', playing);
    b.setAttribute('aria-pressed', String(playing));
    b.innerHTML = icon(playing ? 'stop' : 'voice');
  });
  document.querySelectorAll(`[data-line-row="${id}"]`).forEach(row => row.classList.toggle('is-speaking', playing));
}

export function initListen(){
  on('voice:start', cur => mark(cur.id, true));
  on('voice:end', cur => mark(cur.id, false));
  on('voice:sequence', refreshAll);
}
