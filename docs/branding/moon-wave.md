# SoundSky: traced B mark

The user selected B from the generated concept board and requested contour-based SVG conversion. `selected-b-source.png` is the complete 560×560 crop of B from that board, including its original tile boundary. It is the source of the production paths.

## Conversion

Run `python3 scripts/icons.py`, then `npm run build`.

The Python script requires Pillow, NumPy, opencv-python, and the `potrace` executable. These tools are needed only to regenerate assets; the normal extension build copies the committed PNGs and SVG and does not require them.

1. Separate the dark mark, blue tile, and neutral surrounding board using deterministic color clustering.
2. Extract the moon, five bars, and tile boundary as separate connected contours.
3. Approximate the contours using Potrace (`alphamax=1`, `opttolerance=0.2`, coordinates quantized to 0.1 source pixels).
4. Keep each contour's shape. Center the bars on the moon's bounding-box centerline and make their edge-to-edge gaps uniform by translation, rounded to 0.5 source pixels. Widths, lengths, curvature, and moon shape are preserved.
5. Generate `src/brand.json`, `public/icons/soundsky.svg`, and 16/32/48/128px RGBA PNGs from the traced curves. `src/icons.ts` retains the same paths for SoundSky brand uses. The Now Playing header uses the separate SoundCloud mark in `src/soundcloud-mark.json`, sourced from the official media kit; entry controls use the music glyph.

The tile's corner profile and padding are also traced, rather than replaced with a guessed rounded rectangle. Flat colors are sampled from the median foreground/background colors in the source.

## Verification

Before alignment, rasterized traced paths are compared with their extracted source contours. At 560px source resolution, this revision has mean symmetric edge distances of 0.07–0.33px across the components, and a maximum measured raster edge distance of 1px. Alignment is reported separately; source-to-trace metrics do not include the intentional translations.

The exported SVG is independently rendered through macOS Quick Look and compared with the PNG. Original contours, traced contours, edge overlay, translations, per-component metrics, and a size comparison are saved locally in `artifacts/branding/trace-b/`.

The full generated board and prompt remain locally in `artifacts/branding/redesign-2026-10-27/`. The former hand-redrawn implementation is superseded by these traced paths.
