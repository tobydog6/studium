// Guide test: the first-session walkthrough, step by step, from the first popup over the scan to the last one.
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
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_looked', '1'); localStorage.setItem('studium_detail', 'test'); if (!localStorage.getItem('studium_v1')) localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: join(OUT, `guide-${n}.png`), timeout: 240000 });
const gd = () => ev(() => window.__gd.state());
const waitStep = (id) => page.waitForFunction((x) => window.__gd.state().id === x && window.__gd.state().open, id, { timeout: 60000, polling: 300 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 60000 });
  ok(!(await page.$('#gdPop.show')), 'no guide popup on the home page');
  await page.click('#tileSplat'); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 });
  await waitStep('challenges');
  ok(await page.$eval('#gdPop', (e) => /Welcome to the Stump/.test(e.textContent) && e.querySelectorAll('kbd').length >= 8), 'the first popup shows the controls');
  await shot('1-welcome');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(1200);
  ok(await page.$('#gdCard.show'), 'the checklist card shows after the popup');
  ok(/challenges/i.test(await page.$eval('#gdCard', (e) => e.textContent)), 'card lists the challenges');
  await shot('2-card');
  // challenges done (simulated) → free shoot
  await ev(() => window.__gd.set(1)); await waitStep('shoot'); await shot('3-shoot');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(300);
  const lenses = ['2470', '50', '85', '135'], fs = [2.8, 8, 16], shs = ['1/500', '1/60', '1/15'], isos = [100, 400, 1600];
  await ev((a) => { for (let i = 0; i < 15; i++) window.__cb.addPhoto({ url: a.frames[i % a.frames.length], f: a.fs[i % 3], sh: a.shs[i % 3], iso: a.isos[i % 3], mm: 50, lens: a.lenses[i % 4], body: 'Full-frame DSLR', place: 'The Stump' }); }, { frames, fs, shs, isos, lenses });
  await waitStep('select'); await shot('4-select');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(600);
  ok((await ev(() => window.__cb.studio())).room === 'select', 'the button opens Select');
  await ev(() => { window.__cb.photos.forEach((p, i) => { p.pick = i < 8; }); });
  await waitStep('edit');
  await page.evaluate(() => document.querySelector('#st-select [data-lib-f="all"]').click()); await page.waitForTimeout(300);
  ok(await page.$('#st-select .lib-f.sub'), 'a Picked photos folder appears inside the location');
  await shot('5-edit');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(1500);
  ok((await ev(() => window.__cb.studio())).room === 'edit', 'the button opens Edit');
  ok(await page.$$eval('#dvFilm [data-dv]', (n) => n.length) === 8, 'editing just the 8 picks');
  await ev(() => { const P = window.__cb.photos; P[0].dev = { exposure: 0.4 }; P[1].dev = { mono: 1 }; P[2].dev = { aspect: '1' }; window.__gd.flag('synced'); });
  await waitStep('workbook'); await shot('6-workbook');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(800);
  ok((await ev(() => window.__cb.studio())).room === 'workshop', 'the button opens the workbook');
  await page.click('#st-workshop [data-bd-tmpl="0"]'); await page.waitForTimeout(400);
  const tx = await page.$$('#st-workshop .bd-it.tx'); const bx = await tx[tx.length - 1].boundingBox();
  await page.mouse.click(bx.x + 20, bx.y + bx.height / 2); await page.waitForTimeout(300);
  await page.keyboard.type('I stood low so the ivy fills the bottom of the frame and leads you up.'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.click('#st-workshop .bd-tools [data-bd-act="arrow"]'); await page.waitForTimeout(300);
  await page.click('#st-workshop .lib-grid [data-bd-pic="1"]'); await page.waitForTimeout(300);
  await waitStep('folio'); await shot('7-folio');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(800);
  await page.hover('#st-folio .bd-sheet'); await page.click('#st-folio [data-bd-zoom="0"]'); await page.waitForTimeout(800);
  await page.click('#st-folio [data-lib-f="place:The Stump|picks"]'); await page.waitForTimeout(300);
  for (const i of [0, 1, 2]) { await page.click(`#st-folio .lib-grid [data-bd-pic="${i}"]`); await page.waitForTimeout(300); }
  await waitStep('done'); await shot('8-done');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(500);
  ok((await gd()).step === -1 && !(await page.$('#gdCard.show')), 'finishing turns the guide off');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  guide (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; await shot('fail').catch(() => {}); }
finally { await browser.close(); }
