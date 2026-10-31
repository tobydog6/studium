// FXCASE: the case extras (slabs.js EXTRAS, slot 'case'; Sam's picks in docs/slab-extras.md): something that lives
// inside the acrylic, over whatever finish and variant the slab has. Dust, a trapped bubble, tinted acrylic, a pressed
// flower, a crack, oil with glitter (and sometimes a goldfish), a snow globe, a sand timer, a terrarium, amber with an
// insect in it, crystals that grow a little each day you own it. Only graded slabs have them showing (a raw print only
// hints in its hover glow); a slab back from grading holds its extra back until the grade has counted up, then it
// arrives (reveal()). Things that fall (snow, sand, the bubble rising) follow the real way up of the slab; things that
// stir follow how fast it moves.
//   caseFx(obj, S) → { group, update(dt), reveal(), dispose() } | null      (slabmesh.js mounts it in build())
import * as THREE from 'three';
import { extrasOf, extraFits, finishOf, EXTRA, store } from './slabs.js';
import { studioEnvs } from './fxkit.js';

const NO_RAY = () => {};
const rngOf = s => () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const canvasTex = (c, data) => { const t = new THREE.CanvasTexture(c); t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const snd = (S, id, o) => { try { if (S.snd) S.snd.play(id, o); } catch (e) {} };
const VV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

/* soft round points sized in world units (they shrink with the slab on the table) */
const PTS_V = `attribute float aS; attribute vec4 aC; uniform float uSize; uniform float uVH; varying vec4 vC;
  void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, uSize * aS * projectionMatrix[1][1] * uVH * 0.5 * length(modelViewMatrix[0].xyz) / max(0.01, -mv.z)); vC = aC; }`;
const PTS_F = `uniform float uSoft; varying vec4 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = 1.0 - smoothstep(uSoft, 1.0, r); if (a < 0.01) discard; gl_FragColor = vec4(vC.rgb, vC.a * a);
  #include <colorspace_fragment>
}`;
function points(n, size, soft) {
  const g = new THREE.BufferGeometry(), P = new Float32Array(n * 3), A = new Float32Array(n), C = new Float32Array(n * 4);
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.BufferAttribute(A, 1)); g.setAttribute('aC', new THREE.BufferAttribute(C, 4));
  const u = { uSize: { value: size }, uVH: { value: 800 }, uSoft: { value: soft ?? 0.4 } };
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: PTS_V, fragmentShader: PTS_F, transparent: true, depthWrite: false }));
  pts.frustumCulled = false; pts.userData.keepDepth = true; pts.userData.noParticles = true; pts.raycast = NO_RAY;
  return { pts, P, A, C, u, dirty() { g.attributes.position.needsUpdate = true; g.attributes.aC.needsUpdate = true; g.attributes.aS.needsUpdate = true; } };
}
/* multiply blending: what's behind is coloured by this (tinted acrylic, amber) */
const multiplyMat = col => new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor });
const plane = (w, h, mat, order) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.userData.order = order; m.userData.noParticles = true; m.raycast = NO_RAY; return m; };

export function caseFx(obj, S) {
  const slab = obj.slab, id = extrasOf(slab).case; if (!id || !EXTRA[id] || !slab.graded) return null;
  if (!extraFits(id, finishOf(slab, S.testFinish ? S.testFinish() : null), slab.variant)) return null;   /* a finish changed since the pull (or the dev test finish) may leave no room */
  const x = extrasOf(slab), r = rngOf(((slab.seed >>> 0) ^ 0x5ca1ab1e) >>> 0), group = new THREE.Group(); group.userData.noParticles = true;
  const th = obj.th, B = { x: obj.w / 2 - 0.09, y: obj.h / 2 - 0.09, z0: -th / 2 + 0.05, z1: th / 2 - 0.014 };
  const env = studioEnvs(S.renderer), ctx = { S, obj, slab, x, r, B, env, group, g: new THREE.Vector3(0, 0, -1), gxy: 0, stir: 0, t: 0, k: 1 };
  const make = MAKERS[id]; if (!make) return null;
  const fx = make(ctx); obj.inner.add(group);
  /* held back (obj.holdCase) while a parcel counts up its grade or the rail reveals a pull; reveal() lets it arrive */
  let hold = !!obj.holdCase, intro = hold ? -1 : 1; group.visible = !hold;
  const Q = new THREE.Quaternion(), lastP = new THREE.Vector3(), lastQ = new THREE.Quaternion(), V = new THREE.Vector3(), lastTilt = new THREE.Vector2(); let first = true;
  const size = new THREE.Vector2();
  return { group, id,
    update(dt) { if (!(dt > 0)) return; dt = Math.min(dt, 0.05); ctx.t += dt;
      /* which way is down inside the case, and how hard it's being moved */
      obj.inner.updateWorldMatrix(true, false); obj.inner.getWorldQuaternion(Q); const qi = Q.clone().invert(); ctx.g.set(0, -1, 0).applyQuaternion(qi); ctx.gxy = Math.hypot(ctx.g.x, ctx.g.y);
      obj.inner.getWorldPosition(V); if (first) { first = false; lastP.copy(V); lastQ.copy(Q); lastTilt.copy(obj.tilt); }
      const lin = V.distanceTo(lastP) / dt, ang = 2 * Math.acos(Math.min(1, Math.abs(Q.dot(lastQ)))) / dt, tl = obj.tilt.distanceTo(lastTilt) / dt;
      lastP.copy(V); lastQ.copy(Q); lastTilt.copy(obj.tilt);
      const want = Math.min(3, lin * 0.25 + ang * 0.5 + tl * 0.6); ctx.stir += (want - ctx.stir) * (1 - Math.exp(-dt * 8));
      if (intro >= 0 && intro < 1) { intro = Math.min(1, intro + dt / (fx.introDur || 1.4)); ctx.k = intro; if (fx.intro) fx.intro(intro); }
      S.renderer.getDrawingBufferSize(size); ctx.vh = size.y;
      if (fx.update) fx.update(dt, ctx); },
    /* back from grading: the extra arrives once the grade has counted up */
    hold() { hold = true; group.visible = false; intro = -1; }, held: () => hold,
    /* o.quiet: no sound or toast (the rail closed early); o.toast false: the caller names it in its own toast */
    reveal(o = {}) { if (!hold) return; hold = false; obj.holdCase = false; group.visible = true; if (o.quiet) { intro = 1; ctx.k = 1; if (fx.intro) fx.intro(1); return; }
      intro = 0; ctx.k = 0; if (fx.intro) fx.intro(0); if (fx.onReveal) fx.onReveal(); else snd(S, 'shimmer', { k: 0.5 });
      if (o.toast !== false && S.toast) S.toast('Inside the case: ' + EXTRA[id].name + (id === 'liquid' && x.fish ? ', with a goldfish' : '') + '.'); },
    dispose() { if (group.parent) group.parent.remove(group); if (fx.dispose) fx.dispose(); group.traverse(m => { if (m.geometry) m.geometry.dispose(); [].concat(m.material || []).forEach(mt => { if (mt.map) mt.map.dispose(); if (mt.uniforms) for (const k in mt.uniforms) { const v = mt.uniforms[k].value; if (v && v.isTexture) v.dispose(); } mt.dispose(); }); }); } };
}

/* ---------------------------------------------------------------- the extras */
const MAKERS = {
  /* fine motes in the acrylic; each catches the light when the slab turns its way */
  dust(c) { const n = 150, d = points(n, 0.034, 0.15), N = [], vel = new Float32Array(n * 3), { B, r } = c;
    for (let i = 0; i < n; i++) { d.P.set([(r() * 2 - 1) * B.x, (r() * 2 - 1) * B.y, B.z0 + r() * (B.z1 - B.z0)], i * 3); d.A[i] = 0.5 + r() * 0.9; N.push(new THREE.Vector3(r() - 0.5, r() - 0.5, r() * 0.8).normalize()); }
    d.pts.userData.order = 7; c.group.add(d.pts); const L = new THREE.Vector3();
    return { update(dt, c) { L.set(c.obj.tilt.x * 1.6 + Math.sin(c.t * 0.21) * 0.3, c.obj.tilt.y * 1.6 + Math.cos(c.t * 0.17) * 0.3, 1).normalize();
      for (let i = 0; i < n; i++) { const o = i * 3; for (let a = 0; a < 3; a++) { vel[o + a] += ((Math.random() - 0.5) * 0.03 + (Math.random() - 0.5) * c.stir * 0.08) * dt * 10; vel[o + a] *= 0.97; }
        d.P[o] = Math.max(-B.x, Math.min(B.x, d.P[o] + vel[o] * dt)); d.P[o + 1] = Math.max(-B.y, Math.min(B.y, d.P[o + 1] + vel[o + 1] * dt)); d.P[o + 2] = Math.max(B.z0, Math.min(B.z1, d.P[o + 2] + vel[o + 2] * dt * 0.3));
        const s = Math.max(0, N[i].dot(L)); d.C.set([1, 0.96, 0.88, (0.45 + 0.55 * Math.pow(s, 14)) * c.k], i * 4); }
      d.u.uVH.value = c.vh || 800; d.dirty(); } }; },

  /* an air bubble (now and then two or three) that slides along to the highest point of the case */
  bubble(c) { const { r, B } = c, n = r() < 0.75 ? 1 : 2 + Math.floor(r() * 2), L = [];
    const mat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 1 } }, vertexShader: VV, transparent: true, depthWrite: false, fragmentShader: `uniform float uK; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; if (d > 1.0) discard;
      float rim = smoothstep(0.8, 0.97, d) * (1.0 - smoothstep(0.97, 1.0, d)), dark = smoothstep(0.6, 0.84, d) * (1.0 - smoothstep(0.84, 0.92, d)), hl = smoothstep(0.24, 0.0, length(vUv - vec2(0.36, 0.66))) + 0.5 * smoothstep(0.1, 0.0, length(vUv - vec2(0.66, 0.32)));
      float edge = smoothstep(0.93, 1.0, d) * (1.0 - smoothstep(0.985, 1.0, d)), lit = rim * 1.2 + hl;   /* clear in the middle, a bright rim, a thin dark line at the very edge */
      gl_FragColor = vec4(vec3(lit / (lit + edge * 1.5 + dark * 0.25 + 1e-3)), clamp(rim * 0.85 + hl * 0.95 + edge * 0.55 + dark * 0.12 + 0.03, 0.0, 1.0) * uK);
      #include <colorspace_fragment>
    }` });
    for (let i = 0; i < n; i++) { const rad = n === 1 ? 0.09 + r() * 0.06 : 0.06 + r() * 0.04, m = plane(rad * 2, rad * 2, mat, 7.2); m.position.set((r() * 2 - 1) * (B.x - rad), (r() * 2 - 1) * (B.y - rad), B.z1 - 0.004 - i * 0.002); m.userData.rad = rad; m.userData.ph = r() * 9; c.group.add(m); L.push(m); }
    return { introDur: 1.6, intro(k) { mat.uniforms.uK.value = Math.min(1, k * 2); L.forEach(m => m.scale.setScalar(0.2 + 0.8 * k)); },
      onReveal() { snd(c.S, 'pop', { k: 0.4 }); },
      update(dt, c) { if (c.gxy < 0.25) return; const ux = -c.g.x / c.gxy, uy = -c.g.y / c.gxy, sp = 0.45 * Math.min(1, c.gxy);
        L.forEach(m => { const rd = m.userData.rad; m.position.x = Math.max(-B.x + rd, Math.min(B.x - rd, m.position.x + ux * sp * dt)); m.position.y = Math.max(-B.y + rd, Math.min(B.y - rd, m.position.y + uy * sp * dt));
          const w = 1 + 0.04 * Math.sin(c.t * 5 + m.userData.ph); m.scale.set(w * (c.k < 1 ? 0.2 + 0.8 * c.k : 1), (2 - w) * (c.k < 1 ? 0.2 + 0.8 * c.k : 1), 1); }); } }; },

  /* coloured acrylic: smoke, amber, ice or rose */
  tinted(c) { const T = [[0.4, 0.4, 0.45], [1.0, 0.62, 0.3], [0.6, 0.8, 1.0], [1.0, 0.64, 0.76]][c.x.tint || 0], col = new THREE.Color(...T), white = new THREE.Color(1, 1, 1);
    const mat = multiplyMat(col.clone()), m = plane(c.obj.w - 0.03, c.obj.h - 0.03, mat, 7.5); m.position.z = c.obj.th / 2 - 0.003; c.group.add(m);
    return { intro(k) { mat.color.copy(white).lerp(col, k); }, onReveal() { snd(c.S, 'shimmer', { k: 0.35 }); } }; },

  /* a pressed flower or fern under the front of the case, over a corner of the photo */
  flower(c) { const { r, obj } = c, kind = ['fern', 'daisy', 'ginkgo', 'lavender'][Math.floor(r() * 4)], raw = canvas(512, 512); drawFlower(raw.getContext('2d'), kind, r);
    /* pressed and kept: faded, a little yellowed, thin enough to let some light through */
    const cv = canvas(512, 512), cg = cv.getContext('2d'); cg.filter = 'saturate(0.55) sepia(0.35) brightness(0.9) contrast(0.95)'; cg.globalAlpha = 0.86; cg.drawImage(raw, 0, 0);
    /* a corner away from the label (down the left of a landscape slab, across the top of a portrait one) */
    const sz = Math.min(obj.photoW, obj.photoH) * (0.34 + r() * 0.1), ph = obj.parts.photo.position, sx = obj.land ? 1 : r() < 0.5 ? -1 : 1, sy = obj.land ? (r() < 0.5 ? -1 : 1) : -1;
    const mat = new THREE.MeshStandardMaterial({ map: canvasTex(cv), transparent: true, alphaTest: 0.04, roughness: 0.85, envMap: c.env.bright, envMapIntensity: 0.75, side: THREE.DoubleSide, depthWrite: false });
    const m = plane(sz, sz, mat, 7.1); m.position.set(ph.x + sx * (obj.photoW / 2 - sz * 0.32), ph.y + sy * (obj.photoH / 2 - sz * 0.32), c.B.z1 - 0.005); m.rotation.z = (r() - 0.5) * 1.6 + (sx * sy > 0 ? 0.6 : -0.6); c.group.add(m);
    return { intro(k) { mat.opacity = k; m.scale.setScalar(0.85 + 0.15 * k); } }; },

  /* a hairline crack through the acrylic that throws a rainbow as it turns; it runs across on arrival */
  cracked(c) { const { r, obj } = c, W = 1024, H = Math.round(1024 * obj.h / obj.w), cv = canvas(W, H); drawCrack(cv.getContext('2d'), W, H, r);
    const u = { uMap: { value: canvasTex(cv, true) }, uTilt: { value: obj.tilt }, uT: { value: 0 }, uDraw: { value: 1 } };
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VV, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fragmentShader: `uniform sampler2D uMap; uniform vec2 uTilt; uniform float uT; uniform float uDraw; varying vec2 vUv;
      void main(){ vec4 m = texture2D(uMap, vUv); float a = m.r * step(m.g, uDraw + 0.002); float ph = dot(uTilt, vec2(3.0, 2.2)) + vUv.x * 3.5 + vUv.y * 2.5 + uT * 0.04;
        vec3 ir = 0.5 + 0.5 * cos(6.2832 * (ph + vec3(0.0, 0.33, 0.67))); float glint = 0.3 + 0.7 * pow(abs(sin(ph * 3.1416)), 3.0); gl_FragColor = vec4((vec3(0.16) + ir * glint * 0.55) * a, 1.0);
        #include <colorspace_fragment>
      }` });
    const m = plane(obj.w - 0.02, obj.h - 0.02, mat, 7.6); m.position.z = obj.th / 2 - 0.006; c.group.add(m);
    return { introDur: 1.1, intro(k) { u.uDraw.value = k * k; }, onReveal() { snd(c.S, 'crack', { k: 0.7 }); }, update(dt) { u.uT.value += dt; } }; },

  /* the case half full of oil and gold glitter that sloshes when the slab moves (was the Liquid-filled variant); a goldfish in some */
  liquid(c) { const { r, obj } = c, fill = 0.38 + r() * 0.24, w = obj.w - 0.14, h = obj.h - 0.14, U = { uLvl: { value: -0.5 + fill }, uAng: { value: 0 }, uWob: { value: 0 }, uT: { value: r() * 40 }, uTilt: { value: new THREE.Vector2() }, uAsp: { value: w / h } };
    const m = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VV, fragmentShader: LIQ_FRAG, transparent: true, depthWrite: false }); m.toneMapped = false;
    const mesh = plane(w, h, m, 8); mesh.position.z = 0.07; c.group.add(mesh);
    let th = 0, om = 0, lastT = null, fish = null, fv = 0, fx = 0, fy = -0.2, face = 1;
    if (c.x.fish) { const cv = canvas(256, 128); drawFish(cv.getContext('2d')); fish = plane(0.36, 0.18, new THREE.MeshBasicMaterial({ map: canvasTex(cv), transparent: true, depthWrite: false, toneMapped: false }), 7.9); fish.position.z = 0.062; c.group.add(fish); fv = r() * 20; }
    return { introDur: 1.8, intro(k) { U.uLvl.value = -0.5 + fill * (0.15 + 0.85 * k); }, onReveal() { snd(c.S, 'splash', { k: 0.6 }); om = 3; },
      update(dt, c) { const tl = obj.tilt; if (!lastT) lastT = tl.clone(); const vx = (tl.x - lastT.x) / dt, vy = (tl.y - lastT.y) / dt; lastT.copy(tl);
        /* a small spring: how fast the slab turns pushes the surface over, it swings back and settles */
        om += (-th * 22 - om * 1.4 + vx * 2.2 - vy * 0.8 + c.stir * Math.sin(c.t * 7) * 0.6) * dt; th = Math.max(-0.55, Math.min(0.55, th + om * dt));
        U.uT.value += dt; U.uAng.value = th + Math.sin(U.uT.value * 0.7) * 0.015; U.uWob.value = Math.min(2, Math.abs(om) * 0.6); U.uTilt.value.copy(tl);
        if (fish) { fv += dt; const tx = Math.sin(fv * 0.23) * 0.36 + Math.sin(fv * 0.61) * 0.08, ty = -0.32 + Math.sin(fv * 0.37 + 1.3) * 0.12, nx = fx + (tx - fx) * Math.min(1, dt * 0.9);
          const surf = U.uLvl.value + nx * (w / h) * Math.tan(U.uAng.value); fy += (Math.min(ty, surf - 0.07) - fy) * Math.min(1, dt * 1.2);
          if (Math.abs(nx - fx) > 1e-4) face += ((nx > fx ? 1 : -1) - face) * Math.min(1, dt * 3); fx = nx;
          fish.position.x = fx * w; fish.position.y = fy * h; fish.scale.set(face, 1, 1); fish.rotation.z = Math.sin(c.t * 7) * 0.05; fish.material.opacity = c.k; } } }; },

  /* snow that lies where gravity puts it and swirls when the slab is moved */
  globe(c) { const n = 240, d = points(n, 0.026, 0.35), { r, B } = c, vel = new Float32Array(n * 3), rest = new Uint8Array(n), glint = new Float32Array(n);
    for (let i = 0; i < n; i++) { d.P.set([(r() * 2 - 1) * B.x, (r() * 2 - 1) * B.y, B.z0 + r() * 0.01], i * 3); d.A[i] = 0.55 + r() * 0.8; glint[i] = r() < 0.15 ? 1 : 0; rest[i] = 1; }
    d.pts.userData.order = 7.3; c.group.add(d.pts); let kick = 0;
    const lim = [[-B.x, B.x], [-B.y, B.y], [B.z0, B.z1]];
    return { introDur: 1.4, onReveal() { kick = 2.2; snd(c.S, 'shimmer', { k: 0.5 }); },
      update(dt, c) { kick = Math.max(0, kick - dt); const st = c.stir + kick * 1.5, G = 0.8, g = c.g;
        for (let i = 0; i < n; i++) { const o = i * 3;
          if (st > 0.15) rest[i] = 0;
          if (!rest[i]) { for (let a = 0; a < 3; a++) { vel[o + a] += (g.getComponent(a) * G + (Math.random() - 0.5) * (0.4 + st * 4)) * dt; vel[o + a] *= Math.exp(-2.4 * dt); }
            vel[o] += -d.P[o + 1] * st * dt * 1.5; vel[o + 1] += d.P[o] * st * dt * 1.5;   /* a swirl round the middle */
            let touching = false; for (let a = 0; a < 3; a++) { let p = d.P[o + a] + vel[o + a] * dt * (a === 2 ? 0.25 : 1); if (p < lim[a][0] || p > lim[a][1]) { p = Math.max(lim[a][0], Math.min(lim[a][1], p)); if (vel[o + a] * g.getComponent(a) > 0) touching = true; vel[o + a] *= -0.1; } d.P[o + a] = p; }
            if (touching && st < 0.1 && Math.hypot(vel[o], vel[o + 1], vel[o + 2]) < 0.03) rest[i] = 1; }
          const gl = glint[i] ? 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(c.t * 3 + i + c.obj.tilt.x * 20), 6) : 0.9; d.C.set([1, 1, 1, gl * c.k], i * 4); }
        d.u.uVH.value = c.vh || 800; d.dirty(); } }; },

  /* gold sand that pours to whichever edge is lowest and piles up there (on the table it stays where it last fell) */
  sand(c) { const n = 1100, d = points(n, 0.044, 0.5), { r, B } = c, NB = 36, gs = 0.012;
    const bin = new Int16Array(n), mode = new Uint8Array(n), delay = new Float32Array(n), vel = new Float32Array(n * 2), hts = new Float32Array(NB); let wall = 3, pend = 0;
    const COL = [[0.93, 0.78, 0.42], [0.86, 0.66, 0.3], [1, 0.88, 0.55], [0.78, 0.58, 0.26]];
    for (let i = 0; i < n; i++) { const k = COL[Math.floor(r() * 4)]; d.C.set([k[0], k[1], k[2], 1], i * 4); d.A[i] = 0.6 + r() * 0.7; d.P[i * 3 + 2] = B.z0 + 0.01 + r() * (B.z1 - B.z0 - 0.02); }
    /* walls: 0 +x, 1 -x, 2 +y, 3 -y; along a wall t runs over the other axis */
    const axis = w => w < 2 ? 0 : 1, sgn = w => w % 2 === 0 ? 1 : -1, span = w => axis(w) === 0 ? B.y : B.x;
    function land(i) { const w = wall, a = axis(w), T = span(w), t = d.P[i * 3 + (1 - a)]; let b = Math.max(0, Math.min(NB - 1, Math.floor((t + T) / (2 * T) * NB)));
      for (let s = 0; s < 4; s++) { const l = b > 0 && hts[b - 1] < hts[b] - 2 * gs ? b - 1 : -1, rr = b < NB - 1 && hts[b + 1] < hts[b] - 2 * gs ? b + 1 : -1; if (l < 0 && rr < 0) break; b = l >= 0 && (rr < 0 || hts[l] <= hts[rr]) ? l : rr; }
      bin[i] = b; mode[i] = 0; const lim = a === 0 ? B.x : B.y; d.P[i * 3 + a] = sgn(w) * (lim - hts[b] - gs * 0.5); d.P[i * 3 + 1 - a] = -T + (b + 0.2 + Math.random() * 0.6) / NB * 2 * T; hts[b] += gs; }
    function settleAll() { hts.fill(0); for (let i = 0; i < n; i++) { d.P[i * 3] = (Math.random() * 2 - 1) * B.x; d.P[i * 3 + 1] = (Math.random() * 2 - 1) * B.y; land(i); } }
    function pour(w) { wall = w; hts.fill(0); pend = n; for (let i = 0; i < n; i++) { mode[i] = 1; delay[i] = Math.random() * 1.6; vel[i * 2] = vel[i * 2 + 1] = 0; } snd(c.S, 'shimmer', { k: 0.25 }); }
    settleAll(); d.pts.userData.order = 7.3; c.group.add(d.pts);
    return { introDur: 1.6, onReveal() { const keep = wall; wall = keep % 2 === 0 ? keep + 1 : keep - 1; settleAll(); pour(keep); }, intro() {},
      update(dt, c) { const g = c.g;
        if (c.gxy > 0.35) { const ax = Math.abs(g.x), ay = Math.abs(g.y), cur = axis(wall) === 0 ? ax : ay, w = ax > ay ? (g.x > 0 ? 0 : 1) : (g.y > 0 ? 2 : 3); if (w !== wall && (ax > ay ? ax : ay) > cur * 1.3 + 0.05) pour(w); }
        if (pend) { const G = 5 * Math.max(0.4, c.gxy), a = axis(wall), lie = c.gxy <= 0.35, ux = lie ? (a === 0 ? sgn(wall) : 0) : g.x / c.gxy, uy = lie ? (a === 1 ? sgn(wall) : 0) : g.y / c.gxy, lim = a === 0 ? B.x : B.y;
          for (let i = 0; i < n; i++) { if (!mode[i]) continue; if (delay[i] > 0) { delay[i] -= dt; continue; } vel[i * 2] += ux * G * dt; vel[i * 2 + 1] += uy * G * dt; d.P[i * 3] += vel[i * 2] * dt; d.P[i * 3 + 1] += vel[i * 2 + 1] * dt;
            d.P[i * 3] = Math.max(-B.x, Math.min(B.x, d.P[i * 3])); d.P[i * 3 + 1] = Math.max(-B.y, Math.min(B.y, d.P[i * 3 + 1]));
            const T = span(wall), t = d.P[i * 3 + 1 - a], b = Math.max(0, Math.min(NB - 1, Math.floor((t + T) / (2 * T) * NB)));
            if (sgn(wall) * d.P[i * 3 + a] >= lim - hts[b] - gs) { land(i); pend--; } } }
        for (let i = 0; i < n; i++) d.C[i * 4 + 3] = c.k < 1 ? Math.min(1, c.k * 3) : 1;
        d.u.uVH.value = c.vh || 800; d.dirty(); } }; },

  /* a moss garden along the bottom of the case, in three layers for depth, and a fern that sways a little */
  terrarium(c) { const { r, obj, B } = c, W = obj.w - 0.12, H = Math.min(0.62, obj.h * 0.22), L = [];
    [[B.z0 + 0.012, 0], [(B.z0 + B.z1) / 2, 1], [B.z1 - 0.008, 2]].forEach(([z, k]) => { const cv = canvas(1024, 384); drawMoss(cv.getContext('2d'), 1024, 384, k, r);
      const m = plane(W, H, new THREE.MeshStandardMaterial({ map: canvasTex(cv), color: 0xa8a8a8, transparent: true, alphaTest: 0.05, roughness: 0.95, envMap: c.env.bright, envMapIntensity: 0.5 + 0.15 * k, depthWrite: false }), 7 + k * 0.05);
      m.position.set(0, -obj.h / 2 + 0.06 + H / 2, z); m.userData.y0 = m.position.y; c.group.add(m); L.push(m); });
    const cv = canvas(256, 512); drawFern(cv.getContext('2d'), 256, 512, r); const fg = new THREE.PlaneGeometry(H * 0.75, H * 1.5); fg.translate(0, H * 0.75, 0);
    const fern = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: canvasTex(cv), transparent: true, alphaTest: 0.05, roughness: 0.85, envMap: c.env.bright, envMapIntensity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    fern.userData.order = 7.02; fern.userData.noParticles = true; fern.raycast = NO_RAY; fern.position.set((r() < 0.5 ? -1 : 1) * W * (0.18 + r() * 0.22), -obj.h / 2 + 0.07, (B.z0 + B.z1) / 2 - 0.004); c.group.add(fern);
    return { introDur: 1.6, intro(k) { L.forEach((m, i) => { const e = Math.max(0, Math.min(1, k * 1.6 - i * 0.25)); m.position.y = m.userData.y0 - H * (1 - e * (2 - e)); m.material.opacity = e; }); fern.scale.setScalar(Math.max(0.01, Math.min(1, k * 1.4 - 0.3))); },
      update(dt, c) { fern.rotation.z = Math.sin(c.t * 0.8) * 0.035 + Math.sin(c.t * 2.1) * 0.01 + c.stir * Math.sin(c.t * 9) * 0.04; } }; },

  /* golden resin, warm and full of flecks, with something tiny caught in it and its shadow on the photo */
  amber(c) { const { r, obj, B } = c, col = new THREE.Color(1.0, 0.7, 0.34), white = new THREE.Color(1, 1, 1);
    const tint = multiplyMat(col.clone()), tm = plane(obj.w - 0.03, obj.h - 0.03, tint, 7.5); tm.position.z = obj.th / 2 - 0.003; c.group.add(tm);
    const U = { uK: { value: 1 }, uAsp: { value: obj.w / obj.h }, uSeed: { value: r() * 50 } };
    const glow = plane(obj.w - 0.06, obj.h - 0.06, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VV, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fragmentShader: `uniform float uK; uniform float uAsp; uniform float uSeed; varying vec2 vUv;
      float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
      void main(){ vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0); float d = length(p); float cl = n2(p * 3.0 + uSeed) * 0.6 + n2(p * 7.0 - uSeed) * 0.4;
        vec2 fq = vUv * vec2(uAsp, 1.0) * 90.0; float fl = step(0.993, h1(floor(fq) + uSeed)) * smoothstep(0.5, 0.1, length(fract(fq) - 0.5));
        vec2 bq = vUv * vec2(uAsp, 1.0) * 26.0; vec2 bf = fract(bq) - 0.5; float bs = step(0.97, h1(floor(bq) + uSeed * 2.0)), br = 0.12 + 0.2 * h1(floor(bq) + 3.0); float bub = bs * (smoothstep(br, br * 0.8, length(bf)) - smoothstep(br * 0.75, br * 0.5, length(bf)));
        vec3 c = vec3(1.0, 0.52, 0.12) * (0.07 + 0.08 * cl) * (1.0 - 0.7 * d * d) + vec3(1.0, 0.8, 0.45) * (fl * 0.5 + bub * 0.35); gl_FragColor = vec4(c * uK, 1.0);
        #include <colorspace_fragment>
      }` }), 7.4); glow.position.z = (B.z0 + B.z1) / 2 + 0.02; c.group.add(glow);
    const kind = ['ant', 'fly', 'beetle', 'gnat'][Math.floor(r() * 4)], cv = canvas(256, 256); drawInsect(cv.getContext('2d'), kind, r);
    const sh = canvas(256, 256), sg = sh.getContext('2d'); sg.filter = 'blur(7px)'; sg.drawImage(cv, 0, 0); sg.filter = 'none'; sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#000'; sg.fillRect(0, 0, 256, 256);
    const sz = Math.min(obj.photoW, obj.photoH) * (0.16 + r() * 0.08), ph = obj.parts.photo.position, px = ph.x + (r() - 0.5) * obj.photoW * 0.6, py = ph.y + (r() - 0.5) * obj.photoH * 0.6, rot = r() * 6.28;
    const bug = plane(sz, sz, new THREE.MeshBasicMaterial({ map: canvasTex(cv), transparent: true, depthWrite: false }), 7.35); bug.position.set(px, py, (B.z0 + B.z1) / 2 + 0.01); bug.rotation.z = rot; c.group.add(bug);
    const shadow = plane(sz * 1.1, sz * 1.1, new THREE.MeshBasicMaterial({ map: canvasTex(sh), transparent: true, opacity: 0.35, depthWrite: false }), 7.05); shadow.position.set(px + sz * 0.12, py - sz * 0.16, B.z0 + 0.004); shadow.rotation.z = rot; c.group.add(shadow);
    return { introDur: 1.8, intro(k) { tint.color.copy(white).lerp(col, k); U.uK.value = k; bug.material.opacity = Math.max(0, k * 2 - 1); shadow.material.opacity = 0.35 * Math.max(0, k * 2 - 1); },
      onReveal() { snd(c.S, 'ignite', { dur: 0.6, k: 0.35 }); } }; },

  /* crystals growing in from one or two corners; they grow a little each day the slab is owned (complete in two weeks) */
  crystals(c) { const { r, obj, B, slab } = c, now = Date.now();
    /* grown from the pull (slab.ts): cgMax is the furthest time seen, it never goes back and moves at most two days a look,
       so turning the computer's clock forward and back doesn't skip the wait; only slabs you own keep the count */
    const t0 = slab.ts || now; if (!slab.cgMax) slab.cgMax = t0; if (now > slab.cgMax + 6e4) { slab.cgMax = Math.min(now, slab.cgMax + 2 * 864e5); if (store.pull(slab.id)) store.save(); }
    const grown = 0.6 + 0.4 * Math.min(1, (slab.cgMax - t0) / 864e5 / 14), hue = [0xb48cff, 0xeaf2ff, 0xffc85a, 0xffb0c8][Math.floor(r() * 4)];
    const mat = new THREE.MeshStandardMaterial({ color: hue, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.8, envMap: c.env.bright, envMapIntensity: 1.6, flatShading: true, emissive: hue, emissiveIntensity: 0.07 });
    const L = [], s = Math.min(obj.w, obj.h), corners = [[1, 1], [-1, -1], [1, -1], [-1, 1]].sort(() => r() - 0.5).slice(0, r() < 0.6 ? 1 : 2), zc = (B.z0 + B.z1) / 2;
    corners.forEach(([cx, cy]) => { const n = 6 + Math.floor(r() * 5), base = Math.atan2(-cy * B.y, -cx * B.x);
      for (let i = 0; i < n; i++) { const len = s * (0.16 + r() * r() * 0.3), rad = 0.03 + r() * 0.03, geo = new THREE.CylinderGeometry(rad * 0.12, rad, len, 6, 1); geo.translate(0, len / 2, 0);
        const m = new THREE.Mesh(geo, mat); m.userData.order = 7.2; m.userData.keepDepth = true; m.userData.noParticles = true; m.raycast = NO_RAY;
        m.position.set(cx * (B.x - 0.02 - r() * 0.08), cy * (B.y - 0.02 - r() * 0.08), zc + (r() - 0.5) * 0.04); m.rotation.z = base + (r() - 0.5) * 1.3 - Math.PI / 2; m.rotateX((r() - 0.5) * 0.5); c.group.add(m); L.push(m); } });
    const set = g => L.forEach(m => m.scale.set(0.45 + 0.55 * g, Math.max(0.001, g), 0.45 + 0.55 * g)); set(grown);
    return { introDur: 1.8, intro(k) { set(grown * (1 - Math.pow(1 - k, 3))); }, onReveal() { snd(c.S, 'crack', { k: 0.35 }); setTimeout(() => snd(c.S, 'shimmer', { k: 0.5 }), 500); } }; },
};

const LIQ_FRAG = `uniform float uLvl; uniform float uAng; uniform float uWob; uniform float uT; uniform vec2 uTilt; uniform float uAsp; varying vec2 vUv;
  float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main(){ vec2 A=vec2(uAsp,1.0); vec2 p=(vUv-0.5)*A; float surf=uLvl+p.x*tan(uAng)+sin(p.x*14.0-uT*3.0)*0.006*(0.3+uWob)+sin(p.x*31.0+uT*5.0)*0.004*uWob;
    float below=smoothstep(0.003,-0.003,p.y-surf);
    vec2 gq=vUv*A*70.0+vec2(sin(uT*0.3)*2.0,uT*0.4); vec2 gid=floor(gq); float gh=h1(gid); float gl=step(0.982,gh)*pow(0.5+0.5*sin(uT*2.0+gh*50.0+uTilt.x*25.0+uTilt.y*18.0),10.0)*smoothstep(0.4,0.0,length(fract(gq)-0.5))*below;
    vec2 bq=vec2(vUv.x*uAsp*14.0,vUv.y*6.0-uT*0.35); vec2 bid=floor(bq); vec2 bf=fract(bq)-0.5; float br=0.06+0.08*h1(bid+5.0); float bl=length(bf*vec2(1.0,2.3));
    float bub=(smoothstep(br,br*0.75,bl)-smoothstep(br*0.75,br*0.4,bl)*0.8)*step(0.55,h1(bid))*below;
    float men=exp(-pow((p.y-surf)/0.006,2.0));
    vec3 c=vec3(0.32,0.7,0.66)+vec3(1.0,0.8,0.4)*gl*2.0+vec3(0.8,0.95,1.0)*bub*0.8+vec3(0.9,1.0,1.0)*men*0.8; float a=clamp(below*0.2+gl*0.9+bub*0.5+men*0.55,0.0,0.95);
    gl_FragColor=vec4(c,a);
    #include <colorspace_fragment>
  }`;

/* ---------------------------------------------------------------- drawn things (canvas, 2D) */
function drawFlower(g, kind, r) { g.clearRect(0, 0, 512, 512); g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'fern') { g.translate(256, 470); g.rotate(-0.15); const n = 15; g.strokeStyle = '#5d5a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(30, -220, 10, -430); g.stroke();
    for (let i = 1; i < n; i++) { const t = i / n, y = -430 * t, x = 30 * Math.sin(t * 2.4) * (1 - t * 0.6), L = 120 * (1 - t) * (0.6 + 0.4 * Math.sin(t * 3.1)) + 14;
      [-1, 1].forEach(s => { g.save(); g.translate(x, y); g.rotate(s * (1.1 - t * 0.4)); g.fillStyle = `rgba(${96 + r() * 30 | 0},${104 + r() * 24 | 0},${44 + r() * 14 | 0},0.92)`; g.strokeStyle = 'rgba(70,58,24,0.8)'; g.lineWidth = 1.5;
        for (let k = 0; k < 6; k++) { const q = (k + 0.5) / 6 * L; g.beginPath(); g.ellipse(q * s * 0, -q, 8 * (1 - k / 7), 13 * (1 - k / 8), 0, 0, 6.29); g.fill(); g.stroke(); } g.restore(); }); } }
  else if (kind === 'daisy') { g.translate(256, 256); const n = 14 + Math.floor(r() * 5);
    g.strokeStyle = '#6a6a3a'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 40); g.quadraticCurveTo(40, 160, 10, 250); g.stroke();
    for (let i = 0; i < n; i++) { g.save(); g.rotate(i / n * 6.283 + r() * 0.15); g.fillStyle = `rgba(${236 + r() * 14 | 0},${228 + r() * 14 | 0},${206 + r() * 20 | 0},0.88)`; g.strokeStyle = 'rgba(160,140,100,0.55)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, -100, 22, 72 + r() * 18, 0, 0, 6.29); g.fill(); g.stroke(); g.restore(); }
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, 44); gr.addColorStop(0, '#b07a18'); gr.addColorStop(1, '#7a4a10'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 44, 0, 6.29); g.fill();
    g.fillStyle = 'rgba(60,30,6,0.6)'; for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 38; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 2.2, 0, 6.29); g.fill(); } }
  else if (kind === 'ginkgo') { g.translate(256, 470); g.strokeStyle = '#8a6a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(-6, -170); g.stroke(); g.translate(-6, -170);
    const gr = g.createLinearGradient(0, 0, 0, -260); gr.addColorStop(0, '#c99a2a'); gr.addColorStop(1, '#e8c04a'); g.fillStyle = gr; g.strokeStyle = 'rgba(120,84,20,0.8)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-60, -40, -200, -150, -190, -230); g.quadraticCurveTo(-110, -290, -12, -262); g.lineTo(0, -228); g.lineTo(12, -262); g.quadraticCurveTo(110, -290, 190, -230); g.bezierCurveTo(200, -150, 60, -40, 0, 0); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(150,108,30,0.55)'; g.lineWidth = 1.5; for (let i = 0; i < 26; i++) { const a = -Math.PI / 2 + (i / 25 - 0.5) * 1.9; g.beginPath(); g.moveTo(0, -4); g.lineTo(Math.cos(a) * 250, Math.sin(a) * 250 + 20); g.stroke(); } }
  else { g.translate(256, 480); g.rotate(0.1); g.strokeStyle = '#6f7a50'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-14, -200, 4, -440); g.stroke();
    g.strokeStyle = '#7c8a5a'; g.lineWidth = 4; [[-80, -120], [70, -170]].forEach(([dx, dy]) => { g.beginPath(); g.moveTo(-6, dy * 0.5); g.quadraticCurveTo(dx * 0.5, dy * 0.9, dx, dy); g.stroke(); });
    for (let i = 0; i < 46; i++) { const t = 0.45 + 0.55 * (i / 46), y = -440 * t, x = -14 * Math.sin(t * 3) + (r() - 0.5) * 34; g.fillStyle = `rgba(${110 + r() * 40 | 0},${84 + r() * 30 | 0},${168 + r() * 40 | 0},0.92)`; g.beginPath(); g.ellipse(x, y, 9, 13, (r() - 0.5), 0, 6.29); g.fill(); } }
  g.setTransform(1, 0, 0, 1, 0, 0); }
/* a crack from one edge: r = the line, g = how far along it is (so it can run across on arrival) */
function drawCrack(g, W, H, r) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.lineCap = 'round';
  const side = Math.floor(r() * 4), st = side === 0 ? [0, H * (0.2 + r() * 0.6)] : side === 1 ? [W, H * (0.2 + r() * 0.6)] : side === 2 ? [W * (0.2 + r() * 0.6), 0] : [W * (0.2 + r() * 0.6), H];
  const a0 = Math.atan2(H / 2 - st[1], W / 2 - st[0]) + (r() - 0.5) * 0.8, total = W * (0.45 + r() * 0.4);
  const walk = (x, y, a, len, wd, d0) => { let d = d0; const step = W * 0.018; for (let s = 0; s * step < len; s++) { a += (r() - 0.5) * 0.5; const nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
      const k = Math.min(255, Math.round(d / total * 255)); g.strokeStyle = `rgb(255,${k},0)`; g.lineWidth = wd * (1 - 0.5 * s * step / len); g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      if (wd > 1.2 && r() < 0.05) walk(nx, ny, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * (0.2 + r() * 0.3), wd * 0.6, d);
      x = nx; y = ny; d += step; if (x < 0 || y < 0 || x > W || y > H) break; } };
  walk(st[0], st[1], a0, total, 2.2, 0); }
function drawFish(g) { g.clearRect(0, 0, 256, 128);
  const gr = g.createLinearGradient(0, 30, 0, 100); gr.addColorStop(0, '#ff9a2a'); gr.addColorStop(0.6, '#f06a10'); gr.addColorStop(1, '#ffd08a');
  g.fillStyle = 'rgba(255,140,40,0.75)'; g.beginPath(); g.moveTo(70, 64); g.quadraticCurveTo(30, 20, 8, 26); g.quadraticCurveTo(26, 64, 8, 102); g.quadraticCurveTo(30, 108, 70, 64); g.fill();   /* tail */
  g.fillStyle = 'rgba(255,150,60,0.7)'; g.beginPath(); g.moveTo(120, 40); g.quadraticCurveTo(140, 12, 170, 36); g.fill(); g.beginPath(); g.moveTo(140, 88); g.quadraticCurveTo(150, 112, 170, 92); g.fill();   /* fins */
  g.fillStyle = gr; g.beginPath(); g.ellipse(150, 64, 82, 34, 0, 0, 6.29); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(160, 52, 50, 10, -0.1, 0, 6.29); g.fill();
  g.fillStyle = '#1a0e06'; g.beginPath(); g.arc(205, 56, 7, 0, 6.29); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(207, 54, 2.2, 0, 6.29); g.fill(); }
function drawInsect(g, kind, r) { g.clearRect(0, 0, 256, 256); g.translate(128, 128); g.lineCap = 'round'; const body = '#2a1608', leg = 'rgba(30,16,6,0.9)';
  const legs = (n, len, y0, dy) => { g.strokeStyle = leg; g.lineWidth = 3; for (let i = 0; i < n; i++) [-1, 1].forEach(s => { const y = y0 + i * dy; g.beginPath(); g.moveTo(s * 8, y); g.lineTo(s * len * 0.6, y - 8 + i * 6); g.lineTo(s * len, y + 10 + i * 10); g.stroke(); }); };
  if (kind === 'ant') { legs(3, 70, -6, 14); g.fillStyle = body; [[0, -54, 15, 16], [0, -12, 13, 22], [0, 46, 22, 32]].forEach(([x, y, a, b]) => { g.beginPath(); g.ellipse(x, y, a, b, 0, 0, 6.29); g.fill(); });
    g.strokeStyle = leg; g.lineWidth = 2.5; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * 6, -66); g.quadraticCurveTo(s * 30, -96, s * 42, -84); g.stroke(); }); }
  else if (kind === 'fly' || kind === 'gnat') { const k = kind === 'gnat' ? 0.7 : 1; legs(3, 56 * k, -4, 12 * k);
    g.fillStyle = 'rgba(200,220,230,0.35)'; g.strokeStyle = 'rgba(60,40,20,0.6)'; g.lineWidth = 1.5; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(s * 34 * k, 8, 20 * k, 52 * k, s * -0.5, 0, 6.29); g.fill(); g.stroke(); });
    g.fillStyle = body; g.beginPath(); g.ellipse(0, -30 * k, 16 * k, 16 * k, 0, 0, 6.29); g.fill(); g.beginPath(); g.ellipse(0, 12 * k, 14 * k, kind === 'gnat' ? 46 : 30, 0, 0, 6.29); g.fill(); g.fillStyle = '#5a1a0a'; [-1, 1].forEach(s => { g.beginPath(); g.arc(s * 9 * k, -36 * k, 6 * k, 0, 6.29); g.fill(); }); }
  else { legs(3, 62, -10, 16); const gr = g.createLinearGradient(-30, 0, 30, 0); gr.addColorStop(0, '#1a2a14'); gr.addColorStop(0.5, '#3f6a2a'); gr.addColorStop(1, '#1a2a14'); g.fillStyle = gr;
    g.beginPath(); g.ellipse(0, 18, 34, 46, 0, 0, 6.29); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -24); g.lineTo(0, 62); g.stroke();
    g.fillStyle = body; g.beginPath(); g.ellipse(0, -36, 16, 13, 0, 0, 6.29); g.fill(); }
  g.setTransform(1, 0, 0, 1, 0, 0); }
/* moss: layer 0 (back) dark and tall, 1 (middle) with pebbles and a toadstool, 2 (front) low and bright */
function drawMoss(g, W, H, k, r) { g.clearRect(0, 0, W, H); const top = [0.12, 0.38, 0.62][k], amp = [0.22, 0.16, 0.1][k], cols = [['#1a2c12', '#2a4a1c'], ['#2c4e1a', '#466e28'], ['#3e6420', '#6a9434']][k];
  const ph = [r() * 9, r() * 9, r() * 9], yAt = x => H * (top + amp * (0.5 + 0.3 * Math.sin(x / W * 5 + ph[0]) + 0.2 * Math.sin(x / W * 13 + ph[1])));
  const gr = g.createLinearGradient(0, H * top, 0, H); gr.addColorStop(0, cols[1]); gr.addColorStop(1, cols[0]); g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 8) g.lineTo(x, yAt(x)); g.lineTo(W, H); g.fill();
  for (let i = 0; i < 160; i++) { const x = r() * W, y = yAt(x) + r() * 14, rad = 8 + r() * (k === 0 ? 26 : 18); const gg = g.createRadialGradient(x, y - rad * 0.3, 1, x, y, rad); gg.addColorStop(0, cols[1]); gg.addColorStop(1, cols[0]); g.fillStyle = gg; g.beginPath(); g.arc(x, y, rad, 0, 6.29); g.fill(); }
  g.fillStyle = k === 2 ? 'rgba(190,225,130,0.3)' : 'rgba(150,195,100,0.22)'; for (let i = 0; i < 1600; i++) { const x = r() * W, y = yAt(x) + r() * (H - yAt(x)); g.fillRect(x, y, 2, 2); }
  if (k === 2) { g.fillStyle = '#3a2a1a'; g.fillRect(0, H - 18, W, 18); }
  if (k === 1) { for (let i = 0; i < 7; i++) { const x = r() * W, y = H - 18 - r() * 30, rr = 10 + r() * 16; g.fillStyle = ['#8a8478', '#a29c90', '#6f6a60'][i % 3]; g.beginPath(); g.ellipse(x, y, rr * 1.3, rr, 0, 0, 6.29); g.fill(); }
    const mx = W * (0.2 + r() * 0.6), my = yAt(mx) - 26; g.fillStyle = '#efe6d2'; g.fillRect(mx - 5, my, 10, 40); g.fillStyle = '#b8321e'; g.beginPath(); g.ellipse(mx, my, 26, 16, 0, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; [[-10, -6], [6, -9], [12, -3]].forEach(([a, b]) => { g.beginPath(); g.arc(mx + a, my + b, 3, 0, 6.29); g.fill(); }); } }
function drawFern(g, W, H, r) { g.clearRect(0, 0, W, H); g.translate(W / 2, H); g.strokeStyle = '#2f5a1e'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-20, -H * 0.5, 10, -H * 0.95); g.stroke();
  for (let i = 1; i < 18; i++) { const t = i / 18, y = -H * 0.95 * t, x = -20 * Math.sin(t * 3) * (1 - t) + 10 * t, L = 90 * (1 - t) + 12;
    [-1, 1].forEach(s => { g.fillStyle = `rgb(${50 + r() * 30 | 0},${110 + r() * 40 | 0},${40 + r() * 20 | 0})`; g.beginPath(); g.ellipse(x + s * L / 2, y - 6, L / 2, 6, s * -0.35, 0, 6.29); g.fill(); }); }
  g.setTransform(1, 0, 0, 1, 0, 0); }
