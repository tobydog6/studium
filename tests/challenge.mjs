// Challenge test: gold spots load, walking in opens the card, the checklist ticks, the shot completes it.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(process.argv[2] || join(ROOT, 'dist', 'studium.html'));
const OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_looked', '1'); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: join(OUT, `challenge-${n}.png`), timeout: 240000 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 60000 });
  await page.click('#tileSplat'); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 }); await page.waitForTimeout(1500);
  const pads = await ev(() => window.__ch.pads());
  ok(pads.length === 5, 'five challenge frames expected, got ' + pads.length); console.log(JSON.stringify(pads.map((p) => [p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.y.toFixed(2), +p.w.toFixed(2)])));
  ok(await page.$eval('#chMarks', (e) => e.classList.contains('show') && e.children.length === 5), 'markers should point to the frames');
  await shot('1-markers');
  // walk into the first spot
  await ev(() => window.__ch.approach(0));   // a metre short of it, looking roughly its way: the beam should take over
  await page.waitForFunction(() => window.__ch.active() === 0, null, { timeout: 120000 }).catch(() => {});   // SwiftShader runs about 1 fps here
  ok(await ev(() => window.__ch.active()) === 0, 'standing in the spot should open challenge 1');
  ok(await page.$eval('#chCard', (e) => e.classList.contains('show')), 'the challenge card should show');
  let checks = await ev(() => window.__ch.checks());
  ok(checks.some((c) => !c.ok), 'not everything should be ticked at the start');
  const pad0 = (await ev(() => window.__ch.pads()))[0]; ok(pad0.w > 0.6 && pad0.w < 0.9, 'a 24 mm frame 55 cm out should be about 0.8 m wide: ' + pad0.w);
  // stand at the frame's eye point (crouched), look through it, 24 mm, f/8
  await ev(() => { window.__ch.set({ mm: 24, f: 8 }); });
  await page.waitForFunction(() => window.__ch.pull().locked, null, { timeout: 240000, polling: 1000 });   // pulled in, crouched and turned to fit the frame
  await page.waitForFunction(() => window.__ch.checks()[0].ok, null, { timeout: 120000, polling: 1000 });
  await shot('2-locked');
  let checks2 = await ev(() => window.__ch.checks());
  ok(checks2.slice(0, 3).every((c) => c.ok), 'lined up, lens and aperture should tick: ' + JSON.stringify(checks2));
  await ev(() => window.__ch.set({ meter: true })); await page.waitForTimeout(300);
  ok(await ev(() => window.__ch.checks().every((c) => c.ok)), 'metering should tick the exposure too: ' + JSON.stringify(await ev(() => window.__ch.checks())));
  await shot('2-card');
  // raise the camera and shoot
  await page.keyboard.press('KeyP'); await page.waitForFunction(() => window.__cb.state() === 'viewfinder', null, { timeout: 120000 }); await page.waitForTimeout(3000);
  await page.waitForTimeout(1500);
  const before = await ev(() => window.__cb.photos.length);
  await page.keyboard.press('Enter'); await page.waitForFunction((n) => window.__cb.photos.length > n, before, { timeout: 240000 }); await page.waitForTimeout(500);
  const last = await ev(() => { const p = window.__cb.photos; return { n: p.length, ch: p[p.length - 1].challenge || null }; });
  ok(last.n === before + 1, 'a photo should be taken');
  ok(last.ch === 'stump-worm', 'the shot should complete the challenge: ' + JSON.stringify(last));
  ok((await ev(() => window.__ch.pads()))[0].done, 'the spot should be marked done');
  await page.waitForTimeout(200); await shot('3-complete');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  challenge (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; }
finally { await browser.close(); }
