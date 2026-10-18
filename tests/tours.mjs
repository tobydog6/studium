// Tours test: in the demo, the Select tour (look, Pick, Reject, choose 3) and the Edit tour across the three picks
// (Light sliders, black and white by hand, a crop and the Color Grading wheels), driven with real clicks and drags.
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
const ev = (f, a) => page.evaluate(f, a);
const co = () => ev(() => window.__co.state());
const shot = (n) => page.screenshot({ path: join(OUT, `tours-${n}.png`), timeout: 240000 });
const waitStep = (id) => page.waitForFunction((x) => window.__gd.state().id === x && window.__gd.state().open, id, { timeout: 300000, polling: 300 });
const at = (tour, i) => page.waitForFunction(([t, k]) => { const s = window.__co.state(); return s.tour === t && s.i === k && s.shown; }, [tour, i], { timeout: 90000, polling: 200 })
  .catch(async () => { throw new Error(`${tour} tour didn't reach step ${i + 1}: ` + JSON.stringify(await co())); });
const gotIt = () => page.click('#coCard [data-co-next]');
const slide = (id, v) => ev(([i, val]) => { const e = document.getElementById(i); e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const drag = async (sel, fx, fy) => { const b = await (await page.$(sel)).boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy, { steps: 5 }); await page.mouse.up(); };
try {
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 60000 });
  await page.click('#signin [data-si="demo"]');
  await waitStep('basics'); await page.click('#gdPop [data-gd="next"]');
  await waitStep('challenges'); await page.click('#gdPop [data-gd="next"]');
  await waitStep('shoot'); await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(300);
  await ev((fr) => { const L = ['2470', '85'], F = [11, 1.8]; for (let i = 0; i < 6; i++) window.__cb.addPhoto({ url: fr[i % fr.length], f: F[i % 2], sh: '1/250', iso: 400, mm: 50, lens: L[i % 2], body: 'Full-frame DSLR', place: 'The Stump' }); }, frames);

  // ---- Select ----
  await waitStep('select'); await page.click('#gdPop [data-gd="go"]');
  await at('select', 0); await page.waitForTimeout(400); await shot('1-select');
  ok(await page.$('#coRing.show'), 'the light table is lit up');
  ok(/three frames/.test(await page.$eval('#st-select .st-loupe', (e) => e.textContent)), 'the loupe asks for three, matching the demo');
  await gotIt(); await at('select', 1);
  await page.click('#st-select .st-cell:not(.cur)'); await at('select', 2);
  await page.click('#st-select [data-st-act="pick"]'); await at('select', 3); await shot('2-reject');
  const picked = await ev(() => window.__cb.photos.findIndex((p) => p.pick));
  const rej = picked === 5 ? 4 : 5; await page.click(`#st-select [data-st-frame="${rej}"]`); await page.click('#st-select [data-st-act="reject"]'); await at('select', 4);
  for (const i of [0, 1, 2, 3].filter((k) => k !== picked).slice(0, 2)) { await page.click(`#st-select [data-st-frame="${i}"]`); await page.click('#st-select [data-st-act="pick"]'); }
  ok((await ev(() => window.__cb.photos.filter((p) => p.pick).length)) === 3, 'three picked');

  // ---- Edit ----
  await waitStep('edit'); await page.click('#gdPop [data-gd="go"]');
  await at('edit', 0); await page.waitForTimeout(600); await shot('3-light');
  ok(await page.$$eval('#dvFilm [data-dv]', (n) => n.length) === 3, 'editing just the three picks');
  await gotIt(); await at('edit', 1);
  await slide('pExposure', 20); await at('edit', 2);
  await slide('pHighlights', -60); await at('edit', 3);
  await slide('pShadows', 40); await at('edit', 4);
  await page.click('#editStage'); await page.keyboard.press('Backslash'); await page.keyboard.press('Backslash'); await at('edit', 5);
  await page.click('#dvNext'); await at('edit', 6); await page.waitForTimeout(500); await shot('4-bw');
  await slide('pSaturation', -100); await at('edit', 7);
  await slide('pContrast', 35); await at('edit', 8);
  await slide('pBlacks', -25); await at('edit', 9);
  await page.click('#dvNext');
  await at('edit', 10);
  await page.click('#editor .lr-ct[data-a="1"]');
  await at('edit', 11);
  await drag('#editCanvas', 0.3, 0.5); await at('edit', 12); await page.waitForTimeout(700); await shot('5-grade');
  await gotIt(); await at('edit', 13);
  await drag('#lrGrade .cg-disc[data-cg="gSh"]', 0.5, 0.95); await at('edit', 14);
  await drag('#lrGrade .cg-disc[data-cg="gHi"]', 0.85, 0.35); await at('edit', 15);
  await page.click('#eSave');
  await waitStep('workbook');
  const devs = await ev(() => window.__cb.photos.filter((p) => p.pick).map((p) => p.dev && { e: p.dev.exposure, s: p.dev.saturation, a: p.dev.aspect, g: p.dev.gShS }));
  ok(devs[0] && devs[0].e === 20 && devs[1] && devs[1].s === -100 && devs[2] && devs[2].a === '1' && devs[2].g >= 10, 'each photo keeps its lesson: ' + JSON.stringify(devs));

  // ---- Workbook: Compare, two photos, an arrow on a detail, a caption, save ----
  await page.click('#gdPop [data-gd="go"]'); await at('workbook', 0); await page.waitForTimeout(400); await shot('6-workbook');
  await gotIt(); await at('workbook', 1);
  await page.click('#st-workshop [data-bd-tmpl="0"]'); await at('workbook', 2);
  ok(await ev(() => window.__cb.studio().ws.pages.slice(-1)[0].filter((i) => i.t === 'photo').length === 0), 'Compare leaves its photo spaces for you to fill');
  await page.dragAndDrop('#st-workshop .lib-grid [data-bd-pic="0"]', '#st-workshop .bd-it.sl'); await at('workbook', 3);
  await page.dragAndDrop('#st-workshop .lib-grid [data-bd-pic="1"]', '#st-workshop .bd-it.sl'); await at('workbook', 4);
  await page.click('#st-workshop .bd-tools [data-bd-act="arrow"]'); await at('workbook', 5); await page.waitForTimeout(300);
  const pa = await (await page.$('#st-workshop .bd-it.ph')).boundingBox(), hb = await (await page.$('#st-workshop [data-bd-h="b"]')).boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await page.mouse.move(pa.x + pa.width * 0.4, pa.y + pa.height * 0.5, { steps: 6 }); await page.mouse.up();
  await at('workbook', 6); await page.waitForTimeout(300); await shot('7-caption');
  await page.waitForSelector('#st-workshop .bd-it.tx.co-target'); await page.click('#st-workshop .bd-it.tx.co-target'); await page.waitForTimeout(300);
  await page.keyboard.type('The ivy leads your eye up the stump.'); await page.keyboard.press('Escape'); await at('workbook', 7);
  await page.click('#st-workshop [data-bd-act="save"]');

  // ---- Folio: zoom into a third, five photos (repeats allowed), swap, arrange, shuffle, back out ----
  await waitStep('folio'); await page.click('#gdPop [data-gd="go"]'); await at('folio', 0); await page.waitForTimeout(400); await shot('8-folio');
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
  await page.click('#st-folio [data-bd-style="rows"]'); await at('folio', 6);
  await page.click('#st-folio [data-bd-shuffle]'); await at('folio', 7);
  await page.click('#st-folio [data-bd-zoom="-1"]');

  // ---- Book, Gallery: a quick look ----
  await waitStep('book'); await page.click('#gdPop [data-gd="go"]'); await at('book', 0); await page.waitForTimeout(500); await shot('10-book');
  await gotIt(); await at('book', 1); await page.click('#st-book [data-bk-tpl="two"]'); await at('book', 2); await gotIt();
  await waitStep('gallery'); await page.click('#gdPop [data-gd="go"]'); await at('gallery', 0); await page.waitForTimeout(500); await shot('11-gallery');
  await gotIt(); await at('gallery', 1); await page.click('#st-gallery [data-ga-frame="oak"]'); await at('gallery', 2); await gotIt();

  // ---- A folder of their own ----
  await waitStep('yours'); await page.click('#gdPop [data-gd="go"]'); await at('library', 0);
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
