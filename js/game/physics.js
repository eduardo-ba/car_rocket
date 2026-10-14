// Ball physics and collisions: ball vs walls and goals, car vs ball, car vs car.
import { ball } from '../world/ball.js';
import { G } from './state.js';
import { MODES, MOVES, HITBOX, RADIUS, GRAV, BALL_R, CEIL, HALF_W, HALF_L, GOAL_HW, GOAL_H, GOAL_D } from '../config.js';
import { clamp, rnd } from '../core/math.js';
import { emit } from '../core/events.js';
import { sfx } from '../audio/audio.js';
import { emitParticle } from '../fx/particles.js';
import { addShake } from '../engine/camera-rig.js';

const MAX_BALL_SPEED = 75;
const ballInWater = () => G.waterLevel > .5 && ball.pos.y < G.waterLevel;
export const ballGravity = () => ballInWater() ? GRAV * .15 : GRAV * .75;

/** Moves the ball one step. Returns -1 or 1 when the ball is fully inside a goal
 *  (-1 = orange goal, so blue scores; 1 = blue goal, so orange scores), otherwise 0. */
export function stepBall(dt){
  const p = ball.pos, v = ball.vel;
  v.y -= ballGravity() * dt;
  v.multiplyScalar(Math.exp(-(ballInWater() ? 1.1 : .03) * dt));
  p.addScaledVector(v, dt);

  if (p.y < BALL_R){                                   // floor
    p.y = BALL_R;
    if (v.y < 0){
      if (v.y < -6) sfx.hit(-v.y * .3);
      v.y = -v.y * .62;
      if (v.y < 1.5) v.y = 0;
    }
    const f = Math.exp(-.45 * dt);
    v.x *= f; v.z *= f;
  }
  if (p.y > CEIL - BALL_R){ p.y = CEIL - BALL_R; v.y = -Math.abs(v.y) * .7; }
  if (Math.abs(p.x) > HALF_W - BALL_R){ p.x = Math.sign(p.x) * (HALF_W - BALL_R); v.x = -v.x * .75; }

  let goal = 0;
  const az = Math.abs(p.z), sz = Math.sign(p.z);
  if (az > HALF_L - BALL_R){
    const mouth = Math.abs(p.x) < GOAL_HW && p.y < GOAL_H;
    if (!mouth && az < HALF_L + .5){                    // end wall or goal post
      p.z = sz * (HALF_L - BALL_R);
      v.z = -v.z * .75;
    } else {                                           // inside the goal box
      if (az > HALF_L){
        if (Math.abs(p.x) > GOAL_HW - BALL_R){ p.x = Math.sign(p.x) * (GOAL_HW - BALL_R); v.x = -v.x * .5; }
        if (p.y > GOAL_H - BALL_R){ p.y = GOAL_H - BALL_R; v.y = -Math.abs(v.y) * .5; }
      }
      if (az > HALF_L + GOAL_D - BALL_R){ p.z = sz * (HALF_L + GOAL_D - BALL_R); v.z = -v.z * .5; }
      if (az > HALF_L + BALL_R) goal = sz;
    }
  }
  return goal;
}

/** Car (as an oriented box) against the ball. Returns true when the car hits the ball. */
export function carBall(car){
  const hb = HITBOX[car.mode];
  const c = Math.cos(car.heading), s = Math.sin(car.heading);
  const dx = ball.pos.x - car.pos.x, dz = ball.pos.z - car.pos.z, dy = ball.pos.y - (car.pos.y + hb.cy);
  if (dx * dx + dz * dz > 70 || Math.abs(dy) > hb.hh + BALL_R + .5) return false;

  // ball centre in the car's local space, then the closest point of the box
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const cx = clamp(lx, -hb.hw, hb.hw), cy = clamp(dy, -hb.hh, hb.hh), cz = clamp(lz, -hb.hl, hb.hl);
  let nx = lx - cx, ny = dy - cy, nz = lz - cz;
  const d = Math.hypot(nx, ny, nz);
  if (d >= BALL_R) return false;
  if (d < 1e-4){ nx = 0; ny = 1; nz = 0; } else { nx /= d; ny /= d; nz /= d; }
  const wx = nx * c + nz * s, wz = -nx * s + nz * c, wy = ny;
  const px = car.pos.x + cx * c + cz * s, pz = car.pos.z - cx * s + cz * c, py = car.pos.y + hb.cy + cy;
  ball.pos.set(px + wx * (BALL_R + .01), py + wy * (BALL_R + .01), pz + wz * (BALL_R + .01));

  const vn = (ball.vel.x - car.vel.x) * wx + (ball.vel.y - car.vel.y) * wy + (ball.vel.z - car.vel.z) * wz;
  if (vn >= 0) return false;
  const j = -(car.isPlayer ? 1.55 : 1.3) * vn;
  ball.vel.x += wx * j; ball.vel.y += wy * j; ball.vel.z += wz * j;
  const sp = Math.hypot(car.vel.x, car.vel.z);
  // a flip into the ball (dodge hit) hits much harder, like in Rocket League
  const dodging = car.flip && car.flip.t < .45;
  const extra = (2 + sp * .32) * MODES[car.mode].power * (sp > 3 || Math.abs(car.vel.y) > 3 ? 1 : .3) * (dodging ? MOVES.dodgeHit : 1);
  ball.vel.x += wx * extra;
  ball.vel.z += wz * extra;
  ball.vel.y += wy * extra + (car.onGround && wy < .5 ? extra * .25 : 0);
  const bs = ball.vel.length();
  if (bs > MAX_BALL_SPEED) ball.vel.multiplyScalar(MAX_BALL_SPEED / bs);
  if (dodging && car.isPlayer && -vn > 6) emit('move', 'DODGE HIT');
  if (-vn > 4){
    sfx.hit(-vn);
    emitParticle(px, py, pz, rnd(-3, 3), rnd(2, 5), rnd(-3, 3), 0xffffff, .3, .3, .5);
  }
  ball.lastTouch = car;
  return true;
}

/** Two cars bump like circles. Mad Max with turbo destroys the other car. */
export function carCar(a, b){
  if (a.dead > 0 || b.dead > 0 || Math.abs(a.pos.y - b.pos.y) > 2.6) return;
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  const min = RADIUS[a.mode] + RADIUS[b.mode], d = Math.hypot(dx, dz);
  if (d >= min || d < 1e-4) return;
  const nx = dx / d, nz = dz / d, ma = MODES[a.mode].mass, mb = MODES[b.mode].mass, overlap = min - d;
  a.pos.x -= nx * overlap * mb / (ma + mb); a.pos.z -= nz * overlap * mb / (ma + mb);
  b.pos.x += nx * overlap * ma / (ma + mb); b.pos.z += nz * overlap * ma / (ma + mb);
  const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
  if (rv >= 0) return;
  if (a.isPlayer && a.mode === 'madmax' && a.turbo && -rv > 14){
    b.explode();
    emit('toast', 'DEMOLITION! Mad Max destroyed the orange car!', 'good');
    return;
  }
  const j = -1.4 * rv / (1 / ma + 1 / mb);
  a.vel.x -= nx * j / ma; a.vel.z -= nz * j / ma;
  b.vel.x += nx * j / mb; b.vel.z += nz * j / mb;
  if (-rv > 6){ sfx.hit(-rv * .5); addShake(.25); }
}
