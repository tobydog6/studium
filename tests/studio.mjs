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

  // Workshop: a free A3 page. Starts blank; frames keep their shape; text, layers, layouts, pages, undo
  await key('KeyE', 300); await key('KeyE', 600);
  ok((await cb(() => window.__cb.studio())).room === 'workshop', 'E twice should reach Workshop');
  ok(await page.$('#st-workshop .bd-empty'), 'a new workshop page starts blank');
  await page.click('#st-workshop [data-bd-pic="0"]'); await page.waitForTimeout(300);
  await page.dragAndDrop('#st-workshop [data-bd-pic="7"]', '#st-workshop .bd-sheet', { targetPosition: { x: 520, y: 120 } }); await page.waitForTimeout(400);
  let ws = (await cb(() => window.__cb.studio())).ws;
  ok(ws.pages[0].length === 2, 'click and drag should both put frames on the page: ' + ws.pages[0].length);
  ok(Math.abs(ws.pages[0][0].w / ws.pages[0][0].h - 1.5) < 0.03, 'a 3:2 frame stays 3:2');
  ok(Math.abs(ws.pages[0][1].w / ws.pages[0][1].h - 0.667) < 0.03, 'a portrait frame stays 2:3: ' + JSON.stringify(ws.pages[0][1]));
  await page.click('#st-workshop [data-bd-tpl="1"]'); await page.waitForTimeout(300);   // Hero layout
  ws = (await cb(() => window.__cb.studio())).ws; ok(ws.pages[0][0].w > 150, 'Hero layout should make the first frame big');
  // drag the first frame 60 px right, then pull its corner out: it grows and keeps 3:2
  const it0 = await (await page.$('#st-workshop .bd-it[data-bd="0"]')).boundingBox();
  await page.mouse.move(it0.x + it0.width / 2, it0.y + it0.height / 2); await page.mouse.down(); await page.mouse.move(it0.x + it0.width / 2 - 60, it0.y + it0.height / 2 + 10, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
  const moved = (await cb(() => window.__cb.studio())).ws.pages[0][0];
  ok(moved.x !== ws.pages[0][0].x, 'dragging should move the frame');
  const se = await (await page.$('#st-workshop .bd-it[data-bd="0"] [data-bd-h="se"]')).boundingBox();
  await page.mouse.move(se.x + 4, se.y + 4); await page.mouse.down(); await page.mouse.move(se.x - 80, se.y - 40, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
  const sized = (await cb(() => window.__cb.studio())).ws.pages[0][0];
  ok(sized.w < moved.w && Math.abs(sized.w / sized.h - 1.5) < 0.03, 'corner resize keeps the shape: ' + JSON.stringify(sized));
  // text
  await page.click('#st-workshop [data-bd-act="text"]'); await page.waitForTimeout(250);
  await page.keyboard.type('What makes it feel alive?'); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  ws = (await cb(() => window.__cb.studio())).ws;
  ok(ws.pages[0].some((i) => i.t === 'text' && /alive/.test(i.text)), 'text box should keep what you typed');
  // layers: hide the portrait frame, then undo
  await page.click('#st-workshop [data-bd-eye="1"]'); await page.waitForTimeout(150);
  ok((await cb(() => window.__cb.studio())).ws.pages[0][1].hidden, 'eye should hide a layer');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(150);
  ok(!(await cb(() => window.__cb.studio())).ws.pages[0][1].hidden, 'undo should bring it back');
  await page.click('#st-workshop [data-bd="0"]', { position: { x: 10, y: 10 } }); await page.waitForTimeout(150);
  await page.click('#st-workshop [data-bd-f="bw"]'); await page.waitForTimeout(150);
  await shot('3-workshop');
  await page.click('#st-workshop [data-bd-act="dup"]'); await page.waitForTimeout(200);
  ok((await cb(() => window.__cb.studio())).ws.pages.length === 2, 'COPY should make a second version of the page');

  // Folio: one A0 panel, no text; Series lays out each location as a band, every frame at its own shape
  await key('KeyE', 600);
  ok((await cb(() => window.__cb.studio())).room === 'folio', 'E should reach Folio');
  ok(!(await page.$('#st-folio [data-bd-act="text"]')), 'the folio has no text tool');
  await page.click('#st-folio [data-bd-tpl="0"]'); await page.waitForTimeout(400);
  let fo = (await cb(() => window.__cb.studio())).fo;
  ok(fo.pages[0].length === 4, 'Series should place the four picks: ' + fo.pages[0].length);
  ok(fo.pages[0].every((i) => Math.abs(i.w / i.h - 1.5) < 0.03), 'folio frames keep their shape');
  await page.click('#st-folio [data-bd-paper="black"]'); await page.waitForTimeout(150);
  await page.click('#st-folio [data-bd-tpl="2"]'); await page.waitForTimeout(300);
  await shot('5-folio');
  ok((await cb(() => window.__cb.studio())).fo.paper === 'black', 'paper should be black');

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
