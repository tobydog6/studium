// FXSIDES: the edge and back extras (slabs.js EXTRAS, slots 'edge' and 'back'; Sam's picks in docs/slab-extras.md).
// Edges belong to the acrylic case, so only graded slabs have them: light living in the edges, edges that split the
// light into a rainbow on the table, gilded edges like an old book. Backs are printed on the card, so raw prints have
// them too: the photo's depth drawn as contour lines, every owner etched in, or a whole other photograph. (The hidden
// message is ink on the front that only the UV torch shows: fxtools.js uvInk.)
//   sidesFx(obj, S, kind) → { ids, update(dt), hold(), held(), reveal(o), dispose() } | null     kind 'slab' | 'print'
//   joinRigs([rigs]) → one rig over several (slabmesh.js joins the case and the sides as obj.caseFx)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { extrasOf, EXTRA } from './slabs.js';
import { studioEnvs } from './fxkit.js';
import { depthFor } from './depth.js';
import { depthKey } from './fxfinishes.js';

const NO_RAY = () => {};
const rngOf = s => () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const snd = (S, id, o) => { try { if (S.snd) S.snd.play(id, o); } catch (e) {} };
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const srgb = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

export function joinRigs(list) { const L = list.filter(Boolean); if (!L.length) return null;
  return { ids: L.flatMap(r => r.ids || [r.id]), get id() { return this.ids[0]; },
    update(dt) { L.forEach(r => r.update && r.update(dt)); }, hold() { L.forEach(r => r.hold && r.hold()); }, held: () => L.some(r => r.held && r.held()),
    reveal(o = {}) { const was = L.some(r => r.held && r.held()); L.forEach(r => r.reveal && r.reveal({ ...o, toast: false }));
      if (was && !o.quiet && o.toast !== false && L[0].S && L[0].S.toast) { const x = extrasOf(L[0].slab), n = this.ids.filter(i => EXTRA[i] && EXTRA[i].slot !== 'back').map(i => EXTRA[i].name + (i === 'liquid' && x.fish ? ' with a goldfish' : '')); if (n.length) L[0].S.toast('With ' + n.join(' and ') + '.'); } },
    dispose() { L.forEach(r => r.dispose && r.dispose()); } }; }

export function sidesFx(obj, S, kind) {
  const slab = obj.slab, x = extrasOf(slab), edge = kind === 'slab' && slab.graded ? x.edge : null, back = x.back;
  if (!EXTRA[edge] && !EXTRA[back]) return null;
  const group = new THREE.Group(); group.userData.noParticles = true; obj.inner.add(group);
  const ctx = { S, obj, slab, x, r: rngOf(((slab.seed >>> 0) ^ 0x51de5) >>> 0), group, k: 1, t: 0, gone: false, disp: [] };
  const fx = EXTRA[edge] && EDGES[edge] ? EDGES[edge](ctx) : null;
  if (EXTRA[back] && BACKS[back]) { try { BACKS[back]({ ...ctx, r: rngOf(((slab.seed >>> 0) ^ 0xb4c4) >>> 0), get gone() { return ctx.gone; } }); }   /* its own stream: the same back raw or graded */ catch (e) { console.error('back extra', e); } }
  let hold = !!obj.holdCase && !!fx, intro = hold ? -1 : 1; group.visible = !hold;
  return { ids: [edge, back].filter(i => EXTRA[i]), slab, S,
    update(dt) { if (!(dt > 0) || !fx) return; ctx.t += dt; if (intro >= 0 && intro < 1) { intro = Math.min(1, intro + dt / 1.3); ctx.k = intro; if (fx.intro) fx.intro(intro); } if (fx.update) fx.update(Math.min(dt, 0.05), ctx); },
    hold() { if (!fx) return; hold = true; group.visible = false; intro = -1; }, held: () => hold,
    reveal(o = {}) { if (!hold) return; hold = false; group.visible = true; if (o.quiet) { intro = 1; ctx.k = 1; if (fx.intro) fx.intro(1); return; } intro = 0; ctx.k = 0; if (fx.intro) fx.intro(0); snd(S, 'shimmer', { k: 0.4 }); },
    dispose() { ctx.gone = true; if (group.parent) group.parent.remove(group); ctx.disp.forEach(f => { try { f(); } catch (e) {} }); group.traverse(m => { if (m.geometry) m.geometry.dispose(); [].concat(m.material || []).forEach(mt => { ['map', 'roughnessMap', 'metalnessMap'].forEach(k => { if (mt[k]) mt[k].dispose(); }); mt.dispose(); }); }); } };
}

/* ---------------------------------------------------------------- edges */
/* light in the case's edges: strongest on the sides, a thin line round the front, so the slab reads as edge-lit acrylic */
const EDGE_V = 'varying vec3 vN; varying vec3 vP; void main(){ vN = normal; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const EDGE_F = `uniform vec3 uCol; uniform float uK; uniform float uT; uniform float uRain; uniform vec2 uHalf; uniform vec2 uTilt; varying vec3 vN; varying vec3 vP;
  vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
  void main(){ float side = 1.0 - abs(normalize(vN).z), ed = min(uHalf.x - abs(vP.x), uHalf.y - abs(vP.y)), rim = vN.z > 0.5 ? smoothstep(0.03, 0.0, ed) : 0.0;
    vec3 c = mix(uCol, hue(fract((vP.x + vP.y) * 0.35 + dot(uTilt, vec2(1.6, 1.1)) + uT * 0.03)) * 1.2, uRain);
    float pulse = mix(0.78 + 0.22 * sin(uT * 1.4 + (vP.x - vP.y) * 0.8), 0.7 + 0.3 * pow(abs(sin((vP.x + vP.y) * 2.0 + uTilt.x * 6.0)), 4.0), uRain);
    gl_FragColor = vec4(c * (side * 0.85 + rim * 0.7) * pulse * uK, 1.0);
    #include <colorspace_fragment>
  }`;
function edgeShell(c, col, rain) { const { obj } = c, u = { uCol: { value: new THREE.Color(col) }, uK: { value: 1 }, uT: { value: 0 }, uRain: { value: rain ? 1 : 0 }, uHalf: { value: new THREE.Vector2(obj.w / 2 + 0.005, obj.h / 2 + 0.005) }, uTilt: { value: obj.tilt } };
  const m = new THREE.Mesh(new RoundedBoxGeometry(obj.w + 0.01, obj.h + 0.01, obj.th + 0.006, 4, 0.052), new THREE.ShaderMaterial({ uniforms: u, vertexShader: EDGE_V, fragmentShader: EDGE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.userData.order = 9; m.userData.noParticles = true; m.raycast = NO_RAY; c.group.add(m); return u; }
const EDGES = {
  glowedge(c) { /* the finish's glow colour; a pale one (matte, chrome) takes the tier's colour so it still reads as light */
    let g = c.S.holo && c.S.holo.glowOf ? c.S.holo.glowOf(c.obj).color.clone() : new THREE.Color(0xffd08a); const hsl = g.getHSL({}); if (hsl.s < 0.45) g = new THREE.Color((c.S.SL.tierOf(c.slab) || {}).color || '#e3ad57');
    const u = edgeShell(c, g.multiplyScalar(1.7), false);
    return { intro(k) { u.uK.value = k * k * (3 - 2 * k); }, update(dt) { u.uT.value += dt; } }; },
  /* the edges split the light: a rainbow on them, and streaks of spectrum thrown on the table beside the slab (gone while it's in the hand) */
  prismedge(c) { const { obj } = c, u = edgeShell(c, 0xffffff, true); u.uK.value = 0.6;
    const pad = 0.75, U = { uHalf: { value: new THREE.Vector2(obj.w / 2, obj.h / 2) }, uSize: { value: new THREE.Vector2(obj.w + pad * 2, obj.h + pad * 2) }, uK: { value: 1 }, uL: { value: new THREE.Vector2(0.62, -0.78) }, uSeed: { value: c.r() * 10 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(obj.w + pad * 2, obj.h + pad * 2), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec2 uHalf; uniform vec2 uSize; uniform float uK; uniform vec2 uL; uniform float uSeed; varying vec2 vUv;
        vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main(){ vec2 p = (vUv - 0.5) * uSize; vec2 q = abs(p) - uHalf + 0.05; float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.05; if (d < 0.0) discard;
          vec2 n = normalize(sign(p) * max(q, 0.0) + 1e-4); float face = smoothstep(0.15, 0.7, dot(n, uL)), w = 0.42, t = d / w;
          float streak = 0.55 + 0.45 * sin((p.x * uL.y - p.y * uL.x) * 9.0 + uSeed);
          vec3 c = hue(clamp(t, 0.0, 1.0) * 0.8) * smoothstep(0.0, 0.05, d) * pow(max(0.0, 1.0 - t), 1.6) * face * streak * 0.45 * uK; gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }` }));
    m.position.z = -obj.th / 2 + 0.003; m.userData.order = 0;   /* just above the table, under the card's outline (the middle is discarded) */ m.userData.noParticles = true; m.raycast = NO_RAY; c.group.add(m);
    let top = 0; return { intro(k) { u.uK.value = 0.6 * k; }, update(dt, c) { u.uT.value += dt; top += ((obj.top ? 1 : 0) - top) * Math.min(1, dt * 6); U.uK.value = c.k * (1 - top); m.visible = top < 0.99; } }; },
  /* gilded edges: a thin gold frame round the case, the leaf a little cracked and uneven */
  goldleaf(c) { const { obj, r } = c, env = studioEnvs(c.S.renderer).bright, ow = obj.w / 2 + 0.006, oh = obj.h / 2 + 0.006, lip = 0.032, R = 0.055;
    const rr = (sh, w, h, rad) => { sh.moveTo(-w + rad, -h); sh.lineTo(w - rad, -h); sh.quadraticCurveTo(w, -h, w, -h + rad); sh.lineTo(w, h - rad); sh.quadraticCurveTo(w, h, w - rad, h); sh.lineTo(-w + rad, h); sh.quadraticCurveTo(-w, h, -w, h - rad); sh.lineTo(-w, -h + rad); sh.quadraticCurveTo(-w, -h, -w + rad, -h); };
    const shape = new THREE.Shape(); rr(shape, ow, oh, R); const hole = new THREE.Path(); rr(hole, ow - lip, oh - lip, Math.max(0.01, R - lip)); shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: obj.th + 0.006, bevelEnabled: false, curveSegments: 6 }); geo.translate(0, 0, -(obj.th + 0.006) / 2);
    const cv = canvasOf(512, 512), g = cv.getContext('2d'); g.fillStyle = '#c99a3c'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) { const x = r() * 512, y = r() * 512, w = 20 + r() * 70; g.fillStyle = `rgba(${235 + r() * 20 | 0},${185 + r() * 40 | 0},${80 + r() * 50 | 0},${0.35 + r() * 0.5})`; g.fillRect(x, y, w, w * (0.4 + r())); }
    g.strokeStyle = 'rgba(90,60,20,0.55)'; g.lineWidth = 1.4; for (let i = 0; i < 70; i++) { let x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    const rc = canvasOf(256, 256), rg = rc.getContext('2d'); rg.fillStyle = '#4a4a4a'; rg.fillRect(0, 0, 256, 256); for (let i = 0; i < 160; i++) { const v = 30 + r() * 140 | 0; rg.fillStyle = `rgb(${v},${v},${v})`; rg.fillRect(r() * 256, r() * 256, 10 + r() * 40, 8 + r() * 30); }
    const map = srgb(cv), rough = new THREE.CanvasTexture(rc); [map, rough].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); });
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughnessMap: rough, roughness: 0.55, metalness: 1, envMap: env, envMapIntensity: 1.5, transparent: true, opacity: 1 });
    const m = new THREE.Mesh(geo, mat); m.userData.order = 9; m.userData.keepDepth = true; m.userData.noParticles = true; m.raycast = NO_RAY; c.group.add(m);
    return { intro(k) { mat.opacity = Math.min(1, k * 1.5); mat.envMapIntensity = 1.5 + 2.5 * Math.max(0, 1 - Math.abs(k - 0.5) * 3); } }; },
};

/* ---------------------------------------------------------------- backs (drawn onto the card's back) */
/* the back's canvas, the size the stock backs use (print.js backCanvases), and a way to put it on */
function backCanvas(obj, kind) { const w = kind === 'print' ? obj.w : obj.w - 0.1, h = kind === 'print' ? obj.h : obj.h - 0.1, px = 1024 / Math.max(w, h); return canvasOf(Math.round(w * px), Math.round(h * px)); }
function putBack(c, cv) { const b = c.obj.parts.back; if (!b || c.gone) return; const old = b.material.map, on = b.material.normalMap; b.material.map = srgb(cv); b.material.normalMap = null; if (on) on.dispose(); b.material.roughness = 0.6; b.material.needsUpdate = true; if (old) old.dispose(); }
function mono(px) { return '500 ' + Math.round(px) + 'px "Geist Mono", ui-monospace, monospace'; }
const BACKS = {
  /* the photo's depth as contour lines, gold on black, like a survey map of the picture */
  contour(c) { const kind = c.obj.parts.back && c.obj.th <= 0.05 ? 'print' : 'slab', base = c.obj.base; if (!base) return;
    const draw = dp => { if (c.gone || !dp) return; const cv = backCanvas(c.obj, kind), W = cv.width, H = cv.height, g = cv.getContext('2d'); g.fillStyle = '#0d0d10'; g.fillRect(0, 0, W, H);
      const a = base.width / base.height, bw = Math.min(W * 0.84, H * 0.72 * a), bh = bw / a, x0 = (W - bw) / 2, y0 = (H - bh) * 0.38, N = 16, img = g.getImageData(0, 0, W, H), D = dp.D;
      const at = (u, v) => D[Math.min(dp.h - 1, Math.floor(v * dp.h)) * dp.w + Math.min(dp.w - 1, Math.floor(u * dp.w))];
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const u = x / bw, v = y / bh, l = Math.floor(at(u, v) * N), r1 = Math.floor(at(Math.min(1, u + 1.5 / bw), v) * N), d1 = Math.floor(at(u, Math.min(1, v + 1.5 / bh)) * N);
        if (l !== r1 || l !== d1) { const i = ((y0 + y | 0) * W + (x0 + x | 0)) * 4, near = at(u, v); img.data[i] = 200 + 40 * near; img.data[i + 1] = 160 + 40 * near; img.data[i + 2] = 80; img.data[i + 3] = 255; } }
      g.putImageData(img, 0, 0); g.strokeStyle = 'rgba(216,178,90,0.4)'; g.lineWidth = 2; g.strokeRect(x0 - 10, y0 - 10, bw + 20, bh + 20);
      g.fillStyle = 'rgba(216,178,90,0.75)'; g.font = mono(Math.min(W, H) * 0.026); g.textAlign = 'center'; g.fillText('DEPTH  ·  ' + String(c.slab.title || '').toUpperCase(), W / 2, y0 + bh + Math.min(W, H) * 0.09);
      putBack(c, cv); };
    depthFor(depthKey(c.slab), base).then(draw).catch(e => console.error(e)); },
  /* every owner, etched: the pull, collectors it passed through on the way (made up, but always the same for this slab), and you */
  provenance(c) { const kind = c.obj.th <= 0.05 ? 'print' : 'slab', cv = backCanvas(c.obj, kind), W = cv.width, H = cv.height, g = cv.getContext('2d'), r = c.r, s = c.slab, m = Math.min(W, H);
    g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, W, H); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.035})`; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
    const etch = (t, x, y, px, al) => { g.font = mono(px); g.textAlign = al || 'left'; g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillText(t, x - 1, y - 1); g.fillStyle = 'rgba(255,255,255,0.32)'; g.fillText(t, x + 1, y + 1); g.fillStyle = 'rgba(178,178,186,0.95)'; g.fillText(t, x, y); };
    const line = (x0, y0, x1) => { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x0, y0 - 1, x1 - x0, 1.5); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x0, y0 + 1, x1 - x0, 1.5); };
    const M = m * 0.08, day = 864e5, fmt = t => new Date(t).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    etch('PROVENANCE', W / 2, M + m * 0.08, m * 0.085, 'center'); etch('CERT ' + String(s.cert || '').replace('#', ''), W / 2, M + m * 0.15, m * 0.036, 'center'); line(M, M + m * 0.2, W - M);
    const NAMES = ['kiri.lens', 'tui_frames', 'harbourlight', 'ngaio.prints', 'fernfocus', 'southerly_slabs', 'te_awa_archive', 'flatwhite.film', 'kea_collects', 'lyttelton_light', 'gumboot_gallery', 'tarn_tones'];
    const now = s.ts || Date.now(), start = s.pulledAt || now - (s.from ? (40 + r() * 300) * day : 0), rows = [[start, 'PULLED']];
    if (s.from) { const n = Math.floor(r() * 3); for (let i = 0; i < n; i++) rows.push([start + (now - start) * (i + 1) / (n + 2), NAMES[Math.floor(r() * NAMES.length)].toUpperCase()]); rows.push([Math.max(start + 1, now - day), s.from.toUpperCase()]); }
    (s.hist || []).forEach(h => rows.push([h.at, String(h.who || '').toUpperCase()])); rows.sort((a, b) => a[0] - b[0]); rows.push([now, 'YOU']);
    const lh = m * 0.1; let y = M + m * 0.28; rows.slice(-7).forEach(([t, who], i) => { etch(fmt(t), M, y, m * 0.045); etch(who, W - M, y, m * 0.05, 'right'); if (i < rows.length - 1) line(M, y + lh * 0.38, W - M); y += lh; });
    putBack(c, cv); },
  /* a whole other photograph from the same pack, mounted on the back */
  twoface(c) { const p2 = c.x.photo2; if (!p2 || !c.S.SM || !c.S.SM.photoCanvas) return; const kind = c.obj.th <= 0.05 ? 'print' : 'slab', fake = { id: c.slab.id + '~back', photo: p2, seed: (c.slab.seed ^ 0x2f) >>> 0, tier: c.slab.tier };
    const forget = () => { if (c.S.SM.forgetPhoto) c.S.SM.forgetPhoto(fake.id); };
    c.S.SM.photoCanvas(fake, c.S).then(img => { forget(); if (c.gone || !img) return; const cv = backCanvas(c.obj, kind), W = cv.width, H = cv.height, g = cv.getContext('2d'), m = Math.min(W, H), M = m * 0.05;
      g.fillStyle = kind === 'print' ? '#f4f2ec' : '#0e0e10'; g.fillRect(0, 0, W, H); const a = img.width / img.height, bw = Math.min(W - 2 * M, (H - 3.2 * M) * a), bh = bw / a, x0 = (W - bw) / 2, y0 = M * 1.1;
      g.drawImage(img, x0, y0, bw, bh); g.strokeStyle = kind === 'print' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)'; g.lineWidth = 2; g.strokeRect(x0, y0, bw, bh);
      g.fillStyle = kind === 'print' ? 'rgba(40,36,30,0.7)' : 'rgba(232,198,122,0.75)'; g.font = mono(m * 0.026); g.textAlign = 'center'; g.fillText('THE OTHER SIDE  ·  PLATE ' + String(p2.plate || 1).padStart(3, '0'), W / 2, y0 + bh + M * 1.1);   /* never the pack's name: Who Shot It hides the artist */
      putBack(c, cv); }).catch(e => { forget(); console.error(e); }); },
  uvnote() {},   /* ink on the front: fxtools.js */
};
