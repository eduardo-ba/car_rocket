// "How to play" guide in four tabs (Controls, Moves, 10 Buttons, 5 Rules). Built from the data files,
// so the menu, the pause screen and the game always say the same thing.
import { h } from './dom.js';
import { setTip } from './tooltip.js';
import { createTabs } from './tabs.js';
import { BUTTONS, BUTTON_BY_ID, buttonsIn } from '../data/buttons.js';
import { RULES } from '../data/rules.js';
import { lineForButton, lineForRule } from '../data/voice-lines.js';
import { listenButton, listenAllButton } from './listen.js';

const CONTROLS = [
  ['Accelerate', ['W', '↑']],
  ['Brake and reverse', ['S', '↓']],
  ['Turn left / right', ['A', 'D', '←', '→']],
  ['JUMP (hold it to jump higher)', ['Space']],
  ['Flip: jump, then a direction + Space', ['W', 'A', 'S', 'D']],
  ['Powerslide / air roll (hold)', ['Q', 'E']],
  ['TURBO on / off', ['Shift']],
  ['GOAL: power shot', ['F']],
  ['RADIO', ['R']],
  ['TRANSFORM: SUB, TRANSFORMER, PLANE, TUNING, 4X4, MAD MAX', ['1 – 6']],
  ['Ball camera', ['C']],
  ['Pause', ['P', 'Esc']],
  ['Rules and help', ['H']],
  ['Sound on / off', ['M']]
];

const kbds = keys => h('span', { class: 'keys' }, keys.map(k => h('kbd', {}, k)));

function controlsPanel(){
  return h('div', {},
    h('ul', { class: 'keys-list' }, CONTROLS.map(([label, keys]) => h('li', {}, h('span', {}, label), kbds(keys)))),
    h('p', { class: 'guide-note' }, 'You can also click the buttons on the screen. Press a TRANSFORM button again to go back to the normal RC car.'),
    h('p', { class: 'guide-note' }, 'Tip: point at anything on the screen (or move to it with Tab) to see what it does.'));
}

/* Rocket League moves: [name, keys, what it does, tip] */
const MOVES_LIST = [
  ['Jump', ['Space'], 'A quick tap is a small hop. Hold it to jump higher.', null],
  ['Double jump', ['Space', 'Space'], 'Press JUMP again in the air with no direction.', 'You have about 1.3 seconds after jumping.'],
  ['Front flip', ['W', 'Space'], 'In the air, hold W and press JUMP: the car flips forward and speeds up.', 'Flip into the ball for a DODGE HIT: a much harder shot.'],
  ['Backflip', ['S', 'Space'], 'In the air, hold S and press JUMP: the car flips backwards.', null],
  ['Side flip', ['A', 'D', 'Space'], 'In the air, hold A or D and press JUMP: the car rolls to that side.', 'W or S with A or D is a diagonal flip.'],
  ['Half flip', ['S', 'Space', 'W'], 'While you drive backwards: backflip, then press W right away. The car turns around and keeps its speed.', 'The fastest way to turn around.'],
  ['Air control', ['W', 'S', 'A', 'D'], 'In the air, W / S tilt the nose down / up and A / D turn the car.', null],
  ['Air roll', ['Q', 'E'], 'In the air, hold Q or E to roll left or right.', null],
  ['Aerial', ['Space', 'S', 'Shift'], 'Jump, tilt the nose up with S and turn TURBO on: the car flies!', 'In the air, turbo pushes where the nose points.'],
  ['Powerslide', ['Q', 'E'], 'On the ground, hold Q or E while turning: the car drifts and turns faster.', null],
  ['Boost pads', [], 'Big orbs fill the boost bar. Small discs give 12 boost.', "You can't take a pad when your boost is full."],
  ['Supersonic', [], 'At top speed the car leaves a white trail.', null]
];

function movesPanel(){
  return h('div', {},
    h('p', { class: 'guide-note guide-note-top' }, 'The moves from Rocket League. Remember rule 4: 4 jumps in 1.5 seconds and your car explodes!'),
    h('ul', { class: 'moves-list' }, MOVES_LIST.map(([name, keys, text, tip]) => h('li', {},
      h('div', { class: 'move-head' }, h('b', {}, name), keys.length ? kbds(keys) : null),
      h('p', { class: 'btn-desc' }, text),
      tip && h('p', { class: 'btn-how' }, tip)))));
}

function ruleTag(n){
  const rule = RULES[n - 1];
  const tag = h('span', { class: 'rtag' }, `Rule ${n}`);
  setTip(tag, () => ({ title: `Rule ${n}`, body: rule.text, rules: [`Penalty: ${rule.penalty}`] }));
  return tag;
}

function panelBar(ids, text, tip, hint){
  return h('div', { class: 'panel-bar' }, listenAllButton(ids, text, tip), h('p', { class: 'panel-hint' }, hint));
}

function buttonsPanel(){
  const group = (name, title) => h('section', { class: 'guide-group' },
    h('h3', { class: 'guide-h' }, title),
    h('ol', { class: 'btn-list' }, buttonsIn(name).map(b => {
      const line = lineForButton(b.id);
      return h('li', { 'data-line-row': line.id },
        h('span', { class: 'key-chip' + (b.key.length > 1 ? ' is-word' : ''), style: `--c:${b.color}`, 'aria-hidden': 'true' }, b.key),
        h('div', {},
          h('div', { class: 'btn-title' }, h('b', {}, b.name), h('span', { class: 'btn-keys' }, b.keys.map(k => h('kbd', {}, k))), b.rules.map(ruleTag)),
          h('p', { class: 'btn-desc' }, b.desc),
          h('p', { class: 'btn-how' }, b.how)),
        listenButton(line.id, { label: `Listen to ${b.name}` }));
    })));
  return h('div', {},
    panelBar(BUTTONS.map(b => lineForButton(b.id).id), 'Listen to all 10', 'Hear the sentence of every button, in our own voices.', 'Press the speaker to hear a button.'),
    group('action', 'Actions'), group('transform', 'Transform'));
}

function rulesPanel(){
  return h('div', {},
    panelBar(RULES.map(r => lineForRule(r.n).id), 'Listen to all 5', 'Hear the 5 rules, one after the other.', 'The narrator also reads a rule when you break it.'),
    h('ol', { class: 'rule-list' }, RULES.map(r => h('li', { 'data-line-row': lineForRule(r.n).id },
      h('span', { class: 'rule-num', 'aria-hidden': 'true' }, r.n),
      h('div', {},
        h('p', { class: 'rule-text' }, r.text),
        h('p', { class: 'rule-penalty' }, 'Penalty: ' + r.penalty),
        h('p', { class: 'rule-buttons' }, r.buttons.map(id => {
          const b = BUTTON_BY_ID[id];
          return h('span', { class: 'mini-key', style: `--c:${b.color}` }, `${b.key} ${b.name}`);
        }))),
      listenButton(lineForRule(r.n).id, { label: `Listen to rule ${r.n}` })))));
}

/** Returns {el, select(tabId)}. */
export function buildGuide(label){
  return createTabs([
    { id: 'controls', label: 'Controls', content: controlsPanel() },
    { id: 'moves', label: 'Moves', content: movesPanel() },
    { id: 'buttons', label: '10 Buttons', content: buttonsPanel() },
    { id: 'rules', label: '5 Rules', content: rulesPanel() }
  ], { label });
}
