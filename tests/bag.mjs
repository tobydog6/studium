// Camera bag test: B opens the bag; bodies switch; the lens menu swaps lenses with the full animation;
// lock in puts the lens on the simulated camera; the zoom dial works; the back's BAG button round-trips.
// Usage: node tests/bag.mjs [path/to/studium.html]
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
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); /* quests: something tracked, so the focus picker doesn't cover the hub */ if (!localStorage.getItem('studium_quests_v1')) localStorage.setItem('studium_quests_v1', JSON.stringify({ v: 1, set: 'term1', tracked: 'f1', lastFocusAsk: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'), quests: { f1: { started: Date.now(), base: { photos: 0, t: Date.now() }, done: null, stepDone: {} } }, tours: {}, tourStep: {}, flags: {}, rs: { cull: {}, punctum: {}, details: 0 }, first: Date.now() })); localStorage.setItem('studium_detail', 'test'); if (!localStorage.getItem('studium_v1')) localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const cb = (f) => page.evaluate(f);
const key = async (k, wait = 80) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
const shot = (n) => page.screenshot({ path: join(OUT, `bag-${n}.png`), timeout: 240000 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&quick');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 });
  await page.click('#tileSplat'); await page.click('.scenecard'); await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 }); await page.waitForTimeout(1500);
  ok((await cb(() => window.__cb.cam())).body === 'dslr', 'should start on the full-frame DSLR');

  await key('KeyB', 400);
  ok(await cb(() => window.__cb.state()) === 'bag', 'B should open the bag');
  await shot('1-choose');
  await key('ArrowRight', 300);
  ok((await cb(() => window.__cb.cam())).body === 'ml', 'right arrow should pick the APS-C mirrorless');

  await key('KeyL', 400); ok((await cb(() => window.__cb.bag())).stage === 'lens', 'L should open the lens menu');
  await shot('2-lens-menu');
  await key('ArrowRight'); await key('Space', 600);
  await shot('3-mid-swap');
  await page.waitForTimeout(1100);
  ok((await cb(() => window.__cb.bag())).lens === '50', 'Space should swap to the 50');
  await key('ArrowRight'); await key('Space', 1700);
  ok((await cb(() => window.__cb.bag())).lens === '85', 'a second swap should put the 85 on');
  await shot('4-swapped');
  await key('Enter', 400);
  ok((await cb(() => window.__cb.bag())).stage === 'choose', 'Enter should lock in');
  ok((await cb(() => window.__cb.cam())).mm === 85, 'the 85 should be on the camera');

  await key('KeyB', 400);
  ok(await cb(() => window.__cb.state()) === 'scene', 'B should close the bag');
  await key('KeyP', 400);
  const mlFov = await cb(() => window.__cb.fov());

  // full-frame + 24-70: the zoom dial appears and changes focal length
  await key('KeyB', 400); await key('ArrowLeft', 300);
  ok((await cb(() => window.__cb.cam())).body === 'dslr', 'left arrow should go back to the DSLR');
  await key('KeyL', 400); await page.click('[data-bg-lens="2470"]'); await page.waitForTimeout(1700); await key('Enter', 300);
  await key('KeyB', 500);
  ok(await cb(() => window.__cb.state()) === 'viewfinder', 'closing the bag should return to the raised camera');
  ok((await page.textContent('#vfStrip')).includes('ZOOM'), 'zoom dial should show for the 24-70');
  await page.mouse.move(720, 400); await page.mouse.wheel(0, -120); await page.waitForTimeout(150);
  ok((await cb(() => window.__cb.cam())).mm === 70, 'scrolling up should zoom the 24-70 in to 70 mm');
  ok(await cb(() => window.__cb.fov()) > mlFov * 0.5, 'fov sanity');
  await shot('5-zoom-dial');

  // the back's BAG button opens the bag and closing it returns to the back
  await key('Space', 500); await page.click('[data-cb-btn="bag"]'); await page.waitForTimeout(500);
  ok(await cb(() => window.__cb.state()) === 'bag', 'BAG button should open the bag');
  await key('KeyB', 500);
  ok(await cb(() => window.__cb.state()) === 'back', 'closing should return to the camera back');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  camera bag (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; }
finally { await browser.close(); }
