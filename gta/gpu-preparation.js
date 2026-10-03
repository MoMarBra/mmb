import * as THREE from 'three';
import { waitForPhotographicAssets } from './remaster-materials.js';

const jobs = new WeakMap();
const preparedViews = new WeakMap();
function waitForCompilation(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Shader preparation timed out');
      error.code = 'GRAPHICS_PREPARATION_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
const clock = () => globalThis.performance?.now?.() ?? Date.now();
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Isolated render objects share resources, never gameplay transforms or parents. */
export function graphicsProxy(source, material = source.material) {
  let proxy;
  if (source.isInstancedMesh) {
    proxy = new THREE.InstancedMesh(source.geometry, material, 1);
    proxy.instanceMatrix = source.instanceMatrix;
    proxy.instanceColor = source.instanceColor;
    proxy.morphTexture = source.morphTexture;
    proxy.count = Math.min(1, source.instanceMatrix.count);
  } else if (source.isSkinnedMesh) {
    proxy = new THREE.SkinnedMesh(source.geometry, material);
    proxy.skeleton = source.skeleton;
    proxy.bindMatrix.copy(source.bindMatrix);
    proxy.bindMatrixInverse.copy(source.bindMatrixInverse);
  } else if (source.isSprite) proxy = new THREE.Sprite(material);
  else if (source.isPoints) proxy = new THREE.Points(source.geometry, material);
  else if (source.isLineSegments) proxy = new THREE.LineSegments(source.geometry, material);
  else if (source.isLineLoop) proxy = new THREE.LineLoop(source.geometry, material);
  else if (source.isLine) proxy = new THREE.Line(source.geometry, material);
  else proxy = new THREE.Mesh(source.geometry, material);
  proxy.name = 'GPU preparation / ' + source.name;
  proxy.castShadow = source.castShadow;
  proxy.receiveShadow = source.receiveShadow;
  proxy.customDepthMaterial = source.customDepthMaterial;
  proxy.customDistanceMaterial = source.customDistanceMaterial;
  proxy.frustumCulled = false;
  proxy.matrixAutoUpdate = false;
  return proxy;
}

function variantKey(source, includeMaterial = true) {
  return [
    source.type,
    !!source.isInstancedMesh,
    !!source.isSkinnedMesh,
    !!source.instanceColor,
    !!source.morphTexture,
    source.receiveShadow,
    source.castShadow,
    Object.entries(source.geometry?.attributes || {})
      .map(([name, a]) => name + ':' + a.itemSize)
      .sort()
      .join(','),
    Object.entries(source.geometry?.morphAttributes || {})
      .map(([name, a]) => name + ':' + a.length)
      .join(','),
    source.geometry?.morphTargetsRelative,
    ...(includeMaterial ? [].concat(source.material || []).map((m) => m.uuid) : []),
  ].join('|');
}

/** Include hidden rooms/signage; some become visible only after a mission starts. */
export function graphicsInventory(world) {
  const textures = new Set(),
    materials = new Set(),
    renderables = [],
    lights = [];
  const visitValue = (value, depth = 0) => {
    if (value?.isTexture) textures.add(value);
    else if (Array.isArray(value) && depth < 3)
      for (const item of value) visitValue(item, depth + 1);
  };
  world.scene.traverse((node) => {
    if (node.isLight) lights.push(node);
    if (!node.material) return;
    // Permanently replaced collision sources never draw; their actual batch owns
    // all needed textures/shaders. Hidden rooms and temporarily hidden actors stay.
    if (node.userData.batchedStaticSource === true && node.visible === false) return;
    renderables.push(node);
    for (const material of [].concat(node.material)) {
      if (!material || materials.has(material)) continue;
      materials.add(material);
      for (const value of Object.values(material)) visitValue(value);
      for (const uniform of Object.values(material.uniforms || {})) visitValue(uniform.value);
    }
  });
  if (world.remaster?.skyTexture) textures.add(world.remaster.skyTexture);
  return {
    textures: [...textures].filter((t) => !t.isRenderTargetTexture && !t.isDepthTexture),
    materials: [...materials],
    renderables,
    lights,
  };
}

function zoneOf(node, zones) {
  for (let p = node; p; p = p.parent) if (zones.has(p)) return zones.get(p);
  return null;
}

// All state changes are synchronous and restored BEFORE an await/yield, including errors.
function rendererScope(renderer, target, clipping, action) {
  const saved = {
    target: renderer.getRenderTarget(),
    cube: renderer.getActiveCubeFace?.() || 0,
    mip: renderer.getActiveMipmapLevel?.() || 0,
    viewport: renderer.getViewport(new THREE.Vector4()),
    scissor: renderer.getScissor(new THREE.Vector4()),
    scissorTest: renderer.getScissorTest(),
    clipping: renderer.clippingPlanes,
    autoClear: renderer.autoClear,
    shadowAuto: renderer.shadowMap.autoUpdate,
    shadowNeeds: renderer.shadowMap.needsUpdate,
    color: renderer.getClearColor(new THREE.Color()),
    alpha: renderer.getClearAlpha(),
  };
  try {
    renderer.setRenderTarget(target);
    renderer.setViewport(0, 0, 4, 4);
    renderer.setScissor(0, 0, 4, 4);
    renderer.setScissorTest(true);
    renderer.clippingPlanes = clipping;
    renderer.autoClear = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    return action();
  } finally {
    renderer.clippingPlanes = saved.clipping;
    renderer.autoClear = saved.autoClear;
    renderer.shadowMap.autoUpdate = saved.shadowAuto;
    renderer.shadowMap.needsUpdate = saved.shadowNeeds;
    renderer.setRenderTarget(saved.target, saved.cube, saved.mip);
    renderer.setViewport(saved.viewport);
    renderer.setScissor(saved.scissor);
    renderer.setScissorTest(saved.scissorTest);
    renderer.setClearColor(saved.color, saved.alpha);
  }
}

function makeLayout(world, zone, lights, excluded) {
  const scene = new THREE.Scene();
  scene.fog = world.scene.fog;
  scene.environment = world.scene.environment;
  scene.environmentIntensity = world.scene.environmentIntensity;
  scene.environmentRotation.copy(world.scene.environmentRotation);
  const zones = new Map(Object.entries(world.groups).map(([name, root]) => [root, name]));
  for (const source of lights) {
    if (excluded.has(source)) continue;
    const owner = zoneOf(source, zones);
    if (owner && owner !== zone) continue;
    const light = source.clone();
    light.visible = true;
    if (light.target) {
      light.target = source.target.clone();
      scene.add(light.target);
    }
    if (light.shadow) {
      // The shadow shader is identical at a small map size; the real sun is untouched.
      light.shadow.mapSize.set(32, 32);
      light.shadow.map = null;
    }
    scene.add(light);
  }
  return scene;
}

// The real shadow pass owns and retains its internal MeshDepthMaterial. A separate
// disposable depth material would release the programs again during cleanup.
function prepareShadowVariants(renderer, scene, camera) {
  if (renderer.shadowMap.enabled !== true) return;
  const probes = new THREE.Group(),
    geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01),
    materials = [];
  probes.name = 'GPU preparation / shadow variants';
  for (const side of [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide]) {
    const material = new THREE.MeshBasicMaterial({ side, colorWrite: false, depthWrite: false });
    materials.push(material);
    // Three checks the instance flags when deciding whether to select a program.
    // Alternate them for every caster so all three side variants are selected too.
    for (let kind = 0; kind < 3; kind++) {
      const mesh = kind
        ? new THREE.InstancedMesh(geometry, material, 1)
        : new THREE.Mesh(geometry, material);
      if (kind === 2) mesh.setColorAt(0, new THREE.Color(0xffffff));
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      probes.add(mesh);
    }
  }
  scene.add(probes);
  try {
    rendererScope(renderer, null, [], () => {
      // r180 renders shadows before setupLights(). A second draw uses this exact
      // scene's settled light counts, including the first-frame transition cases.
      for (let pass = 0; pass < 2; pass++) {
        scene.traverse((node) => {
          if (node.castShadow && node.shadow) node.shadow.needsUpdate = true;
        });
        renderer.shadowMap.needsUpdate = true;
        renderer.render(scene, camera);
      }
    });
  } finally {
    scene.remove(probes);
    for (const mesh of probes.children) if (mesh.isInstancedMesh) mesh.dispose();
    for (const material of materials) material.dispose();
    geometry.dispose();
  }
}

/**
 * Boot-only preparation, independent of the skippable film. The caller keeps its
 * minimal overlay and defers world/film rendering until this promise resolves.
 * Failed optional warm-up work never prevents starting the game.
 */
export function prepareGameGraphics(
  game,
  { onProgress = () => {}, budgetMs = 6, yieldTask = nextTask, compileTimeoutMs = 20000 } = {},
) {
  const world = game.world;
  if (jobs.has(world)) return jobs.get(world);
  const state = (world.graphicsPreparation = {
    state: 'loading',
    progress: 0,
    textures: 0,
    layouts: 0,
    variants: 0,
    errors: [],
    ready: false,
    elapsedMs: 0,
  });
  const start = clock();
  const update = (phase, progress) => {
    state.state = phase;
    state.progress = Math.max(state.progress, Math.min(1, progress));
    try {
      onProgress(state.progress, state);
    } catch {
      /* UI reporting is optional. */
    }
  };
  const error = (phase, failure) => state.errors.push(phase + ': ' + (failure?.message || failure));
  const renderer = world.renderer;
  const run = async () => {
    const temporaryTargets = [];
    const layouts = [];
    try {
      await waitForPhotographicAssets(world);
      const vehiclePreparation = game.arcade?.vehiclePreload?.pending;
      if (vehiclePreparation) await waitForCompilation(vehiclePreparation, compileTimeoutMs);
      if (!renderer.compileAsync || !renderer.initTexture || !renderer.getRenderTarget)
        return state;
      update('textures', 0.08);
      const inventory = graphicsInventory(world);
      const uploaded = new Map();
      let slice = clock();
      for (let i = 0; i < inventory.textures.length; i++) {
        const texture = inventory.textures[i];
        try {
          if (typeof texture.image?.decode === 'function') await texture.image.decode();
          if (texture.image && (!('complete' in texture.image) || texture.image.complete)) {
            renderer.initTexture(texture);
            state.textures++;
            uploaded.set(texture, texture.version);
          }
        } catch (e) {
          error('texture ' + texture.name, e);
        }
        if (clock() - slice >= budgetMs) {
          update('textures', 0.08 + (0.24 * (i + 1)) / inventory.textures.length);
          await yieldTask();
          slice = clock();
        }
      }
      const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10000);
      camera.position.set(0, 2, 5);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
      temporaryTargets.push(target);
      const empty = new THREE.Scene();
      const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.14)];
      const zones = new Map(Object.entries(world.groups).map(([name, root]) => [root, name]));
      const action = game.extras?.intro?.action;
      const excluded = new Set([...(action?.floods || []), action?.flash].filter(Boolean));
      const names = Object.keys(world.groups);
      // Lighting counts are stable, so one daytime layout also covers darkness.
      for (let z = 0; z < names.length; z++) {
        const zone = names[z];
        const scene = makeLayout(world, zone, inventory.lights, excluded);
        layouts.push(scene);
        const seen = new Set(),
          sources = [];
        for (const source of inventory.renderables) {
          const owner = zoneOf(source, zones);
          if (owner && owner !== zone) continue;
          const key = variantKey(source);
          if (seen.has(key)) continue;
          seen.add(key);
          sources.push(source);
        }
        const group = new THREE.Group();
        scene.add(group);
        // Small batches let the boot indicator paint while the GPU compiles.
        for (const [route, renderTarget, planes] of [
          ['canvas', null, []],
          ['linear', target, []],
          ...(zone === 'city' ? [['reflection', target, clip]] : []),
        ]) {
          for (let i = 0; i < sources.length; i += 24) {
            group.clear();
            for (const source of sources.slice(i, i + 24)) group.add(graphicsProxy(source));
            try {
              const compiling = rendererScope(renderer, renderTarget, planes, () => {
                // Three r180 initializes clipping state in render(), not compile().
                renderer.render(empty, camera);
                return renderer.compileAsync(group, camera, scene);
              });
              await waitForCompilation(compiling, compileTimeoutMs);
              rendererScope(renderer, renderTarget, planes, () => {
                renderer.shadowMap.needsUpdate = route === 'canvas';
                renderer.render(scene, camera);
              });
              state.variants += group.children.length;
            } catch (e) {
              error(zone + '/' + route, e);
              if (e.code === 'GRAPHICS_PREPARATION_TIMEOUT') throw e;
            }
            update(
              'shaders',
              0.32 + (0.58 * (z + (i + 24) / Math.max(24, sources.length))) / names.length,
            );
            await yieldTask();
          }
        }
        group.clear();
        try {
          prepareShadowVariants(renderer, scene, camera);
        } catch (e) {
          error(zone + '/shadow variants', e);
        }
        await yieldTask();
        state.layouts++;
      }
      update('geometry', 0.9);
      // Compile does not call WebGLObjects.update: every previously unseen street
      // cell would otherwise upload its buffers during the player's first turn.
      const buffers = new Map();
      for (const source of inventory.renderables) {
        if (!source.geometry || (!source.visible && !source.isInstancedMesh)) continue;
        const key =
          source.type + '|' + source.geometry.uuid + '|' + (source.instanceMatrix?.id ?? '');
        if (!buffers.has(key)) buffers.set(key, source);
      }
      const uploadMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
      const uploadScene = new THREE.Scene();
      const uploadSources = [...buffers.values()];
      try {
        for (let i = 0; i < uploadSources.length; i += 32) {
          uploadScene.clear();
          for (const source of uploadSources.slice(i, i + 32)) {
            const proxy = graphicsProxy(source, uploadMaterial);
            proxy.castShadow = proxy.receiveShadow = false;
            uploadScene.add(proxy);
          }
          rendererScope(renderer, target, [], () => renderer.render(uploadScene, camera));
          state.geometries = Math.min(i + 32, uploadSources.length);
          await yieldTask();
        }
      } finally {
        uploadMaterial.dispose();
      }
      // Actual postprocess materials and targets are retained, so their first
      // normal/SSAO/output pass does not compile during the first camera turn.
      update('effects', 0.92);
      if (world.ssao && world.composer) {
        const ssao = world.ssao;
        const scene = layouts.find((_, i) => names[i] === 'office') || layouts[0];
        const normals = new THREE.Group();
        const seen = new Set();
        for (const source of inventory.renderables) {
          if (!source.isMesh) continue;
          const key = variantKey(source, false);
          if (seen.has(key)) continue;
          seen.add(key);
          normals.add(graphicsProxy(source, ssao.normalMaterial));
        }
        try {
          // NormalMaterial includes light counts in r180's cache key too.
          // Prime every interior layout, even though this pass does not shade lights.
          for (let i = 0; i < layouts.length; i++) {
            if (names[i] === 'city') continue;
            const normalScene = layouts[i];
            await waitForCompilation(
              rendererScope(renderer, target, [], () => {
                renderer.render(empty, camera);
                return renderer.compileAsync(normals, camera, normalScene);
              }),
              compileTimeoutMs,
            );
            normalScene.add(normals);
            try {
              rendererScope(renderer, target, [], () => renderer.render(normalScene, camera));
            } finally {
              normalScene.remove(normals);
            }
            await yieldTask();
          }
          const savedScene = ssao.scene,
            savedCamera = ssao.camera,
            savedScreen = ssao.renderToScreen;
          scene.add(normals);
          try {
            ssao.scene = scene;
            ssao.camera = camera;
            ssao.renderToScreen = false;
            rendererScope(renderer, target, [], () => ssao.render(renderer, target, target, 0));
          } finally {
            ssao.scene = savedScene;
            ssao.camera = savedCamera;
            ssao.renderToScreen = savedScreen;
            scene.remove(normals);
          }
          for (const pass of world.composer.passes) {
            if (!pass.material?.isRawShaderMaterial || !pass.uniforms?.toneMappingExposure)
              continue;
            const savedScreen = pass.renderToScreen;
            const savedInput = pass.uniforms.tDiffuse.value;
            try {
              pass.renderToScreen = false;
              rendererScope(renderer, target, [], () =>
                pass.render(renderer, target, world.ssao.blurRenderTarget),
              );
            } finally {
              pass.renderToScreen = savedScreen;
              pass.uniforms.tDiffuse.value = savedInput;
            }
          }
        } catch (e) {
          error('postprocessing', e);
        }
      }
      // Small canvas/SVG logos can finish after the photographic asset promise.
      // Refresh only textures whose content changed during the compilation tasks.
      for (const texture of inventory.textures) {
        if (uploaded.get(texture) === texture.version || !texture.image) continue;
        try {
          if (typeof texture.image.decode === 'function') await texture.image.decode();
          renderer.initTexture(texture);
          if (!uploaded.has(texture)) state.textures++;
          uploaded.set(texture, texture.version);
        } catch (e) {
          error('late texture ' + texture.name, e);
        }
        await yieldTask();
      }
    } catch (e) {
      error('preparation', e);
    } finally {
      for (const scene of layouts)
        scene.traverse((node) => {
          node.shadow?.map?.dispose();
          node.shadow?.mapPass?.dispose();
        });
      for (const target of temporaryTargets) target.dispose();
      state.ready = true;
      state.elapsedMs = Math.round(clock() - start);
      state.programs = renderer.info?.programs?.length || 0;
      update('ready', 1);
    }
    return state;
  };
  const promise = run();
  jobs.set(world, promise);
  world.graphicsReady = promise;
  return promise;
}

/** Prime a film's real visible lighting budget without ever moving its scene. */
export async function prepareVisibleGraphics(
  world,
  {
    reflection = false,
    shouldContinue = () => true,
    yieldTask = nextTask,
    compileTimeoutMs = 20000,
  } = {},
) {
  const renderer = world.renderer;
  if (!renderer.compileAsync || !renderer.getRenderTarget || !shouldContinue()) return;
  let prepared = preparedViews.get(world);
  if (!prepared) preparedViews.set(world, (prepared = new Set()));
  const sources = [],
    lights = [],
    seen = new Set(),
    textures = new Set();
  world.scene.traverseVisible((node) => {
    if (node.isLight) lights.push(node);
    if (!node.material) return;
    const key = variantKey(node);
    if (seen.has(key)) return;
    seen.add(key);
    sources.push({ source: node, key });
    for (const material of [].concat(node.material)) {
      for (const value of Object.values(material))
        if (value?.isTexture && !value.isRenderTargetTexture && !value.isDepthTexture)
          textures.add(value);
    }
  });
  const lighting = lights
    .map((light) => light.type + ':' + Number(light.castShadow))
    .sort()
    .join('/');
  const signature = [
    lighting,
    world.scene.environment?.uuid,
    world.scene.fog?.type,
    renderer.toneMapping,
    renderer.outputColorSpace,
    renderer.shadowMap.enabled,
    renderer.shadowMap.type,
  ].join('|');
  const scene = makeLayout(world, world.zone, lights, new Set());
  const group = new THREE.Group();
  scene.add(group);
  const camera = world.camera.clone();
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const empty = new THREE.Scene();
  const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.14)];
  try {
    // Intro-only vehicle decals are created lazily, after general game preparation.
    for (const texture of textures) {
      if (!shouldContinue()) return;
      if (texture.image) renderer.initTexture(texture);
    }
    for (const [route, renderTarget, planes] of [
      ['canvas', null, []],
      ...(reflection ? [['reflection', target, clip]] : []),
    ]) {
      const pending = sources.filter(
        ({ key }) => !prepared.has(signature + '|' + route + '|' + key),
      );
      for (let i = 0; i < pending.length; i += 24) {
        if (!shouldContinue()) return;
        const batch = pending.slice(i, i + 24);
        group.clear();
        for (const { source } of batch) group.add(graphicsProxy(source));
        await waitForCompilation(
          rendererScope(renderer, renderTarget, planes, () => {
            renderer.render(empty, camera);
            return renderer.compileAsync(group, camera, scene);
          }),
          compileTimeoutMs,
        );
        // Space may skip the film while parallel shader compilation is pending.
        if (!shouldContinue()) return;
        rendererScope(renderer, renderTarget, planes, () => {
          renderer.shadowMap.needsUpdate = route === 'canvas';
          renderer.render(scene, camera);
        });
        for (const { key } of batch) prepared.add(signature + '|' + route + '|' + key);
        await yieldTask();
      }
    }
  } catch (error) {
    world.graphicsPreparation?.errors?.push('intro: ' + (error?.message || error));
  } finally {
    scene.traverse((node) => {
      node.shadow?.map?.dispose();
      node.shadow?.mapPass?.dispose();
    });
    target.dispose();
  }
}
