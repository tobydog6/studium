// REVEALS: other ways for the landed print to show its face, so Sam can compare them with the flip (Sam: "I don't love
// the effect when you get a slab in the spinner, can we test some variations"). Dev panel: Reveal style. The flip stays
// the default; every other style replaces the flip, the burst and the tier landing with its own moment and its own
// payoff, scaled by tier (common is a small moment, mythic the biggest):
//   develop  the print turns over blank and the image comes up in the developer, darks first, the tray rocking and the
//            safelight surging, then the fix: the room lights up in the tier colour.
//   shatter  the back cracks from where you clicked, light leaking through the cracks in the tier colour, then it
//            bursts into shards at the camera and the face is underneath.
//   burn     the back catches where you clicked and burns away in a ring of fire (hotter colours for higher tiers),
//            embers lifting off the front, the face underneath.
//   charge   gacha style: energy is drawn into the print and its glow climbs the tier ladder one colour at a time
//            (grey, blue, purple, pink, orange, gold) until it reaches its tier, then it spins round and lands face up.
//   scan     a beam in the finish's colour scans down the back and the face shows above it; higher tiers glitch and
//            stall halfway, then race to the end.
// rail.js calls run(style, c) at the click with c = { r, slot, obj, spin, y0, alive, hit } and expects the print face up
// (spin.rotation.y = y0 + PI) when it resolves. Everything runs on the shared clock (pauses with the room, obeys
// setTimeScale); the payoff uses holo.js's rig (S.holo.rig) so it shares the sparks, rings and flashes.
import * as THREE from 'three';
import { TIERS, TIER } from './slabs.js';

const TI = Object.fromEntries(TIERS.map((t, i) => [t.id, i]));   /* common 0 .. mythic 5 */
const STOP = { stopped: true };
const NOISE = `float rvH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rvN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(rvH(i), rvH(i + vec2(1.0, 0.0)), f.x), mix(rvH(i + vec2(0.0, 1.0)), rvH(i + vec2(1.0, 1.0)), f.x), f.y); }
float rvF(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * rvN(p); p *= 2.03; a *= 0.5; } return s; }
`;
/* the burn front: P is the point on the back in world units, uO the ignition point, uP the radius burnt so far */
const BURN = `{ vec2 P = (vMapUv - 0.5) * uSize; float n = rvF(P * 2.6 + 3.0);
  float f = uP - (length(P - uO) + (n - 0.5) * 0.55);
  if (f > 0.0) discard;
  float rim = exp(f * 38.0), scorch = smoothstep(-0.32, -0.015, f);
  diffuseColor.rgb *= 1.0 - 0.93 * scorch;
  float fl = 0.75 + 0.5 * rvN(P * 14.0 + vec2(0.0, -uTime * 6.0));
  totalEmissiveRadiance += (mix(uEdge2, uEdge, smoothstep(0.15, 0.9, rim)) * rim * 2.6 + uEdge2 * scorch * 0.12) * fl; }
`;
/* the scan line: s is the height up the back (world units, along the world's up), uP the line; above it is gone */
const SCAN = `{ vec2 P = (vMapUv - 0.5) * uSize; float s = dot(P, uUp);
  s += (rvN(vec2(s * 90.0, uTime * 30.0)) - 0.5) * 0.06 * uGl;
  float f = s - uP;
  if (f > 0.0) discard;
  float line = exp(-pow(f / 0.02, 2.0)), wake = exp(f * 9.0);
  vec2 g = fract(P * 9.0); float grid = max(step(0.93, g.x), step(0.93, g.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.4 + uEdge * 0.2, wake * 0.6);
  totalEmissiveRadiance += uEdge * (line * 3.0 + wake * 0.25 + grid * wake * 0.9); }
`;
/* the develop overlay: paper over the photo, thinning where the photo is dark first, with the developer washing over it */
const DEV_V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DEV_F = `uniform sampler2D uTex; uniform float uP; uniform float uTime; uniform vec3 uPaper; varying vec2 vUv;
${NOISE}
void main(){ vec3 c = texture2D(uTex, vUv).rgb; float d = 1.0 - dot(c, vec3(0.299, 0.587, 0.114));
  float wave = sin(dot(vUv, vec2(7.0, 4.0)) * 3.0 - uTime * 2.6) * 0.07 + (rvF(vUv * 6.0 + vec2(uTime * 0.25, 0.0)) - 0.5) * 0.22;
  float thr = 1.08 - uP * 1.5;
  float dev = clamp((d + wave - thr) / 0.4, 0.0, 1.0);
  float wet = 0.06 * sin(vUv.y * 40.0 + uTime * 5.0) * (1.0 - uP);
  gl_FragColor = vec4(uPaper + wet, 1.0 - dev);
  #include <colorspace_fragment>
}`;

export function install(S) {
  const { T } = S, E = T.E, ctx = S.ctx;
  S.dev.define('reveal', 'Reveal style', { flip: 'Flip (current)', develop: 'Develop', shatter: 'Shatter', burn: 'Burn away', charge: 'Power up', scan: 'Scan line' }, 'flip');
  S.dev.define('reelLen', 'Reel length', { full: 'Full', short: 'Short (testing)' }, 'full');
  const snd = (id, o) => { try { return S.snd && S.snd.play ? S.snd.play(id, o) : null; } catch (e) { return null; } };
  const additive = (o) => ({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...(o || {}) });

  /* ---------- shared pieces ---------- */
  /* where the back is right now (face down, facing the camera): its world frame, its size, and its normal */
  function backSnap(c) {
    const b = c.slot.back || (c.obj.parts && c.obj.parts.back); if (!b || !b.geometry || !b.geometry.parameters) return null; b.updateMatrixWorld(true);
    const pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); b.matrixWorld.decompose(pos, q, sc);
    const p = b.geometry.parameters, w = p.width * Math.abs(sc.x), h = p.height * Math.abs(sc.y), n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q.clone().invert()); const up2 = new THREE.Vector2(up.x, up.y).normalize();
    return { mesh: b, pos, q, w, h, n, up2, ext: 0.5 * (Math.abs(up2.x) * w + Math.abs(up2.y) * h) };
  }
  /* a group sitting exactly on the back, a hair towards the camera; children are in world units */
  function onBack(c, sn, lift) { const g = new THREE.Group(); g.position.copy(sn.pos).addScaledVector(sn.n, lift ?? 0.02); g.quaternion.copy(sn.q); g.userData.noParticles = true; S.scene.add(g); g.updateMatrixWorld(true); c.junk.push(g); return g; }
  /* the point you clicked, in the back group's plane (or a default) */
  function hitOn(c, g, def) { if (c.hit) { const p = g.worldToLocal(c.hit.clone()); return new THREE.Vector2(p.x, p.y); } return def.clone(); }
  /* the back's own material with a mask in its fragment shader (burn or scan); the textures stay the back's */
  function maskedBack(sn, mode, u) {
    const m = sn.mesh.material.clone(); m.side = THREE.FrontSide;
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, u);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uP; uniform vec2 uO; uniform vec2 uSize; uniform vec2 uUp; uniform float uGl; uniform vec3 uEdge; uniform vec3 uEdge2; uniform float uTime;\n' + NOISE)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (mode === 'burn' ? BURN : SCAN)); };
    m.customProgramCacheKey = () => 'reveal-' + mode + '-' + m.type; return m;
  }
  /* a tween on the rail's clock that throws when the rail closes under it */
  const step = (dur, fn, ease) => T.tween({ dur, ease: ease || E.linear, tag: 'rail', update: (e, raw) => { if (fn) fn(e, raw); } }).then(ok => { if (!ok) throw STOP; });
  const check = c => { if (!c.alive()) throw STOP; };
  /* the hanger trembling round its rest; amp() is read every frame */
  function tremble(c, amp) { const h = c.slot.h, rest = h.position.clone(); let on = true; c.undo.push(() => { on = false; h.position.copy(rest); });
    const f = () => { if (!on || !c.alive()) return; const a = amp(); h.position.set(rest.x + (Math.random() - 0.5) * a, rest.y + (Math.random() - 0.5) * a * 0.6, rest.z); requestAnimationFrame(f); }; requestAnimationFrame(f);
    return () => { on = false; h.position.copy(rest); }; }
  /* the flip without the drama: a plain turn to face up (develop), or at once (under a cover) */
  /* a holo rig for a style's own particles while it plays (its clock runs for dur); disposed when the reveal ends */
  function side(c, kind, dur) { const R = S.holo.rig(c.obj, kind); R.fx.updateMatrixWorld(true); R.run(dur).catch(() => {}); c.junk.push({ dispose: () => R.dispose() }); return R; }
  const faceUp = c => { c.spin.rotation.y = c.y0 + Math.PI; c.spin.position.z = 0; };

  /* ---------- the payoff once the face is showing: tier-scaled, in the style's own flavour ---------- */
  const FLAVOUR = {
    glass: R => ({ c: R.cloud(900, { grav: 2.4 }), v: () => { const a = Math.random() * Math.PI * 2, s = (0.5 + Math.random()) * R.w * 0.9; return new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s, (0.8 + Math.random() * 2) * R.w * 0.5); }, life: 1.1, size: 0.42 }),
    ember: R => ({ c: R.cloud(900, { grav: -0.35, sway: R.w * 0.06, ember: true }), v: () => new THREE.Vector3((Math.random() - 0.5) * R.w * 0.2, (Math.random() - 0.2) * R.w * 0.3, (0.3 + Math.random() * 0.6) * R.w * 0.5), life: 2.2, size: 0.45 }),
    drip: R => ({ c: R.cloud(900, { grav: 3.6 }), v: () => { const a = Math.random() * Math.PI * 2, s = Math.random() * R.w * 0.35; return new THREE.Vector3(Math.cos(a) * s, Math.abs(Math.sin(a)) * s, (0.3 + Math.random()) * R.w * 0.4); }, life: 1.4, size: 0.38 }),
    energy: R => ({ c: R.cloud(900, { grav: 0.4 }), v: () => { const a = Math.random() * Math.PI * 2, s = (0.8 + Math.random() * 1.4) * R.w; return new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.3) * R.w * 0.6); }, life: 0.9, size: 0.5 }),
    data: R => ({ c: R.cloud(900, { grav: 0 }), v: () => { const a = Math.floor(Math.random() * 4) * Math.PI / 2, s = (0.3 + Math.random()) * R.w * 0.8; return new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s, Math.random() * R.w * 0.3); }, life: 1.0, size: 0.36 }),
  };
  async function payoff(c, o) {
    const R = S.holo.rig(c.obj, 'reveal'); c.rig = R; const idx = c.idx, col = new THREE.Color(c.col), tint = new THREE.Color(o.tint ?? c.col), white = new THREE.Color(0xffffff), H = S.holo.tex;
    snd('chime', { tier: idx >= 4 ? 'epic' : c.tier }); if (idx >= 4) snd('slam', { k: idx >= 5 ? 1 : 0.8 });
    c.r.burstT = T.time(); c.r.keyFlash = 0.6 + 0.2 * idx;
    const sh = R.sheen({ color: tint.clone().lerp(white, 0.45), amount: 0.5 + 0.08 * idx, width: 0.15, hue: !!o.hue });
    R.roll(0.05, 1.0 + 0.25 * idx, 0.7 + 0.08 * idx);
    const F = FLAVOUR[o.kind || 'glass'](R), n = 60 + 70 * idx;
    const spray = (m, mix) => F.c.emit(m, () => R.onPrint(o.kind === 'drip' ? 0.95 : 1.0), F.v, () => R.photoColor(Math.random() < 0.5 ? tint : col, mix ?? 0.45), F.life, F.size * R.w / 2.9);
    spray(n); if (idx >= 2) R.at(0.35, () => spray(Math.round(n * 0.6), 0.6)); if (o.kind === 'ember') { R.at(0.7, () => spray(n)); R.at(1.2, () => spray(Math.round(n * 0.7))); }
    if (idx >= 1) R.shock(tint.clone().lerp(white, 0.3), 0.45, R.w * (1.4 + 0.4 * idx));
    if (idx >= 2) R.at(0.18, () => R.shock(col, 0.4, R.w * (1.6 + 0.4 * idx)));
    let rays = null, rays2 = null, stamp = null;
    if (idx >= 3) { R.dim(0.45 + 0.08 * idx); R.at(1.4 + 0.3 * idx, () => R.dim(0));
      rays = R.add(new THREE.Mesh(new THREE.PlaneGeometry(R.w * 3.4, R.w * 3.4), new THREE.MeshBasicMaterial(additive({ map: H.rays(26), color: col, opacity: 0 }))), R.below);
      rays2 = R.add(new THREE.Mesh(rays.geometry.clone(), new THREE.MeshBasicMaterial(additive({ map: H.rays(18), color: tint.clone().lerp(white, 0.5), opacity: 0 }))), R.below + 0.0003 / R.k); rays2.rotation.z = 0.9; }
    if (idx >= 4) { R.flash(0.25 + 0.15 * (idx - 4), idx >= 5 ? 0xffffff : 0xfff0d8); R.jolt(R.w * 0.05 * R.k); R.at(0.3, () => R.shock(0xffffff, 0.5, R.w * 3.0)); }
    if (idx >= 5) { stamp = new THREE.Mesh(new THREE.PlaneGeometry(R.w * 0.78, R.w * 0.78 * 0.4), new THREE.MeshBasicMaterial({ map: H.stamp(), transparent: true, opacity: 0, depthWrite: false, depthTest: false })); stamp.rotation.z = -0.09; stamp.renderOrder = 30; R.add(stamp, R.above + 0.05 / R.k); stamp.position.y = -R.h * 0.12;
      R.at(0.75, () => { snd('slam', { k: 0.7 }); R.flash(0.55, 0xffffff); R.jolt(R.w * 0.04 * R.k); }); }
    const D = 1.3 + 0.45 * idx;
    R.tick((t, dt) => { if (sh) sh.material.uniforms.uX.value = -0.4 + 2.0 * Math.min(1, t / (0.7 + 0.1 * idx));
      if (rays) { const k = Math.min(1, t / 0.5), out = 1 - Math.min(1, Math.max(0, (t - D + 0.9) / 0.9)), e = k * k * (3 - 2 * k); rays.material.opacity = 0.32 * e * out; rays2.material.opacity = 0.2 * e * out; rays.rotation.z += dt * 0.35; rays2.rotation.z -= dt * 0.25; rays.scale.setScalar(0.45 + 0.55 * e); rays2.scale.setScalar(0.5 + 0.7 * e); }
      if (stamp) { const s = Math.min(1, Math.max(0, (t - 0.75) / 0.22)), so = 1 - Math.min(1, Math.max(0, (t - D + 0.6) / 0.6)); stamp.material.opacity = s * so; stamp.scale.setScalar(Math.max(0.001, 2.6 - 1.6 * E.outBack(s))); } });
    await R.wait(D);
  }

  /* ---------- develop: blank paper, then the image comes up in the tray ---------- */
  async function develop(c) {
    const ph = c.obj.parts && c.obj.parts.photo, tex = ph && (ph.material.emissiveMap || ph.material.map); if (!ph || !tex) return shatter(c);
    const ov = new THREE.Mesh(ph.geometry.clone(), new THREE.ShaderMaterial({ uniforms: { uTex: { value: tex }, uP: { value: 0 }, uTime: { value: 0 }, uPaper: { value: new THREE.Color(0xf4f0e6) } }, vertexShader: DEV_V, fragmentShader: DEV_F, transparent: true, depthWrite: false }));
    ov.position.copy(ph.position); ov.position.z += 0.016; ov.renderOrder = 40; ov.userData.noParticles = true; ph.parent.add(ov); c.junk.push(ov);
    /* the turn: a plain flick, and it is blank */
    snd('flip'); const sp = c.spin, y0 = c.y0;
    await step(0.55, e => { sp.rotation.y = y0 + Math.PI * e; sp.position.z = 0.4 * Math.sin(e * Math.PI); }, E.inOutCubic); check(c); faceUp(c);
    await step(0.35); check(c);
    /* into the developer: the print tips back and rocks, the safelight surges, drips run off the foot */
    const D = 1.7 + 0.45 * c.idx, r = c.r, red0 = r.redK; snd('develop', { dur: D + 0.3 });
    const R = side(c, 'develop', D + 2); const drips = R.cloud(300, { grav: 3.2 }); let acc = 0;
    await step(D, (e, raw) => { const u = ov.material.uniforms; u.uP.value = e; u.uTime.value = T.time(); sp.rotation.x = -0.18 * Math.sin(raw * Math.PI) + 0.05 * Math.sin(raw * D * 5.2) * (1 - raw); sp.rotation.z = 0.04 * Math.sin(raw * D * 3.7) * (1 - raw);
      r.redK = red0 * (1 + 0.6 * Math.sin(raw * Math.PI));
      acc += 0.016 * 30; const n = Math.floor(acc); if (n > 0) { acc -= n; drips.emit(n, () => new THREE.Vector3((Math.random() - 0.5) * R.w * 0.9, -R.h * 0.5, R.th), () => new THREE.Vector3(0, -Math.random() * 0.3, 0.05), () => new THREE.Color(0xffc8b8), 0.9, 0.22 * R.w / 2.9); } }, t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 1.6) / 2);
    check(c); ov.visible = false; sp.rotation.x = 0; sp.rotation.z = 0;
    /* the fix: the safelight goes and the room comes up in the tier colour */
    T.tween({ dur: 0.6, tag: 'rail', update: e => { r.redK = red0 * (1 - 0.75 * e); } });
    await payoff(c, { kind: 'drip', tint: 0xfff2e0 });
  }

  /* ---------- shatter: cracks from the click, light through them, then the glass goes ---------- */
  async function shatter(c) {
    const sn = backSnap(c); if (!sn) return charge(c);
    const g = onBack(c, sn, 0.015), idx = c.idx, col = new THREE.Color(c.col), white = new THREE.Color(0xffffff), w = sn.w, h = sn.h;
    const mat = sn.mesh.material.clone(); mat.side = THREE.DoubleSide; mat.transparent = true; c.junk.push({ dispose: () => mat.dispose() });
    /* a jittered grid, cut into triangles: the shards */
    const nx = 4 + idx, ny = Math.max(4, Math.round(nx * h / w)), pts = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const ex = i === 0 || i === nx, ey = j === 0 || j === ny; pts.push(new THREE.Vector2((i / nx - 0.5) * w + (ex ? 0 : (Math.random() - 0.5) * w / nx * 0.7), (j / ny - 0.5) * h + (ey ? 0 : (Math.random() - 0.5) * h / ny * 0.7))); }
    const P = (i, j) => pts[j * (nx + 1) + i], tris = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1); if (Math.random() < 0.5) tris.push([a, b, cc], [a, cc, d]); else tris.push([a, b, d], [b, cc, d]); }
    const hit = hitOn(c, g, new THREE.Vector2(0, h * 0.08)), maxD = Math.hypot(w, h);
    const shards = tris.map(t => { const ctr = new THREE.Vector2().add(t[0]).add(t[1]).add(t[2]).multiplyScalar(1 / 3), pos = [], uv = [];
      t.forEach(p => { pos.push(p.x - ctr.x, p.y - ctr.y, 0); uv.push(p.x / w + 0.5, p.y / h + 0.5); });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
      const m = new THREE.Mesh(geo, mat); m.position.set(ctr.x, ctr.y, 0); g.add(m); return { m, ctr, d: ctr.distanceTo(hit) }; });
    faceUp(c);   /* the face turns under the glass at once; nothing shows until the glass goes */
    /* the cracks: every shard edge, drawn outward from the click, in light that leaks through in the tier colour */
    const segs = []; tris.forEach(t => [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => { const A = t[a], B = t[b]; if ((Math.abs(A.x - B.x) < 1e-5 && Math.abs(Math.abs(A.x) - w / 2) < 1e-5) || (Math.abs(A.y - B.y) < 1e-5 && Math.abs(Math.abs(A.y) - h / 2) < 1e-5)) return; segs.push({ A, B, d: Math.min(A.distanceTo(hit), B.distanceTo(hit)) }); }));
    segs.sort((a, b) => a.d - b.d); const lp = []; segs.forEach(s => lp.push(s.A.x, s.A.y, 0.004, s.B.x, s.B.y, 0.004));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setDrawRange(0, 0);
    const crackCol = idx >= 2 ? col.clone().lerp(white, 0.35) : new THREE.Color(0xfff6e8), lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial(additive({ color: crackCol, opacity: 1 }))); lines.renderOrder = 30; g.add(lines);
    const leak = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.2, w * 1.2), new THREE.MeshBasicMaterial(additive({ map: S.holo.tex.soft(), color: crackCol, opacity: 0 }))); leak.position.set(hit.x, hit.y, 0.01); leak.renderOrder = 31; g.add(leak);
    const amp = { a: 0 }; tremble(c, () => amp.a);
    /* one crack per beat: two for rare and up, three for legendary and up; each runs further and leaks more light */
    const beats = idx >= 4 ? 3 : idx >= 2 ? 2 : 1, total = segs.length * 2;
    for (let b = 0; b < beats; b++) { snd('crack', { k: 0.6 + 0.2 * b }); const from = Math.round(total * (b / beats) * 0.9), to = Math.round(total * ((b + 1) / beats) * 0.9);
      await step(0.16 + 0.04 * b, e => { lg.setDrawRange(0, Math.round(from + (to - from) * e) & ~1); amp.a = 0.03 * (b + 1); leak.material.opacity = (0.25 + 0.3 * b / Math.max(1, beats - 1)) * (0.6 + 0.4 * e); leak.scale.setScalar(0.4 + 0.5 * (b + e) / beats); }, E.outCubic); check(c);
      await step(b === beats - 1 ? 0.18 + 0.05 * idx : 0.32); check(c); }
    /* the break */
    amp.a = 0; lines.visible = false; leak.visible = false; snd('shatter', { k: 0.6 + 0.1 * idx });
    const grav = new THREE.Vector3(0, -9, 0).applyQuaternion(sn.q.clone().invert()), kk = 0.6 + 0.25 * idx;
    shards.forEach(s => { const dir = s.ctr.clone().sub(hit); const dl = dir.length() || 1; dir.multiplyScalar(1 / dl);
      s.v = new THREE.Vector3(dir.x * (1.2 + 2.2 * kk) * (1.25 - 0.6 * dl / maxD), dir.y * (1.2 + 2.2 * kk) * (1.25 - 0.6 * dl / maxD), (1.5 + Math.random() * 2.5) * kk); s.av = new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8); s.t0 = (dl / maxD) * 0.1; });
    let last = 0; const fly = step(1.2, (e, raw) => { const t = raw * 1.2, dt = Math.max(0, t - last); last = t;
      shards.forEach(s => { if (t < s.t0) return; s.v.addScaledVector(grav, dt); s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += s.av.x * dt; s.m.rotation.y += s.av.y * dt; s.m.rotation.z += s.av.z * dt; });
      mat.opacity = 1 - Math.max(0, (t - 0.45) / 0.75); }).catch(() => {});
    await payoff(c, { kind: 'glass', tint: idx >= 2 ? c.col : 0xffffff }); await fly;
  }

  /* ---------- burn: the back catches where you clicked and burns away ---------- */
  async function burn(c) {
    const sn = backSnap(c); if (!sn) return charge(c);
    const g = onBack(c, sn, 0.012), idx = c.idx, w = sn.w, h = sn.h;
    const hot = [[0xff6a1a, 0xffe2a0], [0xff6a1a, 0xffe2a0], [0xff4a2a, 0xffd8a0], [0xff3fa8, 0xffd0f0], [0xff8a1a, 0xfff2c0], [0xffc040, 0xffffff]][idx];
    const u = { uP: { value: -0.2 }, uO: { value: hitOn(c, g, new THREE.Vector2(0, -h * 0.38)) }, uSize: { value: new THREE.Vector2(w, h) }, uUp: { value: sn.up2 }, uGl: { value: 0 }, uEdge: { value: new THREE.Color(hot[1]) }, uEdge2: { value: new THREE.Color(hot[0]) }, uTime: { value: 0 } };
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(w, h), maskedBack(sn, 'burn', u)); cover.renderOrder = 5; g.add(cover);
    faceUp(c);
    const O = u.uO.value, far = Math.max(...[[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2]].map(([x, y]) => Math.hypot(x - O.x, y - O.y))) + 0.35;
    /* the catch: a glow where you clicked that swells, then it goes */
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, w * 0.9), new THREE.MeshBasicMaterial(additive({ map: S.holo.tex.soft(), color: hot[0], opacity: 0 }))); glow.position.set(O.x, O.y, 0.01); glow.renderOrder = 31; g.add(glow);
    snd('ignite', { dur: 0.35 }); await step(0.3 + 0.08 * idx, e => { glow.material.opacity = 0.9 * e; glow.scale.setScalar(0.2 + 0.5 * e); u.uTime.value = T.time(); }, E.inQuad); check(c);
    const D = 1.15 + 0.3 * idx; snd('ignite', { dur: D });
    const R = side(c, 'burn', D + 3); const embers = R.cloud(1200, { grav: -0.5, sway: R.w * 0.05, ember: true }); const wp = new THREE.Vector3();
    await step(D, e => { const rad = -0.2 + (far + 0.2) * e; u.uP.value = rad; u.uTime.value = T.time(); glow.material.opacity = 0.9 * (1 - e); glow.scale.setScalar(0.7 + 1.5 * e);
      const n = Math.round(6 + 4 * idx); embers.emit(n, () => { for (let k = 0; k < 6; k++) { const a = Math.random() * Math.PI * 2, x = O.x + Math.cos(a) * rad * 0.95, y = O.y + Math.sin(a) * rad * 0.95; if (Math.abs(x) < w / 2 && Math.abs(y) < h / 2) return R.fx.worldToLocal(g.localToWorld(wp.set(x, y, 0.02))).clone(); } return R.onPrint(1.0); },
        () => new THREE.Vector3((Math.random() - 0.5) * R.w * 0.1, (0.1 + Math.random() * 0.3) * R.w * 0.4, (0.2 + Math.random() * 0.5) * R.w * 0.4), () => new THREE.Color(Math.random() < 0.6 ? hot[0] : hot[1]), 1.6, 0.36 * R.w / 2.9); }, E.inOutSine);
    check(c); cover.visible = false; glow.visible = false;
    await payoff(c, { kind: 'ember', tint: hot[0] });
  }

  /* ---------- charge: energy drawn in, the glow climbing the tier ladder, then it spins face up ---------- */
  async function charge(c) {
    const idx = c.idx, h = c.slot.h, sp = c.spin, y0 = c.y0, ladder = TIERS.slice(0, idx + 1).map(t => new THREE.Color(t.color)), white = new THREE.Color(0xffffff);
    const G = new THREE.Group(); G.position.copy(sp.position); G.position.z -= 0.05; h.add(G); c.junk.push(G);
    const ow = (c.obj.w || 2.9) * 0.4, oh = (c.obj.h || 3.9) * 0.4, rr = Math.hypot(ow, oh);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(rr * 3, rr * 3), new THREE.MeshBasicMaterial(additive({ map: S.holo.tex.soft(), color: ladder[0], opacity: 0 }))); G.add(halo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 96), new THREE.MeshBasicMaterial(additive({ color: ladder[0], opacity: 0, side: THREE.DoubleSide }))); ring.position.z = 0.4; G.add(ring);
    /* streaks of light rushing in from all round */
    const streaks = Array.from({ length: 36 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.025), new THREE.MeshBasicMaterial(additive({ color: 0xffffff, opacity: 0 }))); m.userData = { a: Math.random() * Math.PI * 2, r: rr * (1 + Math.random() * 2.5), sp: 0.6 + Math.random() }; m.position.z = 0.3; G.add(m); return m; });
    const amp = { a: 0 }; tremble(c, () => amp.a);
    const D = 0.9 + 0.38 * idx, per = D / ladder.length; let cur = 0; const now = ladder[0].clone();
    snd('charge', { dur: D + 0.1 });
    await step(D, (e, raw) => { const t = raw * D, li = Math.min(ladder.length - 1, Math.floor(t / per));
      if (li !== cur) { cur = li; snd('step', { i: li }); ring.scale.setScalar(rr * 0.5); ring.material.opacity = 1; }
      now.lerp(ladder[cur], 0.25); halo.material.color.copy(now); ring.material.color.copy(now).lerp(white, 0.3);
      halo.material.opacity = 0.25 + 0.55 * raw; halo.scale.setScalar(0.5 + 0.35 * raw + 0.06 * Math.sin(t * 30) * raw);
      ring.scale.multiplyScalar(1.035); ring.material.opacity *= 0.93;
      amp.a = 0.004 + 0.06 * raw * raw;
      streaks.forEach(m => { const u = m.userData; u.r -= 0.016 * u.sp * (3 + 14 * raw) * rr * 0.4; if (u.r < rr * 0.35) { u.r = rr * (1.6 + Math.random() * 2); u.a = Math.random() * Math.PI * 2; } m.position.x = Math.cos(u.a) * u.r; m.position.y = Math.sin(u.a) * u.r; m.rotation.z = u.a; m.scale.x = rr * (0.25 + 0.6 * raw); m.material.opacity = Math.min(1, (u.r - rr * 0.35) / rr) * (0.3 + 0.7 * raw); m.material.color.copy(now).lerp(white, 0.5); }); }, E.inQuad);
    check(c); amp.a = 0; streaks.forEach(m => { m.visible = false; });
    /* the release: it spins round, a full turn more for every two tiers, and lands face up */
    snd('burst', { k: 0.7 + 0.1 * idx }); snd('flip'); const turns = 1 + Math.floor(idx / 2), RD = 0.75 + 0.1 * idx;
    ring.scale.setScalar(rr * 0.4); ring.material.opacity = 1;
    await step(RD, (e, raw) => { sp.rotation.y = y0 + (Math.PI + Math.PI * 2 * turns) * e; sp.position.z = 0.6 * Math.sin(Math.min(1, raw * 1.4) * Math.PI); halo.material.opacity = 0.8 * (1 - raw * 0.6); ring.scale.multiplyScalar(1.06); ring.material.opacity *= 0.92; }, E.outQuart);
    check(c); faceUp(c); halo.visible = false;
    await payoff(c, { kind: 'energy', tint: c.col, hue: idx >= 5 });
  }

  /* ---------- scan: a beam in the finish's colour scans down and the face shows above it ---------- */
  async function scan(c) {
    const sn = backSnap(c); if (!sn) return charge(c);
    const g = onBack(c, sn, 0.012), idx = c.idx, w = sn.w, h = sn.h, beamCol = (c.r.glow && c.r.glow.color ? c.r.glow.color.clone() : new THREE.Color(0x9ff3ff)).lerp(new THREE.Color(c.col), 0.35);
    const u = { uP: { value: sn.ext + 0.05 }, uO: { value: new THREE.Vector2() }, uSize: { value: new THREE.Vector2(w, h) }, uUp: { value: sn.up2 }, uGl: { value: 0 }, uEdge: { value: beamCol }, uEdge2: { value: beamCol }, uTime: { value: 0 } };
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(w, h), maskedBack(sn, 'scan', u)); cover.renderOrder = 5; g.add(cover);
    faceUp(c);
    /* the beam: a bar of light across the print with a flare at each end, square to the world's up */
    const L = Math.max(w, h) * 1.25, beam = new THREE.Group(); beam.rotation.z = Math.atan2(sn.up2.y, sn.up2.x) - Math.PI / 2; g.add(beam);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.09), new THREE.MeshBasicMaterial(additive({ map: S.holo.tex.soft(), color: beamCol }))); bar.position.z = 0.02; bar.renderOrder = 32; beam.add(bar);
    const core = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.9, 0.012), new THREE.MeshBasicMaterial(additive({ color: 0xffffff }))); core.position.z = 0.025; core.renderOrder = 33; beam.add(core);
    const flares = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial(additive({ map: S.holo.tex.rays(10), color: beamCol }))); m.position.set(s * (Math.abs(sn.up2.x) * h + Math.abs(sn.up2.y) * w) / 2, 0, 0.03); m.renderOrder = 34; beam.add(m); return m; });
    const D = 1.0 + 0.32 * idx, top = sn.ext + 0.05, bot = -sn.ext - 0.05, stall = idx >= 3;
    snd('scan', { dur: D + (stall ? 0.5 : 0) });
    /* the path: straight down; from epic up it glitches halfway, stalls and backs up a little, then races to the foot */
    const path = raw => { if (!stall) return raw; if (raw < 0.45) return raw / 0.45 * 0.5; if (raw < 0.7) return 0.5 - 0.06 * Math.sin((raw - 0.45) / 0.25 * Math.PI); return 0.5 + 0.5 * E.inQuad((raw - 0.7) / 0.3); };
    await step(D + (stall ? 0.5 : 0), (e, raw) => { const k = path(raw), y = top + (bot - top) * k, gl = stall && raw > 0.45 && raw < 0.72 ? 1 : 0.15;
      u.uP.value = y; u.uGl.value = gl; u.uTime.value = T.time(); beam.position.set(sn.up2.x * y, sn.up2.y * y, 0); bar.material.opacity = 0.8 + 0.2 * Math.random() * gl; core.material.opacity = gl > 0.5 && Math.random() < 0.3 ? 0.2 : 1;
      beam.position.x += gl > 0.5 ? (Math.random() - 0.5) * 0.08 : 0; flares.forEach(f => { f.rotation.z += 0.08; f.scale.setScalar(0.8 + 0.4 * Math.random() * (gl + 0.3)); });
      if (gl > 0.5 && Math.random() < 0.08) snd('crack', { k: 0.25 }); }, E.linear);
    check(c); cover.visible = false; beam.visible = false;
    await payoff(c, { kind: 'data', tint: beamCol, hue: c.idx >= 4 });
  }

  const STYLES = { develop, shatter, burn, charge, scan };
  async function run(style, o) {
    const tier = (o.obj.slab && o.obj.slab.tier) || 'common', c = { ...o, tier, idx: TI[tier] ?? 0, col: (TIER[tier] || TIER.common).color, junk: [], undo: [] };
    /* the rail's own landing glow and burst give way: each style lights itself */
    const r = c.r; r.burstT = T.time(); [r.flood, r.rim, r.burst, r.ring].forEach(m => { if (m) m.visible = false; });
    try { await (STYLES[style] || charge)(c); }
    catch (e) { if (e !== STOP && e !== S.holo.CANCEL) console.error('reveal', e); }
    finally { c.undo.forEach(f => { try { f(); } catch (e) {} }); if (c.rig) c.rig.dispose();
      c.junk.forEach(j => { try { if (j.isObject3D) { if (j.parent) j.parent.remove(j); j.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); }   /* materials only: the textures are the print's and holo's shared ones */ else if (j.dispose) j.dispose(); } catch (e) {} });
      if (c.alive()) faceUp(c); }
  }
  S.reveals = { style: () => S.dev.opt('reveal') || 'flip', run, styles: Object.keys(STYLES) };
}
