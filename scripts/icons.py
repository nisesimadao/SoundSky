"""Render the shared moon-and-wave brand as SVG and extension PNG icons."""
import json
from pathlib import Path

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
brand = json.loads((root / 'src/brand.json').read_text())
destination = root / 'public/icons'
destination.mkdir(exist_ok=True)
moon, bars = brand['moon'], brand['bars']
cutout = moon['cutout']
# Keep the crescent on the right; waveform bars are separate, round-ended shapes.
left = moon['cx'] - moon['radius']
top = moon['cy'] - moon['radius']
svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {brand["size"]} {brand["size"]}" fill="none">',
    '<title>SoundSky</title>',
    f'<rect width="{brand["size"]}" height="{brand["size"]}" rx="{brand["radius"]}" fill="{brand["background"]}"/>',
    f'<circle cx="{moon["cx"]}" cy="{moon["cy"]}" r="{moon["radius"]}" fill="{brand["foreground"]}"/>',
    f'<circle cx="{cutout["cx"]}" cy="{cutout["cy"]}" r="{cutout["radius"]}" fill="{brand["background"]}"/>',
    f'<rect x="{left:g}" y="{top:g}" width="{moon["split"] - left:g}" height="{moon["radius"] * 2:g}" fill="{brand["background"]}"/>',
]
svg.extend(f'<rect x="{bar["x"]}" y="{bar["y"]}" width="{bar["width"]}" height="{bar["height"]}" rx="{bar["width"] / 2:g}" fill="{brand["foreground"]}"/>' for bar in bars)
svg.append('</svg>')
(destination / 'soundsky.svg').write_text('\n'.join(svg) + '\n')

for size in (16, 32, 48, 128):
    pixels = size * 8
    scale = pixels / brand['size']
    image = Image.new('RGBA', (pixels, pixels), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, pixels - 1, pixels - 1),
                           radius=brand['radius'] * scale, fill=brand['background'])

    def circle(shape, color):
        draw.ellipse(((shape['cx'] - shape['radius']) * scale,
                      (shape['cy'] - shape['radius']) * scale,
                      (shape['cx'] + shape['radius']) * scale,
                      (shape['cy'] + shape['radius']) * scale), fill=color)

    circle(moon, brand['foreground'])
    circle(cutout, brand['background'])
    draw.rectangle((left * scale, top * scale, moon['split'] * scale,
                    (moon['cy'] + moon['radius']) * scale), fill=brand['background'])
    for bar in bars:
        draw.rounded_rectangle((bar['x'] * scale, bar['y'] * scale,
                                (bar['x'] + bar['width']) * scale,
                                (bar['y'] + bar['height']) * scale),
                               radius=bar['width'] * scale / 2,
                               fill=brand['foreground'])
    image.resize((size, size), Image.Resampling.LANCZOS).save(destination / f'{size}.png')
