// Quests, phase 2: the picker on arrival, tracking a foundation, the HUD and its "Show me how", completion moments,
// F1 to F5, the board opening, tracking M3 and seeing the lighting tour offered. Screenshots of each.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(process.argv[2] || join(ROOT, 'dist', 'studium.html'));
const OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_looked', '1'); localStorage.setItem('studium_frames_off', '1'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const U = () => ev(() => window.__qu.state());
const qs = async (id) => (await ev(() => window.__q.state())).quests.find((x) => x.id === id);
const shot = (n) => page.screenshot({ path: join(OUT, n + '.png'), timeout: 240000 });
const tap = (sel) => page.$eval(sel, (b) => b.click());
const waitU = (pred, ms = 30000) => page.waitForFunction(pred, null, { timeout: ms });
// finish a quest's steps by script, then wait for its completion card and move on
async function finish(id, script) {
  await ev(script); await ev(() => window.__q.tick());
  await waitU(() => window.__qu.state().done, 15000); console.log('done', id, await page.textContent('#qDone .t'));
}
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick');
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="solo"]');
  // the picker on arrival: just the first foundation
  await waitU(() => window.__qu && window.__qu.state().pick);
  ok((await page.$$('#qPick .q-card')).length === 1, 'during foundations the picker shows one card');
  await page.waitForTimeout(600); await shot('q-picker-foundation');
  await tap('#qPick [data-q-pick="f1"]');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 }); await page.waitForTimeout(1500);
  ok((await ev(() => window.__q.state())).tracked === 'f1', 'F1 should be tracked');
  // the HUD offers the warm-up
  await waitU(() => window.__qu.state().hud && window.__qu.state().how);
  await page.hover('#qHud'); await page.waitForTimeout(800); await shot('q-hud');
  // F1 done: completion card
  await finish('f1', () => { window.__q.tour('basics'); window.__q.frames(3); });
  await page.waitForTimeout(800); await shot('q-complete');
  await tap('#qDone [data-q="next"]'); await waitU(() => window.__qu.state().pick);
  ok(await page.$('#qPick [data-q-pick="f2"]'), 'the picker should now offer F2');
  await tap('#qPick [data-q-pick="f2"]'); await page.waitForTimeout(800);
  await finish('f2', () => { const L = ['2470', '50', '85', '135'], F = [2.8, 5.6, 11], SH = ['1/60', '1/250', '1/1000'], I = [100, 800];
    for (let i = 0; i < 15; i++) window.__cb.addPhoto({ url: 'x', lens: L[i % 4], f: F[i % 3], sh: SH[i % 3], iso: I[i % 2], place: 'The Stump' }); });
  await tap('#qDone [data-q="next"]'); await waitU(() => window.__qu.state().pick); await tap('#qPick [data-q-pick="f3"]'); await page.waitForTimeout(800);
  await finish('f3', () => { window.__q.tour('select'); window.__q.tour('edit'); window.__q.flag('synced'); for (let i = 0; i < 8; i++) window.__cb.addPhoto({ url: 'p', pick: true, place: 'The Stump' }); });
  await tap('#qDone [data-q="next"]'); await waitU(() => window.__qu.state().pick); await tap('#qPick [data-q-pick="f4"]'); await page.waitForTimeout(800);
  await finish('f4', () => { window.__q.tour('research'); window.__q.research('cull', 'a'); window.__q.research('punctum', 'a'); window.__q.page('artist', 1); });
  await tap('#qDone [data-q="next"]'); await waitU(() => window.__qu.state().pick); await tap('#qPick [data-q-pick="f5"]'); await page.waitForTimeout(800);
  // F5 opens the board: the bigger moment
  await finish('f5', () => { window.__q.tour('workbook'); window.__q.tour('library'); window.__q.page('rank', 3); });
  ok(/Your board is open/.test(await page.textContent('#qDone')), 'the board moment should show');
  await page.waitForTimeout(800); await shot('q-board-open');
  await tap('#qDone [data-q="next"]'); await waitU(() => window.__qu.state().pick);
  ok((await page.$$('#qPick .q-card')).length >= 1 && await page.$('#qPick .q-card.sug'), 'a suggested quest after the board opens');
  await page.waitForTimeout(600); await shot('q-picker-board');
  // the log: track M3 from it
  await tap('#qPick [data-q="log"]'); await waitU(() => window.__qu.state().log);
  await tap('#qLog [data-q-open="m3"]'); await page.waitForTimeout(400); await shot('q-log');
  await tap('#qLog [data-q-track="m3"]');
  await page.waitForFunction(() => window.__cb.state() === 'scene', null, { timeout: 60000 }); await page.waitForTimeout(1200);
  ok((await ev(() => window.__q.state())).tracked === 'm3', 'M3 should be tracked');
  await waitU(() => window.__qu.state().how); ok(/lighting rig/.test(await page.textContent('#qHud')), 'the HUD should offer the lighting tour');
  await page.hover('#qHud'); await page.waitForTimeout(800); await shot('q-hud-m3');
  // "Show me how" opens the rig and runs its tour
  await tap('#qHud [data-q="how"]');
  await page.waitForFunction(() => window.__rl && window.__rl.state().ui, null, { timeout: 120000 });
  await waitU(() => document.querySelector('#coCard.show'), 30000);
  ok(/Lighting/.test(await page.textContent('#coCard')), 'the lighting tour should run');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log('PASS questui');
} catch (e) { console.error('FAIL ', e.message); console.log(JSON.stringify(await ev(() => ({u: window.__qu.state(), t: window.__q.state().tracked, q: window.__q.state().quests.slice(0,5).map(x => [x.id, x.status, x.steps.map(s => s[0]).join('')])}))).catch(()=>{})); await shot('q-fail').catch(() => {}); process.exitCode = 1; } finally { await browser.close(); }
