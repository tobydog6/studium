// Studium build: assembles src/ + assets/ + the npm engine into ONE self-contained HTML file.
//   node build.mjs            -> dist/studium.html
//   node build.mjs --out X    -> custom output path
//   node build.mjs --web      -> dist/web/: index.html plus the big scan split into pieces under 8 MB, for hosts
//                                with a per-file size limit (Netlify, Cloudflare Pages). Serve the folder over http(s).
//
// Source conventions
//   @@include <path>@@   (alone on a line in src/index.html, or inside an included file) is replaced by src/<path>.
//   @@include engine@@   is replaced by the esbuild bundle of src/engine.js (three + gaussian-splats-3d).
//   asset:<path>         inside any included file becomes a base64 data: URI of <path> (repo-relative).
//   asset-b64:<path>     becomes the bare base64 of <path> (used for the scene data and Punctum).
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as esbuild from 'esbuild';
import vm from 'node:vm';

const ROOT = dirname(fileURLToPath(import.meta.url));
const argOut = process.argv.indexOf('--out');
const WEB = process.argv.includes('--web');
const WEBDIR = join(ROOT, 'dist', 'web');
const OUT = argOut > -1 ? process.argv[argOut + 1] : WEB ? join(WEBDIR, 'index.html') : join(ROOT, 'dist', 'studium.html');
const PART = 8 * 1024 * 1024, BIG = 4 * 1024 * 1024;   // web build: files over 4 MB ship as 8 MB pieces
if (WEB) { rmSync(WEBDIR, { recursive: true, force: true }); mkdirSync(join(WEBDIR, 'assets'), { recursive: true }); }

const MIME = { '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const stripNl = (s) => (s.endsWith('\n') ? s.slice(0, -1) : s);

function resolveAssets(text) {
  return text.replace(/\b(asset|asset-b64):([A-Za-z0-9_./-]+)/g, (_, kind, rel) => {
    if (WEB && kind === 'asset-b64' && statSync(join(ROOT, rel)).size > BIG) {   // "@parts:a.0,a.1,…": fetched and joined at runtime
      const buf = readFileSync(join(ROOT, rel)), names = [];
      for (let i = 0; i * PART < buf.length; i++) { const n = `assets/${basename(rel)}.${i}`; writeFileSync(join(WEBDIR, n), buf.subarray(i * PART, (i + 1) * PART)); names.push(n); }
      return '@parts:' + names.join(',');
    }
    const b64 = readFileSync(join(ROOT, rel)).toString('base64');
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
const shell = readFileSync(join(ROOT, 'src', 'index.html'), 'utf8');
// Included files may themselves contain @@include lines (e.g. app.js pulls in back.js inside its closure).
const readSrc = (p) => stripNl(readFileSync(join(ROOT, 'src', p), 'utf8'))
  .replace(/^[ \t]*@@include (\S+)@@$/gm, (_, q) => readSrc(q));
const html = shell.replace(/^@@include (\S+)@@$/gm, (_, p) =>
  p === 'engine' ? engine : resolveAssets(readSrc(p)));

if (/@@include|\basset(-b64)?:[A-Za-z]/.test(html.replace(engine, ''))) throw new Error('Unresolved include or asset token');
// every inline script must at least parse: a stray comment or quote fails the build, not a student's session
for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { try { new vm.Script(m[1]); } catch (e) { throw new Error('Script does not parse: ' + e.message); } }
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
const sha = createHash('sha256').update(html).digest('hex').slice(0, 12);
console.log(`Built ${OUT}  ${(Buffer.byteLength(html) / 1e6).toFixed(2)} MB  sha256:${sha}`);
