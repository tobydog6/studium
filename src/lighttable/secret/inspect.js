// Shared slab inspect: a slab floats up in front of the camera over a dimmed room, drag turns it, the wheel zooms,
// the holo finish reads the tilt and the pointer. Vault, loot and binder all use this, so it lives in the foundation.
//   const choice = await S.inspect.open(slabObj, { actions:[{ id:'back', label:'Put back' }, { id:'table', label:'Onto the table', primary:true }], hint:'...' });
// Resolves with the action id, or 'back' for Esc / a click on the room.
import * as THREE from 'three';
import { clamp, damp } from './tween.js';

export function createInspect(S) {
  const cam = S.ctx.camera, R = new THREE.Vector3(), U = new THREE.Vector3(), B = new THREE.Vector3();
  const dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false })); dim.renderOrder = 15; dim.visible = false; cam.add(dim);
  const bar = S.el('div', 'sk-acts-bar', ''); bar.id = 'skActs'; document.body.appendChild(bar);
  const hint = S.el('div', 'sk-hint', ''); hint.id = 'skHint'; document.body.appendChild(hint);
  const I = { obj: null, o: null, t: 0, target: 0, res: null, drag: null, rot: { x: 0, y: 0 }, zoom: 1, from: null, closing: false,
    active() { return !!I.obj; },
    open(obj, o = {}) {
      if (I.obj) I.close('back');
      const g = obj.group; g.updateMatrixWorld(true);
      I.from = { parent: g.parent, pos: g.position.clone(), quat: g.quaternion.clone(), scale: g.scale.clone(), wp: g.getWorldPosition(new THREE.Vector3()), wq: g.getWorldQuaternion(new THREE.Quaternion()) };
      S.ctx.scene.attach(g);
      I.obj = obj; I.o = o; I.t = 0; I.target = 1; I.rot.x = I.rot.y = 0; I.zoom = o.zoom || 1; I.closing = false; obj.setTop(true); dim.visible = true;
      S.sfx('ltInspect');
      bar.innerHTML = (o.actions || [{ id: 'back', label: 'Put back' }]).map(a => '<button type="button" class="btn' + (a.primary ? ' primary' : '') + '" data-id="' + a.id + '">' + a.label + '</button>').join('');
      bar.classList.add('on'); hint.textContent = o.hint || 'Drag to turn it, scroll to zoom. Click the room to put it back.'; hint.classList.add('on');
      return new Promise(res => { I.res = res; });
    },
    close(id) {
      if (!I.obj || I.closing) return; I.closing = true; I.target = 0; bar.classList.remove('on'); hint.classList.remove('on'); S.sfx('ltPutDown');
      const res = I.res, obj = I.obj; I.res = null; I.drag = null; if (res) res(id || 'back');
    },
    pointer(kind, e) {
      if (!I.obj) return false;
      if (kind === 'down') { if (e.button !== 0) return true; I.drag = { x: e.clientX, y: e.clientY, moved: 0, onSlab: S.hit(e, I.obj.group) }; return true; }
      if (kind === 'move') { if (I.drag) { const dx = e.clientX - I.drag.x, dy = e.clientY - I.drag.y; I.drag.x = e.clientX; I.drag.y = e.clientY; I.drag.moved += Math.abs(dx) + Math.abs(dy); I.rot.y += dx * 0.011; I.rot.x += dy * 0.009; I.rot.x = clamp(I.rot.x, -1.2, 1.2); } S.ctx.canvas.style.cursor = I.drag ? 'grabbing' : 'grab'; return true; }
      if (kind === 'up') { const d = I.drag; I.drag = null; if (d && d.moved < 5 && !d.onSlab && !I.closing) I.close('back'); return true; }
      if (kind === 'wheel') { I.zoom = clamp(I.zoom * Math.exp(-e.deltaY * 0.0012), 0.6, 2.4); return true; }
      return true;
    },
    key(e) { if (!I.obj) return false; if (e.key === 'Escape') { I.close('back'); return true; } return I.closing ? true : false; },
    frame(dt) {
      if (!I.obj) return;
      const obj = I.obj, g = obj.group, k = 1 - Math.exp(-dt * (I.target ? 7 : 9));
      I.t += (I.target - I.t) * k;
      cam.updateMatrixWorld(); cam.matrixWorld.extractBasis(R, U, B);
      if (!I.drag) { I.rot.x = damp(I.rot.x, 0, 3.5, dt); I.rot.y = damp(I.rot.y, 0, 3.5, dt); }
      const m = S.ctx.mouse, hx = m.in ? m.n.x : 0, hy = m.in ? m.n.y : 0;
      const yaw = I.rot.y + hx * 0.3, pitch = I.rot.x - hy * 0.22;
      const fit = Math.max(obj.h, obj.w / cam.aspect) / 0.66, D = fit / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / I.zoom;
      const pos = cam.position.clone().addScaledVector(B, -D);
      const q = cam.quaternion.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(R, pitch)).premultiply(new THREE.Quaternion().setFromAxisAngle(U, yaw));
      const e = I.t * I.t * (3 - 2 * I.t);
      g.position.lerpVectors(I.from.wp, pos, e); g.quaternion.copy(I.from.wq).slerp(q, e);
      obj.tilt.set(clamp(yaw / 0.9, -1, 1), clamp(-pitch / 0.7, -1, 1));
      /* the pointer over the photo, 0..1, for finishes that develop under the light */
      if (m.in && obj.parts.photo) { S.ctx.setNDC({ clientX: m.x, clientY: m.y }); S.ctx.ray.setFromCamera(S.ctx.ndc, cam); const h = S.ctx.ray.intersectObject(obj.parts.photo, false)[0]; if (h && h.uv) obj.pointer.copy(h.uv); }
      dim.material.opacity = 0.62 * e; const dd = D + 0.6, hh = 2 * dd * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.1; dim.position.set(0, 0, -dd); dim.scale.set(hh * cam.aspect, hh, 1);
      if (!I.target && I.t < 0.004) { /* home again */
        const p = I.from.parent || S.ctx.scene; p.attach(g); g.position.copy(I.from.pos); g.quaternion.copy(I.from.quat); g.scale.copy(I.from.scale); obj.setTop(false); obj.tilt.set(0, 0);
        dim.visible = false; dim.material.opacity = 0; I.obj = null; I.o = null; I.closing = false; S.ctx.canvas.style.cursor = 'default';
      }
    },
  };
  bar.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { e.stopPropagation(); I.close(b.dataset.id); } });
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  return I;
}
export const INSPECT_CSS = `
#skActs{ position:fixed; left:50%; bottom:calc(70px + env(safe-area-inset-bottom,0px)); transform:translate(-50%,12px); display:flex; gap:6px; padding:6px; background:var(--panel); border:1px solid var(--line); border-radius:8px; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); opacity:0; pointer-events:none; transition:opacity .25s, transform .35s cubic-bezier(.2,.8,.2,1); z-index:13; }
#skActs.on{ opacity:1; pointer-events:auto; transform:translate(-50%,0); }
#skHint{ white-space:pre-line; text-align:center; max-width:min(92vw, 820px); position:fixed; left:50%; top:calc(22px + env(safe-area-inset-top,0px)); transform:translate(-50%,10px); opacity:0; pointer-events:none; transition:opacity .3s, transform .4s cubic-bezier(.2,.8,.2,1); font:400 12px/1.35 var(--f-ui); color:var(--text); background:rgba(12,11,10,.7); padding:8px 12px; border-radius:20px; border:1px solid var(--line); z-index:13; white-space:nowrap; }
#skHint.on{ opacity:1; transform:translate(-50%,0); }
`;
