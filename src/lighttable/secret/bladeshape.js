// BLADE SHAPE: every part's shape grows out of its slab's photograph, so no two blades are alike and the same slab
// always makes the same part. Pure functions over pixels (no three.js), so they can be checked in node.
// A photo is read once into its "DNA" (dnaFromPixels): how bright and how contrasty it is, how much fine detail it
// has (edges), how mirror-symmetric it is, which way its lines lean, its light read round a circle from the centre
// (polar) and down the frame (rows), how colourful it is, and where its brightest patches sit. Then:
//   attack ring  teeth: the tier sets the minimum, detail adds more; symmetric photos make even spikes, lopsided ones
//                hooked teeth that lean the way the photo's lines lean; the polar light bends the whole outline, fine
//                detail serrates the edges, bright patches punch windows, Epic and up grow a second row of fins.
//   weight disc  a lathe whose edge follows the photo's light from top to bottom; grey photos turn faceted (hex, oct),
//                colourful ones stay round; contrast sets how deep the grooves cut.
//   tip          the tip type stays the finish's (that's gameplay), the photo sets its length, flare and ribs.
// Shapes never change the physics: the stats still come from the slab alone, so a blade never wins on looks.

export const DEFAULT_DNA = { mean: 0.5, contrast: 0.2, edge: 0.3, sym: 0.6, lean: 0, sat: 0.3, hue: 0.1, polar: new Array(64).fill(0), rows: new Array(16).fill(0.5), blobs: [] };

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* rgba pixels (any size) → DNA. Reads a centred square, resampled to 48 × 48. */
export function dnaFromPixels(data, w, h) {
  const N = 48, side = Math.min(w, h), ox = (w - side) / 2, oy = (h - side) / 2, L = new Float32Array(N * N);
  let sum = 0, satSum = 0, hx = 0, hy = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = Math.min(w - 1, Math.floor(ox + (x + 0.5) / N * side)), sy = Math.min(h - 1, Math.floor(oy + (y + 0.5) / N * side)), i = (sy * w + sx) * 4;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = 0.299 * r + 0.587 * g + 0.114 * b;
    L[y * N + x] = l; sum += l; const s = mx > 0 ? (mx - mn) / mx : 0; satSum += s;
    if (mx - mn > 0.05) { let hh = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); hh = ((hh / 6) % 1 + 1) % 1; hx += Math.cos(hh * 6.2832) * s; hy += Math.sin(hh * 6.2832) * s; }
  }
  const n = N * N, mean = sum / n; let v = 0; for (let i = 0; i < n; i++) v += (L[i] - mean) * (L[i] - mean); const contrast = Math.sqrt(v / n);
  /* edges and the way they lean (a structure tensor over the gradients) */
  let eg = 0, jxx = 0, jyy = 0, jxy = 0;
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const gx = L[y * N + x + 1] - L[y * N + x - 1], gy = L[(y + 1) * N + x] - L[(y - 1) * N + x]; eg += Math.hypot(gx, gy); jxx += gx * gx; jyy += gy * gy; jxy += gx * gy; }
  const edge = clamp(eg / ((N - 2) * (N - 2)) / 0.12, 0, 1);
  const ang = 0.5 * Math.atan2(2 * jxy, jxx - jyy), coh = Math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / ((jxx + jyy) || 1);
  const lean = clamp(Math.sin(2 * ang) * coh * 1.6, -1, 1);
  /* mirror symmetry, left against right */
  let d = 0; for (let y = 0; y < N; y++) for (let x = 0; x < N / 2; x++) d += Math.abs(L[y * N + x] - L[y * N + N - 1 - x]);
  const sym = clamp(1 - d / (n / 2) / Math.max(0.05, contrast * 2), 0, 1);
  /* the light read round a circle from the centre, and down the frame */
  const polar = new Array(64).fill(0), rows = new Array(16).fill(0);
  for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; let s = 0; for (let j = 4; j < 24; j++) { const x = Math.round(N / 2 + Math.cos(a) * j), y = Math.round(N / 2 + Math.sin(a) * j); s += L[clamp(y, 0, N - 1) * N + clamp(x, 0, N - 1)]; } polar[k] = s / 20 - mean; }
  for (let r = 0; r < 16; r++) { let s = 0; for (let y = r * 3; y < r * 3 + 3; y++) for (let x = 0; x < N; x++) s += L[y * N + x]; rows[r] = s / (3 * N); }
  const pr = Math.max(1e-3, ...polar.map(Math.abs)); for (let k = 0; k < 64; k++) polar[k] /= pr;
  /* the brightest patches (local maxima of a blurred copy, well above the mean): where the windows go */
  const B = new Float32Array(n); for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) { let s = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) s += L[(y + j) * N + x + i]; B[y * N + x] = s / 25; }
  const blobs = [];
  for (let y = 4; y < N - 4; y += 2) for (let x = 4; x < N - 4; x += 2) { const c = B[y * N + x]; if (c < mean + contrast * 1.1) continue; let top = true;
    for (let j = -4; j <= 4 && top; j += 2) for (let i = -4; i <= 4; i += 2) if ((i || j) && B[(y + j) * N + x + i] > c) { top = false; break; }
    if (top) blobs.push({ a: Math.atan2(y - N / 2, x - N / 2), k: c }); }
  blobs.sort((p, q) => q.k - p.k);
  const kept = []; for (const b of blobs) { if (kept.every(k => Math.abs(((b.a - k.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.9)) kept.push(b); if (kept.length >= 3) break; }
  return { mean, contrast, edge, sym, lean, sat: satSum / n, hue: ((Math.atan2(hy, hx) / 6.2832) % 1 + 1) % 1, polar, rows, blobs: kept.map(b => b.a) };
}

/* the polar light at angle a (0..2π), smoothed */
function polarAt(dna, a) { const p = dna.polar, n = p.length, f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * n, i = Math.floor(f), t = f - i; return p[i % n] * (1 - t) + p[(i + 1) % n] * t; }

/* the attack ring's outline: an array of [x, y] round the circle, radius about 1 at the tips */
export function ringOutline(dna, rank, dir, opts = {}) {
  const teeth = clamp(Math.round(2 + rank + dna.edge * 3), 3, 11), hook = 1 - dna.sym, sharp = 0.6 + rank * 0.28 + dna.contrast * 1.6;
  const depth = 0.17 + rank * 0.03 + dna.contrast * 0.15, lean = dna.lean * 0.35, fins = rank >= 4, M = opts.res || 18, pts = [];
  for (let i = 0, T = teeth * M; i < T; i++) {
    const a = i / T * Math.PI * 2, u0 = ((a + lean) * teeth / (Math.PI * 2)) % 1, u = dir < 0 ? 1 - ((u0 + 1) % 1) : (u0 + 1) % 1;
    /* a symmetric spike and a hooked one, mixed by how lopsided the photo is */
    const spike = Math.pow(1 - Math.abs(u * 2 - 1), sharp), saw = Math.pow(1 - u, sharp * 0.8);
    let f = spike * (1 - hook) + saw * hook;
    if (fins) f = Math.max(f, 0.6 * Math.pow(1 - Math.abs(((u + 0.5) % 1) * 2 - 1), sharp * 1.4));
    let r = 1 - depth * (1 - f) + 0.05 * polarAt(dna, a);
    if (dna.edge > 0.45) r -= 0.012 * (dna.edge - 0.45) * 4 * Math.abs(Math.sin(a * teeth * 5));
    pts.push([Math.cos(a) * clamp(r, 0.68, 1.06), Math.sin(a) * clamp(r, 0.68, 1.06)]);
  }
  return pts;
}
export function ringHole(dna) { return 0.36 + 0.08 * clamp(dna.mean, 0, 1); }
export function ringDepth(dna) { return 0.1 + 0.08 * clamp(dna.contrast / 0.3, 0, 1); }
/* windows through the ring where the photo's brightest patches are */
export function ringWindows(dna) { return dna.blobs.slice(0, 3).map((a, i) => ({ a, r: 0.56, s: 0.05 + 0.02 * (2 - i) })); }

/* the weight disc's side profile for a lathe: [radius, height] from the bottom up; facets for the lathe's segments */
export function discProfile(dna) {
  const pts = [[0.001, 0]], H = 0.22, rows = dna.rows, g = 0.04 + 0.08 * clamp(dna.contrast / 0.3, 0, 1);
  pts.push([0.8, 0]);
  for (let k = 0; k <= 8; k++) { const t = k / 8, row = rows[Math.round(t * (rows.length - 1))], r = 0.82 + 0.12 * row - g * Math.abs(Math.sin(t * Math.PI * (2 + Math.round(dna.edge * 3)))); pts.push([r, 0.01 + t * (H - 0.02)]); }
  pts.push([0.8, H], [0.001, H]);
  return pts;
}
export function discFacets(dna) { return dna.sat > 0.28 ? 64 : [6, 8, 10, 12][Math.floor(clamp(dna.edge, 0, 0.99) * 4)]; }

/* the tip's proportions: length, flare at the neck, ribs round it */
export function tipSpec(dna) { return { len: 0.3 + 0.14 * clamp(dna.mean, 0, 1), flare: 0.24 + 0.1 * clamp(dna.sat * 2, 0, 1), ribs: dna.edge > 0.5 ? 8 + Math.round(dna.edge * 8) : 24, dome: 0.45 + 0.5 * clamp(dna.contrast / 0.3, 0, 1) }; }

/* ---- Beyblade X style (Sam's reference photos): a few heavy, angular chrome chunks over a swirl of coloured plastic flames ---- */
/* how many metal wings: three is the classic, detailed photos and the top tiers get more, lopsided ones fewer */
export function wingCount(dna, rank) { return clamp(3 + (dna.edge > 0.55 ? 1 : 0) + (rank >= 5 ? 1 : 0) - (dna.sym < 0.25 ? 1 : 0), 2, 5); }
/* the metal: angular chunks (few points, so the faces stay flat and catch the light) round a base ring; [x, y] about radius 1 */
export function metalChunks(dna, rank, dir) {
  const W = wingCount(dna, rank), base = 0.6, span = (Math.PI * 2 / W) * clamp(0.5 + dna.contrast * 0.9, 0.5, 0.78), hook = 0.18 + 0.25 * (1 - dna.sym), pts = [];
  /* one wing's profile, u across it from trailing to leading edge: a long ramp up, a sharp hooked tip, a notch, a drop */
  const prof = [[0, base], [0.12, 0.8], [0.42, 0.93], [0.7, 1.0], [0.78 + hook * 0.3, 0.97], [0.8 + hook * 0.3, 0.86], [0.9, 0.9], [1, base]];
  const notch = dna.edge > 0.4;
  for (let w = 0; w < W; w++) { const a0 = w / W * Math.PI * 2 + dna.lean * 0.3;
    prof.forEach(([u, r], i) => { if (!notch && (i === 5 || i === 6)) return; const uu = dir < 0 ? 1 - u : u, a = a0 + uu * span, rr = r + 0.03 * polarAt(dna, a); pts.push([a, clamp(rr, 0.5, 1.04)]); });
    /* the base ring between wings, a few points so it stays round */
    const gapA = a0 + span, gapB = a0 + Math.PI * 2 / W; for (let k = 1; k < 6; k++) { const a = gapA + (gapB - gapA) * k / 6; pts.push([a, base]); } }
  pts.sort((p, q) => p[0] - q[0]);
  return pts.map(([a, r]) => [Math.cos(a) * r, Math.sin(a) * r]);
}
/* the plastic: swept flames between and under the metal, more of them for busier photos, bent by the photo's light */
export function flameOutline(dna, rank, dir) {
  const W = wingCount(dna, rank), F = W * (2 + Math.round(dna.edge * 2)), N = F * 26, pts = [], sweep = 1.6 + dna.contrast * 2;
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, u0 = ((a * F / (Math.PI * 2)) % 1 + 1) % 1, u = dir < 0 ? 1 - u0 : u0;
    const f = Math.pow(1 - u, sweep) * (0.7 + 0.3 * Math.cos(a * W));   /* hooked flames, longest where the metal wings sit */
    const r = 0.5 + 0.36 * f + 0.04 * polarAt(dna, a); pts.push([Math.cos(a) * clamp(r, 0.48, 0.92), Math.sin(a) * clamp(r, 0.48, 0.92)]); }
  return pts;
}
/* the metal as separate chunks (no plate between them, so the plastic shows through): one closed polygon per wing */
export function metalWings(dna, rank, dir) {
  const W = wingCount(dna, rank), rin = 0.66, span = (Math.PI * 2 / W) * clamp(0.42 + dna.contrast * 0.9, 0.42, 0.7), hook = 0.18 + 0.25 * (1 - dna.sym), out = [];
  /* a sweeping wing: a long smooth rise to the contact point, a hooked tip, a sharp drop (and a notch on detailed photos) */
  const peak = 0.66 + hook * 0.2, prof = [];
  for (let k = 0; k <= 10; k++) { const u = k / 10 * peak, e = Math.pow(u / peak, 0.55); prof.push([u, 0.72 + 0.28 * e]); }
  prof.push([peak + 0.06, 0.985], [peak + 0.1, 0.9], [0.9, 0.88], [1, 0.72]); const notch = dna.edge > 0.4;
  for (let w = 0; w < W; w++) { const a0 = w / W * Math.PI * 2 + dna.lean * 0.3, poly = [];
    prof.forEach(([u, r], i) => { if (!notch && i === prof.length - 2) return; const uu = dir < 0 ? 1 - u : u, a = a0 + uu * span; poly.push([a, clamp(r + 0.025 * polarAt(dna, a), 0.7, 1.04)]); });
    poly.sort((p, q) => p[0] - q[0]);
    const back = []; for (let k = 4; k >= 0; k--) back.push([a0 + span * k / 4, rin]);
    out.push(poly.concat(back).map(([a, r]) => [Math.cos(a) * r, Math.sin(a) * r])); }
  return out;
}
