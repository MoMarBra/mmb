// Photo mode changes the view while simulation is stopped. These are existing
// camera-dependent render resources, not atmosphere/weather simulation updates.
const positionSnapshot = (object) => object && ({ object, position: object.position.clone() });

export function capturePhotoView(world, arcade) {
  const atmosphere = arcade?.atmosphere;
  const weather = arcade?.immersion?.weather;
  return {
    world, arcade, atmosphere, weather, restored: false, reflectionTouched: false,
    positions: [atmosphere?.sky, atmosphere?.sunDisc, atmosphere?.glow, atmosphere?.clouds]
      .map(positionSnapshot).filter(Boolean),
    reflection: weather && {
      ready: weather.reflectionReady,
      uniformReady: weather.material.uniforms.reflectionReady.value,
      textureMatrix: weather.textureMatrix.clone(),
      camera: weather.reflectionCamera.clone(),
    },
  };
}

function ownsView(world, arcade, snapshot) {
  return snapshot && !snapshot.restored && snapshot.world === world && snapshot.arcade === arcade &&
    snapshot.atmosphere === arcade?.atmosphere && snapshot.weather === arcade?.immersion?.weather;
}

function canReflect(world, weather) {
  const p = world.player.position;
  return world.zone === 'city' && !world.lowQuality && weather?.puddles.visible &&
    Math.abs(p.x) < 27 && p.z > -155 && p.z < 149 && p.y < 9 &&
    typeof world.renderer.getRenderTarget === 'function' &&
    !world.renderer.getContext().isContextLost();
}

export function updatePhotoView(world, arcade, snapshot) {
  if (!ownsView(world, arcade, snapshot)) return false;
  const atmosphere = snapshot.atmosphere;
  if (atmosphere && world.zone === 'city') {
    const p = world.camera.position;
    atmosphere.sky.position.copy(p);
    atmosphere.sunDisc.position.copy(p).addScaledVector(atmosphere.sunDirection, 210);
    atmosphere.glow.position.copy(atmosphere.sunDisc.position);
    atmosphere.clouds.position.set(p.x, 0, p.z);
  }
  const weather = snapshot.weather;
  if (canReflect(world, weather)) {
    // Reuse the real, already-warmed render target and clipping path. Calling
    // WeatherEffects.update(0) would both miss this pass and touch gameplay state.
    snapshot.reflectionTouched = true;
    weather.reflect();
    weather.material.uniforms.reflectionReady.value = 1;
  }
  return true;
}

export function restorePhotoView(world, arcade, snapshot, { refreshReflection = true } = {}) {
  if (!ownsView(world, arcade, snapshot)) return false;
  const restorePositions = () => {
    for (const { object, position } of snapshot.positions) object.position.copy(position);
  };
  restorePositions();
  const weather = snapshot.weather;
  let refreshed = false;
  try {
    if (snapshot.reflectionTouched && refreshReflection && canReflect(world, weather)) {
      // The shared target now contains the photo view. Re-render from the restored
      // gameplay camera; restoring only its old texture matrix would mismatch it.
      weather.reflect();
      refreshed = true;
    }
  } finally {
    restorePositions();
    if (snapshot.reflection) {
      const saved = snapshot.reflection;
      if (!snapshot.reflectionTouched || refreshed) {
        // Reflection cache/timer policy remains owned by WeatherEffects. A normal
        // cancel leaves a coherent fresh image/matrix at the gameplay camera.
        weather.reflectionReady = saved.ready;
        weather.material.uniforms.reflectionReady.value = saved.uniformReady;
      } else {
        // Context loss or failed draw cannot recover GPU pixels. Restore CPU
        // metadata, suppress the stale image, and let normal weather refresh it.
        weather.textureMatrix.copy(saved.textureMatrix);
        weather.reflectionCamera.copy(saved.camera);
        weather.reflectionReady = false;
        weather.material.uniforms.reflectionReady.value = 0;
      }
    }
    snapshot.restored = true;
  }
  return true;
}
