  // ================= CHALLENGES: gold viewfinder frames hanging in the scene, Skate-style =================
  // Each challenge is a shot: an eye point, a direction and a lens. A gold frame floats in the air a metre in front
  // of that eye point, sized to exactly what that lens sees. From across the clearing it shows you where to go; as
  // you walk up behind it, it shows which way to look and how high to hold the camera. Stand at the eye point
  // (crouch or stand tall to match), look through it, and with the right lens the frame sits right on the edges of
  // your viewfinder. A card ticks off the rest (lens, aperture, exposure); shoot with everything ticked to complete it.
  var CH={spec:null, list:[], fx:null, pads:[], active:-1, done:{}, t:0, lastEval:0, cardFor:-1};
  var CH_D=1.0, CH_NEAR=3.5;
  var CH_FRAME_FS="uniform float t; uniform float done; uniform float lock; uniform float fade; uniform vec2 size; varying vec2 vUv;"
    +"void main(){ vec2 p=vUv*size; float e=min(min(p.x,size.x-p.x),min(p.y,size.y-p.y)); float bw=size.x*(0.010+0.006*lock);"
    +" vec2 q=min(p,size-p); float corner=step(q.x,size.x*0.16)*step(q.y,size.x*0.16)*step(min(q.x,q.y),bw*2.6);"
    +" float edge=max(smoothstep(bw,bw*0.6,e),corner); float pulse=0.75+0.25*sin(t*3.0);"
    +" vec3 g=mix(vec3(0.95,0.72,0.36),vec3(0.86,0.84,0.80),done); float a=edge*(done>0.5?0.35:pulse)*fade + (1.0-edge)*0.035*lock*fade;"
    +" gl_FragColor=vec4(g*(1.0+0.4*lock),a); }";
  var CH_VS="varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
  function chDoneSet(){ var d={}; photos.forEach(function(p){ if(p.challenge) d[p.challenge]=1; }); return d; }
  function chEquivMM(){ var b=curBody(); return Math.round(focalMM*36/(b.sensorW||36)); }
  function chFStop(){ return APERTURES[apIdx]; }
  function chAttach(){ CH.fx=new THREE.Scene(); CH.pads=[]; CH.active=-1; CH.cardFor=-1; chCard(null);
    var spec=(CH.spec&&CH.spec.challenges)||[]; CH.list=spec; if(!spec.length||!WK.col) return;
    CH.done=chDoneSet();
    spec.forEach(function(c){ var x=c.eye[0], z=c.eye[2], tx=c.look[0], tz=c.look[2], dx=x-tx, dz=z-tz, L=Math.hypot(dx,dz)||1;
      for(var k=0;k<20&&wkBlocked(x,z,wkGround(x,z));k++){ x+=dx/L*0.2; z+=dz/L*0.2; }   // keep the eye point on clear ground
      var E=new THREE.Vector3(x, wkGround(x,z)+c.eye[1], z), T=new THREE.Vector3(tx, wkGround(tx,tz)+c.look[1], tz), d=T.clone().sub(E).normalize();
      var w=2*CH_D*Math.tan(Math.atan(18/c.mm))*0.97, h=w/1.5, F=E.clone().addScaledVector(d,CH_D), size=new THREE.Vector2(w,h);
      var m=new THREE.ShaderMaterial({uniforms:{t:{value:0},done:{value:CH.done[c.id]?1:0},lock:{value:0},fade:{value:1},size:{value:size}}, vertexShader:CH_VS, fragmentShader:CH_FRAME_FS, transparent:true, depthTest:false, depthWrite:false, side:THREE.DoubleSide});
      var fr=new THREE.Mesh(new THREE.PlaneGeometry(w,h), m); fr.position.copy(F); fr.up.set(0,1,0); fr.lookAt(E); CH.fx.add(fr);
      CH.pads.push({c:c, x:x, z:z, E:E, T:T, d:d, F:F, w:w, h:h, frame:fr, target:T}); });
    chMarkers(); }
  function chAlign(P){ var dp=P.E.clone().sub(camPos), hz=Math.hypot(dp.x,dp.z), dy=dp.y, ang=Math.acos(Math.max(-1,Math.min(1,P.d.dot(_fwd))))*180/Math.PI;
    return {hz:hz, dy:dy, ang:ang, ok:hz<0.3&&Math.abs(dy)<0.2&&ang<6}; }
  function chRender(dt){ if(!CH.fx||!CH.pads.length||CH.capturing) return; CH.t+=dt||0.016;
    CH.pads.forEach(function(P){ var u=P.frame.material.uniforms, a=chAlign(P), dist=P.F.distanceTo(camPos);
      u.t.value=CH.t; u.lock.value+=((a.ok?1:0)-u.lock.value)*0.2; u.fade.value=Math.max(0.35,Math.min(1,1.4-dist/25)); });
    var ac=renderer.autoClear; renderer.autoClear=false; renderer.render(CH.fx, camera); renderer.autoClear=ac; }
  // ---- each frame: are we near one? ----
  function chTick(){ if(!CH.pads.length||!loaded) return; var near=-1, best=1e9;
    CH.pads.forEach(function(P,i){ var d=Math.hypot(camPos.x-P.E.x, camPos.z-P.E.z); if(d<CH_NEAR&&d<best){ best=d; near=i; } });
    if(near!==CH.active){ CH.active=near; if(near>=0){ chFlash(CH.pads[near]); chCard(CH.pads[near]); } else chCard(null); }
    var now=performance.now(); if(CH.active>=0&&now-CH.lastEval>160){ CH.lastEval=now; chCard(CH.pads[CH.active], true); }
    chMarkers(); }
  function chChecks(P){ var c=P.c, out=[], mm=chEquivMM(), f=chFStop(), a=chAlign(P), now;
    if(a.hz>=0.3) now=a.hz.toFixed(1)+" M TO GO"; else if(Math.abs(a.dy)>=0.2) now=a.dy<0?"CROUCH (Q)":"STAND TALLER (E)"; else now=Math.round(a.ang)+"° OFF";
    out.push({label:"Step into the gold frame and look through it", ok:a.ok, now:a.ok?"LINED UP":now});
    (c.need||[]).forEach(function(n){ var ok=false, nw="";
      if(n.k==="mm"){ ok=(n.max==null||mm<=n.max)&&(n.min==null||mm>=n.min); nw=mm+" MM"; }
      else if(n.k==="f"){ ok=(n.max==null||f<=n.max)&&(n.min==null||f>=n.min); nw="f/"+f; }
      else if(n.k==="ev"){ ok=Math.abs(evStops)<=n.tol; nw=(evStops>=0?"+":"")+evStops.toFixed(1)+" EV"; }
      out.push({label:n.label, ok:ok, now:nw}); });
    return out; }
  // ---- the card, the title flash, the done stamp ----
  function chCard(P, update){ var el=$("chCard"); if(!el) return;
    if(!P){ el.classList.remove("show"); CH.cardFor=-1; return; }
    var i=CH.pads.indexOf(P), checks=chChecks(P), all=checks.every(function(x){ return x.ok; }), done=CH.done[P.c.id];
    if(!update||CH.cardFor!==i){ CH.cardFor=i;
      el.innerHTML='<span class="k">CHALLENGE '+(i+1)+' OF '+CH.pads.length+(done?' · DONE ✓':'')+'</span><b class="t">'+cbEsc(P.c.title)+'</b><p>'+cbEsc(P.c.brief)+'</p><div class="ck"></div><span class="go"></span>'; el.classList.add("show"); }
    el.querySelector(".ck").innerHTML=checks.map(function(x){ return '<div class="'+(x.ok?'ok':'')+'"><i>'+(x.ok?'✓':'')+'</i><span>'+cbEsc(x.label)+'</span><em>'+x.now+'</em></div>'; }).join("");
    var go=el.querySelector(".go"); go.textContent=all?(viewfinderOn?"EVERYTHING’S SET. TAKE THE SHOT ↵":"EVERYTHING’S SET. RAISE THE CAMERA (P) AND SHOOT"):"TICK THEM ALL, THEN SHOOT"; go.classList.toggle("on", all); el.classList.toggle("ready", all); }
  function chFlash(P){ var f=$("chFlash"); if(!f) return; f.innerHTML='<span>CHALLENGE</span><b>'+cbEsc(P.c.title)+'</b>'; f.classList.remove("show"); void f.offsetWidth; f.classList.add("show"); }
  function chOnShot(p){ if(CH.active<0) return; var P=CH.pads[CH.active], checks=chChecks(P), miss=checks.filter(function(x){ return !x.ok; });
    if(miss.length){ toast("Close. Still to do: "+miss.map(function(x){ return x.label.toLowerCase(); }).join(", ")); return; }
    p.challenge=P.c.id; var first=!CH.done[P.c.id]; CH.done[P.c.id]=1; P.frame.material.uniforms.done.value=1; saveSession();
    var n=Object.keys(CH.done).filter(function(k){ return CH.list.some(function(c){ return c.id===k; }); }).length, s=$("chDone");
    s.innerHTML='<span class="k">'+(first?'CHALLENGE COMPLETE':'DONE AGAIN')+'</span><b>'+cbEsc(P.c.title)+'</b><img src="'+p.url+'" alt=""><span class="n">'+n+' OF '+CH.pads.length+' AT '+cbEsc((cbPlace||"").toUpperCase())+'</span>';
    s.classList.remove("show"); void s.offsetWidth; s.classList.add("show"); chCard(P); }
  // ---- on-screen markers that point to the frames ----
  var _chV=new THREE.Vector3();
  function chMarkers(){ var host=$("chMarks"); if(!host) return; var show=loaded&&App.is("scene")&&CH.pads.length;
    host.classList.toggle("show", !!show); if(!show) return;
    if(host.children.length!==CH.pads.length) host.innerHTML=CH.pads.map(function(){ return '<span class="chm"><i></i><b></b></span>'; }).join("");
    var W=window.innerWidth, H=window.innerHeight;
    CH.pads.forEach(function(P,i){ var el=host.children[i], done=CH.done[P.c.id], d=Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z);
      if(CH.active===i||(done&&d>6)){ el.style.display="none"; return; } el.style.display="";
      _chV.set(P.F.x, P.F.y+P.h/2+0.3, P.F.z).project(camera); var behind=_chV.z>1, x=(_chV.x*0.5+0.5)*W, y=(-_chV.y*0.5+0.5)*H, off=behind||x<40||x>W-40||y<60||y>H-90;
      if(behind){ x=W-x; y=H-y; } if(off){ x=Math.max(90,Math.min(W-90,x)); y=Math.max(120,Math.min(H-120,behind?H-120:y)); }
      el.style.transform="translate("+x.toFixed(0)+"px,"+y.toFixed(0)+"px)"; el.classList.toggle("off", off); el.classList.toggle("done", !!done);
      el.querySelector("b").textContent=(done?"✓ ":"")+P.c.title.toUpperCase()+" · "+Math.round(d)+" M"; }); }
  if(/[?&]dev/.test(location.search)){ window.__ch={ pads:function(){ return CH.pads.map(function(P){ return {id:P.c.id, x:P.E.x, z:P.E.z, y:P.E.y, w:P.w, done:!!CH.done[P.c.id]}; }); }, active:function(){ return CH.active; },
      checks:function(){ return CH.active>=0?chChecks(CH.pads[CH.active]):null; } };
    window.__ch.set=function(o){ if(o.mm!=null){ focalMM=o.mm; zoomMM=o.mm; } if(o.f!=null){ var j=APERTURES.indexOf(o.f); if(j>=0) apIdx=j; } if(o.eye!=null) WK.eye=o.eye; computeCam();
      if(o.meter){ var best=shIdx, bv=1e9; for(var s=0;s<SHUTTER_LABELS.length;s++){ shIdx=s; computeCam(); if(Math.abs(evStops)<bv){ bv=Math.abs(evStops); best=s; } } shIdx=best; computeCam(); } };
    window.__ch.aim=function(i){ var d=CH.pads[i].d; yaw=Math.atan2(-d.x,-d.z); pitch=Math.asin(Math.max(-1,Math.min(1,d.y))); basis(); };
    window.__ch.goto=function(i){ var P=CH.pads[i]; camPos.x=P.E.x; camPos.z=P.E.z; WK.eye=P.E.y-wkGround(P.E.x,P.E.z); _vel.set(0,0,0); }; }
