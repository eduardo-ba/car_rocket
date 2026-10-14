// One RC car: driving physics, Rocket League moves (jumps, flips, half flip, air control,
// air roll, aerials, powerslide), transformations, explosions and visual effects.
import * as THREE from '../core/three.js';
import { MODES, MODE_FX, MOVES, TEAM, GRAV, CEIL, HALF_W, HALF_L } from '../config.js';
import { clamp, lerp, damp, rnd, wrapAngle } from '../core/math.js';
import { emit } from '../core/events.js';
import { G } from '../game/state.js';
import { scene } from '../engine/renderer.js';
import { addShake } from '../engine/camera-rig.js';
import { emitParticle, burst, fireball } from '../fx/particles.js';
import { addSkid } from '../fx/skids.js';
import { sfx } from '../audio/audio.js';
import { buildCarModel } from './car-model.js';

const tmp = new THREE.Vector3();
const IDENTITY = new THREE.Quaternion();
const NO_DIR = { f: 0, r: 0 };
const MAX_PITCH = 1.35;
const SUPERSONIC = 38;

export class Car {
  constructor(team, isPlayer){
    const t = TEAM[team];
    this.team = team;
    this.isPlayer = isPlayer;
    this.spawn = t.spawn;
    this.color = t.color;
    this.tuningColor = t.tuning;
    this.pos = new THREE.Vector3(t.spawn.x, 0, t.spawn.z);
    this.vel = new THREE.Vector3();
    this.heading = t.spawn.h;
    this.onGround = true; this.canDodge = false; this.dodgeT = 0; this.jumpHold = 0;
    this.flip = null;      // a flip in progress: {axis, t, kind, dx, dz}
    this.half = null;      // a half flip in progress: {t, from, turn}
    this.pitch = 0; this.roll = 0; this.airControl = false; this.sliding = false;
    this.aerialT = 0; this.supersonic = false;
    this.mode = 'car'; this.turbo = false; this.boost = 33; this.radio = false; this.stall = 0; this.dead = 0;
    this.vF = 0; this.steerIn = 0; this.throttleIn = 0; this.speedMul = 1;
    this.walk = 0; this.mastS = .12; this.popT = 0; this.fxT = 0; this.skidT = 0;
    this.model = buildCarModel(this.color);
    scene.add(this.model.group);
    this.applyMode('car', true);
  }

  /** True while turbo is on and pushing the car: accelerating on the ground, always in the air. */
  get burning(){ return this.turbo && this.boost > 0 && (this.airControl || this.throttleIn > 0); }

  /** The player's car tells the HUD about its moves (BACKFLIP, HALF FLIP, AERIAL...). */
  announce(name){ if (this.isPlayer) emit('move', name); }

  applyMode(mode, silent){
    const m = this.model, big = mode === '4x4';
    this.mode = mode;
    m.carParts.visible = mode !== 'sub' && mode !== 'robot';
    m.subParts.visible = mode === 'sub';
    m.robotParts.visible = mode === 'robot';
    m.wheels.forEach(w => { w.visible = !big; });
    m.bigWheels.visible = big;
    m.fourParts.visible = big;
    m.planeParts.visible = mode === 'plane';
    m.maxParts.visible = mode === 'madmax';
    m.tuneParts.visible = mode === 'tuning';
    m.chassis.position.y = big ? .75 : mode === 'tuning' ? -.08 : 0;
    const bm = m.bodyMat;
    if (mode === 'madmax'){ bm.color.setHex(0x7b4a25); bm.roughness = .85; bm.metalness = .3; }
    else if (mode === 'tuning'){ bm.color.setHex(this.tuningColor); bm.roughness = .2; bm.metalness = .55; }
    else { bm.color.setHex(this.color); bm.roughness = .42; bm.metalness = .25; }
    m.antenna.position.fromArray(MODE_FX[mode].ant);
    m.flames.position.fromArray(MODE_FX[mode].fl);
    if (!silent) this.popT = .35;
  }

  reset(){
    const s = this.spawn;
    this.pos.set(s.x, 0, s.z);
    this.vel.set(0, 0, 0);
    this.heading = s.h;
    this.onGround = true; this.canDodge = false; this.dead = 0; this.stall = 0; this.vF = 0;
    this.clearMoves();
    this.model.tilt.rotation.set(0, 0, 0);
    this.model.group.visible = true;
  }

  clearMoves(){
    this.flip = null; this.half = null; this.jumpHold = 0;
    this.pitch = 0; this.roll = 0; this.airControl = false; this.sliding = false; this.aerialT = 0;
  }

  explode(){
    if (this.dead > 0) return;
    this.dead = 3;
    this.vel.set(0, 0, 0);
    this.clearMoves();
    this.model.group.visible = false;
    const p = this.pos;
    fireball(p.x, p.y + 1, p.z, 0xffa21f, 7);
    burst(p.x, p.y + 1, p.z, 50, [0xffd23f, 0xff7a1a, 0xff3b1f], 26, .7, 1.1, 1);
    burst(p.x, p.y + 1, p.z, 22, [this.color, 0x1d232c, 0x15181d], 20, 1.1, 2, 1, 6);
    for (let i = 0; i < 18; i++){
      emitParticle(p.x + rnd(-2, 2), p.y + 1 + rnd(2), p.z + rnd(-2, 2), rnd(-2, 2), rnd(3, 7), rnd(-2, 2), 0x555b66, 1.4, rnd(1.2, 2), -.05, true, 2.5);
    }
    sfx.boom();
    addShake(1.4);
  }

  /**
   * The JUMP button, like in Rocket League:
   *   on the ground   jump (a tap is a small hop; holding JUMP jumps higher)
   *   in the air      no direction: double jump · W: front flip · S: backflip · A / D: side flip
   *                   (W or S with A or D: diagonal flip). Only one flip or double jump per jump.
   *   as a submarine  swim up
   * dir = {f: forward -1..1, r: left -1..1} from the keys held when JUMP is pressed.
   * Returns what it did ('jump', 'swim', 'double', 'front', 'back', 'side', 'diagonal') or ''.
   */
  jump(dir = NO_DIR){
    if (this.dead > 0) return '';
    const m = MODES[this.mode];
    if (this.mode === 'sub' && G.waterLevel > .5){
      this.vel.y = 10;
      this.onGround = false;
      this.pos.y = Math.max(this.pos.y, .01);
      return 'swim';
    }
    if (this.onGround){
      this.vel.y = m.jump * MOVES.hopShare;
      this.jumpHold = MOVES.holdTime;
      this.onGround = false;
      this.pos.y = .01;
      this.canDodge = true;
      this.dodgeT = MOVES.dodgeWindow;
      return 'jump';
    }
    if (!this.canDodge) return '';
    this.canDodge = false;
    this.jumpHold = 0;
    let f = clamp(dir.f || 0, -1, 1), r = clamp(dir.r || 0, -1, 1);
    if (Math.abs(f) < .3 && Math.abs(r) < .3){
      this.vel.y = Math.max(this.vel.y, 0) + m.jump * MOVES.doubleJump;
      return 'double';
    }
    const len = Math.hypot(f, r);
    f /= len; r /= len;
    // impulse along the flip direction; the car's left side is (cos h, 0, -sin h) in the world
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const mag = f * f * (f > 0 ? MOVES.dodgeForward : MOVES.dodgeBack) + r * r * MOVES.dodgeSide;
    const dx = fx * f + fz * r, dz = fz * f - fx * r;
    this.vel.x += dx * mag;
    this.vel.z += dz * mag;
    this.vel.y = Math.max(this.vel.y, 2);
    this.pitch = 0;
    this.roll = 0;
    const kind = Math.abs(r) < .38 ? (f > 0 ? 'front' : 'back') : Math.abs(f) < .38 ? 'side' : 'diagonal';
    // the model turns around this axis (local space): +x = front flip, -x = backflip, -z = to the left
    this.flip = { axis: new THREE.Vector3(f, 0, -r).normalize(), t: 0, kind, dx, dz };
    return kind;
  }

  /** Backflip + forward right away = half flip: the car turns around and drives forward. */
  startHalfFlip(steer){
    this.flip = null;
    this.half = { t: 0, from: this.heading, turn: (steer < 0 ? -1 : 1) * Math.PI };
    this.announce('HALF FLIP');
  }

  /** Physics step. inp = {t: throttle -1..1, s: steer -1..1 (left is +)} */
  update(dt, inp){
    if (this.dead > 0){
      this.dead -= dt;
      if (this.dead <= 0){ this.reset(); this.popT = .35; }
      return;
    }
    const m = MODES[this.mode];
    if (this.stall > 0) this.stall -= dt;
    const thr = this.stall > 0 ? 0 : inp.t, steer = inp.s;
    this.throttleIn = thr;
    this.steerIn = steer;

    const turboActive = this.turbo && this.boost > 0, mul = this.speedMul;
    const maxSpeed = (m.max + (turboActive ? 16 : 0)) * mul;
    const accel = (m.acc + (turboActive ? 30 : 0)) * mul;
    if (this.turbo){
      if (this.burning) this.boost -= 24 * dt;
      if (this.boost <= 0){
        this.boost = 0;
        this.turbo = false;
        if (this.isPlayer) emit('toast', 'Out of turbo! Drive over a glowing pad to refill it.', 'warn');
      }
    } else this.boost = Math.min(100, this.boost + 2.5 * dt);

    const v = this.vel;
    const inWater = G.waterLevel > .5 && this.pos.y < G.waterLevel - .5;
    const flying = (this.mode === 'plane' && !this.onGround) || (this.mode === 'sub' && inWater);
    this.airControl = !this.onGround && !flying;

    // holding JUMP right after jumping makes the jump higher (up to MOVES.holdTime)
    if (this.jumpHold > 0){
      if (inp.jump && !this.onGround){
        const k = Math.min(dt, this.jumpHold);
        v.y += m.jump * (1 - MOVES.hopShare) / MOVES.holdTime * k;
        this.jumpHold -= dt;
      } else this.jumpHold = 0;
    }

    // flips and half flips run on their own clock
    if (this.flip){
      this.flip.t += dt;
      if (this.flip.kind === 'back' && this.flip.t < MOVES.cancelWindow && thr > .5) this.startHalfFlip(steer);
      else if (this.flip.t >= MOVES.flipTime) this.flip = null;
    }
    if (this.half){
      this.half.t += dt;
      const k = Math.min(1, this.half.t / MOVES.halfFlipTime);
      this.heading = wrapAngle(this.half.from + this.half.turn * (1 - (1 - k) * (1 - k)));
      if (k >= 1) this.half = null;
    }

    this.sliding = !!inp.slide && this.onGround && this.mode !== 'sub';
    if (this.onGround || flying){
      // split the velocity into forward and sideways parts, then rebuild it after steering (arcade grip)
      let fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      let vF = v.x * fx + v.z * fz;
      let vL = v.x * fz - v.z * fx;
      if (thr > 0){
        if (vF < -.5) vF += 70 * dt;                                       // braking while reversing
        else if (vF < maxSpeed) vF = Math.min(maxSpeed, vF + accel * thr * dt);
      }
      else if (thr < 0) vF -= (vF > .5 ? 70 : accel * .6) * (-thr) * dt;
      else { vF *= Math.exp(-.9 * dt); if (Math.abs(vF) < .3) vF = 0; }
      if (vF > maxSpeed) vF = Math.max(maxSpeed, vF - 40 * dt);           // slow down after turbo ends
      if (vF < -14 * mul) vF = -14 * mul;
      // powerslide (Q / E): the tyres lose sideways grip and the car turns faster
      vL *= Math.exp(-(this.onGround ? (this.sliding ? MOVES.slideGrip : 9) : 3) * dt);
      const sf = Math.min(1, Math.abs(vF) / 7);
      const turn = m.turn * (this.mode === 'robot' ? Math.max(sf, .7) : sf) * (1 - .25 * Math.min(1, Math.abs(vF) / 50))
        * (this.sliding ? MOVES.slideTurn : 1);
      if (!this.half) this.heading = wrapAngle(this.heading + steer * turn * (vF >= -.5 ? 1 : -1) * dt);
      fx = Math.sin(this.heading); fz = Math.cos(this.heading);
      v.x = fx * vF + fz * vL;
      v.z = fz * vF - fx * vL;
      this.vF = vF;
    } else {
      // air control: A / D turn, W / S tilt the nose down / up, Q / E air roll
      if (!this.flip && !this.half){
        this.heading = wrapAngle(this.heading + steer * MOVES.airYaw * dt);
        if (thr) this.pitch = clamp(this.pitch - thr * MOVES.airPitch * dt, -MAX_PITCH, MAX_PITCH);
        else this.pitch *= Math.exp(-1.2 * dt);
        if (inp.roll) this.roll = wrapAngle(this.roll - inp.roll * MOVES.airRoll * dt);
      }
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      v.x += fx * thr * MOVES.airThrottle * dt;
      v.z += fz * thr * MOVES.airThrottle * dt;
      // aerial: turbo pushes the car where its nose points
      if (this.burning){
        const cp = Math.cos(this.pitch), a = MOVES.airBoost * mul * dt;
        v.x += fx * cp * a;
        v.y += Math.sin(this.pitch) * a;
        v.z += fz * cp * a;
        const cap = maxSpeed + 4, sp = v.length();
        if (sp > cap) v.multiplyScalar(cap / sp);
        this.aerialT += dt;
        if (this.aerialT >= .5 && this.aerialT - dt < .5 && this.pos.y > 4) this.announce('AERIAL');
      }
      this.vF = v.x * fx + v.z * fz;
    }

    let g = GRAV * m.grav;
    if (this.flip && this.flip.t < MOVES.flipStall) g *= .35;     // flips float a little
    if (inWater && this.mode !== 'sub') g *= .6;
    v.y -= g * dt;
    if (this.mode === 'plane' && thr > 0 && this.vF > 16){        // wings give lift at speed
      v.y += Math.min(24, (this.vF - 16) * 1.6) * dt;
      if (v.y > 9) v.y = 9;
    }
    if (this.mode === 'sub' && inWater) v.y *= Math.exp(-1.6 * dt);
    if (inWater && this.mode !== 'sub'){ v.x *= Math.exp(-.8 * dt); v.z *= Math.exp(-.8 * dt); }

    const p = this.pos;
    p.addScaledVector(v, dt);
    if (p.y <= 0){
      p.y = 0;
      if (v.y < 0) v.y = 0;
      if (!this.onGround){ this.pitch = 0; this.roll = 0; this.aerialT = 0; }   // always lands on its wheels
      this.onGround = true;
      this.canDodge = false;
      this.jumpHold = 0;
    }
    else this.onGround = false;
    if (this.mode === 'plane' && p.y > 18){ p.y = 18; if (v.y > 0) v.y = 0; }
    if (this.mode === 'sub' && G.waterLevel > .5 && p.y > G.waterLevel - 1.4){ p.y = Math.max(0, G.waterLevel - 1.4); if (v.y > 0) v.y = 0; }
    if (p.y > CEIL - 4){ p.y = CEIL - 4; if (v.y > 0) v.y = 0; }
    const lx = HALF_W - 1.4, lz = HALF_L - 1.6;
    if (Math.abs(p.x) > lx){ p.x = Math.sign(p.x) * lx; v.x *= -.25; }
    if (Math.abs(p.z) > lz){ p.z = Math.sign(p.z) * lz; v.z *= -.25; }
    if (this.canDodge){ this.dodgeT -= dt; if (this.dodgeT <= 0) this.canDodge = false; }

    const speed = Math.hypot(v.x, v.z);
    if (speed > SUPERSONIC && !this.supersonic){ this.supersonic = true; this.announce('SUPERSONIC'); }
    else if (speed < SUPERSONIC - 4) this.supersonic = false;
  }

  /** Moves the 3D model to match the physics and plays the visual effects. Runs once per frame. */
  sync(dt){
    const m = this.model, g = m.group;
    g.visible = this.dead <= 0;
    if (this.dead > 0) return;
    g.position.copy(this.pos);
    g.rotation.y = this.heading;

    for (let i = 0; i < 4; i++){
      const w = m.wheels[i], b = m.bigList[i];
      w.userData.spin.rotation.x += this.vF * dt / .48;
      b.userData.spin.rotation.x += this.vF * dt / .95;
      if (i < 2){ w.rotation.y = this.steerIn * .45; b.rotation.y = this.steerIn * .35; }
    }

    const t = m.tilt;
    if (this.flip){
      // one full turn around the flip axis, fast at first (ease-out)
      const k = Math.min(1, this.flip.t / MOVES.flipTime);
      t.quaternion.setFromAxisAngle(this.flip.axis, (1 - Math.pow(1 - k, 2.2)) * Math.PI * 2);
    } else if (this.half){
      t.quaternion.slerp(IDENTITY, damp(12, dt));   // the cancelled backflip levels out while the car turns
    } else {
      let px = 0, pz = 0;
      if (this.mode === 'plane' && !this.onGround){ px = clamp(-this.vel.y * .05, -.5, .5); pz = -this.steerIn * .45; }
      else if (!this.onGround) px = -this.pitch + clamp(-this.vel.y * .01, -.15, .15);
      else {
        px = this.mode === 'robot' ? 0 : -this.throttleIn * .04;
        pz = this.steerIn * Math.min(1, Math.abs(this.vF) / 25) * (this.sliding ? .14 : .06);
      }
      if (!this.onGround) pz += this.roll;
      t.rotation.x = lerp(t.rotation.x, px, damp(10, dt));
      t.rotation.y = lerp(t.rotation.y, 0, damp(10, dt));
      // the shortest way round, so a full air roll never spins back the long way
      t.rotation.z += wrapAngle(pz - t.rotation.z) * damp(this.onGround ? 8 : 14, dt);
    }

    if (this.mode === 'robot'){
      const sp = Math.abs(this.vF);
      this.walk += sp * dt * .9;
      const a = this.onGround ? Math.min(1, sp / 6) * .7 : .4;
      const s = Math.sin(this.walk) * a;
      m.legs[0].rotation.x = s; m.legs[1].rotation.x = -s;
      m.arms[0].rotation.x = -s * .8; m.arms[1].rotation.x = s * .8;
    }
    if (this.mode === 'sub') m.prop.rotation.z += dt * (4 + Math.abs(this.vF) * 1.2);
    if (this.mode === 'plane') m.planeProp.rotation.z += dt * (10 + Math.abs(this.vF) * 2);

    this.mastS = lerp(this.mastS, this.radio ? 1 : .12, damp(6, dt));
    m.mast.scale.y = this.mastS;
    m.tip.position.y = 2.2 * this.mastS;

    const burning = this.burning;
    m.flames.visible = burning;
    if (burning) m.flames.scale.set(1, 1, .8 + Math.random() * .6);
    if (this.mode === 'madmax') for (const f of m.maxFlames) f.scale.y = .6 + Math.random() * .9;
    if (this.popT > 0){
      this.popT -= dt;
      const k = 1 - Math.max(0, this.popT) / .35;
      g.scale.setScalar(1 + Math.sin(k * Math.PI) * .22);
    } else g.scale.setScalar(1);

    this.effects(dt, burning);
  }

  effects(dt, burning){
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading), p = this.pos, m = this.model;

    // tyre marks while drifting
    const vL = this.vel.x * fz - this.vel.z * fx;
    const skidding = this.onGround && this.mode !== 'robot' && this.mode !== 'sub' &&
      (Math.abs(vL) > 3.5 || (Math.abs(this.steerIn) > .5 && Math.abs(this.vF) > 24));
    if (skidding){
      this.skidT -= dt;
      if (this.skidT <= 0){
        this.skidT = .03;
        for (const sd of [-1, 1]) addSkid(p.x + fz * sd * 1.12 - fx * 1.3, p.z - fx * sd * 1.12 - fz * 1.3, this.heading);
      }
    }

    this.fxT -= dt;
    if (this.fxT > 0) return;
    this.fxT = .06;
    if (Math.hypot(this.vel.x, this.vel.z) > 38 && this.mode !== 'sub'){       // supersonic trail
      for (const sd of [-1, 1]) emitParticle(p.x - fx * 2.2 + fz * sd * .9, p.y + .7, p.z - fz * 2.2 - fx * sd * .9, -fx * 3, 0, -fz * 3, 0xdff3ff, .4, .4, 0, true);
    }
    if (burning){
      const fp = m.flames.getWorldPosition(tmp);
      for (let i = 0; i < 2; i++) emitParticle(fp.x - fx * 1.2, fp.y, fp.z - fz * 1.2, -fx * 8 + rnd(-2, 2), rnd(-1, 2), -fz * 8 + rnd(-2, 2), i ? 0xffd23f : 0xff7a1a, .35, .3, 0);
    }
    if (this.stall > 0) emitParticle(p.x + fx * 1.5, p.y + 1.4, p.z + fz * 1.5, rnd(-1, 1), rnd(2, 4), rnd(-1, 1), 0x3a3f48, .8, 1.1, -.05, true, 2);
    if (this.mode === 'sub' && G.waterLevel > .5 && p.y < G.waterLevel){
      const bp = m.prop.getWorldPosition(tmp);
      emitParticle(bp.x + rnd(-.4, .4), bp.y, bp.z + rnd(-.4, .4), rnd(-1, 1), rnd(2, 5), rnd(-1, 1), 0xd9f4ff, .25, 1.2, -.15, true);
    }
    if (this.isPlayer && (this.radio || G.radioBrokenT > 0) && Math.random() < .35){
      const tp = m.tip.getWorldPosition(tmp);
      if (G.radioBrokenT > 0) emitParticle(tp.x, tp.y, tp.z, rnd(-.5, .5), rnd(1.5, 3), rnd(-.5, .5), 0x30343c, .5, 1, -.05, true, 2);
      else emitParticle(tp.x, tp.y + .3, tp.z, rnd(-1, 1), rnd(2, 4), rnd(-1, 1), Math.random() < .5 ? 0x3ee08f : 0xffd23f, .3, .9, -.02);
    }
  }
}
