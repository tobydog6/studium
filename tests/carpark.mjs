// The Car Park (a .sog scan, scaled to real size): it loads from the scene picker, you start in a good spot,
// the walk map holds you on the ground, and the lighting rig lights it with shadows.
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
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick&noauto', { timeout: 300000 });
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 120000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'attached' }); await page.$eval('#tileSplat', (b) => b.click());
  await page.waitForSelector('.scenecard', { state: 'visible' }); await page.$$eval('.scenecard', (cs) => cs.find((x) => /Car Park/.test(x.textContent)).click());
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 900000, polling: 1000 });
  await ev(() => window.__qu.closeAll()); await page.waitForTimeout(15000);
  const w = await ev(() => window.__wk.pos()); console.log(JSON.stringify(w));
  ok(w.col && Math.abs(w.x - 2.5) < 0.6 && Math.abs(w.z - 7.5) < 0.6, 'started at the scene\'s spot, with a walk map');
  ok(Math.abs(w.y - (w.ground + w.eye)) < 0.3, 'standing on the ground');
  await shot('carpark-1');
  // up close: the man on the bench, from about a metre away
  await ev(() => window.__rl.open()); await page.waitForFunction(() => window.__rl.state().ready, null, { timeout: 600000, polling: 1000 });
  const hit = await ev(() => window.__rl.pick()); console.log('pick', JSON.stringify(hit));
  await ev(() => window.__rl.close());
  if (hit) { await ev((h) => { const p = window.__wk.pos(); const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz); window.__wx.place(h.x + dx / d * 1.1, h.y + 0.15, h.z + dz / d * 1.1, Math.atan2(dx, dz), -0.12); }, hit);
    await page.waitForTimeout(20000); await shot('carpark-face'); }
  // night, one light near the red car
  await ev(() => window.__rl.open()); await page.waitForFunction(() => window.__rl.state().ready, null, { timeout: 600000, polling: 1000 });
  await page.$eval('[data-rl-time="night"]', (b) => b.click());
  await ev(() => window.__rl.add('fresnel')); await ev(() => window.__rl.light({ x: 0.6, y: 2.4, z: 5.6 })); await ev(() => window.__rl.close());
  const rs = await ev(() => window.__rl.state()); console.log(JSON.stringify(rs)); ok(rs.on && rs.n === 1 && rs.N > 1000000, 'lit, with every splat in the shadow grid');
  await page.waitForTimeout(12000); await shot('carpark-2-night-light');
  ok(!errors.length, 'page errors: ' + errors.join(' | '));
  console.log('PASS carpark');
} catch (e) { console.error('FAIL', e.message); console.error(errors.join('\n')); process.exitCode = 1; await shot('carpark-fail'); }
await browser.close();
