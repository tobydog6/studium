"""Recover a clean alpha cut-out from an image whose 'transparent' checkerboard was baked in.

python3 tools/key_checker.py in.png out.png [--rgb original_dark.png]
Light neutral checker pixels become transparent; the dark product stays. With --rgb, colours come from
the original dark-background render (no light fringe). Without it, edge pixels are decontaminated.
"""
import argparse
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('--rgb')
a = ap.parse_args()
c = np.asarray(Image.open(a.src).convert('RGB'), float)
L = c.mean(2); sat = c.max(2) - c.min(2)
al = np.clip((228 - L) / 58, 0, 1); al[sat > 40] = 1
al = np.asarray(Image.fromarray((al * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3)), float) / 255
m = al > 0.5; lab, n = nd.label(m); keep = lab == (1 + int(np.argmax(nd.sum(m, lab, range(1, n + 1)))))
keep = nd.binary_dilation(nd.binary_fill_holes(keep), iterations=2)
al = al * keep; al[al < 0.08] = 0
if a.rgb:
    rgb = np.asarray(Image.open(a.rgb).convert('RGB'), float)
else:
    rgb = c.copy()
    edge = (al > 0) & (al < 0.98)
    bg = np.array([240.0, 240.0, 240.0])
    safe = np.clip(al[..., None], 0.15, 1)
    rgb[edge] = np.clip((c[edge] - (1 - safe[edge]) * bg) / safe[edge], 0, 255)
al = np.asarray(Image.fromarray((al * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5)))
Image.fromarray(np.dstack([rgb.astype(np.uint8), al])).save(a.out)
print('wrote', a.out)
