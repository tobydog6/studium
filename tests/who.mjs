// Who Shot It on the dark side: test artists, the binder with Select, your five, a round and the guess picker.
// Needs --web build. Shots: tests/out/who-*.png
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


const shot = async (n) => { await hideHub(); return page.screenshot({ path: join(OUT, `who-${n}.png`), timeout: 120000 }).catch(() => {}); };
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
  await fr.evaluate(() => { const b = document.querySelector('#skWho [data-a="teston"]'); __lt.secret.S.whoShot.open(); });
  await W(800); await ev(() => { const b = document.querySelector('[data-a="teston"]'); if (b) b.click(); }); await W(1500);
  await shot('0b-lobby'); console.log('lobby', await ev(() => [__lt.secret.S.M.state, [...document.querySelectorAll('#skWho [data-a]')].map(b => b.dataset.a).join(',')]));
  await ev(() => { const b = document.querySelector('[data-a="play"]'); if (b) b.click(); else __lt.secret.S.whoShot.start(); });
  await W(9000); console.log('state', await ev(() => [__lt.secret.S.M.state, __lt.secret.S.binder.busy(), __lt.secret.S.binder.pockets().length])); await W(2500); await shot('1-binder');
  await ev(() => document.getElementById('skQuick').click()); await W(500); await shot('2-select');
  for (let i = 0; i < 5; i++) { await ev((i) => { const S = __lt.secret.S, pk = S.binder.pockets().filter(p => p.obj && !p.taken)[0]; if (pk) S.binder.__pick(pk); }, i); await W(1400); }
  await until(() => __lt.secret.S.M.is('who.turn'), 'your turn', 120000); await W(2500); await shot('3-turn');
  await ev(() => { const S = __lt.secret.S, g = S.whoShot.__g(); S.M.go('who.send', { h: g.hand[0] }); });
  await until(() => __lt.secret.S.M.is('who.play'), 'the round', 120000); await W(5000); await shot('4-play');
  await until(() => { const g = __lt.secret.S.whoShot.__g(); return g && g.r && g.r.up; }, 'the print up', 60000).catch(() => {});
  await ev(() => { const S = __lt.secret.S; S.ctx.canvas.focus(); }); await page.keyboard.press('g'); await W(1500); await shot('5-guess');
} catch (e) { fail = e.message; }
console.log(errors.length ? errors.join('\n') : 'no page errors'); console.log(fail ? 'FAIL ' + fail : 'OK', ((Date.now() - t0) / 1000).toFixed(0) + 's');
await browser.close(); server.close(); process.exit(fail || errors.length ? 1 : 0);
