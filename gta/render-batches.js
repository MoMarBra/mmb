import * as THREE from 'three';

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
// Safe color-only consolidation: original meshes/materials remain intact for
// raycasts and gameplay. Only the rendered static copy receives vertex colors.
export function staticColorKey(mesh) {
  const m = mesh.material;
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
  let mat = materialCache.get(key);
  if (!mat) {
    mat = meshes[0].material.clone();
    mat.color.set('#ffffff');
    mat.vertexColors = true;
    mat.name = 'Static vertex-color surfaces';
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
