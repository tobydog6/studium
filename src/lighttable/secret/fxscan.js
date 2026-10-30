// FXSCAN: Studium's own scan of the stump, sealed in a slab (the "Inside the scan" mythic, Sam's favourite from the
// Slab Lab). The splat renderer is Spark, the same one the studio uses, but built against the light table's three.js
// as a separate chunk (build.mjs → dist/lt-spark.js) so nobody downloads it until a scan slab is on screen. The chunk
// and the scan bytes come through the parent page's bridge (LT_BRIDGE.spark, LT_BRIDGE.scan): base64 in the single
// file build, fetched in pieces in the web build. Any failure resolves null and the finish falls back to the window.
import * as THREE from 'three';

const HOST = (() => { try { return window.parent !== window && window.parent.LT_BRIDGE || null; } catch (e) { return null; } })();
let SPK = null, RENDER = null, SCAN = null;
async function bytesOf(v) {
  if (!v) throw new Error('no data');
  if (/^@parts:/.test(v)) { const L = await Promise.all(v.slice(7).split(',').map(u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.arrayBuffer(); })));
    let n = 0; L.forEach(b => { n += b.byteLength; }); const o = new Uint8Array(n); let k = 0; L.forEach(b => { o.set(new Uint8Array(b), k); k += b.byteLength; }); return o.buffer; }
  const s = atob(v), o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o.buffer;
}
function spark() {
  if (SPK) return SPK;
  SPK = (async () => {
    if (window.LT_SPARK) return window.LT_SPARK;
    const src = HOST && HOST.spark ? HOST.spark() : null, code = new TextDecoder().decode(await bytesOf(src));
    window.LT_THREE = THREE;
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = URL.createObjectURL(new Blob([code], { type: 'text/javascript' })); s.onload = res; s.onerror = () => rej(new Error('spark chunk')); document.head.appendChild(s); });
    if (!window.LT_SPARK) throw new Error('spark chunk did not load'); return window.LT_SPARK;
  })();
  SPK.catch(() => { SPK = null; }); return SPK;
}
/* .stm (Studium's packed scan: zlib, 16-bit positions and log scales, byte planes) to .splat, as in ar.js */
function unpack(buf) { const dv = new DataView(buf), n = dv.getUint32(4, true), f = new Float32Array(buf.slice(8, 40)), b = new Uint8Array(buf, 40), out = new ArrayBuffer(n * 32), F = new Float32Array(out), U = new Uint8Array(out);
  const sx = [(f[3] - f[0]) / 65535, (f[4] - f[1]) / 65535, (f[5] - f[2]) / 65535], ss = (f[7] - f[6]) / 65535;
  for (let i = 0; i < n; i++) { const fo = i * 8, uo = i * 32; for (let ch = 0; ch < 6; ch++) { const bs = ch * 2 * n, v = b[bs + i] | (b[bs + n + i] << 8); F[fo + ch] = ch < 3 ? f[ch] + v * sx[ch] : Math.exp(f[6] + v * ss); } for (let k = 0; k < 8; k++) U[uo + 24 + k] = b[12 * n + k * n + i]; }
  return out; }
/* the scan, decoded once: its splats, a robust centre and size (ydown, so y and z flip), and the turn that faces the spot the scene starts from */
function scanData() {
  if (SCAN) return SCAN;
  SCAN = (async () => {
    const data = HOST && HOST.scan ? HOST.scan('stump') : null, ab = await bytesOf(data);
    const raw = await new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer(), buf = unpack(raw), F = new Float32Array(buf), n = buf.byteLength / 32, xs = [], ys = [], zs = [];
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 40000))) { xs.push(F[i * 8]); ys.push(-F[i * 8 + 1]); zs.push(-F[i * 8 + 2]); }
    const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]; };
    const lo = [q(xs, 0.03), q(ys, 0.02), q(zs, 0.03)], hi = [q(xs, 0.97), q(ys, 0.98), q(zs, 0.97)], c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const vx = -1.58 - c[0], vz = 0.88 - c[2];
    return { buf, n, c, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], face: Math.atan2(-vx, vz) };
  })();
  SCAN.catch(() => { SCAN = null; }); return SCAN;
}
/* a splat mesh of the scan for one slab: { mesh, c, size, face, n, release() }, or null if Spark or the scan can't load */
export async function loadScan(S) {
  try {
    const [K, sc] = await Promise.all([spark(), scanData()]);
    if (!RENDER) { RENDER = new K.SparkRenderer({ renderer: S.renderer }); RENDER.userData.secret = true; RENDER.renderOrder = 40; RENDER.frustumCulled = false; S.ctx.scene.add(RENDER); }
    const mesh = new K.SplatMesh({ fileBytes: new Uint8Array(sc.buf.slice(0)), fileType: 'splat' }); mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI); mesh.userData.noParticles = true;
    await mesh.initialized;
    return { mesh, c: sc.c, size: sc.size, face: sc.face, n: sc.n, release() { if (mesh.parent) mesh.parent.remove(mesh); try { mesh.dispose && mesh.dispose(); } catch (e) {} } };
  } catch (e) { console.warn('scan slab: falling back', e && e.message || e); return null; }
}
