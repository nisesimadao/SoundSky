# SoundSky: record + orbit

An ivory record with a periwinkle orbit on a deep navy tile. The generated concept was redrawn as circles and an elliptical arc so the artwork stays editable and scales to toolbar sizes.

- Shared geometry and colors: `src/brand.json`
- In-page mark: `src/icons.ts`
- Editable vector: `public/icons/soundsky.svg`
- Extension icons: `public/icons/{16,32,48,128}.png`
- Regenerate with `python3 scripts/icons.py` (requires Pillow), then `npm run build`.

The concept and size comparison are saved locally in `artifacts/branding/record-orbit-concept.png` and `artifacts/branding/icon-preview.png`.

## Generation prompt

Generated using the built-in image generation tool, then rebuilt geometrically for production:

> Use case: logo-brand. Asset type: final icon concept for SoundSky, a refined SoundCloud music player browser extension. Design a single beautiful geometric symbol combining a vinyl record with one orbital ring, evocative of music and the night sky. Minimal flat vector aesthetic, a bold memorable silhouette that works at 16px. A pale ivory/silver vinyl disc, two restrained dark concentric groove details and a tiny center hole, with one graceful pale periwinkle orbital ellipse slanting from lower left to upper right, partially occluded by the disc and crossing in front along its lower part. Center the symbol on a square near-black navy tile with softly rounded corners. The disc and orbital ring together fill about 78% of the tile. Crisp smooth geometric edges, balanced negative space, premium modern audio brand, restrained and confident. Flat colors only. No lettering, no wordmark, no star decoration, no glow, no shadows, no texture, no 3D, no mockup, no extra panels. One square app icon, shown straight on.
