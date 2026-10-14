// Small math helpers used everywhere.
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
/** Smoothing factor that behaves the same at any frame rate. */
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
/** rnd(max) -> 0..max, rnd(min, max) -> min..max */
export const rnd = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const pick = list => list[(Math.random() * list.length) | 0];
export function wrapAngle(a){
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export const fmtClock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
