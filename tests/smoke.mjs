// Headless smoke test: hub -> splat viewer -> bundled scene -> camera menu.
// Usage: node tests/smoke.mjs [path/to/studium.html]   (screenshots land in tests/out/)
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
await page.addInitScript(() => { try { localStorage.setItem('studium_detail', 'test'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });

const step = async (name, fn) => { await fn(); await page.screenshot({ path: join(OUT, `${name}.png`), timeout: 240000 }); console.log('ok  ', name); };
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

try {
  await step('1-hub', async () => {
    await page.goto(pathToFileURL(FILE).href + '?dev');
    await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 });   // first run: the sign-in screen
    await page.click('[data-si="solo"]');
    await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 });
    ok(await page.evaluate(() => !!(window.THREE && window.GaussianSplats3D && window.__ed)), 'engine or dev hook missing');
  });
  await step('2-scene-picker', async () => {
    await page.click('#tileSplat');
    await page.waitForSelector('.scenecard', { state: 'visible', timeout: 10000 });
  });
  await step('3-scene-loaded', async () => {
    await page.click('.scenecard');
    await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 }); await page.waitForTimeout(1500); // SwiftShader is slow to sort and draw the splat
    ok(await page.$('canvas') !== null, 'no WebGL canvas after loading the scene');
  });
  await step('4-camera-menu', async () => {
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);
  });
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  (${FILE})`);
} catch (e) {
  console.error('FAIL ', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
