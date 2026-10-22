// Crop test: C opens the crop box over the whole photo; drag a corner and an edge, move it, lock 4:5, swap it,
// apply with Enter, and the photo comes back cropped. Esc cancels; Reset gives the whole photo back.
// Usage: node tests/crop.mjs [path/to/studium.html]
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(process.argv[2] || join(ROOT, 'dist', 'studium.html'));
const OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });
const FIX = join(ROOT, 'tests', 'fixtures');
const frames = readdirSync(FIX).filter((f) => f.endsWith('.jpg')).sort().map((f) => 'data:image/jpeg;base64,' + readFileSync(join(FIX, f)).toString('base64'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); /* quests: something tracked, so the focus picker doesn't cover the hub */ if (!localStorage.getItem('studium_quests_v1')) localStorage.setItem('studium_quests_v1', JSON.stringify({ v: 1, set: 'term1', tracked: 'f1', lastFocusAsk: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'), quests: { f1: { started: Date.now(), base: { photos: 0, t: Date.now() }, done: null, stepDone: {} } }, tours: {}, tourStep: {}, flags: {}, rs: { cull: {}, punctum: {}, details: 0 }, first: Date.now() })); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
const ok = (c, m) => { if (!c) throw new Error(m); };
const cs = () => page.evaluate(() => window.__crop.state());
const shot = (n) => page.screenshot({ path: join(OUT, `crop-${n}.png`), timeout: 240000 });
const handle = async (h) => { const b = await (await page.$(`#cropUI [data-crop-h="${h}"]`)).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const drag = async (from, dx, dy) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(150); };
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&quick');
  await page.waitForSelector('#tileStudio', { state: 'visible', timeout: 20000 });
  await page.evaluate((fs) => fs.forEach((u) => window.__cb.addPhoto({ url: u, f: 5.6, sh: '1/125', iso: 400, mm: 50, body: 'Full-frame DSLR', place: 'The Stump' })), frames);
  await page.click('#tileStudio'); await page.waitForTimeout(600);
  await page.click('[data-st-frame="3"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
  // C opens it over the whole photo
  await page.keyboard.press('KeyC'); await page.waitForTimeout(600);
  let s = await cs(); ok(s.on && s.box.w === 1 && s.box.h === 1, 'C opens the crop box on the whole photo: ' + JSON.stringify(s));
  ok(await page.$eval('#editor', (e) => e.classList.contains('cropping')), 'the editor is in crop mode');
  // free: drag the bottom-right corner in, then the left edge in, then move the box
  await drag(await handle('se'), -220, -120); s = await cs();
  ok(s.box.w < 0.9 && s.box.h < 0.9 && s.box.x === 0 && s.box.y === 0, 'the corner resizes from the opposite corner: ' + JSON.stringify(s.box));
  const w1 = s.box.w; await drag(await handle('w'), 80, 0); s = await cs();
  ok(s.box.x > 0.05 && s.box.w < w1 && Math.abs(s.box.x + s.box.w - w1) < 0.01, 'the left edge moves on its own: ' + JSON.stringify(s.box));
  const bb = await (await page.$('#cropUI .crop-box')).boundingBox(); await drag({ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }, 60, 50); s = await cs();
  ok(s.box.y > 0.02, 'dragging inside moves the box: ' + JSON.stringify(s.box));
  await shot('1-free');
  // 4:5 locks the ratio; corner drags keep it; swap turns it to 5:4
  await page.click('#editor .lr-ct[data-a="0.8"]'); await page.waitForTimeout(200); s = await cs();
  const ratio = (b) => (b.w * +s.px.split('x')[0]) / (b.h * +s.px.split('x')[1]);
  ok(Math.abs(ratio(s.box) - 0.8) < 0.01, '4:5 sets the ratio: ' + ratio(s.box));
  await drag(await handle('ne'), -60, 40); s = await cs(); ok(Math.abs(ratio(s.box) - 0.8) < 0.01, 'a corner drag keeps 4:5: ' + ratio(s.box));
  await drag(await handle('s'), 0, -40); s = await cs(); ok(Math.abs(ratio(s.box) - 0.8) < 0.01, 'an edge drag keeps 4:5 too: ' + ratio(s.box));
  await page.click('#eCropSwap'); await page.waitForTimeout(200); s = await cs(); ok(Math.abs(ratio(s.box) - 1.25) < 0.01, 'swap makes it 5:4: ' + ratio(s.box));
  await page.click('#editor .lr-ct[data-a="0.8"]'); await page.waitForTimeout(200);   // the largest 4:5 box: full height
  await drag(await handle('sw'), 50, -60);
  await shot('2-ratio');
  // Enter applies: the photo comes back as just the crop
  const before = await cs(); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); s = await cs();
  ok(!s.on && Math.abs(parseFloat(s.aspect) - 0.8) < 0.01 && s.zoom > 1, 'Enter applies the crop: ' + JSON.stringify(s));
  ok(Math.abs(s.cx - (before.box.x + before.box.w / 2)) < 0.01, 'centred where the box was');
  const cw = await page.$eval('#editCanvas', (c) => c.width / c.height); ok(Math.abs(cw - 0.8) < 0.02, 'the canvas shows the 4:5 crop: ' + cw);
  await shot('3-applied');
  // open again: the box comes back where it was; Esc cancels a change
  await page.click('#eCrop'); await page.waitForTimeout(400); s = await cs(); ok(s.on && Math.abs(s.box.w - before.box.w) < 0.01, 'reopening shows the same box');
  await drag(await handle('nw'), 50, 50); await page.keyboard.press('Escape'); await page.waitForTimeout(300); s = await cs();
  ok(!s.on && Math.abs(parseFloat(s.aspect) - 0.8) < 0.01 && Math.abs(s.cx - (before.box.x + before.box.w / 2)) < 0.01, 'Esc puts it back: ' + JSON.stringify(s));
  // Reset gives the whole photo; applying that clears the crop
  await page.keyboard.press('KeyC'); await page.waitForTimeout(300); await page.click('#eCropReset'); await page.click('#eCropApply'); await page.waitForTimeout(400); s = await cs();
  ok(s.aspect === 'free' && s.zoom === 1, 'reset and apply gives the whole photo back: ' + JSON.stringify(s));
  // before / after has a button
  await page.click('#eBefore'); await page.waitForTimeout(200); ok(await page.$eval('#eBefore', (b) => b.classList.contains('on')), 'Before / After button toggles');
  await page.click('#eBefore');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  crop (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; await shot('fail').catch(() => {}); }
finally { await browser.close(); }
