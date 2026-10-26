  // ================= LAUNCH: the opening =================
  // Dark. A small glow, the cube spins out of it while the scan loads behind, you fly into the cube and you're in the scene,
  // orbiting the stump with a speed ramp, then the rooms slide in as columns (the first one is the live scan, the rest are
  // recordings of moving around inside each room), and they settle into the hub. Any click or key skips to the end.
  // After the first time it's the short version: glow, cube, in. The whole thing waits for the scan, never the other way round.
  var LA={on:false, t0:0, raf:0, phase:"", fast:false, after:null, el:null, orbit:null, strips:0};
  var LA_KEY="studium_launch_seen";
  var LA_ROOMS=[["shoot","Shoot",null],["select","Pick","asset:assets/launch/select.mp4"],["edit","Edit","asset:assets/launch/edit.mp4"],["workbook","Make","asset:assets/launch/workbook.mp4"],["folio","Folio","asset:assets/launch/folio.mp4"],["gallery","Show","asset:assets/launch/gallery.mp4"]];
  function laSeen(){ try{ return localStorage.getItem(LA_KEY)==="1"; }catch(e){ return false; } }
  function laEl(){ var e=$("launch"); if(e) return e; e=document.createElement("div"); e.id="launch"; var sc=(window.SPLAT_SCENES||[])[0], th=sc&&sc.thumb?sc.thumb:"";
    var faces=["front","back","left","right","top","bottom"].map(function(f){ return '<i class="f '+f+'"'+(th?' style="background-image:url('+th+')"':'')+'></i>'; }).join("");
    e.innerHTML='<div class="la-glow"></div><div class="la-cube"><div class="la-c">'+faces+'</div></div>'
      +'<div class="la-strips">'+LA_ROOMS.map(function(r,i){ return '<div class="la-col'+(r[2]?'':' live')+'" style="--i:'+i+'">'+(r[2]?'<video muted loop playsinline preload="auto" src="'+r[2]+'"></video>':'')+'<span>'+r[1].toUpperCase()+'</span></div>'; }).join("")+'</div>'
      +'<div class="la-skip">CLICK TO SKIP</div><div class="la-word"><b>Studium</b><span>A PHOTOGRAPHY STUDIO YOU WALK INTO</span></div>';
    document.body.appendChild(e);
    e.addEventListener("pointerdown",function(ev){ ev.stopPropagation(); laSkip(); });
    window.addEventListener("keydown",function(ev){ if(!LA.on) return; ev.stopImmediatePropagation(); ev.preventDefault(); if(!ev.repeat) laSkip(); },true);
    window.addEventListener("keyup",function(ev){ if(LA.on) ev.stopImmediatePropagation(); },true);
    return e; }
  function laPhase(p){ if(LA.phase===p) return; LA.phase=p; LA.pt=performance.now(); LA.log=(LA.log||[]).concat([p]); LA.held=false; if(LA.el){ LA.el.className="on p-"+p; } }
  function laHeld(){ if(!LA.hold) return false; if(!LA.held){ LA.held=true; LA.wait=true; } return LA.wait; }   /* tests: ?lahold parks each phase until __la.go() */
  function launchStart(after){ if(LA.on) return; LA.on=true; LA.after=after||null; LA.fast=laSeen(); LA.t0=performance.now(); LA.orbit=null; LA.skipAsked=false;
    var e=laEl(); LA.el=e; document.body.classList.add("launching"); laPhase("glow");
    ["hub","landing","studio","punctum","signin","teacher"].forEach(hubHide);
    if(!loaded){ var sc=(window.SPLAT_SCENES||[])[0]; if(sc){ App.go("landing"); loadBundled(sc); } }   /* the scan loads behind the glow */
    try{ localStorage.setItem(LA_KEY,"1"); }catch(x){}
    cancelAnimationFrame(LA.raf); LA.raf=requestAnimationFrame(laTick); }
  function laSkip(){ if(!LA.on) return; if(LA.phase==="orbit"||LA.phase==="strips"){ laEnd(); return; } LA.fast=true;   /* before the scene is in, skipping just drops the long bits */
    if(LA.phase==="glow"&&performance.now()-LA.t0<400) return; }
  /* the camera's path: start wide behind the subject's shoulder, close in while circling 1.6 turns, slow then fast */
  function laOrbitInit(){ var S=(CH.spec&&CH.spec.subject)||[0,0], a0=Math.atan2(camPos.x-S[0], camPos.z-S[1]);
    LA.orbit={S:S, a0:a0, gy:wkGround(S[0],S[1]), walk:!!(WK.col&&WK.mode==="walk")}; laOrbitAt(0); }
  function laOrbitAt(u){ var O=LA.orbit; if(!O) return; var s=Math.pow(u,2.4), a=O.a0+s*Math.PI*1.6, r=4.2-1.5*s, x=O.S[0]+Math.sin(a)*r, z=O.S[1]+Math.cos(a)*r, eye=1.7-0.5*s;
    _vel.set(0,0,0); camPos.x=x; camPos.z=z; var g=O.walk?wkGround(x,z):O.gy; if(O.walk) WK.eye=eye; camPos.y=g+eye;
    var ty=O.gy+0.45; yaw=Math.atan2(x-O.S[0], z-O.S[1]); pitch=Math.atan2(ty-camPos.y, r); if(typeof basis==="function") basis(); }
  function laTick(now){ if(!LA.on) return; LA.raf=requestAnimationFrame(laTick); var t=(now-LA.t0)/1000, p=LA.phase, pt=(now-(LA.pt||LA.t0))/1000, e=LA.el;
    if(p==="glow"){ if(t>(LA.fast?0.7:1.3)) laPhase("cube"); return; }
    if(p==="cube"){ if(loaded&&pt>(LA.fast?1.4:2.2)){ laOrbitInit(); if(typeof updateCamera==="function") updateCamera(0); laPhase("dive"); } if(t>2.5&&!LA.skipAsked){ LA.skipAsked=true; e.classList.add("skip"); } return; }
    if(p==="dive"){ if(pt>0.95){ if(LA.fast){ laEnd(); return; } laPhase("orbit"); } return; }
    if(p==="orbit"){ var u=Math.min(1,pt/3.2); laOrbitAt(u); if(u>=1&&laHeld()) return; if(u>=1){ laPhase("strips"); LA.strips=performance.now(); Array.prototype.forEach.call(e.querySelectorAll("video"),function(v){ try{ v.currentTime=0; v.play(); }catch(x){} }); } return; }
    if(p==="strips"){ laOrbitAt(1); if(pt>3.0&&!laHeld()) laEnd(); return; } }
  function laEnd(){ if(!LA.on) return; LA.on=false; cancelAnimationFrame(LA.raf); var e=LA.el; LA.welcome=Date.now();
    showHub(); if(e){ e.className="on out"; Array.prototype.forEach.call(e.querySelectorAll("video"),function(v){ try{ v.pause(); }catch(x){} }); setTimeout(function(){ e.className=""; document.body.classList.remove("launching"); },700); }
    else document.body.classList.remove("launching");
    if(LA.after) LA.after(); }
  LA.hold=/[?&]lahold/.test(location.search);
  if(/[?&]dev/.test(location.search)) window.__la={ start:launchStart, skip:laSkip, go:function(){ LA.wait=false; }, state:function(){ return {on:LA.on, phase:LA.phase, fast:LA.fast, loaded:loaded, log:LA.log||[]}; }, reset:function(){ try{ localStorage.removeItem(LA_KEY); }catch(e){} } };
