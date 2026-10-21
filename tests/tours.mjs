// Tours test: in the demo, the Select tour (any photo, Pick, Reject, choose 5) and the Edit tour (every slider to a gold
// mark, grading, the crop tool, before/after, then your own edit, copy, paste and the rest), with real clicks and drags.
// Then Workbook, Folio, the Book, the Gallery and a folder of their own, to the end of the demo.
// Usage: node tests/tours.mjs [path/to/studium.html]
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
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_detail', 'test'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const gdClick = async (k) => { const sel = '#gdPop [data-gd="' + k + '"]'; await page.waitForFunction((s) => { const b = document.querySelector(s); return b && !b.disabled; }, sel, { timeout: 120000, polling: 200 }); await page.$eval(sel, (b) => b.click()); };   // the popup sits over a 1 fps scene here, so click it directly once it unlocks
const ev = (f, a) => page.evaluate(f, a);
const co = () => ev(() => window.__co.state());
const shot = (n) => page.screenshot({ path: join(OUT, `tours-${n}.png`), timeout: 240000 });
const waitStep = (id) => page.waitForFunction((x) => window.__gd.state().id === x && window.__gd.state().open, id, { timeout: 300000, polling: 300 });
const at = (tour, i) => page.waitForFunction(([t, k]) => { const s = window.__co.state(); return s.tour === t && s.i === k && s.shown; }, [tour, i], { timeout: 90000, polling: 200 })
  .catch(async () => { throw new Error(`${tour} tour didn't reach step ${i + 1}: ` + JSON.stringify(await co())); });
const gotIt = () => page.click('#coCard [data-co-next]');
const slide = (id, v) => ev(([i, val]) => { const e = document.getElementById(i); e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const drag = async (sel, fx, fy) => { const b = await (await page.$(sel)).boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy, { steps: 5 }); await page.mouse.up(); };
// Research reads Punctum's packs from Supabase: answer those calls with a test pack, and keep what gets written back
const posted = [];
await page.route('https://xddjfwoppmuhyagkhalk.supabase.co/rest/v1/**', async (route) => { const req = route.request(), u = req.url();
  if (req.method() === 'POST') { posted.push({ table: u.split('/rest/v1/')[1].split('?')[0], rows: JSON.parse(req.postData() || '[]') }); return route.fulfill({ status: 201, body: '' }); }
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (u.includes('/packs?')) return json([{ id: 7, name: 'Test photographer', links: 'Tate profile: https://www.tate.org.uk/art/artists/test', type: 'punctum' }]);
  if (u.includes('/images?')) return json(frames.slice(0, 4).map((f, i) => ({ id: 70 + i, pack_id: 7, url: f, position: i })));
  if (u.includes('/responses?')) return json([{ image_id: 71, struck: true }, { image_id: 71, struck: false }, { image_id: 70, struck: false }]);
  return json([]); });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&quick');
  await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 60000 });
  await page.click('#signin [data-si="demo"]');
  await waitStep('basics'); await gdClick('next');
  await waitStep('challenges'); await gdClick('next');
  await waitStep('shoot'); await gdClick('go'); await page.waitForTimeout(300);
  await ev((fr) => { const L = ['2470', '85'], F = [11, 1.8]; for (let i = 0; i < 6; i++) window.__cb.addPhoto({ url: fr[i % fr.length], f: F[i % 2], sh: '1/250', iso: 400, mm: 50, lens: L[i % 2], body: 'Full-frame DSLR', place: 'The Stump' }); }, frames);

  // ---- Select: any photo, Pick, Reject, then five ----
  await waitStep('select'); await gdClick('go');
  await at('select', 0); await page.waitForTimeout(400); await shot('1-select');
  ok(await page.$('#coRing.show'), 'the light table is lit up');
  ok(/five frames/.test(await page.$eval('#st-select .st-loupe', (e) => e.textContent)), 'the loupe asks for five, matching the demo');
  await gotIt(); await at('select', 1);
  await page.click('#st-select [data-st-frame="3"]'); await at('select', 2);   // any photo, not just a lit one
  await page.click('#st-select [data-st-act="pick"]'); await at('select', 3); await shot('2-reject');
  const nph = await ev(() => window.__cb.photos.length);
  await page.click(`#st-select [data-st-frame="${nph - 1}"]`); await page.click('#st-select [data-st-act="reject"]'); await at('select', 4);
  ok(await page.waitForSelector('#coRing.nodim', { timeout: 15000 }).catch(() => null), 'picking your five keeps the screen bright');
  for (let i = 0; i < nph - 1 && (await ev(() => window.__cb.photos.filter((p) => p.pick).length)) < 5; i++) {
    if (await ev((k) => window.__cb.photos[k].pick, i)) continue; await page.click(`#st-select [data-st-frame="${i}"]`); await page.click('#st-select [data-st-act="pick"]'); }
  ok((await ev(() => window.__cb.photos.filter((p) => p.pick).length)) === 5, 'five picked');

  // ---- Edit: every slider to its gold mark on one photo, grade, crop, before/after, then your own edit, copy, paste, the rest ----
  await waitStep('edit'); await gdClick('go');
  await at('edit', 0); await page.waitForTimeout(600); await shot('3-light');
  ok(await page.$$eval('#dvFilm [data-dv]', (n) => n.length) === 5, 'editing just the five picks');
  await gotIt(); await at('edit', 1);
  await page.waitForSelector('.co-mark'); ok(await page.waitForSelector('#coRing.nodim', { timeout: 15000 }).catch(() => null), 'the photo stays bright while you edit');
  await slide('pExposure', 40); await page.waitForTimeout(1200); ok((await co()).i === 1, 'off the mark, it waits');
  const marks = [['pExposure', 15], ['pContrast', 20], ['pHighlights', -60], ['pShadows', 45], ['pWhites', 15], ['pBlacks', -25], ['pTemp', 12], ['pVibrance', 25], ['pClarity', 20], ['pVignette', -25]];
  for (let k = 0; k < marks.length; k++) { await at('edit', 1 + k); await slide(marks[k][0], marks[k][1]); if (k === 3) await shot('4-mark'); }
  await at('edit', 11); await page.waitForTimeout(500); await shot('5-grade');
  await gotIt(); await at('edit', 12);
  await drag('#lrGrade .cg-disc[data-cg="gSh"]', 0.5, 0.95); await at('edit', 13);
  await drag('#lrGrade .cg-disc[data-cg="gHi"]', 0.85, 0.35); await at('edit', 14);
  await page.click('#eCrop'); await at('edit', 15);
  await page.click('#editor .lr-ct[data-a="0.8"]'); await at('edit', 16);
  { const h = await (await page.$('#cropUI [data-crop-h="se"]')).boundingBox(); await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down(); await page.mouse.move(h.x - 60, h.y - 80, { steps: 6 }); await page.mouse.up(); }
  await at('edit', 17); await shot('6-crop');
  await page.click('#eCropApply'); await at('edit', 18);
  await page.click('#eBefore'); await page.waitForTimeout(300); await page.click('#eBefore'); await at('edit', 19);
  const own = await ev(() => window.__co.state().ed); await page.waitForTimeout(300);
  await gotIt(); await at('edit', 20);
  await slide('pExposure', -20); await slide('pSaturation', -100); await slide('pContrast', 40);
  await page.click('#dvCopy'); await at('edit', 21);
  await page.click('#dvNext'); await at('edit', 22);
  await page.click('#dvPaste'); await at('edit', 23);
  for (const v of await page.$$eval('#dvFilm [data-dv]', (n) => n.map((e) => e.getAttribute('data-dv')))) {
    if (!(await ev(() => window.__co.state().i === 23))) break;
    await page.$eval(`#dvFilm [data-dv="${v}"]`, (e) => e.click()); await page.waitForTimeout(900); await slide('pShadows', 30); await page.waitForTimeout(300); }
  await at('edit', 24);
  await page.click('#eSave');
  await waitStep('workbook');
  const devs = await ev(() => window.__cb.photos.filter((p) => p.pick).map((p) => p.dev && { e: p.dev.exposure, s: p.dev.saturation, a: p.dev.aspect }));
  ok(devs.every((d) => d), 'all five picks are edited: ' + JSON.stringify(devs));
  ok(devs.filter((d) => d.s === -100).length >= 2, 'your look was copied onto the next photo: ' + JSON.stringify(devs));

  // ---- Workbook: Rank, five photos, a reason for each, save ----
  await gdClick('go'); await at('workbook', 0); await page.waitForTimeout(400); await shot('7-workbook');
  await gotIt(); await at('workbook', 1);
  await page.click('#st-workshop [data-bd-tmpl="0"]'); await at('workbook', 2);
  const npics = await page.$$eval('#st-workshop .lib-grid [data-bd-pic]', (n) => n.length);
  for (let k = 0; k < 5; k++) { await page.dragAndDrop(`#st-workshop .lib-grid [data-bd-pic] >> nth=${k % npics}`, '#st-workshop .bd-it.sl'); await page.waitForTimeout(300); }
  await at('workbook', 3); await shot('8-rank');
  for (let k = 0; k < 5; k++) { await page.waitForSelector('#st-workshop .bd-it.tx.co-target'); await page.click('#st-workshop .bd-it.tx.co-target'); await page.waitForTimeout(250);
    await page.keyboard.type('Reason number ' + (5 - k) + ' for this one.'); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  await at('workbook', 4);
  await page.click('#st-workshop [data-bd-act="save"]');

  // ---- Folio: zoom into a third, five photos (repeats allowed), swap, arrange, shuffle, back out ----
  await waitStep('folio'); await gdClick('go'); await at('folio', 0); await page.waitForTimeout(400); await shot('8-folio');
  ok(!(await page.$('#st-folio [data-bd-panels]')) && !(await page.$('#st-folio [data-bd-tpl]')) && !(await page.$('#st-folio [data-bd-split]')), 'no whole-board fills, panel counts or section splits');
  await gotIt(); await at('folio', 1);
  await page.waitForSelector('#st-folio [data-bd-zoom="0"].co-target'); await page.click('#st-folio [data-bd-zoom="0"]'); await at('folio', 2);
  await page.click('#st-folio .lib-grid [data-bd-pic="0"]'); await at('folio', 3);
  for (const i of [1, 2, 0, 1]) { await page.click(`#st-folio .lib-grid [data-bd-pic="${i}"]`); await page.waitForTimeout(150); }
  await at('folio', 4);
  const sec = await ev(() => window.__cb.studio().fo.pages[0].filter((i) => i.sec === '0.0').map((i) => i.pid));
  ok(sec.length === 5 && new Set(sec).size === 3, 'five frames in the top third, repeats allowed: ' + JSON.stringify(sec));
  const ph = await page.$$('#st-folio .bd-it.ph'); const b0 = await ph[0].boundingBox(), b2 = await ph[2].boundingBox();
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2); await page.mouse.down(); await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 8 }); await page.mouse.up();
  await at('folio', 5); await shot('9-arrange');
  await page.click('#st-folio .bd-sheet .bd-szb', { force: true }); await at('folio', 6);
  ok((await ev(() => window.__cb.fill()))['0.0'] === 1, 'the third stays filled edge to edge');
  await page.click('#st-folio [data-bd-style="rows"]'); await at('folio', 7);
  await page.click('#st-folio [data-bd-shuffle]'); await at('folio', 8);
  await page.click('#st-folio [data-bd-zoom="-1"]');

  // ---- Book, Gallery: a quick look ----
  await waitStep('book'); await gdClick('go'); await at('book', 0); await page.waitForTimeout(500); await shot('10-book');
  await gotIt(); await at('book', 1); await page.click('#st-book [data-bk-tpl="two"]'); await at('book', 2); await gotIt();
  await waitStep('gallery'); await gdClick('go'); await at('gallery', 0); await page.waitForTimeout(500); await shot('11-gallery');
  await gotIt(); await at('gallery', 1);
  const n0 = await page.$$eval('#st-gallery .ga-print', (n) => n.length);
  await page.click('#st-gallery .ga-lib .lib-grid [data-bd-pic]:not(:has(.in))'); await at('gallery', 2);
  ok((await page.$$eval('#st-gallery .ga-print', (n) => n.length)) === n0 + 1, 'clicking a library photo hangs it');
  await page.click('#st-gallery .ga-x', { force: true }); await at('gallery', 3);
  ok((await page.$$eval('#st-gallery .ga-print', (n) => n.length)) === n0, 'the × takes it down');
  await page.click('#st-gallery [data-ga-frame="oak"]'); await at('gallery', 4);
  await page.click('#st-gallery [data-ga-label="plaque"]'); await at('gallery', 5);
  ok(await page.$('#st-gallery .ga-label.plaque'), 'the title card takes the style');
  await gotIt();

  // ---- Research: a Punctum round on a pack, a detail tapped and written about, into the workbook ----
  await waitStep('research'); await gdClick('go'); await at('research', 0); await page.waitForTimeout(500); await shot('12a-research');
  ok(await page.$('#st-research .rs-pack'), 'the packs come from Supabase');
  ok(/Test photographer/.test(await page.$eval('#st-research', (e) => e.textContent)), 'the pack is named');
  await gotIt(); await at('research', 1);
  await page.click('#st-research [data-rs-act="round"]'); await at('research', 2);
  await page.click('#st-research [data-rs-act="no"]'); await page.waitForTimeout(200);
  await page.click('#st-research [data-rs-act="yes"]'); await at('research', 3);
  { const w = await (await page.$('#st-research .rs-stage .rs-imgw')).boundingBox(); await page.mouse.click(w.x + w.width * 0.4, w.y + w.height * 0.6); }
  await at('research', 4); await shot('12b-punctum');
  await page.fill('#st-research [data-rs-note="note"]', 'The bright ivy leaf on the dark stump.'); await at('research', 5);
  await page.click('#st-research [data-rs-act="next"]');
  while (await ev(() => window.__rs.state().view === 'round')) { await page.click('#st-research [data-rs-act="no"]'); await page.waitForTimeout(150); }
  await at('research', 6); await page.waitForTimeout(300); await shot('12c-results');
  ok(/1 of 2 caught/.test(await page.$eval('#st-research .rs-res', (e) => e.textContent)), 'the class numbers come back');
  ok(posted.some((p) => p.table === 'responses' && p.rows.length === 4) && posted.some((p) => p.table === 'punctum_picks' && /ivy leaf/.test(p.rows[0].note)), 'the round is saved to Punctum: ' + JSON.stringify(posted.map((p) => p.table)));
  await page.click('#st-research .rs-wb');
  await page.waitForFunction(() => window.__cb.studio().room === 'workshop', null, { timeout: 20000 });
  const art = await ev(() => window.__cb.studio().ws.pages.slice(-1)[0]);
  ok(art.some((i) => i.t === 'photo') && art.some((i) => i.t === 'line') && art.some((i) => /ivy leaf/.test(i.text || '')), 'an Artist model page with the photo, an arrow and the answer: ' + JSON.stringify(art.map((i) => i.t)));
  await page.waitForTimeout(500); await shot('12d-artist-page');

  // ---- A folder of their own ----
  await waitStep('yours'); await gdClick('go'); await at('library', 0);
  await page.click('#st-select [data-lib-new]'); await at('library', 1);
  await page.keyboard.type('My own shoot'); await page.keyboard.press('Enter'); await at('library', 2); await page.waitForTimeout(400); await shot('12-folder');
  await gotIt();
  await waitStep('done');
  ok(await page.$('#gdPop [data-gd="shootown"]'), 'the end offers to go and shoot');
  ok((await ev(() => window.__cb.projects())).some((p) => p.name === 'My own shoot'), 'their folder is made');
  await shot('13-done');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  tours (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); try { console.error('STATE', JSON.stringify(await page.evaluate(() => ({ gd: window.__gd && window.__gd.state(), co: window.__co && window.__co.state(), pop: !!document.querySelector('#gdPop.show'), top: (() => { const b = document.querySelector('#gdPop [data-gd]'); if (!b) return null; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e && (e.id || e.className); })() })))); } catch (e2) {} if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; await shot('fail').catch(() => {}); }
finally { await browser.close(); }
