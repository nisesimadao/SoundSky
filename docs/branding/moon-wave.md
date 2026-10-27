# SoundSky: selected B mark

The user selected concept B from the image-generated A/B/C board on 2026-10-27 and requested alignment refinements. The production artwork redraws that concept as a left-facing crescent beside five rounded audio bars, on a soft blue tile with a dark navy symbol.

## Alignment

- All five bars use the same width (1.5 units), corner radius (0.75), and pitch (2), leaving a 0.5-unit gap on a 24-unit canvas.
- Their heights grow evenly: 3.4, 5.25, 7.1, 8.95, and 10.8 units.
- Every bar is centered on y = 12, matching the crescent's horizontal centerline.
- The moon's upper and lower curves mirror around y = 12. The tips have a subtle radius.
- The last bar is separated from the moon, including its rounded ends.
- The symbol's horizontal bounds are approximately x = 3.4 to 20.5, keeping its left and right margins balanced.
- Background: `#60a3f7`. Mark: `#111329`. Tile corner radius: 4.5 units.

## Sources and regeneration

- Shared geometry: `src/brand.json`
- In-page SVG: `src/icons.ts`
- Editable vector: `public/icons/soundsky.svg`
- Extension PNGs: `public/icons/{16,32,48,128}.png`
- Regenerate with `python3 scripts/icons.py` (requires Pillow), then `npm run build`.

The same cubic curves produce both the SVG path and supersampled PNGs. No masks or shared SVG IDs are required.

The original board and full built-in image-generation prompt are saved locally in `artifacts/branding/redesign-2026-10-27/`. The selected B crop, vector rendering, size comparison, and verification script are in `artifacts/branding/selected-b/`.
