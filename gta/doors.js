import * as THREE from 'three';
import { box, label } from './world.js';

// Shared physical anchors: all arrivals face back into the room, away from the door.
export const INTERIOR_LAYOUT = Object.freeze({
  exit: { x: 0, z: 9.2, yaw: 0 },
  wc: { x: 4, z: 9.5, yaw: 0 },
  bathroom: { x: 34, z: 25.7, yaw: 0 },
  sink: { x: 37.05, z: 24.7, yaw: -Math.PI / 2 },
});

export function portal(
  w,
  zone,
  id,
  x,
  z,
  {
    width = 1.3,
    height = 2.65,
    rotation = Math.PI,
    title = 'BBE',
    glass = false,
    cubicle = false,
  } = {},
) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rotation;
  root.userData.dynamic = true; // Hinges must never enter the static instance batches.
  w.groups[zone].add(root);
  const frame = '#465e61';
  for (const side of [-1, 1])
    box(root, side * (width / 2 + 0.06), height / 2, 0, 0.1, height + 0.08, 0.22, frame);
  box(root, 0, height + 0.02, 0, width + 0.22, 0.1, 0.22, frame);
  box(root, 0, 0.014, 0, width, 0.028, 0.25, '#a4adad', false);
  const hinge = new THREE.Group();
  hinge.position.x = -width / 2;
  root.add(hinge);
  const bottom = cubicle ? 0.18 : 0.035,
    h = height - bottom - 0.045;
  if (glass) {
    const pane = box(
      hinge,
      width / 2,
      bottom + h / 2,
      0,
      width - 0.07,
      h,
      0.055,
      new THREE.MeshPhysicalMaterial({
        color: '#94b8bc',
        transparent: true,
        opacity: 0.32,
        roughness: 0.12,
        metalness: 0.15,
        depthWrite: false,
      }),
    );
    pane.castShadow = false;
    for (const xx of [0.04, width - 0.04])
      box(hinge, xx, bottom + h / 2, 0, 0.065, h, 0.085, frame);
    for (const yy of [bottom + 0.05, 1.12, height - 0.09])
      box(hinge, width / 2, yy, 0, width, 0.09, 0.085, frame);
    // Frosted safety band is visible from both sides of the glass.
    box(hinge, width / 2, 1.52, 0, width - 0.08, 0.12, 0.059, '#c7d8d5', false);
  } else
    box(
      hinge,
      width / 2,
      bottom + h / 2,
      0,
      width - 0.065,
      h,
      0.085,
      cubicle ? '#8daaa2' : '#77918a',
    );
  for (const side of [-1, 1]) {
    box(hinge, width - 0.19, 1.05, side * 0.067, 0.07, 0.2, 0.035, '#b8c5c2');
    box(hinge, width - 0.26, 1.08, side * 0.105, 0.19, 0.04, 0.045, '#dae1db');
  }
  for (const yy of [0.35, height - 0.35]) box(hinge, 0.025, yy, 0.05, 0.07, 0.13, 0.1, '#aebbb8');
  const nameplate = label(
    root,
    title,
    0,
    cubicle ? height - 0.25 : height + 0.27,
    0.14,
    Math.min(width, 1.7),
    0.24,
    { bg: glass ? '#23594b' : '#edf0e8', fg: glass ? '#f0f5dc' : '#31575b' },
  );
  hinge.traverse((o) => {
    if (o.isMesh) w.zoneData[zone].obstacles.push(o);
  });
  const body = w.obstacle(zone, x, z, width, 0.13, height / 2, height);
  if (Math.abs(Math.sin(rotation)) > 0.01) body.quaternion.setFromEuler(0, rotation, 0);
  body.updateAABB();
  const door = { root, mesh: hinge, body, zone, opened: false, openAngle: 1.38, id, nameplate };
  (w.portals ||= {})[id] = door;
  return door;
}

export function setDoor(w, door, opened) {
  if (!door) return;
  door.opened = opened;
  const physics = w.zoneData[door.zone].physics;
  if (opened && door.body.world) physics.removeBody(door.body);
  if (!opened && !door.body.world) physics.addBody(door.body);
  physics.broadphase.dirty = true;
}

export function arrive(w, anchor) {
  w.teleport(anchor.x, anchor.z, anchor.y || 0);
  w.yaw = anchor.yaw;
  w.player.rotation.set(0, anchor.yaw + Math.PI, 0);
  w.pose = 'walk';
  w.target.set(anchor.x, (anchor.y || 0) + 1.25, anchor.z);
  w.camera.position.set(
    anchor.x + Math.sin(w.yaw) * 2.2,
    (anchor.y || 0) + 2.6,
    anchor.z + Math.cos(w.yaw) * 2.2,
  );
  w.camera.lookAt(w.target);
}
