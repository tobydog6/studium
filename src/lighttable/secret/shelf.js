// SHELF: the acrylic card display from Sam's photo, as close as materials get: a glossy black acrylic box, two clear
// tiers with slanted clear easels and a lip, a clear front door on two chrome hinges with screws at the corners, edge
// highlights on every sheet, its own lights. Six graded slabs stand on the easels. Click the shelf (not a slab) and the
// camera comes down to look at it face on; = or the bar takes you back. The store's display list, via rack.js.
import * as THREE from 'three';
import { makeRack } from './rack.js';

export const SHELF = { x: 15.0, z: -6.6, w: 9.0, h: 4.6, d: 2.0, max: 6, yaw: -0.5, tilt: -0.12 };
export function install(S) {
  if (!S.under) return;
  const ENV = S.SM.envMap(S.renderer), parent = S.under.group, store = S.store, T = S.T, M = S.M, RB = S.RoundedBoxGeometry, ctx = S.ctx;
  const d0 = store.get(); if (!d0.display) d0.display = [];
  const g = new THREE.Group(); g.position.set(SHELF.x, 0, SHELF.z); g.rotation.order = 'YXZ'; g.rotation.y = SHELF.yaw; g.rotation.x = SHELF.tilt; parent.add(g);
  const { w, h, d } = SHELF, t = 0.1;
  const black = new THREE.MeshPhysicalMaterial({ color: 0x050507, roughness: 0.14, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, envMap: ENV, envMapIntensity: 0.9 });
  const clear = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMap: ENV, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xf2f3f5, roughness: 0.12, metalness: 1, envMap: ENV, envMapIntensity: 1.6 });
  const edgeM = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
  const sheet = (W, H, D, x, y, z, p, order) => { const m = new THREE.Mesh(new RB(W, H, D, 2, Math.min(W, H, D) * 0.3), clear()); m.position.set(x, y, z); m.renderOrder = order || 5; m.userData.noParticles = true; (p || g).add(m); const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), edgeM); e.position.copy(m.position); e.renderOrder = (order || 5) + 1; (p || g).add(e); return m; };
  const box = (W, H, D, m, x, y, z, p, r) => { const mesh = new THREE.Mesh(r ? new RB(W, H, D, 2, r) : new THREE.BoxGeometry(W, H, D), m); mesh.position.set(x, y, z); (p || g).add(mesh); return mesh; };
  /* the black box: back, sides, top and base, rounded; the inside stays glossy black */
  const back = box(w, h, t, black, 0, h / 2, -d / 2 + t / 2, g, 0.03); box(t, h, d, black, -w / 2 + t / 2, h / 2, 0, g, 0.03); box(t, h, d, black, w / 2 - t / 2, h / 2, 0, g, 0.03); box(w, t, d, black, 0, h - t / 2, 0, g, 0.03); box(w, t * 1.6, d, black, 0, t * 0.8, 0, g, 0.03);
  /* two clear tiers, each with a front lip and three slanted easels the slabs lean on */
  const TIERS = [h * 0.52, t * 1.6], COLS = 3, cw = (w - 2 * t - 0.3) / COLS, LEAN = 0.26;
  TIERS.forEach(y => { sheet(w - 2 * t, 0.06, d - t - 0.1, 0, y + 0.03, 0.05); sheet(w - 2 * t, 0.26, 0.05, 0, y + 0.16, d / 2 - 0.2);
    for (let c = 0; c < COLS; c++) { const x = -w / 2 + t + 0.15 + (c + 0.5) * cw; const ez = new THREE.Group(); ez.position.set(x, y + 0.06, -d / 2 + t + 0.95); ez.rotation.x = -LEAN; g.add(ez); sheet(cw - 0.5, 1.9, 0.05, 0, 0.95, 0, ez, 4); sheet(cw - 0.5, 0.05, 0.3, 0, 0.0, 0.15, ez, 4); sheet(cw - 0.5, 0.14, 0.05, 0, 0.07, 0.3, ez, 4); } });
  /* the door: a clear sheet on two chrome hinges at the left, four screw heads, open a touch */
  const doorG = new THREE.Group(); doorG.position.set(-w / 2 + 0.05, 0, d / 2); g.add(doorG);
  sheet(w - 0.1, h - 0.06, 0.06, (w - 0.1) / 2, h / 2, 0.04, doorG, 7);
  [0.22, 0.78].forEach(k => { const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 16), chrome); hinge.position.set(0, h * k, 0.06); doorG.add(hinge); box(0.2, 0.42, 0.04, chrome, 0.1, h * k, 0.08, doorG); box(0.04, 0.42, 0.2, chrome, -0.02, h * k, -0.08, g); });
  [[0.35, 0.3], [w - 0.45, 0.3], [0.35, h - 0.35], [w - 0.45, h - 0.35]].forEach(([x, y]) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), chrome); s.rotation.x = Math.PI / 2; s.position.set(x, y, 0.09); doorG.add(s); });
  const DOOR_A = -0.42; doorG.rotation.y = DOOR_A;   /* open towards the front (a positive angle swung it back through the box) */
  /* light: a cool strip along the top inside and two warm points in front */
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.6, 0.08), new THREE.MeshBasicMaterial({ color: 0xe8f0ff })); strip.rotation.x = Math.PI / 2; strip.position.set(0, h - t - 0.01, d / 2 - 0.35); g.add(strip);
  const l1 = new THREE.PointLight(0xfff0dc, 30, 14, 1.6); l1.position.set(-2.5, h + 0.8, d + 2.2); g.add(l1); const l2 = new THREE.PointLight(0xdfe8ff, 22, 14, 1.6); l2.position.set(2.5, h * 0.4, d + 2.6); g.add(l2);
  g.add(S.shadow(w + 1.2, d + 2));
  /* six slots on the easels */
  const K = 0.46;
  const slotAt = i => { const row = Math.floor(i / COLS) % 2, c = i % COLS; return { x: -w / 2 + t + 0.15 + (c + 0.5) * cw, y: TIERS[row] + 0.1, z: -d / 2 + t + 0.95 + 0.1, ry: 0, rx: -LEAN }; };
  const rack = makeRack(S, { parent: g, K, peek: 0.45, accept: (slab, quiet) => { if (!slab.graded) { if (!quiet) S.toast('The shelf is for graded slabs.'); return false; } if (store.get().display.length >= SHELF.max) { if (!quiet) S.toast('The shelf is full. Take one out first.'); return false; } return true; },
    ids: () => store.get().display, add: (id, place) => { store.detach(id); const list = store.get().display; list.splice(Math.min(place ? place.idx : list.length, list.length), 0, id); store.save(); }, placeOf: id => { const i = store.get().display.indexOf(id); return i >= 0 ? { idx: i } : null; },
    bounds: [SHELF.x - w / 2 - 2.0, SHELF.z - d / 2 - 1.5, SHELF.x + w / 2 + 2.0, SHELF.z + d / 2 + 3.0],
    layout: entries => { const order = entries.filter(e => !e.ghost); const gh = entries.find(e => e.ghost); if (gh) order.splice(Math.min(gh.place.idx, order.length), 0, gh); const slots = new Array(entries.length); order.forEach((en, i) => { slots[entries.indexOf(en)] = slotAt(i); }); return slots; },
    over: e => !!S.hitAny(e, [g]),
    target: (hit, obj, e) => { const sh = e && S.hitAny(e, [g]); if (sh) { const q = g.worldToLocal(sh.point.clone()); const col = Math.max(0, Math.min(COLS - 1, Math.floor((q.x + w / 2 - t - 0.15) / cw))); return { idx: col + (q.y < TIERS[0] ? COLS : 0) }; }
      const lp = g.worldToLocal(new THREE.Vector3(hit.x, 0, hit.z)); const col = Math.max(0, Math.min(COLS - 1, Math.floor((lp.x + w / 2 - t - 0.15) / cw))); return { idx: col + (lp.z > 1.0 ? COLS : 0) }; } });
  S.dropPreviews.shelf = rack.preview;
  /* the look: the camera comes down in front of the shelf; CLOSE (=, the bar) goes back up */
  const FRAME = () => { const c = new THREE.Vector3(0, h * 0.5, d / 2); g.localToWorld(c); return { tx: c.x, ty: c.y - 0.2, tz: c.z + 0.4, pitch: 14, dT: ctx.fitDist(w + 2.5, h + 1.2, 14) }; };
  let pushed = false;
  M.define('shelf.view', {
    enter() { if (!pushed) { S.cam.push(); pushed = true; } S.cam.set(FRAME()); ctx.hideActs(); S.toast('Your six. Drag one off, or click one to look closer.'); },
    exit(next) { if (pushed && !/^shelf/.test(next)) { S.cam.pop(); pushed = false; } },
    on: { CLOSE: () => 'under' },
    pointer(kind, e) { if (S.shelf.pointer(kind, e)) return true; if (S.tablePointer(kind, e, S.table.list.map(o => o.group))) return true; return kind !== 'wheel'; },
    key() { return true; },
    frame(dt) { rack.frame(dt); },
  });
  const shellHit = e => S.hitAny(e, [back, doorG]);
  S.shelf = { group: g, rack, frame: rack.frame, view: () => { if (M.is('under')) M.go('shelf.view'); },
    pointer(kind, e) { if (rack.pointer(kind, e)) return true; if (S.dragging()) return false; if (kind === 'move') { const hh = shellHit(e); if (hh) S.ctx.canvas.style.cursor = 'pointer'; return !!hh; } if (kind === 'down' && e.button === 0 && shellHit(e)) { if (M.is('under')) M.go('shelf.view'); return true; } return false; } };
  S.dropTargets.shelf = rack.drop;
  rack.rebuild();
}
