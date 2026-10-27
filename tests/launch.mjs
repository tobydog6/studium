// The opening: demo start → glow → detail → shoot → film → spin → lock → scene, then the short version. Needs `node build.mjs --web`.
//   node tests/launch.mjs      screenshots to tests/out/launch-*.png
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
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
  await until('dark', 20000); await page.waitForTimeout(1500); await shot('1-dark');
  await until('detail', 400000); console.log('in at', Date.now() - t0, 'ms'); await page.waitForTimeout(700); await shot('2-scan'); console.log('scan:', await ev(() => !!__la.state().scan)); await page.waitForTimeout(2600); await shot('2-detail');
  await ev(() => __la.go()); await until('shoot', 20000); await page.waitForTimeout(350); await shot('3-iris');
  await page.waitForTimeout(2800); const still = await ev(() => { const c = document.querySelector('.la-fr.still canvas'); return c && c.width > 2 ? c.toDataURL('image/jpeg', 0.85) : 'none'; }); if (still.startsWith('data:')) writeFileSync(join(OUT, 'launch-still.jpg'), Buffer.from(still.split(',')[1], 'base64')); console.log('still:', still.length);
  await ev(() => __la.go()); await until('film', 20000); console.log('film at', Date.now() - t0, 'ms'); await page.waitForTimeout(1200); await shot('4-film');
  await ev(() => __la.go()); await until('spin', 60000); await page.waitForTimeout(1800); await shot('5-spin');
  await ev(() => __la.go()); await until('end', 30000); await page.waitForTimeout(400); await shot('6-scene');
  await page.waitForTimeout(2800); await shot('7-welcome'); console.log('welcome card:', await ev(() => __la.wel()));
  console.log('pose', JSON.stringify(await ev(() => __cb.pose())), 'spawn', JSON.stringify(await ev(() => SPLAT_SCENES[0].spawn)));
  const snd = await ev(() => __sd.render()); writeFileSync(join(OUT, 'launch-sound.wav'), Buffer.from(snd.wav, 'base64')); console.log('sound peak:', snd.peak);
  await ev(() => __la.welGo('skip')); console.log('card after skip:', await ev(() => __la.wel()));
  console.log('end:', await ev(() => ({ state: __cb.state(), log: __la.state().log, launching: document.body.classList.contains('launching'), hud: getComputedStyle(document.getElementById('hud')).visibility, vf: document.getElementById('viewfinder').classList.contains('on'), pose: __cb.pose(), spawn: (window.SPLAT_SCENES||[])[0].spawn })));
  // second time: the short version
  await ev(() => { __qu.closeAll(); __la.start(); }); await until('dark', 5000); const t1 = Date.now(); await until('end', 30000); console.log('short version took', Date.now() - t1, 'ms');
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (fail) console.error('FAIL ' + fail);
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'launch: FAIL' : 'launch: OK');
process.exit(fail || errors.length ? 1 : 0);
