// Keyboard and touch controls. The game asks for the current input with readInput();
// one-off actions (buttons, pause, help, camera...) go to the handlers passed to initControls().
import { BUTTON_BY_KEY } from '../data/buttons.js';

const MOVE = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' };
const keys = { up: 0, down: 0, left: 0, right: 0, jump: 0, rollL: 0, rollR: 0 };
const touch = { up: 0, down: 0, left: 0, right: 0, jump: 0, slide: 0 };
const JUMP_KEYS = new Set([' ']);   // held = higher jump (the key layout is in data/buttons.js)
const HOLD = { q: 'rollL', e: 'rollR' };   // powerslide on the ground, air roll in the air

export const isTouch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

/**
 * {t: throttle -1..1, s: steer -1..1 (left is +), jump: JUMP held, slide: powerslide held,
 *  roll: air roll -1..1 (left is +)}
 */
export function readInput(){
  const up = keys.up || touch.up, down = keys.down || touch.down;
  const left = keys.left || touch.left, right = keys.right || touch.right;
  return {
    t: (up ? 1 : 0) - (down ? 1 : 0),
    s: (left ? 1 : 0) - (right ? 1 : 0),
    jump: !!(keys.jump || touch.jump),
    slide: !!(keys.rollL || keys.rollR || touch.slide),
    roll: keys.rollL - keys.rollR
  };
}

/** The on-screen JUMP button says when it is held, so holding it jumps higher too. */
export function setHeld(name, on){ touch[name] = on ? 1 : 0; }

const releaseAll = () => {
  for (const k of Object.keys(keys)) keys[k] = 0;
  touch.jump = touch.slide = 0;
};

/**
 * handlers: inMenu(), isPaused(), isBlocked() (a confirm box is open), onStart(), onPause(bool),
 * onHelp(), onButton(id), onCamera(), onMute(), onHidden()
 */
export function initControls(h){
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (h.isBlocked()) return;                       // the confirm box handles its own keys
    if (h.inMenu()){
      const onControl = e.target && e.target.closest && e.target.closest('button,label,input,select,textarea,[role="tab"]');
      if (k === 'enter' && !e.repeat && !onControl){ e.preventDefault(); h.onStart(); }
      return;
    }
    if (h.isPaused()){
      if (e.repeat) return;
      if (k === 'escape' || k === 'p'){ e.preventDefault(); h.onPause(false); }
      else if (k === 'h') h.onHelp();
      return;
    }
    if (MOVE[k]){ keys[MOVE[k]] = 1; e.preventDefault(); return; }
    if (HOLD[k]){ keys[HOLD[k]] = 1; return; }
    if (JUMP_KEYS.has(k)) keys.jump = 1;
    if (BUTTON_BY_KEY[k]) e.preventDefault();
    if (e.repeat) return;
    if (k === 'escape' || k === 'p') return h.onPause(true);
    if (k === 'h') return h.onHelp();
    if (BUTTON_BY_KEY[k]) return h.onButton(BUTTON_BY_KEY[k].id);
    if (k === 'c') return h.onCamera();
    if (k === 'm') return h.onMute();
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (MOVE[k]) keys[MOVE[k]] = 0;
    if (HOLD[k]) keys[HOLD[k]] = 0;
    if (JUMP_KEYS.has(k)) keys.jump = 0;
  });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    releaseAll();
    h.onHidden();
  });

  for (const el of document.querySelectorAll('#touch [data-k]')){
    const dir = el.dataset.k;
    el.addEventListener('pointerdown', e => { e.preventDefault(); touch[dir] = 1; el.classList.add('held'); });
    const release = () => { touch[dir] = 0; el.classList.remove('held'); };
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(type, release);
  }
}
