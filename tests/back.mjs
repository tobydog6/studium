// Camera back test: scene -> shoot a few frames -> Space flips to the back -> every tab works -> Space flips back.
// Usage: node tests/back.mjs [path/to/studium.html]   (screenshots land in tests/out/)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(process.argv[2] || join(ROOT, 'dist', 'studium.html'));
const OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_detail', 'test'); if (!localStorage.getItem('studium_v1')) localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });   // skip the first-run tutorial
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const shot = (name) => page.screenshot({ path: join(OUT, `back-${name}.png`), timeout: 240000 });
const cb = (expr) => page.evaluate(expr);
const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(60); } };

try {
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 });
  await page.click('#tileSplat');
  await page.waitForSelector('.scenecard', { state: 'visible', timeout: 10000 });
  await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 }); await page.waitForTimeout(1500);
  ok(await cb(() => window.__cb.state()) === 'scene', 'expected scene state after loading');

  // shoot three frames
  await key('KeyP'); await page.waitForTimeout(300);
  ok(await cb(() => window.__cb.state()) === 'viewfinder', 'P should raise the viewfinder');
  for (let i = 0; i < 3; i++) { await key('Enter'); await page.waitForTimeout(700); }
  const n = await cb(() => window.__cb.photos.length);
  ok(n === 3, `expected 3 photos, got ${n}`);

  // Space flips to the back, on the Shoot tab
  await key('Space'); await page.waitForTimeout(450);
  ok(await cb(() => window.__cb.open_()), 'back did not open');
  ok(await cb(() => window.__cb.state()) === 'back', 'state should be back');
  await shot('1-shoot');
  const before = await cb(() => window.__cb.cam());
  await key('ArrowRight', 2);                       // shutter two stops slower
  const after = await cb(() => window.__cb.cam());
  ok(after.sh !== before.sh && after.ev > before.ev, `shutter did not change: ${JSON.stringify([before, after])}`);
  await key('ArrowDown'); await key('ArrowLeft');    // aperture one stop wider
  const ap = await cb(() => window.__cb.cam());
  ok(ap.ap < after.ap, 'aperture did not open up');
  await page.mouse.move(600, 500); await page.mouse.wheel(0, 120); await page.waitForTimeout(120);
  ok((await cb(() => window.__cb.cam())).ap !== ap.ap, 'scroll did not turn the dial');
  const vf = await page.textContent('#vfSettings');
  ok(vf.includes((await cb(() => window.__cb.cam())).sh), 'viewfinder readout out of sync with the back');
  await shot('2-shoot-adjusted');

  // Review: rate and pick the latest frame
  await key('KeyE'); await page.waitForTimeout(500);
  await key('Digit4'); await key('KeyP'); await page.waitForTimeout(300);
  const rated = await cb(() => { const p = window.__cb.photos; return [p[p.length - 1].rating, p[p.length - 1].pick]; });
  ok(rated[0] === 4 && rated[1] === true, `rating/pick not stored: ${rated}`);
  await key('ArrowLeft');
  await shot('3-review');

  // Brief: choose brief 02 and make it active
  await key('KeyE'); await key('ArrowDown', 2); await key('Enter'); await page.waitForTimeout(200);
  await shot('4-brief');
  ok((await page.textContent('#cbUi')).includes('THIS IS YOUR ACTIVE BRIEF'), 'brief was not set');

  // Setup: toggle invert look
  await key('KeyE'); await key('ArrowDown', 3); await key('ArrowRight'); await page.waitForTimeout(150);
  await shot('5-setup');
  ok((await page.textContent('#cbUi')).includes('Invert look'), 'setup tab missing');

  // Q goes back a tab; Space flips back to the viewfinder
  await key('KeyQ'); ok((await page.getAttribute('.cb-tab.on', 'data-cb-tab')) === 'brief', 'Q should go back one tab');
  await key('Space'); await page.waitForTimeout(400);
  ok(!(await cb(() => window.__cb.open_())), 'back did not close');
  ok(['viewfinder', 'scene'].includes(await cb(() => window.__cb.state())), 'state should return to the scene');
  ok(await page.$eval('#camback', (e) => e.classList.contains('hidden')), 'back still visible');
  await shot('6-flipped-back');

  // B opens the camera bag (the legacy body and lens picker until the bag session); Space closes it
  await key('KeyB'); await page.waitForTimeout(300);
  ok(await cb(() => window.__cb.state()) === 'bag', 'B should open the camera bag');
  await key('Space'); await page.waitForTimeout(300);
  ok(await page.$eval('#menu', (e) => e.classList.contains('hidden')), 'Space should close the bag');

  // Setup > Leave location goes to the hub through the state machine
  await key('Space'); await page.waitForTimeout(1500);
  if (!(await cb(() => window.__cb.open_()))) { await cb(() => window.__cb.open()); await page.waitForTimeout(1500); }
  await page.evaluate(() => window.__cb.tab('setup')); await page.waitForTimeout(500);
  await page.click('[data-cb-setup="11"]'); await page.waitForTimeout(150);   // first click selects "Leave location"
  await key('Enter'); await page.waitForTimeout(300);                        // Enter does it
  ok(await cb(() => window.__cb.state()) === 'hub', 'Leave location should return to the hub');
  ok(await page.$eval('#hub', (e) => !e.classList.contains('hidden')), 'hub not visible');

  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  camera back (${FILE})`);
} catch (e) {
  console.error('FAIL ', e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
