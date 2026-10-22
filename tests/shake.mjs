// Shake test: a slow shutter on a long lens smears the photo, a fast one doesn't, and the finder warns you first.
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_looked', '1'); /* quests: something tracked, so the focus picker doesn't cover the hub */ if (!localStorage.getItem('studium_quests_v1')) localStorage.setItem('studium_quests_v1', JSON.stringify({ v: 1, set: 'term1', tracked: 'f1', lastFocusAsk: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'), quests: { f1: { started: Date.now(), base: { photos: 0, t: Date.now() }, done: null, stepDone: {} } }, tours: {}, tourStep: {}, flags: {}, rs: { cull: {}, punctum: {}, details: 0 }, first: Date.now() })); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
// mean absolute difference between neighbouring pixels: lower = softer
const sharp = (url) => ev(async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0, n = 0;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width - 1; x += 2) { const i = (y * c.width + x) * 4; s += Math.abs(d[i + 1] - d[i + 5]); n++; } return s / n; }, url);
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&quick');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 60000 });
  await page.click('#tileSplat'); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 }); await page.waitForTimeout(1500);
  await page.keyboard.press('KeyP'); await page.waitForFunction(() => window.__cb.state() === 'viewfinder', null, { timeout: 120000 }); await page.waitForTimeout(2000);
  const shoot = async (sh) => { await ev((s) => window.__ch.set({ mm: 135, sh: s, meter: false }), sh); await page.waitForTimeout(1500);
    const n = await ev(() => window.__cb.photos.length); await page.keyboard.press('Enter');
    await page.waitForFunction((k) => window.__cb.photos.length > k, n, { timeout: 240000 }); return ev(() => { const p = window.__cb.photos; return p[p.length - 1]; }); };
  await ev(() => window.__ch.set({ mm: 135, sh: '1/1000' })); await page.waitForTimeout(1000);
  ok(!(await page.$('#vfStrip .vf-shake')), 'no shake warning at 1/1000 on 135 mm');
  const fast = await shoot('1/1000');
  ok(await page.$('#vfStrip .vf-shake') === null, 'still no warning');
  await ev(() => window.__ch.set({ sh: '1/2' })); await page.waitForTimeout(1000);
  ok(await page.$('#vfStrip .vf-shake'), 'the shutter dial should warn about shake at 1/2 on 135 mm');
  await page.screenshot({ path: join(OUT, 'shake-1-warning.png'), timeout: 240000 });
  const slow = await shoot('1/2');
  ok(fast.shake < 0.001 && slow.shake > 0.01, 'shake recorded on the photo: ' + fast.shake + ' / ' + slow.shake);
  ok(await ev(() => window.__shake.limit()) === '1/125', '135 mm full-frame should be safe at 1/125');
  await ev(() => { window.__ch.goto(0); window.__ch.aim(0); window.__ch.set({ mm: 50, f: 8, meter: true }); }); await page.waitForTimeout(4000);   // look at the stump: detail to blur
  const [u0, u1] = await ev(() => [window.__shake.capture(0), window.__shake.capture(0.03)]);   // same frame, same exposure
  const a = await sharp(u0), b = await sharp(u1);
  console.log('sharpness fast', a.toFixed(2), 'slow', b.toFixed(2));
  ok(b < a * 0.85, 'the slow shot should be visibly softer');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  shake (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; }
finally { await browser.close(); }
