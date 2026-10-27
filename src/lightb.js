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
    speed:{n:"Speedlight", g:"light", d:"Small flash, hard light", kind:1, R:0.05, k:5500, power:10, h:1.5, cone:70},
    softbox:{n:"Softbox 90 cm", g:"soften", d:"Big and soft, wraps round your subject", kind:1, R:0.45, k:5500, power:10, h:1.6, cone:150},
    umbrella:{n:"Umbrella", g:"soften", d:"Soft and spills everywhere", kind:1, R:0.5, k:5500, power:9, h:1.8, cone:190},
    strip:{n:"Stripbox", g:"soften", d:"Tall and narrow, good for lighting edges", kind:1, R:0.22, k:5500, power:8, h:1.5, cone:130},
    reflector:{n:"Reflector", g:"shape", d:"Bounces light back in", kind:3, R:0.4, k:5500, power:0, h:0.9, cone:160, surf:"silver"},
    sodium:{n:"Streetlight", g:"practical", d:"Sodium, overhead", kind:1, R:0.15, k:2000, power:18, h:4, cone:120, gel:"#ffb050"},
    rgb:{n:"RGB tube", g:"practical", d:"Any colour", kind:0, R:0.12, k:6500, power:3.2, h:1, gel:"#ff3df0"}};
  var RLB_GROUPS=[["light","Lights"],["soften","Soft lights"],["shape","Reflectors"],["practical","Practicals"]];
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
          "if("+i.on+" > 0.001 && isGsplatActive("+o+".flags)){",   /* on blends: the default look can fade in */
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
          "  "+o+".rgba.rgb=mix("+o+".rgba.rgb, pow(sx,vec3(1.0/2.2)), min("+i.on+",1.0));",
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
    RL.lights.forEach(function(L,i){ if(L.fx==="sodium"||L.fx==="rgb"){ out[i]="Practical"; return; } if(L.kind===2){ out[i]="Flag"; return; }
      var lx=L.x-T.x, lz=L.z-T.z, ll=Math.hypot(lx,lz)||1, ang=Math.acos(Math.max(-1,Math.min(1,(cx*lx+cz*lz)/(cl*ll))))*180/Math.PI;
      var tx=T.x-L.x, ty=T.y-L.y, tz=T.z-L.z, tl=Math.hypot(tx,ty,tz)||1, aimed=(tx*L.dir[0]+ty*L.dir[1]+tz*L.dir[2])/tl>0.6||L.kind===0;
      L.ang=Math.round(ang); if(!aimed){ out[i]="Background"; return; } if(ang>110){ out[i]="Rim"; return; } if(L.kind===3){ out[i]="Bounce"; return; } front.push(i); });
    var best=-1, bv=-1; front.forEach(function(i){ var v=RL.lights[i].on?rbAtSubject(RL.lights[i]):0; if(v>bv){ bv=v; best=i; } });
    front.forEach(function(i){ out[i]=i===best?"Key":"Fill"; }); RL.lights.forEach(function(L,i){ if(out[i]==="Bounce") out[i]=best>=0?"Fill":"Key"; }); return out; }
  function rbRatio(roles){ var key=0, fill=0, amb=rbLum(RLB.sunMode?RLB.amb:[1,1,1])*0.6;
    RL.lights.forEach(function(L,i){ if(!L.on) return; var v=rbAtSubject(L); if(roles[i]==="Key") key+=v; else if(roles[i]==="Fill") fill+=v; });
    if(RLB.sunMode&&RLB.el>0){ var sk=rbLum(RLB.sunLin)*0.8; if(sk>key){ fill+=key; key=sk; } else fill+=0; }
    fill+=amb; if(key<=0) return null; return (key+fill)/Math.max(fill,1e-3); }
  function rbRatioWord(r){ if(r<1.6) return "flat and even"; if(r<2.6) return "soft and open"; if(r<5) return "some shadow, good shape"; if(r<9) return "deep shadows"; return "very deep shadows"; }

  function rbAim(L,p){ var dx=p.x-L.x, dy=p.y-L.y, dz=p.z-L.z, d=Math.hypot(dx,dy,dz)||1; L.dir=[dx/d,dy/d,dz/d]; L.aimT={x:p.x,y:p.y,z:p.z}; }
  /* the lowest each piece can go before it meets its own stand or the ground: a 1.1 m stripbox hangs well below its bracket */
  var RLB_MINH={strip:0.78, softbox:0.55, umbrella:0.72, reflector:0.68, fresnel:0.36, speed:0.3, bare:0.25, rgb:0.62, sodium:1.2};
  function rbMinH(fx){ return Math.max(RLB_MINH[fx]||0.3,(RLB_MOUNT[fx]||0)+0.15); }
  function rbPlace(L,x,z){ var sp=RLB.spotNow; if(sp&&sp.fx===L.fx&&Math.hypot(x-sp.x,z-sp.z)<0.28*RL.S){ x=sp.x; z=sp.z; }   /* close to the tour's gold spot: it clicks onto it */
    L.h=Math.max(L.h,rbMinH(L.fx)); L.x=x; L.z=z; L.g=rlGround(x,z); L.y=L.g+L.h*RL.S; if(L.aimT) rbAim(L,L.aimT); }
  var RLB_SPOTS=[[45,1.5],[-55,1.9],[155,1.6],[-150,1.8],[100,2.2],[-100,2.2],[20,2.6],[-20,2.6]];
  function rbAdd(fx){ if(RL.lights.length>=RLB_MAX){ toast("That's "+RLB_MAX+" pieces of kit, the most for now"); return; }
    var F=RLB_FX[fx]||RLB_FX.softbox, T=rbTarget(), S=RL.S, ax=camPos.x-T.x, az=camPos.z-T.z, al=Math.hypot(ax,az)||1; ax/=al; az/=al;
    var sp=fx==="reflector"?[-70,1.0]:RLB_SPOTS[RL.lights.length%RLB_SPOTS.length];
    var a=sp[0]*Math.PI/180, d=sp[1]*S, ca=Math.cos(a), sa=Math.sin(a);
    var subH=(T.y-rlGround(T.x,T.z))/S, h0=fx==="sodium"?F.h:Math.min(F.h,Math.max(rbMinH(fx),subH+0.55));   /* a low subject gets low lights: just above it, looking down a little */
    var L={id:RL.nid++, on:true, fx:fx, name:F.n, kind:F.kind, type:F.kind===1?"spot":"bulb", power:F.power, base:F.power, stops:0, k:F.k, gel:F.gel||"#ffffff", R:F.R, cone:F.cone||180, h:h0, surf:F.surf||null, soft:F.R, dir:[0,-1,0], bounceP:0};
    var sp0=RLB.spotNow; if(sp0&&sp0.fx===fx) rbPlace(L, sp0.x, sp0.z); else rbPlace(L, T.x+(ax*ca-az*sa)*d, T.z+(ax*sa+az*ca)*d); rbAim(L, fx==="sodium"?{x:L.x,y:L.g,z:L.z}:T);   /* the tour shows a spot: it goes straight there */
    sfx("lPlace"); RL.lights.push(L); RLB.sel=RL.lights.length-1; RL.placed=(RL.placed||0)+1; RL.on=true; rbStands(); rbPanel(true); rbDirty(); }
  function rbRemove(i){ var L=RL.lights[i]; if(!L) return; sfx("lRemove"); rbDropStand(L); RL.lights.splice(i,1); RLB.sel=Math.min(RLB.sel,RL.lights.length-1); rbPanel(true); rbDirty(); }

  /* ---- push it all to the GPU (at most once a frame) ---- */
  function rbDirty(){ RLB.dirty=true; }
  function rbIdentity(){ return !RLB.sunMode&&!RL.lights.some(function(L){ return L.on; }); }
  function rbApply(){ RLB.dirty=false; RLB.nApply=(RLB.nApply||0)+1; if(!RL.ready||!RLB.gpu) return; var G0=RLB.gpu, U=G0.U;
    if(rbIdentity()){ rbRestore(); RLB.eye=1; if(typeof rbKitLevel==="function") rbKitLevel(); return; }
    if(G0.mesh.maxSh>0){ G0.mesh.__sh=G0.mesh.maxSh; G0.mesh.maxSh=0; G0.mesh.updateGenerator(); setTimeout(function(){ G0.mesh.updateGenerator(); G0.mesh.updateVersion(); },300); }
    var amb=[1,1,1], sunOn=false;
    if(RLB.sunMode){ var so=rbSolar(RLB.mins), sk=rbSky(so.el); RLB.el=so.el; RLB.az=so.az; amb=sk.amb; RLB.sunLin=sk.sun;
      var a=(so.az+RLB.north)*Math.PI/180, e=Math.max(so.el,0.6)*Math.PI/180; RLB.sunDir=[Math.cos(e)*Math.sin(a), Math.sin(e), Math.cos(e)*Math.cos(a)];
      sunOn=sk.sunP>0.002; RL.sunAz=((so.az+RLB.north)%360+360)%360; RL.sunEl=so.el; RL.sunPow=sunOn?sk.sunP:0;
      if(typeof SKY!=="undefined"&&SKY.mesh){ var su=SKY.mesh.material.uniforms; su.dim.value=sk.skyDim; if(su.tint) su.tint.value.set(sk.skyTint[0],sk.skyTint[1],sk.skyTint[2]); } }
    else { RL.sunPow=0; if(typeof SKY!=="undefined"&&SKY.mesh){ var su2=SKY.mesh.material.uniforms; su2.dim.value=RL.lights.some(function(L){ return L.on; })?1:1; if(su2.tint) su2.tint.value.set(1,1,1); } }
    RLB.amb=amb; if(typeof rbKitLevel==='function') rbKitLevel();
    U.on.value=RLB.onK==null?1:RLB.onK; U.amb.value.set(amb[0],amb[1],amb[2]); U.cam.value.set(camPos.x,camPos.y,camPos.z); U.is2.value=1/(RL.S*RL.S);
    U.sunOn.value=sunOn?1:0; if(sunOn){ U.sunDir.value.set(RLB.sunDir[0],RLB.sunDir[1],RLB.sunDir[2]); U.sunCol.value.set(RLB.sunLin[0],RLB.sunLin[1],RLB.sunLin[2]); U.sunAng.value=RLB.el<8?0.03:0.012; }
    /* reflectors: work out what lands on each, then it becomes a soft light of that strength */
    RL.lights.forEach(function(L){ if(L.kind!==3) return; var S=RLB_SURF[L.surf||"silver"], inc=rbIncident({x:L.x,y:L.y,z:L.z}, L.dir), f=S.a;   /* a silver disc a metre off fills to about 3 : 1, like the real thing */
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
  function rlbEye(){ if(!RLB) return 1; if(RLB.eyeLock) return RLB.eyeLock; return (RLB.open||RL.on?RLB.eye:1)*(RLB.boost||1); }   /* boost: the default look reads a little brighter to the eye (photos keep the camera's own exposure) */
  function rlbWalk(){ if(!RLB) return false; return RLB.open&&!viewfinderOn; }

  /* quests and photos ask which time of day it is */
  function rlTimeIs(t){ if(!RLB||!RLB.sunMode) return t==="day"; return rbPhase(RLB.el)===t; }

  /* ---- stands in the scene ---- */
  var _rbMat={};
  function rbM(c,o){ var k=c+"|"+(o||1); if(!_rbMat[k]) _rbMat[k]=new THREE.MeshBasicMaterial({color:c, transparent:(o||1)<1, opacity:o||1, depthWrite:(o||1)>=1}); return _rbMat[k]; }
  /* the kit, modelled in Blender (tools/build_kit.py): loaded once, then each light gets its own copy */
  var RLB_KIT=null, RLB_KITP=null;
  var RLB_MOUNT={fresnel:0.19, speed:0.12, softbox:0.14, strip:0.14, umbrella:0.14, reflector:0.53, bare:0.085, rgb:0.06, sodium:0.3};   /* how far below the light its stand stops */
  function rbKit(){ if(RLB_KIT||RLB_KITP||typeof GLTFLoader==="undefined"||typeof assetBytes!=="function") return;
    RLB_KITP=assetBytes("asset-b64:assets/kit/lightkit.glb").then(function(ab){ new GLTFLoader().parse(ab,"",function(g){ RLB_KIT=g.scene;
      RLB_KIT.traverse(function(o){ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; } }); RL.lights.forEach(rbDropStand); rbStands(); }, function(e){ console.warn("lighting kit",e); }); }).catch(function(e){ console.warn("lighting kit",e); }); }
  function rbKitPart(n){ var o=RLB_KIT&&RLB_KIT.getObjectByName(n); return o?o.clone(true):null; }
  /* the kit is lit like the scene it stands in: the scan's own sky to reflect, sky fill and the sun at the time you've picked */
  function rbKitLights(){ if(!scene) return; var U=scene.userData; if(U.rbLit) return; U.rbLit=true;
    if(RLB.envTex){ try{ RLB.envTex.dispose(); }catch(e){} RLB.envTex=null; }   /* the last scene's reflections */
    U.rbHemi=new THREE.HemisphereLight(0xdfe6ee,0x2a251e,0.6); scene.add(U.rbHemi);
    U.rbSun=new THREE.DirectionalLight(0xffffff,0); scene.add(U.rbSun); scene.add(U.rbSun.target);
    try{ var pm=new THREE.PMREMGenerator(renderer), t=typeof SKY!=="undefined"&&SKY.tex;
      if(t&&t.image&&t.image.width){ var m0=t.mapping; t.mapping=THREE.EquirectangularReflectionMapping; scene.environment=pm.fromEquirectangular(t).texture; t.mapping=m0; }
      pm.dispose(); }catch(e){ console.warn("lighting kit: sky reflections", e); }
    if(!scene.environment&&typeof RoomEnvironment!=="undefined"){ try{ var pm2=new THREE.PMREMGenerator(renderer); scene.environment=pm2.fromScene(new RoomEnvironment(),0.04).texture; pm2.dispose(); }catch(e){} }
    else U.rbSky=true;
    if(!U.rbSky&&!U.rbRoom){ U.rbRoom=true; }   /* the sky wasn't ready: try it again once it is */
    RLB.envTex=scene.environment||null;
    rbKitLevel(); }
  function rbKitSkyRetry(){ var U=scene&&scene.userData, t=typeof SKY!=="undefined"&&SKY.tex; if(!U||!U.rbRoom||!t||!t.image||!t.image.width) return; U.rbRoom=false;
    try{ var pm=new THREE.PMREMGenerator(renderer), m0=t.mapping; t.mapping=THREE.EquirectangularReflectionMapping; var env=pm.fromEquirectangular(t).texture; t.mapping=m0; pm.dispose();
      if(RLB.envTex) RLB.envTex.dispose(); scene.environment=env; RLB.envTex=env; U.rbSky=true; }catch(e){} }
  /* each light on the set lights the other stands too: a pool of point lights that only the kit's materials see */
  function rbKitLamps(){ var U=scene&&scene.userData; if(!U||!U.rbLit) return; if(!U.rbLamps){ U.rbLamps=[]; for(var i=0;i<RLB_MAX;i++){ var pl=new THREE.PointLight(0xffffff,0,0,2); U.rbLamps.push(pl); scene.add(pl); } }
    var S=RL.S; U.rbLamps.forEach(function(pl,i){ var L=RL.lights[i]; if(!L||!L.on||L.kind===2||(L.kind===3&&!L.bounce)){ pl.intensity=0; return; }
      var c=L.kind===3?L.bounce:rbEmitRGB(L), p=L.kind===3?1:L.power, m=Math.max(c[0],c[1],c[2],1e-5);
      /* a little in front of the face, so the light's own body doesn't catch it */
      var off=(L.kind===1?Math.min(0.75,(L.R||0.1)+0.3):0.2)*S; pl.position.set(L.x+L.dir[0]*off,L.y+L.dir[1]*off,L.z+L.dir[2]*off);   /* out in front of the face, so a light never floods its own housing */
      pl.color.setRGB(c[0]/m,c[1]/m,c[2]/m); pl.intensity=Math.min(1.2,p*m*0.06)*S*S; pl.distance=6*S; }); }   /* subtle: a touch of spill on the other kit, not a second key */
  function rbKitLevel(){ if(!scene||!scene.userData.rbLit) return; rbKitSkyRetry(); rbKitLamps(); var U=scene.userData, a=rbLum(RLB.sunMode?RLB.amb:[1,1,1]), k=Math.max(0.04,Math.min(1,a*1.25));
    scene.environmentIntensity=k; U.rbHemi.intensity=(RLB.sunMode?0.6:1.1)*k;
    var sunOn=RLB.sunMode&&RLB.el>-1&&rbLum(RLB.sunLin)>0.002, T=rbTarget();
    U.rbSun.intensity=sunOn?2.4*Math.min(1.5,rbLum(RLB.sunLin)):RLB.sunMode?0:0.9;   /* as scanned: soft overcast light from above */
    if(!RLB.sunMode){ U.rbSun.color.setRGB(1,1,1); U.rbSun.position.set(T.x+3,T.y+10,T.z+2); U.rbSun.target.position.set(T.x,T.y,T.z); }
    if(sunOn){ var c=RLB.sunLin, m=Math.max(c[0],c[1],c[2],1e-4); U.rbSun.color.setRGB(c[0]/m,c[1]/m,c[2]/m); U.rbSun.position.set(T.x+RLB.sunDir[0]*20,T.y+RLB.sunDir[1]*20,T.z+RLB.sunDir[2]*20); U.rbSun.target.position.set(T.x,T.y,T.z); } }
  /* a soft contact shadow under each stand: the thing that stops kit from floating */
  var _rbShadowTex=null;
  function rbShadowTex(){ if(_rbShadowTex) return _rbShadowTex; var c=document.createElement("canvas"); c.width=c.height=128; var g=c.getContext("2d"), r=g.createRadialGradient(64,64,4,64,64,64);
    r.addColorStop(0,"rgba(0,0,0,0.55)"); r.addColorStop(0.45,"rgba(0,0,0,0.32)"); r.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=r; g.fillRect(0,0,128,128); _rbShadowTex=new THREE.CanvasTexture(c); return _rbShadowTex; }
  function rbStandFor(L){ var g=new THREE.Group(), P={emit:[], surf:[]};
    if(RLB_KIT){ rbKitLights();
      ["stand_base","stand_pole","stand_top","street_post"].forEach(function(n){ var o=rbKitPart(n); if(o){ o.position.set(0,0,0); g.add(o); P[n]=o; } });
      var fx=rbKitPart("fx_"+L.fx); if(fx){ fx.position.set(0,0,0); g.add(fx); P.fx=fx; P.head=fx.getObjectByName(L.fx+"_head"); P.yoke=fx.getObjectByName(L.fx+"_yoke"); }
      g.traverse(function(o){ if(!o.isMesh) return; var mn=o.material&&o.material.name;
        if(mn==="Emit"){ o.material=new THREE.MeshStandardMaterial({color:0x101010, emissive:0xffffff, roughness:0.6, side:THREE.DoubleSide}); P.emit.push(o.material); }
        else if(mn==="Surf"){ o.material=o.material.clone(); P.surf.push(o.material); }
        else if(o.material&&o.material.side!==THREE.DoubleSide&&/Fabric|WhiteIn|Silver/.test(mn||"")){ o.material=o.material.clone(); o.material.side=THREE.DoubleSide; } }); }
    else { var hd=new THREE.Group(); hd.add(new THREE.Mesh(new THREE.SphereGeometry(0.05,16,12), new THREE.MeshBasicMaterial({color:0xfff4e0}))); g.add(hd); P.head=hd; P.fx=hd; P.basic=hd.children[0].material; }
    var sh=new THREE.Mesh(new THREE.PlaneGeometry(1.25,1.25), new THREE.MeshBasicMaterial({map:rbShadowTex(), transparent:true, depthWrite:false, opacity:0.85})); sh.rotation.x=-Math.PI/2; sh.position.y=0.008; sh.name="cshadow"; sh.renderOrder=4; sh.raycast=function(){}; g.add(sh); P.shadow=sh;
    /* where it lands: a reticle on your subject you drag to aim, joined to the light by a faint line */
    var aim=new THREE.Sprite(new THREE.SpriteMaterial({map:rbReticleTex(), transparent:true, depthTest:false, depthWrite:false, sizeAttenuation:false})); aim.scale.set(0.05,0.05,1); aim.name="aim"; aim.renderOrder=12; g.add(aim);
    /* the light you've picked: a fine dial on the ground round its stand */
    var ring=new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.3), new THREE.MeshBasicMaterial({map:rbRingTex(), alphaTest:0.3, transparent:false, depthWrite:true})); ring.rotation.x=-Math.PI/2; ring.name="ring"; ring.raycast=rbRingCast; g.add(ring);   /* solid where drawn: splats in front of it (the stump) cover it */
    var beamG=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,1)]); var beam=new THREE.Line(beamG, new THREE.LineBasicMaterial({color:0xfff1d6, transparent:true, opacity:0.38, depthTest:false})); beam.name="beam"; beam.renderOrder=11; g.add(beam);
    [aim,ring,beam,sh].concat(P.basic?[P.head.children[0]]:[]).forEach(function(o){ o.userData.own=true; }); P.emit.concat(P.surf).forEach(function(m){ m.userData.own=true; });
    g.userData.P=P; g.userData.L=L; g.traverse(function(o){ o.userData.L=L; o.renderOrder=5; }); ring.renderOrder=-5; return g; }
  /* the dial is grabbable, but only where it's drawn: a circle, not the square it's painted on */
  var _rbRC=[], _rbRV=new THREE.Vector3();
  function rbRingCast(rc,out){ _rbRC.length=0; THREE.Mesh.prototype.raycast.call(this,rc,_rbRC); for(var i=0;i<_rbRC.length;i++){ _rbRV.copy(_rbRC[i].point); this.worldToLocal(_rbRV); if(Math.hypot(_rbRV.x,_rbRV.y)<=0.6) out.push(_rbRC[i]); } }
  /* hover or drag a light and it glows gold at its edges, so you know you've got it */
  var RLB_GLOW=null;
  function rbGlowMat(){ if(RLB_GLOW) return RLB_GLOW; RLB_GLOW=new THREE.ShaderMaterial({transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1, toneMapped:false, side:THREE.FrontSide,
      uniforms:{col:{value:new THREE.Color(0xffc566)}, k:{value:1}},
      vertexShader:"varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }",
      fragmentShader:"uniform vec3 col; uniform float k; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.2); gl_FragColor=vec4(col*(0.10+0.85*f)*k,1.0); }"}); return RLB_GLOW; }
  function rbGlowSet(L){ RL.lights.forEach(function(M){ var st=M.stand; if(!st) return; var on=M===L;
      if(on&&!st.userData.glow){ var ms=[]; st.traverse(function(o){ if(o.isMesh&&!o.userData.own&&o.name!=="glowov"&&o.geometry&&o.geometry.attributes.normal) ms.push(o); });
        ms.forEach(function(o){ var g=new THREE.Mesh(o.geometry,rbGlowMat()); g.name="glowov"; g.renderOrder=7; g.raycast=function(){}; g.userData.L=M; o.add(g); }); st.userData.glow=true; }
      if(st.userData.glow) st.traverse(function(o){ if(o.name==="glowov") o.visible=on; });
      var rg=st.getObjectByName("ring"); if(rg) rg.material.color.setHex(on?0xffd27a:0xffffff); }); RLB.glowL=L||null; }
  function rbDropStand(L){ if(!L.stand) return; scene.remove(L.stand);   /* kit geometry is shared between stands: only dispose what this stand made for itself */
    L.stand.traverse(function(o){ if(o.userData.own){ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); } else if(o.material&&o.material.userData&&o.material.userData.own) o.material.dispose(); }); L.stand=null; }
  var RLB_SURFC={white:0xf0ede6, silver:0xc9ccd2, gold:0xd8ae5c};
  function rbStands(){ if(typeof scene==="undefined"||!scene) return; rbKit(); var S=RL.S, show=RLB.open&&!viewfinderOn;
    RL.lights.forEach(function(L,i){ if(L.stand&&L.stand.userData.fx!==L.fx+"|"+(RLB_KIT?1:0)){ rbDropStand(L); }
      if(!L.stand){ L.stand=rbStandFor(L); L.stand.userData.fx=L.fx+"|"+(RLB_KIT?1:0); scene.add(L.stand); }
      var st=L.stand, P=st.userData.P, top=(L.y-L.g)/S; st.visible=show; st.position.set(L.x,L.g,L.z); st.scale.setScalar(S);
      var ts=Math.max(0.12,top-(RLB_MOUNT[L.fx]||0)), tri=L.fx!=="sodium", k=Math.min(1,Math.max(0.15,ts/0.9));   /* a low light gets a shorter stand, not one through the floor */
      if(P.stand_base){ P.stand_base.visible=P.stand_top.visible=tri; P.stand_base.scale.setScalar(k);
        var pl=ts-0.13-0.7*k; P.stand_pole.position.y=0.7*k; P.stand_pole.scale.y=Math.max(0.001,pl+0.02); P.stand_pole.visible=tri&&pl>0; P.stand_top.position.y=ts-0.03; }
      if(P.street_post){ P.street_post.visible=L.fx==="sodium"; P.street_post.scale.y=Math.max(0.01,ts); }
      if(P.fx) P.fx.position.y=top;
      if(P.shadow){ var ss=L.fx==="sodium"?0.45:k*1.0; P.shadow.scale.set(ss,ss,1); P.shadow.material.opacity=0.85*Math.max(0.25,Math.min(1,(scene.environmentIntensity||1)+0.2)); }
      var yaw=Math.atan2(L.dir[0],L.dir[2]), pitch=-Math.asin(Math.max(-1,Math.min(1,L.dir[1]))), turns=L.kind!==0||L.fx==="rgb";
      if(P.yoke) P.yoke.rotation.set(0,turns?yaw:0,0);
      if(P.head){ if(L.kind!==0) P.head.rotation.set(pitch,yaw,0,"YXZ"); else P.head.rotation.set(0,turns?yaw:0,0); }
      var c=rlLightRGB(L), m=Math.max(c[0],c[1],c[2],1e-4), on=L.on?1:0.04;
      var ef=0.8*on; P.emit.forEach(function(mt){ mt.emissive.setRGB(c[0]/m*ef,c[1]/m*ef,c[2]/m*ef); });   /* bright, not a blown-out white card */
      P.surf.forEach(function(mt){ mt.color.setHex(RLB_SURFC[L.surf||"silver"]); mt.metalness=L.surf==="white"?0:1; mt.roughness=L.surf==="white"?0.8:0.3; });
      if(P.basic) P.basic.color.setRGB(c[0]/m*on,c[1]/m*on,c[2]/m*on);
      var aim=st.getObjectByName("aim"), showAim=i===RLB.sel&&L.kind!==0&&!!L.aimT; aim.visible=showAim; if(showAim){ aim.scale.set(0.05/S,0.05/S,1); } if(showAim) aim.position.set((L.aimT.x-L.x)/S,(L.aimT.y-L.g)/S,(L.aimT.z-L.z)/S);
      var rg=st.getObjectByName("ring"); rg.visible=i===RLB.sel||L===RLB.glowL; rg.position.y=0.012; rg.scale.setScalar(L.fx==="sodium"?0.5:Math.max(0.5,k));
      var beam=st.getObjectByName("beam"); beam.visible=showAim; if(showAim){ var p=beam.geometry.attributes.position; p.setXYZ(0,0,top,0); p.setXYZ(1,(L.aimT.x-L.x)/S,(L.aimT.y-L.g)/S,(L.aimT.z-L.z)/S); p.needsUpdate=true; beam.geometry.computeBoundingSphere(); } }); }
  var _rbRingT=null, _rbRetT=null;
  function rbRingTex(){ if(_rbRingT) return _rbRingT; var N=512, c=document.createElement("canvas"); c.width=c.height=N; var g=c.getContext("2d"), m=N/2;
    var gl=g.createRadialGradient(m,m,N*0.34,m,m,N*0.47); gl.addColorStop(0,"rgba(255,236,205,0)"); gl.addColorStop(0.6,"rgba(255,236,205,.10)"); gl.addColorStop(1,"rgba(255,236,205,0)"); g.fillStyle=gl; g.fillRect(0,0,N,N);
    g.strokeStyle="rgba(255,246,232,.92)"; g.lineWidth=3; g.beginPath(); g.arc(m,m,N*0.41,0,Math.PI*2); g.stroke();
    g.strokeStyle="rgba(255,246,232,.35)"; g.lineWidth=1.5; g.beginPath(); g.arc(m,m,N*0.445,0,Math.PI*2); g.stroke();
    g.strokeStyle="rgba(255,246,232,.75)"; g.lineWidth=2.5; for(var k=0;k<72;k++){ var a=k/72*Math.PI*2, l=k%18===0?0.05:k%6===0?0.028:0.014; g.beginPath(); g.moveTo(m+Math.cos(a)*N*0.41,m+Math.sin(a)*N*0.41); g.lineTo(m+Math.cos(a)*N*(0.41-l),m+Math.sin(a)*N*(0.41-l)); g.stroke(); }
    _rbRingT=new THREE.CanvasTexture(c); _rbRingT.anisotropy=8; return _rbRingT; }
  function rbReticleTex(){ if(_rbRetT) return _rbRetT; var N=256, c=document.createElement("canvas"); c.width=c.height=N; var g=c.getContext("2d"), m=N/2;
    g.shadowColor="rgba(0,0,0,.6)"; g.shadowBlur=6; g.strokeStyle="rgba(255,248,236,.95)"; g.lineWidth=5; g.beginPath(); g.arc(m,m,N*0.3,0,Math.PI*2); g.stroke();
    g.lineWidth=5; [[0,-1],[1,0],[0,1],[-1,0]].forEach(function(d){ g.beginPath(); g.moveTo(m+d[0]*N*0.18,m+d[1]*N*0.18); g.lineTo(m+d[0]*N*0.44,m+d[1]*N*0.44); g.stroke(); });
    g.fillStyle="rgba(255,248,236,1)"; g.beginPath(); g.arc(m,m,N*0.045,0,Math.PI*2); g.fill();
    _rbRetT=new THREE.CanvasTexture(c); return _rbRetT; }

  /* ---- pointer: drag a stand to move it, drag its gold dot to aim, scroll on it to raise, right-drag to look ---- */
  var _rbRay=new THREE.Raycaster(), _rbPl=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  function rbNdc(e){ return {x:e.clientX/innerWidth*2-1, y:-(e.clientY/innerHeight)*2+1}; }
  function rbHit(e){ _rbRay.setFromCamera(rbNdc(e),camera); var objs=[], aims=[]; RL.lights.forEach(function(L){ if(L.stand&&L.stand.visible) L.stand.traverse(function(o){ if(!o.visible) return; if(o.isSprite) aims.push(o); else if(o.isMesh) objs.push(o); }); });
    var ha=aims.length?_rbRay.intersectObjects(aims,false):[]; if(ha.length) return {L:ha[0].object.userData.L, aim:true, head:false};   /* the reticle sits on top of everything */
    var h=_rbRay.intersectObjects(objs,false); if(!h.length) return null; var o=h[0].object; for(var hi=0;hi<h.length;hi++){ if(h[hi].object.name!=="ring"){ o=h[hi].object; break; } }   /* a stand beats a dial lying under it */ return {L:o.userData.L, aim:o.name==="aim", head:!!(o.parent&&o.parent.name==="head")}; }
  function rbOnPlane(e,y){ _rbRay.setFromCamera(rbNdc(e),camera); _rbPl.constant=-y; var o=new THREE.Vector3(); return _rbRay.ray.intersectPlane(_rbPl,o)?o:null; }
  /* while the camera is up, the scene belongs to the camera again: shutter, right-click to lower */
  function rbOnCanvas(e){ return RLB.open&&!viewfinderOn&&e.target===renderer.domElement; }
  /* orbit: drag empty space to circle round the subject, scroll to come closer; the camera leaves eye height until you walk */
  function rbOrbit(dx,dy,zoom){ RLB.frame=null; var T=rbTarget(), S=RL.S, ox=camPos.x-T.x, oy=camPos.y-T.y, oz=camPos.z-T.z, r=Math.hypot(ox,oy,oz)||1;
    var th=Math.atan2(ox,oz)-dx*0.0065, ph=Math.asin(Math.max(-1,Math.min(1,oy/r)))+dy*0.005; r=Math.max(0.6*S,Math.min(14*S,r*(zoom||1)));
    ph=Math.max(-0.05,Math.min(1.45,ph)); var nx=T.x+r*Math.cos(ph)*Math.sin(th), nz=T.z+r*Math.cos(ph)*Math.cos(th), ny=T.y+r*Math.sin(ph), gy=rlGround(nx,nz)+0.12*S;
    if(ny<gy) ny=gy; camPos.set(nx,ny,nz);
    if(typeof boundsOn!=="undefined"&&boundsOn){ camPos.x=Math.min(Math.max(camPos.x,boxMin.x),boxMax.x); camPos.y=Math.min(Math.max(camPos.y,boxMin.y),boxMax.y); camPos.z=Math.min(Math.max(camPos.z,boxMin.z),boxMax.z); if(typeof bndClamp==="function") bndClamp(); nx=camPos.x; ny=camPos.y; nz=camPos.z; } var dX=T.x-nx, dY=T.y-ny, dZ=T.z-nz, dl=Math.hypot(dX,dY,dZ)||1;
    yaw=Math.atan2(-dX,-dZ); pitch=Math.asin(dY/dl); RLB.fly=true; RLB.orbitAmt=(RLB.orbitAmt||0)+Math.abs(dx)+Math.abs(dy)+(zoom&&zoom!==1?40:0); if(typeof _vel!=="undefined") _vel.set(0,0,0); }
  function rlbFly(){ if(!RLB||!RLB.fly) return false; if(!RLB.open||viewfinderOn){ RLB.fly=false; return false; }
    var k=typeof keys!=="undefined"?keys:{}; if(k.KeyW||k.KeyA||k.KeyS||k.KeyD){ RLB.fly=false; return false; } return true; }   /* walking puts you back on your feet */
  window.addEventListener("pointerdown",function(e){ if(!rbOnCanvas(e)) return; e.stopImmediatePropagation(); e.preventDefault(); var ae=document.activeElement; if(ae&&ae.closest&&ae.closest("#rbUI")) ae.blur();
    if(e.button===2){ RLB.rcT=Date.now(); RLB.fly=false; toggleViewfinder(); try{ renderer.domElement.requestPointerLock(); }catch(er){} return; }   /* right-click: up to your eye, ready to shoot, same as everywhere else */
    if(e.button!==0) return; var h=rbHit(e);
    if(h){ var i=RL.lights.indexOf(h.L); RLB.sel=i; var L=h.L, p=rbOnPlane(e,L.g); RLB.drag={L:L, aim:h.aim, ox:p?L.x-p.x:0, oz:p?L.z-p.z:0, moved:false}; if(!h.aim){ rbGlowSet(L); renderer.domElement.style.cursor="grabbing"; } rbPanel(true); rbStands(); }
    else { RLB.drag={orbit:true, x:e.clientX, y:e.clientY, moved:false}; renderer.domElement.style.cursor="grabbing"; }
    try{ renderer.domElement.setPointerCapture(e.pointerId); }catch(er){}   /* let go outside the window and the drag still ends */
  },true);
  window.addEventListener("pointermove",function(e){ if(!RLB.open||viewfinderOn) return;
    var D=RLB.drag; if(!D){ var h=e.target===renderer.domElement?rbHit(e):null; if(e.target===renderer.domElement) renderer.domElement.style.cursor=h?(h.aim?"crosshair":"grab"):"move"; var hl=h&&!h.aim?h.L:null; if(hl!==RLB.glowL){ rbGlowSet(hl); rbStands(); } return; }
    if(D.orbit){ var mx=e.clientX-D.x, my=e.clientY-D.y; if(D.moved||Math.hypot(mx,my)>3){ D.moved=true; rbOrbit(mx,my); D.x=e.clientX; D.y=e.clientY; } return; }
    var L=D.L; if(D.aim){ _rbRay.setFromCamera(rbNdc(e),camera); var pk=rbPickRay(); if(pk) rbAim(L,pk); else { var g=rbOnPlane(e,rbTarget().y); if(g) rbAim(L,{x:g.x,y:rbTarget().y,z:g.z}); } }
    else { var p=rbOnPlane(e,L.g); if(p) rbPlace(L,p.x+D.ox,p.z+D.oz); }
    D.moved=true; rbStands(); rbPanel(false); rbDirty(); },true);
  window.addEventListener("pointerup",function(e){ if(!RLB.open) return; var D=RLB.drag; RLB.drag=null; if(!D) return;
    if(D.orbit){ renderer.domElement.style.cursor=""; if(!D.moved&&RLB.sel>=0){ RLB.sel=-1; rbStands(); rbPanel(true); } return; }   /* a click on empty space lets go of the light */
    if(D.L&&D.moved) RL.moved=(RL.moved||0)+1; var h=e.target===renderer.domElement?rbHit(e):null; rbGlowSet(h&&!h.aim?h.L:null); rbStands(); },true);
  window.addEventListener("click",function(e){ if(rbOnCanvas(e)){ e.stopImmediatePropagation(); e.preventDefault(); } },true);
  window.addEventListener("mousedown",function(e){ if(rbOnCanvas(e)||(e.button===2&&RLB.rcT&&Date.now()-RLB.rcT<200)){ e.stopImmediatePropagation(); } },true);
  window.addEventListener("contextmenu",function(e){ if(RLB.open&&e.target===renderer.domElement){ e.preventDefault(); e.stopImmediatePropagation(); } },true);
  /* scroll on a light raises or lowers it; anywhere else it zooms the orbit */
  window.addEventListener("wheel",function(e){ if(!rbOnCanvas(e)) return; e.preventDefault(); e.stopImmediatePropagation(); var h=rbHit(e);
    if(!h){ rbOrbit(0,0,e.deltaY>0?1.1:0.9); return; } var L=h.L;
    L.h=Math.max(0.1,Math.min(5,L.h+(e.deltaY<0?0.05:-0.05))); rbPlace(L,L.x,L.z); RLB.sel=RL.lights.indexOf(L); rbStands(); rbPanel(false); rbDirty(); },{capture:true, passive:false});
  /* the splat along the pointer ray, for aiming at what you point at */
  function rbPickRay(){ if(!RL.ready) return null; var P=RL.P, N=RL.N, o=_rbRay.ray.origin, f=_rbRay.ray.direction, best=-1, bt=1e30, mt=0.05*RL.S;
    for(var i=0;i<N;i+=2){ var vx=P[i*3]-o.x, vy=P[i*3+1]-o.y, vz=P[i*3+2]-o.z, t=vx*f.x+vy*f.y+vz*f.z; if(t<mt||t>=bt) continue;
      var p2=vx*vx+vy*vy+vz*vz-t*t, lim=t*0.012+0.004*RL.S; if(p2<lim*lim){ bt=t; best=i; } }
    return best<0||bt>25*RL.S?null:{x:P[best*3], y:P[best*3+1], z:P[best*3+2]}; }
  function rbAway(){ return menuOpen()||!(App.is("scene")||App.is("viewfinder")); }
  window.addEventListener("keydown",function(e){ if(!RLB.open||rbAway()||(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if(e.code==="Escape"){ e.preventDefault(); e.stopImmediatePropagation(); rlClose(); return; }
    if(e.code==="KeyF"&&!viewfinderOn&&!e.repeat){ e.preventDefault(); rbFit(); return; }
    if((e.code==="Delete"||e.code==="Backspace")&&rbCur()){ e.preventDefault(); e.stopImmediatePropagation(); rbRemove(RLB.sel); return; }
 },true);

  /* ---- the lighting diagram: where the editor shows its histogram, a photographer's lighting sketch you can drag in ---- */
  function rbDiagSize(){ var cv=$("rbDiag"); return {W:cv&&cv.clientWidth||340, H:cv&&cv.clientHeight||210}; }
  function rbDiagGeom(){ var T=rbTarget(), pts=[[T.x,T.z],[camPos.x,camPos.z]], D=rbDiagSize(); RL.lights.forEach(function(L){ pts.push([L.x,L.z]); });
    var r=1.2*RL.S; pts.forEach(function(p){ r=Math.max(r,Math.hypot(p[0]-T.x,p[1]-T.z)); });
    var fx=new THREE.Vector3(); camera.getWorldDirection(fx); var ang=Math.atan2(fx.x,fx.z);   /* turned so you're at the bottom, looking up */
    return {T:T, W:D.W, H:D.H, sc:(Math.min(D.W,D.H)/2-18)/(r*1.08), ca:Math.cos(ang), sa:Math.sin(ang)}; }
  function rbD2S(G,x,z){ var dx=x-G.T.x, dz=z-G.T.z, u=dx*G.ca-dz*G.sa, v=dx*G.sa+dz*G.ca; return {x:G.W/2-u*G.sc, y:G.H/2-v*G.sc}; }
  function rbS2D(G,sx,sy){ var u=(G.W/2-sx)/G.sc, v=(G.H/2-sy)/G.sc; return {x:G.T.x+u*G.ca+v*G.sa, z:G.T.z-u*G.sa+v*G.ca}; }
  function rbDiagDraw(){ var cv=$("rbDiag"); if(!cv||!RLB.open) return; var dpr=Math.min(2,devicePixelRatio||1), G=rbDiagGeom(), W=G.W, H=G.H;
    if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
    var c=cv.getContext("2d"); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H);
    var S=RL.S, m1=G.sc*S, roles=RLB.roles||{}, T=rbD2S(G,G.T.x,G.T.z), Y=rbD2S(G,camPos.x,camPos.z);
    c.strokeStyle="rgba(216,210,198,.06)"; c.lineWidth=1; for(var gi=-12;gi<=12;gi++){ var ox=W/2+gi*m1, oy=H/2+gi*m1; if(ox>0&&ox<W){ c.beginPath(); c.moveTo(ox,0); c.lineTo(ox,H); c.stroke(); } if(oy>0&&oy<H){ c.beginPath(); c.moveTo(0,oy); c.lineTo(W,oy); c.stroke(); } }
    c.setLineDash([2,4]); c.strokeStyle="rgba(239,233,221,.3)"; c.beginPath(); c.moveTo(Y.x,Y.y); c.lineTo(T.x,T.y); c.stroke(); c.setLineDash([]);
    if(RLB.sunMode&&RLB.el>-6){ var a=(RLB.az+RLB.north)*Math.PI/180, sxp=rbD2S(G,G.T.x+Math.sin(a)*99,G.T.z+Math.cos(a)*99), vx=sxp.x-W/2, vy=sxp.y-H/2, vl=Math.hypot(vx,vy)||1, k=Math.min((W/2-12)/Math.abs(vx/vl||1e-6),(H/2-12)/Math.abs(vy/vl||1e-6)), sp={x:W/2+vx/vl*k, y:H/2+vy/vl*k};
      var gr=c.createLinearGradient(sp.x,sp.y,T.x,T.y); gr.addColorStop(0,"rgba(255,190,110,.6)"); gr.addColorStop(1,"rgba(255,190,110,0)"); c.strokeStyle=gr; c.lineWidth=2; c.beginPath(); c.moveTo(sp.x,sp.y); c.lineTo(T.x,T.y); c.stroke(); c.lineWidth=1;
      c.fillStyle=RLB.el>0?"#ffc27a":"#9fb8e8"; c.beginPath(); c.arc(sp.x,sp.y,5,0,7); c.fill(); }
    var nA=RLB.north*Math.PI/180, np=rbD2S(G,G.T.x+Math.sin(nA)*99,G.T.z+Math.cos(nA)*99), nvx=np.x-W/2, nvy=np.y-H/2, nl=Math.hypot(nvx,nvy)||1, nk=Math.min((W/2-12)/Math.abs(nvx/nl||1e-6),(H/2-12)/Math.abs(nvy/nl||1e-6)); RLB.nScr={x:W/2+nvx/nl*nk, y:H/2+nvy/nl*nk};
    c.fillStyle="rgba(216,210,198,.55)"; c.font="500 10px 'Geist Mono',monospace"; c.textAlign="center"; c.textBaseline="middle"; c.fillText("N",RLB.nScr.x,RLB.nScr.y);
    RL.lights.forEach(function(L,i){ var p=rbD2S(G,L.x,L.z), col=RLB_ROLEC[roles[i]]||"#d8d2c6", sel=i===RLB.sel, q=rbD2S(G,L.x+L.dir[0],L.z+L.dir[2]), dx=q.x-p.x, dy=q.y-p.y;
      if(L.kind!==0){ var w=Math.min(L.cone,170)*Math.PI/360, an=Math.atan2(dy,dx), len=Math.max(24,Math.min(90,Math.hypot(T.x-p.x,T.y-p.y)*1.15)), gr2=c.createRadialGradient(p.x,p.y,2,p.x,p.y,len);
        gr2.addColorStop(0,L.on?"rgba(255,236,200,"+(sel?0.32:0.16)+")":"rgba(120,112,100,.12)"); gr2.addColorStop(1,"rgba(255,236,200,0)"); c.fillStyle=gr2; c.beginPath(); c.moveTo(p.x,p.y); c.arc(p.x,p.y,len,an-w,an+w); c.closePath(); c.fill(); }
      c.save(); c.translate(p.x,p.y); c.rotate(Math.atan2(dy,dx)+Math.PI/2); c.fillStyle=L.on?col:"#4f4a41"; var sz=Math.max(5,Math.min(22,L.R*2*m1));
      if(L.kind===0){ c.beginPath(); c.arc(0,0,4.5,0,7); c.fill(); } else { c.beginPath(); c.rect(-sz/2,-2.5,sz,5); c.fill(); } c.restore();
      if(sel){ c.strokeStyle="rgba(239,233,221,.9)"; c.lineWidth=1.25; c.beginPath(); c.arc(p.x,p.y,10,0,7); c.stroke(); c.lineWidth=1; }
      c.fillStyle="rgba(239,233,221,.7)"; c.font="9px 'Geist Mono',monospace"; c.fillText(String(i+1),p.x+11,p.y-9); });
    var SP=RLB.spotNow; if(SP){ var q2=rbD2S(G,SP.x,SP.z), pu=0.5+0.5*Math.sin(performance.now()/260); c.fillStyle="rgba(227,173,87,"+(0.14+0.12*pu)+")"; c.beginPath(); c.arc(q2.x,q2.y,Math.max(8,0.22*m1),0,7); c.fill();
      c.setLineDash([3,3]); c.strokeStyle="rgba(240,196,110,.95)"; c.lineWidth=1.5; c.beginPath(); c.arc(q2.x,q2.y,Math.max(8,0.22*m1)+2+2*pu,0,7); c.stroke(); c.setLineDash([]); c.lineWidth=1;
      c.fillStyle="#f0c46e"; c.font="600 9.5px 'Geist Mono',monospace"; c.fillText(SP.label,q2.x,q2.y-Math.max(8,0.22*m1)-9); }   /* the tour's spot: where this light goes */
    c.strokeStyle="rgba(227,173,87,.95)"; c.lineWidth=1.25; c.beginPath(); c.arc(T.x,T.y,6,0,7); c.stroke(); c.lineWidth=1;
    c.fillStyle="#efe9dd"; c.beginPath(); c.moveTo(Y.x,Y.y-6); c.lineTo(Y.x-4.5,Y.y+4); c.lineTo(Y.x+4.5,Y.y+4); c.closePath(); c.fill(); }
  function rbDiagDown(e){ e.preventDefault(); e.stopPropagation(); var cv=$("rbDiag"), r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, G=rbDiagGeom(), best=-1, bd=16;
    if(RLB.nScr&&Math.hypot(RLB.nScr.x-x,RLB.nScr.y-y)<14){ RLB.ddrag={north:true}; }
    else { RL.lights.forEach(function(L,i){ var p=rbD2S(G,L.x,L.z), d=Math.hypot(p.x-x,p.y-y); if(d<bd){ bd=d; best=i; } }); if(best<0) return; RLB.sel=best; RLB.ddrag={i:best}; rbPanel(true); rbStands(); }
    cv=$("rbDiag"); try{ cv.setPointerCapture(e.pointerId); }catch(er){}   /* the panel may have rebuilt the canvas */
    window.addEventListener("pointerup",function(){ RLB.ddrag=null; },{once:true}); }
  function rbDiagMove(e){ var D=RLB.ddrag; if(!D) return; var cv=$("rbDiag"), r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, G=rbDiagGeom();
    if(D.north){ var w=rbS2D(G,x,y); RLB.north=((Math.atan2(w.x-G.T.x,w.z-G.T.z)*180/Math.PI)%360+360)%360; rbDirty(); return; }
    var L=RL.lights[D.i], w2=rbS2D(G,x,y); if(L){ rbPlace(L,w2.x,w2.z); rbStands(); rbPanel(false); rbDirty(); } }

  /* ---- daylight: as scanned, or the sun at a real time of day ---- */
  var RLB_T0=4*60+30, RLB_T1=23*60;
  function rbSunOn(){ RLB.sunMode=true; RL.on=true; if(RLB.north==null){ var f=new THREE.Vector3(); camera.getWorldDirection(f); var view=Math.atan2(f.x,f.z)*180/Math.PI, M=rbMarks(), sa=rbSolar(M.goldPm||19*60+30).az; RLB.north=((view+140-sa)%360+360)%360; } }
  function rbDayTrack(){ var stops=[], pct=function(m){ return ((m-RLB_T0)/(RLB_T1-RLB_T0)*100).toFixed(1)+"%"; };
    for(var m=RLB_T0;m<=RLB_T1;m+=30){ var e=rbSolar(m).el; stops.push((e>=20?"#8c96a0":e>=6?"#a8936a":e>=-0.83?"#d0843e":e>=-6?"#7a5578":e>=-10?"#34406e":"#151826")+" "+pct(m)); }
    return "linear-gradient(90deg,"+stops.join(",")+")"; }
  function rbDayLabel(){ if(!RLB.sunMode) return "The scan as it was captured"; var so=rbSolar(RLB.mins); return rbPhaseName(so.el)+" · sun "+Math.round(so.el)+"°"; }
  function rbTimeline(){ var tl=$("rbDay"); if(!tl) return; var M=rbMarks(), pct=function(m){ return ((m-RLB_T0)/(RLB_T1-RLB_T0)*100).toFixed(2)+"%"; };
    if(tl.getAttribute("data-day")!==RLB.day||!tl.firstChild){ tl.setAttribute("data-day",RLB.day);   /* the track only changes with the day */
      var marks=[["rise","Sunrise"],["goldPm","Golden hour"],["set","Sunset"]].filter(function(k){ return M[k[0]]!=null; });
      tl.innerHTML='<div class="rb-dh"><span class="lr-secname">Daylight</span><div class="rb-pills"><button class="lr-pill" data-rb="scan">As scanned</button>'+Object.keys(RLB_DAYS).map(function(k){ return '<button class="lr-pill" data-rb-day="'+k+'">'+RLB_DAYS[k].n+'</button>'; }).join("")+'</div>'
        +'<b class="rb-now"></b><button class="lr-pill" data-rb="play">Run through the day</button></div>'
        +'<div class="rb-track" style="background:'+rbDayTrack()+'">'+marks.map(function(k){ return '<i style="left:'+pct(M[k[0]])+'"><span'+(k[0]==="goldPm"?' class="lo"':'')+'>'+k[1]+' '+rbHM(M[k[0]])+'</span></i>'; }).join("")+'<em></em></div>'; }
    tl.classList.toggle("off",!RLB.sunMode); var em=tl.querySelector(".rb-track em"); if(em) em.style.left=pct(RLB.mins);
    var nw=tl.querySelector(".rb-now"); if(nw) nw.textContent=RLB.sunMode?rbHM(RLB.mins)+' · '+rbDayLabel():rbDayLabel();
    Array.prototype.forEach.call(tl.querySelectorAll("[data-rb-day],[data-rb=scan]"),function(b){ var k=b.getAttribute("data-rb-day"); b.classList.toggle("on", k?RLB.sunMode&&RLB.day===k:!RLB.sunMode); });
    var pl=tl.querySelector("[data-rb=play]"); if(pl){ pl.classList.toggle("on",!!RLB.play); pl.textContent=RLB.play?"Pause":"Run through the day"; } }
  function rbTimeAt(e){ var tr=document.querySelector("#rbDay .rb-track"); if(!tr) return; var r=tr.getBoundingClientRect(), t=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    var m0=RLB.sunMode?RLB.mins:null; RLB.mins=Math.round((RLB_T0+t*(RLB_T1-RLB_T0))/5)*5; RLB.play=false;
    if(m0!=null){ if(rbPhase(rbSolar(RLB.mins).el)==="golden"&&rbPhase(rbSolar(m0).el)!=="golden") sfx("lGolden"); else if(Math.floor(m0/60)!==Math.floor(RLB.mins/60)) sfx("lTime"); } if(!RLB.sunMode) rbSunOn(); rbDirty(); rbTimeline(); rbPanel(false); }

  /* ---- the panel and the kit strip: the editing window's own parts ---- */
  var RLB_THUMB={softbox:"asset:assets/kit/thumbs/softbox.webp", strip:"asset:assets/kit/thumbs/strip.webp", umbrella:"asset:assets/kit/thumbs/umbrella.webp", fresnel:"asset:assets/kit/thumbs/fresnel.webp",
    speed:"asset:assets/kit/thumbs/speed.webp", reflector:"asset:assets/kit/thumbs/reflector.webp", bare:"asset:assets/kit/thumbs/bare.webp", sodium:"asset:assets/kit/thumbs/sodium.webp", rgb:"asset:assets/kit/thumbs/rgb.webp"};
  var RLB_KITORDER=["softbox","strip","umbrella","reflector","fresnel","speed","bare","rgb","sodium"];
  var RLB_SIDE=372;
  var RLB_CSS="#rbUI{display:none}#rbUI.show{display:block}"
    +"#rbUI .lr-panel{position:fixed;top:0;right:0;bottom:0;width:"+RLB_SIDE+"px;z-index:960;display:flex;flex-direction:column;scrollbar-width:thin}"
    +"#rbUI .lr-panel button{font:inherit;cursor:pointer}"
    +"#rbUI .rb-diag{position:relative;flex:none;padding:0;background:#070605}#rbUI .rb-diag canvas{display:block;width:100%;height:210px;cursor:grab}"
    +"#rbUI .rb-diag .lr-rgb{position:absolute;left:10px;right:auto;top:auto;bottom:8px;display:flex;gap:12px;padding:3px 8px;border-radius:4px;font-size:10px;letter-spacing:.08em}"
    +"#rbUI .rb-hint{position:absolute;right:10px;top:9px;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:var(--ink-5)}"
    +"#rbUI .lr-hbtns{align-items:center}#rbUI .lr-save{border:0;border-radius:6px;padding:7px 14px}"
    +"#rbUI .lr-secname{flex:1}#rbUI .rb-cnt{font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:var(--ink-5)}"
    +"#rbUI .rb-li{display:flex;align-items:center;gap:10px;padding:6px 8px;margin:2px -8px;border-radius:6px;cursor:pointer;border:1px solid transparent}"
    +"#rbUI .rb-li:hover{background:rgba(var(--gold-rgb),.04)}#rbUI .rb-li.on{background:rgba(var(--gold-rgb),.07);border-color:rgba(var(--gold-rgb),.35)}#rbUI .rb-li.off img{opacity:.35}"
    +"#rbUI .rb-li img{width:38px;height:38px;object-fit:contain;flex:none;border-radius:4px;background:radial-gradient(circle at 50% 40%,#2a2620,#100f0d)}"
    +"#rbUI .rb-li .rb-nm{flex:1;min-width:0;color:var(--text);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    +"#rbUI .rb-li .rb-nm small{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;margin-top:2px}"
    +"#rbUI .rb-ic{background:none;border:0;color:var(--ink-4);font-size:14px;width:26px;height:26px;border-radius:5px;display:grid;place-items:center}#rbUI .rb-ic:hover{background:rgba(var(--bone-rgb),.06);color:var(--text)}#rbUI .rb-ic.off{color:var(--ink-6)}"
    +"#rbUI .rb-facts{font-family:var(--mono);font-size:10px;letter-spacing:.06em;color:var(--ink-4);margin:2px 0 6px;line-height:1.6}"
    +"#rbUI .rb-pills{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 4px}#rbUI .rb-pills .lr-pill{border-radius:20px;padding:4px 10px;display:inline-flex;align-items:center;gap:6px}"
    +"#rbUI .rb-pills .lr-pill i{width:8px;height:8px;border-radius:50%;background:var(--g);box-shadow:0 0 0 1px rgba(0,0,0,.4)}"
    +"#rbUI .rb-note{color:var(--ink-4);font-size:12.5px;line-height:1.5;margin:6px 0 4px}"
    +"#rbUI .rb-dayl{font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--ink-4);margin:2px 0 0}"
    +"#rbUI .rb-foot{margin-top:auto;padding:12px 16px 4px;display:flex;gap:8px;border-top:1px dashed rgba(var(--gold-rgb),.16)}#rbUI .rb-foot .lr-ghost{flex:1;border-radius:6px;padding:8px}"
    +"#rbUI .dv-bar{position:fixed;left:0;right:"+RLB_SIDE+"px;bottom:0;z-index:955;background:rgba(12,11,10,.94);backdrop-filter:blur(6px)}"
    +"#rbUI .dv-help{flex:1;color:var(--ink-5)}#rbUI .dv-count{color:var(--accent)}"
    +"#rbUI .rb-kt{flex:none;width:96px;padding:0;border:0;background:#0b0a09;cursor:pointer;outline:1px solid rgba(var(--bone-rgb),.06);outline-offset:1px;display:flex;flex-direction:column;border-radius:3px;overflow:hidden}"
    +"#rbUI .rb-kt img{width:96px;height:72px;object-fit:contain;padding:6px;background:radial-gradient(circle at 50% 42%,#2b2721,#0d0c0b 75%);opacity:.92;transition:opacity .15s,transform .15s}"
    +"#rbUI .rb-kt:hover img{opacity:1;transform:scale(1.04)}#rbUI .rb-kt:hover{outline-color:rgba(var(--gold-rgb),.7)}"
    +"#rbUI .rb-kt span{font-size:11px;color:var(--ink-2);padding:5px 7px 6px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--sans)}"
    +"#rbBusy{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);z-index:990;padding:12px 18px;border-radius:10px;background:rgba(15,13,10,.94);font-family:var(--mono);font-size:11px;letter-spacing:.14em;color:var(--accent);display:none}#rbBusy.show{display:block}"
    +"#rbUI .rb-daybar{position:fixed;top:14px;left:16px;right:"+(RLB_SIDE+16)+"px;z-index:956;max-width:980px;margin:0 auto;padding:10px 14px 22px;border-radius:10px;background:rgba(12,11,10,.9);border:1px solid rgba(var(--bone-rgb),.08);backdrop-filter:blur(6px)}"
    +"#rbUI .rb-dh{display:flex;align-items:center;gap:12px;margin-bottom:10px}#rbUI .rb-dh .rb-pills{margin:0}#rbUI .rb-dh .lr-secname{flex:none;font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}"
    +"#rbUI .rb-now{margin-left:auto;font-family:var(--mono);font-size:11px;font-weight:400;color:var(--text);letter-spacing:.06em;white-space:nowrap}"
    +"#rbUI .rb-track{position:relative;height:22px;border-radius:5px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}#rbUI .rb-daybar.off .rb-track{opacity:.5}"
    +"#rbUI .rb-track i{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.4)}#rbUI .rb-track i span{position:absolute;top:3px;left:5px;font-style:normal;font-family:var(--mono);font-size:9px;letter-spacing:.06em;color:rgba(255,255,255,.85);white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,.6)}"
    +"#rbUI .rb-track i span.lo{top:auto;bottom:-16px;left:auto;right:5px;color:var(--ink-4);text-shadow:none}"
    +"#rbUI .rb-track em{position:absolute;top:-4px;bottom:-4px;width:4px;margin-left:-2px;border-radius:2px;background:#f4efe6;box-shadow:0 0 0 2px rgba(0,0,0,.45),0 0 10px rgba(255,236,200,.5)}#rbUI .rb-daybar.off .rb-track em{display:none}"
    +"body.rl-open #navTop{opacity:0;pointer-events:none}"
    +"#rbGhost{position:fixed;z-index:999;width:84px;height:64px;pointer-events:none;transform:translate(-50%,-60%);opacity:.9;filter:drop-shadow(0 6px 14px rgba(0,0,0,.6));display:none}#rbGhost.show{display:block}"
    +"body.rl-open .co-card:not(.pinned){left:calc((100vw - "+RLB_SIDE+"px)/2);bottom:158px;width:min(560px,calc(100vw - "+(RLB_SIDE+40)+"px))}"   /* the tour card sits over the scene, clear of the kit strip */
    +"body.rl-open #btnHelp{right:"+(RLB_SIDE+18)+"px!important;bottom:150px!important}";   /* the guide button steps out of the panel's way */
  function rbEls(){ if($("rbUI")) return; var st=document.createElement("style"); st.textContent=RLB_CSS; document.head.appendChild(st);
    var u=document.createElement("div"); u.id="rbUI"; document.body.appendChild(u);
    u.innerHTML='<div class="rb-daybar" id="rbDay"></div><aside class="lr-panel" id="rbSide"></aside><div class="dv-bar" id="rbKit"><div class="dv-top"><span class="dv-count">THE KIT</span><span class="dv-help">CLICK OR DRAG A PIECE INTO THE SCENE · DRAG A STAND TO MOVE IT · DRAG THE RETICLE TO AIM · SCROLL ON A LIGHT TO RAISE IT · DRAG THE GROUND TO ORBIT · RIGHT-CLICK TO SHOOT</span></div><div class="dv-film">'
      +RLB_KITORDER.map(function(k){ return '<button class="rb-kt" data-rb-fx="'+k+'" title="'+RLB_FX[k].d+'"><img src="'+RLB_THUMB[k]+'" alt=""><span>'+RLB_FX[k].n+'</span></button>'; }).join("")+'</div></div>';
    var dbar=u.querySelector("#rbDay"); dbar.addEventListener("pointerdown",function(e){ if(!e.target.closest(".rb-track")) return; e.preventDefault(); RLB.tdrag=true; rbTimeAt(e); try{ dbar.setPointerCapture(e.pointerId); }catch(er){} });
    dbar.addEventListener("pointermove",function(e){ if(RLB.tdrag) rbTimeAt(e); }); dbar.addEventListener("pointerup",function(){ RLB.tdrag=false; });
    u.addEventListener("input",rbInput); u.addEventListener("click",rbClick); u.addEventListener("change",function(e){ if(e.target&&e.target.type==="range") e.target.blur(); }); u.addEventListener("keydown",function(e){ if(e.code!=="Escape"&&e.target&&/INPUT|SELECT/.test(e.target.tagName)) e.stopPropagation(); });
    u.addEventListener("pointerup",function(){ var ae=document.activeElement; if(ae&&ae.type==="range") setTimeout(function(){ ae.blur(); },0); });   /* let go of a slider and WASD walks again */
    var gh=document.createElement("img"); gh.id="rbGhost"; gh.alt=""; document.body.appendChild(gh);
    u.querySelector(".dv-film").addEventListener("pointerdown",function(e){ var t=e.target.closest("[data-rb-fx]"); if(!t||e.button!==0) return; e.preventDefault();
      RLB.kdrag={fx:t.getAttribute("data-rb-fx"), x:e.clientX, y:e.clientY, moved:false, L:null}; gh.src=RLB_THUMB[RLB.kdrag.fx]||""; });
    var bz=document.createElement("div"); bz.id="rbBusy"; bz.textContent="BUILDING SHADOWS…"; document.body.appendChild(bz); }
  function rbShow(on){ var u=$("rbUI"); if(u) u.classList.toggle("show",!!on&&!viewfinderOn); }
  function rbFmtStops(s){ return (s>0?"+":"")+s.toFixed(1)+" EV"; }
  function rbDist(L){ var T=rbTarget(); return Math.hypot(L.x-T.x,L.y-T.y,L.z-T.z)/RL.S; }
  function rbSec(id,title,body,extra){ var col=RLB.coll&&RLB.coll[id]; return '<section class="lr-sec'+(col?' collapsed':'')+'" data-rb-sec="'+id+'"><header class="lr-sechdr"><span class="lr-chev">⌄</span><span class="lr-secname">'+title+'</span>'+(extra||'')+'</header><div class="lr-body">'+body+'</div></section>'; }
  function rbRow(k,label,v,mn,mx,step,txt,trk){ return '<div class="lr-row"><span class="lr-n">'+label+'</span><input type="range" data-rb-k="'+k+'"'+(trk?' class="trk-var" style="--trk:'+trk+'"':'')+' min="'+mn+'" max="'+mx+'" step="'+step+'" value="'+v+'"><span class="lr-v">'+txt+'</span></div>'; }
  var RLB_KTRK="linear-gradient(90deg,#ff8a2a,#ffb46a 18%,#ffe2bf 40%,#fff6ec 52%,#e3ecff 70%,#a9c4ff)";
  function rbRatioTxt(r){ return r==null?["–","No key light yet"]:[(r<10?r.toFixed(1):Math.round(r))+" : 1", rbRatioWord(r).charAt(0).toUpperCase()+rbRatioWord(r).slice(1)]; }
  function rbPanel(full){ var p=$("rbSide"); if(!p||!RLB.open) return; var L=rbCur(), roles=RLB.roles=rbRoles(), ratio=rbRatio(roles), rt=rbRatioTxt(ratio);
    if(!full&&p.firstChild){ var rv=p.querySelector("#rbRatioV"), rw=p.querySelector("#rbRatioW"); if(rv) rv.textContent=rt[0]; if(rw) rw.textContent=rt[1];
      var f=p.querySelector(".rb-facts"); if(f&&L) f.textContent=rbFacts(L,roles[RLB.sel]);
      Array.prototype.forEach.call(p.querySelectorAll(".rb-li"),function(b){ var i=+b.getAttribute("data-rb-pick"), r=b.querySelector("small"); if(r){ r.textContent=(roles[i]||"").toUpperCase(); r.style.color=RLB_ROLEC[roles[i]]||""; } });
      var hl=p.querySelector('[data-rb-k="h"]'); if(hl&&L&&document.activeElement!==hl){ hl.value=L.h; hl.parentNode.querySelector(".lr-v").textContent=L.h.toFixed(2)+" m"; } return; }
    var h='<div class="lr-hist rb-diag"><canvas id="rbDiag"></canvas><span class="rb-hint">FROM ABOVE · DRAG TO MOVE</span><div class="lr-rgb"><span>KEY : FILL <b id="rbRatioV">'+rt[0]+'</b></span><span><b id="rbRatioW">'+rt[1]+'</b></span></div></div>';
    h+='<div class="lr-edithdr"><span class="lr-h">Lighting</span><div class="lr-hbtns"><button class="lr-pill" data-rb="fit" title="Line the view back up (F)">Fit</button><button class="lr-pill'+(RL.shadows?' on':'')+'" data-rb="shadows" title="Shadows on or off">Shadows</button><button class="lr-save" data-rb="done" title="Done (Esc)">Done</button></div></div>';
    var set=RL.lights.length?RL.lights.map(function(l,i){ return '<div class="rb-li'+(i===RLB.sel?' on':'')+(l.on?'':' off')+'" data-rb-pick="'+i+'"><img src="'+(RLB_THUMB[l.fx]||'')+'" alt=""><span class="rb-nm">'+l.name+'<small style="color:'+(RLB_ROLEC[roles[i]]||'')+'">'+(roles[i]||'').toUpperCase()+'</small></span>'
      +'<button class="rb-ic'+(l.on?'':' off')+'" data-rb-on="'+i+'" title="'+(l.on?'Turn it off':'Turn it on')+'">'+(l.on?'◉':'○')+'</button><button class="rb-ic" data-rb-del="'+i+'" title="Take it off the set">✕</button></div>'; }).join("")
      :'<p class="rb-note">Nothing on the set yet. Pick a piece from the kit along the bottom. Try a softbox first.</p>';
    h+=rbSec("set","On the set",set,'<span class="rb-cnt">'+RL.lights.length+' / '+RLB_MAX+'</span>');
    if(L){ var b='<div class="rb-facts">'+rbFacts(L,roles[RLB.sel])+'</div>';
      if(L.kind<2) b+=rbRow("stops","Power",L.stops,-4,3,0.5,rbFmtStops(L.stops))+rbRow("k","Colour",L.k,1800,10000,100,Math.round(L.k/100)*100+" K",RLB_KTRK);
      b+=rbRow("h","Height",L.h,rbMinH(L.fx),5,0.05,L.h.toFixed(2)+" m");
      if(L.kind===3) b+='<div class="rb-pills">'+Object.keys(RLB_SURF).map(function(k){ return '<button class="lr-pill'+(L.surf===k?' on':'')+'" data-rb-surf="'+k+'">'+RLB_SURF[k].n+'</button>'; }).join("")+'</div><p class="rb-note">A reflector bounces back the light that hits it, so angle it between the light and your subject.</p>';
      if(L.kind<2) b+='<div class="rb-pills">'+RL_GELS.map(function(g){ return '<button class="lr-pill'+(L.gel===g[0]?' on':'')+'" data-rb-gel="'+g[0]+'" style="--g:'+g[0]+'"><i></i>'+(g[1]==="None"?"No gel":g[1])+'</button>'; }).join("")+'</div>';
      if(L.kind!==0) b+='<div class="rb-pills"><button class="lr-pill" data-rb="aimsub">Aim at the subject</button></div>';
      h+=rbSec("light",L.name,b); }
    h+='<div class="rb-foot"><button class="lr-ghost" data-rb="clear">Clear the set</button></div>';
    p.innerHTML=h; var cv=$("rbDiag"); cv.addEventListener("pointerdown",rbDiagDown); cv.addEventListener("pointermove",rbDiagMove); cv.addEventListener("pointerup",function(){ RLB.ddrag=null; }); }
  function rbFacts(L,role){ return (role?role.toUpperCase()+' · ':'')+(L.kind===3?'':Math.round(L.R*200)+' cm across · ')+rbDist(L).toFixed(1)+' m away'+(L.ang!=null?' · '+L.ang+'° round from you':''); }
  function rbInput(e){ var k=e.target.getAttribute("data-rb-k"); if(!k) return; var v=+e.target.value, em=e.target.parentNode.querySelector(".lr-v");
    var L=rbCur(); if(!L) return;
    if(k==="stops"){ L.stops=v; L.power=L.base*Math.pow(2,v); em.textContent=rbFmtStops(v); }
    else if(k==="k"){ L.k=v; em.textContent=Math.round(v/100)*100+" K"; }
    else if(k==="h"){ L.h=v; rbPlace(L,L.x,L.z); em.textContent=L.h.toFixed(2)+" m"; }
    rbStands(); rbDirty(); rbPanel(false); }
  /* dragging from the kit: the piece follows you over the strip, then stands on the ground under the pointer */
  window.addEventListener("pointermove",function(e){ var K=RLB.kdrag; if(!K) return; var gh=$("rbGhost");
    if(!K.moved&&Math.hypot(e.clientX-K.x,e.clientY-K.y)>6) K.moved=true; if(!K.moved) return;
    var over=e.target===renderer.domElement, T=rbTarget(), p=over?rbOnPlane(e,rlGround(T.x,T.z)):null; gh.classList.toggle("show",!p); gh.style.left=e.clientX+"px"; gh.style.top=e.clientY+"px";
    K.p=p; rbHolo(p?K.fx:null,p); },true);   /* over the scene you drag a light hologram, not the real thing: no relighting until you let go */
  window.addEventListener("pointerup",function(e){ var K=RLB.kdrag; if(!K) return; RLB.kdrag=null; var gh=$("rbGhost"); if(gh) gh.classList.remove("show"); rbHolo(null);
    if(!K.moved) return; RLB.kjust=Date.now(); var p=K.p; if(!p) return;
    var n=RL.lights.length; rbAdd(K.fx); var L=RL.lights[RL.lights.length-1]; if(RL.lights.length===n||!L) return;
    var T=rbTarget(), H=rbHoloSnap(K.fx,p); rbPlace(L,H.x,H.z); rbAim(L,K.fx==="sodium"?{x:L.x,y:L.g,z:L.z}:T); rbStands(); rbPanel(true); rbDirty(); },true);
  /* the hologram: a light, see-through stand and head in gold, plus the dial where it will stand */
  var RLB_HOLOMAT=null;
  function rbHoloSnap(fx,p){ var sp=RLB.spotNow; if(sp&&sp.fx===fx&&Math.hypot(p.x-sp.x,p.z-sp.z)<0.28*RL.S) return {x:sp.x,z:sp.z}; return {x:p.x,z:p.z}; }
  function rbHolo(fx,p){ var G=RLB.holo; if(!fx||!p){ if(G) G.visible=false; return; } if(typeof scene==="undefined"||!scene) return;
    if(G&&G.parent!==scene){ G.traverse(function(o){ if(o.geometry) o.geometry.dispose(); }); G=null; RLB.holo=null; } if(!G||G.userData.fx!==fx){ if(G){ scene.remove(G); G.traverse(function(o){ if(o.geometry) o.geometry.dispose(); }); }
      if(!RLB_HOLOMAT) RLB_HOLOMAT={fill:new THREE.MeshBasicMaterial({color:0xf0c46e, transparent:true, opacity:0.18, depthWrite:false, toneMapped:false, side:THREE.DoubleSide}), edge:new THREE.LineBasicMaterial({color:0xffd690, transparent:true, opacity:0.85, toneMapped:false}),
        ring:new THREE.MeshBasicMaterial({map:rbRingTex(), color:0xf0c46e, transparent:true, opacity:0.9, depthWrite:false, toneMapped:false})};
      var F=RLB_FX[fx]||RLB_FX.softbox, T=rbTarget(), subH=(T.y-rlGround(T.x,T.z))/RL.S, h=fx==="sodium"?F.h:Math.min(F.h,Math.max(rbMinH(fx),subH+0.55)), w=Math.max(0.16,Math.min(0.9,(F.R||0.1)*2));
      G=new THREE.Group(); G.userData.fx=fx; G.name="rbHolo";
      var add=function(geo,x,y,z){ var m=new THREE.Mesh(geo,RLB_HOLOMAT.fill); m.position.set(x,y,z); G.add(m); var l=new THREE.LineSegments(new THREE.EdgesGeometry(geo),RLB_HOLOMAT.edge); l.position.set(x,y,z); G.add(l); };
      add(new THREE.CylinderGeometry(0.012,0.012,h,6),0,h/2,0);
      if(fx!=="sodium") for(var k=0;k<3;k++){ var a=k*2.094, lg=new THREE.CylinderGeometry(0.008,0.008,0.5,4); lg.rotateZ(0.9); lg.rotateY(a); add(lg,Math.cos(a)*0.17,0.15,-Math.sin(a)*0.17); }
      var head=fx==="reflector"||fx==="umbrella"?new THREE.CylinderGeometry(w/2,w/2,0.02,10):fx==="strip"?new THREE.BoxGeometry(0.22,0.9,0.18):new THREE.BoxGeometry(w,w*(fx==="softbox"?1:0.75),Math.max(0.14,w*0.45));
      if(fx==="reflector"||fx==="umbrella") head.rotateX(Math.PI/2); add(head,0,h,0);
      var rg=new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.3),RLB_HOLOMAT.ring); rg.rotation.x=-Math.PI/2; rg.position.y=0.015; rg.scale.setScalar(0.6); G.add(rg);
      G.traverse(function(o){ o.renderOrder=8; o.raycast=function(){}; }); scene.add(G); RLB.holo=G; }
    var q=rbHoloSnap(fx,p), T2=rbTarget(); G.visible=true; G.position.set(q.x,rlGround(q.x,q.z),q.z); G.scale.setScalar(RL.S); G.rotation.y=Math.atan2(T2.x-q.x,T2.z-q.z); }
  function rbClick(e){ var hd=e.target.closest(".lr-sechdr"); if(hd){ var sec=hd.parentNode, id=sec.getAttribute("data-rb-sec"); sec.classList.toggle("collapsed"); RLB.coll=RLB.coll||{}; RLB.coll[id]=sec.classList.contains("collapsed"); return; }
    var b=e.target.closest("[data-rb],[data-rb-fx],[data-rb-pick],[data-rb-gel],[data-rb-surf],[data-rb-day],[data-rb-on],[data-rb-del]"); if(!b) return; e.stopPropagation(); if(b.tagName==="BUTTON") b.blur(); var L=rbCur();
    if(b.hasAttribute("data-rb-fx")){ if(RLB.kjust&&Date.now()-RLB.kjust<400) return; return rbAdd(b.getAttribute("data-rb-fx")); }   /* a drag already placed it */
    if(b.hasAttribute("data-rb-on")){ var Lo=RL.lights[+b.getAttribute("data-rb-on")]; if(Lo){ Lo.on=!Lo.on; sfx("lOn",{off:!Lo.on}); rbStands(); rbDirty(); rbPanel(true); } return; }
    if(b.hasAttribute("data-rb-del")) return rbRemove(+b.getAttribute("data-rb-del"));
    if(b.hasAttribute("data-rb-pick")){ RLB.sel=+b.getAttribute("data-rb-pick"); rbStands(); return rbPanel(true); }
    if(b.hasAttribute("data-rb-gel")){ if(L){ L.gel=b.getAttribute("data-rb-gel"); rbStands(); rbDirty(); rbPanel(true); } return; }
    if(b.hasAttribute("data-rb-surf")){ if(L){ L.surf=b.getAttribute("data-rb-surf"); rbStands(); rbDirty(); rbPanel(true); } return; }
    if(b.hasAttribute("data-rb-day")){ RLB.day=b.getAttribute("data-rb-day"); if(!RLB.sunMode) rbSunOn(); rbDirty(); rbTimeline(); return rbPanel(false); }
    var a=b.getAttribute("data-rb");
    if(a==="fit") return rbFit(); if(a==="done") return rlClose(); if(a==="clear") return rlNatural(); if(a==="shadows"){ RL.shadows=!RL.shadows; rbDirty(); return rbPanel(true); }
    if(a==="scan"){ RLB.sunMode=false; RLB.play=false; rbDirty(); rbTimeline(); return rbPanel(false); }
    if(a==="play"){ RLB.play=!RLB.play; if(RLB.play&&!RLB.sunMode){ rbSunOn(); RLB.mins=Math.max(RLB.mins,5*60); } return rbTimeline(); }
    if(!L) return;
    if(a==="aimsub"){ rbAim(L,rbTarget()); rbStands(); rbDirty(); rbPanel(false); } }

  /* ---- open and close ---- */
  function rlOpen(){ if(!loaded||!RLB) return; rbEls(); if(looking){ try{ document.exitPointerLock(); }catch(e){} }
    if(!RL.ready){ if(!viewer||!viewer.P||!viewer.mesh){ toast("Lighting: the scan isn't ready yet"); return; } RL.P=viewer.P; RL.A=viewer.A; RL.N=RL.P.length/3; RL.S=rlScale(); RL.ready=true; }

    RLB.open=true; RL.ui=true; RL.view="eye"; RL.plan=false; if(!Q.flags.rlOpened) qFlag("rlOpened"); document.body.classList.add("rl-open");
    var go=function(){ if(!RL.target) RL.target=rlTarget(); rbInstall(); if(!RLB.built){ var bz=$("rbBusy"); bz.classList.add("show"); setTimeout(function(){ try{ rlGrid(); rbGridSharp(); }catch(e){ console.warn("lightb grid",e); } RLB.built=true; bz.classList.remove("show"); rbDirty(); },60); } else rbDirty();
      rbShow(true); rbPanel(true); rbTimeline(); rbStands();
      /* the first time anyone opens Lighting, the tour starts */
      if(typeof coStart==="function"&&!(typeof CO!=="undefined"&&CO.on)&&!(Q.tours&&Q.tours.lightrig)){ var seen="1"; try{ seen=localStorage.getItem("studium_lighttourB"); }catch(e){} if(seen!=="1") setTimeout(function(){ if(RLB.open&&!(typeof CO!=="undefined"&&CO.on)){ try{ localStorage.setItem("studium_lighttourB","1"); }catch(e){} coStart("lightrig"); } },500); } };
    go(); }
  function rlClose(){ if(!RLB||!RLB.open) return; rbGlowSet(null); rbHolo(null); RLB.viewSeen=null; RLB.open=false; RL.ui=false; RLB.look=false; RLB.drag=null; RLB.play=false; document.body.classList.remove("rl-open"); rbShow(false); rbStands(); renderer.domElement.style.cursor=""; }
  function rlToggle(){ if(RLB&&RLB.open) rlClose(); else rlOpen(); }
  function rlNatural(){ if(!RLB) return; RLB.boost=1; RLB.sat=1; RL.lights.forEach(rbDropStand); RL.lights=[]; RLB.sel=-1; RLB.sunMode=false; RLB.play=false; RL.on=false; rbRestore(); RLB.eye=1; rbPanel(true); rbTimeline(); }
  function rlForget(){ if(!RLB) return; RLB.boost=1; RLB.sat=1; rlClose(); RL.lights.forEach(rbDropStand); RL.lights=[]; RLB.sel=-1; RLB.sunMode=false; RL.on=false; RL.ready=false; RL.target=null; RLB.built=false;
    if(RL.grid&&RL.grid.tex) RL.grid.tex.dispose(); RL.grid=null; if(RLB.gridS&&RLB.gridS.tex) RLB.gridS.tex.dispose(); RLB.gridS=null; RLB.gpu=null; RL.gpu=null; RLB.eye=1; RLB.north=null;
    if(RLB.spotM){ if(RLB.spotM.parent) RLB.spotM.parent.remove(RLB.spotM); RLB.spotM.traverse(function(o){ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }); RLB.spotM=null; } RLB.home=null; RLB.spotNow=null; RLB.frame=null; RLB.viewSeen=null; if(RLB.holo){ RLB.holo.traverse(function(o){ if(o.geometry) o.geometry.dispose(); }); if(RLB.holo.parent) RLB.holo.parent.remove(RLB.holo); RLB.holo=null; } RLB.glowL=null; }   /* a new scan has a new scene */
  function rlVis(){ if(RLB) rbStands(); }
  function rlPlanUI(){} function rlPanel(){} function rlMarkers(){}

  var rbLast=0;
  (function rbTick(t){ requestAnimationFrame(rbTick); var dt=Math.min(0.1,((t||0)-rbLast)/1000); rbLast=t||0;
    if(RLB.open&&rbAway()){ rlClose(); return; }
    /* smooth edges on the kit: multisample the scene only while stands are out, so shooting costs the same as before */
    var want=RLB.open&&!viewfinderOn, ox=want?RLB_SIDE/2:0, oy=want?(($("rbKit")||{}).offsetHeight||0)/2-(($("rbDay")||{}).offsetHeight||0)/2-7:0; RLB.vo=RLB.vo||{x:0,y:0};
    var kx=1-Math.exp(-dt*9); RLB.vo.x+=(ox-RLB.vo.x)*kx; RLB.vo.y+=(oy-RLB.vo.y)*kx; if(Math.abs(RLB.vo.x-ox)<0.5&&Math.abs(RLB.vo.y-oy)<0.5){ RLB.vo.x=ox; RLB.vo.y=oy; }
    if(RLB.vo.x||RLB.vo.y){ camera.setViewOffset(innerWidth,innerHeight,RLB.vo.x,RLB.vo.y,innerWidth,innerHeight); RLB.voOn=true; } else if(RLB.voOn){ camera.clearViewOffset(); RLB.voOn=false; }   /* the panel and the strip cover the right and the bottom: frame the scene in what's left */
    var msaa=RLB.open&&!viewfinderOn&&RL.lights.length?4:0; if(typeof sceneRT!=="undefined"&&sceneRT.samples!==msaa){ sceneRT.samples=msaa; sceneRT.dispose(); }
    if(RLB.open&&viewfinderOn){ rbShow(false); rbStands(); RLB.hidden=true; } else if(RLB.open&&RLB.hidden){ RLB.hidden=false; if(looking){ try{ document.exitPointerLock(); }catch(er){} } rbShow(true); rbStands(); }
    if(RLB.play&&RLB.open&&dt>0){ RLB.mins+=dt*40; if(RLB.mins>RLB_T1){ RLB.mins=RLB_T0+60; } rbDirty(); if(((t/250)|0)!==RLB.pt){ RLB.pt=(t/250)|0; rbTimeline(); } }
    rbViewTick(); rbFrameStep(dt); rbSpotTick();
    if(RLB.fadeT&&RLB.gpu){ var fk=Math.min(1,(performance.now()-RLB.fadeT)/1100); RLB.onK=fk*fk*(3-2*fk); RLB.gpu.U.on.value=RLB.onK; try{ RLB.gpu.mesh.updateVersion(); if(viewer&&viewer.detail) viewer.detail.updateVersion(); }catch(e){} if(fk>=1){ RLB.fadeT=0; RLB.onK=null; } }   /* the default look fading in as the opening lands */
    if(RLB.dirty&&RLB.built) rbApply();
    else if(RLB.gpu&&RLB.gpu.U.on.value>0){ var cm=RLB.camP; if(!cm||Math.hypot(camPos.x-cm.x,camPos.y-cm.y,camPos.z-cm.z)>0.4*RL.S){ RLB.camP={x:camPos.x,y:camPos.y,z:camPos.z}; if(cm) rbDirty(); } }
    if(RLB.open&&!viewfinderOn) rbDiagDraw(); })();

  /* ---- for the lighting tour: where things are, in words the tour can check ---- */
  function rbFind(fx){ for(var i=0;i<RL.lights.length;i++) if(RL.lights[i].fx===fx) return RL.lights[i]; return null; }
  function rbRoleOf(L){ var r=rbRoles(), i=RL.lights.indexOf(L); return i<0?null:r[i]; }
  function rbAngle(L){ rbRoles(); return L&&L.ang!=null?L.ang:null; }   /* degrees round from you: 0 beside the camera, 180 right behind the subject */
  function rbSideOf(L){ var T=rbTarget(), cx=camPos.x-T.x, cz=camPos.z-T.z, lx=L.x-T.x, lz=L.z-T.z; return cx*lz-cz*lx>0?1:-1; }   /* which side of you it stands */
  function rbSunAngle(){ if(!RLB.sunMode) return null; var T=rbTarget(), cx=T.x-camPos.x, cz=T.z-camPos.z, cl=Math.hypot(cx,cz)||1, a=(RLB.az+RLB.north)*Math.PI/180;
    return Math.round(Math.acos(Math.max(-1,Math.min(1,(cx*Math.sin(a)+cz*Math.cos(a))/cl)))*180/Math.PI); }   /* 0: the sun is behind the subject, shining at you */
  function rbRatioNow(){ return rbRatio(rbRoles()); }
  /* a point in the scene the tour can ring: an invisible box kept over it on screen */
  var _rbAV=new THREE.Vector3();
  function rbAnchor(p,size){ if(!p||!RLB.open) return null; var a=$("rbAnchor"); if(!a){ a=document.createElement("div"); a.id="rbAnchor"; a.style.cssText="position:fixed;pointer-events:none;z-index:1"; document.body.appendChild(a); }
    _rbAV.set(p.x,p.y,p.z).project(camera); if(_rbAV.z>1) return null; var sz=size||56, x=(_rbAV.x*0.5+0.5)*innerWidth, y=(-_rbAV.y*0.5+0.5)*innerHeight;
    a.style.left=(x-sz/2)+"px"; a.style.top=(y-sz/2)+"px"; a.style.width=sz+"px"; a.style.height=sz+"px"; return a; }
  function rbAnchorLight(L){ return L?rbAnchor({x:L.x,y:L.y,z:L.z},80):null; }
  function rbAnchorAim(L){ return L&&L.aimT?rbAnchor(L.aimT,40):null; }

  /* ---- tour spots: a gold mark on the ground where the next light goes, and a wide view that shows it ---- */
  var RLB_SPOT={key:[45,1.2,"KEY","softbox"], fill:[-55,1.0,"FILL","reflector"], rim:[-150,1.2,"RIM","strip"]};
  function rbHome(reset){ var T=rbTarget(); if(reset||!RLB.home){ var ax=camPos.x-T.x, az=camPos.z-T.z, al=Math.hypot(ax,az)||1; RLB.home={x:ax/al, z:az/al}; } return RLB.home; }   /* where you shoot from, held still so the spots don't wander as you orbit */
  function rbSpotAt(name){ var T=rbTarget(), S=RL.S, H=rbHome(), a, d, lab, fx;
    if(name==="fresnel"){ var B=rbFind("softbox"); if(!B) return null; var bx=B.x-T.x, bz=B.z-T.z, bl=Math.hypot(bx,bz)/S||1, sg=Math.atan2(H.x*bz-H.z*bx,H.x*bx+H.z*bz);
      a=sg-(sg>=0?1:-1)*17*Math.PI/180; d=bl*0.9; lab="FRESNEL"; fx="fresnel"; }   /* just beside the softbox, a touch nearer you */
    else { var D=RLB_SPOT[name]; if(!D) return null; var sk=RLB.keySide||1; a=D[0]*sk*Math.PI/180; d=D[1]; lab=D[2]; fx=D[3]; }
    var ca=Math.cos(a), sa=Math.sin(a), x=T.x+(H.x*ca-H.z*sa)*d*S, z=T.z+(H.x*sa+H.z*ca)*d*S; return {x:x, z:z, y:rlGround(x,z), label:lab, fx:fx, name:name}; }
  function rbNearSpot(L,name,m){ var p=L&&rbSpotAt(name); return !!(p&&Math.hypot(L.x-p.x,L.z-p.z)<=(m||0.35)*RL.S); }
  function rbTourSpot(){ if(typeof CO==="undefined"||!CO||!CO.on||!RLB.open||viewfinderOn||typeof coSteps!=="function") return null; var s=coSteps()[CO.i]; if(!s||!s.spot) return null;
    var n=typeof s.spot==="function"?s.spot():s.spot; return n?rbSpotAt(n):null; }
  var _rbSpotT=null, _rbLabT={};
  function rbSpotTex(){ if(_rbSpotT) return _rbSpotT; var N=512, c=document.createElement("canvas"); c.width=c.height=N; var g=c.getContext("2d"), m=N/2;
    g.fillStyle="rgba(240,196,110,.34)"; g.beginPath(); g.arc(m,m,N*0.36,0,7); g.fill();
    g.strokeStyle="rgba(255,214,140,.98)"; g.lineWidth=10; g.beginPath(); g.arc(m,m,N*0.36,0,7); g.stroke();
    g.lineWidth=6; g.setLineDash([22,18]); g.beginPath(); g.arc(m,m,N*0.46,0,7); g.stroke(); g.setLineDash([]);
    g.lineWidth=7; [[0,-1],[1,0],[0,1],[-1,0]].forEach(function(v){ g.beginPath(); g.moveTo(m+v[0]*N*0.1,m+v[1]*N*0.1); g.lineTo(m+v[0]*N*0.24,m+v[1]*N*0.24); g.stroke(); });
    _rbSpotT=new THREE.CanvasTexture(c); _rbSpotT.anisotropy=8; return _rbSpotT; }
  function rbLabTex(t){ if(_rbLabT[t]) return _rbLabT[t]; var c=document.createElement("canvas"); c.width=320; c.height=112; var g=c.getContext("2d");
    g.fillStyle="rgba(14,12,10,.92)"; g.strokeStyle="rgba(240,196,110,.95)"; g.lineWidth=4; var r=26; g.beginPath(); g.moveTo(r+4,4); g.arcTo(316,4,316,84,r); g.arcTo(316,84,4,84,r); g.arcTo(4,84,4,4,r); g.arcTo(4,4,316,4,r); g.closePath(); g.fill(); g.stroke();
    g.fillStyle="rgba(240,196,110,.95)"; g.beginPath(); g.moveTo(146,86); g.lineTo(174,86); g.lineTo(160,110); g.closePath(); g.fill();
    g.fillStyle="#f6dca6"; g.font="600 40px 'Geist Mono',monospace"; g.textAlign="center"; g.textBaseline="middle"; g.fillText(t,160,46);
    return (_rbLabT[t]=new THREE.CanvasTexture(c)); }
  function rbSpotMesh(){ if(RLB.spotM) return RLB.spotM; var G=new THREE.Group(); G.name="rbSpot";
    var disc=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({map:rbSpotTex(), transparent:true, alphaTest:0.25, depthWrite:true, toneMapped:false}));
    disc.rotation.x=-Math.PI/2; disc.renderOrder=-5; disc.name="disc"; disc.raycast=function(){}; G.add(disc);   /* drawn first, so the subject paints over it */
    var lab=new THREE.Sprite(new THREE.SpriteMaterial({map:rbLabTex("KEY"), depthTest:false, depthWrite:false, transparent:true, sizeAttenuation:false, toneMapped:false}));
    lab.renderOrder=20; lab.name="lab"; lab.center.set(0.5,0); lab.raycast=function(){}; G.add(lab);   /* always on top, so you can find it from anywhere */
    var ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,1,0)]), new THREE.LineBasicMaterial({color:0xf0c46e, transparent:true, opacity:0.7, toneMapped:false}));
    ln.name="post"; ln.raycast=function(){}; G.add(ln); G.visible=false; scene.add(G); RLB.spotM=G; return G; }
  function rbSpotTick(){ var p=rbTourSpot(); RLB.spotNow=p; if(!p){ if(RLB.spotM) RLB.spotM.visible=false; return; } if(typeof scene==="undefined"||!scene) return;
    var G=rbSpotMesh(), S=RL.S, pu=0.5+0.5*Math.sin(performance.now()/260), disc=G.getObjectByName("disc"), lab=G.getObjectByName("lab"), ln=G.getObjectByName("post"), lh=0.75*S;
    G.visible=true; G.position.set(p.x,p.y,p.z); disc.position.y=0.014*S; disc.scale.setScalar((0.62+0.06*pu)*S);
    if(lab.material.map!==rbLabTex(p.label)){ lab.material.map=rbLabTex(p.label); lab.material.needsUpdate=true; } lab.position.y=lh; lab.scale.set(0.1,0.035,1); lab.material.opacity=0.8+0.2*pu;
    ln.scale.set(1,lh,1); }
  /* step back to a view that shows the subject and the floor round it: for the tour, or when you've zoomed right in */
  /* the tour's views: wide to place a light, from where you shoot to judge it, from the side to watch a shadow's edge */
  var RLB_VIEWS={wide:{el:0.6, need:2.0, min:2.6}, shoot:{el:0.18, need:0.95, min:1.3}, judge:{el:0.32, need:1.4, min:1.8}, side:{el:0.45, need:1.3, min:1.8, turn:-75}};
  function rbView(name){ var V=RLB_VIEWS[name]; if(!V) return false; var H=rbHome(), h=H;
    if(V.turn){ var a=V.turn*(RLB.keySide||1)*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a); h={x:H.x*ca-H.z*sa, z:H.x*sa+H.z*ca}; }
    rbFrame(h,V); return true; }
  function rbStepView(){ if(typeof CO==="undefined"||!CO||!CO.on||typeof coSteps!=="function") return null; var s=coSteps()[CO.i]; if(!s||!s.view) return null; return typeof s.view==="function"?s.view():s.view; }
  function rbFit(){ var v=rbStepView(); if(!(v&&rbView(v))) rbFrame(); }   /* Fit: back to the tour's view, or just step back */
  function rbViewTick(){ if(!RLB.open||viewfinderOn||RLB.drag||RLB.kdrag) return; var v=rbStepView(); if(!v) return; var k=CO.tour+"|"+CO.i; if(!RLB.viewSeen||RLB.viewSeen.k!==k) RLB.viewSeen={k:k, n:{}}; if(RLB.viewSeen.n[v]) return; RLB.viewSeen.n[v]=1; rbView(v); }   /* each view once per step, never back and forth */   /* each step lines the camera up once; drag away freely after */
  function rbFrame(dir,V){ if(!RLB.open||viewfinderOn) return; V=V||RLB_VIEWS.wide; var T=rbTarget(), S=RL.S, h=dir;
    if(!h){ var ax=camPos.x-T.x, az=camPos.z-T.z, al=Math.hypot(ax,az); h=al>0.05*S?{x:ax/al,z:az/al}:rbHome(); }
    var gy=rlGround(T.x,T.z), vf=(camera.fov||50)*Math.PI/360, asp=Math.max(0.5,(innerWidth-RLB_SIDE)/Math.max(200,innerHeight-260)), half=Math.min(vf,Math.atan(Math.tan(vf)*asp));
    var dd=Math.max(V.min,Math.min(14,V.need/Math.tan(half)))*S, el=V.el, to={x:T.x+h.x*dd*Math.cos(el), y:(T.y+gy)/2+dd*Math.sin(el), z:T.z+h.z*dd*Math.cos(el)};   /* far enough for this lens to take in the view's radius round the subject */
    to.y=Math.max(to.y,rlGround(to.x,to.z)+0.25*S);
    if(typeof boundsOn!=="undefined"&&boundsOn){ to.x=Math.min(Math.max(to.x,boxMin.x),boxMax.x); to.y=Math.min(Math.max(to.y,boxMin.y),boxMax.y); to.z=Math.min(Math.max(to.z,boxMin.z),boxMax.z); }
    if(Math.hypot(to.x-camPos.x,to.y-camPos.y,to.z-camPos.z)<0.15*S) return; RLB.frame={a:{x:camPos.x,y:camPos.y,z:camPos.z}, b:to, t:0, t0:performance.now()}; RLB.fly=true; }
  function rbFrameStep(dt){ var F=RLB.frame; if(!F) return; if(!RLB.open||viewfinderOn){ RLB.frame=null; return; }
    F.t=Math.min(1,(performance.now()-F.t0)/900); var e=F.t<0.5?2*F.t*F.t:1-Math.pow(-2*F.t+2,2)/2, T0=rbTarget(), T={x:T0.x, y:(T0.y+rlGround(T0.x,T0.z))/2, z:T0.z};
    camPos.set(F.a.x+(F.b.x-F.a.x)*e, F.a.y+(F.b.y-F.a.y)*e, F.a.z+(F.b.z-F.a.z)*e);
    if(typeof boundsOn!=="undefined"&&boundsOn&&typeof bndClamp==="function") bndClamp();
    var dX=T.x-camPos.x, dY=T.y-camPos.y, dZ=T.z-camPos.z, dl=Math.hypot(dX,dY,dZ)||1; yaw=Math.atan2(-dX,-dZ); pitch=Math.asin(dY/dl); RLB.fly=true; if(typeof _vel!=="undefined") _vel.set(0,0,0);
    if(F.t>=1) RLB.frame=null; }
  /* the Stump's default look: daylight, today, 13:35. Built behind the opening's welcome, where the grid's hitch can't be seen;
     left alone if someone has already set their own light */
  function rbDefaultOk(){ return loaded&&viewer&&viewer.P&&viewer.mesh&&CH.spec&&CH.spec.id==="stump"&&!RLB.sunMode&&!RL.lights.length; }
  /* the slow part (the light grid) built ahead, behind the opening's dark */
  function rbDefaultPrep(){ if(!(loaded&&viewer&&viewer.P&&viewer.mesh&&CH.spec&&CH.spec.id==="stump")||RLB.built) return;   /* the opening's own rig may be up: the grid doesn't mind */ try{ if(!RL.ready){ RL.P=viewer.P; RL.A=viewer.A; RL.N=RL.P.length/3; RL.S=rlScale(); RL.ready=true; } if(!RL.target) RL.target=rlTarget();
      if(!RLB.built){ rlGrid(); rbGridSharp(); RLB.built=true; } }catch(e){ console.warn("default look prep",e); } }   /* grids only: installing the daylight shader here would take the scan away from the opening's rig */
  function rbDefaultLook(fade){ if(!rbDefaultOk()) return; rbDefaultPrep(); try{ rbInstall(); }catch(e){ console.warn("default look install",e); return; } if(fade){ RLB.onK=0; RLB.fadeT=performance.now(); }
    try{ var sp=CH.spec.spawn; if(sp&&RLB.north==null){ var yw=sp[2]||0, view=Math.atan2(-Math.sin(yw),-Math.cos(yw))*180/Math.PI, M=rbMarks(), sa=rbSolar(M.goldPm||19*60+30).az; RLB.north=((view+140-sa)%360+360)%360; }   /* the sun is set from the starting view, wherever the camera happens to be */
      RLB.day="today"; RLB.mins=13*60+35; RLB.boost=1.3; RLB.sat=1.2; rbSunOn(); rbDirty(); }catch(e){ console.warn("default look",e); } }
  if(/[?&]dev/.test(location.search)) window.__rlb={ RLB:RLB, RL:RL, deflook:rbDefaultLook, why:function(){ return {loaded:loaded, P:!!(viewer&&viewer.P), id:CH.spec&&CH.spec.id, sun:RLB.sunMode, lights:RL.lights.length}; }, deflook:rbDefaultLook, why:function(){ return {loaded:loaded, P:!!(viewer&&viewer.P), id:CH.spec&&CH.spec.id, sun:RLB.sunMode, lights:RL.lights.length}; }, open:rlOpen, close:rlClose, add:rbAdd, sel:function(i){ RLB.sel=i; rbStands(); rbPanel(true); },
    time:function(m){ RLB.mins=m; rbSunOn(); rbDirty(); rbTimeline(); }, scan:function(){ RLB.sunMode=false; rbDirty(); rbTimeline(); }, day:function(d){ RLB.day=d; rbDirty(); rbTimeline(); },
    light:function(o){ var L=rbCur(); if(!L) return; for(var k in o) L[k]=o[k]; if(o.stops!=null) L.power=L.base*Math.pow(2,o.stops); if(o.x!=null||o.z!=null||o.h!=null) rbPlace(L,L.x,L.z); if(o.aim) rbAim(L,rbTarget()); rbStands(); rbDirty(); rbPanel(true); },
    spot:function(a,d){ var L=rbCur(), T=rbTarget(); if(!L) return; var ax=camPos.x-T.x, az=camPos.z-T.z, al=Math.hypot(ax,az)||1; ax/=al; az/=al; var r=a*Math.PI/180, ca=Math.cos(r), sa=Math.sin(r); rbPlace(L,T.x+(ax*ca-az*sa)*d*RL.S,T.z+(ax*sa+az*ca)*d*RL.S); rbAim(L,T); rbStands(); rbDirty(); rbPanel(true); },
    shadows:function(v){ RL.shadows=v; rbDirty(); }, frame:function(){ rbFrame(); }, cam:function(){ return {x:camPos.x,y:camPos.y,z:camPos.z,framing:!!RLB.frame}; }, scr:function(x,y,z){ var v=new THREE.Vector3(x,y,z).project(camera); return {x:(v.x*0.5+0.5)*innerWidth, y:(-v.y*0.5+0.5)*innerHeight}; }, spotAt:rbSpotAt, spotNow:function(){ return RLB.spotNow; },
    orbit:function(dx,dy,z){ rbOrbit(dx,dy,z); return {x:camPos.x,y:camPos.y,z:camPos.z,fly:RLB.fly,T:rbTarget()}; },
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
