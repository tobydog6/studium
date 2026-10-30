// Studium build: assembles src/ + assets/ + the npm engine into ONE self-contained HTML file.
//   node build.mjs            -> dist/studium.html
//   node build.mjs --out X    -> custom output path
//   node build.mjs --web      -> dist/web/: index.html plus the big scan split into pieces under 8 MB, for hosts
//                                with a per-file size limit (Netlify, Cloudflare Pages). Serve the folder over http(s).
//
// Source conventions
//   @@include <path>@@   (alone on a line in src/index.html, or inside an included file) is replaced by src/<path>.
//   @@include engine@@   is replaced by the esbuild bundle of src/engine.js (three + Spark 2).
//   asset:<path>         inside any included file becomes a base64 data: URI of <path> (repo-relative).
//   asset-b64:<path>     becomes the bare base64 of <path> (used for the scene data and Punctum).
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { basename } from 'node:path';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as esbuild from 'esbuild';
import vm from 'node:vm';

const ROOT = dirname(fileURLToPath(import.meta.url));
// dev builds: --only stump,carpark keeps just those scenes (the others' data is left out and they vanish from the
// picker); --swap assets/scenes/stump-hd.stm=assets/scenes/stump-dev.stm puts a lighter asset in an existing slot.
const argOnly = process.argv.indexOf('--only'), ONLY = argOnly > -1 ? process.argv[argOnly + 1].split(',') : null;
const SWAP = {}; process.argv.forEach((a, i) => { if (a === '--swap') { const [from, to] = process.argv[i + 1].split('='); SWAP[from] = to; } });
const argOut = process.argv.indexOf('--out');
const WEB = process.argv.includes('--web');
const WEBDIR = join(ROOT, 'dist', 'web');
const OUT = argOut > -1 ? process.argv[argOut + 1] : WEB ? join(WEBDIR, 'index.html') : join(ROOT, 'dist', 'studium.html');
// big assets can live in the repo as <name>.part0, .part1, … (GitHub refuses files over 100 MB): joined here
const _bufs = {};
function assetBuf(rel) { if (_bufs[rel]) return _bufs[rel]; const f = join(ROOT, rel);
  if (existsSync(f)) return (_bufs[rel] = readFileSync(f));
  const parts = []; for (let i = 0; existsSync(f + '.part' + i); i++) parts.push(readFileSync(f + '.part' + i));
  if (!parts.length) throw new Error('missing asset ' + rel); return (_bufs[rel] = Buffer.concat(parts)); }
const PART = 8 * 1024 * 1024, BIG = 4 * 1024 * 1024;   // web build: files over 4 MB ship as 8 MB pieces
if (WEB) { rmSync(WEBDIR, { recursive: true, force: true }); mkdirSync(join(WEBDIR, 'assets'), { recursive: true }); }

const MIME = { '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const stripNl = (s) => (s.endsWith('\n') ? s.slice(0, -1) : s);

function resolveAssets(text) {
  return text.replace(/\b(asset|asset-b64):([A-Za-z0-9_./-]+)/g, (_, kind, rel) => {
    if (SWAP[rel]) rel = SWAP[rel];
    if (!WEB && /\.webm$/.test(rel)) return '';   /* one file: the opening film goes in once, as H.264 (every desktop browser plays it); the web build also ships the VP9 copy */
    if (ONLY && /^assets\/scenes\//.test(rel) && !ONLY.includes(basename(rel).split(/[-.]/)[0])) return '';   // a scene left out of this build
    /* web build: anything sizeable ships as its own file, not base64 inside the page. The page parses in a fraction of the
       time (it was ~20 MB), files load in parallel and cache, and an image used twice downloads once */
    if (WEB && kind === 'asset' && assetBuf(rel).length > 48 * 1024 && MIME[extname(rel).toLowerCase()] && !/^assets\/research\//.test(rel)) {   /* research samples can become students' photos: they stay data: images */
      const n = 'assets/' + rel.replace(/^assets\//, '').replace(/\//g, '-');
      if (!existsSync(join(WEBDIR, n))) writeFileSync(join(WEBDIR, n), assetBuf(rel));
      return n;
    }
    if (WEB && kind === 'asset-b64' && assetBuf(rel).length > (rel.endsWith('.html') ? BIG : 512 * 1024)) {   /* punctum.html is decoded straight from base64: it stays in */   // "@parts:a.0,a.1,…": fetched and joined at runtime
      const buf = assetBuf(rel), names = [];
      for (let i = 0; i * PART < buf.length; i++) { const n = `assets/${basename(rel)}.${i}`; writeFileSync(join(WEBDIR, n), buf.subarray(i * PART, (i + 1) * PART)); names.push(n); }
      return '@parts:' + names.join(',');
    }
    const b64 = assetBuf(rel).toString('base64');
    if (kind === 'asset-b64') return b64;
    const mime = MIME[extname(rel).toLowerCase()];
    if (!mime) throw new Error(`No MIME type for asset ${rel}`);
    return `data:${mime};base64,${b64}`;
  });
}

async function buildEngine() {
  const r = await esbuild.build({
    entryPoints: [join(ROOT, 'src', 'engine.js')],
    bundle: true, minify: true, format: 'iife', write: false, logLevel: 'error',
  });
  return r.outputFiles[0].text; // ends with "\n"; the original bundle kept that blank line
}

const engine = await buildEngine();
// the light table (src/lighttable/): its own three.js bundle and page, shipped as base64 and opened in an iframe by src/lighttable.js
async function buildLightTable() {
  const r = await esbuild.build({ entryPoints: [join(ROOT, 'src', 'lighttable', 'main.js')], bundle: true, minify: !process.env.LT_DEBUG, format: 'iife', write: false, logLevel: 'error' });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const sh = readFileSync(join(ROOT, 'src', 'lighttable', 'shell.html'), 'utf8'), cut = sh.indexOf('</style>') + 8;
  const page = '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + sh.slice(0, cut) + '</head><body>' + sh.slice(cut) + '<script>' + js + '</script></body></html>';
  return Buffer.from(page, 'utf8').toString('base64');
}
const lightTable = await buildLightTable();
// the secret layer's splat renderer (Spark) for the scan slab, built on its own against the light table's three.js
// (window.LT_THREE, set by secret/fxscan.js) so nobody downloads it until a scan slab is on screen; src/lighttable.js
// serves it to the table through LT_BRIDGE.spark as asset-b64:dist/lt-spark.js (pieces in the web build)
async function buildLtSpark() {
  const three = { name: 'lt-three', setup(b) { b.onResolve({ filter: /^three$/ }, () => ({ path: 'three', namespace: 'ltthree' })); b.onLoad({ filter: /.*/, namespace: 'ltthree' }, () => ({ contents: 'module.exports = window.LT_THREE;', loader: 'js' })); } };
  const r = await esbuild.build({ stdin: { contents: "import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark'; window.LT_SPARK = { SparkRenderer, SplatMesh };", resolveDir: ROOT, loader: 'js' },
    bundle: true, minify: true, format: 'iife', write: false, logLevel: 'error', plugins: [three] });
  mkdirSync(join(ROOT, 'dist'), { recursive: true }); writeFileSync(join(ROOT, 'dist', 'lt-spark.js'), r.outputFiles[0].text);
}
await buildLtSpark();
// the DVD shelf (src/dvd/): Sam's photographer talks on 3D shelves, built and shipped the same way as the light table
async function buildDvd() {
  const r = await esbuild.build({ entryPoints: [join(ROOT, 'src', 'dvd', 'main.js')], bundle: true, minify: true, format: 'iife', write: false, logLevel: 'error', loader: { '.jpg': 'dataurl' } });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const sh = readFileSync(join(ROOT, 'src', 'dvd', 'shell.html'), 'utf8'), cut = sh.indexOf('</style>') + 8;
  const page = '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + sh.slice(0, cut) + '</head><body>' + sh.slice(cut) + '<script>' + js + '</script></body></html>';
  return Buffer.from(page, 'utf8').toString('base64');
}
const dvdShelf = await buildDvd();
const shell = resolveAssets(readFileSync(join(ROOT, 'src', 'index.html'), 'utf8'));   // the page's own head (site icon) can use asset: too
// Included files may themselves contain @@include lines (e.g. app.js pulls in back.js inside its closure).
const readSrc = (p) => stripNl(readFileSync(join(ROOT, 'src', p), 'utf8'))
  .replace(/^[ \t]*@@include (\S+)@@$/gm, (_, q) => readSrc(q));
// Supabase (sign-in, class data, workbooks): studium.config.json, the same public project key Punctum ships with.
// --no-supabase leaves it out (an offline build); --supabase <url>,<anonKey> overrides it.
const argSb = process.argv.indexOf('--supabase');
let SUPA = null;
if (!process.argv.includes('--no-supabase')) {
  if (argSb > -1) { const [url, anonKey] = process.argv[argSb + 1].split(','); SUPA = { url, anonKey, providers: ['google'] }; }
  else if (existsSync(join(ROOT, 'studium.config.json'))) SUPA = JSON.parse(readFileSync(join(ROOT, 'studium.config.json'), 'utf8')).supabase || null;
}
const sbTag = SUPA ? `<script>window.STUDIUM_SUPABASE=${JSON.stringify(SUPA)};</script>\n` : '';
const html0 = shell.replace(/^@@include (\S+)@@$/gm, (_, p) =>
  p === 'engine' ? engine : resolveAssets(readSrc(p)).replace('@@lighttable-b64@@', () => lightTable).replace('@@dvd-b64@@', () => dvdShelf) + (ONLY && p === 'scenes.js' ? `\nSPLAT_SCENES=SPLAT_SCENES.filter(function(s){ return ${JSON.stringify(ONLY)}.indexOf(s.id)>=0; });   /* dev build: --only */` : ''));
const html = html0.replace('<script id="engine">', () => sbTag + '<script id="engine">');
if (SUPA) console.log('Supabase on: ' + SUPA.url);
// web build: the site files (link-preview image, robots.txt, sitemap.xml) from assets/web/ go at the site root
if (WEB) for (const f of readdirSync(join(ROOT, 'assets', 'web'))) copyFileSync(join(ROOT, 'assets', 'web', f), join(WEBDIR, f));

if (/@@include|\basset(-b64)?:[A-Za-z]/.test(html.replace(engine, ''))) throw new Error('Unresolved include or asset token');
// every inline script must at least parse: a stray comment or quote fails the build, not a student's session
for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { try { new vm.Script(m[1]); } catch (e) { throw new Error('Script does not parse: ' + e.message); } }
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
const sha = createHash('sha256').update(html).digest('hex').slice(0, 12);
console.log(`Built ${OUT}  ${(Buffer.byteLength(html) / 1e6).toFixed(2)} MB  sha256:${sha}`);

// the phone AR test page (src/ar.html + ar.js), built alongside: dist/ar.html, or dist/web/ar.html
if (argOut < 0) {
  const ar = readFileSync(join(ROOT, 'src', 'ar.html'), 'utf8').replace(/^@@include (\S+)@@$/gm, (_, p) => p === 'engine' ? engine : resolveAssets(readSrc(p)));
  if (/@@include|\basset(-b64)?:[A-Za-z]/.test(ar.replace(engine, ''))) throw new Error('AR page: unresolved include or asset token');
  for (const m of ar.matchAll(/<script>([\s\S]*?)<\/script>/g)) { try { new vm.Script(m[1]); } catch (e) { throw new Error('AR script does not parse: ' + e.message); } }
  const AR = WEB ? join(WEBDIR, 'ar.html') : join(ROOT, 'dist', 'ar.html');
  writeFileSync(AR, ar); console.log(`Built ${AR}  ${(Buffer.byteLength(ar) / 1e6).toFixed(2)} MB`);
}
