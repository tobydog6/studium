// Copy stand + board-photo tray: installs the stand, photographs the board, opens the tray and sends one to the Workbook.
// Needs `node build.mjs --web`. Screenshots: tests/out/lts-*.png
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
const shot = (n) => page.screenshot({ path: join(OUT, `lts-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')'));
const steps = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
let fail = '';
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await page.waitForTimeout(8000);
  await page.evaluate(() => { const cols = ['#7a8f6e', '#c58b52', '#3d5a7a', '#a35d4a', '#d9c9a3', '#556677'];
    cols.forEach((c, i) => { const cv = document.createElement('canvas'); cv.width = i % 2 ? 600 : 900; cv.height = i % 2 ? 900 : 600; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, cv.width, cv.height);
      __cb.addPhoto({ url: cv.toDataURL('image/jpeg', 0.8), place: 'Stump', pick: i < 2 }); });
    const si = document.getElementById('signin'); if (si) si.style.display = 'none'; try { __la.skip(); } catch (e) {} __cb.stOpen('table'); });
  await page.waitForFunction(() => { const f = __cb.lt(); return f && f.contentWindow && f.contentWindow.__lt && f.contentWindow.document.body.classList.contains('ready'); }, null, { timeout: 120000, polling: 500 });
  const fr = page.frames().find((f) => f.url() === 'about:srcdoc');
  await page.waitForTimeout(1500);
  await fr.evaluate(() => { if (__lt.TOUR.on) document.querySelector('[data-co="all"]').click(); __lt.pullOut(__lt.library.filter((i) => !i.sample).map((i) => i.id)); });
  await page.waitForTimeout(9000);
  await fr.evaluate(() => { const ps = __lt.prints.filter((p) => !__lt.library.find((i) => i.id === p.id).sample).slice(0, 4); ps.forEach((p, k) => __lt.placeFree(p, 5 + (k % 2) * 2.45, -3 + Math.floor(k / 2) * 3.4)); __lt.restack(); __lt.updateChains(true); });
  await page.waitForTimeout(1500); await shot('1-before');
  await fr.evaluate(() => __lt.setStand(true)); await fr.waitForFunction(() => __lt.STAND.t > 1.6, null, { timeout: 180000 }); await shot('2-swing'); await fr.waitForFunction(() => __lt.STAND.dir === 0, null, { timeout: 90000 }); await shot('3-up');
  console.log('  stand:', JSON.stringify(await fr.evaluate(() => ({ up: __lt.STAND.up, dir: __lt.STAND.dir, t: __lt.STAND.t, onBoard: __lt.prints.filter((p) => p.onBoard).length }))));
  await fr.evaluate(() => __lt.shoot()); console.log('  rect:', JSON.stringify(await fr.evaluate(() => __lt.shots().slice(-1)[0].rect)), JSON.stringify(await fr.evaluate(() => __lt.prints.filter((p) => p.onBoard).map((p) => [p.tx, p.tz, p.w, p.h].map((v) => +v.toFixed(2)))))); await page.waitForTimeout(1200); await shot('4-fly'); await page.waitForTimeout(5000); await shot('5-intray');
  await fr.evaluate(() => __lt.openTray()); await page.waitForTimeout(1200); await shot('6-open');
  await fr.evaluate(() => __lt.sendShot()); await page.waitForTimeout(900); await shot('7-sending'); await page.waitForTimeout(1600);
  const wb = await page.evaluate(() => { const s = __cb.studio(); return { pages: s.ws.pages.length }; }); console.log('  workbook:', JSON.stringify(wb), 'shots', await fr.evaluate(() => __lt.shots().length));
  await fr.evaluate(() => __lt.closeTray()); await fr.evaluate(() => __lt.saveNow());
} catch (e) { fail = e.message.split('\n')[0]; }
await browser.close(); server.close();
if (errors.length) console.log(errors.join('\n'));
console.log(fail || errors.length ? 'lt-stand: FAIL ' + fail : 'lt-stand: OK');
