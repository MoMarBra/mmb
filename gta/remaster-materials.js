import * as THREE from 'three';
import { HDRLoader } from './vendor/addons/loaders/HDRLoader.js';

// All photographic surfaces are vendored CC0 assets; no CDN or account required.
const settings = {
  asphalt: [3, 0.34, 0.96],
  pavement: [1.8, 0.5, 0.93],
  plaster: [2.5, 0.23, 0.92],
  oak: [1.8, 0.25, 0.72],
  fabric: [0.65, 0.28, 0.96],
  metal: [2, 0.12, 0.47],
  stone: [2.4, 0.4, 0.91],
  bark: [1.6, 0.55, 0.98],
  grass: [3, 0.48, 1],
};
const textures = new Map(),
  materials = new Map(),
  geometryCache = new Map(),
  pending = [];
const failures = [];
export function remasterURL(file) {
  return globalThis.__BBE_REMASTER_ASSETS__?.[file] || './assets/remaster/' + file;
}
export function photographicTexture(key, map = 'albedo') {
  const id = key + '-' + map;
  if (textures.has(id)) return textures.get(id);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = map === 'normal' ? '#8080ff' : map === 'roughness' ? '#eeeeee' : '#dddddd';
  ctx.fillRect(0, 0, 2, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'CC0 / ' + id;
  texture.colorSpace = map === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  const meters = settings[key]?.[0] || 1;
  texture.repeat.set(1 / meters, 1 / meters);
  textures.set(id, texture);
  if (typeof document.createElementNS === 'function') {
    pending.push(
      new Promise((resolve) => {
        new THREE.ImageLoader().load(
          remasterURL(id + '.webp'),
          (img) => {
            texture.image = img;
            texture.needsUpdate = true;
            resolve(true);
          },
          undefined,
          () => {
            failures.push(id);
            resolve(false);
          },
        );
      }),
    );
  }
  return texture;
}
export function remasterMaterial(key, options = {}) {
  const id = key + JSON.stringify(options);
  if (materials.has(id)) return materials.get(id);
  const cfg = settings[key] || settings.plaster;
  const material = new THREE.MeshStandardMaterial({
    name: 'Remaster / ' + key,
    color: '#ffffff',
    map: photographicTexture(key),
    normalMap: photographicTexture(key, 'normal'),
    roughnessMap: photographicTexture(key, 'roughness'),
    normalScale: new THREE.Vector2(cfg[1], cfg[1]),
    roughness: cfg[2],
    metalness: key === 'metal' ? 0.72 : 0,
    ...options,
  });
  if (key === 'plaster') {
    // Painted Munich stucco: preserve photographed grain while keeping clean limewash albedo.
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuse, 0.58);',
      );
    };
    material.customProgramCacheKey = () => 'munich-limewash-v1';
  }
  material.userData.remasterSurface = key;
  materials.set(id, material);
  return material;
}
// UVs are expressed in meters, including each face of a scaled unit box.
// Vertices/pivots stay unchanged, preserving every collider and animation anchor.
export function metricBoxGeometry(w, h, d) {
  const key = [w, h, d].map((v) => Math.abs(v).toFixed(3)).join('/');
  if (geometryCache.has(key)) return geometryCache.get(key);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const uv = geometry.attributes.uv;
  const sizes = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * Math.abs(sizes[f][0]), uv.getY(i) * Math.abs(sizes[f][1]));
    }
  geometry.userData.metricUV = true;
  geometryCache.set(key, geometry);
  return geometry;
}
export function upgradeInteriorSurfaces(root, zone) {
  root.traverse((mesh) => {
    if (!mesh.isMesh || mesh.isInstancedMesh || Array.isArray(mesh.material)) return;
    let p = mesh;
    while (p && p !== root) {
      if (
        p.userData.dynamic ||
        p.userData.rig ||
        p.userData.remasterHuman ||
        p.userData.remasterType
      )
        return;
      p = p.parent;
    }
    if (mesh.name === 'Meeting room · strategy board backing') return;
    const old = mesh.material;
    if (
      !old.isMeshStandardMaterial ||
      old.map ||
      old.transparent ||
      (old.emissive?.getHex() !== 0 && old.emissiveIntensity > 0.1) ||
      old.userData.remasterSurface
    )
      return;
    if (mesh.geometry.type !== 'BoxGeometry' || old.roughness < 0.55) return;
    const gp = mesh.geometry.parameters,
      w = gp.width * Math.abs(mesh.scale.x),
      h = gp.height * Math.abs(mesh.scale.y),
      d = gp.depth * Math.abs(mesh.scale.z);
    if (Math.max(w, h, d) < 0.5) return;
    const col = old.color,
      hsl = col.getHSL({});
    let type = null,
      tint = old.color.clone();
    if (
      h < 0.32 &&
      ((w > 8 && d > 8) || (zone === 'city' && mesh.position.y < 0.22 && w > 2 && d > 2))
    ) {
      type =
        zone === 'city'
          ? hsl.h > 0.17 && hsl.h < 0.4 && hsl.s > 0.06
            ? 'grass'
            : 'pavement'
          : zone === 'zitronengras'
            ? 'pavement'
            : hsl.h > 0.39 && hsl.h < 0.65 && hsl.s > 0.09
              ? 'fabric'
              : 'oak';
      tint.set('#f1ede4');
    } else if (hsl.h > 0.04 && hsl.h < 0.14 && hsl.s > 0.16 && hsl.l < 0.55) {
      type = zone === 'city' && h > 3 ? 'stone' : 'oak';
      tint.set('#dfd5c4');
    } else if (hsl.l > 0.5 && hsl.s < 0.32 && (h > 1 || w > 1.4)) type = 'plaster';
    else if (old.metalness > 0.4) type = 'metal';
    else if (hsl.l < 0.19 && w > 0.38 && w < 2.8 && d > 0.38 && h < 1.3) type = 'fabric';
    if (!type) return;
    mesh.material = remasterMaterial(type, { color: '#' + tint.getHexString() });
    // Bake dimensions into UV only; geometric scale and object identity remain intact.
    if (gp.width === 1 && gp.height === 1 && gp.depth === 1)
      mesh.geometry = metricBoxGeometry(w, h, d);
    else {
      const geo = mesh.geometry.clone(),
        uv = metricBoxGeometry(w, h, d).attributes.uv;
      if (geo.attributes.uv?.count === uv.count) geo.setAttribute('uv', uv.clone());
      mesh.geometry = geo;
    }
  });
}
export function installPhotographicLighting(world) {
  world.remaster = { version: '2.0-local', textureFailures: failures, hdrReady: false };
  if (typeof document.createElementNS !== 'function') return Promise.resolve(false);
  const hdrTask = new HDRLoader()
    .loadAsync(remasterURL('sky-day-1k.hdr'))
    .then((texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(world.renderer);
      const previous = world.scene.environment;
      const target = pmrem.fromEquirectangular(texture);
      world.scene.environment = target.texture;
      world.scene.environmentIntensity = 0.58;
      world.remaster.skyTexture = texture;
      world.remaster.environmentTarget = target;
      world.remaster.hdrReady = true;
      previous?.dispose();
      pmrem.dispose();
      return true;
    })
    .catch((error) => {
      failures.push('HDR: ' + error.message);
      return false;
    });
  world.remasterReady = Promise.all([...pending, hdrTask]);
  return world.remasterReady;
}
export function remasterAssetStatus() {
  return { textures: textures.size, materials: materials.size, failures: failures.slice() };
}
/** Rounded furniture edges keep highlights continuous without changing contact bounds. */
const roundedCache = new Map();
export function furnitureGeometry(w, h, d, r = 0.025) {
  const key = [w, h, d, r].join('/');
  if (roundedCache.has(key)) return roundedCache.get(key);
  const halfX = w / 2 - r,
    halfY = h / 2 - r,
    shape = new THREE.Shape();
  shape.moveTo(-halfX, -halfY);
  shape.lineTo(halfX, -halfY);
  shape.lineTo(halfX, halfY);
  shape.lineTo(-halfX, halfY);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - r * 2,
    steps: 1,
    bevelEnabled: true,
    bevelSize: r,
    bevelThickness: r,
    bevelSegments: 3,
    curveSegments: 3,
  });
  geo.translate(0, 0, -(d - r * 2) / 2);
  geo.scale(1 / w, 1 / h, 1 / d);
  geo.computeVertexNormals();
  roundedCache.set(key, geo);
  return geo;
}
