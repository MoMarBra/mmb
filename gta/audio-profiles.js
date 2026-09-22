import { GARAGE_PROFILE, GARAGE_SFX, GARAGE_SOURCES } from './garage-audio.js';
// Each interior has its own physical sound sources, materials and room response.
export const ROOMS = {
  home: {
    title: 'Zuhause · Morgenruhe',
    material: 'wood',
    reverb: 0.12,
    tone: 6200,
    loops: [['wind', 0.018]],
    events: ['bird'],
    interval: 18,
  },
  zitronengras: {
    title: 'Zitronengras · Wok & Service',
    material: 'tile',
    reverb: 0.16,
    tone: 8600,
    loops: [
      ['boil', 0.11],
      ['vent', 0.04],
    ],
    events: ['chop', 'pot', 'dishes'],
    interval: 4.8,
  },
  city: {
    title: 'Augustenstraße · draußen',
    material: 'concrete',
    reverb: 0.025,
    tone: 15000,
    loops: [
      ['traffic', 0.2],
      ['wind', 0.07],
    ],
    events: ['bird', 'bike-bell', 'footstep-concrete'],
    interval: 8,
  },
  garage: GARAGE_PROFILE,
  it: {
    title: 'BBE · IT / Serverraum',
    material: 'tile',
    reverb: 0.15,
    tone: 3900,
    loops: [['vent', 0.13]],
    events: ['typing'],
    interval: 18,
  },
  office: {
    title: 'BBE · Büro',
    material: 'carpet',
    reverb: 0.1,
    tone: 7500,
    loops: [['vent', 0.055]],
    events: ['typing', 'paper', 'print', 'phone'],
    interval: 4.8,
  },
  kitchen: {
    title: 'BBE · Kaffeeküche',
    material: 'wood',
    reverb: 0.16,
    tone: 8800,
    loops: [['vent', 0.045]],
    events: ['dishes', 'coffee', 'glass'],
    interval: 6.8,
  },
  wc: {
    title: 'BBE · Sanitärbereich',
    material: 'tile',
    reverb: 0.36,
    tone: 11000,
    loops: [['vent', 0.08]],
    events: ['water-drip'],
    interval: 7.2,
  },
  seen: {
    title: 'SEEN · leise Gespräche, Wok & Porzellan',
    material: 'wood',
    reverb: 0.14,
    tone: 6500,
    loops: [
      ['boil', 0.085],
      ['vent', 0.025],
    ],
    events: ['dishes', 'chop', 'glass'],
    interval: 6.5,
  },
  bao: {
    title: 'MAMMA BAO · Dampf, Nudelküche & Geschirr',
    material: 'tile',
    reverb: 0.2,
    tone: 10000,
    loops: [['boil', 0.14]],
    events: ['chop', 'pot', 'dishes'],
    interval: 4.0,
  },
  palm: {
    title: 'PALMTREECLUB · Espresso & entspannte Pause',
    material: 'wood',
    reverb: 0.1,
    tone: 6800,
    loops: [['vent', 0.04]],
    events: ['coffee', 'glass', 'dishes'],
    interval: 6.4,
  },
  gyoza: {
    title: 'GYOZA BAR · Pfannen, Tee & Küchenbetrieb',
    material: 'tile',
    reverb: 0.18,
    tone: 8400,
    loops: [
      ['boil', 0.1],
      ['fire', 0.045],
    ],
    events: ['pot', 'chop', 'dishes'],
    interval: 5.3,
  },
  wirt: {
    title: 'Wirtshaus · Holz, Gläser & Geselligkeit',
    material: 'wood',
    reverb: 0.24,
    tone: 9500,
    loops: [['vent', 0.03]],
    events: ['glass', 'dishes', 'chair'],
    interval: 3.8,
  },
  mentors: {
    title: 'MENTOR’S · Holzofen, Besteck & Bar',
    material: 'tile',
    reverb: 0.19,
    tone: 7800,
    loops: [['fire', 0.15]],
    events: ['pot', 'dishes', 'glass'],
    interval: 5.4,
  },
};
export function roomFor(world) {
  if (world.zone === 'home' || world.zone === 'zitronengras') return world.zone;
  if (world.zone === 'brewery') return 'wirt';
  if (world.zone === 'restaurant')
    return world.currentRestaurant?.id === 'dogtown'
      ? 'mentors'
      : world.currentRestaurant?.id || 'seen';
  if (world.zone === 'city') return 'city';
  const p = world.player.position;
  if (p.x < -13.5) return 'it';
  if (p.x > 44 && p.x < 71 && p.z > 28 && p.z < 48) return 'garage';
  if (p.x > 22 && p.z > 15) return 'wc';
  if (p.x > 4 && p.x < 16 && p.z > 3) return 'kitchen';
  return 'office';
}
export const SOURCES = {
  ...GARAGE_SOURCES,
  typing: [-5, 1, -3],
  paper: [4, 1, -5],
  print: [16, 1, -2],
  phone: [-7, 1.2, 1],
  coffee: [9, 1, 6],
  'water-drip': [35, 0.9, 24],
};
export const SFX = {
  ...GARAGE_SFX,
  'footstep-carpet': [
    'footstep_carpet_000',
    'footstep_carpet_001',
    'footstep_carpet_002',
    'footstep_carpet_003',
    'footstep_carpet_004',
  ],
  'footstep-concrete': [
    'footstep_concrete_000',
    'footstep_concrete_001',
    'footstep_concrete_002',
    'footstep_concrete_003',
    'footstep_concrete_004',
  ],
  'footstep-wood': [
    'footstep_wood_000',
    'footstep_wood_001',
    'footstep_wood_002',
    'footstep_wood_003',
    'footstep_wood_004',
  ],
  'footstep-grass': [
    'footstep_grass_000',
    'footstep_grass_001',
    'footstep_grass_002',
    'footstep_grass_003',
    'footstep_grass_004',
  ],
  'footstep-tile': [
    'footstep_tile_000',
    'footstep_tile_001',
    'footstep_tile_002',
    'footstep_tile_003',
    'footstep_tile_004',
  ],
  punch: ['impactPunch_medium_000', 'impactPunch_medium_001', 'impactPunch_medium_002'],
  crash: ['impactMetal_heavy_000', 'impactMetal_heavy_001', 'impactMetal_heavy_002'],
  bottle: ['glass_01', 'glass_02', 'glass_03'],
  glass: ['glass_01', 'glass_02', 'glass_03'],
  dishes: ['dishes_01', 'dishes_02', 'dishes_03', 'dishes_04'],
  pot: ['pot_01', 'pot_02'],
  paper: ['paper_01', 'paper_02', 'paper_03'],
  print: ['machine_01', 'machine_02'],
  vending: ['machine_03', 'microwave_door_close'],
  door: ['door_close_01', 'door_close_02', 'door_close_03'],
  'car-door': ['car_door_close'],
  'car-open': ['car_door_open'],
  'engine-start': ['engine_start'],
  flush: ['toilet_01', 'toilet_02'],
  wash: ['wash'],
  water: ['wash'],
  coffee: ['coffee'],
  typing: ['typing_01', 'typing_02', 'typing_03'],
  chop: ['chop'],
  kick: ['impactSoft_medium_000', 'impactSoft_medium_001'],
  dart: ['impactWood_light_000', 'impactWood_light_001'],
  chair: ['impactWood_light_002', 'impactWood_light_001'],
};
