"""Extract B's raster contours, fit them with Potrace, and export SVG/PNG icons.

Requires Pillow, NumPy, opencv-python, and the potrace executable.
Only component translations are used for alignment; outlines are not redrawn.
"""
import json
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageChops, ImageOps

root = Path(__file__).resolve().parent.parent
source = root / 'docs/branding/selected-b-source.png'
destination = root / 'public/icons'
verification = root / 'artifacts/branding/trace-b'
destination.mkdir(exist_ok=True)
verification.mkdir(parents=True, exist_ok=True)
image = Image.open(source).convert('RGB')
rgb = np.array(image)
height, width = rgb.shape[:2]
assert height == width
size = width
render_scale = 4

# Separate the ink, blue tile, and neutral presentation board. Classification at
# antialiased boundaries finds their midpoint without changing the silhouette.
cv2.setRNGSeed(0)
_, labels, colors = cv2.kmeans(
    rgb.reshape(-1, 3).astype(np.float32), 3, None,
    (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, .1),
    8, cv2.KMEANS_PP_CENTERS)
labels = labels.reshape(height, width)
ink_id = int(np.argmin(colors.sum(axis=1)))
blue_id = int(np.argmax(colors[:, 2] - colors[:, 0]))
board_id = next(i for i in range(3) if i not in (ink_id, blue_id))


def color_hex(cluster):
    color = np.median(rgb[labels == cluster], axis=0).astype(int)
    return '#' + ''.join(f'{channel:02x}' for channel in color)


background, foreground = color_hex(blue_id), color_hex(ink_id)
ink = (labels == ink_id).astype(np.uint8)
count, components, stats, _ = cv2.connectedComponentsWithStats(ink)
component_ids = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] > 25]
assert len(component_ids) == 6, 'Expected five bars and one moon'
moon_id = max(component_ids, key=lambda i: stats[i, cv2.CC_STAT_AREA])
bar_ids = sorted((i for i in component_ids if i != moon_id), key=lambda i: stats[i, 0])

# The tile boundary is extracted too, so its original padding and corner profile
# are retained instead of substituting a guessed rounded rectangle.
tile_mask = (labels != board_id).astype(np.uint8)
contours, _ = cv2.findContours(tile_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
tile_mask[:] = 0
cv2.drawContours(tile_mask, [max(contours, key=cv2.contourArea)], -1, 1, cv2.FILLED)

moon_center = stats[moon_id, 1] + stats[moon_id, 3] / 2
original_gaps = [stats[right, 0] - stats[left, 0] - stats[left, 2]
                 for left, right in zip(bar_ids, bar_ids[1:])]
gap = round(float(np.mean(original_gaps)) * 2) / 2
positions = {}
next_x = float(stats[bar_ids[0], 0])
for component in bar_ids:
    x, y, w, h, _ = stats[component]
    dx = round((next_x - x) * 2) / 2
    dy = round((moon_center - y - h / 2) * 2) / 2
    positions[component] = (dx, dy)
    next_x += w + gap

ns = {'svg': 'http://www.w3.org/2000/svg'}
metrics = {}


def trace(mask, name, work):
    bitmap, vector, raster = (work / f'{name}.{suffix}' for suffix in ('pbm', 'svg', 'pgm'))
    Image.fromarray(255 - mask * 255).convert('1', dither=Image.Dither.NONE).save(bitmap)
    options = ['-t', '2', '-a', '1', '-O', '0.2', '-u', '10']
    subprocess.run(['potrace', str(bitmap), *options, '-s', '-o', str(vector)], check=True)
    subprocess.run(['potrace', str(bitmap), *options, '-b', 'pgm', '-x', str(render_scale),
                    '-G', '1', '-o', str(raster)], check=True)
    svg = ET.parse(vector).getroot()
    group = svg.find('svg:g', ns)
    path = ' '.join(' '.join(node.attrib['d'].split()) for node in group.findall('svg:path', ns))
    alpha = ImageOps.invert(Image.open(raster).convert('L'))
    rendered = np.array(alpha.resize((size, size), Image.Resampling.LANCZOS)) >= 128
    original = mask.astype(bool)
    iou = np.logical_and(original, rendered).sum() / np.logical_or(original, rendered).sum()
    # Symmetric nearest-edge distance, measured at the source image resolution.
    source_edge = cv2.Canny(mask * 255, 100, 200) > 0
    vector_edge = cv2.Canny(rendered.astype(np.uint8) * 255, 100, 200) > 0
    to_source = cv2.distanceTransform((~source_edge).astype(np.uint8), cv2.DIST_L2, 5)
    to_vector = cv2.distanceTransform((~vector_edge).astype(np.uint8), cv2.DIST_L2, 5)
    distances = np.concatenate([to_source[vector_edge], to_vector[source_edge]])
    metrics[name] = {'iou': round(float(iou), 6),
                     'mean_edge_distance_px': round(float(distances.mean()), 4),
                     'max_edge_distance_px': round(float(distances.max()), 4)}
    assert distances.mean() < .6 and distances.max() <= 1.5, f'{name}: traced boundary differs from source'
    Image.fromarray(mask * 255).save(verification / f'{name}-source-mask.png')
    alpha.resize((size, size), Image.Resampling.LANCZOS).save(verification / f'{name}-traced-mask.png')
    return {'d': path, 'transform': group.attrib['transform']}, alpha.copy()


with tempfile.TemporaryDirectory(prefix='soundsky-trace-') as temporary:
    work = Path(temporary)
    tile, tile_alpha = trace(tile_mask, 'tile', work)
    paths = []
    mark_alpha = Image.new('L', tile_alpha.size)
    for name, component in [('moon', moon_id), *[(f'bar-{i+1}', c) for i, c in enumerate(bar_ids)]]:
        shape, alpha = trace((components == component).astype(np.uint8), name, work)
        dx, dy = positions.get(component, (0, 0))
        shape['part'] = name
        if dx or dy:
            shape['transform'] = f'translate({dx:g} {dy:g}) ' + shape['transform']
        shifted = Image.new('L', alpha.size)
        shifted.paste(alpha, (round(dx * render_scale), round(dy * render_scale)))
        assert not ImageChops.multiply(mark_alpha, shifted).getbbox(), 'Aligned components overlap'
        mark_alpha = ImageChops.lighter(mark_alpha, shifted)
        metrics[name]['alignment_translation_px'] = [dx, dy]
        paths.append(shape)

    brand = {'size': size, 'background': background, 'foreground': foreground,
             'tile': tile, 'paths': paths}
    (root / 'src/brand.json').write_text(json.dumps(brand, indent=2) + '\n')
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">',
           '<title>SoundSky</title>',
           f'<path d="{tile["d"]}" transform="{tile["transform"]}" fill="{background}"/>',
           f'<g fill="{foreground}">']
    svg.extend(f'<path d="{p["d"]}" transform="{p["transform"]}"/>' for p in paths)
    svg.append('</g></svg>')
    (destination / 'soundsky.svg').write_text('\n'.join(svg) + '\n')

    background_image = Image.new('RGBA', tile_alpha.size, background)
    background_image.putalpha(tile_alpha)
    mark_image = Image.new('RGBA', tile_alpha.size, foreground)
    mark_image.putalpha(mark_alpha)
    result = Image.alpha_composite(background_image, mark_image)
    for pixels in (16, 32, 48, 128):
        result.resize((pixels, pixels), Image.Resampling.LANCZOS).save(destination / f'{pixels}.png')
    result.resize((size, size), Image.Resampling.LANCZOS).save(verification / 'traced-aligned.png')

(verification / 'metrics.json').write_text(json.dumps(metrics, indent=2) + '\n')
print(json.dumps(metrics, indent=2))
