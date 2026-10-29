// The DVD shelf (src/dvd/) as one page you can open on its own: `node tools/dvd-standalone.mjs out.html [--samples]`.
// Bundles three.js and the baked textures, inlines Studium's fonts, and takes the video list from src/research.js.
// --samples puts the research sample photos on the covers (for screenshots where YouTube's thumbnails can't load).
import * as esbuild from 'esbuild'; import { readFileSync, writeFileSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), out = process.argv[2] || join(ROOT, 'dist', 'dvd-shelf.html');
const b64 = (f, t) => 'data:' + t + ';base64,' + readFileSync(join(ROOT, f)).toString('base64');
const r = await esbuild.build({ entryPoints: [join(ROOT, 'src', 'dvd', 'main.js')], bundle: true, minify: true, format: 'iife', write: false, logLevel: 'error', loader: { '.jpg': 'dataurl' } });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
/* the list lives in research.js (RS_VIDS): pull the entries out of it */
const rs = readFileSync(join(ROOT, 'src', 'research.js'), 'utf8'), block = rs.slice(rs.indexOf('var RS_VIDS=['), rs.indexOf('];', rs.indexOf('var RS_VIDS=[')) + 2);
const RS_VIDS = new Function(block + '; return RS_VIDS;')();
const vids = []; RS_VIDS.forEach((g) => g.v.forEach((x) => vids.push({ id: x[0], a: g.a, t: x[1], s: x[2] || 0 })));
const dev = { vids }; let devJs = 'window.DVD_DEV=' + JSON.stringify(dev) + ';';
if (process.argv.includes('--samples')) devJs += 'window.DVD_DEV.thumb=function(id){ var S=' + JSON.stringify([1, 2, 3, 4, 5, 6].map((n) => b64(`assets/research/sample-${n}.jpg`, 'image/jpeg'))) + '; var h=0; for(var i=0;i<id.length;i++) h=(h*31+id.charCodeAt(i))|0; return S[Math.abs(h)%6]; };';
const fonts = `@font-face{font-family:'Fraunces';font-weight:100 900;src:url(${b64('assets/fonts/fraunces.woff2', 'font/woff2')}) format('woff2')}
@font-face{font-family:'Geist';font-weight:100 900;src:url(${b64('assets/fonts/geist.woff2', 'font/woff2')}) format('woff2')}
@font-face{font-family:'Geist Mono';font-weight:400 500;src:url(${b64('assets/fonts/geist-mono.woff2', 'font/woff2')}) format('woff2')}`;
const sh = readFileSync(join(ROOT, 'src', 'dvd', 'shell.html'), 'utf8'), cut = sh.indexOf('</style>') + 8;
const page = '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + fonts + '</style>'
  + sh.slice(0, cut) + '</head><body>' + sh.slice(cut) + '<script>' + devJs + '</script><script>' + js + '</script></body></html>';
writeFileSync(out, page); console.log('dvd-standalone: ' + out + '  ' + (page.length / 1e6).toFixed(2) + ' MB');
