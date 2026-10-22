// The demo should carry you: start it and the warm-up runs by itself, the quest card sits top right,
// any step can be skipped, the next foundation is one click from the completion card, and achievement cards leave on their own.
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
await page.addInitScript(() => { try { localStorage.setItem('studium_detail', 'test'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const wait = (f, ms = 60000) => page.waitForFunction(f, null, { timeout: ms, polling: 400 });
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&quick');
  await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 60000 }); await page.click('#signin [data-si="demo"]');
  // no clicks: the warm-up starts on its own
  await wait(() => window.__co && window.__co.state().on && window.__co.state().tour === 'basics', 300000);
  console.log('warm-up started by itself');
  await page.screenshot({ path: join(OUT, 'flow-1-warmup.png'), timeout: 60000 }).catch(() => {});
  await ev(() => window.__co.skip()); await page.waitForTimeout(1500);
  // the quest card: top right, steps showing, skip available
  await wait(() => window.__qu.state().hud);
  const box = await page.$eval('#qHud', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; });
  ok(box.x > 900 && box.y < 120, 'quest card top right: ' + JSON.stringify(box));
  ok(await page.$('#qHud .q-skipst'), 'skip this step is there');
  ok(await page.$eval('#qHud', (e) => !e.classList.contains('min')), 'card open, not collapsed');
  await page.screenshot({ path: join(OUT, 'flow-2-hud.png'), timeout: 60000 }).catch(() => {});
  // skip the gold frames
  await page.$eval('#qHud .q-skipst', (b) => b.click()); await page.waitForTimeout(1500);
  await wait(() => window.__qu.state().done, 20000);
  ok(await page.$('#qDone [data-q-pick="d2"]'), 'completion card offers the next foundation directly');
  await page.$eval('#qDone [data-q-pick="d2"]', (b) => { b.disabled = false; b.click(); }); await page.waitForTimeout(800);
  ok((await ev(() => window.__q.state())).tracked === 'd2', 'D2 tracked in one click');
  // an achievement card leaves on its own
  await ev(() => window.__ach.event('bounds')); await wait(() => window.__ach.state().card && window.__ach.state().card.full, 30000);
  await wait(() => !window.__ach.state().card, 30000); console.log('achievement card left by itself');
  ok(!errors.length, 'page errors: ' + errors.join(' | '));
  console.log('PASS demo flow');
} catch (e) { console.error('FAIL', e.message); console.error(errors.join('\n')); process.exitCode = 1; await page.screenshot({ path: join(OUT, 'flow-fail.png') }).catch(() => {}); }
await browser.close();
