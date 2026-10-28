// HOLO FINISHES (shared with Sam's "Slab Designs" page, which is where these shaders were signed off): one GLSL
// finish per id in S.SL.FINISHES, registered with S.SM.registerFinish. Every tier finish grows out of the photograph
// itself (bands along its tones, etch lines on its contours, flakes in its highlights, prism light off its edges);
// nothing is a flat wash over the print. The update gets tilt (-1..1 x/y from the inspect drag and the hover) and
// pointer (0..1 uv over the photo), which latent and thermal read.
// Still to come (round 1 agent): the remaining test finishes (cyanotype, eclipse, steel, glass, porcelain, kintsugi,
// raku, stone, polychrome, colour keys, leaf) and reveal(S, obj): the rarity reveal loot.js awaits.
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
    float band=fract(l*2.4+(vUv.x*0.35+vUv.y*0.2)+g.x*6.0+g.y*4.0+uTilt.x*1.3-uTilt.y*0.8); vec3 c=hue(band);
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
    vec3 c=mix(t*1.6,vec3(1.0),0.5)*mix(vec3(1.0),hue(h.z),0.35); float base=0.1*lit*(0.3+0.7*h.z); float a=base+s*lit*(0.45+0.8*length(uTilt));
    gl_FragColor=vec4(c,clamp(a,0.0,1.0));
    #include <colorspace_fragment>
  }`,
  gold: `void main(){ vec3 t=texture2D(uTex,vUv).rgb; float l=luma(t); vec3 gold=mix(vec3(0.22,0.12,0.03),vec3(1.0,0.83,0.42),pow(l,0.9));
    float sweep=exp(-pow((vUv.x-(0.5+uTilt.x*0.9))*2.6,2.0))*0.5+exp(-pow((vUv.y-(0.5-uTilt.y*0.9))*3.0,2.0))*0.2; float emb=0.94+0.06*sin((vUv.x+vUv.y)*500.0);
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
export function install(S) {
  const THREE = S.THREE;
  const make = id => ctx => new THREE.Mesh(new THREE.PlaneGeometry(ctx.w, ctx.h), new THREE.ShaderMaterial({
    uniforms: { uTex: { value: ctx.photoTex }, uTilt: { value: new THREE.Vector2() }, uPointer: { value: new THREE.Vector2(0.5, 0.5) }, uTime: { value: Math.random() * 100 }, uTier: { value: new THREE.Color(ctx.tier.color) } },
    vertexShader: VERT, fragmentShader: HEAD + FRAGS[id], transparent: true, depthWrite: false, blending: ADDITIVE[id] ? THREE.AdditiveBlending : THREE.NormalBlending }));
  const update = (m, c) => { const u = m.material.uniforms; u.uTilt.value.copy(c.tilt); u.uPointer.value.copy(c.pointer); u.uTime.value += c.dt; };
  Object.keys(FRAGS).forEach(id => S.SM.registerFinish(id, { make: make(id), update }));
}
/* the rarity reveal around a fresh pull: not built yet, a plain pause so loot.js can await it */
export async function reveal(S, obj) { await S.T.wait(0.4); }
