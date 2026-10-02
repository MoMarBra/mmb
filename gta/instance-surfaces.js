import * as THREE from 'three';

// Different diffuse colours do not require separate draw calls. Restrict this
// to untextured, opaque built-in surfaces; keep every other material parameter.
const keys = new WeakMap();
export function instanceSurfaceKey(mesh) {
  const m = mesh.material;
  if (
    !m?.isMeshStandardMaterial ||
    m.transparent ||
    !m.visible ||
    m.vertexColors ||
    mesh.geometry.attributes.color ||
    m.alphaTest ||
    m.wireframe ||
    m.clippingPlanes?.length ||
    m.clipIntersection ||
    m.clipShadows ||
    m.precision ||
    m.emissive?.getHex() ||
    m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile
  )
    return null;
  if (Object.keys(m).some((k) => /Map$|^map$/.test(k) && m[k]?.isTexture)) return null;
  if (!keys.has(m)) {
    const data = m.toJSON();
    for (const key of ['metadata', 'uuid', 'name', 'color', 'userData']) delete data[key];
    keys.set(m, JSON.stringify(data));
  }
  return keys.get(m);
}
export function instanceSurfaceMaterial(material, cache, key) {
  if (!key) return material;
  if (!cache.has(key)) {
    const m = material.clone();
    m.color.setRGB(1, 1, 1);
    m.name = 'Instanced colour / ' + (material.name || material.type);
    cache.set(key, m);
  }
  return cache.get(key);
}
