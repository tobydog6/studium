// The opening: demo start → glow → cube (while the scan loads) → dive → orbit → strips → hub. Needs `node build.mjs --web`.
//   node tests/launch.mjs      screenshots to tests/out/launch-*.png
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(ROOT, 'dist', 'web'), OUT = join(ROOT, 'tests', 'out');
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok)); const BASE = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_detail', 'test'); localStorage.removeItem('studium_launch_seen'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|supabase|net::ERR|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
const shot = (n) => page.screenshot({ path: join(OUT, `launch-${n}.png`), timeout: 300000 }).catch(() => console.log('  (screenshot timed out: ' + n + ')'));
const ev = (f, ...a) => page.evaluate(f, ...a);
const until = (ph, ms) => page.waitForFunction((p) => window.__la && (__la.state().phase === p || (!__la.state().on && p === 'end')), ph, { timeout: ms, polling: 100 });
let fail = '';
try {
  await page.goto(BASE + '?dev&noauto&lahold'); await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 90000 });
  const t0 = Date.now(); await page.click('#signin [data-si="demo"]');
  await until('cube', 20000); console.log('cube at', Date.now() - t0, 'ms'); await page.waitForTimeout(1200); await shot('1-cube');
  await until('orbit', 400000); console.log('orbit at', Date.now() - t0, 'ms', await ev(() => __la.state().log)); await page.waitForTimeout(3500); await shot('2-orbit');
  await ev(() => __la.go()); await until('strips', 20000); console.log('strips at', Date.now() - t0, 'ms'); await page.waitForTimeout(3200); await shot('3-strips');
  await ev(() => __la.go()); await until('end', 20000); await page.waitForTimeout(1200); await shot('4-hub');
  console.log('hub:', await ev(() => ({ state: __cb.state(), eb: (document.querySelector('.h6-eb') || {}).textContent, launching: document.body.classList.contains('launching') })));
  // second time: the short version
  await ev(() => { __qu.closeAll(); __la.start(); }); await until('cube', 5000); const t1 = Date.now(); await until('end', 20000); console.log('short version took', Date.now() - t1, 'ms');
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (fail) console.error('FAIL ' + fail);
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'launch: FAIL' : 'launch: OK');
process.exit(fail || errors.length ? 1 : 0);
