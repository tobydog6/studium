// A bare page for Blades: the stadium, the blades and the real secret/blades.js code with a stand-in for the light
// table (no table, no flip), so a headless browser can play a match and take pictures. Built by tests/blades-play.mjs.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createMachine } from '../../src/lighttable/secret/sm.js';
import * as T from '../../src/lighttable/secret/tween.js';
import * as P from '../../src/lighttable/secret/particles.js';
import * as SL from '../../src/lighttable/secret/slabs.js';
import * as SM from '../../src/lighttable/secret/slabmesh.js';
import * as holo from '../../src/lighttable/secret/holo.js';
import * as blades from '../../src/lighttable/secret/blades.js';
import { paintPhoto, KINDS } from '../../src/lighttable/photos.js';

const canvas = document.getElementById('c'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0c0b0a);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 400);
scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.2));
const dark = new THREE.Mesh(new THREE.PlaneGeometry(42, 24), new THREE.MeshStandardMaterial({ color: 0x101013, roughness: 0.9 })); dark.rotation.x = -Math.PI / 2; scene.add(dark);
const l2 = new THREE.PointLight(0xff7a3a, 70, 36, 1.6); l2.position.set(11.5, 6, -6); scene.add(l2);
const cam = { tx: 0, ty: 0, tz: 0, d: 30, dT: 30, pitch: 55, cx: 0, cy: 0, cz: 0 };
function fitDist(w, h, pitch) { const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect); return Math.max(h / 2 / Math.tan(vf / 2), w / 2 / Math.tan(hf / 2)) * 1.05; }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const ctx = { scene, camera, renderer, canvas, cam, fitDist, ray, ndc, hideActs() {}, setNDC(e) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); } };
const M = createMachine(), dev = { action() {}, info() {}, opt() { return null; }, define() {} };
const under = { rect: [6, -11.7, 17, -7], group: new THREE.Group(), on: true, frame() {}, async doors(open) { await T.wait(0.3); } };
scene.add(under.group);
const S = { THREE, ctx, M, T, P, SL, SM, store: SL.store, RoundedBoxGeometry, scene, camera, renderer, paintPhoto, KINDS, under, buttons: {}, dev, testFinish: () => null,
  el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; },
  css(text) { const s = document.createElement('style'); s.textContent = text; document.head.appendChild(s); },
  sfx() {}, toast(t) { console.log('toast: ' + t); }, snd: null,
  shadow(w, d) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.004; return m; },
  cam: { st: [], push(t) { S.cam.st.push({ ...cam }); Object.assign(cam, t); }, pop() { const s = S.cam.st.pop(); if (s) Object.assign(cam, { tx: s.tx, ty: s.ty, tz: s.tz, dT: s.dT, pitch: s.pitch }); }, set(t) { Object.assign(cam, t); } },
};
P.initParticles(scene); SL.setPhotoSource(() => []); holo.install(S);
M.define('*', { on: { CLOSE: () => 'under' } }); M.define('under', { on: { BLADES: 'blades.open' } });
blades.install(S); M.go('under');
Object.assign(cam, { tx: 11.5, tz: -8.5, dT: 18 });
function place() { const k = 0.2; cam.d += (cam.dT - cam.d) * k; cam.cx += (cam.tx - cam.cx) * k; cam.cy += (cam.ty - cam.cy) * k; cam.cz += (cam.tz - cam.cz) * k;
  const p = THREE.MathUtils.degToRad(cam.pitch); camera.position.set(cam.cx, cam.cy + Math.sin(p) * cam.d, cam.cz + Math.cos(p) * cam.d); camera.lookAt(cam.cx, cam.cy, cam.cz); }
/* the page is stepped by the test: step(n, dt) runs n frames of dt each, then draws */
window.H = { S, M, step(n, dt) { dt = dt || 1 / 30; for (let i = 0; i < n; i++) { T.tick(dt); P.particleFrame(dt); M.frame(dt); } place(); renderer.render(scene, camera); return M.state; },
  pointer(kind, x, y) { M.pointer(kind, { clientX: x, clientY: y, button: 0, deltaY: 0 }); }, key(k) { M.key({ key: k }); } };
place(); renderer.render(scene, camera);
