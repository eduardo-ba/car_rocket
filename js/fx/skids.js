// Tyre marks when a car drifts. All marks are instances of one mesh (1 draw call);
// the oldest marks are reused when the limit is reached.
import * as THREE from '../core/three.js';
import { scene } from '../engine/renderer.js';

const MAX = 300;
const geo = new THREE.PlaneGeometry(.42, .7).rotateX(-Math.PI / 2);
const mat = new THREE.MeshBasicMaterial({
  color: 0x0a0d0a, transparent: true, opacity: .3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
});
const marks = new THREE.InstancedMesh(geo, mat, MAX);
marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
marks.count = 0;
marks.frustumCulled = false;
scene.add(marks);

let next = 0;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);

export function addSkid(x, z, heading){
  q.setFromAxisAngle(UP, heading);
  m4.compose(p.set(x, .025, z), q, ONE);
  marks.setMatrixAt(next, m4);
  next = (next + 1) % MAX;
  marks.count = Math.min(MAX, marks.count + 1);
  marks.instanceMatrix.needsUpdate = true;
}

export function clearSkids(){
  next = 0;
  marks.count = 0;
}
