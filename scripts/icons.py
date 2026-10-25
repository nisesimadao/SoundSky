"""Render the shared record-and-orbit brand as SVG and extension PNG icons."""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
brand = json.loads((root / 'src/brand.json').read_text())
destination = root / 'public/icons'
destination.mkdir(exist_ok=True)
disc, orbit = brand['disc'], brand['orbit']
angle = math.radians(orbit['rotation'])


def orbit_point(t):
    x, y = orbit['rx'] * math.cos(t), orbit['ry'] * math.sin(t)
    return (disc['cx'] + x * math.cos(angle) - y * math.sin(angle),
            disc['cy'] + x * math.sin(angle) + y * math.cos(angle))


start, end = orbit_point(0), orbit_point(math.pi)
svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {brand["size"]} {brand["size"]}" fill="none">',
    '<title>SoundSky</title>',
    f'<rect width="{brand["size"]}" height="{brand["size"]}" rx="{brand["radius"]}" fill="{brand["background"]}"/>',
    f'<ellipse cx="{disc["cx"]}" cy="{disc["cy"]}" rx="{orbit["rx"]}" ry="{orbit["ry"]}" transform="rotate({orbit["rotation"]} {disc["cx"]} {disc["cy"]})" stroke="{orbit["color"]}" stroke-width="{orbit["strokeWidth"]}"/>',
    f'<circle cx="{disc["cx"]}" cy="{disc["cy"]}" r="{disc["radius"]}" fill="{disc["color"]}"/>',
]
svg.extend(f'<circle cx="{disc["cx"]}" cy="{disc["cy"]}" r="{radius}" stroke="{brand["background"]}" stroke-width="{disc["grooveWidth"]}"/>' for radius in disc['grooves'])
svg.extend([
    f'<circle cx="{disc["cx"]}" cy="{disc["cy"]}" r="{disc["holeRadius"]}" fill="{brand["background"]}"/>',
    f'<path d="M{start[0]:.6f} {start[1]:.6f} A{orbit["rx"]} {orbit["ry"]} {orbit["rotation"]} 0 1 {end[0]:.6f} {end[1]:.6f}" stroke="{orbit["color"]}" stroke-width="{orbit["strokeWidth"]}" stroke-linecap="round"/>',
    '</svg>',
])
(destination / 'soundsky.svg').write_text('\n'.join(svg) + '\n')

for size in (16, 32, 48, 128):
    pixels = size * 8
    scale = pixels / brand['size']
    image = Image.new('RGBA', (pixels, pixels), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, pixels - 1, pixels - 1),
                           radius=brand['radius'] * scale, fill=brand['background'])

    def circle(radius, color, width=None):
        box = ((disc['cx'] - radius) * scale, (disc['cy'] - radius) * scale,
               (disc['cx'] + radius) * scale, (disc['cy'] + radius) * scale)
        if width is None:
            draw.ellipse(box, fill=color)
        else:
            # Pillow draws an outline inside its bounds; center it like SVG.
            half = width * scale / 2
            box = (box[0] - half, box[1] - half, box[2] + half, box[3] + half)
            draw.ellipse(box, outline=color, width=round(width * scale))

    def orbital_arc(stop):
        points = [tuple(value * scale for value in orbit_point(stop * i / 256)) for i in range(257)]
        width = orbit['strokeWidth'] * scale
        draw.line(points, fill=orbit['color'], width=round(width), joint='curve')
        for x, y in (points[0], points[-1]):
            draw.ellipse((x - width / 2, y - width / 2, x + width / 2, y + width / 2), fill=orbit['color'])

    orbital_arc(2 * math.pi)
    circle(disc['radius'], disc['color'])
    for radius in disc['grooves']:
        circle(radius, brand['background'], disc['grooveWidth'])
    circle(disc['holeRadius'], brand['background'])
    orbital_arc(math.pi)
    image.resize((size, size), Image.Resampling.LANCZOS).save(destination / f'{size}.png')
