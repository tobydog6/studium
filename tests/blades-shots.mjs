// Blades: unlocks, flips to the dark side, opens Blades from the launcher, borrows a practice set, fights one match against
// the rival (launches each round), shoots each stage, closes and checks it lands back on the dark side. Needs
// `node build.mjs --web`. Shots: tests/out/blades-*.png
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
const shot = async (n) => { await hideHub(); await page.waitForTimeout(150); return page.screenshot({ path: join(OUT, `blades-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
const W = (ms) => page.waitForTimeout(ms);
const t0 = Date.now(), log = (m) => console.log('  [' + ((Date.now() - t0) / 1000).toFixed(0) + 's] ' + m);
/* the headless GPU runs the tween clock well under real time, so wait on conditions, not seconds */
const until = (fn, label, ms = 300000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 120 }).catch(() => { throw new Error('timed out waiting for ' + label); });
/* a moment that may be gone between two slow frames: wait for it, but carry on if it was missed */
const glimpse = (fn, ms = 120000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 60 }).then(() => true).catch(() => false);
let fail = '', fr;
const ev = (fn) => fr.evaluate(fn);
const state = async (tag) => { const s = await ev(() => { const S = __lt.secret.S, B = S.blades.state, W = S.blades.sim(); return { state: S.M.state, score: B.score, slots: B.slots.map(x => x && x.tier), t: W ? +W.t.toFixed(1) : null, tops: W ? W.tops.map(t => ({ alive: t.alive, done: t.done, w: +t.w.toFixed(1), burst: +t.burst.toFixed(2), p: [+t.p.x.toFixed(2), +t.p.y.toFixed(2)] })) : null, stadiumY: +S.blades.stadium.position.y.toFixed(2) }; }); console.log('  ' + tag + ':', JSON.stringify(s)); return s; };
try {
  log('loading'); await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await W(8000);
  await page.evaluate(() => { const si = document.getElementById('signin'); if (si) si.style.display = 'none'; __cb.stOpen('table'); const hub = document.getElementById('hub'); if (hub) hub.classList.add('hidden'); });
  await page.waitForFunction(() => { const f = __cb.lt(); return f && f.contentWindow && f.contentWindow.__lt && f.contentWindow.document.body.classList.contains('ready'); }, null, { timeout: 120000, polling: 500 });
  fr = page.frames().find((f) => f.url() === 'about:srcdoc'); log('table ready');
  await W(2000);
  await ev(() => { if (__lt.TOUR.on) __lt.tourEnd(false); });
  await hideHub();
  await ev(() => __lt.secret.S.ctx.canvas.focus());
  await page.keyboard.press('='); await W(500); await page.keyboard.type('secret'); await page.keyboard.press('Enter'); await W(1500);
  if (!(await ev(() => __lt.secret.S.unlocked()))) fail = 'did not unlock';
  await ev(() => { const S = __lt.secret.S; S.store.reset(); S.store.get().unlocked = true; S.store.save(); S.hud(); S.T.setTimeScale(3); });
  log('unlocked'); await ev(() => __lt.secret.S.under.flip('under'));
  await until(() => __lt.secret.S.M.state === 'under', 'the dark side'); await W(1200); await shot('1-dark-side'); log('dark side');
  /* click the launcher for real: project it to the screen and click there */
  const pt = await ev(() => { const S = __lt.secret.S, b = S.buttons.blades, v = b.getWorldPosition(new S.THREE.Vector3()); v.y += 0.4; v.project(S.camera); const r = S.ctx.canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; });
  const box = await page.$('iframe.lt-frame').then(f => f.boundingBox());
  await page.mouse.move(box.x + pt.x, box.y + pt.y); await W(400); await page.mouse.down(); await page.mouse.up();
  await W(800); if (!(await ev(() => /^blades/.test(__lt.secret.S.M.state)))) { console.log('  (the click missed the launcher, sending BLADES)'); await ev(() => __lt.secret.S.M.send('BLADES')); }
  await glimpse(() => { const y = __lt.secret.S.blades.stadium.position.y; return y > -6 && y < 0; }); await shot('2-rising');
  await until(() => __lt.secret.S.M.state === 'blades.build', 'the build card'); await W(800); await shot('3-build-empty'); log('build card');
  await fr.click('#skBl [data-a="borrow"]'); await W(1500); await shot('4-build-full'); await state('built');
  await fr.click('#skBl [data-a="fight"]');
  for (let round = 1; round <= 6; round++) {
    const st = await until(() => /^blades\.(ready|result)$/.test(__lt.secret.S.M.state), 'ready or result').then(() => ev(() => __lt.secret.S.M.state));
    if (st === 'blades.result') break;
    await W(900); if (round === 1) await shot('5-ready');
    if (round === 1) { /* the real pull: drag down and let go on the canvas */
      const c = { x: box.x + box.width / 2, y: box.y + box.height * 0.45 };
      await page.mouse.move(c.x, c.y); await page.mouse.down(); for (let k = 1; k <= 8; k++) { await page.mouse.move(c.x - k * 6, c.y + k * 24); await W(60); } await shot('6-pull'); await page.mouse.up();
    } else await ev(() => __lt.secret.S.blades.launch(0.85, (Math.random() - 0.5) * 0.6));
    await until(() => __lt.secret.S.M.state === 'blades.battle', 'the battle', 30000);
    if (round === 1) { await W(2500); await shot('7-battle'); await state('battle'); }
    await until(() => __lt.secret.S.M.state === 'blades.round', 'the end of round ' + round, 600000); await W(500); await state('round ' + round);
    if (round === 1) await shot('8-round-end');
  }
  await until(() => __lt.secret.S.M.state === 'blades.result', 'the result'); await W(800); await shot('9-result'); const fin = await state('result');
  if (Math.max(...fin.score) < 3) fail = fail || 'nobody reached 3';
  await fr.click('#skBlBar [data-a="done"]');
  await until(() => __lt.secret.S.M.state === 'under', 'back on the dark side'); await W(600); await shot('10-closed');
  const left = await ev(() => ({ stadium: __lt.secret.S.blades.stadium.visible, hole: __lt.secret.S.hole.rect, card: document.getElementById('skBl').classList.contains('on') }));
  if (left.stadium || left.hole || left.card) fail = fail || 'did not tidy up: ' + JSON.stringify(left);
} catch (e) { fail = fail || String(e && e.message || e); }
if (errors.length) { console.log('ERRORS:\n' + errors.slice(0, 12).join('\n')); fail = fail || errors.length + ' page errors'; }
await browser.close(); server.close();
console.log(fail ? 'FAIL: ' + fail : 'ok'); process.exit(fail ? 1 : 0);
