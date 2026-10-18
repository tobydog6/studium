"""Join docs/media/walk/*.png (from `node tools/shots.mjs walk`) into docs/media/walk.webp, an animated WebP
(a GIF of a splat scan runs past 15 MB; the WebP is a few). Usage: python3 tools/walk.py [width] [skip]
(default 800 px wide, skipping 2 frames while the scan loads in). Plays in and back out again, so it loops without a jump."""
import glob, os, sys
from PIL import Image

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'media')
files = sorted(glob.glob(os.path.join(root, 'walk', '*.png')))[int(sys.argv[2]) if len(sys.argv) > 2 else 2:]
if not files:
    sys.exit('no frames in docs/media/walk/: run node tools/shots.mjs walk first')
W = int(sys.argv[1]) if len(sys.argv) > 1 else 800
frames = []
for f in files:
    im = Image.open(f).convert('RGB')
    frames.append(im.resize((W, round(im.height * W / im.width)), Image.LANCZOS))
out = frames + frames[-2:0:-1]
dur = [110] * len(out); dur[0] = 1200; dur[len(frames) - 1] = 1600
path = os.path.join(root, 'walk.webp')
out[0].save(path, save_all=True, append_images=out[1:], duration=dur, loop=0, quality=72, method=6)
print('walk.webp', len(out), 'frames', os.path.getsize(path) // 1024, 'KB')
