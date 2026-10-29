// The secret collector layer: hidden under the light table until someone presses = and types "secret".
// installSecret(ctx) is the only thing main.js calls; everything the sequences need from the table comes in ctx and
// goes out through S, the shared object every module gets (vault.js, binder.js, holo.js, loot.js, arm.js). Nobody
// but this file touches main.js. States live in one machine (sm.js): 'locked', 'idle', 'room.*', 'vault.*', 'loot.*'.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createMachine } from './sm.js';
import * as T from './tween.js';
import * as P from './particles.js';
import * as SL from './slabs.js';
import * as SM from './slabmesh.js';
import { createInspect, INSPECT_CSS } from './inspect.js';
import { createDev, DEV_CSS } from './devpanel.js';
import * as vault from './vault.js';
import * as binder from './binder.js';
import * as holo from './holo.js';
import * as loot from './loot.js';
import * as arm from './arm.js';
import * as print from './print.js';
import * as rail from './rail.js';
import * as parcel from './parcel.js';
import * as sound from './sound.js';
import * as under from './under.js';

const stdM = (c, r, m, o) => new THREE.MeshStandardMaterial({ color: c, roughness: r ?? 0.5, metalness: m ?? 0, ...(o || {}) });
const BRASS = () => stdM(0xb8903e, 0.32, 0.75);

export function installSecret(ctx) {
  const M = createMachine(), store = SL.store;
  /* what the table owns before the secret layer adds anything: the flip hides exactly this set (the pivot takes the body and surface) */
  const lightSide = new Set(ctx.scene.children);
  P.initParticles(ctx.scene);
  const S = {
    THREE, ctx, M, T, P, SL, SM, store, RoundedBoxGeometry, isLightSide: o => lightSide.has(o), scene: ctx.scene, camera: ctx.camera, renderer: ctx.renderer, paintPhoto: ctx.paintPhoto, KINDS: ctx.KINDS,
    el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; },
    css(text) { const s = document.createElement('style'); s.textContent = text; document.head.appendChild(s); return s; },
    sfx(id, o) { try { return ctx.SFX(id, o); } catch (e) { return null; } },
    toast(t, label, fn) { ctx.toast(t, label, fn); },
    hit(e, obj) { if (!obj || obj.visible === false) return null; ctx.setNDC(e); ctx.ray.setFromCamera(ctx.ndc, ctx.camera); return ctx.ray.intersectObject(obj, true)[0] || null; },
    /* the nearest of several objects, or null */
    hitAny(e, list) { ctx.setNDC(e); ctx.ray.setFromCamera(ctx.ndc, ctx.camera); let best = null; list.forEach(o => { if (!o || o.visible === false) return; const h = ctx.ray.intersectObject(o, true)[0]; if (h && (!best || h.distance < best.distance)) best = { ...h, root: o }; }); return best; },
    tableHit(e, y) { ctx.setNDC(e); return ctx.planeHit(ctx.camera, ctx.ndc, y || 0); },
    testFinish() { return dev.opt('finish'); },
    packs() { try { if (ctx.HOST && ctx.HOST.packs) { const p = ctx.HOST.packs(); if (p && p.length) return p; } } catch (e) {} try { const c = JSON.parse(localStorage.getItem('studium_rs') || 'null'); if (c && c.length) return c; } catch (e) {} return []; },
    unlocked() { return !!store.get().unlocked; },
    points() { return store.get().points; },
    addPoints(n) { store.get().points += n; store.save(); hud(); },
    lockStand(on) { ctx.STAND.lock = !!on; },
    /* a soft round shadow under a prop, like the table's own blobShadow */
    shadow(w, d) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: SHADOW_TEX(), transparent: true, depthWrite: false, opacity: 0.55 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.004; m.userData.noParticles = true; return m; },
  };
  SL.setPhotoSource(S.packs);
  let shadowTex = null; const SHADOW_TEX = () => { if (shadowTex) return shadowTex; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); shadowTex = new THREE.CanvasTexture(c); return shadowTex; };

  /* ---------- camera: push a framing for a sequence, pop it after ---------- */
  const camStack = [];
  S.cam = {
    push(t) { const c = ctx.cam; camStack.push({ tx: c.tx, ty: c.ty, tz: c.tz, dT: c.dT, pitch: c.pitch, view: c.view }); if (c.view !== 'table') ctx.focus('table'); if (t) Object.assign(c, t); },
    set(t) { Object.assign(ctx.cam, t); },
    pop() { const s = camStack.pop(); if (!s) return; if (s.view === 'wall' && ctx.cam.view !== 'wall') { ctx.focus('wall'); return; } Object.assign(ctx.cam, { tx: s.tx, ty: s.ty, tz: s.tz, dT: s.dT, pitch: s.pitch }); },
    /* how far back the camera sits to frame a w × d patch of table at the current pitch */
    fit(w, d) { return ctx.fitDist(w, d, ctx.cam.pitch); },
  };

  /* ---------- the hole in the table surface (uniforms shared by the surface and the body) ---------- */
  S.hole = { rect: null,
    open(x0, z0, x1, z1) { S.hole.rect = [x0, z0, x1, z1]; ctx.HOLE.uHole.value.set(x0, z0, x1, z1); ctx.HOLE.uHoleOn.value = 1; },
    close() { S.hole.rect = null; ctx.HOLE.uHoleOn.value = 0; },
  };

  /* ---------- clearing prints out of a patch of table: 'sweep' pushes them aside, 'lift' floats them up and over ---------- */
  S.clearPrints = async function (rect, style) {
    const [x0, z0, x1, z1] = rect, W = ctx.W_T / 2 - 0.8, H = ctx.H_T / 2 - 0.8, pad = 0.9;
    const L = ctx.prints.filter(p => !p.onBoard && !p.wg && !p.rejected && !p.locked && p !== ctx.drag.p && p.tx + p.w / 2 > x0 && p.tx - p.w / 2 < x1 && p.tz + p.h / 2 > z0 && p.tz - p.h / 2 < z1);
    if (!L.length) return;
    S.sfx('lift');
    const dest = p => { const dl = p.tx - x0, dr = x1 - p.tx, du = p.tz - z0, dd = z1 - p.tz, m = Math.min(dl, dr, du, dd), r = Math.random();
      let tx = p.tx, tz = p.tz; if (m === dl) tx = x0 - pad - p.w / 2 - r * 1.5; else if (m === dr) tx = x1 + pad + p.w / 2 + r * 1.5; else if (m === du) tz = z0 - pad - p.h / 2 - r; else tz = z1 + pad + p.h / 2 + r;
      return { tx: T.clamp(tx, -W, W), tz: T.clamp(tz, -H, H), yawT: p.yawT + (Math.random() - 0.5) * 0.7 }; };
    if (style === 'lift') { L.forEach((p, i) => { p.base = 0.9 + i * 0.06; }); await T.wait(0.42); }
    await T.par(L.map((p, i) => { const d = dest(p); return T.to(p, d, { dur: style === 'lift' ? 0.8 : 0.55, ease: style === 'lift' ? T.E.inOutSine : T.E.outCubic, delay: i * 0.04 }); }));
    if (style === 'lift') await T.wait(0.2);
    ctx.restack(); ctx.saveAll();
  };

  /* ---------- the unlock box ---------- */
  const box = S.el('div', 'sk-box', '<input id="skIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Secret word" maxlength="24">'); box.id = 'sk'; document.body.appendChild(box);
  const input = box.querySelector('input'); let boxT = 0, hideT = 0; box.hidden = true;
  function showBox() { clearTimeout(boxT); clearTimeout(hideT); box.hidden = false; void box.offsetWidth; box.classList.add('on'); input.value = ''; setTimeout(() => input.focus(), 30); }
  /* hidden for real (display none) once it has faded, so it is never in the Tab order while the table is in use */
  function hideBox() { box.classList.remove('on'); input.blur(); clearTimeout(hideT); hideT = setTimeout(() => { box.hidden = true; }, 480); }
  input.addEventListener('keydown', e => { e.stopPropagation();
    if (e.key === 'Escape') { hideBox(); return; }
    if (e.key !== 'Enter') return; const v = input.value.trim().toLowerCase();
    if (v === 'secret') { hideBox(); S.unlocked() ? lock() : unlock(); }
    else if (v === 'dev' && S.unlocked()) { hideBox(); dev.toggle(true); }
    else if (v === 'reset' && S.unlocked()) { hideBox(); resetAll(); }
    else { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); input.value = ''; } });
  input.addEventListener('blur', () => { boxT = setTimeout(hideBox, 120); });
  box.addEventListener('pointerdown', e => e.stopPropagation());

  /* ---------- points, kept small in the corner ---------- */
  const pts = S.el('div', 'sk-pts', ''); pts.id = 'skPts'; document.body.appendChild(pts);
  const skipBtn = S.el('button', 'sk-skip', 'Skip the wait'); skipBtn.id = 'skSkip'; skipBtn.type = 'button'; skipBtn.hidden = true; document.body.appendChild(skipBtn);
  skipBtn.addEventListener('pointerdown', e => e.stopPropagation());
  skipBtn.addEventListener('click', () => { let n = 0; store.get().pulls.forEach(p => { if (p.sentAt && !p.graded && Date.now() < p.readyAt) { SL.skipGrading(p); n++; } }); S.toast(n ? 'The lab worked through the night. ' + n + ' parcel' + (n === 1 ? '' : 's') + ' on the way.' : 'Nothing is away for grading.'); hud(); if (S.parcel) S.parcel.check(); });
  function hud() { const d = store.get(), away = d.pulls.filter(p => SL.gradingState(p) === 'away').length;
    pts.textContent = d.points.toLocaleString('en-NZ') + ' PTS  ·  KEYS ∞  ·  ' + d.pulls.length + ' PULL' + (d.pulls.length === 1 ? '' : 'S') + (away ? '  ·  ' + away + ' AWAY' : ''); pts.classList.toggle('on', !!d.unlocked);
    skipBtn.hidden = !(d.unlocked && away); dev.refresh(); }
  /* the HUD keeps up with the clock so AWAY turns into a parcel without a click */
  setInterval(() => { if (S.unlocked()) hud(); }, 5000);
  S.hud = hud;
  /* a small bar while the vault or binder is open: the way back to the case, and out */
  const nav = S.el('div', 'sk-nav', ''); nav.id = 'skNav'; document.body.appendChild(nav); nav.addEventListener('pointerdown', e => e.stopPropagation());
  nav.addEventListener('click', e => { const b = e.target.closest('[data-ev]'); if (b) M.send(b.dataset.ev); });
  const NAV = { 'vault.case': [['CLOSE', 'Close the vault']], 'vault.keypad': [['CLOSE', 'Close the vault']], 'vault.lid': [['CLOSE', 'Close the vault']], 'vault.binder': [['CASE', 'Back to the case'], ['CLOSE', 'Close']], 'binder.open': [['CLOSE', 'Close the binder']] };
  M.onChange(st => { const b = NAV[st]; nav.innerHTML = b ? b.map(x => '<button type="button" data-ev="' + x[0] + '">' + x[1] + '</button>').join('') : ''; nav.classList.toggle('on', !!b); });

  /* ---------- the three diegetic buttons ---------- */
  function pushButton(color) { const g = new THREE.Group(); const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.07, 28), BRASS()); bezel.position.y = 0.035;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.145, 0.09, 28), stdM(color, 0.35, 0.1, { emissive: color, emissiveIntensity: 0.18 })); cap.position.y = 0.1; g.add(bezel, cap); g.userData.cap = cap; g.userData.base = 0.18; return g; }
  S.pushButton = pushButton;
  const btnLoot = pushButton(0xe4552e); btnLoot.name = 'loot';
  const btnVault = new THREE.Group(); btnVault.name = 'vault';
  { const dark = stdM(0x26231f, 0.6), body = new THREE.Mesh(new RoundedBoxGeometry(0.74, 0.3, 0.52, 3, 0.05), dark); body.position.y = 0.15; btnVault.add(body);
    const lid = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.14, 0.54, 3, 0.05), stdM(0x2f2b26, 0.55)); lid.position.y = 0.36; btnVault.add(lid);
    const latch = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.1, 0.05, 2, 0.015), BRASS()); latch.position.set(0, 0.29, 0.28); btnVault.add(latch);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 20, Math.PI), BRASS()); handle.position.set(0, 0.43, 0); handle.rotation.y = Math.PI / 2; btnVault.add(handle);
    [-1, 1].forEach(s => { const c = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.12, 0.08, 2, 0.01), BRASS()); c.position.set(s * 0.3, 0.3, 0.25); btnVault.add(c); });
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), stdM(0x3fcf7a, 0.4, 0, { emissive: 0x3fcf7a, emissiveIntensity: 0.6 })); dot.rotation.x = Math.PI / 2; dot.position.set(0.22, 0.17, 0.27); btnVault.add(dot); btnVault.userData.cap = dot;
    btnVault.add(S.shadow(1.3, 1.1)); btnVault.userData.base = 0.5; }
  btnVault.position.set(ctx.BINDER.x - ctx.BINDER.w / 2 - 0.95, 0, ctx.BINDER.z + 0.5); btnVault.rotation.y = -0.22;
  const btnKey = new THREE.Group(); btnKey.name = 'key';
  { const c = document.createElement('canvas'); c.width = 128; c.height = 176; const g = c.getContext('2d'); g.fillStyle = '#b8903e'; g.beginPath(); g.roundRect(6, 6, 116, 164, 22); g.fill();
    const gr = g.createLinearGradient(0, 0, 128, 176); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fill();
    g.fillStyle = '#0a0908'; g.beginPath(); g.arc(64, 70, 20, 0, 7); g.fill(); g.beginPath(); g.moveTo(52, 84); g.lineTo(76, 84); g.lineTo(84, 140); g.lineTo(44, 140); g.closePath(); g.fill();
    g.fillStyle = '#5a4316'; [[26, 24], [102, 24], [26, 152], [102, 152]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.42, 0.04, 2, 0.02), BRASS()); btnKey.add(plate);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), new THREE.MeshBasicMaterial({ map: SM.tex(c), transparent: true })); face.position.z = 0.021; btnKey.add(face); btnKey.userData.cap = null; }
  btnKey.position.set(ctx.PAD_W.x + 1.1, ctx.PAD_W.y - 0.12, ctx.WALL_Z + 0.03);
  const buttons = [btnLoot, btnVault, btnKey]; buttons.forEach(b => { b.visible = false; b.userData.hot = 0; });
  ctx.kit.add(btnLoot); ctx.scene.add(btnVault); ctx.scene.add(btnKey);
  S.buttons = { loot: btnLoot, vault: btnVault, key: btnKey };
  let lootOnClamp = false;
  /* the loot button lives on the clamp only: with the stand folded, clicking the kit box opens the stand as it always did (Sam) */
  const underOn = () => !!(S.under && S.under.on);
  function placeLoot() { const up = ctx.STAND.up && !ctx.STAND.dir; btnLoot.visible = false; btnVault.visible = underOn(); if (up === lootOnClamp && btnLoot.parent) return; lootOnClamp = up;
    ctx.clampG.add(btnLoot); btnLoot.position.set(-0.52, 0.16, 0.27); btnLoot.rotation.set(0, 0, 0); }
  placeLoot();

  /* ---------- slabs on the table ---------- */
  const slabObjs = new Set();
  S.slabs = { all: () => [...slabObjs],
    make(slab) { const o = SM.makeSlab(slab, S); slabObjs.add(o); return o; },
    /* a print object that lives outside the table (the rail's) still gets its per-frame update */
    adopt(o) { slabObjs.add(o); return o; },
    drop(o) { slabObjs.delete(o); o.dispose(); },
    refreshFinish() { const t = dev.opt('finish'); slabObjs.forEach(o => { if (o.built) o.setFinish(SL.finishOf(o.slab, t)); }); } };
  /* graded pulls are slabs; raw ones are prints (print.js), falling back to a slab until that file is built */
  S.objFor = function (slab) { if (!slab.graded && S.print && S.print.make) { const o = S.print.make(slab); if (o) { slabObjs.add(o); return o; } } return S.slabs.make(slab); };
  const tableSlabs = [];
  /* objects are built at slab scale; on the table they show card sized beside the prints (Sam: full size was massive) */
  S.TABLE_K = 0.42;
  const flatQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  S.table = { list: tableSlabs,
    /* place(slab, x, z, yaw, { drop:true }) → the slab object; drop lets it fall onto the table */
    place(slab, x, z, yaw, o = {}) { return S.table.adopt(S.objFor(slab), x, z, yaw, o); },
    /* an object made elsewhere (the rail's print) becomes a table object at x, z */
    adopt(obj, x, z, yaw, o = {}) { const slab = obj.slab, g = obj.group, K = S.TABLE_K, y = (obj.th || SM.SLAB.th) * K / 2 + 0.004; if (g.parent !== ctx.scene) ctx.scene.attach(g); g.scale.setScalar(K); g.position.set(x, y, z); g.quaternion.copy(flatQ).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw || 0));
      obj.yaw = yaw || 0; g.userData.secret = true; g.visible = underOn(); const sh = S.shadow(3.6 * K, 4.4 * K); sh.userData.secret = true; sh.visible = underOn(); sh.position.set(x + 0.05, 0.0035, z + 0.07); sh.rotation.z = -(yaw || 0); ctx.scene.add(sh); obj.tableShadow = sh; ctx.scene.add(g); obj.where = 'table'; if (!tableSlabs.includes(obj)) tableSlabs.push(obj);
      if (!o.quiet) store.toTable(slab.id, x, z, yaw);
      if (o.drop) { g.position.y = 1.2; sh.material.opacity = 0.1; T.to(g.position, new THREE.Vector3(x, y, z), { dur: 0.55, ease: T.E.outBounce }); T.to(sh.material, { opacity: 0.55 }, { dur: 0.5 }); setTimeout(() => S.sfx('ltPutDown'), 420); }
      return obj; },
    remove(obj, keepStore) { const i = tableSlabs.indexOf(obj); if (i >= 0) tableSlabs.splice(i, 1); if (obj.tableShadow) ctx.scene.remove(obj.tableShadow); if (!keepStore) store.detach(obj.slab.id); S.slabs.drop(obj); },
    /* a free patch of table for a new slab, left of the board and clear of the other slabs */
    freeSpot() { const cx = -4, cz = 1.5; for (let k = 0; k < 40; k++) { const x = cx + (Math.random() - 0.5) * 12, z = cz + (Math.random() - 0.5) * 9; if (!tableSlabs.some(o => Math.hypot(o.group.position.x - x, o.group.position.z - z) < 3.4)) return { x, z }; } return { x: cx, z: cz }; },
    restore() { store.get().table.forEach(t => { const slab = store.pull(t.id); if (slab) S.table.place(slab, t.x, t.z, t.yaw, { quiet: true }); }); },
  };
  /* a pull straight onto the table (the dev panel's Roll; loot.js lays its slab down the long way) */
  S.rollToTable = function (o) { const slab = SL.roll({ graded: true, ...(o || {}) }); store.addPull(slab); const sp = S.table.freeSpot(); const obj = S.table.place(slab, sp.x, sp.z, (Math.random() - 0.5) * 0.5, { drop: true }); hud();
    const t = SL.tierOf(slab); S.toast(t.name + (slab.graded ? ' · grade ' + slab.grade : ' · raw') + (slab.variant ? ' · ' + SL.VARIANT[slab.variant].name : '') + ' · ' + slab.title); return obj; };
  /* a raw print goes away for grading: it dissolves off the near edge of the table and comes back as a parcel (parcel.js) */
  S.sendForGrading = async function (obj) {
    const slab = obj.slab; if (slab.graded || slab.sentAt) return; SL.sendForGrading(slab, S.gradingWait()); S.sfx('binder');
    const g = obj.group, target = new THREE.Vector3(g.position.x, 0.6, ctx.H_T / 2 + 2.5); await T.to(g.position, new THREE.Vector3(g.position.x, 1.2, g.position.z + 0.6), { dur: 0.4, ease: T.E.outCubic });
    P.dissolve(g, { mode: dev.opt('dissolve'), centre: target, spread: 2.4, dur: 1.2 }); S.table.remove(obj); hud(); if (S.parcel) S.parcel.check();
    const ms = S.gradingWait(); S.toast(ms >= 3600000 ? 'Away for grading. It comes back as a parcel in a day, real time.' : ms ? 'Away for grading. Back in a minute, as a parcel.' : 'Away for grading. The parcel is already on its way.');
  };
  /* gone for good: it dissolves where it lies and leaves the collection */
  function binSlab(obj) { S.sfx('shred'); P.dissolve(obj.group, { mode: dev.opt('dissolve'), dur: 1.0, spread: 1.2 }); const id = obj.slab.id; S.table.remove(obj, true); store.discard(id); hud(); S.toast('Gone. The points it earned stay with you.'); }
  async function inspectTableSlab(obj) {
    const raw = !obj.slab.graded, g = obj.group, K = S.TABLE_K;
    T.to(g.scale, { x: 1, y: 1, z: 1 }, { dur: 0.5, ease: T.E.outCubic, tag: 'tslab' });
    const r = await inspect.open(obj, { actions: raw ? [{ id: 'bin', label: 'Bin it' }, { id: 'back', label: 'Put back' }, { id: 'grade', label: 'Send for grading', primary: true }] : [{ id: 'bin', label: 'Bin it' }, { id: 'back', label: 'Put back' }, { id: 'binder', label: 'Into the binder' }, { id: 'vault', label: 'Into the vault', primary: true }], hint: 'Drag to turn it, scroll to zoom. Click the room to put it back. Back on the table, drag it anywhere.' });
    T.to(g.scale, { x: K, y: K, z: K }, { dur: 0.45, ease: T.E.inOutSine, tag: 'tslab' });
    if (r === 'bin') { await T.wait(0.45); binSlab(obj); return; }
    if (r === 'grade') { await T.wait(0.45); S.sendForGrading(obj); }
    if (r === 'binder') { await T.wait(0.3); S.sfx('binder'); const target = btnVault.getWorldPosition(new THREE.Vector3()); target.y += 0.3; P.dissolve(obj.group, { mode: dev.opt('dissolve'), centre: target, spread: 2.2, dur: 1.3 }); S.table.remove(obj, true); store.toBinder(obj.slab.id); hud(); S.toast('Filed in the Rare binder. Open the vault and press the button on the case front to see it.'); }
    if (r === 'vault') { await T.wait(0.3); S.sfx('detent'); const target = btnVault.getWorldPosition(new THREE.Vector3()); target.y += 0.3;
      P.dissolve(obj.group, { mode: dev.opt('dissolve'), centre: target, spread: 2.2, dur: 1.3 }); S.table.remove(obj, true); store.toVault(obj.slab.id); hud(); S.toast('Into the vault. Open the little case by the binder to see it.'); }
  }

  /* ---------- the machine ---------- */
  M.define('locked', { pointer: () => false, key: () => false });
  M.define('*', { on: { CLOSE: (p, M) => 'idle' } });
  M.define('idle', {
    exit() { sd = null; setHot(null); },
    on: { VAULT: (p, M) => M.defined('vault.open') ? 'vault.open' : (S.toast('The vault is still being built. Soon.'), undefined),
          LOOT: (p, M) => M.defined('loot.open') ? 'loot.open' : (S.toast('The loot board is still being built. Soon.'), undefined),
          ROOM: 'room.knock' },
    pointer(kind, e, M) {
      /* a print, wall group or string being dragged keeps the table's own handling; the buttons only take a free pointer */
      if (ctx.drag.p || ctx.drag.pending || ctx.drag.wall || ctx.isBusy()) { setHot(null); return false; }
      return S.tablePointer(kind, e, hittable()); },
  });
  /* the buttons, parcels and slabs on whichever side is up: shared by the light side's idle and the dark side's under */
  S.tablePointer = function (kind, e, list) {
    if (S.parcel && S.parcel.pointer(kind, e)) { setHot(null); return true; }
    if (sd) return slabDrag(kind, e);
    if (kind === 'move') { const h = S.hitAny(e, list); setHot(h ? h.root : null); if (h) { ctx.canvas.style.cursor = 'pointer'; ctx.hideActs(); return true; } ctx.canvas.style.cursor = 'default'; return false; }
    if (kind === 'down') { if (e.button !== 0) return false; const h = S.hitAny(e, list); if (!h) return false;
      if (h.root.name === 'loot') { S.sfx('detent'); M.send('LOOT'); } else if (h.root === btnVault) { S.sfx('detent'); M.send('VAULT'); } else if (h.root === btnKey) { S.sfx('detent'); M.send('ROOM'); }
      else { const o = tableSlabs.find(o => o.group === h.root); if (o) { const t = S.tableHit(e, 0) || h.point; sd = { o, x0: e.clientX, y0: e.clientY, moved: 0, dx: o.group.position.x - t.x, dz: o.group.position.z - t.z, lifted: false }; } } return true; }
    return false;
  };
  M.define('room.knock', { busy: true, async enter(d, run) { S.sfx('ltMenu'); const r0 = btnKey.rotation.z; await T.tween({ dur: 0.7, ease: T.E.linear, update: (e, r) => { btnKey.rotation.z = r0 + Math.sin(r * Math.PI * 6) * 0.22 * (1 - r); } }); btnKey.rotation.z = r0; S.toast('The secret room is still being dug out. Coming soon.'); if (run.alive()) M.go('idle'); } });
  /* a slab on the table drags like a print; a click without movement inspects it */
  let sd = null;
  function slabDrag(kind, e) {
    const o = sd.o, g = o.group;
    if (kind === 'move') { sd.moved += Math.abs(e.clientX - sd.x0) + Math.abs(e.clientY - sd.y0); sd.x0 = e.clientX; sd.y0 = e.clientY;
      if (sd.moved > 6) { if (!sd.lifted) { sd.lifted = true; S.sfx('lift'); ctx.hideActs(); T.to(g.position, { y: 0.5 }, { dur: 0.18, ease: T.E.outCubic, tag: 'tslab' }); if (o.tableShadow) o.tableShadow.material.opacity = 0.3; }
        const t = S.tableHit(e, 0); if (t) { const W = ctx.W_T / 2 - 0.6, H = ctx.H_T / 2 - 0.6; g.position.x = T.clamp(t.x + sd.dx, -W, W); g.position.z = T.clamp(t.z + sd.dz, -H, H); if (o.tableShadow) { o.tableShadow.position.x = g.position.x + 0.05; o.tableShadow.position.z = g.position.z + 0.07; } } ctx.canvas.style.cursor = 'grabbing'; }
      return true; }
    if (kind === 'up') { const d = sd; sd = null; ctx.canvas.style.cursor = 'pointer';
      if (!d.lifted) { S.sfx('detent'); inspectTableSlab(o); return true; }
      const y = (o.th || SM.SLAB.th) * S.TABLE_K / 2 + 0.004; T.to(g.position, { y }, { dur: 0.22, ease: T.E.outCubic, tag: 'tslab' }); if (o.tableShadow) T.to(o.tableShadow.material, { opacity: 0.55 }, { dur: 0.25 });
      S.sfx('ltPutDown'); store.toTable(o.slab.id, g.position.x, g.position.z, o.yaw || 0); return true; }
    return true;
  }
  function hittable() { const wall = ctx.cam.view === 'wall'; return wall ? [btnKey] : [btnKey, ...tableSlabs.map(o => o.group)]; }
  let hot = null; function setHot(o) { if (hot === o) return; if (hot) hot.userData.hotT = 0; hot = o; if (hot) hot.userData.hotT = 1; }

  /* ---------- unlock / lock ---------- */
  function unlock() { store.get().unlocked = true; store.save(); M.go('idle'); S.sfx('kitOpen'); hud();
    buttons.forEach((b, i) => { b.visible = true; b.scale.setScalar(0.001); T.tween({ dur: 0.6, delay: 0.1 + i * 0.12, ease: T.E.outBack, update: e => b.scale.setScalar(Math.max(0.001, e)) }); });
    if (!tableSlabs.length) S.table.restore();
    S.toast('Unlocked. Press Space to turn the table over.'); }
  /* locking hides every trace: the buttons dissolve and the slabs on the table go too (they stay in the store for next time) */
  function lock() { if (S.under && S.under.on) { S.toast('Turn the table back over first (Space).'); return; } store.get().unlocked = false; store.save(); if (inspect.active()) inspect.close('back'); M.go('locked'); hud(); dev.toggle(false);
    buttons.forEach((b, i) => { P.dissolve(b, { mode: dev.opt('dissolve'), dur: 1.1, delay: i * 0.1, spread: 1.4 }); });
    tableSlabs.slice().forEach((o, i) => { P.dissolve(o.group, { mode: dev.opt('dissolve'), dur: 1.1, delay: 0.2 + i * 0.08, spread: 1.6 }); S.table.remove(o, true); }); }
  function resetAll() { tableSlabs.slice().forEach(o => S.table.remove(o, true)); store.reset(); SL.store.get().unlocked = true; store.save(); hud(); S.toast('Secret layer reset. Pulls, vault and binder are empty again.'); }
  S.unlock = unlock; S.lock = lock;

  /* ---------- dev panel and shared inspect ---------- */
  const dev = createDev(S); S.dev = dev;
  const inspect = createInspect(S); S.inspect = inspect;
  dev.on('finish', () => S.slabs.refreshFinish()); dev.on('speed', v => T.setTimeScale(+v || 1)); T.setTimeScale(+dev.opt('speed') || 1);
  dev.action('Roll a raw print', () => S.rollToTable({ graded: false }), 'Try'); dev.action('Roll a slab', () => S.rollToTable(), 'Try'); dev.action('Roll a Mythic', () => S.rollToTable({ tier: 'mythic' }), 'Try'); dev.action('Roll a variant', () => S.rollToTable({ variant: SL.VARIANTS[Math.floor(Math.random() * SL.VARIANTS.length)].id }), 'Try');
  dev.action('Open vault', () => M.is('idle') && M.send('VAULT'), 'Try'); dev.action('Open loot', () => M.is('idle') && M.send('LOOT'), 'Try');
  /* grading wait per the dev panel: a real day, a minute, or none */
  S.gradingWait = () => ({ day: SL.GRADING_MS, minute: 60000, instant: 0 }[dev.opt('grading')] ?? SL.GRADING_MS);
  dev.action('Skip the wait', () => { let n = 0; store.get().pulls.forEach(p => { if (p.sentAt && !p.graded && Date.now() < p.readyAt) { SL.skipGrading(p); n++; } }); S.toast(n ? n + ' parcel' + (n === 1 ? '' : 's') + ' back on the table.' : 'Nothing is away for grading.'); hud(); if (S.parcel) S.parcel.check(); }, 'Try');
  dev.action('Lock again', () => lock(), 'Reset'); dev.action('Reset secret data', () => resetAll(), 'Reset');
  dev.info(() => { const d = store.get(); return d.pulls.length + ' pulls · ' + d.vault.length + ' in vault'; });
  S.css(BASE_CSS + DEV_CSS + INSPECT_CSS);

  /* ---------- the modules (each owns one file) ---------- */
  [sound, print, holo, rail, arm, vault, binder, parcel, loot, under].forEach(m => { try { if (m.install) m.install(S); } catch (e) { console.error('secret module', e); } });

  /* ---------- boot ---------- */
  if (S.unlocked()) { buttons.forEach(b => { b.visible = true; }); M.go('idle'); S.table.restore(); } else M.go('locked');
  hud();

  /* ---------- what main.js calls ---------- */
  const api = {
    S,
    active() { return M.active() || inspect.active(); },
    busy() { return M.busy() || inspect.active(); },
    pointer(kind, e) {
      if (inspect.active()) return inspect.pointer(kind, e);
      if (M.state === 'locked') return false;
      const r = M.pointer(kind, e); return r || M.busy();   /* the table stays usable while a case or binder is simply open */
    },
    key(e) {
      if (e.key === '=' && !e.ctrlKey && !e.metaKey && !e.altKey) { if (inspect.active()) { inspect.close('back'); return true; } if (M.active()) { M.send('CLOSE'); return true; } showBox(); return true; }
      if (e.key === '`' && S.unlocked()) { dev.toggle(); return true; }
      if (e.key === ' ' && S.unlocked() && !inspect.active() && S.under && (M.is('idle') || M.is('under'))) { S.under.flip(M.is('idle') ? 'under' : 'idle'); return true; }
      if (inspect.active() && inspect.key(e)) return true;
      if (M.state === 'locked') return false;
      return M.key(e) || M.busy();
    },
    frame(dt, now) {
      T.tick(dt); P.particleFrame(dt); placeLoot();
      if (S.unlocked()) { const pulse = 0.35 + 0.25 * Math.sin(now / 420);
        buttons.forEach(b => { const cap = b.userData.cap; if (!cap) return; const want = b.userData.hotT ? 1.4 : M.is('idle') ? pulse : 0.15; cap.material.emissiveIntensity += (want - cap.material.emissiveIntensity) * (1 - Math.exp(-dt * 10)); }); }
      M.frame(dt); inspect.frame(dt); if (S.parcel) S.parcel.frame(dt); if (S.under) S.under.frame(dt);
      slabObjs.forEach(o => { if (o.built) o.update(dt); });
    },
    pause(on) { if (on && inspect.active()) inspect.close('back'); },
  };
  return api;
}

const BASE_CSS = `
#sk{ position:fixed; left:50%; top:42%; transform:translate(-50%,-50%) translateY(8px); opacity:0; pointer-events:none; transition:opacity .45s, transform .5s cubic-bezier(.2,.8,.2,1); z-index:15; }
#sk.on{ opacity:1; pointer-events:auto; transform:translate(-50%,-50%); }
#sk input{ width:220px; background:transparent; border:0; border-bottom:1px solid rgba(244,241,234,.35); color:var(--text); font:400 22px/1.4 var(--f-mono); text-align:center; letter-spacing:.18em; outline:0; padding:6px 0; caret-color:var(--accent); }
#sk input:focus{ border-bottom-color:rgba(244,241,234,.7); }
#sk.shake{ animation:skshake .4s; } @keyframes skshake{ 0%,100%{ transform:translate(-50%,-50%); } 25%{ transform:translate(calc(-50% - 6px),-50%); } 75%{ transform:translate(calc(-50% + 6px),-50%); } }
#skPts{ position:fixed; right:max(16px, env(safe-area-inset-right,0px)); bottom:calc(18px + env(safe-area-inset-bottom,0px)); font:500 10px/1 var(--f-mono); letter-spacing:.16em; color:var(--faint); opacity:0; transition:opacity .4s; pointer-events:none; z-index:3; }
#skPts.on{ opacity:1; }
#skSkip{ position:fixed; right:max(16px, env(safe-area-inset-right,0px)); bottom:calc(36px + env(safe-area-inset-bottom,0px)); font:500 10px/1 var(--f-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--text); background:rgba(20,18,16,.78); border:1px solid rgba(244,241,234,.25); border-radius:999px; padding:7px 12px; cursor:pointer; z-index:4; }
#skSkip:hover{ border-color:rgba(244,241,234,.6); }
#skNav{ position:fixed; left:50%; bottom:calc(74px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); display:flex; gap:8px; opacity:0; pointer-events:none; transition:opacity .3s; z-index:6; }
#skNav.on{ opacity:1; pointer-events:auto; }
#skNav button{ font:500 11px/1 var(--f-mono); letter-spacing:.12em; text-transform:uppercase; color:var(--text); background:rgba(20,18,16,.82); border:1px solid rgba(244,241,234,.28); border-radius:999px; padding:9px 14px; cursor:pointer; }
#skNav button:hover{ border-color:rgba(244,241,234,.65); }
`;
