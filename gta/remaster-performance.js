/** A render-only policy: physics, clock, traffic and input use their original dt. */
export const REMASTER_RENDER_POLICY = Object.freeze({
  minScale: 0.85,
  maxScale: 1.25,
  balancedCap: 1,
  slowFPS: 42,
  recoveryFPS: 56,
  downAfter: 2.4,
  upAfter: 8,
  maximumSample: 0.2,
  sceneGrace: 1.4,
  resizeGrace: 0.8,
});

/** Contact blobs and directional-light shadows remain enabled in both routes. */
export function shouldUseRemasterAO(world, cinematic = false) {
  return !!world.composer && !world.lowQuality && world.zone !== 'city' && !cinematic;
}

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const round = (n) => Math.round(n * 1000) / 1000;

export class RemasterPerformance {
  constructor(world, { deviceScale = () => globalThis.devicePixelRatio || 1 } = {}) {
    this.world = world;
    this.deviceScale = deviceScale;
    this.scale = this.cap;
    this.scene = null;
    this.averageFrame = 1 / 60;
    this.slowSeconds = 0;
    this.fastSeconds = 0;
    this.grace = REMASTER_RENDER_POLICY.sceneGrace;
    this.suspended = true;
    this.changes = 0;
    this.sync();
  }

  get cap() {
    const device = Number(this.deviceScale());
    const hardware = Number.isFinite(device) && device > 0 ? device : 1;
    return Math.min(
      hardware,
      this.world.lowQuality ? REMASTER_RENDER_POLICY.balancedCap : REMASTER_RENDER_POLICY.maxScale,
    );
  }

  get floor() {
    // A browser/device already below .85 must never be forced to supersample.
    return Math.min(REMASTER_RENDER_POLICY.minScale, this.cap);
  }

  resetTiming(grace = REMASTER_RENDER_POLICY.sceneGrace) {
    this.averageFrame = 1 / 60;
    this.slowSeconds = 0;
    this.fastSeconds = 0;
    this.grace = grace;
  }

  /** Call after an explicit graphics preset change or a display/DPR change. */
  sync({ reset = false } = {}) {
    if (reset) this.resetTiming();
    const next = reset ? this.cap : clamp(this.scale, this.floor, this.cap);
    const renderer = this.world.renderer;
    const composer = this.world.composer;
    const rendererChanged = Math.abs((renderer.getPixelRatio?.() ?? this.scale) - next) > 0.001;
    const scaleChanged = Math.abs(this.scale - next) > 0.001;
    const composerChanged =
      !!composer?.setPixelRatio &&
      (this.syncedComposer !== composer || Math.abs(this.composerScale - next) > 0.001);
    this.scale = next;
    if (rendererChanged) renderer.setPixelRatio(next);
    // EffectComposer.setPixelRatio always resizes every pass, even for the same
    // value. Calling it on menu/zone resumes silently undoes the reduced SSAO
    // size from GameWorld.resize and makes interiors unnecessarily expensive.
    if (composerChanged) composer.setPixelRatio(next);
    this.syncedComposer = composer;
    this.composerScale = next;
    const changed = rendererChanged || composerChanged || scaleChanged;
    // Every real composer resize must restore the per-pass resolution budget.
    if (changed) this.world.resize?.();
    return changed;
  }

  changeScale(next) {
    next = round(clamp(next, this.floor, this.cap));
    if (Math.abs(next - this.scale) < 0.001) return false;
    this.scale = next;
    this.sync();
    this.changes++;
    this.resetTiming(REMASTER_RENDER_POLICY.resizeGrace);
    return true;
  }

  /**
   * Feed unclamped requestAnimationFrame seconds once per gameplay frame.
   * Menus, hidden tabs and cinematic controllers never influence the estimate.
   * A long shader/asset stall is rejected instead of causing repeated downshifts.
   */
  record(seconds, { active = true, hidden = false, cinematic = false } = {}) {
    if (!active || hidden || cinematic) {
      this.suspended = true;
      this.resetTiming();
      return false;
    }
    const scene = `${this.world.zone}|${!!this.world.lowQuality}`;
    if (this.suspended || this.scene !== scene) {
      this.suspended = false;
      this.scene = scene;
      this.resetTiming();
      this.sync();
    }
    if (
      !Number.isFinite(seconds) ||
      seconds < 0.002 ||
      seconds > REMASTER_RENDER_POLICY.maximumSample
    ) {
      this.resetTiming(REMASTER_RENDER_POLICY.resizeGrace);
      return false;
    }
    if (this.grace > 0) {
      this.grace = Math.max(0, this.grace - seconds);
      return false;
    }
    const weight = 1 - Math.exp(-seconds / 0.7);
    this.averageFrame += (seconds - this.averageFrame) * weight;
    const fps = 1 / this.averageFrame;
    if (fps < REMASTER_RENDER_POLICY.slowFPS) {
      this.slowSeconds += seconds;
      this.fastSeconds = 0;
    } else if (fps > REMASTER_RENDER_POLICY.recoveryFPS) {
      this.fastSeconds += seconds;
      this.slowSeconds = 0;
    } else {
      this.slowSeconds = Math.max(0, this.slowSeconds - seconds * 2);
      this.fastSeconds = Math.max(0, this.fastSeconds - seconds * 2);
    }
    if (this.slowSeconds >= REMASTER_RENDER_POLICY.downAfter) {
      this.slowSeconds = 0;
      return this.changeScale(this.scale - 0.1);
    }
    if (this.fastSeconds >= REMASTER_RENDER_POLICY.upAfter) {
      this.fastSeconds = 0;
      return this.changeScale(this.scale + 0.05);
    }
    return false;
  }

  get status() {
    return {
      scale: this.scale,
      cap: this.cap,
      floor: this.floor,
      estimatedFPS: 1 / this.averageFrame,
      changes: this.changes,
    };
  }
}
