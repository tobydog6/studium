// Times the develop pipeline (src/crdev.js, the code the Edit room's worker runs) stage by stage in Node, at the
// sizes the Edit room uses: the draft while a slider moves, the full preview when it rests, and a hi-res pass.
//   node tests/perf-develop.mjs [--reps 5] [--src path/to/old/crdev.js]
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), REPS = argv.includes("--reps") ? +argv[argv.indexOf("--reps") + 1] : 9;
const SRC = argv.includes('--src') ? argv[argv.indexOf('--src') + 1] : null;   /* --src old/crdev.js: time another copy of the engine, for before/after */
const src = (f) => readFileSync(f === 'crdev.js' && SRC ? resolve(SRC) : join(ROOT, 'src', f), 'utf8');
const app = src('app.js'), edef = app.slice(app.indexOf('var EDEF={'), app.indexOf('var ED_SECKEY'));
const M = new Function('$', src('crtables.js') + '\n' + edef + '\n' + src('crdev.js') + '\nreturn {CRENGINE:CRENGINE, CR_TABLES:CR_TABLES, crParams:crParams, EDEF:EDEF, CRWORKER:CRWORKER};')(() => null);
const E = M.CRENGINE(); E.setTables(M.CR_TABLES);
const H = M.CRWORKER(null, E);
// a photo-like source: smooth gradients plus texture, so local tone and blurs see real structure
function source(w, h) { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, n = Math.sin(x * 0.07) * Math.cos(y * 0.05) * 40 + ((x * 13 ^ y * 7) & 31);
  d[i] = 60 + x / w * 120 + n; d[i + 1] = 80 + y / h * 100 + n; d[i + 2] = 50 + n * 0.5; d[i + 3] = 255; } return d; }
const ed = (o) => { const e = {}; for (const k in M.EDEF) e[k] = Array.isArray(M.EDEF[k]) ? JSON.parse(JSON.stringify(M.EDEF[k])) : M.EDEF[k]; return Object.assign(e, o); };
const CASES = [['exposure', { exposure: 40 }], ['contrast', { contrast: 40 }], ['shadows', { shadows: 50 }], ['highlights', { highlights: -50 }], ['vibrance', { vibrance: 40 }],
  ['clarity', { clarity: 40 }], ['texture', { texture: 40 }], ['dehaze', { dehaze: 30 }], ['whites', { whites: 30 }], ['grain', { grain: 40 }], ['halation', { halation: 50 }]];
const SIZES = [['draft', 900, 600, { workSide: 320, refStep: 0.25, pixelScale: 0.375 }], ['final', 972, 648, { workSide: 800, pixelScale: 0.405 }], ['hires', 1944, 1296, { workSide: 800, pixelScale: 0.81 }]];
const med = (a) => a.sort((x, y) => x - y)[0];   /* best of the runs: the least disturbed by whatever else the machine is doing */
for (const [sn, w, h, o] of SIZES) {
  let s; H({ t: 'src', key: sn, w, h, data: source(w, h) }, () => {});
  const run = (p, o2) => { let ms; const t = performance.now(); H({ t: 'run', key: sn, p, opt: o2 }, () => { ms = performance.now() - t; }); return ms; };
  run(M.crParams(ed({})), o); run(M.crParams(ed({})), o);
  const base = med(Array.from({ length: REPS }, () => run(M.crParams(ed({})), o)));
  console.log(`\n${sn} ${w}x${h}: no sliders moved ${base.toFixed(1)} ms (copy in, clamp, RGBA out)`);
  for (const [n, v] of CASES) { const t = []; for (let r = 0; r < REPS; r++) { Object.keys(v).forEach((k) => { v[k] += 2; }); t.push(run(M.crParams(ed(v)), o)); }   /* values keep moving, as in a drag: no cache hits */
    console.log(`  ${n.padEnd(11)} ${med(t).toFixed(1).padStart(7)} ms`); }
}
