// Studium build: assembles src/ + assets/ + the npm engine into ONE self-contained HTML file.
//   node build.mjs            -> dist/studium.html
//   node build.mjs --out X    -> custom output path
//
// Source conventions
//   @@include <path>@@   (alone on a line in src/index.html) is replaced by src/<path>.
//   @@include engine@@   is replaced by the esbuild bundle of src/engine.js (three + gaussian-splats-3d).
//   asset:<path>         inside any included file becomes a base64 data: URI of <path> (repo-relative).
//   asset-b64:<path>     becomes the bare base64 of <path> (used for the scene data and Punctum).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as esbuild from 'esbuild';

const ROOT = dirname(fileURLToPath(import.meta.url));
const argOut = process.argv.indexOf('--out');
const OUT = argOut > -1 ? process.argv[argOut + 1] : join(ROOT, 'dist', 'studium.html');

const MIME = { '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const stripNl = (s) => (s.endsWith('\n') ? s.slice(0, -1) : s);

function resolveAssets(text) {
  return text.replace(/\b(asset|asset-b64):([A-Za-z0-9_./-]+)/g, (_, kind, rel) => {
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
const html = shell.replace(/^@@include (\S+)@@$/gm, (_, p) =>
  p === 'engine' ? engine : resolveAssets(stripNl(readFileSync(join(ROOT, 'src', p), 'utf8'))));

if (/@@include|\basset(-b64)?:[A-Za-z]/.test(html.replace(engine, ''))) throw new Error('Unresolved include or asset token');
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
const sha = createHash('sha256').update(html).digest('hex').slice(0, 12);
console.log(`Built ${OUT}  ${(Buffer.byteLength(html) / 1e6).toFixed(2)} MB  sha256:${sha}`);
