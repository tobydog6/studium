// FXVARIANTS: the two variants Sam picked from the Slab Lab that sit over whatever finish a pull has.
// Breakout: the photo sits behind a cream mount and the subject (cut out by its depth) climbs out over it, casting a
// shadow; on a metal finish the subject comes out in that metal (so gold + breakout is the Gold breakout combo).
// Liquid: the case is half full of oil and gold glitter that sloshes when the slab moves; a case variant, so a raw
// print shows nothing of it until it is graded. Both return { dispose } to fxmount.js, which owns their lifetime.
import * as THREE from 'three';
import { depthFor } from './depth.js';
import { photoMaps, blur, sstep, texOf, reliefGeo, setRelief, smoothHeight, cavityOf, normalOf, ALLOYS, GOLD_D, GOLD_L, mix, rngOf, studioEnvs } from './fxkit.js';
import { depthKey } from './fxfinishes.js';

const NO_RAY = () => {};
const METAL = { gold: 1, gilt: 1, coin: 1, kintsugi: 1, bronze: [[0.28, 0.15, 0.08], [0.82, 0.55, 0.33]], dag: [[0.3, 0.3, 0.32], [0.95, 0.95, 0.92]] };
function metalTone(id, label) { const m = METAL[id]; if (!m) return null; if (m !== 1) return m; const a = ALLOYS.find(x => label && label.indexOf(x[0]) === 0); return a ? [a[1], a[2]] : [GOLD_D, GOLD_L]; }
function disposeAll(g, keep) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); [].concat(o.material || []).forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture && !keep.has(v)) v.dispose(); } if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture && !keep.has(v)) v.dispose(); } m.dispose(); }); }); }

export function variantFx(obj, S, rec, ctx) {
  const v = obj.slab.variant; if (v !== 'breakout' && v !== 'liquid') return null;
  if (v === 'liquid' && !obj.slab.graded) return null;
  const envs = studioEnvs(S.renderer), holder = new THREE.Group(); let gone = false, ownP = null; const keep = new Set([ctx.photoTex, obj.parts.photoTex, envs.studio, envs.bright]);
  if (v === 'liquid') { holder.add(liquid(obj)); obj.inner.add(holder); }
  else { holder.position.copy(obj.parts.photo.position); obj.inner.add(holder);
    const go = P => { if (gone) return; breakout(obj, S, holder, P, ctx, rec); holder.traverse(m => { if (m.isMesh) { m.userData.keepDepth = true; m.raycast = NO_RAY; if (m.userData.order == null) m.userData.order = 5; } }); if (obj.top) obj.setTop(true); };
    const fxP = rec.mesh && rec.mesh.userData.fx && rec.mesh.userData.fx.P;
    if (fxP) go(fxP); else depthFor(depthKey(obj.slab), obj.base).then(d => { if (gone) return; ownP = photoMaps(ctx.photoCanvas, d, ctx.photoTex, ctx.crop); go(ownP); }).catch(e => console.error(e)); }
  return { dispose() { gone = true; if (holder.parent) holder.parent.remove(holder); disposeAll(holder, keep); if (ownP) ownP.mapTex.dispose(); } };
}

function breakout(obj, S, holder, P, ctx, rec) {
  const w = ctx.w, h = ctx.h, N = P.W * P.H, zk = obj.slab.graded ? 1 : 0.3, mask = blur(P.R.map(r => sstep(0.2, 0.32, r)), P.W, P.H, 1);
  /* the window's top edge sits a little below where the subject starts, so the subject always climbs out over it */
  let top = P.H; for (let y = 0; y < P.H && top === P.H; y++) { let n = 0; for (let x = 0; x < P.W; x++) n += mask[y * P.W + x] > 0.5 ? 1 : 0; if (n > P.W * 0.012) top = y; }
  const wt = Math.min(0.3, Math.max(0.1, (top + (P.H - top) * 0.2) / P.H)), side = 0.07, bot = 0.07;
  const sh = new THREE.Shape(), X0 = -w / 2, X1 = w / 2, Y0 = -h / 2, Y1 = h / 2; sh.moveTo(X0, Y0); sh.lineTo(X1, Y0); sh.lineTo(X1, Y1); sh.lineTo(X0, Y1); sh.lineTo(X0, Y0);
  const hole = new THREE.Path(), hx0 = X0 + w * side, hx1 = X1 - w * side, hy0 = Y0 + h * bot, hy1 = Y1 - h * wt; hole.moveTo(hx0, hy0); hole.lineTo(hx0, hy1); hole.lineTo(hx1, hy1); hole.lineTo(hx1, hy0); hole.lineTo(hx0, hy0); sh.holes.push(hole);
  const env = studioEnvs(S.renderer).studio;
  const mount = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.014 * zk, bevelEnabled: true, bevelThickness: 0.005 * zk, bevelSize: 0.006, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0xece5d6, roughness: 0.85, envMap: env, envMapIntensity: 0.6 }));
  mount.position.z = 0.055 * zk; mount.userData.order = 5; holder.add(mount);
  const alpha = texOf(P.W, P.H, false, i => [mask[i], mask[i], mask[i]]), fgH = new Float32Array(N); for (let i = 0; i < N; i++) fgH[i] = P.R[i] + P.D[i] * 0.25;
  const fgGeo = reliefGeo(P, w, h, smoothHeight(P, fgH, 1.5), 220);
  const tone = metalTone(rec.id, rec.mesh && rec.mesh.userData.fx ? rec.mesh.userData.fx.label : '');
  let mat;
  if (tone) { const cav = cavityOf(P, fgH, 5), A0 = tone[0], A1 = tone[1], map = texOf(P.W, P.H, true, i => { const t = Math.pow(P.L[i], 0.8) * (1 - cav[i] * 0.5); return [mix(A0[0], A1[0], t), mix(A0[1], A1[1], t), mix(A0[2], A1[2], t)]; });
    const orm = texOf(P.W, P.H, false, i => [1 - cav[i] * 0.6, 0.16 + 0.28 * (1 - P.L[i]), 1]);
    mat = new THREE.MeshPhysicalMaterial({ map, roughnessMap: orm, metalnessMap: orm, aoMap: orm, roughness: 1, metalness: 1, normalMap: normalOf(P.Q.map(q => q * 0.5), P.W, P.H, 20), alphaMap: alpha, alphaTest: 0.5, side: THREE.DoubleSide, envMap: env, envMapIntensity: 1.5 }); }
  else mat = new THREE.MeshStandardMaterial({ map: ctx.photoTex, emissive: 0xffffff, emissiveMap: ctx.photoTex, emissiveIntensity: 0.55, alphaMap: alpha, alphaTest: 0.5, roughness: 0.5, envMap: env, envMapIntensity: 0.4, side: THREE.DoubleSide });
  const fg = new THREE.Mesh(fgGeo, mat); setRelief(fgGeo, 0.05 * zk); fg.position.z = 0.075 * zk; fg.userData.order = 7; holder.add(fg);
  const sm = blur(mask, P.W, P.H, 8), shadow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: texOf(P.W, P.H, false, i => [sm[i], sm[i], sm[i]]), transparent: true, opacity: 0.5, depthWrite: false }));
  shadow.position.set(0.04, -0.05, 0.071 * zk); shadow.userData.order = 6; holder.add(shadow);
}

/* the case half full of oil: a surface that sloshes with the slab's movement, glitter tumbling, bubbles rising */
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
function liquid(obj) {
  const r = rngOf(((obj.slab.seed >>> 0) ^ 0x1f3d5b79) >>> 0), fill = 0.38 + r() * 0.24, w = obj.w - 0.14, h = obj.h - 0.14;
  const m = new THREE.ShaderMaterial({ uniforms: { uLvl: { value: -0.5 + fill }, uAng: { value: 0 }, uWob: { value: 0 }, uT: { value: r() * 40 }, uTilt: { value: new THREE.Vector2() }, uAsp: { value: w / h } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: LIQ_FRAG, transparent: true, depthWrite: false });
  m.toneMapped = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.position.z = 0.07; mesh.userData.order = 8;
  /* a small spring: how fast the slab turns pushes the surface over, it swings back and settles */
  let th = 0, om = 0, last = null, lt = performance.now(); const lastT = new THREE.Vector2();
  mesh.onBeforeRender = () => { const now = performance.now(), dt = Math.min(0.05, (now - lt) / 1000); lt = now; if (!dt) return; const tl = obj.tilt;
    if (!last) { last = true; lastT.copy(tl); } const vx = (tl.x - lastT.x) / dt, vy = (tl.y - lastT.y) / dt; lastT.copy(tl);
    om += (-th * 22 - om * 1.4 + vx * 2.2 - vy * 0.8) * dt; th = Math.max(-0.55, Math.min(0.55, th + om * dt));
    const u = m.uniforms; u.uT.value += dt; u.uAng.value = th + Math.sin(u.uT.value * 0.7) * 0.015; u.uWob.value = Math.min(2, Math.abs(om) * 0.6); u.uTilt.value.copy(tl); };
  return mesh;
}
