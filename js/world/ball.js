// The ball: its mesh, the shadow circle under it, and its position/velocity state.
// The physics that moves it lives in game/physics.js.
import * as THREE from '../core/three.js';
import { scene } from '../engine/renderer.js';
import { std, basic } from '../engine/kit.js';
import { BALL_R } from '../config.js';
import { clamp } from '../core/math.js';
import { emitParticle } from '../fx/particles.js';

function ballTexture(){
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f3f6fa'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#1c2738'; g.fillRect(0, 0, 512, 20); g.fillRect(0, 236, 512, 20);
  const hex = (x, y, rx, ry) => {
    g.beginPath();
    for (let k = 0; k < 6; k++){ const a = k * Math.PI / 3; g.lineTo(x + Math.cos(a) * rx, y + Math.sin(a) * ry); }
    g.closePath(); g.fill();
  };
  for (const row of [{ lat: -52, off: 0 }, { lat: -16, off: .5 }, { lat: 16, off: 0 }, { lat: 52, off: .5 }]){
    const y = 128 - row.lat / 90 * 128, sx = 1 / Math.max(Math.cos(row.lat * Math.PI / 180), .3);
    for (let i = 0; i < 5; i++){
      const x = (i + row.off) / 5 * 512;
      for (const shift of [-512, 0, 512]) hex(x + shift, y, 19 * sx, 19);
    }
  }
  g.fillStyle = '#ff8a1f'; g.fillRect(0, 126, 512, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), std(0xffffff, { map: ballTexture(), roughness: .4 }));
mesh.castShadow = true;
scene.add(mesh);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R, 24), basic(0x000000, { transparent: true, opacity: .35, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);

export const ball = {
  mesh, shadow,
  pos: new THREE.Vector3(0, BALL_R, 0),
  vel: new THREE.Vector3(),
  visible: true,
  lastTouch: null
};

export function resetBall(){
  ball.pos.set(0, BALL_R, 0);
  ball.vel.set(0, 0, 0);
  ball.visible = true;
  ball.lastTouch = null;
  mesh.quaternion.identity();
}

const axis = new THREE.Vector3(), spin = new THREE.Quaternion();

export function syncBall(dt){
  mesh.visible = shadow.visible = ball.visible;
  if (!ball.visible) return;
  mesh.position.copy(ball.pos);
  const v = ball.vel, hs = Math.hypot(v.x, v.z);
  if (hs > .01){
    axis.set(v.z / hs, 0, -v.x / hs);            // roll in the direction it moves
    spin.setFromAxisAngle(axis, hs * dt / BALL_R);
    mesh.quaternion.premultiply(spin);
  }
  shadow.position.set(ball.pos.x, .04, ball.pos.z);
  const k = clamp(1 - ball.pos.y / 30, .3, 1);
  shadow.scale.setScalar(k * 1.1);
  shadow.material.opacity = .35 * k;
  if (v.length() > 40 && Math.random() < .6) emitParticle(ball.pos.x, ball.pos.y, ball.pos.z, 0, 0, 0, 0xffffff, .5, .35, 0, true);
}
