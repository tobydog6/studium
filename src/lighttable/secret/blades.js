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

const LIFT = 0.7;        /* the bowl floor's height above the table once it is up */
const DOWN = -9;         /* the stadium's height while it waits in the pit */
const PART = ['Attack ring', 'Weight disc', 'Tip'];
const PART_SAYS = ['Its tier sets how hard it hits', 'Its grade and tier set the weight', 'Its finish sets how it moves'];
const HOW = { burst: 'Burst finish', out: 'Ring out', spin: 'Spin finish', time: 'Time. More spin wins' };

export function install(S) {
  if (!S.under) return;
  const { T, M, SL, SM, ctx, store } = S, E = T.E;
  const [X0, Z0, X1, Z1] = S.under.rect, CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2, R = BS.BOWL.R, DEP = BS.BOWL.depth;
  const ENV = SM.envMap(S.renderer);
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
    if (top) top.rotation.y += (dt || 0) * (hot ? 14 : 2.5); if (cap) { const want = hot ? 1.2 : 0.25 + 0.2 * Math.sin(btnT * 2.4 + 1); cap.material.emissiveIntensity += (want - cap.material.emissiveIntensity) * (1 - Math.exp(-(dt || 0) * 10)); } };

  /* ---------- the stadium: a lathe bowl on a column, a light round the rim ---------- */
  const stadium = new THREE.Group(); stadium.userData.secret = true; stadium.visible = false; stadium.position.set(CX, DOWN, CZ); ctx.scene.add(stadium);
  const bowlTex = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#26262d'); gr.addColorStop(0.6, '#17171c'); gr.addColorStop(1, '#0e0e12'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
    for (let y = 18; y < 300; y += 26) { g.fillStyle = 'rgba(255,255,255,' + (y % 78 === 18 ? 0.09 : 0.035) + ')'; g.fillRect(0, y, 1024, 2); }
    for (let x = 0; x < 1024; x += 64) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(x, 0, 2, 300); }
    for (let i = 0; i < 2500; i++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.04 + ')'; g.fillRect(Math.random() * 1024, Math.random() * 512, 1, 1); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
  { const pts = []; for (let i = 0; i <= 28; i++) { const r = R * i / 28; pts.push(new THREE.Vector2(Math.max(0.001, r), hB(r))); }
    pts.push(new THREE.Vector2(R + 0.08, DEP + 0.04), new THREE.Vector2(R + 0.1, DEP + 0.42), new THREE.Vector2(R + 0.45, DEP + 0.42), new THREE.Vector2(R + 0.45, -0.5), new THREE.Vector2(2.0, -0.5));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), new THREE.MeshStandardMaterial({ map: bowlTex, roughness: 0.55, metalness: 0.45, envMap: ENV, envMapIntensity: 0.5, side: THREE.DoubleSide })); stadium.add(bowl);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 9, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x1b1b21, roughness: 0.5, metalness: 0.6 })); col.position.y = -5; stadium.add(col); }
  const rimLight = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.04, 8, 128), new THREE.MeshBasicMaterial({ color: 0xe3ad57, toneMapped: false })); rimLight.rotation.x = Math.PI / 2; rimLight.position.y = DEP + 0.43; stadium.add(rimLight);
  const floorLight = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.2, 96), new THREE.MeshBasicMaterial({ color: 0xe3ad57, transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false })); floorLight.rotation.x = -Math.PI / 2; floorLight.position.y = hB(1.17) + 0.01; stadium.add(floorLight);
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
    const hole = new THREE.Path(); hole.absarc(0, 0, R + 0.44, 0, Math.PI * 2, true); sh.holes.push(hole);
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
  function spark(x, y, z, n, col, speed) { const c = new THREE.Color();
    for (let k = 0; k < n; k++) { const i = sp.n = (sp.n + 1) % SPN, a = Math.random() * 6.2832, u = Math.random() * 0.8 + 0.2, s = (speed || 3) * (0.4 + Math.random());
      sp.pos[i * 3] = x; sp.pos[i * 3 + 1] = y; sp.pos[i * 3 + 2] = z; sp.vel[i * 3] = Math.cos(a) * s * (1 - u * 0.5); sp.vel[i * 3 + 1] = u * s * 0.8; sp.vel[i * 3 + 2] = Math.sin(a) * s * (1 - u * 0.5); sp.life[i] = 0.3 + Math.random() * 0.5;
      c.set(Array.isArray(col) ? col[k % col.length] : col).lerp(new THREE.Color(0xffffff), Math.random() * 0.6); sp.col[i * 3] = c.r; sp.col[i * 3 + 1] = c.g; sp.col[i * 3 + 2] = c.b; } }
  function sparkFrame(dt) { for (let i = 0; i < SPN; i++) { if (sp.life[i] <= 0) { sp.pos[i * 3 + 1] = -99; continue; } sp.life[i] -= dt; sp.vel[i * 3 + 1] -= 9 * dt;
      sp.pos[i * 3] += sp.vel[i * 3] * dt; sp.pos[i * 3 + 1] += sp.vel[i * 3 + 1] * dt; sp.pos[i * 3 + 2] += sp.vel[i * 3 + 2] * dt; const k = Math.max(0, Math.min(1, sp.life[i] * 3)); sp.col[i * 3] *= 0.985 + 0.015 * k; sp.col[i * 3 + 1] *= 0.97 + 0.03 * k; sp.col[i * 3 + 2] *= 0.95 + 0.05 * k; }
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
  function metalOf(slab) { const f = SL.finishOf(slab, S.testFinish ? S.testFinish() : null), m = METALS[f] || METALS.matte;
    return new THREE.MeshPhysicalMaterial({ color: m[0], roughness: m[1], metalness: m[3] != null ? m[3] : 1, iridescence: m[2] ? 1 : 0, iridescenceIOR: 1.7, clearcoat: 0.5, clearcoatRoughness: 0.2, envMap: ENV, envMapIntensity: 1.4, transparent: !!m[4], opacity: m[4] ? 0.55 : 1 }); }
  /* the photo lit so it reads even in the dark bowl */
  const photoMat = (tex, o) => new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.32, roughness: 0.42, metalness: 0, envMap: ENV, envMapIntensity: 0.35, ...(o || {}) });
  /* the blur a fast spin makes of the face: its own colours as rings, the metal at the edge */
  function blurTex(dna, metal) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), rad = dna.radial || [[128, 128, 128]], gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.44, 'rgba(0,0,0,0)'); rad.forEach((p, i) => gr.addColorStop(0.46 + i / rad.length * 0.28, 'rgba(' + p.map(Math.round).join(',') + ',1)')); const mc = new THREE.Color(metal);
    gr.addColorStop(0.76, 'rgba(' + [mc.r, mc.g, mc.b].map(v => Math.round(v * 255)).join(',') + ',1)'); gr.addColorStop(0.97, 'rgba(' + [mc.r, mc.g, mc.b].map(v => Math.round(v * 200)).join(',') + ',0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  const FACE = 0.74;
  function makeBlade(parts, st, who) {
    const [a, b, c] = parts, [da, db, dc] = parts.map(dnaOf), sp = BSH.tipSpec(dc), lift = sp.len - 0.36, root = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group(), gRing = new THREE.Group(), gDisc = new THREE.Group(), gTip = new THREE.Group();
    root.add(tilt); tilt.add(spin); spin.add(gTip, gDisc, gRing); root.scale.setScalar(st.radius); const mats = [], geos = [], fins = [], myTex = texs = [];
    const keep = m => { if (m.geometry) geos.push(m.geometry); if (m.material) [].concat(m.material).forEach(x => mats.push(x)); return m; };
    /* a slab's finish shader laid over one part, so every part wears its finish */
    const finishOver = (slab, tex, geo, parent, y, sy) => { const fid = SL.finishOf(slab, S.testFinish ? S.testFinish() : null), def = SM.finishDef(fid);
      try { const fm = def && def.make ? def.make({ THREE, slab, obj: null, w: 2, h: 2, photoTex: tex, tier: SL.tierOf(slab), renderer: S.renderer, envMap: ENV, finish: fid }) : null;
        if (!fm) { geo.dispose(); return null; } fm.geometry.dispose(); fm.geometry = geo; fm.position.y = y; if (sy) fm.scale.y = sy; fm.renderOrder = 2; parent.add(fm); keep(fm); fins.push({ m: fm, def }); return fm; } catch (e) { console.error('blade finish', e); geo.dispose(); return null; } };
    /* Proportions from real Beyblade X (Sam: no bulbous parts): the blade wide and thin, the ratchet narrower beneath it, a small bit with a gear on top.
       Heights in blade radii: bit about 0.2 to 0.3, gear 0.05, ratchet 0.14, blade about 0.11, so the whole top is about a third as tall as it is wide. */
    const cmet = metalOf(c); mats.push(cmet); const ctex = photoTex(c), tipH = 0.2 + 0.1 * T.clamp(dc.mean, 0, 1), tierC = new THREE.Color(tierCol(c));
    const bitMat = photoMat(ctex, { color: tierC.clone().lerp(new THREE.Color(0xffffff), 0.35), roughness: 0.28, emissiveIntensity: 0.2 }); mats.push(bitMat);
    /* the bit: its point by tip type, a short shaft with its photo, a toothed gear (it is what bites the X rail) */
    const tg = st.tip === 'sharp' ? new THREE.ConeGeometry(0.13, tipH, sp.ribs) : st.tip === 'flat' ? new THREE.CylinderGeometry(0.14, 0.11 + 0.05 * T.clamp(dc.sat * 2, 0, 1), tipH, sp.ribs) : new THREE.SphereGeometry(0.13, 24, 16);
    const tipM = keep(new THREE.Mesh(tg, bitMat)); if (st.tip === 'sharp') { tipM.rotation.x = Math.PI; tipM.position.y = tipH / 2; } else if (st.tip === 'ball') { tipM.position.y = 0.13; } else { tipM.rotation.x = Math.PI; tipM.position.y = tipH / 2; } gTip.add(tipM);
    if (st.tip === 'ball') { const sh = keep(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, tipH - 0.13, 24), bitMat)); sh.position.y = 0.13 + (tipH - 0.13) / 2; gTip.add(sh); }
    const shaft = keep(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.07, 32), bitMat)); shaft.position.y = tipH + 0.035; gTip.add(shaft);
    { const gs = new THREE.Shape(), n = 14; for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * Math.PI * 2, r = k % 2 ? 0.255 : 0.285; if (k) gs.lineTo(Math.cos(a) * r, Math.sin(a) * r); else gs.moveTo(r, 0); }
      const gear = keep(new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1 }).rotateX(-Math.PI / 2), cmet)); gear.position.y = tipH + 0.07; gTip.add(gear); }
    const led = keep(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: tierCol(c), toneMapped: false }))); led.rotation.x = Math.PI / 2; led.position.y = tipH + 0.125; gTip.add(led);
    /* the ratchet: narrower than the blade, its turned profile and facets from its photo, translucent plastic in its photo's colour with the photo printed in it */
    const dmet = metalOf(b); mats.push(dmet); const y0 = tipH + 0.12, RH = 0.14;
    const prof = BSH.discProfile(db).map(p => new THREE.Vector2(p[0] * 0.8, p[1] * RH / 0.22)), facets = BSH.discFacets(db), dHue = new THREE.Color().setHSL(db.hue, db.sat > 0.15 ? 0.8 : 0.04, db.sat > 0.15 ? 0.42 : 0.2);
    const dtex = photoTex(b), discM = keep(new THREE.Mesh(new THREE.LatheGeometry(prof, facets), new THREE.MeshPhysicalMaterial({ map: dtex, color: dHue.clone().lerp(new THREE.Color(0xffffff), 0.35), emissive: dHue, emissiveMap: dtex, emissiveIntensity: 0.3, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, envMap: ENV, flatShading: facets < 20, transparent: true, opacity: 0.94 })));
    discM.position.y = y0; gDisc.add(discM);
    { const band = keep(new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.018, 6, facets < 20 ? facets : 64), dmet)); band.rotation.x = Math.PI / 2; band.position.y = y0 + RH - 0.01; gDisc.add(band); }
    finishOver(b, dtex, new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p.x * 1.012, p.y)), facets), gDisc, y0);
    /* the blade */
    const dep = BSH.ringDepth(da), ry = y0 + RH, clear = a.variant === 'clear', amet = metalOf(a); mats.push(amet);
    amet.flatShading = true; amet.roughness = Math.min(amet.roughness, 0.2); amet.envMapIntensity = 1.1; if (amet.color.getHSL({}).l > 0.75) amet.color.multiplyScalar(0.8);   /* faceted, polished metal: every chamfer catches the light */
    const hue = new THREE.Color().setHSL(da.hue, da.sat > 0.15 ? 0.9 : 0.05, da.sat > 0.15 ? 0.46 : 0.14), EMB = 0.34, ptex = photoTex(a);
    /* the plastic: thin hooked flames under the metal, tinted by the photo's colour with the photo printed through, glossy */
    const fl = new THREE.Shape(BSH.flameOutline(da, rank(a), st.dir).map(p => new THREE.Vector2(p[0], p[1]))); { const h = new THREE.Path(); h.absarc(0, 0, EMB - 0.01, 0, Math.PI * 2, true); fl.holes.push(h); }
    const flM = keep(new THREE.Mesh(planarUV(new THREE.ExtrudeGeometry(fl, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 }).rotateX(-Math.PI / 2), 0.92),
      new THREE.MeshPhysicalMaterial({ map: ptex, color: hue.clone().lerp(new THREE.Color(0xffffff), 0.25), emissive: hue, emissiveMap: ptex, emissiveIntensity: 0.42, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, envMap: ENV, envMapIntensity: 1.1, transparent: true, opacity: clear ? 0.55 : 0.93 })));
    flM.position.y = ry; gRing.add(flM);
    finishOver(a, ptex, planarUV(new THREE.ShapeGeometry(fl, 6).rotateX(-Math.PI / 2), 0.92), gRing, ry + 0.056);
    /* the metal: chunks in two steps (a full lower plate and a slightly smaller upper one), so the faces slope like a sculpted blade */
    const wings = BSH.metalWings(da, rank(a), st.dir), toShapes = k => wings.map(poly => new THREE.Shape(poly.map(p => new THREE.Vector2(p[0] * k, p[1] * k))));
    const blade = keep(new THREE.Mesh(new THREE.ExtrudeGeometry(toShapes(1), { depth: 0.035, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.016, bevelSegments: 1, curveSegments: 4 }).rotateX(-Math.PI / 2), amet)); blade.position.y = ry + 0.018; gRing.add(blade);
    const blade2 = keep(new THREE.Mesh(new THREE.ExtrudeGeometry(toShapes(0.93), { depth: 0.022, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 1, curveSegments: 4 }).rotateX(-Math.PI / 2), amet)); blade2.position.y = ry + 0.066; gRing.add(blade2);
    /* the hub: a slim coloured ring round the emblem, flush with the top of the blade */
    const acc = new THREE.Color().setHSL((da.hue + 0.5) % 1, 0.85, 0.52), ringS = new THREE.Shape(); ringS.absarc(0, 0, 0.5, 0, Math.PI * 2, false); { const h = new THREE.Path(); h.absarc(0, 0, EMB + 0.025, 0, Math.PI * 2, true); ringS.holes.push(h); }
    const accM = keep(new THREE.Mesh(new THREE.ExtrudeGeometry(ringS, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 64 }).rotateX(-Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: acc, emissive: acc, emissiveIntensity: 0.15, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, envMap: ENV })));
    accM.position.y = ry + 0.04; gRing.add(accM);
    /* the emblem: the whole photo, flush in the hub like a sticker, a thin lip of tier colour round it */
    const emb = new THREE.Shape(); emb.absarc(0, 0, EMB, 0, Math.PI * 2, false);
    const embM = keep(new THREE.Mesh(planarUV(new THREE.ExtrudeGeometry(emb, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 48 }).rotateX(-Math.PI / 2), EMB),
      new THREE.MeshPhysicalMaterial({ map: ptex, emissive: 0xffffff, emissiveMap: ptex, emissiveIntensity: 0.4, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, envMap: ENV, envMapIntensity: 0.6 })));
    embM.position.y = ry + 0.072; gRing.add(embM);
    const lipS = new THREE.Shape(); lipS.absarc(0, 0, EMB + 0.025, 0, Math.PI * 2, false); { const h = new THREE.Path(); h.absarc(0, 0, EMB, 0, Math.PI * 2, true); lipS.holes.push(h); }
    const lip = keep(new THREE.Mesh(new THREE.ExtrudeGeometry(lipS, { depth: 0.03, bevelEnabled: false, curveSegments: 64 }).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: tierCol(a), emissive: tierCol(a), emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.5, envMap: ENV })));
    lip.position.y = ry + 0.075; gRing.add(lip);
    /* the spin: a blur of the face's own colours over the top as it gets fast (not on the spin group, so it doesn't strobe) */
    const btex = blurTex(da, METALS[SL.finishOf(a)] ? METALS[SL.finishOf(a)][0] : 0x8a9099); myTex.push(btex);
    const halo = keep(new THREE.Mesh(new THREE.CircleGeometry(1.06, 64), new THREE.MeshBasicMaterial({ map: btex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))); halo.rotation.x = -Math.PI / 2; halo.position.y = ry + 0.13; halo.renderOrder = 3; tilt.add(halo);
    const glint = keep(new THREE.Mesh(new THREE.RingGeometry(0.86, 1.05, 48, 1, 0, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }))); glint.rotation.x = -Math.PI / 2; glint.position.y = ry + 0.135; glint.renderOrder = 4; tilt.add(glint);
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
  function whirr() { const c = S.snd && S.snd.ctx ? S.snd.ctx() : null; if (!c) return null;
    try { const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null; o.type = 'sawtooth'; o.frequency.value = 90; f.type = 'bandpass'; f.Q.value = 6; f.frequency.value = 600; g.gain.value = 0;
      const out = (S.snd.out && S.snd.out()) || c.destination; o.connect(f); f.connect(g); if (p) { g.connect(p); p.connect(out); } else g.connect(out); o.start();
      return { set(s, pan) { const t = c.currentTime; o.frequency.setTargetAtTime(40 + s * 150, t, 0.05); f.frequency.setTargetAtTime(300 + s * 1500, t, 0.05); g.gain.setTargetAtTime(0.045 * s, t, 0.05); if (p) p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.05); },
        stop() { try { g.gain.setTargetAtTime(0, c.currentTime, 0.08); o.stop(c.currentTime + 0.4); } catch (e) {} } }; } catch (e) { return null; } }
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
    /* the real spin, and the blur of it: the faster it goes the more the face melts into rings of its own colours */
    bl.vang += t.w * dt; bl.spin.rotation.y = -bl.vang; const aw = Math.abs(t.w), blur = T.clamp((aw - 14) / 26, 0, 1);
    bl.halo.material.opacity = 0.45 * blur; bl.glint.material.opacity = 0.35 * blur; bl.glint.rotation.z = -bl.vang * 0.07;
    const a = t.ang * 0.08 + T.time() * 0.6; bl.fins.forEach(f => { try { f.def.update(f.m, { tilt: new THREE.Vector2(Math.cos(a) * 0.7, Math.sin(a) * 0.7), pointer: new THREE.Vector2(0.5, 0.5), dt, time: T.time() }); } catch (e) {} });
    if (bl.whirr) bl.whirr.set(t.alive ? s : 0, t.p.x / R);
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
      return '<div class="bl-side ' + cls + '"><div class="bl-who">' + who + '<span class="bl-pips">' + [0, 1, 2].map(i => '<i' + (i < B.score[cls === 'me' ? 0 : 1] ? ' class="on"' : '') + '></i>').join('') + '</span></div>'
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
  const cordTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 16); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 16); const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const decal = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#16161c'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#f2d22e'; g.font = 'italic 900 52px sans-serif'; g.fillText('RIP', 14, 62); g.fillStyle = '#fff'; g.font = '700 20px sans-serif'; g.fillText('STUDIUM', 122, 42); g.font = '500 13px sans-serif'; g.fillText('X GRIP SYSTEM', 122, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  function makeLauncher(col) { const g = new THREE.Group(), base = new THREE.Color(col), plast = new THREE.MeshPhysicalMaterial({ color: base, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3, envMap: ENV, envMapIntensity: 0.7 }), dark = new THREE.MeshPhysicalMaterial({ color: 0x1c1c22, roughness: 0.45, clearcoat: 0.3, envMap: ENV });
    const housing = new THREE.Mesh(new S.RoundedBoxGeometry(1.7, 0.42, 1.5, 4, 0.14), plast); housing.position.y = 0.21; g.add(housing);
    const top = new THREE.Mesh(new S.RoundedBoxGeometry(1.15, 0.12, 1.1, 3, 0.05), dark); top.position.set(0.05, 0.46, -0.05); g.add(top);
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.36), new THREE.MeshBasicMaterial({ map: decal })); sticker.rotation.x = -Math.PI / 2; sticker.position.set(0.05, 0.53, 0.2); g.add(sticker);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.12, 40), dark); lip.position.y = -0.04; g.add(lip);
    [-0.62, 0.62].forEach(x => { const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 20), plast); knob.rotation.z = Math.PI / 2; knob.position.set(x * 1.45, 0.25, -0.35); g.add(knob); });
    /* the grip: an S-curved pistol handle reaching back towards you, with finger holes */
    const gs = new THREE.Shape(); gs.moveTo(-0.38, 0); gs.bezierCurveTo(-0.55, 0.7, -0.15, 1.1, -0.42, 1.8); gs.bezierCurveTo(-0.6, 2.3, -0.2, 2.75, 0.15, 2.7); gs.bezierCurveTo(0.5, 2.6, 0.55, 2.2, 0.38, 1.7); gs.bezierCurveTo(0.2, 1.2, 0.55, 0.7, 0.38, 0);
    [[0, 0.75], [0.05, 1.35], [0, 1.95]].forEach(([x, y]) => { const h = new THREE.Path(); h.absarc(x, y, 0.07, 0, Math.PI * 2, true); gs.holes.push(h); });
    const grip = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 16 }).rotateX(-Math.PI / 2), plast); grip.position.set(-0.1, 0.04, 0.55); grip.rotation.y = Math.PI; g.add(grip);
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0xe0402e, roughness: 0.4 })); button.position.set(-0.05, 0.47, 2.6); g.add(button);
    /* the ripcord: a toothed strip out of the side, its winged handle on the end */
    const cordM = new THREE.MeshStandardMaterial({ map: cordTex, color: base.clone().lerp(new THREE.Color(0xffffff), 0.15), roughness: 0.5 }), cord = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.16), cordM); cord.geometry.translate(0.5, 0, 0); cord.position.set(0.85, 0.24, -0.1); g.add(cord);
    const hs = new THREE.Shape(); hs.moveTo(0, -0.08); hs.lineTo(0.35, -0.1); hs.lineTo(0.55, -0.45); hs.lineTo(0.68, -0.4); hs.lineTo(0.55, -0.1); hs.lineTo(0.8, -0.06); hs.lineTo(0.95, -0.22); hs.lineTo(1.0, 0); hs.lineTo(0.95, 0.22); hs.lineTo(0.8, 0.06); hs.lineTo(0.55, 0.1); hs.lineTo(0.68, 0.4); hs.lineTo(0.55, 0.45); hs.lineTo(0.35, 0.1); hs.lineTo(0, 0.08);
    const handle = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }).rotateX(-Math.PI / 2), plast); g.add(handle);
    const L = { g, setCord(len) { const l = Math.max(0.18, len); cord.scale.x = l; cordM.map.repeat.set(l * 3, 1); handle.position.set(0.85 + l, 0.2, -0.1); }, dispose() { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== cordM) o.material.dispose(); }); cordM.map.dispose(); cordM.dispose(); g.removeFromParent(); } };
    cordM.map = cordTex.clone(); cordM.map.needsUpdate = true; L.setCord(0.18); return L; }
  const aim = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false })); aim.geometry.translate(0, 0.5, 0); aim.rotation.x = -Math.PI / 2; aim.visible = false; stadium.add(aim);
  function doLaunch(power, ang) { const [a, b] = B.W.tops, lx = a.p.x; BS.launch(a, power, ang); a.p.x = lx; BS.launch(b, B.rivalPlan.power, B.rivalPlan.aim); B.me.drop = B.rival.drop = LAUNCH_H - 0.75; B.ripT = 0;
    B.me.whirr = whirr(); B.rival.whirr = whirr(); aim.visible = false; snd('pop'); snd('rumble', { gain: 0.5, dur: 0.6 }); B.shake = 0.35;
    [a, b].forEach(t => { spark(t.p.x, hB(Math.hypot(t.p.x, t.p.y)) + 0.05, t.p.y, 40, [0xffffff, 0xffd08a], 3.5); wave(t.p.x, t.p.y, 2, 0xffffff); }); M.go('blades.battle'); }
  function fx(ev) {
    const [a, b] = B.W.tops, blOf = t => t === a ? B.me : B.rival;
    for (const e of ev) {
      if (e.type === 'hit') { const y = hB(Math.hypot(e.x, e.y)) + 0.45, n = Math.min(90, Math.round(8 + e.k * 16)); spark(e.x, y, e.y, n, [tierCol(B.me.slabs[0]), tierCol(B.rival.slabs[0]), 0xffe2a0, 0xffffff], 2.5 + e.k * 1.2);
        flash(e.x, y, e.y, e.k, e.k > 3 ? 0xffffff : 0xffe2a0); B.shake = Math.max(B.shake, Math.min(0.45, e.k * 0.06));
        /* the big ones land: a shockwave, a freeze frame, and the really big ones go to slow motion */
        if (e.k > 2.5) { wave(e.x, e.y, e.k); shards(e.x, y, e.y, Math.min(14, Math.round(e.k * 2.2)), [B.me.metalCol, B.rival.metalCol], 1.5 + e.k * 0.6); }
        if (B.cine && B.cine.t > 0) { B.cine.t = Math.min(B.cine.t, 0.35); B.slowT = 0.12; B.slowK = 0.4; B.shake = Math.max(B.shake, 0.7); flash(e.x, y, e.y, 9, 0xffffff); wave(e.x, e.y, 9, 0xffffff); shards(e.x, y, e.y, 18, [B.me.metalCol, B.rival.metalCol], 5); } if (e.k > 3) B.stop = Math.min(0.12, 0.04 + e.k * 0.012); if (e.k > 5.5) { B.slowT = 0.45; B.slowK = 0.35; }
        if (e.k > 1.6) snd('slam', { vol: Math.min(1, e.k / 4) }); else if (S.snd && S.snd.tick) S.snd.tick(Math.min(1, e.k / 2)); }
      else if (e.type === 'wall') { if (e.k > 0.6 && S.snd && S.snd.tick) S.snd.tick(Math.min(1, e.k / 3), true); spark(e.x, DEP + 0.2, e.y, Math.round(e.k * 4), 0xffd08a, 1.5); }
      else if (e.type === 'shield') { banner('Stamped!', 'One burst saved', 1300); snd('chime', { tier: 'rare' }); }
      else if (e.type === 'special') { const bl = blOf(e.top), p = e.top.p, y = hB(Math.hypot(p.x, p.y)) + 0.5, who = e.top === a ? 'You' : 'Rival', nm = BS.SPECIALS[e.id].name;
        banner(nm + '!', who === 'You' ? '' : 'Your rival', 1200);
        if (e.id === 'starburst') { spark(p.x, y, p.y, 120, [0xffffff, 0xff4fae, 0xffe08a], 6); snd('burst', { tier: 'epic' }); }
        else if (e.id === 'slam') { spark(p.x, y, p.y, 80, [0xffd58a, 0xd9962a], 4); snd('slam'); }
        else if (e.id === 'guard') { spark(p.x, y, p.y, 60, [0xa9edff, 0xffffff], 3); snd('glow'); }
        else if (e.id === 'eclipse') { veil.classList.remove('on'); void veil.offsetWidth; veil.classList.add('on'); snd('chime', { tier: 'mythic' }); spark(p.x, y, p.y, 100, [0xff3fd0, 0x8a4cff, 0xffffff], 5); }
        if (bl) bl.halo.material.opacity = 1; }
      else if (e.type === 'dash') { const bl = blOf(e.top), i = e.top === a ? 0 : 1; railFlash.k = 1; spark(e.x, DEP, e.y, 30, [0xff7a2a, 0xffd08a, 0xffffff], 4); B.shake = Math.max(B.shake, 0.15); snd('servo'); if (S.snd && S.snd.tick) S.snd.tick(1);
        const el = tags.children[i]; if (el && el.classList.contains('who')) { el.textContent = 'X Dash!'; el.classList.add('dash'); clearTimeout(el._t); el._t = setTimeout(() => { el.textContent = i ? 'Rival' : 'You'; el.classList.remove('dash'); }, 900); } }
      else if (e.type === 'burst') { burstApart(blOf(e.top), e.top); B.slowT = 1.1; B.slowK = 0.3; B.shake = 0.6; flash(e.top.p.x, 0.6, e.top.p.y, 8, 0xffffff); wave(e.top.p.x, e.top.p.y, 8, tierCol(blOf(e.top).slabs[0])); }
      else if (e.type === 'out') { const bl = blOf(e.top), t = e.top, r = Math.hypot(t.p.x, t.p.y) || 1; bl.dead = 'out'; bl.fly = { x: t.p.x, z: t.p.y, y: hB(r), vx: t.p.x / r * 5.5, vz: t.p.y / r * 5.5, vy: 4.8, spin: t.w }; snd('slam'); B.slowT = 1.0; B.slowK = 0.3; B.shake = 0.5; flash(t.p.x, DEP + 0.4, t.p.y, 7, 0xffffff); }
      else if (e.type === 'down') { blOf(e.top).dead = 'spin'; snd('land'); }
    }
  }
  /* a burst: the three parts come apart and scatter, each spinning off on its own */
  function burstApart(bl, t) { bl.dead = 'burst'; snd('burst', { tier: 'legendary' }); const p = t.p, y = hB(Math.hypot(p.x, p.y)) + 0.4; spark(p.x, y, p.y, 140, [tierCol(bl.slabs[0]), tierCol(bl.slabs[1]), tierCol(bl.slabs[2]), 0xffffff], 6);
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
    else if (bl.dead === 'out' && bl.fly) { const f = bl.fly; f.vy -= 14 * dt; f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt; const r = Math.hypot(f.x, f.z), floor = r > R + 0.45 ? -LIFT : r > R ? DEP + 0.47 : hB(r);
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
      stadium.visible = true; spot.visible = true; stadium.scale.setScalar(0.5); stadium.position.y = DOWN; snd('rise', { dur: 1.6 }); snd('servo');
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
    enter() { hideBar(); newRound(); ctx.canvas.style.cursor = 'grab'; B.shake = 0; B.stop = 0; B.slowT = 0; camTo(CX, CZ + R * 0.6, 10.5, 0, 36);
      tip.innerHTML = 'Move to aim. Grab the ripcord and yank it out fast: the faster the pull, the better the rip.'; tip.classList.add('on'); hud.classList.add('on'); hudFrame(0, true);
      [B.myL, B.rvL].forEach(L => { if (L) L.dispose(); }); B.myL = makeLauncher(new THREE.Color().setHSL(dnaOf(B.slots[0]).hue, 0.8, 0.28)); B.rvL = makeLauncher(0xb3261e); stadium.add(B.myL.g, B.rvL.g);
      B.me.root.scale.setScalar(B.me.st.radius); B.lx = 0; B.pull = null; B.ripK = 1;
      const rs = B.rivalParts[0]; banner(B.score[0] + B.score[1] ? 'Round ' + (B.roundN = (B.roundN || 1) + 1) : 'Ready, set', 'Your rival: ' + esc((rs.photo && rs.photo.pack || 'Sample pack').replace(/\s*·.*$/, '')) + ' blade, ' + BS.TIPS[BS.statsOf(B.rivalParts).tip].name.toLowerCase() + ' tip', 0); rimTo(tierCol(B.slots[0])); },
    pointer(kind, e) {
      const P = B.pull;
      if (kind === 'move' && !P) { const h = S.tableHit(e, LIFT); if (h) B.lx = T.clamp(h.x - CX, -R * 0.4, R * 0.4); return true; }
      if (kind === 'down' && e.button === 0) { B.pull = { x: e.clientX, y: e.clientY, len: 0, tick: 0, pts: [{ t: performance.now(), d: 0 }] }; ctx.canvas.style.cursor = 'grabbing'; snd('servo'); hideBanner(); return true; }
      if (kind === 'move' && P) { const d = Math.hypot(e.clientX - P.x, e.clientY - P.y), now = performance.now(); P.pts.push({ t: now, d }); if (P.pts.length > 12) P.pts.shift();
        P.len = Math.min(CORD_MAX, d / 75 / 0.62); const sp = ripSpeed(P); if (Math.floor(P.len * 5) > P.tick) { P.tick = Math.floor(P.len * 5); if (S.snd && S.snd.tick) S.snd.tick(Math.min(1, sp / 3)); }
        if (P.len >= CORD_MAX) rip(); return true; }
      if (kind === 'up' && P) { rip(); return true; }
      return kind !== 'wheel'; },
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
      const mx = (a.p.x + b.p.x) / 2, mz = (a.p.y + b.p.y) / 2; if (B.cine && B.cine.t > 0) { B.cine.t -= real; camTo(CX + B.cine.x, CZ + B.cine.z + 1.4, 4.2, real * 3, 30); } else camTo(CX + mx * 0.4, CZ + 2.0 + mz * 0.4, 12, real, 44);
      hudFrame(dt); const o = BS.outcome(W); if (o) M.go('blades.round', o); },
  });
  M.define('blades.round', { busy: true,
    /* the winner keeps spinning and the loser finishes falling, for a beat */
    frame(dt) { dt = Math.min(dt, 0.05); if (B.slowT > 0) { B.slowT -= dt; dt *= B.slowK; } const [a, b] = B.W.tops; [[a, B.me], [b, B.rival]].forEach(([t, bl]) => { if (!bl) return; const vdt = dt * BS.TIME; if (t.alive) { t.ang += t.w * vdt; t.w *= Math.exp(-vdt * 0.3); pose(bl, t, vdt); } else deadFrame(bl, t, vdt); }); },
    async enter(o, run) { const W = B.W, [a, b] = W.tops, won = o.winner === a; tip.classList.remove('on'); B.score[won ? 0 : 1] += o.pts; hudFrame(0, true);
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
        stadium.visible = false; spot.visible = false; await S.under.doors(false); doorsShut = true; }
      catch (e) { console.error('blades closing', e); }
      finally { stadium.visible = false; spot.visible = false; stadium.position.y = DOWN; if (!doorsShut) { try { S.hole.close(); } catch (e) {} }
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
#skBlHud{ position:fixed; top:calc(14px + env(safe-area-inset-top,0px)); left:50%; transform:translateX(-50%); display:flex; gap:12px; opacity:0; pointer-events:none; transition:opacity .3s; z-index:7; }
#skBlHud.on{ opacity:1; }
.bl-side{ width:min(220px, 42vw); padding:10px 12px; background:var(--panel); border:1px solid var(--line); border-radius:8px; color:var(--text); font:400 11px/1.3 var(--f-ui); }
.bl-who{ display:flex; justify-content:space-between; align-items:center; font:600 12px/1 var(--f-ui); margin-bottom:6px; }
.bl-pips{ display:flex; gap:4px; } .bl-pips i{ width:9px; height:9px; border-radius:50%; border:1px solid var(--faint); } .bl-pips i.on{ background:var(--accent); border-color:var(--accent); }
.bl-meter{ display:grid; grid-template-columns:64px 1fr; align-items:center; gap:6px; color:var(--faint); margin-top:4px; font-size:10px; }
.bl-meter.burst em{ background:#e4552e; } .bl-meter.sp em{ background:#8fb3e8; } .bl-meter.sp.full em{ background:#fff; box-shadow:0 0 8px #fff; } .bl-meter.sp.full span{ color:var(--text); }
.bl-side.rv .bl-meter em{ opacity:.85; }
#skBlBan{ position:fixed; left:50%; top:24%; transform:translate(-50%,-50%) scale(.9); text-align:center; color:var(--text); opacity:0; pointer-events:none; transition:opacity .25s, transform .35s cubic-bezier(.2,.8,.2,1); z-index:9; text-shadow:0 4px 24px rgba(0,0,0,.8); }
#skBlBan.on{ opacity:1; transform:translate(-50%,-50%) scale(1); }
#skBlBan b{ display:block; font:700 clamp(28px, 5vw, 54px)/1.05 var(--f-display, var(--f-ui)); letter-spacing:.01em; }
#skBlBan span{ display:block; margin-top:8px; font:500 12px/1.3 var(--f-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--faint); }
#skBlBar{ position:fixed; left:50%; bottom:calc(70px + env(safe-area-inset-bottom,0px)); transform:translate(-50%,12px); display:flex; gap:6px; padding:6px; background:var(--panel); border:1px solid var(--line); border-radius:8px; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); opacity:0; pointer-events:none; transition:opacity .25s, transform .35s cubic-bezier(.2,.8,.2,1); z-index:9; }
#skBlBar.on{ opacity:1; pointer-events:auto; transform:translate(-50%,0); }
#skBlVeil{ position:fixed; inset:0; background:radial-gradient(circle at 50% 55%, rgba(60,0,60,.35), #000 70%); opacity:0; pointer-events:none; z-index:6; }
#skBlVeil.on{ animation:blVeil 1.6s ease-out; } @keyframes blVeil{ 0%{ opacity:0; } 15%{ opacity:.92; } 55%{ opacity:.8; } 100%{ opacity:0; } }
@media (prefers-reduced-motion:reduce){ #skBlVeil.on{ animation:none; } }
#skBlTags{ position:fixed; inset:0; pointer-events:none; z-index:7; opacity:0; transition:opacity .25s; } #skBlTags.on{ opacity:1; }
.bl-tag{ position:absolute; left:0; top:0; transition:opacity .2s; will-change:transform; }
.bl-tag.who{ padding:3px 9px; border-radius:999px; font:600 11px/1.2 var(--f-mono); letter-spacing:.12em; text-transform:uppercase; color:#1a1714; background:#e3ad57; box-shadow:0 2px 10px rgba(0,0,0,.5); }
.bl-tag.who.rv{ background:#e4552e; color:#fff; }
.bl-tag.who.dash{ background:#ff7a2a; color:#fff; transform-origin:center; box-shadow:0 0 18px #ff7a2a; font-size:13px; }
.bl-tag.part{ width:210px; padding:8px 10px; border-left:3px solid var(--tc); background:var(--panel); border-radius:0 6px 6px 0; color:var(--text); font:400 11px/1.35 var(--f-ui); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); }
.bl-tag.part b{ display:block; font:600 12px/1.2 var(--f-ui); margin-bottom:2px; } .bl-tag.part span{ display:block; color:var(--faint); } .bl-tag.part em{ display:block; margin-top:3px; font-style:normal; color:var(--text); }
#skBlTip{ position:fixed; left:50%; bottom:calc(84px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); padding:8px 14px; border-radius:999px; background:var(--panel); border:1px solid var(--line); color:var(--text); font:500 12px/1.2 var(--f-ui); opacity:0; pointer-events:none; transition:opacity .3s; z-index:7; }
#skBlTip.on{ opacity:1; animation:blTip 2.4s ease-in-out infinite; } @keyframes blTip{ 50%{ border-color:var(--accent); } }
.bl-clock{ align-self:center; min-width:44px; text-align:center; font:600 20px/1 var(--f-mono); color:var(--text); text-shadow:0 2px 12px rgba(0,0,0,.7); }
`;
