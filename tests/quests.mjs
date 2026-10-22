// Quests, phase 1: a scripted session ticks each foundation in order, opens the board, and M3 reads light from captures.
// Usage: node tests/quests.mjs [path/to/studium.html]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(process.argv[2] || join(ROOT, 'dist', 'studium.html'));
const OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_looked', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const Q = () => ev(() => window.__q.state());
const qs = async (id) => (await Q()).quests.find((x) => x.id === id);
const shot = (o) => ev((p) => window.__cb.addPhoto(p), o);
const tick = async () => { await ev(() => window.__q.tick()); };
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick');
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 }); await page.click('#tileSplat');
  await page.waitForSelector('.scenecard', { state: 'visible', timeout: 10000 }); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 });
  let s = await Q();
  ok(s.quests.find((x) => x.id === 'f2').status === 'locked', 'F2 should be locked before F1');
  ok(s.quests.find((x) => x.id === 'm1').lock === 'Finish the foundations to open your board', 'main quests locked before the board');
  // F1
  ok(await ev(() => window.__q.track('f1')), 'could not track F1');
  await ev(() => { window.__q.tour('basics'); window.__q.frames(3); }); await tick();
  ok((await qs('f1')).status === 'done', 'F1 not done: ' + JSON.stringify(await qs('f1')));
  // F2: counts start when it's tracked
  await ev(() => window.__q.track('f2'));
  const L = ['2470', '50', '85', '135'], F = [2.8, 5.6, 11], SH = ['1/60', '1/250', '1/1000'], ISO = [100, 800];
  for (let i = 0; i < 15; i++) await shot({ url: 'x', lens: L[i % 4], f: F[i % 3], sh: SH[i % 3], iso: ISO[i % 2], place: 'The Stump', light: { time: 'day', lights: [] } });
  await tick(); ok((await qs('f2')).status === 'done', 'F2 not done: ' + JSON.stringify(await qs('f2')));
  // F3
  await ev(() => window.__q.track('f3'));
  await ev(() => { window.__q.tour('select'); window.__q.tour('edit'); window.__q.flag('synced'); });
  await tick(); ok((await qs('f3')).status === 'active', 'F3 should still need picks');
  await ev(() => { const P = window.__q.raw(); }); await ev(() => { for (let i = 0; i < 8; i++) window.__cb.addPhoto({ url: 'p', pick: true, place: 'The Stump' }); });
  await tick(); ok((await qs('f3')).status === 'done', 'F3 not done: ' + JSON.stringify(await qs('f3')));
  // F4
  await ev(() => window.__q.track('f4'));
  await ev(() => { window.__q.tour('research'); window.__q.research('cull', 'pack1'); window.__q.research('punctum', 'pack1'); window.__q.page('artist', 1); });
  await tick(); ok((await qs('f4')).status === 'done', 'F4 not done: ' + JSON.stringify(await qs('f4')));
  // F5 opens the board
  ok(!(await Q()).board, 'board opened too early');
  await ev(() => window.__q.track('f5'));
  await ev(() => { window.__q.tour('workbook'); window.__q.tour('library'); window.__q.page('rank', 3); });
  await tick(); s = await Q(); ok(s.quests.find((x) => x.id === 'f5').status === 'done' && s.board, 'F5 / board not done');
  // M3 reads light captured on photos, counted from tracking
  ok(await ev(() => window.__q.track('m3')), 'could not track M3 after the board opened');
  await ev(() => window.__q.flag('rlOpened'));
  for (const t of ['day', 'golden', 'night']) for (let i = 0; i < 3; i++) await shot({ url: 'l', light: { time: t, lights: [] } });
  await tick(); let m3 = await qs('m3'); ok(m3.steps[0][0] && m3.steps[1][0] && !m3.steps[2][0], 'M3 steps 1-2 should tick, 3 not: ' + JSON.stringify(m3.steps));
  await shot({ url: 'n', light: { time: 'night', lights: [{ fx: 'fresnel' }, { fx: 'led' }] } }); await ev(() => window.__q.page('experiment'));
  await tick(); ok((await qs('m3')).status === 'done', 'M3 not done: ' + JSON.stringify(await qs('m3')));
  // M7 stays locked with one scene; the moodboard id and real capture fields
  ok((await qs('m7')).lock === 'Needs more locations', 'M7 should need more locations');
  ok((await ev(() => window.__q.state().checkpoints)).length === 3, 'three checkpoints');
  await page.keyboard.press('KeyP'); await page.waitForTimeout(1500); await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
  const cap = await ev(() => window.__q.last()); ok(cap && cap.light && cap.light.time === 'day' && typeof cap.ev === 'number', 'the shutter should record light and exposure: ' + JSON.stringify(cap));
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log('PASS quests');
} catch (e) { console.error('FAIL ', e.message); process.exitCode = 1; } finally { await browser.close(); }
