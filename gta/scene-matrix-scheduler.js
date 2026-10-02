import { Object3D } from './vendor/three.module.js';

const sceneSchedulers = new WeakMap();
const optimizedPasses = new WeakSet();

/**
 * Prepare the visible world's transforms once for all passes of one render.
 * No geometry, animation, light or shadow setting is changed. Explicit matrix
 * updates outside preparation retain Three.js semantics, including hidden zones.
 */
export class SceneMatrixScheduler {
  constructor(scene, roots = () => []) {
    this.scene = scene;
    this.roots = roots;
    this.registered = new Map();
    this.preparing = false;
    this.rendering = false;
    this.disposed = false;
    this.frames = 0;
    this.skippedRoots = 0;
    this.visitedObjects = 0;
  }

  updateVisible(object, force = false) {
    if (object.visible === false) {
      if (this.registered.has(object)) this.skippedRoots++;
      return;
    }
    this.visitedObjects++;
    const original = this.registered.get(object)?.original || object.updateMatrixWorld;
    if (original !== Object3D.prototype.updateMatrixWorld) {
      // Cameras and specialised/custom objects retain their own update contract.
      object.updateMatrixWorld(force);
      if (object.isSkinnedMesh)
        for (const bone of object.skeleton?.bones || []) bone.updateWorldMatrix(true, false);
      return;
    }
    // Three r180's ordinary Object3D path, restricted to branches that can render.
    if (object.matrixAutoUpdate) object.updateMatrix();
    if (object.matrixWorldNeedsUpdate || force) {
      if (object.matrixWorldAutoUpdate === true) {
        if (object.parent === null) object.matrixWorld.copy(object.matrix);
        else object.matrixWorld.multiplyMatrices(object.parent.matrixWorld, object.matrix);
      }
      object.matrixWorldNeedsUpdate = false;
      force = true;
    }
    for (const child of object.children) this.updateVisible(child, force);
  }

  registerRoots() {
    const roots = typeof this.roots === 'function' ? this.roots() : this.roots;
    for (const root of roots || []) {
      if (!root || root.parent !== this.scene || this.registered.has(root)) continue;
      const scheduler = this;
      const original = root.updateMatrixWorld;
      const descriptor = Object.getOwnPropertyDescriptor(root, 'updateMatrixWorld');
      function updateMatrixWorld(force) {
        if (scheduler.preparing && this === root && root.visible === false) {
          scheduler.skippedRoots++;
          return;
        }
        return original.call(this, force);
      }
      root.updateMatrixWorld = updateMatrixWorld;
      this.registered.set(root, { original, descriptor, updateMatrixWorld });
    }
  }

  render(draw) {
    // A caller managing matrices itself, or a nested pass, keeps full ownership.
    if (this.disposed || this.rendering || this.scene.matrixWorldAutoUpdate !== true) return draw();
    this.registerRoots();
    this.skippedRoots = 0;
    this.visitedObjects = 0;
    this.preparing = true;
    try {
      this.updateVisible(this.scene);
    } finally {
      this.preparing = false;
    }
    this.frames++;
    const previous = this.scene.matrixWorldAutoUpdate;
    this.scene.matrixWorldAutoUpdate = false;
    this.rendering = true;
    try {
      return draw();
    } finally {
      // Cinematics, compilation and explicit raycasts outside this call work as before.
      this.scene.matrixWorldAutoUpdate = previous;
      this.rendering = false;
    }
  }

  dispose() {
    this.disposed = true;
    for (const [root, entry] of this.registered) {
      if (root.updateMatrixWorld !== entry.updateMatrixWorld) continue;
      if (entry.descriptor) Object.defineProperty(root, 'updateMatrixWorld', entry.descriptor);
      else delete root.updateMatrixWorld;
    }
    this.registered.clear();
  }
}

/** Shared entry for gameplay, WC portal shots and the separate cinematic sets. */
export function renderGameScene(
  world,
  scene = world.scene,
  camera = world.camera,
  { ao = false, dt = 0 } = {},
) {
  let scheduler = sceneSchedulers.get(scene);
  if (!scheduler || scheduler.disposed) {
    scheduler = new SceneMatrixScheduler(scene, () =>
      scene === world.scene ? Object.values(world.groups || {}) : [],
    );
    sceneSchedulers.set(scene, scheduler);
  }
  if (scene === world.scene) world.sceneMatrixScheduler = scheduler;
  return scheduler.render(() =>
    ao && world.composer ? world.composer.render(dt) : world.renderer.render(scene, camera),
  );
}

/** Points and lines under invisible ancestors cannot contribute to the AO pass. */
export function optimizeSSAOVisibility(pass) {
  if (optimizedPasses.has(pass)) return pass;
  optimizedPasses.add(pass);
  pass._overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverseVisible((object) => {
      if ((object.isPoints || object.isLine || object.isLine2) && object.visible) {
        object.visible = false;
        cache.push(object);
      }
    });
  };
  return pass;
}
