import { AUDIO_ASSETS } from './audio-catalog.js';

export class Soundtrack {
  constructor(audio, sim) {
    this.audio = audio;
    this.sim = sim;
    this.current = null;
    this.request = 0;
    this.preview = false;
  }
  get station() {
    return this.sim.s.musicStation || 0;
  }
  set station(value) {
    this.sim.s.musicStation = Math.min(2, Math.max(0, Math.floor(value)));
    this.sim.s.musicAuto = false;
    this.sim.save();
  }
  toggle() {
    this.sim.s.music = !this.sim.s.music;
    this.sim.save();
    return this.sim.s.music;
  }
  update(active, zone, driving) {
    const a = this.audio;
    if (!a.ready) return;
    const playing = this.sim.s.music && (active || this.preview) && !document.hidden && a.enabled;
    let station = this.station;
    if (this.sim.s.musicAuto && !this.preview) {
      const id = a.world?.currentRestaurant?.id;
      station = driving
        ? 2
        : zone === 'office'
          ? 0
          : zone === 'restaurant'
            ? { seen: 0, bao: 1, palm: 0, gyoza: 1, wirt: 0, mentors: 2 }[id] || 0
            : 1;
    }
    const id = 'music_' + station;
    if (playing && (this.current?.id !== id || !this.current?.handle) && this.pending !== id)
      this.change(id);
    if (this.current?.handle) {
      const h = this.current.handle,
        t = a.ctx.currentTime;
      const gain = this.preview ? 0.78 : driving ? 0.78 : zone === 'office' ? 0.48 : 0.6;
      h.gain.gain.setTargetAtTime(playing ? gain : 0, t, playing ? 0.65 : 0.13);
      h.filter.frequency.setTargetAtTime(
        this.preview || driving ? 16000 : zone === 'office' ? 5600 : 11500,
        t,
        0.8,
      );
    }
  }
  async change(id) {
    this.pending = id;
    const request = ++this.request,
      a = this.audio;
    const buffer = await a.bank.get(id);
    if (request !== this.request) return;
    this.pending = null;
    if (!buffer) return;
    const handle = a.emit(buffer, { loop: true, bus: 'music', volume: 0, lowpass: 9000 });
    if (!handle) return;
    this.current?.handle?.stop(1.5);
    handle.source.loopEnd = Math.min(buffer.duration, AUDIO_ASSETS[id].duration);
    this.current = { id, handle, title: AUDIO_ASSETS[id].title };
  }
}
