// Import test: photos dragged in from the computer land in the open library folder, on a folder's row, or in a project,
// with camera settings read from EXIF. Drops are synthesised with a DataTransfer of File objects.
// Usage: node tests/import.mjs [path/to/studium.html]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
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
const b64 = (f) => readFileSync(join(FIX, f)).toString('base64');
const exif = b64('import/exif.jpg'), plain = b64('fr02.jpg'), frame = 'data:image/jpeg;base64,' + b64('fr01.jpg');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_detail', 'test'); if (!localStorage.getItem('studium_v1')) localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const cb = (f, a) => page.evaluate(f, a);
// drop files (name, base64, type) onto the element matching sel
const drop = (sel, files) => cb(([s, fs]) => { const el = document.querySelector(s); const dt = new DataTransfer();
  fs.forEach(([n, b, t]) => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); dt.items.add(new File([u], n, { type: t, lastModified: 1700000000000 })); });
  el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
  el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, [sel, files]);
const count = () => cb(() => window.__cb.photos.length);
const waitCount = (n) => page.waitForFunction((k) => window.__cb.photos.length >= k, n, { timeout: 60000 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.waitForSelector('#tileStudio', { state: 'visible', timeout: 20000 });
  await cb((u) => [0, 1, 2].forEach(() => window.__cb.addPhoto({ url: u, f: 4, sh: '1/125', iso: 400, mm: 50, body: 'Full-frame DSLR', place: 'The Stump' })), frame);
  await page.click('#tileStudio'); await page.waitForTimeout(600);
  await page.click('[data-lib-f="place:The Stump"]'); await page.waitForTimeout(300);

  // two photos onto the light table with The Stump open
  await drop('#st-select .st-sheet', [['IMG_0412.jpg', exif, 'image/jpeg'], ['IMG_0413.jpg', plain, 'image/jpeg']]);
  await waitCount(5); await page.waitForTimeout(500);
  const got = await cb(() => window.__cb.photos.slice(3).map((p) => ({ place: p.place, f: p.f, sh: p.sh, iso: p.iso, mm: p.mm, body: p.body, year: new Date(p.t).getFullYear(), jpeg: /^data:image\/jpeg/.test(p.url) })));
  ok(got.every((p) => p.place === 'The Stump' && p.jpeg), 'dropped photos should land in The Stump: ' + JSON.stringify(got));
  ok(got[0].f === 2.8 && got[0].sh === '1/250' && got[0].iso === 800 && got[0].mm === 85 && got[0].body === 'Canon EOS R6' && got[0].year === 2026, 'EXIF settings should come across: ' + JSON.stringify(got[0]));
  ok((await page.textContent('[data-lib-f="place:The Stump"] i')).trim() === '5', 'The Stump folder should count 5');
  await page.screenshot({ path: join(OUT, 'import-1-stump.png') });

  // a project, then a drop straight onto its row
  await page.click('[data-lib-new]'); await page.fill('.lib-in', 'Bark textures'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const proj = await page.getAttribute('.lib-f.proj', 'data-lib-f');
  await page.click('[data-lib-f="place:The Stump"]'); await page.waitForTimeout(200);
  await drop(`[data-lib-f="${proj}"]`, [['bark.jpg', plain, 'image/jpeg']]);
  await waitCount(6); await page.waitForTimeout(500);
  const pj = await cb(() => window.__cb.projects());
  ok(pj.length === 1 && pj[0].n === 1, 'the photo dropped on the project row should be in the project: ' + JSON.stringify(pj));
  ok((await cb(() => window.__cb.photos[5].place)) === 'Imported', 'a project import with no location goes under Imported');

  // the picks of a location
  await page.click('[data-lib-f="place:The Stump"]'); await page.waitForTimeout(200);
  await drop('[data-lib-f="place:The Stump"]', [['pick.jpg', plain, 'image/jpeg']]);
  await waitCount(7); await page.waitForTimeout(400);
  ok((await cb(() => window.__cb.photos[6].place)) === 'The Stump', 'a drop on a location row lands in that location');
  await cb(() => { window.__cb.photos[0].pick = true; }); await page.click('[data-lib-f="place:The Stump"]'); await page.waitForTimeout(200);
  await page.click('[data-lib-f="place:The Stump|picks"]'); await page.waitForTimeout(200);
  await drop('#st-select .st-sheet', [['pick2.jpg', plain, 'image/jpeg']]);
  await waitCount(8); await page.waitForTimeout(400);
  const pk = await cb(() => window.__cb.photos[7]);
  ok(pk.pick && pk.place === 'The Stump', 'a drop with Picked photos open should be a pick from The Stump');

  // not a photo: nothing added, no scan load
  const n0 = await count();
  await drop('#st-select .st-sheet', [['notes.txt', Buffer.from('hello').toString('base64'), 'text/plain']]);
  await page.waitForTimeout(800);
  ok((await count()) === n0, 'a text file should not import');
  ok(await cb(() => window.__cb.studio().open), 'the studio should still be open (the drop must not load a scan)');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  import (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; }
finally { await browser.close(); }
