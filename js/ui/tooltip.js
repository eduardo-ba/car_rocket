// One tooltip for the whole game.
//   Static:  <div data-tip="Text" data-tip-title="Title" data-keys="C M" data-tip-side="bottom">
//   Live:    setTip(el, () => ({title, keys, body, quote, note, rules, warn, state}))  (refreshes while open)
//   Fixed:   setTip(el, {title, body...})
//            quote: a sentence from the project notes · note: a smaller "how it works" line
// It opens after a short hover, right away on keyboard focus, never on touch, and closes with
// Esc, scrolling or clicking elsewhere. The element points to it with aria-describedby.
import { $, h } from './dom.js';
import { icon } from './icons.js';
import { clamp } from '../core/math.js';

const SELECTOR = '[data-tip],[data-has-tip]';
const DELAY = 350;       // ms before the first tooltip opens
const WARM = 400;        // ms after closing one in which the next opens with no delay
const GAP = 10, EDGE = 8;
const providers = new WeakMap();
let tip = null, target = null, showTimer = 0, refreshTimer = 0, lastHide = 0;

/** Gives `el` a tooltip whose content comes from `provider()` each time it is shown. */
export function setTip(el, provider){
  providers.set(el, provider);
  el.setAttribute('data-has-tip', '');
}

/**
 * A small round "i" button that explains the thing next to it. It is a real button, so the
 * explanation also opens with the keyboard (Tab) and on touch screens (tap).
 */
export function infoButton(name, content){
  const btn = h('button', { type: 'button', class: 'info-btn', 'aria-label': `How it works: ${name}`, html: icon('info') });
  setTip(btn, typeof content === 'function' ? content : () => content);
  btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); show(btn); });
  return btn;
}

function readContent(el){
  const provider = providers.get(el);
  let c = provider ? (typeof provider === 'function' ? provider() : provider) : {
    title: el.dataset.tipTitle,
    body: el.dataset.tip,
    keys: el.dataset.keys ? el.dataset.keys.split(' ') : null
  };
  if (typeof c === 'string') c = { body: c };
  return [
    (c.title || (c.keys && c.keys.length)) && h('div', { class: 'tip-head' },
      c.title && h('strong', {}, c.title),
      c.keys && c.keys.length && h('span', { class: 'tip-keys' }, c.keys.map(k => h('kbd', {}, k)))),
    c.quote && h('p', { class: 'tip-quote' }, c.quote),
    c.body && h('p', { class: 'tip-body' }, c.body),
    c.note && h('p', { class: 'tip-note' }, c.note),
    (c.rules || []).map(r => h('p', { class: 'tip-rule' }, r)),
    c.warn && h('p', { class: 'tip-warn' }, c.warn),
    c.state && h('p', { class: 'tip-state' }, c.state)
  ].flat().filter(Boolean);
}

function place(){
  const r = target.getBoundingClientRect();
  const w = tip.offsetWidth, ht = tip.offsetHeight;
  let side = target.dataset.tipSide || 'top';
  let y = side === 'top' ? r.top - ht - GAP : r.bottom + GAP;
  if (side === 'top' && y < EDGE){ side = 'bottom'; y = r.bottom + GAP; }
  else if (side === 'bottom' && y + ht > innerHeight - EDGE){ side = 'top'; y = r.top - ht - GAP; }
  const centre = r.left + r.width / 2;
  const x = clamp(centre - w / 2, EDGE, innerWidth - w - EDGE);
  tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  tip.style.setProperty('--arrow-x', `${Math.round(clamp(centre - x, 12, w - 12))}px`);
  tip.dataset.side = side;
}

function render(){
  if (!target) return;
  if (!target.isConnected || target.closest('[hidden]')){ hideTip(); return; }
  tip.replaceChildren(...readContent(target));
  place();
}

function describe(el, on){
  const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== 'tooltip');
  if (on) ids.push('tooltip');
  if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
  else el.removeAttribute('aria-describedby');
}

function show(el){
  clearTimeout(showTimer);
  if (target && target !== el) describe(target, false);
  target = el;
  describe(el, true);
  render();
  tip.classList.add('is-visible');
  clearInterval(refreshTimer);
  if (providers.has(el)) refreshTimer = setInterval(render, 250);
}

export function hideTip(){
  clearTimeout(showTimer);
  clearInterval(refreshTimer);
  if (target){
    describe(target, false);
    target = null;
    lastHide = performance.now();
  }
  if (tip) tip.classList.remove('is-visible');
}

const tipTarget = e => (e.target && e.target.closest) ? e.target.closest(SELECTOR) : null;

export function initTooltips(){
  tip = $('tooltip');
  document.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return;
    const el = tipTarget(e);
    if (!el || el === target) return;
    clearTimeout(showTimer);
    const warm = target || performance.now() - lastHide < WARM;
    showTimer = setTimeout(() => show(el), warm ? 0 : DELAY);
  });
  document.addEventListener('pointerout', e => {
    const el = tipTarget(e);
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
    clearTimeout(showTimer);
    if (el === target) hideTip();
  });
  document.addEventListener('focusin', e => {
    const el = tipTarget(e);
    if (el && el.matches(':focus-visible')) show(el);
  });
  document.addEventListener('focusout', e => { if (target && e.target === target) hideTip(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && target) hideTip(); }, true);
  document.addEventListener('pointerdown', e => {
    if (!target) return;
    if (target.contains(e.target)) setTimeout(render, 0);   // the state may change: refresh
    else hideTip();
  }, true);
  document.addEventListener('scroll', hideTip, true);
  window.addEventListener('resize', hideTip);
}
