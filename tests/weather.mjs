// The quick check: serves dist/web (run `node build.mjs --web` first) and loads Studium headless.
// Fails on any page error or console error. A minute or two, not a test suite.
//   node tests/quick.mjs                 load the app and screenshot it
//   node tests/quick.mjs --tour          also sign in to the demo and step through the warm-up tour,
//                                        screenshotting the steps listed in --shots (default 4,8,13,19)
//   node tests/quick.mjs --tour --shots 5,9,20
// Screenshots go to tests/out/quick-*.png: look at them, that's the point.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve('/home/claude/studium'), WEB = join(ROOT, 'dist', 'web'), OUT = join(ROOT, 'tests', 'out');
if (!existsSync(join(WEB, 'index.html'))) { console.error('No dist/web: run `node build.mjs --web` first'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const arg = (k) => process.argv.includes(k), TOUR = arg('--tour');
const si = process.argv.indexOf('--shots'), SHOTS = (si > -1 ? process.argv[si + 1] : '4,8,13,19').split(',').map(Number);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok)); const BASE = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_detail', 'test'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|supabase|net::ERR|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
const shot = async (n) => { await page.waitForTimeout(1200); await page.screenshot({ path: join(OUT, `quick-${n}.png`), timeout: 240000 }).catch(() => console.log('  (screenshot timed out: ' + n + ')')); };
let fail = '';
try {
  await page.goto(BASE + '?dev'); await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 90000 });
  await page.click('#signin [data-si="demo"]');
  await page.waitForFunction(() => window.__cb && __cb.state() === 'scene' && window.__q, null, { timeout: 300000, polling: 500 });
  await page.evaluate(() => { try{ __qu.closeAll(); }catch(e){} for(let i=0;i<60;i++){ try{ if(!__co.state().on) break; __co.go(); }catch(e){ break; } } });
  await page.waitForTimeout(2000);
  await page.evaluate(() => __we.set({rain:2, wind:1, fog:0}));
  await page.evaluate(() => { const w=document.getElementById('laWel'); if(w) w.remove(); document.querySelector('[data-nav-act="kit"]').click(); }); await page.waitForTimeout(1500); await shot('wx-kit');
  await page.evaluate(() => document.querySelector('#kitMenu [data-we="fog"]').click()); await page.waitForTimeout(600); await shot('wx-kit2'); await page.keyboard.press('Escape');
  await page.evaluate(() => { __cam.raise(); __cam.set({sh:0}); }); await page.waitForTimeout(1500); await shot('wx-1000');
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (fail) console.error('FAIL ' + fail);
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'wx: FAIL' : 'wx: OK');
