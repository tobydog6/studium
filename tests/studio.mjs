// Studio test: Select (pick, reject, rate, note), Edit (the develop panel inside the studio), Workshop (A3 page),
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
const key = async (k, wait = 120) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
const shot = (n) => page.screenshot({ path: join(OUT, `studio-${n}.png`), timeout: 120000 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.waitForSelector('#tileStudio', { state: 'visible', timeout: 20000 });
  await cb((fs) => fs.forEach((u, i) => window.__cb.addPhoto({ url: u, f: [2.8, 4, 5.6, 8][i % 4], sh: ['1/125', '1/250', '1/60'][i % 3], iso: 400, mm: [24, 50, 85][i % 3], body: 'Full-frame DSLR', place: 'The Stump' })), frames);
  await page.click('#tileStudio'); await page.waitForTimeout(600);
  ok((await cb(() => window.__cb.studio())).room === 'select', 'studio should open on Select');
  ok(await cb(() => window.__cb.state()) === 'studio.select', 'state should be studio.select');

  // pick four, reject one, rate, write a note
  for (const i of [0, 3, 5, 6]) { await page.click(`[data-st-frame="${i}"]`); await key('KeyP'); }
  await page.click('[data-st-frame="2"]'); await key('KeyX'); await key('Digit2');
  await page.click('[data-st-frame="3"]'); await key('Digit4');
  await page.fill('#stWhy', 'The ivy pulls your eye up the stump.'); await page.keyboard.press('Escape');
  const ph = await cb(() => window.__cb.photos.map((p) => [!!p.pick, !!p.reject, p.rating || 0, p.note || '']));
  ok(ph.filter((p) => p[0]).length === 4, 'four picks expected');
  ok(ph[2][1] && ph[2][2] === 2, 'frame 3 should be rejected and rated 2');
  ok(ph[3][2] === 4 && ph[3][3].includes('ivy'), 'frame 4 should be rated 4 with a note');
  await key('ArrowRight'); ok((await cb(() => window.__cb.studio())).cur === 4, 'arrow should move the selection');
  await shot('1-select');

  // Enter opens the develop panel inside the studio; its back button returns to Select
  await key('Enter', 1500);
  ok(await page.$eval('#editor', (e) => !e.classList.contains('hidden')), 'editor should open');
  ok((await cb(() => window.__cb.studio())).room === 'edit', 'room should be edit');
  await shot('2-edit');
  await page.click('#eCancel'); await page.waitForTimeout(400);
  ok((await cb(() => window.__cb.studio())).room === 'select', 'editor back should return to Select');
  ok(await page.$eval('#editor', (e) => e.classList.contains('hidden')), 'editor should hide');

  // Workshop: an A3 page from your picks, a new page, Q/E switching
  await key('KeyE', 300); await key('KeyE', 600);
  ok((await cb(() => window.__cb.studio())).room === 'workshop', 'E twice should reach Workshop');
  ok((await page.$$('.ws-tests img')).length === 4, 'four edit tests expected');
  await page.click('.ws-title'); await page.keyboard.type('What makes it feel alive?'); await page.keyboard.press('Escape');
  await shot('3-workshop');
  await key('KeyN', 300); ok((await cb(() => window.__cb.studio())).pages === 2, 'N should add a page');

  // Folio: A0 portrait, the Stump series in band one, presets, paper, swapping frames
  await key('KeyE', 600);
  ok((await cb(() => window.__cb.studio())).room === 'folio', 'E should reach Folio');
  ok((await page.$$('.fo-band[data-fo-band="0"] .fo-cell')).length === 4, 'band one should hold the four picks');
  ok((await page.$$('.fo-band.empty')).length === 2, 'two empty series bands expected');
  await shot('4-folio');
  await key('KeyL', 300); ok((await cb(() => window.__cb.studio())).presets[0] === 'grid', 'L should cycle the layout');
  await page.click('[data-fo-paper="black"]'); await page.waitForTimeout(200);
  const before = await page.$$eval('.fo-band[data-fo-band="0"] .fo-cell img', (a) => a.map((i) => i.src.slice(-40)));
  await page.click('[data-fo-cell="0:0"]'); await page.click('[data-fo-cell="0:2"]'); await page.waitForTimeout(200);
  const after = await page.$$eval('.fo-band[data-fo-band="0"] .fo-cell img', (a) => a.map((i) => i.src.slice(-40)));
  ok(before[0] === after[2] && before[2] === after[0], 'clicking two frames should swap them');
  await shot('5-folio-black-grid');

    // Book: built from the picks, spread by spread; templates, swaps, a new spread
  await key('KeyE', 800);
  ok((await cb(() => window.__cb.studio())).room === 'book', 'E should reach Book');
  let book = (await cb(() => window.__cb.studio())).book;
  ok(book.pages[0].tpl === 'bleed' && book.pages[0].imgs[0] === 3, 'cover should be the highest-rated pick, full bleed');
  ok(book.pages.length === 12 && book.spread === 1, 'a new book has 12 pages and opens on spread 2–3');
  ok((await page.$$('.bk-pic')).length === 4, 'tray should hold the four picks');
  await key('ArrowRight', 300);
  ok((await page.$$('.bk-page')).length === 2, 'a spread shows two pages');
  const s0 = await page.$eval('.bk-page.l .bk-slot', (e) => e.getAttribute('data-bk-slot'));
  const s1 = await page.$eval('.bk-page.r .bk-slot', (e) => e.getAttribute('data-bk-slot'));
  await page.click(`[data-bk-slot="${s0}"]`); ok(await page.$('.bk-slot.sel .sz'), 'a selected frame shows its size');
  await shot('6-book');
  const pre = (await cb(() => window.__cb.studio())).book.pages;
  await page.click(`[data-bk-slot="${s1}"]`); await page.waitForTimeout(150);
  const post = (await cb(() => window.__cb.studio())).book.pages;
  ok(pre[3].imgs[0] === post[4].imgs[0] && pre[4].imgs[0] === post[3].imgs[0], 'clicking two frames should swap them');
  const order = ['blank', 'bleed', 'centre', 'two', 'grid'], f0 = post[(await cb(() => window.__cb.studio())).book.focus].tpl;
  await key('KeyT'); const b1 = (await cb(() => window.__cb.studio())).book;
  ok(b1.pages[b1.focus].tpl === order[(order.indexOf(f0) + 1) % 5], `T should cycle the focused page template (${f0} -> ${b1.pages[b1.focus].tpl})`);
  await page.click('[data-bk-act="add"]'); ok((await cb(() => window.__cb.studio())).book.pages.length === 14, '+ should add a spread');
  await page.click('[data-bk-size="21x21"]'); ok((await cb(() => window.__cb.studio())).book.size === '21x21', 'size chip should change the book size');

  // Gallery: the picks hang on the rendered wall at true size; click resizes, F frames, arrows space
  await key('KeyE', 900);
  ok((await cb(() => window.__cb.studio())).room === 'gallery', 'E from Book should reach Gallery');
  ok((await page.$$('.ga-print')).length === 4, 'four picks should hang');
  const w0 = await page.$eval('.ga-print[data-ga-print="0"]', (e) => e.offsetWidth);
  await page.click('.ga-print[data-ga-print="0"]'); await page.waitForTimeout(200);
  ok((await page.$eval('.ga-print[data-ga-print="0"]', (e) => e.offsetWidth)) > w0, 'clicking a print should size it up');
  await key('KeyF'); ok(await page.$eval('[data-ga-frame="oak"]', (e) => e.classList.contains('on')), 'F should cycle the frame');
  await key('ArrowRight'); const gv = await page.textContent('#st-gallery .ga-gapv'); ok(gv.startsWith('300'), 'right arrow should widen the spacing: ' + gv);
  await page.click('.ga-t'); await page.keyboard.type('Stump Light'); await page.keyboard.press('Enter');
  await shot('7-gallery');
  await key('KeyQ', 600); ok((await cb(() => window.__cb.studio())).room === 'book', 'Q should return to Book');
  await key('Escape', 400); ok((await cb(() => window.__cb.studio())).room === 'select', 'Esc should return to Select');
  await key('Escape', 400);
  ok(await cb(() => window.__cb.state()) === 'hub', 'Esc from Select should leave the studio (to the hub, with no location loaded)');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  studio (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; }
finally { await browser.close(); }
