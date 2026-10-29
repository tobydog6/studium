// Secret arm: the copy stand's boom arm driven by S.arm (aside, reachTo, carry, rest) with the stand locked.
// Needs `node build.mjs --web`. Shots: tests/out/arm-*.png. `--down` starts with the stand folded in its kit.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(ROOT, 'dist', 'web'), OUT = join(ROOT, 'tests', 'out');
const DOWN = process.argv.includes('--down');
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
const shot = async (n) => { await hideHub(); await page.waitForTimeout(150); return page.screenshot({ path: join(OUT, `arm-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
const W = (ms) => page.waitForTimeout(ms);
let fail = '', fr;
const ev = (fn, arg) => fr.evaluate(fn, arg);
/* each arm command returns when its tweens finish; the headless GPU is slow, so give them minutes */
const run = (fn, arg) => fr.evaluate(fn, arg, { timeout: 0 });
const state = async (tag) => { const s = await ev(() => { const S = __lt.secret.S, a = S.arm, h = a.hand(), p = a.pose(); return { hand: [h.x, h.y, h.z].map(v => +v.toFixed(2)), pose: [p.yaw, p.a1, p.a2].map(v => +v.toFixed(3)), lock: S.ctx.STAND.lock, up: S.ctx.STAND.up, vis: S.ctx.stand.visible, busy: a.busy() }; }); console.log('  ' + tag + ':', JSON.stringify(s)); return s; };
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await W(8000);
  await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 900; cv.height = 600; const g = cv.getContext('2d'); g.fillStyle = '#7a8f6e'; g.fillRect(0, 0, 900, 600);
    __cb.addPhoto({ url: cv.toDataURL('image/jpeg', 0.8), place: 'Stump', pick: true });
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
  await ev((down) => { const S = __lt.secret.S; S.T.setTimeScale(3); if (!down) __lt.setStand(true, true); S.store.reset(); S.store.get().unlocked = true; S.store.save(); S.hud(); }, DOWN);
  await W(1000);
  const home = await ev(() => { const c = __lt.secret.S.ctx; return [c.yawJ.rotation.y, c.j1.rotation.z, c.j2.rotation.z, c.aim.position.x, c.aim.position.y, c.aim.position.z].map(v => +v.toFixed(4)); });
  console.log('  home:', JSON.stringify(home)); await shot('0-home');
  await ev(() => __lt.secret.S.lockStand(true));
  const ok1 = await run(() => __lt.secret.S.arm.aside()); await W(400); await shot('1-aside'); const s1 = await state('aside'); if (!ok1) fail = fail || 'aside did not finish';
  if (s1.hand[0] < 20) fail = fail || 'aside did not leave the table';
  const ok2 = await run(() => __lt.secret.S.arm.reachTo(new __lt.secret.S.THREE.Vector3(2, 0.5, 2))); await W(400); await shot('2-reach'); const s2 = await state('reach (2, 0.5, 2)'); if (!ok2) fail = fail || 'reachTo did not finish';
  const miss = Math.hypot(s2.hand[0] - 2, s2.hand[1] - 0.5, s2.hand[2] - 2); console.log('  short of (2,0.5,2) by', miss.toFixed(2));
  const ok3 = await run(() => __lt.secret.S.arm.reachTo(new __lt.secret.S.THREE.Vector3(12, 0.5, 1))); await W(300); const s3 = await state('reach (12, 0.5, 1)'); if (!ok3) fail = fail || 'reachTo 2 did not finish';
  if (Math.hypot(s3.hand[0] - 12, s3.hand[1] - 0.5, s3.hand[2] - 1) > 0.05) fail = fail || 'did not reach a point in range';
  /* carry a slab from the near edge to a spot on the table, lying flat at yaw 0.3 */
  const ok4 = await run(() => { const S = __lt.secret.S, o = S.rollToTable({ tier: 'rare' }); S.table.remove(o, true); const obj = S.objFor(o.slab); S.scene.add(obj.group); obj.group.position.set(14, 0.3, 6); obj.group.scale.setScalar(0.42);
    window.__carried = obj; return S.arm.carry(obj, obj.group.position.clone(), new S.THREE.Vector3(15, 0.03, -3), { yaw: 0.3 }); });
  await W(400); await shot('3-carried'); const s4 = await state('carried'); if (!ok4) fail = fail || 'carry did not finish';
  const laid = await ev(() => { const o = window.__carried, g = o.group, S = __lt.secret.S, q = new S.THREE.Quaternion().setFromAxisAngle(new S.THREE.Vector3(0, 1, 0), 0.3).multiply(new S.THREE.Quaternion().setFromAxisAngle(new S.THREE.Vector3(1, 0, 0), -Math.PI / 2)); return { parent: g.parent === S.scene, pos: [g.position.x, g.position.y, g.position.z].map(v => +v.toFixed(3)), dq: +q.angleTo(g.quaternion).toFixed(4) }; });
  console.log('  laid:', JSON.stringify(laid)); if (!laid.parent || laid.dq > 0.001 || Math.hypot(laid.pos[0] - 15, laid.pos[1] - 0.03, laid.pos[2] + 3) > 0.001) fail = fail || 'object did not end flat at `to`';
  const ok5 = await run(() => __lt.secret.S.arm.rest()); await W(400); await shot('4-rest'); const s5 = await state('rest'); if (!ok5) fail = fail || 'rest did not finish';
  const back = await ev(() => { const c = __lt.secret.S.ctx; return [c.yawJ.rotation.y, c.j1.rotation.z, c.j2.rotation.z, c.aim.position.x, c.aim.position.y, c.aim.position.z].map(v => +v.toFixed(4)); });
  console.log('  back:', JSON.stringify(back)); if (back.some((v, i) => Math.abs(v - home[i]) > 0.002)) fail = fail || 'rest did not restore the pose';
  if (!s5.lock) fail = fail || 'rest cleared the lock itself'; if (DOWN && s5.vis) fail = fail || 'the stand did not fold back';
  await ev(() => __lt.secret.S.lockStand(false));
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'arm: FAIL ' + fail : 'arm: OK'); process.exit(fail || errors.length ? 1 : 0);
