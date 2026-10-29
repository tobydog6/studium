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
  /* diamond plate skin, chrome trim, egg crate foam */
  const skinTex = (() => { const c = canvas(256, 256, (x, cv) => { x.fillStyle = '#17181c'; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(255,255,255,0.06)'; x.lineWidth = 1; for (let i = -256; i < 512; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 256, 256); x.stroke(); x.beginPath(); x.moveTo(i + 256, 0); x.lineTo(i, 256); x.stroke(); } }); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 4); return t; })();
  const foamTex = (() => { const c = canvas(512, 512, (x) => { x.fillStyle = '#141416'; x.fillRect(0, 0, 512, 512); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const cx = 32 + i * 64 + (j % 2) * 32, cy = 32 + j * 64; const gr = x.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, 30); gr.addColorStop(0, '#2a2a2e'); gr.addColorStop(0.6, '#161618'); gr.addColorStop(1, '#0c0c0e'); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, 30, 0, 7); x.fill(); } }); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t; })();
  const skin = new THREE.MeshStandardMaterial({ map: skinTex, color: 0x6a6a70, roughness: 0.5, metalness: 0.75, envMap: ENV, envMapIntensity: 0.5 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dadd, roughness: 0.25, metalness: 1, envMap: ENV, envMapIntensity: 1.3 });
  const foam = new THREE.MeshStandardMaterial({ map: foamTex, roughness: 1, metalness: 0 }), foamFlat = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 1 });
  const { w, d, h, lid } = CASE, wall = 0.22;
  const box = (W, H, D, m, x, y, z, p) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), m); mesh.position.set(x, y, z); (p || g).add(mesh); return mesh; };
  /* the base: a shell with the foam insert and four channels the slabs stand in */
  box(w, wall, d, skin, 0, wall / 2, 0); box(wall, h, d, skin, -w / 2 + wall / 2, h / 2, 0); box(wall, h, d, skin, w / 2 - wall / 2, h / 2, 0); box(w, h, wall, skin, 0, h / 2, d / 2 - wall / 2); box(w, h, wall, skin, 0, h / 2, -d / 2 + wall / 2);
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => { box(0.14, h + 0.02, 0.14, chrome, sx * (w / 2 - 0.07), h / 2, sz * (d / 2 - 0.07)); })); box(w + 0.02, 0.1, 0.14, chrome, 0, h - 0.05, d / 2 - 0.07); box(w + 0.02, 0.1, 0.14, chrome, 0, h - 0.05, -d / 2 + 0.07);
  const FOAM = 0.8, inner = box(w - wall * 2, FOAM, d - wall * 2, foamFlat, 0, FOAM / 2 + wall, 0);   /* a low foam bed the slabs stand in, so they show above the sides like the photo */
  const COLS = 4, cw = (w - wall * 2 - 0.5) / COLS; for (let i = 0; i <= COLS; i++) box(0.12, 0.3, d - wall * 2 - 0.3, foamFlat, -w / 2 + wall + 0.25 + i * cw, wall + FOAM + 0.15, 0);
  /* latches and the handle on the front, the lid hinged at the back with its foam */
  [-1, 1].forEach(sx => { box(1.0, 0.5, 0.12, chrome, sx * (w / 2 - 1.6), h * 0.55, d / 2 + 0.06); box(0.4, 0.22, 0.16, chrome, sx * (w / 2 - 1.6), h * 0.55 - 0.05, d / 2 + 0.1); });
  const handle = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.14, 10, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.6 })); handle.position.set(0, h * 0.5, d / 2 + 0.15); handle.rotation.set(Math.PI / 2, 0, 0); handle.scale.set(1, 1, 0.5); g.add(handle);
  const lidG = new THREE.Group(); lidG.position.set(0, h, -d / 2); lidG.rotation.x = -1.95; g.add(lidG);
  box(w, lid, d, skin, 0, lid / 2, d / 2, lidG); const fm = new THREE.Mesh(new THREE.PlaneGeometry(w - wall * 2, d - wall * 2), foam); fm.rotation.x = Math.PI / 2; fm.position.set(0, 0.02, d / 2); fm.rotation.z = 0; lidG.add(fm); fm.rotation.x = -Math.PI / 2; fm.position.y = -0.01;
  [-1, 1].forEach(sx => box(0.6, 0.14, 0.22, chrome, sx * (w / 2 - 1.6), lid - 0.07, d - 0.11, lidG));
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
