// Lighting test (?relight): several lights, a spot aimed at the crosshair, bulbs hidden with the camera up; and HIDE FRAMES.
// Usage: node tests/lighting.mjs [path/to/studium.html]
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
await page.addInitScript(() => { try { localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_looked', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const shot = (n) => page.screenshot({ path: join(OUT, n + '.png'), timeout: 240000 });
const tap = (sel) => page.$eval(sel, (b) => b.click());
const st = () => page.evaluate(() => window.__rl.state());
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick&relight');
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 }); await page.click('#tileSplat');
  await page.waitForSelector('.scenecard', { state: 'visible', timeout: 10000 }); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 }); await page.waitForTimeout(1500);
  // frames
  await page.waitForSelector('#navFrames', { state: 'visible', timeout: 20000 });
  ok(await page.isVisible('#chMarks.show'), 'frame markers should show before hiding');
  await page.click('#navFrames'); await page.waitForTimeout(300);
  ok(!(await page.isVisible('#chMarks.show')), 'HIDE FRAMES did not hide the markers');
  ok((await page.textContent('#navFrames')).includes('SHOW'), 'button should now say SHOW FRAMES');
  // lights
  await page.keyboard.press('KeyL'); await page.waitForFunction(() => window.__rl.state().ready, null, { timeout: 300000 });
  await tap('#rlPanel [data-rl-time="night"]');
  await tap('#rlPanel [data-rl-fx="fresnel"]'); await page.waitForTimeout(300);
  await page.evaluate(() => window.__rl.light({ gel: '#5aa0ff' }));
  await tap('#rlPanel [data-rl-fx="led"]'); await page.waitForTimeout(300);
  ok((await st()).n === 2, 'expected two lights');
  await tap('#rlPanel [data-rl-pick="0"]'); ok((await st()).sel === 0, 'picking light 1 failed');
  await tap('#rlPanel [data-rl="dup"]'); ok((await st()).n === 3, 'duplicate failed');
  await tap('#rlPanel [data-rl="del"]'); ok((await st()).n === 2, 'delete failed');
  await page.waitForTimeout(1500); await shot('lighting');
  // plan view: drag light 2 sideways
  await tap('#rlPanel [data-rl="plan"]'); await page.waitForTimeout(2500);
  const box = await page.locator('#rlPlanUI .rlp-l[data-i="1"] i').boundingBox(); ok(box, 'no light icon in plan view');
  const x0 = await page.evaluate(() => window.__rl.dbg().lights[1].x);
  await page.mouse.move(box.x + 11, box.y + 11); await page.mouse.down(); await page.mouse.move(box.x - 120, box.y + 60, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(2500); await shot('lighting-plan');
  ok(Math.abs((await page.evaluate(() => window.__rl.dbg().lights[1].x)) - x0) > 0.5, 'dragging in plan view did not move the light');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  ok(!(await page.isVisible('#rlPlanUI.show')), 'Esc did not leave plan view');
  await tap('#rlPanel [data-rl="reset"]'); ok((await st()).n === 0, 'reset failed');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log('PASS lighting');
} catch (e) { console.error('FAIL ', e.message); await shot('lighting-fail').catch(()=>{}); process.exitCode = 1; } finally { await browser.close(); }
