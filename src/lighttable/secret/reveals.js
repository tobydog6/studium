// REVEALS: the pull's big moment rebuilt after Sam's Hearthstone reference ("insanely high fidelity, look how they do
// their legendary effects"). The old flip stays in the dev panel (Reveal style: Flip) to compare. What makes it read as
// light, not stickers: everything is shader-drawn and HDR (brighter than white) under the bloom in bloom.js, and the
// particles are thousands of GPU sparks stretched along their motion, cooling as they fly. Scaled by tier:
//   waiting  (from the landing) a living aura round the card back: fire licking up its edges for legendary and mythic,
//            wisps of energy in the tier colour below that; hovering stokes it.
//   charge   (rare and up) the aura flares, the card trembles, light is drawn in; mythic first goes dark and implodes.
//   turn     a fast turn; at the edge-on moment the burst: a fireball with a white-hot core (legendary and up), a
//            spray of sparks, an anamorphic flare streak, a screen flash and a camera jolt.
//   face     (rare and up) the face lands covered in molten gold, or the tier's energy, which burns away from the
//            middle out with a white-hot edge, shedding dust; then the chime.
//   settle   a living glow round the frame that travels with the card into the close view and fades, embers lifting
//            (legendary and up), and for mythic the 1 OF 1 stamp.
// rail.js calls land(r) once the winner has come forward and run(style, c) at the click (c = { r, slot, obj, spin, y0,
// alive }); it resolves with the print face up. frame(dt) runs every table frame (index.js) and keeps the sparks and
// glows alive after the rail has gone. Tweens are tagged 'rail', so closing the rail stops the sequence.
import * as THREE from 'three';
import { TIERS } from './slabs.js';

const TI = Object.fromEntries(TIERS.map((t, i) => [t.id, i]));   /* common 0 .. mythic 5 */
const STOP = { stopped: true };
const C = h => new THREE.Color(h);
/* per tier: the three colours of its light (deep, body, hot), whether it burns, and how big the moment is */
const LOOK = [
  { a: C(0x3a4250), b: C(0xa9b4c4), c: C(0xffffff), fire: 0, aura: 0, glow: 0.35, sparks: 70, flash: 0.0, shake: 0, face: 0, charge: 0 },
  { a: C(0x0b2a8a), b: C(0x3f86ff), c: C(0xd8ecff), fire: 0, aura: 0.45, glow: 0.55, sparks: 180, flash: 0.06, shake: 0, face: 0, charge: 0 },
  { a: C(0x2a0c8a), b: C(0x7d5cff), c: C(0xe4dcff), fire: 0, aura: 0.6, glow: 0.75, sparks: 320, flash: 0.1, shake: 0.02, face: 0.45, charge: 0.25 },
  { a: C(0x5a0640), b: C(0xff3fb0), c: C(0xffe0f4), fire: 0.15, aura: 0.75, glow: 0.95, sparks: 520, flash: 0.16, shake: 0.04, face: 0.55, charge: 0.35 },
  { a: C(0x8a1400), b: C(0xff7a10), c: C(0xfff0b8), fire: 1, aura: 1, glow: 1.25, sparks: 1100, flash: 0.32, shake: 0.09, face: 0.75, charge: 0.45 },
  { a: C(0x7a4400), b: C(0xffc23a), c: C(0xffffff), fire: 1, aura: 1.1, glow: 1.5, sparks: 1600, flash: 0.5, shake: 0.12, face: 0.9, charge: 0.85 },
];

const GV = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LIB = `
float rvH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rvN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(rvH(i), rvH(i + vec2(1.0, 0.0)), f.x), mix(rvH(i + vec2(0.0, 1.0)), rvH(i + vec2(1.0, 1.0)), f.x), f.y); }
float rvF(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * rvN(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
float sdRB(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec3 ramp(float I, vec3 a, vec3 b, vec3 c){ return mix(mix(a, b, smoothstep(0.08, 0.5, I)), c, smoothstep(0.55, 1.15, I)); }
vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
`;
/* the aura: flames (or wisps) licking out from the card's edge, reaching further above it; the card hides the inside */
const AURA_F = `uniform vec2 uHalf; uniform vec2 uCard; uniform float uTime; uniform float uAmt; uniform float uFire; uniform float uGain; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; varying vec2 vUv;
${LIB}
void main(){ vec2 p = (vUv - 0.5) * 2.0 * uHalf; float d = sdRB(p, uCard, uCard.x * 0.06), dd = max(d, 0.0);
  vec2 q = p / uCard.x * 1.5; float sp = mix(0.45, 1.5, uFire);
  vec2 w = vec2(rvF(q * 0.7 + vec2(0.0, -uTime * sp * 0.55)), rvF(q * 0.7 + vec2(4.3, -uTime * sp * 0.55 + 2.1)));
  float n = rvF(q * mix(1.0, 1.6, uFire) + (w - 0.5) * mix(1.4, 2.6, uFire) + vec2(0.0, -uTime * sp));
  float up = smoothstep(-uCard.y * 0.5, uCard.y * 1.3, p.y);
  float reach = uCard.x * mix(0.16, 0.42, uFire) * (0.55 + mix(0.45, 1.6, uFire) * up) * uAmt;
  float f = clamp(1.0 - dd / max(reach * (0.25 + 1.5 * n * n), 1e-3), 0.0, 1.0); f = f * f * (3.0 - 2.0 * f);
  float rim = exp(-dd / (uCard.x * 0.025)) * min(uAmt, 1.2);
  float I = (f * (0.35 + 1.1 * n) + rim * 0.55) * smoothstep(-uCard.x * 0.01, uCard.x * 0.01, d);   /* nothing inside the card: the glow pass sees no card in front */
  gl_FragColor = vec4(ramp(I, uA, uB, uC) * I * uGain, 1.0);
  #include <colorspace_fragment>
}`;
/* the fireball: a turbulent ball that swells and cools, rays through it, a white-hot core */
const BALL_F = `uniform float uK; uniform float uSeed; uniform float uGain; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; varying vec2 vUv;
${LIB}
void main(){ vec2 p = (vUv - 0.5) * 2.0; float r = length(p); vec2 dv = p / max(r, 1e-3);
  float R = 0.22 + 0.78 * (1.0 - pow(1.0 - uK, 3.0));
  float n = rvF(dv * 2.2 + vec2(r * 2.6 - uK * 3.2, uSeed)), n2 = rvF(p * 3.2 + uSeed + uK * 1.5);
  float edge = R * (0.55 + 0.6 * n2);
  float dens = clamp(1.0 - r / edge, 0.0, 1.0);
  float rays = pow(rvN(dv * 9.0 + uSeed), 4.0) * (1.0 - smoothstep(0.0, 1.0, r / (R * 1.25)));
  float fade = pow(1.0 - uK, 1.6), heat = 1.0 - uK;
  float I = (dens * (0.5 + 0.9 * n) + rays * 0.9) * fade;
  float core = exp(-r * r * 30.0) * pow(1.0 - uK, 4.0) * 1.6;
  gl_FragColor = vec4(ramp(I * (0.55 + 0.9 * heat), uA, uB, uC) * I * uGain + uC * core, 1.0);
  #include <colorspace_fragment>
}`;
/* the flare streak: a long thin line of light with a hot centre (rotated for the edge-on burst) */
const FLARE_F = `uniform float uAmt; uniform vec3 uCol; varying vec2 vUv;
void main(){ float x = (vUv.x - 0.5) * 2.0, y = (vUv.y - 0.5) * 2.0;
  float I = (exp(-y * y * 60.0) * pow(max(0.0, 1.0 - x * x), 3.0) + exp(-(x * x * 14.0 + y * y * 30.0)) * 1.5) * uAmt;
  gl_FragColor = vec4(uCol * I, 1.0);
  #include <colorspace_fragment>
}`;
/* the face cover: molten gold (or the tier's energy) flowing over the face, burning away from the middle out */
const FACE_F = `uniform float uP; uniform float uTime; uniform float uAsp; uniform float uGain; uniform float uIn; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; varying vec2 vUv;
${LIB}
void main(){ vec2 q = (vUv - 0.5) * vec2(uAsp, 1.0);
  float n = rvF(q * 4.5 + 2.0), v = n * 0.75 + length(q) * 0.5, th = uP * 1.35 - 0.12, m = v - th;
  if (m < 0.0) discard;
  float edge = exp(-m * 26.0);
  float s = rvF(q * 7.0 + vec2(uTime * 0.22, -uTime * 0.35) + rvF(q * 3.0 - uTime * 0.15) * 1.5);
  vec3 body = mix(uA, uB, smoothstep(0.2, 0.8, s)) + uC * pow(s, 4.0) * 0.9;
  vec3 col = body * uGain * (0.85 + 0.15 * sin(uTime * 4.0 + s * 12.0)) + uC * edge * 1.8;
  gl_FragColor = vec4(col * uIn, uIn);
  #include <colorspace_fragment>
}`;
/* the frame glow after: a band of light hugging the edge, flowing round it; prismatic for mythic */
const RIM_F = `uniform vec2 uHalf; uniform vec2 uCard; uniform float uTime; uniform float uAmt; uniform float uPrism; uniform vec3 uB; uniform vec3 uC; varying vec2 vUv;
${LIB}
void main(){ vec2 p = (vUv - 0.5) * 2.0 * uHalf; float d = sdRB(p, uCard, uCard.x * 0.06), dd = max(d, 0.0);
  vec2 dv = normalize(p + 1e-4); float flow = rvF(dv * 3.0 + vec2(uTime * 0.6, -uTime * 0.4)) * 1.4;
  float I = (exp(-dd / (uCard.x * 0.022)) * 1.3 + exp(-dd / (uCard.x * 0.14)) * 0.45 * flow) * uAmt * smoothstep(-uCard.x * 0.01, uCard.x * 0.01, d);
  vec3 col = mix(uB, uC, smoothstep(0.6, 1.3, I));
  col = mix(col, hue(fract(atan(p.y, p.x) / 6.2832 + uTime * 0.15)) * 1.4 + 0.2, uPrism * 0.75);
  gl_FragColor = vec4(col * I * 1.8, 1.0);
  #include <colorspace_fragment>
}`;
/* GPU sparks: instanced quads, each a flight from its own start time with drag and gravity, stretched along its
   screen motion, shrinking and cooling over its life */
const SPARK_V = `attribute vec3 aP; attribute vec3 aV; attribute vec4 aC; attribute vec4 aS;
uniform float uTime; uniform vec3 uG; uniform float uStretch; uniform vec3 uCool; varying vec3 vC; varying vec2 vQ; varying float vA;
void main(){ float t = uTime - aS.x, life = aC.a, k = t / life;
  if (t < 0.0 || k >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; vC = vec3(0.0); vQ = vec2(0.0); return; }
  float dr = max(aS.z, 0.001), e = exp(-dr * t);
  vec3 p = aP + aV * (1.0 - e) / dr + 0.5 * uG * t * t, v = aV * e + uG * t;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); vec2 vv = (modelViewMatrix * vec4(v, 0.0)).xy; float sp = length(vv); vec2 dir = sp > 1e-4 ? vv / sp : vec2(1.0, 0.0);
  float size = aS.y * (1.0 - k * k * 0.8), len = size + sp * uStretch;
  vec2 c = position.xy; mv.xy += dir * c.x * len + vec2(-dir.y, dir.x) * c.y * size;
  gl_Position = projectionMatrix * mv;
  vA = smoothstep(0.0, 0.06, k) * (1.0 - k) * (0.75 + 0.25 * sin(uTime * 38.0 + aS.w * 70.0));
  vC = aC.rgb * mix(vec3(1.0), uCool, smoothstep(0.0, 0.8, k)); vQ = c * 2.0; }`;
const SPARK_F = `varying vec3 vC; varying vec2 vQ; varying float vA;
void main(){ float r = dot(vQ, vQ); float a = exp(-r * 3.2) * vA; if (a < 0.003) discard; gl_FragColor = vec4(vC * a, 1.0);
  #include <colorspace_fragment>
}`;

export function install(S) {
  const { T } = S, E = T.E;
  S.dev.define('reveal', 'Reveal style', { blaze: 'Blaze (new)', flip: 'Flip (old)' }, 'blaze');
  S.dev.define('reelLen', 'Reel length', { full: 'Full', short: 'Short (testing)' }, 'full');
  const snd = (id, o) => { try { return S.snd && S.snd.play ? S.snd.play(id, o) : null; } catch (e) { return null; } };
  const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const shader = (frag, uniforms, o) => new THREE.ShaderMaterial({ uniforms, vertexShader: GV, fragmentShader: frag, ...ADD, ...(o || {}) });
  let clock = 0; const live = new Set();   /* things that outlive a step: { update(dt) → keep?, dispose() } */

  /* ---------- the spark systems: one for hot sparks (fall and cool), one for embers and dust (float) ---------- */
  function sparks(max, o) {
    const g = new THREE.InstancedBufferGeometry(); const base = new THREE.PlaneGeometry(1, 1); g.index = base.index; g.setAttribute('position', base.attributes.position);
    const P = new Float32Array(max * 3), V = new Float32Array(max * 3), Cc = new Float32Array(max * 4), Sx = new Float32Array(max * 4); for (let i = 0; i < max; i++) Sx[i * 4] = -1e4;
    const at = { aP: new THREE.InstancedBufferAttribute(P, 3), aV: new THREE.InstancedBufferAttribute(V, 3), aC: new THREE.InstancedBufferAttribute(Cc, 4), aS: new THREE.InstancedBufferAttribute(Sx, 4) };
    Object.entries(at).forEach(([k, a]) => { a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); }); g.instanceCount = max;
    const u = { uTime: { value: 0 }, uG: { value: new THREE.Vector3(0, o.grav ?? -3, 0) }, uStretch: { value: o.stretch ?? 0.035 }, uCool: { value: o.cool || new THREE.Vector3(1, 0.4, 0.15) } };
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: SPARK_V, fragmentShader: SPARK_F, ...ADD, depthTest: false })); m.frustumCulled = false; m.renderOrder = 60; m.userData.noParticles = true; S.fx.glow(m); S.scene.add(m);
    let head = 0;
    return { m, u,
      /* emit(n, fn(i) → { p, v, c (Color, HDR ok), life, size, drag }) */
      emit(n, fn) { for (let i = 0; i < n; i++) { const k = head++ % max, s = fn(i); P.set([s.p.x, s.p.y, s.p.z], k * 3); V.set([s.v.x, s.v.y, s.v.z], k * 3); Cc.set([s.c.r, s.c.g, s.c.b, s.life], k * 4); Sx.set([u.uTime.value, s.size, s.drag ?? 2, Math.random()], k * 4); }
        Object.values(at).forEach(a => { a.needsUpdate = true; }); },
      dispose() { S.scene.remove(m); base.dispose(); g.dispose(); m.material.dispose(); } };
  }
  let HOT = null, DUST = null;
  const pools = () => { if (!HOT) { HOT = sparks(4000, { grav: -2.6, stretch: 0.045 }); DUST = sparks(3000, { grav: 0.35, stretch: 0.012, cool: new THREE.Vector3(0.8, 0.55, 0.4) }); } };

  /* ---------- the card's frame in the world: centre, right, up, out (towards the camera), half size ---------- */
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
  function frameOf(c) { const G = c.G; G.updateMatrixWorld(true); const o = G.getWorldPosition(new THREE.Vector3()); G.getWorldQuaternion(_q); const s = G.getWorldScale(_v).x;
    return { o, x: new THREE.Vector3(1, 0, 0).applyQuaternion(_q), y: new THREE.Vector3(0, 1, 0).applyQuaternion(_q), z: new THREE.Vector3(0, 0, 1).applyQuaternion(_q), hw: c.hw * s, hh: c.hh * s }; }
  const at = (F, u, v, w) => F.o.clone().addScaledVector(F.x, u * F.hw).addScaledVector(F.y, v * F.hh).addScaledVector(F.z, w || 0);
  const vec = (F, a, b, cz) => new THREE.Vector3().addScaledVector(F.x, a).addScaledVector(F.y, b).addScaledVector(F.z, cz);
  const hdr = (col, k) => col.clone().multiplyScalar(k);

  /* ---------- landing: the fx group on the hanger and the aura behind the card back ---------- */
  function land(r) {
    pools(); const w = r.winner, o = w.obj, tier = (o.slab && o.slab.tier) || 'common', idx = TI[tier] ?? 0, L = LOOK[idx];
    [r.flood, r.rim, r.burst, r.ring].forEach(m => { if (m) m.visible = false; });   /* the rail's own glow sprites give way */
    const K = o.group.scale.x || 0.4, side = o.w > o.h, hw = (side ? o.h : o.w) * K / 2, hh = (side ? o.w : o.h) * K / 2;
    const G = new THREE.Group(); G.position.copy(w.spin.position); w.h.add(G);
    const c = { r, G, hw, hh, idx, L, tier, aura: null, auraAmt: 0, auraWant: L.aura, stoke: 0 };
    if (L.aura > 0) { const ex = 1 + 0.9 * L.fire, hx = hw * (1.5 + 0.4 * L.fire), hy = hh * (1.25 + 0.55 * ex * 0.5);
      const u = { uHalf: { value: new THREE.Vector2(hx, hy) }, uCard: { value: new THREE.Vector2(hw, hh) }, uTime: { value: Math.random() * 50 }, uAmt: { value: 0 }, uFire: { value: L.fire }, uGain: { value: 1.1 + 0.7 * L.fire }, uA: { value: L.a }, uB: { value: L.b }, uC: { value: L.c } };
      c.aura = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2, hy * 2), shader(AURA_F, u)); c.aura.position.set(0, hy - hh * 1.0 - (hy - hh) * 0.35, -0.06); c.aura.renderOrder = 2; S.fx.glow(c.aura); G.add(c.aura); }
    S.fx.want = L.aura > 0 ? 0.3 + 0.3 * L.glow : 0;
    r.blaze = c; return c;
  }
  function frameLand(c, dt) {
    const r = c.r, hov = r.hoverT || 0; c.G.scale.copy(r.winner.spin.scale);
    c.auraAmt += ((c.auraWant * (1 + 0.35 * hov) + c.stoke) - c.auraAmt) * (1 - Math.exp(-dt * 5));
    if (c.aura) { const u = c.aura.material.uniforms; u.uTime.value += dt; u.uAmt.value = Math.max(0, c.auraAmt * (0.94 + 0.06 * Math.sin(clock * 9))); c.aura.visible = u.uAmt.value > 0.01; }
    /* a few embers off the aura while it waits */
    if (c.aura && c.L.fire > 0 && c.auraAmt > 0.2 && Math.random() < dt * 40 * c.auraAmt) { const F = frameOf(c), s = Math.random() < 0.5 ? -1 : 1;
      DUST.emit(1, () => ({ p: at(F, s * (0.85 + Math.random() * 0.25), -0.9 + Math.random() * 1.9, -0.02), v: vec(F, s * 0.15 * Math.random(), 0.6 + Math.random() * 0.9, 0.1), c: hdr(Math.random() < 0.5 ? c.L.b : c.L.c, 2.4), life: 0.9 + Math.random() * 0.9, size: 0.03 + Math.random() * 0.03, drag: 0.6 })); }
  }

  /* ---------- the click: charge, turn and burst, the face, the settle ---------- */
  const step = (dur, fn, ease) => T.tween({ dur, ease: ease || E.linear, tag: 'rail', update: (e, raw) => { if (fn) fn(e, raw); } }).then(ok => { if (!ok) throw STOP; });
  async function run(style, o) {
    const r = o.r, c = r.blaze || land(r); c.spin = o.spin; c.y0 = o.y0; c.obj = o.obj; c.alive = o.alive; const L = c.L, idx = c.idx, sp = o.spin, h = r.winner.h, hRest = h.position.clone();
    const check = () => { if (!c.alive()) throw STOP; };
    try {
      /* charge: the aura flares, the card trembles, light rushes in (mythic: the room goes dark first and it implodes) */
      if (L.charge > 0) { let dark = null;
        if (idx >= 5) { dark = screen(0x000000, false); snd('charge', { dur: L.charge + 0.2 }); } else if (idx >= 3) snd('charge', { dur: L.charge + 0.15 });
        let acc = 0;
        await step(L.charge, (e, raw) => { c.stoke = 1.2 * e * (idx >= 4 ? 1.4 : 1); const a = 0.006 + 0.05 * raw * raw * (idx >= 4 ? 1.5 : 1); h.position.set(hRest.x + (Math.random() - 0.5) * a, hRest.y + (Math.random() - 0.5) * a, hRest.z);
          if (dark) dark.material.opacity = 0.7 * Math.min(1, raw * 2.5);
          acc += 0.016 * (idx >= 4 ? 260 : 120); const n = Math.floor(acc); if (n > 0) { acc -= n; const F = frameOf(c), life = 0.28 + Math.random() * 0.12;
            HOT.emit(n, () => { const ang = Math.random() * Math.PI * 2, R = 2.4 + Math.random() * 1.6, p = at(F, Math.cos(ang) * R, Math.sin(ang) * R * F.hw / F.hh, 0.1 + Math.random() * 0.4);
              return { p, v: F.o.clone().sub(p).multiplyScalar(1 / life), c: hdr(Math.random() < 0.4 ? L.c : L.b, 3), life, size: 0.02 + Math.random() * 0.02, drag: 0.001 }; }); } }, E.inQuad);
        check(); h.position.copy(hRest); if (dark) fadeOut(dark, 0.5); }
      /* the turn, and the burst at the edge-on moment */
      snd('flip'); const half = idx >= 4 ? 0.15 : 0.2;
      await step(half, e => { sp.rotation.y = c.y0 + Math.PI / 2 * e; sp.position.z = 0.45 * e; }, E.inCubic); check();
      burst(c);
      await step(half * 1.25, e => { sp.rotation.y = c.y0 + Math.PI / 2 + Math.PI / 2 * e; sp.position.z = 0.45 * (1 - e); }, E.outCubic); check();
      sp.rotation.y = c.y0 + Math.PI; sp.position.z = 0;
      /* the face: molten cover burning off (rare and up), then the chime */
      if (L.face > 0 && c.coverU) { const u = c.coverU; await step(0.08 + 0.04 * idx); check(); snd(L.fire ? 'ignite' : 'burst', { dur: L.face, k: 0.4 });
        let acc = 0; await step(L.face, (e) => { u.uP.value = e;
          acc += 0.016 * (180 + 120 * idx); const n = Math.floor(acc); if (n > 0) { acc -= n; const F = frameOf(c), rr = Math.min(1, e * 1.2);
            DUST.emit(n, () => { const a = Math.random() * Math.PI * 2, k = rr * (0.6 + Math.random() * 0.5); return { p: at(F, Math.cos(a) * k, Math.sin(a) * k * 0.95, 0.03), v: vec(F, (Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.8, 0.4 + Math.random() * 1.0), c: hdr(Math.random() < 0.5 ? L.c : L.b, 2.6), life: 0.6 + Math.random() * 0.7, size: 0.018 + Math.random() * 0.03, drag: 1.5 }; }); } }, E.inOutSine);
        check(); }
      settle(c);
    } catch (e) { if (e !== STOP) console.error('reveal', e); }
    finally { h.position.copy(hRest); if (c.alive()) { sp.rotation.y = c.y0 + Math.PI; sp.position.z = 0; } if (c.coverM) { const m = c.coverM; if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); c.coverM = null; } }
  }
  /* the burst at edge-on: aura out, fireball, sparks, flare, flash, jolt; the face cover goes on while it is hidden */
  function burst(c) {
    const L = c.L, idx = c.idx, F = frameOf(c), o = c.obj;
    if (c.aura) { c.auraWant = 0; c.stoke = 0; const a = c.aura; fadeUniform(a, 'uAmt', 0.25, () => { if (a.parent) a.parent.remove(a); a.geometry.dispose(); a.material.dispose(); }); c.aura = null; }
    snd('burst', { k: 0.5 + 0.12 * idx }); if (idx >= 4) { snd('slam', { k: idx >= 5 ? 1 : 0.85 }); snd('ignite', { dur: 0.7 }); }
    S.fx.want = 0.4 + 0.6 * L.glow; S.fx.shake = Math.max(S.fx.shake, L.shake);
    /* the fireball, facing the camera, in front of the card */
    if (L.fire > 0 || idx >= 3) { const size = F.hh * (idx >= 5 ? 2.6 : idx >= 4 ? 2.2 : 1.6), u = { uK: { value: 0 }, uSeed: { value: Math.random() * 20 }, uGain: { value: idx >= 4 ? 0.85 : 0.6 }, uA: { value: L.a }, uB: { value: L.b }, uC: { value: L.c } };
      const ball = new THREE.Mesh(new THREE.PlaneGeometry(size, size), shader(BALL_F, u, { depthTest: false })); ball.renderOrder = 55; ball.position.copy(at(F, 0, 0, 0.5)); ball.quaternion.copy(S.camera.quaternion); S.fx.glow(ball); S.scene.add(ball);
      const dur = idx >= 5 ? 0.85 : idx >= 4 ? 0.7 : 0.5; let t = 0; live.add({ update(dt) { t += dt; u.uK.value = Math.min(1, t / dur); ball.quaternion.copy(S.camera.quaternion); return t < dur; }, dispose() { S.scene.remove(ball); ball.geometry.dispose(); ball.material.dispose(); } }); }
    /* the flare: a long horizontal streak, and a tall one along the card's edge */
    flare(at(F, 0, 0, 0.55), F.hw * (idx >= 4 ? 16 : 9), F.hw * 0.5, 0, hdr(L.c, 1.0), 0.3 + 0.08 * idx, 1.0 + 0.25 * idx);
    flare(at(F, 0, 0, 0.5), F.hh * 4.2, F.hw * 0.7, Math.PI / 2, hdr(L.c, 1.0), 0.22, 1.2 + 0.25 * idx);
    /* sparks: a spray in the card's plane and out at the camera, hot and cooling */
    HOT.emit(L.sparks, () => { const a = Math.random() * Math.PI * 2, s = F.hw * (1.5 + Math.random() * Math.random() * (5 + idx)), out = (Math.random() - 0.25) * s * 0.7;
      return { p: at(F, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8, 0.3), v: vec(F, Math.cos(a) * s, Math.sin(a) * s, out), c: hdr(Math.random() < 0.35 ? L.c : L.b, 1.4 + Math.random() * 1.6), life: 0.35 + Math.random() * (0.5 + 0.12 * idx), size: 0.012 + Math.random() * 0.03, drag: 1.8 + Math.random() * 1.5 }; });
    if (idx >= 4) DUST.emit(600 + 300 * (idx - 4), () => ({ p: at(F, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.2, 0.2), v: vec(F, (Math.random() - 0.5) * 2.2, 0.3 + Math.random() * 1.6, Math.random()), c: hdr(Math.random() < 0.5 ? L.b : L.c, 2.2), life: 1.2 + Math.random() * 1.6, size: 0.02 + Math.random() * 0.035, drag: 1.4 }));
    /* the flash over the whole view */
    if (L.flash > 0) { const f = screen(L.b.getHex(), true); f.material.opacity = L.flash * 0.45; fadeOut(f, 0.3 + 0.08 * idx); }
    /* the face cover, laid over the face while the card is edge-on */
    if (L.face > 0 && o && o.inner) { const u = { uP: { value: 0 }, uTime: { value: 0 }, uAsp: { value: (o.w || 2.9) / (o.h || 3.9) }, uGain: { value: 0.8 + 0.15 * L.fire }, uIn: { value: 1 }, uA: { value: L.a }, uB: { value: L.b }, uC: { value: L.c } };
      const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), shader(FACE_F, u, { blending: THREE.NormalBlending })); m.position.z = (o.th || 0.03) / 2 + 0.03; m.renderOrder = 45; m.userData.noParticles = true; o.inner.add(m);   /* not on the glow layer: it should read as gold, not white */ c.coverM = m; c.coverU = u;
      live.add({ update(dt) { u.uTime.value += dt; return !!c.coverM; }, dispose() {} }); }
  }
  /* the settle: the chime, the frame glow that rides with the card, embers, the stamp; the bloom eases off */
  function settle(c) {
    const L = c.L, idx = c.idx, o = c.obj;
    snd('chime', { tier: idx >= 4 ? 'epic' : c.tier }); if (idx >= 4) snd('slam', { k: 0.5 });
    if (o && o.inner) { const hw = (o.w || 2.9) / 2, hh = (o.h || 3.9) / 2, hx = hw * 1.45, hy = hh * 1.35, u = { uHalf: { value: new THREE.Vector2(hx, hy) }, uCard: { value: new THREE.Vector2(hw, hh) }, uTime: { value: 0 }, uAmt: { value: 0 }, uPrism: { value: idx >= 5 ? 1 : 0 }, uB: { value: L.b }, uC: { value: L.c } };
      const rim = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2, hy * 2), shader(RIM_F, u)); rim.position.z = -(o.th || 0.03) / 2 - 0.02; rim.renderOrder = 1; rim.userData.noParticles = true; S.fx.glow(rim); o.inner.add(rim);
      const peak = 0.5 + 0.12 * idx, hold = 0.6 + 0.25 * idx, out = 1.6; let t = 0;
      live.add({ update(dt) { t += dt; u.uTime.value += dt; u.uAmt.value = peak * (t < 0.15 ? t / 0.15 : t < hold ? 1 : Math.max(0, 1 - (t - hold) / out)); return t < hold + out && !o.disposed; }, dispose() { if (rim.parent) rim.parent.remove(rim); rim.geometry.dispose(); rim.material.dispose(); } }); }
    if (idx >= 4) { let t = 0; live.add({ update(dt) { t += dt; if (Math.random() < dt * 60 && o && o.group) { o.group.updateMatrixWorld(true); const p = o.group.localToWorld(new THREE.Vector3((Math.random() - 0.5) * (o.w || 2.9), (Math.random() - 0.5) * (o.h || 3.9), 0.05));
      DUST.emit(1, () => ({ p, v: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.7, (Math.random() - 0.5) * 0.3), c: hdr(Math.random() < 0.5 ? L.b : L.c, 2.4), life: 1 + Math.random(), size: 0.02 + Math.random() * 0.03, drag: 0.8 })); } return t < 1.8; }, dispose() {} }); }
    if (idx >= 5 && o && o.inner) { const st = new THREE.Mesh(new THREE.PlaneGeometry((o.w || 2.9) * 0.78, (o.w || 2.9) * 0.78 * 0.4), new THREE.MeshBasicMaterial({ map: S.holo.tex.stamp(), transparent: true, opacity: 0, depthWrite: false, depthTest: false })); st.rotation.z = -0.09; st.position.set(0, -(o.h || 3.9) * 0.12, (o.th || 0.03) / 2 + 0.05); st.renderOrder = 50; o.inner.add(st);
      let t = 0; live.add({ update(dt) { t += dt; const s = Math.min(1, Math.max(0, (t - 0.35) / 0.2)); if (s > 0 && !st.userData.hit) { st.userData.hit = true; snd('slam', { k: 0.7 }); S.fx.shake = Math.max(S.fx.shake, 0.06); const f = screen(0xffffff, true); f.material.opacity = 0.35; fadeOut(f, 0.4); }
        st.material.opacity = s * (1 - Math.max(0, (t - 2.6) / 0.6)); st.scale.setScalar(Math.max(0.001, 2.6 - 1.6 * E.outBack(s))); return t < 3.2 && !o.disposed; }, dispose() { if (st.parent) st.parent.remove(st); st.geometry.dispose(); st.material.dispose(); } }); }
    let t = 0; const peak = 0.4 + 0.6 * c.L.glow; live.add({ update(dt) { t += dt; S.fx.want = t < 0.5 ? peak : Math.max(0, peak * (1 - (t - 0.5) / 2.2)); return t < 2.7; }, dispose() { S.fx.want = 0; } });
  }

  /* ---------- small pieces ---------- */
  function screen(color, additive) { const cam = S.camera, m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    const hh = 2 * 1.5 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.1; m.position.z = -1.5; m.scale.set(hh * cam.aspect, hh, 1); m.renderOrder = additive ? 70 : 58; m.userData.noParticles = true; cam.add(m); return m; }
  function fadeOut(m, dur) { const a0 = m.material.opacity; let t = 0; live.add({ update(dt) { t += dt; m.material.opacity = a0 * Math.max(0, 1 - t / dur) * Math.max(0, 1 - t / dur); return t < dur; }, dispose() { if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); } }); }
  function fadeUniform(m, key, dur, done) { const u = m.material.uniforms[key], a0 = u.value; let t = 0; live.add({ update(dt) { t += dt; u.value = a0 * Math.max(0, 1 - t / dur); if (m.material.uniforms.uTime) m.material.uniforms.uTime.value += dt; return t < dur; }, dispose: done }); }
  function flare(pos, len, thick, rot, col, dur, gain) { const u = { uAmt: { value: gain }, uCol: { value: col } }, m = new THREE.Mesh(new THREE.PlaneGeometry(len, thick), shader(FLARE_F, u, { depthTest: false })); m.renderOrder = 62; m.position.copy(pos); S.fx.glow(m); S.scene.add(m); let t = 0;
    live.add({ update(dt) { t += dt; m.quaternion.copy(S.camera.quaternion); m.rotateZ(rot); const k = t / dur; u.uAmt.value = gain * Math.pow(Math.max(0, 1 - k), 2); m.scale.set(0.6 + 0.6 * Math.min(1, k * 3), 1 - 0.6 * k, 1); return k < 1; }, dispose() { S.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }); }

  /* ---------- every frame (index.js), also after the rail has gone ---------- */
  function frame(dt) { if (!(dt > 0)) return; clock += dt; if (HOT) { HOT.u.uTime.value += dt; DUST.u.uTime.value += dt; }
    const r = S.rail && S.rail.__r ? S.rail.__r() : null; if (r && r.blaze && r.phase !== 'done' && r.phase !== 'sink') frameLand(r.blaze, dt);
    for (const f of [...live]) { let keep = false; try { keep = f.update(dt); } catch (e) { console.error(e); } if (!keep) { live.delete(f); try { f.dispose(); } catch (e) {} } } }
  /* the rail closing: the aura and the hanger's group go with it; sparks already flying finish on their own */
  function close(r) { const c = r && r.blaze; if (!c) return; if (c.aura) { const a = c.aura; if (a.parent) a.parent.remove(a); a.geometry.dispose(); a.material.dispose(); c.aura = null; } if (c.G.parent) c.G.parent.remove(c.G);
    if (c.coverM) { const m = c.coverM; if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); c.coverM = null; } r.blaze = null; if (!live.size) S.fx.want = 0; }
  S.reveals = { style: () => S.dev.opt('reveal') || 'blaze', land, run, frame, close };
}
