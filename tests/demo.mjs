// Demo test: the sign-in page's ten-minute demo starts fresh at the Stump with two challenges and a short guide
// (5 photos, a top 3, a quick edit, one workbook page, the top of a folio panel).
// Usage: node tests/demo.mjs [path/to/studium.html]
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARG = process.argv[2] || '';
const FILE = /^https?:/.test(ARG) ? ARG : resolve(ARG || join(ROOT, 'dist', 'studium.html'));   // a file, or an http(s) URL for the web build
const PAGE = /^https?:/.test(FILE) ? FILE.replace(/\/?$/, '/') : pathToFileURL(FILE).href;
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
const gd = () => ev(() => window.__gd.state());
const waitStep = (id) => page.waitForFunction((x) => window.__gd.state().id === x && window.__gd.state().open, id, { timeout: 120000, polling: 300 });
const shot = (n) => page.screenshot({ path: join(OUT, `demo-${n}.png`), timeout: 240000 });
try {
  await page.goto(PAGE + '?dev');
  await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 60000 });
  await shot('0-signin');
  await page.click('#signin [data-si="demo"]');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 });
  await waitStep('basics');
  let g = await gd(); ok(g.demo && g.n === 8, 'the demo guide should be running: ' + JSON.stringify(g));
  ok(/ten-minute/.test(await page.$eval('#gdPop', (e) => e.textContent)), 'the welcome says it is the short demo');
  await page.click('#gdPop [data-gd="next"]'); await waitStep('challenges');
  const dp = await ev(() => window.__ch.pads()); ok(dp.length === 3 && dp.map((p) => p.id).join() === 'stump-fgbg,stump-dof,stump-67', 'the demo has three challenges, one per camera: ' + JSON.stringify(dp.map((p) => p.id)));
  await shot('1-welcome');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(1200);
  await shot('1b-scene');
  ok(/DEMO · STEP 2/.test(await page.$eval('#gdCard', (e) => e.textContent)), 'the tracker is marked DEMO');
  await page.click('#gdCard [data-gd="next"]'); await waitStep('shoot');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(300);
  await ev((fr) => { const L = ['2470', '85'], F = [11, 1.8]; for (let i = 0; i < 5; i++) window.__cb.addPhoto({ url: fr[i % fr.length], f: F[i % 2], sh: '1/250', iso: 400, mm: 50, lens: L[i % 2], body: 'Full-frame DSLR', place: 'The Stump' }); }, frames);
  await waitStep('select');   // five photos, two lenses, two apertures: done by itself
  for (const id of ['edit', 'workbook', 'folio', 'done']) { await page.click('#gdPop [data-gd="next"]'); await waitStep(id); }
  ok(/DONE IN \d+ MIN/.test(await page.$eval('#gdPop', (e) => e.textContent)), 'the end says how long the demo took');
  await shot('2-done');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(500);
  ok((await gd()).step === -1, 'finishing ends the demo');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  demo (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; await shot('fail').catch(() => {}); }
finally { await browser.close(); }
