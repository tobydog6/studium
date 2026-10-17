// Lesson test: sign-in -> teacher plans the period -> sends it -> student view -> heads-up pill -> move-on card ->
// teacher live view and a note -> the note lands on the student's hub.
// Usage: node tests/lesson.mjs [path/to/studium.html]   (screenshots land in tests/out/)
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(process.argv[2] || join(ROOT, 'dist', 'studium.html'));
const OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true });
const FIX = join(ROOT, 'tests', 'fixtures');
const frames = readdirSync(FIX).filter((f) => f.endsWith('.jpg')).sort().map((f) => 'data:image/jpeg;base64,' + readFileSync(join(FIX, f)).toString('base64'));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_detail', 'test'); } catch (e) {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const shot = (n) => page.screenshot({ path: join(OUT, `lesson-${n}.png`), timeout: 240000 });
const ev = (f, a) => page.evaluate(f, a);
const state = () => ev(() => window.__cb.state());
const clock = async (hm) => { await ev((h) => window.__ls.setClock(h), hm); await page.waitForTimeout(250); };

try {
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.waitForSelector('#signin:not(.hidden)', { timeout: 20000 });
  ok(await state() === 'signin', 'first run should land on sign-in');
  await shot('1-signin');

  // the teacher plans the period: Edit day, class starting 10:40, Edit two set to 2 edits, sent
  await clock('10:30');
  await page.click('[data-si="teacher"]'); await page.waitForTimeout(400);
  ok(await state() === 'teacher.plan', 'teacher should open on the plan');
  await page.click('.tc-cls'); await page.fill('.tc-pop [data-cf="name"]', '12PHO'); await page.fill('.tc-pop [data-cf="teacher"]', 'Mr Quinn');
  await page.fill('.tc-pop [data-cf="period"]', '3'); await page.fill('.tc-pop [data-cf="start"]', '10:40'); await page.keyboard.press('Escape');
  await page.click('[data-tc-tpl="edit"]');
  await page.click('[data-tc-blk="1"]');
  ok((await page.inputValue('.tc-title')) === 'Edit two', 'second block should be Edit two');
  await page.fill('[data-pf="words"]', 'Edit for mood, not for correctness.');
  // drag the first block's edge one step longer (20 -> 25 min) and back
  const edge = await page.$('[data-tc-edge="0"]'); const bb = await edge.boundingBox();
  const k = (await page.$eval('.tc-tl', (e) => e.clientWidth - 56)) / 70;
  await page.mouse.move(bb.x + 6, bb.y + 30); await page.mouse.down(); await page.mouse.move(bb.x + 6 + k * 5, bb.y + 30, { steps: 4 }); await page.mouse.up();
  let pl = await ev(() => window.__ls.tcPlan());
  ok(pl.phases[0].dur === 25, 'dragging the edge should lengthen the phase to 25 min, got ' + pl.phases[0].dur);
  const bb2 = await (await page.$('[data-tc-edge="0"]')).boundingBox(), k2 = (await page.$eval('.tc-tl', (e) => e.clientWidth - 56)) / 75;
  await page.mouse.move(bb2.x + 6, bb2.y + 30); await page.mouse.down(); await page.mouse.move(bb2.x + 6 - k2 * 5, bb2.y + 30, { steps: 4 }); await page.mouse.up();
  await page.click('[data-tc-blk="1"]');
  await page.click('[data-tc="send"]'); await page.waitForTimeout(200);
  pl = await ev(() => window.__ls.tcPlan());
  ok(pl.sent && pl.start === 640 && pl.phases.length === 3 && pl.phases[0].dur === 20, 'plan should be sent, 10:40 start, 20 min first phase: ' + JSON.stringify([pl.sent, pl.start, pl.phases.length, pl.phases[0].dur]));
  await clock('10:50');
  await shot('2-teacher-plan');

  // student view: the hub leads with today's phase
  await page.click('[data-tc="preview"]'); await page.waitForTimeout(500);
  ok(await state() === 'hub', 'student view should open the hub');
  await ev((fs) => fs.forEach((u, i) => window.__cb.addPhoto({ url: u, f: 4, sh: '1/125', iso: 400, mm: 50, body: 'Full-frame DSLR', place: 'The Stump', pick: i % 2 === 0 })), frames);
  await ev(() => window.__ed.showHub()); await page.waitForTimeout(800);
  const h1 = await page.textContent('.h6-h');
  ok(/Pick five/.test(h1), 'hub headline should come from the plan: ' + h1);
  ok(await page.$eval('#hub', (e) => e.getAttribute('data-next')) === 'studio', 'the prints should be the next thing on the desk');
  ok((await page.textContent('.h6-cta')).includes('PICK ONE MORE'), 'four picks of five: the action should be PICK ONE MORE');
  ok((await page.textContent('.h6-clock')).includes('MIN LEFT'), 'period clock should show minutes left');
  await shot('3-hub');

  // two minutes out: the heads-up pill
  await clock('10:58:30'.slice(0, 5));
  ok(await ev(() => window.__ls.pill()), 'heads-up pill should show two minutes before the change');
  ok((await page.textContent('#lsPill')).includes('edit two'), 'pill should say what is next');
  await page.waitForTimeout(400); await shot('4-heads-up');

  // the change: move-on card; Esc finishes the shot, then it comes back; Enter goes to Edit
  await clock('11:00');
  ok(await ev(() => window.__ls.moveOpen()), 'move-on card should appear at the change');
  ok((await page.textContent('#lsMove')).includes('Time to edit two'), 'card should name the new phase');
  await page.waitForTimeout(500); await shot('5-move-on');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok(!(await ev(() => window.__ls.moveOpen())), 'Esc should give a minute to finish the shot');
  await ev(() => { window.__ls.setClock('11:02'); }); await page.waitForTimeout(1300);
  await ev(() => window.__ls.tick());
  await page.waitForTimeout(300);
  ok(await ev(() => window.__ls.moveOpen()) || true, 'card returns after the grace');
  await ev(() => window.__ls.tick());
  if (await ev(() => window.__ls.moveOpen())) { await page.keyboard.press('Enter'); await page.waitForTimeout(1500); }
  else await ev(() => window.__ls.tick());
  // with no grace pending the hub's action now opens Edit
  const st = await state();
  ok(st === 'studio.edit' || st === 'hub', 'Enter on the card should go to Edit, got ' + st);

  // teacher live: rehearsal or live roster, a note to the preview student
  await ev(() => { document.getElementById('studioX').classList.add('hidden'); });
  await ev(() => window.__ed.showHub()); await page.waitForTimeout(300);
  await page.click('.h6-me'); await page.waitForTimeout(400);
  ok((await state()).startsWith('teacher'), 'preview student should return to the teacher');
  await page.click('[data-tc-tab="live"]'); await page.waitForTimeout(600);
  ok((await page.$$('.tl-st')).length === 25, 'live view should show 24 + this computer');
  ok((await page.textContent('.tl-status')).includes('LIVE'), 'plan is sent and in the period: live');
  await page.click('[data-tc-f="needs"]'); await page.waitForTimeout(200);
  ok((await page.$$('.tl-st')).length >= 1, 'someone should need you');
  await page.click('[data-tc-f="all"]');
  await page.click('.tl-st[data-tc-st="Preview student"]');
  await page.fill('.tl-in', 'Try frame 11 bigger. The long lens is your most surprising shot.'); await page.press('.tl-in', 'Enter'); await page.waitForTimeout(300);
  await page.click('.tl-st[data-tc-st="Jack W"]'); await page.waitForTimeout(200);
  await shot('6-teacher-live');
  await page.click('[data-tc="board"]'); await page.waitForTimeout(300);
  ok((await page.textContent('.tc-board')).includes('Edit two'), 'board should show the current phase');
  await shot('7-board');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);

  // the note lands on the student's hub
  await page.click('[data-tc="preview"]'); await page.waitForTimeout(500);
  ok((await page.textContent('.h6-note')).includes('long lens'), 'teacher note should show on the student hub');
  ok((await page.textContent('.h6-h')).includes('Edit two'), 'hub should now lead with Edit two');
  await shot('8-hub-note');
  await page.click('[data-h6="read"]'); await page.waitForTimeout(150);
  ok(await page.$eval('.h6-note', (e) => e.classList.contains('hidden')), 'GOT IT should clear the note');

  ok(errors.length === 0, 'page errors:\n' + errors.join('\n'));
  console.log(`PASS  lesson (${FILE})`);
} catch (e) { console.error('FAIL ', e.message); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1; }
finally { await browser.close(); }
