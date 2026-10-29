// Reveal styles (reveals.js): runs the rail once per style with a short reel, clicks the landed print and screenshots
// the reveal as it plays. Needs `node build.mjs --web`. Shots: tests/out/reveal-<style>-<tier>-<n>.png
// node tests/reveal-shots.mjs [style,style] [tier]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(ROOT, 'dist', 'web'), OUT = join(ROOT, 'tests', 'out');
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('lt_tour_done', '1'); } catch (e) {}
  const kill = () => { ['rackin', 'launch'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); };
  const arm = () => { try { if (window === window.top && document.documentElement) new MutationObserver(kill).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {} };
  if (document.documentElement) arm(); else document.addEventListener('DOMContentLoaded', arm); });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ').slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error' && !/supabase|net::ERR|Failed to load resource|scan never finished/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 400)); });
const hideHub = () => page.evaluate(() => { ['hub', 'signin', 'launch', 'rackin'].forEach((id) => { const e = document.getElementById(id); if (e) { e.classList.add('hidden'); e.style.display = 'none'; } }); });

const shot = async (n) => { await hideHub(); return page.screenshot({ path: join(OUT, `reveal-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
const W = (ms) => page.waitForTimeout(ms);
let fail = '', fr;
const ev = (fn, a) => fr.evaluate(fn, a);
const until = (fn, label, ms = 240000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 200 }).catch(() => { throw new Error('timed out waiting for ' + label); });
const STYLES = (process.argv[2] || 'develop,shatter,burn,charge,scan').split(','), TIER = process.argv[3] || 'epic';
const t0 = Date.now();
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await W(8000);
  await page.evaluate(() => { const cols = ['#7a8f6e', '#c58b52', '#3d5a7a'];
    cols.forEach((c, i) => { const cv = document.createElement('canvas'); cv.width = i % 2 ? 600 : 900; cv.height = i % 2 ? 900 : 600; const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, cv.width, cv.height); gr.addColorStop(0, '#111'); gr.addColorStop(0.5, c); gr.addColorStop(1, '#f4f0e0'); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#fff'; g.font = '120px sans-serif'; g.fillText('F' + i, 80, 300);
      __cb.addPhoto({ url: cv.toDataURL('image/jpeg', 0.8), place: 'Stump', pick: i < 2 }); });
    const si = document.getElementById('signin'); if (si) si.style.display = 'none';
    __cb.stOpen('table'); const hub = document.getElementById('hub'); if (hub) hub.classList.add('hidden'); });
  await page.waitForFunction(() => { const f = __cb.lt(); return f && f.contentWindow && f.contentWindow.__lt && f.contentWindow.document.body.classList.contains('ready'); }, null, { timeout: 120000, polling: 500 });
  fr = page.frames().find((f) => f.url() === 'about:srcdoc');
  await W(2000);
  await ev(() => { if (__lt.TOUR.on) __lt.tourEnd(false); });
  await hideHub();
  await ev(() => __lt.secret.S.ctx.canvas.focus());
  await page.keyboard.press('='); await W(500); await page.keyboard.type('secret'); await page.keyboard.press('Enter'); await W(1500);
  if (!(await ev(() => __lt.secret.S.unlocked()))) throw new Error('did not unlock');
  await ev(() => { const S = __lt.secret.S; S.dev.set('reelLen', 'short'); S.hole.open(-17.5, -4, -3.5, 2); S.cam.push({ tx: -10.5, ty: -0.4, tz: -0.8, pitch: 30, dT: 16 }); S.rail.__drive(true); });
  for (const st of STYLES) {
    await ev((a) => { const S = __lt.secret.S; S.dev.set('reveal', a.st); S.T.setTimeScale(4);
      window.__railR = 'pending'; S.rail.run(S.SL.roll({ tier: a.tier }), { rect: [-17.5, -4, -3.5, 2], decoys: Array.from({ length: 8 }, () => S.SL.roll()) }).then(o => { window.__railR = o === null ? 'null' : (o.slab ? 'obj:' + o.slab.tier : 'odd'); }); }, { st, tier: TIER });
    await until(() => __lt.secret.S.rail.state().phase === 'prompt', st + ' landing');
    await ev(() => __lt.secret.S.T.setTimeScale(1)); await W(800);
    await ev(() => __lt.secret.S.rail.__flip());
    for (let i = 0; i < 9; i++) { await W(i ? 700 : 250); await shot(`${st}-${TIER}-${i}`); }
    await ev(() => __lt.secret.S.T.setTimeScale(4));
    await until(() => { const s = __lt.secret.S.rail.state(); return s.phase === 'done' && s.handed; }, st + ' hand-off');
    const res = await ev(() => window.__railR); console.log('  ' + st + ':', res);
    if (!/^obj:/.test(res)) fail = fail || st + ' did not resolve with the print: ' + res;
    await ev(() => __lt.secret.S.rail.close()); await until(() => __lt.secret.S.rail.state().phase === 'off', st + ' close');
  }
} catch (e) { fail = e.message; }
await browser.close(); server.close();
console.log('  took ' + Math.round((Date.now() - t0) / 1000) + ' s');
if (errors.length) console.error(errors.join('\n'));
if (fail || errors.length) { console.log('reveal-shots: FAIL ' + fail); process.exit(1); } else console.log('reveal-shots: OK');
