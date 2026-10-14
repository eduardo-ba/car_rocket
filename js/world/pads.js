// Boost pads like in Rocket League: 6 big orbs (full boost, back in 10 s) and 14 small discs
// (12 boost, back in 4 s). Driving over an active pad refills the boost.
import * as THREE from '../core/three.js';
import { scene } from '../engine/renderer.js';
import { mk, CYL, std, glow, mergeStatic } from '../engine/kit.js';
import { padRingTexture, glowTexture } from './textures.js';

const BIG = [[-32, -46], [32, -46], [-36, 0], [36, 0], [-32, 46], [32, 46]];
const SMALL = [[0, -22], [0, 22], [-18, -32], [18, -32], [-18, 32], [18, 32], [-22, -12], [22, -12],
  [-22, 12], [22, 12], [-10, -50], [10, -50], [-10, 50], [10, 50]];
const KIND = {
  big: { refill: 100, respawn: 10, radius: 3, base: [1.8, 2], orbY: 1.4 },
  small: { refill: 12, respawn: 4, radius: 2.2, base: [1, 1.15], orbY: .55 }
};

const bases = new THREE.Group();
const baseMat = std(0x2a2f38, { metalness: .6, roughness: .35 });
const rimMat = glow(0xffb21f, 2.2);
const ringMat = glow(0xffffff, 1.4, {
  map: padRingTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  polygonOffset: true, polygonOffsetFactor: -4
});
const coreMat = glow(0xfff3c4, 3.5);
const shellMat = glow(0xffa21f, 1.5, { transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending });
const haloMat = new THREE.SpriteMaterial({
  map: glowTexture('rgba(255,220,120,.8)', 'rgba(255,160,20,.15)'),
  color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
const smallMat = glow(0xffd23f, 2.4);
const bigCore = new THREE.IcosahedronGeometry(.55, 1);
const bigShell = new THREE.IcosahedronGeometry(.9, 1);
const bigRing = new THREE.TorusGeometry(1.05, .06, 6, 32);
const smallGeo = new THREE.CylinderGeometry(.55, .55, .14, 20);
const ringGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

function orbFor(kind){
  const g = new THREE.Group();
  if (kind === 'big'){
    g.add(new THREE.Mesh(bigCore, coreMat));
    g.add(new THREE.Mesh(bigShell, shellMat));
    const ring = new THREE.Mesh(bigRing, rimMat);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(2.8);
    g.add(halo);
  } else {
    g.add(new THREE.Mesh(smallGeo, smallMat));
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(1.4);
    g.add(halo);
  }
  return g;
}

const make = (spots, kind) => spots.map(([x, z]) => {
  const k = KIND[kind];
  mk(CYL(k.base[0], k.base[1], .25, 28), baseMat, x, .12, z, bases, false).receiveShadow = true;
  const rim = mk(new THREE.TorusGeometry(k.base[0] - .08, .07, 4, 28), rimMat, x, .26, z, bases, false);
  rim.rotation.x = Math.PI / 2;
  const ring = mk(ringGeo, ringMat, x, .27, z, bases, false);
  ring.scale.setScalar(k.base[1] * 2.6);
  const orb = orbFor(kind);
  orb.position.set(x, k.orbY, z);
  scene.add(orb);
  return { x, z, orb, kind, ...k, active: true, t: 0 };
});
export const pads = [...make(BIG, 'big'), ...make(SMALL, 'small')];
mergeStatic(bases);
scene.add(bases);

export function resetPads(){
  for (const pad of pads){ pad.active = true; pad.t = 0; }
}

/** Gives boost to any car on an active pad. Calls onPickup(car, pad) for each pickup. */
export function collectPads(dt, cars, onPickup){
  for (const pad of pads){
    if (!pad.active){
      pad.t -= dt;
      if (pad.t <= 0) pad.active = true;
      continue;
    }
    for (const car of cars){
      if (car.dead > 0 || car.pos.y > 3 || car.boost >= 100) continue;
      if (Math.hypot(car.pos.x - pad.x, car.pos.z - pad.z) < pad.radius){
        car.boost = Math.min(100, car.boost + pad.refill);
        pad.active = false;
        pad.t = pad.respawn;
        onPickup(car, pad);
        break;
      }
    }
  }
}

let clock = 0;
export function updatePadVisuals(dt){
  clock += dt;
  for (const pad of pads){
    pad.orb.visible = pad.active;
    pad.orb.position.y = pad.orbY + Math.sin(clock * 3 + pad.x) * (pad.kind === 'big' ? .25 : .08);
    pad.orb.rotation.y += dt * 2;
    if (pad.kind === 'big'){
      const pulse = 1 + Math.sin(clock * 5 + pad.z) * .08;
      pad.orb.children[1].scale.setScalar(pulse);
      pad.orb.children[2].rotation.y += dt * 1.5;
    }
  }
}
