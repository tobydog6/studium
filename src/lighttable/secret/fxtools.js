// FXTOOLS: a grader's tools for any inspected slab or print (Sam's Slab Lab picks), as a row of toggles above the
// inspect bar. Loupe: magnifies under the pointer, with colour fringing at the glass edge, film grain, and a line of
// microprinting hidden in the photo (the cert number). UV torch: under it the photo goes violet, its whites glow, and
// hidden ink lights up (a seal, the cert, a message, the depth drawn as contour lines). Composition: the rule of thirds
// with a heat map of where the eye goes, then the golden ratio lines and the leading lines from the depth.
// Each is a see-through layer over the finish, so the finish still shows round it.
import * as THREE from 'three';
import { GLH, OUT, photoMaps } from './fxkit.js';
import { depthFor } from './depth.js';
import { depthKey } from './fxfinishes.js';

const TOOL_FR = {
  loupe: `uniform sampler2D uMicro;
    void main(){ vec2 A=vec2(uAsp,1.0); vec2 lp=mix(vec2(0.5+0.25*sin(uT*0.3),0.5+0.2*sin(uT*0.47)),uPtr,uHov); vec2 q=(vUv-lp)*A; float r=length(q); float R=0.16; vec4 o=vec4(0.0);
    if(r<R){ float mag=4.2; float k=r/R; vec2 qq=q*(1.0+0.35*k*k)/mag; vec2 uvR=lp+qq*(1.0+0.012*k)/A, uvG=lp+qq/A, uvB=lp+qq*(1.0-0.012*k)/A;
      vec3 m=vec3(texture2D(uTex,uvR).r,texture2D(uTex,uvG).g,texture2D(uTex,uvB).b); float mic=texture2D(uMicro,uvG).r; float gr=h1(floor(uvG*A*2600.0));
      m=m*(0.92+0.16*gr)-mic*0.35*(0.4+luma(m)); o=vec4(m*(1.0-0.25*k*k)+vec3(1.0)*pow(max(0.0,1.0-length(q/R-vec2(-0.45,0.5))*1.6),6.0)*0.25,1.0); }
    float rim=smoothstep(R,R+0.004,r)*(1.0-smoothstep(R+0.022,R+0.026,r)); if(rim>0.0) o=vec4(vec3(0.07,0.07,0.075)+vec3(0.6)*pow(max(0.0,dot(normalize(q+1e-4),vec2(-0.6,0.8))),8.0),rim);
    if(r>R+0.026) o=vec4(0.0,0.0,0.0,0.35*smoothstep(R+0.026,R+0.05,r)*(1.0-smoothstep(R+0.05,R+0.12,r)));
    gl_FragColor=o;`,
  uv: `uniform sampler2D uInk;
    void main(){ vec2 A=vec2(uAsp,1.0); vec2 tp=mix(vec2(0.5+0.32*sin(uT*0.35),0.5+0.22*sin(uT*0.52)),uPtr,uHov); float cone=smoothstep(0.26,0.12,length((vUv-tp)*A));
    vec3 p=texture2D(uTex,vUv).rgb; float l=luma(p); float d=Dp(vUv); vec4 ink=texture2D(uInk,vUv);
    float cont=smoothstep(fwidth(d*30.0)*1.2,0.0,abs(fract(d*30.0)-0.5)-0.45);
    vec3 uvl=vec3(0.18,0.05,0.35)*(0.25+l*0.5)+vec3(0.55,0.65,1.0)*smoothstep(0.6,0.9,l)*0.5;
    uvl+=vec3(0.3,1.0,0.6)*ink.g*1.4+vec3(1.0,0.3,0.9)*ink.r*1.2+vec3(0.4,0.8,1.0)*cont*0.25;
    gl_FragColor=vec4(uvl,cone);`,
  compose: `void main(){ vec2 A=vec2(uAsp,1.0); vec3 p=texture2D(uTex,vUv).rgb; float e=texture2D(uMap,vUv).b;
    float lc=abs(luma(p)-luma(texture2D(uTex,vUv,4.0).rgb)); float sal=clamp(smoothstep(0.1,0.45,texture2D(uMap,vUv,3.0).g)*0.8+lc*3.0,0.0,1.0);
    vec3 heat=mix(vec3(0.1,0.2,1.0),mix(vec3(1.0,0.9,0.1),vec3(1.0,0.15,0.05),smoothstep(0.55,0.9,sal)),smoothstep(0.2,0.6,sal));
    float cyc=mod(uT,12.0); float showH=smoothstep(0.0,1.0,cyc)*(1.0-smoothstep(5.0,6.0,cyc)); float showP=smoothstep(6.0,7.0,cyc)*(1.0-smoothstep(11.0,12.0,cyc));
    vec4 o=vec4(heat,showH*(sal*0.55+0.05));
    float px=fwidth(vUv.x)*1.4, py=fwidth(vUv.y)*1.4; float third=max(max(smoothstep(px,0.0,abs(vUv.x-1.0/3.0)),smoothstep(px,0.0,abs(vUv.x-2.0/3.0))),max(smoothstep(py,0.0,abs(vUv.y-1.0/3.0)),smoothstep(py,0.0,abs(vUv.y-2.0/3.0))));
    float phi=max(max(smoothstep(px,0.0,abs(vUv.x-0.382)),smoothstep(px,0.0,abs(vUv.x-0.618))),max(smoothstep(py,0.0,abs(vUv.y-0.382)),smoothstep(py,0.0,abs(vUv.y-0.618))))*step(0.5,fract(vUv.x*60.0+vUv.y*60.0));
    o=mix(o,vec4(1.0,1.0,1.0,0.85),third*(1.0-showP)); o=mix(o,vec4(1.0,0.8,0.4,0.95),phi*showP); o=mix(o,vec4(0.3,0.9,1.0,0.8),smoothstep(0.45,0.7,e)*showP*0.85);
    gl_FragColor=o;`,
};
const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const certOf = slab => String(slab.cert || '').replace('#', '');
/* lines of tiny text, only ever readable through the loupe */
function microText(P, slab) { const W = 2048, H = Math.round(2048 / P.aspect), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = '600 9px "Geist Mono", monospace';
  const line = ('STUDIUM GRADED PHOTOGRAPH · CERT ' + certOf(slab) + ' · ' + (slab.graded ? 'GRADE ' + slab.grade : 'RAW PRINT') + ' · OTAUTAHI · ').repeat(14); for (let y = 12; y < H; y += 26) g.fillText(line, -((y * 7) % 300), y);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; }
/* hidden ink: red is pink ink, green is green ink */
function uvInk(P, slab) { const W = 1024, H = Math.round(1024 / P.aspect), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.strokeStyle = '#00ff00'; g.fillStyle = '#00ff00'; g.lineWidth = 5; const cx = W * 0.78, cy = H * 0.28, R = H * 0.16; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, R * 0.8, 0, 7); g.stroke();
  g.font = '400 ' + Math.round(R * 1.1) + 'px Fraunces, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S', cx, cy + R * 0.05);
  g.font = '600 ' + Math.round(R * 0.16) + 'px "Geist Mono", monospace'; const txt = 'AUTHENTIC · STUDIUM · GRADED · '; for (let i = 0; i < txt.length; i++) { const a = -Math.PI / 2 + i / txt.length * Math.PI * 2; g.save(); g.translate(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); g.rotate(a + Math.PI / 2); g.fillText(txt[i], 0, 0); g.restore(); }
  g.fillStyle = '#ff0000'; g.font = 'italic 400 ' + Math.round(H * 0.07) + 'px Fraunces, Georgia, serif'; g.textAlign = 'left'; g.fillText('You found it. Look closer.', W * 0.06, H * 0.88);
  g.font = '600 ' + Math.round(H * 0.035) + 'px "Geist Mono", monospace'; g.fillStyle = '#00ff00'; g.fillText('CERT ' + certOf(slab), W * 0.06, H * 0.1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; }

export function createTools(S) {
  const bar = S.el('div', 'sk-tools', ''); bar.id = 'skTools'; document.body.appendChild(bar);
  const TOOLS = [['loupe', 'Loupe'], ['uv', 'UV torch'], ['compose', 'Composition']];
  bar.innerHTML = TOOLS.map(([id, l]) => '<button type="button" data-tool="' + id + '" aria-pressed="false">' + l + '</button>').join('');
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  const X = { obj: null, tool: null, mesh: null, P: null, seq: 0, hov: 0, t: 0 };
  function clear() { if (X.mesh) { if (X.mesh.parent) X.mesh.parent.remove(X.mesh); const u = X.mesh.material.uniforms; ['uMicro', 'uInk'].forEach(k => { if (u[k]) u[k].value.dispose(); }); X.mesh.geometry.dispose(); X.mesh.material.dispose(); X.mesh = null; } }
  function sync() { bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === X.tool)); }
  async function set(id) {
    const obj = X.obj; if (!obj || !obj.parts.photo || !obj.parts.photoTex) return; const seq = ++X.seq; clear(); X.tool = X.tool === id ? null : id; sync(); if (!X.tool) return;
    if (!X.P || X.P.obj !== obj) { const img = obj.parts.photoTex.image; const d = await depthFor(depthKey(obj.slab), obj.base || img); if (seq !== X.seq || X.obj !== obj) return; if (X.P) X.P.mapTex.dispose(); X.P = photoMaps(img, d, obj.parts.photoTex); X.P.obj = obj; }
    const P = X.P, extra = X.tool === 'loupe' ? { uMicro: { value: microText(P, obj.slab) } } : X.tool === 'uv' ? { uInk: { value: uvInk(P, obj.slab) } } : {};
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ uTex: { value: P.tex }, uMap: { value: P.mapTex }, uT: { value: 0 }, uK: { value: 1 }, uPtr: { value: new THREE.Vector2(0.5, 0.5) }, uHov: { value: 0 }, uTilt: { value: new THREE.Vector2() }, uAsp: { value: P.aspect } }, extra),
      vertexShader: VS, fragmentShader: GLH + TOOL_FR[X.tool] + OUT, transparent: true, depthWrite: false }); m.toneMapped = false;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(obj.photoW, obj.photoH), m); mesh.position.copy(obj.parts.photo.position); mesh.position.z += obj.slab.graded ? 0.135 : 0.03; mesh.userData.order = 9; mesh.userData.noParticles = true;
    obj.inner.add(mesh); X.mesh = mesh; if (obj.top) obj.setTop(true);
  }
  bar.addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) { e.stopPropagation(); set(b.dataset.tool); } });
  return {
    open(obj) { X.obj = obj; X.tool = null; sync(); bar.classList.add('on'); },
    close() { X.seq++; clear(); X.tool = null; sync(); X.obj = null; if (X.P) { X.P.mapTex.dispose(); X.P = null; } bar.classList.remove('on'); },
    frame(dt) { if (!X.mesh || !X.obj) return; const u = X.mesh.material.uniforms, o = X.obj; X.t += dt; u.uT.value = X.t; if (o.pointerOn) u.uPtr.value.lerp(o.pointer, Math.min(1, dt * 12)); X.hov += ((o.pointerOn ? 1 : 0) - X.hov) * Math.min(1, dt * 4); u.uHov.value = X.hov; },
  };
}
export const TOOLS_CSS = `
#skTools{ position:fixed; left:50%; bottom:calc(122px + env(safe-area-inset-bottom,0px)); transform:translate(-50%,10px); display:flex; gap:6px; opacity:0; pointer-events:none; transition:opacity .25s, transform .35s cubic-bezier(.2,.8,.2,1); z-index:13; }
#skTools.on{ opacity:1; pointer-events:auto; transform:translate(-50%,0); }
#skTools button{ font:500 11px/1 var(--f-mono); letter-spacing:.12em; text-transform:uppercase; color:var(--text); background:rgba(20,18,16,.82); border:1px solid rgba(244,241,234,.28); border-radius:999px; padding:8px 13px; cursor:pointer; }
#skTools button[aria-pressed="true"]{ background:var(--accent, #e3ad57); color:#17140d; border-color:transparent; }
`;
