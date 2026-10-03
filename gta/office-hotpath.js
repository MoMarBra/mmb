import * as THREE from 'three';

// Keep the original distance calculation, strict bounds, line-of-sight call order,
// and first-in-array winner for equal distances. No candidate arrays or sorting.
export function nearestVisibleNPC(arcade) {
  const p = arcade.world.player.position;
  const npcs = arcade.world.zoneData[arcade.world.zone].npcs;
  let nearest;
  let nearestDistance = 2.25;
  for (let i = 0, length = npcs.length; i < length; i++) {
    if (!(i in npcs)) continue;
    const n = npcs[i];
    if (n.down || !n.mesh.visible || !(Math.abs(n.mesh.position.y - p.y) < 2)) continue;
    const d = Math.hypot(n.mesh.position.x - p.x, n.mesh.position.z - p.z);
    if (d < 2.25 && arcade.lineClear(p, n.mesh.position) && d < nearestDistance) {
      nearest = n;
      nearestDistance = d;
    }
  }
  return nearest;
}

// Weak ownership avoids retaining disposed worlds. A separate frame at each
// recursion depth prevents nested raycasts from clearing an outer hit array.
const cameraScratch = new WeakMap();

function makeCameraFrame() {
  return {
    desiredTarget: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    desired: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    hits: [],
    savedOrigin: new THREE.Vector3(),
    savedDirection: new THREE.Vector3(),
    savedFar: 0,
  };
}

// Only the existing chase-camera calculation moves here. FOV/SSAO updates and
// special-camera overrides stay with their original owner and ordering.
export function updateChaseCamera(world, body, zone, dt, flightHeight, cinematicIntro) {
  const ray = world.ray;
  let scratch = cameraScratch.get(ray);
  if (!scratch) {
    scratch = { depth: 0, frames: [] };
    cameraScratch.set(ray, scratch);
  }
  const depth = scratch.depth;
  const frame = scratch.frames[depth] || (scratch.frames[depth] = makeCameraFrame());
  if (depth > 0) {
    frame.savedOrigin.copy(ray.ray.origin);
    frame.savedDirection.copy(ray.ray.direction);
    frame.savedFar = ray.far;
  }
  scratch.depth++;
  frame.hits.length = 0;
  try {
    frame.desiredTarget.set(
      body.position.x,
      flightHeight || body.position.y - 0.34 + (world.pose === 'eat' ? 1.0 : 1.25),
      body.position.z,
    );
    world.target.lerp(frame.desiredTarget, 1 - Math.exp(-dt * 10));
    frame.offset.set(
      Math.sin(world.yaw) * Math.cos(world.pitch) * world.distance,
      1 + Math.sin(world.pitch) * world.distance,
      Math.cos(world.yaw) * Math.cos(world.pitch) * world.distance,
    );
    frame.desired.copy(world.target).add(frame.offset);
    ray.set(world.target, frame.direction.copy(frame.offset).normalize());
    ray.far = frame.offset.length();
    const hits = cinematicIntro
      ? frame.hits
      : ray.intersectObjects(zone.obstacles, false, frame.hits);
    if (hits.length && hits[0].distance > 0.1)
      frame.desired
        .copy(world.target)
        .addScaledVector(frame.offset.normalize(), Math.max(0.45, hits[0].distance - 0.2));
    world.camera.position.lerp(frame.desired, 1 - Math.exp(-dt * 12));
    world.camera.lookAt(world.target);
    world.camera.updateMatrixWorld();
  } finally {
    // Raycaster appends to optionalTarget; never leave old hits or scene objects
    // in it between frames. The outermost call retains the public ray as before.
    frame.hits.length = 0;
    if (depth > 0) {
      ray.ray.origin.copy(frame.savedOrigin);
      ray.ray.direction.copy(frame.savedDirection);
      ray.far = frame.savedFar;
    }
    scratch.depth--;
  }
}
