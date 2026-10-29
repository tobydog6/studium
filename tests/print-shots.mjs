// Secret raw prints: lays a portrait, a landscape and a misprint variant on the table as raw prints (print.js), waits
// for them to build, screenshots, then turns one face down with its hover glow on and screenshots again.
// Needs `node build.mjs --web`. Shots: tests/out/print-*.png
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
const shot = async (n) => { await hideHub(); await page.waitForTimeout(150); return page.screenshot({ path: join(OUT, `print-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
const W = (ms) => page.waitForTimeout(ms);
const until = (fn, label, ms = 240000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 300 }).catch(() => { throw new Error('timed out waiting for ' + label); });
let fail = '', fr;
const ev = (fn) => fr.evaluate(fn);
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await W(8000);
  await page.evaluate(() => { const si = document.getElementById('signin'); if (si) si.style.display = 'none'; __cb.stOpen('table'); const hub = document.getElementById('hub'); if (hub) hub.classList.add('hidden'); });
  await page.waitForFunction(() => { const f = __cb.lt(); return f && f.contentWindow && f.contentWindow.__lt && f.contentWindow.document.body.classList.contains('ready'); }, null, { timeout: 360000, polling: 500 });
  fr = page.frames().find((f) => f.url() === 'about:srcdoc');
  await W(2000);
  await ev(() => { if (__lt.TOUR.on) __lt.tourEnd(false); });
  await hideHub();
  await ev(() => __lt.secret.S.ctx.canvas.focus());
  await page.keyboard.press('='); await W(500); await page.keyboard.type('secret'); await page.keyboard.press('Enter'); await W(1500);
  const un = await ev(() => __lt.secret.S.unlocked()); if (!un) fail = 'did not unlock';
  await ev(() => __lt.secret.S.T.setTimeScale(3));
  /* a test pack with one portrait and one landscape photo, so both sheet shapes show; three raw prints in a row */
  const info = await ev(() => { const S = __lt.secret.S; S.store.reset(); S.store.get().unlocked = true; S.store.save(); S.table.list.slice().forEach(o => S.table.remove(o, true));
    const mk = (w, h, col, tag) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, col); gr.addColorStop(1, '#1a1612'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#f4e9d2'; g.beginPath(); g.arc(w * 0.62, h * 0.38, Math.min(w, h) * 0.18, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '700 ' + Math.round(h * 0.14) + 'px sans-serif'; g.fillText(tag, w * 0.08, h * 0.88); return cv.toDataURL('image/jpeg', 0.85); };
    const pack = { id: 'test', name: 'Test pack', imgs: [{ id: 'p', url: mk(600, 900, '#7a8f6e', 'PORTRAIT') }, { id: 'l', url: mk(900, 600, '#c58b52', 'LANDSCAPE') }] };
    S.SL.setPhotoSource(() => [pack]);
    const want = (img, o) => { for (let seed = 1; seed < 400; seed++) { const s = S.SL.roll({ graded: false, pack: 'test', seed, ...o }); if (s.photo.imgId === img) return s; } return S.SL.roll({ graded: false, pack: 'test', ...o }); };
    const rows = [[want('p', { tier: 'rare' }), -3.6, 1.2, 0.08], [want('l', { tier: 'legendary' }), 0.3, 1.0, -0.05], [want('p', { tier: 'epic', variant: 'misprint' }), 4.0, 1.3, 0.12]];
    rows.forEach(([s]) => S.store.addPull(s)); const objs = rows.map(([s, x, z, yaw]) => S.table.place(s, x, z, yaw, { quiet: true }));
    window.__prints = objs; S.hud(); return objs.map(o => ({ id: o.slab.id, tier: o.slab.tier, variant: o.slab.variant, img: o.slab.photo.imgId, th: o.th, isPrint: !!o.setGlow })); });
  console.log('  placed:', JSON.stringify(info));
  if (!info.every(i => i.isPrint)) fail = 'table did not get print objects';
  await until(() => window.__prints.every(o => o.built && o.finish), 'prints to build');
  const dims = await ev(() => window.__prints.map(o => ({ w: +o.w.toFixed(2), h: +o.h.toFixed(2), land: o.land, finish: o.finish.id, mesh: !!o.finish.mesh, parts: Object.keys(o.parts).join(',') })));
  console.log('  built:', JSON.stringify(dims));
  if (dims[0].land || !dims[1].land) fail = fail || 'sheet shapes wrong';
  await W(2500); await shot('1-table');
  /* turn the landscape one face down: a further PI about the group's own Y, and the hover rim on */
  await ev(() => { const S = __lt.secret.S, o = window.__prints[1]; o.group.quaternion.multiply(new S.THREE.Quaternion().setFromAxisAngle(new S.THREE.Vector3(0, 1, 0), Math.PI)); o.setGlow(1); window.__prints[2].setGlow(0.6); });
  await W(2500); await shot('2-facedown-glow');
  const gl = await ev(() => { const o = window.__prints[1]; return { visible: o.parts.halo.visible, opacity: +o.parts.halo.material.opacity.toFixed(2) }; }); console.log('  glow:', JSON.stringify(gl));
  if (!gl.visible || gl.opacity <= 0) fail = fail || 'glow did not show';
  await ev(() => { window.__prints.forEach(o => o.setGlow(0)); });
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'print: FAIL ' + fail : 'print: OK'); process.exit(fail || errors.length ? 1 : 0);
