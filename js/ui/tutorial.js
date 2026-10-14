// Tutorial: a practice match (no clock, the orange car stays away) that teaches the 10 buttons
// and the 5 rules one lesson at a time. Each lesson says what to do, lights up the button to press
// on the remote, and checks that you did it. The narrator plays our team's recording of the button
// or the rule; the instruction itself is only on screen (there is no computer voice).
// A rule lesson can also be "learned the hard way": breaking the rule shows its penalty and counts.
import { $, h } from './dom.js';
import { icon } from './icons.js';
import { setHint } from './remote.js';
import { on } from '../core/events.js';
import { G, inMatch } from '../game/state.js';
import { player } from '../game/actors.js';
import { ball } from '../world/ball.js';
import { BUTTON_BY_ID } from '../data/buttons.js';
import { RULES } from '../data/rules.js';
import { lineForButton, lineForRule } from '../data/voice-lines.js';
import { narrate, stopVoice } from '../audio/voice.js';
import { BALL_R, HALF_W, HALF_L } from '../config.js';
import { clamp } from '../core/math.js';

const AUTO_NEXT = 2.6;   // seconds after a lesson is done before the next one starts

/* ---------- what happened during the current lesson ---------- */
const L = { used: new Set(), jumps: 0, rules: [], scored: false, goalSafe: false };
on('button:used', id => { if (G.tutorial){ L.used.add(id); if (id === 'jump') L.jumps++; } });
on('rule', n => { if (G.tutorial) L.rules.push(n); });

const ballDistance = () => Math.hypot(ball.pos.x - player.pos.x, ball.pos.z - player.pos.z);
const was = mode => () => player.mode === mode;

/** Puts the ball a few metres in front of the car (for the power shot lesson). */
function ballInFront(){
  if (!ball.visible || ballDistance() < 14) return;
  const d = 7, fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  ball.pos.set(clamp(player.pos.x + fx * d, -HALF_W + 4, HALF_W - 4), BALL_R, clamp(player.pos.z + fz * d, -HALF_L + 6, HALF_L - 6));
  ball.vel.set(0, 0, 0);
}

/* ---------- the lessons ----------
   button / rule: what the lesson is about (its sentence is read and shown)
   text: the instruction · keys: keys to show
   tasks: [{label, button, done()}] (a task stays done once done; button = what lights up)
   learn: {rule, text}: breaking that rule also completes the lesson, with this message
   oops: {rule: text}: message when you break a rule here (the lesson goes on)
   start(): sets things up when the lesson begins */
const LESSONS = [
  { title: 'Welcome to the tutorial!',
    text: 'You will learn the 10 buttons and the 5 rules, one by one. Do what each card says: the game checks it for you. The orange car stays away and there is no clock.',
    note: 'Press Enter or NEXT to start. Already know how to play? Press SKIP TUTORIAL.' },

  { title: 'Drive', keys: ['W', 'A', 'S', 'D'],
    text: 'W accelerates, S brakes and reverses, A and D turn. Hold Q or E to drift. Drive into the ball!',
    tasks: [{ label: 'Touch the ball', done: () => ball.visible && ballDistance() < BALL_R + 2.6 && Math.abs(ball.pos.y - player.pos.y) < 4 }] },

  { title: 'JUMP', button: 'jump', keys: ['Space'],
    text: 'Press SPACE to jump. Tap it for a small hop, hold it to jump higher. In the air, a direction + SPACE does a flip.',
    tasks: [{ label: 'Jump', button: 'jump', done: () => L.jumps >= 1 }] },

  { title: 'Rule 4', rule: 4, keys: ['Space'],
    text: '4 jumps in 1.5 seconds and your car explodes! Jump 3 times, slowly: wait a moment between the jumps.',
    tasks: [{ label: 'Jump 3 times without exploding', button: 'jump', done: () => L.jumps >= 3 }],
    learn: { rule: 4, text: 'BOOM! That was rule 4. Now you know: slow down with JUMP.' } },

  { title: 'TURBO', button: 'turbo', keys: ['Shift'],
    start: () => { player.turbo = false; player.boost = 100; },
    text: 'Press SHIFT to turn TURBO on, and press it again to turn it off. It uses the boost bar (bottom right). Drive over the glowing pads to fill it.',
    tasks: [{ label: 'Turn TURBO on', button: 'turbo', done: () => player.turbo }] },

  { title: 'GOAL', button: 'goal', keys: ['F'],
    start: ballInFront,
    text: 'Get close to the ball and press F: a power shot into the orange goal! Then the button recharges for 10 seconds.',
    tasks: [{ label: 'Power shot', button: 'goal', done: () => L.used.has('goal') }] },

  { title: 'Rule 2', rule: 2, keys: ['Space'],
    text: 'When you score, DON\'T press JUMP until the next kickoff, or your goal is cancelled! Score a goal and keep your thumb away from SPACE.',
    tasks: [
      { label: 'Score a goal', done: () => L.scored },
      { label: "Don't jump until the kickoff", done: () => L.goalSafe }
    ],
    learn: { rule: 2, text: 'NO GOAL! That was rule 2: after you score, never press JUMP.' } },

  { title: 'RADIO', button: 'radio', keys: ['R'],
    start: () => { player.radio = false; },
    text: 'Press R one time: the antenna goes up and the music gets louder.',
    tasks: [{ label: 'Radio ON', button: 'radio', done: () => player.radio }] },

  { title: 'Rule 3', rule: 3, keys: ['R'],
    text: 'Don\'t double-click on the RADIO, or it breaks for 10 seconds. Press R one time, slowly, to turn it off.',
    tasks: [{ label: 'Turn the radio off with one press', button: 'radio', done: () => !player.radio && G.radioBrokenT <= 0 }],
    learn: { rule: 3, text: 'CRACK! That was a double-click: rule 3. No music for 10 seconds.' } },

  { title: 'SUBMARINE', button: 'sub', keys: ['1'],
    text: 'The TRANSFORM buttons are the keys 1 to 6. Press 1: SUBMARINE. The field fills with water and SPACE swims up. Press 1 again to go back to the RC car.',
    tasks: [
      { label: 'Press 1: SUBMARINE', button: 'sub', done: was('sub') },
      { label: 'Press 1 again: back to the RC car', button: 'sub', done: was('car') }
    ] },

  { title: 'TRANSFORMER', button: 'robot', keys: ['2'],
    text: 'Press 2: TRANSFORMER. It is slow, but it kicks the ball very hard.',
    tasks: [{ label: 'Press 2: TRANSFORMER', button: 'robot', done: was('robot') }] },

  { title: 'PLANE', button: 'plane', keys: ['3', 'W'],
    text: 'Press 3: PLANE. Drive fast and hold W to fly.',
    tasks: [{ label: 'Press 3: PLANE', button: 'plane', done: was('plane') }] },

  { title: 'Rule 5', rule: 5, keys: ['4', '5'],
    text: 'TUNING (4) is the fastest car in the world. 4X4 (5) only works after TUNING: that is why they sit next to each other. First 4, then 5!',
    tasks: [
      { label: 'Press 4: TUNING', button: 'tuning', done: () => G.tuningUsed },
      { label: 'Press 5: 4X4', button: '4x4', done: was('4x4') }
    ],
    oops: { 5: 'That was rule 5: the wheels got stuck. Press 4 (TUNING) first, then 5.' } },

  { title: 'Rule 1', rule: 1, keys: ['Shift', '6'],
    start: () => { player.turbo = false; player.boost = 100; },
    text: 'MAD MAX (6) has spikes and armor, but it needs TURBO. Turn TURBO on with SHIFT, then press 6.',
    tasks: [
      { label: 'TURBO on (Shift)', button: 'turbo', done: () => player.turbo },
      { label: 'Press 6: MAD MAX', button: 'madmax', done: was('madmax') }
    ],
    oops: { 1: 'That was rule 1: the engine stalled. Turn TURBO on first (Shift), then press 6.' } },

  { title: 'You did it!', final: true,
    text: 'Now you know the 10 buttons and the 5 rules. In a match, a yellow "!" on a button means: pressing it now breaks a rule. Point at anything on the screen to see what it does.',
    note: 'Ready for a real match against the orange car?' }
];

/* ---------- state and interface ---------- */
let el = null, n = 0, lesson = LESSONS[0], doneT = -1, learned = '', feedback = '', ticks = [], handlers = null;

const isOpen = () => G.tutorial && inMatch() && el && !el.hidden;

function speak(){
  const items = [];
  if (lesson.button) items.push(lineForButton(lesson.button).id);
  if (lesson.rule) items.push(lineForRule(lesson.rule).id);
  narrate(items);
}

function begin(i){
  n = clamp(i, 0, LESSONS.length - 1);
  lesson = LESSONS[n];
  L.used.clear(); L.jumps = 0; L.rules.length = 0; L.scored = false; L.goalSafe = false;
  ticks = (lesson.tasks || []).map(() => false);
  doneT = -1; learned = ''; feedback = '';
  if (lesson.start) lesson.start();
  draw();
  speak();
}

const allDone = () => ticks.length > 0 && ticks.every(Boolean);

function draw(){
  const b = lesson.button && BUTTON_BY_ID[lesson.button], r = lesson.rule && RULES[lesson.rule - 1];
  const finished = allDone() || !!learned;
  $('tutCount').textContent = `Lesson ${n + 1} / ${LESSONS.length}`;
  $('tutBar').style.setProperty('--p', (n / (LESSONS.length - 1)).toFixed(3));
  const tag = $('tutTag');
  tag.hidden = !b && !r;
  if (b){ tag.textContent = `${b.key} · ${b.name}`; tag.style.setProperty('--c', b.color); tag.className = 'tut-tag'; }
  else if (r){ tag.textContent = `RULE ${r.n}`; tag.style.removeProperty('--c'); tag.className = 'tut-tag is-rule'; }
  $('tutTitle').textContent = lesson.title;
  const quote = $('tutQuote');
  quote.hidden = !b && !r;
  quote.textContent = b ? `"${b.desc}"` : r ? `"${r.text}"` : '';
  $('tutListen').hidden = !b && !r;   // only lessons with a team recording have something to hear
  $('tutText').textContent = lesson.text;
  $('tutKeys').replaceChildren(...(lesson.keys || []).map(k => h('kbd', {}, k)));
  $('tutKeys').hidden = !lesson.keys;
  $('tutTasks').replaceChildren(...(lesson.tasks || []).map((t, i) => h('li', { class: ticks[i] ? 'is-done' : '' },
    h('span', { class: 'tut-check', html: ticks[i] ? icon('check') : '' }), t.label)));
  $('tutTasks').hidden = !lesson.tasks;
  const fb = $('tutFeedback');
  const msg = learned || (finished ? 'Great job!' : feedback);
  fb.textContent = msg || lesson.note || '';
  fb.className = 'tut-feedback' + (learned ? ' is-learned' : finished ? ' is-good' : feedback ? ' is-oops' : '');
  fb.hidden = !fb.textContent;
  el.classList.toggle('is-done', finished);

  const next = $('tutNext');
  next.hidden = !!lesson.final;
  next.textContent = finished || !lesson.tasks ? 'Next' : 'Skip';
  next.classList.toggle('btn-next', finished || !lesson.tasks);
  next.classList.toggle('btn-ghost', !(finished || !lesson.tasks));
  $('tutPlay').hidden = $('tutMenu').hidden = !lesson.final;
  $('tutBack').disabled = n === 0;

  // light up the button of the first task that is not done yet
  const open = (lesson.tasks || []).find((t, i) => !ticks[i] && t.button);
  setHint(finished ? [] : open ? [open.button] : lesson.button ? [lesson.button] : []);
}

/** Runs every frame during the tutorial. */
export function updateTutorial(dt){
  if (!isOpen() || G.paused) return;
  // rule 2 needs to know about the goal: you scored, then the kickoff came without a jump
  if (G.phase === 'goal' && G.lastGoal && G.lastGoal.team === 'blue') L.scored = true;
  if (L.scored && G.phase !== 'goal' && !(G.lastGoal && G.lastGoal.cancelled)) L.goalSafe = true;

  let changed = false;
  if (L.rules.length){
    const broken = L.rules.shift();
    if (lesson.learn && lesson.learn.rule === broken && !allDone()){ learned = lesson.learn.text; changed = true; }
    else if (lesson.oops && lesson.oops[broken]){ feedback = lesson.oops[broken]; changed = true; }
  }
  (lesson.tasks || []).forEach((t, i) => {
    if (!ticks[i] && (i === 0 || ticks[i - 1]) && t.done()){ ticks[i] = true; changed = true; }
  });
  if (changed) draw();

  if ((allDone() || learned) && doneT < 0) doneT = AUTO_NEXT;
  if (doneT > 0){
    doneT -= dt;
    if (doneT <= 0) begin(n + 1);
  }
}

function close(){
  if (!el) return;
  el.hidden = true;
  setHint([]);
}

/** handlers: onPlay(), onMenu() */
export function initTutorial(opts){
  handlers = opts;
  el = $('tutorial');
  $('tutNext').addEventListener('click', () => begin(n + 1));
  $('tutBack').addEventListener('click', () => begin(n - 1));
  $('tutListen').addEventListener('click', speak);
  $('tutListen').innerHTML = icon('voice');
  $('tutExit').addEventListener('click', () => { stopVoice(); handlers.onPlay(); });
  $('tutPlay').addEventListener('click', () => { stopVoice(); handlers.onPlay(); });
  $('tutMenu').addEventListener('click', () => { stopVoice(); handlers.onMenu(); });

  // Enter = next (only when the lesson has nothing to do, or it is done)
  window.addEventListener('keydown', e => {
    if (!isOpen() || G.paused || G.tour || e.key !== 'Enter' || e.repeat) return;
    if (e.target && e.target.closest && e.target.closest('button,input,select,textarea')) return;
    if (lesson.final) return;
    if (!lesson.tasks || allDone() || learned){ e.preventDefault(); begin(n + 1); }
  });

  on('match:start', () => {
    if (!G.tutorial){ close(); return; }
    el.hidden = false;
    begin(0);
  });
  for (const name of ['match:menu', 'match:end']) on(name, close);
}
