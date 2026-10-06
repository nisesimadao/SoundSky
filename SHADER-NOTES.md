# SoundSky materials (1.2.4)

Uses the official `LiquidMetal` and `Heatmap` React components from `@paper-design/shaders-react` 0.0.81, with its matching core package. No custom vertex mapping or hand-built Heatmap channel texture remains.

- Liquid Metal: the circular transport button. The component's built-in circle mask keeps the play/pause glyph readable. Repetition 2, softness .1, dispersion .3/.3, distortion .07, contour .4, angle 70. Scale 1.12 fills this small button.
- Heatmap: a filled cover-sized silhouette on an opaque backing panel, one layer below the artwork. It extends 6–10 px beyond the cover, has 12–16 px rounded corners, and uses opacity 100%. Two official Heatmap layers share the silhouette: an opaque blue/cyan base and a red/orange/yellow layer revealed from the top by raw loudness. A third official cool Heatmap is revealed only through the high-attack masks; the three layers have a combined pixel budget of 393,216 pixels. There is no blend with the artwork and no opacity modulation.
- Seek: a quiet CSS light strip so progress stays legible.

Play/pause uses a white SVG alpha mask with difference blending: the symbol inverts the Liquid Metal surface beneath it. A separate hollow SVG mask supplies a 0.6 px black outline without covering the metal inside the symbol.

Both effects stop while paused, hidden or closed, and respect reduced motion. Physical render budgets: 16,384 pixels for metal; 131,072 per Heatmap layer. Canvas sizing rules are included inside the shadow root, since Paper's global document CSS cannot reach it. React/Paper code is bundled locally; no external runtime scripts or image masks are requested. Third-party licenses are included in the distribution.

Official references:
- https://shaders.paper.design/liquid-metal
- https://shaders.paper.design/heatmap

Flow speed is `0.6 + rawRMS * 5 + spectralOnset * 12`, without normalization, compression, speed smoothing or a ceiling. See [AUDIO-NOTES.md](AUDIO-NOTES.md) for analysis research and behavior.

The thermal front reaches `RMS × 140 × heatReach − 12` (default heatReach: 3×) percent down the panel, with an 18 percentage-point soft edge. No loudness normalization or temporal smoothing is introduced; the opaque cool base retains the backing panel’s 100% opacity. Paused and reduced-motion states remain cool.

Heatmap render resolution and geometry retain their original fixed size. Only the artwork scales, up to 15% by default.

The warm Heatmap retains its original audio-driven animation. Both official cool Heatmaps use speed zero so no cyan ribbon travels autonomously. High attacks reveal a third official cool Heatmap through overlapping travelling alpha masks. CSS controls only the reveal, never the material colors or texture. Completed masks are removed and all masks clear when inactive or reduced motion is requested.

The backdrop uses the official MeshGradient in a separate Atmosphere lifecycle (230,400 pixels). Its intensity is min(0.84, (0.14 + RMS × 1.8) × ambientGlow) and its speed is ambientSpeed × (0.15 + RMS × 4 + onset × 8). Silent passages become dim and slow, while attacks accelerate it. Audio expires after 200 ms, and pause/mute/hidden/closed states dim the material. Pause, hidden, closed and reduced motion stop the shader. The transport housing uses an official dark GemSmoke (16,384 pixels), with independently adjustable slow motion. The seek fill uses a smooth, pastel MeshGradient (8,192 pixels), with separate speed control. Neither uses Waves or LiquidMetal; LiquidMetal remains on the play button. The root unmounts at teardown.

Cover pulse response, high-attack sensitivity, ribbon travel speed, warm Heatmap speed and play-button metal speed are independent controls. Only travelling masks use the ribbon speed control; the cool material itself stays static. Settings are grouped into Cover, Light and Scene tabs. Older saved combined sensitivity/speed values seed the new controls to preserve preferences.
