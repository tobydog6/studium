// The warm-up's cards, photographed: dismisses the welcome card, then walks the basics tour with __co.go(), opening
// the bag and the camera back when a step lives there, and screenshots the steps listed (0-based).
//   node tests/coach-shots.mjs 0,1,3,7,10,12,14
// Needs `node build.mjs --web`. Screenshots go to tests/out/coach-*.png.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(ROOT, 'dist', 'web'), OUT = join(ROOT, 'tests', 'out');
if (!existsSync(join(WEB, 'index.html'))) { console.error('No dist/web: run `node build.mjs --web` first'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const SHOTS = (process.argv[2] || '0,1,3,7,10,12,14').split(',').map(Number), LAST = Math.max(...SHOTS);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok)); const BASE = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_launch_seen', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|supabase|net::ERR|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
let fail = '';
try {
  await page.goto(BASE + '?dev&demo&quick');
  await page.waitForFunction(() => window.__co && __co.state().on && __co.state().tour === 'basics' && window.__cb && __cb.state() === 'scene', null, { timeout: 400000, polling: 500 });
  await page.evaluate(() => { __qu.closeAll(); const w = document.getElementById('laWel'); if (w && w.classList.contains('show')) { const b = w.querySelector('[data-lw="go"]'); if (b) b.click(); } });
  await page.waitForTimeout(2500);
  for (let k = 0; k <= LAST; k++) {
    const s = await page.evaluate(() => __co.state()); if (!s.on) break;
    const where = await page.evaluate(() => { const t = document.querySelector('#coCard .co-line'); return t ? t.innerText : ''; });
    if (/Open the bag again/.test(where)) { await page.keyboard.press('KeyB'); await page.waitForTimeout(2500); }
    if (/Open the settings again/.test(where)) { await page.evaluate(() => __co.back()); await page.waitForTimeout(2500); }
    if (/Raise the camera first/.test(where)) { await page.keyboard.press('KeyP'); await page.waitForTimeout(1500); }
    if (SHOTS.includes(k)) { await page.waitForTimeout(1800); await page.screenshot({ path: join(OUT, `coach-${k}.png`) }); }
    const txt = await page.evaluate(() => { const e = document.querySelector('#coCard'); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, 120) : ''; });
    console.log(`  step ${k} [${s.ch}] ${txt}`);
    await page.evaluate(() => __co.go()); await page.waitForTimeout(1200);
  }
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (fail) console.error('FAIL ' + fail);
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'coach-shots: FAIL' : 'coach-shots: OK');
process.exit(fail || errors.length ? 1 : 0);
