import * as THREE from 'three';
import {
  COFFEE_CUP_GEOMETRY as CUP, coffeeLiquidHeight, coffeeInnerRadius, coffeeLiquidRadius,
} from './coffee-pitch-geometry.js';

export const COFFEE_VISUAL_DIMENSIONS = Object.freeze({
  ...CUP,
  trayWidth: 0.61, trayDepth: 0.36, trayCupY: 0.0133,
  cupOuterRadius: 0.051, liquidCeiling: CUP.visualRim, maximumServed: 6,
});
const D = COFFEE_VISUAL_DIMENSIONS;
const CARRY = Object.freeze([[-0.115, D.trayCupY, 0, Math.PI], [0.115, D.trayCupY, 0, 0]]);
const SERVED = Object.freeze([
  [-0.11, 0, -0.25, Math.PI], [0.11, 0, -0.25, 0],
  [-0.11, 0, 0, Math.PI], [0.11, 0, 0, 0],
  [-0.11, 0, 0.25, Math.PI], [0.11, 0, 0.25, 0],
]);
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;

function roundedPath(width, depth, radius, Path = THREE.Shape) {
  const p = new Path(), x = width / 2, z = depth / 2;
  p.moveTo(-x + radius, -z); p.lineTo(x - radius, -z);
  p.quadraticCurveTo(x, -z, x, -z + radius); p.lineTo(x, z - radius);
  p.quadraticCurveTo(x, z, x - radius, z); p.lineTo(-x + radius, z);
  p.quadraticCurveTo(-x, z, -x, z - radius); p.lineTo(-x, -z + radius);
  p.quadraticCurveTo(-x, -z, -x + radius, -z); p.closePath();
  return p;
}
function slab(width, depth, radius, height, y, { hole, x = 0, z = 0, bevel = 0.001 } = {}) {
  const shape = roundedPath(width, depth, radius);
  if (hole) shape.holes.push(roundedPath(hole[0], hole[1], hole[2], THREE.Path));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height, bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 1, steps: 1, curveSegments: 4,
  });
  geometry.rotateX(-Math.PI / 2); geometry.translate(x, y, z);
  return geometry;
}
function merge(parts, vertexColors = false) {
  const flat = parts.map((part) => {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    return { geometry, color: part.color };
  });
  const count = flat.reduce((n, part) => n + part.geometry.attributes.position.count, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  const colors = vertexColors ? new Float32Array(count * 3) : null;
  const color = new THREE.Color();
  let offset = 0;
  for (const part of flat) {
    const p = part.geometry.attributes.position, n = part.geometry.attributes.normal;
    positions.set(p.array, offset * 3); normals.set(n.array, offset * 3);
    if (colors) {
      color.set(part.color || '#ffffff');
      for (let i = offset; i < offset + p.count; i++) {
        colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
      }
    }
    offset += p.count; part.geometry.dispose();
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  result.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (colors) result.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}
function letterB() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0, 1); s.lineTo(0.36, 1);
  s.quadraticCurveTo(0.70, 1, 0.70, 0.76);
  s.quadraticCurveTo(0.70, 0.57, 0.52, 0.53);
  s.quadraticCurveTo(0.75, 0.49, 0.75, 0.26);
  s.quadraticCurveTo(0.75, 0, 0.37, 0); s.closePath();
  for (const y of [0.13, 0.61]) {
    const h = new THREE.Path();
    h.moveTo(0.15, y); h.lineTo(0.15, y + 0.24); h.lineTo(0.35, y + 0.24);
    h.quadraticCurveTo(0.55, y + 0.24, 0.55, y + 0.12);
    h.quadraticCurveTo(0.55, y, 0.35, y); h.closePath(); s.holes.push(h);
  }
  return s;
}
function letterE() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0, 1); s.lineTo(0.68, 1); s.lineTo(0.68, 0.86);
  s.lineTo(0.15, 0.86); s.lineTo(0.15, 0.57); s.lineTo(0.59, 0.57);
  s.lineTo(0.59, 0.43); s.lineTo(0.15, 0.43); s.lineTo(0.15, 0.14);
  s.lineTo(0.68, 0.14); s.lineTo(0.68, 0); s.closePath();
  return s;
}
function trayGeometry() {
  const parts = [
    slab(0.538, 0.358, 0.034, 0.006, 0.002),
    slab(0.540, 0.360, 0.035, 0.018, 0.011, { hole: [0.504, 0.324, 0.023] }),
  ];
  // Actual openings, not dark rectangles: each grip is a small rounded ring.
  for (const x of [-0.28, 0.28])
    parts.push(slab(0.048, 0.162, 0.017, 0.007, 0.025, {
      x, hole: [0.029, 0.134, 0.011], bevel: 0.0009,
    }));
  return merge(parts.map((geometry) => ({ geometry })));
}
function insertGeometry() {
  const parts = [{ geometry: slab(0.495, 0.315, 0.023, 0.002, 0.010), color: '#253a3b' }];
  // Very shallow anti-slip ribs catch the light without another material or map.
  for (let i = 0; i < 11; i++) {
    const geometry = new THREE.BoxGeometry(0.446, 0.0007, 0.0016);
    geometry.translate(0, 0.0129, -0.125 + i * 0.025);
    parts.push({ geometry, color: i % 2 ? '#2c4040' : '#2a3e3e' });
  }
  [letterB(), letterB(), letterE()].forEach((shape, index) => {
    const geometry = new THREE.ShapeGeometry(shape, 5);
    geometry.scale(0.018, 0.018, 0.018); geometry.rotateX(-Math.PI / 2);
    geometry.translate(-0.023 + index * 0.017, 0.0137, 0.148);
    parts.push({ geometry, color: '#c2c5b5' });
  });
  return merge(parts, true);
}
function cupGeometry() {
  // The profile returns down the INSIDE to the floor. There is no cap across
  // the rim, so the inner wall, ceramic thickness and empty bottom are real.
  const profile = [
    [0, 0], [0.034, 0], [0.038, 0.004], [0.039, 0.010],
    [0.043, 0.020], [0.051, 0.108], [0.050, 0.113], [0.047, CUP.cupHeight],
    [0.044, 0.112], [CUP.innerTopRadius, CUP.innerTopHeight], [CUP.innerBottomRadius, CUP.innerBottomHeight], [0.030, 0.016], [0, 0.016],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  const shell = new THREE.LatheGeometry(profile, 20);
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.047, 0.087, 0), new THREE.Vector3(0.070, 0.092, 0),
    new THREE.Vector3(0.089, 0.081, 0), new THREE.Vector3(0.092, 0.060, 0),
    new THREE.Vector3(0.078, 0.041, 0), new THREE.Vector3(0.043, 0.037, 0),
  ]);
  const handle = new THREE.TubeGeometry(path, 12, 0.0065, 6, false);
  return merge([{ geometry: shell }, { geometry: handle }]);
}
function liquidGeometry() {
  const segments = 24, positions = [0, 0, 0], normals = [0, 1, 0], colors = [];
  const center = new THREE.Color('#432919'), edge = new THREE.Color('#765030');
  colors.push(center.r, center.g, center.b);
  for (const radius of [0.91, 1]) {
    for (let i = 0; i < segments; i++) {
      const angle = i * Math.PI * 2 / segments;
      positions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      normals.push(0, 1, 0);
      const c = radius === 1 ? edge : center;
      colors.push(c.r, c.g, c.b);
    }
  }
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments, a = 1 + i, b = 1 + next, c = 1 + segments + i, d = 1 + segments + next;
    indices.push(0, b, a, a, b, c, b, d, c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
/** One resource bundle for all eight cups. Optional sharing across displays is
 * explicit: the creator owns dispose(), borrowed bundles are never released. */
export function createCoffeePitchResources() {
  const geometries = { tray: trayGeometry(), insert: insertGeometry(), cup: cupGeometry(), liquid: liquidGeometry() };
  const materials = {
    tray: new THREE.MeshStandardMaterial({ color: '#9eaaa5', roughness: 0.43, metalness: 0.58 }),
    insert: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }),
    cup: new THREE.MeshStandardMaterial({ color: '#eee6d3', roughness: 0.26, metalness: 0 }),
    liquid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.02 }),
  };
  for (const [key, material] of Object.entries(materials)) material.name = 'Coffee pitch · ' + key;
  return {
    geometries, materials, disposed: false,
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      for (const geometry of Object.values(geometries)) geometry.dispose();
      for (const material of Object.values(materials)) material.dispose();
    },
  };
}
function makeMesh(geometry, material, name, count) {
  const mesh = count === undefined ? new THREE.Mesh(geometry, material) : new THREE.InstancedMesh(geometry, material, count);
  mesh.name = name; mesh.castShadow = !name.includes('liquid'); mesh.receiveShadow = true;
  if (count !== undefined) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

/** Pure visual model. Local metres, Y up. No input, game/save/audio dependency,
 * timers, extra lights, custom shaders, transmission or per-frame allocation. */
export class CoffeePitchVisual {
  constructor(parent = null, { resources } = {}) {
    if (resources?.disposed) throw new Error('Coffee resources were already disposed');
    this.resources = resources || createCoffeePitchResources();
    this.ownsResources = !resources; this.disposed = false;
    this.root = new THREE.Group(); this.root.name = 'BBE · Kaffee für den Pitch';
    this.root.userData.dynamic = true;
    this.trayRoot = new THREE.Group(); this.trayRoot.name = 'Coffee pitch · carry / kitchen transform';
    this.servedRoot = new THREE.Group(); this.servedRoot.name = 'Coffee pitch · served table transform';
    this.root.add(this.trayRoot, this.servedRoot); parent?.add(this.root);
    const { geometries: geo, materials: mat } = this.resources;
    this.tray = makeMesh(geo.tray, mat.tray, 'Coffee pitch · rounded tray and open grips');
    this.insert = makeMesh(geo.insert, mat.insert, 'Coffee pitch · anti-slip insert and small print');
    this.carriedCups = makeMesh(geo.cup, mat.cup, 'Coffee pitch · two hollow cups', 2);
    this.carriedLiquid = makeMesh(geo.liquid, mat.liquid, 'Coffee pitch · carried liquid', 2);
    this.servedCups = makeMesh(geo.cup, mat.cup, 'Coffee pitch · six shared served cups', 6);
    this.servedLiquid = makeMesh(geo.liquid, mat.liquid, 'Coffee pitch · served liquid', 6);
    this.trayRoot.add(this.tray, this.insert, this.carriedCups, this.carriedLiquid);
    this.servedRoot.add(this.servedCups, this.servedLiquid);
    this.fills = new Float64Array([0.8, 0.8]); this.tilts = new Float64Array(4);
    this.servedFills = new Float64Array(6).fill(NaN);
    this.liquidHeights = new Float64Array(2); this.liquidRadii = new Float64Array(2);
    this.liquidAngles = new Float64Array(2);
    this._transform = new THREE.Object3D(); this._axis = new THREE.Vector3();
    this._fillCupInstances(this.carriedCups, CARRY);
    this._fillCupInstances(this.servedCups, SERVED);
    // Fixed conservative bounds encompass every permitted fill/tilt. Never
    // recompute instance bounds or traverse the scene when the liquid moves.
    this._copyBounds(this.carriedCups, this.carriedLiquid);
    this._copyBounds(this.servedCups, this.servedLiquid);
    for (let i = 0; i < 2; i++) this._updateCarriedLiquid(i);
    for (let i = 0; i < 6; i++) this.setServedFill(i, 0.8);
    this.setServedCount(0);
    this.root.updateWorldMatrix(true, true);
  }
  _fillCupInstances(mesh, placements) {
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i], t = this._transform;
      t.position.set(p[0], p[1], p[2]); t.rotation.set(0, p[3], 0); t.scale.set(1, 1, 1);
      t.updateMatrix(); mesh.setMatrixAt(i, t.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  }
  _copyBounds(from, to) {
    to.boundingBox = from.boundingBox.clone(); to.boundingSphere = from.boundingSphere.clone();
  }
  _liquidTransform(mesh, index, placement, fill, tiltX = 0, tiltZ = 0) {
    const t = this._transform;
    const height = coffeeLiquidHeight(fill);
    const baseRadius = coffeeInnerRadius(height) - CUP.liquidInset;
    const requested = Math.hypot(tiltX, tiltZ);
    const clearance = Math.max(0, Math.min(height - 0.019, D.liquidCeiling - height));
    const angle = Math.min(requested, 0.48, Math.asin(Math.min(1, clearance / baseRadius)));
    // Use the inner radius at the LOWEST edge: no surface vertex can leak
    // through a tapered ceramic wall even when the requested tilt is extreme.
    const radius = coffeeLiquidRadius(fill, angle);
    t.position.set(placement[0], placement[1] + height, placement[2]);
    if (requested > 1e-8) t.quaternion.setFromAxisAngle(this._axis.set(tiltX / requested, 0, tiltZ / requested), angle);
    else t.quaternion.identity();
    const visibleRadius = fill > 0.001 ? radius : 0;
    t.scale.set(visibleRadius, 1, visibleRadius); t.updateMatrix(); mesh.setMatrixAt(index, t.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh === this.carriedLiquid) {
      this.liquidHeights[index] = height; this.liquidRadii[index] = visibleRadius; this.liquidAngles[index] = angle;
    }
  }
  _updateCarriedLiquid(index) {
    this._liquidTransform(this.carriedLiquid, index, CARRY[index], this.fills[index], this.tilts[index * 2], this.tilts[index * 2 + 1]);
  }
  setFill(index, fill) {
    if (this.disposed || (index !== 0 && index !== 1)) return false;
    const value = clamp(finite(fill), 0, 1);
    if (this.fills[index] === value) return false;
    this.fills[index] = value; this._updateCarriedLiquid(index); return true;
  }
  setTilt(index, x = 0, z = 0) {
    if (this.disposed || (index !== 0 && index !== 1)) return false;
    x = clamp(finite(x), -0.65, 0.65); z = clamp(finite(z), -0.65, 0.65);
    if (this.tilts[index * 2] === x && this.tilts[index * 2 + 1] === z) return false;
    this.tilts[index * 2] = x; this.tilts[index * 2 + 1] = z; this._updateCarriedLiquid(index); return true;
  }
  setCarriedCupsVisible(visible) {
    if (this.disposed) return;
    this.carriedCups.visible = this.carriedLiquid.visible = !!visible;
  }
  setCarryTransform(position, quaternion) {
    if (this.disposed) return;
    this.trayRoot.position.copy(position); this.trayRoot.quaternion.copy(quaternion);
  }
  setServedCount(count) {
    if (this.disposed) return;
    count = clamp(Math.floor(finite(count)), 0, 6);
    this.servedCups.count = this.servedLiquid.count = count;
    this.servedRoot.visible = count > 0;
  }
  setServedFill(index, fill) {
    if (this.disposed || !Number.isInteger(index) || index < 0 || index >= 6) return false;
    fill = clamp(finite(fill), 0, 1);
    if (this.servedFills[index] === fill) return false;
    this.servedFills[index] = fill;
    this._liquidTransform(this.servedLiquid, index, SERVED[index], fill); return true;
  }
  setServedTransform(position, quaternion) {
    if (this.disposed) return;
    this.servedRoot.position.copy(position); this.servedRoot.quaternion.copy(quaternion);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.root.removeFromParent();
    // Instance buffers have their own renderer-side lifetime; geometry and
    // materials are shared deliberately and released once by their owner.
    for (const mesh of [this.carriedCups, this.carriedLiquid, this.servedCups, this.servedLiquid]) mesh.dispose();
    if (this.ownsResources) this.resources.dispose();
  }
}