// LOOT: the pull itself, from the red button to the raw print on the table. See docs/secret-round2.md and Sam's picks
// on docs/secret-ref/pull-environments.html (the table top rolls up like a blind and the rail rises out of the dark
// underneath) and cases-unboxing.html (35 mm film canisters, three on pedestals, the light follows your hand, the lid
// pops off and a tongue of film curls out at you). The rail itself is rail.js's; the arm is arm.js's; sounds sound.js's.
//
// States (all on S.M; index.js sends LOOT from idle and CLOSE on =):
//   loot.open     camera in, prints cleared, the stand camera dissolves, the arm goes aside, the blind rolls up.
//   loot.rise     three pedestals rise out of the pit with a canister hovering over each (Open another comes back here).
//   loot.pick     hover a canister (the light follows your hand), click one. Keys 1 2 3 pick too.
//   loot.pop      the lid pops, the film curls out, the other two sink, the chosen one dissolves to sand.
//   loot.reel     S.rail.run(slab, { rect, decoys }); pointer, keys and frames go to the rail.
//   loot.lay      the arm carries the print from the rail's landing to the table; S.table.adopt records it.
//   loot.result   the action bar: Look closer · Send for grading · Open another · Done.
//   loot.closing  everything reverses from wherever it was: rail down, pedestals sink, the blind rolls back, S.hole.close().
// Test hooks: S.loot.__pick(i), S.loot.rect, S.loot.state.
import * as THREE from 'three';

const X0 = -9.5, Z0 = -3.6, X1 = 9.5, Z1 = 3.6;   /* the pit: the middle of the dark side (the light side's blind opening is no longer used) */            /* the pit: the strip behind the board, where the arm can reach (its shoulder is at x 21.5, z -2.2, reach 13.6) */
const RECT = [X0, Z0, X1, Z1], CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2, PW = X1 - X0, PD = Z1 - Z0;
const PIT = 7;                                           /* how deep the dark liner goes */
const R0 = 0.1, R1 = 0.42;                               /* the roll of table top: radius as it starts and once it is all rolled up */
const PED_X = [-3.6, 0, 3.6], PED_H = [0.75, 1.05, 0.75], PED_Z = Z1 - 1.55, PED_R = 0.8, DOWN = -10.8;   /* sunk, the canister on top is below the pit floor too */
const CAN_K = 1.5;                                       /* the canister from the spec page is small for this table */
const LAND = [[18.9, -8.3], [18.9, -10.7], [18.9, -9.5]];  /* the print lands beside the pit, right under the arm's shoulder */

export function install(S) {
  S.dev.define('odds', 'Odds', { normal: 'As designed', lucky: 'Lucky (for testing)' }, 'lucky');
  const lucky = () => S.dev.opt('odds') === 'lucky', BIG = ['rare', 'epic', 'legendary', 'mythic'];
  const rollFor = o => S.SL.roll(lucky() && Math.random() < 0.8 ? { ...o, tier: BIG[Math.floor(Math.random() * BIG.length)], variant: Math.random() < 0.35 ? S.SL.VARIANTS[Math.floor(Math.random() * S.SL.VARIANTS.length)].id : undefined } : o);
  const { T, M, P, store } = S, E = T.E, ctx = S.ctx;
  const ENV = S.SM.envMap(S.renderer);
  const stdM = (c, r, m, o) => new THREE.MeshStandardMaterial({ color: c, roughness: r ?? 0.5, metalness: m ?? 0, envMap: ENV, envMapIntensity: m > 0.3 ? 1.2 : 0.35, ...(o || {}) });
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  const cyl = (rt, rb, h, mat, x, y, z, parent, seg) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 32), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const canvasOf = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), c); return c; };
  const L = { blind: 0, pushed: false, aimGone: false, railLive: false, railUp: false, hot: -1, handX: null, picking: false, slab: null, obj: null, lightT: 0, lightX: CX, lightY: 0, lightZ: PED_Z, peds: [], cans: [], closeP: null };

  /* ---------- the pit: a dark liner under the hole, a dim lamp in it, the roll of table top ---------- */
  const rig = new THREE.Group(); rig.visible = false; ctx.scene.add(rig);
  const liner = new THREE.Mesh(new THREE.BoxGeometry(PW, PIT, PD), new THREE.MeshLambertMaterial({ color: 0x15130f, side: THREE.BackSide })); liner.position.set(CX, -PIT / 2, CZ); liner.userData.noParticles = true; rig.add(liner);
  const lamp = new THREE.PointLight(0xffd9a8, 0, 12, 1.6); lamp.position.set(CX, -0.8, CZ + 1.2); rig.add(lamp);
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, PW + 0.5, 28), [lam(0xf0eee8), lam(0xd9d5cc), lam(0xd9d5cc)]); roller.rotation.z = Math.PI / 2; roller.visible = false; roller.userData.noParticles = true; ctx.scene.add(roller);
  const rollShadow = S.shadow(PW + 1.2, 1.6); rollShadow.visible = false; ctx.scene.add(rollShadow);
  /* k 0 = the table is whole, 1 = the whole rect is open and the roll sits past the far edge */
  function setBlind(k) {
    L.blind = k; const ze = Z1 - k * PD, r = R0 + (R1 - R0) * k;
    if (k <= 0.001) S.hole.close(); else S.hole.open(X0, ze, X1, Z1);
    roller.visible = rollShadow.visible = k > 0.001; roller.scale.set(r, 1, r); roller.position.set(CX, r, ze - r * 0.7); roller.rotation.x = -(Z1 - ze) / ((R0 + r) / 2);
    rollShadow.position.set(CX, 0.0045, ze - r * 0.7 + 0.2); rollShadow.scale.set(1, r / R1 + 0.3, 1);
  }
  async function blind(run, open) {
    const from = L.blind, to = open ? 1 : 0; if (Math.abs(to - from) < 0.001) return;
    const dur = 0.4 + 1.5 * Math.abs(to - from); S.snd.play(open ? 'blind' : 'sink', { dur });
    await T.tween({ dur, ease: E.inOutSine, tag: 'loot', update: e => setBlind(from + (to - from) * e) });
  }

  /* ---------- the pedestals, a canister over each, and the light that follows your hand ---------- */
  const pedsG = new THREE.Group(); rig.add(pedsG);
  PED_X.forEach((dx, i) => { const g = new THREE.Group(); g.position.set(CX + dx, DOWN, PED_Z); pedsG.add(g);
    cyl(PED_R, PED_R + 0.08, PED_H[i], lam(0xe6e2da), 0, PED_H[i] / 2, 0, g, 40); cyl(PED_R + 0.1, PED_R + 0.1, 0.06, lam(0xd3cfc6), 0, PED_H[i] - 0.03, 0, g, 40);
    L.peds.push({ g, h: PED_H[i], x: CX + dx }); });
  const filmTex = (() => { const c = canvasOf(256, 1024, g => { g.clearRect(0, 0, 256, 1024); g.fillStyle = '#6b3512'; g.fillRect(0, 0, 256, 1024);
    for (let i = 0; i < 8; i++) { const y = i * 128 + 10; g.fillStyle = '#2b180a'; g.fillRect(44, y, 168, 108); for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(190,120,60,' + (0.15 + Math.random() * 0.3) + ')'; g.beginPath(); g.ellipse(70 + Math.random() * 120, y + 20 + Math.random() * 70, 14 + Math.random() * 30, 10 + Math.random() * 24, Math.random() * 3, 0, 7); g.fill(); } }
    for (let y = 8; y < 1024; y += 26) { g.clearRect(12, y, 16, 14); g.clearRect(228, y, 16, 14); }
    g.fillStyle = 'rgba(255,220,150,0.55)'; g.font = '500 11px "Geist Mono", monospace'; for (let i = 0; i < 8; i++) { g.save(); g.translate(40, i * 128 + 120); g.rotate(-Math.PI / 2); g.fillText('STUDIUM 400  ' + (i + 1) + 'A', 0, 0); g.restore(); } });
    return S.SM.tex(c); })();
  /* the 35 mm canister from the spec page: black pot, yellow label, grey lid, a nub of spool on top; the film is a strip
     bent over a drum once the lid is off, so it curls up and out at you */
  function filmCanister() {
    const g = new THREE.Group(), R = 0.42, H = 1.3, plastic = stdM(0x151515, 0.45, 0.05);
    cyl(R, R, H, plastic, 0, 0, 0, g, 48);
    const lc = canvasOf(1024, 256, lg => { lg.fillStyle = '#e8b830'; lg.fillRect(0, 0, 1024, 256); lg.fillStyle = '#1a1a1a'; lg.fillRect(0, 0, 1024, 34); lg.fillRect(0, 222, 1024, 34); lg.font = '700 76px "Geist", sans-serif'; lg.textAlign = 'left'; lg.fillText('STUDIUM 400', 40, 130); lg.font = '500 24px "Geist Mono", monospace'; lg.fillText('COLOUR NEGATIVE FILM · 36 EXP · PROCESS C-41 · 135', 44, 176); lg.fillStyle = '#b8302a'; lg.fillRect(560, 60, 120, 40); lg.fillStyle = '#fff'; lg.font = '700 26px "Geist", sans-serif'; lg.fillText('ISO 400', 568, 90); for (let i = 0; i < 60; i++) { lg.fillStyle = Math.random() < 0.5 ? '#000' : '#e8b830'; lg.fillRect(720 + i * 4.6, 56, 3, 60); } });
    const label = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.004, R + 0.004, H * 0.72, 48, 1, true), new THREE.MeshStandardMaterial({ map: S.SM.tex(lc), roughness: 0.55 })); label.position.y = -0.03; g.add(label);
    cyl(R - 0.03, R - 0.03, 0.05, stdM(0x2a2a2a, 0.6), 0, H / 2 - 0.02, 0, g); cyl(0.09, 0.09, 0.2, stdM(0x333333, 0.5), 0, H / 2 + 0.06, 0, g, 20);
    const lid = new THREE.Group(); lid.position.y = H / 2; g.add(lid); const grey = stdM(0x9a9a9a, 0.5, 0.1); cyl(R + 0.03, R + 0.03, 0.14, grey, 0, 0.07, 0, lid, 48); cyl(R - 0.02, R - 0.02, 0.07, grey, 0, -0.03, 0, lid, 48); cyl(R + 0.035, R + 0.035, 0.03, stdM(0x7a7a7a, 0.5, 0.1), 0, 0.13, 0, lid, 48);
    const FW = 0.78, geo = new THREE.PlaneGeometry(FW, 1, 1, 48); const film = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: filmTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.35 })); film.visible = false; g.add(film);
    const pos = geo.attributes.position, uv = geo.attributes.uv, base = pos.array.slice();
    const setOpen = (k, t) => { const kl = E.inOutCubic(T.sub(k, 0, 0.45)); lid.position.y = H / 2 + 0.95 * Math.sin(kl * Math.PI * 0.5) + 0.03 * Math.sin(t * 2) * kl; lid.position.x = 0.8 * kl; lid.rotation.z = -0.9 * kl; lid.rotation.x = 0.3 * kl;
      const len = 2.3 * E.inOutCubic(T.sub(k, 0.25, 1)); film.visible = len > 0.01; if (!film.visible) return; const Rc = 0.82;
      for (let i = 0; i < pos.count; i++) { const v = base[i * 3 + 1] + 0.5, s = -0.3 + v * (len + 0.3), x = base[i * 3]; let py = s, pz = 0; if (s > 0) { const a = s / Rc; py = Rc * Math.sin(a); pz = Rc * (1 - Math.cos(a)); } pos.setXYZ(i, x + 0.025 * Math.sin(s * 5 + t * 2) * T.sub(s, 0, 1), H / 2 + py, pz); uv.setY(i, (s + 0.3) / 2.6); }
      pos.needsUpdate = true; uv.needsUpdate = true; geo.computeVertexNormals(); };
    g.scale.setScalar(CAN_K); setOpen(0, 0);
    return { group: g, setOpen, open: 0, hoverT: 0, phase: 0 };
  }
  L.peds.forEach((p, i) => { const c = filmCanister(); c.phase = i * 2.1; c.group.position.y = p.h + 0.55 + 0.65 * CAN_K; p.g.add(c.group); L.cans.push(c); });
  const dotTex = (() => { const c = canvasOf(256, 256, g => { const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }); return new THREE.CanvasTexture(c); })();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.95 * CAN_K, 2.8 * CAN_K, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); cone.userData.noParticles = true; rig.add(cone);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.6 * CAN_K, 1.6 * CAN_K), new THREE.MeshBasicMaterial({ map: dotTex, color: 0xffe9c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.userData.noParticles = true; rig.add(pool);
  const spot = new THREE.SpotLight(0xffe9c4, 0, 12, 0.42, 0.5, 1.2); spot.target = new THREE.Object3D(); rig.add(spot, spot.target);
  const pedsUp = () => L.peds.some(p => p.g.position.y > DOWN + 0.05);
  const canGroups = () => L.cans.map(c => c.group).filter(g => g.visible);
  function setHot(i) { if (L.hot === i) return; L.hot = i; ctx.canvas.style.cursor = i >= 0 ? 'pointer' : 'default'; }
  function resetCans() { L.cans.forEach(c => { c.open = 0; c.hoverT = 0; c.group.visible = true; c.group.scale.setScalar(CAN_K); c.setOpen(0, 0); }); }
  async function risePeds(run) {
    resetCans(); L.lampT = 1; S.snd.play('rise');
    await T.par(L.peds.map((p, i) => T.to(p.g.position, { y: 0 }, { dur: 1.3, ease: E.outCubic, delay: i * 0.14, tag: 'loot' })));
  }
  async function sinkPeds(run, which) {
    const list = L.peds.filter((p, i) => !which || which.includes(i)); if (!list.some(p => p.g.position.y > DOWN + 0.05)) return;
    S.snd.play('sink');
    await T.par(list.map((p, i) => T.to(p.g.position, { y: DOWN }, { dur: 1.0, ease: E.inCubic, delay: i * 0.08, tag: 'loot' })));
  }

  /* ---------- where a fresh print goes: beside the pit, within the arm's reach, the first spot clear of other table objects ---------- */
  function landingSpot() {
    for (const [x, z] of LAND) if (!S.table.list.some(o => Math.hypot(o.group.position.x - x, o.group.position.z - z) < 2.0)) return { x, z };
    const [x, z] = LAND[0]; return { x: x + (Math.random() - 0.5) * 0.6, z: z + (Math.random() - 0.5) * 0.6 };
  }

  /* ---------- the camera ---------- */
  const FRAME = () => ({ tx: CX + 1.2, ty: 0, tz: CZ + 1.6, pitch: 56, dT: ctx.fitDist(PW + 6, PD + 7, 56) });

  /* ---------- the result bar (the inspect bar's look, its own element so both can show) ---------- */
  const bar = S.el('div', '', ''); bar.id = 'skLoot'; document.body.appendChild(bar);
  const ACTS = { print: [['look', 'Look closer'], ['grade', 'Send for grading', true], ['another', 'Open another'], ['done', 'Done']], bare: [['another', 'Open another'], ['done', 'Done', true]] };
  function showBar(which) { bar.innerHTML = ACTS[which].filter(a => !(a[0] === 'grade' && L.slab && L.slab.graded)).map(a => '<button type="button" class="btn' + (a[2] ? ' primary' : '') + '" data-id="' + a[0] + '">' + a[1] + '</button>').join(''); bar.classList.add('on'); }
  function hideBar() { bar.classList.remove('on'); }
  bar.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (!b) return; e.stopPropagation(); if (M.is('loot.result')) act(b.dataset.id); });
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  S.css(LOOT_CSS);

  /* ---------- the machine ---------- */
  M.define('loot', {
    on: { CLOSE: () => 'loot.closing' },
    key(e, M) { if (e.key === 'Escape') { M.send('CLOSE'); return true; } return false; },
    frame(dt) {
      const t = T.time(), k = 1 - Math.exp(-dt * 8);
      if (L.railLive) S.rail.frame(dt);
      lamp.intensity += (((L.lampT || 0) * 14) - lamp.intensity) * k;
      if (!rig.visible) return;
      /* the canisters hover and turn; the hovered one lifts a touch and grows */
      L.cans.forEach((c, i) => { const p = L.peds[i]; if (!c.group.visible) return; c.hoverT += ((L.hot === i ? 1 : 0) - c.hoverT) * k;
        c.group.position.y = p.h + 0.55 + 0.65 * CAN_K + 0.1 * Math.sin(t * 1.3 + c.phase) + 0.22 * c.hoverT; c.group.scale.setScalar(CAN_K * (1 + 0.1 * c.hoverT));
        /* turning slowly while it waits; once the lid is off it swings round so the film curls out at you */
        if (c.open > 0) { const r = c.group.rotation.y, home = Math.round(r / (2 * Math.PI)) * 2 * Math.PI; c.group.rotation.y = T.damp(r, home, 5, dt); c.setOpen(c.open, t); } else c.group.rotation.y = t * 0.35 + c.phase; });
      /* the light follows your hand across the pedestals, settling on the one under it */
      const want = L.hot >= 0 ? 1 : L.handX != null ? 0.4 : 0; L.lightT += (want - L.lightT) * k;
      const tx = L.hot >= 0 ? L.peds[L.hot].x : L.handX != null ? T.clamp(L.handX, L.peds[0].x, L.peds[2].x) : L.lightX;
      const near = L.peds.reduce((b, p) => Math.abs(p.x - tx) < Math.abs(b.x - tx) ? p : b, L.peds[0]);
      L.lightX = T.damp(L.lightX, tx, 9, dt); L.lightY = T.damp(L.lightY, near.g.position.y + near.h, 9, dt);
      const cy = L.lightY + 0.55 + 0.65 * CAN_K; cone.position.set(L.lightX, cy + 1.2 * CAN_K, PED_Z); cone.material.opacity = 0.1 * L.lightT; pool.position.set(L.lightX, L.lightY + 0.012, PED_Z); pool.material.opacity = 0.4 * L.lightT;
      spot.position.set(L.lightX, cy + 3.2 * CAN_K, PED_Z); spot.target.position.set(L.lightX, cy, PED_Z); spot.intensity = 40 * L.lightT;
    },
  });

  M.define('loot.open', { busy: true,
    async enter(d, run) {
      L.pushed = true; S.lockStand(true); S.cam.push(FRAME()); ctx.hideActs(); S.sfx('ltInspect'); hideBar();
      /* on the dark side the hangar doors slide apart instead: no prints, tray, arm or blind */
      L.under = !!(S.under && S.under.on);
      if (L.under) { rig.visible = true; L.lampT = 0.35; await S.under.doors(true); if (!run.alive()) return; await T.wait(0.2, 'loot'); if (!run.alive()) return; M.go('loot.rise'); return; }
      await S.clearPrints([X0 - 0.6, Z0 - 0.6, ctx.W_T / 2, Z1 + 0.6], S.dev.opt('clearing')); if (!run.alive()) return;
      /* the photo tray sits over the pit: it slides forward out of the way and comes back at the end */
      if (ctx.tray && !L.trayAway) { L.trayAway = true; S.sfx('lift'); T.to(ctx.tray.position, { x: ctx.TR.x + 2.4, z: ctx.TR.z + 5.6 }, { dur: 0.8, ease: E.inOutCubic, tag: 'loot' }); }
      /* the stand camera dissolves (if the stand is up) while the arm swings aside */
      await S.arm.aside(); if (!run.alive()) return;
      /* after aside: the arm raises a folded stand itself, so only now is the camera on it for sure */
      if (ctx.aim.visible) { L.aimGone = true; await P.dissolve(ctx.aim, { mode: S.dev.opt('dissolve'), dur: 0.9, spread: 2 }); if (!run.alive()) return; }
      rig.visible = true; L.lampT = 0.35; S.sfx('detent');
      await blind(run, true); if (!run.alive()) return;
      await T.wait(0.2, 'loot'); if (!run.alive()) return;
      M.go('loot.rise');
    },
  });

  M.define('loot.rise', { busy: true,
    async enter(d, run) { L.obj = null; hideBar(); S.cam.set(FRAME()); await risePeds(run); if (!run.alive()) return; M.go('loot.pick'); },
  });

  M.define('loot.pick', {
    enter() { setHot(-1); L.handX = null; S.toast('Pick a canister.'); },
    pointer(kind, e, M) {
      if (kind === 'move') { const h = S.hitAny(e, canGroups()); setHot(h ? L.cans.findIndex(c => c.group === h.root) : -1); const th = S.tableHit(e, L.peds[1].h); L.handX = th ? th.x : null; return true; }
      if (kind === 'down') { if (e.button !== 0) return true; const h = S.hitAny(e, canGroups()); if (h) pick(L.cans.findIndex(c => c.group === h.root)); return true; }
      return true; },
    key(e) { if (/^[1-3]$/.test(e.key)) { pick(+e.key - 1); return true; } return false; },
    exit() { setHot(-1); L.handX = null; },
  });
  function pick(i) { if (!M.is('loot.pick') || i < 0 || i > 2) return; S.sfx('detent'); M.go('loot.pop', { i }); }

  /* the lid pops off and a tongue of film curls out at you; the other two sink; the chosen one dissolves to sand */
  M.define('loot.pop', { busy: true,
    async enter(d, run) {
      const i = d && d.i != null ? d.i : 1, c = L.cans[i]; L.hot = i; L.handX = null; ctx.canvas.style.cursor = 'default';
      S.snd.play('pop'); let film = false;
      sinkPeds(run, [0, 1, 2].filter(k => k !== i));
      await T.tween({ dur: 1.5, ease: E.linear, tag: 'loot', update: (e, r) => { c.open = r; if (r > 0.25 && !film) { film = true; S.snd.play('film'); } } }); if (!run.alive()) return;
      await T.wait(0.45, 'loot'); if (!run.alive()) return;
      L.hot = -1; L.lightT = 0;
      await P.dissolve(c.group, { mode: S.dev.opt('dissolve'), dur: 1.2, spread: 2.2, centre: c.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -2.5, 0)) }); if (!run.alive()) return;
      c.open = 0; c.setOpen(0, 0);
      await sinkPeds(run, [i]); if (!run.alive()) return;
      M.go('loot.reel');
    },
  });

  M.define('loot.reel', {
    async enter(d, run) {
      const packs = S.packs(), pk = packs.length ? packs[Math.floor(Math.random() * packs.length)] : null;
      const slab = rollFor(pk && pk.id != null ? { pack: pk.id } : {}); store.addPull(slab); S.hud(); L.slab = slab;
      const decoys = Array.from({ length: 14 }, () => rollFor({}));
      L.railLive = true; L.railUp = true;
      const obj = await S.rail.run(slab, { rect: RECT.slice(), decoys }); if (!run.alive()) return;
      M.go('loot.lay', { obj });
    },
    pointer(kind, e) { S.rail.pointer(kind, e); return true; },
    key(e) { return !!S.rail.key(e); },
  });

  /* the arm carries the print from the rail's landing to the table; without a rail yet, the print simply drops there */
  M.define('loot.lay', { busy: true,
    async enter(d, run) {
      const to = landingSpot(), yaw = (Math.random() - 0.5) * 0.3; let obj = d && d.obj;
      if (obj) {
        /* Sam: the print stays up close in view; OK (or a click on the room) lays it on the table and closes up */
        closeRail(); L.obj = obj; M.go('loot.result', { fresh: true }); return;
      } else {
        closeRail(); obj = S.objFor(L.slab); S.table.adopt(obj, to.x, to.z, yaw, { drop: true });
        await T.wait(0.7, 'loot'); if (!run.alive()) return;
      }
      L.obj = obj; M.go('loot.result');
    },
  });
  function closeRail() { if (!L.railUp) return; L.railUp = false; let p = null; try { p = S.rail.close(); } catch (e) { console.error(e); }
    L.closeP = Promise.resolve(p).catch(() => null).then(() => { L.railLive = false; L.closeP = null; }); }

  M.define('loot.result', {
    async enter(d, run) { const t = S.SL.tierOf(L.slab); S.toast(t.name + ' · ' + L.slab.title + '.');
      if (!(d && d.fresh)) { showBar('print'); return; }
      const obj = L.obj; if (!obj) { showBar('print'); return; }
      S.slabs.adopt(obj); const sealed = !!obj.slab.graded; const r = await S.inspect.open(obj, { actions: (sealed ? [] : [{ id: 'grade', label: 'Send for grading' }]).concat([{ id: 'another', label: 'Open another' }, { id: 'ok', label: 'OK', primary: true }]), hint: S.specLine(obj.slab) + '\nDrag to turn it, scroll to zoom. OK puts it on the table.' });
      /* it settles straight onto the table from the close view, no detour back to the rail */
      const to = landingSpot(), yaw = (Math.random() - 0.5) * 0.3, K = S.TABLE_K, y = (obj.th || S.SM.SLAB.th) * K / 2 + 0.004;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
      S.inspect.retarget({ pos: new THREE.Vector3(to.x, y, to.z), quat: q, scale: new THREE.Vector3(K, K, K) });
      while (S.inspect.active()) await T.wait(0.05); if (!run.alive()) return;
      S.table.adopt(obj, to.x, to.z, yaw); S.sfx('ltPutDown');
      if (r === 'grade') { await T.wait(0.6); if (!run.alive()) return; L.obj = null; S.sendForGrading(obj); await T.wait(0.6); if (!run.alive()) return; M.send('CLOSE'); return; }
      if (r === 'another') { await T.wait(0.5); if (!run.alive()) return; M.go('loot.rise'); return; }
      await T.wait(0.5); if (!run.alive()) return; M.send('CLOSE'); },
    pointer(kind, e) {
      const g = L.obj && L.obj.where === 'table' ? L.obj.group : null;
      if (kind === 'move') { const h = g && S.hit(e, g); ctx.canvas.style.cursor = h ? 'pointer' : 'default'; return true; }
      if (kind === 'down') { if (e.button !== 0) return true; if (g && S.hit(e, g)) act('look'); return true; }
      return true; },
    exit() { hideBar(); ctx.canvas.style.cursor = 'default'; },
  });
  async function act(id) {
    if (!M.is('loot.result')) return;
    if (id === 'done') { M.send('CLOSE'); return; }
    if (id === 'another') { M.go('loot.rise'); return; }
    const obj = L.obj; if (!obj || obj.where !== 'table') return;
    if (id === 'look') { hideBar(); const r = await S.inspect.open(obj, { actions: obj.slab.graded ? [{ id: 'back', label: 'Put down', primary: true }] : [{ id: 'back', label: 'Put down' }, { id: 'grade', label: 'Send for grading', primary: true }], hint: 'Drag to turn it, scroll to zoom. Click the room to put it down.' });
      while (S.inspect.active()) await T.wait(0.05); if (!M.is('loot.result')) return; if (r === 'grade') { await T.wait(0.3); if (!M.is('loot.result')) return; id = 'grade'; } else { showBar('print'); return; } }
    if (id === 'grade') { if (obj.slab.graded) return; showBar('bare'); L.obj = null; S.sendForGrading(obj); }
  }

  M.define('loot.closing', { busy: true,
    on: { CLOSE: () => undefined },
    async enter(d, run) {
      T.cancelAll('loot'); hideBar(); setHot(-1); L.handX = null; L.lightT = 0; if (S.inspect.active()) S.inspect.close('back');
      /* closed while the print was still up: it still goes on the table */
      if (L.obj && L.obj.where !== 'table') { const to = landingSpot(); S.table.adopt(L.obj, to.x, to.z, (Math.random() - 0.5) * 0.3, { drop: true }); } L.obj = null;
      closeRail(); if (L.closeP) await L.closeP;
      L.cans.forEach(c => { if (c.open > 0) c.group.visible = false; });
      if (pedsUp()) await sinkPeds(run);
      L.lampT = 0;
      if (L.under) { await S.under.doors(false); S.hole.close(); rig.visible = false; L.lampT = 0; resetCans(); }
      else { await blind(run, false); setBlind(0); S.hole.close(); roller.visible = rollShadow.visible = false; rig.visible = false; resetCans();
      /* the camera reforms on the arm before it rests; if the arm folds the stand away the camera goes with it */
      if (L.aimGone) { L.aimGone = false; await P.reform(ctx.aim, { mode: S.dev.opt('dissolve'), dur: 0.9, spread: 2 }); }
      await S.arm.rest(); }
      if (L.trayAway) { L.trayAway = false; await T.to(ctx.tray.position, { x: ctx.TR.x, z: ctx.TR.z }, { dur: 0.7, ease: E.inOutCubic }); }
      S.lockStand(false); if (L.pushed) { S.cam.pop(); L.pushed = false; } S.sfx('detent');
      M.go('idle');
    },
  });

  S.loot = { rect: RECT.slice(), state: L, rig,
    __pick(i) { if (M.is('loot.pick')) pick(i); },
    close() { if (M.is('loot')) M.send('CLOSE'); },
  };
}

const LOOT_CSS = `
#skLoot{ position:fixed; left:50%; bottom:calc(70px + env(safe-area-inset-bottom,0px)); transform:translate(-50%,12px); display:flex; gap:6px; padding:6px; background:var(--panel); border:1px solid var(--line); border-radius:8px; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); opacity:0; pointer-events:none; transition:opacity .25s, transform .35s cubic-bezier(.2,.8,.2,1); z-index:13; }
#skLoot.on{ opacity:1; pointer-events:auto; transform:translate(-50%,0); }
`;
