// Particle dissolve, reform and morph for the secret layer. Every mesh under an object is sampled with
// MeshSurfaceSampler into one Points cloud (colour from the material, and from its texture where it has one), then
// the points fly away (dissolve), fly home (reform) or cross from one object's surface to another's (morph).
// Modes: 'vortex' (spiral up and out), 'scatter' (burst, then fall), 'sand' (slump down and pour away).
// All three return a promise from the shared tween clock, so they pause with the room and obey setTimeScale.
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { tween, E } from './tween.js';

const MODES = { vortex: 0, scatter: 1, sand: 2 };
let SCENE = null;
export function initParticles(scene) { SCENE = scene; }

const VERT = `
attribute vec3 aFrom; attribute vec3 aTo; attribute vec3 aColor; attribute vec3 aColor2; attribute float aSeed;
uniform float uT; uniform float uDir; uniform float uMode; uniform vec3 uCentre; uniform float uSize; uniform float uSpread; uniform float uTime;
varying vec3 vColor; varying float vAlpha;
float hash(float n){ return fract(sin(n*127.1)*43758.5453); }
/* where a point on the surface ends up once it has gone */
vec3 away(vec3 p, float s){
  vec3 d=p-uCentre; float r=length(d.xz)+0.001; float a=atan(d.z,d.x);
  float h1=hash(s), h2=hash(s+1.3), h3=hash(s+2.7);
  if(uMode<0.5){ float ang=a+(1.5+h1*2.5)*3.14159; float rr=r*(0.25+h2*0.5)+uSpread*(0.6+h3*0.8);
    return vec3(uCentre.x+cos(ang)*rr, p.y+uSpread*(1.2+h2*1.6), uCentre.z+sin(ang)*rr); }
  if(uMode<1.5){ vec3 dir=normalize(vec3(h1-0.5,h2*0.9+0.2,h3-0.5)); return p+dir*uSpread*(0.8+h1*1.4)+vec3(0.0,-uSpread*0.9,0.0); }
  return vec3(p.x+(h1-0.5)*uSpread*0.9, uCentre.y-uSpread*0.55-h2*0.6, p.z+(h3-0.5)*uSpread*0.9+uSpread*0.4);
}
void main(){
  float stag=aSeed*0.45; float tt=clamp((uT-stag)/0.55,0.0,1.0); float e=tt*tt*(3.0-2.0*tt);
  vec3 pos; vColor=aColor;
  if(uDir>0.5){ pos=mix(aFrom, away(aFrom,aSeed), e); vAlpha=1.0-smoothstep(0.55,1.0,tt); }
  else if(uDir<-0.5){ pos=mix(away(aTo,aSeed), aTo, e); vAlpha=smoothstep(0.0,0.45,tt); }
  else { vec3 mid=mix(aFrom,aTo,0.5); mid.y+=uSpread*(0.6+hash(aSeed)*0.8);
    float a=atan(mid.z-uCentre.z, mid.x-uCentre.x)+e*3.14159*(0.5+hash(aSeed+5.0)); float r=length(mid.xz-uCentre.xz)*0.6;
    vec3 sw=vec3(uCentre.x+cos(a)*r, mid.y, uCentre.z+sin(a)*r); float b=4.0*e*(1.0-e);
    pos=mix(mix(aFrom,aTo,e), sw, b); vAlpha=1.0; vColor=mix(aColor,aColor2,e); }
  vColor*=0.8+0.2*sin(uTime*9.0+aSeed*40.0);
  vec4 mv=modelViewMatrix*vec4(pos,1.0);
  gl_PointSize=uSize*(180.0/max(1.0,-mv.z));
  gl_Position=projectionMatrix*mv;
}`;
const FRAG = `varying vec3 vColor; varying float vAlpha; uniform float uAlpha;
void main(){ vec2 q=gl_PointCoord-0.5; float d=length(q); if(d>0.5) discard;
  float a=(1.0-smoothstep(0.22,0.5,d))*vAlpha*uAlpha; if(a<0.02) discard;
  gl_FragColor=vec4(vColor,a);
  #include <colorspace_fragment>
}`;

/* a tiny readable copy of a texture, so sampled points can take the colour of the label or photo under them */
const PIX = new WeakMap();
function pixels(map) {
  if (!map || !map.image) return null;
  if (PIX.has(map)) return PIX.get(map);
  let out = null;
  try { const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d'); g.drawImage(map.image, 0, 0, 48, 48); out = g.getImageData(0, 0, 48, 48).data; } catch (e) { out = null; }
  PIX.set(map, out); return out;
}
function area(m) { const P = m.geometry.attributes.position, I = m.geometry.index; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let s = 0;
  const n = I ? I.count : P.count; for (let i = 0; i < n; i += 3) { const ia = I ? I.getX(i) : i, ib = I ? I.getX(i + 1) : i + 1, ic = I ? I.getX(i + 2) : i + 2;
    a.fromBufferAttribute(P, ia); b.fromBufferAttribute(P, ib); c.fromBufferAttribute(P, ic); s += b.sub(a).cross(c.sub(a)).length() * 0.5; }
  const sc = m.getWorldScale(new THREE.Vector3()); return s * Math.abs(sc.x * sc.y); }

/* sample(obj, count) → { pos: Float32Array(3n), col: Float32Array(3n) } in world space */
export function sampleObject(obj, count) {
  obj.updateMatrixWorld(true);
  const meshes = []; obj.traverse(m => { if (m.isMesh && m.visible && m.geometry && m.geometry.attributes.position && !m.userData.noParticles) meshes.push(m); });
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  if (!meshes.length) return { pos, col };
  const areas = meshes.map(area), total = areas.reduce((a, b) => a + b, 0) || 1;
  const p = new THREE.Vector3(), nrm = new THREE.Vector3(), uv = new THREE.Vector2(), tc = new THREE.Color();
  let k = 0;
  meshes.forEach((m, mi) => {
    const n = mi === meshes.length - 1 ? count - k : Math.round(count * areas[mi] / total); if (n <= 0) return;
    let sampler; try { sampler = new MeshSurfaceSampler(m).build(); } catch (e) { return; }
    const mats = Array.isArray(m.material) ? m.material : [m.material], groups = m.geometry.groups || [];
    const matOf = fi => { if (mats.length === 1) return mats[0]; const v = fi * 3; const g = groups.find(g => v >= g.start && v < g.start + g.count); return mats[g ? g.materialIndex : 0] || mats[0]; };
    for (let i = 0; i < n && k < count; i++) {
      /* three keeps these private (_sampleFaceIndex / _sampleFace); the public sample() hides the face, which the material groups need */
      const fi = (sampler._sampleFaceIndex || sampler.sampleFaceIndex).call(sampler); (sampler._sampleFace || sampler.sampleFace).call(sampler, fi, p, nrm, null, uv); p.applyMatrix4(m.matrixWorld);
      const mat = matOf(fi) || {}; tc.set(1, 1, 1); if (mat.color) tc.copy(mat.color);
      const px = mat.map ? pixels(mat.map) : null;
      if (px) { const x = Math.min(47, Math.max(0, Math.floor(uv.x * 48))), y = Math.min(47, Math.max(0, Math.floor((1 - uv.y) * 48))), o = (y * 48 + x) * 4; tc.multiply(new THREE.Color().setRGB(px[o] / 255, px[o + 1] / 255, px[o + 2] / 255, THREE.SRGBColorSpace)); }
      if (mat.emissive && mat.emissiveIntensity) tc.add(mat.emissive.clone().multiplyScalar(mat.emissiveIntensity));
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; col[k * 3] = tc.r; col[k * 3 + 1] = tc.g; col[k * 3 + 2] = tc.b; k++;
    }
  });
  return { pos, col };
}

function centreOf(obj) { const b = new THREE.Box3().setFromObject(obj); const c = b.getCenter(new THREE.Vector3()); c.y = b.min.y; return { c, size: b.getSize(new THREE.Vector3()).length() }; }

/* build the cloud. from/to are world-space Float32Arrays of the same length. */
export function makeCloud(from, to, colA, colB, o = {}) {
  const n = from.length / 3, g = new THREE.BufferGeometry(), seed = new Float32Array(n); for (let i = 0; i < n; i++) seed[i] = Math.random();
  g.setAttribute('position', new THREE.BufferAttribute(from.slice(), 3));
  g.setAttribute('aFrom', new THREE.BufferAttribute(from, 3)); g.setAttribute('aTo', new THREE.BufferAttribute(to, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(colA, 3)); g.setAttribute('aColor2', new THREE.BufferAttribute(colB || colA, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.boundingSphere = new THREE.Sphere(o.centre ? o.centre.clone() : new THREE.Vector3(), 1e3);
  const u = { uT: { value: 0 }, uDir: { value: o.dir ?? 1 }, uMode: { value: MODES[o.mode] ?? 0 }, uCentre: { value: o.centre || new THREE.Vector3() }, uSize: { value: o.size ?? 2.2 }, uSpread: { value: o.spread ?? 3 }, uTime: { value: 0 }, uAlpha: { value: 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = o.renderOrder ?? 6;
  return { points: pts, u, dispose() { if (pts.parent) pts.parent.remove(pts); g.dispose(); mat.dispose(); } };
}

const live = new Set();
export function particleFrame(dt) { for (const c of live) c.u.uTime.value += dt; }
function run(cloud, o, dur) {
  const parent = o.scene || SCENE; if (parent) parent.add(cloud.points); live.add(cloud);
  return tween({ dur, ease: o.ease || E.linear, delay: o.delay || 0, tag: o.tag, update: e => { cloud.u.uT.value = e; } }).then(ok => { live.delete(cloud); cloud.dispose(); return ok; });
}
const count = (o, size) => o.count || Math.min(9000, Math.max(1500, Math.round(size * 900)));

/* dissolve(obj) hides obj at once and blows its surface away; resolves when the last point has faded */
export function dissolve(obj, o = {}) {
  const { c, size } = centreOf(obj); const s = sampleObject(obj, count(o, size)); if (!o.keep) obj.visible = false;
  const cloud = makeCloud(s.pos, s.pos, s.col, null, { ...o, dir: 1, centre: o.centre || c, spread: o.spread ?? Math.max(1.5, size * 0.8) });
  return run(cloud, o, o.dur ?? 1.4);
}
/* reform(obj): the points gather from the air onto obj's surface, then obj shows */
export function reform(obj, o = {}) {
  const was = obj.visible; obj.visible = true; const { c, size } = centreOf(obj); const s = sampleObject(obj, count(o, size)); obj.visible = false;
  const cloud = makeCloud(s.pos, s.pos, s.col, null, { ...o, dir: -1, centre: o.centre || c, spread: o.spread ?? Math.max(1.5, size * 0.8) });
  return run(cloud, o, o.dur ?? 1.4).then(ok => { obj.visible = o.hideAfter ? false : true; return ok && was !== undefined; });
}
/* morph(a, b): a's surface becomes b's surface. a hides at the start, b shows at the end. */
export function morph(a, b, o = {}) {
  const A = centreOf(a); const wasB = b.visible; b.visible = true; b.updateMatrixWorld(true); const B = centreOf(b);
  const n = count(o, Math.max(A.size, B.size)); const sa = sampleObject(a, n), sb = sampleObject(b, n); a.visible = false; b.visible = false;
  const centre = o.centre || A.c.clone().lerp(B.c, 0.5);
  const cloud = makeCloud(sa.pos, sb.pos, sa.col, sb.col, { ...o, dir: 0, centre, spread: o.spread ?? Math.max(1.5, (A.size + B.size) * 0.35) });
  return run(cloud, o, o.dur ?? 2.0).then(ok => { b.visible = true; return ok || wasB; });
}
