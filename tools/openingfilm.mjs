// The opening film (assets/launch/opening.mp4): the glide, the shot and the spin, recorded frame by frame from Studium's own
// renderer at full quality (launch.js, ?dev&filmcap). Each frame waits until the scan has finished relighting, sorting and
// filling in its detail for that view. Needs `node build.mjs --web` and ffmpeg. Slow in software: run it in the background.
//   node tools/openingfilm.mjs                    record every frame to tests/out/film/, then encode
//   node tools/openingfilm.mjs --from 400         carry on from frame 400 (frames already on disk are kept)
//   node tools/openingfilm.mjs --step 30          a quick look: every 30th frame only, no encode
//   node tools/openingfilm.mjs --encode           encode what's on disk
//   --ss 2   draw at twice the size and scale down (smoother edges, four times the time)   --gpu   use the graphics card
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(ROOT, 'dist', 'web'), DIR = join(ROOT, 'tests', 'out', process.env.FILM_DIR || 'film');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? +process.argv[i + 1] : true); };
const FROM = arg('--from', 0), STEP = arg('--step', 1), SS = arg('--ss', 1), ENCODE_ONLY = arg('--encode', false), W = 1920, H = 1080;
mkdirSync(DIR, { recursive: true });
const name = (i) => join(DIR, `f${String(i).padStart(4, '0')}.png`);

function encode() {
  const out = join(ROOT, 'assets', 'launch', 'opening.mp4');
  /* H.264 High at 1080p60 plays on hardware everywhere; scaled down with lanczos when drawn larger; faststart so it can begin before it's all in */
  execSync(`ffmpeg -y -loglevel error -framerate 60 -i "${join(DIR, 'f%04d.png')}" -vf "scale=${W}:${H}:flags=lanczos,format=yuv420p" -c:v libx264 -preset veryslow -crf 17 -tune film -profile:v high -level 4.2 -movflags +faststart -an "${out}"`, { stdio: 'inherit' });
  console.log('encoded', out, (statSync(out).size / 1e6).toFixed(1), 'MB');
  /* the same in VP9, for browsers built without H.264 */
  const wb = out.replace(/\.mp4$/, '.webm');
  execSync(`ffmpeg -y -loglevel error -framerate 60 -i "${join(DIR, 'f%04d.png')}" -vf "scale=${W}:${H}:flags=lanczos,format=yuv420p" -c:v libvpx-vp9 -crf 22 -b:v 0 -row-mt 1 -deadline good -cpu-used 1 -an "${wb}"`, { stdio: 'inherit' });
  console.log('encoded', wb, (statSync(wb).size / 1e6).toFixed(1), 'MB');
}
if (ENCODE_ONLY) { encode(); process.exit(0); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok));
/* --gpu: a real graphics card (EGL, as on a cloud GPU machine); otherwise the software renderer, which is very slow */
const GPU = arg('--gpu', false), BG = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'];
const browser = await chromium.launch(GPU ? { channel: 'chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', ...BG] } : { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...BG] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SS });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_detail', 'full'); localStorage.setItem('studium_upscale', 'off'); localStorage.setItem('studium_launch_seen', '1'); } catch (e) {} });
page.on('pageerror', (e) => console.log('page error:', String(e)));
page.setDefaultTimeout(0);
const SW = process.argv.includes('--sw') ? '&sw=' + process.argv[process.argv.indexOf('--sw') + 1] : '';   /* --sw 1,1.1: try another swing for the circle */
await page.goto(`http://localhost:${server.address().port}/index.html?dev&filmcap&noauto${SW}`);
await page.waitForFunction(() => window.__fc, null, { timeout: 120000 });
const t0 = Date.now(); let st = '';
for (;;) { st = await page.evaluate(() => __fc.prep()); if (st === 'ready') break; await page.waitForTimeout(250); if (Date.now() - t0 > 30 * 60000) throw new Error('never ready: ' + st); }
console.log('ready in', Math.round((Date.now() - t0) / 1000), 's');
const N = await page.evaluate(() => __fc.frames());
for (let i = 0; i <= N; i++) {
  const keep = i >= FROM && i % STEP === 0 && !(existsSync(name(i)) && STEP === 1);
  const ts = Date.now(); const r = await page.evaluate(([i, k]) => __fc.frame(i, k), [i, keep]);
  if (r) { writeFileSync(name(i), Buffer.from(r.png.split(',')[1], 'base64')); console.log(`frame ${i}/${N}  ${((Date.now() - ts) / 1000).toFixed(1)} s  (${r.n} draws)`); }
}
console.log('pose at the end', JSON.stringify(await page.evaluate(() => __fc.pose())));
await browser.close(); server.close();
if (STEP === 1 && readdirSync(DIR).filter((f) => f.endsWith('.png')).length >= N + 1) encode();
