  // ================= WEATHER: rain, wind, fog and wet ground, live on the graphics card =================
  // Rain is its own little splat cloud (Spark sorts it in with the scan, so drops pass in front of and behind things
  // properly). Each drop is a thin splat stretched along the way it falls, and the stretch is how far a drop falls while
  // the shutter is open: 1/1000 freezes beads in the air, 1/30 drags them into streaks. That's the lesson.
  // Wind, fog and wet ground are one Spark object modifier on the scan: trees bend from the root and leaves flutter; flat upward
  // surfaces darken and catch a sheen; everything fades to grey with distance in fog; rain or fog greys the light.
  var WE={field:null, rain:0, wind:0, fog:0, mesh:null, U:null, scanU:null, scanMeshes:[], t0:performance.now(), lastCam:null, dirty:true, snd:null, sndT:0};
  var WE_LV=["Off","Light","Heavy"], WE_DROPS=18000, WE_SPLASH=2000;
  var WE_ITEMS=[["rain","Rain","5"],["wind","Wind","6"],["fog","Fog","7"]];
  var WE_ICON={
    rain:'<svg viewBox="0 0 24 24"><path d="M7 14.5a4 4 0 0 1 .4-8 5 5 0 0 1 9.6 1.3 3.4 3.4 0 0 1-.6 6.7Z"/><path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/></svg>',
    wind:'<svg viewBox="0 0 24 24"><path d="M3 9h11.5a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 13h15.5a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 17h7"/></svg>',
    fog:'<svg viewBox="0 0 24 24"><path d="M4 8h16M3 12h18M5 16h14M8 20h8"/></svg>'};
  function weAny(){ return WE.rain>0||WE.wind>0||WE.fog>0; }
  function weState(){ return {rain:WE.rain, wind:WE.wind, fog:WE.fog}; }
  function weAmt(k){ return k===0?0:k===1?0.45:1; }
  function weSet(k, lv){ WE[k]=Math.max(0,Math.min(2,lv|0)); WE.dirty=true; if(typeof sfx==="function") sfx("toggle"); weKitMark(); }
  function weCycle(k){ weSet(k, (WE[k]+1)%3); }
  function weS(){ return typeof rlScale==="function"?rlScale():1; }
  function weGround(){ var g=typeof rlGround==="function"?rlGround(camPos.x,camPos.z):camPos.y-1.6; return isFinite(g)?g:camPos.y-1.6; }
  /* how long the shutter is open for what you're seeing: the real setting through the camera, about 1/60 for your eyes */
  function weShutter(){ return viewfinderOn&&typeof SHUTTERS!=="undefined"?SHUTTERS[shIdx]:1/60; }
  function weWindDir(){ var a=0.7; return [Math.sin(a), Math.cos(a)]; }

  var WE_GLSL=[
    "vec3 weRot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }",
    "vec3 weRotInv(vec4 q, vec3 v){ return weRot(vec4(-q.xyz,q.w), v); }",
    "float weH(float n){ return fract(sin(n*12.9898)*43758.5453); }",
    "vec4 weFromY(vec3 d){ vec3 a=cross(vec3(0.0,1.0,0.0),d); float w=1.0+d.y; if(w<1e-4) return vec4(1.0,0.0,0.0,0.0); return normalize(vec4(a,w)); }"].join("\n");

  // ---- the rain: drops on a world-anchored lattice, wrapped into a box that follows you ----
  function weRainBuild(){ var D=SPARK.dyno, U={}, n=WE_DROPS+WE_SPLASH;
    var mesh=new SPARK.SplatMesh({constructSplats:function(sp){ var c=new THREE.Vector3(), s=new THREE.Vector3(0.001,0.001,0.001), q=new THREE.Quaternion(), col=new THREE.Color(0.8,0.84,0.88);
      for(var i=0;i<n;i++){ c.set(Math.random(),Math.random(),Math.random()); sp.pushSplat(c,s,q,1,col); } }});
    U.t=D.dynoFloat(0); U.amt=D.dynoFloat(0); U.cam=D.dynoVec3(new THREE.Vector3()); U.box=D.dynoVec3(new THREE.Vector3(14,7,14)); U.gy=D.dynoFloat(0);
    U.vel=D.dynoVec3(new THREE.Vector3(0,-8,0)); U.len=D.dynoFloat(0.1); U.th=D.dynoFloat(0.002); U.al=D.dynoFloat(0.5); U.S=D.dynoFloat(1); U.lit=D.dynoFloat(1);
    var types={gsplat:D.Gsplat, t:"float", amt:"float", cam:"vec3", box:"vec3", gy:"float", vel:"vec3", len:"float", th:"float", al:"float", S:"float", lit:"float"};
    var mod=D.dynoBlock({gsplat:D.Gsplat},{gsplat:D.Gsplat},function(io){ var ins={gsplat:io.gsplat}; for(var k in U) ins[k]=U[k];
      var dd=D.dyno({inTypes:types, outTypes:{gsplat:D.Gsplat}, inputs:ins, globals:function(){ return [WE_GLSL]; },
        statements:function(c){ var i=c.inputs, o=c.outputs.gsplat; return [
          o+" = "+i.gsplat+";",
          "float id=float("+o+".index); float h=weH(id*0.731+1.3); vec3 u="+o+".center;",
          "vec3 org=vec3("+i.cam+".x-"+i.box+".x*0.5, "+i.gy+", "+i.cam+".z-"+i.box+".z*0.5);",
          "vec3 col=vec3(0.78,0.82,0.87)*"+i.lit+"; float a=0.0;",
          "if(id<"+WE_DROPS+".0){",
          "  vec3 q=u*"+i.box+"+"+i.vel+"*"+i.t+"*(0.85+0.3*h); vec3 p=org+mod(q-org,"+i.box+");",
          /* fade at the sides of the box so drops never pop in, and thin out the light rain */
          "  vec2 e=min(p.xz-org.xz, org.xz+"+i.box+".xz-p.xz)/("+i.box+".xz*0.18); float edge=clamp(min(e.x,e.y),0.0,1.0);",
          "  float top=clamp(("+i.gy+"+"+i.box+".y-p.y)/("+i.box+".y*0.2),0.0,1.0);",
          "  float near=smoothstep(0.45*"+i.S+",1.3*"+i.S+",length(p-"+i.cam+"));",   /* nothing smears right across the lens, and far less to draw */
          "  a=(h<"+i.amt+")?"+i.al+"*edge*top*near:0.0;",
          "  vec3 d=normalize(-"+i.vel+"); "+o+".center=p; "+o+".quaternion=weFromY(d);",
          "  "+o+".scales=vec3("+i.th+", max("+i.len+"*0.25,"+i.th+"*1.4), "+i.th+");",
          "} else {",
          /* a splash: a flat ring of spray where a drop lands, a different place every time */
          "  float rate=2.6+1.4*h; float ph=fract("+i.t+"*rate+h*7.0); float cyc=floor("+i.t+"*rate+h*7.0);",
          "  vec2 xz=fract(u.xz+vec2(weH(cyc+id*0.11),weH(cyc*1.7+id*0.37)));",
          "  vec2 pw=org.xz+xz*"+i.box+".xz*0.7+"+i.box+".xz*0.15;",
          "  float r=(0.006+0.04*ph)*"+i.S+"; "+o+".center=vec3(pw.x, "+i.gy+"+0.004*"+i.S+", pw.y); "+o+".quaternion=vec4(0.0,0.0,0.0,1.0);",
          "  "+o+".scales=vec3(r, 0.0015*"+i.S+", r);",
          "  a=(ph<0.22&&h<"+i.amt+")?(1.0-ph/0.22)*0.32:0.0;",
          "}",
          ""+o+".rgba=vec4(col, a);"]; } });
      return {gsplat:dd.outputs.gsplat}; });
    mesh.objectModifier=mod; mesh.updateGenerator(); mesh.frustumCulled=false; WE.mesh=mesh; WE.U=U; }

  // ---- what bends in the wind: a map of the scan, worked out once from its own splats ----
  // A 3D grid over the place. Each cell says how much it bends (trees: nothing at the root, more and more up the trunk
  // into the canopy, so a whole tree leans together) and how much it flutters (leaves and grass). Solid things stay put:
  // a cell inside a wall, a fence post, the stump or the ground is dense across a wide neighbourhood, while a branch is a
  // thin thing with air all round it. Leafiness comes from each splat's colour (green over red and blue).
  function weBlur(a, nx, ny, nz, r){ a=a.slice(); if(r<1) return a; var b=new Float32Array(a.length), st=[1,nx,nx*ny], ln=[nx,ny,nz], d, x, y, z;
    for(d=0;d<3;d++){ var s=st[d], L=ln[d], w=1/(2*r+1), o=[nx,ny,nz]; o[d]=1;
      for(z=0;z<o[2];z++) for(y=0;y<o[1];y++) for(x=0;x<o[0];x++){ var base=(z*ny+y)*nx+x, acc=0, k;
        for(k=-r;k<=r;k++){ var q=Math.max(0,Math.min(L-1,k)); acc+=a[base+q*s]; }
        for(k=0;k<L;k++){ b[base+k*s]=acc*w; var qa=Math.min(L-1,k+r+1), qr=Math.max(0,k-r); acc+=a[base+qa*s]-a[base+qr*s]; } }
      var t=a; a=b; b=t; }
    return a; }
  function wePct(arr, p){ var v=[], st=Math.max(1,Math.floor(arr.length/200000)); for(var i=0;i<arr.length;i+=st) if(arr[i]>0) v.push(arr[i]); if(!v.length) return 1; v.sort(function(a,b){ return a-b; }); return v[Math.floor(v.length*p)]||1; }
  function weField(){ var P=viewer&&viewer.P; if(!P) return null; if(WE.field&&WE.field.P===P) return WE.field;
    var A=viewer.A, G=viewer.Gr, N=P.length/3, S=weS(), i, ax;
    /* the box: almost everything (the treeline at the edge is what should move most), not the walls' tight 2 to 98% */
    var lo=[0,0,0], hi=[0,0,0];
    for(ax=0;ax<3;ax++){ var v=[], st=Math.max(1,Math.floor(N/150000)); for(i=0;i<N;i+=st) v.push(P[i*3+ax]); v.sort(function(a,b){ return a-b; }); lo[ax]=v[Math.floor(v.length*0.004)]; hi[ax]=v[Math.floor(v.length*0.996)]; }
    var pad=0.4*S; for(ax=0;ax<3;ax++){ lo[ax]-=pad; hi[ax]+=pad; }
    var ex=hi[0]-lo[0], ey=hi[1]-lo[1], ez=hi[2]-lo[2], cell=Math.max(Math.cbrt(ex*ey*ez/1.6e6), Math.max(ex,ey,ez)/256, 0.08*S);
    var nx=Math.max(2,Math.ceil(ex/cell)), ny=Math.max(2,Math.ceil(ey/cell)), nz=Math.max(2,Math.ceil(ez/cell)), M=nx*ny*nz, occ=new Float32Array(M), grn=new Float32Array(M);
    for(i=0;i<N;i++){ var a=A?A[i]:1; if(a<0.05) continue; var gx=((P[i*3]-lo[0])/cell)|0, gy=((P[i*3+1]-lo[1])/cell)|0, gz=((P[i*3+2]-lo[2])/cell)|0;
      if(gx<0||gy<0||gz<0||gx>=nx||gy>=ny||gz>=nz) continue; var c=(gz*ny+gy)*nx+gx; occ[c]+=a; if(G) grn[c]+=a*G[i]/255; }
    var occL=weBlur(occ,nx,ny,nz,1), grnL=weBlur(grn,nx,ny,nz,1), occW=weBlur(occ,nx,ny,nz,Math.max(2,Math.round(0.6*S/cell)));
    var mL=wePct(occL,0.85), mW=wePct(occW,0.85), out=new Uint8Array(M*4), x, y, z;
    for(z=0;z<nz;z++) for(x=0;x<nx;x++){ var wx=lo[0]+(x+0.5)*cell, wz=lo[2]+(z+0.5)*cell, g=WK.col&&typeof wkGround==="function"?wkGround(wx,wz):NaN;
      if(!(g>-1e8&&g<1e8)){ g=lo[1]+pad; for(y=0;y<ny;y++){ if(occL[(z*ny+y)*nx+x]>0.15*mL){ g=lo[1]+(y+0.5)*cell; break; } } }   /* no walk map: the lowest solid thing in the column is the ground */
      for(y=0;y<ny;y++){ var ci=(z*ny+y)*nx+x, h=(lo[1]+(y+0.5)*cell-g)/S;
        var solidW=Math.min(1,occW[ci]/mW), solidL=Math.min(1,occL[ci]/mL), gf=occL[ci]>1e-6?grnL[ci]/occL[ci]:0;
        var hf=Math.pow(Math.max(0,Math.min(1,(h-0.3)/6)),1.2);   /* rooted: nothing at the ground, most at the top of a tall tree */
        var leafy=Math.max(0,Math.min(1,(gf-0.04)/0.2));
        var rigid=Math.pow(solidW,1.5)*(1-leafy);   /* a wall or a post is dense all round and not leafy; a thick canopy is dense but leafy, so it still moves */
        var bend=hf*(1-0.9*rigid);
        var flut=leafy*(1-0.4*solidL)+0.45*hf*(1-0.5*solidL);   /* leaves and grass, and bare twigs up high */
        flut*=0.35+0.65*Math.max(0,Math.min(1,(h-0.4)/1.6));   /* low things (ivy on a stump, grass) only shiver; it builds up into the canopy */
        flut*=1-0.6*solidW;   /* stuck to something solid */
        if(h<0.03) flut*=0.2;
        out[ci*4]=Math.round(Math.max(0,Math.min(1,bend))*255); out[ci*4+1]=Math.round(Math.max(0,Math.min(1,flut))*255); } }
    var tex=new THREE.Data3DTexture(out,nx,ny,nz); tex.format=THREE.RGBAFormat; tex.type=THREE.UnsignedByteType; tex.minFilter=tex.magFilter=THREE.LinearFilter;
    tex.wrapS=tex.wrapT=tex.wrapR=THREE.ClampToEdgeWrapping; tex.unpackAlignment=1; tex.needsUpdate=true;
    if(WE.field&&WE.field.tex) try{ WE.field.tex.dispose(); }catch(e){}
    WE.field={P:P, tex:tex, out:out, nx:nx, ny:ny, nz:nz, cell:cell, lo:lo, o:new THREE.Vector3(lo[0],lo[1],lo[2]), inv:new THREE.Vector3(1/(nx*cell),1/(ny*cell),1/(nz*cell))}; return WE.field; }

  // ---- wind, wet and fog on the scan ----
  function weScanMod(){ var D=SPARK.dyno, U=WE.scanU;
    if(!U){ U=WE.scanU={}; var dummy=new THREE.Data3DTexture(new Uint8Array(4),1,1,1); dummy.format=THREE.RGBAFormat; dummy.type=THREE.UnsignedByteType; dummy.needsUpdate=true;
      U.on=D.dynoFloat(0); U.t=D.dynoFloat(0); U.wind=D.dynoVec3(new THREE.Vector3()); U.wet=D.dynoFloat(0); U.fog=D.dynoFloat(0); U.ovc=D.dynoFloat(0);
      U.cam=D.dynoVec3(new THREE.Vector3()); U.q=D.dynoVec4(new THREE.Vector4(0,0,0,1)); U.s=D.dynoFloat(1); U.S=D.dynoFloat(1); U.fc=D.dynoVec3(new THREE.Vector3(0.7,0.72,0.74));
      U.fok=D.dynoFloat(0); U.dbg=D.dynoFloat(0); U.fld=D.dynoSampler3D(dummy); U.fo=D.dynoVec3(new THREE.Vector3()); U.finv=D.dynoVec3(new THREE.Vector3(1,1,1)); }
    var types={gsplat:D.Gsplat, on:"float", t:"float", wind:"vec3", wet:"float", fog:"float", ovc:"float", cam:"vec3", q:"vec4", s:"float", S:"float", fc:"vec3", fok:"float", dbg:"float", fld:"sampler3D", fo:"vec3", finv:"vec3"};
    return D.dynoBlock({gsplat:D.Gsplat},{gsplat:D.Gsplat},function(io){ var ins={gsplat:io.gsplat}; for(var k in U) ins[k]=U[k];
      var dd=D.dyno({inTypes:types, outTypes:{gsplat:D.Gsplat}, inputs:ins, globals:function(){ return ["precision highp sampler3D;", WE_GLSL]; },
        statements:function(c){ var i=c.inputs, o=c.outputs.gsplat; return [
          o+" = "+i.gsplat+";",
          "if("+i.on+">0.5 && isGsplatActive("+o+".flags)){",
          "  vec3 cw=weRot("+i.q+", "+o+".center*"+i.s+"); vec3 col="+o+".rgba.rgb; vec3 sc=abs("+o+".scales)*"+i.s+";",
          "  float mx=max(sc.x,max(sc.y,sc.z)), mn=min(sc.x,min(sc.y,sc.z)), md=sc.x+sc.y+sc.z-mn-mx;",
          "  float ws=length("+i.wind+");",
          "  if(ws>0.0 && "+i.fok+">0.5){ vec3 uv=(cw-"+i.fo+")*"+i.finv+";",
          "    if(all(greaterThanEqual(uv,vec3(0.0)))&&all(lessThanEqual(uv,vec3(1.0)))){ vec2 fl=texture("+i.fld+",uv).rg; float S="+i.S+";",
          "      vec3 wd="+i.wind+"/ws; vec3 pp=vec3(-wd.z,0.0,wd.x); float tt="+i.t+";",
          /* gusts roll across the place downwind, so neighbouring trees move together, then the next ones */
          "      float ph=dot(cw.xz,wd.xz)/(7.0*S)-tt*0.32; float g1=sin(ph*6.2832), g2=sin(ph*14.1+1.7+cw.x*0.07/S+cw.z*0.05/S);",
          "      float gust=clamp(0.55+0.3*g1+0.15*g2,0.0,1.0);",
          "      float lean=0.4+0.6*gust; float rock=sin(tt*0.95+dot(cw.xz,vec2(0.11,0.17))/S)*0.35+sin(tt*1.7+cw.z*0.23/S)*0.15;",
          "      float Ab=fl.r*ws*0.42*S; vec3 dw=wd*Ab*(lean+rock*0.6)+pp*Ab*0.22*sin(tt*0.8+cw.x*0.3/S);",
          "      dw.y-=0.18*Ab*lean*fl.r;",   /* a bent tree drops its top a little */
          /* flutter: each splat on its own quick little path, harder in a gust */
          "      if(fl.g>0.004){ float h1=weH(dot("+o+".center,vec3(12.7,31.1,7.4))), h2=weH(h1*91.7+3.1), h3=weH(h2*57.3+1.9);",
          "        vec3 rd=normalize(vec3(h1-0.5,(h2-0.5)*0.6,h3-0.5)+wd*0.3); float fr=5.0+5.0*h1;",
          "        float fa=fl.g*ws*(0.008+0.022*gust)*S*(1.0-smoothstep(0.03*S,0.25*S,mx));",
          "        dw+=rd*fa*sin(tt*fr+h2*6.2832)+wd*fl.g*ws*0.012*S*gust; }",
          "      if("+i.dbg+">0.5) col=vec3(fl.r,fl.g,0.15);",   /* dev: see the map, red bends and green flutters */
          "      "+o+".center+=weRotInv("+i.q+",dw)/"+i.s+"; } }",
          /* wet: flat surfaces facing up go dark and rich, and catch the sky at a low angle */
          "  if("+i.wet+">0.0){ int k=(sc.x<=sc.y&&sc.x<=sc.z)?0:((sc.y<=sc.z)?1:2); vec3 ax=k==0?vec3(1.0,0.0,0.0):(k==1?vec3(0.0,1.0,0.0):vec3(0.0,0.0,1.0));",
          "    vec3 n=normalize(weRot("+i.q+",weRot("+o+".quaternion,ax))); float fl2=clamp(1.0-mn/max(md,1e-6)*1.4,0.0,1.0);",
          "    float upf=smoothstep(0.45,0.9,abs(n.y))*fl2; float wk="+i.wet+"*(0.35+0.65*upf);",
          "    float lum=dot(col,vec3(0.299,0.587,0.114)); vec3 rich=pow(max(col,vec3(0.0)),vec3(1.45))*0.92; rich=mix(vec3(dot(rich,vec3(0.299,0.587,0.114))),rich,1.18);",
          "    col=mix(col,rich,wk*0.9);",
          "    vec3 V=normalize("+i.cam+"-cw); float fr2=pow(1.0-abs(dot(n,V)),4.0); col+=vec3(0.62,0.66,0.7)*fr2*upf*"+i.wet+"*0.32*(0.4+lum); }",
          "  col*=mix(vec3(1.0),vec3(0.84,0.87,0.92),"+i.ovc+");",
          "  if("+i.fog+">0.0){ float d=max(0.0,length(cw-"+i.cam+")/"+i.S+"-2.5); float ff=1.0-exp(-d*"+i.fog+"); col=mix(col,"+i.fc+",ff*0.94); }",   /* clear air for the first couple of metres: what you're photographing stays crisp */
          "  "+o+".rgba.rgb=clamp(col,0.0,1.0);",
          "}"]; } });
      return {gsplat:dd.outputs.gsplat}; }); }
  function weHook(m){ if(!m||WE.scanMeshes.indexOf(m)>=0) return; try{ m.objectModifier=weScanMod(); m.updateGenerator(); WE.scanMeshes.push(m); }catch(e){ console.warn("weather hook",e); } }

  // ---- every frame, before the scene draws ----
  // The scan is only rebuilt when it has to be: every frame while the wind blows (it moves), otherwise only when you've
  // walked far enough for the fog or the wet sheen to change. Rain on its own never touches the scan per frame.
  function weTick(dt){ if(!viewer||!loaded||!scene||typeof SPARK==="undefined") return;
    var S=weS(), gy=weGround(), t=(performance.now()-WE.t0)/1000, any=weAny();
    WE.scanMeshes=WE.scanMeshes.filter(function(m){ return m===viewer.mesh||m===viewer.detail; });
    if(any||WE.scanMeshes.length){ weHook(viewer.mesh); if(viewer.detail) weHook(viewer.detail); }
    var U=WE.scanU, wd=weWindDir(), ra=weAmt(WE.rain), wa=weAmt(WE.wind), fa=weAmt(WE.fog);
    if(U){ var wasOn=U.on.value>0.5; U.on.value=any?1:0; U.t.value=t;
      if(wa>0&&U.fok.value<0.5){ var F=null; try{ F=weField(); }catch(e){ console.warn("wind field",e); } if(F){ U.fld.value=F.tex; U.fo.value.copy(F.o); U.finv.value.copy(F.inv); U.fok.value=1; WE.dirty=true; } }
      if(WE.field&&viewer.P!==WE.field.P){ U.fok.value=0; }
      U.wind.value.set(wd[0]*wa,0,wd[1]*wa); U.wet.value=Math.min(1,ra*1.1); U.fog.value=fa?0.035+fa*0.11:0; U.ovc.value=Math.min(1,ra*0.85+fa*0.4);
      U.S.value=S; var m0=viewer.mesh; U.q.value.set(m0.quaternion.x,m0.quaternion.y,m0.quaternion.z,m0.quaternion.w); U.s.value=m0.scale.x||1;
      var far=!WE.lastCam||WE.lastCam.distanceToSquared(camera.position)>0.0625*S*S;   /* a quarter of a metre */
      if(any&&(wa>0||far||WE.dirty)||(wasOn&&!any)){ if(far||WE.dirty||!WE.lastCam){ U.cam.value.copy(camera.position); WE.lastCam=(WE.lastCam||new THREE.Vector3()).copy(camera.position); }
        WE.scanMeshes.forEach(function(m){ m.updateVersion(); }); } }
    /* the rain */
    if(ra>0&&!WE.mesh){ try{ weRainBuild(); }catch(e){ console.warn("rain",e); WE.rain=0; ra=0; } }
    if(WE.mesh){ if(WE.mesh.parent!==scene){ if(WE.mesh.parent) WE.mesh.parent.remove(WE.mesh); scene.add(WE.mesh); }
      WE.mesh.visible=ra>0;
      if(ra>0){ var R=WE.U, fall=8.5*S, wv=(wa*3.2+0.35)*S, sh=weShutter(), lit=1;
        if(typeof RL!=="undefined"&&RL.on&&typeof rlTimeIs==="function"){ lit=rlTimeIs("night")?0.25:rlTimeIs("blue")?0.45:rlTimeIs("golden")?0.85:1; }
        R.t.value=t; R.amt.value=ra; R.cam.value.copy(camera.position); R.gy.value=gy; R.box.value.set(11*S,6*S,11*S);
        R.vel.value.set(wd[0]*wv,-fall,wd[1]*wv); var spd=Math.hypot(fall,wv), th=0.0024*S, L=Math.max(th*4, spd*sh);
        R.len.value=L; R.th.value=th; R.al.value=0.7*Math.max(0.14,Math.min(1,Math.sqrt(0.012*S/L)))*(WE.rain===2?1:0.85); R.S.value=S; R.lit.value=lit;
        WE.mesh.updateVersion(); } }
    var sk=typeof SKY!=="undefined"&&SKY.mesh&&SKY.mesh.material.uniforms.wfog; if(sk) sk.value.set(0.7,0.72,0.74, Math.max(fa*0.9, ra*0.42));
    WE.dirty=false; weSound(); }

  // ---- sound: rain on the ground and a soft wind, made from the same noise the interface sounds use ----
  function weSound(){ var now=performance.now(); if(now-WE.sndT<120) return; WE.sndT=now;
    var want=(typeof App!=="undefined"&&App.is("scene")&&loaded&&soundOn)?1:0, ra=weAmt(WE.rain)*want, wa=weAmt(WE.wind)*want;
    if(!WE.snd){ if(!(ra||wa)) return; var c=typeof sfxCtx==="function"?sfxCtx():null; if(!c||!SFX.nb) return;
      if(navigator.userActivation&&!navigator.userActivation.hasBeenActive) return;
      var mk=function(type,f,q){ var s=c.createBufferSource(); s.buffer=SFX.nb; s.loop=true; var fl=c.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=q; var g=c.createGain(); g.gain.value=0.0001; s.connect(fl); fl.connect(g); g.connect(SFX.out); s.start(0,Math.random()*1.5); return {f:fl,g:g}; };
      WE.snd={c:c, rain:mk("bandpass",2600,0.45), patter:mk("highpass",5200,0.7), wind:mk("lowpass",420,1.6)}; }
    var S2=WE.snd, t=S2.c.currentTime, k=now/1000;
    S2.rain.g.gain.setTargetAtTime(0.0001+ra*0.16,t,0.4); S2.patter.g.gain.setTargetAtTime(0.0001+ra*0.05*(0.8+0.2*Math.sin(k*3.1)),t,0.2);
    var gust=0.55+0.45*Math.sin(k*0.55)*Math.sin(k*0.23+1);
    S2.wind.g.gain.setTargetAtTime(0.0001+wa*0.13*gust,t,0.5); S2.wind.f.frequency.setTargetAtTime(260+340*gust,t,0.6); }

  // ---- the strip of weather squares under the kit ----
  function weKitHTML(){ return '<div class="kit-wx"><span class="kit-wx-l">WEATHER</span>'+WE_ITEMS.map(function(it){ var lv=WE[it[0]];
      return '<button class="wx-sq'+(lv?" on":"")+'" data-we="'+it[0]+'" title="'+it[1]+': '+WE_LV[lv]+' ('+it[2]+')">'+WE_ICON[it[0]]+'<i class="wx-dots"><b class="'+(lv>=1?"y":"")+'"></b><b class="'+(lv>=2?"y":"")+'"></b></i><kbd>'+it[2]+'</kbd></button>'; }).join("")
    +'<span class="kit-wx-s">'+weSummary()+'</span></div>'; }
  function weSummary(){ var o=[]; WE_ITEMS.forEach(function(it){ if(WE[it[0]]) o.push(WE_LV[WE[it[0]]]+" "+it[1].toLowerCase()); }); return o.length?o.join(" · "):"Clear"; }
  function weKitMark(){ var k=document.getElementById("kitMenu"); if(!k) return; var s=k.querySelector(".kit-wx"); if(!s) return;   /* updated in place, so the strip doesn't replay its entrance */
    WE_ITEMS.forEach(function(it){ var b=s.querySelector('[data-we="'+it[0]+'"]'), lv=WE[it[0]]; if(!b) return; b.classList.toggle("on",lv>0); b.title=it[1]+": "+WE_LV[lv]+" ("+it[2]+")";
      var d=b.querySelectorAll(".wx-dots b"); if(d[0]) d[0].className=lv>=1?"y":""; if(d[1]) d[1].className=lv>=2?"y":""; });
    var t=s.querySelector(".kit-wx-s"); if(t) t.textContent=weSummary(); }
  document.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("#kitMenu [data-we]"); if(!b) return; e.preventDefault(); e.stopPropagation(); weCycle(b.getAttribute("data-we")); }, true);
  window.addEventListener("keydown",function(e){ if(typeof KIT==="undefined"||!KIT.open) return; var n={Digit5:"rain",Digit6:"wind",Digit7:"fog"}[e.code]; if(!n) return; e.preventDefault(); e.stopImmediatePropagation(); weCycle(n); }, true);
  if(/[?&]dev/.test(location.search)) window.__we={ set:function(o){ for(var k in o) if(k in WE) WE[k]=o[k]; WE.dirty=true; }, state:weState, sample:function(x,y,z){ var f=weField(); if(!f) return null; var ix=Math.floor((x-f.lo[0])/f.cell), iy=Math.floor((y-f.lo[1])/f.cell), iz=Math.floor((z-f.lo[2])/f.cell); if(ix<0||iy<0||iz<0||ix>=f.nx||iy>=f.ny||iz>=f.nz) return null; var c=((iz*f.ny+iy)*f.nx+ix)*4; return [f.out[c]/255, f.out[c+1]/255]; }, splats:function(){ var f=weField(), P=viewer.P, n=P.length/3, st=Math.max(1,Math.floor(n/4000)), r=[]; for(var i=0;i<n;i+=st){ var v=this.sample(P[i*3],P[i*3+1],P[i*3+2]); if(v) r.push([+P[i*3].toFixed(2),+P[i*3+1].toFixed(2),+P[i*3+2].toFixed(2),+v[0].toFixed(2),+v[1].toFixed(2)]); } return r; }, map:function(on){ if(WE.scanU){ WE.scanU.dbg.value=on?1:0; WE.dirty=true; } }, field:function(){ var f=weField(); return f?{o:f.o.toArray(), inv:f.inv.toArray(), size:[f.tex.image.width,f.tex.image.height,f.tex.image.depth]}:null; } };
