// Portals: two ends in the Stump, the far side showing through with parallax, and walking through takes you there.
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_looked', '1'); localStorage.setItem('studium_frames_off', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); if (/portal pass/.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: join(OUT, n + '.png'), timeout: 120000 }).catch(() => {});
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick&noauto');
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'attached', timeout: 20000 }); await page.$eval('#tileSplat', (b) => b.click());
  await page.waitForSelector('.scenecard', { state: 'visible', timeout: 10000 }); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 });
  await ev(() => window.__qu.closeAll()); await page.waitForTimeout(3000);
  ok(!(await ev(() => window.__pt.state())).on, 'no portal until you ask');
  await page.keyboard.press('KeyT'); await page.waitForTimeout(700);
  ok((await ev(() => window.__pt.state())).state === 'opening', 'T opens a portal');
  await shot('portal-0-opening');
  await page.waitForFunction(() => window.__pt.state().state === 'open', null, { timeout: 120000, polling: 300 });
  await page.waitForTimeout(9000); await shot('portal-1-open'); await page.waitForTimeout(3000); await shot('portal-1b-open');
  const st = await ev(() => window.__pt.state()); console.log(JSON.stringify(st)); ok(st.live, 'the far side is showing');
  // walk through, one step per drawn frame (software rendering is slow)
  for (let i = 0; i < 12 && (await ev(() => window.__pt.state().state)) !== 'closing'; i++) { await ev(() => window.__pt.step(0.35));
    await page.waitForFunction(() => { const d = window.__pt.dbg(); return !d.prev || d.prev.every((v, k) => Math.abs(v - d.cam[k]) < 1e-6); }, null, { timeout: 120000, polling: 200 }); }
  const after = await ev(() => window.__pt.pos()), far = st.far, d = Math.hypot(after.x - far[0], after.z - far[2]);
  console.log('after', after, 'from the far spot', d.toFixed(2)); ok(d < 1.5, 'walked through to the far spot');
  ok((await ev(() => window.__pt.state())).state === 'closing', 'it closes behind you');
  await ev(() => window.__pt.turn(Math.PI)); await page.waitForTimeout(400); await shot('portal-2-closing-behind');
  await page.waitForFunction(() => !window.__pt.state().on, null, { timeout: 120000, polling: 300 });
  // T then T: open and close without going through
  await page.keyboard.press('KeyT'); await page.waitForTimeout(300); await page.keyboard.press('KeyT');
  await page.waitForFunction(() => !window.__pt.state().on, null, { timeout: 120000, polling: 300 });
  ok(!errors.length, 'page errors: ' + errors.join(' | '));
  console.log('PASS portal');
} catch (e) { console.error('FAIL', e.message); console.error(errors.join('\n')); process.exitCode = 1; await shot('portal-fail'); }
await browser.close();
