// DEPTH: a depth map for any slab photo, so finishes can lift the subject off the card (Slab Lab, Sam's picks).
// Two layers. A quick estimate made on the spot from the photo itself (the ground nearer at the bottom, sharp detail
// nearer than soft, colours unlike the border nearer, the sky far), smoothed so it follows the shapes in the photo.
// Then Depth Anything V2 Small upgrades it in the background: onnxruntime-web and the model come from public CDNs into
// a worker, run once per photo, and the result is kept in IndexedDB, so a photo is only ever measured once.
// Offline, or with the dev panel's "Quick depth only", the quick estimate is all there is and everything still works.
//   depthFor(key, canvas, onBetter) → Promise<{ w, h, D: Float32Array (near = 1), ai: bool }>
// onBetter(maps) is called later if the AI map arrives after the quick one was handed out.

const DW = 320;   /* depth is kept at this width; finishes resample it to their own size */
const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
const MODELS = ['https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx',
  'https://huggingface.co/Xenova/depth-anything-small-hf/resolve/main/onnx/model_quantized.onnx'];
const S_IN = 518;   /* the model's input size (a multiple of 14) */
let mode = 'ai';
export function setDepthMode(m) { mode = m === 'quick' ? 'quick' : 'ai'; }
export const depthSources = { ort: ORT_URL, models: MODELS };   /* tests point these at local copies */

/* ---------- small numeric helpers ---------- */
function boxBlur(a, w, h, r) { r = Math.max(1, Math.round(r)); const t = new Float32Array(a.length), o = new Float32Array(a.length), n = 2 * r + 1;
  for (let y = 0; y < h; y++) { const row = y * w; let s = 0; for (let x = -r; x <= r; x++) s += a[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { t[row + x] = s / n; s += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { o[y * w + x] = s / n; s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
  return o; }
function normalise(a, lo, hi) { const s = Array.from(a).filter((_, i) => i % 7 === 0).sort((x, y) => x - y), p0 = s[Math.floor(lo * (s.length - 1))], p1 = s[Math.floor(hi * (s.length - 1))], k = 1 / Math.max(1e-6, p1 - p0);
  for (let i = 0; i < a.length; i++) a[i] = Math.min(1, Math.max(0, (a[i] - p0) * k)); return a; }
/* a guided filter: smooths the estimate while keeping the photo's own edges (He et al.) */
function guided(I, p, w, h, r, eps) { const mI = boxBlur(I, w, h, r), mP = boxBlur(p, w, h, r), II = new Float32Array(I.length), IP = new Float32Array(I.length);
  for (let i = 0; i < I.length; i++) { II[i] = I[i] * I[i]; IP[i] = I[i] * p[i]; }
  const cII = boxBlur(II, w, h, r), cIP = boxBlur(IP, w, h, r), A = new Float32Array(I.length), B = new Float32Array(I.length);
  for (let i = 0; i < I.length; i++) { const v = cII[i] - mI[i] * mI[i]; A[i] = (cIP[i] - mI[i] * mP[i]) / (v + eps); B[i] = mP[i] - A[i] * mI[i]; }
  const mA = boxBlur(A, w, h, r), mB = boxBlur(B, w, h, r), q = new Float32Array(I.length); for (let i = 0; i < I.length; i++) q[i] = mA[i] * I[i] + mB[i]; return q; }
function pixels(canvas, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(canvas, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; }

/* ---------- the quick estimate ---------- */
export function quickDepth(canvas) {
  const w = DW, h = Math.max(8, Math.round(DW * canvas.height / canvas.width)), px = pixels(canvas, w, h), N = w * h;
  const L = new Float32Array(N), sat = new Float32Array(N), blue = new Float32Array(N);
  for (let i = 0; i < N; i++) { const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); L[i] = 0.299 * r + 0.587 * g + 0.114 * b; sat[i] = mx > 0 ? (mx - mn) / mx : 0; blue[i] = b - (r + g) / 2; }
  /* sharp detail reads as in focus, and in focus is usually the subject */
  const Lb = boxBlur(L, w, h, 2), sh = new Float32Array(N); for (let i = 0; i < N; i++) sh[i] = Math.abs(L[i] - Lb[i]); const sharp = normalise(boxBlur(sh, w, h, 5), 0.02, 0.98);
  /* colours unlike the border are usually not background */
  let br = 0, bg = 0, bb = 0, bn = 0; const m = Math.round(Math.min(w, h) * 0.06);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (x > m && x < w - m && y > m && y < h - m) continue; const i = (y * w + x) * 4; br += px[i]; bg += px[i + 1]; bb += px[i + 2]; bn++; }
  br /= bn; bg /= bn; bb /= bn; const dist = new Float32Array(N); for (let i = 0; i < N; i++) dist[i] = Math.hypot(px[i * 4] - br, px[i * 4 + 1] - bg, px[i * 4 + 2] - bb); normalise(dist, 0.05, 0.98);
  const d = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, u = x / w, v = y / h, centre = Math.exp(-((u - 0.5) ** 2) / 0.12 - ((v - 0.55) ** 2) / 0.2);
    /* sky: bright, pale or blue, high in the frame */
    const sky = Math.max(0, Math.min(1, (L[i] - 0.55) * 4)) * Math.max(0, Math.min(1, (0.5 - v) * 3)) * Math.max(0, Math.min(1, (0.35 - sat[i]) * 5 + blue[i] * 6));
    d[i] = (0.34 * Math.pow(v, 1.3) + 0.3 * sharp[i] + 0.22 * dist[i] + 0.14 * centre) * (1 - 0.85 * sky); }
  let q = guided(L, d, w, h, 8, 0.004); q = guided(L, q, w, h, 4, 0.002);
  return { w, h, D: normalise(q, 0.01, 0.99), ai: false };
}

/* ---------- the AI map, in a worker ---------- */
const WORKER = `let ort=null,sess=null;
self.onmessage=async e=>{const m=e.data;try{
 if(!ort){importScripts(m.ort+'ort.wasm.min.js');ort=self.ort;ort.env.wasm.wasmPaths=m.ort;ort.env.wasm.numThreads=1;}
 if(!sess){let err=null;for(const u of m.models){try{sess=await ort.InferenceSession.create(u,{executionProviders:['wasm'],graphOptimizationLevel:'all'});break;}catch(x){err=x;}}if(!sess)throw err||new Error('no model');}
 const t=new ort.Tensor('float32',m.input,[1,3,m.size,m.size]);const feeds={};feeds[sess.inputNames[0]]=t;const out=await sess.run(feeds);const o=out[sess.outputNames[0]];
 self.postMessage({id:m.id,data:o.data,dims:o.dims},[o.data.buffer]);}catch(x){self.postMessage({id:m.id,error:String(x&&x.message||x)});}};`;
let worker = null, broken = false, jobN = 0; const jobs = new Map();
function getWorker() { if (worker || broken) return worker; try { worker = new Worker(URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' })));
  worker.onmessage = e => { const j = jobs.get(e.data.id); if (!j) return; jobs.delete(e.data.id); if (e.data.error) j.rej(new Error(e.data.error)); else j.res(e.data); };
  worker.onerror = e => { broken = true; jobs.forEach(j => j.rej(new Error('worker'))); jobs.clear(); }; } catch (e) { broken = true; } return worker; }
let chain = Promise.resolve();
function aiDepth(canvas) {
  const run = () => new Promise((res, rej) => { const wk = getWorker(); if (!wk) { rej(new Error('no worker')); return; }
    const S = S_IN, px = pixels(canvas, S, S), input = new Float32Array(3 * S * S), mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) input[c * S * S + i] = (px[i * 4 + c] / 255 - mean[c]) / std[c];
    const id = ++jobN; jobs.set(id, { res, rej }); wk.postMessage({ id, ort: depthSources.ort, models: depthSources.models, size: S, input }, [input.buffer]); });
  const p = chain.then(run); chain = p.catch(() => null); return p.then(r => {
    const dims = r.dims, n = r.data.length, side = Math.round(Math.sqrt(n)), oh = dims && dims.length >= 2 ? dims[dims.length - 2] : side, ow = dims && dims.length >= 2 ? dims[dims.length - 1] : side;
    const w = DW, h = Math.max(8, Math.round(DW * canvas.height / canvas.width)), D = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = Math.min(ow - 1, Math.floor(x / w * ow)), sy = Math.min(oh - 1, Math.floor(y / h * oh)); D[y * w + x] = r.data[sy * ow + sx]; }
    return { w, h, D: normalise(D, 0.01, 0.995), ai: true }; });
}

/* ---------- the cache ---------- */
let dbP = null;
function db() { if (dbP) return dbP; dbP = new Promise(res => { try { const q = indexedDB.open('studium_depth', 1); q.onupgradeneeded = () => q.result.createObjectStore('d'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch (e) { res(null); } }); return dbP; }
async function cacheGet(key) { const d = await db(); if (!d) return null; return new Promise(res => { try { const q = d.transaction('d').objectStore('d').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }); }
async function cachePut(key, m) { const d = await db(); if (!d) return; try { const u = new Uint8Array(m.D.length); for (let i = 0; i < u.length; i++) u[i] = Math.round(m.D[i] * 255); d.transaction('d', 'readwrite').objectStore('d').put({ w: m.w, h: m.h, d: u }, key); } catch (e) {} }

const MEM = new Map(), WAIT = new Map(), PEND = new Map();
export function depthFor(key, canvas, onBetter) {
  const have = MEM.get(key); if (have && have.ai) return Promise.resolve(have);
  if (onBetter) { if (!WAIT.has(key)) WAIT.set(key, new Set()); WAIT.get(key).add(onBetter); }
  if (have) return Promise.resolve(have);
  if (PEND.has(key)) return PEND.get(key);
  const p = cacheGet(key).then(c => {
    if (c && c.d) { const D = new Float32Array(c.d.length); for (let i = 0; i < D.length; i++) D[i] = c.d[i] / 255; const m = { w: c.w, h: c.h, D, ai: true }; MEM.set(key, m); WAIT.delete(key); return m; }
    const q = quickDepth(canvas); MEM.set(key, q);
    if (mode === 'ai' && !broken && typeof Worker !== 'undefined' && (typeof navigator === 'undefined' || navigator.onLine !== false))
      aiDepth(canvas).then(m => { MEM.set(key, m); cachePut(key, m); const ws = WAIT.get(key); WAIT.delete(key); if (ws) ws.forEach(f => { try { f(m); } catch (e) { console.error(e); } }); })
        .catch(e => { console.warn('AI depth unavailable, keeping the quick map:', e && e.message || e); });
    return q;
  });
  PEND.set(key, p); p.then(() => PEND.delete(key), () => PEND.delete(key));
  return p;
}
/* forget a listener (an object disposed before the AI map arrived) */
export function forgetDepth(key, onBetter) { const ws = WAIT.get(key); if (ws) ws.delete(onBetter); }
