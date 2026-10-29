// The depth finishes (secret/fxfinishes.js) in the real light table: unlock, lay one graded slab and one raw print on the
// table with the finish under test (dev panel test finish), inspect the slab with the pointer over it, screenshot both.
// Needs `node build.mjs --web`. Shots: tests/out/fx-<finish>-table.png and -inspect.png. Read them.
//   node tests/fx-shots.mjs gold,rain,coin          some finishes (default: all of them)
//   node tests/fx-shots.mjs gold --variant breakout  with a variant on both
//   node tests/fx-shots.mjs gold --tools             also the loupe, UV torch and composition on the inspected slab
//   node tests/fx-shots.mjs gold --bin               also Bin it on the slab and the print (shatter, sand)
//   --ai <ort dir> <model.onnx>                      AI depth from local copies of onnxruntime-web and the model
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(ROOT, 'dist', 'web'), OUT = join(ROOT, 'tests', 'out');
mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2), flag = k => argv.includes(k), val = k => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : null; };
const ALL = 'gold,gilt,dag,bronze,porcelain,kintsugi,litho,crystal,focus,fireflies,depthscan,window,anaglyph,sun,rain,snow,mist,sunken,lava,aurora,seasons,puddles,storm,fireworks,lightpaint,holoplate,chrome,planet,droste,blackhole,polaroid,tray,burn,kaleido,riso,terminal,aero,coin,pyro,jade,vertigo,tiltshift,camcorder,lensball,scan3d';
const LIST = (argv[0] && !argv[0].startsWith('--') ? argv[0] : ALL).split(','), VARIANT = val('--variant'), AI = flag('--ai') ? [val('--ai'), argv[argv.indexOf('--ai') + 2]] : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  if (u.startsWith('/fxphotos/')) { const f = join(ROOT, 'assets', u.slice(10)); if (!existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': 'image/jpeg' }); createReadStream(f).pipe(r); return; }
  const f = join(WEB, u.replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise(ok => server.listen(0, ok));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1060, height: 680 } });
/* real photos for the pulls: a test pack of stump frames served below as /fxphotos/ */
const PHOTOS = ['coach/ap-3.jpg', 'research/sample-6.jpg', 'coach/ap-0.jpg', 'launch/rack-stump.jpg'];
await page.addInitScript(list => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('lt_tour_done', '1'); localStorage.removeItem('studium_secret_v1');
    localStorage.setItem('studium_rs', JSON.stringify([{ id: 'fxtest', name: 'Stump · test', imgs: list.map((u, i) => ({ id: i + 1, url: '/fxphotos/' + u })) }])); } catch (e) {}
  const kill = () => { ['rackin', 'launch'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); };
  const arm = () => { try { if (window === window.top && document.documentElement) new MutationObserver(kill).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {} };
  if (document.documentElement) arm(); else document.addEventListener('DOMContentLoaded', arm); }, PHOTOS);
if (AI) { await page.route('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/**', r => { const f = join(AI[0], r.request().url().split('/dist/')[1]); r.fulfill({ path: f, contentType: f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }); });
  await page.route('https://huggingface.co/**', r => r.fulfill({ path: AI[1], contentType: 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } })); }
else await page.route(/huggingface\.co|cdn\.jsdelivr\.net/, r => r.abort());
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ').slice(0, 300)));
page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/supabase|net::ERR|Failed to load resource|scan never finished/i.test(t)) errors.push('console: ' + t.slice(0, 300)); if (/AI depth|scan slab/.test(t)) console.log('  [page] ' + t.slice(0, 200)); });
const hideHub = () => page.evaluate(() => { ['hub', 'signin', 'launch'].forEach(id => { const e = document.getElementById(id); if (e) { e.classList.add('hidden'); e.style.display = 'none'; } }); });
const shot = async n => { await hideHub(); await page.waitForTimeout(200); return page.screenshot({ path: join(OUT, `fx-${n}.png`), timeout: 180000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
let fail = '';
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`);
  await page.waitForFunction(() => typeof __cb !== 'undefined' && __cb.addPhoto, null, { timeout: 180000, polling: 500 }); await page.waitForTimeout(1000);
  await page.evaluate(() => { const si = document.getElementById('signin'); if (si) si.style.display = 'none'; __cb.stOpen('table'); const hub = document.getElementById('hub'); if (hub) hub.classList.add('hidden'); });
  await page.waitForFunction(() => { const f = __cb.lt(); return f && f.contentWindow && f.contentWindow.__lt && f.contentWindow.document.body.classList.contains('ready'); }, null, { timeout: 120000, polling: 500 });
  const fr = page.frames().find(f => f.url() === 'about:srcdoc'); await page.waitForTimeout(1500);
  await fr.evaluate(() => { if (__lt.TOUR.on) __lt.tourEnd(false); }); await hideHub();
  await fr.evaluate(() => __lt.secret.S.ctx.canvas.focus()); await page.keyboard.press('='); await page.waitForTimeout(800);
  await fr.evaluate(() => { const i = document.getElementById('skIn'); i.value = 'secret'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }); await page.waitForTimeout(1500);
  if (!(await fr.evaluate(() => __lt.secret.S.unlocked()))) { console.log('  state:', await fr.evaluate(() => { const s = __lt.secret; return s ? JSON.stringify({ st: s.S && s.S.M.state, box: !!document.querySelector('#sk.on') }) : 'no secret'; })); console.error(errors.join('\n')); throw new Error('did not unlock'); }
  await fr.evaluate(ai => { const S = __lt.secret.S; S.dev.set('depth', ai ? 'ai' : 'quick'); S.T.setTimeScale(1); }, !!AI);
  /* the slabs live on the dark side: flip the table over */
  await fr.evaluate(() => __lt.secret.S.under.flip('under')); await fr.waitForFunction(() => __lt.secret.S.M.is('under'), null, { timeout: 60000, polling: 300 }); await page.waitForTimeout(800);
  for (const id of LIST) {
    const t0 = Date.now();
    const ok = await fr.evaluate(({ id, v }) => { const S = __lt.secret.S; S.table.list.slice().forEach(o => S.table.remove(o)); S.dev.set('finish', id);
      const tier = (S.fx.META[id] || {}).tier || 'rare';
      const n = S.table.list.length; window.__fxN = (window.__fxN || 0) + 1; const pk = { pack: 'fxtest' };
      [true, false].forEach((g, i) => { const slab = S.SL.roll({ tier, finish: id, variant: v || null, graded: g, ...pk }); S.store.addPull(slab); S.table.place(slab, i ? 2.4 : -2.2, 8.6, 0); });
      S.cam.set({ tx: 0, tz: 8.6, dT: 9.5 }); return S.table.list.length; }, { id, v: VARIANT });
    /* wait for both finishes to land (depth, then the build queue) */
    await fr.waitForFunction(() => __lt.secret.S.table.list.every(o => o.built && o.finish && (o.finish.mesh || !__lt.secret.S.fx.isFx(o.finishId))), null, { timeout: 120000, polling: 300 }).catch(() => console.log('  ' + id + ': finish did not land in time'));
    await page.waitForTimeout(1500); await shot(id + '-table');
    await fr.evaluate(() => { const S = __lt.secret.S, o = S.table.list.find(o => o.slab.graded) || S.table.list[0]; S.inspect.open(o, { actions: [{ id: 'back', label: 'Put back', primary: true }], hint: S.specLine(o.slab) }); });
    await fr.waitForFunction(() => __lt.secret.S.inspect.t > 0.97, null, { timeout: 60000, polling: 200 }).catch(() => {}); await page.mouse.move(530, 300); await page.waitForTimeout(1600); await shot(id + '-inspect');
    if (flag('--tools')) for (const t of ['loupe', 'uv', 'compose']) { await page.click('#skTools [data-tool="' + t + '"]').catch(() => {}); await page.mouse.move(560, 320); await page.waitForTimeout(1800); await shot(id + '-tool-' + t); }
    const spec = await fr.evaluate(() => __lt.secret.S.specLine(__lt.secret.S.inspect.obj.slab));
    await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
    if (flag('--bin')) { await fr.evaluate(() => { const S = __lt.secret.S; S.table.list.slice().forEach(o => S.binSlab(o)); }); await page.waitForTimeout(700); await shot(id + '-bin'); await page.waitForTimeout(2500); }
    console.log('  ' + id + ': ' + spec + '  (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  }
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (errors.length) console.error(errors.slice(0, 20).join('\n'));
console.log(fail || errors.length ? 'fx: FAIL ' + fail : 'fx: OK'); process.exit(fail || errors.length ? 1 : 0);
