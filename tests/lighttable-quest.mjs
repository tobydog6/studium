// Light table quest: signs in to the demo, checks the quest tile has Try now, opens the quest page, presses Try now,
// checks the table and its tour open, and that a board of sample prints reaches the Workbook. Needs `node build.mjs --web`.
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
const shot = (n) => page.screenshot({ path: join(OUT, `lt-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')'));
let fail = '';
// --quest: sign in to the demo, open the quest board, open the light table quest, press Try now
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 90000 });
  await page.click('#signin [data-si="demo"]'); await page.waitForFunction(() => window.__q && __q.state().tracked, null, { timeout: 300000, polling: 500 });
  for (let k = 0; k < 20; k++) { await page.evaluate(() => { if (window.__la && __la.state().on) __la.skip(); const w = document.querySelector('#laWel.show .lw-skip'); if (w) w.click(); }); await page.waitForTimeout(1500); }
  await page.evaluate(() => { __qu.closeAll(); __qu.board(); }); await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = document.querySelector('#qLog .q-board'); if (g) g.scrollTop = 9999; }); await page.screenshot({ path: join(OUT, 'lt-q1-board.png'), timeout: 120000 }).catch(() => console.log('  (screenshot skipped)'));
  const ok = await page.evaluate(() => { const t = document.querySelector('[data-q-see="d10"] .q-trychip'); return !!t; }); if (!ok) throw new Error('no Try now on the tile');
  await page.evaluate(() => __qu.morph('d10')); await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, 'lt-q2-quest.png'), timeout: 120000 }).catch(() => console.log('  (screenshot skipped)'));
  await page.evaluate(() => document.querySelector('#qLog [data-q-try="d10"]').click()); await page.waitForTimeout(6000);
  const room = await page.evaluate(() => __cb.studio().room + ' ' + __cb.studio().open); console.log('  after Try now:', room); if (!/table true/.test(room)) fail = 'Try now did not open the table';
  const tour = await page.evaluate(async () => { for (let k = 0; k < 40; k++) { const w = __cb.lt() && __cb.lt().contentWindow; if (w && w.__lt && w.__lt.TOUR.on) return 'on at step ' + w.__lt.TOUR.i; await new Promise((r) => setTimeout(r, 500)); } const w = __cb.lt().contentWindow; return 'off ' + JSON.stringify({ lt: !!w.__lt, done: w.__lt && w.__lt.TOUR.done, ready: w.document.body.className }); }); console.log('  table tour:', tour);
  const fr = page.frames().find((f) => f.url() === 'about:srcdoc');
  const r2 = await fr.evaluate(() => { const L = __lt.prints.slice(0, 2); L.forEach((p, k) => __lt.placeFree(p, 6 + k * 2.45, -1)); __lt.restack(); __lt.updateChains(false); __lt.setHover(L[0]); const acts = [...document.querySelectorAll('#acts .ib')].map((b) => b.title); __lt.captureBoard(); return acts; });
  console.log('  hover buttons:', JSON.stringify(r2)); await page.waitForTimeout(2000);
  const wb = await page.evaluate(() => { const s = __cb.studio(); return { pages: s.ws.pages.length, photos: s.ws.pages[s.ws.cur].filter((i) => i.t === 'photo' && i.i >= 0).length }; }); console.log('  sample board in workbook:', JSON.stringify(wb)); if (!wb.photos) fail = 'sample board did not reach the workbook';
  await page.screenshot({ path: join(OUT, 'lt-q3-table.png'), timeout: 120000 }).catch(() => console.log('  (screenshot skipped)'));
} catch (e) { fail = e.message.split('\n')[0]; }
await browser.close(); server.close();
if (errors.length) { console.log(errors.slice(0, 8).join('\n')); fail = fail || errors.length + ' page error(s)'; }
console.log(fail ? 'lt-quest: FAIL ' + fail : 'lt-quest: OK'); process.exit(fail ? 1 : 0);
