export interface AudioFeatures { level: number; bass: number; mid: number; high: number; onset: number; highOnset: number; bassOnset: number; }
export const silentFeatures = (): AudioFeatures => ({ level: 0, bass: 0, mid: 0, high: 0, onset: 0, highOnset: 0, bassOnset: 0 });

/** Positive spectral changes, split into musical bands. No AGC or track normalization.
 * Approach references: Butterchurn's frequency bands and audiojs/beat's spectral flux.
 * This streaming implementation is independent; no upstream code or renderer is bundled.
 */
export class SpectrumDetector {
  private previous: Float64Array;
  private seeded = false;
  private previousPercussion = 0;
  private previousFlux = 0;
  private fluxFloor = 0;
  constructor(private sampleRate: number, private fftSize: number) {
    this.previous = new Float64Array(fftSize / 2);
  }
  read(samples: Float32Array, decibels: Float32Array): AudioFeatures {
    const features = silentFeatures();
    const hadHistory = this.seeded;
    features.level = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const energies = [0, 0, 0], changes = [0, 0, 0];
    let percussionEnergy = 0, percussionFlux = 0, risingBins = 0;
    for (let i = 1; i < Math.min(decibels.length, this.previous.length); i++) {
      const hz = i * this.sampleRate / this.fftSize;
      const band = hz < 30 || hz > 11025 ? -1 : hz < 320 ? 0 : hz < 2800 ? 1 : 2;
      const magnitude = Number.isFinite(decibels[i]) ? 10 ** (decibels[i] / 20) : 0;
      if (band >= 0) {
        energies[band] += magnitude * magnitude;
        const increase = this.seeded ? Math.max(0, magnitude - this.previous[i]) : 0;
        changes[band] += increase * increase;
      }
      // Snare/rimshot presence and hat transients, excluding kick/bass fundamentals.
      if (hz >= 1200 && hz <= 11025) {
        percussionEnergy += magnitude * magnitude;
        const increase = hadHistory ? Math.max(0, magnitude - this.previous[i]) : 0;
        percussionFlux += increase * increase;
        if (increase > .0001) risingBins++;
      }
      this.previous[i] = magnitude;
    }
    this.seeded = true;
    [features.bass, features.mid, features.high] = energies.map(Math.sqrt);
    const energy = Math.sqrt(percussionEnergy), flux = Math.sqrt(percussionFlux);
    // A hat/snare can arrive while another high-frequency sound decays. Its
    // positive spectral flux must not be capped by the total band's net RMS rise.
    // Reject steady spectral drift with a novelty floor and a rising-edge gate;
    // broadband transients can trigger even when total band energy stays flat.
    const energyRise = energy - this.previousPercussion;
    const grew = energyRise > Math.max(.0001, this.previousPercussion * .008);
    const transient = flux > this.fluxFloor * 1.4 + .00035 && flux > this.previousFlux * 1.05;
    features.highOnset = hadHistory && transient && (grew || risingBins >= 4) ? flux : 0;
    this.previousPercussion = energy;
    const novelty = grew || risingBins >= 4 ? flux : 0;
    this.previousFlux = novelty;
    this.fluxFloor += (novelty - this.fluxFloor) * .1;
    features.bassOnset = Math.sqrt(changes[0]);
    features.onset = Math.sqrt(changes[0]) * 2.5 + Math.sqrt(changes[1]) * 1.5 + Math.sqrt(changes[2]);
    if (features.level < .00001) { this.previous.fill(0); this.seeded = false; this.previousPercussion = this.previousFlux = this.fluxFloor = 0; return silentFeatures(); }
    return features;
  }
}
