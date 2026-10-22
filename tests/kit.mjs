// Kit menu: Space in the scene opens it; 2 = bag, Space Space = camera back, 4 = lighting plan.
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
await page.addInitScript(() => { try { localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_looked', '1'); localStorage.setItem('studium_lighttour', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const state = () => page.evaluate(() => window.__cb.state());
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick');
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 }); await page.click('#tileSplat');
  await page.waitForSelector('.scenecard', { state: 'visible', timeout: 10000 }); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 }); await page.waitForTimeout(1500);
  await page.keyboard.press('Space'); await page.waitForSelector('#kitMenu.show', { timeout: 5000 }); await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, 'kit.png'), timeout: 240000 });
  await page.keyboard.press('Digit2'); await page.waitForTimeout(800); const s1 = await state(); console.log('after 2:', s1);
  ok(!(await page.isVisible('#kitMenu.show')), 'kit should close after choosing');
  await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  await page.keyboard.press('Space'); await page.waitForTimeout(200); await page.keyboard.press('Digit1'); await page.waitForTimeout(800); ok((await state()) === 'back', 'Digit1 should open the camera back');
  await page.keyboard.press('Space'); await page.waitForTimeout(800);
  await page.keyboard.press('Space'); await page.waitForTimeout(200); await page.keyboard.press('Digit3');
  await page.waitForSelector('#rlPlanUI.show', { timeout: 300000 });
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log('PASS kit');
} catch (e) { console.error('FAIL ', e.message); process.exitCode = 1; } finally { await browser.close(); }
