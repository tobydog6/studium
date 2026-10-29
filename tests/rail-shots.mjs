// Secret rail: opens a pit, runs the darkroom reel with a Legendary winner and twelve decoys, hovers the landed print,
// flips it, lets it hand off, then closes. Needs `node build.mjs --web`. Shots: tests/out/rail-*.png
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
const shot = async (n) => { await hideHub(); await page.waitForTimeout(150); return page.screenshot({ path: join(OUT, `rail-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
const W = (ms) => page.waitForTimeout(ms);
const until = (fn, label, ms = 300000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 250 }).catch(() => { throw new Error('timed out waiting for ' + label); });
let fail = '', fr;
const ev = (fn) => fr.evaluate(fn);
const state = async (tag) => { const s = await ev(() => __lt.secret.S.rail.state()); console.log('  ' + tag + ':', JSON.stringify(s)); return s; };
const t0 = Date.now();
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await W(8000);
  await page.evaluate(() => { const cols = ['#7a8f6e', '#c58b52', '#3d5a7a'];
    cols.forEach((c, i) => { const cv = document.createElement('canvas'); cv.width = i % 2 ? 600 : 900; cv.height = i % 2 ? 900 : 600; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#fff'; g.font = '120px sans-serif'; g.fillText('F' + i, 80, 300);
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
  const un = await ev(() => __lt.secret.S.unlocked()); if (!un) fail = 'did not unlock';
  await ev(() => __lt.secret.S.T.setTimeScale(3));
  /* the pit (left of the felt board), the camera and the run: loot.js would do this; here the test does */
  await ev(() => { const S = __lt.secret.S; S.hole.open(-17.5, -4, -3.5, 2); S.cam.push({ tx: -10.5, ty: -0.4, tz: -0.8, pitch: 30, dT: 16 }); S.rail.__drive(true);
    window.__railR = 'pending'; S.rail.run(S.SL.roll({ tier: 'legendary' }), { rect: [-17.5, -4, -3.5, 2], decoys: Array.from({ length: 12 }, () => S.SL.roll()) }).then(o => { window.__railR = o === null ? 'null' : (o.slab ? 'obj:' + o.slab.tier : 'odd'); }); });
  await until(() => { const s = __lt.secret.S.rail.state(); return (s.phase === 'rise' && s.rigY > -0.6) || s.phase === 'reel'; }, 'the rail to rise'); await shot('1-risen'); const s1 = await state('risen');
  if (s1.built !== s1.slots) fail = fail || 'prints did not all build: ' + s1.built + '/' + s1.slots;
  await until(() => { const s = __lt.secret.S.rail.state(); return s.phase !== 'reel' || s.pos > s.target * 0.45; }, 'mid reel'); await shot('2-reel'); await state('reel');
  /* the shared headless GPU is slow (other agents run on it too): the tail of the reel and the landing at a faster clock */
  await ev(() => __lt.secret.S.T.setTimeScale(6));
  await until(() => __lt.secret.S.rail.state().phase === 'prompt', 'the landing'); const s3 = await state('landed');
  if (s3.idx !== s3.winner % s3.slots && Math.abs(s3.pos - s3.target) > 0.02) fail = fail || 'did not land on the winner: pos ' + s3.pos + ' target ' + s3.target;
  await W(2500); await shot('3-prompt');
  /* hover: the pointer over the landed print, by its projected position */
  const hp = await ev(() => { const S = __lt.secret.S, r = S.rail; const sp = r.__spin ? r.__spin() : null; const p = new S.THREE.Vector3(); if (sp) sp.getWorldPosition(p); else p.set(0, -0.4, 1.5); p.project(S.camera);
    const rc = S.ctx.canvas.getBoundingClientRect(), f = window.frameElement ? window.frameElement.getBoundingClientRect() : { left: 0, top: 0 };
    const cx = rc.left + (p.x + 1) / 2 * rc.width, cy = rc.top + (1 - p.y) / 2 * rc.height; const hit = r.pointer('move', { clientX: cx, clientY: cy, button: 0 }); return { x: f.left + cx, y: f.top + cy, hit }; });
  console.log('  hover:', JSON.stringify(hp)); if (!hp.hit) fail = fail || 'hover did not find the landed print';
  await W(1200); await shot('4-hover'); await state('hover');
  /* the flip */
  await ev(() => __lt.secret.S.rail.__flip()); await W(350); await shot('5-flip'); await state('flipping');
  await until(() => { const s = __lt.secret.S.rail.state(); return s.phase === 'done' && s.handed; }, 'the hand-off'); await W(1800); await shot('6-face-up'); const s6 = await state('done');
  const res = await ev(() => window.__railR); console.log('  run resolved:', res); if (!/^obj:/.test(res)) fail = fail || 'run did not resolve with the print: ' + res;
  const land = await ev(() => { const l = __lt.secret.S.rail.landing; return [+l.x.toFixed(2), +l.y.toFixed(2), +l.z.toFixed(2)]; }); console.log('  landing:', JSON.stringify(land));
  /* close: sink and tidy */
  await ev(() => { __lt.secret.S.rail.close(); }); await W(900); await shot('7-sinking');
  await until(() => __lt.secret.S.rail.state().phase === 'off', 'the close'); await ev(() => { const S = __lt.secret.S; S.hole.close(); S.cam.pop(); S.rail.__drive(false); }); await W(1500); await shot('8-closed');
  const left = await ev(() => ({ children: __lt.secret.S.rail.group.children.length, visible: __lt.secret.S.rail.group.visible, slabs: __lt.secret.S.slabs.all().length })); console.log('  after close:', JSON.stringify(left));
  if (left.children !== 0) fail = fail || 'rail group not emptied';
} catch (e) { fail = e.message; }
await browser.close(); server.close();
console.log('  took ' + Math.round((Date.now() - t0) / 1000) + ' s');
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'rail: FAIL ' + fail : 'rail: OK'); process.exit(fail || errors.length ? 1 : 0);
