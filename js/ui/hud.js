// In-game HUD: top bar (status chips, scoreboard, option buttons), boost ring, active penalty,
// the RC remote and the arrow to the ball. Text is only written when it changes.
import * as THREE from '../core/three.js';
import { $, h } from './dom.js';
import { icon } from './icons.js';
import { setTip } from './tooltip.js';
import { initRemote, renderRemote, flashKey, resetRemote } from './remote.js';
import { on } from '../core/events.js';
import { clamp } from '../core/math.js';
import { BUTTON_BY_ID } from '../data/buttons.js';
import { RULES } from '../data/rules.js';
import { MODES } from '../config.js';
import { G, clockText } from '../game/state.js';
import { player } from '../game/actors.js';
import { ball } from '../world/ball.js';
import { camera, app } from '../engine/renderer.js';
import { bgm } from '../audio/music.js';
import { isTouch } from '../input/controls.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
let cache = {};
let els = null;
const pips = [];
const actionButtons = {};

function setText(el, key, value){
  if (cache[key] === value) return;
  cache[key] = value;
  el.textContent = value;
}

/** handlers: onButton(id), onCamera(), onMute(), onHelp(), onPause() */
export function initHud(handlers){
  els = {
    hud: $('hud'), top: $('hudTop'), touch: $('touch'), remote: $('remote'), scoreboard: $('scoreboard'),
    blue: $('sBlue'), orange: $('sOrange'), clock: $('clock'),
    modeChip: $('modeChip'), modeName: $('modeName'), songChip: $('songChip'), songName: $('songChipName'),
    boost: $('boost'), ring: $('boostRing'), boostNum: $('boostNum'), boostLabel: $('boostLabel'),
    penalty: $('penalty'), arrow: $('ballArrow')
  };
  els.arrowRot = els.arrow.querySelector('.arw');
  els.penaltyText = h('span');
  els.penalty.append(h('span', { html: icon('warning') }), els.penaltyText);

  initRemote(handlers.onButton);
  buildActions(handlers);
  buildPips();
  addChipTips();

  on('button:flash', flashKey);
  on('rule', n => {
    const pip = pips[n - 1];
    pip.classList.remove('flash');
    void pip.offsetWidth;
    pip.classList.add('flash');
  });
  on('match:start', () => {
    cache = {};
    resetRemote();
    els.hud.hidden = false;
    els.touch.hidden = !isTouch;
  });
  const hide = () => { els.hud.hidden = true; els.touch.hidden = true; };
  on('match:end', hide);
  on('match:menu', hide);
  on('camera:changed', ballCam => actionButtons.cam.setAttribute('aria-pressed', String(ballCam)));
  on('sound:changed', soundOn => {
    const btn = actionButtons.sound;
    btn.setAttribute('aria-pressed', String(soundOn));
    btn.innerHTML = icon(soundOn ? 'sound' : 'mute');
  });

  // measure the top bar and the remote so other panels can sit next to them
  const measure = () => {
    app.style.setProperty('--hud-top-h', els.top.offsetHeight + 'px');
    app.style.setProperty('--remote-h', els.remote.offsetHeight + 'px');
  };
  new ResizeObserver(measure).observe(els.top);
  new ResizeObserver(measure).observe(els.remote);
}

function buildActions(handlers){
  const ACTIONS = [
    { id: 'cam', icon: 'camera', label: 'Ball camera', keys: ['C'], toggle: true, pressed: false, run: handlers.onCamera },
    { id: 'sound', icon: 'sound', label: 'Sound', keys: ['M'], toggle: true, pressed: true, run: handlers.onMute },
    { id: 'help', icon: 'help', label: 'Rules and help', keys: ['H'], run: handlers.onHelp },
    { id: 'pause', icon: 'pause', label: 'Pause', keys: ['P', 'Esc'], run: handlers.onPause }
  ];
  for (const a of ACTIONS){
    const btn = h('button', {
      type: 'button', class: 'icon-btn', 'aria-label': a.label, 'aria-keyshortcuts': a.keys.join(' '),
      'aria-pressed': a.toggle ? String(a.pressed) : null, 'data-tip-side': 'bottom', html: icon(a.icon)
    });
    btn.addEventListener('click', () => { a.run(); btn.blur(); });
    setTip(btn, () => ({
      title: a.toggle ? `${a.label}: ${btn.getAttribute('aria-pressed') === 'true' ? 'ON' : 'OFF'}` : a.label,
      keys: a.keys
    }));
    $('hudActions').append(btn);
    actionButtons[a.id] = btn;
  }
}

function buildPips(){
  for (const r of RULES){
    const pip = h('li', { class: 'pip', 'data-tip-side': 'bottom' }, String(r.n));
    setTip(pip, () => {
      const n = G.ruleCounts[r.n - 1];
      return {
        title: `Rule ${r.n}`,
        quote: r.text,
        rules: [`Penalty: ${r.penalty}`],
        state: n ? `You broke it ${plural(n, 'time')}.` : 'Not broken yet. Well done!'
      };
    });
    $('rulePips').append(pip);
    pips.push(pip);
  }
}

function addChipTips(){
  setTip(els.scoreboard, () => ({
    title: G.overtime ? 'Overtime' : 'Score and clock',
    body: 'You are BLUE: score in the orange goal. The orange car is the other team.',
    note: G.overtime ? 'It was a draw, so the next goal wins the match.' : `${clockText()} left. If it is a draw at 0:00, the next goal wins.`
  }));
  setTip(els.penalty, () => ({
    title: 'Penalty',
    body: 'You broke a rule, so something stops working for a few seconds.',
    note: 'Point at the rule lights (top left) to see the rules you broke.'
  }));
  setTip(els.modeChip, () => ({
    title: 'Mode',
    quote: BUTTON_BY_ID[player.mode] ? BUTTON_BY_ID[player.mode].desc : null,
    body: `Your car is now: ${MODES[player.mode].name}.`,
    state: player.mode === 'car' ? 'Use the TRANSFORM buttons to change it.' : 'Press the same button again to go back to the RC car.'
  }));
  setTip(els.songChip, () => ({
    title: 'Music',
    body: bgm.el ? bgm.name : 'Built-in stadium beat',
    state: G.radioBrokenT > 0 ? 'The radio is broken.' : player.radio ? 'RADIO is ON: the music is loud.' : 'Press RADIO (R) to make it louder.'
  }));
  setTip(els.boost, () => ({
    title: 'Boost',
    keys: ['Shift'],
    body: `${Math.round(player.boost)} / 100. TURBO uses it while you accelerate.`,
    state: player.turbo ? 'Turbo is ON.' : 'Drive over a glowing pad to refill it.'
  }));
}

function activePenalty(){
  if (player.dead > 0) return `Your car exploded. Back in ${Math.ceil(player.dead)} s`;
  if (player.stall > 0) return `Engine stalled: ${Math.ceil(player.stall)} s`;
  if (G.radioBrokenT > 0) return `Radio broken: ${Math.ceil(G.radioBrokenT)} s`;
  return '';
}

export function refreshHud(){
  setText(els.blue, 'blue', G.score.blue);
  setText(els.orange, 'orange', G.score.orange);
  setText(els.clock, 'clock', clockText());
  if (cache.ot !== G.overtime){ cache.ot = G.overtime; els.scoreboard.classList.toggle('is-ot', G.overtime); }

  if (cache.mode !== player.mode){
    cache.mode = player.mode;
    els.modeName.textContent = MODES[player.mode].name;
    const b = BUTTON_BY_ID[player.mode];
    els.modeChip.style.setProperty('--mode-color', b ? b.color : 'var(--text)');
  }

  const ruleSig = G.ruleCounts.join(',');
  if (cache.rules !== ruleSig){
    cache.rules = ruleSig;
    pips.forEach((pip, i) => {
      const n = G.ruleCounts[i];
      pip.classList.toggle('is-broken', n > 0);
      if (n > 1) pip.dataset.count = n; else delete pip.dataset.count;
    });
  }

  setText(els.songName, 'song', bgm.el ? bgm.name : 'Stadium beat');
  const songState = G.radioBrokenT > 0 ? 'off' : player.radio ? 'on' : '';
  if (cache.songState !== songState){
    cache.songState = songState;
    els.songChip.classList.toggle('is-on', songState === 'on');
    els.songChip.classList.toggle('is-off', songState === 'off');
  }

  const boost = Math.round(player.boost);
  if (cache.boost !== boost){
    cache.boost = boost;
    els.ring.style.setProperty('--b', boost);
    els.boostNum.textContent = boost;
    els.ring.classList.toggle('is-low', boost < 15);
  }
  if (cache.turbo !== player.turbo){
    cache.turbo = player.turbo;
    els.ring.classList.toggle('is-turbo', player.turbo);
    els.boostLabel.textContent = player.turbo ? 'TURBO' : 'BOOST';
  }

  const penalty = activePenalty();
  if (cache.penalty !== penalty){
    cache.penalty = penalty;
    els.penalty.hidden = !penalty;
    els.penaltyText.textContent = penalty;
  }

  renderRemote();
}

const projected = new THREE.Vector3();

/** Shows an arrow on the edge of the screen pointing to the ball when you can't see it. */
export function updateBallArrow(){
  let show = false;
  if (ball.visible){
    projected.copy(ball.pos).project(camera);
    let x = projected.x, y = projected.y;
    const behind = projected.z > 1;
    if (behind){ x = -x; y = -y; }
    if (behind || Math.abs(x) > .95 || Math.abs(y) > .95){
      show = true;
      const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
      x /= m; y /= m;
      const w = app.clientWidth, ht = app.clientHeight;
      const top = els.top.offsetHeight + 40, bottom = els.remote.offsetHeight + 60;
      const px = clamp((x * .5 + .5) * w, 40, w - 40), py = clamp((-y * .5 + .5) * ht, top, ht - bottom);
      els.arrow.style.transform = `translate(${px}px, ${py}px)`;
      els.arrowRot.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
    }
  }
  if (els.arrow.hidden === show) els.arrow.hidden = !show;
}
