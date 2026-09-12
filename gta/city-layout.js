// Game-space metres. Looking out of the BBE door faces -Z: left is -X.
// These anchors are shared by the world, navigation and phone, not GPS coordinates.
export const CITY_LAYOUT = Object.freeze({
  hq: Object.freeze({ x: 31, z: 45.2 }),
  hqDoor: Object.freeze({ x: 31, z: 48 }),
  hqBuilding: Object.freeze({ x: 41, z: 60 }),
  augustenCorner: Object.freeze({ x: 11, z: 45.2 }),
  koenigsplatzApproach: Object.freeze({ x: 131, z: 45.2 }),
  koenigsplatz: Object.freeze({ x: 131, z: 29 }),
  courtyard: Object.freeze({ x: 76, z: 55 }),
  garageExit: Object.freeze({ x: 76, z: 48 }),
  balcony: Object.freeze({ x: 55, y: 9.23, z: 44 }),
});

export const CITY_WALKS = Object.freeze({
  augusten: [CITY_LAYOUT.hq, CITY_LAYOUT.augustenCorner],
  koenigsplatz: [CITY_LAYOUT.hq, CITY_LAYOUT.koenigsplatzApproach, CITY_LAYOUT.koenigsplatz],
  frauenkirche: [
    CITY_LAYOUT.koenigsplatz,
    { x: 204, z: 29 },
    { x: 204, z: 45.2 },
    { x: 239, z: 45.2 },
    { x: 239, z: 269 },
    { x: 280, z: 269 },
    { x: 280, z: 249 },
  ],
});

// Continuous pedestrian surfaces. The crossing segments get road-level markings.
export const CITY_FOOTWAYS = [
  { x: 41, z: 47, w: 36, d: 5 },
  { x: 124, z: 45.2, w: 232, d: 2.3 },
  { x: 131, z: 30.75, w: 3, d: 8.5 },
  { x: 167.5, z: 29, w: 76, d: 3 },
  { x: 204, z: 37.1, w: 3, d: 16.2 },
  { x: 239, z: 158, w: 3, d: 225 },
  { x: 265, z: 269, w: 50, d: 3 },
  { x: 280, z: 258.5, w: 3, d: 20 },
];
