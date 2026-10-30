// WHO SHOT IT?: name the artist of the other player's slab while its print comes up (Sam: "you have to guess which
// artist the other person's slab is"). Played on the dark table in 3D, like Blades.
//   Setup     a portal opens across the middle of the table; through it, the rival's side and their five slabs face
//             down. The binder pops up and you choose five of yours (S.binder.pick); each one flies out to sit face
//             up in a row in front of you.
//   A round   click one of your five: it flips face down and slides across, through the portal, to their side, while
//             theirs slides through to you. 3, 2, 1, then click it to flip it over and look closer (S.inspect). Its
//             print develops on the slab over DEV seconds: black and soft, then tone, then the picture. Take a guess
//             (or G) pops up every artist in play, each tile a random photo of theirs (fresh every time, never the
//             print in play). Right scores more the earlier it is (10 down to 1); wrong costs WRONG and locks you out
//             for LOCK seconds, and that tile stays grey. The round ends with the artist's name and nothing else
//             (Sam: a giveaway after is cringe). Both slabs slide home, used.
//   Rival     a simulated collector with five slabs rolled from the packs. How soon it knows a print is fixed per
//             photograph (h32 of the image), so hiding a photo it finds hard really helps. When it gets yours, your
//             slab turns face up on its side.
//   Stakes    nothing is staked. A win pays WIN_COINS, the first WIN_CAP wins a day (S.market.award); a streak of
//             wins in a row is kept with your best. Leaving a match part way counts as a loss.
// The lobby and result are a panel (#skWho) from the button above the exchange's; the match is states 'who.*' and a
// HUD (#skWhoHud). Needs ARTISTS_MIN artist packs and five of your slabs from them. Everything lives in d.who.
import * as THREE from 'three';

const DEV = 20, LOCK = 5, HAND = 5, WRONG = 3, WIN_COINS = 30, WIN_CAP = 3, ARTISTS_MIN = 6;
/* the layout on the dark table: centre-left, clear of the pit (right), the binder (front left) and the shelf */
/* the layout, low on the dark table (the top is kept for the PC): your five along the front edge, theirs arriving in
   front of you, the portal standing behind that; past the portal (z < PORTAL_Z) is their room, not this table */
const GX = 1.0, PORTAL_Z = 1.2, PR = 7.4, GAP = 2.3, HAND_Z = PORTAL_Z + 8.0, MINE_Z = PORTAL_Z + 3.8, THEIRS_Z = PORTAL_Z - 4.6, RIV_Z = PORTAL_Z - 2.2, RIV_GAP = 2.3, THEIR_EDGE = PORTAL_Z - 0.8;
const RIVALS = ['kiri.lens', 'tui_frames', 'harbourlight', 'ngaio.prints', 'fernfocus', 'southerly_slabs', 'te_awa_archive', 'flatwhite.film', 'kea_collects', 'lyttelton_light', 'gumboot_gallery', 'tarn_tones'];
const DAY = 864e5, today = () => Math.floor(Date.now() / DAY);
const h32 = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const artistName = pk => String(pk.name || '').replace(/\s*·.*$/, '');
const signed = n => (n > 0 ? '+' : '') + n, score = p => Math.max(1, Math.round(10 * (1 - p)));
const FLAT_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const DOWN_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI).multiply(FLAT_Q);

export function install(S) {
  const { store, M, T, SL, ctx } = S, K = S.TABLE_K || 0.42;
  const D = () => { const d = store.get(); if (!d.who) d.who = { streak: 0, best: 0, played: 0, won: 0, day: today(), paid: 0 }; if (d.who.day !== today()) { d.who.day = today(); d.who.paid = 0; } return d.who; };

  /* ---------- test artists, for a browser with no packs (Sam: "there's no connected artist packs so I can't test it") ----------
     Seven made-up artists, six painted photos each, every artist with a look of its own so they can be told apart.
     Turned on from the lobby; nine test slabs from them go into your binder (marked test), and come out again with
     the lobby's other button, which also turns the test artists off. */
  const TEST = [['Mono Studio', 'grayscale(1) contrast(1.45)'], ['Sepia Days', 'sepia(0.85) contrast(1.1) brightness(1.05)'], ['Night Grain', 'grayscale(1) contrast(2.1) brightness(0.7)'],
    ['Soft Focus', 'blur(1.6px) brightness(1.18) saturate(0.7)'], ['Vivid Colour', 'saturate(2.2) contrast(1.2)'], ['Cool Blue', 'hue-rotate(150deg) saturate(1.3) brightness(0.95)'], ['Warm Haze', 'sepia(0.35) saturate(1.5) hue-rotate(-18deg) brightness(1.1)']];
  let testPacks = null;
  function makeTestPacks() { if (testPacks) return testPacks; const c = document.createElement('canvas'); c.width = 480; c.height = 320; const g = c.getContext('2d');
    testPacks = TEST.map(([name, look], a) => ({ id: 'test' + a, name: name + ' · Test artist', test: true, imgs: Array.from({ length: 6 }, (_, i) => { let src = null;
      try { src = S.paintPhoto(S.KINDS[(a * 3 + i) % S.KINDS.length], 7000 + a * 31 + i, 480, 320); } catch (e) {}
      g.filter = 'none'; g.fillStyle = '#222'; g.fillRect(0, 0, 480, 320); g.filter = look; if (src) g.drawImage(src, 0, 0, 480, 320); g.filter = 'none';
      return { id: 'test' + a + '_' + i, url: c.toDataURL('image/jpeg', 0.72) }; }) }));
    return testPacks; }
  const realPacks = S.packs;
  S.packs = () => (D().test ? makeTestPacks() : realPacks());
  SL.setPhotoSource(S.packs);
  function testOn() { const w = D(); w.test = true; const packs = makeTestPacks();
    for (let i = 0; i < 9; i++) { const s = SL.roll({ graded: true, pack: packs[i % packs.length].id }); s.test = true; store.addPull(s); store.toBinder(s.id); }
    store.save(); S.hud(); S.toast('Test artists on. Nine test slabs are in your binder.'); render(); }
  function testOff() { const d = store.get(), gone = d.pulls.filter(p => p.test); gone.forEach(p => { d.points = Math.max(0, d.points - (p.points || 0)); store.discard(p.id); });
    D().test = false; store.save(); S.hud(); S.toast(gone.length ? 'The ' + gone.length + ' test slabs are gone and the test artists are off.' : 'Test artists are off.'); render(); }

  /* ---------- who is in play ---------- */
  const artists = () => (S.packs() || []).filter(p => p && !p.sample && p.imgs && p.imgs.length).map(p => ({ id: String(p.id), name: artistName(p), imgs: p.imgs }));
  const mine = () => { const A = new Set(artists().map(a => a.id)), own = S.market && S.market.owned ? S.market.owned() : store.get().pulls;
    return own.filter(s => s.photo && s.photo.url && A.has(String(s.photo.packId))); };
  const rarer = (a, b) => SL.TIERS.findIndex(t => t.id === b.tier) - SL.TIERS.findIndex(t => t.id === a.tier) || (b.graded ? b.grade : 0) - (a.graded ? a.grade : 0);
  const nameOf = id => (G && G.A.find(a => a.id === id) || {}).name || 'Unknown';

  /* ---------- the lobby and result panel ---------- */
  S.css(CSS);
  const btn = S.el('button', 'ws-btn', '<span>WHO SHOT IT?</span><b></b>'); btn.type = 'button'; btn.id = 'skWhoBtn'; document.body.appendChild(btn);
  const el = S.el('div', 'ws', ''); el.id = 'skWho'; document.body.appendChild(el);
  const hud = S.el('div', 'wh', ''); hud.id = 'skWhoHud'; document.body.appendChild(hud);
  btn.addEventListener('click', () => { if (G) return; el.classList.contains('on') ? close() : open(); });
  function paintBtn() { const on = S.unlocked() && !G; btn.classList.toggle('on', on && !el.classList.contains('on')); if (!on) return; const w = D(); btn.querySelector('b').textContent = w.streak ? 'Streak ' + w.streak : ''; }
  [el, hud].forEach(x => ['pointerdown', 'wheel', 'keydown'].forEach(ev => x.addEventListener(ev, e => e.stopPropagation())));
  window.addEventListener('keydown', e => { if (el.classList.contains('on') && e.key === 'Escape') { e.stopPropagation(); close(); } }, true);
  el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'close') close(); else if (a === 'play') start(); else if (a === 'lobby') { last = null; render(); } else if (a === 'teston') testOn(); else if (a === 'testoff') testOff(); });
  hud.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.disabled || !G) return; const a = b.dataset.a;
    if (a === 'guess') openPicker(); else if (a === 'pick') guess(b.dataset.id); else if (a === 'unpick') { G.picker = false; paintHud(); }
    else if (a === 'next') { if (M.is('who.reveal')) M.go('who.return'); } else if (a === 'leave') { G.leaving = true; G.picker = false; paintHud(); }
    else if (a === 'stay') { G.leaving = false; paintHud(); } else if (a === 'forfeit') quit(true); });
  let last = null;
  function open() { if (!S.unlocked() || G) return; el.classList.add('on'); paintBtn(); render(); }
  function close() { el.classList.remove('on'); paintBtn(); }
  function render() { const w = D(), A = artists(), Mn = mine();
    let h = '<header class="ws-top"><div class="ws-brand"><b>WHO SHOT IT?</b><span>THE DARK TABLE</span></div><div class="ws-wal"><div><span>Streak</span><b>' + w.streak + '</b></div><div><span>Best</span><b>' + w.best + '</b></div><div><span>Paid wins today</span><b>' + w.paid + ' / ' + WIN_CAP + '</b></div><button type="button" class="ws-x" data-a="close" aria-label="Close">×</button></div></header><main class="ws-main">';
    if (last) { const R = last;
      h += '<section class="ws-done"><div class="ws-rd">' + (R.forfeit ? 'You left the match' : R.win ? 'You win' : R.tie ? 'A draw' : esc(R.rival) + ' wins') + '</div><h2>' + R.you + ' to ' + R.them + '</h2>'
        + (R.win ? '<p>' + (R.coins ? '+' + R.coins + ' coins. ' : 'No coins this time (that was today\'s ' + WIN_CAP + ' paid wins). ') + 'Streak ' + w.streak + (w.streak === w.best && w.streak > 1 ? ', your best.' : '.') + '</p>' : R.tie ? '<p>Your streak holds at ' + w.streak + '.</p>' : '<p>Your streak is back to 0. Best ' + w.best + '.</p>')
        + '<ol class="ws-log">' + R.rounds.map((x, i) => '<li><span>Round ' + (i + 1) + '</span><span>Theirs: ' + esc(x.theirs) + '</span><b>' + signed(x.mine) + '</b><span>Yours: ' + esc(x.yours) + '</span><b>' + signed(x.rival) + '</b></li>').join('') + '</ol>'
        + '<div class="ws-row"><button type="button" class="ws-go" data-a="play">Play again</button><button type="button" class="ws-ghost" data-a="lobby">Done</button></div></section>';
    } else {
      h += '<section class="ws-lobby"><h2>Name the photographer before the print comes up.</h2><p>Choose five of your slabs from the binder. Each round you send one across the table, face down, and theirs comes to you. Flip it and watch the print develop. Guess early for more points, but a wrong guess costs ' + WRONG + ' and locks you out for ' + LOCK + ' seconds.</p><p class="dim">A win pays ' + WIN_COINS + ' coins, ' + WIN_CAP + ' times a day. Nothing you own is at stake.</p>';
      if (A.length < ARTISTS_MIN) h += '<p class="ws-warn">This needs at least ' + ARTISTS_MIN + ' artist packs, and there ' + (A.length === 1 ? 'is ' : 'are ') + A.length + '. Open Research once so the packs load.</p><p class="dim">Or try it with made-up test artists. They come with nine test slabs, which you can take out again.</p><button type="button" class="ws-ghost" data-a="teston">Try it with test artists</button>';
      else if (Mn.length < HAND) h += '<p class="ws-warn">You need ' + HAND + ' slabs of artists\' photographs to play, and you have ' + Mn.length + '. Pull a few more first.</p>';
      else h += '<button type="button" class="ws-go" data-a="play">Play</button><p class="dim">' + A.length + ' artists in play · ' + Mn.length + ' of your slabs can play</p>';
      if (w.test) h += '<p class="dim ws-test">Test artists are on.</p><button type="button" class="ws-ghost" data-a="testoff">Take the test slabs out</button>';
      h += '</section>'; }
    el.innerHTML = h + '</main>'; paintBtn(); }

  /* ---------- the portal: a window onto the rival's own table, somewhere else ----------
     Their room is a scene of its own, drawn from your camera every frame into the portal's texture, so it lines up
     behind the portal like a window (its own scene keeps that draw cheap: none of the table is walked). Their table
     carries on behind the portal's plane; a slab past that plane lives in their room, this side of it on the table.
     The look (Sam: a black hole, Interstellar): a clean edge, a thin, faint holographic ring on it, and the view bent
     a little just inside the edge (lensing, a touch of colour split); the rest is a clear view of their table.
     It never turns: the dome stands still so it always shows through. */
  let props = null, loop = 0;
  const PORTAL_FRAG = `uniform sampler2D map; uniform vec2 res; uniform float time; uniform float k; varying vec2 vUv;
    void main(){ vec2 d = vUv - 0.5; float r = length(d) * 2.0; float a = atan(d.y, d.x); vec2 dir = d / max(1e-4, length(d));
      vec2 sc = gl_FragCoord.xy / res;
      float bend = pow(smoothstep(0.8, 1.0, r), 2.2);
      vec2 off = dir * bend * 0.018 + vec2(-dir.y, dir.x) * bend * 0.007 * sin(time * 0.45 + r * 9.0);
      vec3 c = vec3(texture2D(map, sc - off * 1.1).r, texture2D(map, sc - off).g, texture2D(map, sc - off * 0.9).b);
      c *= 1.0 - 0.3 * smoothstep(0.93, 0.985, r);
      vec3 holo = 0.6 + 0.4 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + a / 3.1416 + time * 0.06));
      float ring = exp(-pow((r - 0.992) / 0.0045, 2.0));
      c += ring * mix(vec3(1.0, 0.9, 0.78), holo, 0.35) * 0.9;
      c = mix(vec3(0.0), c, k);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const HALO_FRAG = `uniform float time; uniform float k; varying vec2 vUv;
    void main(){ vec2 d = vUv - 0.5; float r = length(d) * 2.0; float a = atan(d.y, d.x);
      vec3 holo = 0.6 + 0.4 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + a / 3.1416 - time * 0.05));
      float g = smoothstep(1.0, 0.99, r) * smoothstep(0.975, 0.99, r);
      gl_FragColor = vec4(holo * g * 0.16 * k, g * 0.16 * k); }`;
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  function buildProps() { if (props) return props;
    const g = new THREE.Group(); g.userData.secret = true; g.position.set(GX, 0, PORTAL_Z); g.visible = false; ctx.scene.add(g);
    const ring = new THREE.Group(); g.add(ring);   /* the dome's centre is on the table: a half disc standing up */
    const rt = new THREE.WebGLRenderTarget(2, 2, { samples: 2 }); rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(PR, 160, 0, Math.PI), new THREE.ShaderMaterial({ uniforms: { map: { value: rt.texture }, res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, k: { value: 0 } }, toneMapped: true, vertexShader: VERT, fragmentShader: PORTAL_FRAG }));
    disc.onBeforeRender = r => { const t = r.getRenderTarget(); if (t) disc.material.uniforms.res.value.set(t.width, t.height); else r.getDrawingBufferSize(disc.material.uniforms.res.value); };
    /* a faint holographic halo just outside the clean edge */
    const halo = new THREE.Mesh(new THREE.CircleGeometry(PR * 1.02, 160, 0, Math.PI), new THREE.ShaderMaterial({ uniforms: { time: disc.material.uniforms.time, k: disc.material.uniforms.k }, vertexShader: VERT, fragmentShader: HALO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.z = -0.01; ring.add(halo, disc);
    /* their room: their own walnut table just past the portal (its front edge in view), a warm lamp, dark walls and floor */
    const room = new THREE.Scene(); room.background = new THREE.Color(0x0c0a10);
    const wc = document.createElement('canvas'); wc.width = 512; wc.height = 512; const w = wc.getContext('2d'); w.fillStyle = '#3b2416'; w.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) { w.strokeStyle = 'rgba(' + Math.round(20 + Math.random() * 40) + ',' + Math.round(10 + Math.random() * 20) + ',5,' + (0.15 + Math.random() * 0.2).toFixed(2) + ')'; w.lineWidth = 1 + Math.random() * 3; w.beginPath(); const y = Math.random() * 512; w.moveTo(0, y); w.bezierCurveTo(170, y + Math.random() * 20 - 10, 340, y + Math.random() * 20 - 10, 512, y + Math.random() * 16 - 8); w.stroke(); }
    const wood = new THREE.CanvasTexture(wc); wood.colorSpace = THREE.SRGBColorSpace; wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2, 1.4);
    const top = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 10), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 })); top.position.set(GX, -0.3, THEIR_EDGE - 5); room.add(top);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: 0x0e0b0d, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.set(GX, -3.6, PORTAL_Z - 10); room.add(floor);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(15, 6.4), new THREE.MeshStandardMaterial({ color: 0x1d2a24, roughness: 0.95 })); mat.rotation.x = -Math.PI / 2; mat.position.set(GX, 0.005, THEIR_EDGE - 3.8); room.add(mat);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(70, 30, 60), new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 1, side: THREE.BackSide })); walls.position.set(GX, 12, PORTAL_Z - 12); room.add(walls);
    const lamp = new THREE.PointLight(0xffd7a0, 480, 34, 1.5); lamp.position.set(GX, 8, THEIR_EDGE - 4); room.add(lamp);
    const rim = new THREE.PointLight(0x7d6bff, 40, 30, 1.6); rim.position.set(GX - 7, 4, PORTAL_Z - 10); room.add(rim);
    room.add(new THREE.HemisphereLight(0xb8aaff, 0x2a1a10, 1.0));
    [g, ring, disc, halo].forEach(o => { o.userData.secret = true; o.userData.noParticles = true; });
    const pcam = new THREE.PerspectiveCamera();
    props = { g, ring, disc, rt, room, pcam }; return props; }
  /* render their room for the portal from your camera, every frame while the portal is up */
  const pv = new THREE.Vector3(), pq = new THREE.Quaternion(), psz = new THREE.Vector2();
  function portalFrame() { const P = props; if (!P || !P.g.visible) { loop = 0; return; } loop = requestAnimationFrame(portalFrame);
    const r = ctx.renderer, cam = ctx.camera; r.getDrawingBufferSize(psz); const w = Math.max(2, Math.round(psz.x * 0.5)), h = Math.max(2, Math.round(psz.y * 0.5));
    if (P.rt.width !== w || P.rt.height !== h) P.rt.setSize(w, h);
    cam.updateMatrixWorld(); P.pcam.position.copy(cam.getWorldPosition(pv)); P.pcam.quaternion.copy(cam.getWorldQuaternion(pq));
    P.pcam.projectionMatrix.copy(cam.projectionMatrix); P.pcam.projectionMatrixInverse.copy(cam.projectionMatrixInverse); P.pcam.updateMatrixWorld();
    P.disc.material.uniforms.time.value = performance.now() / 1000;
    const prev = r.getRenderTarget(), ac = r.autoClear; r.autoClear = true; r.setRenderTarget(P.rt); try { r.render(P.room, P.pcam); } catch (e) {} r.setRenderTarget(prev); r.autoClear = ac; }
  function portal(on) { const P = buildProps(), u = P.disc.material.uniforms; if (on) { P.g.visible = true; P.ring.scale.setScalar(0.01); u.k.value = 0; if (!loop) portalFrame(); }
    S.sfx(on ? 'rise' : 'ltPutDown');
    return T.tween({ dur: on ? 1.2 : 0.5, ease: on ? T.E.outCubic : T.E.inCubic, tag: 'who', update: e => { const k = on ? e : 1 - e; P.ring.scale.setScalar(Math.max(0.01, k)); u.k.value = Math.min(1, Math.max(0, on ? e * 1.5 - 0.4 : k)); } })
      .then(() => { if (!on) P.g.visible = false; }); }

  /* ---------- slabs on the table (logical coordinates: past the portal's plane is their room) ---------- */
  const yOf = obj => (obj.th || S.SM.SLAB.th) * K / 2 + 0.004 + (obj.lift || 0);   /* lift: overlapping slabs stack instead of fighting */
  const v = (x, z, y) => new THREE.Vector3(GX + x, y || 0, z);
  const there = L => L.z < PORTAL_Z - 0.02;
  function place(obj, L) { const g = obj.group, far = there(L); if (obj.far !== far) { obj.far = far; (far ? buildProps().room : ctx.scene).add(g); } g.position.copy(L); }
  const logical = obj => obj.group.position.clone();
  function lay(obj, at, down) { const g = obj.group; if (g.parent !== ctx.scene) ctx.scene.attach(g); g.scale.setScalar(K); const L = at.clone(); L.y = yOf(obj); obj.far = null; place(obj, L); g.quaternion.copy(down ? DOWN_Q : FLAT_Q); g.userData.secret = true; g.visible = true; }
  /* slide to a spot, flipping on the way if asked; through the portal it stays low and passes into their room */
  function slide(obj, to, o) { const g = obj.group, from = logical(obj), q0 = g.quaternion.clone(), q1 = o.down ? DOWN_Q : FLAT_Q, end = to.clone(); end.y = yOf(obj);
    const through = there(from) !== there(end), s0 = g.scale.x, s1 = o.scale || K, L = new THREE.Vector3();
    if (o.sfx !== false) S.sfx('lift');
    return T.tween({ dur: o.dur || 1.3, ease: T.E.inOutCubic, tag: 'who', update: e => { L.lerpVectors(from, end, e); L.y = end.y + Math.sin(e * Math.PI) * (through ? 0.35 : o.arc ?? 0.5); place(obj, L);
      g.quaternion.copy(q0).slerp(q1, Math.min(1, e * (through ? 3 : 1.8))); g.scale.setScalar(s0 + (s1 - s0) * e); } }).then(r => { if (o.sfx !== false) S.sfx('ltPutDown'); return r; }); }
  /* flip where it lies */
  const flip = (obj, down) => slide(obj, logical(obj), { down, dur: 0.6, arc: 0.7, scale: obj.group.scale.x });

  const hand = () => G.hand.map(h => h.obj.group), handSpot = i => v((i - (G.hand.length - 1) / 2) * GAP, HAND_Z), rivSpot = i => v((i - (HAND - 1) / 2) * RIV_GAP, RIV_Z);

  /* the developer: a print over the slab's photo that comes up from black; it fades away to leave the slab's own finish */
  async function developer(obj) { await obj.ready; const ph = obj.parts && obj.parts.photo; if (!ph || !G) return null;
    /* the slab's own loaded photo (CORS-safe, or its painted stand-in), so the canvas never taints */
    let img = null; try { img = await S.SM.photoCanvas(obj.slab, S); } catch (e) {} if (!G) return null; const pr = ph.geometry.parameters || { width: 1, height: 1 };
    const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(2, Math.round(512 * pr.height / pr.width)); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(ph.geometry, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })); m.position.z = 0.004; m.userData.order = 3; m.userData.noParticles = true; ph.add(m);
    const dv = { c, g: c.getContext('2d'), tex, m, img, at: 0 }; paintDev(dv, 0, true); return dv; }
  function paintDev(dv, p, now) { const t = performance.now(); if (!now && t - dv.at < 80) return; dv.at = t; const { c, g, img } = dv, e = p * p * (3 - 2 * p);
    g.fillStyle = '#050404'; g.fillRect(0, 0, c.width, c.height); const iw = img && (img.naturalWidth || img.width), ih = img && (img.naturalHeight || img.height); if (iw) { const k = Math.max(c.width / iw, c.height / ih), w = iw * k, h = ih * k;
      g.filter = 'blur(' + (22 * Math.pow(1 - p, 1.6)).toFixed(1) + 'px) brightness(' + (0.04 + 0.96 * e).toFixed(3) + ') contrast(' + (0.35 + 0.65 * e).toFixed(3) + ') grayscale(' + (1 - e).toFixed(3) + ')'; g.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h); g.filter = 'none'; }
    dv.tex.needsUpdate = true; }
  function fadeDev(dv) { if (!dv) return; paintDev(dv, 1, true); T.tween({ dur: 0.9, tag: 'who', update: e => { dv.m.material.opacity = 1 - e; } }).then(() => { if (dv.m.parent) dv.m.parent.remove(dv.m); dv.tex.dispose(); dv.m.material.dispose(); }); }

  /* ---------- a match ---------- */
  let G = null;
  function start() { const A = artists(), Mn = mine(); if (A.length < ARTISTS_MIN || Mn.length < HAND) { render(); return; } close(); last = null;
    G = { A, rival: pick(RIVALS), skill: 0.35 + Math.random() * 0.4, round: 0, rounds: [], hand: [], riv: [], you: 0, them: 0, picker: false, leaving: false };
    /* the rival's five, rolled from the packs: real slabs, but titled by plate only, so the label never names the artist */
    const d = store.get(), cert = d.certN;
    for (let i = 0; i < HAND; i++) { const a = pick(A), tier = SL.rollTier(Math.random()), s = SL.roll({ graded: true, pack: a.id, tier, finish: (SL.TIER[tier] || {}).finish });
      s.id = 'who' + Date.now().toString(36) + i; s.title = 'Plate ' + String(s.photo.plate || 1).padStart(3, '0'); G.riv.push({ slab: s, obj: null, used: false }); }
    d.certN = cert; paintBtn();
    const go = () => M.go('who.open');
    if (M.is('under')) go(); else if (M.is('idle') && S.under) { S.under.flip('under'); let n = 0; const w = setInterval(() => { if (M.is('under')) { clearInterval(w); go(); } else if (++n > 150 || !M.is('flipping') && n > 20) { clearInterval(w); G = null; paintBtn(); S.toast('Turn the table over to the dark side, then play again.'); } }, 150); }
    else { G = null; paintBtn(); S.toast('Close what is open first, then play.'); } }
  const FRAME = () => ({ tx: GX, ty: 2.0, tz: PORTAL_Z + 4.0, pitch: 32, dT: ctx.fitDist(28, 19, 32) });

  function rival(r) { const a = r.ai; if (a.done) return;
    /* a wrong guess before it knows (now and then), then the right one once the print is far enough up */
    if (a.next > 0 && r.p >= a.next && a.wrongs < 2 && Math.random() < 0.5) { a.wrongs++; a.pts -= WRONG; a.next = r.p + 0.12 + Math.random() * 0.1; G.them -= WRONG; S.sfx('detent'); paintHud(); return; }
    if (a.next > 0 && r.p >= a.next) a.next = -1;
    if (r.p >= a.knows) { a.done = a.got = true; a.pts += score(r.p); G.them += score(r.p); flip(r.mine.obj, false); paintHud(); return; }
    if (r.p >= 1 && performance.now() - r.t0 > (DEV + 3) * 1000) { a.done = true; paintHud(); } }
  function openPicker() { const r = G && G.r; if (!r || !M.is('who.play') || r.me.got || !r.up) return; G.picker = true; G.covers = {};
    /* a fresh random photo for every artist each time it opens, never the print in play */
    G.A.forEach(a => { const pool = a.imgs.filter(x => String(x.id) !== String(r.theirs.slab.photo.imgId)); G.covers[a.id] = (pick(pool.length ? pool : a.imgs) || {}).url; });
    paintHud(); }
  function guess(id) { const r = G && G.r; if (!r || r.me.got || !M.is('who.play')) return; const now = performance.now(); if (now < r.me.lock || r.me.wrong.has(id)) return;
    if (id === String(r.theirs.slab.photo.packId)) { const n = score(r.p); r.me.got = true; r.me.pts += n; G.you += n; G.picker = false; S.sfx('ltPutDown'); paintHud(); return; }
    r.me.wrong.add(id); r.me.pts -= WRONG; G.you -= WRONG; r.me.lock = now + LOCK * 1000; S.sfx('detent'); paintHud(); }
  function finish(forfeit) { const w = D(), win = !forfeit && G.you > G.them, tie = !forfeit && G.you === G.them; w.played++;
    let coins = 0; if (win) { w.won++; w.streak++; w.best = Math.max(w.best, w.streak); if (w.paid < WIN_CAP && S.market && S.market.award) { w.paid++; coins = WIN_COINS; S.market.award(WIN_COINS, 'Won Who Shot It? against ' + G.rival); } } else if (!tie) w.streak = 0;
    store.save(); last = { win, tie, forfeit, coins, you: G.you, them: G.them, rival: G.rival, rounds: G.rounds }; }
  /* tidy the table and go back to the dark side's own idle; the result panel comes up */
  async function cleanup() { const g = G; if (!g) return; T.cancelAll('who'); if (S.inspect.active()) S.inspect.close('back'); hud.classList.remove('on'); hud.innerHTML = '';
    [...g.hand, ...g.riv].forEach(h => { if (h.obj) { try { S.slabs.drop(h.obj); } catch (e) {} if (h.obj.group.parent) h.obj.group.parent.remove(h.obj.group); } });
    await portal(false); if (g.pushed) { S.cam.pop(); g.pushed = false; } (g.hid || []).forEach(o => { if (!o.disposed) { o.group.visible = true; if (o.tableShadow) o.tableShadow.visible = true; } }); G = null; paintBtn(); }
  /* called off before it starts (the binder shut early): nothing counts, back to the lobby */
  async function cancel() { last = null; await cleanup(); if (/^who(\.|$)/.test(M.state)) M.go(S.under && S.under.on ? 'under' : 'idle'); open(); }
  async function quit(forfeit) { if (!G) return; finish(forfeit); await cleanup(); if (/^who(\.|$)/.test(M.state)) M.go(S.under && S.under.on ? 'under' : 'idle'); open(); }

  /* ---------- the machine ---------- */
  M.define('who', {
    on: { CLOSE: () => { if (G) { G.leaving = true; G.picker = false; paintHud(); } } },
    key(e) { if (!G) return true; if (e.key === 'Escape') { if (G.picker) G.picker = false; else G.leaving = !G.leaving; paintHud(); return true; }
      if ((e.key === 'g' || e.key === 'G') && M.is('who.play')) { openPicker(); return true; } return true; },
    pointer(kind, e) { if (kind === 'wheel') { ctx.cam.dT = T.clamp(ctx.cam.dT * Math.exp(e.deltaY * 0.0012), 8, 40); return true; } return true; },
  });
  M.define('who.open', { busy: true, on: { CLOSE: () => undefined },
    async enter(d, run) { G.pushed = true; S.cam.push(FRAME()); ctx.hideActs(); hud.classList.add('on');
      /* slabs lying on the table step out of the way for the match (hidden, not moved) and come back after */
      G.hid = S.table.list.filter(o => o.group.visible); G.hid.forEach(o => { o.group.visible = false; if (o.tableShadow) o.tableShadow.visible = false; }); paintHud('A portal is opening to ' + G.rival + '\'s table.');
      await portal(true); if (!run.alive()) return;
      /* their five come through and lie face down on their side */
      G.riv.forEach((h, i) => { h.obj = S.slabs.make(h.slab); lay(h.obj, rivSpot(i).add(new THREE.Vector3(0, 0, -3)), true); });
      await T.par(G.riv.map((h, i) => T.wait(i * 0.12, 'who').then(() => slide(h.obj, rivSpot(i), { down: true, dur: 0.9, sfx: i === 0 })))); if (!run.alive()) return;
      M.go('who.choose'); } });
  M.define('who.choose', { busy: true, on: { CLOSE: () => undefined },
    enter() { paintHud('Choose five slabs from your binder.');
      /* the binder's tabs: an artist (or All) down the side, an order along the top; your five chosen stay out */
      const ORD = { rarity: rarer, grade: (a, b) => (b.graded ? b.grade : 0) - (a.graded ? a.grade : 0) || rarer(a, b), newest: (a, b) => (b.ts || 0) - (a.ts || 0) };
      const list = sel => { const out = new Set(G.hand.map(h => h.slab.id)); return mine().filter(s => !out.has(s.id) && (sel.side === 'all' || String(s.photo.packId) === sel.side)).sort(ORD[sel.top] || rarer).map(s => s.id); };
      const have = new Set(mine().map(s => String(s.photo.packId))), side = [{ id: 'all', label: 'All' }].concat(G.A.filter(a => have.has(a.id)).map(a => ({ id: a.id, label: a.name })));
      const sel = { side: 'all', top: 'rarity' };
      hud.classList.add('choosing');
      S.binder.pick({ ids: list(sel), ret: 'who.hand', label: 'Play this one', hold: { pos: [GX + 2.45, 3.6, PORTAL_Z + 7.0], tilt: 1.0, yaw: 0, cam: FRAME() },
        tabs: { side, top: [{ id: 'rarity', label: 'Rarity' }, { id: 'grade', label: 'Grade' }, { id: 'newest', label: 'Newest' }], sel, list }, hint: 'Choose five slabs to play with. They sit face up in front of you.',
        choose: (slab, at) => { if (!G || G.hand.length >= HAND) return false; const obj = S.objFor(slab), i = G.hand.length; G.hand.push({ slab, obj, used: false });
          lay(obj, at, false); obj.group.scale.setScalar(0.2); G.hand.forEach((h, k) => { if (h.obj !== obj) slide(h.obj, handSpot(k), { dur: 0.5, sfx: false }); }); slide(obj, handSpot(i), { dur: 1.0 });
          paintHud(G.hand.length < HAND ? 'Chosen ' + G.hand.length + ' of ' + HAND + '.' : 'Your five are on the table.'); return G.hand.length < HAND; } }); } });
  M.define('who.hand', { enter() { hud.classList.remove('choosing'); if (!G) { M.go(S.under && S.under.on ? 'under' : 'idle'); return; } S.cam.set(FRAME());
    if (G.hand.length < HAND) { S.toast('The binder closed before you chose five, so the match is off. Nothing counts.'); cancel(); return; } M.go('who.turn'); } });
  M.define('who.turn', {
    enter() { S.cam.set(FRAME()); G.r = null; G.picker = false; paintHud('Round ' + (G.round + 1) + ' of ' + HAND + '. Click one of your slabs to send it across.'); },
    pointer(kind, e) { if (kind === 'wheel') return false; const list = G.hand.filter(h => !h.used).map(h => h.obj.group), hit = S.hitAny(e, list);
      if (kind === 'move') { ctx.canvas.style.cursor = hit ? 'pointer' : 'default'; return true; }
      if (kind === 'down' && e.button === 0 && hit) { const h = G.hand.find(x => x.obj.group === hit.root); if (h) M.go('who.send', { h }); } return true; } });
  M.define('who.send', { busy: true, on: { CLOSE: () => undefined },
    async enter(d, run) { ctx.canvas.style.cursor = 'default'; const mineH = d.h, left = G.riv.filter(x => !x.used), theirs = pick(left); mineH.used = theirs.used = true;
      const kn = h32('who:' + mineH.slab.photo.imgId), knows = Math.min(0.95, Math.max(0.3, 0.35 + 0.5 * kn - (G.skill - 0.5) * 0.4 + (Math.random() - 0.5) * 0.1));   /* never before the tones are up */
      G.r = { mine: mineH, theirs, p: 0, t0: 0, up: false, me: { got: false, pts: 0, wrong: new Set(), lock: 0 }, ai: { got: false, pts: 0, wrongs: 0, knows, next: knows - 0.2 - Math.random() * 0.25, done: false } };
      paintHud('Sending it across.');
      await flip(mineH.obj, true); if (!run.alive()) return;
      await T.par(slide(mineH.obj, v(0, THEIRS_Z), { down: true, dur: 1.5 }), T.wait(0.25, 'who').then(() => slide(theirs.obj, v(0, MINE_Z), { down: true, dur: 1.5, sfx: false }))); if (!run.alive()) return;
      M.go('who.count'); } });
  M.define('who.count', { busy: true, on: { CLOSE: () => undefined },
    async enter(d, run) { for (const n of ['3', '2', '1']) { paintHud(null, n); S.sfx('detent'); await T.wait(0.8, 'who'); if (!run.alive()) return; }
      G.r.t0 = performance.now(); S.sfx('ltInspect'); M.go('who.play'); } });
  M.define('who.play', {
    enter() { paintHud(G.r.up ? null : 'Click their slab to flip it over.'); },
    pointer(kind, e) { if (kind === 'wheel') return false; const r = G.r, hit = S.hitAny(e, [r.theirs.obj.group]);
      if (kind === 'move') { ctx.canvas.style.cursor = hit ? 'pointer' : 'default'; return true; }
      if (kind === 'down' && e.button === 0 && hit && !r.flipping) look(); return true; },
    frame() { const r = G && G.r; if (!r) return; r.p = Math.min(1, (performance.now() - r.t0) / (DEV * 1000)); if (r.dv && !r.me.got) paintDev(r.dv, r.p); rival(r); lockLabel();
      if (r.me.got && r.ai.done || r.p >= 1 && performance.now() - r.t0 > (DEV + 4) * 1000) M.go('who.reveal'); } });
  /* flip it face up the first time (the print starts developing under it), then look closer */
  async function look() { const r = G.r; if (!r.up) { r.flipping = true; r.dv = await developer(r.theirs.obj); if (!G || G.r !== r) return; if (r.dv) paintDev(r.dv, r.p, true); await flip(r.theirs.obj, false); r.up = true; r.flipping = false; if (!G || G.r !== r || !M.is('who.play')) return; }
    paintHud(null); const res = await S.inspect.open(r.theirs.obj, { actions: [{ id: 'back', label: 'Put it down' }], hint: 'Drag to turn it. Take a guess when you know who shot it.' });
    if (G && G.r === r && M.is('who.play') && res === 'back') paintHud('Click it to look closer again.'); }
  M.define('who.reveal', {
    async enter() { const r = G.r; if (S.inspect.active()) S.inspect.close('back'); G.picker = false;
      G.rounds.push({ mine: r.me.pts, rival: r.ai.pts, theirs: nameOf(String(r.theirs.slab.photo.packId)), yours: nameOf(String(r.mine.slab.photo.packId)) }); G.round++;
      if (!r.up) { r.dv = r.dv || await developer(r.theirs.obj); await flip(r.theirs.obj, false); r.up = true; }
      fadeDev(r.dv); r.dv = null; if (!r.ai.got) flip(r.mine.obj, false); S.sfx(r.me.got ? 'ltPutDown' : 'detent'); paintHud(); } });
  M.define('who.return', { busy: true, on: { CLOSE: () => undefined },
    async enter(d, run) { const r = G.r, i = G.hand.indexOf(r.mine), j = G.riv.indexOf(r.theirs); paintHud();
      await T.par(slide(r.mine.obj, handSpot(i), { down: false, dur: 1.4, scale: K * 0.86 }), slide(r.theirs.obj, rivSpot(j), { down: false, dur: 1.4, scale: K * 0.86, sfx: false })); if (!run.alive()) return;
      if (G.round >= HAND) { finish(false); await cleanup(); M.go(S.under && S.under.on ? 'under' : 'idle'); open(); return; }
      M.go('who.turn'); } });

  /* ---------- the HUD over the table ---------- */
  function paintHud(say, count) { if (!G) return; const r = G.r, play = M.is('who.play'), reveal = M.is('who.reveal');
    if (say !== undefined && say !== null) G.say = say; if (say === null) G.say = '';
    let h = '<div class="wh-top"><span class="wh-rd">WHO SHOT IT? · ROUND ' + Math.min(G.round + (reveal || M.is('who.return') ? 0 : 1), HAND) + ' OF ' + HAND + '</span><span class="wh-sc"><span>You</span><b>' + G.you + '</b><i>·</i><b>' + G.them + '</b><span>' + esc(G.rival) + '</span></span><button type="button" class="wh-x" data-a="leave" aria-label="Leave the match">×</button></div>';
    if (r && r.t0 && (play || reveal)) { const a = r.ai; h += '<div class="wh-status">' + esc(a.got ? G.rival + ' got yours. ' + signed(a.pts) : a.done ? G.rival + ' didn\'t get yours.' : a.wrongs ? G.rival + ' guessed wrong' + (a.wrongs > 1 ? ' twice' : '') + '. Still looking.' : G.rival + ' is looking at yours.') + '</div>'; }
    if (count) h += '<div class="wh-count" key="' + count + '">' + count + '</div>';
    if (reveal) h += '<div class="wh-name"><b>' + esc(nameOf(String(r.theirs.slab.photo.packId))) + '</b><span>' + (r.me.got ? 'You got it. ' + signed(r.me.pts) : r.me.pts ? signed(r.me.pts) + ' this round' : 'Not this time') + '</span><button type="button" class="ws-go" data-a="next">' + (G.round >= HAND ? 'See the result' : 'Next round') + '</button></div>';
    else if (play && r && r.up && !r.me.got) h += '<div class="wh-guess"><button type="button" class="ws-go" data-a="guess">Take a guess <kbd>G</kbd></button><span class="ws-lock"></span></div>';
    else if (play && r && r.me.got) h += '<div class="wh-guess"><span class="wh-got">Got it. ' + signed(r.me.pts) + '</span></div>';
    if (G.say && !count && !reveal) h += '<div class="wh-say">' + esc(G.say) + '</div>';
    if (G.picker && play) h += '<div class="wh-pick"><div class="wh-pick-top"><span>Who shot it?</span><span class="ws-lock"></span><button type="button" class="ws-ghost" data-a="unpick">Keep looking <kbd>Esc</kbd></button></div><div class="wh-artists">'
      + G.A.map(a => { const no = r.me.wrong.has(a.id); return '<button type="button" class="wh-art' + (no ? ' no' : '') + '" data-a="pick" data-id="' + esc(a.id) + '"' + (no ? ' disabled' : '') + '><img src="' + esc(G.covers[a.id] || '') + '" alt="" loading="lazy"><span>' + esc(a.name) + '</span></button>'; }).join('') + '</div></div>';
    if (G.leaving) h += '<div class="wh-leave"><div><h2>Leave the match?</h2><p>It counts as a loss, and your streak goes back to 0.</p><div class="ws-row"><button type="button" class="ws-go" data-a="stay">Keep playing</button><button type="button" class="ws-ghost" data-a="forfeit">Leave</button></div></div></div>';
    hud.innerHTML = h; hud.classList.add('on'); lockLabel(); }
  function lockLabel() { const r = G && G.r; if (!r) return; const left = Math.ceil((r.me.lock - performance.now()) / 1000), t = left > 0 ? 'Locked out ' + left + ' s' : '';
    hud.querySelectorAll('.ws-lock').forEach(x => { if (x.textContent !== t) x.textContent = t; });
    hud.querySelectorAll('.wh-art:not(.no)').forEach(b => { b.disabled = left > 0; }); }

  setTimeout(paintBtn, 1500); setInterval(paintBtn, 5000);
  S.whoShot = { open, close, start, __g: () => G, __dev: () => DEV };
}

const CSS = `
#skWhoBtn{ position:fixed; right:max(16px, env(safe-area-inset-right,0px)); bottom:calc(84px + env(safe-area-inset-bottom,0px)); display:none; align-items:baseline; gap:8px; font:500 10px/1 var(--f-mono); letter-spacing:.14em; color:var(--text); background:rgba(14,13,12,.9); border:1px solid rgba(227,173,87,.5); border-radius:6px; padding:9px 12px; cursor:pointer; z-index:12; }
#skWhoBtn.on{ display:flex; } #skWhoBtn:hover{ border-color:var(--accent); } #skWhoBtn span{ color:var(--accent); } #skWhoBtn b{ font:500 11px/1 var(--f-mono); letter-spacing:.06em; color:var(--faint); }
#skWho{ --w-p:#141210; --w-ln:rgba(244,241,234,.1); --w-mut:rgba(244,241,234,.55); position:fixed; inset:0; z-index:40; display:flex; flex-direction:column; background:rgba(11,10,9,.94); color:var(--text); font:400 14px/1.5 var(--f-ui); opacity:0; pointer-events:none; transition:opacity .25s; }
#skWho.on{ opacity:1; pointer-events:auto; } #skWho .dim{ color:var(--w-mut); }
#skWho h2, #skWhoHud h2{ margin:6px 0 8px; font:400 26px/1.15 var(--f-serif, Georgia, serif); }
#skWho .ws-top{ display:flex; align-items:center; gap:18px; height:56px; padding:0 14px 0 18px; border-bottom:1px solid var(--w-ln); background:var(--w-p); flex:none; }
#skWho .ws-brand{ display:flex; flex-direction:column; line-height:1; flex:1; } #skWho .ws-brand b{ font:600 13px var(--f-mono); letter-spacing:.24em; } #skWho .ws-brand span{ font:500 9px var(--f-mono); letter-spacing:.32em; color:var(--accent); margin-top:4px; }
#skWho .ws-wal{ display:flex; align-items:center; gap:18px; } #skWho .ws-wal>div{ display:flex; flex-direction:column; align-items:flex-end; line-height:1.1; } #skWho .ws-wal span{ font:500 9px var(--f-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--w-mut); } #skWho .ws-wal b{ font:500 15px var(--f-mono); }
#skWho .ws-x, #skWhoHud .wh-x{ width:32px; height:32px; border:1px solid var(--w-ln, rgba(244,241,234,.1)); border-radius:6px; background:rgba(14,13,12,.8); color:rgba(244,241,234,.55); font-size:18px; cursor:pointer; } #skWho .ws-x:hover, #skWhoHud .wh-x:hover{ color:var(--text); border-color:var(--text); }
#skWho .ws-main{ flex:1; overflow:auto; padding:28px 18px; } #skWho .ws-lobby, #skWho .ws-done{ max-width:820px; margin:0 auto; } #skWho .ws-lobby p{ max-width:62ch; } #skWho .ws-warn{ color:#ffb08a; }
#skWho .ws-go, #skWhoHud .ws-go{ font:600 12px var(--f-mono); letter-spacing:.16em; text-transform:uppercase; color:#16120c; background:var(--accent); border:0; border-radius:6px; padding:12px 22px; cursor:pointer; margin:10px 0; } #skWho .ws-go:hover, #skWhoHud .ws-go:hover{ filter:brightness(1.08); }
#skWho .ws-ghost, #skWhoHud .ws-ghost{ font:500 12px var(--f-mono); letter-spacing:.1em; color:rgba(244,241,234,.6); background:rgba(14,13,12,.7); border:1px solid rgba(244,241,234,.14); border-radius:6px; padding:10px 16px; cursor:pointer; } #skWho .ws-ghost:hover, #skWhoHud .ws-ghost:hover{ color:var(--text); border-color:var(--text); }
#skWho kbd, #skWhoHud kbd{ font:500 10px var(--f-mono); border:1px solid currentColor; border-radius:3px; padding:1px 4px; margin-left:6px; opacity:.7; }
#skWho .ws-row, #skWhoHud .ws-row{ display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
#skWho .ws-rd{ font:500 10px var(--f-mono); letter-spacing:.2em; text-transform:uppercase; color:var(--accent); }
#skWho .ws-log{ list-style:none; padding:0; margin:16px 0; display:flex; flex-direction:column; gap:6px; } #skWho .ws-log li{ display:grid; grid-template-columns:80px 1fr 44px 1fr 44px; gap:10px; padding:8px 12px; background:var(--w-p); border-radius:6px; font:500 12px var(--f-mono); } #skWho .ws-log li span:first-child{ color:var(--w-mut); } #skWho .ws-log b{ text-align:right; }
#skWhoHud.choosing .wh-top, #skWhoHud.choosing .wh-say{ display:none; }
#skWhoHud{ position:fixed; inset:0; z-index:30; pointer-events:none; display:none; color:var(--text); font:400 14px/1.5 var(--f-ui); } #skWhoHud.on{ display:block; } #skWhoHud button{ pointer-events:auto; }
#skWhoHud .wh-top{ position:absolute; top:max(14px, env(safe-area-inset-top,0px)); left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:18px; padding:8px 10px 8px 16px; background:rgba(14,13,12,.82); border:1px solid rgba(244,241,234,.1); border-radius:8px; white-space:nowrap; }
#skWhoHud .wh-rd{ font:500 10px var(--f-mono); letter-spacing:.2em; color:var(--accent); } #skWhoHud .wh-sc{ display:flex; align-items:center; gap:10px; } #skWhoHud .wh-sc span{ font:500 9px var(--f-mono); letter-spacing:.16em; text-transform:uppercase; color:rgba(244,241,234,.55); } #skWhoHud .wh-sc b{ font:500 20px var(--f-mono); font-variant-numeric:tabular-nums; } #skWhoHud .wh-sc i{ font-style:normal; color:rgba(244,241,234,.4); }
#skWhoHud .wh-status{ position:absolute; top:calc(max(14px, env(safe-area-inset-top,0px)) + 58px); left:50%; transform:translateX(-50%); font:500 12px var(--f-mono); color:rgba(244,241,234,.7); text-shadow:0 1px 6px #000; white-space:nowrap; }
#skWhoHud .wh-say{ position:absolute; left:50%; bottom:calc(30px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); padding:10px 16px; background:rgba(14,13,12,.82); border:1px solid rgba(244,241,234,.1); border-radius:8px; font:500 13px var(--f-ui); max-width:calc(100vw - 32px); text-align:center; }
#skWhoHud .wh-count{ position:absolute; left:50%; top:42%; transform:translate(-50%,-50%); font:400 140px/1 var(--f-serif, Georgia, serif); color:var(--accent); text-shadow:0 6px 40px rgba(0,0,0,.8); animation:whCount .8s ease-out both; }
@keyframes whCount{ from{ opacity:0; transform:translate(-50%,-50%) scale(1.6); } 30%{ opacity:1; transform:translate(-50%,-50%) scale(1); } to{ opacity:0; transform:translate(-50%,-50%) scale(.85); } }
#skWhoHud .wh-guess{ position:absolute; left:50%; bottom:calc(84px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); display:flex; align-items:center; gap:14px; z-index:2; } #skWhoHud .wh-got{ font:500 15px var(--f-mono); padding:10px 16px; background:rgba(14,13,12,.82); border-radius:8px; }
#skWhoHud .ws-lock{ font:500 12px var(--f-mono); color:#ffb08a; text-shadow:0 1px 6px #000; }
#skWhoHud .wh-name{ position:absolute; left:50%; bottom:calc(30px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; padding:14px 26px 6px; background:rgba(14,13,12,.86); border:1px solid rgba(227,173,87,.35); border-radius:10px; animation:whName .5s ease-out both; }
#skWhoHud .wh-name b{ font:400 32px/1.1 var(--f-serif, Georgia, serif); font-weight:400; } #skWhoHud .wh-name span{ font:500 12px var(--f-mono); color:rgba(244,241,234,.65); margin-top:4px; }
@keyframes whName{ from{ opacity:0; transform:translate(-50%,10px); } to{ opacity:1; transform:translate(-50%,0); } }
#skWhoHud .wh-pick{ position:absolute; left:0; right:0; bottom:0; padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px)); background:linear-gradient(rgba(11,10,9,0), rgba(11,10,9,.92) 22%); pointer-events:auto; z-index:3; animation:whUp .28s ease-out both; }
@keyframes whUp{ from{ transform:translateY(40px); opacity:0; } to{ transform:none; opacity:1; } }
#skWhoHud .wh-pick-top{ display:flex; align-items:center; gap:16px; max-width:1100px; margin:18px auto 10px; font:500 10px var(--f-mono); letter-spacing:.18em; text-transform:uppercase; color:rgba(244,241,234,.6); } #skWhoHud .wh-pick-top .ws-ghost{ margin-left:auto; }
#skWhoHud .wh-artists{ display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; max-width:1100px; margin:0 auto; max-height:38vh; overflow:auto; }
#skWhoHud .wh-art{ display:flex; flex-direction:column; gap:6px; padding:6px; background:rgba(20,18,16,.96); border:1px solid rgba(244,241,234,.1); border-radius:8px; color:var(--text); font:500 12px var(--f-ui); text-align:left; cursor:pointer; }
#skWhoHud .wh-art img{ width:100%; aspect-ratio:1; object-fit:cover; border-radius:4px; background:#000; } #skWhoHud .wh-art:hover:not(:disabled){ border-color:var(--accent); } #skWhoHud .wh-art:disabled{ cursor:default; opacity:.55; } #skWhoHud .wh-art.no{ opacity:.22; filter:grayscale(1); }
#skWhoHud .wh-leave{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(11,10,9,.6); pointer-events:auto; z-index:4; } #skWhoHud .wh-leave>div{ max-width:420px; padding:22px; background:#141210; border:1px solid rgba(244,241,234,.1); border-radius:10px; }
@media (max-width:760px){ #skWho .ws-log li{ grid-template-columns:1fr 44px; } #skWho .ws-log li span:first-child{ grid-column:1/-1; } #skWhoHud .wh-top{ gap:10px; } #skWhoHud .wh-rd{ display:none; } }
`;
