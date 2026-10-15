"""Shared 'darkroom' grade for product renders so every camera matches.

python3 tools/grade_render.py in.png out.png [--warm 1.0] [--depth 1.0] [--clarity 1.0]
Deepens blacks, warms highlights toward brass, adds micro-contrast to texture.
"""
import argparse
import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--warm', type=float, default=1.0)
ap.add_argument('--depth', type=float, default=1.0)
ap.add_argument('--clarity', type=float, default=1.0)
a = ap.parse_args()

im = Image.open(a.src).convert('RGBA')
rgb = np.asarray(im, float)[..., :3] / 255
alpha = np.asarray(im)[..., 3]

# micro-contrast: unsharp mask at a texture-sized radius
blur = np.asarray(im.convert('RGB').filter(ImageFilter.GaussianBlur(6)), float) / 255
rgb = rgb + 0.55 * a.clarity * (rgb - blur)

# tone: deeper blacks with a soft toe, gentle highlight shoulder
L = rgb.mean(2, keepdims=True)
toe = np.clip(L / 0.18, 0, 1) ** (0.35 * a.depth)
rgb = rgb * (0.82 + 0.18 * toe) - 0.012 * a.depth
rgb = np.clip(rgb, 0, None)
rgb = rgb / (1 + 0.15 * rgb)

# warmth weighted to midtones and highlights, toward brass (#e3ad57-ish)
L = rgb.mean(2, keepdims=True)
w = np.clip((L - 0.06) / 0.5, 0, 1) * a.warm
tint = np.array([1.10, 1.02, 0.86])
rgb = rgb * (1 - w * 0.55 + w * 0.55 * tint)

out = np.clip(rgb * 255, 0, 255).astype(np.uint8)
Image.fromarray(np.dstack([out, alpha])).save(a.out)
print('wrote', a.out)
