#!/usr/bin/env python3
"""Original Sunny icon: a rising sun above an open book. Pillow is optional tooling."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / 'extension/icons'
ROOT.mkdir(parents=True, exist_ok=True)
SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="27" fill="#203238"/><path d="M28 79V53Q45 48 64 60Q83 48 100 53V89Q82 85 64 96Q45 85 28 89Z" fill="#f8f4e8"/><path d="M64 61V94" stroke="#203238" stroke-width="4"/><path d="M42 44A22 22 0 0 1 86 44Z" fill="#efc14b"/><path d="M64 10V17M29 23L35 29M99 23L93 29" stroke="#efc14b" stroke-width="5" stroke-linecap="round"/></svg>'''
(ROOT / 'sunny.svg').write_text(SVG + '\n', encoding='utf-8')
scale = 4
image = Image.new('RGBA', (128 * scale, 128 * scale))
draw = ImageDraw.Draw(image)
def xy(values): return tuple(round(value * scale) for value in values)
draw.rounded_rectangle(xy((0, 0, 127, 127)), radius=27 * scale, fill='#203238')
draw.polygon([xy(p) for p in [(28, 53), (44, 52), (64, 60), (84, 52), (100, 53), (100, 89), (83, 88), (64, 96), (45, 88), (28, 89)]], fill='#f8f4e8')
draw.line([xy((64, 61)), xy((64, 94))], fill='#203238', width=4 * scale)
draw.pieslice(xy((42, 22, 86, 66)), 180, 360, fill='#efc14b')
for a, b in [((64, 10), (64, 17)), ((29, 23), (35, 29)), ((99, 23), (93, 29))]:
    draw.line([xy(a), xy(b)], fill='#efc14b', width=5 * scale)
for size in (16, 32, 48, 128):
    image.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / f'icon{size}.png')
print('Generated original SVG and four PNG sizes.')
