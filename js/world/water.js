// Water that fills the field while the player is a submarine, and the blue
// underwater fog when the camera goes below the surface.
import * as THREE from '../core/three.js';
import { scene, camera, SKY, SEA } from '../engine/renderer.js';
import { std } from '../engine/kit.js';
import { HALF_W, HALF_L, GOAL_D } from '../config.js';
import { lerp, damp } from '../core/math.js';
import { skyGroup } from './sky.js';

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(HALF_W * 2, HALF_L * 2 + GOAL_D * 2),
  std(0x1690ff, { transparent: true, opacity: .36, roughness: .15, metalness: .1, side: THREE.DoubleSide, depthWrite: false })
);
water.rotation.x = -Math.PI / 2;
water.visible = false;
scene.add(water);

let clock = 0;

export function cameraUnderwater(){
  return water.visible && camera.position.y < water.position.y;
}

export function updateWater(dt, level){
  clock += dt;
  water.visible = level > -.5;
  water.position.y = level;
  water.material.opacity = .33 + Math.sin(clock * 2) * .03;
  const under = cameraUnderwater(), k = damp(6, dt);
  scene.background.lerp(under ? SEA : SKY, k);
  scene.fog.color.copy(scene.background);
  skyGroup.visible = !under;
  scene.fog.near = lerp(scene.fog.near, under ? 6 : 140, k);
  scene.fog.far = lerp(scene.fog.far, under ? 110 : 320, k);
}
