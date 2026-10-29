// Sound tests for the opening: each soundtrack option, and each shutter, laid under the film itself, to watch and compare.
// Renders the synthesised sound offline (launch.js sdRenderFilm) on the film's own clock, then muxes it with
// assets/launch/opening.mp4 at 720p. Needs `node build.mjs --web` and ffmpeg.
//   node tools/openingsound.mjs        → tests/out/sound/sound-<n>-<name>.mp4 (whole opening) and shutter-<n>-<name>.mp4 (the shot)
//   --only 6,7,8   just those soundtracks      --noshut   no shutter clips
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(ROOT, 'dist', 'web'), OUT = join(ROOT, 'tests', 'out', 'sound'), FILM = join(ROOT, 'assets', 'launch', 'opening.mp4');
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('page error:', String(e)));
await page.goto(`http://localhost:${server.address().port}/index.html?dev&noauto`);
await page.waitForFunction(() => window.__sd, null, { timeout: 120000 });
const names = await page.evaluate(() => __sd.names());
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
const mux = (wav, out, from, to) => execSync(`ffmpeg -y -loglevel error ${from != null ? `-ss ${from} -to ${to} ` : ''}-i "${FILM}" ${from != null ? `-ss ${from} -to ${to} ` : ''}-i "${wav}" -map 0:v -map 1:a -vf scale=1280:720 -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "${out}"`);
async function one(v, sh, out, from, to) {
  const r = await page.evaluate(([v, sh]) => __sd.film(v, sh), [v, sh]);
  const wav = out.replace(/\.mp4$/, '.wav'); writeFileSync(wav, Buffer.from(r.wav, 'base64')); mux(wav, out, from, to);
  console.log(out.split('/').pop(), 'peak', r.peak);
}
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',').map(Number) : null;
for (let v = 0; v < names.snd.length; v++) if (!ONLY || ONLY.includes(v)) await one(v, names.now[1], join(OUT, `sound-${v}-${slug(names.snd[v])}.mp4`));
if (!process.argv.includes('--noshut')) for (let s = 1; s < names.shut.length; s++) await one(names.now[0], s, join(OUT, `shutter-${s}-${slug(names.shut[s])}.mp4`), 8.6, 13.4);
await browser.close(); server.close();
