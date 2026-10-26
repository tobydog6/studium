// Edit room profiler: opens one frame in Develop, drags real sliders with the mouse for a few seconds and reports
// how the preview keeps up. Not a pass/fail test; it prints numbers to compare before and after a change.
//   node tests/perf-edit.mjs [frame.jpg] [--sliders pExposure,pShadows,pVibrance] [--secs 3] [--html dist/studium-dev.html] [--prof] [--calls]
//     [--sw2d] software 2D canvases  [--mouse] drag with Playwright's mouse instead of in-page ticks  [--settle ms] wait after opening  [--noauto] don't load a scene in the background
// Headless Chromium with SwiftShader, so absolute numbers run slower than a real GPU; compare like with like.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : d; };
const FRAME = argv[0] && !argv[0].startsWith('--') ? resolve(argv[0]) : join(ROOT, 'tests', 'fixtures', 'fr02.jpg');
const HTML = resolve(opt('--html', join(ROOT, 'dist', 'studium-dev.html')));
const SLIDERS = opt('--sliders', 'pExposure,pShadows,pWhites,pVibrance').split(','), SECS = +opt('--secs', 3), PROF = argv.includes('--prof'), MOUSE = argv.includes('--mouse');
const url = 'data:image/jpeg;base64,' + readFileSync(FRAME).toString('base64');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'].concat(argv.includes('--sw2d') ? ['--disable-accelerated-2d-canvas'] : []) });   /* --sw2d: software 2D canvases, so SwiftShader's slow GPU readbacks don't drown everything else */
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_detail', 'test');
  if (!localStorage.getItem('studium_quests_v1')) localStorage.setItem('studium_quests_v1', JSON.stringify({ v: 1, set: 'term1', tracked: 'f1', lastFocusAsk: new Date().toISOString().slice(0, 10), quests: { f1: { started: Date.now(), base: { photos: 0, t: Date.now() }, done: null, stepDone: {} } }, tours: {}, tourStep: {}, flags: {}, rs: { cull: {}, punctum: {}, details: 0 }, first: Date.now() }));
  if (!localStorage.getItem('studium_v1')) localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: '' } })); } catch (e) {} });
if (argv.includes('--calls')) await page.addInitScript(() => { window.__calls = []; const wrap = (P, n) => { const f = P[n]; P[n] = function () { const t = performance.now(), r = f.apply(this, arguments), d = performance.now() - t;
  if (d > 2) __calls.push({ n, d, at: (new Error().stack.split('\n')[2] || '').trim().slice(0, 90), w: this.canvas && this.canvas.width, h: this.canvas && this.canvas.height }); return r; }; };
  wrap(CanvasRenderingContext2D.prototype, 'getImageData'); wrap(CanvasRenderingContext2D.prototype, 'putImageData'); wrap(CanvasRenderingContext2D.prototype, 'drawImage');
  if (window.WebGL2RenderingContext) wrap(WebGL2RenderingContext.prototype, 'getBufferSubData'); });
if (argv.includes('--cpudisplay')) await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { if (this.id === 'editCanvas' && t === '2d') o = Object.assign({}, o, { willReadFrequently: true }); return g.call(this, t, o); }; });   /* experiment: the Edit room's display canvas on the CPU too */
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f1 = (v) => (isFinite(v) ? v.toFixed(1) : '-');

await page.goto(pathToFileURL(HTML).href + '?dev&quick' + (argv.includes('--noauto') ? '&noauto' : ''));   /* --noauto: no scene loading behind the Edit room */
await page.waitForSelector('#tileStudio', { state: 'visible', timeout: 60000 });
await page.evaluate((u) => window.__cb.addPhoto({ url: u, f: 4, sh: '1/125', iso: 400, mm: 50, body: 'Full-frame DSLR', place: 'The Stump' }), url);
await page.click('#tileStudio'); await page.waitForTimeout(800);
await page.evaluate(() => __ed.open(0));
const tOpen = Date.now();
await page.waitForFunction(() => window.__ed && __ed.crv().last && /final|hires/.test(__ed.crv().shown) && !__ed.crv().busy, null, { timeout: 120000, polling: 50 });
const openMs = Date.now() - tOpen; await page.waitForTimeout(+opt('--settle', 0));
const dims = await page.evaluate(() => { const c = document.getElementById('editCanvas'); return { img: __ed.crv().last.w + 'x' + __ed.crv().last.h, canvas: c.width + 'x' + c.height }; });
console.log(`frame ${FRAME.split('/').pop()}  open→sharp preview ${openMs} ms  canvas ${dims.canvas}`);

let cdp = null; if (PROF) { cdp = await page.context().newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
const rows = [];
for (const id of SLIDERS) {
  await page.evaluate((id) => { const el = document.getElementById(id); el.closest('.lr-sec') && el.closest('.lr-sec').classList.remove('collapsed'); el.scrollIntoView({ block: 'center' }); }, id);
  await page.waitForTimeout(400);
  const box = await (await page.$('#' + id)).boundingBox();
  await page.evaluate((id) => { window.__pf = { frames: [], inputs: 0, long: 0, longN: 0 }; __ed.crv().log = [];
    let last = performance.now(); const tick = (t) => { __pf.frames.push(t - last); last = t; if (__pf.on !== false) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    document.getElementById(id).addEventListener('input', () => { __pf.inputs++; });
    try { __pf.po = new PerformanceObserver((l) => l.getEntries().forEach((e) => { __pf.long += e.duration; __pf.longN++; })); __pf.po.observe({ type: 'longtask', buffered: false }); } catch (e) {} }, id);
  let tUp;
  if (MOUSE) {   // a real mouse drag through Playwright (each move waits on the page, so a starved page gets fewer moves)
    const y = box.y + box.height / 2, x0 = box.x + box.width * 0.25, x1 = box.x + box.width * 0.85;
    await page.mouse.move(box.x + box.width / 2, y); await page.mouse.down();
    const t0 = Date.now(); let k = 0;
    while (Date.now() - t0 < SECS * 1000) { const ph = (k++ * 0.045) % 2, f = ph < 1 ? ph : 2 - ph; await page.mouse.move(x0 + (x1 - x0) * f, y); await page.waitForTimeout(12); }
    tUp = await page.evaluate(() => performance.now()); await page.mouse.up();
  } else {   // default: the page drags the slider itself at 60 Hz, firing what a drag fires; a busy main thread shows up as missed ticks
    tUp = await page.evaluate(([id, secs]) => new Promise((done) => { const el = document.getElementById(id), lo = +el.min, hi = +el.max, t0 = performance.now(); let k = 0;
      const iv = setInterval(() => { const ph = (k++ * 0.045) % 2, f = ph < 1 ? ph : 2 - ph; el.value = Math.round(lo + (hi - lo) * (0.25 + 0.6 * f)); el.dispatchEvent(new Event('input', { bubbles: true }));
        if (performance.now() - t0 > secs * 1000) { clearInterval(iv); el.dispatchEvent(new Event('change', { bubbles: true })); done(performance.now()); } }, 16); }), [id, SECS]);
  }
  await page.waitForFunction(() => !__ed.crv().busy && !__ed.crv().pend && __ed.crv().shown !== 'draft', null, { timeout: 60000, polling: 30 }).catch(() => {});
  await page.waitForTimeout(150);
  const r = await page.evaluate((tUp) => { __pf.on = false; const L = __ed.crv().log, d = L.filter((e) => e.t <= tUp), after = L.filter((e) => e.t > tUp);
    const fin = after.filter((e) => e.mode !== 'draft'); return { frames: __pf.frames.slice(2), inputs: __pf.inputs, long: __pf.long, longN: __pf.longN, drafts: d.length, lat: d.map((e) => e.ms), span: d.length > 1 ? d[d.length - 1].t - d[0].t : 0,
      settle: fin.length ? fin[fin.length - 1].t - tUp : NaN, sharp: fin.length ? fin[0].t - tUp : NaN, size: d.length ? d[0].w + 'x' + d[0].h : '-' }; }, tUp);
  const fr = r.frames, ups = r.span > 0 ? (r.drafts - 1) / (r.span / 1000) : 0;
  rows.push({ id, ...r, ups });
  console.log(`\n${id}  (${r.inputs} of ~${Math.round(SECS * 1000 / 16)} slider ticks handled in ${SECS}s, draft ${r.size})`);
  console.log(`  preview updates/s while dragging  ${f1(ups)}`);
  console.log(`  input→preview latency  p50 ${f1(pct(r.lat, 0.5))} ms  p95 ${f1(pct(r.lat, 0.95))} ms`);
  console.log(`  page frame time        p50 ${f1(pct(fr, 0.5))} ms  p95 ${f1(pct(fr, 0.95))} ms  max ${f1(Math.max(...fr))} ms  (${fr.filter((v) => v > 50).length} frames >50 ms)`);
  console.log(`  main-thread long tasks ${r.longN}, ${f1(r.long)} ms total`);
  console.log(`  let go → first sharp ${f1(r.sharp)} ms, → last pass ${f1(r.settle)} ms`);
}
if (PROF) { const { profile } = await cdp.send('Profiler.stop'); const self = {}, byId = {}; profile.nodes.forEach((n) => { byId[n.id] = n; });
  const dt = profile.timeDeltas, tot = (profile.endTime - profile.startTime) / 1000; const cnt = {}; profile.samples.forEach((s, i) => { cnt[s] = (cnt[s] || 0) + (dt[i] || 0); });
  for (const id in cnt) { const n = byId[id], cf = n.callFrame, k = (cf.functionName || '(anon)') + ' :' + (cf.lineNumber + 1); self[k] = (self[k] || 0) + cnt[id] / 1000; }
  console.log(`\nmain thread, self time (of ${tot.toFixed(0)} ms profiled):`);
  Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, v]) => console.log(`  ${v.toFixed(0).padStart(6)} ms  ${k}`)); }
if (argv.includes('--calls')) { const c = await page.evaluate(() => __calls); const g = {}; c.forEach((e) => { const k = e.n + ' ' + e.w + 'x' + e.h + ' ' + e.at; (g[k] = g[k] || []).push(e.d); });
  console.log('\nslow canvas/GL calls (>2 ms), whole run:'); Object.entries(g).sort((a, b) => b[1].reduce((x, y) => x + y) - a[1].reduce((x, y) => x + y)).slice(0, 14).forEach(([k, v]) => console.log(`  ${v.length}× total ${v.reduce((x, y) => x + y).toFixed(0)} ms  max ${Math.max(...v).toFixed(0)}  ${k}`)); }
mkdirSync(join(ROOT, 'tests', 'out'), { recursive: true }); writeFileSync(join(ROOT, 'tests', 'out', 'perf-edit.json'), JSON.stringify(rows.map(({ frames, lat, ...o }) => o), null, 1));
if (errors.length) console.log('\npage errors:\n' + errors.join('\n'));
await browser.close();
