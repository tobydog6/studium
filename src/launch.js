  // ================= LAUNCH: the opening =================
  // Dark, a small glow while the scan loads. Then straight in: close on the stump in slow motion, the camera creeping round the
  // detail, then a speed ramp up and out and round. The rooms glide in from off screen as full-screen panels (recordings of
  // moving around inside each room), each stopping a little further left so they stack into strips, the scan still turning
  // behind them. They fade, and the camera settles onto the starting spot. Any click or key skips to the end. After the first
  // time it's the short version: glow, in, settle. The whole thing waits for the scan, never the other way round.
  var LA={on:false, t0:0, raf:0, phase:"", fast:false, after:null, el:null, cam:null, hold:false};
  var LA_KEY="studium_launch_seen";
  var LA_ROOMS=[["select","Pick","asset:assets/launch/select.mp4"],["edit","Edit","asset:assets/launch/edit.mp4"],["workbook","Make","asset:assets/launch/workbook.mp4"],["folio","Folio","asset:assets/launch/folio.mp4"],["gallery","Show","asset:assets/launch/gallery.mp4"]];
  var LA_T={detail:2.8, ramp:2.2, cards:3.6, lock:1.4};
  function laSeen(){ try{ return localStorage.getItem(LA_KEY)==="1"; }catch(e){ return false; } }
  function laEl(){ var e=$("launch"); if(e) return e; e=document.createElement("div"); e.id="launch"; var n=LA_ROOMS.length;
    e.innerHTML='<div class="la-glow"></div><div class="la-pans">'+LA_ROOMS.map(function(r,i){ return '<div class="la-pan" style="--i:'+i+';--k:'+(n-i)+'"><video muted loop playsinline preload="auto" src="'+r[2]+'"></video><span>'+r[1].toUpperCase()+'</span></div>'; }).join("")+'</div>'
      +'<div class="la-word"><b>Studium</b><span>A PHOTOGRAPHY STUDIO YOU WALK INTO</span></div><div class="la-skip">CLICK TO SKIP</div>';
    document.body.appendChild(e);
    e.addEventListener("pointerdown",function(ev){ ev.stopPropagation(); laSkip(); });
    window.addEventListener("keydown",function(ev){ if(!LA.on) return; ev.stopImmediatePropagation(); ev.preventDefault(); if(!ev.repeat) laSkip(); },true);
    window.addEventListener("keyup",function(ev){ if(LA.on) ev.stopImmediatePropagation(); },true);
    return e; }
  function laPhase(p){ if(LA.phase===p) return; LA.phase=p; LA.pt=performance.now(); LA.log=(LA.log||[]).concat([p]); LA.held=false; if(LA.el){ LA.el.className="on p-"+p+(LA.skipAsked?" skip":""); } }
  function laHeld(){ if(!LA.hold) return false; if(!LA.held){ LA.held=true; LA.wait=true; } return LA.wait; }   /* tests: ?lahold parks a phase until __la.go() */
  function launchStart(after){ if(LA.on) return; LA.on=true; LA.after=after||null; LA.fast=laSeen(); LA.t0=performance.now(); LA.cam=null; LA.skipAsked=false; LA.log=[];
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
  function laDetail(u){ laPlace(LA.a0+u*0.28, 1.25-0.08*u, 0.75-0.06*u); }                                 /* slow motion: a creep round the bark */
  function laRamp(u){ var s=Math.pow(u,2.2); laPlace(LA.a0+0.28+s*Math.PI*1.35, 1.17+2.9*s, 0.69+1.15*s); }   /* then up, out and round, fast */
  function laDrift(u){ var A=LA.a0+0.28+Math.PI*1.35; laPlace(A+u*0.5, 4.07, 1.84); }                        /* under the panels it keeps turning, gently */
  function laLockStart(){ var sp=CH.spec&&CH.spec.spawn; laPhase("lock"); LA.from={x:camPos.x, y:camPos.y, z:camPos.z, yaw:yaw, pitch:pitch, eye:WK.eye};
    if(sp){ var walk=!!(WK.col&&WK.mode==="walk"), eye=sp[4]||1.65; LA.to={x:sp[0], z:sp[1], yaw:sp[2]||0, pitch:sp[3]||-0.1, eye:eye, y:(walk?wkGround(sp[0],sp[1]):camPos.y)+eye}; }
    else LA.to={x:camPos.x, y:camPos.y, z:camPos.z, yaw:yaw, pitch:pitch, eye:WK.eye};
    Array.prototype.forEach.call(LA.el.querySelectorAll("video"),function(v){ try{ v.pause(); }catch(x){} }); }
  function laLock(u){ var F=LA.from, T=LA.to, k=laE(u), dy=T.yaw-F.yaw; dy=Math.atan2(Math.sin(dy),Math.cos(dy));
    _vel.set(0,0,0); camPos.x=F.x+(T.x-F.x)*k; camPos.z=F.z+(T.z-F.z)*k; camPos.y=F.y+(T.y-F.y)*k; if(WK.col&&WK.mode==="walk") WK.eye=F.eye+(T.eye-F.eye)*k;
    yaw=F.yaw+dy*k; pitch=F.pitch+(T.pitch-F.pitch)*k; if(typeof basis==="function") basis(); }
  // ---- the clock ----
  function laTick(now){ if(!LA.on) return; LA.raf=requestAnimationFrame(laTick); var t=(now-LA.t0)/1000, p=LA.phase, pt=(now-(LA.pt||LA.t0))/1000, e=LA.el;
    if(p==="glow"){ if(t>2.5&&!LA.skipAsked){ LA.skipAsked=true; e.classList.add("skip"); }
      if(loaded&&t>(LA.fast?0.9:1.6)){ laCamInit(); if(typeof updateCamera==="function") updateCamera(0); if(LA.fast){ laLockStart(); return; } laPhase("detail"); } return; }
    if(p==="detail"){ laDetail(Math.min(1,pt/LA_T.detail)); if(pt>LA_T.detail&&!laHeld()) laPhase("ramp"); return; }
    if(p==="ramp"){ laRamp(Math.min(1,pt/LA_T.ramp)); if(pt>LA_T.ramp){ laPhase("cards"); Array.prototype.forEach.call(e.querySelectorAll("video"),function(v){ try{ v.currentTime=0; v.play(); }catch(x){} }); } return; }
    if(p==="cards"){ laDrift(Math.min(1,pt/LA_T.cards)); if(pt>LA_T.cards&&!laHeld()) laLockStart(); return; }
    if(p==="lock"){ laLock(Math.min(1,pt/LA_T.lock)); if(pt>LA_T.lock) laEnd(); return; } }
  function laEnd(){ if(!LA.on) return; LA.on=false; cancelAnimationFrame(LA.raf); var e=LA.el; LA.welcome=Date.now();
    if(loaded){ hubShow("hud"); App.go("scene"); if(typeof updatePrompt==="function") updatePrompt(); } else showHub();
    if(e){ e.className="on out"; setTimeout(function(){ e.className=""; document.body.classList.remove("launching"); },500); } else document.body.classList.remove("launching");
    if(LA.after) LA.after(); }
  LA.hold=/[?&]lahold/.test(location.search);
  if(/[?&]dev/.test(location.search)) window.__la={ start:launchStart, skip:laSkip, go:function(){ LA.wait=false; }, state:function(){ return {on:LA.on, phase:LA.phase, fast:LA.fast, loaded:loaded, log:LA.log||[]}; }, reset:function(){ try{ localStorage.removeItem(LA_KEY); }catch(e){} } };
