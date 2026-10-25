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
gaps = [bars['firstGap'] + i * bars['step'] for i in range(bars['count'])]

svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {brand["size"]} {brand["size"]}" fill="none">',
    '<title>SoundSky</title>',
    f'<rect width="{brand["size"]}" height="{brand["size"]}" rx="{brand["radius"]}" fill="{brand["background"]}"/>',
    f'<circle cx="{moon["cx"]}" cy="{moon["cy"]}" r="{moon["radius"]}" fill="{brand["foreground"]}"/>',
    f'<circle cx="{cutout["cx"]}" cy="{cutout["cy"]}" r="{cutout["radius"]}" fill="{brand["background"]}"/>',
]
svg.extend(f'<rect x="{x:g}" y="{bars["top"]}" width="{bars["gapWidth"]}" height="{bars["height"]}" fill="{brand["background"]}"/>' for x in gaps)
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
    for x in gaps:
        draw.rectangle((x * scale, bars['top'] * scale,
                        (x + bars['gapWidth']) * scale,
                        (bars['top'] + bars['height']) * scale), fill=brand['background'])
    image.resize((size, size), Image.Resampling.LANCZOS).save(destination / f'{size}.png')
