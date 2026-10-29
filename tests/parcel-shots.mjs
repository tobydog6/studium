// Secret parcel: sends a raw print for grading with the wait set to instant, waits for the courier box to slide onto
// the table, opens it and screenshots the unboxing, the count up and the graded slab left on the table.
// Needs `node build.mjs --web`. Shots: tests/out/parcel-*.png
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
  /* the rack-focus intro (#rackin) arrives late and sits over the table; drop it as soon as it appears */
  const kill = () => { ['rackin', 'launch'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); };
  const arm = () => { try { if (window === window.top && document.documentElement) new MutationObserver(kill).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {} };
  if (document.documentElement) arm(); else document.addEventListener('DOMContentLoaded', arm); });
const errors = [];
const log = (m) => console.log('  [' + new Date().toISOString().slice(11, 19) + '] ' + m);
page.on('pageerror', (e) => { log('pageerror ' + e.message); errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ').slice(0, 400)); });
page.on('console', (m) => { if (m.type() === 'error' && !/supabase|net::ERR|Failed to load resource|scan never finished/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 400)); });
const hideHub = () => page.evaluate(() => { ['hub', 'signin', 'launch', 'rackin'].forEach((id) => { const e = document.getElementById(id); if (e) { e.classList.add('hidden'); e.style.display = 'none'; } }); });
const shot = async (n) => { await hideHub(); return page.screenshot({ path: join(OUT, `parcel-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
const W = (ms) => page.waitForTimeout(ms);
/* the headless GPU runs the tween clock well under real time, so wait on conditions, not seconds */
const until = (fn, label, ms = 150000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 200 }).catch(() => { throw new Error('timed out waiting for ' + label); });
let fail = '', fr;
const ev = (fn) => fr.evaluate(fn);
const state = async (tag) => { const s = await ev(() => { const S = __lt.secret.S, p = S.store.get().pulls[0]; return { state: S.M.state, phase: S.parcel.__phase(), boxes: S.parcel.__boxes().length, table: S.table.list.length, pull: p ? S.SL.gradingState(p) + ' g' + p.grade : 'none' }; }); console.log('  ' + tag + ':', JSON.stringify(s)); return s; };
try {
  log('loading'); await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await W(8000);
  await page.evaluate(() => { const cols = ['#7a8f6e', '#c58b52', '#3d5a7a'];
    cols.forEach((c, i) => { const cv = document.createElement('canvas'); cv.width = i % 2 ? 600 : 900; cv.height = i % 2 ? 900 : 600; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#fff'; g.font = '120px sans-serif'; g.fillText('F' + i, 80, 300);
      __cb.addPhoto({ url: cv.toDataURL('image/jpeg', 0.8), place: 'Stump', pick: i < 2 }); });
    const si = document.getElementById('signin'); if (si) si.style.display = 'none';
    __cb.stOpen('table'); const hub = document.getElementById('hub'); if (hub) hub.classList.add('hidden'); });
  await page.waitForFunction(() => { const f = __cb.lt(); return f && f.contentWindow && f.contentWindow.__lt && f.contentWindow.document.body.classList.contains('ready'); }, null, { timeout: 120000, polling: 500 });
  log('table ready'); fr = page.frames().find((f) => f.url() === 'about:srcdoc');
  await W(2000);
  await ev(() => { if (__lt.TOUR.on) __lt.tourEnd(false); });
  await hideHub();
  await ev(() => __lt.secret.S.ctx.canvas.focus());
  await page.keyboard.press('='); await W(500); await page.keyboard.type('secret'); await page.keyboard.press('Enter'); await W(1500);
  const un = await ev(() => __lt.secret.S.unlocked()); if (!un) fail = 'did not unlock'; log('unlocked ' + un);
  /* the headless GPU manages a frame or two a second: run the secret clock faster so the sequence finishes */
  await ev(() => { const S = __lt.secret.S; S.T.setTimeScale(3); S.store.reset(); S.store.get().unlocked = true; S.store.save(); S.hud(); S.dev.set('grading', 'instant'); });
  /* a raw print on the table, sent for grading: with the wait instant the parcel is due at once */
  await ev(() => { const S = __lt.secret.S; const o = S.rollToTable({ graded: false, tier: 'rare', grade: 9 }); S.sendForGrading(o); }); log('sent for grading');
  await until(() => { const S = __lt.secret.S, b = S.parcel.__boxes(); return b.length === 1 && b[0].arrived; }, 'the box to arrive'); log('box arrived'); await W(800);
  await shot('0-box'); const s0 = await state('box'); if (s0.boxes !== 1 || s0.table !== 0) fail = fail || 'box did not arrive alone';
  /* open it */
  await ev(() => { const S = __lt.secret.S; S.M.go('parcel.open', { box: S.parcel.__boxes()[0] }); });
  await until(() => __lt.secret.S.parcel.__phase() === 'flaps', 'the flaps'); await W(700); await shot('1-flaps'); await state('flaps');
  await until(() => __lt.secret.S.parcel.__phase() === 'rise', 'the rise'); await W(900); await shot('2-rise'); await state('rise');
  await until(() => __lt.secret.S.parcel.__phase() === 'count', 'the count'); await W(1800); await shot('3-count'); await state('count');
  await until(() => __lt.secret.S.M.state === 'idle', 'idle at the end'); await W(1200); await shot('4-table'); const s4 = await state('table');
  if (s4.table !== 1) fail = fail || 'slab did not reach the table'; if (!/^graded/.test(s4.pull)) fail = fail || 'pull was not graded';
  if (s4.boxes !== 0) fail = fail || 'box is still there';
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'parcel: FAIL ' + fail : 'parcel: OK'); process.exit(fail || errors.length ? 1 : 0);
