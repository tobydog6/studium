// SHELF: the standing acrylic display from Sam's photo: a black back, two clear tiers, a clear front door on hinges,
// six graded slabs standing in their slots leaning back, lit from the top. The store's display list, via rack.js.
import * as THREE from 'three';
import { makeRack } from './rack.js';

export const SHELF = { x: 15.0, z: -6.6, w: 9.0, h: 4.4, d: 2.2, max: 6, yaw: -0.5, tilt: -0.42 };   /* no door: a shelf, tilted back so the camera sees its face */   /* turned to face the middle */
export function install(S) {
  if (!S.under) return;
  const ENV = S.SM.envMap(S.renderer), parent = S.under.group, store = S.store, T = S.T;
  const d0 = store.get(); if (!d0.display) d0.display = [];
  const g = new THREE.Group(); g.position.set(SHELF.x, 0, SHELF.z); g.rotation.order = 'YXZ'; g.rotation.y = SHELF.yaw; g.rotation.x = SHELF.tilt; parent.add(g);
  const { w, h, d } = SHELF;
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.35, metalness: 0.1, envMap: ENV, envMapIntensity: 0.5 });
  const clear = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMap: ENV, envMapIntensity: 1.1, depthWrite: false, side: THREE.DoubleSide });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.2, metalness: 1, envMap: ENV, envMapIntensity: 1.2 });
  const box = (W, H, D, m, x, y, z, p) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), m); mesh.position.set(x, y, z); (p || g).add(mesh); return mesh; };
  /* the black box: back, sides, top and base; the tiers are clear */
  const back = box(w, h, 0.12, black, 0, h / 2, -d / 2 + 0.06); box(0.12, h, d, black, -w / 2 + 0.06, h / 2, 0); box(0.12, h, d, black, w / 2 - 0.06, h / 2, 0); box(w, 0.12, d, black, 0, h - 0.06, 0); box(w, 0.16, d, black, 0, 0.08, 0);
  const TIERS = [h * 0.54, 0.16]; TIERS.forEach(y => { const t = box(w - 0.24, 0.05, d - 0.24, clear, 0, y, 0); t.renderOrder = 5; t.userData.noParticles = true; const lip = box(w - 0.24, 0.16, 0.05, clear, 0, y + 0.08, d / 2 - 0.14); lip.renderOrder = 5; });
  const doorG = new THREE.Group(); g.add(doorG);   /* no door on a shelf */
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 0.1), new THREE.MeshBasicMaterial({ color: 0xffe9c4 })); strip.rotation.x = Math.PI / 2; strip.position.set(0, h - 0.13, d / 2 - 0.3); g.add(strip);
  const light = new THREE.SpotLight(0xfff0d8, 26, 12, 0.9, 0.5, 1.4); light.position.set(0, h - 0.2, d / 2 + 0.5); light.target.position.set(0, 0, 0); g.add(light); g.add(light.target);
  g.add(S.shadow(w + 1.2, d + 2));
  const C = { open: true, busy: false }; async function setOpen() {}
  /* six slots: three on each tier, the slab standing on the tier leaning back on the black */
  const K = 0.5, COLS = 3, cw = (w - 0.6) / COLS;
  const slotAt = i => ({ x: -w / 2 + 0.3 + ((i % COLS) + 0.5) * cw, y: TIERS[Math.floor(i / COLS) % 2] + 0.03, z: 0.1, ry: 0, rx: -0.16 });
  const rack = makeRack(S, { parent: g, K, peek: 0.5, closed: () => !C.open, accept: (slab, quiet) => { if (!slab.graded) { if (!quiet) S.toast('The shelf is for graded slabs.'); return false; } if (store.get().display.length >= SHELF.max) { if (!quiet) S.toast('The shelf is full. Take one out first.'); return false; } return true; },
    ids: () => store.get().display, add: (id, place) => { store.detach(id); const list = store.get().display; list.splice(Math.min(place ? place.idx : list.length, list.length), 0, id); store.save(); }, placeOf: id => { const i = store.get().display.indexOf(id); return i >= 0 ? { idx: i } : null; },
    bounds: [SHELF.x - w / 2 - 2.0, SHELF.z - d / 2 - 1.5, SHELF.x + w / 2 + 2.0, SHELF.z + d / 2 + 3.0],
    layout: entries => { const order = entries.filter(e => !e.ghost); const gh = entries.find(e => e.ghost); if (gh) order.splice(Math.min(gh.place.idx, order.length), 0, gh); const slots = new Array(entries.length); order.forEach((en, i) => { slots[entries.indexOf(en)] = slotAt(i); }); return slots; },
    target: (hit, obj) => { const lp = g.worldToLocal(new THREE.Vector3(hit.x, 0, hit.z)); const col = Math.max(0, Math.min(COLS - 1, Math.floor((lp.x + w / 2 - 0.3) / cw))); return { idx: col + (lp.z > 1.0 ? COLS : 0) }; } });
  S.dropPreviews.shelf = rack.preview;
  const shellHit = e => S.hitAny(e, [back, doorG]);
  S.shelf = { group: g, rack, frame: rack.frame, setOpen, isOpen: () => C.open,
    pointer(kind, e) { if (rack.pointer(kind, e)) return true; if (S.dragging()) return false; return !!(kind !== 'wheel' && shellHit(e)); } };
  S.dropTargets.shelf = rack.drop;
  rack.rebuild();
}
