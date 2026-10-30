// A graded slab in 3D: an acrylic case with real reflections (a PMREM room environment, only on the secret
// materials so the table's own look is untouched), a "Studium Graded" label at the top, the photo card below it,
// and one finish layer over the photo from the finish registry (holo.js registers the shaders; matte is nothing).
// Built with the face along +z and the label up +y: rotation.x=-PI/2 lays it flat on the table, no rotation stands it.
import * as THREE from 'three';
import { backCanvases } from './print.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TIER, GRADES, VARIANT, finishOf, pad } from './slabs.js';
import { mountFinish, dropFinish, clickFinish, topWalk } from './fxmount.js';
import { variantFx } from './fxvariants.js';
import { studioEnvs } from './fxkit.js';

let ENV = null;
export function envMap(renderer) { if (!ENV) { const p = new THREE.PMREMGenerator(renderer); ENV = p.fromScene(new RoomEnvironment(), 0.04).texture; p.dispose(); } return ENV; }

/* ---------- finish registry ---------- */
const REG = {};
/* def: { make(ctx) → mesh|null, update(mesh, ctx) }  ctx: { THREE, slab, obj, w, h, photoTex, photoCanvas, tier, renderer, envMap } */
export function registerFinish(id, def) { REG[id] = def; }
export function hasFinish(id) { return !!REG[id]; }
registerFinish('matte', { make: () => null });
/* a plain tilt-reactive rainbow, the stand-in for every finish holo.js hasn't built yet */
const FOIL_VERT = `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`;
const FOIL_FRAG = `uniform vec2 uTilt; uniform float uTime; uniform float uStrength; uniform vec3 uTint; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
void main(){ float f=1.0-max(0.0,dot(normalize(vN),normalize(vV))); float band=vUv.x*0.9+vUv.y*0.5+uTilt.x*1.4-uTilt.y*0.8;
  vec3 c=hue(fract(band*1.6+uTime*0.03))*uTint; float a=(0.14+0.55*f+0.25*abs(uTilt.x)+0.2*abs(uTilt.y))*uStrength;
  gl_FragColor=vec4(c,clamp(a,0.0,0.85));
  #include <colorspace_fragment>
}`;
export function foilMaterial(o = {}) { return new THREE.ShaderMaterial({ uniforms: { uTilt: { value: new THREE.Vector2() }, uTime: { value: 0 }, uStrength: { value: o.strength ?? 1 }, uTint: { value: new THREE.Color(o.tint || 0xffffff) } },
  vertexShader: FOIL_VERT, fragmentShader: FOIL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); }
const basicFoil = { make: c => new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), foilMaterial({ strength: c.finish === 'gold' ? 0.5 : 0.38, tint: c.finish === 'gold' ? 0xffd27a : 0xffffff })),
  update: (m, c) => { m.material.uniforms.uTilt.value.copy(c.tilt); m.material.uniforms.uTime.value = c.time; } };
export function finishDef(id) { return REG[id] || REG.matte; }   /* a finish with no shader shows through its photo treatment alone (foil for everything unknown read as rainbow on every card) */

/* ---------- photographs ---------- */
const PHOTOS = new Map();
/* the base canvas for a slab's photo, loaded once (artist pack image, or the painted stand-in) */
/* borrowed and rival slabs are thrown away after a match: let their photos go too */
export function forgetPhoto(id) { PHOTOS.delete(id); }
export function photoCanvas(slab, S) {
  if (PHOTOS.has(slab.id)) return PHOTOS.get(slab.id);
  const painted = () => { const kinds = S.KINDS, k = kinds[slab.seed % kinds.length]; return S.paintPhoto(k, slab.seed, 960, 640); };
  const p = new Promise(res => {
    if (!slab.photo || !slab.photo.url) { res(painted()); return; }
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { try { const k = Math.min(1, 1024 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(2, Math.round(img.width * k)); c.height = Math.max(2, Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.getContext('2d').getImageData(0, 0, 1, 1); res(c); } catch (e) { res(painted()); } };
    img.onerror = () => res(painted()); img.src = slab.photo.url;
  });
  PHOTOS.set(slab.id, p); return p;
}
const FILTERS = { prism: 'grayscale(1) contrast(1.45) brightness(0.82)', cyanotype: 'grayscale(1) sepia(1) hue-rotate(165deg) saturate(2.4) brightness(0.9)', steel: 'grayscale(1) contrast(1.1) brightness(0.9)',
  silver: 'grayscale(1) sepia(0.22) contrast(1.14) brightness(1.02)', polychrome: 'saturate(2.3) contrast(1.25)', eclipse: 'invert(1) hue-rotate(180deg) contrast(1.1)', raku: 'sepia(0.8) contrast(1.45) brightness(0.88) saturate(0.6)', glass: 'contrast(0.85) brightness(1.18) saturate(0.75)' };
/* two colour gradient maps: the photo's tones mapped from the first colour (shadows) to the second (highlights) */
const MAPS = { keywarm: ['#1b0f08', '#f3dcb5'], keyblue: ['#071a33', '#dff1ff'], duoRose: ['#2a0a1e', '#ffd9e4'], duoMoss: ['#0c1a0f', '#e9f2c9'], duoInk: ['#070b1a', '#e6ecff'], duoEmber: ['#1a0600', '#ffc66b'], tritone: ['#101424', '#c0392b', '#fff1c1'] };
const FILTERS2 = { xpro: 'contrast(1.3) saturate(1.5) hue-rotate(-12deg) brightness(1.05)', infrared: 'grayscale(0.3) contrast(1.25) brightness(1.1) hue-rotate(150deg) saturate(1.3)' };
/* per pixel looks: a selective colour keeps the photo's main hue and greys the rest, solarise folds the highlights, posterise steps the tones, a vignette darkens the corners */
function pixels(c, fn) { const g = c.getContext('2d'), img = g.getImageData(0, 0, c.width, c.height); fn(img.data, c.width, c.height); g.putImageData(img, 0, 0); }
function hueOf(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return -1; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; }
function selective(d) { const hist = new Float32Array(36); for (let i = 0; i < d.length; i += 16) { const h = hueOf(d[i], d[i + 1], d[i + 2]); if (h < 0) continue; const s = (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])); hist[Math.floor(h / 10)] += s; } let best = 0; for (let k = 1; k < 36; k++) if (hist[k] > hist[best]) best = k; const H = best * 10 + 5;
  for (let i = 0; i < d.length; i += 4) { const h = hueOf(d[i], d[i + 1], d[i + 2]); let dh = h < 0 ? 180 : Math.abs(h - H); dh = Math.min(dh, 360 - dh); const keep = dh < 22 ? 1 : dh < 40 ? 1 - (dh - 22) / 18 : 0; const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = l + (d[i] - l) * keep; d[i + 1] = l + (d[i + 1] - l) * keep; d[i + 2] = l + (d[i + 2] - l) * keep; } }
function solar(d) { for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) { const v = d[i + k]; d[i + k] = v > 128 ? 255 - (v - 128) * 2 * 0.9 : v * 1.2; } }
function poster(d) { for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] / 51) * 51; }
function vignette(d, W, H) { const cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, f = 1 - 0.55 * Math.pow(Math.hypot(x - cx, y - cy) / R, 2.2); d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; } }
function split(d) { for (let i = 0; i < d.length; i += 4) { const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; const w = l < 0.5 ? l * 2 : 1, s = l < 0.5 ? 1 : (1 - l) * 2; d[i] = d[i] * 0.6 + (l < 0.5 ? 20 : 255) * 0.4 * (l < 0.5 ? (1 - w) : (1 - s)) + d[i] * 0.4 * (l < 0.5 ? w : s); d[i + 2] = d[i + 2] * 0.6 + (l < 0.5 ? 120 : 190) * 0.4 * (l < 0.5 ? (1 - w) : (1 - s)) + d[i + 2] * 0.4 * (l < 0.5 ? w : s); } }
const PIXEL = { selective: d => selective(d), solar: d => solar(d), poster: d => poster(d), vignette: (d, W, H) => vignette(d, W, H), split: d => split(d) };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function gradientMap(c, stops) { const g = c.getContext('2d'), img = g.getImageData(0, 0, c.width, c.height), d = img.data, cols = stops.map(hex), n = cols.length - 1;
  for (let i = 0; i < d.length; i += 4) { const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, p = l * n, k = Math.min(n - 1, Math.floor(p)), t = p - k, a = cols[k], b = cols[k + 1]; d[i] = a[0] + (b[0] - a[0]) * t; d[i + 1] = a[1] + (b[1] - a[1]) * t; d[i + 2] = a[2] + (b[2] - a[2]) * t; } g.putImageData(img, 0, 0); }
/* wear by grade, so a raw print hints at what the lab will say: dust from 8 down, scratches from 6, a creased corner and a cast from 4, a stained edge at 2 */
function wear(c, grade, seed) { if (grade == null || grade >= 9) return; const g = c.getContext('2d'), W = c.width, H = c.height; let a = (seed >>> 0) || 7; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  g.save(); g.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0, n = (9 - grade) * 40; i < n; i++) { const s = 0.6 + r() * 2; g.fillRect(r() * W, r() * H, s, s); }
  if (grade <= 6) { g.strokeStyle = 'rgba(255,255,255,0.33)'; g.lineWidth = 1.2; for (let i = 0; i < 8 - grade; i++) { const x = r() * W, y = r() * H, L = W * (0.1 + r() * 0.3), an = r() * Math.PI; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * L, y + Math.sin(an) * L); g.stroke(); } }
  if (grade <= 4) { const k = W * 0.12; g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(W, 0); g.lineTo(W - k, 0); g.lineTo(W, k); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W - k, 0); g.lineTo(W, k); g.stroke(); g.fillStyle = 'rgba(120,90,40,0.12)'; g.fillRect(0, 0, W, H); }
  if (grade <= 2) { g.fillStyle = 'rgba(60,40,20,0.4)'; g.fillRect(0, H * 0.95, W, H * 0.05); g.fillRect(0, 0, W * 0.02, H); }
  g.restore(); }
/* the photo as the card shows it: finish, variant and wear baked into a copy */
export function processPhoto(base, finish, variant, grade, seed) {
  const f = [FILTERS[finish] || FILTERS2[finish], variant === 'negative' ? 'invert(1) sepia(0.45) hue-rotate(-15deg) contrast(1.15)' : ''].filter(Boolean).join(' ');
  const map = MAPS[finish], px = PIXEL[finish], worn = grade != null && grade < 9;
  if (!f && !map && !px && !worn) return base;
  const c = document.createElement('canvas'); c.width = base.width; c.height = base.height; const g = c.getContext('2d');
  try { g.filter = f || 'none'; } catch (e) {} g.drawImage(base, 0, 0); g.filter = 'none';
  if (map) gradientMap(c, map); if (px) pixels(c, px); if (worn) wear(c, grade, seed); return c;
}
/* text that shrinks to fit its column (long titles on the label) */
function fitFill(g, maxW, minPx, text, x, y) { const font = g.font; let px = +(font.match(/(\d+(?:\.\d+)?)px/) || [0, 24])[1]; while (px > minPx && g.measureText(text).width > maxW) { px -= 1; g.font = font.replace(/\d+(?:\.\d+)?px/, px + 'px'); } g.fillText(text, x, y); g.font = font; }
export function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }

/* ---------- the label ---------- */
/* Sam's label (Round 2 page): textured ground, bold wordmark, four photography sub-grades, a holographic
   verification sticker with the cert, the grade big. Colourway is part of the roll (slab.label: black / gold / tier).
   Portrait slabs carry it as a strip on top; landscape slabs stand it on end down the left side, so both end up the same size. */
export const LABEL_W = 1320, LABEL_H = 400;
const SUBS = ['LIGHT', 'FRAME', 'MOMENT', 'PRINT'];
function labelStyle(slab) { return slab.label || (slab.tier === 'legendary' ? 'gold' : 'black'); }
function sparkle(g, W, H, light) { for (let i = 0; i < 9000; i++) { g.fillStyle = light ? 'rgba(255,255,255,' + (Math.random() * 0.35) + ')' : 'rgba(255,220,150,' + (Math.random() * 0.22) + ')'; g.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4); } for (let i = 0; i < 4000; i++) { g.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.25) + ')'; g.fillRect(Math.random() * W, Math.random() * H, 1.2, 1.2); } }
function labelInks(style, tc) { return { ink: style === 'gold' ? '#111111' : style === 'tier' ? tc : '#e8c67a', dim: style === 'gold' ? 'rgba(17,17,17,0.6)' : style === 'tier' ? tc + 'aa' : 'rgba(232,198,122,0.62)' }; }
function labelGround(g, W, H, style) { if (style === 'gold') { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#9a7024'); gr.addColorStop(0.35, '#f1cf7c'); gr.addColorStop(0.6, '#c08f2c'); gr.addColorStop(1, '#f6dd98'); g.fillStyle = gr; g.fillRect(0, 0, W, H); sparkle(g, W, H, true); } else { g.fillStyle = '#0d0d10'; g.fillRect(0, 0, W, H); sparkle(g, W, H, false); } }
function serialOf(slab) { return slab.serial ? slab.serial : slab.stamp ? 'No. ' + pad(slab.stamp, 2) + '/50' : ''; }
function labelCanvas(slab) {
  const W = LABEL_W, H = LABEL_H, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const t = TIER[slab.tier], style = labelStyle(slab), { ink, dim } = labelInks(style, t.color);
  labelGround(g, W, H, style); if (style === 'tier') { g.fillStyle = t.color; g.fillRect(0, 0, 14, H); }
  g.strokeStyle = dim; g.lineWidth = 2; g.strokeRect(44, 96, 208, 208);
  g.fillStyle = ink; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = '700 112px "Geist", system-ui, sans-serif'; g.fillText('STUDIUM', 290, 190);
  g.font = '500 26px "Geist Mono", ui-monospace, monospace'; g.fillStyle = dim; g.fillText('G R A D E D   P H O T O G R A P H', 294, 232);
  g.fillStyle = ink; g.font = '600 34px "Geist", system-ui, sans-serif'; fitFill(g, 470, 16, slab.title || '', 292, 296);
  g.fillStyle = dim; g.font = '500 24px "Geist Mono", ui-monospace, monospace'; fitFill(g, 470, 12, ['Studium · 2026 · NZ', t.name.toUpperCase(), slab.variant ? (VARIANT[slab.variant] || {}).name : '', serialOf(slab)].filter(Boolean).join(' · '), 294, 336);
  g.fillStyle = dim; g.fillRect(762, 70, 2, 260); g.fillRect(1052, 70, 2, 260);
  const subs = slab.subs || [slab.grade, slab.grade, slab.grade, slab.grade]; g.font = '600 30px "Geist Mono", ui-monospace, monospace';
  SUBS.forEach((k, i) => { const y = 122 + i * 62; g.fillStyle = ink; g.textAlign = 'left'; g.fillText(k, 796, y); g.textAlign = 'right'; g.fillText(slab.pending ? '·' : String(subs[i]), 1022, y); const kw = g.measureText(k).width; g.fillStyle = dim; g.fillRect(796 + kw + 18, y - 8, Math.max(0, 1022 - 60 - (796 + kw + 18)), 2); });
  g.fillStyle = dim; g.font = '500 22px "Geist Mono", ui-monospace, monospace'; g.textAlign = 'left'; g.fillText('CERT  ' + slab.cert, 796, 366);
  g.fillStyle = ink; g.textAlign = 'right'; g.font = '400 210px "Fraunces", Georgia, serif'; g.fillText(slab.pending ? '' : String(slab.grade), 1284, 248);
  g.font = '600 34px "Geist Mono", ui-monospace, monospace'; g.fillText(slab.pending ? 'GRADING' : (GRADES[slab.grade] || ''), 1282, 320);
  return c;
}
function labelCanvasVertical(slab) {
  const W = LABEL_H, H = LABEL_W, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const t = TIER[slab.tier], style = labelStyle(slab), { ink, dim } = labelInks(style, t.color);
  labelGround(g, W, H, style); if (style === 'tier') { g.fillStyle = t.color; g.fillRect(0, 0, W, 14); }
  g.strokeStyle = dim; g.lineWidth = 2; g.strokeRect(96, 44, 208, 208);
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = '700 74px "Geist", system-ui, sans-serif'; g.fillText('STUDIUM', W / 2, 346);
  g.fillStyle = dim; g.font = '500 20px "Geist Mono", ui-monospace, monospace'; g.fillText('G R A D E D  P H O T O G R A P H', W / 2, 382);
  g.fillStyle = ink; g.font = '600 27px "Geist", system-ui, sans-serif'; const parts = String(slab.title || '').split(' · '); fitFill(g, 360, 14, parts[0] || '', W / 2, 448); fitFill(g, 360, 14, parts.slice(1).join(' · '), W / 2, 486);
  g.fillStyle = dim; g.font = '500 19px "Geist Mono", ui-monospace, monospace'; fitFill(g, 360, 11, ['2026 · NZ', t.name.toUpperCase(), serialOf(slab)].filter(Boolean).join(' · '), W / 2, 524);
  if (slab.variant) g.fillText(((VARIANT[slab.variant] || {}).name || '').toUpperCase(), W / 2, 552);
  g.fillStyle = dim; g.fillRect(50, 566, 300, 2);
  const subs = slab.subs || [slab.grade, slab.grade, slab.grade, slab.grade]; g.font = '600 27px "Geist Mono", ui-monospace, monospace';
  SUBS.forEach((k, i) => { const y = 626 + i * 58; g.fillStyle = ink; g.textAlign = 'left'; g.fillText(k, 56, y); g.textAlign = 'right'; g.fillText(slab.pending ? '·' : String(subs[i]), 344, y); const kw = g.measureText(k).width; g.fillStyle = dim; g.fillRect(56 + kw + 16, y - 7, Math.max(0, 344 - 46 - (56 + kw + 16)), 2); });
  g.fillStyle = dim; g.font = '500 20px "Geist Mono", ui-monospace, monospace'; g.textAlign = 'left'; g.fillText('CERT  ' + slab.cert, 56, 892);
  g.fillStyle = dim; g.fillRect(50, 924, 300, 2);
  g.fillStyle = ink; g.textAlign = 'center'; g.font = '400 230px "Fraunces", Georgia, serif'; g.fillText(slab.pending ? '' : String(slab.grade), W / 2, 1168);
  g.font = '600 32px "Geist Mono", ui-monospace, monospace'; g.fillText(slab.pending ? 'GRADING' : (GRADES[slab.grade] || ''), W / 2, 1236);
  return c;
}
/* the holographic verification sticker: a foil square that reacts to tilt, with the wordmark and cert over it */
function sticker(slab, size) { const g = new THREE.Group(); const base = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: 0xc8c8cc })); g.add(base);
  const foil = new THREE.Mesh(new THREE.PlaneGeometry(size, size), foilMaterial({ strength: 1.3 })); foil.position.z = 0.002; g.add(foil); g.userData.foil = foil;
  const c = document.createElement('canvas'); c.width = c.height = 256; const gg = c.getContext('2d'); gg.strokeStyle = 'rgba(0,0,0,0.55)'; gg.lineWidth = 6; gg.strokeRect(8, 8, 240, 240); gg.fillStyle = 'rgba(0,0,0,0.78)'; gg.textAlign = 'center'; gg.font = '700 54px "Geist", system-ui, sans-serif'; gg.fillText('STUDIUM', 128, 108); gg.font = '600 26px "Geist Mono", ui-monospace, monospace'; gg.fillText('VERIFIED', 128, 146); gg.font = '500 30px "Geist Mono", ui-monospace, monospace'; gg.fillText(String(slab.cert || '').replace('#', '').padStart(7, '0'), 128, 208);
  const txt = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })); txt.position.z = 0.004; g.add(txt); g.traverse(m => { if (m.isMesh) m.userData.order = 5; }); return g; }

/* ---------- the slab ---------- */
/* Sam's picks: clear acrylic case, full bleed mount, the Round 2 label. Portrait photos are as wide as the label (lw); landscape
   photos are as tall as the stood-up label, which sits down the left. The Full art variant runs the photo under the label too. */
/* the label drawn again (the grade kept back until a parcel's count up has run) */
export function relabel(obj) { const l = obj.parts.label; if (!l) return; const old = l.material.map; l.material.map = tex(obj.land ? labelCanvasVertical(obj.slab) : labelCanvas(obj.slab)); l.material.needsUpdate = true; if (old) old.dispose(); }
export const SLAB = { lw: 2.6, lab: 0.78, gap: 0.08, margin: 0.17, th: 0.19 };
export function makeSlab(slab, S) {
  const group = new THREE.Group(); group.userData.slab = slab; const inner = new THREE.Group(); group.add(inner);
  const obj = { group, inner, slab, w: 0, h: 0, th: SLAB.th, photoW: 0, photoH: 0, finish: null, tilt: new THREE.Vector2(), pointer: new THREE.Vector2(), time: Math.random() * 100, base: null, parts: {}, built: false, ready: null, top: false };
  const env = envMap(S.renderer);
  obj.ready = photoCanvas(slab, S).then(base => { obj.base = base; build(obj, S, env); return obj; });
  obj.setFinish = id => { if (!obj.built) return; applyFinish(obj, S, env, id); };
  obj.refresh = () => { if (obj.built) applyFinish(obj, S, env, obj.finishId); };
  obj.update = (dt, pointer) => { obj.time += dt; if (pointer) obj.pointer.copy(pointer); if (obj.parts.sticker) { const u = obj.parts.sticker.userData.foil.material.uniforms; u.uTilt.value.copy(obj.tilt); u.uTime.value = obj.time; } if (obj.finish && obj.finish.def.update) try { obj.finish.def.update(obj.finish.mesh, { THREE, dt, time: obj.time, tilt: obj.tilt, pointer: obj.pointer, slab, obj }); } catch (e) { console.error(e); } };
  /* while inspected the slab draws over everything, like an inspected print */
  obj.setTop = on => { obj.top = on; topWalk(group, on); };
  obj.click = uv => clickFinish(obj, uv);
  obj.dispose = () => { obj.disposed = true; dropFinish(obj); group.traverse(m => { if (m.isMesh) { m.geometry.dispose(); [].concat(m.material).forEach(mt => { if (mt.map && mt.map !== obj.parts.photoTex) mt.map.dispose(); mt.dispose(); }); } }); if (obj.parts.photoTex) obj.parts.photoTex.dispose(); if (group.parent) group.parent.remove(group); };
  return obj;
}
function build(obj, S, env) {
  const { slab, inner, base } = obj, aspect = base.width / base.height, full = slab.variant === 'full', clear = slab.variant === 'clear', neg = slab.variant === 'negative';
  const land = aspect > 1.05, m = SLAB.margin, lab = SLAB.lab, gap = SLAB.gap;
  const pw = land ? SLAB.lw * aspect : SLAB.lw, ph = land ? SLAB.lw : SLAB.lw / aspect;
  obj.photoW = pw; obj.photoH = ph; obj.land = land; obj.w = land ? lab + gap + pw + m * 2 : pw + m * 2; obj.h = land ? ph + m * 2 : ph + lab + gap + m * 2;
  /* a sealed block finish (the crystal etch, the scan) brings its own thicker case */
  const cw = pw, ch = ph, th = finishDef(finishOf(slab, S.testFinish ? S.testFinish() : null)).th || SLAB.th, z0 = -th / 2 + 0.03; obj.th = th;
  /* backing card */
  const gold = slab.tier === 'legendary', noir = slab.tier === 'mythic';
  if (!clear) { let m; if (gold) { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 256); gr.addColorStop(0, '#8a6020'); gr.addColorStop(0.4, '#f3d48a'); gr.addColorStop(0.6, '#b07c25'); gr.addColorStop(1, '#ffe6a8'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); m = new THREE.MeshLambertMaterial({ map: tex(c) }); }
    else m = new THREE.MeshLambertMaterial({ color: noir || neg ? 0x08080a : 0xf2eee6 });
    const bc = backCanvases(obj.w - 0.1, obj.h - 0.1, TIER[slab.tier] || TIER.common, S.dev && S.dev.opt ? S.dev.opt('back') : 'black', slab);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(obj.w - 0.1, obj.h - 0.1), new THREE.MeshStandardMaterial({ map: tex(bc.map), normalMap: new THREE.CanvasTexture(bc.normal), roughness: bc.dark ? 0.45 : 0.8, envMap: env, envMapIntensity: 0.3 }));
    back.rotation.y = Math.PI; back.position.z = z0 - 0.004; back.userData.order = 1; inner.add(back); obj.parts.back = back;   /* the card's back shows when you turn it */
    const card = new THREE.Mesh(new THREE.PlaneGeometry(obj.w - 0.1, obj.h - 0.1), m); card.position.z = z0; card.userData.order = 1; inner.add(card); obj.parts.card = card; }
  /* the photograph */
  const cx = land ? -(obj.w / 2) + m + lab + gap + pw / 2 : 0, cy = land ? 0 : -(obj.h / 2) + m + ph / 2;
  const photoMat = new THREE.MeshBasicMaterial({ map: null, transparent: clear, opacity: clear ? 0.82 : 1 });
  /* full art: the photo fills the whole case, cropped to the slab's shape, and the label floats over it */
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(full ? obj.w - 0.1 : pw, full ? obj.h - 0.1 : ph), photoMat); photo.position.set(full ? 0 : cx, full ? 0 : cy, z0 + 0.012); photo.userData.order = 2; inner.add(photo); obj.parts.photo = photo;
  if (full) { const sw = (obj.w - 0.1) / pw, sh = (obj.h - 0.1) / ph, k = Math.max(sw, sh); const uv = photo.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * sw / k, 0.5 + (uv.getY(i) - 0.5) * sh / k); uv.needsUpdate = true; }
  if (slab.variant === 'misprint') { photo.position.x += 0.07; photo.position.y -= 0.04;
    const ghost = new THREE.Mesh(photo.geometry, new THREE.MeshBasicMaterial({ map: null, transparent: true, opacity: 0.32, depthWrite: false })); ghost.position.set(cx + 0.16, cy + 0.05, z0 + 0.016); ghost.userData.order = 3; inner.add(ghost); obj.parts.ghost = ghost;
    const band = new THREE.Mesh(new THREE.PlaneGeometry(cw * 1.1, 0.14), foilMaterial({ strength: 1.6 })); band.position.set(cx, cy - ph * 0.28, z0 + 0.02); band.rotation.z = -0.06; band.userData.order = 4; inner.add(band); obj.parts.band = band; }
  if (neg) { /* sprocket holes down both long edges of the card */
    const sp = document.createElement('canvas'); sp.width = 512; sp.height = 64; const g = sp.getContext('2d'); g.fillStyle = '#08080a'; g.fillRect(0, 0, 512, 64); g.fillStyle = '#d8d2c4'; for (let x = 10; x < 512; x += 36) { g.beginPath(); g.roundRect(x, 20, 22, 24, 4); g.fill(); }
    const sm = new THREE.MeshBasicMaterial({ map: tex(sp) }); [1, -1].forEach(s => { const r = new THREE.Mesh(new THREE.PlaneGeometry(cw, 0.12), sm); r.position.set(cx, cy + s * (ch / 2 - 0.07), z0 + 0.012); r.userData.order = 3; inner.add(r); }); }
  if (slab.variant === 'stamped') { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#e3ad57'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.fillStyle = '#3a2606'; g.font = '700 30px "Geist Mono", monospace'; g.textAlign = 'center'; g.fillText(pad(slab.stamp, 2), 64, 60); g.font = '500 18px "Geist Mono", monospace'; g.fillText('/ 50', 64, 88);
    const st = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })); st.position.set(cx + pw / 2 - 0.2, cy - ph / 2 + 0.2, z0 + 0.02); st.userData.order = 4; inner.add(st); }
  /* the label and its sticker */
  const lz = z0 + (full ? 0.03 : 0.012), lmat = new THREE.MeshBasicMaterial({ map: tex(land ? labelCanvasVertical(slab) : labelCanvas(slab)), transparent: full, opacity: full ? 0.92 : 1 });
  const label = land ? new THREE.Mesh(new THREE.PlaneGeometry(lab, ph), lmat) : new THREE.Mesh(new THREE.PlaneGeometry(pw, lab), lmat);
  if (land) label.position.set(-(obj.w / 2) + m + lab / 2, 0, lz); else label.position.set(0, obj.h / 2 - m - lab / 2, lz);
  label.userData.order = full ? 5 : 2; inner.add(label); obj.parts.label = label;
  const stk = sticker(slab, lab * 0.52); if (land) stk.position.set(label.position.x, ph / 2 - 0.112 * ph, lz + 0.002); else stk.position.set(-pw / 2 + 0.112 * pw, label.position.y, lz + 0.002); inner.add(stk); obj.parts.sticker = stk;
  /* the acrylic */
  /* clear acrylic (Sam, Slab Lab: "the case is wayyy better"): a black dielectric drawn additively, so the case adds only its
     reflections (sharp highlights, bright bevels at grazing angles) and never a white haze over the photo */
  const caseGeo = new RoundedBoxGeometry(obj.w, obj.h, th, 8, 0.05);
  /* it reflects the dark softbox studio, not the bright room the slab's own parts use: a bright room reflected additively reads as a white sheet */
  const caseEnv = studioEnvs(S.renderer).studio;
  const acr = new THREE.Mesh(caseGeo, new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.49, envMap: caseEnv, envMapIntensity: clear ? 1.4 : 1.0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  acr.userData.order = 6; acr.userData.noParticles = true; inner.add(acr); obj.parts.acrylic = acr;
  const edge = new THREE.Mesh(caseGeo, new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.03, metalness: 0, ior: 1.49, envMap: caseEnv, envMapIntensity: 0.5, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide })); edge.userData.order = 5; edge.userData.noParticles = true; inner.add(edge);
  obj.built = true; applyFinish(obj, S, env, finishOf(slab, S.testFinish ? S.testFinish() : null));
}
function applyFinish(obj, S, env, id) {
  const { slab, base } = obj; obj.finishId = id;
  const shown = processPhoto(base, id, slab.variant, slab.grade, slab.seed);
  if (obj.parts.photoTex) obj.parts.photoTex.dispose(); const t = tex(shown); obj.parts.photoTex = t;
  obj.parts.photo.material.map = t; obj.parts.photo.material.needsUpdate = true; if (obj.parts.ghost) { obj.parts.ghost.material.map = t; obj.parts.ghost.material.needsUpdate = true; }
  const def = finishDef(id), full = slab.variant === 'full';
  mountFinish(obj, S, { id, def, shown, tex: t, texFn: tex, w: full ? obj.w - 0.1 : obj.photoW, h: full ? obj.h - 0.1 : obj.photoH, at: obj.parts.photo.position, dz: 0.01, order: 4, full,
    fullUV: obj.parts.photo.geometry.attributes.uv, tier: TIER[slab.tier], env, variantFx });
}
