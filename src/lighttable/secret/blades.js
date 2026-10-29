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

const LIFT = 0.7;        /* the bowl floor's height above the table once it is up */
const DOWN = -9;         /* the stadium's height while it waits in the pit */
const PART = ['Attack ring', 'Weight disc', 'Tip'];
const PART_SAYS = ['Its tier sets how hard it hits', 'Its grade and tier set the weight', 'Its finish sets how it moves'];
const METAL = { gold: [0xd9a441, 0.9, 0.25], foil: [0xcfd6de, 0.85, 0.18], etch: [0xb07a4a, 0.85, 0.3], glitter: [0xd8c8f0, 0.7, 0.3], prism: [0x1a1a22, 0.6, 0.2], matte: [0x8a8f96, 0.6, 0.45] };
const HOW = { burst: 'Burst finish', out: 'Ring out', spin: 'Spin finish', time: 'Time. More spin wins' };

export function install(S) {
  if (!S.under) return;
  const { T, M, SL, SM, ctx, store } = S, E = T.E;
  const [X0, Z0, X1, Z1] = S.under.rect, CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2, R = BS.BOWL.R, DEP = BS.BOWL.depth;
  const ENV = SM.envMap(S.renderer);
  const B = { slots: [null, null, null], active: 0, loaners: [], score: [0, 0], W: null, me: null, rival: null, acc: 0, drag: null, pushed: false, debris: [], thumbs: new Map(), preview: null, rivalParts: null, specialT: 0 };
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
  function ringShape(slab, dir) { const n = 2 + rank(slab), sharp = rank(slab), pts = [], N = n * 24;
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, u0 = (a * n / (Math.PI * 2)) % 1, u = dir < 0 ? 1 - u0 : u0;
      const f = sharp <= 1 ? 0.5 + 0.5 * Math.cos(u * Math.PI * 2) : Math.pow(1 - u, 0.5 + sharp * 0.35);
      const r = 0.8 + 0.2 * f; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
    const sh = new THREE.Shape(pts); const hole = new THREE.Path(); hole.absarc(0, 0, 0.4, 0, Math.PI * 2, true); sh.holes.push(hole); return sh; }
  /* the photo laid flat across the part: u, v from x and the shape's y (−z once it lies down) */
  function planarUV(geo) { const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.5 + 0.5, -p.getZ(i) * 0.5 + 0.5); uv.needsUpdate = true; return geo; }
  function makeBlade(parts, st, who) {
    const [a, b, c] = parts, root = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group(), gRing = new THREE.Group(), gDisc = new THREE.Group(), gTip = new THREE.Group();
    root.add(tilt); tilt.add(spin); spin.add(gTip, gDisc, gRing); root.scale.setScalar(st.radius); const mats = [], geos = [], fins = [], myTex = texs = [];
    const keep = m => { if (m.geometry) geos.push(m.geometry); if (m.material) [].concat(m.material).forEach(x => mats.push(x)); return m; };
    /* a slab's finish shader laid over one part (the ring's top, the disc's edge, the cap), so every part wears its finish */
    const finishOver = (slab, tex, geo, parent, y, sy) => { const fid = SL.finishOf(slab, S.testFinish ? S.testFinish() : null), def = SM.finishDef(fid);
      try { const fm = def && def.make ? def.make({ THREE, slab, obj: null, w: 2, h: 2, photoTex: tex, tier: SL.tierOf(slab), renderer: S.renderer, envMap: ENV, finish: fid }) : null;
        if (!fm) { geo.dispose(); return null; } fm.geometry.dispose(); fm.geometry = geo; fm.position.y = y; if (sy) fm.scale.y = sy; fm.renderOrder = 2; parent.add(fm); keep(fm); fins.push({ m: fm, def }); return fm; } catch (e) { console.error('blade finish', e); geo.dispose(); return null; } };
    /* tip: the shape is the tip type, the plastic is the tip slab's tier colour; its photo sits on the cap up top */
    const plastic = new THREE.MeshStandardMaterial({ color: tierCol(c), roughness: 0.35, metalness: 0.1, envMap: ENV, envMapIntensity: 0.4 });
    const tg = st.tip === 'sharp' ? new THREE.ConeGeometry(0.2, 0.36, 24) : st.tip === 'flat' ? new THREE.CylinderGeometry(0.26, 0.2, 0.36, 24) : new THREE.SphereGeometry(0.22, 24, 16);
    const tipM = keep(new THREE.Mesh(tg, plastic)); if (st.tip === 'sharp') { tipM.rotation.x = Math.PI; tipM.position.y = 0.18; } else tipM.position.y = st.tip === 'ball' ? 0.22 : 0.18; gTip.add(tipM);
    const neck = keep(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.12, 24), plastic)); neck.position.y = 0.36; gTip.add(neck);
    const ctex = photoTex(c), cap = keep(new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: ctex, roughness: 0.25, metalness: 0.1, envMap: ENV, envMapIntensity: 0.5 }))); cap.position.y = 0.76; cap.scale.y = 0.6; gTip.add(cap); finishOver(c, ctex, new THREE.SphereGeometry(0.345, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), gTip, 0.76, 0.6);
    const capRing = keep(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: tierCol(c), toneMapped: false }))); capRing.rotation.x = Math.PI / 2; capRing.position.y = 0.77; gTip.add(capRing);
    /* weight disc: metal by its finish, its photo wrapped round the edge */
    const [mc, mm, mr] = METAL[SL.finishOf(b)] || METAL.matte;
    const dtex = photoTex(b), discM = keep(new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.2, 64), [new THREE.MeshStandardMaterial({ map: dtex, roughness: 0.3, metalness: 0.3, envMap: ENV, envMapIntensity: 0.5 }), new THREE.MeshStandardMaterial({ color: mc, roughness: mr, metalness: mm, envMap: ENV }), new THREE.MeshStandardMaterial({ color: mc, roughness: mr, metalness: mm, envMap: ENV })]));
    discM.position.y = 0.52; gDisc.add(discM); finishOver(b, dtex, new THREE.CylinderGeometry(0.925, 0.925, 0.2, 64, 1, true), gDisc, 0.52);
    /* attack ring: the photo cut to the ring's shape, its finish over the top, an edge of tier light */
    const shape = ringShape(a, st.dir), clear = a.variant === 'clear';
    const rg = planarUV(new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2, curveSegments: 6 }).rotateX(-Math.PI / 2));
    const ptex = photoTex(a), ring = keep(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.3, metalness: 0.2, envMap: ENV, envMapIntensity: 0.6, transparent: clear, opacity: clear ? 0.55 : 1 }))); ring.position.y = 0.62; gRing.add(ring);
    finishOver(a, ptex, planarUV(new THREE.ShapeGeometry(shape, 6).rotateX(-Math.PI / 2)), gRing, 0.62 + 0.14 + 0.03);
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(shape.getPoints(6).map(p => new THREE.Vector3(p.x, 0, -p.y))), new THREE.LineBasicMaterial({ color: tierCol(a), toneMapped: false, transparent: true, opacity: 0.9 })); edge.position.y = 0.62 + 0.14 + 0.035; gRing.add(edge); keep(edge);
    /* the blur of a fast spin, and a soft shadow under it */
    const halo = keep(new THREE.Mesh(new THREE.CircleGeometry(1.04, 48), new THREE.MeshBasicMaterial({ map: dot, color: tierCol(a), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.82; tilt.add(halo);
    const shadow = S.shadow(2.4, 2.4); shadow.position.y = 0.02; tilt.add(shadow); keep(shadow); const bl0 = {};
    /* whose it is: a ring of light on the bowl under it, gold for you and red for your rival */
    if (who) { const mk = keep(new THREE.Mesh(new THREE.RingGeometry(1.14, 1.3, 64), new THREE.MeshBasicMaterial({ color: who === 'me' ? 0xe3ad57 : 0xe4552e, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))); mk.rotation.x = -Math.PI / 2; mk.position.y = 0.05; root.add(mk); bl0.marker = mk; }
    const bl = { root, tilt, spin, parts: [gRing, gDisc, gTip], halo, fins, st, slabs: parts, who, marker: bl0.marker || null, vang: 0, drop: 0, dead: null, deadT: 0, vy: 0, fly: null, tiltN: new THREE.Quaternion(), whirr: null,
      dispose() { if (bl.whirr) bl.whirr.stop(); root.removeFromParent(); bl.parts.forEach(p => p.removeFromParent()); new Set([...geos, ...mats, ...myTex]).forEach(x => { try { x.dispose(); } catch (e) {} }); } };
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
  function pose(bl, t, dt) {
    const r = Math.hypot(t.p.x, t.p.y), s = Math.min(1, Math.abs(t.w) / B.W.wRef);
    bl.root.position.set(t.p.x, hB(r) + bl.drop, t.p.y);
    nrm.set(-2 * DEP * t.p.x / (R * R), 1, -2 * DEP * t.p.y / (R * R)).normalize(); bl.tiltN.setFromUnitVectors(up, nrm);
    if (t.wob) { const ph = T.time() * 9; wAxis.set(Math.cos(ph), 0, Math.sin(ph)); wq.setFromAxisAngle(wAxis, t.wob * 0.4); bl.tiltN.multiply(wq); }
    bl.tilt.quaternion.slerp(bl.tiltN, 1 - Math.exp(-dt * 20));
    /* drawn turning at a readable rate (the real 10 turns a second strobes), with a faint blur on top */
    bl.vang += Math.sign(t.w) * Math.min(Math.abs(t.w), 9) * dt; bl.spin.rotation.y = -bl.vang; bl.halo.material.opacity = 0.12 * s * s;
    const a = t.ang * 0.08 + T.time() * 0.6; bl.fins.forEach(f => { try { f.def.update(f.m, { tilt: new THREE.Vector2(Math.cos(a) * 0.7, Math.sin(a) * 0.7), pointer: new THREE.Vector2(0.5, 0.5), dt, time: T.time() }); } catch (e) {} });
    if (bl.whirr) bl.whirr.set(t.alive ? s : 0, t.p.x / R);
  }

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
    const st = BS.statsOf([s, s, s]); if (i === 0) return SL.tierOf(s).name + ' · ' + (rank(s) <= 1 ? 'rounded edge' : (2 + rank(s)) + ' sharp teeth'); if (i === 1) return SL.tierOf(s).name + ' · ' + (SL.finishOf(s) === 'matte' ? 'steel' : (SL.FINISH[SL.finishOf(s)] || {}).name || 'metal');
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
  function buildPreview() { if (B.preview) { B.preview.dispose(); B.preview = null; } if (!B.slots.every(Boolean)) return; const st = BS.statsOf(B.slots); B.preview = makeBlade(B.slots, st); B.preview.ang = 0; B.preview.root.position.set(0, 0.6, 0); rimTo(tierCol(B.slots[0])); }
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
  function clearBlades() { [B.me, B.rival].forEach(b => { if (b) b.dispose(); }); B.me = B.rival = null; B.debris.forEach(d => { d.g.removeFromParent(); }); B.debris = []; if (aim) aim.visible = false; }
  /* the aim: a thin arrow on the bowl from your blade, as long as the pull */
  const aim = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false })); aim.geometry.translate(0, 0.5, 0); aim.rotation.x = -Math.PI / 2; aim.visible = false; stadium.add(aim);
  function doLaunch(power, ang) { const [a, b] = B.W.tops; BS.launch(a, power, ang); BS.launch(b, B.rivalPlan.power, B.rivalPlan.aim);
    B.me.whirr = whirr(); B.rival.whirr = whirr(); aim.visible = false; snd('pop'); snd('rumble', { gain: 0.5, dur: 0.6 }); banner('Let it rip!', '', 900); M.go('blades.battle'); }
  function fx(ev) {
    const [a, b] = B.W.tops, blOf = t => t === a ? B.me : B.rival;
    for (const e of ev) {
      if (e.type === 'hit') { const y = hB(Math.hypot(e.x, e.y)) + 0.45, n = Math.min(60, Math.round(6 + e.k * 14)); spark(e.x, y, e.y, n, [tierCol(B.me.slabs[0]), tierCol(B.rival.slabs[0]), 0xffe2a0], 2 + e.k);
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
      else if (e.type === 'burst') { burstApart(blOf(e.top), e.top); }
      else if (e.type === 'out') { const bl = blOf(e.top), t = e.top, r = Math.hypot(t.p.x, t.p.y) || 1; bl.dead = 'out'; bl.fly = { x: t.p.x, z: t.p.y, y: hB(r), vx: t.p.x / r * 4.5, vz: t.p.y / r * 4.5, vy: 4.2, spin: t.w }; snd('slam'); }
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
  const FRAME = () => ({ tx: CX, ty: LIFT, tz: CZ + 0.8, pitch: 55, dT: ctx.fitDist(11, 11.5, 55) });
  /* ease the camera towards a framing (dt) or set it for the room's own smoothing to take there (no dt) */
  function camTo(tx, tz, size, dt) { const c = ctx.cam, d = ctx.fitDist(size, size, 55); if (dt) { c.tx = T.damp(c.tx, tx, 2.5, dt); c.tz = T.damp(c.tz, tz, 2.5, dt); c.dT = T.damp(c.dT, d, 2.5, dt); } else { c.tx = tx; c.tz = tz; c.dT = d; } }
  /* You and Rival tags over the blades while they're in the bowl */
  function battleTags() { const on = (M.is('blades.ready') || M.is('blades.battle') || M.is('blades.round')) && B.me && B.rival;
    tags.classList.toggle('on', !!on); if (!on) return; if (!tags.querySelector('.who')) tags.innerHTML = '<div class="bl-tag who me">You</div><div class="bl-tag who rv">Rival</div>';
    [B.me, B.rival].forEach((bl, i) => { const el = tags.children[i]; if (!el) return; const gone = bl.dead === 'burst' || (bl.dead === 'out' && bl.deadT > 1); const p = toScreen(bl.root, 1.25); el.style.opacity = gone || !p.on ? 0 : 1; el.style.transform = 'translate(' + Math.round(p.x - el.offsetWidth / 2) + 'px,' + Math.round(p.y - el.offsetHeight) + 'px)'; }); }
  M.define('blades', {
    on: { CLOSE: () => 'blades.closing' },
    key(e, M) { if (e.key === 'Escape') M.send('CLOSE'); return true; },
    pointer(kind, e) { if (kind === 'wheel') { ctx.cam.dT = T.clamp(ctx.cam.dT * Math.exp(e.deltaY * 0.0012), 8, 40); } return true; },
    frame(dt) { dt = Math.min(dt, 0.05); sparkFrame(dt); debrisFrame(dt); if (!M.is('blades.build.inspect')) battleTags();
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
    enter(d) { if (M.prev === 'blades.build.inspect') { renderCard(); card.classList.add('on'); return; } hud.classList.remove('on'); hideBar(); hideBanner(); tip.classList.remove('on'); clearBlades(); camTo(CX, CZ + 0.8, 11); B.slots = B.slots.map(s => s && byId(s.id) ? s : null); if (!B.slots.every(Boolean)) { const n = B.slots.findIndex(x => !x); B.active = n >= 0 ? n : 0; } renderCard(); card.classList.add('on'); buildPreview(); },
    exit(next) { card.classList.remove('on'); if (!/^blades\.build/.test(next || '')) dropPreview(); },
  });
  function dropPreview() { if (B.preview) { B.preview.dispose(); B.preview = null; } }
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
      S.cam.push({ tx: CX, ty: LIFT + 2.0 + 1.1, tz: CZ, pitch: 14, dT: ctx.fitDist(6, 6, 14) }); ctx.canvas.style.cursor = 'grab';
      T.to(P.root.position, { y: 2.0 }, { dur: 0.6, ease: E.outCubic, tag: 'blades' }); T.tween({ dur: 0.6, ease: E.outCubic, tag: 'blades', update: e => P.root.scale.setScalar(B.look.r * (1 + 1.3 * e)) });
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
      L.k = T.damp(L.k, L.apart ? 1 : 0, 6, dt); P.parts[0].position.y = 1.0 * L.k; P.parts[1].position.y = 0.45 * L.k; P.parts[2].position.y = -0.35 * L.k;
      const el = tags.children; for (let i = 0; i < el.length; i++) { const p = toScreen(P.parts[i], 0.62 * P.root.scale.x * [0.75, 0.55, 0.3][i]), side = [1, -1, 1][i];
        el[i].style.transform = 'translate(' + Math.round(p.x + side * (60 + 30 * L.k) - (side < 0 ? el[i].offsetWidth : 0)) + 'px,' + Math.round(p.y - el[i].offsetHeight / 2 + (i - 1) * 46 * (1 - L.k)) + 'px)'; el[i].style.opacity = L.k > 0.5 || i === 0 ? 1 : 0.35 + 0.65 * L.k; } },
  });
  function lookBar() { showBar([['back', 'Back'], ['apart', B.look && B.look.apart ? 'Put it together' : 'Take it apart'], ['fight', 'Fight', true]]); }
  M.define('blades.ready', {
    enter() { hideBar(); newRound(); ctx.canvas.style.cursor = 'grab'; camTo(CX, CZ + 1.3, 8.5); tip.innerHTML = 'Drag down to pull back, left or right to aim. Let go to rip.'; tip.classList.add('on'); hud.classList.add('on'); hudFrame(0, true); const rs = B.rivalParts[0]; banner(B.score[0] + B.score[1] ? 'Round ' + (B.roundN = (B.roundN || 1) + 1) : 'Pull back and let go', 'Your rival: ' + esc((rs.photo && rs.photo.pack || 'Sample pack').replace(/\s*·.*$/, '')) + ' ring, ' + BS.TIPS[BS.statsOf(B.rivalParts).tip].name.toLowerCase() + ' tip', 0); rimTo(tierCol(B.slots[0])); },
    pointer(kind, e) {
      if (kind === 'down' && e.button === 0) { B.drag = { x: e.clientX, y: e.clientY, power: 0, aim: 0 }; ctx.canvas.style.cursor = 'grabbing'; snd('servo'); return true; }
      if (kind === 'move' && B.drag) { const D = B.drag; D.power = T.clamp((e.clientY - D.y) / 220, 0, 1); D.aim = T.clamp(-(e.clientX - D.x) / 260, -0.7, 0.7); return true; }
      if (kind === 'up' && B.drag) { const D = B.drag; B.drag = null; ctx.canvas.style.cursor = 'grab'; if (D.power < 0.12) { banner('Pull back further', 'Drag down, then let go', 1400); return true; } hideBanner(); tip.classList.remove('on'); doLaunch(D.power, D.aim); return true; }
      return kind !== 'wheel' ? true : false; },
    frame(dt) { if (!B.W) return; const [a, b] = B.W.tops, D = B.drag;
      a.ang += a.w * dt; b.ang += b.w * dt; pose(B.me, a, dt); pose(B.rival, b, dt);
      /* while you pull, your blade draws back towards you and the aim line shows where it goes */
      if (D) { a.p.x = Math.sin(D.aim) * R * 0.25 - Math.sin(D.aim) * D.power * 0.6; a.p.y = R * 0.62 + D.power * 0.35; a.w = B.slots && BS.statsOf(B.slots).dir * (6 + D.power * 40);
        aim.visible = D.power > 0.05; aim.position.set(a.p.x, hB(Math.hypot(a.p.x, a.p.y)) + 0.05, a.p.y); aim.scale.set(1, 0.6 + D.power * 3.2, 1); aim.rotation.set(-Math.PI / 2, 0, -D.aim); aim.material.opacity = 0.3 + 0.5 * D.power; }
      else { aim.visible = false; a.p.x = 0; a.p.y = R * 0.62; } },
  });
  M.define('blades.battle', {
    enter() { ctx.canvas.style.cursor = 'default'; },
    key(e) { if (e.key === ' ') { const ev = []; if (BS.special(B.W, B.W.tops[0], ev)) fx(ev); return true; } return false; },
    frame(dt) { dt = Math.min(dt, 0.05); const W = B.W, [a, b] = W.tops; B.me.drop *= Math.exp(-dt * 14); B.rival.drop *= Math.exp(-dt * 14);
      B.acc += dt; const ev = []; while (B.acc >= 1 / 120) { B.acc -= 1 / 120; BS.step(W, 1 / 120, ev); if (BS.aiThink(W, b, 1 / 120)) BS.special(W, b, ev); }
      fx(ev);
      if (a.alive) pose(B.me, a, dt); else deadFrame(B.me, a, dt); if (b.alive) pose(B.rival, b, dt); else deadFrame(B.rival, b, dt);
      /* the camera leans towards the action, never far from the middle of the bowl */
      const mx = (a.p.x + b.p.x) / 2, mz = (a.p.y + b.p.y) / 2; camTo(CX + mx * 0.35, CZ + 0.9 + mz * 0.35, 9.5, dt);
      hudFrame(dt); const o = BS.outcome(W); if (o) M.go('blades.round', o); },
  });
  M.define('blades.round', { busy: true,
    /* the winner keeps spinning and the loser finishes falling, for a beat */
    frame(dt) { dt = Math.min(dt, 0.05); const [a, b] = B.W.tops; [[a, B.me], [b, B.rival]].forEach(([t, bl]) => { if (!bl) return; if (t.alive) { t.ang += t.w * dt; t.w *= Math.exp(-dt * 0.3); pose(bl, t, dt); } else deadFrame(bl, t, dt); }); },
    async enter(o, run) { const W = B.W, [a, b] = W.tops, won = o.winner === a; tip.classList.remove('on'); B.score[won ? 0 : 1] += o.pts; hudFrame(0, true);
      if (o.how === 'time') { [a, b].forEach(t => { if (t !== o.winner) { t.alive = false; (t === a ? B.me : B.rival).dead = 'spin'; } }); }
      banner(HOW[o.how] + '!', (won ? 'You' : 'Your rival') + ' +' + o.pts + (o.pts === 1 ? ' point' : ' points'), 0); snd(won ? 'chime' : 'sink', won ? { tier: o.pts > 1 ? 'epic' : 'rare' } : { dur: 0.8 });
      await T.wait(2.4, 'blades'); if (!run.alive()) return; [B.me, B.rival].forEach(bl => { if (bl && bl.whirr) { bl.whirr.stop(); bl.whirr = null; } });
      if (B.score[0] >= BS.WIN_AT || B.score[1] >= BS.WIN_AT) M.go('blades.result'); else M.go('blades.ready'); },
  });
  M.define('blades.result', {
    enter() { const win = B.score[0] >= BS.WIN_AT; hudFrame(0, true); camTo(CX, CZ + 0.8, 11); banner(win ? 'You win the match' : 'Your rival takes it', B.score[0] + ' to ' + B.score[1], 0); snd(win ? 'countFinal' : 'sink'); if (win) snd('chime', { tier: 'legendary' });
      showBar([['done', 'Done'], ['rebuild', 'Change parts'], ['rematch', 'Rematch', true]]); },
    exit() { hideBar(); },
  });
  M.define('blades.closing', { busy: true, on: { CLOSE: () => undefined },
    async enter(d, run) { card.classList.remove('on'); hud.classList.remove('on'); tags.classList.remove('on'); tip.classList.remove('on'); hideBar(); hideBanner(); B.drag = null; clearBlades(); if (B.preview) { B.preview.dispose(); B.preview = null; }
      snd('sink', { dur: 1.4 }); T.to(spot, { intensity: 0 }, { dur: 1.2, tag: 'blades' });
      await T.tween({ dur: 0.5, ease: E.inBack, tag: 'blades', update: e => stadium.scale.setScalar(1 - 0.5 * e) });
      await T.to(stadium.position, { y: DOWN }, { dur: 1.2, ease: E.inCubic, tag: 'blades' });
      stadium.visible = false; spot.visible = false; await S.under.doors(false);
      if (B.pushed) { S.cam.pop(); B.pushed = false; } forgetRival(); S.sfx('detent'); B.score = [0, 0]; B.roundN = 1; M.go(S.under.on ? 'under' : 'idle'); },
  });
  function forgetRival() { if (B.rivalParts) B.rivalParts.forEach(s => SM.forgetPhoto(s.id)); B.rivalParts = null; }
  function startMatch() { B.score = [0, 0]; B.roundN = 1; forgetRival(); B.rivalParts = rollRival(); M.go('blades.ready'); }
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
    borrow() { borrow(); randomPick(); },
    launch(power, ang) { if (M.is('blades.ready')) doLaunch(power ?? 0.8, ang ?? 0); } };
  S.dev.info(() => { const W = B.W; return /^blades/.test(M.state) ? 'Blades: ' + M.state.replace('blades.', '') + (W ? ' · ' + W.t.toFixed(1) + ' s · ' + W.tops.map(t => (t.alive ? 'spinning ' + Math.abs(t.w).toFixed(0) : t.done)).join(' / ') : '') : ''; });
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
.bl-tag.part{ width:210px; padding:8px 10px; border-left:3px solid var(--tc); background:var(--panel); border-radius:0 6px 6px 0; color:var(--text); font:400 11px/1.35 var(--f-ui); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); }
.bl-tag.part b{ display:block; font:600 12px/1.2 var(--f-ui); margin-bottom:2px; } .bl-tag.part span{ display:block; color:var(--faint); } .bl-tag.part em{ display:block; margin-top:3px; font-style:normal; color:var(--text); }
#skBlTip{ position:fixed; left:50%; bottom:calc(84px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); padding:8px 14px; border-radius:999px; background:var(--panel); border:1px solid var(--line); color:var(--text); font:500 12px/1.2 var(--f-ui); opacity:0; pointer-events:none; transition:opacity .3s; z-index:7; }
#skBlTip.on{ opacity:1; animation:blTip 2.4s ease-in-out infinite; } @keyframes blTip{ 50%{ border-color:var(--accent); } }
.bl-clock{ align-self:center; min-width:44px; text-align:center; font:600 20px/1 var(--f-mono); color:var(--text); text-shadow:0 2px 12px rgba(0,0,0,.7); }
`;
