// Coach test: the first-time warm-up at the Stump. The gold frames stay hidden while it runs; each prompt ticks over
// when the student does the thing (keys, a photo, a dial, the bag with its spotlighted clicks, the camera back), then
// the frames unlock.  Usage: node tests/coach.mjs [path/to/studium.html]
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
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_detail', 'test'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const co = () => ev(() => window.__co.state());
const shot = (n) => page.screenshot({ path: join(OUT, `coach-${n}.png`), timeout: 240000 });
const waitStep = (id) => page.waitForFunction((x) => window.__gd.state().id === x && window.__gd.state().open, id, { timeout: 300000, polling: 300 });
const next = async (i, label) => { await page.waitForFunction((k) => window.__co.state().i > k || window.__co.state().done, i, { timeout: 90000, polling: 200 }).catch(async () => { throw new Error('warm-up stuck at step ' + (i + 1) + ' (' + label + '): ' + JSON.stringify(await co())); }); };
try {
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.waitForSelector('#signin [data-si="demo"]', { state: 'visible', timeout: 60000 });
  await page.click('#signin [data-si="demo"]');
  await waitStep('basics');
  ok(!/W A S D/.test(await page.$eval('#gdPop', (e) => e.textContent)), 'no wall of hotkeys on the welcome');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(800);
  ok(await page.$('#coCard.show'), 'the coach card shows');
  ok(!(await page.$('#chMarks.show')) && !(await page.$('#gdCard.show')), 'frames and their markers are hidden during the warm-up');
  await page.waitForTimeout(600); await shot('1-look');
  await ev(() => window.__co.nudge({ look: 2 })); await next(0, 'look');
  await ev(() => window.__co.nudge({ walk: 4 })); await next(1, 'walk');
  await page.keyboard.press('KeyQ'); await page.keyboard.press('KeyE'); await next(2, 'crouch');
  await page.keyboard.press('KeyP'); await next(3, 'raise');
  await page.keyboard.press('Enter'); await next(4, 'photo');
  await page.keyboard.press('Digit2'); await page.mouse.move(720, 450); await page.mouse.wheel(0, 120); await next(5, 'dial');
  await page.keyboard.press('KeyB'); await next(6, 'bag');
  await page.waitForTimeout(600); await shot('2-bag-spot');
  ok(await page.$('#coRing.show'), 'the thing to click is lit up in the bag');
  await page.click('#bag [data-bg-body="ml"]'); await next(7, 'body');
  await page.click('#bag .lensbtn'); await next(8, 'change lens');
  await page.waitForTimeout(500); await page.click('#bag [data-bg-lens="50"]'); await next(9, '50 mm');
  await page.click('#bag [data-bg="done"]'); await next(10, 'lock in');
  await page.keyboard.press('KeyB'); await next(11, 'close bag');
  await page.keyboard.press('Space'); await next(12, 'camera back');
  await page.waitForTimeout(500); await shot('3-back-spot');
  await page.click('#camback [data-cb-row="0"] .cb-cell:not(.cur)[data-cb-set]'); await next(13, 'shutter');
  await ev(() => window.__ch.set({ meter: true })); await next(14, 'meter');
  await page.keyboard.press('Space'); await next(15, 'back to the scene');
  await waitStep('challenges');
  ok((await co()).done, 'the warm-up is done');
  ok(!/W A S D/.test(await page.$eval('#gdPop', (e) => e.textContent)), 'the challenges popup is short too');
  await page.click('#gdPop [data-gd="go"]'); await page.waitForTimeout(1500);
  ok(await page.$('#chMarks.show'), 'the frames unlock after the warm-up');
  await shot('4-unlocked');
  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  coach (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); try { console.error('STATE', JSON.stringify(await page.evaluate(() => ({ gd: window.__gd && window.__gd.state(), co: window.__co && window.__co.state(), pop: !!document.querySelector('#gdPop.show'), top: (() => { const b = document.querySelector('#gdPop [data-gd]'); if (!b) return null; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e && (e.id || e.className); })() })))); } catch (e2) {} if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; await shot('fail').catch(() => {}); }
finally { await browser.close(); }
