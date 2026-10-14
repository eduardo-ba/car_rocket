// Textures for the stadium, drawn on canvases when the game starts (no image files to download).
import * as THREE from '../core/three.js';
import { renderer } from '../engine/renderer.js';
import { rnd } from '../core/math.js';

/** Makes a canvas, lets `draw(g, w, h)` paint it and returns it as a texture. */
export function canvasTexture(w, h, draw, { repeat = false, aniso = true } = {}){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (aniso) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/* ---------- the pitch ----------
   Mowed stripes along the length, a checker of lighter cuts across, team colors near each goal
   and the field lines with a soft glow. 1024 x 1536 = 12.8 px per metre. */
export function fieldTexture(){
  return canvasTexture(1024, 1536, (g, W, H) => {
    const S = W / 80;                                 // px per metre
    for (let i = 0; i < 12; i++){ g.fillStyle = i % 2 ? '#1f6e35' : '#27813f'; g.fillRect(0, i * H / 12, W, H / 12); }
    g.globalAlpha = .06;                              // cross cut
    for (let i = 0; i < 8; i++) if (i % 2){ g.fillStyle = '#d8ffd0'; g.fillRect(i * W / 8, 0, W / 8, H); }
    g.globalAlpha = 1;

    // patches of lighter and darker grass
    for (let i = 0; i < 260; i++){
      const x = rnd(W), y = rnd(H), r = rnd(20, 70);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const dark = Math.random() < .5;
      gr.addColorStop(0, dark ? 'rgba(0,30,10,.10)' : 'rgba(190,255,150,.06)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // team colors near the goals (orange goal at the top of the canvas, blue at the bottom)
    let gr = g.createLinearGradient(0, 0, 0, 22 * S);
    gr.addColorStop(0, 'rgba(255,128,20,.38)'); gr.addColorStop(1, 'rgba(255,128,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, 22 * S);
    gr = g.createLinearGradient(0, H, 0, H - 22 * S);
    gr.addColorStop(0, 'rgba(40,130,255,.38)'); gr.addColorStop(1, 'rgba(40,130,255,0)');
    g.fillStyle = gr; g.fillRect(0, H - 22 * S, W, 22 * S);

    // a big faint emblem in the middle
    g.save();
    g.translate(W / 2, H / 2);
    g.fillStyle = 'rgba(255,255,255,.05)';
    g.beginPath();
    for (let k = 0; k < 6; k++){ const a = k * Math.PI / 3 + Math.PI / 6; g.lineTo(Math.cos(a) * 15 * S, Math.sin(a) * 15 * S); }
    g.closePath(); g.fill();
    g.restore();

    // lines (twice: a wide soft glow, then the sharp line)
    const lines = (width, color, blur) => {
      g.strokeStyle = color; g.lineWidth = width; g.shadowColor = color; g.shadowBlur = blur;
      const m = .7 * S;
      g.strokeRect(m, m, W - 2 * m, H - 2 * m);
      g.beginPath(); g.moveTo(m, H / 2); g.lineTo(W - m, H / 2); g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, 10 * S, 0, Math.PI * 2); g.stroke();
      for (const [y, dir] of [[m, 1], [H - m, -1]]){
        g.strokeRect(W / 2 - 20 * S, Math.min(y, y + dir * 16 * S), 40 * S, 16 * S);   // penalty box
        g.strokeRect(W / 2 - 11 * S, Math.min(y, y + dir * 6 * S), 22 * S, 6 * S);     // goal box
        g.beginPath();
        g.arc(W / 2, y + dir * 16 * S, 6 * S, dir > 0 ? 0 : Math.PI, dir > 0 ? Math.PI : Math.PI * 2);
        g.stroke();
      }
      for (const [x, y] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]){       // corner arcs
        g.beginPath(); g.arc(x, y, 2 * S, 0, Math.PI * 2); g.stroke();
      }
    };
    lines(10, 'rgba(255,255,255,.18)', 0);
    lines(5, 'rgba(255,255,255,.92)', 6);
    g.shadowBlur = 0;
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(W / 2, H / 2, 7, 0, Math.PI * 2); g.fill();
    for (const y of [11 * S, H - 11 * S]){ g.beginPath(); g.arc(W / 2, y, 5, 0, Math.PI * 2); g.fill(); }
  });
}

/* ---------- glass walls: a hexagon pattern that fades upwards (like the Rocket League arena) ----------
   White on transparent, so the vertex colors of each wall tint it with the team colors. */
export function hexTexture(){
  return canvasTexture(512, 256, (g, W, H) => {
    const w = W / 18, r = w / Math.sqrt(3);          // a whole number of hexagons, so it tiles
    for (let row = -1; row * r * 1.5 < H + r; row++){
      for (let col = -1; col * w < W + w; col++){
        const x = col * w + (row % 2 ? w / 2 : 0), y = row * r * 1.5;
        const fade = Math.min(1, Math.max(0, y / H)) ** 1.6;   // canvas top = top of the wall
        g.strokeStyle = `rgba(255,255,255,${.12 + fade * .75})`;
        g.lineWidth = 2;
        g.beginPath();
        for (let k = 0; k < 6; k++){ const a = k * Math.PI / 3 + Math.PI / 6; g.lineTo(x + Math.cos(a) * (r - 1.5), y + Math.sin(a) * (r - 1.5)); }
        g.closePath(); g.stroke();
        if (Math.random() < fade * .35){ g.fillStyle = `rgba(255,255,255,${fade * .25})`; g.fill(); }
      }
    }
    // a bright line at the very bottom (where the glass meets the floor)
    const gr = g.createLinearGradient(0, H, 0, H - 40);
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, H - 40, W, 40);
  }, { repeat: true });
}

/* ---------- goal net: diamond mesh ---------- */
export function netTexture(){
  return canvasTexture(128, 128, (g, W) => {
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(W, W);
    g.moveTo(W, 0); g.lineTo(0, W);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.lineWidth = 7;
    g.stroke();
  }, { repeat: true });
}

/* ---------- inside the goal: a dark wall with a glowing grid ---------- */
export function goalBackTexture(color){
  const c = '#' + new THREE.Color(color).getHexString();
  return canvasTexture(256, 128, (g, W, H) => {
    g.fillStyle = '#060b14'; g.fillRect(0, 0, W, H);
    g.strokeStyle = c; g.globalAlpha = .55; g.lineWidth = 2;
    for (let x = 0; x <= W; x += 16){ g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 16){ g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.globalAlpha = 1;
    const gr = g.createLinearGradient(0, H, 0, 0);
    gr.addColorStop(0, c); gr.addColorStop(.5, 'rgba(0,0,0,0)');
    g.globalAlpha = .6; g.fillStyle = gr; g.fillRect(0, 0, W, H);
  });
}

/* ---------- concrete floor around the field ---------- */
export function concreteTexture(){
  return canvasTexture(256, 256, (g, W, H) => {
    g.fillStyle = '#1a2230'; g.fillRect(0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4){ const n = rnd(-9, 9); d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);
    g.strokeStyle = 'rgba(255,255,255,.04)'; g.lineWidth = 1;
    g.strokeRect(3, 3, W - 6, H - 6);
  }, { repeat: true });
}

/* ---------- lit windows: the suites at the top of the stands and the city around ---------- */
export function windowTexture({ cols = 8, rows = 16, lit = .5, warm = true } = {}){
  return canvasTexture(256, 512, (g, W, H) => {
    g.fillStyle = '#05080e'; g.fillRect(0, 0, W, H);
    const cw = W / cols, rh = H / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++){
      if (x === 0 && y === rows - 1) continue;      // keep the corner dark: building roofs read it
      if (Math.random() > lit){ g.fillStyle = '#0b111c'; }
      else {
        const t = Math.random();
        g.fillStyle = warm
          ? (t < .6 ? '#ffd9a0' : t < .85 ? '#fff1d6' : '#9fd4ff')
          : (t < .5 ? '#9fd4ff' : '#e8f4ff');
        g.globalAlpha = rnd(.45, 1);
      }
      g.fillRect(x * cw + cw * .18, y * rh + rh * .22, cw * .64, rh * .56);
      g.globalAlpha = 1;
    }
  }, { repeat: true });
}

/* ---------- soft round glow (boost pads, lamps) ---------- */
export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,.35)'){
  return canvasTexture(128, 128, (g, W) => {
    const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    gr.addColorStop(0, inner); gr.addColorStop(.35, mid); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, W);
  }, { aniso: false });
}

/* ---------- boost pad ring: a glowing ring with notches ---------- */
export function padRingTexture(){
  return canvasTexture(256, 256, (g, W) => {
    const c = W / 2;
    g.translate(c, c);
    const gr = g.createRadialGradient(0, 0, c * .2, 0, 0, c);
    gr.addColorStop(0, 'rgba(255,190,40,.55)'); gr.addColorStop(.7, 'rgba(255,170,20,.15)'); gr.addColorStop(1, 'rgba(255,170,20,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, c, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd36b'; g.lineWidth = 9;
    for (let k = 0; k < 8; k++){
      g.beginPath(); g.arc(0, 0, c * .78, k * Math.PI / 4 + .1, (k + 1) * Math.PI / 4 - .1); g.stroke();
    }
    g.lineWidth = 4; g.strokeStyle = 'rgba(255,240,200,.9)';
    g.beginPath(); g.arc(0, 0, c * .55, 0, Math.PI * 2); g.stroke();
  }, { aniso: false });
}
