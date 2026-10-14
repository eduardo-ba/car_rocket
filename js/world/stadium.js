// The stadium: field, glass walls, goals, a bowl of stands with the crowd, the roof,
// light towers and screens. Everything static is built into one group and merged by material.
// Only the look lives here: the walls, goals and ceiling the ball bounces on are in game/physics.js.
import * as THREE from '../core/three.js';
import { scene, view } from '../engine/renderer.js';
import { mk, BOX, CYL, std, basic, matte, glow, neon as neonOf, luminance, mergeStatic } from '../engine/kit.js';
import { HALF_W, HALF_L, WALL_H, GOAL_HW, GOAL_H, GOAL_D, TEAM } from '../config.js';
import { rnd, pick } from '../core/math.js';
import { buildBoards, ledBoard } from './boards.js';
import { fieldTexture, hexTexture, netTexture, goalBackTexture, concreteTexture, windowTexture, glowTexture } from './textures.js';
import './sky.js';

/* ---------- the bowl ----------
   Each tier is a rounded rectangle ring. Tier i starts at inner(i) and is top(i) metres high.
   The club level (tier CLUB) is raised to leave room for a ring of LED screens. */
const TIERS = 9, STEP_D = 2.8, CLUB = 4, CLUB_LIFT = 3, ROOF_Y = 27;
const inner = i => ({ hx: HALF_W + 6 + i * STEP_D, hz: HALF_L + 10 + i * STEP_D, r: 10 + i * STEP_D });
const top = i => 2.2 + i * 1.85 + (i >= CLUB ? CLUB_LIFT : 0);
const grow = (rr, d) => ({ hx: rr.hx + d, hz: rr.hz + d, r: Math.max(.5, rr.r + d) });
const OUT = inner(TIERS);

const ORANGE = new THREE.Color(TEAM.orange.color), BLUE = new THREE.Color(TEAM.blue.color), WHITE = new THREE.Color(0xffffff);

let crowd = null, crowdTime = 0;

export function buildStadium(){
  const root = new THREE.Group();
  root.name = 'stadium';
  buildField(root);
  buildWalls(root);
  buildGoal(root, -1, TEAM.orange.color);
  buildGoal(root, 1, TEAM.blue.color);
  buildBowl(root);
  crowd = buildCrowd(root);
  buildRoof(root);
  buildTowers(root);
  buildBoards(root, { roofY: ROOF_Y, screenZ: inner(5.5).hz + 1 });
  buildTeamLights(root);
  mergeStatic(root);
  scene.add(root);
}

/** Makes the fans jump after a goal. `hype` goes from 3 down to 0. */
export function updateCrowd(dt, hype){
  crowdTime += dt;
  const high = view.quality === 'high';          // the light beams and flares are only drawn on HIGH
  if (beamMat.visible !== high) beamMat.visible = flareMat.visible = high;
  if (!crowd || (hype <= 0 && !crowd.moving)) return;
  const amp = Math.max(0, hype) / 3 * .9;
  const { fans, bodies, heads } = crowd;
  for (let i = 0; i < fans.length; i++){
    const f = fans[i];
    const lift = Math.max(0, Math.sin(crowdTime * 14 + f.phase)) * amp;
    setFan(bodies, heads, i, f, lift);
  }
  bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
  crowd.moving = hype > 0;
}

/* ---------- shapes ---------- */
function roundRect(path, { hx, hz, r }){
  path.moveTo(hx, -hz + r);
  path.lineTo(hx, hz - r);
  path.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false);
  path.lineTo(-hx + r, hz);
  path.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(-hx, -hz + r);
  path.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5, false);
  path.lineTo(hx - r, -hz);
  path.absarc(hx - r, -hz + r, r, Math.PI * 1.5, Math.PI * 2, false);
  return path;
}

/** A flat ring between two rounded rectangles, from height y0 to y1. */
function ringGeo(innerRR, outerRR, y0, y1, curveSegments = 12){
  const shape = roundRect(new THREE.Shape(), outerRR);
  shape.holes.push(roundRect(new THREE.Path(), innerRR));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments });
  geo.rotateX(-Math.PI / 2);   // the shape lies on the ground and the extrusion goes up
  geo.translate(0, y0, 0);
  return geo;
}

/** Points every `step` metres along a rounded rectangle, with the outward direction. */
function along({ hx, hz, r }, step){
  const sx = hx - r, sz = hz - r, out = [];
  const parts = [
    { line: [hx, -sz, hx, sz], n: [1, 0] }, { arc: [sx, sz, 0] },
    { line: [sx, hz, -sx, hz], n: [0, 1] }, { arc: [-sx, sz, Math.PI / 2] },
    { line: [-hx, sz, -hx, -sz], n: [-1, 0] }, { arc: [-sx, -sz, Math.PI] },
    { line: [-sx, -hz, sx, -hz], n: [0, -1] }, { arc: [sx, -sz, Math.PI * 1.5] }
  ];
  const lens = parts.map(p => p.line ? Math.hypot(p.line[2] - p.line[0], p.line[3] - p.line[1]) : r * Math.PI / 2);
  const total = lens.reduce((a, b) => a + b, 0);
  let k = 0, start = 0;
  for (let s = step / 2; s < total; s += step){
    while (s > start + lens[k]){ start += lens[k]; k++; }
    const t = (s - start) / lens[k], p = parts[k];
    if (p.line){
      const [x0, z0, x1, z1] = p.line;
      out.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx: p.n[0], nz: p.n[1], s });
    } else {
      const a = p.arc[2] + t * Math.PI / 2, nx = Math.cos(a), nz = Math.sin(a);
      out.push({ x: p.arc[0] + nx * r, z: p.arc[1] + nz * r, nx, nz, s });
    }
  }
  return out;
}

/** Orange on the orange half (-z), blue on the blue half, white in the middle. */
function teamColorAt(z, out = new THREE.Color()){
  const t = THREE.MathUtils.smoothstep(Math.abs(z), 6, 30);
  return out.copy(WHITE).lerp(z < 0 ? ORANGE : BLUE, t);
}
/** Vertex colors by team half. even = true gives every color the same brightness (for neon lights). */
function paintByZ(geo, even = false){
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++){
    teamColorAt(pos.getZ(i), c);
    if (even) c.multiplyScalar(1 / luminance(c));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/* ---------- field ---------- */
/** Grass with a fine grain drawn by the shader in world space, so it looks sharp up close. */
function grassMaterial(map){
  const mat = matte(0xd2e0d6, { map });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrassPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrassPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGrassPos;
        float gHash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float gNoise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float gNear = smoothstep(45.0, 6.0, distance(vGrassPos, cameraPosition));
        float gBlade = gNoise(vGrassPos.xz * vec2(26.0, 9.0));
        float gClump = gNoise(vGrassPos.xz * 0.7) * 0.6 + gNoise(vGrassPos.xz * 3.1) * 0.4;
        diffuseColor.rgb *= 0.92 + gClump * 0.12 + (gBlade - 0.5) * 0.1 * gNear;`);
  };
  return mat;
}

function buildField(root){
  const field = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, HALF_L * 2), grassMaterial(fieldTexture()));
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  root.add(field);

  // concrete floor between the walls and the stands
  const concrete = concreteTexture();
  const apronW = OUT.hx * 2 + 4, apronL = OUT.hz * 2 + 4;
  concrete.repeat.set(apronW / 4, apronL / 4);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(apronW, apronL), matte(0x9aa4b4, { map: concrete }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -.02;
  apron.receiveShadow = true;
  root.add(apron);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), matte(0x070b11));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.05;
  root.add(ground);

  // glowing goal lines
  for (const [sz, color] of [[-1, TEAM.orange.color], [1, TEAM.blue.color]]){
    const line = mk(BOX(GOAL_HW * 2, .03, .35), neonOf(color, 1.3), 0, .02, sz * (HALF_L - .2), root, false);
    line.receiveShadow = false;
  }
}

/* ---------- glass walls ---------- */
// unlit on purpose: the glass covers a lot of the screen, several layers deep, and lighting it would cost every light per pixel
const glassMat = basic(0x9ccfff, { transparent: true, opacity: .07, side: THREE.DoubleSide, depthWrite: false });
const hexMat = basic(0xffffff, {
  map: hexTexture(), vertexColors: true, transparent: true, opacity: .42,
  side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
});
const kickMat = std(0x111a2a, { roughness: .5, metalness: .3 });
const frameMat = std(0x2b3546, { roughness: .35, metalness: .7 });
const neon = { orange: neonOf(TEAM.orange.color, 1.5), blue: neonOf(TEAM.blue.color, 1.5) };
const neonFade = glow(0xffffff, 1.5, { vertexColors: true });   // with paintByZ(geo, true)
const HEX_TILE = 24;   // metres of wall covered by one copy of the hexagon texture

/** One glass panel: the see-through glass plus the glowing hexagons on it. */
function glass(root, w, h, x, y, z, rotY = 0){
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
  p.position.set(x, y, z);
  p.rotation.y = rotY;
  root.add(p);
  const geo = new THREE.PlaneGeometry(w, h, Math.max(1, Math.round(w / 4)), 1);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * w / HEX_TILE);
  p.updateMatrix();
  geo.applyMatrix4(p.matrix);
  root.add(new THREE.Mesh(paintByZ(geo), hexMat));
}

/** A glowing bar from z0 to z1 along a side wall, colored by team half. */
function neonBar(root, x, y, z0, z1, thick = .22){
  const g = new THREE.BoxGeometry(thick, thick, z1 - z0, 1, 1, Math.ceil((z1 - z0) / 4)).translate(x, y, (z0 + z1) / 2);
  root.add(new THREE.Mesh(paintByZ(g, true), neonFade));
}

function buildWalls(root){
  for (const sx of [-1, 1]){
    const x = sx * HALF_W;
    glass(root, HALF_L * 2, WALL_H, x, WALL_H / 2, 0, Math.PI / 2);
    mk(BOX(.6, 1.2, HALF_L * 2), kickMat, sx * (HALF_W + .3), .6, 0, root, false);
    mk(BOX(.5, .5, HALF_L * 2), frameMat, sx * (HALF_W + .25), WALL_H, 0, root, false);
    neonBar(root, sx * (HALF_W + .05), WALL_H + .3, -HALF_L, HALF_L);
    neonBar(root, sx * (HALF_W + .05), 1.25, -HALF_L, HALF_L, .12);
    for (let z = -HALF_L + 12; z < HALF_L; z += 12) mk(BOX(.28, WALL_H, .28), frameMat, sx * (HALF_W + .16), WALL_H / 2, z, root, false);
  }
  const segW = HALF_W - GOAL_HW, segX = GOAL_HW + segW / 2;
  for (const sz of [-1, 1]){
    const z = sz * HALF_L, team = sz < 0 ? neon.orange : neon.blue;
    for (const sx of [-1, 1]){
      glass(root, segW, WALL_H, sx * segX, WALL_H / 2, z);
      mk(BOX(segW, 1.2, .6), kickMat, sx * segX, .6, sz * (HALF_L + .3), root, false);
      mk(BOX(.28, WALL_H, .28), frameMat, sx * (GOAL_HW + segW / 2), WALL_H / 2, sz * (HALF_L + .16), root, false);
      mk(BOX(segW, .12, .12), team, sx * segX, 1.25, sz * (HALF_L + .05), root, false);
    }
    glass(root, GOAL_HW * 2, WALL_H - GOAL_H, 0, GOAL_H + (WALL_H - GOAL_H) / 2, z);
    mk(BOX(HALF_W * 2 + .5, .5, .5), frameMat, 0, WALL_H, sz * (HALF_L + .25), root, false);
    mk(BOX(HALF_W * 2, .22, .22), team, 0, WALL_H + .3, sz * (HALF_L + .05), root, false);
    // corner pillars with a glowing edge
    for (const sx of [-1, 1]){
      mk(BOX(.9, WALL_H + .6, .9), frameMat, sx * (HALF_W + .5), (WALL_H + .6) / 2, sz * (HALF_L + .5), root, false);
      mk(BOX(.18, WALL_H + .6, .18), team, sx * (HALF_W + .02), (WALL_H + .6) / 2, sz * (HALF_L + .02), root, false);
    }
  }
}

/* ---------- goals ---------- */
const postMat = std(0xf4f7fb, { roughness: .3, metalness: .2 });
const netTex = netTexture();

/** A plane whose net cells are about `cell` metres wide. */
function netPlane(w, h, mat, cell = .55){
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / cell, uv.getY(i) * h / cell);
  return new THREE.Mesh(geo, mat);
}

function buildGoal(root, sz, color){
  const z = sz * HALF_L, neonMat = neonOf(color, 1.7);
  const c = new THREE.Color(color).lerp(WHITE, .35);
  const netMat = basic(c, { map: netTex, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false, alphaTest: .05 });

  // posts and crossbar, with a neon frame just inside
  for (const sx of [-1, 1]){
    mk(CYL(.35, .35, GOAL_H, 16), postMat, sx * GOAL_HW, GOAL_H / 2, z, root);
    mk(BOX(.14, GOAL_H, .14), neonMat, sx * (GOAL_HW - .3), GOAL_H / 2, z + sz * .25, root, false);
  }
  const bar = mk(CYL(.35, .35, GOAL_HW * 2 + .7, 16), postMat, 0, GOAL_H, z, root);
  bar.rotation.z = Math.PI / 2;
  mk(BOX(GOAL_HW * 2 - .6, .14, .14), neonMat, 0, GOAL_H - .3, z + sz * .25, root, false);

  // the net: back, sides and roof
  const back = netPlane(GOAL_HW * 2, GOAL_H, netMat);
  back.position.set(0, GOAL_H / 2, z + sz * GOAL_D);
  root.add(back);
  for (const sx of [-1, 1]){
    const side = netPlane(GOAL_D, GOAL_H, netMat);
    side.rotation.y = Math.PI / 2;
    side.position.set(sx * GOAL_HW, GOAL_H / 2, z + sz * GOAL_D / 2);
    root.add(side);
    mk(CYL(.12, .12, GOAL_D, 8), postMat, sx * GOAL_HW, GOAL_H, z + sz * GOAL_D / 2, root, false).rotation.x = Math.PI / 2;
    mk(CYL(.12, .12, GOAL_H, 8), postMat, sx * GOAL_HW, GOAL_H / 2, z + sz * GOAL_D, root, false);
  }
  const roof = netPlane(GOAL_HW * 2, GOAL_D, netMat);
  roof.rotation.x = Math.PI / 2;
  roof.position.set(0, GOAL_H, z + sz * GOAL_D / 2);
  root.add(roof);

  // glowing floor and back wall inside the goal
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HW * 2, GOAL_D), basic(color, { transparent: true, opacity: .22, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, .02, z + sz * GOAL_D / 2);
  root.add(floor);
  const wallW = GOAL_HW * 2 + 6, wallH = GOAL_H + 5;
  mk(BOX(wallW, wallH, .6), matte(0x0b1220), 0, wallH / 2, z + sz * (GOAL_D + .6), root, false);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH), glow(0xffffff, 1.3, { map: goalBackTexture(color) }));
  grid.position.set(0, wallH / 2, z + sz * (GOAL_D + .28));
  grid.rotation.y = sz < 0 ? 0 : Math.PI;
  root.add(grid);
  mk(BOX(wallW, .5, .7), neonMat, 0, wallH, z + sz * (GOAL_D + .6), root, false);
}

/* ---------- stands ---------- */
function buildBowl(root){
  const stepA = matte(0x1d283b), stepB = matte(0x233048);
  for (let i = 0; i < TIERS; i++){
    const m = new THREE.Mesh(ringGeo(inner(i), inner(i + 1), 0, top(i)), i % 2 ? stepB : stepA);
    m.receiveShadow = true;
    root.add(m);
  }
  // white edge on every step, so the tiers read from far away
  const edgeMat = matte(0x5d6a82);
  for (let i = 0; i < TIERS; i++) root.add(new THREE.Mesh(ringGeo(grow(inner(i), -.06), grow(inner(i), .25), top(i), top(i) + .06, 10), edgeMat));

  // club level: glowing lines above and below a ring of LED screens with the rules
  const club = inner(CLUB), y0 = top(CLUB - 1), y1 = top(CLUB);
  for (const y of [y0 + .35, y1 - .45]) root.add(new THREE.Mesh(paintByZ(ringGeo(grow(club, -.16), club, y, y + .22), true), neonFade));
  const ledH = 2.2, ledY = (y0 + .57 + y1 - .45) / 2;
  const sideLen = 2 * (club.hz - club.r), endLen = 2 * (club.hx - club.r);
  for (const sx of [-1, 1]){
    const b = ledBoard(sideLen, ledH);
    b.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    b.position.set(sx * (club.hx - .1), ledY, 0);
    root.add(b);
  }
  for (const sz of [-1, 1]){
    const b = ledBoard(endLen, ledH);
    b.rotation.y = sz < 0 ? 0 : Math.PI;
    b.position.set(0, ledY, sz * (club.hz - .1));
    root.add(b);
  }

  // back wall with a band of lit suites under the roof
  root.add(new THREE.Mesh(ringGeo(OUT, grow(OUT, 1.5), 0, ROOF_Y), stepA));
  const suites = windowTexture({ cols: 8, rows: 2, lit: .8 });
  const bandY0 = top(TIERS - 1) + 1.2, bandH = ROOF_Y - 1 - bandY0;
  suites.repeat.set(1 / 24, 1 / bandH);
  root.add(new THREE.Mesh(ringGeo(grow(OUT, -.05), grow(OUT, .02), bandY0, bandY0 + bandH, 16), glow(0xffffff, 1.25, { map: suites })));
}

/* the crowd: one place per metre on every tier, 80% with a fan and the rest an empty seat
   (a seat behind a fan can't be seen, so it isn't drawn). Seats, bodies and heads are three
   instanced meshes (3 draw calls for thousands of people). */
const SHIRTS = [0xffffff, 0xffd23f, 0x3ee08f, 0xff3b4f, 0x1d232c, 0xbfc8d6].map(h => new THREE.Color(h));
const SKIN = [0xf1c7a5, 0xd9a07a, 0xa86f4c, 0x6e4630, 0xf6d8bf].map(h => new THREE.Color(h));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

function setFan(bodies, heads, i, f, lift){
  _q.setFromAxisAngle(UP, f.rot);
  _s.set(f.w, f.h, f.w);
  bodies.setMatrixAt(i, _m.compose(_p.set(f.x, f.y + f.h * .55 + lift, f.z), _q, _s));
  _s.set(1, 1, 1);
  heads.setMatrixAt(i, _m.compose(_p.set(f.x, f.y + f.h * 1.1 + .2 + lift, f.z), _q, _s));
}

function buildCrowd(root){
  const seatSpots = [], fans = [];
  for (let i = 0; i < TIERS; i++){
    for (const p of along(grow(inner(i), 1.35), .95)){
      if (p.s % 15 < 1.3) continue;                 // aisles between sections
      const rot = Math.atan2(-p.nx, -p.nz);
      if (Math.random() >= .8){ seatSpots.push({ x: p.x, y: top(i), z: p.z, rot }); continue; }   // empty seat
      {
        fans.push({
          x: p.x - p.nx * .25 + rnd(-.08, .08), y: top(i), z: p.z - p.nz * .25, rot: rot + rnd(-.3, .3),
          h: rnd(.85, 1.05), w: rnd(.9, 1.1), phase: rnd(6.28)
        });
      }
    }
  }

  const lambert = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const color = new THREE.Color();

  const seatGeo = new THREE.BoxGeometry(.66, .12, .5).translate(0, .45, 0);
  const seatBack = new THREE.BoxGeometry(.66, .55, .1).translate(0, .72, -.26);   // behind: +z faces the field
  const seatMerged = new THREE.BufferGeometry();
  // join pan and back by hand (both are plain boxes)
  const joined = [seatGeo, seatBack].map(g => g.toNonIndexed());
  for (const name of ['position', 'normal', 'uv']){
    const size = joined[0].attributes[name].itemSize;
    const arr = new Float32Array(joined.reduce((n, g) => n + g.attributes[name].array.length, 0));
    let o = 0;
    for (const g of joined){ arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    seatMerged.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  const seats = new THREE.InstancedMesh(seatMerged, lambert, seatSpots.length);
  seatSpots.forEach((s, i) => {
    _q.setFromAxisAngle(UP, s.rot);
    seats.setMatrixAt(i, _m.compose(_p.set(s.x, s.y, s.z), _q, _s.set(1, 1, 1)));
    teamColorAt(s.z, color).multiplyScalar(.55);
    seats.setColorAt(i, color);
  });

  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, 1, .32), lambert, fans.length);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(.32, .34, .32), lambert, fans.length);
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fans.forEach((f, i) => {
    setFan(bodies, heads, i, f, 0);
    if (Math.random() < .55) teamColorAt(f.z * 3, color);   // most fans wear their team's color
    else color.copy(pick(SHIRTS));
    bodies.setColorAt(i, color.multiplyScalar(rnd(.7, 1)));
    heads.setColorAt(i, pick(SKIN));
  });
  for (const m of [seats, bodies, heads]){ m.frustumCulled = false; root.add(m); }
  return { fans, bodies, heads, moving: false };
}

/* ---------- roof ring with a line of lights under its edge ---------- */
function buildRoof(root){
  const roofIn = inner(5.5);
  const roofMat = matte(0x1a2232);
  root.add(new THREE.Mesh(ringGeo(roofIn, grow(OUT, 2), ROOF_Y, ROOF_Y + 1.2), roofMat));
  root.add(new THREE.Mesh(ringGeo(roofIn, grow(roofIn, .7), ROOF_Y - .3, ROOF_Y), glow(0xfff1d6, 3.5)));
  root.add(new THREE.Mesh(ringGeo(grow(roofIn, -.3), roofIn, ROOF_Y + .2, ROOF_Y + 1.6), frameMat));
  // trusses on top of the roof
  for (const p of along(grow(roofIn, (OUT.hx - roofIn.hx) / 2 + 1), 9)){
    const t = mk(BOX(.3, .9, OUT.hx - roofIn.hx + 2), frameMat, p.x, ROOF_Y + 1.6, p.z, root, false);
    t.rotation.y = Math.atan2(p.nx, p.nz);
  }
}

/* ---------- light towers at the four corners ----------
   Each tower has a panel of lamps with a flare and a soft beam of light in the air. The light on the
   field is the key light in renderer.js (from one tower, with shadows) plus one fill light from the
   opposite tower: two lights instead of four spot lights, so every pixel computes fewer lights. */
const beamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  uniforms: { uColor: { value: new THREE.Color(0xfff1d0) }, uStrength: { value: .07 } },
  vertexShader: /* glsl */`
    varying float vAlong;
    varying float vFacing;
    varying float vDist;
    void main(){
      vAlong = uv.y;                                   // 1 at the lamp, 0 at the far end
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      vFacing = abs(dot(n, normalize(-mv.xyz)));       // soft edges: the sides of the cone fade out
      vDist = length(mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor;
    uniform float uStrength;
    varying float vAlong;
    varying float vFacing;
    varying float vDist;
    void main(){
      // clamp first: pow() of a tiny negative number gives NaN, and the bloom would spread it
      float a = pow(clamp(vAlong, 0.0, 1.0), 2.2) * pow(clamp(vFacing, 0.0, 1.0), 1.5) * uStrength;
      // the camera is often inside a beam: the part near the camera fades out, or it looks like a dirty lens
      a *= smoothstep(30.0, 75.0, vDist);
      gl_FragColor = vec4(uColor * a, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});

const flareMat = new THREE.SpriteMaterial({
  map: glowTexture('rgba(255,255,255,1)', 'rgba(255,236,200,.25)'), color: new THREE.Color(0xfff1dc).multiplyScalar(1.6),
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
});

function buildTowers(root){
  const lampMat = glow(0xfff8e6, 4);
  const beamGeo = new THREE.ConeGeometry(20, 100, 32, 1, true).translate(0, -50, 0).rotateX(-Math.PI / 2);
  const X = OUT.hx - 4, Z = OUT.hz - 2, H = 56;
  for (const [x, z] of [[-X, -Z], [X, -Z], [-X, Z], [X, Z]]){
    mk(CYL(.7, 1.4, H, 10), frameMat, x, H / 2, z, root, false);
    for (let y = 8; y < H - 4; y += 8){                 // rings on the mast
      mk(CYL(1.1, 1.1, .35, 10), frameMat, x, y, z, root, false);
    }
    const head = new THREE.Group();
    head.position.set(x, H + 2, z);
    root.add(head);
    head.lookAt(0, 0, 0);
    mk(BOX(12, 6, 1), frameMat, 0, 0, 0, head, false);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) mk(BOX(1.7, 1.4, .3), lampMat, (c - 2) * 2.2, (r - 1) * 1.8, .6, head, false);
    const flare = new THREE.Sprite(flareMat);
    flare.position.set(0, 0, 2.5);
    flare.scale.setScalar(16);
    head.add(flare);

    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(x, H + 2, z);
    beam.lookAt(x * .2, 0, z * .2);
    root.add(beam);
  }
  const fill = new THREE.DirectionalLight(0xffeedd, 1.1);
  fill.position.set(-X, H, -Z);
  root.add(fill);
}

/* ---------- team colored light near each goal ---------- */
function buildTeamLights(root){
  for (const [sz, color] of [[-1, TEAM.orange.color], [1, TEAM.blue.color]]){
    const l = new THREE.PointLight(color, 260, 60, 2);
    l.position.set(0, 7, sz * (HALF_L + 3));
    root.add(l);
  }
}
