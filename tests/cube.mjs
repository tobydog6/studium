// Portals: two ends in the Stump, the far side showing through with parallax, and walking through takes you there.
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
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); if (/portal pass/.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: join(OUT, n + '.png'), timeout: 120000 }).catch(() => {});
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick&noauto');
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'attached', timeout: 20000 }); await page.$eval('#tileSplat', (b) => b.click());
  await page.waitForSelector('.scenecard', { state: 'visible', timeout: 10000 }); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 });
  await ev(() => window.__qu.closeAll()); await page.waitForTimeout(3000);
  ok(!(await ev(() => window.__cu.state())).open, 'no cube until T');
  await page.keyboard.press('KeyT'); await page.waitForTimeout(500);
  ok((await ev(() => window.__cu.state())).open, 'T opens the cube');
  const cs = await ev(() => window.__cu.state()); console.log(JSON.stringify(cs.spots));
  ok(cs.spots.length === 6, 'six places');
  await page.waitForTimeout(10000); await shot('cube-1');
  await ev(() => window.__cu.spin(0.02, 0.09)); await page.waitForTimeout(6000); await shot('cube-2');
  const f = await ev(() => window.__cu.front()); const target = cs.spots[f].p;
  await ev((i) => window.__cu.dive(i), f);
  await page.waitForFunction(() => !window.__cu.state().open, null, { timeout: 120000, polling: 300 });
  const p = await ev(() => window.__pt.pos()); const d = Math.hypot(p.x - target[0], p.z - target[2]);
  console.log('arrived', p, 'from spot', d.toFixed(2)); ok(d < 0.5, 'arrived at the chosen place');
  await page.waitForTimeout(4000); await shot('cube-3-arrived');
  ok(!errors.length, 'page errors: ' + errors.join(' | '));
  console.log('PASS cube');
} catch (e) { console.error('FAIL', e.message); console.error(errors.join('\n')); process.exitCode = 1; await shot('cube-fail'); }
await browser.close();
