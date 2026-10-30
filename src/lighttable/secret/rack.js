// RACK: rows of slabs that live in a prop on the dark side (the case, the shelf). One rack = one id list in the store.
// Hover peeks a slab up, a press and pull takes it out onto the table in your hand, a still click looks closer
// (Put back · Into the binder · Onto the table). While you drag a slab over the prop the others part to show where it
// will go and a ghost marks the spot; let go and it slides in.
//   makeRack(S, { ids(), add(id, place), bounds, layout(entries) → slots, target(hit, obj) → place, K, parent, peek, closed(), accept(slab) })
//   entries are { id, obj, land, place }; a slot is { x, y, z, ry, rx }; the ghost entry carries ghost: true.
import * as THREE from 'three';

export function makeRack(S, o) {
  const { T, M, store } = S, E = T.E, K = o.K || 0.5, peek = o.peek ?? 0.9;
  const group = new THREE.Group(); (o.parent || S.scene).add(group);
  const R = { group, slabs: [], hover: null, press: null, busy: false, gen: 0, ghost: null, ghostFor: null };
  function dispose() { R.slabs.forEach(s => { S.slabs.drop(s.obj); if (s.pivot.parent) s.pivot.parent.remove(s.pivot); }); R.slabs = []; R.hover = null; }
  const entries = (ghost) => { const list = R.slabs.map(s => ({ id: s.id, obj: s.obj, land: !!s.obj.land, place: s.place, s })); if (ghost) list.push(ghost); return list; };
  function applySlots(list, slots, animate, dropIn) { list.forEach((en, i) => { const p = slots[i]; if (!p || !en.s) return; const s = en.s; s.base = p; s.place = en.place; s.pivot.rotation.set(p.rx || 0, p.ry || 0, 0);
    /* a landscape slab can stand on its side (roll): its width becomes its height */
    if (p.roll) { s.obj.group.rotation.z = Math.PI / 2; s.obj.group.position.set(0, s.obj.w * K / 2, 0); } else { s.obj.group.rotation.z = 0; s.obj.group.position.set(0, s.obj.h * K / 2, 0); }
    if (!animate) { s.y = p.y; s.pivot.position.set(p.x, p.y, p.z); }
    else if (dropIn === s.id) { s.pivot.position.set(p.x, p.y, p.z); s.y = p.y + 1.6; T.to(s, { y: p.y }, { dur: 0.55, ease: E.outCubic }); setTimeout(() => S.sfx('ltPutDown'), 350); }
    else { T.to(s.pivot.position, { x: p.x, z: p.z }, { dur: 0.28, ease: E.outCubic, tag: 'rack' }); s.y = p.y; } s.pivot.visible = true; }); }
  /* every slab in the list, placed by layout(); a newcomer (dropIn) arrives from above */
  async function rebuild(dropIn) {
    const gen = ++R.gen; dispose(); const ids = o.ids(), list = [];
    ids.forEach((id, i) => { const slab = store.pull(id); if (!slab) return; const obj = S.objFor(slab); const pivot = new THREE.Group(); pivot.visible = false; obj.group.scale.setScalar(K); pivot.add(obj.group); group.add(pivot); list.push({ obj, pivot, slab, id, i, y: 0, hoverT: 0, place: o.placeOf ? o.placeOf(id) : null }); });
    R.slabs = list; await Promise.all(list.map(s => s.obj.ready.catch(() => null))); if (gen !== R.gen) return;
    list.forEach(s => { s.obj.group.position.set(0, s.obj.h * K / 2, 0); });
    const en = entries(null), slots = o.layout(en); applySlots(en, slots, !!dropIn, dropIn);
  }
  function groups() { return R.slabs.map(s => s.obj.group); }
  function find(h) { return h ? R.slabs.find(s => s.obj.group === h.root) : null; }
  function takeOut(s, e) { const slab = s.slab; S.slabs.drop(s.obj); if (s.pivot.parent) s.pivot.parent.remove(s.pivot); R.slabs = R.slabs.filter(x => x !== s); R.hover = null; if (o.remove) o.remove(slab.id);
    const t = S.tableHit(e, 0) || { x: 0, z: 0 }; const obj = S.table.place(slab, t.x, t.z, 0, { quiet: true }); S.sfx('lift'); S.beginSlabDrag(obj, e); const en = entries(null); applySlots(en, o.layout(en), true); }
  async function look(s) {
    if (R.busy) return; R.busy = true; const g = s.obj.group, k0 = g.scale.x; R.hover = null;
    T.to(g.scale, { x: 1, y: 1, z: 1 }, { dur: 0.5, ease: E.outCubic });
    const r = await S.inspect.open(s.obj, { actions: [{ id: 'back', label: 'Put back' }, { id: 'binder', label: 'Into the binder' }, { id: 'table', label: 'Onto the table', primary: true }], hint: S.specLine(s.slab) + '\nDrag to turn it, scroll to zoom. Click the room to put it back.' });
    T.to(g.scale, { x: k0, y: k0, z: k0 }, { dur: 0.45, ease: E.inOutSine }); while (S.inspect.active()) await T.wait(0.05); R.busy = false;
    if (r !== 'table' && r !== 'binder') return;
    const slab = s.slab; S.slabs.drop(s.obj); if (s.pivot.parent) s.pivot.parent.remove(s.pivot); R.slabs = R.slabs.filter(x => x !== s); if (o.remove) o.remove(slab.id);
    if (r === 'binder') { store.toBinder(slab.id); S.sfx('binder'); S.toast('Filed in the binder.'); }
    else { const sp = S.table.freeSpot(); S.table.place(slab, sp.x, sp.z, (Math.random() - 0.5) * 0.4, { drop: true }); }
    S.hud(); const en = entries(null); applySlots(en, o.layout(en), true);
  }
  R.pointer = (kind, e) => {
    if (R.busy || S.dragging() || (o.closed && o.closed())) return false;
    if (R.press) { if (kind === 'move') { if (Math.abs(e.clientX - R.press.x) + Math.abs(e.clientY - R.press.y) > 6) { const s = R.press.s; R.press = null; takeOut(s, e); } return true; } if (kind === 'up') { const s = R.press.s; R.press = null; look(s); return true; } return true; }
    if (kind === 'move') { const s = find(S.hitAny(e, groups())); R.hover = s || null; if (s) { S.ctx.canvas.style.cursor = 'pointer'; return true; } return false; }
    if (kind === 'down') { if (e.button !== 0) return false; const s = find(S.hitAny(e, groups())); if (!s) return false; R.press = { s, x: e.clientX, y: e.clientY }; return true; }
    return false;
  };
  const inBounds = t => { const b = o.bounds; return t && t.x >= b[0] && t.x <= b[2] && t.z >= b[1] && t.z <= b[3]; };
  /* over(e): a tall prop (the shelf) also counts when you point at it, since its face projects past its footprint */
  let lastE = null; const inside = t => inBounds(t) || !!(lastE && o.over && o.over(lastE));
  function ghostMesh(obj, roll) { if (R.ghost) return R.ghost; const gw = roll ? obj.h * K : obj.w * K, gh = roll ? obj.w * K : obj.h * K; const m = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })); m.position.y = gh / 2; const pv = new THREE.Group(); pv.add(m); group.add(pv); R.ghost = pv; return pv; }
  function clearGhost() { if (R.ghost) { group.remove(R.ghost); R.ghost.children[0].geometry.dispose(); R.ghost.children[0].material.dispose(); R.ghost = null; } if (R.ghostFor) { R.ghostFor = null; const en = entries(null); applySlots(en, o.layout(en), true); } }
  /* while a slab is dragged: the others part and a ghost sits where it would go */
  R.preview = (obj, e) => { if (!obj) { clearGhost(); return; } lastE = e; const t = S.tableHit(e, 0); if (!inside(t) || (o.closed && o.closed()) || (o.accept && !o.accept(obj.slab, true))) { clearGhost(); return; }
    const place = o.target(t, obj, e); const key = JSON.stringify(place); if (R.ghostFor === key) return; R.ghostFor = key;
    const g = { id: '__ghost', obj, land: !!obj.land, place, ghost: true }; const en = entries(g), slots = o.layout(en); const gs = slots[en.length - 1];
    applySlots(en.slice(0, -1), slots.slice(0, -1), true); const pv = ghostMesh(obj, gs && gs.roll); if (gs) { pv.position.set(gs.x, gs.y, gs.z); pv.rotation.set(gs.rx || 0, gs.ry || 0, 0); pv.visible = true; } };
  /* a table object let go over the prop: it lifts, shrinks and slides into the spot the ghost showed */
  R.drop = (obj, e) => {
    lastE = e; const t = S.tableHit(e, 0); if (!inside(t)) { clearGhost(); return false; }
    if (o.closed && o.closed() && !o.dropShut) { clearGhost(); S.toast('Open it first.'); return false; }
    const slab = obj.slab; if (o.accept && !o.accept(slab)) { clearGhost(); return false; }
    const place = o.target(t, obj, e); R.ghostFor = null; if (R.ghost) { group.remove(R.ghost); R.ghost = null; }
    (async () => { const g = obj.group, top = new THREE.Vector3((o.bounds[0] + o.bounds[2]) / 2, 2.2, (o.bounds[1] + o.bounds[3]) / 2); S.sfx('lift');
      await T.par([T.to(g.position, top, { dur: 0.35, ease: E.inOutCubic }), T.to(g.scale, { x: K, y: K, z: K }, { dur: 0.35, ease: E.inOutCubic })]);
      S.table.remove(obj, true); o.add(slab.id, place); S.hud(); await rebuild(slab.id); })();
    return true;
  };
  R.frame = dt => { const k = 1 - Math.exp(-dt * 10); R.slabs.forEach(s => { s.hoverT += ((R.hover === s ? 1 : 0) - s.hoverT) * k; if (!s.base) return; s.pivot.position.y = s.y + s.hoverT * peek; s.pivot.rotation.x = (s.base.rx || 0) - s.hoverT * 0.18; }); };
  R.rebuild = rebuild; R.setVisible = on => { group.visible = on; }; R.dispose = dispose;
  return R;
}
