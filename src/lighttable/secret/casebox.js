// CASEBOX: the black aluminium case, open on the dark side, top left: egg crate foam in the lid, four rows of slabs
// standing in the base (Sam's photo). The slabs are the store's vault list, handled by rack.js.
import * as THREE from 'three';
import { makeRack } from './rack.js';

export const CASE = { x: -14.5, z: -6.2, w: 10.5, d: 7.2, h: 2.4, lid: 1.1 };
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
  const { w, d, h, lid } = CASE, wall = 0.22, rr = 0.14;
  const RB = S.RoundedBoxGeometry;
  const box = (W, H, D, m, x, y, z, p, r) => { const mesh = new THREE.Mesh(r ? new RB(W, H, D, 2, r) : new THREE.BoxGeometry(W, H, D), m); mesh.position.set(x, y, z); (p || g).add(mesh); return mesh; };
  /* the base: a rounded shell with a well in it, ribs down the sides, feet underneath */
  box(w, h * 0.55, d, shell, 0, h * 0.275, 0, g, rr);
  [-1, 1].forEach(s => box(w, h * 0.45, wall, shell, 0, h * 0.55 + h * 0.225, s * (d / 2 - wall / 2), g, 0.04)); [-1, 1].forEach(s => box(wall, h * 0.45, d - wall * 2, shell, s * (w / 2 - wall / 2), h * 0.55 + h * 0.225, 0, g, 0.04));
  [-1, 1].forEach(sx => [2.2, 3.4, 4.6].forEach(x => box(0.16, h * 0.5, d + 0.06, rib, sx * x, h * 0.275, 0, g, 0.03)));
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => box(0.7, 0.12, 0.7, RUBBER, sx * (w / 2 - 0.7), -0.05, sz * (d / 2 - 0.7), g, 0.03)));
  [-1, 1].forEach(sx => { box(1.1, 0.42, 0.14, GRAPHITE, sx * (w / 2 - 1.9), h * 0.6, d / 2 + 0.07, g, 0.03); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 24), GRAPHITE); ring.position.set(sx * (w / 2 - 1.9), h * 0.6 + 0.1, d / 2 + 0.14); g.add(ring); });
  const handle = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.13, 10, 40, Math.PI), RUBBER); handle.position.set(0, h * 0.5, d / 2 + 0.12); handle.rotation.set(Math.PI / 2, 0, 0); handle.scale.set(1, 1, 0.5); g.add(handle);
  /* the foam bed the slabs stand in, with channel walls between the columns */
  const FOAM = 0.8; box(w - wall * 2, FOAM, d - wall * 2, foamFlat, 0, FOAM / 2 + wall, 0);
  const COLS = 4, cw = (w - wall * 2 - 0.5) / COLS; for (let i = 0; i <= COLS; i++) box(0.12, 0.3, d - wall * 2 - 0.3, foamFlat, -w / 2 + wall + 0.25 + i * cw, wall + FOAM + 0.15, 0);
  /* the lid: ribbed, hinged along the back, egg crate foam inside, a stencil on top */
  const lidG = new THREE.Group(); lidG.position.set(0, h, -d / 2); lidG.rotation.x = -1.95; g.add(lidG);
  box(w, lid, d, shell, 0, lid / 2, d / 2, lidG, rr); for (let i = -2; i <= 2; i++) box(w + 0.06, 0.1, 0.16, rib, 0, lid + 0.02, d / 2 + i * 1.1, lidG, 0.03);
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(w - wall * 2, d - wall * 2), foam); fm.rotation.x = Math.PI / 2; fm.position.set(0, -0.012, d / 2); lidG.add(fm);
  const lab = canvas(512, 160, (x) => { x.fillStyle = '#1a1200'; x.fillRect(0, 0, 512, 160); x.fillStyle = '#e3ad57'; x.font = '700 64px "Geist", sans-serif'; x.textAlign = 'center'; x.fillText('STUDIUM', 256, 78); x.font = '500 26px "Geist Mono", monospace'; x.fillText('GRADED · KEEP DRY', 256, 124); });
  const stencil = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), new THREE.MeshBasicMaterial({ map: S.SM.tex(lab) })); stencil.rotation.x = -Math.PI / 2; stencil.position.set(w / 2 - 2.2, lid + 0.075, 1.4); lidG.add(stencil);
  g.add(S.shadow(w + 1.5, d + 1.5));
  /* the rack: four columns, slabs standing in each, from the front of the case back */
  const K = 0.5, pitch = 0.24, perCol = Math.floor((d - wall * 2 - 0.5) / pitch);
  const rack = makeRack(S, { parent: g, K, peek: 1.0, accept: slab => slab.graded, ids: () => S.store.get().vault, add: id => S.store.toVault(id),
    bounds: [CASE.x - w / 2 - 0.8, CASE.z - d / 2 - 0.8, CASE.x + w / 2 + 0.8, CASE.z + d / 2 + 0.8],
    slot: (i, n) => { const col = i % COLS, row = Math.floor(i / COLS); return { x: -w / 2 + wall + 0.25 + (col + 0.5) * cw, y: wall + FOAM - 0.35, z: d / 2 - wall - 0.5 - row * pitch, ry: 0, rx: -0.12 }; } });
  S.caseBox = { group: g, rack, rebuild: () => rack.rebuild(), pointer: rack.pointer, frame: rack.frame };
  S.dropTargets.caseBox = rack.drop;
  rack.rebuild();
  S.dev.info(() => 'case holds ' + (COLS * perCol) + ' · ' + S.store.get().vault.length + ' in it');
}
