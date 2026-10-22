// Quests, phase 3: the teacher's Quests tab with sync off. Class checkpoint dates, three scripted students
// (ahead, on track, behind) plus one close, the preview student's real record, and ticking off a quest and a step.
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
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|supabase|net::ERR/i.test(m.text())) errors.push(m.text()); });
const ok = (c, m) => { if (!c) throw new Error(m); };
const ev = (f, a) => page.evaluate(f, a);
const iso = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
try {
  await page.goto(pathToFileURL(FILE).href + '?dev&full&quick');
  await page.waitForSelector('[data-si="teacher"]', { state: 'visible', timeout: 20000 }); await page.click('[data-si="teacher"]');
  await page.waitForSelector('[data-tc-tab="quests"]', { state: 'visible' }); await page.click('[data-tc-tab="quests"]');
  // checkpoint 1 a week ago, checkpoint 2 in a fortnight
  await ev((c) => window.__tcq.cps(c), { cp1: iso(-7), cp2: iso(14), cp3: iso(50) });
  const F = ['f1', 'f2', 'f3', 'f4', 'f5'];
  await ev((F) => window.__tcq.students([
    { name: 'Aroha H', done: [...F, 'm1', 'm2', 'm3', 'm4'], tracked: 'm5' },
    { name: 'Jack W', done: [...F, 'm1'], tracked: 'm2', step: [1, 3] },
    { name: 'Sione K', done: ['f1', 'f2', 'f3'], tracked: 'f4' },
    { name: 'Lucy T', done: [...F], tracked: 'm1' }]), F);
  const rows = Object.fromEntries((await ev(() => window.__tcq.rows())).map((r) => [r.name, r]));
  console.log(rows);
  ok(rows['Aroha H'].s === 'ahead', 'Aroha is ahead');
  ok(rows['Jack W'].s === 'on', 'Jack is on track');
  ok(rows['Sione K'].s === 'behind' && rows['Sione K'].cp === 'cp1', 'Sione is behind on checkpoint 1');
  ok(rows['Lucy T'].s === 'close', 'Lucy is close');
  ok(rows['Preview student'].s === 'behind', 'a fresh preview student is behind a past checkpoint');
  ok((await page.$$('.tq-rows .tq-r:not(.tq-hd)')).length === 5, 'five rows');
  ok((await page.textContent('.tq-rows')).includes('Two photographers') === false && (await page.textContent('.tq-rows')).includes('Your taste'), 'working-on column shows tracked quest titles');
  // the class's dates reach the student side
  const cp = await ev(() => window.__q.state().checkpoints); ok(cp[0].date === iso(-7), 'qCheckpoints uses the class dates');
  // tick off a quest for a scripted student
  await page.click('[data-tq-st="Sione K"]'); await page.click('[data-tq-tick="f4"]'); await page.click('[data-tq-tick="f5"]');
  ok((await ev(() => window.__tcq.rows())).find((r) => r.name === 'Sione K').s !== 'behind', 'ticking Sione\'s foundations lifts them off behind');
  // tick a step, then a quest, for the preview student (this computer's real record)
  await page.click('[data-tq-st="Preview student"]'); await page.click('[data-tq-open="f1"]');
  await page.click('[data-tq-tick="f1:0"]');
  ok(await ev(() => !!JSON.parse(localStorage.getItem('studium_quests_v1')).quests.f1.stepDone[0]), 'step ticked into the real record');
  await page.click('[data-tq-tick="f1"]');
  const q = await ev(() => JSON.parse(localStorage.getItem('studium_quests_v1')).quests.f1);
  ok(q.done && q.by === 'teacher', 'quest ticked off by the teacher');
  ok((await page.textContent('.tq-side')).includes('TICKED BY YOU'), 'marked as ticked by you');
  await page.click('[data-tq-st="Jack W"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, 'tc-quests.png') });
  // live: the tracked quest title replaces the activity label
  await page.click('[data-tc-tab="live"]'); await page.waitForTimeout(400);
  const em = await page.$$eval('.tl-st em', (e) => e.map((x) => x.textContent));
  ok(em.some((t) => /[a-z]/.test(t)), 'live cards show quest titles: ' + em.slice(0, 4).join(' | '));
  ok(!errors.length, 'page errors: ' + errors.join(' | '));
  console.log('PASS teacher quests');
} catch (e) { console.error('FAIL', e.message); console.error(errors.join('\n')); process.exitCode = 1; await page.screenshot({ path: join(OUT, 'tc-quests-fail.png') }).catch(() => {}); }
await browser.close();
