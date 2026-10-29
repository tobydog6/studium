// UNDER: Space (once the layer is unlocked) flips the whole table over. The underside is the dark side: a matte black
// top with the big loot button, the vault's case, hangar doors over the pit (they slide apart from the middle and the
// rail rises through the gap) and every raw print, slab and parcel you own. Space again flips it back and the table is
// exactly as it was. The table body and surface ride a pivot; everything else on the light side is hidden at the
// half-way point of the somersault and shown again on the way back.
//   S.under = { on, rect, group, doors(open) → Promise, flip(to) }   states 'flipping' (busy) and 'under' (the dark idle)
import * as THREE from 'three';

export function install(S) {
  const { T, M, ctx } = S, E = T.E, W = ctx.W_T, H = ctx.H_T, PIV_Y = -0.6;
  const RECT = S.loot && S.loot.rect ? S.loot.rect.slice() : [6, -11.7, 17, -7];
  const [X0, Z0, X1, Z1] = RECT, PW = X1 - X0, PD = Z1 - Z0, CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2;
  const VAULT = { x: -0.3, z: 0.3, r: 2.15 };
  const U = { on: false, rect: RECT, hidden: [], pan: null, doorK: 0, busy: false };
  /* the pivot carries the table body and its surface; the dark side hangs beneath, face down, until the flip */
  const pivot = new THREE.Group(); pivot.position.set(0, PIV_Y, 0); pivot.userData.secret = true; ctx.scene.add(pivot);
  const surface = ctx.scene.children.find(m => m.isMesh && m.material === ctx.surfMat);
  pivot.attach(ctx.tableBody); if (surface) pivot.attach(surface);
  const group = new THREE.Group(); group.position.y = -1.2 - PIV_Y; group.rotation.x = Math.PI; group.userData.secret = true; pivot.add(group);
  /* the dark top: a plate with the pit and the vault's round opening cut out of it */
  const gridTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#101013'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,0.045)'; g.lineWidth = 1; for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, 256); g.stroke(); g.beginPath(); g.moveTo(0, i + 0.5); g.lineTo(256, i + 0.5); g.stroke(); } for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.25)'; g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(W / 4, H / 4); return t; })();
  const shape = new THREE.Shape(); shape.moveTo(-W / 2, H / 2); shape.lineTo(W / 2, H / 2); shape.lineTo(W / 2, -H / 2); shape.lineTo(-W / 2, -H / 2); shape.closePath();
  const pit = new THREE.Path(); pit.moveTo(X0, -Z0); pit.lineTo(X1, -Z0); pit.lineTo(X1, -Z1); pit.lineTo(X0, -Z1); pit.closePath(); shape.holes.push(pit);
  const plateGeo = new THREE.ShapeGeometry(shape, 24); { const uv = plateGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / W + 0.5, uv.getY(i) / H + 0.5); }
  const plate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, map: gridTex, roughness: 0.92, metalness: 0.15 })); plate.rotation.x = -Math.PI / 2; group.add(plate);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.9, 0.12, H + 0.9), new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.6, metalness: 0.5 })); rim.position.y = -0.07; group.add(rim);
  /* the vault's round opening: a cover that steps aside while the vault is up (its lift disc fills the hole then) */
  const cover = new THREE.Group(); cover.visible = false;
  /* the hangar doors over the pit: two leaves meeting in the middle, a hazard stripe along the join */
  const stripe = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#16161a'; g.fillRect(0, 0, 256, 32); g.fillStyle = '#d9a32a'; for (let x = -32; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.closePath(); g.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(PW / 4, 1); return t; })();
  /* the pit's lid is the table top itself: two flush halves that split down the middle and slide apart (Sam: no hangar doors) */
  void stripe;
  const doors = [-1, 1].map(s => { const d = new THREE.Group(); d.position.set(CX, 0, CZ); group.add(d);
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(PW / 2, PD), plate.material); leaf.rotation.x = -Math.PI / 2; leaf.position.set(s * PW / 4, 0.001, 0); d.add(leaf);
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.03, PD), new THREE.MeshBasicMaterial({ color: 0x000000 })); seam.rotation.x = -Math.PI / 2; seam.position.set(s * 0.015, 0.002, 0); d.add(seam);
    d.userData.s = s; return d; });
  { const uv = doors[0].children[0].geometry.attributes.uv, uv2 = doors[1].children[0].geometry.attributes.uv; const fix = (a, s) => { for (let i = 0; i < a.count; i++) a.setXY(i, (CX + s * PW / 4 + (a.getX(i) - 0.5) * PW / 2) / W + 0.5, (CZ - (a.getY(i) - 0.5) * PD) / H + 0.5); a.needsUpdate = true; }; fix(uv, -1); fix(uv2, 1); }
  /* the big loot button and a cool light or two */
  const big = S.pushButton ? S.pushButton(0xe4552e) : new THREE.Group(); big.name = 'loot'; big.scale.setScalar(3.2); big.position.set(14.5, 0, 8.2); big.userData.base = 0.6; group.add(big);
  const l1 = new THREE.PointLight(0x5d7cff, 90, 44, 1.6); l1.position.set(-12, 7, 2); group.add(l1);
  const l2 = new THREE.PointLight(0xff7a3a, 70, 36, 1.6); l2.position.set(CX, 6, CZ + 3); group.add(l2);
  const l3 = new THREE.PointLight(0xffffff, 30, 30, 1.8); l3.position.set(10, 6, 8); group.add(l3);
  let vaultHome = null, hum = null;
  const binderRoot = S.binder && S.binder.mesh ? S.binder.mesh() : null;   /* the Rare binder is a prop on the dark side; click it to open */
  [S.buttons.vault, S.buttons.key].forEach(b => { if (b) b.userData.secret = true; });   /* ours: the flip moves the case itself and leaves the keyhole alone */

  function setDoors(k) { U.doorK = k; doors.forEach(d => { d.position.x = CX + d.userData.s * (PW / 2 + 0.5) * k; }); }
  async function openDoors(open) {
    if (open) { S.snd.play('blind', { dur: 1.5 }); S.hole.open(X0, Z0, X1, Z1); await T.tween({ dur: 1.5, ease: E.inOutCubic, tag: 'under', update: e => setDoors(e) }); S.snd.play('land'); }
    else { S.snd.play('sink', { dur: 1.3 }); await T.tween({ dur: 1.3, ease: E.inOutCubic, tag: 'under', update: e => setDoors(1 - e) }); S.hole.close(); S.snd.play('land'); }
  }
  /* what the flip hides: everything that sits on the light side of the table (not the lights, not the room, not ours) */
  const v = new THREE.Vector3();
  /* hidden by layer, not by visible: main.js sets visible on its prints every frame, but never touches layers */
  function hideLightSide() { U.hidden = []; ctx.scene.children.forEach(c => { if (c === pivot || c.isLight || c.userData.secret || !S.isLightSide(c)) return; c.getWorldPosition(v); if (Math.abs(v.x) < W / 2 + 3 && Math.abs(v.z) < H / 2 + 3 && v.y > -0.5 && v.y < 12) { U.hidden.push(c); c.traverse(o => o.layers.set(7)); } }); }
  function showLightSide() { U.hidden.forEach(c => c.traverse(o => o.layers.set(0))); U.hidden = []; }
  function showSecret(on) { S.table.list.forEach(o => { o.group.visible = on; if (o.tableShadow) o.tableShadow.visible = on; }); big.visible = on; if (binderRoot) binderRoot.visible = on; if (S.caseBox) S.caseBox.group.visible = on; if (S.vitrine) S.vitrine.group.visible = on;
    if (S.parcel && S.parcel.__boxes) S.parcel.__boxes().forEach(b => { if (b.group) b.group.visible = on; }); }
  function takeVault(on) { const b = null; if (!b) return;
    if (on) { vaultHome = { parent: b.parent, pos: b.position.clone(), rot: b.rotation.clone(), scale: b.scale.clone() }; group.add(b); b.position.set(-13.5, 0, -2.5); b.rotation.set(0, 0.35, 0); b.scale.setScalar(2.6); }
    else if (vaultHome) { vaultHome.parent.add(b); b.position.copy(vaultHome.pos); b.rotation.copy(vaultHome.rot); b.scale.copy(vaultHome.scale); vaultHome = null; } }

  M.define('flipping', { busy: true, on: { CLOSE: () => undefined },
    async enter(d, run) {
      const to = d && d.to === 'idle' ? false : true; if (to === U.on) { M.go(U.on ? 'under' : 'idle'); return; }
      if (S.inspect.active()) S.inspect.close('back');
      S.cam.push({ tx: 0, tz: 1.5, pitch: 44, dT: ctx.fitDist(W + 6, H + 10, 44) }); ctx.hideActs(); S.snd.play('rise', { dur: 1.7 }); S.sfx('lift');
      const a0 = pivot.rotation.x, a1 = a0 + Math.PI; let flipped = false;
      /* what sits on the side going down vanishes as the turn starts; the other side's things appear at the half way point */
      if (to) hideLightSide(); else showSecret(false);
      await T.tween({ dur: 1.7, ease: E.inOutCubic, tag: 'flip', update: e => { pivot.rotation.x = a0 + (a1 - a0) * e;
        if (!flipped && e >= 0.5) { flipped = true; if (to) { takeVault(true); showSecret(true); } else { takeVault(false); } } } });
      pivot.rotation.x = to ? Math.PI : 0; if (!flipped) { flipped = true; if (to) { takeVault(true); showSecret(true); } else { takeVault(false); } }
      if (!to) showLightSide();
      U.on = to; S.snd.play('slam'); S.sfx('ltPutDown'); S.cam.pop();
      if (to) { hum = S.snd.loop('hum'); S.toast('The underside. The big red button opens a pack. Space turns the table back over.'); } else { if (hum) { hum.stop(0.5); hum = null; } S.toast('Back the right way up.'); }
      if (run.alive()) M.go(to ? 'under' : 'idle');
    },
  });
  M.define('under', {
    on: { VAULT: (p, M) => M.defined('vault.open') ? 'vault.open' : undefined, LOOT: (p, M) => M.defined('loot.open') ? 'loot.open' : undefined, BLADES: (p, M) => M.defined('blades.open') ? 'blades.open' : undefined, BINDER: (p, M) => M.defined('binder.open') ? 'binder.open' : undefined, CLOSE: () => undefined },
    enter() { ctx.hideActs(); },
    pointer(kind, e) {
      if (U.pan) { if (kind === 'move') { const h = S.tableHit(e, 0); if (h) { ctx.cam.tx += U.pan.x - h.x; ctx.cam.tz += U.pan.z - h.z; if (ctx.clampCam) ctx.clampCam(); } return true; } if (kind === 'up') { U.pan = null; ctx.canvas.style.cursor = 'default'; } return true; }
      if (S.caseBox && S.caseBox.pointer(kind, e)) return true; if (S.vitrine && S.vitrine.pointer(kind, e)) return true;
      if (S.tablePointer(kind, e, [big, S.buttons.blades, binderRoot, ...S.table.list.map(o => o.group)])) return true;
      if (kind === 'down' && e.button === 0) { const h = S.tableHit(e, 0); if (h) { U.pan = { x: h.x, z: h.z }; ctx.canvas.style.cursor = 'grabbing'; } return true; }
      if (kind === 'wheel') { ctx.cam.dT = T.clamp(ctx.cam.dT * Math.exp(e.deltaY * 0.0012), 8, 70); return true; }
      return true;
    },
    key(e) { if (e.key === ' ') { M.go('flipping', { to: 'idle' }); return true; } return true; },
    frame(dt) { if (S.caseBox) S.caseBox.frame(dt); if (S.vitrine) S.vitrine.frame(dt); big.userData.pulse = (big.userData.pulse || 0) + dt; const cap = big.userData.cap; if (cap) { const want = big.userData.hotT ? 1.4 : 0.35 + 0.25 * Math.sin(big.userData.pulse * 2.4); cap.material.emissiveIntensity += (want - cap.material.emissiveIntensity) * (1 - Math.exp(-dt * 10)); } },
  });
  S.under = { get on() { return U.on; }, rect: RECT, group, doors: openDoors, flip(to) { if (M.is('idle') || M.is('under')) M.go('flipping', { to }); }, state: U,
    frame() { cover.visible = !/^vault/.test(M.state); if (U.on && M.is('idle')) M.go('under'); if (U.on && M.is('under') && binderRoot && !binderRoot.visible) binderRoot.visible = true; if (U.on && S.parcel && S.parcel.__boxes) S.parcel.__boxes().forEach(b => { if (b.group && !b.group.visible && !b.opening) b.group.visible = true; }); } };
  S.dev.action('Flip the table', () => S.under.flip(U.on ? 'idle' : 'under'), 'Try');
}
