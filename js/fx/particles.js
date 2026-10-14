// Particles drawn with instancing: hundreds of sparks, smoke and confetti cost
// 2 draw calls (one solid layer, one see-through layer) instead of one per particle.
import * as THREE from '../core/three.js';
import { scene } from '../engine/renderer.js';
import { GRAV } from '../config.js';
import { rnd } from '../core/math.js';

const MAX = 700;
const cube = new THREE.BoxGeometry(1, 1, 1);
const colors = new Map();
const colorOf = hex => {
  let c = colors.get(hex);
  if (!c){ c = new THREE.Color(hex); colors.set(hex, c); }
  return c;
};

function makeLayer(transparent){
  const mat = new THREE.MeshBasicMaterial(transparent ? { transparent: true, opacity: .5, depthWrite: false } : {});
  const mesh = new THREE.InstancedMesh(cube, mat, MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < MAX; i++) mesh.setColorAt(i, colorOf(0xffffff));
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, list: [] };
}
const layers = [makeLayer(false), makeLayer(true)];
const spare = [];

/** One particle. grav: 1 = normal gravity, negative = floats up. grow > 0 = puffs up like smoke. */
export function emitParticle(x, y, z, vx, vy, vz, color, size, life, grav = 1, transparent = false, grow = 0){
  const layer = layers[transparent ? 1 : 0];
  if (layer.list.length >= MAX) return;
  const p = spare.pop() || {};
  p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
  p.color = color; p.size = size; p.life = life; p.max = life;
  p.grav = grav; p.grow = grow; p.rx = rnd(3); p.ry = rnd(3);
  layer.list.push(p);
}

/** Explosion of n particles in random directions. */
export function burst(x, y, z, n, palette, speed, size, life, grav = 1, up = 0){
  for (let i = 0; i < n; i++){
    const a = rnd(Math.PI * 2), e = rnd(-.2, 1.3), sp = rnd(speed * .3, speed);
    emitParticle(x, y, z,
      Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + up, Math.sin(a) * Math.cos(e) * sp,
      palette[i % palette.length], size * rnd(.6, 1.3), life * rnd(.6, 1.2), grav);
  }
}

/* fireballs for explosions and goals (a small reusable pool) */
const blasts = [];
export function fireball(x, y, z, color, size){
  let b = blasts.find(item => !item.mesh.visible);
  if (!b){
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    scene.add(mesh);
    b = { mesh, t: 0, size: 1 };
    blasts.push(b);
  }
  b.mesh.material.color.setHex(color);
  b.mesh.position.set(x, y, z);
  b.mesh.visible = true;
  b.t = 0; b.size = size;
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), euler = new THREE.Euler();
const pv = new THREE.Vector3(), sv = new THREE.Vector3();

export function updateParticles(dt){
  for (const layer of layers){
    const list = layer.list;
    let n = 0;
    for (let i = 0; i < list.length; i++){
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0){ spare.push(p); continue; }
      p.vy -= GRAV * p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < .1 && p.vy < 0){ p.y = .1; p.vy *= -.4; p.vx *= .7; p.vz *= .7; }
      p.rx += dt * 3;
      const k = p.life / p.max;
      const s = p.grow ? p.size * (1 + (1 - k) * p.grow) : p.size * k;
      euler.set(p.rx, p.ry, 0);
      q.setFromEuler(euler);
      m4.compose(pv.set(p.x, p.y, p.z), q, sv.set(s, s, s));
      layer.mesh.setMatrixAt(n, m4);
      layer.mesh.setColorAt(n, colorOf(p.color));
      list[n++] = p;
    }
    list.length = n;
    layer.mesh.count = n;
    layer.mesh.instanceMatrix.needsUpdate = true;
    layer.mesh.instanceColor.needsUpdate = true;
  }
  for (const b of blasts){
    if (!b.mesh.visible) continue;
    b.t += dt;
    const k = b.t / .6;
    if (k >= 1){ b.mesh.visible = false; continue; }
    b.mesh.scale.setScalar(1 + k * b.size);
    b.mesh.material.opacity = .85 * (1 - k);
  }
}
