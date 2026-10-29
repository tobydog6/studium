// VITRINE: a glass display case on the dark side, top right, for the ones you are proudest of. Up to six slabs stand on
// a lit plinth under the glass; drag one in, pull one out, click to look closer. The store's display list, via rack.js.
import * as THREE from 'three';
import { makeRack } from './rack.js';

export const VIT = { x: 14.5, z: -6.2, w: 9.5, d: 4.2, h: 3.4, max: 6 };
export function install(S) {
  if (!S.under) return;
  const ENV = S.SM.envMap(S.renderer), parent = S.under.group, store = S.store;
  const d0 = store.get(); if (!d0.display) d0.display = [];
  const g = new THREE.Group(); g.position.set(VIT.x, 0, VIT.z); parent.add(g);
  const { w, d, h } = VIT;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), new THREE.MeshStandardMaterial({ color: 0x0e0e11, roughness: 0.25, metalness: 0.5, envMap: ENV, envMapIntensity: 0.8 })); plinth.position.y = 0.25; g.add(plinth);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.06, d + 0.1), new THREE.MeshStandardMaterial({ color: 0xc9a85a, roughness: 0.3, metalness: 1, envMap: ENV, envMapIntensity: 1.2 })); trim.position.y = 0.5; g.add(trim);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, h, d - 0.3), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.02, metalness: 0, transmission: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMap: ENV, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide })); glass.position.y = 0.5 + h / 2; glass.renderOrder = 6; glass.userData.noParticles = true; g.add(glass);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })); edges.position.copy(glass.position); g.add(edges);
  const light = new THREE.SpotLight(0xfff2dc, 28, 14, 0.7, 0.6, 1.5); light.position.set(0, h + 2.5, 1.5); light.target.position.set(0, 0.5, 0); g.add(light); g.add(light.target);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.6, 0.12), new THREE.MeshBasicMaterial({ color: 0x8a7a5a })); strip.rotation.x = Math.PI / 2; strip.position.set(0, 0.5 + h - 0.02, d / 2 - 0.5); g.add(strip);
  g.add(S.shadow(w + 1.5, d + 1.5));
  const K = 0.55, rack = makeRack(S, { parent: g, K, peek: 0.7, accept: slab => { if (!slab.graded) { S.toast('The display is for graded slabs.'); return false; } if (store.get().display.length >= VIT.max) { S.toast('The display is full. Take one out first.'); return false; } return true; },
    ids: () => store.get().display, add: id => { store.detach(id); store.get().display.push(id); store.save(); },
    bounds: [VIT.x - w / 2 - 0.8, VIT.z - d / 2 - 0.8, VIT.x + w / 2 + 0.8, VIT.z + d / 2 + 0.8],
    slot: (i, n) => { const span = Math.min(w - 2.2, Math.max(1, n - 1) * 1.45); return { x: n === 1 ? 0 : -span / 2 + i * span / Math.max(1, n - 1), y: 0.5, z: 0.2 + (i % 2) * 0.5, ry: (i - (n - 1) / 2) * -0.12, rx: -0.1 }; } });
  S.vitrine = { group: g, rack, pointer: rack.pointer, frame: rack.frame };
  S.dropTargets.vitrine = rack.drop;
  rack.rebuild();
}
