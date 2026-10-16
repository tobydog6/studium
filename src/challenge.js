  // ================= CHALLENGES: gold viewfinder frames hanging in the scene, Skate-style =================
  // Each challenge is a shot: an eye point, a direction and a lens. A gold frame floats in the air a metre in front
  // of that eye point, sized to exactly what that lens sees. From across the clearing it shows you where to go; as
  // you walk up behind it, it shows which way to look and how high to hold the camera. Stand at the eye point
  // (crouch or stand tall to match), look through it, and with the right lens the frame sits right on the edges of
  // your viewfinder. A card ticks off the rest (lens, aperture, exposure); shoot with everything ticked to complete it.
  var CH={spec:null, list:[], fx:null, pads:[], active:-1, done:{}, t:0, lastEval:0, cardFor:-1, pull:-1, locked:false, cool:-1, nudge:false};
  var CH_D=0.45, CH_NEAR=3.5, CH_GRAB=0.8, CH_LEAVE=1.4;
  var CH_RING_FS="uniform float alpha; uniform vec2 size; varying vec2 vUv; void main(){ vec2 p=vUv*size; float e=min(min(p.x,size.x-p.x),min(p.y,size.y-p.y)); float fw=fwidth(e); float bw=max(size.x*0.006,fw*1.2); float a=(1.0-smoothstep(bw-fw,bw+fw,e))*alpha; gl_FragColor=vec4(0.97,0.76,0.40,a); }";
  var CH_FRAME_FS="uniform float t; uniform float done; uniform float lock; uniform float fade; uniform vec2 size; varying vec2 vUv;"
    +"void main(){ vec2 p=vUv*size; float e=min(min(p.x,size.x-p.x),min(p.y,size.y-p.y)); float fw=fwidth(e); float bw=max(size.x*0.0045,fw*1.3);"
    +" vec2 q=min(p,size-p); float corner=step(q.x,size.x*0.11)*step(q.y,size.x*0.11)*step(min(q.x,q.y),bw*2.2);"
    +" float edge=max(1.0-smoothstep(bw-fw,bw+fw,e),corner); float pulse=0.75+0.25*sin(t*3.0);"
    +" vec3 g=mix(vec3(0.95,0.72,0.36),vec3(0.86,0.84,0.80),done); float a=edge*(done>0.5?0.35:pulse)*fade*(1.0-0.35*lock);"
    +" gl_FragColor=vec4(g,a); }";
  var CH_VS="varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
  function chDoneSet(){ var d={}; photos.forEach(function(p){ if(p.challenge) d[p.challenge]=1; }); return d; }
  function chEquivMM(){ var b=curBody(); return Math.round(focalMM*36/(b.sensorW||36)); }
  function chFStop(){ return APERTURES[apIdx]; }
  function chAttach(){ CH.fx=new THREE.Scene(); CH.pads=[]; CH.active=-1; CH.cardFor=-1; CH.pull=-1; CH.locked=false; CH.cool=-1; chCard(null);
    var spec=(CH.spec&&CH.spec.challenges)||[]; CH.list=spec; if(!spec.length||!WK.col) return;
    CH.done=chDoneSet();
    var S=CH.spec.subject||[0,0];
    spec.forEach(function(c){ var tx=S[0]+(c.look[0]||0), tz=S[1]+(c.look[2]||0), x=S[0]+Math.sin(c.az*Math.PI/180)*c.dist, z=S[1]+Math.cos(c.az*Math.PI/180)*c.dist, dx=x-tx, dz=z-tz, L=Math.hypot(dx,dz)||1;
      for(var k=0;k<20&&wkBlocked(x,z,wkGround(x,z));k++){ x+=dx/L*0.2; z+=dz/L*0.2; }   // keep the eye point on clear ground
      var E=new THREE.Vector3(x, wkGround(x,z)+c.h, z), T=new THREE.Vector3(tx, wkGround(tx,tz)+c.look[1], tz), d=T.clone().sub(E).normalize();
      var w=2*CH_D*Math.tan(Math.atan(18/c.mm))*0.97, h=w/1.5, F=E.clone().addScaledVector(d,CH_D), size=new THREE.Vector2(w,h);
      var m=new THREE.ShaderMaterial({uniforms:{t:{value:0},done:{value:CH.done[c.id]?1:0},lock:{value:0},fade:{value:1},size:{value:size}}, vertexShader:CH_VS, fragmentShader:CH_FRAME_FS, transparent:true, depthTest:false, depthWrite:false, side:THREE.DoubleSide});
      var fr=new THREE.Mesh(new THREE.PlaneGeometry(w,h), m); fr.position.copy(F); fr.up.set(0,1,0); fr.lookAt(E); CH.fx.add(fr);
      // the tractor beam: outlines that drift from the frame back out towards you
      var rings=[]; for(var r=0;r<3;r++){ var rm=new THREE.ShaderMaterial({uniforms:{alpha:{value:0},size:{value:size}}, vertexShader:CH_VS, fragmentShader:CH_RING_FS, transparent:true, depthTest:false, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending});
        var ring=new THREE.Mesh(new THREE.PlaneGeometry(w,h), rm); ring.quaternion.copy(fr.quaternion); CH.fx.add(ring); rings.push(ring); }
      CH.pads.push({c:c, x:x, z:z, E:E, T:T, d:d, F:F, w:w, h:h, frame:fr, rings:rings, target:T}); });
    // starting inside a frame's range doesn't count as walking into it
    CH.pads.forEach(function(P,i){ if(CH.cool<0&&Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z)<CH_LEAVE) CH.cool=i; });
    chMarkers(); }
  function chAlign(P){ var dp=P.E.clone().sub(camPos), hz=Math.hypot(dp.x,dp.z), dy=dp.y, ang=Math.acos(Math.max(-1,Math.min(1,P.d.dot(_fwd))))*180/Math.PI;
    return {hz:hz, dy:dy, ang:ang, ok:hz<0.3&&Math.abs(dy)<0.2&&ang<6}; }
  function chRender(dt){ if(!CH.fx||!CH.pads.length||CH.capturing||viewfinderOn) return;   // camera up: nothing in the way of the picture CH.t+=dt||0.016;
    CH.pads.forEach(function(P){ var u=P.frame.material.uniforms, a=chAlign(P), dist=P.F.distanceTo(camPos);
      u.t.value=CH.t; u.lock.value+=((a.ok?1:0)-u.lock.value)*0.2; u.fade.value=Math.max(0.35,Math.min(1,1.4-dist/25));
      var prox=CH.done[P.c.id]||(CH.pull>=0&&CH.pads[CH.pull]===P)?0:Math.max(0,Math.min(1,(5-dist)/2.5));   // only near it, and gone once it has you
      P.rings.forEach(function(R,k){ var ph=(CH.t*0.35+k/3)%1, s=1+ph*0.25; R.position.copy(P.F).addScaledVector(P.d,-ph*0.45); R.scale.set(s,s,1);
        R.material.uniforms.alpha.value=Math.sin(ph*Math.PI)*0.16*prox; }); });
    var ac=renderer.autoClear; renderer.autoClear=false; renderer.render(CH.fx, camera); renderer.autoClear=ac; }
  // ---- each frame: are we near one? ----
  // when you're close and facing it, the frame draws you in and fits you to it; any walking key lets go
  // The pull: only once you're right at a frame (and facing it) does it draw you in. Touch anything (walk, crouch,
  // look round) and it lets go straight away, and it won't take you again until you've left and come back.
  var CH_MOVE={KeyW:1,KeyA:1,KeyS:1,KeyD:1,KeyQ:1,KeyE:1,ArrowUp:1,ArrowDown:1,ArrowLeft:1,ArrowRight:1,Space:1};
  document.addEventListener("keydown",function(e){ if(CH_MOVE[e.code]) CH.nudge=true; });
  document.addEventListener("mousemove",function(e){ if(looking&&Math.abs(e.movementX)+Math.abs(e.movementY)>3) CH.nudge=true; });
  function chLetGo(){ if(CH.pull>=0) CH.cool=CH.pull; CH.pull=-1; CH.locked=false; }
  function chTractor(dt){ var nudge=CH.nudge||CH_MOVE&&Object.keys(CH_MOVE).some(function(k){ return keys[k]; }); CH.nudge=false;
    if(CH.cool>=0){ var C=CH.pads[CH.cool]; if(!C||Math.hypot(camPos.x-C.E.x,camPos.z-C.E.z)>CH_LEAVE) CH.cool=-1; }
    if(CH.pull>=0&&(nudge||Math.hypot(camPos.x-CH.pads[CH.pull].E.x,camPos.z-CH.pads[CH.pull].E.z)>CH_LEAVE)){ chLetGo(); return; }
    if(CH.pull<0){ if(nudge) return;
      CH.pads.forEach(function(P,i){ if(CH.pull>=0||i===CH.cool||CH.done[P.c.id]) return; var hz=Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z);
        var toF=P.F.clone().sub(camPos); toF.y=0; toF.normalize(); var f=_fwd.clone(); f.y=0; f.normalize();
        if(hz<CH_GRAB&&f.dot(toF)>0.2){ CH.pull=i; CH.locked=false; } }); }
    if(CH.pull<0||CH.locked) return; var P=CH.pads[CH.pull];
    var k=1-Math.exp(-5*Math.min(dt,0.05)); _vel.set(0,0,0);
    camPos.x+=(P.E.x-camPos.x)*k; camPos.z+=(P.E.z-camPos.z)*k;
    if(WK.col&&WK.mode==="walk") WK.eye+=((P.E.y-wkGround(P.E.x,P.E.z))-WK.eye)*k; else camPos.y+=(P.E.y-camPos.y)*k;
    var ty=Math.atan2(-P.d.x,-P.d.z), tp=Math.asin(Math.max(-1,Math.min(1,P.d.y))), dy=ty-yaw; while(dy>Math.PI) dy-=2*Math.PI; while(dy<-Math.PI) dy+=2*Math.PI;
    yaw+=dy*k; pitch+=(tp-pitch)*k;
    if(Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z)<0.02&&Math.abs(dy)<0.005&&Math.abs(tp-pitch)<0.005){ camPos.x=P.E.x; camPos.z=P.E.z; yaw+=dy; pitch=tp; CH.locked=true; } }
  function chTick(dt){ if(!CH.pads.length||!loaded) return; var near=-1, best=1e9; chTractor(dt||1/30);
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
    var W=window.innerWidth, H=window.innerHeight, nearest=-1, nd=1e9;
    CH.pads.forEach(function(P,i){ var d=Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z); if(!CH.done[P.c.id]&&d<nd){ nd=d; nearest=i; } });
    CH.pads.forEach(function(P,i){ var el=host.children[i], done=CH.done[P.c.id], d=Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z);
      if(CH.active>=0||(done&&d>6)){ el.style.display="none"; return; } el.style.display=""; el.classList.toggle("lbl", i===nearest);
      _chV.set(P.F.x, P.F.y+P.h/2+0.3, P.F.z).project(camera); var behind=_chV.z>1, x=(_chV.x*0.5+0.5)*W, y=(-_chV.y*0.5+0.5)*H, off=behind||x<40||x>W-40||y<60||y>H-90;
      if(behind){ x=W-x; y=H-y; } if(off){ x=Math.max(90,Math.min(W-90,x)); y=Math.max(120,Math.min(H-120,behind?H-120:y)); }
      el.style.transform="translate("+x.toFixed(0)+"px,"+y.toFixed(0)+"px)"; el.classList.toggle("off", off); el.classList.toggle("done", !!done);
      el.querySelector("b").textContent=(done?"✓ ":"")+P.c.title.toUpperCase()+" · "+Math.round(d)+" M"; }); }
  if(/[?&]dev/.test(location.search)){ window.__ch={ pads:function(){ return CH.pads.map(function(P){ return {id:P.c.id, x:P.E.x, z:P.E.z, y:P.E.y, w:P.w, done:!!CH.done[P.c.id]}; }); }, active:function(){ return CH.active; },
      checks:function(){ return CH.active>=0?chChecks(CH.pads[CH.active]):null; } };
    window.__ch.set=function(o){ if(o.mm!=null){ focalMM=o.mm; zoomMM=o.mm; } if(o.f!=null){ var j=APERTURES.indexOf(o.f); if(j>=0) apIdx=j; } if(o.eye!=null) WK.eye=o.eye; computeCam();
      if(o.meter){ var best=shIdx, bv=1e9; for(var s=0;s<SHUTTER_LABELS.length;s++){ shIdx=s; computeCam(); if(Math.abs(evStops)<bv){ bv=Math.abs(evStops); best=s; } } shIdx=best; computeCam(); } };
    window.__ch.aim=function(i){ var d=CH.pads[i].d; yaw=Math.atan2(-d.x,-d.z); pitch=Math.asin(Math.max(-1,Math.min(1,d.y))); basis(); };
    window.__ch.goto=function(i){ var P=CH.pads[i]; camPos.x=P.E.x; camPos.z=P.E.z; WK.eye=P.E.y-wkGround(P.E.x,P.E.z); _vel.set(0,0,0); };
    window.__ch.approach=function(i){ var P=CH.pads[i]; camPos.x=P.E.x-P.d.x*0.6; camPos.z=P.E.z-P.d.z*0.6; yaw=Math.atan2(-P.d.x,-P.d.z)+0.3; pitch=0; _vel.set(0,0,0); };
    window.__ch.pull=function(){ return {i:CH.pull, locked:CH.locked, cool:CH.cool}; }; window.__ch.nudge=function(){ CH.nudge=true; }; }
