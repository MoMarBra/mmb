/** Per-vehicle manual choice, owned by one concrete save. No rendering, timers,
 * storage writes, events or per-frame allocation. Minutes are sampled only when
 * the integer minute changes; the existing smoothed cloud value supplies rain.
 */
export class VehicleHeadlightPolicy {
  constructor() {
    this.owner = null;
    this.choices = new WeakMap();
    this.minute = NaN;
    this.dark = false;
    this.rain = false;
  }
  supports(car) {
    return !!car && car.controlled === true && car.type !== 'bike' && car.type !== 'helicopter';
  }
  bind(owner) {
    if (owner === this.owner) return;
    this.owner = owner;
    this.choices = new WeakMap();
    this.minute = NaN;
    this.dark = false;
    this.rain = false;
  }
  toggle(car, owner) {
    if (!this.supports(car)) return false;
    this.bind(owner);
    const choice = !car.headlights;
    this.choices.set(car, choice);
    car.headlights = choice;
    return true;
  }
  update(car, owner, cloud) {
    if (!this.supports(car)) return false;
    this.bind(owner);
    let needed;
    if (this.choices.has(car)) needed = this.choices.get(car);
    else {
      const minute = Number.isFinite(owner?.minutes) ? Math.floor(((owner.minutes % 1440) + 1440) % 1440) : 497;
      if (minute !== this.minute) {
        const daylight = Math.max(.06, Math.min(1, Math.sin(((minute - 360) / 1440) * Math.PI * 2) * 1.4));
        // Matches the existing daylight curve. A small hysteresis prevents a
        // light switch from flickering around dawn/dusk or timeline adjustments.
        this.dark = this.dark ? daylight < .42 : daylight <= .30;
        this.minute = minute;
      }
      const rain = Number.isFinite(cloud) ? Math.max(0, Math.min(1, cloud)) : owner?.weather === 'Regen' ? 1 : 0;
      this.rain = this.rain ? rain > .35 : rain >= .60;
      needed = this.dark || this.rain;
    }
    if (!!car.headlights === needed) return false;
    car.headlights = needed;
    return true;
  }
}