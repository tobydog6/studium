"""Fit a keyed lens cut-out to the hero body's mount by matching its rear end to the 24-70's.

python3 tools/fit_lens.py lens-cut.png out.png [--ref design/renders/lenses/lens-2470-cut.png]
"""
import argparse
import numpy as np
from PIL import Image

def rear(img):
    a = np.asarray(img)[..., 3] > 128
    xs = np.where(a.any(0))[0]; x0 = xs.min()
    ys = np.where(a[:, x0:x0 + 30].any(1))[0]
    return x0, ys.min(), ys.max()

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--ref', default='design/renders/lenses/lens-2470-cut.png')
a = ap.parse_args()
ref = Image.open(a.ref); im = Image.open(a.src).convert('RGBA'); W, H = im.size
zx, zt, zb = rear(ref); nx, nt, nb = rear(im)
s = (zb - zt) / (nb - nt)
big = im.resize((round(W * s), round(H * s)), Image.LANCZOS)
ox = zx - round(nx * s); oy = round((zt + zb) / 2 - (nt + nb) / 2 * s)
c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.paste(big, (ox, oy), big); c.save(a.out)
print(f'scale {s:.3f}  offset ({ox},{oy})  bbox {c.getbbox()}')
