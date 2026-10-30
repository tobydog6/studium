// MARKET: coins, keys and trading for the secret layer (Sam: "a trade and buy sell system with other players... the
// currency can be used to buy more slab pulls or buy off other players, you earn the currency through quests and
// achievements, only visible in the secret menu... a market value checker... put them online to sell, sold not by real
// people but it feels like it").
//   Coins   earned in Studium itself: every achievement level and every finished quest pays (HOST.trade.earnings()),
//           credited once each; a starting float the first time. Spent on keys, on the market, in trades.
//   Keys    a pull costs a key. Three free keys a day; more cost KEY_PRICE coins. Dev panel: Keys, Free for testing.
//   Value   every slab has a market value: its tier, grade (a raw card is worth less, its grade is unknown), variant and
//           finish, a little of its own, and the day's drift for its finish, so prices move and a checker can chart them.
//   Online  list a slab at a price; simulated collectors buy it in their own time (the closer to value, the sooner),
//           or make an offer; the sale lands while you are away too. A fee of 5% goes to the market.
//           The market's own stock: a dozen graded slabs a day from simulated sellers, to buy.
//   Players everyone in your lobby (your class, or the public demo, as with Blades duels) publishes their shelf; open
//           someone's, pick what you want, swap to yours, pick what you give and coins, send. They accept, decline or
//           counter. Your side waits in escrow (out of your collection) until it ends, so it can't be spent twice.
// The panel (#skMarket) opens from the Market button by the points. Everything lives in the secret store.
import { TIERS, TIER, FINISH, SEALED } from './slabs.js';
import * as THREE from 'three';

const BASE = { common: 20, uncommon: 45, rare: 110, epic: 260, legendary: 700, mythic: 2200 };
const GRADE_K = { 10: 3.2, 9: 1.9, 8: 1.35, 7: 1.1, 6: 0.95, 5: 0.85, 4: 0.75, 3: 0.66, 2: 0.58, 1: 0.5 };
const KEY_PRICE = 150, FREE_KEYS = 3, FEE = 0.05, START = 0,   /* Sam: coins come only from quests and achievements */ PER_ACH = 60, PER_QUEST = 150;
const DAY = 864e5, today = () => Math.floor(Date.now() / DAY);
const BUYERS = ['kiri.lens', 'mōhio_photo', 'tui_frames', 'harbourlight', 'ngaio.prints', 'kererū_kollects', 'mt_eden_mono', 'fernfocus', 'pōhutukawa.pix', 'southerly_slabs', 'te_awa_archive', 'kumara_cam', 'flatwhite.film', 'raupō_reels', 'kea_collects', 'lyttelton_light', 'sandfly_snaps', 'gumboot_gallery', 'manuka_matte', 'tarn_tones'];
const h32 = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-NZ');

export function install(S) {
  const { store, SL } = S, H = () => (S.ctx.HOST && S.ctx.HOST.trade) || null;
  S.dev.define('keys', 'Keys', { daily: 'Three a day', free: 'Free (testing)' }, 'daily');
  const D = () => { const d = store.get(); if (d.coins == null) { d.coins = 0; d.coinsFrom = null; } if (!d.listings) d.listings = []; if (!d.sales) d.sales = []; if (!d.escrow) d.escrow = {}; if (!d.seenOffers) d.seenOffers = {}; if (!d.log) d.log = []; if (d.keys == null) { d.keys = FREE_KEYS; d.keyDay = today(); } return d; };

  /* ---------- value ---------- */
  const finOf = slab => SL.finishOf(slab, null);
  const finK = slab => { const f = finOf(slab), t = TIER[slab.tier] || TIER.common; return SEALED.has(f) ? 1.45 : f === t.finish ? 1 : 1.15; };
  const drift = (f, day) => { const a = h32(f), b = h32(f + '·'); return 1 + 0.09 * Math.sin(day * 0.43 + a * 6.28) + 0.05 * Math.sin(day * 1.31 + b * 6.28) + 0.03 * Math.sin(day * 2.9 + a * 17); };
  function value(slab, day) { if (!slab) return 0; day = day ?? today(); const g = slab.graded ? GRADE_K[slab.grade] || 1 : 0.7;
    return Math.max(5, Math.round(BASE[slab.tier] * g * (slab.variant ? 1.6 : 1) * finK(slab) * (0.9 + 0.25 * h32(slab.seed + ':' + slab.tier)) * drift(finOf(slab), day))); }
  const history = (slab, n) => Array.from({ length: n || 30 }, (_, i) => value(slab, today() - (n || 30) + 1 + i));

  /* the activity log: buys, sales, trades, coins earned */
  function logIt(text, coins) { const d = D(); d.log.unshift({ at: Date.now(), text, coins: coins || 0 }); d.log = d.log.slice(0, 200); store.save(); }
  /* ---------- coins and keys ---------- */
  const hud = () => { try { S.hud(); } catch (e) {} paintBtn(); };
  function earn(quiet) { const d = D(), h = H(); if (!h || !h.earnings) return; let e; try { e = h.earnings(); } catch (x) { return; } if (!e) return;
    if (!d.coinsFrom) { d.coinsFrom = { ach: e.ach, quests: e.quests }; d.coins += START + e.ach * PER_ACH + e.quests * PER_QUEST; store.save(); if (!quiet && d.coins) S.toast('Your coin purse: ' + fmt(d.coins) + ' coins from what you have done in Studium so far.'); hud(); return; }
    if (e.ach < d.coinsFrom.ach || e.quests < d.coinsFrom.quests) { d.coinsFrom = { ach: Math.min(e.ach, d.coinsFrom.ach), quests: Math.min(e.quests, d.coinsFrom.quests) }; store.save(); }   /* quests reset, or another session: what you earn from here still pays */
    const da = Math.max(0, e.ach - d.coinsFrom.ach), dq = Math.max(0, e.quests - d.coinsFrom.quests); if (!da && !dq) return;
    const n = da * PER_ACH + dq * PER_QUEST; d.coins += n; d.coinsFrom = { ach: Math.max(e.ach, d.coinsFrom.ach), quests: Math.max(e.quests, d.coinsFrom.quests) }; store.save();
    logIt(dq ? 'Coins for finishing a quest' : 'Coins for an achievement', n); if (!quiet) S.toast('+' + fmt(n) + ' coins' + (dq ? ' for finishing a quest' : ' for an achievement') + '.'); hud(); }
  function refillKeys() { const d = D(); if (d.keyDay !== today()) { d.keys = Math.max(d.keys, FREE_KEYS); d.keyDay = today(); store.save(); } }
  /* a pull: true when a key was spent (or keys are free for testing) */
  function spendKey() { if (S.dev.opt('keys') === 'free') return true; refillKeys(); const d = D();
    if (d.keys > 0) { d.keys--; store.save(); hud(); return true; }
    S.toast('No keys left today. Buy one with coins in the Market (' + KEY_PRICE + ').', 'Market', () => open('wallet')); return false; }
  function buyKey() { const d = D(); if (d.coins < KEY_PRICE) { S.toast('Not enough coins. Quests and achievements earn more.'); return false; } d.coins -= KEY_PRICE; d.keys++; logIt('Bought a key', -KEY_PRICE); store.save(); hud(); S.sfx('ltPutDown'); return true; }

  /* ---------- where a slab goes when it is yours again, and taking one out ---------- */
  function file(id) { const s = store.pull(id); if (!s) return; if (s.graded && S.caseBox && S.caseBox.file) S.caseBox.file(id); else store.toBinder(id); }
  function reracks() { try { if (S.caseBox) S.caseBox.rebuild(); } catch (e) {} try { if (S.shelf && S.shelf.rack) S.shelf.rack.rebuild(); } catch (e) {} }
  const owned = () => { const d = D(), out = new Set(Object.values(d.escrow).flatMap(x => (x.cards || []).map(c => c.id))); d.listings.forEach(l => out.add(l.id));
    return d.pulls.filter(p => !out.has(p.id) && SL.gradingState(p) !== 'away' && !p.pending); };
  /* off the table too, if it is lying there */
  function lift(id) { const o = S.table.list.find(x => x.slab && x.slab.id === id); if (o) S.table.remove(o, true); store.detach(id); }
  /* a slab that came from someone else: its own id here, and where it came from */
  function adopt(slab, from) { const d = D(), s = JSON.parse(JSON.stringify(slab)); if (store.pull(s.id)) s.id = 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    s.from = from; s.ts = Date.now(); delete s.pending; d.pulls.push(s); store.save(); file(s.id); return s; }

  /* ---------- online: my listings, the simulated collectors, the market's own stock ---------- */
  function list(id, price) { const s = store.pull(id); if (!s) return; price = Math.max(1, Math.round(price)); lift(id); D().listings.push({ id, price, at: Date.now(), t: Date.now() }); store.save(); reracks(); hud(); S.toast('Listed online at ' + fmt(price) + ' coins.'); }
  function unlist(id) { const d = D(); d.listings = d.listings.filter(l => l.id !== id); store.save(); file(id); reracks(); hud(); }
  function sell(l, price, buyer) { const d = D(), s = store.pull(l.id); d.listings = d.listings.filter(x => x !== l); if (!s) { store.save(); return; }
    const net = Math.round(price * (1 - FEE)); d.coins += net; d.sales.unshift({ title: s.title, tier: s.tier, price, net, buyer, at: Date.now() }); d.sales = d.sales.slice(0, 40); logIt('Sold ' + s.title + ' to ' + buyer, net); store.discard(l.id); store.save(); hud();
    S.toast('Sold to ' + buyer + ' for ' + fmt(price) + ' coins (' + fmt(net) + ' after the fee).', 'Market', () => open('mine')); }
  /* time passes for every listing: a sale is likelier the nearer the price is to value; dear ones draw offers instead */
  function simulate() { const d = D(), now = Date.now();
    d.listings.slice().forEach(l => { const s = store.pull(l.id); if (!s) { d.listings = d.listings.filter(x => x !== l); return; }
      const hrs = Math.min(72, (now - (l.t || now)) / 36e5); if (hrs < 0.01) return; l.t = now; const v = value(s), ratio = l.price / v;
      const pHour = Math.min(0.9, Math.max(0.004, 0.32 * Math.exp(-4.2 * (ratio - 0.95)))), sold = Math.random() < 1 - Math.pow(1 - pHour, hrs);
      if (sold) { sell(l, l.price, BUYERS[Math.floor(Math.random() * BUYERS.length)]); return; }
      if (!l.offer && ratio > 1.12 && Math.random() < 1 - Math.pow(1 - 0.12, hrs)) { l.offer = { buyer: BUYERS[Math.floor(Math.random() * BUYERS.length)], amount: Math.round(v * (0.9 + Math.random() * 0.12)), at: now }; S.toast(l.offer.buyer + ' offered ' + fmt(l.offer.amount) + ' coins for ' + s.title + '.', 'Market', () => open('mine')); } });
    store.save(); }
  function stock() { const d = D(), day = today(); if (d.stock && d.stock.day === day) return d.stock.items;
    const items = []; for (let i = 0; i < 18; i++) { const seed = (Math.floor(h32('stock' + day + ':' + i) * 2 ** 31)) >>> 0, cert = d.certN; const s = SL.roll({ seed, graded: true }); d.certN = cert;   /* the market's slabs don't use up your cert numbers */
      s.id = 'm' + day.toString(36) + i; items.push({ slab: s, seller: BUYERS[Math.floor(h32('seller' + seed) * BUYERS.length)], price: Math.round(value(s) * (0.92 + h32('p' + seed) * 0.33)), sold: false }); }
    d.stock = { day, items }; store.save(); return items; }
  function buyStock(i) { const it = stock()[i], d = D(); if (!it || it.sold) return; if (d.coins < it.price) { S.toast('Not enough coins for that one.'); return; }
    d.coins -= it.price; it.sold = true; const s = adopt(it.slab, it.seller); logIt('Bought ' + s.title + ' from ' + it.seller, -it.price); store.save(); reracks(); hud(); S.sfx('ltPutDown'); S.toast('Bought from ' + it.seller + '. ' + (s.graded ? 'Filed in your case.' : 'Filed in your binder.')); }

  /* an offer on the market's own stock: near the ask they take it, a fair way under they meet you halfway, a lowball gets a no */
  function bidStock(i, amt) { const it = stock()[i], d = D(); if (!it || it.sold) return; amt = Math.round(amt); if (amt > d.coins) { S.toast('You don\'t have that many coins.'); return; }
    const r = amt / it.price; if (r >= 0.95) { it.price = amt; buyStock(i); return; }
    if (r >= 0.8) { it.counter = Math.round((amt + it.price) / 2 / 5) * 5; store.save(); S.toast(it.seller + ' came back with ' + fmt(it.counter) + ' coins.'); return; }
    S.toast(it.seller + ' turned that down. Try nearer ' + fmt(Math.round(it.price * 0.9)) + '.'); }
  /* ---------- other players: shelves and offers (Supabase, through the host) ---------- */
  const R = { me: null, lobby: null, shelves: [], offers: [], pubSig: '', busy: false, err: '' };
  const live = () => { const h = H(); return !!(h && h.can && h.can()); };
  const lean = s => { const o = JSON.parse(JSON.stringify(s)); delete o.pending; if (o.photo && o.photo.url && /^(data|blob):/.test(o.photo.url)) o.photo = { painted: true, plate: o.photo.plate || 1, title: o.photo.title, pack: o.photo.pack }; return o; };
  async function whoami(fresh) { if (R.me && !fresh) return R.me; const h = H(), me = await h.me(), lob = h.lobby(); if (!R.me || !me || me.id !== R.me.id || lob !== R.lobby) R.pubSig = ''; R.me = me; R.lobby = lob; return R.me; }
  async function publish(force) { if (!live()) return; try { await whoami(); if (!R.me) return; const cards = owned().map(lean), sig = R.lobby + '|' + cards.map(c => c.id + c.grade + c.graded).join(',');
    if (!force && sig === R.pubSig) return; await H().rest('studium_trade_shelves?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates', body: { user_id: R.me.id, lobby: R.lobby, name: R.me.name, cards, updated_at: new Date().toISOString() } }); R.pubSig = sig; R.err = ''; }
    catch (e) { R.err = 'Trading needs the market set up on the server (docs/supabase.sql).'; } }
  async function loadShelves() { if (!live()) return []; await whoami(); const lob = encodeURIComponent(R.lobby); R.shelves = ((await H().rest('studium_trade_shelves?lobby=eq.' + lob + '&select=user_id,name,cards,updated_at&order=updated_at.desc&limit=60')) || []).filter(x => !R.me || x.user_id !== R.me.id); return R.shelves; }
  async function loadOffers() { if (!live()) return []; await whoami(); if (!R.me) return []; const id = R.me.id;
    R.offers = (await H().rest('studium_trade_offers?or=(from_id.eq.' + id + ',to_id.eq.' + id + ')&order=created_at.desc&limit=60')) || []; return R.offers; }
  /* only from the status we expect (open, or accepted for done): a stale button can't undo the other player's answer; true when it changed */
  const patch = (id, body, from) => H().rest('studium_trade_offers?id=eq.' + id + '&status=eq.' + (from || 'open'), { method: 'PATCH', prefer: 'return=representation', body: { ...body, updated_at: new Date().toISOString() } }).then(r => !!(r && r.length));
  /* send: my side goes into escrow first, so it can't be spent while it waits */
  async function send(to, give, want) { const d = D(); await whoami(); if (!R.me) throw new Error('not signed in');
    if ((give.coins || 0) > d.coins) throw new Error('You don\'t have that many coins.');
    const gCards = give.ids.map(id => store.pull(id)).filter(Boolean).map(lean), wCards = want.cards.map(lean);
    const rows = await H().rest('studium_trade_offers', { method: 'POST', prefer: 'return=representation', body: { lobby: R.lobby, from_id: R.me.id, from_name: R.me.name, to_id: to.user_id, to_name: to.name, give: { coins: give.coins || 0, cards: gCards }, want: { coins: want.coins || 0, cards: wCards } } });
    const row = rows && rows[0]; if (!row) throw new Error('The offer didn\'t send.');
    d.coins -= give.coins || 0; d.escrow[row.id] = { coins: give.coins || 0, cards: gCards }; give.ids.forEach(lift); store.save(); reracks(); publish(true); hud(); return row; }
  /* their offer to me: check I still have what they want and the coins they ask for, then swap */
  const acting = new Set();
  async function accept(o) { if (acting.has(o.id)) return false; acting.add(o.id); try { return await acceptNow(o); } finally { acting.delete(o.id); } }
  async function acceptNow(o) { const d = D(), mine = new Set(owned().map(s => s.id)), wc = (o.want && o.want.cards) || [];
    if (wc.some(c => !mine.has(c.id))) { S.toast('You no longer have everything they asked for.'); return false; }
    if ((o.want.coins || 0) > d.coins) { S.toast('You need ' + fmt(o.want.coins) + ' coins for this one.'); return false; }
    if (!(await patch(o.id, { status: 'accepted' }))) { S.toast('That offer has already ended.'); return false; }
    wc.forEach(c => { lift(c.id); store.discard(c.id); }); d.coins += (o.give.coins || 0) - (o.want.coins || 0); ((o.give && o.give.cards) || []).forEach(c => adopt(c, o.from_name)); d.seenOffers[o.id] = 'done';
    store.save(); reracks(); publish(true); hud(); S.sfx('ltPutDown'); S.toast('Trade done with ' + o.from_name + '.'); return true; }
  async function decline(o) { if (acting.has(o.id)) return; acting.add(o.id); try { await patch(o.id, { status: 'declined' }); D().seenOffers[o.id] = 'done'; store.save(); } finally { acting.delete(o.id); } }
  /* cancel: only if it was still open; if they answered first, the next poll settles it their way */
  async function cancel(o) { if (acting.has(o.id)) return; acting.add(o.id); try { if (await patch(o.id, { status: 'cancelled' })) settle(o, 'cancelled'); else { S.toast('They answered first.'); await poll(); } } finally { acting.delete(o.id); } }
  /* my offers that ended: accepted ones bring their side in; declined or cancelled ones give mine back */
  function settle(o, status) { const d = D(), e = d.escrow[o.id]; if (!e) return;
    if (status === 'accepted') { logIt('Trade with ' + o.to_name + ' went through', (o.want && o.want.coins) || 0); ((o.want && o.want.cards) || []).forEach(c => adopt(c, o.to_name)); d.coins += (o.want && o.want.coins) || 0; e.cards.forEach(c => store.discard(c.id)); S.toast(o.to_name + ' accepted your offer.', 'Market', () => open('offers')); patch(o.id, { status: 'done' }, 'accepted').catch(() => {}); }
    else { d.coins += e.coins || 0; e.cards.forEach(c => { if (store.pull(c.id)) file(c.id); else adopt(c, 'you'); }); if (status === 'declined') S.toast(o.to_name + ' said no to your offer. Your side is back with you.'); }
    delete d.escrow[o.id]; store.save(); reracks(); publish(true); hud(); }
  async function poll() { if (!live() || R.busy) return; R.busy = true;
    try { await whoami(true); await publish(); const list = await loadOffers(), d = D(); let fresh = 0;
      const held = Object.keys(d.escrow).filter(id => !list.some(o => o.id === id));   /* older than the newest sixty: fetched by id */
      if (held.length) { const more = (await H().rest('studium_trade_offers?id=in.(' + held.map(encodeURIComponent).join(',') + ')')) || []; more.forEach(o => { if (o.status !== 'open') settle(o, o.status === 'done' ? 'accepted' : o.status); }); }
      list.forEach(o => { if (R.me && o.from_id === R.me.id && d.escrow[o.id] && o.status !== 'open') settle(o, o.status === 'done' ? 'accepted' : o.status);
        if (R.me && o.to_id === R.me.id && o.status === 'open' && !d.seenOffers[o.id]) { d.seenOffers[o.id] = 'seen'; fresh++; } });
      if (fresh) { store.save(); S.toast(fresh === 1 ? 'You have a new trade offer.' : 'You have ' + fresh + ' new trade offers.', 'Look', () => open('offers')); } paintBtn(); }
    catch (e) { R.err = 'Trading needs the market set up on the server (docs/supabase.sql).'; } finally { R.busy = false; } }

  /* ---------- the exchange: a full-screen trading desk (Sam: "a serious proper trading platform interface") ----------
     Left: the desks (Market, Portfolio, Trade, Offers, Activity). Middle: the table for that desk. Right: the selected
     slab: Inspect in 3D, its price chart with a crosshair, its numbers, an order book, and what you can do with it. */
  S.css(CSS);
  const btn = S.el('button', 'mk-btn', ''); btn.type = 'button'; btn.id = 'skMk'; document.body.appendChild(btn);
  const el = S.el('div', 'mk', ''); el.id = 'skMarket'; document.body.appendChild(el);
  btn.addEventListener('click', () => (el.classList.contains('on') ? close() : open()));
  function paintBtn() { const on = S.unlocked(); btn.classList.toggle('on', on && !el.classList.contains('on')); if (!on) return; const d = D(), n = R.me ? R.offers.filter(o => o.to_id === R.me.id && o.status === 'open').length : 0;
    btn.innerHTML = '<span>EXCHANGE</span><b>' + fmt(d.coins) + '</b><em>coins</em>' + (n ? '<i>' + n + '</i>' : ''); }
  const U = { tab: 'market', sel: null, q: '', tier: 'all', sort: 'value', who: null, want: new Set(), give: new Set(), coinsGive: 0, coinsWant: 0, open: null, offerAmt: {} };
  const thumbs = new Map();
  function thumb(s) { const p = s.photo || {}; if (p.url && !/^blob:/.test(p.url)) return p.url; const k = 'p' + (p.plate || 1) + ':' + s.seed; if (thumbs.has(k)) return thumbs.get(k);
    let u = ''; try { const cv = S.paintPhoto(S.KINDS[(p.plate || 1) % S.KINDS.length], s.seed || 1, 240, 170); u = cv.toDataURL('image/jpeg', 0.75); } catch (e) {} thumbs.set(k, u); return u; }
  const tierOf = s => TIER[s.tier] || TIER.common, finName = s => (FINISH[finOf(s)] || {}).name || 'Plain';
  const pill = s => '<span class="x-tier" style="--tc:' + tierOf(s).color + '">' + tierOf(s).name + '</span>';
  const gradeTxt = s => s.graded ? 'PSA-style ' + s.grade : 'Raw';
  const chg = (a, b) => { const c = b ? a / b - 1 : 0; if (Math.abs(c) < 0.0005) return '<span class="x-ch fl">0.0%</span>'; return '<span class="x-ch ' + (c > 0 ? 'up' : 'dn') + '">' + (c > 0 ? '▲ ' : '▼ ') + Math.abs(c * 100).toFixed(1) + '%</span>'; };
  const d24 = s => chg(value(s), value(s, today() - 1)), d7 = s => chg(value(s), value(s, today() - 7));
  function spark(vals, w, h) { const mn = Math.min(...vals), mx = Math.max(...vals), n = vals.length - 1, up = vals[n] >= vals[0];
    const pts = vals.map((y, i) => (i / n * w).toFixed(1) + ',' + (h - 2 - (y - mn) / Math.max(1e-6, mx - mn) * (h - 4)).toFixed(1)).join(' ');
    return '<svg class="x-spark ' + (up ? 'up' : 'dn') + '" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><polyline points="' + pts + '"/></svg>'; }
  /* the big chart: 30 days, three gridlines with prices, day marks, a crosshair and tooltip on hover */
  function chart(s) { const h = history(s, 30), W = 560, Hh = 200, padL = 48, padR = 10, padT = 12, padB = 24, mn = Math.min(...h) * 0.97, mx = Math.max(...h) * 1.03;
    const X = i => padL + i / 29 * (W - padL - padR), Y = v => padT + (1 - (v - mn) / Math.max(1e-6, mx - mn)) * (Hh - padT - padB);
    const line = h.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' '), area = 'M' + X(0) + ',' + (Hh - padB) + ' L' + line.split(' ').join(' L') + ' L' + X(29) + ',' + (Hh - padB) + ' Z';
    let g = ''; for (let k = 0; k <= 2; k++) { const v = mn + (mx - mn) * k / 2, y = Y(v).toFixed(1); g += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" class="x-grid"/><text x="' + (padL - 8) + '" y="' + y + '" class="x-ax" text-anchor="end" dominant-baseline="middle">' + fmt(v) + '</text>'; }
    [[0, '30 days ago'], [15, '15 days'], [29, 'Today']].forEach(([i, t], k) => { g += '<text x="' + X(i).toFixed(1) + '" y="' + (Hh - 6) + '" class="x-ax" text-anchor="' + (k === 0 ? 'start' : k === 2 ? 'end' : 'middle') + '">' + t + '</text>'; });
    return '<div class="x-chart" data-chart="' + esc(JSON.stringify({ h, padL, padR, W })) + '"><svg viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none">' + g + '<path d="' + area + '" class="x-area"/><polyline points="' + line + '" class="x-line"/><line class="x-cross" x1="0" x2="0" y1="' + padT + '" y2="' + (Hh - padB) + '"/><circle class="x-dot" r="4" cx="-10" cy="-10"/></svg><div class="x-tip"></div></div>'; }
  el.addEventListener('mousemove', e => { const c = e.target.closest('.x-chart'); if (!c) return; const o = JSON.parse(c.dataset.chart), svg = c.querySelector('svg'), r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * o.W;
    const i = Math.max(0, Math.min(29, Math.round((sx - o.padL) / (o.W - o.padL - o.padR) * 29))), poly = c.querySelector('.x-line').getAttribute('points').split(' ')[i].split(','), cr = c.querySelector('.x-cross'), dot = c.querySelector('.x-dot'), tip = c.querySelector('.x-tip');
    cr.setAttribute('x1', poly[0]); cr.setAttribute('x2', poly[0]); dot.setAttribute('cx', poly[0]); dot.setAttribute('cy', poly[1]); c.classList.add('hov');
    tip.innerHTML = '<b>' + fmt(o.h[i]) + ' coins</b><span>' + (29 - i === 0 ? 'Today' : (29 - i) + ' day' + (29 - i === 1 ? '' : 's') + ' ago') + '</span>'; tip.style.left = Math.min(r.width - 120, Math.max(0, (+poly[0] / o.W) * r.width + 10)) + 'px'; });
  el.addEventListener('mouseleave', () => el.querySelectorAll('.x-chart.hov').forEach(c => c.classList.remove('hov')), true);
  el.addEventListener('mouseout', e => { const c = e.target.closest && e.target.closest('.x-chart'); if (c && !c.contains(e.relatedTarget)) c.classList.remove('hov'); });
  /* collectors' bids under a slab: the order book, steady for the day */
  function book(s) { const v = value(s), bids = [], r = k => h32(s.id + ':' + today() + ':' + k);
    for (let i = 0; i < 5; i++) bids.push({ who: BUYERS[Math.floor(r('w' + i) * BUYERS.length)], p: Math.round(v * (0.96 - i * 0.035 - r('p' + i) * 0.02)) });
    const asks = []; stock().forEach(it => { if (!it.sold && it.slab.tier === s.tier && finOf(it.slab) === finOf(s)) asks.push({ who: it.seller, p: it.price }); });
    D().listings.forEach(l => { const x = store.pull(l.id); if (x && x.tier === s.tier && finOf(x) === finOf(s)) asks.push({ who: 'you', p: l.price }); }); asks.sort((a, b) => a.p - b.p);
    return { bids, asks: asks.slice(0, 5) }; }
  /* the tier indices across the top of the market */
  const IDX = TIERS.map(t => ({ t, basket: [t.finish, ...Object.keys(FINISH).filter(f => h32(f + t.id) < 0.12).slice(0, 4)] }));
  const idxAt = (x, day) => x.basket.reduce((a, f) => a + drift(f, day), 0) / x.basket.length * BASE[x.t.id];

  async function open(tab) { if (!S.unlocked()) return; earn(); refillKeys(); simulate(); if (tab) U.tab = tab; el.classList.add('on'); paintBtn(); render();
    if (live() && (U.tab === 'trade' || U.tab === 'offers')) { try { if (U.tab === 'trade') await loadShelves(); await loadOffers(); } catch (e) { R.err = SETUP; } render(); } }
  function close() { el.classList.remove('on'); paintBtn(); }
  const SETUP = 'Trading with other players isn\'t switched on yet: the trade tables need setting up on the server (docs/supabase.sql).';
  /* what is selected, as a slab and where it came from */
  function selected() { const s = U.sel; if (!s) return null;
    if (s.kind === 'stock') { const it = stock()[s.i]; return it ? { slab: it.slab, kind: 'stock', it } : null; }
    if (s.kind === 'mine') { const x = store.pull(s.id); return x ? { slab: x, kind: 'mine', l: D().listings.find(l => l.id === s.id) } : null; }
    if (s.kind === 'theirs') { const x = U.who && (U.who.cards || []).find(c => c.id === s.id); return x ? { slab: x, kind: 'theirs' } : null; }
    if (s.kind === 'card') return { slab: s.slab, kind: 'card' }; return null; }
  const TABS = [['market', 'Market', '◧'], ['portfolio', 'Portfolio', '▤'], ['trade', 'Trade', '⇄'], ['offers', 'Offers', '✉'], ['activity', 'Activity', '≡']];
  function render() { const d = D(), sel = selected(), st = el.querySelector('.x-main'), keep = st ? st.scrollTop : 0;
    const tick = d.sales.slice(0, 6).map(x => '<span>' + esc(x.title) + ' <b>' + fmt(x.price) + '</b> to ' + esc(x.buyer) + '</span>').concat(stock().filter(it => !it.sold).slice(0, 8).map(it => '<span>' + esc(it.slab.title) + ' ' + d24(it.slab) + ' <b>' + fmt(it.price) + '</b></span>')).join('');
    let h = '<header class="x-top"><div class="x-brand"><b>STUDIUM</b><span>EXCHANGE</span></div><div class="x-tick"><div>' + tick + tick + '</div></div>'
      + '<div class="x-wal"><div><span>Coins</span><b>' + fmt(d.coins) + '</b></div><div><span>Keys</span><b>' + (S.dev.opt('keys') === 'free' ? '∞' : d.keys) + '</b></div><button type="button" class="x-btn" data-a="key">Buy a key · ' + KEY_PRICE + '</button><button type="button" class="x-x" data-a="close" aria-label="Close the exchange">×</button></div></header>';
    h += '<nav class="x-nav">' + TABS.map(([k, n, ic]) => '<button type="button" data-tab="' + k + '" class="' + (U.tab === k ? 'on' : '') + '"><i>' + ic + '</i>' + n + (k === 'offers' ? badge() : '') + '</button>').join('')
      + '<div class="x-navfoot">Earn coins in Studium: ' + PER_ACH + ' an achievement level, ' + PER_QUEST + ' a quest. The market keeps ' + Math.round(FEE * 100) + '% of a sale.</div></nav>';
    h += '<main class="x-main">' + ({ market: vMarket, portfolio: vPortfolio, trade: vTrade, offers: vOffers, activity: vActivity }[U.tab] || vMarket)() + '</main>';
    h += '<aside class="x-side' + (sel ? ' on' : '') + '">' + (sel ? vDetail(sel) : '<div class="x-empty">Pick a slab to see its chart, its order book and what you can do with it.</div>') + '</aside>';
    el.innerHTML = h; const m = el.querySelector('.x-main'); if (m) m.scrollTop = keep; paintBtn(); }
  const badge = () => { if (!R.me) return ''; const n = R.offers.filter(o => o.to_id === R.me.id && o.status === 'open').length; return n ? '<i class="x-badge">' + n + '</i>' : ''; };
  /* ---- Market ---- */
  function vMarket() { const day = today();
    let h = '<div class="x-idx">' + IDX.map(x => { const v = idxAt(x, day), v7 = idxAt(x, day - 7); return '<button type="button" class="x-ic' + (U.tier === x.t.id ? ' on' : '') + '" data-a="tier" data-v="' + x.t.id + '" style="--tc:' + x.t.color + '"><span>' + x.t.name.toUpperCase() + ' INDEX</span><b>' + fmt(v) + '</b>' + chg(v, v7) + spark(Array.from({ length: 30 }, (_, i) => idxAt(x, day - 29 + i)), 120, 26) + '</button>'; }).join('') + '</div>';
    let rows = stock().map((it, i) => ({ it, i })).filter(({ it }) => (U.tier === 'all' || it.slab.tier === U.tier) && (!U.q || (it.slab.title + ' ' + finName(it.slab) + ' ' + it.seller).toLowerCase().includes(U.q.toLowerCase())));
    const key = { value: r => -r.it.price, cheap: r => r.it.price, move: r => -(value(r.it.slab) / value(r.it.slab, day - 1)), tier: r => -BASE[r.it.slab.tier] }[U.sort] || (r => 0); rows.sort((a, b) => key(a) - key(b));
    h += '<div class="x-bar"><input type="search" placeholder="Search titles, finishes, sellers" value="' + esc(U.q) + '" data-in="q"><div class="x-seg">' + [['all', 'All tiers']].concat(TIERS.map(t => [t.id, t.name])).map(([k, n]) => '<button type="button" data-a="tier" data-v="' + k + '" class="' + (U.tier === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div>'
      + '<select data-in="sort"><option value="value"' + (U.sort === 'value' ? ' selected' : '') + '>Price, high to low</option><option value="cheap"' + (U.sort === 'cheap' ? ' selected' : '') + '>Price, low to high</option><option value="move"' + (U.sort === 'move' ? ' selected' : '') + '>Biggest movers</option><option value="tier"' + (U.sort === 'tier' ? ' selected' : '') + '>Rarest first</option></select></div>';
    h += '<table class="x-tbl"><thead><tr><th></th><th>Slab</th><th>Tier</th><th>Grade</th><th class="r">Ask</th><th class="r">Value</th><th class="r">24 h</th><th>7 days</th><th>Seller</th><th></th></tr></thead><tbody>'
      + (rows.length ? rows.map(({ it, i }) => { const s = it.slab, on = U.sel && U.sel.kind === 'stock' && U.sel.i === i;
        return '<tr class="' + (on ? 'on' : '') + (it.sold ? ' sold' : '') + '" data-a="sel" data-k="stock" data-i="' + i + '"><td><span class="x-th" style="background-image:url(\'' + esc(thumb(s)) + '\')"></span></td><td><b>' + esc(s.title) + '</b><small>' + esc(finName(s)) + (s.variant ? ' · ' + esc(s.variant) : '') + '</small></td><td>' + pill(s) + '</td><td class="m">' + (s.graded ? s.grade : 'Raw') + '</td>'
          + '<td class="r m">' + (it.sold ? 'Sold' : fmt(it.price)) + '</td><td class="r m dim">' + fmt(value(s)) + '</td><td class="r">' + d24(s) + '</td><td>' + spark(history(s, 7), 70, 22) + '</td><td class="dim">' + esc(it.seller) + '</td><td><button type="button" class="x-mini" data-a="inspect" data-k="stock" data-i="' + i + '">Inspect</button></td></tr>'; }).join('') : '<tr><td colspan="10" class="x-none">Nothing matches. Try another tier or search.</td></tr>') + '</tbody></table>';
    return h; }
  /* ---- Portfolio ---- */
  function vPortfolio() { const d = D(), mine = owned(), listed = d.listings.map(l => ({ l, s: store.pull(l.id) })).filter(x => x.s), all = mine.concat(listed.map(x => x.s));
    const tv = all.reduce((a, s) => a + value(s), 0), tv7 = all.reduce((a, s) => a + value(s, today() - 7), 0), place = s => ({ vault: 'Case', display: 'Shelf', binder: 'Binder', table: 'Table' }[store.where(s.id)] || 'Loose');
    let h = '<div class="x-stats"><div><span>Collection value</span><b>' + fmt(tv) + '</b>' + chg(tv, tv7) + '<em>this week</em></div><div><span>Coins</span><b>' + fmt(d.coins) + '</b></div><div><span>Net worth</span><b>' + fmt(tv + d.coins) + '</b></div><div><span>Slabs</span><b>' + all.length + '</b><em>' + listed.length + ' for sale</em></div></div>';
    if (listed.length) h += '<h3>For sale</h3><table class="x-tbl"><thead><tr><th></th><th>Slab</th><th>Tier</th><th class="r">Your ask</th><th class="r">Value</th><th>Interest</th><th></th></tr></thead><tbody>' + listed.map(({ l, s }) => { const r = l.price / value(s), hot = r <= 1 ? 'Strong' : r <= 1.12 ? 'Steady' : 'Slow';
      return '<tr data-a="sel" data-k="mine" data-id="' + s.id + '" class="' + (U.sel && U.sel.id === s.id ? 'on' : '') + '"><td><span class="x-th" style="background-image:url(\'' + esc(thumb(s)) + '\')"></span></td><td><b>' + esc(s.title) + '</b><small>' + esc(finName(s)) + '</small></td><td>' + pill(s) + '</td><td class="r m">' + fmt(l.price) + '</td><td class="r m dim">' + fmt(value(s)) + '</td><td>' + (l.offer ? '<span class="x-flag">Offer ' + fmt(l.offer.amount) + '</span>' : '<span class="x-int ' + hot.toLowerCase() + '">' + hot + '</span>') + '</td><td><button type="button" class="x-mini" data-a="unlist" data-id="' + s.id + '">Take down</button></td></tr>'; }).join('') + '</tbody></table>';
    h += '<h3>Holdings</h3><table class="x-tbl"><thead><tr><th></th><th>Slab</th><th>Tier</th><th>Grade</th><th class="r">Value</th><th class="r">7 days</th><th>30 days</th><th>Where</th><th></th></tr></thead><tbody>'
      + (mine.length ? mine.slice().sort((a, b) => value(b) - value(a)).map(s => '<tr data-a="sel" data-k="mine" data-id="' + s.id + '" class="' + (U.sel && U.sel.id === s.id ? 'on' : '') + '"><td><span class="x-th" style="background-image:url(\'' + esc(thumb(s)) + '\')"></span></td><td><b>' + esc(s.title) + '</b><small>' + esc(finName(s)) + (s.from ? ' · from ' + esc(s.from) : '') + '</small></td><td>' + pill(s) + '</td><td class="m">' + (s.graded ? s.grade : 'Raw') + '</td><td class="r m">' + fmt(value(s)) + '</td><td class="r">' + d7(s) + '</td><td>' + spark(history(s, 30), 90, 22) + '</td><td class="dim">' + place(s) + '</td><td><button type="button" class="x-mini" data-a="inspect" data-k="mine" data-id="' + s.id + '">Inspect</button></td></tr>').join('') : '<tr><td colspan="9" class="x-none">No slabs yet. Pull some, or buy from the Market.</td></tr>') + '</tbody></table>';
    return h; }
  /* ---- Trade: other players' collections and the deal ticket ---- */
  function vTrade() { if (!live()) return '<div class="x-note"><h3>Trade with other collectors</h3><p>Sign in with Google to trade. In a class you trade with your class; on the demo, with other demo players.</p>' + (R.err ? '<p class="x-err">' + esc(R.err) + '</p>' : '') + '</div>';
    if (R.err) return '<div class="x-note"><p class="x-err">' + esc(R.err) + '</p></div>';
    if (!U.who) return '<h3>' + (R.lobby === 'studium-lobby:open' ? 'Collectors on the demo' : 'Collectors in your class') + '</h3><table class="x-tbl"><thead><tr><th>Collector</th><th class="r">Slabs</th><th class="r">Collection value</th><th>Best slab</th><th></th></tr></thead><tbody>'
      + (R.shelves.length ? R.shelves.map((p, i) => { const cs = p.cards || [], best = cs.slice().sort((a, b) => value(b) - value(a))[0]; return '<tr data-a="who" data-i="' + i + '"><td><b>' + esc(p.name) + '</b></td><td class="r m">' + cs.length + '</td><td class="r m">' + fmt(cs.reduce((a, s) => a + value(s), 0)) + '</td><td>' + (best ? pill(best) + ' <small class="dim">' + esc(best.title) + '</small>' : '') + '</td><td><button type="button" class="x-mini">Open their collection</button></td></tr>'; }).join('') : '<tr><td colspan="5" class="x-none">Nobody else has their collection up yet. It appears here once they open Studium.</td></tr>') + '</tbody></table>';
    const p = U.who, theirs = p.cards || [], mine = owned(), wv = theirs.filter(s => U.want.has(s.id)).reduce((a, s) => a + value(s), 0) + U.coinsWant, gv = mine.filter(s => U.give.has(s.id)).reduce((a, s) => a + value(s), 0) + U.coinsGive;
    const side = (list, set, kind, title) => '<div class="x-col"><h3>' + title + '</h3><table class="x-tbl x-pick"><tbody>' + (list.length ? list.slice().sort((a, b) => value(b) - value(a)).map(s => '<tr class="' + (set.has(s.id) ? 'pk' : '') + (U.sel && U.sel.id === s.id ? ' on' : '') + '" data-a="sel" data-k="' + kind + '" data-id="' + esc(s.id) + '"><td><button type="button" class="x-chk' + (set.has(s.id) ? ' on' : '') + '" data-a="' + (kind === 'theirs' ? 'want' : 'give') + '" data-id="' + esc(s.id) + '" aria-label="Add to the offer">' + (set.has(s.id) ? '✓' : '+') + '</button></td><td><span class="x-th" style="background-image:url(\'' + esc(thumb(s)) + '\')"></span></td><td><b>' + esc(s.title) + '</b><small>' + pill(s) + ' ' + esc(finName(s)) + ' · ' + (s.graded ? s.grade : 'Raw') + '</small></td><td class="r m">' + fmt(value(s)) + '</td></tr>').join('') : '<tr><td class="x-none">Nothing here.</td></tr>') + '</tbody></table></div>';
    const bal = gv + wv ? wv / (gv + wv) : 0.5, fair = Math.abs(bal - 0.5) < 0.08 ? 'A fair swap' : bal > 0.5 ? 'You come out ahead' : 'They come out ahead';
    return '<div class="x-crumb"><button type="button" class="x-mini" data-a="back">‹ All collectors</button><h3>Trading with ' + esc(p.name) + '</h3></div><div class="x-cols">' + side(theirs, U.want, 'theirs', 'Their collection') + side(mine, U.give, 'mine', 'Your collection') + '</div>'
      + '<div class="x-ticket"><div><span>You get</span><b>' + U.want.size + ' slab' + (U.want.size === 1 ? '' : 's') + '</b><label>+ <input type="number" min="0" step="10" value="' + U.coinsWant + '" data-in="cw"> coins</label><em>worth about ' + fmt(wv) + '</em></div>'
      + '<div class="x-fair"><div class="x-fbar"><i style="left:' + (bal * 100).toFixed(1) + '%"></i></div><span>' + fair + '</span></div>'
      + '<div><span>You give</span><b>' + U.give.size + ' slab' + (U.give.size === 1 ? '' : 's') + '</b><label>+ <input type="number" min="0" step="10" value="' + U.coinsGive + '" data-in="cg"> coins</label><em>worth about ' + fmt(gv) + '</em></div>'
      + '<button type="button" class="x-go" data-a="send"' + (U.want.size + U.give.size + U.coinsGive + U.coinsWant ? '' : ' disabled') + '>Send the offer</button></div>'; }
  /* ---- Offers ---- */
  function vOffers() { if (!live()) return vTrade(); if (R.err) return '<div class="x-note"><p class="x-err">' + esc(R.err) + '</p></div>';
    if (!R.offers.length) return '<div class="x-note"><h3>Offers</h3><p>No offers yet. Open a collector in Trade to make one.</p></div>';
    const side = x => { const c = (x && x.cards) || [], n = x && x.coins || 0; return (c.length ? c.length + ' slab' + (c.length === 1 ? '' : 's') : '') + (c.length && n ? ' + ' : '') + (n ? fmt(n) + ' coins' : '') || 'Nothing'; };
    const val = x => ((x && x.cards) || []).reduce((a, s) => a + value(s), 0) + ((x && x.coins) || 0);
    return '<h3>Offers</h3><table class="x-tbl x-off"><thead><tr><th>With</th><th></th><th>You get</th><th>You give</th><th class="r">Balance</th><th>Status</th><th></th></tr></thead><tbody>' + R.offers.map(o => { const out = R.me && o.from_id === R.me.id, get = out ? o.want : o.give, give = out ? o.give : o.want, bal = val(get) - val(give);
      const stt = { open: out ? 'Waiting' : 'For you', accepted: 'Done', done: 'Done', declined: 'Declined', cancelled: 'Cancelled' }[o.status], opened = U.open === o.id;
      let row = '<tr class="' + (opened ? 'on' : '') + '" data-a="openoffer" data-o="' + o.id + '"><td><b>' + esc(out ? o.to_name : o.from_name) + '</b></td><td class="dim">' + (out ? 'Sent' : 'Received') + '</td><td>' + side(get) + '</td><td>' + side(give) + '</td><td class="r">' + (bal ? '<span class="x-ch ' + (bal > 0 ? 'up' : 'dn') + '">' + (bal > 0 ? '+' : '−') + fmt(Math.abs(bal)) + '</span>' : '<span class="x-ch fl">Even</span>') + '</td><td><span class="x-st ' + o.status + (o.status === 'open' && !out ? ' you' : '') + '">' + stt + '</span></td><td class="x-acts">'
        + (o.status === 'open' ? (out ? '<button type="button" class="x-mini" data-a="cancel" data-o="' + o.id + '">Cancel</button>' : '<button type="button" class="x-go sm" data-a="accept" data-o="' + o.id + '">Accept</button><button type="button" class="x-mini" data-a="counter" data-o="' + o.id + '">Counter</button><button type="button" class="x-mini" data-a="decline" data-o="' + o.id + '">Decline</button>') : '') + '</td></tr>';
      if (opened) row += '<tr class="x-exp"><td colspan="7"><div class="x-cols"><div class="x-col"><h4>You get</h4>' + cardList((get && get.cards) || []) + ((get && get.coins) ? '<p class="m">+ ' + fmt(get.coins) + ' coins</p>' : '') + '</div><div class="x-col"><h4>You give</h4>' + cardList((give && give.cards) || []) + ((give && give.coins) ? '<p class="m">+ ' + fmt(give.coins) + ' coins</p>' : '') + '</div></div></td></tr>';
      return row; }).join('') + '</tbody></table>'; }
  const cardList = list => list.length ? '<table class="x-tbl"><tbody>' + list.map(s => '<tr data-a="selcard" data-card="' + esc(JSON.stringify(s)) + '"><td><span class="x-th" style="background-image:url(\'' + esc(thumb(s)) + '\')"></span></td><td><b>' + esc(s.title) + '</b><small>' + pill(s) + ' ' + esc(finName(s)) + ' · ' + (s.graded ? s.grade : 'Raw') + '</small></td><td class="r m">' + fmt(value(s)) + '</td><td><button type="button" class="x-mini" data-a="inspectcard" data-card="' + esc(JSON.stringify(s)) + '">Inspect</button></td></tr>').join('') + '</tbody></table>' : '<p class="dim">No slabs.</p>';
  /* ---- Activity ---- */
  function vActivity() { const d = D(), log = (d.log || []);
    return '<h3>Activity</h3><table class="x-tbl"><thead><tr><th>When</th><th>What</th><th class="r">Coins</th></tr></thead><tbody>' + (log.length ? log.slice(0, 80).map(x => '<tr><td class="dim m">' + new Date(x.at).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + '</td><td>' + esc(x.text) + '</td><td class="r">' + (x.coins ? '<span class="x-ch ' + (x.coins > 0 ? 'up' : 'dn') + '">' + (x.coins > 0 ? '+' : '−') + fmt(Math.abs(x.coins)) + '</span>' : '') + '</td></tr>').join('') : '<tr><td colspan="3" class="x-none">Nothing yet. Buys, sales, trades and coins you earn show up here.</td></tr>') + '</tbody></table>'; }
  /* ---- the detail pane ---- */
  function vDetail(x) { const s = x.slab, v = value(s), hi = Math.max(...history(s, 30)), lo = Math.min(...history(s, 30)), b = book(s), d = D();
    let h = '<div class="x-dh"><button type="button" class="x-x" data-a="unsel" aria-label="Close">×</button><div class="x-hero" style="background-image:url(\'' + esc(thumb(s)) + '\');--tc:' + tierOf(s).color + '"><button type="button" class="x-insp" data-a="inspectsel">Inspect in 3D</button></div>'
      + '<h2>' + esc(s.title) + '</h2><p class="x-sub">' + pill(s) + ' ' + esc(finName(s)) + ' · ' + gradeTxt(s) + (s.variant ? ' · ' + esc(s.variant) : '') + (s.cert ? ' · ' + esc(s.cert) : '') + '</p>'
      + '<div class="x-px"><b>' + fmt(x.kind === 'stock' ? x.it.price : v) + '</b><span>' + (x.kind === 'stock' ? 'asking' : 'market value') + '</span>' + d24(s) + '<em>24 h</em>' + d7(s) + '<em>7 days</em></div></div>' + chart(s)
      + '<div class="x-kv"><div><span>Market value</span><b>' + fmt(v) + '</b></div><div><span>30 day high</span><b>' + fmt(hi) + '</b></div><div><span>30 day low</span><b>' + fmt(lo) + '</b></div><div><span>Best bid</span><b>' + fmt(b.bids[0].p) + '</b></div></div>';
    h += '<div class="x-book"><div><h4>Bids</h4>' + b.bids.map(r => '<p><span>' + esc(r.who) + '</span><b class="up">' + fmt(r.p) + '</b></p>').join('') + '</div><div><h4>Asks</h4>' + (b.asks.length ? b.asks.map(r => '<p><span>' + esc(r.who) + '</span><b class="dn">' + fmt(r.p) + '</b></p>').join('') : '<p class="dim">None for sale right now.</p>') + '</div></div>';
    h += '<div class="x-act">';
    if (x.kind === 'stock') { const it = x.it, amt = U.offerAmt[U.sel.i] ?? Math.round(it.price * 0.92);
      h += it.sold ? '<p class="dim">Sold.</p>' : '<button type="button" class="x-go" data-a="buy"' + (d.coins < it.price ? ' disabled' : '') + '>Buy now for ' + fmt(it.price) + '</button>' + (d.coins < it.price ? '<p class="x-hint">You need ' + fmt(it.price - d.coins) + ' more coins.</p>' : '')
        + '<div class="x-row2"><label>Offer <input type="number" min="1" value="' + amt + '" data-in="offer"> coins</label><button type="button" class="x-btn" data-a="bid">Make an offer</button></div>' + (it.counter ? '<p class="x-hint">' + esc(it.seller) + ' would take ' + fmt(it.counter) + '. <button type="button" class="x-link" data-a="takecounter">Buy at ' + fmt(it.counter) + '</button></p>' : ''); }
    else if (x.kind === 'mine') { if (x.l) { h += '<p class="x-hint">For sale at ' + fmt(x.l.price) + '. ' + (x.l.offer ? esc(x.l.offer.buyer) + ' offers ' + fmt(x.l.offer.amount) + '.' : 'Waiting on a buyer.') + '</p>' + (x.l.offer ? '<button type="button" class="x-go" data-a="takeoffer" data-id="' + s.id + '">Sell to ' + esc(x.l.offer.buyer) + ' for ' + fmt(x.l.offer.amount) + '</button>' : '') + '<button type="button" class="x-btn" data-a="unlist" data-id="' + s.id + '">Take it down</button>'; }
      else { const p = U.offerAmt['l' + s.id] ?? v, r = p / v, eta = r <= 0.9 ? 'within hours' : r <= 1.02 ? 'within a day or so' : r <= 1.15 ? 'in a few days' : 'slowly, or draws an offer';
        h += '<div class="x-row2"><label>Ask <input type="number" min="1" value="' + p + '" data-in="ask" data-id="' + s.id + '"> coins</label><button type="button" class="x-go" data-a="list" data-id="' + s.id + '">List for sale</button></div><p class="x-hint">At this price it should sell ' + eta + '. You keep ' + fmt(p * (1 - FEE)) + ' after the ' + Math.round(FEE * 100) + '% fee.</p>'; } }
    else if (x.kind === 'theirs') { const on = U.want.has(s.id); h += '<button type="button" class="' + (on ? 'x-btn' : 'x-go') + '" data-a="want" data-id="' + esc(s.id) + '">' + (on ? 'Take it out of the offer' : 'Add to the offer') + '</button>'; }
    return h + '</div>'; }
  /* ---- inspect: any slab, yours or not, up in the close view; nothing in your collection moves ---- */
  async function inspect(slab) { if (!slab || S.inspect.active()) return; const s = JSON.parse(JSON.stringify(slab)); el.classList.add('peek');
    let obj = null; try { obj = S.objFor(s); const cam = S.camera, g = obj.group, p = new THREE.Vector3(0, -0.6, -6).applyMatrix4(cam.matrixWorld); S.scene.add(g); g.position.copy(p); g.quaternion.copy(cam.quaternion); g.scale.setScalar(0.2);
      await Promise.race([obj.ready ? obj.ready.catch(() => null) : null, S.T.wait(4)]);
      const r = S.inspect.open(obj, { zoom: 1.3, actions: [{ id: 'back', label: 'Back to the exchange', primary: true }], hint: S.specLine(s) + '\nWorth about ' + fmt(value(s)) + ' coins. Drag to turn it, scroll to zoom.' }); await r;
      while (S.inspect.active()) await S.T.wait(0.05); }
    catch (e) { console.error('inspect', e); } finally { if (obj) { try { S.slabs.drop(obj); } catch (e) {} } el.classList.remove('peek'); } }
  el.addEventListener('input', e => { const i = e.target.closest('[data-in]'); if (!i) return; const k = i.dataset.in, v = Math.max(0, Math.round(+i.value || 0));
    if (k === 'cg') U.coinsGive = v; else if (k === 'cw') U.coinsWant = v; else if (k === 'q') { U.q = i.value; const pos = i.selectionStart; render(); const n = el.querySelector('[data-in="q"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
    else if (k === 'offer') U.offerAmt[U.sel.i] = v; else if (k === 'ask') U.offerAmt['l' + i.dataset.id] = v;
    if (k === 'cg' || k === 'cw' || k === 'ask') { const pos = i.selectionStart; render(); const n = el.querySelector('[data-in="' + k + '"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } } });
  el.addEventListener('change', e => { const i = e.target.closest('select[data-in="sort"]'); if (i) { U.sort = i.value; render(); } });
  el.addEventListener('click', async e => { const t = e.target.closest('[data-tab],[data-a]'); if (!t || t.disabled) return; e.stopPropagation(); const a = t.dataset.a;
    if (t.dataset.tab) { U.tab = t.dataset.tab; U.sel = null; if (U.tab !== 'trade') U.who = null; open(); return; }
    try {
      if (a === 'close') close();
      else if (a === 'key') { buyKey(); render(); }
      else if (a === 'tier') { U.tier = U.tier === t.dataset.v ? 'all' : t.dataset.v; render(); }
      else if (a === 'sel') { const k = t.dataset.k; U.sel = k === 'stock' ? { kind: 'stock', i: +t.dataset.i } : { kind: k, id: t.dataset.id }; render(); }
      else if (a === 'selcard') { U.sel = { kind: 'card', slab: JSON.parse(t.dataset.card), id: null }; render(); }
      else if (a === 'unsel') { U.sel = null; render(); }
      else if (a === 'inspect') { const k = t.dataset.k; inspect(k === 'stock' ? (stock()[+t.dataset.i] || {}).slab : store.pull(t.dataset.id)); }
      else if (a === 'inspectcard') inspect(JSON.parse(t.dataset.card));
      else if (a === 'inspectsel') { const x = selected(); if (x) inspect(x.slab); }
      else if (a === 'buy') { buyStock(U.sel.i); render(); }
      else if (a === 'bid') { bidStock(U.sel.i, U.offerAmt[U.sel.i] ?? Math.round(stock()[U.sel.i].price * 0.92)); render(); }
      else if (a === 'takecounter') { const it = stock()[U.sel.i]; if (it && it.counter) { it.price = it.counter; it.counter = null; buyStock(U.sel.i); } render(); }
      else if (a === 'list') { const s = store.pull(t.dataset.id); list(t.dataset.id, U.offerAmt['l' + t.dataset.id] ?? value(s)); U.sel = null; render(); }
      else if (a === 'unlist') { unlist(t.dataset.id); render(); }
      else if (a === 'takeoffer') { const l = D().listings.find(x => x.id === t.dataset.id); if (l && l.offer) sell(l, l.offer.amount, l.offer.buyer); U.sel = null; render(); }
      else if (a === 'who') { U.who = R.shelves[+t.dataset.i]; U.sel = null; U.want.clear(); U.give.clear(); U.coinsGive = U.coinsWant = 0; render(); }
      else if (a === 'back') { U.who = null; U.sel = null; render(); }
      else if (a === 'want' || a === 'give') { const set = a === 'want' ? U.want : U.give, id = t.dataset.id; set.has(id) ? set.delete(id) : set.add(id); render(); }
      else if (a === 'send') { const p = U.who; t.disabled = true; await send(p, { ids: [...U.give], coins: U.coinsGive }, { cards: (p.cards || []).filter(s => U.want.has(s.id)), coins: U.coinsWant }); logIt('Offer sent to ' + p.name, -U.coinsGive); S.toast('Offer sent to ' + p.name + '. Your side is held safely until they answer.'); U.who = null; U.sel = null; U.tab = 'offers'; await loadOffers(); render(); }
      else if (a === 'openoffer') { U.open = U.open === t.dataset.o ? null : t.dataset.o; render(); }
      else { const o = R.offers.find(x => x.id === t.dataset.o); if (!o) return;
        if (a === 'accept') { t.disabled = true; if (await accept(o)) logIt('Trade with ' + o.from_name, (o.give.coins || 0) - (o.want.coins || 0)); await loadOffers(); render(); }
        else if (a === 'decline') { await decline(o); await loadOffers(); render(); }
        else if (a === 'cancel') { await cancel(o); await loadOffers(); render(); }
        else if (a === 'counter') { await decline(o); await loadShelves(); const sh = R.shelves.find(x => x.user_id === o.from_id) || { user_id: o.from_id, name: o.from_name, cards: [] }, have = new Set((sh.cards || []).map(c => c.id));
          const p = { ...sh, cards: (sh.cards || []).concat(((o.give && o.give.cards) || []).filter(c => !have.has(c.id))) };   /* what they offered is held aside, off their shelf: ask for it from the offer */
          U.who = p; U.want = new Set(((o.give && o.give.cards) || []).map(c => c.id)); U.give = new Set(((o.want && o.want.cards) || []).map(c => c.id)); U.coinsGive = (o.want && o.want.coins) || 0; U.coinsWant = (o.give && o.give.coins) || 0; U.tab = 'trade'; U.sel = null; render(); } }
    } catch (err) { S.toast(err && err.message && !/^sync/.test(err.message) ? err.message : 'That didn\'t go through. Check you\'re online and try again.'); render(); } });
  ['pointerdown', 'wheel', 'keydown'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('on') && !S.inspect.active()) { if (U.sel) { U.sel = null; render(); } else close(); } }, true);

  /* ---------- the heartbeat ---------- */
  setInterval(() => { if (!S.unlocked()) { paintBtn(); return; } earn(); simulate(); if (el.classList.contains('on') && U.tab !== 'players') render(); }, 20000);
  setInterval(() => { if (S.unlocked()) poll(); }, 30000);
  setTimeout(() => { if (S.unlocked()) { earn(true); refillKeys(); simulate(); poll(); } paintBtn(); }, 1500);
  /* coins from elsewhere in the layer (Who Shot It? wins): logged like the rest */
  function award(n, text) { const d = D(); n = Math.max(0, Math.round(n)); if (!n) return; d.coins += n; logIt(text, n); store.save(); hud(); S.toast('+' + fmt(n) + ' coins. ' + text + '.'); }
  S.market = { value, history, spendKey, buyKey, open, close, earn, poll, award, owned, keys: () => (S.dev.opt('keys') === 'free' ? '∞' : D().keys), coins: () => D().coins, paint: paintBtn,
    __sim: (hrs) => { D().listings.forEach(l => { l.t = Date.now() - hrs * 36e5; }); simulate(); } };
}

const CSS = `
#skMk{ position:fixed; right:max(16px, env(safe-area-inset-right,0px)); bottom:calc(40px + env(safe-area-inset-bottom,0px)); display:none; align-items:baseline; gap:8px; font:500 10px/1 var(--f-mono); letter-spacing:.14em; color:var(--text); background:rgba(14,13,12,.9); border:1px solid rgba(227,173,87,.5); border-radius:6px; padding:9px 12px; cursor:pointer; z-index:12; }
#skMk.on{ display:flex; } #skMk:hover{ border-color:var(--accent); } #skMk span{ color:var(--accent); } #skMk b{ font:500 13px/1 var(--f-mono); letter-spacing:0; } #skMk em{ font-style:normal; color:var(--faint); }
#skMk i{ font-style:normal; background:#e8574a; color:#fff; border-radius:999px; padding:2px 6px; }
#skMarket{ --x-bg:#0d0c0b; --x-p:#141311; --x-p2:#1a1916; --x-ln:rgba(244,241,234,.08); --x-ln2:rgba(244,241,234,.14); --x-mut:rgba(244,241,234,.52); --x-up:#5fcf86; --x-dn:#ff7a6b;
  position:fixed; inset:0; z-index:14; display:grid; grid-template-columns:188px minmax(0,1fr) 400px; grid-template-rows:56px minmax(0,1fr); background:var(--x-bg); color:var(--text); font:400 13px/1.4 var(--f-ui); opacity:0; pointer-events:none; transition:opacity .2s; }
#skMarket.on{ opacity:1; pointer-events:auto; } #skMarket.on.peek{ opacity:0 !important; visibility:hidden; pointer-events:none; }
#skMarket .m{ font-family:var(--f-mono); font-variant-numeric:tabular-nums; } #skMarket .r{ text-align:right; } #skMarket .dim{ color:var(--x-mut); }
#skMarket h2{ margin:10px 0 2px; font:400 22px/1.15 var(--f-serif, Georgia, serif); } #skMarket h3{ margin:22px 0 10px; font:500 11px/1 var(--f-mono); letter-spacing:.18em; text-transform:uppercase; color:var(--x-mut); } #skMarket h4{ margin:0 0 8px; font:500 10px/1 var(--f-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--x-mut); }
#skMarket .x-top{ grid-column:1/-1; display:flex; align-items:center; gap:18px; padding:0 14px 0 18px; border-bottom:1px solid var(--x-ln); background:var(--x-p); }
#skMarket .x-brand{ display:flex; flex-direction:column; line-height:1; } #skMarket .x-brand b{ font:600 13px var(--f-mono); letter-spacing:.24em; } #skMarket .x-brand span{ font:500 9px var(--f-mono); letter-spacing:.32em; color:var(--accent); margin-top:4px; }
#skMarket .x-tick{ flex:1; overflow:hidden; mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent); } #skMarket .x-tick>div{ display:inline-flex; gap:28px; white-space:nowrap; animation:xtick 60s linear infinite; font:500 11px var(--f-mono); color:var(--x-mut); }
#skMarket .x-tick b{ color:var(--text); font-weight:500; } @keyframes xtick{ from{ transform:translateX(0); } to{ transform:translateX(-50%); } }
#skMarket .x-wal{ display:flex; align-items:center; gap:18px; } #skMarket .x-wal>div{ display:flex; flex-direction:column; align-items:flex-end; line-height:1.1; } #skMarket .x-wal span{ font:500 9px var(--f-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--x-mut); } #skMarket .x-wal b{ font:500 16px var(--f-mono); }
#skMarket .x-x{ width:32px; height:32px; border:1px solid var(--x-ln2); border-radius:6px; background:none; color:var(--x-mut); font-size:18px; cursor:pointer; } #skMarket .x-x:hover{ color:var(--text); border-color:var(--text); }
#skMarket .x-nav{ display:flex; flex-direction:column; gap:2px; padding:14px 10px; border-right:1px solid var(--x-ln); background:var(--x-p); }
#skMarket .x-nav button{ display:flex; align-items:center; gap:10px; padding:10px 12px; border:0; border-radius:6px; background:none; color:var(--x-mut); font:500 13px var(--f-ui); text-align:left; cursor:pointer; }
#skMarket .x-nav button:hover{ color:var(--text); background:rgba(255,255,255,.03); } #skMarket .x-nav button.on{ color:var(--text); background:var(--x-p2); box-shadow:inset 2px 0 0 var(--accent); } #skMarket .x-nav i{ width:16px; font-style:normal; text-align:center; opacity:.8; }
#skMarket .x-navfoot{ margin-top:auto; padding:10px 8px; font-size:11px; color:var(--x-mut); line-height:1.45; } #skMarket .x-badge{ margin-left:auto; font:600 10px/1 var(--f-ui); background:#e8574a; color:#fff; border-radius:999px; padding:3px 7px; }
#skMarket .x-main{ overflow:auto; padding:16px 22px 40px; min-width:0; }
#skMarket .x-idx{ display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); gap:8px; }
#skMarket .x-ic{ display:grid; grid-template-columns:1fr auto; grid-template-rows:auto auto auto; gap:2px 8px; padding:10px 12px; border:1px solid var(--x-ln); border-top:2px solid var(--tc); border-radius:6px; background:var(--x-p); color:var(--text); text-align:left; cursor:pointer; }
#skMarket .x-ic.on{ border-color:var(--x-ln2); background:var(--x-p2); } #skMarket .x-ic span{ grid-column:1/-1; font:500 9px var(--f-mono); letter-spacing:.14em; color:var(--x-mut); } #skMarket .x-ic b{ font:500 17px var(--f-mono); } #skMarket .x-ic .x-ch{ align-self:center; } #skMarket .x-ic svg{ grid-column:1/-1; width:100%; }
#skMarket .x-bar{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:16px 0 10px; }
#skMarket .x-bar input{ flex:1; min-width:180px; height:34px; padding:0 12px; border-radius:6px; border:1px solid var(--x-ln2); background:var(--x-p); color:var(--text); font:400 13px var(--f-ui); }
#skMarket .x-bar select{ height:34px; padding:0 8px; border-radius:6px; border:1px solid var(--x-ln2); background:var(--x-p); color:var(--text); font:400 12.5px var(--f-ui); }
#skMarket .x-seg{ display:flex; border:1px solid var(--x-ln2); border-radius:6px; overflow:hidden; } #skMarket .x-seg button{ padding:0 10px; height:32px; border:0; border-right:1px solid var(--x-ln); background:none; color:var(--x-mut); font:500 12px var(--f-ui); cursor:pointer; } #skMarket .x-seg button:last-child{ border-right:0; } #skMarket .x-seg button.on{ background:var(--text); color:#141210; }
#skMarket .x-tbl{ width:100%; border-collapse:collapse; } #skMarket .x-tbl th{ position:sticky; top:-16px; z-index:1; background:var(--x-bg); padding:8px 10px; border-bottom:1px solid var(--x-ln2); font:500 9.5px var(--f-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--x-mut); text-align:left; white-space:nowrap; }
#skMarket .x-tbl td{ padding:7px 10px; border-bottom:1px solid var(--x-ln); vertical-align:middle; white-space:nowrap; } #skMarket .x-tbl tr[data-a]{ cursor:pointer; } #skMarket .x-tbl tbody tr:hover td{ background:rgba(255,255,255,.025); } #skMarket .x-tbl tr.on td{ background:rgba(227,173,87,.08); }
#skMarket .x-tbl tr.sold{ opacity:.4; } #skMarket .x-tbl td b{ display:block; font-weight:500; max-width:240px; overflow:hidden; text-overflow:ellipsis; } #skMarket .x-tbl td small{ display:block; color:var(--x-mut); font-size:11px; } #skMarket .x-none{ padding:28px 10px !important; color:var(--x-mut); text-align:center; white-space:normal !important; }
#skMarket .x-th{ display:block; width:46px; height:32px; border-radius:3px; background:#222 center/cover no-repeat; }
#skMarket .x-tier{ display:inline-flex; align-items:center; gap:6px; font:500 10px var(--f-mono); letter-spacing:.08em; text-transform:uppercase; color:var(--text); } #skMarket .x-tier::before{ content:''; width:7px; height:7px; border-radius:2px; background:var(--tc); }
#skMarket .x-ch{ font:500 11.5px var(--f-mono); font-variant-numeric:tabular-nums; } #skMarket .x-ch.up, #skMarket .up{ color:var(--x-up); } #skMarket .x-ch.dn, #skMarket .dn{ color:var(--x-dn); } #skMarket .x-ch.fl{ color:var(--x-mut); }
#skMarket .x-spark{ display:block; } #skMarket .x-spark polyline{ fill:none; stroke-width:1.5; stroke-linejoin:round; } #skMarket .x-spark.up polyline{ stroke:var(--x-up); } #skMarket .x-spark.dn polyline{ stroke:var(--x-dn); }
#skMarket .x-mini{ height:28px; padding:0 10px; border-radius:5px; border:1px solid var(--x-ln2); background:none; color:var(--text); font:500 11.5px var(--f-ui); cursor:pointer; } #skMarket .x-mini:hover{ border-color:var(--accent); color:var(--accent); }
#skMarket .x-btn{ height:34px; padding:0 14px; border-radius:6px; border:1px solid var(--x-ln2); background:var(--x-p2); color:var(--text); font:500 12.5px var(--f-ui); cursor:pointer; } #skMarket .x-btn:hover{ border-color:var(--text); }
#skMarket .x-go{ height:40px; padding:0 18px; border:0; border-radius:6px; background:var(--accent); color:#17130e; font:600 13px var(--f-ui); cursor:pointer; } #skMarket .x-go.sm{ height:28px; padding:0 12px; font-size:12px; } #skMarket .x-go[disabled]{ opacity:.35; cursor:default; } #skMarket .x-link{ border:0; background:none; color:var(--accent); font:inherit; text-decoration:underline; cursor:pointer; padding:0; }
#skMarket .x-side{ border-left:1px solid var(--x-ln); background:var(--x-p); overflow:auto; padding:16px 18px 30px; } #skMarket .x-empty{ height:100%; display:flex; align-items:center; justify-content:center; text-align:center; color:var(--x-mut); padding:30px; }
#skMarket .x-dh{ position:relative; } #skMarket .x-dh>.x-x{ position:absolute; top:6px; right:6px; z-index:2; background:rgba(0,0,0,.5); }
#skMarket .x-hero{ position:relative; aspect-ratio:3/2; border-radius:6px; background:#222 center/cover no-repeat; box-shadow:inset 0 0 0 1px rgba(255,255,255,.06), 0 -2px 0 var(--tc); }
#skMarket .x-insp{ position:absolute; left:10px; bottom:10px; height:32px; padding:0 12px; border-radius:6px; border:1px solid rgba(255,255,255,.35); background:rgba(10,9,8,.72); color:#fff; font:500 12px var(--f-ui); cursor:pointer; backdrop-filter:blur(6px); } #skMarket .x-insp:hover{ border-color:#fff; }
#skMarket .x-sub{ margin:4px 0 10px; color:var(--x-mut); font-size:12px; display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
#skMarket .x-px{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; } #skMarket .x-px b{ font:500 28px var(--f-mono); font-variant-numeric:tabular-nums; } #skMarket .x-px span{ color:var(--x-mut); font-size:12px; margin-right:6px; } #skMarket .x-px em{ font-style:normal; color:var(--x-mut); font-size:11px; margin-right:6px; }
#skMarket .x-chart{ position:relative; margin:12px 0 6px; } #skMarket .x-chart svg{ display:block; width:100%; height:200px; }
#skMarket .x-grid{ stroke:var(--x-ln); stroke-width:1; } #skMarket .x-ax{ fill:var(--x-mut); font:500 10px var(--f-mono); } #skMarket .x-line{ fill:none; stroke:var(--accent); stroke-width:2; stroke-linejoin:round; vector-effect:non-scaling-stroke; } #skMarket .x-area{ fill:rgba(227,173,87,.08); }
#skMarket .x-cross{ stroke:var(--x-ln2); stroke-width:1; vector-effect:non-scaling-stroke; opacity:0; } #skMarket .x-dot{ fill:var(--accent); stroke:var(--x-p); stroke-width:2; opacity:0; } #skMarket .x-chart.hov .x-cross, #skMarket .x-chart.hov .x-dot{ opacity:1; }
#skMarket .x-tip{ position:absolute; top:4px; display:none; flex-direction:column; padding:6px 9px; border-radius:5px; background:var(--x-bg); border:1px solid var(--x-ln2); pointer-events:none; font-size:11px; } #skMarket .x-chart.hov .x-tip{ display:flex; } #skMarket .x-tip b{ font:500 12px var(--f-mono); } #skMarket .x-tip span{ color:var(--x-mut); }
#skMarket .x-kv{ display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--x-ln); border:1px solid var(--x-ln); border-radius:6px; overflow:hidden; margin:10px 0; } #skMarket .x-kv div{ padding:9px 12px; background:var(--x-p); } #skMarket .x-kv span{ display:block; font:500 9.5px var(--f-mono); letter-spacing:.12em; text-transform:uppercase; color:var(--x-mut); } #skMarket .x-kv b{ font:500 15px var(--f-mono); }
#skMarket .x-book{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:14px 0; } #skMarket .x-book p{ display:flex; justify-content:space-between; margin:0; padding:4px 0; border-bottom:1px solid var(--x-ln); font-size:12px; } #skMarket .x-book p span{ color:var(--x-mut); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:110px; } #skMarket .x-book b{ font:500 12px var(--f-mono); }
#skMarket .x-act{ display:flex; flex-direction:column; gap:10px; margin-top:14px; padding-top:14px; border-top:1px solid var(--x-ln); } #skMarket .x-act .x-go{ width:100%; }
#skMarket .x-row2{ display:flex; gap:8px; align-items:center; } #skMarket .x-row2 label, #skMarket .x-ticket label{ display:flex; align-items:center; gap:6px; color:var(--x-mut); font-size:12px; }
#skMarket input[type=number]{ width:96px; height:34px; padding:0 8px; border-radius:6px; border:1px solid var(--x-ln2); background:var(--x-bg); color:var(--text); font:500 13px var(--f-mono); } #skMarket .x-hint{ margin:0; color:var(--x-mut); font-size:12px; }
#skMarket .x-stats{ display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; } #skMarket .x-stats div{ padding:14px 16px; border:1px solid var(--x-ln); border-radius:6px; background:var(--x-p); } #skMarket .x-stats span{ display:block; font:500 9.5px var(--f-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--x-mut); } #skMarket .x-stats b{ font:500 24px var(--f-mono); margin-right:8px; } #skMarket .x-stats em{ font-style:normal; color:var(--x-mut); font-size:11px; margin-left:4px; }
#skMarket .x-int{ font:500 10px var(--f-mono); letter-spacing:.1em; text-transform:uppercase; } #skMarket .x-int.strong{ color:var(--x-up); } #skMarket .x-int.steady{ color:var(--accent); } #skMarket .x-int.slow{ color:var(--x-mut); } #skMarket .x-flag{ font:500 11px var(--f-mono); color:#ffd889; }
#skMarket .x-crumb{ display:flex; align-items:center; gap:14px; } #skMarket .x-crumb h3{ margin:0; color:var(--text); }
#skMarket .x-cols{ display:grid; grid-template-columns:1fr 1fr; gap:18px; } #skMarket .x-col{ min-width:0; } #skMarket .x-pick tr.pk td{ background:rgba(95,207,134,.06); }
#skMarket .x-chk{ width:26px; height:26px; border-radius:5px; border:1px solid var(--x-ln2); background:none; color:var(--x-mut); font:600 13px var(--f-ui); cursor:pointer; } #skMarket .x-chk.on{ background:var(--x-up); border-color:var(--x-up); color:#0c1a10; }
#skMarket .x-ticket{ position:sticky; bottom:-40px; display:grid; grid-template-columns:1fr 1.2fr 1fr auto; gap:18px; align-items:center; margin-top:16px; padding:14px 16px; border:1px solid var(--x-ln2); border-radius:8px; background:var(--x-p2); box-shadow:0 -10px 30px rgba(0,0,0,.4); }
#skMarket .x-ticket>div{ display:flex; flex-direction:column; gap:3px; } #skMarket .x-ticket span{ font:500 9.5px var(--f-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--x-mut); } #skMarket .x-ticket b{ font-size:15px; font-weight:500; } #skMarket .x-ticket em{ font-style:normal; color:var(--x-mut); font-size:11.5px; }
#skMarket .x-fbar{ position:relative; height:6px; border-radius:3px; background:linear-gradient(90deg, var(--x-dn), var(--x-mut) 42%, var(--x-mut) 58%, var(--x-up)); opacity:.75; } #skMarket .x-fbar i{ position:absolute; top:-5px; width:3px; height:16px; margin-left:-1px; border-radius:2px; background:var(--text); } #skMarket .x-fair span{ text-align:center; }
#skMarket .x-st{ font:500 10px var(--f-mono); letter-spacing:.1em; text-transform:uppercase; color:var(--x-mut); } #skMarket .x-st.open.you{ color:var(--accent); } #skMarket .x-st.accepted, #skMarket .x-st.done{ color:var(--x-up); } #skMarket .x-st.declined{ color:var(--x-dn); }
#skMarket .x-acts{ display:flex; gap:6px; justify-content:flex-end; } #skMarket .x-exp td{ background:var(--x-p) !important; padding:14px !important; white-space:normal !important; }
#skMarket .x-note{ max-width:520px; margin:40px auto; padding:24px; border:1px solid var(--x-ln); border-radius:8px; background:var(--x-p); } #skMarket .x-note h3{ margin-top:0; } #skMarket .x-err{ color:var(--x-dn); }
@media (max-width:1180px){ #skMarket{ grid-template-columns:64px minmax(0,1fr); } #skMarket .x-nav button{ justify-content:center; font-size:0; } #skMarket .x-nav i{ font-size:15px; } #skMarket .x-navfoot{ display:none; }
  #skMarket .x-side{ position:fixed; top:56px; right:0; bottom:0; width:min(420px, 100vw); transform:translateX(100%); transition:transform .25s; box-shadow:-20px 0 40px rgba(0,0,0,.5); } #skMarket .x-side.on{ transform:none; }
  #skMarket .x-idx{ grid-template-columns:repeat(3, minmax(0,1fr)); } #skMarket .x-tick{ display:none; } }
@media (max-width:760px){ #skMarket .x-cols, #skMarket .x-stats{ grid-template-columns:1fr 1fr; } #skMarket .x-ticket{ grid-template-columns:1fr; } #skMarket .x-wal>div:nth-child(2), #skMarket .x-wal .x-btn{ display:none; } }
`;
