"""Render the selected B mark from shared vector geometry."""
import json
from pathlib import Path

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
brand = json.loads((root / 'src/brand.json').read_text())
destination = root / 'public/icons'
destination.mkdir(exist_ok=True)
moon, wave = brand['moon'], brand['wave']


def coordinates(point):
    return ' '.join(f'{value:g}' for value in point)


moon_path = 'M' + coordinates(moon['start']) + ' '
moon_path += ' '.join('C' + ' '.join(coordinates(point) for point in curve) for curve in moon['curves']) + ' Z'
svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {brand["size"]} {brand["size"]}" fill="none">',
    '<title>SoundSky</title>',
    f'<rect width="{brand["size"]}" height="{brand["size"]}" rx="{brand["radius"]}" fill="{brand["background"]}"/>',
    f'<g fill="{brand["foreground"]}">',
]
for i, height in enumerate(wave['heights']):
    x = wave['firstX'] + i * wave['pitch']
    y = wave['centerY'] - height / 2
    svg.append(f'<rect x="{x:g}" y="{y:g}" width="{wave["width"]}" height="{height:g}" rx="{wave["width"] / 2:g}"/>')
svg.extend([f'<path d="{moon_path}"/>', '</g></svg>'])
(destination / 'soundsky.svg').write_text('\n'.join(svg) + '\n')

# Sample the same cubic curves for Pillow without introducing a second geometry.
points = [moon['start']]
previous = moon['start']
for control1, control2, end in moon['curves']:
    for i in range(1, 129):
        t = i / 128
        points.append(tuple((1 - t)**3 * previous[axis]
                            + 3 * (1 - t)**2 * t * control1[axis]
                            + 3 * (1 - t) * t**2 * control2[axis]
                            + t**3 * end[axis] for axis in (0, 1)))
    previous = end

for size in (16, 32, 48, 128):
    pixels = size * 16
    scale = pixels / brand['size']
    image = Image.new('RGBA', (pixels, pixels), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, pixels - 1, pixels - 1),
                           radius=brand['radius'] * scale, fill=brand['background'])
    for i, height in enumerate(wave['heights']):
        x = wave['firstX'] + i * wave['pitch']
        y = wave['centerY'] - height / 2
        draw.rounded_rectangle((x * scale, y * scale, (x + wave['width']) * scale,
                                (y + height) * scale),
                               radius=wave['width'] * scale / 2,
                               fill=brand['foreground'])
    draw.polygon([(x * scale, y * scale) for x, y in points], fill=brand['foreground'])
    image.resize((size, size), Image.Resampling.LANCZOS).save(destination / f'{size}.png')
