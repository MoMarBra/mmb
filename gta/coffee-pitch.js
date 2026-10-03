import * as THREE from 'three';
import { CoffeePitchVisual } from './coffee-pitch-visual.js';
import { CoffeeTrayGrip, COFFEE_REACH } from './coffee-tray-grip.js';
import {
  COFFEE_PITCH,
  normalizeCoffeePitch,
  createCoffeeMotion,
  coffeePitchActionToken,
  startCoffeePitch,
  suspendCoffeePitch,
  resumeCoffeePitch,
  refillCoffeePitch,
  serveCoffeePitch,
  abandonCoffeePitch,
  advanceCoffeePitch,
  finishCoffeePitch,
} from './coffee-pitch-state.js';
import { COFFEE_PITCH_LOCATIONS as LOC } from './coffee-pitch-locations.js';
import { COFFEE_PITCH_VOICE_BINDINGS } from './coffee-pitch-voice-bindings.js';

const ease = (t) => t * t * (3 - 2 * t);
const distance = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
const isLive = (a) => a && ['carry', 'return'].includes(a.phase);

/** One bounded activity; no separate loop, physics body, global input handler or timer.
 * prepareFrame receives RAW frame time before movement. updateWorld runs after the
 * real physics/character animation and before crowd/render. Never use camera yaw.
 */
export class CoffeePitch {
  constructor(
    game,
    {
      view = new CoffeePitchVisual(game.world.groups.office),
      doc = globalThis.document,
      win = globalThis.window,
      hidden = () => globalThis.document?.hidden === true,
      now = () => performance.now(),
      voiceLines = COFFEE_PITCH_VOICE_BINDINGS,
    } = {},
  ) {
    this.g = game;
    this.w = game.world;
    this.view = view;
    this.grip = new CoffeeTrayGrip(this.w.player);
    this.doc = doc;
    this.win = win;
    this.hidden = hidden;
    this.now = now;
    this.voiceLines = voiceLines;
    this.motion = createCoffeeMotion();
    this.owner = null;
    this.state = null;
    this.animation = null;
    this.voice = null;
    this.queuedVoice = null;
    this.effects = new Set();
    this.effectsEpoch = 0;
    this.epoch = 0;
    this.rawDelta = 0;
    this.frozen = true;
    this.focused = true;
    this.disposed = false;
    this.poseOwned = false;
    const rig = this.w.player.userData.rig;
    this.poseParts = [
      ['leftArm', 'x', -0.92],
      ['rightArm', 'x', -0.92],
      ['leftArm', 'z', 0],
      ['rightArm', 'z', 0],
      ['leftFore', 'x', -0.44],
      ['rightFore', 'x', -0.44],
    ].map(([part, axis, value]) => ({ rotation: rig[part].rotation, axis, before: 0, value }));
    this.delivered = [];
    this.lastSpillLine = -Infinity;
    this.leftHand = new THREE.Vector3();
    this.rightHand = new THREE.Vector3();
    this.hand = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.local = new THREE.Vector3();
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.tilt = new THREE.Vector3();
    this.playerQ = new THREE.Quaternion();
    this.trayWorldQ = new THREE.Quaternion();
    this.rootQ = new THREE.Quaternion();
    this.localQ = new THREE.Quaternion();
    this.fromQ = new THREE.Quaternion();
    this.toQ = new THREE.Quaternion();
    this.identity = new THREE.Quaternion();
    this.pauseOptions = { paused: true };
    this.liveOptions = { paused: false };
    this.controlledVelocity = { x: 0, z: 0 };
    this.approachSample = new THREE.Vector3();
    this.targets = {};
    this.blur = () => {
      this.focused = false;
      this.freeze();
    };
    this.focus = () => {
      this.focused = true;
      this.freeze();
    };
    this.visibility = () => {
      this.freeze();
    };
    win?.addEventListener('blur', this.blur);
    win?.addEventListener('focus', this.focus);
    doc?.addEventListener('visibilitychange', this.visibility);
    for (const [at, label] of [
      ['kitchen', 'Kaffee für den Pitch'],
      ['meeting', 'Kaffee abstellen'],
    ]) {
      const p = LOC[at];
      this.w.interact('office', p.id, label, p.x, p.z, { kind: p.id, radius: p.radius });
      this.targets[at] = this.w.zoneData.office.interactions.at(-1);
    }
    this.w.coffeePitch = this;
    this.view.setServedTransform(
      this.local.set(LOC.served.x, LOC.served.y, LOC.served.z),
      this.identity,
    );
    this.bindState();
    this.syncVisual();
  }
  get attempt() {
    return this.state?.attempt;
  }
  get carrying() {
    return !!isLive(this.attempt);
  }
  get holding() {
    return this.carrying || !!this.animation;
  }
  get blocksMovement() {
    return !!this.animation || (this.carrying && !this.focused);
  }

  bindState() {
    if (this.owner === this.g.sim.s && this.state === this.g.sim.s.coffeePitch) return;
    this.cancelPresentation();
    this.stopEffects();
    this.releasePose();
    this.animation = null;
    this.motion = createCoffeeMotion();
    this.owner = this.g.sim.s;
    // Migration normally belongs to Simulation.load. Constructor also supports a
    // pre-integration live save, and every reset/import receives a fresh identity.
    this.owner.coffeePitch = normalizeCoffeePitch(this.owner.coffeePitch);
    this.state = this.owner.coffeePitch;
    this.delivered = this.attempt?.served.slice() || [];
    this.lastSpillLine = -Infinity;
    this.syncTargets();
  }
  storyConflict() {
    const g = this.g;
    return !!(
      g.workshop?.active ||
      g.fireStory?.active ||
      g.origin?.active ||
      g.campaign?.active ||
      g.sim.s.courier?.active ||
      g.quizssoir?.active ||
      g.blast?.active
    );
  }
  handsConflict() {
    const a = this.g.arcade,
      body = this.w.zoneData[this.w.zone]?.body;
    return !!(
      a?.vehicle ||
      a?.punchTime > 0 ||
      a?.immersion?.motion?.action ||
      a?.immersion?.physics?.held ||
      this.g.sim.s.extras?.drunk > 0 ||
      Math.abs(body?.velocity?.y || 0) > 1.5 ||
      this.g.busy ||
      (this.w.pose && this.w.pose !== 'walk')
    );
  }
  available() {
    return (
      this.g.started &&
      this.w.zone === 'office' &&
      !this.g.modal &&
      !this.g.cinematic &&
      !this.hidden() &&
      this.focused &&
      !this.storyConflict() &&
      !this.handsConflict() &&
      this.now() >= (this.g.worldTransitionUntil || 0)
    );
  }
  at(place) {
    const p = LOC[place],
      body = this.w.zoneData.office.body;
    return (
      this.w.zone === 'office' &&
      distance(this.w.player.position, p) <= p.radius + 0.03 &&
      Math.abs((body?.position?.y ?? 0.34) - 0.34) < 0.4
    );
  }
  context(at, token) {
    return {
      ready: this.available() && this.at(at),
      zone: this.w.zone,
      at,
      token,
      clock: this.g.sim.clock,
    };
  }
  freeze(stopAudio = true) {
    this.frozen = true;
    if (this.state)
      advanceCoffeePitch(this.state, this.motion, 0, this.w.player.position, this.pauseOptions);
    if (stopAudio) {
      this.cancelPresentation();
      this.stopEffects();
    }
  }
  prepareFrame(rawDelta) {
    if (this.disposed) return;
    this.grip.release();
    this.bindState();
    this.rawDelta = rawDelta;
    if (this.holding && (this.w.zone !== 'office' || this.storyConflict() || this.handsConflict()))
      this.suspend();
    const unavailable = !this.available();
    this.frozen =
      unavailable ||
      !Number.isFinite(rawDelta) ||
      rawDelta <= 0 ||
      rawDelta > COFFEE_PITCH.maxFrame;
    if (this.frozen) this.freeze(unavailable);
    this.syncTargets();
  }
  syncTargets() {
    const a = this.attempt;
    const unavailable =
      this.w.zone !== 'office' || this.storyConflict() || this.g.sim.s.extras?.drunk > 0;
    this.targets.kitchen.storyAway = unavailable || a?.phase === 'finish';
    this.targets.meeting.storyAway = unavailable || !a || !['carry', 'finish'].includes(a.phase);
    this.targets.kitchen.label = !a
      ? 'Kaffee für den Pitch'
      : a.phase === 'suspended'
        ? 'Tablett wieder aufnehmen'
        : a.phase === 'return'
          ? 'Nächstes Paar eingießen'
          : 'Tassen neu füllen';
    this.targets.meeting.label =
      a?.phase === 'finish' ? 'Pitch-Kaffee abschließen' : 'Kaffee abstellen';
  }
  /** Return false for every foreign target, even when parking our own tray. */
  interact(target) {
    if (this.disposed) return false;
    this.bindState();
    const at =
      target === this.targets.kitchen
        ? 'kitchen'
        : target === this.targets.meeting
          ? 'meeting'
          : null;
    if (!at) {
      if (target && (this.carrying || this.animation)) this.suspend();
      return false;
    }
    if (this.animation || !this.available() || !this.at(at)) return true;
    const a = this.attempt;
    if (at === 'meeting') {
      if (a?.phase === 'finish') this.finish();
      else if (a?.phase === 'carry') {
        if (a.fill[0] + a.fill[1] < 0.1) this.g.toast('Noch einmal zur Kaffeemaschine.');
        else this.beginAnimation('serve', coffeePitchActionToken(this.state));
      }
      return true;
    }
    let result;
    if (!a) {
      result = startCoffeePitch(this.state, this.context('kitchen'));
      if (result.ok) {
        this.delivered = [];
        this.say('coffee_pitch_start');
        this.playEffect('coffee', 0.18);
      }
    } else if (a.phase === 'suspended') {
      result = resumeCoffeePitch(this.state, a.id, this.context('kitchen'), this.motion);
      if (result.ok) this.say('coffee_pitch_recover');
    } else if (isLive(a)) {
      // The same real tray must reach the counter before a new pair is committed.
      // This also covers topping up partly full cups, without teleporting either
      // the tray or the player's hands and without spending a refill on abort.
      this.beginAnimation('refill', coffeePitchActionToken(this.state));
      return true;
    }
    if (result?.ok) {
      this.beginAnimation('pickup', coffeePitchActionToken(this.state));
      this.g.sim.save();
      this.syncTargets();
    }
    return true;
  }
  beginAnimation(kind, token, { stage, fillFrom } = {}) {
    this.animation = {
      kind,
      token,
      owner: this.owner,
      elapsed: 0,
      stage: stage || (kind === 'retrieve' ? 'move' : 'approach'),
      approach: ['pickup', 'refill'].includes(kind) ? LOC.kitchenApproach : LOC.meetingApproach,
      duration: ['pickup', 'refill'].includes(kind) ? 0.45 : kind === 'retrieve' ? 0.35 : 0.5,
      fillFrom,
    };
    this.from.copy(this.view.trayRoot.position);
    this.fromQ.copy(this.view.trayRoot.quaternion);
    this.w.keys.clear();
    // No global busy flag: foreign actions still execute and first park our tray.
  }
  /** Read by GameWorld before its EXISTING Cannon step. Never writes a body
   * position, teleports, bypasses collisions or reuses another story's action. */
  movementVelocity(dt) {
    const animation = this.animation;
    if (!animation || animation.stage !== 'approach') return null;
    const velocity = this.controlledVelocity;
    velocity.x = velocity.z = 0;
    this.approachSample.copy(this.w.player.position);
    if (this.frozen || !this.available() || !(dt > 0)) return velocity;
    const p = this.w.player.position,
      target = animation.approach;
    const dx = target.x - p.x,
      dz = target.z - p.z,
      length = Math.hypot(dx, dz);
    if (length > 0.008) {
      const speed = Math.min(1.25, length / dt);
      velocity.x = (dx / length) * speed;
      velocity.z = (dz / length) * speed;
    }
    return velocity;
  }
  approachSpeed(dt) {
    return dt > 0 ? Math.min(1.6, distance(this.w.player.position, this.approachSample) / dt) : 0;
  }
  tokenCurrent(token) {
    const a = this.attempt;
    return (
      token &&
      token.owner === this.state &&
      token.attempt === a &&
      token.phase === a?.phase &&
      token.round === a?.round &&
      token.refills === a?.refills
    );
  }
  updateWorld() {
    if (this.disposed) return;
    this.bindState();
    // Re-evaluate AFTER all existing story/character updates. A nearby automatic
    // story or a new jump/punch owns its hands immediately, without a one-frame tug.
    if (this.holding && (this.w.zone !== 'office' || this.storyConflict() || this.handsConflict()))
      this.suspend();
    if (!this.holding) {
      this.syncVisual();
      return;
    }
    const paused = this.frozen || !this.available() || !!this.animation;
    const event = advanceCoffeePitch(
      this.state,
      this.motion,
      this.rawDelta,
      this.w.player.position,
      paused ? this.pauseOptions : this.liveOptions,
    );
    if (event.splash && this.now() - this.lastSpillLine > 18000) {
      this.lastSpillLine = this.now();
      this.say('coffee_pitch_spill');
    }
    const animation = this.animation;
    if (animation) {
      if (animation.owner !== this.owner || !this.tokenCurrent(animation.token)) {
        this.suspend();
        return;
      }
      this.animateTray(animation);
    } else {
      this.applyPose();
      this.handTransform();
      this.view.setCarryTransform(this.hand, this.localQ);
    }
    this.syncVisual(false);
  }
  animateTray(animation) {
    const active = !this.frozen && this.available();
    if (active) animation.elapsed += this.rawDelta;
    if (animation.stage === 'approach') {
      const target = animation.approach;
      const near = distance(this.w.player.position, target) < 0.025;
      let angle = Math.atan2(
        Math.sin(target.yaw - this.w.player.rotation.y),
        Math.cos(target.yaw - this.w.player.rotation.y),
      );
      if (near && active) {
        this.w.player.rotation.y += Math.sign(angle) * Math.min(Math.abs(angle), this.rawDelta * 8);
        angle = Math.atan2(
          Math.sin(target.yaw - this.w.player.rotation.y),
          Math.cos(target.yaw - this.w.player.rotation.y),
        );
      }
      if (animation.kind === 'pickup') this.park();
      else {
        this.applyPose();
        this.handTransform();
        this.view.setCarryTransform(this.hand, this.localQ);
      }
      if (animation.elapsed > 1.8) {
        this.suspend();
        this.g.toast('Kurz Platz am Tablett machen.');
        return;
      }
      if (near && Math.abs(angle) < 0.02) {
        animation.stage = animation.kind === 'pickup' ? 'reach' : 'move';
        animation.elapsed = 0;
        this.from.copy(this.view.trayRoot.position);
        this.fromQ.copy(this.view.trayRoot.quaternion);
      }
      return;
    }
    if (animation.stage === 'reach') {
      const t = ease(Math.min(1, animation.elapsed / 0.25));
      this.park();
      const grip = this.grip.apply(this.view.trayRoot, t, 0);
      if (!grip.reachable) {
        this.suspend();
        this.g.toast('Etwas näher ans Tablett.');
        return;
      }
      if (t >= 1 && grip.maxError <= 0.003) {
        animation.stage = 'move';
        animation.elapsed = 0;
        this.from.copy(this.view.trayRoot.position);
        this.fromQ.copy(this.view.trayRoot.quaternion);
      }
      return;
    }
    if (animation.stage === 'fill') {
      // The saved fill is already committed at the supported counter position;
      // this short presentation only raises the visible liquid. Both real palms
      // stay on the same handles during filling and the following lift.
      this.park();
      const grip = this.grip.apply(this.view.trayRoot, 1, 0);
      if (!grip.reachable || grip.maxError > 0.003) {
        this.suspend();
        this.g.toast('Das Tablett braucht etwas Platz.');
        return;
      }
      if (animation.elapsed >= 0.4) {
        animation.stage = 'move';
        animation.elapsed = 0;
        this.from.copy(this.view.trayRoot.position);
        this.fromQ.copy(this.view.trayRoot.quaternion);
      }
      return;
    }
    const t = ease(Math.min(1, animation.elapsed / animation.duration));
    // Compute the normal carry endpoint without retaining its temporary arm pose;
    // the analytic grip then places both real palms on the interpolated handles.
    this.applyPose();
    this.handTransform();
    this.releasePose();
    if (animation.kind === 'serve') {
      this.to.set(LOC.servingTray.x, LOC.servingTray.y, LOC.servingTray.z);
      this.toQ.setFromAxisAngle(this.offset.set(0, 1, 0), LOC.servingTray.yaw);
    } else if (animation.kind === 'refill') {
      this.to.set(LOC.tray.x, LOC.tray.y, LOC.tray.z);
      this.toQ.copy(this.identity);
    } else {
      this.to.copy(this.hand);
      this.toQ.copy(this.localQ);
    }
    this.local.copy(this.from).lerp(this.to, t);
    this.rootQ.copy(this.fromQ).slerp(this.toQ, t);
    this.view.setCarryTransform(this.local, this.rootQ);
    const lean =
      animation.kind === 'serve'
        ? COFFEE_REACH.meeting.lean * t
        : animation.kind === 'retrieve'
          ? COFFEE_REACH.meeting.lean * (1 - t)
          : 0;
    const grip = this.grip.apply(this.view.trayRoot, 1, lean);
    if (!grip.reachable || grip.maxError > 0.003) {
      this.suspend();
      this.g.toast('Das Tablett braucht etwas Platz.');
      return;
    }
    if (t >= 1) this.completeAnimation(animation);
  }
  completeAnimation(animation) {
    if (
      this.animation !== animation ||
      animation.owner !== this.g.sim.s ||
      !this.tokenCurrent(animation.token)
    )
      return;
    this.animation = null;
    if (animation.kind === 'refill') {
      const a = this.attempt,
        retry = a.phase === 'carry',
        fillFrom = a.fill.slice();
      const result = refillCoffeePitch(
        this.state,
        a.id,
        this.context('kitchen', animation.token),
        this.motion,
      );
      if (!result.ok) {
        this.suspend();
        return;
      }
      this.playEffect('coffee', 0.18);
      this.say(
        retry
          ? 'coffee_pitch_refill'
          : a.round === 1
            ? 'coffee_pitch_round2'
            : 'coffee_pitch_round3',
      );
      // Persist only after actual counter contact. Reload safely parks the now
      // filled tray; a paused/replayed animation cannot commit a second refill.
      this.g.sim.save();
      this.beginAnimation('pickup', coffeePitchActionToken(this.state), {
        stage: 'fill',
        fillFrom,
      });
    } else if (animation.kind === 'serve') {
      const result = serveCoffeePitch(
        this.state,
        this.attempt.id,
        this.context('meeting', animation.token),
        this.motion,
      );
      if (!result.ok) {
        this.suspend();
        return;
      }
      this.delivered = this.attempt.served.slice();
      this.playEffect('dishes_01', 0.085);
      // Save the explicit pending-finish checkpoint before economic completion.
      // A reload offers E at the meeting table; it never pays merely on load.
      this.g.sim.save();
      // Bring the now-empty tray back to the hands before returning control.
      this.beginAnimation('retrieve', coffeePitchActionToken(this.state));
    } else if (animation.kind === 'retrieve' && this.attempt?.phase === 'finish') {
      this.finish();
    }
    this.syncTargets();
  }
  finish() {
    const a = this.attempt;
    if (!a || a.phase !== 'finish') return false;
    const token = coffeePitchActionToken(this.state),
      level = this.g.sim.level;
    const result = finishCoffeePitch(this.g.sim.s, a.id, this.context('meeting', token));
    if (!result.ok) return false;
    this.animation = null;
    this.releasePose();
    this.park();
    this.g.sim.save();
    if (this.g.sim.level > level) {
      this.g.sim.emit('promotion', `Beförderung: ${this.g.sim.career.name}!`, {
        level: this.g.sim.level,
        perk: this.g.sim.career.perk,
      });
      this.g.sim.mail(
        'BBE · Herzlichen Glückwunsch',
        `${this.g.sim.career.name}: ${this.g.sim.career.perk}.`,
      );
      this.g.sim.save();
    }
    // Existing overlay deduplicates the actual attempt object, including a reset
    // whose numeric attempt counter restarts at 1. Rewards are already committed.
    if (result.paid) this.g.sim.emit('mission-complete', 'Kaffee für den Pitch', { token: a });
    this.g.toast(
      `Kaffee serviert · ${result.quality} %`,
      result.paid
        ? '+12 € · +8 XP'
        : `Bestwert ${this.state.bestQuality} %${this.state.bestSeconds ? ' · ' + this.state.bestSeconds.toFixed(1).replace('.', ',') + ' s' : ''}`,
    );
    this.say(result.quality >= 98 ? 'coffee_pitch_perfect' : 'coffee_pitch_success');
    this.syncTargets();
    return true;
  }
  suspend() {
    if (this.disposed) return;
    this.bindState();
    const a = this.attempt;
    const changed = isLive(a);
    if (changed) suspendCoffeePitch(this.state, a.id, this.motion);
    this.animation = null;
    this.releasePose();
    this.cancelPresentation();
    this.stopEffects();
    this.park();
    this.syncTargets();
    if (changed) this.g.sim.save();
  }
  abandon(owner = this.owner, attempt = this.attempt) {
    if (
      this.disposed ||
      owner !== this.g.sim.s ||
      owner !== this.owner ||
      attempt !== this.attempt ||
      !attempt
    )
      return false;
    abandonCoffeePitch(this.state, attempt.id, this.motion);
    this.animation = null;
    this.delivered = [];
    this.releasePose();
    this.cancelPresentation();
    this.stopEffects();
    this.syncTargets();
    this.syncVisual();
    this.g.sim.save();
    return true;
  }
  applyPose() {
    for (const p of this.poseParts) {
      p.before = p.rotation[p.axis];
      p.rotation[p.axis] = p.value;
    }
    this.poseOwned = true;
  }
  releasePose() {
    this.grip.release();
    if (!this.poseOwned) return;
    for (const p of this.poseParts)
      if (p.rotation[p.axis] === p.value) p.rotation[p.axis] = p.before;
    this.poseOwned = false;
  }
  handTransform() {
    const player = this.w.player,
      rig = player.userData.rig;
    player.updateWorldMatrix(true, true);
    rig.leftFore.localToWorld(this.leftHand.set(0, -0.3, 0));
    rig.rightFore.localToWorld(this.rightHand.set(0, -0.3, 0));
    player.getWorldQuaternion(this.playerQ);
    this.offset.set(0, 0.0285, 0).applyQuaternion(this.playerQ);
    this.hand.copy(this.leftHand).add(this.rightHand).multiplyScalar(0.5).sub(this.offset);
    this.view.root.worldToLocal(this.hand);
    this.view.root.getWorldQuaternion(this.rootQ).invert();
    this.localQ.copy(this.rootQ).multiply(this.playerQ);
  }
  park() {
    this.view.setCarryTransform(this.local.set(LOC.tray.x, LOC.tray.y, LOC.tray.z), this.identity);
  }
  syncVisual(park = true) {
    const a = this.attempt,
      actualPhase = a?.phase === 'suspended' ? a.resumePhase : a?.phase;
    if (park && !this.holding) this.park();
    this.view.setServedCount(this.delivered.length);
    for (let i = 0; i < this.delivered.length; i++) this.view.setServedFill(i, this.delivered[i]);
    this.view.setCarriedCupsVisible(!a || actualPhase === 'carry');
    // The state stores world X/Z response. Transform the rotation axis into tray
    // space, without feeding a camera/player turn back into the fluid simulation.
    this.tilt.set(-(a?.tilt[1] || 0), 0, a?.tilt[0] || 0);
    if (this.holding) {
      this.view.trayRoot.getWorldQuaternion(this.trayWorldQ).invert();
      this.tilt.applyQuaternion(this.trayWorldQ);
    }
    for (let i = 0; i < 2; i++) {
      const fill = a?.fill[i] ?? COFFEE_PITCH.fillings[0];
      const presentedFill =
        this.animation?.stage === 'fill'
          ? THREE.MathUtils.lerp(
              this.animation.fillFrom[i],
              fill,
              ease(Math.min(1, this.animation.elapsed / 0.4)),
            )
          : fill;
      this.view.setFill(i, presentedFill);
      this.view.setTilt(i, this.tilt.x, this.tilt.z);
    }
  }
  /** Called after existing mission HUD writers, at the existing 150ms UI cadence. */
  updateHUD() {
    this.drainVoice();
    if (
      this.disposed ||
      (!this.carrying && this.attempt?.phase !== 'finish') ||
      this.w.zone !== 'office' ||
      this.g.sim.s.extras?.drunk > 0 ||
      this.storyConflict()
    )
      return;
    const a = this.attempt,
      panel = this.doc?.querySelector?.('#ui .mission-hud');
    if (!panel) return;
    const text = (id, value) => {
      const node = panel.querySelector('#' + id);
      if (node && node.textContent !== value) node.textContent = value;
    };
    text('quest-title', `Kaffee für den Pitch · ${Math.min(3, a.round + 1)}/3`);
    text(
      'quest-description',
      a.phase === 'finish'
        ? 'ISAR · Kaffeeauftrag abschließen'
        : a.phase === 'return'
          ? 'Küche · Nächstes Paar'
          : `ISAR · Ruhig tragen · ${Math.round((a.fill[0] + a.fill[1]) * 50)} %`,
    );
    text('quest-eyebrow', 'BBE · KAFFEE FÜR DEN PITCH');
    text('quest-location', a.phase === 'return' ? 'BBE · Küche' : 'BBE · ISAR');
    text('quest-reward', this.state.rewardClaimed ? 'Persönlicher Bestwert' : '+12 € · +8 XP');
    // The actual release has no HUD deadline. Scope defensively to this HUD only,
    // never touch .mission-deadline inside another activity's modal.
    const deadline = panel.querySelector('.mission-deadline');
    if (deadline) deadline.textContent = '';
  }
  playEffect(kind, volume) {
    const audio = this.g.audio;
    if (!audio?.ready || !audio.enabled || !audio.bank?.get || !audio.emit) return;
    const owner = this.owner,
      epoch = this.effectsEpoch,
      started = this.now();
    const id = audio.variant?.(kind) || kind;
    Promise.resolve(audio.bank.get(id)).then(
      (buffer) => {
        if (
          !buffer ||
          this.disposed ||
          owner !== this.g.sim.s ||
          epoch !== this.effectsEpoch ||
          this.now() - started > 1500 ||
          !this.available() ||
          !audio.enabled
        )
          return;
        const handle = audio.emit(buffer, { bus: 'effects', volume });
        if (handle) {
          this.effects.add(handle);
          handle.onEnded = () => this.effects.delete(handle);
        }
      },
      () => {},
    );
  }
  stopEffects() {
    this.effectsEpoch++;
    for (const handle of this.effects) handle.stop(0.025);
    this.effects.clear();
  }
  addSettings() {
    if (!this.attempt || !this.doc) return;
    const owner = this.owner,
      attempt = this.attempt;
    const toolbar = this.doc.querySelector('.settings-list .toolbar');
    if (!toolbar || this.doc.getElementById('coffee-pitch-abandon')) return;
    const button = this.doc.createElement('button');
    button.id = 'coffee-pitch-abandon';
    button.textContent = 'Kaffeeauftrag abbrechen';
    button.onclick = () => {
      if (this.abandon(owner, attempt)) {
        button.remove();
        this.g.updateHUD();
      }
    };
    toolbar.append(button);
  }
  say(id) {
    const important = [
      'coffee_pitch_start',
      'coffee_pitch_success',
      'coffee_pitch_perfect',
    ].includes(id);
    if (this.queuedVoice?.important && !important) return;
    this.queuedVoice = { id, owner: this.owner, important, expires: this.now() + 4500 };
    this.drainVoice();
  }
  drainVoice() {
    const queued = this.queuedVoice;
    if (!queued || this.disposed) return;
    const id = queued.id,
      line = this.voiceLines[id],
      voices = this.g.audio?.voices;
    if (
      !line ||
      queued.owner !== this.owner ||
      this.owner !== this.g.sim.s ||
      this.now() > queued.expires ||
      !this.g.audio.enabled ||
      this.g.modal ||
      this.hidden() ||
      !this.focused ||
      this.storyConflict() ||
      !voices?.resolve?.(line.character, line.event, id)
    ) {
      this.queuedVoice = null;
      return;
    }
    const priority = queued.important ? 2 : 1;
    if (
      voices.queue?.length ||
      voices.arrival ||
      (voices.current && voices.current.priority >= priority)
    ) {
      if (!queued.important) this.queuedVoice = null;
      return;
    }
    this.cancelPresentation();
    const pending = { epoch: this.epoch, owner: this.owner, id, token: null };
    this.voice = pending;
    // Bypass the actor's long ambient cooldown, but never a dialogue/story priority.
    // Important cues may supersede background chatter, or wait boundedly in one slot.
    const promise = voices.say(line.character, line.event, { id, priority, force: true });
    if (voices.current?.line?.id === id) pending.token = voices.token;
    Promise.resolve(promise).then(
      (accepted) => {
        if (this.voice !== pending) return;
        if (
          accepted !== true ||
          this.owner !== pending.owner ||
          this.g.sim.s !== pending.owner ||
          this.epoch !== pending.epoch ||
          this.hidden() ||
          this.g.modal ||
          this.storyConflict()
        )
          this.cancelPresentation();
      },
      () => {
        if (this.voice === pending) this.cancelPresentation();
      },
    );
  }
  cancelPresentation() {
    this.epoch++;
    this.queuedVoice = null;
    const pending = this.voice,
      voices = this.g.audio?.voices;
    this.voice = null;
    if (
      pending &&
      Number.isSafeInteger(pending.token) &&
      voices?.token === pending.token &&
      voices.current?.line?.id === pending.id
    )
      voices.stop(false);
  }
  dispose() {
    if (this.disposed) return;
    this.suspend();
    this.disposed = true;
    this.win?.removeEventListener('blur', this.blur);
    this.win?.removeEventListener('focus', this.focus);
    this.doc?.removeEventListener('visibilitychange', this.visibility);
    const interactions = this.w.zoneData.office.interactions;
    for (const target of Object.values(this.targets)) {
      const i = interactions.indexOf(target);
      if (i >= 0) interactions.splice(i, 1);
    }
    if (this.w.coffeePitch === this) this.w.coffeePitch = null;
    this.grip.dispose();
    this.view.dispose();
  }
}
