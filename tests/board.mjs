// Board test: workbook page templates (prompted text you can click straight into, photo spaces, arrows, page colour),
// the tool rail, and the folio as A1 panels side by side.
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
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const cb = (f, a) => page.evaluate(f, a);
const key = async (k, wait = 150) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
const shot = (n) => page.screenshot({ path: join(OUT, `board-${n}.png`), timeout: 240000 });
const ws = async () => (await cb(() => window.__cb.studio())).ws;
try {
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.waitForSelector('#tileStudio', { state: 'visible', timeout: 20000 });
  await cb((fs) => fs.concat(fs).forEach((u, i) => window.__cb.addPhoto({ url: u, f: 5.6, sh: '1/125', iso: 400, mm: 50, body: 'Full-frame DSLR', place: 'The Stump' })), frames);
  await page.click('#tileStudio'); await page.waitForTimeout(600);
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) { await page.click(`[data-st-frame="${i}"]`); await key('KeyP', 60); }
  await key('KeyE', 300); await key('KeyE', 600);
  ok((await cb(() => window.__cb.studio())).room === 'workshop', 'should reach Workshop');
  ok(await page.$('#st-workshop .bd-tools [data-bd-act="arrow"]'), 'the tool rail should offer arrows');
  // template 0: photo + prompted notes, on the blank first page
  await page.click('#st-workshop [data-bd-tmpl="0"]'); await page.waitForTimeout(400);
  let w = await ws(); ok(w.pages.length === 1, 'a template on a blank page should use that page');
  ok(w.pages[0].some((i) => i.t === 'photo') && w.pages[0].some((i) => i.t === 'text') && w.pages[0].some((i) => i.t === 'line'), 'template should place a photo, text and an arrow: ' + JSON.stringify(w.pages[0].map((i) => i.t)));
  await shot('1-template');
  // one click into a prompted text box and type
  const tx = await page.$$('#st-workshop .bd-it.tx'); const bx = await tx[1].boundingBox();
  await page.mouse.click(bx.x + 30, bx.y + bx.height / 2); await page.waitForTimeout(300);
  ok(await page.$('#st-workshop .bd-tx[contenteditable]'), 'one click on an empty prompted box should start typing');
  await page.keyboard.type('Shot at f/8 from low down.'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  w = await ws(); ok(w.pages[0].some((i) => i.t === 'text' && /f\/8/.test(i.text || '')), 'typed text should save');
  // click it again (select), then click again (edit)
  await page.mouse.click(bx.x + 20, bx.y + bx.height / 2); await page.waitForTimeout(250); await page.mouse.click(bx.x + 20, bx.y + bx.height / 2); await page.waitForTimeout(300);
  ok(await page.$('#st-workshop .bd-tx[contenteditable]'), 'clicking a selected text box should go back into typing');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // the rail: add an arrow and pull its end
  await page.click('#st-workshop .bd-tools [data-bd-act="arrow"]'); await page.waitForTimeout(300);
  const before = (await ws()).pages[0].filter((i) => i.t === 'line').length;
  ok(before === 2, 'arrow from the rail should be added');
  const hb = await (await page.$('#st-workshop [data-bd-h="b"]')).boundingBox();
  await page.mouse.move(hb.x + 5, hb.y + 5); await page.mouse.down(); await page.mouse.move(hb.x + 80, hb.y + 40, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(250);
  // page colour
  await page.click('#st-workshop [data-bd-bg="black"]'); await page.waitForTimeout(250);
  ok(await page.$eval('#st-workshop .bd-sheet', (e) => e.classList.contains('black')), 'page colour should change');
  await shot('2-tools');
  // every other template adds a page
  for (let t = 1; t < 7; t++) { await page.click(`#st-workshop [data-bd-tmpl="${t}"]`); await page.waitForTimeout(400); await shot('3-tmpl-' + t); }
  w = await ws(); ok(w.pages.length === 7, 'each template should add a page: ' + w.pages.length);
  // Library: folders, a project from selected frames, add by dragging, edit the group
  ok(await page.$('#st-workshop .lib-f[data-lib-f="place:The Stump"]'), 'a folder per location');
  await page.click('#st-workshop [data-lib-f="picks"]'); await page.waitForTimeout(200);
  await page.click('#st-workshop .lib-grid [data-bd-pic="0"]', { modifiers: ['Control'] }); await page.click('#st-workshop .lib-grid [data-bd-pic="1"]', { modifiers: ['Control'] }); await page.waitForTimeout(200);
  await page.click('#st-workshop [data-lib-new]'); await page.waitForTimeout(200);
  await page.keyboard.type('Ivy series'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  let proj = await cb(() => window.__cb.projects());
  ok(proj.length === 1 && proj[0].name === 'Ivy series' && proj[0].n === 2, 'project from two selected frames: ' + JSON.stringify(proj));
  await page.click('#st-workshop [data-lib-f="all"]'); await page.waitForTimeout(200);
  await page.dragAndDrop('#st-workshop .lib-grid [data-bd-pic="5"]', '#st-workshop .lib-f.proj'); await page.waitForTimeout(300);
  proj = await cb(() => window.__cb.projects()); ok(proj[0].n === 3, 'dragging a frame onto a project adds it');
  await shot('7-library');
  // Folio: A1 panels, each split into sections that pack themselves edge to edge
  await key('KeyE', 700);
  ok((await cb(() => window.__cb.studio())).room === 'folio', 'should reach Folio');
  await page.click('#st-folio [data-bd-tpl="0"]'); await page.waitForTimeout(800);
  let fo = (await cb(() => window.__cb.studio())).fo;
  ok(fo.pages[0].length >= 12, 'folio should take the picks: ' + fo.pages[0].length);
  ok(Math.max(...fo.pages[0].map((i) => i.x)) > 1188, 'frames should reach the third panel');
  ok(fo.pages[0].every((i) => Math.floor(i.x / 594) === Math.floor((i.x + i.w - 0.5) / 594)), 'no frame should straddle two panels');
  const fills = await cb(() => window.__cb.fill());
  ok(Object.values(fills).every((f) => f > 0.6), 'every section should be well filled: ' + JSON.stringify(fills));
  await shot('4-folio');
  // zoom into a section, change how it packs, and split the panel differently
  await page.hover('#st-folio .bd-sheet'); await page.click('#st-folio [data-bd-zoom="1"]'); await page.waitForTimeout(400);
  ok(await page.$('#st-folio .bd-zbar b'), 'zoomed into a section');
  await page.click('#st-folio [data-bd-style="cols"]'); await page.waitForTimeout(400); await shot('5-folio-zoom');
  await page.click('#st-folio [data-bd-split="top"]'); await page.waitForTimeout(400);
  fo = (await cb(() => window.__cb.studio())).fo;
  ok(fo.pages[0].every((i) => Math.floor(i.x / 594) === Math.floor((i.x + i.w - 0.5) / 594)), 'still inside panels after a re-split');
  await shot('6-folio-split');
  // a fresh layout: drag the whole project folder into an empty section
  await page.click('#st-folio [data-bd-act="newpage"]'); await page.waitForTimeout(300);
  await page.dragAndDrop('#st-folio .lib-f.proj', '#st-folio .bd-sheet', { targetPosition: { x: 120, y: 60 } }); await page.waitForTimeout(600);
  let pg = (await cb(() => window.__cb.studio())).fo; let cur = pg.pages[pg.cur];
  ok(cur.length === 3 && cur.every((i) => i.y < 290 && i.x < 594), 'the project lands in panel 1, top: ' + JSON.stringify(cur));
  ok((await cb(() => window.__cb.fill()))['0.0'] > 0.75, 'and fills that section');
  await shot('8-folder-drop');
  // drag one frame into the next section down
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const ph = await page.$('#st-folio .bd-it.ph'); const pb = await ph.boundingBox(); const sb = await (await page.$('#st-folio .bd-sheet')).boundingBox();
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await page.mouse.down(); await page.mouse.move(sb.x + sb.width * 0.15, sb.y + sb.height * 0.5, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(400);
  pg = (await cb(() => window.__cb.studio())).fo; cur = pg.pages[pg.cur];
  ok(cur.filter((i) => i.y > 280).length === 1, 'one frame moved into the middle section: ' + JSON.stringify(cur.map((i) => [i.x, i.y])));
  // marquee across the board selects several
  await page.mouse.move(sb.x + 2, sb.y + 2); await page.mouse.down(); await page.mouse.move(sb.x + sb.width * 0.3, sb.y + sb.height * 0.9, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
  ok((await cb(() => window.__cb.studio())).fo.sel.length >= 2, 'a marquee selects several');
  await shot('10-marquee');
  // edit a group
  await page.click('#st-folio .lib-f.proj'); await page.waitForTimeout(200); await page.click('#st-folio [data-lib-edit]'); await page.waitForTimeout(1500);
  ok((await cb(() => window.__cb.studio())).room === 'edit', 'EDIT opens the develop panel');
  ok(/GROUP/.test(await page.$eval('#dvCount', (e) => e.textContent)), 'editing just the group');
  ok(await page.$$eval('#dvFilm [data-dv]', (n) => n.length) === 3, 'the film strip shows only the group');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  board (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; }
finally { await browser.close(); }
