// Render every animation frame. Reduce pixel cost only when sustained frame times miss 60 Hz.
export class IntroPerformance {
  constructor(world) {
    this.w = world;
    this.targetFPS = 60;
    this.level = 0;
    this.samples = 0;
    this.total = 0;
    this.ignore = 20;
    this.recoveries = 0;
    this.active = false;
  }
  ceiling() {
    return Math.min(
      devicePixelRatio || 1,
      1,
      Math.sqrt((1920 * 1080) / Math.max(1, innerWidth * innerHeight)),
    );
  }
  begin() {
    this.active = true;
    this.base = this.ceiling();
    this.apply();
  }
  apply() {
    this.ratio = this.base * [1, 0.9, 0.8, 0.7][this.level];
    if (Math.abs(this.w.renderer.getPixelRatio() - this.ratio) > 0.005)
      this.w.renderer.setPixelRatio(this.ratio);
  }
  cut() {
    this.ignore = 15;
    this.samples = this.total = 0;
  }
  record(seconds, current) {
    if (!this.active || !current || current.loading || current.paused || document.hidden) return;
    const base = this.ceiling();
    if (Math.abs(base - this.base) > 0.005) {
      this.base = base;
      this.apply();
      this.cut();
    }
    // Ignore tab stalls, the first compiled frame and cuts; do not mistake them for sustained load.
    if (seconds <= 0 || seconds > 0.1 || this.ignore-- > 0) return;
    this.total += seconds;
    if (++this.samples < 45) return;
    this.averageMs = (this.total / this.samples) * 1000;
    if (this.averageMs > 17.8 && this.level < 3) {
      this.level++;
      this.recoveries = 0;
      this.apply();
    } else if (this.averageMs < 16.9 && this.level > 0) {
      if (++this.recoveries >= 4) {
        this.level--;
        this.recoveries = 0;
        this.apply();
      }
    } else this.recoveries = 0;
    this.samples = this.total = 0;
  }
  end(pixelRatio) {
    this.active = false;
    this.w.renderer.setPixelRatio(pixelRatio);
  }
}
