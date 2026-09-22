import * as THREE from 'three';
import { blenderVehicle } from './blender-vehicles.js';

// The pursuit rig retains all gameplay sockets. Its new wheel assemblies use the
// same authored geometry as the civilian remaster, scaled only for its tyre size.
let policeWheelKit;
const tunedMaterials = new WeakMap();
function prepareWheels() {
  if (policeWheelKit) return policeWheelKit;
  const group = new THREE.Group();
  const reference = blenderVehicle(group, 'car', '#c8cbc9', {
    box() {},
    label() {},
    contactShadow(root) {
      const m = new THREE.Group();
      root.add(m);
      return m;
    },
  });
  const transform = new THREE.Matrix4().makeScale(1, 0.34 / 0.325, 0.34 / 0.325);
  const parts = (source) =>
    source.children
      .filter((m) => m.isMesh)
      .map((m) => {
        m.updateMatrix();
        return {
          // Scaling the instance instead of cloning vertex buffers lets police and
          // civilian wheels share the same GPU geometry, including the far LOD.
          geometry: m.geometry,
          lod: m.userData.lodGeometry || m.geometry,
          transform: transform.clone().multiply(m.matrix),
          material: m.material,
          name: m.name,
        };
      });
  policeWheelKit = [-1, 1].map((side) => ({
    side,
    wheel: parts(reference.userData.wheels.find((m) => m.userData.side === side)),
    caliper: parts(reference.userData.calipers.find((m) => m.userData.side === side)),
  }));
  return policeWheelKit;
}
function appendParts(parent, parts) {
  for (const part of parts) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.name = 'Remaster pursuit ' + part.name;
    mesh.userData.lodGeometry = part.lod;
    mesh.applyMatrix4(part.transform);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
}
function tuneMaterial(material) {
  if (!material?.isMeshStandardMaterial) return material;
  if (!tunedMaterials.has(material)) {
    const copy = material.clone();
    copy.name = 'Remaster pursuit · ' + material.color.getHexString();
    if (copy.transparent) {
      copy.opacity = 0.47;
      copy.depthWrite = false;
      copy.roughness = 0.07;
      copy.metalness = 0.06;
    } else if (copy.metalness > 0.25) {
      copy.roughness = Math.min(copy.roughness, 0.25);
      if (copy.isMeshPhysicalMaterial) {
        copy.clearcoat = 1;
        copy.clearcoatRoughness = 0.13;
      }
      copy.envMapIntensity = 1.1;
    }
    tunedMaterials.set(material, copy);
  }
  return tunedMaterials.get(material);
}
export function remasterPoliceCar(car) {
  const rig = car.userData;
  const wheelKit = prepareWheels();
  // Keep independently animated emissive lights independent: siren flashes must
  // not alter the materials on any other police vehicle.
  const animated = new Set([
    ...(rig.flashers || []),
    ...(rig.headlights || []),
    ...(rig.taillights || []),
  ]);
  car.traverse((mesh) => {
    if (!mesh.isMesh || Array.isArray(mesh.material) || animated.has(mesh)) return;
    mesh.material = tuneMaterial(mesh.material);
    if (mesh.material.transparent) {
      mesh.userData.vehicleGlass = true;
      mesh.castShadow = false;
    }
  });
  rig.calipers = [];
  for (const wheel of rig.wheels) {
    const axle = wheel.parent;
    const side = axle.position.x < 0 ? -1 : 1;
    const set = wheelKit.find((m) => m.side === side);
    wheel.clear();
    appendParts(wheel, set.wheel);
    wheel.userData.axis = 'x';
    wheel.userData.radius = 0.34;
    const caliper = new THREE.Group();
    caliper.name = 'Pursuit brake caliper';
    caliper.position.copy(axle.position);
    Object.assign(caliper.userData, {
      kind: 'caliper',
      front: axle.position.z > 0,
      side,
      restPosition: axle.position.clone(),
      steerAngle: 0,
    });
    appendParts(caliper, set.caliper);
    car.add(caliper);
    rig.calipers.push(caliper);
  }
  rig.dentMesh = car.children.find(
    (m) =>
      m.isMesh &&
      m.name === 'police-body static details' &&
      m.material.color?.getHexString() === 'dedfd8',
  );
  rig.remastered = true;
  car.name = 'München Polizei · Remaster pursuit estate';
  return car;
}
