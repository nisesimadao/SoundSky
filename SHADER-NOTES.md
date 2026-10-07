# SoundSky materials (1.2.16)

Uses official Paper React components from `@paper-design/shaders-react` 0.0.81 and its matching core package. No custom Heatmap fragment or CSS shader mask is used.

## Cover Heatmap

Two official Heatmap components receive the loaded jacket URL directly through `image`. Paper performs its native luminance and blur preprocessing; SoundSky does not substitute a rectangle, glyph, or generated silhouette. Both sit behind the fixed artwork frame, with a 14% margin on each side. Only the artwork scales with beats.

- Cool: native outer waves, `innerGlow: 0`, `outerGlow: .5`, transparent deep blue through cyan palette. Its flow speed depends only on Heatmap speed and playback/visibility/reduced-motion state. Audio never changes its time or speed.
- Warm: native inner waves, `outerGlow: 0`, `contour: 0`, transparent red through orange and yellow palette. `innerGlow = min(1, RMS * 3 + onset * 5)` during active playback, otherwise zero. No audio normalization, timeline reset, CSS reveal mask, or opacity modulation is applied.
- Each layer has a 131,072 pixel budget. Cover Heatmap can be disabled in Light settings. Missing artwork produces no Heatmap. Pause, closed/hidden player and reduced motion stop the flow.

## Other materials

LiquidMetal remains on the play button, with audio-dependent flow speed. The backdrop and seek fill use official MeshGradient components. The dark transport housing uses GemSmoke. Every React root is released at teardown. Third-party licenses are included in the build.

Official references:
- https://shaders.paper.design/heatmap
- https://shaders.paper.design/liquid-metal

The browser fixture verifies the official Heatmap fragment hash, autonomous cool animation, warm audio uniforms, pause behavior and saved on/off preference. Synthetic fixture audio checks do not establish reaction on a live SoundCloud track.
