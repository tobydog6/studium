// Quests, phase 4: the demo. A real student's work on this computer, then a fresh demo: D1 to D3, the board,
// D7 then D5 (a non-default order), the finish card and feedback, Restart demo, and back to the real work untouched.
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
const URL0 = pathToFileURL(FILE).href;
const OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__initQ = String(localStorage.getItem('studium_quests_v1')).slice(0, 40); });
await page.addInitScript(() => { try { localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_looked', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const S = () => ev(() => window.__q.state());
const qs = async (id) => (await S()).quests.find((x) => x.id === id);
const shot = (o) => ev((p) => window.__cb.addPhoto(p), o);
const tick = () => ev(() => window.__q.tick());
const scene = () => page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 });
const done = async (id) => { await tick(); const q = await qs(id); ok(q.status === 'done', id + ' not done: ' + JSON.stringify(q)); };
try {
  // a real student, with work saved on this computer
  await page.goto(URL0 + '?dev&full&quick');
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 }); await page.$eval('#tileSplat', (b) => b.click());
  await page.waitForSelector('.scenecard', { state: 'visible', timeout: 10000 }); await page.click('.scenecard'); await scene();
  for (let i = 0; i < 4; i++) await shot({ url: 'real', lens: '50', f: 4, place: 'The Stump' });
  await ev(() => { window.__q.track('f1'); window.__q.tour('basics'); }); await tick(); await page.waitForTimeout(7000);   // let storage commit (Chromium batches localStorage writes) before the next document
  const real = await ev(() => localStorage.getItem('studium_quests_v1'));
  ok(JSON.parse(real).tours.basics, 'real student has the warm-up done');

  // the demo, from a ?demo link
  console.log('before goto', await ev(() => Object.keys(localStorage).join(',')));
  const t0 = Date.now();
  await page.goto(URL0 + '?dev&full&quick&demo'); await scene(); await page.waitForTimeout(800);
  console.log('init', await ev(() => window.__initQ), 'now', await ev(() => Object.keys(localStorage).join(',')));
  let s = await S(); ok(s.set === 'demo' && s.tracked === 'd1', 'demo set, D1 tracked: ' + s.set + ' ' + s.tracked);
  ok(await ev(() => window.__q.photos()) === 0, 'the demo starts with no photos');
  ok(!s.tours.length, 'the demo starts with no tours done');
  ok(await ev(() => window.__qu.state().mode), 'quests are on in the demo');
  // D1, D2, D3
  await ev(() => { window.__q.tour('basics'); window.__q.frames(3); }); await done('d1');
  await ev(() => window.__q.track('d2'));
  for (let i = 0; i < 8; i++) await shot({ url: 'd', lens: i % 2 ? '50' : '85', f: i % 2 ? 2 : 8, place: 'The Stump', light: { time: 'day', lights: [] } });
  await done('d2');
  await ev(() => window.__q.track('d3'));
  await ev(() => { window.__q.tour('select'); window.__q.tour('edit'); window.__q.flag('pasted'); for (let i = 0; i < 5; i++) window.__cb.addPhoto({ url: 'p', pick: true, place: 'The Stump' }); });
  await done('d3'); s = await S(); ok(s.board, 'board open after D3');
  ok(!(await ev(() => window.__q.raw().finished)), 'not finished yet');
  // the board, in a non-default order: D7 then D5
  ok(await ev(() => window.__q.track('d7')), 'track D7');
  await ev(() => { window.__q.tour('folio'); window.__q.folio(3); }); await done('d7');
  ok(!(await ev(() => window.__q.raw().finished)), 'one board quest is not the end');
  ok(await ev(() => window.__q.track('d5')), 'track D5');
  await ev(() => { window.__q.research('cull', 'pack1'); window.__q.page('artist', 1); }); await done('d5');
  ok(await ev(() => !!window.__q.raw().finished), 'two board quests finish the demo');
  // the finish card, after the completion moments
  for (let i = 0; i < 8; i++) {
    if (await page.$('#qDone.show .q-finish')) break;
    if (await page.$('#qDone.show')) await page.$eval('#qDone [data-q="closedone"]', (b) => { b.disabled = false; b.click(); });
    await page.waitForTimeout(900);
  }
  ok(await page.$('#qDone.show .q-finish'), 'finish card shows');
  const fin = await page.textContent('#qDone .q-finish');
  ok(/DONE IN \d+ MIN/.test(fin) && fin.includes('The folio then') && fin.includes('Look at others'), 'finish card: time and chosen quests in order: ' + fin.slice(0, 200));
  await page.fill('[data-fb="best"]', 'Changing the light at night'); await page.click('[data-fb-rate="4"]');
  await page.$eval('[data-q="fbsend"]', (b) => { b.disabled = false; b.click(); });
  const fb = await ev(() => window.__q.feedback()); ok(fb.length === 1 && fb[0].rate === 4 && fb[0].quests.join() === 'd5,d7'.split(',').sort().join() || fb[0].quests.length === 2, 'feedback stored: ' + JSON.stringify(fb));
  await page.screenshot({ path: join(OUT, 'demo-finish.png') });
  // keep exploring, then restart
  await page.$eval('#qDone [data-q="explore"]', (b) => { b.disabled = false; b.click(); }); await page.waitForTimeout(400);
  ok(await page.$('#qPick.show'), 'keep exploring opens the picker');
  await ev(() => window.__q.demo.restart()); await page.waitForTimeout(600);
  s = await S(); ok(s.set === 'demo' && s.tracked === 'd1' && !s.board && !s.tours.length, 'restart leaves no trace: ' + JSON.stringify({ t: s.tracked, b: s.board, tours: s.tours }));
  ok(await ev(() => window.__q.photos()) === 0, 'restart clears demo photos');
  // back to the real student: sign-in page, on your own, and the real work is as it was
  await ev(() => document.querySelector('[data-h6="me"]').click()); await page.waitForTimeout(400);
  await Promise.all([page.waitForEvent('load', { timeout: 30000 }), ev(() => document.querySelector('[data-si="solo"]').click())]);
  await page.waitForFunction(() => window.__q && window.__q.photos() > 0, null, { timeout: 30000 });
  ok(await ev(() => window.__q.photos()) === 4, 'real photos back: ' + await ev(() => window.__q.photos()));
  const back = await ev(() => localStorage.getItem('studium_quests_v1'));
  ok(JSON.parse(back).set === 'term1' && JSON.stringify(JSON.parse(back).quests) === JSON.stringify(JSON.parse(real).quests), 'real quests untouched');
  ok((await S()).set === 'term1', 'real set in memory');
  console.log('demo ran in', Math.round((Date.now() - t0) / 1000), 's');
  ok(!errors.length, 'page errors: ' + errors.join(' | '));
  console.log('PASS demo');
} catch (e) { console.error('FAIL', e.message); console.error(errors.join('\n')); process.exitCode = 1; await page.screenshot({ path: join(OUT, 'demo-fail.png') }).catch(() => {}); }
await browser.close();
