// Quests, phase 6: every Term 1 quest (F1 to F5, M1 to M9) completed in one scripted run, with M7 unlocked by
// pretending there are three scenes. Each check reads the work itself through the dev hooks.
import { createRequire } from 'node:module';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(process.argv[2] || join(ROOT, 'dist', 'studium.html'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_looked', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const qs = async (id) => (await ev(() => window.__q.state())).quests.find((x) => x.id === id);
const run = async (id, f, a) => { ok(await ev((i) => window.__q.track(i), id), 'could not track ' + id + ': ' + JSON.stringify(await qs(id))); await ev(f, a); await ev(() => window.__q.tick());
  const q = await qs(id); ok(q.status === 'done', id + ' not done: ' + JSON.stringify(q)); console.log('done', id); };
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick');
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'attached', timeout: 20000 }); await page.$eval('#tileSplat', (b) => b.click());
  await page.waitForSelector('.scenecard', { state: 'visible', timeout: 10000 }); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 });
  await ev(() => window.__qu.closeAll());
  const add = (o) => ev((p) => window.__cb.addPhoto(p), o);
  await run('f1', () => { window.__q.tour('basics'); window.__q.frames(3); });
  await ev(() => window.__q.track('f2'));
  const L = ['2470', '50', '85', '135'], F = [2.8, 5.6, 11], SH = ['1/60', '1/250', '1/1000'], ISO = [100, 800];
  for (let i = 0; i < 15; i++) await add({ url: 'x', lens: L[i % 4], f: F[i % 3], sh: SH[i % 3], iso: ISO[i % 2], place: 'The Stump', light: { time: 'day', lights: [] } });
  await run('f2', () => {});
  await run('f3', () => { window.__q.tour('select'); window.__q.tour('edit'); window.__q.flag('synced'); for (let i = 0; i < 8; i++) window.__cb.addPhoto({ url: 'p', pick: true, place: 'The Stump' }); });
  await run('f4', () => { window.__q.tour('research'); window.__q.research('cull', 'a'); window.__q.research('punctum', 'a'); window.__q.page('research', 1); });
  await run('f5', () => { window.__q.tour('workbook'); window.__q.tour('library'); window.__q.page('rank', 3); });
  ok((await ev(() => window.__q.state())).board, 'board open');
  await run('m1', () => { window.__q.frames(99); window.__q.page('annotate', 1); });
  await run('m2', () => { window.__q.briefs(3); window.__q.page('contact', 1); });
  await ev(() => window.__q.track('m3')); await ev(() => window.__q.flag('rlOpened'));
  for (const t of ['day', 'golden', 'night']) for (let i = 0; i < 3; i++) await add({ url: 'l', light: { time: t, lights: [] } });
  await add({ url: 'n', light: { time: 'night', lights: [{ fx: 'fresnel' }, { fx: 'led' }] } });
  await run('m3', () => window.__q.page('experiment', 1));
  await run('m4', () => { ['b', 'c'].forEach((k) => { window.__q.research('cull', k); window.__q.research('punctum', k); }); window.__q.page('artist', 1); window.__q.page('artist', 1); });
  await run('m5', () => { window.__q.page('moodboard', 8); window.__q.page('mood', 1); });
  await run('m6', () => { for (let i = 0; i < 10; i++) window.__cb.addPhoto({ url: 'p', pick: true, place: 'The Stump', note: 'The light falls across the bark here.' }); window.__q.page('next', 1); });
  // M7 needs three places: pretend more scenes have shipped
  await ev(() => { window.SPLAT_SCENES = (window.SPLAT_SCENES || []).concat([{ name: 'Two' }, { name: 'Three' }]).slice(0, Math.max(3, (window.SPLAT_SCENES || []).length)); while (window.SPLAT_SCENES.length < 3) window.SPLAT_SCENES.push({ name: 'x' + window.SPLAT_SCENES.length }); });
  await run('m7', () => { ['A', 'B', 'C'].forEach((pl) => { for (let i = 0; i < 6; i++) window.__cb.addPhoto({ url: 'p', pick: true, edited: true, place: pl }); }); window.__q.page('edit', 1); });
  await run('m8', () => window.__q.folioAll());
  await run('m9', () => { window.__q.book(6); window.__q.flag('bookPdf'); window.__q.gallery(8, 'Bark and light'); });
  const all = (await ev(() => window.__q.state())).quests.filter((x) => x.status !== 'done').map((x) => x.id);
  ok(!all.length, 'every quest done; left: ' + all.join(','));
  ok(!errors.length, 'page errors: ' + errors.join(' | '));
  console.log('PASS all quests');
} catch (e) { console.error('FAIL', e.message); console.error(errors.join('\n')); process.exitCode = 1; }
await browser.close();
