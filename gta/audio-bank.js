import { AUDIO_ASSETS } from './audio-catalog.js';

/** Lazy decode, bounded concurrency, and the same assets for hosted and offline play. */
export class AudioBank {
  constructor(context) {
    this.ctx = context;
    this.buffers = new Map();
    this.pending = new Map();
    this.failures = new Set();
    this.retryState = new Map();
    this.maxAttempts = 3;
    this.retryDelay = 1000;
    this.queue = [];
    this.loading = 0;
    this.bytes = 0;
    this.limit = 64 * 1024 * 1024;
    this.decoded = new Set();
    this.embedded = null;
    const element = globalThis.document?.getElementById('bbe-audio-bank');
    if (element) {
      try {
        this.embedded = JSON.parse(element.textContent);
      } catch {
        /* normal files remain available */
      }
    }
  }
  get(id, { priority = false } = {}) {
    if (this.buffers.has(id)) {
      const buffer = this.buffers.get(id);
      this.buffers.delete(id);
      this.buffers.set(id, buffer);
      return Promise.resolve(buffer);
    }
    if (this.pending.has(id)) {
      if (priority) this.prioritize(id);
      return this.pending.get(id);
    }
    if (!AUDIO_ASSETS[id]) return Promise.resolve(null);
    const failure = this.retryState.get(id);
    if (this.failures.has(id)) {
      // Only another request can retry; background timers never download assets.
      if (!failure || !failure.retryable || failure.attempts >= this.maxAttempts ||
          Date.now() < failure.nextAt) return Promise.resolve(null);
    } else if (failure) {
      // Existing explicit Retry controls clear failures to start a fresh attempt.
      this.retryState.delete(id);
    }
    const promise = new Promise((resolve) => this.queue.push({ id, resolve, priority }));
    this.pending.set(id, promise);
    if (priority) this.prioritize(id);
    this.pump();
    return promise;
  }
  prioritize(id) {
    const job = this.queue.find((item) => item.id === id);
    if (!job) return; // An active download keeps its slot and is never restarted.
    job.priority = true;
    // Stable ordering preserves foreground cue order while passing background preloads.
    this.queue.sort((a, b) => Number(b.priority) - Number(a.priority));
  }
  pump() {
    while (this.loading < 4 && this.queue.length) {
      const job = this.queue.shift();
      this.loading++;
      this.decode(job.id)
        .then((buffer) => {
          if (buffer) {
            this.buffers.set(job.id, buffer);
            this.decoded.add(job.id);
            this.bytes += buffer.length * buffer.numberOfChannels * 4;
            while (this.bytes > this.limit && this.buffers.size > 1) {
              const oldest = this.buffers.keys().next().value,
                expired = this.buffers.get(oldest);
              this.bytes -= expired.length * expired.numberOfChannels * 4;
              this.buffers.delete(oldest);
            }
          }
          return buffer;
        })
        .finally(() => {
          this.loading--;
          this.pending.delete(job.id);
          this.pump();
        })
        // Release the pending owner before callers can request a retry.
        .then(job.resolve);
    }
  }
  async decode(id) {
    let retryable = false;
    try {
      let bytes;
      if (this.embedded?.[id]) {
        const binary = atob(this.embedded[id]);
        bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
      } else {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          retryable = true; // Network errors, incomplete bodies and timeouts can recover.
          const response = await fetch(AUDIO_ASSETS[id].path, { signal: controller.signal });
          if (!response.ok) {
            retryable = response.status === 408 || response.status === 429 ||
              (response.status >= 500 && response.status <= 599);
            throw Error('Audio asset unavailable');
          }
          bytes = await response.arrayBuffer();
        } finally {
          clearTimeout(timeout);
        }
      }
      // Bad encoded audio is not repaired by repeatedly downloading the same file.
      retryable = false;
      const buffer = await this.ctx.decodeAudioData(bytes);
      this.failures.delete(id);
      this.retryState.delete(id);
      return buffer;
    } catch {
      const attempts = (this.retryState.get(id)?.attempts || 0) + 1;
      this.retryState.set(id, {
        attempts,
        retryable,
        nextAt: Date.now() + this.retryDelay * 2 ** (attempts - 1),
      });
      this.failures.add(id);
      return null;
    }
  }
  preload(ids) {
    return Promise.all(ids.map((id) => this.get(id)));
  }
  get status() {
    return {
      decoded: this.decoded.size,
      cached: this.buffers.size,
      bytes: this.bytes,
      loading: this.pending.size,
      failed: [...this.failures],
    };
  }
}
