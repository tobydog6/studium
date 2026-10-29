// HOLO: the finish shaders (shared with Sam's "Slab Designs" page, where they were signed off), the hover glow per
// finish (S.holo.glowOf, from the Flip and Glow page), the burst of light at the edge-on moment of the flip
// (S.holo.burst) and the tier-scaled landing after it (S.holo.reveal, from The Pull page: common settles, uncommon
// foil sweep, rare spin of rings and glints, epic starburst, sparks and flood, legendary slow-mo gold flood, embers and
// a slam, mythic blackout, eclipse corona, 1 OF 1 stamp and a white flash).
// Every finish grows out of the photograph itself (bands along its tones, etch lines on its contours, flakes in its
// highlights, prism light off its edges); nothing is a flat wash over the print. The finish update gets tilt (-1..1
// x/y from the inspect drag and the hover) and pointer (0..1 uv over the photo), which latent and thermal read; the
// landings drive obj.tilt themselves so the finish catches light while the print lies still.
// Every effect is meshes, sprites and shader planes added to S.scene (in a frame copied from the print) and removed
// when done; everything runs on S.T time, tagged 'holo', so it pauses with the room and obeys setTimeScale.
import * as THREE from 'three';
import { TIER } from './slabs.js';

const VERT = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`;
const HEAD = `uniform sampler2D uTex; uniform vec2 uTilt; uniform vec2 uPointer; uniform float uTime; uniform vec3 uTier; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
vec3 hash3(vec2 p){ vec3 q=vec3(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)),dot(p,vec2(419.2,371.9))); return fract(sin(q)*43758.5453); }
float luma(vec3 c){ return dot(c,vec3(0.299,0.587,0.114)); }
float fres(){ return pow(1.0-max(0.0,dot(normalize(vN),normalize(vV))),1.6); }
/* the photo's tonal gradient, for finishes that follow its detail */
vec2 grad(vec2 uv){ vec2 e=vec2(0.004,0.006); return vec2(luma(texture2D(uTex,uv+vec2(e.x,0.0)).rgb)-luma(texture2D(uTex,uv-vec2(e.x,0.0)).rgb), luma(texture2D(uTex,uv+vec2(0.0,e.y)).rgb)-luma(texture2D(uTex,uv-vec2(0.0,e.y)).rgb)); }`;
export const FRAGS = {
  foil: `void main(){ float f=fres(); vec3 t=texture2D(uTex,vUv).rgb; float l=luma(t); vec2 g=grad(vUv);
    float band=fract(l*2.4+(vUv.x*0.35+vUv.y*0.2)+g.x*6.0+g.y*4.0+uTilt.x*1.3-uTilt.y*0.8+uTime*0.015); vec3 c=hue(band);
    float mask=smoothstep(0.12,0.5,l)*(1.0-smoothstep(0.8,1.0,l)); float grain=0.86+0.14*sin(vUv.y*900.0+vUv.x*120.0);
    float a=mask*(0.06+0.4*f+0.42*length(uTilt))*grain; gl_FragColor=vec4(c*mix(vec3(1.0),t*2.2,0.35),clamp(a,0.0,0.75));
    #include <colorspace_fragment>
  }`,
  etch: `void main(){ float f=fres(); vec3 t=texture2D(uTex,vUv).rgb; float l=luma(t); vec2 g=grad(vUv);
    float gr=clamp(length(g)*14.0,0.0,1.0); float iso=abs(sin(l*52.0+uTilt.x*4.0-uTilt.y*2.5)); float lines=smoothstep(0.9,1.0,iso)*(0.35+0.65*gr);
    vec2 d=vUv-0.5+uTilt*0.12; float r=length(d*vec2(1.0,1.4)); float an=atan(d.y,d.x); float sw=smoothstep(0.78,1.0,sin(r*80.0+an*3.0+uTime*0.4))*(1.0-gr)*0.35;
    vec3 c=mix(hue(fract(l*1.5+an*0.15+uTilt.x*0.6)),vec3(1.0),0.55); float a=(lines+sw)*(0.3+0.5*f+0.5*length(uTilt));
    gl_FragColor=vec4(c,clamp(a,0.0,0.9));
    #include <colorspace_fragment>
  }`,
  glitter: `void main(){ vec3 t=texture2D(uTex,vUv).rgb; float l=luma(t); vec2 g=floor(vUv*vec2(96.0,136.0)); vec3 h=hash3(g); float ang=h.x*6.2832; vec2 dir=vec2(cos(ang),sin(ang));
    float want=0.5+0.5*dot(dir,uTilt); float s=pow(max(0.0,1.0-abs(h.y-want)*8.0),2.0); float lit=smoothstep(0.2,0.7,l);
    /* a few flakes twinkle on their own, so a print lying still keeps its life */
    float tw=pow(0.5+0.5*sin(uTime*(1.2+h.z*2.5)+h.x*40.0),14.0)*smoothstep(0.5,0.9,l);
    vec3 c=mix(t*1.6,vec3(1.0),0.5)*mix(vec3(1.0),hue(h.z),0.35); float base=0.1*lit*(0.3+0.7*h.z); float a=base+s*lit*(0.45+0.8*length(uTilt))+tw*0.7;
    gl_FragColor=vec4(c,clamp(a,0.0,1.0));
    #include <colorspace_fragment>
  }`,
  gold: `void main(){ vec3 t=texture2D(uTex,vUv).rgb; float l=luma(t); vec3 gold=mix(vec3(0.22,0.12,0.03),vec3(1.0,0.83,0.42),pow(l,0.9));
    vec2 tl=uTilt+vec2(sin(uTime*0.35)*0.12,cos(uTime*0.27)*0.08);
    float sweep=exp(-pow((vUv.x-(0.5+tl.x*0.9))*2.6,2.0))*0.5+exp(-pow((vUv.y-(0.5-tl.y*0.9))*3.0,2.0))*0.2; float emb=0.94+0.06*sin((vUv.x+vUv.y)*500.0);
    vec3 c=gold*(0.8+sweep)*emb+sweep*vec3(0.5,0.45,0.3)*fres(); gl_FragColor=vec4(c,1.0);
    #include <colorspace_fragment>
  }`,
  prism: `void main(){ vec2 sh=uTilt*0.004; float r=luma(texture2D(uTex,vUv+sh).rgb), g=luma(texture2D(uTex,vUv).rgb), b=luma(texture2D(uTex,vUv-sh).rgb);
    vec3 bw=pow(vec3(r,g,b),vec3(1.35))*1.2; vec2 gd=grad(vUv);
    float gr=clamp(length(gd)*10.0,0.0,1.0); float hi=smoothstep(0.55,0.95,g); float f=fres();
    vec3 pr=hue(fract(g*1.2+gd.x*5.0+uTilt.x*0.9-uTilt.y*0.5+uTime*0.03)); float k=(gr*0.9+hi*0.5)*(0.35+0.65*f)*(0.5+0.9*length(uTilt));
    vec3 c=bw*0.82+pr*k*0.9; gl_FragColor=vec4(c,1.0);
    #include <colorspace_fragment>
  }`,
  chrome: `void main(){ vec3 t=texture2D(uTex,vUv).rgb; float l=luma(t); float h=vUv.y+0.35*(l-0.5)+uTilt.y*0.5+uTilt.x*0.1*sin(vUv.x*20.0);
    vec3 sky=mix(vec3(0.92,0.95,1.0),vec3(0.16,0.19,0.26),smoothstep(0.42,0.56,h)); float spec=pow(max(0.0,1.0-abs(h-0.5-uTilt.x*0.2)*6.0),3.0);
    vec3 c=sky*(0.45+0.75*l)+spec*0.9+fres()*0.25; gl_FragColor=vec4(c,1.0);
    #include <colorspace_fragment>
  }`,
  lenticular: `void main(){ vec3 a=texture2D(uTex,vUv).rgb; float l=luma(a); vec3 b=mix(vec3(0.03,0.05,0.12),vec3(0.55,0.7,1.0),pow(l,1.6))+vec3(1.0,0.75,0.3)*pow(max(0.0,l-0.75)*4.0,2.0);
    float s=fract(vUv.x*70.0); float k=clamp(0.5+uTilt.x*1.4,0.0,1.0); float m=smoothstep(k-0.08,k+0.08,s); vec3 c=mix(a,b,m); gl_FragColor=vec4(c,1.0);
    #include <colorspace_fragment>
  }`,
  latent: `void main(){ vec3 t=texture2D(uTex,vUv).rgb; float l=luma(t); float d=distance(vUv*vec2(1.0,1.4),uPointer*vec2(1.0,1.4)); float dev=smoothstep(0.42,0.06,d);
    vec3 safe=vec3(0.11,0.05,0.04)+vec3(0.26,0.09,0.06)*l; vec3 c=mix(safe,t,dev)+vec3(0.5,0.1,0.05)*pow(dev,3.0)*0.12; gl_FragColor=vec4(c,1.0);
    #include <colorspace_fragment>
  }`,
  thermal: `void main(){ vec3 t=texture2D(uTex,vUv).rgb; float l=luma(t); float d=distance(vUv,uPointer); float warm=clamp(l+0.25*exp(-d*d*18.0)-0.1,0.0,1.0);
    vec3 c=warm<0.25?mix(vec3(0.02,0.0,0.12),vec3(0.1,0.1,0.6),warm/0.25):warm<0.5?mix(vec3(0.1,0.1,0.6),vec3(0.0,0.75,0.55),(warm-0.25)/0.25):warm<0.75?mix(vec3(0.0,0.75,0.55),vec3(1.0,0.85,0.1),(warm-0.5)/0.25):mix(vec3(1.0,0.85,0.1),vec3(1.0,1.0,0.95),(warm-0.75)/0.25);
    float scan=0.92+0.08*smoothstep(0.0,0.02,abs(fract(uTime*0.25)-vUv.y)); float cross=max(step(abs(vUv.x-uPointer.x),0.0025),step(abs(vUv.y-uPointer.y),0.0035))*smoothstep(0.12,0.05,d);
    gl_FragColor=vec4(mix(c*scan,vec3(1.0),cross*0.8),1.0);
    #include <colorspace_fragment>
  }`,
};
const ADDITIVE = { foil: 1, etch: 1, glitter: 1 };

/* ---------- the hover glow per finish, and the variant tells (Flip and Glow page) ----------
   The glow says the finish or the variant, never the tier. kind: steady | cycle | sparkle | pulse | cold | hot. */
export const GLOWS = {
  matte:      { color: 0xffe1bd, color2: 0xfff5e8, kind: 'steady',  flicker: 0 },
  foil:       { color: 0xff5fa8, color2: 0x4fd8ff, kind: 'cycle',   flicker: 0 },
  etch:       { color: 0xa9edff, color2: 0xf2fdff, kind: 'steady',  flicker: 0.18 },
  glitter:    { color: 0xffe08a, color2: 0xffffff, kind: 'sparkle', flicker: 0 },
  gold:       { color: 0xd9962a, color2: 0xffd58a, kind: 'steady',  flicker: 0 },
  prism:      { color: 0xff3fd0, color2: 0x8a4cff, kind: 'cycle',   flicker: 0 },
  chrome:     { color: 0xd8e4f0, color2: 0xffffff, kind: 'steady',  flicker: 0 },
  lenticular: { color: 0x7fb0ff, color2: 0xffd27a, kind: 'cycle',   flicker: 0 },
  latent:     { color: 0xff2a1a, color2: 0x5a0e08, kind: 'steady',  flicker: 0.1 },
  thermal:    { color: 0xff9a1a, color2: 0x2a1aff, kind: 'cycle',   flicker: 0 },
};
export const VARIANT_GLOWS = {
  negative: { color: 0x7fd0ff, color2: 0xdcf3ff, kind: 'cold',   flicker: 0 },
  clear:    { color: 0xd8eef8, color2: 0xffffff, kind: 'cold',   flicker: 0.08 },
  misprint: { color: 0xff5a2a, color2: 0xffb060, kind: 'hot',    flicker: 0.3 },
  full:     { color: 0xffb347, color2: 0xffe3b0, kind: 'steady', flicker: 0 },
  stamped:  { color: 0xe3ad57, color2: 0xfff1cc, kind: 'pulse',  flicker: 0 },
};

/* ---------- shared textures (one per page) ---------- */
const TEX = {};
function radial(stops, size) { const key = 'r' + stops.join('|') + (size || 256); if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = c.height = size || 256; const g = c.getContext('2d'), gr = g.createRadialGradient(c.width / 2, c.width / 2, 0, c.width / 2, c.width / 2, c.width / 2); stops.forEach(s => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.width);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; TEX[key] = t; return t; }
/* the corona and starburst: wedges of light fading out from the centre */
function raysTex(n) { const key = 'rays' + n; if (TEX[key]) return TEX[key]; const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.translate(256, 256);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.random() * 0.1, w = 0.03 + Math.random() * 0.07; g.fillStyle = 'rgba(255,255,255,' + (0.25 + Math.random() * 0.5) + ')'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - w) * 300, Math.sin(a - w) * 300); g.lineTo(Math.cos(a + w) * 300, Math.sin(a + w) * 300); g.closePath(); g.fill(); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; const gr = g.createRadialGradient(256, 256, 16, 256, 256, 256); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; TEX[key] = t; return t; }
const SOFT = () => radial([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']], 512);
const SPOT = () => radial([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']], 256);
/* the 1 OF 1 stamp: an inked rubber stamp, gold, with a double border */
function stampTex() { if (TEX.stamp) return TEX.stamp; const c = document.createElement('canvas'); c.width = 640; c.height = 256; const g = c.getContext('2d');
  g.strokeStyle = '#ffe2a0'; g.lineWidth = 10; g.strokeRect(18, 18, 604, 220); g.lineWidth = 3; g.strokeRect(40, 40, 560, 176);
  g.fillStyle = '#ffe2a0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 118px "Geist Mono", ui-monospace, monospace'; g.fillText('1 OF 1', 320, 118);
  g.font = '600 26px "Geist Mono", ui-monospace, monospace'; g.fillText('M Y T H I C', 320, 190);
  /* worn ink: speckle the stamp so it reads as pressed on, not printed */
  g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 2600; i++) { g.fillStyle = 'rgba(0,0,0,' + (0.2 + Math.random() * 0.6) + ')'; g.fillRect(Math.random() * 640, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; TEX.stamp = t; return t; }

/* ---------- glow planes: light in the print's plane, shaped by the distance to the print (Flip and Glow page) ---------- */
const GV = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const GH = `uniform float uTime; uniform float uH; uniform vec2 uCard; uniform vec2 uSize; uniform vec2 uOff; uniform float uWide; uniform float uNeg; uniform vec3 uCol; varying vec2 vUv;
  vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
  float sdRound(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }`;
const GF = {
  /* a rainbow halo sliding round the edge of the print; uNeg turns it to the orange and black of a negative */
  foil: `void main(){ vec2 p=(vUv-0.5)*uSize+uOff; float d=sdRound(p,uCard*0.5,0.03); float an=atan(p.y,p.x)/6.2832; float halo=exp(-max(d,0.0)*mix(5.5,2.2,uWide)); halo=halo*halo*0.9+halo*0.1; float band=fract(an*2.0-uTime*0.16+max(d,0.0)*0.5); vec3 c=mix(hue(band),vec3(1.0),0.12);
    if(uNeg>0.5){ float k=0.3+0.7*smoothstep(0.3,0.7,0.5+0.5*sin(band*18.85)); c=vec3(1.0,0.45,0.08)*k*0.7; }
    float a=halo*step(0.0,d)*uH*0.95; gl_FragColor=vec4(c,a);
    #include <colorspace_fragment> }`,
  /* pastel contour rings going out from the print like a tide */
  etch: `void main(){ vec2 p=(vUv-0.5)*uSize+uOff; float d=max(sdRound(p,uCard*0.5,0.03),0.0); float ph=d*30.0-uTime*2.4; float ring=smoothstep(0.82,1.0,sin(ph)); float fade=exp(-d*2.2)*(1.0-smoothstep(0.9,1.4,d)); float an=atan(p.y,p.x)/6.2832;
    vec3 c=mix(hue(fract(floor((ph+1.57)/6.2832)*0.19+an)),vec3(1.0),0.55); float a=ring*fade*uH*0.9*step(0.002,d); gl_FragColor=vec4(c,a*a*0.6+a*0.4);
    #include <colorspace_fragment> }`,
  /* a thin spectral ring with a chromatic fringe, the black inside it darker than the room */
  prism: `void main(){ vec2 p=(vUv-0.5)*uSize+uOff; float d=sdRound(p,uCard*0.5,0.03); float R=0.2; float f=0.014; float w=0.018; float rr=smoothstep(w,0.0,abs(d-R+f)); float gg=smoothstep(w,0.0,abs(d-R)); float bb=smoothstep(w,0.0,abs(d-R-f)); vec3 ring=vec3(rr,gg,bb); float ra=max(max(rr,gg),bb);
    float an=atan(p.y,p.x)/6.2832; vec3 spec=hue(fract(an*3.0+uTime*0.06)); vec3 col=mix(ring,spec*ra,0.35)*1.6; float dark=1.0-smoothstep(R,R+0.9,d); float a=uH*max(ra,dark*0.9); col=mix(vec3(0.0),col,clamp(ra*1.6,0.0,1.0)); gl_FragColor=vec4(col,a);
    #include <colorspace_fragment> }`,
  /* a glass caustic rippling on the ground round a clear print */
  caustic: `void main(){ vec2 p=(vUv-0.5)*uSize+uOff; float d=sdRound(p,uCard*0.5,0.03); vec2 q=p*5.5; float tt=uTime*0.7; float v=0.0; for(int n=0;n<3;n++){ float fn=float(n); q+=vec2(sin(q.y*1.6+tt+fn*1.7), cos(q.x*1.4-tt*0.8+fn*2.3))*0.4; v+=sin(q.x*2.2+tt*0.9+fn)*sin(q.y*2.0-tt*0.6); } float caus=pow(clamp(0.5+0.5*v/3.0,0.0,1.0),5.0)*2.2;
    float mask=exp(-max(d,0.0)*3.0)*step(0.0,d); mask=mask*mask; vec3 c=vec3(0.72,0.9,1.0); float a=clamp(caus,0.0,1.0)*mask*uH*0.95; gl_FragColor=vec4(c,a);
    #include <colorspace_fragment> }`,
  /* a dashed ring of sprocket holes round a negative */
  sprocket: `void main(){ vec2 p=(vUv-0.5)*uSize+uOff; float d=sdRound(p,uCard*0.5,0.03); float an=atan(p.y,p.x)/6.2832; float per=an*30.0+uTime*0.12; float dash=step(0.55,fract(per)); float ring=smoothstep(0.022,0.01,abs(d-0.13))*dash; vec3 c=vec3(1.0,0.72,0.38); gl_FragColor=vec4(c,ring*uH*0.95);
    #include <colorspace_fragment> }`,
  /* a soft glow in one colour, for the plain glows (matte paper, gold, the cold and hot tells) */
  soft: `void main(){ vec2 p=(vUv-0.5)*uSize+uOff; float d=sdRound(p,uCard*0.5,0.03); float halo=exp(-max(d,0.0)*mix(3.2,1.6,uWide)); halo=halo*halo*0.8+halo*0.2; float a=halo*step(0.0,d)*uH; gl_FragColor=vec4(uCol,a);
    #include <colorspace_fragment> }`,
};
/* the glow shaders were drawn for a 1.32 wide print, so everything is measured in those units */
function glowPlane(id, w, h, sx, sy, o = {}) { const n = 1.32 / w; const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), new THREE.ShaderMaterial({
  uniforms: { uTime: { value: Math.random() * 10 }, uH: { value: 0 }, uCard: { value: new THREE.Vector2(w * n, h * n) }, uSize: { value: new THREE.Vector2(sx * n, sy * n) }, uOff: { value: new THREE.Vector2() }, uWide: { value: o.wide ? 1 : 0 }, uNeg: { value: o.neg ? 1 : 0 }, uCol: { value: new THREE.Color(o.color || 0xffffff) } },
  vertexShader: GV, fragmentShader: GH + GF[id], transparent: true, depthWrite: false, blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending })); m.userData.noParticles = true; return m; }

/* a pass of light over the photograph itself: a bar that sweeps across and catches the photo's highlights
   (uHue 1 makes it a rainbow strip, the foil sweep) */
const SHEEN_FRAG = `uniform sampler2D uTex; uniform float uX; uniform float uW; uniform float uHue; uniform vec3 uCol; uniform float uA; varying vec2 vUv;
  vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
  void main(){ vec3 t=texture2D(uTex,vUv).rgb; float l=dot(t,vec3(0.299,0.587,0.114)); float d=(vUv.x+vUv.y*0.35)-uX; float bar=exp(-pow(d/uW,2.0));
    vec3 c=mix(uCol,hue(fract(d*2.5+0.5)),uHue); float a=bar*uA*(0.2+1.0*l); gl_FragColor=vec4(c*(0.6+0.8*l),clamp(a,0.0,1.0));
    #include <colorspace_fragment> }`;

/* ---------- sparks and embers: one Points cloud, every grain a flight from its own start time ---------- */
const PV = `attribute vec3 aVel; attribute vec3 aCol; attribute float aT0; attribute float aLife; attribute float aSize; attribute float aSeed;
  uniform float uTime; uniform vec3 uGrav; uniform float uSway; uniform float uEmber; varying float vA; varying vec3 vC;
  void main(){ float t=uTime-aT0; float k=clamp(t/aLife,0.0,1.0); vec3 p=position+aVel*t+0.5*uGrav*t*t; p.x+=sin(uTime*1.7+aSeed*20.0)*uSway*k; p.y+=cos(uTime*1.3+aSeed*31.0)*uSway*k;
    float spark=(1.0-k)*(1.0-k); float ember=smoothstep(0.0,0.15,k)*(1.0-smoothstep(0.55,1.0,k)); float a=mix(spark,ember,uEmber)*(0.7+0.3*sin(uTime*11.0+aSeed*50.0));
    vA=(t<0.0||k>=1.0)?0.0:a; vC=aCol; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=aSize*(160.0/max(1.0,-mv.z))*(0.6+0.4*(1.0-k)); gl_Position=projectionMatrix*mv; }`;
const PF = `varying float vA; varying vec3 vC; void main(){ vec2 q=gl_PointCoord-0.5; float d=length(q); if(d>0.5||vA<=0.0) discard; float a=(1.0-smoothstep(0.08,0.5,d))*vA; gl_FragColor=vec4(vC,a);
  #include <colorspace_fragment> }`;
function cloud(max, o = {}) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(max * 3), vel = new Float32Array(max * 3), col = new Float32Array(max * 3), t0 = new Float32Array(max).fill(-1e4), life = new Float32Array(max).fill(1), size = new Float32Array(max), seed = new Float32Array(max);
  for (let i = 0; i < max; i++) seed[i] = Math.random();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aT0', new THREE.BufferAttribute(t0, 1)); g.setAttribute('aLife', new THREE.BufferAttribute(life, 1)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e3);
  const u = { uTime: { value: 0 }, uGrav: { value: new THREE.Vector3() }, uSway: { value: o.sway || 0 }, uEmber: { value: o.ember ? 1 : 0 } };
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; pts.userData.noParticles = true;
  let head = 0;
  /* emit(n, at(i) → Vector3, vel(i) → Vector3, col(i) → Color, life, size) at the cloud's current uTime */
  pts.emit = (n, at, v, c, lf, sz) => { for (let i = 0; i < n; i++) { const k = head++ % max, p = at(i), d = v(i), cc = c(i); pos.set([p.x, p.y, p.z], k * 3); vel.set([d.x, d.y, d.z], k * 3); col.set([cc.r, cc.g, cc.b], k * 3); t0[k] = u.uTime.value; life[k] = lf * (0.6 + Math.random() * 0.8); size[k] = sz * (0.5 + Math.random()); }
    ['position', 'aVel', 'aCol', 'aT0', 'aLife', 'aSize'].forEach(a => { g.attributes[a].needsUpdate = true; }); };
  pts.u = u; return pts;
}

/* a readable copy of the photograph, so sparks and embers can take its colours */
const PIX = new WeakMap();
function photoPixels(obj) { const map = obj && obj.parts && obj.parts.photo && obj.parts.photo.material && obj.parts.photo.material.map; if (!map || !map.image) return null; if (PIX.has(map)) return PIX.get(map);
  let out = null; try { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.drawImage(map.image, 0, 0, 32, 32); out = g.getImageData(0, 0, 32, 32).data; } catch (e) { out = null; } PIX.set(map, out); return out; }

const CANCEL = { cancelled: true };
/* ---------- a rig: a frame copied from the print (local +z is its face), the tweens that drive it, and its cleanup ---------- */
function makeRig(S, obj, kind) {
  const T = S.T, g = obj.group; g.updateMatrixWorld(true);
  const fx = new THREE.Group(); g.getWorldPosition(fx.position); g.getWorldQuaternion(fx.quaternion); const k = g.getWorldScale(new THREE.Vector3()).x || 1; fx.scale.setScalar(k); fx.userData.noParticles = true; S.scene.add(fx);
  const w = obj.w || 2.9, h = obj.h || 3.9, th = obj.th || 0.03, cam = S.camera;
  const tickers = [], beats = [], undo = [], screens = [];
  const R = { fx, k, w, h, th, t: 0, kind, alive: true,
    /* a thin slice below the back of the print (on the table when it lies there) and one just over its face */
    below: -th / 2 - 0.0012 / k, above: th / 2 + 0.012 / k,
    down: new THREE.Vector3(0, -1, 0).applyQuaternion(fx.quaternion.clone().invert()).divideScalar(k),
    add(m, z) { if (z !== undefined) m.position.z = z; m.traverse(x => { if (x.material) [].concat(x.material).forEach(mt => { mt.depthTest = false; }); if (!x.renderOrder) x.renderOrder = z !== undefined && z < 0 ? 18 : 28; }); fx.add(m); return m; },
    /* the lights go down: a dark screen over the room with the print drawn on top of it (setTop), so light reads on the light table's white top; dim(0) brings them back */
    dim(amount) { if (!R.dimM) { R.dimM = R.screen(0x000000, false, 16); R.dimWant = 0; if (obj.setTop) { try { obj.setTop(true); } catch (e) {} R.undo(() => { try { obj.setTop(false); } catch (e) {} }); }
        R.tick((t, dt) => { const m = R.dimM.material; m.opacity += (R.dimWant - m.opacity) * (1 - Math.exp(-dt * (R.dimWant > m.opacity ? 9 : 5))); }); } R.dimWant = amount; },
    tick(fn) { tickers.push(fn); return fn; },
    untick(fn) { const i = tickers.indexOf(fn); if (i >= 0) tickers.splice(i, 1); },
    at(t, fn) { beats.push({ t, fn }); },
    undo(fn) { undo.push(fn); },
    /* run a tween of dur seconds on the holo clock; fn(raw 0..1, dt, eased). Throws CANCEL when the tween is cancelled from outside. */
    run(dur, fn, ease) { let last = T.time(); return T.tween({ dur, ease: ease || T.E.linear, tag: 'holo', update: (e, raw) => { const now = T.time(), dt = Math.max(0, now - last); last = now; R.t += dt; S.holo.now = { kind, tier: R.tier, t: R.t, rig: R };
        try { if (fn) fn(raw, dt, e); tickers.slice().forEach(f => f(R.t, dt)); for (let i = beats.length - 1; i >= 0; i--) if (R.t >= beats[i].t) { const b = beats.splice(i, 1)[0]; b.fn(); } } catch (err) { console.error(err); } } }).then(ok => { if (!ok) throw CANCEL; return true; }); },
    wait(s) { return R.run(s); },
    /* a full-screen plane in front of the camera (the blackout, the white flash) */
    screen(color, additive, order) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })); m.renderOrder = order || 60;
      const hh = 2 * 1.5 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.05; m.position.z = -1.5; m.scale.set(hh * cam.aspect, hh, 1); m.userData.noParticles = true; cam.add(m); screens.push(m); return m; },
    /* a shock ring in the print's plane, expanding and fading */
    shock(color, r0, speed, z) { const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 72), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.scale.setScalar(r0); R.add(m, z ?? R.above + 0.02 / k);
      const f = R.tick((t, dt) => { m.scale.addScalar(dt * speed * m.material.opacity); m.material.opacity *= Math.exp(-dt * 2.6); if (m.material.opacity < 0.02) { R.untick(f); fx.remove(m); m.geometry.dispose(); m.material.dispose(); } }); return m; },
    /* the white flash: a screen that blooms at once and decays */
    flash(amount, color) { if (!R.flashM) { R.flashM = R.screen(0xffffff, true, 61); R.tick((t, dt) => { R.flashM.material.opacity *= Math.exp(-dt * 5.5); }); } R.flashM.material.color.set(color || 0xffffff); R.flashM.material.opacity = Math.max(R.flashM.material.opacity, amount); },
    /* a jolt: the print jumps in place and settles, and the camera lurches a touch (S.cam targets, restored; the stored stack is never touched) */
    jolt(amount) { const rest = g.position.clone(), t0 = R.t, c = S.ctx && S.ctx.cam; const dur = 0.45;
      const f = R.tick(t => { const u = (t - t0) / dur; if (u >= 1) { g.position.copy(rest); R.untick(f); return; } const d = amount * (1 - u) * (1 - u); g.position.set(rest.x + (Math.random() - 0.5) * d, rest.y + Math.random() * d * 0.6, rest.z + (Math.random() - 0.5) * d); });
      R.undo(() => { g.position.copy(rest); });
      if (c && S.cam && S.cam.set) { const tx = c.tx, tz = c.tz, nx = tx + amount * 0.3, nz = tz + amount * 0.18; S.cam.set({ tx: nx, tz: nz }); const back = () => { if (c.tx === nx) S.cam.set({ tx }); if (c.tz === nz) S.cam.set({ tz }); }; R.at(R.t + 0.1, back); R.undo(back); } },
    /* a cloud of sparks or embers in the rig's frame; gravity is the world's, turned into print space */
    cloud(max, o) { const c = cloud(max, o); c.u.uGrav.value.copy(R.down).multiplyScalar(o && o.grav !== undefined ? o.grav : 2.5); R.add(c, 0); R.tick((t, dt) => { c.u.uTime.value += dt; }); return c; },
    /* a colour from the photograph (brightened, pushed towards tint), or the tint when there is no photo */
    photoColor(tint, mixTo) { const px = photoPixels(obj), c = new THREE.Color(); if (px) { const i = Math.floor(Math.random() * 1024) * 4; c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, THREE.SRGBColorSpace); const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; c.lerp(new THREE.Color(0xffffff), 0.1 + 0.25 * (1 - l)); } else c.set(0xffffff); if (tint) c.lerp(tint, mixTo ?? 0.45); return c; },
    /* a point on the print's face */
    onPrint(spread) { const s = spread ?? 1; return new THREE.Vector3((Math.random() - 0.5) * w * s, (Math.random() - 0.5) * h * s, th / 2 + 0.01 / k); },
    /* the sheen plane over the photograph itself, uv-matched to it */
    sheen(o = {}) { const ph = obj.parts && obj.parts.photo, map = ph && ph.material && ph.material.map; if (!ph || !map) return null;
      const geo = ph.geometry.clone(); const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: { uTex: { value: map }, uX: { value: -0.5 }, uW: { value: o.width || 0.16 }, uHue: { value: o.hue ? 1 : 0 }, uCol: { value: new THREE.Color(o.color || 0xffffff) }, uA: { value: o.amount ?? 0.6 } }, vertexShader: GV, fragmentShader: SHEEN_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.copy(ph.position); if (obj.inner) m.position.applyMatrix4(obj.inner.matrix); m.position.z = R.above + 0.004 / k; m.quaternion.copy(ph.quaternion); m.scale.copy(ph.scale); m.renderOrder = 28; m.material.depthTest = false; m.userData.noParticles = true; fx.add(m); return m; },
    /* roll the finish's own light across the print: obj.tilt swings so the foil, gold or prism catches it */
    roll(from, to, amp) { if (!obj.tilt) return; obj.tilt.set(-amp, 0); const f = R.tick(t => { if (t < from) return; const u = Math.min(1, (t - from) / (to - from)); const s = Math.sin(u * Math.PI); obj.tilt.set(-amp + 2 * amp * u, amp * 0.5 * s); if (u >= 1) { obj.tilt.set(0, 0); R.untick(f); } }); R.undo(() => { if (obj.tilt) obj.tilt.set(0, 0); }); },
    dispose() { if (!R.alive) return; R.alive = false; undo.slice().reverse().forEach(f => { try { f(); } catch (e) {} }); screens.forEach(m => { cam.remove(m); m.geometry.dispose(); m.material.dispose(); });
      fx.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) [].concat(m.material).forEach(mt => mt.dispose()); }); S.scene.remove(fx); if (S.holo.now && S.holo.now.rig === R) S.holo.now = null; },
  };
  return R;
}

/* ---------- the landings, one per tier (The Pull page) ---------- */
const LAND = {
  /* common: a settle. The paper breathes a warm glow and one soft pass of light crosses the print. */
  async common(R, obj, col, snd) {
    const paper = R.add(glowPlane('soft', R.w, R.h, R.w * 2.0, R.h * 1.8, { color: 0xffe1bd }), R.below); const sh = R.sheen({ color: 0xfff4e4, amount: 0.55, width: 0.14 });
    snd('chime', { tier: 'common' }); R.dim(0.4); R.at(0.9, () => R.dim(0));
    R.tick(t => { const u = Math.min(1, t / 1.3); paper.material.uniforms.uH.value = 0.55 * Math.sin(u * Math.PI); paper.material.uniforms.uTime.value = t; if (sh) sh.material.uniforms.uX.value = -0.4 + 2.0 * Math.min(1, t / 0.9); });
    await R.wait(1.4);
  },
  /* uncommon: a foil sweep. A rainbow halo comes up round the print while a rainbow bar sweeps across the photo and the foil rolls with it. */
  async uncommon(R, obj, col, snd) {
    const halo = R.add(glowPlane('foil', R.w, R.h, R.w * 2.2, R.h * 2.0), R.below); const sh = R.sheen({ hue: true, amount: 0.75, width: 0.13 });
    snd('chime', { tier: 'uncommon' }); R.roll(0.1, 1.3, 1.0); R.dim(0.55); R.at(1.4, () => R.dim(0));
    R.tick(t => { const u = Math.min(1, t / 1.9); halo.material.uniforms.uH.value = Math.sin(u * Math.PI); halo.material.uniforms.uTime.value = t * 2.5; if (sh) sh.material.uniforms.uX.value = -0.4 + 2.0 * Math.min(1, Math.max(0, (t - 0.1) / 1.1)); });
    await R.wait(2.0);
  },
  /* rare: a spin of light rings and glints. Etch contours run out from the print like a tide, two rings of light orbit it and glints fly. */
  async rare(R, obj, col, snd) {
    const etch = R.add(glowPlane('etch', R.w, R.h, R.w * 2.4, R.h * 2.2), R.below); const sp = R.cloud(200, { grav: 1.6 });
    const orbit = new THREE.Group(); R.add(orbit, R.above + 0.08 / R.k); const rr = Math.hypot(R.w, R.h) * 0.62;
    const rings = [0, 1].map(i => { const m = new THREE.Mesh(new THREE.RingGeometry(rr * 0.985, rr, 96), new THREE.MeshBasicMaterial({ color: i ? 0xffffff : col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.rotation.x = i ? 0.22 : -0.18; m.rotation.y = i ? -0.15 : 0.2; orbit.add(m); return m; });
    snd('chime', { tier: 'rare' }); R.roll(0.2, 1.6, 0.8); R.dim(0.65); R.at(1.8, () => R.dim(0));
    const glint = () => { const tint = new THREE.Color(col); sp.emit(90, () => R.onPrint(0.9), () => { const a = Math.random() * Math.PI * 2, s = (0.5 + Math.random()) * R.w * 0.6; return new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s, (1.0 + Math.random() * 1.6) * R.w * 0.5); }, () => R.photoColor(tint, 0.3), 1.0, 0.55 * R.w / 2.9); };
    R.at(0.45, glint); R.at(1.1, glint);
    R.tick((t, dt) => { const u = Math.min(1, t / 2.3); etch.material.uniforms.uH.value = Math.sin(u * Math.PI); etch.material.uniforms.uTime.value = t; orbit.rotation.z += dt * 2.4; rings.forEach((m, i) => { m.material.opacity = 0.75 * Math.sin(u * Math.PI); const s = 0.55 + 0.6 * Math.min(1, t / 0.9) + i * 0.12; m.scale.setScalar(s); }); });
    await R.wait(2.4);
  },
  /* epic: a starburst behind the print, a spray of sparks in the photo's colours and the tier colour flooding the table. */
  async epic(R, obj, col, snd) {
    const tint = new THREE.Color(col), tint2 = tint.clone().lerp(new THREE.Color(0xffffff), 0.5);
    const flood = R.add(new THREE.Mesh(new THREE.PlaneGeometry(R.w * 5, R.w * 5), new THREE.MeshBasicMaterial({ map: SOFT(), color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })), R.below - 0.0006 / R.k);
    const rays = R.add(new THREE.Mesh(new THREE.PlaneGeometry(R.w * 3.2, R.w * 3.2), new THREE.MeshBasicMaterial({ map: raysTex(28), color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })), R.below);
    const rays2 = R.add(new THREE.Mesh(rays.geometry, rays.material.clone()), R.below + 0.0003 / R.k); rays2.material.map = raysTex(20); rays2.material.color.copy(tint2); rays2.rotation.z = 1.1;
    const sp = R.cloud(400, { grav: 2.8 }); const sh = R.sheen({ color: tint2, amount: 0.5, width: 0.12 });
    snd('chime', { tier: 'epic' }); R.roll(0.3, 1.9, 1.0); R.dim(0.72); R.at(2.3, () => R.dim(0));
    R.at(0.35, () => { R.shock(tint2, 0.5, R.w * 2.4); sp.emit(260, () => R.onPrint(0.95), () => { const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * R.w * 1.1; return new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s, (0.8 + Math.random() * 1.6) * R.w * 0.6); }, () => R.photoColor(tint, 0.4), 1.1, 0.6 * R.w / 2.9); });
    R.tick((t, dt) => { const k = Math.min(1, Math.max(0, (t - 0.1) / 0.9)), out = 1 - Math.min(1, Math.max(0, (t - 2.1) / 0.8)), e = k * k * (3 - 2 * k);
      rays.material.opacity = 0.6 * e * out; rays2.material.opacity = 0.35 * e * out; rays.rotation.z += dt * 0.3; rays2.rotation.z -= dt * 0.22; const s = 0.5 + 1.0 * e; rays.scale.setScalar(s); rays2.scale.setScalar(s * 1.3);
      flood.material.opacity = 0.5 * e * out; flood.scale.setScalar(0.4 + 0.9 * e); if (sh) sh.material.uniforms.uX.value = -0.4 + 2.0 * Math.min(1, Math.max(0, (t - 0.4) / 1.0)); });
    await R.wait(3.0);
  },
  /* legendary: slow motion through the first beat, a gold flood, a rolling shine on the gold, embers rising off the print, then the slam. */
  async legendary(R, obj, col, snd) {
    const T = R.S.T, gold = new THREE.Color(0xffc46a), hot = new THREE.Color(0xff7a2a);
    const prev = T.timeScale(), slow = prev * 0.35; T.setTimeScale(slow); let restored = false; const restore = () => { if (restored) return; restored = true; if (T.timeScale() === slow) T.setTimeScale(prev); }; R.undo(restore);
    const flood = R.add(new THREE.Mesh(new THREE.PlaneGeometry(R.w * 5.5, R.w * 5.5), new THREE.MeshBasicMaterial({ map: SOFT(), color: gold, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })), R.below - 0.0006 / R.k);
    const rays = R.add(new THREE.Mesh(new THREE.PlaneGeometry(R.w * 3.6, R.w * 3.6), new THREE.MeshBasicMaterial({ map: raysTex(32), color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })), R.below);
    const embers = R.cloud(900, { grav: -0.25, sway: R.w * 0.05, ember: true }), sp = R.cloud(500, { grav: 1.2 }); const sh = R.sheen({ color: 0xfff0c8, amount: 0.7, width: 0.18 });
    snd('chime', { tier: 'legendary' }); R.roll(0.2, 2.2, 1.0); R.dim(0.78); R.at(3.2, () => R.dim(0));
    R.at(1.3, restore);
    R.at(1.75, () => { snd('slam'); R.shock(gold, 0.45, R.w * 2.6); R.flash(0.35, 0xfff1d6); R.jolt(R.w * 0.06 * R.k);
      sp.emit(400, () => R.onPrint(1.0), () => { const a = Math.random() * Math.PI * 2, s = (0.3 + Math.random()) * R.w * 0.5; return new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s, (1.2 + Math.random() * 2.0) * R.w * 0.5); }, () => R.photoColor(hot, 0.5), 2.2, 0.55 * R.w / 2.9); });
    let acc = 0;
    R.tick((t, dt) => { const k = Math.min(1, Math.max(0, (t - 0.05) / 0.9)), out = 1 - Math.min(1, Math.max(0, (t - 3.0) / 1.0)), e = k * k * (3 - 2 * k);
      flood.material.opacity = 0.75 * e * out; flood.scale.setScalar(0.4 + 1.0 * e); rays.material.opacity = 0.45 * e * out; rays.rotation.z += dt * 0.2; rays.scale.setScalar(0.6 + 0.9 * e);
      if (sh) sh.material.uniforms.uX.value = -0.4 + 2.0 * Math.min(1, Math.max(0, (t - 0.3) / 1.6));
      /* embers lift off the gold the whole way through, thicker in the slow first beat */
      acc += dt * (t < 3.0 ? 110 : 0) * out; const n = Math.floor(acc); if (n > 0) { acc -= n; embers.emit(n, () => R.onPrint(1.0), () => new THREE.Vector3((Math.random() - 0.5) * R.w * 0.12, (Math.random() - 0.5) * R.w * 0.12, (0.35 + Math.random() * 0.5) * R.w * 0.45), () => R.photoColor(Math.random() < 0.5 ? gold : hot, 0.55), 2.4, 0.42 * R.w / 2.9); } });
    await R.wait(4.0);
  },
  /* mythic: blackout, nothing but a hum, then the eclipse corona rises behind the print, the 1 OF 1 stamp slams on and the screen goes white. */
  async mythic(R, obj, col, snd) {
    const black = R.screen(0x000000, false, 60); let hum = null; try { hum = R.S.snd && R.S.snd.loop ? R.S.snd.loop('hum') : null; } catch (e) { hum = null; } const stopHum = () => { try { if (hum && hum.stop) hum.stop(); } catch (e) {} hum = null; }; R.undo(stopHum);
    const ecl = new THREE.Group(); R.add(ecl, R.below); ecl.visible = false; const rr = Math.hypot(R.w, R.h) * 0.56;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(rr, 96), new THREE.MeshBasicMaterial({ color: 0x000000 })); disc.position.z = 0.0003 / R.k; ecl.add(disc);
    const corona = new THREE.Mesh(new THREE.PlaneGeometry(rr * 4.4, rr * 4.4), new THREE.MeshBasicMaterial({ map: raysTex(28), color: 0xffe8b0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); ecl.add(corona);
    const corona2 = new THREE.Mesh(corona.geometry, corona.material.clone()); corona2.material.map = raysTex(22); corona2.material.color.set(0xffc46a); corona2.scale.setScalar(0.8); corona2.position.z = 0.0001 / R.k; ecl.add(corona2);
    const rim = new THREE.Mesh(new THREE.RingGeometry(rr * 0.98, rr * 1.06, 128), new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending })); rim.position.z = 0.0005 / R.k; ecl.add(rim);
    const stamp = new THREE.Mesh(new THREE.PlaneGeometry(R.w * 0.78, R.w * 0.78 * 0.4), new THREE.MeshBasicMaterial({ map: stampTex(), transparent: true, opacity: 0, depthWrite: false, depthTest: false })); stamp.rotation.z = -0.09; stamp.renderOrder = 30; R.add(stamp, R.above + 0.05 / R.k); stamp.position.y = -R.h * 0.12;
    const sp = R.cloud(600, { grav: 0.8 });
    snd('chime', { tier: 'mythic' }); R.dim(0.85); R.at(4.7, () => R.dim(0));
    R.at(1.0, () => { ecl.visible = true; });
    R.at(1.75, stopHum);
    R.at(2.45, () => { snd('slam'); R.flash(0.9, 0xffffff); R.shock(0xffe9b8, 0.5, R.w * 2.8); R.jolt(R.w * 0.05 * R.k); R.roll(2.45, 4.0, 0.6);
      sp.emit(500, () => R.onPrint(1.0), () => { const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * R.w * 1.0; return new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s, (0.6 + Math.random() * 1.4) * R.w * 0.5); }, () => R.photoColor(new THREE.Color(0xffe2a0), 0.6), 1.8, 0.5 * R.w / 2.9); });
    R.tick((t, dt) => { black.material.opacity = t < 0.15 ? t / 0.15 : t < 1.05 ? 1 : t < 1.75 ? 1 - (t - 1.05) / 0.7 : 0;
      if (ecl.visible) { const k = Math.min(1, (t - 1.0) / 1.3), e = k * k * (3 - 2 * k), out = 1 - Math.min(1, Math.max(0, (t - 4.6) / 0.9)); ecl.scale.setScalar(0.1 + 0.9 * e); corona.rotation.z += dt * 0.12; corona2.rotation.z -= dt * 0.08; corona.material.opacity = 0.9 * out; corona2.material.opacity = 0.9 * out; rim.material.opacity = out; disc.material.opacity = out; disc.material.transparent = out < 1; }
      const s = Math.min(1, Math.max(0, (t - 2.45) / 0.22)), sb = R.S.T.E.outBack(s), sOut = 1 - Math.min(1, Math.max(0, (t - 4.6) / 0.6)); stamp.material.opacity = s * sOut; stamp.scale.setScalar(Math.max(0.001, 2.6 - 1.6 * sb)); });
    await R.wait(5.4);
  },
};

export function install(S) {
  const make = id => ctx => new THREE.Mesh(new THREE.PlaneGeometry(ctx.w, ctx.h), new THREE.ShaderMaterial({
    uniforms: { uTex: { value: ctx.photoTex }, uTilt: { value: new THREE.Vector2() }, uPointer: { value: new THREE.Vector2(0.5, 0.5) }, uTime: { value: Math.random() * 100 }, uTier: { value: new THREE.Color(ctx.tier.color) } },
    vertexShader: VERT, fragmentShader: HEAD + FRAGS[id], transparent: true, depthWrite: false, blending: ADDITIVE[id] ? THREE.AdditiveBlending : THREE.NormalBlending }));
  const update = (m, c) => { const u = m.material.uniforms; u.uTilt.value.copy(c.tilt); u.uPointer.value.copy(c.pointer); u.uTime.value += c.dt; };
  Object.keys(FRAGS).forEach(id => S.SM.registerFinish(id, { make: make(id), update }));

  const snd = (id, o) => { try { return S.snd && S.snd.play ? S.snd.play(id, o) : null; } catch (e) { return null; } };
  const slabOf = x => x && x.slab && x.group ? x.slab : x;
  const H = S.holo = { GLOWS, VARIANT_GLOWS, now: null,
    /* the glow a face-down print shows on hover: the finish's colour and character, the variant's over it; never the tier */
    glowOf(x) { const slab = slabOf(x) || {}; const fin = S.SL.finishOf(slab, S.testFinish ? S.testFinish() : null); const base = (slab.variant && VARIANT_GLOWS[slab.variant]) || GLOWS[fin] || { color: 0xe8e8ee, color2: 0xffffff, kind: 'steady', flicker: 0 };
      return { color: new THREE.Color(base.color), color2: new THREE.Color(base.color2), kind: base.kind, flicker: base.flicker || 0, finish: fin, variant: slab.variant || null }; },
    /* a hover glow rig in the print's plane, in the finish's own light (foil halo, etch tide, glitter twinkles, gold embers, prism ring, the tells).
       { group, set(amount), update(dt), dispose() }: the caller calls update each frame and set with the hover amount; the group follows obj. */
    glow(obj) { const g = H.glowOf(obj), fx = new THREE.Group(); fx.userData.noParticles = true; S.scene.add(fx); const w = obj.w || 2.9, h = obj.h || 3.9, parts = [], v = g.variant, fin = g.finish; let want = 0, cur = 0, t = Math.random() * 10, cl = null;
      const add = (id, o) => { const m = glowPlane(id, w, h, w * 2.2, h * 2.0, o); m.position.z = -(obj.th || 0.03) / 2 - 0.002; fx.add(m); parts.push(m); return m; };
      if (v === 'negative') { add('foil', { neg: true }); add('sprocket'); } else if (v === 'clear') { add('soft', { color: g.color }).userData.gain = 0.35; add('caustic'); } else if (v === 'misprint') { add('foil').userData.gain = 0.7; const tw = add('foil'); tw.userData.jitter = true; tw.position.z -= 0.001; }
      else if (v === 'full') { add('foil', { wide: true }); } else if (v === 'stamped') { add('soft', { color: g.color }); const s = add('soft', { color: 0xffd98a }); s.scale.setScalar(0.3); s.position.set(w / 2 - 0.1, h / 2 - 0.1, s.position.z + 0.0005); s.userData.pulse = true; }
      else if (fin === 'foil') add('foil'); else if (fin === 'etch') add('etch'); else if (fin === 'prism') add('prism', { normal: true }); else add('soft', { color: g.color, wide: fin === 'gold' }).userData.gain = fin === 'matte' ? 0.5 : 0.8;
      if (!v && (fin === 'glitter' || fin === 'gold')) { cl = cloud(fin === 'gold' ? 120 : 160, fin === 'gold' ? { ember: true, sway: 0.04, grav: 0 } : { grav: 0 }); cl.u.uGrav.value.set(0, 0, fin === 'gold' ? 0.08 : 0); fx.add(cl); }
      let acc = 0; const rig = { group: fx, glow: g, set(a) { want = Math.max(0, Math.min(1, a)); },
        update(dt) { obj.group.updateMatrixWorld(true); obj.group.getWorldPosition(fx.position); obj.group.getWorldQuaternion(fx.quaternion); fx.scale.setScalar(obj.group.getWorldScale(new THREE.Vector3()).x || 1); t += dt; cur += (want - cur) * (1 - Math.exp(-dt * 7));
          const fl = g.flicker ? 1 - g.flicker * (0.5 + 0.5 * Math.sin(t * 37) * Math.sin(t * 11.3)) : 1, pulse = g.kind === 'pulse' ? 0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.4), 2) : 1;
          parts.forEach(m => { const u = m.material.uniforms; u.uTime.value = t; u.uH.value = cur * (m.userData.gain || 1) * fl * (m.userData.pulse ? pulse : 1); if (m.userData.jitter && Math.random() < 0.3) u.uOff.value.set(0.06 + Math.random() * 0.12, -(0.03 + Math.random() * 0.1)); });
          if (cl) { cl.u.uTime.value += dt; acc += dt * cur * (fin === 'gold' ? 26 : 40); const n = Math.floor(acc); if (n > 0) { acc -= n; cl.emit(n, () => fin === 'gold' ? new THREE.Vector3((Math.random() - 0.5) * w * 1.3, -h * 0.55 + Math.random() * h * 0.2, -0.02) : (() => { const a = Math.random() * Math.PI * 2, r = (0.6 + Math.random() * 0.7) * Math.hypot(w, h) * 0.5; return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.8, -0.02); })(),
            () => fin === 'gold' ? new THREE.Vector3(0, h * (0.25 + Math.random() * 0.2), 0) : new THREE.Vector3(0, 0, 0), () => new THREE.Color(fin === 'gold' ? (Math.random() < 0.5 ? 0xffb050 : 0xffe0a0) : 0xffffff).lerp(g.color2, 0.3), fin === 'gold' ? 2.6 : 1.4, fin === 'gold' ? 0.4 : 0.32); } } },
        dispose() { fx.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); S.scene.remove(fx); } };
      return rig; },
    /* the edge-on moment of the flip: a plane of light along the print's edge and a radial flash that bloom and fade in about 0.35 s */
    async burst(obj, o = {}) { if (!obj || !obj.group) return; const R = makeRig(S, obj, 'burst'); R.S = S; R.tier = (obj.slab || {}).tier; S.holo.now = { kind: 'burst', tier: R.tier, t: 0, rig: R };
      const col = new THREE.Color(o.color || H.glowOf(obj).color), pale = col.clone().lerp(new THREE.Color(0xffffff), 0.65);
      try {
        const edge = R.add(new THREE.Mesh(new THREE.PlaneGeometry(R.w * 0.55, R.h * 1.3), new THREE.MeshBasicMaterial({ map: SOFT(), color: pale, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })), 0); edge.rotation.y = Math.PI / 2; edge.renderOrder = 25;
        const core = R.add(new THREE.Mesh(new THREE.PlaneGeometry(R.w * 0.16, R.h * 1.1), new THREE.MeshBasicMaterial({ map: SOFT(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })), 0); core.rotation.y = Math.PI / 2; core.renderOrder = 26;
        const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPOT(), color: pale, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); flash.renderOrder = 24; R.add(flash, 0);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT(), color: col, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); glow.renderOrder = 23; R.add(glow, 0);
        const sp = R.cloud(120, { grav: 2.0 }); sp.emit(70, () => new THREE.Vector3(0, (Math.random() - 0.5) * R.h, 0), () => new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 2.4).multiplyScalar(R.w * 0.5), () => R.photoColor(pale, 0.6), 0.7, 0.45 * R.w / 2.9);
        snd('burst', { tier: R.tier }); if (o.dim) { R.dim(o.dim); R.at(0.25, () => R.dim(0)); }
        await R.run(o.dur || 0.42, raw => { const b = Math.exp(-Math.pow((raw - 0.22) / 0.2, 2)), tail = Math.exp(-raw * 3.5); edge.material.opacity = Math.max(b, tail * 0.35); core.material.opacity = b; edge.scale.set(1 + 0.6 * raw, 1 + 0.15 * raw, 1);
          flash.material.opacity = b * 0.95; const fs = R.w * (1.0 + 1.6 * raw); flash.scale.set(fs, fs, 1); glow.material.opacity = Math.max(b * 0.6, tail * 0.3); const gs = R.w * (1.6 + 1.8 * raw); glow.scale.set(gs, gs * 0.8, 1); });
      } catch (e) { if (e !== CANCEL) console.error(e); } finally { R.dispose(); }
    },
    /* the landing after the flip: the print lies face up in the world and the tier decides how big a moment it is */
    async reveal(obj, o = {}) { if (!obj || !obj.group) return; const tier = o.tier || (obj.slab || {}).tier || 'common', land = LAND[tier] || LAND.common, col = (TIER[tier] || TIER.common).color;
      const R = makeRig(S, obj, 'reveal'); R.S = S; R.tier = tier; S.holo.now = { kind: 'reveal', tier, t: 0, rig: R };
      try { await land(R, obj, col, snd); } catch (e) { if (e !== CANCEL) console.error(e); } finally { R.dispose(); } },
    /* stop every holo effect now (the rail closing): the tweens resolve false and each rig cleans itself up */
    cancel() { S.T.cancelAll('holo'); },
    active() { return S.T.running('holo'); },
  };
}
/* the rarity reveal around a fresh pull, for callers that import it: S.holo does the work */
export async function reveal(S, obj, o) { if (S.holo && S.holo.reveal) return S.holo.reveal(obj, o); await S.T.wait(0.4); }
