// The quest board, the quest page, the done moment and the finish, from a scripted demo. Needs `node build.mjs --web`.
//   node tests/board.mjs        screenshots to tests/out/board-*.png
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok)); const BASE = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_detail', 'test'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|supabase|net::ERR|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
const shot = async (n) => { await page.waitForTimeout(900); await page.screenshot({ path: join(OUT, `board-${n}.png`), timeout: 240000 }).catch(() => console.log('  (screenshot timed out: ' + n + ')')); };
const ev = (f, ...a) => page.evaluate(f, ...a);
const finish = (ids) => ev((ids) => ids.forEach((id) => { const n = __q.state().quests.filter((q) => q.id === id)[0].of; for (let i = 0; i < n; i++) __q.complete(id, i); }), ids);   /* step by step, so the done moment fires */
let fail = '';
try {
  await page.goto(BASE + '?dev&noauto'); await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });   /* headless SwiftShader stalls CSS animations at their first frame */ await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 90000 });
  await page.click('#signin [data-si="demo"]');
  await page.waitForFunction(() => window.__cb && __cb.state() === 'scene' && window.__q && __q.state().tracked === 'd1', null, { timeout: 300000, polling: 500 });
  await ev(() => __qu.closeAll());
  await ev(() => __qu.log()); await shot('1-fresh');
  console.log('rows:', await ev(() => Array.from(document.querySelectorAll('.q-rowh')).map((e) => e.innerText.replace(/\s+/g, ' '))));
  await ev(() => document.querySelector('.q-tile[data-q-see="d1"]').click()); await page.waitForTimeout(800); await shot('2-page');
  await ev(() => __qu.closeAll());
  // finish d1: the done moment must name d1
  await finish(['d1']); await page.waitForTimeout(2500); await shot('3-done');
  console.log('done card:', await ev(() => (document.querySelector('#qDone .t') || {}).innerText));
  await ev(() => __qu.closeAll());
  await finish(['d2', 'd3']); await page.waitForTimeout(2500);
  console.log('done card after row 1:', await ev(() => ((document.querySelector('#qDone') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 200)));
  await shot('4-row1done'); await ev(() => __qu.closeAll());
  await ev(() => __qu.log()); await shot('5-row2open');
  console.log('locks:', await ev(() => __q.state().quests.map((q) => q.id + ':' + q.status + (q.lock ? '(' + q.lock + ')' : ''))));
  await ev(() => __qu.closeAll());
  await finish(['d4', 'd5', 'd6', 'd7', 'd8', 'd9']); await page.waitForTimeout(3000); await shot('6-finish');
  console.log('finish:', await ev(() => (document.querySelector('#qDone .t') || {}).innerText));
  await ev(() => __qu.closeAll()); await ev(() => __qu.log()); await shot('7-alldone');
  await ev(() => { __cb.go && __cb.go('hub'); }).catch(() => {}); await page.keyboard.press('KeyH'); await page.waitForTimeout(2500); await shot('8-hub');
  console.log('hub popups:', await ev(() => __qu.state()));
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (fail) console.error('FAIL ' + fail);
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'board: FAIL' : 'board: OK');
process.exit(fail || errors.length ? 1 : 0);
