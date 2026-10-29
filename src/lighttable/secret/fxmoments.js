// FXMOMENTS: Bin it, from Sam's Slab Lab picks. A graded slab shatters (cracks run out from the middle, the shards fly
// up, spin and fall), a raw print blows away as sand (the far parts of the scene go first, the subject last). Both copy
// what they need from the object first, so the caller can take the object off the table straight away.
// shatter(obj, S) / sand(obj, S) → Promise, resolved when the pieces are gone.
import * as THREE from 'three';
import { depthFor } from './depth.js';
import { depthKey } from './fxfinishes.js';

function frameOf(obj) { const p = obj.parts.photo; p.updateMatrixWorld(true); const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); p.matrixWorld.decompose(pos, q, s); return { pos, q, s }; }
function texFrom(obj) { const img = obj.parts.photoTex && obj.parts.photoTex.image; if (!img) return null; const t = new THREE.CanvasTexture(img); t.colorSpace = THREE.SRGBColorSpace; return t; }
function run(dur, step) { return new Promise(res => { const t0 = performance.now(); const tick = () => { const u = Math.min(1, (performance.now() - t0) / 1000 / dur); step(u); if (u < 1) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); }); }

export function shatter(obj, S) {
  const tex = texFrom(obj); if (!tex) return Promise.resolve(); const F = frameOf(obj), w = obj.photoW, h = obj.photoH;
  const nx = 22, ny = Math.max(4, Math.round(22 * h / w)), pts = []; for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const e = i === 0 || j === 0 || i === nx || j === ny, r = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }; pts.push([(i + (e ? 0 : (r(i * 3.1 + j * 7.3) - 0.5) * 0.75)) / nx, (j + (e ? 0 : (r(i * 5.7 + j * 1.3) - 0.5) * 0.75)) / ny]); }
  const pos = [], uvs = [], C = [], R = [], B = [];
  const tri = (a, b, c) => { const cu = (a[0] + b[0] + c[0]) / 3, cv = (a[1] + b[1] + c[1]) / 3, rr = [Math.random(), Math.random(), Math.random()];
    [a, b, c].forEach((p, k) => { pos.push((p[0] - 0.5) * w, (p[1] - 0.5) * h, 0); uvs.push(p[0], p[1]); C.push((cu - 0.5) * w, (cv - 0.5) * h, 0); R.push(...rr); B.push(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0); }); };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = pts[j * (nx + 1) + i], b = pts[j * (nx + 1) + i + 1], c = pts[(j + 1) * (nx + 1) + i], d = pts[(j + 1) * (nx + 1) + i + 1]; if ((i + j) % 2) { tri(a, b, d); tri(a, d, c); } else { tri(a, b, c); tri(b, d, c); } }
  const geo = new THREE.BufferGeometry(); [['position', pos, 3], ['uv', uvs, 2], ['aC', C, 3], ['aR', R, 3], ['aB', B, 3]].forEach(([n, a, k]) => geo.setAttribute(n, new THREE.Float32BufferAttribute(a, k)));
  /* gravity in the photo's own frame, so a slab lying on the table rains its shards onto the table */
  const down = new THREE.Vector3(0, -1, 0).applyQuaternion(F.q.clone().invert());
  const mat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, transparent: true, uniforms: { uTex: { value: tex }, uP: { value: 0 }, uCrack: { value: 0 }, uDown: { value: down }, uFade: { value: 1 } },
    vertexShader: `attribute vec3 aC; attribute vec3 aR; attribute vec3 aB; uniform float uP; uniform vec3 uDown; varying vec2 vUv; varying float vSh; varying vec3 vB; varying float vDist;
      vec3 rotA(vec3 v, vec3 ax, float a){ return v*cos(a)+cross(ax,v)*sin(a)+ax*dot(ax,v)*(1.0-cos(a)); }
      void main(){ vUv=uv; vB=aB; float dist=length(aC.xy); vDist=dist; float t=max(0.0,uP*1.8-dist*0.18);
        vec3 vel=vec3(normalize(aC.xy+vec2(1e-4))*(0.5+aR.x*0.7)/(dist*0.35+0.5)+(aR.xy-0.5)*0.5,1.4+aR.z*1.6);
        vec3 ax=normalize(aR-0.5+vec3(0.0,0.0,0.001)); float ang=t*(2.5+aR.y*7.0); vec3 p=rotA(position-aC,ax,ang)+aC+vel*t+uDown*3.0*t*t;
        vec3 n=rotA(vec3(0.0,0.0,1.0),ax,ang); vSh=0.45+0.55*abs(n.z); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uCrack; uniform float uFade; varying vec2 vUv; varying float vSh; varying vec3 vB; varying float vDist;
      void main(){ vec3 c=texture2D(uTex,vUv).rgb*vSh; float e=min(vB.x,min(vB.y,vB.z)); float crack=(1.0-smoothstep(0.0,0.03,e))*smoothstep(uCrack*4.5,uCrack*4.5-0.4,vDist)*step(0.001,uCrack); c=mix(c,vec3(1.0),crack*0.85); gl_FragColor=vec4(c,uFade);
      #include <colorspace_fragment>
      }` });
  mat.toneMapped = false; const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.position.copy(F.pos); mesh.quaternion.copy(F.q); mesh.scale.copy(F.s); mesh.renderOrder = 30; S.ctx.scene.add(mesh);
  try { if (S.snd && S.snd.play) S.snd.play('burst', { tier: obj.slab.tier }); } catch (e) {}
  return run(0.35, u => { mat.uniforms.uCrack.value = u; }).then(() => run(1.5, u => { mat.uniforms.uCrack.value = 0; mat.uniforms.uP.value = u * 1.3; mat.uniforms.uFade.value = 1 - Math.max(0, (u - 0.7) / 0.3); }))
    .then(() => { S.ctx.scene.remove(mesh); geo.dispose(); mat.dispose(); tex.dispose(); });
}

export function sand(obj, S) {
  const img = obj.parts.photoTex && obj.parts.photoTex.image; if (!img) return Promise.resolve(); const F = frameOf(obj), w = obj.photoW, h = obj.photoH;
  return depthFor(depthKey(obj.slab), obj.base || img).then(dep => {
    const cols = 240, rows = Math.max(4, Math.round(cols * img.height / img.width)), c = document.createElement('canvas'); c.width = cols; c.height = rows; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, cols, rows); const px = g.getImageData(0, 0, cols, rows).data;
    const pos = [], col = [], ad = [], ar = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const i = (y * cols + x) * 4, u = (x + 0.5) / cols, v = 1 - (y + 0.5) / rows, dd = dep.D[Math.min(dep.h - 1, Math.floor(y / rows * dep.h)) * dep.w + Math.min(dep.w - 1, Math.floor(x / cols * dep.w))];
      pos.push((u - 0.5) * w, (v - 0.5) * h, 0.02); col.push(Math.pow(px[i] / 255, 2.2), Math.pow(px[i + 1] / 255, 2.2), Math.pow(px[i + 2] / 255, 2.2)); ad.push(dd); ar.push(Math.random()); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('aD', new THREE.Float32BufferAttribute(ad, 1)); geo.setAttribute('aR', new THREE.Float32BufferAttribute(ar, 1));
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(F.q.clone().invert()), side = new THREE.Vector3(1, 0, 0).applyQuaternion(F.q.clone().invert());
    const sz = S.renderer.getDrawingBufferSize(new THREE.Vector2()), cam = S.ctx.camera;
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uP: { value: 0 }, uCell: { value: w / cols }, uScale: { value: sz.y / (2 * Math.tan(cam.fov * Math.PI / 360)) }, uUp: { value: up }, uSide: { value: side }, uT: { value: 0 } },
      vertexShader: `attribute vec3 aCol; attribute float aD; attribute float aR; uniform float uP; uniform float uCell; uniform float uScale; uniform vec3 uUp; uniform vec3 uSide; uniform float uT; varying vec3 vC; varying float vA;
        void main(){ float st=(1.0-aD)*0.55+aR*0.2; float k=smoothstep(st,st+0.35,uP); vec3 p=position+(uSide*(1.6+aR*1.4)+uUp*(0.4+aR*0.9)+vec3(0.0,0.0,0.5*aD+aR*0.5))*k*k*1.8;
          p+=uSide*sin(position.y*5.0+uT*1.3+aR*6.0)*0.3*k; vC=mix(aCol,vec3(0.7,0.5,0.25),k*0.75); vA=1.0-smoothstep(0.55,1.0,k); vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.0,uCell*uScale/-mv.z*1.6*(1.15-k*0.5)); }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ gl_FragColor=vec4(vC,vA);
        #include <colorspace_fragment>
        }` });
    mat.toneMapped = false; const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.position.copy(F.pos); pts.quaternion.copy(F.q); pts.scale.copy(F.s); pts.renderOrder = 30; S.ctx.scene.add(pts);
    return run(2.6, u => { mat.uniforms.uP.value = u * 1.3; mat.uniforms.uT.value = u * 2.6; }).then(() => { S.ctx.scene.remove(pts); geo.dispose(); mat.dispose(); });
  });
}
