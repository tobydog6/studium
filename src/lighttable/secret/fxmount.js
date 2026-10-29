// FXMOUNT: laying a finish over a slab's or a print's photo, shared by slabmesh.js and print.js. A finish's make() may
// hand back a mesh (the shader finishes), a group (the depth finishes in fxfinishes.js) or a promise of either (they wait
// for the photo's depth). Groups keep their depth test while inspected (they have real relief), Full art slabs give the
// depth finishes a cropped canvas so the depth lines up, and the variants that sit over a finish (fxvariants.js) go on
// once it is down. Only the newest request for an object ever lands.
import * as THREE from 'three';

function disposeMesh(m) { if (!m) return; if (m.userData.fx) { m.userData.fx.dispose(); return; } if (m.geometry) m.geometry.dispose(); [].concat(m.material || []).forEach(x => x.dispose()); }
export function dropFinish(obj) {
  const f = obj.finish; if (!f) return; obj.finish = null;
  if (f.mesh) { if (f.mesh.parent) f.mesh.parent.remove(f.mesh); disposeMesh(f.mesh); }
  if (f.tex) f.tex.dispose(); if (f.variant) try { f.variant.dispose(); } catch (e) {}
}
/* the part of a photo a w by h window shows when it fills it (0..1) */
export function cropFor(canvas, w, h) { const a = w / h, ca = canvas.width / canvas.height; if (ca > a) { const k = a / ca; return { x0: (1 - k) / 2, x1: (1 + k) / 2, y0: 0, y1: 1 }; } const k = ca / a; return { x0: 0, x1: 1, y0: (1 - k) / 2, y1: (1 + k) / 2 }; }
function cropCanvas(c, cr) { const W = Math.round(c.width * (cr.x1 - cr.x0)), H = Math.round(c.height * (cr.y1 - cr.y0)), o = document.createElement('canvas'); o.width = Math.max(2, W); o.height = Math.max(2, H);
  o.getContext('2d').drawImage(c, c.width * cr.x0, c.height * cr.y0, W, H, 0, 0, o.width, o.height); return o; }
/* o: { id, def, shown (canvas), tex (its texture), texFn (canvas → texture), w, h, at (photo position), dz, order, full, fullUV, tier, env, variantFx } */
export function mountFinish(obj, S, o) {
  dropFinish(obj);
  const { def, id } = o; let canvas = o.shown, ptex = o.tex, crop = null, own = null;
  if (def.kind === 'fx' && o.full) { crop = cropFor(o.shown, o.w, o.h); canvas = cropCanvas(o.shown, crop); ptex = own = o.texFn(canvas); }
  const ctx = { THREE, slab: obj.slab, obj, w: o.w, h: o.h, photoTex: ptex, photoCanvas: canvas, crop, tier: o.tier, renderer: S.renderer, envMap: o.env, finish: id };
  const rec = obj.finish = { id, def, mesh: null, tex: own, variant: null };
  const place = mesh => {
    if (obj.finish !== rec || obj.disposed) { disposeMesh(mesh); return; }
    if (mesh) { mesh.position.copy(o.at); mesh.position.z += o.dz;
      if (mesh.userData.fx) mesh.traverse(m => { if (m.isMesh || m.isPoints || m.isLine) { m.userData.keepDepth = true; if (m.userData.order == null) m.userData.order = o.order; } });
      else { mesh.userData.order = o.order; if (o.full && o.fullUV && mesh.geometry) mesh.geometry.setAttribute('uv', o.fullUV); }
      obj.inner.add(mesh); rec.mesh = mesh; }
    if (o.variantFx) { try { rec.variant = o.variantFx(obj, S, rec, ctx) || null; } catch (e) { console.error('variant', e); } }
    if (obj.top) obj.setTop(true);
  };
  let made = null; try { made = def.make ? def.make(ctx) : null; } catch (e) { console.error(e); made = null; }
  if (made && typeof made.then === 'function') made.then(place, e => { console.error(e); place(null); }); else place(made);
}
/* a still click on an inspected object: the finish gets it if it does something with clicks */
export function clickFinish(obj, uv) { const m = obj.finish && obj.finish.mesh; return !!(m && m.userData.fx && m.userData.fx.click(uv)); }
/* setTop's walk over an object: relief keeps its depth test (it occludes itself), flat layers draw on top in order */
export function topWalk(group, on) {
  group.traverse(m => {
    /* relief keeps its depth test, but joins the transparent pass while inspected so it draws after the photo under it */
    if (m.userData.keepDepth && (m.isMesh || m.isPoints || m.isLine)) { [].concat(m.material).forEach(mt => { if (mt.userData.t0 === undefined) mt.userData.t0 = mt.transparent; mt.transparent = on || mt.userData.t0; }); m.renderOrder = on ? 20 + (m.userData.order || 0) : (m.userData.order || 0); return; }
    if (!m.isMesh) return;
    [].concat(m.material).forEach(mt => { if (mt.userData.t0 === undefined) mt.userData.t0 = mt.transparent; mt.depthTest = !on; mt.transparent = on || mt.userData.t0; });
    m.renderOrder = on ? 20 + (m.userData.order || 0) : (m.userData.order || 0);
  });
}
