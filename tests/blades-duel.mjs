// An online Blades duel between two bare pages (tests/blades-harness), with this script as the wire in place of
// Supabase Realtime: page A hosts, page B is the guest. Both build, both rip, a whole match plays, and the guest's
// turned-round view has to agree with the host's sim (positions mirrored, scores swapped). Then a rematch starts and
// the host leaves, which must send the guest back to the build card. Screenshots to tests/out/bduel-*.png.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });
const js = (await esbuild.build({ entryPoints: [join(ROOT, 'tests/blades-harness/entry.js')], bundle: true, write: false, format: 'iife', logLevel: 'error' })).outputFiles[0].text;
/* the stand-in for the page's duel.js: messages go out through __relay, come in through __in */
const hostStub = `<script>window.__msgs=[]; window.TEST_HOST={ duel:{ list(){}, end(){ window.__ended=(window.__ended||0)+1; },
  channel(topic,h){ window.__h=h; return { send(ev,p){ window.__msgs.push([ev, JSON.stringify(p||{})]); }, leave(){ window.__left=1; }, joined:true }; } } };
  window.__in=function(list){ list.forEach(function(m){ if(window.__h) window.__h.msg(m[0], JSON.parse(m[1])); }); };</script>`;
const html = `<!doctype html><meta charset="utf-8"><style>:root{ --bg:#0c0b0a; --panel:rgba(18,16,14,0.88); --raise:#1d1a16; --line:#2c2925; --text:#f4f1ea; --faint:rgba(244,241,234,0.56); --dim:rgba(244,241,234,0.38); --accent:#e3ad57; --f-ui:system-ui,sans-serif; --f-mono:ui-monospace,monospace; }
html,body{ margin:0; height:100%; background:#0c0b0a; overflow:hidden; } canvas{ display:block; }
.btn{ height:32px; padding:0 12px; border-radius:5px; border:1px solid var(--line); background:var(--raise); color:var(--text); font:500 12px/1 var(--f-ui); cursor:pointer; } .btn.primary{ background:var(--text); color:#1a1714; } .btn:disabled{ opacity:.4; }</style>${hostStub}<canvas id="c"></canvas><script>${js}</script>`;
const file = join(OUT, 'bduel.html'); writeFileSync(file, html);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
async function open(tag) { const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', e => errors.push(tag + ': ' + e.message + ' ' + (e.stack || '').split('\n')[1])); page.on('console', m => { if (m.type() === 'error') errors.push(tag + ' console: ' + m.text()); else if (/toast/.test(m.text())) console.log('  ' + tag + ' ' + m.text()); });
  await page.goto('file://' + file); await page.waitForFunction(() => window.H, null, { timeout: 60000 }); return page; }
const A = await open('host'), B = await open('guest');
const step = (p, n, dt) => p.evaluate(([n, dt]) => H.step(n, dt), [n, dt || 1 / 30]);
const state = p => p.evaluate(() => H.M.state);
const shot = (p, n) => p.screenshot({ path: join(OUT, 'bduel-' + n + '.png'), timeout: 60000 }).catch(() => console.log('  (no picture ' + n + ')'));
let sent = 0;
/* one tick of the wire: whatever each page sent goes to the other */
async function wire() { const a = await A.evaluate(() => window.__msgs.splice(0)), b = await B.evaluate(() => window.__msgs.splice(0)); sent += a.length + b.length;
  if (a.length) await B.evaluate(l => __in(l), a); if (b.length) await A.evaluate(l => __in(l), b); return a.concat(b).map(m => m[0]); }
async function both(n) { await step(A, n); await step(B, n); await wire(); }
async function until(fn, label, max = 200) { for (let i = 0; i < max; i++) { if (await fn()) return; await both(5); await A.waitForTimeout(20); } throw new Error('timed out: ' + label + ' (host ' + await state(A) + ', guest ' + await state(B) + ')'); }
async function rip(p, x0) { await p.evaluate(x0 => { H.pointer('move', x0, 400); H.pointer('down', x0 + 40, 300); }, x0);
  for (let k = 1; k <= 6; k++) { await p.evaluate(([x0, k]) => H.pointer('move', x0 + 40 + k * 40, 300 + k * 5), [x0, k]); await p.waitForTimeout(12); }
  await p.evaluate(x0 => H.pointer('up', x0 + 280, 330), x0); }
let fail = '', pumping = false;
/* the wire runs on its own, like the real one, so slow frames or pictures on one page never starve the other */
const pump = setInterval(async () => { if (pumping) return; pumping = true; const t0 = Date.now(); try { await wire(); } catch (e) {} if (Date.now() - t0 > 5000) console.log('  (the wire waited ' + Math.round((Date.now() - t0) / 1000) + ' s on a busy page)'); pumping = false; }, 250);
try {
  for (const p of [A, B]) { await p.evaluate(() => H.M.send('BLADES')); for (let i = 0; i < 40 && (await step(p, 10)) !== 'blades.build'; i++); }
  for (const p of [A, B]) { await p.click('#skBl [data-a="borrow"]'); for (let i = 0; i < 20; i++) { await step(p, 5); if (await p.evaluate(() => !!H.S.blades.state.preview)) break; await p.waitForTimeout(200); } }
  /* a software GPU can freeze a page for many seconds compiling shaders: give the lost-touch check room here */
  for (const p of [A, B]) await p.evaluate(() => { H.S.blades.state.lostMs = 300000; });
  await A.evaluate(() => H.S.blades.duel({ role: 'host', foe: { id: 'g', n: 'Guest P.' }, me: { id: 'h', n: 'Host Q.' }, topic: 'studium-duel:h:g' }));
  await B.evaluate(() => H.S.blades.duel({ role: 'guest', foe: { id: 'h', n: 'Host Q.' }, me: { id: 'g', n: 'Guest P.' }, topic: 'studium-duel:h:g' }));
  await until(async () => (await A.evaluate(() => H.S.blades.net().hello)) && (await B.evaluate(() => H.S.blades.net().hello)), 'hello');
  const rot = await B.evaluate(() => H.S.blades.stadium.children[0].rotation.y); if (Math.abs(rot - Math.PI) > 1e-6) throw new Error('guest stadium not turned round: ' + rot);
  await shot(B, '1-guest-build');
  await A.click('#skBl [data-a="fight"]'); await both(5);
  const say = await B.evaluate(() => document.querySelector('#skBl .bl-duel').textContent); console.log('  guest card:', say); if (!/Host Q\. is ready/.test(say)) throw new Error('guest card did not hear the host was ready');
  await B.click('#skBl [data-a="fight"]');
  await until(async () => (await state(A)) === 'blades.ready' && (await state(B)) === 'blades.ready', 'both ready');
  await both(20); await shot(B, '2-guest-ready');
  let rounds = 0, worst = 0;
  for (let guard = 0; guard < 14; guard++) {
    const sa = await state(A), sb = await state(B); if (sa === 'blades.result' && sb === 'blades.result') break;
    if (sa === 'blades.ready' && sb === 'blades.ready') {
      await rip(A, 500); await both(2);
      if ((await state(A)) !== 'blades.ready') throw new Error('host launched before the guest ripped');
      await rip(B, 420); await until(async () => (await state(A)) === 'blades.battle' && (await state(B)) === 'blades.battle', 'launch');
    }
    let frames = 0;
    while ((await state(A)) === 'blades.battle' && frames < 3000) { await both(10); frames += 10;
      /* the guest's view should be the host's sim turned round, give or take what it guessed since the last snap */
      const a = await A.evaluate(() => H.S.blades.sim().tops.map(t => [t.p.x, t.p.y, t.alive])), b = await B.evaluate(() => H.S.blades.sim().tops.map(t => [t.p.x, t.p.y, t.alive]));
      if (a[0][2] && a[1][2] && b[0][2] && b[1][2]) { const d = Math.max(Math.hypot(a[0][0] + b[1][0], a[0][1] + b[1][1]), Math.hypot(a[1][0] + b[0][0], a[1][1] + b[0][1])); worst = Math.max(worst, d); }
      if (!rounds && frames === 60) { await shot(A, '3-host-battle'); await shot(B, '3-guest-battle'); }
      if (!rounds && frames === 30) await B.evaluate(() => H.key(' '));
    }
    if (frames >= 3000) { fail = 'a round did not finish'; break; }
    await until(async () => !/blades\.battle/.test(await state(B)), 'guest round end', 60);
    const sc = [await A.evaluate(() => H.S.blades.state.score.slice()), await B.evaluate(() => H.S.blades.state.score.slice())];
    console.log('  round ' + (rounds + 1) + ': host', JSON.stringify(sc[0]), 'guest', JSON.stringify(sc[1]), '· guest drift', worst.toFixed(2));
    if (sc[0][0] !== sc[1][1] || sc[0][1] !== sc[1][0]) { fail = 'scores disagree: ' + JSON.stringify(sc); break; }
    rounds++; for (let i = 0; i < 40 && (/blades\.round/.test(await state(A)) || /blades\.round/.test(await state(B))); i++) await both(5);
  }
  if (worst > 2.5) fail = fail || 'the guest drifted ' + worst.toFixed(2) + ' from the host';
  await both(10); await shot(A, '4-host-result'); await shot(B, '4-guest-result');
  const fin = [await state(A), await state(B)]; console.log('  result:', fin.join(' / '), '· messages', sent);
  if (fin[0] !== 'blades.result' || fin[1] !== 'blades.result') fail = fail || 'no result on both: ' + fin;
  if (!fail) {
    await B.click('#skBlBar [data-a="rematch"]'); await both(3);
    const lab = await A.evaluate(() => document.querySelector('#skBlBar [data-a="rematch"]').textContent); console.log('  host sees:', lab); if (!/Guest P\. wants a rematch/.test(lab)) fail = 'host did not see the rematch ask';
    await A.click('#skBlBar [data-a="rematch"]');
    await until(async () => (await state(A)) === 'blades.ready' && (await state(B)) === 'blades.ready', 'rematch');
    await A.evaluate(() => H.key('Escape')); await until(async () => (await state(B)) === 'blades.build' && !(await B.evaluate(() => H.S.blades.net())), 'guest back to build after the host left');
    const after = await B.evaluate(() => ({ rot: H.S.blades.stadium.children[0].rotation.y, card: document.querySelector('#skBl .bl-h p').textContent }));
    console.log('  guest after the host left:', JSON.stringify(after)); if (after.rot !== 0) fail = 'guest stadium still turned round';
  }
} catch (e) { fail = fail || e.message; }
if (errors.length) { console.log('ERRORS:\n' + errors.slice(0, 10).join('\n')); fail = fail || errors.length + ' page errors'; }
clearInterval(pump); await browser.close(); console.log(fail ? 'FAIL: ' + fail : 'blades-duel: OK'); process.exit(fail ? 1 : 0);
