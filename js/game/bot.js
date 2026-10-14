// The orange car's brain: get behind the ball, push it toward the blue goal,
// reverse when stuck, jump at high balls, front-flip into the ball, and transform now and then.
import { bot } from './actors.js';
import { ball } from '../world/ball.js';
import { G } from './state.js';
import { HALF_W, HALF_L, DIFFICULTY, MODES } from '../config.js';
import { clamp, rnd, pick, wrapAngle } from '../core/math.js';
import { emit } from '../core/events.js';
import { burst } from '../fx/particles.js';

const IDLE = { t: 0, s: 0 };
const brain = { stuck: 0, reverse: 0, aim: 0, transformT: 12, hold: 0, flipT: 0 };
const FLIP_CHANCE = { easy: 0, normal: .012, hard: .03 };   // per step, when lined up with the ball

/** Picks a new spot to aim at inside the blue goal (easier levels miss more). */
export function newAim(){
  const e = DIFFICULTY[G.difficulty].aimError;
  brain.aim = rnd(-e * 2, e * 2);
}

export function resetBot(){
  brain.stuck = 0;
  brain.reverse = 0;
  brain.hold = 0;
  brain.flipT = 0;
  brain.transformT = rnd(10, 16);
  bot.speedMul = DIFFICULTY[G.difficulty].speed;
  newAim();
}

/** Returns the bot's input for this step: {t: throttle, s: steer}. */
export function think(dt){
  if (bot.dead > 0) return IDLE;
  const bx = clamp(ball.pos.x + ball.vel.x * .35, -HALF_W + 2, HALF_W - 2);
  const bz = clamp(ball.pos.z + ball.vel.z * .35, -HALF_L + 2, HALF_L + 2);
  let tx, tz;
  if (bot.pos.z > bz - 1.5){
    // the bot is past the ball: drive around it to get behind
    const side = bot.pos.x > bx ? 1 : -1;
    tx = bx + side * 7;
    tz = bz - 9;
  } else {
    // behind the ball: drive through it toward the aim point in the blue goal
    const gx = brain.aim - bx, gz = HALF_L - bz, gl = Math.hypot(gx, gz) || 1;
    tx = bx - gx / gl * 1.2;
    tz = bz - gz / gl * 1.2;
  }
  tx = clamp(tx, -HALF_W + 2, HALF_W - 2);
  tz = clamp(tz, -HALF_L + 2, HALF_L - 2);

  const diff = wrapAngle(Math.atan2(tx - bot.pos.x, tz - bot.pos.z) - bot.heading);
  let s = clamp(diff * 2.6, -1, 1), t = Math.abs(diff) > 1.8 ? .55 : 1;
  const speed = Math.hypot(bot.vel.x, bot.vel.z);
  if (brain.reverse > 0){ brain.reverse -= dt; t = -1; s = -s; }
  else if (speed < 2.5 && G.phase === 'play'){
    brain.stuck += dt;
    if (brain.stuck > 1.1){ brain.reverse = .8; brain.stuck = 0; }
  } else brain.stuck = 0;

  const dist = Math.hypot(ball.pos.x - bot.pos.x, ball.pos.z - bot.pos.z);
  if (bot.onGround && dist < 7 && ball.pos.y > 3.5 && ball.pos.y < 9 && Math.random() < .04){
    bot.jump();
    brain.hold = .2;                         // a full jump for high balls
  }
  // jump, then front flip into a ball on the ground (a dodge hit, like in Rocket League)
  if (bot.onGround && !brain.flipT && dist > 4 && dist < 9 && ball.pos.y < 4 && Math.abs(diff) < .25
      && speed > 16 && bot.pos.z < ball.pos.z && Math.random() < FLIP_CHANCE[G.difficulty]){
    bot.jump();
    brain.flipT = .14;
  }
  if (brain.flipT > 0){
    brain.flipT -= dt;
    if (brain.flipT <= 0){ brain.flipT = 0; if (!bot.onGround) bot.jump({ f: 1, r: 0 }); }
  }
  if (brain.hold > 0) brain.hold -= dt;
  bot.turbo = G.difficulty === 'hard' && dist > 25 && bot.boost > 15 && Math.abs(diff) < .4 && bot.onGround;
  if (!bot.onGround) t = 0;                  // no nose tilt in the air
  return { t, s, jump: brain.hold > 0 };
}

/** Every 12 to 22 seconds the orange car changes its form. */
export function maybeTransform(dt){
  brain.transformT -= dt;
  if (brain.transformT > 0 || bot.dead > 0) return;
  brain.transformT = rnd(12, 22);
  const mode = pick(['car', 'robot', '4x4', 'tuning', 'madmax'].filter(m => m !== bot.mode));
  bot.applyMode(mode);
  burst(bot.pos.x, bot.pos.y + 1.5, bot.pos.z, 22, [0xff8a1f, 0xffffff, 0xffd23f], 9, .35, .6, .3);
  emit('toast', mode === 'car' ? 'The ORANGE car is a normal RC car again.' : 'The ORANGE car transformed: ' + MODES[mode].name, 'info');
}
