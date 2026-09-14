import * as THREE from 'three';

// Keep the light layout stable from the very first frame. Adding a pair of lights
// on every first entry used to recompile all visible city material programs.
export class VehicleLighting {
  constructor(world) {
    this.world = world;
    this.car = null;
    this.point = new THREE.Vector3();
    this.lights = [-1, 1].map((side) => {
      const light = new THREE.SpotLight('#fff0cb', 0, 27, 0.42, 0.65, 1.5);
      light.name = `Shared vehicle headlamp ${side}`;
      light.userData.side = side;
      light.castShadow = false;
      // Intensity, rather than visibility/parent, switches the pair off. Even in
      // the office they remain in the scene's light list with zero contribution.
      world.scene.add(light, light.target);
      return light;
    });
  }

  update(car) {
    const active =
      car &&
      this.world.zone === 'city' &&
      car.mesh.visible &&
      !['bike', 'helicopter'].includes(car.type);
    this.car = active ? car : null;
    if (!active || !car.headlights) {
      for (const light of this.lights) light.intensity = 0;
      return;
    }
    car.mesh.updateWorldMatrix(true, false);
    const tall = car.type === 'bus';
    const front = (car.length || (tall ? 8.5 : car.type === 'van' ? 5.3 : 4.4)) / 2 - 0.05;
    for (const light of this.lights) {
      const side = light.userData.side;
      light.position.copy(
        this.point
          .set(side * (tall ? 0.95 : 0.64), tall ? 1.03 : 0.82, front)
          .applyMatrix4(car.mesh.matrixWorld),
      );
      light.target.position.copy(
        this.point.set(side * 0.64, 0, front + 18).applyMatrix4(car.mesh.matrixWorld),
      );
      light.intensity = 12;
    }
  }
}
