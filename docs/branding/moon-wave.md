# SoundSky: moon + waveform

The user's direction is a moon with the left half divided into audio bars, paired with a blue/cyan palette inspired by hue inversion of SoundCloud's orange. The mark is drawn directly as vector geometry.

The current icon uses a cyan tile (`#00aaff`) and a dark navy moon (`#071b2d`). Twelve independent, narrow bars with rounded ends form the left-side waveform. Their widths, spacing, and varying heights follow the fine-bar silhouette used in SoundCloud's website touch icon. The crescent on the right opens to the left; its circular cutout is mirrored without moving the waveform to the right. The same geometry is used at every size and for the in-page logo.

- Shared geometry and colors: `src/brand.json`
- In-page mark: `src/icons.ts`
- Editable vector: `public/icons/soundsky.svg`
- Extension icons: `public/icons/{16,32,48,128}.png`
- Regenerate with `python3 scripts/icons.py` (requires Pillow), then `npm run build`.

The current comparison is saved locally in `artifacts/branding/moon-refined-preview.png`. Earlier color studies remain in `artifacts/branding/moon-preview.png`.

Fine-bar reference: [SoundCloud website touch icon](https://a-v2.sndcdn.com/assets/images/sc-icons/ios-a62dfc8fe7.png), linked by the SoundCloud homepage and inspected on 2026-10-26.

Research sources included [SoundCloud](https://soundcloud.com/company/media-kit), [Spotify](https://newsroom.spotify.com/media-kit/logo-and-brand-assets/), [Linear](https://linear.app/brand), [Endel](https://endel.io/), and [Raycast](https://www.raycast.com/press). The reference comparison is saved locally in `artifacts/branding/references/icon-study.png` with source URLs in `sources.json` alongside it.
