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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('lt_tour_done', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ').slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error' && !/supabase|net::ERR|Failed to load resource|scan never finished/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 400)); });
const hideHub = () => page.evaluate(() => { ['hub', 'signin', 'launch'].forEach((id) => { const e = document.getElementById(id); if (e) { e.classList.add('hidden'); e.style.display = 'none'; } }); });
const shot = async (n) => { await hideHub(); await page.waitForTimeout(150); return page.screenshot({ path: join(OUT, `secret-${n}.png`), timeout: 120000 }).catch(() => console.log('  (no screenshot ' + n + ')')); };
let fail = '';
try {
  await page.goto(`http://localhost:${server.address().port}/index.html?dev&quick&noauto`); await page.waitForFunction(() => typeof __cb !== "undefined" && __cb.addPhoto, null, { timeout: 180000, polling: 500 }); await page.waitForTimeout(1500);
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
  /* roll one of each kind so the slab build and the label show */
  await fr.evaluate(() => { const S = __lt.secret.S; S.rollToTable({ tier: 'common' }); S.rollToTable({ tier: 'rare' }); S.rollToTable({ tier: 'legendary' }); S.rollToTable({ tier: 'mythic' }); S.rollToTable({ tier: 'uncommon', variant: 'misprint' }); S.rollToTable({ tier: 'epic', variant: 'stamped' }); });
  await page.waitForTimeout(3500); await shot('3-slabs');
  const info = await fr.evaluate(() => { const S = __lt.secret.S; return { table: S.table.list.length, built: S.table.list.filter((o) => o.built).length, pulls: S.store.get().pulls.length }; }); console.log('  slabs:', JSON.stringify(info));
  if (info.built < info.table) fail = 'slabs did not build';
  /* look closer: camera onto the slabs, then inspect one */
  await fr.evaluate(() => { const S = __lt.secret.S; S.cam.set({ tx: -4, tz: 1.5, dT: 16 }); }); await page.waitForTimeout(1500); await shot('4-closer');
  await fr.evaluate(() => { const S = __lt.secret.S; const o = S.table.list.find((o) => o.slab.tier === 'legendary') || S.table.list[0]; S.inspect.open(o, { actions: [{ id: 'back', label: 'Put back' }, { id: 'vault', label: 'Into the vault', primary: true }] }); });
  await page.waitForTimeout(1400); await page.mouse.move(820, 380); await page.waitForTimeout(600); await shot('5-inspect');
  await page.mouse.move(700, 420); await page.mouse.down(); await page.mouse.move(900, 470, { steps: 12 }); await page.waitForTimeout(300); await shot('6-turn'); await page.mouse.up();
  await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
  await page.keyboard.press('`'); await page.waitForTimeout(600); await shot('7-dev');
  await fr.evaluate(() => __lt.secret.S.dev.set('finish', 'gold')); await page.waitForTimeout(800); await shot('8-testfinish');
  await fr.evaluate(() => __lt.secret.S.dev.set('finish', 'tier'));
  await fr.evaluate(() => { const S = __lt.secret.S; S.cam.set({ tx: 14, tz: 4, dT: 14 }); }); await page.waitForTimeout(1500); await shot('9-loot-button');
  await fr.evaluate(() => { const S = __lt.secret.S; S.cam.set({ tx: -14, tz: 10, dT: 12 }); }); await page.waitForTimeout(1500); await shot('10-vault-button');
  await fr.evaluate(() => { __lt.focus('wall'); __lt.cam.tx = -9; __lt.cam.ty = 5; __lt.cam.dT = 10; }); await page.waitForTimeout(1800); await shot('11-keyhole');
  await fr.evaluate(() => { __lt.focus('table'); __lt.secret.S.lock(); }); await page.waitForTimeout(500); await shot('12-dissolve');
  await page.waitForTimeout(1500);
  const end = await fr.evaluate(() => ({ state: __lt.secret.S.M.state, vis: __lt.secret.S.buttons.loot.visible })); console.log('  after lock:', JSON.stringify(end));
} catch (e) { fail = e.message; }
await browser.close(); server.close();
if (errors.length) console.error(errors.join('\n'));
console.log(fail || errors.length ? 'secret: FAIL ' + fail : 'secret: OK'); process.exit(fail || errors.length ? 1 : 0);
