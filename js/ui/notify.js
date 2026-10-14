// Messages during the match: toasts (short, stack on the left), the big banner in the centre,
// the red card when a rule is broken, and the name of each move you do (BACKFLIP, AERIAL...).
// The same toast twice becomes one toast with "x2".
import { $, h } from './dom.js';
import { on } from '../core/events.js';
import { icon } from './icons.js';

const KIND_ICON = { info: 'info', good: 'check', warn: 'warning', bad: 'x' };
const TOAST_TIME = 2800, MAX_TOASTS = 4, RULE_CARD_TIME = 4000;
const timers = new WeakMap();
let bannerTimer = 0, ruleTimer = 0, moveTimer = 0;

export function initNotify(){
  $('rcIcon').innerHTML = icon('warning');
  on('toast', toast);
  on('banner', banner);
  on('rule', ruleCard);
  on('move', movePop);
  for (const name of ['match:start', 'match:end', 'match:menu']) on(name, clear);
}

function clear(){
  $('toasts').replaceChildren();
  $('ruleCard').hidden = true;
  $('banner').classList.remove('show');
}

function expire(el){
  clearTimeout(timers.get(el));
  timers.set(el, setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 350);
  }, TOAST_TIME));
}

function restartAnimation(el, cls){
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function toast(msg, kind = 'info'){
  const box = $('toasts');
  const same = [...box.children].find(t => t.dataset.msg === msg && !t.classList.contains('out'));
  if (same){
    const n = Number(same.dataset.count || 1) + 1;
    same.dataset.count = n;
    same.querySelector('.toast-count').textContent = '×' + n;
    restartAnimation(same, 'bump');
    expire(same);
    return;
  }
  const el = h('div', { class: `toast toast-${kind}`, 'data-msg': msg },
    h('span', { class: 'toast-icon', html: icon(KIND_ICON[kind] || 'info') }),
    h('span', { class: 'toast-text' }, msg),
    h('span', { class: 'toast-count' }));
  box.prepend(el);
  while (box.children.length > MAX_TOASTS) box.lastElementChild.remove();
  expire(el);
}

function banner(main, sub = '', ms = 1200){
  $('bannerMain').textContent = main;
  $('bannerSub').textContent = sub;
  const el = $('banner');
  el.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/** The name of a move, shown big for a moment (like the trick names in Rocket League). */
function movePop(name){
  const el = $('movePop');
  el.textContent = name;
  restartAnimation(el, 'show');
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => el.classList.remove('show'), 1100);
}

function ruleCard(n, text, penalty){
  $('rcNum').textContent = n;
  $('rcText').textContent = text;
  $('rcPenalty').textContent = 'Penalty: ' + penalty;
  const card = $('ruleCard');
  card.hidden = true;
  void card.offsetWidth;            // restart the shake animation
  card.hidden = false;
  clearTimeout(ruleTimer);
  ruleTimer = setTimeout(() => { card.hidden = true; }, RULE_CARD_TIME);
}
