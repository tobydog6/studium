// Develop engine test: the JavaScript Camera Raw pipeline (src/crdev.js) against PhotoCraft's own Rust build.
// tests/fixtures/crdev-golden.json holds a small frame and PhotoCraft's output for each control (made with its
// crates/algo camera_raw::develop). Every pixel here must land within one 8-bit level of it.
// Usage: node tests/crdev.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(ROOT, 'src', f), 'utf8');
const E = new Function(src('crdev.js') + '\n' + src('crtables.js') + '\nvar E=CRENGINE(); E.setTables(CR_TABLES); return E;')();
const G = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'crdev-golden.json'), 'utf8'));
const input = Buffer.from(G.src, 'base64');
let fail = 0;
for (const [name, c] of Object.entries(G.cases)) {
  const px = new Float32Array(G.w * G.h * 3); for (let i = 0; i < px.length; i++) px[i] = input[i] / 255;
  E.develop(px, G.w, G.h, c.p);
  const ref = Buffer.from(c.rgb, 'base64'); let worst = 0;
  for (let i = 0; i < px.length; i++) worst = Math.max(worst, Math.abs(Math.round(px[i] * 255) - ref[i]));
  if (worst > 1) { fail++; console.error(`  ${name}: off by up to ${worst} levels`); }
}
if (fail) { console.error(`FAIL  crdev (${fail} of ${Object.keys(G.cases).length} controls)`); process.exitCode = 1; }
else console.log(`PASS  crdev (${Object.keys(G.cases).length} controls match PhotoCraft)`);
