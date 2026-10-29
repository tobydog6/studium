// PARCEL: the courier box that brings a graded slab back. See docs/secret-round2.md. Sam's picks: the courier box
// (Round 2 page: brown card, packing tape, a printed label, a FRAGILE stamp) slides in from the near edge of the
// table; the unboxing (Cases page) is the tape cut, the flaps folding back, the tissue parting and the slab rising
// to meet you; the first look is the count up (the slab lands flat and the grade ticks up from 1 to its number, the
// last tick the loudest). A slab's label canvas (slabmesh.js) bakes the grade in, so the count runs on a small
// plane laid over just that spot, then comes away so the real label shows.
//   S.parcel = { check(), pointer(kind, e) → bool, frame(dt) }   state: parcel.open (busy; CLOSE finishes it quickly)
//   Test hooks: S.parcel.__boxes() (the boxes on the table), S.parcel.__phase() (where the unboxing is up to).
import * as THREE from 'three';

const BOX = { w: 1.6, h: 1.0, d: 2.0, t: 0.035 };    /* the carton: width, height, depth, card thickness */
const IN_K = 0.32, DEF_K = 0.42;                     /* the slab's scale inside the box, and on the table if S.TABLE_K is unset */
const STEP = 0.24;                                   /* the count up: seconds per tick */
const TAG = 'parcel.open';
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const yawQ = a => new THREE.Quaternion().setFromAxisAngle(Y, a);
const flatQ = () => new THREE.Quaternion().setFromAxisAngle(X, -Math.PI / 2);

export function install(S) {
  const { T, M, P, SL, store } = S, E = T.E, ctx = S.ctx, { w: W, h: H, d: D, t: T0 } = BOX;
  const ENV = S.SM.envMap(S.renderer);
  const stdM = (c, r, m, o) => new THREE.MeshStandardMaterial({ color: c, roughness: r ?? 0.5, metalness: m ?? 0, ...(o || {}) });
  const box = (w, h, d, mat, x, y, z, parent, r) => { const m = new THREE.Mesh(r ? new S.RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), c); return S.SM.tex(c); };
  const snd = (id, o) => { try { if (S.snd) S.snd.play(id, o); } catch (e) {} };
  const boxes = []; let hot = null, poll = 0.6, rush = false, phase = 'idle';

  /* ---------- the carton ---------- */
  function labelTex(slab) { return canvasTex(512, 256, g => { g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#1e1b18'; g.lineWidth = 4; g.strokeRect(14, 14, 484, 228); g.fillStyle = '#1e1b18'; g.textAlign = 'left';
    g.font = '700 38px "Geist", system-ui, sans-serif'; g.fillText('STUDIUM GRADED · RETURN', 34, 82); g.font = '500 24px "Geist Mono", ui-monospace, monospace'; g.fillText('TO: THE LIGHT TABLE', 34, 128); g.fillText('CERT  ' + (slab.cert || ''), 34, 164);
    const r = T.rng((slab.seed || 7) + 11); for (let i = 0; i < 40; i++) g.fillRect(300 + i * 4.6, 196, r() < 0.5 ? 2 : 3, 34); }); }
  function stencilTex(t, sub, col) { return canvasTex(512, 160, g => { g.clearRect(0, 0, 512, 160); g.fillStyle = col; g.textAlign = 'center'; g.font = '700 64px "Geist", system-ui, sans-serif'; g.fillText(t, 256, 78); g.font = '500 26px "Geist Mono", ui-monospace, monospace'; g.fillText(sub, 256, 124); }); }
  /* a closed courier carton: base and walls, two end flaps under two long flaps that meet at a taped seam, a band of tape round it */
  function makeBox(slab) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const card = stdM(0xb98b5a, 0.92, 0, { emissive: 0xffffff, emissiveIntensity: 0 }), tape = stdM(0xd9cfbb, 0.5, 0, { transparent: true, opacity: 0.92 });
    box(W, T0, D, card, 0, T0 / 2, 0, body); [-1, 1].forEach(s => { box(T0, H, D, card, s * (W / 2 - T0 / 2), H / 2, 0, body); box(W, H, T0, card, 0, H / 2, s * (D / 2 - T0 / 2), body); });
    const flapW = W / 2, endD = Math.min(D / 2, W / 2) * 0.92;
    const ends = [-1, 1].map(s => { const hg = new THREE.Group(); hg.position.set(0, H - T0 / 2, s * D / 2); body.add(hg); box(W - 0.04, T0, endD, card, 0, 0, -s * endD / 2, hg); return { hg, s }; });
    const longs = [-1, 1].map(s => { const hg = new THREE.Group(); hg.position.set(s * W / 2, H + T0 / 2, 0); body.add(hg); box(flapW, T0, D - 0.02, card, -s * flapW / 2, 0, 0, hg);
      box(0.17, 0.012, D - 0.02, tape, -s * (flapW - 0.085), T0 / 2 + 0.008, 0, hg); box(flapW, 0.012, 0.36, tape, -s * flapW / 2, T0 / 2 + 0.011, 0, hg); return { hg, s }; });
    [-1, 1].forEach(s => box(0.012, H - 0.02, 0.36, tape, s * (W / 2 + 0.004), H / 2, 0, body));
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.36), new THREE.MeshBasicMaterial({ map: labelTex(slab) })); lab.rotation.x = -Math.PI / 2; lab.rotation.z = -0.05; lab.position.set(-flapW / 2 + 0.02, T0 / 2 + 0.004, 0.5); longs[1].hg.add(lab);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.25), new THREE.MeshBasicMaterial({ map: stencilTex('FRAGILE', 'THIS WAY UP', '#b8302a'), transparent: true })); fr.position.set(0.05, H * 0.5, D / 2 + 0.002); body.add(fr);
    /* the cut: a dark slit that opens along the seam behind a blade */
    const slit = box(0.03, 0.006, 1, stdM(0x100c08, 1), 0, H + T0 + 0.004, 0, body); slit.visible = false;
    const blade = new THREE.Group(); blade.visible = false; body.add(blade);
    const edge = box(0.012, 0.3, 0.3, stdM(0xe4e7ea, 0.2, 0.95, { envMap: ENV, envMapIntensity: 1.3 }), 0, 0.13, -0.02, blade); edge.rotation.x = -0.55;
    box(0.1, 0.13, 0.5, stdM(0xe3b32a, 0.5, 0.05), 0, 0.36, -0.3, blade, 0.025);
    /* two sheets of tissue over the slab, hinged at the side walls */
    const tissue = [-1, 1].map(sx => { const hg = new THREE.Group(); hg.position.set(sx * (W / 2 - 0.06), 0.3, 0); body.add(hg); const geo = new THREE.PlaneGeometry(flapW - 0.1, D - 0.3, 8, 18);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xf7f4ee, transparent: true, opacity: 0.9, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.x = -sx * (flapW - 0.1) / 2; hg.add(m); return { hg, geo, base: geo.attributes.position.array.slice(), sx }; });
    const sh = S.shadow(W + 1.1, D + 1.1); sh.position.set(0.08, 0.004, 0.12); g.add(sh);
    const bx = { group: g, body, slab, card, tissue, slit, blade, shadow: sh, yaw: 0, hotT: 0, ke: 0, kl: 0, arrived: false, opening: false,
      set(ke, kl) { bx.ke = ke; bx.kl = kl; ends.forEach(e => { e.hg.rotation.x = e.s * 2.0 * ke; }); longs.forEach(l => { l.hg.rotation.z = -l.s * 2.3 * kl; }); },
      /* the tissue parts: each sheet folds up and out while it crinkles */
      tissueTo(tk, t) { tissue.forEach(ts => { ts.hg.rotation.z = -ts.sx * 1.9 * tk; const p = ts.geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = ts.base[i * 3], y = ts.base[i * 3 + 1]; p.setZ(i, 0.025 * Math.sin(x * 9 + y * 3) + 0.02 * Math.sin(y * 7 + t * 2.5 + x * 4) * (0.3 + tk)); } p.needsUpdate = true; ts.geo.computeVertexNormals(); }); } };
    bx.tissueTo(0, 0); bx.set(0, 0);
    return bx;
  }
  function disposeBox(bx) {
    const i = boxes.indexOf(bx); if (i >= 0) boxes.splice(i, 1); if (hot === bx) hot = null;
    const mats = new Set(); bx.group.traverse(m => { if (!m.isMesh) return; m.geometry.dispose(); if (m !== bx.shadow) [].concat(m.material).forEach(mt => mats.add(mt)); });
    mats.forEach(mt => { if (mt.map) mt.map.dispose(); mt.dispose(); }); if (bx.group.parent) bx.group.parent.remove(bx.group);
  }
  /* a patch of table for a box: the table's own free spot, clear of the other boxes too */
  function spot() { let sp = S.table.freeSpot(); for (let k = 0; k < 8 && boxes.some(b => Math.hypot(b.group.position.x - sp.x, b.group.position.z - sp.z) < 3); k++) sp = S.table.freeSpot(); return sp; }
  /* the courier drops it at the near edge and it slides onto the table with a little bounce */
  async function arrive(bx, sp, i) {
    const g = bx.group, yaw = (Math.random() - 0.5) * 0.5; bx.yaw = yaw; g.rotation.y = yaw + 0.3; g.position.set(sp.x, 0, ctx.H_T / 2 + 2.6); ctx.scene.add(g);
    if (i) await T.wait(0.4 * i, 'parcel'); if (!boxes.includes(bx)) return;
    snd('cardboard'); const from = g.position.clone(), to = new THREE.Vector3(sp.x, 0, sp.z);
    await T.tween({ dur: 1.3, ease: E.outCubic, tag: 'parcel', update: (e, r) => { g.position.lerpVectors(from, to, e); g.rotation.y = yaw + 0.3 * (1 - e); bx.body.position.y = 0.05 * Math.sin(r * Math.PI); } });
    g.position.copy(to); g.rotation.y = yaw; S.sfx('ltPutDown');
    await T.tween({ dur: 0.32, ease: E.linear, tag: 'parcel', update: e => { bx.body.position.y = 0.045 * Math.sin(e * Math.PI); } });
    bx.body.position.y = 0; bx.arrived = true;
  }

  /* ---------- boxes come and go with the store ---------- */
  function check() {
    const pulls = store.get().pulls, now = Date.now();
    /* a box whose pull is gone (reset) or no longer waiting to be opened goes too */
    boxes.slice().forEach(bx => { if (bx.opening) return; if (!pulls.includes(bx.slab) || SL.gradingState(bx.slab, now) !== 'back') disposeBox(bx); });
    if (!S.unlocked() || !M.is('idle')) return;
    const due = pulls.filter(p => SL.gradingState(p, now) === 'back' && !boxes.some(b => b.slab === p));
    due.forEach((p, i) => { const bx = makeBox(p); boxes.push(bx); arrive(bx, spot(), i); });
    if (due.length) S.toast(due.length > 1 ? due.length + ' parcels for you, on the table.' : 'A parcel for you, on the table.');
  }
  function setHot(bx) { if (hot === bx) return; hot = bx; }
  function pointer(kind, e) {
    const list = boxes.filter(b => b.arrived && !b.opening); if (!list.length || ctx.cam.view === 'wall') { setHot(null); return false; }
    const find = () => { const h = S.hitAny(e, list.map(b => b.body)); return h ? list.find(b => b.body === h.root) || null : null; };
    if (kind === 'move') { const bx = find(); setHot(bx); if (bx) { ctx.canvas.style.cursor = 'pointer'; ctx.hideActs(); return true; } return false; }
    if (kind === 'down') { if (e.button !== 0) return false; const bx = find(); if (!bx) return false; if (M.is('idle')) { setHot(null); S.sfx('detent'); M.go('parcel.open', { box: bx }); } return true; }
    return false;
  }
  function frame(dt) {
    if (!S.unlocked()) { if (boxes.length) boxes.slice().forEach(bx => { if (!bx.opening) disposeBox(bx); }); return; }
    poll += dt; if (poll > 1) { poll = 0; check(); }
    const k = 1 - Math.exp(-dt * 10);
    boxes.forEach(bx => { bx.hotT += ((hot === bx ? 1 : 0) - bx.hotT) * k; bx.card.emissiveIntensity = 0.1 * bx.hotT; if (bx.arrived && !bx.opening) bx.body.position.y = 0.035 * bx.hotT; });
  }

  /* ---------- the count up: a small plane over the label's grade, so the number can tick up from 1 ---------- */
  function overlay(obj) {
    const label = obj.parts.label, slab = obj.slab, land = obj.land; if (!label) return { draw() {}, remove() {} };
    const CW = land ? S.SM.LABEL_H : S.SM.LABEL_W, CH = land ? S.SM.LABEL_W : S.SM.LABEL_H;
    const r = land ? { x0: 40, y0: 960, x1: 360, y1: 1256 } : { x0: 1058, y0: 56, x1: 1304, y1: 338 };
    const pw = label.geometry.parameters.width, ph = label.geometry.parameters.height, cw = r.x1 - r.x0, ch = r.y1 - r.y0;
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d'), tex = S.SM.tex(c);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cw / CW * pw, ch / CH * ph), new THREE.MeshBasicMaterial({ map: tex }));
    mesh.position.set(label.position.x + ((r.x0 + r.x1) / 2 / CW - 0.5) * pw, label.position.y + (0.5 - (r.y0 + r.y1) / 2 / CH) * ph, label.position.z + 0.006); mesh.userData.order = 7; obj.inner.add(mesh);
    /* the same ground the label drew (slabmesh.js labelGround), just this patch of it; the sparkle is seeded so it holds still */
    const style = slab.label || (slab.tier === 'legendary' ? 'gold' : 'black'), tc = (SL.TIER[slab.tier] || SL.TIER.common).color, ink = style === 'gold' ? '#111111' : style === 'tier' ? tc : '#e8c67a';
    function ground() { g.save(); g.translate(-r.x0, -r.y0);
      if (style === 'gold') { const gr = g.createLinearGradient(0, 0, CW, CH); gr.addColorStop(0, '#9a7024'); gr.addColorStop(0.35, '#f1cf7c'); gr.addColorStop(0.6, '#c08f2c'); gr.addColorStop(1, '#f6dd98'); g.fillStyle = gr; } else g.fillStyle = '#0d0d10';
      g.fillRect(0, 0, CW, CH); g.restore();
      const rr = T.rng((slab.seed || 7) + 3), A = cw * ch / (CW * CH), gold = style === 'gold';
      for (let i = 0, n = Math.round(9000 * A); i < n; i++) { g.fillStyle = gold ? 'rgba(255,255,255,' + (rr() * 0.35) + ')' : 'rgba(255,220,150,' + (rr() * 0.22) + ')'; g.fillRect(rr() * cw, rr() * ch, 1.4, 1.4); }
      for (let i = 0, n = Math.round(4000 * A); i < n; i++) { g.fillStyle = 'rgba(0,0,0,' + (rr() * 0.25) + ')'; g.fillRect(rr() * cw, rr() * ch, 1.2, 1.2); } }
    /* text scaled about its own centre, so a tick grows from where the number sits */
    function put(s, font, ax, ay, align, k) { g.save(); g.font = font; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; const tw = g.measureText(s).width, fs = parseFloat(font.match(/(\d+)px/)[1]);
      const left = align === 'right' ? ax - tw : align === 'center' ? ax - tw / 2 : ax; g.translate(left + tw / 2, ay - fs * 0.35); g.scale(k, k); g.fillText(s, -tw / 2, fs * 0.35); g.restore(); }
    return {
      draw(n, gs, word, ws) { ground(); g.fillStyle = ink;
        if (n != null) { if (land) put(String(n), '400 230px "Fraunces", Georgia, serif', 200 - r.x0, 1168 - r.y0, 'center', gs || 1); else put(String(n), '400 210px "Fraunces", Georgia, serif', 1284 - r.x0, 248 - r.y0, 'right', gs || 1); }
        if (word && n != null) { const w = SL.GRADES[n] || ''; if (land) put(w, '600 32px "Geist Mono", ui-monospace, monospace', 200 - r.x0, 1236 - r.y0, 'center', ws || 1); else put(w, '600 34px "Geist Mono", ui-monospace, monospace', 1282 - r.x0, 320 - r.y0, 'right', ws || 1); }
        tex.needsUpdate = true; },
      remove() { obj.inner.remove(mesh); mesh.geometry.dispose(); tex.dispose(); mesh.material.dispose(); },
    };
  }
  const REMARK = { 10: 'A perfect one.', 9: 'Nice.', 8: 'Very tidy.', 7: 'Good going.', 6: 'Solid.', 5: 'Fair enough.', 4: 'It happens.', 3: 'Still yours.', 2: 'Keep it anyway.', 1: 'Better luck with the next one.' };
  function gradeLine(slab) { const g = slab.grade, w = SL.GRADES[g] || '', word = /-/.test(w) ? w : w.toLowerCase().replace(/(^|\s)\S/g, ch => ch.toUpperCase()); return 'Grade ' + g + ', ' + word + '. ' + (REMARK[g] || ''); }

  /* ---------- the unboxing ---------- */
  M.define('parcel.open', { busy: true,
    /* CLOSE does not leave the box half open: the rest of the sequence runs fast and the slab still lands */
    on: { CLOSE: () => { rush = true; T.cancelAll(TAG); return undefined; } },
    pointer() { return true; },
    async enter(d, run) {
      const bx = d && d.box; if (!bx || !boxes.includes(bx) || bx.opening) { M.go('idle'); return; }
      const dur = s => rush || !run.alive() ? Math.min(s, 0.1) : s;
      rush = false; bx.opening = true; setHot(null); bx.body.position.y = 0; bx.card.emissiveIntensity = 0; ctx.hideActs(); ctx.canvas.style.cursor = 'default';
      const slab = bx.slab, g = bx.group, x = g.position.x, z = g.position.z, yaw = bx.yaw, PITCH = 52;
      /* the grade is committed the moment the box is opened; the slab builds (photo and label) while the tape is cut */
      SL.receiveGraded(slab); const obj = S.objFor(slab); obj.group.visible = false; ctx.scene.add(obj.group);
      const K = S.TABLE_K || DEF_K, yLand = (obj.th || S.SM.SLAB.th) / 2 + 0.004, landQ = flatQ().premultiply(yawQ(yaw));
      phase = 'cam'; S.cam.push(); S.cam.set({ pitch: PITCH }); S.cam.set({ tx: x, ty: 0.35, tz: z + 0.2, dT: S.cam.fit(6.2, 5.0) }); S.sfx('ltInspect');
      await T.wait(dur(0.6), TAG);
      /* the tape: a blade drops onto the far end of the seam and runs to the near end, the slit opening behind it */
      phase = 'cut'; snd('tape'); bx.blade.visible = true; bx.slit.visible = true;
      await T.tween({ dur: dur(1.1), ease: E.linear, tag: TAG, update: (e, u) => { const cut = T.sub(u, 0.15, 0.85), lift = u < 0.15 ? (0.15 - u) / 0.15 * 0.5 : u > 0.85 ? (u - 0.85) / 0.15 * 0.6 : 0;
        bx.blade.position.set(0, H + T0 + lift, -D / 2 - 0.1 + (D + 0.2) * cut); bx.slit.scale.z = Math.max(0.001, D * cut); bx.slit.position.z = -D / 2 + bx.slit.scale.z / 2; } });
      bx.blade.visible = false; bx.slit.scale.z = D; bx.slit.position.z = 0;
      /* the flaps: the taped pair first, then the ends they were covering */
      phase = 'flaps'; snd('cardboard');
      await T.par(T.tween({ dur: dur(0.9), ease: E.inOutCubic, tag: TAG, update: e => bx.set(bx.ke, e) }), T.tween({ dur: dur(0.7), delay: rush ? 0 : 0.4, ease: E.inOutCubic, tag: TAG, update: e => bx.set(e, bx.kl) }));
      bx.set(1, 1);
      /* the slab lies in the box under the tissue, its long side along the box; the tissue parts */
      await obj.ready.catch(() => null);
      const inQ = flatQ(); if (obj.land) inQ.premultiply(yawQ(-Math.PI / 2)); inQ.premultiply(yawQ(yaw));
      obj.group.scale.setScalar(IN_K); obj.group.quaternion.copy(inQ); obj.group.position.set(x, T0 + (obj.th || S.SM.SLAB.th) * IN_K / 2 + 0.01, z); obj.group.visible = true;
      phase = 'tissue'; snd('tissue');
      await T.tween({ dur: dur(0.8), ease: E.inOutSine, tag: TAG, update: e => bx.tissueTo(e, T.time()) });
      bx.tissueTo(1, T.time());
      /* the slab rises to meet you: up, forward and turning to face the camera, growing to its table size */
      phase = 'rise'; snd('rise');
      const upQ = new THREE.Quaternion().setFromAxisAngle(X, -PITCH * Math.PI / 180), p0 = obj.group.position.clone(), p1 = new THREE.Vector3(x, 1.45, z + 0.8);
      await T.tween({ dur: dur(1.1), ease: E.outCubic, tag: TAG, update: e => { obj.group.position.lerpVectors(p0, p1, e); obj.group.quaternion.slerpQuaternions(inQ, upQ, e); obj.group.scale.setScalar(IN_K + (K - IN_K) * e); } });
      obj.group.position.copy(p1); obj.group.quaternion.copy(upQ); obj.group.scale.setScalar(K);
      /* the empty box goes while you look at it */
      const mode = S.dev.opt('dissolve'); boxes.splice(boxes.indexOf(bx), 1); P.dissolve(g, { mode, spread: 1.6, dur: rush ? 0.5 : 1.3 }).then(() => disposeBox(bx), () => disposeBox(bx));
      await T.wait(dur(0.8), TAG);
      /* it lands flat where the box was */
      phase = 'land'; snd('land');
      await T.tween({ dur: dur(0.55), ease: E.inQuad, tag: TAG, update: e => { obj.group.position.lerpVectors(p1, new THREE.Vector3(x, yLand, z), e); obj.group.quaternion.slerpQuaternions(upQ, landQ, e); } });
      obj.group.position.set(x, yLand, z); obj.group.quaternion.copy(landQ); S.sfx('ltPutDown');
      await T.tween({ dur: dur(0.3), ease: E.linear, tag: TAG, update: e => { obj.group.position.y = yLand + 0.08 * Math.sin(e * Math.PI); } });
      obj.group.position.y = yLand;
      /* the count up: 1, 2, 3 ... up to the grade, the last tick the loudest, then the word */
      phase = 'count'; const n = slab.grade, ov = overlay(obj); ov.draw(null);
      await T.wait(dur(0.8), TAG);
      for (let i = 1; i <= n; i++) {
        if (rush || !run.alive()) { ov.draw(n, 1, true, 1); snd('countFinal', { i: n, n }); break; }
        const last = i === n; snd(last ? 'countFinal' : 'countTick', { i, n });
        if (last) { const k1 = n >= 10 ? 1.2 : 1.35; await T.par(T.tween({ dur: 0.5, ease: E.outCubic, tag: TAG, update: e => ov.draw(i, 1 + (k1 - 1) * (1 - e), false, 1) }), T.tween({ dur: 0.3, ease: E.linear, tag: TAG, update: e => { obj.group.position.y = yLand + 0.05 * Math.sin(e * Math.PI); } })); obj.group.position.y = yLand;
          await T.wait(dur(0.45), TAG); snd('pop'); await T.tween({ dur: dur(0.3), ease: E.outCubic, tag: TAG, update: e => ov.draw(n, 1, true, 1 + 0.35 * (1 - e)) }); }
        else await T.tween({ dur: STEP, ease: E.linear, tag: TAG, update: (e, u) => ov.draw(i, 1 + 0.3 * Math.max(0, 1 - u * STEP / 0.18), false, 1) });
      }
      ov.draw(n, 1, true, 1); S.toast(gradeLine(slab));
      await T.wait(dur(0.5), TAG); ov.remove();
      /* a normal table slab from here: inspect, vault, the lot */
      phase = 'done'; S.table.adopt(obj, x, z, yaw); S.hud(); if (!S.unlocked()) S.table.remove(obj, true);
      S.cam.pop(); if (run.alive()) M.go('idle');
    },
    exit() { phase = 'idle'; rush = false; },
  });

  S.parcel = { check, pointer, frame, __boxes: () => boxes.slice(), __phase: () => phase };
}
