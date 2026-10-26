// The launch sequence's room clips (assets/launch/<room>.mp4): a few seconds of moving around inside Select, Edit, Workbook,
// Folio and Gallery, staged from the Stump fixture frames the way tools/shots.mjs does. Needs dist/studium.html and ffmpeg.
//   node tools/launchclips.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'dist', 'studium.html');
const OUT = join(ROOT, 'assets', 'launch'); mkdirSync(OUT, { recursive: true });
const TMP = join(ROOT, 'tests', 'out', 'launch'); rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
const FIX = join(ROOT, 'tests', 'fixtures');
const frames = readdirSync(FIX).filter((f) => f.endsWith('.jpg')).sort().map((f) => 'data:image/jpeg;base64,' + readFileSync(join(FIX, f)).toString('base64'));
const W = 1600, H = 1000, FPS = 15, SEC = 5;   /* full-res frames: the opening shows these full screen */
const meta = [[2.8, '1/250', 200, 35], [8, '1/125', 400, 24], [4, '1/500', 200, 85], [5.6, '1/160', 400, 50], [11, '1/60', 800, 24], [2, '1/1000', 100, 85], [5.6, '1/250', 200, 50], [16, '1/30', 400, 35]];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_launch_seen', '1'); localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: 'Aroha' } })); } catch (e) {} });
page.on('pageerror', (e) => console.log('page error:', String(e)));
await page.goto(pathToFileURL(FILE).href + '?dev');
await page.addStyleTag({ content: '#prompt,#navCoach,#gdTrk,.toast,#toast,#qHud,#coCard,#coRing,.ach-card,#wsDone{display:none!important}' });
const key = async (k, wait = 150) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
const slide = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
await page.waitForSelector('#tileStudio', { state: 'visible', timeout: 60000 });
await page.evaluate(([fs, meta]) => fs.forEach((u, i) => window.__cb.addPhoto({ url: u, f: meta[i][0], sh: meta[i][1], iso: meta[i][2], mm: meta[i][3], body: 'Full-frame DSLR', place: 'The Stump' })), [frames, meta]);
await page.click('#tileStudio'); await page.waitForTimeout(900);

// record: run `act(i)` between frames, so the clip shows a hand at work
async function record(name, crop, act) { const n = Math.round(FPS * SEC); const dir = join(TMP, name); mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n; i++) { await act(i, n); await page.screenshot({ path: join(dir, `f${String(i).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 90, clip: crop, timeout: 180000 }); }
  execSync(`ffmpeg -v error -y -framerate ${FPS} -i ${dir}/f%03d.jpg -vf "scale=1280:-2" -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart ${OUT}/${name}.mp4`);
  console.log('  ' + name + '.mp4'); }
const lerp = (a, b, k) => a + (b - a) * k, ease = (k) => k * k * (3 - 2 * k);

// Select: picks, then stepping through the sheet
for (const i of [0, 1, 3, 4, 5]) { await page.click(`[data-st-frame="${i}"]`); await key('KeyP', 60); }
await page.click('[data-st-frame="7"]'); await key('KeyX', 60); await page.click('[data-st-frame="0"]'); await page.waitForTimeout(400);
await record('select', { x: 0, y: 0, width: W, height: H }, async (i) => { if (i % 12 === 11) await key('ArrowRight', 60); else await page.waitForTimeout(60); });

// Edit: the light sliders moving
await page.click('[data-st-frame="3"]'); await key('Enter', 2500);
await record('edit', { x: 0, y: 0, width: W, height: H }, async (i, n) => { const k = ease(i / (n - 1)); await slide('pExposure', Math.round(lerp(-10, 35, k))); await slide('pShadows', Math.round(lerp(0, 50, k))); await slide('pVibrance', Math.round(lerp(0, 30, k))); await page.waitForTimeout(90); });
await page.click('#eSave').catch(async () => { await page.click('#eCancel'); }); await page.waitForTimeout(1200);

// Workbook: a Compare page, a photo dragged across it
await page.click('[data-st-room="workshop"]'); await page.waitForTimeout(900);
await page.click('#st-workshop [data-bd-tmpl="0"]'); await page.waitForTimeout(500);
await page.dragAndDrop('#st-workshop .lib-grid [data-bd-pic="1"]', '#st-workshop .bd-it.sl'); await page.waitForTimeout(300);
await page.dragAndDrop('#st-workshop .lib-grid [data-bd-pic="3"]', '#st-workshop .bd-it.sl').catch(() => {}); await page.waitForTimeout(300);
{ const ph = await page.$$('#st-workshop .bd-it.ph'); const b = ph.length ? await ph[ph.length - 1].boundingBox() : null;
  if (b) { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); }
  await record('workbook', { x: 0, y: 0, width: W, height: H }, async (i, n) => { if (b) { const k = ease(Math.min(1, i / (n - 8))); await page.mouse.move(b.x + b.width / 2 + 120 * k, b.y + b.height / 2 + 90 * k, { steps: 2 }); } await page.waitForTimeout(60); });
  if (b) await page.mouse.up(); }

// Folio: a third filling itself, then Shuffle
await page.click('[data-st-room="folio"]'); await page.waitForTimeout(900);
{ const zooms = await page.$$eval('#st-folio [data-bd-zoom]', (n) => n.map((e) => e.getAttribute('data-bd-zoom')).filter((z) => z !== '-1'));
  await page.hover('#st-folio .bd-sheet'); await page.click(`#st-folio [data-bd-zoom="${zooms[0]}"]`); await page.waitForTimeout(400);
  const pics = [3, 0, 4, 1, 5, 2];
  await record('folio', { x: 0, y: 0, width: W, height: H }, async (i) => { if (i % 9 === 4 && pics.length) { await page.click(`#st-folio .lib-grid [data-bd-pic="${pics.shift()}"]`).catch(() => {}); } else if (i % 23 === 22) { await page.click('#st-folio [data-bd-act="shuffle"]').catch(() => {}); } await page.waitForTimeout(80); }); }

// Gallery: the hang, looking along the wall
await page.click('[data-st-room="gallery"]'); await page.waitForTimeout(1500);
{ const g = await page.$('#st-gallery .ga-room, #st-gallery .gx-room, #st-gallery'); const b = await g.boundingBox();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5); await page.mouse.down();
  await record('gallery', { x: 0, y: 0, width: W, height: H }, async (i, n) => { const k = ease(i / (n - 1)); await page.mouse.move(b.x + b.width * lerp(0.6, 0.35, k), b.y + b.height * 0.5, { steps: 2 }); await page.waitForTimeout(60); });
  await page.mouse.up(); }

await browser.close();
console.log('clips in assets/launch/');
