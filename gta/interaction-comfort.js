// Proposed gamefeel policies only. No production imports or global listeners.
export function shouldPreferVehicleInteraction(current, player, vehicleDistance, margin = 0.15) {
  if (!Number.isFinite(vehicleDistance) || vehicleDistance < 0) return false;
  if (!current) return true;
  // An explicit special/mission target without a position keeps its ownership.
  if (![current.x, current.z, player?.x, player?.z].every(Number.isFinite)) return false;
  const currentDistance = Math.hypot(player.x - current.x, player.z - current.z);
  return vehicleDistance + Math.max(0, margin) < currentDistance;
}

export function vehicleExitPrompt(speed, specialType = null) {
  // Special vehicles have their own exit rules and retain their existing prompt.
  if (specialType === 'bike' || specialType === 'helicopter') return null;
  return Number.isFinite(speed) && Math.abs(speed) <= 1.8
    ? 'Aussteigen'
    : 'Anhalten zum Aussteigen';
}

// Last deliberate direction wins; releasing it restores another held input.
// Tokens can be keyboard codes or `pointer:<id>`; repeats do not steal priority.
export class HeldAxis {
  constructor() { this.held = new Map(); }
  press(token, direction) {
    if (!token || (direction !== -1 && direction !== 1)) return this.value;
    if (!this.held.has(token)) this.held.set(token, direction);
    return this.value;
  }
  release(token) { this.held.delete(token); return this.value; }
  clear() { this.held.clear(); return 0; }
  get value() {
    let result = 0;
    for (const direction of this.held.values()) result = direction;
    return result;
  }
}

export function ownPanelCloseShortcut(event, state) {
  if (!state.started || state.busy || state.cinematic || !state.modal || state.modal.locked ||
      event.repeat || event.defaultPrevented || event.isComposing || event.keyCode === 229 ||
      event.ctrlKey || event.metaKey || event.altKey || state.editing) return false;
  // Tab is deliberately never consumed: it remains accessible focus navigation.
  if (event.code === 'KeyP') return state.modal.phone === true;
  if (event.code === 'KeyM') return state.modal.map === true;
  if (event.code === 'KeyJ') return state.modal.phone === true && state.phonePage === 'tasks';
  return false;
}
