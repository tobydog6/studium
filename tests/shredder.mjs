// Light table room: opens Studio > Table with a few frames, checks the iframe boots, walks a little of its tour,
// and sends the board to the Workbook. Needs `node build.mjs --web`. Screenshots: tests/out/lt-*.png
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(ROOT, 'dist', 'web'), OUT = join(ROOT, 'tests', 'out');
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ').slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error' && !/supabase|net::ERR|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
const shot = (n) => page.evaluate(() => { document.querySelectorAll('#loader,#rackin,.launch,#launch,#laOverlay').forEach(e=>e.style.display='none'); }).then(() => page.locator('iframe.lt-frame').screenshot({ path: join(OUT, `lt-${n}.png`), timeout: 120000 })).catch(() => console.log('  (no screenshot ' + n + ')'));
let fail = '';
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await page.waitForTimeout(8000);
  await page.evaluate(() => { const cols = ['#7a8f6e', '#c58b52', '#3d5a7a', '#a35d4a', '#d9c9a3'];
    cols.forEach((c, i) => { const cv = document.createElement('canvas'); cv.width = i % 2 ? 600 : 900; cv.height = i % 2 ? 900 : 600; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#fff'; g.font = '120px sans-serif'; g.fillText('F' + i, 80, 300);
      __cb.addPhoto({ url: cv.toDataURL('image/jpeg', 0.8), place: 'Stump', pick: i < 2 }); });
    const si = document.getElementById('signin'); if (si) si.style.display = 'none';
    __cb.stOpen('table'); });
  await page.waitForFunction(() => { const f = __cb.lt(); return f && f.contentWindow && f.contentWindow.__lt && f.contentWindow.document.body.classList.contains('ready'); }, null, { timeout: 120000, polling: 500 });
  const fr = page.frames().find((f) => f.url() === 'about:srcdoc');
  await page.waitForTimeout(2000);
  await fr.evaluate(() => { __lt.tourEnd && __lt.tourEnd(false); if(!__lt.prints.length) __lt.pullOut(__lt.library.slice(0,4).map(i=>i.id)); });
  await page.waitForTimeout(2500);
  const n = await fr.evaluate(() => { __lt.prints.slice(0,3).forEach(p=>__lt.reject(p)); return { prints: __lt.prints.length, rejects: __lt.rejects.length }; });
  console.log('  before:', JSON.stringify(n)); await fr.evaluate(() => __lt.focus('board')); await page.waitForTimeout(2500); await shot('felt-board'); await fr.evaluate(() => __lt.focus('table')); await page.waitForTimeout(1500); await shot('shred-0-box');
  await fr.evaluate(() => __lt.shredAll()); await page.waitForTimeout(1000); console.log('  cam:', JSON.stringify(await fr.evaluate(() => ({ tx:__lt.cam.tx, ty:__lt.cam.ty, tz:__lt.cam.tz, p:__lt.cam.pitch, d:__lt.cam.d, dT:__lt.cam.dT, cp:__lt.cam.curPitch, view:__lt.cam.view, busy:__lt.SH.busy })))); await page.waitForTimeout(1100); await shot('shred-1-feeding');
  await fr.evaluate(() => { const c=__lt.cam; c.cx=c.tx; c.cy=c.ty; c.cz=c.tz; c.curPitch=c.pitch; c.d=c.dT; }); await fr.evaluate(() => { const c=__lt.cam; c.cx=c.tx; c.cy=c.ty; c.cz=c.tz; c.curPitch=c.pitch; c.d=c.dT; }); await page.waitForTimeout(2500); await shot('shred-2-strips'); await fr.evaluate(() => { const c=__lt.cam; c.cx=c.tx; c.cy=c.ty; c.cz=c.tz; c.curPitch=c.pitch; c.d=c.dT; }); await page.waitForTimeout(3000); await shot('shred-2b-pile');
  await page.waitForTimeout(9000); await shot('shred-3-back');
  const m = await fr.evaluate(() => ({ prints: __lt.prints.length, rejects: __lt.rejects.length, lib: __lt.library.length, strips: __lt.SH.strips.length, busy: __lt.SH.busy }));
  console.log('  after:', JSON.stringify(m));
  if (m.rejects !== 0 || m.busy) fail = 'shred did not finish';
} catch (e) { fail = String(e); }
console.log(errors.length ? errors.join('\n') : '  no page errors'); console.log(fail ? 'shredder: FAIL ' + fail : 'shredder: OK');
await browser.close(); server.close(); process.exit(fail ? 1 : 0);
