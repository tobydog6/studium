// A graded slab in 3D: an acrylic case with real reflections (a PMREM room environment, only on the secret
// materials so the table's own look is untouched), a "Studium Graded" label at the top, the photo card below it,
// and one finish layer over the photo from the finish registry (holo.js registers the shaders; matte is nothing).
// Built with the face along +z and the label up +y: rotation.x=-PI/2 lays it flat on the table, no rotation stands it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TIER, GRADES, VARIANT, finishOf, pad } from './slabs.js';

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
function finishDef(id) { return REG[id] || (id === 'matte' ? REG.matte : basicFoil); }

/* ---------- photographs ---------- */
const PHOTOS = new Map();
/* the base canvas for a slab's photo, loaded once (artist pack image, or the painted stand-in) */
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
const FILTERS = { gold: 'sepia(1) saturate(1.6) contrast(1.05) brightness(1.04)', prism: 'grayscale(1) contrast(1.45) brightness(0.82)', cyanotype: 'grayscale(1) sepia(1) hue-rotate(165deg) saturate(2.4) brightness(0.9)', chrome: 'grayscale(0.6) contrast(1.25)', steel: 'grayscale(1) contrast(1.1) brightness(0.9)' };
/* the photo as the card shows it: tier and variant treatments baked into a copy */
function processPhoto(base, finish, variant) {
  const f = [FILTERS[finish], variant === 'negative' ? 'invert(1) sepia(0.45) hue-rotate(-15deg) contrast(1.15)' : ''].filter(Boolean).join(' ');
  if (!f) return base;
  const c = document.createElement('canvas'); c.width = base.width; c.height = base.height; const g = c.getContext('2d');
  try { g.filter = f; } catch (e) {} g.drawImage(base, 0, 0); g.filter = 'none'; return c;
}
export function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }

/* ---------- the label ---------- */
function labelCanvas(slab, w, h) {
  const PX = 420, W = Math.round(w * PX), H = Math.round(h * PX), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const t = TIER[slab.tier], gold = slab.tier === 'legendary', noir = slab.tier === 'mythic';
  if (gold) { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#8a6020'); gr.addColorStop(0.4, '#f3d48a'); gr.addColorStop(0.6, '#b07c25'); gr.addColorStop(1, '#ffe6a8'); g.fillStyle = gr; }
  else g.fillStyle = noir ? '#0a0a0c' : '#f4f1ea';
  g.fillRect(0, 0, W, H);
  const ink = noir ? '#e8c26a' : gold ? '#3a2606' : '#1e1b18', dim = noir ? 'rgba(232,194,106,0.6)' : gold ? 'rgba(58,38,6,0.6)' : 'rgba(30,27,24,0.55)';
  g.fillStyle = t.color; g.fillRect(0, 0, Math.round(H * 0.09), H);
  const x0 = Math.round(H * 0.2);
  g.fillStyle = ink; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.font = '700 ' + Math.round(H * 0.17) + 'px "Geist Mono", ui-monospace, monospace'; g.fillText('STUDIUM', x0, H * 0.3);
  g.font = '500 ' + Math.round(H * 0.11) + 'px "Geist Mono", ui-monospace, monospace'; g.fillStyle = dim; g.fillText('G R A D E D', x0, H * 0.44);
  g.fillStyle = t.color; g.font = '700 ' + Math.round(H * 0.12) + 'px "Geist Mono", ui-monospace, monospace'; g.fillText(t.name.toUpperCase(), x0, H * 0.66);
  g.fillStyle = ink; g.font = '400 ' + Math.round(H * 0.105) + 'px "Geist", system-ui, sans-serif'; g.fillText(slab.title || '', x0, H * 0.84);
  const xr = W - Math.round(H * 0.16); g.textAlign = 'right';
  g.fillStyle = ink; g.font = '400 ' + Math.round(H * 0.62) + 'px "Fraunces", Georgia, serif'; g.fillText(String(slab.grade), xr, H * 0.62);
  g.font = '600 ' + Math.round(H * 0.1) + 'px "Geist Mono", ui-monospace, monospace'; g.fillText(GRADES[slab.grade] || '', xr, H * 0.8);
  g.fillStyle = dim; g.font = '500 ' + Math.round(H * 0.09) + 'px "Geist Mono", ui-monospace, monospace';
  const serial = slab.serial ? slab.serial : slab.stamp ? 'No. ' + pad(slab.stamp, 2) + '/50' : '';
  g.fillText((serial ? serial + '   ' : '') + slab.cert, xr, H * 0.94);
  if (slab.variant) { g.textAlign = 'left'; g.fillStyle = dim; g.fillText((VARIANT[slab.variant] || {}).name || '', x0, H * 0.96); }
  return c;
}

/* ---------- the slab ---------- */
/* Sam's picks from the Slab Designs page: clear acrylic case (A), top strip label (L1), full bleed mount (M2: border 0).
   The Full art variant then runs the photo under the label as well, with the label floating over it. */
export const SLAB = { long: 2.4, border: 0, margin: 0.17, label: 0.6, th: 0.19 };
export function makeSlab(slab, S) {
  const group = new THREE.Group(); group.userData.slab = slab; const inner = new THREE.Group(); group.add(inner);
  const obj = { group, inner, slab, w: 0, h: 0, th: SLAB.th, photoW: 0, photoH: 0, finish: null, tilt: new THREE.Vector2(), pointer: new THREE.Vector2(), time: Math.random() * 100, base: null, parts: {}, built: false, ready: null, top: false };
  const env = envMap(S.renderer);
  obj.ready = photoCanvas(slab, S).then(base => { obj.base = base; build(obj, S, env); return obj; });
  obj.setFinish = id => { if (!obj.built) return; applyFinish(obj, S, env, id); };
  obj.refresh = () => { if (obj.built) applyFinish(obj, S, env, obj.finishId); };
  obj.update = (dt, pointer) => { obj.time += dt; if (pointer) obj.pointer.copy(pointer); if (obj.finish && obj.finish.def.update) try { obj.finish.def.update(obj.finish.mesh, { THREE, dt, time: obj.time, tilt: obj.tilt, pointer: obj.pointer, slab, obj }); } catch (e) { console.error(e); } };
  /* while inspected the slab draws over everything, like an inspected print */
  obj.setTop = on => { obj.top = on; group.traverse(m => { if (!m.isMesh) return; [].concat(m.material).forEach(mt => { if (mt.userData.t0 === undefined) mt.userData.t0 = mt.transparent; mt.depthTest = !on; mt.transparent = on || mt.userData.t0; }); m.renderOrder = on ? 20 + (m.userData.order || 0) : (m.userData.order || 0); }); };
  obj.dispose = () => { group.traverse(m => { if (m.isMesh) { m.geometry.dispose(); [].concat(m.material).forEach(mt => { if (mt.map && mt.map !== obj.parts.photoTex) mt.map.dispose(); mt.dispose(); }); } }); if (obj.parts.photoTex) obj.parts.photoTex.dispose(); if (group.parent) group.parent.remove(group); };
  return obj;
}
function build(obj, S, env) {
  const { slab, inner, base } = obj, aspect = base.width / base.height, full = slab.variant === 'full', clear = slab.variant === 'clear', neg = slab.variant === 'negative';
  const pw = aspect >= 1 ? SLAB.long : SLAB.long * aspect, ph = aspect >= 1 ? SLAB.long / aspect : SLAB.long;
  const cw = pw + SLAB.border * 2, ch = ph + SLAB.border * 2;
  obj.photoW = pw; obj.photoH = ph; obj.w = cw + SLAB.margin * 2; obj.h = ch + SLAB.label + SLAB.margin * 2 + 0.08;
  const th = SLAB.th, z0 = -th / 2 + 0.03;
  /* backing card */
  const gold = slab.tier === 'legendary', noir = slab.tier === 'mythic';
  if (!clear) { let m; if (gold) { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 256); gr.addColorStop(0, '#8a6020'); gr.addColorStop(0.4, '#f3d48a'); gr.addColorStop(0.6, '#b07c25'); gr.addColorStop(1, '#ffe6a8'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); m = new THREE.MeshLambertMaterial({ map: tex(c) }); }
    else m = new THREE.MeshLambertMaterial({ color: noir || neg ? 0x08080a : 0xf2eee6 });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(obj.w - 0.1, obj.h - 0.1), m); card.position.z = z0; card.userData.order = 1; inner.add(card); obj.parts.card = card; }
  /* the photograph */
  const cy = -(obj.h / 2) + SLAB.margin + ch / 2;
  const photoMat = new THREE.MeshBasicMaterial({ map: null, transparent: clear, opacity: clear ? 0.82 : 1 });
  /* full art: the photo fills the whole case, cropped to the slab's shape, and the label floats over it */
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(full ? obj.w - 0.1 : pw, full ? obj.h - 0.1 : ph), photoMat); photo.position.set(0, full ? 0 : cy, z0 + 0.012); photo.userData.order = 2; inner.add(photo); obj.parts.photo = photo;
  if (full) { const sw = (obj.w - 0.1) / pw, sh = (obj.h - 0.1) / ph, k = Math.max(sw, sh); const uv = photo.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * sw / k, 0.5 + (uv.getY(i) - 0.5) * sh / k); uv.needsUpdate = true; }
  if (slab.variant === 'misprint') { photo.position.x += 0.07; photo.position.y -= 0.04;
    const ghost = new THREE.Mesh(photo.geometry, new THREE.MeshBasicMaterial({ map: null, transparent: true, opacity: 0.32, depthWrite: false })); ghost.position.set(0.16, cy + 0.05, z0 + 0.016); ghost.userData.order = 3; inner.add(ghost); obj.parts.ghost = ghost;
    const band = new THREE.Mesh(new THREE.PlaneGeometry(cw * 1.1, 0.14), foilMaterial({ strength: 1.6 })); band.position.set(0, cy - ph * 0.28, z0 + 0.02); band.rotation.z = -0.06; band.userData.order = 4; inner.add(band); obj.parts.band = band; }
  if (neg) { /* sprocket holes down both long edges of the card */
    const sp = document.createElement('canvas'); sp.width = 512; sp.height = 64; const g = sp.getContext('2d'); g.fillStyle = '#08080a'; g.fillRect(0, 0, 512, 64); g.fillStyle = '#d8d2c4'; for (let x = 10; x < 512; x += 36) { g.beginPath(); g.roundRect(x, 20, 22, 24, 4); g.fill(); }
    const sm = new THREE.MeshBasicMaterial({ map: tex(sp) }); [1, -1].forEach(s => { const r = new THREE.Mesh(new THREE.PlaneGeometry(cw, 0.12), sm); r.position.set(0, cy + s * (ch / 2 - 0.07), z0 + 0.012); r.userData.order = 3; inner.add(r); }); }
  if (slab.variant === 'stamped') { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#e3ad57'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.fillStyle = '#3a2606'; g.font = '700 30px "Geist Mono", monospace'; g.textAlign = 'center'; g.fillText(pad(slab.stamp, 2), 64, 60); g.font = '500 18px "Geist Mono", monospace'; g.fillText('/ 50', 64, 88);
    const st = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })); st.position.set(pw / 2 - 0.2, cy - ph / 2 + 0.2, z0 + 0.02); st.userData.order = 4; inner.add(st); }
  /* the label */
  const lw = obj.w - SLAB.margin * 2, ly = obj.h / 2 - SLAB.margin - SLAB.label / 2;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(lw, SLAB.label), new THREE.MeshBasicMaterial({ map: tex(labelCanvas(slab, lw, SLAB.label)), transparent: full, opacity: full ? 0.92 : 1 })); label.position.set(0, ly, z0 + (full ? 0.03 : 0.012)); label.userData.order = full ? 5 : 2; inner.add(label); obj.parts.label = label;
  /* the acrylic */
  const acr = new THREE.Mesh(new RoundedBoxGeometry(obj.w, obj.h, th, 3, 0.05), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: clear ? 0.3 : 0.2, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMap: env, envMapIntensity: 1.1, depthWrite: false }));
  acr.userData.order = 6; acr.userData.noParticles = true; inner.add(acr); obj.parts.acrylic = acr;
  const edge = new THREE.Mesh(new RoundedBoxGeometry(obj.w, obj.h, th, 3, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false })); edge.userData.order = 5; edge.userData.noParticles = true; inner.add(edge);
  obj.built = true; applyFinish(obj, S, env, finishOf(slab, S.testFinish ? S.testFinish() : null));
}
function applyFinish(obj, S, env, id) {
  const { slab, inner, base } = obj; obj.finishId = id;
  const shown = processPhoto(base, id, slab.variant);
  if (obj.parts.photoTex) obj.parts.photoTex.dispose(); const t = tex(shown); obj.parts.photoTex = t;
  obj.parts.photo.material.map = t; obj.parts.photo.material.needsUpdate = true; if (obj.parts.ghost) { obj.parts.ghost.material.map = t; obj.parts.ghost.material.needsUpdate = true; }
  if (obj.finish) { if (obj.finish.mesh) { inner.remove(obj.finish.mesh); obj.finish.mesh.geometry.dispose(); [].concat(obj.finish.mesh.material).forEach(m => m.dispose()); } obj.finish = null; }
  const def = finishDef(id), full = slab.variant === 'full';
  const ctx = { THREE, slab, obj, w: full ? obj.w - 0.1 : obj.photoW, h: full ? obj.h - 0.1 : obj.photoH, photoTex: t, photoCanvas: shown, tier: TIER[slab.tier], renderer: S.renderer, envMap: env, finish: id };
  let mesh = null; try { mesh = def.make ? def.make(ctx) : null; } catch (e) { console.error(e); mesh = null; }
  if (mesh) { mesh.position.copy(obj.parts.photo.position); mesh.position.z += 0.01; mesh.userData.order = 4; if (full) { mesh.geometry.setAttribute('uv', obj.parts.photo.geometry.attributes.uv); } inner.add(mesh); }
  obj.finish = { id, def, mesh };
  if (obj.top) obj.setTop(true);
}
