// Secret binder: rolls three slabs into the binder, opens it from idle, turns a page, inspects a pocket, moves a slab,
// takes one onto the table, closes. Needs `node build.mjs --web`. Shots: tests/out/binder-*.png
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
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ').slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error' && !/supabase|net::ERR|Failed to load resource|scan never finished/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 400)); });
const hideHub = () => page.evaluate(() => { ['hub', 'signin', 'launch', 'rackin'].forEach((id) => { const e = document.getElementById(id); if (e) { e.classList.add('hidden'); e.style.display = 'none'; } }); });
const shot = async (n) => { await hideHub(); await page.waitForTimeout(150); return page.screenshot({ path: join(OUT, `binder-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
const W = (ms) => page.waitForTimeout(ms);
/* the headless GPU runs the tween clock well under real time, so wait on conditions, not seconds */
const until = (fn, label, ms = 420000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 300 }).catch(() => { throw new Error('timed out waiting for ' + label); });
const settled = () => until(() => { const S = __lt.secret.S, b = S.binder; return !b.busy() && !S.T.running('binder') && !b.pockets().some(p => p.id && !(p.obj && p.obj.built)); }, 'binder to settle');
const spreadShown = () => until(() => { const S = __lt.secret.S; return S.binder.pockets().length === 18 && !S.T.running('binder'); }, 'spread to show');
let fail = '', fr;
const ev = (fn) => fr.evaluate(fn);
const state = async (tag) => { const s = await ev(() => { const S = __lt.secret.S, b = S.binder; return { state: S.M.state, spread: b.spread(), pockets: b.pockets().map(p => (p.id ? (p.obj && p.obj.built ? 'B' : 'b') : '.')).join(''), binder: JSON.stringify(S.store.get().binder), table: S.table.list.length, insp: S.inspect.active() }; }); console.log('  ' + tag + ':', JSON.stringify(s)); return s; };
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
  /* the headless GPU manages a frame or two a second: run the secret clock faster so the sequences finish */
  await ev(() => __lt.secret.S.T.setTimeScale(3));
  /* empty binder first */
  await ev(() => { const S = __lt.secret.S; S.store.reset(); S.store.get().unlocked = true; S.store.save(); S.hud(); S.M.go('binder.open'); });
  await spreadShown(); await W(1500); await shot('0-empty'); await state('empty');
  await ev(() => __lt.secret.S.M.send('CLOSE')); await until(() => __lt.secret.S.M.state === 'idle', 'idle after close'); await W(500);
  const s0 = await ev(() => __lt.secret.S.M.state); console.log('  after close:', s0); if (s0 !== 'idle') fail = 'did not return to idle';
  /* three slabs into the binder, plus a fourth on a second page so a turn has somewhere to go */
  await ev(() => { const S = __lt.secret.S; const ids = []; ['common', 'rare', 'legendary'].forEach(t => { const o = S.rollToTable({ tier: t }); ids.push(o.slab.id); });
    S.table.list.slice().forEach(o => S.table.remove(o, true)); ids.forEach(id => S.store.toBinder(id));
    for (let i = 0; i < 7; i++) { const s = S.SL.roll({ tier: i === 0 ? 'mythic' : 'uncommon' }); S.store.addPull(s); S.store.toBinder(s.id); }
    /* a third page, so there is a second spread to turn to */
    const d = S.store.get(), last = d.binder[1][0]; d.binder[1][0] = null; d.binder.push([last, null, null, null, null, null, null, null, null]); S.store.save(); S.hud(); });
  await ev(() => __lt.secret.S.M.go('binder.open'));
  await spreadShown(); await settled(); await W(1500); await shot('1-open'); const s1 = await state('open');
  if (!/^BBB/.test(s1.pockets) || s1.pockets.indexOf('b') >= 0) fail = fail || 'pockets did not build: ' + s1.pockets;
  /* hover a pocket */
  const pp = await ev(() => { const S = __lt.secret.S, p = S.binder.pockets()[1].group.getWorldPosition(new S.THREE.Vector3()); p.y += 0.05; p.project(S.camera); const r = S.ctx.canvas.getBoundingClientRect(), f = window.frameElement ? window.frameElement.getBoundingClientRect() : { left: 0, top: 0 }; return { x: f.left + r.left + (p.x + 1) / 2 * r.width, y: f.top + r.top + (1 - p.y) / 2 * r.height }; });
  await page.mouse.move(pp.x, pp.y); await W(900); await shot('2-hover');
  const hot = await ev(() => !!__lt.secret.S.binder.hot()); console.log('  hover hot:', hot); if (!hot) fail = fail || 'hover did not highlight';
  /* turn the page both ways */
  await ev(() => __lt.secret.S.binder.turn(1)); await W(600); await shot('3-turning'); await settled(); await W(1200); await shot('4-spread2'); const s2 = await state('spread 2');
  if (s2.spread !== 1) fail = fail || 'page did not turn';
  await ev(() => __lt.secret.S.ctx.canvas.focus()); await page.keyboard.press('ArrowLeft'); await settled(); await W(800); const s3 = await state('back'); if (s3.spread !== 0) fail = fail || 'page did not turn back';
  /* inspect the second pocket by clicking it */
  await page.mouse.click(pp.x, pp.y); await until(() => __lt.secret.S.inspect.active(), 'inspect'); await W(4000); await shot('5-inspect'); const s4 = await state('inspect'); if (!s4.insp) fail = fail || 'click did not inspect';
  /* Move it: then click the empty pocket on the right page */
  await fr.click('#skActs [data-id="swap"]'); await until(() => !__lt.secret.S.inspect.active() && !!__lt.secret.S.binder.pending(), 'pending swap'); await W(2500);
  const ep = await ev(() => { const S = __lt.secret.S, pk = S.binder.pockets().find(p => !p.id && p.page === 1), p = pk.group.getWorldPosition(new S.THREE.Vector3()); p.y += 0.05; p.project(S.camera); const r = S.ctx.canvas.getBoundingClientRect(), f = window.frameElement ? window.frameElement.getBoundingClientRect() : { left: 0, top: 0 }; return { x: f.left + r.left + (p.x + 1) / 2 * r.width, y: f.top + r.top + (1 - p.y) / 2 * r.height, slot: pk.slot }; });
  await page.mouse.move(ep.x, ep.y); await W(300); await shot('6-pending');
  await page.mouse.click(ep.x, ep.y); await W(1200); await shot('7-flying'); await settled(); await W(1000); await shot('8-moved'); const s5 = await state('moved');
  const pages = JSON.parse(s5.binder); if (pages[0][1] !== null || !pages[1] || !pages[1][ep.slot]) fail = fail || 'swap did not update the store';
  /* Onto the table */
  const p0 = await ev(() => { const S = __lt.secret.S, p = S.binder.pockets()[0].group.getWorldPosition(new S.THREE.Vector3()); p.y += 0.05; p.project(S.camera); const r = S.ctx.canvas.getBoundingClientRect(), f = window.frameElement ? window.frameElement.getBoundingClientRect() : { left: 0, top: 0 }; return { x: f.left + r.left + (p.x + 1) / 2 * r.width, y: f.top + r.top + (1 - p.y) / 2 * r.height }; });
  await page.mouse.click(p0.x, p0.y); await until(() => __lt.secret.S.inspect.active(), 'inspect 2'); await W(3000); await fr.click('#skActs [data-id="table"]'); await until(() => __lt.secret.S.table.list.length === 1, 'slab on table'); await W(4500); await shot('9-table'); const s6 = await state('table');
  if (s6.table !== 1) fail = fail || 'slab did not reach the table';
  /* close: cover shuts, binder dissolves, idle */
  await ev(() => __lt.secret.S.M.send('CLOSE')); await W(2500); await shot('10-closing'); await until(() => __lt.secret.S.M.state === 'idle', 'idle at the end'); await W(1500); await shot('11-idle'); const s7 = await state('closed');
  if (s7.state !== 'idle') fail = fail || 'did not close to idle';
  const vis = await ev(() => __lt.secret.S.binder.mesh().visible); console.log('  binder visible after close:', vis);
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'binder: FAIL ' + fail : 'binder: OK'); process.exit(fail || errors.length ? 1 : 0);
