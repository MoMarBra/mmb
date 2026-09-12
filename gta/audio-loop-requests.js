export const LOOP_REQUEST_METHODS = {
  requestLoop(key, id, target, options = {}) {
    if (!this.ready || !this.enabled) return;
    this.loopRequests ||= new Map();
    if (!(target > 0.001)) {
      this.cancelLoopRequest(key);
      return;
    }
    const position = options.position;
    this.loopRequests.set(key, {
      id,
      target,
      // Copy positions so later physics changes cannot alter an old request.
      options: {
        ...options,
        ...(position
          ? {
              position: Array.isArray(position)
                ? [...position]
                : { x: position.x, y: position.y ?? 1, z: position.z },
            }
          : {}),
      },
      zone: this.world?.zone,
      expires: this.ctx.currentTime + 0.18,
    });
  },
  flushLoopRequests(active) {
    if (!this.loopRequests) return;
    if (!active || !this.enabled) {
      this.loopRequests.clear();
      return;
    }
    for (const [key, request] of this.loopRequests) {
      if (
        request.expires < this.ctx.currentTime ||
        (request.zone !== undefined && request.zone !== this.world?.zone)
      ) {
        this.loopRequests.delete(key);
        continue;
      }
      this.loop(key, request.id, request.target, request.options);
    }
  },
  cancelLoopRequest(key, fade = 0.15) {
    this.loopRequests?.delete(key);
    const slot = this.loops.get(key);
    if (!slot) return;
    slot.target = 0;
    slot.handle?.stop(fade);
    // Also invalidates any in-flight decode callback's identity check.
    this.loops.delete(key);
  },
};
