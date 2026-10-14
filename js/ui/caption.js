// Captions: during the match, the sentence the narrator is reading appears above the remote,
// with who is speaking (our team). Settings → Voice turns them off.
import { $, h } from './dom.js';
import { icon } from './icons.js';
import { setTip } from './tooltip.js';
import { on } from '../core/events.js';
import { voice } from '../audio/voice.js';
import { SOURCE } from './listen.js';
import { G, inMatch } from '../game/state.js';

let el = null, text = null, who = null, timer = 0;

function show(cur){
  if (!voice.captions || !inMatch() || G.tour) return;
  clearTimeout(timer);
  text.textContent = cur.text;
  who.textContent = SOURCE[cur.source].label;
  el.dataset.src = cur.source;
  el.hidden = false;
  el.classList.remove('out');
}

function hide(){
  if (el.hidden) return;
  clearTimeout(timer);
  el.classList.add('out');
  timer = setTimeout(() => { el.hidden = true; }, 600);
}

export function initCaption(){
  el = $('caption');
  text = h('span', { class: 'caption-text' });
  who = h('span', { class: 'caption-who' });
  el.append(h('span', { class: 'caption-icon', html: icon('voice') }), h('span', { class: 'caption-body' }, who, text));
  setTip(el, () => ({
    title: 'Narrator',
    body: 'The narrator reads the instructions of the game: the sentence of a button the first time you use it, and every rule you break.',
    note: 'Change it or turn it off in the pause screen (P) → Settings → Voice.'
  }));
  on('voice:start', show);
  on('voice:end', () => { timer = setTimeout(hide, 500); });
  for (const name of ['match:start', 'match:end', 'match:menu']) on(name, () => { clearTimeout(timer); el.hidden = true; });
  on('voice:settings', () => { if (!voice.captions) el.hidden = true; });
  on('tour', open => { if (open){ clearTimeout(timer); el.hidden = true; } });
}
