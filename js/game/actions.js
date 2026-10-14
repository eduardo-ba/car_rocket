// What each of the 10 buttons does, and where the 5 rules are checked.
import * as THREE from '../core/three.js';
import { G, inMatch } from './state.js';
import { player } from './actors.js';
import { ballGravity } from './physics.js';
import { ball } from '../world/ball.js';
import { RULES } from '../data/rules.js';
import { MODES, GOAL_CD, HALF_L, POWER_SHOT_RANGE, RULE } from '../config.js';
import { rnd } from '../core/math.js';
import { emit } from '../core/events.js';
import { sfx, initAudio } from '../audio/audio.js';
import { buttonSound } from '../audio/samples.js';
import { bgm } from '../audio/music.js';
import { burst } from '../fx/particles.js';
import { addShake } from '../engine/camera-rig.js';
import { readInput } from '../input/controls.js';

/** Names shown on screen for each jump move. */
const MOVE_NAME = { double: 'DOUBLE JUMP', front: 'FRONT FLIP', back: 'BACKFLIP', side: 'SIDE FLIP', diagonal: 'DIAGONAL FLIP' };

const tmp = new THREE.Vector3();
const toast = (msg, kind = 'info') => emit('toast', msg, kind);
/** The button did its job (the narrator may read its sentence). */
const used = id => emit('button:used', id);

export function breakRule(n, penalty){
  G.rulesBroken++;
  G.ruleCounts[n - 1]++;
  emit('rule', n, RULES[n - 1].text, penalty || RULES[n - 1].penalty);
  sfx.buzzer();
  addShake(.5);
}

export function pressButton(id){
  if (!inMatch() || G.paused) return;
  emit('button:flash', id);
  initAudio();
  switch (id){
    case 'jump': return jump();
    case 'turbo': return toggleTurbo();
    case 'goal': return powerShot();
    case 'radio': return radio();
    case 'madmax': return madMax();
    case '4x4': return fourByFour();
    default: return transform(id);
  }
}

/* JUMP — rule 2 (no jumping after you score) and rule 4 (no spamming) */
function jump(){
  if (player.dead > 0) return;
  if (G.phase === 'goal' && G.lastGoal && G.lastGoal.team === 'blue' && !G.lastGoal.cancelled){
    G.lastGoal.cancelled = true;
    G.score.blue = Math.max(0, G.score.blue - 1);
    breakRule(2, 'Your goal is cancelled! BLUE loses 1 point.');
    emit('banner', 'NO GOAL!', 'You pressed JUMP after scoring', 1800);
  }
  const now = G.clock;
  const recent = G.jumpTimes.filter(t => now - t < RULE.spamWindow);
  recent.push(now);
  G.jumpTimes.length = 0;
  if (recent.length >= RULE.spamLimit){
    breakRule(4, 'BOOM! Your car exploded.');
    player.explode();
    return;
  }
  G.jumpTimes.push(...recent);
  if (recent.length === RULE.spamLimit - 1) toast("Careful! Don't spam the JUMP button!", 'warn');
  // the keys held right now choose the flip: W front flip, S backflip, A / D side flip
  const inp = readInput();
  const move = player.jump({ f: inp.t, r: inp.s });
  if (move){
    if (!buttonSound('jump')){ if (move === 'jump' || move === 'swim' || move === 'double') sfx.jump(); else sfx.flip(); }
    if (MOVE_NAME[move]) emit('move', MOVE_NAME[move]);
    used('jump');
  }
}

/* TURBO — no toast: the button and the boost ring already show ON / OFF */
function toggleTurbo(){
  if (player.turbo){
    player.turbo = false;
    sfx.turbo(false);
    return;
  }
  if (player.boost < 5){
    sfx.error();
    toast('No turbo left! Drive over a glowing pad to refill it.', 'warn');
    return;
  }
  player.turbo = true;
  if (!buttonSound('turbo')) sfx.turbo(true);
  used('turbo');
}

/* GOAL — a power shot into the orange goal when the ball is close */
function powerShot(){
  if (player.dead > 0) return;
  if (!ball.visible){ sfx.error(); toast('Wait for the kickoff!', 'warn'); return; }
  if (G.goalCD > 0){ sfx.error(); toast(`The GOAL button is recharging (${Math.ceil(G.goalCD)} s).`, 'warn'); return; }
  const dist = Math.hypot(ball.pos.x - player.pos.x, ball.pos.y - (player.pos.y + 1), ball.pos.z - player.pos.z);
  if (dist > POWER_SHOT_RANGE){ sfx.error(); toast('Get closer to the ball to use the GOAL button!', 'warn'); return; }
  // aim at a random spot inside the goal and solve the arc so the ball lands there
  const tx = rnd(-6, 6), ty = 3.5, tz = -HALF_L - 4;
  const hx = tx - ball.pos.x, hz = tz - ball.pos.z, hd = Math.hypot(hx, hz);
  const speed = 58, flight = hd / speed, g = ballGravity();
  ball.vel.set(hx / hd * speed, (ty - ball.pos.y) / flight + .5 * g * flight, hz / hd * speed);
  ball.lastTouch = player;
  G.goalCD = GOAL_CD;
  if (!buttonSound('goal')) sfx.shot();
  addShake(.4);
  burst(ball.pos.x, ball.pos.y, ball.pos.z, 30, [0xffd23f, 0xffffff], 14, .45, .6, .2);
  toast('POWER SHOT!', 'good');
  used('goal');
}

/* RADIO — rule 3 (no double-click) */
function radio(){
  if (G.radioBrokenT > 0){
    sfx.radioStatic();
    toast(`The radio is broken. Wait ${Math.ceil(G.radioBrokenT)} s.`, 'warn');
    return;
  }
  const now = G.clock;
  if (now - G.lastRadio < RULE.doubleClick){
    G.lastRadio = -9;
    player.radio = false;
    G.radioBrokenT = RULE.radioBroken;
    bgm.cut();
    breakRule(3);
    sfx.radioStatic();
    const tp = player.model.tip.getWorldPosition(tmp);
    burst(tp.x, tp.y, tp.z, 16, [0xffd23f, 0xffffff, 0x3a3f48], 8, .3, .6, .5);
    return;
  }
  G.lastRadio = now;
  player.radio = !player.radio;
  if (player.radio){ buttonSound('radio'); toast('RADIO ON: the antenna goes up and the music gets louder!', 'good'); used('radio'); }
  else toast('Radio OFF: the music goes back to normal.');
}

/* MAD MAX — rule 1 (only with turbo on) */
function madMax(){
  if (player.dead > 0) return;
  if (player.mode === 'madmax') return transform('car');
  if (!player.turbo){ breakRule(1); player.stall = Math.max(player.stall, RULE.stallMadMax); return; }
  transform('madmax');
}

/* 4X4 — rule 5 (only after using TUNING) */
function fourByFour(){
  if (player.dead > 0) return;
  if (player.mode === '4x4') return transform('car');
  if (!G.tuningUsed){ breakRule(5); player.stall = Math.max(player.stall, RULE.stall4x4); return; }
  transform('4x4');
}

/* SUBMARINE, TRANSFORMER, PLANE, TUNING (and going back to the normal car) */
function transform(mode){
  if (player.dead > 0){ toast('Wait, your car is coming back!', 'warn'); return; }
  const next = player.mode === mode ? 'car' : mode;
  player.applyMode(next);
  if (next === 'tuning') G.tuningUsed = true;
  if (next === 'car' || !buttonSound(next)) sfx.transform();
  burst(player.pos.x, player.pos.y + 1.5, player.pos.z, 28, [0x5ff2ff, 0xffffff, 0x2f8cff], 10, .35, .6, .3);
  toast(next === 'car' ? 'Back to the normal RC car.' : 'TRANSFORM: ' + MODES[next].name);
  if (next !== 'car') used(next);
}
