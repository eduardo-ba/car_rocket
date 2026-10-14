// The night sky (gradient, stars, moon and clouds drawn by a shader) and the city skyline
// around the stadium. Both hide while the camera is underwater (see water.js).
import * as THREE from '../core/three.js';
import { scene, SKY } from '../engine/renderer.js';
import { mergeGeometries } from '../engine/kit.js';
import { rnd } from '../core/math.js';
import { windowTexture } from './textures.js';

export const skyGroup = new THREE.Group();
skyGroup.name = 'sky';

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    uTime: { value: 0 },
    uTop: { value: new THREE.Color(0x02050d) },
    uHorizon: { value: SKY.clone() },
    uGlow: { value: new THREE.Color(0x4a2f6e) },
    uCity: { value: new THREE.Color(0xff9a4a) }
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main(){
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime;
    uniform vec3 uTop, uHorizon, uGlow, uCity;
    varying vec3 vDir;
    float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
      return v;
    }
    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.6, h));
      col += uGlow * pow(1.0 - clamp(abs(h), 0.0, 1.0), 6.0) * 0.55;       // haze at the horizon
      col += uCity * pow(1.0 - clamp(h, 0.0, 1.0), 28.0) * 0.18;            // city lights from below

      // stars (fewer near the horizon), twinkling
      vec3 p = d * 260.0, cell = floor(p);
      float r = hash(cell);
      if (r > 0.982){
        vec3 c = cell + 0.5 + (vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 4.1)) - 0.5) * 0.7;
        float s = smoothstep(0.16, 0.0, length(p - c));
        s *= 0.55 + 0.45 * sin(uTime * (1.5 + r * 4.0) + r * 90.0);
        col += vec3(0.85, 0.9, 1.0) * s * smoothstep(0.04, 0.3, h) * (r > 0.996 ? 1.6 : 0.8);
      }

      // moon with a soft halo
      vec3 m = normalize(vec3(-0.55, 0.42, -0.72));
      float md = dot(d, m);
      col += vec3(1.0, 0.96, 0.85) * smoothstep(0.99935, 0.99965, md);
      col += vec3(0.55, 0.6, 0.8) * pow(max(md, 0.0), 300.0) * 0.35;

      // thin clouds drifting, lit a little by the city
      if (h > 0.0){
        vec2 uv = d.xz / (h + 0.25) * 2.2 + vec2(uTime * 0.01, 0.0);
        float cl = smoothstep(0.5, 0.85, fbm(uv));
        col = mix(col, uHorizon * 1.6 + uGlow * 0.25, cl * 0.45 * smoothstep(0.0, 0.25, h));
      }

      // below the horizon: dark ground
      col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.08, h));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});

const dome = new THREE.Mesh(new THREE.SphereGeometry(520, 48, 24), skyMat);
dome.renderOrder = 10;   // drawn after the stadium, so only the pixels where the sky shows run its shader
dome.frustumCulled = false;
skyGroup.add(dome);

/* ---------- city skyline: a ring of towers with lit windows, all in one mesh ---------- */
function buildCity(){
  const geos = [], beacons = [];
  const box = new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  for (let ring = 0; ring < 2; ring++){
    const radius = ring ? 360 : 280, count = ring ? 70 : 54;
    for (let i = 0; i < count; i++){
      const a = (i + rnd(-.3, .3)) / count * Math.PI * 2;
      const w = rnd(12, 26), d = rnd(12, 24);
      const h = ring ? rnd(24, 70) : rnd(10, 40) * (Math.random() < .12 ? 1.9 : 1);
      const r = radius + rnd(-12, 12);
      p.set(Math.sin(a) * r, h / 2 - 1, Math.cos(a) * r);
      q.setFromAxisAngle(UP, a + rnd(-.2, .2));
      s.set(w, h, d);
      const g = box.clone().applyMatrix4(m.compose(p, q, s));
      // windows: one texture tile every 8 m wide and 16 m high; the roofs read the dark corner
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++){
        const face = (k / 4) | 0, along = face < 2 ? d : w;
        if (face === 2 || face === 3) uv.setXY(k, .01, .01);
        else uv.setXY(k, uv.getX(k) * along / 8, uv.getY(k) * h / 16);
      }
      geos.push(g);
      if (h > 50) beacons.push([p.x, h, p.z]);
    }
  }
  const tex = windowTexture({ lit: .3 });
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x58637c, fog: false });
  const city = new THREE.Mesh(mergeGeometries(geos), mat);
  city.renderOrder = 9;   // after the stadium, which hides most of it
  geos.forEach(g => g.dispose());
  skyGroup.add(city);

  // red lights on top of the tallest towers
  const lightGeos = beacons.map(([x, y, z]) => new THREE.BoxGeometry(1.2, 1.2, 1.2).translate(x, y + .6, z));
  if (lightGeos.length){
    const lights = new THREE.Mesh(mergeGeometries(lightGeos), new THREE.MeshBasicMaterial({ color: 0xff3040, fog: false }));
    lightGeos.forEach(g => g.dispose());
    skyGroup.add(lights);
    skyGroup.userData.beacons = lights;
  }
}

buildCity();
scene.add(skyGroup);

let time = 0;
export function updateSky(dt){
  time += dt;
  skyMat.uniforms.uTime.value = time;
  const b = skyGroup.userData.beacons;
  if (b) b.visible = (time % 2) < 1.2;
}
