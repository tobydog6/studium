  // ================= CHALLENGES: gold viewfinder frames hanging in the scene, Skate-style =================
  // Each challenge is a shot: an eye point, a direction and a lens. A gold frame floats in the air a metre in front
  // of that eye point, sized to exactly what that lens sees. From across the clearing it shows you where to go; as
  // you walk up behind it, it shows which way to look and how high to hold the camera. Stand at the eye point
  // (crouch or stand tall to match), look through it, and with the right lens the frame sits right on the edges of
  // your viewfinder. A card ticks off the rest (lens, aperture, exposure); shoot with everything ticked to complete it.
  var CH={focus:-1, doneHold:false, doneT:0, spec:null, list:[], fx:null, pads:[], active:-1, done:{}, t:0, lastEval:0, cardFor:-1, pull:-1, locked:false, cool:-1, nudge:false};
  var CH_D=0.45, CH_NEAR=3.5, CH_LEAVE=1.4;
  var CH_RING_FS="uniform float alpha; uniform vec2 size; varying vec2 vUv; void main(){ vec2 p=vUv*size; float e=min(min(p.x,size.x-p.x),min(p.y,size.y-p.y)); float fw=fwidth(e); float bw=max(size.x*0.006,fw*1.2); float a=(1.0-smoothstep(bw-fw,bw+fw,e))*alpha; gl_FragColor=vec4(0.97,0.76,0.40,a); }";
  // the frame: thin gold lines with corner brackets, and a soft halo that hugs them (inside and out) while it draws you in
  var CH_FRAME_FS="uniform float t; uniform float done; uniform float lock; uniform float fade; uniform float glow; uniform float pad; uniform vec2 size; varying vec2 vUv;"
    +"void main(){ vec2 p=vUv*(size+2.0*pad)-pad; vec2 dd=abs(p-size*0.5)-size*0.5; float sd=length(max(dd,0.0))+min(max(dd.x,dd.y),0.0);"
    +" float e=abs(sd); float fw=fwidth(e); float bw=max(size.x*0.0045,fw*1.3);"
    +" vec2 q=min(p,size-p); float corner=step(q.x,size.x*0.11)*step(q.y,size.x*0.11)*step(-sd,bw*2.2)*step(sd,bw*0.5);"
    +" float edge=max(1.0-smoothstep(bw-fw,bw+fw,e),corner); float pulse=0.75+0.25*sin(t*3.0);"
    +" float halo=glow*(0.26*exp(-e/(size.x*0.05))+0.16*exp(-e/(size.x*0.012)));"
    +" vec3 g=mix(vec3(0.95,0.72,0.36),vec3(0.86,0.84,0.80),done); vec3 hc=mix(vec3(0.98,0.70,0.32),vec3(1.0,0.92,0.75),clamp(glow*0.6,0.0,1.0)*exp(-e/(size.x*0.01)));"
    +" float ae=edge*(done>0.5?0.35:mix(pulse,1.0,clamp(glow,0.0,1.0)))*(1.0-0.35*lock*(1.0-clamp(glow,0.0,1.0)));"
    +" float a=clamp(ae+halo*(1.0-edge),0.0,1.0)*fade; gl_FragColor=vec4(mix(hc,g,edge),a); }";
  var CH_VS="varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
  function chDoneSet(){ var d={}; photos.forEach(function(p){ if(p.challenge) d[p.challenge]=1; }); return d; }
  function chEquivMM(){ var b=curBody(); return Math.round(focalMM*36/(b.sensorW||36)); }
  function chFStop(){ return APERTURES[apIdx]; }
  function chAttach(){ CH.fx=new THREE.Scene(); CH.pads=[]; CH.active=-1; CH.cardFor=-1; CH.pull=-1; CH.locked=false; CH.cool=-1; chCard(null);
    var spec=(CH.spec&&CH.spec.challenges)||[]; if(typeof gdIsDemo==="function"&&gdIsDemo()) spec=gdDemoChallenges(spec);   // the demo has three, one per camera
    CH.list=spec; if(!spec.length||!WK.col){ chMarkers(); chFramesBtn(); return; }   // a scan with no frames clears the last one's markers
    CH.done=chDoneSet();
    var S=CH.spec.subject||[0,0];
    spec.forEach(function(c){ var tx=S[0]+(c.look[0]||0), tz=S[1]+(c.look[2]||0), x=S[0]+Math.sin(c.az*Math.PI/180)*c.dist, z=S[1]+Math.cos(c.az*Math.PI/180)*c.dist, dx=x-tx, dz=z-tz, L=Math.hypot(dx,dz)||1;
      for(var k=0;k<20&&wkBlocked(x,z,wkGround(x,z));k++){ x+=dx/L*0.2; z+=dz/L*0.2; }   // keep the eye point on clear ground
      var E=new THREE.Vector3(x, wkGround(x,z)+c.h, z), T=new THREE.Vector3(tx, wkGround(tx,tz)+c.look[1], tz), d=T.clone().sub(E).normalize();
      var D=Math.max(CH_D,Math.min(CH_D*c.mm/35,c.dist*0.6)), lo=2*D*Math.tan(Math.atan(18/c.mm))*0.97, sh=lo/(c.aspect||1.5), w=c.vert?sh:lo, h=c.vert?lo:sh;
      var F=E.clone().addScaledVector(d,D), size=new THREE.Vector2(w,h);
      var pad=Math.max(w,h)*0.16, m=new THREE.ShaderMaterial({uniforms:{t:{value:0},done:{value:CH.done[c.id]?1:0},lock:{value:0},fade:{value:1},glow:{value:0},pad:{value:pad},size:{value:size}}, vertexShader:CH_VS, fragmentShader:CH_FRAME_FS, transparent:true, depthTest:false, depthWrite:false, side:THREE.DoubleSide});
      var fr=new THREE.Mesh(new THREE.PlaneGeometry(w+2*pad,h+2*pad), m), vis=CH.done[c.id]?0:1; fr.position.copy(F); fr.up.set(0,1,0); fr.lookAt(E); CH.fx.add(fr);
      // the tractor beam: outlines that drift from the frame back out towards you
      var rings=[]; for(var r=0;r<3;r++){ var rm=new THREE.ShaderMaterial({uniforms:{alpha:{value:0},size:{value:size}}, vertexShader:CH_VS, fragmentShader:CH_RING_FS, transparent:true, depthTest:false, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending});
        var ring=new THREE.Mesh(new THREE.PlaneGeometry(w,h), rm); ring.quaternion.copy(fr.quaternion); CH.fx.add(ring); rings.push(ring); }
      CH.pads.push({c:c, x:x, z:z, E:E, T:T, d:d, F:F, D:D, w:w, h:h, frame:fr, rings:rings, target:T, vis:vis}); });
    // starting inside a frame's range doesn't count as walking into it
    CH.focus=-1; CH.pads.forEach(function(P,i){ if(CH.cool<0&&Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z)<CH_LEAVE) CH.cool=i; });
    chMarkers(); chFramesBtn(); }
  function chAlign(P){ var dp=P.E.clone().sub(camPos), hz=Math.hypot(dp.x,dp.z), dy=dp.y, ang=Math.acos(Math.max(-1,Math.min(1,P.d.dot(_fwd))))*180/Math.PI;
    return {hz:hz, dy:dy, ang:ang, ok:hz<0.3&&Math.abs(dy)<0.2&&ang<6}; }
  function chOff(){ return CH.hidden||(typeof coHidesFrames==="function"&&coHidesFrames()); }
  // HIDE FRAMES in the top bar: the gold frames and their markers go, until you bring them back (remembered)
  try{ CH.hidden=localStorage.getItem("studium_frames_off")==="1"; }catch(e){}
  function chSetHidden(on){ CH.hidden=!!on; try{ localStorage.setItem("studium_frames_off",on?"1":"0"); }catch(e){} chFramesBtn(); chMarkers(); }
  function chFramesBtn(){ var b=$("navFrames"); if(!b) return; b.classList.toggle("hidden", !(CH.pads&&CH.pads.length)); b.textContent=CH.hidden?"SHOW FRAMES":"HIDE FRAMES"; b.classList.toggle("on", !!CH.hidden); }   // hidden during the first-time warm-up
  function chRender(dt){ chGlowCss(); if(!CH.fx||!CH.pads.length||CH.capturing||viewfinderOn||chOff()) return;   // camera up: nothing in the way of the picture
    CH.t+=dt||0.016; var br=0.5+0.5*Math.sin(CH.t*1.7);   // a slow breath while it has you
    CH.pads.forEach(function(P,i){ var u=P.frame.material.uniforms, a=chAlign(P), dist=P.F.distanceTo(camPos), mine=(CH.pull===i);
      P.vis+=((CH.done[P.c.id]?0:1)-P.vis)*(1-Math.exp(-(dt||0.016)*1.4)); if(P.vis<0.01) P.vis=CH.done[P.c.id]?0:P.vis;   // a finished frame melts away
      u.t.value=CH.t; u.lock.value+=((a.ok?1:0)-u.lock.value)*0.2; u.fade.value=Math.max(0.35,Math.min(1,1.4-dist/25))*(mine?1:1-0.92*CH.glow)*P.vis;   // the others step back while one has you
      u.glow.value=mine?CH.glow*(0.55+0.45*br)+CH.bloom:0;
      if(mine&&!CH.locked){   // being drawn in: soft outlines slide from you towards the frame, slowly
        P.rings.forEach(function(R,k){ var ph=(CH.t*0.3+k/3)%1, s=1.18-0.18*ph; R.position.copy(P.F).addScaledVector(P.d,-(1-ph)*P.D*0.7); R.scale.set(s,s,1);
          R.material.uniforms.alpha.value=Math.sin(ph*Math.PI)*0.13*CH.glow*P.vis; }); return; }
      var prox=CH.done[P.c.id]||mine?0:Math.max(0,Math.min(1,(5-dist)/2.5))*(1-CH.glow);   // only near it, and gone once it has you
      P.rings.forEach(function(R,k){ var ph=(CH.t*0.35+k/3)%1, s=1+ph*CH_SPREAD; R.position.copy(P.F).addScaledVector(P.d,-ph*CH_REACH); R.scale.set(s,s,1);   // the pulse shows the reach
        R.material.uniforms.alpha.value=Math.sin(ph*Math.PI)*0.16*prox; }); });
    var ac=renderer.autoClear; renderer.autoClear=false; renderer.render(CH.fx, camera); renderer.autoClear=ac; }
  // ---- the pull ----
  // Near a frame, gold outlines pulse out of it back towards you. That pulse is the frame's reach: step inside it at
  // all (walking or standing still, facing any way) and the frame draws you in, a slow, eased glide into the eye point,
  // turning and crouching to fit. Once it starts it always finishes, and you're held for a second when you land.
  // After that, any move (walk, crouch, look) lets go, and that frame won't take you again until you've left its pulse.
  var CH_REACH=1.0, CH_SPREAD=0.35;   // the pulse travels a metre out from the frame and widens by a third as it goes
  // is the camera inside frame P's pulse (grown by m metres)?
  function chInPulse(P,m){ var L=Math.hypot(P.d.x,P.d.z)||1, ax=-P.d.x/L, az=-P.d.z/L, dx=camPos.x-P.F.x, dz=camPos.z-P.F.z;
    var n=dx*ax+dz*az, u=Math.abs(dx*-az+dz*ax), k=Math.max(0,Math.min(1,n/CH_REACH));
    return n>-0.25-m&&n<CH_REACH+m&&u<P.w*0.5*(1+CH_SPREAD*k)+0.2+m&&Math.abs(camPos.y-P.F.y)<P.h*0.5+1.3+m; }
  var CH_MOVE={KeyW:1,KeyA:1,KeyS:1,KeyD:1,KeyQ:1,KeyE:1,ArrowUp:1,ArrowDown:1,ArrowLeft:1,ArrowRight:1,Space:1}, CH_GRACE=1000;
  CH.glow=0; CH.bloom=0; CH.pt=0; CH.lockT=0;
  document.addEventListener("keydown",function(e){ if(CH_MOVE[e.code]) CH.nudge=true; });
  document.addEventListener("mousemove",function(e){ if(looking&&Math.abs(e.movementX)+Math.abs(e.movementY)>3) CH.nudge=true; });
  // while this is true, the walk keys and mouse look do nothing (app.js asks)
  /* the frames' introduction: a slow glide once round the subject so you see where they all hang, then it settles
     into the shallow depth of field one and its card says what you're after. Any move key skips straight there */
  function chIntroStart(){ if(!CH.pads.length) return; if(viewfinderOn&&typeof toggleViewfinder==="function") toggleViewfinder();   /* lower the camera so the frames can be seen */
    var S=CH.spec.subject||[0,0], a0=Math.atan2(camPos.x-S[0], camPos.z-S[1]), r=Math.max(3.4, Math.min(5, Math.hypot(camPos.x-S[0], camPos.z-S[1])));
    var walk=!!(WK.col&&WK.mode==="walk"); CH.intro={t:0, dur:7, a0:a0, r:r, S:S, y0:walk?WK.eye:camPos.y, walk:walk, gy:wkGround(S[0],S[1])}; CH.pull=-1; CH.locked=false; }
  function chIntroTick(dt){ var I=CH.intro; I.t+=dt; var held=CH_MOVE&&Object.keys(CH_MOVE).some(function(k){ return keys[k]; });
    var u=Math.min(1,I.t/I.dur), s=u*u*(3-2*u), a=I.a0+s*Math.PI*1.75, x=I.S[0]+Math.sin(a)*I.r, z=I.S[1]+Math.cos(a)*I.r, eye=1.75+0.35*Math.sin(u*Math.PI);
    _vel.set(0,0,0); camPos.x=x; camPos.z=z; if(I.walk) WK.eye=eye; else camPos.y=I.gy+eye;
    var ty=I.gy+0.45, cy=(I.walk?wkGround(x,z):I.gy)+eye; yaw=Math.atan2(x-I.S[0], z-I.S[1]); pitch=Math.atan2(ty-cy, I.r);
    if(u>=1||held){ CH.intro=null; var k=-1; CH.pads.forEach(function(P,i){ if(k<0&&/dof/.test(P.c.id)&&!CH.done[P.c.id]) k=i; }); if(k<0) CH.pads.forEach(function(P,i){ if(k<0&&!CH.done[P.c.id]) k=i; });
      if(k>=0){ CH.cool=-1; chGrab(k); } } }
  function chHold(){ return CH.pull>=0&&(!CH.locked||performance.now()-CH.lockT<CH_GRACE); }
  function chLetGo(){ if(CH.pull>=0) CH.cool=CH.pull; CH.pull=-1; CH.locked=false; }
  function chWrap(a){ while(a>Math.PI) a-=2*Math.PI; while(a<-Math.PI) a+=2*Math.PI; return a; }
  function chGrab(i){ var P=CH.pads[i], walk=!!(WK.col&&WK.mode==="walk");
    var ty=Math.atan2(-P.d.x,-P.d.z), tp=Math.asin(Math.max(-1,Math.min(1,P.d.y))), dyaw=chWrap(ty-yaw), dist=Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z);
    var eye0=walk?WK.eye:camPos.y, eye1=walk?P.E.y-wkGround(P.E.x,P.E.z):P.E.y;
    CH.from={x:camPos.x, z:camPos.z, yaw:yaw, pitch:pitch, eye:eye0, walk:walk}; CH.to={dyaw:dyaw, pitch:tp, eye:eye1};
    CH.dur=Math.max(1.3,Math.min(3.4,1.0+dist*0.9+Math.abs(dyaw)*0.35+Math.abs(eye1-eye0)*0.6));
    CH.pull=i; CH.locked=false; CH.pt=0; _vel.set(0,0,0);
    if(CH.focus!==i){ CH.focus=i; chFlash(P); } chCard(P); }
  function chTractor(dt){ dt=Math.min(dt||1/30,0.1);
    var held=CH_MOVE&&Object.keys(CH_MOVE).some(function(k){ return keys[k]; }), nudge=CH.nudge||held; CH.nudge=false;
    CH.glow+=((CH.pull>=0&&!(CH.locked&&!chHold())?1:0)-CH.glow)*(1-Math.exp(-dt*(CH.pull>=0?2.2:3.5)));
    CH.bloom*=Math.exp(-dt*2.2);
    if(CH.cool>=0){ var C=CH.pads[CH.cool]; if(!C||(!chInPulse(C,0.3)&&Math.hypot(camPos.x-C.E.x,camPos.z-C.E.z)>0.6)) CH.cool=-1; }   // free again once you've stepped out of its pulse
    if(CH.pull>=0){ var Q=CH.pads[CH.pull];
      if(!chHold()&&(nudge||Math.hypot(camPos.x-Q.E.x,camPos.z-Q.E.z)>CH_LEAVE)){ chLetGo(); return; } }
    else { if(CH.cool>=0) return;   // just let go of one: step out of its pulse before another can take you
      // in its pulse, or already standing on its spot; the nearest frame wins
      var best=-1, bd=1e9; CH.pads.forEach(function(P,i){ if(CH.done[P.c.id]||!P.vis||!(chInPulse(P,0)||Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z)<0.3)) return; var dd=Math.hypot(camPos.x-P.F.x,camPos.z-P.F.z); if(dd<bd){ bd=dd; best=i; } });
      if(best>=0) chGrab(best); }
    if(CH.pull<0||CH.locked) return; var P=CH.pads[CH.pull], A=CH.from, B=CH.to;
    CH.pt=Math.min(1,CH.pt+dt/CH.dur); var x=CH.pt, s=x*x*x*(x*(x*6-15)+10);   // smootherstep: eases out of where you were, settles softly
    _vel.set(0,0,0); camPos.x=A.x+(P.E.x-A.x)*s; camPos.z=A.z+(P.E.z-A.z)*s;
    if(A.walk) WK.eye=A.eye+(B.eye-A.eye)*s; else camPos.y=A.eye+(B.eye-A.eye)*s;
    yaw=A.yaw+B.dyaw*s; pitch=A.pitch+(B.pitch-A.pitch)*s;
    if(CH.pt>=1){ CH.locked=true; CH.lockT=performance.now(); CH.bloom=0.5; } }
  // a faint gold breath at the edges of the screen while it has you, and a soft bloom as you land
  function chGlowCss(){ var el=$("chGlow"); if(!el) return; var v=viewfinderOn||!CH.pads.length?0:Math.min(1,CH.glow*(0.35+0.25*(0.5+0.5*Math.sin(CH.t*1.7)))+CH.bloom*0.5);
    if(Math.abs((+el.style.opacity||0)-v)>0.004) el.style.opacity=v.toFixed(3); }
  // The card (and the title) only appear once a frame starts drawing you in. They stay while you work near it,
  // and go when you walk off or finish it.
  function chTick(dt){ if(!CH.pads.length||!loaded) return;
    var off=chOff(); if(off){ CH.wasOff=true; if(CH.active>=0){ CH.active=-1; chCard(null); } chMarkers(); return; }
    if(CH.wasOff){ CH.wasOff=false; CH.pads.forEach(function(P){ P.vis=0; });   // the warm-up's done: the frames fade in
      var f=$("chFlash"); if(f){ f.innerHTML='<span>UNLOCKED</span><b>The gold frames are out</b>'; f.classList.remove("show"); void f.offsetWidth; f.classList.add("show"); }
      chIntroStart(); }
    if(CH.intro){ chIntroTick(dt||1/30); chMarkers(); return; }
    chTractor(dt||1/30);
    var f=CH.pull>=0?CH.pull:CH.focus;
    if(f<0) CH.pads.forEach(function(P,i){ if(f<0&&!CH.done[P.c.id]&&Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z)<0.3) f=i; });   // walked straight in without the pull
    if(f>=0){ var Q=CH.pads[f]; if(CH.pull!==f&&(Math.hypot(camPos.x-Q.E.x,camPos.z-Q.E.z)>CH_NEAR*0.7||(CH.done[Q.c.id]&&!CH.doneHold))) f=-1; }
    CH.focus=f;
    if(f!==CH.active){ CH.active=f; chCard(f>=0?CH.pads[f]:null); }
    var now=performance.now(); if(CH.active>=0&&now-CH.lastEval>160){ CH.lastEval=now; chCard(CH.pads[CH.active], true); }
    chMarkers(); }
  function chChecks(P){ var c=P.c, out=[], mm=chEquivMM(), f=chFStop(), a=chAlign(P), now;
    if(a.hz>=0.3) now=a.hz.toFixed(1)+" M TO GO"; else if(Math.abs(a.dy)>=0.2) now=a.dy<0?"CROUCH (Q)":"STAND TALLER (E)"; else now=Math.round(a.ang)+"° OFF";
    out.push({label:"Step into the gold frame and look through it", ok:a.ok, now:a.ok?"LINED UP":now});
    (c.need||[]).forEach(function(n){ var ok=false, nw="";
      if(n.k==="mm"){ ok=(n.max==null||mm<=n.max)&&(n.min==null||mm>=n.min); nw=mm+" MM"; }
      else if(n.k==="f"){ ok=(n.max==null||f<=n.max)&&(n.min==null||f>=n.min); nw="f/"+f; }
      else if(n.k==="ev"){ ok=n.tol!=null?Math.abs(evStops)<=n.tol:(evStops>=n.min&&evStops<=n.max); nw=(evStops>=0?"+":"")+evStops.toFixed(1)+" EV"; }
      else if(n.k==="body"){ var b=curBody(); ok=b.id===n.id; nw=(b.fmt||b.name).toUpperCase(); }
      else if(n.k==="lens"){ ok=Math.round(focalMM)===n.mm; nw=Math.round(focalMM)+" MM"; }
      else if(n.k==="vert"){ ok=!!vertical; nw=vertical?"VERTICAL":"HORIZONTAL"; }
      else if(n.k==="iso"){ var iso=ISOS[isoIdx]; ok=(n.max==null||iso<=n.max)&&(n.min==null||iso>=n.min); nw="ISO "+iso; }
      else if(n.k==="sh"){ var t=SHUTTERS[shIdx]; ok=(n.max==null||t<=n.max*1.001)&&(n.min==null||t>=n.min*0.999); nw=SHUTTER_LABELS[shIdx]; }
      out.push({label:n.label, ok:ok, now:nw}); });
    return out; }
  // ---- the card, the title flash, the done stamp ----
  function chCard(P, update){ var el=$("chCard"); if(!el) return;
    if(!P){ el.classList.remove("show"); CH.cardFor=-1; return; }
    var i=CH.pads.indexOf(P), checks=chChecks(P), all=checks.every(function(x){ return x.ok; }), done=CH.done[P.c.id];
    if(!update||CH.cardFor!==i){ CH.cardFor=i;
      var ref=/dof/.test(P.c.id)&&typeof CO_AP!=="undefined"&&CO_AP.ok?CO_AP.im[0].src:"";
      el.innerHTML=(ref?'<div class="ref"><img src="'+ref+'" alt=""><span>WHAT YOU\'RE AFTER</span></div>':'')+'<span class="k">CHALLENGE '+(i+1)+' OF '+CH.pads.length+(done?' · DONE ✓':'')+'</span><b class="t">'+cbEsc(P.c.title)+'</b><p>'+cbEsc(P.c.brief)+'</p><div class="ck"></div><span class="go"></span>'; el.classList.add("show"); }
    el.querySelector(".ck").innerHTML=checks.map(function(x){ return '<div class="'+(x.ok?'ok':'')+'"><i>'+(x.ok?'✓':'')+'</i><span>'+cbEsc(x.label)+'</span><em>'+x.now+'</em></div>'; }).join("");
    var go=el.querySelector(".go"); go.textContent=all?(viewfinderOn?"EVERYTHING’S SET. TAKE THE SHOT ↵":"EVERYTHING’S SET. RAISE THE CAMERA (P) AND SHOOT"):"TICK THEM ALL, THEN SHOOT"; go.classList.toggle("on", all); el.classList.toggle("ready", all); }
  function chFlash(P){ var f=$("chFlash"); if(!f) return; f.innerHTML='<span>CHALLENGE</span><b>'+cbEsc(P.c.title)+'</b>'; f.classList.remove("show"); void f.offsetWidth; f.classList.add("show"); }
  function chOnShot(p){ if(CH.active<0) return; var P=CH.pads[CH.active], checks=chChecks(P), miss=checks.filter(function(x){ return !x.ok; });
    if(miss.length){ toast("Close. Still to do: "+miss.map(function(x){ return x.label.toLowerCase(); }).join(", ")); return; }
    p.challenge=P.c.id; var first=!CH.done[P.c.id]; CH.done[P.c.id]=1; P.frame.material.uniforms.done.value=1; saveSession();
    var n=Object.keys(CH.done).filter(function(k){ return CH.list.some(function(c){ return c.id===k; }); }).length, s=$("chDone");
    s.innerHTML='<span class="k">'+(first?'CHALLENGE COMPLETE':'DONE AGAIN')+'</span><b>'+cbEsc(P.c.title)+'</b><img src="'+p.url+'" alt=""><span class="n">'+n+' OF '+CH.pads.length+' AT '+cbEsc((cbPlace||"").toUpperCase())+'</span>';
    s.classList.remove("show"); void s.offsetWidth; s.classList.add("show"); chCard(P);
    if(CH.pull>=0&&CH.pads[CH.pull]===P) chLetGo(); CH.doneHold=true; clearTimeout(CH.doneT); CH.doneT=setTimeout(function(){ CH.doneHold=false; }, 2600); }
  // ---- on-screen markers that point to the frames ----
  var _chV=new THREE.Vector3();
  function chMarkers(){ var host=$("chMarks"); if(!host) return; var show=loaded&&App.is("scene")&&CH.pads.length&&!chOff();
    host.classList.toggle("show", !!show); if(!show) return;
    if(host.children.length!==CH.pads.length) host.innerHTML=CH.pads.map(function(){ return '<span class="chm"><i></i><b></b></span>'; }).join("");
    var W=window.innerWidth, H=window.innerHeight, nearest=-1, nd=1e9;
    CH.pads.forEach(function(P,i){ var d=Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z); if(!CH.done[P.c.id]&&d<nd){ nd=d; nearest=i; } });
    CH.pads.forEach(function(P,i){ var el=host.children[i], done=CH.done[P.c.id], d=Math.hypot(camPos.x-P.E.x,camPos.z-P.E.z);
      if(CH.active>=0||done){ el.style.display="none"; return; } el.style.display=""; el.classList.toggle("lbl", i===nearest);
      _chV.set(P.F.x, P.F.y+P.h/2+0.3, P.F.z).project(camera); var behind=_chV.z>1, x=(_chV.x*0.5+0.5)*W, y=(-_chV.y*0.5+0.5)*H, off=behind||x<40||x>W-40||y<60||y>H-90;
      if(behind){ x=W-x; y=H-y; } if(off){ x=Math.max(90,Math.min(W-90,x)); y=Math.max(120,Math.min(H-120,behind?H-120:y)); }
      el.style.transform="translate("+x.toFixed(0)+"px,"+y.toFixed(0)+"px)"; el.classList.toggle("off", off); el.classList.toggle("done", !!done);
      el.querySelector("b").textContent=Math.round(d)+" M"; }); }
  if(/[?&]dev/.test(location.search)){ window.__ch={ pads:function(){ return CH.pads.map(function(P){ return {id:P.c.id, x:P.E.x, z:P.E.z, y:P.E.y, w:P.w, done:!!CH.done[P.c.id]}; }); }, active:function(){ return CH.active; },
      checks:function(){ return CH.active>=0?chChecks(CH.pads[CH.active]):null; } };
    window.__ch.set=function(o){ if(o.mm!=null){ focalMM=o.mm; zoomMM=o.mm; } if(o.f!=null){ var j=APERTURES.indexOf(o.f); if(j>=0) apIdx=j; } if(o.eye!=null) WK.eye=o.eye; if(o.sh!=null){ var q=SHUTTER_LABELS.indexOf(o.sh); if(q>=0) shIdx=q; } computeCam();
      if(o.meter){ var best=shIdx, bv=1e9; for(var s=0;s<SHUTTER_LABELS.length;s++){ shIdx=s; computeCam(); if(Math.abs(evStops)<bv){ bv=Math.abs(evStops); best=s; } } shIdx=best; computeCam(); } };
    window.__ch.aim=function(i){ var d=CH.pads[i].d; yaw=Math.atan2(-d.x,-d.z); pitch=Math.asin(Math.max(-1,Math.min(1,d.y))); basis(); };
    window.__ch.goto=function(i){ var P=CH.pads[i]; CH.pull=-1; CH.locked=false; CH.cool=i; camPos.x=P.E.x; camPos.z=P.E.z; WK.eye=P.E.y-wkGround(P.E.x,P.E.z); _vel.set(0,0,0); };
    window.__ch.approach=function(i,out,turn){ var P=CH.pads[i], L=Math.hypot(P.d.x,P.d.z)||1; out=out==null?0.35:out; camPos.x=P.F.x-P.d.x/L*out; camPos.z=P.F.z-P.d.z/L*out; yaw=Math.atan2(-P.d.x,-P.d.z)+(turn==null?0.3:turn); pitch=0; _vel.set(0,0,0); };
    window.__ch.pull=function(){ return {i:CH.pull, locked:CH.locked, cool:CH.cool, hold:chHold()}; }; window.__ch.nudge=function(){ CH.nudge=true; }; }
