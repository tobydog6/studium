// README screenshots. Stages each room the way a student would leave it and saves JPEGs to docs/media/.
// Usage: node tools/shots.mjs [studio|scene|bag|banner|walk] ...   (default: studio scene bag banner)
//   studio  the rooms, from the Stump fixture frames (fast)
//   scene   the scan (slow: every frame of the scan takes a minute or two under SwiftShader)
//   bag     the camera bag's lens menu
//   banner  docs/media/banner.jpg, the wordmark over scene.jpg
//   walk    frames for docs/media/walk.webp, circling in on the stump (slower still; joined by tools/walk.py)
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'dist', 'studium.html');
const OUT = join(ROOT, 'docs', 'media'); mkdirSync(OUT, { recursive: true });
const FIX = join(ROOT, 'tests', 'fixtures');
const frames = readdirSync(FIX).filter((f) => f.endsWith('.jpg')).sort().map((f) => 'data:image/jpeg;base64,' + readFileSync(join(FIX, f)).toString('base64'));
const modes = process.argv.slice(2).length ? process.argv.slice(2) : ['studio', 'scene', 'bag', 'banner'];
const W = 1600, H = 1000;
const HIDE = '#prompt,#navCoach,#gdTrk,.toast,#toast{display:none!important}';

async function open(detail) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.addInitScript((d) => { try { localStorage.setItem('splat_tut_v1', '1'); localStorage.setItem('studium_guide_v1', 'off'); localStorage.setItem('studium_detail', d); localStorage.setItem('studium_v1', JSON.stringify({ who: { role: 'solo', name: 'Aroha' } })); } catch (e) {} }, detail);
  page.on('pageerror', (e) => console.log('page error:', String(e)));
  await page.goto(pathToFileURL(FILE).href + '?dev');
  await page.addStyleTag({ content: HIDE });
  return { browser, page };
}
const snap = (page, n, o = {}) => page.screenshot({ path: join(OUT, n + '.jpg'), type: 'jpeg', quality: 88, timeout: 900000, ...o }).then(() => console.log('  ' + n));
const slide = (page, id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const meta = [[2.8, '1/250', 200, 35], [8, '1/125', 400, 24], [4, '1/500', 200, 85], [5.6, '1/160', 400, 50], [11, '1/60', 800, 24], [2, '1/1000', 100, 85], [5.6, '1/250', 200, 50], [16, '1/30', 400, 35]];

if (modes.includes('studio')) {
  const { browser, page } = await open('test');
  const key = async (k, wait = 150) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
  await page.waitForSelector('#tileStudio', { state: 'visible', timeout: 20000 });
  await page.evaluate(([fs, meta]) => fs.forEach((u, i) => window.__cb.addPhoto({ url: u, f: meta[i][0], sh: meta[i][1], iso: meta[i][2], mm: meta[i][3], body: 'Full-frame DSLR', place: 'The Stump' })), [frames, meta]);
  await page.click('#tileStudio'); await page.waitForTimeout(800);

  // Select: picks, a reject, stars and a note
  for (const i of [0, 1, 3, 4, 5]) { await page.click(`[data-st-frame="${i}"]`); await key('KeyP', 80); }
  await page.click('[data-st-frame="7"]'); await key('KeyX', 80);
  await page.click('[data-st-frame="3"]'); await key('Digit5', 80);
  await page.click('[data-st-frame="0"]'); await key('Digit4', 80);
  await page.click('[data-st-frame="4"]'); await key('Digit4', 80);
  await page.click('[data-st-frame="3"]'); await page.waitForTimeout(500);
  await page.fill('#stWhy', 'The ivy climbs out of the dark and pulls your eye up the stump.'); await page.mouse.click(5, H - 5); await page.waitForTimeout(800);
  await snap(page, 'select');

  // Edit: a moody grade on the stump, with the Color Grading wheels open
  await key('Enter', 2500);
  for (const [id, v] of [['pExposure', 22], ['pContrast', 24], ['pHighlights', -45], ['pShadows', 55], ['pWhites', 18], ['pBlacks', -22], ['pTemp', 12], ['pVibrance', 28], ['pClarity', 18], ['pTexture', 12], ['pVignette', -22]]) await slide(page, id, v);
  // close Light, Color and Effects so the mixer and grading show; drag the three wheel dots
  for (const s of ['light', 'color', 'effects', 'mixer']) await page.click(`.lr-sec[data-sec="${s}"] .lr-secname`);
  await page.waitForTimeout(300);
  for (const [k, ang, r] of [['gSh', 200, 0.35], ['gMi', 40, 0.18], ['gHi', 55, 0.3]]) {
    const d = await (await page.$(`#lrGrade .cg-disc[data-cg="${k}"]`)).boundingBox();
    const x = d.x + d.width / 2 + Math.cos(ang * Math.PI / 180) * r * d.width / 2, y = d.y + d.height / 2 - Math.sin(ang * Math.PI / 180) * r * d.height / 2;
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2); await page.mouse.down(); await page.mouse.move(x, y, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(200);
  }
  await page.waitForFunction(() => !window.__dev || !window.__dev.pending(), null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(6000);
  await snap(page, 'edit');
  await page.click('#eSave').catch(async () => { await page.click('#eCancel'); }); await page.waitForTimeout(1500);

  // Workbook: Compare, two photos, an arrow onto a detail, a caption
  await page.click('[data-st-room="workshop"]'); await page.waitForTimeout(800);
  await page.click('#st-workshop [data-bd-tmpl="0"]'); await page.waitForTimeout(500);
  await page.dragAndDrop('#st-workshop .lib-grid [data-bd-pic="1"]', '#st-workshop .bd-it.sl'); await page.waitForTimeout(400);
  await page.dragAndDrop('#st-workshop .lib-grid [data-bd-pic="3"]', '#st-workshop .bd-it.sl'); await page.waitForTimeout(400);
  await page.click('#st-workshop .bd-tools [data-bd-act="arrow"]'); await page.waitForTimeout(400);
  const ph = await page.$$('#st-workshop .bd-it.ph'); const pb = await ph[1].boundingBox(); const hb = await (await page.$('#st-workshop [data-bd-h="b"]')).boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await page.mouse.move(pb.x + pb.width * 0.45, pb.y + pb.height * 0.55, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
  const texts = ['Low and close, the stump fills the frame. The ivy reads as texture, not background.', 'Stepping back at f/8 puts the stump in its place: it becomes one shape in the bush.', 'The arrow: the ivy is the only bright edge. Next time I want it lit from the side.'];
  for (let i = 1; i < 4; i++) { const tx = await page.$$('#st-workshop .bd-it.tx'); if (!tx[i]) break; const b = await tx[i].boundingBox(); if (!b) continue; await page.mouse.click(b.x + 20, b.y + b.height / 2); await page.waitForTimeout(250); await page.keyboard.type(texts[i - 1]); await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  await page.mouse.click(5, H - 5); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await snap(page, 'workbook');

  // Folio: fill all three thirds of panel 1, then the middle panel, one third at a time
  await page.click('[data-st-room="folio"]'); await page.waitForTimeout(800);
  const fill = async (z, pics, style) => {
    await page.hover('#st-folio .bd-sheet'); await page.click(`#st-folio [data-bd-zoom="${z}"]`); await page.waitForTimeout(400);
    for (const i of pics) { await page.click(`#st-folio .lib-grid [data-bd-pic="${i}"]`); await page.waitForTimeout(200); }
    if (style) { await page.click(`#st-folio [data-bd-style="${style}"]`); await page.waitForTimeout(300); }
    await page.click('#st-folio [data-bd-zoom="-1"]'); await page.waitForTimeout(400);
  };
  const zooms = await page.$$eval('#st-folio [data-bd-zoom]', (n) => n.map((e) => e.getAttribute('data-bd-zoom')).filter((z) => z !== '-1'));
  console.log('  folio sections', zooms.join(' '));
  const plan = [[[3, 0], null], [[4, 1, 5], null], [[2, 6], null], [[6, 3, 0, 1, 4], 'hero'], [[2, 5], null], [[5, 6, 1], null], [[4, 0, 2], null], [[3, 5, 2, 6], 'hero'], [[1, 4], null]];
  for (let s = 0; s < Math.min(zooms.length, plan.length); s++) await fill(zooms[s], plan[s][0], plan[s][1]);
  await page.mouse.click(W / 2, 140); await page.waitForTimeout(500);
  await snap(page, 'folio');

  // Book and Gallery build themselves from the picks
  await page.click('[data-st-room="book"]'); await page.waitForTimeout(1000);
  await page.click('#st-book [data-bk-spread="2"]').catch(() => {}); await page.waitForTimeout(600);
  await snap(page, 'book');
  await page.click('[data-st-room="gallery"]'); await page.waitForTimeout(1200);
  await page.click('#st-gallery [data-ga-frame="oak"]').catch(() => {}); await page.waitForTimeout(800);
  await snap(page, 'gallery');

  // the hub, now with a shoot behind it
  await page.keyboard.press('KeyH'); await page.waitForTimeout(1500);
  await snap(page, 'hub');
  await browser.close();
}

if (modes.includes('scene')) {
  const { browser, page } = await open(process.env.SHOT_DETAIL || 'balanced');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 });
  await page.click('#tileSplat'); await page.waitForSelector('.scenecard', { state: 'visible' }); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 600000 });
  await page.waitForTimeout(8000);
  await snap(page, process.env.SHOT_NAME || 'scene');
  await browser.close();
}

if (modes.includes('bag')) {
  // the camera bag's lens menu. Its animations step once per drawn frame, so the scan behind it loads at test detail
  const { browser, page } = await open('test');
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 });
  await page.click('#tileSplat'); await page.waitForSelector('.scenecard', { state: 'visible' }); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 600000 }); await page.waitForTimeout(1500);
  await page.keyboard.press('KeyB'); await page.waitForTimeout(400);
  await page.screenshot({ timeout: 900000 });   // let the bag draw its first frames before the lens menu
  await page.keyboard.press('KeyL'); await page.waitForTimeout(600);
  await snap(page, 'bag');
  await browser.close();
}

if (modes.includes('walk')) {
  // a slow walk in towards the stump, turning a little; one PNG per frame in docs/media/walk/
  const { browser, page } = await open(process.env.SHOT_DETAIL || 'test');
  await page.setViewportSize({ width: 800, height: 500 });
  mkdirSync(join(OUT, 'walk'), { recursive: true });
  await page.waitForSelector('#tileSplat', { state: 'visible', timeout: 20000 });
  await page.click('#tileSplat'); await page.waitForSelector('.scenecard', { state: 'visible' }); await page.click('.scenecard');
  await page.waitForFunction(() => window.__cb && window.__cb.state() === 'scene', null, { timeout: 600000 });
  await page.waitForTimeout(6000);
  const p0 = await page.evaluate(() => window.__cb.pose());
  const N = +(process.env.WALK_FRAMES || 40);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), e = t * t * (3 - 2 * t);
    // circle in on the stump, keeping it in the middle of the view
    const S = { x: p0.x, z: p0.z - 2.2 }, th = -0.6 * e, r = 2.2 - 0.7 * e, x = S.x + r * Math.sin(th), z = S.z + r * Math.cos(th);
    await page.evaluate((o) => window.__cb.pose(o), { x, z, yaw: Math.atan2(-(S.x - x), -(S.z - z)), pitch: -0.12 - 0.12 * e });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, 'walk', String(i).padStart(3, '0') + '.png'), timeout: 900000 });
    console.log('  walk', i + 1, '/', N);
  }
  await browser.close();
}

if (modes.includes('banner')) {
  // docs/media/banner.jpg: the wordmark over the scan, from scene.jpg (run 'scene' first), in the app's own type and gold
  const f = (p) => pathToFileURL(join(ROOT, p)).href;
  const html = `<!doctype html><meta charset="utf-8"><style>
  @font-face{font-family:Fraunces;src:url(${f('assets/fonts/fraunces.woff2')});font-weight:100 900}
  @font-face{font-family:Geist;src:url(${f('assets/fonts/geist.woff2')});font-weight:100 900}
  @font-face{font-family:'Geist Mono';src:url(${f('assets/fonts/geist-mono.woff2')})}
  html,body{margin:0;background:#0c0b0a}
  .b{position:relative;width:1280px;height:440px;overflow:hidden;background:#0c0b0a;color:#f4f1ea}
  .sc{position:absolute;right:0;top:0;width:860px;height:440px;background:url(${f('docs/media/scene.jpg')}) 46% -262px/1240px auto no-repeat;
    -webkit-mask:linear-gradient(90deg,transparent 0,#000 46%),linear-gradient(0deg,transparent 0,#000 16%);-webkit-mask-composite:source-in;filter:saturate(.92) contrast(1.04)}
  .vf{position:absolute;left:640px;top:62px;width:520px;height:316px}
  .vf i{position:absolute;width:26px;height:26px;border:0 solid #e3ad57}
  .vf i:nth-child(1){left:0;top:0;border-left-width:2px;border-top-width:2px}.vf i:nth-child(2){right:0;top:0;border-right-width:2px;border-top-width:2px}
  .vf i:nth-child(3){left:0;bottom:0;border-left-width:2px;border-bottom-width:2px}.vf i:nth-child(4){right:0;bottom:0;border-right-width:2px;border-bottom-width:2px}
  .ex{position:absolute;left:640px;top:392px;width:520px;display:flex;justify-content:space-between;font:500 12px 'Geist Mono';letter-spacing:.16em;color:rgba(244,241,234,.78)}
  .ex em{font-style:normal;color:#e3ad57}
  .tx{position:absolute;left:72px;top:0;height:440px;display:flex;flex-direction:column;justify-content:center;width:560px}
  .k{font:500 12px 'Geist Mono';letter-spacing:.22em;color:#e3ad57;margin-bottom:18px}
  h1{font:400 112px/0.9 Fraunces;letter-spacing:-.025em;margin:0 0 22px;font-variation-settings:'opsz' 144}
  p{font:italic 300 22px/1.38 Fraunces;color:#d9d2c3;margin:0 0 30px;max-width:470px}
  .st{display:flex;gap:14px;align-items:center;font:500 12px 'Geist Mono';letter-spacing:.2em;color:#7c7568}
  .st span:first-child{color:#e3ad57}.st s{width:22px;height:1px;background:#3a3326;text-decoration:none}
  </style><div class="b"><div class="sc"></div><div class="vf"><i></i><i></i><i></i><i></i></div>
  <div class="ex"><span><em>f/5.6</em></span><span>1/250</span><span>ISO 400</span><span>50 MM</span><span>+0.0 EV</span></div>
  <div class="tx"><div class="k">VISUAL ART · YEARS 11–13</div><h1>Studium</h1><p>Walk into a real place, shoot it with a real camera, and build the folio.</p>
  <div class="st"><span>SHOOT</span><s></s><span>PICK</span><s></s><span>EDIT</span><s></s><span>MAKE</span><s></s><span>SHOW</span></div></div></div>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 440 }, deviceScaleFactor: 2 });
  const tmp = join(OUT, '.banner.html'); (await import('node:fs')).writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href); await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, 'banner.jpg'), type: 'jpeg', quality: 90 }); (await import('node:fs')).unlinkSync(tmp);
  console.log('  banner'); await browser.close();
}
