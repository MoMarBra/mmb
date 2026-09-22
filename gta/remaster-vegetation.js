import * as THREE from 'three';
import { remasterMaterial, photographicTexture } from './remaster-materials.js';
import { mergeStaticGeometry } from './render-batches.js';
let variants;
function makeVariants() {
  if (variants) return variants;
  const bark = remasterMaterial('bark', { color: '#d6d1bd' });
  const leafMap = photographicTexture('leaf');
  leafMap.repeat.set(1, 1);
  const leaf = new THREE.MeshStandardMaterial({
    map: leafMap,
    color: '#a5b78b',
    roughness: 0.86,
    side: THREE.DoubleSide,
    alphaTest: 0.38,
    shadowSide: THREE.DoubleSide,
  });
  leaf.name = 'Photographic plane-tree leaves';
  leaf.userData.remasterSurface = 'leaf';
  const leafShape = new THREE.PlaneGeometry(0.23, 0.46, 1, 2);
  const pos = leafShape.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.abs(pos.getY(i)) * 0.13);
  leafShape.computeVertexNormals();
  variants = [];
  for (let variant = 0; variant < 4; variant++) {
    let state = 2483 + variant * 47;
    const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
    const parts = [],
      leaves = [];
    const branch = (from, to, r0, r1) => {
      const vec = to.clone().sub(from),
        geo = new THREE.CylinderGeometry(r1, r0, vec.length(), 7, 1);
      // Vertical bark grain remains correctly scaled along each branch.
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, uv.getX(i) * Math.PI * (r0 + r1), uv.getY(i) * vec.length());
      const mesh = new THREE.Mesh(geo, bark);
      mesh.position.copy(from).addScaledVector(vec, 0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.normalize());
      mesh.updateMatrixWorld();
      parts.push(mesh);
    };
    branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.04, 4.25, 0), 0.2, 0.095);
    for (let b = 0; b < 10; b++) {
      const angle = b * 2.399 + variant,
        tip = new THREE.Vector3(
          Math.cos(angle) * (1.4 + random() * 0.5),
          4.35 + random() * 1.65,
          Math.sin(angle) * (1.4 + random() * 0.5),
        );
      const joint = new THREE.Vector3(0.02, 2.8 + random() * 1.2, 0);
      branch(joint, tip, 0.09, 0.026);
      for (let t = 0; t < 3; t++) {
        const end = tip
          .clone()
          .add(new THREE.Vector3((random() - 0.5) * 1.3, random() * 0.7, (random() - 0.5) * 1.3));
        branch(tip, end, 0.026, 0.008);
        for (let l = 0; l < 22; l++) {
          const m = new THREE.Mesh(leafShape, leaf);
          m.position
            .copy(end)
            .add(
              new THREE.Vector3(
                (random() - 0.5) * 1.9,
                (random() - 0.5) * 1.6,
                (random() - 0.5) * 1.9,
              ),
            );
          m.rotation.set(random() * 2.8, random() * 6.28, random() * 6.28);
          m.scale.setScalar(0.8 + random() * 0.8);
          m.updateMatrixWorld();
          leaves.push(m);
        }
      }
    }
    const trunk = mergeStaticGeometry(parts),
      crown = mergeStaticGeometry(leaves);
    for (const p of parts) p.geometry.dispose();
    variants.push({ trunk, crown, bark, leaf });
  }
  leafShape.dispose();
  return variants;
}
export function realisticTree(parent, x, z) {
  const variants = makeVariants(),
    seed = Math.abs(Math.round(x * 13 + z * 19)),
    v = variants[seed % variants.length];
  const group = new THREE.Group();
  group.name = 'Remaster · Stadtplatane';
  group.position.set(x, 0, z);
  group.rotation.y = (seed % 628) / 100;
  const scale = 0.92 + (seed % 11) * 0.013;
  group.scale.set(scale, scale, scale);
  const trunk = new THREE.Mesh(v.trunk, v.bark),
    crown = new THREE.Mesh(v.crown, v.leaf);
  trunk.castShadow = trunk.receiveShadow = crown.castShadow = crown.receiveShadow = true;
  group.add(trunk, crown);
  parent.add(group);
  return group;
}
// Photographic foliage for indoor plants, using the same CC0 leaf and shared geometry.
let plantKit;
export function realisticPlant(parent, x, z, scale = 1) {
  if (!plantKit) {
    const points = [
      [0, 0],
      [0.2, 0],
      [0.255, 0.035],
      [0.31, 0.46],
      [0.31, 0.5],
      [0.275, 0.51],
      [0.27, 0.46],
      [0.225, 0.035],
    ].map((p) => new THREE.Vector2(...p));
    const pot = new THREE.LatheGeometry(points, 24),
      soil = new THREE.CylinderGeometry(0.272, 0.24, 0.025, 20);
    const leaf = new THREE.PlaneGeometry(0.21, 0.46, 2, 5);
    const p = leaf.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setZ(i, 0.06 * Math.cos((y / 0.46) * Math.PI * 2));
    }
    leaf.computeVertexNormals();
    const map = photographicTexture('leaf');
    map.repeat.set(1, 1);
    plantKit = {
      pot,
      soil,
      leaf,
      ceramic: new THREE.MeshStandardMaterial({ color: '#eee6d9', roughness: 0.35 }),
      earth: remasterMaterial('bark', { color: '#59442f' }),
      foliage: new THREE.MeshStandardMaterial({
        map,
        color: '#77976b',
        side: THREE.DoubleSide,
        alphaTest: 0.38,
        roughness: 0.83,
      }),
      stem: new THREE.MeshStandardMaterial({ color: '#4b6741', roughness: 0.9 }),
    };
  }
  const k = plantKit,
    g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  g.name = 'Remaster · Zimmerpflanze';
  const pot = new THREE.Mesh(k.pot, k.ceramic);
  pot.castShadow = pot.receiveShadow = true;
  g.add(pot);
  const earth = new THREE.Mesh(k.soil, k.earth);
  earth.position.y = 0.47;
  g.add(earth);
  for (let s = 0; s < 6; s++) {
    const a = s * 2.399,
      top = new THREE.Vector3(Math.cos(a) * 0.18, 0.91 + (s % 3) * 0.15, Math.sin(a) * 0.18),
      bottom = new THREE.Vector3(0, 0.48, 0);
    const direction = top.clone().sub(bottom),
      stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.012, direction.length(), 5),
        k.stem,
      );
    stem.position.copy(bottom).addScaledVector(direction, 0.5);
    stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    g.add(stem);
    for (let n = 0; n < 4; n++) {
      const leaf = new THREE.Mesh(k.leaf, k.foliage);
      leaf.position
        .copy(top)
        .add(
          new THREE.Vector3(Math.cos(a + n * 1.7) * 0.12, -n * 0.1, Math.sin(a + n * 1.7) * 0.12),
        );
      leaf.rotation.set(0.35 + n * 0.3, a + n * 1.7, 0.35);
      leaf.castShadow = leaf.receiveShadow = true;
      g.add(leaf);
    }
  }
  const groups = new Map();
  g.updateMatrixWorld(true);
  // Bake in plant-local coordinates, never the room's translated coordinates.
  const inverse = g.matrixWorld.clone().invert();
  for (const mesh of g.children) {
    const list = groups.get(mesh.material) || [];
    list.push({ geometry: mesh.geometry, matrixWorld: inverse.clone().multiply(mesh.matrixWorld) });
    groups.set(mesh.material, list);
  }
  const baked = [];
  for (const [mat, items] of groups) {
    const mesh = new THREE.Mesh(mergeStaticGeometry(items), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    baked.push(mesh);
  }
  for (const child of [...g.children]) {
    g.remove(child);
    if (child.material === k.stem) child.geometry.dispose();
  }
  g.add(...baked);
  parent.add(g);
  return g;
}
