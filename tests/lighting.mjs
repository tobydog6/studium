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
await page.addInitScript(() => { try { /* quests: something tracked, so the focus picker doesn't cover the hub */ if (!localStorage.getItem('studium_quests_v1')) localStorage.setItem('studium_quests_v1', JSON.stringify({ v: 1, set: 'term1', tracked: 'f1', lastFocusAsk: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'), quests: { f1: { started: Date.now(), base: { photos: 0, t: Date.now() }, done: null, stepDone: {} } }, tours: {}, tourStep: {}, flags: {}, rs: { cull: {}, punctum: {}, details: 0 }, first: Date.now() })); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_looked', '1'); } catch (e) {} });
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
  // open Lighting from the kit: it goes straight to the view from above
  await page.keyboard.press('Space'); await page.waitForSelector('#kitMenu.show'); await page.keyboard.press('Digit3');
  await page.waitForFunction(() => window.__rl.state().ready && window.__rl.state().view === 'plan', null, { timeout: 300000 });
  ok(!(await page.isVisible('#kitMenu.show')), 'kit should close');
  await page.waitForSelector('#coCard.show', { timeout: 30000 }); ok(/Lighting/.test(await page.textContent('#coCard')), 'the lighting tour did not start');
  await tap('#rlPanel [data-rl-time="golden"]'); await page.waitForTimeout(500);
  ok((await st()).sunPow > 0 && await page.$('#rlPanel .rl-sun') && await page.$('#rlPlanUI .rlp-sun'), 'golden hour should bring the sun, its sliders and its handle');
  await tap('#rlPanel [data-rl-time="night"]');
  await tap('#rlPanel [data-rl-fx="fresnel"]'); await tap('#rlPanel [data-rl-fx="led"]'); await page.waitForTimeout(800);
  ok((await st()).n === 2, 'expected two lights');
  // drag light 1 by its icon
  const p = await page.evaluate(() => window.__rl.scr(0)); const x0 = (await st()).light.x;
  await page.mouse.move(p.x + 4, p.y + 3); await page.mouse.down(); await page.mouse.move(p.x - 140, p.y + 50, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(600);
  ok(Math.abs((await st()).light.x - x0) > 0.3 && (await st()).moved === 1, 'dragging a light did not move it');
  // pan: drag empty ground, then WASD
  const c0 = (await st()).planC; await page.mouse.move(300, 450); await page.mouse.down(); await page.mouse.move(420, 520, { steps: 3 }); await page.mouse.up();
  const c1 = (await st()).planC; ok(Math.hypot(c1.x - c0.x, c1.z - c0.z) > 0.2, 'dragging the ground did not pan');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(5000); await page.keyboard.up('KeyD');
  ok((await st()).planC.x > c1.x + 0.05, 'D did not pan');
  await page.waitForTimeout(2500); await shot('lighting-plan');
  await tap('#rlPanel [data-rl-view="eye"]'); await page.waitForTimeout(2500); await shot('lighting');
  await tap('#rlPanel [data-rl="done"]'); await page.waitForTimeout(300);
  ok(!(await page.isVisible('#rlPanel.show')) && (await st()).on && (await st()).n === 2, 'Done should close the panel and keep the lights');
  await page.keyboard.press('Space'); await page.waitForSelector('#kitMenu.show'); await page.keyboard.press('Space'); await page.waitForTimeout(300);
  ok(!(await page.isVisible('#kitMenu.show')) && (await page.evaluate(() => window.__cb.state())) === 'scene', 'Space should close the kit, not open the camera back');
  await page.keyboard.press('KeyL'); await page.waitForSelector('#rlPanel.show'); await tap('#rlPanel [data-rl="natural"]');
  ok((await st()).n === 0 && !(await st()).on, 'Natural light should clear the lights');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log('PASS lighting');
} catch (e) { console.error('FAIL ', e.message); await shot('lighting-fail').catch(()=>{}); process.exitCode = 1; } finally { await browser.close(); }
