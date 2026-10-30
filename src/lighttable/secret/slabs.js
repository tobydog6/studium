// The slab data model and the secret store. A pull is a graded photo in an acrylic slab: a tier (the odds Sam set),
// a grade rolled separately, sometimes a variant, a finish set by the tier (the dev panel can override it), and a
// photograph from an artist pack. Everything lives in localStorage under studium_secret_v1 (the demo's under
// studium_secret_demo_v1: the page sets store.key); the light table runs in a
// srcdoc iframe on the page's own origin, so library.js in the parent page reads the same key for the Rare folder.
import { rng } from './tween.js';

export const TIERS = [
  { id: 'common',    name: 'Common',    odds: 55,  color: '#9aa0aa', dark: '#555a62', finish: 'matte',   points: 10 },
  { id: 'uncommon',  name: 'Uncommon',  odds: 25,  color: '#4f8cff', dark: '#1f4fb5', finish: 'foil',    points: 25 },
  { id: 'rare',      name: 'Rare',      odds: 12,  color: '#9b5cff', dark: '#5d27c0', finish: 'etch',    points: 60 },
  { id: 'epic',      name: 'Epic',      odds: 5.5, color: '#ff4fae', dark: '#a8186b', finish: 'glitter', points: 150 },
  { id: 'legendary', name: 'Legendary', odds: 2,   color: '#ff6a3d', dark: '#b13a12', finish: 'gold',    points: 400 },
  { id: 'mythic',    name: 'Mythic',    odds: 0.5, color: '#e8c26a', dark: '#7a5710', finish: 'prism',   points: 1000 },
];
export const TIER = Object.fromEntries(TIERS.map(t => [t.id, t]));
export const RANK = Object.fromEntries(TIERS.map((t, i) => [t.id, TIERS.length - i]));   /* mythic highest */
export const GRADES = { 10: 'GEM MINT', 9: 'MINT', 8: 'NM-MT', 7: 'NEAR MINT', 6: 'EX-MT', 5: 'EXCELLENT', 4: 'VG-EX', 3: 'VERY GOOD', 2: 'GOOD', 1: 'POOR' };
export const GRADE_ODDS = [[10, 6], [9, 22], [8, 30], [7, 20], [6, 11], [5, 5], [4, 3], [3, 1.6], [2, 0.9], [1, 0.5]];
export const VARIANT_CHANCE = 0.14;
export const VARIANTS = [
  { id: 'full',     name: 'Full art', desc: 'The image bleeds to every edge, no border at all.' },
  { id: 'misprint', name: 'Misprint', desc: 'Off-centre, a ghosted double image and a stray foil band.' },
  { id: 'negative', name: 'Negative', desc: 'The film negative instead of the print, sprockets and all.' },
  { id: 'clear',    name: 'Clear',    desc: 'Printed on acrylic, so the light comes straight through.' },
  { id: 'stamped',  name: 'Stamped',  desc: 'A numbered foil stamp in the corner, one of only 50.' },
  { id: 'breakout', name: 'Breakout', desc: 'The subject climbs out of the photo and over its mount.' },
  { id: 'liquid',   name: 'Liquid-filled', desc: 'The case is half full of oil and gold glitter that sloshes as you move it.' },
];
export const VARIANT = Object.fromEntries(VARIANTS.map(v => [v.id, v]));
/* the first six are the tier finishes; the rest are test finishes for the dev panel (holo.js builds them) */
export const FINISHES = [
  { id: 'matte', name: 'Matte', tier: 'common' }, { id: 'foil', name: 'Rainbow foil', tier: 'uncommon' }, { id: 'etch', name: 'Rainbow etch', tier: 'rare' },
  { id: 'glitter', name: 'Glitter', tier: 'epic' }, { id: 'gold', name: 'Gold repoussé', tier: 'legendary' }, { id: 'prism', name: 'Prism black', tier: 'mythic' },
  { id: 'chrome', name: 'Liquid chrome' }, { id: 'lenticular', name: 'Lenticular' }, { id: 'latent', name: 'Latent' }, { id: 'thermal', name: 'Thermal' },
  { id: 'cyanotype', name: 'Cyanotype' }, { id: 'eclipse', name: 'Eclipse' }, { id: 'steel', name: 'Steel' }, { id: 'glass', name: 'Glass' },
  { id: 'porcelain', name: 'Painted porcelain' }, { id: 'kintsugi', name: 'Kintsugi' }, { id: 'raku', name: 'Raku' }, { id: 'stone', name: 'Carved stone' },
  { id: 'polychrome', name: 'Polychrome' }, { id: 'keywarm', name: 'Colour key · warm' }, { id: 'keyblue', name: 'Colour key · blue' }, { id: 'leaf', name: 'Highlight leaf' }, { id: 'silver', name: 'Silver gelatin' },
  { id: 'selective', name: 'Selective colour' }, { id: 'split', name: 'Split tone' }, { id: 'solar', name: 'Solarised' }, { id: 'infrared', name: 'Infrared' }, { id: 'poster', name: 'Posterised' }, { id: 'xpro', name: 'Cross processed' },
  { id: 'duoRose', name: 'Duotone · rose' }, { id: 'duoMoss', name: 'Duotone · moss' }, { id: 'duoInk', name: 'Duotone · ink' }, { id: 'duoEmber', name: 'Duotone · ember' }, { id: 'tritone', name: 'Tritone' }, { id: 'vignette', name: 'Vignette' },
  /* the depth finishes (fxfinishes.js), Sam's picks from the Slab Lab */
  { id: 'gilt', name: 'Gilded subject' }, { id: 'dag', name: 'Daguerreotype' }, { id: 'bronze', name: 'Bronze and verdigris' }, { id: 'litho', name: 'Lithophane' },
  { id: 'crystal', name: 'Crystal etch' }, { id: 'focus', name: 'Rack focus' }, { id: 'fireflies', name: 'Fireflies' }, { id: 'depthscan', name: 'Depth scan' }, { id: 'window', name: 'Window into the scene' },
  { id: 'anaglyph', name: 'Red-cyan 3D' }, { id: 'sun', name: 'Golden hour' }, { id: 'rain', name: 'Rainy window' }, { id: 'snow', name: 'First snow' }, { id: 'mist', name: 'Morning mist' }, { id: 'sunken', name: 'Sunken' },
  { id: 'lava', name: 'The floor is lava' }, { id: 'aurora', name: 'Aurora australis' }, { id: 'seasons', name: 'Four seasons' }, { id: 'puddles', name: 'After the rain' }, { id: 'storm', name: 'Thunderstorm' },
  { id: 'fireworks', name: 'Guy Fawkes night' }, { id: 'lightpaint', name: 'Light painting' }, { id: 'holoplate', name: 'Hologram plate' }, { id: 'planet', name: 'Tiny planet' }, { id: 'droste', name: 'Infinite slab' },
  { id: 'blackhole', name: 'Event horizon' }, { id: 'polaroid', name: 'Instant film' }, { id: 'tray', name: 'Developing tray' }, { id: 'burn', name: 'Film burn' }, { id: 'kaleido', name: 'Kaleidoscope' },
  { id: 'riso', name: 'Riso print' }, { id: 'terminal', name: 'Terminal' }, { id: 'aero', name: 'Aerochrome' }, { id: 'coin', name: 'Struck coin' }, { id: 'pyro', name: 'Pyrography' }, { id: 'jade', name: 'Carved jade' },
  { id: 'vertigo', name: 'Vertigo' }, { id: 'tiltshift', name: 'Tilt-shift miniature' }, { id: 'camcorder', name: 'Camcorder' }, { id: 'lensball', name: 'Lensball' }, { id: 'scan3d', name: 'Inside the scan' },
];
/* each tier draws its finish from a pool: the signature one most often, with looks of its own beside it (Sam: not all rainbow) */
/* Sam's Slab Lab picks folded in by how special they feel: calm photo treatments low down, weather and tricks of the lens in
   the middle, worked metal and stone at legendary, and the strangest at mythic. The signature finish stays the most likely
   in each tier (three tickets), so a tier still reads at a glance. */
const POOL = { common: ['matte', 'matte', 'matte', 'matte', 'steel', 'silver', 'vignette', 'poster', 'duoInk', 'riso', 'tiltshift'],
  uncommon: ['foil', 'foil', 'foil', 'keywarm', 'keyblue', 'polychrome', 'split', 'xpro', 'duoMoss', 'duoRose', 'aero', 'terminal', 'camcorder', 'kaleido', 'mist', 'puddles', 'focus'],
  rare: ['etch', 'etch', 'etch', 'lenticular', 'latent', 'cyanotype', 'selective', 'infrared', 'duoEmber', 'depthscan', 'anaglyph', 'polaroid', 'pyro', 'vertigo', 'lensball', 'seasons', 'rain', 'sunken', 'planet'],
  epic: ['glitter', 'glitter', 'glitter', 'chrome', 'thermal', 'solar', 'tritone', 'porcelain', 'bronze', 'litho', 'fireflies', 'snow', 'lava', 'storm', 'fireworks', 'tray', 'burn', 'jade'],
  legendary: ['gold', 'gold', 'gold', 'gilt', 'kintsugi', 'raku', 'glass', 'sun', 'holoplate', 'aurora', 'coin'],
  mythic: ['prism', 'prism', 'eclipse', 'dag', 'crystal', 'window', 'droste', 'blackhole', 'lightpaint', 'scan3d'] };
/* the sealed finishes only exist in a slab: they come out of the pull already graded */
export const SEALED = new Set(['crystal', 'window', 'coin', 'scan3d']);
/* a variant has to make sense on its finish (a breakout needs a photo to climb out of; a coin has no Full art) */
const NO_VARIANT = { breakout: ['crystal', 'window', 'coin', 'scan3d', 'planet', 'droste', 'kaleido', 'polaroid', 'tray', 'burn', 'terminal', 'camcorder', 'lensball', 'blackhole'],
  liquid: ['crystal', 'window', 'coin', 'scan3d', 'polaroid', 'tray'], full: ['coin', 'scan3d', 'crystal', 'polaroid'], misprint: ['coin', 'scan3d', 'crystal'], negative: ['coin', 'scan3d'], clear: ['coin', 'scan3d', 'crystal', 'window'] };
export function variantFits(v, f) { return !v || !(NO_VARIANT[v] || []).includes(f); }
export function rollFinish(r, tier) { const p = POOL[tier] || ['matte']; return p[Math.floor(r() * p.length)]; }
export const FINISH = Object.fromEntries(FINISHES.map(f => [f.id, f]));

export function rollTier(r) { const total = TIERS.reduce((s, t) => s + t.odds, 0); let acc = 0; const v = r * total; for (const t of TIERS) { acc += t.odds; if (v <= acc) return t.id; } return 'common'; }
export function rollGrade(r) { let acc = 0; const v = r * 100; for (const [g, w] of GRADE_ODDS) { acc += w; if (v <= acc) return g; } return 8; }
export function rollVariant(r) { if (r > VARIANT_CHANCE) return null; return VARIANTS[Math.floor(r / VARIANT_CHANCE * VARIANTS.length) % VARIANTS.length].id; }
export const pad = (n, w) => String(n).padStart(w, '0');

/* ---------- the store ---------- */
const KEY = 'studium_secret_v1';
const fresh = () => ({ v: 1, unlocked: false, code: '1234', pulls: [], vault: [], binder: [], table: [], display: [], caseCols: [[], [], [], []], points: 0, certN: 0, finishes: {} });
export const store = {
  d: null, t: 0, key: KEY,
  get() { if (store.d) return store.d; let d = null; try { d = JSON.parse(localStorage.getItem(store.key) || 'null'); } catch (e) { d = null; }
    store.d = d && d.v === 1 ? Object.assign(fresh(), d) : fresh(); return store.d; },
  save() { clearTimeout(store.t); store.t = setTimeout(store.saveNow, 200); },
  saveNow() { clearTimeout(store.t); try { localStorage.setItem(store.key, JSON.stringify(store.get())); } catch (e) {} if (store.onSave) try { store.onSave(); } catch (e) {} },   /* onSave: the page saves the session, so the collection reaches the cloud */
  reset() { store.d = fresh(); store.saveNow(); },
  pull(id) { return store.get().pulls.find(p => p.id === id) || null; },
  addPull(slab) { const d = store.get(); d.pulls.push(slab); d.points += slab.points; store.save(); return slab; },
  /* where a slab is: 'vault' | 'binder' | 'table' | 'loose' (pulled, not placed anywhere yet) */
  where(id) { const d = store.get(); if (d.vault.includes(id)) return 'vault'; if (d.display && d.display.includes(id)) return 'display'; if (d.binder.some(pg => pg && pg.includes(id))) return 'binder'; if (d.table.some(t => t.id === id)) return 'table'; return 'loose'; },
  /* take a slab out of wherever it is */
  detach(id) { const d = store.get(); d.vault = d.vault.filter(x => x !== id); if (d.display) d.display = d.display.filter(x => x !== id); if (d.caseCols) d.caseCols = d.caseCols.map(c => c.filter(x => x !== id)); d.binder.forEach(pg => { if (pg) for (let i = 0; i < pg.length; i++) if (pg[i] === id) pg[i] = null; }); d.table = d.table.filter(t => t.id !== id); store.save(); },
  /* a pull gone for good: out of the pulls and everywhere it was filed (the points it earned stay) */
  discard(id) { store.detach(id); const d = store.get(); d.pulls = d.pulls.filter(p => p.id !== id); delete d.finishes[id]; store.save(); },
  toVault(id) { store.detach(id); store.get().vault.push(id); store.save(); },
  toTable(id, x, z, yaw) { store.detach(id); store.get().table.push({ id, x: +x.toFixed(3), z: +z.toFixed(3), yaw: +(yaw || 0).toFixed(3) }); store.save(); },
  /* binder pages hold 9 pockets each; the first free pocket, adding a page when every one is full */
  toBinder(id) { store.detach(id); const d = store.get(); for (const pg of d.binder) { const i = pg.indexOf(null); if (i >= 0) { pg[i] = id; store.save(); return; } } const pg = new Array(9).fill(null); pg[0] = id; d.binder.push(pg); store.save(); },
};

/* ---------- rolling a slab ---------- */
let photoSource = () => [];
export function setPhotoSource(fn) { photoSource = fn; }
/* a photograph from the artist packs; with no packs (offline, nothing cached) a painted stand-in keyed by the seed */
function pickPhoto(r, want) {
  const packs = (photoSource() || []).filter(p => p && p.imgs && p.imgs.length);
  if (!packs.length) { const n = 1 + Math.floor(r() * 60); return { painted: true, plate: n, title: 'Sample pack · Plate ' + pad(n, 3), pack: 'Sample pack' }; }
  const pk = want && packs.find(p => String(p.id) === String(want)) || packs[Math.floor(r() * packs.length)];
  const i = Math.floor(r() * pk.imgs.length), im = pk.imgs[i];
  return { packId: pk.id, pack: pk.name, imgId: im.id, url: im.url, plate: i + 1, title: pk.name.replace(/\s*·.*$/, '') + ' · Plate ' + pad(i + 1, 3) };
}
/* only artist packs go on slabs (Sam): a slab that got the old sample pack (renders of a scan) takes an artist's photo
   instead, picked from its own seed, once the packs are in. Returns how many changed. */
export function artistOnly(pulls) {
  const packs = (photoSource() || []).filter(p => p && p.imgs && p.imgs.length); if (!packs.length) return 0; let n = 0;
  (pulls || []).forEach(s => { const ph = s.photo; if (!ph || !(ph.packId === 'sample' || /^Sample pack/.test(ph.pack || ''))) return;
    s.photo = pickPhoto(rng((s.seed || 1) ^ 0x5a17), null); s.title = s.photo.title; n++; });
  return n;
}
/* Sam's loop: a pull comes out as a raw card (tier, variant and finish known, no grade), you post it off for grading,
   and GRADING_MS later it is back on the table as a parcel; opening the parcel is the grade reveal. The grade is
   rolled at the pull and kept hidden, so a reload can't re-roll it. The dev panel can make the wait instant. */
export const GRADING_MS = 24 * 60 * 60 * 1000;
export function roll(o = {}) {
  const seed = o.seed ?? (Math.random() * 2 ** 31) >>> 0, r = rng(seed), d = store.get();
  const tier = o.tier || rollTier(r()), grade = o.grade || rollGrade(r()), variant = o.variant !== undefined ? o.variant : rollVariant(r());
  const slab = { id: 's' + Date.now().toString(36) + Math.floor(r() * 1e6).toString(36), seed, tier, grade, variant, finish: o.finish || rollFinish(r, tier),
    cert: '#' + pad(++d.certN, 5), photo: pickPhoto(r, o.pack), ts: Date.now(), points: TIER[tier].points + (grade >= 10 ? 50 : grade >= 9 ? 20 : 0),
    graded: !!o.graded, sentAt: null, readyAt: null };
  if (!variantFits(slab.variant, slab.finish)) slab.variant = null;
  if (SEALED.has(slab.finish)) slab.graded = true;
  if (variant === 'stamped') slab.stamp = 1 + Math.floor(r() * 50);
  if (tier === 'mythic') slab.serial = '1/1';
  slab.title = slab.photo.title; slab.label = rollLabel(r, tier); slab.subs = rollSubs(r, grade);
  return slab;
}
/* the label colourway is its own small roll (Sam's call): mostly black and gold, sometimes the tier colour, now and then gold */
export const LABELS = { black: 'Black and gold', gold: 'Gold', tier: 'Black and tier colour' };
export function rollLabel(r, tier) { const v = r() * 100, big = tier === 'legendary' || tier === 'mythic'; if (v < (big ? 45 : 10)) return 'gold'; if (v < (big ? 60 : 28)) return 'tier'; return 'black'; }
/* four sub-grades (Light, Frame, Moment, Print) that sit around the grade: none below it by more than one, at least one equal */
export function rollSubs(r, grade) { const s = [0, 1, 2, 3].map(() => Math.max(1, Math.min(10, grade + (r() < 0.55 ? 0 : r() < 0.5 ? -1 : 1)))); s[Math.floor(r() * 4)] = grade; return s; }
/* post a raw card off: it is away until readyAt (waitMs lets the dev panel shorten the day) */
export function sendForGrading(slab, waitMs) { if (slab.graded || slab.sentAt) return slab; slab.sentAt = Date.now(); slab.readyAt = slab.sentAt + (waitMs ?? GRADING_MS); store.save(); return slab; }
export function gradingState(slab, now) { if (slab.graded) return 'graded'; if (!slab.sentAt) return 'raw'; return (now || Date.now()) >= slab.readyAt ? 'back' : 'away'; }
/* the parcel is opened: the grade shows from now on */
export function receiveGraded(slab) { slab.graded = true; store.save(); return slab; }
export function skipGrading(slab) { if (slab.sentAt && !slab.graded) { slab.readyAt = Date.now(); store.save(); } return slab; }
export function timeLeft(slab, now) { return Math.max(0, (slab.readyAt || 0) - (now || Date.now())); }
export const gradeText = g => GRADES[g] || '';
export const tierOf = slab => TIER[slab.tier] || TIER.common;
/* the finish a slab shows right now: the dev panel's test finish wins, then a per-slab override, then the tier's */
export function finishOf(slab, test) { if (test && test !== 'tier') return test; const o = store.get().finishes[slab.id]; return o || slab.finish || tierOf(slab).finish; }
export function sortPulls(list) { return list.slice().sort((a, b) => (RANK[b.tier] - RANK[a.tier]) || (b.grade - a.grade) || (b.ts - a.ts)); }
