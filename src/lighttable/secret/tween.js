// Shared tweens for the secret layer. Driven by the light table's own frame loop (tick(dt) from secret/index.js),
// so everything pauses with the room and can be slowed down for a slow-mo reveal (setTimeScale).
// tween() returns a promise you can await; cancel() resolves it early without running the rest.

export const E = {
  linear: t => t,
  inQuad: t => t * t, outQuad: t => 1 - (1 - t) * (1 - t), inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  inCubic: t => t * t * t, outCubic: t => 1 - Math.pow(1 - t, 3), inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inQuart: t => t * t * t * t, outQuart: t => 1 - Math.pow(1 - t, 4), inOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  inExpo: t => t === 0 ? 0 : Math.pow(2, 10 * t - 10), outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2, outSine: t => Math.sin(t * Math.PI / 2), inSine: t => 1 - Math.cos(t * Math.PI / 2),
  inBack: t => { const c = 1.70158; return (c + 1) * t * t * t - c * t * t; },
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  inOutBack: t => { const c = 1.70158 * 1.525; return t < 0.5 ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2 : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2; },
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
  outBounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
};

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
/* a slice of a 0..1 progress: sub(t, 0.2, 0.6) runs 0..1 while t goes 0.2..0.6 */
export const sub = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
/* frame-rate independent smoothing towards a target */
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
export const bump = t => Math.sin(Math.PI * clamp(t, 0, 1));

const live = new Set();
let scale = 1, clock = 0;
export function setTimeScale(s) { scale = s; }
export function timeScale() { return scale; }
export function time() { return clock; }

export function tick(dt) {
  dt *= scale; clock += dt;
  for (const t of [...live]) {
    if (t.delay > 0) { t.delay -= dt; if (t.delay > 0) continue; dt = -t.delay; t.delay = 0; }
    t.el += dt; const raw = t.dur > 0 ? clamp(t.el / t.dur, 0, 1) : 1;
    try { if (t.update) t.update(t.ease(raw), raw); } catch (e) { console.error(e); }
    if (raw >= 1) { live.delete(t); t.resolve(true); }
  }
}

/* tween({ dur, ease, delay, tag, update(e, raw) }) → promise (resolves true when finished, false if cancelled) with .cancel() */
export function tween(o) {
  const t = { dur: o.dur ?? 0.6, ease: o.ease || E.inOutCubic, delay: o.delay || 0, el: 0, update: o.update, tag: o.tag || null };
  const p = new Promise(r => { t.resolve = r; });
  live.add(t); p.cancel = () => { if (live.delete(t)) t.resolve(false); }; p.t = t;
  return p;
}
export const wait = (s, tag) => tween({ dur: s, tag });
export const par = (...ps) => Promise.all(ps.flat());
export function cancelAll(tag) { for (const t of [...live]) if (!tag || t.tag === tag) { live.delete(t); t.resolve(false); } }
export function running(tag) { for (const t of live) if (!tag || t.tag === tag) return true; return false; }

/* tween numbers, THREE vectors (.lerpVectors) and quaternions (.slerpQuaternions) on an object towards `to`.
   to({ obj:mesh.position }, { x:1, y:2 }) or to(mesh.position, targetVector3) */
export function to(obj, target, o = {}) {
  const isVec = target && typeof target.lerpVectors === 'function', isQ = target && typeof target.slerpQuaternions === 'function';
  if (isVec || isQ) { const from = obj.clone(), end = target.clone();
    return tween({ ...o, update: (e, r) => { isQ ? obj.slerpQuaternions(from, end, e) : obj.lerpVectors(from, end, e); if (o.update) o.update(e, r); } }); }
  const from = {}; for (const k in target) from[k] = obj[k];
  return tween({ ...o, update: (e, r) => { for (const k in target) obj[k] = from[k] + (target[k] - from[k]) * e; if (o.update) o.update(e, r); } });
}

/* a seeded random, so a roll can be replayed */
export function rng(seed) { let a = (seed >>> 0) || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
