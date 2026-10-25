// Gold-frame check: loads the demo, finishes the warm-up, stands in a gold frame and screenshots the viewfinder,
// the camera back and the bag with that frame active. Serves dist/web (run `node build.mjs --web` first).
//   node tests/frame.mjs            frame 0 (the shallow depth of field one in the demo)
//   node tests/frame.mjs --frame 2  another frame
//   node tests/frame.mjs --still    freeze the scene's render loop once loaded (cheap screenshots on a software GPU)
// Screenshots go to tests/out/frame-*.png. Look at them.
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
const arg = (k) => process.argv.includes(k), STILL = arg('--still');
const fi = process.argv.indexOf('--frame'), FRAME = fi > -1 ? +process.argv[fi + 1] : 0;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok)); const BASE = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript((still) => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_upscale', 'off'); } catch (e) {}
  if (still) { window.__still = false; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => (window.__still && cb && cb.name === 'animate' ? setTimeout(() => cb(performance.now()), 900) : raf(cb)); } }, STILL);
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|supabase|net::ERR|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
const shot = async (n) => { await page.waitForTimeout(900); await page.screenshot({ path: join(OUT, `frame-${n}.png`), timeout: 240000 }).catch(() => console.log('  (screenshot timed out: ' + n + ')')); console.log('  shot ' + n); };
const text = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => e.innerText.replace(/\s*\n\s*/g, ' | ')).join('\n    '), sel);
let fail = '';
try {
  await page.goto(BASE + '?dev&quick'); await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 90000 });
  await page.click('#signin [data-si="demo"]');
  await page.waitForFunction(() => window.__cb && __cb.state() === 'scene' && window.__q && __q.state().tracked === 'd1', null, { timeout: 300000, polling: 500 });
  await page.waitForTimeout(1500);
  if (STILL) await page.evaluate(() => { window.__still = true; });
  // the warm-up is done: the frames come out and the intro glide runs
  await page.evaluate(() => { __qu.closeAll(); __co.skip(); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { __q.tick(); });
  await page.waitForFunction(() => window.__ch && __ch.pads().length > 0, null, { timeout: 30000, polling: 300 });
  const pads = await page.evaluate(() => __ch.pads()); console.log('frames:', pads.map((p) => p.id).join(', '));
  await page.waitForTimeout(8000);   /* the intro glide */
  // first, wandered off: the subject ring should point back
  await page.evaluate(() => { __ch.force(-1); __ch.approach(0, 5.5, 2.6); }); await page.waitForTimeout(2500);
  console.log('markers:\n    ' + await text('#chMarks .chm'));
  await shot('far');
  await page.evaluate((i) => { __ch.goto(i); __ch.aim(i); __ch.force(i); }, FRAME);
  await page.waitForTimeout(1500);
  console.log('active:', await page.evaluate(() => __ch.active()));
  console.log('card:\n    ' + await text('#chCard'));
  await shot('scene');
  await page.keyboard.press('KeyP'); await page.waitForTimeout(1200);
  console.log('viewfinder chips:\n    ' + await text('#viewfinder .vf-chip, #vfTask'));
  await shot('viewfinder');
  await page.keyboard.press('Space'); await page.waitForTimeout(3500);
  console.log('camera back:\n    ' + await text('#cbUi .cb-task, #cbUi .cb-meter .cb-words, #cbUi .cb-cap'));
  await shot('back');
  // set what the frame wants on the aperture, so the light goes off and the free dials get called out
  await page.evaluate(() => { const b = document.querySelector('#cbUi .cb-stop.want'); if (b) b.click(); }); await page.waitForTimeout(800);
  console.log('camera back after:\n    ' + await text('#cbUi .cb-task, #cbUi .cb-meter .cb-words, #cbUi .cb-cap'));
  await shot('back2');
  await page.keyboard.press('KeyB'); await page.waitForTimeout(1500);
  console.log('bag:\n    ' + await text('#bag .bg-head, #bag .bg-task, #bag .bg-card.want'));
  await shot('bag');
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (fail) console.error('FAIL ' + fail);
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'frame: FAIL' : 'frame: OK  (screenshots in tests/out/frame-*.png)');
process.exit(fail || errors.length ? 1 : 0);
