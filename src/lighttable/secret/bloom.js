// BLOOM: the glow that makes the reveal read as light rather than flat sprites (Sam's Hearthstone reference). Only
// the reveal's own effects glow: they sit on layer FX as well as layer 0, a first pass draws just that layer on black
// into a half-float target (effects can be brighter than white) and blurs it with an Unreal bloom, and the frame is
// the table drawn exactly as it always is, with that glow added over it. The table, the prints and the room never bloom.
// S.bloom = { want, shake, FX, glow(obj) }: reveals.js sets want (0 off .. about 2) and shake (a camera jolt that decays);
// glow(obj) puts an object and its children on the glow layer. While want is 0 nothing changes: main.js renders as
// it always has (render() returns false).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const FX = 5;
/* the glow, added over the finished frame: linear light from the half-float target, put into sRGB for the screen */
const ADD_V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const ADD_F = `uniform sampler2D tGlow; uniform float uK; varying vec2 vUv;
  void main(){ vec3 g = texture2D(tGlow, vUv).rgb; if (g.r != g.r || g.g != g.g || g.b != g.b) g = vec3(0.0); g = clamp(g * uK, 0.0, 16.0);
    vec3 s = mix(g * 12.92, 1.055 * pow(g, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, g)); gl_FragColor = vec4(s, 1.0); }`;

export function install(S) {
  const renderer = S.renderer, size = new THREE.Vector2(), off = new THREE.Vector3(), black = new THREE.Color(0);
  let glowC = null, bloom = null, gPass = null, level = 0, w = 0, h = 0;
  const addM = new THREE.ShaderMaterial({ uniforms: { tGlow: { value: null }, uK: { value: 1 } }, vertexShader: ADD_V, fragmentShader: ADD_F, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const addQ = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), addM), addS = new THREE.Scene(), addC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); addQ.frustumCulled = false; addS.add(addQ);
  const fx = S.bloom = { want: 0, shake: 0, FX, level: () => level,
    glow(o) { o.traverse(m => m.layers.enable(FX)); return o; } };
  const target = () => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  function build() {
    renderer.getDrawingBufferSize(size); w = size.x; h = size.y;
    glowC = new EffectComposer(renderer, target()); glowC.setPixelRatio(1); glowC.renderToScreen = false;
    gPass = new RenderPass(null, null, null, black, 1); glowC.addPass(gPass);
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 1, 0.65, 0.0); glowC.addPass(bloom);
    glowC.setSize(w, h);
  }
  /* eased towards want every frame; shake decays */
  fx.frame = dt => { level += (fx.want - level) * (1 - Math.exp(-dt * (fx.want > level ? 12 : 2.5))); if (level < 0.003 && fx.want === 0) level = 0; fx.shake *= Math.exp(-dt * 9); if (fx.shake < 0.0005) fx.shake = 0; };
  fx.render = (scene, camera) => {
    if (level <= 0 && fx.shake <= 0) return false;
    try {
      if (!glowC) build(); renderer.getDrawingBufferSize(size); if (size.x !== w || size.y !== h) { w = size.x; h = size.y; glowC.setSize(w, h); bloom.resolution.set(w, h); }
      if (fx.shake > 0) { off.set(Math.random() - 0.5, Math.random() - 0.5, 0).multiplyScalar(fx.shake).applyQuaternion(camera.quaternion); camera.position.add(off); camera.updateMatrixWorld(); }
      /* the glow layer alone, on black, blurred */
      const mask = camera.layers.mask, bg = scene.background; camera.layers.set(FX); scene.background = null;
      gPass.scene = scene; gPass.camera = camera; bloom.strength = Math.min(1.2, level); bloom.radius = 0.5; bloom.threshold = 0;
      glowC.render(); camera.layers.mask = mask; scene.background = bg;
      /* the scene as it always is, then the glow added over it */
      renderer.setRenderTarget(null); renderer.render(scene, camera);
      addM.uniforms.tGlow.value = glowC.readBuffer.texture; addM.uniforms.uK.value = 0.4; const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(addS, addC); renderer.autoClear = ac;
      if (fx.shake > 0) { camera.position.sub(off); camera.updateMatrixWorld(); }
      return true;
    } catch (e) { console.error('bloom', e); fx.render = () => false; return false; }   /* never take the table down with it */
  };
}
