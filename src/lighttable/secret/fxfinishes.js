// FXFINISHES: Sam's picks from the Slab Lab page, as finishes in the secret layer's registry (slabmesh registerFinish).
// Each one is built from the photo and its depth map (depth.js): a relief struck in metal, a weather the scene sits in,
// a trick of the lens. Every slab rolls its own version from its seed (an alloy, a worked ground, how heavy the rain
// is, which season it starts in), so two pulls of the same finish are never quite the same.
// A raw print carries the relief shallow, like an embossed foil card; grading lifts it to full depth (RELIEF.k).
// Calm on the table, alive in your hand: away from inspect the animation runs slower (rest), and pointer and click
// only reach a finish while it is inspected. Builds run one at a time a frame apart, so a full case never stalls.
// The four sealed finishes (crystal, window, coin, scan3d) only exist graded: they arrive already in their slab.
import * as THREE from 'three';
import { clamp, mix, sstep, hash, blur, texOf, normalOf, sample, reliefGeo, setRelief, cavityOf, heightOf, smoothHeight, crackle, rngOf, bgPattern, beadRim, vn2, fbm2,
  pick, GOLD_D, GOLD_L, ALLOYS, RELIEFS, BGS, PATINAS, INKS, GLAZES, VS, VSN, GLH, OUT, FR, shaderMat, photoMaps, studioEnvs, RELIEF } from './fxkit.js';
import { depthFor, forgetDepth, setDepthMode } from './depth.js';
import { loadScan } from './fxscan.js';
const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- the window: a parallax occlusion shader, so the scene sits deep behind the card without leaving the case ---------- */
FR.window = `uniform vec2 uSize; uniform float uDepth; varying vec3 vVo;
  void main(){ vec3 V=normalize(vVo); V.z=min(V.z,-0.12); V=normalize(V); vec2 st=(V.xy/-V.z)/uSize*uDepth; const int N=56; float layer=1.0/float(N);
    vec2 uv=vUv; float cur=0.0; float sd=1.0-Dp(uv); vec2 dUV=st*layer;
    for(int i=0;i<N;i++){ if(cur>=sd) break; uv+=dUV; cur+=layer; sd=1.0-Dp(clamp(uv,0.0,1.0)); }
    vec2 pv=uv-dUV; float after=sd-cur, before=(1.0-Dp(clamp(pv,0.0,1.0)))-(cur-layer); float wgt=after/(after-before+1e-5); uv=mix(uv,pv,clamp(wgt,0.0,1.0));
    vec3 c=texture2D(uTex,clamp(uv,0.0,1.0)).rgb; vec2 o=max(-uv,uv-1.0); float out_=max(o.x,o.y);
    c=mix(c,vec3(0.035,0.03,0.025)*(1.2-cur*0.6),smoothstep(0.0,0.004,out_)); c*=mix(1.0,0.78,cur);
    vec2 e=min(vUv,1.0-vUv)*vec2(uAsp,1.0); c*=0.55+0.45*smoothstep(0.0,0.05,min(e.x,e.y)); gl_FragColor=vec4(c,1.0);`;
const VS_WIN = 'varying vec2 vUv; varying vec3 vVo; void main(){ vUv=uv; vec3 camO=(inverse(modelMatrix)*vec4(cameraPosition,1.0)).xyz; vVo=position-camO; gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); }';

function coin(P, g, w, h, api) {
  const r = api.rng(), alloy = pick(r, ALLOYS), S = 512, R = h * 0.47, th = 0.07; api.label([alloy[0], 'proof coin']);
  let sx = 0, sy = 0, sw = 0; for (let y = 0; y < P.H; y += 3) for (let x = 0; x < P.W; x += 3) { const m = P.R[y * P.W + x]; sx += x * m; sy += y * m; sw += m; }
  const cxp = sw ? sx / sw : P.W / 2, cyp = sw ? sy / sw : P.H / 2, half = P.H * 0.5;
  const lc = document.createElement('canvas'); lc.width = lc.height = S; const lg = lc.getContext('2d'); lg.fillStyle = '#000'; lg.fillRect(0, 0, S, S); lg.fillStyle = '#fff'; lg.font = '700 ' + Math.round(S * 0.05) + 'px Geist, sans-serif'; lg.textAlign = 'center'; lg.textBaseline = 'middle';
  const txt = 'STUDIUM · GRADED PHOTOGRAPH · ' + new Date().getFullYear() + ' · '; for (let i = 0; i < txt.length; i++) { const a = -Math.PI / 2 + i / txt.length * Math.PI * 2; lg.save(); lg.translate(S / 2 + Math.cos(a) * S * 0.44, S / 2 + Math.sin(a) * S * 0.44); lg.rotate(a + Math.PI / 2); lg.fillText(txt[i], 0, 0); lg.restore(); }
  const lt = lg.getImageData(0, 0, S, S).data;
  const face = (rev) => { const Hh = new Float32Array(S * S), L = new Float32Array(S * S), mask = new Float32Array(S * S);
    let rv = null; if (rev) { const c2 = document.createElement('canvas'); c2.width = c2.height = S; const g2 = c2.getContext('2d'); g2.fillStyle = '#000'; g2.fillRect(0, 0, S, S); g2.fillStyle = '#fff'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.font = '400 ' + Math.round(S * 0.42) + 'px Fraunces, Georgia, serif'; g2.fillText('S', S / 2, S * 0.47); g2.font = '600 ' + Math.round(S * 0.06) + 'px "Geist Mono", monospace'; g2.fillText('10 · GEM MINT', S / 2, S * 0.74); rv = blur(Float32Array.from(g2.getImageData(0, 0, S, S).data.filter((_, i) => i % 4 === 0), v => v / 255), S, S, 1.5); }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x, dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2), rr = Math.hypot(dx, dy); mask[i] = rr <= 1 ? 1 : 0; let hv = 0, lv = 0.85;
      if (rr < 0.8) { if (rev) { hv = rv[i] * 0.5 + 0.02; lv = 0.7 + rv[i] * 0.3; } else { const px = clamp(Math.round(cxp + dx * half), 0, P.W - 1), py = clamp(Math.round(cyp + dy * half), 0, P.H - 1), j = py * P.W + px; hv = P.R[j] * 0.75 + P.D[j] * 0.15 + P.Q[j] * 0.25; lv = P.L[j]; } }
      else if (rr < 0.82) hv = -0.03; else if (rr < 0.95) { hv = lt[i * 4] / 255 * 0.22; lv = 0.9; } else hv = 0.45;
      Hh[i] = hv; L[i] = lv; }
    return { Hh: blur(Hh, S, S, 0.8), L, mask }; };
  const A0 = alloy[1], A1 = alloy[2], P2 = { W: S, H: S };
  const mk = (rev) => { const f = face(rev), geo = new THREE.PlaneGeometry(2 * R, 2 * R, 260, 260), uv = geo.attributes.uv, base = new Float32Array(uv.count); for (let i = 0; i < uv.count; i++) base[i] = sample(f.Hh, S, S, uv.getX(i), uv.getY(i)); geo.userData.base = base;
    const map = texOf(S, S, true, i => { const t = Math.pow(f.L[i], 0.8); return [mix(A0[0], A1[0], t), mix(A0[1], A1[1], t), mix(A0[2], A1[2], t)]; }), alpha = texOf(S, S, false, i => [f.mask[i], f.mask[i], f.mask[i]]);
    const orm = texOf(S, S, false, (i, x, y) => { const rr = Math.hypot(x - S / 2, y - S / 2) / (S / 2); return [1, rr > 0.95 ? 0.08 : rr > 0.82 ? 0.14 : 0.3 - f.L[i] * 0.12, 1]; });
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, alphaMap: alpha, alphaTest: 0.5, normalMap: normalOf(f.Hh, S, S, 8), envMapIntensity: 1.6 })); return mesh; };
  const coinG = new THREE.Group(); coinG.position.z = 0.06; g.add(coinG); const front = mk(false), back = mk(true); back.rotation.y = Math.PI; front.position.z = th / 2; back.position.z = -th / 2; coinG.add(front, back);
  const reed = texOf(256, 8, false, (i, x) => { const s = Math.sin(x / 256 * Math.PI * 2 * 24); return [0.5 + s * 0.45, 0.5, 0.9]; }); reed.wrapS = THREE.RepeatWrapping; reed.repeat.set(6, 1);
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(R, R, th, 240, 1, true), new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(A1[0], A1[1], A1[2], THREE.SRGBColorSpace), metalness: 1, roughness: 0.18, normalMap: reed, envMapIntensity: 1.6 })); edge.rotation.x = Math.PI / 2; coinG.add(edge);
  let turns = 0, a = 0;
  return { relief: k => [front, back].forEach(m => setRelief(m.geometry, k * 0.06)), click: () => { turns++; }, update: (t, dt) => { a += (turns * Math.PI - a) * Math.min(1, dt * 4); coinG.rotation.y = a + Math.sin(t * 0.6) * 0.12; coinG.rotation.x = Math.sin(t * 0.45) * 0.06; } };
}

/* ---------- the finishes (Slab Lab code, lightly rewired: api.amt is the per-slab roll, RK the relief scale) ---------- */
const FX = {
  gold: { name: 'Gold repoussé', amt: [0.85, 1.25],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const r = api.rng(), N = P.W * P.H, alloy = pick(r, ALLOYS), rel = pick(r, RELIEFS), bgk = pick(r, BGS), polish = r(), beads = r() < 0.35;
      const Hf = smoothHeight(P, heightOf(P, rel[1], rel[2], 0)), cav = cavityOf(P, Hf, 6), bg = bgPattern(P, bgk, r), sub = P.R.map(v => sstep(0.05, 0.25, v));
      const Qs = blur(P.Q, P.W, P.H, 0.8), det = new Float32Array(N); for (let i = 0; i < N; i++) det[i] = Qs[i] * 0.35 + bg.h[i] * (1 - sub[i]);
      if (beads) beadRim(det, P);
      const A0 = alloy[1], A1 = alloy[2];
      const map = texOf(P.W, P.H, true, i => { const t = Math.pow(sstep(0.0, 0.95, P.L[i]), 0.85) * (1 - cav[i] * 0.55); return [mix(A0[0], A1[0], t), mix(A0[1], A1[1], t), mix(A0[2], A1[2], t)]; });
      const orm = texOf(P.W, P.H, false, i => [1 - cav[i] * 0.7, clamp(0.12 + polish * 0.14 + 0.16 * P.L[i] + cav[i] * 0.25 + (1 - sub[i]) * bg.rough, 0.03, 1), 1]);
      const geo = reliefGeo(P, w, h, Hf);
      const mat = new THREE.MeshPhysicalMaterial({ map, roughnessMap: orm, metalnessMap: orm, aoMap: orm, aoMapIntensity: 1, roughness: 1, metalness: 1, normalMap: normalOf(det, P.W, P.H, 22), normalScale: new THREE.Vector2(1, 1), envMapIntensity: 1.6 });
      g.add(new THREE.Mesh(geo, mat)); api.label([alloy[0], bgk + ' ground', rel[0]].concat(beads ? ['beaded rim'] : []));
      return { relief: k => setRelief(geo, k * 0.17 * rel[3]) };
    } },
  gilt: { name: 'Gilded subject', amt: [0.8, 1.2],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const rr = api.rng(), alloy = pick(rr, ALLOYS), th0 = 0.1 + rr() * 0.14, A0 = alloy[1], A1 = alloy[2]; api.label([alloy[0] + ' leaf', th0 < 0.17 ? 'subject and surroundings' : 'subject only']);
      const N = P.W * P.H, mask = blur(P.R.map(r => sstep(th0, th0 + 0.16, r)), P.W, P.H, 1.5), Hf = smoothHeight(P, heightOf(P, 0.55, 0.05, 0)), cav = cavityOf(P, Hf, 5);
      const map = texOf(P.W, P.H, true, i => { const t = Math.pow(P.L[i], 0.8) * (1 - cav[i] * 0.5), m = mask[i]; return [mix(P.C[i * 3], mix(A0[0], A1[0], t), m), mix(P.C[i * 3 + 1], mix(A0[1], A1[1], t), m), mix(P.C[i * 3 + 2], mix(A0[2], A1[2], t), m)]; });
      const orm = texOf(P.W, P.H, false, i => [1 - cav[i] * 0.6 * mask[i], mix(0.62, 0.14 + 0.3 * (1 - P.L[i]), mask[i]), mask[i]]);
      const det = new Float32Array(N); for (let i = 0; i < N; i++) det[i] = P.Q[i] * (0.25 + mask[i] * 0.9);
      const geo = reliefGeo(P, w, h, Hf);
      const mat = new THREE.MeshPhysicalMaterial({ map, roughnessMap: orm, metalnessMap: orm, aoMap: orm, roughness: 1, metalness: 1, normalMap: normalOf(det, P.W, P.H, 20), envMapIntensity: 1.2, clearcoat: 0.15, clearcoatRoughness: 0.4 });
      g.add(new THREE.Mesh(geo, mat)); return { relief: k => setRelief(geo, k * 0.16) };
    } },
  dag: { name: 'Daguerreotype', amt: [0.8, 1.3],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const N = P.W * P.H, Hf = smoothHeight(P, heightOf(P, 0.18, 0.1, 0));
      const map = texOf(P.W, P.H, true, (i, x, y) => { const u = x / P.W, v = y / P.H, dx = (u - 0.5) / 0.47, dy = (v - 0.5) / 0.44, r = Math.sqrt(dx * dx + dy * dy), t = sstep(0.82, 1.1, r);
        const hue = r * 7.0, tr = [0.55 + 0.45 * Math.cos(hue), 0.5 + 0.4 * Math.cos(hue + 2.1), 0.45 + 0.45 * Math.cos(hue + 4.2)]; const s = [0.93, 0.92, 0.88];
        return [mix(s[0], tr[0], t * 0.8), mix(s[1], tr[1], t * 0.8), mix(s[2], tr[2], t * 0.8)]; });
      const orm = texOf(P.W, P.H, false, i => [1, clamp(0.03 + 0.62 * Math.pow(P.L[i], 1.1), 0, 1), 1]);
      const det = new Float32Array(N); for (let i = 0; i < N; i++) det[i] = P.Q[i] * 0.3;
      const geo = reliefGeo(P, w, h, Hf);
      g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map, roughnessMap: orm, roughness: 1, metalness: 1, normalMap: normalOf(det, P.W, P.H, 10), envMapIntensity: 1.35 })));
      /* the brass mat with an oval window, and a thin brass preserver */
      const sh = new THREE.Shape(); sh.moveTo(-w / 2, -h / 2); sh.lineTo(w / 2, -h / 2); sh.lineTo(w / 2, h / 2); sh.lineTo(-w / 2, h / 2); sh.lineTo(-w / 2, -h / 2);
      const hole = new THREE.Path(); hole.absellipse(0, 0, w * 0.45, h * 0.43, 0, Math.PI * 2, true); sh.holes.push(hole);
      const mg = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 3, curveSegments: 96 });
      const bn = texOf(256, 256, false, (i, x, y) => { const v = 0.5 + 0.5 * Math.sin(x * 0.35 + Math.sin(y * 0.11) * 4) * Math.sin(y * 0.4 + Math.cos(x * 0.09) * 3); return [0.5 + (v - 0.5) * 0.3, 0.5 + (hash(i) - 0.5) * 0.2, 1]; }); bn.wrapS = bn.wrapT = THREE.RepeatWrapping; bn.repeat.set(6, 4);
      const mat = new THREE.Mesh(mg, new THREE.MeshPhysicalMaterial({ color: 0xe0b86a, metalness: 1, roughness: 0.4, envMapIntensity: 2.2, normalMap: bn, normalScale: new THREE.Vector2(0.5, 0.5) }));
      mat.position.z = 0.04; g.add(mat);
      return { relief: k => setRelief(geo, k * 0.05) };
    } },
  bronze: { name: 'Bronze and verdigris', amt: [0.85, 1.2],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const rr = api.rng(), pat = pick(rr, PATINAS), pam = 0.6 + rr() * 0.8; api.label([pat[0], pam > 1.1 ? 'heavy' : pam < 0.8 ? 'light' : 'even']);
      const N = P.W * P.H, Hf = smoothHeight(P, heightOf(P, 0.6, 0.24, 0)), cav = cavityOf(P, Hf, 7), hb = blur(Hf, P.W, P.H, 10);
      const ver = new Float32Array(N); for (let i = 0; i < N; i++) { const n = hash(i * 0.013 + Math.floor(i / P.W) * 0.71); ver[i] = clamp((sstep(0.03, 0.2, cav[i]) * 0.8 + Math.pow(1 - P.L[i], 2) * 0.9 * n) * pam - 0.15, 0, 1); }
      const vb = blur(ver, P.W, P.H, 1.5);
      const map = texOf(P.W, P.H, true, i => { const t = Math.pow(P.L[i], 0.9), rub = clamp((Hf[i] - hb[i]) * 8, 0, 1), b = [mix(0.28, 0.82, t) + rub * 0.15, mix(0.15, 0.55, t) + rub * 0.1, mix(0.08, 0.33, t) + rub * 0.05], v = vb[i], vg = [pat[1][0] + 0.12 * t, pat[1][1] + 0.14 * t, pat[1][2] + 0.1 * t];
        return [mix(b[0], vg[0], v), mix(b[1], vg[1], v), mix(b[2], vg[2], v)]; });
      const orm = texOf(P.W, P.H, false, i => { const rub = clamp((Hf[i] - hb[i]) * 8, 0, 1); return [1 - cav[i] * 0.6, mix(clamp(0.38 - rub * 0.25, 0.08, 1), 0.88, vb[i]), 1 - vb[i]]; });
      const det = new Float32Array(N); for (let i = 0; i < N; i++) det[i] = P.Q[i] * 0.8 + vb[i] * 0.04 * hash(i * 0.37);
      const geo = reliefGeo(P, w, h, Hf);
      g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map, roughnessMap: orm, metalnessMap: orm, aoMap: orm, roughness: 1, metalness: 1, normalMap: normalOf(det, P.W, P.H, 22), envMapIntensity: 1.2 })));
      return { relief: k => setRelief(geo, k * 0.17) };
    } },
  porcelain: { name: 'Painted porcelain', amt: [0.8, 1.2],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const rr = api.rng(), ink0 = pick(rr, INKS), cells = 18 + Math.floor(rr() * 34), rimk = pick(rr, [['gold rim', [1, 0.83, 0.5]], ['platinum rim', [0.92, 0.92, 0.94]], ['no rim', null]]); api.label([ink0[0], cells > 38 ? 'fine crackle' : cells < 26 ? 'wide crackle' : 'crackle', rimk[0]]);
      const N = P.W * P.H, Hf = smoothHeight(P, heightOf(P, 0.6, 0.12, 0), 2.2), cav = cavityOf(P, Hf, 6), crack = crackle(P.W, P.H, cells, 1.1), IC = ink0[1];
      const rim = (x, y) => { if (!rimk[1]) return 0; const e = Math.min(x, P.W - 1 - x, y, P.H - 1 - y) / P.W; return 1 - sstep(0.012, 0.016, e); };
      const map = texOf(P.W, P.H, true, (i, x, y) => { if (rim(x, y) > 0.5) return rimk[1]; const ink = clamp(Math.pow(sstep(0.92, 0.12, P.L[i]), 0.8) + cav[i] * 0.6, 0, 1); const c = 1 - crack[i] * 0.22;
        return [mix(0.95, IC[0], ink) * c, mix(0.95, IC[1], ink) * c, mix(0.93, IC[2], ink) * c]; });
      const orm = texOf(P.W, P.H, false, (i, x, y) => { const r = rim(x, y); return [1, mix(0.4, 0.22, r), r]; });
      const geo = reliefGeo(P, w, h, Hf);
      g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.04, normalMap: normalOf(crack.map(c => -c * 0.02), P.W, P.H, 20), sheen: 0.3, sheenColor: new THREE.Color(0xdde6ff), envMapIntensity: 1.1 })));
      return { relief: k => setRelief(geo, k * 0.13) };
    } },
  kintsugi: { name: 'Kintsugi', amt: [0.8, 1.2],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const rr = api.rng(), gz = pick(rr, GLAZES), sm = pick(rr, [['gold', [1.0, 0.8, 0.45]], ['silver', [0.93, 0.93, 0.95]], ['copper', [0.95, 0.55, 0.38]]]), nb = 3 + Math.floor(rr() * 4); api.label([gz[0] + ' glaze', sm[0] + ' seams', nb + ' breaks']);
      const N = P.W * P.H, cr = crackle(P.W, P.H, nb, 4.0), seam0 = new Float32Array(N);
      for (let i = 0; i < N; i++) seam0[i] = Math.max(sstep(0.5, 0.8, P.E[i]), cr[i]);
      const seam = blur(seam0, P.W, P.H, 1).map(s => sstep(0.12, 0.45, s));
      const Hf0 = heightOf(P, 0.45, 0.1, 0); for (let i = 0; i < N; i++) Hf0[i] += seam[i] * 0.05; const Hf = smoothHeight(P, Hf0, 1.2), cav = cavityOf(P, Hf, 5);
      const map = texOf(P.W, P.H, true, i => { const t = Math.pow(P.L[i], 0.85), s = seam[i], c = [mix(gz[1][0], gz[2][0], t) - cav[i] * 0.1, mix(gz[1][1], gz[2][1], t) - cav[i] * 0.06, mix(gz[1][2], gz[2][2], t) - cav[i] * 0.08];
        return [mix(c[0], sm[1][0], s), mix(c[1], sm[1][1], s), mix(c[2], sm[1][2], s)]; });
      const orm = texOf(P.W, P.H, false, i => [1 - cav[i] * 0.5, mix(0.3, 0.16, seam[i]), seam[i]]);
      const det = new Float32Array(N); for (let i = 0; i < N; i++) det[i] = seam[i] * 0.03 + P.Q[i] * 0.15;
      const geo = reliefGeo(P, w, h, Hf);
      g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map, roughnessMap: orm, metalnessMap: orm, aoMap: orm, roughness: 1, metalness: 1, clearcoat: 0.8, clearcoatRoughness: 0.08, normalMap: normalOf(det, P.W, P.H, 24), envMapIntensity: 1.15 })));
      return { relief: k => setRelief(geo, k * 0.13) };
    } },
  litho: { name: 'Lithophane', amt: [0.8, 1.2],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const N = P.W * P.H, th = new Float32Array(N); for (let i = 0; i < N; i++) th[i] = 1 - P.L[i];
      const Hf = smoothHeight(P, th, 1.2);
      const map = texOf(P.W, P.H, true, () => [0.3, 0.29, 0.28]);
      const em = texOf(P.W, P.H, true, i => { const T = Math.exp(-3.6 * (0.15 + 0.85 * Hf[i])); const k = Math.pow(clamp(T * 1.8, 0, 1), 1.1); return [k, Math.pow(k, 1.3) * 0.8, Math.pow(k, 2.0) * 0.5]; });
      const geo = reliefGeo(P, w, h, Hf);
      const mat = new THREE.MeshPhysicalMaterial({ map, roughness: 0.82, metalness: 0, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 1, sheen: 0.2, sheenColor: new THREE.Color(0xfff2e0), envMapIntensity: 0.25 });
      g.add(new THREE.Mesh(geo, mat));
      return { relief: k => setRelief(geo, k * 0.06), update: (t) => { const lamp = api.lamp * 2.2; const f = 0.86 + 0.08 * Math.sin(t * 7.1) + 0.05 * Math.sin(t * 13.7 + 1) + 0.04 * Math.sin(t * 2.3); mat.emissiveIntensity = lamp * f; } };
    } },
  crystal: { name: 'Crystal etch', amt: [0.8, 1.4],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const N = P.W * P.H, pos = [], rnd = [], dir = [], step = Math.max(1, Math.round(Math.sqrt(N / 420000)));
      for (let y = 0; y < P.H; y += step) for (let x = 0; x < P.W; x += step) { const i = y * P.W + x, l = P.L[i], p = Math.pow(sstep(0.15, 1.0, l), 2.0) * 0.35 * (0.3 + 0.7 * P.D[i]) + P.R[i] * (0.25 + 0.6 * l) + P.E[i] * 0.25;
        if (hash(i * 0.917 + 0.3) < p * 0.85) { const u = (x + hash(i) - 0.5) / P.W, v = (y + hash(i * 1.7) - 0.5) / P.H; pos.push((u - 0.5) * w, (0.5 - v) * h, P.D[i] * 0.7 + P.R[i] * 0.3 + (hash(i * 2.3) - 0.5) * 0.02); rnd.push(hash(i * 3.1)); const a = hash(i * 5.3) * 6.283, b = hash(i * 7.1) * 2 - 1; dir.push(Math.cos(a) * Math.sqrt(1 - b * b), Math.sin(a) * Math.sqrt(1 - b * b), b); } }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aR', new THREE.Float32BufferAttribute(rnd, 1)); geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
      const base = new Float32Array(pos.filter((_, i) => i % 3 === 2));
      const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uZ: { value: 0.5 } },
        vertexShader: `attribute float aR; attribute vec3 aDir; uniform float uTime; uniform float uPx; uniform float uZ; varying float vA;
          void main(){ vec3 p=position; p.z=(p.z-0.5)*uZ; vec4 wp=modelMatrix*vec4(p,1.0); vec4 mv=viewMatrix*wp; gl_Position=projectionMatrix*mv;
            vec3 V=normalize(cameraPosition-wp.xyz); float gl=pow(max(0.0,dot(V,normalize(mat3(modelMatrix)*aDir))),220.0);
            float tw=pow(0.5+0.5*sin(uTime*0.9+aR*80.0),30.0); vA=0.26+0.24*aR+gl*2.4+tw*0.6; gl_PointSize=uPx*(1.3+gl*2.2)*(9.0/-mv.z); }`,
        fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); gl_FragColor=vec4(vec3(0.82,0.9,1.0)*vA*a,1.0); }` });
      const pts = new THREE.Points(geo, mat); g.add(pts);
      /* an LED glow along the bottom edge, as if it sits on a light base */
      const led = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.05, 0.7), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec2 vUv; void main(){ float a=exp(-vUv.y*5.0)*smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x)*0.35; gl_FragColor=vec4(vec3(0.55,0.75,1.0)*a,1.0); }' }));
      led.position.set(0, -h / 2 + 0.3, 0.06); g.add(led);
      g.userData.dark = true;
      return { relief: k => { const z = (0.05 + k * 0.07) * RK / 0.72; mat.uniforms.uZ.value = z; pts.position.z = 0.012 + z * 0.5; }, update: t => { mat.uniforms.uTime.value = t; } };
    } },
  focus: { name: 'Rack focus', amt: [0.8, 1.5],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const mat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: P.tex }, uMap: { value: P.mapTex }, uFocus: { value: 0.6 }, uAp: { value: 1 }, uAsp: { value: P.aspect } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform sampler2D uTex; uniform sampler2D uMap; uniform float uFocus; uniform float uAp; uniform float uAsp; varying vec2 vUv;
          float coc(vec2 uv){ return clamp(abs(texture2D(uMap,uv).r-uFocus)*uAp*1.6,0.0,1.0); }
          void main(){ float c0=coc(vUv); float R=0.022*uAp; vec3 acc=vec3(0.0); float wsum=0.0;
            for(int i=0;i<40;i++){ float fi=float(i); float r=sqrt((fi+0.5)/40.0); float a=fi*2.39996; vec2 o=vec2(cos(a),sin(a))*r*R*vec2(1.0/uAsp,1.0);
              vec2 uv=vUv+o*c0; float cs=coc(uv); vec3 s=texture2D(uTex,uv,c0*2.0).rgb; float l=dot(s,vec3(0.299,0.587,0.114));
              float w=(1.0+pow(l,5.0)*10.0*c0)*mix(1.0,smoothstep(0.0,0.4,cs),step(cs,c0)); acc+=s*w; wsum+=w; }
            vec3 col=acc/wsum; gl_FragColor=vec4(col,1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }` });
      mat.toneMapped = false;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); g.add(plane);
      let want = 0.75, f = 0.75;
      return { relief: k => { mat.uniforms.uAp.value = k; }, update: (t, dt) => { const hit = api.pick(plane); if (hit) want = sample(P.D, P.W, P.H, hit.x, hit.y); else if (!reduce) want = 0.5 + 0.38 * Math.sin(t * 0.5); f += (want - f) * Math.min(1, dt * 5); mat.uniforms.uFocus.value = f;
        api.hud('f/' + (1.4 * Math.pow(2, (1 - Math.min(1, api.amt / 2.5)) * 3)).toFixed(1) + ' · <b>focus ' + (0.6 + Math.pow(1 - f, 1.6) * 14).toFixed(1) + ' m</b>'); } };
    } },
  fireflies: { name: 'Fireflies', amt: [0.8, 1.2],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const N = P.W * P.H, Hf = new Float32Array(N); for (let i = 0; i < N; i++) Hf[i] = P.D[i] * 0.55 + P.R[i] * 0.45;
      const geo = reliefGeo(P, w, h, smoothHeight(P, Hf, 1.5));
      const night = new THREE.MeshStandardMaterial({ map: P.tex, color: 0x5c6c96, roughness: 0.7, envMapIntensity: 0.22 }); g.add(new THREE.Mesh(geo, night));
      const M = 160, pos = new Float32Array(M * 3), seed = [], pg = new THREE.BufferGeometry(); for (let i = 0; i < M; i++) seed.push([hash(i * 1.3), hash(i * 2.9), hash(i * 4.1), hash(i * 7.7)]);
      pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const br = new Float32Array(M); pg.setAttribute('aB', new THREE.BufferAttribute(br, 1));
      const pm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: renderer.getPixelRatio() } },
        vertexShader: 'attribute float aB; uniform float uPx; varying float vB; void main(){ vB=aB; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*(6.0+aB*14.0)*(9.0/-mv.z); }',
        fragmentShader: 'varying float vB; void main(){ float d=length(gl_PointCoord-0.5); float core=smoothstep(0.18,0.0,d); float halo=exp(-d*d*28.0); gl_FragColor=vec4(vec3(1.0,0.82,0.36)*(core*1.4+halo*0.6)*vB,1.0); }' });
      const pts = new THREE.Points(pg, pm); g.add(pts);
      let K = 1;
      return { relief: k => { K = k; setRelief(geo, k * 0.16); }, update: t => {
        for (let i = 0; i < M; i++) { const s = seed[i], u = (s[0] + 0.05 * Math.sin(t * (0.2 + s[2] * 0.3) + s[3] * 9)) % 1, v = 0.08 + s[1] * 0.75 + 0.04 * Math.sin(t * (0.3 + s[3] * 0.4) + s[0] * 7);
          pos[i * 3] = (u - 0.5) * w; pos[i * 3 + 1] = (v - 0.5) * h; pos[i * 3 + 2] = (0.02 + s[2] * 1.15) * 0.1 * K * RK + 0.01;
          const ph = (t * (0.25 + s[3] * 0.35) + s[0] * 10) % 1; br[i] = Math.pow(Math.max(0, Math.sin(ph * Math.PI)), 6) * (0.6 + s[2] * 0.4); }
        pg.attributes.position.needsUpdate = true; pg.attributes.aB.needsUpdate = true; } };
    } },
  depthscan: { name: 'Depth scan', amt: [0.8, 1.2],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const N = P.W * P.H, Hf = new Float32Array(N); for (let i = 0; i < N; i++) Hf[i] = P.D[i] * 0.6 + P.R[i] * 0.4;
      const geo = reliefGeo(P, w, h, smoothHeight(P, Hf, 1.5));
      const mat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: P.tex }, uMap: { value: P.mapTex }, uT: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform sampler2D uTex; uniform sampler2D uMap; uniform float uT; varying vec2 vUv;
          void main(){ vec3 p=texture2D(uTex,vUv).rgb; float d=texture2D(uMap,vUv).r; float l=dot(p,vec3(0.299,0.587,0.114));
            float k=d*16.0; float fw=fwidth(k); float line=1.0-smoothstep(0.0,fw*1.4,abs(fract(k)-0.5)*2.0-1.0+fw*1.4); line=smoothstep(fw*1.2,0.0,min(fract(k),1.0-fract(k)));
            float wave=1.0-fract(uT*0.22); float band=exp(-pow((d-wave)*14.0,2.0)); float trail=smoothstep(wave-0.02,wave+0.25,d)*0.55;
            vec3 base=mix(vec3(0.02,0.05,0.07),vec3(0.05,0.16,0.2),l)+p*0.12; vec3 c=mix(base,p*1.1,clamp(band*0.9+trail,0.0,1.0));
            c+=vec3(0.25,0.95,1.0)*line*(0.1+band*1.4); c+=vec3(0.6,1.0,1.0)*band*0.12; gl_FragColor=vec4(c,1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }` });
      mat.toneMapped = false; mat.extensions = { derivatives: true };
      g.add(new THREE.Mesh(geo, mat));
      return { relief: k => setRelief(geo, k * 0.16), update: t => { mat.uniforms.uT.value = t; } };
    } },
  sun: { name: 'Golden hour', amt: [0.7, 1.4],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.sun), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  rain: { name: 'Rainy window', amt: [0.6, 1.6],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 / P.aspect); const cx = c.getContext('2d'); cx.fillStyle = '#000'; cx.fillRect(0, 0, c.width, c.height);
      const wipe = new THREE.CanvasTexture(c); wipe.colorSpace = THREE.NoColorSpace;
      const m = shaderMat(P, FR.rain, { uWipe: { value: wipe } }), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh);
      return driver([m], mesh, (t, dt, hit) => { cx.fillStyle = 'rgba(0,0,0,' + (dt * 0.12) + ')'; cx.fillRect(0, 0, c.width, c.height);
        if (hit) { const x = hit.x * c.width, y = (1 - hit.y) * c.height, gr = cx.createRadialGradient(x, y, 0, x, y, 20); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.beginPath(); cx.arc(x, y, 20, 0, 7); cx.fill(); }
        wipe.needsUpdate = true; });
    } },
  snow: { name: 'First snow', amt: [0.6, 1.6],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const N = P.W * P.H, Hf = new Float32Array(N); for (let i = 0; i < N; i++) Hf[i] = P.D[i] * 0.55 + P.R[i] * 0.45;
      const geo = reliefGeo(P, w, h, smoothHeight(P, Hf, 1.5)), m = shaderMat(P, FR.snow), mesh = new THREE.Mesh(geo, m); g.add(mesh);
      const M = 900, pos = new Float32Array(M * 3), seed = []; for (let i = 0; i < M; i++) seed.push([hash(i * 1.1), hash(i * 2.3), hash(i * 3.7), hash(i * 5.9)]);
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const sz = new Float32Array(M).map((_, i) => 0.4 + seed[i][3]); pg.setAttribute('aS', new THREE.BufferAttribute(sz, 1));
      const pm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPx: { value: renderer.getPixelRatio() } },
        vertexShader: 'attribute float aS; uniform float uPx; varying float vS; void main(){ vS=aS; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*(2.0+aS*4.0)*(9.0/-mv.z); }',
        fragmentShader: 'varying float vS; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.1,d)*0.9; gl_FragColor=vec4(vec3(0.95,0.97,1.0),a); }' });
      g.add(new THREE.Points(pg, pm)); let K = 1;
      const drv = driver([m], mesh, t => { for (let i = 0; i < M; i++) { const s = seed[i], fall = (s[1] - t * (0.035 + s[3] * 0.03)) % 1, v = fall < 0 ? fall + 1 : fall;
        pos[i * 3] = (s[0] - 0.5) * w + Math.sin(t * (0.6 + s[2]) + s[3] * 9) * 0.06; pos[i * 3 + 1] = (v - 0.5) * h * 1.1; pos[i * 3 + 2] = (0.01 + s[2] * 1.1) * 0.1 * K * RK + 0.01; }
        pg.attributes.position.needsUpdate = true; });
      return { relief: k => { K = Math.max(0.3, k); setRelief(geo, K * 0.16); m.uniforms.uK.value = k; }, update: drv.update };
    } },
  anaglyph: { name: 'Red-cyan 3D', amt: [0.8, 1.3],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.anaglyph), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  holoplate: { name: 'Hologram plate', amt: [0.8, 1.2],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const N = P.W * P.H, Hf = new Float32Array(N); for (let i = 0; i < N; i++) Hf[i] = P.D[i] * 0.5 + P.R[i] * 0.5;
      const geo = reliefGeo(P, w, h, smoothHeight(P, Hf, 1.5)), m = shaderMat(P, FR.holo, { vs: VSN }), mesh = new THREE.Mesh(geo, m); g.add(mesh); const d = driver([m], mesh); return { update: d.update, relief: k => setRelief(geo, k * 0.14) }; } },
  chrome: { name: 'Liquid chrome', amt: [0.6, 1.6],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const SW = 200, SH = Math.round(200 / P.aspect), cur = new Float32Array(SW * SH), prev = new Float32Array(SW * SH), data = new Uint8Array(SW * SH * 4);
      const nt = new THREE.DataTexture(data, SW, SH, THREE.RGBAFormat); nt.magFilter = THREE.LinearFilter; nt.minFilter = THREE.LinearFilter; nt.needsUpdate = true;
      const N = P.W * P.H, Hf = new Float32Array(N); for (let i = 0; i < N; i++) Hf[i] = P.R[i] * 0.6 + P.D[i] * 0.2;
      const map = texOf(P.W, P.H, true, i => { const t = 0.12 + 0.88 * Math.pow(P.L[i], 1.1); return [t * 0.97, t * 0.98, t]; });
      const geo = reliefGeo(P, w, h, smoothHeight(P, Hf, 3));
      const mat = new THREE.MeshPhysicalMaterial({ map, metalness: 1, roughness: 0.1, normalMap: nt, normalScale: new THREE.Vector2(1.6, 1.6), envMap: ENV2, envMapIntensity: 1.3 });
      const mesh = new THREE.Mesh(geo, mat); g.add(mesh); let last = null, nextDrop = 1, damp = 0.986;
      const drop = (u, v, a, r) => { const cx = u * SW, cy = v * SH; for (let y = Math.max(1, Math.floor(cy - r)); y < Math.min(SH - 1, cy + r); y++) for (let x = Math.max(1, Math.floor(cx - r)); x < Math.min(SW - 1, cx + r); x++) { const d = Math.hypot(x - cx, y - cy) / r; if (d < 1) cur[y * SW + x] += a * (Math.cos(d * Math.PI) + 1) * 0.5; } };
      return { relief: k => { damp = 0.97 + 0.025 * (1 - Math.min(1, k / 2.5)); setRelief(geo, 0.05); }, update: (t, dt) => { if (!api.active() && Math.random() > 0.2) return;
        const hit = api.pick(mesh); if (hit) { if (!last || Math.hypot(hit.x - last.x, hit.y - last.y) > 0.004) drop(hit.x, hit.y, 0.9, 3.5); last = hit.clone(); } else last = null;
        if (t > nextDrop) { drop(0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.8, 3, 4); nextDrop = t + 0.8 + Math.random() * 2; }
        for (let s = 0; s < 2; s++) { for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) { const i = y * SW + x; prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - SW] + cur[i + SW]) * 0.5 - prev[i]) * damp; }
          for (let i = 0; i < cur.length; i++) { const tmp = cur[i]; cur[i] = prev[i]; prev[i] = tmp; } }
        for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const i = y * SW + x, dx = (cur[x < SW - 1 ? i + 1 : i] - cur[x > 0 ? i - 1 : i]) * 0.35, dy = (cur[y < SH - 1 ? i + SW : i] - cur[y > 0 ? i - SW : i]) * 0.35, l = Math.hypot(dx, dy, 1);
          data[i * 4] = (-dx / l * 0.5 + 0.5) * 255; data[i * 4 + 1] = (-dy / l * 0.5 + 0.5) * 255; data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; data[i * 4 + 3] = 255; }
        nt.needsUpdate = true; } };
    } },
  planet: { name: 'Tiny planet', amt: [0.6, 2.0],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.planet), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  droste: { name: 'Infinite slab', amt: [0.4, 1.6],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.droste), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  blackhole: { name: 'Event horizon', amt: [0.6, 1.8],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.blackhole), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  polaroid: { name: 'Instant film', amt: null,
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k;
      const W = 1024, H = Math.round(1024 / P.aspect), c = document.createElement('canvas'); c.width = W; c.height = H; const cx = c.getContext('2d');
      cx.fillStyle = '#f2efe8'; cx.fillRect(0, 0, W, H); for (let i = 0; i < 9000; i++) { cx.fillStyle = 'rgba(0,0,0,' + Math.random() * 0.03 + ')'; cx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
      cx.clearRect(0.06 * W, 0.05 * H, 0.88 * W, 0.74 * H);
      cx.fillStyle = 'rgba(0,0,0,0.25)'; cx.fillRect(0.06 * W, 0.05 * H, 0.88 * W, 2); cx.fillStyle = '#1d2b5a'; cx.font = Math.round(H * 0.075) + 'px Caveat, cursive'; cx.fillText(api.caption, 0.1 * W, 0.91 * H);
      const ft = new THREE.CanvasTexture(c); ft.colorSpace = THREE.SRGBColorSpace;
      const m = shaderMat(P, FR.polaroid, { uFrame: { value: ft }, uT0: { value: 0 } }), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); let t0 = null;
      document.fonts.load('48px Caveat').then(() => { cx.fillStyle = '#f2efe8'; cx.fillRect(0, 0.82 * H, W, 0.18 * H); cx.fillStyle = '#1d2b5a'; cx.fillText(api.caption, 0.1 * W, 0.91 * H); ft.needsUpdate = true; }).catch(() => {});
      const d = driver([m], mesh, t => { if (t0 === null) t0 = t; m.uniforms.uT0.value = t0; const p = clamp((t - t0) / 22, 0, 1); api.hud(p < 1 ? 'DEVELOPING · <b>' + Math.round(p * 100) + '%</b>' : 'DEVELOPED · <b>INSTANT FILM</b>'); });
      return { pickMesh: mesh, click: () => { t0 = null; }, update: d.update, relief: () => {} };
    } },
  tray: { name: 'Developing tray', amt: null,
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.tray, { uT0: { value: 0 } }), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); let t0 = null;
      const d = driver([m], mesh, t => { if (t0 === null) t0 = t; m.uniforms.uT0.value = t0; const p = clamp((t - t0) / 16, 0, 1); api.hud('DEVELOPER · <b>' + Math.round((t - t0)) + ' S</b>' + (p >= 1 ? ' · INTO THE STOP BATH' : '')); });
      return { pickMesh: mesh, click: () => { t0 = null; }, update: d.update, relief: () => {} }; } },
  burn: { name: 'Film burn', amt: null,
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.burn, { uT0: { value: 0 }, uImp: { value: new THREE.Vector2(0.7, 0.6) } }), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); let t0 = null;
      const d = driver([m], mesh, t => { if (!api.active()) t0 = t; if (t0 === null || t - t0 > 10) { t0 = t; m.uniforms.uImp.value.set(0.25 + Math.random() * 0.5, 0.25 + Math.random() * 0.5); } m.uniforms.uT0.value = t0; });
      return { pickMesh: mesh, click: uv => { if (uv) m.uniforms.uImp.value.copy(uv); t0 = m.uniforms.uT.value - 0.9; }, update: d.update, relief: () => {} }; } },
  kaleido: { name: 'Kaleidoscope', amt: [0.5, 2.2],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.kal), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  riso: { name: 'Riso print', amt: [0.6, 1.6],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.riso), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  terminal: { name: 'Terminal', amt: [0.8, 1.5],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const gc = document.createElement('canvas'); gc.width = 480; gc.height = 80; const gx = gc.getContext('2d'); gx.fillStyle = '#000'; gx.fillRect(0, 0, 480, 80); gx.fillStyle = '#fff'; gx.font = '600 64px "Geist Mono", monospace'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; ' .:-=+*#%@'.split('').forEach((ch, i) => gx.fillText(ch, i * 48 + 24, 42));
      const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.NoColorSpace; gt.generateMipmaps = false; gt.minFilter = THREE.LinearFilter;
      const m = shaderMat(P, FR.ascii, { uGlyph: { value: gt } }), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  mist: { name: 'Morning mist', amt: [0.6, 1.4],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.mist), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  sunken: { name: 'Sunken', amt: [0.7, 1.5],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.under), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  lava: { name: 'The floor is lava', amt: [0.7, 1.4],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.lava), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  aurora: { name: 'Aurora australis', amt: [0.7, 1.8],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.aurora), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  coin: { name: 'Struck coin', amt: null,
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; return coin(P, g, w, h, api); } },
  pyro: { name: 'Pyrography', amt: [0.8, 1.4],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const N = P.W * P.H, burn = new Float32Array(N), hgt = new Float32Array(N), wood = new Float32Array(N);
      for (let y = 0, i = 0; y < P.H; y++) for (let x = 0; x < P.W; x++, i++) { const u = x / P.W, v = y / P.H, n = fbm2(u * 3, v * 14) * 3.5, ring = 0.5 + 0.5 * Math.sin((v * 38 + n) * Math.PI); wood[i] = Math.pow(ring, 3) * 0.6 + fbm2(u * 80, v * 6) * 0.4; burn[i] = Math.pow(sstep(0.85, 0.08, P.L[i]), 1.1); hgt[i] = wood[i] * 0.01 - burn[i] * 0.05; }
      const map = texOf(P.W, P.H, true, i => { const b = burn[i], gw = wood[i]; const c = [0.86 - gw * 0.16, 0.7 - gw * 0.17, 0.5 - gw * 0.15]; const sc = b < 0.6 ? [mix(c[0], 0.45, b / 0.6), mix(c[1], 0.24, b / 0.6), mix(c[2], 0.1, b / 0.6)] : [mix(0.45, 0.07, (b - 0.6) / 0.4), mix(0.24, 0.04, (b - 0.6) / 0.4), mix(0.1, 0.02, (b - 0.6) / 0.4)]; return sc; });
      const orm = texOf(P.W, P.H, false, i => [1, 0.78 - burn[i] * 0.3, 0]); const Hf = smoothHeight(P, burn.map(b => -b * 0.3), 1);
      const geo = reliefGeo(P, w, h, Hf); g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map, roughnessMap: orm, roughness: 1, metalness: 0, normalMap: normalOf(hgt, P.W, P.H, 18), envMapIntensity: 0.8 })));
      return { relief: k => setRelief(geo, k * 0.06) }; } },
  jade: { name: 'Carved jade', amt: [0.8, 1.2],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const N = P.W * P.H, Hf = smoothHeight(P, heightOf(P, 0.75, 0.2, 0), 1.6), cloud = new Float32Array(N);
      for (let y = 0, i = 0; y < P.H; y++) for (let x = 0; x < P.W; x++, i++) cloud[i] = sstep(0.45, 0.8, fbm2(x / P.W * 4 + 3, y / P.H * 3));
      const map = texOf(P.W, P.H, true, i => { const t = Math.pow(P.L[i], 0.85), c = [mix(0.02, 0.36, t), mix(0.16, 0.68, t), mix(0.07, 0.42, t)], m = cloud[i] * 0.35, fl = hash(i * 0.77) > 0.9992 ? 0.2 : 1; return [mix(c[0], 0.74, m) * fl, mix(c[1], 0.86, m) * fl, mix(c[2], 0.72, m) * fl]; });
      const em = texOf(P.W, P.H, true, i => { const t = Math.pow(P.L[i], 1.6) * 0.5; return [t * 0.25, t * 0.75, t * 0.4]; });
      const geo = reliefGeo(P, w, h, Hf); g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 0.6, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.3, sheenColor: new THREE.Color(0xcfffe0), normalMap: normalOf(P.Q.map(q => q * 0.4), P.W, P.H, 16), envMapIntensity: 1.1 })));
      return { relief: k => setRelief(geo, k * 0.14) }; } },
  vertigo: { name: 'Vertigo', amt: [0.6, 1.6],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.vertigo), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  tiltshift: { name: 'Tilt-shift miniature', amt: [0.7, 1.6],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.tiltshift), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  camcorder: { name: 'Camcorder', amt: [0.4, 1.6],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const W = 1024, H = Math.round(1024 / P.aspect), c = document.createElement('canvas'); c.width = W; c.height = H; const cx = c.getContext('2d'), ot = new THREE.CanvasTexture(c); ot.colorSpace = THREE.SRGBColorSpace; let last = '';
      const draw = () => { const n = new Date(); let tm = ''; try { tm = n.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).toUpperCase(); } catch (e) { tm = n.toTimeString().slice(0, 8); } if (tm === last) return; last = tm;
        cx.clearRect(0, 0, W, H); cx.font = '700 ' + Math.round(H * 0.07) + 'px "Geist Mono", monospace'; cx.fillStyle = '#fff'; cx.shadowColor = '#000'; cx.shadowOffsetX = 3; cx.shadowOffsetY = 3; cx.textAlign = 'left'; cx.fillText('PLAY ▶', W * 0.05, H * 0.12); cx.textAlign = 'right'; cx.fillText('SP', W * 0.95, H * 0.12);
        cx.textAlign = 'left'; cx.fillText(n.toLocaleDateString('en-NZ', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase().replace(',', ''), W * 0.05, H * 0.92); cx.textAlign = 'right'; cx.fillText(tm, W * 0.95, H * 0.92); ot.needsUpdate = true; };
      draw(); const m = shaderMat(P, FR.vhs, { uOsd: { value: ot } }), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh, draw); } },
  seasons: { name: 'Four seasons', amt: [0, 2.5],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.seasons), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh);
      const names = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER']; return driver([m], mesh, t => { const s = ((api.amt / 2.5 + t * 0.02) % 1) * 4; api.hud('SEASON · <b>' + names[Math.round(s) % 4] + '</b>'); }); } },
  puddles: { name: 'After the rain', amt: [0.6, 1.4],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.puddles), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  aero: { name: 'Aerochrome', amt: [0.6, 1.6],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.aero), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  storm: { name: 'Thunderstorm', amt: [0.7, 1.6],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.storm), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  fireworks: { name: 'Guy Fawkes night', amt: [0.7, 1.5],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.fireworks), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  lightpaint: { name: 'Light painting', amt: [0.7, 1.5],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.lightpaint), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  lensball: { name: 'Lensball', amt: [0.6, 1.6],
    build(P, g, w, h, api) { const driver = api.driver, renderer = api.renderer, camera = api.camera, ENV2 = api.env2, RK = RELIEF.k; const m = shaderMat(P, FR.lensball), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh); return driver([m], mesh); } },
  window: { name: 'Window into the scene', amt: [0.7, 1.3],
    build(P, g, w, h, api) { const m = shaderMat(P, FR.window, { vs: VS_WIN, uSize: { value: new THREE.Vector2(w, h) }, uDepth: { value: 1 } }), mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(mesh);
      return { relief: k => { m.uniforms.uDepth.value = 0.9 * k; }, update: t => { m.uniforms.uT.value = t; } }; } },
  scan3d: { name: 'Inside the scan', amt: [0.85, 1.1],
    build(P, g, w, h, api) { const holder = new THREE.Group(); holder.position.z = 0.06; g.add(holder); let K = 1, base = 1, s = null, gone = false, win = null;
      loadScan(api.S).then(sc => { if (gone) { if (sc) sc.release(); return; }
        if (!sc) { const m = shaderMat(P, FR.window, { vs: VS_WIN, uSize: { value: new THREE.Vector2(w, h) }, uDepth: { value: 0.9 } }); win = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(win); return; }
        s = sc; const off = new THREE.Group(); off.add(sc.mesh); sc.mesh.position.set(-sc.c[0], -sc.c[1], -sc.c[2]); const spin = new THREE.Group(); spin.rotation.y = sc.face; spin.add(off); holder.add(spin);
        base = Math.min(h * 0.86 / sc.size[1], w * 0.86 / Math.max(sc.size[0], sc.size[2]), 0.11 / Math.max(0.01, Math.min(sc.size[0], sc.size[2]) * 0.5)); holder.scale.setScalar(base * K); holder.position.y = -h * 0.04; });
      return { relief: k => { K = k; holder.scale.setScalar(base * K); }, update: t => { if (holder.children[0] && s) holder.children[0].rotation.y = s.face + Math.sin(t * 0.25) * 0.35; },
        dispose: () => { gone = true; if (s) s.release(); } };
    } },
};

/* ---------- what each finish is in the game: its tier, glow on the rail, Blades metal, how fast it idles ---------- */
/* glow: [colour, second colour, kind] (holo.js GLOWS); metal: Blades METALS [colour, roughness, iridescent, metalness, glass] */
export const META = {
  gold: { tier: 'legendary', metal: [0xe6b24a, 0.16] }, gilt: { tier: 'legendary', glow: [0xe9b54a, 0xfff0c0, 'steady'], metal: [0xe6b24a, 0.16] },
  dag: { tier: 'mythic', glow: [0xcfd8e6, 0xffffff, 'cold'], metal: [0xdfe3ea, 0.1] }, bronze: { tier: 'epic', glow: [0xc9874a, 0x5fb39a, 'steady'], metal: [0xb07a45, 0.3] },
  porcelain: { tier: 'epic', glow: [0x3a6fe0, 0xffffff, 'steady'], metal: [0xf0ede6, 0.3, 0, 0.05] }, kintsugi: { tier: 'legendary', glow: [0xf0c060, 0xbfe0d0, 'steady'], metal: [0x1f1e22, 0.28] },
  litho: { tier: 'epic', glow: [0xffb060, 0xffe8c8, 'pulse'], metal: [0xf2ede4, 0.5, 0, 0.05] }, crystal: { tier: 'mythic', sealed: true, cover: 0x050608, glow: [0x9fd0ff, 0xffffff, 'sparkle'], metal: [0xd8f0ff, 0.04, 0, 0.1, 1] },
  focus: { tier: 'uncommon', glow: [0xffe6b0, 0xffffff, 'steady'], metal: [0x9aa2ac, 0.25] }, fireflies: { tier: 'epic', glow: [0xffc85a, 0x9cff6a, 'sparkle'], metal: [0x6a7a40, 0.3] },
  depthscan: { tier: 'rare', glow: [0x40f0ff, 0x0a6070, 'cycle'], metal: [0x2a8a9a, 0.2] }, sun: { tier: 'legendary', glow: [0xffa040, 0xffe0a0, 'steady'], metal: [0xe0904a, 0.2] },
  rain: { tier: 'rare', glow: [0x9fc8e8, 0xffffff, 'cold'], metal: [0x9ab0c0, 0.15] }, snow: { tier: 'epic', glow: [0xe8f4ff, 0xffffff, 'cold'], metal: [0xeef4fa, 0.3, 0, 0.05] },
  window: { tier: 'mythic', sealed: true, glow: [0xd8c8a8, 0x4a6a40, 'steady'], metal: [0x6a5a48, 0.35] }, anaglyph: { tier: 'rare', glow: [0xff3030, 0x30e0ff, 'cycle'], metal: [0xc03040, 0.2, 1] },
  holoplate: { tier: 'legendary', glow: [0x60ff80, 0xffd040, 'cycle'], metal: [0x40c060, 0.1, 1] }, chrome: { tier: 'epic', metal: [0xffffff, 0.03] },
  planet: { tier: 'rare', glow: [0x6aa0ff, 0xffe0a0, 'cycle'], metal: [0x3a6ad0, 0.2] }, droste: { tier: 'mythic', glow: [0xe8d8b0, 0x8a6a40, 'pulse'], metal: [0xd8c8a0, 0.25], rest: 0.35 },
  blackhole: { tier: 'mythic', glow: [0xff7a20, 0x200010, 'hot'], metal: [0x101014, 0.15], rest: 0.4 }, polaroid: { tier: 'rare', glow: [0xf2efe8, 0x6aa0d0, 'pulse'], metal: [0xf0ede6, 0.4, 0, 0.05], rest: 1 },
  tray: { tier: 'epic', glow: [0xff3020, 0x600000, 'hot'], metal: [0x8a1a12, 0.25], rest: 1 }, burn: { tier: 'epic', glow: [0xff8030, 0xffe0a0, 'hot'], metal: [0xc06a2a, 0.3] },
  kaleido: { tier: 'uncommon', glow: [0xff60c0, 0x60e0ff, 'cycle'], metal: [0xd040a0, 0.12, 1], rest: 0.3 }, riso: { tier: 'common', glow: [0xff4a8a, 0x2060c0, 'cycle'], metal: [0xff4a8a, 0.35, 0, 0.1] },
  terminal: { tier: 'uncommon', glow: [0x30ff70, 0x0a4020, 'steady'], metal: [0x1a6a30, 0.25] }, mist: { tier: 'uncommon', glow: [0xe8e8e0, 0xffe8c0, 'steady'], metal: [0xc8ccd0, 0.3] },
  sunken: { tier: 'rare', glow: [0x30a0c0, 0x80ffe0, 'cycle'], metal: [0x1a7a8a, 0.2] }, lava: { tier: 'epic', glow: [0xff5010, 0xffc040, 'hot'], metal: [0xd04010, 0.3] },
  aurora: { tier: 'legendary', glow: [0x40ff90, 0xd040ff, 'cycle'], metal: [0x30c070, 0.15, 1] }, coin: { tier: 'legendary', sealed: true, cover: 0x0c0b0a, glow: [0xe0b050, 0xfff0c0, 'steady'], metal: [0xe0b050, 0.14] },
  pyro: { tier: 'rare', glow: [0xc07030, 0x401808, 'hot'], metal: [0x8a5a30, 0.4, 0, 0.1] }, jade: { tier: 'epic', glow: [0x40c070, 0xc0ffd0, 'steady'], metal: [0x2a8a50, 0.15, 0, 0.1] },
  vertigo: { tier: 'rare', glow: [0xc0a0ff, 0x40a0ff, 'cycle'], metal: [0x7a60d0, 0.2] }, tiltshift: { tier: 'common', glow: [0xffd060, 0x60c0ff, 'steady'], metal: [0xd0a040, 0.2] },
  camcorder: { tier: 'uncommon', glow: [0xff3040, 0x40a0ff, 'cycle'], metal: [0x303038, 0.3] }, seasons: { tier: 'rare', glow: [0xff9ec0, 0x9bd060, 'cycle'], metal: [0xd07a8a, 0.2] },
  puddles: { tier: 'uncommon', glow: [0x8ab0d0, 0xffffff, 'cold'], metal: [0x6a8098, 0.12] }, aero: { tier: 'uncommon', glow: [0xff3080, 0x30a0ff, 'cycle'], metal: [0xd03070, 0.2, 1] },
  storm: { tier: 'epic', glow: [0xc0d0ff, 0x3040a0, 'sparkle'], metal: [0x404a70, 0.2], rest: 0.3 }, fireworks: { tier: 'epic', glow: [0xff4060, 0x40e0ff, 'sparkle'], metal: [0xd03050, 0.15, 1], rest: 0.3 },
  lightpaint: { tier: 'mythic', glow: [0xff40c0, 0x40ffff, 'cycle'], metal: [0xa040d0, 0.1, 1] }, lensball: { tier: 'rare', glow: [0xffffff, 0xa0c8ff, 'steady'], metal: [0xe0e8f0, 0.04, 0, 0.1, 1] },
  scan3d: { tier: 'mythic', sealed: true, cover: 0x070806, glow: [0x9fe07a, 0xffffff, 'pulse'], metal: [0x6a8a50, 0.3] },
};
/* a word for the roll where the finish has no label of its own (the spec line under an inspected slab) */
const BAND = (lo, mid, hi) => a => a < 0.85 ? lo : a > 1.25 ? hi : mid;
const LABELS = { rain: BAND('Light rain', 'Steady rain', 'Downpour'), snow: BAND('A dusting', 'Snowfall', 'Deep snow'), aurora: BAND('Faint aurora', 'Aurora', 'Storm-strength aurora'),
  blackhole: BAND('Light hole', 'Black hole', 'Heavy hole'), kaleido: a => Math.floor(4 + a * 3.2) + ' mirrors', planet: BAND('Small world', 'Tiny world', 'Wide world'),
  droste: BAND('Gentle twist', 'Twist', 'Deep spiral'), focus: a => 'f/' + (1.4 * Math.pow(2, (1 - Math.min(1, a / 2.5)) * 3)).toFixed(1), mist: BAND('Thin mist', 'Mist', 'Thick fog'),
  sunken: BAND('Shallows', 'Under water', 'The deep'), lava: BAND('A trickle', 'Lava', 'A flood'), storm: BAND('Distant storm', 'Storm', 'Right overhead'), fireworks: BAND('Sparklers', 'Fireworks', 'Finale'),
  riso: BAND('In register', 'A little off', 'Way off'), camcorder: BAND('Clean tape', 'Worn tape', 'Chewed tape'), vertigo: BAND('Slow zoom', 'Dolly zoom', 'Big zoom'), tiltshift: BAND('Subtle', 'Miniature', 'Toy town'),
  seasons: a => ['Starts in spring', 'Starts in summer', 'Starts in autumn', 'Starts in winter'][Math.min(3, Math.floor(a / 2.5 * 4))], crystal: BAND('Shallow etch', 'Etched', 'Deep etch'),
  window: BAND('Shallow', 'Deep', 'Bottomless'), sun: BAND('Midday', 'Afternoon', 'Long shadows'), anaglyph: BAND('Gentle 3D', '3D', 'Big 3D'), lightpaint: BAND('Faint trail', 'Light trail', 'Bright trail') };
const LAST = new Map();
/* the per-slab words for an inspected slab's spec line, once its finish is built */
export function fxLabel(slab, id) { return LAST.get(slab.id + ':' + id) || ''; }
export const isFx = id => !!FX[id];
export const isSealed = id => !!(META[id] && META[id].sealed);

/* ---------- the adapter ---------- */
function seedOf(slab, id) { let h = ((slab.seed >>> 0) ^ 0x9e3779b9) >>> 0; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0; return h || 1; }
const NO_RAY = () => {};
const Q = []; let busy = false;
function queued(fn) { return new Promise((res, rej) => { Q.push({ fn, res, rej }); pump(); }); }
function pump() { if (busy || !Q.length) return; busy = true; const j = Q.shift(); setTimeout(() => { try { j.res(j.fn()); } catch (e) { j.rej(e); } busy = false; pump(); }, 16); }
export const depthKey = slab => { const p = slab.photo || {}; return p.url ? 'u:' + p.url : 'p:' + (p.plate || 0) + ':' + (slab.seed >>> 0); };
function disposeGroup(g, keep) { g.traverse(o => { if (o.geometry && !o.isSplatMesh) o.geometry.dispose(); [].concat(o.material || []).forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture && !keep.has(v)) v.dispose(); }
  if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture && !keep.has(v)) v.dispose(); } m.dispose(); }); }); }

function makeFx(S, id, d, ctx) {
  const obj = ctx.obj; if (!obj || !obj.base || !ctx.photoCanvas) return null;   /* Blades and other bare uses keep the plain photo (and their metal) */
  if (ctx.slab.decoy) return null;   /* the reel's decoys go by face down: no point building what nobody sees */
  const slab = ctx.slab, raw = !slab.graded, key = depthKey(slab), better = () => { if (!obj.disposed && obj.finishId === id && obj.refresh) obj.refresh(); };
  if (obj.fxDepthCb) forgetDepth(obj.fxDepthKey, obj.fxDepthCb); obj.fxDepthCb = better; obj.fxDepthKey = key;
  return depthFor(key, obj.base, better).then(depth => queued(() => {
    if (obj.disposed || obj.finishId !== id) return null;
    const P = photoMaps(ctx.photoCanvas, depth, ctx.photoTex, ctx.crop), seed = seedOf(slab, id), r0 = rngOf(seed), amt = d.amt ? mix(d.amt[0], d.amt[1], r0()) : 1, envs = studioEnvs(S.renderer);
    const g = new THREE.Group(); g.userData.fxGroup = true; let label = '', t = Math.random() * 20;
    const api = { S, amt, lamp: 1, renderer: S.renderer, camera: S.camera || S.ctx.camera, env2: envs.bright, tilt: new THREE.Vector2(), caption: captionOf(slab),
      rng: () => rngOf(seed ^ 0x5bd1e995), label: parts => { label = [].concat(parts).join(' · '); }, hud() {},
      active: () => !!obj.top, pick: () => (obj.top && obj.pointerOn ? obj.pointer : null),
      driver(mats, mesh, extra) { return { relief: k => mats.forEach(m => { m.uniforms.uK.value = k; }), update: (tt, dt) => { const hit = api.pick();
        mats.forEach(m => { const u = m.uniforms; u.uT.value = tt; u.uTilt.value.set(api.tilt.y, api.tilt.x); if (hit) u.uPtr.value.lerp(hit, Math.min(1, dt * 10)); u.uHov.value += ((hit ? 1 : 0) - u.uHov.value) * Math.min(1, dt * 3); });
        if (extra) extra(tt, dt, hit); } }; } };
    /* the variants that sit over the finish keep the relief low so it stays under them */
    /* the tallest relief stays inside the case (graded) or a shallow emboss (raw) */
    RELIEF.k = (raw ? 0.2 : 0.72) * (slab.variant === 'breakout' ? 0.45 : 1); RELIEF.cap = raw ? 0.03 : slab.variant === 'breakout' ? 0.04 : 0.115;
    let ctl = {}; try { ctl = d.build(P, g, ctx.w, ctx.h, api) || {}; if (ctl.relief) ctl.relief(amt); } finally { RELIEF.k = 1; RELIEF.cap = Infinity; }
    if (!label && LABELS[id]) label = LABELS[id](amt); LAST.set(slab.id + ':' + id, label);
    /* the finishes that are not a photo at all (a crystal block, a coin, the scan) sit on a dark card over the photo */
    if (META[id] && META[id].cover != null) { const bk = new THREE.Mesh(new THREE.PlaneGeometry(ctx.w, ctx.h), new THREE.MeshStandardMaterial({ color: META[id].cover, roughness: 0.6, metalness: 0 })); bk.position.z = 0.001; bk.userData.order = 3; g.add(bk); }
    /* not pickable: the table's hover test should stop at the slab's own card, not walk a few hundred thousand relief triangles */
    g.traverse(o => { if (o !== g) o.raycast = NO_RAY; [].concat(o.material || []).forEach(m => { if ((m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) && !m.envMap) m.envMap = envs.studio; }); });
    const keep = new Set([ctx.photoTex, envs.studio, envs.bright]), rest = (META[id] && META[id].rest) || 0.45;
    g.userData.fx = { id, label, P,
      update(c) { const sp = obj.top ? 1 : rest; t += c.dt * sp; api.tilt.set(-c.tilt.y * 0.45, c.tilt.x * 0.6); if (ctl.update) ctl.update(t, c.dt * sp); },
      click(uv) { if (ctl.click) { ctl.click(uv); return true; } return false; },
      dispose() { try { if (ctl.dispose) ctl.dispose(); } catch (e) {} if (obj.fxDepthCb === better) { forgetDepth(key, better); obj.fxDepthCb = null; } disposeGroup(g, keep); P.mapTex.dispose(); } };
    return g;
  }));
}
/* the handwriting on an instant print: the slab's title, lower case, the plate number dropped */
function captionOf(slab) { const t = String(slab.title || 'untitled').replace(/\s*·\s*Plate\s*\d+$/i, '').toLowerCase(); return t.length > 26 ? t.slice(0, 25) + '…' : t; }

export function install(S) {
  Object.entries(FX).forEach(([id, d]) => { const prev = S.SM.hasFinish(id) ? S.SM.finishDef(id) : null;   /* holo.js's old gold, chrome, porcelain, kintsugi: Blades still wear them */
    S.SM.registerFinish(id, { kind: 'fx', sealed: isSealed(id),
      make: ctx => (!ctx.obj && prev && prev.make ? prev.make(ctx) : makeFx(S, id, d, ctx)),
      update: (g, c) => { if (!g) return; if (g.userData.fx) g.userData.fx.update(c); else if (prev && prev.update) prev.update(g, c); } }); });
  /* the hover glows on the rail and the Blades metals, for the new finishes */
  if (S.holo && S.holo.GLOWS) Object.entries(META).forEach(([id, m]) => { if (m.glow) S.holo.GLOWS[id] = { color: m.glow[0], color2: m.glow[1], kind: m.glow[2], flicker: 0 }; });
  S.fx = { META, fxLabel, isFx, isSealed, depthKey };
  if (S.holo && S.holo.VARIANT_GLOWS) Object.assign(S.holo.VARIANT_GLOWS, { breakout: { color: 0xf3e6c8, color2: 0xffffff, kind: 'pulse' }, liquid: { color: 0x58d0c0, color2: 0xffd27a, kind: 'cycle' } });
  /* the AI depth model downloads once (about 27 MB) and is cached; Quick only keeps every map made on the spot */
  if (S.dev && S.dev.define) { S.dev.define('depth', 'Depth maps', { ai: 'AI, downloads once', quick: 'Quick only' }, 'ai'); setDepthMode(S.dev.opt('depth')); S.dev.on('depth', setDepthMode); }
}
