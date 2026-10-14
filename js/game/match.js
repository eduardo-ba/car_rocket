// Match flow: start, kickoff countdown, goals, overtime, pause, end and back to the menu.
// step() runs the whole simulation at a fixed rate (see STEP in config.js).
import { G, inMatch, resetMatchState } from './state.js';
import { player, bot, cars } from './actors.js';
import { stepBall, carBall, carCar } from './physics.js';
import { think, resetBot, newAim, maybeTransform } from './bot.js';
import { ball, resetBall } from '../world/ball.js';
import { collectPads, resetPads } from '../world/pads.js';
import { RULES } from '../data/rules.js';
import { WATER_TOP, TEAM } from '../config.js';
import { clamp, rnd } from '../core/math.js';
import { emit } from '../core/events.js';
import { sfx, initAudio, suspendAudio, resumeAudio } from '../audio/audio.js';
import { burst, fireball } from '../fx/particles.js';
import { clearSkids } from '../fx/skids.js';
import { addShake, snapBehind } from '../engine/camera-rig.js';

const COUNTDOWN = 3, CELEBRATION = 3.6;
const IDLE = { t: 0, s: 0 };
const fireworks = [];

export function placeForKickoff(){
  resetBall();
  cars.forEach(c => c.reset());
}

function kickoff(){
  placeForKickoff();
  G.phase = 'countdown';
  G.phaseT = COUNTDOWN;
  G.lastCount = 0;
  G.lastGoal = null;
  G.kickTip = (Math.random() * RULES.length) | 0;
  if (!G.tutorial) emit('kickoff', G.kickTip + 1);    // the tutorial does its own talking
  newAim();
  clearSkids();
  snapBehind(player);
}

/** tutorial = true: the practice match of the tutorial (js/ui/tutorial.js). */
export function startMatch(tutorial = false){
  G.tutorial = !!tutorial;
  initAudio();
  resumeAudio();
  resetMatchState();
  fireworks.length = 0;
  for (const c of cars){ c.turbo = false; c.boost = 33; c.radio = false; c.applyMode('car', true); }
  resetBot();
  resetPads();
  emit('match:start');
  kickoff();
}

function endMatch(){
  G.phase = 'end';
  G.paused = false;
  player.radio = false;
  emit('match:end', {
    blue: G.score.blue, orange: G.score.orange, overtime: G.overtime,
    rulesBroken: G.rulesBroken, ruleCounts: [...G.ruleCounts]
  });
  sfx.horn();
}

export function goToMenu(){
  G.phase = 'menu';
  G.tutorial = false;
  G.paused = false;
  player.radio = false;
  for (const c of cars){ c.turbo = false; c.applyMode('car', true); }
  placeForKickoff();
  resumeAudio();
  emit('match:menu');
}

/** tab: which help tab the pause screen opens on ('controls', 'buttons' or 'rules'). */
export function setPaused(paused, tab){
  if (!inMatch() || G.paused === paused) return;
  G.paused = paused;
  if (paused) suspendAudio(); else resumeAudio();
  emit('match:pause', paused, tab);
}

function onGoal(side){
  const team = side < 0 ? 'blue' : 'orange';
  G.score[team]++;
  G.phase = 'goal';
  G.phaseT = CELEBRATION;
  G.lastGoal = { team, cancelled: false };
  G.hype = 3;
  const p = ball.pos, col = TEAM[team].color;
  fireball(p.x, p.y, p.z, col, 9);
  burst(p.x, p.y, p.z, 140, [col, 0xffffff, 0xffd23f], 30, .6, 2.2, .6, 6);
  ball.visible = false;
  emit('banner', team === 'blue' ? 'GOAL!' : 'ORANGE SCORES', `BLUE ${G.score.blue} - ${G.score.orange} ORANGE`, 2600);
  sfx.horn();
  addShake(.8);
  for (let i = 0; i < 6; i++){
    const end = Math.random() < .5 ? -1 : 1;
    fireworks.push({ t: .25 + i * .3, x: rnd(-45, 45), y: rnd(26, 40), z: end * rnd(30, 75), col });
  }
}

function updatePhase(dt){
  if (G.phase === 'countdown'){
    G.phaseT -= dt;
    const n = Math.ceil(G.phaseT);
    if (n !== G.lastCount && n > 0){
      G.lastCount = n;
      emit('banner', String(n), G.tutorial ? 'Get ready!' : `RULE ${G.kickTip + 1}: ${RULES[G.kickTip].text}`, 1000);
      sfx.beep(false);
    }
    if (G.phaseT <= 0){
      G.phase = 'play';
      emit('banner', G.overtime ? 'NEXT GOAL WINS!' : 'GO!', '', 800);
      sfx.beep(true);
    }
  } else if (G.phase === 'play'){
    if (G.tutorial) return true;                      // no clock and no transforming orange car
    if (G.overtime) G.otTime += dt;
    else {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0){
        G.timeLeft = 0;
        if (G.score.blue !== G.score.orange){ endMatch(); return false; }
        G.overtime = true;
        emit('banner', 'OVERTIME', 'It is a draw. The next goal wins!', 2400);
        sfx.horn();
      }
    }
    maybeTransform(dt);
  } else if (G.phase === 'goal'){
    G.phaseT -= dt;
    if (G.phaseT <= 0){
      if (G.overtime && G.score.blue !== G.score.orange){ endMatch(); return false; }
      kickoff();
    }
  }
  return true;
}

function updateFireworks(dt){
  for (let i = fireworks.length - 1; i >= 0; i--){
    const f = fireworks[i];
    f.t -= dt;
    if (f.t > 0) continue;
    burst(f.x, f.y, f.z, 40, [f.col, 0xffffff, 0xffd23f], 16, .55, 1.6, .25);
    sfx.firework();
    fireworks.splice(i, 1);
  }
}

/** One fixed physics step. input = {t, s} from the keyboard or touch pads. */
export function step(dt, input){
  G.clock += dt;
  if (!updatePhase(dt)) return;
  updateFireworks(dt);

  const frozen = G.phase === 'countdown';
  player.update(dt, frozen ? { t: 0, s: input.s } : input);
  if (G.tutorial) bot.dead = 1;                       // hidden and out of the way while you learn
  else bot.update(dt, frozen ? IDLE : think(dt));

  if (G.goalCD > 0) G.goalCD -= dt;
  if (G.radioBrokenT > 0){
    G.radioBrokenT -= dt;
    if (G.radioBrokenT <= 0) emit('toast', 'The radio works again.', 'good');
  }
  if (G.hype > 0) G.hype = Math.max(0, G.hype - dt);
  const waterTarget = player.mode === 'sub' ? WATER_TOP : -1;
  G.waterLevel += clamp(waterTarget - G.waterLevel, -6 * dt, 6 * dt);

  collectPads(dt, cars, car => { if (car.isPlayer) sfx.pickup(); });
  carCar(player, bot);
  if (!ball.visible) return;
  const side = stepBall(dt);
  if (side && G.phase === 'play'){ onGoal(side); return; }
  for (const c of cars){
    if (c.dead <= 0 && carBall(c) && !c.isPlayer) newAim();
  }
}
