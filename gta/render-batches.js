import * as THREE from 'three';
import { applyMunichLimewash } from './remaster-materials.js';

// Bake compatible, immobile meshes into one indexed mesh per material and street cell.
// Source meshes stay available to collision raycasts; moving hierarchies never enter here.
export function mergeStaticGeometry(meshes) {
  const names = Object.keys(meshes[0].geometry.attributes);
  const vertexCount = meshes.reduce((n, m) => n + m.geometry.attributes.position.count, 0);
  const indexCount = meshes.reduce(
    (n, m) => n + (m.geometry.index?.count || m.geometry.attributes.position.count),
    0,
  );
  const arrays = Object.fromEntries(
    names.map((name) => [
      name,
      new Float32Array(vertexCount * meshes[0].geometry.attributes[name].itemSize),
    ]),
  );
  const indices = new Uint32Array(indexCount);
  let vertexOffset = 0,
    indexOffset = 0;
  for (const mesh of meshes) {
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const count = geometry.attributes.position.count;
    for (const name of names) {
      const attribute = geometry.attributes[name];
      arrays[name].set(attribute.array, vertexOffset * attribute.itemSize);
    }
    const index = geometry.index;
    for (let i = 0, n = index?.count || count; i < n; i++)
      indices[indexOffset++] = vertexOffset + (index ? index.getX(i) : i);
    if (mesh.matrixWorld.determinant() < 0) {
      const first = indexOffset - (index?.count || count);
      for (let i = first; i < indexOffset; i += 3)
        [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    }
    vertexOffset += count;
    geometry.dispose();
  }
  const merged = new THREE.BufferGeometry();
  for (const name of names)
    merged.setAttribute(
      name,
      new THREE.BufferAttribute(arrays[name], meshes[0].geometry.attributes[name].itemSize),
    );
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

export function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}
export function setHTML(node, html) {
  if (node._renderedHTML !== html) {
    node.innerHTML = html;
    node._renderedHTML = html;
  }
}
// The photographic extension is deliberately limited to the authored PBR family.
// Unknown hooks and mutable actor hierarchies keep their existing material batches.
// Asphalt and pavement remain on the original shared-material path: weather
// changes their roughness/tint in place, so cloning would disconnect wet surfaces.
const photographicSurfaces = new Set([
  'plaster',
  'oak',
  'fabric',
  'metal',
  'stone',
  'bark',
  'grass',
]);
const nonRenderingMaterialKeys = new Set([
  'id',
  'uuid',
  'name',
  'color',
  'version',
  'userData',
  '_listeners',
  'onBeforeCompile',
  'customProgramCacheKey',
]);

function materialValue(value, depth = 0) {
  if (value === null || value === undefined) return value === undefined ? ['undefined'] : null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : ['number', String(value)];
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'function' || depth > 8) throw new TypeError('Unsupported material value');
  if (value.isTexture) {
    // Identity keeps different pixel sources apart; include UV/sampler state as well.
    // Do not call updateMatrix(): computing a key must never mutate source textures.
    return [
      'texture',
      value.uuid,
      ...[
        'channel',
        'mapping',
        'wrapS',
        'wrapT',
        'wrapR',
        'magFilter',
        'minFilter',
        'anisotropy',
        'format',
        'internalFormat',
        'type',
        'colorSpace',
        'flipY',
        'premultiplyAlpha',
        'unpackAlignment',
        'generateMipmaps',
        'compareFunction',
        'matrixAutoUpdate',
        'matrix',
        'offset',
        'repeat',
        'center',
        'rotation',
      ].map((k) => [k, materialValue(value[k], depth + 1)]),
    ];
  }
  if (
    value.isColor ||
    value.isVector2 ||
    value.isVector3 ||
    value.isVector4 ||
    value.isEuler ||
    value.isMatrix3 ||
    value.isMatrix4 ||
    value.isQuaternion
  )
    return value.toArray();
  if (Array.isArray(value)) return value.map((v) => materialValue(v, depth + 1));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    throw new TypeError('Unsupported material object');
  return Object.keys(value)
    .sort()
    .map((k) => [k, materialValue(value[k], depth + 1)]);
}

function photographicColorKey(mesh) {
  const m = mesh.material,
    geometry = mesh.geometry;
  if (
    !photographicSurfaces.has(m.userData.remasterSurface) ||
    m.constructor !== THREE.MeshStandardMaterial ||
    !m.visible ||
    m.transparent ||
    m.vertexColors ||
    m.wireframe ||
    m.alphaTest ||
    m.alphaHash ||
    m.polygonOffset ||
    m.emissive.getHex() !== 0 ||
    m.clippingPlanes?.length ||
    m.userData.dynamic ||
    m.onBeforeRender !== THREE.Material.prototype.onBeforeRender ||
    !mesh.isMesh ||
    mesh.isInstancedMesh ||
    mesh.isSkinnedMesh ||
    !mesh.receiveShadow ||
    mesh.layers.mask !== 1 ||
    mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender ||
    mesh.onAfterRender !== THREE.Object3D.prototype.onAfterRender ||
    !geometry?.attributes.position ||
    geometry.attributes.color ||
    Object.keys(geometry.morphAttributes || {}).length ||
    geometry.drawRange.start !== 0 ||
    geometry.drawRange.count !== Infinity
  )
    return null;
  for (let p = mesh; p; p = p.parent) {
    if (p.userData.dynamic || p.userData.rig || p.userData.remasterHuman || p.userData.remasterType)
      return null;
  }
  // The existing geometry merger deliberately handles only ordinary float data.
  // Reject custom packed/interleaved attributes rather than silently changing them.
  if (
    Object.values(geometry.attributes).some(
      (a) => a.isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array),
    )
  )
    return null;
  const standardHook = m.onBeforeCompile === THREE.Material.prototype.onBeforeCompile;
  let programKey;
  try {
    programKey = m.customProgramCacheKey();
  } catch {
    return null;
  }
  const limewash =
    m.userData.remasterSurface === 'plaster' &&
    programKey === 'munich-limewash-v1' &&
    m.onBeforeCompile === applyMunichLimewash;
  if (!standardHook && !limewash) return null;
  if (standardHook && m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey)
    return null;
  try {
    // Snapshot every rendering property, including future enumerable additions.
    // Only the diffuse tint differs; it is baked into linear vertex colors.
    const properties = Object.keys(m)
      .filter((k) => !nonRenderingMaterialKeys.has(k))
      .sort()
      .map((k) => [k, materialValue(m[k])]);
    return (
      'photo:' +
      JSON.stringify([
        m.userData.remasterSurface,
        limewash ? 'munich-limewash-v1' : 'standard',
        mesh.layers.mask,
        mesh.castShadow,
        mesh.receiveShadow,
        properties,
      ])
    );
  } catch {
    return null;
  }
}

// Safe color-only consolidation: original meshes/materials remain intact for
// raycasts and gameplay. Only the rendered static copy receives vertex colors.
export function staticColorKey(mesh) {
  const m = mesh.material;
  if (m.userData?.remasterSurface) return photographicColorKey(mesh);
  if (
    !m.isMeshStandardMaterial ||
    m.isMeshPhysicalMaterial ||
    m.transparent ||
    !m.visible ||
    m.vertexColors ||
    mesh.geometry.attributes.color ||
    m.wireframe ||
    m.alphaTest ||
    m.polygonOffset ||
    m.emissive?.getHex() ||
    m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile
  )
    return null;
  if (
    [
      'map',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'aoMap',
      'lightMap',
      'bumpMap',
      'alphaMap',
      'displacementMap',
      'envMap',
    ].some((k) => m[k])
  )
    return null;
  return [
    m.type,
    m.roughness,
    m.metalness,
    m.side,
    m.flatShading,
    m.depthTest,
    m.depthWrite,
    m.toneMapped,
  ].join('/');
}
export function mergeColoredStatics(meshes, materialCache) {
  const key = staticColorKey(meshes[0]);
  if (!key) return { geometry: mergeStaticGeometry(meshes), material: meshes[0].material };
  const photographic = key.startsWith('photo:');
  if (photographic && meshes.some((mesh) => staticColorKey(mesh) !== key))
    throw new TypeError('Photographic batches require identical rendering parameters');
  let mat = materialCache.get(key);
  if (!mat) {
    const source = meshes[0].material;
    mat = source.clone();
    if (photographic) {
      // Material.clone() intentionally does not copy shader callbacks. Preserve the
      // authored limewash mapping before color_fragment applies the vertex tint.
      mat.onBeforeCompile = source.onBeforeCompile;
      mat.customProgramCacheKey = source.customProgramCacheKey;
    }
    mat.color.set('#ffffff');
    mat.vertexColors = true;
    mat.name = photographic
      ? 'Static photographic vertex-color surfaces'
      : 'Static vertex-color surfaces';
    materialCache.set(key, mat);
  }
  const copies = meshes.map((mesh) => {
    const geometry = mesh.geometry.clone(),
      count = geometry.attributes.position.count,
      color = new Float32Array(count * 3),
      c = mesh.material.color;
    for (let i = 0; i < count; i++) color.set([c.r, c.g, c.b], i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
    return { geometry, matrixWorld: mesh.matrixWorld };
  });
  const geometry = mergeStaticGeometry(copies);
  for (const copy of copies) copy.geometry.dispose();
  return { geometry, material: mat };
}
