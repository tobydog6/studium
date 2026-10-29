// RAIL: the darkroom reel in the pit, the heart of the pull. Sam: "the rail needs to be absolutely epic, that's where
// all the dopamine comes from". CS:GO is the reference, Hearthstone's flip is the model (The Pull, Pull Environments
// and Flip and Glow pages in docs/secret-ref). loot.js opens a pit in the table surface (o.rect, table coordinates,
// y 0 is the table top) and calls run(slab, { rect, decoys }):
//   the darkroom is built below the top inside the rect: a dark box, a bench with developer trays, a line of prints
//   still dripping that drifts past behind the rail, one red safelight. The rail (a steel bar, clips, the prints
//   hanging face down, the brass marker) waits down in the dark and rises up into view (S.snd 'rise').
//   The reel: a long row of prints going by face down, the marker ticking each one past (S.snd.tick), the rumble
//   building, a fast start and a long deceleration, the last ticks slow and heavy. About 30% of the time the reel
//   runs past the winner and rolls back the other way one to three slots. The winner always ends under the marker.
//   Landing: the rest of the rail dims, the winner comes forward and its tier colour swells behind it (the back's tier
//   bar already said the rarity). The prompt is a soft pulse: the print breathes with a faint rim of light that
//   brightens in the FINISH colour when the pointer arrives (that is the new information). Click, Space or Enter turns
//   it on its vertical axis with a burst of light at the edge-on moment (S.holo.burst), then S.holo.reveal runs the
//   tier-scaled landing. The print is then laid face up at S.rail.landing (a world Vector3: the right end of the
//   rect, x1 minus 3, above the table top, in the arm's reach) for the arm to collect
//   and run() resolves with its object; the decoys are disposed. close() sinks everything back into the dark and
//   resolves a pending run with null. Tweens carry the tag 'rail'; frame(dt) runs the reel, drips and glow.
// Test hooks: S.rail.__flip() (a simulated click), S.rail.__drive(on) (frame() from the table loop when loot.js is
// not there to forward it), S.rail.state().
import * as THREE from 'three';

const K = 0.4;                 /* prints on the rail at the table's card scale */
const BAR_Y = 0.55, HANG = 0.2;   /* the rail bar above the table top; clip and string down to the top of a print */
const DEEP = -5.0, BENCH_Y = -1.95, SUNK = -4.6, UP = 1.55;   /* risen, the whole rail hangs above the table top so nothing is cut off */   /* the darkroom floor, the bench, where the rail waits in the dark */
const ROLLBACK = 0.3;          /* how often the reel passes the winner and rolls back */
const BACK_MAX = 1;   /* the roll-back is one slot, slow: it never jumps away from the winner */

export function install(S) {
  const { T } = S, E = T.E, ctx = S.ctx;
  const ENV = S.SM.envMap(S.renderer);
  const lam = (c, o) => new THREE.MeshLambertMaterial({ color: c, ...(o || {}) });
  const stdM = (c, r, m, o) => new THREE.MeshStandardMaterial({ color: c, roughness: r ?? 0.5, metalness: m ?? 0, envMap: ENV, envMapIntensity: m > 0.3 ? 1.0 : 0.3, ...(o || {}) });
  const box = (w, h, d, mat, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const radial = (stops, size) => { const c = document.createElement('canvas'); c.width = c.height = size || 256; const g = c.getContext('2d'), gr = g.createRadialGradient(c.width / 2, c.width / 2, 0, c.width / 2, c.width / 2, c.width / 2); stops.forEach(s => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.width); return new THREE.CanvasTexture(c); };
  const SOFT = radial([[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']]);
  const RIM = radial([[0, 'rgba(255,255,255,0.5)'], [0.5, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
  const BURST = radial([[0, 'rgba(255,245,220,1)'], [0.25, 'rgba(255,220,160,0.5)'], [1, 'rgba(255,200,120,0)']]);
  const sprite = (tex, w, h, col, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: col ?? 0xffffff, transparent: true, opacity: op ?? 1, blending: THREE.AdditiveBlending, depthWrite: false })); m.userData.noParticles = true; return m; };
  const text = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), c); return S.SM.tex(c); };
  const disposeAll = root => root.traverse(m => { if (m.isMesh) { m.geometry.dispose(); [].concat(m.material).forEach(mt => { if (mt.map && !SHARED.has(mt.map)) mt.map.dispose(); mt.dispose(); }); } });
  const SHARED = new Set([SOFT, RIM, BURST]);

  const group = new THREE.Group(); group.name = 'rail'; group.visible = false; ctx.scene.add(group);
  const landing = new THREE.Vector3();
  /* R: everything about the current run; null between runs */
  let R = null, driver = null;

  /* ---------- the glow colour of a finish or variant (holo.js owns the real answer; this is the stand-in) ---------- */
  function glowOf(slab) {
    if (S.holo && S.holo.glowOf) { try { const g = S.holo.glowOf(slab); if (g && g.color) return g; } catch (e) {} }
    const f = S.SL.finishOf(slab, S.testFinish ? S.testFinish() : null), v = slab.variant;
    const base = { matte: ['#ffe2c0', 'steady'], foil: ['#ffffff', 'cycle'], etch: ['#d8c8ff', 'pulse'], glitter: ['#ffffff', 'sparkle'], gold: ['#ffd27a', 'hot'], prism: ['#ffffff', 'cold'] }[f] || ['#ffffff', 'steady'];
    const col = v === 'negative' ? '#ff7a2a' : v === 'clear' ? '#bfe6ff' : base[0];
    return { color: new THREE.Color(col), color2: new THREE.Color(base[0]), kind: base[1] };
  }

  /* ---------- the darkroom in the pit ---------- */
  function buildRoom(rect) {
    const [x0, z0, x1, z1] = rect, W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    group.position.set(cx, 0, cz); group.visible = true;
    const room = new THREE.Group(); group.add(room);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(W, -DEEP + 0.02, D), lam(0x160a08, { side: THREE.BackSide })); walls.position.y = DEEP / 2 + 0.01; room.add(walls);
    /* the bench along the back with three trays, the middle one with a print coming up in the developer, and two bottles */
    const wood = lam(0x2b2320), trayM = lam(0xc9c4b8), liqM = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.6, envMap: ENV, envMapIntensity: 0.5 });
    const bz = z0 + 1.35, bd = 2.3; box(W - 0.4, 0.14, bd, wood, 0, BENCH_Y, bz, room); box(W - 0.6, 0.06, 0.08, wood, 0, BENCH_Y - 0.1, bz + bd / 2 - 0.1, room);
    const tn = Math.max(1, Math.min(4, Math.floor((W - 1) / 2.6))); const tw = 1.9, td = 1.3, ty = BENCH_Y + 0.15;
    for (let i = 0; i < tn; i++) { const x = (i - (tn - 1) / 2) * 2.6;
      box(tw, 0.16, 0.08, trayM, x, ty, bz + td / 2, room); box(tw, 0.16, 0.08, trayM, x, ty, bz - td / 2, room); box(0.08, 0.16, td, trayM, x - tw / 2, ty, bz, room); box(0.08, 0.16, td, trayM, x + tw / 2, ty, bz, room); box(tw, 0.02, td, trayM, x, ty - 0.07, bz, room);
      if (i === Math.floor(tn / 2)) { const ph = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.87), lam(0xffffff, { map: S.SM.tex(ctx.paintPhoto(S.KINDS[3 % S.KINDS.length], 77, 390, 260)) })); ph.rotation.x = -Math.PI / 2; ph.rotation.z = 0.07; ph.position.set(x, ty - 0.05, bz); room.add(ph); }
      const liq = new THREE.Mesh(new THREE.PlaneGeometry(tw - 0.1, td - 0.1), liqM); liq.rotation.x = -Math.PI / 2; liq.position.set(x, ty + 0.02, bz); room.add(liq); }
    [[-0.5, 0.0], [-0.1, 0.3]].forEach(([dx, dz], i) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.66, 14), stdM(0x3a1e0c, 0.3, 0.1)); b.position.set(x0 + 0.9 + dx, BENCH_Y + 0.4, bz - 0.6 + dz); room.add(b); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 14), stdM(0x111111, 0.8)); cap.position.set(b.position.x, BENCH_Y + 0.78, b.position.z); room.add(cap); });
    /* the safelight: its housing on the back wall, the red lens, a halo, and the red light itself out over the rail */
    box(0.9, 0.3, 0.42, stdM(0x1a1a1a, 0.7), 0, -0.4, z0 + 0.28, room); const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2a14 })); lens.rotation.x = Math.PI / 2; lens.position.set(0, -0.56, z0 + 0.28); room.add(lens);
    const halo = sprite(SOFT, 2.6, 1.5, 0xff3a20, 0.5); halo.position.set(0, -0.7, z0 + 0.5); room.add(halo);
    const red = new THREE.PointLight(0xff3a1e, 0, 22, 1.5); red.position.set(0, 0.35, 1.4); room.add(red);
    const redBack = new THREE.PointLight(0xff3a1e, 0, 14, 1.6); redBack.position.set(0, -0.8, z0 + 0.9); room.add(redBack);
    const key = new THREE.PointLight(0xfff0dc, 0, 12, 1.6); key.position.set(0.8, 0.9, 3.2); room.add(key);
    /* the line of prints still dripping, strung behind the rail; it drifts past slowly */
    const line = new THREE.Group(); line.position.set(0, -0.55, z0 + 1.0); room.add(line);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, W + 2, 6), lam(0x7a6a60)); string.rotation.z = Math.PI / 2; line.add(string);
    const hung = [], drops = [], LN = Math.max(4, Math.round(W / 1.9)), LP = (W + 2) / LN;
    for (let i = 0; i < LN; i++) { const g = new THREE.Group(); const land = i % 3 !== 1, pw = land ? 1.25 : 0.85, ph = land ? 0.85 : 1.25;
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), lam(0xffffff, { map: S.SM.tex(ctx.paintPhoto(S.KINDS[(i * 5 + 1) % S.KINDS.length], 300 + i * 17, land ? 300 : 210, land ? 210 : 300)), side: THREE.DoubleSide })); paper.position.y = -0.06 - ph / 2; g.add(paper);
      [-0.3, 0.3].forEach(x => box(0.05, 0.12, 0.05, lam(0x6a4a3a), x * pw, -0.04, 0, g)); g.userData = { pw, ph, i }; line.add(g); hung.push(g);
      for (let k = 0; k < 2; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffb0a0, transparent: true, opacity: 0.8 })); d.userData.noParticles = true; line.add(d); drops.push({ m: d, g, k, ph: (i * 0.37 + k * 0.5) % 1 }); } }
    return { room, W, D, x0, x1, z0, z1, cx, cz, walls, halo, red, redBack, key, line, hung, drops, LN, LP, span: W / 2 - 0.55 };
  }

  /* ---------- the rail: the bar, two posts, the marker, the hangers ---------- */
  function buildRig(rm) {
    const rig = new THREE.Group(); rig.position.y = SUNK; group.add(rig);
    const steel = stdM(0xb8b9bd, 0.3, 0.9), brass = stdM(0xc09a48, 0.3, 0.85);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, rm.W - 0.5, 14), steel); bar.rotation.z = Math.PI / 2; bar.position.y = BAR_Y; rig.add(bar);
    [-1, 1].forEach(s => { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 6.2, 12), stdM(0x3a3c40, 0.5, 0.7)); post.position.set(s * (rm.W / 2 - 0.3), BAR_Y - 3.1, 0); rig.add(post); });
    const marker = new THREE.Group(); marker.position.set(0, BAR_Y + 0.4, 0.05); rig.add(marker);
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 3), brass); tri.rotation.x = Math.PI; marker.add(tri);
    const mg = sprite(SOFT, 0.7, 0.7, 0xffe6aa, 0.5); mg.position.z = -0.1; marker.add(mg);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 3.2), new THREE.MeshBasicMaterial({ color: 0xe3ad57, transparent: true, opacity: 0.7, depthWrite: false })); line.position.set(0, BAR_Y - 1.45, 0.32); line.userData.noParticles = true; rig.add(line);
    return { rig, bar, marker, line, mg };
  }
  /* one hanger: strings and clips from the bar, the spin group (the vertical axis the flip turns on) holding the print */
  function makeHanger(obj, rig, i) {
    const h = new THREE.Group(); h.position.y = BAR_Y; rig.add(h);
    const spin = new THREE.Group(); h.add(spin); spin.add(obj.group); obj.group.scale.setScalar(K); obj.group.rotation.y = Math.PI;   /* face down: the back to the camera */
    const streak = sprite(SOFT, 3.4, 0.14, 0xffb09a, 0); streak.position.y = -HANG - 0.9; h.add(streak);
    const slot = { obj, h, spin, streak, i, placed: false, swing: 0, clips: [], back: null, dim: 1 };
    return slot;
  }
  /* once the print's photo is in and its size is known: clips, strings, and a back for the slab stand-in */
  function placeHanger(s) {
    const o = s.obj, side = o.w > o.h, w = (side ? o.h : o.w) * K, hh = (side ? o.w : o.h) * K; s.spin.position.y = -HANG - hh / 2; s.placed = true;
    if (side) o.group.rotation.z = Math.PI / 2;   /* a landscape print hangs sideways so every slot is the same width */
    [-0.3, 0.3].forEach(x => { const clip = box(0.06, 0.12, 0.06, stdM(0x2a2a2e, 0.5, 0.6), x * w, -HANG + 0.02, 0, s.h); s.clips.push(clip); const str = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, HANG, 6), stdM(0x55565a, 0.6, 0.4)); str.position.set(x * w, -HANG / 2, 0); s.h.add(str); });
    if (!o.parts || !o.parts.back) {   /* the slab object has no back of its own: paper, the roundel blind, the tier bar along the foot */
      const t = S.SL.tierOf(o.slab), c = text(512, Math.round(512 * o.h / o.w), (g, cv) => { g.fillStyle = '#ece7dc'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#e2ddd2'; for (let y = 8; y < cv.height; y += 22) for (let x = 8; x < 512; x += 22) { g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill(); }
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 6; g.beginPath(); g.arc(256, cv.height / 2 - 20, 70, 0, 7); g.stroke(); g.fillStyle = 'rgba(0,0,0,0.16)'; g.font = '700 46px "Geist", sans-serif'; g.textAlign = 'center'; g.fillText('STUDIUM', 256, cv.height / 2 - 4); g.font = '500 20px "Geist Mono", monospace'; g.fillText('RAW · UNGRADED', 256, cv.height / 2 + 30);
        g.fillStyle = t.color; g.fillRect(0, cv.height - 28, 512, 28); });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(o.w * K - 0.02, o.h * K - 0.02), lam(0xffffff, { map: c })); back.position.z = (o.th || 0.19) * K / 2 + 0.004; if (side) back.rotation.z = Math.PI / 2; s.spin.add(back); s.back = back; }
  }
  /* a sealed pull (a finish that only exists graded) comes off the rail already in its slab */
  function mk(slab) { const o = !slab.graded && S.print && S.print.make ? S.print.make(slab) : null; return o ? S.slabs.adopt(o) : S.slabs.make(slab); }

  /* ---------- the camera ---------- */
  const FRAME = rm => ({ tx: rm.cx, ty: UP - 0.35, tz: rm.cz + 0.2, pitch: 24, dT: Math.max(9, ctx.fitDist(rm.W + 1.2, 4.5, 24)) });

  /* ---------- the reel plan: slots over time, with the long deceleration, the near miss or the roll-back ---------- */
  function plan(n, win) {
    const laps = Math.max(2, Math.round(34 / n)), target = win + laps * n, rollback = Math.random() < ROLLBACK, back = 1 + Math.floor(Math.random() * BACK_MAX);
    const A = rollback ? target + 0.78 : target - 0.42, B = rollback ? target - 0.1 : target + 0.07;
    const PAUSE = rollback ? 0.35 : 0.3, BD = rollback ? 1.9 : 1.2;
    return { target, rollback, back, RUN: 7.0, PAUSE, BD, CD: 0.5, A, B, total: 7.0 + PAUSE + BD + 0.5 };
  }
  function reelPos(p, u) {
    if (u <= 0) return 0;
    if (u < p.RUN) { const k = u / p.RUN; const e = k < 0.08 ? 0.5 * Math.pow(k / 0.08, 2) * 0.08 : 0.04 + (1 - Math.pow(1 - (k - 0.08) / 0.92, 4.6)) * 0.96; return p.A * e; }
    let v = u - p.RUN; if (v < p.PAUSE) return p.A; v -= p.PAUSE;
    if (v < p.BD) { const w = v / p.BD; return p.A + (p.B - p.A) * (p.rollback ? E.inOutCubic(w) : 1 - Math.pow(1 - w, 2.4)); }
    v -= p.BD; const w = Math.min(1, v / p.CD); return p.B + (p.target - p.B) * E.outCubic(w);
  }

  /* ---------- the run ---------- */
  function finish(obj) { const r = R; if (!r || r.done) return; r.alive = false; r.done = true; if (r.resolve) r.resolve(obj); }
  async function run(slab, o = {}) {
    if (R) await close();
    const rect = o.rect || S.hole.rect || [-7, -3, 7, 3];
    const rm = buildRoom(rect), rg = buildRig(rm);
    const decoys = (o.decoys || []).filter(Boolean);
    const slots = []; const winAt = Math.max(0, Math.floor((decoys.length + 1) * 0.6));
    const order = decoys.slice(); order.splice(winAt, 0, slab);
    order.forEach((sl, i) => { const obj = mk(sl); slots.push(makeHanger(obj, rg.rig, i)); });
    const winner = slots[winAt];
    const r = { alive: true, rm, rg, slots, winner, slab, pos: 0, vel: 0, idx: 0, tick: 0, blur: 0, phase: 'rise', reel: null, u: 0, landed: 0, prompt: false, hover: false, hoverT: 0, glow: glowOf(slab), rim: null, flood: null, burst: null, ring: null, handed: false, t: 0, resolve: null, pitch: 2.4, redK: 0, keyK: 0, lastRumble: 0 };
    R = r; r.promise = new Promise(res => { r.resolve = res; });
    sequence(r).catch(e => { console.error('rail', e); finish(null); });
    return r.promise;
  }
  async function sequence(r) {
    const { rm, rg, slots, winner } = r; const alive = () => R === r && r.alive;
    rm.room.children.forEach(c => { if (c !== rm.walls && !c.isLight) c.visible = false; });   /* Sam: no darkroom set behind the reel */
    S.cam.set(FRAME(rm)); ctx.hideActs();
    /* the safelight stutters on, the rail comes up out of the dark */
    r.hum = S.snd && S.snd.loop ? S.snd.loop('safelight') : null;
    T.tween({ dur: 0.9, ease: E.linear, tag: 'rail', update: (e, k) => { r.redK = k < 0.7 ? (Math.random() < 0.55 ? 1 : 0.15) * k : 1; } });
    await T.wait(0.5, 'rail'); if (!alive()) return;
    S.snd && S.snd.play('rise'); r.phase = 'rise';
    const up = T.to(rg.rig.position, { y: UP }, { dur: 2.4, ease: E.inOutCubic, tag: 'rail' });
    /* the prints' photos arrive while it rises; the pitch of the slots fits the widest */
    await Promise.race([Promise.all(slots.map(s => s.obj.ready.catch(() => null))), T.wait(5, 'rail')]); if (!alive()) return;
    r.pitch = Math.max(1.1, ...slots.filter(s => s.obj.built).map(s => Math.min(s.obj.w, s.obj.h) * K)) + 0.12;
    /* a flash at the marker in the passing print's tier colour, and dust drifting in the pit */
    r.flash = new THREE.PointLight(0xffffff, 0, 9, 1.6); r.flash.position.set(0, BAR_Y - 0.6, 1.4); rg.rig.add(r.flash);
    { const n = 500, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = rm.x0 + Math.random() * rm.W; pos[i * 3 + 1] = -4 + Math.random() * 5.5; pos[i * 3 + 2] = rm.z0 + Math.random() * rm.D; } const gm = new THREE.BufferGeometry(); gm.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.dust = new THREE.Points(gm, new THREE.PointsMaterial({ color: 0xffd2b0, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); r.dust.userData.noParticles = true; group.add(r.dust); }
    await up; if (!alive()) return;
    S.snd && S.snd.play('servo'); await T.wait(0.35, 'rail'); if (!alive()) return;
    /* the reel */
    r.reel = plan(slots.length, winner.i); r.u = 0; r.phase = 'reel'; r.rumbleOn = true;
    await new Promise(res => { r.reelDone = res; }); if (!alive()) return;
    r.rumbleOn = false; S.snd && S.snd.play('rumble', { gain: 0 });
    /* the landing: the rest dims, the winner comes forward, its tier colour swells behind it */
    r.phase = 'land'; r.landed = T.time(); S.snd && S.snd.play('land', { tier: r.slab.tier });
    const tier = S.SL.tierOf(r.slab), col = new THREE.Color(tier.color);
    r.flood = sprite(SOFT, 4.6, 3.6, col, 0); r.flood.position.set(0, winner.spin.position.y - 0.1, -0.6); winner.h.add(r.flood);
    r.rim = sprite(RIM, winner.obj.w * K * 1.65, winner.obj.h * K * 1.55, r.glow.color, 0); r.rim.position.set(0, winner.spin.position.y, -0.05); winner.h.add(r.rim);
    r.burst = sprite(BURST, 3.2, 3.2, 0xffffff, 0); r.burst.position.set(0, winner.spin.position.y, 0.25); winner.h.add(r.burst);
    r.ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 72), new THREE.MeshBasicMaterial({ color: 0xffe0a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); r.ring.position.copy(r.burst.position); r.ring.position.z = 0.3; winner.h.add(r.ring);
    T.to(winner.h.position, { z: 1.25, y: BAR_Y + 0.32 }, { dur: 0.8, ease: E.outBack, tag: 'rail' });
    T.tween({ dur: 0.8, ease: E.outBack, tag: 'rail', update: e => winner.spin.scale.setScalar(1 + 0.32 * e) });
    T.to(ctx.cam, { dT: ctx.cam.dT * 0.72, ty: UP - 0.5, pitch: 24 }, { dur: 1.6, ease: E.inOutCubic, tag: 'rail' });
    T.tween({ dur: 1.2, ease: E.inOutSine, tag: 'rail', update: e => { r.keyK = e; } });
    await T.wait(0.9, 'rail'); if (!alive()) return;
    r.prompt = true; r.phase = 'prompt'; S.toast('Face down. Hover it, then click to turn it over.');
    await new Promise(res => { r.flipNow = res; }); if (!alive()) return;
    /* the flip: a turn on the vertical axis, the burst at the edge-on moment, then the tier-scaled landing */
    r.prompt = false; r.phase = 'flip'; r.hover = false; ctx.canvas.style.cursor = 'default'; S.snd && S.snd.play('flip');
    const sp = winner.spin, y0 = sp.rotation.y;
    await T.tween({ dur: 0.42, ease: E.inCubic, tag: 'rail', update: e => { sp.rotation.y = y0 + Math.PI / 2 * e; sp.position.z = 0.5 * Math.sin(e * Math.PI / 2); } }); if (!alive()) return;
    r.burstT = T.time(); r.ring.scale.setScalar(0.55); r.keyFlash = 1;
    const holoBurst = S.holo && S.holo.burst ? S.holo.burst(winner.obj, {}).catch(() => null) : (S.snd && S.snd.play('burst'), null);
    await T.par([T.tween({ dur: 0.42, ease: E.outCubic, tag: 'rail', update: e => { sp.rotation.y = y0 + Math.PI / 2 + Math.PI / 2 * e; sp.position.z = 0.5 * Math.cos(e * Math.PI / 2); } }), holoBurst]); if (!alive()) return;
    sp.rotation.y = y0 + Math.PI; sp.position.z = 0; r.phase = 'reveal'; r.wobble = T.time();
    if (S.holo && S.holo.reveal) await S.holo.reveal(winner.obj, {}).catch(() => null); else await T.wait(0.4, 'rail');
    if (!alive()) return;
    /* the hand-off: the print slides to the right end of the pit and lies face up above the table top, where the arm
       can reach it (its hand only gets to about x 9 and up; loot keeps the rect's right end in reach) */
    r.phase = 'done'; const g = winner.obj.group; ctx.scene.attach(g); r.handed = true; winner.h.visible = false;
    landing.copy(g.position);   /* no slide to a landing spot: it goes straight up to the camera from here (Sam) */
    finish(winner.obj);
  }
  function flip() { if (R && R.prompt && R.flipNow) { const f = R.flipNow; R.flipNow = null; f(); } }

  /* ---------- close: sink it all back into the dark (a run still going resolves null) ---------- */
  function close() {
    const r = R; if (!r) return Promise.resolve(); if (r.closing) return r.closing;
    r.closing = (async () => {
      r.prompt = false; r.rumbleOn = false; if (r.hum) { try { r.hum.stop(); } catch (e) {} r.hum = null; } if (r.reelDone) { const f = r.reelDone; r.reelDone = null; f(); }
      ctx.canvas.style.cursor = 'default'; T.cancelAll('rail');
      if (!r.done) { r.alive = false; r.done = true; if (r.resolve) r.resolve(null); }
      S.snd && S.snd.play('sink'); r.sinking = true; r.phase = 'sink';
      await T.to(r.rg.rig.position, { y: SUNK }, { dur: 1.3, ease: E.inCubic, tag: 'railsink' });
      r.slots.forEach(s => { if (!(r.handed && s === r.winner)) S.slabs.drop(s.obj); });
      group.remove(r.rg.rig); disposeAll(r.rg.rig); group.remove(r.rm.room); disposeAll(r.rm.room);
      if (R === r) R = null; group.visible = false;
    })();
    return r.closing;
  }

  /* ---------- every frame ---------- */
  function frame(dt0) {
    const r = R; if (!r) return; const rm = r.rm, dt = Math.min(0.1, dt0) * T.timeScale(), t = T.time();
    /* lights: the safelight, the key on the winner after it lands, the flash of the burst */
    const sink = r.sinking ? T.clamp((r.rg.rig.position.y - SUNK) / (UP - SUNK), 0, 1) : 1;
    const redK = r.redK * (r.landed ? 1 - 0.6 * T.clamp((t - r.landed) / 0.7, 0, 1) : 1);
    rm.red.intensity = 26 * redK * (0.96 + 0.04 * Math.sin(t * 23)) * sink; rm.redBack.intensity = 14 * redK * sink; rm.halo.material.opacity = (0.4 + 0.06 * Math.sin(t * 7)) * r.redK * sink;
    if (r.keyFlash) r.keyFlash *= Math.exp(-dt * 6); rm.key.intensity = (16 * r.keyK + 40 * (r.keyFlash || 0)) * sink;
    /* the line of dripping prints drifts past */
    const span = rm.W / 2 + 0.6, tot = rm.LN * rm.LP, drift = t * 0.22;
    rm.hung.forEach(g => { let x = g.userData.i * rm.LP - drift; x = ((x + tot / 2) % tot + tot) % tot - tot / 2; g.visible = Math.abs(x) < span; g.position.x = x; });
    rm.drops.forEach(d => { const u = (t * 0.45 + d.ph) % 1, g = d.g, bottom = -0.06 - g.userData.ph; d.m.visible = g.visible; const fall = (bottom - (BENCH_Y - rm.line.position.y) - 0.1) * u * u; d.m.position.set(g.position.x + (d.k ? 0.28 : -0.3) * g.userData.pw, bottom - 0.02 + fall, 0.02); d.m.material.opacity = 0.8 * (1 - u * 0.5); });
    const { rg, slots, reel } = r;
    /* the reel */
    if (r.phase === 'reel' && reel) {
      r.u += dt; const pos = reelPos(reel, r.u), v = dt > 0 ? (pos - r.pos) / dt : 0; r.pos = pos; r.vel = v; r.blur = T.clamp(Math.abs(v) * r.pitch / 14, 0, 1);
      const idx = Math.floor(pos + 0.5); if (idx !== r.idx) { r.idx = idx; r.tick = 1; S.snd && S.snd.tick(T.clamp(Math.abs(v) / 18, 0, 1), v < 0); }
      if (r.rumbleOn && t - r.lastRumble > 0.1) { r.lastRumble = t; S.snd && S.snd.play('rumble', { gain: r.blur }); }
      if (r.u >= reel.total + 0.1 && r.reelDone) { const f = r.reelDone; r.reelDone = null; r.pos = reel.target; f(); }
    } else r.blur *= Math.exp(-dt * 6);
    r.tick *= Math.exp(-dt * 14);
    if (r.flash) { r.flash.intensity = 70 * r.tick; const near = slots.reduce((b, s) => { const dx = Math.abs(((s.i - r.pos) * r.pitch + slots.length * r.pitch * 1.5) % (slots.length * r.pitch) - slots.length * r.pitch / 2); return !b || dx < b.d ? { d: dx, s } : b; }, null); if (near) r.flash.color.set(S.SL.tierOf(near.s.obj.slab).color); }
    if (r.dust) { const p = r.dust.geometry.attributes.position; for (let i = 0; i < p.count; i += 1) { p.setY(i, p.getY(i) + dt * (0.08 + 0.05 * Math.sin(i))); if (p.getY(i) > 1.6) p.setY(i, -4); } p.needsUpdate = true; r.dust.material.opacity = 0.25 + 0.4 * r.blur; }
    rg.marker.rotation.z = -r.tick * 0.45 * Math.sign(r.vel || 1); rg.mg.material.opacity = 0.35 + 0.65 * r.tick; rg.line.material.opacity = r.landed ? Math.max(0.08, 0.7 - (t - r.landed)) : 0.7;
    const n = slots.length, total = n * r.pitch, half = total / 2, lag = T.clamp(-r.vel * r.pitch / 30, -1, 1) * 0.05;
    slots.forEach(s => {
      if (!s.placed && s.obj.built) placeHanger(s);
      if (s === r.winner && r.phase !== 'reel' && r.phase !== 'rise') return;
      let x = (s.i - r.pos) * r.pitch; x = ((x + half) % total + total) % total - half; const vis = Math.abs(x) < rm.span; s.h.visible = vis; s.h.position.x = x;
      s.swing += (lag - s.swing) * (1 - Math.exp(-dt * 9)); s.h.rotation.z = s.swing;
      /* the pass: prints bank into the motion, bob on their strings, and the one under the marker pops and flashes on each tick */
      if (r.phase === 'reel') { const near = Math.exp(-x * x / Math.max(0.6, r.pitch * 0.5)); s.h.rotation.y = -T.clamp(r.vel * r.pitch / 40, -1, 1) * 0.1; s.h.position.y = BAR_Y;
        s.spin.scale.setScalar(1 + 0.05 * r.tick * near); if (s.back) s.back.material.color.setScalar(0.78 + 0.22 * r.tick * near); }
      else if (r.phase === 'rise') { s.h.rotation.y = 0; s.h.position.y = BAR_Y; if (s.back) s.back.material.color.setScalar(0.78); }
      s.streak.material.opacity = 0.35 * r.blur; s.streak.scale.x = 0.3 + r.blur * 1.4; s.streak.position.x = -Math.sign(r.vel || 1) * r.blur * 0.8;
      if (r.landed && s !== r.winner) { s.dim += (0.3 - s.dim) * (1 - Math.exp(-dt * 4)); if (s.back) s.back.material.color.setScalar(s.dim); }
    });
    /* the landed print: the breath of the prompt, the rim in the finish colour, the burst and ring of the flip, the wobble after */
    const w = r.winner; if (!r.landed) return;
    const tl = t - r.landed, g = T.clamp((tl - 0.3) / 1.6, 0, 1), pulse = 0.85 + 0.15 * Math.sin(t * 2.4);
    if (r.flood) { r.flood.material.opacity = (0.18 + 0.42 * g) * pulse * (r.phase === 'prompt' || r.phase === 'land' ? 1 : Math.max(0.35, 1 - (t - (r.burstT || t)) * 0.8)); r.flood.scale.setScalar(0.5 + 0.9 * E.outCubic(g)); }
    r.hoverT += ((r.hover ? 1 : 0) - r.hoverT) * (1 - Math.exp(-dt * 10));
    if (r.rim) { const p = 0.5 + 0.5 * Math.sin(t * (r.glow.kind === 'pulse' ? 3.6 : 2.4)); const on = r.phase === 'prompt' ? 1 : r.phase === 'land' ? g : Math.max(0, 1 - (t - (r.burstT || t)) * 2);
      const c = r.rim.material.color; if (r.glow.kind === 'cycle') c.setHSL((t * 0.12) % 1, 0.75, 0.72); else c.copy(r.glow.color); if (r.glow.kind === 'sparkle') c.multiplyScalar(0.7 + 0.3 * Math.random());
      r.rim.material.opacity = (0.1 + 0.16 * p) * (1 + 1.4 * r.hoverT) * on; const b = (1 + 0.05 * p) * (1 + 0.06 * r.hoverT); r.rim.scale.set(b, b, 1);
      if (r.phase === 'prompt') w.spin.scale.setScalar(1.32 * (1 + 0.02 * p + 0.025 * r.hoverT));
      if (w.obj.setGlow) { try { w.obj.setGlow(r.phase === 'prompt' ? 0.25 + 0.75 * r.hoverT : 0); } catch (e) {} } }
    if (r.burst && r.burstT) { const k = t - r.burstT, b = Math.exp(-k * k * 18); r.burst.material.opacity = b; r.burst.scale.setScalar(0.8 + 1.2 * Math.min(1, k * 3)); const rk = T.clamp(k / 0.8, 0, 1); r.ring.scale.setScalar(0.55 + 1.6 * rk); r.ring.material.opacity = (1 - rk) * (1 - rk) * 0.9; }
    if (r.wobble && r.phase === 'reveal') { const k = t - r.wobble, e = Math.exp(-k * 2.6); w.spin.rotation.z = e * Math.sin(k * 12) * 0.08; w.spin.rotation.x = e * Math.sin(k * 9 + 0.8) * 0.06; }
  }

  /* ---------- pointer and keys over the landed print ---------- */
  function pointer(kind, e) {
    const r = R; if (!r || !r.prompt) return false;
    if (kind === 'move') { const was = r.hover; r.hover = !!S.hit(e, r.winner.spin); if (r.hover && !was) S.snd && S.snd.play('glow'); ctx.canvas.style.cursor = r.hover ? 'pointer' : 'default'; return r.hover; }
    if (kind === 'down') { if (e.button !== 0) return false; if (S.hit(e, r.winner.spin)) { flip(); return true; } return false; }
    return false;
  }
  function key(e) { if (R && R.prompt && (e.key === ' ' || e.key === 'Enter')) { flip(); return true; } return false; }

  S.rail = { group, landing, run, pointer, key, frame, close,
    __flip: flip, __spin: () => (R && R.winner ? R.winner.spin : null),
    /* the table loop calls update(dt) on everything in S.slabs; while loot.js is not forwarding frame(), this stand-in object is the driver */
    __drive(on) { if (on && !driver) { driver = { built: true, update: dt => frame(dt), setFinish() {}, dispose() {}, group: new THREE.Group(), slab: {} }; S.slabs.adopt(driver); } else if (!on && driver) { S.slabs.drop(driver); driver = null; } },
    state() { const r = R; return r ? { phase: r.phase, rigY: +r.rg.rig.position.y.toFixed(2), pos: +r.pos.toFixed(2), idx: r.idx, target: r.reel ? r.reel.target : null, rollback: r.reel ? r.reel.rollback : null, back: r.reel ? r.reel.back : null, pitch: +r.pitch.toFixed(2), prompt: r.prompt, hover: r.hover, built: r.slots.filter(s => s.obj.built).length, slots: r.slots.length, winner: r.winner.i, handed: r.handed } : { phase: 'off' }; },
  };
}
