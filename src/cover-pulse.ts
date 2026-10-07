/** Cover-only transient envelope. Shader audio stays raw and unchanged. */
export class CoverPulse {
  private floor = 0;
  private previous = 0;
  private lastSample = -Infinity;
  private lastHit = -Infinity;
  private strength = 0;
  reset() { this.floor = this.previous = this.strength = 0; this.lastSample = this.lastHit = -Infinity; }
  sample(onset: number, now: number) {
    const value = Number.isFinite(onset) ? Math.max(0, onset) : 0;
    if (now - this.lastSample > 200) {
      this.floor = this.previous = value; this.lastSample = now; this.strength = 0; return;
    }
    const dt = Math.max(0, now - this.lastSample);
    // Continuous spectral motion is a baseline, rather than a sequence of beats.
    const novelty = value > this.floor * 1.35 + .003;
    const rising = value > this.previous * 1.06 + .001;
    if (novelty && rising && now - this.lastHit >= 110) {
      this.lastHit = now; this.strength = value * .24;
    }
    this.floor += (value - this.floor) * (1 - Math.exp(-dt / 300));
    this.previous = value; this.lastSample = now;
  }
  expansion(now: number, maximum: number, sensitivity: number) {
    // Cap the hit before decay so a loud hit cannot stay pinned at the limit.
    return Math.min(maximum, this.strength * sensitivity) * Math.exp(-Math.max(0, now - this.lastHit) / 65);
  }
}
