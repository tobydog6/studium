// BLADE PARTS: real Beyblade X forms, built as sculpted geometry rather than flat extrusions (Sam's reference photos).
// Every part is swept or turned, so its surfaces curve and slope the way moulded plastic and die-cast metal do:
//   crescent(o)   a metal blade swept round the rim: thick and hooked at its leading end, tapering to a thin tail,
//                 its top sloping down to a rounded edge (a cross-section carried along an arc, smooth normals)
//   frame(o)      the metal ring the crescents grow from, with bolts
//   body(o)       the moulded plastic body: a disc whose outline and fins sweep with the spin, top sloping outwards
//   hub(o)        the lock ring round the emblem, with tabs
//   sticker(...)  the emblem: the photo cropped round, a black border and a white keyline, like a printed sticker
//   ratchet(o)    the toothed ring under the blade, teeth sloped like the real ones
//   bit(type)     a turned tip (sharp, flat, ball) and its gear
// All sizes are in blade radii (the contact points sit at 1). y is up; the spin group turns about y.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const smooth = t => t * t * (3 - 2 * t);

/* a closed cross-section carried along an arc: sec(t) gives [[r, y], ...] (counter-clockwise in r-y), a(t) its angle */
/* crisp: every edge of the section gets its own strip of vertices, so normals stay smooth along the sweep but break sharply
   across the section's corners (the chamfers of die-cast metal), instead of the whole thing shading like a pillow */
function sweep(n, sec, angle) {
  const s0 = sec(0), m = s0.length, pos = [], idx = [], rows = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = angle(t), c = Math.cos(a), s = Math.sin(a); rows.push(sec(t).map(([r, y]) => [c * r, y, -s * r])); }
  for (let j = 0; j < m; j++) { const base = pos.length / 3; for (let i = 0; i <= n; i++) { const p = rows[i][j], q = rows[i][(j + 1) % m]; pos.push(p[0], p[1], p[2], q[0], q[1], q[2]); }
    for (let i = 0; i < n; i++) { const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); } }
  const capBase = pos.length / 3; rows.forEach(r => r.forEach(p => pos.push(p[0], p[1], p[2])));
  /* end caps: a fan from the section's centre */
  [0, n].forEach((i, k) => { const base = pos.length / 3, sec0 = sec(i / n), a = angle(i / n); let cr = 0, cy = 0; sec0.forEach(([r, y]) => { cr += r / m; cy += y / m; });
    pos.push(Math.cos(a) * cr, cy, -Math.sin(a) * cr); for (let j = 0; j < m; j++) { const p = capBase + i * m + j, q = capBase + i * m + (j + 1) % m; if (k) idx.push(base, p, q); else idx.push(base, q, p); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* a rounded wedge in r-y: inner wall, a top sloping down outwards, a rounded outer lip */
function wedge(rIn, rOut, hIn, hOut, round) {
  const c = Math.min(round, hOut * 0.45);
  return [[rIn, 0], [rOut - c, 0], [rOut, c], [rOut, hOut - c], [rOut - c * 1.6, hOut], [rIn + (rOut - rIn) * 0.42, hIn * 0.9 + hOut * 0.1], [rIn + 0.014, hIn], [rIn, hIn - 0.014]];
}

/* a metal crescent: a0 at its tail, a1 at its hooked leading end (dir sets which way round), reach is how far it stands out */
export function crescent({ a0, span, dir = 1, rIn = 0.66, reach = 1, thick = 0.075, hook = 0.25 }) {
  const n = 40;
  return sweep(n, t => {
    const grow = smooth(Math.min(1, t / 0.82)), tipT = Math.max(0, (t - 0.82) / 0.18);
    const rOut = rIn + 0.06 + (reach - rIn - 0.06) * grow * (1 - 0.35 * tipT * tipT) + hook * 0.06 * Math.sin(tipT * Math.PI);
    const hIn = 0.03 + thick * (0.35 + 0.65 * grow) * (1 - 0.6 * tipT), hOut = 0.016 + thick * 0.35 * grow * (1 - 0.7 * tipT);
    return wedge(rIn, Math.max(rIn + 0.05, rOut), hIn, hOut, Math.min(0.02, (rOut - rIn) * 0.3));
  }, t => a0 + dir * t * span);
}

/* the metal ring the crescents grow from */
export function frameRing(rIn = 0.6, rOut = 0.72, h = 0.045) {
  const prof = [[rIn, 0], [rOut - 0.01, 0], [rOut, 0.01], [rOut, h * 0.6], [rOut - 0.02, h], [rIn + 0.015, h], [rIn, h - 0.01]].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(prof, 96);
}
/* a hex bolt head */
export function bolt(r = 0.032) { const g = new THREE.CylinderGeometry(r, r * 1.08, r * 0.7, 6); g.translate(0, r * 0.35, 0); return g; }
/* a cut gem for the top tiers */
export function gem(r = 0.05) { const g = new THREE.OctahedronGeometry(r, 0); g.scale(1, 0.55, 1.6); return g; }

/* the plastic body: a polar mesh whose outline R(a) sweeps out in fins, top falling from hIn at the hub to hOut at the edge,
   with a raised ridge running along each fin. UVs are a top-down projection (the photo prints across it). */
export function body({ rIn = 0.3, fins = 6, dir = 1, reach = 0.9, base = 0.6, sweepK = 1.8, hIn = 0.075, hOut = 0.03, polar = () => 0 }) {
  const NA = fins * 24, NR = 12, pos = [], uv = [], idx = [];
  const R = a => { const u = (((dir * a * fins / TAU) % 1) + 1) % 1, f = Math.pow(1 - u, sweepK); return base + (reach - base) * f + 0.03 * polar(a); };
  const H = (a, k) => { const u = (((dir * a * fins / TAU) % 1) + 1) % 1, ridge = Math.exp(-Math.pow((u - 0.25 * (1 - k)) * 9, 2)) * 0.022; return hIn + (hOut - hIn) * k + ridge * (0.3 + k); };
  const put = (x, y, z) => { pos.push(x, y, z); uv.push(x * 0.5 / reach + 0.5, -z * 0.5 / reach + 0.5); return pos.length / 3 - 1; };
  /* top grid, then the outer wall down to 0, the inner wall, and the bottom */
  const top = [], botO = [], botI = [], topI = [];
  for (let i = 0; i <= NA; i++) { const a = i / NA * TAU, c = Math.cos(a), s = Math.sin(a), ro = R(a), row = [];
    for (let j = 0; j <= NR; j++) { const k = j / NR, r = rIn + (ro - rIn) * k; row.push(put(c * r, H(a, k), -s * r)); } top.push(row);
    botO.push(put(c * ro, 0, -s * ro)); botI.push(put(c * rIn, 0, -s * rIn)); }
  for (let i = 0; i < NA; i++) { for (let j = 0; j < NR; j++) { const a = top[i][j], b = top[i + 1][j], c = top[i][j + 1], d = top[i + 1][j + 1]; idx.push(a, c, b, b, c, d); }
    const o0 = top[i][NR], o1 = top[i + 1][NR]; idx.push(o0, botO[i], o1, o1, botO[i], botO[i + 1]);
    const i0 = top[i][0], i1 = top[i + 1][0]; idx.push(i0, i1, botI[i], i1, botI[i + 1], botI[i]);
    idx.push(botO[i], botI[i], botO[i + 1], botO[i + 1], botI[i], botI[i + 1]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* the lock ring round the emblem: a turned profile with a raised lip; tabs are added by the caller */
export function hub(rIn = 0.27, rOut = 0.4, h = 0.06) {
  const prof = [[rIn, 0], [rOut, 0], [rOut, h * 0.55], [rOut - 0.025, h], [rIn + 0.04, h], [rIn + 0.02, h * 0.82], [rIn, h * 0.82]].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(prof, 72);
}
export function tab(w = 0.09, d = 0.07, h = 0.045) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; }

/* the emblem sticker: the photo cropped round, a black border, a white keyline and a small mark, drawn once */
export function stickerCanvas(photo, accent) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#0c0c0e'; g.beginPath(); g.arc(256, 256, 256, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(256, 256, 206, 0, TAU); g.clip();
  if (photo) { const s = Math.max(412 / photo.width, 412 / photo.height); try { g.filter = 'contrast(1.45) saturate(1.7) brightness(0.92)'; } catch (e) {} g.drawImage(photo, 256 - photo.width * s / 2, 256 - photo.height * s / 2, photo.width * s, photo.height * s); g.filter = 'none'; }
  /* a bit of punch, like printed art: deeper contrast and a vignette */
  const v = g.createRadialGradient(256, 256, 120, 256, 256, 210); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = v; g.fillRect(0, 0, 512, 512); g.restore();
  g.lineWidth = 7; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(256, 256, 210, 0, TAU); g.stroke();
  g.lineWidth = 10; g.strokeStyle = accent; g.beginPath(); g.arc(256, 256, 236, -0.5, 0.9); g.stroke(); g.beginPath(); g.arc(256, 256, 236, Math.PI - 0.5, Math.PI + 0.9); g.stroke();
  g.fillStyle = '#ffffff'; g.font = '700 26px sans-serif'; g.save(); g.translate(256, 256); for (let k = 0; k < 7; k++) { g.save(); g.rotate(-1.15 + k * 0.11 + Math.PI); g.fillText('STUDIUM'[k], -8, 236); g.restore(); } g.restore();
  for (let k = 0; k < 24; k++) { const a = 1.25 + k * 0.035; g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(256 + Math.cos(a) * 228 - 1, 256 + Math.sin(a) * 228 - 6, 2, k % 4 ? 8 : 14); }
  return c;
}

/* the ratchet: a toothed ring, each tooth sloping up to a step, sides tapered in */
export function ratchet({ teeth = 6, rIn = 0.3, rOut = 0.68, h = 0.12, dir = 1 }) {
  const NA = teeth * 20, pos = [], idx = [];
  const R = a => { const u = (((dir * a * teeth / TAU) % 1) + 1) % 1; return rOut - 0.07 * (1 - u) * (u < 0.92 ? 1 : (1 - u) / 0.08); };
  const ring = (r, y) => { const out = []; for (let i = 0; i <= NA; i++) { const a = i / NA * TAU, rr = typeof r === 'function' ? r(a) : r; out.push(pos.length / 3); pos.push(Math.cos(a) * rr, y, -Math.sin(a) * rr); } return out; };
  const outB = ring(a => R(a) - 0.03, 0), outT = ring(R, h * 0.85), topO = ring(a => R(a) - 0.03, h), topI = ring(rIn + 0.03, h), inT = ring(rIn, h * 0.85), inB = ring(rIn, 0);
  const strip = (A, B) => { for (let i = 0; i < NA; i++) idx.push(A[i], B[i], A[i + 1], A[i + 1], B[i], B[i + 1]); };
  strip(outB, outT); strip(outT, topO); strip(topO, topI); strip(topI, inT); strip(inT, inB); strip(inB, outB);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  /* a band of UV round the outside so the photo can print round it */
  const uv = new Float32Array(pos.length / 3 * 2); for (let i = 0; i < pos.length / 3; i++) { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; uv[i * 2] = (Math.atan2(-z, x) / TAU + 1) % 1; uv[i * 2 + 1] = y / h; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/* the bit: turned profiles; 'flat' a wide rubbery foot, 'ball' a round end, 'sharp' a point */
export function bit(type, len = 0.26) {
  const p = type === 'sharp' ? [[0.001, 0], [0.03, 0.012], [0.1, len * 0.55], [0.15, len * 0.85], [0.17, len]] :
    type === 'flat' ? [[0.001, 0], [0.12, 0], [0.145, 0.015], [0.15, len * 0.35], [0.13, len * 0.6], [0.165, len]] :
    [[0.001, 0], [0.07, 0.01], [0.12, 0.05], [0.14, 0.11], [0.135, len * 0.7], [0.165, len]];
  p.push([0.001, len]); return new THREE.LatheGeometry(p.map(([r, y]) => new THREE.Vector2(r, y)), 48);
}
export function gear(n = 14, rIn = 0.18, rRoot = 0.25, rTip = 0.285, h = 0.045) {
  const s = new THREE.Shape(); for (let k = 0; k < n * 4; k++) { const a = k / (n * 4) * TAU, r = (k % 4 === 1 || k % 4 === 2) ? rTip : rRoot; if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(r, 0); }
  const hole = new THREE.Path(); hole.absarc(0, 0, rIn, 0, TAU, true); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 1 }).rotateX(-Math.PI / 2);
}

/* ======== more families, so no two blades look alike (Sam: every real one is its own) ======== */
/* a heavy sculpted metal ring all the way round, with bosses (bolt mounts) standing proud and notches cut between */
export function metalRing({ bosses = 5, rIn = 0.7, reach = 1, thick = 0.07, notch = 0.4 }) {
  const n = 240;
  return sweep(n, t => { const a = t * TAU, u = ((a * bosses / TAU) % 1 + 1) % 1, boss = Math.exp(-Math.pow((u - 0.5) * 7, 2)), cut = notch * Math.exp(-Math.pow((u - 0.02) * 22, 2)) + notch * Math.exp(-Math.pow((u - 0.98) * 22, 2));
    const rOut = reach - 0.06 + 0.06 * boss - 0.07 * cut, h = thick * (0.75 + 0.35 * boss - 0.4 * cut);
    return wedge(rIn - 0.02 * boss, rOut, h, h * 0.55, 0.02); }, t => t * TAU);
}
/* a long thin swirl blade that spirals outwards over most of a half turn */
export function swirl({ a0, span = 2.4, dir = 1, rIn0 = 0.5, rIn1 = 0.82, reach0 = 0.68, reach1 = 1.0, thick = 0.05 }) {
  return sweep(60, t => { const e = smooth(t), rIn = rIn0 + (rIn1 - rIn0) * e, tip = Math.max(0, (t - 0.85) / 0.15), rOut = reach0 + (reach1 - reach0) * e - 0.06 * tip * tip;
    return wedge(rIn, Math.max(rIn + 0.04, rOut), thick * (0.6 + 0.6 * e) * (1 - 0.5 * tip), thick * 0.35, 0.015); }, t => a0 + dir * t * span);
}
/* a flat moulded plate from an outline (with holes), bevelled, sloping top faked by a second slightly smaller step */
export function plate(shape, depth = 0.05, bevel = 0.015) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 24 }).rotateX(-Math.PI / 2);
}
/* a spoked wheel body: a disc with round windows between spokes */
export function wheelShape(rIn, rOut, spokes, hole) {
  const s = new THREE.Shape(); s.absarc(0, 0, rOut, 0, TAU, false); const h0 = new THREE.Path(); h0.absarc(0, 0, rIn, 0, TAU, true); s.holes.push(h0);
  for (let k = 0; k < spokes; k++) { const a = (k + 0.5) / spokes * TAU, r = (rIn + rOut) / 2, p = new THREE.Path(); p.absarc(Math.cos(a) * r, Math.sin(a) * r, Math.min(hole, (rOut - rIn) * 0.42), 0, TAU, true); s.holes.push(p); }
  return s;
}
/* petals: a ring of rounded lobes */
export function petalShape(rIn, rOut, n, rot = 0, lobe = 0.6) {
  const s = new THREE.Shape(), N = n * 24;
  for (let i = 0; i <= N; i++) { const a = i / N * TAU + rot, u = (a * n / TAU) % 1, r = rIn + 0.05 + (rOut - rIn - 0.05) * Math.pow(Math.max(0, Math.sin(u * Math.PI)), lobe); if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const h = new THREE.Path(); h.absarc(0, 0, rIn, 0, TAU, true); s.holes.push(h); return s;
}
/* lock rings: three-lobed, hex and gear-toothed */
export function lobeRingShape(rIn, rOut, lobes = 3) {
  const s = new THREE.Shape(), N = 180;
  for (let i = 0; i <= N; i++) { const a = i / N * TAU, r = rOut - (rOut - rIn - 0.06) * 0.55 * (1 - Math.pow(Math.cos(a * lobes / 2), 2)); if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(r, 0); }
  const h = new THREE.Path(); h.absarc(0, 0, rIn, 0, TAU, true); s.holes.push(h); return s;
}
export function polyRingShape(rIn, rOut, sides = 6, rot = 0) {
  const s = new THREE.Shape(); for (let k = 0; k <= sides; k++) { const a = k / sides * TAU + rot; if (k) s.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut); else s.moveTo(Math.cos(a) * rOut, Math.sin(a) * rOut); }
  const h = new THREE.Path(); h.absarc(0, 0, rIn, 0, TAU, true); s.holes.push(h); return s;
}
export function gearRingShape(rIn, rOut, teeth = 16) {
  const s = new THREE.Shape(); for (let k = 0; k <= teeth * 4; k++) { const a = k / (teeth * 4) * TAU, r = (k % 4 === 1 || k % 4 === 2) ? rOut : rOut - 0.035; if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(r, 0); }
  const h = new THREE.Path(); h.absarc(0, 0, rIn, 0, TAU, true); s.holes.push(h); return s;
}

/* printed graphics for the plastic: the photo with a pattern laid over it in the accent colour */
export function printCanvas(photo, style, accent, rng) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  if (photo) { const s = Math.max(512 / photo.width, 512 / photo.height); try { g.filter = 'saturate(1.5) contrast(1.2)'; } catch (e) {} g.drawImage(photo, 256 - photo.width * s / 2, 256 - photo.height * s / 2, photo.width * s, photo.height * s); g.filter = 'none'; }
  else { g.fillStyle = '#888'; g.fillRect(0, 0, 512, 512); }
  g.save(); g.translate(256, 256); g.globalAlpha = 0.85; g.fillStyle = accent; g.strokeStyle = accent;
  if (style === 'stripes') { g.rotate(rng() * Math.PI); for (let x = -400; x < 400; x += 46) g.fillRect(x, -400, 14 + rng() * 10, 800); }
  else if (style === 'flames') { for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; g.save(); g.rotate(a); g.beginPath(); g.moveTo(90, -20); g.quadraticCurveTo(170, -40, 250, -90 - rng() * 40); g.quadraticCurveTo(190, -10, 240, 20); g.quadraticCurveTo(160, 10, 90, 20); g.closePath(); g.fill(); g.restore(); } }
  else if (style === 'dots') { for (let y = -256; y < 256; y += 18) for (let x = -256; x < 256; x += 18) { const r = 7 * (0.3 + 0.7 * ((x + y + 512) / 1024)); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } }
  else if (style === 'speed') { g.lineWidth = 6; for (let k = 0; k < 40; k++) { const a = rng() * TAU, r0 = 80 + rng() * 80; g.beginPath(); g.arc(0, 0, r0 + rng() * 120, a, a + 0.3 + rng() * 0.6); g.stroke(); } }
  else if (style === 'burst') { for (let k = 0; k < 24; k++) { g.save(); g.rotate(k / 24 * TAU); g.beginPath(); g.moveTo(60, -8); g.lineTo(256, 0); g.lineTo(60, 8); g.fill(); g.restore(); } }
  g.restore(); return c;
}
/* a hexagonal sticker variant (the photo clipped to a hex) */
export function hexSticker(photo, accent) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), hex = (r) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; g[k ? 'lineTo' : 'moveTo'](256 + Math.cos(a) * r, 256 + Math.sin(a) * r); } g.closePath(); };
  g.fillStyle = '#121216'; g.fillRect(0, 0, 512, 512); g.save(); hex(200); g.clip();
  if (photo) { const s = Math.max(420 / photo.width, 420 / photo.height); try { g.filter = 'contrast(1.45) saturate(1.7) brightness(0.92)'; } catch (e) {} g.drawImage(photo, 256 - photo.width * s / 2, 256 - photo.height * s / 2, photo.width * s, photo.height * s); g.filter = 'none'; }
  g.restore(); g.lineWidth = 8; g.strokeStyle = '#fff'; hex(204); g.stroke(); g.lineWidth = 14; g.strokeStyle = accent; hex(228); g.stroke(); return c;
}
