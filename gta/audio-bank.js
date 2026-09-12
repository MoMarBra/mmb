import { AUDIO_ASSETS } from './audio-catalog.js';

/** Lazy decode, bounded concurrency, and the same assets for hosted and offline play. */
export class AudioBank {
  constructor(context) {
    this.ctx = context;
    this.buffers = new Map();
    this.pending = new Map();
    this.failures = new Set();
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
  get(id) {
    if (this.buffers.has(id)) {
      const buffer = this.buffers.get(id);
      this.buffers.delete(id);
      this.buffers.set(id, buffer);
      return Promise.resolve(buffer);
    }
    if (this.pending.has(id)) return this.pending.get(id);
    if (!AUDIO_ASSETS[id] || this.failures.has(id)) return Promise.resolve(null);
    const promise = new Promise((resolve) => this.queue.push({ id, resolve }));
    this.pending.set(id, promise);
    this.pump();
    return promise;
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
          job.resolve(buffer);
        })
        .finally(() => {
          this.loading--;
          this.pending.delete(job.id);
          this.pump();
        });
    }
  }
  async decode(id) {
    try {
      let bytes;
      if (this.embedded?.[id]) {
        const binary = atob(this.embedded[id]);
        bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
      } else {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch(AUDIO_ASSETS[id].path, { signal: controller.signal });
          if (!response.ok) throw Error('Audio asset unavailable');
          bytes = await response.arrayBuffer();
        } finally {
          clearTimeout(timeout);
        }
      }
      return await this.ctx.decodeAudioData(bytes);
    } catch {
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
