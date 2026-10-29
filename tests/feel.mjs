// The first minute (feel.js and the new warm-up), driven for real: drag to look, click the ground, right click to
// raise, crouch into the low frame and shoot, then step into a gold frame and check the bag lesson starts there.
// Needs `node build.mjs --web`. Screenshots go to tests/out/feel-*.png: look at them.
//   node tests/feel.mjs
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
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_launch_seen', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|supabase|net::ERR|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
const shot = async (n) => { await page.waitForTimeout(1500); await page.screenshot({ path: join(OUT, `feel-${n}.png`), timeout: 240000 }).catch(() => console.log('  (screenshot timed out: ' + n + ')')); console.log('  shot ' + n); };
const co = () => page.evaluate(() => { const s = __co.state(); const e = document.querySelector('#coCard'); return { ...s, text: e ? e.innerText.replace(/\s+/g, ' ').slice(0, 140) : '' }; });
const waitStep = async (i, ms = 60000) => { await page.waitForFunction((k) => { const s = __co.state(); return !s.on || s.i >= k; }, i, { timeout: ms, polling: 300 }); };
let fail = '';
try {
  await page.goto(BASE + '?dev&demo');
  await page.waitForFunction(() => window.__co && __co.state().on && __co.state().tour === 'basics' && window.__cb && __cb.state() === 'scene', null, { timeout: 400000, polling: 500 });
  await page.evaluate(() => { __qu.closeAll(); }); await page.waitForTimeout(1500);
  console.log('step', JSON.stringify(await co()));
  await shot('0-look');
  // 1. drag to look (no pointer lock)
  for (let k = 0; k < 6; k++) { await page.mouse.move(500, 420); await page.mouse.down(); await page.mouse.move(900, 440, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300); }
  await waitStep(1); console.log('step', JSON.stringify(await co()), JSON.stringify(await page.evaluate(() => __fl.state().look)));
  await shot('1-move');
  // 2. click the ground a little way off, a few times
  for (let k = 0; k < 4; k++) { console.log('  hit', JSON.stringify(await page.evaluate(([x, y]) => __fl.hit(x, y), [720 + (k % 2 ? 80 : -80), 520]))); await page.mouse.click(720 + (k % 2 ? 80 : -80), 520); await page.waitForTimeout(2200); }
  await waitStep(2); console.log('step', JSON.stringify(await co()));
  await shot('2-raise');
  // 3. right click raises (pointer lock may fail headless: the click-to-shoot fallback covers it)
  await page.mouse.click(720, 450, { button: 'right' }); await page.waitForTimeout(1200);
  await waitStep(3); console.log('step', JSON.stringify(await co()));
  await shot('3-shoot-raised');
  // 4. the low frame: go to it, crouch, face through it, shoot
  await page.mouse.click(720, 450, { button: 'right' }); await page.waitForTimeout(800);   /* lower it to walk */
  console.log('  ghost', JSON.stringify(await page.evaluate(() => __fl.state().ghost)));
  await shot('4-ghost');
  await page.evaluate(() => { const P = __fl._g(); __wk.setPos(P.E.x, P.E.z); const d = P.d; __dof.aim(Math.atan2(-d.x, -d.z), Math.asin(d.y)); });
  await page.keyboard.down('KeyQ'); await page.waitForTimeout(2500); await page.keyboard.up('KeyQ'); await page.waitForTimeout(800);
  console.log('  fit', JSON.stringify(await page.evaluate(() => __fl.state().ghost)), JSON.stringify(await co()));
  await shot('5-lined-up');
  await page.mouse.click(720, 450, { button: 'right' }); await page.waitForTimeout(1500);
  await page.mouse.click(720, 450); await page.waitForTimeout(600);
  await shot('6-first-print');
  await page.waitForFunction(() => !__co.state().on || __co.state().tour !== 'basics', null, { timeout: 30000, polling: 300 }).catch(() => {});
  console.log('after shot', JSON.stringify(await co()), JSON.stringify(await page.evaluate(() => __fl.state().hit)));
  // 5. a gold frame: step into one that needs the bag, the lesson should start
  await page.mouse.click(720, 450, { button: 'right' }).catch(() => {}); await page.waitForTimeout(500);
  await page.evaluate(() => { if (window.__ch) { const p = __ch.pads(); const i = p.findIndex((x) => /dof/.test(x.id)); __ch.goto(i < 0 ? 0 : i); __ch.aim(i < 0 ? 0 : i); __ch.force(i < 0 ? 0 : i); } });
  await page.waitForFunction(() => __co.state().on && /^k/.test(__co.state().tour), null, { timeout: 30000, polling: 300 }).catch(() => {});
  console.log('lesson', JSON.stringify(await co()));
  await shot('7-lesson');
  await page.keyboard.press('KeyB'); await page.waitForTimeout(2500);
  console.log('lesson', JSON.stringify(await co()));
  await shot('8-lesson-bag');
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (fail) console.error('FAIL ' + fail);
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'feel: FAIL' : 'feel: OK  (screenshots in tests/out/feel-*.png)');
process.exit(fail || errors.length ? 1 : 0);
