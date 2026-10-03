import * as THREE from 'three';
import { mergeStaticGeometry } from './render-batches.js';

const prepared = new WeakMap();

function eligible(mesh, root) {
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || Array.isArray(mesh.material)) return false;
  const material = mesh.material, geometry = mesh.geometry;
  if (!material?.visible || material.transparent || material.transmission > 0 ||
      material.blending !== THREE.NormalBlending || !material.depthWrite ||
      material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ||
      material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ||
      material.onBeforeRender !== THREE.Material.prototype.onBeforeRender ||
      mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender ||
      mesh.onAfterRender !== THREE.Object3D.prototype.onAfterRender ||
      mesh.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow ||
      mesh.onAfterShadow !== THREE.Object3D.prototype.onAfterShadow ||
      !geometry?.attributes.position || Object.keys(geometry.morphAttributes || {}).length ||
      geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return false;
  for (let parent = mesh; parent && parent !== root; parent = parent.parent)
    if (parent.userData.dynamic || parent.userData.rig) return false;
  return Object.values(geometry.attributes).every(attribute =>
    !attribute.isInterleavedBufferAttribute && !attribute.normalized && attribute.array instanceof Float32Array);
}

/** Explicitly authored, non-interactive decoration only; never a drivable vehicle. */
export function batchStaticProp(root) {
  if (prepared.has(root)) return prepared.get(root);
  root.updateWorldMatrix(true, true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const groups = new Map();
  let before = 0;
  root.traverseVisible(mesh => {
    if (mesh.isMesh) before++;
    if (!eligible(mesh, root)) return;
    const attributes = Object.entries(mesh.geometry.attributes)
      .map(([name, attribute]) => [name, attribute.itemSize, attribute.array.constructor.name, attribute.normalized].join(':'))
      .sort().join(',');
    const key = [mesh.material.uuid, mesh.castShadow, mesh.receiveShadow, mesh.renderOrder,
      mesh.layers.mask, mesh.frustumCulled, attributes].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  });
  let sources = 0, batches = 0, triangles = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // Bake into the car's LOCAL coordinates, retaining the actual root transform.
    // Source geometry, hierarchy, sockets and material references remain untouched.
    const localMeshes = list.map(mesh => ({
      geometry: mesh.geometry,
      matrixWorld: inverseRoot.clone().multiply(mesh.matrixWorld),
    }));
    const geometry = mergeStaticGeometry(localMeshes);
    const first = list[0], batch = new THREE.Mesh(geometry, first.material);
    batch.name = 'Static prop · ' + first.material.name;
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.renderOrder = first.renderOrder;
    batch.layers.mask = first.layers.mask;
    batch.frustumCulled = first.frustumCulled;
    batch.matrixAutoUpdate = false;
    batch.userData.staticPropBatch = true;
    for (const mesh of list) {
      mesh.visible = false;
      mesh.userData.batchedStaticSource = true;
    }
    root.add(batch);
    sources += list.length;
    batches++;
    triangles += geometry.index.count / 3;
  }
  const report = { before, after: before - sources + batches, sources, batches, triangles };
  root.userData.staticPropBatch = report;
  prepared.set(root, report);
  return report;
}
