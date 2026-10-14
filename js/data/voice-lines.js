// Everything the narrator can say: the introduction, the 10 buttons and the 5 rules.
// They are built from buttons.js and rules.js, whose sentences are the ones the team says in its
// recordings (assets/voices/), so the voice always says the same sentences that the game shows.
//   id     the file name in assets/voices/ (jump.mp3, rule1.mp3...)
//   label  short name of the line
//   text   what the recording says (also the caption)
import { BUTTONS } from './buttons.js';
import { RULES } from './rules.js';

const INTRO = "Welcome to Car Rocket! You are a mechanic, and your objective is to make the perfect car. You need to score to be the most sigma person in the world. You are ready to become the most sigma. Let's go!";

export const VOICE_LINES = [
  { id: 'intro', group: 'intro', label: 'Welcome', text: INTRO },
  ...BUTTONS.map(b => ({
    id: b.id === '4x4' ? 'fourbyfour' : b.id,
    button: b.id,
    group: 'button',
    label: `${b.key} · ${b.name}`,
    color: b.color,
    text: b.desc
  })),
  ...RULES.map(r => ({
    id: 'rule' + r.n,
    rule: r.n,
    group: 'rule',
    label: `Rule ${r.n}`,
    text: r.text
  }))
];

export const LINE_BY_ID = Object.fromEntries(VOICE_LINES.map(l => [l.id, l]));
export const lineForButton = id => VOICE_LINES.find(l => l.button === id);
export const lineForRule = n => LINE_BY_ID['rule' + n];

export const VOICE_GROUPS = [
  { id: 'intro', title: 'Introduction' },
  { id: 'button', title: 'The 10 buttons' },
  { id: 'rule', title: 'The 5 rules' }
];
