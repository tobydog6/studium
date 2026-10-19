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
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_looked', '1'); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: join(OUT, `challenge-${n}.png`), timeout: 240000 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&quick');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 60000 });
  await page.click('#tileSplat'); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 }); await page.waitForTimeout(1500);
  const pads = await ev(() => window.__ch.pads());
  ok(pads.length === 6, 'six challenge frames expected, got ' + pads.length); console.log(JSON.stringify(pads.map((p) => [p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.y.toFixed(2), +p.w.toFixed(2)])));
  ok(await page.$eval('#chMarks', (e) => e.classList.contains('show') && e.children.length === 6), 'markers should point to the frames');
  await shot('1-markers');
  // walk into the first spot
  // step just inside the outer edge of its pulse, facing away and still moving: that alone should take you
  await ev(() => { window.__ch.approach(0, 0.9, Math.PI); window.__ch.nudge(); });
  await page.waitForFunction(() => window.__ch.active() === 0, null, { timeout: 120000 }).catch(() => {});   // SwiftShader runs about 1 fps here
  ok(await ev(() => window.__ch.active()) === 0, 'standing in the spot should open challenge 1');
  ok(await page.$eval('#chCard', (e) => e.classList.contains('show')), 'the challenge card should show');
  let checks = await ev(() => window.__ch.checks());
  ok(checks.some((c) => !c.ok), 'not everything should be ticked at the start');
  const pad0 = (await ev(() => window.__ch.pads()))[0]; ok(pad0.w > 0.55 && pad0.w < 0.8, 'a 24 mm frame 45 cm out should be about 0.65 m wide: ' + pad0.w);
  // stand at the frame's eye point (crouched), look through it, 24 mm, f/8
  await ev(() => { window.__ch.set({ mm: 24, f: 11 }); });
  // once it starts pulling, a nudge doesn't break it: it finishes, then holds you for a second
  await page.waitForFunction(() => window.__ch.pull().i === 0, null, { timeout: 120000, polling: 500 });
  if (!(await ev(() => window.__ch.pull().locked))) { await ev(() => window.__ch.nudge()); await page.waitForTimeout(1500); ok((await ev(() => window.__ch.pull())).i === 0, 'a touch mid-pull should not break it'); }
  await page.waitForFunction(() => window.__ch.pull().locked, null, { timeout: 240000, polling: 250 });   // pulled in, crouched and turned to fit the frame
  await ev(() => window.__ch.nudge()); await page.waitForTimeout(150);
  ok((await ev(() => window.__ch.pull())).i === 0, 'the first second after landing should hold you');
  await page.waitForFunction(() => window.__ch.checks()[0].ok, null, { timeout: 120000, polling: 1000 });
  await shot('2-locked');
  // the challenge's checklist comes onto the camera back
  await ev(() => window.__cb.open()); await page.waitForTimeout(500);
  ok(await page.$('#camback .cb-task'), 'the camera back shows the challenge checklist');
  ok(/CHALLENGE/.test(await page.$eval('#camback .cb-task', (e) => e.textContent)), 'it names the challenge');
  await shot('2b-back-task');
  await ev(() => window.__cb.close()); await page.waitForTimeout(300);
  // after the grace second, any move lets go, and it won't grab again until you've left its range
  await page.waitForTimeout(1200); await ev(() => window.__ch.nudge());
  await page.waitForFunction(() => window.__ch.pull().i === -1, null, { timeout: 60000, polling: 500 });
  await page.waitForTimeout(4000);
  const p2 = await ev(() => window.__ch.pull()); ok(p2.i === -1 && p2.cool === 0, 'should stay released while still in range: ' + JSON.stringify(p2));
  await ev(() => { window.__ch.goto(0); window.__ch.aim(0); });   // line back up by hand
  await page.waitForFunction(() => window.__ch.checks()[0].ok, null, { timeout: 120000, polling: 1000 });
  let checks2 = await ev(() => window.__ch.checks());
  ok(checks2.slice(0, 4).every((c) => c.ok), 'lined up, lens and aperture should tick: ' + JSON.stringify(checks2));
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
  ok(last.ch === 'stump-fgbg', 'the shot should complete the challenge: ' + JSON.stringify(last));
  ok((await ev(() => window.__ch.pads()))[0].done, 'the spot should be marked done');
  await page.waitForTimeout(200); await shot('3-complete');
  // X turns the camera vertical: the finder frame stands on end
  await page.keyboard.press('KeyX'); await page.waitForTimeout(1500);
  const fr = await page.$eval('#vfFrame', (e) => ({ w: e.offsetWidth, h: e.offsetHeight }));
  ok(fr.h > fr.w, 'vertical should make the frame taller than wide: ' + JSON.stringify(fr));
  await shot('4-vertical');
  await page.keyboard.press('KeyX');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  challenge (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; }
finally { await browser.close(); }
