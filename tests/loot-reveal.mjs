// Loot through the real flow (loot.js): open loot, pick a canister, the reel, click the card, the close view, OK.
// Logs the state machine and the reveal, and fails on any page error or a step that never comes. Needs --web build.
// node tests/loot-reveal.mjs [tier] [theme]
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


const shot = async (n) => { await hideHub(); return page.screenshot({ path: join(OUT, `loot-${n}.png`), timeout: 120000 }).catch(() => {}); };
const W = (ms) => page.waitForTimeout(ms);
let fail = '', fr;
const ev = (fn, a) => fr.evaluate(fn, a);
const until = (fn, label, ms = 240000) => fr.waitForFunction(fn, null, { timeout: ms, polling: 200 }).catch(() => { throw new Error('timed out waiting for ' + label); });
const TIER = process.argv[2] || 'legendary', THEME = process.argv[3] || 'finish';
const st = () => ev(() => { const S = __lt.secret.S; return { m: S.M.state, rail: S.rail.state().phase, insp: S.inspect.active(), fx: +(S.bloom.level() || 0).toFixed(2) }; });
const t0 = Date.now();
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await W(8000);
  await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 900; cv.height = 600; const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 900, 600); gr.addColorStop(0, '#111'); gr.addColorStop(0.5, '#7a8f6e'); gr.addColorStop(1, '#f4f0e0'); g.fillStyle = gr; g.fillRect(0, 0, 900, 600);
    __cb.addPhoto({ url: cv.toDataURL('image/jpeg', 0.8), place: 'Stump', pick: true }); const si = document.getElementById('signin'); if (si) si.style.display = 'none'; __cb.stOpen('table'); const hub = document.getElementById('hub'); if (hub) hub.classList.add('hidden'); });
  await page.waitForFunction(() => { const f = __cb.lt(); return f && f.contentWindow && f.contentWindow.__lt && f.contentWindow.document.body.classList.contains('ready'); }, null, { timeout: 120000, polling: 500 });
  fr = page.frames().find((f) => f.url() === 'about:srcdoc'); await W(2000);
  await ev(() => { if (__lt.TOUR.on) __lt.tourEnd(false); }); await hideHub();
  for (let k = 0; k < 4 && !(await ev(() => __lt.secret.S.unlocked())); k++) { await W(2000); await ev(() => __lt.secret.S.ctx.canvas.focus()); await page.keyboard.press('='); await W(800); await page.keyboard.type('secret'); await page.keyboard.press('Enter'); await W(2000); }
  if (!(await ev(() => __lt.secret.S.unlocked()))) throw new Error('did not unlock');
  await ev((a) => { const S = __lt.secret.S; S.dev.set('reelLen', 'short'); S.dev.set('revealTheme', a.th); S.dev.set('odds', 'normal'); S.T.setTimeScale(3); window.__tier = a.tier;
    const roll = S.SL.roll; if (!S.SL.__r) { S.SL.__r = roll; } }, { th: THEME, tier: TIER });
  await ev(() => __lt.secret.S.under.flip('under')); await until(() => __lt.secret.S.M.state === 'under', 'the dark side');   /* pulls happen on the dark side */
  console.log('  start', JSON.stringify(await st()));
  await ev(() => __lt.secret.S.M.send('LOOT'));
  await until(() => __lt.secret.S.M.is('loot.pick'), 'loot.pick'); console.log('  pick', JSON.stringify(await st()));
  await ev(() => __lt.secret.S.loot.__pick(1));
  await until(() => __lt.secret.S.rail.state().phase === 'prompt', 'the landed card'); console.log('  prompt', JSON.stringify(await st()));
  await ev(() => __lt.secret.S.T.setTimeScale(1)); await W(1200); await shot('1-prompt');
  const tFlip = Date.now(); await ev(() => __lt.secret.S.rail.__flip());
  for (let i = 0; i < 12; i++) { await W(700); const s = await st(); console.log('  +' + ((Date.now() - tFlip) / 1000).toFixed(1) + 's', JSON.stringify(s)); if (i === 2 || i === 6 || i === 11) await shot('2-after-' + i); if (s.insp) break; }
  await until(() => __lt.secret.S.inspect.active(), 'the close view', 60000);
  await W(2500); await shot('3-inspect'); console.log('  inspect', JSON.stringify(await st()));
  /* OK: it files itself (a slab into the case, a raw print into the binder) and the table stays clear */
  const before = await ev(() => { const d = __lt.secret.S.store.get(); return { vault: d.vault.length, binder: d.binder.flat().filter(Boolean).length, table: __lt.secret.S.table.list.length }; });
  await ev(() => __lt.secret.S.inspect.close('ok'));
  for (let i = 0; i < 30; i++) { await W(4000); const m = await ev(() => { const S = __lt.secret.S; return S.M.state + ' insp:' + S.inspect.active() + ' table:' + S.table.list.length; }); console.log('  after OK', m); if (!/^loot/.test(m)) break; if (i % 3 === 2) console.log('    rail', JSON.stringify(await ev(() => __lt.secret.S.rail.state().phase)), 'closeP', await ev(() => !!__lt.secret.S.loot.state.closeP)); }
  await until(() => !/^loot/.test(__lt.secret.S.M.state), 'the loot to close', 20000);
  const after = await ev(() => { const S = __lt.secret.S, d = S.store.get(), last = d.pulls[d.pulls.length - 1]; return { vault: d.vault.length, binder: d.binder.flat().filter(Boolean).length, table: S.table.list.length, graded: !!last.graded, inVault: d.vault.includes(last.id), inBinder: d.binder.flat().includes(last.id) }; });
  console.log('  filed', JSON.stringify(before), '->', JSON.stringify(after)); await shot('4-filed');
  if (!(after.graded ? after.inVault : after.inBinder)) fail = fail || 'the pull did not file itself';
  if (after.table > before.table) fail = fail || 'the pull was left on the table';
} catch (e) { fail = e.message; }
await browser.close(); server.close();
console.log('  took ' + Math.round((Date.now() - t0) / 1000) + ' s');
if (errors.length) console.error(errors.join('\n'));
if (fail || errors.length) { console.log('loot-reveal: FAIL ' + fail); process.exit(1); } else console.log('loot-reveal: OK');
