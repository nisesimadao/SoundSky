# Audio reaction, 1.2.4

Research references reviewed on 2026-10-06 JST:

- [Butterchurn's audio levels](https://github.com/jberg/butterchurn/blob/master/src/audio/audioLevels.js): separates low/mid/high bands. Its long-term normalization was deliberately not adopted.
- [audiojs/beat](https://github.com/audiojs/beat): positive changes between spectral frames detect onsets even when overall energy is steady.

SoundSky retains its own visuals and output tap. The streaming detector is independently implemented, with no copied upstream source or new visualizer dependency.

Analysis uses 2048 samples, at approximately 30 updates/second, with AnalyserNode FFT smoothing disabled. It measures raw RMS and positive spectral changes in 30–320 Hz, 320–2800 Hz, and 2800–11025 Hz bands. FFT decibels are converted to linear amplitudes. Each band's positive change is measured by its Euclidean magnitude; fixed weights 2.5/1.5/1 prioritize kicks and snares. No AGC, rolling track-volume normalization, adaptive sensitivity gain, compression, or shader-speed cap is applied.

Shader flow speed is `(0.6 + RMS × 5 + onset × 12) × materialSpeed`. Artwork expansion is `min(pulseMax, (RMS × 0.006 + onset × 0.24) × pulseSensitivity)` (defaults: 15%, 3×), with its existing quick attack and restrained release. This reserves movement for frequency attacks rather than pinning artwork at maximum scale whenever a mastered track's RMS exceeds 0.29. Silence resets spectral history; the first frame seeds history without an invented onset. Signal loss expires after 200 ms. Pause, hidden state and reduced motion still stop shader animation.

Synthetic tests verify a frequency attack at unchanged RMS, sample-rate independence, linear response to half-amplitude input, silence and first-frame behavior. This is transient detection, not BPM prediction or an assertion that every musical beat is detected.

Artwork scaling is applied only to the artwork element, leaving the Heatmap backing at a fixed size.

High-band attacks are sent as `highOnset`: the smaller of positive spectral flux and the rise in total high-band amplitude. Constant-energy timbre changes cannot trigger ribbons. A ribbon launches when `highOnset × pulseSensitivity ≥ 0.024`, with 65 ms between launches to avoid duplicating an attack while allowing rapid hats. Sustained highs do not generate periodic ribbons. Each ribbon crosses the cover in `1800 / sqrt(materialSpeed)` ms and is removed on completion; at most 24 coexist. Pause, mute, track changes, hiding, closing and reduced motion clear them. The warm Heatmap retains its audio-driven movement; both cool Heatmaps are static, with travel supplied only by high-attack masks. High attacks add travelling alpha masks over a third official cool Heatmap; no CSS color gradient substitutes for the shader material.

Visual control headroom: cover expansion up to 30%, attack sensitivity up to 12×, warmth reach up to 6×, material/background speed up to 8×. Standard settings remain 15%, 3×, 3×, 2.8× and 0.1× respectively. The fixed spectral-attack gain is 0.24; RMS stays at 0.006 to avoid constant saturation.
