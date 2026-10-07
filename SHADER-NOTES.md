# SoundSky materials (1.2.18)

Uses official Paper React components from `@paper-design/shaders-react` 0.0.81 and its matching core package. No custom Heatmap fragment is used.

## Cover Heatmap

Two official Heatmap components share a filled rounded-square SVG input. Jacket-image preprocessing has been removed. The opaque panel extends 10px beyond the fixed artwork frame on desktop, 6px on mobile, and clips to a 12px / 10px corner radius. Only the artwork scales with beats.

- Cool: original inner/outer glow and contour parameters, blue/cyan palette. Its flow speed depends only on Heatmap speed and playback/visibility/reduced-motion state. Audio never changes its time or speed.
- Warm: original inner/outer glow and contour parameters, red/orange/yellow palette. The previously used thermal front is restored as a soft vertical reveal: `clamp(RMS * 420 * heatResponse - 12, -18, 110)` percent, with an 18 percentage-point transition. Silence and pause hide the warm layer. The warm material moves at `(0.6 + RMS * 5 + onset * 12) * heatSpeed`; it is never remounted or rewound by an audio hit.
- Each layer has a 131,072 pixel budget. Cover Heatmap can be disabled in the 周囲の光 settings. Red response has an independent 0–3 multiplier, default 1. Missing artwork produces no Heatmap. Pause, closed/hidden player and reduced motion stop the flow.

The material fragments remain the official Paper shaders. The panel's corner clipping and warm reveal restore the previous cover treatment, rather than the later unmasked jacket-image effect.

## Other materials

LiquidMetal remains on the play button, with audio-dependent flow speed. The backdrop and seek fill use official MeshGradient components. The dark transport housing uses GemSmoke. Every React root is released at teardown. Third-party licenses are included in the build.

Official references:
- https://shaders.paper.design/heatmap
- https://shaders.paper.design/liquid-metal

The browser fixture verifies the official Heatmap fragment hash, autonomous cool animation, warm thermal front, pause behavior and saved on/off preference. Synthetic fixture audio checks do not establish reaction on a live SoundCloud track.
