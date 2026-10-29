// BLADE NET: the wire format for an online duel. blades.js plays it; the page's duel.js carries it (Supabase Realtime).
// The host runs the sim and sends what happens; the guest sees the same bowl turned round, its own blade nearest, just
// as the host sees theirs. So everything crossing the wire turns through 180° on the way in: positions, velocities and
// aims change sign, pocket angles move on by π, and top 0 and top 1 swap. Spin keeps its sign (a half turn mirrors
// nothing). Pure functions, free of three.js, so node can check them.

const r3 = v => Math.round(v * 1000) / 1000;

/* a sim top as a short array: position, velocity, spin, angle, cracks, charge, wobble, the timers, flags, how it ended */
export function packTop(t) {
  return [r3(t.p.x), r3(t.p.y), r3(t.v.x), r3(t.v.y), r3(t.w), r3(t.ang), r3(t.burst), r3(t.charge), r3(t.wob), r3(t.slamT), r3(t.guardT), r3(t.hitT),
    (t.alive ? 1 : 0) | (t.dash ? 2 : 0) | (t.shield ? 4 : 0), t.done || 0];
}
/* a packed top onto a sim top; flip turns it round */
export function applyTop(t, a, flip) {
  const k = flip ? -1 : 1;
  t.p.x = a[0] * k; t.p.y = a[1] * k; t.v.x = a[2] * k; t.v.y = a[3] * k; t.w = a[4]; t.ang = a[5]; t.burst = a[6]; t.charge = a[7]; t.wob = a[8];
  t.slamT = a[9]; t.guardT = a[10]; t.hitT = a[11]; t.alive = !!(a[12] & 1); t.dash = !!(a[12] & 2); t.shield = !!(a[12] & 4); t.done = a[13] || null;
}

/* a sim event: the tops it names become their index, numbers are rounded */
export function packEv(e, tops) {
  const o = {};
  for (const k in e) { const v = e[k]; const i = v && typeof v === 'object' ? tops.indexOf(v) : -1;
    if (i >= 0) o[k] = { t: i }; else if (typeof v === 'number') o[k] = r3(v); else if (v == null || typeof v !== 'object') o[k] = v; }
  return o;
}
export function unpackEv(o, tops, flip) {
  const e = {};
  for (const k in o) { const v = o[k]; e[k] = v && typeof v === 'object' && 't' in v ? tops[flip ? 1 - v.t : v.t] : v; }
  if (flip) { ['x', 'y', 'z'].forEach(k => { if (typeof e[k] === 'number') e[k] = -e[k]; });
    if (e.type !== 'hit' && typeof e.a === 'number') e.a += Math.PI; }   /* on a hit, a and b are the tops; elsewhere a is a pocket's angle */
  return e;
}

/* a launch from the sender's side of the bowl, as the other side sees it */
export function turnPlan(p) { return { power: +p.power || 0, aim: -(+p.aim || 0), x: -(+p.x || 0) }; }
/* the round's end: who won (the host's index), as the guest counts it */
export function turnWinner(i, flip) { return flip ? 1 - i : i; }

/* a slab to send: its own fields only, never a huge embedded image, and an id of its own on the other side */
export function cleanSlab(s) {
  const keep = ['id', 'seed', 'tier', 'grade', 'variant', 'finish', 'cert', 'title', 'label', 'subs', 'stamp', 'serial', 'graded', 'loaner', 'spare'], o = {};
  keep.forEach(k => { if (s[k] !== undefined) o[k] = s[k]; });
  if (s.photo) { o.photo = { ...s.photo }; if (typeof o.photo.url === 'string' && (o.photo.url.length > 2000 || /^(blob|data):/.test(o.photo.url))) delete o.photo.url; }
  return o;
}
/* ok(url): whether to load a photo from there (the receiving side decides; anything else is painted from the seed) */
export function foeSlab(s, ok) { const o = cleanSlab(s); o.id = 'foe-' + String(s.id).replace(/^foe-/, ''); o.foe = true;
  if (o.photo && o.photo.url && !(ok && ok(o.photo.url))) delete o.photo.url;
  ['title', 'cert', 'label'].forEach(k => { if (typeof o[k] === 'string') o[k] = o[k].slice(0, 80); }); if (o.photo) ['title', 'pack', 'artist', 'by'].forEach(k => { if (typeof o.photo[k] === 'string') o.photo[k] = o.photo[k].slice(0, 80); });
  return o; }
