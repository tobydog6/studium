// Close-up portraits of generated blades (tests/blades-harness), to compare with real Beyblade X photos.
// node tests/blades-look.mjs [n]  →  tests/out/blook-*.png (top view of nine, and three-quarter close-ups)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });
const js = (await esbuild.build({ entryPoints: [join(ROOT, 'tests/blades-harness/entry.js')], bundle: true, write: false, format: 'iife', logLevel: 'error' })).outputFiles[0].text;
const html = `<!doctype html><meta charset="utf-8"><style>:root{--panel:rgba(18,16,14,.88);--line:#2c2925;--text:#f4f1ea;--faint:rgba(244,241,234,.56);--accent:#e3ad57;--f-ui:system-ui;--f-mono:monospace}html,body{margin:0;height:100%;background:#0c0b0a;overflow:hidden}#skBl,#skBlHud,#skBlTags,#skBlTip{display:none!important}</style><canvas id="c"></canvas><script>${js}</script>`;
const file = join(OUT, 'blook.html'); writeFileSync(file, html);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const step = n => page.evaluate(n => H.step(n, 1 / 30), n);
await page.goto('file://' + file); await page.waitForFunction(() => window.H, null, { timeout: 60000 });
await page.evaluate(() => H.M.send('BLADES')); for (let i = 0; i < 40 && (await step(10)) !== 'blades.build'; i++);
await page.evaluate(() => H.S.blades.gallery()); for (let i = 0; i < 30; i++) { await step(3); if (await page.evaluate(() => H.S.blades.state.gallery.length)) break; await page.waitForTimeout(200); }
await page.evaluate(() => { const S = H.S, g = S.blades.state.gallery; g.forEach(b => { b.halo.visible = false; b.glint.visible = false; }); });
const cam = (o) => page.evaluate(o => { const c = H.S.ctx.cam, st = H.S.blades.stadium; Object.assign(c, { tx: st.position.x + o.x, ty: st.position.y + o.y, tz: st.position.z + o.z, dT: o.d, pitch: o.p }); }, o);
await cam({ x: 0, y: 0, z: 0, d: 9, p: 88 }); await step(40); await page.screenshot({ path: join(OUT, 'blook-1-top.png') });
const at = (i) => page.evaluate(i => { const b = H.S.blades.state.gallery[i].root.position; return { x: b.x, y: b.y + 0.3, z: b.z }; }, i);
for (const [i, n] of [[4, 2], [6, 3], [8, 4]]) { const p = await at(i); await cam({ ...p, d: 3.2, p: 38 }); await step(40); await page.screenshot({ path: join(OUT, 'blook-' + n + '.png') }); }
console.log(errors.length ? 'ERRORS ' + errors.slice(0, 5).join(' | ') : 'blades-look: OK'); await browser.close();
