// From the Car Park: T opens the cube with all three places, Escape puts it away with every control back, then
// going to the Stump through the portal opens the Stump properly, standing where you came out.
// And the camera on the home screen always opens the place picker, marking where you are.
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_looked', '1'); localStorage.setItem('studium_frames_off', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: join(OUT, n + '.png'), timeout: 240000 }).catch(() => {});
const scene = () => page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 1200000, polling: 1000 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick&noauto', { timeout: 300000 });
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 120000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'attached' }); await page.$eval('#tileSplat', (b) => b.click());
  await page.waitForSelector('.scenecard', { state: 'visible' }); await page.$$eval('.scenecard', (cs) => cs.find((x) => /Car Park/.test(x.textContent)).click());
  await scene(); await ev(() => window.__qu.closeAll());
  await page.waitForFunction(() => window.__wx.state().worlds.filter((w) => w.ready).length === 3, null, { timeout: 900000, polling: 1000 });
  // T, then Escape: the cube goes and every control comes back
  await page.keyboard.press('KeyT'); await page.waitForTimeout(800);
  let cs = await ev(() => window.__cu.state()); ok(cs.open, 'T opens the cube');
  const names = cs.spots.map((x) => x.name).join(' | '); console.log(names);
  ok(/Car Park/.test(names) && (/Stump/.test(names) || /Fly/.test(names)), 'the cube shows the car park and the others');
  await page.waitForTimeout(8000); await shot('worlds-1-cube');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__cu.state().open, null, { timeout: 60000, polling: 300 });
  ok(await ev(() => !document.body.classList.contains('cube-open')), 'controls back after Escape');
  ok(await ev(() => getComputedStyle(document.getElementById('hud')).visibility !== 'hidden'), 'hud visible');
  // T, pick the Stump, walk through: the Stump opens as the scan, you standing where you came out
  await page.keyboard.press('KeyT'); await page.waitForTimeout(800);
  cs = await ev(() => window.__cu.state()); const f = cs.spots.findIndex((x) => /Stump/.test(x.name)); ok(f >= 0, 'a Stump side');
  await ev((i) => window.__cu.dive(i), f);
  await page.waitForFunction(() => window.__pt.state().state === 'open', null, { timeout: 300000, polling: 300 });
  for (let i = 0; i < 14 && (await ev(() => window.__pt.state().state)) !== 'closing'; i++) { await ev(() => window.__pt.step(0.35));
    await page.waitForFunction(() => { const d = window.__pt.dbg(); return !d.prev || d.prev.every((v, k) => Math.abs(v - d.cam[k]) < 1e-6); }, null, { timeout: 120000, polling: 200 }); }
  await page.waitForFunction(() => window.__wx.state().here === 'stump' && window.__wx.state().worlds[0].id === 'stump', null, { timeout: 1200000, polling: 1000 });
  await scene(); await page.waitForTimeout(8000);
  const p = await ev(() => window.__wk.pos()); console.log('in the stump', JSON.stringify(p)); ok(p.col && Math.hypot(p.x, p.z) < 8, 'standing in the Stump with its walk map');
  await shot('worlds-2-stump');
  // the home-screen camera: always the picker, the Stump marked
  await ev(() => document.querySelector('[data-nav="home"]').click()); await page.waitForTimeout(1500);
  await page.$eval('#tileSplat', (b) => b.click()); await page.waitForSelector('.scenecard', { state: 'visible', timeout: 30000 });
  ok(await ev(() => /CARRY ON/.test(document.querySelector('.scenecard.here').textContent) && /Stump/.test(document.querySelector('.scenecard.here').textContent)), 'the picker marks where you are');
  ok(!errors.length, 'page errors: ' + errors.join(' | '));
  console.log('PASS worlds');
} catch (e) { console.error('FAIL', e.message); console.error(errors.join('\n')); process.exitCode = 1; await shot('worlds-fail'); }
await browser.close();
