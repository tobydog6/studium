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
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
RectAreaLightUniformsLib.init();
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0908);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .2;
scene.fog = new THREE.Fog(0x0b0908, 22, 44);
const camera = new THREE.PerspectiveCamera(30, 1, .1, 100); scene.add(camera);
let bloomPass = null;
const aniso = renderer.capabilities.getMaxAnisotropy();
const TL = new THREE.TextureLoader();
function img(url, color) { const t = TL.load(url); t.anisotropy = aniso; if (color) t.colorSpace = THREE.SRGBColorSpace; return t; }
function rep(t, x, y) { const c = t.clone(); c.wrapS = c.wrapT = THREE.MirroredRepeatWrapping; c.repeat.set(x, y); c.needsUpdate = true; return c; }
function ctex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }
const T = { oakCol: img(oakCol, 1), oakRough: img(oakRough), oakNrm: img(oakNrm), wallCol: img(wallCol, 1), wallNrm: img(wallNrm), wear: img(sleeveRough) };
const wear = rep(T.wear, 1, 1);

/* ---------------- what's on the shelves: groups by photographer, packed into rows ---------------- */
const W = 1.35, H = 1.9, D = .16, STEP = .42, GAP = .45, ROWH = 2.5;
const groups = []; VIDS.forEach((v, i) => { let g = groups[groups.length - 1]; if (!g || g.a !== v.a) groups.push(g = { a: v.a, items: [] }); g.items.push(i); });
const gw = (g) => (g.items.length - 1) * STEP + W * .6;
/* three rows of about the same length, so the whole collection fits on screen at once */
const totW = groups.reduce((t, g) => t + gw(g) + GAP, -GAP), NROWS = Math.max(1, Math.min(2, Math.round(totW / 6))), target = totW / NROWS;
const rows = []; groups.forEach((g) => { let r = rows[rows.length - 1]; const w = gw(g); if (!r || (r.w + GAP + w > target * 1.12 && rows.length < NROWS)) rows.push(r = { gs: [], w: -GAP }); r.gs.push(g); r.w += GAP + w; });
const SL = Math.max(...rows.map((r) => r.w)) + 1.3, ST = .16, SD = 1.3;
const rowY = (k) => (rows.length - 1 - k) * ROWH;
const wallMid = rowY(0) / 2 + .9;

/* ---------------- the looks: lighting, cover design and case plastic, each switchable ---------------- */
/* Sam picks from these; with the switcher on (?dev, or the standalone page) they can be mixed live */
const LIGHTS = {
  night: { name: 'Night gallery', bg: 0x070605, wall: 0x4a4038, wallN: 2, wood: 0x8a6a52, lacquer: false, exposure: 1.0, env: .12, spot: [0xffd29a, 55, .3, .55], wash: [0xffcf8f, 3], key: 85, fill: [0x6f86ff, .08], beams: .085, dust: .55, bloom: .15, fog: [0x070605, 26, 50] },
  cinema: { name: 'Cinema', bg: 0x04060a, wall: 0x22303f, wallN: 1.6, wood: 0x111114, lacquer: true, exposure: .88, env: .25, spot: [0xffd9a8, 26, .42, .8], wash: [0xff9a3c, 2.5], key: 55, fill: [0x5a82ff, .35], beams: .02, dust: .25, bloom: .1, fog: [0x04060a, 26, 50] },
  gallery: { name: 'White gallery', bg: 0xe7e3dc, wall: 0xf4f1eb, wallN: .7, wood: 0xffffff, lacquer: false, exposure: .82, env: .55, spot: [0xfff3e6, 30, .62, 1], wash: [0xfff2e0, 1.5], key: 150, fill: [0xdfe8ff, .35], beams: 0, dust: 0, bloom: .12, fog: [0xe7e3dc, 30, 60] } };
const COVERS = { poster: 'Poster serif', film: 'Poster grotesk', collection: 'Collection', swiss: 'Swiss' };
const CASES = { black: 'Black', clear: 'Clear', colour: 'Colour' };
const saved = (() => { try { return JSON.parse(localStorage.getItem('dvd_look') || 'null'); } catch (e) { return null; } })();
const look = Object.assign({ light: 'cinema', cover: 'poster', body: 'clear' }, DATA.look || {}, DATA.styles ? saved || {} : {});
/* one colour per photographer, for spines, poster tints and the disc */
const HUES = ['#1f9a62', '#e0482a', '#2a6ae0', '#d41f6b', '#d99a1e', '#8a46e0', '#0fb0a2', '#f07d1a', '#3b55e6', '#c23a8a'];
const hueOf = (() => { const m = {}; let n = 0; VIDS.forEach((v) => { if (!(v.a in m)) m[v.a] = HUES[n++ % HUES.length]; }); return (a) => m[a]; })();
const num = (i) => String(i + 1).padStart(2, '0');
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = (x) => Math.max(0, Math.min(255, Math.round(x * f))); return 'rgb(' + c(n >> 16) + ',' + c((n >> 8) & 255) + ',' + c(n & 255) + ')'; };

/* ---------------- the room ---------------- */
const wallMat = new THREE.MeshStandardMaterial({ map: rep(T.wallCol, 10, 4.3), normalMap: rep(T.wallNrm, 10, 4.3), normalScale: new THREE.Vector2(1.4, 1.4), roughness: .93 });
const wall = new THREE.Mesh(new THREE.PlaneGeometry(70, 30), wallMat); wall.position.set(0, wallMid, -1.05); wall.receiveShadow = true; scene.add(wall);
const shelfMat = new THREE.MeshPhysicalMaterial({ roughness: 1, clearcoat: .25, clearcoatRoughness: .45 });
const oakMaps = { map: rep(T.oakCol, SL / 4.5, 1), roughnessMap: rep(T.oakRough, SL / 4.5, 1), normalMap: rep(T.oakNrm, SL / 4.5, 1) };
const shelfGeo = new RoundedBoxGeometry(SL, ST, SD, 3, .025);
const spots = [], washes = [], beams = [];
/* a soft cone of light under each spot, the kind you see in a dark gallery */
const beamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { col: { value: new THREE.Color(0xffd29a) }, k: { value: .08 } },
  vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 col; uniform float k; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float a = k * e * smoothstep(0.0, 0.5, vUv.y) * (0.35 + 0.65 * vUv.y); gl_FragColor = vec4(col * a, a); }' });
rows.forEach((r, k) => { const y = rowY(k);
  const s = new THREE.Mesh(shelfGeo, shelfMat); s.position.set(0, y - ST / 2, -.4); s.castShadow = s.receiveShadow = true; scene.add(s);
  const wash = new THREE.RectAreaLight(0xffd9a6, 5, SL - .3, .05); wash.position.set(0, y - ST - .02, .2); wash.lookAt(0, y - 3, -1.05); scene.add(wash); washes.push(wash);
  for (let x = -SL / 2 + 2; x < SL / 2; x += 3.6) { const sp = new THREE.SpotLight(0xffe3bd, 55, 12, .42, .9, 1.4); sp.position.set(x, y + 3.6, 2.2); sp.target.position.set(x, y + .9, -1); scene.add(sp, sp.target); spots.push(sp); } });
function buildBeams() { beams.forEach((b) => scene.remove(b)); beams.length = 0;
  spots.forEach((sp) => { const dir = sp.target.position.clone().sub(sp.position), h = dir.length() * 1.15; dir.normalize();
    const g = new THREE.ConeGeometry(h * Math.tan(sp.angle) * .85, h, 40, 1, true); g.translate(0, -h / 2, 0);
    const m = new THREE.Mesh(g, beamMat); m.position.copy(sp.position); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); m.renderOrder = 1; scene.add(m); beams.push(m); }); }
const key = new THREE.SpotLight(0xfff0dc, 230, 50, .5, .75, 1.4); key.position.set(-4, wallMid + 8, 9); key.target.position.set(0, wallMid, -.6);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0003; key.shadow.radius = 5; key.shadow.camera.near = 4; key.shadow.camera.far = 30; scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x8fa6ff, .18); rim.position.set(8, 4, 5); scene.add(rim);
/* a soft key that rides with the camera, so whatever's in your hands is lit */
const handLight = new THREE.PointLight(0xfff2e0, 9, 14, 1.6); handLight.position.set(-2.5, 2.2, 1); camera.add(handLight);
/* a studio light for the case in your hands: only on while you hold one, and it falls off before the shelf */
const holdKey = new THREE.SpotLight(0xfff4e6, 0, 11, .55, .8, 1.2); holdKey.position.set(-3.2, 2.6, 1.5); camera.add(holdKey); camera.add(holdKey.target); holdKey.target.position.set(-1.4, -.6, -5.6);
const holdFill = new THREE.PointLight(0xbfd4ff, 0, 9, 1.5); holdFill.position.set(3, -.5, -2); camera.add(holdFill);
const holdOn = (on, d) => { const a = holdKey.intensity, b = holdFill.intensity; return tw(d, (t) => { holdKey.intensity = a + ((on ? 42 : 0) - a) * t; holdFill.intensity = b + ((on ? 6 : 0) - b) * t; }); };
/* dust drifting through the light */
const DUST = 900, dustPos = new Float32Array(DUST * 3), dustSeed = new Float32Array(DUST);
for (let k = 0; k < DUST; k++) { dustPos[k * 3] = (Math.random() - .5) * (SL + 2); dustPos[k * 3 + 1] = -1 + Math.random() * (rowY(0) + 5); dustPos[k * 3 + 2] = -.9 + Math.random() * 3.6; dustSeed[k] = Math.random() * 100; }
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dotC = document.createElement('canvas'); dotC.width = dotC.height = 32; { const g = dotC.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(dotC), size: .022, color: 0xffe2b8, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(dust);
function driftDust(t) { const p = dustGeo.attributes.position; for (let k = 0; k < DUST; k++) { const s = dustSeed[k]; p.array[k * 3 + 1] += Math.sin(t * .2 + s) * .0006 - .0002; p.array[k * 3] += Math.cos(t * .13 + s) * .0005;
    if (p.array[k * 3 + 1] < -1) p.array[k * 3 + 1] = rowY(0) + 4; } p.needsUpdate = true; }

/* ---------------- printing: covers, spines, discs and plates in three designs ---------------- */
function crop(g, im, x, y, w, h) { if (!im) return; let sx = 0, sy = 0, sw = im.width, sh = im.height;
  if (sh / sw > .7) { sh = sw * 9 / 16; sy = (im.height - sh) / 2; }   /* hqdefault letterboxes 16:9 videos: cut the bars */
  const s = Math.max(w / sw, h / sh), cw = w / s, ch = h / s; g.drawImage(im, sx + (sw - cw) / 2, sy + (sh - ch) / 2, cw, ch, x, y, w, h); }
function wrap(g, t, x, y, w, lh, max) { let line = '', n = 0; const words = t.split(' ');
  for (let k = 0; k < words.length; k++) { const s = line ? line + ' ' + words[k] : words[k]; if (g.measureText(s).width > w && line) { if (n === max - 1) { line += '…'; break; } g.fillText(line, x, y + n++ * lh); line = words[k]; } else line = s; }
  g.fillText(line, x, y + n * lh); return n + 1; }
function fit(g, t, w, weight, size, fam) { let fs = size; g.font = weight + ' ' + fs + 'px ' + fam; while (g.measureText(t).width > w && fs > 12) { fs -= 2; g.font = weight + ' ' + fs + 'px ' + fam; } return fs; }
const grain = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const d = g.createImageData(256, 256);
  for (let k = 0; k < d.data.length; k += 4) { const v = 128 + (Math.random() - .5) * 60; d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 18; } g.putImageData(d, 0, 0); return c; })();
function paper(g, w, h, col) { g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, w, h); }
function photoOrNone(g, im, v, x, y, w, h, dark) { if (im) { crop(g, im, x, y, w, h); return; }
  g.fillStyle = dark ? '#1b1815' : '#d9d2c4'; g.fillRect(x, y, w, h); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = dark ? 'rgba(227,173,87,.2)' : 'rgba(20,18,16,.12)'; g.font = '300 ' + Math.round(h * .9) + 'px Fraunces'; g.textBaseline = 'alphabetic'; g.fillText(v.a[0], x + w * .08, y + h * .86); g.restore(); }
const COVER = {
  /* cream paper, a framed still, a serif name: a boutique film label */
  collection(g, v, i, im) { const Wc = 900, Hc = 1266; paper(g, Wc, Hc, '#ece6da');
    g.textBaseline = 'alphabetic'; g.letterSpacing = '7px'; g.font = '500 20px "Geist Mono"'; g.fillStyle = '#141210'; g.fillText('STUDIUM', 64, 88);
    g.textAlign = 'right'; g.fillStyle = '#9a6a24'; g.fillText('No. ' + num(i), Wc - 64, 88); g.textAlign = 'left'; g.letterSpacing = '0px';
    g.fillStyle = '#141210'; g.fillRect(64, 112, Wc - 128, 2);
    photoOrNone(g, im, v, 64, 140, Wc - 128, 560, false); g.strokeStyle = 'rgba(20,18,16,.6)'; g.lineWidth = 2; g.strokeRect(64, 140, Wc - 128, 560);
    g.fillStyle = '#141210'; const fs = fit(g, v.a, Wc - 128, '300', 96, 'Fraunces'); g.fillText(v.a, 60, 790 + fs * .2);
    g.font = '400 32px Geist'; g.fillStyle = '#4a443b'; wrap(g, v.t, 64, 860 + fs * .2, Wc - 160, 42, 3);
    g.fillStyle = '#141210'; g.fillRect(64, Hc - 132, Wc - 128, 2);
    g.letterSpacing = '5px'; g.font = '500 17px "Geist Mono"'; g.fillStyle = '#4a443b'; g.fillText('PHOTOGRAPHERS ON PHOTOGRAPHY', 64, Hc - 86); g.letterSpacing = '0px';
    g.beginPath(); g.arc(Wc - 96, Hc - 94, 26, 0, 7); g.fillStyle = '#c8933f'; g.fill(); g.fillStyle = '#141210'; g.font = '400 30px Fraunces'; g.textAlign = 'center'; g.fillText('S', Wc - 96, Hc - 84); g.textAlign = 'left'; },
  /* a film poster: the still full bleed in rich colour, a heavy serif name, small tracked caps, a credit block */
  poster(g, v, i, im) { const Wc = 900, Hc = 1266, hue = hueOf(v.a); g.fillStyle = shade(hue, .35); g.fillRect(0, 0, Wc, Hc);
    if (im) { g.save(); g.filter = 'saturate(1.5) contrast(1.15)'; crop(g, im, 0, 0, Wc, Hc * .78); g.restore(); } else photoOrNone(g, null, v, 0, 0, Wc, Hc * .78, true);
    let gr = g.createLinearGradient(0, Hc * .4, 0, Hc * .8); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, shade(hue, .22)); g.fillStyle = gr; g.fillRect(0, Hc * .4, Wc, Hc * .4 + 1);
    g.fillStyle = shade(hue, .22); g.fillRect(0, Hc * .8, Wc, Hc * .2);
    gr = g.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, Wc, 200);
    g.fillStyle = hue; g.fillRect(0, 0, Wc, 14);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(255,255,255,.88)'; g.letterSpacing = '9px'; g.font = '500 19px "Geist Mono"'; g.fillText('STUDIUM PRESENTS', Wc / 2, 82); g.letterSpacing = '0px';
    const words = v.a.split(' '), two = g.measureText && words.length > 1 && fit(g, v.a, Wc - 100, '800', 150, 'Fraunces') < 96;
    const lines = two ? [words.slice(0, -1).join(' '), words[words.length - 1]] : [v.a];
    let y = Hc * .66; g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 6; g.fillStyle = '#fff';
    const sizes = lines.map((l) => fit(g, l, Wc - 100, '800', 150, 'Fraunces')), fs = Math.min(...sizes); y -= (lines.length - 1) * fs * .92;
    g.letterSpacing = '-2px'; lines.forEach((l) => { g.font = '800 ' + fs + 'px Fraunces'; g.fillText(l, Wc / 2, y); y += fs * .92; }); g.letterSpacing = '0px'; g.shadowColor = 'transparent';
    g.fillStyle = shade(hue, 1.6); g.fillRect(Wc / 2 - 40, y - fs * .45, 80, 4);
    g.font = '600 25px Geist'; g.letterSpacing = '5px'; g.fillStyle = 'rgba(255,255,255,.92)'; wrap(g, v.t.toUpperCase(), Wc / 2, y + 12, Wc - 140, 36, 2); g.letterSpacing = '0px';
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(80, Hc - 118); g.lineTo(Wc - 80, Hc - 118); g.stroke();
    g.font = '500 14px Geist'; g.letterSpacing = '2.5px'; g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillText(v.a.toUpperCase() + '  IN CONVERSATION  ·  PHOTOGRAPHERS ON PHOTOGRAPHY  ·  NO. ' + num(i), Wc / 2, Hc - 82);
    g.fillText('A STUDIUM RESEARCH ROOM SCREENING', Wc / 2, Hc - 58); g.letterSpacing = '0px';
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(Wc - 70, Hc - 70, 22, 0, 7); g.stroke(); g.font = '700 22px Geist'; g.fillStyle = 'rgba(255,255,255,.85)'; g.textBaseline = 'middle'; g.fillText('E', Wc - 70, Hc - 69); g.textAlign = 'left'; },
  /* a modern film label: the still, the name set clean and tight, left aligned */
  film(g, v, i, im) { const Wc = 900, Hc = 1266, hue = hueOf(v.a); g.fillStyle = '#0d0d0f'; g.fillRect(0, 0, Wc, Hc);
    if (im) { g.save(); g.filter = 'saturate(1.45) contrast(1.12)'; crop(g, im, 0, 0, Wc, Hc); g.restore(); } else photoOrNone(g, null, v, 0, 0, Wc, Hc, true);
    let gr = g.createLinearGradient(0, Hc * .38, 0, Hc); gr.addColorStop(0, 'rgba(8,8,10,0)'); gr.addColorStop(.6, 'rgba(8,8,10,.78)'); gr.addColorStop(1, 'rgba(8,8,10,.95)'); g.fillStyle = gr; g.fillRect(0, 0, Wc, Hc);
    gr = g.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, Wc, 180);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.font = '500 20px "Geist Mono"'; g.letterSpacing = '6px'; g.fillText('STUDIUM', 64, 84);
    g.textAlign = 'right'; g.fillText(num(i), Wc - 64, 84); g.textAlign = 'left'; g.letterSpacing = '0px'; g.fillStyle = hue; g.fillRect(64, 104, 46, 6);
    const words = v.a.split(' '), lines = words.length > 1 ? [words.slice(0, -1).join(' '), words[words.length - 1]] : [v.a];
    const fs = Math.min(...lines.map((l) => fit(g, l, Wc - 128, '700', 132, 'Geist'))); let y = Hc - 300 - (lines.length - 1) * fs * .9;
    g.fillStyle = '#fff'; g.letterSpacing = '-4px'; lines.forEach((l) => { g.font = '700 ' + fs + 'px Geist'; g.fillText(l, 58, y); y += fs * .9; }); g.letterSpacing = '0px';
    g.font = '400 34px Geist'; g.fillStyle = 'rgba(255,255,255,.82)'; wrap(g, v.t, 64, y + 6, Wc - 200, 42, 2);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '500 15px "Geist Mono"'; g.letterSpacing = '4px'; g.fillText('PHOTOGRAPHERS ON PHOTOGRAPHY', 64, Hc - 64); g.letterSpacing = '0px';
    g.beginPath(); g.arc(Wc - 78, Hc - 70, 14, 0, 7); g.fillStyle = hue; g.fill(); },
  /* white, a strict grid, a big number */
  swiss(g, v, i, im) { const Wc = 900, Hc = 1266; paper(g, Wc, Hc, '#f4f3ef');
    g.fillStyle = '#141414'; g.textBaseline = 'alphabetic'; g.letterSpacing = '-8px'; g.font = '800 300px Geist'; g.fillText(num(i), 48, 300); g.letterSpacing = '0px';
    g.beginPath(); g.arc(Wc - 110, 120, 46, 0, 7); g.fillStyle = '#e4552e'; g.fill();
    g.fillStyle = '#141414'; g.fillRect(60, 340, Wc - 120, 4);
    photoOrNone(g, im, v, 60, 372, Wc - 120, 470, false);
    g.fillStyle = '#141414'; const fs = fit(g, v.a, Wc - 120, '700', 76, 'Geist'); g.letterSpacing = '-1px'; g.fillText(v.a, 58, 920 + fs * .1); g.letterSpacing = '0px';
    g.font = '400 32px Geist'; g.fillStyle = '#3b3b3b'; wrap(g, v.t, 60, 982, Wc - 260, 40, 3);
    g.fillStyle = '#141414'; g.fillRect(60, Hc - 120, Wc - 120, 2);
    g.letterSpacing = '4px'; g.font = '500 17px "Geist Mono"'; g.fillText('STUDIUM', 60, Hc - 74); g.textAlign = 'right'; g.fillText('PHOTOGRAPHERS ON PHOTOGRAPHY', Wc - 60, Hc - 74); g.textAlign = 'left'; g.letterSpacing = '0px'; } };
const SPINE = {
  collection(g, v, i) { paper(g, 100, 1266, '#ece6da'); g.fillStyle = '#141210'; g.fillRect(14, 26, 72, 72); g.fillStyle = '#ece6da'; g.font = '500 30px "Geist Mono"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num(i), 50, 63);
    g.save(); g.translate(50, 0); g.rotate(Math.PI / 2); g.textAlign = 'left'; g.fillStyle = '#141210'; g.font = '300 40px Fraunces'; g.fillText(v.a, 130, 3); const aw = g.measureText(v.a).width;
    g.fillStyle = '#6a6358'; g.font = '400 23px Geist'; g.fillText(v.t, 158 + aw, 3); g.restore();
    g.beginPath(); g.arc(50, 1210, 20, 0, 7); g.fillStyle = '#c8933f'; g.fill(); },
  poster(g, v, i) { const hue = hueOf(v.a); g.fillStyle = shade(hue, .3); g.fillRect(0, 0, 100, 1266); g.fillStyle = hue; g.fillRect(0, 0, 100, 14); g.fillRect(0, 1252, 100, 14);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '500 22px "Geist Mono"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num(i), 50, 62);
    g.save(); g.translate(50, 0); g.rotate(Math.PI / 2); g.textAlign = 'left'; g.font = '800 42px Fraunces'; g.fillStyle = '#fff'; g.fillText(v.a, 120, 3); const aw = g.measureText(v.a).width;
    g.font = '600 19px Geist'; g.letterSpacing = '4px'; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(v.t.toUpperCase(), 150 + aw, 3); g.letterSpacing = '0px'; g.restore(); },
  film(g, v, i) { g.fillStyle = '#0f0f11'; g.fillRect(0, 0, 100, 1266); g.fillStyle = hueOf(v.a); g.fillRect(0, 0, 100, 10);
    g.save(); g.translate(50, 0); g.rotate(Math.PI / 2); g.textBaseline = 'middle'; g.font = '500 20px "Geist Mono"'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(num(i), 40, 2);
    g.fillStyle = '#fff'; g.font = '700 40px Geist'; g.letterSpacing = '-1px'; g.fillText(v.a, 110, 2); const aw = g.measureText(v.a).width; g.letterSpacing = '0px';
    g.font = '400 24px Geist'; g.fillStyle = 'rgba(255,255,255,.65)'; g.fillText(v.t, 140 + aw, 3); g.restore(); },
  swiss(g, v, i) { paper(g, 100, 1266, '#f4f3ef'); g.beginPath(); g.arc(50, 60, 22, 0, 7); g.fillStyle = '#e4552e'; g.fill();
    g.save(); g.translate(50, 0); g.rotate(Math.PI / 2); g.textBaseline = 'middle'; g.fillStyle = '#141414'; g.font = '700 40px Geist'; g.fillText(v.a, 120, 2); const aw = g.measureText(v.a).width;
    g.font = '400 24px Geist'; g.fillStyle = '#555'; g.fillText(v.t, 148 + aw, 3); g.font = '800 44px Geist'; g.textAlign = 'right'; g.fillStyle = '#141414'; g.fillText(num(i), 1236, 2); g.restore(); } };
function drawCover(c, v, i, im) { const g = c.getContext('2d'); g.setTransform(c.width / 900, 0, 0, c.height / 1266, 0, 0); g.textAlign = 'left'; g.letterSpacing = '0px'; g.filter = 'none'; g.globalCompositeOperation = 'source-over'; COVER[look.cover](g, v, i, im); }
function drawSpine(c, v, i) { const g = c.getContext('2d'); g.setTransform(c.width / 100, 0, 0, c.height / 1266, 0, 0); g.textAlign = 'left'; g.letterSpacing = '0px'; g.textBaseline = 'middle'; SPINE[look.cover](g, v, i); }
function drawDisc(c, v, im) { const g = c.getContext('2d'), R = 512, light = look.cover === 'collection' || look.cover === 'swiss'; g.setTransform(c.width / 1024, 0, 0, c.height / 1024, 0, 0); g.clearRect(0, 0, 1024, 1024);
  g.save(); g.beginPath(); g.arc(R, R, 470, 0, 7); g.clip();
  if (light) { paper(g, 1024, 1024, look.cover === 'swiss' ? '#f4f3ef' : '#ece6da'); }
  else { if (im) { g.filter = 'grayscale(1) contrast(1.2)'; crop(g, im, R - 470, R - 470, 940, 940); g.filter = 'none'; g.globalCompositeOperation = 'multiply'; g.fillStyle = hueOf(v.a); g.fillRect(0, 0, 1024, 1024); g.globalCompositeOperation = 'source-over'; } else { g.fillStyle = '#1d1a17'; g.fillRect(0, 0, 1024, 1024); } }
  g.restore(); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = light ? '#141210' : '#fff';
  g.font = (look.cover === 'swiss' || look.cover === 'film' ? '700 54px Geist' : look.cover === 'poster' ? '800 56px Fraunces' : '300 58px Fraunces'); g.fillText(v.a, R, 790);
  g.font = '500 20px "Geist Mono"'; g.letterSpacing = '6px'; g.fillStyle = look.cover === 'swiss' ? '#e4552e' : light ? '#9a6a24' : '#fff'; g.fillText('STUDIUM  No. ' + num(v.i), R, 290); g.letterSpacing = '0px';
  /* the clear hub and the hole */
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(R, R, 160, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
  g.beginPath(); g.arc(R, R, 160, 0, 7); g.arc(R, R, 64, 0, 7, true); g.fillStyle = 'rgba(200,205,215,1)'; g.fill('evenodd');
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(R, R, 64, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
function drawPlate(c, a) { const g = c.getContext('2d'), lite = look.light === 'gallery'; g.fillStyle = lite ? '#f4f3ef' : '#14110e'; g.fillRect(0, 0, 512, 64);
  g.fillStyle = look.cover === 'swiss' ? '#e4552e' : '#c8933f'; g.fillRect(0, 0, 5, 64); g.fillStyle = lite ? '#141414' : '#efe8db'; g.font = '500 24px "Geist Mono"'; g.letterSpacing = '6px'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(a.toUpperCase(), 22, 33); g.letterSpacing = '0px'; }
function edgeTex() { const c = document.createElement('canvas'); c.width = 64; c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#0c0c0c'; g.fillRect(0, 0, 64, 512);
  for (let x = 6; x < 58; x += 3) { g.fillStyle = x % 2 ? '#1a1a1a' : '#111'; g.fillRect(x, 0, 1.5, 512); } return ctex(c); }
function trayTex() { const c = document.createElement('canvas'); c.width = 512; c.height = 720; const g = c.getContext('2d'); g.fillStyle = '#0d0d0e'; g.fillRect(0, 0, 512, 720);
  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 3; [220, 206, 70].forEach((r) => { g.beginPath(); g.arc(256, 360, r, 0, 7); g.stroke(); });
  g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(28, 40, 6, 640); return ctex(c); }

/* ---------------- the cases: a real DVD build. Plastic body, a printed paper insert, a clear sleeve over it ---------------- */
const blackPlastic = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: .42, roughnessMap: wear, clearcoat: .9, clearcoatRoughness: .3, clearcoatRoughnessMap: wear });
const clearPlastic = new THREE.MeshPhysicalMaterial({ color: 0xeaf4fb, roughness: .06, roughnessMap: wear, transmission: .92, thickness: .35, ior: 1.5, attenuationColor: new THREE.Color(0x8fc3e6), attenuationDistance: .35, clearcoat: 1, clearcoatRoughness: .03, specularIntensity: 1, envMapIntensity: 1.8 });
/* glossy coloured plastic, one per photographer */
const tintCache = {}; const tinted = (hex) => tintCache[hex] || (tintCache[hex] = new THREE.MeshPhysicalMaterial({ color: hex, roughness: .28, roughnessMap: wear, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.4 }));
const blackInner = new THREE.MeshPhysicalMaterial({ map: trayTex(), roughness: .6, clearcoat: .4, clearcoatRoughness: .6 });
const blackEdge = new THREE.MeshStandardMaterial({ map: edgeTex(), roughness: .5 });
/* the sleeve: thin clear film over the insert, smudged and scuffed */
/* black and additive, so it adds only its reflections: gloss over the print without blurring it */
const sleeveFilm = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: .08, roughnessMap: wear, clearcoat: 1, clearcoatRoughness: .1, clearcoatRoughnessMap: wear, envMapIntensity: .9, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const halfGeo = new RoundedBoxGeometry(W, H, D / 2, 2, .016);
const IW = W - .07, IH = H - .08, insertGeo = new THREE.PlaneGeometry(IW, IH), filmGeo = new RoundedBoxGeometry(W - .02, H - .02, .006, 1, .003);
const discGeo = new THREE.CylinderGeometry(.6, .6, .012, 96); discGeo.rotateX(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(.068, .075, .028, 40); hubGeo.rotateX(Math.PI / 2);
const discUnder = new THREE.MeshPhysicalMaterial({ color: 0xd8dbe0, metalness: 1, roughness: .12, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [150, 900] });
const discEdge = new THREE.MeshPhysicalMaterial({ color: 0xcfd3da, metalness: .6, roughness: .2 });
const cases = [], labels = [];
rows.forEach((r, k) => { let x = -r.w / 2; const y = rowY(k);
  r.gs.forEach((gp) => { labels.push({ a: gp.a, x, y, w: gw(gp), row: k });
    gp.items.forEach((i, n) => { const v = VIDS[i]; v.i = i;
      const coverC = document.createElement('canvas'); coverC.width = 600; coverC.height = 844;
      const discC = document.createElement('canvas'); discC.width = discC.height = 512;
      const spC = document.createElement('canvas'); spC.width = 64; spC.height = 844;
      const coverT = ctex(coverC), discT = ctex(discC), spT = ctex(spC);
      const insert = new THREE.MeshStandardMaterial({ map: coverT, roughness: .7, envMapIntensity: .4 });
      const spine = new THREE.MeshPhysicalMaterial({ map: spT, roughness: .35, clearcoat: 1, clearcoatRoughness: .2, clearcoatRoughnessMap: wear });
      const discTop = new THREE.MeshPhysicalMaterial({ map: discT, alphaTest: .5, roughness: .45, clearcoat: .6, clearcoatRoughness: .25, metalness: .15 });
      /* case frame: origin at the bottom of the spine, centre of the depth; +x across, +y up, +z the cover */
      const grp = new THREE.Group();
      const tray = new THREE.Mesh(halfGeo, [blackEdge, spine, blackPlastic, blackPlastic, blackInner, blackPlastic]); tray.position.set(W / 2, H / 2, -D / 4); grp.add(tray);
      const hinge = new THREE.Group(); grp.add(hinge);
      const lid = new THREE.Mesh(halfGeo, [blackEdge, spine, blackPlastic, blackPlastic, blackPlastic, blackPlastic]); lid.position.set(W / 2, H / 2, D / 4); hinge.add(lid);
      const ins = new THREE.Mesh(insertGeo, insert); ins.position.set(W / 2 + .006, H / 2, D / 2 + .0012); hinge.add(ins);
      const film = new THREE.Mesh(filmGeo, sleeveFilm); film.position.set(W / 2, H / 2, D / 2 + .004); hinge.add(film);
      const hub = new THREE.Mesh(hubGeo, blackPlastic); hub.position.set(W / 2, H / 2, 0); grp.add(hub);
      const disc = new THREE.Mesh(discGeo, [discEdge, discTop, discUnder]); disc.position.set(W / 2, H / 2, .012); grp.add(disc);
      [tray, lid, ins, film, disc, hub].forEach((m) => { m.castShadow = m !== hub && m !== film; m.receiveShadow = true; m.userData.caseIdx = cases.length; });
      const base = { p: new THREE.Vector3(x + n * STEP, y, -.35), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-.03, .95, 0)) };
      grp.position.copy(base.p); grp.quaternion.copy(base.q); scene.add(grp);
      cases.push({ v, i, grp, tray, lid, hinge, hub, disc, coverC, coverT, discC, discT, spC, spT, im: null, base, hov: 0, row: k, discHome: disc.position.clone() }); });
    x += gw(gp) + GAP; }); });
/* a little plate on the shelf edge for each photographer */
labels.forEach((l) => { const c = document.createElement('canvas'); c.width = 512; c.height = 64; l.c = c; l.t = ctex(c);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.25, .16), new THREE.MeshStandardMaterial({ map: l.t, roughness: .4, metalness: .2 })); p.position.set(l.x + .62, l.y - ST / 2, -.4 + SD / 2 + .002); scene.add(p); });
/* thumbnails arrive later: redraw the cover and the disc when each one lands */
let thumbs = 0, thumbsOk = 0;
cases.forEach((cs) => { const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => { cs.im = im; redraw(cs); thumbs++; thumbsOk++; };
  im.onerror = () => { thumbs++; };
  im.src = thumbUrl(cs.v.id); });
/* once the real covers are in, a 16:9 picture of the wall as it first opens goes to Studium for the Research page's card
   (only if nearly all of them loaded: offline, the card keeps the picture it has) */
let shotDone = !(BR && BR.shot), shotWait = 0;
function maybeShot(dt) { if (shotDone || thumbs < cases.length) return;
  if (thumbsOk < cases.length * .8) { shotDone = true; return; }
  if (modal || busy || hot != null || drag || tweens.length || Math.abs(view.z - view.tz) > .01 || Math.abs(view.x - view.tx) > .01) { shotWait = 0; return; }
  if ((shotWait += dt) < .6) return; shotDone = true;
  try { const W = canvas.width, H = canvas.height, ch = Math.min(H, W * 9 / 16), cw = ch * 16 / 9, o = document.createElement('canvas'); o.width = 960; o.height = 540;
    o.getContext('2d').drawImage(canvas, (W - cw) / 2, (H - ch) / 2, cw, ch, 0, 0, 960, 540); BR.shot(o.toDataURL('image/jpeg', .82)); } catch (e) {} }
function redraw(cs) { try { drawCover(cs.coverC, cs.v, cs.i, cs.im); cs.coverT.needsUpdate = true; drawDisc(cs.discC, cs.v, cs.im); cs.discT.needsUpdate = true; }
  catch (e) { cs.im = null; drawCover(cs.coverC, cs.v, cs.i, null); cs.coverT.needsUpdate = true; }
  drawSpine(cs.spC, cs.v, cs.i); cs.spT.needsUpdate = true; }
function reprint() { cases.forEach(redraw); labels.forEach((l) => { drawPlate(l.c, l.a); l.t.needsUpdate = true; }); }

/* put a look on: lights, room, plastic, printing */
function applyLook() { const L = LIGHTS[look.light];
  scene.background.set(L.bg); scene.fog.color.set(L.fog[0]); scene.fog.near = L.fog[1]; scene.fog.far = L.fog[2];
  renderer.toneMappingExposure = L.exposure; scene.environmentIntensity = L.env;
  wallMat.color.set(L.wall); wallMat.normalScale.set(L.wallN, L.wallN);
  if (L.lacquer) { Object.assign(shelfMat, { map: null, roughnessMap: null, normalMap: null, roughness: .16, clearcoat: 1, clearcoatRoughness: .05 }); }
  else Object.assign(shelfMat, oakMaps, { roughness: 1, clearcoat: .3, clearcoatRoughness: .4 });
  shelfMat.color.set(L.wood); shelfMat.needsUpdate = true;
  spots.forEach((s) => { s.color.set(L.spot[0]); s.intensity = L.spot[1]; s.angle = L.spot[2]; s.penumbra = L.spot[3]; });
  washes.forEach((w) => { w.color.set(L.wash[0]); w.intensity = L.wash[1]; });
  key.intensity = L.key; rim.color.set(L.fill[0]); rim.intensity = L.fill[1];
  buildBeams(); beamMat.uniforms.col.value.set(L.spot[0]); beamMat.uniforms.k.value = L.beams; beams.forEach((b) => { b.visible = L.beams > 0; });
  dust.visible = L.dust > 0; dust.material.opacity = L.dust; if (bloomPass) bloomPass.strength = L.bloom;
  cases.forEach((cs) => { const body = look.body === 'clear' ? clearPlastic : look.body === 'colour' ? tinted(hueOf(cs.v.a)) : blackPlastic, edge = look.body === 'black' ? blackEdge : body, inner = look.body === 'black' ? blackInner : body; cs.tray.material[0] = edge; cs.tray.material[2] = cs.tray.material[3] = cs.tray.material[5] = body; cs.tray.material[4] = inner;
    cs.lid.material[0] = edge; [2, 3, 4, 5].forEach((k) => { cs.lid.material[k] = body; }); cs.hub.material = body; });
  reprint(); try { if (DATA.styles) localStorage.setItem('dvd_look', JSON.stringify(look)); } catch (e) {} }
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
  reprint(); drawFace(false, 'NO DISC'); faceT.needsUpdate = true; });
const face = new THREE.Mesh(new THREE.PlaneGeometry(PW - .08, PH - .06), new THREE.MeshPhysicalMaterial({ map: faceT, emissiveMap: faceT, emissive: 0xffffff, emissiveIntensity: .9, roughness: .15, clearcoat: 1, clearcoatRoughness: .05 }));
face.position.set(0, 0, PD / 2 + .002); player.add(face);
const pTray = new THREE.Group(); player.add(pTray);
const trayGeo = new RoundedBoxGeometry(1.5, .05, 1.6, 2, .01);
const trayC = document.createElement('canvas'); trayC.width = trayC.height = 512; { const g = trayC.getContext('2d'); g.fillStyle = '#0e0e10'; g.fillRect(0, 0, 512, 512);
  g.beginPath(); g.arc(256, 256, 236, 0, 7); g.fillStyle = '#08080a'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 3; g.stroke(); g.beginPath(); g.arc(256, 256, 60, 0, 7); g.fillStyle = '#151518'; g.fill(); }
const pTrayMesh = new THREE.Mesh(trayGeo, [blackPlastic, blackPlastic, new THREE.MeshStandardMaterial({ map: ctex(trayC), roughness: .6 }), blackPlastic, blackPlastic, blackPlastic]);
pTrayMesh.position.set(0, .03, 0); pTray.add(pTrayMesh); pTray.position.set(-.55, 0, PD / 2 - .8);
const TRAY_IN = PD / 2 - .8, TRAY_OUT = PD / 2 + .72;

/* ---------------- camera: the whole wall, or close on one photographer ---------------- */
const wallW = SL, wallH = rowY(0) + H + .8;
const view = { x: 0, y: wallMid, z: 16, tx: 0, ty: wallMid, tz: 16 };
/* fill the screen top to bottom; wider than the screen slides left and right */
function fitZ() { const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); return (wallH + .1) / vh; }
let zOver = 16; const zNear = 8.2;
function clampView() { const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hh = view.tz * vh / 2, hw = hh * camera.aspect;
  const mx = Math.max(0, wallW / 2 + .6 - hw), myLo = -.6 + hh - .4, myHi = rowY(0) + H + .6 - hh + .2;
  view.tx = Math.max(-mx, Math.min(mx, view.tx)); view.ty = myHi < myLo ? wallMid : Math.max(myLo, Math.min(myHi, view.ty)); view.tz = Math.max(zNear, Math.min(zOver, view.tz)); }
function size() { const w = innerWidth, h = innerHeight; if (!w || !h) return;   /* hidden (0x0) when the room is left: keep the last good view */
  renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  const was = zOver; zOver = fitZ(); if (view.tz >= was - .01) view.tz = zOver; clampView();
  if (modal && modal.st === 'play' && !busy) setRect(fullRect(), 1); }
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), .3, .5, .9); composer.addPass(bloomPass); composer.addPass(new OutputPass());
applyLook();
/* the look switcher: on the standalone page, and in Studium with ?dev */
if (DATA.styles) { const box = document.createElement('div'); box.id = 'looks';
  const row = (k, set) => '<div><span>' + k.toUpperCase() + '</span>' + Object.keys(set).map((n) => '<button data-k="' + k + '" data-v="' + n + '">' + (set[n].name || set[n]) + '</button>').join('') + '</div>';
  box.innerHTML = row('light', LIGHTS) + row('cover', COVERS) + row('body', CASES); document.body.appendChild(box);
  const mark = () => box.querySelectorAll('button').forEach((b) => b.classList.toggle('on', look[b.dataset.k] === b.dataset.v)); mark();
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; look[b.dataset.k] = b.dataset.v; applyLook(); mark(); }); }
addEventListener('resize', size); size(); view.x = view.tx; view.y = view.ty; view.z = view.tz;

/* ---------------- the photographers along the bottom ---------------- */
function focusGroup(k) { if (k < 0) { view.tx = 0; view.ty = wallMid; view.tz = zOver; } else { const l = labels[k]; view.tx = l.x + l.w / 2; view.ty = l.y + H / 2 + .1; view.tz = Math.max(zNear, Math.min(zOver, 9)); } clampView(); navOn = k; }
let navOn = -1;

/* ---------------- input: drag, wheel, hover, click ---------------- */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(9, 9), pickables = [];
cases.forEach((cs) => pickables.push(cs.tray, cs.lid));
let drag = null, hot = null, modal = null, busy = false;
function pickAt(e) { const m = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(m, camera); const h = ray.intersectObjects(pickables, false)[0]; return h ? h.object.userData.caseIdx : null; }
canvas.addEventListener('pointerdown', (e) => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); drag = { x: e.clientX, y: e.clientY, vx: view.tx, moved: false }; });
addEventListener('pointermove', (e) => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return; if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) { drag.moved = true; canvas.classList.add('drag'); }
  if (drag.moved && !modal) { const k = view.z * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight; view.tx = drag.vx - (e.clientX - drag.x) * k; clampView(); } });
canvas.addEventListener('wheel', (e) => { if (modal) return; e.preventDefault(); view.tx += (e.deltaX + e.deltaY) * .006; clampView(); }, { passive: false });
canvas.addEventListener('pointerup', (e) => { const was = drag; drag = null; canvas.classList.remove('drag'); if (!was || was.moved) return; const k = pickAt(e);   /* raycast on the tap itself: a touch has no hover */
  if (!modal) { if (k != null) pull(k); return; }
  /* holding one: click it to put it on, click anywhere else to put it back */
  if (modal.st === 'look' && !busy) { if (k === cases.indexOf(modal.cs)) putOn(); else putBack(); } });
canvas.addEventListener('pointerleave', () => { mouse.set(9, 9); });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); if (modal) esc(); else if (BR && BR.key) BR.key('Escape'); return; }
  if (modal) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); view.tx += e.key === 'ArrowRight' ? 2.4 : -2.4; clampView(); return; }
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
const lookEl = $('#look'), screen = $('#screen');
function setModal(m) { modal = m; document.body.classList.toggle('modal', !!m); if (m) { hot = null; $('#hint').style.opacity = 0; } }
function lift(cs, on) { cs.grp.traverse((o) => { if (o.isMesh) o.renderOrder = on ? 2 : 0; }); }

/* pull it off the shelf: it floats in front of you */
async function pull(idx) { if (busy || modal) return; busy = true; const cs = cases[idx]; cs.hov = 0; setModal({ cs, st: 'look' }); sfx('cullPick'); lift(cs, true);
  lookEl.querySelector('.eb').textContent = cs.v.a; lookEl.querySelector('h2').textContent = cs.v.t;
  veilTo(.9, .6); holdOn(true, .7); await arcTo(cs.grp, holdPose(), .85, .25); lookEl.classList.add('on'); busy = false; }
function openPose() { const narrow = innerWidth < 760; return camPose(narrow ? -W / 2 : -2.35, narrow ? -.25 : -.55, 6.9, .1, .04); }
function holdPose() { const narrow = innerWidth < 760; return camPose(narrow ? -W / 2 : -1.45, narrow ? -.35 : -.95, 5.4, -.18); }
async function putBack() { if (busy || !modal) return; busy = true; const cs = modal.cs; lookEl.classList.remove('on'); sfx('cullPick');
  veilTo(0, .6); holdOn(false, .6); await arcTo(cs.grp, cs.base, .75, .2); lift(cs, false); setModal(null); busy = false; }

/* put it on: open the case, the player slides up, the disc goes in, the screen grows out of the player */
async function putOn() { if (busy || !modal || modal.st !== 'look') return; busy = true; const cs = modal.cs; modal.st = 'loading'; lookEl.classList.remove('on'); sfx('cullEnd');
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
  veilTo(0, .7); holdOn(false, .6); await arcTo(cs.grp, cs.base, .8, .2); lift(cs, false); setModal(null); busy = false; }
function esc() { if (!modal) return; if (modal.st === 'look') putBack(); else if (modal.st === 'play') eject(); }

/* ---------------- each frame ---------------- */
const clock = new THREE.Clock(), hint = $('#hint');
let paused = false, raf = 0;
function frame() { raf = 0; if (paused) return; const real = Math.min(.5, clock.getDelta()), dt = Math.min(.05, real);
  /* animations run on real time, so a slow machine still finishes them on time */
  for (let k = tweens.length - 1; k >= 0; k--) { const a = tweens[k]; a.t = Math.min(1, a.t + real / Math.max(.001, a.dur)); a.fn(a.ez(a.t)); if (a.t >= 1) { tweens.splice(k, 1); a.res(); } }
  if (dust.visible) driftDust(clock.elapsedTime);
  const f = 1 - Math.exp(-dt * 5); view.x += (view.tx - view.x) * f; view.y += (view.ty - view.y) * f; view.z += (view.tz - view.z) * f;
  const mx = modal || mouse.x > 5 ? 0 : mouse.x, my = modal || mouse.y > 5 ? 0 : mouse.y;
  if (!modal) { camera.position.set(view.x + mx * .25, view.y + .55 + my * .1, view.z); camera.lookAt(view.x, view.y + .1, -.4); }
  key.position.set(view.x - 4, view.y + 8, view.z * .6); key.target.position.set(view.x, view.y, -.6);
  if (!modal && !drag) { ray.setFromCamera(mouse, camera); const h = ray.intersectObjects(pickables, false)[0]; const idx = h ? h.object.userData.caseIdx : null;
    if (idx !== hot) { hot = idx; canvas.style.cursor = idx != null ? 'pointer' : ''; hint.style.opacity = idx != null ? 1 : 0; if (idx != null) { hint.querySelector('b').textContent = cases[idx].v.a; hint.querySelector('i').textContent = cases[idx].v.t; } } }
  cases.forEach((cs, k) => { if (modal && modal.cs === cs) return; const want = k === hot ? 1 : 0; cs.hov += (want - cs.hov) * (1 - Math.exp(-dt * 9));
    const u = cs.hov; if (u < .0005 && want === 0) { cs.hov = 0; } cs.grp.position.set(cs.base.p.x - .45 * u, cs.base.p.y + (cs.row === 0 && rows.length > 1 ? -.2 : .22) * u, cs.base.p.z + 1.6 * u);   /* the top row pops down a little so it stays on screen */
    cs.grp.rotation.set(-.03 + .05 * u, .95 * (1 - .88 * u), 0); cs.grp.scale.setScalar(1 + .14 * u); });
  /* the case in your hands follows the mouse a little */
  /* the case in your hands turns towards the mouse, around its own centre */
  if (modal && modal.st === 'look' && !busy) { const h = holdPose(), mx0 = mouse.x > 5 ? 0 : mouse.x, my0 = mouse.y > 5 ? 0 : mouse.y, tq = h.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(my0 * .22, -mx0 * .4, 0)));
    const mid = new THREE.Vector3(W / 2, H / 2, 0), c = mid.clone().applyQuaternion(h.q).add(h.p), k = 1 - Math.exp(-dt * 6);
    modal.cs.grp.quaternion.slerp(tq, k); modal.cs.grp.position.lerp(c.sub(mid.applyQuaternion(modal.cs.grp.quaternion)), k); }
  if (modal && modal.st === 'play') { const d = modal.cs.disc; if (d.parent === pTray) d.rotateZ(dt * 8); }
  if (view.tz < zOver - .3) nearestGroup();
  composer.render(); maybeShot(dt); raf = requestAnimationFrame(frame); }
function nearestGroup() { let best = 0, bd = 1e9; labels.forEach((l, k) => { const d = Math.hypot(l.x + l.w / 2 - view.x, l.y + H / 2 - view.y); if (d < bd) { bd = d; best = k; } }); navOn = best; return best; }
frame();

/* Studium drives these: pause when the room is hidden, stop the video when you leave */
window.DVDapp = {
  pause(p) { paused = !!p; if (!paused && !raf) { clock.getDelta(); frame(); } },
  stop() { screen.classList.remove('on'); screen.style.opacity = 0; screen.querySelector('.scr').innerHTML = ''; tweens.length = 0;
    if (modal) { const cs = modal.cs; if (cs.disc.parent !== cs.grp) { cs.grp.attach(cs.disc); } cs.disc.position.copy(cs.discHome); cs.disc.quaternion.identity(); cs.hinge.rotation.y = 0;
      cs.grp.position.copy(cs.base.p); cs.grp.quaternion.copy(cs.base.q); lift(cs, false); }
    player.visible = false; pTray.position.z = TRAY_IN; veil.material.opacity = 0; lookEl.classList.remove('on'); setModal(null); busy = false; },
  state() { return { modal: modal && modal.st, busy, cases: cases.length, rows: rows.length, view: { x: view.x, y: view.y, z: view.z }, playing: !!screen.querySelector('iframe,.ext') }; },
  pull, putOn, eject, focusGroup, hover(k) { hot = k; }
};
window.__ready = true;
