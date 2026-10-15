"""Offline Gaussian-splat renderer (EWA splatting, CPU) for mockup imagery.

python3 tools/render_splat.py assets/scenes/stump.splat out.jpg --eye X Y Z --at X Y Z [--fov 50] [--size 1200 800]
Reads the antimatter15 .splat layout: pos f32x3, scale f32x3, rgba u8x4, rot u8x4 (w,x,y,z).
The scene's y axis points down, matching up:"ydown" in scenes.js.
"""
import argparse
import numpy as np
from numba import njit
from PIL import Image


def load(path):
    d = np.fromfile(path, dtype=np.uint8).reshape(-1, 32)
    pos = d[:, :12].copy().view(np.float32).astype(np.float64)
    scl = d[:, 12:24].copy().view(np.float32).astype(np.float64)
    rgba = d[:, 24:28].astype(np.float64) / 255.0
    q = d[:, 28:32].astype(np.float64) / 128.0 - 1.0
    q /= np.linalg.norm(q, axis=1, keepdims=True) + 1e-12
    return pos, scl, rgba, q


def look_at(eye, at, up=(0, -1, 0)):
    f = np.asarray(at, float) - eye; f /= np.linalg.norm(f)
    r = np.cross(f, up); r /= np.linalg.norm(r)
    u = np.cross(r, f)
    return np.stack([r, -u, f])  # rows: camera x (right), y (down), z (forward)


@njit(cache=True)
def rasterize(W, H, mx, my, ca, cb, cc, rad, col, alpha, order):
    img = np.zeros((H, W, 3)); T = np.ones((H, W))
    for k in range(order.shape[0]):  # front to back
        i = order[k]
        r = rad[i]
        x0 = max(0, int(mx[i] - r)); x1 = min(W - 1, int(mx[i] + r))
        y0 = max(0, int(my[i] - r)); y1 = min(H - 1, int(my[i] + r))
        for y in range(y0, y1 + 1):
            dy = y + 0.5 - my[i]
            for x in range(x0, x1 + 1):
                t = T[y, x]
                if t < 0.004:
                    continue
                dx = x + 0.5 - mx[i]
                pw = -0.5 * (ca[i] * dx * dx + 2 * cb[i] * dx * dy + cc[i] * dy * dy)
                if pw > 0:
                    continue
                a = min(0.99, alpha[i] * np.exp(pw))
                if a < 1.0 / 255:
                    continue
                for ch in range(3):
                    img[y, x, ch] += col[i, ch] * a * t
                T[y, x] = t * (1 - a)
    return img, T


def render(pos, scl, rgba, q, eye, at, fov, W, H, bg):
    eye = np.asarray(eye, float); R = look_at(eye, at)
    pc = (pos - eye) @ R.T
    keep = pc[:, 2] > 0.05
    pc, scl, rgba, q = pc[keep], scl[keep], rgba[keep], q[keep]
    f = 0.5 * W / np.tan(np.radians(fov) / 2)
    x, y, z = pc.T
    mx = f * x / z + W / 2; my = f * y / z + H / 2
    w, qx, qy, qz = q.T
    Rq = np.stack([
        np.stack([1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - w * qz), 2 * (qx * qz + w * qy)], -1),
        np.stack([2 * (qx * qy + w * qz), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - w * qx)], -1),
        np.stack([2 * (qx * qz - w * qy), 2 * (qy * qz + w * qx), 1 - 2 * (qx * qx + qy * qy)], -1)], 1)
    M = Rq * scl[:, None, :]
    S = M @ M.transpose(0, 2, 1)
    Sc = R @ S @ R.T
    J = np.zeros((len(z), 2, 3))
    J[:, 0, 0] = f / z; J[:, 0, 2] = -f * x / z ** 2
    J[:, 1, 1] = f / z; J[:, 1, 2] = -f * y / z ** 2
    C = J @ Sc @ J.transpose(0, 2, 1)
    a, b, c = C[:, 0, 0] + 0.3, C[:, 0, 1], C[:, 1, 1] + 0.3
    det = a * c - b * b
    ok = (det > 0) & (mx > -200) & (mx < W + 200) & (my > -200) & (my < H + 200)
    lam = 0.5 * (a + c) + np.sqrt(np.maximum(0.1, (0.5 * (a - c)) ** 2 + b * b))
    rad = np.minimum(np.ceil(3 * np.sqrt(lam)), 400)
    idx = np.where(ok)[0]
    order = idx[np.argsort(z[idx])]
    img, T = rasterize(W, H, mx, my, c / det, -b / det, a / det, rad, rgba[:, :3], rgba[:, 3], order)
    img += T[..., None] * np.asarray(bg, float)[None, None, :]
    return np.clip(img, 0, 1)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('splat'); ap.add_argument('out')
    ap.add_argument('--eye', type=float, nargs=3, required=True)
    ap.add_argument('--at', type=float, nargs=3, required=True)
    ap.add_argument('--fov', type=float, default=50)
    ap.add_argument('--size', type=int, nargs=2, default=[1200, 800])
    ap.add_argument('--bg', type=float, nargs=3, default=[0.55, 0.6, 0.62])
    a = ap.parse_args()
    data = load(a.splat)
    img = render(*data, a.eye, a.at, a.fov, a.size[0], a.size[1], a.bg)
    Image.fromarray((img * 255).astype(np.uint8)).save(a.out, quality=92)
    print('wrote', a.out)
