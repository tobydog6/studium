  // ================= WEATHER: rain, wind, fog and wet ground, live on the graphics card =================
  // Rain is its own little splat cloud (Spark sorts it in with the scan, so drops pass in front of and behind things
  // properly). Each drop is a thin splat stretched along the way it falls, and the stretch is how far a drop falls while
  // the shutter is open: 1/1000 freezes beads in the air, 1/30 drags them into streaks. That's the lesson.
  // Wind, fog and wet ground are one Spark object modifier on the scan: leafy, small green splats sway; flat upward
  // surfaces darken and catch a sheen; everything fades to grey with distance in fog; rain or fog greys the light.
  var WE={rain:0, wind:0, fog:0, mesh:null, U:null, scanU:null, scanMeshes:[], t0:performance.now(), lastCam:null, dirty:true, snd:null, sndT:0};
  var WE_LV=["Off","Light","Heavy"], WE_DROPS=26000, WE_SPLASH=3200;
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
          "  a=(h<"+i.amt+")?"+i.al+"*edge*top:0.0;",
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

  // ---- wind, wet and fog on the scan ----
  function weScanMod(){ var D=SPARK.dyno, U=WE.scanU;
    if(!U){ U=WE.scanU={}; U.on=D.dynoFloat(0); U.t=D.dynoFloat(0); U.wind=D.dynoVec3(new THREE.Vector3()); U.wet=D.dynoFloat(0); U.fog=D.dynoFloat(0); U.ovc=D.dynoFloat(0);
      U.cam=D.dynoVec3(new THREE.Vector3()); U.q=D.dynoVec4(new THREE.Vector4(0,0,0,1)); U.s=D.dynoFloat(1); U.gy=D.dynoFloat(0); U.S=D.dynoFloat(1); U.fc=D.dynoVec3(new THREE.Vector3(0.7,0.72,0.74)); }
    var types={gsplat:D.Gsplat, on:"float", t:"float", wind:"vec3", wet:"float", fog:"float", ovc:"float", cam:"vec3", q:"vec4", s:"float", gy:"float", S:"float", fc:"vec3"};
    return D.dynoBlock({gsplat:D.Gsplat},{gsplat:D.Gsplat},function(io){ var ins={gsplat:io.gsplat}; for(var k in U) ins[k]=U[k];
      var dd=D.dyno({inTypes:types, outTypes:{gsplat:D.Gsplat}, inputs:ins, globals:function(){ return [WE_GLSL]; },
        statements:function(c){ var i=c.inputs, o=c.outputs.gsplat; return [
          o+" = "+i.gsplat+";",
          "if("+i.on+">0.5 && isGsplatActive("+o+".flags)){",
          "  vec3 cw=weRot("+i.q+", "+o+".center*"+i.s+"); vec3 col="+o+".rgba.rgb; vec3 sc=abs("+o+".scales)*"+i.s+";",
          "  float mx=max(sc.x,max(sc.y,sc.z)), mn=min(sc.x,min(sc.y,sc.z)), md=sc.x+sc.y+sc.z-mn-mx;",
          /* wind: green, small splats (leaves and grass) sway; bark, stone and soil stay put */
          "  float wl=length("+i.wind+");",
          "  if(wl>0.0){ float gr=clamp((col.g-max(col.r,col.b))*6.0+0.15*step(col.b,col.g)*step(col.r,col.g*1.15),0.0,1.0);",
          "    float sm=1.0-smoothstep(0.015*"+i.S+",0.09*"+i.S+",mx); float up=clamp((cw.y-"+i.gy+")/"+i.S+",0.0,3.0);",
          "    float w=gr*sm*clamp(0.3+up*0.55,0.3,1.6);",
          "    if(w>0.001){ float ph=dot(cw.xz,vec2(0.9,1.3))/"+i.S+"; float gust=0.55+0.45*sin("+i.t+"*0.55+cw.x*0.17/"+i.S+")*sin("+i.t+"*0.23+1.0);",
          "      float sw=sin("+i.t+"*2.4+ph*3.1)*0.65+sin("+i.t+"*4.1+ph*5.3)*0.35;",
          "      vec3 dw="+i.wind+"*(0.35+0.65*sw)*gust*w*0.022*"+i.S+"; dw.y=-abs(dw.x+dw.z)*0.15;",
          "      "+o+".center+=weRotInv("+i.q+",dw)/"+i.s+"; } }",
          /* wet: flat surfaces facing up go dark and rich, and catch the sky at a low angle */
          "  if("+i.wet+">0.0){ int k=(sc.x<=sc.y&&sc.x<=sc.z)?0:((sc.y<=sc.z)?1:2); vec3 ax=k==0?vec3(1.0,0.0,0.0):(k==1?vec3(0.0,1.0,0.0):vec3(0.0,0.0,1.0));",
          "    vec3 n=normalize(weRot("+i.q+",weRot("+o+".quaternion,ax))); float fl=clamp(1.0-mn/max(md,1e-6)*1.4,0.0,1.0);",
          "    float upf=smoothstep(0.45,0.9,abs(n.y))*fl; float wk="+i.wet+"*(0.35+0.65*upf);",
          "    float lum=dot(col,vec3(0.299,0.587,0.114)); vec3 rich=pow(max(col,vec3(0.0)),vec3(1.45))*0.92; rich=mix(vec3(dot(rich,vec3(0.299,0.587,0.114))),rich,1.18);",
          "    col=mix(col,rich,wk*0.9);",
          "    vec3 V=normalize("+i.cam+"-cw); float fr=pow(1.0-abs(dot(n,V)),4.0); col+=vec3(0.62,0.66,0.7)*fr*upf*"+i.wet+"*0.32*(0.4+lum); }",
          "  col*=mix(vec3(1.0),vec3(0.84,0.87,0.92),"+i.ovc+");",
          "  if("+i.fog+">0.0){ float d=length(cw-"+i.cam+")/"+i.S+"; float ff=1.0-exp(-d*"+i.fog+"); col=mix(col,"+i.fc+",ff*0.94); }",
          "  "+o+".rgba.rgb=clamp(col,0.0,1.0);",
          "}"]; } });
      return {gsplat:dd.outputs.gsplat}; }); }
  function weHook(m){ if(!m||WE.scanMeshes.indexOf(m)>=0) return; try{ m.objectModifier=weScanMod(); m.updateGenerator(); WE.scanMeshes.push(m); }catch(e){ console.warn("weather hook",e); } }

  // ---- every frame, before the scene draws ----
  function weTick(dt){ if(!viewer||!loaded||!scene||typeof SPARK==="undefined") return;
    var S=weS(), gy=weGround(), t=(performance.now()-WE.t0)/1000, any=weAny();
    WE.scanMeshes=WE.scanMeshes.filter(function(m){ return m===viewer.mesh||m===viewer.detail; });
    if(any||WE.scanMeshes.length){ weHook(viewer.mesh); if(viewer.detail) weHook(viewer.detail); }
    var U=WE.scanU, wd=weWindDir(), ra=weAmt(WE.rain), wa=weAmt(WE.wind), fa=weAmt(WE.fog);
    if(U){ var wasOn=U.on.value>0.5; U.on.value=any?1:0; U.t.value=t;
      var wstr=wa+ra*0.35; U.wind.value.set(wd[0]*wstr,0,wd[1]*wstr); U.wet.value=Math.min(1,ra*1.1); U.fog.value=fa?0.035+fa*0.11:0; U.ovc.value=Math.min(1,ra*0.85+fa*0.6);
      U.cam.value.copy(camera.position); U.gy.value=gy; U.S.value=S;
      var m0=viewer.mesh; U.q.value.set(m0.quaternion.x,m0.quaternion.y,m0.quaternion.z,m0.quaternion.w); U.s.value=m0.scale.x||1;
      var moved=!WE.lastCam||WE.lastCam.distanceToSquared(camera.position)>1e-6*S*S;
      if(any&&(wstr>0||moved||WE.dirty)||(wasOn&&!any)){ WE.scanMeshes.forEach(function(m){ m.updateVersion(); }); }
      WE.lastCam=(WE.lastCam||new THREE.Vector3()).copy(camera.position); }
    /* the rain */
    if(ra>0&&!WE.mesh){ try{ weRainBuild(); }catch(e){ console.warn("rain",e); WE.rain=0; ra=0; } }
    if(WE.mesh){ if(WE.mesh.parent!==scene){ if(WE.mesh.parent) WE.mesh.parent.remove(WE.mesh); scene.add(WE.mesh); }
      WE.mesh.visible=ra>0;
      if(ra>0){ var R=WE.U, fall=8.5*S, wv=(wa*3.2+ra*0.8)*S, sh=weShutter(), lit=1;
        if(typeof RL!=="undefined"&&RL.on&&typeof rlTimeIs==="function"){ lit=rlTimeIs("night")?0.25:rlTimeIs("blue")?0.45:rlTimeIs("golden")?0.85:1; }
        R.t.value=t; R.amt.value=ra; R.cam.value.copy(camera.position); R.gy.value=gy; R.box.value.set(14*S,7*S,14*S);
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
  function weKitMark(){ var k=document.getElementById("kitMenu"); if(!k) return; var s=k.querySelector(".kit-wx"); if(s) s.outerHTML=weKitHTML(); }
  document.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("#kitMenu [data-we]"); if(!b) return; e.preventDefault(); e.stopPropagation(); weCycle(b.getAttribute("data-we")); }, true);
  window.addEventListener("keydown",function(e){ if(typeof KIT==="undefined"||!KIT.open) return; var n={Digit5:"rain",Digit6:"wind",Digit7:"fog"}[e.code]; if(!n) return; e.preventDefault(); e.stopImmediatePropagation(); weCycle(n); }, true);
  if(/[?&]dev/.test(location.search)) window.__we={ set:function(o){ for(var k in o) if(k in WE) WE[k]=o[k]; WE.dirty=true; }, state:weState };
