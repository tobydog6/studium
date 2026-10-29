// Secret layer smoke + screenshots: opens Studio > Table, unlocks with = + "secret", rolls slabs, inspects one,
// opens the dev panel. Needs `node build.mjs --web`. Shots: tests/out/secret-*.png
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = '/home/user/studium/.claude/worktrees/agent-a8381ae409eeb5c1c', WEB = join(ROOT, 'dist', 'web'), OUT = join(ROOT, 'tests', 'out');
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise((ok) => server.listen(0, ok));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('lt_tour_done', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ').slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error' && !/supabase|net::ERR|Failed to load resource|scan never finished/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 400)); });
const hideHub = () => page.evaluate(() => { ['hub', 'signin', 'launch'].forEach((id) => { const e = document.getElementById(id); if (e) { e.classList.add('hidden'); e.style.display = 'none'; } }); });
const shot = async (n) => { await hideHub(); await page.waitForTimeout(150); return page.screenshot({ path: join(OUT, `secret-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
let fail = '';
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await page.waitForTimeout(8000);
  await page.evaluate(() => { const cols = ['#7a8f6e', '#c58b52', '#3d5a7a', '#a35d4a', '#d9c9a3'];
    cols.forEach((c, i) => { const cv = document.createElement('canvas'); cv.width = i % 2 ? 600 : 900; cv.height = i % 2 ? 900 : 600; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#fff'; g.font = '120px sans-serif'; g.fillText('F' + i, 80, 300);
      __cb.addPhoto({ url: cv.toDataURL('image/jpeg', 0.8), place: 'Stump', pick: i < 2 }); });
    const si = document.getElementById('signin'); if (si) si.style.display = 'none';
    __cb.stOpen('table'); const hub = document.getElementById('hub'); if (hub) hub.classList.add('hidden'); });
  await page.waitForFunction(() => { const f = __cb.lt(); return f && f.contentWindow && f.contentWindow.__lt && f.contentWindow.document.body.classList.contains('ready'); }, null, { timeout: 120000, polling: 500 });
  const fr = page.frames().find((f) => f.url() === 'about:srcdoc');
  await page.waitForTimeout(2000);
  await fr.evaluate(() => { if (__lt.TOUR.on) __lt.tourEnd(false); });
  await page.evaluate(() => { ['hub', 'signin', 'launch'].forEach((id) => { const e = document.getElementById(id); if (e) { e.classList.add('hidden'); e.style.display = 'none'; } }); });
  const has = await fr.evaluate(() => !!__lt.secret); console.log('  secret installed:', has); if (!has) fail = 'secret layer missing';
  await fr.evaluate(() => __lt.secret.S.ctx.canvas.focus());
  await page.keyboard.press('='); await page.waitForTimeout(700); await shot('1-box');
  await page.keyboard.type('secret'); await page.keyboard.press('Enter'); await page.waitForTimeout(1800); await shot('2-unlocked');
  const st = await fr.evaluate(() => ({ state: __lt.secret.S.M.state, unlocked: __lt.secret.S.unlocked(), packs: __lt.secret.S.packs().length })); console.log('  after unlock:', JSON.stringify(st));
  if (!st.unlocked) fail = 'did not unlock';
  const waitState = async (st, ms) => { await page.waitForFunction((st) => __cb.lt().contentWindow.__lt.secret.S.M.state === st, st, { timeout: ms, polling: 300 }).catch(() => {}); return fr.evaluate(() => __lt.secret.S.M.state); };
  const vshot = async (n) => { await hideHub(); await page.waitForTimeout(150); return page.screenshot({ path: join(OUT, `vault-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
  /* two slabs rolled, both sent into the vault, plus one left loose near the middle so the clearing shows */
  await fr.evaluate(() => { const S = __lt.secret.S; const a = S.rollToTable({ tier: 'legendary' }), b = S.rollToTable({ tier: 'rare', variant: 'full' }); [a, b].forEach((o) => { const id = o.slab.id; S.table.remove(o, true); S.store.toVault(id); }); S.hud(); });
  await page.waitForTimeout(1500);
  const v0 = await fr.evaluate(() => ({ vault: __lt.secret.S.store.get().vault.length, state: __lt.secret.S.M.state })); console.log('  before VAULT:', JSON.stringify(v0)); if (v0.vault !== 2) fail = 'vault store not 2';
  await fr.evaluate(() => __lt.secret.S.T.setTimeScale(2.5));   /* the headless GPU is slow: run the tween clock faster */
  await fr.evaluate(() => __lt.secret.S.M.send('VAULT'));
  await page.waitForTimeout(2500); await vshot('1-rising');
  let st1 = await waitState('vault.case', 120000); console.log('  after open:', st1); if (st1 !== 'vault.case') fail = 'vault did not open: ' + st1;
  await page.waitForTimeout(1800); await vshot('2-case');
  await fr.evaluate(() => __lt.secret.S.vault.openKeypad()); await page.waitForTimeout(2500); await vshot('3-keypad');
  await fr.evaluate(() => { const S = __lt.secret.S; S.vault.key('9'); S.vault.key('9'); S.vault.key('9'); S.vault.key('9'); }); await page.waitForTimeout(400); await vshot('4-wrong');
  await page.waitForTimeout(1200);
  await fr.evaluate(() => { const S = __lt.secret.S; S.vault.key('1'); S.vault.key('2'); }); await page.waitForTimeout(300); await vshot('5-typing');
  await fr.evaluate(() => { const S = __lt.secret.S; S.vault.key('3'); S.vault.key('4'); });
  let st2 = await waitState('vault.lid', 60000); console.log('  after code:', st2); if (st2 !== 'vault.lid') fail = 'lid did not open: ' + st2;
  await page.waitForTimeout(4000); await vshot('6-lid');
  const inCase = await fr.evaluate(() => { const V = __lt.secret.S.vault.state; return { slabs: V.slabs.length, built: V.slabs.filter((s) => s.obj.built).length, visible: V.slabs.filter((s) => s.pivot.visible).length, lidA: +V.lidA.toFixed(2) }; }); console.log('  in case:', JSON.stringify(inCase));
  if (inCase.visible < 2) fail = 'slabs not standing in the case';
  /* hover and inspect the first slab, then put it on the table */
  const pt = await fr.evaluate(() => { const S = __lt.secret.S, g = S.vault.state.slabs[0].obj.group; const v = g.getWorldPosition(new S.THREE.Vector3()); v.project(S.ctx.camera); const r = S.ctx.canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; });
  const fo = await page.evaluate(() => { const r = __cb.lt().getBoundingClientRect(); return { x: r.left, y: r.top }; }); pt.x += fo.x; pt.y += fo.y; console.log('  slab at', JSON.stringify(pt));
  await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(700); await vshot('7-hover');
  await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(2500); await vshot('8-inspect');
  const insp = await fr.evaluate(() => __lt.secret.S.inspect.active()); console.log('  inspecting:', insp); if (!insp) fail = 'inspect did not open from the case';
  await fr.click('#skActs [data-id="table"]'); await page.waitForTimeout(3500); await vshot('9-onto-table');
  const after = await fr.evaluate(() => { const S = __lt.secret.S; return { table: S.table.list.length, vault: S.store.get().vault.length, inCase: S.vault.state.slabs.length, state: S.M.state }; }); console.log('  after table:', JSON.stringify(after));
  if (after.table !== 1 || after.vault !== 1) fail = 'onto the table did not move the slab';
  await fr.evaluate(() => __lt.secret.S.M.send('CLOSE')); await page.waitForTimeout(2500); await vshot('10-closing');
  const st3 = await waitState('idle', 90000); console.log('  after close:', st3); if (st3 !== 'idle') fail = 'did not close: ' + st3;
  await page.waitForTimeout(800); await vshot('11-closed');
  const holeOn = await fr.evaluate(() => __lt.secret.S.ctx.HOLE.uHoleOn.value); if (holeOn) fail = 'hole still open';
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'vault: FAIL ' + fail : 'vault: OK'); process.exit(fail || errors.length ? 1 : 0);
