import * as THREE from 'three';

export const COFFEE_REACH = Object.freeze({
  gripX: .28, gripY: .0285, palmY: -.30, reserve: .004, maxLean: .12,
  kitchen: Object.freeze({ x: 9.15, z: 7.65, yaw: 0, trayX: 9.15, trayY: .974, trayZ: 8.145 }),
  meeting: Object.freeze({ x: 5.385, z: -.70, yaw: Math.PI / 2, trayX: 5.96, trayY: .864, trayZ: -.70, lean: .10 }),
});
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/** Analytic two-bone arm pose using the real rig offsets. It owns no input,
 * actor translation, physics, time or animation state. Both palms follow the
 * actual tray handles; it never stretches a limb to conceal unreachable targets.
 * Call release() BEFORE ordinary character animation, and apply() AFTER it.
 * During initial reach keep the tray stationary and raise blend from 0 to 1.
 * Only move the tray after blend=1 and result.maxError <= .003.
 */
export class CoffeeTrayGrip {
  constructor(player) {
    this.player = player;
    this.playerBefore = new THREE.Quaternion();
    this.playerApplied = new THREE.Quaternion();
    this.leanQ = new THREE.Quaternion();
    this.rightAxis = new THREE.Vector3(1, 0, 0);
    this.inversePlayer = new THREE.Matrix4();
    this.targetWorld = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.bend = new THREE.Vector3();
    this.elbow = new THREE.Vector3();
    this.foreDirection = new THREE.Vector3();
    this.inverseArmQ = new THREE.Quaternion();
    this.palm = new THREE.Vector3();
    this.playerOwned = false;
    this.owned = false;
    this.disposed = false;
    const rig = player.userData.rig;
    this.arms = [-1, 1].map((sign) => {
      const arm = rig[sign < 0 ? 'leftArm' : 'rightArm'];
      const fore = rig[sign < 0 ? 'leftFore' : 'rightFore'];
      const upper = fore.position.clone();
      return { sign, arm, fore, length: upper.length(), upperUnit: upper.normalize(),
        lowerUnit: new THREE.Vector3(0, -1, 0),
        armBefore: new THREE.Quaternion(), foreBefore: new THREE.Quaternion(),
        armGoal: new THREE.Quaternion(), foreGoal: new THREE.Quaternion(),
        armApplied: new THREE.Quaternion(), foreApplied: new THREE.Quaternion(),
      };
    });
    this.result = { reachable: false, maxError: Infinity, leftDistance: 0, rightDistance: 0 };
  }
  apply(tray, blend = 1, lean = 0) {
    this.release();
    const out = this.result;
    out.reachable = false; out.maxError = Infinity;
    if (this.disposed || !tray || !Number.isFinite(blend) || !Number.isFinite(lean)) return out;
    blend = clamp(blend, 0, 1); lean = clamp(lean, -COFFEE_REACH.maxLean, COFFEE_REACH.maxLean);
    this.playerBefore.copy(this.player.quaternion);
    for (const a of this.arms) {
      a.armBefore.copy(a.arm.quaternion); a.foreBefore.copy(a.fore.quaternion);
    }
    if (lean) {
      this.leanQ.setFromAxisAngle(this.rightAxis, lean);
      this.player.quaternion.multiply(this.leanQ);
      this.playerApplied.copy(this.player.quaternion);
      this.playerOwned = true;
    }
    this.player.updateWorldMatrix(true, true);
    tray.updateWorldMatrix(true, false);
    this.inversePlayer.copy(this.player.matrixWorld).invert();
    for (const a of this.arms) {
      this.targetWorld.set(a.sign * COFFEE_REACH.gripX, COFFEE_REACH.gripY, 0).applyMatrix4(tray.matrixWorld);
      this.target.copy(this.targetWorld).applyMatrix4(this.inversePlayer).sub(a.arm.position);
      const distance = this.target.length(), upper = a.length, lower = -COFFEE_REACH.palmY;
      out[a.sign < 0 ? 'leftDistance' : 'rightDistance'] = distance;
      if (!Number.isFinite(distance) || distance > upper + lower - COFFEE_REACH.reserve ||
        distance < Math.abs(upper - lower) + COFFEE_REACH.reserve) {
        this.release();
        this.player.updateWorldMatrix(true, true);
        return out;
      }
      this.direction.copy(this.target).multiplyScalar(1 / distance);
      // Downward, slightly outward elbows stay away from the torso. Projection
      // onto the plane normal to the target gives a stable anatomical bend plane.
      this.bend.set(a.sign * .18, -1, 0);
      this.bend.addScaledVector(this.direction, -this.bend.dot(this.direction));
      if (this.bend.lengthSq() < 1e-8) {
        this.bend.set(a.sign, 0, 0);
        this.bend.addScaledVector(this.direction, -this.bend.dot(this.direction));
      }
      this.bend.normalize();
      const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
      const height = Math.sqrt(Math.max(0, upper * upper - along * along));
      this.elbow.copy(this.direction).multiplyScalar(along).addScaledVector(this.bend, height);
      a.armGoal.setFromUnitVectors(a.upperUnit, this.direction.copy(this.elbow).normalize());
      this.inverseArmQ.copy(a.armGoal).invert();
      this.foreDirection.copy(this.target).sub(this.elbow).applyQuaternion(this.inverseArmQ).normalize();
      a.foreGoal.setFromUnitVectors(a.lowerUnit, this.foreDirection);
    }
    for (const a of this.arms) {
      a.arm.quaternion.copy(a.armBefore).slerp(a.armGoal, blend);
      a.fore.quaternion.copy(a.foreBefore).slerp(a.foreGoal, blend);
      a.armApplied.copy(a.arm.quaternion); a.foreApplied.copy(a.fore.quaternion);
    }
    this.owned = true;
    this.player.updateWorldMatrix(true, true);
    out.reachable = true; out.maxError = 0;
    for (const a of this.arms) {
      a.fore.localToWorld(this.palm.set(0, COFFEE_REACH.palmY, 0));
      this.targetWorld.set(a.sign * COFFEE_REACH.gripX, COFFEE_REACH.gripY, 0).applyMatrix4(tray.matrixWorld);
      out.maxError = Math.max(out.maxError, this.palm.distanceTo(this.targetWorld));
    }
    return out;
  }
  release() {
    if (this.owned) for (const a of this.arms) {
      if (a.arm.quaternion.equals(a.armApplied)) a.arm.quaternion.copy(a.armBefore);
      if (a.fore.quaternion.equals(a.foreApplied)) a.fore.quaternion.copy(a.foreBefore);
    }
    if (this.playerOwned && this.player.quaternion.equals(this.playerApplied))
      this.player.quaternion.copy(this.playerBefore);
    this.owned = false; this.playerOwned = false;
  }
  dispose() { this.release(); this.disposed = true; }
}