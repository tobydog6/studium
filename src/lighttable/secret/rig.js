// RIG: the computer on the dark side, made by two machines (Sam). A black sports car waits on the left and a mech on
// the right. Click either: the car drives to the middle and stops side on; the mech walks over and stands behind it.
// Then they transform like real transformers, every move a hinge or a slide on a part that stays attached:
//   the car → the keyboard and the mouse: the canopy unlatches, hinges up, lifts off and folds down into the mouse;
//     the wheels turn flat and tuck into the body; the rear wing folds down; the body drops, splits down the middle
//     and the halves slide apart into the keyboard's rails while the keys rise out of the floor in a wave.
//   the mech → the monitor: the head sinks into the shoulders, it kneels and its legs fold forward into the feet,
//     the spine telescopes up into the neck, the shoulders slide back on their rails and the arms fold away, and the
//     two wings folded across its chest swing open like doors into the sides of a curved screen.
// They connect (a cable snakes from the monitor's base into the back of the keyboard and a pulse runs down it), the
// screen boots, and the camera flies into it: the exchange (market.js) is an HTML page laid exactly over the 3D
// screen, so the edge of the monitor stays in view. Examine a card and the screen dims, a little arm slides out of
// the mech's head towards you, a blue beam shoots down and scans the real card in front of the screen; once it is
// built the beam goes clear and the card is yours to turn. Close it and it all runs backwards; shut the exchange and
// the two transform back and go home. Shapes in rigmodel.js. A click while they are transforming speeds it up.
//   S.rig = { root, wants(), go(), inPc(), projecting(), project(slab), onClose(), pointer(kind, e), frame(dt) }
//   states: 'pc.go' (busy), 'pc.view', 'pc.back' (busy)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildCar, buildKeys, buildMech, dressMech, radial, CAR, MECH } from './rigmodel.js';
import MECH_GLB from './mech.glb';

export function install(S) {
  if (!S.under) return;
  const { T, M, ctx } = S, E = T.E, ENV = S.SM.envMap(S.renderer), PI = Math.PI;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const CPARK = { x: -8.4, z: -1.0, h: 0.12 };      /* the car, nose towards the middle, clear of the case, the Blades launcher and the binder */
  const KB = { x: 0, z: -4.6 };                      /* where it stops side on and becomes the keyboard: the top of the table, clear of the pit (Sam) */
  const MPARK = { x: 12.6, z: 0.8, yaw: -PI / 2 };   /* between the shelf and the pit */   /* the mech, facing the middle, clear of the shelf, the pit and the big button */
  const MON = { x: 0, z: -8.3 };                     /* where it stands and becomes the monitor */
  const MOUSE = V(KB.x + 4.35, 0, KB.z + 1.0);
  const snd = (id, o) => { try { if (S.snd && S.snd.play) return S.snd.play(id, o); } catch (e) {} return null; };
  const sub = T.sub, smooth = e => e * e * e * (e * (e * 6 - 15) + 10), over = e => 1 + 2.2 * Math.pow(e - 1, 3) + 1.2 * Math.pow(e - 1, 2), bump = T.bump;
  const R = { awake: 0, mAwake: 0, hover: null, busy: false, inPc: false, steer: 0, rgbT: 0, tc: 0, tm: 0, tk: 0, fast: false };

  /* ---------- the car: drive root › body (it drops) › two halves, the floor with the key bed, the canopy, the wing; wheels on the root ---------- */
  const root = new THREE.Group(); root.userData.secret = true; S.under.group.add(root);
  const car = buildCar(THREE, ENV), keys = buildKeys(THREE, ENV), mech = buildMech(THREE, ENV);
  const carRoot = new THREE.Group(); carRoot.rotation.order = 'YXZ'; root.add(carRoot);
  const body = new THREE.Group(); carRoot.add(body);
  const halves = { 1: new THREE.Group(), [-1]: new THREE.Group() }; body.add(halves[1], halves[-1]);
  const PIV = V(1.15, 0.94, 0), canopy = new THREE.Group(); canopy.position.copy(PIV); body.add(canopy);
  const WPIV = V(-2.42, 0.98, 0), wingP = new THREE.Group(); wingP.position.copy(WPIV); body.add(wingP);
  const wheels = [];
  car.parts.forEach(p => { const o = p.obj;
    if (p.kind === 'panel') halves[o.userData.s].add(o);
    else if (p.kind === 'floor') { body.add(o); o.add(keys.bed); }
    else if (p.kind === 'cabin') { o.position.sub(PIV); canopy.add(o); }
    else if (p.kind === 'wing') { o.position.sub(WPIV); wingP.add(o); }
    else if (p.kind === 'wheel') { carRoot.add(o); o.userData.home = o.position.clone(); wheels.push(o); } });
  /* what makes the canopy a mouse once it lands: a base, a light ring and a scroll wheel (hidden until then) */
  const mouseBits = new THREE.Group(); canopy.add(mouseBits); mouseBits.scale.setScalar(0.001);
  { const base = new THREE.Mesh(new S.RoundedBoxGeometry(2.62, 0.08, 1.86, 2, 0.04), new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.6, metalness: 0.4, envMap: ENV })); base.position.set(-1.31, -0.02, 0); mouseBits.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 6, 64), new THREE.MeshBasicMaterial({ color: 0x4fb8ff })); ring.rotation.x = PI / 2; ring.scale.set(1.32, 0.95, 1); ring.position.set(-1.31, -0.03, 0); mouseBits.add(ring); mouseBits.userData.ring = ring;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 20), ring.material); wheel.rotation.x = PI / 2; wheel.position.set(-0.55, 0.42, 0); mouseBits.add(wheel); }
  /* the finished mouse: the canopy folds down into it and it closes over (Sam: nothing left of the toy) */
  const cleanMouse = new THREE.Group(); cleanMouse.position.copy(MOUSE); cleanMouse.scale.setScalar(0.001); cleanMouse.visible = false; root.add(cleanMouse);
  { const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, PI * 2, 0, PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x0d0e10, metalness: 0.4, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMap: ENV })); sh.scale.set(0.42, 0.28, 0.68); sh.position.y = 0.05; cleanMouse.add(sh);
    const split = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.34), new THREE.MeshBasicMaterial({ color: 0x000000 })); split.position.set(0, 0.31, 0.3); split.rotation.x = -0.35; cleanMouse.add(split);
    const ringM = new THREE.MeshBasicMaterial({ color: 0x4fb8ff }), wh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16), ringM); wh.rotation.z = PI / 2; wh.position.set(0, 0.32, 0.26); cleanMouse.add(wh);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 48), ringM); ring.rotation.x = PI / 2; ring.scale.set(0.42, 0.68, 1); ring.position.y = 0.05; cleanMouse.add(ring); cleanMouse.userData.ring = ringM; }
  const under = car.parts.find(p => p.name === 'floor').obj.userData.under;
  /* the mouse pose, in the body's frame once the car has stopped side on at KB (the body has dropped 0.15 by then) */
  const mouseQ = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -PI / 2), MS = V(0.42, 0.78, 0.37);
  const mouseAt = () => V(MOUSE.x - KB.x, 0.06 + 0.15, MOUSE.z - KB.z + 2.62 * MS.x / 2);
  car.glow.forEach(m => S.bloom.glow(m));

  /* ---------- the mech ---------- */
  root.add(mech.root);
  const ML = mech.legs, MA = mech.arms, MW = mech.wings, PELV = { min: 0.68 };
  /* a leg: a thigh angle forward, a knee bend; the foot stays flat unless told to fold */
  const reach = (a, b) => 0.22 + MECH.L1 * Math.cos(a) + MECH.L2 * Math.cos(a - b) + 0.37;
  function legs(aL, bL, aR, bR, fold) { const set = (l, a, b) => { l.hip.rotation.x = -a; l.knee.rotation.x = b; l.ankle.rotation.x = a - b - (fold || 0) * PI / 2; };
    set(ML[0], aL, bL); set(ML[1], aR, bR); mech.pelvis.position.y = Math.max(PELV.min, reach(aL, bL), reach(aR, bR)); }
  function mechT(t) {   /* the transform, 0 robot .. 1 monitor */
    R.tm = t; const crouch = smooth(sub(t, 0.06, 0.24)), fold = smooth(sub(t, 0.24, 0.5));
    const a = 0.55 * crouch + (PI / 2 - 0.55) * fold, b = 1.1 * crouch + (PI - 1.1) * fold; legs(a, b, a, b, fold);
    mech.head.position.y = MECH.TH / 2 - 0.55 * smooth(sub(t, 0.0, 0.14)); mech.head.rotation.y = 0;
    mech.spine.position.y = 0.3 + (MECH.cy - 2.33 - 0.3) * smooth(sub(t, 0.36, 0.6));
    const sh = smooth(sub(t, 0.28, 0.46)); MA.forEach(m => { m.mount.position.x = m.s * (MECH.TW / 2 + 0.6 - 0.95 * sh); m.mount.position.z = -0.9 * sh; m.mount.position.y = MECH.TH / 2 - 0.55 - 0.9 * sh; m.arm.rotation.x = 1.25 * sh; m.elbow.rotation.x = -2.1 * sh; m.pad.rotation.x = -0.3 * sh; });
    MW.forEach((w, i) => { const e = sub(t, 0.5 + i * 0.04, 0.76 + i * 0.04), k = e > 0 ? over(e) : 0; w.hinge.rotation.y = w.s < 0 ? PI + (0.32 - PI) * k : -PI + (PI - 0.32) * k; w.slide.position.z = w.s > 0 ? -0.34 * (1 - smooth(sub(t, 0.5, 0.62))) : 0; });
    /* sealed: the head, the arms, the legs and the hip armour fold away inside, and the monitor's own shells close over */
    const cm = smooth(sub(t, 0.8, 0.97)), gs = sub(t, 0.8, 0.98), g2 = gs > 0 ? E.outBack(gs) : 0, sc = (o, k) => { o.scale.setScalar(Math.max(0.001, k)); o.visible = k > 0.002; };
    mech.head.position.y -= 0.95 * cm; mech.head.position.z = -0.45 * cm; MA.forEach(m => sc(m.mount, 1 - cm)); ML.forEach(l => sc(l.hip, 1 - cm)); [...mech.skin.pelvis, ...mech.skin.spine].forEach(m => sc(m, 1 - cm));
    [...mech.skin.torso, ...mech.skin.wings, mech.skin.neck, mech.skin.foot].forEach(o => sc(o, g2));
    /* the one curved screen rolls out from the middle over the three panels */
    const dp = sub(t, 0.84, 0.99), de = dp > 0 ? E.outCubic(dp) : 0; mech.skin.display.visible = de > 0; mech.skin.display.scale.set(Math.max(0.001, de), 1, 1); const panelsOn = de < 0.98; mech.panels.forEach(p => { p.visible = panelsOn; }); mech.housing.forEach(m => { m.visible = panelsOn; });
    MW.forEach(w => w.slide.children.forEach(c => { if (!mech.skin.wings.includes(c)) c.visible = panelsOn; }));   /* behind the one screen nothing of the robot is left */
    mech.torso.rotation.set(0, 0, 0); }
  /* the walk: phase ph (2 PI is two steps), amp 0 standing .. 1 striding */
  function walkPose(ph, amp) { const f = p => [0.42 * amp * Math.sin(p), amp * (0.12 + 0.75 * Math.max(0, Math.cos(p)))];
    const [aL, bL] = f(ph + PI), [aR, bR] = f(ph); legs(aL, bL, aR, bR, 0);
    MA.forEach(m => { m.arm.rotation.x = 0.32 * amp * Math.sin(m.s < 0 ? ph : ph + PI); m.elbow.rotation.x = -0.25 * amp; });
    mech.torso.rotation.y = 0.05 * amp * Math.sin(ph); mech.torso.rotation.z = 0.025 * amp * Math.sin(ph); }
  mech.root.position.set(MPARK.x, 0, MPARK.z); mech.root.rotation.y = MPARK.yaw; mechT(0);
  /* the Blender model goes on as soon as it is parsed (a moment after the table opens); until then the stand-in boxes */
  try { new GLTFLoader().parse(MECH_GLB.buffer.slice(MECH_GLB.byteOffset, MECH_GLB.byteOffset + MECH_GLB.byteLength), '', g => { try { dressMech(THREE, ENV, mech, g); mechT(R.tm); } catch (e) { console.error('mech', e); } }, e => console.error('mech', e)); } catch (e) { console.error('mech', e); }
  mech.occluders.forEach(o => o.layers.set(S.bloom.FX));   /* the monitor hides the glow of whatever is behind it, without glowing */

  /* ---------- the screen, the cable ---------- */
  const splash = (() => { const c = document.createElement('canvas'); c.width = 2048; c.height = 890; const g = c.getContext('2d');
    g.fillStyle = '#0e0f11'; g.fillRect(0, 0, 2048, 890); g.fillStyle = '#f2efe9'; g.beginPath(); g.moveTo(0, 0); g.lineTo(1180, 0); g.lineTo(900, 890); g.lineTo(0, 890); g.closePath(); g.fill();
    g.save(); g.clip(); g.strokeStyle = 'rgba(14,14,14,0.06)'; g.lineWidth = 2; for (let x = 0; x < 1200; x += 56) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 890); g.stroke(); } for (let y = 0; y < 890; y += 56) { g.beginPath(); g.moveTo(0, y); g.lineTo(1200, y); g.stroke(); } g.restore();
    g.fillStyle = '#0e0e0e'; g.font = '900 150px "Archivo", "Geist", "Helvetica Neue", Arial, sans-serif'; g.fillText('STUDIUM', 120, 470); g.font = 'italic 400 96px "Instrument Serif", Georgia, serif'; g.fillText('House', 140, 580);
    g.fillStyle = '#f4f1ea'; g.font = '500 30px "Geist Mono", "JetBrains Mono", monospace'; g.fillText('THE EXCHANGE', 1300, 420); g.fillStyle = 'rgba(244,241,234,0.25)'; g.fillRect(1300, 460, 560, 6); g.fillStyle = '#f4f1ea'; g.fillRect(1300, 460, 380, 6);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
  const SM_ = mech.screenMat.uniforms; SM_.map.value = splash;
  const cablePts = [V(0.9, 0.16, MON.z + 0.78), V(0.95, 0.04, MON.z + 1.2), V(0.8, 0.04, KB.z - 1.5), V(0.85, 0.3, KB.z - 1.08)];
  const cableCurve = new THREE.CatmullRomCurve3(cablePts);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 60, 0.045, 8, false), new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.5, metalness: 0.3, envMap: ENV }));
  cable.geometry.setDrawRange(0, 0); cable.visible = false; root.add(cable); const cableN = cable.geometry.index.count;
  const plugs = [0, 1].map(i => { const m = new THREE.Mesh(new S.RoundedBoxGeometry(0.16, 0.12, 0.22, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0x8a8d94, metalness: 0.9, roughness: 0.3, envMap: ENV })); m.position.copy(cablePts[i ? 3 : 0]); m.visible = false; root.add(m); return m; });
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshBasicMaterial({ color: 0x9fdcff })); pulse.visible = false; root.add(pulse); S.bloom.glow(pulse);
  function connectT(t) { R.tk = t; const g = smooth(sub(t, 0, 0.55)); cable.visible = g > 0.002; cable.geometry.setDrawRange(0, Math.floor(cableN * g / 6) * 6);
    plugs[0].visible = t > 0.02; plugs[1].visible = t > 0.55; const p = sub(t, 0.6, 0.95); pulse.visible = p > 0 && p < 1; if (pulse.visible) pulse.position.copy(cableCurve.getPoint(1 - p)); }

  /* ---------- the car's transform: 0 car .. 1 keyboard and mouse ---------- */
  const hingeQ = new THREE.Quaternion();
  function carT(t) {
    R.tc = t;
    body.position.y = -0.06 * bump(sub(t, 0, 0.12)) - 0.15 * smooth(sub(t, 0.3, 0.42));
    /* the canopy: unlatch and hinge up at its front edge, then lift off, turn and fold down into the mouse */
    const h1 = smooth(sub(t, 0.05, 0.18)), tr = sub(t, 0.18, 0.46), s2 = tr > 0 ? over(tr) : 0, r2 = smooth(tr);
    hingeQ.setFromAxisAngle(V(0, 0, 1), -0.62 * h1);
    const A = PIV, B = mouseAt(), Mid = A.clone().add(B).multiplyScalar(0.5); Mid.y += 2.2; const a = 1 - s2;
    canopy.position.set(0, 0, 0).addScaledVector(A, a * a).addScaledVector(Mid, 2 * a * s2).addScaledVector(B, s2 * s2);
    canopy.quaternion.slerpQuaternions(hingeQ, mouseQ, r2); canopy.scale.set(1 + (MS.x - 1) * r2, 1 + (MS.y - 1) * r2, 1 + (MS.z - 1) * r2);
    const mb = sub(t, 0.44, 0.58); mouseBits.scale.setScalar(Math.max(0.001, mb > 0 ? E.outBack(mb) : 0));
    /* the wing folds down onto the deck and sinks into it */
    wingP.rotation.z = -1.35 * smooth(sub(t, 0.1, 0.26)); wingP.position.y = WPIV.y - 0.5 * smooth(sub(t, 0.24, 0.36)); wingP.position.x = WPIV.x - 0.2 * smooth(sub(t, 0.24, 0.36));
    /* the body splits and its halves slide apart into the keyboard's rails */
    const sp = sub(t, 0.42, 0.62), spk = sp > 0 ? over(sp) : 0, cl = smooth(sub(t, 0.8, 0.97));
    [1, -1].forEach(s => { const g = halves[s]; g.position.z = s * (0.85 * spk - 0.6 * cl); g.position.y = -0.5 * cl; g.rotation.x = -s * 0.08 * smooth(sp); g.scale.set(1, Math.max(0.001, 1 - 0.75 * cl), Math.max(0.001, 1 - 0.5 * cl)); g.visible = cl < 0.999; });
    /* sealed: the halves fold away into the keyboard's case as it closes round the deck; the canopy into the finished mouse */
    const ck = sub(t, 0.8, 0.97), cs = ck > 0 ? E.outBack(ck) : 0; keys.caseP.visible = ck > 0; keys.caseP.scale.set(Math.max(0.001, cs), 1, Math.max(0.001, cs));
    const mk2 = sub(t, 0.82, 0.98); cleanMouse.visible = mk2 > 0; cleanMouse.scale.setScalar(Math.max(0.001, mk2 > 0 ? E.outBack(mk2) : 0)); canopy.visible = mk2 < 0.6;
    /* the wheels turn flat, tuck up into the body and ride out with the halves */
    wheels.forEach((w, i) => { const h = w.userData.home, s = Math.sign(h.z), f = smooth(sub(t, 0.18 + i * 0.025, 0.34 + i * 0.025));
      w.rotation.x = s * (PI / 2) * f; w.position.set(h.x * (1 - 0.06 * f), h.y + (0.34 - h.y) * f + body.position.y * f, h.z + s * (-0.35 * f + 0.85 * spk - 0.6 * cl)); w.scale.setScalar(Math.max(0.001, 1 - cl)); w.visible = cl < 0.999; });
    const lift = smooth(sub(t, 0.56, 0.72)); keys.bed.position.y = 0.5 * lift; keys.set(sub(t, 0.66, 0.96));
    under.material.opacity = 0.55 * R.awake * (1 - smooth(sub(t, 0.05, 0.3)));
  }
  carT(0);
  const CUES_C = [[0.001, 'servo'], [0.06, 'detent'], [0.18, 'servo'], [0.3, 'servo'], [0.42, 'land'], [0.46, 'land'], [0.5, 'servo'], [0.62, 'slam'], [0.7, 'countTick'], [0.8, 'countTick'], [0.9, 'countTick']];
  const CUES_M = [[0.001, 'servo'], [0.1, 'servo'], [0.24, 'slam'], [0.32, 'servo'], [0.46, 'land'], [0.5, 'servo'], [0.6, 'servo'], [0.76, 'slam'], [0.8, 'slam']];
  const cue = (list, t0, t1) => { if (t1 > t0) list.forEach(([c, id]) => { if (t0 < c && t1 >= c) snd(id); }); };
  async function play(fn, list, from, to, dur, ease) { let last = from; await T.tween({ dur, ease: ease || E.linear, tag: 'rig', update: e => { const t = from + (to - from) * e; cue(list, last, t); last = t; fn(t); } }); fn(to); }

  /* ---------- the car drives: a smooth curve from its spot to the middle, arriving side on ---------- */
  const C0 = V(CPARK.x, 0, CPARK.z), C3 = V(KB.x, 0, KB.z), cd0 = V(Math.cos(CPARK.h), 0, -Math.sin(CPARK.h)), CL = C0.distanceTo(C3) * 0.5;
  const C1 = C0.clone().addScaledVector(cd0, CL), C2 = C3.clone().addScaledVector(V(1, 0, 0), -CL);
  const bez = (s, o) => { const a = 1 - s; return o.set(0, 0, 0).addScaledVector(C0, a * a * a).addScaledVector(C1, 3 * a * a * s).addScaledVector(C2, 3 * a * s * s).addScaledVector(C3, s * s * s); };
  const dbez = (s, o) => { const a = 1 - s; return o.set(0, 0, 0).addScaledVector(C1.clone().sub(C0), 3 * a * a).addScaledVector(C2.clone().sub(C1), 6 * a * s).addScaledVector(C3.clone().sub(C2), 3 * s * s); };
  let lastS = 0, lastH = CPARK.h, vel = 0; const tp = V(0, 0, 0), tt = V(0, 0, 0), tl = V(0, 0, 0);
  function setDrive(s, dt) {
    bez(s, tp); dbez(s, tt); const h = Math.atan2(-tt.z, tt.x), dist = bez(lastS, tl).distanceTo(tp) * Math.sign(s - lastS || 1);
    carRoot.position.set(tp.x, 0, tp.z); carRoot.rotation.y = h;
    wheels.forEach(w => { w.userData.spin.rotation.z -= dist / CAR.wr; });
    const dh = Math.atan2(Math.sin(h - lastH), Math.cos(h - lastH)), steer = Math.abs(dist) > 1e-4 ? T.clamp(dh / Math.abs(dist) * CAR.wb * 1.4, -0.5, 0.5) : 0;
    R.steer += (steer - R.steer) * 0.25; wheels.forEach(w => { if (w.userData.front) w.userData.steer.rotation.y = R.steer; });
    const v = dt > 0 ? dist / dt : 0, acc = dt > 0 ? (v - vel) / dt : 0; vel = v;
    carRoot.rotation.z += (T.clamp(acc * 0.004, -0.04, 0.04) - carRoot.rotation.z) * 0.2; carRoot.rotation.x += (T.clamp(R.steer * v * 0.012, -0.05, 0.05) - carRoot.rotation.x) * 0.2;
    lastS = s; lastH = h;
  }
  setDrive(0, 0);
  async function drive(dir) {
    const dur = 2.5; lastS = dir > 0 ? 0 : 1; lastH = carRoot.rotation.y; let prev = 0; snd('ignite');
    const eng = S.snd && S.snd.loop ? S.snd.loop('rumble', { gain: 0.2 }) : null;
    await T.tween({ dur, ease: E.linear, tag: 'rig', update: (e, raw) => { const dt = (raw - prev) * dur; prev = raw; const k = E.inOutCubic(raw); setDrive(dir > 0 ? k : 1 - k, dt); if (eng && eng.set) eng.set(0.12 + 0.45 * bump(raw)); } });
    if (eng) eng.stop(0.4); carRoot.rotation.x = 0; carRoot.rotation.z = 0; wheels.forEach(w => { if (w.userData.front) w.userData.steer.rotation.y = 0; }); R.steer = 0; snd('land');
  }

  /* ---------- the mech walks: turn to the path, stride along it, turn to face the front ---------- */
  const yawTo = (a, b) => b + Math.atan2(Math.sin(a - b), Math.cos(a - b));
  async function turn(y0, y1, dur) { await T.tween({ dur, ease: E.inOutSine, tag: 'rig', update: (e, raw) => { mech.root.rotation.y = y0 + (y1 - y0) * e; walkPose(raw * PI * 2, 0.35 * bump(raw)); } }); walkPose(0, 0); }
  async function walk(from, to, endYaw) {
    const d = V(to.x - from.x, 0, to.z - from.z), len = d.length(), yaw = Math.atan2(d.x, d.z), STRIDE = 3.0, dur = Math.max(1.2, len / STRIDE * 0.95);
    await turn(mech.root.rotation.y, yawTo(yaw, mech.root.rotation.y), 0.55);
    let lastStep = 0;
    await T.tween({ dur, ease: E.linear, tag: 'rig', update: (e, raw) => { const k = raw < 0.12 ? raw * raw / 0.24 : raw > 0.88 ? 1 - (1 - raw) * (1 - raw) / 0.24 : raw - 0.06, kk = k / 0.88;
      mech.root.position.set(from.x + d.x * kk, 0, from.z + d.z * kk); const ph = kk * len / STRIDE * PI * 2, amp = Math.min(1, raw * 6, (1 - raw) * 6);
      walkPose(ph, amp); const st = Math.floor(ph / PI); if (st !== lastStep) { lastStep = st; snd('land'); S.bloom.shake = Math.max(S.bloom.shake, 0.002); } } });
    mech.root.position.set(to.x, 0, to.z); walkPose(0, 0);
    await turn(mech.root.rotation.y, yawTo(endYaw, mech.root.rotation.y), 0.6); mech.root.rotation.y = endYaw;
  }

  /* ---------- the camera ---------- */
  const W2 = (x, y, z) => S.under.group.localToWorld(V(x, y, z));
  function look(x, y, z, pitch, dT, yaw) { const w = W2(x, y, z); Object.assign(ctx.cam, { tx: w.x, ty: w.y, tz: w.z, pitch, dT, yaw: yaw || 0 }); }
  /* square on to the screen, low enough that the power button in its bottom bezel is in view */
  function screenView() { const top = MECH.cy + MECH.TH / 2 + 0.05, bot = MECH.cy - MECH.TH / 2 - 0.2, c = W2(MON.x, (top + bot) / 2, MON.z + MECH.TD / 2), cam = ctx.camera, vf = THREE.MathUtils.degToRad(cam.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect), TOT = MECH.TW + 2 * MECH.WW;
    const d = Math.max((TOT * 1.06 / 2) / Math.tan(hf / 2), ((top - bot) * 1.1 / 2) / Math.tan(vf / 2)) + 0.8; return { tx: c.x, ty: c.y, tz: c.z, pitch: 1.5, yaw: 0, dT: d }; }

  /* ---------- the exchange on the screen ---------- */
  const mk = () => document.getElementById('skMarket'), tw = V(0, 0, 0);
  function screenRect() { const cam = ctx.camera, r = ctx.canvas.getBoundingClientRect(), p = o => { o.getWorldPosition(tw); tw.project(cam); return [r.left + (tw.x + 1) / 2 * r.width, r.top + (1 - tw.y) / 2 * r.height]; };
    const L = p(mech.marks.left), Rr = p(mech.marks.right), Tp = p(mech.marks.top), B = p(mech.marks.bottom); return { l: L[0], r: Rr[0], t: Tp[1], b: B[1] }; }
  function placeOverlay() { const el = mk(); if (!el || !R.inPc) return; const q = screenRect(); el.style.left = q.l + 'px'; el.style.top = q.t + 'px'; el.style.width = Math.max(10, q.r - q.l) + 'px'; el.style.height = Math.max(10, q.b - q.t) + 'px'; }
  function openExchange() { const el = mk(); if (!el || !S.market) return; R.inPc = true; el.classList.add('inpc'); placeOverlay(); S.market.open(); }
  function closeExchange() { const el = mk(); R.closing = true; try { if (S.market) S.market.close(); } finally { R.closing = false; } R.inPc = false; if (el) { el.classList.remove('peek'); setTimeout(() => { if (!R.inPc) { el.classList.remove('inpc'); ['left', 'top', 'width', 'height'].forEach(k => { el.style[k] = ''; }); } }, 450); } }

  /* ---------- the projector (the arm comes out of the mech's head) ---------- */
  const PJ = { on: false, busy: false, obj: null, yaw: 0, pitch: 0, vy: 0, drag: null, z: 0, plane: new THREE.Plane(V(0, 1, 0), 0) };
  const CARD = V(MON.x, MECH.cy - 0.05, MON.z + MECH.TD / 2 + 2.0), blue = new THREE.Color(0x4fb8ff), pole = mech.pole;
  const beamMat = new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 }, uT: { value: 0 }, uC: { value: blue } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA, uT; uniform vec3 uC; varying vec2 vUv; void main(){ float edge = pow(1.0 - abs(fract(vUv.x * 2.0) - 0.5) * 2.0, 0.6); float lines = 0.75 + 0.25 * sin(vUv.y * 140.0 - uT * 14.0); float fall = mix(0.25, 1.0, vUv.y); gl_FragColor = vec4(uC * (0.55 * edge + 0.25) * lines * fall * uA, 1.0); }' });
  let beam = null;
  const scanMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.035), scanMat); scan.visible = false; root.add(scan);
  const scanGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: radial(THREE, '79,184,255'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); scanGlow.visible = false; root.add(scanGlow);
  const ghostMat = new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 }, uCut: { value: 1 }, uT: { value: 0 }, uC: { value: blue } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA, uCut, uT; uniform vec3 uC; varying vec2 vUv; void main(){ if (vUv.y > uCut) discard; vec2 g = abs(fract(vUv * vec2(12.0, 18.0)) - 0.5); float grid = smoothstep(0.46, 0.5, max(g.x, g.y)); float e = 1.0 - smoothstep(0.0, 0.02, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y))); float sl = 0.5 + 0.5 * sin(vUv.y * 300.0 + uT * 8.0); gl_FragColor = vec4(uC * (grid * 0.5 + e * 1.4 + 0.12 * sl) * uA, 1.0); }' });
  const ghost = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ghostMat); ghost.visible = false; root.add(ghost);
  const spill = new THREE.PointLight(0x4fb8ff, 0, 10, 2); root.add(spill);
  [scan, scanGlow, ghost].forEach(m => S.bloom.glow(m)); S.bloom.glow(pole.userData.ring);
  const poleBase = () => { const w = V(0, 0, 0); pole.getWorldPosition(w); return root.worldToLocal(w); };
  let poleLen = 2;
  /* e 0: tucked inside the head; 1: all the way out over the card */
  function setPole(e) { const len = 0.2 + poleLen * e; pole.visible = e > 0.002; pole.userData.sleeve.scale.y = Math.max(0.01, len * 0.55); pole.userData.sleeve.position.z = len * 0.55 / 2; pole.userData.inner.scale.y = Math.max(0.01, len); pole.userData.inner.position.z = len / 2; pole.userData.head.position.set(0, 0, len); }
  function clip(on) { if (!PJ.obj) return; S.renderer.localClippingEnabled = true; PJ.obj.group.traverse(m => { if (!m.isMesh) return; [].concat(m.material).forEach(mt => { mt.clippingPlanes = on ? [PJ.plane] : null; if ('clipping' in mt) mt.clipping = on; mt.needsUpdate = true; }); }); }
  const tmpW = V(0, 0, 0);
  const cutAt = (yLocal, below) => { tmpW.set(0, yLocal, 0); root.localToWorld(tmpW); if (below) PJ.plane.set(V(0, -1, 0), tmpW.y); else PJ.plane.set(V(0, 1, 0), -tmpW.y); };
  async function project(slab) {
    if (PJ.on || PJ.busy || !slab) return; PJ.on = true; PJ.busy = true; const el = mk(); if (el) el.classList.add('peek');
    snd('servo'); S.bloom.want = 1.1;
    await T.tween({ dur: 0.45, ease: E.inOutSine, tag: 'pj', update: e => { SM_.uDim.value = 1 - 0.82 * e; } });
    const s = JSON.parse(JSON.stringify(slab)); let obj = null; try { obj = S.objFor(s); } catch (e) { console.error(e); }
    PJ.obj = obj; if (obj && obj.ready) obj.ready.catch(() => {});
    const pb = poleBase(); poleLen = Math.max(0.5, CARD.z - pb.z);
    await T.tween({ dur: 0.55, ease: E.outBack, tag: 'pj', update: e => setPole(e) }); snd('land');
    pole.userData.ring.material.color.set(0xbfe6ff); snd('charge');
    if (obj && obj.ready) { try { await Promise.race([obj.ready, T.wait(2.5)]); } catch (e) {} }
    const w = (obj && obj.w) || 3.0, h = (obj && obj.h) || 4.4, K = Math.min(2.6 / h, 3.6 / w), cw = w * K, ch = h * K, y0 = CARD.y + ch / 2, y1 = CARD.y - ch / 2;
    if (obj) { root.add(obj.group); obj.group.position.copy(CARD); obj.group.scale.setScalar(K); obj.group.quaternion.identity(); clip(true); cutAt(y0 + 0.05); obj.group.visible = true; }
    PJ.yaw = 0; PJ.pitch = 0; PJ.z = 0; PJ.ch = ch;
    /* the beam shoots down from the lens, the ghost of the card flickers up inside it, then the scan builds it from the top */
    const top = pb.y - 0.1, bh = top - (y1 - 0.2); if (beam) { root.remove(beam); beam.geometry.dispose(); }
    beam = new THREE.Mesh(new THREE.ConeGeometry(Math.max(cw, ch * 0.5) * 0.62, bh, 48, 1, true), beamMat); beam.geometry.translate(0, -bh / 2, 0); beam.position.set(CARD.x, top, CARD.z); S.bloom.glow(beam); root.add(beam);
    ghost.visible = true; ghost.position.copy(CARD).add(V(0, 0, 0.02)); ghost.scale.set(cw * 1.02, ch * 1.02, 1);
    snd('zap'); spill.position.copy(CARD).add(V(0, 1.2, 0.6));
    await T.tween({ dur: 0.28, ease: E.outCubic, tag: 'pj', update: e => { beam.scale.set(1, Math.max(0.01, e), 1); beamMat.uniforms.uA.value = 0.9 * e; spill.intensity = 30 * e; } });
    await T.tween({ dur: 0.35, ease: E.linear, tag: 'pj', update: e => { ghostMat.uniforms.uA.value = (e < 0.5 ? (Math.random() > 0.4 ? 1 : 0.2) : 1) * 0.9; ghostMat.uniforms.uCut.value = 1; } });
    scan.visible = true; scanGlow.visible = true; scan.scale.set(cw * 1.35, 1, 1); scanGlow.scale.set(cw * 1.5, 1, 1); snd('shimmer');
    await T.tween({ dur: 1.25, ease: E.inOutSine, tag: 'pj', update: e => { const y = y0 - (y0 - y1) * e; cutAt(y); scan.position.set(CARD.x, y, CARD.z + 0.12); scanGlow.position.set(CARD.x, y, CARD.z + 0.1); scanMat.opacity = 1; scanGlow.material.opacity = 0.9; ghostMat.uniforms.uCut.value = 1 - e; } });
    cutAt(y1 - 1); clip(false);
    await T.tween({ dur: 0.38, ease: E.inOutSine, tag: 'pj', update: e => { const y = y1 + (y0 - y1) * e; scan.position.y = y; scanGlow.position.y = y; scanMat.opacity = 1 - e * 0.6; } });
    snd('chime', { tier: slab.tier });
    /* rendered: the beam goes clear, nothing left to project */
    await T.tween({ dur: 0.6, ease: E.inOutSine, tag: 'pj', update: e => { beamMat.uniforms.uA.value = 0.9 * (1 - e) + 0.06 * e; scanMat.opacity = 0.4 * (1 - e); scanGlow.material.opacity = 0.9 * (1 - e); ghostMat.uniforms.uA.value = 0.9 * (1 - e); spill.intensity = 30 * (1 - e) + 4 * e; } });
    scan.visible = false; scanGlow.visible = false; ghost.visible = false; S.bloom.want = 0.35;
    PJ.busy = false; S.toast('Drag to turn it, scroll to bring it closer. Click away or press Esc to send it back.');
  }
  function dropCard() { if (PJ.obj) { clip(false); try { root.remove(PJ.obj.group); S.slabs.drop(PJ.obj); } catch (e) {} PJ.obj = null; } }
  async function unproject() {
    if (!PJ.on || PJ.busy) return; PJ.busy = true; const obj = PJ.obj, ch = PJ.ch || 2.6; snd('servo'); S.bloom.want = 1.0;
    if (obj) await T.tween({ dur: 0.35, ease: E.inOutCubic, tag: 'pj', update: () => { PJ.yaw *= 0.8; PJ.pitch *= 0.8; PJ.z *= 0.8; obj.group.quaternion.setFromEuler(new THREE.Euler(PJ.pitch, PJ.yaw, 0)); obj.group.position.set(CARD.x, CARD.y, CARD.z + PJ.z); } });
    const y0 = CARD.y + ch / 2, y1 = CARD.y - ch / 2;
    beamMat.uniforms.uA.value = 0.9; scan.visible = true; scanGlow.visible = true; snd('shimmer'); if (obj) clip(true);
    /* the scan runs back up and takes the card with it */
    await T.tween({ dur: 0.75, ease: E.inOutSine, tag: 'pj', update: e => { const y = y1 + (y0 - y1) * e; scan.position.set(CARD.x, y, CARD.z + 0.12); scanGlow.position.set(CARD.x, y, CARD.z + 0.1); scanMat.opacity = 1; scanGlow.material.opacity = 0.9; cutAt(y, true); } });
    scan.visible = false; scanGlow.visible = false; dropCard();
    if (beam) await T.tween({ dur: 0.25, ease: E.inCubic, tag: 'pj', update: e => { beam.scale.set(1, Math.max(0.01, 1 - e), 1); beamMat.uniforms.uA.value = 0.9 * (1 - e); spill.intensity = 30 * (1 - e); } });
    if (beam) beam.visible = false; pole.userData.ring.material.color.set(0x4fb8ff);
    await T.tween({ dur: 0.45, ease: E.inBack, tag: 'pj', update: e => setPole(1 - e) }); snd('land');
    await T.tween({ dur: 0.35, ease: E.inOutSine, tag: 'pj', update: e => { SM_.uDim.value = 0.18 + 0.82 * e; } });
    S.bloom.want = 0; const el = mk(); if (el) el.classList.remove('peek'); PJ.on = false; PJ.busy = false;
  }
  function projPointer(kind, e) {
    if (PJ.busy) return true;
    if (kind === 'down' && e.button === 0) { PJ.drag = { x: e.clientX, y: e.clientY, moved: 0 }; ctx.canvas.style.cursor = 'grabbing'; return true; }
    if (kind === 'move' && PJ.drag) { const dx = e.clientX - PJ.drag.x, dy = e.clientY - PJ.drag.y; PJ.drag.x = e.clientX; PJ.drag.y = e.clientY; PJ.drag.moved += Math.abs(dx) + Math.abs(dy); PJ.vy = dx * 0.012; PJ.yaw += PJ.vy; PJ.pitch = T.clamp(PJ.pitch + dy * 0.008, -0.9, 0.9); return true; }
    if (kind === 'up' && PJ.drag) { const d = PJ.drag; PJ.drag = null; ctx.canvas.style.cursor = 'grab'; if (d.moved < 5) unproject(); return true; }
    if (kind === 'wheel') { PJ.z = T.clamp(PJ.z - e.deltaY * 0.004, -0.5, 3.2); return true; }
    if (kind === 'move') ctx.canvas.style.cursor = 'grab';
    return true;
  }
  function projFrame(dt) { if (!PJ.on || PJ.busy || !PJ.obj) return; if (!PJ.drag) { PJ.yaw += PJ.vy; PJ.vy *= Math.exp(-dt * 3); PJ.pitch += (0 - PJ.pitch) * (1 - Math.exp(-dt * 1.2)); }
    PJ.obj.group.quaternion.setFromEuler(new THREE.Euler(PJ.pitch, PJ.yaw, 0)); PJ.obj.group.position.set(CARD.x, CARD.y + Math.sin(T.time() * 1.4) * 0.04, CARD.z + PJ.z); beamMat.uniforms.uT.value = T.time(); }

  /* ---------- the states ---------- */
  let pushed = false, scale0 = 1;
  const hurry = kind => { if (kind === 'down' && !R.fast) { R.fast = true; scale0 = T.timeScale(); T.setTimeScale(scale0 * 3.5); } return true; };   /* a click hurries them up */
  const fastOff = () => { if (R.fast) { R.fast = false; T.setTimeScale(scale0); } };
  async function assemble(run) {
    look(0, 1.2, -3.5, 36, 36, 0);
    await T.tween({ dur: 0.5, ease: E.outCubic, tag: 'rig', update: e => { R.awake = e; R.mAwake = e; carT(0); } });
    /* both set off; the car gets there first and starts on itself while the mech is still walking */
    const carGo = (async () => { await drive(1); if (!run.alive()) return; look(KB.x, 0.9, KB.z + 0.3, 30, 15, 0.35); await play(carT, CUES_C, 0, 1, 3.8); })();
    const mechGo = (async () => { await T.wait(0.35); await walk({ x: MPARK.x, z: MPARK.z }, MON, 0); if (!run.alive()) return; await carGo; if (!run.alive()) return;
      look(MON.x, 2.4, MON.z + 2.2, 18, 22, 0.28); await play(mechT, CUES_M, 0, 1, 4.6); })();
    await mechGo; if (!run.alive()) return;
    /* they connect: the cable snakes over, plugs in, a pulse runs down it and the screen boots */
    look(0.8, 0.6, (MON.z + KB.z) / 2 + 0.6, 32, 11, 0.25); snd('servo'); await T.tween({ dur: 1.2, ease: E.linear, tag: 'rig', update: e => connectT(e) }); snd('zap'); connectT(1);
    look(MON.x, 2.4, MON.z + 2.4, 14, 22, 0.06); snd('glow');
    await T.tween({ dur: 0.9, ease: E.outCubic, tag: 'rig', update: e => { SM_.uBoot.value = e; SM_.uLine.value = bump(e) * 1.6; } });
    snd('chime', { tier: 'legendary' });
  }
  async function disassemble(run) {
    look(MON.x, 2.4, MON.z + 2.4, 18, 22, 0.2);
    await T.tween({ dur: 0.5, ease: E.inCubic, tag: 'rig', update: e => { SM_.uBoot.value = 1 - e; } });
    await T.tween({ dur: 0.7, ease: E.linear, tag: 'rig', update: e => connectT(1 - e) }); connectT(0);
    await Promise.all([play(mechT, CUES_M, 1, 0, 3.4, E.inOutSine), play(carT, CUES_C, 1, 0, 3.0, E.inOutSine)]); if (!run.alive()) return;
    look(0, 1.2, -3.5, 36, 36, 0);
    await Promise.all([drive(-1), walk(MON, { x: MPARK.x, z: MPARK.z }, MPARK.yaw)]);
    await T.tween({ dur: 0.5, tag: 'rig', update: e => { R.awake = 1 - e; R.mAwake = 1 - e; carT(0); } });
  }
  M.define('pc.go', { busy: true, on: { CLOSE: () => undefined }, pointer: hurry,
    async enter(d, run) { R.busy = true; if (!pushed) { S.cam.push(); pushed = true; } ctx.hideActs();
      try { await assemble(run); } finally { fastOff(); } if (!run.alive()) return;
      S.cam.set(screenView()); snd('rise', { dur: 1.2 }); await T.wait(1.3); if (!run.alive()) return;
      R.busy = false; M.go('pc.view'); } });
  M.define('pc.view', {
    enter() { openExchange(); },
    exit() { S.bloom.want = 0; if (PJ.on) { T.cancelAll('pj'); dropCard(); if (beam) beam.visible = false; scan.visible = false; scanGlow.visible = false; ghost.visible = false; setPole(0); SM_.uDim.value = 1; PJ.on = false; PJ.busy = false; } },
    on: { CLOSE: () => { if (PJ.on) { unproject(); return undefined; } return 'pc.back'; } },
    pointer(kind, e) { if (PJ.on) return projPointer(kind, e);
      /* the power button in the screen's bottom bezel turns it all back into the toys */
      const h = S.hitAny(e, [mech.power]); if (kind === 'move') { R.powerHot = !!h; ctx.canvas.style.cursor = h ? 'pointer' : 'default'; } if (kind === 'down' && e.button === 0 && h) { snd('detent'); M.send('CLOSE'); } return true; },
    key(e) { if (e.key === 'Escape' && PJ.on) { unproject(); return true; } return true; },
    frame(dt) { placeOverlay(); projFrame(dt); mech.power.userData.ring.color.setHSL(0.56, 0.9, R.powerHot ? 0.75 : 0.45 + 0.12 * Math.sin(T.time() * 2.4)); } });
  M.define('pc.back', { busy: true, on: { CLOSE: () => undefined }, pointer: hurry,
    async enter(d, run) { R.busy = true; closeExchange();
      try { await disassemble(run); } finally { fastOff(); }
      if (pushed) { S.cam.pop(); pushed = false; } ctx.cam.yaw = 0; R.busy = false; if (run.alive()) M.go('under'); } });

  /* ---------- in the dark idle: point at either and it stirs; click and they go ---------- */
  const hitAny = e => S.hitAny(e, [carRoot, mech.root]);
  let breathe = 0;
  S.rig = { root,
    wants: () => !!(S.under && S.under.on && M.is('under') && !M.busy()),
    go() { if (S.rig.wants()) M.go('pc.go'); },
    inPc: () => R.inPc, projecting: () => PJ.on, project,
    onClose() { if (R.closing) return; if (M.is('pc.view')) M.send('CLOSE'); },
    pointer(kind, e) { if (R.busy || !S.under.on) return false;
      if (kind === 'move') { const h = hitAny(e); R.hover = h ? h.root : null; if (h) { ctx.canvas.style.cursor = 'pointer'; return true; } return false; }
      if (kind === 'down' && e.button === 0 && hitAny(e)) { snd('detent'); M.go('pc.go'); return true; }
      return false; },
    frame(dt) {
      R.rgbT += dt; mouseBits.userData.ring.material.color.setHSL((R.rgbT * 0.08) % 1, 0.85, 0.6); cleanMouse.userData.ring.color.setHSL((R.rgbT * 0.08) % 1, 0.85, 0.6); keys.lip.material.color.setHSL((R.rgbT * 0.08 + 0.3) % 1, 0.85, 0.6); keys.glow.material.color.setHSL((R.rgbT * 0.08 + 0.5) % 1, 0.8, 0.5);
      if (!R.busy && R.tc === 0) { const want = R.hover === carRoot ? 0.7 : 0; R.awake += (want - R.awake) * (1 - Math.exp(-dt * 6)); under.material.opacity = 0.55 * R.awake;
        const mw = R.hover === mech.root ? 1 : 0; R.mAwake += (mw - R.mAwake) * (1 - Math.exp(-dt * 6));
        /* the mech idles: a slow breath in the knees and a glance of the head */
        breathe += dt; const b = 0.04 + 0.03 * Math.sin(breathe * 1.3); legs(b, b * 2, b, b * 2, 0); mech.head.rotation.y = 0.25 * Math.sin(breathe * 0.37) * (1 - R.mAwake); }
      const k = 0.35 + 0.65 * Math.max(R.awake, R.tc > 0 ? 1 : 0); car.ledW.color.setScalar(k); car.ledR.color.setRGB(k, 0.16 * k, 0.22 * k);
      if (!R.busy && !R.inPc) mech.visor.color.setHSL(0.55, 0.9, 0.35 + 0.35 * Math.max(R.mAwake, 0.25 + 0.15 * Math.sin(breathe * 2)));
    } };
  /* test hooks: hold the car's or the mech's transform at t on their spots */
  S.rig.__car = t => { lastS = 1; setDrive(1, 0); carRoot.rotation.set(0, 0, 0); R.awake = 1; carT(t); };
  S.rig.__mech = t => { mech.root.position.set(MON.x, 0, MON.z); mech.root.rotation.set(0, 0, 0); mechT(t); };
  S.rig.__link = t => { connectT(t); SM_.uBoot.value = t; };
  S.rig.__home = () => { lastS = 0; setDrive(0, 0); R.awake = 0; carT(0); mech.root.position.set(MPARK.x, 0, MPARK.z); mech.root.rotation.set(0, MPARK.yaw, 0); mechT(0); connectT(0); SM_.uBoot.value = 0; };
  S.dev.action('Bring the computer over', () => S.rig.go(), 'Try');
}
