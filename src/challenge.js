  // ================= CHALLENGES: gold spots in the scene, Skate-style =================
  // A location can hold a few challenge spots: a gold rectangle on the ground with a soft column of light, and a
  // marker on screen that points to it from anywhere. Walk into one and the challenge opens: a short brief and a
  // checklist that ticks live as you crouch, change lens, set the aperture and aim. Take the shot with every box
  // ticked and it's done: the frame is tagged with the challenge and the spot goes quiet.
  var CH={spec:null, list:[], fx:null, pads:[], active:-1, done:{}, t:0, lastEval:0, cardFor:-1};
  var CH_GOLD=new THREE.Color(0xe3ad57);
  var CH_PAD_FS="uniform float t; uniform float done; uniform vec2 size; varying vec2 vUv;"
    +"void main(){ vec2 p=vUv*size; float e=min(min(p.x,size.x-p.x),min(p.y,size.y-p.y)); float pulse=0.5+0.5*sin(t*3.0);"
    +" float edge=smoothstep(0.075,0.04,e); float glow=smoothstep(0.32,0.0,e)*0.35; float fill=0.10+0.06*pulse;"
    +" vec3 g=mix(vec3(0.89,0.68,0.34),vec3(0.85,0.83,0.78),done); float a=max(edge*(0.95-0.4*done),max(glow*(1.0-done),fill*(1.0-0.7*done)));"
    +" gl_FragColor=vec4(g*(1.0+0.35*edge),a); }";
  var CH_BEAM_FS="uniform float t; uniform float fade; varying vec2 vUv; void main(){ float a=(1.0-vUv.y)*(1.0-vUv.y)*0.22*fade*(0.8+0.2*sin(t*2.0+vUv.y*6.0)); gl_FragColor=vec4(0.95,0.74,0.38,a); }";
  var CH_VS="varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
  function chDoneSet(){ var d={}; photos.forEach(function(p){ if(p.challenge) d[p.challenge]=1; }); return d; }
  function chEquivMM(){ var b=curBody(); return Math.round(focalMM*36/(b.sensorW||36)); }
  function chFStop(){ return APERTURES[apIdx]; }
  function chEye(){ return WK.col?camPos.y-wkGround(camPos.x,camPos.z):null; }
  // build the gold spots for a scene (needs its collision map for ground heights and clear ground)
  function chAttach(sc){ CH.fx=new THREE.Scene(); CH.pads=[]; CH.active=-1; CH.cardFor=-1; chCard(null);
    var spec=(CH.spec&&CH.spec.challenges)||[]; CH.list=spec; if(!spec.length||!WK.col) return;
    CH.done=chDoneSet();
    spec.forEach(function(c,i){ var x=c.at[0], z=c.at[1], tx=c.look[0], tz=c.look[2], dx=x-tx, dz=z-tz, L=Math.hypot(dx,dz)||1;
      // nudge the spot out along the line from the subject until the ground is clear
      for(var k=0;k<20&&wkBlocked(x,z,wkGround(x,z));k++){ x+=dx/L*0.2; z+=dz/L*0.2; }
      var g=wkGround(x,z), yaw=Math.atan2(dx,dz), size=new THREE.Vector2(1.4,0.9);
      var pm=new THREE.ShaderMaterial({uniforms:{t:{value:0},done:{value:CH.done[c.id]?1:0},size:{value:size}}, vertexShader:CH_VS, fragmentShader:CH_PAD_FS, transparent:true, depthTest:false, depthWrite:false, side:THREE.DoubleSide});
      var pad=new THREE.Mesh(new THREE.PlaneGeometry(size.x,size.y), pm); pad.rotation.order="YXZ"; pad.rotation.y=yaw; pad.rotation.x=-Math.PI/2; pad.position.set(x,g+0.03,z);
      var bm=new THREE.ShaderMaterial({uniforms:{t:{value:0},fade:{value:1}}, vertexShader:CH_VS, fragmentShader:CH_BEAM_FS, transparent:true, depthTest:false, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending});
      var beam=new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.38,2.6,32,1,true), bm); beam.position.set(x,g+1.3,z); beam.visible=!CH.done[c.id];
      CH.fx.add(pad); CH.fx.add(beam);
      CH.pads.push({c:c, x:x, z:z, g:g, pad:pad, beam:beam, target:new THREE.Vector3(tx, wkGround(tx,tz)+c.look[1], tz)}); });
    chMarkers(); }
  function chRender(dt){ if(!CH.fx||!CH.pads.length) return; CH.t+=dt||0.016;
    CH.pads.forEach(function(P){ var d=Math.hypot(camPos.x-P.x,camPos.z-P.z); P.pad.material.uniforms.t.value=CH.t; P.beam.material.uniforms.t.value=CH.t;
      P.beam.material.uniforms.fade.value=Math.max(0,Math.min(1,(d-1.5)/4)); });   // the light column fades as you get close, so it never blocks the view
    var ac=renderer.autoClear; renderer.autoClear=false; renderer.render(CH.fx, camera); renderer.autoClear=ac; }
  // ---- each frame: are we standing in a spot? ----
  function chTick(){ if(!CH.pads.length||!loaded) return; var inside=-1;
    CH.pads.forEach(function(P,i){ if(Math.hypot(camPos.x-P.x, camPos.z-P.z)<0.75) inside=i; });
    if(inside!==CH.active){ CH.active=inside; if(inside>=0){ chFlash(CH.pads[inside]); chCard(CH.pads[inside]); } else chCard(null); }
    var now=performance.now(); if(CH.active>=0&&now-CH.lastEval>160){ CH.lastEval=now; chCard(CH.pads[CH.active], true); }
    chMarkers(); }
  function chChecks(P){ var c=P.c, out=[], eye=chEye(), mm=chEquivMM(), f=chFStop();
    (c.need||[]).forEach(function(n){ var ok=false, now="";
      if(n.k==="eye"){ ok=eye!=null&&(n.max==null||eye<=n.max)&&(n.min==null||eye>=n.min); now=eye!=null?eye.toFixed(1)+" M":""; }
      else if(n.k==="mm"){ ok=(n.max==null||mm<=n.max)&&(n.min==null||mm>=n.min); now=mm+" MM"; }
      else if(n.k==="f"){ ok=(n.max==null||f<=n.max)&&(n.min==null||f>=n.min); now="f/"+f; }
      else if(n.k==="aim"){ var v=P.target.clone().sub(camPos).normalize(), ang=Math.acos(Math.max(-1,Math.min(1,v.dot(_fwd))))*180/Math.PI; ok=ang<=n.tol; now=Math.round(ang)+"° OFF"; }
      else if(n.k==="ev"){ ok=Math.abs(evStops)<=n.tol; now=(evStops>=0?"+":"")+evStops.toFixed(1)+" EV"; }
      out.push({label:n.label, ok:ok, now:now}); });
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
    p.challenge=P.c.id; var first=!CH.done[P.c.id]; CH.done[P.c.id]=1; P.pad.material.uniforms.done.value=1; P.beam.visible=false; saveSession();
    var n=Object.keys(CH.done).filter(function(k){ return CH.list.some(function(c){ return c.id===k; }); }).length, s=$("chDone");
    s.innerHTML='<span class="k">'+(first?'CHALLENGE COMPLETE':'DONE AGAIN')+'</span><b>'+cbEsc(P.c.title)+'</b><img src="'+p.url+'" alt=""><span class="n">'+n+' OF '+CH.pads.length+' AT '+cbEsc((cbPlace||"").toUpperCase())+'</span>';
    s.classList.remove("show"); void s.offsetWidth; s.classList.add("show"); chCard(P); }
  // ---- on-screen markers that point to the spots ----
  var _chV=new THREE.Vector3();
  function chMarkers(){ var host=$("chMarks"); if(!host) return; var show=loaded&&App.is("scene")&&CH.pads.length;
    host.classList.toggle("show", !!show); if(!show) return;
    if(host.children.length!==CH.pads.length) host.innerHTML=CH.pads.map(function(){ return '<span class="chm"><i></i><b></b></span>'; }).join("");
    var W=window.innerWidth, H=window.innerHeight;
    CH.pads.forEach(function(P,i){ var el=host.children[i], done=CH.done[P.c.id], d=Math.hypot(camPos.x-P.x,camPos.z-P.z);
      if(CH.active===i||(done&&d>6)){ el.style.display="none"; return; } el.style.display="";
      _chV.set(P.x, P.g+2.3, P.z).project(camera); var behind=_chV.z>1, x=(_chV.x*0.5+0.5)*W, y=(-_chV.y*0.5+0.5)*H, off=behind||x<40||x>W-40||y<60||y>H-90;
      if(behind){ x=W-x; y=H-y; } if(off){ x=Math.max(90,Math.min(W-90,x)); y=Math.max(120,Math.min(H-120,behind?H-120:y)); }
      el.style.transform="translate("+x.toFixed(0)+"px,"+y.toFixed(0)+"px)"; el.classList.toggle("off", off); el.classList.toggle("done", !!done);
      el.querySelector("b").textContent=(done?"✓ ":"")+P.c.title.toUpperCase()+" · "+Math.round(d)+" M"; }); }
  if(/[?&]dev/.test(location.search)) window.__ch={ pads:function(){ return CH.pads.map(function(P){ return {id:P.c.id, x:P.x, z:P.z, g:P.g, done:!!CH.done[P.c.id]}; }); }, active:function(){ return CH.active; },
    checks:function(){ return CH.active>=0?chChecks(CH.pads[CH.active]):null; }, target:function(i){ var t=CH.pads[i].target; return [t.x,t.y,t.z]; } };
  if(/[?&]dev/.test(location.search)){ window.__ch.set=function(o){ if(o.mm!=null){ focalMM=o.mm; zoomMM=o.mm; } if(o.f!=null){ var j=APERTURES.indexOf(o.f); if(j>=0) apIdx=j; } if(o.eye!=null) WK.eye=o.eye; computeCam();
      if(o.meter){ var best=shIdx, bv=1e9; for(var s=0;s<SHUTTER_LABELS.length;s++){ shIdx=s; computeCam(); if(Math.abs(evStops)<bv){ bv=Math.abs(evStops); best=s; } } shIdx=best; computeCam(); } };
    window.__ch.aim=function(i){ var t=CH.pads[i].target, dx=t.x-camPos.x, dy=t.y-camPos.y, dz=t.z-camPos.z; yaw=Math.atan2(-dx,-dz); pitch=Math.atan2(dy,Math.hypot(dx,dz)); basis(); };
    window.__ch.goto=function(i){ var P=CH.pads[i]; camPos.x=P.x; camPos.z=P.z; _vel.set(0,0,0); }; }
