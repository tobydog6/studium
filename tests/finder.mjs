// Viewfinder test: P raises an EVF-style finder; 1 2 3 pick a dial; scroll turns it; Shift+scroll focuses;
// the lens FOV narrows to the frame; a shot captures exactly the frame's aspect and shows the toast.
// Usage: node tests/finder.mjs [path/to/studium.html]
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
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); /* quests: something tracked, so the focus picker doesn't cover the hub */ if (!localStorage.getItem('studium_quests_v1')) localStorage.setItem('studium_quests_v1', JSON.stringify({ v: 1, set: 'term1', tracked: 'f1', lastFocusAsk: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'), quests: { f1: { started: Date.now(), base: { photos: 0, t: Date.now() }, done: null, stepDone: {} } }, tours: {}, tourStep: {}, flags: {}, rs: { cull: {}, punctum: {}, details: 0 }, first: Date.now() })); localStorage.setItem('studium_detail', 'test'); if (!localStorage.getItem('studium_v1')) localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });   // skip the first-run tutorial
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const cb = (f) => page.evaluate(f);
const shot = (n) => page.screenshot({ path: join(OUT, `finder-${n}.png`), timeout: 240000 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&quick');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 });
  await page.click('#tileSplat'); await page.click('.scenecard'); await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 }); await page.waitForTimeout(1500);
  const walkFov = await cb(() => window.__cb.fov());
  await page.keyboard.press('KeyP'); await page.waitForTimeout(400);
  ok(await cb(() => window.__cb.state()) === 'viewfinder', 'P should raise the viewfinder');
  const vfFov = await cb(() => window.__cb.fov());
  ok(vfFov < walkFov, `lens FOV should be narrower than walking: ${vfFov} vs ${walkFov}`);
  ok((await page.textContent('#vfStrip')).includes('SHUTTER'), 'strip missing');
  await shot('1-raised');

  // settings live on the camera back now: in the viewfinder the wheel only zooms a zoom lens
  const c0 = await cb(() => window.__cb.cam());
  await page.mouse.move(720, 400); await page.mouse.wheel(0, -120); await page.waitForTimeout(200);
  const c1 = await cb(() => window.__cb.cam());
  ok(c1.ap === c0.ap && c1.sh === c0.sh && c1.iso === c0.iso, 'scroll should not change the exposure settings');
  ok(c0.lens !== '2470' || c1.mm > c0.mm, 'scrolling up zooms the 24-70 in: ' + JSON.stringify([c0, c1]));
  const f0 = await cb(() => window.__cb.focus());
  await page.keyboard.down('Shift'); await page.mouse.wheel(0, -120); await page.keyboard.up('Shift'); await page.waitForTimeout(120);
  ok(await cb(() => window.__cb.focus()) !== f0, 'shift+scroll should rack focus');
  const g0 = await page.textContent('#vfGuideChip'); await page.keyboard.press('KeyG');
  ok((await page.textContent('#vfGuideChip')) !== g0, 'G should change the guide chip');
  await page.keyboard.press('KeyG', { delay: 20 }); for (let i = 0; i < 4; i++) await page.keyboard.press('KeyG');   // back round to thirds

  await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  ok(await page.$eval('#vfToast', (e) => e.classList.contains('show')), 'toast should show after a shot');
  const dims = await cb(() => new Promise((r) => { const p = window.__cb.photos; const im = new Image(); im.onload = () => r([im.naturalWidth, im.naturalHeight]); im.src = p[p.length - 1].url; }));
  const frame = await page.$eval('#vfFrame', (e) => [e.offsetWidth, e.offsetHeight]);
  ok(Math.abs(dims[0] / dims[1] - frame[0] / frame[1]) < 0.01, `capture ${dims} should match the frame ${frame}`);
  await shot('2-shot-toast');

  await page.keyboard.press('KeyP'); await page.waitForTimeout(300);
  ok(await cb(() => window.__cb.state()) === 'scene', 'P again should lower the camera');
  ok(Math.abs(await cb(() => window.__cb.fov()) - walkFov) < 0.01, 'lowering should restore the walking FOV');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  viewfinder (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; }
finally { await browser.close(); }
