// VITRINE: the glass top display case from Sam's photo: a shallow brushed aluminium case, black felt inside, the clear
// acrylic lid hinged along the back and propped open. Up to eight slabs lie in it, leaning back a touch; drag one in,
// pull one out, click to look closer. The store's display list, via rack.js.
import * as THREE from 'three';
import { makeRack } from './rack.js';

export const VIT = { x: 14.5, z: -6.2, w: 10.5, d: 7.2, h: 0.9, max: 8 };
export function install(S) {
  if (!S.under) return;
  const ENV = S.SM.envMap(S.renderer), parent = S.under.group, store = S.store, RB = S.RoundedBoxGeometry;
  const d0 = store.get(); if (!d0.display) d0.display = [];
  const g = new THREE.Group(); g.position.set(VIT.x, 0, VIT.z); parent.add(g);
  const { w, d, h } = VIT, wall = 0.16;
  const alu = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.38, metalness: 0.9, envMap: ENV, envMapIntensity: 0.9 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.18, metalness: 1, envMap: ENV, envMapIntensity: 1.3 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 1, metalness: 0 });
  const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMap: ENV, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide });
  const box = (W, H, D, m, x, y, z, p, r) => { const mesh = new THREE.Mesh(r ? new RB(W, H, D, 2, r) : new THREE.BoxGeometry(W, H, D), m); mesh.position.set(x, y, z); (p || g).add(mesh); return mesh; };
  /* the base: aluminium shell, felt floor, rounded edge rails, latches and a handle on the front */
  box(w, h, d, alu, 0, h / 2, 0, g, 0.08); box(w - wall * 2, 0.04, d - wall * 2, felt, 0, h - 0.02, 0);
  [-1, 1].forEach(s => box(w + 0.04, 0.1, 0.1, chrome, 0, h, s * d / 2, g, 0.04)); [-1, 1].forEach(s => box(0.1, 0.1, d + 0.04, chrome, s * w / 2, h, 0, g, 0.04));
  [-1, 1].forEach(sx => box(0.7, 0.32, 0.12, chrome, sx * (w / 2 - 1.8), h * 0.5, d / 2 + 0.06, g, 0.03));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.09, 10, 40, Math.PI), chrome); handle.position.set(0, h * 0.5, d / 2 + 0.1); handle.rotation.set(Math.PI / 2, 0, 0); handle.scale.set(1, 1, 0.45); g.add(handle);
  /* the lid: an aluminium frame round a clear panel, hinged at the back, held open by a prop arm */
  const lidG = new THREE.Group(); lidG.position.set(0, h, -d / 2); lidG.rotation.x = -0.62; g.add(lidG);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.06, d - 0.3), acrylic); panel.position.set(0, 0.06, d / 2); panel.renderOrder = 6; panel.userData.noParticles = true; lidG.add(panel);
  [-1, 1].forEach(s => box(w, 0.12, 0.16, alu, 0, 0.06, d / 2 + s * (d / 2 - 0.08), lidG, 0.04)); [-1, 1].forEach(s => box(0.16, 0.12, d, alu, s * (w / 2 - 0.08), 0.06, d / 2, lidG, 0.04));
  [-1, 1].forEach(sx => box(0.5, 0.2, 0.14, chrome, sx * (w / 2 - 1.8), 0.1, d - 0.05, lidG, 0.03));
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 10), chrome); arm.position.set(w / 2 - 0.5, h + 1.0, -d / 2 + 1.2); arm.rotation.x = 0.75; g.add(arm);
  const spot = new THREE.SpotLight(0xfff2dc, 22, 16, 0.75, 0.6, 1.5); spot.position.set(0, 7, 2); spot.target.position.set(0, h, 0); g.add(spot); g.add(spot.target);
  g.add(S.shadow(w + 1.5, d + 1.5));
  /* two rows of four, lying back on the felt */
  const K = 0.5, COLS = 4, cw = (w - wall * 2 - 0.4) / COLS, rowZ = [d / 2 - wall - 2.1, -d / 2 + wall + 1.3];
  const rack = makeRack(S, { parent: g, K, peek: 0.6, accept: slab => { if (!slab.graded) { S.toast('The display is for graded slabs.'); return false; } if (store.get().display.length >= VIT.max) { S.toast('The display is full. Take one out first.'); return false; } return true; },
    ids: () => store.get().display, add: id => { store.detach(id); store.get().display.push(id); store.save(); },
    bounds: [VIT.x - w / 2 - 0.8, VIT.z - d / 2 - 0.8, VIT.x + w / 2 + 0.8, VIT.z + d / 2 + 0.8],
    slot: (i, n) => { const col = i % COLS, row = Math.floor(i / COLS) % 2; return { x: -w / 2 + wall + 0.2 + (col + 0.5) * cw, y: h - 0.02, z: rowZ[row], ry: 0, rx: -1.15 }; } });
  S.vitrine = { group: g, rack, pointer: rack.pointer, frame: rack.frame };
  S.dropTargets.vitrine = rack.drop;
  rack.rebuild();
}
