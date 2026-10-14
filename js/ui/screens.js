// Menu, pause and end screens. They open as modal dialogs (see dialog.js); restarting or
// quitting a match asks for confirmation first, because it can't be undone.
import { $, h } from './dom.js';
import { icon, iconNode } from './icons.js';
import { openScreen, closeScreen, confirmBox } from './dialog.js';
import { hideTip } from './tooltip.js';
import { buildGuide } from './guide.js';
import { buildSettings, initSettings } from './settings.js';
import { listenButton } from './listen.js';
import { setTip } from './tooltip.js';
import { lineForRule } from '../data/voice-lines.js';
import { on } from '../core/events.js';
import { RULES } from '../data/rules.js';
import { G, clockText } from '../game/state.js';

const SCREENS = ['menu', 'pause', 'end'];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
let pauseGuide = null;

/** handlers: onPlay() (the tutorial, then the match), onMatch(), onResume(), onRestart(), onMenu(), onTour() */
export function initScreens(handlers){
  initSettings();
  $('menuSettings').append(buildSettings({ difficulty: true }).el);
  $('menuGuide').append(buildGuide('How to play').el);
  $('pauseSettings').append(buildSettings({ difficulty: false }).el);
  pauseGuide = buildGuide('Help');
  $('pauseGuide').append(pauseGuide.el);

  $('restartBtn').prepend(iconNode('restart'));
  $('quitBtn').prepend(iconNode('home'));
  $('tourBtn').prepend(iconNode('tour'));
  $('introListen').replaceWith(listenButton('intro', { label: 'Listen to the introduction', small: true }));
  setTip($('tourBtn'), { title: 'HUD tour', body: 'A short guide that shows each part of the screen and explains it.', note: 'The match waits while the tour is open.' });
  $('tourBtn').addEventListener('click', handlers.onTour);
  $('playBtn').addEventListener('click', handlers.onPlay);
  setTip($('playBtn'), {
    title: 'Play',
    body: 'First the tutorial teaches you the 10 buttons and the 5 rules. Then you play a 3-minute match against the orange car.',
    note: 'Already know how to play? Press SKIP TUTORIAL on the tutorial card.'
  });
  $('againBtn').addEventListener('click', handlers.onMatch);
  $('endMenuBtn').addEventListener('click', handlers.onMenu);
  $('resumeBtn').addEventListener('click', handlers.onResume);
  $('restartBtn').addEventListener('click', async () => {
    const yes = await confirmBox({
      title: G.tutorial ? 'Restart the tutorial?' : 'Restart the match?',
      text: G.tutorial ? 'The tutorial starts again from the first lesson.' : 'The score and the clock start again from zero.',
      ok: 'Restart', cancel: 'Keep playing'
    });
    if (yes) handlers.onRestart();
  });
  $('quitBtn').addEventListener('click', async () => {
    const yes = await confirmBox({
      title: 'Quit to the menu?', text: 'This match will end and the score will be lost.',
      ok: 'Quit', cancel: 'Keep playing'
    });
    if (yes) handlers.onMenu();
  });

  on('match:start', () => {
    hideTip();
    for (const id of SCREENS) closeScreen($(id));
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });
  on('match:pause', (paused, tab) => {
    hideTip();
    if (!paused){ closeScreen($('pause')); return; }
    $('pauseSummary').textContent = pauseSummary();
    pauseGuide.select(tab || 'buttons');
    openScreen($('pause'), $('resumeBtn'));
  });
  on('match:end', showEnd);
  on('match:menu', () => {
    hideTip();
    closeScreen($('pause'));
    closeScreen($('end'));
    showMenu();
  });
}

export function showMenu(){
  openScreen($('menu'), $('playBtn'));
}

/** The start screen. Browsers keep the page silent until the first click or key, so that first
    press closes it and calls onStart() (sound on, menu, welcome). */
export function showStart(onStart){
  const el = $('start');
  openScreen(el, $('startBtn'));
  const go = e => {
    if (e.type === 'keydown' && (e.repeat || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key))) return;
    e.preventDefault();
    e.stopImmediatePropagation();   // the same key must not also press PLAY
    window.removeEventListener('keydown', go, true);
    el.removeEventListener('click', go);
    closeScreen(el);
    onStart();
  };
  window.addEventListener('keydown', go, true);
  el.addEventListener('click', go);
}

function pauseSummary(){
  if (G.tutorial) return 'Tutorial: practice match, no clock.';
  const time = G.overtime ? `Overtime ${clockText()}` : `${clockText()} left`;
  return `BLUE ${G.score.blue} – ${G.score.orange} ORANGE · ${time}`;
}

function showEnd(r){
  hideTip();
  $('endEyebrow').textContent = r.overtime ? 'Overtime' : 'Full time';
  $('endTitle').textContent = r.blue > r.orange ? 'YOU WIN!' : r.blue < r.orange ? 'YOU LOSE' : 'DRAW';
  $('endB').textContent = r.blue;
  $('endO').textContent = r.orange;
  $('endVerdict').textContent = r.rulesBroken === 0
    ? 'Perfect! You followed all 5 rules.'
    : `You broke the rules ${plural(r.rulesBroken, 'time')}.`;
  $('endRules').replaceChildren(...RULES.map((rule, i) => {
    const n = r.ruleCounts[i];
    const text = h('span', { class: 'report-text', tabindex: '0' }, h('b', {}, `Rule ${rule.n}: `), rule.short);
    setTip(text, { title: `Rule ${rule.n}`, quote: rule.text, rules: [`Penalty: ${rule.penalty}`] });
    return h('li', { class: n ? 'is-broken' : 'is-ok' },
      h('span', { class: 'report-icon', html: icon(n ? 'x' : 'check') }),
      text,
      h('span', { class: 'report-status' }, n ? `Broken ${n}×` : 'Followed'),
      listenButton(lineForRule(rule.n).id, { label: `Listen to rule ${rule.n}`, small: true }));
  }));
  openScreen($('end'), $('againBtn'));
}
