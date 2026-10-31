// COLLECTION: the encyclopedia of slabs and originals, shared by the binder's Index and Who Shot It?'s hide step
// (Sam: "duplicates... higher rarity first but you can switch to the other dupes behind it, an all slabs tab,
// changing orders and tabs for each artist... more like an encyclopedia so has both slabs and originals").
//   Stacks    every copy of one photograph is one stack: the rarest on top (then the best grade, then the newest);
//             ‹ › turn to the copies behind it. A painted stand-in stacks by its plate.
//   Tabs      All slabs (every stack you own), then one tab per artist: every original of theirs, yours as slabs on
//             top of the photo, the rest as the original print, dimmed, with "Not collected" and a count for the tab.
//   Order     Rarity, Grade, Newest, Value (the market's), Plate; All slabs can also go by Artist.
//   mount(host, { pick(slab), can(slab) → bool, used: Set, only: 'owned' }) draws into host and returns { render };
//   open() shows it full screen (the binder's Index). Pick mode: a click on the top card hands that copy back.
const ORDERS = [['rarity', 'Rarity'], ['grade', 'Grade'], ['newest', 'Newest'], ['value', 'Value'], ['plate', 'Plate'], ['artist', 'Artist']];
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const artistName = pk => String(pk.name || '').replace(/\s*·.*$/, '');

export function install(S) {
  const { SL, store } = S;
  S.css(CSS);
  /* rarer is higher here (SL.RANK counts the other way, mythic 1) */
  const rank = s => SL.TIERS.findIndex(t => t.id === s.tier), grade = s => s.graded ? s.grade : 0;
  const best = (a, b) => rank(b) - rank(a) || grade(b) - grade(a) || (b.ts || 0) - (a.ts || 0);
  const owned = () => (S.market && S.market.owned ? S.market.owned() : store.get().pulls).filter(s => s && s.photo);
  const keyOf = s => s.photo.imgId != null ? String(s.photo.packId) + ':' + s.photo.imgId : 'plate:' + (s.photo.plate || 1);
  const artists = () => (S.packs() || []).filter(p => p && !p.sample && p.imgs && p.imgs.length).map(p => ({ id: String(p.id), name: artistName(p), imgs: p.imgs }));
  const thumbs = new Map();
  function thumb(s) { const p = s.photo || {}; if (p.url && !/^blob:/.test(p.url)) return p.url; const k = 'p' + (p.plate || 1) + ':' + s.seed; if (thumbs.has(k)) return thumbs.get(k);
    let u = ''; try { u = S.paintPhoto(S.KINDS[(p.plate || 1) % S.KINDS.length], s.seed || 1, 240, 170).toDataURL('image/jpeg', 0.75); } catch (e) {} thumbs.set(k, u); return u; }
  const value = s => { try { return S.market ? S.market.value(s) : 0; } catch (e) { return 0; } };

  /* the stacks for a tab: owned copies grouped by photograph; an artist tab adds the originals not yet collected */
  function stacks(tab, only) { const A = artists(), byKey = new Map();
    owned().forEach(s => { if (tab !== 'all' && String(s.photo.packId) !== tab) return; const k = keyOf(s); if (!byKey.has(k)) byKey.set(k, { key: k, copies: [], plate: s.photo.plate || 0, artist: s.photo.packId != null ? String(s.photo.packId) : '', url: thumb(s) }); byKey.get(k).copies.push(s); });
    byKey.forEach(st => st.copies.sort(best));
    if (tab !== 'all' && only !== 'owned') { const a = A.find(x => x.id === tab); if (a) a.imgs.forEach((im, i) => { const k = a.id + ':' + im.id; if (!byKey.has(k)) byKey.set(k, { key: k, copies: [], plate: i + 1, artist: a.id, url: im.url }); }); }
    return [...byKey.values()]; }
  function order(list, by, A) { const top = st => st.copies[0], nm = st => ((A.find(a => a.id === st.artist) || {}).name || '');
    const f = { rarity: (a, b) => (top(b) ? rank(top(b)) : -1) - (top(a) ? rank(top(a)) : -1) || (top(a) && top(b) ? best(top(a), top(b)) : 0),
      grade: (a, b) => (top(b) ? grade(top(b)) : -1) - (top(a) ? grade(top(a)) : -1), newest: (a, b) => (top(b) ? top(b).ts || 0 : -1) - (top(a) ? top(a).ts || 0 : -1),
      value: (a, b) => (top(b) ? value(top(b)) : -1) - (top(a) ? value(top(a)) : -1), plate: (a, b) => nm(a).localeCompare(nm(b)) || a.plate - b.plate,
      artist: (a, b) => nm(a).localeCompare(nm(b)) || a.plate - b.plate }[by] || (() => 0);
    return list.sort((a, b) => f(a, b) || a.plate - b.plate); }

  function mount(host, opts) { opts = opts || {}; const U = { tab: 'all', by: 'rarity', at: {} };
    host.classList.add('cl');
    function render() { const A = artists(), mine = owned(), tabs = [['all', 'All slabs', mine.length]].concat(A.map(a => { const got = new Set(mine.filter(s => String(s.photo.packId) === a.id).map(keyOf)); return [a.id, a.name, got.size + ' / ' + a.imgs.length]; }));
      if (!tabs.some(t => t[0] === U.tab)) U.tab = 'all'; if (U.tab !== 'all' && U.by === 'artist') U.by = 'plate';
      const list = order(stacks(U.tab, opts.only), U.by, A);
      let h = '<nav class="cl-tabs">' + tabs.map(t => '<button type="button" data-cl="tab" data-id="' + esc(t[0]) + '" class="' + (t[0] === U.tab ? 'on' : '') + '">' + esc(t[1]) + '<i>' + t[2] + '</i></button>').join('') + '</nav>'
        + '<div class="cl-bar"><span>Order</span>' + ORDERS.filter(o => o[0] !== 'artist' || U.tab === 'all').map(o => '<button type="button" data-cl="by" data-id="' + o[0] + '" class="' + (o[0] === U.by ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div>';
      h += list.length ? '<div class="cl-grid">' + list.map(card).join('') + '</div>' : '<p class="cl-none">' + (U.tab === 'all' ? 'No slabs yet. Your pulls show up here.' : 'Nothing from this artist yet.') + '</p>';
      host.innerHTML = h; }
    function card(st) { const n = st.copies.length;
      if (!n) return '<div class="cl-card orig"><div class="cl-ph"><img src="' + esc(st.url) + '" alt="" loading="lazy"></div><div class="cl-meta"><b>Plate ' + String(st.plate).padStart(3, '0') + '</b><span>Not collected</span></div></div>';
      const i = Math.min(U.at[st.key] || 0, n - 1), s = st.copies[i], t = SL.tierOf(s), off = opts.can && !opts.can(s) || opts.used && opts.used.has(s.id);
      return '<div class="cl-card' + (off ? ' off' : '') + (opts.pick ? ' pk' : '') + '" style="--tc:' + t.color + '" data-cl="card" data-id="' + esc(s.id) + '">' + (n > 1 ? '<div class="cl-behind" style="--n:' + Math.min(3, n - 1) + '"></div>' : '')
        + '<div class="cl-ph"><img src="' + esc(thumb(s)) + '" alt="" loading="lazy"></div><div class="cl-meta"><b>' + esc(t.name) + '</b><span>' + (s.graded ? 'Grade ' + s.grade : 'Raw') + SL.lookNames(s).map(n => ' · ' + esc(n)).join('') + '</span></div>'
        + (n > 1 ? '<div class="cl-dup"><button type="button" data-cl="prev" data-k="' + esc(st.key) + '" aria-label="The copy in front">‹</button><span>' + (i + 1) + ' of ' + n + '</span><button type="button" data-cl="next" data-k="' + esc(st.key) + '" aria-label="The copy behind">›</button></div>' : '') + '</div>'; }
    host.addEventListener('click', e => { const b = e.target.closest('[data-cl]'); if (!b) return; const a = b.dataset.cl;
      if (a === 'tab') { U.tab = b.dataset.id; render(); host.scrollTop = 0; return; }
      if (a === 'by') { U.by = b.dataset.id; render(); return; }
      if (a === 'prev' || a === 'next') { e.stopPropagation(); const st = stacks(U.tab, opts.only).find(x => x.key === b.dataset.k), n = st ? st.copies.length : 1; U.at[b.dataset.k] = ((U.at[b.dataset.k] || 0) + (a === 'next' ? 1 : -1) + n) % n; render(); return; }
      if (a === 'card' && opts.pick && !b.classList.contains('off')) { const s = store.pull(b.dataset.id); if (s) opts.pick(s); } });
    render(); return { render }; }

  /* full screen, for the binder's Index */
  const el = S.el('div', 'cl-full', '<header><div><b>INDEX</b><span>EVERY SLAB AND ORIGINAL</span></div><button type="button" class="cl-x" aria-label="Close the index">×</button></header><main></main>'); el.id = 'skIndex'; document.body.appendChild(el);
  const view = mount(el.querySelector('main'), {});
  ['pointerdown', 'wheel', 'keydown'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
  el.querySelector('.cl-x').addEventListener('click', () => close());
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('on')) { e.stopPropagation(); close(); } }, true);
  function open() { view.render(); el.classList.add('on'); }
  function close() { el.classList.remove('on'); }
  S.collection = { mount, open, close };
}

const CSS = `
.cl{ --c-p:#141210; --c-ln:rgba(244,241,234,.1); --c-mut:rgba(244,241,234,.55); }
.cl .cl-tabs{ display:flex; gap:4px; overflow-x:auto; border-bottom:1px solid var(--c-ln); padding-bottom:0; scrollbar-width:thin; }
.cl .cl-tabs button{ flex:none; display:flex; align-items:baseline; gap:8px; padding:9px 14px; border:1px solid transparent; border-bottom:0; border-radius:6px 6px 0 0; background:none; color:var(--c-mut); font:500 12px var(--f-ui); cursor:pointer; }
.cl .cl-tabs button i{ font:500 10px var(--f-mono); font-style:normal; opacity:.7; } .cl .cl-tabs button:hover{ color:var(--text); } .cl .cl-tabs button.on{ color:var(--text); background:var(--c-p); border-color:var(--c-ln); }
.cl .cl-bar{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin:12px 0 16px; } .cl .cl-bar span{ font:500 9px var(--f-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--c-mut); margin-right:4px; }
.cl .cl-bar button{ padding:5px 10px; border:1px solid var(--c-ln); border-radius:999px; background:none; color:var(--c-mut); font:500 11px var(--f-ui); cursor:pointer; } .cl .cl-bar button.on{ color:#16120c; background:var(--accent); border-color:var(--accent); }
.cl .cl-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:18px 14px; }
.cl .cl-card{ position:relative; display:flex; flex-direction:column; gap:6px; padding:7px; background:var(--c-p); border:1px solid var(--c-ln); border-top:3px solid var(--tc, var(--c-ln)); border-radius:8px; }
.cl .cl-card.pk{ cursor:pointer; } .cl .cl-card.pk:hover:not(.off){ border-color:var(--tc); } .cl .cl-card.off{ opacity:.3; } .cl .cl-card.pk.off{ cursor:default; }
.cl .cl-behind{ position:absolute; inset:0; z-index:-1; pointer-events:none; }
.cl .cl-behind::before, .cl .cl-behind::after{ content:''; position:absolute; inset:0; border-radius:8px; background:#100f0d; border:1px solid var(--c-ln); }
.cl .cl-behind::before{ transform:translate(5px,5px); } .cl .cl-behind::after{ transform:translate(10px,10px); opacity:calc((var(--n) - 1) * .8); }
.cl .cl-ph img{ display:block; width:100%; aspect-ratio:3/2; object-fit:cover; border-radius:3px; background:#000; }
.cl .cl-meta{ display:flex; justify-content:space-between; gap:6px; font:500 11px var(--f-mono); } .cl .cl-meta b{ font-weight:500; color:var(--tc, var(--text)); } .cl .cl-meta span{ color:var(--c-mut); }
.cl .cl-card.orig{ border-style:dashed; border-top-width:1px; } .cl .cl-card.orig img{ filter:grayscale(1) brightness(.45); } .cl .cl-card.orig b{ color:var(--c-mut); }
.cl .cl-dup{ display:flex; align-items:center; justify-content:space-between; font:500 10px var(--f-mono); color:var(--c-mut); }
.cl .cl-dup button{ width:24px; height:22px; border:1px solid var(--c-ln); border-radius:4px; background:none; color:var(--text); cursor:pointer; } .cl .cl-dup button:hover{ border-color:var(--accent); }
.cl .cl-none{ color:var(--c-mut); }
#skIndex{ position:fixed; inset:0; z-index:40; display:flex; flex-direction:column; background:#0b0a09; color:var(--text); font:400 14px/1.5 var(--f-ui); opacity:0; pointer-events:none; transition:opacity .25s; }
#skIndex.on{ opacity:1; pointer-events:auto; }
#skIndex header{ display:flex; align-items:center; justify-content:space-between; height:56px; padding:0 14px 0 18px; border-bottom:1px solid rgba(244,241,234,.1); background:#141210; flex:none; }
#skIndex header div{ display:flex; flex-direction:column; line-height:1; } #skIndex header b{ font:600 13px var(--f-mono); letter-spacing:.24em; } #skIndex header span{ font:500 9px var(--f-mono); letter-spacing:.32em; color:var(--accent); margin-top:4px; }
#skIndex .cl-x{ width:32px; height:32px; border:1px solid rgba(244,241,234,.1); border-radius:6px; background:none; color:rgba(244,241,234,.55); font-size:18px; cursor:pointer; }
#skIndex main{ flex:1; overflow:auto; padding:20px 18px; }
`;
