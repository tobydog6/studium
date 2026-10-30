// SLAB BINDER: what the vault's case dissolves into. A thick ring binder in the middle of the table, green cloth
// like the table's own binder, "Studium · Rare" on the cover. Open, it shows a spread of two pages with nine clear
// pockets each, every filled pocket holding a scaled-down slab from S.store.get().binder (pages of 9 ids or null).
// Click a pocket to inspect its slab (put it back, move it to another pocket, or take it onto the table); click the
// arrow or the outer edge of a page to turn it (a leaf swings over the rings). Everything talks through S.
//   binderMesh(S)  → the THREE.Group, built once, closed and hidden until used (vault.js morphs the case into it)
//   states         vault.binder (vault.js hands over after the morph), vault.binder.closing, binder.open (from idle,
//                  the Library folder later), binder.closing. CLOSE (=) shuts the cover and hands back.
//   S.binder       { mesh, open(), close(), turn(dir), spread(), pockets() }
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* the closed binder: w across the table, h tall, d deep; covers, two page stacks and a thin cloth spine */
const B = { w: 4.4, h: 0.5, d: 4.2, cover: 0.08, stack: 0.17, spine: 0.06, pageW: 4.1, pageD: 3.9, x: -13, z: 8.6 };   /* its own spot on the dark side */
const PK = { w: 0.95, h: 1.12, px: 1.12, pz: 1.24 };                     /* a pocket and the grid pitch */
const SPINE_X = -B.w / 2;                                                /* the spine stands at the left edge */
const HINGE_X = SPINE_X - B.h;                                           /* where the cover pivots once the spine lies flat */
const AX = SPINE_X - B.h / 2;                                            /* the ring axis, once open */
const PAGE_TOP = B.cover + B.stack;                                      /* the open pages' top face */
const PRX = SPINE_X + B.cover + B.pageW / 2;                             /* right page centre */
const R = PRX - AX;                                                      /* page centre to ring axis */
const PLX = AX - R;                                                      /* left page centre */
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const SIDE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
/* outBack that bounces up instead of dipping through the table: the cover lands, lifts a touch, settles */
const HINT = 'Click a slab to look closer. The arrows turn the page. Press = to close the binder.';
const flap = t => { const c = 1.70158, e = 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); return 1 - Math.abs(1 - e); };

let built = null;
export function binderMesh(S) { if (!built) built = build(S); if (!built.active()) built.resetClosed(); return built.root; }

export function install(S) {
  const b = binderMesh(S) && built, M = S.M, T = S.T;
  b.install(S);
  S.binder = {
    mesh: () => binderMesh(S),
    open() { if (M.is('idle')) return M.go('binder.open'); if (M.is('vault') && !M.is('vault.binder')) return M.go('vault.binder'); return null; },
    close() { if (b.active()) M.send('CLOSE'); },
    /* a game's chooser: pages of the ids given; choose(slab, worldPos) → true for more; the binder closes into ret */
    pick(o) { const ids = (o.ids || []).slice(), pages = []; while (ids.length) pages.push(ids.splice(0, 9).concat(new Array(9).fill(null)).slice(0, 9));
      b.pick = { pages, choose: o.choose, ret: o.ret, hint: o.hint || '', label: o.label, hold: o.hold || null, tabs: o.tabs || null }; return M.go('binder.open'); },
    turn(dir) { return b.turn(dir || 1); },
    spread() { return b.spread; },
    pockets() { return b.allPockets(); },
    hot: () => b.hot, pending: () => b.pending, busy: () => b.busy, __pick: pk => b.pickPocket(pk),
  };
  S.dev.action('Open binder', () => M.is('idle') && M.go('binder.open'), 'Try');

  const pointer = (kind, e, M) => S.dragging() ? S.tablePointer(kind, e, S.table.list.map(o => o.group)) : (b.pointer(kind, e) || S.tablePointer(kind, e, S.table.list.map(o => o.group)));
  /* a slab or print dragged onto the open binder files into the pocket under it, or the first free one */
  function dropInto(obj, e) { if (!b.active() || b.busy) return false; const h = S.hitAny(e, b.allPockets().map(pk => pk.group)); const pk = h ? h.root.userData.pocket : null;
    if (!h) { const t = S.tableHit(e, 0); if (!t || Math.abs(t.x - B.x - AX) > B.w + 0.8 || Math.abs(t.z - B.z) > B.d / 2 + 0.8) return false; }
    const id = obj.slab.id, pages = store.get().binder; S.sfx('binder'); S.table.remove(obj, true);
    if (pk && !pk.id) { store.detach(id); while (pages.length <= pk.page) pages.push(new Array(9).fill(null)); pages[pk.page][pk.slot] = id; store.save(); } else store.toBinder(id);
    S.hud(); b.loadSpread(); b.drawCover(); return true; }
  const key = (e) => b.key(e);
  const frame = (dt) => b.frame(dt);
  /* ---------- from the vault: the case has just become the binder ---------- */
  M.define('vault.binder', {
    async enter(d, run) {
      b.root.visible = true; b.begin(false);
      if (b.pick && b.pick.hold) { b.frameCam(); await b.toHold(true); if (!run.alive()) return; }
      await b.openCover(); if (!run.alive()) return;
      b.showSpread();
    },
    exit: next => b.leave(next),
    on: { CLOSE: (p, M) => { if (M.state === 'vault.binder') M.go('vault.binder.closing'); }, CASE: (p, M) => { if (M.state === 'vault.binder') M.go('vault.binder.closing', { toCase: true }); } },
    pointer, key, frame,
  });
  M.define('vault.binder.closing', { busy: true,
    async enter(d, run) {
      await b.closeCover(); if (!run.alive()) return;
      /* the binder becomes the case again, then the vault lowers it the way it came up */
      if (S.vault && S.vault.caseBack && M.defined('vault.closing')) { await S.vault.caseBack(b.root); if (!run.alive()) return; b.root.visible = false; M.go(d && d.toCase ? 'vault.case' : 'vault.closing', d && d.toCase ? { quiet: true } : { fromBinder: true }); }
      else { S.cam.pop(); M.go('idle'); }
    },
    exit: next => b.leave(next), on: { CLOSE: () => {} }, frame,
  });
  /* ---------- straight from the table (the Library's Rare folder, the dev panel) ---------- */
  M.define('binder.open', {
    async enter(d, run) {
      S.cam.push(); b.pushed = true; const already = b.root.visible; b.resetClosed(); b.begin(true); S.dropTargets.binder = b.pick ? null : dropInto;
      if (!already) { const rect = [HINGE_X - B.w - 0.6 + B.x, B.z - B.d / 2 - 0.6, B.w / 2 + 0.6 + B.x, B.z + B.d / 2 + 0.6];
        await S.clearPrints(rect, S.dev.opt('clearing')); if (!run.alive()) return;
        S.sfx('detent'); await S.P.reform(b.root, { mode: S.dev.opt('dissolve'), dur: 1.1 }); if (!run.alive()) return; } else S.sfx('detent');
      if (b.pick && b.pick.hold) { b.frameCam(); await b.toHold(true); if (!run.alive()) return; }
      await b.openCover(); if (!run.alive()) return;
      b.showSpread();
    },
    exit: next => b.leave(next),
    on: { CLOSE: (p, M) => { if (M.state === 'binder.open') M.go('binder.closing'); } },
    pointer, key, frame,
  });
  M.define('binder.closing', { busy: true,
    async enter(d, run) {
      await b.closeCover(); if (!run.alive()) return;
      if (b.pick && b.pick.hold) { await b.toHold(false); if (!run.alive()) return; }
      await T.wait(0.15); if (!run.alive()) return;
      if (!(S.under && S.under.on)) { await S.P.dissolve(b.root, { mode: S.dev.opt('dissolve'), dur: 1.2 }); if (!run.alive()) return; }
      if (b.pushed) { S.cam.pop(); b.pushed = false; }
      M.go((b.pick && b.pick.ret) || 'idle');
    },
    exit: next => b.leave(next), on: { CLOSE: () => {} }, frame,
  });
}

/* ================= canvases, in the table binder's own style ================= */
function speckle(g, W, H, n, r) { for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.025)'; g.fillRect(r() * W, r() * H, 2, 2); } }
function clothCanvas(S) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = S.ctx.mulberry(17); g.fillStyle = '#141519'; g.fillRect(0, 0, 256, 256); speckle(g, 256, 256, 2600, r); return c; }
function coverCanvas(S, count) {
  const W = 1024, H = Math.round(1024 * B.d / B.w), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = S.ctx.mulberry(7);
  g.fillStyle = '#141519'; g.fillRect(0, 0, W, H); speckle(g, W, H, 14000, r);
  g.fillStyle = '#0c0d10'; g.fillRect(0, 0, 70, H); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(70, 0, 3, H);
  g.strokeStyle = 'rgba(244,241,234,0.3)'; g.lineWidth = 3; g.strokeRect(110, 36, W - 146, H - 72);
  g.strokeStyle = 'rgba(227,173,87,0.35)'; g.lineWidth = 2; g.strokeRect(126, 52, W - 178, H - 104);
  const px = W / 2 + 35, py = H / 2; g.fillStyle = '#222329'; g.fillRect(px - 210, py - 100, 420, 200); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.strokeRect(px - 202, py - 92, 404, 184);
  g.fillStyle = '#efe9dc'; g.textAlign = 'center'; g.font = '400 54px "Fraunces", Georgia, serif'; g.fillText('Studium · Rare', px, py + 2);
  g.font = '500 22px "Geist Mono", ui-monospace, monospace'; g.fillStyle = '#9a9aa6'; g.fillText((count === 1 ? '1 CARD' : count + ' CARDS'), px, py + 52);
  g.fillStyle = '#e3ad57'; g.font = '500 20px "Geist Mono", ui-monospace, monospace'; g.fillText('C O L L E C T O R', px, H - 96);
  return c;
}
function edgeCanvas() { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#2a2b31'; g.fillRect(0, 0, 512, 64); for (let y = 2; y < 64; y += 3) { g.fillStyle = 'rgba(0,0,0,' + (0.05 + Math.random() * 0.08) + ')'; g.fillRect(0, y, 512, 1); } return c; }
/* the page: cream paper with nine pocket outlines, no text so it reads the same way up on either side */
function pageCanvas(S) {
  const W = 1024, H = Math.round(1024 * B.pageD / B.pageW), k = W / B.pageW, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = S.ctx.mulberry(23);
  g.fillStyle = '#1c1d23'; g.fillRect(0, 0, W, H); for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.05)'; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
  for (let i = 0; i < 9; i++) { const x = W / 2 + ((i % 3) - 1) * PK.px * k, y = H / 2 + (Math.floor(i / 3) - 1) * PK.pz * k, w = (PK.w + 0.06) * k, h = (PK.h + 0.06) * k;
    g.fillStyle = 'rgba(255,255,255,0.04)'; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, 10); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 2; g.stroke(); }
  return c;
}
function textCanvas(lines, W, H, big) { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
  if (big) { g.fillStyle = '#e9e4d8'; g.font = '400 64px "Fraunces", Georgia, serif'; g.fillText(lines[0], W / 2, H / 2 - 36); g.fillStyle = '#9a9aa6'; g.font = '500 26px "Geist Mono", ui-monospace, monospace'; g.fillText(lines[1] || '', W / 2, H / 2 + 44); }
  else { g.fillStyle = 'rgba(190,190,205,0.8)'; g.font = '500 30px "Geist Mono", ui-monospace, monospace'; g.fillText(lines[0], W / 2, H / 2); }
  return c; }
function arrowCanvas(dir) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
  g.strokeStyle = 'rgba(235,235,245,0.8)'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(64 - dir * 14, 34); g.lineTo(64 + dir * 16, 64); g.lineTo(64 - dir * 14, 94); g.stroke(); return c; }

/* ================= the binder ================= */
function build(S) {
  const THREE_ = THREE, T = S.T, store = S.store;
  const env = S.SM.envMap(S.renderer);
  const root = new THREE.Group(); root.name = 'rareBinder'; root.position.set(B.x, 0, B.z); root.visible = false; S.scene.add(root);
  /* divider tabs for a game's chooser (Sam's sketch): clean card tabs out of the left cover's outer edge, one per
     artist (and All), and along its top edge, one per order; the chosen one stands proud and bright */
  const tabsG = new THREE.Group(); tabsG.visible = false; root.add(tabsG);
  const EDGE_X = PLX - B.pageW / 2 - 0.1, TOP_Z = -B.pageD / 2 - 0.1;
  const TAB_COLS = ['#d9cdb4', '#7fa58a', '#c49a62', '#8a74c0', '#c46a5f', '#6f93c4', '#c4b25a', '#5fb0a8', '#b46fa0', '#8f8f8f'];
  function tabCanvas(label, col, w, h) { const c = document.createElement('canvas'), k = 160; c.width = Math.round(w * k); c.height = Math.round(h * k); const g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(20,18,16,0.88)'; let fs = Math.round(c.height * 0.42); g.font = '600 ' + fs + 'px "Geist", system-ui, sans-serif';
    while (g.measureText(label).width > c.width * 0.86 && fs > 10) { fs--; g.font = '600 ' + fs + 'px "Geist", system-ui, sans-serif'; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, c.width / 2, c.height / 2 + 1); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  function tab(kind, id, label, col, x, z, w, d) { const g = new THREE.Group(); g.position.set(x, PAGE_TOP - 0.02, z);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tabCanvas(label, col, w, d), roughness: 0.62 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(w, 0.035, d, 2, 0.03), new THREE.MeshStandardMaterial({ color: new THREE.Color(col), roughness: 0.7 })); g.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, d - 0.06), mat); face.rotation.x = -Math.PI / 2; face.position.y = 0.019; g.add(face);
    g.userData.tab = { kind, id }; g.userData.noParticles = true; body.userData.noParticles = face.userData.noParticles = true; tabsG.add(g); return g; }
  const clothTex = S.SM.tex(clothCanvas(S)); clothTex.wrapS = clothTex.wrapT = THREE.RepeatWrapping; clothTex.repeat.set(3, 3);
  const cloth = new THREE.MeshLambertMaterial({ map: clothTex }), lining = new THREE.MeshLambertMaterial({ color: 0x2a2b31 });
  const edge = new THREE.MeshLambertMaterial({ map: S.SM.tex(edgeCanvas()) });
  const paperTex = S.SM.tex(pageCanvas(S)), paper = new THREE.MeshLambertMaterial({ map: paperTex });
  const coverCv = coverCanvas(S, 0), coverTex = S.SM.tex(coverCv), art = new THREE.MeshBasicMaterial({ map: coverTex });
  /* back cover and the right stack of pages, fixed on the table */
  const back = new THREE.Mesh(new THREE.BoxGeometry(B.w, B.cover, B.d), [cloth, cloth, lining, cloth, cloth, cloth]); back.position.y = B.cover / 2; root.add(back);
  const stackR = new THREE.Mesh(new THREE.BoxGeometry(B.pageW, B.stack, B.pageD), [edge, edge, paper, lining, edge, edge]); stackR.position.set(PRX, B.cover + B.stack / 2, 0); root.add(stackR);
  /* the spine, hinged at the back cover's edge; the rings ride on it */
  const spineG = new THREE.Group(); spineG.position.set(SPINE_X, 0, 0); root.add(spineG);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(B.spine, B.h, B.d), cloth); plate.position.set(B.spine / 2, B.h / 2, 0); spineG.add(plate);
  const metal = new THREE.MeshStandardMaterial({ color: 0xd2d5d8, metalness: 0.9, roughness: 0.28, envMap: env, envMapIntensity: 1.2 });
  [-1.3, 0, 1.3].forEach(z => { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 10, 44), metal); ring.position.set(0.33, 0.25, z); ring.scale.set(1, 0.8, 1); spineG.add(ring); });
  /* the front cover, hinged at the spine's top edge, carrying the left stack of pages inside it */
  const coverG = new THREE.Group(); coverG.position.set(0, B.h, 0); spineG.add(coverG);
  const cover = new THREE.Mesh(new THREE.BoxGeometry(B.w, B.cover, B.d), [cloth, cloth, art, lining, cloth, cloth]); cover.position.set(B.w / 2, -B.cover / 2, 0); coverG.add(cover);
  const stackL = new THREE.Mesh(new THREE.BoxGeometry(B.pageW, B.stack, B.pageD), [edge, edge, lining, paper, edge, edge]); stackL.position.set(B.cover + B.pageW / 2, -B.cover - B.stack / 2, 0); coverG.add(stackL);
  [['#7f9a86', -0.9], ['#e3ad57', -0.3], ['#9b5cff', 0.3], ['#c0714f', 0.9]].forEach(([c, z]) => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: c })); t.position.set(B.w + 0.06, -0.13, z); coverG.add(t); });
  const coverShadow = S.shadow(B.w + 1.2, B.d + 1.2); coverShadow.material.side = THREE.DoubleSide; coverShadow.position.set(B.w / 2, -0.004, 0); coverShadow.rotation.set(Math.PI / 2, 0, 0); coverG.add(coverShadow);
  root.add(S.shadow(B.w + 1.3, B.d + 1.3));
  /* the two page faces the pockets sit on: pageL rides inside the cover, pageR sits on the right stack */
  const pageR = new THREE.Group(); pageR.position.set(PRX, PAGE_TOP, 0); root.add(pageR);
  const pageL = new THREE.Group(); pageL.position.set(B.cover + B.pageW / 2, -(B.cover + B.stack), 0); pageL.rotation.z = Math.PI; coverG.add(pageL);
  /* the leaf that turns: front face over the right page, back face landing on the left */
  const leaf = new THREE.Group(); leaf.position.set(AX, PAGE_TOP + 0.002, 0); leaf.visible = false; root.add(leaf);
  const leafFront = new THREE.Group(); leafFront.position.set(R, 0.004, 0); leaf.add(leafFront);
  const leafBack = new THREE.Group(); leafBack.position.set(R, -0.004, 0); leafBack.rotation.z = Math.PI; leaf.add(leafBack);
  [leafFront, leafBack].forEach(g => { const p = new THREE.Mesh(new THREE.PlaneGeometry(B.pageW, B.pageD), paper); p.rotation.x = -Math.PI / 2; g.add(p); });

  const b = {
    root, spread: 0, hot: null, pending: null, pushed: false, busy: false, gen: 0, S: null, mode: null,
    pages: { L: null, R: null },   /* the page contents on show */
    install(S) { b.S = S; },
    active() { return b.mode !== null; },
    allPockets() { return [b.pages.L, b.pages.R].filter(Boolean).flatMap(pc => pc.pockets); },
    /* ---------- pose ---------- */
    resetClosed() { b.clearPages(); spineG.rotation.z = 0; coverG.rotation.z = 0; leaf.visible = false; leaf.rotation.z = 0; b.hot = null; b.pending = null; b.busy = false; b.drawCover(); },
    drawCover() { const n = b.pagesData().reduce((s, pg) => s + (pg ? pg.filter(Boolean).length : 0), 0); const c = coverCanvas(S, n); coverCv.getContext('2d').drawImage(c, 0, 0); coverTex.needsUpdate = true; },
    begin(fromTable) { b.gen++; b.mode = fromTable ? 'table' : 'vault'; b.spread = 0; b.pending = null; b.hot = null; b.busy = false; b.drawCover(); },
    /* held (a game's chooser): the binder slides up the mat from its spot and tilts up towards you, as if in your hands */
    toHold(on) { const H = b.pick && b.pick.hold; if (!H) return Promise.resolve(); if (on) b.buildTabs(); else tabsG.visible = false; const p0 = root.position.clone(), r0 = root.rotation.clone(), p1 = on ? new THREE.Vector3(...H.pos) : new THREE.Vector3(B.x, 0, B.z);
      const r1 = on ? new THREE.Euler(H.tilt || 0.7, H.yaw || 0, 0) : new THREE.Euler(0, 0, 0); S.sfx('lift');
      return T.tween({ dur: on ? 1.1 : 0.9, ease: T.E.inOutCubic, tag: 'binder', update: e => { root.position.lerpVectors(p0, p1, e); root.position.y += Math.sin(e * Math.PI) * 0.4; root.rotation.set(r0.x + (r1.x - r0.x) * e, r0.y + (r1.y - r0.y) * e, 0); } }); },
    /* the chooser's tabs: built from b.pick.tabs ({ side, top, sel, list(sel) → ids }); the chosen ones stand proud */
    buildTabs() { tabsG.children.slice().forEach(g => { tabsG.remove(g); g.traverse(o => { if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } if (o.geometry) o.geometry.dispose(); }); });
      const P = b.pick && b.pick.tabs; tabsG.visible = !!P; if (!P) return;
      const side = P.side.slice(0, 8), sd = Math.min(0.62, (B.pageD - 0.2) / side.length);
      side.forEach((t, i) => tab('side', t.id, t.label, TAB_COLS[i % TAB_COLS.length], EDGE_X - 0.42, -B.pageD / 2 + 0.1 + sd * (i + 0.5), 1.15, sd - 0.06));
      P.top.forEach((t, i) => tab('top', t.id, t.label, '#3a3631', EDGE_X + 1.0 + i * 1.3, TOP_Z - 0.2, 1.2, 0.5));
      b.paintTabs(); },
    paintTabs() { const P = b.pick && b.pick.tabs; if (!P) return; tabsG.children.forEach(g => { const t = g.userData.tab, on = P.sel[t.kind] === t.id;
      g.position.y = PAGE_TOP - 0.02 + (on ? 0.05 : 0); if (t.kind === 'side') g.position.x = EDGE_X - 0.42 - (on ? 0.18 : 0); else g.position.z = TOP_Z - 0.2 - (on ? 0.14 : 0);
      g.children[1].material.color.setScalar(on ? 1 : 0.62); if (t.kind === 'top') g.children[0].material.color.set(on ? 0xe3ad57 : 0x3a3631); }); },
    clickTab(t) { const P = b.pick && b.pick.tabs; if (!P || P.sel[t.kind] === t.id) return; P.sel[t.kind] = t.id; S.sfx('detent');
      const ids = P.list(P.sel), pages = []; while (ids.length) pages.push(ids.splice(0, 9).concat(new Array(9).fill(null)).slice(0, 9));
      b.pick.pages = pages; b.spread = 0; b.loadSpread(); b.paintTabs(); },
    async openCover() { S.sfx('binder'); b.frameCam();
      await T.tween({ dur: 1.0, ease: flap, tag: 'binder', update: e => { spineG.rotation.z = e * Math.PI / 2; coverG.rotation.z = e * Math.PI / 2; } }); },
    async closeCover() { b.busy = true; b.setHot(null); b.pending = null; S.ctx.hint(null); b.clearPages(); leaf.visible = false; S.sfx('binder');
      const s0 = spineG.rotation.z, c0 = coverG.rotation.z;
      await T.tween({ dur: 0.7, ease: T.E.inOutCubic, tag: 'binder', update: e => { spineG.rotation.z = s0 * (1 - e); coverG.rotation.z = c0 * (1 - e); } }); b.busy = false; },
    /* from above and in front, the open spread filling the view; wide pulls back a touch so a slab laid in front shows too */
    frameCam(wide) { if (b.pick && b.pick.hold) { S.cam.set(b.pick.hold.cam); return; } S.cam.set({ pitch: 58 }); if (wide) S.cam.set({ tx: B.x + AX + 0.6, ty: 0, tz: B.z + 1.6, dT: S.cam.fit(11.4, 9.2) }); else S.cam.set({ tx: B.x + AX + 0.4, ty: 0, tz: B.z + 0.3, dT: S.cam.fit(10.8, 6.2) }); },
    showSpread() { b.busy = false; b.loadSpread(); S.ctx.hint(b.pick ? b.pick.hint : HINT); },
    leave(next) { if (/^(vault\.binder|binder)(\.|$)/.test(next)) return; S.dropTargets.binder = null; b.pick = null; root.position.set(B.x, 0, B.z); root.rotation.set(0, 0, 0); tabsG.visible = false; b.gen++; T.cancelAll('binder'); b.setHot(null); b.pending = null; S.ctx.hint(null); b.clearPages(); leaf.visible = false; b.busy = false; b.mode = null;
      if (b.pushed) { S.cam.pop(); b.pushed = false; }
      if (/^vault\./.test(next)) { spineG.rotation.z = 0; coverG.rotation.z = 0; if (next === 'vault.closing') root.visible = false; } else { b.resetClosed(); root.visible = !!(S.under && S.under.on); } },
    /* ---------- pages ---------- */
    /* the pages on show: the binder's own, or the slabs a game asks you to choose from (S.binder.pick) */
    pagesData() { return b.pick ? b.pick.pages : store.get().binder; },
    pageCount() { return Math.max(2, Math.ceil(b.pagesData().length / 2) * 2); },
    spreads() { return b.pageCount() / 2; },
    slots(idx) { const pg = b.pagesData()[idx]; return pg ? pg.slice(0, 9) : new Array(9).fill(null); },
    /* one page's contents: nine pocket groups, the page number, the turn arrow and its hit strip; mount() puts them in a frame */
    buildPage(idx, side) {
      const pc = { idx, side, pockets: [], items: [], gen: b.gen }, slots = b.slots(idx), empty = b.pagesData().length === 0;
      slots.forEach((id, i) => {
        const g = new THREE.Group(); g.position.set(((i % 3) - 1) * PK.px, 0, (Math.floor(i / 3) - 1) * PK.pz);
        const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMap: env, envMapIntensity: 1.1, depthWrite: false, emissive: 0xf2c46a, emissiveIntensity: 0 });
        const acr = new THREE.Mesh(new RoundedBoxGeometry(PK.w, PK.h, 0.02, 2, 0.01), mat); acr.rotation.x = -Math.PI / 2; acr.position.y = 0.06; acr.userData.noParticles = true; acr.renderOrder = 2; g.add(acr);
        const pk = { page: idx, slot: i, id: id || null, group: g, acr, obj: null, s: 1, pc }; g.userData.pocket = pk; pc.pockets.push(pk); pc.items.push(g);
        if (id) b.fillPocket(pk);
      });
      const num = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.16), new THREE.MeshBasicMaterial({ map: S.SM.tex(textCanvas(['RARE  ·  PAGE ' + (idx + 1)], 512, 52)), transparent: true, depthWrite: false }));
      num.rotation.x = -Math.PI / 2; num.position.set(0, 0.003, B.pageD / 2 - 0.1); pc.items.push(num);
      if (empty && side === 'L') { const lbl = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: S.SM.tex(textCanvas(['Nothing in here yet.', 'Drag a card onto a pocket to file it.'], 1024, 256, true)), transparent: true, depthWrite: false }));
        lbl.rotation.x = -Math.PI / 2; lbl.position.set(0, 0.004, 0); lbl.renderOrder = 3; pc.items.push(lbl); }
      if (b.spreads() > 1) { const dir = side === 'L' ? -1 : 1;
        const ar = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: S.SM.tex(arrowCanvas(dir)), transparent: true, depthWrite: false }));
        ar.rotation.x = -Math.PI / 2; ar.position.set(dir * (B.pageW / 2 - 0.24), 0.004, B.pageD / 2 - 0.26); ar.userData.turn = dir; ar.renderOrder = 3; pc.items.push(ar);
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.46, B.pageD), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); strip.rotation.x = -Math.PI / 2; strip.position.set(dir * (B.pageW / 2 - 0.23), 0.002, 0); strip.userData.turn = dir; strip.userData.noParticles = true; pc.items.push(strip); }
      return pc;
    },
    mount(pc, frame) { pc.items.forEach(it => frame.add(it)); pc.frame = frame; return pc; },
    disposePage(pc) { if (!pc) return; pc.gen = -1; pc.pockets.forEach(pk => { if (pk.obj) { S.slabs.drop(pk.obj); pk.obj = null; } });
      pc.items.forEach(it => { if (it.parent) it.parent.remove(it); it.traverse(m => { if (m.isMesh && !m.userData.pocket) { m.geometry.dispose(); [].concat(m.material).forEach(mt => { if (mt.map && mt.map !== paperTex) mt.map.dispose(); mt.dispose(); }); } }); });
      pc.items.length = 0; pc.pockets.length = 0; },
    clearPages() { b.disposePage(b.pages.L); b.disposePage(b.pages.R); b.pages.L = b.pages.R = null; [leafFront, leafBack].forEach(g => { g.children.slice(1).forEach(c => g.remove(c)); }); b.hot = null; },
    loadSpread() { b.clearPages(); b.pages.L = b.mount(b.buildPage(b.spread * 2, 'L'), pageL); b.pages.R = b.mount(b.buildPage(b.spread * 2 + 1, 'R'), pageR); },
    /* a slab scaled down into its pocket, once its photo and label have built */
    fillPocket(pk) {
      const slab = store.pull(pk.id); if (!slab) { pk.id = null; return; }
      const obj = S.objFor(slab); pk.obj = obj; obj.group.visible = true; pk.group.add(obj.group); obj.group.visible = false;
      const gen = pk.pc.gen;
      obj.ready.then(() => { if (pk.pc.gen !== gen || pk.obj !== obj) return;
        /* a landscape slab goes in sideways, label to the top of the page, so it fills the pocket like a portrait one */
        const side = obj.w > obj.h, s = (side ? Math.min(PK.w / obj.h, PK.h / obj.w) : Math.min(PK.w / obj.w, PK.h / obj.h)) * 0.96; pk.s = s; const g = obj.group;
        g.quaternion.copy(FLAT); if (side) g.quaternion.premultiply(SIDE); g.position.set(0, obj.th * s / 2 + 0.003, 0); g.visible = true; g.scale.setScalar(s * 0.7);
        T.tween({ dur: 0.35, ease: T.E.outBack, tag: 'binder', update: e => g.scale.setScalar(s * (0.7 + 0.3 * e)) }); });
    },
    /* ---------- turning a page: the right leaf swings over the rings (dir 1), or the left one swings back (dir -1) ---------- */
    async turn(dir) {
      if (!b.active() || b.busy || S.inspect.active()) return false; const n = b.spreads(); if (n < 2) return false;
      b.busy = true; b.setHot(null); S.sfx('bkTurn'); const gen = b.gen, next = (b.spread + dir + n) % n;
      const going = dir > 0 ? b.pages.R : b.pages.L, under = dir > 0 ? b.pages.L : b.pages.R, carry = dir > 0 ? leafFront : leafBack, land = dir > 0 ? leafBack : leafFront;
      going.items.forEach(it => carry.add(it)); const fresh = b.mount(b.buildPage(dir > 0 ? next * 2 : next * 2 + 1, dir > 0 ? 'L' : 'R'), land);
      leaf.visible = true; leaf.rotation.z = dir > 0 ? 0 : Math.PI; let swapped = false;
      await T.tween({ dur: 0.5, ease: T.E.inOutSine, tag: 'binder', update: e => { leaf.rotation.z = dir > 0 ? e * Math.PI : (1 - e) * Math.PI;
        if (!swapped && e > 0.55) { swapped = true; b.disposePage(under); b.disposePage(going); } } });
      if (b.gen !== gen) return false;
      if (!swapped) { b.disposePage(under); b.disposePage(going); }
      leaf.visible = false; leaf.rotation.z = 0; b.spread = next;
      if (dir > 0) { b.pages.L = b.mount(fresh, pageL); b.pages.R = b.mount(b.buildPage(next * 2 + 1, 'R'), pageR); }
      else { b.pages.R = b.mount(fresh, pageR); b.pages.L = b.mount(b.buildPage(next * 2, 'L'), pageL); }
      b.busy = false; return true;
    },
    /* ---------- pointer ---------- */
    hittable() { return b.allPockets().map(pk => pk.group).concat([b.pages.L, b.pages.R].filter(Boolean).flatMap(pc => pc.items.filter(it => it.userData.turn))).concat(tabsG.visible ? tabsG.children : []); },
    setHot(o) { if (b.hot === o) return; b.hot = o; S.ctx.canvas.style.cursor = o ? 'pointer' : 'default'; },
    pointer(kind, e) {
      if (!b.active() || b.busy || !b.pages.R) return kind === 'down';
      if (kind === 'move') { const h = S.hitAny(e, b.hittable()); b.setHot(h && !h.root.userData.tab ? h.root : null); if (h && h.root.userData.tab) S.ctx.canvas.style.cursor = 'pointer'; return !!h; }
      if (kind === 'down') { if (e.button !== 0) return false; const h = S.hitAny(e, b.hittable()); if (!h) return false; const r = h.root;
        if (r.userData.tab) { b.clickTab(r.userData.tab); return true; }
        if (r.userData.turn) { b.turn(r.userData.turn); return true; }
        if (r.userData.pocket) { b.clickPocket(r.userData.pocket); return true; } return true; }
      return false;
    },
    key(e) { if (!b.active() || b.busy) return false; if (e.key === 'ArrowRight' || e.key === 'PageDown') { b.turn(1); return true; } if (e.key === 'ArrowLeft' || e.key === 'PageUp') { b.turn(-1); return true; } return false; },
    frame(dt) {
      if (!b.active()) return; const t = T.time();
      b.allPockets().forEach(pk => { const m = pk.acr.material, isHot = b.hot === pk.group, isPend = b.pending && b.pending.page === pk.page && b.pending.slot === pk.slot;
        const want = isPend ? 0.5 + 0.2 * Math.sin(t * 6) : isHot ? 0.35 : 0, op = isPend || isHot ? 0.42 : 0.2;
        m.emissiveIntensity = T.damp(m.emissiveIntensity, want, 12, dt); m.opacity = T.damp(m.opacity, op, 12, dt); });
    },
    /* ---------- pockets: inspect, move, onto the table ---------- */
    clickPocket(pk) {
      if (b.pick) { if (pk.obj && !pk.taken) b.pickPocket(pk); return; }
      if (b.pending) { if (b.pending.page === pk.page && b.pending.slot === pk.slot) { b.pending = null; S.sfx('detent'); S.toast('Left where it was.'); return; } b.swap(b.pending, pk); return; }
      if (!pk.obj) { S.toast('An empty pocket. Click a slab, then Move it, to put one here.'); return; }
      b.inspectPocket(pk);
    },
    /* pick mode: look closer, then choose it; a chosen slab leaves its pocket (the game takes it from there) */
    async pickPocket(pk) {
      const obj = pk.obj, g = obj.group, gen = b.gen, P = b.pick; b.setHot(null); S.sfx('detent'); S.ctx.hint(null);
      T.to(g.scale, { x: 1, y: 1, z: 1 }, { dur: 0.5, ease: T.E.outCubic, tag: 'binder' });
      const r = await S.inspect.open(obj, { actions: [{ id: 'back', label: 'Put back' }, { id: 'choose', label: P.label || 'Choose this one', primary: true }], hint: 'Drag to turn it, scroll to zoom.' });
      if (b.gen !== gen || pk.obj !== obj || b.pick !== P) return;
      T.to(g.scale, { x: pk.s, y: pk.s, z: pk.s }, { dur: 0.45, ease: T.E.inOutSine, tag: 'binder' });
      if (r !== 'choose') { S.ctx.hint(P.hint); return; }
      await T.wait(0.45); if (b.gen !== gen || b.pick !== P) return;
      pk.taken = true; g.updateMatrixWorld(true); const at = g.getWorldPosition(new THREE.Vector3()); g.visible = false;
      const more = P.choose(obj.slab, at); S.ctx.hint(P.hint);
      if (!more && S.M.is('binder.open')) S.M.go('binder.closing');
    },
    async inspectPocket(pk) {
      const obj = pk.obj, g = obj.group, gen = b.gen; b.setHot(null); S.sfx('detent'); S.ctx.hint(null);
      T.to(g.scale, { x: 1, y: 1, z: 1 }, { dur: 0.5, ease: T.E.outCubic, tag: 'binder' });
      const r = await S.inspect.open(obj, { actions: [{ id: 'back', label: 'Put back' }, { id: 'swap', label: 'Move it' }, { id: 'table', label: 'Onto the table', primary: true }], hint: 'Drag to turn it, scroll to zoom. Click the room to slide it back into its pocket.' });
      if (b.gen !== gen || pk.obj !== obj) return; S.ctx.hint(HINT);
      T.to(g.scale, { x: pk.s, y: pk.s, z: pk.s }, { dur: 0.45, ease: T.E.inOutSine, tag: 'binder' });
      if (r === 'swap') { b.pending = { page: pk.page, slot: pk.slot, id: pk.id }; S.toast('Now click the pocket to move it to. Click the same one to leave it.'); return; }
      if (r !== 'table') return;
      await T.wait(0.45); if (b.gen !== gen || pk.obj !== obj) return;
      const slab = obj.slab; S.slabs.drop(obj); pk.obj = null; pk.id = null;
      const sp = b.tableSpot(); S.table.place(slab, sp.x, sp.z, sp.yaw, { drop: true }); S.hud(); b.drawCover(); b.frameCam(true);
      S.toast('Onto the table, in front of the binder.');
    },
    /* a spot on the table in front of the open binder (the sequence board is hard against its right side), stepping along as more come out */
    tableSpot() { const ctx = S.ctx, W = (ctx.W_T || 40) / 2 - 1.6, Hh = (ctx.H_T || 24) / 2 - 1.6;
      /* the dark side: beside the binder prop, towards the middle and kept on the top (the light side's spot fell off its edge, under the table) */
      if (S.under && S.under.on && S.under.binderAt) { const p = S.under.binderAt(); if (p) { const len = Math.hypot(p.x, p.z) || 1, x1 = p.x - p.x / len * 3.2, z1 = p.z - p.z / len * 3.2;
        const n = S.table.list.filter(o => Math.abs(o.group.position.x - x1) < 3 && Math.abs(o.group.position.z - z1) < 3).length;
        return { x: Math.max(-W, Math.min(W, x1 + n * 0.45)), z: Math.max(-Hh, Math.min(Hh, z1 + n * 0.25)), yaw: (Math.random() - 0.5) * 0.3 }; } }
      const x0 = B.x + AX + 0.4, z0 = B.z + B.d / 2 + 2.9; const n = S.table.list.filter(o => Math.abs(o.group.position.x - x0) < 3 && Math.abs(o.group.position.z - z0) < 3).length; return { x: x0 + n * 0.45, z: z0 + n * 0.25, yaw: (Math.random() - 0.5) * 0.3 }; },
    /* swap two pockets (either may be empty): the store pages trade ids, the slabs lift, cross and land, then the pages redraw */
    async swap(from, to) {
      const pages = store.get().binder; while (pages.length <= Math.max(from.page, to.page)) pages.push(new Array(9).fill(null));
      const ia = pages[from.page][from.slot] || null, ib = pages[to.page][to.slot] || null; if (!ia) { b.pending = null; return; }
      pages[from.page][from.slot] = ib; pages[to.page][to.slot] = ia; store.save(); S.hud(); b.pending = null; b.setHot(null); b.busy = true; const gen = b.gen;
      const a = b.allPockets().find(pk => pk.page === from.page && pk.slot === from.slot);
      const fly = (g, dest) => { const p0 = g.position.clone(); return T.tween({ dur: 0.6, ease: T.E.inOutSine, tag: 'binder', update: e => { g.position.lerpVectors(p0, dest, e); g.position.y += Math.sin(Math.PI * e) * 0.7; } }); };
      S.sfx('lift');
      if (a && a.obj && to.obj) { const ga = a.obj.group, gb = to.obj.group, pa = ga.getWorldPosition(new THREE.Vector3()), pb = gb.getWorldPosition(new THREE.Vector3()); root.attach(ga); root.attach(gb); await T.par(fly(ga, root.worldToLocal(pb.clone())), fly(gb, root.worldToLocal(pa.clone()))); }
      else if (a && a.obj) { const ga = a.obj.group, pb = to.group.getWorldPosition(new THREE.Vector3()); pb.y += ga.position.y; root.attach(ga); await fly(ga, root.worldToLocal(pb)); }
      else await T.wait(0.2);
      if (b.gen !== gen) return; S.sfx('ltPutDown'); b.busy = false; b.loadSpread();
    },
  };
  return b;
}
