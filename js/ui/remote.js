// The RC remote: the 10 buttons grouped into ACTIONS and TRANSFORM.
// Each button shows its state (on, recharging, broken, ready, warning) and has a live tooltip
// with its keys, what it does, its rules and its current state. The DOM is only touched when
// a button's state changes.
import { $, h } from './dom.js';
import { setTip } from './tooltip.js';
import { BUTTONS, buttonsIn } from '../data/buttons.js';
import { RULES } from '../data/rules.js';
import { remoteState, TOGGLE_BUTTONS } from '../game/remote-state.js';
import { setHeld } from '../input/controls.js';

const items = {};

export function initRemote(onPress){
  const groups = { action: $('remoteActions'), transform: $('remoteTransforms') };
  for (const b of [...buttonsIn('action'), ...buttonsIn('transform')]){
    const badge = h('span', { class: 'rkey-badge', 'aria-hidden': 'true' });
    const el = h('button', {
      type: 'button', class: 'rkey', tabindex: '-1', 'data-id': b.id, style: `--c:${b.color}`,
      'aria-keyshortcuts': b.keys.join(' '),
      'aria-pressed': TOGGLE_BUTTONS.has(b.id) ? 'false' : null
    },
      h('span', { class: 'rkey-fill', 'aria-hidden': 'true' }),
      h('span', { class: 'rkey-num' + (b.key.length > 1 ? ' is-word' : ''), 'aria-hidden': 'true' }, b.key),
      h('span', { class: 'rkey-name' + (b.name.length > 8 ? ' is-long' : '') }, b.name),
      badge);
    // pointerdown instead of click: a game button must react the moment it is pressed
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      if (b.id === 'jump') setHeld('jump', true);     // holding JUMP jumps higher
      onPress(b.id);
    });
    if (b.id === 'jump'){
      for (const type of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(type, () => setHeld('jump', false));
    }
    el.addEventListener('contextmenu', e => e.preventDefault());
    setTip(el, () => tooltipFor(b));
    groups[b.group].append(el);
    items[b.id] = { el, badge, key: '', timer: 0 };
  }
  setTip($('remoteActionsLabel'), {
    title: 'Actions',
    body: 'Things your car does: jump, turbo, a power shot and the radio.',
    note: 'They sit around W A S D: Space, Shift, F and R. You never let go of the steering.'
  });
  setTip($('remoteTransformsLabel'), {
    title: 'Transform',
    body: 'Six new forms for your RC car. Each one drives in a different way.',
    note: 'Keys 1 to 6. Press the same button again to go back to the normal RC car. Remember: 4 TUNING before 5 4X4.'
  });
}

function tooltipFor(b){
  const s = remoteState(b.id);
  return {
    title: b.name,
    keys: b.keys,
    quote: b.desc,
    body: b.how,
    rules: b.rules.map(n => `Rule ${n}: ${RULES[n - 1].short}`),
    warn: s.warn,
    state: s.state
  };
}

export function renderRemote(){
  for (const b of BUTTONS){
    const s = remoteState(b.id), it = items[b.id];
    const key = `${s.on}|${s.dim}|${s.ready}|${s.broken}|${!!s.warn}|${s.badge}|${Math.round(s.cooldown * 50)}`;
    if (key === it.key) continue;
    it.key = key;
    const cl = it.el.classList;
    cl.toggle('is-on', s.on);
    cl.toggle('is-dim', s.dim);
    cl.toggle('is-ready', s.ready);
    cl.toggle('is-broken', s.broken);
    cl.toggle('is-warn', !!s.warn);
    if (TOGGLE_BUTTONS.has(b.id)) it.el.setAttribute('aria-pressed', String(s.on));
    it.el.style.setProperty('--p', s.cooldown.toFixed(3));
    it.badge.textContent = s.badge;
  }
}

/** Press animation, also used when the button is triggered from the keyboard. */
export function flashKey(id){
  const it = items[id];
  if (!it) return;
  it.el.classList.remove('press');
  void it.el.offsetWidth;
  it.el.classList.add('press');
  clearTimeout(it.timer);
  it.timer = setTimeout(() => it.el.classList.remove('press'), 140);
}

/** Makes the given buttons pulse (the tutorial shows which one to press). */
export function setHint(ids){
  for (const [id, it] of Object.entries(items)) it.el.classList.toggle('is-hint', ids.includes(id));
}

/** Forces a full redraw (for example when a new match starts). */
export function resetRemote(){
  for (const it of Object.values(items)) it.key = '';
}
