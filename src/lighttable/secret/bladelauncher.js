// BLADE LAUNCHER: the ripper, modelled on Sam's photo of a real grip launcher, piece by piece.
//   housing   a two-tone body: the coloured shell with stepped side blocks, two knobs, a screw boss and a trigger lever,
//             a black top plate with moulded "IN" arrows, ribs and the round launch port (two prongs, a dark well)
//   grip      an S-curved handle: a raised rim round a recessed panel, finger holes, a knurled pad, printed stickers
//             (RIP GRIP, an emblem, the STUDIUM badge, a red swoosh round a button) and a lanyard loop at the foot
//   cord      a flat ripcord with real teeth along both edges (alpha-cut), out of the right side
//   handle    the winged pull handle, layered, with a cut-out in the middle
// Built lying flat: y up, the grip reaching towards +z (towards you), the cord out along +x. Units match the old stand-in
// (the housing about 1.8 across), so the game places it the same way. API: { g, setCord(len), dispose() }.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), c); return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
/* a flat outline extruded up from y = y0 (shape y becomes -z, so a shape drawn "down the page" reaches towards you) */
const slab = (shape, depth, bevel = 0.02, segs = 2) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: segs, curveSegments: 24 }).rotateX(-Math.PI / 2);
const rrect = (x0, y0, x1, y1, r) => { const s = new THREE.Shape(); s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0); return s; };
const circ = (x, y, r, cw) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, TAU, !!cw); return p; };

/* shared textures (made once) */
let T0 = null;
function textures() {
  if (T0) return T0;
  /* fine moulding noise for every plastic, as a bump map */
  const grain = tex(canvas(256, 256, g => { const d = g.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = 118 + Math.random() * 20; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }), false);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(4, 4);
  /* diamond knurling for the grip pad */
  const knurl = tex(canvas(128, 128, g => { g.fillStyle = '#444'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ddd'; for (let y = 0; y < 128; y += 8) for (let x = (y / 8) % 2 * 4; x < 128; x += 8) { g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 3, y); g.lineTo(x, y + 3); g.lineTo(x - 3, y); g.closePath(); g.fill(); } }), false);
  knurl.wrapS = knurl.wrapT = THREE.RepeatWrapping; knurl.repeat.set(3, 1.4);
  /* the black top plate's moulded markings: IN arrows, a ring of ticks, ribs */
  const plate = tex(canvas(512, 512, g => { g.fillStyle = '#1b1b20'; g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#2a2a31'; for (let k = 0; k < 6; k++) g.fillRect(40, 60 + k * 14, 70, 6); for (let k = 0; k < 6; k++) g.fillRect(402, 60 + k * 14, 70, 6);
    g.fillStyle = '#9a9aa6'; g.font = '700 30px sans-serif'; g.save(); g.translate(64, 230); g.rotate(-Math.PI / 2); g.fillText('◂ IN', -40, 10); g.restore(); g.save(); g.translate(452, 230); g.rotate(Math.PI / 2); g.fillText('◂ IN', -40, 10); g.restore();
    g.font = '700 22px sans-serif'; g.fillText('◂ IN ▸', 205, 470); g.strokeStyle = '#33333b'; g.lineWidth = 3; for (let k = 0; k < 36; k++) { const a = k / 36 * TAU; g.beginPath(); g.moveTo(256 + Math.cos(a) * 168, 256 + Math.sin(a) * 168); g.lineTo(256 + Math.cos(a) * 180, 256 + Math.sin(a) * 180); g.stroke(); }
    g.fillStyle = '#e84a2a'; g.beginPath(); g.moveTo(256, 418); g.lineTo(268, 440); g.lineTo(244, 440); g.closePath(); g.fill(); }));
  /* the ripcord: teeth along both edges, cut by alpha */
  const cord = tex(canvas(64, 32, g => { g.clearRect(0, 0, 64, 32); g.fillStyle = '#fff'; g.fillRect(0, 7, 64, 18); for (let x = 0; x < 64; x += 8) { g.fillRect(x + 1, 2, 5, 6); g.fillRect(x + 1, 24, 5, 6); } g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < 64; x += 8) g.fillRect(x + 6, 7, 1, 18); }));
  cord.wrapS = THREE.RepeatWrapping;
  /* stickers */
  const ez = tex(canvas(512, 160, g => { g.fillStyle = '#121218'; g.beginPath(); g.moveTo(30, 0); g.lineTo(512, 0); g.lineTo(482, 160); g.lineTo(0, 160); g.closePath(); g.fill();
    g.fillStyle = '#f5d321'; g.font = 'italic 900 120px sans-serif'; g.fillText('RIP', 36, 128); g.fillStyle = '#fff'; g.font = '800 44px sans-serif'; g.fillText('GRIP', 270, 70); g.font = '600 20px sans-serif'; g.fillText('CORE SYSTEM', 272, 104);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(270, 82); g.lineTo(470, 82); g.stroke(); }));
  const badge = tex(canvas(256, 200, g => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(128, 80, 118, 64, 0, 0, TAU); g.fill(); g.fillStyle = '#1d3f9a'; g.beginPath(); g.ellipse(128, 80, 104, 52, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(128, 80, 92, 42, 0, 0, TAU); g.fill(); g.fillStyle = '#1d3f9a'; g.font = '900 40px sans-serif'; g.textAlign = 'center'; g.fillText('STUDIUM', 128, 94);
    g.fillStyle = '#fff'; g.font = '800 26px sans-serif'; g.fillText('BLADES', 128, 176); }));
  const emblem = tex(canvas(256, 256, g => { g.clearRect(0, 0, 256, 256); g.fillStyle = '#e9edf5'; g.translate(128, 128);
    /* a stylised winged head, drawn as sharp swept strokes */
    for (let s of [-1, 1]) { g.beginPath(); g.moveTo(0, -10); g.quadraticCurveTo(s * 70, -70, s * 118, -40); g.quadraticCurveTo(s * 70, -40, s * 40, 0); g.quadraticCurveTo(s * 90, -10, s * 112, 20); g.quadraticCurveTo(s * 60, 10, s * 26, 30); g.closePath(); g.fill(); }
    g.beginPath(); g.moveTo(0, -40); g.lineTo(20, 10); g.lineTo(0, 60); g.lineTo(-20, 10); g.closePath(); g.fill(); g.fillStyle = '#e84a2a'; g.beginPath(); g.arc(-7, 2, 4, 0, TAU); g.arc(7, 2, 4, 0, TAU); g.fill(); }));
  const swoosh = tex(canvas(256, 128, g => { g.clearRect(0, 0, 256, 128); g.fillStyle = '#e23b25'; g.beginPath(); g.moveTo(10, 100); g.quadraticCurveTo(120, 10, 246, 30); g.quadraticCurveTo(150, 40, 130, 70); g.quadraticCurveTo(60, 70, 10, 100); g.fill(); }));
  return (T0 = { grain, knurl, plate, cord, ez, badge, emblem, swoosh });
}

/* the grip's outline in page units (y down the page is towards you), traced from the photo: an S with finger curves */
function gripShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.55, -0.6); s.lineTo(0.62, -0.6);
  s.bezierCurveTo(0.7, -1.0, 0.85, -1.35, 0.78, -1.75); s.bezierCurveTo(0.7, -2.15, 0.48, -2.25, 0.5, -2.6); s.bezierCurveTo(0.52, -2.95, 0.78, -3.05, 0.72, -3.4);
  s.bezierCurveTo(0.66, -3.7, 0.3, -3.8, -0.05, -3.78); s.bezierCurveTo(-0.45, -3.76, -0.62, -3.55, -0.6, -3.2);
  s.bezierCurveTo(-0.58, -2.8, -0.3, -2.5, -0.28, -2.1); s.bezierCurveTo(-0.26, -1.7, -0.58, -1.45, -0.6, -1.1); s.lineTo(-0.55, -0.6); return s;
}
/* the same outline drawn in, for the raised rim's inner edge */
function insetPts(shape, k, cx, cy) { return shape.getPoints(24).map(p => new THREE.Vector2(cx + (p.x - cx) * k, cy + (p.y - cy) * k)); }

export function makeLauncher(col, ENV) {
  const X = textures(), g = new THREE.Group(), own = [], base = new THREE.Color(col);
  const keep = m => { own.push(m.geometry); return m; };
  const plast = new THREE.MeshPhysicalMaterial({ color: base, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, bumpMap: X.grain, bumpScale: 0.6, envMap: ENV, envMapIntensity: 0.7 });
  const plastDk = new THREE.MeshPhysicalMaterial({ color: base.clone().multiplyScalar(0.72), roughness: 0.48, clearcoat: 0.2, bumpMap: X.grain, bumpScale: 0.6, envMap: ENV, envMapIntensity: 0.6 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x1b1b20, roughness: 0.55, clearcoat: 0.15, bumpMap: X.grain, bumpScale: 0.4, envMap: ENV, envMapIntensity: 0.5 });
  const plateM = new THREE.MeshPhysicalMaterial({ map: X.plate, roughness: 0.6, clearcoat: 0.1, envMap: ENV, envMapIntensity: 0.4 });
  const holeM = new THREE.MeshBasicMaterial({ color: 0x050507 }), redM = new THREE.MeshPhysicalMaterial({ color: 0xc8301e, roughness: 0.35, clearcoat: 0.6, envMap: ENV });
  const sticker = t => new THREE.MeshPhysicalMaterial({ map: t, transparent: true, alphaTest: 0.05, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1, envMap: ENV, envMapIntensity: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
  const knurlM = new THREE.MeshPhysicalMaterial({ color: base.clone().multiplyScalar(0.85), roughness: 0.55, bumpMap: X.knurl, bumpScale: 3, envMap: ENV, envMapIntensity: 0.5 });
  const mats = [plast, plastDk, black, plateM, holeM, redM, knurlM];
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = keep(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); g.add(m); return m; };
  const decal = (t, w, h, x, y, z, rot = 0) => { const m = add(new THREE.PlaneGeometry(w, h), sticker(t), x, y, z); m.rotation.set(-Math.PI / 2, 0, rot); mats.push(m.material); return m; };

  /* ---- housing: the coloured shell, stepped, with the black plate on top ---- */
  add(new RoundedBoxGeometry(1.8, 0.42, 1.55, 4, 0.1), plast, 0, 0.21, 0);
  add(new RoundedBoxGeometry(1.62, 0.08, 1.4, 3, 0.03), plastDk, 0, 0.44, 0.02);
  { const top = rrect(-0.66, -0.68, 0.66, 0.66, 0.12); top.holes.push(circ(0, 0, 0.42, true)); const pm = add(slab(top, 0.08, 0.015), plateM, 0, 0.47, 0);
    const uv = pm.geometry.attributes.uv, p = pm.geometry.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.32 + 0.5, -p.getZ(i) / 1.32 + 0.5); }
  /* the launch port: a raised ring, a dark well, two prongs */
  { const ring = new THREE.Shape(); ring.absarc(0, 0, 0.46, 0, TAU, false); ring.holes.push(circ(0, 0, 0.38, true)); add(slab(ring, 0.07, 0.015), black, 0, 0.5, 0); }
  /* a dark well down into the housing: its wall and floor (the blade locks in here) */
  add(new THREE.CylinderGeometry(0.38, 0.38, 0.01, 48), holeM, 0, 0.49, 0); add(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x0c0c10, side: THREE.BackSide }), 0, 0.53, 0);
  [0, 1, 2].forEach(k => { const a = k / 3 * TAU + 0.5, lug = add(new RoundedBoxGeometry(0.1, 0.05, 0.06, 2, 0.015), black, Math.cos(a) * 0.33, 0.49, Math.sin(a) * 0.33); lug.rotation.y = -a; });
  [-1, 1].forEach(s => { add(new RoundedBoxGeometry(0.07, 0.12, 0.1, 2, 0.02), black, s * 0.16, 0.6, -0.43); add(new RoundedBoxGeometry(0.14, 0.05, 0.05, 2, 0.015), black, s * 0.3, 0.52, 0.38); });
  /* side blocks, knobs and a screw boss on the left; the cord exit on the right */
  add(new RoundedBoxGeometry(0.22, 0.3, 0.5, 3, 0.05), plastDk, -0.97, 0.2, -0.25); add(new RoundedBoxGeometry(0.18, 0.24, 0.28, 3, 0.04), plast, -0.99, 0.18, 0.28);
  [[-1.1, 0.24, -0.38], [-1.08, 0.2, 0.28]].forEach(([x, y, z]) => { const k = add(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 24), plast, x, y, z); k.rotation.z = Math.PI / 2; const cap = add(new THREE.CylinderGeometry(0.075, 0.085, 0.03, 24), plastDk, x - 0.09, y, z); cap.rotation.z = Math.PI / 2; });
  { const boss = add(new THREE.CylinderGeometry(0.11, 0.12, 0.36, 24), plast, -0.82, 0.18, 0.72); add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), holeM, -0.82, 0.37, 0.72); }
  /* the trigger lever, hooked down the left side */
  { const t = new THREE.Shape(); t.moveTo(0, 0); t.bezierCurveTo(-0.25, -0.05, -0.38, -0.25, -0.32, -0.5); t.lineTo(-0.2, -0.46); t.bezierCurveTo(-0.24, -0.28, -0.12, -0.16, 0.04, -0.14); t.closePath(); add(slab(t, 0.18, 0.025), plast, -0.78, 0.06, 0.62); }
  add(new RoundedBoxGeometry(0.24, 0.34, 0.42, 3, 0.05), plastDk, 0.98, 0.2, -0.1);
  add(new THREE.BoxGeometry(0.04, 0.06, 0.2), holeM, 1.1, 0.24, -0.1);
  /* stickers on the housing: RIP GRIP across the front edge, a small red arrow */
  decal(X.ez, 0.78, 0.245, -0.18, 0.562, 0.52);

  /* ---- the grip: a shell, a raised rim round a recessed panel, finger holes, a knurled pad, stickers, a lanyard loop ---- */
  const GS = gripShape(); add(slab(GS, 0.3, 0.05, 3), plast, 0, 0.04, 0);
  { const rim = new THREE.Shape(GS.getPoints(24)); rim.holes.push(new THREE.Path(insetPts(GS, 0.82, 0.05, -2.15).reverse())); add(slab(rim, 0.08, 0.025, 2), plast, 0, 0.36, 0); }
  [[0.12, -1.55], [0.2, -2.05], [-0.02, -2.75], [0.1, -3.15]].forEach(([x, y]) => { add(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 20), holeM, x, 0.395, -y); });
  { const pad = add(new THREE.PlaneGeometry(0.62, 0.3), knurlM, 0.03, 0.4, 0.95); pad.rotation.x = -Math.PI / 2; }
  decal(X.emblem, 0.5, 0.5, 0.15, 0.402, 1.3, 0.2); decal(X.badge, 0.62, 0.48, 0.05, 0.402, 2.45); decal(X.swoosh, 0.62, 0.3, -0.08, 0.402, 3.3, 0.1);
  add(new THREE.CylinderGeometry(0.1, 0.11, 0.08, 24), plast, 0.14, 0.44, 3.32);
  { const loop = add(new THREE.TorusGeometry(0.1, 0.035, 10, 24), plast, 0.72, 0.18, 3.55); loop.rotation.x = Math.PI / 2; }
  add(new RoundedBoxGeometry(0.5, 0.22, 0.2, 3, 0.05), plastDk, -0.05, 0.13, 3.72);

  /* ---- the ripcord and its winged handle ---- */
  const cordM = new THREE.MeshPhysicalMaterial({ map: X.cord.clone(), color: base.clone().lerp(new THREE.Color(0xffffff), 0.1), alphaTest: 0.5, transparent: false, roughness: 0.5, side: THREE.DoubleSide, envMap: ENV, envMapIntensity: 0.5 });
  cordM.map.needsUpdate = true; mats.push(cordM);
  const cord = add(new THREE.PlaneGeometry(1, 0.16).translate(0.5, 0, 0), cordM, 1.1, 0.24, -0.1); cord.rotation.x = -Math.PI / 2;
  const hs = new THREE.Shape(); [[0, -0.07], [0.3, -0.08], [0.42, -0.36], [0.62, -0.42], [0.55, -0.3], [0.5, -0.12], [0.7, -0.1], [0.82, -0.26], [0.98, -0.3], [0.9, -0.12], [1.02, 0], [0.9, 0.12], [0.98, 0.3], [0.82, 0.26], [0.7, 0.1], [0.5, 0.12], [0.55, 0.3], [0.62, 0.42], [0.42, 0.36], [0.3, 0.08], [0, 0.07]]
    .forEach(([x, y], i) => i ? hs.lineTo(x, y) : hs.moveTo(x, y));
  { const cut = new THREE.Path(); [[0.52, 0], [0.62, -0.06], [0.74, 0], [0.62, 0.06]].forEach(([x, y], i) => i ? cut.lineTo(x, y) : cut.moveTo(x, y)); hs.holes.push(cut); }
  const handle = new THREE.Group(); g.add(handle);
  { const h1 = keep(new THREE.Mesh(slab(hs, 0.07, 0.02, 2), plast)); handle.add(h1);
    const ridge = new THREE.Shape(insetPts(hs, 0.8, 0.55, 0)); const h2 = keep(new THREE.Mesh(slab(ridge, 0.03, 0.01, 1), plastDk)); h2.position.y = 0.09; handle.add(h2); }
  const L = { g,
    setCord(len) { const l = Math.max(0.12, len); cord.scale.x = l; cordM.map.repeat.set(l * 6, 1); handle.position.set(1.1 + l, 0.2, -0.1); },
    dispose() { own.forEach(x => x.dispose()); mats.forEach(m => m.dispose()); cordM.map.dispose(); g.removeFromParent(); } };
  L.setCord(0.12); return L;
}
