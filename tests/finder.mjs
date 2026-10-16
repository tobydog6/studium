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
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); if (!localStorage.getItem('studium_v1')) localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });   // skip the first-run tutorial
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const cb = (f) => page.evaluate(f);
const shot = (n) => page.screenshot({ path: join(OUT, `finder-${n}.png`), timeout: 120000 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 });
  await page.click('#tileSplat'); await page.click('.scenecard'); await page.waitForTimeout(9000);
  const walkFov = await cb(() => window.__cb.fov());
  await page.keyboard.press('KeyP'); await page.waitForTimeout(400);
  ok(await cb(() => window.__cb.state()) === 'viewfinder', 'P should raise the viewfinder');
  const vfFov = await cb(() => window.__cb.fov());
  ok(vfFov < walkFov, `lens FOV should be narrower than walking: ${vfFov} vs ${walkFov}`);
  ok((await page.textContent('#vfStrip')).includes('SHUTTER'), 'strip missing');
  await shot('1-raised');

  await page.keyboard.press('Digit2'); ok(await cb(() => window.__cb.dial()) === 'ap', '2 should pick aperture');
  const ap0 = (await cb(() => window.__cb.cam())).ap;
  await page.mouse.move(720, 400); await page.mouse.wheel(0, 120); await page.waitForTimeout(120);
  ok((await cb(() => window.__cb.cam())).ap > ap0, 'scroll should stop the aperture down');
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
