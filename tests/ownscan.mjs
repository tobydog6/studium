// Own scan: the OPEN A SCAN button in the scene loads a .splat from disk, FLIP turns it over, and the lighting test resets.
// Usage: node tests/ownscan.mjs [path/to/studium.html]
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
await page.addInitScript(() => { try { /* quests: something tracked, so the focus picker doesn't cover the hub */ if (!localStorage.getItem('studium_quests_v1')) localStorage.setItem('studium_quests_v1', JSON.stringify({ v: 1, set: 'term1', tracked: 'f1', lastFocusAsk: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'), quests: { f1: { started: Date.now(), base: { photos: 0, t: Date.now() }, done: null, stepDone: {} } }, tours: {}, tourStep: {}, flags: {}, rs: { cull: {}, punctum: {}, details: 0 }, first: Date.now() })); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_guide_v1', 'off'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const scene = () => page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick&relight');
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 }); await page.click('#tileSplat');
  await page.waitForSelector('.scenecard', { state: 'visible', timeout: 10000 }); await page.click('.scenecard');
  await scene(); await page.waitForTimeout(1000);
  ok(await page.isVisible('#navLoad'), 'OPEN A SCAN button not visible in the scene');
  ok(!(await page.isVisible('#navFlip')), 'FLIP should be hidden for a bundled scene');
  await page.evaluate(() => window.__rl.toggle()); await page.waitForFunction(() => window.__rl.state().ready, null, { timeout: 300000 });
  await page.evaluate(() => window.__rl.close()); await page.waitForTimeout(300);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#navLoad')]);
  await fc.setFiles(join(ROOT, 'tests', 'fixtures', 'tiny.splat'));
  await page.waitForFunction(() => window.__dof.state().np === 4000, null, { timeout: 300000 }); await scene(); await page.waitForTimeout(1500);
  ok(await page.isVisible('#navFlip'), 'FLIP not shown after loading your own scan');
  ok(!(await page.isVisible("#chMarks .chm")), "the Stump markers are still showing on your own scan");
  ok(!(await page.isVisible("#navTask.show:not(.empty)")), "lesson task still showing on your own scan");
  ok(!(await page.evaluate(() => window.__rl.state().ready)), 'lighting test did not reset for the new scan');
  await page.evaluate(() => window.__rl.toggle()); await page.waitForFunction(() => window.__rl.state().ready, null, { timeout: 120000 });
  const nn = await page.evaluate(() => window.__rl.state().N); ok(nn > 3500 && nn <= 4000, 'own scan did not load (splat count ' + nn + ')');
  await page.screenshot({ path: join(OUT, 'ownscan.png'), timeout: 240000 });
  await page.evaluate(() => window.__rl.close()); await page.click('#navFlip'); await page.waitForTimeout(500); await scene();
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log('PASS ownscan');
} catch (e) { console.error('FAIL ', e.message); process.exitCode = 1; } finally { await browser.close(); }
