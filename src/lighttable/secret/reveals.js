// REVEALS: the pull's big moment, built after Sam's Hearthstone reference ("insanely high fidelity, look how they do
// their legendary effects"), then given a look per finish so it is never the same twice (Sam: "make variations to match
// the effects", the Slab Lab finishes: water, jade, black hole...). The old flip stays in the dev panel to compare.
// Everything is shader-drawn and HDR (brighter than white) under the selective bloom in bloom.js, and the particles are
// thousands of GPU sparks stretched along their motion. The beats, scaled by tier (common small, mythic biggest):
//   waiting  (from the landing) an aura round the card back in the theme's own light; hovering stokes it.
//   charge   (rare and up) the aura flares, the card trembles, light is drawn in; the void and mythic go dark first.
//   turn     a fast turn (either way round, sometimes an extra spin); at edge-on the theme's burst.
//   face     (rare and up) the face lands under the theme's cover (molten gold, water, a vortex, carved stone, static,
//            frost, iridescence) which clears from a point rolled per pull, shedding particles; then the chime.
//   settle   a living glow round the frame that rides with the card into the close view, embers, the mythic stamp.
// THEMES picks the look from the slab's finish (THEME_OF); every pull also rolls its own origin, turn, flare angle and
// a shift of hue. rail.js calls land(r) when the winner comes forward and run(style, c) at the click (c = { r, slot,
// obj, spin, y0, alive }); it resolves with the print face up. frame(dt) runs every table frame (index.js) and keeps
// sparks and glows alive after the rail has gone. Tweens are tagged 'rail', so closing the rail stops the sequence.
// Test hook: S.reveals.themeOf(slab), S.dev 'revealTheme' forces a theme.
import * as THREE from 'three';
import { TIERS } from './slabs.js';

const TI = Object.fromEntries(TIERS.map((t, i) => [t.id, i]));   /* common 0 .. mythic 5 */
const STOP = { stopped: true };
const C = h => new THREE.Color(h);
/* per tier: the default colours (deep, body, hot) and how big each beat is */
const LOOK = [
  { a: C(0x3a4250), b: C(0xa9b4c4), c: C(0xffffff), aura: 0, glow: 0.35, sparks: 70, flash: 0.0, shake: 0, face: 0, charge: 0 },
  { a: C(0x0b2a8a), b: C(0x3f86ff), c: C(0xd8ecff), aura: 0.45, glow: 0.55, sparks: 180, flash: 0.06, shake: 0, face: 0, charge: 0 },
  { a: C(0x2a0c8a), b: C(0x7d5cff), c: C(0xe4dcff), aura: 0.6, glow: 0.75, sparks: 320, flash: 0.1, shake: 0.02, face: 0.5, charge: 0.25 },
  { a: C(0x5a0640), b: C(0xff3fb0), c: C(0xffe0f4), aura: 0.75, glow: 0.95, sparks: 520, flash: 0.16, shake: 0.04, face: 0.6, charge: 0.35 },
  { a: C(0x8a1400), b: C(0xff7a10), c: C(0xfff0b8), aura: 1, glow: 1.25, sparks: 1100, flash: 0.32, shake: 0.09, face: 0.75, charge: 0.45 },
  { a: C(0x7a4400), b: C(0xffc23a), c: C(0xffffff), aura: 1.1, glow: 1.5, sparks: 1600, flash: 0.5, shake: 0.12, face: 0.9, charge: 0.85 },
];
/* the themes: aura mode (0 fire/energy, 1 water, 2 void, 3 storm, 4 aurora, 5 mist), face mode (0 molten, 1 water,
   2 vortex, 3 stone, 4 static, 5 frost, 6 iridescent), the burst, the sound, the palette (null: the tier's), fire (how
   far flames reach) */
const THEMES = {
  tier:   { aura: 0, face: 0, burst: 'spark', snd: 'burst', pal: null, fire: 0.15 },
  fire:   { aura: 0, face: 0, burst: 'fire', snd: 'ignite', pal: [0x8a1400, 0xff7a10, 0xfff0b8], fire: 1 },
  gold:   { aura: 0, face: 0, burst: 'gold', snd: 'ignite', pal: [0x6a3a00, 0xffb52e, 0xfff4cc], fire: 0.55 },
  silver: { aura: 0, face: 0, burst: 'gold', snd: 'burst', pal: [0x26303c, 0xb8c8d8, 0xffffff], fire: 0.35 },
  water:  { aura: 1, face: 1, burst: 'water', snd: 'splash', pal: [0x00304a, 0x2aa8d8, 0xd8fbff], fire: 0 },
  void:   { aura: 2, face: 2, burst: 'void', snd: 'void', pal: [0x12002a, 0x7a3cff, 0xffb070], fire: 0 },
  storm:  { aura: 3, face: 4, burst: 'storm', snd: 'zap', pal: [0x001a5a, 0x3aa0ff, 0xe8f6ff], fire: 0 },
  jade:   { aura: 5, face: 3, burst: 'stone', snd: 'crack', pal: [0x0a3a24, 0x3fae7a, 0xd8ffe8], fire: 0 },
  china:  { aura: 5, face: 3, burst: 'stone', snd: 'crack', pal: [0x0c2a6a, 0x5d8cd8, 0xffffff], fire: 0 },
  stone:  { aura: 5, face: 3, burst: 'stone', snd: 'crack', pal: [0x3a3028, 0xc8b8a0, 0xfff8e8], fire: 0 },
  frost:  { aura: 5, face: 5, burst: 'frost', snd: 'crack', pal: [0x1a3a5a, 0x9fd8ff, 0xffffff], fire: 0 },
  aurora: { aura: 4, face: 6, burst: 'prism', snd: 'shimmer', pal: [0x003a2a, 0x3affb0, 0xe8d0ff], fire: 0 },
};
const THEME_OF = {};
[['fire', 'lava burn pyro raku thermal infrared duoEmber'], ['gold', 'gold gilt kintsugi coin bronze leaf sun keywarm'], ['silver', 'dag steel silver chrome'],
 ['water', 'rain puddles sunken tray mist cyanotype lensball glass keyblue'], ['void', 'blackhole eclipse prism droste vertigo window scan3d planet focus'],
 ['storm', 'storm terminal camcorder anaglyph depthscan holoplate latent solar'], ['jade', 'jade duoMoss'], ['china', 'porcelain duoInk riso'], ['stone', 'litho stone poster tritone'],
 ['frost', 'snow crystal seasons'], ['aurora', 'aurora lightpaint fireflies fireworks kaleido foil etch polychrome lenticular glitter xpro aero duoRose']]
  .forEach(([t, ids]) => ids.split(' ').forEach(id => { THEME_OF[id] = t; }));

const GV = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LIB = `
float rvH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rvN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(rvH(i), rvH(i + vec2(1.0, 0.0)), f.x), mix(rvH(i + vec2(0.0, 1.0)), rvH(i + vec2(1.0, 1.0)), f.x), f.y); }
float rvF(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * rvN(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
float sdRB(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec3 ramp(float I, vec3 a, vec3 b, vec3 c){ return mix(mix(a, b, smoothstep(0.08, 0.5, I)), c, smoothstep(0.55, 1.15, I)); }
vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
/* cellular: x the gap to the nearest border, y a random per cell */
vec2 vor(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = vec2(rvH(i + g), rvH(i + g + 17.3)); vec2 r = g + o - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d; }
  return vec2(sqrt(d2) - sqrt(d1), rvH(id + 3.7)); }
`;
/* the aura round the waiting card, in the theme's light; it fades softly inside the card's outline (no hard box when
   the card turns), and the card hides the rest */
const AURA_F = `uniform vec2 uHalf; uniform vec2 uCard; uniform float uTime; uniform float uAmt; uniform float uFire; uniform float uGain; uniform float uMode; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; varying vec2 vUv;
${LIB}
void main(){ vec2 p = (vUv - 0.5) * 2.0 * uHalf; float d = sdRB(p, uCard, uCard.x * 0.06), dd = max(d, 0.0); vec2 q = p / uCard.x * 1.5;
  float edgeL = exp(-dd / (uCard.x * 0.025)) * min(uAmt, 1.2), I = 0.0; vec3 col;
  if (uMode < 0.5) { float sp = mix(0.45, 1.5, uFire);
    vec2 w = vec2(rvF(q * 0.7 + vec2(0.0, -uTime * sp * 0.55)), rvF(q * 0.7 + vec2(4.3, -uTime * sp * 0.55 + 2.1)));
    float n = rvF(q * mix(1.0, 1.6, uFire) + (w - 0.5) * mix(1.4, 2.6, uFire) + vec2(0.0, -uTime * sp));
    float up = smoothstep(-uCard.y * 0.5, uCard.y * 1.3, p.y), reach = uCard.x * mix(0.16, 0.42, uFire) * (0.55 + mix(0.45, 1.6, uFire) * up) * uAmt;
    float f = clamp(1.0 - dd / max(reach * (0.25 + 1.5 * n * n), 1e-3), 0.0, 1.0); f = f * f * (3.0 - 2.0 * f);
    I = f * (0.35 + 1.1 * n) + edgeL * 0.55; col = ramp(I, uA, uB, uC); }
  else if (uMode < 1.5) { vec2 qq = q * 1.3 + vec2(0.0, -uTime * 0.35); float c1 = rvN(qq * 2.0 + vec2(sin(uTime * 0.7), uTime * 0.2)), c2 = rvN(qq * 3.4 - vec2(uTime * 0.3, 0.0));
    float caust = pow(1.0 - abs(c1 - c2), 7.0), f = exp(-dd / (uCard.x * 0.22 * uAmt + 1e-3));
    float bub = step(0.985, rvH(floor(q * 9.0 + vec2(0.0, -uTime * 4.0)))) * f;
    I = f * (0.2 + 1.1 * caust) + bub * 1.5 + edgeL * 0.5; col = ramp(I, uA, uB, uC); }
  else if (uMode < 2.5) { float r = length(p / uCard), a = atan(p.y, p.x), sw = a + uTime * 1.3 - r * 2.5;
    float n = rvF(vec2(cos(sw), sin(sw)) * (1.0 + r) * 1.6 + uTime * 0.15), streak = pow(rvN(vec2(sw * 3.0, r * 5.0)), 2.5);
    float band = exp(-dd / (uCard.x * 0.32 * uAmt + 1e-3));
    I = band * (0.25 + 0.8 * n) * (0.5 + 1.0 * streak) + edgeL * 0.9; col = ramp(I, uA, uB, uC); }
  else if (uMode < 3.5) { float t = floor(uTime * 16.0), n1 = rvF(q * 2.2 + vec2(t * 3.1, t * 1.7)), on = step(0.4, rvN(q * 1.1 + t * 0.71));
    float arc = exp(-abs(dd - uCard.x * 0.05 * (0.4 + n1 * 2.2) * uAmt) / (uCard.x * 0.008)) * on, halo = exp(-dd / (uCard.x * 0.1 * uAmt + 1e-3)) * 0.3;
    I = arc * 1.6 + halo + edgeL * 0.6; col = ramp(I, uA, uB, uC); }
  else if (uMode < 4.5) { float x = p.x / uCard.x, up = smoothstep(-uCard.y * 0.3, uCard.y * 1.7, p.y), cur = rvF(vec2(x * 1.3 + uTime * 0.12, uTime * 0.08));
    float rays = pow(rvN(vec2(x * 7.0 + cur * 3.0, uTime * 0.25)), 2.0), f = exp(-dd / (uCard.x * 0.45 * uAmt + 1e-3)) * (0.35 + 1.3 * up);
    I = f * rays * 1.3 + edgeL * 0.5; col = mix(ramp(I, uA, uB, uC), hue(fract(cur * 0.7 + x * 0.08 + uTime * 0.04)) * 1.2, 0.55); }
  else { float n = rvF(q * 0.9 + vec2(uTime * 0.08, -uTime * 0.14)), f = exp(-dd / (uCard.x * 0.28 * uAmt + 1e-3));
    I = f * (0.25 + 0.85 * n) * (0.85 + 0.15 * sin(uTime * 1.5)) + edgeL * 0.65; col = ramp(I, uA, uB, uC); }
  I *= d < 0.0 ? exp(d / (uCard.x * 0.08)) : 1.0;
  gl_FragColor = vec4(col * I * uGain, 1.0);
  #include <colorspace_fragment>
}`;
/* the fireball: a turbulent ball that swells and cools, rays through it, a white-hot core (uSmoke 0 keeps it clean) */
const BALL_F = `uniform float uK; uniform float uSeed; uniform float uGain; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; varying vec2 vUv;
${LIB}
void main(){ vec2 p = (vUv - 0.5) * 2.0; float r = length(p); vec2 dv = p / max(r, 1e-3);
  float R = 0.22 + 0.78 * (1.0 - pow(1.0 - uK, 3.0));
  float n = rvF(dv * 2.2 + vec2(r * 2.6 - uK * 3.2, uSeed)), n2 = rvF(p * 3.2 + uSeed + uK * 1.5);
  float dens = clamp(1.0 - r / (R * (0.55 + 0.6 * n2)), 0.0, 1.0);
  float rays = pow(rvN(dv * 9.0 + uSeed), 4.0) * (1.0 - smoothstep(0.0, 1.0, r / (R * 1.25)));
  float fade = pow(1.0 - uK, 1.6), I = (dens * (0.5 + 0.9 * n) + rays * 0.9) * fade;
  float core = exp(-r * r * 30.0) * pow(1.0 - uK, 4.0) * 1.6;
  gl_FragColor = vec4(ramp(I * (1.45 - 0.9 * uK), uA, uB, uC) * I * uGain + uC * core, 1.0);
  #include <colorspace_fragment>
}`;
/* a ring of light (shock, splash, the void's lensing edge): radius uR, width uW, rippled by noise */
const RING_F = `uniform float uR; uniform float uW; uniform float uAmt; uniform float uSeed; uniform vec3 uCol; varying vec2 vUv;
${LIB}
void main(){ vec2 p = (vUv - 0.5) * 2.0; float r = length(p); vec2 dv = p / max(r, 1e-3);
  float rr = uR * (1.0 + 0.06 * (rvN(dv * 4.0 + uSeed) - 0.5)); float I = exp(-pow((r - rr) / max(uW, 1e-3), 2.0)) * uAmt * (0.7 + 0.6 * rvN(dv * 11.0 + uSeed));
  gl_FragColor = vec4(uCol * I, 1.0);
  #include <colorspace_fragment>
}`;
const DISC_F = `uniform float uR; uniform float uAmt; varying vec2 vUv;
void main(){ float r = length((vUv - 0.5) * 2.0); float a = (1.0 - smoothstep(uR * 0.85, uR, r)) * uAmt; if (a < 0.003) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }`;
/* the flare streak: a long thin line of light with a hot centre */
const FLARE_F = `uniform float uAmt; uniform vec3 uCol; varying vec2 vUv;
void main(){ float x = (vUv.x - 0.5) * 2.0, y = (vUv.y - 0.5) * 2.0;
  float I = (exp(-y * y * 60.0) * pow(max(0.0, 1.0 - x * x), 3.0) + exp(-(x * x * 14.0 + y * y * 30.0)) * 1.5) * uAmt;
  gl_FragColor = vec4(uCol * I, 1.0);
  #include <colorspace_fragment>
}`;
/* the face cover: the theme's surface over the face, clearing from uO (a point rolled per pull) as uP runs 0..1 */
const FACE_F = `uniform float uP; uniform float uTime; uniform float uAsp; uniform float uGain; uniform float uMode; uniform vec2 uO; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; varying vec2 vUv;
${LIB}
void main(){ vec2 q = (vUv - 0.5) * vec2(uAsp, 1.0); float n = rvF(q * 4.5 + 2.0), v, edgeW = 26.0; vec3 body;
  float th = uP * 1.35 - 0.12;
  if (uMode < 0.5) { v = n * 0.7 + length(q - uO) * 0.55;
    float s = rvF(q * 7.0 + vec2(uTime * 0.22, -uTime * 0.35) + rvF(q * 3.0 - uTime * 0.15) * 1.5);
    body = (mix(uA, uB, smoothstep(0.2, 0.8, s)) + uC * pow(s, 4.0) * 0.9) * (0.85 + 0.15 * sin(uTime * 4.0 + s * 12.0)); }
  else if (uMode < 1.5) { v = (0.5 - q.y) * 0.95 + 0.05 * sin(q.x * 16.0 + uTime * 5.0) + n * 0.18 + abs(q.x - uO.x) * 0.15;
    float c1 = rvN(q * 9.0 + vec2(uTime * 0.6, uTime * 0.9)), c2 = rvN(q * 14.0 - uTime * 0.7), caust = pow(1.0 - abs(c1 - c2), 6.0);
    body = mix(uA, uB, 0.35 + 0.4 * n) * 0.8 + uC * caust * 0.9; edgeW = 40.0; }
  else if (uMode < 2.5) { vec2 o = q - uO * 0.6; float r = length(o), a = atan(o.y, o.x), sw = a + (1.2 - uP) * 4.0 / (r + 0.25) + uTime * 1.5;
    float m = rvF(vec2(cos(sw), sin(sw)) * (r * 3.0 + 0.5) + 3.0); v = r * 1.05 + m * 0.2;
    float streak = pow(rvN(vec2(sw * 2.0, r * 9.0)), 3.0); body = uA * 0.25 + uB * streak * 0.6 * smoothstep(0.0, 0.4, r) + uC * exp(-abs(r - th) * 20.0) * 0.3; edgeW = 18.0; }
  else if (uMode < 3.5) { vec2 cell = vor(q * 5.0 + 1.3); v = cell.y * 0.75 + length(q - uO) * 0.45;
    float vein = pow(1.0 - abs(rvF(q * 2.5 + 7.0) * 2.0 - 1.0), 7.0), crack = 1.0 - smoothstep(0.0, 0.035, cell.x);
    body = mix(uA, uB, 0.3 + 0.6 * rvF(q * 3.0)) + uC * vein * 0.5 + uC * crack * smoothstep(0.0, 0.15, uP) * 1.5; edgeW = 60.0; }
  else if (uMode < 4.5) { float row = floor(vUv.y * 70.0), blk = floor(vUv.x * 9.0); v = rvH(vec2(row, blk)) * 0.55 + rvH(vec2(row, 3.0)) * 0.25 + length(q - uO) * 0.35;
    float st = rvH(floor(vUv * vec2(160.0, 220.0)) + floor(uTime * 30.0)); body = mix(uA, uB, st) * (0.7 + 0.3 * step(0.5, fract(vUv.y * 110.0))) + uC * step(0.97, st) * 0.6; edgeW = 80.0; }
  else if (uMode < 5.5) { vec2 e = min(vUv, 1.0 - vUv) * vec2(uAsp, 1.0); v = 1.0 - min(e.x, e.y) * 3.0 + n * 0.35 - 0.35 + length(q - uO) * 0.15;
    float ridge = pow(1.0 - abs(rvF(q * 6.0) * 2.0 - 1.0), 5.0); body = mix(uB, uC, 0.4 + 0.5 * n) * 0.85 + uC * ridge * 0.6; edgeW = 30.0; }
  else { v = n * 0.6 + length(q - uO) * 0.6; float h = fract(q.x * 1.2 + q.y * 0.8 + n * 1.5 + uTime * 0.15);
    body = hue(h) * 0.75 + 0.2 + uC * step(0.985, rvH(floor(q * 80.0) + floor(uTime * 12.0))) * 2.0; }
  float m = v - th; if (m < 0.0) discard;
  float edge = exp(-m * edgeW);
  gl_FragColor = vec4(body * uGain + uC * edge * 1.8, 1.0);
  #include <colorspace_fragment>
}`;
/* the frame glow after: a band of light hugging the edge, flowing round it; prismatic for mythic and aurora */
const RIM_F = `uniform vec2 uHalf; uniform vec2 uCard; uniform float uTime; uniform float uAmt; uniform float uPrism; uniform vec3 uB; uniform vec3 uC; varying vec2 vUv;
${LIB}
void main(){ vec2 p = (vUv - 0.5) * 2.0 * uHalf; float d = sdRB(p, uCard, uCard.x * 0.06), dd = max(d, 0.0);
  vec2 dv = normalize(p + 1e-4); float flow = rvF(dv * 3.0 + vec2(uTime * 0.6, -uTime * 0.4)) * 1.4;
  float I = (exp(-dd / (uCard.x * 0.022)) * 1.3 + exp(-dd / (uCard.x * 0.14)) * 0.45 * flow) * uAmt * (d < 0.0 ? exp(d / (uCard.x * 0.03)) : 1.0);
  vec3 col = mix(uB, uC, smoothstep(0.6, 1.3, I));
  col = mix(col, hue(fract(atan(p.y, p.x) / 6.2832 + uTime * 0.15)) * 1.4 + 0.2, uPrism * 0.75);
  gl_FragColor = vec4(col * I * 1.8, 1.0);
  #include <colorspace_fragment>
}`;
/* GPU sparks: instanced quads, each a flight from its own start time with drag and gravity, stretched along its
   screen motion, shrinking and cooling over its life */
const SPARK_V = `attribute vec3 aP; attribute vec3 aV; attribute vec4 aC; attribute vec4 aS;
uniform float uTime; uniform vec3 uG; uniform float uStretch; uniform vec3 uCool; varying vec3 vC; varying vec2 vQ; varying float vA;
void main(){ float t = uTime - aS.x, life = aC.a, k = t / life;
  if (t < 0.0 || k >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; vC = vec3(0.0); vQ = vec2(0.0); return; }
  float dr = max(aS.z, 0.001), e = exp(-dr * t);
  vec3 p = aP + aV * (1.0 - e) / dr + 0.5 * uG * t * t, v = aV * e + uG * t;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); vec2 vv = (modelViewMatrix * vec4(v, 0.0)).xy; float sp = length(vv); vec2 dir = sp > 1e-4 ? vv / sp : vec2(1.0, 0.0);
  float size = aS.y * (1.0 - k * k * 0.8), len = size + sp * uStretch;
  vec2 c = position.xy; mv.xy += dir * c.x * len + vec2(-dir.y, dir.x) * c.y * size;
  gl_Position = projectionMatrix * mv;
  vA = smoothstep(0.0, 0.06, k) * (1.0 - k) * (0.75 + 0.25 * sin(uTime * 38.0 + aS.w * 70.0));
  vC = aC.rgb * mix(vec3(1.0), uCool, smoothstep(0.0, 0.8, k)); vQ = c * 2.0; }`;
const SPARK_F = `varying vec3 vC; varying vec2 vQ; varying float vA;
void main(){ float r = dot(vQ, vQ); float a = exp(-r * 3.2) * vA; if (a < 0.003) discard; gl_FragColor = vec4(vC * a, 1.0);
  #include <colorspace_fragment>
}`;

export function install(S) {
  const { T } = S, E = T.E;
  S.dev.define('reveal', 'Reveal style', { blaze: 'Blaze (new)', flip: 'Flip (old)' }, 'blaze');
  S.dev.define('revealTheme', 'Reveal theme', { finish: 'From the finish', ...Object.fromEntries(Object.keys(THEMES).map(k => [k, k[0].toUpperCase() + k.slice(1)])) }, 'finish');
  S.dev.define('reelLen', 'Reel length', { full: 'Full', short: 'Short (testing)' }, 'full');
  const snd = (id, o) => { try { return S.snd && S.snd.play ? S.snd.play(id, o) : null; } catch (e) { return null; } };
  const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const shader = (frag, uniforms, o) => new THREE.ShaderMaterial({ uniforms, vertexShader: GV, fragmentShader: frag, ...ADD, ...(o || {}) });
  const rnd = (a, b) => a + Math.random() * (b - a);
  let clock = 0; const live = new Set();   /* things that outlive a step: { update(dt) → keep?, dispose() } */
  const themeOf = slab => { const f = S.dev.opt('revealTheme'); if (f && f !== 'finish' && THEMES[f]) return f; const fin = S.SL.finishOf(slab || {}, S.testFinish ? S.testFinish() : null); return THEME_OF[fin] || 'tier'; };

  /* ---------- the spark systems: hot sparks (fall and cool) and embers or dust (float) ---------- */
  function sparks(max, o) {
    const g = new THREE.InstancedBufferGeometry(); const base = new THREE.PlaneGeometry(1, 1); g.index = base.index; g.setAttribute('position', base.attributes.position);
    const P = new Float32Array(max * 3), V = new Float32Array(max * 3), Cc = new Float32Array(max * 4), Sx = new Float32Array(max * 4); for (let i = 0; i < max; i++) Sx[i * 4] = -1e4;
    const at = { aP: new THREE.InstancedBufferAttribute(P, 3), aV: new THREE.InstancedBufferAttribute(V, 3), aC: new THREE.InstancedBufferAttribute(Cc, 4), aS: new THREE.InstancedBufferAttribute(Sx, 4) };
    Object.entries(at).forEach(([k, a]) => { a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); }); g.instanceCount = max;
    const u = { uTime: { value: 0 }, uG: { value: new THREE.Vector3(0, o.grav ?? -3, 0) }, uStretch: { value: o.stretch ?? 0.035 }, uCool: { value: o.cool || new THREE.Vector3(1, 0.4, 0.15) } };
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: SPARK_V, fragmentShader: SPARK_F, ...ADD, depthTest: false })); m.frustumCulled = false; m.renderOrder = 60; m.userData.noParticles = true; S.fx.glow(m); S.scene.add(m);
    let head = 0;
    return { m, u,
      /* emit(n, fn(i) → { p, v, c (Color, HDR ok), life, size, drag }) */
      emit(n, fn) { for (let i = 0; i < n; i++) { const k = head++ % max, s = fn(i); P.set([s.p.x, s.p.y, s.p.z], k * 3); V.set([s.v.x, s.v.y, s.v.z], k * 3); Cc.set([s.c.r, s.c.g, s.c.b, s.life], k * 4); Sx.set([u.uTime.value, s.size, s.drag ?? 2, Math.random()], k * 4); }
        Object.values(at).forEach(a => { a.needsUpdate = true; }); },
      dispose() { S.scene.remove(m); base.dispose(); g.dispose(); m.material.dispose(); } };
  }
  /* HOT: sparks that fall and cool; DUST: embers and motes that float; DROP: water and chips, heavy, barely stretched */
  let HOT = null, DUST = null, DROP = null;
  const pools = () => { if (!HOT) { HOT = sparks(4000, { grav: -2.6, stretch: 0.045 }); DUST = sparks(3000, { grav: 0.35, stretch: 0.012, cool: new THREE.Vector3(0.8, 0.55, 0.4) }); DROP = sparks(2000, { grav: -7, stretch: 0.02, cool: new THREE.Vector3(0.7, 0.8, 0.9) }); } };

  /* ---------- the card's frame in the world: centre, right, up, out (towards the camera), half size ---------- */
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
  function frameOf(c) { const G = c.G; G.updateMatrixWorld(true); const o = G.getWorldPosition(new THREE.Vector3()); G.getWorldQuaternion(_q); const s = G.getWorldScale(_v).x;
    return { o, x: new THREE.Vector3(1, 0, 0).applyQuaternion(_q), y: new THREE.Vector3(0, 1, 0).applyQuaternion(_q), z: new THREE.Vector3(0, 0, 1).applyQuaternion(_q), hw: c.hw * s, hh: c.hh * s }; }
  const at = (F, u, v, w) => F.o.clone().addScaledVector(F.x, u * F.hw).addScaledVector(F.y, v * F.hh).addScaledVector(F.z, w || 0);
  const vec = (F, a, b, cz) => new THREE.Vector3().addScaledVector(F.x, a).addScaledVector(F.y, b).addScaledVector(F.z, cz);
  const hdr = (col, k) => col.clone().multiplyScalar(k);
  const rainbow = k => new THREE.Color().setHSL(Math.random(), 0.9, 0.6).multiplyScalar(k);

  /* ---------- landing: the theme, the per-pull rolls, the fx group on the hanger, the aura ---------- */
  function land(r) {
    pools(); const w = r.winner, o = w.obj, tier = (o.slab && o.slab.tier) || 'common', idx = TI[tier] ?? 0, L = LOOK[idx], tn = themeOf(o.slab), th = THEMES[tn];
    [r.flood, r.rim, r.burst, r.ring].forEach(m => { if (m) m.visible = false; });   /* the rail's own glow sprites give way */
    /* the palette: the theme's own (shifted a touch per pull) or the tier's */
    const hs = rnd(-0.025, 0.025), sh = col => col.clone().offsetHSL(hs, 0, 0);
    const P = th.pal ? { a: sh(C(th.pal[0])), b: sh(C(th.pal[1])), c: sh(C(th.pal[2])) } : { a: L.a, b: L.b, c: L.c };
    /* the rolls: where the face clears from, which way it turns, an extra spin, the flare's angle */
    const origins = [[0, 0], [rnd(-0.25, 0.25), rnd(-0.3, 0.3)], [0, 0.42], [0, -0.42], [rnd(-1, 1) < 0 ? -0.3 : 0.3, rnd(-0.4, 0.4)]];
    const roll = { o: origins[Math.floor(Math.random() * origins.length)], dir: Math.random() < 0.5 ? 1 : -1, spin: idx >= 3 && Math.random() < 0.35 ? 1 : 0, flare: rnd(-0.25, 0.25) };
    const K = o.group.scale.x || 0.4, side = o.w > o.h, hw = (side ? o.h : o.w) * K / 2, hh = (side ? o.w : o.h) * K / 2;
    const G = new THREE.Group(); G.position.copy(w.spin.position); w.h.add(G);
    const c = { r, G, hw, hh, idx, L, P, tn, th, roll, tier, aura: null, auraAmt: 0, auraWant: L.aura, stoke: 0 };
    if (L.aura > 0) { const fire = th.fire, hx = hw * (1.5 + 0.4 * fire + (th.aura === 2 ? 0.5 : 0)), hy = hh * (1.25 + 0.5 * fire + (th.aura === 4 ? 0.6 : 0) + (th.aura === 2 ? 0.35 : 0));
      const u = { uHalf: { value: new THREE.Vector2(hx, hy) }, uCard: { value: new THREE.Vector2(hw, hh) }, uTime: { value: Math.random() * 50 }, uAmt: { value: 0 }, uFire: { value: fire }, uGain: { value: 1.1 + 0.7 * fire }, uMode: { value: th.aura }, uA: { value: P.a }, uB: { value: P.b }, uC: { value: P.c } };
      const lift = th.aura === 0 || th.aura === 4 ? (hy - hh) * 0.6 : 0;
      c.aura = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2, hy * 2), shader(AURA_F, u)); c.aura.position.set(0, lift, -0.06); c.aura.renderOrder = 2; S.fx.glow(c.aura); G.add(c.aura); }
    S.fx.want = L.aura > 0 ? 0.3 + 0.3 * L.glow : 0;
    r.blaze = c; return c;
  }
  /* each frame while it waits: the aura breathes and follows the hover, and the theme sheds a few motes */
  function frameLand(c, dt) {
    const r = c.r, hov = r.hoverT || 0, th = c.th, P = c.P; c.G.scale.copy(r.winner.spin.scale);
    c.auraAmt += ((c.auraWant * (1 + 0.35 * hov) + c.stoke) - c.auraAmt) * (1 - Math.exp(-dt * 5));
    if (c.aura) { const u = c.aura.material.uniforms; u.uTime.value += dt; u.uAmt.value = Math.max(0, c.auraAmt * (0.94 + 0.06 * Math.sin(clock * 9))); c.aura.visible = u.uAmt.value > 0.01; }
    if (!c.aura || c.auraAmt < 0.2 || Math.random() > dt * 36 * c.auraAmt) return;
    const F = frameOf(c), s = Math.random() < 0.5 ? -1 : 1;
    if (th.aura === 0 && th.fire > 0.3) DUST.emit(1, () => ({ p: at(F, s * (0.85 + Math.random() * 0.25), -0.9 + Math.random() * 1.9, -0.02), v: vec(F, s * 0.15 * Math.random(), 0.6 + Math.random() * 0.9, 0.1), c: hdr(Math.random() < 0.5 ? P.b : P.c, 2.4), life: 0.9 + Math.random() * 0.9, size: 0.03 + Math.random() * 0.03, drag: 0.6 }));
    else if (th.aura === 1) DUST.emit(1, () => ({ p: at(F, s * (0.9 + Math.random() * 0.2), -1 + Math.random() * 1.6, -0.02), v: vec(F, 0, 0.35 + Math.random() * 0.5, 0.05), c: hdr(P.c, 1.6), life: 1.2 + Math.random(), size: 0.025 + Math.random() * 0.03, drag: 0.4 }));
    else if (th.aura === 2) { const a = Math.random() * Math.PI * 2, R = 2.2; DUST.emit(1, () => ({ p: at(F, Math.cos(a) * R, Math.sin(a) * R * F.hw / F.hh, 0.05), v: vec(F, -Math.cos(a) * 1.4 - Math.sin(a) * 1.2, (-Math.sin(a) * 1.4 + Math.cos(a) * 1.2) * F.hw / F.hh, 0), c: hdr(Math.random() < 0.5 ? P.b : P.c, 2), life: 0.9, size: 0.02 + Math.random() * 0.02, drag: 0.2 })); }
    else if (th.aura === 4) DUST.emit(1, () => ({ p: at(F, rnd(-1.4, 1.4), rnd(0.2, 1.4), -0.03), v: vec(F, 0, 0.15, 0), c: rainbow(1.8), life: 1.4, size: 0.02 + Math.random() * 0.02, drag: 0.3 }));
    else if (th.aura === 5) DUST.emit(1, () => ({ p: at(F, s * (0.95 + Math.random() * 0.2), rnd(-0.9, 0.9), -0.02), v: vec(F, s * 0.1, 0.12, 0.05), c: hdr(P.c, 1.2), life: 1.8, size: 0.04 + Math.random() * 0.05, drag: 0.5 }));
  }

  /* ---------- the click: charge, turn and burst, the face, the settle ---------- */
  const step = (dur, fn, ease) => T.tween({ dur, ease: ease || E.linear, tag: 'rail', update: (e, raw) => { if (fn) fn(e, raw); } }).then(ok => { if (!ok) throw STOP; });
  async function run(style, o) {
    const r = o.r, c = r.blaze || land(r); c.spin = o.spin; c.y0 = o.y0; c.obj = o.obj; c.alive = o.alive; const L = c.L, P = c.P, idx = c.idx, th = c.th, sp = o.spin, h = r.winner.h, hRest = h.position.clone();
    const check = () => { if (!c.alive()) throw STOP; };
    if (r.winner.obj && r.winner.obj.setGlow) { try { r.winner.obj.setGlow(0); } catch (e) {} }
    try {
      /* charge: the aura flares, the card trembles, light rushes in (the void and mythic go dark first) */
      const voidish = th.burst === 'void';
      if (L.charge > 0 || voidish) { const dur = Math.max(L.charge, voidish ? 0.4 + 0.1 * idx : 0); let dark = null;
        if (idx >= 5 || voidish) dark = screen(0x000000, false);
        if (idx >= 3 || voidish) snd(voidish ? 'void' : 'charge', { dur: dur + 0.15 });
        let acc = 0;
        await step(dur, (e, raw) => { c.stoke = 1.2 * e * (idx >= 4 ? 1.4 : 1); const a = 0.006 + 0.05 * raw * raw * (idx >= 4 ? 1.5 : 1); h.position.set(hRest.x + (Math.random() - 0.5) * a, hRest.y + (Math.random() - 0.5) * a, hRest.z);
          if (dark) dark.material.opacity = (voidish ? 0.55 : 0.7) * Math.min(1, raw * 2.5);
          acc += 0.016 * (idx >= 4 ? 260 : 120 + 40 * idx); const n = Math.floor(acc); if (n > 0) { acc -= n; const F = frameOf(c), life = 0.28 + Math.random() * 0.12;
            HOT.emit(n, () => { const ang = Math.random() * Math.PI * 2, R = 2.4 + Math.random() * 1.6, p = at(F, Math.cos(ang) * R, Math.sin(ang) * R * F.hw / F.hh, 0.1 + Math.random() * 0.4);
              return { p, v: F.o.clone().sub(p).multiplyScalar(1 / life), c: th.burst === 'prism' ? rainbow(2.6) : hdr(Math.random() < 0.4 ? P.c : P.b, 3), life, size: 0.02 + Math.random() * 0.02, drag: 0.001 }; }); } }, E.inQuad);
        check(); h.position.copy(hRest); c.stoke = 0; if (dark) fadeOut(dark, 0.5); }
      /* the turn (either way round, sometimes an extra spin), the burst at edge-on */
      if (c.aura) { c.auraWant = 0; c.auraAmt = 0; c.aura.visible = false; }   /* gone before the card leaves the hole it makes */
      snd('flip'); const half = idx >= 4 ? 0.15 : 0.2, dir = c.roll.dir, extra = c.roll.spin * Math.PI * 2;
      await step(half + c.roll.spin * 0.12, e => { sp.rotation.y = c.y0 + dir * (Math.PI / 2 + extra) * e; sp.position.z = 0.45 * e; }, E.inCubic); check();
      burst(c);
      await step(half * 1.25, e => { sp.rotation.y = c.y0 + dir * (Math.PI / 2 + extra + Math.PI / 2 * e); sp.position.z = 0.45 * (1 - e); }, E.outCubic); check();
      sp.rotation.y = c.y0 + Math.PI; sp.position.z = 0;
      /* the face: the theme's cover clearing away (rare and up), then the chime */
      if (L.face > 0 && c.coverU) { const u = c.coverU; await step(0.08 + 0.04 * idx); check(); faceSound(c);
        let acc = 0; await step(L.face, e => { u.uP.value = e; acc += 0.016 * (160 + 110 * idx); const n = Math.floor(acc); if (n > 0) { acc -= n; shed(c, n, e); } }, th.face === 1 ? E.inQuad : E.inOutSine);
        check(); }
      settle(c);
    } catch (e) { if (e !== STOP) console.error('reveal', e); }
    finally { h.position.copy(hRest); if (c.alive()) { sp.rotation.y = c.y0 + Math.PI; sp.position.z = 0; } if (c.coverM) { const m = c.coverM; if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); c.coverM = null; } }
  }
  /* what comes off the face as its cover clears, in the theme's way */
  function shed(c, n, e) {
    const F = frameOf(c), P = c.P, th = c.th, rr = Math.min(1, e * 1.2), o = c.roll.o;
    const pt = () => { const a = Math.random() * Math.PI * 2, k = rr * (0.6 + Math.random() * 0.5); return at(F, o[0] * 2 + Math.cos(a) * k, o[1] * 2 + Math.sin(a) * k * 0.95, 0.03); };
    if (th.face === 1) DROP.emit(n, () => ({ p: at(F, rnd(-1, 1), 1 - 2 * Math.min(1, e * 1.1), 0.03), v: vec(F, rnd(-0.3, 0.3), rnd(-0.4, 0.4), rnd(0.2, 0.9)), c: hdr(Math.random() < 0.6 ? P.c : P.b, 1.6), life: 0.6 + Math.random() * 0.5, size: 0.015 + Math.random() * 0.02, drag: 1 }));
    else if (th.face === 3 || th.face === 5) DROP.emit(Math.ceil(n * 0.6), () => ({ p: pt(), v: vec(F, rnd(-0.6, 0.6), rnd(0, 0.8), rnd(0.4, 1.4)), c: hdr(Math.random() < 0.5 ? P.b : P.c, th.face === 5 ? 1.8 : 1.1), life: 0.7 + Math.random() * 0.5, size: 0.025 + Math.random() * 0.035, drag: 1.2 }));
    else if (th.face === 2) DUST.emit(n, () => { const p = pt(), v = F.o.clone().sub(p).multiplyScalar(-1.2); v.add(vec(F, rnd(-1, 1), rnd(-1, 1), 0.5)); return { p, v, c: hdr(Math.random() < 0.5 ? P.b : P.c, 2.2), life: 0.5 + Math.random() * 0.4, size: 0.015 + Math.random() * 0.02, drag: 2 }; });
    else DUST.emit(n, () => ({ p: pt(), v: vec(F, rnd(-0.25, 0.25), 0.4 + Math.random() * 0.8, 0.4 + Math.random()), c: th.face === 6 ? rainbow(2.2) : hdr(Math.random() < 0.5 ? P.c : P.b, 2.4), life: 0.6 + Math.random() * 0.7, size: 0.018 + Math.random() * 0.03, drag: 1.5 }));
  }
  const faceSound = c => { const th = c.th; if (th.face === 0) snd(th.fire > 0.5 ? 'ignite' : 'burst', { dur: c.L.face, k: 0.4 }); else if (th.face === 1) snd('splash', { k: 0.5 }); else if (th.face === 3 || th.face === 5) snd('crack', { k: 0.7 }); else if (th.face === 4) snd('zap', { k: 0.5, dur: c.L.face }); else if (th.face === 2) snd('void', { dur: c.L.face, k: 0.5 }); else snd('shimmer', { k: 0.7 }); };

  /* ---------- the bursts, one per theme ---------- */
  const BURSTS = {
    spark(c, F) { sparkSpray(c, F, 1); },
    fire(c, F) { fireball(c, F, 1); sparkSpray(c, F, 1); embers(c, F, 1); },
    gold(c, F) { fireball(c, F, 0.75); sparkSpray(c, F, 1); glitter(c, F); },
    water(c, F) { const P = c.P, idx = c.idx; ring(F, P.c, 2.2 + 0.3 * idx, 0.55, 1.6); ring(F, P.b, 1.6 + 0.2 * idx, 0.75, 1.1, 0.12);
      DROP.emit(c.L.sparks, () => { const a = Math.random() * Math.PI * 2, s = F.hw * rnd(1.5, 3.5 + idx * 0.5); return { p: at(F, rnd(-0.4, 0.4), rnd(-0.5, 0.5), 0.3), v: vec(F, Math.cos(a) * s, Math.abs(Math.sin(a)) * s * 0.9 + F.hw * 2, rnd(-0.5, 1.5) * F.hw), c: hdr(Math.random() < 0.5 ? P.c : P.b, rnd(1.2, 2.2)), life: rnd(0.5, 1.0), size: rnd(0.015, 0.04), drag: 0.8 }; });
      DUST.emit(200 + 80 * idx, () => ({ p: at(F, rnd(-1.2, 1.2), rnd(-1, 1), 0.2), v: vec(F, rnd(-0.6, 0.6), rnd(0, 0.6), rnd(0, 0.5)), c: hdr(P.c, 0.9), life: rnd(0.8, 1.6), size: rnd(0.05, 0.1), drag: 1.5 })); },
    void(c, F) { const P = c.P, idx = c.idx; const disc = discAt(F, F.hh * 1.6); let t = 0; live.add({ update(dt) { t += dt; const k = t / 0.45; disc.u.uR.value = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6 * 0.95; disc.u.uAmt.value = k < 0.6 ? 0.85 : 0.85 * (1 - (k - 0.6) / 0.4); return k < 1; }, dispose: disc.dispose });
      ring(F, P.c, 2.6 + 0.3 * idx, 0.4, 2.4); ring(F, P.b, 2.0 + 0.3 * idx, 0.6, 1.5, 0.1);
      HOT.emit(c.L.sparks, () => { const a = Math.random() * Math.PI * 2, s = F.hw * rnd(2, 6 + idx), tw = rnd(0.6, 1.2); return { p: at(F, 0, 0, 0.3), v: vec(F, (Math.cos(a) - Math.sin(a) * tw) * s, (Math.sin(a) + Math.cos(a) * tw) * s, rnd(-0.3, 0.8) * s * 0.3), c: hdr(Math.random() < 0.4 ? P.c : P.b, rnd(1.4, 2.8)), life: rnd(0.4, 0.9), size: rnd(0.012, 0.03), drag: 2.4 }; }); },
    storm(c, F) { const P = c.P; bolts(c, F, 6 + 2 * c.idx); sparkSpray(c, F, 0.7); const f = screen(0xffffff, true); f.material.opacity = 0.12 + 0.04 * c.idx; fadeOut(f, 0.18); setTimeout(() => { const g = screen(P.c.getHex(), true); g.material.opacity = 0.1; fadeOut(g, 0.15); }, 90); },
    stone(c, F) { const P = c.P, idx = c.idx; ring(F, P.c, 1.8 + 0.2 * idx, 0.5, 1.0);
      DROP.emit(Math.round(c.L.sparks * 0.6), () => { const a = Math.random() * Math.PI * 2, s = F.hw * rnd(1.2, 4 + idx * 0.4); return { p: at(F, rnd(-0.6, 0.6), rnd(-0.7, 0.7), 0.2), v: vec(F, Math.cos(a) * s, Math.sin(a) * s + F.hw * 1.5, rnd(0.2, 1.4) * F.hw), c: hdr(Math.random() < 0.5 ? P.b : P.a.clone().lerp(P.b, 0.5), rnd(0.8, 1.3)), life: rnd(0.6, 1.1), size: rnd(0.03, 0.07), drag: 0.6 }; });
      DUST.emit(260 + 80 * idx, () => ({ p: at(F, rnd(-1, 1), rnd(-1, 1), 0.2), v: vec(F, rnd(-1, 1), rnd(-0.3, 0.8), rnd(0, 0.8)), c: hdr(P.c, 0.6), life: rnd(0.9, 1.8), size: rnd(0.06, 0.12), drag: 2 })); sparkSpray(c, F, 0.35); },
    frost(c, F) { BURSTS.stone(c, F); DUST.emit(400 + 100 * c.idx, () => ({ p: at(F, rnd(-1.4, 1.4), rnd(-1.2, 1.4), 0.25), v: vec(F, rnd(-0.5, 0.5), rnd(-0.6, 0.2), rnd(0, 0.6)), c: hdr(c.P.c, 1.6), life: rnd(1.2, 2.2), size: rnd(0.02, 0.04), drag: 1.2 })); },
    prism(c, F) { const idx = c.idx; ring(F, rainbow(1.2), 2.2 + 0.3 * idx, 0.45, 1.6); sparkSpray(c, F, 0.6, () => rainbow(rnd(1.6, 3)));
      setTimeout(() => { if (!HOT) return; const F2 = frameOf(c); sparkSpray(c, F2, 0.6, () => rainbow(rnd(1.6, 3))); ring(F2, rainbow(1.0), 2.8 + 0.3 * idx, 0.5, 1.2); }, 140); },
  };
  function sparkSpray(c, F, k, colFn) { const P = c.P, idx = c.idx; HOT.emit(Math.round(c.L.sparks * k), () => { const a = Math.random() * Math.PI * 2, s = F.hw * (1.5 + Math.random() * Math.random() * (5 + idx)), out = (Math.random() - 0.25) * s * 0.7;
    return { p: at(F, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8, 0.3), v: vec(F, Math.cos(a) * s, Math.sin(a) * s, out), c: colFn ? colFn() : hdr(Math.random() < 0.35 ? P.c : P.b, 1.4 + Math.random() * 1.6), life: 0.35 + Math.random() * (0.5 + 0.12 * idx), size: 0.012 + Math.random() * 0.03, drag: 1.8 + Math.random() * 1.5 }; }); }
  function embers(c, F, k) { if (c.idx < 3) return; const P = c.P; DUST.emit(Math.round((500 + 300 * (c.idx - 3)) * k), () => ({ p: at(F, rnd(-1.2, 1.2), rnd(-1.1, 1.1), 0.2), v: vec(F, rnd(-1.1, 1.1), 0.3 + Math.random() * 1.6, Math.random()), c: hdr(Math.random() < 0.5 ? P.b : P.c, 2.2), life: 1.2 + Math.random() * 1.6, size: 0.02 + Math.random() * 0.035, drag: 1.4 })); }
  function glitter(c, F) { const P = c.P; DUST.emit(300 + 150 * c.idx, () => ({ p: at(F, rnd(-1.3, 1.3), rnd(-1.2, 1.2), rnd(0.1, 0.5)), v: vec(F, rnd(-0.3, 0.3), rnd(-0.2, 0.5), rnd(-0.1, 0.3)), c: hdr(Math.random() < 0.6 ? P.c : P.b, rnd(2, 3.5)), life: rnd(0.6, 1.6), size: rnd(0.01, 0.025), drag: 1 })); }
  function fireball(c, F, k) { const P = c.P, idx = c.idx; if (idx < 2) return; const size = F.hh * (idx >= 5 ? 2.6 : idx >= 4 ? 2.2 : 1.6) * k, u = { uK: { value: 0 }, uSeed: { value: Math.random() * 20 }, uGain: { value: (idx >= 4 ? 0.85 : 0.6) * (0.6 + 0.4 * k) }, uA: { value: P.a }, uB: { value: P.b }, uC: { value: P.c } };
    const ball = new THREE.Mesh(new THREE.PlaneGeometry(size, size), shader(BALL_F, u, { depthTest: false })); ball.renderOrder = 55; ball.position.copy(at(F, 0, 0, 0.5)); ball.quaternion.copy(S.camera.quaternion); S.fx.glow(ball); S.scene.add(ball);
    const dur = idx >= 5 ? 0.85 : idx >= 4 ? 0.7 : 0.5; let t = 0; live.add({ update(dt) { t += dt; u.uK.value = Math.min(1, t / dur); ball.quaternion.copy(S.camera.quaternion); return t < dur; }, dispose() { S.scene.remove(ball); ball.geometry.dispose(); ball.material.dispose(); } }); }
  /* a ring facing the camera, growing to size (in card heights) over dur; delay in seconds */
  function ring(F, col, size, dur, gain, delay) { const u = { uR: { value: 0.1 }, uW: { value: 0.05 }, uAmt: { value: 0 }, uSeed: { value: Math.random() * 30 }, uCol: { value: col } }, D = F.hh * size * 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(D, D), shader(RING_F, u, { depthTest: false })); m.renderOrder = 56; m.position.copy(F.o).addScaledVector(F.z, 0.45); m.quaternion.copy(S.camera.quaternion); S.fx.glow(m); S.scene.add(m);
    let t = -(delay || 0); live.add({ update(dt) { t += dt; if (t < 0) return true; const k = Math.min(1, t / dur); u.uR.value = 0.15 + 0.82 * E.outCubic(k); u.uW.value = 0.03 + 0.06 * k; u.uAmt.value = gain * Math.pow(1 - k, 1.5); m.quaternion.copy(S.camera.quaternion); return k < 1; }, dispose() { S.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }); }
  /* a black disc in front of the card (the void swallowing the light before it bursts) */
  function discAt(F, size) { const u = { uR: { value: 0 }, uAmt: { value: 0 } }, m = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), new THREE.ShaderMaterial({ uniforms: u, vertexShader: GV, fragmentShader: DISC_F, transparent: true, depthWrite: false, depthTest: false }));
    m.renderOrder = 54; m.position.copy(F.o).addScaledVector(F.z, 0.4); m.quaternion.copy(S.camera.quaternion); S.scene.add(m); return { u, dispose() { S.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }; }
  /* jagged bolts out from the card, flickering and re-forming for a moment */
  function bolts(c, F, n) { const mat = new THREE.LineBasicMaterial({ color: hdr(c.P.c, 2.5), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }), grp = new THREE.Group(); grp.renderOrder = 57; S.fx.glow(grp); S.scene.add(grp);
    const make = () => { grp.children.slice().forEach(l => { grp.remove(l); l.geometry.dispose(); }); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, L = F.hh * rnd(1.2, 2.6), pts = []; let p = at(F, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.35);
      for (let k = 0; k <= 10; k++) { pts.push(p.clone()); p = p.clone().addScaledVector(vec(F, Math.cos(a), Math.sin(a), 0), L / 10).addScaledVector(vec(F, -Math.sin(a), Math.cos(a), 0), rnd(-1, 1) * L * 0.07); }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); l.layers.enable(S.fx.FX); l.renderOrder = 57; grp.add(l); } };
    let t = 0, next = 0; live.add({ update(dt) { t += dt; if (t >= next) { next = t + rnd(0.04, 0.08); make(); } mat.opacity = (0.5 + 0.5 * Math.random()) * Math.max(0, 1 - t / 0.45); return t < 0.45; }, dispose() { grp.children.forEach(l => l.geometry.dispose()); S.scene.remove(grp); mat.dispose(); } }); }

  /* the burst at edge-on: the theme's burst, the flare, the flash, the jolt; the face cover goes on while it is hidden */
  function burst(c) {
    const L = c.L, idx = c.idx, th = c.th, P = c.P, F = frameOf(c), o = c.obj;
    snd(th.snd === 'ignite' ? 'burst' : th.snd, { k: 0.5 + 0.12 * idx, dur: 0.5 }); if (th.snd === 'ignite' && idx >= 3) snd('ignite', { dur: 0.7 }); if (idx >= 4) snd('slam', { k: idx >= 5 ? 1 : 0.85 });
    S.fx.want = 0.4 + 0.6 * L.glow; S.fx.shake = Math.max(S.fx.shake, L.shake);
    (BURSTS[th.burst] || BURSTS.spark)(c, F);
    flare(at(F, 0, 0, 0.55), F.hw * (idx >= 4 ? 16 : 9), F.hw * 0.5, c.roll.flare, hdr(P.c, 1.0), 0.3 + 0.08 * idx, 1.0 + 0.25 * idx);
    if (th.burst !== 'void') flare(at(F, 0, 0, 0.5), F.hh * 4.2, F.hw * 0.7, Math.PI / 2, hdr(P.c, 1.0), 0.22, 1.2 + 0.25 * idx);
    if (L.flash > 0) { const f = screen(P.b.getHex(), true); f.material.opacity = L.flash * 0.45; fadeOut(f, 0.3 + 0.08 * idx); }
    if (L.face > 0 && o && o.inner) { const u = { uP: { value: 0 }, uTime: { value: 0 }, uAsp: { value: (o.w || 2.9) / (o.h || 3.9) }, uGain: { value: th.face === 0 ? 0.8 + 0.15 * th.fire : 0.85 }, uMode: { value: th.face }, uO: { value: new THREE.Vector2(c.roll.o[0], c.roll.o[1]) }, uA: { value: P.a }, uB: { value: P.b }, uC: { value: P.c } };
      const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), shader(FACE_F, u, { blending: THREE.NormalBlending })); m.position.z = (o.th || 0.03) / 2 + 0.03; m.renderOrder = 45; m.userData.noParticles = true; o.inner.add(m); c.coverM = m; c.coverU = u;
      live.add({ update(dt) { u.uTime.value += dt; return !!c.coverM; }, dispose() {} }); }
  }
  /* the settle: the chime, the frame glow that rides with the card, embers, the stamp; the bloom eases off */
  function settle(c) {
    const L = c.L, idx = c.idx, o = c.obj, P = c.P, th = c.th;
    snd('chime', { tier: idx >= 4 ? 'epic' : c.tier }); if (idx >= 4) snd('slam', { k: 0.5 });
    if (o && o.inner) { const hw = (o.w || 2.9) / 2, hh = (o.h || 3.9) / 2, hx = hw * 1.45, hy = hh * 1.35, u = { uHalf: { value: new THREE.Vector2(hx, hy) }, uCard: { value: new THREE.Vector2(hw, hh) }, uTime: { value: 0 }, uAmt: { value: 0 }, uPrism: { value: idx >= 5 || th.burst === 'prism' ? 1 : 0 }, uB: { value: P.b }, uC: { value: P.c } };
      const rim = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2, hy * 2), shader(RIM_F, u)); rim.position.z = -(o.th || 0.03) / 2 - 0.02; rim.renderOrder = 1; rim.userData.noParticles = true; S.fx.glow(rim); o.inner.add(rim);
      const peak = 0.5 + 0.12 * idx, hold = 0.6 + 0.25 * idx, out = 1.6; let t = 0;
      live.add({ update(dt) { t += dt; u.uTime.value += dt; u.uAmt.value = peak * (t < 0.15 ? t / 0.15 : t < hold ? 1 : Math.max(0, 1 - (t - hold) / out)); return t < hold + out && !o.disposed; }, dispose() { if (rim.parent) rim.parent.remove(rim); rim.geometry.dispose(); rim.material.dispose(); } }); }
    if (idx >= 4) { let t = 0; live.add({ update(dt) { t += dt; if (Math.random() < dt * 60 && o && o.group) { o.group.updateMatrixWorld(true); const p = o.group.localToWorld(new THREE.Vector3((Math.random() - 0.5) * (o.w || 2.9), (Math.random() - 0.5) * (o.h || 3.9), 0.05));
      const pool = th.face === 1 || th.face === 3 || th.face === 5 ? DROP : DUST, up = pool === DROP ? 0.2 : 0.5 + Math.random() * 0.7;
      pool.emit(1, () => ({ p, v: new THREE.Vector3((Math.random() - 0.5) * 0.3, up, (Math.random() - 0.5) * 0.3), c: th.burst === 'prism' ? rainbow(2) : hdr(Math.random() < 0.5 ? P.b : P.c, 2.2), life: 1 + Math.random(), size: 0.02 + Math.random() * 0.03, drag: 0.8 })); } return t < 1.8; }, dispose() {} }); }
    if (idx >= 5 && o && o.inner) { const st = new THREE.Mesh(new THREE.PlaneGeometry((o.w || 2.9) * 0.78, (o.w || 2.9) * 0.78 * 0.4), new THREE.MeshBasicMaterial({ map: S.holo.tex.stamp(), transparent: true, opacity: 0, depthWrite: false, depthTest: false })); st.rotation.z = -0.09; st.position.set(0, -(o.h || 3.9) * 0.12, (o.th || 0.03) / 2 + 0.05); st.renderOrder = 50; o.inner.add(st);
      let t = 0; live.add({ update(dt) { t += dt; const s = Math.min(1, Math.max(0, (t - 0.35) / 0.2)); if (s > 0 && !st.userData.hit) { st.userData.hit = true; snd('slam', { k: 0.7 }); S.fx.shake = Math.max(S.fx.shake, 0.06); const f = screen(0xffffff, true); f.material.opacity = 0.35; fadeOut(f, 0.4); }
        st.material.opacity = s * (1 - Math.max(0, (t - 2.6) / 0.6)); st.scale.setScalar(Math.max(0.001, 2.6 - 1.6 * E.outBack(s))); return t < 3.2 && !o.disposed; }, dispose() { if (st.parent) st.parent.remove(st); st.geometry.dispose(); st.material.dispose(); } }); }
    let t = 0; const peak = 0.4 + 0.6 * c.L.glow; live.add({ update(dt) { t += dt; S.fx.want = t < 0.5 ? peak : Math.max(0, peak * (1 - (t - 0.5) / 2.2)); return t < 2.7; }, dispose() { S.fx.want = 0; } });
  }

  /* ---------- small pieces ---------- */
  function screen(color, additive) { const cam = S.camera, m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    const hh = 2 * 1.5 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.1; m.position.z = -1.5; m.scale.set(hh * cam.aspect, hh, 1); m.renderOrder = additive ? 70 : 58; m.userData.noParticles = true; cam.add(m); return m; }
  function fadeOut(m, dur) { const a0 = m.material.opacity; let t = 0; live.add({ update(dt) { t += dt; m.material.opacity = a0 * Math.max(0, 1 - t / dur) * Math.max(0, 1 - t / dur); return t < dur; }, dispose() { if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); } }); }
  function flare(pos, len, thick, rot, col, dur, gain) { const u = { uAmt: { value: gain }, uCol: { value: col } }, m = new THREE.Mesh(new THREE.PlaneGeometry(len, thick), shader(FLARE_F, u, { depthTest: false })); m.renderOrder = 62; m.position.copy(pos); S.fx.glow(m); S.scene.add(m); let t = 0;
    live.add({ update(dt) { t += dt; m.quaternion.copy(S.camera.quaternion); m.rotateZ(rot); const k = t / dur; u.uAmt.value = gain * Math.pow(Math.max(0, 1 - k), 2); m.scale.set(0.6 + 0.6 * Math.min(1, k * 3), 1 - 0.6 * k, 1); return k < 1; }, dispose() { S.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }); }

  /* ---------- every frame (index.js), also after the rail has gone ---------- */
  function frame(dt) { if (!(dt > 0)) return; clock += dt; if (HOT) { HOT.u.uTime.value += dt; DUST.u.uTime.value += dt; DROP.u.uTime.value += dt; }
    const r = S.rail && S.rail.__r ? S.rail.__r() : null; if (r && r.blaze && r.phase !== 'done' && r.phase !== 'sink') frameLand(r.blaze, dt);
    for (const f of [...live]) { let keep = false; try { keep = f.update(dt); } catch (e) { console.error(e); } if (!keep) { live.delete(f); try { f.dispose(); } catch (e) {} } } }
  /* the rail closing: the aura and the hanger's group go with it; sparks already flying finish on their own */
  function close(r) { const c = r && r.blaze; if (!c) return; if (c.aura) { const a = c.aura; if (a.parent) a.parent.remove(a); a.geometry.dispose(); a.material.dispose(); c.aura = null; } if (c.G.parent) c.G.parent.remove(c.G);
    if (c.coverM) { const m = c.coverM; if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); c.coverM = null; } r.blaze = null; if (!live.size) S.fx.want = 0; }
  S.reveals = { style: () => S.dev.opt('reveal') || 'blaze', land, run, frame, close, themeOf, THEMES: Object.keys(THEMES) };
}
