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
// the top of the monitor towards you and the card is built in front of the screen out of fine points of light; then
// it is yours to turn. Close the exchange and the camera comes back out with the computer still standing (click it
// to go back in); its power button turns it back into the toys, who go home to their plinths along the back edge.
// Shapes in rigmodel.js. A click while they are transforming speeds it up.
//   S.rig = { root, wants(), go(), inPc(), projecting(), project(slab), onClose(), pointer(kind, e), frame(dt) }
//   states: 'pc.go' (busy), 'pc.view', 'pc.out' (busy, back to the table), 'pc.back' (busy, back to toys)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildCar, buildKeys, buildMech, dressMech, CAR, MECH } from './rigmodel.js';
import MECH_GLB from './mech.glb';

export function install(S) {
  if (!S.under) return;
  const { T, M, ctx } = S, E = T.E, ENV = S.SM.envMap(S.renderer), PI = Math.PI;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const CPARK = { x: -7.6, z: -9.0, h: 0 };         /* the car on its plinth along the back edge, nose towards the middle, out of everyone's way (Sam) */
  const KB = { x: 0, z: -4.6 };                      /* where it stops side on and becomes the keyboard: the top of the table, clear of the pit (Sam) */
  const MPARK = { x: 7.8, z: -10.0, yaw: 0 };       /* the mech on its plinth along the back edge, facing you */
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
    [mech.skin.neck, mech.skin.foot].forEach(o => sc(o, g2));
    /* the one curved screen rolls out from the middle over the three panels */
    const dp = sub(t, 0.84, 0.99), de = dp > 0 ? E.outCubic(dp) : 0; mech.skin.display.visible = de > 0; mech.skin.display.scale.set(Math.max(0.001, de), 1, 1); const panelsOn = de < 0.98;   /* once the one screen is out, nothing of the robot is left behind it */
    mech.torso.children.forEach(c => { if (c !== mech.skin.display && c !== mech.pole && !mech.occluders.includes(c)) c.visible = panelsOn; });
    mech.torso.rotation.set(0, 0, 0); }
  /* the walk: phase ph (2 PI is two steps), amp 0 standing .. 1 striding */
  function walkPose(ph, amp) { const f = p => [0.42 * amp * Math.sin(p), amp * (0.12 + 0.75 * Math.max(0, Math.cos(p)))];
    const [aL, bL] = f(ph + PI), [aR, bR] = f(ph); legs(aL, bL, aR, bR, 0);
    MA.forEach(m => { m.arm.rotation.x = 0.32 * amp * Math.sin(m.s < 0 ? ph : ph + PI); m.elbow.rotation.x = -0.25 * amp; });
    mech.torso.rotation.y = 0.05 * amp * Math.sin(ph); mech.torso.rotation.z = 0.025 * amp * Math.sin(ph); }
  mech.root.position.set(MPARK.x, 0.1, MPARK.z); mech.root.rotation.y = MPARK.yaw; mechT(0);
  /* the Blender model goes on as soon as it is parsed (a moment after the table opens); until then the stand-in boxes */
  try { new GLTFLoader().parse(MECH_GLB.buffer.slice(MECH_GLB.byteOffset, MECH_GLB.byteOffset + MECH_GLB.byteLength), '', g => { try { dressMech(THREE, ENV, mech, g); mechT(R.tm); warm(); } catch (e) { console.error('mech', e); } }, e => console.error('mech', e)); } catch (e) { console.error('mech', e); }
  /* every material compiled up front, hidden parts too, so the first transform and the first hologram never stutter */
  function warm() { const vis = []; root.traverse(o => { vis.push([o, o.visible]); o.visible = true; }); try { S.renderer.compile(root, ctx.camera, ctx.scene); } catch (e) {} vis.forEach(([o, v]) => { o.visible = v; }); }
  /* the plinths the two wait on along the back of the table */
  const plM = new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.8, roughness: 0.35, envMap: ENV });
  const plinths = [[CPARK.x, CPARK.z, 3.0], [MPARK.x, MPARK.z, 1.7]].map(([x, z, r]) => { const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.1, 0.1, 72), plM); d.position.y = 0.05; g.add(d);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.02, 6, 120), new THREE.MeshBasicMaterial({ color: 0x4fb8ff, transparent: true, opacity: 0.5 })); ring.rotation.x = PI / 2; ring.position.y = 0.1; g.add(ring); return ring; });
  const PLINTH = 0.1;
  function plinthGlow() { plinths.forEach((r, i) => { r.material.opacity = 0.3 + 0.2 * Math.sin(T.time() * 1.5 + i * 2); }); }
  mech.occluders.forEach(o => o.layers.set(S.bloom.FX));   /* the monitor hides the glow of whatever is behind it, without glowing */

  /* ---------- the screen, the cable ---------- */
  const splash = (() => { const c = document.createElement('canvas'); c.width = 2048; c.height = 890; const g = c.getContext('2d');
    g.fillStyle = '#0e0f11'; g.fillRect(0, 0, 2048, 890); g.fillStyle = '#f2efe9'; g.beginPath(); g.moveTo(0, 0); g.lineTo(1180, 0); g.lineTo(900, 890); g.lineTo(0, 890); g.closePath(); g.fill();
    g.save(); g.clip(); g.strokeStyle = 'rgba(14,14,14,0.06)'; g.lineWidth = 2; for (let x = 0; x < 1200; x += 56) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 890); g.stroke(); } for (let y = 0; y < 890; y += 56) { g.beginPath(); g.moveTo(0, y); g.lineTo(1200, y); g.stroke(); } g.restore();
    g.fillStyle = '#0e0e0e'; g.font = '900 150px "Archivo", "Geist", "Helvetica Neue", Arial, sans-serif'; g.fillText('STUDIUM', 120, 470); g.font = 'italic 400 96px "Instrument Serif", Georgia, serif'; g.fillText('House', 140, 580);
    g.fillStyle = '#ff4655'; g.fillRect(1300, 360, 56, 6); g.fillStyle = '#f4f1ea'; g.font = '500 30px "Geist Mono", "JetBrains Mono", monospace'; g.fillText('THE EXCHANGE', 1300, 420); g.fillStyle = 'rgba(244,241,234,0.25)'; g.fillRect(1300, 460, 560, 6); g.fillStyle = '#f4f1ea'; g.fillRect(1300, 460, 380, 6);
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
    carRoot.position.set(tp.x, PLINTH * (1 - sub(s, 0.02, 0.12)), tp.z); carRoot.rotation.y = h;
    wheels.forEach(w => { w.userData.spin.rotation.z -= dist / CAR.wr; });
    const dh = Math.atan2(Math.sin(h - lastH), Math.cos(h - lastH)), steer = Math.abs(dist) > 1e-4 ? T.clamp(dh / Math.abs(dist) * CAR.wb * 1.4, -0.5, 0.5) : 0;
    R.steer += (steer - R.steer) * 0.25; wheels.forEach(w => { if (w.userData.front) w.userData.steer.rotation.y = R.steer; });
    const v = dt > 0 ? dist / dt : 0, acc = dt > 0 ? (v - vel) / dt : 0; vel = v;
    carRoot.rotation.z += (T.clamp(acc * 0.004, -0.04, 0.04) - carRoot.rotation.z) * 0.2; carRoot.rotation.x += (T.clamp(R.steer * v * 0.012, -0.05, 0.05) - carRoot.rotation.x) * 0.2;
    lastS = s; lastH = h;
  }
  setDrive(0, 0);
  async function drive(dir) {
    const dur = 1.9; lastS = dir > 0 ? 0 : 1; lastH = carRoot.rotation.y; let prev = 0; snd('ignite');
    const eng = S.snd && S.snd.loop ? S.snd.loop('rumble', { gain: 0.2 }) : null;
    await T.tween({ dur, ease: E.linear, tag: 'rig', update: (e, raw) => { const dt = (raw - prev) * dur; prev = raw; const k = E.inOutCubic(raw); setDrive(dir > 0 ? k : 1 - k, dt); if (eng && eng.set) eng.set(0.12 + 0.45 * bump(raw)); } });
    if (eng) eng.stop(0.4); carRoot.rotation.x = 0; carRoot.rotation.z = 0; wheels.forEach(w => { if (w.userData.front) w.userData.steer.rotation.y = 0; }); R.steer = 0; snd('land');
  }

  /* ---------- the mech walks: turn to the path, stride along it, turn to face the front ---------- */
  const yawTo = (a, b) => b + Math.atan2(Math.sin(a - b), Math.cos(a - b));
  async function turn(y0, y1, dur) { await T.tween({ dur, ease: E.inOutSine, tag: 'rig', update: (e, raw) => { mech.root.rotation.y = y0 + (y1 - y0) * e; walkPose(raw * PI * 2, 0.35 * bump(raw)); } }); walkPose(0, 0); }
  async function walk(from, to, endYaw) {
    const d = V(to.x - from.x, 0, to.z - from.z), len = d.length(), yaw = Math.atan2(d.x, d.z), STRIDE = 3.2, dur = Math.max(1.0, len / STRIDE * 0.62);
    await turn(mech.root.rotation.y, yawTo(yaw, mech.root.rotation.y), 0.4);
    let lastStep = 0;
    await T.tween({ dur, ease: E.linear, tag: 'rig', update: (e, raw) => { const k = raw < 0.12 ? raw * raw / 0.24 : raw > 0.88 ? 1 - (1 - raw) * (1 - raw) / 0.24 : raw - 0.06, kk = k / 0.88;
      mech.root.position.set(from.x + d.x * kk, PLINTH * (from === MON ? sub(kk, 0.88, 1) : 1 - sub(kk, 0, 0.12)), from.z + d.z * kk); const ph = kk * len / STRIDE * PI * 2, amp = Math.min(1, raw * 6, (1 - raw) * 6);
      walkPose(ph, amp); const st = Math.floor(ph / PI); if (st !== lastStep) { lastStep = st; snd('land'); } } });
    mech.root.position.set(to.x, to === MON ? 0 : PLINTH, to.z); walkPose(0, 0);
    await turn(mech.root.rotation.y, yawTo(endYaw, mech.root.rotation.y), 0.45); mech.root.rotation.y = endYaw;
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
  /* inside the screen with a margin (Sam: nothing cut off at the edges); the screen round it is black, so the page reads as the display */
  function placeOverlay() { const el = mk(); if (!el || !R.inPc) return; const q = screenRect(), mx = (q.r - q.l) * 0.012, my = (q.b - q.t) * 0.02; el.style.left = (q.l + mx) + 'px'; el.style.top = (q.t + my) + 'px'; el.style.width = Math.max(10, q.r - q.l - 2 * mx) + 'px'; el.style.height = Math.max(10, q.b - q.t - 2 * my) + 'px'; }
  function openExchange() { const el = mk(); if (!el || !S.market) return; R.inPc = true; SM_.uDim.value = 0; el.classList.add('inpc'); placeOverlay(); S.market.open(); }
  function closeExchange() { const el = mk(); SM_.uDim.value = 1; R.closing = true; try { if (S.market) S.market.close(); } finally { R.closing = false; } R.inPc = false; if (el) { el.classList.remove('peek'); setTimeout(() => { if (!R.inPc) { el.classList.remove('inpc'); ['left', 'top', 'width', 'height'].forEach(k => { el.style[k] = ''; }); } }, 450); } }

  /* ---------- the projector: the arm slides out of the top of the monitor, and the card is built out of fine light ----------
     Sam: not big blocky lights, very fine particles like a high end CG hologram. Some 30,000 points stream down out of
     the lens and settle into the shape of the card, each taking the colour of the photo where it lands; the real card
     comes up out of them from the top as they arrive, and they fade. Putting it back runs the same thing in reverse.
     No bloom (it is the slow part): the points are additive and bright enough on their own. */
  const PJ = { on: false, busy: false, obj: null, yaw: 0, pitch: 0, vy: 0, drag: null, z: 0, plane: new THREE.Plane(V(0, 1, 0), 0), gen: 0 };
  const CARD = V(MON.x, MECH.cy - 0.05, MON.z + MECH.TD / 2 + 2.0), pole = mech.pole, NP = 30000;
  const pGeo = new THREE.BufferGeometry(); { const t = new Float32Array(NP * 2), r = new Float32Array(NP * 3), d = new Float32Array(NP), pos = new Float32Array(NP * 3);
    for (let i = 0; i < NP; i++) { const x = Math.random(), y = Math.random(); t[i * 2] = x - 0.5; t[i * 2 + 1] = y - 0.5; r[i * 3] = Math.random(); r[i * 3 + 1] = Math.random(); r[i * 3 + 2] = Math.random(); d[i] = (1 - y) * 0.75 + Math.random() * 0.25; }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pGeo.setAttribute('aT', new THREE.BufferAttribute(t, 2)); pGeo.setAttribute('aR', new THREE.BufferAttribute(r, 3)); pGeo.setAttribute('aD', new THREE.BufferAttribute(d, 1)); }
  const pMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uP: { value: 0 }, uFrom: { value: V(0, 2, 0) }, uW: { value: 2 }, uH: { value: 3 }, uTex: { value: null }, uHas: { value: 0 }, uTime: { value: 0 }, uA: { value: 1 }, uPx: { value: 1 } },
    vertexShader: `attribute vec2 aT; attribute vec3 aR; attribute float aD; uniform float uP, uW, uH, uTime, uPx; uniform vec3 uFrom; varying vec2 vT; varying float vE, vR;
      void main(){ float e = clamp((uP - aD * 0.7) / 0.32, 0.0, 1.0); float k = e * e * (3.0 - 2.0 * e);
        vec3 target = vec3(aT.x * uW, aT.y * uH, (aR.z - 0.5) * 0.015);
        vec3 start = uFrom + vec3((aR.x - 0.5) * 0.05, 0.0, (aR.y - 0.5) * 0.05);
        /* the fall: out of the lens in a thin stream that fans out to its spot, a little swirl on the way */
        vec3 mid = mix(start, target, 0.55) + vec3(sin(aR.x * 40.0 + uTime * 3.0) * 0.18, 0.25, cos(aR.y * 40.0 + uTime * 2.4) * 0.18);
        vec3 p = mix(mix(start, mid, k), mix(mid, target, k), k);
        p += vec3(sin(uTime * 6.0 + aR.z * 60.0), cos(uTime * 5.0 + aR.x * 60.0), 0.0) * 0.004 * k;
        vT = aT + 0.5; vE = e; vR = aR.x;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (0.55 + aR.y * 0.9) * (1.0 + (1.0 - k) * 0.8) * 13.0 / -mv.z; }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uHas, uA, uP; varying vec2 vT; varying float vE, vR;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (d > 0.25) discard; float soft = exp(-d * 14.0);
        vec3 photo = uHas > 0.5 ? texture2D(uTex, vT).rgb : vec3(0.85, 0.92, 1.0); vec3 cyan = vec3(0.45, 0.85, 1.0);
        /* blue while it falls, the photo's colour as it lands, a flash on arrival, then it fades into the real card */
        vec3 col = mix(cyan, photo * 1.4 + cyan * 0.15, smoothstep(0.6, 1.0, vE)) + vec3(0.6, 0.9, 1.0) * exp(-pow((vE - 0.97) * 22.0, 2.0)) * 0.8;
        float a = soft * uA * (vE > 0.0 ? 1.0 : 0.0) * (0.35 + 0.65 * vR) * (1.0 - smoothstep(1.0, 1.0, vE) * 0.0);
        gl_FragColor = vec4(col * a, 1.0); }` });
  const pts = new THREE.Points(pGeo, pMat); pts.frustumCulled = false; pts.visible = false; root.add(pts);
  const spill = { intensity: 0, position: new THREE.Vector3() };   /* no light: a light added to the scene costs every material (the points are bright enough) */
  const poleBase = () => { const w = V(0, 0, 0); pole.getWorldPosition(w); return root.worldToLocal(w); };
  let poleLen = 2;
  /* e 0: tucked inside the monitor; 1: all the way out over the card */
  function setPole(e) { const len = 0.2 + poleLen * e; pole.visible = e > 0.002; pole.userData.sleeve.scale.y = Math.max(0.01, len * 0.55); pole.userData.sleeve.position.z = len * 0.55 / 2; pole.userData.inner.scale.y = Math.max(0.01, len); pole.userData.inner.position.z = len / 2; pole.userData.head.position.set(0, 0, len); }
  function clip(on) { if (!PJ.obj) return; S.renderer.localClippingEnabled = true; PJ.obj.group.traverse(m => { if (!m.isMesh) return; [].concat(m.material).forEach(mt => { mt.clippingPlanes = on ? [PJ.plane] : null; if ('clipping' in mt) mt.clipping = on; mt.needsUpdate = true; }); }); }
  const tmpW = V(0, 0, 0);
  const cutAt = yLocal => { tmpW.set(0, yLocal, 0); root.localToWorld(tmpW); PJ.plane.set(V(0, 1, 0), -tmpW.y); };   /* keep what is above y */
  /* the build: p 0 nothing .. 1.02 every point has landed; the real card shows from the top down behind the points */
  function buildAt(p, ch) { pMat.uniforms.uP.value = p; const front = T.clamp((p - 0.18) / 0.82, 0, 1); cutAt(CARD.y + ch / 2 - front * (ch + 0.1)); pMat.uniforms.uA.value = 1 - 0.9 * T.clamp((p - 0.85) / 0.17, 0, 1); }
  async function project(slab) {
    if (PJ.on || PJ.busy || !slab) return; PJ.on = true; PJ.busy = true; const gen = ++PJ.gen, gone = () => PJ.gen !== gen; const el = mk(); if (el) el.classList.add('peek');
    const s = JSON.parse(JSON.stringify(slab)); let obj = null; try { obj = S.objFor(s); } catch (e) { console.error(e); } PJ.obj = obj; if (obj && obj.ready) obj.ready.catch(() => {});
    const pb = poleBase(); poleLen = Math.max(0.5, CARD.z - pb.z); snd('servo');
    /* the screen dims while the arm comes out */
    await T.tween({ dur: 0.38, ease: E.outCubic, tag: 'pj', update: e => { setPole(e); } }); if (gone()) return; snd('land');
    pole.userData.ring.material.color.set(0xbfe6ff);
    if (obj && obj.ready) { try { await Promise.race([obj.ready, T.wait(1.5)]); } catch (e) {} } if (gone()) return;
    const w = (obj && obj.w) || 3.0, h = (obj && obj.h) || 4.4, K = Math.min(2.6 / h, 3.6 / w), cw = w * K, ch = h * K; PJ.ch = ch;
    if (obj) { root.add(obj.group); obj.group.position.copy(CARD); obj.group.scale.setScalar(K); obj.group.quaternion.identity(); clip(true); obj.group.visible = true; }
    /* the points take the photo's colours */
    const base = obj && obj.base; if (base) { if (pMat.uniforms.uTex.value) pMat.uniforms.uTex.value.dispose(); const t = new THREE.CanvasTexture(base); t.colorSpace = THREE.SRGBColorSpace; pMat.uniforms.uTex.value = t; pMat.uniforms.uHas.value = 1; } else pMat.uniforms.uHas.value = 0;
    pts.position.copy(CARD); pts.quaternion.identity(); pMat.uniforms.uW.value = cw; pMat.uniforms.uH.value = ch; pMat.uniforms.uFrom.value.set(0, pb.y - 0.12 - CARD.y, CARD.z - CARD.z); pMat.uniforms.uPx.value = S.renderer.getPixelRatio() * (ctx.canvas.clientHeight / 900);
    pts.visible = true; spill.position.copy(CARD).add(V(0, 1.0, 0.8)); snd('shimmer'); PJ.yaw = 0; PJ.pitch = 0; PJ.z = 0;
    await T.tween({ dur: 1.35, ease: E.inOutSine, tag: 'pj', update: e => { buildAt(e * 1.02, ch); pMat.uniforms.uTime.value = T.time(); spill.intensity = 14 * T.bump(e); } }); if (gone()) return;
    pts.visible = false; clip(false); snd('chime', { tier: slab.tier }); PJ.busy = false;
    S.toast('Drag to turn it, scroll to bring it closer. Click away or press Esc to send it back.');
  }
  function dropCard() { if (PJ.obj) { clip(false); try { root.remove(PJ.obj.group); S.slabs.drop(PJ.obj); } catch (e) {} PJ.obj = null; } }
  async function unproject() {
    if (!PJ.on || PJ.busy) return; PJ.busy = true; const gen = PJ.gen, obj = PJ.obj, ch = PJ.ch || 2.6; snd('servo');
    if (obj) await T.tween({ dur: 0.25, ease: E.inOutCubic, tag: 'pj', update: () => { PJ.yaw *= 0.75; PJ.pitch *= 0.75; PJ.z *= 0.75; obj.group.quaternion.setFromEuler(new THREE.Euler(PJ.pitch, PJ.yaw, 0)); obj.group.position.set(CARD.x, CARD.y, CARD.z + PJ.z); } });
    if (PJ.gen !== gen) return;
    if (obj) { obj.group.quaternion.identity(); obj.group.position.copy(CARD); clip(true); }
    pts.visible = true; snd('shimmer');
    /* the card comes apart into points, bottom first, and they stream back up into the lens */
    await T.tween({ dur: 0.85, ease: E.inOutSine, tag: 'pj', update: e => { buildAt(1.02 * (1 - e), ch); pMat.uniforms.uTime.value = T.time(); } });
    if (PJ.gen !== gen) return; pts.visible = false; dropCard(); pole.userData.ring.material.color.set(0x4fb8ff);
    await T.tween({ dur: 0.3, ease: E.inCubic, tag: 'pj', update: e => { setPole(1 - e); } }); snd('land');
    const el = mk(); if (el) el.classList.remove('peek'); PJ.on = false; PJ.busy = false;
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
    PJ.obj.group.quaternion.setFromEuler(new THREE.Euler(PJ.pitch, PJ.yaw, 0)); PJ.obj.group.position.set(CARD.x, CARD.y + Math.sin(T.time() * 1.4) * 0.04, CARD.z + PJ.z); }
  function projOff() { PJ.gen++; T.cancelAll('pj'); pts.visible = false; spill.intensity = 0; dropCard(); setPole(0); pole.userData.ring.material.color.set(0x4fb8ff); SM_.uDim.value = R.inPc ? 0 : 1; PJ.on = false; PJ.busy = false; const el = mk(); if (el) el.classList.remove('peek'); }

  /* ---------- the states ----------
     'pc.go': the toys come over and become the computer (or, if it is already built, the camera just goes in);
     'pc.view': the exchange on the screen; closing it ('pc.out') pulls the camera back and leaves the computer on the
     table (Sam: you can just move away from it); its power button ('pc.back') turns it back into the toys, who go home. */
  let pushed = false, scale0 = 1;
  const hurry = kind => { if (kind === 'down' && !R.fast && R.moving) { R.fast = true; scale0 = T.timeScale(); T.setTimeScale(scale0 * 3); } return true; };   /* a click hurries them up */
  const fastOff = () => { if (R.fast) { R.fast = false; T.setTimeScale(scale0); } };
  async function assemble(run) { R.moving = true; try { await assembleRun(run); } finally { R.moving = false; } }
  async function assembleRun(run) {
    look(0, 1.2, -6.5, 38, 30, 0);
    await T.tween({ dur: 0.3, ease: E.outCubic, tag: 'rig', update: e => { R.awake = e; R.mAwake = e; carT(0); } });
    /* both set off; the car gets there first and starts on itself while the mech is still walking */
    const carGo = (async () => { await drive(1); if (!run.alive()) return; look(KB.x, 0.9, KB.z + 0.3, 30, 15, 0.3); await play(carT, CUES_C, 0, 1, 2.5); })();
    const mechGo = (async () => { await T.wait(0.2); await walk({ x: MPARK.x, z: MPARK.z }, MON, 0); if (!run.alive()) return; await carGo; if (!run.alive()) return;
      look(MON.x, 2.6, MON.z + 2.2, 16, 22, 0.24); await play(mechT, CUES_M, 0, 1, 3.0); })();
    await mechGo; if (!run.alive()) return;
    /* they connect: the cable snakes over, plugs in, a pulse runs down it and the screen boots */
    look(0.8, 0.6, (MON.z + KB.z) / 2 + 0.6, 30, 11, 0.22); snd('servo'); await T.tween({ dur: 0.7, ease: E.linear, tag: 'rig', update: e => connectT(e) }); snd('zap'); connectT(1);
    snd('glow'); await T.tween({ dur: 0.55, ease: E.outCubic, tag: 'rig', update: e => { SM_.uBoot.value = e; SM_.uLine.value = bump(e) * 1.6; } });
    snd('chime', { tier: 'legendary' }); R.built = true;
  }
  async function disassemble(run) { R.moving = true; try { await disassembleRun(run); } finally { R.moving = false; } }
  async function disassembleRun(run) {
    look(MON.x, 2.4, MON.z + 2.4, 18, 22, 0.2);
    await T.tween({ dur: 0.35, ease: E.inCubic, tag: 'rig', update: e => { SM_.uBoot.value = 1 - e; } });
    await T.tween({ dur: 0.45, ease: E.linear, tag: 'rig', update: e => connectT(1 - e) }); connectT(0); R.built = false;
    await Promise.all([play(mechT, CUES_M, 1, 0, 2.4, E.inOutSine), play(carT, CUES_C, 1, 0, 2.1, E.inOutSine)]); if (!run.alive()) return;
    look(0, 1.2, -6.5, 38, 30, 0);
    await Promise.all([drive(-1), walk(MON, { x: MPARK.x, z: MPARK.z }, MPARK.yaw)]);
    await T.tween({ dur: 0.35, tag: 'rig', update: e => { R.awake = 1 - e; R.mAwake = 1 - e; carT(0); } });
  }
  const bail = () => { fastOff(); R.busy = false; if (pushed) { S.cam.pop(); pushed = false; } };
  M.define('pc.go', { busy: true, on: { CLOSE: () => undefined }, pointer: hurry,
    async enter(d, run) { R.busy = true; if (!pushed) { S.cam.push(); pushed = true; } ctx.hideActs();
      if (!R.built) { try { await assemble(run); } finally { fastOff(); } if (!run.alive()) { bail(); return; } }
      S.cam.set(screenView()); snd('rise', { dur: 0.9 }); await T.wait(0.95); if (!run.alive()) { bail(); return; }
      fastOff(); R.busy = false; M.go('pc.view'); } });
  M.define('pc.view', {
    enter() { openExchange(); },
    exit() { S.bloom.want = 0; if (PJ.on) projOff(); },
    on: { CLOSE: () => { if (PJ.on) { unproject(); return undefined; } return 'pc.out'; }, POWER: () => { if (PJ.on) projOff(); return 'pc.back'; } },
    pointer(kind, e) { if (PJ.on) return projPointer(kind, e);
      /* the power button in the screen's bottom bezel turns it all back into the toys */
      const h = S.hitAny(e, [mech.power]); if (kind === 'move') { R.powerHot = !!h; ctx.canvas.style.cursor = h ? 'pointer' : 'default'; } if (kind === 'down' && e.button === 0 && h) { snd('detent'); M.send('POWER'); } return true; },
    key(e) { if (e.key === 'Escape' && PJ.on) { unproject(); return true; } return true; },
    frame(dt) { placeOverlay(); projFrame(dt); } });
  /* away from it: the camera comes back out and the computer stays where it is */
  M.define('pc.out', { busy: true, on: { CLOSE: () => undefined },
    async enter(d, run) { closeExchange(); if (pushed) { S.cam.pop(); pushed = false; } ctx.cam.yaw = 0; await T.wait(0.6); if (run.alive()) M.go('under'); } });
  M.define('pc.back', { busy: true, on: { CLOSE: () => undefined }, pointer: hurry,
    async enter(d, run) { R.busy = true; closeExchange(); if (!pushed) { S.cam.push(); pushed = true; }
      try { await disassemble(run); } finally { fastOff(); }
      if (pushed) { S.cam.pop(); pushed = false; } ctx.cam.yaw = 0; R.busy = false; if (run.alive()) M.go('under'); } });

  /* ---------- in the dark idle: point at either toy and it stirs, click and they come; once it is a computer, click it to go back in or press its power button ---------- */
  const hitToys = e => S.hitAny(e, [carRoot, mech.root, cleanMouse]);
  let breathe = 0;
  S.rig = { root,
    wants: () => !!(S.under && S.under.on && M.is('under') && !M.busy()),
    go() { if (S.rig.wants()) M.go('pc.go'); },
    built: () => !!R.built,
    inPc: () => R.inPc, projecting: () => PJ.on, project,
    onClose() { if (R.closing) return; if (M.is('pc.view')) M.send('CLOSE'); },
    spots: () => [{ x: KB.x, z: KB.z, r: 3.6 }, { x: MOUSE.x, z: MOUSE.z, r: 2 }, { x: MON.x, z: MON.z, r: 4.5 }, { x: CPARK.x, z: CPARK.z, r: 4.2 }, { x: MPARK.x, z: MPARK.z, r: 3 }],
    pointer(kind, e) { if (R.busy || !S.under.on || (S.dragging && S.dragging())) return false;   /* a slab being dragged keeps the pointer */
      if (R.built) { const p = S.hitAny(e, [mech.power]); if (p) { if (kind === 'move') { R.powerHot = true; ctx.canvas.style.cursor = 'pointer'; } if (kind === 'down' && e.button === 0) { snd('detent'); M.go('pc.back'); } return true; } R.powerHot = false; }
      if (kind === 'move') { const h = hitToys(e); R.hover = h ? h.root : null; if (h) { ctx.canvas.style.cursor = 'pointer'; return true; } return false; }
      if (kind === 'down' && e.button === 0 && hitToys(e)) { snd('detent'); M.go('pc.go'); return true; }
      return false; },
    frame(dt) {
      R.rgbT += dt; mouseBits.userData.ring.material.color.setHSL((R.rgbT * 0.08) % 1, 0.85, 0.6); cleanMouse.userData.ring.color.setHSL((R.rgbT * 0.08) % 1, 0.85, 0.6); keys.lip.material.color.setHSL((R.rgbT * 0.08 + 0.3) % 1, 0.85, 0.6); keys.glow.material.color.setHSL((R.rgbT * 0.08 + 0.5) % 1, 0.8, 0.5);
      mech.power.userData.ring.color.setHSL(0.56, 0.9, R.powerHot ? 0.78 : 0.45 + 0.12 * Math.sin(T.time() * 2.4)); plinthGlow(dt);
      if (!R.busy && R.tc === 0) { const want = R.hover === carRoot ? 0.7 : 0; R.awake += (want - R.awake) * (1 - Math.exp(-dt * 6)); under.material.opacity = 0.55 * R.awake;
        const mw = R.hover === mech.root ? 1 : 0; R.mAwake += (mw - R.mAwake) * (1 - Math.exp(-dt * 6));
        /* the mech idles on its plinth: a slow breath in the knees and a glance of the head */
        breathe += dt; const b = 0.04 + 0.03 * Math.sin(breathe * 1.3); legs(b, b * 2, b, b * 2, 0); mech.head.rotation.y = 0.25 * Math.sin(breathe * 0.37) * (1 - R.mAwake); }
      const k = 0.35 + 0.65 * Math.max(R.awake, R.tc > 0 ? 1 : 0); car.ledW.color.setScalar(k); car.ledR.color.setRGB(k, 0.16 * k, 0.22 * k);
      if (!R.busy && !R.built) mech.visor.color.setHSL(0.55, 0.9, 0.35 + 0.35 * Math.max(R.mAwake, 0.25 + 0.15 * Math.sin(breathe * 2)));
    } };
  /* test hooks: hold the car's or the mech's transform at t on their spots */
  S.rig.__car = t => { lastS = 1; setDrive(1, 0); carRoot.rotation.set(0, 0, 0); R.awake = 1; carT(t); };
  S.rig.__mech = t => { mech.root.position.set(MON.x, 0, MON.z); mech.root.rotation.set(0, 0, 0); mechT(t); };
  S.rig.__link = t => { connectT(t); SM_.uBoot.value = t; };
  S.rig.__home = () => { lastS = 0; setDrive(0, 0); R.awake = 0; carT(0); mech.root.position.set(MPARK.x, PLINTH, MPARK.z); mech.root.rotation.set(0, MPARK.yaw, 0); mechT(0); connectT(0); SM_.uBoot.value = 0; R.built = false; };
  S.rig.__pj = p => { if (!PJ.obj) return; clip(true); pts.visible = true; buildAt(p, PJ.ch || 2.6); pMat.uniforms.uTime.value = T.time(); };
  S.rig.__built = () => { S.rig.__car(1); S.rig.__mech(1); connectT(1); SM_.uBoot.value = 1; R.built = true; };
  S.dev.action('Bring the computer over', () => S.rig.go(), 'Try');
}
