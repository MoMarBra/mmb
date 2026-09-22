import * as THREE from 'three';

const direction = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const offset = new THREE.Vector3();
const vertical = new THREE.Vector3(0, 1, 0);

/** Keep the shadow grid fixed in light space, including indoors and at low quality. */
export function snapDirectionalShadow(light) {
  const camera = light.shadow.camera;
  const texelX = (camera.right - camera.left) / light.shadow.mapSize.x;
  const texelY = (camera.top - camera.bottom) / light.shadow.mapSize.y;
  if (!(texelX > 0 && texelY > 0)) return false;
  offset.copy(light.position).sub(light.target.position);
  if (offset.lengthSq() < 1e-8) return false;
  direction.copy(offset).normalize();
  right.crossVectors(vertical, direction);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  else right.normalize();
  up.crossVectors(direction, right).normalize();
  const target = light.target.position;
  const x = target.dot(right),
    y = target.dot(up);
  target.addScaledVector(right, Math.round(x / texelX) * texelX - x);
  target.addScaledVector(up, Math.round(y / texelY) * texelY - y);
  // Quantize depth as well: cached low-quality maps must keep the exact camera
  // transform, not only its XY grid, until the next scheduled shadow render.
  const depthStep = Math.max(texelX, texelY);
  const depth = target.dot(direction);
  target.addScaledVector(direction, Math.round(depth / depthStep) * depthStep - depth);
  light.position.copy(target).add(offset);
  return true;
}

/** A metre of hysteresis prevents foot bob and hovering at a band edge from rescaling shadows. */
export function shadowSpanForAltitude(altitude, previous = 45) {
  let band = Math.max(0, Math.round((previous - 45) / 5));
  const height = Number.isFinite(altitude) ? Math.max(0, altitude) : 0;
  while (height > band * 10 + 2) band++;
  while (band > 0 && height < (band - 1) * 10 + 1) band--;
  return 45 + band * 5;
}

/** Detect any transform/projection change before reusing a shadow texture. */
export class ShadowProjectionTracker {
  constructor() {
    this.previous = new Float64Array(18).fill(NaN);
  }
  changed(light) {
    const p = light.position,
      t = light.target.position,
      c = light.shadow.camera;
    const values = [
      p.x,
      p.y,
      p.z,
      t.x,
      t.y,
      t.z,
      c.left,
      c.right,
      c.top,
      c.bottom,
      c.near,
      c.far,
      light.shadow.mapSize.x,
      light.shadow.mapSize.y,
      light.shadow.bias,
      light.shadow.normalBias,
      c.zoom,
      Number(light.castShadow),
    ];
    let changed = false;
    for (let i = 0; i < values.length; i++) {
      if (!Number.isFinite(this.previous[i]) || Math.abs(this.previous[i] - values[i]) > 1e-9)
        changed = true;
      this.previous[i] = values[i];
    }
    return changed;
  }
}

/** The default canvas AA does not apply to EffectComposer's offscreen render targets. */
export function postprocessSamples(renderer, limit = 4) {
  const cap = Math.min(limit, renderer.capabilities?.maxSamples || 0);
  if (cap < 2) return 0;
  const gl = renderer.getContext?.();
  try {
    const supported = gl?.getInternalformatParameter?.(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES);
    // RGBA16F MSAA support can be narrower than the device's global maximum.
    if (!supported?.length) return 0;
    return Math.max(0, ...Array.from(supported).filter((n) => n >= 2 && n <= cap));
  } catch {
    return 0;
  }
}
