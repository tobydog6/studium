// The DVD shelf: Sam's photographer talks as real DVD cases on oak shelves. Pull one out, open it, the disc goes into
// a player, and the player's screen grows to fill the room and plays (YouTube's no-cookie embed). Runs in its own
// iframe like the light table; talks to Studium only through window.parent.DVD_BRIDGE (data, sfx, keys).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
/* material maps baked in Blender (design/dvd/bake_textures.py) */
import oakCol from './tex/oak_col.jpg';
import oakRough from './tex/oak_rough.jpg';
import oakNrm from './tex/oak_nrm.jpg';
import wallCol from './tex/wall_col.jpg';
import wallNrm from './tex/wall_nrm.jpg';
import sleeveRough from './tex/sleeve_rough.jpg';

const BR = (() => { try { return window.parent && window.parent !== window ? window.parent.DVD_BRIDGE || null : null; } catch (e) { return null; } })();
const DATA = (BR && BR.data && BR.data()) || window.DVD_DEV || { vids: [] };
if (BR) document.body.classList.add('inapp');   /* inside Studium the room's own bar names the shelf */
const VIDS = DATA.vids;   /* [{id, a, t, s}] */
const sfx = (id) => { try { if (BR && BR.sfx) BR.sfx(id); } catch (e) {} };
const thumbUrl = DATA.thumb || ((id) => 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg');
const canEmbed = DATA.canEmbed != null ? DATA.canEmbed : /^https?:$/.test(location.protocol);
const $ = (s) => document.querySelector(s);
const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, easeOut = (t) => 1 - Math.pow(1 - t, 3);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- renderer, scene ---------------- */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
RectAreaLightUniformsLib.init();
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0908);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .2;
scene.fog = new THREE.Fog(0x0b0908, 22, 44);
const camera = new THREE.PerspectiveCamera(30, 1, .1, 100); scene.add(camera);
const aniso = renderer.capabilities.getMaxAnisotropy();
const TL = new THREE.TextureLoader();
function img(url, color) { const t = TL.load(url); t.anisotropy = aniso; if (color) t.colorSpace = THREE.SRGBColorSpace; return t; }
function rep(t, x, y) { const c = t.clone(); c.wrapS = c.wrapT = THREE.MirroredRepeatWrapping; c.repeat.set(x, y); c.needsUpdate = true; return c; }
function ctex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }
const T = { oakCol: img(oakCol, 1), oakRough: img(oakRough), oakNrm: img(oakNrm), wallCol: img(wallCol, 1), wallNrm: img(wallNrm), wear: img(sleeveRough) };
const wear = rep(T.wear, 1, 1);

/* ---------------- what's on the shelves: groups by photographer, packed into rows ---------------- */
const W = 1.35, H = 1.9, D = .16, STEP = .56, GAP = .85, ROWH = 2.7, ROWMAX = 9.4;
const groups = []; VIDS.forEach((v, i) => { let g = groups[groups.length - 1]; if (!g || g.a !== v.a) groups.push(g = { a: v.a, items: [] }); g.items.push(i); });
const gw = (g) => (g.items.length - 1) * STEP + W * .6;
const rows = []; groups.forEach((g) => { let r = rows[rows.length - 1]; const w = gw(g); if (!r || r.w + GAP + w > ROWMAX) rows.push(r = { gs: [], w: -GAP }); r.gs.push(g); r.w += GAP + w; });
const SL = Math.max(...rows.map((r) => r.w)) + 2.2, ST = .16, SD = 1.3;
const rowY = (k) => (rows.length - 1 - k) * ROWH;
const wallMid = rowY(0) / 2 + .9;

/* ---------------- the room ---------------- */
const wall = new THREE.Mesh(new THREE.PlaneGeometry(70, 30), new THREE.MeshStandardMaterial({ map: rep(T.wallCol, 10, 4.3), normalMap: rep(T.wallNrm, 10, 4.3), normalScale: new THREE.Vector2(1.4, 1.4), roughness: .93, color: 0x9a8f84 }));
wall.position.set(0, wallMid, -1.05); wall.receiveShadow = true; scene.add(wall);
const shelfMat = new THREE.MeshPhysicalMaterial({ map: rep(T.oakCol, SL / 4.5, 1), roughnessMap: rep(T.oakRough, SL / 4.5, 1), normalMap: rep(T.oakNrm, SL / 4.5, 1), normalScale: new THREE.Vector2(.8, .8), roughness: 1, clearcoat: .25, clearcoatRoughness: .45, sheen: .2, sheenRoughness: .6, sheenColor: new THREE.Color(0x6b4a2e) });
const shelfGeo = new RoundedBoxGeometry(SL, ST, SD, 3, .025);
rows.forEach((r, k) => { const y = rowY(k);
  const s = new THREE.Mesh(shelfGeo, shelfMat); s.position.set(0, y - ST / 2, -.4); s.castShadow = s.receiveShadow = true; scene.add(s);
  const wash = new THREE.RectAreaLight(0xffd9a6, 5, SL - .3, .05); wash.position.set(0, y - ST - .02, .2); wash.lookAt(0, y - 3, -1.05); scene.add(wash);
  for (let x = -SL / 2 + 2; x < SL / 2; x += 3.6) { const sp = new THREE.SpotLight(0xffe3bd, 55, 12, .42, .9, 1.4); sp.position.set(x, y + 3.6, 2.6); sp.target.position.set(x, y + .7, -1); scene.add(sp, sp.target); } });
const key = new THREE.SpotLight(0xfff0dc, 230, 50, .5, .75, 1.4); key.position.set(-4, wallMid + 8, 9); key.target.position.set(0, wallMid, -.6);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0003; key.shadow.radius = 5; key.shadow.camera.near = 4; key.shadow.camera.far = 30; scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x8fa6ff, .18); rim.position.set(8, 4, 5); scene.add(rim);
/* a soft key that rides with the camera, so whatever's in your hands is lit */
const handLight = new THREE.PointLight(0xfff2e0, 9, 14, 1.6); handLight.position.set(-2.5, 2.2, 1); camera.add(handLight);

/* ---------------- textures drawn in Studium's type ---------------- */
function crop(g, im, x, y, w, h) { if (!im) return; let sx = 0, sy = 0, sw = im.width, sh = im.height;
  if (sh / sw > .7) { sh = sw * 9 / 16; sy = (im.height - sh) / 2; }   /* hqdefault letterboxes 16:9 videos: cut the bars */
  const s = Math.max(w / sw, h / sh), cw = w / s, ch = h / s; g.drawImage(im, sx + (sw - cw) / 2, sy + (sh - ch) / 2, cw, ch, x, y, w, h); }
function wrap(g, t, x, y, w, lh, max) { let line = '', n = 0; const words = t.split(' ');
  for (let k = 0; k < words.length; k++) { const s = line ? line + ' ' + words[k] : words[k]; if (g.measureText(s).width > w && line) { if (n === max - 1) { line += '…'; break; } g.fillText(line, x, y + n++ * lh); line = words[k]; } else line = s; }
  g.fillText(line, x, y + n * lh); }
function drawCover(c, v, i, im) { const Wc = 900, Hc = 1266, g = c.getContext('2d'), ph = 820; g.setTransform(c.width / Wc, 0, 0, c.height / Hc, 0, 0);
  g.fillStyle = '#121110'; g.fillRect(0, 0, Wc, Hc);
  if (im) crop(g, im, 0, 0, Wc, ph); else { const gr = g.createLinearGradient(0, 0, Wc, ph); gr.addColorStop(0, '#2a2520'); gr.addColorStop(1, '#141210'); g.fillStyle = gr; g.fillRect(0, 0, Wc, ph);
    g.fillStyle = 'rgba(227,173,87,.18)'; g.font = '300 520px Fraunces'; g.textBaseline = 'alphabetic'; g.fillText(v.a[0], 60, 640); }
  let gr = g.createLinearGradient(0, ph - 360, 0, ph); gr.addColorStop(0, 'rgba(18,17,16,0)'); gr.addColorStop(1, 'rgba(18,17,16,1)'); g.fillStyle = gr; g.fillRect(0, ph - 360, Wc, 361);
  gr = g.createLinearGradient(0, 0, 0, 150); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, Wc, 150);
  g.textBaseline = 'top'; g.letterSpacing = '6px'; g.font = '500 22px "Geist Mono"'; g.fillStyle = '#f4f1ea'; g.textAlign = 'left'; g.fillText('STUDIUM', 56, 52);
  g.textAlign = 'right'; g.fillStyle = 'rgba(244,241,234,.75)'; g.fillText('No. ' + String(i + 1).padStart(2, '0'), Wc - 56, 52); g.textAlign = 'left';
  g.fillStyle = '#e3ad57'; g.fillRect(56, ph + 36, 64, 3);
  g.letterSpacing = '0px'; g.fillStyle = '#f4f1ea'; let fs = 92; g.font = '300 ' + fs + 'px Fraunces'; while (g.measureText(v.a).width > Wc - 112 && fs > 40) { fs -= 4; g.font = '300 ' + fs + 'px Fraunces'; }
  g.fillText(v.a, 52, ph + 70);
  g.font = '400 34px Geist'; g.fillStyle = 'rgba(244,241,234,.74)'; wrap(g, v.t, 56, ph + 92 + fs, Wc - 112, 44, 3);
  g.font = '500 18px "Geist Mono"'; g.letterSpacing = '5px'; g.fillStyle = 'rgba(244,241,234,.4)'; g.fillText('PHOTOGRAPHERS ON PHOTOGRAPHY', 56, Hc - 74); g.letterSpacing = '0px'; }
function drawSpine(c, v, i) { const g = c.getContext('2d'); g.setTransform(c.width / 100, 0, 0, c.height / 1266, 0, 0);
  g.fillStyle = '#141312'; g.fillRect(0, 0, 100, 1266); g.save(); g.translate(50, 0); g.rotate(Math.PI / 2); g.textBaseline = 'middle';
  g.fillStyle = '#e3ad57'; g.font = '500 20px "Geist Mono"'; g.fillText(String(i + 1).padStart(2, '0'), 44, 0);
  g.fillStyle = '#f4f1ea'; g.font = '300 40px Fraunces'; g.fillText(v.a, 120, 2); const aw = g.measureText(v.a).width;
  g.fillStyle = 'rgba(244,241,234,.55)'; g.font = '400 24px Geist'; g.fillText(v.t, 148 + aw, 2); g.restore(); }
function drawDisc(c, v, im) { const g = c.getContext('2d'), R = 512; g.setTransform(c.width / 1024, 0, 0, c.height / 1024, 0, 0); g.clearRect(0, 0, 1024, 1024);
  g.save(); g.beginPath(); g.arc(R, R, 470, 0, 7); g.clip();
  if (im) crop(g, im, R - 470, R - 470, 940, 940); else { g.fillStyle = '#1d1a17'; g.fillRect(0, 0, 1024, 1024); }
  g.fillStyle = 'rgba(12,11,10,.35)'; g.fillRect(0, 0, 1024, 1024);
  const gr = g.createLinearGradient(0, 600, 0, 980); gr.addColorStop(0, 'rgba(12,11,10,0)'); gr.addColorStop(1, 'rgba(12,11,10,.9)'); g.fillStyle = gr; g.fillRect(0, 600, 1024, 400); g.restore();
  g.textAlign = 'center'; g.fillStyle = '#f4f1ea'; g.font = '300 58px Fraunces'; g.fillText(v.a, R, 800);
  g.font = '500 20px "Geist Mono"'; g.letterSpacing = '6px'; g.fillStyle = '#e3ad57'; g.fillText('STUDIUM', R, 300); g.letterSpacing = '0px';
  /* the clear hub and the hole */
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(R, R, 160, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
  g.beginPath(); g.arc(R, R, 160, 0, 7); g.arc(R, R, 64, 0, 7, true); g.fillStyle = 'rgba(200,205,215,1)'; g.fill('evenodd');
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(R, R, 64, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
function edgeTex() { const c = document.createElement('canvas'); c.width = 64; c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#0c0c0c'; g.fillRect(0, 0, 64, 512);
  for (let x = 6; x < 58; x += 3) { g.fillStyle = x % 2 ? '#1a1a1a' : '#111'; g.fillRect(x, 0, 1.5, 512); } return ctex(c); }
function trayTex() { const c = document.createElement('canvas'); c.width = 512; c.height = 720; const g = c.getContext('2d'); g.fillStyle = '#0d0d0e'; g.fillRect(0, 0, 512, 720);
  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 3; [220, 206, 70].forEach((r) => { g.beginPath(); g.arc(256, 360, r, 0, 7); g.stroke(); });
  g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(28, 40, 6, 640); return ctex(c); }

/* ---------------- the cases: a tray and a hinged lid, a disc inside ---------------- */
const plastic = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0b, roughness: .55, roughnessMap: wear, clearcoat: .8, clearcoatRoughness: .5, clearcoatRoughnessMap: wear });
const inner = new THREE.MeshPhysicalMaterial({ map: trayTex(), roughness: .6, clearcoat: .4, clearcoatRoughness: .6 });
const edgeMat = new THREE.MeshStandardMaterial({ map: edgeTex(), roughness: .5 });
const halfGeo = new RoundedBoxGeometry(W, H, D / 2, 2, .012);
const discGeo = new THREE.CylinderGeometry(.6, .6, .012, 96); discGeo.rotateX(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(.068, .075, .028, 40); hubGeo.rotateX(Math.PI / 2);
const discUnder = new THREE.MeshPhysicalMaterial({ color: 0xd8dbe0, metalness: 1, roughness: .12, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [150, 900] });
const discEdge = new THREE.MeshPhysicalMaterial({ color: 0xcfd3da, metalness: .6, roughness: .2, transmission: 0 });
const cases = [], labels = [];
rows.forEach((r, k) => { let x = -r.w / 2; const y = rowY(k);
  r.gs.forEach((gp) => { labels.push({ a: gp.a, x, y, w: gw(gp), row: k });
    gp.items.forEach((i, n) => { const v = VIDS[i];
      const coverC = document.createElement('canvas'); coverC.width = 600; coverC.height = 844; drawCover(coverC, v, i, null);
      const discC = document.createElement('canvas'); discC.width = discC.height = 512; drawDisc(discC, v, null);
      const spC = document.createElement('canvas'); spC.width = 64; spC.height = 844; drawSpine(spC, v, i);
      const coverT = ctex(coverC), discT = ctex(discC), spT = ctex(spC);
      const sleeve = new THREE.MeshPhysicalMaterial({ map: coverT, roughness: .5, clearcoat: 1, clearcoatRoughness: .35, clearcoatRoughnessMap: wear });
      const spine = new THREE.MeshPhysicalMaterial({ map: spT, roughness: .45, clearcoat: 1, clearcoatRoughness: .4, clearcoatRoughnessMap: wear });
      const discTop = new THREE.MeshPhysicalMaterial({ map: discT, alphaTest: .5, roughness: .45, clearcoat: .6, clearcoatRoughness: .25, metalness: .15 });
      /* case frame: origin at the bottom of the spine, centre of the depth; +x across, +y up, +z the cover */
      const grp = new THREE.Group();
      const tray = new THREE.Mesh(halfGeo, [edgeMat, spine, plastic, plastic, inner, plastic]); tray.position.set(W / 2, H / 2, -D / 4); grp.add(tray);
      const hinge = new THREE.Group(); grp.add(hinge);
      const lid = new THREE.Mesh(halfGeo, [edgeMat, spine, plastic, plastic, sleeve, plastic]); lid.position.set(W / 2, H / 2, D / 4); hinge.add(lid);
      const hub = new THREE.Mesh(hubGeo, plastic); hub.position.set(W / 2, H / 2, 0); grp.add(hub);
      const disc = new THREE.Mesh(discGeo, [discEdge, discTop, discUnder]); disc.position.set(W / 2, H / 2, .012); grp.add(disc);
      [tray, lid, disc, hub].forEach((m) => { m.castShadow = m !== hub; m.receiveShadow = true; m.userData.caseIdx = cases.length; });
      const base = { p: new THREE.Vector3(x + n * STEP, y, -.35), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-.03, .95, 0)) };
      grp.position.copy(base.p); grp.quaternion.copy(base.q); scene.add(grp);
      cases.push({ v, i, grp, tray, lid, hinge, disc, coverC, coverT, discC, discT, spC, spT, im: null, base, hov: 0, row: k, discHome: disc.position.clone() }); });
    x += gw(gp) + GAP; }); });
/* a little plate on the shelf edge for each photographer */
function drawPlate(c, a) { const g = c.getContext('2d'); g.fillStyle = '#1a1714'; g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#e3ad57'; g.fillRect(0, 0, 4, 64); g.fillStyle = '#efe8db'; g.font = '500 24px "Geist Mono"'; g.letterSpacing = '6px'; g.textBaseline = 'middle'; g.fillText(a.toUpperCase(), 22, 33); g.letterSpacing = '0px'; }
labels.forEach((l) => { const c = document.createElement('canvas'); c.width = 512; c.height = 64; drawPlate(c, l.a); l.c = c; l.t = ctex(c);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.25, .16), new THREE.MeshStandardMaterial({ map: l.t, roughness: .4, metalness: .2 })); p.position.set(l.x + .62, l.y - ST / 2, -.4 + SD / 2 + .002); scene.add(p); });
/* thumbnails arrive later: redraw the cover and the disc when each one lands */
cases.forEach((cs) => { const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => { cs.im = im; redraw(cs); };
  im.src = thumbUrl(cs.v.id); });

function redraw(cs) { try { drawCover(cs.coverC, cs.v, cs.i, cs.im); cs.coverT.needsUpdate = true; drawDisc(cs.discC, cs.v, cs.im); cs.discT.needsUpdate = true; } catch (e) { cs.im = null; drawCover(cs.coverC, cs.v, cs.i, null); cs.coverT.needsUpdate = true; } }
/* ---------------- the DVD player ---------------- */
const player = new THREE.Group(); scene.add(player); player.visible = false;
const PW = 3.2, PH = .34, PD = 2.3;
const alu = new THREE.MeshPhysicalMaterial({ color: 0x5a5a5f, metalness: .9, roughness: .34, roughnessMap: wear, clearcoat: .3, clearcoatRoughness: .4 });
const body = new THREE.Mesh(new RoundedBoxGeometry(PW, PH, PD, 3, .03), alu); body.castShadow = true; player.add(body);
const faceC = document.createElement('canvas'); faceC.width = 2048; faceC.height = 218;
function drawFace(on, text) { const g = faceC.getContext('2d'); g.fillStyle = '#0b0b0c'; g.fillRect(0, 0, 2048, 218);
  g.fillStyle = '#050506'; g.fillRect(180, 92, 820, 34); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(180, 126, 820, 2);
  g.fillStyle = '#0f0d0a'; g.fillRect(1240, 60, 520, 98); g.font = '500 40px "Geist Mono"'; g.letterSpacing = '8px'; g.textBaseline = 'middle';
  g.fillStyle = on ? '#e3ad57' : 'rgba(227,173,87,.18)'; g.shadowColor = on ? '#e3ad57' : 'transparent'; g.shadowBlur = on ? 18 : 0; g.fillText(text, 1270, 110); g.shadowBlur = 0;
  g.beginPath(); g.arc(1880, 109, 12, 0, 7); g.fillStyle = on ? '#e3ad57' : '#2a2116'; g.fill();
  g.letterSpacing = '6px'; g.font = '500 22px "Geist Mono"'; g.fillStyle = 'rgba(244,241,234,.35)'; g.fillText('STUDIUM', 180, 52); }
drawFace(false, 'NO DISC'); const faceT = ctex(faceC);
/* everything printed was drawn before the fonts were ready: draw it again once they are */
Promise.all(['300 40px Fraunces', '400 20px Geist', '500 20px "Geist Mono"'].map((f) => document.fonts.load(f))).catch(() => {}).then(() => {
  cases.forEach((cs) => { redraw(cs); drawSpine(cs.spC, cs.v, cs.i); cs.spT.needsUpdate = true; }); labels.forEach((l) => { drawPlate(l.c, l.a); l.t.needsUpdate = true; }); drawFace(false, 'NO DISC'); faceT.needsUpdate = true; });
const face = new THREE.Mesh(new THREE.PlaneGeometry(PW - .08, PH - .06), new THREE.MeshPhysicalMaterial({ map: faceT, emissiveMap: faceT, emissive: 0xffffff, emissiveIntensity: .9, roughness: .15, clearcoat: 1, clearcoatRoughness: .05 }));
face.position.set(0, 0, PD / 2 + .002); player.add(face);
const pTray = new THREE.Group(); player.add(pTray);
const trayGeo = new RoundedBoxGeometry(1.5, .05, 1.6, 2, .01);
const trayC = document.createElement('canvas'); trayC.width = trayC.height = 512; { const g = trayC.getContext('2d'); g.fillStyle = '#0e0e10'; g.fillRect(0, 0, 512, 512);
  g.beginPath(); g.arc(256, 256, 236, 0, 7); g.fillStyle = '#08080a'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 3; g.stroke(); g.beginPath(); g.arc(256, 256, 60, 0, 7); g.fillStyle = '#151518'; g.fill(); }
const pTrayMesh = new THREE.Mesh(trayGeo, [plastic, plastic, new THREE.MeshStandardMaterial({ map: ctex(trayC), roughness: .6 }), plastic, plastic, plastic]);
pTrayMesh.position.set(0, .03, 0); pTray.add(pTrayMesh); pTray.position.set(-.55, 0, PD / 2 - .8);
const TRAY_IN = PD / 2 - .8, TRAY_OUT = PD / 2 + .72;

/* ---------------- camera: the whole wall, or close on one photographer ---------------- */
const wallW = SL, wallH = rowY(0) + H + .8;
const view = { x: 0, y: wallMid, z: 16, tx: 0, ty: wallMid, tz: 16 };
function fitZ() { const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); return Math.max((wallH + 1.6) / vh, (wallW + .8) / (vh * camera.aspect)); }
let zOver = 16; const zNear = 8.2;
function clampView() { const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hh = view.tz * vh / 2, hw = hh * camera.aspect;
  const mx = Math.max(0, wallW / 2 + .6 - hw), myLo = -.6 + hh - .4, myHi = rowY(0) + H + .6 - hh + .2;
  view.tx = Math.max(-mx, Math.min(mx, view.tx)); view.ty = myHi < myLo ? wallMid : Math.max(myLo, Math.min(myHi, view.ty)); view.tz = Math.max(zNear, Math.min(zOver, view.tz)); }
function size() { const w = innerWidth, h = innerHeight; if (!w || !h) return;   /* hidden (0x0) when the room is left: keep the last good view */
  renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  const was = zOver; zOver = fitZ(); if (view.tz >= was - .01) view.tz = zOver; clampView();
  if (modal && modal.st === 'play' && !busy) setRect(fullRect(), 1); }
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .25, .5, .92)); composer.addPass(new OutputPass());
addEventListener('resize', size); size(); view.x = view.tx; view.y = view.ty; view.z = view.tz;

/* ---------------- the photographers along the bottom ---------------- */
const nav = $('#nav');
nav.innerHTML = '<button data-g="-1">All</button>' + labels.map((l, k) => '<button data-g="' + k + '">' + l.a + '</button>').join('');
function focusGroup(k) { if (k < 0) { view.tx = 0; view.ty = wallMid; view.tz = zOver; } else { const l = labels[k]; view.tx = l.x + l.w / 2; view.ty = l.y + H / 2 + .1; view.tz = Math.max(zNear, Math.min(zOver, 9)); } clampView(); navOn = k; }
let navOn = -1;
nav.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !modal) { sfx('cullPick'); focusGroup(+b.dataset.g); } });

/* ---------------- input: drag, wheel, hover, click ---------------- */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(9, 9), pickables = [];
cases.forEach((cs) => pickables.push(cs.tray, cs.lid));
let drag = null, hot = null, modal = null, busy = false;
function pickAt(e) { const m = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(m, camera); const h = ray.intersectObjects(pickables, false)[0]; return h ? h.object.userData.caseIdx : null; }
canvas.addEventListener('pointerdown', (e) => { if (modal) return; mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); drag = { x: e.clientX, y: e.clientY, vx: view.tx, vy: view.ty, moved: false }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 5) { drag.moved = true; canvas.classList.add('drag'); }
  if (drag.moved) { const k = view.z * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight; view.tx = drag.vx - dx * k; view.ty = drag.vy + dy * k; clampView(); } });
canvas.addEventListener('pointerup', (e) => { const was = drag; drag = null; canvas.classList.remove('drag'); if (was && !was.moved && !modal) { const k = pickAt(e); if (k != null) pull(k); } });   /* raycast on the tap itself: a touch has no hover */
canvas.addEventListener('pointerleave', () => { mouse.set(9, 9); });
canvas.addEventListener('wheel', (e) => { if (modal) return; e.preventDefault(); const z0 = view.tz; view.tz *= Math.exp(e.deltaY * .0012);
  view.tz = Math.max(zNear, Math.min(zOver, view.tz)); const s = 1 - view.tz / z0, vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  view.tx += mouse.x * z0 * vh * camera.aspect / 2 * s; view.ty += mouse.y * z0 * vh / 2 * s; clampView(); }, { passive: false });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); if (modal) esc(); else if (view.tz < zOver - .1) focusGroup(-1); else if (BR && BR.key) BR.key('Escape'); return; }
  if (modal) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const d = e.key === 'ArrowRight' ? 1 : -1; focusGroup(Math.max(0, Math.min(labels.length - 1, navOn + d))); return; }
  if (BR && BR.key && /^[qQeE]$/.test(e.key)) BR.key(e.key); });
document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
  if (a === 'play') putOn(); else if (a === 'back') putBack(); else if (a === 'eject') eject(); else if (a === 'esc') esc(); });

/* ---------------- little animation kit ---------------- */
const tweens = [];
function tw(dur, fn, ez = ease) { return new Promise((res) => { if (calm) dur = Math.min(dur, .01); dur *= window.DVD_SLOW || 1;   /* DVD_SLOW: slow motion, for checking each step */ tweens.push({ t: 0, dur, fn, ez, res }); }); }
const wait = (s) => tw(s, () => {});
function camPose(x, y, d, ry = 0, rx = 0) { const p = new THREE.Vector3(x, y, -d); camera.localToWorld(p);
  const q = camera.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0))); return { p, q }; }
function moveTo(obj, to, dur, ez) { const p0 = obj.position.clone(), q0 = obj.quaternion.clone();
  return tw(dur, (t) => { obj.position.lerpVectors(p0, to.p, t); obj.quaternion.slerpQuaternions(q0, to.q, t); }, ez); }
function arcTo(obj, to, dur, lift) { const p0 = obj.position.clone(), q0 = obj.quaternion.clone();
  return tw(dur, (t) => { obj.position.lerpVectors(p0, to.p, t); obj.position.y += Math.sin(t * Math.PI) * lift; obj.quaternion.slerpQuaternions(q0, to.q, t); }); }

/* a dark veil between the shelf and the case you're holding */
const veil = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: 0, depthWrite: false }));
veil.position.set(0, 0, -7.4); veil.renderOrder = 1; camera.add(veil);
const veilTo = (o, d) => { const o0 = veil.material.opacity; return tw(d, (t) => { veil.material.opacity = o0 + (o - o0) * t; }); };
const look = $('#look'), screen = $('#screen');
function setModal(m) { modal = m; document.body.classList.toggle('modal', !!m); if (m) { hot = null; $('#hint').style.opacity = 0; } }
function lift(cs, on) { cs.grp.traverse((o) => { if (o.isMesh) o.renderOrder = on ? 2 : 0; }); }

/* pull it off the shelf: it floats in front of you */
async function pull(idx) { if (busy || modal) return; busy = true; const cs = cases[idx]; cs.hov = 0; setModal({ cs, st: 'look' }); sfx('cullPick'); lift(cs, true);
  look.querySelector('.eb').textContent = cs.v.a; look.querySelector('h2').textContent = cs.v.t;
  veilTo(.9, .6); await arcTo(cs.grp, holdPose(), .85, .25); look.classList.add('on'); busy = false; }
function openPose() { const narrow = innerWidth < 760; return camPose(narrow ? -W / 2 : -2.35, narrow ? -.25 : -.55, 6.9, .1, .04); }
function holdPose() { const narrow = innerWidth < 760; return camPose(narrow ? -W / 2 : -1.45, narrow ? -.35 : -.95, 5.4, -.18); }
async function putBack() { if (busy || !modal) return; busy = true; const cs = modal.cs; look.classList.remove('on'); sfx('cullPick');
  veilTo(0, .6); await arcTo(cs.grp, cs.base, .75, .2); lift(cs, false); setModal(null); busy = false; }

/* put it on: open the case, the player slides up, the disc goes in, the screen grows out of the player */
async function putOn() { if (busy || !modal || modal.st !== 'look') return; busy = true; const cs = modal.cs; modal.st = 'loading'; look.classList.remove('on'); sfx('cullEnd');
  const narrow = innerWidth < 760;
  await moveTo(cs.grp, openPose(), .55);
  sfx('cullPick'); await tw(.7, (t) => { cs.hinge.rotation.y = -2.55 * t; });
  /* the player rises into view, tilted so you see the tray */
  const pp = camPose(narrow ? 0 : 1.0, narrow ? -1.25 : -.72, 6.6, -.16, .36); player.scale.setScalar(.62); player.position.copy(pp.p).add(new THREE.Vector3(0, -3, 0)); player.quaternion.copy(pp.q); player.visible = true;
  player.traverse((o) => { if (o.isMesh) o.renderOrder = 2; }); drawFace(false, 'OPEN'); faceT.needsUpdate = true;
  await moveTo(player, pp, .6, easeOut);
  await tw(.45, (t) => { pTray.position.z = TRAY_IN + (TRAY_OUT - TRAY_IN) * t; });
  /* the disc: off its hub, over, and down into the tray */
  scene.attach(cs.disc); const d0 = cs.disc.position.clone(), q0 = cs.disc.quaternion.clone();
  await tw(.35, (t) => { cs.disc.position.copy(d0).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(cs.grp.quaternion), .35 * t); });
  const slot = new THREE.Vector3(0, .07, 0); pTray.localToWorld(slot);
  const flat = new THREE.Quaternion(); pTray.getWorldQuaternion(flat); flat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
  const above = slot.clone().add(new THREE.Vector3(0, .5, 0).applyQuaternion(player.quaternion)), d1 = cs.disc.position.clone(), q1 = cs.disc.quaternion.clone();
  await tw(.75, (t) => { cs.disc.position.lerpVectors(d1, above, t); cs.disc.quaternion.slerpQuaternions(q1, flat, t); });
  await tw(.3, (t) => { cs.disc.position.lerpVectors(above, slot, t); }, easeOut);
  pTray.attach(cs.disc); sfx('cullPick');
  await tw(.45, (t) => { pTray.position.z = TRAY_OUT + (TRAY_IN - TRAY_OUT) * t; });
  drawFace(true, 'PLAY'); faceT.needsUpdate = true;
  /* the case closes and goes home on its own while the screen opens */
  (async () => { await tw(.4, (t) => { cs.hinge.rotation.y = -2.55 * (1 - t); }); await arcTo(cs.grp, cs.base, .8, .2); lift(cs, false); })();
  await wait(.15); modal.st = 'play'; await openScreen(cs); busy = false; }
function playerRect() { const pts = [[-PW / 2, -PH / 2], [PW / 2, -PH / 2], [-PW / 2, PH / 2], [PW / 2, PH / 2]].map(([x, y]) => { const v = new THREE.Vector3(x, y, PD / 2); player.localToWorld(v); v.project(camera);
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; });
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y); return { l: Math.min(...xs), t: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
function fullRect() { const w = Math.min(innerWidth * .9, (innerHeight * .86 - 52) * 16 / 9), h = w * 9 / 16 + 52; return { l: (innerWidth - w) / 2, t: (innerHeight - h) / 2, w, h }; }
function setRect(r, o) { Object.assign(screen.style, { left: r.l + 'px', top: r.t + 'px', width: r.w + 'px', height: r.h + 'px', opacity: o }); }
const lerpRect = (a, b, t) => ({ l: a.l + (b.l - a.l) * t, t: a.t + (b.t - a.t) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });
async function openScreen(cs) { const v = cs.v, src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.id) + '?rel=0&playsinline=1&autoplay=1' + (v.s ? '&start=' + v.s : '');
  const url = 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.id) + (v.s ? '&t=' + v.s + 's' : '');
  screen.querySelector('.tt').textContent = v.a + ' · ' + v.t; screen.querySelector('.yt').href = url;
  const scr = screen.querySelector('.scr'); scr.innerHTML = '';
  const a = playerRect(), b = fullRect(); setRect(a, 0);
  veilTo(.97, .8); await tw(.8, (t) => setRect(lerpRect(a, b, t), Math.min(1, t * 3)));
  screen.classList.add('on');
  if (canEmbed) { const f = document.createElement('iframe'); f.src = src; f.title = v.t; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin'; scr.appendChild(f); }
  else { const x = document.createElement('a'); x.className = 'ext'; x.href = url; x.target = '_blank'; x.rel = 'noopener';
    x.innerHTML = '<img alt="" src="' + thumbUrl(v.id) + '"><span><b>▶ WATCH ON YOUTUBE</b><i>This copy of Studium is opened from a file, so YouTube won’t play inside it. On the Studium website it plays right here.</i></span>'; scr.appendChild(x); } }

/* eject: the screen shrinks into the player, the disc comes back out and goes home in its case */
async function eject() { if (busy || !modal || modal.st !== 'play') return; busy = true; const cs = modal.cs; modal.st = 'eject'; sfx('cullPick');
  screen.classList.remove('on'); screen.querySelector('.scr').innerHTML = '';
  const a = fullRect(), b = playerRect(); veilTo(.9, .6); await tw(.55, (t) => setRect(lerpRect(a, b, t), 1 - Math.max(0, t - .6) / .4));
  drawFace(false, 'OPEN'); faceT.needsUpdate = true;
  await tw(.4, (t) => { pTray.position.z = TRAY_IN + (TRAY_OUT - TRAY_IN) * t; });
  /* the case comes back, open, to take its disc */
  lift(cs, true); const hold = openPose();
  arcTo(cs.grp, hold, .7, .2).then(() => tw(.4, (t) => { cs.hinge.rotation.y = -2.55 * t; }));
  await wait(1.1);
  scene.attach(cs.disc); const home = cs.discHome.clone(); cs.grp.localToWorld(home); const hq = cs.grp.quaternion.clone();
  const d0 = cs.disc.position.clone(), q0 = cs.disc.quaternion.clone(), up = d0.clone().add(new THREE.Vector3(0, .5, 0).applyQuaternion(player.quaternion));
  await tw(.3, (t) => { cs.disc.position.lerpVectors(d0, up, t); });
  await tw(.7, (t) => { cs.disc.position.lerpVectors(up, home, t); cs.disc.quaternion.slerpQuaternions(q0, hq, t); });
  cs.grp.attach(cs.disc); cs.disc.position.copy(cs.discHome); cs.disc.quaternion.identity();
  tw(.4, (t) => { pTray.position.z = TRAY_OUT + (TRAY_IN - TRAY_OUT) * t; });
  await tw(.45, (t) => { cs.hinge.rotation.y = -2.55 * (1 - t); });
  const pp = { p: player.position.clone().add(new THREE.Vector3(0, -3, 0)), q: player.quaternion.clone() };
  moveTo(player, pp, .5).then(() => { player.visible = false; drawFace(false, 'NO DISC'); faceT.needsUpdate = true; });
  veilTo(0, .7); await arcTo(cs.grp, cs.base, .8, .2); lift(cs, false); setModal(null); busy = false; }
function esc() { if (!modal) return; if (modal.st === 'look') putBack(); else if (modal.st === 'play') eject(); }

/* ---------------- each frame ---------------- */
const clock = new THREE.Clock(), hint = $('#hint');
let paused = false, raf = 0;
function frame() { raf = 0; if (paused) return; const real = Math.min(.5, clock.getDelta()), dt = Math.min(.05, real);
  /* animations run on real time, so a slow machine still finishes them on time */
  for (let k = tweens.length - 1; k >= 0; k--) { const a = tweens[k]; a.t = Math.min(1, a.t + real / Math.max(.001, a.dur)); a.fn(a.ez(a.t)); if (a.t >= 1) { tweens.splice(k, 1); a.res(); } }
  const f = 1 - Math.exp(-dt * 5); view.x += (view.tx - view.x) * f; view.y += (view.ty - view.y) * f; view.z += (view.tz - view.z) * f;
  const mx = modal || mouse.x > 5 ? 0 : mouse.x, my = modal || mouse.y > 5 ? 0 : mouse.y;
  if (!modal) { camera.position.set(view.x + mx * .25, view.y + .55 + my * .1, view.z); camera.lookAt(view.x, view.y + .1, -.4); }
  key.position.set(view.x - 4, view.y + 8, view.z * .6); key.target.position.set(view.x, view.y, -.6);
  if (!modal && !drag) { ray.setFromCamera(mouse, camera); const h = ray.intersectObjects(pickables, false)[0]; const idx = h ? h.object.userData.caseIdx : null;
    if (idx !== hot) { hot = idx; canvas.style.cursor = idx != null ? 'pointer' : ''; hint.style.opacity = idx != null ? 1 : 0; if (idx != null) { hint.querySelector('b').textContent = cases[idx].v.a; hint.querySelector('i').textContent = cases[idx].v.t; } } }
  cases.forEach((cs, k) => { if (modal && modal.cs === cs) return; const want = k === hot ? 1 : 0; cs.hov += (want - cs.hov) * (1 - Math.exp(-dt * 9));
    const u = cs.hov; if (u < .0005 && want === 0) { cs.hov = 0; } cs.grp.position.set(cs.base.p.x - .2 * u, cs.base.p.y + .08 * u, cs.base.p.z + .75 * u);
    cs.grp.rotation.set(-.03 + .03 * u, .95 * (1 - .7 * u), 0); });
  /* the case in your hands follows the mouse a little */
  if (modal && modal.st === 'look' && !busy) { const h = holdPose(), mx0 = mouse.x > 5 ? 0 : mouse.x, my0 = mouse.y > 5 ? 0 : mouse.y, tq = h.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-my0 * .12, mx0 * .3, 0)));
    modal.cs.grp.quaternion.slerp(tq, 1 - Math.exp(-dt * 6)); modal.cs.grp.position.lerp(h.p, 1 - Math.exp(-dt * 6)); }
  if (modal && modal.st === 'play') { const d = modal.cs.disc; if (d.parent === pTray) d.rotateZ(dt * 8); }
  const on = view.tz >= zOver - .3 ? -1 : nearestGroup(); if (on !== frame.on) { frame.on = on; nav.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k - 1 === on)); }
  composer.render(); raf = requestAnimationFrame(frame); }
function nearestGroup() { let best = 0, bd = 1e9; labels.forEach((l, k) => { const d = Math.hypot(l.x + l.w / 2 - view.x, l.y + H / 2 - view.y); if (d < bd) { bd = d; best = k; } }); navOn = best; return best; }
frame();

/* Studium drives these: pause when the room is hidden, stop the video when you leave */
window.DVDapp = {
  pause(p) { paused = !!p; if (!paused && !raf) { clock.getDelta(); frame(); } },
  stop() { screen.classList.remove('on'); screen.style.opacity = 0; screen.querySelector('.scr').innerHTML = ''; tweens.length = 0;
    if (modal) { const cs = modal.cs; if (cs.disc.parent !== cs.grp) { cs.grp.attach(cs.disc); } cs.disc.position.copy(cs.discHome); cs.disc.quaternion.identity(); cs.hinge.rotation.y = 0;
      cs.grp.position.copy(cs.base.p); cs.grp.quaternion.copy(cs.base.q); lift(cs, false); }
    player.visible = false; pTray.position.z = TRAY_IN; veil.material.opacity = 0; look.classList.remove('on'); setModal(null); busy = false; },
  state() { return { modal: modal && modal.st, busy, cases: cases.length, rows: rows.length, view: { x: view.x, y: view.y, z: view.z }, playing: !!screen.querySelector('iframe,.ext') }; },
  pull, putOn, eject, focusGroup, hover(k) { hot = k; }
};
window.__ready = true;
