// Coming back from Google, without Google: loads the web build the way Supabase sends you back (the token in the
// address bar) and answers Supabase itself (who you are, an empty cloud save, no class), for both buttons: the launch
// page's "Sign in with Google to save your progress" (demo) and the sign-in page's "Continue with school Google"
// (student). Fails on a page error or a black screen. Needs `node build.mjs --web`. Shots: tests/out/signin-*.png
import { createRequire } from 'node:module'; import { createServer } from 'node:http'; import { createReadStream, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, extname, resolve, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url); let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(ROOT, 'dist', 'web'), OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });
const T = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const srv = createServer((q, r) => { const f = join(WEB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise(ok => srv.listen(0, ok)); const base = 'http://localhost:' + srv.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const USER = { id: '11111111-2222-3333-4444-555555555555', email: 'mere@example.com', user_metadata: { full_name: 'Mere Tane' } };
let fail = '';
for (const after of (process.argv[2] || 'demo,student').split(',')) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [], calls = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|websocket|WebSocket/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  await page.route(/supabase\.co/, route => { const u = route.request().url(), m = route.request().method(); calls.push(m + ' ' + u.replace(/^https:\/\/[^/]+/, '').slice(0, 90));
    if (/\/auth\/v1\/user/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) });
    if (/\/auth\/v1\/token/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'a2', refresh_token: 'r2', expires_in: 3600, user: USER }) });
    if (/\/storage\/v1\/object\/authenticated\//.test(u)) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' });
    if (/\/storage\/v1\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (/\/rest\/v1\//.test(u)) return route.fulfill({ status: m === 'GET' || m === 'POST' ? 200 : 204, contentType: 'application/json', body: m === 'GET' || m === 'POST' ? '[]' : '' });
    if (/\/functions\/v1\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    return route.abort(); });
  await page.addInitScript(a => { try { if (!sessionStorage.getItem('__once')) { sessionStorage.setItem('__once', '1'); sessionStorage.setItem('studium_after', a); } } catch (e) {} }, after);
  await page.goto(base + '/#access_token=fake-token&refresh_token=fake-refresh&expires_in=3600&token_type=bearer');
  let black = 0, last = '';
  for (let i = 1; i <= 6; i++) { await page.waitForTimeout(5000);
    const s = await page.evaluate(() => { const shown = [...document.body.children].filter(e => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && +c.opacity > 0.05 && e.offsetHeight > 150 && !e.classList.contains('hidden'); }).map(e => e.id || e.className.split(' ')[0]);
      const sub = document.querySelector('#signin .si-sub'); return { shown: shown.slice(0, 9).join(','), sub: sub && !document.getElementById('signin').classList.contains('hidden') ? sub.textContent.slice(0, 70) : '', toast: (document.querySelector('.toast.show, #toast.show, .toast') || {}).textContent || '', pill: (document.getElementById('stWho') && !document.getElementById('stWho').classList.contains('hidden')) ? document.getElementById('stWho').textContent : '', acct: (document.querySelector('#rackin .rf-acct') || {}).textContent || '' }; });
    const t0 = Date.now(), alive = await Promise.race([page.evaluate(() => 1), new Promise(r => setTimeout(() => r(0), 20000))]); if (!alive) console.log('  [' + after + '] page not answering after ' + (i * 5) + ' s');
    const shot = await page.screenshot({ path: join(OUT, 'signin-' + after + '-' + i + '.png'), timeout: 150000 }); if (Date.now() - t0 > 20000) console.log('  [' + after + '] slow screenshot: ' + Math.round((Date.now() - t0) / 1000) + ' s');
    /* black: almost every pixel dark */
    const dark = await page.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = 64; c.height = 40; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 64, 40); const d = g.getImageData(0, 0, 64, 40).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] < 30) n++; return n / (d.length / 4); }, shot.toString('base64'));
    const line = (i * 5) + 's dark ' + dark.toFixed(2) + ' | ' + s.shown + (s.sub ? ' | sign-in: "' + s.sub + '"' : '') + (s.toast ? ' | toast: ' + s.toast.slice(0, 80) : '') + (s.acct ? ' | launch corner: ' + s.acct.slice(0, 60) : '') + (s.pill ? ' | pill: ' + s.pill : '');
    if (line.slice(line.indexOf('|')) !== last) console.log('  [' + after + '] ' + line); last = line.slice(line.indexOf('|'));
    black = dark > 0.97 ? black + 1 : 0; }
  console.log('  [' + after + '] supabase calls: ' + [...new Set(calls)].slice(0, 12).join(' ; '));
  if (errors.length) { console.log('  [' + after + '] errors:\n    ' + errors.slice(0, 10).join('\n    ')); fail = fail || after + ': page errors'; }
  if (black >= 3) fail = fail || after + ': black screen for 15 s or more at the end';
  await page.close();
}
await browser.close(); srv.close();
if (fail) { console.log('signin-back: FAIL ' + fail); process.exit(1); } else console.log('signin-back: OK');
