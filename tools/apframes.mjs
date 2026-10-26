// Renders the warm-up's aperture frames (assets/coach/ap-0..6.jpg): the Stump from the shallow-depth-of-field gold frame
// on the 85 mm, focused on the stump, from f/1.4 to f/16. Needs `node build.mjs --web --only stump` (full detail).
//   node tools/apframes.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(ROOT, 'dist', 'web');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok)); const BASE = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_detail', 'balanced'); } catch (e) {} });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(BASE + '?dev&noauto'); await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 90000 });
await page.click('#signin [data-si="demo"]');
await page.waitForFunction(() => window.__cb && __cb.state() === 'scene' && window.__ch && __ch.pads().length >= 2, null, { timeout: 400000, polling: 500 });
await page.evaluate(() => { __qu.closeAll(); if (window.__co) try { __co.stop && __co.stop(); } catch (e) {} });
await page.addStyleTag({ content: '#hud,#navTop,#navActs,#chCard,#chGlow,#qHud,#coCard,#coRing,#toast,#vfToast,#vfHints,#vfStrip,#vfComp,#vfTop,#vfBot,#chDone,.ach-card,#prompt,#orient,#crosshair{display:none!important;visibility:hidden!important}' });
const F = [1.4, 2, 2.8, 4, 5.6, 8, 16];
const ONLY = process.argv[2] ? process.argv[2].split(',').map(Number) : F.map((_, i) => i);   /* node tools/apframes.mjs 0,5,6  renders just those stops */
await page.evaluate(() => { const i = __ch.pads().findIndex((p) => p.id === 'stump-dof'); __ch.force(-1); __ch.goto(i); __ch.aim(i); __ch.set({ mm: 70, f: 1.4, meter: true }); });
await page.waitForTimeout(1500);
await page.evaluate(() => { __cam.raise(); __cam.af(); }); await page.waitForTimeout(6000);
for (const k of ONLY) {
  await page.evaluate((f) => { __cam.set({ iso: f <= 1.4 ? 0 : f <= 2.8 ? 2 : f <= 5.6 ? 3 : f <= 8 ? 4 : 6 }); __ch.set({ f: f, meter: true }); }, F[k]);   /* ISO 6400 keeps the shutter fast, so no handheld blur (ISO adds no grain here) */
  await page.waitForTimeout(7000);
  const n0 = await page.evaluate(() => __ed.photos.length);
  await page.keyboard.press('Enter');   /* the real shutter: the frame comes out of Studium's own capture, UI-free */
  await page.waitForFunction((n) => __ed.photos.length > n && __ed.photos[__ed.photos.length - 1].url, n0, { timeout: 120000, polling: 300 });
  const url = await page.evaluate(() => __ed.photos[__ed.photos.length - 1].url);
  const b64 = url.split(',')[1]; writeFileSync(join(ROOT, 'assets', 'coach', `ap-${k}.src.png`), Buffer.from(b64, 'base64')); console.log('ap-' + k + ' f/' + F[k], url.slice(0, 30), b64.length);
}
await browser.close(); server.close();
