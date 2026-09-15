import * as THREE from 'three';
import { BLENDER_VEHICLES } from './assets/models/munich-vehicles.js';

// Authored in Blender 4.5 LTS. Shared buffers allow all background traffic to be instanced.
const ROAD_LIFT = 0.076; // Authoring ground is y=0; the asphalt surface is y=0.086.
const geometryCache = new Map();
const materialCache = new Map();
function decode(encoded, Type) {
  const raw = atob(encoded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Type(bytes.buffer);
}
function geometry(model, index, data) {
  const key = model + ':' + index;
  if (!geometryCache.has(key)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(decode(data.positions, Float32Array), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(decode(data.normals, Float32Array), 3));
    g.setIndex(new THREE.BufferAttribute(decode(data.indices, Uint16Array), 1));
    if (data.part === 'static') g.translate(0, ROAD_LIFT, 0);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    geometryCache.set(key, g);
  }
  return geometryCache.get(key);
}
function material(name, paint) {
  const key = name === 'paint' ? name + paint : name;
  if (!materialCache.has(key)) {
    const spec = BLENDER_VEHICLES.materials[name];
    const color =
      name === 'paint' ? new THREE.Color(paint) : new THREE.Color().fromArray(spec.color);
    const transparent = spec.opacity < 1;
    const params = {
      color,
      roughness: spec.roughness,
      metalness: spec.metalness,
      transparent,
      opacity: spec.opacity,
      depthWrite: !transparent,
      emissive: spec.emissiveIntensity ? color : new THREE.Color(0),
      emissiveIntensity: spec.emissiveIntensity,
    };
    const mat =
      name === 'paint'
        ? new THREE.MeshPhysicalMaterial({ ...params, clearcoat: 0.65, clearcoatRoughness: 0.19 })
        : new THREE.MeshStandardMaterial(params);
    mat.name = 'Blender · ' + key;
    materialCache.set(key, mat);
  }
  return materialCache.get(key);
}

export function blenderVehicle(parent, type, paint, kit) {
  const model = type === 'bus' ? 'bus' : type === 'van' ? 'van' : 'car';
  const data = BLENDER_VEHICLES.models[model];
  const root = new THREE.Group();
  root.name = 'München ' + type + ' · Blender 4.5';
  root.rotation.order = 'YXZ';
  root.userData.dynamic = true;
  root.userData.blenderModel = model;
  root.userData.doors = {};
  root.userData.wheels = [];
  const parts = { static: root };
  for (const [name, p] of Object.entries(data.pivots)) {
    if (p.kind === 'socket') {
      const socket = new THREE.Vector3().fromArray(p.position);
      socket.y += ROAD_LIFT;
      if (name === 'passengerSeat') root.userData.passengerSeats = [socket];
      else root.userData[name] = socket;
      continue;
    }
    const group = new THREE.Group();
    group.name = name;
    group.position.fromArray(p.position);
    group.position.y += ROAD_LIFT;
    Object.assign(group.userData, p);
    root.add(group);
    parts[name] = group;
    if (p.kind === 'door') root.userData.doors[name] = group;
    if (p.kind === 'wheel') {
      // Steering rotates the axle first; spin must never rotate the steering axis.
      group.rotation.order = 'YXZ';
      group.userData.restPosition = group.position.clone();
      group.userData.rollAngle = 0;
      group.userData.steerAngle = 0;
      root.userData.wheels.push(group);
    }
  }
  const wheelZ = root.userData.wheels.map((wheel) => wheel.position.z);
  root.userData.wheelbase = Math.max(...wheelZ) - Math.min(...wheelZ);
  const lods = new Map(
    (data.lod?.meshes || []).map((mesh, i) => [
      mesh.part + ':' + mesh.material,
      geometry(model + ':lod', i, mesh),
    ]),
  );
  data.meshes.forEach((data, i) => {
    const mesh = new THREE.Mesh(geometry(model, i, data), material(data.material, paint));
    mesh.name = `${model} ${data.part} ${data.material}`;
    mesh.userData.lodGeometry = lods.get(data.part + ':' + data.material);
    mesh.castShadow = data.material !== 'glass';
    mesh.receiveShadow = true;
    if (data.material === 'glass') mesh.userData.vehicleGlass = true;
    if (data.material === 'paint' && data.part === 'static') root.userData.dentMesh = mesh;
    (parts[data.part] || root).add(mesh);
  });
  if (type === 'taxi') {
    kit.box(root, 0, 1.62 + ROAD_LIFT, -0.25, 0.53, 0.15, 0.22, '#e6d4a7');
    kit.label(root, 'TAXI', 0, 1.63 + ROAD_LIFT, -0.126, 0.42, 0.105, {
      bg: '#ebd8a4',
      fg: '#22343b',
    });
  }
  if (model === 'bus')
    kit.label(root, '100 · MUSEENLINIE', 0, 2.57 + ROAD_LIFT, 4.17, 1.9, 0.22, {
      bg: '#101d22',
      fg: '#f6d286',
    });
  const shadow = kit.contactShadow(
    root,
    0,
    0,
    model === 'bus' ? 3.2 : 2.6,
    model === 'bus' ? 9.1 : model === 'van' ? 5.9 : 5.0,
  );
  shadow.position.y = 0.098;
  root.userData.contactShadow = shadow;
  parent.add(root);
  return root;
}

const FULL_TURN = Math.PI * 2;
const wheelYaw = new THREE.Quaternion();
const chassisInverse = new THREE.Quaternion();
const levelWheel = new THREE.Quaternion();
const wheelSteer = new THREE.Quaternion();
const wheelSpin = new THREE.Quaternion();
const xAxis = new THREE.Vector3(1, 0, 0);
const yAxis = new THREE.Vector3(0, 1, 0);

/** +Z is forward; positive steering turns towards +X. Spin remains around the axle. */
export function animateVehicleWheels(car, speed, dt, steering = 0) {
  if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(speed)) return;
  const rig = car.mesh.userData;
  const nativeAxles = rig.frontAxles;
  const turn = Number.isFinite(steering) ? THREE.MathUtils.clamp(steering, -1, 1) * 0.35 : 0;
  for (const wheel of rig.wheels || []) {
    // The police model supplies separate steering axles, with X-spinning child wheels.
    const axis = wheel.userData.axis || (nativeAxles ? 'x' : 'y');
    const radius = wheel.userData.radius || rig.wheelRadius || 0.37;
    const angle =
      ((wheel.userData.rollAngle ?? wheel.rotation[axis]) + (speed * dt) / radius) % FULL_TURN;
    wheel.userData.rollAngle = angle;
    if (axis === 'x') {
      const steer = wheel.userData.front
        ? THREE.MathUtils.damp(wheel.userData.steerAngle || 0, turn, 10, dt)
        : 0;
      wheel.userData.steerAngle = steer;
      // XYZ combines roll with yaw and makes the wheel wobble once per revolution.
      wheel.rotation.set(angle, steer, 0, 'YXZ');
    } else wheel.rotation[axis] = angle;
  }
  for (const axle of nativeAxles || []) {
    axle.userData.steerAngle = THREE.MathUtils.damp(axle.userData.steerAngle || 0, turn, 10, dt);
    axle.rotation.set(0, axle.userData.steerAngle, 0, 'YXZ');
  }
}

/** Suspension belongs to the chassis; tyres keep their authored road contact. */
export function alignVehicleWheelsToRoad(car) {
  const rig = car.mesh.userData;
  if (!rig.blenderModel && !rig.groundAlignedWheels) return;
  wheelYaw.setFromAxisAngle(yAxis, car.mesh.rotation.y);
  chassisInverse.copy(car.mesh.quaternion).invert();
  levelWheel.copy(chassisInverse).multiply(wheelYaw);
  if (rig.contactShadow) {
    const shadow = rig.contactShadow;
    shadow.position.set(0, 0.098 - car.mesh.position.y, 0).applyQuaternion(chassisInverse);
    wheelSpin.setFromAxisAngle(xAxis, -Math.PI / 2);
    shadow.quaternion.copy(levelWheel).multiply(wheelSpin);
  }
  for (const wheel of rig.wheels || []) {
    const mount = rig.frontAxles ? wheel.parent : wheel;
    const rest = mount.userData.restPosition;
    if (!rest) continue;
    // Convert a level axle centre back into the tilted chassis coordinate system.
    mount.position.copy(rest).applyQuaternion(wheelYaw);
    mount.position.y -= car.mesh.position.y;
    mount.position.applyQuaternion(chassisInverse);
    wheelSteer.setFromAxisAngle(yAxis, mount.userData.steerAngle || 0);
    mount.quaternion.copy(levelWheel).multiply(wheelSteer);
    if (mount === wheel) {
      wheelSpin.setFromAxisAngle(xAxis, wheel.userData.rollAngle || 0);
      wheel.quaternion.multiply(wheelSpin);
    }
  }
}
