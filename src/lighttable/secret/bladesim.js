// BLADE SIM: two spinning tops in a bowl, kept free of three.js so it can be tuned in node (blades.js draws it).
// A blade is three slabs: the attack ring (its tier sets its teeth and the hit, its Frame sub-grade sharpens it), the
// weight disc (grade and tier set the weight, Print sets stamina) and the tip (its finish sets how it moves, Moment
// sets how hard it drives). Light across all three sets the launch. Raw prints count as grade 6 all round, so playing
// one never gives away its hidden grade. Variants are quirks: Negative spins left, Misprint wobbles off line, Clear is
// see-through, Full art is a touch stronger, Stamped survives one burst. Three parts from one pack get a set bonus.
// Units are the table's; the bowl floor is BOWL.R across its radius. Spin is rad/s, signed (+ is right spin).

export const BOWL = { R: 3.8, depth: 0.75 };
export const TIPS = {
  sharp: { name: 'Sharp', drive: 0.15, damp: 1.5, decay: 1.8, hit: 0.85, desc: 'Holds the centre and spins for ages' },
  ball:  { name: 'Ball',  drive: 0.7,  damp: 0.8, decay: 2.7,  hit: 1.0,  desc: 'A bit of both' },
  flat:  { name: 'Flat',  drive: 1.5,  damp: 0.7, decay: 2.1,  hit: 1.7, desc: 'Races round the bowl and hits hard' },
};
export const RANKS = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
const TIP_OF = { matte: 'sharp', etch: 'sharp', foil: 'flat', glitter: 'flat', gold: 'ball', prism: 'ball' };
export const SPECIALS = {
  guard:     { name: 'Etch guard', tier: 'rare',      desc: 'Shrugs off hits for a few seconds and mends some of the cracks' },
  starburst: { name: 'Starburst',  tier: 'epic',      desc: 'A blast of light that throws your rival back' },
  slam:      { name: 'Gold slam',  tier: 'legendary', desc: 'Doubles its weight and charges at your rival' },
  eclipse:   { name: 'Eclipse',    tier: 'mythic',    desc: 'Blacks out the bowl and drains your rival’s spin' },
};
export const POINTS = { burst: 2, out: 2, spin: 1, time: 1 };
export const WIN_AT = 3;
export const ROUND_S = 50;
const W_REF = 70;     /* a full-power launch spins at about this */
const OUT_V = 1.8;    /* hitting the rim faster than this, soon after a hit, goes over it */
const OUT_K = 0.8;   /* a hit that throws a blade outward this hard, scaled by how near the rim it is, knocks it clean out */

export function statsOf(parts) {
  const [a, b, c] = parts, rk = s => RANKS[s.tier] || 1, gr = s => s.graded ? s.grade : 6, sub = (s, i) => s.graded && s.subs ? s.subs[i] : 6;
  const vars = parts.map(p => p.variant).filter(Boolean);
  const packOf = p => p.photo ? (p.photo.packId != null ? 'id' + p.photo.packId : p.photo.pack || null) : null;
  const set = !!packOf(a) && parts.every(p => packOf(p) === packOf(a));
  const k = (set ? 1.1 : 1) * (vars.includes('full') ? 1.08 : 1);
  const best = parts.reduce((m, p) => rk(p) > rk(m) ? p : m, a);
  return {
    atk: (0.75 + rk(a) * 0.11 + sub(a, 1) * 0.04) * k,
    mass: 0.8 + gr(b) * 0.035 + rk(b) * 0.05 + (b.finish === 'gold' ? 0.25 : b.finish === 'foil' ? -0.1 : 0),
    stamina: (0.7 + sub(b, 3) * 0.05 + rk(b) * 0.04) * k,
    tip: TIP_OF[c.finish] || 'ball',
    agility: 0.7 + sub(c, 2) * 0.05 + rk(c) * 0.03,
    launch: 0.85 + (sub(a, 0) + sub(b, 0) + sub(c, 0)) / 30 * 0.3,
    guard: (0.7 + (gr(a) + gr(b) + gr(c)) / 30 * 0.6 + (rk(a) + rk(b) + rk(c)) * 0.03) * k,
    special: rk(best) >= 3 ? Object.keys(SPECIALS).find(id => SPECIALS[id].tier === best.tier) || null : null,
    dir: vars.includes('negative') ? -1 : 1, erratic: vars.includes('misprint'), clear: vars.includes('clear'), stamped: vars.includes('stamped'),
    set, radius: 0.5 + rk(a) * 0.025,
  };
}

/* the five bars on the build card, each 0..1 */
export function bars(st) {
  const n = (v, a, b) => Math.max(0.04, Math.min(1, (v - a) / (b - a)));
  return [['Attack', n(st.atk, 0.9, 2.0)], ['Weight', n(st.mass, 0.85, 1.65)], ['Stamina', n(st.stamina / TIPS[st.tip].decay, 0.6, 2.0)], ['Speed', n(TIPS[st.tip].drive * st.agility, 0.2, 3.6)], ['Burst guard', n(st.guard, 0.9, 1.75)]];
}

export function makeTop(st, side) {
  return { st, side, p: { x: 0, y: 0 }, v: { x: 0, y: 0 }, w: 0, ang: 0, burst: 0, charge: 0, alive: true, done: null, wob: 0, slamT: 0, guardT: 0, hitT: 0, shield: st.stamped, jit: 0.4 };
}
export function world(a, b) { return { tops: [a, b], t: 0, wRef: W_REF }; }

/* side +1 launches from the near rim, -1 from the far one; power 0..1; aim in radians off straight at the centre */
export function launch(t, power, aim) {
  const R = BOWL.R, s = t.side; power = Math.max(0, Math.min(1, power));
  t.p = { x: Math.sin(aim) * R * 0.25, y: s * R * 0.62 };
  const dx = Math.sin(aim), dy = -s * Math.cos(aim), sp = 1.0 + power * 2.6;
  t.v = { x: dx * sp, y: dy * sp };
  t.w = t.st.dir * (32 + power * 34) * t.st.launch;
  t.alive = true; t.done = null; t.burst = 0; t.charge = 0; t.wob = 0; t.slamT = 0; t.guardT = 0; t.shield = t.st.stamped;
}

const massOf = t => t.st.mass * (t.slamT > 0 ? 2.2 : 1);
const atkOf = t => t.st.atk * TIPS[t.st.tip].hit * (t.slamT > 0 ? 1.5 : 1);
const frac = (t, W) => Math.min(1, Math.abs(t.w) / W.wRef);

export function step(W, dt, ev) {
  const R = BOWL.R, Kc = 9.8 * 2 * BOWL.depth / (R * R) * 0.8;
  W.t += dt;
  for (const t of W.tops) {
    if (!t.alive) continue;
    const T = TIPS[t.st.tip], s = frac(t, W);
    let r = Math.hypot(t.p.x, t.p.y) || 1e-6;
    let ax = -t.p.x * Kc, ay = -t.p.y * Kc;
    /* the tip's grip turns spin into a sideways push, so a flat tip races round the bowl and a sharp one sits still */
    const dr = T.drive * t.st.agility * s * Math.min(1, r / 0.6), sg = Math.sign(t.w) || 1;
    ax += -t.p.y / r * dr * sg; ay += t.p.x / r * dr * sg;
    if (t.st.erratic) { t.jit -= dt; if (t.jit <= 0) { t.jit = 0.5 + Math.random() * 0.6; const a = Math.random() * 6.2832; t.v.x += Math.cos(a) * 0.9; t.v.y += Math.sin(a) * 0.9; } }
    /* it wobbles as it slows */
    t.wob = s < 0.35 ? (0.35 - s) / 0.35 : 0;
    if (t.wob) { ax += (Math.random() - 0.5) * 6 * t.wob; ay += (Math.random() - 0.5) * 6 * t.wob; }
    t.v.x += ax * dt; t.v.y += ay * dt; const d = Math.exp(-T.damp * dt); t.v.x *= d; t.v.y *= d;
    t.p.x += t.v.x * dt; t.p.y += t.v.y * dt;
    const sp = Math.hypot(t.v.x, t.v.y);
    t.w -= sg * (T.decay + 0.06 * sp) / t.st.stamina * dt; t.ang += t.w * dt;
    t.slamT = Math.max(0, t.slamT - dt); t.guardT = Math.max(0, t.guardT - dt); t.hitT = Math.max(0, t.hitT - dt);
    t.charge = Math.min(1, t.charge + dt * 0.05);
    if (Math.abs(t.w) < W.wRef * 0.07 || Math.sign(t.w) !== sg) { t.alive = false; t.done = 'spin'; ev.push({ type: 'down', top: t }); continue; }
    /* the rim: a soft hit bounces back, a hard one goes over */
    r = Math.hypot(t.p.x, t.p.y) || 1e-6; const rad = t.st.radius;
    if (r + rad > R) { const nx = t.p.x / r, ny = t.p.y / r, vn = t.v.x * nx + t.v.y * ny;
      if (vn > OUT_V && t.hitT > 0) { t.alive = false; t.done = 'out'; ev.push({ type: 'out', top: t, k: vn }); continue; }
      if (vn > 0) { t.v.x -= 1.5 * vn * nx; t.v.y -= 1.5 * vn * ny; t.w *= 0.985; ev.push({ type: 'wall', top: t, k: vn, x: nx * R, y: ny * R }); }
      t.p.x = nx * (R - rad); t.p.y = ny * (R - rad); }
  }
  const [a, b] = W.tops; if (a.alive && b.alive) collide(a, b, W, ev);
}

function collide(a, b, W, ev) {
  const dx = b.p.x - a.p.x, dy = b.p.y - a.p.y, dist = Math.hypot(dx, dy) || 1e-6, ra = a.st.radius, rb = b.st.radius;
  if (dist >= ra + rb) return;
  const nx = dx / dist, ny = dy / dist, ia = 1 / massOf(a), ib = 1 / massOf(b), ov = ra + rb - dist;
  a.p.x -= nx * ov * ia / (ia + ib); a.p.y -= ny * ov * ia / (ia + ib); b.p.x += nx * ov * ib / (ia + ib); b.p.y += ny * ov * ib / (ia + ib);
  const vrel = (b.v.x - a.v.x) * nx + (b.v.y - a.v.y) * ny; if (vrel >= 0) return;
  const tx = -ny, ty = nx, sa = frac(a, W), sb = frac(b, W), same = Math.sign(a.w) === Math.sign(b.w);
  const slip = a.w * ra + b.w * rb;   /* how fast the two rims rub past each other where they touch */
  const A = atkOf(a), B = atkOf(b);
  /* spin turns into recoil: two tops spinning the same way smash apart, opposite spins mostly grind */
  const J = -(1 + 0.55) * vrel / (ia + ib) + (same ? 1 : 0.35) * Math.sqrt(Math.abs(slip)) * 0.1 * (A * sa + B * sb);
  a.v.x -= nx * J * ia; a.v.y -= ny * J * ia; b.v.x += nx * J * ib; b.v.y += ny * J * ib;
  /* thrown outward hard enough near the rim, it goes straight over */
  const thrown = (t, sx, sy, dv) => { const r = Math.hypot(t.p.x, t.p.y) || 1e-6, out = (sx * t.p.x + sy * t.p.y) / r * dv; if (W.t > 1.5 && out * r / BOWL.R > OUT_K) { t.alive = false; t.done = 'out'; ev.push({ type: 'out', top: t, k: out }); } };
  const side = slip * 0.012 * (same ? 1 : 0.4);
  a.v.x -= tx * side * ia; a.v.y -= ty * side * ia; b.v.x += tx * side * ib; b.v.y += ty * side * ib;
  const k = -vrel + Math.abs(slip) * 0.02 * (same ? 1 : 0.3);
  const keep = (t, lose) => { const s0 = Math.sign(t.w); t.w -= s0 * lose; if (Math.sign(t.w) !== s0) t.w = s0 * 0.01; };
  let la = k * (same ? 0.9 : 0.6) * B / a.st.stamina, lb = k * (same ? 0.9 : 0.6) * A / b.st.stamina;
  if (!same) { /* opposite spins: the stronger one steals some of what the other loses */
    if (Math.abs(a.w) * A >= Math.abs(b.w) * B) { a.w += Math.sign(a.w) * lb * 0.4; } else { b.w += Math.sign(b.w) * la * 0.4; } }
  keep(a, la); keep(b, lb);
  const crack = (t, atk, s) => { if (t.guardT > 0) return; t.burst += k * atk * 0.05 / t.st.guard * (2 - s);
    if (t.burst >= 1) { if (t.shield) { t.shield = false; t.burst = 0.45; ev.push({ type: 'shield', top: t }); } else { t.alive = false; t.done = 'burst'; ev.push({ type: 'burst', top: t }); } } };
  crack(a, B, sa); crack(b, A, sb);
  if (a.alive) thrown(a, -nx, -ny, J * ia); if (b.alive) thrown(b, nx, ny, J * ib);
  a.hitT = b.hitT = 0.8; a.charge = Math.min(1, a.charge + k * 0.1); b.charge = Math.min(1, b.charge + k * 0.1);
  ev.push({ type: 'hit', a, b, k, x: a.p.x + nx * ra, y: a.p.y + ny * ra, same });
}

/* the special: only when charged; the caller draws it */
export function special(W, t, ev) {
  if (!t.alive || t.charge < 1 || !t.st.special) return false;
  const o = W.tops.find(x => x !== t), dx = o.p.x - t.p.x, dy = o.p.y - t.p.y, d = Math.hypot(dx, dy) || 1e-6;
  t.charge = 0;
  if (t.st.special === 'guard') { t.guardT = 3.5; t.burst = Math.max(0, t.burst - 0.4); }
  else if (t.st.special === 'starburst') { if (o.alive && d < 3) { const f = 4.6 * (1.25 - d / 3) / o.st.mass; o.v.x += dx / d * f; o.v.y += dy / d * f; o.burst += 0.12; o.hitT = 0.8; } }
  else if (t.st.special === 'slam') { t.slamT = 2.5; t.hitT = 0; t.v.x += dx / d * 3.2; t.v.y += dy / d * 3.2; }
  else if (t.st.special === 'eclipse') { if (o.alive) o.w *= 0.72; t.w *= 1.15; }
  ev.push({ type: 'special', top: t, id: t.st.special });
  return true;
}

/* has the round ended? → { winner: top|null, how: 'burst'|'out'|'spin'|'time', pts } */
export function outcome(W) {
  const [a, b] = W.tops;
  if (a.alive && b.alive) { if (W.t < ROUND_S) return null; const w = Math.abs(a.w) >= Math.abs(b.w) ? a : b; return { winner: w, how: 'time', pts: POINTS.time }; }
  if (!a.alive && !b.alive) { const w = a.done === b.done ? (Math.abs(a.w) >= Math.abs(b.w) ? a : b) : (a.done === 'spin' ? a : b.done === 'spin' ? b : a); const l = w === a ? b : a; return { winner: w, how: l.done, pts: POINTS[l.done] || 1 }; }
  const l = a.alive ? b : a; return { winner: a.alive ? a : b, how: l.done, pts: POINTS[l.done] || 1 };
}

/* the rival: a launch, and when to use its special */
export function aiLaunch() { return { power: 0.72 + Math.random() * 0.25, aim: (Math.random() - 0.5) * 0.9 }; }
export function aiThink(W, t, dt) {
  if (!t.alive || t.charge < 1 || !t.st.special) return false;
  const o = W.tops.find(x => x !== t), d = Math.hypot(o.p.x - t.p.x, o.p.y - t.p.y);
  const want = t.st.special === 'starburst' ? d < 2.2 : t.st.special === 'slam' ? d < 3 : t.st.special === 'guard' ? t.burst > 0.45 : true;
  return want && Math.random() < dt * 1.2;
}
