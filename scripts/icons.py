"""Render a single crescent silhouette, striped only on its left side."""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

root = Path(__file__).resolve().parent.parent
brand = json.loads((root / 'src/brand.json').read_text())
destination = root / 'public/icons'
destination.mkdir(exist_ok=True)
moon, wave = brand['moon'], brand['wave']
cutout = moon['cutout']
positions = [wave['start'] + i * wave['pitch'] for i in range(wave['count'])]

svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {brand["size"]} {brand["size"]}" fill="none">',
    '<title>SoundSky</title>',
    f'<rect width="{brand["size"]}" height="{brand["size"]}" rx="{brand["radius"]}" fill="{brand["background"]}"/>',
    f'<defs><mask id="moon" maskUnits="userSpaceOnUse" x="0" y="0" width="{brand["size"]}" height="{brand["size"]}" style="mask-type:luminance">',
    f'<circle cx="{moon["cx"]}" cy="{moon["cy"]}" r="{moon["radius"]}" fill="white"/>',
    f'<circle cx="{cutout["cx"]}" cy="{cutout["cy"]}" r="{cutout["radius"]}" fill="black"/>',
    '</mask></defs>',
    f'<g mask="url(#moon)" fill="{brand["foreground"]}">',
    f'<rect x="{wave["split"]}" width="{brand["size"] - wave["split"]}" height="{brand["size"]}"/>',
]
svg.extend(f'<rect x="{x:g}" width="{wave["width"]}" height="{brand["size"]}"/>' for x in positions)
svg.append('</g></svg>')
(destination / 'soundsky.svg').write_text('\n'.join(svg) + '\n')

for size in (16, 32, 48, 128):
    pixels = size * 16
    scale = pixels / brand['size']
    image = Image.new('RGBA', (pixels, pixels), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, pixels - 1, pixels - 1),
                           radius=brand['radius'] * scale, fill=brand['background'])
    silhouette = Image.new('L', image.size)
    draw = ImageDraw.Draw(silhouette)

    def circle(shape, value):
        draw.ellipse(((shape['cx'] - shape['radius']) * scale,
                      (shape['cy'] - shape['radius']) * scale,
                      (shape['cx'] + shape['radius']) * scale,
                      (shape['cy'] + shape['radius']) * scale), fill=value)

    circle(moon, 255)
    circle(cutout, 0)
    stripes = Image.new('L', image.size)
    draw = ImageDraw.Draw(stripes)
    draw.rectangle((wave['split'] * scale, 0, pixels, pixels), fill=255)
    for x in positions:
        draw.rectangle((x * scale, 0, (x + wave['width']) * scale, pixels), fill=255)
    # Every painted pixel, including every bar, belongs to this same crescent.
    mask = ImageChops.multiply(silhouette, stripes)
    image.paste(brand['foreground'], (0, 0, pixels, pixels), mask)
    image.resize((size, size), Image.Resampling.LANCZOS).save(destination / f'{size}.png')
