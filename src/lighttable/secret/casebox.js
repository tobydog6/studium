// CASEBOX: the black aluminium case, open on the dark side, top left: egg crate foam in the lid, four rows of slabs
// standing in the base (Sam's photo). The slabs are the store's vault list, handled by rack.js.
import * as THREE from 'three';
import { makeRack } from './rack.js';

export const CASE = { x: -14.5, z: -6.5, w: 7.4, d: 4.8, h: 2.9, lid: 1.7, well: 0.9 };   /* the vault's case (3.3 × 2.3 × 1.45) doubled: higher, not wider */
export function install(S) {
  if (!S.under) return;
  const { T } = S, ENV = S.SM.envMap(S.renderer), parent = S.under.group;
  const g = new THREE.Group(); g.position.set(CASE.x, 0, CASE.z); parent.add(g);
  const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), c); return c; };
  /* the shell Sam liked from the vault: ribbed matte polymer, graphite hardware, rubber feet; the egg crate foam in the lid */
  const foamTex = (() => { const c = canvas(512, 512, (x) => { x.fillStyle = '#141416'; x.fillRect(0, 0, 512, 512); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const cx = 32 + i * 64 + (j % 2) * 32, cy = 32 + j * 64; const gr = x.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, 30); gr.addColorStop(0, '#2a2a2e'); gr.addColorStop(0.6, '#161618'); gr.addColorStop(1, '#0c0c0e'); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, 30, 0, 7); x.fill(); } }); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t; })();
  const stdM = (c, r, m, o) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, envMap: ENV, envMapIntensity: m > 0.3 ? 0.9 : 0.3, ...(o || {}) });
  const shell = stdM(0x2a2b2e, 0.62, 0.12), rib = stdM(0x111111, 0.9, 0), GRAPHITE = stdM(0x4a4c50, 0.5, 0.75), RUBBER = stdM(0x111111, 0.95, 0);
  const foam = new THREE.MeshStandardMaterial({ map: foamTex, roughness: 1, metalness: 0 }), foamFlat = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 1 });
  const { w, d, h, lid, well } = CASE, wall = 0.14, rr = 0.2;
  const RB = S.RoundedBoxGeometry;
  const box = (W, H, D, m, x, y, z, p, r) => { const mesh = new THREE.Mesh(r ? new RB(W, H, D, 2, r) : new THREE.BoxGeometry(W, H, D), m); mesh.position.set(x, y, z); (p || g).add(mesh); return mesh; };
  /* the body: a solid lower half and four thin walls round the well, like the vault's case */
  const shellMesh = box(w, h - well, d, shell, 0, (h - well) / 2, 0, g, rr);
  [-1, 1].forEach(s => box(w, well, wall, shell, 0, h - well / 2, s * (d / 2 - wall / 2), g, 0.04)); [-1, 1].forEach(s => box(wall, well, d - wall * 2, shell, s * (w / 2 - wall / 2), h - well / 2, 0, g, 0.04));
  [-1, 1].forEach(sx => [2.1, 2.86].forEach(x => box(0.22, h - well - 0.3, d + 0.1, rib, sx * x, (h - well) / 2, 0, g, 0.05)));
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => box(0.9, 0.16, 0.9, RUBBER, sx * (w / 2 - 0.9), -0.07, sz * (d / 2 - 0.9), g, 0.04)));
  [-1, 1].forEach(sx => { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 24), GRAPHITE); ring.position.set(sx * 3.0, h + 0.04, d / 2 + 0.04); g.add(ring); });
  /* the foam bed: three columns cut for portrait slabs and one wider bay for landscape ones, a groove per spot */
  const FOAM = 0.5; box(w - wall * 2, FOAM, d - wall * 2, foamFlat, 0, h - well + FOAM / 2, 0);
  const K = 0.42, PW = 2.95 * K, LW = 4.35 * K, pitch = 0.2, inner = w - wall * 2 - 0.2, LANDW = LW + 0.24, PCOL = (inner - LANDW) / 3;
  const colX = c => -w / 2 + wall + 0.1 + (c < 3 ? (c + 0.5) * PCOL : 3 * PCOL + LANDW / 2);
  const colW = c => c < 3 ? PCOL : LANDW, perCol = Math.floor((d - wall * 2 - 0.4) / pitch), zAt = i => d / 2 - wall - 0.35 - i * pitch;
  [1, 2, 3].forEach(c => box(0.08, 0.3, d - wall * 2 - 0.16, foamFlat, -w / 2 + wall + 0.1 + c * PCOL, h - well + FOAM + 0.15, 0));
  const grooveM = new THREE.MeshBasicMaterial({ color: 0x050506 }); for (let c = 0; c < 4; c++) for (let i = 0; i < perCol; i++) { const gm = new THREE.Mesh(new THREE.PlaneGeometry(colW(c) - 0.14, 0.05), grooveM); gm.rotation.x = -Math.PI / 2; gm.position.set(colX(c), h - well + FOAM + 0.002, zAt(i)); g.add(gm); }
  /* the lid: ribbed, a rubber handle and graphite catches, the egg crate foam inside, the stencil on top */
  const lidG = new THREE.Group(); lidG.position.set(0, h, -d / 2); g.add(lidG);
  box(w, lid, d, shell, 0, lid / 2, d / 2, lidG, rr); for (let i = -2; i <= 2; i++) box(w + 0.12, 0.18, 0.28, rib, 0, lid + 0.04, d / 2 + i * 0.84, lidG, 0.05);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 10, 40, Math.PI), RUBBER); handle.position.set(0, lid + 0.1, d / 2); handle.rotation.x = -Math.PI / 2; lidG.add(handle); [-1, 1].forEach(sx => box(0.32, 0.24, 0.4, GRAPHITE, sx * 1.1, lid + 0.08, d / 2, lidG, 0.05));
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(w - wall * 2, d - wall * 2), foam); fm.rotation.x = Math.PI / 2; fm.position.set(0, -0.012, d / 2); lidG.add(fm);
  const lab = canvas(512, 160, (x) => { x.fillStyle = '#1a1200'; x.fillRect(0, 0, 512, 160); x.fillStyle = '#e3ad57'; x.font = '700 64px "Geist", sans-serif'; x.textAlign = 'center'; x.fillText('STUDIUM', 256, 78); x.font = '500 26px "Geist Mono", monospace'; x.fillText('GRADED · KEEP DRY', 256, 124); });
  const stencil = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.62), new THREE.MeshBasicMaterial({ map: S.SM.tex(lab) })); stencil.rotation.x = -Math.PI / 2; stencil.position.set(1.7, lid + 0.14, 1.3); lidG.add(stencil);
  const perColInfo = () => perCol;
  /* open and shut: click the case (not a slab) to swing the lid; the rows show only while it is open */
  const C = { open: true, busy: false, lidA: -1.95 }; lidG.rotation.x = C.lidA;
  async function setOpen(on) { if (C.busy || C.open === on) return; C.busy = true; C.open = on; S.sfx(on ? 'kitOpen' : 'kitClose'); if (on) rackGroup().visible = true;
    await T.tween({ dur: 0.7, ease: on ? T.E.outCubic : T.E.inCubic, update: e => { lidG.rotation.x = C.lidA * (on ? e : 1 - e); } }); if (!on) rackGroup().visible = false; C.busy = false; }
  const rackGroup = () => rack.group;
  g.add(S.shadow(w + 1.5, d + 1.5));
  /* the rack: a slab's place is its column and its spot from the front; store.caseCols keeps it, newcomers go where they fit */
  const cols = () => { const dd = S.store.get(); if (!dd.caseCols) dd.caseCols = [[], [], [], []]; return dd.caseCols; };
  const placeOf = id => { const cc = cols(); for (let c = 0; c < 4; c++) { const i = cc[c].indexOf(id); if (i >= 0) return { col: c, idx: i }; } return null; };
  const autoCol = land => { if (land) return 3; const cc = cols(); let best = 0; for (let c = 1; c < 3; c++) if (cc[c].length < cc[best].length) best = c; return best; };
  const add = (id, place) => { const cc = cols(); cc.forEach(c => { const i = c.indexOf(id); if (i >= 0) c.splice(i, 1); }); const col = place ? place.col : 0; cc[col].splice(Math.min(place ? place.idx : cc[col].length, cc[col].length), 0, id); S.store.toVault(id); S.store.get().caseCols = cc; S.store.save(); };
  const layout = entries => {
    /* each entry's column: its stored place, else where it fits; the ghost takes its wished spot and the rest shuffle back */
    const byCol = [[], [], [], []]; entries.forEach(en => { let pl = en.place; if (!pl || (en.land && pl.col !== 3) || (!en.land && pl.col === 3)) { pl = { col: autoCol(en.land), idx: 1e9 }; if (!en.ghost) { en.place = pl; } } byCol[pl.col].push({ en, idx: pl.idx }); });
    const slots = new Array(entries.length);
    byCol.forEach((list, c) => { list.sort((a, b) => a.idx - b.idx || (a.en.ghost ? 1 : 0) - (b.en.ghost ? 1 : 0)); const ghost = list.find(x => x.en.ghost); const others = list.filter(x => !x.en.ghost); const order = []; others.forEach(x => order.push(x)); if (ghost) order.splice(Math.min(ghost.idx, order.length), 0, ghost);
      order.forEach((x, i) => { if (!x.en.ghost) x.en.place = { col: c, idx: i }; slots[entries.indexOf(x.en)] = { x: colX(c), y: h - well + FOAM - 0.26, z: zAt(Math.min(i, perCol - 1)), roll: !!x.en.land, rx: -0.1 }; }); });
    /* a landscape slab stands on its side in the wide bay (rolled), its photo still facing the front */
    return slots; };
  const target = (hit, obj) => { const lx = hit.x - CASE.x, lz = hit.z - CASE.z; const land = !!obj.land; let col = land ? 3 : Math.max(0, Math.min(2, Math.floor((lx + w / 2 - wall - 0.1) / PCOL))); const idx = Math.max(0, Math.round((d / 2 - wall - 0.35 - lz) / pitch)); return { col, idx }; };
  const rack = makeRack(S, { parent: g, K, peek: 1.1, closed: () => !C.open, accept: slab => { if (!slab.graded) { S.toast('The case is for graded slabs. Send this one away for grading first.'); return false; } return true; }, ids: () => S.store.get().vault, add, placeOf, remove: id => { const cc = cols(); cc.forEach(c => { const i = c.indexOf(id); if (i >= 0) c.splice(i, 1); }); S.store.save(); },
    bounds: [CASE.x - w / 2 - 0.8, CASE.z - d / 2 - 0.8, CASE.x + w / 2 + 0.8, CASE.z + d / 2 + 0.8], layout, target });
  S.dropPreviews.caseBox = rack.preview;
  const shellHit = e => S.hitAny(e, [shellMesh, lidG]);
  S.caseBox = { group: g, rack, rebuild: () => rack.rebuild(), frame: rack.frame, setOpen, isOpen: () => C.open,
    pointer(kind, e) { if (rack.pointer(kind, e)) return true; if (S.dragging()) return false; if (kind === 'move') { const hh = shellHit(e); if (hh) S.ctx.canvas.style.cursor = 'pointer'; return !!hh; } if (kind === 'down' && e.button === 0 && shellHit(e)) { setOpen(!C.open); return true; } return false; } };
  S.dropTargets.caseBox = rack.drop;
  rack.rebuild();
  S.dev.info(() => 'case holds ' + (4 * perCol) + ' · ' + S.store.get().vault.length + ' in it');
}
