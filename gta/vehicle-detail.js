import * as THREE from 'three';
import { human } from './world.js';

function isWindow(mesh) {
  if (!mesh.isMesh || Array.isArray(mesh.material)) return false;
  if (mesh.userData.vehicleGlass) return true;
  const hex = mesh.material.color?.getHexString();
  if (hex !== '143744' && hex !== '365361' && !mesh.material.transparent) return false;
  mesh.geometry.computeBoundingBox();
  const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(mesh.scale);
  // The small center-console screen is intentionally not breakable window glass.
  return Math.abs(size.y) > 0.21 && Math.max(Math.abs(size.x), Math.abs(size.z)) > 0.3;
}

/** Direct replacement for VehicleFeel.detail(car). */
export function detail(car) {
  if (car.detailReady || ['bike', 'helicopter'].includes(car.type)) return;
  car.detailReady = true;
  car.detailed = true;
  for (const batch of this.a.vehicleBatches || [])
    for (const item of batch.list) {
      if (item.car === car && !item.source.userData.suppressed) item.source.visible = true;
    }
  const children = car.mesh.children.filter((m) => m.isMesh);
  const nativeDoors = car.mesh.userData.doors;
  const native = nativeDoors && Object.values(nativeDoors).some((door) => door?.isGroup);
  // The native police model's first direct mesh is its windshield, NOT its body.
  const body =
    car.mesh.userData.dentMesh ||
    (native
      ? children.find(
          (m) =>
            m.name === 'police-body static details' &&
            m.material.color?.getHexString() === 'dedfd8',
        )
      : children[0]);
  if (body) {
    body.geometry = body.geometry.clone();
    car.dentMesh = body;
    car.originalVertices = body.geometry.attributes.position.array.slice();
  }
  car.glazing = [];
  car.mesh.traverse((m) => {
    if (isWindow(m)) car.glazing.push(m);
  });
  car.doors = [];
  if (native) {
    // Preserve all four authored pivots, frames, windows, handles and inside panels.
    for (const name of ['frontLeft', 'frontRight', 'rearLeft', 'rearRight']) {
      const pivot = nativeDoors[name];
      if (!pivot) continue;
      const windows = [];
      pivot.traverse((m) => {
        if (isWindow(m)) windows.push(m);
      });
      const side = pivot.userData.side ?? (name.endsWith('Left') ? -1 : 1);
      car.doors.push({
        name,
        pivot,
        side,
        front: pivot.userData.front ?? name.startsWith('front'),
        window: windows[0],
        windows,
        target: 0,
        closedAngle: pivot.userData.closedAngle ?? 0,
        openAngle: pivot.userData.openAngle ?? -side * 1.12,
      });
    }
  } else {
    // Existing generic-car treatment remains available for the older street cars.
    const width = car.width || (car.type === 'bus' ? 2.5 : 1.85);
    const length = car.length || (car.type === 'bus' ? 8.5 : car.type === 'van' ? 5.3 : 4.4);
    const material = body?.material || new THREE.MeshStandardMaterial({ color: '#5f7982' });
    const add = (parent, p, size, mat) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
      mesh.position.set(...p);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    if (!['bus', 'van'].includes(car.type) && children[1]) {
      children[1].visible = false;
      children[1].userData.suppressed = true;
      for (const glass of car.glazing)
        if (Math.abs(glass.position.x) > 0.5) {
          glass.visible = false;
          glass.userData.suppressed = true;
        }
      add(car.mesh, [0, 1.48, -0.2], [width * 0.95, 0.13, length * 0.54], material);
      const upholstery = new THREE.MeshStandardMaterial({ color: '#25343c', roughness: 0.82 });
      for (const x of [-0.4, 0.4]) {
        add(car.mesh, [x, 0.78, -0.25], [0.54, 0.18, 0.57], upholstery);
        add(car.mesh, [x, 1.04, -0.48], [0.52, 0.51, 0.12], upholstery);
      }
    }
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * width * 0.5, 0.65, 0.65);
      car.mesh.add(pivot);
      add(pivot, [0, 0.02, -0.67], [0.07, 0.55, 1.35], material);
      const window = add(
        pivot,
        [0, 0.48, -0.67],
        [0.028, 0.35, 1.26],
        new THREE.MeshStandardMaterial({
          color: '#86a6b0',
          transparent: true,
          opacity: 0.48,
          metalness: 0.4,
          roughness: 0.15,
        }),
      );
      car.doors.push({
        name: side < 0 ? 'frontLeft' : 'frontRight',
        pivot,
        side,
        front: true,
        window,
        windows: [window],
        target: 0,
        closedAngle: 0,
        openAngle: -side * 1.1,
      });
      car.glazing.push(window);
    }
  }
  const saved = this.g.sim.s.vehicleDamage?.[car.id];
  if (Number.isFinite(saved?.health)) {
    car.health = THREE.MathUtils.clamp(saved.health, 10, 100);
    if (car.health < 70) {
      car.glassBroken = true;
      for (const glass of car.glazing) {
        glass.visible = false;
        glass.userData.suppressed = true;
      }
    }
    // Keeps the existing deformation routine; restored damage makes no glass-break sound.
    this.damage(car, 0, false);
  }
}

/** Direct replacement. Optional worldPoint selects the exit-side door. */
export function openDoor(car, open, worldPoint = null) {
  this.detail(car);
  if (!car.doors?.length) return false;
  if (!open) {
    for (const door of car.doors) door.target = door.closedAngle || 0;
    return true;
  }
  let side = -1; // Locomotion.board() currently approaches the driver's left side.
  if (worldPoint) {
    car.mesh.updateWorldMatrix(true, false);
    side =
      car.mesh.worldToLocal(new THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z)).x < 0
        ? -1
        : 1;
  }
  const door = car.doors.find((d) => d.front && d.side === side) || car.doors[0];
  door.target = door.openAngle;
  return true;
}

function newDriver(car, role) {
  const officer = role === 'officer';
  const actor = human({
    jacket: officer ? '#233947' : '#235565',
    pants: officer ? '#253744' : '#1f303d',
    hair: '#533d32',
  });
  actor.name = role + ' seated vehicle visual';
  // The human rig is deliberately tall-headed. A cabin-sized proxy fits below glass/roof
  // without moving or rescaling the physical world.player or the outside officer.
  const scale =
    car.type === 'police' ? 0.7 : car.type === 'bus' || car.type === 'van' ? 0.82 : 0.74;
  actor.scale.setScalar(scale);
  const head = new THREE.Group();
  head.name = 'Driving head';
  head.position.set(0, 1.43, 0);
  const headParts = actor.children.filter((n) => n.isMesh && n.position.y >= 1.42);
  actor.add(head);
  for (const part of headParts) {
    actor.remove(part);
    part.position.y -= 1.43;
    head.add(part);
  }
  actor.userData.driveHead = head;
  actor.userData.driverRole = role;
  actor.userData.vehicleVisual = true;
  actor.visible = false;
  car.mesh.add(actor);
  return actor;
}

// Rig-specific two-bone arm IK. Upper arm ends at Fore.position; the hand is (0,-.30,0).
function handTo(actor, arm, fore, carLocalTarget, elbowSide) {
  const target = carLocalTarget.clone().applyMatrix4(actor.matrix.clone().invert());
  const shoulder = arm.position.clone(),
    upperRest = fore.position.clone();
  const length1 = upperRest.length(),
    length2 = 0.3;
  const direction = target.clone().sub(shoulder),
    rawLength = direction.length();
  if (rawLength < 0.0001) return;
  direction.divideScalar(rawLength);
  const length = THREE.MathUtils.clamp(
    rawLength,
    Math.abs(length1 - length2) + 0.001,
    length1 + length2 - 0.002,
  );
  const cosine = THREE.MathUtils.clamp(
    (length1 * length1 + length * length - length2 * length2) / (2 * length1 * length),
    -1,
    1,
  );
  const pole = new THREE.Vector3(elbowSide * 0.28, -1, -0.09);
  pole.addScaledVector(direction, -pole.dot(direction)).normalize();
  const upperDirection = direction
    .clone()
    .multiplyScalar(cosine)
    .addScaledVector(pole, Math.sqrt(1 - cosine * cosine));
  const elbow = shoulder.clone().addScaledVector(upperDirection, length1);
  arm.quaternion.setFromUnitVectors(upperRest.normalize(), upperDirection.normalize());
  const lowerDirection = shoulder
    .clone()
    .addScaledVector(direction, length)
    .sub(elbow)
    .applyQuaternion(arm.quaternion.clone().invert())
    .normalize();
  fore.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), lowerDirection);
}

/** Call AFTER generic human animation if another system animates this proxy. */
export function poseDriver(car, actor, time = 0, steering = 0, speed = 0) {
  const rig = actor.userData.rig;
  if (!rig) return;
  const isPolice = car.type === 'police',
    tall = car.type === 'bus' || car.type === 'van';
  const seat =
    car.mesh.userData.driverSeat?.clone() ||
    new THREE.Vector3(tall ? -0.53 : -0.4, tall ? 1.08 : 0.8, tall ? 0.65 : -0.13);
  // Hips sit slightly into the cushion and towards its front; knees stay inside the footwell.
  seat.y -= isPolice ? 0.06 : 0.045;
  seat.z += isPolice ? 0.14 : 0.1;
  const lean = -0.075 + Math.sin(time * 1.65) * 0.005;
  actor.rotation.set(lean, 0, Math.sin(time * 1.7) * 0.003);
  const hipOffset = new THREE.Vector3(0, 0.86, 0)
    .multiply(actor.scale)
    .applyQuaternion(actor.quaternion);
  actor.position.copy(seat).sub(hipOffset);
  rig.leftLeg.rotation.set(-1.31, 0.01, -0.035);
  rig.rightLeg.rotation.set(-1.27 - Math.min(Math.abs(speed), 20) * 0.0015, -0.01, 0.035);
  rig.leftShin.rotation.set(1.13, 0, 0);
  rig.rightShin.rotation.set(1.07, 0, 0);
  actor.updateMatrix();
  const turn = THREE.MathUtils.clamp(steering, -1, 1) * 0.42;
  const wheel = isPolice
    ? new THREE.Vector3(-0.45, 1.04, 0.82)
    : new THREE.Vector3(seat.x, seat.y + 0.3, seat.z + 0.4);
  for (const side of [-1, 1]) {
    const grip = wheel
      .clone()
      .add(
        new THREE.Vector3(
          side * 0.107 * Math.cos(turn),
          side * 0.107 * Math.sin(turn) * 0.93,
          -side * 0.107 * Math.sin(turn) * 0.37,
        ),
      );
    handTo(
      actor,
      side < 0 ? rig.leftArm : rig.rightArm,
      side < 0 ? rig.leftFore : rig.rightFore,
      grip,
      side,
    );
  }
  const head = actor.userData.driveHead;
  if (head) head.rotation.set(-0.02, steering * 0.1 + Math.sin(time * 0.37) * 0.012, 0);
  actor.updateMatrixWorld(true);
}

/** One visible seated proxy per car; refuses to duplicate the same outside actor. */
export function syncDriver(
  car,
  {
    occupied = false,
    role = 'player',
    outsideActor = null,
    time = 0,
    steering = 0,
    speed = 0,
  } = {},
) {
  car.driverVisuals ||= new Map();
  for (const actor of car.driverVisuals.values()) actor.visible = false;
  // If the actual player or the same officer is outside/boarding, do not also show them seated.
  if (!occupied || !car.mesh.visible || outsideActor?.visible) return null;
  let actor = car.driverVisuals.get(role);
  if (!actor) {
    actor = newDriver(car, role);
    car.driverVisuals.set(role, actor);
  }
  actor.visible = true;
  poseDriver(car, actor, time, steering, speed);
  return actor;
}
