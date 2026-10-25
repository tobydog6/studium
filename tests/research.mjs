// Research: packs glow until the first Culling Game; the moodboard turns picks from every pack into an A3 workbook page.
// Usage: node tests/research.mjs [path/to/studium.html]   (Supabase is unreachable here, so it uses the sample pack)
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
await page.addInitScript(() => { try { /* quests: something tracked, so the focus picker doesn't cover the hub */ if (!localStorage.getItem('studium_quests_v1')) localStorage.setItem('studium_quests_v1', JSON.stringify({ v: 1, set: 'term1', tracked: 'f1', lastFocusAsk: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'), quests: { f1: { started: Date.now(), base: { photos: 0, t: Date.now() }, done: null, stepDone: {} } }, tours: {}, tourStep: {}, flags: {}, rs: { cull: {}, punctum: {}, details: 0 }, first: Date.now() })); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_guide_v1', 'off'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const shot = (n) => page.screenshot({ path: join(OUT, n + '.png'), timeout: 240000 });
const tap = (sel) => page.$eval(sel, (b) => b.click());
const rs = () => page.evaluate(() => window.__rs.state());
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick&noauto');
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 });
  await page.evaluate(() => { const b = document.createElement('button'); b.setAttribute('data-nav', 'critique'); document.body.appendChild(b); b.click(); b.remove(); });
  await page.waitForSelector('#st-research .rs-pack', { state: 'visible', timeout: 30000 });
  ok(await page.$('#st-research .rs-shelf.rs-glow'), 'packs should glow before the first Culling Game');
  ok(await page.$('#st-research .rs-start'), 'no START HERE banner'); await page.waitForTimeout(800); await shot('research-glow');
  await tap('#st-research .rs-start [data-rs-act="cull"]');
  while ((await rs()).view === 'cull') { await tap('#st-research [data-rs-act="pick"]'); await page.waitForTimeout(80); }
  ok((await rs()).culls === 1, 'culling game did not finish');
  await tap('#st-research [data-rs-act="all"]'); await page.waitForSelector('#st-research .rs-at');
  ok((await page.$$eval('#st-research .rs-at', (a) => a.length)) >= 6, 'see all the photos should show the whole pack'); await page.waitForTimeout(800); await shot('research-all');
  await tap('#st-research [data-rs-act="shelf"]'); await page.waitForTimeout(200);
  ok(!(await page.$('#st-research .rs-shelf.rs-glow')), 'glow should stop after the first Culling Game');
  ok(!(await page.$('#st-research [data-rs-act="round"]')), 'no Punctum round for now'); ok(await page.$('#st-research .rs-wall'), 'the moodboard wall leads the room'); await shot('research-shelf');
  await tap('#st-research [data-rs-act="mood"]'); await page.waitForSelector('#st-research .rs-mt');
  const n = await page.$$eval('#st-research .rs-mt', (a) => a.length); ok(n >= 6, 'moodboard should show every pack photo');
  for (let i = 0; i < 5; i++) await page.$eval(`#st-research .rs-mt:nth-child(${i + 1})`, (b) => b.click());
  ok((await rs()).mood === 5, 'picking five failed'); await page.waitForTimeout(800); await shot('research-mood');
  await tap('#st-research [data-rs-act="moodmake"]');
  await page.waitForFunction(() => window.__rs.state().moods === 1, null, { timeout: 30000 }); await page.waitForTimeout(1500); await shot('research-moodpage');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log('PASS research');
} catch (e) { console.error('FAIL ', e.message); await shot('research-fail').catch(() => {}); process.exitCode = 1; } finally { await browser.close(); }
