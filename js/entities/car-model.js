// Builds the 3D model of one RC car with every transformation.
// Each transformation is a group that is shown or hidden; static meshes are merged at the end.
import * as THREE from '../core/three.js';
import { mk, BOX, CYL, std, M, mergeStatic } from '../engine/kit.js';

const wheelGeo = CYL(.48, .48, .42, 18).rotateZ(Math.PI / 2);
const hubGeo = CYL(.25, .25, .44, 10).rotateZ(Math.PI / 2);
const bigWheelGeo = CYL(.95, .95, .75, 20).rotateZ(Math.PI / 2);
const bigHubGeo = CYL(.45, .45, .77, 12).rotateZ(Math.PI / 2);

/** A wheel = steering group > spinning group > meshes. */
function wheel(parent, x, y, z, tireGeo, rimGeo, spokeSize){
  const steer = new THREE.Group();
  steer.position.set(x, y, z);
  parent.add(steer);
  const spin = new THREE.Group();
  steer.add(spin);
  mk(tireGeo, M.tire, 0, 0, 0, spin);
  mk(rimGeo, M.rim, 0, 0, 0, spin);
  mk(BOX(...spokeSize), M.rim, 0, 0, 0, spin, false);
  steer.userData.spin = spin;
  return steer;
}

export function buildCarModel(color){
  const P = {};
  const group = P.group = new THREE.Group();
  const tilt = P.tilt = new THREE.Group();     // flips and body roll rotate around the car's centre
  tilt.position.y = .9;
  group.add(tilt);
  const root = new THREE.Group();
  root.position.y = -.9;
  tilt.add(root);
  const bm = P.bodyMat = std(color, { roughness: .42, metalness: .25 });

  /* ----- normal RC car ----- */
  const car = P.carParts = new THREE.Group(); root.add(car);
  const ch = P.chassis = new THREE.Group(); car.add(ch);
  mk(BOX(2.2, .62, 4.0), bm, 0, .78, 0, ch);
  mk(BOX(1.8, .55, 1.9), M.glass, 0, 1.36, -.35, ch);
  mk(BOX(1.86, .1, 1.6), bm, 0, 1.66, -.45, ch);
  mk(BOX(.42, .03, 4.02), M.white, 0, 1.095, 0, ch, false);
  for (const x of [-.68, .68]){
    mk(BOX(.42, .16, .06), M.headlight, x, .86, 2.01, ch, false);
    mk(BOX(.42, .14, .06), M.taillight, x, .88, -2.01, ch, false);
  }
  mk(BOX(2.3, .24, .3), M.dark, 0, .52, 2.05, ch);
  mk(BOX(2.3, .24, .3), M.dark, 0, .52, -2.05, ch);
  P.wheels = [[-1.12, 1.3], [1.12, 1.3], [-1.12, -1.3], [1.12, -1.3]]
    .map(([x, z]) => wheel(car, x, .48, z, wheelGeo, hubGeo, [.45, .08, .62]));

  /* ----- 4X4 ----- */
  P.bigWheels = new THREE.Group(); car.add(P.bigWheels);
  P.bigList = [[-1.5, 1.45], [1.5, 1.45], [-1.5, -1.45], [1.5, -1.45]]
    .map(([x, z]) => wheel(P.bigWheels, x, .95, z, bigWheelGeo, bigHubGeo, [.78, .14, 1.2]));
  const four = P.fourParts = new THREE.Group(); ch.add(four);
  for (const x of [-.85, .85]){
    mk(BOX(.1, .5, .1), M.dark, x, 1.95, .45, four);
    mk(BOX(.1, .5, .1), M.dark, x, 1.95, -1.2, four);
    mk(BOX(.1, .1, 1.75), M.dark, x, 2.2, -.37, four);
    mk(BOX(.03, .25, 3.6), M.mud, x > 0 ? 1.115 : -1.115, .62, 0, four, false);
  }
  mk(BOX(1.8, .1, .1), M.dark, 0, 2.2, .45, four);
  mk(BOX(1.5, .22, .25), M.dark, 0, 2.36, .45, four);
  for (const x of [-.5, -.17, .17, .5]) mk(BOX(.22, .15, .05), M.headlight, x, 2.36, .59, four, false);
  mk(BOX(2.1, .55, .15), M.chrome, 0, .75, 2.3, four);

  /* ----- PLANE ----- */
  const pl = P.planeParts = new THREE.Group(); ch.add(pl);
  mk(BOX(7, .1, 1.5), M.white, 0, 1.0, .1, pl);
  for (const x of [-3.2, 3.2]) mk(BOX(.6, .13, 1.52), bm, x, 1.0, .1, pl);
  mk(BOX(.1, 1.1, .9), M.white, 0, 1.6, -1.7, pl);
  mk(BOX(.12, .4, .92), bm, 0, 2.0, -1.7, pl);
  mk(BOX(2.6, .08, .7), M.white, 0, 1.15, -1.85, pl);
  const pp = P.planeProp = new THREE.Group(); pp.position.set(0, .8, 2.3); pl.add(pp);
  mk(new THREE.ConeGeometry(.2, .4, 10).rotateX(Math.PI / 2), M.chrome, 0, 0, .15, pp);
  mk(BOX(.14, 1.6, .05), M.dark, 0, 0, 0, pp);

  /* ----- MAD MAX ----- */
  const mx = P.maxParts = new THREE.Group(); ch.add(mx);
  mk(BOX(.75, .4, .7), M.chrome, 0, 1.28, 1.1, mx);
  mk(BOX(.55, .3, .45), M.dark, 0, 1.6, 1.1, mx);
  const frontSpike = new THREE.ConeGeometry(.13, .75, 8).rotateX(Math.PI / 2);
  for (const x of [-.9, -.45, 0, .45, .9]) mk(frontSpike, M.spike, x, .55, 2.55, mx);
  const sideSpike = new THREE.ConeGeometry(.12, .6, 8);
  for (const [x, z] of [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]]){
    mk(sideSpike, M.spike, x * 1.55, .48, z, mx).rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  for (const x of [-1.15, 1.15]) mk(BOX(.08, .45, 3.0), M.dark, x, .85, -.1, mx);
  P.maxFlames = [];
  for (const x of [-.75, .75]){
    mk(CYL(.12, .15, 1.1, 10), M.chrome, x, 1.45, -1.75, mx);
    const flame = mk(new THREE.ConeGeometry(.16, .6, 8).translate(0, .3, 0), M.flame, x, 2.0, -1.75, mx, false);
    flame.userData.keep = true;
    P.maxFlames.push(flame);
  }
  mk(CYL(.45, .45, .3, 16), M.tire, 0, 1.25, -2.25, mx).rotation.x = Math.PI / 2;

  /* ----- TUNING ----- */
  const tu = P.tuneParts = new THREE.Group(); ch.add(tu);
  for (const x of [-.75, .75]) mk(BOX(.1, .55, .25), M.dark, x, 1.35, -1.75, tu);
  mk(BOX(2.6, .1, .75), M.carbon, 0, 1.65, -1.8, tu);
  for (const x of [-1.13, 1.13]) mk(BOX(.06, .08, 3.4), M.neon, x, .5, 0, tu, false);
  mk(BOX(2.3, .06, .5), M.carbon, 0, .42, 2.15, tu);
  for (const x of [-.36, .36]) mk(BOX(.2, .02, 4.02), M.white, x, 1.1, 0, tu, false);
  mk(new THREE.PlaneGeometry(3.4, 5.2), M.glow, 0, .12, 0, tu, false).rotation.x = -Math.PI / 2;

  /* ----- SUBMARINE ----- */
  const sub = P.subParts = new THREE.Group(); root.add(sub);
  mk(CYL(1, 1, 3.6, 20).rotateX(Math.PI / 2), M.yellow, 0, 1.1, 0, sub);
  mk(new THREE.SphereGeometry(1, 20, 14), M.yellow, 0, 1.1, 1.8, sub);
  mk(new THREE.ConeGeometry(1, 1.6, 20).rotateX(-Math.PI / 2), M.yellow, 0, 1.1, -2.6, sub);
  mk(CYL(1.03, 1.03, .4, 20).rotateX(Math.PI / 2), bm, 0, 1.1, .6, sub);
  mk(BOX(.8, .8, 1.3), M.yellow, 0, 2.3, .2, sub);
  mk(CYL(.08, .08, 1, 8), M.dark, .2, 3.1, .5, sub);
  mk(BOX(.18, .18, .45), M.dark, .2, 3.6, .65, sub);
  const port = CYL(.22, .22, .1, 14).rotateZ(Math.PI / 2);
  for (const z of [1, 0, -1]) for (const x of [-.98, .98]) mk(port, M.glass, x, 1.25, z, sub, false);
  mk(BOX(2.6, .08, .6), M.dark, 0, 1.1, -2.4, sub);
  mk(BOX(.08, 1.4, .6), M.dark, 0, 1.1, -2.4, sub);
  const prop = P.prop = new THREE.Group(); prop.position.set(0, 1.1, -3.45); sub.add(prop);
  for (let i = 0; i < 3; i++){
    const blade = new THREE.Group();
    blade.rotation.z = i * Math.PI * 2 / 3;
    prop.add(blade);
    mk(BOX(.2, .8, .06), M.chrome, 0, .4, 0, blade);
  }

  /* ----- ROBOT ----- */
  const rb = P.robotParts = new THREE.Group(); root.add(rb);
  P.legs = []; P.arms = [];
  for (const sd of [-1, 1]){
    const hip = new THREE.Group(); hip.position.set(sd * .48, 1.75, 0); rb.add(hip);
    mk(BOX(.55, 1.5, .6), bm, 0, -.75, 0, hip);
    mk(BOX(.7, .28, 1.0), M.dark, 0, -1.62, .15, hip);
    mk(wheelGeo, M.tire, sd * .38, -1.0, -.05, hip);
    P.legs.push(hip);
  }
  mk(BOX(1.4, .4, .75), M.dark, 0, 1.85, 0, rb);
  mk(BOX(2.0, 1.4, 1.05), bm, 0, 2.75, 0, rb);
  mk(BOX(1.3, .6, .06), M.glass, 0, 2.9, .54, rb);
  for (const x of [-.65, .65]) mk(BOX(.36, .18, .06), M.headlight, x, 2.3, .54, rb, false);
  mk(BOX(.8, .7, .75), M.chrome, 0, 3.8, 0, rb);
  mk(BOX(.62, .16, .06), M.visor, 0, 3.85, .39, rb, false);
  for (const x of [-.45, .45]) mk(BOX(.08, .4, .25), bm, x, 3.95, 0, rb);
  for (const sd of [-1, 1]){
    const shoulder = new THREE.Group(); shoulder.position.set(sd * 1.2, 3.25, 0); rb.add(shoulder);
    mk(BOX(.5, .5, .55), M.dark, 0, 0, 0, shoulder);
    mk(BOX(.4, 1.3, .45), bm, 0, -.8, 0, shoulder);
    mk(BOX(.5, .42, .5), M.dark, 0, -1.6, 0, shoulder);
    P.arms.push(shoulder);
    mk(BOX(.12, 1.1, .9), bm, sd * .75, 3.2, -.7, rb).rotation.z = sd * -.4;   // car doors as wings
  }

  /* ----- radio antenna ----- */
  const ant = P.antenna = new THREE.Group(); root.add(ant);
  P.mast = mk(CYL(.035, .05, 2.2, 6).translate(0, 1.1, 0), M.chrome, 0, 0, 0, ant, false);
  P.tip = mk(new THREE.SphereGeometry(.13, 10, 8), M.radio, 0, .26, 0, ant, false);
  P.mast.userData.keep = P.tip.userData.keep = true;

  /* ----- turbo flames ----- */
  const fl = P.flames = new THREE.Group(); root.add(fl);
  const outer = new THREE.ConeGeometry(.24, 1.3, 10).rotateX(-Math.PI / 2).translate(0, 0, -.65);
  const inner = new THREE.ConeGeometry(.12, .8, 8).rotateX(-Math.PI / 2).translate(0, 0, -.4);
  for (const x of [-.55, .55]){
    mk(outer, M.flame, x, 0, 0, fl, false);
    mk(inner, M.flameCore, x, 0, 0, fl, false);
  }
  fl.visible = false;

  mergeStatic(group);
  return P;
}
