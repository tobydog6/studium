// The lighting recipe: spots in the plan, wanted-setting bands on the sliders, then the golden hour tour. Needs `node build.mjs --web`.
//   node tests/lightquest.mjs      screenshots to tests/out/light-*.png
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(ROOT, 'dist', 'web'), OUT = join(ROOT, 'tests', 'out');
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok)); const BASE = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_lighttour', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|supabase|net::ERR|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
const shot = async (n) => { await page.waitForTimeout(900); await page.screenshot({ path: join(OUT, `light-${n}.png`), timeout: 400000 }).catch(() => console.log('  (screenshot timed out: ' + n + ')')); };
const ev = (f, ...a) => page.evaluate(f, ...a);
const step = async () => { const s = await ev(() => __co.state()); const t = await ev(() => { const e = document.querySelector('#coCard'); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, 120) : ''; }); console.log(`  step ${s.i + 1}/${s.n} [${s.ch}] ${t}`); return s; };
let fail = '';
try {
  await page.goto(BASE + '?dev&noauto'); await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
  await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 90000 }); await page.click('#signin [data-si="demo"]');
  await page.waitForFunction(() => window.__cb && __cb.state() === 'scene' && window.__q && __q.state().tracked === 'd1', null, { timeout: 300000, polling: 500 });
  await ev(() => { __qu.closeAll(); ['d1', 'd2', 'd3'].forEach((id) => __q.complete(id)); __q.track('d4'); __qu.closeAll(); });
  await ev(() => __rl.open()); await page.waitForFunction(() => document.querySelector('#rlPlanUI.show'), null, { timeout: 120000 });
  await ev(() => __co.start('lighting')); await page.waitForTimeout(1500);
  await step(); await ev(() => __co.go()); await page.waitForTimeout(800);            // info
  await step(); await ev(() => __co.go()); await page.waitForTimeout(800);            // night
  await step(); await ev(() => __rl.add('fresnel')); await page.waitForTimeout(1500); // add fresnel
  await step(); await shot('1-spot');                                                  // drag to the spot
  await ev(() => __rl.spot(0)); await page.waitForTimeout(1500);
  await step(); await shot('2-bands');                                                 // set it
  console.log('want:', await ev(() => JSON.stringify(__rl.want())));
  await ev(() => { __rl.light({ cone: 50, power: 20, k: 4500, h: 1.0 }); }); await page.waitForTimeout(1500);
  await step(); await ev(() => __rl.add('led')); await page.waitForTimeout(1500);     // led
  await step(); await ev(() => __rl.spot(1)); await page.waitForTimeout(1500);        // fill spot
  await step(); await shot('3-fill'); await ev(() => { __rl.light({ power: 14, h: 1.8 }); }); await page.waitForTimeout(1500);
  await step(); await ev(() => __rl.view('eye')); await page.waitForTimeout(1500);
  await step(); console.log('state:', await ev(() => __co.state()));
  await ev(() => __co.stop()); await ev(() => __rl.close());
  await ev(() => __co.start('golden')); await page.waitForTimeout(1200); await step(); await shot('4-golden-kit');
  await page.keyboard.press('Space'); await page.waitForTimeout(1200); await shot('5-kit-glow');
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (fail) console.error('FAIL ' + fail);
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'light: FAIL' : 'light: OK');
process.exit(fail || errors.length ? 1 : 0);
