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

const BASE = { common: 20, uncommon: 45, rare: 110, epic: 260, legendary: 700, mythic: 2200 };
const GRADE_K = { 10: 3.2, 9: 1.9, 8: 1.35, 7: 1.1, 6: 0.95, 5: 0.85, 4: 0.75, 3: 0.66, 2: 0.58, 1: 0.5 };
const KEY_PRICE = 150, FREE_KEYS = 3, FEE = 0.05, START = 300, PER_ACH = 60, PER_QUEST = 150;
const DAY = 864e5, today = () => Math.floor(Date.now() / DAY);
const BUYERS = ['kiri.lens', 'mōhio_photo', 'tui_frames', 'harbourlight', 'ngaio.prints', 'kererū_kollects', 'mt_eden_mono', 'fernfocus', 'pōhutukawa.pix', 'southerly_slabs', 'te_awa_archive', 'kumara_cam', 'flatwhite.film', 'raupō_reels', 'kea_collects', 'lyttelton_light', 'sandfly_snaps', 'gumboot_gallery', 'manuka_matte', 'tarn_tones'];
const h32 = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-NZ');

export function install(S) {
  const { store, SL } = S, H = () => (S.ctx.HOST && S.ctx.HOST.trade) || null;
  S.dev.define('keys', 'Keys', { daily: 'Three a day', free: 'Free (testing)' }, 'daily');
  const D = () => { const d = store.get(); if (d.coins == null) { d.coins = 0; d.coinsFrom = null; } if (!d.listings) d.listings = []; if (!d.sales) d.sales = []; if (!d.escrow) d.escrow = {}; if (!d.seenOffers) d.seenOffers = {}; if (d.keys == null) { d.keys = FREE_KEYS; d.keyDay = today(); } return d; };

  /* ---------- value ---------- */
  const finOf = slab => SL.finishOf(slab, null);
  const finK = slab => { const f = finOf(slab), t = TIER[slab.tier] || TIER.common; return SEALED.has(f) ? 1.45 : f === t.finish ? 1 : 1.15; };
  const drift = (f, day) => { const a = h32(f), b = h32(f + '·'); return 1 + 0.09 * Math.sin(day * 0.43 + a * 6.28) + 0.05 * Math.sin(day * 1.31 + b * 6.28) + 0.03 * Math.sin(day * 2.9 + a * 17); };
  function value(slab, day) { if (!slab) return 0; day = day ?? today(); const g = slab.graded ? GRADE_K[slab.grade] || 1 : 0.7;
    return Math.max(5, Math.round(BASE[slab.tier] * g * (slab.variant ? 1.6 : 1) * finK(slab) * (0.9 + 0.25 * h32(slab.seed + ':' + slab.tier)) * drift(finOf(slab), day))); }
  const history = (slab, n) => Array.from({ length: n || 30 }, (_, i) => value(slab, today() - (n || 30) + 1 + i));

  /* ---------- coins and keys ---------- */
  const hud = () => { try { S.hud(); } catch (e) {} paintBtn(); };
  function earn(quiet) { const d = D(), h = H(); if (!h || !h.earnings) return; let e; try { e = h.earnings(); } catch (x) { return; } if (!e) return;
    if (!d.coinsFrom) { d.coinsFrom = { ach: e.ach, quests: e.quests }; d.coins += START + e.ach * PER_ACH + e.quests * PER_QUEST; store.save(); if (!quiet) S.toast('Your coin purse: ' + fmt(d.coins) + ' coins from what you have done in Studium so far.'); hud(); return; }
    const da = Math.max(0, e.ach - d.coinsFrom.ach), dq = Math.max(0, e.quests - d.coinsFrom.quests); if (!da && !dq) return;
    const n = da * PER_ACH + dq * PER_QUEST; d.coins += n; d.coinsFrom = { ach: Math.max(e.ach, d.coinsFrom.ach), quests: Math.max(e.quests, d.coinsFrom.quests) }; store.save();
    if (!quiet) S.toast('+' + fmt(n) + ' coins' + (dq ? ' for finishing a quest' : ' for an achievement') + '.'); hud(); }
  function refillKeys() { const d = D(); if (d.keyDay !== today()) { d.keys = Math.max(d.keys, FREE_KEYS); d.keyDay = today(); store.save(); } }
  /* a pull: true when a key was spent (or keys are free for testing) */
  function spendKey() { if (S.dev.opt('keys') === 'free') return true; refillKeys(); const d = D();
    if (d.keys > 0) { d.keys--; store.save(); hud(); return true; }
    S.toast('No keys left today. Buy one with coins in the Market (' + KEY_PRICE + ').', 'Market', () => open('wallet')); return false; }
  function buyKey() { const d = D(); if (d.coins < KEY_PRICE) { S.toast('Not enough coins. Quests and achievements earn more.'); return false; } d.coins -= KEY_PRICE; d.keys++; store.save(); hud(); S.sfx('ltPutDown'); return true; }

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
    const net = Math.round(price * (1 - FEE)); d.coins += net; d.sales.unshift({ title: s.title, tier: s.tier, price, net, buyer, at: Date.now() }); d.sales = d.sales.slice(0, 40); store.discard(l.id); store.save(); hud();
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
    const items = []; for (let i = 0; i < 12; i++) { const seed = (Math.floor(h32('stock' + day + ':' + i) * 2 ** 31)) >>> 0, cert = d.certN; const s = SL.roll({ seed, graded: true }); d.certN = cert;   /* the market's slabs don't use up your cert numbers */
      s.id = 'm' + day.toString(36) + i; items.push({ slab: s, seller: BUYERS[Math.floor(h32('seller' + seed) * BUYERS.length)], price: Math.round(value(s) * (0.92 + h32('p' + seed) * 0.33)), sold: false }); }
    d.stock = { day, items }; store.save(); return items; }
  function buyStock(i) { const it = stock()[i], d = D(); if (!it || it.sold) return; if (d.coins < it.price) { S.toast('Not enough coins for that one.'); return; }
    d.coins -= it.price; it.sold = true; const s = adopt(it.slab, it.seller); store.save(); reracks(); hud(); S.sfx('ltPutDown'); S.toast('Bought from ' + it.seller + '. ' + (s.graded ? 'Filed in your case.' : 'Filed in your binder.')); }

  /* ---------- other players: shelves and offers (Supabase, through the host) ---------- */
  const R = { me: null, lobby: null, shelves: [], offers: [], pubSig: '', busy: false, err: '' };
  const live = () => { const h = H(); return !!(h && h.can && h.can()); };
  const lean = s => { const o = JSON.parse(JSON.stringify(s)); delete o.pending; if (o.photo && o.photo.url && /^(data|blob):/.test(o.photo.url)) o.photo = { painted: true, plate: o.photo.plate || 1, title: o.photo.title, pack: o.photo.pack }; return o; };
  async function whoami() { if (R.me) return R.me; const h = H(); R.me = await h.me(); R.lobby = h.lobby(); return R.me; }
  async function publish(force) { if (!live()) return; try { await whoami(); if (!R.me) return; const cards = owned().map(lean), sig = R.lobby + '|' + cards.map(c => c.id + c.grade + c.graded).join(',');
    if (!force && sig === R.pubSig) return; await H().rest('studium_trade_shelves?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates', body: { user_id: R.me.id, lobby: R.lobby, name: R.me.name, cards, updated_at: new Date().toISOString() } }); R.pubSig = sig; R.err = ''; }
    catch (e) { R.err = 'Trading needs the market set up on the server (docs/supabase.sql).'; } }
  async function loadShelves() { if (!live()) return []; await whoami(); const lob = encodeURIComponent(R.lobby); R.shelves = ((await H().rest('studium_trade_shelves?lobby=eq.' + lob + '&select=user_id,name,cards,updated_at&order=updated_at.desc&limit=60')) || []).filter(x => !R.me || x.user_id !== R.me.id); return R.shelves; }
  async function loadOffers() { if (!live()) return []; await whoami(); if (!R.me) return []; const id = R.me.id;
    R.offers = (await H().rest('studium_trade_offers?or=(from_id.eq.' + id + ',to_id.eq.' + id + ')&order=created_at.desc&limit=60')) || []; return R.offers; }
  const patch = (id, body) => H().rest('studium_trade_offers?id=eq.' + id, { method: 'PATCH', body: { ...body, updated_at: new Date().toISOString() } });
  /* send: my side goes into escrow first, so it can't be spent while it waits */
  async function send(to, give, want) { const d = D(); await whoami(); if (!R.me) throw new Error('not signed in');
    if ((give.coins || 0) > d.coins) throw new Error('You don\'t have that many coins.');
    const gCards = give.ids.map(id => store.pull(id)).filter(Boolean).map(lean), wCards = want.cards.map(lean);
    const rows = await H().rest('studium_trade_offers', { method: 'POST', prefer: 'return=representation', body: { lobby: R.lobby, from_id: R.me.id, from_name: R.me.name, to_id: to.user_id, to_name: to.name, give: { coins: give.coins || 0, cards: gCards }, want: { coins: want.coins || 0, cards: wCards } } });
    const row = rows && rows[0]; if (!row) throw new Error('The offer didn\'t send.');
    d.coins -= give.coins || 0; d.escrow[row.id] = { coins: give.coins || 0, cards: gCards }; give.ids.forEach(lift); store.save(); reracks(); publish(true); hud(); return row; }
  /* their offer to me: check I still have what they want and the coins they ask for, then swap */
  async function accept(o) { const d = D(), mine = new Set(owned().map(s => s.id)), wc = (o.want && o.want.cards) || [];
    if (wc.some(c => !mine.has(c.id))) { S.toast('You no longer have everything they asked for.'); return false; }
    if ((o.want.coins || 0) > d.coins) { S.toast('You need ' + fmt(o.want.coins) + ' coins for this one.'); return false; }
    await patch(o.id, { status: 'accepted' });
    wc.forEach(c => { lift(c.id); store.discard(c.id); }); d.coins += (o.give.coins || 0) - (o.want.coins || 0); ((o.give && o.give.cards) || []).forEach(c => adopt(c, o.from_name)); d.seenOffers[o.id] = 'done';
    store.save(); reracks(); publish(true); hud(); S.sfx('ltPutDown'); S.toast('Trade done with ' + o.from_name + '.'); return true; }
  async function decline(o) { await patch(o.id, { status: 'declined' }); D().seenOffers[o.id] = 'done'; store.save(); }
  async function cancel(o) { await patch(o.id, { status: 'cancelled' }); settle(o, 'cancelled'); }
  /* my offers that ended: accepted ones bring their side in; declined or cancelled ones give mine back */
  function settle(o, status) { const d = D(), e = d.escrow[o.id]; if (!e) return;
    if (status === 'accepted') { ((o.want && o.want.cards) || []).forEach(c => adopt(c, o.to_name)); d.coins += (o.want && o.want.coins) || 0; e.cards.forEach(c => store.discard(c.id)); S.toast(o.to_name + ' accepted your offer.', 'Market', () => open('offers')); patch(o.id, { status: 'done' }).catch(() => {}); }
    else { d.coins += e.coins || 0; e.cards.forEach(c => { if (store.pull(c.id)) file(c.id); else adopt(c, 'you'); }); if (status === 'declined') S.toast(o.to_name + ' said no to your offer. Your side is back with you.'); }
    delete d.escrow[o.id]; store.save(); reracks(); publish(true); hud(); }
  async function poll() { if (!live() || R.busy) return; R.busy = true;
    try { await publish(); const list = await loadOffers(), d = D(); let fresh = 0;
      list.forEach(o => { if (R.me && o.from_id === R.me.id && d.escrow[o.id] && o.status !== 'open') settle(o, o.status === 'done' ? 'accepted' : o.status);
        if (R.me && o.to_id === R.me.id && o.status === 'open' && !d.seenOffers[o.id]) { d.seenOffers[o.id] = 'seen'; fresh++; } });
      if (fresh) { store.save(); S.toast(fresh === 1 ? 'You have a new trade offer.' : 'You have ' + fresh + ' new trade offers.', 'Look', () => open('offers')); } paintBtn(); }
    catch (e) { R.err = 'Trading needs the market set up on the server (docs/supabase.sql).'; } finally { R.busy = false; } }

  /* ---------- the panel ---------- */
  S.css(CSS);
  const btn = S.el('button', 'mk-btn', ''); btn.type = 'button'; btn.id = 'skMk'; document.body.appendChild(btn);
  const el = S.el('div', 'mk', ''); el.id = 'skMarket'; document.body.appendChild(el);
  btn.addEventListener('click', () => (el.classList.contains('on') ? close() : open()));
  function paintBtn() { const on = S.unlocked(); btn.classList.toggle('on', on); if (!on) return; const d = D(), n = R.offers.filter(o => R.me && o.to_id === R.me.id && o.status === 'open').length;
    btn.innerHTML = 'MARKET <b>' + fmt(d.coins) + ' COINS</b>' + (n ? '<i>' + n + '</i>' : ''); }
  const U = { tab: 'market', who: null, side: 'theirs', want: new Set(), give: new Set(), coinsGive: 0, coinsWant: 0, sel: null, q: '' };
  const thumbs = new Map();
  function thumb(s) { const p = s.photo || {}; if (p.url && !/^blob:/.test(p.url)) return p.url; const k = 'p' + (p.plate || 1) + ':' + s.seed; if (thumbs.has(k)) return thumbs.get(k);
    let u = ''; try { const cv = S.paintPhoto(S.KINDS[(p.plate || 1) % S.KINDS.length], s.seed || 1, 240, 170); u = cv.toDataURL('image/jpeg', 0.75); } catch (e) {} thumbs.set(k, u); return u; }
  function tile(s, o) { o = o || {}; const t = TIER[s.tier] || TIER.common, f = FINISH[finOf(s)], v = value(s);
    return '<button type="button" class="mk-card' + (o.sel ? ' sel' : '') + '" style="--tc:' + t.color + '" ' + (o.attr || '') + '><span class="mk-ph" style="background-image:url(\'' + esc(thumb(s)) + '\')"></span>'
      + '<b>' + esc(s.title || 'Untitled') + '</b><span class="mk-meta">' + t.name + (f ? ' · ' + esc(f.name) : '') + (s.graded ? ' · ' + s.grade : ' · raw') + (s.variant ? ' · ' + esc(s.variant) : '') + '</span>'
      + '<span class="mk-v">' + (o.price != null ? fmt(o.price) + ' <small>coins</small>' : 'Worth about ' + fmt(v)) + '</span>' + (o.extra || '') + '</button>'; }
  function spark(s) { const h = history(s, 30), mn = Math.min(...h), mx = Math.max(...h), W = 220, Hh = 46, pts = h.map((y, i) => (i / 29 * W).toFixed(1) + ',' + (Hh - 4 - (y - mn) / Math.max(1, mx - mn) * (Hh - 8)).toFixed(1)).join(' ');
    const ch = h[29] / h[22] - 1, flat = Math.abs(ch) < 0.005; return '<svg class="mk-sp" viewBox="0 0 ' + W + ' ' + Hh + '"><polyline points="' + pts + '"/></svg><span class="mk-tr ' + (flat ? '' : ch >= 0 ? 'up' : 'dn') + '">' + (flat ? 'Steady this week' : (ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch * 100).toFixed(1) + '% this week') + '</span>'; }
  const TABS = [['market', 'Market'], ['mine', 'My slabs'], ['players', 'Players'], ['offers', 'Offers'], ['wallet', 'Coins and keys']];
  async function open(tab) { if (!S.unlocked()) return; earn(); refillKeys(); simulate(); if (tab) U.tab = tab; el.classList.add('on'); render(); if (live() && (U.tab === 'players' || U.tab === 'offers')) { try { if (U.tab === 'players') await loadShelves(); await loadOffers(); } catch (e) { R.err = 'Trading needs the market set up on the server (docs/supabase.sql).'; } render(); } }
  function close() { el.classList.remove('on'); }
  function render() { const d = D();
    let h = '<div class="mk-hd"><b>Market</b><span>' + fmt(d.coins) + ' coins · ' + (S.dev.opt('keys') === 'free' ? '∞' : d.keys) + ' keys</span><button type="button" class="mk-x" data-a="close" aria-label="Close">×</button></div><div class="mk-tabs">'
      + TABS.map(([k, n]) => '<button type="button" data-tab="' + k + '" class="' + (U.tab === k ? 'on' : '') + '">' + n + (k === 'offers' && R.me ? badge() : '') + '</button>').join('') + '</div><div class="mk-body">';
    h += ({ market: viewMarket, mine: viewMine, players: viewPlayers, offers: viewOffers, wallet: viewWallet }[U.tab] || viewMarket)();
    el.innerHTML = h + '</div>'; paintBtn(); }
  const badge = () => { const n = R.offers.filter(o => o.to_id === R.me.id && o.status === 'open').length; return n ? ' <i>' + n + '</i>' : ''; };
  function viewMarket() { const items = stock();
    return '<p class="mk-sub">Graded slabs from collectors around the motu, new every day. Prices follow the market.</p><div class="mk-grid">'
      + items.map((it, i) => tile(it.slab, { price: it.price, attr: 'data-a="stock" data-i="' + i + '"' + (it.sold ? ' disabled' : ''), extra: '<span class="mk-who">' + (it.sold ? 'Sold' : 'from ' + esc(it.seller)) + '</span>' })).join('') + '</div>'; }
  function viewMine() { const d = D(), mine = owned(), sel = U.sel && store.pull(U.sel);
    let h = '';
    if (d.listings.length) h += '<h4>Online now</h4><div class="mk-rows">' + d.listings.map(l => { const s = store.pull(l.id); if (!s) return ''; const v = value(s);
      return '<div class="mk-row"><span class="mk-dot" style="--tc:' + (TIER[s.tier] || TIER.common).color + '"></span><b>' + esc(s.title) + '</b><span>' + fmt(l.price) + ' coins · worth ' + fmt(v) + '</span>'
        + (l.offer ? '<span class="mk-off">' + esc(l.offer.buyer) + ' offers ' + fmt(l.offer.amount) + '</span><button type="button" data-a="takeoffer" data-id="' + l.id + '">Accept</button><button type="button" data-a="nooffer" data-id="' + l.id + '">No thanks</button>' : '')
        + '<button type="button" data-a="unlist" data-id="' + l.id + '">Take down</button></div>'; }).join('') + '</div>';
    if (sel) { const v = value(sel); h += '<div class="mk-check"><div>' + tile(sel) + '</div><div class="mk-cv"><h4>Market value</h4><p class="mk-big">' + fmt(v) + ' <small>coins</small></p>' + spark(sel)
      + '<p class="mk-sub">Thirty days of ' + esc((FINISH[finOf(sel)] || {}).name || 'this finish') + ' at this tier and grade.' + (sel.graded ? '' : ' Raw cards sell for less: nobody knows the grade yet.') + '</p>'
      + '<label class="mk-in">Price <input type="number" min="1" step="1" value="' + v + '" data-in="price"> coins</label><p class="mk-sub">Near its value sells within a day or so. Dearer waits longer, or draws an offer. The market keeps 5%.</p>'
      + '<button type="button" class="mk-go" data-a="list" data-id="' + sel.id + '">Put it online</button></div></div>'; }
    h += '<h4>Your slabs <small>' + mine.length + '</small></h4><p class="mk-sub">Pick one to check its value or sell it.</p><div class="mk-grid">' + mine.map(s => tile(s, { sel: U.sel === s.id, attr: 'data-a="pick" data-id="' + s.id + '"' })).join('') + '</div>';
    if (d.sales.length) h += '<h4>Sold</h4><div class="mk-rows">' + d.sales.slice(0, 12).map(x => '<div class="mk-row"><span class="mk-dot" style="--tc:' + (TIER[x.tier] || TIER.common).color + '"></span><b>' + esc(x.title) + '</b><span>to ' + esc(x.buyer) + ' for ' + fmt(x.price) + '</span></div>').join('') + '</div>';
    return h; }
  function signedOut() { return '<p class="mk-sub">Sign in with Google to trade with other players. In a class you trade with your class; on the demo, with other demo players.</p>' + (R.err ? '<p class="mk-err">' + esc(R.err) + '</p>' : ''); }
  function viewPlayers() { if (!live()) return signedOut(); if (R.err) return '<p class="mk-err">' + esc(R.err) + '</p>';
    if (!U.who) return '<p class="mk-sub">' + (R.lobby === 'studium-lobby:open' ? 'Collectors on the demo.' : 'Collectors in your class.') + ' Open one to see their slabs and make an offer.</p><div class="mk-rows">'
      + (R.shelves.length ? R.shelves.map((p, i) => '<button type="button" class="mk-row mk-pl" data-a="who" data-i="' + i + '"><b>' + esc(p.name) + '</b><span>' + (p.cards || []).length + ' slabs</span><span>Open their binder</span></button>').join('') : '<p class="mk-sub">Nobody else has their shelf up yet.</p>') + '</div>';
    const p = U.who, theirs = p.cards || [], mine = owned(), side = U.side;
    let h = '<div class="mk-tr2"><button type="button" data-a="back">‹ Players</button><b>' + esc(p.name) + '</b><div class="mk-sw"><button type="button" data-a="side" data-v="theirs" class="' + (side === 'theirs' ? 'on' : '') + '">Their binder</button><button type="button" data-a="side" data-v="mine" class="' + (side === 'mine' ? 'on' : '') + '">Yours</button></div></div>';
    h += '<p class="mk-sub">' + (side === 'theirs' ? 'Pick what you would like from them.' : 'Pick what you would give.') + '</p><div class="mk-grid">'
      + (side === 'theirs' ? theirs.map(s => tile(s, { sel: U.want.has(s.id), attr: 'data-a="want" data-id="' + esc(s.id) + '"' })) : mine.map(s => tile(s, { sel: U.give.has(s.id), attr: 'data-a="give" data-id="' + s.id + '"' }))).join('') + '</div>';
    const wv = theirs.filter(s => U.want.has(s.id)).reduce((a, s) => a + value(s), 0), gv = mine.filter(s => U.give.has(s.id)).reduce((a, s) => a + value(s), 0);
    h += '<div class="mk-deal"><div><b>You get</b> ' + U.want.size + ' slab' + (U.want.size === 1 ? '' : 's') + ' (worth about ' + fmt(wv) + ')<label class="mk-in">and <input type="number" min="0" step="10" value="' + U.coinsWant + '" data-in="cw"> coins</label></div>'
      + '<div><b>You give</b> ' + U.give.size + ' slab' + (U.give.size === 1 ? '' : 's') + ' (worth about ' + fmt(gv) + ')<label class="mk-in">and <input type="number" min="0" step="10" value="' + U.coinsGive + '" data-in="cg"> coins</label></div>'
      + '<button type="button" class="mk-go" data-a="send"' + (U.want.size + U.give.size + U.coinsGive + U.coinsWant ? '' : ' disabled') + '>Send the offer</button></div>';
    return h; }
  function viewOffers() { if (!live()) return signedOut(); if (R.err) return '<p class="mk-err">' + esc(R.err) + '</p>'; if (!R.offers.length) return '<p class="mk-sub">No offers yet. Open a player\'s binder to make one.</p>';
    const line = side => { const c = (side.cards || []).length; return (c ? c + ' slab' + (c === 1 ? '' : 's') : '') + (c && side.coins ? ' and ' : '') + (side.coins ? fmt(side.coins) + ' coins' : '') || 'nothing'; };
    return '<div class="mk-rows">' + R.offers.map(o => { const mine = R.me && o.from_id === R.me.id, other = mine ? o.to_name : o.from_name;
      const youGet = mine ? o.want : o.give, youGive = mine ? o.give : o.want, st = { open: mine ? 'Waiting' : 'For you', accepted: 'Done', done: 'Done', declined: 'Declined', cancelled: 'Cancelled' }[o.status];
      return '<div class="mk-row mk-offer"><b>' + esc(other) + '</b><span>You get ' + line(youGet || {}) + ' · you give ' + line(youGive || {}) + '</span><em>' + st + '</em>'
        + (o.status === 'open' ? (mine ? '<button type="button" data-a="cancel" data-o="' + o.id + '">Cancel</button>' : '<button type="button" data-a="look" data-o="' + o.id + '">Look</button><button type="button" class="mk-go" data-a="accept" data-o="' + o.id + '">Accept</button><button type="button" data-a="counter" data-o="' + o.id + '">Counter</button><button type="button" data-a="decline" data-o="' + o.id + '">Decline</button>') : '')
        + (U.look === o.id ? '<div class="mk-grid">' + (youGet.cards || []).map(s => tile(s, { extra: '<span class="mk-who">you get</span>' })).join('') + (youGive.cards || []).map(s => tile(s, { extra: '<span class="mk-who">you give</span>' })).join('') + '</div>' : '') + '</div>'; }).join('') + '</div>'; }
  function viewWallet() { const d = D(), e = (() => { try { return H() && H().earnings ? H().earnings() : null; } catch (x) { return null; } })();
    return '<div class="mk-wal"><p class="mk-big">' + fmt(d.coins) + ' <small>coins</small></p><p class="mk-sub">You earn coins in Studium: ' + PER_ACH + ' for every achievement level, ' + PER_QUEST + ' for every quest you finish.' + (e ? ' So far: ' + e.ach + ' achievement levels, ' + e.quests + ' quests.' : '') + '</p>'
      + '<p class="mk-big">' + (S.dev.opt('keys') === 'free' ? '∞' : d.keys) + ' <small>keys</small></p><p class="mk-sub">A pull takes a key. You get ' + FREE_KEYS + ' free every day.</p><button type="button" class="mk-go" data-a="key">Buy a key for ' + KEY_PRICE + ' coins</button></div>'; }
  el.addEventListener('input', e => { const i = e.target.closest('[data-in]'); if (!i) return; const v = Math.max(0, Math.round(+i.value || 0)); if (i.dataset.in === 'cg') U.coinsGive = v; else if (i.dataset.in === 'cw') U.coinsWant = v; });
  el.addEventListener('click', async e => { const t = e.target.closest('[data-tab],[data-a]'); if (!t || t.disabled) return; e.stopPropagation(); const a = t.dataset.a;
    if (t.dataset.tab) { U.tab = t.dataset.tab; U.who = null; open(); return; }
    try {
      if (a === 'close') close();
      else if (a === 'stock') { buyStock(+t.dataset.i); render(); }
      else if (a === 'pick') { U.sel = U.sel === t.dataset.id ? null : t.dataset.id; render(); }
      else if (a === 'list') { const p = el.querySelector('[data-in="price"]'); list(t.dataset.id, +(p && p.value) || value(store.pull(t.dataset.id))); U.sel = null; render(); }
      else if (a === 'unlist') { unlist(t.dataset.id); render(); }
      else if (a === 'takeoffer') { const l = D().listings.find(x => x.id === t.dataset.id); if (l && l.offer) sell(l, l.offer.amount, l.offer.buyer); render(); }
      else if (a === 'nooffer') { const l = D().listings.find(x => x.id === t.dataset.id); if (l) { l.offer = null; store.save(); } render(); }
      else if (a === 'key') { buyKey(); render(); }
      else if (a === 'who') { U.who = R.shelves[+t.dataset.i]; U.side = 'theirs'; U.want.clear(); U.give.clear(); U.coinsGive = U.coinsWant = 0; render(); }
      else if (a === 'back') { U.who = null; render(); }
      else if (a === 'side') { U.side = t.dataset.v; render(); }
      else if (a === 'want' || a === 'give') { const set = a === 'want' ? U.want : U.give, id = t.dataset.id; set.has(id) ? set.delete(id) : set.add(id); render(); }
      else if (a === 'send') { const p = U.who; t.disabled = true; await send(p, { ids: [...U.give], coins: U.coinsGive }, { cards: (p.cards || []).filter(s => U.want.has(s.id)), coins: U.coinsWant }); S.toast('Offer sent to ' + p.name + '. Your side waits safely until they answer.'); U.who = null; U.tab = 'offers'; await loadOffers(); render(); }
      else if (a === 'look') { U.look = U.look === t.dataset.o ? null : t.dataset.o; render(); }
      else { const o = R.offers.find(x => x.id === t.dataset.o); if (!o) return;
        if (a === 'accept') { await accept(o); await loadOffers(); render(); }
        else if (a === 'decline') { await decline(o); await loadOffers(); render(); }
        else if (a === 'cancel') { await cancel(o); await loadOffers(); render(); }
        else if (a === 'counter') { await decline(o); await loadShelves(); const p = R.shelves.find(x => x.user_id === o.from_id) || { user_id: o.from_id, name: o.from_name, cards: [] };
          U.who = p; U.side = 'theirs'; U.want = new Set(((o.give && o.give.cards) || []).map(c => c.id)); U.give = new Set(((o.want && o.want.cards) || []).map(c => c.id)); U.coinsGive = (o.want && o.want.coins) || 0; U.coinsWant = (o.give && o.give.coins) || 0; U.tab = 'players'; render(); } }
    } catch (err) { S.toast(err && err.message && !/^sync/.test(err.message) ? err.message : 'That didn\'t go through. Check you\'re online and try again.'); render(); } });
  ['pointerdown', 'wheel', 'keydown'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));

  /* ---------- the heartbeat ---------- */
  setInterval(() => { if (!S.unlocked()) { paintBtn(); return; } earn(); simulate(); if (el.classList.contains('on') && U.tab !== 'players') render(); }, 20000);
  setInterval(() => { if (S.unlocked()) poll(); }, 30000);
  setTimeout(() => { if (S.unlocked()) { earn(true); refillKeys(); simulate(); poll(); } paintBtn(); }, 1500);
  S.market = { value, history, spendKey, buyKey, open, close, earn, poll, keys: () => (S.dev.opt('keys') === 'free' ? '∞' : D().keys), coins: () => D().coins, paint: paintBtn,
    __sim: (hrs) => { D().listings.forEach(l => { l.t = Date.now() - hrs * 36e5; }); simulate(); } };
}

const CSS = `
#skMk{ position:fixed; right:max(16px, env(safe-area-inset-right,0px)); bottom:calc(40px + env(safe-area-inset-bottom,0px)); display:none; align-items:center; gap:8px; font:500 10px/1 var(--f-mono); letter-spacing:.14em; color:var(--text); background:rgba(20,18,16,.82); border:1px solid rgba(227,173,87,.45); border-radius:999px; padding:8px 12px; cursor:pointer; z-index:12; }
#skMk.on{ display:flex; } #skMk:hover{ border-color:var(--accent); }
#skMk b{ font-weight:500; color:var(--accent); } #skMk i{ font-style:normal; background:#e34b3a; color:#fff; border-radius:999px; padding:2px 6px; }
#skMarket{ position:fixed; right:max(14px, env(safe-area-inset-right,0px)); top:calc(70px + env(safe-area-inset-top,0px)); bottom:calc(84px + env(safe-area-inset-bottom,0px)); width:min(760px, calc(100vw - 28px)); display:flex; flex-direction:column; background:rgba(18,16,14,.96); border:1px solid var(--line); border-radius:10px; box-shadow:0 24px 60px rgba(0,0,0,.5); z-index:14; opacity:0; pointer-events:none; transform:translateY(8px); transition:opacity .2s, transform .3s cubic-bezier(.2,.8,.2,1); color:var(--text); font:400 13px/1.4 var(--f-ui); }
#skMarket.on{ opacity:1; pointer-events:auto; transform:none; }
#skMarket .mk-hd{ display:flex; align-items:center; gap:12px; padding:14px 12px 10px 18px; border-bottom:1px solid var(--line); }
#skMarket .mk-hd b{ font:500 12px/1 var(--f-mono); letter-spacing:.2em; text-transform:uppercase; color:var(--accent); } #skMarket .mk-hd span{ flex:1; font:500 11px/1 var(--f-mono); color:var(--faint); letter-spacing:.08em; }
#skMarket .mk-x{ width:28px; height:28px; border:0; background:none; color:var(--faint); font-size:20px; cursor:pointer; }
#skMarket .mk-tabs{ display:flex; gap:4px; padding:8px 14px; border-bottom:1px solid var(--line); flex-wrap:wrap; }
#skMarket .mk-tabs button{ border:1px solid transparent; background:none; color:var(--faint); font:500 12px/1 var(--f-ui); padding:8px 10px; border-radius:6px; cursor:pointer; }
#skMarket .mk-tabs button.on{ color:var(--text); border-color:var(--line); background:rgba(255,255,255,.04); } #skMarket i{ font-style:normal; background:#e34b3a; color:#fff; border-radius:999px; padding:1px 6px; font-size:10px; }
#skMarket .mk-body{ flex:1; overflow:auto; padding:14px 18px 20px; }
#skMarket h4{ margin:16px 0 6px; font:500 11px/1 var(--f-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--faint); } #skMarket h4 small{ color:var(--accent); }
#skMarket .mk-sub{ margin:4px 0 10px; color:rgba(244,241,234,.6); font-size:12.5px; } #skMarket .mk-err{ color:#ff9a7a; }
#skMarket .mk-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:10px; }
#skMarket .mk-card{ position:relative; display:flex; flex-direction:column; gap:4px; text-align:left; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,.08); border-top:3px solid var(--tc); background:rgba(255,255,255,.03); color:var(--text); cursor:pointer; font:inherit; }
#skMarket .mk-card:hover{ background:rgba(255,255,255,.06); } #skMarket .mk-card.sel{ outline:2px solid var(--accent); } #skMarket .mk-card[disabled]{ opacity:.4; cursor:default; }
#skMarket .mk-ph{ display:block; aspect-ratio:3/2; border-radius:4px; background:#222 center/cover no-repeat; }
#skMarket .mk-card b{ font-size:12px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } #skMarket .mk-meta{ font-size:10.5px; color:rgba(244,241,234,.55); }
#skMarket .mk-v{ font:500 12px/1 var(--f-mono); color:var(--accent); } #skMarket .mk-v small{ color:var(--faint); } #skMarket .mk-who{ font-size:10.5px; color:rgba(244,241,234,.5); }
#skMarket .mk-rows{ display:flex; flex-direction:column; gap:6px; }
#skMarket .mk-row{ display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding:9px 10px; border:1px solid rgba(255,255,255,.07); border-radius:8px; background:rgba(255,255,255,.025); color:var(--text); font:inherit; text-align:left; }
#skMarket .mk-row span{ color:rgba(244,241,234,.6); font-size:12px; } #skMarket .mk-row b{ font-weight:500; } #skMarket .mk-row em{ margin-left:auto; font-style:normal; font:500 10px/1 var(--f-mono); letter-spacing:.12em; text-transform:uppercase; color:var(--accent); }
#skMarket .mk-pl{ cursor:pointer; } #skMarket .mk-pl span:last-child{ margin-left:auto; color:var(--accent); }
#skMarket .mk-row button, #skMarket .mk-tr2 button, #skMarket .mk-sw button{ border:1px solid var(--line); background:rgba(255,255,255,.04); color:var(--text); font:500 11.5px/1 var(--f-ui); padding:7px 10px; border-radius:6px; cursor:pointer; }
#skMarket .mk-dot{ width:8px; height:8px; border-radius:50%; background:var(--tc); } #skMarket .mk-off{ color:#ffd889 !important; }
#skMarket .mk-check{ display:grid; grid-template-columns:170px 1fr; gap:16px; padding:12px; border:1px solid var(--line); border-radius:10px; margin-bottom:6px; }
#skMarket .mk-big{ margin:2px 0; font:500 26px/1.1 var(--f-mono); color:var(--text); } #skMarket .mk-big small{ font-size:12px; color:var(--faint); }
#skMarket .mk-sp{ width:100%; max-width:260px; height:46px; display:block; } #skMarket .mk-sp polyline{ fill:none; stroke:var(--accent); stroke-width:1.6; }
#skMarket .mk-tr{ font:500 11px/1 var(--f-mono); } #skMarket .mk-tr.up{ color:#7fd88a; } #skMarket .mk-tr.dn{ color:#ff8a7a; }
#skMarket .mk-in{ display:inline-flex; align-items:center; gap:6px; margin:6px 0; font-size:12.5px; color:rgba(244,241,234,.7); } #skMarket .mk-in input{ width:90px; height:30px; border-radius:6px; border:1px solid var(--line); background:rgba(0,0,0,.3); color:var(--text); font:500 13px var(--f-mono); padding:0 8px; }
#skMarket .mk-go{ border:0 !important; background:var(--accent) !important; color:#1a1410 !important; font:600 12px/1 var(--f-ui); padding:10px 14px; border-radius:7px; cursor:pointer; } #skMarket .mk-go[disabled]{ opacity:.4; cursor:default; }
#skMarket .mk-tr2{ display:flex; align-items:center; gap:12px; margin-bottom:8px; } #skMarket .mk-tr2 b{ font-size:15px; font-weight:500; } #skMarket .mk-sw{ margin-left:auto; display:flex; gap:4px; } #skMarket .mk-sw button.on{ background:var(--text); color:#1a1714; }
#skMarket .mk-deal{ position:sticky; bottom:-20px; display:flex; flex-wrap:wrap; gap:16px; align-items:center; margin-top:14px; padding:12px; border:1px solid var(--line); border-radius:10px; background:rgba(18,16,14,.98); } #skMarket .mk-deal>div{ display:flex; flex-direction:column; gap:2px; }
#skMarket .mk-wal{ display:flex; flex-direction:column; gap:4px; align-items:flex-start; }
@media (max-width:640px){ #skMarket .mk-check{ grid-template-columns:1fr; } }
`;
