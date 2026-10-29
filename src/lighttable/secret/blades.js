// BLADES: three slabs pressed into a spinning top and battled in a stadium that rises out of the dark side's pit.
// The launcher beside the vault on the dark side opens it (its name 'blades' sends BLADES). The hangar doors slide
// apart, the stadium rides up out of the pit and opens out, and the build card takes three of your slabs: the attack
// ring, the weight disc and the tip (bladesim.js says what each part gives). Every part is cut from its slab's
// photograph and wears its finish (the holo shaders, so a gold ring is gold and catches the light as it spins).
// Pull back and let go to launch; Space fires the special once it is charged. First to 3 points against a rival built
// from three rolled slabs. Nothing here costs a slab: a burst only lasts the round, and borrowed parts are never saved.
// States: blades.open (busy) → blades.build → blades.ready → blades.battle → blades.round (busy) → blades.ready or
// blades.result; blades.closing (busy) on CLOSE (= or Esc). Test hooks on S.blades: sim(), pick(ids), launch(p, aim).
import * as THREE from 'three';
import * as BS from './bladesim.js';
import * as BSH from './bladeshape.js';
import * as BP from './bladeparts.js';
import * as BL from './bladelauncher.js';
import * as BSN from './bladesound.js';

const LIFT = 0.7;        /* the bowl floor's height above the table once it is up */
const DOWN = -9;         /* the stadium's height while it waits in the pit */
const PART = ['Attack ring', 'Weight disc', 'Tip'];
const PART_SAYS = ['Its tier sets how hard it hits', 'Its grade and tier set the weight', 'Its finish sets how it moves'];
const HOW = { burst: 'Burst finish', out: 'Over finish', xtreme: 'Xtreme finish', spin: 'Spin finish', time: 'Time. More spin wins' };

export function install(S) {
  if (!S.under) return;
  const { T, M, SL, SM, ctx, store } = S, E = T.E;
  const [X0, Z0, X1, Z1] = S.under.rect, CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2, R = BS.BOWL.R, DEP = BS.BOWL.depth;
  const ENV = BP.studioEnv(S.renderer);   /* a dark studio with softboxes (bladeparts.js), so metal shows streaks and shadow sides like product shots */
  const B = { spares: [], cine: null, cineCd: 0, shake: 0, stop: 0, slowT: 0, slowK: 1, gallery: [], slots: [null, null, null], active: 0, loaners: [], score: [0, 0], W: null, me: null, rival: null, acc: 0, drag: null, pushed: false, debris: [], thumbs: new Map(), preview: null, rivalParts: null, specialT: 0 };
  const hB = r => DEP * Math.min(1, (r / R) * (r / R));

  /* ---------- the launcher on the dark side: a ripcord launcher with a little blade on it ---------- */
  const btn = new THREE.Group(); btn.name = 'blades';
  { const white = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.45, metalness: 0.05 }), red = new THREE.MeshStandardMaterial({ color: 0xd8432b, roughness: 0.4, emissive: 0xd8432b, emissiveIntensity: 0.2 });
    const body = new THREE.Mesh(new S.RoundedBoxGeometry(0.9, 0.26, 0.5, 3, 0.08), white); body.position.y = 0.13; btn.add(body);
    const grip = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 10, 24), red); grip.position.set(0.6, 0.14, 0); grip.rotation.x = Math.PI / 2; btn.add(grip);
    const cord = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.08), red); cord.position.set(0.42, 0.14, 0); btn.add(cord);
    const top = new THREE.Group(); top.position.set(-0.12, 0.3, 0); btn.add(top);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 24), new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.25, metalness: 0.9, envMap: ENV })); disc.position.y = 0.06; top.add(disc);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.1, 16), white); tip.rotation.x = Math.PI; top.add(tip);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), red); cap.position.y = 0.12; top.add(cap); btn.userData.cap = cap; btn.userData.top = top;
    btn.add(S.shadow(1.4, 0.9)); }
  btn.position.set(-13.5, 0, 2); btn.rotation.y = 0.3; btn.scale.setScalar(2.6); S.under.group.add(btn);
  S.buttons.blades = btn;
  /* the little top on the launcher turns, faster under the pointer; the cord glows like the other buttons */
  const underFrame = S.under.frame; let btnT = 0;
  S.under.frame = function (dt) { underFrame.call(S.under, dt); btnT += dt || 0; const hot = !!btn.userData.hotT, top = btn.userData.top, cap = btn.userData.cap;
    if (top) top.rotation.y += (dt || 0) * (hot ? 14 : 2.5);
    /* the ripper on the table: hover and its cord slides out, ready to pull */
    const L = btn.userData.L; if (L) { btn.userData.cord = T.damp(btn.userData.cord || 0.18, hot ? 1.3 : 0.18 + 0.06 * Math.max(0, Math.sin(btnT * 1.6)), 10, dt || 0); L.setCord(btn.userData.cord); }
    if (cap) { const want = hot ? 1.2 : 0.25 + 0.2 * Math.sin(btnT * 2.4 + 1); cap.material.emissiveIntensity += (want - cap.material.emissiveIntensity) * (1 - Math.exp(-(dt || 0) * 10)); } };

  /* ---------- the stadium: a lathe bowl on a column, a light round the rim ---------- */
  const stadium = new THREE.Group(); stadium.userData.secret = true; stadium.visible = false; stadium.position.set(CX, DOWN, CZ); ctx.scene.add(stadium);
  const bowlTex = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#26262d'); gr.addColorStop(0.6, '#17171c'); gr.addColorStop(1, '#0e0e12'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
    for (let y = 18; y < 300; y += 26) { g.fillStyle = 'rgba(255,255,255,' + (y % 78 === 18 ? 0.09 : 0.035) + ')'; g.fillRect(0, y, 1024, 2); }
    for (let x = 0; x < 1024; x += 64) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(x, 0, 2, 300); }
    for (let i = 0; i < 2500; i++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.04 + ')'; g.fillRect(Math.random() * 1024, Math.random() * 512, 1, 1); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
  { const pts = []; for (let i = 0; i <= 28; i++) { const r = R * i / 28; pts.push(new THREE.Vector2(Math.max(0.001, r), hB(r))); }
    pts.push(new THREE.Vector2(R + 0.08, DEP + 0.04), new THREE.Vector2(R + 0.08, -0.5), new THREE.Vector2(2.0, -0.5));
    const bowlMat = new THREE.MeshStandardMaterial({ map: bowlTex, roughness: 0.55, metalness: 0.45, envMap: ENV, envMapIntensity: 0.5, side: THREE.DoubleSide });
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), bowlMat); stadium.add(bowl);
    /* the wall stands everywhere but the pockets (Beyblade X): turned arcs between them */
    const wallP = [[R + 0.08, DEP + 0.04], [R + 0.1, DEP + 0.42], [R + 0.45, DEP + 0.42], [R + 0.45, -0.5]].map(([r, y]) => new THREE.Vector2(r, y));
    const pk = BS.POCKETS.map(p => [p.a - p.half, p.a + p.half]).sort((x, y) => x[0] - y[0]);
    pk.forEach((p, i) => { const a0 = p[1], a1 = pk[(i + 1) % pk.length][0] + (i === pk.length - 1 ? Math.PI * 2 : 0); stadium.add(new THREE.Mesh(new THREE.LatheGeometry(wallP, 48, Math.PI / 2 - a1, a1 - a0), bowlMat)); });
    /* each pocket: a sunken tray behind the gap with a back wall, marked OVER or XTREME */
    const trayM = new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.6, metalness: 0.3, envMap: ENV, envMapIntensity: 0.4, side: THREE.DoubleSide });
    BS.POCKETS.forEach(p => { const a0 = p.a - p.half - 0.03, a1 = p.a + p.half + 0.03, r0 = R + 0.06, r1 = R + 1.1, sh = new THREE.Shape();
      for (let k = 0; k <= 16; k++) { const a = a0 + (a1 - a0) * k / 16; sh[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r1, -Math.sin(a) * r1); } for (let k = 16; k >= 0; k--) { const a = a0 + (a1 - a0) * k / 16; sh.lineTo(Math.cos(a) * r0, -Math.sin(a) * r0); }
      const floor = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), trayM); floor.position.y = DEP - 0.12; stadium.add(floor);
      stadium.add(new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(r1, DEP - 0.12), new THREE.Vector2(r1, DEP + 0.48)], 16, Math.PI / 2 - a1, a1 - a0), trayM));
      [a0, a1].forEach(a => { const side = new THREE.Mesh(new THREE.PlaneGeometry(r1 - r0, 0.6), trayM); side.position.set(Math.cos(a) * (r0 + r1) / 2, DEP + 0.18, Math.sin(a) * (r0 + r1) / 2); side.rotation.y = -a; stadium.add(side); });
      const label = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = p.kind === 'xtreme' ? '#ff7a2a' : '#e8e8ee'; g.font = 'italic 900 44px sans-serif'; g.textAlign = 'center'; g.fillText(p.kind === 'xtreme' ? 'XTREME' : 'OVER', 128, 48); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshBasicMaterial({ map: label, transparent: true, toneMapped: false, depthWrite: false })); lab.position.set(Math.cos(p.a) * (R + 0.75), DEP - 0.1, Math.sin(p.a) * (R + 0.75)); lab.rotation.set(-Math.PI / 2, 0, -p.a - Math.PI / 2); stadium.add(lab); });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 9, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x1b1b21, roughness: 0.5, metalness: 0.6 })); col.position.y = -5; stadium.add(col); }
  const rimLight = new THREE.Group(); { const m = new THREE.MeshBasicMaterial({ color: 0xe3ad57, toneMapped: false }); rimLight.material = m; const pk = BS.POCKETS.map(p => [p.a - p.half, p.a + p.half]).sort((x, y) => x[0] - y[0]);
    pk.forEach((p, i) => { const a0 = p[1], a1 = pk[(i + 1) % pk.length][0] + (i === pk.length - 1 ? Math.PI * 2 : 0), t = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.04, 8, 96, a1 - a0), m); t.rotation.set(Math.PI / 2, 0, a0); t.position.y = DEP + 0.43; rimLight.add(t); }); stadium.add(rimLight); }
  const floorLight = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.2, 96), new THREE.MeshBasicMaterial({ color: 0xe3ad57, transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false })); floorLight.rotation.x = -Math.PI / 2; floorLight.position.y = hB(1.17) + 0.01; stadium.add(floorLight);
  const key = new THREE.DirectionalLight(0xfff4e8, 1.5), rim = new THREE.DirectionalLight(0xbcd2ff, 1.2); key.position.set(CX - 6, 12, CZ + 8); key.target.position.set(CX, LIFT, CZ); rim.position.set(CX + 7, 5, CZ - 9); rim.target.position.set(CX, LIFT, CZ);
  [key, rim].forEach(l => { l.visible = false; l.userData.secret = true; l.target.userData.secret = true; ctx.scene.add(l, l.target); });
  const spot = new THREE.SpotLight(0xfff1e0, 0, 26, 0.62, 0.5, 1.1); spot.position.set(CX, 10, CZ + 3.5); spot.target.position.set(CX, LIFT, CZ); spot.visible = false; spot.userData.secret = true; spot.target.userData.secret = true; ctx.scene.add(spot, spot.target);

  /* ---------- the X rail: toothed arcs of the rim that catch a tip and fling it (bladesim.js RAIL) ---------- */
  const railMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.55, toneMapped: false }), railFlash = { k: 0 };
  { const toothM = new THREE.MeshStandardMaterial({ color: 0x9aa0aa, roughness: 0.3, metalness: 0.9, envMap: ENV }), tooth = new THREE.BoxGeometry(0.1, 0.1, 0.26), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yAx = new THREE.Vector3(0, 1, 0);
    BS.RAIL.arcs.forEach(([a0, a1]) => { const n = Math.round((a1 - a0) * (R + 0.05) / 0.16), im = new THREE.InstancedMesh(tooth, toothM, n);
      for (let k = 0; k < n; k++) { const a = a0 + (k + 0.5) / n * (a1 - a0); q.setFromAxisAngle(yAx, -a); m4.compose(new THREE.Vector3(Math.cos(a) * (R + 0.02), DEP + 0.07, Math.sin(a) * (R + 0.02)), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(k, m4); }
      stadium.add(im);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.035, 6, 64, a1 - a0), railMat); glow.rotation.set(Math.PI / 2, 0, a0); glow.position.y = DEP + 0.14; stadium.add(glow);
      const xs = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = '#ff7a2a'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 14); g.lineTo(50, 50); g.moveTo(50, 14); g.lineTo(14, 50); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, toneMapped: false, depthWrite: false }));
      const am = (a0 + a1) / 2; xs.position.set(Math.cos(am) * (R + 0.28), DEP + 0.43, Math.sin(am) * (R + 0.28)); xs.rotation.x = -Math.PI / 2; stadium.add(xs); }); }
  /* ---------- the stadium body: a black square base round the bowl, like a real one on the floor ---------- */
  const HALF = R + 1.5;
  { const sh = new THREE.Shape(), c = 1.4; sh.moveTo(-HALF + c, -HALF); sh.lineTo(HALF - c, -HALF); sh.quadraticCurveTo(HALF, -HALF, HALF, -HALF + c); sh.lineTo(HALF, HALF - c); sh.quadraticCurveTo(HALF, HALF, HALF - c, HALF);
    sh.lineTo(-HALF + c, HALF); sh.quadraticCurveTo(-HALF, HALF, -HALF, HALF - c); sh.lineTo(-HALF, -HALF + c); sh.quadraticCurveTo(-HALF, -HALF, -HALF + c, -HALF);
    const hole = new THREE.Path(); for (let k = 0; k <= 360; k++) { const a = k / 360 * Math.PI * 2, inP = BS.POCKETS.some(p => Math.abs(((a - p.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) <= p.half + 0.03), r = inP ? R + 1.1 : R + 0.44; hole[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, -Math.sin(a) * r); } sh.holes.push(hole);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: DEP + 0.42 + LIFT, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 48 }).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.42, metalness: 0.25, envMap: ENV, envMapIntensity: 0.6 }));
    body.position.y = -LIFT - 0.06; stadium.add(body); }
  /* spare blades waiting on the corners: yours near you, your rival's across the bowl */
  const SPOTS = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, z]) => [x * (HALF - 0.95), z * (HALF - 0.95)]);
  function clearSpares() { (B.spares || []).forEach(bl => { bl.dispose(); bl.slabs.forEach(x => { if (x.loaner || x.spare) { SM.forgetPhoto(x.id); DNA.delete(x.id); } }); }); B.spares = []; }
  function spareSets() { const d = store.get(), n0 = d.certN, mineLeft = mine().filter(x => !B.slots.includes(x)).sort(() => Math.random() - 0.5), sets = [];
    for (let i = 0; i < 2; i++) { const own = mineLeft.splice(0, 3); while (own.length < 3) { const r = SL.roll({ graded: true }); r.spare = true; own.push(r); } sets.push(own); }
    for (let i = 0; i < 2; i++) sets.push([0, 1, 2].map(() => { const r = SL.roll({ graded: true, tier: B.rivalParts[0].tier }); r.spare = true; return r; }));
    d.certN = n0; return sets; }
  function placeSpares(sets) { clearSpares(); B.spares = sets.map((p, i) => { const bl = makeBlade(p, BS.statsOf(p)); bl.root.position.set(SPOTS[i][0], DEP + 0.42, SPOTS[i][1]); bl.spin.rotation.y = i * 1.7; bl.root.scale.multiplyScalar(0.9); bl.halo.visible = false; return bl; }); }
  /* ---------- metal flying off: shards from both blades on the big hits ---------- */
  const SHN = 48, SHD = [], shGeo = new THREE.TetrahedronGeometry(0.07);
  for (let i = 0; i < SHN; i++) { const m = new THREE.Mesh(shGeo, new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.22, envMap: ENV, envMapIntensity: 1.5, flatShading: true })); m.visible = false; m.userData = { life: 0, v: new THREE.Vector3(), w: new THREE.Vector3() }; stadium.add(m); SHD.push(m); }
  let shN = 0;
  function shards(x, y, z, n, cols, spd) { for (let k = 0; k < n; k++) { const m = SHD[shN++ % SHN], u = m.userData, a = Math.random() * 6.2832, s = spd * (0.5 + Math.random());
      m.visible = true; m.position.set(x, y, z); m.material.color.copy(cols[k % cols.length]); m.scale.setScalar(0.6 + Math.random() * 1.2); u.life = 1.4 + Math.random() * 0.6; u.v.set(Math.cos(a) * s, 2 + Math.random() * spd * 0.8, Math.sin(a) * s); u.w.set(Math.random() * 30, Math.random() * 30, Math.random() * 30); } }
  function shardFrame(dt) { SHD.forEach(m => { const u = m.userData; if (!m.visible) return; u.life -= dt; if (u.life <= 0) { m.visible = false; return; }
      u.v.y -= 14 * dt; m.position.addScaledVector(u.v, dt); m.rotation.x += u.w.x * dt; m.rotation.y += u.w.y * dt; m.rotation.z += u.w.z * dt;
      const r = Math.hypot(m.position.x, m.position.z), floor = r < R ? hB(r) + 0.03 : r < HALF ? DEP + 0.45 : -LIFT + 0.02;
      if (m.position.y < floor) { m.position.y = floor; u.v.y = Math.abs(u.v.y) * 0.3; u.v.x *= 0.6; u.v.z *= 0.6; u.w.multiplyScalar(0.5); }
      if (u.life < 0.4) m.scale.multiplyScalar(Math.max(0, 1 - dt * 6)); }); }
  /* ---------- impact flashes and shockwaves ---------- */
  const FL = [], WV = [];
  for (let i = 0; i < 8; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: null, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); f.userData.life = 0; stadium.add(f); FL.push(f); }
  for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide })); w.rotation.x = -Math.PI / 2; w.userData.life = 0; stadium.add(w); WV.push(w); }
  let flN = 0, wvN = 0;
  function flash(x, y, z, k, col) { const f = FL[flN++ % FL.length]; if (!f.material.map) { f.material.map = dot; f.material.needsUpdate = true; } f.position.set(x, y, z); f.material.color.set(col || 0xffffff); f.userData.life = f.userData.max = 0.16 + 0.03 * k; f.userData.s = 0.8 + 0.35 * k; }
  function wave(x, z, k, col) { const w = WV[wvN++ % WV.length]; w.position.set(x, hB(Math.hypot(x, z)) + 0.06, z); w.material.color.set(col || 0xffe2a0); w.userData.life = w.userData.max = 0.4; w.userData.s = 1.2 + 0.4 * k; }
  function fxFrame(dt) {
    FL.forEach(f => { const L = f.userData; if (L.life <= 0) { f.material.opacity = 0; return; } L.life -= dt; const e = Math.max(0, L.life / L.max); f.material.opacity = e; f.scale.setScalar(L.s * (1.4 - 0.4 * e)); });
    WV.forEach(w => { const L = w.userData; if (L.life <= 0) { w.material.opacity = 0; return; } L.life -= dt; const e = Math.max(0, L.life / L.max); w.material.opacity = 0.8 * e; w.scale.setScalar(0.2 + L.s * (1 - e)); });
    railFlash.k *= Math.exp(-dt * 4); railMat.opacity = 0.5 + 0.5 * railFlash.k;
    if (B.shake > 0.002) { ctx.cam.cx = (ctx.cam.cx ?? ctx.cam.tx) + (Math.random() - 0.5) * B.shake; ctx.cam.cz = (ctx.cam.cz ?? ctx.cam.tz) + (Math.random() - 0.5) * B.shake; B.shake *= Math.exp(-dt * 10); } }
  /* ---------- sparks ---------- */
  const SPN = 500, sp = { pos: new Float32Array(SPN * 3), col: new Float32Array(SPN * 3), vel: new Float32Array(SPN * 3), life: new Float32Array(SPN), n: 0 };
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(sp.pos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(sp.col, 3));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.16, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); sparks.frustumCulled = false; stadium.add(sparks);
  for (let i = 0; i < SPN; i++) sp.pos[i * 3 + 1] = -99;
  /* each spark also draws a streak back along its path (the bright lines of metal grinding) */
  const stPos = new Float32Array(SPN * 6), stCol = new Float32Array(SPN * 6), stGeo = new THREE.BufferGeometry(); stGeo.setAttribute('position', new THREE.BufferAttribute(stPos, 3)); stGeo.setAttribute('color', new THREE.BufferAttribute(stCol, 3));
  const streaks = new THREE.LineSegments(stGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); streaks.frustumCulled = false; stadium.add(streaks);
  /* a real light at each big impact, so the blades flare up as they collide */
  const hitLight = new THREE.PointLight(0xffe2b0, 0, 4, 1.6); hitLight.userData.k = 0; stadium.add(hitLight);
  function spark(x, y, z, n, col, speed) { const c = new THREE.Color();
    for (let k = 0; k < n; k++) { const i = sp.n = (sp.n + 1) % SPN, a = Math.random() * 6.2832, u = Math.random() * 0.8 + 0.2, s = (speed || 3) * (0.4 + Math.random());
      sp.pos[i * 3] = x; sp.pos[i * 3 + 1] = y; sp.pos[i * 3 + 2] = z; sp.vel[i * 3] = Math.cos(a) * s * (1 - u * 0.5); sp.vel[i * 3 + 1] = u * s * 0.8; sp.vel[i * 3 + 2] = Math.sin(a) * s * (1 - u * 0.5); sp.life[i] = 0.3 + Math.random() * 0.5;
      c.set(Array.isArray(col) ? col[k % col.length] : col).lerp(new THREE.Color(0xffffff), Math.random() * 0.6); sp.col[i * 3] = c.r; sp.col[i * 3 + 1] = c.g; sp.col[i * 3 + 2] = c.b; } }
  function sparkFrame(dt) { for (let i = 0; i < SPN; i++) { if (sp.life[i] <= 0) { sp.pos[i * 3 + 1] = -99; continue; } sp.life[i] -= dt; sp.vel[i * 3 + 1] -= 9 * dt;
      sp.pos[i * 3] += sp.vel[i * 3] * dt; sp.pos[i * 3 + 1] += sp.vel[i * 3 + 1] * dt; sp.pos[i * 3 + 2] += sp.vel[i * 3 + 2] * dt; const k = Math.max(0, Math.min(1, sp.life[i] * 3)); sp.col[i * 3] *= 0.985 + 0.015 * k; sp.col[i * 3 + 1] *= 0.97 + 0.03 * k; sp.col[i * 3 + 2] *= 0.95 + 0.05 * k; }
    for (let i = 0; i < SPN; i++) { const o = i * 6, p = i * 3, L = 0.045; stPos[o] = sp.pos[p]; stPos[o + 1] = sp.pos[p + 1]; stPos[o + 2] = sp.pos[p + 2]; stPos[o + 3] = sp.pos[p] - sp.vel[p] * L; stPos[o + 4] = sp.pos[p + 1] - sp.vel[p + 1] * L; stPos[o + 5] = sp.pos[p + 2] - sp.vel[p + 2] * L;
      stCol[o] = sp.col[p]; stCol[o + 1] = sp.col[p + 1]; stCol[o + 2] = sp.col[p + 2]; stCol[o + 3] = stCol[o + 4] = stCol[o + 5] = 0; }
    stGeo.attributes.position.needsUpdate = true; stGeo.attributes.color.needsUpdate = true;
    hitLight.userData.k *= Math.exp(-dt * 14); hitLight.intensity = 60 * hitLight.userData.k;
    spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true; }

  /* ---------- a blade from three slabs ---------- */
  let texs = null;
  const photoTex = slab => { const t = new THREE.Texture(); if (texs) texs.push(t); t.colorSpace = THREE.SRGBColorSpace; SM.photoCanvas(slab, S).then(c => { t.image = c; t.needsUpdate = true; t.anisotropy = 8; }); return t; };
  const rank = s => BS.RANKS[s.tier] || 1;
  const tierCol = s => SL.tierOf(s).color;
  /* the attack ring's outline, hole and windows, all read from its photo (bladeshape.js) */
  function ringShape(slab, dir, dna) { const sh = new THREE.Shape(BSH.ringOutline(dna, rank(slab), dir).map(p => new THREE.Vector2(p[0], p[1])));
    const hole = new THREE.Path(); hole.absarc(0, 0, BSH.ringHole(dna), 0, Math.PI * 2, true); sh.holes.push(hole);
    BSH.ringWindows(dna).forEach(w => { const p = new THREE.Path(); p.absarc(Math.cos(w.a) * w.r, Math.sin(w.a) * w.r, w.s, 0, Math.PI * 2, true); sh.holes.push(p); });
    return sh; }
  /* the photo's colours averaged round circles from its centre: what a fast spin blurs it into */
  function radialFrom(px, w, h) { const n = 12, acc = Array.from({ length: n }, () => [0, 0, 0, 0]), side = Math.min(w, h), cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const r = Math.hypot(x - cx, y - cy) / (side / 2); if (r >= 1) continue; const b = acc[Math.floor(r * n)], i = (y * w + x) * 4; b[0] += px[i]; b[1] += px[i + 1]; b[2] += px[i + 2]; b[3]++; }
    return acc.map(b => b[3] ? [b[0] / b[3], b[1] / b[3], b[2] / b[3]] : [128, 128, 128]); }
  /* each photo's DNA, read once from a small copy of it */
  const DNA = new Map(), dnaOf = s => DNA.get(s.id) || BSH.DEFAULT_DNA;
  function loadDNA(s) { if (DNA.has(s.id)) return Promise.resolve(DNA.get(s.id));
    return SM.photoCanvas(s, S).then(c => { let d = BSH.DEFAULT_DNA; try { const k = Math.min(1, 160 / Math.max(c.width, c.height)), w = Math.max(8, Math.round(c.width * k)), h = Math.max(8, Math.round(c.height * k)), cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(c, 0, 0, w, h); const px = g.getImageData(0, 0, w, h).data; d = BSH.dnaFromPixels(px, w, h); d = { ...d, radial: radialFrom(px, w, h) }; } catch (e) {} DNA.set(s.id, d); return d; }).catch(() => BSH.DEFAULT_DNA); }
  /* the photo laid flat across the part: u, v from x and the shape's y (−z once it lies down) */
  function planarUV(geo, k) { k = k || 1; const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / k * 0.5 + 0.5, -p.getZ(i) / k * 0.5 + 0.5); uv.needsUpdate = true; return geo; }
  /* every finish has a metal of its own (Beyblade X: the photo sits in a metal blade): [colour, roughness, iridescent, metalness, glass] */
  const METALS = { matte: [0x8a9099, 0.32], steel: [0xa3acb6, 0.26], silver: [0xe6eaee, 0.16], foil: [0xf3f6fa, 0.07], keywarm: [0xd6834f, 0.2], keyblue: [0x3f74e0, 0.2], polychrome: [0xd0d0d8, 0.1, 1],
    etch: [0xb9824e, 0.28], lenticular: [0xc4cad8, 0.1, 1], latent: [0x8c2a1f, 0.28], cyanotype: [0x2f5f9a, 0.22], glitter: [0xeadcbe, 0.18], chrome: [0xffffff, 0.03], thermal: [0xc77a3a, 0.14, 1],
    porcelain: [0xf0ede6, 0.3, 0, 0.05], gold: [0xe6b24a, 0.16], kintsugi: [0x1f1e22, 0.28], raku: [0x8f5537, 0.32], glass: [0xbfe6f2, 0.04, 0, 0.1, 1], prism: [0x1a1a22, 0.08, 1], eclipse: [0x0d0d10, 0.18] };
  /* the depth finishes bring their own metals (fxfinishes.js META) */
  const metalFor = f => METALS[f] || (S.fx && S.fx.META[f] && S.fx.META[f].metal) || null;
  function metalOf(slab) { const f = SL.finishOf(slab, S.testFinish ? S.testFinish() : null), m = metalFor(f) || METALS.matte;
    return new THREE.MeshPhysicalMaterial({ color: m[0], roughness: m[1], metalness: m[3] != null ? m[3] : 1, iridescence: m[2] ? 1 : 0, iridescenceIOR: 1.7, clearcoat: 0.5, clearcoatRoughness: 0.2, envMap: ENV, envMapIntensity: 1.4, transparent: !!m[4], opacity: m[4] ? 0.55 : 1 }); }
  /* the photo lit so it reads even in the dark bowl */
  const photoMat = (tex, o) => new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.32, roughness: 0.42, metalness: 0, envMap: ENV, envMapIntensity: 0.35, ...(o || {}) });
  /* the blur a fast spin makes of the face: its own colours as rings, the metal at the edge */
  function blurTex(dna, metal) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), rad = dna.radial || [[128, 128, 128]], gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.44, 'rgba(0,0,0,0)'); rad.forEach((p, i) => gr.addColorStop(0.46 + i / rad.length * 0.28, 'rgba(' + p.map(Math.round).join(',') + ',1)')); const mc = new THREE.Color(metal);
    gr.addColorStop(0.76, 'rgba(' + [mc.r, mc.g, mc.b].map(v => Math.round(v * 255)).join(',') + ',1)'); gr.addColorStop(0.97, 'rgba(' + [mc.r, mc.g, mc.b].map(v => Math.round(v * 200)).join(',') + ',0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  const FACE = 0.74, TAU_ = Math.PI * 2;
  /* every blade's design, from its slab's seed (the same slab always looks the same) nudged by its photo:
     busy photos lean spiky, symmetrical ones lean to rings and shields, colourful ones get bright plastic */
  function designOf(slab, dna) {
    const r = T.rng(((slab.seed >>> 0) ^ 0x2f6b9a1) >>> 0), pick = (opts) => { const tot = opts.reduce((s, o) => s + o[1], 0); let v = r() * tot; for (const o of opts) { v -= o[1]; if (v <= 0) return o[0]; } return opts[0][0]; }, rk = rank(slab);
    const metal = pick([['claws', 3], ['ring', 1 + dna.sym * 2], ['swirl', 1.5 + (1 - dna.sym)], ['spikes', 0.5 + dna.edge * 2 + (rk >= 4 ? 1 : 0)], ['double', 1 + (rk >= 3 ? 1 : 0)], ['shield', 0.5 + dna.sym * 1.5]]);
    return { metal, wings: BSH.wingCount(dna, rk), bosses: 4 + Math.floor(r() * 4),
      body: pick([['fins', 2], ['swirl', 1.5], ['dome', 1], ['wheel', 1 + dna.sym], ['petals', 0.7]]), spokes: 5 + Math.floor(r() * 4),
      print: pick([['none', 2 - rk * 0.25], ['stripes', 1], ['flames', 1 + (dna.sat > 0.3 ? 1 : 0)], ['dots', 0.7], ['speed', 1], ['burst', 0.6 + rk * 0.15]]),
      hub: pick([['tabs', 2], ['gear', 1], ['lobes', 1.2], ['hex', 0.8]]), hubCol: pick([['body', 2], ['second', 1.5], ['white', 0.6], ['tier', 0.8]]),
      sticker: pick([['round', 3], ['hex', 1]]), tone: pick([['finish', 2], ['silver', 2.5], ['gunmetal', 1], ['black', 0.8 + (rk >= 5 ? 1 : 0)], ['gold', 0.4 + (rk >= 5 ? 1 : 0)], ['anodised', 0.8]]),
      plastic: pick([['trans', 3], ['opaque', 1.5], ['clear', 0.7]]), h2: (dna.hue + [0.5, 0.33, 0.12, 0.6, 0.85][Math.floor(r() * 5)]) % 1 };
  }
  function makeBlade(parts, st, who) {
    const [a, b, c] = parts, [da, db, dc] = parts.map(dnaOf), sp = BSH.tipSpec(dc), lift = sp.len - 0.36, root = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group(), gRing = new THREE.Group(), gDisc = new THREE.Group(), gTip = new THREE.Group();
    root.add(tilt); tilt.add(spin); spin.add(gTip, gDisc, gRing); root.scale.setScalar(st.radius); const mats = [], geos = [], fins = [], myTex = texs = [];
    const keep = m => { if (m.geometry) geos.push(m.geometry); if (m.material) [].concat(m.material).forEach(x => mats.push(x)); return m; };
    /* a slab's finish shader laid over one part, so every part wears its finish */
    const finishOver = (slab, tex, geo, parent, y, sy) => { const fid = SL.finishOf(slab, S.testFinish ? S.testFinish() : null), def = SM.finishDef(fid);
      try { const fm = def && def.make ? def.make({ THREE, slab, obj: null, w: 2, h: 2, photoTex: tex, tier: SL.tierOf(slab), renderer: S.renderer, envMap: ENV, finish: fid }) : null;
        if (!fm) { geo.dispose(); return null; } fm.geometry.dispose(); fm.geometry = geo; fm.position.y = y; if (sy) fm.scale.y = sy; fm.renderOrder = 2; parent.add(fm); keep(fm); fins.push({ m: fm, def }); return fm; } catch (e) { console.error('blade finish', e); geo.dispose(); return null; } };
    /* Built like a real Beyblade X (Sam's photos), from sculpted parts (bladeparts.js): a bit with its gear, a toothed ratchet, a moulded
       translucent body in the photo's colour, a metal frame whose crescents sweep round the rim, a lock ring with tabs and the photo as the
       emblem sticker. The photo's DNA sets the wing count, sweep, hook, thickness, fins, colours and details, so every blade is its own. */
    const D2 = THREE.DoubleSide, cmet = metalOf(c); mats.push(cmet); cmet.side = D2;
    const ctex = photoTex(c), tipH = 0.2 + 0.08 * T.clamp(dc.mean, 0, 1), tierC = new THREE.Color(tierCol(c)), dir = st.dir;
    /* the bit: turned, in its tier's colour with its photo printed round it, a gear on top */
    const bitMat = new THREE.MeshPhysicalMaterial({ map: ctex, color: tierC.clone().lerp(new THREE.Color(0xffffff), 0.3), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2, envMap: ENV, side: D2 }); mats.push(bitMat);
    const tipM = keep(new THREE.Mesh(BP.bit(st.tip, tipH), bitMat)); gTip.add(tipM);
    const gearM = keep(new THREE.Mesh(BP.gear(12 + Math.round(dc.edge * 6)), cmet)); gearM.position.y = tipH - 0.01; gTip.add(gearM);
    /* the ratchet: dark translucent plastic tinted by its photo, teeth sloped with the spin, its photo printed round the outside */
    const y0 = tipH + 0.03, RH = 0.12, dHue = new THREE.Color().setHSL(db.hue, db.sat > 0.15 ? 0.7 : 0.03, db.sat > 0.15 ? 0.3 : 0.12), dtex = photoTex(b);
    const ratM = keep(new THREE.Mesh(BP.ratchet({ teeth: [3, 4, 5, 6, 7, 9][Math.floor(T.clamp(db.edge, 0, 0.99) * 6)], h: RH, dir }), new THREE.MeshPhysicalMaterial({ color: dHue.clone().multiplyScalar(0.7), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, envMap: ENV, envMapIntensity: 1.0, transmission: 0.35, thickness: 0.3, side: D2 })));
    ratM.position.y = y0; gDisc.add(ratM);
    finishOver(b, dtex, BP.ratchet({ teeth: 6, rOut: 0.685, h: RH, dir }), gDisc, y0);
    /* the blade: a design picked from families for every part (designOf), so no two blades look alike */
    const ry = y0 + RH, clear = a.variant === 'clear', amet = metalOf(a); mats.push(amet); amet.side = D2;
    const Dz = designOf(a, da), rr = T.rng((a.seed >>> 0) ^ 0x51ed), W = Dz.wings, lean = da.lean * 0.3;
    /* the metal's tone: the finish's own metal pulled towards the design's tone */
    const TONE = { silver: 0xa2a9b3, gunmetal: 0x51565e, black: 0x232328, gold: 0xc99a3e }; if (Dz.tone !== 'finish' && TONE[Dz.tone] != null) amet.color.lerp(new THREE.Color(TONE[Dz.tone]), 0.7);
    if (Dz.tone === 'anodised') { amet.color.setHSL(Dz.h2, 0.75, 0.42); amet.iridescence = 0.6; }
    amet.roughness = T.clamp(amet.roughness, 0.16, 0.32); amet.envMapIntensity = 1.6; amet.clearcoat = 0.25; amet.bumpMap = BP.brushed(); amet.bumpScale = 0.35; amet.roughnessMap = BP.brushed();
    const sat = da.sat > 0.12, hue = new THREE.Color().setHSL(da.hue, sat ? 1 : 0.04, sat ? 0.36 : 0.1), hue2 = new THREE.Color().setHSL(Dz.h2, 0.95, 0.42), ptex = photoTex(a);
    const acc = Dz.hubCol === 'body' ? new THREE.Color().setHSL(da.hue, sat ? 1 : 0.05, 0.22) : Dz.hubCol === 'second' ? new THREE.Color().setHSL(Dz.h2, 0.95, 0.3) : Dz.hubCol === 'white' ? new THREE.Color(0xd8d8dd) : new THREE.Color(tierCol(a)).multiplyScalar(0.6);
    /* the plastic: printed with the photo and the design's graphics, clear, translucent or opaque */
    const prtex = new THREE.CanvasTexture(BP.decalCanvas(Dz.print, '#' + hue.getHexString(), '#' + hue2.getHexString(), T.rng(a.seed >>> 0))); prtex.colorSpace = THREE.SRGBColorSpace; myTex.push(prtex);
    const plasticMat = (col, o) => new THREE.MeshPhysicalMaterial({ map: col === hue ? prtex : null, color: col === hue ? 0xffffff : col, emissive: col, emissiveIntensity: 0.08, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06,
      transmission: clear || Dz.plastic === 'clear' ? 0.6 : Dz.plastic === 'trans' ? 0.28 : 0, thickness: 0.6, ior: 1.5, attenuationColor: col, attenuationDistance: 0.12, envMap: ENV, envMapIntensity: 0.7, side: D2, ...(o || {}) });
    const pm = plasticMat(hue); mats.push(pm);
    const nFins = W * (1 + Math.round(da.edge * 2));
    if (Dz.body === 'fins' || Dz.body === 'swirl') { const k = Dz.body === 'swirl', m = keep(new THREE.Mesh(BP.body({ fins: k ? nFins * 2 : nFins, dir, reach: k ? 0.86 : 0.82, base: k ? 0.62 : 0.7, sweepK: k ? 3.2 : 1.4 + da.contrast * 3, hIn: 0.16, hOut: 0.1 }), pm)); m.position.y = ry; gRing.add(m); }
    else if (Dz.body === 'dome') { const prof = [[0.27, 0.16], [0.4, 0.17], [0.6, 0.15], [0.76, 0.11], [0.82, 0.06], [0.82, 0], [0.27, 0]].map(([r, y]) => new THREE.Vector2(r, y)); const m = keep(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), pm)); m.position.y = ry; gRing.add(m); }
    else if (Dz.body === 'wheel') { const m = keep(new THREE.Mesh(BP.plate(BP.wheelShape(0.27, 0.82, Math.min(5, Dz.spokes), 0.14), 0.12, 0.03), pm)); m.position.y = ry; gRing.add(m); }
    else { const p2 = plasticMat(hue2); mats.push(p2); const m1 = keep(new THREE.Mesh(BP.plate(BP.petalShape(0.27, 0.84, W * 2, 0, 2.2), 0.09, 0.025), pm)); m1.position.y = ry; gRing.add(m1);
      const m2 = keep(new THREE.Mesh(BP.plate(BP.petalShape(0.27, 0.74, W * 2, Math.PI / (W * 2), 2.6), 0.07, 0.02), p2)); m2.position.y = ry + 0.1; gRing.add(m2); }
    /* the metal, by family */
    const M0 = ry + 0.06, add = g => { const m = keep(new THREE.Mesh(g, amet)); m.position.y = M0; gRing.add(m); return m; }, thick = 0.1 + 0.04 * T.clamp(da.contrast * 3, 0, 1), hookK = 0.2 + 0.5 * (1 - da.sym);
    const boltAt = (ang, r) => { const bb = keep(new THREE.Mesh(BP.bolt(), amet)); bb.position.set(Math.cos(ang) * r, M0 + 0.09, -Math.sin(ang) * r); gRing.add(bb); };
    const gemAt = (ang, r) => { const gm = keep(new THREE.Mesh(BP.gem(0.06), new THREE.MeshPhysicalMaterial({ color: tierCol(a), emissive: tierCol(a), emissiveIntensity: 0.5, roughness: 0.05, transmission: 0.5, thickness: 0.2, envMap: ENV }))); gm.position.set(Math.cos(ang) * r, M0 + 0.13, -Math.sin(ang) * r); gm.rotation.y = ang; gRing.add(gm); };
    if (Dz.metal !== 'ring') add(BP.frameRing(0.62, 0.74, 0.09));
    if (Dz.metal === 'claws' || Dz.metal === 'double') { const span = (TAU_ / W) * T.clamp(0.6 + da.contrast * 0.8, 0.6, 0.9);
      for (let w = 0; w < W; w++) { const a0 = w / W * TAU_ + lean; add(BP.crescent({ a0, span, dir, rIn: 0.62, reach: 1, thick, hook: hookK })); boltAt(a0 + dir * span * 0.25, 0.64);
        if (Dz.metal === 'double') add(BP.crescent({ a0: a0 + dir * span * 0.45, span: span * 0.55, dir, rIn: 0.6, reach: 0.86, thick: thick * 1.3, hook: 0.1 }));
        if (rank(a) >= 4) gemAt(a0 + dir * span * 0.62, 0.84); } }
    else if (Dz.metal === 'ring') { const nb = Dz.bosses; add(BP.metalRing({ bosses: nb, rIn: 0.66, reach: 1, thick: thick * 1.2, notch: 0.5 })); for (let k = 0; k < nb; k++) { const ba = (k + 0.5) / nb * TAU_; boltAt(ba, 0.86); if (rank(a) >= 4 && k % 2 === 0) gemAt(ba + 0.3, 0.78); } }
    else if (Dz.metal === 'swirl') { const n = Math.max(2, Math.min(4, W)); for (let w = 0; w < n; w++) add(BP.swirl({ a0: w / n * TAU_ + lean, span: TAU_ / n * 1.25, dir, thick })); for (let w = 0; w < n; w++) boltAt(w / n * TAU_ + lean + 0.2 * dir, 0.62); }
    else if (Dz.metal === 'spikes') { const n = W * 2; for (let w = 0; w < n; w++) { const a0 = w / n * TAU_ + lean, big = w % 2 === 0; add(BP.crescent({ a0, span: TAU_ / n * (big ? 0.85 : 0.6), dir, rIn: 0.66, reach: big ? 1 : 0.9, thick: thick * (big ? 1.1 : 0.8), hook: 0.7 })); if (big && rank(a) >= 3) gemAt(a0 + dir * 0.25, 0.8); } }
    else if (Dz.metal === 'shield') { const n = Math.max(2, Math.min(3, W)); for (let w = 0; w < n; w++) { const a0 = w / n * TAU_ + lean, span = TAU_ / n * 0.82; add(BP.crescent({ a0, span, dir, rIn: 0.66, reach: 0.98, thick: thick * 1.4, hook: 0.05 })); boltAt(a0 + dir * span * 0.3, 0.8); boltAt(a0 + dir * span * 0.7, 0.8); } }
    /* the lock ring, by family */
    const hubMat = new THREE.MeshPhysicalMaterial({ color: acc, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMap: ENV, envMapIntensity: 1.0, side: D2 }); mats.push(hubMat);
    if (Dz.hub === 'tabs') { const hubM = keep(new THREE.Mesh(BP.hub(0.27, 0.38, 0.13), hubMat)); hubM.position.y = ry + 0.1; gRing.add(hubM);
      for (let w = 0; w < W; w++) { const ta = (w + 0.5) / W * TAU_ + lean, tb = keep(new THREE.Mesh(BP.tab(0.1, 0.07, 0.04), hubMat)); tb.position.set(Math.cos(ta) * 0.4, ry + 0.16, -Math.sin(ta) * 0.4); tb.rotation.y = ta; gRing.add(tb); } }
    else { const sh = Dz.hub === 'gear' ? BP.gearRingShape(0.27, 0.42, 14 + W * 2) : Dz.hub === 'lobes' ? BP.lobeRingShape(0.27, 0.44, 3) : BP.polyRingShape(0.27, 0.42, 6, lean); const hm = keep(new THREE.Mesh(BP.plate(sh, 0.1, 0.02), hubMat)); hm.position.y = ry + 0.12; gRing.add(hm); }
    /* the emblem: the photo as a printed sticker, round or hex */
    const accHex = '#' + hue2.getHexString(), mk = cv => Dz.sticker === 'hex' ? BP.hexSticker(cv, accHex) : BP.stickerCanvas(cv, accHex);
    const stex = new THREE.CanvasTexture(mk(null)); stex.colorSpace = THREE.SRGBColorSpace; myTex.push(stex);
    SM.photoCanvas(a, S).then(cv => { stex.image = mk(cv); stex.needsUpdate = true; });
    const embM = keep(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.012, Dz.sticker === 'hex' ? 6 : 64), [new THREE.MeshStandardMaterial({ color: 0x111111 }), new THREE.MeshPhysicalMaterial({ map: stex, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.05, envMap: ENV, envMapIntensity: 0.25, emissive: 0xffffff, emissiveMap: stex, emissiveIntensity: 0.22 }), new THREE.MeshStandardMaterial({ color: 0x111111 })]));
    if (Dz.sticker === 'hex') embM.rotation.y = Math.PI / 6;
    { const uv = embM.geometry.attributes.uv, pp = embM.geometry.attributes.position; for (let k = 0; k < pp.count; k++) if (pp.getY(k) > 0.005) uv.setXY(k, pp.getX(k) / 0.54 + 0.5, -pp.getZ(k) / 0.54 + 0.5); }
    embM.position.y = ry + 0.17; gRing.add(embM);
    /* the spin: a blur of the face's own colours over the top as it gets fast (not on the spin group, so it doesn't strobe) */
    const btex = blurTex(da, metalFor(SL.finishOf(a)) ? metalFor(SL.finishOf(a))[0] : 0x8a9099); myTex.push(btex);
    const halo = keep(new THREE.Mesh(new THREE.CircleGeometry(1.06, 64), new THREE.MeshBasicMaterial({ map: btex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))); halo.rotation.x = -Math.PI / 2; halo.position.y = ry + 0.3; halo.renderOrder = 3; tilt.add(halo);
    const glint = keep(new THREE.Mesh(new THREE.RingGeometry(0.86, 1.05, 48, 1, 0, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }))); glint.rotation.x = -Math.PI / 2; glint.position.y = ry + 0.305; glint.renderOrder = 4; tilt.add(glint);
    /* grounded: a soft shadow and a dark contact spot under the tip */
    const shadow = S.shadow(2.6, 2.6); shadow.position.y = 0.02; root.add(shadow); keep(shadow); const contact = S.shadow(0.9, 0.9); contact.material.opacity = 0.8; contact.position.y = 0.025; root.add(contact); keep(contact); const bl0 = {};
    if (who) { const mk = keep(new THREE.Mesh(new THREE.RingGeometry(1.2, 1.3, 64), new THREE.MeshBasicMaterial({ color: who === 'me' ? 0xe3ad57 : 0xe4552e, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))); mk.rotation.x = -Math.PI / 2; mk.position.y = 0.05; root.add(mk); bl0.marker = mk; }
    /* a ribbon of light behind it */
    const TN = 26, tPos = new Float32Array(TN * 2 * 3), tCol = new Float32Array(TN * 2 * 3), tGeo = new THREE.BufferGeometry(), idx = [];
    for (let k = 0; k < TN - 1; k++) { const q = k * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3)); tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3)); tGeo.setIndex(idx);
    const trail = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide })); trail.frustumCulled = false; trail.visible = false; stadium.add(trail); keep(trail);
    const bl = { root, tilt, spin, parts: [gRing, gDisc, gTip], halo, glint, fins, st, slabs: parts, who, marker: bl0.marker || null, vang: 0, drop: 0, dead: null, deadT: 0, vy: 0, fly: null, tiltN: new THREE.Quaternion(), whirr: null,
      trail, hist: [], metalCol: new THREE.Color(amet.color), trailCol: new THREE.Color(tierCol(a)).lerp(new THREE.Color(0xffffff), 0.25),
      dispose() { if (bl.whirr) bl.whirr.stop(); root.removeFromParent(); trail.removeFromParent(); bl.parts.forEach(p => p.removeFromParent()); new Set([...geos, ...mats, ...myTex]).forEach(x => { try { x.dispose(); } catch (e) {} }); } };
    texs = null;
    stadium.add(root); return bl;
  }

  /* ---------- the whirr: a sawtooth through a band-pass that follows the spin ---------- */
  /* Blades' own sound (bladesound.js), made once the room's audio is running */
  let SND = null; const sx = () => { if (!SND) { try { SND = BSN.make(S.snd && S.snd.ctx ? S.snd.ctx() : null, S.snd && S.snd.out ? S.snd.out() : null); } catch (e) { SND = null; } } return SND; };
  const panOf = x => T.clamp(x / R, -1, 1);
  function whirr(bl) { const z = sx(); if (!z) return null; const v = z.spin(BSH.wingCount(dnaOf(bl.slabs[0]), rank(bl.slabs[0]))); return { set(s, pan) { v.set(s, pan, bl.grind || 0); }, stop() { v.stop(); } }; }
  const snd = (id, o) => { try { return S.snd && S.snd.play ? S.snd.play(id, o) : null; } catch (e) { return null; } };

  /* ---------- placing a blade from the sim ---------- */
  const up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3(), wq = new THREE.Quaternion(), wAxis = new THREE.Vector3();
  const lean = new THREE.Quaternion();
  function pose(bl, t, dt) {
    const r = Math.hypot(t.p.x, t.p.y), s = Math.min(1, Math.abs(t.w) / B.W.wRef), spd = Math.hypot(t.v.x, t.v.y);
    bl.root.position.set(t.p.x, hB(r) + bl.drop, t.p.y);
    nrm.set(-2 * DEP * t.p.x / (R * R), 1, -2 * DEP * t.p.y / (R * R)).normalize(); bl.tiltN.setFromUnitVectors(up, nrm);
    /* it leans into the way it's going, like a real top carving the bowl */
    if (spd > 0.2) { wAxis.set(t.v.y, 0, -t.v.x).normalize(); lean.setFromAxisAngle(wAxis, -Math.min(0.24, spd * 0.035)); bl.tiltN.multiply(lean); }
    if (t.wob) { const ph = T.time() * 9; wAxis.set(Math.cos(ph), 0, Math.sin(ph)); wq.setFromAxisAngle(wAxis, t.wob * 0.4); bl.tiltN.multiply(wq); }
    bl.tilt.quaternion.slerp(bl.tiltN, 1 - Math.exp(-dt * 20));
    { const uy = new THREE.Vector3(0, 1, 0).applyQuaternion(bl.tilt.quaternion).y, rel = Math.max(0, Math.acos(T.clamp(uy, -1, 1)) - Math.atan(2 * DEP * r / (R * R))); bl.root.position.y += bl.st.radius * Math.sin(rel) * 0.95 + 0.01; }   /* never sink the rim into the bowl when it leans */
    /* the real spin, and the blur of it: the faster it goes the more the face melts into rings of its own colours */
    bl.vang += t.w * dt; bl.spin.rotation.y = -bl.vang; const aw = Math.abs(t.w), blur = T.clamp((aw - 14) / 26, 0, 1);
    bl.halo.material.opacity = 0.45 * blur; bl.glint.material.opacity = 0.35 * blur; bl.glint.rotation.z = -bl.vang * 0.07;
    const a = t.ang * 0.08 + T.time() * 0.6; bl.fins.forEach(f => { try { f.def.update(f.m, { tilt: new THREE.Vector2(Math.cos(a) * 0.7, Math.sin(a) * 0.7), pointer: new THREE.Vector2(0.5, 0.5), dt, time: T.time() }); } catch (e) {} });
    bl.grind = (bl.grind || 0) * Math.exp(-dt * 6); if (bl.whirr) bl.whirr.set(t.alive ? s : 0, t.p.x / R);
    trailPush(bl, t.alive ? spd : 0);
    /* the tip grinds: a few sparks off the floor when it's moving fast, a stream on the rail */
    if (t.alive && (spd > 3.2 || t.dash) && Math.random() < (t.dash ? 0.9 : 0.35)) spark(t.p.x, hB(r) + 0.05, t.p.y, t.dash ? 4 : 1, t.dash ? [0xffb347, 0xffe2a0] : 0xffd08a, t.dash ? 3 : 1.6);
  }
  function trailPush(bl, spd) { const h = bl.hist, p = bl.root.position; h.unshift([p.x, p.y + 0.12, p.z]); if (h.length > 26) h.length = 26;
    const tr = bl.trail, pos = tr.geometry.attributes.position, col = tr.geometry.attributes.color, w = 0.32 * bl.st.radius, on = T.clamp((spd - 1.2) / 3, 0, 1);
    tr.visible = h.length > 3 && on > 0.02;
    for (let k = 0; k < 26; k++) { const q = h[Math.min(k, h.length - 1)], n = h[Math.min(k + 1, h.length - 1)]; let dx = q[0] - n[0], dz = q[2] - n[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const f = (1 - k / 25) * on, ww = w * (1 - k / 30); pos.setXYZ(k * 2, q[0] - dz * ww, q[1], q[2] + dx * ww); pos.setXYZ(k * 2 + 1, q[0] + dz * ww, q[1], q[2] - dx * ww);
      col.setXYZ(k * 2, bl.trailCol.r * f, bl.trailCol.g * f, bl.trailCol.b * f); col.setXYZ(k * 2 + 1, bl.trailCol.r * f, bl.trailCol.g * f, bl.trailCol.b * f); }
    pos.needsUpdate = true; col.needsUpdate = true; }

  /* ---------- the HUD: build card, battle bars, banner, result bar ---------- */
  const card = S.el('div', 'bl-card', ''); card.id = 'skBl'; document.body.appendChild(card);
  const hud = S.el('div', 'bl-hud', ''); hud.id = 'skBlHud'; document.body.appendChild(hud);
  const ban = S.el('div', 'bl-ban', ''); ban.id = 'skBlBan'; document.body.appendChild(ban);
  const bar = S.el('div', 'bl-bar', ''); bar.id = 'skBlBar'; document.body.appendChild(bar);
  const veil = S.el('div', 'bl-veil', ''); veil.id = 'skBlVeil'; document.body.appendChild(veil);
  /* a white flash for the huge hits, and anime speed lines for the dives and dashes */
  const flashEl = S.el('div', 'bl-flash', ''); flashEl.id = 'skBlFlash'; document.body.appendChild(flashEl);
  function screenFlash(a) { flashEl.style.transition = 'none'; flashEl.style.opacity = a; void flashEl.offsetWidth; flashEl.style.transition = 'opacity .4s ease-out'; flashEl.style.opacity = 0; }
  const speedEl = S.el('div', 'bl-speed', ''); speedEl.id = 'skBlSpeed'; document.body.appendChild(speedEl);
  { const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'); g.translate(512, 512);
    for (let k = 0; k < 140; k++) { const a = Math.random() * Math.PI * 2, r0 = 260 + Math.random() * 200, w = 0.004 + Math.random() * 0.01; g.fillStyle = 'rgba(255,255,255,' + (0.25 + Math.random() * 0.6) + ')'; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a - w) * 760, Math.sin(a - w) * 760); g.lineTo(Math.cos(a + w) * 760, Math.sin(a + w) * 760); g.closePath(); g.fill(); }
    speedEl.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')'; }
  [card, hud, bar].forEach(el => { el.addEventListener('pointerdown', e => e.stopPropagation()); el.addEventListener('wheel', e => e.stopPropagation()); });
  S.css(BLADES_CSS);
  let banT = null;
  function banner(big, small, ms) { clearTimeout(banT); ban.innerHTML = '<b>' + big + '</b>' + (small ? '<span>' + small + '</span>' : ''); ban.classList.remove('on'); void ban.offsetWidth; ban.classList.add('on'); if (ms) banT = setTimeout(() => ban.classList.remove('on'), ms); }
  function hideBanner() { clearTimeout(banT); ban.classList.remove('on'); }
  function showBar(list) { bar.innerHTML = list.map(a => '<button type="button" class="btn' + (a[2] ? ' primary' : '') + '" data-a="' + a[0] + '">' + a[1] + '</button>').join(''); bar.classList.add('on'); }
  const hideBar = () => bar.classList.remove('on');
  bar.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; e.stopPropagation(); act(b.dataset.a); });

  /* slabs you can build with: pulled and on hand (not away for grading or waiting in a parcel), then any borrowed ones */
  function mine() { return SL.sortPulls(store.get().pulls.filter(p => { const g = SL.gradingState(p); return g === 'raw' || g === 'graded'; })).concat(B.loaners); }
  const byId = id => mine().find(s => s.id === id) || null;
  function thumb(slab) { if (B.thumbs.has(slab.id)) return B.thumbs.get(slab.id);
    const p = SM.photoCanvas(slab, S).then(c => { const k = document.createElement('canvas'); k.width = 120; k.height = 120; const g = k.getContext('2d'), s = Math.max(120 / c.width, 120 / c.height); g.drawImage(c, (120 - c.width * s) / 2, (120 - c.height * s) / 2, c.width * s, c.height * s); try { return k.toDataURL('image/jpeg', 0.8); } catch (e) { return ''; } });
    B.thumbs.set(slab.id, p); return p; }
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const gradeTag = s => s.loaner ? 'Borrowed' : s.graded ? 'Grade ' + s.grade : 'Raw';
  function slotLine(i, s) { if (!s) return PART_SAYS[i];
    const st = BS.statsOf([s, s, s]); if (i === 0) { const w = BSH.wingCount(dnaOf(s), rank(s)); return SL.tierOf(s).name + ' · ' + w + ' metal wings'; } if (i === 1) return SL.tierOf(s).name + ' · ' + (SL.finishOf(s) === 'matte' ? 'steel' : (SL.FINISH[SL.finishOf(s)] || {}).name || 'metal');
    return BS.TIPS[st.tip].name + ' tip · ' + BS.TIPS[st.tip].desc.toLowerCase(); }
  function renderCard() {
    const list = mine(), full = B.slots.every(Boolean), st = full ? BS.statsOf(B.slots) : null;
    let h = '<div class="bl-h"><span class="eb">BLADES</span><h2>Build your blade</h2><p>Three slabs, three parts. Pick a part, then a slab for it.</p></div><div class="bl-slots">';
    B.slots.forEach((s, i) => { h += '<button type="button" class="bl-slot' + (B.active === i ? ' on' : '') + '" data-slot="' + i + '"' + (s ? ' style="--tc:' + tierCol(s) + '"' : '') + '><span class="bl-th">' + (s ? '<img data-th="' + s.id + '" alt="">' : '<i>' + (i + 1) + '</i>') + '</span><span class="bl-sl"><b>' + PART[i] + '</b><small>' + esc(slotLine(i, s)) + '</small></span></button>'; });
    h += '</div>';
    if (st) { h += '<div class="bl-stats">' + BS.bars(st).map(b => '<div class="bl-stat"><span>' + b[0] + '</span><i><em style="width:' + Math.round(b[1] * 100) + '%"></em></i></div>').join('') + '</div>';
      const chips = [st.dir < 0 ? 'Left spin (Negative)' : 'Right spin', st.special ? 'Special: ' + BS.SPECIALS[st.special].name : 'No special yet. A Rare or better part brings one.'];
      if (st.set) chips.push('Set bonus: one pack'); if (st.erratic) chips.push('Misprint: wobbles off line'); if (st.clear) chips.push('Clear ring'); if (st.stamped) chips.push('Stamped: survives one burst'); if (B.slots.some(s => s.variant === 'full')) chips.push('Full art: a touch stronger');
      h += '<div class="bl-chips">' + chips.map(c => '<span>' + esc(c) + '</span>').join('') + '</div>' + (st.special ? '<p class="bl-sp">' + esc(BS.SPECIALS[st.special].desc) + '. Charge it by spinning and hitting, then press Space.</p>' : ''); }
    h += '<div class="bl-pick"><span class="bl-sh">YOUR SLABS · ' + list.length + '</span>';
    if (list.length < 3) h += '<p class="bl-few">You need three slabs to build a blade. Open a pack with the big red button, or borrow a practice set for now.</p><button type="button" class="btn" data-a="borrow">Borrow a practice set</button>';
    h += '<div class="bl-grid">' + list.map(s => { const at = B.slots.indexOf(s); return '<button type="button" class="bl-s' + (at >= 0 ? ' used' : '') + '" data-id="' + s.id + '" style="--tc:' + tierCol(s) + '" title="' + esc(s.title) + '"><img data-th="' + s.id + '" alt=""><span>' + SL.tierOf(s).name + '<br>' + gradeTag(s) + '</span>' + (at >= 0 ? '<em>' + (at + 1) + '</em>' : '') + '</button>'; }).join('') + '</div></div>';
    h += '<div class="bl-acts"><button type="button" class="btn" data-a="close">Close</button><button type="button" class="btn" data-a="random"' + (list.length < 3 ? ' disabled' : '') + '>Random</button><button type="button" class="btn" data-a="look"' + (full ? '' : ' disabled') + '>Look closer</button><button type="button" class="btn primary" data-a="fight"' + (full ? '' : ' disabled') + '>Fight</button></div>';
    card.innerHTML = h;
    card.querySelectorAll('img[data-th]').forEach(img => { const s = byId(img.dataset.th) || B.slots.find(x => x && x.id === img.dataset.th); if (s) thumb(s).then(u => { if (u) img.src = u; }); });
  }
  card.addEventListener('click', e => { if (!M.is('blades.build')) return; const t = e.target.closest('[data-slot],[data-id],[data-a]'); if (!t) return; e.stopPropagation();
    if (t.dataset.slot != null) { B.active = +t.dataset.slot; S.sfx('detent'); renderCard(); return; }
    if (t.dataset.id) { const s = byId(t.dataset.id); if (!s) return; const was = B.slots.indexOf(s); if (was >= 0) B.slots[was] = null; B.slots[B.active] = s; S.sfx('ltPutDown');
      const next = B.slots.findIndex(x => !x); B.active = next >= 0 ? next : B.active; renderCard(); buildPreview(); return; }
    act(t.dataset.a); });
  function borrow() { const d = store.get(), n = d.certN; for (let i = 0; i < 3; i++) { const s = SL.roll({ graded: true, tier: ['common', 'uncommon', 'rare'][i], variant: null }); s.loaner = true; B.loaners.push(s); } d.certN = n; }
  function randomPick() { const list = mine(); if (list.length < 3) return; const pool = list.slice().sort(() => Math.random() - 0.5); B.slots = pool.slice(0, 3); B.active = 0; S.sfx('ltPutDown'); renderCard(); buildPreview(); }
  function buildPreview() { dropPreview(); if (!B.slots.every(Boolean)) return; const want = B.slots.slice();
    Promise.all(want.map(loadDNA)).then(() => { if (!M.is('blades.build') || want.some((x, i) => x !== B.slots[i])) return; dropPreview();
      B.preview = makeBlade(want, BS.statsOf(want)); B.preview.ang = 0; B.preview.root.position.set(0, 0.6, 0); rimTo(tierCol(want[0])); }); }
  function rimTo(hex) { rimLight.material.color.set(hex); floorLight.material.color.set(hex); }

  /* the rival: three rolled slabs near your blade's strength, borrowed for the match */
  function rollRival() { const d = store.get(), n = d.certN, avg = B.slots.reduce((a, s) => a + rank(s), 0) / 3, top = Math.max(...B.slots.map(rank)), ids = Object.keys(BS.RANKS);
    const parts = [0, 1, 2].map(() => { const rk = Math.max(1, Math.min(6, Math.min(top + 1, Math.round(avg - 0.4 + (Math.random() * 2 - 1))))); return SL.roll({ graded: true, tier: ids[rk - 1], variant: Math.random() < 0.1 ? undefined : null }); });
    d.certN = n; return parts; }
  function hudHtml() { const me = B.W.tops[0], rv = B.W.tops[1], row = (t, who, cls) => { const s = Math.min(1, Math.abs(t.w) / B.W.wRef), sp = t.st.special;
      return '<div class="bl-side ' + cls + '"><div class="bl-who">' + who + '<span class="bl-pips">' + Array.from({ length: BS.WIN_AT }, (_, i) => '<i' + (i < B.score[cls === 'me' ? 0 : 1] ? ' class="on"' : '') + '></i>').join('') + '</span></div>'
        + '<div class="bl-meter"><span>Spin</span><i><em style="width:' + Math.round(s * 100) + '%"></em></i></div><div class="bl-meter burst"><span>Cracks</span><i><em style="width:' + Math.round(Math.min(1, t.burst) * 100) + '%"></em></i></div>'
        + (sp ? '<div class="bl-meter sp' + (t.charge >= 1 ? ' full' : '') + '"><span>' + BS.SPECIALS[sp].name + (cls === 'me' && t.charge >= 1 ? ' · Space' : '') + '</span><i><em style="width:' + Math.round(t.charge * 100) + '%"></em></i></div>' : '') + '</div>'; };
    return row(me, 'You', 'me') + '<div class="bl-clock">' + Math.max(0, Math.ceil(BS.ROUND_S - B.W.t)) + '</div>' + row(rv, 'Rival', 'rv'); }
  let hudT = 0;
  function hudFrame(dt, force) { hudT -= dt; if (!force && hudT > 0) return; hudT = 0.1; if (B.W) hud.innerHTML = hudHtml(); }

  /* ---------- the round ---------- */
  function newRound() { clearBlades(); const st = BS.statsOf(B.slots), rs = BS.statsOf(B.rivalParts);
    B.me = makeBlade(B.slots, st, 'me'); B.rival = makeBlade(B.rivalParts, rs, 'rival');
    const a = BS.makeTop(st, 1), b = BS.makeTop(rs, -1); B.W = BS.world(a, b); B.acc = 0;
    a.p = { x: 0, y: R * 0.62 }; b.p = { x: 0, y: -R * 0.62 }; a.w = st.dir * 6; b.w = rs.dir * 6;
    B.me.drop = B.rival.drop = 1.1; B.rivalPlan = BS.aiLaunch(); }
  function clearBlades() { [B.myL, B.rvL].forEach(L => { if (L) L.dispose(); }); B.myL = B.rvL = null; [B.me, B.rival].forEach(b => { if (b) b.dispose(); }); B.me = B.rival = null; B.debris.forEach(d => { d.g.removeFromParent(); }); B.debris = []; if (aim) aim.visible = false; }
  /* the aim: a thin arrow on the bowl from your blade, as long as the pull */
  /* ---------- the launcher (Sam's photo): a pistol grip, a housing the blade hangs under, a toothed ripcord with a winged handle ---------- */
  function makeLauncher(col) { return BL.makeLauncher(col, ENV); }   /* the ripper, modelled in bladelauncher.js */
  /* the table's Blades button is the ripper you launch with in the game (Sam): the old toy launcher is swapped out for it */
  { btn.children.slice().forEach(c => { btn.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); });
    const L = makeLauncher(0x23409a); L.g.scale.setScalar(0.4); L.g.position.set(-0.15, 0.02, -0.75); btn.add(L.g);
    const sh = S.shadow(1.0, 1.7); sh.position.set(-0.12, 0.004, 0.05); btn.add(sh);
    btn.userData.L = L; btn.userData.top = null; btn.userData.cap = null; btn.rotation.y = 0.35; }
  const aim = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false })); aim.geometry.translate(0, 0.5, 0); aim.rotation.x = -Math.PI / 2; aim.visible = false; stadium.add(aim);
  function doLaunch(power, ang) { const [a, b] = B.W.tops, lx = a.p.x; BS.launch(a, power, ang); a.p.x = lx; BS.launch(b, B.rivalPlan.power, B.rivalPlan.aim); B.me.drop = B.rival.drop = LAUNCH_H - 0.75; B.ripT = 0;
    B.me.whirr = whirr(B.me); B.rival.whirr = whirr(B.rival); aim.visible = false; { const z = sx(); if (z) z.rip(power); } B.shake = 0.35;
    [a, b].forEach(t => { spark(t.p.x, hB(Math.hypot(t.p.x, t.p.y)) + 0.05, t.p.y, 40, [0xffffff, 0xffd08a], 3.5); wave(t.p.x, t.p.y, 2, 0xffffff); }); M.go('blades.battle'); }
  function fx(ev) {
    const [a, b] = B.W.tops, blOf = t => t === a ? B.me : B.rival;
    for (const e of ev) {
      if (e.type === 'hit') { const y = hB(Math.hypot(e.x, e.y)) + 0.45, n = Math.min(90, Math.round(8 + e.k * 16)); spark(e.x, y, e.y, n, [tierCol(B.me.slabs[0]), tierCol(B.rival.slabs[0]), 0xffe2a0, 0xffffff], 2.5 + e.k * 1.2);
        flash(e.x, y, e.y, e.k, e.k > 3 ? 0xffffff : 0xffe2a0); hitLight.position.set(e.x, y + 0.3, e.y); hitLight.userData.k = Math.max(hitLight.userData.k, Math.min(1, e.k / 4)); if (e.k > 5) screenFlash(0.35); B.shake = Math.max(B.shake, Math.min(0.45, e.k * 0.06));
        /* the big ones land: a shockwave, a freeze frame, and the really big ones go to slow motion */
        if (e.k > 2.5) { wave(e.x, e.y, e.k); shards(e.x, y, e.y, Math.min(14, Math.round(e.k * 2.2)), [B.me.metalCol, B.rival.metalCol], 1.5 + e.k * 0.6); }
        if (B.cine && B.cine.t > 0) { B.cine.t = Math.min(B.cine.t, 0.35); B.slowT = 0.12; B.slowK = 0.4; B.shake = Math.max(B.shake, 0.7); flash(e.x, y, e.y, 9, 0xffffff); wave(e.x, e.y, 9, 0xffffff); shards(e.x, y, e.y, 18, [B.me.metalCol, B.rival.metalCol], 5); } if (e.k > 3) B.stop = Math.min(0.12, 0.04 + e.k * 0.012); if (e.k > 5.5) { B.slowT = 0.45; B.slowK = 0.35; }
        const z = sx(); if (z) { if (e.k > 0.9) z.hit(e.k, panOf(e.x)); else z.grind(panOf(e.x)); } B.me.grind = B.rival.grind = Math.min(1, (B.me.grind || 0) + 0.3); }
      else if (e.type === 'wall') { const z = sx(); if (z && e.k > 0.6) z.wall(e.k, panOf(e.x)); spark(e.x, DEP + 0.2, e.y, Math.round(e.k * 4), 0xffd08a, 1.5); }
      else if (e.type === 'shield') { banner('Stamped!', 'One burst saved', 1300); snd('chime', { tier: 'rare' }); }
      else if (e.type === 'special') { const bl = blOf(e.top), p = e.top.p, y = hB(Math.hypot(p.x, p.y)) + 0.5, who = e.top === a ? 'You' : 'Rival', nm = BS.SPECIALS[e.id].name;
        banner(nm + '!', who === 'You' ? '' : 'Your rival', 1200);
        if (e.id === 'starburst') { spark(p.x, y, p.y, 120, [0xffffff, 0xff4fae, 0xffe08a], 6); snd('burst', { tier: 'epic' }); }
        else if (e.id === 'slam') { spark(p.x, y, p.y, 80, [0xffd58a, 0xd9962a], 4); snd('slam'); }
        else if (e.id === 'guard') { spark(p.x, y, p.y, 60, [0xa9edff, 0xffffff], 3); snd('glow'); }
        else if (e.id === 'eclipse') { veil.classList.remove('on'); void veil.offsetWidth; veil.classList.add('on'); snd('chime', { tier: 'mythic' }); spark(p.x, y, p.y, 100, [0xff3fd0, 0x8a4cff, 0xffffff], 5); }
        if (bl) bl.halo.material.opacity = 1; }
      else if (e.type === 'dash') { const bl = blOf(e.top), i = e.top === a ? 0 : 1; railFlash.k = 1; spark(e.x, DEP, e.y, 30, [0xff7a2a, 0xffd08a, 0xffffff], 4); B.shake = Math.max(B.shake, 0.15); { const z = sx(); if (z) z.dash(panOf(e.x)); } B.speedK = Math.max(B.speedK || 0, 0.5);
        const el = tags.children[i]; if (el && el.classList.contains('who')) { el.textContent = 'X Dash!'; el.classList.add('dash'); clearTimeout(el._t); el._t = setTimeout(() => { el.textContent = i ? 'Rival' : 'You'; el.classList.remove('dash'); }, 900); } }
      else if (e.type === 'xdash') { const i = e.top === a ? 0 : 1; B.speedK = 1; spark(e.x, DEP * 0.8, e.y, 40, [0xff7a2a, 0xffffff], 5); B.shake = Math.max(B.shake, 0.25); { const z = sx(); if (z) z.dash(panOf(e.x)); }
        const el = tags.children[i]; if (el && el.classList.contains('who')) { el.textContent = 'Xtreme Dash!'; el.classList.add('dash'); clearTimeout(el._t); el._t = setTimeout(() => { el.textContent = i ? 'Rival' : 'You'; el.classList.remove('dash'); }, 1000); } }
      else if (e.type === 'burst') { burstApart(blOf(e.top), e.top); screenFlash(0.7); B.slowT = 1.1; B.slowK = 0.3; B.shake = 0.6; flash(e.top.p.x, 0.6, e.top.p.y, 8, 0xffffff); wave(e.top.p.x, e.top.p.y, 8, tierCol(blOf(e.top).slabs[0])); }
      else if (e.type === 'out') { const bl = blOf(e.top), t = e.top, r = Math.hypot(t.p.x, t.p.y) || 1; bl.dead = 'out'; const pa = e.a != null ? e.a : Math.atan2(t.p.y, t.p.x); bl.fly = { x: t.p.x, z: t.p.y, y: hB(r), vx: Math.cos(pa) * 4.5, vz: Math.sin(pa) * 4.5, vy: 2.6, spin: t.w }; if (e.zone === 'xtreme') { const el = tags.children[e.top === a ? 0 : 1]; railFlash.k = 1; B.speedK = 1; } { const z = sx(); if (z) z.ringOut(panOf(t.p.x)); } screenFlash(0.5); B.slowT = 1.0; B.slowK = 0.3; B.shake = 0.5; flash(t.p.x, DEP + 0.4, t.p.y, 7, 0xffffff); }
      else if (e.type === 'down') { blOf(e.top).dead = 'spin'; snd('land'); }
    }
  }
  /* a burst: the three parts come apart and scatter, each spinning off on its own */
  function burstApart(bl, t) { bl.dead = 'burst'; { const z = sx(); if (z) z.burst(panOf(t.p.x)); } const p = t.p, y = hB(Math.hypot(p.x, p.y)) + 0.4; spark(p.x, y, p.y, 140, [tierCol(bl.slabs[0]), tierCol(bl.slabs[1]), tierCol(bl.slabs[2]), 0xffffff], 6);
    bl.root.updateMatrixWorld(true); bl.parts.forEach((g, i) => { stadium.attach(g); const a = Math.random() * 6.2832, s = 2.4 + Math.random() * 2;
      B.debris.push({ g, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 3 + i * 1.2 + Math.random(), wx: (Math.random() - 0.5) * 12, wz: (Math.random() - 0.5) * 12, wy: t.w * 0.3, t: 0 }); });
    if (bl.whirr) { bl.whirr.stop(); bl.whirr = null; } bl.halo.visible = false; }
  function debrisFrame(dt) { B.debris.forEach(d => { d.t += dt; const g = d.g, r = Math.hypot(g.position.x, g.position.z), floor = r < R ? hB(r) + 0.05 : r < R + 0.45 ? DEP + 0.47 : -LIFT;
      d.vy -= 14 * dt; g.position.x += d.vx * dt; g.position.y += d.vy * dt; g.position.z += d.vz * dt; g.rotation.x += d.wx * dt; g.rotation.z += d.wz * dt; g.rotation.y += d.wy * dt;
      if (r < R && r > R - 0.2 && g.position.y < DEP + 0.4) { d.vx *= -0.5; d.vz *= -0.5; }
      if (g.position.y < floor) { g.position.y = floor; d.vy = Math.abs(d.vy) * 0.35; d.vx *= 0.6; d.vz *= 0.6; d.wx *= 0.5; d.wz *= 0.5; d.wy *= 0.7; }
      if (d.t > 2.6) g.scale.multiplyScalar(Math.max(0, 1 - dt * 3)); }); }
  function deadFrame(bl, t, dt) { if (!bl.dead) return; bl.deadT += dt; if (bl.marker) bl.marker.material.opacity = Math.max(0, 0.9 - bl.deadT * 1.5);
    if (bl.dead === 'spin') { t.w *= Math.exp(-dt * 2.5); t.ang += t.w * dt; t.v.x *= Math.exp(-dt * 3); t.v.y *= Math.exp(-dt * 3); t.p.x += t.v.x * dt; t.p.y += t.v.y * dt; t.wob = 0;
      const k = Math.min(1, bl.deadT / 0.7); pose(bl, t, dt); wAxis.set(t.p.y, 0, -t.p.x).normalize(); if (!wAxis.lengthSq()) wAxis.set(1, 0, 0); wq.setFromAxisAngle(wAxis.lengthSq() ? wAxis : up, 1.15 * E.outBounce(k)); bl.tilt.quaternion.copy(bl.tiltN).multiply(wq); }
    else if (bl.dead === 'out' && bl.fly) { const f = bl.fly; f.vy -= 14 * dt; f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt; let r = Math.hypot(f.x, f.z); if (r > R + 0.9) { f.x *= (R + 0.9) / r; f.z *= (R + 0.9) / r; f.vx *= -0.3; f.vz *= -0.3; r = R + 0.9; } const floor = r > R + 0.05 ? DEP - 0.1 : hB(r);   /* down into the pocket's tray */
      if (f.y < floor) { f.y = floor; f.vy = Math.abs(f.vy) * 0.3; f.vx *= 0.5; f.vz *= 0.5; f.spin *= 0.5; } bl.root.position.set(f.x, f.y, f.z); t.ang += f.spin * dt; bl.spin.rotation.y = -t.ang; bl.tilt.rotation.x += dt * 2; if (bl.whirr) bl.whirr.set(0.3, f.x / R); } }

  /* ---------- the machine ---------- */
  const FRAME = () => ({ tx: CX, ty: LIFT, tz: CZ + 1.0, pitch: 55, dT: ctx.fitDist(2 * R + 4, 2 * R + 4.5, 55) });
  /* ease the camera towards a framing (dt) or set it for the room's own smoothing to take there (no dt) */
  function camTo(tx, tz, size, dt, pitch) { const c = ctx.cam, pt = pitch || 55, d = ctx.fitDist(size, size, pt); if (dt) { c.tx = T.damp(c.tx, tx, 2.5, dt); c.tz = T.damp(c.tz, tz, 2.5, dt); c.dT = T.damp(c.dT, d, 2.5, dt); c.pitch = T.damp(c.pitch, pt, 2.5, dt); } else { c.tx = tx; c.tz = tz; c.dT = d; c.pitch = pt; } }
  /* You and Rival tags over the blades while they're in the bowl */
  function battleTags() { const on = (M.is('blades.ready') || M.is('blades.battle') || M.is('blades.round')) && B.me && B.rival;
    tags.classList.toggle('on', !!on); if (!on) return; if (!tags.querySelector('.who')) tags.innerHTML = '<div class="bl-tag who me">You</div><div class="bl-tag who rv">Rival</div>';
    [B.me, B.rival].forEach((bl, i) => { const el = tags.children[i]; if (!el) return; const gone = bl.dead === 'burst' || (bl.dead === 'out' && bl.deadT > 1); const p = toScreen(bl.root, 1.25); el.style.opacity = gone || !p.on ? 0 : 1; el.style.transform = 'translate(' + Math.round(p.x - el.offsetWidth / 2) + 'px,' + Math.round(p.y - el.offsetHeight) + 'px)'; }); }
  M.define('blades', {
    on: { CLOSE: () => 'blades.closing' },
    key(e, M) { if (e.key === 'Escape') M.send('CLOSE'); return true; },
    pointer(kind, e) { if (kind === 'wheel') { ctx.cam.dT = T.clamp(ctx.cam.dT * Math.exp(e.deltaY * 0.0012), 8, 40); } return true; },
    frame(dt) { dt = Math.min(dt, 0.05); sparkFrame(dt); debrisFrame(dt); fxFrame(dt); shardFrame(dt); if (!M.is('blades.build.inspect')) battleTags(); (B.spares || []).forEach(bl => { bl.spin.rotation.y += dt * 0.15; });
      B.gallery.forEach(g => { g.ang += dt * 2; g.spin.rotation.y = -g.ang; });
      if (B.preview && M.is('blades.build') && !M.is('blades.build.inspect')) { B.preview.ang += dt * 9; B.preview.spin.rotation.y = -B.preview.ang; B.preview.fins.forEach(f => { try { f.def.update(f.m, { tilt: new THREE.Vector2(Math.cos(B.preview.ang * 0.1) * 0.7, Math.sin(B.preview.ang * 0.1) * 0.7), pointer: new THREE.Vector2(0.5, 0.5), dt, time: T.time() }); } catch (e) {} }); } },
  });
  M.define('blades.open', { busy: true, on: { CLOSE: () => undefined },
    async enter(d, run) {
      B.pushed = true; S.cam.push(FRAME()); ctx.hideActs(); hideBar(); S.sfx('ltInspect'); btn.userData.hotT = 0; ctx.canvas.style.cursor = 'default';
      await S.under.doors(true); if (!run.alive()) return;
      stadium.visible = true; spot.visible = true; key.visible = rim.visible = true; stadium.scale.setScalar(0.5); stadium.position.y = DOWN; snd('rise', { dur: 1.6 }); snd('servo');
      T.to(spot, { intensity: 140 }, { dur: 1.6, tag: 'blades' });
      await T.to(stadium.position, { y: LIFT - 0.4 }, { dur: 1.5, ease: E.outCubic, tag: 'blades' }); if (!run.alive()) return;
      snd('land'); await T.par(T.to(stadium.position, { y: LIFT }, { dur: 0.6, ease: E.outBack, tag: 'blades' }), T.tween({ dur: 0.7, ease: E.outBack, tag: 'blades', update: e => stadium.scale.setScalar(0.5 + 0.5 * e) })); if (!run.alive()) return;
      stadium.scale.setScalar(1); M.go('blades.build');
    },
  });
  M.define('blades.build', {
    enter(d) { if (M.prev === 'blades.build.inspect') { renderCard(); card.classList.add('on'); return; } hud.classList.remove('on'); hideBar(); hideBanner(); tip.classList.remove('on'); clearBlades(); clearSpares(); camTo(CX, CZ + 1.0, 2 * R + 3.5); B.slots = B.slots.map(s => s && byId(s.id) ? s : null); if (!B.slots.every(Boolean)) { const n = B.slots.findIndex(x => !x); B.active = n >= 0 ? n : 0; } renderCard(); card.classList.add('on'); buildPreview(); },
    exit(next) { card.classList.remove('on'); if (!/^blades\.build/.test(next || '')) dropPreview(); },
  });
  function dropPreview() { if (B.preview) { B.preview.dispose(); B.preview = null; } B.gallery.forEach(g => { g.dispose(); g.slabs.forEach(x => { SM.forgetPhoto(x.id); DNA.delete(x.id); }); }); B.gallery = []; }
  /* nine random blades laid out in the bowl, to see how different photos make different shapes (dev panel) */
  function gallery() { if (!M.is('blades.build')) { S.toast('Open Blades first, then try again.'); return; } dropPreview(); card.classList.remove('on');
    const d = store.get(), n0 = d.certN, ids = Object.keys(BS.RANKS), sets = [];
    for (let i = 0; i < 9; i++) sets.push([0, 1, 2].map(k => SL.roll({ graded: true, tier: ids[Math.min(5, Math.floor(i * 0.7) + (k === 0 ? 0 : Math.floor(Math.random() * 2)))] })));
    d.certN = n0; Promise.all(sets.flat().map(loadDNA)).then(() => { if (!M.is('blades.build')) return;
      B.gallery = sets.map((p, i) => { const bl = makeBlade(p, BS.statsOf(p)); bl.root.position.set(((i % 3) - 1) * 2.3, 0.35, (Math.floor(i / 3) - 1) * 2.3); bl.ang = i; return bl; }); }); }
  /* ---------- look closer: your blade lifted up to the camera, drag to turn it, take it apart to see each slab ---------- */
  const tags = S.el('div', 'bl-tags', ''); tags.id = 'skBlTags'; document.body.appendChild(tags);
  const tip = S.el('div', 'bl-tip', ''); tip.id = 'skBlTip'; document.body.appendChild(tip);
  const PART_GIVES = [null, st => 'Weight ' + st.mass.toFixed(2) + ' · stamina ' + st.stamina.toFixed(2), st => BS.TIPS[st.tip].name + ' tip · ' + BS.TIPS[st.tip].desc.toLowerCase()];
  const v3 = new THREE.Vector3();
  function toScreen(obj, dy) { obj.updateMatrixWorld(true); obj.getWorldPosition(v3); v3.y += dy || 0; v3.project(S.camera); const r = ctx.canvas.getBoundingClientRect(); return { x: r.left + (v3.x + 1) / 2 * r.width, y: r.top + (1 - v3.y) / 2 * r.height, on: v3.z < 1 }; }
  function inspectTags() { const P = B.preview; if (!P) return; const st = BS.statsOf(B.slots);
    tags.innerHTML = P.parts.map((g, i) => { const s2 = B.slots[i], t = SL.tierOf(s2); return '<div class="bl-tag part" data-i="' + i + '" style="--tc:' + t.color + '"><b>' + PART[i] + '</b><span>' + esc(s2.title || '') + '</span><span>' + t.name + ' · ' + gradeTag(s2) + (s2.variant ? ' · ' + SL.VARIANT[s2.variant].name : '') + '</span><em>' + esc(i === 0 ? PART_SAYS[0] : PART_GIVES[i](st)) + '</em></div>'; }).join(''); }
  M.define('blades.build.inspect', {
    enter() { const P = B.preview; if (!P) { M.go('blades.build'); return; } B.look = { yaw: 0, pitch: 0.35, apart: false, k: 0, drag: null, r: P.st.radius };
      S.cam.push({ tx: CX, ty: LIFT + 2.0 + 0.45, tz: CZ, pitch: 24, dT: ctx.fitDist(4.6, 4.6, 24) }); ctx.canvas.style.cursor = 'grab';
      T.to(P.root.position, { y: 2.0 }, { dur: 0.6, ease: E.outCubic, tag: 'blades' }); T.tween({ dur: 0.6, ease: E.outCubic, tag: 'blades', update: e => P.root.scale.setScalar(B.look.r * (1 + 2.4 * e)) });
      inspectTags(); tags.classList.add('on'); lookBar(); S.sfx('ltInspect'); },
    exit(next) { const P = B.preview; tags.classList.remove('on'); hideBar(); S.cam.pop(); ctx.canvas.style.cursor = 'default';
      if (P) { P.root.position.y = 0.6; P.root.scale.setScalar(B.look.r); P.tilt.rotation.set(0, 0, 0); P.parts.forEach(g => { g.position.y = 0; }); }
      if (!/^blades\.build/.test(next || '')) dropPreview(); },
    pointer(kind, e) { const L = B.look;
      if (kind === 'down' && e.button === 0) { L.drag = { x: e.clientX, y: e.clientY }; ctx.canvas.style.cursor = 'grabbing'; return true; }
      if (kind === 'move' && L.drag) { L.yaw += (e.clientX - L.drag.x) * 0.012; L.pitch = T.clamp(L.pitch + (e.clientY - L.drag.y) * 0.008, -0.5, 1.3); L.drag = { x: e.clientX, y: e.clientY }; return true; }
      if (kind === 'up') { L.drag = null; ctx.canvas.style.cursor = 'grab'; return true; }
      return kind !== 'wheel'; },
    frame(dt) { const P = B.preview, L = B.look; if (!P) return; if (!L.drag) L.yaw += dt * 0.5; P.spin.rotation.y = -L.yaw; P.tilt.rotation.x = T.damp(P.tilt.rotation.x, L.pitch, 10, dt);
      L.k = T.damp(L.k, L.apart ? 1 : 0, 6, dt); P.parts[0].position.y = 0.5 * L.k; P.parts[1].position.y = 0.22 * L.k; P.parts[2].position.y = -0.2 * L.k;
      const el = tags.children; for (let i = 0; i < el.length; i++) { const p = toScreen(P.parts[i], 0.62 * P.root.scale.x * [0.75, 0.55, 0.3][i]), side = [1, -1, 1][i];
        el[i].style.transform = 'translate(' + Math.round(p.x + side * (60 + 30 * L.k) - (side < 0 ? el[i].offsetWidth : 0)) + 'px,' + Math.round(p.y - el[i].offsetHeight / 2 + (i - 1) * 46 * (1 - L.k)) + 'px)'; el[i].style.opacity = L.k > 0.5 || i === 0 ? 1 : 0.35 + 0.65 * L.k; } },
  });
  function lookBar() { showBar([['back', 'Back'], ['apart', B.look && B.look.apart ? 'Put it together' : 'Take it apart'], ['fight', 'Fight', true]]); }
  /* where the launcher sits over the bowl: your side, the rival's across */
  const LAUNCH_H = 2.4, CORD_MAX = 4.2;
  function launcherPose(L, x, z, side, cordLen, k) { const r = Math.hypot(x, z); L.g.position.set(x + 0.15 * side, hB(r) + LAUNCH_H * k, z); L.g.rotation.y = side > 0 ? 0 : Math.PI; L.g.scale.setScalar(0.62 * k); L.setCord(cordLen); }
  M.define('blades.ready', {
    enter() { hideBar(); newRound(); ctx.canvas.style.cursor = 'grab'; B.aimDrag = null; B.shake = 0; B.stop = 0; B.slowT = 0; camTo(CX, CZ + R * 0.6, 10.5, 0, 36);
      tip.innerHTML = 'Drag the launcher (or A and D) to aim. Grab the ripcord and yank it out fast: the faster the pull, the better the rip.'; tip.classList.add('on'); hud.classList.add('on'); hudFrame(0, true);
      [B.myL, B.rvL].forEach(L => { if (L) L.dispose(); }); B.myL = makeLauncher(new THREE.Color().setHSL(dnaOf(B.slots[0]).hue, 0.8, 0.28)); B.rvL = makeLauncher(0xb3261e); stadium.add(B.myL.g, B.rvL.g);
      B.me.root.scale.setScalar(B.me.st.radius); B.lx = 0; B.pull = null; B.ripK = 1;
      const rs = B.rivalParts[0]; banner(B.score[0] + B.score[1] ? 'Round ' + (B.roundN = (B.roundN || 1) + 1) : 'Ready, set', 'Your rival: ' + esc((rs.photo && rs.photo.pack || 'Sample pack').replace(/\s*·.*$/, '')) + ' blade, ' + BS.TIPS[BS.statsOf(B.rivalParts).tip].name.toLowerCase() + ' tip', 0); rimTo(tierCol(B.slots[0])); },
    pointer(kind, e) {
      const P = B.pull, A = B.aimDrag;
      /* the launcher stays where it is: drag its body to aim, take hold of the cord (or anywhere else) to pull */
      const part = ev => { const h = B.myL && S.hitAny(ev, [B.myL.g]); if (!h) return null; let o = h.object; while (o) { if (B.myL.grab.includes(o)) return 'cord'; o = o.parent; } return 'body'; };
      if (kind === 'move' && A) { const h = S.tableHit(e, LIFT + LAUNCH_H); if (h) B.lx = T.clamp(A.lx + (h.x - A.x), -R * 0.4, R * 0.4); return true; }
      if (kind === 'up' && A) { B.aimDrag = null; ctx.canvas.style.cursor = 'grab'; return true; }
      if (kind === 'move' && !P) { const k = part(e); ctx.canvas.style.cursor = k === 'body' ? 'ew-resize' : 'grab'; return true; }
      if (kind === 'down' && e.button === 0 && part(e) === 'body') { const h = S.tableHit(e, LIFT + LAUNCH_H); if (h) { B.aimDrag = { x: h.x, lx: B.lx }; ctx.canvas.style.cursor = 'ew-resize'; return true; } }
      if (kind === 'down' && e.button === 0) { B.pull = { x: e.clientX, y: e.clientY, len: 0, tick: 0, pts: [{ t: performance.now(), d: 0 }] }; ctx.canvas.style.cursor = 'grabbing'; snd('servo'); hideBanner(); return true; }
      if (kind === 'move' && P) { const d = Math.hypot(e.clientX - P.x, e.clientY - P.y), now = performance.now(); P.pts.push({ t: now, d }); if (P.pts.length > 12) P.pts.shift();
        P.len = Math.min(CORD_MAX, d / 75 / 0.62); const sp = ripSpeed(P); if (Math.floor(P.len * 5) > P.tick) { P.tick = Math.floor(P.len * 5); if (S.snd && S.snd.tick) S.snd.tick(Math.min(1, sp / 3)); }
        if (P.len >= CORD_MAX) rip(); return true; }
      if (kind === 'up' && P) { rip(); return true; }
      return kind !== 'wheel'; },
    key(e) { const k = e.key; if (k === 'a' || k === 'A' || k === 'ArrowLeft') { B.lx = T.clamp(B.lx - 0.3, -R * 0.4, R * 0.4); return true; } if (k === 'd' || k === 'D' || k === 'ArrowRight') { B.lx = T.clamp(B.lx + 0.3, -R * 0.4, R * 0.4); return true; } return false; },
    frame(dt) { if (!B.W) return; const [a, b] = B.W.tops, P = B.pull, dir = BS.statsOf(B.slots).dir;
      a.p.x = T.damp(a.p.x, B.lx, 12, dt); a.p.y = R * 0.62; b.p.x = 0; b.p.y = -R * 0.62;
      /* the cord winds the blade up as it comes out */
      a.w = dir * (6 + (P ? P.len : 0) * 16); a.ang += a.w * dt; b.ang += b.w * dt; pose(B.me, a, dt); pose(B.rival, b, dt);
      launcherPose(B.myL, a.p.x, a.p.y, 1, P ? P.len : 0, 1); launcherPose(B.rvL, b.p.x, b.p.y, -1, 0, 1);
      B.me.root.position.y = hB(Math.hypot(a.p.x, a.p.y)) + LAUNCH_H - 0.75; B.rival.root.position.y = hB(Math.hypot(b.p.x, b.p.y)) + LAUNCH_H - 0.75; },
  });
  /* how fast the cord came out over the last tenth of a second, in px per ms */
  function ripSpeed(P) { const p = P.pts, now = p[p.length - 1]; let best = 0; for (let i = p.length - 2; i >= 0; i--) { const dt = now.t - p[i].t; if (dt > 140) break; if (dt > 4) best = Math.max(best, (now.d - p[i].d) / dt); } return best; }
  const RIP = [[0.9, 'Perfect rip!'], [0.65, 'Great rip!'], [0.35, 'Good rip'], [0, 'Weak rip']];
  function rip() { const P = B.pull; if (!P) return; B.pull = null; ctx.canvas.style.cursor = 'default';
    if (P.len < 0.6) { banner('Yank the cord', 'Grab it and pull fast', 1300); return; }
    const sp = ripSpeed(P), q = T.clamp((sp - 0.35) / 2.4, 0, 1) * T.clamp(P.len / 2.2, 0.4, 1), power = 0.2 + 0.8 * q, label = RIP.find(r => q >= r[0])[1];
    tip.classList.remove('on'); doLaunch(power, B.lx / (R * 0.4) * 0.35); banner(label, 'Rip ' + Math.round(q * 100) + '%', 1100); }
  M.define('blades.battle', {
    enter() { ctx.canvas.style.cursor = 'default'; },
    key(e) { if (e.key === ' ') { const ev = []; if (BS.special(B.W, B.W.tops[0], ev)) fx(ev); return true; } return false; },
    frame(dt) { dt = Math.min(dt, 0.05); const W = B.W, [a, b] = W.tops, real = dt;
      /* the speed lines follow a dive or a dash; the sound goes muffled while it's slowed */
      B.speedK = (B.speedK || 0) * Math.exp(-real * 3); speedEl.style.opacity = Math.min(0.9, (B.cine && B.cine.t > 0 ? 0.85 : 0) + B.speedK * 0.6).toFixed(2);
      { const slowNow = B.slowT > 0 && B.slowK < 0.5; if (slowNow !== !!B.slowOn) { B.slowOn = slowNow; const z = sx(); if (z) z.slow(slowNow); } }
      /* a freeze frame on a big hit, slow motion on the biggest */
      if (B.stop > 0) { B.stop -= real; dt = 0; } else if (B.slowT > 0) { B.slowT -= real; dt *= B.slowK; }
      B.me.drop *= Math.exp(-dt * 14); B.rival.drop *= Math.exp(-dt * 14);
      if (B.myL) { B.ripT = (B.ripT || 0) + real; const k = B.ripT; [B.myL, B.rvL].forEach((L, i) => { L.setCord(Math.max(0, (i ? 3 : 1.5) * (1 - k * 6))); L.g.position.y += real * (2 + k * 18); L.g.scale.setScalar(Math.max(0.001, 0.62 * (1 - k * 1.6))); }); if (k > 0.65) { B.myL.dispose(); B.rvL.dispose(); B.myL = B.rvL = null; } }
      B.acc += dt * BS.TIME; const ev = []; while (B.acc >= 1 / 120) { B.acc -= 1 / 120; BS.step(W, 1 / 120, ev); if (BS.aiThink(W, b, 1 / 120)) BS.special(W, b, ev); }
      fx(ev);
      /* now and then, just before a big crash: everything slows, the camera dives in, then it lands */
      B.cineCd = (B.cineCd || 0) - real;
      if (a.alive && b.alive && !(B.cine && B.cine.t > 0) && B.cineCd <= 0 && B.slowT <= 0 && W.t > 1.5) { const nx = b.p.x - a.p.x, nz = b.p.y - a.p.y, d = Math.hypot(nx, nz) || 1, gap = d - a.st.radius - b.st.radius, close = -((b.v.x - a.v.x) * nx + (b.v.y - a.v.y) * nz) / d;
        if (gap > 0.1 && gap < 1.1 && close > 5.5 && Math.random() < 0.6) { B.cine = { t: 0.9, x: (a.p.x + b.p.x) / 2, z: (a.p.y + b.p.y) / 2 }; B.slowT = 0.9; B.slowK = 0.12; B.cineCd = 5; snd('rumble', { gain: 0.8, dur: 0.9 }); snd('glow'); } }
      const vdt = dt * BS.TIME; if (a.alive) pose(B.me, a, vdt); else deadFrame(B.me, a, vdt); if (b.alive) pose(B.rival, b, vdt); else deadFrame(B.rival, b, vdt);
      /* the camera leans towards the action, never far from the middle of the bowl */
      const mx = (a.p.x + b.p.x) / 2, mz = (a.p.y + b.p.y) / 2; if (B.cine && B.cine.t > 0) { B.cine.t -= real; camTo(CX + B.cine.x, CZ + B.cine.z + 1.4, 4.2, real * 3, 30); } else { /* low and close, from your side, pulling out to keep both blades in frame as they part */ const gap = Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y); camTo(CX + mx * 0.75, CZ + 0.7 + mz * 0.75, T.clamp(gap * 1.25 + 4.2, 6.5, 11.5), real, 33); }
      hudFrame(dt); const o = BS.outcome(W); if (o) M.go('blades.round', o); },
  });
  M.define('blades.round', { busy: true,
    /* the winner keeps spinning and the loser finishes falling, for a beat */
    frame(dt) { dt = Math.min(dt, 0.05); if (B.slowT > 0) { B.slowT -= dt; dt *= B.slowK; } const [a, b] = B.W.tops; [[a, B.me], [b, B.rival]].forEach(([t, bl]) => { if (!bl) return; const vdt = dt * BS.TIME; if (t.alive) { t.ang += t.w * vdt; t.w *= Math.exp(-vdt * 0.3); pose(bl, t, vdt); } else deadFrame(bl, t, vdt); }); },
    async enter(o, run) { const W = B.W, [a, b] = W.tops, won = o.winner === a; tip.classList.remove('on'); setTimeout(() => { speedEl.style.opacity = 0; const z = sx(); if (z && B.slowOn) { B.slowOn = false; z.slow(false); } }, 1200); B.score[won ? 0 : 1] += o.pts; hudFrame(0, true);
      if (o.how === 'time') { [a, b].forEach(t => { if (t !== o.winner) { t.alive = false; (t === a ? B.me : B.rival).dead = 'spin'; } }); }
      banner(HOW[o.how] + '!', (won ? 'You' : 'Your rival') + ' +' + o.pts + (o.pts === 1 ? ' point' : ' points'), 0); snd(won ? 'chime' : 'sink', won ? { tier: o.pts > 1 ? 'epic' : 'rare' } : { dur: 0.8 });
      await T.wait(2.4, 'blades'); if (!run.alive()) return; [B.me, B.rival].forEach(bl => { if (bl && bl.whirr) { bl.whirr.stop(); bl.whirr = null; } });
      if (B.score[0] >= BS.WIN_AT || B.score[1] >= BS.WIN_AT) M.go('blades.result'); else M.go('blades.ready'); },
  });
  M.define('blades.result', {
    enter() { const win = B.score[0] >= BS.WIN_AT; hudFrame(0, true); camTo(CX, CZ + 1.0, 2 * R + 3.5); banner(win ? 'You win the match' : 'Your rival takes it', B.score[0] + ' to ' + B.score[1], 0); snd(win ? 'countFinal' : 'sink'); if (win) snd('chime', { tier: 'legendary' });
      showBar([['done', 'Done'], ['rebuild', 'Change parts'], ['rematch', 'Rematch', true]]); },
    exit() { hideBar(); },
  });
  M.define('blades.closing', { busy: true, on: { CLOSE: () => undefined },
    /* whatever goes wrong on the way down, the stadium goes, the pit closes and the camera comes back */
    async enter(d, run) { let doorsShut = false;
      try { card.classList.remove('on'); hud.classList.remove('on'); tags.classList.remove('on'); tip.classList.remove('on'); hideBar(); hideBanner(); B.drag = null; clearBlades(); clearSpares(); dropPreview();
        snd('sink', { dur: 1.4 }); T.to(spot, { intensity: 0 }, { dur: 1.2, tag: 'blades' });
        await T.tween({ dur: 0.5, ease: E.inBack, tag: 'blades', update: e => stadium.scale.setScalar(1 - 0.5 * e) });
        await T.to(stadium.position, { y: DOWN }, { dur: 1.2, ease: E.inCubic, tag: 'blades' });
        stadium.visible = false; spot.visible = false; key.visible = rim.visible = false; await S.under.doors(false); doorsShut = true; }
      catch (e) { console.error('blades closing', e); }
      finally { stadium.visible = false; spot.visible = false; key.visible = rim.visible = false; stadium.position.y = DOWN; if (!doorsShut) { try { S.hole.close(); } catch (e) {} }
        if (B.pushed) { S.cam.pop(); B.pushed = false; } forgetRival(); S.sfx('detent'); B.score = [0, 0]; B.roundN = 1; B.starting = false;
        if (M.is('blades.closing')) M.go(S.under.on ? 'under' : 'idle'); } },
  });
  function forgetRival() { if (B.rivalParts) B.rivalParts.forEach(s => { SM.forgetPhoto(s.id); DNA.delete(s.id); }); B.rivalParts = null; }
  function startMatch() { if (B.starting) return; B.starting = true; B.score = [0, 0]; B.roundN = 1; forgetRival(); const parts = B.rivalParts = rollRival();
    const sets = spareSets();
    Promise.all(B.slots.concat(parts, sets.flat()).map(loadDNA)).then(() => { B.starting = false; if (B.rivalParts === parts && (M.is('blades.build') || M.is('blades.result'))) { placeSpares(sets); M.go('blades.ready'); } }); }
  function act(a) {
    if (a === 'close' || a === 'done') M.send('CLOSE');
    else if (a === 'borrow') { borrow(); randomPick(); }
    else if (a === 'random') randomPick();
    else if (a === 'fight' && B.slots.every(Boolean)) { S.sfx('detent'); startMatch(); }
    else if (a === 'rematch') startMatch();
    else if (a === 'rebuild') M.go('blades.build');
    else if (a === 'look' && B.preview) M.go('blades.build.inspect');
    else if (a === 'back') M.go('blades.build');
    else if (a === 'apart' && B.look) { B.look.apart = !B.look.apart; S.sfx(B.look.apart ? 'lift' : 'ltPutDown'); lookBar(); }
  }

  /* ---------- test hooks and the dev panel ---------- */
  S.blades = { sim: () => B.W, state: B, stadium,
    /* the room is put away mid-battle: hush the whirrs (the next frame turns them back up) */
    pause(on) { if (on) [B.me, B.rival].forEach(bl => { if (bl && bl.whirr) bl.whirr.set(0, 0); }); },
    pick(ids) { B.slots = ids.map(id => byId(id)); renderCard(); buildPreview(); },
    borrow() { borrow(); randomPick(); }, gallery,
    launch(power, ang) { if (M.is('blades.ready')) doLaunch(power ?? 0.8, ang ?? 0); } };
  S.dev.info(() => { const W = B.W; return /^blades/.test(M.state) ? 'Blades: ' + M.state.replace('blades.', '') + (W ? ' · ' + W.t.toFixed(1) + ' s · ' + W.tops.map(t => (t.alive ? 'spinning ' + Math.abs(t.w).toFixed(0) : t.done)).join(' / ') : '') : ''; });
  S.dev.action('Show me 9 blades', () => gallery(), 'Try');
  S.dev.action('Open blades', () => { if (M.is('under')) M.send('BLADES'); else S.toast('Turn the table over first (Space), then try again.'); }, 'Try');
}

const BLADES_CSS = `
#skBl{ position:fixed; top:calc(14px + env(safe-area-inset-top,0px)); left:max(14px, env(safe-area-inset-left,0px)); width:min(360px, calc(100vw - 28px)); max-height:calc(100vh - 28px); overflow:auto; box-sizing:border-box; padding:16px; background:var(--panel); border:1px solid var(--line); border-radius:10px; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); color:var(--text); font:400 12px/1.45 var(--f-ui); opacity:0; pointer-events:none; transform:translateX(-12px); transition:opacity .3s, transform .4s cubic-bezier(.2,.8,.2,1); z-index:8; }
#skBl.on{ opacity:1; pointer-events:auto; transform:none; }
#skBl .eb,#skBl .bl-sh{ font:500 10px/1 var(--f-mono); letter-spacing:.16em; color:var(--accent); }
#skBl h2{ margin:6px 0 4px; font:600 20px/1.15 var(--f-display, var(--f-ui)); }
#skBl .bl-h p{ margin:0 0 12px; color:var(--faint); }
.bl-slots{ display:grid; gap:6px; }
.bl-slot{ display:flex; gap:10px; align-items:center; text-align:left; padding:6px; border-radius:8px; border:1px solid var(--line); background:var(--raise); color:var(--text); cursor:pointer; font:inherit; }
.bl-slot.on{ border-color:var(--accent); box-shadow:0 0 0 1px var(--accent) inset; }
.bl-th{ width:46px; height:46px; flex:none; border-radius:50%; overflow:hidden; background:#111; border:2px solid var(--tc, #444); display:grid; place-items:center; }
.bl-th img{ width:100%; height:100%; object-fit:cover; } .bl-th i{ font:500 13px/1 var(--f-mono); color:var(--dim); font-style:normal; }
.bl-sl b{ display:block; font-weight:600; } .bl-sl small{ color:var(--faint); }
.bl-stats{ margin:12px 0 8px; display:grid; gap:5px; }
.bl-stat{ display:grid; grid-template-columns:84px 1fr; align-items:center; gap:8px; color:var(--faint); }
.bl-stat i,.bl-meter i{ height:6px; border-radius:3px; background:rgba(255,255,255,.08); overflow:hidden; display:block; }
.bl-stat em,.bl-meter em{ display:block; height:100%; background:var(--accent); border-radius:3px; transition:width .25s; }
.bl-chips{ display:flex; flex-wrap:wrap; gap:4px; margin:6px 0; } .bl-chips span{ padding:3px 8px; border-radius:999px; border:1px solid var(--line); color:var(--faint); font-size:11px; }
.bl-sp{ margin:4px 0 0; color:var(--faint); font-size:11px; }
.bl-pick{ margin-top:12px; } .bl-few{ color:var(--faint); margin:6px 0; }
.bl-grid{ display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-top:8px; }
.bl-s{ position:relative; padding:0; border-radius:6px; overflow:hidden; border:2px solid var(--tc, #444); background:#111; cursor:pointer; aspect-ratio:1; }
.bl-s img{ width:100%; height:100%; object-fit:cover; display:block; }
.bl-s span{ position:absolute; left:0; right:0; bottom:0; padding:2px 3px; background:linear-gradient(transparent, rgba(0,0,0,.85)); color:#fff; font:500 8.5px/1.2 var(--f-mono); letter-spacing:.04em; text-align:left; }
.bl-s em{ position:absolute; top:3px; right:3px; width:16px; height:16px; border-radius:50%; background:var(--accent); color:#1a1714; font:600 10px/16px var(--f-mono); font-style:normal; }
.bl-s.used{ opacity:.55; }
.bl-acts{ display:flex; gap:6px; justify-content:flex-end; margin-top:14px; }
#skBlHud{ position:fixed; top:calc(12px + env(safe-area-inset-top,0px)); left:50%; transform:translate(-50%,-8px); display:flex; gap:10px; align-items:flex-start; opacity:0; pointer-events:none; transition:opacity .3s, transform .4s cubic-bezier(.2,.8,.2,1); z-index:7; }
#skBlHud.on{ opacity:1; transform:translate(-50%,0); }
.bl-side{ position:relative; width:min(250px, 40vw); padding:9px 16px 11px; background:linear-gradient(180deg, rgba(14,14,18,.92), rgba(8,8,10,.86)); color:var(--text); font:400 11px/1.3 var(--f-ui); clip-path:polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%); border-top:2px solid #e3ad57; box-shadow:0 10px 30px -10px rgba(0,0,0,.8); }
.bl-side.rv{ clip-path:polygon(0 0, 100% 0, 100% 100%, 14px 100%); border-top-color:#e4552e; text-align:right; }
.bl-who{ display:flex; justify-content:space-between; align-items:center; font:italic 900 15px/1 var(--f-ui); letter-spacing:.06em; text-transform:uppercase; margin-bottom:7px; }
.bl-side.rv .bl-who{ flex-direction:row-reverse; }
.bl-pips{ display:flex; gap:6px; } .bl-pips i{ width:9px; height:9px; transform:rotate(45deg); border:1.5px solid rgba(244,241,234,.45); } .bl-pips i.on{ background:#e3ad57; border-color:#ffd889; box-shadow:0 0 10px #e3ad57; } .bl-side.rv .bl-pips i.on{ background:#e4552e; border-color:#ff8a6a; box-shadow:0 0 10px #e4552e; }
.bl-meter{ display:grid; grid-template-columns:62px 1fr; align-items:center; gap:8px; color:var(--faint); margin-top:5px; font:600 9px/1 var(--f-mono); letter-spacing:.14em; text-transform:uppercase; }
.bl-side.rv .bl-meter{ grid-template-columns:1fr 62px; } .bl-side.rv .bl-meter span{ order:2; } .bl-side.rv .bl-meter i{ transform:scaleX(-1); }
.bl-meter i{ position:relative; height:8px !important; border-radius:1px !important; background:rgba(255,255,255,.07) !important; transform-origin:center; }
.bl-meter i::after{ content:''; position:absolute; inset:0; background:repeating-linear-gradient(90deg, transparent 0 9px, rgba(0,0,0,.55) 9px 11px); }
.bl-meter em{ background:linear-gradient(90deg, #b5781c, #ffd889 70%, #fff) !important; box-shadow:0 0 8px rgba(255,200,110,.5); }
.bl-meter.burst em{ background:linear-gradient(90deg, #7a160c, #ff5a3a) !important; box-shadow:0 0 8px rgba(255,80,50,.5); } .bl-meter.sp em{ background:linear-gradient(90deg, #2a4fc0, #8fd0ff) !important; } .bl-meter.sp.full em{ background:#fff !important; box-shadow:0 0 14px #9fd8ff; animation:blPulse .6s ease-in-out infinite alternate; } .bl-meter.sp.full span{ color:#fff; }
@keyframes blPulse{ to{ filter:brightness(1.6); } }
.bl-side.rv .bl-meter em{ background:linear-gradient(90deg, #8a2a1a, #ff8a6a 70%, #fff) !important; }
#skBlBan{ position:fixed; left:50%; top:24%; transform:translate(-50%,-50%) scale(1.25); text-align:center; color:var(--text); opacity:0; pointer-events:none; transition:opacity .18s, transform .35s cubic-bezier(.2,1.4,.3,1); z-index:9; }
#skBlBan::before{ content:''; position:absolute; left:50%; top:46%; width:140%; height:62%; transform:translate(-50%,-50%) skewX(-18deg); background:linear-gradient(90deg, transparent, rgba(0,0,0,.75) 18%, rgba(0,0,0,.75) 82%, transparent); border-top:2px solid rgba(255,216,137,.8); border-bottom:2px solid rgba(255,216,137,.8); z-index:-1; }
#skBlBan.on{ opacity:1; transform:translate(-50%,-50%) scale(1); }
#skBlBan b{ display:block; padding:0 28px; font:italic 900 clamp(32px, 6vw, 68px)/1.05 var(--f-ui); letter-spacing:.01em; text-transform:uppercase; transform:skewX(-8deg); background:linear-gradient(180deg, #fff 30%, #ffd889 60%, #d8922a); -webkit-background-clip:text; background-clip:text; color:transparent; filter:drop-shadow(0 3px 0 rgba(0,0,0,.85)) drop-shadow(0 0 18px rgba(255,190,90,.45)); }
#skBlBan span{ display:block; margin-top:6px; font:700 12px/1.3 var(--f-mono); letter-spacing:.28em; text-transform:uppercase; color:#ffd889; text-shadow:0 2px 0 #000; }
#skBlBar{ position:fixed; left:50%; bottom:calc(70px + env(safe-area-inset-bottom,0px)); transform:translate(-50%,12px); display:flex; gap:6px; padding:6px; background:var(--panel); border:1px solid var(--line); border-radius:8px; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); opacity:0; pointer-events:none; transition:opacity .25s, transform .35s cubic-bezier(.2,.8,.2,1); z-index:9; }
#skBlBar.on{ opacity:1; pointer-events:auto; transform:translate(-50%,0); }
#skBlVeil{ position:fixed; inset:0; background:radial-gradient(circle at 50% 55%, rgba(60,0,60,.35), #000 70%); opacity:0; pointer-events:none; z-index:6; }
#skBlVeil.on{ animation:blVeil 1.6s ease-out; }
#skBlFlash{ position:fixed; inset:0; background:radial-gradient(circle at 50% 50%, #fff, rgba(255,240,210,.85) 40%, rgba(255,220,170,0) 80%); opacity:0; pointer-events:none; z-index:6; mix-blend-mode:screen; }
#skBlSpeed{ position:fixed; inset:-10%; background-position:center; background-size:cover; opacity:0; pointer-events:none; z-index:5; mix-blend-mode:screen; transition:opacity .15s; animation:blSpeed .25s steps(3) infinite; }
@keyframes blSpeed{ 0%{ transform:rotate(0deg) scale(1); } 50%{ transform:rotate(4deg) scale(1.03); } 100%{ transform:rotate(-3deg) scale(1.01); } }
@media (prefers-reduced-motion:reduce){ #skBlSpeed{ animation:none; } } @keyframes blVeil{ 0%{ opacity:0; } 15%{ opacity:.92; } 55%{ opacity:.8; } 100%{ opacity:0; } }
@media (prefers-reduced-motion:reduce){ #skBlVeil.on{ animation:none; } }
#skBlTags{ position:fixed; inset:0; pointer-events:none; z-index:7; opacity:0; transition:opacity .25s; } #skBlTags.on{ opacity:1; }
.bl-tag{ position:absolute; left:0; top:0; transition:opacity .2s; will-change:transform; }
.bl-tag.who{ padding:4px 12px; font:italic 900 11px/1.1 var(--f-ui); letter-spacing:.14em; text-transform:uppercase; color:#1a1714; background:linear-gradient(180deg, #ffd889, #e3ad57); clip-path:polygon(10% 0, 100% 0, 90% 100%, 0 100%); }
.bl-tag.who.rv{ background:#e4552e; color:#fff; }
.bl-tag.who.dash{ background:#ff7a2a; color:#fff; transform-origin:center; box-shadow:0 0 18px #ff7a2a; font-size:13px; }
.bl-tag.part{ width:210px; padding:8px 10px; border-left:3px solid var(--tc); background:var(--panel); border-radius:0 6px 6px 0; color:var(--text); font:400 11px/1.35 var(--f-ui); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); }
.bl-tag.part b{ display:block; font:600 12px/1.2 var(--f-ui); margin-bottom:2px; } .bl-tag.part span{ display:block; color:var(--faint); } .bl-tag.part em{ display:block; margin-top:3px; font-style:normal; color:var(--text); }
#skBlTip{ position:fixed; left:50%; bottom:calc(84px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%) skewX(-10deg); padding:9px 18px; background:rgba(10,10,12,.88); border-left:3px solid #e3ad57; color:var(--text); font:600 12px/1.2 var(--f-ui); letter-spacing:.02em; opacity:0; pointer-events:none; transition:opacity .3s; z-index:7; box-shadow:0 10px 30px -10px rgba(0,0,0,.8); }
#skBlTip.on{ opacity:1; animation:blTip 1.6s ease-in-out infinite; } @keyframes blTip{ 50%{ border-left-color:#fff; box-shadow:0 0 22px -4px rgba(227,173,87,.6); } }
.bl-clock{ align-self:flex-start; margin-top:2px; min-width:58px; padding:9px 0 10px; text-align:center; font:700 22px/1 var(--f-mono); color:#fff; background:linear-gradient(180deg, #1a1a20, #0b0b0e); clip-path:polygon(18% 0, 82% 0, 100% 50%, 82% 100%, 18% 100%, 0 50%); text-shadow:0 0 10px rgba(255,255,255,.35); }
`;
