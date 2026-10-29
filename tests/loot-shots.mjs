// Secret loot: unlocks, puts the copy stand up, sends LOOT, shoots the blind mid-roll and the pedestals up, picks the
// middle canister (the pop), waits for the result bar, closes, checks idle. Needs `node build.mjs --web`. Shots: tests/out/loot-*.png
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
const shot = async (n) => { await hideHub(); await page.waitForTimeout(150); return page.screenshot({ path: join(OUT, `loot-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
const W = (ms) => page.waitForTimeout(ms);
/* the headless GPU runs the tween clock well under real time, so wait on conditions, not seconds */
const until = (fn, label, ms = 300000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 120 }).catch(() => { throw new Error('timed out waiting for ' + label); });
/* a moment that may be gone between two slow frames: wait for it, but carry on if it was missed */
const glimpse = (fn, ms = 120000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 60 }).then(() => true).catch(() => false);
let fail = '', fr;
const ev = (fn) => fr.evaluate(fn);
const state = async (tag) => { const s = await ev(() => { const S = __lt.secret.S, L = S.loot.state; return { state: S.M.state, blind: +L.blind.toFixed(2), hole: S.hole.rect, holeOn: S.ctx.HOLE.uHoleOn.value, lock: S.ctx.STAND.lock, peds: L.peds.map(p => +p.g.position.y.toFixed(1)), table: S.table.list.length, pulls: S.store.get().pulls.length, bar: document.getElementById('skLoot').classList.contains('on') }; }); console.log('  ' + tag + ':', JSON.stringify(s)); return s; };
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
  /* fresh store, the copy stand up (so the stand camera has to dissolve and come back), then the red button */
  await ev(() => { const S = __lt.secret.S; S.store.reset(); S.store.get().unlocked = true; S.store.save(); S.hud(); S.ctx.setStand(true, true); });
  await W(800);
  await ev(() => __lt.secret.S.M.send('LOOT'));
  const mid = await glimpse(() => { const L = __lt.secret.S.loot.state; return L.blind > 0.2 && L.blind < 0.9; }); console.log('  blind mid-roll caught:', mid);
  await shot('1-blind'); await state('blind');
  await until(() => __lt.secret.S.M.state === 'loot.pick', 'the pedestals (loot.pick)'); await W(1500); await shot('2-pedestals'); const s2 = await state('pedestals');
  if (s2.holeOn !== 1 || !s2.hole) fail = fail || 'the hole did not open';
  if (s2.peds.some(y => y < -0.1)) fail = fail || 'pedestals did not rise: ' + s2.peds;
  /* hover the middle canister, then pick it */
  const cp = await ev(() => { const S = __lt.secret.S, p = S.loot.state.cans[1].group.getWorldPosition(new S.THREE.Vector3()); p.project(S.camera); const r = S.ctx.canvas.getBoundingClientRect(), f = window.frameElement ? window.frameElement.getBoundingClientRect() : { left: 0, top: 0 }; return { x: f.left + r.left + (p.x + 1) / 2 * r.width, y: f.top + r.top + (1 - p.y) / 2 * r.height }; });
  await page.mouse.move(cp.x, cp.y); await W(900); const hot = await ev(() => __lt.secret.S.loot.state.hot); console.log('  hover hot:', hot); if (hot !== 1) fail = fail || 'hover did not light the middle canister (hot ' + hot + ')';
  await shot('3-hover');
  await ev(() => __lt.secret.S.loot.__pick(1));
  const popped = await glimpse(() => { const L = __lt.secret.S.loot.state; return L.cans[1].open > 0.55; }); console.log('  pop caught:', popped);
  await shot('4-pop'); await state('pop');
  await until(() => __lt.secret.S.M.state === 'loot.result', 'the result bar (loot.result)'); await W(2500); await shot('5-result'); const s5 = await state('result');
  if (s5.table !== 1) fail = fail || 'the print did not reach the table'; if (s5.pulls !== 1) fail = fail || 'the pull was not stored'; if (!s5.bar) fail = fail || 'the result bar did not show';
  /* close: the blind rolls back, the camera reforms, idle */
  await ev(() => __lt.secret.S.M.send('CLOSE')); await W(1500); await shot('6-closing');
  await until(() => __lt.secret.S.M.state === 'idle', 'idle at the end'); await W(1500); await shot('7-idle'); const s7 = await state('idle');
  if (s7.state !== 'idle') fail = fail || 'did not close to idle'; if (s7.hole || s7.holeOn !== 0) fail = fail || 'the hole did not close'; if (s7.lock) fail = fail || 'the stand is still locked';
  const aim = await ev(() => __lt.secret.S.ctx.aim.visible); console.log('  stand camera back:', aim); if (!aim) fail = fail || 'the stand camera did not come back';
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'loot: FAIL ' + fail : 'loot: OK'); process.exit(fail || errors.length ? 1 : 0);
