// Blades in a bare page (tests/blades-harness): build, look closer, take it apart, launch, play a whole match by
// stepping the clock, and screenshot each stage to tests/out/bplay-*.png. Fails on any page error or a match that
// doesn't finish. Needs only node_modules (esbuild, three) and the preinstalled Playwright.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });
const js = (await esbuild.build({ entryPoints: [join(ROOT, 'tests/blades-harness/entry.js')], bundle: true, write: false, format: 'iife', logLevel: 'error' })).outputFiles[0].text;
const html = `<!doctype html><meta charset="utf-8"><style>:root{ --bg:#0c0b0a; --panel:rgba(18,16,14,0.88); --raise:#1d1a16; --line:#2c2925; --text:#f4f1ea; --faint:rgba(244,241,234,0.56); --dim:rgba(244,241,234,0.38); --accent:#e3ad57; --f-ui:system-ui,sans-serif; --f-mono:ui-monospace,monospace; }
html,body{ margin:0; height:100%; background:#0c0b0a; overflow:hidden; } canvas{ display:block; }
.btn{ height:32px; padding:0 12px; border-radius:5px; border:1px solid var(--line); background:var(--raise); color:var(--text); font:500 12px/1 var(--f-ui); cursor:pointer; } .btn.primary{ background:var(--text); color:#1a1714; } .btn:disabled{ opacity:.4; }</style><canvas id="c"></canvas><script>${js}</script>`;
const file = join(OUT, 'bplay.html'); writeFileSync(file, html);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on('pageerror', e => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1])); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = n => page.screenshot({ path: join(OUT, 'bplay-' + n + '.png'), timeout: 60000 }).catch(() => console.log('  (no picture ' + n + ', the software GPU was too slow)'));
const step = (n, dt) => page.evaluate(([n, dt]) => H.step(n, dt), [n, dt || 1 / 30]);
let fail = '';
try {
  await page.goto('file://' + file); await page.waitForFunction(() => window.H, null, { timeout: 60000 });
  await page.evaluate(() => H.M.send('BLADES'));
  for (let i = 0; i < 40 && (await step(10)) !== 'blades.build'; i++);
  await step(20); await shot('1-build');
  await page.evaluate(() => H.S.blades.gallery()); for (let i = 0; i < 20; i++) { await step(5); if (await page.evaluate(() => H.S.blades.state.gallery.length)) break; await page.waitForTimeout(200); }
  await page.evaluate(() => Object.assign(H.S.ctx.cam, { tz: -8.6, dT: 19, pitch: 50 })); await step(40); await shot('0-gallery');
  await page.evaluate(() => { H.M.go('blades.build'); Object.assign(H.S.ctx.cam, { tz: -8.55, dT: 16.6, pitch: 55 }); }); await step(20);
  await page.click('#skBl [data-a="borrow"]'); for (let i = 0; i < 20; i++) { await step(5); if (await page.evaluate(() => !!H.S.blades.state.preview)) break; await page.waitForTimeout(200); } await step(10); await shot('2-built');
  await page.click('#skBl [data-a="look"]'); await step(30); await shot('3-look');
  await page.evaluate(() => { H.pointer('down', 600, 400); H.pointer('move', 700, 440); H.pointer('up', 700, 440); }); await step(20);
  await page.click('#skBlBar [data-a="apart"]'); await step(40); await shot('4-apart');
  await page.click('#skBlBar [data-a="fight"]'); for (let i = 0; i < 20 && (await step(5)) !== 'blades.ready'; i++) await page.waitForTimeout(200); await step(20); await shot('5-ready');
  let rounds = 0;
  for (let guard = 0; guard < 12; guard++) {
    const st = await page.evaluate(() => H.M.state); if (st === 'blades.result') break;
    if (st === 'blades.ready') { await page.evaluate(() => { H.pointer('down', 640, 300); for (let k = 1; k <= 8; k++) H.pointer('move', 640 - k * 5, 300 + k * 26); }); await step(3); if (!rounds) await shot('6-pull'); await page.evaluate(() => H.pointer('up', 600, 508)); }
    let frames = 0; while ((await page.evaluate(() => H.M.state)) === 'blades.battle' && frames < 3000) { await step(15); frames += 15; if (!rounds && frames === 60) await shot('7-battle'); if (!rounds && frames === 240) await shot('8-battle-later'); }
    const s2 = await page.evaluate(() => ({ st: H.M.state, t: H.S.blades.sim() && H.S.blades.sim().t, tops: H.S.blades.sim() && H.S.blades.sim().tops.map(t => t.done || 'alive'), score: H.S.blades.state.score }));
    console.log('  round ' + (rounds + 1) + ':', JSON.stringify(s2)); if (frames >= 3000) { fail = 'a round did not finish'; break; }
    if (!rounds) { await step(10); await shot('9-round-end'); }
    rounds++; for (let i = 0; i < 20 && /blades\.round/.test(await step(5)); i++);
  }
  await step(10); await shot('10-result'); const fin = await page.evaluate(() => ({ st: H.M.state, score: H.S.blades.state.score })); console.log('  result:', JSON.stringify(fin));
  if (fin.st !== 'blades.result') fail = fail || 'no result: ' + fin.st;
  await page.click('#skBlBar [data-a="done"]'); for (let i = 0; i < 40 && (await step(10)) !== 'under'; i++);
  const gone = await page.evaluate(() => ({ st: H.M.state, stadium: H.S.blades.stadium.visible, y: H.S.blades.stadium.position.y, bar: document.getElementById('skBlBar').classList.contains('on') })); console.log('  after Done:', JSON.stringify(gone));
  if (gone.st !== 'under' || gone.stadium) fail = fail || 'Done did not put the stadium away: ' + JSON.stringify(gone);
} catch (e) { fail = fail || e.message; }
if (errors.length) { console.log('ERRORS:\n' + errors.slice(0, 10).join('\n')); fail = fail || errors.length + ' page errors'; }
await browser.close(); console.log(fail ? 'FAIL: ' + fail : 'blades-play: OK'); process.exit(fail ? 1 : 0);
