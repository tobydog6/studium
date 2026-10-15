"""Fit a keyed lens cut-out to the hero body's mount.

Matches the top and bottom silhouette edges of the rear part of the lens (the mount ring and
first barrel section) against the reference 24-70, searching scale and offset.
python3 tools/fit_lens.py lens-cut.png out.png [--ref design/renders/lenses/lens-2470-cut.png] [--span 260]
"""
import argparse
import numpy as np
from PIL import Image

def edges(alpha):
    m = alpha > 128
    cols = m.any(0); top = np.full(m.shape[1], np.nan); bot = np.full(m.shape[1], np.nan)
    idx = np.where(cols)[0]
    top[idx] = m[:, idx].argmax(0); bot[idx] = m.shape[0] - 1 - m[::-1, idx].argmax(0)
    return idx.min(), top, bot

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--ref', default='design/renders/lenses/lens-2470-cut.png'); ap.add_argument('--span', type=int, default=260)
a = ap.parse_args()
ref = np.asarray(Image.open(a.ref))[..., 3]; im = Image.open(a.src).convert('RGBA'); W, H = im.size
src = np.asarray(im)[..., 3]
rx0, rtop, rbot = edges(ref); sx0, stop, sbot = edges(src)
xs = np.arange(rx0 + 6, rx0 + a.span)          # reference rear region
best = None
for s in np.arange(0.85, 1.6, 0.005):
    # source x that maps onto each reference x, assuming rear-left points coincide (refined by dx)
    for dx in range(-12, 13, 2):
        sxs = sx0 + (xs - rx0 - dx) / s
        ok = (sxs >= 0) & (sxs < W - 1)
        if ok.sum() < len(xs) * 0.8: continue
        st = np.interp(sxs[ok], np.arange(W), np.nan_to_num(stop, nan=1e9))
        sb = np.interp(sxs[ok], np.arange(W), np.nan_to_num(sbot, nan=-1e9))
        # choose dy to align the means, then score shape mismatch
        rt, rb = rtop[xs[ok]], rbot[xs[ok]]
        dy = np.nanmean(np.r_[rt - st * s, rb - sb * s])
        err = np.nanmean(np.abs(rt - (st * s + dy))) + np.nanmean(np.abs(rb - (sb * s + dy)))
        if best is None or err < best[0]: best = (err, s, dx, dy)
err, s, dx, dy = best
big = im.resize((round(W * s), round(H * s)), Image.LANCZOS)
ox = round(rx0 + dx - sx0 * s); oy = round(dy)
c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.paste(big, (ox, oy), big); c.save(a.out)
print(f'scale {s:.3f}  offset ({ox},{oy})  edge error {err:.1f}px  bbox {c.getbbox()}')
