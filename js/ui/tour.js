// HUD tour: a step-by-step guide that lights up each part of the screen and explains it.
// It opens by itself in your first match (the game waits), and again from the pause screen.
// The narrator reads every step when it is on. Keys: → / Enter next, ← back, Esc skip.
import { h } from './dom.js';
import { icon } from './icons.js';
import { hideTip } from './tooltip.js';
import { on, emit } from '../core/events.js';
import { prefs } from '../core/storage.js';
import { clamp } from '../core/math.js';
import { G, inMatch } from '../game/state.js';
import { stopVoice } from '../audio/voice.js';

const STEPS = [
  { target: '#scoreboard', title: 'The score',
    text: 'You are BLUE. Score in the orange goal. The clock shows the time left. If it is a draw, the next goal wins.' },
  { target: '#remote [data-group="action"]', title: 'Actions', keys: ['Space', 'Shift', 'F', 'R'],
    text: 'JUMP, TURBO, GOAL and RADIO. Their keys are around W A S D, so you never let go of the steering.' },
  { target: '#remote [data-group="transform"]', title: 'Transform', keys: ['1', '2', '3', '4', '5', '6'],
    text: 'Six new forms for your car, on keys 1 to 6. Press the same button again to go back to the normal RC car.' },
  { target: '#rulesChip', title: 'The 5 rules',
    text: 'Each light is one rule. It turns red when you break it. A yellow "!" on a button means: pressing it now breaks a rule!' },
  { target: '#boost', title: 'Boost', keys: ['Shift'],
    text: 'TURBO uses boost. Drive over the glowing pads on the field to fill it again.' },
  { target: '#status', title: 'Your car and your music',
    text: 'MODE shows what your car is now. MUSIC shows the song: the RADIO button makes it louder.' },
  { target: '#hudActions', title: 'Options', keys: ['C', 'M', 'H', 'P'],
    text: 'Ball camera, sound, rules and pause. In the pause screen you can change the narrator and record your own voices.' },
  { target: null, title: 'Ready to play!',
    text: 'Point at anything on the screen to see what it does. The narrator reads the buttons and the rules in English. Good luck!' }
];
const PAD = 8, GAP = 14, EDGE = 12;

let root = null, spot = null, pop = null, count = null, title = null, text = null, keys = null, back = null, next = null;
let i = 0, open = false;

export const isTourOpen = () => open;

function target(){
  const sel = STEPS[i].target;
  const el = sel && document.querySelector(sel);
  return el && el.getClientRects().length ? el : null;
}

function place(){
  if (!open) return;
  const el = target();
  const W = innerWidth, H = innerHeight;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  if (!el){
    spot.style.cssText = `left:${W / 2}px;top:${H / 2}px;width:0;height:0`;
    pop.style.transform = `translate(${Math.round((W - pw) / 2)}px, ${Math.round((H - ph) / 2)}px)`;
    return;
  }
  const r = el.getBoundingClientRect();
  spot.style.cssText = `left:${r.left - PAD}px;top:${r.top - PAD}px;width:${r.width + PAD * 2}px;height:${r.height + PAD * 2}px`;
  const below = r.bottom + PAD + GAP, above = r.top - PAD - GAP - ph;
  const y = below + ph <= H - EDGE ? below : above >= EDGE ? above : clamp(H / 2 - ph / 2, EDGE, H - ph - EDGE);
  const x = clamp(r.left + r.width / 2 - pw / 2, EDGE, W - pw - EDGE);
  pop.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function render(){
  const s = STEPS[i];
  count.textContent = `${i + 1} / ${STEPS.length}`;
  title.textContent = s.title;
  text.textContent = s.text;
  keys.replaceChildren(...(s.keys || []).map(k => h('kbd', {}, k)));
  keys.hidden = !s.keys;
  back.disabled = i === 0;
  next.replaceChildren(i === STEPS.length - 1 ? 'Play!' : 'Next', h('span', { html: icon('play') }));
  root.classList.toggle('no-target', !target());
  place();
}

function go(n){
  i = clamp(n, 0, STEPS.length - 1);
  render();
  next.focus({ preventScroll: true });
}

export function startTour(){
  if (!inMatch() || open) return;
  hideTip();
  open = true;
  G.tour = true;
  i = 0;
  root.hidden = false;
  emit('tour', true);
  render();
  next.focus({ preventScroll: true });
}

function endTour(){
  if (!open) return;
  open = false;
  G.tour = false;
  root.hidden = true;
  emit('tour', false);
  prefs.set('tour-done', '1');
  stopVoice();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

export function initTour(){
  count = h('span', { class: 'tour-count' });
  title = h('h2', { id: 'tourTitle', class: 'tour-title' });
  text = h('p', { id: 'tourText', class: 'tour-text' });
  keys = h('p', { class: 'tour-keys' });
  back = h('button', { type: 'button', class: 'btn btn-sm' }, 'Back');
  next = h('button', { type: 'button', class: 'btn btn-sm btn-next' });
  const skip = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Skip tour');
  back.addEventListener('click', () => go(i - 1));
  next.addEventListener('click', () => i === STEPS.length - 1 ? endTour() : go(i + 1));
  skip.addEventListener('click', endTour);

  spot = h('div', { class: 'tour-spot', 'aria-hidden': 'true' });
  pop = h('div', { class: 'tour-pop card' },
    h('div', { class: 'tour-top' }, h('span', { class: 'eyebrow' }, 'HUD tour'), count),
    title, text, keys,
    h('div', { class: 'tour-btns' }, skip, h('span', { class: 'tour-gap' }), back, next));
  root = h('div', { id: 'tour', class: 'tour', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tourTitle', 'aria-describedby': 'tourText', hidden: true }, spot, pop);
  document.getElementById('app').append(root);

  document.addEventListener('keydown', e => {
    if (!open) return;
    const onButton = e.target && e.target.closest && e.target.closest('.tour button');
    // stopPropagation: the key must not reach the game controls once the tour closes
    if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); endTour(); }
    else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !onButton)){ e.preventDefault(); e.stopPropagation(); i === STEPS.length - 1 ? endTour() : go(i + 1); }
    else if (e.key === 'ArrowLeft'){ e.preventDefault(); e.stopPropagation(); go(i - 1); }
    else if (e.key === 'Tab'){
      // keep the focus inside the tour
      const items = [...pop.querySelectorAll('button:not([disabled])')];
      const k = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(k + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }
  });
  window.addEventListener('resize', place);

  on('match:start', () => {
    if (prefs.get('tour-done') || G.tutorial) return;   // the tutorial explains the screen itself
    setTimeout(startTour, 450);
  });
  for (const name of ['match:end', 'match:menu']) on(name, endTour);
}
