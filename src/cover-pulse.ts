/** Cover-only sustained lift plus transient envelope. Shader audio stays raw. */
export class CoverPulse {
  private floor = 0;
  private previous = 0;
  private lastSample = -Infinity;
  private lastHit = -Infinity;
  private strength = 0;
  private sustained = 0;
  reset() { this.floor = this.previous = this.strength = this.sustained = 0; this.lastSample = this.lastHit = -Infinity; }
  sample(onset: number, now: number, level = 0) {
    const value = Number.isFinite(onset) ? Math.max(0, onset) : 0;
    const loudness = Number.isFinite(level) ? Math.max(0, level) : 0;
    const stale = now - this.lastSample > 200;
    const dt = stale ? 32 : Math.max(0, now - this.lastSample);
    if (stale) this.sustained = 0;
    // A pad may lift the cover gently, but cannot consume the whole beat range.
    this.sustained += (loudness - this.sustained) * (1 - Math.exp(-dt / (loudness > this.sustained ? 180 : 650)));
    if (stale) {
      this.floor = this.previous = value; this.lastSample = now; this.strength = 0; return;
    }
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
    const lift = maximum * .2 * (1 - Math.exp(-this.sustained * sensitivity / 1.2));
    const hit = Math.min(Math.max(0, maximum - lift), this.strength * sensitivity) * Math.exp(-Math.max(0, now - this.lastHit) / 65);
    return lift + hit;
  }
}
