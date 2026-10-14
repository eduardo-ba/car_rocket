// Stadium screens: scrolling LED boards with the 5 rules, and two jumbotrons with the live score.
import * as THREE from '../core/three.js';
import { mk, BOX, CYL, M, glow, neon } from '../engine/kit.js';
import { HALF_W, HALF_L, GOAL_HW } from '../config.js';
import { RULES } from '../data/rules.js';

const DISPLAY_FONT = 'Bungee, "Arial Black", Impact, sans-serif';
const UI_FONT = '"Chakra Petch", "Segoe UI", sans-serif';

/* ---------- LED boards ----------
   One texture for every board, so all boards share one material and merge into one mesh.
   The texture repeats along the board through the UVs, and scrolling moves its offset. */
const LED_UNITS = 70;   // metres of board covered by one copy of the text
const ledCanvas = document.createElement('canvas');
ledCanvas.width = 4096; ledCanvas.height = 64;
const ledTex = new THREE.CanvasTexture(ledCanvas);
ledTex.colorSpace = THREE.SRGBColorSpace;
ledTex.wrapS = THREE.RepeatWrapping;
const ledMat = glow(0xffffff, 1.5, { map: ledTex });
const STAR = '   ★   ';
const LED_TEXT = ['CAR ROCKET', ...RULES.map(r => `RULE ${r.n}: ${r.short.toUpperCase()}`)].join(STAR) + STAR;

function drawLed(){
  const g = ledCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#070b12';
  g.fillRect(0, 0, 4096, 64);
  g.font = '40px ' + DISPLAY_FONT;
  const w = g.measureText(LED_TEXT).width || 4096;
  g.setTransform(4096 / w, 0, 0, 1, 0, 0);       // squeeze the text to fit exactly one texture width
  g.fillStyle = '#ffb21f';
  g.textBaseline = 'middle';
  g.fillText(LED_TEXT, 0, 35);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = 'rgba(0,0,0,.4)';                  // LED dot grid
  for (let x = 0; x < 4096; x += 4) g.fillRect(x, 0, 1, 64);
  for (let y = 0; y < 64; y += 4) g.fillRect(0, y, 4096, 1);
  ledTex.needsUpdate = true;
}

/** A strip of LED board. Taller boards show bigger text (the text keeps its shape). */
export function ledBoard(width, height = 1.1){
  const geo = new THREE.PlaneGeometry(width, height);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * width / (LED_UNITS * height / 1.1));
  return new THREE.Mesh(geo, ledMat);
}

/* ---------- jumbotrons ---------- */
const screenCanvas = document.createElement('canvas');
screenCanvas.width = 512; screenCanvas.height = 192;
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
const screenMat = glow(0xffffff, 1.4, { map: screenTex });
let screenKey = '';
let lastScore = [0, 0, '3:00'];

/** Redraws the jumbotron only when the score or the clock text changes. */
export function drawScoreboard(blue, orange, clock){
  const key = blue + '|' + orange + '|' + clock;
  if (key === screenKey) return;
  screenKey = key;
  lastScore = [blue, orange, clock];
  const g = screenCanvas.getContext('2d');
  g.fillStyle = '#04080f'; g.fillRect(0, 0, 512, 192);
  g.fillStyle = '#2f8cff'; g.fillRect(12, 12, 160, 136);
  g.fillStyle = '#ff8a1f'; g.fillRect(340, 12, 160, 136);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff';
  g.font = '80px ' + DISPLAY_FONT;
  g.fillText(String(blue), 92, 74);
  g.fillText(String(orange), 420, 74);
  g.font = '40px ' + DISPLAY_FONT;
  g.fillText(clock, 256, 74);
  g.font = '700 20px ' + UI_FONT;
  g.fillText('BLUE', 92, 130);
  g.fillText('ORANGE', 420, 130);
  g.fillStyle = '#ffd23f'; g.font = '22px ' + DISPLAY_FONT;
  g.fillText('CAR ROCKET', 256, 174);
  g.fillStyle = 'rgba(0,0,0,.3)';
  for (let x = 0; x < 512; x += 3) g.fillRect(x, 0, 1, 192);
  screenTex.needsUpdate = true;
}

/** LED boards at the foot of the walls, and the two jumbotrons hanging from the roof behind the goals. */
export function buildBoards(parent, { roofY, screenZ }){
  for (const sx of [-1, 1]){
    const b = ledBoard(HALF_L * 2);
    b.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    b.position.set(sx * (HALF_W - .02), .6, 0);
    parent.add(b);
  }
  const segW = HALF_W - GOAL_HW, segX = GOAL_HW + segW / 2;
  for (const sz of [-1, 1]) for (const sx of [-1, 1]){
    const b = ledBoard(segW);
    b.rotation.y = sz < 0 ? 0 : Math.PI;
    b.position.set(sx * segX, .6, sz * (HALF_L - .02));
    parent.add(b);
  }
  const W = 28, H = 10.5, y = roofY - 2.5 - H / 2;
  for (const sz of [-1, 1]){
    const z = sz * screenZ, edge = neon(sz < 0 ? 0xff8a1f : 0x2f8cff, 1.5);
    mk(BOX(W + 1.6, H + 1.6, 1.4), M.dark, 0, y, z + sz * .75, parent, false);
    mk(BOX(W + 1.8, .3, .3), edge, 0, y + H / 2 + .8, z - sz * .05, parent, false);
    mk(BOX(W + 1.8, .3, .3), edge, 0, y - H / 2 - .8, z - sz * .05, parent, false);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), screenMat);
    screen.position.set(0, y, z);
    screen.rotation.y = sz < 0 ? 0 : Math.PI;
    parent.add(screen);
    for (const x of [-10, 10]) mk(CYL(.12, .12, roofY - y - H / 2, 6), M.dark, x, (roofY + y + H / 2) / 2, z + sz * .75, parent, false);
  }
}

export function updateBoards(dt){
  ledTex.offset.x = (ledTex.offset.x + dt * .025) % 1;
}

/** Call when the web fonts arrive, so the screens use them. */
export function redrawBoards(){
  drawLed();
  screenKey = '';
  drawScoreboard(...lastScore);
}

drawLed();
drawScoreboard(0, 0, '3:00');
