// Helpers to build meshes, the materials shared by every model, and a geometry merger
// that joins static meshes with the same material (fewer draw calls = faster).
import * as THREE from '../core/three.js';

export const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const CYL = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const std = (color, opts) => new THREE.MeshStandardMaterial({ color, roughness: .5, ...opts });
export const basic = (color, opts) => new THREE.MeshBasicMaterial({ color, ...opts });
/** Cheap lit material (no shiny reflections) for big rough surfaces: grass, concrete, stands. */
export const matte = (color, opts) => new THREE.MeshLambertMaterial({ color, ...opts });
/** A light-emitting material brighter than white (k > 1), so the HDR bloom makes it glow. */
export const glow = (color, k = 2.2, opts) => basic(new THREE.Color(color).multiplyScalar(k), opts);
/** How bright a (linear) color looks: blue looks much darker than orange at the same value. */
export const luminance = c => .2126 * c.r + .7152 * c.g + .0722 * c.b;
/** A neon light of any color with the same brightness `lum`, so blue glows as much as orange. */
export const neon = (color, lum = 1.6, opts) => {
  const c = new THREE.Color(color);
  return basic(c.multiplyScalar(lum / Math.max(.05, luminance(c))), opts);
};

/** Creates a mesh at (x, y, z) and adds it to `parent`. */
export function mk(geo, mat, x = 0, y = 0, z = 0, parent = null, shadow = true){
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  if (parent) parent.add(m);
  return m;
}

export const M = {
  tire: std(0x15181d, { roughness: .9 }),
  rim: std(0xc9d3de, { metalness: .6, roughness: .35 }),
  glass: std(0x10263d, { metalness: .4, roughness: .15, emissive: 0x06121f }),
  dark: std(0x1d232c, { roughness: .7 }),
  carbon: std(0x101317, { roughness: .35, metalness: .3 }),
  chrome: std(0xdde6ee, { metalness: .65, roughness: .25 }),
  white: std(0xf2f5f8),
  yellow: std(0xffcf2e, { roughness: .45, metalness: .2 }),
  mud: std(0x6b4a2b, { roughness: 1 }),
  spike: std(0xb9c0c7, { metalness: .6, roughness: .3 }),
  headlight: glow(0xfff6cc, 3),
  taillight: glow(0xff2a3a, 1.6),
  visor: glow(0x5ff2ff, 1.8),
  radio: glow(0x3ee08f, 1.8),
  neon: glow(0x9ffcff, 2),
  glow: glow(0x00e5ff, 1.6, { transparent: true, opacity: .5, depthWrite: false }),
  flame: glow(0xffa040, 2.2, { transparent: true, opacity: .9 }),
  flameCore: glow(0xfff6c8, 3)
};

const ATTRS = ['position', 'normal', 'uv'];

/** Joins several geometries into one. Returns null if they are not compatible.
 *  Vertex colors are kept when every geometry has them. */
export function mergeGeometries(geos){
  if (!geos.every(g => ATTRS.every(n => g.attributes[n]))) return null;
  const attrs = geos.every(g => g.attributes.color) ? [...ATTRS, 'color'] : ATTRS;
  const indexed = geos.every(g => g.index);
  const list = indexed ? geos : geos.map(g => g.index ? g.toNonIndexed() : g);
  let vertices = 0, indices = 0;
  for (const g of list){
    vertices += g.attributes.position.count;
    if (indexed) indices += g.index.count;
  }
  const out = new THREE.BufferGeometry();
  for (const name of attrs){
    const size = list[0].attributes[name].itemSize;
    const data = new Float32Array(vertices * size);
    let offset = 0;
    for (const g of list){
      const src = g.attributes[name];
      for (let i = 0; i < src.count; i++) for (let c = 0; c < size; c++) data[offset++] = src.getComponent ? src.getComponent(i, c) : src.array[i * size + c];
    }
    out.setAttribute(name, new THREE.BufferAttribute(data, size));
  }
  if (indexed){
    const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
    let offset = 0, base = 0;
    for (const g of list){
      const src = g.index.array;
      for (let i = 0; i < src.length; i++) index[offset + i] = src[i] + base;
      offset += src.length;
      base += g.attributes.position.count;
    }
    out.setIndex(new THREE.BufferAttribute(index, 1));
  }
  out.computeBoundingSphere();
  return out;
}

/** In every group under `root`, merges the direct child meshes that share a material.
 *  Meshes with userData.keep (animated on their own) are left alone. */
export function mergeStatic(root){
  const groups = [];
  root.traverse(o => { if (!o.isMesh && !o.isPoints && !o.isLine) groups.push(o); });
  for (const group of groups){
    const buckets = new Map();
    for (const child of group.children){
      if (!child.isMesh || child.isInstancedMesh || child.userData.keep || child.children.length) continue;
      const key = child.material.uuid;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(child);
    }
    for (const list of buckets.values()){
      if (list.length < 2) continue;
      const geos = list.map(m => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); });
      const merged = mergeGeometries(geos);
      geos.forEach(g => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, list[0].material);
      mesh.castShadow = list.some(m => m.castShadow);
      mesh.receiveShadow = list.some(m => m.receiveShadow);
      list.forEach(m => group.remove(m));
      group.add(mesh);
    }
  }
}
