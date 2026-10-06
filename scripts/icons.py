"""Render extension icons from the same brand geometry as the in-page logo."""
from PIL import Image, ImageDraw
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
brand = json.loads((root / 'src/brand.json').read_text())
(root / 'public/icons').mkdir(exist_ok=True)
for size in (16, 32, 48, 128):
    pixels = size * 4
    scale = pixels / brand['size']
    image = Image.new('RGBA', (pixels, pixels), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, pixels - 1, pixels - 1),
                           radius=brand['radius'] * scale, fill=brand['background'])
    for wave in brand['waves']:
        points = [(x * scale, y * scale) for x, y in wave['points']]
        draw.line(points, fill=wave['color'],
                  width=max(3, round(brand['strokeWidth'] * scale)), joint='curve')
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / f'public/icons/{size}.png')
