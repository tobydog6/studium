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
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await page.waitForTimeout(8000);
  await page.evaluate(() => { const cols = ['#7a8f6e', '#c58b52', '#3d5a7a', '#a35d4a', '#d9c9a3'];
    cols.forEach((c, i) => { const cv = document.createElement('canvas'); cv.width = i % 2 ? 600 : 900; cv.height = i % 2 ? 900 : 600; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#fff'; g.font = '120px sans-serif'; g.fillText('F' + i, 80, 300);
      __cb.addPhoto({ url: cv.toDataURL('image/jpeg', 0.8), place: 'Stump', pick: i < 2 }); });
    const si = document.getElementById('signin'); if (si) si.style.display = 'none';
    __cb.stOpen('table'); });
  await page.waitForFunction(() => { const f = __cb.lt(); return f && f.contentWindow && f.contentWindow.__lt && f.contentWindow.document.body.classList.contains('ready'); }, null, { timeout: 120000, polling: 500 });
  const fr = page.frames().find((f) => f.url() === 'about:srcdoc');
  await page.waitForTimeout(2500); await shot('1-open');
  const info = await fr.evaluate(() => ({ host: document.documentElement.classList.contains('in-studium'), lib: __lt.library.length, out: __lt.prints.length, tour: __lt.TOUR.on, step: __lt.TOUR.i }));
  console.log('  table:', JSON.stringify(info));
  console.log('  card:', await fr.evaluate(() => { const c = document.getElementById('co'); const cs = getComputedStyle(c); return [cs.opacity, cs.animationName, cs.display, c.className, c.getAnimations().map((a) => a.animationName + ':' + a.playState + ':' + a.currentTime).join(',')].join(' | '); }));
  if (!info.host) fail = 'not in host mode'; if (info.lib < 5) fail = 'library missing photos';
  await fr.click('.co-next'); await page.waitForTimeout(600);
  await fr.evaluate(() => { __lt.openBinder(); }); await page.waitForTimeout(1500);
  const picks = await fr.$$('.pk.in'); for (const p of picks.slice(0, 2)) await p.click(); await shot('2-binder');
  await fr.click('#bdPull'); await fr.waitForFunction(() => __lt.TOUR.i >= 3, null, { timeout: 30000 });
  await fr.evaluate(() => { const own = __lt.prints.filter((p) => !__lt.library.find((i) => i.id === p.id).sample).slice(0, 2); own.forEach((p, k) => __lt.placeFree(p, 6 + k * 2.45, -1)); __lt.tourEv('board'); __lt.restack(); return [__lt.TOUR.i, __lt.TOUR.okT, __lt.TOUR.on]; }).then((r) => console.log('  after board:', JSON.stringify(r)));
  await page.waitForTimeout(1200); await fr.evaluate(() => __lt.updateChains(true));
  await page.waitForTimeout(1800); await shot('3-board');
  console.log('  over card:', await fr.evaluate(() => { const c = document.getElementById('co'), r = c.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width * 0.5, r.top + 20); const cs = getComputedStyle(c); return [e && (e.id || e.tagName + '.' + e.className), cs.opacity, cs.zIndex, cs.filter, c.className, r.left|0, r.top|0].join(' | '); }));
  await page.waitForTimeout(3000); await shot('3c-later'); await fr.locator('#co').screenshot({ path: join(OUT, 'lt-card.png') }).catch(() => {});
  const tstep = await fr.evaluate(() => __lt.TOUR.i); console.log('  tour step after pull + pair:', tstep); if (tstep < 5) fail = 'tour did not advance';
  await fr.evaluate(() => { const ch = __lt.chains()[0]; if (ch) __lt.pinGroup(ch, null, 'pair'); __lt.focus('wall'); }); await page.waitForTimeout(2500); await shot('3b-wall');
  await fr.evaluate(() => __lt.focus('table')); await page.waitForTimeout(1200);
  await fr.evaluate(() => { const ps = __lt.prints.filter((p) => !p.onBoard && !p.wg && !p.rejected).slice(0, 2); ps.forEach((p, k) => __lt.placeFree(p, 6 + k * 2.45, -1)); __lt.restack(); __lt.updateChains(false); });
  await fr.evaluate(() => __lt.captureBoard()); await page.waitForTimeout(1500);
  await fr.evaluate(() => __lt.saveNow()); await page.waitForTimeout(1200);
  await page.evaluate(() => __cb.stOpen('workshop')); await page.waitForTimeout(2500); await shot('4-workbook');
  const wb = await page.evaluate(() => { const s = __cb.studio(); return { room: s.room, pages: s.ws.pages.length, items: s.ws.pages[s.ws.cur].length }; }); console.log('  workbook:', JSON.stringify(wb)); if (wb.room !== 'workshop' || !wb.items) fail = 'workbook page missing';
  await page.evaluate(() => __cb.stOpen('table')); await page.waitForTimeout(2000);
  const back = await fr.evaluate(() => ({ board: __lt.prints.filter((p) => p.onBoard).length }));
  console.log('  back on the table, board prints:', back.board);
} catch (e) { fail = e.message.split('\n')[0]; }
await browser.close(); server.close();
if (errors.length) { console.log(errors.slice(0, 8).join('\n')); fail = fail || errors.length + ' page error(s)'; }
console.log(fail ? 'lighttable: FAIL ' + fail : 'lighttable: OK'); process.exit(fail ? 1 : 0);
