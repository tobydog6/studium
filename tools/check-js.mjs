// Fast syntax check of the assembled page (well under a second): stitches src/index.html and src/ar.html together
// the way build.mjs does, with the engine and assets stubbed out, and parses every inline script.
// Usage: node tools/check-js.mjs   (exit 1 with the error and a few lines of context if anything fails to parse)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const stripNl = (s) => (s.endsWith('\n') ? s.slice(0, -1) : s);
const readSrc = (p) => stripNl(readFileSync(join(SRC, p), 'utf8')).replace(/^[ \t]*@@include (\S+)@@$/gm, (_, q) => readSrc(q));
let bad = 0;
for (const page of ['index.html', 'ar.html']) {
  const html = readFileSync(join(SRC, page), 'utf8')
    .replace(/^@@include (\S+)@@$/gm, (_, p) => (p === 'engine' ? '' : readSrc(p)))
    .replace(/\b(asset|asset-b64):[A-Za-z0-9_./-]+/g, 'A');
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    try { new vm.Script(m[1], { filename: page }); }
    catch (e) {
      bad++; const ln = (e.stack.match(/:(\d+)\n/) || [])[1];
      console.error(`${page}: ${e.message}` + (ln ? ` (assembled script line ${ln})` : ''));
      if (ln) { const L = m[1].split('\n'); for (let i = Math.max(0, ln - 3); i < Math.min(L.length, +ln + 1); i++) console.error(`  ${i + 1}| ${L[i].slice(0, 220)}`); }
    }
  }
}
if (bad) process.exit(1); else console.log('check-js: all scripts parse');
