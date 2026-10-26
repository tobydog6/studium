  // ================= LAUNCH: the opening =================
  // A short glow while the scan loads, then straight in: close on the stump in slow motion, the camera creeping round the
  // detail. The camera comes up, racks focus onto the bark, and shoots. That still becomes the first frame of a strip of
  // film: the rooms gliding past full screen, slowly, then a speed ramp until they streak. The strip flies off onto the
  // scan already in a wide fast spin, which slows and settles onto the starting spot, and the wordmark lands. Any click
  // or key skips to the settle. After the first time it's the short version: glow, in, settle. The whole thing waits for
  // the scan, never the other way round.
  var LA={on:false, t0:0, raf:0, phase:"", fast:false, after:null, el:null, cam:null, hold:false};
  var LA_KEY="studium_launch_seen";
  var LA_ROOMS=[["select","Pick","asset:assets/launch/select.mp4"],["edit","Edit","asset:assets/launch/edit.mp4"],["workbook","Make","asset:assets/launch/workbook.mp4"],["folio","Folio","asset:assets/launch/folio.mp4"],["gallery","Show","asset:assets/launch/gallery.mp4"]];
  var LA_T={detail:3.2, shoot:2.3, slow:4.6, fast:2.4, spin:2.6, lock:1.5, word:2.6};
  var LA_REP=2;   /* the room clips repeat along the strip so there's film to streak past */
  function laSeen(){ try{ return localStorage.getItem(LA_KEY)==="1"; }catch(e){ return false; } }
  function laEl(){ var e=$("launch"); if(e) return e; e=document.createElement("div"); e.id="launch"; var fr='<div class="la-fr still"><img alt=""></div>';
    for(var r=0;r<LA_REP;r++) fr+=LA_ROOMS.map(function(m){ return '<div class="la-fr"><video muted loop playsinline preload="auto" src="'+m[2]+'"></video><span>'+m[1].toUpperCase()+'</span></div>'; }).join("");
    e.innerHTML='<div class="la-glow"></div><div class="la-film"><div class="la-strip">'+fr+'</div></div><div class="la-snap"></div>'
      +'<div class="la-word"><span class="la-kick">WELCOME TO</span><b>'+"Studium".split("").map(function(c,i){ return '<i style="--n:'+i+'">'+c+'</i>'; }).join("")+'</b><em></em><span class="la-tag">A PHOTOGRAPHY STUDIO YOU WALK INTO</span></div><div class="la-skip">CLICK TO SKIP</div>';
    document.body.appendChild(e);
    e.addEventListener("pointerdown",function(ev){ ev.stopPropagation(); laSkip(); });
    window.addEventListener("keydown",function(ev){ if(!LA.on) return; ev.stopImmediatePropagation(); ev.preventDefault(); if(!ev.repeat) laSkip(); },true);
    window.addEventListener("keyup",function(ev){ if(LA.on) ev.stopImmediatePropagation(); },true);
    return e; }
  function laPhase(p){ if(LA.phase===p) return; LA.phase=p; LA.pt=performance.now(); LA.log=(LA.log||[]).concat([p]); LA.held=false; if(LA.el){ LA.el.className="on p-"+p+(LA.skipAsked?" skip":""); } }
  function laHeld(){ if(!LA.hold) return false; if(!LA.held){ LA.held=true; LA.wait=true; } return LA.wait; }   /* tests: ?lahold parks a phase until __la.go() */
  function launchStart(after){ if(LA.on) return; LA.on=true; LA.after=after||null; LA.fast=laSeen(); LA.t0=performance.now(); LA.cam=null; LA.skipAsked=false; LA.log=[]; LA.vf=false;
    var e=laEl(); LA.el=e; document.body.classList.add("launching"); laPhase("glow");
    ["hub","landing","studio","punctum","signin","teacher"].forEach(hubHide);
    if(!loaded){ var sc=(window.SPLAT_SCENES||[])[0]; if(sc){ App.go("landing"); loadBundled(sc); } }   /* the scan loads behind the glow */
    try{ localStorage.setItem(LA_KEY,"1"); }catch(x){}
    cancelAnimationFrame(LA.raf); LA.raf=requestAnimationFrame(laTick); }
  function laSkip(){ if(!LA.on) return; if(LA.phase==="glow"){ LA.fast=true; return; }   /* before the scan is in, skipping just drops the long bits */
    if(LA.phase!=="lock") laLockStart(); }
  // ---- the camera ----
  function laSubject(){ return (CH.spec&&CH.spec.subject)||[0,0]; }
  function laPlace(a,r,eye){ var S=laSubject(), x=S[0]+Math.sin(a)*r, z=S[1]+Math.cos(a)*r, gy=wkGround(S[0],S[1]), walk=!!(WK.col&&WK.mode==="walk");
    _vel.set(0,0,0); camPos.x=x; camPos.z=z; var g=walk?wkGround(x,z):gy; if(walk) WK.eye=eye; camPos.y=g+eye;
    var ty=gy+0.4; yaw=Math.atan2(x-S[0], z-S[1]); pitch=Math.atan2(ty-camPos.y, r); if(typeof basis==="function") basis(); LA.cam={a:a, r:r, eye:eye}; }
  function laCamInit(){ var S=laSubject(), a0=Math.atan2(camPos.x-S[0], camPos.z-S[1])+0.6; laPlace(a0, 1.25, 0.75); LA.a0=a0; }
  var laE=function(u){ return u<0?0:u>1?1:u*u*(3-2*u); };
  function laDetail(u){ laPlace(LA.a0+u*0.26, 1.25-0.07*u, 0.75-0.05*u); }                       /* slow motion: a creep round the bark */
  function laShootCam(u){ laPlace(LA.a0+0.26+u*0.05, 1.18-0.03*u, 0.70+0.04*u); }                  /* the camera comes up: nearly still, a breath of lift */
  var LA_SPIN=Math.PI*1.7;
  function laSpin(u){ var k=1-Math.pow(1-u,2.6); laPlace(LA.a0+0.31+Math.PI*0.4+k*LA_SPIN, 4.0+0.3*k, 1.84); }   /* already flying when the strip clears, then it slows */
  function laLockStart(){ var sp=CH.spec&&CH.spec.spawn; laVfOff(); laPhase("lock"); LA.from={x:camPos.x, y:camPos.y, z:camPos.z, yaw:yaw, pitch:pitch, eye:WK.eye};
    if(sp){ var walk=!!(WK.col&&WK.mode==="walk"), eye=sp[4]||1.65; LA.to={x:sp[0], z:sp[1], yaw:sp[2]||0, pitch:sp[3]||-0.1, eye:eye, y:(walk?wkGround(sp[0],sp[1]):camPos.y)+eye}; }
    else LA.to={x:camPos.x, y:camPos.y, z:camPos.z, yaw:yaw, pitch:pitch, eye:WK.eye};
    Array.prototype.forEach.call(LA.el.querySelectorAll("video"),function(v){ try{ v.pause(); }catch(x){} }); }
  function laLock(u){ var F=LA.from, T=LA.to, k=laE(u), dy=T.yaw-F.yaw; dy=Math.atan2(Math.sin(dy),Math.cos(dy));
    _vel.set(0,0,0); camPos.x=F.x+(T.x-F.x)*k; camPos.z=F.z+(T.z-F.z)*k; camPos.y=F.y+(T.y-F.y)*k; if(WK.col&&WK.mode==="walk") WK.eye=F.eye+(T.eye-F.eye)*k;
    yaw=F.yaw+dy*k; pitch=F.pitch+(T.pitch-F.pitch)*k; if(typeof basis==="function") basis(); }
  // ---- the shot: the real viewfinder comes up, wide open, racks focus onto the bark, and fires ----
  function laVfOn(){ if(LA.vf) return; LA.vf=true; LA.ap=apIdx; apIdx=0; computeCam(); setFocus(0.92); try{ raiseCamera(); }catch(e){} afPending=false; }
  function laVfOff(){ if(!LA.vf) return; LA.vf=false; try{ lowerCamera(); }catch(e){} if(LA.ap!=null){ apIdx=LA.ap; computeCam(); } afPending=false; }
  function laFocusTarget(){ var r=LA.cam?LA.cam.r:1.2; return Math.max(0,Math.min(1,Math.log(Math.max(0.3,r-0.1)/0.3)/Math.log(60))); }   /* focusMetres() = 0.3·60^f */
  function laFire(){ var A=window.innerWidth/window.innerHeight, url=null; try{ url=captureAspect(A,0); }catch(e){}
    var im=LA.el.querySelector(".la-fr.still img"); if(im&&url) im.src=url; LA.el.classList.add("snap"); if(typeof shutterSound==="function"){ try{ shutterSound(); }catch(e){} }
    setTimeout(laVfOff,140); }
  // ---- the film: the strip's position along the frames, slow then streaking ----
  function laStripPos(t){ var v0=0.34, T=LA_T.slow, N=1+LA_ROOMS.length*LA_REP; if(t<T) return {s:v0*t, v:v0};
    var tau=Math.min(t-T,LA_T.fast), K=(N-0.2-v0*T-v0*LA_T.fast)/Math.pow(LA_T.fast,3); return {s:v0*T+v0*tau+K*tau*tau*tau, v:v0+3*K*tau*tau}; }
  function laStrip(t){ var st=LA.el.querySelector(".la-strip"), p=laStripPos(t), W=window.innerWidth, step=W*1.025;
    st.style.transform="translate3d("+(-p.s*step)+"px,0,0)"; var b=Math.min(14,Math.max(0,(p.v-0.6)*1.6)); st.style.filter=b>0.3?"blur("+b.toFixed(1)+"px)":""; return p; }
  // ---- the clock ----
  function laTick(now){ if(!LA.on) return; LA.raf=requestAnimationFrame(laTick); var t=(now-LA.t0)/1000, p=LA.phase, pt=(now-(LA.pt||LA.t0))/1000, e=LA.el;
    if(p==="glow"){ if(t>2.5&&!LA.skipAsked){ LA.skipAsked=true; e.classList.add("skip"); }
      if(loaded&&t>(LA.fast?0.7:1.1)){ laCamInit(); if(typeof updateCamera==="function") updateCamera(0); if(LA.fast){ laLockStart(); return; } laPhase("detail"); } return; }
    if(p==="detail"){ laDetail(Math.min(1,pt/LA_T.detail)); if(pt>LA_T.detail&&!laHeld()) laPhase("shoot"); return; }
    if(p==="shoot"){ laShootCam(Math.min(1,pt/LA_T.shoot)); if(!LA.vf&&pt>0.05) laVfOn(); if(LA.vf&&!LA.af&&pt>0.7){ LA.af=true; afHunt(laFocusTarget()); }
      if(LA.af&&!LA.fired&&pt>1.75){ LA.fired=true; laFire(); }
      if(pt>LA_T.shoot&&!laHeld()){ laPhase("film"); LA.strip0=performance.now(); Array.prototype.forEach.call(e.querySelectorAll("video"),function(v){ try{ v.currentTime=0; v.play(); }catch(x){} }); } return; }
    if(p==="film"){ var q=laStrip(pt); if(pt>LA_T.slow+LA_T.fast-0.35&&!e.classList.contains("clear")) e.classList.add("clear");   /* the last streak goes over the spin already underway */
      laSpin(Math.max(0,(pt-(LA_T.slow+LA_T.fast-0.35))/LA_T.spin)); if(pt>LA_T.slow+LA_T.fast&&!laHeld()){ laPhase("spin"); LA.spin0=pt-(LA_T.slow+LA_T.fast-0.35); } return; }
    if(p==="spin"){ var su=Math.min(1,(LA.spin0+pt)/LA_T.spin); laSpin(su); if(su>=1&&!laHeld()) laLockStart(); return; }
    if(p==="lock"){ laLock(Math.min(1,pt/LA_T.lock)); if(pt>LA_T.lock) laEnd(); return; } }
  function laEnd(){ if(!LA.on) return; LA.on=false; cancelAnimationFrame(LA.raf); var e=LA.el; LA.welcome=Date.now(); laVfOff();
    if(loaded){ hubShow("hud"); App.go("scene"); if(typeof updatePrompt==="function") updatePrompt(); } else showHub();
    if(e){ e.className="on out"; setTimeout(function(){ e.className=""; document.body.classList.remove("launching"); },LA_T.word*1000); } else document.body.classList.remove("launching");
    LA.af=false; LA.fired=false; if(LA.after) LA.after(); }
  LA.hold=/[?&]lahold/.test(location.search);
  if(/[?&]dev/.test(location.search)) window.__la={ start:launchStart, skip:laSkip, go:function(){ LA.wait=false; }, state:function(){ return {on:LA.on, phase:LA.phase, fast:LA.fast, loaded:loaded, log:LA.log||[]}; }, reset:function(){ try{ localStorage.removeItem(LA_KEY); }catch(e){} } };
