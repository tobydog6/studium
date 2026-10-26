# Cut a scene's subject out of a .stm scan as its own full-detail piece (drawn without level of detail, never thinned).
# The cylinder is in world units, after the scene's "up" turn: x, z, radius, y from, y to (the same numbers as the
# scene's detail.cut, so the main scan hides exactly what this piece draws).
#   python3 tools/cut_subject.py assets/scenes/stump-hd.stm assets/scenes/stump-subject.stm --cut 0.15,-0.12,0.8,-0.3,1.9 --up ydown
import sys, zlib, struct, numpy as np
src, dst = sys.argv[1], sys.argv[2]
cx, cz, r, y0, y1 = [float(v) for v in sys.argv[sys.argv.index('--cut') + 1].split(',')]
up = sys.argv[sys.argv.index('--up') + 1] if '--up' in sys.argv else 'ydown'
raw = zlib.decompress(open(src, 'rb').read()); assert raw[:4] == b'STM1'
n = struct.unpack_from('<I', raw, 4)[0]; f = np.frombuffer(raw[8:40], np.float32); b = np.frombuffer(raw, np.uint8, offset=40)
planes = [b[ch * 2 * n:(ch + 1) * 2 * n].reshape(2, n) for ch in range(6)]
attrs = b[12 * n:12 * n + 8 * n].reshape(8, n)
p = [f[c] + (planes[c][0].astype(np.uint32) | (planes[c][1].astype(np.uint32) << 8)) * (f[3 + c] - f[c]) / 65535 for c in range(3)]
x, y, z = p
X, Y, Z = {'ydown': (x, -y, -z), 'zup': (x, z, -y), 'zdown': (x, -z, y)}.get(up, (x, y, z))
sel = (np.hypot(X - cx, Z - cz) < r) & (Y > y0) & (Y < y1); m = int(sel.sum())
body = b''.join(pl[0][sel].tobytes() + pl[1][sel].tobytes() for pl in planes) + b''.join(attrs[k][sel].tobytes() for k in range(8))
out = zlib.compress(b'STM1' + struct.pack('<I', m) + raw[8:40] + body, 9)
open(dst, 'wb').write(out); print(f'{src}: {m} of {n} splats in the subject, {len(out)/1e6:.1f} MB')
