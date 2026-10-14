// Renderer, scene, camera and lights, plus the graphics quality settings.
// Colors are managed in linear space and shown in sRGB, with "neutral" tone mapping
// (it keeps the real colors of the cars and the field, and softens very bright lights).
// HIGH = shadows + HDR bloom glow + FXAA smooth edges. LOW = plain rendering at pixel ratio 1.
// Both scale the resolution down by themselves when the computer can't keep up (see adaptResolution).
import * as THREE from '../core/three.js';
import { prefs } from '../core/storage.js';
import { emit } from '../core/events.js';

export const app = document.getElementById('app');

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

export const SKY = new THREE.Color(0x0e1b30);   // also the fog and the sky at the horizon
export const SEA = new THREE.Color(0x0a4f80);
export const scene = new THREE.Scene();
scene.background = SKY.clone();
scene.fog = new THREE.Fog(SKY.getHex(), 140, 320);

export const camera = new THREE.PerspectiveCamera(68, 1, .1, 700);

/* ---------- lights ----------
   Image-based light from a small "stadium at night" scene (reflections on paint, glass and metal),
   a soft sky/ground fill, and one key light from a floodlight tower that casts the shadows.
   The other three towers are spot lights in stadium.js. */
scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x1a2a1e, .35));
export const sun = new THREE.DirectionalLight(0xfff2de, 2.3);
sun.position.set(48, 86, 64);
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 90, bottom: -90, near: 10, far: 260 });
sun.shadow.bias = -.0004;
sun.shadow.normalBias = .03;
scene.add(sun);

/** A tiny stadium (dark bowl, floodlight panels, roof lights, green pitch, team colors at the ends)
 *  baked once into an environment map. Every MeshStandardMaterial uses it for reflections. */
function stadiumEnvironment(){
  const env = new THREE.Scene();
  const light = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide });
  const room = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0b1424, side: THREE.BackSide }));
  env.add(room);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(40, 60), light(0x1f6b33, .5));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = -6;
  env.add(pitch);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){            // floodlights
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), light(0xfff1dc, 9));
    panel.position.set(x * 26, 24, z * 34);
    panel.lookAt(0, 0, 0);
    env.add(panel);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(38, .5, 6, 64), light(0xfff4e0, 3));  // roof lights
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 14;
  env.add(ring);
  for (const [z, hex] of [[-44, 0xff8a1f], [44, 0x2f8cff]]){              // team colors at the ends
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), light(hex, 1.4));
    wall.position.set(0, 2, z);
    wall.lookAt(0, 2, 0);
    env.add(wall);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, .02).texture;
  pmrem.dispose();
  env.traverse(o => { if (o.isMesh){ o.geometry.dispose(); o.material.dispose(); } });
  return tex;
}
scene.environment = stadiumEnvironment();
scene.environmentIntensity = .4;

/* ---------- glow (HDR bloom) ----------
   The scene renders to a half-float target. Only pixels brighter than white glow, so the lit
   field and the cars stay sharp while lamps, neon and screens shine. The bloom works at a quarter
   of the screen size (a glow is blurry anyway) and FXAA smooths the edges in one cheap pass. */
let composer = null, fxaa = null;
export const post = { bloom: null };
try {
  composer = new THREE.EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = post.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), .32, .12, 1);
  const bloomSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => bloomSize(Math.max(2, w / 2), Math.max(2, h / 2));
  composer.addPass(bloom);
  composer.addPass(new THREE.OutputPass());
  fxaa = new THREE.ShaderPass(THREE.FXAAShader);
  composer.addPass(fxaa);
} catch (e) { composer = null; }

export const view = {
  quality: prefs.get('gfx') === 'low' ? 'low' : 'high',
  baseFov: 68,
  scale: 1          // 1 = full resolution; lowered automatically on slow computers
};

/** Pixels drawn per screen pixel: never more than 1.25 (sharper than that costs a lot and is hard to see). */
const pixelRatio = () => (view.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 1.25) : 1) * view.scale;

export function resize(){
  const w = app.clientWidth || 1, h = app.clientHeight || 1;
  const pr = pixelRatio();
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  if (composer){
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    fxaa.material.uniforms.resolution.value.set(1 / Math.round(w * pr), 1 / Math.round(h * pr));
  }
  view.baseFov = w / h < 1 ? 82 : 68;
  camera.aspect = w / h;
  camera.fov = view.baseFov;
  camera.updateProjectionMatrix();
}

export function setQuality(q){
  view.quality = q === 'low' ? 'low' : 'high';
  view.scale = 1;
  recent.length = 0;
  slowChecks = 0;
  prefs.set('gfx', view.quality);
  sun.castShadow = view.quality === 'high';
  resize();
}

/* Dynamic resolution. rAF times come in whole screen refreshes (16.7 ms at 60 Hz, 20.8 ms at 48 Hz...),
   so "slow" means missing refreshes, not a fixed number of ms: we learn the monitor's refresh time
   from the fastest frames and count the frames that took clearly longer. If more than a quarter of
   the frames missed a refresh in two 2-second windows in a row, draw 10% fewer pixels per side
   (down to 70%). Changing size reallocates the buffers, so it happens rarely. If HIGH is still
   slow at 70%, suggest LOW once. */
const recent = [];
let refresh = 1 / 60, sinceCheck = 0, slowChecks = 0, warned = false;
export function adaptResolution(dt){
  if (dt <= 0 || dt > .25) return;               // a tab switch or a pause, not a slow frame
  recent.push(dt);
  if (recent.length > 120) recent.shift();
  sinceCheck += dt;
  if (sinceCheck < 2 || recent.length < 60) return;
  sinceCheck = 0;
  const sorted = [...recent].sort((a, b) => a - b);
  // the refresh time can only grow slowly, so a game that is always slow can't pass for a slow monitor
  refresh = Math.min(sorted[Math.floor(sorted.length * .2)], refresh * 1.05);
  const missed = recent.filter(t => t > refresh * 1.5).length / recent.length;
  slowChecks = missed < .25 ? 0 : slowChecks + 1;
  if (slowChecks < 2) return;                     // slow twice in a row (4 s), not just one hiccup
  slowChecks = 0;
  recent.length = 0;
  if (view.scale > .7){
    view.scale = Math.max(.7, view.scale - .1);
    resize();
  } else if (!warned && view.quality === 'high'){
    warned = true;
    emit('toast', 'The game is running slowly. Try GRAPHICS: LOW in the menu.', 'warn');
  }
}

export function render(){
  if (composer && view.quality === 'high') composer.render();
  else renderer.render(scene, camera);
}

/** Compiles every shader now (also of hidden things: the other car modes, explosions, water),
 *  so the game doesn't freeze for a moment the first time something appears. */
export function warmUp(){
  const hidden = [];
  scene.traverse(o => { if (!o.visible){ hidden.push(o); o.visible = true; } });
  const quality = view.quality;
  try {
    renderer.compile(scene, camera);
    for (const q of ['high', 'low']){ view.quality = q; render(); }   // both, so switching in the menu is instant
  } catch (e) { /* only a speed-up */ }
  view.quality = quality;
  for (const o of hidden) o.visible = false;
}

let resizeQueued = false;
window.addEventListener('resize', () => {            // at most one resize per frame while dragging the window
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => { resizeQueued = false; resize(); });
});
setQuality(view.quality);
