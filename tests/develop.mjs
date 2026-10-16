// Develop test: edits stay on the frame, next / previous, copy and paste settings, sync to selected frames.
// Folio (A0 portrait series), room switching and leaving. Feeds real frames from the Stump scan as fixtures.
// Usage: node tests/studio.mjs [path/to/studium.html]
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(process.argv[2] || join(ROOT, 'dist', 'studium.html'));
const OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });
const FIX = join(ROOT, 'tests', 'fixtures');
const frames = readdirSync(FIX).filter((f) => f.endsWith('.jpg')).sort().map((f) => 'data:image/jpeg;base64,' + readFileSync(join(FIX, f)).toString('base64'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); if (!localStorage.getItem('studium_v1')) localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const cb = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: join(OUT, `develop-${n}.png`), timeout: 120000 });
const setSlider = (id, v) => page.evaluate(([i, val]) => { const e = document.getElementById(i); e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const P = () => cb(() => window.__cb.photos.map((p) => ({ dev: p.dev ? { exposure: p.dev.exposure, contrast: p.dev.contrast, mono: p.dev.mono } : null, orig: !!p.orig, edited: !!p.edited })));
const cur = () => cb(() => window.__cb.studio().cur);
try {
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.waitForSelector('#tileStudio', { state: 'visible', timeout: 20000 });
  await cb((fs) => fs.slice(0, 6).forEach((u, i) => window.__cb.addPhoto({ url: u, f: 4, sh: '1/125', iso: 400, mm: 50, body: 'Full-frame DSLR', place: 'The Stump' })), frames);
  await page.click('#tileStudio'); await page.waitForTimeout(500);
  await page.click('[data-st-frame="0"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  ok(await page.$eval('#editor', (e) => !e.classList.contains('hidden')), 'editor should open');
  ok((await page.$$('.dv-fr')).length === 6, 'filmstrip should show every frame');
  const url0 = await cb(() => window.__cb.photos[0].url);

  // edit frame 1, move on: the edit stays on the frame
  await setSlider('pExposure', 40); await setSlider('pContrast', 30);
  await page.click('#editStage'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1200);
  let ph = await P();
  ok(ph[0].dev && ph[0].dev.exposure === 40 && ph[0].orig && ph[0].edited, 'frame 1 should keep its edit: ' + JSON.stringify(ph[0]));
  ok((await cb(() => window.__cb.photos[0].url)) !== url0, 'frame 1 should show the edited render');
  ok(await cur() === 1, 'right arrow should move to frame 2');
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(1200);
  ok((await page.inputValue('#pExposure')) === '40', 'going back should reopen the same sliders');

  // copy from frame 1, paste on frame 2
  await page.click('#dvCopy');
  await page.click('[data-dv="1"]'); await page.waitForTimeout(1200);
  await page.click('#dvPaste'); await page.waitForTimeout(200);
  ok((await page.inputValue('#pContrast')) === '30', 'paste should bring the contrast across');

  // select frames 3-5 with shift-click and sync frame 2's look onto them, then make it B&W first
  await page.click('#eBW'); await page.waitForTimeout(150);
  await page.click('[data-dv="4"]', { modifiers: ['Shift'] }); await page.waitForTimeout(150);
  ok((await page.textContent('#dvSync')).includes('SYNC TO 3'), 'sync should offer the three other frames');
  await shot('1-sync-ready');
  await page.click('#dvSync'); await page.waitForTimeout(4000);
  ph = await P();
  ok([2, 3, 4].every((i) => ph[i].dev && ph[i].dev.exposure === 40 && ph[i].dev.mono === 1), 'sync should put the settings on frames 3-5: ' + JSON.stringify(ph.slice(2, 5)));
  ok(!ph[5].dev, 'frame 6 was not selected and should be untouched');
  ok(await cur() === 1, 'sync keeps you on the frame you were editing');

  // Done goes back to Select, and the edits show there
  await page.click('#eSave'); await page.waitForTimeout(600);
  ok((await cb(() => window.__cb.studio())).room === 'select', 'Done should return to Select');
  await shot('2-select-after');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  develop (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; }
finally { await browser.close(); }
