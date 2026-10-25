# Thin a .stm scan for a light dev build: keeps the most opaque fraction of the splats (the same rule the app's
# detail levels use), re-packed in the same layout.  python3 tools/thin_stm.py in.stm out.stm --keep 0.4
import sys, zlib, struct, numpy as np
src, dst = sys.argv[1], sys.argv[2]; keep = float(sys.argv[sys.argv.index('--keep') + 1]) if '--keep' in sys.argv else 0.4
raw = zlib.decompress(open(src, 'rb').read()); assert raw[:4] == b'STM1'
n = struct.unpack_from('<I', raw, 4)[0]; hdr = raw[:40]; b = np.frombuffer(raw, np.uint8, offset=40)
planes = [b[ch * 2 * n:(ch + 1) * 2 * n].reshape(2, n) for ch in range(6)]          # lo bytes then hi bytes, per channel
attrs = b[12 * n:12 * n + 8 * n].reshape(8, n)                                      # colour r g b a, rotation x4
alpha = attrs[3].astype(np.float64)
score = alpha + ((np.arange(n, dtype=np.uint64) * np.uint64(2654435761)) & np.uint64(0xffffffff)) / 4294967296.0
score[alpha < 5] = -np.inf
want = int(round(n * keep)); order = np.argsort(-score, kind='stable'); sel = np.zeros(n, bool); sel[order[:want]] = True
sel &= np.isfinite(score); m = int(sel.sum())
body = b''.join(pl[0][sel].tobytes() + pl[1][sel].tobytes() for pl in planes) + b''.join(attrs[k][sel].tobytes() for k in range(8))
out = zlib.compress(b'STM1' + struct.pack('<I', m) + hdr[8:40] + body, 9)
open(dst, 'wb').write(out); print(f'{src}: {n} -> {m} splats, {len(out)/1e6:.1f} MB')
