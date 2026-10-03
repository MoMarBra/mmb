import {
  normalizeOfficeMemory, reconcileOfficeMemory, nextMemoryNotice,
  acknowledgeMemory, officeMemoryMask,
} from './office-memory-state.js';

export const MEMORY_BOARD_LOCATION = Object.freeze({ x: -13.32, y: 1.85, z: 3, yaw: Math.PI / 2 });

/** Event-driven state plus a 2 Hz, six-flag fallback for older bird/Pfand code paths. */
export class OfficeMemory {
  constructor(game, view, { now = () => performance.now(), present, hidden = () => globalThis.document?.hidden === true } = {}) {
    this.game = game;
    this.view = view;
    this.now = now;
    this.hidden = hidden;
    this.present = present || ((entry, context) => this.presentDefault(entry, context));
    this.presenting = null;
    this.nextCheckAt = 0;
    this.nextNoticeAt = 0;
    this.nearSince = null;
    this.disposed = false;
    this.mask = -1;
    this.stateOwner = null;
    this.listener = (event) => {
      if (event.type === 'mission-complete') this.sync();
    };
    this.game.sim.listeners.push(this.listener);
    this.sync();
  }
  cancelPresentation() {
    const pending = this.presenting, voices = this.game.audio?.voices;
    this.presenting = null;
    // Only our exact loading/playing line may be cancelled. Never stop a newer story voice.
    if (pending && Number.isSafeInteger(pending.voiceToken) && voices?.token === pending.voiceToken &&
        voices.current?.line?.id === pending.entry.voiceId) voices.stop(false);
  }
  sync() {
    if (this.disposed) return;
    const sim = this.game.sim;
    if (this.stateOwner !== sim.s) {
      this.cancelPresentation();
      this.stateOwner = sim.s;
      sim.s.officeMemory = normalizeOfficeMemory(sim.s.officeMemory, sim.s);
      this.mask = -1;
      this.nearSince = null;
      this.nextNoticeAt = 0;
    }
    const result = reconcileOfficeMemory(sim.s.officeMemory, sim.s);
    if (result.state !== sim.s.officeMemory) {
      sim.s.officeMemory = result.state;
      sim.save();
    }
    const mask = officeMemoryMask(sim.s.officeMemory);
    if (mask !== this.mask) {
      this.mask = mask;
      this.view?.refresh(sim.s.officeMemory);
    }
  }
  ready(allowOwnVoice = false) {
    const g = this.game, w = g.world, voices = g.audio?.voices;
    const ownVoice = allowOwnVoice && this.presenting && Number.isSafeInteger(this.presenting.voiceToken) &&
      voices?.token === this.presenting.voiceToken && voices.current?.line?.id === this.presenting.entry.voiceId;
    // Use live chapter flags, not ordinary accepted BBE jobs in s.active.
    const storyPlaying = g.fireStory?.running ||
      (g.fireStory?.enabled && g.fireStory?.active) ||
      (g.workshop?.enabled && g.workshop?.active) ||
      (g.campaign?.enabled && g.sim.s.bbeCampaign?.active?.phase === 'play') ||
      !!g.campaign?.panel || g.origin?.active || g.sim.s.courier?.active;
    return g.started && w?.zone === 'office' && !this.hidden() && !storyPlaying &&
      !g.modal && !g.busy && !g.cinematic && !g.quizssoir?.active && !g.blast?.active &&
      !g.missionPassed?.active && !g.missionPassed?.queue?.length &&
      (!voices?.current || ownVoice) && !voices?.queue?.length && !voices?.arrival &&
      !g.arcade?.vehicle && !(g.sim.s.wanted > 0) &&
      this.now() >= (g.worldTransitionUntil || 0);
  }
  update(time = this.now()) {
    if (this.disposed || time < this.nextCheckAt) return;
    this.nextCheckAt = time + 500;
    this.sync();
    if (this.presenting) return;
    if (!this.ready()) { this.nearSince = null; return; }
    const p = this.game.world.player?.position;
    // Let the return to the familiar workspace, not a remote achievement popup, deliver it.
    const near = p && Math.hypot(p.x + 8, p.z - 1) <= 5;
    if (!near) { this.nearSince = null; return; }
    if (this.nearSince === null) this.nearSince = time;
    if (time - this.nearSince < 2500 || time < this.nextNoticeAt) return;
    const entry = nextMemoryNotice(this.game.sim.s.officeMemory);
    if (!entry) return;
    const pending = { entry, owner: this.game.sim.s, voiceToken: null };
    this.presenting = pending;
    const context = { current: () => !this.disposed && this.presenting === pending && this.game.sim.s === pending.owner };
    try {
      const result = this.present(entry, context);
      if (result && typeof result.then === 'function') {
        Promise.resolve(result).then(
          (accepted) => this.finishPresentation(pending, accepted),
          () => this.finishPresentation(pending, false),
        );
      } else this.finishPresentation(pending, result);
    } catch {
      this.finishPresentation(pending, false);
    }
  }
  finishPresentation(pending, accepted) {
    if (this.presenting !== pending) return;
    if (this.disposed || accepted !== true || this.game.sim.s !== pending.owner) {
      this.cancelPresentation();
      return;
    }
    this.presenting = null;
    const sim = this.game.sim, previous = sim.s.officeMemory;
    const next = acknowledgeMemory(previous, pending.entry.id);
    if (next === previous) return;
    sim.s.officeMemory = next;
    sim.save();
    this.nextNoticeAt = this.now() + 90000;
  }
  presentDefault(entry, context) {
    const g = this.game, voices = g.audio?.voices;
    const voiced = g.audio?.enabled && g.audio?.ready && voices?.resolve?.('player', 'office_memory', entry.voiceId);
    if (voiced) {
      // say() can resolve false after a cooldown, suspended mix or replacement token.
      // Its true result confirms this exact line made it through the async audio loader.
      const pending = this.presenting;
      const result = voices.say('player', 'office_memory', { id: entry.voiceId, priority: 0, ambient: true });
      if (this.presenting && voices.current?.line?.id === entry.voiceId) this.presenting.voiceToken = voices.token;
      return Promise.resolve(result).then((accepted) => {
        if (accepted !== true || !context.current() || !this.ready(true)) {
          if (this.presenting === pending) this.cancelPresentation();
          return false;
        }
        g.toast(entry.title);
        return true;
      });
    }
    // Muted/unavailable audio uses an honest short text and can confirm immediately.
    g.toast(entry.title, entry.line);
    return true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelPresentation();
    const list = this.game.sim.listeners, index = list.indexOf(this.listener);
    if (index >= 0) list.splice(index, 1);
    this.view?.dispose();
  }
}
