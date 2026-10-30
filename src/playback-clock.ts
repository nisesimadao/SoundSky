/** Keep subsecond progress across transport updates from a whole-second native UI. */
export class PlaybackClock {
  private key = '';
  private sample = 0;
  private current = 0;
  private at = 0;
  private playing = false;
  read(now: number) { return this.current + (this.playing ? Math.min(1.25, Math.max(0, now - this.at) / 1000) : 0); }
  sync(key: string, sample: number, playing: boolean, now: number, seeking = false) {
    const predicted = this.read(now);
    const changed = key !== this.key || seeking || Math.abs(sample - predicted) > 1.25;
    if (changed || playing !== this.playing || sample !== this.sample) {
      this.current = changed ? sample : playing !== this.playing || !playing ? predicted : sample;
      this.at = now;
    }
    this.key = key; this.sample = sample; this.playing = playing;
    return this.read(now);
  }
}
