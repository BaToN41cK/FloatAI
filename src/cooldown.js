class Cooldown {
  constructor(durationMs) {
    this.durationMs = durationMs;
    this.until = 0;
  }

  start(now = Date.now()) { this.until = now + this.durationMs; }
  remaining(now = Date.now()) { return Math.max(0, this.until - now); }
  active(now = Date.now()) { return this.remaining(now) > 0; }
}

module.exports = { Cooldown };
