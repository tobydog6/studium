// ARM (round 2 agent): the copy stand's boom arm, driven by the secret layer while S.ctx.STAND.lock is on
// (S.lockStand(true) stops main.js posing it). The joints are S.ctx.clampG › poleG › yawJ › j1 › j2 and the camera
// S.ctx.aim; lengths S.ctx.L1 / L2, pole S.ctx.POLE, clamp at S.ctx.CL; S.ctx.solveArm() is the 2-bone IK for the
// normal pose and S.ctx.poseStand(u) the fold/unfold. See docs/secret-round2.md for S.arm.
//
// S.arm = { aside(o), reachTo(worldPoint, o), carry(obj, fromWorld, toWorld, o), rest(o), hand() }. Every move is a
// tween tagged 'arm' on S.T with an overshoot and a spring settle, so a new command (or S.T.cancelAll('arm')) stops the
// one before it. The first command captures the pose main.js left (home); rest() animates back to it and leaves
// STAND.lock to the caller. If the stand is down when the arm is asked for, it raises itself out of the kit first and
// rest() folds it back in. The hand is the end of j2 (where the camera hangs); the shoulder is yawJ, so the reach is
// L1 + L2 (13.6) from CL.x + 0.06, 0.5 + POLE, CL.z. A point past that gets the closest pose on the line to it, and
// carry() still lays the object exactly at `to`.
export function install(S) {
  const THREE = S.THREE, T = S.T, C = S.ctx, TAG = 'arm', PI = Math.PI;
  const V = (x, y, z) => new THREE.Vector3(x, y, z), clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ASIDE = { yaw: 0.42, a1: 1.32, a2: -2.62 };   /* up and off the table's right edge, elbow folded */
  const GRIP = 0.34, LIFT = 1.5;                      /* the hand sits this far above a carried object's centre; how high it lifts to travel */
  const pose = { yaw: 0, a1: 0, a2: 0 };
  let home = null, rose = false, held = null, gen = 0;
  const handG = new THREE.Group(); handG.position.x = C.L2; C.j2.add(handG);
  const flatQ = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -PI / 2);
  const flat = yaw => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw || 0).multiply(flatQ);
  const snd = (id, o) => { try { if (S.snd && S.snd.play) S.snd.play(id, o); } catch (e) {} };
  const sfx = id => { try { if (S.sfx) S.sfx(id); } catch (e) {} };
  const near = (t, c) => t - Math.round((t - c) / (2 * PI)) * 2 * PI;   /* the same yaw, the short way round from c */
  const over = t => { const c = 0.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };   /* a mild overshoot */
  const isUp = () => !!(C.stand.visible && C.STAND.up);

  function readPose() { pose.yaw = C.yawJ.rotation.y; pose.a1 = C.j1.rotation.z; pose.a2 = C.j2.rotation.z; }
  function tip() { C.stand.updateMatrixWorld(true); return C.j2.localToWorld(V(C.L2, 0, 0)); }
  /* write the three angles to the joints, hang the camera off the tip and restretch the springs, like poseStand does */
  function apply() {
    C.yawJ.rotation.y = pose.yaw; C.j1.rotation.z = pose.a1; C.j2.rotation.z = pose.a2;
    C.STAND.yaw = pose.yaw; C.STAND.a1 = pose.a1; C.STAND.a2 = pose.a2;
    const t = tip(); C.aim.position.copy(t).add(V(0, -0.95, 0)); C.aim.lookAt(C.BX, 0, C.BZ); C.aim.updateMatrixWorld(true);
    if (C.springs && C.springs.length > 1 && C.placeSpring) {
      C.placeSpring(C.springs[0], C.yawJ.localToWorld(V(0.3, -0.55, 0.2)), C.j1.localToWorld(V(C.L1 * 0.5, -0.1, 0.2)));
      C.placeSpring(C.springs[1], C.j1.localToWorld(V(C.L1 - 0.7, 0.18, -0.2)), C.j2.localToWorld(V(C.L2 * 0.45, 0.12, -0.2))); }
    if (held) holdFrame();
  }
  /* 2-bone IK against the real joints: the target in the pole's frame, relative to the shoulder (yawJ), elbow up like
     the stand's own pose. `short` is how far the point lies beyond the reach (0 when reachable). */
  function solve(p) {
    C.stand.updateMatrixWorld(true);
    const l = C.poleG.worldToLocal(p.clone()).sub(C.yawJ.position), L1 = C.L1, L2 = C.L2;
    const r = Math.hypot(l.x, l.z), h = l.y, D = Math.hypot(r, h), d = clamp(D, Math.abs(L1 - L2) + 0.05, L1 + L2 - 0.05);
    const b = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), c = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    return { yaw: Math.atan2(-l.z, l.x), a1: Math.atan2(h, r) + b, a2: -(PI - c), short: Math.max(0, D - d) };
  }
  /* tween the angles to `to` with an overshoot, then a spring settle onto them exactly. o.stagger folds the elbow
     before the yaw swings (aside); o.dur overrides the travel-scaled time; o.onFrame(r) runs each frame of the move. */
  async function moveTo(to, o = {}) {
    const from = { ...pose }, end = { yaw: near(to.yaw, pose.yaw), a1: to.a1, a2: to.a2 };
    const travel = Math.abs(end.yaw - from.yaw) + Math.abs(end.a1 - from.a1) + Math.abs(end.a2 - from.a2);
    if (travel < 1e-4) return true;
    const dur = o.dur ?? clamp(0.45 + 0.42 * travel, 0.5, 1.9), mix = (k, e) => from[k] + (end[k] - from[k]) * e;
    snd('servo', { dur });
    const ok = await T.tween({ tag: TAG, dur, ease: T.E.linear, update: (e, r) => {
      const ea = over(T.E.inOutSine(o.stagger ? T.sub(r, 0, 0.8) : r)), ey = over(T.E.inOutSine(o.stagger ? T.sub(r, 0.22, 1) : r));
      pose.yaw = mix('yaw', ey); pose.a1 = mix('a1', ea); pose.a2 = mix('a2', ea); if (o.onFrame) o.onFrame(r); apply(); } });
    if (!ok) return false;
    const A = (0.012 + 0.014 * Math.min(travel, 3)) * (o.settle ?? 1);
    return T.tween({ tag: TAG, dur: 0.55, ease: T.E.linear, update: (e, r) => { const w = Math.exp(-5 * r) * (1 - r);
      pose.a1 = end.a1 + A * w * Math.sin(17 * r); pose.a2 = end.a2 - 0.7 * A * w * Math.sin(17 * r + 0.5); pose.yaw = end.yaw + 0.25 * A * w * Math.sin(13 * r); apply(); } });
  }
  /* the stand was down: bring it up ourselves (main.js is locked out), lid first, and fold it back in rest() */
  async function raise() {
    if (isUp() || rose) return true;
    rose = true; C.stand.visible = true; sfx('kitOpen'); setTimeout(() => sfx('raise'), 700);
    const ok = await T.tween({ tag: TAG, dur: 2.4, ease: T.E.linear, update: (e, r) => { C.kitLid.rotation.x = -1.9 * T.E.outCubic(T.sub(r, 0, 0.35)); C.poseStand(T.sub(r, 0.1, 1)); } });
    if (ok) sfx('detent'); readPose(); return ok;
  }
  async function lower() {
    const ok = await T.tween({ tag: TAG, dur: 1.7, ease: T.E.linear, update: (e, r) => { C.poseStand(1 - T.sub(r, 0, 0.8)); C.kitLid.rotation.x = -1.9 * (1 - T.E.outCubic(T.sub(r, 0.55, 1))); } });
    if (!ok) return false;
    C.poseStand(0); C.stand.visible = false; (C.springs || []).forEach(m => { m.visible = false; }); C.aim.visible = false; C.kitLid.rotation.x = 0; rose = false; sfx('kitClose'); return true;
  }
  /* every command: lock, cancel what the arm was doing, remember main.js's pose the first time */
  async function take() {
    C.STAND.lock = true; T.cancelAll(TAG); const g = ++gen;
    if (!(await raise())) return 0;
    if (!home) home = { yaw: C.yawJ.rotation.y, a1: C.j1.rotation.z, a2: C.j2.rotation.z, aimP: C.aim.position.clone(), aimQ: C.aim.quaternion.clone(), aimVis: C.aim.visible };
    readPose(); return g;
  }
  const live = g => g === gen;

  /* the carried object hangs under the hand; `k` blends it from where it was picked up (0) to under the hand (1) and
     `q` turns it from its own orientation to flat at the final yaw */
  function holdFrame() {
    const h = held, under = tip().add(V(0, -h.grip, 0));
    const pos = h.from.clone().lerp(under, h.k).lerp(h.to, h.down), q = h.q0.clone().slerp(h.q1, h.qk);
    handG.updateMatrixWorld(true); const g = h.obj.group;
    g.position.copy(handG.worldToLocal(pos)); g.quaternion.copy(handG.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
  }
  function release(h) {
    if (!h || held !== h) return; held = null; const g = h.obj.group;
    if (g.parent !== S.scene) S.scene.attach(g); g.position.copy(h.to); g.quaternion.copy(h.q1); g.updateMatrixWorld(true);
  }

  S.arm = {
    /* the boom swings up and out of the way of the table: elbow folds, then it yaws off the right edge */
    async aside(o = {}) { const g = await take(); if (!g) return false; return (await moveTo(ASIDE, { stagger: true, ...o })) && live(g); },
    /* the hand (the end of j2) goes to a world point, as near as the arm reaches */
    async reachTo(p, o = {}) { const g = await take(); if (!g) return false; const s = solve(p); return (await moveTo(s, o)) && live(g); },
    /* reach to `from`, take the object, lift, travel, lower it flat at `to` (o.yaw), let go and draw back a little */
    async carry(obj, from, to, o = {}) {
      const g = await take(); if (!g || !obj || !obj.group) return false;
      const grp = obj.group, yaw = o.yaw || 0, half = (obj.th || 0.03) * (grp.scale ? grp.scale.y : 1) / 2;
      const h = { obj, grip: (o.grip ?? GRIP) + half, from: from.clone(), to: to.clone(), k: 0, down: 0, qk: 0, q0: grp.getWorldQuaternion(new THREE.Quaternion()), q1: flat(yaw) };
      const up = V(0, h.grip, 0), lift = V(0, h.grip + (o.lift ?? LIFT), 0), bail = () => { release(h); return false; };
      if (!(await moveTo(solve(from.clone().add(up)))) || !live(g)) return false;
      /* take it */
      held = h; handG.attach(grp); sfx('grab'); holdFrame();
      if (!(await T.tween({ tag: TAG, dur: 0.18 })) || !live(g)) return bail();
      /* lift: the object comes up to sit under the hand as it rises (it may have been picked up at full stretch) */
      const s1 = solve(from.clone().add(lift)), onLift = r => { h.k = T.E.outCubic(r); h.qk = 0.3 * r; };
      if (!(await moveTo(s1, { settle: 0.5, dur: 0.75, onFrame: onLift })) || !live(g)) return bail();
      h.k = 1; h.qk = 0.3;
      const s2 = solve(to.clone().add(lift));
      const trav = Math.abs(near(s2.yaw, pose.yaw) - pose.yaw) + Math.abs(s2.a1 - pose.a1) + Math.abs(s2.a2 - pose.a2);
      if (!(await moveTo(s2, { dur: clamp(0.6 + 0.5 * trav, 0.7, 2.2), settle: 0.6 })) || !live(g)) return bail();
      /* lower: the hand comes down as far as it can and the object meets the table at `to` exactly */
      const s3 = solve(to.clone().add(up)), f3 = { ...pose }, e3 = { yaw: near(s3.yaw, pose.yaw), a1: s3.a1, a2: s3.a2 };
      const ok = await T.tween({ tag: TAG, dur: 0.6, ease: T.E.inOutCubic, update: e => { pose.yaw = f3.yaw + (e3.yaw - f3.yaw) * e; pose.a1 = f3.a1 + (e3.a1 - f3.a1) * e; pose.a2 = f3.a2 + (e3.a2 - f3.a2) * e; h.down = e; h.qk = 0.3 + 0.7 * e; apply(); } });
      if (!ok || !live(g)) return bail();
      release(h); sfx('ltPutDown');
      /* let go and draw back */
      const s4 = solve(to.clone().add(V(0, h.grip + 1.4, 0)));
      return (await moveTo(s4, { dur: 0.6, settle: 0.6 })) && live(g);
    },
    /* back to the pose main.js had, then the lock is the caller's again */
    async rest(o = {}) {
      T.cancelAll(TAG); const g = ++gen; if (held) release(held);
      if (!home) { if (rose) { C.STAND.lock = true; return lower(); } return true; }
      C.STAND.lock = true; readPose();
      const ok = await moveTo(home, o);
      if (!ok || !live(g)) return false;
      pose.yaw = home.yaw; pose.a1 = home.a1; pose.a2 = home.a2; apply();
      C.aim.position.copy(home.aimP); C.aim.quaternion.copy(home.aimQ); C.aim.visible = home.aimVis; C.aim.updateMatrixWorld(true);
      home = null;
      return rose ? lower() : true;
    },
    hand() { return tip(); },
    /* for the dev panel and tests */
    solve, pose: () => ({ ...pose }), busy: () => T.running(TAG) || !!held,
  };
}
