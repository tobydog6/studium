// PRINT: the raw, ungraded print a pull comes out as. Same object shape as slabmesh.js's slab (docs/secret-round2.md),
// so the table, inspect, arm and particles treat the two alike. Sam's picks (docs/secret-ref/card-backs.html): a
// hairline 2 mm white border on bright white stock, straight cut corners, a glossy front; the back is blind embossed
// (the Studium roundel pressed into the paper, no ink, so it only shows in the light) with the tier colour as a solid
// bar along the foot. The finish shader comes from the same registry the slabs use, laid over the photo the same way.
// setGlow(amount) is the hover rim in the finish colour (S.holo.glowOf, read each frame so holo can change its mind).
// Built with the face along +z and the top up +y, like a slab: the caller lays it flat or turns it face down.
import * as THREE from 'three';

export const PRINT = { border: 0.03, th: 0.03 };
const Z_STOCK = 0.003, Z_PHOTO = 0.008, Z_OVER = 0.004, Z_FINISH = 0.01;

/* ---------- the photo as the print shows it (slabmesh keeps its processPhoto private, so the same treatments live here) ---------- */
const FILTERS = { gold: 'sepia(1) saturate(1.6) contrast(1.05) brightness(1.04)', prism: 'grayscale(1) contrast(1.45) brightness(0.82)', cyanotype: 'grayscale(1) sepia(1) hue-rotate(165deg) saturate(2.4) brightness(0.9)', chrome: 'grayscale(0.6) contrast(1.25)', steel: 'grayscale(1) contrast(1.1) brightness(0.9)' };
function processPhoto(base, finish, variant) {
  const f = [FILTERS[finish], variant === 'negative' ? 'invert(1) sepia(0.45) hue-rotate(-15deg) contrast(1.15)' : ''].filter(Boolean).join(' ');
  if (!f) return base;
  const c = document.createElement('canvas'); c.width = base.width; c.height = base.height; const g = c.getContext('2d');
  try { g.filter = f; } catch (e) {} g.drawImage(base, 0, 0); g.filter = 'none'; return c;
}

/* ---------- the finish registry, read through a slab: slabmesh keeps its registry private, so the first print with a
   given finish builds a throwaway slab for the same photo, keeps the def it resolved (the registered shader, or
   slabmesh's own stand-in for one holo.js has not built), and every print after that reuses it ---------- */
const DEFS = {};
function finishDefFor(id, slab, S) {
  if (DEFS[id]) return Promise.resolve(DEFS[id]);
  let probe = null; try { probe = S.SM.makeSlab(slab, S); } catch (e) { console.error(e); return Promise.resolve(null); }
  return probe.ready.then(() => { try { probe.setFinish(id); } catch (e) { console.error(e); } const def = probe.finish && probe.finish.def || null; try { probe.dispose(); } catch (e) {} if (def) DEFS[id] = def; return def; }).catch(e => { console.error(e); return null; });
}

/* ---------- the back: the roundel from Sam's card-backs page, embossed ---------- */
function arcText(g, text, cx, cy, r, font, color, centreAngle, flip) { g.save(); g.font = font; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; const ws = [...text].map(ch => g.measureText(ch).width); const total = ws.reduce((a, b) => a + b, 0) / r; let a = centreAngle - total / 2 * (flip ? -1 : 1);
  [...text].forEach((ch, i) => { const half = ws[i] / r / 2; a += half * (flip ? -1 : 1); g.save(); g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2)); g.fillText(ch, 0, 0); g.restore(); a += half * (flip ? -1 : 1); }); g.restore(); }
/* two rings, STUDIUM round the top, RAW PRINT round the bottom, a big Fraunces S in the middle */
function roundel(g, cx, cy, r, ink, lw) { g.save(); g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = lw || 5; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.lineWidth = (lw || 5) * 0.5; g.beginPath(); g.arc(cx, cy, r * 0.74, 0, 7); g.stroke();
  arcText(g, 'S T U D I U M', cx, cy, r * 0.87, '600 ' + Math.round(r * 0.17) + 'px "Geist", sans-serif', ink, -Math.PI / 2, false);
  arcText(g, 'R A W   P R I N T', cx, cy, r * 0.86, '600 ' + Math.round(r * 0.15) + 'px "Geist", sans-serif', ink, Math.PI / 2, true);
  g.font = '400 ' + Math.round(r * 1.05) + 'px "Fraunces", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S', cx, cy + r * 0.06); g.restore(); }
function grain(g, W, H, n, light, dark) { for (let i = 0; i < n; i++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * light) + ')'; g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); } for (let i = 0; i < n * 0.6; i++) { g.fillStyle = 'rgba(0,0,0,' + (Math.random() * dark) + ')'; g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); } }
/* a normal map from a height drawing at half size: the draw callback works in full canvas coordinates, lighter is raised */
function normalFrom(W, H, draw, strength) { const w = Math.round(W / 2), h = Math.round(H / 2), s = document.createElement('canvas'); s.width = w; s.height = h; const sg = s.getContext('2d'); sg.fillStyle = '#808080'; sg.fillRect(0, 0, w, h); sg.save(); sg.scale(w / W, h / H); draw(sg); sg.restore();
  const src = sg.getImageData(0, 0, w, h).data, out = sg.createImageData(w, h), d = out.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, l = src[(y * w + Math.max(0, x - 1)) * 4], r = src[(y * w + Math.min(w - 1, x + 1)) * 4], u = src[(Math.max(0, y - 1) * w + x) * 4], dn = src[(Math.min(h - 1, y + 1) * w + x) * 4];
    let nx = -(r - l) / 255 * strength, ny = (dn - u) / 255 * strength, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len; d[i * 4] = (nx * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; d[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255; }
  sg.putImageData(out, 0, 0); return s; }
/* the back's colour map and its emboss: bright white stock, the roundel with barely a tone of its own, the small
   embossed line above the tier bar, and the tier colour solid along the foot */
function backCanvases(w, h, tier) {
  const px = 1024 / Math.max(w, h), W = Math.round(w * px), H = Math.round(h * px), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const R = Math.min(W, H) * 0.29, cx = W / 2, cy = H / 2 - H * 0.03, bar = Math.round(H * 0.043), lineY = H - bar - H * 0.045, lineFont = '500 ' + Math.round(Math.min(W, H) * 0.024) + 'px "Geist Mono", ui-monospace, monospace';
  g.fillStyle = '#fbfbfa'; g.fillRect(0, 0, W, H); grain(g, W, H, 14000, 0.22, 0.05);
  roundel(g, cx, cy, R, 'rgba(0,0,0,0.045)', Math.max(3, R * 0.02));
  g.fillStyle = 'rgba(0,0,0,0.07)'; g.font = lineFont; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('S T U D I U M   ·   R A W   P R I N T', cx, lineY);
  g.fillStyle = tier.color; g.fillRect(0, H - bar, W, bar); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, H - bar, W, Math.max(2, bar * 0.07));
  const n = normalFrom(W, H, hg => { roundel(hg, cx, cy, R, '#b8b8b8', Math.max(8, R * 0.087)); hg.fillStyle = '#b0b0b0'; hg.font = lineFont; hg.textAlign = 'center'; hg.textBaseline = 'alphabetic'; hg.fillText('S T U D I U M   ·   R A W   P R I N T', cx, lineY); }, 2.2);
  return { map: c, normal: n };
}
/* the hover rim: a soft halo round the sheet's outline, clear under the sheet itself */
function haloCanvas(w, h, pad) {
  const px = 1024 / (w + pad * 2), W = 1024, H = Math.round((h + pad * 2) * px), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.clearRect(0, 0, W, H);
  const p = pad * px, sw = w * px, sh = h * px; g.save(); g.shadowColor = '#ffffff'; g.shadowBlur = p * 0.85; g.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) g.fillRect(p, p, sw, sh); g.restore();
  g.globalCompositeOperation = 'destination-out'; g.fillRect(p + 1, p + 1, sw - 2, sh - 2); return c;
}

/* ---------- the print ---------- */
export function makePrint(slab, S) {
  const SM = S.SM, SL = S.SL, group = new THREE.Group(); group.userData.slab = slab; const inner = new THREE.Group(); group.add(inner);
  const full = slab.variant === 'full', border = full ? 0 : PRINT.border;
  /* w and h are known for sure once the photo arrives; until then a 3:2 landscape sheet, the painted stand-in's shape */
  const obj = { group, inner, slab, w: SM.SLAB.lw * 1.5 + border * 2, h: SM.SLAB.lw + border * 2, th: PRINT.th, photoW: SM.SLAB.lw * 1.5, photoH: SM.SLAB.lw, land: true, finish: null, finishId: null, finishSeq: 0, tilt: new THREE.Vector2(), pointer: new THREE.Vector2(0.5, 0.5), time: Math.random() * 100, base: null, parts: {}, built: false, ready: null, top: false, glow: 0, disposed: false };
  const env = SM.envMap(S.renderer);
  obj.ready = SM.photoCanvas(slab, S).then(base => { if (obj.disposed) return obj; obj.base = base; return build(obj, S, env).then(() => obj); });
  obj.setFinish = id => { if (!obj.built) return; applyFinish(obj, S, env, id); };
  obj.refresh = () => { if (obj.built) applyFinish(obj, S, env, obj.finishId); };
  obj.setGlow = a => { obj.glow = Math.max(0, Math.min(1, +a || 0)); if (obj.parts.halo) obj.parts.halo.visible = obj.glow > 0; };
  obj.update = (dt, pointer) => { obj.time += dt; if (pointer) obj.pointer.copy(pointer);
    if (obj.parts.band) { const u = obj.parts.band.material.uniforms; u.uTilt.value.copy(obj.tilt); u.uTime.value = obj.time; }
    if (obj.finish && obj.finish.mesh && obj.finish.def.update) try { obj.finish.def.update(obj.finish.mesh, { THREE, dt, time: obj.time, tilt: obj.tilt, pointer: obj.pointer, slab, obj }); } catch (e) { console.error(e); }
    if (obj.glow > 0 && obj.parts.halo) animateGlow(obj, S); };
  /* while inspected the print draws over everything, like an inspected slab */
  obj.setTop = on => { obj.top = on; group.traverse(m => { if (!m.isMesh) return; [].concat(m.material).forEach(mt => { if (mt.userData.t0 === undefined) mt.userData.t0 = mt.transparent; mt.depthTest = !on; mt.transparent = on || mt.userData.t0; }); m.renderOrder = on ? 20 + (m.userData.order || 0) : (m.userData.order || 0); }); };
  obj.dispose = () => { obj.disposed = true; group.traverse(m => { if (m.isMesh) { m.geometry.dispose(); [].concat(m.material).forEach(mt => { ['map', 'emissiveMap', 'normalMap'].forEach(k => { if (mt[k] && mt[k] !== obj.parts.photoTex) mt[k].dispose(); }); mt.dispose(); }); } }); if (obj.parts.photoTex) obj.parts.photoTex.dispose(); if (group.parent) group.parent.remove(group); };
  return obj;
}
const GLOSS = { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1 };
function build(obj, S, env) {
  const { slab, inner, base } = obj, aspect = base.width / base.height, full = slab.variant === 'full', clear = slab.variant === 'clear', neg = slab.variant === 'negative';
  const land = aspect > 1.05, lw = S.SM.SLAB.lw, border = full ? 0 : PRINT.border, th = PRINT.th, tier = S.SL.tierOf(slab);
  const pw = land ? lw * aspect : lw, ph = land ? lw : lw / aspect;
  obj.photoW = pw; obj.photoH = ph; obj.land = land; obj.w = pw + border * 2; obj.h = ph + border * 2;
  /* the sheet: bright white stock with a white edge; a clear print is a film you can see through */
  const body = new THREE.Mesh(new THREE.BoxGeometry(obj.w, obj.h, th), new THREE.MeshStandardMaterial({ color: 0xfbfbfa, roughness: 0.85, envMap: env, envMapIntensity: 0.25, transparent: clear, opacity: clear ? 0.22 : 1, depthWrite: !clear }));
  body.userData.order = 1; body.userData.noParticles = true; inner.add(body); obj.parts.body = body;
  /* the front: the stock is glossy, so the border catches the light; the photo keeps its own brightness (an emissive map,
     the way slabs show theirs unlit) under a clearcoat that reflects the room */
  if (!full) { const stock = new THREE.Mesh(new THREE.PlaneGeometry(obj.w, obj.h), new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xfbfbfa, envMap: env, ...GLOSS, transparent: clear, opacity: clear ? 0.2 : 1, depthWrite: !clear })); stock.position.z = th / 2 + Z_STOCK; stock.userData.order = 2; inner.add(stock); obj.parts.stock = stock; }
  const photoMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: null, envMap: env, ...GLOSS, transparent: clear, opacity: clear ? 0.82 : 1 });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMat); photo.position.set(0, 0, th / 2 + Z_PHOTO); photo.userData.order = 3; inner.add(photo); obj.parts.photo = photo;
  const pz = photo.position.z;
  if (slab.variant === 'misprint') { photo.position.x += 0.07; photo.position.y -= 0.04;
    const ghost = new THREE.Mesh(photo.geometry, new THREE.MeshBasicMaterial({ map: null, transparent: true, opacity: 0.32, depthWrite: false })); ghost.position.set(0.16, 0.05, pz + Z_OVER); ghost.userData.order = 4; inner.add(ghost); obj.parts.ghost = ghost;
    const band = new THREE.Mesh(new THREE.PlaneGeometry(pw * 1.1, 0.14), S.SM.foilMaterial({ strength: 1.6 })); band.position.set(0, -ph * 0.28, pz + Z_OVER * 2); band.rotation.z = -0.06; band.userData.order = 5; inner.add(band); obj.parts.band = band; }
  if (neg) { /* sprocket holes down both long edges */
    const sp = document.createElement('canvas'); sp.width = 512; sp.height = 64; const g = sp.getContext('2d'); g.fillStyle = '#08080a'; g.fillRect(0, 0, 512, 64); g.fillStyle = '#d8d2c4'; for (let x = 10; x < 512; x += 36) { g.beginPath(); g.roundRect(x, 20, 22, 24, 4); g.fill(); }
    const sm = new THREE.MeshBasicMaterial({ map: S.SM.tex(sp) }); [1, -1].forEach(s => { const r = new THREE.Mesh(new THREE.PlaneGeometry(pw, 0.12), sm); r.position.set(photo.position.x, photo.position.y + s * (ph / 2 - 0.07), pz + Z_OVER / 2); r.userData.order = 4; inner.add(r); }); }
  if (slab.variant === 'stamped') { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#e3ad57'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.fillStyle = '#3a2606'; g.font = '700 30px "Geist Mono", monospace'; g.textAlign = 'center'; g.fillText(S.SL.pad(slab.stamp, 2), 64, 60); g.font = '500 18px "Geist Mono", monospace'; g.fillText('/ 50', 64, 88);
    const st = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), new THREE.MeshBasicMaterial({ map: S.SM.tex(c), transparent: true })); st.position.set(photo.position.x + pw / 2 - 0.2, photo.position.y - ph / 2 + 0.2, pz + Z_OVER * 2); st.userData.order = 5; inner.add(st); obj.parts.stamp = st; }
  /* the back: blind emboss, lit only, and the tier bar along the foot */
  const bc = backCanvases(obj.w, obj.h, tier), nmap = new THREE.CanvasTexture(bc.normal); nmap.anisotropy = 4;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(obj.w, obj.h), new THREE.MeshStandardMaterial({ map: S.SM.tex(bc.map), normalMap: nmap, normalScale: new THREE.Vector2(1, 1), roughness: 0.82, envMap: env, envMapIntensity: 0.3, transparent: clear, opacity: clear ? 0.35 : 1, depthWrite: !clear }));
  back.rotation.y = Math.PI; back.position.z = -th / 2 - Z_STOCK; back.userData.order = 2; inner.add(back); obj.parts.back = back;
  /* the hover rim: a halo plane through the middle of the sheet, so only the part past the edges shows */
  const pad = 0.5, halo = new THREE.Mesh(new THREE.PlaneGeometry(obj.w + pad * 2, obj.h + pad * 2), new THREE.MeshBasicMaterial({ map: S.SM.tex(haloCanvas(obj.w, obj.h, pad)), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  halo.userData.order = 0; halo.userData.noParticles = true; halo.visible = obj.glow > 0; inner.add(halo); obj.parts.halo = halo;
  obj.built = true;
  return applyFinish(obj, S, env, S.SL.finishOf(slab, S.testFinish ? S.testFinish() : null));
}
function applyFinish(obj, S, env, id) {
  const { slab, inner, base } = obj; obj.finishId = id;
  const shown = processPhoto(base, id, slab.variant);
  if (obj.parts.photoTex) obj.parts.photoTex.dispose(); const t = S.SM.tex(shown); obj.parts.photoTex = t;
  obj.parts.photo.material.emissiveMap = t; obj.parts.photo.material.needsUpdate = true; if (obj.parts.ghost) { obj.parts.ghost.material.map = t; obj.parts.ghost.material.needsUpdate = true; }
  if (obj.finish) { if (obj.finish.mesh) { inner.remove(obj.finish.mesh); obj.finish.mesh.geometry.dispose(); [].concat(obj.finish.mesh.material).forEach(m => m.dispose()); } obj.finish = null; }
  const seq = ++obj.finishSeq;
  return finishDefFor(id, slab, S).then(def => {
    if (seq !== obj.finishSeq || obj.disposed || !def) return;
    const ctx = { THREE, slab, obj, w: obj.photoW, h: obj.photoH, photoTex: t, photoCanvas: shown, tier: S.SL.tierOf(slab), renderer: S.renderer, envMap: env, finish: id };
    let mesh = null; try { mesh = def.make ? def.make(ctx) : null; } catch (e) { console.error(e); mesh = null; }
    if (mesh) { mesh.position.copy(obj.parts.photo.position); mesh.position.z += Z_FINISH; mesh.userData.order = 6; inner.add(mesh); }
    obj.finish = { id, def, mesh };
    if (obj.top) obj.setTop(true);
  });
}
/* the rim in the finish colour: a cycle drifts through the hues, sparkle flickers, pulse breathes, cold and hot sit still */
const gC = new THREE.Color(), gC2 = new THREE.Color();
function animateGlow(obj, S) {
  const halo = obj.parts.halo, m = halo.material, t = obj.time; let g = null; try { g = S.holo && S.holo.glowOf ? S.holo.glowOf(obj.slab) : null; } catch (e) { g = null; }
  gC.set(g && g.color ? g.color : 0xffffff); gC2.set(g && g.color2 ? g.color2 : gC); const kind = g && g.kind || 'steady';
  let k = 1, s = 1;
  if (kind === 'cycle') { gC.lerp(gC2, 0.5 + 0.5 * Math.sin(t * 0.9)); gC.offsetHSL(0.1 * Math.sin(t * 0.55), 0, 0); k = 0.85 + 0.15 * Math.sin(t * 1.7); }
  else if (kind === 'sparkle') { const n = Math.sin(Math.floor(t * 18) * 12.9898) * 43758.5453, f = n - Math.floor(n); k = 0.55 + 0.45 * f; gC.lerp(gC2, f > 0.7 ? 1 : 0); }
  else if (kind === 'pulse') { const p = 0.5 + 0.5 * Math.sin(t * 2.4); k = 0.45 + 0.55 * p; s = 1 + 0.05 * p; }
  else if (kind === 'cold' || kind === 'hot') { k = 0.9 + 0.1 * Math.sin(t * 1.2); }
  else { k = 0.9 + 0.1 * Math.sin(t * 1.5); gC.lerp(gC2, 0.5 + 0.5 * Math.sin(t * 0.7)); }
  m.color.copy(gC); m.opacity = obj.glow * k * 0.95; halo.scale.set(s, s, 1);
}
export function install(S) { S.print = { make: slab => makePrint(slab, S) }; }
