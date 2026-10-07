/** Cover follows raw loudness and spectral change; only the upper range is eased. */
export class CoverPulse {
  private level = 0;
  private onset = 0;
  private lastSample = -Infinity;
  private ceilingSince = -Infinity;
  reset() { this.level = this.onset = 0; this.lastSample = this.ceilingSince = -Infinity; }
  sample(onset: number, now: number, level = 0) {
    if (now - this.lastSample > 200) this.ceilingSince = -Infinity;
    this.level = Number.isFinite(level) ? Math.max(0, level) : 0;
    this.onset = Number.isFinite(onset) ? Math.max(0, onset) : 0;
    this.lastSample = now;
  }
  expansion(now: number, maximum: number, sensitivity: number) {
    if (now - this.lastSample >= 200 || maximum <= 0) { this.ceilingSince = -Infinity; return 0; }
    const raw = (this.level + this.onset) * .1 * sensitivity;
    const knee = maximum * .8;
    if (raw <= knee) { this.ceilingSince = -Infinity; return raw; }
    if (!Number.isFinite(this.ceilingSince)) this.ceilingSince = now;
    // Preserve the lower 80% exactly. Ease only near the ceiling; prolonged
    // loud sections give back a little room without losing the sustained lift.
    const held = Math.max(0, now - this.ceilingSince - 300);
    const headroom = maximum * (.2 - .1 * (1 - Math.exp(-held / 600)));
    return knee + headroom * (1 - Math.exp(-(raw - knee) / headroom));
  }
}
