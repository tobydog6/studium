// VAULT: the miniature case by the binder opens the real vault in the middle of the table. Sam's picks (Round 2
// page): a ribbed polymer hard case with graphite hardware, a round opening in the table that works as a lift (a
// disc of the table sinks into a lit shaft, the case rides up on it), a backlit rubber keypad on the front.
// Everything here is procedural three.js built once at install and kept hidden until the VAULT event.
//
// States (all on S.M; index.js sends VAULT from idle and CLOSE on =):
//   vault.open      camera in, prints swept out of the way, the opening, the lift down and up with the case.
//   vault.case      the case stands on the table, lid shut. Click the keypad → vault.keypad; the button → vault.tobinder.
//   vault.keypad    camera on the keypad; keys by click or keyboard; the code is S.store.get().code (1234).
//   vault.lid       the lid is open and the vault's slabs stand inside; hover, click → S.inspect; 'Onto the table'.
//   vault.tobinder  the case dissolves into binder.js's binder (if it is built) and hands over to vault.binder.
//   vault.closing   everything reverses from wherever it was; S.hole.close(); S.cam.pop(); idle.
// Test hooks: S.vault.openKeypad(), S.vault.key('1'), S.vault.close(), S.vault.caseBack() (for binder.js).
import * as THREE from 'three';
import * as binder from './binder.js';

const CX = -0.3, CZ = 0.3, R = 2.15;                 /* the opening: centre on the table and radius */
const W = 3.3, D = 2.3, HB = 1.45, HL = 0.85, WD = 0.45;   /* the case: width, depth, body and lid heights, well depth */
const DOWN = -2.75, SHAFT = 3.7, CASE_Y = 0.1;       /* how far the lift sinks, the shaft depth, the case's seat on the disc */
const KX = 0.5, KY = HB * 0.5, KS = 0.3;             /* the keypad on the front: position and scale */
const BX_BTN = -0.6;                                 /* the "To binder" button on the front */
const SLAB_K = 0.25, ROW_Z = [0.6, 0.05, -0.5], ROW_H = [0, 0.36, 0.72], LEAN = 0.38;
const TABLE_COL = () => new THREE.Color(0.95, 0.95, 0.94);   /* the surface shader's uCol, linear */

export function install(S) {
  const { T, M, P, store, RoundedBoxGeometry } = S, E = T.E, ctx = S.ctx;
  const ENV = S.SM.envMap(S.renderer);
  const stdM = (c, r, m, o) => new THREE.MeshStandardMaterial({ color: c, roughness: r ?? 0.5, metalness: m ?? 0, envMap: ENV, envMapIntensity: m > 0.3 ? 1.2 : 0.35, ...(o || {}) });
  const GRAPHITE = () => stdM(0x4a4c50, 0.5, 0.75, { envMapIntensity: 0.6 }), RUBBER = () => stdM(0x111111, 0.95, 0), ALU = () => stdM(0xd8d9dc, 0.3, 0.9), RED = () => stdM(0xb8302a, 0.35, 0.8);
  const box = (w, h, d, mat, x, y, z, parent, r) => { const m = new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const text = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), c); return S.SM.tex(c); };
  const stencil = (t, sub, col, bg) => text(512, 160, g => { g.fillStyle = bg || 'rgba(0,0,0,0)'; g.fillRect(0, 0, 512, 160); g.fillStyle = col; g.font = '700 64px "Geist", sans-serif'; g.textAlign = 'center'; g.fillText(t, 256, 78); g.font = '500 26px "Geist Mono", monospace'; g.fillText(sub, 256, 124); });

  /* ---------- the opening: a cover that turns the shader's rect hole round, a trim ring, the lit shaft, the lift ---------- */
  const rig = new THREE.Group(); rig.position.set(CX, 0, CZ); rig.visible = false; ctx.scene.add(rig);
  const cover = (() => { const s = new THREE.Shape(), e = R + 0.08; s.moveTo(-e, -e); s.lineTo(e, -e); s.lineTo(e, e); s.lineTo(-e, e); s.closePath(); const h = new THREE.Path(); h.absarc(0, 0, R, 0, Math.PI * 2, true); s.holes.push(h);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 64), new THREE.MeshBasicMaterial({ color: TABLE_COL() })); m.rotation.x = -Math.PI / 2; m.position.y = 0.003; return m; })();
  rig.add(cover);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.028, 8, 96), GRAPHITE()); trim.rotation.x = Math.PI / 2; trim.position.y = 0.012; rig.add(trim);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(R, R, SHAFT, 64, 1, true), new THREE.MeshLambertMaterial({ color: 0x4a4744, side: THREE.BackSide })); shaft.position.y = -SHAFT / 2; rig.add(shaft);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshLambertMaterial({ color: 0x23211f })); floor.rotation.x = -Math.PI / 2; floor.position.y = -SHAFT + 0.01; rig.add(floor);
  const lamp = new THREE.PointLight(0xffe2b0, 0, 7, 1.6); lamp.position.set(0, -0.9, 0); rig.add(lamp);
  const lift = new THREE.Group(); rig.add(lift);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.035, R - 0.035, 0.1, 64), [new THREE.MeshLambertMaterial({ color: 0x1b1a19 }), new THREE.MeshBasicMaterial({ color: TABLE_COL() }), new THREE.MeshLambertMaterial({ color: 0x1b1a19 })]); disc.position.y = -0.05; lift.add(disc);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.6, 20), stdM(0x3a3c40, 0.5, 0.7)); post.position.y = -1.9; lift.add(post);
  const caseShadow = S.shadow(W + 1.2, D + 1.2); caseShadow.position.set(0.1, 0.004, 0.15); lift.add(caseShadow);

  /* ---------- the case ---------- */
  const V = { group: null, lid: null, kp: null, btn: null, well: null, style: null, kstyle: null, slabs: [], hover: null, pushed: false, lidA: 0, lidOpen: false, inspecting: false, kpKeys: [] };
  function buildCase() {
    if (V.group) { lift.remove(V.group); V.group.traverse(m => { if (m.isMesh) { m.geometry.dispose(); [].concat(m.material).forEach(mt => { if (mt.map) mt.map.dispose(); mt.dispose(); }); } }); }
    const style = S.dev.opt('case') || 'pelican', ks = S.dev.opt('keypad') || 'rubber'; V.style = style; V.kstyle = ks;
    const g = new THREE.Group(), lid = new THREE.Group(); g.position.y = CASE_Y; V.group = g; V.lid = lid; lift.add(g);
    const carbonTex = () => { const t = text(256, 256, gg => { gg.fillStyle = '#17181a'; gg.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 8) for (let x = 0; x < 256; x += 8) { const k = ((x / 8 + Math.floor(y / 8)) % 2); gg.fillStyle = k ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.35)'; gg.fillRect(x, y, 8, 4); gg.fillStyle = k ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.09)'; gg.fillRect(x, y + 4, 8, 4); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 4); return t; };
    const shell = style === 'flight' ? stdM(0x141414, 0.7, 0.05) : style === 'carbon' ? new THREE.MeshStandardMaterial({ map: carbonTex(), roughness: 0.3, metalness: 0.2, envMap: ENV, envMapIntensity: 0.8 }) : stdM(0x1f1f1f, 0.88, 0.02);
    const rr = style === 'pelican' ? 0.12 : style === 'carbon' ? 0.06 : 0.03, hard = style === 'pelican' ? GRAPHITE : style === 'carbon' ? () => stdM(0x3a3c40, 0.35, 0.9) : ALU;
    /* the body: a solid lower half and four walls round a well, so the slabs stand inside it */
    box(W, HB - WD, D, shell, 0, (HB - WD) / 2, 0, g, rr);
    [-1, 1].forEach(s => box(W, WD, 0.14, shell, 0, HB - WD / 2, s * (D / 2 - 0.07), g, 0.03)); [-1, 1].forEach(s => box(0.14, WD, D - 0.28, shell, s * (W / 2 - 0.07), HB - WD / 2, 0, g, 0.03));
    const foam = stdM(0x141414, 0.98, 0); box(W - 0.28, 0.04, D - 0.28, foam, 0, HB - WD + 0.02, 0, g);
    ROW_H.forEach((h, i) => { if (h > 0) box(W - 0.34, h, 0.5, foam, 0, HB - WD + h / 2, ROW_Z[i], g); });
    /* the lid, hinged along the back edge */
    lid.position.set(0, HB, -D / 2); box(W, HL, D, shell, 0, HL / 2, D / 2, lid, rr); g.add(lid);
    if (style === 'pelican') {
      for (let i = -2; i <= 2; i++) box(W + 0.06, 0.09, 0.14, stdM(0x111111, 0.9), 0, HL + 0.02, D / 2 + i * 0.42, lid, 0.03);
      [-1, 1].forEach(sx => [1.43, 1.05].forEach(x => box(0.14, HB - WD - 0.16, D + 0.06, stdM(0x111111, 0.9), sx * x, (HB - WD) / 2, 0, g, 0.03)));
      [-1, 1].forEach(sx => { const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 20), GRAPHITE()); h.position.set(sx * 1.5, HB + 0.02, D / 2 + 0.02); g.add(h); });
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 10, 40, Math.PI), RUBBER()); handle.position.set(0, HL + 0.05, D / 2); handle.rotation.x = -Math.PI / 2; lid.add(handle); [-1, 1].forEach(sx => box(0.16, 0.12, 0.2, GRAPHITE(), sx * 0.55, HL + 0.04, D / 2, lid, 0.03));
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.36), new THREE.MeshBasicMaterial({ map: stencil('STUDIUM', 'GRADED · KEEP DRY', '#1a1200', '#e3ad57') })); lab.rotation.x = -Math.PI / 2; lab.position.set(0.85, HL + 0.075, D / 2 + 0.7); lid.add(lab);
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => box(0.5, 0.1, 0.5, RUBBER(), sx * (W / 2 - 0.45), -0.05, sz * (D / 2 - 0.45), g, 0.03)));
    } else {
      const rail = hard(), r = 0.08, edges = (parent, h) => { [-1, 1].forEach(sz => [0, h].forEach(y => box(W + r, r, r, rail, 0, y, sz * D / 2, parent, 0.02))); [-1, 1].forEach(sx => [0, h].forEach(y => box(r, r, D + r, rail, sx * W / 2, y, 0, parent, 0.02))); [-1, 1].forEach(sx => [-1, 1].forEach(sz => box(r, h, r, rail, sx * W / 2, h / 2, sz * D / 2, parent, 0.02))); };
      edges(g, HB); const le = new THREE.Group(); le.position.z = D / 2; lid.add(le); edges(le, HL);
      if (style === 'flight') [-1, 1].forEach(sx => [-1, 1].forEach(sz => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), rail); b.position.set(sx * W / 2, 0.08, sz * D / 2); g.add(b); const t = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), rail); t.position.set(sx * W / 2, HL, D / 2 + sz * D / 2); lid.add(t); }));
      box(0.9, 0.08, 0.3, RUBBER(), 0, HL + 0.04, D / 2, lid, 0.03);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.46), new THREE.MeshBasicMaterial({ map: stencil(style === 'carbon' ? 'SECRET' : 'STUDIUM', style === 'carbon' ? 'STUDIUM · DO NOT OPEN' : 'FRAGILE · THIS WAY UP', style === 'carbon' ? 'rgba(220,60,50,0.95)' : 'rgba(230,224,210,0.9)'), transparent: true })); lab.rotation.x = -Math.PI / 2; lab.position.set(0.5, HL + 0.045, D / 2 + 0.75); lid.add(lab);
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => box(0.4, 0.08, 0.4, RUBBER(), sx * (W / 2 - 0.4), -0.04, sz * (D / 2 - 0.4), g, 0.02)));
    }
    /* latches over the seam, a pressure valve, the keypad and the binder button on the front */
    const latchM = style === 'carbon' ? RED : hard;
    [-1.22, 1.22].forEach(x => { box(0.5, 0.58, 0.1, latchM(), x, HB - 0.14, D / 2 + 0.06, g, 0.04); box(0.36, 0.24, 0.12, latchM(), x, HB - 0.06, D / 2 + 0.13, g, 0.05); box(0.3, 0.06, 0.16, latchM(), x, HB - 0.34, D / 2 + 0.12, g, 0.02); });
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 24), hard()); valve.rotation.x = Math.PI / 2; valve.position.set(-1.33, HB * 0.3, D / 2 + 0.04); g.add(valve); const vc = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.1, 24), stdM(0x222222, 0.6)); vc.rotation.x = Math.PI / 2; vc.position.set(-1.33, HB * 0.3, D / 2 + 0.08); g.add(vc);
    buildKeypad(g, ks); buildButton(g);
    g.traverse(m => { if (m.isMesh) m.userData.vault = true; });
    lid.rotation.x = -1.55 * V.lidA;
  }
  /* the keypad (Vault Designs page, keypadRig): a plate, an LCD strip, twelve keys; rubber keys are backlit through their legend */
  function buildKeypad(parent, style) {
    const g = new THREE.Group(); g.scale.setScalar(KS); g.position.set(KX, KY, D / 2 + 0.1 * KS); parent.add(g); V.kp = g; V.kpKeys = [];
    const body = style === 'brass' ? stdM(0xc09a48, 0.3, 0.85) : style === 'glass' ? new THREE.MeshPhysicalMaterial({ color: 0xdfe6ea, transparent: true, opacity: 0.5, roughness: 0.65, clearcoat: 0.6, envMap: ENV }) : stdM(0x1a1918, 0.9, 0);
    const plate = new THREE.Mesh(new RoundedBoxGeometry(2.6, 3.3, 0.2, 4, 0.08), body); g.add(plate); V.kpPlate = plate;
    if (style === 'glass') { const back = new THREE.Mesh(new RoundedBoxGeometry(2.7, 3.4, 0.08, 3, 0.06), stdM(0x101112, 0.7)); back.position.z = -0.14; g.add(back); }
    const dc = document.createElement('canvas'); dc.width = 512; dc.height = 128; const dt = S.SM.tex(dc); V.lcd = { c: dc, t: dt, style };
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.52), new THREE.MeshBasicMaterial({ map: dt })); disp.position.set(0, 1.22, 0.102); g.add(disp);
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '↵'];
    digits.forEach((d, i) => { const r = Math.floor(i / 3), col = i % 3;
      const tex = text(128, 128, gg => { if (style === 'rubber') { gg.fillStyle = '#2b2927'; gg.fillRect(0, 0, 128, 128); gg.fillStyle = '#f1ede4'; gg.shadowColor = '#fff'; gg.shadowBlur = 14; } else if (style === 'brass') { gg.fillStyle = '#c09a48'; gg.fillRect(0, 0, 128, 128); gg.fillStyle = '#2a1a08'; } else { gg.clearRect(0, 0, 128, 128); gg.fillStyle = '#1f2a33'; }
        gg.font = '500 64px "Geist Mono", monospace'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(d, 64, 68); });
      let key;
      if (style === 'brass') { key = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 28), stdM(0xc09a48, 0.3, 0.85)); key.rotation.x = Math.PI / 2; const face = new THREE.Mesh(new THREE.CircleGeometry(0.265, 28), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.8, envMap: ENV })); face.rotation.x = -Math.PI / 2; face.position.y = 0.061; key.add(face); }
      else if (style === 'glass') { key = new THREE.Mesh(new THREE.CircleGeometry(0.27, 32), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); const halo = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0 })); halo.position.z = -0.002; key.add(halo); key.userData.halo = halo; }
      else { const side = stdM(0x2b2927, 0.9); key = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.48, 0.14, 3, 0.05), [side, side, side, side, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55 }), side]); }
      key.userData.z0 = style === 'glass' ? 0.103 : 0.16; key.position.set((col - 1) * 0.72, 0.52 - r * 0.6, key.userData.z0); key.userData.digit = d; key.userData.press = 0; g.add(key); V.kpKeys.push(key); });
    V.code = ''; V.shake = 0; V.ok = 0; drawLCD();
  }
  function drawLCD() { const L = V.lcd; if (!L) return; const gg = L.c.getContext('2d'), s = L.style; gg.fillStyle = s === 'brass' ? '#1a0f06' : s === 'glass' ? '#edf3f6' : '#13201a'; gg.fillRect(0, 0, 512, 128);
    const col = V.ok > 0 ? (s === 'glass' ? '#1d9b5e' : '#7df0a4') : s === 'brass' ? '#ffb347' : s === 'glass' ? '#1f2a33' : '#a7e8c0'; gg.fillStyle = col; gg.shadowColor = col; gg.shadowBlur = s === 'glass' ? 0 : 18;
    gg.font = '500 72px "Geist Mono", monospace'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
    const code = V.code || '', shown = (code.split('').join(' ') + (code.length ? ' ' : '') + '_ '.repeat(4 - code.length)).trim();
    gg.fillText(V.ok > 0 ? 'OPEN' : V.shake > 0 ? 'NO' : shown, 256, 66); gg.shadowBlur = 0; L.t.needsUpdate = true; }
  /* the "To binder" button: a rubber cap in a graphite bezel, its name etched under it */
  function buildButton(parent) {
    const g = new THREE.Group(); g.position.set(BX_BTN, KY + 0.12, D / 2); parent.add(g); V.btn = g;
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.07, 28), GRAPHITE()); bezel.rotation.x = Math.PI / 2; bezel.position.z = 0.035; g.add(bezel);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.145, 0.09, 28), stdM(0x2b2927, 0.6, 0.05, { emissive: 0x3fcf7a, emissiveIntensity: 0.2 })); cap.rotation.x = Math.PI / 2; cap.position.z = 0.1; g.add(cap); g.userData.cap = cap; cap.userData.z0 = 0.1;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.16), new THREE.MeshBasicMaterial({ map: text(512, 102, gg => { gg.clearRect(0, 0, 512, 102); gg.fillStyle = 'rgba(241,237,228,0.8)'; gg.font = '600 54px "Geist Mono", monospace'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('TO BINDER', 256, 54); }), transparent: true })); lab.position.set(0, -0.33, 0.005); g.add(lab);
  }
  buildCase();
  S.dev.on('case', () => { if (!M.is('vault')) buildCase(); }); S.dev.on('keypad', () => { if (!M.is('vault')) buildCase(); });
  const needRebuild = () => (S.dev.opt('case') || 'pelican') !== V.style || (S.dev.opt('keypad') || 'rubber') !== V.kstyle;

  /* ---------- camera framings ---------- */
  const FRAME = () => ({ tx: CX, ty: 0.7, tz: CZ + 0.3, pitch: 58, dT: ctx.fitDist(10.5, 8.5, 58) });
  const KP_FRAME = () => ({ tx: CX + KX, ty: CASE_Y + KY, tz: CZ + D / 2, pitch: 9, dT: 2.7 });
  const LID_FRAME = () => ({ tx: CX, ty: 1.6, tz: CZ + 0.2, pitch: 50, dT: 9.8 });

  /* ---------- the slabs in the case ---------- */
  function dropSlabs() { V.slabs.forEach(s => { S.slabs.drop(s.obj); if (s.pivot.parent) s.pivot.parent.remove(s.pivot); }); V.slabs = []; V.hover = null; }
  /* build every slab in the store's vault (photos load async); laid out into up to three stepped rows once they are ready */
  async function buildSlabs() {
    dropSlabs(); const ids = store.get().vault.slice(), list = [];
    ids.forEach(id => { const slab = store.pull(id); if (!slab) return; const obj = S.slabs.make(slab); const pivot = new THREE.Group(); pivot.visible = false; obj.group.scale.setScalar(SLAB_K); pivot.add(obj.group); V.group.add(pivot); list.push({ obj, pivot, slab, y: 0, hoverT: 0 }); });
    V.slabs = list; V.overflow = 0;
    await Promise.all(list.map(s => s.obj.ready.catch(() => null)));
    if (V.slabs !== list) { list.forEach(s => { try { s.obj.dispose(); } catch (e) {} }); return; }
    layoutSlabs();
  }
  function layoutSlabs() {
    const rows = [[]], budget = W - 0.3, gap = 0.08; let acc = 0;
    V.slabs.forEach(s => { if (!s.obj.built) return; const w = s.obj.w * SLAB_K; let row = rows[rows.length - 1]; if (row.length && acc + gap + w > budget) { rows.push(row = []); acc = 0; } row.push(s); acc += (row.length > 1 ? gap : 0) + w; });
    V.overflow = 0;
    rows.forEach((row, i) => { if (i >= ROW_Z.length) { V.overflow += row.length; row.forEach(s => { s.pivot.visible = false; s.off = true; }); return; }
      const tot = row.reduce((a, s) => a + s.obj.w * SLAB_K, 0) + gap * (row.length - 1); let x = -tot / 2;
      row.forEach(s => { const w = s.obj.w * SLAB_K; s.pivot.position.set(x + w / 2, HB - WD + ROW_H[i] + 0.04, ROW_Z[i] + 0.1); s.pivot.rotation.x = -LEAN; s.obj.group.position.set(0, s.obj.h * SLAB_K / 2, 0); s.obj.group.rotation.set(0, 0, 0); s.y = s.pivot.position.y; s.row = i; s.off = false; x += w + gap; }); });
  }
  const slabGroups = () => V.slabs.filter(s => !s.off && s.obj.built && !s.out).map(s => s.obj.group);
  function setHover(s) { if (V.hover === s) return; V.hover = s; ctx.canvas.style.cursor = s ? 'pointer' : 'default'; }
  /* a patch of table for a slab coming out of the case: near the opening, left of the board, clear of the other slabs */
  function spotNear() { const WT = ctx.W_T / 2 - 3, HT = ctx.H_T / 2 - 2; for (const rr of [R + 2.6, R + 3.6, R + 4.8]) for (let k = 0; k < 14; k++) { const a = Math.PI * 0.55 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.32, x = CX + Math.cos(a) * rr, z = CZ + Math.sin(a) * rr * 0.8;
      if (Math.abs(x) > WT || Math.abs(z) > HT || x > ctx.BX - ctx.BW / 2 - 2.8) continue; if (S.table.list.some(o => Math.hypot(o.group.position.x - x, o.group.position.z - z) < 3.6)) continue; return { x, z }; } return S.table.freeSpot(); }
  async function inspectCaseSlab(s) {
    if (V.inspecting) return; V.inspecting = true; setHover(null); const g = s.obj.group, k0 = g.scale.x;
    const p = S.inspect.open(s.obj, { actions: [{ id: 'back', label: 'Put back' }, { id: 'binder', label: 'Into the binder' }, { id: 'table', label: 'Onto the table', primary: true }], hint: 'Drag to turn it, scroll to zoom. Click the room to put it back in the case.' });
    T.tween({ dur: 0.55, ease: E.outCubic, update: e => g.scale.setScalar(k0 + (1 - k0) * e) });
    const r = await p;
    T.tween({ dur: 0.45, ease: E.inOutSine, update: e => g.scale.setScalar(1 + (k0 - 1) * e) });
    while (S.inspect.active()) await T.wait(0.05);
    V.inspecting = false;
    if ((r !== 'table' && r !== 'binder') || !M.is('vault.lid')) return;
    s.out = true; s.pivot.visible = false; const slab = s.slab; S.slabs.drop(s.obj); if (s.pivot.parent) s.pivot.parent.remove(s.pivot); V.slabs = V.slabs.filter(x => x !== s);
    if (r === 'binder') { store.toBinder(slab.id); S.hud(); S.sfx('binder'); S.toast('Filed in the Rare binder. The button on the case front opens it.'); return; }
    const sp = spotNear(); S.table.place(slab, sp.x, sp.z, (Math.random() - 0.5) * 0.5, { drop: true }); S.hud(); S.toast('Out on the table. Click it there any time to look again, or send it back to the vault.');
  }

  /* ---------- the sequences ---------- */
  function showRig(on) { rig.visible = on; }
  function hitFront(e) { const h = S.hitAny(e, [V.kp, V.btn]); return h ? (h.root === V.kp ? 'keypad' : 'binder') : null; }
  function frontHover(kind) { const cap = V.btn.userData.cap; cap.userData.hot = kind === 'binder' ? 1 : 0; V.kpHot = kind === 'keypad' ? 1 : 0; ctx.canvas.style.cursor = kind ? 'pointer' : 'default'; }

  M.define('vault', {
    on: { CLOSE: () => 'vault.closing' },
    frame(dt) {
      const k = 1 - Math.exp(-dt * 10);
      /* keys spring back, the LCD shakes on a wrong code, OPEN holds for a moment */
      V.kpKeys.forEach(key => { key.userData.press *= Math.exp(-dt * 8); const p = key.userData.press, hot = (V.kpHot || 0) * 0.25; key.position.z = key.userData.z0 - p * 0.05; if (key.userData.halo) key.userData.halo.material.opacity = p * 0.9 + hot * 0.3; else if (key.material[4] && key.material[4].emissiveIntensity !== undefined) key.material[4].emissiveIntensity = 0.55 + hot + p * 1.2; });
      if (V.shake > 0) { V.shake -= dt; V.kp.position.x = KX + Math.sin(V.shake * 60) * 0.05 * V.shake; if (V.shake <= 0) { V.kp.position.x = KX; drawLCD(); } }
      if (V.ok > 0) { V.ok -= dt; if (V.ok <= 0) { V.code = ''; drawLCD(); } }
      const cap = V.btn.userData.cap; cap.material.emissiveIntensity += (((cap.userData.hot ? 0.9 : 0.25) + (cap.userData.press || 0) * 1.5) - cap.material.emissiveIntensity) * k; cap.position.z = cap.userData.z0 - (cap.userData.press || 0) * 0.05; if (cap.userData.press) cap.userData.press *= Math.exp(-dt * 8);
      V.slabs.forEach(s => { s.hoverT += ((V.hover === s ? 1 : 0) - s.hoverT) * k; if (!s.off && !V.inspecting) s.pivot.position.y = s.y + s.hoverT * 0.16; });
      lamp.intensity = Math.max(0, V.lampT || 0) * (0.96 + 0.04 * Math.sin(T.time() * 23)) ;
    },
  });

  M.define('vault.open', { busy: true,
    async enter(d, run) {
      if (needRebuild()) buildCase();
      V.pushed = true; S.cam.push(FRAME()); S.sfx('ltInspect');
      ctx.hideActs(); const slabsReady = buildSlabs();
      await S.clearPrints([CX - R - 0.5, CZ - R - 0.5, CX + R + 0.5, CZ + R + 0.5], S.dev.opt('clearing')); if (!run.alive()) return;
      /* the disc unlatches: the trim shows, the surface stops drawing inside the rect and the cover makes the hole round */
      V.lampT = 2; lift.position.y = 0; V.group.visible = false; V.group.position.x = 0; S.hole.open(CX - R, CZ - R, CX + R, CZ + R); showRig(true); S.sfx('detent');
      await T.wait(0.35, 'vault'); if (!run.alive()) return;
      S.sfx('raise'); await T.to(lift.position, { y: DOWN }, { dur: 1.7, ease: E.inOutCubic, tag: 'vault' }); if (!run.alive()) return;
      /* loaded from the side at the bottom, in the shaft's own light */
      await T.wait(0.25, 'vault'); if (!run.alive()) return;
      V.group.visible = true; V.group.position.x = -(R + W / 2 + 0.4); S.sfx('grab');
      await T.to(V.group.position, { x: 0 }, { dur: 0.8, ease: E.outCubic, tag: 'vault' }); if (!run.alive()) return;
      await T.wait(0.3, 'vault'); if (!run.alive()) return;
      S.sfx('raise'); V.lampT = 6;
      await T.to(lift.position, { y: 0 }, { dur: 2.0, ease: E.inOutCubic, tag: 'vault' }); if (!run.alive()) return;
      S.sfx('detent'); slabsReady.catch(() => null);
      M.go('vault.case');
    },
  });

  M.define('vault.case', {
    enter(d, run) { S.cam.set(FRAME()); if (run.from === 'vault.open') S.toast('The vault. Click the keypad on the front and put the code in.'); },
    on: { KEYPAD: () => 'vault.keypad', BINDER: () => 'vault.tobinder' },
    pointer(kind, e, M) {
      if (kind === 'move') { const h = hitFront(e); frontHover(h); return !!h; }
      if (kind === 'down') { if (e.button !== 0) return true; const h = hitFront(e); if (h === 'keypad') M.send('KEYPAD'); else if (h === 'binder') pressBinder(); return !!h; }
      return false; },
    exit() { frontHover(null); },
  });
  function pressBinder() { V.btn.userData.cap.userData.press = 1; S.sfx('detent'); M.send('BINDER'); }

  M.define('vault.keypad', {
    enter() { S.cam.set(KP_FRAME()); V.code = ''; V.shake = 0; V.ok = 0; drawLCD(); S.toast('Four digits. Click the keys, or type them.'); },
    on: { BACK: () => 'vault.case', OPENED: () => 'vault.lid' },
    pointer(kind, e, M) {
      if (kind === 'move') { const h = S.hitAny(e, V.kpKeys); ctx.canvas.style.cursor = h ? 'pointer' : 'default'; return true; }
      if (kind === 'down') { if (e.button !== 0) return true; const h = S.hitAny(e, V.kpKeys); if (h) { press(h.root.userData.digit); return true; } if (!S.hit(e, V.kpPlate)) M.send('BACK'); return true; }
      return true; },
    key(e, M) { if (V.ok > 0) return true; if (/^[0-9]$/.test(e.key)) { press(e.key); return true; } if (e.key === 'Backspace') { press('⌫'); return true; } if (e.key === 'Enter') { press('↵'); return true; } if (e.key === 'Escape') { M.send('BACK'); return true; } return false; },
    exit() { ctx.canvas.style.cursor = 'default'; },
  });
  /* one key: a digit, delete or enter; the code is checked on the fourth digit and on enter */
  function press(d) {
    if (!M.is('vault.keypad') || V.ok > 0) return; const key = V.kpKeys.find(k => k.userData.digit === d); if (key) key.userData.press = 1; S.sfx('detent');
    const want = String(store.get().code || '1234');
    if (d === '⌫') V.code = V.code.slice(0, -1);
    else if (d === '↵') { if (V.code.length) check(want); }
    else if (V.code.length < 4) { V.code += d; if (V.code.length === 4) check(want); }
    drawLCD();
  }
  function check(want) { if (V.code === want) { V.ok = 3; drawLCD(); S.sfx('detent'); T.wait(0.55, 'vault').then(ok => { if (ok && M.is('vault.keypad')) M.send('OPENED'); }); } else { V.shake = 0.6; V.code = ''; S.sfx('kitClose'); } }

  M.define('vault.lid', {
    async enter(d, run) {
      if (d && d.quiet && V.lidOpen) return;
      S.cam.set(LID_FRAME()); S.sfx('kitOpen'); V.lidOpen = true;
      await Promise.all(V.slabs.map(s => s.obj.ready.catch(() => null))); if (!run.alive()) return; layoutSlabs();
      const from = V.lidA;
      T.tween({ dur: 1.0, ease: E.outBack, tag: 'vault', update: e => { V.lidA = from + (1 - from) * e; V.lid.rotation.x = -1.55 * V.lidA; } });
      await T.wait(0.35, 'vault'); if (!run.alive()) return;
      V.slabs.forEach((s, i) => { if (s.off) return; s.pivot.visible = true; s.pivot.position.y = s.y - 0.35; T.to(s.pivot.position, { y: s.y }, { dur: 0.5, ease: E.outCubic, delay: i * 0.06, tag: 'vault' }); });
      if (!V.slabs.length) S.toast('Nothing in the vault yet. Click a slab on the table and send it in.');
      else if (V.overflow) S.toast(V.overflow + ' more in there than the case can show. Move some out to see them.');
      else S.toast('Hover a slab and click it for a closer look.');
    },
    on: { BINDER: () => 'vault.tobinder' },
    pointer(kind, e, M) {
      if (V.inspecting) return true;
      if (kind === 'move') { const h = S.hitAny(e, slabGroups()); if (h) { setHover(V.slabs.find(s => s.obj.group === h.root) || null); frontHover(null); return true; } setHover(null); const f = hitFront(e) === 'binder'; frontHover(f ? 'binder' : null); return f; }
      if (kind === 'down') { if (e.button !== 0) return false; const h = S.hitAny(e, slabGroups()); if (h) { const s = V.slabs.find(s => s.obj.group === h.root); if (s) inspectCaseSlab(s); return true; } if (hitFront(e) === 'binder') { pressBinder(); return true; } return false; }
      return false; },
    exit() { setHover(null); frontHover(null); },
  });

  /* the lid shuts (if it was open) and the case becomes the binder; binder.js owns vault.binder and what happens next */
  M.define('vault.tobinder', { busy: true,
    async enter(d, run) {
      const mesh = typeof binder.binderMesh === 'function' ? binder.binderMesh(S) : null;
      if (!mesh || !M.defined('vault.binder')) { S.toast('The binder is still being built.'); M.go(V.lidOpen ? 'vault.lid' : 'vault.case', { quiet: true }); return; }
      if (V.lidOpen) { await closeLid(run); if (!run.alive()) return; }
      /* the camera stays pushed: the binder frames itself, and caseBack brings the case framing back before the vault lowers it */
      S.sfx('binder');
      await P.morph(V.group, mesh, { mode: S.dev.opt('dissolve'), tag: 'vault' }); if (!run.alive()) return;
      M.go('vault.binder', { from: 'vault', mesh });
    },
  });
  /* the way back for binder.js: the binder becomes the case again */
  async function caseBack(mesh) { if (!V.pushed) { S.cam.push(FRAME()); V.pushed = true; } else S.cam.set(FRAME()); await P.morph(mesh, V.group, { mode: S.dev.opt('dissolve') }); V.group.visible = true; }
  async function closeLid(run) {
    if (!V.lidOpen && V.lidA <= 0) return;
    V.slabs.forEach(s => { if (!s.off) T.to(s.pivot.position, { y: s.y - 0.35 }, { dur: 0.3, ease: E.inCubic, tag: 'vault' }); });
    await T.wait(0.3, 'vault'); V.slabs.forEach(s => { s.pivot.visible = false; });
    const from = V.lidA; S.sfx('kitClose');
    await T.tween({ dur: 0.6, ease: E.inCubic, tag: 'vault', update: e => { V.lidA = from * (1 - e); V.lid.rotation.x = -1.55 * V.lidA; } });
    V.lidOpen = false;
  }

  M.define('vault.closing', { busy: true,
    on: { CLOSE: () => undefined },
    async enter(d, run) {
      T.cancelAll('vault'); setHover(null); frontHover(null); V.inspecting = false; V.ok = 0; V.shake = 0; V.kp.position.x = KX;
      if (V.pushed) { S.cam.pop(); V.pushed = false; }
      if (!rig.visible) { dropSlabs(); M.go('idle'); return; }
      await closeLid(run);
      if (V.group.visible) { S.sfx('raise'); V.lampT = 2.5; await T.to(lift.position, { y: DOWN }, { dur: 1.6, ease: E.inOutCubic, tag: 'vault' }); }
      else { await T.to(lift.position, { y: DOWN }, { dur: 0.9, ease: E.inOutCubic, tag: 'vault' }); }
      await T.wait(0.2, 'vault');
      /* the disc comes back up empty and the surface closes over it */
      S.sfx('raise'); V.group.visible = false; await T.to(lift.position, { y: 0 }, { dur: 1.3, ease: E.inOutCubic, tag: 'vault' });
      S.hole.close(); showRig(false); V.lampT = 0; lamp.intensity = 0; S.sfx('detent'); dropSlabs(); V.group.visible = true;
      M.go('idle');
    },
  });

  S.vault = {
    get group() { return V.group; }, rig, lift, state: V,
    openKeypad() { if (M.is('vault.case')) M.send('KEYPAD'); },
    key: d => press(d),
    close() { if (M.is('vault')) M.send('CLOSE'); },
    caseBack,
  };
}
