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
import FONT_COND from '../../../assets/fonts/big-shoulders-800.woff2';
import FONT_SERIF from '../../../assets/fonts/fraunces.woff2';
import FONT_UI from '../../../assets/fonts/geist.woff2';
import FONT_MONO from '../../../assets/fonts/geist-mono.woff2';

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
  /* the exchange's type, inside the table's own page: Big Shoulders (condensed caps, OFL), Fraunces, Geist and Geist Mono */
  S.css("@font-face{font-family:'Big Shoulders';font-weight:800;font-display:swap;src:url(" + FONT_COND + ") format('woff2')}@font-face{font-family:'Fraunces';font-weight:100 900;font-display:swap;src:url(" + FONT_SERIF + ") format('woff2')}@font-face{font-family:'Geist';font-weight:100 900;font-display:swap;src:url(" + FONT_UI + ") format('woff2')}@font-face{font-family:'Geist Mono';font-weight:400 700;font-display:swap;src:url(" + FONT_MONO + ") format('woff2')}");
  S.css(CSS);
  const btn = S.el('button', 'mk-btn', ''); btn.type = 'button'; btn.id = 'skMk'; document.body.appendChild(btn);
  const el = S.el('div', 'mk', ''); el.id = 'skMarket'; document.body.appendChild(el);
  btn.addEventListener('click', () => { if (S.M.is('pc') && !el.classList.contains('on')) return;   /* the toys are on their way */ if (!el.classList.contains('on') && S.rig && S.rig.wants()) { S.rig.go(); return; } el.classList.contains('on') ? close() : open(); });   /* on the dark side the button sends the car (rig.js) */
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
  function close() { el.classList.remove('on'); paintBtn(); if (S.rig && S.rig.onClose) S.rig.onClose(); }
  const SETUP = 'Trading with other players isn\'t switched on yet: the trade tables need setting up on the server (docs/supabase.sql).';
  /* what is selected, as a slab and where it came from */
  function selected() { const s = U.sel; if (!s) return null;
    if (s.kind === 'stock') { const it = stock()[s.i]; return it ? { slab: it.slab, kind: 'stock', it } : null; }
    if (s.kind === 'mine') { const x = store.pull(s.id); return x ? { slab: x, kind: 'mine', l: D().listings.find(l => l.id === s.id) } : null; }
    if (s.kind === 'theirs') { const x = U.who && (U.who.cards || []).find(c => c.id === s.id); return x ? { slab: x, kind: 'theirs' } : null; }
    if (s.kind === 'card') return { slab: s.slab, kind: 'card' }; return null; }
  /* ---------- the 3D look for the rows (Sam: the cards rendered in their 3D state, in rows) ----------
     Each slab is built for real (case, label, finish) and rendered once off screen at a slight turn, then kept as a
     picture; a tile shows the flat photo until its render lands. One at a time, so the table never stalls. */
  const R3 = new Map(), q3 = []; let busy3 = false, rt3 = null, sc3 = null, cam3 = null;
  const rkey = s => [s.id, s.grade, s.graded ? 1 : 0, s.variant || '', s.seed, s.tier].join('|');
  function r3d(s) { const k = rkey(s); if (R3.has(k)) return R3.get(k); if (!q3.some(x => x.k === k)) { q3.push({ k, s: JSON.parse(JSON.stringify(s)) }); setTimeout(pump3, 30); } return ''; }
  async function pump3() { if (busy3) return; busy3 = true;
    try { while (q3.length) { const { k, s } = q3.shift(); if (R3.has(k)) continue; let url = ''; try { url = await shoot3(s); } catch (e) { console.error('r3d', e); }
        R3.set(k, url); if (url) el.querySelectorAll('img[data-r3d]').forEach(i => { if (i.dataset.r3d === k) { i.src = url; i.classList.remove('flat'); } });
        await new Promise(r => setTimeout(r, 40)); } }
    finally { busy3 = false; } }
  async function shoot3(s) {
    const obj = S.objFor(s); await Promise.race([obj.ready ? obj.ready.catch(() => null) : null, new Promise(r => setTimeout(r, 3000))]);
    const W = 420, Hh = 560, r = S.renderer;
    if (!rt3) { rt3 = new THREE.WebGLRenderTarget(W, Hh); rt3.texture.colorSpace = THREE.SRGBColorSpace; sc3 = new THREE.Scene(); sc3.add(new THREE.AmbientLight(0xffffff, 1.3)); const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(-2, 3, 5); sc3.add(dl); cam3 = new THREE.PerspectiveCamera(22, W / Hh, 0.1, 200); }
    const g = obj.group, w = obj.w || 3, h = obj.h || 4.4; sc3.add(g); g.position.set(0, 0, 0); g.quaternion.setFromEuler(new THREE.Euler(0.05, -0.34, 0.015)); g.scale.setScalar(1);
    const half = Math.max(h / 2, (w / 2) * Hh / W) * 1.1; cam3.position.set(0, 0, half / Math.tan(THREE.MathUtils.degToRad(11))); cam3.lookAt(0, 0, 0);
    try { if (obj.update) obj.update(0.016); } catch (e) {}
    const pRT = r.getRenderTarget(), pC = r.getClearColor(new THREE.Color()), pA = r.getClearAlpha(), buf = new Uint8Array(W * Hh * 4);
    try { r.setRenderTarget(rt3); r.setClearColor(0x000000, 0); r.clear(); r.render(sc3, cam3); r.readRenderTargetPixels(rt3, 0, 0, W, Hh, buf); } finally { r.setRenderTarget(pRT); r.setClearColor(pC, pA); }
    sc3.remove(g); try { S.slabs.drop(obj); } catch (e) {}
    const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d'), img = x.createImageData(W, Hh);
    for (let y = 0; y < Hh; y++) img.data.set(buf.subarray((Hh - 1 - y) * W * 4, (Hh - y) * W * 4), y * W * 4);
    x.putImageData(img, 0, 0); return c.toDataURL('image/png'); }
  const pic = (s, cls) => { const u = r3d(s); return '<img alt="" class="' + (cls || '') + (u ? '' : ' flat') + '" data-r3d="' + esc(rkey(s)) + '" src="' + esc(u || thumb(s)) + '">'; };

  /* ---------- the exchange, in Sam's mix: Tactical's clean split, red and tall caps, with the half white look's serif ---------- */
  const TABS = [['market', 'Market'], ['portfolio', 'Portfolio'], ['trade', 'Trade'], ['offers', 'Offers'], ['activity', 'Activity']];
  const split = t => { const str = String(t || ''), cut = str.lastIndexOf(' · '), i = cut >= 0 ? cut : str.lastIndexOf(' '); return i > 0 ? [str.slice(0, i), str.slice(i + (cut >= 0 ? 3 : 1))] : [str, '']; };
  const titleN = t => { const [a, b] = split(t); return '<h2 class="x-tt"><b>' + esc(a) + '</b>' + (b ? '<i>' + esc(b) + '</i>' : '') + '</h2>'; };
  const pct = (a, b) => { const c = b ? a / b - 1 : 0; return (c >= 0 ? '+' : '−') + Math.abs(c * 100).toFixed(1) + '%'; };
  /* a card in a row: its 3D render, a tier line, the title in caps with the plate in serif, the number that matters */
  function tile(s, o) { const [a, b] = split(s.title), t = tierOf(s);
    return '<button type="button" class="x-tile' + (o.on ? ' on' : '') + (o.pick ? ' pk' : '') + (o.sold ? ' sold' : '') + '" ' + o.attrs + ' style="--tc:' + t.color + '"><span class="x-pic">' + pic(s) + '<i class="x-tsh"></i></span>'
      + '<span class="x-tm"><span class="x-tk">' + esc(t.name) + (s.graded ? ' · ' + s.grade : ' · Raw') + '</span><b>' + esc(a) + '</b>' + (b ? '<i>' + esc(b) + '</i>' : '') + '<span class="x-tn">' + (o.num || '') + '</span></span>' + (o.pick ? '<em class="x-tick">✓</em>' : '') + '</button>'; }
  function render() { const d = D(), sel = selected(), st = el.querySelector('.x-main'), keep = st ? st.scrollTop : 0;
    let h = '<header class="x-top"><div class="x-brand"><b>STUDIUM</b><i>House</i></div><nav class="x-nav">' + TABS.map(([k, n]) => '<button type="button" data-tab="' + k + '" class="' + (U.tab === k && !sel ? 'on' : '') + '">' + n + (k === 'offers' ? badge() : '') + '</button>').join('') + '</nav>'
      + '<div class="x-wal"><span>CR <b>' + fmt(d.coins) + '</b></span><span>KEY <b>' + String(S.dev.opt('keys') === 'free' ? '∞' : d.keys).padStart(2, '0') + '</b></span><button type="button" class="x-btn" data-a="key">Buy a key · ' + KEY_PRICE + '</button><button type="button" class="x-x" data-a="close" aria-label="Close the exchange">×</button></div></header>';
    h += '<main class="x-main' + (sel ? ' x-detm' : '') + '">' + (sel ? vDetail(sel) : ({ market: vMarket, portfolio: vPortfolio, trade: vTrade, offers: vOffers, activity: vActivity }[U.tab] || vMarket)()) + '</main>';
    el.innerHTML = h; const m = el.querySelector('.x-main'); if (m && !sel) m.scrollTop = keep; paintBtn(); }
  const badge = () => { if (!R.me) return ''; const n = R.offers.filter(o => o.to_id === R.me.id && o.status === 'open').length; return n ? '<i class="x-badge">' + n + '</i>' : ''; };
  const head = (kick, title, right) => '<div class="x-head"><div><p class="x-kick">' + kick + '</p><h3 class="x-h">' + title + '</h3></div>' + (right || '') + '</div>';
  /* ---- Market: today's slabs in rows ---- */
  function vMarket() { const day = today();
    let rows = stock().map((it, i) => ({ it, i })).filter(({ it }) => (U.tier === 'all' || it.slab.tier === U.tier) && (!U.q || (it.slab.title + ' ' + finName(it.slab) + ' ' + it.seller).toLowerCase().includes(U.q.toLowerCase())));
    const key = { value: r => -r.it.price, cheap: r => r.it.price, move: r => -(value(r.it.slab) / value(r.it.slab, day - 1)), tier: r => -BASE[r.it.slab.tier] }[U.sort] || (r => 0); rows.sort((a, b) => key(a) - key(b));
    const filters = '<div class="x-fil">' + [['all', 'All']].concat(TIERS.map(t => [t.id, t.name])).map(([k, n]) => '<button type="button" data-a="tier" data-v="' + k + '" class="' + (U.tier === k ? 'on' : '') + '">' + n + '</button>').join('')
      + '<select data-in="sort" aria-label="Sort"><option value="value"' + (U.sort === 'value' ? ' selected' : '') + '>Price, high to low</option><option value="cheap"' + (U.sort === 'cheap' ? ' selected' : '') + '>Price, low to high</option><option value="move"' + (U.sort === 'move' ? ' selected' : '') + '>Biggest movers</option><option value="tier"' + (U.sort === 'tier' ? ' selected' : '') + '>Rarest first</option></select></div>';
    return head('Today · ' + rows.filter(r => !r.it.sold).length + ' slabs from collectors', 'The <i>market</i>', filters)
      + '<div class="x-rows">' + (rows.length ? rows.map(({ it, i }) => tile(it.slab, { attrs: 'data-a="sel" data-k="stock" data-i="' + i + '"', sold: it.sold, num: it.sold ? 'Sold' : fmt(it.price) + '<small>' + pct(value(it.slab), value(it.slab, day - 1)) + '</small>' })).join('') : '<p class="x-none">Nothing matches. Try another tier.</p>') + '</div>'; }
  /* ---- Portfolio ---- */
  function vPortfolio() { const d = D(), mine = owned(), listed = d.listings.map(l => ({ l, s: store.pull(l.id) })).filter(x => x.s), all = mine.concat(listed.map(x => x.s));
    const tv = all.reduce((a, s) => a + value(s), 0), tv7 = all.reduce((a, s) => a + value(s, today() - 7), 0);
    let h = head('Your collection', 'The <i>portfolio</i>', '<div class="x-nums sm"><div><span>Value</span><b>' + fmt(tv) + '</b><em>' + pct(tv, tv7) + ' this week</em></div><div><span>Net worth</span><b>' + fmt(tv + d.coins) + '</b></div><div><span>Slabs</span><b>' + all.length + '</b></div></div>');
    if (listed.length) h += '<p class="x-kick x-sec">For sale</p><div class="x-rows">' + listed.map(({ l, s }) => tile(s, { attrs: 'data-a="sel" data-k="mine" data-id="' + s.id + '"', num: fmt(l.price) + (l.offer ? '<small class="x-flag">Offer ' + fmt(l.offer.amount) + '</small>' : '<small>asking</small>') })).join('') + '</div>';
    h += '<p class="x-kick x-sec">Holdings</p><div class="x-rows">' + (mine.length ? mine.slice().sort((a, b) => value(b) - value(a)).map(s => tile(s, { attrs: 'data-a="sel" data-k="mine" data-id="' + s.id + '"', num: fmt(value(s)) + '<small>' + pct(value(s), value(s, today() - 7)) + '</small>' })).join('') : '<p class="x-none">No slabs yet. Pull some on the dark side.</p>') + '</div>';
    return h; }
  /* ---- Trade: collectors, then their row over yours and the deal ---- */
  function vTrade() { if (!live()) return '<div class="x-note">' + head('Trade', 'Trade with <i>collectors</i>') + '<p>Sign in with Google to trade. In a class you trade with your class; on the demo, with other demo players.</p>' + (R.err ? '<p class="x-err">' + esc(R.err) + '</p>' : '') + '</div>';
    if (R.err) return '<div class="x-note"><p class="x-err">' + esc(R.err) + '</p></div>';
    if (!U.who) return head(R.lobby === 'studium-lobby:open' ? 'Collectors on the demo' : 'Collectors in your class', 'Trade with <i>collectors</i>')
      + '<div class="x-list">' + (R.shelves.length ? R.shelves.map((p, i) => { const cs = p.cards || [], best = cs.slice().sort((a, b) => value(b) - value(a)).slice(0, 4);
        return '<button type="button" class="x-who" data-a="who" data-i="' + i + '"><span class="x-wn"><b>' + esc(p.name) + '</b><em>' + cs.length + ' slabs · worth ' + fmt(cs.reduce((a, s) => a + value(s), 0)) + '</em></span><span class="x-fan">' + best.map(s => pic(s)).join('') + '</span><span class="x-open">Open</span></button>'; }).join('') : '<p class="x-none">Nobody else has their collection up yet. It shows here once they open the exchange.</p>') + '</div>';
    const p = U.who, theirs = p.cards || [], mine = owned(), wv = theirs.filter(s => U.want.has(s.id)).reduce((a, s) => a + value(s), 0) + U.coinsWant, gv = mine.filter(s => U.give.has(s.id)).reduce((a, s) => a + value(s), 0) + U.coinsGive;
    const row = (list, set, kind) => '<div class="x-rows sm">' + (list.length ? list.slice().sort((a, b) => value(b) - value(a)).map(s => tile(s, { attrs: 'data-a="' + (kind === 'theirs' ? 'want' : 'give') + '" data-id="' + esc(s.id) + '"', pick: set.has(s.id), num: fmt(value(s)) })).join('') : '<p class="x-none">Nothing here.</p>') + '</div>';
    const bal = gv + wv ? wv / (gv + wv) : 0.5, fair = Math.abs(bal - 0.5) < 0.08 ? 'A fair swap' : bal > 0.5 ? 'You come out ahead' : 'They come out ahead';
    return '<div class="x-crumb"><button type="button" class="x-back" data-a="back">‹ All collectors</button></div>' + head('Click cards to add them', 'Trading with <i>' + esc(p.name) + '</i>')
      + '<p class="x-kick x-sec">Their collection</p>' + row(theirs, U.want, 'theirs') + '<p class="x-kick x-sec">Yours</p>' + row(mine, U.give, 'mine')
      + '<div class="x-ticket"><div><span>You get</span><b>' + U.want.size + ' slab' + (U.want.size === 1 ? '' : 's') + '</b><label>+ <input type="number" min="0" step="10" value="' + U.coinsWant + '" data-in="cw"> coins</label><em>worth about ' + fmt(wv) + '</em></div>'
      + '<div class="x-fair"><div class="x-fbar"><i style="left:' + (bal * 100).toFixed(1) + '%"></i></div><span>' + fair + '</span></div>'
      + '<div><span>You give</span><b>' + U.give.size + ' slab' + (U.give.size === 1 ? '' : 's') + '</b><label>+ <input type="number" min="0" step="10" value="' + U.coinsGive + '" data-in="cg"> coins</label><em>worth about ' + fmt(gv) + '</em></div>'
      + '<button type="button" class="x-go" data-a="send"' + (U.want.size + U.give.size + U.coinsGive + U.coinsWant ? '' : ' disabled') + '>Send the offer</button></div>'; }
  /* ---- Offers ---- */
  function vOffers() { if (!live()) return vTrade(); if (R.err) return '<div class="x-note"><p class="x-err">' + esc(R.err) + '</p></div>';
    if (!R.offers.length) return head('Offers', 'Your <i>offers</i>') + '<p class="x-none">No offers yet. Open a collector in Trade to make one.</p>';
    const side = x => { const c = (x && x.cards) || [], n = (x && x.coins) || 0; return (c.length ? c.length + ' slab' + (c.length === 1 ? '' : 's') : '') + (c.length && n ? ' + ' : '') + (n ? fmt(n) + ' coins' : '') || 'Nothing'; };
    const val = x => ((x && x.cards) || []).reduce((a, s) => a + value(s), 0) + ((x && x.coins) || 0);
    return head('Sent and received', 'Your <i>offers</i>') + '<div class="x-list">' + R.offers.map(o => { const out = R.me && o.from_id === R.me.id, get = out ? o.want : o.give, give = out ? o.give : o.want, bal = val(get) - val(give);
      const stt = { open: out ? 'Waiting' : 'For you', accepted: 'Done', done: 'Done', declined: 'Declined', cancelled: 'Cancelled' }[o.status], opened = U.open === o.id;
      let r = '<div class="x-off' + (opened ? ' on' : '') + '"><button type="button" class="x-offh" data-a="openoffer" data-o="' + o.id + '"><b>' + esc(out ? o.to_name : o.from_name) + '</b><em>' + (out ? 'Sent' : 'Received') + '</em><span>You get ' + side(get) + '</span><span>You give ' + side(give) + '</span><span class="' + (bal > 0 ? 'up' : bal < 0 ? 'dn' : 'dim') + '">' + (bal ? (bal > 0 ? '+' : '−') + fmt(Math.abs(bal)) : 'Even') + '</span><span class="x-st ' + o.status + (o.status === 'open' && !out ? ' you' : '') + '">' + stt + '</span></button>'
        + (o.status === 'open' ? '<div class="x-acts">' + (out ? '<button type="button" class="x-btn" data-a="cancel" data-o="' + o.id + '">Cancel</button>' : '<button type="button" class="x-go sm" data-a="accept" data-o="' + o.id + '">Accept</button><button type="button" class="x-btn" data-a="counter" data-o="' + o.id + '">Counter</button><button type="button" class="x-btn" data-a="decline" data-o="' + o.id + '">Decline</button>') + '</div>' : '');
      if (opened) r += '<div class="x-offx"><p class="x-kick">You get</p><div class="x-rows sm">' + ((get && get.cards) || []).map(s => tile(s, { attrs: 'data-a="selcard" data-card="' + esc(JSON.stringify(s)) + '"', num: fmt(value(s)) })).join('') + '</div><p class="x-kick">You give</p><div class="x-rows sm">' + ((give && give.cards) || []).map(s => tile(s, { attrs: 'data-a="selcard" data-card="' + esc(JSON.stringify(s)) + '"', num: fmt(value(s)) })).join('') + '</div></div>';
      return r + '</div>'; }).join('') + '</div>'; }
  /* ---- Activity ---- */
  function vActivity() { const log = (D().log || []);
    return head('Buys, sales, trades and coins', 'The <i>activity</i>') + '<div class="x-log">' + (log.length ? log.slice(0, 80).map(x => '<p><span>' + new Date(x.at).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + '</span><b>' + esc(x.text) + '</b><em class="' + (x.coins > 0 ? 'up' : x.coins < 0 ? 'dn' : '') + '">' + (x.coins ? (x.coins > 0 ? '+' : '−') + fmt(Math.abs(x.coins)) : '') + '</em></p>').join('') : '<p class="x-none">Nothing yet.</p>') + '</div>'; }
  /* ---- one slab: the Tactical split; the card big on the white stage, everything about it on the dark side ---- */
  function vDetail(x) { const s = x.slab, v = value(s), d = D(), t = tierOf(s), h30 = history(s, 30), hi = Math.max(...h30), lo = Math.min(...h30), v7 = value(s, today() - 7);
    const price = x.kind === 'stock' ? x.it.price : x.kind === 'mine' && x.l ? x.l.price : v, ti = TIERS.findIndex(q => q.id === s.tier);
    const bar = (n, k, cls) => '<p class="x-bar"><span>' + n + '</span><i><u class="' + (cls || '') + '" style="width:' + Math.round(Math.max(2, Math.min(100, k)) ) + '%"></u></i><b>' + (cls === 'up' || cls === 'dn' ? pct(v, v7) : Math.round(k)) + '</b></p>';
    let h = '<div class="x-det" style="--tc:' + t.color + '"><div class="x-stage"><span class="x-big">' + esc(String(s.plate || s.grade || '').padStart(3, '0').slice(-3)) + '</span><div class="x-hold">' + pic(s, 'x-hero') + '<i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i></div><i class="x-shadow"></i><p class="x-hints">Examine projects it<br>out of the monitor</p></div>'
      + '<div class="x-info"><button type="button" class="x-back" data-a="unsel">‹ Back</button><p class="x-kick">' + esc(t.name) + ' / ' + esc(finName(s)) + (s.variant ? ' / ' + esc(s.variant) : '') + '</p>' + titleN(s.title)
      + '<p class="x-meta">' + [x.kind === 'stock' ? esc(x.it.seller) : s.from ? 'from ' + esc(s.from) : 'yours', s.graded ? 'grade ' + s.grade + ' ' + esc(SL.gradeText(s.grade)) : 'raw', s.cert ? esc(s.cert) : ''].filter(Boolean).join(' // ') + '</p>'
      + '<div class="x-bars">' + bar('Rarity', (ti + 1) / TIERS.length * 100) + bar('Range', hi > lo ? (v - lo) / (hi - lo) * 100 : 50) + bar('7D', 50 + (v / v7 - 1) * 250, v >= v7 ? 'up' : 'dn') + '</div>'
      + '<div class="x-nums"><div><span>' + (x.kind === 'stock' ? 'Price' : x.kind === 'mine' && x.l ? 'Asking' : 'Value') + '</span><b>' + fmt(price) + '</b></div>' + (price !== v ? '<div><span>Value</span><b class="dim">' + fmt(v) + '</b></div>' : '<div><span>30D high</span><b class="dim">' + fmt(hi) + '</b></div>') + '</div><div class="x-act">';
    if (x.kind === 'stock') { const it = x.it, amt = U.offerAmt[U.sel.i] ?? Math.round(it.price * 0.92);
      h += it.sold ? '<p class="x-hint">Sold.</p>' : '<div class="x-row"><button type="button" class="x-go" data-a="buy"' + (d.coins < it.price ? ' disabled' : '') + '>Purchase</button><button type="button" class="x-btn" data-a="inspectsel">Examine</button><button type="button" class="x-btn" data-a="offering">Offer</button></div>'
        + (d.coins < it.price ? '<p class="x-hint">You need ' + fmt(it.price - d.coins) + ' more coins.</p>' : '')
        + (U.offering ? '<div class="x-row"><label>Offer <input type="number" min="1" value="' + amt + '" data-in="offer"> coins</label><button type="button" class="x-btn" data-a="bid">Send it</button></div>' : '')
        + (it.counter ? '<p class="x-hint">' + esc(it.seller) + ' would take ' + fmt(it.counter) + '. <button type="button" class="x-link" data-a="takecounter">Buy at ' + fmt(it.counter) + '</button></p>' : ''); }
    else if (x.kind === 'mine') { if (x.l) { h += '<p class="x-hint">For sale at ' + fmt(x.l.price) + '. ' + (x.l.offer ? esc(x.l.offer.buyer) + ' offers ' + fmt(x.l.offer.amount) + '.' : 'Waiting on a buyer.') + '</p><div class="x-row">' + (x.l.offer ? '<button type="button" class="x-go" data-a="takeoffer" data-id="' + s.id + '">Sell for ' + fmt(x.l.offer.amount) + '</button>' : '') + '<button type="button" class="x-btn" data-a="inspectsel">Examine</button><button type="button" class="x-btn" data-a="unlist" data-id="' + s.id + '">Take it down</button></div>'; }
      else { const p = U.offerAmt['l' + s.id] ?? v, r = p / v, eta = r <= 0.9 ? 'within hours' : r <= 1.02 ? 'within a day or so' : r <= 1.15 ? 'in a few days' : 'slowly, or draws an offer';
        h += '<div class="x-row"><label>Ask <input type="number" min="1" value="' + p + '" data-in="ask" data-id="' + s.id + '"> coins</label><button type="button" class="x-go" data-a="list" data-id="' + s.id + '">List it</button><button type="button" class="x-btn" data-a="inspectsel">Examine</button></div><p class="x-hint">At this price it should sell ' + eta + '. You keep ' + fmt(p * (1 - FEE)) + ' after the ' + Math.round(FEE * 100) + '% fee.</p>'; } }
    else if (x.kind === 'theirs') { const on = U.want.has(s.id); h += '<div class="x-row"><button type="button" class="' + (on ? 'x-btn' : 'x-go') + '" data-a="want" data-id="' + esc(s.id) + '">' + (on ? 'Take it out' : 'Add to the offer') + '</button><button type="button" class="x-btn" data-a="inspectsel">Examine</button></div>'; }
    else h += '<div class="x-row"><button type="button" class="x-btn" data-a="inspectsel">Examine</button></div>';
    return h + '</div></div></div>'; }
  /* ---- inspect: any slab, yours or not, up in the close view; nothing in your collection moves ---- */
  async function inspect(slab) { if (!slab || S.inspect.active()) return; if (S.rig && S.rig.inPc()) { S.rig.project(slab); return; }   /* on the computer: the projector */ const s = JSON.parse(JSON.stringify(slab)); el.classList.add('peek');
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
      else if (a === 'unsel') { U.sel = null; U.offering = false; render(); }
      else if (a === 'inspect') { const k = t.dataset.k; inspect(k === 'stock' ? (stock()[+t.dataset.i] || {}).slab : store.pull(t.dataset.id)); }
      else if (a === 'inspectcard') inspect(JSON.parse(t.dataset.card));
      else if (a === 'inspectsel') { const x = selected(); if (x) inspect(x.slab); }
      else if (a === 'offering') { U.offering = !U.offering; render(); }
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
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('on') && !S.inspect.active() && !(S.rig && S.rig.projecting())) { if (U.sel) { U.sel = null; render(); } else close(); } }, true);

  /* ---------- the heartbeat ---------- */
  setInterval(() => { if (!S.unlocked()) { paintBtn(); return; } earn(); simulate(); if (el.classList.contains('on') && U.tab !== 'players') render(); }, 20000);
  setInterval(() => { if (S.unlocked()) poll(); }, 30000);
  setTimeout(() => { if (S.unlocked()) { earn(true); refillKeys(); simulate(); poll(); } paintBtn(); }, 1500);
  S.market = { value, history, spendKey, buyKey, open, close, earn, poll, keys: () => (S.dev.opt('keys') === 'free' ? '∞' : D().keys), coins: () => D().coins, paint: paintBtn,
    __sim: (hrs) => { D().listings.forEach(l => { l.t = Date.now() - hrs * 36e5; }); simulate(); } };
}

const CSS = `
#skMk{ position:fixed; right:max(16px, env(safe-area-inset-right,0px)); bottom:calc(40px + env(safe-area-inset-bottom,0px)); display:none; align-items:baseline; gap:8px; font:500 10px/1 var(--f-mono); letter-spacing:.14em; color:var(--text); background:rgba(14,13,12,.9); border:1px solid rgba(227,173,87,.5); border-radius:6px; padding:9px 12px; cursor:pointer; z-index:12; }
#skMk.on{ display:flex; } #skMk:hover{ border-color:var(--accent); } #skMk span{ color:var(--accent); } #skMk b{ font:500 13px/1 var(--f-mono); letter-spacing:0; } #skMk em{ font-style:normal; color:var(--faint); }
#skMk i{ font-style:normal; background:#e8574a; color:#fff; border-radius:999px; padding:2px 6px; }
#skMarket{ --x-bg:#0e0f11; --x-p:#141518; --x-wh:#ece8e1; --x-red:#ff4655; --x-ln:rgba(236,232,225,.09); --x-ln2:rgba(236,232,225,.18); --x-mut:rgba(236,232,225,.55); --x-up:#3ddc84; --x-dn:#ff6b6b;
  --x-cond:"Big Shoulders", "Geist", system-ui, sans-serif; --x-serif:"Fraunces", Georgia, serif; --x-mono:"Geist Mono", ui-monospace, Menlo, monospace; --x-ui:"Geist", system-ui, sans-serif;
  position:fixed; inset:0; z-index:14; display:grid; grid-template-rows:62px minmax(0,1fr); background:var(--x-bg); color:var(--x-wh); font:400 13px/1.45 var(--x-ui); opacity:0; pointer-events:none; transition:opacity .2s; }
#skMarket.on{ opacity:1; pointer-events:auto; } #skMarket.inpc{ border-radius:6px; overflow:hidden; transition:opacity .5s; } #skMarket.on.peek{ opacity:0 !important; visibility:hidden; pointer-events:none; }
#skMarket button{ font-family:inherit; } #skMarket .dim{ color:var(--x-mut); } #skMarket .up{ color:var(--x-up); } #skMarket .dn{ color:var(--x-dn); }
/* the bar: the wordmark, the tabs (the open one a red block), your coins and keys */
#skMarket .x-top{ display:flex; align-items:center; gap:26px; padding:0 22px 0 26px; border-bottom:1px solid var(--x-ln); }
#skMarket .x-brand{ display:flex; align-items:baseline; gap:8px; } #skMarket .x-brand b{ font:800 28px/1 var(--x-cond); letter-spacing:.02em; } #skMarket .x-brand i{ font:italic 400 19px/1 var(--x-serif); color:var(--x-mut); }
#skMarket .x-nav{ display:flex; gap:4px; } #skMarket .x-nav button{ position:relative; height:28px; padding:0 12px; border:0; background:none; color:var(--x-mut); font:600 11px/1 var(--x-mono); letter-spacing:.14em; text-transform:uppercase; cursor:pointer; }
#skMarket .x-nav button:hover{ color:var(--x-wh); } #skMarket .x-nav button.on{ background:var(--x-red); color:#fff; }
#skMarket .x-badge{ position:absolute; top:-5px; right:-4px; min-width:16px; height:16px; border-radius:8px; background:var(--x-red); color:#fff; font:700 9px/16px var(--x-mono); font-style:normal; }
#skMarket .x-wal{ margin-left:auto; display:flex; align-items:center; gap:18px; font:500 12px var(--x-mono); color:var(--x-mut); letter-spacing:.08em; } #skMarket .x-wal b{ color:var(--x-wh); font-weight:600; }
#skMarket .x-btn{ height:32px; padding:0 14px; border:1px solid var(--x-ln2); border-radius:0; background:none; color:var(--x-wh); font:600 10.5px/1 var(--x-mono); letter-spacing:.14em; text-transform:uppercase; cursor:pointer; } #skMarket .x-btn:hover{ border-color:var(--x-wh); }
#skMarket .x-x{ width:32px; height:32px; border:1px solid var(--x-ln2); background:none; color:var(--x-mut); font-size:17px; cursor:pointer; } #skMarket .x-x:hover{ color:var(--x-wh); border-color:var(--x-wh); }
#skMarket .x-go{ height:46px; padding:0 30px; border:0; background:var(--x-red); color:#0e0f11; font:800 20px/1 var(--x-cond); letter-spacing:.1em; text-transform:uppercase; cursor:pointer; clip-path:polygon(0 0, 100% 0, 100% 70%, calc(100% - 13px) 100%, 0 100%); } #skMarket .x-go:hover{ background:#ff5f6c; } #skMarket .x-go[disabled]{ opacity:.35; cursor:default; } #skMarket .x-go.sm{ height:32px; padding:0 18px; font-size:15px; }
#skMarket .x-link{ border:0; background:none; color:var(--x-red); font:inherit; text-decoration:underline; cursor:pointer; padding:0; }
/* a page: a kicker in red mono, a big condensed title with its last word in serif italic */
#skMarket .x-main{ overflow:auto; padding:26px 30px 40px; min-height:0; } #skMarket .x-main.x-detm{ padding:0; overflow:hidden; }
#skMarket .x-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; margin-bottom:22px; }
#skMarket .x-kick{ display:flex; align-items:center; gap:10px; margin:0; font:600 11px/1 var(--x-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--x-red); } #skMarket .x-kick::before{ content:''; width:22px; height:2px; background:var(--x-red); }
#skMarket .x-sec{ margin:26px 0 14px; color:var(--x-mut); } #skMarket .x-sec::before{ background:var(--x-mut); }
#skMarket .x-h{ margin:8px 0 0; font:800 52px/.9 var(--x-cond); text-transform:uppercase; letter-spacing:.01em; } #skMarket .x-h i{ font:italic 400 44px/1 var(--x-serif); text-transform:none; letter-spacing:0; }
#skMarket .x-fil{ display:flex; align-items:center; gap:4px; flex-wrap:wrap; } #skMarket .x-fil button{ height:28px; padding:0 11px; border:1px solid transparent; background:none; color:var(--x-mut); font:600 10.5px var(--x-mono); letter-spacing:.12em; text-transform:uppercase; cursor:pointer; }
#skMarket .x-fil button:hover{ color:var(--x-wh); } #skMarket .x-fil button.on{ color:var(--x-wh); border-color:var(--x-ln2); box-shadow:inset 0 -2px 0 var(--x-red); }
#skMarket select, #skMarket input[type=number]{ height:30px; padding:0 8px; border:1px solid var(--x-ln2); border-radius:0; background:var(--x-bg); color:var(--x-wh); font:500 12px var(--x-mono); } #skMarket input[type=number]{ width:96px; }
/* the rows of cards: each one its 3D render floating over a soft shadow, a tier line, caps and serif, a number */
#skMarket .x-rows{ display:grid; grid-template-columns:repeat(auto-fill, minmax(168px, 1fr)); gap:30px 22px; } #skMarket .x-rows.sm{ grid-template-columns:repeat(auto-fill, minmax(132px, 1fr)); gap:22px 16px; }
#skMarket .x-tile{ position:relative; display:flex; flex-direction:column; gap:10px; padding:0; border:0; background:none; color:inherit; text-align:left; cursor:pointer; }
#skMarket .x-pic{ position:relative; display:block; aspect-ratio:3/4; } #skMarket .x-pic img{ position:absolute; inset:0; width:100%; height:100%; object-fit:contain; transition:transform .35s cubic-bezier(.2,.8,.2,1); filter:drop-shadow(0 14px 16px rgba(0,0,0,.45)); }
#skMarket .x-pic img.flat{ inset:10% 16%; width:68%; height:80%; object-fit:cover; border-radius:5px; box-shadow:0 0 0 6px #0b0b0d, 0 0 0 7px rgba(255,255,255,.08); transform:perspective(600px) rotateY(-14deg); }
#skMarket .x-tsh{ position:absolute; left:18%; right:18%; bottom:-6px; height:12px; border-radius:50%; background:radial-gradient(ellipse, rgba(0,0,0,.55), rgba(0,0,0,0) 70%); }
#skMarket .x-tile:hover .x-pic img{ transform:translateY(-8px) rotate(-1.2deg); } #skMarket .x-tile.sold{ opacity:.35; }
#skMarket .x-tm{ display:flex; flex-direction:column; gap:2px; padding-top:8px; border-top:2px solid var(--tc); } #skMarket .x-tk{ font:600 9.5px var(--x-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--x-mut); }
#skMarket .x-tm b{ font:800 21px/.95 var(--x-cond); text-transform:uppercase; letter-spacing:.01em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } #skMarket .x-tm i{ font:italic 400 17px/1.1 var(--x-serif); color:var(--x-wh); }
#skMarket .x-tn{ display:flex; align-items:baseline; gap:8px; margin-top:4px; font:800 26px/1 var(--x-cond); } #skMarket .x-tn small{ font:500 10.5px var(--x-mono); color:var(--x-mut); }
#skMarket .x-tile.pk .x-pic::after{ content:''; position:absolute; inset:-6px; border:2px solid var(--x-red); } #skMarket .x-tick{ position:absolute; top:-8px; right:-8px; width:22px; height:22px; background:var(--x-red); color:#fff; font:700 12px/22px var(--x-mono); text-align:center; font-style:normal; }
#skMarket .x-none{ grid-column:1/-1; color:var(--x-mut); padding:30px 0; }
/* one slab: white stage left with the card big and bracketed, everything about it on the dark side */
#skMarket .x-det{ position:relative; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); height:100%; }
#skMarket .x-stage{ position:absolute; inset:0 auto 0 0; width:55%; background:var(--x-wh) linear-gradient(rgba(14,15,17,.06) 1px, transparent 1px) 0 0/34px 34px; clip-path:polygon(0 0, 100% 0, 78% 100%, 0 100%); overflow:hidden; }
#skMarket .x-stage::before{ content:''; position:absolute; inset:0; background:linear-gradient(90deg, rgba(14,15,17,.06) 1px, transparent 1px) 0 0/34px 34px; }
#skMarket .x-big{ position:absolute; left:4%; top:2%; font:800 min(34vh,300px)/.8 var(--x-cond); color:rgba(14,15,17,.07); letter-spacing:-.02em; }
#skMarket .x-hold{ position:absolute; left:10%; top:9%; width:46%; height:72%; animation:xfloat 6s ease-in-out infinite; } #skMarket .x-hold img{ width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 30px 30px rgba(40,30,20,.3)); }
#skMarket .x-hold img.flat{ object-fit:cover; width:70%; height:84%; margin:8% 15%; box-shadow:0 0 0 8px #0b0b0d; }
#skMarket .x-hold i{ position:absolute; width:18px; height:18px; border:2px solid var(--x-red); } #skMarket .x-hold .b1{ left:-4px; top:-4px; border-right:0; border-bottom:0; } #skMarket .x-hold .b2{ right:-4px; top:-4px; border-left:0; border-bottom:0; } #skMarket .x-hold .b3{ left:-4px; bottom:-4px; border-right:0; border-top:0; } #skMarket .x-hold .b4{ right:-4px; bottom:-4px; border-left:0; border-top:0; }
#skMarket .x-shadow{ position:absolute; left:16%; width:34%; bottom:10%; height:16px; border-radius:50%; background:radial-gradient(ellipse, rgba(40,30,20,.45), rgba(40,30,20,0) 70%); animation:xshadow 6s ease-in-out infinite; }
#skMarket .x-hints{ position:absolute; left:4%; bottom:5%; margin:0; font:500 10.5px/1.7 var(--x-mono); letter-spacing:.14em; text-transform:uppercase; color:rgba(14,15,17,.5); }
@keyframes xfloat{ 0%,100%{ transform:translateY(0) rotate(-1.5deg); } 50%{ transform:translateY(-12px) rotate(-.5deg); } } @keyframes xshadow{ 0%,100%{ transform:scale(1); opacity:.9; } 50%{ transform:scale(.82); opacity:.55; } }
#skMarket .x-info{ grid-column:2; position:relative; display:flex; flex-direction:column; gap:14px; padding:26px 34px 26px 4%; overflow:auto; }
#skMarket .x-back{ align-self:flex-start; height:26px; padding:0; border:0; background:none; color:var(--x-mut); font:600 10.5px var(--x-mono); letter-spacing:.14em; text-transform:uppercase; cursor:pointer; } #skMarket .x-back:hover{ color:var(--x-wh); }
#skMarket .x-tt{ margin:0; } #skMarket .x-tt b{ display:block; font:800 clamp(44px, 8vh, 92px)/.84 var(--x-cond); text-transform:uppercase; letter-spacing:.005em; } #skMarket .x-tt i{ display:block; margin-top:4px; font:italic 400 clamp(30px, 5vh, 54px)/1 var(--x-serif); }
#skMarket .x-meta{ margin:0; font:500 12px var(--x-mono); letter-spacing:.1em; text-transform:uppercase; color:var(--x-mut); }
#skMarket .x-bars{ display:flex; flex-direction:column; gap:10px; max-width:460px; } #skMarket .x-bar{ display:grid; grid-template-columns:70px 1fr 54px; align-items:center; gap:14px; margin:0; font:500 10.5px var(--x-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--x-mut); }
#skMarket .x-bar i{ height:3px; background:rgba(236,232,225,.1); } #skMarket .x-bar u{ display:block; height:100%; background:var(--x-wh); } #skMarket .x-bar u.up{ background:var(--x-up); } #skMarket .x-bar u.dn{ background:var(--x-dn); } #skMarket .x-bar b{ color:var(--x-wh); text-align:right; font-weight:600; }
#skMarket .x-nums{ display:flex; gap:32px; } #skMarket .x-nums span{ display:block; font:600 10.5px var(--x-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--x-mut); } #skMarket .x-nums b{ display:block; font:800 clamp(44px, 8vh, 68px)/.9 var(--x-cond); } #skMarket .x-nums b.dim{ color:#7d828b; }
#skMarket .x-nums.sm b{ font-size:40px; } #skMarket .x-nums em{ font:500 10.5px var(--x-mono); font-style:normal; color:var(--x-mut); }
#skMarket .x-act{ display:flex; flex-direction:column; gap:10px; } #skMarket .x-row{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; } #skMarket .x-row .x-btn{ height:46px; padding:0 20px; }
#skMarket label{ display:flex; align-items:center; gap:8px; font:500 11px var(--x-mono); letter-spacing:.08em; text-transform:uppercase; color:var(--x-mut); } #skMarket .x-hint{ margin:0; font-size:12.5px; color:var(--x-mut); } #skMarket .x-flag{ color:#ffd889 !important; }
/* trade, offers, activity: plain rows */
#skMarket .x-list{ display:flex; flex-direction:column; border-top:1px solid var(--x-ln); }
#skMarket .x-who{ display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:24px; padding:14px 4px; border:0; border-bottom:1px solid var(--x-ln); background:none; color:inherit; text-align:left; cursor:pointer; } #skMarket .x-who:hover{ background:rgba(236,232,225,.03); }
#skMarket .x-wn b{ display:block; font:800 24px/1 var(--x-cond); text-transform:uppercase; } #skMarket .x-wn em{ font:500 11px var(--x-mono); font-style:normal; color:var(--x-mut); }
#skMarket .x-fan{ display:flex; } #skMarket .x-fan img{ width:46px; height:60px; object-fit:contain; margin-left:-14px; filter:drop-shadow(0 6px 6px rgba(0,0,0,.4)); } #skMarket .x-fan img.flat{ object-fit:cover; border:3px solid #0b0b0d; width:40px; height:54px; }
#skMarket .x-open{ font:600 10.5px var(--x-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--x-red); }
#skMarket .x-crumb{ margin-bottom:6px; }
#skMarket .x-ticket{ position:sticky; bottom:-40px; display:grid; grid-template-columns:1fr 1.2fr 1fr auto; gap:22px; align-items:center; margin-top:26px; padding:16px 18px; border-top:2px solid var(--x-red); background:var(--x-p); }
#skMarket .x-ticket>div{ display:flex; flex-direction:column; gap:4px; } #skMarket .x-ticket span{ font:600 10px var(--x-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--x-mut); } #skMarket .x-ticket b{ font:800 26px/1 var(--x-cond); text-transform:uppercase; } #skMarket .x-ticket em{ font:italic 400 14px var(--x-serif); color:var(--x-mut); }
#skMarket .x-fbar{ position:relative; height:3px; background:linear-gradient(90deg, var(--x-dn), rgba(236,232,225,.3) 42%, rgba(236,232,225,.3) 58%, var(--x-up)); } #skMarket .x-fbar i{ position:absolute; top:-7px; width:3px; height:17px; margin-left:-1px; background:var(--x-wh); } #skMarket .x-fair{ display:flex; flex-direction:column; gap:10px; }
#skMarket .x-off{ border-bottom:1px solid var(--x-ln); } #skMarket .x-offh{ display:grid; grid-template-columns:1.2fr .6fr 1fr 1fr .6fr .6fr; gap:14px; align-items:baseline; width:100%; padding:14px 4px; border:0; background:none; color:inherit; text-align:left; font:500 12px var(--x-mono); cursor:pointer; }
#skMarket .x-offh b{ font:800 20px/1 var(--x-cond); text-transform:uppercase; } #skMarket .x-offh em{ font-style:normal; color:var(--x-mut); } #skMarket .x-acts{ display:flex; gap:8px; padding:0 4px 14px; } #skMarket .x-offx{ padding:6px 4px 22px; display:flex; flex-direction:column; gap:14px; }
#skMarket .x-st{ font:600 10px var(--x-mono); letter-spacing:.12em; text-transform:uppercase; color:var(--x-mut); } #skMarket .x-st.open.you{ color:var(--x-red); } #skMarket .x-st.accepted, #skMarket .x-st.done{ color:var(--x-up); } #skMarket .x-st.declined{ color:var(--x-dn); }
#skMarket .x-log p{ display:grid; grid-template-columns:150px 1fr auto; gap:16px; margin:0; padding:11px 4px; border-bottom:1px solid var(--x-ln); } #skMarket .x-log span{ font:500 11px var(--x-mono); color:var(--x-mut); } #skMarket .x-log em{ font:600 12px var(--x-mono); font-style:normal; }
#skMarket .x-note{ max-width:560px; } #skMarket .x-note p{ color:var(--x-mut); } #skMarket .x-err{ color:var(--x-dn) !important; }
@media (max-width:900px){ #skMarket .x-top{ gap:14px; } #skMarket .x-brand i, #skMarket .x-wal .x-btn{ display:none; } #skMarket .x-det{ grid-template-columns:1fr; } #skMarket .x-stage{ position:relative; width:100%; height:44vh; clip-path:polygon(0 0, 100% 0, 100% 86%, 0 100%); } #skMarket .x-info{ grid-column:1; } #skMarket .x-det{ overflow:auto; display:block; } #skMarket .x-ticket{ grid-template-columns:1fr; } }
`;
