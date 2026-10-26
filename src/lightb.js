  // ================= LIGHTING B (prototype): a studio kit in your world =================
  /* Loaded after relight.js. It takes over rlOpen / rlClose / rlToggle / rlForget / rlDetail / rlTimeIs (the later
     declaration wins in this shared scope), so the rest of Studium (kit menu, L key, photo capture, quests) talks to
     this rig instead. Ideas being tried:
     - lights have a size: it sets the falloff, how far light wraps round a form, and the shadow edge (sharp grid for
       small or far lights, blurred grid for big close ones)
     - light is added in linear, with a soft shoulder instead of a clip
     - "As scanned" is the scan untouched; the sun follows its real path over Christchurch
     - you stay in eye view: stands in the scene you drag, with a small lighting diagram in the corner
     - your eyes adapt outside the viewfinder, the camera doesn't */
  var RLB={open:false, sunMode:false, mins:19*60+40, day:"today", north:null, dirty:false, sel:-1, walk:false, look:false,
    drag:null, hover:null, play:false, gpu:null, gridS:null, eye:1, built:false, sky:[1,1,1], amb:[1,1,1], sunLin:[0,0,0], sunDir:[0,1,0], el:-90, az:0};
  var RLB_MAX=8;
  var RLB_LAT=-43.53, RLB_LON=172.64;

  /* ---- the kit ---- R is the radius of the light itself, in metres. power is linear: 1 lights a surface as brightly as the scan's own light */
  var RLB_FX={
    bare:{n:"Bare bulb", g:"light", d:"Small and hard, lights everything", kind:0, R:0.04, k:3200, power:4.4, h:1.7},
    fresnel:{n:"Fresnel", g:"light", d:"A focused, hard beam", kind:1, R:0.09, k:3200, power:11, h:1.6, cone:34},
    speed:{n:"Speedlight", g:"light", d:"Small flash, punchy", kind:1, R:0.05, k:5500, power:10, h:1.5, cone:70},
    softbox:{n:"Softbox 90 cm", g:"soften", d:"Big, soft, wraps round", kind:1, R:0.45, k:5500, power:10, h:1.6, cone:150},
    umbrella:{n:"Umbrella", g:"soften", d:"Soft and spills everywhere", kind:1, R:0.5, k:5500, power:9, h:1.8, cone:190},
    strip:{n:"Stripbox", g:"soften", d:"Tall and narrow, for edges", kind:1, R:0.22, k:5500, power:8, h:1.5, cone:130},
    dish:{n:"Beauty dish", g:"soften", d:"Crisp but kind", kind:1, R:0.27, k:5500, power:10, h:1.8, cone:110},
    reflector:{n:"Reflector", g:"shape", d:"Bounces light back in", kind:3, R:0.4, k:5500, power:0, h:0.9, cone:160, surf:"silver"},
    flag:{n:"Black flag", g:"shape", d:"Takes light away", kind:2, R:0.45, k:5500, power:0, h:1.2},
    candle:{n:"Candle", g:"practical", d:"Low and orange", kind:0, R:0.02, k:1900, power:0.7, h:0.16},
    sodium:{n:"Streetlight", g:"practical", d:"Sodium, overhead", kind:1, R:0.15, k:2000, power:18, h:4, cone:120, gel:"#ffb050"},
    rgb:{n:"RGB tube", g:"practical", d:"Any colour", kind:0, R:0.12, k:6500, power:3.2, h:1, gel:"#ff3df0"}};
  var RLB_GROUPS=[["light","Lights"],["soften","Soft lights"],["shape","Shape the light"],["practical","Practicals"]];
  var RLB_SURF={white:{n:"White", a:0.55, c:[1,1,1]}, silver:{n:"Silver", a:0.85, c:[1,1,1]}, gold:{n:"Gold", a:0.8, c:[1,0.78,0.5]}};
  var RLB_ROLEC={Key:"#e3ad57", Fill:"#d8d2c6", Rim:"#8fb3e8", Background:"#b48fe8", Bounce:"#cfc6b5", Flag:"#6f695d", Practical:"#ffb35c"};

  function rbLin(c){ return [Math.pow(c[0],2.2), Math.pow(c[1],2.2), Math.pow(c[2],2.2)]; }
  function rbLum(c){ return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }
  function rbSmooth(a,b,x){ var t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); }
  function rbMix(a,b,t){ return a+(b-a)*t; }

  /* ---- the sun over Christchurch (NOAA's short formulas: good to a fraction of a degree) ---- */
  var RLB_DAYS={today:{n:"Today", m:new Date().getMonth()+1, d:new Date().getDate()}, summer:{n:"Midsummer", m:12, d:21}, winter:{n:"Midwinter", m:6, d:21}};
  function rbDayInfo(){ var D=RLB_DAYS[RLB.day]||RLB_DAYS.today, now=new Date(); var y=now.getFullYear();
    var n=Math.round((Date.UTC(y,D.m-1,D.d)-Date.UTC(y,0,1))/864e5)+1; var tz=(D.m>=4&&D.m<=9)?12:13; return {n:n, tz:tz, m:D.m, d:D.d}; }
  function rbSolar(mins){ var I=rbDayInfo(), hr=mins/60, ut=hr-I.tz, g=2*Math.PI/365*(I.n-1+(ut-12)/24);
    var eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
    var dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
    var tst=mins+eq+4*RLB_LON-60*I.tz, ha=(tst/4-180)*Math.PI/180, la=RLB_LAT*Math.PI/180;
    var ce=Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(ha), el=Math.asin(Math.max(-1,Math.min(1,ce)));
    var az=Math.atan2(Math.sin(ha), Math.cos(ha)*Math.sin(la)-Math.tan(dec)*Math.cos(la))*180/Math.PI+180;
    return {el:el*180/Math.PI, az:((az%360)+360)%360}; }
  /* the moments the timeline marks: where the sun crosses these heights */
  function rbMarks(){ var out={}, prev=rbSolar(4*60).el, cross=[["rise",-0.83,1],["goldAmEnd",6,1],["goldPm",6,-1],["set",-0.83,-1],["blueEnd",-6,-1],["night",-10,-1]];
    for(var m=4*60+5;m<=23*60;m+=5){ var e=rbSolar(m).el; cross.forEach(function(c){ if(out[c[0]]==null&&(c[2]>0?(prev<c[1]&&e>=c[1]):(prev>c[1]&&e<=c[1]))) out[c[0]]=m; }); prev=e; } return out; }
  function rbPhase(el){ if(el>=6) return "day"; if(el>=-0.83) return "golden"; if(el>=-6) return "golden"; if(el>=-10) return "blue"; return "night"; }
  function rbPhaseName(el){ if(el>=20) return "Daylight"; if(el>=6) return "Low sun"; if(el>=-0.83) return "Golden hour"; if(el>=-4) return "Sunset glow"; if(el>=-10) return "Blue hour"; return "Night"; }
  function rbHM(m){ var h=Math.floor(m/60), mm=Math.round(m%60); if(mm===60){ h++; mm=0; } return h+":"+("0"+mm).slice(-2); }

  /* what the sky and sun do for a given height of the sun: levels are linear, 1 is the scan's own light */
  function rbSky(el){
    var dayL=rbSmooth(-10,25,el), sky=0.03+0.5*dayL+0.08*rbSmooth(-6,2,el);
    var skyK=el>8?7200:el>-1?rbMix(9500,7200,rbSmooth(-1,8,el)):el>-10?rbMix(14000,9500,rbSmooth(-10,-1,el)):9000;
    var sunP=rbSmooth(-1.2,3,el)*(0.55+0.6*rbSmooth(2,35,el));
    var sunK=el>30?5600:rbMix(2100,5600,rbSmooth(-1,30,el));
    var skyCol=rbLin(rlRGB(skyK)), sunCol=rbLin(rlRGB(sunK));
    return {amb:[sky*skyCol[0],sky*skyCol[1],sky*skyCol[2]], sun:[sunP*sunCol[0],sunP*sunCol[1],sunP*sunCol[2]], sunP:sunP, skyDim:Math.max(0.04,Math.min(1,0.08+0.92*rbSmooth(-10,10,el))), skyTint:el>-1&&el<10?[1,0.86+0.14*rbSmooth(-1,10,el),0.72+0.28*rbSmooth(-1,10,el)]:el<=-1&&el>-10?[0.72,0.82,1]:[1,1,1]}; }

  /* ---- shadow grids: the blurred one relight.js builds (also normals and sky occlusion) and a sharp one, finer cells, barely blurred ---- */
  function rbGridSharp(){ if(RLB.gridS) return RLB.gridS; var G0=rlGrid(), N=RL.N, P=RL.P, A=RL.A, T=rbTarget(), S=RL.S, gy=rlGround(T.x,T.z);
    /* a box round the subject, where shadows need to be crisp: 7 m each way, a metre below the ground to 5 m above */
    var x0=Math.max(G0.x0,T.x-7*S), z0=Math.max(G0.z0,T.z-7*S), y0=Math.max(G0.y0,gy-1*S), x1=Math.min(G0.x0+G0.nx*G0.cell,T.x+7*S), z1=Math.min(G0.z0+G0.nz*G0.cell,T.z+7*S), y1=Math.min(G0.y0+G0.ny*G0.cell,gy+5*S);
    var ex=x1-x0, ey=y1-y0, ez=z1-z0, cell=Math.max(Math.cbrt(ex*ey*ez/7e6), 0.035*S);
    var nx=Math.max(2,Math.round(ex/cell)), ny=Math.max(2,Math.round(ey/cell)), nz=Math.max(2,Math.round(ez/cell)), i, n=nx*ny*nz;
    var a=new Float32Array(n), b=new Float32Array(n);
    for(i=0;i<N;i++){ var gx=((P[i*3]-x0)/cell)|0, gy=((P[i*3+1]-y0)/cell)|0, gz=((P[i*3+2]-z0)/cell)|0;
      if(gx<0||gy<0||gz<0||gx>=nx||gy>=ny||gz>=nz) continue; a[(gz*ny+gy)*nx+gx]+=A?A[i]:1; }

    /* close the gaps between splat centres: one dilate pass, then one light blur, along each axis */
    var d, x, y, z;
    for(d=0;d<3;d++){ var st=d===0?1:d===1?nx:nx*ny, len=d===0?nx:d===1?ny:nz;
      for(z=0;z<nz;z++) for(y=0;y<ny;y++){ var row=(z*ny+y)*nx; for(x=0;x<nx;x++){ var c=row+x, q=d===0?x:d===1?y:z, m=a[c];
        if(q>0&&a[c-st]>m) m=a[c-st]; if(q<len-1&&a[c+st]>m) m=a[c+st]; b[c]=m*0.55+a[c]*0.45; } }
      var t=a; a=b; b=t; }
    for(d=0;d<3;d++){ var st2=d===0?1:d===1?nx:nx*ny, len2=d===0?nx:d===1?ny:nz;
      for(z=0;z<nz;z++) for(y=0;y<ny;y++){ var row2=(z*ny+y)*nx; for(x=0;x<nx;x++){ var c2=row2+x, q2=d===0?x:d===1?y:z;
        b[c2]=a[c2]*0.6+(q2>0?a[c2-st2]:0)*0.2+(q2<len2-1?a[c2+st2]:0)*0.2; } }
      var t2=a; a=b; b=t2; }
    /* floaters: a lone blob in the air has empty neighbours, a wall or a stump has full ones. Keep a cell only as dense as its 3x3x3 neighbourhood backs up */
    var avg=new Float32Array(a), tmp=new Float32Array(n);
    for(d=0;d<3;d++){ var st3=d===0?1:d===1?nx:nx*ny, len3=d===0?nx:d===1?ny:nz;
      for(z=0;z<nz;z++) for(y=0;y<ny;y++){ var row3=(z*ny+y)*nx; for(x=0;x<nx;x++){ var c3=row3+x, q3=d===0?x:d===1?y:z;
        tmp[c3]=(avg[c3]+(q3>0?avg[c3-st3]:0)+(q3<len3-1?avg[c3+st3]:0))/3; } }
      var t3=avg; avg=tmp; tmp=t3; }
    var keep=RLB.keep||2.5; for(i=0;i<n;i++) a[i]=Math.min(a[i], avg[i]*keep);
    /* scale: stray floaters in the air (the bulk of non-empty cells) count for nothing, the densest surfaces block fully */
    var nzv=[]; for(i=0;i<n;i+=7) if(a[i]>0) nzv.push(a[i]); nzv.sort(function(p,q){ return p-q; });
    var lo=nzv.length?nzv[Math.floor(nzv.length*(RLB.qLo||0.85))]:0, hi=nzv.length?nzv[Math.floor(nzv.length*(RLB.qHi||0.995))]:1, k=(RLB.kS||2)/Math.max(hi-lo,1e-6);
    var h=new Uint16Array(n), HF=THREE.DataUtils.toHalfFloat; for(i=0;i<n;i++){ var v=Math.max(a[i]-lo,0)*k; a[i]=Math.min(v,8); h[i]=HF(a[i]); }
    var tex=new THREE.Data3DTexture(h,nx,ny,nz); tex.format=THREE.RedFormat; tex.type=THREE.HalfFloatType; tex.minFilter=tex.magFilter=THREE.LinearFilter;
    tex.wrapS=tex.wrapT=tex.wrapR=THREE.ClampToEdgeWrapping; tex.unpackAlignment=1; tex.needsUpdate=true;
    RLB.gridS={cell:cell, tex:tex, nx:nx, ny:ny, nz:nz, x0:x0, y0:y0, z0:z0, cpu:/[?&]dev/.test(location.search)?a:null}; return RLB.gridS; }

  /* ---- the GPU side ---- */
  var RLB_GLSL=[
    "precision highp sampler3D;",
    "vec3 rbRot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }",
    "float rbTau(sampler3D G, vec3 p, vec3 o, vec3 inv){ vec3 uv=(p-o)*inv; if(any(lessThan(uv,vec3(0.0)))||any(greaterThan(uv,vec3(1.0)))) return -1.0; return texture(G,uv).r; }",
    "vec3 rbOut(sampler3D G, vec3 p, vec3 o, vec3 inv){ vec3 uv=(p-o)*inv; if(any(lessThan(uv,vec3(0.0)))||any(greaterThan(uv,vec3(1.0)))) return vec3(0.0); return texture(G,uv).gba; }",
    /* inside the sharp box read the sharp grid; outside it, only the solid core of the blurred one (its haze would shade everything) */
    "float rbTauS(sampler3D GB, sampler3D GS, vec3 p, vec3 o, vec3 inv, vec3 so, vec3 sinv){ vec3 u=(p-so)*sinv; if(all(greaterThanEqual(u,vec3(0.0)))&&all(lessThanEqual(u,vec3(1.0)))) return max(texture(GS,u).r-0.06,0.0); float b=rbTau(GB,p,o,inv); return b<0.0?-1.0:max(b-0.8,0.0)*0.5; }",
    /* one ray through the grid: how much light gets through */
    "float rbRay(sampler3D GS, sampler3D GB, vec3 o, vec3 inv, vec3 so, vec3 sinv, float cs, vec3 p, vec3 d, float dist){ float acc=0.0; float st=max(cs*0.9, dist/56.0);",
    "  bool lft=false; for(int i=0;i<56;i++){ float t=cs*1.2+float(i)*st; if(t>dist) break; float v=rbTauS(GB,GS,p+d*t,o,inv,so,sinv); if(v<0.0) break;",
    "    if(!lft){ if(v<0.04||t>cs*3.5) lft=true; else continue; }",   /* first leave the surface this splat sits on, then count what's in the way */
    "    acc+=v*st/cs; if(acc>5.0) break; }",
    "  return exp(-acc); }",
    /* a light with a size: four rays to points across its face, so big lights give soft-edged shadows and small ones hard */
    "float rbVis(sampler3D GS, sampler3D GB, vec3 o, vec3 inv, vec3 so, vec3 sinv, float cs, float cb, vec3 p0, vec3 L, float R, vec3 n){ vec3 p=p0+n*(dot(n,L-p0)>0.0?1.0:-1.0)*cs; vec3 d0=L-p; float dist=length(d0); if(dist<cs*3.0) return 1.0; d0/=dist;",
    "  if(R<cs*0.8) return rbRay(GS,GB,o,inv,so,sinv,cs,p,d0,dist-cs);",
    "  vec3 tu=normalize(cross(d0, abs(d0.y)<0.9?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0))); vec3 tv=cross(d0,tu); float a0=0.7853982; float v=0.0;",
    "  for(int j=0;j<4;j++){ float a=a0+float(j)*1.5707963; vec3 Lj=L+(tu*cos(a)+tv*sin(a))*R*0.7; vec3 dj=Lj-p; float lj=length(dj); v+=rbRay(GS,GB,o,inv,so,sinv,cs,p,dj/lj,lj-cs); }",
    "  return v*0.25; }",
    "float rbVisD(sampler3D GS, sampler3D GB, vec3 o, vec3 inv, vec3 so, vec3 sinv, float cs, float cb, vec3 p0, vec3 d, float ang, vec3 n){ vec3 p=p0+n*(dot(n,d)>0.0?1.0:-1.0)*cs; float acc=0.0; float st=cs*1.1;",
    "  bool lft=false; float t=cs*1.2; for(int i=0;i<120;i++){ t+=st; float v=rbTauS(GB,GS,p+d*t,o,inv,so,sinv); if(v<0.0) break; st*=1.02;",
    "    if(!lft){ if(v<0.04||t>cs*3.5) lft=true; else continue; } acc+=v*st/cs; if(acc>5.0) break; }",
    "  return exp(-acc); }"].join("\n");

  function rbInstall(){ if(RLB.gpu&&RLB.gpu.mesh===viewer.mesh) return; var D=SPARK.dyno, U={}, mesh=viewer.mesh, STM;
    var dummy=new THREE.Data3DTexture(new Uint16Array([0]),1,1,1); dummy.format=THREE.RedFormat; dummy.type=THREE.HalfFloatType; dummy.needsUpdate=true;
    var lt=new THREE.DataTexture(new Float32Array(4*4*RLB_MAX),4,RLB_MAX,THREE.RGBAFormat,THREE.FloatType); lt.needsUpdate=true;
    U.on=D.dynoFloat(0); U.amb=D.dynoVec3(new THREE.Vector3(1,1,1)); U.cam=D.dynoVec3(new THREE.Vector3());
    U.sunOn=D.dynoFloat(0); U.sunDir=D.dynoVec3(new THREE.Vector3(0,1,0)); U.sunCol=D.dynoVec3(new THREE.Vector3()); U.sunAng=D.dynoFloat(0.01);
    U.nl=D.dynoInt(0); U.lt=D.dynoSampler2D(lt); U.is2=D.dynoFloat(1);
    U.shad=D.dynoFloat(1); U.gs=D.dynoSampler3D(dummy); U.gb=D.dynoSampler3D(dummy); U.go=D.dynoVec3(new THREE.Vector3()); U.ginv=D.dynoVec3(new THREE.Vector3(1,1,1)); U.so=D.dynoVec3(new THREE.Vector3()); U.sinv=D.dynoVec3(new THREE.Vector3(1,1,1));
    U.cs=D.dynoFloat(1); U.cb=D.dynoFloat(1); U.dcut=D.dynoVec4(new THREE.Vector4(0,0,-1,0)); U.dcy=D.dynoVec2(new THREE.Vector2(0,0));
    var types={gsplat:D.Gsplat, on:"float", amb:"vec3", cam:"vec3", sunOn:"float", sunDir:"vec3", sunCol:"vec3", sunAng:"float", nl:"int", lt:"sampler2D", is2:"float",
      shad:"float", gs:"sampler3D", gb:"sampler3D", go:"vec3", ginv:"vec3", so:"vec3", sinv:"vec3", cs:"float", cb:"float", dcut:"vec4", dcy:"vec2"};
    function build(U2){ return D.dynoBlock({gsplat:D.Gsplat},{gsplat:D.Gsplat},function(io){ var ins={gsplat:io.gsplat}; for(var k in U2) ins[k]=U2[k];
      var dd=D.dyno({inTypes:types, outTypes:{gsplat:D.Gsplat}, inputs:ins, globals:function(){ return [RLB_GLSL]; },
        statements:STM||(STM=function(c){ var i=c.inputs, o=c.outputs.gsplat, G="("+i.gs+","+i.gb+","+i.go+","+i.ginv+","+i.so+","+i.sinv+","+i.cs+","+i.cb; return [
          o+" = "+i.gsplat+";",
          "if(length("+o+".center.xz-"+i.dcut+".xy)<"+i.dcut+".z && "+o+".center.y>"+i.dcy+".x && "+o+".center.y<"+i.dcy+".y) "+o+".rgba.a=0.0;",
          "if("+i.on+" > 0.5 && isGsplatActive("+o+".flags)){",
          "  vec3 c="+o+".center; vec3 s=abs("+o+".scales);",
          "  int k=(s.x<=s.y && s.x<=s.z)?0:((s.y<=s.z)?1:2); vec3 ax=k==0?vec3(1.0,0.0,0.0):(k==1?vec3(0.0,1.0,0.0):vec3(0.0,0.0,1.0));",
          "  vec3 n=normalize(rbRot("+o+".quaternion, ax));",
          "  float mn=min(s.x,min(s.y,s.z)), mxv=max(s.x,max(s.y,s.z)), md=s.x+s.y+s.z-mn-mxv; float f=clamp(1.0-mn/max(md,1e-6)*1.4,0.0,1.0);",
          "  if(dot(n,"+i.cam+"-c)<0.0) n=-n;",
          "  vec3 gn=rbOut("+i.gb+",c,"+i.go+","+i.ginv+"); float gl=length(gn);",
          "  if(gl>0.08){ gn/=gl; float w=clamp((gl-0.08)*2.5,0.0,1.0); if(dot(n,gn)<0.0) n=-n; n=normalize(mix(n,gn,w*(1.0-0.55*f))); f=max(f,w*0.85); }",
          "  float o1=max(rbTau("+i.gb+",c+n*"+i.cb+"*2.0,"+i.go+","+i.ginv+"),0.0); float ao=clamp(exp(-o1*0.8),0.3,1.0);",
          "  vec3 V=normalize("+i.cam+"-c); vec3 base=pow(max("+o+".rgba.rgb,vec3(0.0)),vec3(2.2));",
          "  vec3 A="+i.amb+"*ao; vec3 Lt=A; vec3 Ls=vec3(0.0);",
          "  if("+i.sunOn+">0.5){ float sl=max(dot(n,"+i.sunDir+"),0.0); float ss=sl*(0.6+0.4*f)+0.12*(1.0-f); if(ss>0.002){ if("+i.shad+">0.5) ss*=rbVisD"+G+",c,"+i.sunDir+","+i.sunAng+",n); Lt+=ss*"+i.sunCol+"; Ls+=pow(max(dot(n,normalize("+i.sunDir+"+V+1e-4)),0.0),40.0)*0.05*f*f*ss*"+i.sunCol+"*min(dot(base,vec3(0.33)),0.5)*2.0; } }",
          "  for(int m=0;m<"+RLB_MAX+";m++){ if(m>="+i.nl+") break;",
          "    vec4 la=texelFetch("+i.lt+",ivec2(0,m),0), lb=texelFetch("+i.lt+",ivec2(1,m),0), le=texelFetch("+i.lt+",ivec2(2,m),0), lf=texelFetch("+i.lt+",ivec2(3,m),0);",
          "    vec3 l=la.xyz-c; float r2=dot(l,l); float d=max(sqrt(r2),1e-5); vec3 Ld=l/d; float R=la.w; float kind=lb.a;",
          "    float E=1.0/(r2*"+i.is2+"+R*R*"+i.is2+"+0.0004);",
          "    if(kind>0.5 && kind<1.5){ float ca=dot(-Ld,le.xyz); float cf=smoothstep(le.w,lf.x,ca); if(cf<=0.0) continue; E*=cf; }",
          "    float wr=clamp(R/d,0.0,1.0)*0.75; float lam=clamp((dot(n,Ld)+wr)/(1.0+wr),0.0,1.0); float sh=lam*(0.6+0.4*f)+(0.12+0.2*wr)*(1.0-f);",
          "    if(kind>1.5){ float fr=clamp(R*R/(2.0*(r2+R*R))*(0.4+sh)*2.6,0.0,0.85); Lt-=A*fr; continue; }",   /* a flag blocks part of the sky's fill */
          "    if("+i.shad+">0.5 && sh>0.002) sh*=rbVis"+G+",c,la.xyz,R,n);",
          "    vec3 li=sh*E*lb.rgb*mix(1.0,ao,0.6); Lt+=li; Ls+=pow(max(dot(n,normalize(Ld+V+1e-4)),0.0),mix(48.0,10.0,clamp(R/d*2.0,0.0,1.0)))*0.05*f*f*li*min(dot(base,vec3(0.33)),0.5)*2.0; }",
          "  vec3 x=base*max(Lt,vec3(0.0))+Ls;",
          "  vec3 sx=mix(x, 0.8+0.2*(vec3(1.0)-exp(-(x-0.8)/0.2)), step(vec3(0.8),x));",   /* a soft shoulder: no hard clip on hot spots */
          "  "+o+".rgba.rgb=pow(sx,vec3(1.0/2.2));",
          "}"]; }) });
      return {gsplat:dd.outputs.gsplat}; }); }
    var mod=build(U); var cut=viewer.cut; if(cut){ U.dcut.value.set(cut[0],cut[1],cut[2],0); U.dcy.value.set(cut[3],cut[4]); }
    mesh.worldModifier=mod; mesh.updateGenerator();
    RLB.gpu={mesh:mesh, U:U, lt:lt, modFor:function(){ var U2={}; for(var k in U) U2[k]=U[k]; U2.dcut=D.dynoVec4(new THREE.Vector4(0,0,-1,0)); return build(U2); }};
    RL.gpu=RLB.gpu; rlDetail(); }
  function rlDetail(){ if(!RLB) return; var dm=viewer&&viewer.detail; if(!dm||!RLB.gpu||RLB.gpu.detail===dm) return; dm.worldModifier=RLB.gpu.modFor(); dm.updateGenerator(); RLB.gpu.detail=dm; }

  /* ---- lights ---- */
  function rbCur(){ return RL.lights[RLB.sel]||null; }
  function rbTarget(){ return RL.target||(RL.target=rlTarget()); }
  function rbEmitRGB(L){ var c=rlLightRGB(L); return rbLin(c); }
  /* light falling on a point from the sun and every other light, ignoring shadows: what a reflector has to bounce */
  function rbIncident(p,nrm){ var acc=[0,0,0], S=RL.S;
    if(RLB.sunMode&&RLB.el>-1){ var sd=RLB.sunDir, c=Math.max(0,sd[0]*nrm[0]+sd[1]*nrm[1]+sd[2]*nrm[2]); acc[0]+=RLB.sunLin[0]*c; acc[1]+=RLB.sunLin[1]*c; acc[2]+=RLB.sunLin[2]*c; }
    RL.lights.forEach(function(L){ if(!L.on||L.kind>=2) return; var lx=L.x-p.x, ly=L.y-p.y, lz=L.z-p.z, d=Math.hypot(lx,ly,lz)||1; lx/=d; ly/=d; lz/=d;
      var cs=Math.max(0,lx*nrm[0]+ly*nrm[1]+lz*nrm[2]); if(!cs) return; var E=1/(d*d/(S*S)+L.R*L.R/(S*S)+0.0004);
      if(L.kind===1){ var ca=-(lx*L.dir[0]+ly*L.dir[1]+lz*L.dir[2]); E*=rbSmooth(Math.cos(L.cone*Math.PI/360), Math.cos(L.cone*Math.PI/360*0.55), ca); }
      var col=rbEmitRGB(L); acc[0]+=col[0]*L.power*E*cs; acc[1]+=col[1]*L.power*E*cs; acc[2]+=col[2]*L.power*E*cs; });
    return acc; }
  /* how much of a light reaches the subject: for roles and the ratio */
  function rbAtSubject(L){ var T=rbTarget(), S=RL.S, lx=T.x-L.x, ly=T.y-L.y, lz=T.z-L.z, d=Math.hypot(lx,ly,lz)||1; var E=1/(d*d/(S*S)+L.R*L.R/(S*S)+0.0004);
    if(L.kind===1||L.kind===3){ var ca=(lx*L.dir[0]+ly*L.dir[1]+lz*L.dir[2])/d; E*=rbSmooth(Math.cos(L.cone*Math.PI/360), Math.cos(L.cone*Math.PI/360*0.55), ca); }
    var p=L.kind===3?L.bounceP:L.power; return rbLum(rbEmitRGB(L))*p*E; }
  function rbRoles(){ var T=rbTarget(), cx=camPos.x-T.x, cz=camPos.z-T.z, cl=Math.hypot(cx,cz)||1, front=[], out={};
    RL.lights.forEach(function(L,i){ if(L.fx==="candle"||L.fx==="sodium"||L.fx==="rgb"){ out[i]="Practical"; return; } if(L.kind===2){ out[i]="Flag"; return; }
      var lx=L.x-T.x, lz=L.z-T.z, ll=Math.hypot(lx,lz)||1, ang=Math.acos(Math.max(-1,Math.min(1,(cx*lx+cz*lz)/(cl*ll))))*180/Math.PI;
      var tx=T.x-L.x, ty=T.y-L.y, tz=T.z-L.z, tl=Math.hypot(tx,ty,tz)||1, aimed=(tx*L.dir[0]+ty*L.dir[1]+tz*L.dir[2])/tl>0.6||L.kind===0;
      L.ang=Math.round(ang); if(!aimed){ out[i]="Background"; return; } if(ang>110){ out[i]="Rim"; return; } if(L.kind===3){ out[i]="Bounce"; return; } front.push(i); });
    var best=-1, bv=-1; front.forEach(function(i){ var v=RL.lights[i].on?rbAtSubject(RL.lights[i]):0; if(v>bv){ bv=v; best=i; } });
    front.forEach(function(i){ out[i]=i===best?"Key":"Fill"; }); RL.lights.forEach(function(L,i){ if(out[i]==="Bounce") out[i]=best>=0?"Fill":"Key"; }); return out; }
  function rbRatio(roles){ var key=0, fill=0, amb=rbLum(RLB.sunMode?RLB.amb:[1,1,1])*0.6;
    RL.lights.forEach(function(L,i){ if(!L.on) return; var v=rbAtSubject(L); if(roles[i]==="Key") key+=v; else if(roles[i]==="Fill") fill+=v; });
    if(RLB.sunMode&&RLB.el>0){ var sk=rbLum(RLB.sunLin)*0.8; if(sk>key){ fill+=key; key=sk; } else fill+=0; }
    fill+=amb; if(key<=0) return null; return (key+fill)/Math.max(fill,1e-3); }
  function rbRatioWord(r){ if(r<1.6) return "flat and even"; if(r<2.6) return "soft and open"; if(r<5) return "classic, with shape"; if(r<9) return "moody"; return "dramatic, deep shadows"; }

  function rbAim(L,p){ var dx=p.x-L.x, dy=p.y-L.y, dz=p.z-L.z, d=Math.hypot(dx,dy,dz)||1; L.dir=[dx/d,dy/d,dz/d]; L.aimT={x:p.x,y:p.y,z:p.z}; }
  function rbPlace(L,x,z){ L.x=x; L.z=z; L.g=rlGround(x,z); L.y=L.g+L.h*RL.S; if(L.aimT) rbAim(L,L.aimT); }
  var RLB_SPOTS=[[45,1.5],[-55,1.9],[155,1.6],[-150,1.8],[100,2.2],[-100,2.2],[20,2.6],[-20,2.6]];
  function rbAdd(fx){ if(RL.lights.length>=RLB_MAX){ toast("That's "+RLB_MAX+" pieces of kit, the most for now"); return; }
    var F=RLB_FX[fx]||RLB_FX.softbox, T=rbTarget(), S=RL.S, ax=camPos.x-T.x, az=camPos.z-T.z, al=Math.hypot(ax,az)||1; ax/=al; az/=al;
    var sp=fx==="reflector"?[-70,1.0]:fx==="flag"?[-80,1.1]:RLB_SPOTS[RL.lights.length%RLB_SPOTS.length];
    var a=sp[0]*Math.PI/180, d=sp[1]*S, ca=Math.cos(a), sa=Math.sin(a);
    var L={id:RL.nid++, on:true, fx:fx, name:F.n, kind:F.kind, type:F.kind===1?"spot":"bulb", power:F.power, base:F.power, stops:0, k:F.k, gel:F.gel||"#ffffff", R:F.R, cone:F.cone||180, h:F.h, surf:F.surf||null, soft:F.R, dir:[0,-1,0], bounceP:0};
    rbPlace(L, T.x+(ax*ca-az*sa)*d, T.z+(ax*sa+az*ca)*d); rbAim(L, fx==="sodium"?{x:L.x,y:L.g,z:L.z}:T);
    RL.lights.push(L); RLB.sel=RL.lights.length-1; RL.placed=(RL.placed||0)+1; RL.on=true; rbStands(); rbPanel(true); rbDirty(); }
  function rbRemove(i){ var L=RL.lights[i]; if(!L) return; rbDropStand(L); RL.lights.splice(i,1); RLB.sel=Math.min(RLB.sel,RL.lights.length-1); rbPanel(true); rbDirty(); }

  /* ---- push it all to the GPU (at most once a frame) ---- */
  function rbDirty(){ RLB.dirty=true; }
  function rbIdentity(){ return !RLB.sunMode&&!RL.lights.some(function(L){ return L.on; }); }
  function rbApply(){ RLB.dirty=false; RLB.nApply=(RLB.nApply||0)+1; if(!RL.ready||!RLB.gpu) return; var G0=RLB.gpu, U=G0.U;
    if(rbIdentity()){ rbRestore(); RLB.eye=1; return; }
    if(G0.mesh.maxSh>0){ G0.mesh.__sh=G0.mesh.maxSh; G0.mesh.maxSh=0; G0.mesh.updateGenerator(); setTimeout(function(){ G0.mesh.updateGenerator(); G0.mesh.updateVersion(); },300); }
    var amb=[1,1,1], sunOn=false;
    if(RLB.sunMode){ var so=rbSolar(RLB.mins), sk=rbSky(so.el); RLB.el=so.el; RLB.az=so.az; amb=sk.amb; RLB.sunLin=sk.sun;
      var a=(so.az+RLB.north)*Math.PI/180, e=Math.max(so.el,0.6)*Math.PI/180; RLB.sunDir=[Math.cos(e)*Math.sin(a), Math.sin(e), Math.cos(e)*Math.cos(a)];
      sunOn=sk.sunP>0.002; RL.sunAz=((so.az+RLB.north)%360+360)%360; RL.sunEl=so.el; RL.sunPow=sunOn?sk.sunP:0;
      if(typeof SKY!=="undefined"&&SKY.mesh){ var su=SKY.mesh.material.uniforms; su.dim.value=sk.skyDim; if(su.tint) su.tint.value.set(sk.skyTint[0],sk.skyTint[1],sk.skyTint[2]); } }
    else { RL.sunPow=0; if(typeof SKY!=="undefined"&&SKY.mesh){ var su2=SKY.mesh.material.uniforms; su2.dim.value=RL.lights.some(function(L){ return L.on; })?1:1; if(su2.tint) su2.tint.value.set(1,1,1); } }
    RLB.amb=amb;
    U.on.value=1; U.amb.value.set(amb[0],amb[1],amb[2]); U.cam.value.set(camPos.x,camPos.y,camPos.z); U.is2.value=1/(RL.S*RL.S);
    U.sunOn.value=sunOn?1:0; if(sunOn){ U.sunDir.value.set(RLB.sunDir[0],RLB.sunDir[1],RLB.sunDir[2]); U.sunCol.value.set(RLB.sunLin[0],RLB.sunLin[1],RLB.sunLin[2]); U.sunAng.value=RLB.el<8?0.03:0.012; }
    /* reflectors: work out what lands on each, then it becomes a soft light of that strength */
    RL.lights.forEach(function(L){ if(L.kind!==3) return; var S=RLB_SURF[L.surf||"silver"], inc=rbIncident({x:L.x,y:L.y,z:L.z}, L.dir), f=S.a*0.5;
      L.bounce=[inc[0]*S.c[0]*f, inc[1]*S.c[1]*f, inc[2]*S.c[2]*f]; L.bounceP=rbLum(L.bounce)/Math.max(rbLum(rbEmitRGB(L)),1e-4); });
    var on=RL.lights.filter(function(L){ return L.on&&(L.kind!==3||rbLum(L.bounce||[0,0,0])>1e-4); }), lt=G0.lt.image.data; lt.fill(0);
    on.slice(0,RLB_MAX).forEach(function(L,m){ var c=L.kind===3?L.bounce:rbEmitRGB(L), p=L.kind===3?1:L.power, half=Math.min(L.cone,179)*Math.PI/360, kd=L.kind===3?1:L.kind, o=m*16;
      if(L.kind===1&&L.cone>=180) kd=1;
      lt.set([L.x,L.y,L.z,L.R*RL.S, c[0]*p,c[1]*p,c[2]*p, kd, L.dir[0],L.dir[1],L.dir[2], L.cone>=180?Math.cos(Math.PI*0.5+0.35):Math.cos(half), L.cone>=180?Math.cos(Math.PI*0.25):Math.cos(half*0.55),0,0,0], o); });
    G0.lt.needsUpdate=true; U.nl.value=Math.min(on.length,RLB_MAX);
    var G=rlGrid(), GS=rbGridSharp(); U.gs.value=GS.tex; U.gb.value=G.tex; U.go.value.set(G.x0,G.y0,G.z0); U.ginv.value.set(1/(G.nx*G.cell),1/(G.ny*G.cell),1/(G.nz*G.cell)); U.cs.value=GS.cell; U.cb.value=G.cell; U.so.value.set(GS.x0,GS.y0,GS.z0); U.sinv.value.set(1/(GS.nx*GS.cell),1/(GS.ny*GS.cell),1/(GS.nz*GS.cell));
    U.shad.value=RL.shadows?1:0;
    G0.mesh.updateVersion(); rlDetail(); var dm=viewer&&viewer.detail; if(dm&&G0.detail===dm){ if(dm.maxSh>0){ dm.__sh=dm.maxSh; dm.maxSh=0; dm.updateGenerator(); } dm.updateVersion(); }
    /* your eyes: how bright is it round the subject? */
    var lvl=rbLum(amb); if(sunOn) lvl+=rbLum(RLB.sunLin)*0.55; RL.lights.forEach(function(L){ if(L.on&&L.kind!==2) lvl+=rbAtSubject(L)*0.4; });
    RLB.eye=Math.max(1,Math.min(3.5,Math.pow(0.75/Math.max(lvl,0.01),0.6))); }
  function rbRestore(){ if(!RLB.gpu) return; RLB.gpu.U.on.value=0; var M=RLB.gpu.mesh; if(M.__sh!=null){ M.maxSh=M.__sh; M.__sh=null; M.updateGenerator(); } M.updateVersion();
    var dm=RLB.gpu.detail; if(dm){ if(dm.__sh!=null){ dm.maxSh=dm.__sh; dm.__sh=null; dm.updateGenerator(); } dm.updateVersion(); }
    if(typeof SKY!=="undefined"&&SKY.mesh){ var su=SKY.mesh.material.uniforms; su.dim.value=1; if(su.tint) su.tint.value.set(1,1,1); } RL.sunPow=0; }
  /* the display's exposure outside the viewfinder (app.js asks): eyes adapt, the camera doesn't */
  function rlbEye(){ if(!RLB) return 1; if(RLB.eyeLock) return RLB.eyeLock; return RLB.open||RL.on?RLB.eye:1; }
  function rlbWalk(){ if(!RLB) return false; return RLB.open&&!viewfinderOn; }

  /* quests and photos ask which time of day it is */
  function rlTimeIs(t){ if(!RLB||!RLB.sunMode) return t==="day"; return rbPhase(RLB.el)===t; }

  /* ---- stands in the scene ---- */
  var _rbMat={};
  function rbM(c,o){ var k=c+"|"+(o||1); if(!_rbMat[k]) _rbMat[k]=new THREE.MeshBasicMaterial({color:c, transparent:(o||1)<1, opacity:o||1, depthWrite:(o||1)>=1}); return _rbMat[k]; }
  /* the kit, modelled in Blender (tools/build_kit.py): loaded once, then each light gets its own copy */
  var RLB_KIT=null, RLB_KITP=null;
  var RLB_MOUNT={fresnel:0.18, speed:0.12, softbox:0.14, strip:0.14, umbrella:0.14, dish:0.14, reflector:0.52, flag:0.56, bare:0.085, rgb:0.06, sodium:0.3, candle:0};   /* how far below the light its stand stops */
  function rbKit(){ if(RLB_KIT||RLB_KITP||typeof GLTFLoader==="undefined"||typeof assetBytes!=="function") return;
    RLB_KITP=assetBytes("asset-b64:assets/kit/lightkit.glb").then(function(ab){ new GLTFLoader().parse(ab,"",function(g){ RLB_KIT=g.scene;
      /* shiny metal needs something to reflect: a soft studio room, used by the kit's materials only (never the scene background) */
      var env=null; try{ if(typeof RoomEnvironment!=="undefined"){ var pm=new THREE.PMREMGenerator(renderer); env=pm.fromScene(new RoomEnvironment(),0.04).texture; pm.dispose(); } }catch(e){ env=null; }
      RLB_KIT.traverse(function(o){ if(o.isMesh&&o.material){ if(env){ o.material.envMap=env; o.material.envMapIntensity=0.55; } else o.material.metalness=Math.min(o.material.metalness,0.3); } }); RL.lights.forEach(rbDropStand); rbStands(); }, function(e){ console.warn("lighting kit",e); }); }).catch(function(e){ console.warn("lighting kit",e); }); }
  function rbKitPart(n){ var o=RLB_KIT&&RLB_KIT.getObjectByName(n); return o?o.clone(true):null; }
  function rbKitLights(){ if(!scene||scene.userData.rbLit) return; scene.userData.rbLit=true;   /* only the kit's own materials take light; splats don't */
    scene.add(new THREE.HemisphereLight(0xfff1de,0x2a251e,1.6)); var d=new THREE.DirectionalLight(0xffffff,1.5); d.position.set(2,4,3); scene.add(d); }
  function rbStandFor(L){ var g=new THREE.Group(), P={emit:[], surf:[]};
    if(RLB_KIT){ rbKitLights();
      ["stand_base","stand_pole","stand_top","street_post"].forEach(function(n){ var o=rbKitPart(n); if(o){ o.position.set(0,0,0); g.add(o); P[n]=o; } });
      var fx=rbKitPart("fx_"+L.fx); if(fx){ fx.position.set(0,0,0); g.add(fx); P.fx=fx; P.head=fx.getObjectByName(L.fx+"_head"); P.yoke=fx.getObjectByName(L.fx+"_yoke"); }
      g.traverse(function(o){ if(!o.isMesh) return; var mn=o.material&&o.material.name;
        if(mn==="Emit"){ o.material=new THREE.MeshStandardMaterial({color:0x101010, emissive:0xffffff, roughness:0.6, side:THREE.DoubleSide}); P.emit.push(o.material); }
        else if(mn==="Surf"){ o.material=o.material.clone(); P.surf.push(o.material); }
        else if(o.material&&o.material.side!==THREE.DoubleSide&&/Fabric|WhiteIn|Silver/.test(mn||"")){ o.material=o.material.clone(); o.material.side=THREE.DoubleSide; } }); }
    else { var hd=new THREE.Group(); hd.add(new THREE.Mesh(new THREE.SphereGeometry(0.05,16,12), new THREE.MeshBasicMaterial({color:0xfff4e0}))); g.add(hd); P.head=hd; P.fx=hd; P.basic=hd.children[0].material; }
    var aim=new THREE.Mesh(new THREE.SphereGeometry(0.035,16,12), new THREE.MeshBasicMaterial({color:0xe3ad57})); aim.name="aim"; g.add(aim);
    var ring=new THREE.Mesh(new THREE.RingGeometry(0.5,0.54,48), new THREE.MeshBasicMaterial({color:0xe3ad57, side:THREE.DoubleSide, transparent:true, opacity:0.9})); ring.rotation.x=-Math.PI/2; ring.name="ring"; g.add(ring);
    var beamG=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,1)]); var beam=new THREE.Line(beamG, new THREE.LineDashedMaterial({color:0xe3ad57, dashSize:0.06, gapSize:0.05, transparent:true, opacity:0.7})); beam.name="beam"; g.add(beam);
    g.userData.P=P; g.userData.L=L; g.traverse(function(o){ o.userData.L=L; o.renderOrder=5; }); return g; }
  function rbDropStand(L){ if(L.stand){ scene.remove(L.stand); L.stand=null; } }   /* geometry is shared with the kit: never dispose it */
  var RLB_SURFC={white:0xf0ede6, silver:0xc9ccd2, gold:0xd8ae5c};
  function rbStands(){ if(typeof scene==="undefined"||!scene) return; rbKit(); var S=RL.S, show=RLB.open&&!viewfinderOn;
    RL.lights.forEach(function(L,i){ if(L.stand&&L.stand.userData.fx!==L.fx+"|"+(RLB_KIT?1:0)){ rbDropStand(L); }
      if(!L.stand){ L.stand=rbStandFor(L); L.stand.userData.fx=L.fx+"|"+(RLB_KIT?1:0); scene.add(L.stand); }
      var st=L.stand, P=st.userData.P, top=(L.y-L.g)/S; st.visible=show; st.position.set(L.x,L.g,L.z); st.scale.setScalar(S);
      var ts=top-(RLB_MOUNT[L.fx]||0), tri=L.fx!=="candle"&&L.fx!=="sodium", k=Math.min(1,Math.max(0.15,ts/0.75));
      if(P.stand_base){ P.stand_base.visible=P.stand_pole.visible=P.stand_top.visible=tri; P.stand_base.scale.setScalar(k);
        P.stand_pole.position.y=0.66*k; P.stand_pole.scale.y=Math.max(0.001,ts-0.03-0.66*k); P.stand_pole.visible=tri&&ts-0.03>0.66*k; P.stand_top.position.y=ts-0.03; }
      if(P.street_post){ P.street_post.visible=L.fx==="sodium"; P.street_post.scale.y=Math.max(0.01,ts); }
      if(P.fx) P.fx.position.y=top;
      var yaw=Math.atan2(L.dir[0],L.dir[2]), pitch=-Math.asin(Math.max(-1,Math.min(1,L.dir[1]))), turns=L.kind!==0||L.fx==="rgb";
      if(P.yoke) P.yoke.rotation.set(0,turns?yaw:0,0);
      if(P.head){ if(L.kind!==0) P.head.rotation.set(pitch,yaw,0,"YXZ"); else P.head.rotation.set(0,turns?yaw:0,0); }
      var c=rlLightRGB(L), m=Math.max(c[0],c[1],c[2],1e-4), on=L.on?1:0.04;
      P.emit.forEach(function(mt){ mt.emissive.setRGB(c[0]/m*on,c[1]/m*on,c[2]/m*on); });
      P.surf.forEach(function(mt){ mt.color.setHex(RLB_SURFC[L.surf||"silver"]); mt.metalness=L.surf==="white"?0:1; mt.roughness=L.surf==="white"?0.8:0.3; });
      if(P.basic) P.basic.color.setRGB(c[0]/m*on,c[1]/m*on,c[2]/m*on);
      var aim=st.getObjectByName("aim"), ad=0.55; aim.position.set(L.dir[0]*ad, top+L.dir[1]*ad, L.dir[2]*ad); aim.visible=i===RLB.sel&&L.kind!==0;
      st.getObjectByName("ring").visible=i===RLB.sel; st.getObjectByName("ring").position.y=0.01;
      var beam=st.getObjectByName("beam"); beam.visible=!!(i===RLB.sel&&L.aimT&&L.kind!==0); if(beam.visible){ var p=beam.geometry.attributes.position; p.setXYZ(0,0,top,0); p.setXYZ(1,(L.aimT.x-L.x)/S,(L.aimT.y-L.g)/S,(L.aimT.z-L.z)/S); p.needsUpdate=true; beam.computeLineDistances(); } }); }

  /* ---- pointer: drag a stand to move it, drag its gold dot to aim, scroll on it to raise, right-drag to look ---- */
  var _rbRay=new THREE.Raycaster(), _rbPl=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  function rbNdc(e){ return {x:e.clientX/innerWidth*2-1, y:-(e.clientY/innerHeight)*2+1}; }
  function rbHit(e){ _rbRay.setFromCamera(rbNdc(e),camera); var objs=[]; RL.lights.forEach(function(L){ if(L.stand&&L.stand.visible) L.stand.traverse(function(o){ if(o.isMesh&&o.visible) objs.push(o); }); });
    var h=_rbRay.intersectObjects(objs,false); if(!h.length) return null; var o=h[0].object; return {L:o.userData.L, aim:o.name==="aim", head:!!(o.parent&&o.parent.name==="head")}; }
  function rbOnPlane(e,y){ _rbRay.setFromCamera(rbNdc(e),camera); _rbPl.constant=-y; var o=new THREE.Vector3(); return _rbRay.ray.intersectPlane(_rbPl,o)?o:null; }
  function rbOnCanvas(e){ return RLB.open&&e.target===renderer.domElement; }
  window.addEventListener("pointerdown",function(e){ if(!rbOnCanvas(e)) return; e.stopImmediatePropagation(); e.preventDefault(); var ae=document.activeElement; if(ae&&ae.closest&&ae.closest("#rbPanel,#rbTime")) ae.blur();
    if(e.button===2){ RLB.look=true; RLB.lx=e.clientX; RLB.ly=e.clientY; return; }
    if(e.button!==0) return; var h=rbHit(e);
    if(h){ var i=RL.lights.indexOf(h.L); RLB.sel=i; var L=h.L, p=rbOnPlane(e,L.g); RLB.drag={L:L, aim:h.aim, ox:p?L.x-p.x:0, oz:p?L.z-p.z:0, moved:false}; rbPanel(true); rbStands(); }
    else { RLB.drag={pan:true, x:e.clientX, y:e.clientY}; }
  },true);
  window.addEventListener("pointermove",function(e){ if(!RLB.open) return;
    if(RLB.look){ yaw-=(e.clientX-RLB.lx)*sens*2.2; pitch-=(e.clientY-RLB.ly)*sens*2.2; pitch=Math.max(-1.55,Math.min(1.55,pitch)); RLB.lx=e.clientX; RLB.ly=e.clientY; return; }
    var D=RLB.drag; if(!D){ if(e.target===renderer.domElement){ var h=rbHit(e); renderer.domElement.style.cursor=h?(h.aim?"crosshair":"grab"):"default"; } return; }
    if(D.pan){ if(Math.hypot(e.clientX-D.x,e.clientY-D.y)>4){ RLB.look=true; RLB.lx=e.clientX; RLB.ly=e.clientY; RLB.drag=null; } return; }
    var L=D.L; if(D.aim){ _rbRay.setFromCamera(rbNdc(e),camera); var pk=rbPickRay(); if(pk) rbAim(L,pk); else { var g=rbOnPlane(e,rbTarget().y); if(g) rbAim(L,{x:g.x,y:rbTarget().y,z:g.z}); } }
    else { var p=rbOnPlane(e,L.g); if(p) rbPlace(L,p.x+D.ox,p.z+D.oz); }
    D.moved=true; rbStands(); rbPanel(false); rbDirty(); },true);
  window.addEventListener("pointerup",function(e){ if(!RLB.open) return; var D=RLB.drag; RLB.drag=null;
    if(RLB.look){ RLB.look=false; return; } if(D&&D.pan){ RLB.sel=-1; rbStands(); rbPanel(true); } if(D&&D.L&&D.moved) RL.moved=(RL.moved||0)+1; },true);
  window.addEventListener("click",function(e){ if(rbOnCanvas(e)){ e.stopImmediatePropagation(); e.preventDefault(); } },true);
  window.addEventListener("mousedown",function(e){ if(rbOnCanvas(e)){ e.stopImmediatePropagation(); } },true);
  window.addEventListener("contextmenu",function(e){ if(rbOnCanvas(e)){ e.preventDefault(); e.stopImmediatePropagation(); } },true);
  window.addEventListener("wheel",function(e){ if(!rbOnCanvas(e)) return; var h=rbHit(e), L=h?h.L:rbCur(); if(!L) return; e.preventDefault(); e.stopImmediatePropagation();
    L.h=Math.max(0.1,Math.min(5,L.h+(e.deltaY<0?0.05:-0.05))); rbPlace(L,L.x,L.z); RLB.sel=RL.lights.indexOf(L); rbStands(); rbPanel(false); rbDirty(); },{capture:true, passive:false});
  /* the splat along the pointer ray, for aiming at what you point at */
  function rbPickRay(){ if(!RL.ready) return null; var P=RL.P, N=RL.N, o=_rbRay.ray.origin, f=_rbRay.ray.direction, best=-1, bt=1e30, mt=0.05*RL.S;
    for(var i=0;i<N;i+=2){ var vx=P[i*3]-o.x, vy=P[i*3+1]-o.y, vz=P[i*3+2]-o.z, t=vx*f.x+vy*f.y+vz*f.z; if(t<mt||t>=bt) continue;
      var p2=vx*vx+vy*vy+vz*vz-t*t, lim=t*0.012+0.004*RL.S; if(p2<lim*lim){ bt=t; best=i; } }
    return best<0||bt>25*RL.S?null:{x:P[best*3], y:P[best*3+1], z:P[best*3+2]}; }
  function rbAway(){ return menuOpen()||!(App.is("scene")||App.is("viewfinder")); }
  window.addEventListener("keydown",function(e){ if(!RLB.open||rbAway()||(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if(e.code==="Escape"){ e.preventDefault(); e.stopImmediatePropagation(); rlClose(); return; }
    if((e.code==="Delete"||e.code==="Backspace")&&rbCur()){ e.preventDefault(); e.stopImmediatePropagation(); rbRemove(RLB.sel); return; }
 },true);

  /* ---- the corner diagram: a photographer's lighting sketch, live, and you can drag in it ---- */
  var RLB_DW=230;
  function rbDiagGeom(){ var T=rbTarget(), pts=[[T.x,T.z],[camPos.x,camPos.z]]; RL.lights.forEach(function(L){ pts.push([L.x,L.z]); });
    var r=1.2*RL.S; pts.forEach(function(p){ r=Math.max(r,Math.hypot(p[0]-T.x,p[1]-T.z)); });
    var fx=new THREE.Vector3(); camera.getWorldDirection(fx); var ang=Math.atan2(fx.x,fx.z);   /* rotate so you're at the bottom looking up */
    return {T:T, sc:(RLB_DW/2-22)/(r*1.12), ca:Math.cos(ang), sa:Math.sin(ang)}; }
  function rbD2S(G,x,z){ var dx=x-G.T.x, dz=z-G.T.z, u=dx*G.ca-dz*G.sa, v=dx*G.sa+dz*G.ca; return {x:RLB_DW/2-u*G.sc, y:RLB_DW/2-v*G.sc}; }
  function rbS2D(G,sx,sy){ var u=(RLB_DW/2-sx)/G.sc, v=(RLB_DW/2-sy)/G.sc; return {x:G.T.x+u*G.ca+v*G.sa, z:G.T.z-u*G.sa+v*G.ca}; }
  function rbDiagDraw(){ var cv=$("rbDiag"); if(!cv||!RLB.open) return; var dpr=Math.min(2,devicePixelRatio||1), W=RLB_DW;
    if(cv.width!==W*dpr){ cv.width=W*dpr; cv.height=W*dpr; } var c=cv.getContext("2d"); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,W);
    var G=rbDiagGeom(), S=RL.S, m1=G.sc*S, roles=RLB.roles||{};
    c.strokeStyle="rgba(216,210,198,.07)"; c.lineWidth=1; for(var gi=-6;gi<=6;gi++){ var o=W/2+gi*m1; if(o<0||o>W) continue; c.beginPath(); c.moveTo(o,0); c.lineTo(o,W); c.stroke(); c.beginPath(); c.moveTo(0,o); c.lineTo(W,o); c.stroke(); }
    var T=rbD2S(G,G.T.x,G.T.z), Y=rbD2S(G,camPos.x,camPos.z);
    c.setLineDash([3,4]); c.strokeStyle="rgba(239,233,221,.35)"; c.beginPath(); c.moveTo(Y.x,Y.y); c.lineTo(T.x,T.y); c.stroke(); c.setLineDash([]);
    if(RLB.sunMode&&RLB.el>-6){ var a=(RLB.az+RLB.north)*Math.PI/180, sxp=rbD2S(G,G.T.x+Math.sin(a)*99,G.T.z+Math.cos(a)*99), vx=sxp.x-W/2, vy=sxp.y-W/2, vl=Math.hypot(vx,vy)||1, sp={x:W/2+vx/vl*(W/2-12), y:W/2+vy/vl*(W/2-12)};
      c.strokeStyle="rgba(255,179,92,.55)"; c.beginPath(); c.moveTo(sp.x,sp.y); c.lineTo(T.x,T.y); c.stroke(); c.fillStyle=RLB.el>0?"#ffb35c":"#8fb3e8"; c.beginPath(); c.arc(sp.x,sp.y,6,0,7); c.fill(); }
    var nA=RLB.north*Math.PI/180, np=rbD2S(G,G.T.x+Math.sin(nA)*99,G.T.z+Math.cos(nA)*99), nvx=np.x-W/2, nvy=np.y-W/2, nl=Math.hypot(nvx,nvy)||1; RLB.nScr={x:W/2+nvx/nl*(W/2-12), y:W/2+nvy/nl*(W/2-12)};
    c.fillStyle="rgba(216,210,198,.6)"; c.font="600 10px 'Geist Mono',monospace"; c.textAlign="center"; c.textBaseline="middle"; c.fillText("N",RLB.nScr.x,RLB.nScr.y);
    RL.lights.forEach(function(L,i){ var p=rbD2S(G,L.x,L.z), col=RLB_ROLEC[roles[i]]||"#d8d2c6", sel=i===RLB.sel, q=rbD2S(G,L.x+L.dir[0],L.z+L.dir[2]), dx=q.x-p.x, dy=q.y-p.y, dl=Math.hypot(dx,dy)||1;
      if(L.kind!==0&&L.kind!==2){ var w=Math.min(L.cone,170)*Math.PI/360, an=Math.atan2(dy,dx), len=Math.min(80,Math.hypot(T.x-p.x,T.y-p.y)*1.15);
        c.fillStyle=L.on?"rgba(227,173,87,"+(sel?0.22:0.1)+")":"rgba(80,74,65,.1)"; c.beginPath(); c.moveTo(p.x,p.y); c.arc(p.x,p.y,len,an-w,an+w); c.closePath(); c.fill(); }
      c.save(); c.translate(p.x,p.y); c.rotate(Math.atan2(dy,dx)+Math.PI/2); c.fillStyle=L.on?col:"#4f4a41";
      var sz=Math.max(4,Math.min(22,L.R*2*m1));
      if(L.kind===0){ c.beginPath(); c.arc(0,0,5,0,7); c.fill(); } else if(L.kind===2){ c.fillStyle="#17140f"; c.strokeStyle=col; c.fillRect(-sz/2,-2,sz,4); c.strokeRect(-sz/2,-2,sz,4); }
      else { c.fillRect(-sz/2,-3,sz,6); } c.restore();
      if(sel){ c.strokeStyle="#e3ad57"; c.lineWidth=1.5; c.beginPath(); c.arc(p.x,p.y,11,0,7); c.stroke(); c.lineWidth=1; }
      c.fillStyle="rgba(239,233,221,.8)"; c.font="9px 'Geist Mono',monospace"; c.fillText(String(i+1),p.x+12,p.y-9); });
    c.strokeStyle="#e3ad57"; c.lineWidth=1.5; c.beginPath(); c.arc(T.x,T.y,7,0,7); c.stroke(); c.lineWidth=1;
    c.fillStyle="#efe9dd"; c.beginPath(); c.moveTo(Y.x,Y.y-7); c.lineTo(Y.x-5,Y.y+4); c.lineTo(Y.x+5,Y.y+4); c.closePath(); c.fill();
    c.fillStyle="rgba(141,134,120,.9)"; c.textAlign="left"; c.fillText("1 SQUARE = 1 M",8,W-9); }
  function rbDiagDown(e){ e.preventDefault(); e.stopPropagation(); var cv=$("rbDiag"), r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, G=rbDiagGeom(), best=-1, bd=16;
    if(RLB.nScr&&Math.hypot(RLB.nScr.x-x,RLB.nScr.y-y)<14){ RLB.ddrag={north:true}; }
    else { RL.lights.forEach(function(L,i){ var p=rbD2S(G,L.x,L.z), d=Math.hypot(p.x-x,p.y-y); if(d<bd){ bd=d; best=i; } }); if(best<0) return; RLB.sel=best; RLB.ddrag={i:best}; rbPanel(true); rbStands(); }
    cv.setPointerCapture(e.pointerId); }
  function rbDiagMove(e){ var D=RLB.ddrag; if(!D) return; var cv=$("rbDiag"), r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, G=rbDiagGeom();
    if(D.north){ var w=rbS2D(G,x,y); RLB.north=((Math.atan2(w.x-G.T.x,w.z-G.T.z)*180/Math.PI)%360+360)%360; rbDirty(); rbPanel(false); return; }
    var L=RL.lights[D.i], w2=rbS2D(G,x,y); if(L){ rbPlace(L,w2.x,w2.z); rbStands(); rbPanel(false); rbDirty(); } }

  /* ---- the timeline: as scanned, or the sun at a real time of day ---- */
  var RLB_T0=4*60+30, RLB_T1=23*60;
  function rbTimeline(){ var tl=$("rbTime"); if(!tl) return; var M=rbMarks(), so=rbSolar(RLB.mins), pct=function(m){ return ((m-RLB_T0)/(RLB_T1-RLB_T0)*100).toFixed(2)+"%"; };
    var stops=[]; for(var m=RLB_T0;m<=RLB_T1;m+=30){ var e=rbSolar(m).el, col=e>=20?"#6f7f8f":e>=6?"#8a7a5a":e>=-0.83?"#c27a3a":e>=-6?"#6a4a6a":e>=-10?"#2e3a66":"#12141e"; stops.push(col+" "+pct(m)); }
    var marks=[["rise","Sunrise"],["goldPm","Golden hour"],["set","Sunset"],["blueEnd","Dark"]].filter(function(k){ return M[k[0]]!=null; });
    tl.innerHTML='<div class="rb-tl-h"><button data-rb="scan" class="'+(RLB.sunMode?'':'on')+'">AS SCANNED</button><div class="rb-days">'+Object.keys(RLB_DAYS).map(function(k){ return '<button data-rb-day="'+k+'" class="'+(RLB.day===k?'on':'')+'">'+RLB_DAYS[k].n+'</button>'; }).join("")+'</div>'
      +'<b class="rb-now">'+(RLB.sunMode?rbHM(RLB.mins)+' · '+rbPhaseName(so.el)+' · sun '+Math.round(so.el)+'°':'The scan, just as it was captured')+'</b><button data-rb="play" class="'+(RLB.play?'on':'')+'">'+(RLB.play?'PAUSE':'PLAY THE DAY')+'</button></div>'
      +'<div class="rb-track'+(RLB.sunMode?'':' off')+'" style="background:linear-gradient(90deg,'+stops.join(",")+')">'+marks.map(function(k,j){ return '<i style="left:'+pct(M[k[0]])+'"><span class="'+(j%2?'lo':'')+'">'+k[1]+' '+rbHM(M[k[0]])+'</span></i>'; }).join("")+'<em style="left:'+pct(RLB.mins)+'"></em></div>'; }
  function rbTimeAt(e){ var tr=document.querySelector("#rbTime .rb-track"); if(!tr) return; var r=tr.getBoundingClientRect(), t=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    RLB.mins=Math.round((RLB_T0+t*(RLB_T1-RLB_T0))/5)*5; if(!RLB.sunMode) rbSunOn(); rbDirty(); rbTimeline(); rbPanel(false); }
  function rbSunOn(){ RLB.sunMode=true; RL.on=true; if(RLB.north==null){ var f=new THREE.Vector3(); camera.getWorldDirection(f); var view=Math.atan2(f.x,f.z)*180/Math.PI, M=rbMarks(), sa=rbSolar(M.goldPm||19*60+30).az; RLB.north=((view+140-sa)%360+360)%360; } }

  /* ---- the panel ---- */
  var RLB_CSS="#rbPanel{position:fixed;right:20px;top:20px;bottom:120px;z-index:960;width:318px;overflow-y:auto;padding:18px 18px 14px;border-radius:14px;background:rgba(15,13,10,.94);border:1px solid rgba(216,210,198,.1);color:#efe9dd;font-family:var(--sans);display:none;scrollbar-width:thin}"
    +"#rbPanel.show,#rbTime.show,#rbDiagW.show,#rbTip.show{display:block}"
    +"#rbPanel .rb-h{display:flex;justify-content:space-between;align-items:flex-start}#rbPanel .rb-eb{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--accent)}#rbPanel .rb-h b{display:block;margin-top:4px;font-family:var(--serif);font-weight:400;font-size:24px}"
    +"#rbPanel button{font:inherit;color:inherit;cursor:pointer}#rbPanel .rb-done{background:var(--accent);color:#17140d;border:0;border-radius:8px;padding:9px 14px;font-family:var(--mono);font-size:11px;letter-spacing:.14em}"
    +"#rbPanel .rb-sec{margin:16px 0 8px;font-family:var(--mono);font-size:10px;letter-spacing:.18em;color:#8d8678}"
    +"#rbPanel .rb-kit{display:flex;flex-wrap:wrap;gap:6px}#rbPanel .rb-kit button{background:rgba(216,210,198,.05);border:1px solid rgba(216,210,198,.12);border-radius:7px;padding:6px 9px;font-size:12.5px;text-align:left}#rbPanel .rb-kit button:hover{border-color:rgba(227,173,87,.6)}"
    +"#rbPanel .rb-kit button span{display:block;font-size:10.5px;color:#8d8678;margin-top:1px}"
    +"#rbPanel .rb-list{display:flex;flex-direction:column;gap:4px}#rbPanel .rb-list button{display:flex;align-items:center;gap:8px;background:transparent;border:1px solid transparent;border-radius:7px;padding:6px 8px;font-size:13px;text-align:left}#rbPanel .rb-list button.on{border-color:rgba(227,173,87,.55);background:rgba(227,173,87,.08)}#rbPanel .rb-list button.off{opacity:.5}"
    +"#rbPanel .rb-role{margin-left:auto;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;padding:2px 6px;border-radius:3px;background:rgba(216,210,198,.08)}"
    +"#rbPanel .rb-card{margin-top:10px;padding:12px;border-radius:10px;background:rgba(216,210,198,.04);border:1px solid rgba(216,210,198,.1)}#rbPanel .rb-ch{display:flex;align-items:center;gap:8px}#rbPanel .rb-ch b{font-family:var(--serif);font-weight:400;font-size:17px}#rbPanel .rb-ch button{margin-left:auto;background:transparent;border:1px solid rgba(216,210,198,.16);border-radius:6px;padding:3px 8px;font-family:var(--mono);font-size:10px}#rbPanel .rb-ch button+button{margin-left:4px}"
    +"#rbPanel .rb-facts{margin:6px 0 8px;font-family:var(--mono);font-size:10.5px;color:#b9b1a2;line-height:1.5}"
    +"#rbPanel label{display:grid;grid-template-columns:64px 1fr 62px;align-items:center;gap:8px;margin:7px 0;font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:#8d8678}#rbPanel label em{font-style:normal;text-align:right;color:#efe9dd}#rbPanel input[type=range]{width:100%;accent-color:#e3ad57}"
    +"#rbPanel .rb-gels,#rbPanel .rb-surf{display:flex;gap:6px;align-items:center;margin-top:6px;font-family:var(--mono);font-size:10px;color:#8d8678;letter-spacing:.12em}#rbPanel .rb-gels button{width:20px;height:20px;border-radius:50%;background:var(--g);border:2px solid transparent}#rbPanel .rb-gels button.on{border-color:#efe9dd}"
    +"#rbPanel .rb-surf button{background:transparent;border:1px solid rgba(216,210,198,.16);border-radius:6px;padding:4px 9px;font-size:11px;letter-spacing:.06em}#rbPanel .rb-surf button.on{border-color:var(--accent);color:var(--accent)}"
    +"#rbPanel .rb-ratio{margin-top:14px;padding:11px 12px;border-radius:10px;border:1px solid rgba(227,173,87,.3);background:rgba(227,173,87,.06);font-size:13px;color:#d8d2c6}#rbPanel .rb-ratio b{display:block;font-family:var(--mono);font-size:15px;color:var(--accent);letter-spacing:.04em}"
    +"#rbPanel .rb-foot{display:flex;gap:6px;margin-top:14px}#rbPanel .rb-foot button{flex:1;background:transparent;border:1px solid rgba(216,210,198,.16);border-radius:8px;padding:8px;font-family:var(--mono);font-size:10px;letter-spacing:.12em}#rbPanel .rb-foot button.on{border-color:var(--accent);color:var(--accent)}"
    +"#rbPanel .rb-note{font-size:12.5px;color:#b9b1a2;line-height:1.45;margin-top:8px}"
    +"#rbTime{position:fixed;left:20px;right:358px;bottom:84px;z-index:955;max-width:900px;margin:0 auto;padding:10px 14px 12px;border-radius:14px;background:rgba(15,13,10,.92);border:1px solid rgba(216,210,198,.1);display:none;color:#efe9dd}"
    +"#rbTime .rb-tl-h{display:flex;align-items:center;gap:8px;margin-bottom:8px}#rbTime button{font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:#b9b1a2;background:transparent;border:1px solid rgba(216,210,198,.16);border-radius:6px;padding:4px 8px;cursor:pointer}#rbTime button.on{border-color:var(--accent);color:var(--accent)}"
    +"#rbTime .rb-days{display:flex;gap:4px}#rbTime .rb-now{margin-left:auto;margin-right:8px;font-family:var(--mono);font-size:11px;font-weight:400;color:#efe9dd}"
    +"#rbTime .rb-track{position:relative;height:26px;border-radius:6px;cursor:pointer}#rbTime .rb-track.off{opacity:.55}#rbTime .rb-track i{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.35)}#rbTime .rb-track i span.lo{top:auto;bottom:-15px}#rbTime{padding-bottom:20px}#rbTime .rb-track i span{position:absolute;top:-1px;left:4px;font-style:normal;font-family:var(--mono);font-size:9px;color:rgba(255,255,255,.75);white-space:nowrap}"
    +"#rbTime .rb-track em{position:absolute;top:-4px;bottom:-4px;width:4px;margin-left:-2px;border-radius:2px;background:#efe9dd;box-shadow:0 0 0 2px rgba(0,0,0,.4)}#rbTime .rb-track.off em{display:none}"
    +"#rbDiagW{position:fixed;left:20px;top:76px;z-index:955;padding:8px;border-radius:14px;background:rgba(15,13,10,.88);border:1px solid rgba(216,210,198,.1);display:none}#rbDiagW canvas{display:block;width:230px;height:230px;cursor:grab}#rbDiagW p{margin:4px 2px 0;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:#8d8678}"
    +"#rbTip{position:fixed;left:calc((100vw - 338px)/2);transform:translateX(-50%);bottom:156px;z-index:950;font-size:12.5px;color:#d8d2c6;background:rgba(15,13,10,.8);padding:6px 12px;border-radius:8px;display:none;white-space:nowrap}#rbTip b{color:#efe9dd;font-weight:500}"
    +"#rbBusy{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);z-index:990;padding:12px 18px;border-radius:10px;background:rgba(15,13,10,.94);font-family:var(--mono);font-size:11px;letter-spacing:.14em;color:var(--accent);display:none}#rbBusy.show{display:block}";
  function rbEls(){ if($("rbPanel")) return; var st=document.createElement("style"); st.textContent=RLB_CSS; document.head.appendChild(st);
    var p=document.createElement("div"); p.id="rbPanel"; document.body.appendChild(p); p.addEventListener("input",rbInput); p.addEventListener("click",rbClick); p.addEventListener("keydown",function(e){ if(e.code!=="Escape") e.stopPropagation(); });
    var t=document.createElement("div"); t.id="rbTime"; document.body.appendChild(t); t.addEventListener("click",rbClick);
    t.addEventListener("pointerdown",function(e){ if(!e.target.closest(".rb-track")) return; e.preventDefault(); RLB.tdrag=true; RLB.play=false; rbTimeAt(e); t.setPointerCapture(e.pointerId); });
    t.addEventListener("pointermove",function(e){ if(RLB.tdrag) rbTimeAt(e); }); t.addEventListener("pointerup",function(){ RLB.tdrag=false; });
    var dw=document.createElement("div"); dw.id="rbDiagW"; dw.innerHTML='<canvas id="rbDiag"></canvas><p>DRAG LIGHTS · DRAG N TO TURN NORTH</p>'; document.body.appendChild(dw);
    var cv=$("rbDiag"); cv.addEventListener("pointerdown",rbDiagDown); cv.addEventListener("pointermove",rbDiagMove); cv.addEventListener("pointerup",function(){ RLB.ddrag=null; });
    var tip=document.createElement("div"); tip.id="rbTip"; tip.innerHTML='<b>Drag a stand</b> to move it · <b>drag its gold dot</b> to aim · <b>scroll on it</b> to raise · <b>right-drag</b> to look · <b>WASD</b> to walk'; document.body.appendChild(tip);
    var bz=document.createElement("div"); bz.id="rbBusy"; bz.textContent="BUILDING SHADOWS…"; document.body.appendChild(bz); }
  function rbShow(on){ ["rbPanel","rbTime","rbDiagW","rbTip"].forEach(function(id){ var e=$(id); if(e) e.classList.toggle("show",!!on&&!viewfinderOn); }); }
  function rbFmtStops(s){ return s===0?"as it comes":(s>0?"+":"")+s.toFixed(1)+" stop"+(Math.abs(s)===1?"":"s"); }
  function rbDist(L){ var T=rbTarget(); return Math.hypot(L.x-T.x,L.y-T.y,L.z-T.z)/RL.S; }
  function rbPanel(full){ var p=$("rbPanel"); if(!p||!RLB.open) return; var L=rbCur(), roles=RLB.roles=rbRoles(), ratio=rbRatio(roles);
    if(!full){ var f=p.querySelector(".rb-facts"); if(f&&L) f.innerHTML=rbFacts(L,roles[RLB.sel]); var ro=p.querySelector(".rb-ratio"); if(ro) ro.outerHTML=rbRatioHTML(ratio);
      Array.prototype.forEach.call(p.querySelectorAll(".rb-list [data-rb-pick]"),function(b){ var i=+b.getAttribute("data-rb-pick"), r=b.querySelector(".rb-role"); if(r){ r.textContent=(roles[i]||"").toUpperCase(); r.style.color=RLB_ROLEC[roles[i]]||""; } });
      var hl=p.querySelector('[data-rb-k="h"]'); if(hl&&L&&document.activeElement!==hl){ hl.value=Math.round(L.h*100); hl.parentNode.querySelector("em").textContent=L.h.toFixed(2)+" m"; } return; }
    var h='<div class="rb-h"><div><span class="rb-eb">LIGHTING · PROTOTYPE B</span><b>Light the scene</b></div><button class="rb-done" data-rb="done">DONE</button></div>';
    h+='<div class="rb-sec">ADD TO THE SET</div>'+RLB_GROUPS.map(function(g){ return '<div class="rb-kit" style="margin-bottom:6px">'+Object.keys(RLB_FX).filter(function(k){ return RLB_FX[k].g===g[0]; }).map(function(k){ return '<button data-rb-fx="'+k+'" title="'+RLB_FX[k].d+'">'+RLB_FX[k].n+'<span>'+RLB_FX[k].d+'</span></button>'; }).join("")+'</div>'; }).join("");
    if(RL.lights.length) h+='<div class="rb-sec">ON THE SET</div><div class="rb-list">'+RL.lights.map(function(l,i){ return '<button data-rb-pick="'+i+'" class="'+(i===RLB.sel?'on':'')+(l.on?'':' off')+'"><i style="width:10px;height:10px;border-radius:50%;background:'+(l.kind>=2?'#8d8678':rlHex(rlLightRGB(l)))+'"></i>'+(i+1)+' · '+l.name+'<span class="rb-role" style="color:'+(RLB_ROLEC[roles[i]]||'')+'">'+(roles[i]||'').toUpperCase()+'</span></button>'; }).join("")+'</div>';
    else h+='<p class="rb-note">Start with one soft light. A softbox lands front and to the side of your subject, aimed at it. Then walk round and see what it does.</p>';
    if(L){ h+='<div class="rb-card"><div class="rb-ch"><b>'+L.name+'</b><button data-rb="onoff">'+(L.on?'ON':'OFF')+'</button><button data-rb="del" title="Take it off the set">✕</button></div><div class="rb-facts">'+rbFacts(L,roles[RLB.sel])+'</div>';
      if(L.kind<2) h+=rbSl("stops","POWER",L.stops,-4,3,0.5,rbFmtStops(L.stops))+rbSl("k","COLOUR",L.k,1800,10000,100,Math.round(L.k/100)*100+" K");
      h+=rbSl("h","HEIGHT",L.h,0.1,5,0.05,L.h.toFixed(2)+" m");
      if(L.kind===3) h+='<div class="rb-surf"><span>SURFACE</span>'+Object.keys(RLB_SURF).map(function(k){ return '<button data-rb-surf="'+k+'" class="'+(L.surf===k?'on':'')+'">'+RLB_SURF[k].n+'</button>'; }).join("")+'</div><p class="rb-note">A reflector only bounces what lands on it. Angle it between the light and your subject.</p>';
      if(L.kind===2) h+='<p class="rb-note">A flag soaks up light. Put it beside your subject to deepen the shadow side.</p>';
      if(L.kind<2) h+='<div class="rb-gels"><span>GEL</span>'+RL_GELS.map(function(g){ return '<button data-rb-gel="'+g[0]+'" title="'+g[1]+'" class="'+(L.gel===g[0]?'on':'')+'" style="--g:'+g[0]+'"></button>'; }).join("")+'</div>';
      if(L.kind!==0) h+='<div class="rb-foot" style="margin-top:10px"><button data-rb="aimsub">AIM AT THE SUBJECT</button></div>';
      h+='</div>'; }
    h+=rbRatioHTML(ratio);
    h+='<div class="rb-foot"><button data-rb="shadows" class="'+(RL.shadows?'on':'')+'">SHADOWS '+(RL.shadows?'ON':'OFF')+'</button><button data-rb="clear">CLEAR THE SET</button></div>';
    p.innerHTML=h; }
  function rbFacts(L,role){ var T=rbTarget(); return (role?'<span style="color:'+(RLB_ROLEC[role]||'')+'">'+role.toUpperCase()+'</span> · ':'')+(L.kind===2||L.kind===3?'':Math.round(L.R*200)+' cm across · ')+rbDist(L).toFixed(1)+' m from the subject · '+(L.ang!=null?L.ang+'° round from you':''); }
  function rbRatioHTML(r){ if(r==null) return '<div class="rb-ratio"><b>No key light yet</b>Add a light in front of your subject and the ratio shows here.</div>';
    return '<div class="rb-ratio"><b>KEY TO FILL '+(r<10?r.toFixed(1):Math.round(r))+' : 1</b>'+rbRatioWord(r).charAt(0).toUpperCase()+rbRatioWord(r).slice(1)+'. Move the fill closer or further to change it.</div>'; }
  function rbSl(k,label,v,mn,mx,step,txt){ return '<label><span>'+label+'</span><input type="range" data-rb-k="'+k+'" min="'+(k==="h"?Math.round(mn*100):mn)+'" max="'+(k==="h"?Math.round(mx*100):mx)+'" step="'+(k==="h"?Math.round(step*100):step)+'" value="'+(k==="h"?Math.round(v*100):v)+'"><em>'+txt+'</em></label>'; }
  function rbInput(e){ var k=e.target.getAttribute("data-rb-k"), L=rbCur(); if(!k||!L) return; var v=+e.target.value, em=e.target.parentNode.querySelector("em");
    if(k==="stops"){ L.stops=v; L.power=L.base*Math.pow(2,v); em.textContent=rbFmtStops(v); }
    else if(k==="k"){ L.k=v; em.textContent=Math.round(v/100)*100+" K"; }
    else if(k==="h"){ L.h=v/100; rbPlace(L,L.x,L.z); em.textContent=L.h.toFixed(2)+" m"; }
    rbStands(); rbDirty(); rbPanel(false); }
  function rbClick(e){ var b=e.target.closest("[data-rb],[data-rb-fx],[data-rb-pick],[data-rb-gel],[data-rb-surf],[data-rb-day]"); if(!b) return; e.stopPropagation(); var L=rbCur();
    if(b.hasAttribute("data-rb-fx")) return rbAdd(b.getAttribute("data-rb-fx"));
    if(b.hasAttribute("data-rb-pick")){ RLB.sel=+b.getAttribute("data-rb-pick"); rbStands(); return rbPanel(true); }
    if(b.hasAttribute("data-rb-gel")){ if(L){ L.gel=b.getAttribute("data-rb-gel"); rbStands(); rbDirty(); rbPanel(true); } return; }
    if(b.hasAttribute("data-rb-surf")){ if(L){ L.surf=b.getAttribute("data-rb-surf"); rbStands(); rbDirty(); rbPanel(true); } return; }
    if(b.hasAttribute("data-rb-day")){ RLB.day=b.getAttribute("data-rb-day"); if(!RLB.sunMode) rbSunOn(); rbDirty(); rbTimeline(); return; }
    var a=b.getAttribute("data-rb");
    if(a==="done") return rlClose(); if(a==="clear") return rlNatural(); if(a==="shadows"){ RL.shadows=!RL.shadows; rbDirty(); return rbPanel(true); }
    if(a==="scan"){ RLB.sunMode=false; RLB.play=false; rbDirty(); rbTimeline(); return rbPanel(true); }
    if(a==="play"){ RLB.play=!RLB.play; if(RLB.play&&!RLB.sunMode){ rbSunOn(); RLB.mins=Math.max(RLB.mins,5*60); } rbTimeline(); return; }
    if(!L) return;
    if(a==="onoff"){ L.on=!L.on; rbStands(); rbDirty(); rbPanel(true); }
    else if(a==="del") rbRemove(RLB.sel);
    else if(a==="aimsub"){ rbAim(L,rbTarget()); rbStands(); rbDirty(); rbPanel(false); } }

  /* ---- open and close ---- */
  function rlOpen(){ if(!loaded||!RLB) return; rbEls(); if(looking){ try{ document.exitPointerLock(); }catch(e){} }
    if(!RL.ready){ if(!viewer||!viewer.P||!viewer.mesh){ toast("Lighting: the scan isn't ready yet"); return; } RL.P=viewer.P; RL.A=viewer.A; RL.N=RL.P.length/3; RL.S=rlScale(); RL.ready=true; }

    RLB.open=true; RL.ui=true; RL.view="eye"; RL.plan=false; if(!Q.flags.rlOpened) qFlag("rlOpened"); document.body.classList.add("rl-open");
    var go=function(){ if(!RL.target) RL.target=rlTarget(); rbInstall(); if(!RLB.built){ var bz=$("rbBusy"); bz.classList.add("show"); setTimeout(function(){ try{ rlGrid(); rbGridSharp(); }catch(e){ console.warn("lightb grid",e); } RLB.built=true; bz.classList.remove("show"); rbDirty(); },60); } else rbDirty();
      rbShow(true); rbPanel(true); rbTimeline(); rbStands(); };
    go(); }
  function rlClose(){ if(!RLB||!RLB.open) return; RLB.open=false; RL.ui=false; RLB.look=false; RLB.drag=null; RLB.play=false; document.body.classList.remove("rl-open"); rbShow(false); rbStands(); renderer.domElement.style.cursor=""; }
  function rlToggle(){ if(RLB&&RLB.open) rlClose(); else rlOpen(); }
  function rlNatural(){ if(!RLB) return; RL.lights.forEach(rbDropStand); RL.lights=[]; RLB.sel=-1; RLB.sunMode=false; RLB.play=false; RL.on=false; rbRestore(); RLB.eye=1; rbPanel(true); rbTimeline(); }
  function rlForget(){ if(!RLB) return; rlClose(); RL.lights.forEach(rbDropStand); RL.lights=[]; RLB.sel=-1; RLB.sunMode=false; RL.on=false; RL.ready=false; RL.target=null; RLB.built=false;
    if(RL.grid&&RL.grid.tex) RL.grid.tex.dispose(); RL.grid=null; if(RLB.gridS&&RLB.gridS.tex) RLB.gridS.tex.dispose(); RLB.gridS=null; RLB.gpu=null; RL.gpu=null; RLB.eye=1; RLB.north=null; }
  function rlVis(){ if(RLB) rbStands(); }
  function rlPlanUI(){} function rlPanel(){} function rlMarkers(){}

  var rbLast=0;
  (function rbTick(t){ requestAnimationFrame(rbTick); var dt=Math.min(0.1,((t||0)-rbLast)/1000); rbLast=t||0;
    if(RLB.open&&rbAway()){ rlClose(); return; }
    if(RLB.open&&viewfinderOn){ rbShow(false); rbStands(); RLB.hidden=true; } else if(RLB.open&&RLB.hidden){ RLB.hidden=false; rbShow(true); rbStands(); }
    if(RLB.play&&RLB.open&&dt>0){ RLB.mins+=dt*40; if(RLB.mins>RLB_T1){ RLB.mins=RLB_T0+60; } rbDirty(); if(((t/250)|0)!==RLB.pt){ RLB.pt=(t/250)|0; rbTimeline(); } }
    if(RLB.dirty&&RLB.built) rbApply();
    else if(RLB.gpu&&RLB.gpu.U.on.value>0){ var cm=RLB.camP; if(!cm||Math.hypot(camPos.x-cm.x,camPos.y-cm.y,camPos.z-cm.z)>0.4*RL.S){ RLB.camP={x:camPos.x,y:camPos.y,z:camPos.z}; if(cm) rbDirty(); } }
    if(RLB.open&&!viewfinderOn) rbDiagDraw(); })();

  if(/[?&]dev/.test(location.search)) window.__rlb={ RLB:RLB, RL:RL, open:rlOpen, close:rlClose, add:rbAdd, sel:function(i){ RLB.sel=i; rbStands(); rbPanel(true); },
    time:function(m){ RLB.mins=m; rbSunOn(); rbDirty(); rbTimeline(); }, scan:function(){ RLB.sunMode=false; rbDirty(); rbTimeline(); }, day:function(d){ RLB.day=d; rbDirty(); rbTimeline(); },
    light:function(o){ var L=rbCur(); if(!L) return; for(var k in o) L[k]=o[k]; if(o.stops!=null) L.power=L.base*Math.pow(2,o.stops); if(o.x!=null||o.z!=null||o.h!=null) rbPlace(L,L.x,L.z); if(o.aim) rbAim(L,rbTarget()); rbStands(); rbDirty(); rbPanel(true); },
    spot:function(a,d){ var L=rbCur(), T=rbTarget(); if(!L) return; var ax=camPos.x-T.x, az=camPos.z-T.z, al=Math.hypot(ax,az)||1; ax/=al; az/=al; var r=a*Math.PI/180, ca=Math.cos(r), sa=Math.sin(r); rbPlace(L,T.x+(ax*ca-az*sa)*d*RL.S,T.z+(ax*sa+az*ca)*d*RL.S); rbAim(L,T); rbStands(); rbDirty(); rbPanel(true); },
    shadows:function(v){ RL.shadows=v; rbDirty(); },
    dbg:function(){ var L=RL.lights[0]; return {roles:rbRoles(), at:L&&rbAtSubject(L), L:L&&{fx:L.fx,kind:L.kind,on:L.on,power:L.power,cone:L.cone,dir:L.dir,ang:L.ang}, ratio:rbRatio(rbRoles())}; },
    regrid:function(o){ for(var k in o) RLB[k]=o[k]; if(RLB.gridS&&RLB.gridS.tex) RLB.gridS.tex.dispose(); RLB.gridS=null; rbGridSharp(); rbDirty(); },
    behind:function(){ var T=rbTarget(), L=RL.lights[0], out=[], self=this; var dx=T.x-L.x, dz=T.z-L.z, d=Math.hypot(dx,dz); dx/=d; dz/=d;
      [0.3,0.5,0.7,0.9,1.2,1.6].forEach(function(f){ var x=T.x+dx*f*RL.S, z=T.z+dz*f*RL.S, y=rlGround(x,z)+0.02; out.push(f+':'+self.vis({x:x,y:y,z:z})); }); return out.join('  '); },
    vis:function(q){ RLB.probe=q; return this.lit().mean; },
    lit:function(){ var G=RLB.gridS, a=G.cpu, cs=G.cell, T=rbTarget(), P=RL.P, N=RL.N, L=RL.lights[0], SK=RLB.skip||3.5, DI=RLB.dIn||99;
      function at(x,y,z){ var i=((x-G.x0)/cs)|0, j=((y-G.y0)/cs)|0, k=((z-G.z0)/cs)|0; if(i<0||j<0||k<0||i>=G.nx||j>=G.ny||k>=G.nz) return -1; return Math.max(a[(k*G.ny+j)*G.nx+i]-0.06,0); }
      function ray(px,py,pz,dx,dy,dz,dist,v0){ var acc=0, out=v0>DI, st=Math.max(cs*0.9,dist/56); for(var i=0;i<56;i++){ var t=cs*1.2+i*st; if(t>dist) break; var vv=at(px+dx*t,py+dy*t,pz+dz*t); if(vv<0) break; if(!out){ if(vv<0.04||t>cs*SK) out=true; else continue; } acc+=vv*st/cs; if(acc>5) break; } return Math.exp(-acc); }
      if(RLB.probe){ var q=RLB.probe; RLB.probe=null; var lx0=L.x-q.x, ly0=L.y-q.y, lz0=L.z-q.z, ld0=Math.hypot(lx0,ly0,lz0); return {mean:+ray(q.x,q.y+cs,q.z,lx0/ld0,ly0/ld0,lz0/ld0,ld0-cs,0).toFixed(3)}; }
      var R={front:[0,0], back:[0,0], inner:[0,0]};
      for(var k=0;k<N;k+=2){ var x=P[k*3], y=P[k*3+1], z=P[k*3+2], hx=x-T.x, hz=z-T.z, hd=Math.hypot(hx,hz); if(hd>0.6*RL.S||y<T.y-0.35*RL.S||y>T.y+0.3*RL.S) continue;
        var lx=L.x-x, ly=L.y-y, lz=L.z-z, ld=Math.hypot(lx,ly,lz); lx/=ld; ly/=ld; lz/=ld; var fr=(hx*lx+hz*lz)/(hd||1), v0=at(x,y,z), cat=hd<0.18*RL.S?"inner":fr>0.4?"front":fr<-0.4?"back":null; if(!cat) continue;
        var sg=fr>=0?1:-1, nx_=hx/(hd||1)*sg, nz_=hz/(hd||1)*sg; var v=ray(x+nx_*cs,y,z+nz_*cs,lx,ly,lz,ld-cs,v0); R[cat][0]+=v; R[cat][1]++; }
      var o={}; for(var c in R) o[c]=+(R[c][0]/Math.max(R[c][1],1)).toFixed(3)+" (n"+R[c][1]+")"; return o; }, clear:rlNatural, ready:function(){ return RLB.built&&!RLB.dirty; }, solar:rbSolar, marks:rbMarks,
    state:function(){ return {open:RLB.open, sun:RLB.sunMode, el:RLB.el, n:RL.lights.length, eye:RLB.eye, cs:RLB.gridS&&RLB.gridS.cell, cb:RL.grid&&RL.grid.cell, dims:RLB.gridS&&[RLB.gridS.nx,RLB.gridS.ny,RLB.gridS.nz], roles:RLB.roles, ratio:rbRatio(RLB.roles||{})}; } };
