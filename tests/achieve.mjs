// Quests, phase 5: achievements. One from each category (with a tier upgrade and a secret), a near-miss nudge,
// the real shutter recording capture data, the unlock card (screenshot), Pin to workbook, showcase, and the wall (screenshot).
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
await page.addInitScript(() => { try { localStorage.setItem('studium_detail', 'test'); localStorage.setItem('studium_looked', '1'); } catch (e) {} });
const errors = [], toasts = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const A = () => ev(() => window.__ach.state());
const has = async (k) => (await A()).earned.includes(k);
let U = null;
const shot = async (o) => { if (U) o.url = U; await ev((p) => { window.__cb.addPhoto(p); window.__ach.shot(); }, o); };
const cap = (o) => Object.assign({ pos: [0, 1.6, 0], yaw: 0, pitch: 0, low: false, focus: 0.5, vert: false, ms: Date.now(), body: 'dslr', eq: 50, S: 1, lights: [], sunAng: null, still: 0 }, o);
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick');
  await page.waitForSelector('[data-si="solo"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="solo"]');
  await page.waitForSelector('#tileSplat', { state: 'attached', timeout: 20000 }); await page.$eval('#tileSplat', (b) => b.click());
  await page.waitForSelector('.scenecard', { state: 'visible', timeout: 10000 }); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 300000 });
  await ev(() => window.__qu.closeAll());
  ok((await A()).of === 51, '51 achievements');
  // the real shutter records capture data
  await page.keyboard.press('KeyP'); await page.waitForTimeout(1500); await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
  const c0 = await ev(() => window.__ach.last()); ok(c0 && c0.pos && typeof c0.pitch === 'number' && 'still' in c0 && c0.body, 'capture data on the frame: ' + JSON.stringify(c0));
  await page.keyboard.press('KeyP'); await page.waitForTimeout(600);
  U = await ev(() => window.__ach.url()); ok(U, 'a real frame to print from');
  // Light: a near miss, then Rembrandt
  await page.exposeFunction('__toast', (t) => toasts.push(t));
  await ev(() => { const el = document.getElementById('toast'); if (el) new MutationObserver(() => window.__toast(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true }); });
  await shot({ url: 'r0', f: 8, sh: '1/125', iso: 400, ev: 0, light: { time: 'night', on: true, lights: [{}] }, cap: cap({ lights: [{ fx: 'fresnel', gel: 'None', k: 3200, ang: 24, h: 0.6 }] }) });
  await page.waitForTimeout(1300);
  ok(toasts.some((t) => /So close to Rembrandt/.test(t)), 'near-miss nudge: ' + toasts.join(' | '));
  await shot({ url: 'r1', f: 8, sh: '1/125', iso: 400, ev: 0, light: { time: 'night', on: true, lights: [{}] }, cap: cap({ lights: [{ fx: 'fresnel', gel: 'None', k: 3200, ang: 45, h: 0.6 }] }) });
  ok(await has('rembrandt'), 'Rembrandt');
  await shot({ url: 'g', f: 8, sh: '1/250', iso: 100, ev: 0.2, light: { time: 'golden' }, cap: cap({ sunAng: 20 }) });
  ok(await has('golden-hour') && await has('into-the-sun'), 'Golden Hour and Into the Sun');
  // tiers: Night Owl bronze, then silver
  for (let i = 0; i < 5; i++) await shot({ url: 'n', f: 2, sh: '1/30', iso: 1600, ev: 0, light: { time: 'night' }, cap: cap({}) });
  ok(await has('night-owl:1') && !(await has('night-owl:2')), 'Night Owl bronze');
  for (let i = 0; i < 20; i++) await ev((p) => window.__cb.addPhoto(p), { url: 'n', light: { time: 'night' }, cap: cap({}) });
  await ev(() => window.__ach.shot());
  ok(await has('night-owl:2'), 'Night Owl silver: a tier upgrade');
  // Camera, Seeing, Secret
  await shot({ url: 'w', lens: '85', f: 1.4, sh: '1/500', iso: 100, ev: 0, cap: cap({ focus: 0.05 }) }); ok(await has('whisper'), 'Whisper');
  await shot({ url: 'u', f: 8, sh: '1/125', iso: 100, ev: 0, cap: cap({ low: true, pitch: 42 }) }); ok(await has('worms-eye'), "Worm's Eye");
  await shot({ url: 'k', f: 16, sh: '1/1000', iso: 100, ev: -4.6, cap: cap({}) }); ok(await has('lens-cap'), 'Lens Cap (secret)');
  // Choosing, Looking, Your own way (the slow checks)
  await ev(() => { for (let i = 0; i < 10; i++) window.__cb.addPhoto({ url: 'x', reject: true }); for (let i = 0; i < 5; i++) window.__cb.addPhoto({ url: 'y', pick: true, note: 'The shadow leads your eye to the stump.' }); window.__q.research('details', null, 3); });
  await ev(() => window.__ach.event('cull', { pack: 'p1', s: 41, top: 'a' }));
  await ev(() => window.__ach.sweep());
  ok(await has('ruthless:1') && await has('noticer:1') && await has('punctum:1') && await has('gut-instinct'), 'Ruthless, Noticer, Punctum, Gut Instinct: ' + (await A()).earned.join(','));
  await ev(() => window.__ach.event('bounds')); ok(await has('off-the-map'), 'Off the Map');
  const st = await A(); console.log('earned', st.n, '/', st.of, st.earned.join(' '));
  const cats = await ev(() => { const s = window.__ach.state(), o = {}; s.earned.forEach((k) => { const id = k.split(':')[0]; const c = window.__ach.cat(id); o[c] = (o[c] || 0) + 1; }); return o; });
  for (const c of ['light', 'camera', 'seeing', 'choosing', 'looking', 'own', 'secret']) ok(cats[c] > 0, 'one from ' + c + ': ' + JSON.stringify(cats));
  // the unlock card: the full print opens with the camera down
  await page.waitForFunction(() => { const s = window.__ach.state(); return s.card && s.card.full; }, null, { timeout: 30000, polling: 500 });
  await page.waitForTimeout(3000); await page.addStyleTag({ content: '.ach-card .dev{animation:none!important;opacity:0!important}.ach-card{transition:none!important}' }); await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, 'ach-card.png') });
  const before = await ev(() => window.__ach.pages());
  await page.$eval('#achCard [data-ach="pin"]', (b) => b.click()); ok(await ev(() => window.__ach.pages()) === before + 1, 'Pin to workbook makes an Annotate page');
  await page.$eval('#achCard [data-ach="show"]', (b) => b.click()); ok((await A()).showcase.length === 1, 'showcase');
  await ev(() => { window.__ach.next(); for (let i = 0; i < 40; i++) window.__ach.next(); });
  // the wall
  await ev(() => window.__qu.log()); await page.$eval('[data-q="taba"]', (b) => b.click()); await page.waitForTimeout(800);
  ok((await page.$$('.ach-tile')).length === 51, 'the wall shows all 51');
  ok((await page.$$('.ach-tile.got')).length === st.n, 'earned prints on the wall');
  ok(await page.textContent('.ach-tile.secret') .then((t) => /Undeveloped/.test(t)), 'secret ones undeveloped');
  await page.screenshot({ path: join(OUT, 'ach-wall.png') });
  ok(!errors.length, 'page errors: ' + errors.join(' | '));
  console.log('PASS achievements');
} catch (e) { console.error('FAIL', e.message); console.error(errors.join('\n')); process.exitCode = 1; await page.screenshot({ path: join(OUT, 'ach-fail.png') }).catch(() => {}); }
await browser.close();
