  // ================= LAUNCH: the opening =================
  // Dark for a beat while the scan loads, then straight in: close on the stump in slow motion, from the shallow-depth
  // gold frame's own viewpoint. The real viewfinder comes up on the 85 wide open, racks focus onto the bark, and fires.
  // The still shrinks into the first frame of a strip of 35 mm film, the rooms following it frame by frame, each easing
  // in to rest and out again, the scan drifting wide behind the sprocket holes. The strip slides off and the scan goes
  // round in one big circle as the wordmark lands, then the camera settles on the starting spot. Any click or key skips
  // to the settle. After the first time it's the short version: dark, in, settle. The whole thing waits for the scan.
  var LA={on:false, t0:0, raf:0, phase:"", fast:false, after:null, el:null, cam:null, hold:false};
  var LA_KEY="studium_launch_seen";
  var LA_ROOMS=[["select","Pick","asset:assets/launch/select.mp4"],["edit","Edit","asset:assets/launch/edit.mp4"],["workbook","Make","asset:assets/launch/workbook.mp4"],["folio","Folio","asset:assets/launch/folio.mp4"],["gallery","Show","asset:assets/launch/gallery.mp4"]];
  var LA_T={detail:3.0, shoot:2.8, iris:0.9, per:1.55, ebb:0.84, exit:0.7, spin:4.6, word:2.4};
  function laSeen(){ try{ return localStorage.getItem(LA_KEY)==="1"; }catch(e){ return false; } }
  function laEl(){ var e=$("launch"); if(e) return e; e=document.createElement("div"); e.id="launch";
    var fr='<div class="la-fr still"><img alt=""><i>01A</i></div>'+LA_ROOMS.map(function(m,i){ return '<div class="la-fr"><video muted loop playsinline preload="auto" src="'+m[2]+'"></video><span>'+m[1].toUpperCase()+'</span><i>'+(i<8?"0":"")+(i+2)+'A</i></div>'; }).join("");
    e.innerHTML='<div class="la-dark"><b>Studium</b></div><div class="la-film"><div class="la-strip">'+fr+'</div></div><div class="la-still"><img alt=""></div><div class="la-iris"></div><div class="la-snap"></div>'
      +'<div class="la-word"><span class="la-kick">WELCOME TO</span><b>'+"Studium".split("").map(function(c,i){ return '<i style="--n:'+i+'">'+c+'</i>'; }).join("")+'</b><em></em><span class="la-tag">A PHOTOGRAPHY STUDIO YOU WALK INTO</span></div><div class="la-skip">CLICK TO SKIP</div>';
    document.body.appendChild(e);
    e.addEventListener("pointerdown",function(ev){ ev.stopPropagation(); laSkip(); });
    window.addEventListener("keydown",function(ev){ if(!LA.on) return; ev.stopImmediatePropagation(); ev.preventDefault(); if(!ev.repeat) laSkip(); },true);
    window.addEventListener("keyup",function(ev){ if(LA.on) ev.stopImmediatePropagation(); },true);
    return e; }
  function laPhase(p){ if(LA.phase===p) return; LA.phase=p; LA.pt=performance.now(); LA.log=(LA.log||[]).concat([p]); LA.held=false; if(LA.el){ LA.el.className="on p-"+p+(LA.skipAsked?" skip":"")+(LA.el.classList.contains("held")?" held":""); } }
  function laHeld(){ if(!LA.hold) return false; if(!LA.held){ LA.held=true; if(LA.pass){ LA.pass=false; return false; } LA.wait=true; } return LA.wait; }   /* tests: ?lahold parks a phase until __la.go() */
  function launchStart(after){ if(LA.on) return; LA.on=true; LA.after=after||null; LA.fast=laSeen(); LA.t0=performance.now(); LA.cam=null; LA.skipAsked=false; LA.log=[]; LA.vf=false; LA.af=false; LA.fired=false; LA.quick=false;
    var e=laEl(); LA.el=e; document.body.classList.add("launching"); laPhase("dark");
    ["hub","landing","studio","punctum","signin","teacher"].forEach(hubHide);
    if(!loaded){ var sc=(window.SPLAT_SCENES||[])[0]; if(sc){ App.go("landing"); loadBundled(sc); } }   /* the scan loads behind the dark */
    try{ localStorage.setItem(LA_KEY,"1"); }catch(x){}
    cancelAnimationFrame(LA.raf); LA.raf=requestAnimationFrame(laTick); }
  function laSkip(){ if(!LA.on) return; if(LA.phase==="dark"){ LA.fast=true; return; }   /* before the scan is in, skipping just drops the long bits */
    if(LA.phase!=="spin") laLockStart(); }
  // ---- the camera ----
  function laSubject(){ return (CH.spec&&CH.spec.subject)||[0,0]; }
  function laShotSpec(){ var s=CH.spec&&CH.spec.challenges, c=null; (s||[]).forEach(function(x){ if(x.id==="stump-dof") c=x; }); return c||{az:-75, dist:2.2, h:0.8, look:[0,0.3,0]}; }   /* the shallow-depth gold frame knows where the stump looks best */
  function laPlace(a,r,eye,look){ var S=laSubject(), L=look||[0,0.3,0], tx=S[0]+(L[0]||0), tz=S[1]+(L[2]||0), x=S[0]+Math.sin(a)*r, z=S[1]+Math.cos(a)*r, gy=wkGround(S[0],S[1]), walk=!!(WK.col&&WK.mode==="walk");
    _vel.set(0,0,0); camPos.x=x; camPos.z=z; var g=walk?wkGround(x,z):gy; if(walk) WK.eye=eye; camPos.y=g+eye;
    var ty=gy+(L[1]||0.3); yaw=Math.atan2(x-tx, z-tz); pitch=Math.atan2(ty-camPos.y, Math.hypot(x-tx,z-tz)); if(typeof basis==="function") basis(); LA.cam={a:a, r:r, eye:eye}; }
  function laCamInit(){ var c=laShotSpec(); LA.a0=c.az*Math.PI/180; LA.r0=c.dist; LA.h0=c.h; LA.look=c.look; laDetail(0); }
  var laE=function(u){ return u<0?0:u>1?1:u*u*(3-2*u); };
  function laFov(v){ if(viewfinderOn||!camera) return; camera.fov=v; camera.updateProjectionMatrix(); }       /* a longer lens for the slow motion; the viewfinder sets its own, and lowering it goes back to the walking eye */
  function laDetail(u){ laPlace(LA.a0-0.11+u*0.14, LA.r0+0.12-0.14*u, LA.h0+0.02-0.03*u, LA.look); laFov(31-7*u); }   /* slow motion: a creep round into the frame, pushing in */
  function laShootCam(u){ laPlace(LA.a0+0.03+u*0.015, LA.r0-0.02-0.01*u, LA.h0-0.01, LA.look); if(!LA.vf) laFov(24); }              /* the camera comes up: all but still */
  var LA_WIDE={r:4.1, eye:1.9};
  function laDrift(t){ laPlace(LA.a0+0.9+t*0.07, LA_WIDE.r, LA_WIDE.eye); }                                  /* wide and slow behind the film */
  // ---- the spin: one big circle from wherever the strip left the scan, landing exactly on the starting spot ----
  function laSpinStart(){ var sp=CH.spec&&CH.spec.spawn, S=laSubject(), walk=!!(WK.col&&WK.mode==="walk"); laVfOff(); laPhase("spin");
    Array.prototype.forEach.call(LA.el.querySelectorAll("video"),function(v){ try{ v.pause(); }catch(x){} });
    var a0=LA.cam?LA.cam.a:Math.atan2(camPos.x-S[0], camPos.z-S[1]), r0=LA.cam?LA.cam.r:Math.hypot(camPos.x-S[0], camPos.z-S[1]), e0=LA.cam?LA.cam.eye:WK.eye;
    if(!sp){ LA.sp=null; LA.spinA=a0; LA.spinR=r0; LA.spinE=e0; LA.spinD=Math.PI*2; return; }
    var eye=sp[4]||1.65, aS=Math.atan2(sp[0]-S[0], sp[1]-S[1]), rS=Math.hypot(sp[0]-S[0], sp[1]-S[1]), d=aS-a0; d=Math.atan2(Math.sin(d),Math.cos(d)); if(d<0) d+=Math.PI*2;
    LA.sp={x:sp[0], z:sp[1], yaw:sp[2]||0, pitch:sp[3]||-0.1, eye:eye, y:(walk?wkGround(sp[0],sp[1]):camPos.y)+eye}; LA.spinA=a0; LA.spinR=r0; LA.spinE=e0; LA.spinD=d+Math.PI*2*(d>Math.PI*0.5?0:1); LA.spinRS=rS; }
  function laSpin(u){ var k=laE(u), T=LA.sp; if(!T){ laPlace(LA.spinA+k*LA.spinD, LA.spinR, LA.spinE); return; }
    laPlace(LA.spinA+k*LA.spinD, LA.spinR+(LA.spinRS-LA.spinR)*k, LA.spinE+(T.eye-LA.spinE)*k);   /* round, drawing in, looking at the stump all the way */
    var m=laE((u-0.72)/0.28); if(m<=0) return;   /* the last stretch eases onto the exact spot and the way it faces */
    var dy=T.yaw-yaw; dy=Math.atan2(Math.sin(dy),Math.cos(dy)); yaw+=dy*m; pitch+=(T.pitch-pitch)*m; camPos.x+=(T.x-camPos.x)*m; camPos.z+=(T.z-camPos.z)*m; camPos.y+=(T.y-camPos.y)*m; if(WK.col&&WK.mode==="walk") WK.eye+=(T.eye-WK.eye)*m; if(typeof basis==="function") basis(); }
  function laLockStart(){ laSpinStart(); LA.quick=true; }   /* a skip: the same landing, just the short way round */
  // ---- the shot: the real viewfinder comes up on the 85 wide open, racks focus onto the bark, and fires ----
  function laVfOn(){ if(LA.vf) return; LA.vf=true; LA.ap=apIdx; LA.lens=lensIdx; apIdx=0; var b=curBody(), li=b.lenses.indexOf(85); if(li>=0) selectLens(li); computeCam(); setFocus(0.95); try{ raiseCamera(); }catch(e){} afPending=false; LA.fovTo=camera.fov; LA.fovFrom=24; }
  function laIris(u){ var cv=LA.el.querySelector(".la-iris"); if(u>=1){ cv.style.opacity=0; if(camera){ camera.fov=LA.fovTo; camera.updateProjectionMatrix(); } return; }
    var k=1-Math.pow(1-u,2.4); cv.style.opacity=1; cv.style.setProperty("--o",(1-k).toFixed(3)); cv.style.setProperty("--r",(28+62*k).toFixed(1)+"%");   /* a soft dark edge that eases open as the lens comes up */
    if(camera){ camera.fov=LA.fovFrom+(LA.fovTo-LA.fovFrom)*k; camera.updateProjectionMatrix(); } }
  function laVfOff(){ if(!LA.vf) return; LA.vf=false; try{ lowerCamera(); }catch(e){} if(LA.ap!=null){ apIdx=LA.ap; computeCam(); } if(LA.lens!=null) selectLens(LA.lens); afPending=false; var el=$("vfAF"); if(el) el.classList.remove("hunt","ok"); }
  function laFocusTarget(){ var r=LA.cam?LA.cam.r:2.2; return Math.max(0,Math.min(1,Math.log(Math.max(0.3,r-0.15)/0.3)/Math.log(60))); }   /* focusMetres() = 0.3·60^f */
  function laRack(u){ var from=0.95, to=LA.focusTo, el=$("vfAF"); if(u<=0){ if(el){ el.classList.remove("ok"); el.classList.add("hunt"); } return; }
    var v; if(u<0.72){ var k=laE(u/0.72); v=from+(to-0.045-from)*k; } else if(u<0.9){ v=to-0.045+0.065*laE((u-0.72)/0.18); } else v=to+0.02-0.02*laE((u-0.9)/0.1);   /* a long pull, a touch past, back onto it */
    setFocus(v); if(u>=1&&el&&!el.classList.contains("ok")){ el.classList.remove("hunt"); el.classList.add("ok"); } }
  function laFire(){ var A=window.innerWidth/window.innerHeight, url=null; try{ url=captureAspect(A,0); }catch(e){}
    Array.prototype.forEach.call(LA.el.querySelectorAll(".la-fr.still img, .la-still img"),function(im){ if(url) im.src=url; });
    LA.el.classList.add("snap"); if(typeof shutterSound==="function"){ try{ shutterSound(); }catch(e){} }
    setTimeout(function(){ laVfOff(); LA.el.classList.add("held"); laDrift(0); },130); }   /* behind the black: the lens goes down and the scan jumps wide, the still covers it */
  // ---- the film: frame by frame, easing to rest on each ----
  function laStripPos(t){ var n=1+LA_ROOMS.length, P=LA_T.per, A=LA_T.ebb, end=(n-1)*P;   /* a steady drift that slows through each frame and gathers between: never a full stop */
    if(t<end){ var ph=2*Math.PI*t/P; return {s:t/P-A*Math.sin(ph)/(2*Math.PI), v:(1-A*Math.cos(ph))/P, end:false}; }
    var k=Math.min(1,(t-end)/LA_T.exit); return {s:n-1+(1-A)/P*(t-end)+Math.pow(k,2.2)*1.7, v:(1-A)/P+2.2*Math.pow(k,1.2)*1.7/LA_T.exit, end:k>=1}; }   /* then away */
  function laStrip(t){ var st=LA.el.querySelector(".la-strip"), fr=st.firstElementChild, W=window.innerWidth, fw=fr.offsetWidth, pitch=fw+parseFloat(getComputedStyle(fr).marginRight), p=laStripPos(t);
    st.style.transform="translate3d("+((W-fw)/2-fr.offsetLeft-p.s*pitch)+"px,0,0)"; var b=Math.min(5,((p.v||0)-0.9)*3); st.style.filter=b>0.25?"blur("+b.toFixed(1)+"px)":""; return p; }
  // ---- the clock ----
  function laTick(now){ if(!LA.on) return; LA.raf=requestAnimationFrame(laTick); var t=(now-LA.t0)/1000, p=LA.phase, pt=(now-(LA.pt||LA.t0))/1000, e=LA.el;
    if(p==="dark"){ if(t>2.5&&!LA.skipAsked){ LA.skipAsked=true; e.classList.add("skip"); }
      if(loaded&&t>(LA.fast?0.6:1.0)){ laCamInit(); if(typeof updateCamera==="function") updateCamera(0); if(LA.fast){ laDrift(0); laLockStart(); return; } laPhase("detail"); } return; }
    if(p==="detail"){ laDetail(Math.min(1,pt/LA_T.detail)); if(pt>LA_T.detail&&!laHeld()) laPhase("shoot"); return; }
    if(p==="shoot"){ if(!LA.fired) laShootCam(Math.min(1,pt/LA_T.shoot)); if(!LA.vf&&!LA.fired&&pt>0.05){ laVfOn(); LA.focusTo=laFocusTarget(); }
      if(LA.vf&&!LA.fired) laIris(Math.min(1,(pt-0.05)/LA_T.iris));
      if(LA.vf&&pt>0.75) laRack(Math.min(1,(pt-0.75)/1.4));
      if(LA.vf&&!LA.fired&&pt>2.4){ LA.fired=true; laFire(); }
      if(pt>LA_T.shoot&&!laHeld()){ laPhase("film"); e.classList.add("held"); Array.prototype.forEach.call(e.querySelectorAll("video"),function(v){ try{ v.currentTime=0; v.play(); }catch(x){} }); } return; }
    if(p==="film"){ laDrift(pt); var q=laStrip(pt); if(q.end&&!laHeld()) laSpinStart(); return; }
    if(p==="spin"){ var su=Math.min(1,pt/(LA.quick?1.6:LA_T.spin)); laSpin(su); if(su>=1&&(LA.quick||!laHeld())) laEnd(); return; } }
  function laEnd(){ if(!LA.on) return; LA.on=false; cancelAnimationFrame(LA.raf); var e=LA.el; LA.welcome=Date.now(); laVfOff(); (CH.pads||[]).forEach(function(P){ P.vis=0; });   /* the gold frames fade in once the wordmark has gone */
    if(loaded){ hubShow("hud"); App.go("scene"); if(typeof updatePrompt==="function") updatePrompt(); } else showHub();
    if(e){ e.className="on out"; setTimeout(function(){ e.className=""; document.body.classList.remove("launching"); },LA_T.word*1000); } else document.body.classList.remove("launching");
    var cv=e&&e.querySelector(".la-iris"); if(cv) cv.style.opacity=0;
    if(LA.after) LA.after(); }
  LA.hold=/[?&]lahold/.test(location.search);
  if(/[?&]dev/.test(location.search)) window.__la={ start:launchStart, skip:laSkip, go:function(){ LA.wait=false; LA.pass=!LA.held; }, state:function(){ return {on:LA.on, phase:LA.phase, fast:LA.fast, loaded:loaded, log:LA.log||[]}; }, reset:function(){ try{ localStorage.removeItem(LA_KEY); }catch(e){} } };
