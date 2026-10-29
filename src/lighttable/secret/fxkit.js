// FXKIT: the shared toolkit for the depth finishes (fxfinishes.js), lifted from Sam's Slab Lab page so every finish
// keeps the look he picked there: per-pixel helpers over a photo's maps, relief meshes, the worked metal grounds, the
// alloy/patina/ink/glaze tables the per-slab rolls draw from, and the GLSL every shader finish shares.
// A photo's maps (P): W, H, aspect, and per pixel L (luma, stretched), D (depth, near = 1), R (the subject: depth above
// the ground at each row), E (depth edges), Q (fine detail), C (colour, sRGB 0..1), plus tex (the photo) and mapTex
// (D, R, E as one linear texture). photoMaps() makes them from a photo canvas and its depth (depth.js).
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), mix = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
const ANISO = 8;
export const GOLD_D = [0.36, 0.22, 0.08], GOLD_L = [1.0, 0.86, 0.56];
export const pick = (r, a) => a[Math.floor(r() * a.length)];
export const ALLOYS = [['Yellow gold', [0.36, 0.22, 0.08], [1.0, 0.86, 0.56]], ['Rose gold', [0.38, 0.17, 0.11], [1.0, 0.76, 0.64]], ['White gold', [0.3, 0.29, 0.27], [0.97, 0.96, 0.91]], ['Green gold', [0.28, 0.26, 0.09], [0.92, 0.9, 0.56]], ['Antique gold', [0.2, 0.11, 0.04], [0.86, 0.66, 0.34]], ['Red gold', [0.36, 0.13, 0.06], [1.0, 0.68, 0.46]]];
export const RELIEFS = [['subject relief', 0.78, 0.1, 1.0], ['whole scene', 0.35, 0.5, 0.95], ['deep relief', 0.7, 0.25, 1.6], ['shallow, like a coin', 0.5, 0.2, 0.55], ['high relief', 0.92, 0.05, 1.35]];
export const BGS = ['Brushed', 'Hammered', 'Engine turned', 'Sandblasted', 'Vertical brushed', 'Mirror'];
export const PATINAS = [['Verdigris', [0.3, 0.5, 0.44]], ['Blue patina', [0.2, 0.36, 0.5]], ['Brown patina', [0.3, 0.19, 0.1]], ['Black patina', [0.07, 0.07, 0.065]], ['Turquoise', [0.18, 0.55, 0.55]]];
export const INKS = [['Cobalt', [0.07, 0.17, 0.55]], ['Celadon green', [0.2, 0.42, 0.32]], ['Famille rose', [0.7, 0.22, 0.36]], ['Iron red', [0.58, 0.13, 0.06]], ['Ink black', [0.08, 0.08, 0.1]], ['Imperial yellow', [0.75, 0.55, 0.05]]];
export const GLAZES = [['Celadon', [0.16, 0.26, 0.24], [0.74, 0.85, 0.76]], ['Black raku', [0.03, 0.03, 0.035], [0.4, 0.37, 0.33]], ['Snow white', [0.5, 0.5, 0.48], [0.97, 0.96, 0.93]], ['Sky blue', [0.12, 0.26, 0.42], [0.72, 0.86, 0.96]], ['Persimmon', [0.32, 0.09, 0.03], [0.95, 0.58, 0.32]]];
export function blur(a, W, H, r) { /* three box passes each way: close to a gaussian */
  const out = new Float32Array(a), tmp = new Float32Array(a.length), R = Math.max(1, Math.round(r));
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) { let acc = 0; const o = y * W; for (let x = -R; x <= R; x++) acc += out[o + clamp(x, 0, W - 1)];
      for (let x = 0; x < W; x++) { tmp[o + x] = acc / (2 * R + 1); acc += out[o + Math.min(W - 1, x + R + 1)] - out[o + Math.max(0, x - R)]; } }
    for (let x = 0; x < W; x++) { let acc = 0; for (let y = -R; y <= R; y++) acc += tmp[clamp(y, 0, H - 1) * W + x];
      for (let y = 0; y < H; y++) { out[y * W + x] = acc / (2 * R + 1); acc += tmp[Math.min(H - 1, y + R + 1) * W + x] - tmp[Math.max(0, y - R) * W + x]; } }
  }
  return out;
}
export function texOf(W, H, srgb, fn) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) { const v = fn(i, x, y); d[i * 4] = v[0] * 255; d[i * 4 + 1] = v[1] * 255; d[i * 4 + 2] = v[2] * 255; d[i * 4 + 3] = v.length > 3 ? v[3] * 255 : 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = ANISO; return t;
}
export function normalOf(h, W, H, k) {
  return texOf(W, H, false, (i, x, y) => { const dx = (h[x < W - 1 ? i + 1 : i] - h[x > 0 ? i - 1 : i]) * k, dy = (h[y < H - 1 ? i + W : i] - h[y > 0 ? i - W : i]) * k;
    const nx = -dx, ny = dy, l = Math.hypot(nx, ny, 1); return [nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, 1 / l * 0.5 + 0.5]; });
}
export function sample(a, W, H, u, v) { const x = u * (W - 1), y = (1 - v) * (H - 1), x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), fx = x - x0, fy = y - y0;
  return mix(mix(a[y0 * W + x0], a[y0 * W + x1], fx), mix(a[y1 * W + x0], a[y1 * W + x1], fx), fy); }
export function reliefGeo(P, w, h, Hf, seg = 340) {
  const sx = seg, sy = Math.round(seg * h / w), g = new THREE.PlaneGeometry(w, h, sx, sy), uv = g.attributes.uv, n = uv.count, base = new Float32Array(n);
  const pin = 0.012 * Math.max(w, h);
  for (let i = 0; i < n; i++) { const u = uv.getX(i), v = uv.getY(i); const e = Math.min(u * w, (1 - u) * w, v * h, (1 - v) * h); base[i] = sample(Hf, P.W, P.H, u, v) * sstep(0, pin, e); }
  g.userData.base = base; return g;
}
/* relief heights are scaled to fit where the finish lives: the slab's case (graded) or a shallow emboss (a raw print) */
export const RELIEF = { k: 1, cap: Infinity };
export function setRelief(g, k) { k *= RELIEF.k; if (RELIEF.cap < Infinity) { if (g.userData.maxB == null) { let mx = 1e-6; for (const v of g.userData.base) mx = Math.max(mx, v); g.userData.maxB = mx; } k = Math.min(k, RELIEF.cap / g.userData.maxB); } const p = g.attributes.position, b = g.userData.base; for (let i = 0; i < b.length; i++) p.setZ(i, b[i] * k); p.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); }
export function cavityOf(P, Hf, r = 5) { const b = blur(Hf, P.W, P.H, r), c = new Float32Array(Hf.length); for (let i = 0; i < c.length; i++) c[i] = clamp((b[i] - Hf[i]) * 6, 0, 1); return c; }
export function heightOf(P, kR, kD, kQ) { const N = P.W * P.H, h = new Float32Array(N); for (let i = 0; i < N; i++) h[i] = P.R[i] * kR + P.D[i] * kD + P.Q[i] * kQ; return h; }
export function smoothHeight(P, h, r = 1.5) { return blur(h, P.W, P.H, r); }
export function crackle(W, H, cells, width) {
  const pts = []; const n = cells, cw = W / n, chh = cw; const rows = Math.ceil(H / chh) + 1;
  for (let j = -1; j <= rows; j++) for (let i = -1; i <= n; i++) pts.push([(i + hash(i * 7.3 + j * 1.9)) * cw, (j + hash(i * 3.7 + j * 9.1)) * chh]);
  const out = new Float32Array(W * H), cols = n + 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ci = Math.floor(x / cw) + 1, cj = Math.floor(y / chh) + 1; let d1 = 1e9, d2 = 1e9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const p = pts[(cj + dj) * cols + (ci + di)]; if (!p) continue; const d = Math.hypot(p[0] - x, p[1] - y); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    out[y * W + x] = 1 - sstep(0, width, d2 - d1); }
  return out;
}
export function rngOf(seed) { let a = (seed >>> 0) || 1; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
export function bgPattern(P, kind, r) {
  const W = P.W, H = P.H, N = W * H, h = new Float32Array(N), s = r() * 100; let rough = 0.08;
  if (kind === 'Brushed' || kind === 'Vertical brushed') { const vert = kind !== 'Brushed', L = vert ? W : H, line = new Float32Array(L); for (let k = 0; k < L; k++) line[k] = hash(k * 3.1 + s) * 0.6 + hash(Math.floor(k / 3) * 7.7 + s) * 0.4;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) h[i] = line[vert ? x : y] * 0.012; rough = 0.12; }
  else if (kind === 'Hammered') { const cs = W / (18 + r() * 14), cols = Math.ceil(W / cs) + 2, sd = []; for (let j = 0; j < Math.ceil(H / cs) + 2; j++) for (let i = 0; i < cols; i++) sd.push([(i - 1 + hash(i * 3.1 + j * 7.7 + s)) * cs, (j - 1 + hash(i * 5.3 + j * 1.9 + s)) * cs]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ci = Math.floor(x / cs) + 1, cj = Math.floor(y / cs) + 1; let d = 1e9; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = sd[(cj + dj) * cols + ci + di]; if (q) d = Math.min(d, Math.hypot(q[0] - x, q[1] - y)); } h[y * W + x] = -Math.pow(Math.max(0, 0.8 - d / cs), 2) * 0.05; } rough = 0.15; }
  else if (kind === 'Engine turned') { const cx = W * (0.25 + r() * 0.5), cy = H * (0.25 + r() * 0.5), f = 0.16 + r() * 0.12, k = 8 + Math.floor(r() * 12); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx); h[y * W + x] = 0.006 * Math.sin(d * f + 2.5 * Math.sin(a * k)); } rough = 0.08; }
  else if (kind === 'Sandblasted') { for (let i = 0; i < N; i++) h[i] = hash(i * 0.37 + s); const b = blur(h, W, H, 1); for (let i = 0; i < N; i++) h[i] = b[i] * 0.02; rough = 0.4; }
  else rough = -0.08;
  return { h, rough };
}
export function beadRim(h, P) { const W = P.W, H = P.H, b = W * 0.022; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const e = Math.min(x, W - 1 - x, y, H - 1 - y); if (e > b * 1.6) continue; const along = (x < b * 1.6 || x > W - 1 - b * 1.6) ? y : x, cx = (Math.floor(along / b) + 0.5) * b, d = Math.hypot(along - cx, e - b * 0.8) / (b * 0.42); if (d < 1) h[y * W + x] += Math.sqrt(1 - d * d) * 0.03; } }
export function vn2(x, y) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), hh = (a, b) => hash(a * 127.1 + b * 311.7);
  return mix(mix(hh(xi, yi), hh(xi + 1, yi), u), mix(hh(xi, yi + 1), hh(xi + 1, yi + 1), u), v); }
export function fbm2(x, y) { let s = 0, a = 0.5; for (let i = 0; i < 5; i++) { s += a * vn2(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; }
export const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
export const VSN = 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }';
export const GLH = `uniform sampler2D uTex; uniform sampler2D uMap; uniform float uT; uniform float uK; uniform vec2 uPtr; uniform float uHov; uniform vec2 uTilt; uniform float uAsp; varying vec2 vUv;
float luma(vec3 c){ return dot(c,vec3(0.299,0.587,0.114)); }
float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
vec2 h2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h1(i),h1(i+vec2(1.0,0.0)),f.x),mix(h1(i+vec2(0.0,1.0)),h1(i+vec2(1.0,1.0)),f.x),f.y); }
float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
float Dp(vec2 uv){ return texture2D(uMap,uv).r; }
vec3 nrm(vec2 uv, float H){ vec2 e=vec2(1.5/480.0,1.5/320.0); float dx=Dp(uv+vec2(e.x,0.0))-Dp(uv-vec2(e.x,0.0)), dy=Dp(uv+vec2(0.0,e.y))-Dp(uv-vec2(0.0,e.y)); return normalize(vec3(-dx*H/(2.0*e.x)/uAsp,-dy*H/(2.0*e.y),1.0)); }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
`;
export const OUT = '\n#include <colorspace_fragment>\n}';
export const FR = {
  sun: `uniform vec3 uSunL;
    void main(){ vec3 alb=texture2D(uTex,vUv).rgb; float ph=uT*0.045*6.2832;
    #ifdef REAL
    vec3 S=normalize(uSunL); vec2 sun=vec2(S.x*1.3,S.y*2.2); float elev=S.y*1.6; vec3 L=normalize(vec3(S.x,S.y*0.7,max(abs(S.z)*0.5,0.2)));
    #else
    vec2 sun=mix(vec2(-cos(ph)*1.1, 0.12+0.6*abs(sin(ph))), (uPtr-0.5)*2.2, uHov); float elev=sun.y;
    vec3 L=normalize(vec3(sun.x, sun.y*0.7, 0.28+0.25*max(elev,0.0)));
    #endif
    float H=0.22*max(uK,0.15); vec3 n=nrm(vUv,H*1.4); n=normalize(n+vec3((texture2D(uTex,vUv+vec2(0.002,0.0)).g-texture2D(uTex,vUv-vec2(0.002,0.0)).g)*-0.6,(texture2D(uTex,vUv+vec2(0.0,0.003)).g-texture2D(uTex,vUv-vec2(0.0,0.003)).g)*-0.6,0.0));
    float h0=Dp(vUv)*H; vec2 dir=normalize(L.xy+vec2(1e-4))*vec2(1.0/uAsp,1.0); float rise=L.z/max(length(L.xy),1e-3); float sh=1.0;
    for(int i=1;i<=40;i++){ float s=float(i)*0.007; vec2 p=vUv+dir*s; if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0) break; float hs=Dp(p)*H; float rh=h0+rise*s; sh=min(sh,1.0-smoothstep(0.0,0.02,hs-rh-0.002)); }
    float day=smoothstep(-0.15,0.35,elev); vec3 sunC=mix(vec3(1.0,0.45,0.15),vec3(1.0,0.93,0.82),smoothstep(0.05,0.8,elev))*smoothstep(-0.2,0.02,elev)*1.9;
    vec3 sky=mix(vec3(0.05,0.07,0.16),mix(vec3(0.55,0.45,0.5),vec3(0.55,0.62,0.75),smoothstep(0.1,0.6,elev)),day);
    float dif=max(dot(n,L),0.0); vec3 c=alb*(sky*0.38+sunC*dif*sh*1.15);
    vec2 sp=0.5+sun*0.5; vec2 dl=(sp-vUv)/28.0; vec2 q=vUv; float acc=0.0, dec=1.0;
    for(int i=0;i<28;i++){ q+=dl; vec3 s=texture2D(uTex,q).rgb; acc+=(1.0-Dp(q))*smoothstep(0.35,0.85,luma(s))*dec; dec*=0.95; }
    c+=sunC*acc*0.045*day; vec2 dd=(vUv-sp)*vec2(uAsp,1.0); c+=sunC*exp(-dot(dd,dd)*40.0)*(1.0-Dp(vUv))*0.7;
    c=mix(c, c*vec3(0.6,0.7,1.1)+vec3(0.0,0.0,0.015), 1.0-day);
    gl_FragColor=vec4(c,1.0);`,
  rain: `uniform sampler2D uWipe;
    void main(){ vec2 a=vec2(uAsp,1.0); vec2 off=vec2(0.0); float m=0.0; float tr=0.0; vec2 nn=vec2(0.0);
    for(int L=0;L<2;L++){ float sc=L==0?18.0:42.0; vec2 g=vUv*a*sc; vec2 id=floor(g); vec2 f=fract(g)-0.5; vec2 c=(h2(id+float(L)*13.0)-0.5)*0.6; float on=step(0.45-uK*0.12,h1(id+7.0+float(L))); float r=0.1+0.25*h1(id+3.1);
      vec2 d=f-c; float dm=smoothstep(r,r*0.75,length(d))*on; m=max(m,dm); off+=d/max(r,1e-3)*dm*0.012*(L==0?1.6:0.8); nn+=d/max(r,1e-3)*dm; }
    float x=vUv.x*uAsp*8.0; float col=floor(x); float fx=fract(x)-0.5; float rc=h1(vec2(col,1.7)); float sp=0.03+0.06*rc; float Q=fract(uT*sp*(0.5+uK*0.5)+rc*5.0); float yp=1.15-Q*1.3;
    float xp=0.18*sin(yp*14.0+rc*20.0); vec2 q=vec2(fx-xp, (vUv.y-yp)*8.0); float dr=smoothstep(0.3,0.2,length(q*vec2(1.0,0.75)))*step(0.25,rc);
    float trail=smoothstep(0.14,0.04,abs(fx-0.18*sin((vUv.y)*14.0+rc*20.0)))*step(0.0,q.y)*smoothstep(3.0,0.0,q.y)*step(0.25,rc);
    off+=q*dr*0.02; m=max(m,dr); nn+=q*dr*2.0; tr=trail;
    float w=texture2D(uWipe,vUv).r; float fog=(1.0-clamp(w*1.6,0.0,1.0))*(1.0-max(m,tr*0.9));
    vec3 sharp=texture2D(uTex,vUv-off*1.4).rgb; vec3 blurry=texture2D(uTex,vUv,5.5).rgb;
    vec3 fogC=blurry*0.62+vec3(0.17,0.19,0.21); vec3 c=mix(sharp,fogC,fog*0.6);
    c+=pow(max(0.0,dot(normalize(vec3(nn,1.0)),normalize(vec3(-0.4,0.6,0.7)))),24.0)*m*0.55;
    c*=vec3(0.9,0.96,1.04); gl_FragColor=vec4(c,1.0);`,
  snow: `void main(){ vec3 alb=texture2D(uTex,vUv).rgb; float l=luma(alb); vec3 n=nrm(vUv,0.35);
    float acc=clamp(uT*0.045,0.0,1.0)*uK; float up=n.y*1.6+ (1.0-abs(n.x))*0.1;
    float s=up+0.25*l+0.45*fbm(vUv*vec2(uAsp,1.0)*40.0)-1.3+acc*0.6; float cov=smoothstep(0.0,0.18,s);
    vec3 base=mix(vec3(l),alb,0.45)*vec3(0.62,0.7,0.82); vec3 snowC=vec3(0.86,0.9,0.97)*(0.75+0.3*n.y);
    float sp=step(0.996,h1(floor(vUv*vec2(uAsp,1.0)*700.0)))*(0.5+0.5*sin(uT*3.0+h1(floor(vUv*900.0))*30.0+uTilt.x*20.0));
    vec3 c=mix(base,snowC,cov)+sp*cov*0.9; gl_FragColor=vec4(c,1.0);`,
  anaglyph: `void main(){ float d=Dp(vUv); float s=(d-0.45)*0.016*uK;
    vec3 Lc=texture2D(uTex,vUv-vec2(s,0.0)).rgb, Rc=texture2D(uTex,vUv+vec2(s,0.0)).rgb;
    vec3 c=vec3(pow(luma(Lc),0.9)*1.08, Rc.g*1.02, Rc.b*1.05); gl_FragColor=vec4(c,1.0);`,
  holo: `void main(){ vec3 t=texture2D(uTex,vUv).rgb; float l=luma(t); float ang=uTilt.x+uTilt.y*0.35;
    float win=exp(-pow((ang-0.12)/0.11,2.0)); float win2=exp(-pow((ang+0.28)/0.08,2.0))*0.5;
    float speck=0.75+0.5*h1(floor(vUv*vec2(uAsp,1.0)*520.0));
    vec3 tint=mix(vec3(0.35,1.0,0.45),vec3(1.0,0.85,0.35),smoothstep(0.0,0.2,ang)); vec3 tint2=hue(fract(0.6+ang*2.0+vUv.y*0.3));
    float img=pow(smoothstep(0.08,0.95,l),1.3)*speck;
    float f=pow(1.0-max(0.0,dot(normalize(vN),normalize(vV))),2.0);
    vec3 c=vec3(0.015,0.018,0.02)+hue(fract(vUv.x*0.8+ang*3.0))*0.05*(0.3+f) + tint*img*win*1.6 + tint2*img*win2*1.4;
    gl_FragColor=vec4(c,1.0);`,
  neon: `void main(){ vec3 p=texture2D(uTex,vUv).rgb; float e=texture2D(uMap,vUv).b; float d=Dp(vUv);
    float tube=smoothstep(0.4,0.62,e); float eg=0.0, eg2=0.0; vec2 a=vec2(1.0/uAsp,1.0);
    for(int i=0;i<16;i++){ float an=float(i)*2.39996; float rr=sqrt((float(i)+0.5)/16.0); vec2 o=vec2(cos(an),sin(an))*rr*a; eg+=smoothstep(0.4,0.62,texture2D(uMap,vUv+o*0.012).b); eg2+=smoothstep(0.4,0.62,texture2D(uMap,vUv+o*0.045).b); }
    eg/=16.0; eg2/=16.0; vec3 col=d>0.62?vec3(1.0,0.22,0.62):d>0.35?vec3(1.0,0.62,0.18):vec3(0.2,0.85,1.0);
    vec3 colB=Dp(vUv)>0.62?vec3(1.0,0.22,0.62):vec3(0.2,0.85,1.0);
    vec2 seg=floor(vUv*vec2(5.0,3.0)); float bad=step(0.82,h1(seg)); float fl=mix(1.0, step(0.35,h1(seg+floor(uT*14.0)))*0.9+0.1, bad);
    vec2 b=vUv*vec2(uAsp*14.0,26.0); b.x+=step(1.0,mod(floor(b.y),2.0))*0.5; vec2 bf=fract(b); float mortar=smoothstep(0.0,0.06,bf.x)*smoothstep(0.0,0.08,bf.y);
    vec3 wall=vec3(0.028,0.022,0.024)*(0.5+0.5*mortar)*(0.8+0.4*h1(floor(b)))+p*0.012;
    vec3 c=wall*(1.0+eg2*6.0*uK) + col*(eg*0.7+eg2*0.45)*uK*fl;
    c=mix(c, col*1.25+vec3(0.55)*smoothstep(0.75,0.92,e), tube*fl);
    gl_FragColor=vec4(c,1.0);`,
  stitch: `void main(){ float N=110.0; vec2 gp=vec2(vUv.x*N, vUv.y*N/uAsp); vec2 id=floor(gp); vec2 f=fract(gp);
    vec3 col=texture2D(uTex,(id+0.5)/vec2(N,N/uAsp),2.0).rgb; col=floor(col*6.0+0.5)/6.0; col=mix(vec3(luma(col)),col,1.25);
    float w=0.19; float d1=abs(f.x-f.y)*0.7071, d2=abs(f.x+f.y-1.0)*0.7071; vec3 Ld=normalize(vec3(-0.4-uTilt.y,0.5+uTilt.x,0.8));
    vec3 c; if(d2<w){ float t=d2/w; vec3 n=normalize(vec3(0.7071*t,0.7071*t,sqrt(1.0-t*t))); float tw=0.82+0.18*sin((f.x-f.y)*40.0+t*9.0); c=col*(0.35+0.85*max(dot(n,Ld),0.0))*tw; }
    else if(d1<w){ float t=d1/w; vec3 n=normalize(vec3(0.7071*t,-0.7071*t,sqrt(1.0-t*t))); float tw=0.82+0.18*sin((f.x+f.y)*40.0+t*9.0); c=col*(0.28+0.7*max(dot(n,Ld),0.0))*tw; }
    else { float weave=0.88+0.12*sin(f.x*25.1)*sin(f.y*25.1); vec2 cr=min(f,1.0-f); float hole=smoothstep(0.08,0.16,length(cr)); c=vec3(0.86,0.83,0.76)*weave*(0.55+0.45*hole); }
    gl_FragColor=vec4(c,1.0);`,
  planet: `void main(){ vec2 p=(vUv-0.5)*vec2(uAsp,1.0); float r=length(p); float an=atan(p.y,p.x); float R=0.3+0.18*min(uK,2.5)/2.5;
    float u=fract(an/6.2832+0.25+uT*0.012); u=abs(u*2.0-1.0); float v=pow(r/R,0.85);
    vec3 c=texture2D(uTex,vec2(u,clamp(v,0.002,0.998))).rgb; vec3 sky=texture2D(uTex,vec2(0.5,0.95),9.0).rgb;
    float o=smoothstep(0.97,1.06,v); float fade=clamp((v-1.0)*0.9,0.0,1.0);
    vec3 space=mix(sky*0.9,vec3(0.01,0.012,0.03),fade)+step(0.9965,h1(floor(p*500.0)))*fade*(0.6+0.4*sin(uT*2.0+h1(floor(p*300.0))*40.0));
    c=mix(c,space,o); c+=vec3(0.6,0.75,1.0)*exp(-pow((v-1.0)*7.0,2.0))*0.18; gl_FragColor=vec4(c,1.0);`,
  droste: `void main(){ float s=0.38; float th=0.5*uK; float ph=fract(uT*0.06); vec2 a=vec2(uAsp,1.0);
    vec2 q=(vUv-0.5)*a; q=rot(th*ph)*q*pow(s,ph); vec2 p=q/a; float border=0.0;
    for(int i=0;i<12;i++){ vec2 pq=rot(-th)*(p*a/s); vec2 pp=pq/a; if(max(abs(pp.x),abs(pp.y))<0.5){ p=pp; } }
    vec2 e=(0.5-abs(p))*a; float ed=min(e.x,e.y); vec3 c=texture2D(uTex,p+0.5).rgb;
    vec3 mount=vec3(0.92,0.89,0.82); c=mix(mount,c,smoothstep(0.035,0.04,ed)); c=mix(vec3(0.88,0.7,0.38),c,smoothstep(0.004,0.008,abs(ed-0.02)));
    c=mix(vec3(0.05),c,smoothstep(0.0,0.004,ed)); gl_FragColor=vec4(c,1.0);`,
  blackhole: `void main(){ vec2 a=vec2(uAsp,1.0); vec2 cc=mix(vec2(0.5+0.25*cos(uT*0.21),0.5+0.2*sin(uT*0.33)),uPtr,uHov);
    vec2 d=(vUv-cc)*a; float r=length(d); float rs=0.035+0.03*uK;
    float defl=rs*rs*1.8/max(r,1e-4); vec2 uv=vUv-normalize(d)/a*min(defl,r*2.0); vec3 c=texture2D(uTex,uv).rgb;
    c*=1.0+1.2*exp(-pow((r-rs*1.55)/(rs*0.22),2.0));
    vec2 q=d/rs; q=rot(0.25)*q; q.y*=3.4; float rr=length(q); float disk=smoothstep(1.4,1.9,rr)*smoothstep(4.8,2.2,rr); float an=atan(q.y,q.x);
    float sw=fbm(vec2(an*2.5-uT*1.6,rr*1.8)); vec3 dc=mix(vec3(1.0,0.38,0.08),vec3(1.0,0.92,0.75),sw)*(0.5+0.9*sw)*(1.0+0.7*cos(an));
    float hor=smoothstep(rs*1.03,rs*0.97,r); float front=step(q.y,0.0);
    c=mix(c,vec3(0.0),hor); c+=dc*disk*mix(1.0-hor,1.0,front)*1.5; c+=vec3(1.0,0.82,0.6)*exp(-pow((r-rs*1.06)/(rs*0.05),2.0))*1.2;
    gl_FragColor=vec4(c,1.0);`,
  glitch: `void main(){ float tb=floor(uT*7.0); float burst=step(0.62,h1(vec2(floor(uT*1.6),3.0))); float g=(0.15+0.85*burst)*uK;
    vec2 bid=floor(vUv*vec2(18.0,12.0)); float on=step(1.0-0.22*g,h1(bid+tb)); vec2 uv=vUv+on*(h2(bid+tb+3.0)-0.5)*vec2(0.09,0.03)*g;
    float row=floor(vUv.y*90.0); uv.x+=step(1.0-0.06*g,h1(vec2(row,tb)))*(h1(vec2(row,tb+1.0))-0.5)*0.22*g;
    float rel=texture2D(uMap,vUv).g; float colm=floor(vUv.x*260.0); float len=h1(vec2(colm,floor(uT*1.5)))*0.3*g*smoothstep(0.15,0.4,rel);
    vec3 s=texture2D(uTex,uv).rgb; vec3 best=s; for(int i=1;i<12;i++){ vec3 c2=texture2D(uTex,uv+vec2(0.0,len*float(i)/12.0)).rgb; if(luma(c2)>luma(best)) best=c2; } s=mix(s,best,step(0.002,len));
    float d=Dp(vUv); float sp=(d-0.35)*0.02*g+0.002; vec3 c=vec3(texture2D(uTex,uv+vec2(sp,0.0)).r, s.g, texture2D(uTex,uv-vec2(sp,0.0)).b);
    c=mix(c, vec3(s.r,s.g,s.b), 0.0); c*=0.92+0.08*sin(vUv.y*1100.0); c+=(h1(vUv*900.0+uT)-0.5)*0.07*g; c=mix(c,floor(c*4.0)/4.0,on*0.6);
    gl_FragColor=vec4(c,1.0);`,
};
Object.assign(FR, {
  age: `void main(){ float a=clamp(uK/2.5,0.0,1.0); vec2 uv=vUv; vec2 A=vec2(uAsp,1.0);
    vec3 c=texture2D(uTex,uv).rgb; float l=luma(c);
    vec3 faded=vec3(c.r*1.02+0.06,c.g*0.86+0.05,c.b*0.68+0.04); c=mix(c,faded,smoothstep(0.0,0.6,a)); c=mix(c,vec3(0.62,0.55,0.46),a*0.32); c+=vec3(0.06,0.035,-0.05)*a*(0.5+l);
    float fx=fbm(uv*A*9.0+3.7); float spots=smoothstep(0.76-a*0.12,0.79-a*0.12,fx)*smoothstep(0.25,0.6,a);
    vec2 sg=uv*A*90.0; float sp2=step(0.985,h1(floor(sg)))*step(0.4,a)*smoothstep(0.35,0.0,length(fract(sg)-0.5));
    c=mix(c,vec3(0.45,0.28,0.12),spots*0.55+sp2*0.6);
    vec2 e=min(uv,1.0-uv)*A; float ed=min(e.x,e.y); float mir=smoothstep(0.14*a+0.01,0.0,ed+(fbm(uv*14.0)-0.5)*0.05)*smoothstep(0.3,0.8,a);
    c=mix(c,vec3(0.5,0.56,0.66)*(0.5+1.1*pow(max(0.0,0.5+uTilt.x*1.5+uTilt.y),2.0)),mir*0.75*(1.0-l*0.4));
    vec2 g=uv*A*22.0; vec2 id=floor(g); float d1=9.0,d2=9.0; for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 o=vec2(float(i),float(j)); vec2 pp=o+h2(id+o)-fract(g); float dd=dot(pp,pp); if(dd<d1){ d2=d1; d1=dd; } else if(dd<d2) d2=dd; }
    float crk=(1.0-smoothstep(0.0,0.05,sqrt(d2)-sqrt(d1)))*smoothstep(0.55,0.9,a)*step(0.45,fbm(uv*4.0)); c=mix(c,vec3(0.9,0.86,0.78),crk*0.6);
    float sc=0.0; for(int k=0;k<7;k++){ float fk=float(k); vec2 p0=h2(vec2(fk,3.0)); float an=h1(vec2(fk,7.0))*3.14; vec2 dir=vec2(cos(an),sin(an)); vec2 q=(uv-p0)*A; float along=dot(q,dir); float across=abs(dot(q,vec2(-dir.y,dir.x))); sc+=smoothstep(0.0018,0.0,across)*step(abs(along),0.3)*step(fk/7.0,a); }
    c+=vec3(0.55)*min(sc,1.0)*0.5;
    vec2 cq=(1.0-uv)*A; float corner=step(cq.x+cq.y,0.16*smoothstep(0.5,1.0,a)); c=mix(c,vec3(0.8,0.76,0.68)*(0.85+0.15*h1(floor(uv*400.0))),corner);
    gl_FragColor=vec4(c,1.0);`,
  polaroid: `uniform sampler2D uFrame; uniform float uT0;
    void main(){ vec2 lo=vec2(0.06,0.21), hi=vec2(0.94,0.95); vec2 iu=(vUv-lo)/(hi-lo); float inAsp=uAsp*(hi.x-lo.x)/(hi.y-lo.y);
    vec2 pu=iu; if(inAsp>uAsp) pu.y=0.5+(iu.y-0.5)*uAsp/inAsp; else pu.x=0.5+(iu.x-0.5)*inAsp/uAsp;
    vec3 p=texture2D(uTex,clamp(pu,0.0,1.0)).rgb; float dev=clamp((uT-uT0)/22.0,0.0,1.0);
    float local=clamp(dev*1.15+(fbm(iu*3.0)-0.5)*0.18-(1.0-iu.y)*0.06,0.0,1.0);
    vec3 dark=vec3(0.035,0.045,0.04); vec3 mid=mix(vec3(luma(p))*vec3(0.6,0.85,1.1),p,0.35)*0.7+vec3(0.0,0.01,0.025);
    vec3 fin=p*vec3(1.06,1.0,0.88)+vec3(0.012,0.008,0.0);
    vec3 c=mix(dark,mid,smoothstep(0.0,0.55,local)); c=mix(c,fin,smoothstep(0.45,1.0,local)); vec2 vg=iu-0.5; c*=1.0-dot(vg,vg)*0.5;
    vec4 f=texture2D(uFrame,vUv); c=mix(c,f.rgb,f.a); gl_FragColor=vec4(c,1.0);`,
  tray: `uniform float uT0;
    float Hw(vec2 q){ return sin(q.x*9.0+uT*1.3+uTilt.x*6.0)*0.5+sin(q.y*11.0-uT*1.1+uTilt.y*5.0)*0.4+sin((q.x+q.y)*17.0+uT*2.1)*0.25+fbm(q*6.0+uT*0.3)*0.6; }
    void main(){ vec2 A=vec2(uAsp,1.0); vec2 q=vUv*A; vec2 e=vec2(0.004,0.0); vec2 gr=vec2(Hw(q+e.xy)-Hw(q-e.xy),Hw(q+e.yx)-Hw(q-e.yx))/0.008;
    vec2 uv=vUv+gr*0.0035; vec2 lo=vec2(0.06,0.08), hi=vec2(0.94,0.92); vec2 iu=(uv-lo)/(hi-lo); float inP=step(0.0,iu.x)*step(iu.x,1.0)*step(0.0,iu.y)*step(iu.y,1.0);
    float l=luma(texture2D(uTex,clamp(iu,0.0,1.0)).rgb); float dev=clamp((uT-uT0)/16.0,0.0,1.0); float shown=smoothstep(0.0,0.5,dev*1.4-l*0.55);
    vec3 print=mix(vec3(0.9),vec3(l*0.9+0.02),shown); vec3 base=mix(vec3(0.03),print,inP);
    float caus=pow(0.5+0.5*sin(Hw(q)*3.0),8.0)*0.35; vec3 safe=vec3(1.0,0.16,0.07); vec3 c=base*safe*(0.75+caus);
    float spec=pow(max(0.0,1.0-abs(vUv.x-0.28-uTilt.x*0.7+gr.x*0.05)*3.0),6.0)*pow(max(0.0,1.0-abs(vUv.y-0.72+uTilt.y*0.5+gr.y*0.05)*2.0),4.0);
    c+=safe*spec*0.8; gl_FragColor=vec4(c,1.0);`,
  burn: `uniform float uT0; uniform vec2 uImp;
    void main(){ float t=uT-uT0; vec2 A=vec2(uAsp,1.0); vec2 uv=vUv; float band=0.085; float gate=step(band,uv.y)*step(uv.y,1.0-band);
    vec2 iu=vec2(uv.x,(uv.y-band)/(1.0-2.0*band))+vec2(sin(uT*13.0),cos(uT*11.0))*0.0012; float fr=floor(uT*24.0);
    vec3 c=texture2D(uTex,iu).rgb*(0.94+0.06*h1(vec2(fr,1.0))); c+=(h1(uv*A*700.0+fr)-0.5)*0.06; c=mix(c,vec3(0.03),step(0.9985,h1(floor(uv*A*160.0)+fr*0.37)));
    vec2 sp=vec2(uv.x*uAsp*9.0,uv.y); float hole=step(abs(fract(sp.x)-0.5),0.2)*step(abs(abs(uv.y-0.5)-0.5+band*0.5),band*0.28);
    c=mix(mix(vec3(0.02,0.016,0.012),vec3(0.9,0.88,0.82),hole),c,gate);
    float tt=max(0.0,t-1.0); float r=tt*tt*0.06+tt*0.04; float dist=length((uv-uImp)*A)+(fbm(uv*A*9.0+t*0.4)-0.5)*0.16*min(1.0,r*8.0+0.2); float edge=r-dist;
    vec3 hot=mix(vec3(1.0,0.3,0.03),vec3(1.0,0.85,0.4),smoothstep(0.0,0.02,edge));
    c=mix(c,c*vec3(1.0,0.6,0.3)*0.6,smoothstep(-0.12,0.0,edge)); c=mix(c,vec3(0.01),smoothstep(-0.035,-0.012,edge));
    c=mix(c,hot*2.2,smoothstep(-0.014,0.0,edge)*(1.0-smoothstep(0.0,0.03,edge))); c=mix(c,vec3(1.0,0.96,0.88)*1.4,smoothstep(0.02,0.045,edge));
    gl_FragColor=vec4(c,1.0);`,
  wind: `void main(){ vec3 p0=texture2D(uTex,vUv).rgb; float rel=texture2D(uMap,vUv).g; float d=Dp(vUv); vec2 A=vec2(uAsp,1.0);
    float green=clamp((p0.g-max(p0.r,p0.b))*6.0+0.2,0.0,1.0); float still=smoothstep(0.15,0.35,rel)*(1.0-green*0.5);
    float gust=0.6+0.4*sin(uT*0.4)+0.3*sin(uT*1.1+1.0); float w=(fbm(vUv*A*3.0+vec2(uT*0.35,0.0))-0.5)*2.0;
    float sway=sin(uT*2.3+vUv.x*8.0+fbm(vUv*7.0)*6.0)*0.6+w; float amp=(0.0025+0.003*(1.0-d))*uK*gust*(1.0-still)*(0.4+green);
    vec3 c=texture2D(uTex,vUv+vec2(sway*amp,sway*amp*0.3*sin(uT*1.7+vUv.y*20.0))).rgb;
    float dap=fbm(vUv*A*5.0+vec2(uT*0.12,uT*0.05)); c*=mix(1.0,0.8+0.42*smoothstep(0.45,0.65,dap),(1.0-still)*smoothstep(0.3,0.8,d)*0.8);
    gl_FragColor=vec4(c,1.0);`,
  riso: `float screenDot(vec2 uv,float ang,float freq,float v){ vec2 q=rot(ang)*(uv*vec2(uAsp,1.0))*freq; vec2 f=fract(q)-0.5; float r=sqrt(clamp(v,0.0,1.0))*0.64; return smoothstep(r+0.07,r-0.07,length(f)); }
    void main(){ float d=Dp(vUv); vec2 A=vec2(uAsp,1.0); vec2 mis=vec2(0.003,-0.0025)*uK+vec2((d-0.5)*0.01*uK,0.0);
    vec3 c1=texture2D(uTex,vUv).rgb; vec3 c2=texture2D(uTex,vUv+mis).rgb;
    float l1=luma(texture2D(uTex,vUv,1.0).rgb), l2=luma(texture2D(uTex,vUv+mis,1.0).rgb); float blue=smoothstep(0.4,0.06,l1)*0.95; float pink=clamp(smoothstep(0.3,0.06,l2)*0.55+(c2.r-c2.g)*1.6+smoothstep(0.55,0.85,d)*0.3-0.08,0.0,1.0);
    float grain=0.8+0.2*vnoise(vUv*A*300.0); float starve=0.82+0.18*smoothstep(0.3,0.7,fbm(vUv*A*3.0));
    float a1=screenDot(vUv,0.26,105.0,blue)*grain*starve; float a2=screenDot(vUv+mis,1.31,105.0,pink)*grain;
    vec3 paper=vec3(0.92,0.88,0.8)*(0.96+0.04*vnoise(vUv*A*500.0)); vec3 inkB=vec3(0.0,0.2,0.55); vec3 inkP=vec3(1.0,0.06,0.25);
    vec3 c=paper*mix(vec3(1.0),inkB,a1*0.95)*mix(vec3(1.0),inkP,a2*0.9); gl_FragColor=vec4(c,1.0);`,
  oil: `void main(){ vec2 px=vec2(1.0/960.0,1.0/640.0)*1.7; vec3 m0=vec3(0.0),m1=vec3(0.0),m2=vec3(0.0),m3=vec3(0.0),s0=vec3(0.0),s1=vec3(0.0),s2=vec3(0.0),s3=vec3(0.0);
    for(int j=0;j<=4;j++) for(int i=0;i<=4;i++){ vec2 o=vec2(float(i),float(j))*px; vec3 a=texture2D(uTex,vUv-o).rgb; m0+=a; s0+=a*a; vec3 b=texture2D(uTex,vUv+vec2(o.x,-o.y)).rgb; m1+=b; s1+=b*b; vec3 c=texture2D(uTex,vUv+vec2(-o.x,o.y)).rgb; m2+=c; s2+=c*c; vec3 d=texture2D(uTex,vUv+o).rgb; m3+=d; s3+=d*d; }
    m0/=25.0; m1/=25.0; m2/=25.0; m3/=25.0; vec3 v0=abs(s0/25.0-m0*m0), v1=abs(s1/25.0-m1*m1), v2=abs(s2/25.0-m2*m2), v3=abs(s3/25.0-m3*m3);
    float a0=v0.r+v0.g+v0.b, a1=v1.r+v1.g+v1.b, a2=v2.r+v2.g+v2.b, a3=v3.r+v3.g+v3.b; vec3 col=m0; float best=a0; if(a1<best){ best=a1; col=m1; } if(a2<best){ best=a2; col=m2; } if(a3<best){ best=a3; col=m3; }
    vec2 e=px*2.0; vec2 g=vec2(luma(texture2D(uTex,vUv+vec2(e.x,0.0),2.0).rgb)-luma(texture2D(uTex,vUv-vec2(e.x,0.0),2.0).rgb), luma(texture2D(uTex,vUv+vec2(0.0,e.y),2.0).rgb)-luma(texture2D(uTex,vUv-vec2(0.0,e.y),2.0).rgb));
    vec2 dir=normalize(vec2(-g.y,g.x)+vec2(1e-4,0.0)); vec2 p=vUv*vec2(uAsp,1.0); vec2 q=vec2(dot(p,dir),dot(p,vec2(-dir.y,dir.x)));
    float st=vnoise(vec2(q.x*30.0,q.y*240.0))*0.55+vnoise(vec2(q.x*12.0,q.y*90.0))*0.35; float hgt=st*(0.4+0.6*luma(col))*uK+vnoise(p*40.0)*0.15;
    vec3 n=normalize(vec3(-dFdx(hgt)*7.0,-dFdy(hgt)*7.0,1.0)); vec3 L=normalize(vec3(-0.5+uTilt.y*1.5,0.6-uTilt.x*1.5,0.7));
    float dif=0.7+0.4*dot(n,L); float spec=pow(max(0.0,dot(reflect(-L,n),vec3(0.0,0.0,1.0))),28.0)*0.3;
    col=mix(vec3(luma(col)),col,1.25); vec3 c=col*dif+spec; gl_FragColor=vec4(c,1.0);`,
  ascii: `uniform sampler2D uGlyph;
    void main(){ float cols=130.0; vec2 cell=vec2(cols,cols/uAsp*0.62); vec2 g=vUv*cell; vec2 id=floor(g); vec2 f=fract(g); vec2 cuv=(id+0.5)/cell;
    vec3 p=texture2D(uTex,cuv,1.5).rgb; float l=luma(p); float d=Dp(cuv); float idx=floor(clamp(pow(l,0.8)*1.2,0.0,0.999)*10.0);
    float gl=texture2D(uGlyph,vec2((idx+f.x)/10.0,f.y)).r; vec3 phos=mix(vec3(0.08,0.85,0.3),vec3(0.75,1.0,0.85),smoothstep(0.5,0.9,d)*min(uK,1.5)/1.5);
    float scan=0.78+0.22*sin(vUv.y*cell.y*6.2832); float fl=0.96+0.04*sin(uT*50.0); float roll=0.9+0.1*smoothstep(0.0,0.06,abs(fract(vUv.y-uT*0.07)-0.5));
    vec3 c=phos*gl*(1.0+1.6*d)*scan*fl*roll+phos*0.03; gl_FragColor=vec4(c,1.0);`,
  kal: `void main(){ vec2 A=vec2(uAsp,1.0); vec2 p=(vUv-0.5)*A; float n=floor(4.0+uK*3.2); float seg=6.2832/n; float r=length(p);
    float an=atan(p.y,p.x)+uT*0.08; an=mod(an,seg); an=abs(an-seg*0.5); vec2 c=mix(vec2(0.55,0.45),uPtr,uHov);
    vec2 q=c+vec2(cos(an+uT*0.05),sin(an+uT*0.05))*r*0.55/A; q=1.0-abs(1.0-mod(q,2.0));
    vec3 col=texture2D(uTex,q).rgb*1.12; float sp=step(0.995,h1(floor(vec2(an*60.0,r*90.0))))*(0.5+0.5*sin(uT*3.0+r*40.0)); col+=sp*0.6;
    col=mix(col,vec3(0.01),smoothstep(0.46,0.49,r)); gl_FragColor=vec4(col,1.0);`,
  liquid: `uniform float uLvl; uniform float uAng; uniform float uWob;
    void main(){ vec2 A=vec2(uAsp,1.0); vec2 p=(vUv-0.5)*A; float surf=uLvl+p.x*tan(uAng)+sin(p.x*14.0-uT*3.0)*0.006*(0.3+uWob)+sin(p.x*31.0+uT*5.0)*0.004*uWob;
    float below=smoothstep(0.003,-0.003,p.y-surf); vec2 off=vec2(sin(p.y*30.0+uT*1.5),cos(p.x*24.0-uT*1.2))*0.004*below;
    vec3 base=texture2D(uTex,vUv+off).rgb; vec3 wet=base*vec3(0.55,0.95,0.9)+vec3(0.0,0.02,0.03);
    vec2 gq=vUv*A*70.0+vec2(sin(uT*0.3)*2.0,uT*0.4); vec2 gid=floor(gq); float gh=h1(gid); float gl=step(0.982,gh)*pow(0.5+0.5*sin(uT*2.0+gh*50.0+uTilt.x*25.0+uTilt.y*18.0),10.0)*smoothstep(0.4,0.0,length(fract(gq)-0.5));
    wet+=vec3(1.0,0.8,0.4)*gl*2.0;
    vec2 bq=vec2(vUv.x*uAsp*14.0,vUv.y*6.0-uT*0.35); vec2 bid=floor(bq); vec2 bf=fract(bq)-0.5; float br=0.06+0.08*h1(bid+5.0); float bl=length(bf*vec2(1.0,2.3));
    float bub=(smoothstep(br,br*0.75,bl)-smoothstep(br*0.75,br*0.4,bl)*0.8)*step(0.55,h1(bid)); wet+=vec3(0.8,0.95,1.0)*bub*0.7;
    float men=exp(-pow((p.y-surf)/0.006,2.0)); vec3 c=mix(base,wet,below)+vec3(0.9,1.0,1.0)*men*0.6; gl_FragColor=vec4(c,1.0);`,
});
Object.assign(FR, {
  aperture: `uniform sampler2D uA; uniform sampler2D uB; uniform float uF;
    void main(){ vec3 a=texture2D(uA,vUv).rgb, b=texture2D(uB,vUv).rgb; vec3 c=mix(a,b,uF); gl_FragColor=vec4(c,1.0);`,
  vertigo: `void main(){ float s=1.0+0.26*sin(uT*0.55)*min(uK,2.0); vec2 c=vec2(0.55,0.42);
    vec2 uv=vUv; for(int i=0;i<3;i++){ float d=Dp(uv); uv=c+(vUv-c)*mix(1.0,1.0/s,pow(1.0-d,1.3)); }
    vec3 col=texture2D(uTex,clamp(uv,0.0,1.0)).rgb; gl_FragColor=vec4(col,1.0);`,
  nightvis: `void main(){ vec3 p=texture2D(uTex,vUv).rgb; float l=luma(p); float d=Dp(vUv); vec2 A=vec2(uAsp,1.0);
    vec2 tp=mix(vec2(0.5+0.3*sin(uT*0.4),0.45+0.15*sin(uT*0.63)),uPtr,uHov); float spot=exp(-dot((vUv-tp)*A,(vUv-tp)*A)*9.0);
    float dist=0.35+(1.0-d)*2.6; float lit=l*(0.05+spot*2.4/(dist*dist))*(0.6+0.6*uK);
    float n=h1(vUv*A*900.0+floor(uT*30.0)); lit=lit*(0.75+0.5*n)+n*0.06; float sc=0.85+0.15*sin(vUv.y*700.0);
    vec3 c=vec3(0.25,1.0,0.35)*pow(clamp(lit,0.0,1.4),0.8)*sc;
    vec2 q=(vUv-0.5)*A; float eyes=max(smoothstep(0.36,0.33,length(q-vec2(-0.2,0.0))),smoothstep(0.36,0.33,length(q-vec2(0.2,0.0))));
    c*=eyes; gl_FragColor=vec4(c,1.0);`,
  flash: `uniform float uT0; uniform sampler2D uStamp;
    void main(){ vec3 p=texture2D(uTex,vUv).rgb; float d=Dp(vUv); float ft=uT-uT0; float on=step(0.0,ft)*(1.0-smoothstep(3.5,5.0,ft));
    float pop=exp(-ft*14.0)*step(0.0,ft);
    float dist=0.3+(1.0-d)*2.4; float fl=1.25/(dist*dist); float sh=1.0; for(int i=1;i<10;i++){ vec2 o=vec2(-0.004,0.007)*float(i); if(Dp(vUv+o)>d+0.06+float(i)*0.002) sh=0.18; }
    vec3 night=p*vec3(0.05,0.07,0.12); vec3 lit=p*min(fl,3.0)*sh*vec3(1.05,1.0,0.95); lit=lit/(1.0+lit*0.35);
    vec3 c=mix(night,lit,on)+vec3(pop); vec4 st=texture2D(uStamp,vUv); c=mix(c,st.rgb*1.6,st.a*on); gl_FragColor=vec4(c,1.0);`,
  mist: `void main(){ vec3 p=texture2D(uTex,vUv).rgb; float d=Dp(vUv); vec2 A=vec2(uAsp,1.0);
    float fog=1.0-exp(-(1.0-d)*2.2*uK); float acc=0.0;
    for(int i=0;i<4;i++){ float fi=float(i); float ld=0.2+fi*0.18; float n=fbm(vec2(vUv.x*2.5+uT*0.025*(1.0+fi*0.6)+fi*3.1,vUv.y*7.0+fi)); acc+=step(d,ld)*smoothstep(0.35,0.75,n)*0.28; }
    fog=clamp(fog*0.75+acc*uK,0.0,0.95); vec2 sp=vec2(0.18,0.95); vec3 mistC=mix(vec3(0.74,0.77,0.8),vec3(1.0,0.9,0.72),exp(-length((vUv-sp)*A)*2.5));
    vec2 dl=(sp-vUv)/24.0; vec2 q=vUv; float rays=0.0; float dec=1.0; for(int i=0;i<24;i++){ q+=dl; rays+=(1.0-Dp(q))*smoothstep(0.4,0.8,luma(texture2D(uTex,q).rgb))*dec; dec*=0.94; }
    vec3 c=mix(p*0.9,mistC,fog)+vec3(1.0,0.92,0.75)*rays*0.03; gl_FragColor=vec4(c,1.0);`,
  under: `void main(){ vec2 A=vec2(uAsp,1.0); vec2 w=vec2(sin(vUv.y*20.0+uT*1.2),cos(vUv.x*16.0+uT))*0.003; vec3 p=texture2D(uTex,vUv+w).rgb; float d=Dp(vUv+w); vec3 n=nrm(vUv,0.3);
    float dist=(1.0-d)*2.4*uK+0.3; vec3 ab=exp(-dist*vec3(1.4,0.45,0.25)); vec3 water=vec3(0.02,0.22,0.3);
    vec2 cq=vUv*A*7.0; float cs=0.0; for(int i=0;i<3;i++){ float fi=float(i); cq+=vec2(sin(cq.y*1.3+uT*0.8+fi),cos(cq.x*1.1-uT*0.7+fi*2.0))*0.45; cs+=sin(cq.x*2.0+uT)*sin(cq.y*2.0-uT*0.8); }
    float caus=pow(clamp(0.5+0.5*cs/3.0,0.0,1.0),6.0)*2.5*max(n.y+0.3,0.0)*exp(-dist*0.6);
    vec3 c=p*ab*(0.7+caus)+water*(1.0-ab.g);
    float ray=pow(max(0.0,sin((vUv.x+vUv.y*0.35)*22.0+sin(uT*0.3)*2.0)),12.0)*smoothstep(0.2,1.0,vUv.y)*0.12; c+=vec3(0.5,0.85,0.9)*ray;
    vec2 bq=vec2(vUv.x*uAsp*16.0,vUv.y*5.0-uT*0.5); vec2 bid=floor(bq); vec2 bf=fract(bq)-0.5; float br=0.05+0.07*h1(bid); float bl=length(bf*vec2(1.0,3.0)); c+=vec3(0.7,0.95,1.0)*(smoothstep(br,br*0.6,bl)-smoothstep(br*0.6,br*0.2,bl)*0.7)*step(0.7,h1(bid+2.0))*0.7;
    gl_FragColor=vec4(c,1.0);`,
  lava: `void main(){ vec2 A=vec2(uAsp,1.0); float d=Dp(vUv); vec3 n=nrm(vUv,0.35); float rel=texture2D(uMap,vUv).g;
    float floor_=smoothstep(0.12,0.3,n.y*1.6+0.2-rel*1.5+(fbm(vUv*A*5.0)-0.5)*0.4)*smoothstep(0.25,0.5,vUv.y<0.0?0.0:1.0-vUv.y+d*0.3)*min(uK,1.5)/1.0;
    floor_=clamp(floor_,0.0,1.0); vec2 hz=vec2(sin(vUv.y*60.0+uT*6.0),0.0)*0.002*floor_; vec3 p=texture2D(uTex,vUv+hz).rgb;
    vec2 fq=vUv*A*vec2(4.0,9.0)+vec2(uT*0.05,-uT*0.02); float f=fbm(fq+fbm(fq*1.7+uT*0.1)*1.5);
    vec3 lava=mix(vec3(0.05,0.01,0.0),mix(vec3(1.0,0.25,0.02),vec3(1.0,0.85,0.3),smoothstep(0.55,0.8,f)),smoothstep(0.35,0.6,f))*1.6;
    float glow=0.0; for(int i=1;i<7;i++){ vec2 o=vec2(0.0,-0.025*float(i)); vec2 q=vUv+o; vec3 nn=nrm(q,0.35); float lf=smoothstep(0.12,0.3,nn.y*1.6+0.2-texture2D(uMap,q).g*1.5); glow+=lf*(1.0-float(i)/7.0); }
    vec3 lit=p*(vec3(0.22,0.18,0.22)+vec3(1.0,0.4,0.1)*glow*0.45*uK); vec3 c=mix(lit,lava,floor_); gl_FragColor=vec4(c,1.0);`,
  aurora: `void main(){ vec2 A=vec2(uAsp,1.0); vec3 p=texture2D(uTex,vUv).rgb; float d=Dp(vUv); float sky=smoothstep(0.3,0.12,d)*smoothstep(0.25,0.6,vUv.y);
    float x=vUv.x*3.0; float band=0.62+0.12*sin(x*1.3+uT*0.12)+0.08*fbm(vec2(x*0.8,uT*0.05)); float dy=vUv.y-band;
    float curtain=smoothstep(-0.05,0.02,dy)*exp(-max(dy,0.0)*5.0)*pow(vnoise(vec2(x*18.0+fbm(vec2(x,uT*0.1))*6.0,uT*0.25)),2.0)*1.8;
    vec3 ac=mix(vec3(0.1,1.0,0.45),vec3(0.9,0.2,0.7),smoothstep(0.03,0.25,dy))*curtain*min(uK,2.0);
    vec3 stars=vec3(step(0.997,h1(floor(vUv*A*400.0))))*(0.5+0.5*sin(uT*2.0+h1(floor(vUv*A*300.0))*30.0));
    vec3 night=vec3(0.005,0.01,0.03)+ac+stars*0.8;
    vec3 ground=p*0.07+p*vec3(0.05,0.35,0.18)*(0.3+0.4*min(uK,2.0))*(0.5+0.5*nrm(vUv,0.3).y);
    gl_FragColor=vec4(mix(ground,night,sky),1.0);`,
  sketch: `void main(){ vec2 A=vec2(uAsp,1.0); float ph=mod(uT,14.0)/10.0; vec2 j=vec2(fbm(vUv*30.0),fbm(vUv*30.0+7.0))*0.002; vec3 p=texture2D(uTex,vUv+j).rgb; float l=luma(p); float d=Dp(vUv);
    float e=texture2D(uMap,vUv+j).b; vec2 g=vec2(luma(texture2D(uTex,vUv+vec2(0.0015,0.0)).rgb)-luma(texture2D(uTex,vUv-vec2(0.0015,0.0)).rgb),luma(texture2D(uTex,vUv+vec2(0.0,0.0022)).rgb)-luma(texture2D(uTex,vUv-vec2(0.0,0.0022)).rgb));
    float line=max(smoothstep(0.35,0.6,e),smoothstep(0.06,0.14,length(g)));
    vec2 q=vUv*A*180.0; float h1_=smoothstep(0.55,0.0,abs(fract((q.x+q.y)*0.5)-0.5)*2.0-0.3)*smoothstep(0.62,0.3,l);
    float h2_=smoothstep(0.55,0.0,abs(fract((q.x-q.y)*0.5)-0.5)*2.0-0.3)*smoothstep(0.38,0.12,l); float h3_=smoothstep(0.55,0.0,abs(fract(q.x*0.7)-0.5)*2.0-0.3)*smoothstep(0.2,0.05,l);
    float rv=(1.0-d)*0.55+fbm(vUv*5.0)*0.45; float showL=smoothstep(rv-0.02,rv+0.02,ph*1.2); float showH=smoothstep(rv+0.15,rv+0.2,ph*1.2);
    float ink=clamp(line*showL+(h1_+h2_+h3_)*0.55*showH,0.0,1.0);
    vec3 paper=vec3(0.95,0.92,0.85)*(0.95+0.05*vnoise(vUv*A*400.0)); vec3 c=mix(paper,vec3(0.16,0.15,0.18),ink*0.9); gl_FragColor=vec4(c,1.0);`,
  loupe: `uniform sampler2D uMicro;
    void main(){ vec2 A=vec2(uAsp,1.0); vec2 lp=mix(vec2(0.5+0.25*sin(uT*0.3),0.5+0.2*sin(uT*0.47)),uPtr,uHov); vec2 q=(vUv-lp)*A; float r=length(q); float R=0.16;
    vec3 c=texture2D(uTex,vUv).rgb; c=mix(c,c*0.97+texture2D(uMicro,vUv*vec2(1.0,1.0)).rgb*0.0,0.0);
    if(r<R){ float mag=3.2+uK; float k=r/R; vec2 qq=q*(1.0+0.35*k*k)/mag; vec2 uvR=lp+qq*(1.0+0.012*k)/A, uvG=lp+qq/A, uvB=lp+qq*(1.0-0.012*k)/A;
      vec3 m=vec3(texture2D(uTex,uvR).r,texture2D(uTex,uvG).g,texture2D(uTex,uvB).b); float mic=texture2D(uMicro,uvG).r; float gr=h1(floor(uvG*A*2600.0));
      m=m*(0.92+0.16*gr)-mic*0.35*(0.4+luma(m)); c=m*(1.0-0.25*k*k)+vec3(1.0)*pow(max(0.0,1.0-length(q/R-vec2(-0.45,0.5))*1.6),6.0)*0.25; }
    float rim=smoothstep(R,R+0.004,r)*(1.0-smoothstep(R+0.022,R+0.026,r)); c=mix(c,vec3(0.07,0.07,0.075)+vec3(0.6)*pow(max(0.0,dot(normalize(q+1e-4),vec2(-0.6,0.8))),8.0),rim);
    c*=1.0-0.35*smoothstep(R+0.026,R+0.08,r)*(1.0-smoothstep(R+0.08,R+0.14,r))*step(R,r); gl_FragColor=vec4(c,1.0);`,
  uv: `uniform sampler2D uInk;
    void main(){ vec2 A=vec2(uAsp,1.0); vec2 tp=mix(vec2(0.5+0.32*sin(uT*0.35),0.5+0.22*sin(uT*0.52)),uPtr,uHov); float cone=smoothstep(0.24,0.12,length((vUv-tp)*A));
    vec3 p=texture2D(uTex,vUv).rgb; float l=luma(p); float d=Dp(vUv); vec4 ink=texture2D(uInk,vUv);
    float cont=smoothstep(fwidth(d*30.0)*1.2,0.0,abs(fract(d*30.0)-0.5)-0.45);
    vec3 uvl=vec3(0.18,0.05,0.35)*(0.25+l*0.5)+vec3(0.55,0.65,1.0)*smoothstep(0.6,0.9,l)*0.5;
    uvl+=vec3(0.3,1.0,0.6)*ink.g*1.4+vec3(1.0,0.3,0.9)*ink.r*1.2+vec3(0.4,0.8,1.0)*cont*0.25*uK;
    vec3 c=mix(p,uvl,cone); gl_FragColor=vec4(c,1.0);`,
  tiltshift: `void main(){ vec2 A=vec2(uAsp,1.0); float band=mix(0.42,uPtr.y,uHov); float coc=clamp(abs(vUv.y-band)*3.0-0.15,0.0,1.0)*min(uK,2.0);
    vec3 acc=vec3(0.0); float ws=0.0; for(int i=0;i<32;i++){ float fi=float(i); float r=sqrt((fi+0.5)/32.0); float an=fi*2.39996; vec2 o=vec2(cos(an),sin(an))*r*0.018*coc/A; vec3 s=texture2D(uTex,vUv+o,coc*2.0).rgb; float w=1.0+pow(luma(s),4.0)*6.0*coc; acc+=s*w; ws+=w; }
    vec3 c=acc/ws; c=mix(vec3(luma(c)),c,1.45); c=(c-0.5)*1.12+0.5+0.03; gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);`,
  double: `uniform sampler2D uTex2;
    void main(){ float rel=texture2D(uMap,vUv).g; float m=smoothstep(0.16,0.32,rel); vec3 a=texture2D(uTex,vUv).rgb; vec2 u2=vec2(vUv.x*0.85+0.08,vUv.y*0.9+0.05+0.02*sin(uT*0.2)); vec3 b=texture2D(uTex2,u2).rgb;
    float la=luma(a); vec3 inside=1.0-(1.0-vec3(la)*vec3(1.0,0.97,0.92))*(1.0-b*1.1); inside=mix(inside,b,0.35)*mix(1.0,1.15,uK*0.2);
    vec3 paper=vec3(0.95,0.93,0.9); float edge=smoothstep(0.0,0.5,m)*(1.0-smoothstep(0.5,1.0,m)); vec3 c=mix(paper,inside,m); c=mix(c,c*0.8+b*0.2,edge*0.6);
    c=mix(c,paper*0.9+vec3(la)*0.08,(1.0-m)*0.0); gl_FragColor=vec4(c,1.0);`,
  gameboy: `void main(){ vec2 res=vec2(160.0,160.0/uAsp); vec2 id=floor(vUv*res); vec2 f=fract(vUv*res); vec3 p=texture2D(uTex,(id+0.5)/res,1.0).rgb; float l=pow(luma(p),0.85)*1.25;
    int bx=int(mod(id.x,4.0)), by=int(mod(id.y,4.0)); float bay[16]; bay[0]=0.0;bay[1]=8.0;bay[2]=2.0;bay[3]=10.0;bay[4]=12.0;bay[5]=4.0;bay[6]=14.0;bay[7]=6.0;bay[8]=3.0;bay[9]=11.0;bay[10]=1.0;bay[11]=9.0;bay[12]=15.0;bay[13]=7.0;bay[14]=13.0;bay[15]=5.0;
    float th=0.0; for(int k=0;k<16;k++){ if(k==by*4+bx) th=bay[k]; } float q=floor(clamp(l*3.0+(th/16.0-0.5)*0.9,0.0,3.0)+0.5);
    vec3 c=q<0.5?vec3(0.06,0.13,0.04):q<1.5?vec3(0.19,0.32,0.07):q<2.5?vec3(0.45,0.58,0.08):vec3(0.66,0.76,0.1);
    float grid=smoothstep(0.0,0.12,f.x)*smoothstep(0.0,0.12,f.y); c=mix(c*0.82,c,grid); gl_FragColor=vec4(c,1.0);`,
  vhs: `uniform sampler2D uOsd;
    void main(){ vec2 uv=vUv; float t=uT; float band=fract(t*0.07); float tb=smoothstep(0.04,0.0,abs(uv.y-band)); uv.x+=tb*(h1(vec2(floor(uv.y*200.0),floor(t*20.0)))-0.5)*0.03*uK;
    uv.x+=sin(uv.y*3.0+t*1.3)*0.0015; float bot=smoothstep(0.05,0.0,uv.y); uv.x+=bot*0.02*sin(uv.y*400.0+t*40.0);
    float y=luma(texture2D(uTex,uv).rgb); vec3 ch=vec3(0.0); for(int i=0;i<6;i++){ ch+=texture2D(uTex,uv+vec2(float(i)*0.0025+0.004,0.0),1.5).rgb; } ch/=6.0; vec3 c=vec3(y)+(ch-vec3(luma(ch)))*1.3;
    c=mix(c,vec3(0.9),tb*h1(uv*vec2(400.0,100.0)+t)*0.6); c+=(h1(uv*vec2(500.0,300.0)+floor(t*30.0))-0.5)*0.07; c*=0.9+0.1*sin(uv.y*620.0);
    vec4 o=texture2D(uOsd,vUv); c=mix(c,o.rgb,o.a); gl_FragColor=vec4(c,1.0);`,
});
Object.assign(FR, {
  seasons: `void main(){ vec2 A=vec2(uAsp,1.0); vec3 p=texture2D(uTex,vUv).rgb; float l=luma(p); float green=clamp((p.g-max(p.r,p.b))*5.0+0.15,0.0,1.0); vec3 n=nrm(vUv,0.35);
    float s=fract(uK/2.5+uT*0.02)*4.0;
    vec2 bq=vUv*A*140.0; float bl=step(0.9,h1(floor(bq)))*smoothstep(0.45,0.2,length(fract(bq)-0.5))*green;
    vec3 spr=mix(p,p*vec3(1.08,1.18,0.82)+0.03,green); spr=mix(spr,vec3(1.0,0.78,0.86),bl);
    vec3 sum=mix(p,p*vec3(0.8,1.18,0.62),green)*vec3(1.06,1.03,0.93);
    float fb=fbm(vUv*A*6.0); vec3 aut=mix(p,vec3(l*1.5)*mix(vec3(1.0,0.55,0.12),vec3(0.95,0.2,0.08),fb),green); aut=mix(aut,aut*vec3(1.05,0.95,0.8),0.5);
    float cov=smoothstep(0.0,0.18,n.y*1.6+0.25*l+0.45*fbm(vUv*A*40.0)-0.9); vec3 win=mix(p,vec3(l)*vec3(0.75,0.7,0.66),green*0.85)*vec3(0.82,0.9,1.06); win=mix(win,vec3(0.88,0.92,0.98)*(0.8+0.25*n.y),cov);
    float w0=max(0.0,1.0-abs(s-0.0)), w1=max(0.0,1.0-abs(s-1.0)), w2=max(0.0,1.0-abs(s-2.0)), w3=max(0.0,1.0-abs(s-3.0)), w4=max(0.0,1.0-abs(s-4.0));
    vec3 c=spr*(w0+w4)+sum*w1+aut*w2+win*w3; gl_FragColor=vec4(c,1.0);`,
  puddles: `void main(){ vec2 A=vec2(uAsp,1.0); float d=Dp(vUv); vec3 n=nrm(vUv,0.35); float rel=texture2D(uMap,vUv).g;
    float fl=smoothstep(0.08,0.25,n.y*1.6-rel*1.5+0.2); float pud=fl*smoothstep(0.5,0.58,fbm(vUv*A*vec2(3.0,8.0)+2.0))*min(uK,1.6);
    vec2 rp=vec2(0.0); for(int i=0;i<3;i++){ float fi=float(i); vec2 cq=vUv*A*vec2(10.0,22.0)+fi*7.3; vec2 id=floor(cq); vec2 f=fract(cq)-0.5; float ph=fract(uT*0.5+h1(id+fi)); float r=length(f*vec2(1.0,2.2)); float ring=sin((r-ph*0.5)*60.0)*exp(-ph*3.0)*smoothstep(0.5*ph+0.05,0.5*ph,r); rp+=normalize(f+1e-4)*ring*0.004; }
    vec3 p=texture2D(uTex,vUv).rgb; vec3 wet=p*vec3(0.62,0.66,0.72)*1.05; wet=mix(vec3(luma(wet)),wet,1.25);
    vec2 ru=vec2(vUv.x,vUv.y+0.12*(1.0-d)+0.04)+rp; vec3 refl=texture2D(uTex,clamp(ru,0.0,1.0),1.0).rgb*vec3(0.75,0.82,0.92);
    vec3 c=mix(p,wet,fl*0.75); c=mix(c,refl+vec3(0.03,0.04,0.06),pud); c+=vec3(0.6,0.7,0.8)*pow(max(0.0,1.0-abs(vUv.x-0.3-uTilt.x)*2.5),8.0)*pud*0.4;
    float rain=step(0.985,h1(vec2(floor((vUv.x+vUv.y*0.15)*220.0),floor(vUv.y*14.0+uT*22.0))))*0.18; c+=rain; gl_FragColor=vec4(c,1.0);`,
  compose: `void main(){ vec2 A=vec2(uAsp,1.0); vec3 p=texture2D(uTex,vUv).rgb; float rel=texture2D(uMap,vUv).g; float e=texture2D(uMap,vUv).b;
    float lc=abs(luma(p)-luma(texture2D(uTex,vUv,4.0).rgb)); float sal=clamp(smoothstep(0.1,0.45,texture2D(uMap,vUv,3.0).g)*0.8+lc*3.0,0.0,1.0);
    vec3 heat=mix(vec3(0.1,0.2,1.0),mix(vec3(1.0,0.9,0.1),vec3(1.0,0.15,0.05),smoothstep(0.55,0.9,sal)),smoothstep(0.2,0.6,sal));
    float cyc=mod(uT,12.0); float showH=smoothstep(0.0,1.0,cyc)*(1.0-smoothstep(5.0,6.0,cyc)); float showP=smoothstep(6.0,7.0,cyc)*(1.0-smoothstep(11.0,12.0,cyc));
    vec3 c=mix(p,p*0.5+heat*0.6,showH*sal*0.85+showH*0.1);
    float px=fwidth(vUv.x)*1.4, py=fwidth(vUv.y)*1.4; float third=max(max(smoothstep(px,0.0,abs(vUv.x-1.0/3.0)),smoothstep(px,0.0,abs(vUv.x-2.0/3.0))),max(smoothstep(py,0.0,abs(vUv.y-1.0/3.0)),smoothstep(py,0.0,abs(vUv.y-2.0/3.0))));
    float phi=max(max(smoothstep(px,0.0,abs(vUv.x-0.382)),smoothstep(px,0.0,abs(vUv.x-0.618))),max(smoothstep(py,0.0,abs(vUv.y-0.382)),smoothstep(py,0.0,abs(vUv.y-0.618))))*step(0.5,fract(vUv.x*60.0+vUv.y*60.0));
    c=mix(c,vec3(1.0),third*0.8*(1.0-showP)); c=mix(c,vec3(1.0,0.8,0.4),phi*showP);
    float ll=smoothstep(0.45,0.7,e)*showP; c=mix(c,vec3(0.3,0.9,1.0),ll*0.7); gl_FragColor=vec4(c,1.0);`,
  rift: `void main(){ vec2 A=vec2(uAsp,1.0); vec2 cc=mix(vec2(0.5+0.25*sin(uT*0.27),0.5+0.18*sin(uT*0.41)),uPtr,uHov); vec2 q=(vUv-cc)*A; float an=atan(q.y,q.x);
    float R=(0.1+0.06*sin(uT*0.9))*(0.7+0.3*uK); float dist=length(q)+(fbm(vec2(an*3.0,uT*0.4))-0.5)*0.07+(vnoise(vec2(an*14.0,uT))-0.5)*0.02; float e=R-dist;
    vec3 p=texture2D(uTex,vUv).rgb; float d=Dp(vUv); vec2 iu=cc+(vUv-cc)*(0.75+0.25*d);
    vec3 o=texture2D(uTex,iu).rgb; vec3 other=vec3(1.0)-o.gbr; other=mix(other,vec3(0.15,0.0,0.3),0.35)+vec3(0.3,0.9,0.7)*pow(fbm(iu*A*3.0+uT*0.1),3.0)*1.5;
    float inside=smoothstep(0.0,0.006,e); vec3 c=mix(p,other,inside);
    float rim=exp(-abs(e)*90.0); vec3 fire=mix(vec3(1.0,0.2,0.9),vec3(0.3,1.0,1.0),0.5+0.5*sin(an*5.0+uT*3.0)); c+=fire*rim*1.6;
    c*=1.0-0.35*smoothstep(0.12,0.0,-e)*(1.0-inside); float sp=step(0.996,h1(floor(q*400.0)+floor(uT*12.0)))*exp(-abs(e)*25.0); c+=vec3(1.0,0.8,1.0)*sp*2.0; gl_FragColor=vec4(c,1.0);`,
  aero: `void main(){ vec3 p=texture2D(uTex,vUv).rgb; float green=clamp((p.g-max(p.r,p.b))*4.0,0.0,1.0); float ir=clamp(p.g*1.25+green*0.9,0.0,1.0);
    vec3 c=vec3(ir*1.05,p.r*0.9,p.g*0.8+p.b*0.2); float l=luma(c); c=mix(vec3(l),c,1.35+0.2*uK); c=(c-0.5)*1.1+0.52; gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);`,
  storm: `void main(){ vec2 A=vec2(uAsp,1.0); vec3 p=texture2D(uTex,vUv).rgb; float d=Dp(vUv); vec3 n=nrm(vUv,0.35);
    float ph=fract(uT*0.13); float f=step(ph,0.07)*(0.55+0.45*sin(ph*520.0))+step(0.12,ph)*step(ph,0.135)*0.5; f*=min(uK,2.0); float bx=0.25+0.5*h1(vec2(floor(uT*0.13),2.0));
    vec3 L=normalize(vec3(bx-0.5,1.0,0.35)); float h0=d*0.25; float sh=1.0; for(int i=1;i<=24;i++){ float s=float(i)*0.008; vec2 q=vUv+normalize(L.xy)*vec2(1.0/uAsp,1.0)*s; if(q.y>1.0) break; if(Dp(q)*0.25>h0+s*L.z/length(L.xy)+0.003) sh=0.25; }
    vec3 night=p*vec3(0.06,0.07,0.11); vec3 lit=p*(0.35+1.6*max(dot(n,L),0.0)*sh)*vec3(0.9,0.95,1.1); vec3 c=mix(night,lit,clamp(f,0.0,1.0));
    float sky=smoothstep(0.3,0.12,d)*smoothstep(0.4,0.7,vUv.y); float bxp=bx+(fbm(vec2(vUv.y*6.0,floor(uT*0.13)))-0.5)*0.16+(vnoise(vec2(vUv.y*40.0,floor(uT*0.13)))-0.5)*0.03;
    float bolt=exp(-abs(vUv.x-bxp)*A.x*350.0)*step(0.45,vUv.y)*sky; c+=vec3(0.8,0.85,1.0)*bolt*f*3.0+vec3(0.4,0.45,0.6)*sky*f*0.5;
    float rain=step(0.97,h1(vec2(floor((vUv.x+vUv.y*0.25)*260.0),floor(vUv.y*9.0+uT*26.0+h1(vec2(floor((vUv.x+vUv.y*0.25)*260.0),1.0))*9.0)))); c+=vec3(0.5,0.55,0.65)*rain*(0.12+f*0.4);
    gl_FragColor=vec4(c,1.0);`,
  fireworks: `void main(){ vec2 A=vec2(uAsp,1.0); vec3 p=texture2D(uTex,vUv).rgb; float d=Dp(vUv); vec3 n=nrm(vUv,0.3); vec3 c=p*vec3(0.05,0.055,0.09); vec3 light=vec3(0.0);
    for(int b=0;b<3;b++){ float fb=float(b); float per=3.2+fb*0.9; float tb=mod(uT+fb*1.3,per); float id=floor((uT+fb*1.3)/per)+fb*17.0; vec2 bc=vec2(0.2+0.6*h1(vec2(id,1.0)),0.62+0.25*h1(vec2(id,2.0))); vec3 col=hue(h1(vec2(id,3.0)));
      float fade=exp(-tb*1.4)*step(0.0,tb); for(int j=0;j<36;j++){ float fj=float(j); float an=fj/36.0*6.2832+h1(vec2(id,fj))*0.2; vec2 sp=bc+vec2(cos(an),sin(an))*tb*0.13*(0.8+0.4*h1(vec2(fj,id)))/A-vec2(0.0,tb*tb*0.02); float dd=length((vUv-sp)*A); c+=col*exp(-dd*dd*30000.0)*fade*2.5; c+=col*exp(-dd*dd*2500.0)*fade*0.15; }
      float dl=length((vUv-bc)*A); light+=col*fade*2.2/(1.0+dl*dl*14.0); }
    c+=p*light*(0.4+0.6*max(n.y*0.5+n.z*0.6,0.0))*min(uK,2.0); gl_FragColor=vec4(c,1.0);`,
  mosaic: `uniform sampler2D uAtlas; uniform vec3 uTile[16];
    void main(){ float cols=uK*30.0+30.0; vec2 cell=vec2(cols,cols/uAsp); vec2 id=floor(vUv*cell); vec2 f=fract(vUv*cell); vec3 avg=texture2D(uTex,(id+0.5)/cell,3.0).rgb;
    int best=0; float bd=9.0; for(int k=0;k<16;k++){ vec3 dd=uTile[k]-avg; float v=dot(dd,dd); if(v<bd){ bd=v; best=k; } } float bk=float(best);
    vec3 t=texture2D(uAtlas,vec2((mod(bk,4.0)+f.x)/4.0,(floor(bk/4.0)+f.y)/4.0)).rgb; vec3 c=mix(t,avg,0.45)+(avg-t)*0.15; c*=0.9+0.1*smoothstep(0.0,0.05,min(min(f.x,f.y),min(1.0-f.x,1.0-f.y))); gl_FragColor=vec4(c,1.0);`,
  wiggle: `void main(){ float fr=mod(floor(uT*6.0),4.0); float v=fr<0.5?-1.0:fr<1.5?0.0:fr<2.5?1.0:0.0; float d=Dp(vUv); vec2 uv=vUv-vec2((d-0.55)*0.014*uK*v,0.0)+vec2(0.0,v*0.0006);
    vec3 c=texture2D(uTex,uv).rgb; vec2 e=min(vUv,1.0-vUv); c=mix(vec3(0.95),c,smoothstep(0.012,0.016,min(e.x,e.y*uAsp/1.5))); gl_FragColor=vec4(c,1.0);`,
  lensball: `void main(){ vec2 A=vec2(uAsp,1.0); vec2 cc=mix(vec2(0.42+0.15*sin(uT*0.2),0.42),uPtr,uHov); vec2 q=(vUv-cc)*A; float R=0.17+0.04*uK; float k=length(q)/R;
    vec3 p=texture2D(uTex,vUv,1.2*(1.0-smoothstep(1.0,1.6,k))).rgb; vec2 sh=(vUv-cc-vec2(0.0,-R*1.02))*A*vec2(1.0,4.0); p*=1.0-0.55*exp(-dot(sh,sh)/(R*R*0.5))*step(1.0,k);
    vec3 c=p; if(k<1.0){ float s=0.55+0.8*(1.0-sqrt(1.0-k*k)); vec2 su=cc-(q/A)*s*1.8; vec3 ins=texture2D(uTex,clamp(su,0.0,1.0)).rgb; float fr=pow(k,4.0);
      c=ins*(1.0-fr*0.6)+vec3(1.0)*pow(max(0.0,1.0-length(q/R-vec2(-0.38,0.42))*3.0),5.0)*0.9+vec3(0.9,0.95,1.0)*fr*0.25; c+=vec3(1.0)*smoothstep(0.92,1.0,k)*0.25; }
    gl_FragColor=vec4(c,1.0);`,
  silhouette: `void main(){ vec2 A=vec2(uAsp,1.0); float rel=texture2D(uMap,vUv).g; float d=Dp(vUv); vec3 p=texture2D(uTex,vUv).rgb;
    float m=max(smoothstep(0.12,0.26,rel),smoothstep(0.86,0.94,d)); float mid=smoothstep(0.3,0.6,d);
    float sunY=0.62-0.5*fract(uT*0.025)*min(uK,2.0)*0.6; vec2 sp=vec2(0.62,sunY); float hz=0.38;
    vec3 sky=mix(vec3(1.0,0.55,0.18),vec3(0.95,0.25,0.3),smoothstep(hz,hz+0.25,vUv.y)); sky=mix(sky,vec3(0.18,0.08,0.3),smoothstep(hz+0.2,1.0,vUv.y)); float sd=length((vUv-sp)*A);
    sky+=vec3(1.0,0.85,0.5)*exp(-sd*sd*40.0)*1.4+vec3(1.0,0.95,0.8)*smoothstep(0.06,0.05,sd);
    vec3 c=mix(sky,sky*0.25+vec3(luma(p))*0.05,mid*0.85); c=mix(c,vec3(0.02,0.012,0.02),m);
    float rimL=smoothstep(0.12,0.26,texture2D(uMap,vUv+normalize(vUv-sp)*0.004).g); float rim=clamp(m-rimL,0.0,1.0); c+=vec3(1.0,0.6,0.25)*rim*1.6; gl_FragColor=vec4(c,1.0);`,
  lightpaint: `vec3 P3(float s){ float an=s*18.85+uT*0.0; return vec3(0.55+cos(an)*0.2*(1.0-s*0.3)/uAsp*1.6, 0.18+s*0.62, 0.72+sin(an)*0.16); }
    void main(){ vec2 A=vec2(uAsp,1.0); vec3 p=texture2D(uTex,vUv).rgb; float d=Dp(vUv); float head=clamp(fract(uT*0.09)*1.3,0.0,1.0); float fade=1.0-smoothstep(1.15,1.3,fract(uT*0.09)*1.3);
    vec3 c=p*vec3(0.05,0.06,0.1); vec3 glow=vec3(0.0); float lit=0.0;
    for(int i=0;i<90;i++){ float s=float(i)/89.0; if(s>head) break; vec3 L=P3(s); float occ=step(Dp(L.xy)-0.02,L.z); float dd=length((vUv-L.xy)*A); vec3 col=hue(fract(s*1.5+0.05));
      float vis=step(d,L.z+0.03)+(1.0-step(d,L.z+0.03))*0.0; glow+=col*exp(-dd*dd*12000.0)*1.4*vis+col*exp(-dd*dd*900.0)*0.06*vis; lit+=exp(-dd*dd*60.0)*0.02; }
    vec3 Hd=P3(head); float hd=length((vUv-Hd.xy)*A); glow+=vec3(1.0,0.95,0.8)*exp(-hd*hd*3000.0)*2.0*step(d,Hd.z+0.03)*step(head,0.999);
    c+=p*lit*vec3(1.0,0.8,0.6)*min(uK,2.0); c+=glow*fade; gl_FragColor=vec4(c,1.0);`,
  startrails: `void main(){ vec2 A=vec2(uAsp,1.0); vec3 p=texture2D(uTex,vUv).rgb; float d=Dp(vUv); float sky=smoothstep(0.3,0.12,d)*smoothstep(0.3,0.65,vUv.y);
    vec2 pole=vec2(0.55,1.35); vec2 q=(vUv-pole)*A; float r=length(q); float an=atan(q.x,-q.y); float ri=floor(r*260.0); float fr=fract(r*260.0);
    float has=step(0.62,h1(vec2(ri,4.0))); float a0=h1(vec2(ri,9.0))*6.2832-3.1416; float len=(0.05+mod(uT,60.0)*0.012)*min(uK,2.5); float da=mod(an-a0+3.1416,6.2832)-3.1416;
    float arc=step(0.0,da)*step(da,len)*smoothstep(0.5,0.1,abs(fr-0.5))*has*(0.4+0.6*h1(vec2(ri,2.0)));
    vec3 sc=mix(vec3(0.7,0.8,1.0),vec3(1.0,0.85,0.6),h1(vec2(ri,5.0))); vec3 night=vec3(0.01,0.015,0.04)+sc*arc*1.2;
    vec3 ground=p*vec3(0.12,0.14,0.2); gl_FragColor=vec4(mix(ground,night,sky),1.0);`,
});

/* ---------- the game side ---------- */
/* a ShaderMaterial over a photo's maps, with the uniforms every shader finish reads */
export function shaderMat(P, frag, extra = {}) {
  const { vs, defines, ...more } = extra;
  const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ uTex: { value: P.tex }, uMap: { value: P.mapTex }, uT: { value: 0 }, uK: { value: 1 }, uPtr: { value: new THREE.Vector2(0.5, 0.5) }, uHov: { value: 0 }, uTilt: { value: new THREE.Vector2() }, uAsp: { value: P.aspect } }, more),
    vertexShader: vs || VS, fragmentShader: (vs === VSN ? 'varying vec3 vN; varying vec3 vV;\n' : '') + GLH + frag + OUT });
  if (defines) m.defines = defines; m.toneMapped = false; return m;
}
/* the photo's maps at a working size: everything a finish reads per pixel */
export const MAPW = 640;
/* crop: the part of the photo this canvas shows, 0..1 (a Full art slab shows a crop), so the depth lines up */
export function photoMaps(canvas, depth, tex, crop) {
  const cr = crop || { x0: 0, y0: 0, x1: 1, y1: 1 };
  const W = Math.min(MAPW, canvas.width), H = Math.max(2, Math.round(W * canvas.height / canvas.width)), N = W * H;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(canvas, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data, L = new Float32Array(N), C = new Float32Array(N * 3), D = new Float32Array(N);
  for (let i = 0; i < N; i++) { const r = px[i * 4] / 255, gg = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255; C[i * 3] = r; C[i * 3 + 1] = gg; C[i * 3 + 2] = b; L[i] = 0.299 * r + 0.587 * gg + 0.114 * b; }
  /* depth resampled (bilinear) to the working size */
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const fx = mix(cr.x0, cr.x1, x / (W - 1)) * (depth.w - 1), fy = mix(cr.y0, cr.y1, y / (H - 1)) * (depth.h - 1), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(depth.w - 1, x0 + 1), y1 = Math.min(depth.h - 1, y0 + 1), tx = fx - x0, ty = fy - y0, d = depth.D;
    D[y * W + x] = mix(mix(d[y0 * depth.w + x0], d[y0 * depth.w + x1], tx), mix(d[y1 * depth.w + x0], d[y1 * depth.w + x1], tx), ty); }
  /* the subject: depth above the ground at each row (the 35th percentile of the row, smoothed down the frame) */
  const base = new Float32Array(H); for (let y = 0; y < H; y++) { const row = Array.from(D.subarray(y * W, y * W + W)).sort((a, b) => a - b); base[y] = row[Math.floor(0.35 * (W - 1))]; }
  const sb = new Float32Array(H), k = Math.max(2, Math.round(H * 0.03)); for (let y = 0; y < H; y++) { let s = 0, n = 0; for (let j = -k; j <= k; j++) { const yy = clamp(y + j, 0, H - 1); s += base[yy]; n++; } sb[y] = s / n; }
  let R = new Float32Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) R[y * W + x] = Math.max(0, D[y * W + x] - sb[y]);
  const pr = (a, q) => { const s = Array.from(a).filter((_, i) => i % 5 === 0).sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))] || 1; };
  const rk = 1 / Math.max(1e-4, pr(R, 0.995)); for (let i = 0; i < N; i++) R[i] = clamp(R[i] * rk, 0, 1); R = blur(R, W, H, 1.2 * W / 640);
  const Db = blur(D, W, H, 0.8), E = new Float32Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, dx = Db[x < W - 1 ? i + 1 : i] - Db[x > 0 ? i - 1 : i], dy = Db[y < H - 1 ? i + W : i] - Db[y > 0 ? i - W : i]; E[i] = Math.hypot(dx, dy) / 2; }
  const ek = 1 / Math.max(1e-5, pr(E, 0.993)); for (let i = 0; i < N; i++) E[i] = clamp(E[i] * ek, 0, 1);
  const Lb = blur(L, W, H, 3), Q = new Float32Array(N); for (let i = 0; i < N; i++) Q[i] = L[i] - Lb[i];
  let lo = 1, hi = 0; for (let i = 0; i < N; i += 7) { lo = Math.min(lo, L[i]); hi = Math.max(hi, L[i]); } const Ls = new Float32Array(N); for (let i = 0; i < N; i++) Ls[i] = clamp((L[i] - lo) / Math.max(0.05, hi - lo), 0, 1);
  const mc = document.createElement('canvas'); mc.width = W; mc.height = H; const mg = mc.getContext('2d'), mi = mg.createImageData(W, H);
  for (let i = 0; i < N; i++) { mi.data[i * 4] = D[i] * 255; mi.data[i * 4 + 1] = R[i] * 255; mi.data[i * 4 + 2] = E[i] * 255; mi.data[i * 4 + 3] = 255; } mg.putImageData(mi, 0, 0);
  const mapTex = new THREE.CanvasTexture(mc); mapTex.colorSpace = THREE.NoColorSpace; mapTex.anisotropy = ANISO;
  return { W, H, aspect: W / H, L: Ls, D, R, E, Q, C, tex, mapTex, ai: !!depth.ai };
}
/* a dark studio of softboxes for the metals (Slab Lab's), and a brighter, busier one for mirrors */
const ENVS = new WeakMap();
export function studioEnvs(renderer) {
  if (ENVS.has(renderer)) return ENVS.get(renderer);
  const room = (bg, panels) => { const s = new THREE.Scene(); s.background = new THREE.Color(bg); panels.forEach(([w, h, col, k, pos]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m); });
    const p = new THREE.PMREMGenerator(renderer), t = p.fromScene(s, 0).texture; p.dispose(); s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); return t; };
  const e = { studio: room(0x060505, [[7, 3.2, 0xfff1e0, 5, [-3.5, 5, 4.5]], [1.1, 9, 0xffffff, 3.6, [6.5, 0, 1.5]], [1.1, 9, 0xd8e4ff, 1.6, [-6.5, 0, -1]], [12, 2.5, 0xffd2a0, 0.9, [0, -5.5, 3]], [1.6, 1.6, 0xffffff, 12, [2.5, 3, 7]], [14, 6, 0x1a1612, 1, [0, 1, -8]]]),
    bright: room(0x2a2622, [[9, 4, 0xffffff, 3, [0, 1, 9]], [3, 10, 0xfff0dc, 4, [-6, 0, 4]], [3, 10, 0xdce8ff, 3, [6, 0, 4]], [16, 3, 0x0a0a0c, 1, [0, -2.5, 8]], [16, 2, 0xffe2b8, 2, [0, 5, 3]]]) };
  ENVS.set(renderer, e); return e;
}
