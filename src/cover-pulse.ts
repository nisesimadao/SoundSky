/** Cover follows raw loudness and spectral change; only the upper range is eased. */
export class CoverPulse {
  private level = 0;
  private onset = 0;
  private lastSample = -Infinity;
  private average = 0;
  reset() { this.level = this.onset = 0; this.lastSample = -Infinity; this.average = 0; }
  sample(onset: number, now: number, level = 0) {
    const dt = now - this.lastSample;
    this.level = Number.isFinite(level) ? Math.max(0, level) : 0;
    this.onset = Number.isFinite(onset) ? Math.max(0, onset) : 0;
    const energy = this.level + this.onset;
    if (dt > 200) this.average = energy;
    else this.average += (energy - this.average) * (1 - Math.exp(-Math.max(0, dt) / 500));
    this.lastSample = now;
  }
  expansion(now: number, maximum: number, sensitivity: number) {
    if (now - this.lastSample >= 200 || maximum <= 0) { return 0; }
    const raw = (this.level + this.onset) * .1 * sensitivity;
    const knee = maximum * .8;
    if (raw <= knee) return raw;
    const soft = knee + maximum * .2 * (1 - Math.exp(-(raw - knee) / (maximum * .2)));
    // Near the ceiling, retain small audio changes around a moving baseline.
    // Constant input stays still; there is no timed shrink or invented wobble.
    const change = (raw - this.average * .1 * sensitivity) / maximum;
    const detail = maximum * (.9 + .1 * Math.tanh(change * 4));
    const t = Math.min(1, (raw - knee) / (maximum * .4));
    const blend = t * t * (3 - 2 * t);
    return soft * (1 - blend) + detail * blend;
  }
}
