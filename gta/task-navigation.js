import { chooseTaskWaypoint, isTaskWaypoint, outsideTaskPhase, taskObjective } from './task-objective.js';

/** Small transient owner. No DOM, timer, routing graph, sound or save writes. */
export class TaskNavigation {
  constructor(game, { restaurants = [], hq, resolve = taskObjective } = {}) {
    this.g = game;
    this.restaurants = restaurants;
    this.hq = hq;
    this.resolve = resolve;
    this.owner = game.sim.s;
    this.world = game.world;
    this.selectedTaskId = null;
    this.mode = 'off';
    this.goal = null;
    this.ownedWaypoint = null;
    this.cache = null;
  }

  owns(point = this.g.waypoint) { return !!point && point === this.ownedWaypoint; }
  dropOwn() {
    if (this.owns()) this.g.waypoint = null;
    this.ownedWaypoint = null;
  }
  bindOwner() {
    if (this.owner === this.g.sim.s && this.world === this.g.world) return;
    this.dropOwn();
    this.owner = this.g.sim.s;
    this.world = this.g.world;
    this.selectedTaskId = null;
    this.mode = 'off';
    this.goal = this.cache = null;
  }
  foreignBusy() {
    const g = this.g;
    return !!(!g.started || g.cinematic || g.extras?.intro?.current ||
      (g.workshop?.enabled && g.workshop.active) || g.workshop?.boarding ||
      (g.fireStory?.enabled && g.fireStory.active) ||
      (g.campaign?.enabled && g.campaign.active) ||
      (g.campaign?.manualMarker > 0 && g.campaign.manualWaypoint) ||
      g.origin?.active || g.sim.s.courier?.active || g.coffeePitch?.holding ||
      g.quizssoir?.active || g.blast?.active);
  }
  context(preferredRestaurantId = null) {
    const w = this.g.world;
    // Additional interiors supply their existing exact exit registration.
    const exits = { home: 'origin-home-exit', zitronengras: 'origin-exit' };
    return {
      restaurants: this.restaurants, hq: this.hq, zoneData: w.zoneData,
      zone: w.zone, restaurantId: w.currentRestaurant?.id, position: w.player.position,
      absolute: this.g.sim.absolute(), preferredRestaurantId, exitId: exits[w.zone],
    };
  }
  objective(task) {
    this.bindOwner();
    return this.resolve(task, this.context(task?.id === this.selectedTaskId ? this.goal?.restaurantId : null));
  }
  select(taskId) {
    this.bindOwner();
    const task = this.g.sim.s.active.find(t => t.id === taskId);
    if (!outsideTaskPhase(task)) {
      this.dropOwn(); this.selectedTaskId = null; this.goal = this.cache = null; this.mode = 'off';
      return false;
    }
    if (taskId !== this.selectedTaskId) this.goal = null;
    this.selectedTaskId = taskId;
    this.mode = 'task';
    this.cache = null;
    this.update({ explicit: true });
    return !!this.goal;
  }
  /** Player choices pause automatic task guidance until a deliberate re-pin. */
  manual(point) {
    this.bindOwner();
    if (this.foreignBusy() || this.g.waypoint?.campaign || this.g.waypoint?.story) return false;
    if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.z) || typeof point.name !== 'string')) return false;
    this.dropOwn();
    this.mode = point ? 'manual' : 'dismissed';
    this.g.waypoint = point ? { name: point.name, x: point.x, z: point.z } : null;
    return true;
  }
  dismiss() { return this.manual(null); }
  onEvent(event) {
    if (['progress', 'mission-complete', 'day'].includes(event?.type)) this.update();
  }
  /** Called only by existing events/0.15s HUD cadence, never by an extra RAF. */
  update({ explicit = false } = {}) {
    this.bindOwner();
    if (this.mode !== 'task') return;
    const g = this.g, task = g.sim.s.active.find(t => t.id === this.selectedTaskId);
    if (!task || !outsideTaskPhase(task) || (Number.isFinite(task.deadline) && task.deadline < g.sim.absolute())) {
      this.dropOwn(); this.goal = this.cache = null; this.selectedTaskId = null; this.mode = 'off'; return;
    }
    const progress = task.progress || [], zone = g.world.zone, tenant = g.world.currentRestaurant?.id;
    const previous = this.cache;
    let changed = explicit || !previous || previous.task !== task || previous.zone !== zone || previous.tenant !== tenant || previous.progress.length !== progress.length;
    if (!changed) for (let i = 0; i < progress.length; i++) if (previous.progress[i] !== progress[i]) { changed = true; break; }
    if (changed) {
      this.goal = this.resolve(task, this.context(this.goal?.restaurantId));
      this.cache = { task, zone, tenant, progress: progress.slice() };
    }
    if (this.foreignBusy() || g.waypoint?.campaign || g.waypoint?.story) { this.dropOwn(); return; }
    if (g.waypoint && !this.owns() && !explicit) {
      // Also protect older unmarked external writers. Do not reacquire the route
      // after that marker disappears merely because the player reached it.
      this.ownedWaypoint = null;
      this.mode = 'manual';
      return;
    }
    const next = chooseTaskWaypoint(this.goal, g.waypoint, { explicit });
    if (next !== g.waypoint) g.waypoint = next;
    this.ownedWaypoint = isTaskWaypoint(next) ? next : null;
  }
  hint(task) {
    return this.mode === 'task' && task?.id === this.selectedTaskId && this.goal ? this.goal.localLabel : '';
  }
  displayTarget() {
    if (this.owner !== this.g.sim.s || this.world !== this.g.world || this.mode !== 'task' || !this.owns() || this.foreignBusy()) return null;
    return this.g.world.zone === 'city' ? this.goal?.cityTarget : this.goal?.nextTarget;
  }
  dispose() {
    this.dropOwn(); this.mode = 'off'; this.selectedTaskId = null; this.goal = this.cache = null;
  }
}
