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
const gdClick = async (k) => { const sel = '#gdPop [data-gd="' + k + '"]'; await page.waitForFunction((s) => { const b = document.querySelector(s); return b && !b.disabled; }, sel, { timeout: 120000, polling: 200 }); await page.$eval(sel, (b) => b.click()); };   // the popup sits over a 1 fps scene here, so click it directly once it unlocks
const ev = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: join(OUT, `guide-${n}.png`), timeout: 240000 });
const gd = () => ev(() => window.__gd.state());
const waitStep = (id) => page.waitForFunction((x) => window.__gd.state().id === x && window.__gd.state().open, id, { timeout: 60000, polling: 300 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&quick');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 60000 });
  ok(!(await page.$('#gdPop.show')), 'no guide popup on the home page');
  await page.click('#tileSplat'); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 });
  await waitStep('basics');
  ok(await page.$eval('#gdPop', (e) => /Welcome to the Stump/.test(e.textContent)), 'the first popup welcomes you to the warm-up');
  await shot('1-welcome');
  await gdClick('next'); await waitStep('challenges');   // the warm-up has its own test (coach.mjs)
  await gdClick('go'); await page.waitForTimeout(1200);
  ok(await page.$('#gdCard.show'), 'the checklist card shows after the popup');
  ok(/challenges/i.test(await page.$eval('#gdCard', (e) => e.textContent)), 'card lists the challenges');
  await shot('2-card');
  // challenges done (simulated) → free shoot
  // SKIP on the tracker moves straight on to the next step
  await page.click('#gdCard [data-gd="next"]'); await waitStep('shoot'); await shot('3-shoot');
  await gdClick('go'); await page.waitForTimeout(300);
  const lenses = ['2470', '50', '85', '135'], fs = [2.8, 8, 16], shs = ['1/500', '1/60', '1/15'], isos = [100, 400, 1600];
  await ev((a) => { for (let i = 0; i < 15; i++) window.__cb.addPhoto({ url: a.frames[i % a.frames.length], f: a.fs[i % 3], sh: a.shs[i % 3], iso: a.isos[i % 3], mm: 50, lens: a.lenses[i % 4], body: 'Full-frame DSLR', place: 'The Stump' }); }, { frames, fs, shs, isos, lenses });
  await waitStep('select'); await shot('4-select');
  await gdClick('go'); await page.waitForTimeout(600);
  ok((await ev(() => window.__cb.studio())).room === 'select', 'the button opens Select');
  ok((await ev(() => window.__co.state())).tour === 'select', 'Select starts its tour');
  await ev(() => window.__co.skip());   // the tours have their own test (tours.mjs)
  await ev(() => { window.__cb.photos.forEach((p, i) => { p.pick = i < 8; }); });
  await waitStep('edit');
  await page.evaluate(() => document.querySelector('#st-select [data-lib-f="all"]').click()); await page.waitForTimeout(300);
  ok(await page.$('#st-select .lib-f.sub'), 'a Picked photos folder appears inside the location');
  await shot('5-edit');
  await gdClick('go'); await page.waitForTimeout(1500);
  ok((await ev(() => window.__cb.studio())).room === 'edit', 'the button opens Edit');
  ok(await page.$$eval('#dvFilm [data-dv]', (n) => n.length) === 8, 'editing just the 8 picks');
  await page.waitForFunction(() => window.__co.state().tour === 'edit', null, { timeout: 60000 }); await ev(() => window.__co.skip());
  await ev(() => { const P = window.__cb.photos; P[0].dev = { exposure: 0.4 }; P[1].dev = { mono: 1 }; P[2].dev = { aspect: '1' }; window.__gd.flag('synced'); });
  await waitStep('workbook'); await shot('6-workbook');
  await gdClick('go'); await page.waitForTimeout(800);
  ok((await ev(() => window.__cb.studio())).room === 'workshop', 'the button opens the workbook');
  // each of these rooms runs its tour (tested in tours.mjs); here, skip each tour and check the guide moves on
  for (const [id, room] of [['folio', 'folio'], ['book', 'book'], ['gallery', 'gallery'], ['yours', 'select']]) {
    await page.waitForFunction(() => window.__co.state().on, null, { timeout: 60000 }); await ev(() => window.__co.skip());
    await waitStep(id); await gdClick('go'); await page.waitForTimeout(800);
    ok((await ev(() => window.__cb.studio())).room === room, 'the button opens ' + room);
  }
  await page.waitForFunction(() => window.__co.state().on, null, { timeout: 60000 }); await ev(() => window.__co.skip());
  await waitStep('done'); await shot('8-done');
  await gdClick('go'); await page.waitForTimeout(500);
  ok((await gd()).step === -1 && !(await page.$('#gdCard.show')), 'finishing turns the guide off');
  // Skip this step on a popup does the same
  await ev(() => window.__gd.set(3)); await waitStep('select');
  await gdClick('next'); await waitStep('edit');
  ok(await page.$('#gdPop.show'), 'the next step pops up after a skip');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  guide (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); try { console.error('STATE', JSON.stringify(await page.evaluate(() => ({ gd: window.__gd && window.__gd.state(), co: window.__co && window.__co.state(), pop: !!document.querySelector('#gdPop.show'), top: (() => { const b = document.querySelector('#gdPop [data-gd]'); if (!b) return null; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e && (e.id || e.className); })() })))); } catch (e2) {} if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; await shot('fail').catch(() => {}); }
finally { await browser.close(); }
