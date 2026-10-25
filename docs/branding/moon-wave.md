# SoundSky: moon + waveform

The mark is one left-facing crescent. Its left portion is divided into bars, and its right portion is solid. Both the outer circle and the inner circular cutout apply to every bar. There is no separate cloud-shaped waveform.

The cyan background (`#00aaff`) and dark navy mark (`#071b2d`) retain the chosen inverted-orange direction. The background fills the square canvas, matching the treatment of the reference icon. The crescent is centered by its visible silhouette rather than the center of its outer circle.

Six bars use a width of roughly 1 unit with a roughly 0.3-unit gap at a 24-unit canvas size. The earlier twelve bars were too thin because their horizontal dimensions had been compressed while their heights were stretched. The new bars are cut from the actual moon outline; their heights do not borrow SoundCloud's cloud profile.

The dark mark occupies approximately 16–17% of the image, compared with approximately 17% for the reference's white mark. The different silhouettes retain their own aspect ratios.

- Shared geometry and colors: `src/brand.json`
- In-page SVG: `src/icons.ts` (a separate mask ID for each instance)
- Editable vector: `public/icons/soundsky.svg`
- Extension icons: `public/icons/{16,32,48,128}.png`
- Regenerate with `python3 scripts/icons.py` (requires Pillow), then `npm run build`.

Current comparison: `artifacts/branding/correction/moon-final-comparison.png`. SVG rendering was checked independently using macOS Quick Look. The PNG mark was also checked against the outer circle and inner cutout to ensure no waveform pixels extend outside the crescent.

Reference: [SoundCloud website touch icon](https://a-v2.sndcdn.com/assets/images/sc-icons/ios-a62dfc8fe7.png), inspected on 2026-10-26. Earlier studies remain under `artifacts/branding/` and are not the current production mark.
