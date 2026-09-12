export function isGarage(world) {
  const p = world?.player?.position;
  return world?.zone === 'office' && !!p && p.x >= 44 && p.x <= 70 && p.z >= 29 && p.z <= 47;
}

export const GARAGE_PROFILE = {
  title: 'BBE · Tiefgarage · Beton, Lüftung & ferne Fahrzeuge',
  material: 'concrete',
  reverb: 0, // Crossfade the ordinary short room reverb out; garage hall below replaces it.
  tone: 3800,
  loops: [], // Positioned, differently filtered loops are maintained below.
  events: ['garage-door', 'garage-engine-start'],
  interval: 24,
};

export const GARAGE_SFX = {
  'garage-door': ['car_door_close'],
  'garage-engine-start': ['engine_start', 'engine_start_alt'],
};
export const GARAGE_SOURCES = {
  'garage-door': [64, 1, 43],
  'garage-engine-start': [66, 0.8, 42],
};

function garageImpulse(context) {
  const seconds = 2.85,
    predelay = 0.028;
  const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  let seed = 67311;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let smooth = 0;
    for (let i = Math.floor(context.sampleRate * predelay); i < data.length; i++) {
      const t = i / context.sampleRate - predelay;
      smooth = 0.72 * smooth + 0.28 * random();
      // About 2.25-second RT60, with softened high-frequency diffusion.
      data[i] = smooth * Math.exp((-6.908 * t) / 2.25) * 0.23;
    }
    for (const [time, gain] of [
      [0.047, 0.52],
      [0.083, 0.31],
      [0.127, 0.21],
      [0.191, 0.12],
    ])
      data[Math.floor((time + channel * 0.003) * context.sampleRate)] += gain;
  }
  return buffer;
}

function createGarageHall(audio) {
  const c = audio.ctx,
    input = c.createGain(),
    convolver = c.createConvolver(),
    tone = c.createBiquadFilter();
  input.gain.value = 0;
  convolver.buffer = garageImpulse(c);
  tone.type = 'lowpass';
  tone.frequency.value = 4300;
  tone.Q.value = 0.5;
  audio.buses.effects.connect(input);
  audio.buses.dialogue.connect(input);
  input.connect(convolver).connect(tone).connect(audio.sceneGate);
  return { input, convolver, tone };
}

export function updateGarageAudio(audio, world, active) {
  if (!audio.ready) return;
  const here = isGarage(world),
    audible = here && active && audio.enabled;
  if (here && !audio.garageHall) audio.garageHall = createGarageHall(audio);
  if (audio.garageHall)
    audio.garageHall.input.gain.setTargetAtTime(audible ? 0.26 : 0, audio.ctx.currentTime, 0.5);
  if (!audible) return;
  // Ventilation over the parking area, muffled street leakage at the actual exit.
  // These are INTERNAL frame-maintained loops: call after target reset, use loop().
  audio.loop('garage-ventilation', 'vent', 0.115, {
    bus: 'ambience',
    position: [56, 3.2, 39],
    refDistance: 8,
    lowpass: 420,
    fade: 0.9,
  });
  audio.loop('garage-distant-cars', 'traffic', 0.11, {
    bus: 'ambience',
    position: [57, 1.8, 28.8],
    refDistance: 5,
    lowpass: 720,
    fade: 1.1,
  });
}

export function disposeGarageAudio(audio) {
  const hall = audio.garageHall;
  if (!hall) return;
  audio.buses.effects.disconnect(hall.input);
  audio.buses.dialogue.disconnect(hall.input);
  hall.input.disconnect();
  hall.convolver.disconnect();
  hall.tone.disconnect();
  audio.garageHall = null;
}

// Also replace the generic rain target inside Soundscape.update with:
//   rain ? (room === 'city' ? 0.27 : room === 'garage' ? 0.006 : 0.045) : 0
// The separately requested window-rain effect should use isGarage(world),
// instead of player.x > 44 (which also incorrectly muffles some restaurants).
// In the garage use at most 0.008 for window-rain, or omit that layer entirely:
// its current .035 target sounds like rain on a nearby window below ground.
