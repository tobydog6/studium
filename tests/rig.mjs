// The computer on the dark side (rig.js): the parked car, the transform held at steps (node tests/rig.mjs 0.2,0.6,1),
// or the whole flow (node tests/rig.mjs - flow): drive, screen, projector, back home. Needs --web build. Shots: tests/out/rig-*.png
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


const shot = async (n) => { await hideHub(); return page.screenshot({ path: join(OUT, `rig-${n}.png`), timeout: 120000 }).catch(() => {}); };
const W = (ms) => page.waitForTimeout(ms);
let fail = '', fr;
const ev = (fn, a) => fr.evaluate(fn, a);
const until = (fn, label, ms = 240000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 200 }).catch(() => { throw new Error('timed out waiting for ' + label); });
const t0 = Date.now();
const S_ = (fn, a) => ev(fn, a);
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await W(8000);
  await page.evaluate(() => { const si = document.getElementById('signin'); if (si) si.style.display = 'none'; __cb.stOpen('table'); const hub = document.getElementById('hub'); if (hub) hub.classList.add('hidden'); });
  await page.waitForFunction(() => { const f = __cb.lt(); return f && f.contentWindow && f.contentWindow.__lt && f.contentWindow.document.body.classList.contains('ready'); }, null, { timeout: 120000, polling: 500 });
  fr = page.frames().find((f) => f.url() === 'about:srcdoc'); await W(2000);
  await ev(() => { if (__lt.TOUR.on) __lt.tourEnd(false); }); await hideHub();
  for (let k = 0; k < 4 && !(await ev(() => __lt.secret.S.unlocked())); k++) { await W(2000); await ev(() => __lt.secret.S.ctx.canvas.focus()); await page.keyboard.press('='); await W(800); await page.keyboard.type('secret'); await page.keyboard.press('Enter'); await W(2000); }
  if (!(await ev(() => __lt.secret.S.unlocked()))) throw new Error('did not unlock');
  await ev(() => { const S = __lt.secret.S; S.T.setTimeScale(3); S.under.flip('under'); });
  await until(() => __lt.secret.S.M.is('under'), 'the dark side');
  await ev(() => { const S = __lt.secret.S; S.T.setTimeScale(1); const c = S.ctx.cam; c.tx = 0; c.tz = 0; c.pitch = 38; c.dT = 36; c.yaw = 0; }); await W(2500); await shot('0-parked');
  const STEPS = (process.argv[2] || '0.1,0.3,0.5,0.7,0.9,1').split(',').map(Number);
  if (process.argv[3] !== 'flow') { const close = process.argv[3] === 'car', closeM = process.argv[3] === 'mech';
    await ev(() => { const S = __lt.secret.S, c = S.ctx.cam, w = S.under.group.localToWorld(new S.THREE.Vector3(0, 0, -5.5)); c.tx = w.x; c.tz = w.z; c.ty = 1.8; c.pitch = 20; c.dT = 22; c.yaw = 0.4; });
    if (close) await ev(() => { const S = __lt.secret.S, c = S.ctx.cam, w = S.under.group.localToWorld(new S.THREE.Vector3(1, 0, -3.9)); c.tx = w.x; c.tz = w.z; c.ty = 0.7; c.pitch = 28; c.dT = 11; c.yaw = 0.5; });
    if (closeM) await ev(() => { const S = __lt.secret.S, c = S.ctx.cam, w = S.under.group.localToWorld(new S.THREE.Vector3(0, 2.6, -8.3)); c.tx = w.x; c.tz = w.z; c.ty = w.y; c.pitch = 10; c.dT = 17; c.yaw = 0.7; });
    for (const t of STEPS) { await ev((t) => { const S = __lt.secret.S; S.rig.__car(t); S.rig.__mech(t); S.rig.__link(t >= 1 ? 1 : 0); }, t); await W(1800); await shot('t' + t); }
    await ev(() => { const S = __lt.secret.S; S.rig.__home(); });
  } else {
    await ev(() => { const S = __lt.secret.S; S.store.get().coins = 5000; S.store.save(); S.T.setTimeScale(3); S.rig.go(); });
    for (let k = 0; k < 6; k++) { await W(4000); console.log('  ', JSON.stringify(await ev(() => { const S = __lt.secret.S; return { m: S.M.state, t: +S.T.time().toFixed(1) }; }))); }
    await shot('1-driving');
    await until(() => __lt.secret.S.M.is('pc.view'), 'the computer', 600000); await ev(() => __lt.secret.S.T.setTimeScale(1)); await W(3000); await shot('2-screen');
    await ev(() => { const b = document.querySelector('#skMarket tr[data-k="stock"]'); if (b) b.click(); }); await W(1200);
    await ev(() => { const b = document.querySelector('#skMarket [data-a="inspectsel"]') || document.querySelector('#skMarket [data-a="inspect"]'); if (b) b.click(); });
    await W(2500); await shot('3-beam'); await until(() => { const S = __lt.secret.S; return S.rig.projecting() && !S.T.running('pj'); }, 'the card', 400000); await W(800); await shot('4-card');
    await ev(() => __lt.secret.S.M.send('CLOSE')); await until(() => !__lt.secret.S.rig.projecting(), 'the card going back', 400000); await W(800); await shot('5-back');
    await ev(() => { const S = __lt.secret.S; S.T.setTimeScale(3); S.M.send('CLOSE'); }); await W(3000); await shot('6-closing'); await until(() => __lt.secret.S.M.is('under'), 'home again', 300000); await W(1500); await shot('7-home');
  }
} catch (e) { fail = e.message; }
console.log(errors.length ? errors.join('\n') : 'no page errors', fail ? '\nFAIL ' + fail : '', ((Date.now() - t0) / 1000).toFixed(0) + 's');
await browser.close(); server.close(); process.exit(errors.length || fail ? 1 : 0);
