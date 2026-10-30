// RIGMODEL: the two machines that make the computer on the dark side (rig.js drives them). A black sports car,
// lofted from side and plan profiles like a clay model and cut along its shut lines, which becomes the keyboard and
// the mouse; and a mech (Sam: a Gundam on the right; this one is our own design), jointed like an action figure,
// which becomes the curved monitor. Everything is built from code, nothing is loaded.
//   buildCar(THREE, ENV) → { parts: [{ name, obj, kind }], glow, inner, ... }   (car frame: nose +x, y up, width z)
//   buildKeys(THREE, ENV) → { bed, keys, glow, set(k) }   the key bed that rises out of the car's floor
//   buildMech(THREE, ENV) → { root, pelvis, legs, spine, torso, wings, arms, head, screenMat, marks, pole, visor }
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const CAR = { L: 5.6, wr: 0.4, wb: 3.3, half: 1.0 };   /* length, wheel radius, wheelbase, half track (wheel centre) */
export const MECH = { L1: 1.4, L2: 1.5, ank: 0.36, TW: 2.6, TH: 3.3, TD: 0.62, WW: 2.5, cy: 3.45 };   /* thigh, shin, ankle height; torso width, height, depth; a wing's width; the screen's centre height once it is a monitor */
const HL = CAR.L / 2, PI = Math.PI;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sstep = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* a smooth function of u through control points [u, v] (a Catmull-Rom spline, read back by u) */
function prof(THREE, pts) {
  const c = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(p[0], p[1]))), s = c.getSpacedPoints(500);
  return u => { if (u <= s[0].x) return s[0].y; const n = s.length - 1; if (u >= s[n].x) return s[n].y; let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m].x < u) lo = m; else hi = m; } const a = s[lo], b = s[hi]; return a.y + (b.y - a.y) * ((u - a.x) / ((b.x - a.x) || 1)); };
}

/* a grid surface from f(i/nu, j/nv) → [x, y, z]; flip turns the faces round; caps close an end with a fan */
function grid(THREE, nu, nv, f, flip) {
  const pos = [], idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) pos.push(...f(i / nu, j / nv));
  const at = (i, j) => i * (nv + 1) + j;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1); if (flip) idx.push(a, d, b, b, d, c); else idx.push(a, b, d, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function fan(THREE, ring, centre, flip) {
  const pos = [...centre], idx = []; ring.forEach(p => pos.push(...p));
  for (let k = 1; k < ring.length; k++) flip ? idx.push(0, k + 1, k) : idx.push(0, k, k + 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* ---------------- the car ---------------- */
export function buildCar(THREE, ENV) {
  const TOP = prof(THREE, [[-1, 0.72], [-0.97, 0.95], [-0.9, 1.03], [-0.75, 1.01], [-0.45, 0.99], [0, 0.97], [0.3, 0.99], [0.55, 0.98], [0.72, 0.9], [0.86, 0.74], [0.95, 0.6], [1, 0.5]]);
  const BOT = prof(THREE, [[-1, 0.5], [-0.95, 0.32], [-0.82, 0.2], [0.78, 0.19], [0.93, 0.24], [1, 0.34]]);
  const HW = prof(THREE, [[-1, 0.86], [-0.94, 1.08], [-0.8, 1.2], [-0.58, 1.24], [-0.3, 1.16], [0.15, 1.13], [0.45, 1.18], [0.66, 1.2], [0.84, 1.1], [0.95, 0.94], [1, 0.78]]);
  const AX = [CAR.wb / 2, -CAR.wb / 2], RA = 0.5;
  const halfW = x => { const u = x / HL; let w = HW(u); AX.forEach((a, k) => { const d = (x - a) / 0.75; w += (k ? 0.07 : 0.05) * Math.exp(-d * d); }); return w; };
  /* a point on the lower body: x along the car, phi from -PI/2 (underneath) round the side s to PI/2 (on top) */
  function body(x, phi, s) {
    const u = x / HL, yb = BOT(u), yt = TOP(u), w = halfW(x), yc = (yb + yt) / 2, hh = (yt - yb) / 2, c = Math.cos(phi), sn = Math.sin(phi);
    let y = yc + hh * Math.sign(sn) * Math.pow(Math.abs(sn), sn > 0 ? 0.62 : 0.32), z = w * Math.pow(Math.abs(c), sn > 0 ? 0.42 : 0.28);
    if (y > yc) z *= 1 - 0.17 * Math.pow((y - yc) / hh, 2);   /* tumblehome: the sides lean in towards the top */
    const k = sstep(w - 0.66, w - 0.44, z);   /* the wheel arches, cut into the outer part of the side only */
    AX.forEach(a => { const dx = x - a; if (Math.abs(dx) < RA) { const ay = CAR.wr + Math.sqrt(RA * RA - dx * dx) + 0.02; if (y < ay) y += (Math.min(ay, yt - 0.06) - y) * k; } });
    return [x, y, z * s];
  }
  /* the greenhouse: phi 0 (one side) over the roof to PI (the other side) */
  const ROOF = prof(THREE, [[-0.53, 0], [-0.46, 0.1], [-0.3, 0.3], [-0.1, 0.42], [0.06, 0.44], [0.18, 0.38], [0.3, 0.2], [0.41, 0]]);
  function cabin(x, phi, off) { const u = x / HL, base = TOP(u) - 0.03, h = ROOF(u), w = halfW(x), sn = Math.sin(phi), c = Math.cos(phi), t = Math.pow(sn, 0.7);
    const wB = w * 0.82, wR = w * 0.56, ww = wB + (wR - wB) * t; return [x, base + h * t + (off || 0) * sn, (ww + (off || 0) * Math.abs(c)) * Math.sign(c) * Math.pow(Math.abs(c), 0.62)]; }

  const std = (c, r, m, o) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, envMap: ENV, ...(o || {}) });
  const paint = detail(THREE, new THREE.MeshPhysicalMaterial({ color: 0x050608, metalness: 0.3, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.03, envMap: ENV, envMapIntensity: 0.9 }), 9, 0.6);   /* metallic flake under the clear coat */
  const inner = detail(THREE, new THREE.MeshStandardMaterial({ color: 0x1c1e23, roughness: 0.42, metalness: 0.85, envMap: ENV, side: THREE.BackSide }), 3);   /* the inside of the shell: bare machined metal */
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x010204, metalness: 0.0, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01, envMap: ENV, envMapIntensity: 0.55 });
  const trim = std(0x0b0b0c, 0.75, 0.2), carbon = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x += 8) { g.fillStyle = ((x + y) / 8) % 2 ? '#1a1b1e' : '#0d0e10'; g.fillRect(x, y, 8, 8); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, y, 8, 1); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.colorSpace = THREE.SRGBColorSpace; return std(0xffffff, 0.45, 0.5, { map: t }); })();
  const chrome = std(0xe8e8ea, 0.12, 1), gun = std(0x2a2c30, 0.28, 0.9), tyreM = std(0x111113, 0.92, 0), caliper = std(0xc8201b, 0.35, 0.3), disc = std(0x8a8c90, 0.35, 0.95);
  const ledW = new THREE.MeshBasicMaterial({ color: 0xffffff }), ledR = new THREE.MeshBasicMaterial({ color: 0xff2a3a }), ledB = new THREE.MeshBasicMaterial({ color: 0x8fd0ff });
  const paint2 = paint.clone(); paint2.side = THREE.DoubleSide; const trim2 = trim.clone(); trim2.side = THREE.DoubleSide;
  const parts = [], glow = [];

  /* the body panels: three lengths (nose, doors, tail), each split down the middle, with a hairline gap at every cut */
  const CUTS = [[-HL, -0.86], [-0.86, 0.78], [0.78, HL]], NAMES = ['rear', 'mid', 'front'], G = 0.014;
  CUTS.forEach(([x0, x1], ci) => [1, -1].forEach(s => {
    const a = x0 + (ci ? G : 0), b = x1 - (ci < 2 ? G : 0), nx = Math.max(8, Math.round((b - a) * 16));
    const f = (i, j) => body(a + (b - a) * i, -PI / 2 + PI * j, s);
    const geo = grid(THREE, nx, 40, f, s < 0);
    const g = new THREE.Group(), m = new THREE.Mesh(geo, paint), mi = new THREE.Mesh(geo, inner); g.add(m, mi);
    /* the nose and the tail are closed with a fan, so the car is never hollow from the front or back */
    if (ci !== 1) { const xe = ci === 2 ? b : a, ring = []; for (let j = 0; j <= 40; j++) ring.push(body(xe, -PI / 2 + PI * j / 40, s)); const cy = (BOT(xe / HL) + TOP(xe / HL)) / 2; const cap = fan(THREE, ring, [xe + (ci === 2 ? 0.06 : -0.03), cy, 0], (ci === 2) !== (s < 0)); g.add(new THREE.Mesh(cap, ci === 2 ? trim2 : paint2)); }
    g.userData.s = s; parts.push({ name: NAMES[ci] + (s > 0 ? 'L' : 'R'), obj: g, kind: 'panel' });
  }));
  const P = n => parts.find(p => p.name === n).obj;
  /* the greenhouse and its painted roof, one part */
  { const g = new THREE.Group(), x0 = -0.53 * HL, x1 = 0.41 * HL;
    g.add(new THREE.Mesh(grid(THREE, 40, 30, (i, j) => cabin(x0 + (x1 - x0) * i, PI * j), false), glass));
    const r0 = -0.4 * HL, r1 = 0.2 * HL; g.add(new THREE.Mesh(grid(THREE, 24, 12, (i, j) => cabin(r0 + (r1 - r0) * i, PI * (0.3 + 0.4 * j), 0.008), false), paint));
    /* a thin painted frame round the side windows (the A pillar line) */
    [0.12, 0.88].forEach(p => g.add(new THREE.Mesh(grid(THREE, 30, 2, (i, j) => cabin(x0 + 0.1 + (x1 - x0 - 0.2) * i, PI * (p + (j - 0.5) * 0.05), 0.006), false), paint)));
    parts.push({ name: 'cabin', obj: g, kind: 'cabin' }); }
  /* the details, each riding the panel it belongs to */
  const tube = (pts, r, mat) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 24, r, 6, false), mat);
  [1, -1].forEach(s => {
    const front = P(s > 0 ? 'frontL' : 'frontR'), mid = P(s > 0 ? 'midL' : 'midR'), rear = P(s > 0 ? 'rearL' : 'rearR');
    /* headlights: a thin LED blade that wraps the nose corner, and a darker lens under it */
    const hl = []; for (let k = 0; k <= 8; k++) { const t = k / 8; hl.push(body(2.32 + 0.34 * t, 0.52 - 0.5 * t, s)); hl[k][1] -= 0.015; hl[k][2] *= 1.008; }
    const blade = tube(hl, 0.026, ledW); front.add(blade); glow.push(blade);
    const lens = []; for (let k = 0; k <= 8; k++) { const t = k / 8; lens.push(body(2.36 + 0.3 * t, 0.3 - 0.4 * t, s)); lens[k][2] *= 1.004; } front.add(tube(lens, 0.05, glass));
    /* the front intake (a dark mouth either side of the nose) */
    const mouth = new THREE.Mesh(grid(THREE, 10, 6, (i, j) => { const p = body(2.5 + 0.25 * i, -0.2 - 0.35 * j, s); p[2] *= 1.006; return p; }, s < 0), trim2); front.add(mouth);
    /* the side intake behind the door, and a carbon sill along the bottom */
    const scoop = new THREE.Mesh(grid(THREE, 12, 6, (i, j) => { const p = body(-1.15 + 0.62 * i, -0.08 + 0.42 * j * (0.3 + 0.7 * i), s); p[2] *= 1.006; return p; }, s < 0), trim2); rear.add(scoop);
    const sill = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.08, 0.14, 2, 0.03), carbon); sill.position.set(-0.05, 0.2, s * (halfW(0) - 0.03)); mid.add(sill);
    /* the mirror on a little stalk */
    const mir = new THREE.Group(); mir.position.set(0.62, 0.98, s * 1.05); const mh = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.16, 0.2, 3, 0.06), paint); mh.position.z = s * 0.14; mir.add(mh); const st = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.05, 0.16, 2, 0.02), trim); st.position.z = s * 0.04; mir.add(st); mid.add(mir);
    /* the door handle line and the shut line of the door, as a hairline */
    mid.add(tube([body(0.55, 0.5, s), body(0.2, 0.62, s), body(-0.6, 0.62, s), body(-0.7, 0.2, s)].map(p => [p[0], p[1], p[2] * 1.004]), 0.006, trim));
    /* the tail light: a red bar across the back, wrapping the corners */
    const tl = []; for (let k = 0; k <= 8; k++) { const t = k / 8; tl.push(body(-2.62 - 0.17 * t, 0.62 + 0.1 * t, s)); tl[k][2] *= 1.006; } tl.push([-2.82, 0.86, s * 0.02]);
    const tail = tube(tl, 0.03, ledR); rear.add(tail); glow.push(tail);
  });
  /* the floor: a flat carbon tray with the splitter, the diffuser and the exhausts; it becomes the stand's foot */
  { const g = new THREE.Group(), tray = new THREE.Mesh(new RoundedBoxGeometry(CAR.L - 0.5, 0.06, 2.0, 2, 0.03), carbon); tray.position.set(0, 0.2, 0); g.add(tray);
    const split = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.04, 1.7, 2, 0.02), carbon); split.position.set(2.62, 0.17, 0); g.add(split);
    for (let k = -2; k <= 2; k++) { const fin = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.16, 0.025, 1, 0.01), carbon); fin.position.set(-2.62, 0.28, k * 0.3); fin.rotation.z = -0.35; g.add(fin); }
    [-1, 1].forEach(s => { const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.3, 20, 1, true), chrome); ex.rotation.z = PI / 2; ex.position.set(-2.72, 0.34, s * 0.16); g.add(ex); const inr = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), new THREE.MeshBasicMaterial({ color: 0x050505 })); inr.rotation.y = -PI / 2; inr.position.set(-2.8, 0.34, s * 0.16); g.add(inr); });
    /* the wheel wells: dark liners so the arches never show the sky through the car; they ride the panel over each wheel */
    AX.forEach((a, ai) => [1, -1].forEach(s => { const l = new THREE.Mesh(new THREE.CylinderGeometry(RA + 0.01, RA + 0.01, 0.56, 24, 1, true, PI - 1.25, 2.5), new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1, side: THREE.DoubleSide })); l.rotation.x = PI / 2; l.position.set(a, CAR.wr + 0.02, s * (halfW(a) - 0.34)); P((ai ? 'rear' : 'front') + (s > 0 ? 'L' : 'R')).add(l); }));
    /* the underglow, off until the car wakes up */
    const ug = new THREE.Mesh(new THREE.PlaneGeometry(CAR.L + 1.6, 3.4), new THREE.MeshBasicMaterial({ map: radial(THREE, '79,170,255'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); ug.rotation.x = -PI / 2; ug.position.y = 0.012; g.add(ug); g.userData.under = ug;
    parts.push({ name: 'floor', obj: g, kind: 'floor' }); }
  /* the rear wing: an aerofoil on two swan-neck stalks */
  { const g = new THREE.Group(), sh = new THREE.Shape(); sh.moveTo(0.3, 0); sh.bezierCurveTo(0.16, 0.06, -0.12, 0.07, -0.3, 0.02); sh.lineTo(-0.3, -0.01); sh.bezierCurveTo(-0.1, 0.0, 0.14, -0.02, 0.3, 0);
    const foil = new THREE.ExtrudeGeometry(sh, { depth: 2.1, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 16 }); foil.translate(0, 0, -1.05);
    const w = new THREE.Mesh(foil, carbon); w.position.set(-2.45, 1.28, 0); g.add(w);
    [-1, 1].forEach(s => { const st = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.32, 0.04, 2, 0.015), trim); st.position.set(-2.42, 1.13, s * 0.6); st.rotation.z = 0.2; g.add(st); const ep = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.2, 0.02, 2, 0.008), carbon); ep.position.set(-2.45, 1.29, s * 1.06); g.add(ep); });
    parts.push({ name: 'wing', obj: g, kind: 'wing' }); }
  /* the wheels: a tyre with a rounded shoulder, ten-spoke forged rims, a drilled disc and a red calliper */
  const tyreG = (() => { const pr = [[0.27, -0.17], [0.34, -0.18], [0.375, -0.17], [0.395, -0.14], [0.4, -0.1], [0.4, 0.1], [0.395, 0.14], [0.375, 0.17], [0.34, 0.18], [0.27, 0.17]].map(p => new THREE.Vector2(p[0], p[1])); const g = new THREE.LatheGeometry(pr, 48); g.rotateX(PI / 2); return g; })();
  const rimG = (() => { const sh = new THREE.Shape(); sh.absarc(0, 0, 0.268, 0, PI * 2, false); const n = 10;
    for (let k = 0; k < n; k++) { const a0 = (k / n) * PI * 2, a1 = ((k + 1) / n) * PI * 2, h = new THREE.Path(), r0 = 0.085, r1 = 0.232, wi = k % 2 ? 0.045 : 0.11, wo = k % 2 ? 0.035 : 0.06;
      h.moveTo(Math.cos(a0 + wi) * r0, Math.sin(a0 + wi) * r0); h.lineTo(Math.cos(a0 + wo) * r1, Math.sin(a0 + wo) * r1); h.absarc(0, 0, r1, a0 + wo, a1 - wo, false); h.lineTo(Math.cos(a1 - wi) * r0, Math.sin(a1 - wi) * r0); h.absarc(0, 0, r0, a1 - wi, a0 + wi, true); sh.holes.push(h); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 24 }); return g; })();
  const barrelG = new THREE.CylinderGeometry(0.262, 0.262, 0.3, 40, 1, true); barrelG.rotateX(PI / 2);
  const discG = new THREE.CylinderGeometry(0.215, 0.215, 0.03, 40); discG.rotateX(PI / 2);
  AX.forEach((a, ai) => [1, -1].forEach(s => {
    const part = new THREE.Group(), steer = new THREE.Group(), spin = new THREE.Group(); part.add(steer); steer.add(spin); part.position.set(a, CAR.wr, s * CAR.half);
    spin.add(new THREE.Mesh(tyreG, tyreM)); spin.add(new THREE.Mesh(barrelG, new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.8, side: THREE.DoubleSide })));
    const rim = new THREE.Mesh(rimG, gun); rim.position.z = s * 0.1; if (s < 0) rim.rotation.y = PI; spin.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.04, 20), chrome); hub.rotation.x = PI / 2; hub.position.z = s * 0.165; spin.add(hub);
    for (let k = 0; k < 5; k++) { const an = k / 5 * PI * 2, nut = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 6), chrome); nut.rotation.x = PI / 2; nut.position.set(Math.cos(an) * 0.1, Math.sin(an) * 0.1, s * 0.16); spin.add(nut); }
    const d = new THREE.Mesh(discG, disc); d.position.z = s * 0.02; spin.add(d);
    const cal = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 16, 0.9), caliper); cal.position.z = s * 0.06; cal.rotation.z = ai ? 0.4 : PI - 1.3; cal.scale.z = 1.4; steer.add(cal);
    part.userData = { spin, steer, front: !ai, s };
    parts.push({ name: 'wheel' + (ai ? 'R' : 'F') + (s > 0 ? 'L' : 'R'), obj: part, kind: 'wheel' });
  }));
  parts.forEach(p => p.obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.userData.noParticles = true; } }));
  return { parts, glow, inner, paint, ledW, ledR, ledB, halfW, body };
}

/* a soft round glow on a canvas, for the underglow and the projector's pool of light */
export function radial(THREE, rgb) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(' + rgb + ',0.9)'); gr.addColorStop(0.45, 'rgba(' + rgb + ',0.35)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }

/* ---------------- surface detail ----------------
   Sam: ultra high fidelity and textures. The meshes have no UVs, so the grain is sampled in object space from three
   sides (triplanar): brushed streaks, flake and fine scuffs vary the roughness and, a touch, the colour. */
let grainTex = null;
export function grain(THREE) { if (grainTex) return grainTex; const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), id = g.createImageData(512, 512), d = id.data;
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const row = new Float32Array(512); for (let y = 0; y < 512; y++) row[y] = rnd();
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) { const i = (y * 512 + x) * 4, streak = row[y] * 0.55 + row[(y + 1) % 512] * 0.25, speck = rnd(); let v = 0.35 + streak * 0.4 + (speck > 0.985 ? 0.35 : speck * 0.08); d[i] = d[i + 1] = d[i + 2] = Math.min(255, v * 255); d[i + 3] = 255; }
  g.putImageData(id, 0, 0);
  /* scuffs: short faint arcs */
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; for (let k = 0; k < 120; k++) { const x = rnd() * 512, y = rnd() * 512, r = 6 + rnd() * 30, a = rnd() * 6.28; g.beginPath(); g.arc(x, y, r, a, a + 0.3 + rnd() * 0.6); g.stroke(); }
  grainTex = new THREE.CanvasTexture(c); grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; grainTex.anisotropy = 8; return grainTex; }
export function detail(THREE, mat, k, amt) { if (!mat || mat.userData.detail) return mat; mat.userData.detail = true; const tex = grain(THREE), K = k || 1.2, A = amt ?? 1;
  mat.onBeforeCompile = sh => { sh.uniforms.tDet = { value: tex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDetP; varying vec3 vDetN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDetP = position; vDetN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tDet; varying vec3 vDetP; varying vec3 vDetN;\nfloat detTri(){ vec3 w = pow(abs(normalize(vDetN)), vec3(4.0)); w /= dot(w, vec3(1.0)); vec3 p = vDetP * ' + K.toFixed(3) + '; return texture2D(tDet, p.zy).r * w.x + texture2D(tDet, p.xz).r * w.y + texture2D(tDet, p.xy).r * w.z; }')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat detV = detTri(); diffuseColor.rgb *= 1.0 + (detV - 0.5) * ' + (0.25 * A).toFixed(3) + ';')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (1.0 + (detV - 0.5) * ' + (1.1 * A).toFixed(3) + '), 0.03, 1.0);'); };
  mat.customProgramCacheKey = () => 'det' + K + A; mat.needsUpdate = true; return mat; }

/* ---------------- the key bed: it rises out of the car's floor once the body has split ---------------- */
export function buildKeys(THREE, ENV) {
  const bed = new THREE.Group(), capM = new THREE.MeshStandardMaterial({ color: 0x1f2125, metalness: 0.2, roughness: 0.48, envMap: ENV, envMapIntensity: 0.7 });
  /* the deck the keys sit in: brushed dark aluminium with a lip, it rises with them to the height of the rails */
  const deck = new THREE.Mesh(new RoundedBoxGeometry(5.0, 0.3, 1.74, 2, 0.05), new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.9, roughness: 0.3, envMap: ENV })); deck.position.y = 0.08; bed.add(deck);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 1.66), new THREE.MeshBasicMaterial({ color: 0x2a6fff, transparent: true, opacity: 0 })); glow.rotation.x = -PI / 2; glow.position.y = 0.24; bed.add(glow);
  const L = [], px = 0.375, pz = 0.335;
  for (let r = 0; r < 5; r++) { if (r === 4) { [-6, -5, -4, 4, 5, 6].forEach(c => L.push({ x: c * px, z: (r - 2) * pz, w: 1 })); L.push({ x: 0, z: (r - 2) * pz, w: 6.6 }); continue; } for (let c = -6; c <= 6; c++) L.push({ x: c * px + (r % 2 ? px * 0.25 : 0), z: (r - 2) * pz, w: 1 }); }
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.31, 0.12, 0.29, 2, 0.045), capM, L.length); bed.add(keys);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  /* k 0..1: the keys come up in a wave from the middle out, each one popping a little high and settling */
  const set = k => { L.forEach((it, i) => { const d = Math.hypot(it.x / 2.6, it.z / 0.9) / 1.42, e = clamp((k * 1.5 - d * 0.9) / 0.6, 0, 1), pop = e < 1 ? Math.sin(e * PI) * 0.1 : 0;
      ps.set(it.x, 0.18 + 0.12 * e + pop, it.z); sc.set(it.w * Math.max(0.001, e), Math.max(0.001, e), Math.max(0.001, e)); m4.compose(ps, q, sc); keys.setMatrixAt(i, m4); }); keys.instanceMatrix.needsUpdate = true; glow.material.opacity = 0.7 * clamp(k * 1.4 - 0.3, 0, 1); };
  /* the keyboard's case, which closes round the deck once the car's halves have folded away into it */
  const caseP = new THREE.Group(); bed.add(caseP); caseP.position.y = 0.0; caseP.scale.set(0.001, 1, 0.001); caseP.visible = false;
  const alu = detail(THREE, new THREE.MeshStandardMaterial({ color: 0x2b2d32, metalness: 0.9, roughness: 0.3, envMap: ENV }), 3.5);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(5.7, 0.7, 2.12, 3, 0.1), alu); shell.position.y = -0.05; caseP.add(shell);
  const lip = new THREE.Mesh(new RoundedBoxGeometry(5.5, 0.03, 0.03, 1, 0.01), new THREE.MeshBasicMaterial({ color: 0x4fb8ff })); lip.position.set(0, 0.0, 1.07); caseP.add(lip);
  set(0); return { bed, keys, glow, set, caseP, lip };
}

/* ---------------- the mech ---------------- */
/* Built standing, facing +z, every joint a group so rig.js only ever turns or slides a joint: the hips, knees and
   ankles; the spine (it telescopes up to make the monitor's neck); the torso (its front is the middle of the screen);
   the two wings, folded across the chest like armoured doors, which swing open into the sides of a curved screen;
   the shoulders on rails (they slide back out of the wings' way) with their arms; the head, which sinks into the
   shoulders and carries the projector. */
export function buildMech(THREE, ENV) {
  const RB = RoundedBoxGeometry, M = MECH;
  const std = (c, r, m, o) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, envMap: ENV, ...(o || {}) });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xe6e7ea, roughness: 0.36, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.18, envMap: ENV, envMapIntensity: 0.75 });
  const grey = std(0x9a9da4, 0.42, 0.5), frame = std(0x1b1c21, 0.45, 0.8), black = std(0x0b0b0d, 0.6, 0.2), accent = std(0xff5a1f, 0.38, 0.15), gold = std(0xd8a440, 0.28, 0.95);
  const visor = new THREE.MeshBasicMaterial({ color: 0x7fd4ff }), lineM = new THREE.MeshBasicMaterial({ color: 0x0b0c0f });
  const box = (w, h, d, mat, x, y, z, p, r) => { const m = new THREE.Mesh(new RB(w, h, d, 2, r ?? Math.min(w, h, d) * 0.16), mat); m.position.set(x, y, z); p.add(m); return m; };
  /* a panel line: a hairline groove on a face */
  const line = (w, h, x, y, z, p) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineM); m.position.set(x, y, z); p.add(m); return m; };
  const cyl = (r, h, mat, x, y, z, p, rx, rz) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), mat); m.position.set(x, y, z); m.rotation.set(rx || 0, 0, rz || 0); p.add(m); return m; };
  const root = new THREE.Group(), pelvis = new THREE.Group(); root.add(pelvis);
  /* the pelvis: a dark frame block, a white crotch plate with a red keel, skirt armour all round */
  box(1.7, 0.56, 1.0, frame, 0, 0, 0, pelvis); box(0.6, 0.62, 0.5, white, 0, -0.1, 0.3, pelvis); box(0.14, 0.4, 0.06, accent, 0, -0.12, 0.56, pelvis);
  [-1, 1].forEach(s => { const f = box(0.62, 0.7, 0.12, white, s * 0.45, -0.25, 0.55, pelvis); f.rotation.x = -0.12; line(0.5, 0.012, s * 0.45, -0.05, 0.62, pelvis);
    const sd = box(0.12, 0.8, 0.8, white, s * 0.92, -0.25, 0, pelvis); sd.rotation.z = s * 0.1; box(0.06, 0.3, 0.3, accent, s * 1.0, -0.2, 0, pelvis); });
  box(1.4, 0.6, 0.12, white, 0, -0.2, -0.56, pelvis);
  /* the legs */
  const legs = [-1, 1].map(s => {
    const hip = new THREE.Group(); hip.position.set(s * 0.55, -0.22, 0); pelvis.add(hip); cyl(0.26, 0.5, frame, 0, 0, 0, hip, 0, PI / 2);
    box(0.5, 1.3, 0.56, frame, 0, -0.7, 0, hip); box(0.72, 1.05, 0.8, white, 0, -0.62, 0.02, hip); line(0.6, 0.012, 0, -0.35, 0.43, hip); box(0.3, 0.5, 0.06, grey, s * 0.37, -0.7, 0.05, hip);
    const knee = new THREE.Group(); knee.position.set(0, -M.L1, 0); hip.add(knee); cyl(0.24, 0.6, frame, 0, 0, 0, knee, 0, PI / 2);
    box(0.6, 0.55, 0.32, white, 0, 0.0, 0.36, knee).rotation.x = 0.2; box(0.2, 0.2, 0.05, accent, 0, 0.05, 0.53, knee);
    box(0.82, 1.32, 0.92, white, 0, -0.8, 0.02, knee); box(0.6, 0.8, 0.36, frame, 0, -0.6, -0.52, knee); for (let k = 0; k < 3; k++) box(0.5, 0.06, 0.06, grey, 0, -0.35 - k * 0.18, -0.7, knee);
    line(0.7, 0.012, 0, -0.5, 0.49, knee); line(0.012, 0.9, s * 0.2, -0.85, 0.49, knee);
    const ankle = new THREE.Group(); ankle.position.set(0, -M.L2, 0); knee.add(ankle); cyl(0.2, 0.5, frame, 0, 0, 0, ankle, 0, PI / 2);
    box(0.86, 0.3, 1.45, white, 0, -0.2, 0.2, ankle); box(0.7, 0.16, 0.4, accent, 0, -0.08, 0.78, ankle); box(0.8, 0.12, 0.5, frame, 0, -0.31, -0.35, ankle); box(0.9, 0.06, 1.5, black, 0, -0.34, 0.2, ankle);
    return { hip, knee, ankle, s }; });
  /* the spine: it sits inside the torso while it is a robot and telescopes out to make the neck of the monitor */
  const spine = new THREE.Group(); spine.position.set(0, 0.3, 0); pelvis.add(spine);
  box(0.74, 2.0, 0.46, frame, 0, 0.2, -0.08, spine); [-1, 1].forEach(s => cyl(0.06, 1.8, std(0xc9ccd2, 0.2, 1), s * 0.22, 0.2, 0.18, spine));
  const torso = new THREE.Group(); torso.position.set(0, M.TH / 2, 0); spine.add(torso);
  /* the torso: a dark housing, its front is the middle of the screen; a white back with thrusters */
  const TW = M.TW, TH = M.TH, TD = M.TD;
  box(TW, TH, TD, frame, 0, 0, 0, torso, 0.08).userData.keep = true; box(TW - 0.2, TH - 0.3, 0.14, white, 0, 0, -TD / 2 - 0.05, torso); line(TW - 0.5, 0.012, 0, 0.6, -TD / 2 - 0.125, torso);
  [-1, 1].forEach(s => { cyl(0.22, 0.5, frame, s * 0.6, 0.7, -TD / 2 - 0.3, torso, PI / 2); cyl(0.17, 0.06, std(0x3a3d44, 0.3, 0.9), s * 0.6, 0.7, -TD / 2 - 0.56, torso, PI / 2); });
  box(TW - 0.1, 0.26, TD + 0.1, frame, 0, TH / 2 - 0.1, 0, torso).userData.keep = true; box(TW * 0.5, 0.2, TD + 0.12, frame, 0, -TH / 2 + 0.1, 0, torso).userData.keep = true;
  /* the screen: three flat panels, the middle on the torso and one on each wing; their uvs share one picture */
  const screenMat = new THREE.ShaderMaterial({ uniforms: { map: { value: null }, uBoot: { value: 0 }, uDim: { value: 1 }, uLine: { value: 0 } }, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float uBoot, uDim, uLine; varying vec2 vUv;
      void main(){ float d = abs(vUv.y - 0.5); float open = smoothstep(uBoot * 0.5 + 0.004, uBoot * 0.5 - 0.004, d);
        float line = exp(-pow(d / max(0.002, uBoot * 0.5 + 0.002) - 1.0, 2.0) * 900.0) * step(0.001, uBoot) * (1.0 - smoothstep(0.85, 1.0, uBoot));
        float spot = exp(-pow((vUv.x - 0.5) * 3.0, 2.0)) * uLine;
        vec3 c = texture2D(map, vUv).rgb * open * uDim; c += vec3(0.75, 0.88, 1.0) * (line * 1.4 + spot * exp(-d * d * 4000.0)); gl_FragColor = vec4(c, 1.0); }` });
  const SW = TW - 0.12, WS = M.WW - 0.1, TOT = SW + 2 * WS + 0.08;
  const panel = (w, h, u0) => { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * w / TOT); return new THREE.Mesh(g, screenMat); };
  const scrC = panel(SW, TH - 0.12, WS / TOT + 0.04 / TOT); scrC.position.z = TD / 2 + 0.004; scrC.userData.keep = true; torso.add(scrC);
  const marks = { left: new THREE.Object3D(), right: new THREE.Object3D(), top: new THREE.Object3D(), bottom: new THREE.Object3D() };
  marks.top.position.set(0, (TH - 0.12) / 2, TD / 2); marks.bottom.position.set(0, -(TH - 0.12) / 2, TD / 2); torso.add(marks.top, marks.bottom);
  /* the wings: each hinged at the torso's front edge; folded, it lies across the chest with its armour outwards */
  const wings = [-1, 1].map(s => {
    const hinge = new THREE.Group(); hinge.position.set(s * TW / 2, 0, TD / 2); torso.add(hinge); cyl(0.05, TH * 0.9, frame, 0, 0, 0, hinge);
    const slide = new THREE.Group(); hinge.add(slide);   /* the right wing folds over the left one, so it rides a little further out */
    const W = M.WW;
    box(W, TH, 0.16, frame, s * W / 2, 0, -0.08, slide, 0.05).userData.keep = true;
    const scr = panel(WS, TH - 0.12, s < 0 ? 0 : (WS + SW + 0.08) / TOT); scr.position.set(s * W / 2, 0, 0.004); scr.userData.keep = true; slide.add(scr); slide.userData.scr = scr;
    /* the armour on its back, which is the robot's chest: white plates, vents, a red stripe and a gold catch */
    const back = new THREE.Group(); back.position.set(s * W / 2, 0, -0.17); back.userData.toy = true; slide.add(back);
    box(W - 0.12, TH - 0.2, 0.1, white, 0, 0, -0.02, back); box(W - 0.6, 0.9, 0.08, white, -s * 0.1, 0.6, -0.1, back);
    for (let k = 0; k < 4; k++) box(0.9, 0.07, 0.05, frame, -s * 0.35, -0.3 - k * 0.2, -0.09, back);
    box(0.12, TH - 0.6, 0.05, accent, s * (W / 2 - 0.25), 0, -0.09, back); cyl(0.12, 0.08, gold, -s * (W / 2 - 0.35), 0.62, -0.1, back, PI / 2);
    line(W - 0.4, 0.012, 0, 1.15, -0.081, back).rotation.y = PI; line(W - 0.4, 0.012, 0, -1.15, -0.081, back).rotation.y = PI;
    const edge = new THREE.Object3D(); edge.position.set(s * (W - 0.05), 0, 0.004); slide.add(edge); marks[s < 0 ? 'left' : 'right'] = edge;
    return { hinge, slide, s }; });
  /* the shoulders on rails, with the arms */
  const arms = [-1, 1].map(s => {
    const mount = new THREE.Group(); mount.position.set(s * (TW / 2 + 0.6), TH / 2 - 0.55, 0); torso.add(mount);
    const pad = new THREE.Group(); mount.add(pad); box(1.05, 0.95, 1.15, white, s * 0.1, 0.22, 0, pad); box(1.1, 0.12, 1.2, accent, s * 0.1, 0.62, 0, pad); box(0.4, 0.3, 0.06, frame, s * 0.15, 0.2, 0.6, pad); cyl(0.3, 0.6, frame, 0, -0.12, 0, mount, 0, PI / 2);
    const arm = new THREE.Group(); arm.position.set(s * 0.1, -0.25, 0); mount.add(arm);
    box(0.5, 1.15, 0.58, white, 0, -0.65, 0, arm); line(0.012, 0.8, s * 0.26, -0.65, 0.1, arm);
    const elbow = new THREE.Group(); elbow.position.set(0, -1.3, 0); arm.add(elbow); cyl(0.22, 0.55, frame, 0, 0, 0, elbow, 0, PI / 2);
    box(0.68, 1.15, 0.74, white, 0, -0.7, 0.02, elbow); box(0.5, 0.25, 0.5, frame, 0, -1.35, 0, elbow); box(0.5, 0.5, 0.56, frame, 0, -1.68, 0.02, elbow); box(0.12, 0.6, 0.05, accent, s * 0.33, -0.7, 0.2, elbow);
    return { mount, arm, elbow, pad, s }; });
  /* the head: twin gold crests, a visor, cheek guards; it sinks into the shoulders and lends the projector its lens */
  const head = new THREE.Group(); head.position.set(0, TH / 2, 0); torso.add(head);
  cyl(0.22, 0.4, frame, 0, 0.12, 0, head); box(0.74, 0.66, 0.76, white, 0, 0.5, 0.02, head); box(0.6, 0.16, 0.06, visor, 0, 0.56, 0.41, head); box(0.36, 0.18, 0.1, frame, 0, 0.3, 0.4, head); box(0.16, 0.06, 0.06, accent, 0, 0.84, 0.36, head);
  [-1, 1].forEach(s => { const c = box(0.08, 0.62, 0.05, gold, s * 0.22, 0.98, 0.38, head, 0.02); c.rotation.z = -s * 0.75; box(0.1, 0.4, 0.5, white, s * 0.43, 0.42, 0.05, head); cyl(0.04, 0.4, frame, s * 0.38, 0.95, -0.2, head); });
  /* the projector: a little telescopic arm in the head that comes out towards you, a lens on its tip that looks down */
  const pole = new THREE.Group(); pole.position.set(0, TH / 2 + 0.04, 0.16); torso.add(pole);
  const alu = std(0xc9ccd2, 0.2, 1), sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 16), alu); sleeve.rotation.x = PI / 2; pole.add(sleeve);
  const inner2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 12), alu); inner2.rotation.x = PI / 2; pole.add(inner2);
  const tip = new THREE.Group(); pole.add(tip); box(0.26, 0.14, 0.26, frame, 0, 0, 0, tip, 0.05);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 32), new THREE.MeshBasicMaterial({ color: 0x4fb8ff })); ring.rotation.x = PI / 2; ring.position.y = -0.075; tip.add(ring);
  pole.userData = { sleeve, inner: inner2, head: tip, ring }; pole.visible = false;
  /* the finished monitor's own shells, which close over the robot once it has transformed (Sam: nothing left of the toy):
     a back cover over the torso and each wing, one curved screen, a slim neck and a foot */
  const alu2 = detail(THREE, std(0x2b2d32, 0.32, 0.9), 3.5), skin = { torso: [], wings: [] };
  const grow = (p, g) => { const piv = new THREE.Group(); p.add(piv); piv.add(g); piv.scale.setScalar(0.001); piv.visible = false; return piv; };
  { const g = new THREE.Group(); box(TW + 0.04, TH + 0.02, 0.16, alu2, 0, 0, -TD / 2 - 0.66, g, 0.06); box(TW * 0.6, 0.05, 0.02, std(0x45484f, 0.3, 0.9), 0, 0.9, -TD / 2 - 0.75, g); [-1, 1].forEach(s => box(TW / 2 + 0.02, TH, 0.66, alu2, s * (TW / 4 + 0.01), 0, -TD / 2 - 0.33, g, 0.05)); skin.torso.push(grow(torso, g)); }
  /* the finished screen (Sam: one complete screen, no splits): a single curved panel with a hairline bezel that rolls
     out from the middle over the robot's three panels; the power button sits in its bottom bezel, right */
  const DW = TW + 2 * M.WW - 0.2, DH = TH - 0.08, DR = 9, DA = DW / 2 / DR, DZ = TD / 2 + 0.04;
  const arc = (th, v, off) => [Math.sin(th) * (DR - off), v, DZ + DR - Math.cos(th) * (DR - off)];
  const curved = (w, h, off, mat, uv) => { const g = grid(THREE, 64, 1, (i, j) => arc(-w / 2 / DR + (w / DR) * i, (j - 0.5) * h, off), false); if (uv) { const a = []; for (let i = 0; i <= 64; i++) for (let j = 0; j <= 1; j++) a.push(i / 64, j); g.setAttribute('uv', new THREE.Float32BufferAttribute(a, 2)); } return new THREE.Mesh(g, mat); };
  const display = new THREE.Group();
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0x030304, metalness: 0.3, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, envMap: ENV, side: THREE.DoubleSide });
  display.add(curved(DW + 0.1, DH + 0.1, -0.02, glassM)); const panelScr = curved(DW, DH, 0, screenMat, true); display.add(panelScr);
  /* its body: a thin curved shell behind the glass, closed top, bottom and ends, and a rounded bulge in the middle of
     its back where the neck meets it, with a light strip (Sam's Predator reference) */
  { const sh = alu2, T0 = -0.02, T1 = -0.15, hw = (DW + 0.1) / 2 / DR, hh = (DH + 0.1) / 2;
    display.add(curved(DW + 0.1, DH + 0.1, T1, sh));
    [-1, 1].forEach(sv => display.add(new THREE.Mesh(grid(THREE, 64, 1, (i, j) => arc(-hw + 2 * hw * i, sv * hh, T0 + (T1 - T0) * j), false), sh)));
    [-1, 1].forEach(sx => display.add(new THREE.Mesh(grid(THREE, 1, 1, (i, j) => arc(sx * hw, (j - 0.5) * 2 * hh, T0 + (T1 - T0) * i), false), sh)));
    const bulge = new THREE.Mesh(new RB(2.9, 2.1, 0.42, 4, 0.18), sh); bulge.position.set(0, -0.25, DZ + T1 - 0.18); display.add(bulge);
    for (let k = 0; k < 5; k++) { const v = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.025, 0.01), std(0x111215, 0.5, 0.6)); v.position.set(0, 0.45 - k * 0.09, DZ + T1 - 0.395); display.add(v); }
    const led = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.01), new THREE.MeshBasicMaterial({ color: 0x4fb8ff })); led.position.set(0, -1.05, DZ + T1 - 0.36); display.add(led); }
  /* a slim lip along the bottom bezel with the power button */
  const power = new THREE.Group(); { const p = arc(DA * 0.86, -DH / 2 - 0.035, -0.02); power.position.set(p[0], p[1], p[2]); power.rotation.y = -DA * 0.86; display.add(power); }
  { const ringM = new THREE.MeshBasicMaterial({ color: 0x4fb8ff }); const r = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 8, 28), ringM); power.add(r); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 20), std(0x16171a, 0.3, 0.8)); cap.rotation.x = PI / 2; power.add(cap);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); power.add(hit); power.userData.ring = ringM; }
  const dispP = grow(torso, display); skin.display = dispP;
  const dmarks = { left: new THREE.Object3D(), right: new THREE.Object3D(), top: new THREE.Object3D(), bottom: new THREE.Object3D() };
  dmarks.left.position.set(...arc(-DA, 0, 0)); dmarks.right.position.set(...arc(DA, 0, 0)); dmarks.top.position.set(...arc(0, DH / 2, 0)); dmarks.bottom.position.set(...arc(0, -DH / 2, 0)); Object.values(dmarks).forEach(o => display.add(o));
  /* black stand-ins on the glow layer only (rig.js sets the layer): they hide the glow of whatever is behind the monitor without glowing themselves */
  const occM = new THREE.MeshBasicMaterial({ color: 0x000000 }), occluders = [curved(DW + 0.1, DH + 0.1, -0.04, occM)]; display.add(occluders[0]);
  { const o = new THREE.Mesh(new RB(TW, TH, TD + 1.2, 1, 0.05), occM); o.position.z = -0.6; o.userData.keep = true; torso.add(o); occluders.push(o); }
  wings.forEach(w => { const g = new THREE.Group(); box(M.WW - 0.02, TH, 0.1, alu2, w.s * (M.WW / 2), 0, -0.36, g, 0.04); const piv = grow(w.slide, g); skin.wings.push(piv); });
  /* the neck and the foot stand on the ground: they are the mech root's, and line up with the monitor once it is one */
  const NH = M.cy - TH / 2 + 0.7, neck = new THREE.Group(); box(0.42, NH, 0.16, alu2, 0, NH / 2, 0, neck, 0.07); neck.rotation.x = -0.06; box(0.06, NH * 0.7, 0.01, std(0x45484f, 0.3, 0.9), 0, NH * 0.45, 0.103, neck);
  /* the foot, like Sam's Predator: a small hub and three long slim legs splayed across the desk */
  const foot = new THREE.Group(); box(0.62, 0.1, 0.5, alu2, 0, 0.06, -0.1, foot, 0.04);
  [[-1, 1.0, 2.5], [1, 1.0, 2.5], [0, PI, 1.25]].forEach(([sx, a, len]) => { const leg = new THREE.Group(); leg.position.set(0, 0.07, -0.1); leg.rotation.y = sx ? sx * a : a; foot.add(leg);
    const bar = box(0.13, 0.05, len, alu2, 0, 0, len / 2, leg, 0.022); bar.rotation.x = 0.025; const tip = box(0.16, 0.03, 0.18, std(0x45484f, 0.3, 0.9), 0, -0.03, len - 0.05, leg, 0.012); void tip; });
  const neckP = grow(root, neck); neckP.position.set(0, 0.08, -0.2); const footP = grow(root, foot); footP.position.set(0, 0, 0.0); skin.neck = neckP; skin.foot = footP;
  /* the pelvis's own armour, which folds away into the foot */
  skin.pelvis = pelvis.children.filter(c => c.isMesh); skin.spine = spine.children.filter(c => c.isMesh);
  root.traverse(o => { if (o.isMesh) o.userData.noParticles = true; });
    /* a small logo in the middle of the bottom bezel */
  { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#9a9ea8'; g.font = '600 40px "Archivo", "Geist", Arial, sans-serif'; g.textAlign = 'center'; g.letterSpacing = '12px'; g.fillText('STUDIUM', 256, 46); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.078), new THREE.MeshBasicMaterial({ map: t, transparent: true })); logo.position.set(0, -DH / 2 - 0.028, DZ + 0.004); display.add(logo); }
  const housing = torso.children.filter(c => c.isMesh && c.userData.keep && c !== scrC);
  return { root, pelvis, legs, spine, torso, wings, arms, head, screenMat, marks: dmarks, pole, visor, white, skin, power, occluders, panels: [scrC], housing, detailMats: [alu2, frame] };
}

/* the Blender model (tools/mech_blender.py) dresses the mech: each v_<joint> mesh replaces the stand-in boxes on its
   joint, in the dark finish that matches the PC (Sam: a sleek modern Gundam, dark). The screen, its housing and the
   finished monitor's shells stay as they are. */
export function dressMech(THREE, ENV, mech, gltf) {
  const phys = (c, m, r, cc) => new THREE.MeshPhysicalMaterial({ color: c, metalness: m, roughness: r, clearcoat: cc, clearcoatRoughness: 0.12, envMap: ENV, envMapIntensity: 1.0 });
  const glowM = new THREE.MeshBasicMaterial({ color: 0x4fd8ff });
  const MATS = { armor: detail(THREE, phys(0x2a2d33, 0.65, 0.3, 0.8), 2.2), armor2: detail(THREE, phys(0x15171b, 0.6, 0.38, 0.4), 2.6), frame: detail(THREE, phys(0x0b0b0e, 0.7, 0.45, 0), 3), metal: phys(0xb8bcc4, 1, 0.18, 0), glow: glowM, visor: mech.visor, red: new THREE.MeshBasicMaterial({ color: 0xff3a24 }) };
  const J = { pelvis: mech.pelvis, spine: mech.spine, torso: mech.torso, head: mech.head };
  mech.legs.forEach((l, i) => { const n = i ? 'R' : 'L'; J['hip' + n] = l.hip; J['knee' + n] = l.knee; J['ankle' + n] = l.ankle; });
  mech.arms.forEach((a, i) => { const n = i ? 'R' : 'L'; J['mount' + n] = a.mount; J['pad' + n] = a.pad; J['arm' + n] = a.arm; J['elbow' + n] = a.elbow; });
  mech.wings.forEach((w, i) => { J['wing' + (i ? 'R' : 'L')] = w.slide; });
  /* out with the stand-ins: every plain mesh on a joint, unless it is part of the monitor */
  Object.values(J).forEach(g => [...g.children].forEach(c => { if ((c.isMesh && !c.userData.keep) || c.userData.toy) g.remove(c); }));
  const glow = [];
  gltf.scene.traverse(o => { if (o.isMesh) { const m = MATS[o.material && o.material.name] || MATS.armor; if (m === glowM) glow.push(o); o.material = m; o.userData.noParticles = true; } });
  const N = {}; Object.keys(J).forEach(n => { N[n] = gltf.scene.getObjectByName('v_' + n); });   /* found before they move: once on a joint they are no longer in the glTF scene */
  Object.entries(J).forEach(([n, g]) => { const node = N[n]; if (!node) return; node.position.set(0, 0, 0); node.rotation.set(0, 0, 0); node.scale.set(1, 1, 1); g.add(node); });
  mech.skin.pelvis = [N.pelvis].filter(Boolean); mech.skin.spine = [N.spine].filter(Boolean);
  mech.glowM = glowM; return glow;
}
