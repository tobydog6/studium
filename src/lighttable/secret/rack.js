// RACK: rows of slabs that live in a prop on the dark side (the briefcase, the glass display). One rack = one id list in
// the store. Hover peeks a slab up, a press and pull takes it out onto the table in your hand, a still click looks
// closer (Put back · Into the binder · Onto the table), and a slab dragged over the prop drops in with a lift and a
// slide into its slot. makeRack(S, { ids(), add(id), bounds:[x0,z0,x1,z1], slot(i,n) → {x,y,z,ry,rx}, K, parent, peek })
import * as THREE from 'three';

export function makeRack(S, o) {
  const { T, M, store } = S, E = T.E, K = o.K || 0.5, peek = o.peek ?? 0.9;
  const group = new THREE.Group(); (o.parent || S.scene).add(group);
  const R = { group, slabs: [], hover: null, press: null, busy: false, gen: 0 };
  const flat = () => new THREE.Quaternion();
  function dispose() { R.slabs.forEach(s => { S.slabs.drop(s.obj); if (s.pivot.parent) s.pivot.parent.remove(s.pivot); }); R.slabs = []; R.hover = null; }
  /* every slab in the list, placed by slot(); a newcomer (dropIn) arrives from above */
  async function rebuild(dropIn) {
    const gen = ++R.gen; dispose(); const ids = o.ids(), list = [];
    ids.forEach((id, i) => { const slab = store.pull(id); if (!slab) return; const obj = S.objFor(slab); const pivot = new THREE.Group(); pivot.visible = false; obj.group.scale.setScalar(K); pivot.add(obj.group); group.add(pivot); list.push({ obj, pivot, slab, id, i, y: 0, hoverT: 0 }); });
    R.slabs = list; await Promise.all(list.map(s => s.obj.ready.catch(() => null))); if (gen !== R.gen) return;
    const n = list.length; list.forEach((s, i) => { const p = o.slot(i, n, s.obj); s.base = p; s.y = p.y; s.pivot.position.set(p.x, p.y, p.z); s.pivot.rotation.set(p.rx || 0, p.ry || 0, 0); s.obj.group.position.set(0, s.obj.h * K / 2, 0); s.pivot.visible = true;
      if (dropIn && s.id === dropIn) { s.y = p.y + 1.6; T.to(s, { y: p.y }, { dur: 0.55, ease: E.outCubic }); setTimeout(() => S.sfx('ltPutDown'), 350); } });
  }
  function groups() { return R.slabs.map(s => s.obj.group); }
  function find(h) { return h ? R.slabs.find(s => s.obj.group === h.root) : null; }
  function takeOut(s, e) { const slab = s.slab; S.slabs.drop(s.obj); if (s.pivot.parent) s.pivot.parent.remove(s.pivot); R.slabs = R.slabs.filter(x => x !== s); R.hover = null;
    const t = S.tableHit(e, 0) || { x: 0, z: 0 }; const obj = S.table.place(slab, t.x, t.z, 0, { quiet: true }); S.sfx('lift'); S.beginSlabDrag(obj, e); }
  async function look(s) {
    if (R.busy) return; R.busy = true; const g = s.obj.group, k0 = g.scale.x; R.hover = null;
    T.to(g.scale, { x: 1, y: 1, z: 1 }, { dur: 0.5, ease: E.outCubic });
    const r = await S.inspect.open(s.obj, { actions: [{ id: 'back', label: 'Put back' }, { id: 'binder', label: 'Into the binder' }, { id: 'table', label: 'Onto the table', primary: true }], hint: S.specLine(s.slab) + '\nDrag to turn it, scroll to zoom. Click the room to put it back.' });
    T.to(g.scale, { x: k0, y: k0, z: k0 }, { dur: 0.45, ease: E.inOutSine }); while (S.inspect.active()) await T.wait(0.05); R.busy = false;
    if (r !== 'table' && r !== 'binder') return;
    const slab = s.slab; S.slabs.drop(s.obj); if (s.pivot.parent) s.pivot.parent.remove(s.pivot); R.slabs = R.slabs.filter(x => x !== s);
    if (r === 'binder') { store.toBinder(slab.id); S.sfx('binder'); S.toast('Filed in the binder.'); }
    else { const sp = S.table.freeSpot(); S.table.place(slab, sp.x, sp.z, (Math.random() - 0.5) * 0.4, { drop: true }); }
    S.hud();
  }
  R.pointer = (kind, e) => {
    if (R.busy || S.dragging() || (o.closed && o.closed())) return false;
    if (R.press) { if (kind === 'move') { if (Math.abs(e.clientX - R.press.x) + Math.abs(e.clientY - R.press.y) > 6) { const s = R.press.s; R.press = null; takeOut(s, e); } return true; } if (kind === 'up') { const s = R.press.s; R.press = null; look(s); return true; } return true; }
    if (kind === 'move') { const s = find(S.hitAny(e, groups())); R.hover = s || null; if (s) { S.ctx.canvas.style.cursor = 'pointer'; return true; } return false; }
    if (kind === 'down') { if (e.button !== 0) return false; const s = find(S.hitAny(e, groups())); if (!s) return false; R.press = { s, x: e.clientX, y: e.clientY }; return true; }
    return false;
  };
  /* a table object let go over the prop: it lifts, shrinks and slides into its slot */
  R.drop = (obj, e) => {
    const t = S.tableHit(e, 0), b = o.bounds; if (!t || t.x < b[0] || t.x > b[2] || t.z < b[1] || t.z > b[3]) return false;
    if (o.closed && o.closed()) { S.toast('Open it first.'); return false; }
    const slab = obj.slab; if (o.accept && !o.accept(slab)) return false;
    (async () => { const g = obj.group, top = new THREE.Vector3((b[0] + b[2]) / 2, 2.2, (b[1] + b[3]) / 2); S.sfx('lift');
      await T.par([T.to(g.position, top, { dur: 0.4, ease: E.inOutCubic }), T.to(g.scale, { x: K, y: K, z: K }, { dur: 0.4, ease: E.inOutCubic })]);
      S.table.remove(obj, true); o.add(slab.id); S.hud(); await rebuild(slab.id); })();
    return true;
  };
  R.frame = dt => { const k = 1 - Math.exp(-dt * 10); R.slabs.forEach(s => { s.hoverT += ((R.hover === s ? 1 : 0) - s.hoverT) * k; if (!s.base) return; s.pivot.position.y = s.y + s.hoverT * peek; s.pivot.rotation.x = (s.base.rx || 0) - s.hoverT * 0.18; }); };
  R.rebuild = rebuild; R.setVisible = on => { group.visible = on; }; R.dispose = dispose;
  return R;
}
