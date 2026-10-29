  // ================= LIGHTING: lights you place, relighting the splats (on the graphics card) =================
  // Splats carry no surfaces, but each one is a stretched blob, and on a surface it flattens like a disc: its thinnest
  // axis is a good guess at the surface normal, and how flat it is says how far to trust it. A Spark "world modifier"
  // runs on the GPU for every splat Spark draws (level of detail included): daylight, the sun and up to 8 lights, each
  // with inverse-square falloff, spot beams, and shadows marched through a density grid of the scan. Changing a light
  // only changes a few numbers, so lights move live.
  var RL={on:false, ready:false, busy:false, N:0, P:null, A:null, S:1,
    dusk:1, ambK:6500, exp:0, sunPow:0, sunAz:null, sunEl:40, sunK:5600, ui:false, view:"eye", shadows:true, plan:false, planH:1, lights:[], sel:-1, nid:1, t:0, grid:null, gpu:null};
  var RL_MAX=8;
  // colour temperature in kelvin to an RGB multiplier, normalised so 6500 K is white (Tanner Helland's fit)
  function rlKelvin(k){ var t=k/100, r, g, b;
    r=t<=66?255:329.698727446*Math.pow(t-60,-0.1332047592);
    g=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-0.0755148492);
    b=t>=66?255:(t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307);
    var c=function(v){ return Math.max(0,Math.min(255,v))/255; }; return [c(r),c(g),c(b)]; }
  var RL_WHITE=rlKelvin(6500);
  function rlRGB(k){ var c=rlKelvin(k); return [c[0]/RL_WHITE[0], c[1]/RL_WHITE[1], c[2]/RL_WHITE[2]]; }
  function rlGel(hex){ var n=parseInt((hex||"#ffffff").slice(1),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; }
  function rlLightRGB(L){ var k=rlRGB(L.k), g=rlGel(L.gel); return [k[0]*g[0],k[1]*g[1],k[2]*g[2]]; }
  function rlHex(c){ var m=Math.max(c[0],c[1],c[2],1e-6); return "#"+c.map(function(v){ return ("0"+Math.round(v/m*255).toString(16)).slice(-2); }).join(""); }
  // Bundled scenes are in metres with a walk map. Your own scans have neither (no ground to look up, and any scale: a
  // Spirula scan can be 2 units across), so there the ground is the bottom of the scan and every distance is scaled.
  function rlScale(){ return WK.col?1:Math.max(0.02,Math.min(50,(sceneMaxDim||8)/8)); }
  function rlGround(x,z){ var g=WK.col&&typeof wkGround==="function"?wkGround(x,z):NaN; if(g>-1e8&&g<1e8) return g; return WK.col?camPos.y-1.6:Math.min(boxMin.y,camPos.y-0.2*RL.S); }

  // the splat centres and opacities Studium read when the scan loaded
  function rlPrepare(done){ if(!viewer||!viewer.P||!viewer.mesh){ toast("Lighting: the scan isn't ready yet"); return; }
    RL.P=viewer.P; RL.A=viewer.A; RL.N=RL.P.length/3; RL.S=rlScale(); rlInstall(); RL.ready=true; RL.busy=false; done&&done(); }

  // ---- shadows: a density grid of the scan, uploaded as a 3D texture ----
  // Opacity per cell, normalised so only the densest cells (solid things) come out near-opaque, blurred twice so shadows
  // are soft. On the GPU each lit splat marches toward its light through it: solid things block, leaves let light through.
  function rlGrid(){ if(RL.grid) return RL.grid; return rlGridSet(rlGridCalc(RL.P, RL.A, RL.N, [boxMin.x,boxMin.y,boxMin.z], [boxMax.x,boxMax.y,boxMax.z], 0.05*(sceneMaxDim||8), RL.S, RL.shK||0.35)); }
  /* the grid's sums, pure (no globals, no THREE): it also runs in the background worker (gridsAsync in app.js), so the build never freezes the page */
  function rlGridCalc(P, A, N, mn, mx, pad, S, shK){
    mn={x:mn[0],y:mn[1],z:mn[2]}; mx={x:mx[0],y:mx[1],z:mx[2]}; var RL={S:S, shK:shK};
    var x0=mn.x-pad, y0=mn.y-pad, z0=mn.z-pad, ex=mx.x-x0+pad, ey=mx.y-y0+pad, ez=mx.z-z0+pad;
    /* sized by volume, not the longest side: about 4 million cells, so a church or a car park gets 15 to 20 cm cells instead of 25 to 50 */
    var cell=Math.max(Math.cbrt(ex*ey*ez/4e6), Math.max(ex,ey,ez)/1024, 0.04*RL.S);
    var nx=Math.max(2,Math.ceil(ex/cell)), ny=Math.max(2,Math.ceil(ey/cell)), nz=Math.max(2,Math.ceil(ez/cell)), raw=new Float32Array(nx*ny*nz), i;
    for(i=0;i<N;i++){ var gx=((P[i*3]-x0)/cell)|0, gy=((P[i*3+1]-y0)/cell)|0, gz=((P[i*3+2]-z0)/cell)|0;
      if(gx<0||gy<0||gz<0||gx>=nx||gy>=ny||gz>=nz) continue; raw[(gz*ny+gy)*nx+gx]+=A?A[i]:1; }
    var nzv=[]; for(i=0;i<raw.length;i+=7) if(raw[i]>0) nzv.push(raw[i]); nzv.sort(function(a,b){ return a-b; });
    var med=nzv.length?nzv[Math.floor(nzv.length*0.8)]:1, k=(RL.shK||0.35)/med;
    var T=new Float32Array(raw.length), a=raw, b=T, d, x, y, z;
    /* thicken by a cell first (splats are counted at their centres, so a wall of big splats is full of gaps light would leak through) */
    for(d=0;d<3;d++){ var st0=d===0?1:d===1?nx:nx*ny, len0=d===0?nx:d===1?ny:nz;
      for(z=0;z<nz;z++) for(y=0;y<ny;y++) for(x=0;x<nx;x++){ var c0=(z*ny+y)*nx+x, q0=d===0?x:d===1?y:z, m0=a[c0];
        if(q0>0&&a[c0-st0]>m0) m0=a[c0-st0]; if(q0<len0-1&&a[c0+st0]>m0) m0=a[c0+st0]; b[c0]=m0*0.6+a[c0]*0.4; }
      var t0=a; a=b; b=t0; }
    for(d=0;d<6;d++){ var st=d%3===0?1:d%3===1?nx:nx*ny, len=d%3===0?nx:d%3===1?ny:nz;
      for(z=0;z<nz;z++) for(y=0;y<ny;y++) for(x=0;x<nx;x++){ var c=(z*ny+y)*nx+x, q=d%3===0?x:d%3===1?y:z;
        b[c]=a[c]*0.5+(q>0?a[c-st]:0)*0.25+(q<len-1?a[c+st]:0)*0.25; }
      var t=a; a=b; b=t; }
    /* each cell carries the density and, worked out once here, which way is out of the solid (its downhill slope):
       one texture read on the GPU gives a splat both its shadowing and its surface direction */
    var h=new Uint16Array(a.length*4), HF=f2h, sy=nx, sz=nx*ny;
    for(z=0;z<nz;z++) for(y=0;y<ny;y++) for(x=0;x<nx;x++){ var ci=(z*ny+y)*nx+x, o4=ci*4;
      var gxv=(x>0?a[ci-1]:0)-(x<nx-1?a[ci+1]:0), gyv=(y>0?a[ci-sy]:0)-(y<ny-1?a[ci+sy]:0), gzv=(z>0?a[ci-sz]:0)-(z<nz-1?a[ci+sz]:0);
      h[o4]=HF(Math.min(a[ci]*k,6)); h[o4+1]=HF(gxv*k); h[o4+2]=HF(gyv*k); h[o4+3]=HF(gzv*k); }
    return {x0:x0,y0:y0,z0:z0,cell:cell,nx:nx,ny:ny,nz:nz,h:h}; }
  function rlGridSet(r){ var tex=new THREE.Data3DTexture(r.h,r.nx,r.ny,r.nz); tex.format=THREE.RGBAFormat; tex.type=THREE.HalfFloatType; tex.minFilter=tex.magFilter=THREE.LinearFilter;
    tex.wrapS=tex.wrapT=tex.wrapR=THREE.ClampToEdgeWrapping; tex.unpackAlignment=1; tex.needsUpdate=true;
    RL.grid={x0:r.x0,y0:r.y0,z0:r.z0,cell:r.cell,nx:r.nx,ny:r.ny,nz:r.nz,tex:tex}; return RL.grid; }

  // ---- the GPU side: one Spark modifier for the whole scan ----
  var RL_GLSL=[
    "precision highp sampler3D;",
    "vec3 rlRot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }",
    "float rlTau(sampler3D G, vec3 p, vec3 o, vec3 inv){ vec3 uv=(p-o)*inv; if(any(lessThan(uv,vec3(0.0)))||any(greaterThan(uv,vec3(1.0)))) return -1.0; return texture(G,uv).r; }",
    // to a lamp: never pitch black (light bounces), so shadows keep a fifth of the light
    "float rlMarchP(sampler3D G, vec3 o, vec3 inv, float cell, vec3 p, vec3 L){ vec3 d=L-p; float dist=length(d); if(dist<cell*2.0) return 1.0; d/=dist; float acc=0.0;",
    "  float st=max(cell*0.8, dist/110.0); for(int i=0;i<120;i++){ float t=cell*3.0+float(i)*st; if(t>dist-cell) break; float v=rlTau(G,p+d*t,o,inv); if(v<0.0) break; acc+=v*st/cell; if(acc>4.0) break; }",
    "  return 0.22+0.78*exp(-acc); }",
    // to the sun: parallel rays, out of the scan or a few metres; the daylight fills the shade
    "float rlMarchD(sampler3D G, vec3 o, vec3 inv, float cell, vec3 p, vec3 d){ float acc=0.0;",
    "  for(int i=0;i<90;i++){ float t=cell*3.0+float(i)*cell*1.2; float v=rlTau(G,p+d*t,o,inv); if(v<0.0) break; acc+=v*1.2; if(acc>4.0) break; }",
    "  return exp(-acc); }",
    /* the scan's density, sampled either side: its slope points out of solid things, a surface direction for every splat */
    "float rlT0(sampler3D G, vec3 p, vec3 o, vec3 inv){ return max(rlTau(G,p,o,inv),0.0); }",
    "vec3 rlOut(sampler3D G, vec3 p, vec3 o, vec3 inv){ vec3 uv=(p-o)*inv; if(any(lessThan(uv,vec3(0.0)))||any(greaterThan(uv,vec3(1.0)))) return vec3(0.0); return texture(G,uv).gba; }"].join("\n");
  function rlInstall(){ if(RL.gpu&&RL.gpu.mesh===viewer.mesh) return; var D=SPARK.dyno, U={}, mesh=viewer.mesh, STM;
    var dummy=new THREE.Data3DTexture(new Uint16Array([0]),1,1,1); dummy.format=THREE.RedFormat; dummy.type=THREE.HalfFloatType; dummy.needsUpdate=true;
    var lt=new THREE.DataTexture(new Float32Array(4*4*RL_MAX),4,RL_MAX,THREE.RGBAFormat,THREE.FloatType); lt.needsUpdate=true;
    U.on=D.dynoFloat(0); U.amb=D.dynoVec3(new THREE.Vector3(1,1,1)); U.cam=D.dynoVec3(new THREE.Vector3());
    U.sunOn=D.dynoFloat(0); U.sunDir=D.dynoVec3(new THREE.Vector3(0,1,0)); U.sunCol=D.dynoVec3(new THREE.Vector3());
    U.nl=D.dynoInt(0); U.lt=D.dynoSampler2D(lt); U.is2=D.dynoFloat(1);
    U.shad=D.dynoFloat(0); U.gok=D.dynoFloat(0); U.grid=D.dynoSampler3D(dummy); U.go=D.dynoVec3(new THREE.Vector3()); U.ginv=D.dynoVec3(new THREE.Vector3(1,1,1)); U.cell=D.dynoFloat(1); U.cut=D.dynoFloat(1e30); U.dcut=D.dynoVec4(new THREE.Vector4(0,0,-1,0)); U.dcy=D.dynoVec2(new THREE.Vector2(0,0));
    var types={gsplat:D.Gsplat, on:"float", amb:"vec3", cam:"vec3", sunOn:"float", sunDir:"vec3", sunCol:"vec3", nl:"int", lt:"sampler2D", is2:"float", shad:"float", gok:"float", grid:"sampler3D", go:"vec3", ginv:"vec3", cell:"float", cut:"float", dcut:"vec4", dcy:"vec2"};
    var mod=D.dynoBlock({gsplat:D.Gsplat},{gsplat:D.Gsplat},function(io){ var ins={gsplat:io.gsplat}; for(var k in U) ins[k]=U[k];
      var dd=D.dyno({inTypes:types, outTypes:{gsplat:D.Gsplat}, inputs:ins, globals:function(){ return [RL_GLSL]; },
        statements:(STM=function(c){ var i=c.inputs, o=c.outputs.gsplat; return [
          o+" = "+i.gsplat+";",
          "if(length("+o+".center.xz-"+i.dcut+".xy)<"+i.dcut+".z && "+o+".center.y>"+i.dcy+".x && "+o+".center.y<"+i.dcy+".y) "+o+".rgba.a=0.0;",   // the subject's own full-detail piece draws this part
          "if("+i.on+" > 0.001 && isGsplatActive("+o+".flags)){",   /* on can sit between 0 and 1: the light fades in and out */
          "  vec3 c="+o+".center; vec3 s=abs("+o+".scales);",
          "  int k=(s.x<=s.y && s.x<=s.z)?0:((s.y<=s.z)?1:2); vec3 ax=k==0?vec3(1.0,0.0,0.0):(k==1?vec3(0.0,1.0,0.0):vec3(0.0,0.0,1.0));",
          "  vec3 n=normalize(rlRot("+o+".quaternion, ax));",
          "  float mn=min(s.x,min(s.y,s.z)), mxv=max(s.x,max(s.y,s.z)), md=s.x+s.y+s.z-mn-mxv; float f=clamp(1.0-mn/max(md,1e-6)*1.4,0.0,1.0);",   // a disc is flat: thin axis much smaller than the next
          "  if(dot(n,"+i.cam+"-c)<0.0) n=-n;",   // a disc has two sides: take the one you can see
          "  float ao=1.0;",
          "  if("+i.gok+">0.5){ vec3 gn=rlOut("+i.grid+",c,"+i.go+","+i.ginv+"); float gl=length(gn);",
          "    if(gl>0.08){ gn/=gl; float w=clamp((gl-0.08)*2.5,0.0,1.0);",   // a clear slope: the surface faces out of the solid
          "      if(dot(n,gn)<0.0) n=-n; n=normalize(mix(n,gn,w*(1.0-0.55*f))); f=max(f,w*0.85); }",
          "    float o1=rlT0("+i.grid+",c+n*"+i.cell+"*2.0,"+i.go+","+i.ginv+");",
          "    ao=clamp(exp(-o1*0.7),0.35,1.0); }",   // corners and the undersides of things get less of the sky
          "  vec3 V=normalize("+i.cam+"-c); vec3 Ls=vec3(0.0);",
          "  vec3 Lt="+i.amb+"*ao;",
          "  if("+i.sunOn+">0.5){ float sl=max(dot(n,"+i.sunDir+"),0.0); float ss=sl*f+0.45*(1.0-f); if(ss>0.002){ if("+i.shad+">0.001) ss*=mix(1.0,rlMarchD("+i.grid+","+i.go+","+i.ginv+","+i.cell+",c,"+i.sunDir+"),min("+i.shad+",1.0)); Lt+=ss*"+i.sunCol+"; Ls+=pow(max(dot(n,normalize("+i.sunDir+"+V)),0.0),40.0)*0.18*f*ss*"+i.sunCol+"; } }",
          "  for(int m=0;m<"+RL_MAX+";m++){ if(m>="+i.nl+") break;",
          "    vec4 la=texelFetch("+i.lt+",ivec2(0,m),0), lb=texelFetch("+i.lt+",ivec2(1,m),0), le=texelFetch("+i.lt+",ivec2(2,m),0), lf=texelFetch("+i.lt+",ivec2(3,m),0);",
          "    vec3 l=la.xyz-c; float r2=dot(l,l); float d=max(sqrt(r2),1e-6); float lam=max(dot(n,l)/d,0.0); float sh=lam*f+0.45*(1.0-f);",   // blobby splats get a soft half-light
          "    if(lb.a>0.5){ float ca=-dot(l,le.xyz)/d; if(ca<=le.w) continue; if(ca<lf.x){ float u=(ca-le.w)/(lf.x-le.w); sh*=u*u*(3.0-2.0*u); } }",
          "    if("+i.shad+">0.001) sh*=mix(1.0,rlMarchP("+i.grid+","+i.go+","+i.ginv+","+i.cell+",c,la.xyz),min("+i.shad+",1.0));",   /* shadows can fade in and out */
          "    vec3 li=sh/(r2*"+i.is2+"+la.w)*lb.rgb; Lt+=li; Ls+=pow(max(dot(n,normalize(l/d+V)),0.0),32.0)*0.22*f*li; }",   // a soft sheen on flat surfaces: floors, paint, glass
          "  "+o+".rgba.rgb=mix("+o+".rgba.rgb, min("+o+".rgba.rgb*Lt+Ls, vec3(1.0)), min("+i.on+",1.0));",
          "  if(c.y>"+i.cut+") "+o+".rgba.a=0.0;",   // plan view: hide everything above head height
          "}"]; }) });
      return {gsplat:dd.outputs.gsplat}; });
    var cut=viewer.cut; if(cut){ U.dcut.value.set(cut[0],cut[1],cut[2],0); U.dcy.value.set(cut[3],cut[4]); }
    mesh.worldModifier=mod; mesh.updateGenerator(); RL.gpu={mesh:mesh, U:U, lt:lt, dummy:dummy, mk:function(){ var U2={}; for(var k in U) U2[k]=U[k]; return U2; }};
    /* the detail piece gets the same lighting, without the cut */
    RL.gpu.modFor=function(over){ var U2=RL.gpu.mk(); U2.dcut=D.dynoVec4(new THREE.Vector4(0,0,-1,0)); if(over) for(var ok in over) U2[ok]=over[ok];   /* over: own uniforms for this piece (the opening keeps the stump in its own light) */
      var m2=D.dynoBlock({gsplat:D.Gsplat},{gsplat:D.Gsplat},function(io){ var ins={gsplat:io.gsplat}; for(var k in U2) ins[k]=U2[k];
        var d2=D.dyno({inTypes:types, outTypes:{gsplat:D.Gsplat}, inputs:ins, globals:function(){ return [RL_GLSL]; }, statements:STM}); return {gsplat:d2.outputs.gsplat}; }); return m2; };
    rlDetail(); }
  function rlDetail(){ var dm=viewer&&viewer.detail; if(!dm||!RL.gpu||RL.gpu.detail===dm) return; dm.worldModifier=RL.gpu.modFor(); dm.updateGenerator(); RL.gpu.detail=dm; }

  // push the current lights to the GPU, then ask Spark to re-run the modifier
  function rlApply(){ if(!RL.ready||!RL.gpu) return; var G0=RL.gpu, U=G0.U, t0=performance.now();
    var E=Math.pow(2,RL.exp), A=rlRGB(RL.ambK), D=RL.plan?Math.max(RL.dusk,0.4):RL.dusk;
    /* scans with spherical harmonics add their view-dependent colour after the modifier, which would wash the lighting
       out: while the rig is on, draw them with base colour only */
    if(G0.mesh.maxSh>0){ G0.mesh.__sh=G0.mesh.maxSh; G0.mesh.maxSh=0; G0.mesh.updateGenerator();
      setTimeout(function(){ G0.mesh.updateGenerator(); G0.mesh.updateVersion(); },300); }   /* Spark only takes the change on a second rebuild */
    U.on.value=1; U.amb.value.set(D*A[0]*E, D*A[1]*E, D*A[2]*E); U.cam.value.set(camPos.x,camPos.y,camPos.z); U.is2.value=1/(RL.S*RL.S);
    var SUN=RL.sunPow>0&&RL.sunEl>0; U.sunOn.value=SUN?1:0;
    if(SUN){ var sd=rlSunDir(), sc=rlRGB(RL.sunK); U.sunDir.value.set(sd[0],sd[1],sd[2]); U.sunCol.value.set(sc[0]*RL.sunPow*E, sc[1]*RL.sunPow*E, sc[2]*RL.sunPow*E); }
    var on=RL.lights.filter(function(L){ return L.on&&L.power>0; }), lt=G0.lt.image.data; lt.fill(0);
    on.slice(0,RL_MAX).forEach(function(L,m){ var c=rlLightRGB(L), half=L.cone*Math.PI/360, o=m*16;
      lt.set([L.x,L.y,L.z,L.soft, c[0]*L.power*E,c[1]*L.power*E,c[2]*L.power*E, L.type==="spot"?1:0, L.dir[0],L.dir[1],L.dir[2],Math.cos(half), Math.cos(half*0.7),0,0,0], o); });
    G0.lt.needsUpdate=true; U.nl.value=Math.min(on.length,RL_MAX);
    var useG=RL.shadows&&(on.length||SUN); U.shad.value=useG?1:0; U.gok.value=1;
    { var G=rlGrid(); U.grid.value=G.tex; U.go.value.set(G.x0,G.y0,G.z0); U.ginv.value.set(1/(G.nx*G.cell),1/(G.ny*G.cell),1/(G.nz*G.cell)); U.cell.value=G.cell; }
    U.cut.value=RL.plan?RL.cutY:1e30;
    G0.mesh.updateVersion();
    rlDetail(); var dm=viewer&&viewer.detail; if(dm&&G0.detail===dm){ if(dm.maxSh>0){ dm.__sh=dm.maxSh; dm.maxSh=0; dm.updateGenerator(); } dm.updateVersion(); }
    if(typeof SKY!=="undefined"&&SKY.mesh) SKY.mesh.material.uniforms.dim.value=Math.max(0.05,Math.min(1,D*E));   // the sky goes down with the daylight
    RL.ms=Math.round(performance.now()-t0); rlMarkers(); rlPlanUI(); rlPanel(); }
  function rlRestore(){ if(!RL.gpu) return; RL.gpu.U.on.value=0; var M=RL.gpu.mesh; if(M.__sh!=null){ M.maxSh=M.__sh; M.__sh=null; M.updateGenerator(); } M.updateVersion();
    var dm=RL.gpu.detail; if(dm){ if(dm.__sh!=null){ dm.maxSh=dm.__sh; dm.__sh=null; dm.updateGenerator(); } dm.updateVersion(); }
    if(typeof SKY!=="undefined"&&SKY.mesh) SKY.mesh.material.uniforms.dim.value=1; }
  function rlSunDir(){ var a=RL.sunAz*Math.PI/180, e=RL.sunEl*Math.PI/180; return [Math.cos(e)*Math.sin(a), Math.sin(e), Math.cos(e)*Math.cos(a)]; }

  // the splat under the crosshair: the nearest one close to the line you're looking down
  function rlPick(){ if(!RL.ready) return null; var f=new THREE.Vector3(); camera.getWorldDirection(f); var P=RL.P, N=RL.N, ox=camPos.x, oy=camPos.y, oz=camPos.z, best=-1, bt=1e30, mt=0.05*RL.S;
    for(var i=0;i<N;i++){ var vx=P[i*3]-ox, vy=P[i*3+1]-oy, vz=P[i*3+2]-oz, t=vx*f.x+vy*f.y+vz*f.z; if(t<mt||t>=bt) continue;
      var p2=vx*vx+vy*vy+vz*vz-t*t, lim=t*0.012+0.004*RL.S; if(p2<lim*lim){ bt=t; best=i; } }
    return best<0?null:{x:P[best*3], y:P[best*3+1], z:P[best*3+2], t:bt}; }

  // ---- the kit: real fixtures are presets ----
  var RL_FX={ fresnel:{n:"Fresnel",d:"Hard, warm spot",type:"spot",k:3200,power:12,soft:0.05,cone:35,h:1.6},
    led:{n:"LED panel",d:"Big and soft",type:"bulb",k:5600,power:9,soft:0.6,cone:90,h:1.4},
    speed:{n:"Speedlight",d:"Fast flash, hard light",type:"spot",k:5500,power:16,soft:0.15,cone:70,h:1.5},
    torch:{n:"Torch",d:"Narrow beam",type:"spot",k:4500,power:7,soft:0.03,cone:18,h:1.2},
    candle:{n:"Candle",d:"Low and orange",type:"bulb",k:1900,power:1.8,soft:0.08,cone:90,h:0.3},
    sodium:{n:"Streetlight",d:"Sodium, overhead",type:"bulb",k:2000,power:14,soft:0.3,cone:90,h:2.4,gel:"#ffb050"},
    rgb:{n:"RGB tube",d:"Any colour",type:"bulb",k:6500,power:7,soft:0.2,cone:90,h:1,gel:"#ff3df0"}};
  // the scan already holds its own (overcast) daylight, so a sunny time of day turns that down to skylight and adds the sun on top
  var RL_TIMES={ day:{n:"Day",dusk:0.6,ambK:7000,sun:0.75,el:55,sk:5600}, golden:{n:"Golden hour",dusk:0.32,ambK:8000,sun:1.05,el:9,sk:3000},
    blue:{n:"Blue hour",dusk:0.18,ambK:11000,sun:0,el:-4,sk:6500}, night:{n:"Night",dusk:0.04,ambK:9000,sun:0,el:-20,sk:6500} };
  function rlTimeIs(t){ var T=RL_TIMES[t]; return Math.abs(RL.dusk-T.dusk)<0.01&&RL.ambK===T.ambK&&RL.sunPow===T.sun; }
  var RL_GELS=[["#ffffff","None"],["#ffc98a","Warm"],["#9cc4ff","Blue"],["#ff5a4a","Red"],["#6dff9a","Green"],["#ff3df0","Magenta"]];
  function rlCur(){ return RL.lights[RL.sel]||null; }
  function rlAimAt(L,p){ var dx=p.x-L.x, dy=p.y-L.y, dz=p.z-L.z, d=Math.hypot(dx,dy,dz)||1; L.dir=[dx/d,dy/d,dz/d]; L.aimT={x:p.x,y:p.y,z:p.z}; }
  function rlSetPos(L,x,z){ L.x=x; L.z=z; L.g=rlGround(x,z); L.y=L.g+L.h*RL.S; if(L.aimT) rlAimAt(L,L.aimT); }
  /* gold target spots: a tour says where a light should go (angle from the camera side, distance from the subject), the plan draws
     them, and rlAtSpot says when a light is close enough. RL.want holds exact settings a tour asks for, drawn as bands on the sliders. */
  function rlSpotPos(sp){ var T=RL.target||rlTarget(), E=RL.eye||{x:camPos.x,z:camPos.z}, S=RL.S, ax=E.x-T.x, az=E.z-T.z, al=Math.hypot(ax,az)||1; ax/=al; az/=al;
    var a=sp.a*Math.PI/180, d=sp.d*S, ca=Math.cos(a), sa=Math.sin(a); return {x:T.x+(ax*ca-az*sa)*d, z:T.z+(ax*sa+az*ca)*d}; }
  function rlAtSpot(L,sp){ if(!L||!sp) return false; var P=rlSpotPos(sp); return Math.hypot(L.x-P.x,L.z-P.z)<0.4*RL.S; }
  var RL_TOL={power:2, k:300, h:0.15, cone:6};
  function rlWantHit(i,k){ var W=RL.want&&RL.want[i], L=RL.lights[i]; if(!W||W[k]==null||!L) return null; return Math.abs(L[k]-W[k])<=RL_TOL[k]; }
  function rlWantAll(i){ var W=RL.want&&RL.want[i]; if(!W) return false; return Object.keys(W).every(function(k){ return rlWantHit(i,k); }); }

  // what you were looking at when you opened Lighting: new lights land around it, in the classic places
  function rlTarget(){ var f=new THREE.Vector3(); camera.getWorldDirection(f); var p=rlPick(), S=RL.S;
    var sj=typeof CH!=="undefined"&&CH.spec&&CH.spec.subject; if(sj&&Math.hypot(sj[0]-camPos.x,sj[1]-camPos.z)<10*S&&!(p&&p.t<4*S)) return {x:sj[0], y:rlGround(sj[0],sj[1])+0.4*S, z:sj[1]};   // a scene with a known subject: light that
    if(p&&p.t<12*S) return {x:p.x,y:p.y,z:p.z};
    var hl=Math.hypot(f.x,f.z)||1, x=camPos.x+f.x/hl*2*S, z=camPos.z+f.z/hl*2*S; return {x:x, y:rlGround(x,z)+0.5*S, z:z}; }
  var RL_SPOTS=[[45,1.5],[-55,1.9],[160,1.4],[-150,1.8],[100,2.2],[-100,2.2],[20,2.6],[-20,2.6]];   // angle from the camera side, distance: key, fill, rim, back...
  function rlAdd(fx){ if(RL.lights.length>=RL_MAX){ toast("That's "+RL_MAX+" lights, the most for now"); return; }
    var F=RL_FX[fx]||RL_FX.fresnel, T=RL.target||rlTarget(), E=RL.eye||{x:camPos.x,z:camPos.z}, S=RL.S;
    var ax=E.x-T.x, az=E.z-T.z, al=Math.hypot(ax,az)||1; ax/=al; az/=al;
    var sp=RL_SPOTS[RL.lights.length%RL_SPOTS.length], a=sp[0]*Math.PI/180, d=sp[1]*S, ca=Math.cos(a), sa=Math.sin(a);
    var L={id:RL.nid++, on:true, fx:fx, name:F.n, type:F.type, power:F.power, k:F.k, gel:F.gel||"#ffffff", soft:F.soft, cone:F.cone, h:F.h, dir:[0,-1,0]};
    rlSetPos(L, T.x+(ax*ca-az*sa)*d, T.z+(ax*sa+az*ca)*d); rlAimAt(L,T);
    RL.lights.push(L); RL.sel=RL.lights.length-1; RL.placed=(RL.placed||0)+1; rlApply(); }

  // ---- bulbs in the scene: only while you're arranging, never in a photo ----
  var rlGeo=null;
  function rlMarkers(){ if(typeof scene==="undefined") return; var S=RL.S;
    RL.lights.forEach(function(L,i){ if(!L.mk){ if(!rlGeo) rlGeo=new THREE.SphereGeometry(0.03,16,12);
        L.mk=new THREE.Group(); L.mk.add(new THREE.Mesh(rlGeo,new THREE.MeshBasicMaterial({color:0xffffff})));
        L.arrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),0.22,0xffe2a8,0.05,0.03); L.mk.add(L.arrow); scene.add(L.mk); }
      L.mk.position.set(L.x,L.y,L.z); L.mk.scale.setScalar(S*(i===RL.sel?1.4:1));
      L.mk.children[0].material.color.set(L.on?rlHex(rlLightRGB(L)):"#3a3630");
      L.arrow.visible=L.type==="spot"; L.arrow.setDirection(new THREE.Vector3(L.dir[0],L.dir[1],L.dir[2])); }); rlVis(); }
  function rlVis(){ var show=RL.ui&&RL.view==="eye"&&!viewfinderOn; RL.lights.forEach(function(L){ if(L.mk) L.mk.visible=show; }); }
  function rlDrop(L){ if(L.mk){ scene.remove(L.mk); L.mk.traverse(function(o){ if(o.material) o.material.dispose(); }); L.mk=null; } }
  var rlLastT=0;
  (function rlWatch(t){ requestAnimationFrame(rlWatch); var dt=Math.min(0.05,((t||0)-rlLastT)/1000); rlLastT=t||0;
    if(RL.ui&&viewfinderOn&&typeof RLB==="undefined") rlClose();   // raising the camera puts the lighting away
    rlVis(); if(!RL.ui||RL.view!=="plan") return;
    var k=typeof keys!=="undefined"?keys:{}, vx=(k.KeyD||k.ArrowRight?1:0)-(k.KeyA||k.ArrowLeft?1:0), vz=(k.KeyS||k.ArrowDown?1:0)-(k.KeyW||k.ArrowUp?1:0);
    if((vx||vz)&&dt>0){ var sp=RL.planExt*RL.planH*0.6*dt; RL.planC.x+=vx*sp; RL.planC.z+=vz*sp; }
    rlPlanDraw(); })();

  // ---- the two views: from above (arrange) and through your eyes (check it, walk around) ----
  // From above, anything over head height is hidden like an architect's plan cut, so a canopy can't hide the ground.
  var _rlRay=new THREE.Raycaster(), _rlV=new THREE.Vector3(), _rlPl=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  function rlView(v){ if(v==="plan"){ if(looking) document.exitPointerLock(); var f=new THREE.Vector3(); camera.getWorldDirection(f);
      RL.eye={x:camPos.x,z:camPos.z,fx:f.x,fz:f.z}; if(!RL.target) RL.target=rlTarget();
      var T=RL.target; RL.planC={x:(T.x*2+camPos.x)/3, z:(T.z*2+camPos.z)/3}; RL.planExt=Math.max(6*RL.S, Math.hypot(T.x-camPos.x,T.z-camPos.z)*2.6); RL.planH=1;
      RL.gRef=rlGround(T.x,T.z); RL.cutY=RL.gRef+2.4*RL.S; }
    RL.view=v; RL.plan=v==="plan"; rlPlanUI(); rlApply(); }
  function rlPlanCam(){ if(!RL.plan) return; var fov=camera.fov*Math.PI/180, h=RL.planExt*RL.planH/(2*Math.tan(fov/2)*Math.min(1,camera.aspect));
    camera.up.set(0,0,-1); camera.position.set(RL.planC.x, RL.gRef+h, RL.planC.z); camera.lookAt(RL.planC.x, RL.gRef, RL.planC.z); camera.updateMatrixWorld(); }
  function rlScr(x,y,z){ _rlV.set(x,y,z).project(camera); return {x:(_rlV.x*0.5+0.5)*innerWidth, y:(-_rlV.y*0.5+0.5)*innerHeight}; }
  function rlOnPlane(e,y){ _rlRay.setFromCamera({x:e.clientX/innerWidth*2-1, y:-(e.clientY/innerHeight)*2+1}, camera); _rlPl.constant=-y; var o=new THREE.Vector3(); return _rlRay.ray.intersectPlane(_rlPl,o)?o:null; }
  function rlHandle(L){ var R=0.09*RL.planExt*RL.planH, hx=L.dir[0], hz=L.dir[2], hl=Math.hypot(hx,hz)||1; return {x:L.x+hx/hl*R, z:L.z+hz/hl*R}; }
  function rlPlanUI(){ var u=$("rlPlanUI"); if(!u){ u=document.createElement("div"); u.id="rlPlanUI"; document.body.appendChild(u);
      u.addEventListener("pointerdown",rlPlanDown); u.addEventListener("wheel",function(e){ e.preventDefault(); e.stopPropagation(); RL.planH=Math.max(0.25,Math.min(5,RL.planH*(e.deltaY>0?1.12:0.89))); },{passive:false}); }
    u.classList.toggle("show",!!(RL.ui&&RL.plan)); if(!(RL.ui&&RL.plan)) return;
    u.innerHTML='<svg></svg>'+(RL.sunPow>0?'<div class="rlp-sun"><i></i><span>SUN</span></div>':'')+'<div class="rlp-t"><i></i><span>SUBJECT</span></div><div class="rlp-you"><i></i><span>YOU</span></div>'+(RL.spots||[]).map(function(sp,j){ return '<div class="rlp-spot'+(rlAtSpot(RL.lights[sp.i],sp)?' hit':'')+'" data-j="'+j+'"><i></i><span>'+sp.n+'</span></div>'; }).join("")+RL.lights.map(function(L,i){ return '<div class="rlp-l'+(i===RL.sel?' on':'')+(L.on?'':' off')+'" data-i="'+i+'"><i style="background:'+rlHex(rlLightRGB(L))+'"></i><span>'+(i+1)+' · '+L.name+'</span></div>'+(L.type==="spot"?'<div class="rlp-h" data-i="'+i+'"></div>':''); }).join("")
      +'<p class="rlp-tip">'+(RL.lights.length?'<b>Drag a light</b> to move it'+(RL.lights.some(function(L){ return L.type==="spot"; })?' · <b>drag its gold dot</b> to aim':'')+' · ':'Add a light from the panel · ')+'<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or drag the ground to move around · scroll to zoom</p>'; }
  function rlPlanDraw(){ var u=$("rlPlanUI"); if(!u||!RL.plan) return; var svg='';
    RL.lights.forEach(function(L,i){ var p=rlScr(L.x,L.y,L.z), el=u.querySelector('.rlp-l[data-i="'+i+'"]'); if(el) el.style.transform='translate('+p.x.toFixed(1)+'px,'+p.y.toFixed(1)+'px)';
      if(L.type==="spot"){ var H=rlHandle(L), q=rlScr(H.x,L.y,H.z), hd=u.querySelector('.rlp-h[data-i="'+i+'"]'); if(hd) hd.style.transform='translate('+q.x.toFixed(1)+'px,'+q.y.toFixed(1)+'px)';
        var a=Math.atan2(q.y-p.y,q.x-p.x), w=L.cone*Math.PI/360, len=Math.hypot(q.x-p.x,q.y-p.y)*2.2;
        svg+='<path d="M'+p.x+' '+p.y+' L'+(p.x+Math.cos(a-w)*len)+' '+(p.y+Math.sin(a-w)*len)+' L'+(p.x+Math.cos(a+w)*len)+' '+(p.y+Math.sin(a+w)*len)+' Z" class="beam'+(L.on?'':' off')+'"/><line x1="'+p.x+'" y1="'+p.y+'" x2="'+q.x+'" y2="'+q.y+'"/>'; }
      else { var rr=Math.abs(rlScr(L.x+0.06*RL.planExt*RL.planH,L.y,L.z).x-p.x); svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="'+rr+'" class="beam'+(L.on?'':' off')+'"/>'; } });
    var E=RL.eye, R=0.08*RL.planExt*RL.planH, y=rlScr(E.x,RL.gRef,E.z), yf=rlScr(E.x+E.fx*R,RL.gRef,E.z+E.fz*R), you=u.querySelector(".rlp-you"), T=RL.target, tt=rlScr(T.x,T.y,T.z), te=u.querySelector(".rlp-t");
    if(you) you.style.transform='translate('+y.x.toFixed(1)+'px,'+y.y.toFixed(1)+'px) rotate('+(Math.atan2(yf.y-y.y,yf.x-y.x)*180/Math.PI+90).toFixed(1)+'deg)';
    if(te) te.style.transform='translate('+tt.x.toFixed(1)+'px,'+tt.y.toFixed(1)+'px)';
    (RL.spots||[]).forEach(function(sp,j){ var P=rlSpotPos(sp), q=rlScr(P.x,RL.gRef,P.z), el=u.querySelector('.rlp-spot[data-j="'+j+'"]'); if(el){ el.style.transform='translate('+q.x.toFixed(1)+'px,'+q.y.toFixed(1)+'px)'; el.classList.toggle("hit", rlAtSpot(RL.lights[sp.i],sp)); } });
    svg+='<line class="view" x1="'+y.x+'" y1="'+y.y+'" x2="'+tt.x+'" y2="'+tt.y+'"/>';
    var su=u.querySelector(".rlp-sun"); if(su){ var sp=rlSunScr(), c=rlScr(T.x,RL.gRef,T.z); su.style.transform='translate('+sp.x.toFixed(1)+'px,'+sp.y.toFixed(1)+'px)'; svg+='<line class="sun" x1="'+sp.x+'" y1="'+sp.y+'" x2="'+c.x+'" y2="'+c.y+'"/>'; }
    var sv=u.querySelector("svg"); if(sv) sv.innerHTML=svg; }
  // what's under the pointer: the nearest light or aim dot within a generous reach, otherwise the ground (pan)
  var rlDrag=null, rlDragT=0;
  function rlSunScr(){ var T=RL.target, R=0.36*RL.planExt*RL.planH, a=RL.sunAz*Math.PI/180; return rlScr(T.x+Math.sin(a)*R, RL.gRef, T.z+Math.cos(a)*R); }
  function rlPlanDown(e){ e.preventDefault(); var best=null, bd=38;
    if(RL.sunPow>0){ var sp=rlSunScr(); if(Math.hypot(sp.x-e.clientX,sp.y-e.clientY)<34){ rlDrag={sun:true}; window.addEventListener("pointermove",rlPlanMove); window.addEventListener("pointerup",rlPlanUp,{once:true}); return; } }
    RL.lights.forEach(function(L,i){ var p=rlScr(L.x,L.y,L.z), d=Math.hypot(p.x-e.clientX,p.y-e.clientY); if(d<bd){ bd=d; best={i:i,aim:false}; }
      if(L.type==="spot"){ var H=rlHandle(L), q=rlScr(H.x,L.y,H.z), d2=Math.hypot(q.x-e.clientX,q.y-e.clientY); if(d2<Math.min(bd,26)){ bd=d2; best={i:i,aim:true}; } } });
    if(best){ RL.sel=best.i; var L=RL.lights[best.i], p0=rlOnPlane(e,L.y); rlDrag={L:L, aim:best.aim, ox:p0?L.x-p0.x:0, oz:p0?L.z-p0.z:0}; rlPlanUI(); rlPanel(); }
    else { var g=rlOnPlane(e,RL.gRef); rlDrag={pan:true, sx:e.clientX, sy:e.clientY, c:{x:RL.planC.x,z:RL.planC.z}, g:g}; }
    window.addEventListener("pointermove",rlPlanMove); window.addEventListener("pointerup",rlPlanUp,{once:true}); }
  function rlPlanMove(e){ if(!rlDrag) return;
    if(rlDrag.sun){ var g=rlOnPlane(e,RL.gRef), T=RL.target; if(g){ RL.sunAz=((Math.atan2(g.x-T.x,g.z-T.z)*180/Math.PI)%360+360)%360; rlDrag.moved=true; rlApply(); } return; }
    if(rlDrag.pan){ var k=RL.planExt*RL.planH/Math.min(innerWidth,innerHeight)*1.15; RL.planC.x=rlDrag.c.x-(e.clientX-rlDrag.sx)*k; RL.planC.z=rlDrag.c.z-(e.clientY-rlDrag.sy)*k; return; }
    var L=rlDrag.L;
    if(rlDrag.aim){ var g=rlOnPlane(e,RL.target.y); if(g) rlAimAt(L,{x:g.x,y:RL.target.y,z:g.z}); }
    else { var p=rlOnPlane(e,L.y); if(p) rlSetPos(L,p.x+rlDrag.ox,p.z+rlDrag.oz); }
    rlDrag.moved=true; rlApply(); }   // big scans relight when you let go
  function rlPlanUp(){ window.removeEventListener("pointermove",rlPlanMove); var d=rlDrag; rlDrag=null; if(d&&d.sun){ rlApply(); return; } if(d&&!d.pan){ if(d.moved) RL.moved=(RL.moved||0)+1; rlApply(); } }

  // ---- open and close: Lighting is one place. Done keeps your lights; "Natural light" takes them all away ----
  function rlOpen(){ if(!loaded) return; RL.ui=true; RL.on=true; if(!Q.flags.rlOpened) qFlag("rlOpened"); rlPanel(); document.body.classList.add("rl-open");
    if(typeof coStart==="function"&&!CO.on){ var seen="1"; try{ seen=localStorage.getItem("studium_lighttour"); localStorage.setItem("studium_lighttour","1"); }catch(e){} if(seen!=="1"&&!Q.tours.lighting) coStart("lighting"); }
    if(RL.sunAz==null){ var f0=new THREE.Vector3(); camera.getWorldDirection(f0); RL.sunAz=((Math.atan2(f0.x,f0.z)*180/Math.PI+140)%360+360)%360; }   // side-back light: shadows run across the frame
    var go=function(){ RL.target=null; rlView("plan"); }; if(!RL.ready){ if(!RL.busy) rlPrepare(go); } else go(); }
  function rlClose(){ if(!RL.ui) return; RL.ui=false; document.body.classList.remove("rl-open"); if(RL.plan){ RL.plan=false; RL.view="eye"; rlApply(); } rlPlanUI(); rlPanel(); rlVis(); }
  function rlToggle(){ if(RL.ui) rlClose(); else rlOpen(); }
  function rlNatural(){ RL.sunPow=0; RL.lights.forEach(rlDrop); RL.lights=[]; RL.sel=-1; RL.dusk=1; RL.ambK=6500; RL.exp=0; rlRestore(); RL.on=false; rlClose(); }
  function rlStatus(t){ RL.status=t; rlPanel(); }

  // ---- the panel ----
  function rlShow(k,v){ if(k==="sunAz") return ["N","NE","E","SE","S","SW","W","NW"][Math.round(((v%360)+360)%360/45)%8]; if(k==="sunEl") return Math.round(v)+"°"; return k==="k"?Math.round(v/100)*100+"K" : k==="exp"?(v>0?"+":"")+v.toFixed(1) : k==="cone"?Math.round(v)+"°" : k==="h"?v.toFixed(1)+" m" : v.toFixed(1); }
  var RL_SL={ k:[1800,10000,function(v){ return v; },function(x){ return x; }], exp:[-30,30,function(v){ return v/10; },function(x){ return Math.round(x*10); }],
    power:[0,400,function(v){ return v/10; },function(x){ return Math.round(x*10); }], h:[0,250,function(v){ return v/100; },function(x){ return Math.round(x*100); }], cone:[10,120,function(v){ return v; },function(x){ return x; }],
    sunAz:[0,359,function(v){ return v; },function(x){ return Math.round(((x%360)+360)%360); }], sunEl:[2,75,function(v){ return v; },function(x){ return Math.round(x); }] };
  function rlSl(scope,k,label,obj){ var d=RL_SL[k], W=scope==="l"&&RL.want&&RL.want[RL.sel], want=W&&W[k]!=null?W[k]:null, band='';
    if(want!=null){ var lo=(d[3](want-(RL_TOL[k]||0))-d[0])/(d[1]-d[0])*100, hi=(d[3](want+(RL_TOL[k]||0))-d[0])/(d[1]-d[0])*100; band='<i class="rl-want'+(rlWantHit(RL.sel,k)?' hit':'')+'" style="left:'+Math.max(0,lo).toFixed(1)+'%;width:'+Math.max(1.5,hi-lo).toFixed(1)+'%"></i><b class="rl-wv">'+rlShow(k,want)+'</b>'; }
    return '<label class="'+(want!=null?'want':'')+'"><span>'+label+'</span><span class="rl-tr"><input type="range" data-rl-s="'+scope+'" data-rl-k="'+k+'" min="'+d[0]+'" max="'+d[1]+'" value="'+d[3](obj[k])+'">'+band+'</span><em>'+rlShow(k,obj[k])+'</em></label>'; }
  function rlPanel(){ var p=$("rlPanel"); if(!p){ p=document.createElement("div"); p.id="rlPanel"; document.body.appendChild(p); p.addEventListener("input",rlInput); p.addEventListener("click",rlClick); p.addEventListener("keydown",function(e){ e.stopPropagation(); }); }
    p.classList.toggle("show", !!RL.ui); if(!RL.ui) return; var ae=document.activeElement; if(p.contains(ae)&&ae.type==="range") return;   // don't rebuild under a dragging slider
    var L=rlCur(), h='<div class="rl-h"><div><span class="rl-eb">LIGHTING</span><b>Light the scene</b></div><button class="rl-done" data-rl="done" title="Keep these lights (Esc)">DONE</button></div>'+(RL.status?'<p class="rl-s">'+RL.status+'</p>':'');
    h+='<div class="rl-seg"><button data-rl-view="plan" class="'+(RL.view==="plan"?'on':'')+'">FROM ABOVE</button><button data-rl-view="eye" class="'+(RL.view==="eye"?'on':'')+'">EYE LEVEL</button></div>';
    h+='<div class="rl-sec">TIME OF DAY</div><div class="rl-times">'+Object.keys(RL_TIMES).map(function(t){ var T=RL_TIMES[t]; return '<button data-rl-time="'+t+'" class="t-'+t+(rlTimeIs(t)?' on':'')+'"><i></i>'+T.n+'</button>'; }).join("")+'</div>'
      +(RL.sunPow>0?'<div class="rl-sun">'+rlSl("g","sunAz","SUN FROM",RL)+rlSl("g","sunEl","SUN HEIGHT",RL)+'</div>':'');
    h+='<div class="rl-sec">ADD A LIGHT</div><div class="rl-fx">'+Object.keys(RL_FX).map(function(f){ return '<button data-rl-fx="'+f+'"><b>'+RL_FX[f].n+'</b><span>'+RL_FX[f].d+'</span></button>'; }).join("")+'</div>';
    if(RL.lights.length) h+='<div class="rl-sec">YOUR LIGHTS</div><div class="rl-list">'+RL.lights.map(function(l,i){ return '<button data-rl-pick="'+i+'" class="'+(i===RL.sel?'on':'')+(l.on?'':' off')+'"><i style="background:'+rlHex(rlLightRGB(l))+'"></i>'+(i+1)+' · '+l.name+'</button>'; }).join("")+'</div>';
    if(L){ h+='<div class="rl-card"><div class="rl-ch"><i style="background:'+rlHex(rlLightRGB(L))+'"></i><b>'+(RL.sel+1)+' · '+L.name+'</b><button data-rl="onoff">'+(L.on?'ON':'OFF')+'</button><button data-rl="del" title="Delete this light">✕</button></div>'
        +rlSl("l","power","POWER",L)+rlSl("l","k","COLOUR",L)+rlSl("l","h","HEIGHT",L)+(L.type==="spot"?rlSl("l","cone","BEAM",L):'')
        +'<div class="rl-gels"><span>GEL</span>'+RL_GELS.map(function(g){ return '<button data-rl-gel="'+g[0]+'" title="'+g[1]+'" class="'+(L.gel===g[0]?'on':'')+'" style="--g:'+g[0]+'"></button>'; }).join("")+'</div></div>'; }
    h+='<div class="rl-foot">'+rlSl("g","exp","EXPOSURE",RL)+'<div class="rl-row"><button data-rl="shadows" class="'+(RL.shadows?'on':'')+'">SHADOWS '+(RL.shadows?'ON':'OFF')+'</button><button data-rl="natural">NATURAL LIGHT</button></div></div>';
    p.innerHTML=h; }
  var rlT=0;
  function rlInput(e){ var k=e.target.getAttribute("data-rl-k"); if(!k) return; var obj=e.target.getAttribute("data-rl-s")==="l"?rlCur():RL; if(!obj) return;
    var v=RL_SL[k][2](+e.target.value); obj[k]=v; var em=e.target.parentNode.querySelector("em"); if(em) em.textContent=rlShow(k,v); if(k==="h") rlSetPos(obj,obj.x,obj.z);
    var bd=e.target.parentNode.querySelector(".rl-want"); if(bd){ var hit=!!rlWantHit(RL.sel,k); bd.classList.toggle("hit", hit); var wv=e.target.parentNode.querySelector(".rl-wv"); if(wv) wv.classList.toggle("hit", hit); }
    rlApply(); }
  function rlClick(e){ var b=e.target.closest("[data-rl],[data-rl-pick],[data-rl-fx],[data-rl-time],[data-rl-view],[data-rl-gel]"); if(!b) return; e.stopPropagation(); var L=rlCur();
    if(!RL.ready&&!b.hasAttribute("data-rl")) return;
    if(b.hasAttribute("data-rl-fx")) return rlAdd(b.getAttribute("data-rl-fx"));
    if(b.hasAttribute("data-rl-time")){ var T=RL_TIMES[b.getAttribute("data-rl-time")]; RL.dusk=T.dusk; RL.ambK=T.ambK; RL.sunPow=T.sun; RL.sunEl=Math.max(T.el,0); RL.sunK=T.sk; rlPlanUI(); return rlApply(); }
    if(b.hasAttribute("data-rl-view")) return rlView(b.getAttribute("data-rl-view"));
    if(b.hasAttribute("data-rl-pick")){ RL.sel=+b.getAttribute("data-rl-pick"); rlMarkers(); rlPlanUI(); return rlPanel(); }
    if(b.hasAttribute("data-rl-gel")){ if(L){ L.gel=b.getAttribute("data-rl-gel"); rlPlanUI(); rlApply(); } return; }
    var a=b.getAttribute("data-rl");
    if(a==="done") rlClose(); else if(a==="natural") rlNatural(); else if(a==="shadows"){ RL.shadows=!RL.shadows; rlApply(); }
    else if(!L) return; else if(a==="onoff"){ L.on=!L.on; rlPlanUI(); rlApply(); }
    else if(a==="del"){ rlDrop(L); RL.lights.splice(RL.sel,1); RL.sel=Math.min(RL.sel,RL.lights.length-1); rlPlanUI(); rlApply(); } }
  // a new scan: everything starts over
  function rlForget(){ RL.ui=false; RL.plan=false; rlPlanUI(); if(RL.grid&&RL.grid.tex) RL.grid.tex.dispose(); RL.grid=null; RL.gpu=null; RL.target=null; RL.lights.forEach(rlDrop); RL.lights=[]; RL.sel=-1; RL.on=false; RL.ready=false; RL.orig=null; rlPanel(); }
  window.addEventListener("keydown",function(e){ if(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if(RL.ui&&e.code==="Escape"){ e.preventDefault(); e.stopImmediatePropagation(); rlClose(); return; }
    if(e.code==="KeyL"&&loaded&&(App.is("scene")||App.is("viewfinder"))){ e.preventDefault(); rlToggle(); } },true);
  if(/[?&]dev/.test(location.search)) window.__rl={ toggle:rlToggle, open:rlOpen, close:rlClose, add:rlAdd, view:rlView, pick:rlPick, spot:function(i){ var sp=(RL.spots||[])[i], L=RL.lights[sp.i]; if(sp&&L){ var P=rlSpotPos(sp); rlSetPos(L,P.x,P.z); rlApply(); } return !!(sp&&L); }, want:function(){ return RL.want; }, scr:function(i){ var L=RL.lights[i]; return L?rlScr(L.x,L.y,L.z):null; },
    set:function(o){ for(var k in o) RL[k]=o[k]; rlApply(); }, light:function(o){ var L=rlCur(); if(L){ for(var k in o) L[k]=o[k]; rlApply(); } },
    state:function(){ var L=RL.lights[0]; return {sunAz:RL.sunAz, sunPow:RL.sunPow, on:RL.on, ui:!!RL.ui, view:RL.view, ready:RL.ready, N:RL.N, n:RL.lights.length, sel:RL.sel, light:L?{x:L.x,y:L.y,z:L.z}:null, ms:RL.ms, placed:RL.placed||0, moved:RL.moved||0, S:RL.S, planC:RL.planC?{x:RL.planC.x,z:RL.planC.z}:null}; } };
