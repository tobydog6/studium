// Holo: rolls a raw print onto the table, frames it close, and screenshots the tier landings mid-effect (epic,
// legendary, mythic) and the edge-on burst of the flip. Needs `node build.mjs --web`. Shots: tests/out/holo-*.png
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
page.on('console', (m) => { if (m.type() === 'error' && !/supabase|net::ERR|Failed to load resource|scan never finished/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 600)); });
const hideHub = () => page.evaluate(() => { ['hub', 'signin', 'launch', 'rackin'].forEach((id) => { const e = document.getElementById(id); if (e) { e.classList.add('hidden'); e.style.display = 'none'; } }); });
const W = (ms) => page.waitForTimeout(ms);
let fail = '', fr;
const ev = (fn, arg) => fr.evaluate(fn, arg);
const until = (fn, label, ms = 240000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 250 }).catch(() => { throw new Error('timed out waiting for ' + label); });
/* freeze the holo clock, shoot, run it again: the headless GPU takes seconds per screenshot */
const shot = async (n) => { await hideHub(); await ev(() => __lt.secret.S.T.setTimeScale(0)); await W(150); await page.screenshot({ path: join(OUT, `holo-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); await ev(() => __lt.secret.S.T.setTimeScale(3)); };
const now = () => ev(() => { const n = __lt.secret.S.holo.now; return n ? { kind: n.kind, tier: n.tier, t: +n.t.toFixed(2) } : null; });
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
  await ev(() => { const S = __lt.secret.S; S.store.reset(); S.store.get().unlocked = true; S.store.save(); S.hud(); S.T.setTimeScale(3); });
  const api = await ev(() => { const H = __lt.secret.S.holo; return H ? Object.keys(H).filter(k => typeof H[k] === 'function') : null; }); console.log('  S.holo:', api);
  if (!api || !['glowOf', 'burst', 'reveal'].every(k => api.includes(k))) fail = fail || 'S.holo is missing glowOf/burst/reveal';
  const glows = await ev(() => { const S = __lt.secret.S; return ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].map(t => { const s = S.SL.roll({ tier: t, variant: null }); const g = S.holo.glowOf(s); return t + ':' + g.finish + '/' + g.kind + '/#' + g.color.getHexString(); }).concat(['negative', 'misprint', 'stamped'].map(v => { const s = S.SL.roll({ variant: v }); const g = S.holo.glowOf(s); return v + ':' + g.kind + '/#' + g.color.getHexString(); })); }); console.log('  glows:', glows.join('  '));
  /* one raw print on the table, framed close; the camera snaps there (its own smoothing would take many headless frames) */
  const roll = async (tier) => { await ev((tier) => { const S = __lt.secret.S; S.table.list.slice().forEach(o => S.table.remove(o, true)); S.rollToTable({ graded: false, tier }); }, tier);
    await until(() => { const S = __lt.secret.S, o = S.table.list[0]; return o && o.built && !S.T.running(); }, tier + ' print built');
    await ev(() => { const S = __lt.secret.S, o = S.table.list[0], p = o.group.position, c = S.ctx.cam; const t = { tx: p.x, ty: 0, tz: p.z + 0.4, pitch: 58, dT: S.cam.fit(9, 7) }; S.cam.set(t); c.cx = t.tx; c.cy = t.ty; c.cz = t.tz; c.d = t.dT; c.curPitch = t.pitch; }); await W(1200); };
  const during = (tag, tAt) => until((tAt) => { const n = __lt.secret.S.holo.now; return n && n.t >= tAt; }, tag + ' at ' + tAt + 's');
  const landing = async (tier, shots) => { await roll(tier); await ev((tier) => { const S = __lt.secret.S; S.holoDone = false; S.holo.reveal(S.table.list[0], { tier }).then(() => { S.holoDone = true; }); }, tier);
    const probe = await ev(() => { const S = __lt.secret.S, n = S.holo.now; if (!n || !n.rig) return null; const B = new S.THREE.Box3(); return n.rig.fx.children.map(c => { B.setFromObject(c); const sz = B.getSize(new S.THREE.Vector3()); return c.type + '/' + (c.geometry ? c.geometry.type : '') + ' ro' + c.renderOrder + ' ' + [sz.x, sz.y, sz.z].map(v => v.toFixed(2)).join('x'); }); }); console.log('  ' + tier + ' fx:', JSON.stringify(probe));
    for (const [tag, tAt] of shots) { await fr.waitForFunction((tAt) => { const n = __lt.secret.S.holo.now; return n && n.t >= tAt; }, tAt, { timeout: 240000, polling: 200 }).catch(() => { throw new Error('timed out waiting for ' + tier + ' at ' + tAt + 's'); }); console.log('  ' + tier + ' shot ' + tag, JSON.stringify(await now())); await shot(tier + '-' + tag); }
    await until(() => __lt.secret.S.holoDone === true, tier + ' reveal to finish'); const left = await ev(() => { const S = __lt.secret.S; return { now: !!S.holo.now, running: S.T.running('holo'), scale: S.T.timeScale(), kids: S.scene.children.length, camKids: S.camera.children.length }; }); console.log('  ' + tier + ' done:', JSON.stringify(left));
    if (left.now || left.running) fail = fail || tier + ' left effects running'; if (left.scale !== 3) fail = fail || tier + ' did not restore the time scale (' + left.scale + ')'; };
  await landing('epic', [['burst', 0.6], ['flood', 1.3]]);
  await landing('legendary', [['slowmo', 0.8], ['slam', 1.95]]);
  await landing('mythic', [['corona', 1.9], ['stamp', 2.7]]);
  /* the burst: the print turned edge-on, as it is mid-flip */
  await ev(() => { const S = __lt.secret.S, o = S.table.list[0], g = o.group; g.userData.q0 = g.quaternion.clone(); g.quaternion.multiply(new S.THREE.Quaternion().setFromAxisAngle(new S.THREE.Vector3(0, 1, 0), Math.PI / 2)); g.position.y += o.w * 0.5; S.holoDone = false; S.holo.burst(o, { dim: 0.6 }).then(() => { S.holoDone = true; }); });
  await fr.waitForFunction(() => { const n = __lt.secret.S.holo.now; return n && n.kind === 'burst' && n.t >= 0.1; }, null, { timeout: 120000, polling: 100 }).catch(() => { throw new Error('timed out waiting for the burst'); }); console.log('  burst', JSON.stringify(await now())); await shot('burst');
  await until(() => __lt.secret.S.holoDone === true, 'burst to finish');
  const nowAfter = await ev(() => !!__lt.secret.S.holo.now); if (nowAfter) fail = fail || 'burst left effects running';
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'holo: FAIL ' + fail : 'holo: OK'); process.exit(fail || errors.length ? 1 : 0);
