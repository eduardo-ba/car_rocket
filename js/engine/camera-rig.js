// The camera: chase camera behind the player (or ball camera), screen shake,
// a wider view at high speed, and the slow orbit behind the menus.
import * as THREE from '../core/three.js';
import { camera, view } from './renderer.js';
import { clamp, lerp, damp, rnd } from '../core/math.js';

const pos = new THREE.Vector3(0, 40, 90), look = new THREE.Vector3();
const want = new THREE.Vector3(), wantLook = new THREE.Vector3();
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let shake = 0, orbitAngle = .6;

export function addShake(amount){
  if (!reduceMotion) shake = Math.max(shake, amount);
}

const liftFor = car => car.mode === 'robot' ? 2.2 : car.mode === '4x4' ? 1 : 0;

export function snapBehind(car){
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading), p = car.pos;
  pos.set(p.x - fx * 10, p.y + 4.3, p.z - fz * 10);
  look.set(p.x + fx * 6, p.y + 1.6, p.z + fz * 6);
}

export function follow(dt, car, ball, ballCam){
  const p = car.pos, fx = Math.sin(car.heading), fz = Math.cos(car.heading), lift = liftFor(car);
  if (ballCam && ball.visible){
    let bx = ball.pos.x - p.x, bz = ball.pos.z - p.z;
    const len = Math.hypot(bx, bz);
    if (len < .5){ bx = fx; bz = fz; } else { bx /= len; bz /= len; }
    want.set(p.x - bx * 10.5, p.y + 4.6 + lift, p.z - bz * 10.5);
    wantLook.set(lerp(p.x, ball.pos.x, .65), lerp(p.y + 1.5 + lift, ball.pos.y, .5), lerp(p.z, ball.pos.z, .65));
  } else {
    want.set(p.x - fx * 10, p.y + 4.3 + lift, p.z - fz * 10);
    wantLook.set(p.x + fx * 6, p.y + 1.6 + lift, p.z + fz * 6);
  }
  pos.lerp(want, damp(7, dt));
  look.lerp(wantLook, damp(12, dt));
  if (pos.y < .8) pos.y = .8;

  const speed = Math.hypot(car.vel.x, car.vel.z);
  const fov = view.baseFov + clamp((speed - 24) / 22, 0, 1) * 9;
  if (Math.abs(camera.fov - fov) > .05){
    camera.fov = lerp(camera.fov, fov, damp(3, dt));
    camera.updateProjectionMatrix();
  }

  camera.position.copy(pos);
  if (shake > 0){
    camera.position.x += rnd(-1, 1) * shake;
    camera.position.y += rnd(-1, 1) * shake * .6;
    camera.position.z += rnd(-1, 1) * shake;
    shake = Math.max(0, shake - dt * 2.5);
  }
  camera.lookAt(look);
}

export function orbit(dt){
  orbitAngle += dt * .07;
  camera.position.set(Math.sin(orbitAngle) * 92, 42, Math.cos(orbitAngle) * 92);
  camera.lookAt(0, 0, 0);
  if (camera.fov !== view.baseFov){ camera.fov = view.baseFov; camera.updateProjectionMatrix(); }
}
