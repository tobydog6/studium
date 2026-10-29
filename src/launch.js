  // ================= LAUNCH: the opening =================
  // A film: a slow glide round the stump as the morning light comes up, the camera comes up on the 85 wide open, racks
  // focus onto the bark and fires; the photo holds a breath and the world pulls away from it in one big circle as the
  // wordmark lands. It was recorded from this same scan, frame by frame, at full quality (tools/openingfilm.mjs, using the
  // recorder at the bottom of this file), so it plays smoothly on any computer, tablet or phone: the device only has to
  // play a video. The real scan loads behind it, already standing on the starting spot, and the film's last frame is that
  // exact view, so it crossfades into the live scene. The focus marks, the wordmark and the sound are live over it, kept to
  // the film's clock. Any click or key skips to the end. It plays in full every time.
  var LA={on:false, t0:0, raf:0, phase:"", after:null, el:null, cam:null, hold:false};
  var LA_KEY="studium_launch_seen";
  var LA_FILM="asset:assets/launch/opening.mp4", LA_FILM_WEBM="asset:assets/launch/opening.webm";   /* H.264 plays nearly everywhere; VP9 for the browsers built without it */
  var LA_T={glide:9.0, scan:2.6, shoot:2.6, iris:0.9, spin:4.6, word:1.7};
  var LA_AP=1.4;   /* the shot wide open (the lens stops it at its widest) */
  var LA_F={glide:9.0, vf:9.05, rack:9.75, fire:11.3, spin:11.72, end:16.32, len:16.6};   /* the film's timeline, in seconds: recording and playback both keep to it */
  var LA_SW=[0,2.8];   /* how far out and up the circle swings at its widest, in metres: straight up, so it clears the trees and the edges of the scan */
  var LAG={on:false, e:1, w:0, s:1, c:1};   /* the recording's grade, read by renderFrame: exposure, warmth, saturation, contrast */
  function laSeen(){ try{ return localStorage.getItem(LA_KEY)==="1"; }catch(e){ return false; } }
  function laHolds(){ return typeof LA!=="undefined"&&!!LA&&!LA.on&&!!LA.welcome&&Date.now()-LA.welcome<LA_T.word*1000+800; }   /* from the handover until the wordmark has gone, nothing rebuilds the scan or changes its resolution */
  function laBehind(){ return typeof LA!=="undefined"&&!!LA&&LA.on&&!LA.warm; }   /* read by animate: the scan behind the film is drawn only now and then, so the device's effort goes on the film */
  function laEl(){ var e=$("launch"); if(e) return e; e=document.createElement("div"); e.id="launch"; e.setAttribute("data-nosnippet","");
    e.innerHTML='<video class="la-film" muted playsinline preload="auto" disablepictureinpicture disableremoteplayback aria-hidden="true"></video><div class="la-dark"><b>Studium</b></div>'
      +'<div class="la-vf" aria-hidden="true"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i><b></b></div>'
      +'<div class="la-word"><span class="la-kick">WELCOME TO</span><b>'+"Studium".split("").map(function(c,i){ return '<i style="--n:'+i+'">'+c+'</i>'; }).join("")+'</b><em></em><span class="la-tag">A PHOTOGRAPHY STUDIO FOR YEARS 11 TO 13</span></div><div class="la-skip">CLICK TO SKIP</div>';
    document.body.appendChild(e);
    try{ if(matchMedia("(pointer:coarse)").matches) e.querySelector(".la-skip").textContent="TAP TO SKIP"; }catch(x){}
    var v=e.querySelector("video"); v.muted=true; v.addEventListener("error",function(){ LA.filmBad=true; });
    e.addEventListener("pointerdown",function(ev){ ev.stopPropagation(); laSkip(); });
    window.addEventListener("keydown",function(ev){ if(!LA.on) return; ev.stopImmediatePropagation(); ev.preventDefault(); },true);   /* keys do nothing during the opening (they'd walk the camera behind it); only a click or tap on the screen skips */
    window.addEventListener("keyup",function(ev){ if(LA.on) ev.stopImmediatePropagation(); },true);
    return e; }
  function laPhase(p){ if(LA.phase===p) return; LA.phase=p; LA.pt=performance.now(); LA.log=(LA.log||[]).concat([p]); LA.held=false; if(LA.el){ var keep=["skip","word","vf","af-hunt","af-ok"].filter(function(c){ return LA.el.classList.contains(c); }); LA.el.className="on p-"+p+(keep.length?" "+keep.join(" "):""); } }
  function laCls(c,on){ if(LA.el&&LA.el.classList.contains(c)!==!!on) LA.el.classList.toggle(c,!!on); }
  function laHeld(){ if(!LA.hold) return false; if(!LA.held){ LA.held=true; if(LA.pass){ LA.pass=false; return false; } LA.wait=true; } return LA.wait; }   /* tests: ?lahold parks a phase until __la.go() */
  /* the film streams: the MP4 is laid out to start playing while the rest downloads, so it begins as soon as enough is in */
  function laFilmLoad(){ var v=LA.el.querySelector("video"), src=v.canPlayType('video/mp4; codecs="avc1.64002A"')||!LA_FILM_WEBM?LA_FILM:LA_FILM_WEBM;
    if(v.getAttribute("src")!==src||v.error){ v.src=src; try{ v.load(); }catch(e){} } }   /* a failed load is tried again on the next opening */
  function launchStart(after){ if(LA.on) return; LA.on=true; LA.after=after||null; LA.first=!laSeen(); LA.t0=performance.now(); LA.cam=null; LA.skipAsked=false; LA.log=[]; LA.placed=false; LA.looked=null; LA.warm=false; LA.warmT=null; LA.cued=false; LA.skipped=false; LA.filmBad=false; LA.asked=false; LA.playing=false; LA.prepped=false; LA.q0=null; LA.quality=null; LA.eye0=WK.eye; LAG.on=false; laWelClose(true); SD.seq=null;
    var e=laEl(); LA.el=e; e.className=""; document.body.classList.add("launching"); laPhase("dark");
    ["hub","landing","studio","punctum","signin","teacher"].forEach(hubHide);
    if(!loaded){ var sc=(window.SPLAT_SCENES||[])[0]; if(sc){ App.go("landing"); loadBundled(sc); } }   /* the scan loads behind the film */
    try{ localStorage.setItem(LA_KEY,"1"); }catch(x){}
    laFilmLoad(); sdAmbStart(); laSoundIn(); sdShutLoad(SD.ctx);
    cancelAnimationFrame(LA.raf); LA.raf=requestAnimationFrame(laTick); }
  function laSkip(){ if(!LA.on||LA.phase==="live") return; var v=LA.el.querySelector("video");
    if(LA.phase==="hold"){ if(loaded&&LA.placed) laLive(); else laEnd(); return; }   /* a tap while it waits: go now, or if the scan never came, out to the hub rather than stuck here */
    if(LA.skipped){ if(LA.phase==="dark") laEnd(); return; } LA.skipped=true; sdSeqCut(); sdBigCut(); if(SD.shB&&SD.ctx){ SD.shB.gain.setTargetAtTime(0,SD.ctx.currentTime,0.03); SD.shB=null; }
    if(LA.phase==="film"){ sdSpin(null,true); try{ v.pause(); v.currentTime=Math.max(0,(v.duration||LA_F.len)-0.02); }catch(e){} laCls("vf",false); laCls("af-hunt",false); laCls("af-ok",false); laCls("word",true); laPhase("hold"); } }   /* straight to the film's last frame and the wordmark; in the dark, it waits there for the scan */
  // ---- behind the film: the scan comes in on the starting spot, gets its light, and is drawn steadily for the last stretch ----
  function laBack(now){ if(!loaded) return false; if(!LA.placed){ LA.placed=true; LA.placeT=now; laSpawn(); if(typeof updateCamera==="function") updateCamera(0); }
    var det=!(CH.spec&&CH.spec.detail)||!!(viewer&&viewer.detail)||now-LA.placeT>9000; if(!det) return false;
    if(LA.phase==="film"){ if(!LA.prepped){ LA.prepped=true; if(typeof rbDefaultPrep==="function"&&CH.spec&&CH.spec.id==="stump") rbDefaultPrep(); } return false; }   /* while the film plays only the light's sums run, off the page's thread; the relight itself waits for the last frame */
    if(LA.looked==null){ LA.looked=!!(typeof rbDefaultOk==="function"&&CH.spec&&CH.spec.id==="stump"&&rbDefaultOk()); if(LA.looked) rbDefaultLook(); LA.lookT=now; }   /* the default look, once and for good */
    if(LA.looked&&!(RLB.built&&!RLB.dirty)&&now-LA.lookT<12000) return false;
    return true; }
  /* everything that makes a sound comes up from silence over three seconds as the opening starts, so nothing arrives at once */
  function laSoundIn(){ [typeof SFX!=="undefined"&&SFX.out, SD.out].forEach(function(o){ if(!o||!o.context) return; try{ var c=o.context, t=c.currentTime, v=Math.max(o.gain.value,0.0002); o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(0,t); o.gain.linearRampToValueAtTime(v,t+3); }catch(e){} }); }
  /* the sound, laid on the audio clock against the film's own: the day, the lens, the focus, the shutter, the circle */
  function laCue(vt){ if(LA.cued) return; LA.cued=true; var F=LA_F, a0=sdNow()-vt; if(!SD.ctx) return;
    if(vt<0.5) sdScan(a0); if(vt<F.vf) sdLensUp(a0+F.vf); if(vt<F.rack) sdRack(a0+F.rack,1.4);
    if(vt<F.fire) sdShutter(a0+F.fire);
    if(vt<F.spin) sdSpin(a0+F.spin,false); }
  // ---- the camera (the recording's moves) ----
  function laSubject(){ return (CH.spec&&CH.spec.subject)||[0,0]; }
  function laShotSpec(){ var s=CH.spec&&CH.spec.challenges, c=null; (s||[]).forEach(function(x){ if(x.id==="stump-dof") c=x; }); return c||{az:-75, dist:2.2, h:0.8, look:[0,0.3,0]}; }   /* the shallow-depth gold frame knows where the stump looks best */
  function laPlace(a,r,eye,look){ var S=laSubject(), L=look||[0,0.3,0], tx=S[0]+(L[0]||0), tz=S[1]+(L[2]||0), x=S[0]+Math.sin(a)*r, z=S[1]+Math.cos(a)*r, gy=wkGround(S[0],S[1]), walk=!!(WK.col&&WK.mode==="walk");
    _vel.set(0,0,0); camPos.x=x; camPos.z=z; var g=walk?wkGround(x,z):gy; if(walk) WK.eye=eye; camPos.y=g+eye;
    var ty=gy+(L[1]||0.3); yaw=Math.atan2(x-tx, z-tz); pitch=Math.atan2(ty-camPos.y, Math.hypot(x-tx,z-tz)); if(typeof basis==="function") basis(); LA.cam={a:a, r:r, eye:eye}; }
  function laCamInit(){ var c=laShotSpec(); LA.a0=c.az*Math.PI/180; LA.r0=c.dist; LA.h0=c.h; LA.look=c.look; }
  var laE=function(u){ return u<0?0:u>1?1:u*u*(3-2*u); };
  function laFov(v){ if(viewfinderOn||!camera) return; camera.fov=v; camera.updateProjectionMatrix(); }       /* a longer lens for the glide; the viewfinder sets its own */
  function laGlide(u){ var k=0.5-0.5*Math.cos(Math.PI*Math.min(1,Math.max(0,u))), L0=LA.look||[0,0.3,0], ly=(L0[1]||0.3)+0.08*(1-k);   /* one long, even arc round the stump: close enough to read the bark, easing out to where the shot is taken */
    laPlace(LA.a0-0.5+0.53*k, 1.6+(LA.r0-0.02-1.6)*k, 0.72+(LA.h0-0.01-0.72)*k, [L0[0],ly,L0[2]]); laFov(30-5*k); }
  function laShootCam(u){ laPlace(LA.a0+0.03+u*0.015, LA.r0-0.02-0.01*u, LA.h0-0.01, LA.look); if(!LA.vf) laFov(25); }              /* the camera comes up: all but still */
  // ---- the spin (recorded into the film): one big circle, landing exactly on the starting spot ----
  function laSpinStart(){ var sp=CH.spec&&CH.spec.spawn, S=laSubject(), walk=!!(WK.col&&WK.mode==="walk"); laVfOff(); laPhase("spin"); sdSpin(null,false);
    LA.fovA=LA.stillFov||(camera?camera.fov:null); LA.fovB=55;   /* the world under the photo starts at the photo's framing */
    var a0=LA.cam?LA.cam.a:Math.atan2(camPos.x-S[0], camPos.z-S[1]), r0=LA.cam?LA.cam.r:Math.hypot(camPos.x-S[0], camPos.z-S[1]), e0=LA.cam?LA.cam.eye:WK.eye;
    if(!sp){ LA.sp=null; LA.spinA=a0; LA.spinR=r0; LA.spinE=e0; LA.spinD=Math.PI*2; return; }
    var eye=sp[4]||1.65, aS=Math.atan2(sp[0]-S[0], sp[1]-S[1]), rS=Math.hypot(sp[0]-S[0], sp[1]-S[1]), d=aS-a0; d=Math.atan2(Math.sin(d),Math.cos(d)); if(d<0) d+=Math.PI*2;
    LA.sp=laSpawnT(); LA.spinA=a0; LA.spinR=r0; LA.spinE=e0; LA.spinD=d+Math.PI*2*(d>Math.PI*0.5?0:1); LA.spinRS=rS; }
  function laSpawnT(){ var sp=CH.spec&&CH.spec.spawn; if(!sp) return null; var walk=!!(WK.col&&WK.mode==="walk"), eye=sp[4]||1.65; if(!walk) eye=LA.eye0!=null?LA.eye0:WK.eye;
    return {x:sp[0], z:sp[1], yaw:sp[2]||0, pitch:sp[3]||-0.1, eye:eye, y:WK.col?wkGround(sp[0],sp[1])+eye:camPos.y}; }   /* exactly where the app's own start puts you */
  function laSpawn(){ var T=laSpawnT(); if(!T) return; _vel.set(0,0,0); camPos.x=T.x; camPos.y=T.y; camPos.z=T.z; yaw=T.yaw; pitch=T.pitch; if(WK.col&&WK.mode==="walk") WK.eye=T.eye; if(typeof basis==="function") basis(); laFov(55); }
  function laSpin(u){ var k=laE(u), T=LA.sp; if(LA.fovA){ laFov(LA.fovA+(LA.fovB-LA.fovA)*laE(Math.min(1,u/0.55))); }   /* the lens widens out as it swings round */ if(!T){ laPlace(LA.spinA+k*LA.spinD, LA.spinR, LA.spinE); return; }
    var sw=Math.sin(Math.PI*Math.min(1,k*1.15)); laPlace(LA.spinA+k*LA.spinD, LA.spinR+(LA.spinRS-LA.spinR)*k+sw*LA_SW[0], LA.spinE+(T.eye-LA.spinE)*k+sw*LA_SW[1]);   /* from close it swings out wide on the way round, looking at the stump all the way */
    var m=laE((u-0.72)/0.28); if(m<=0) return;   /* the last stretch eases onto the exact spot and the way it faces */
    var dy=T.yaw-yaw; dy=Math.atan2(Math.sin(dy),Math.cos(dy)); yaw+=dy*m; pitch+=(T.pitch-pitch)*m; camPos.x+=(T.x-camPos.x)*m; camPos.z+=(T.z-camPos.z)*m; camPos.y+=(T.y-camPos.y)*m; if(WK.col&&WK.mode==="walk") WK.eye+=(T.eye-WK.eye)*m; if(typeof basis==="function") basis(); }
  // ---- the shot (recorded into the film): the real viewfinder comes up on the 85, racks focus onto the bark, and fires ----
  function laVfOn(){ if(LA.vf) return; LA.vf=true; LA.ap=apIdx; LA.lens=lensIdx; var b=curBody(), li=b.lenses.indexOf(85); if(li>=0) selectLens(li);
    var bi=apIdx, bd=1e9; APERTURES.forEach(function(N,i){ var d=Math.abs(Math.log(N/LA_AP)); if(d<bd){ bd=d; bi=i; } }); apIdx=typeof apClamp==="function"?apClamp(bi):bi;
    computeCam(); setFocus(0.95); try{ raiseCamera(); }catch(e){} afPending=false; LA.fovTo=camera.fov; LA.fovFrom=25; }
  function laVfOff(){ if(!LA.vf) return; LA.vf=false; try{ lowerCamera(); }catch(e){} if(LA.ap!=null){ apIdx=LA.ap; computeCam(); } if(LA.lens!=null) selectLens(LA.lens); afPending=false; var el=$("vfAF"); if(el) el.classList.remove("hunt","ok"); }
  function laFocusTarget(){ var P=viewer&&viewer.P, A=viewer&&viewer.A; if(!P) return 0.5; if(typeof basis==="function") basis(); if(typeof updateCamera==="function") updateCamera(0); camera.updateMatrixWorld();   /* the camera's own autofocus: what's in the middle of the frame */
    var f=new THREE.Vector3(); camera.getWorldDirection(f); var o=camera.position, N=P.length/3, sc=typeof sceneScale==="function"?sceneScale():1, ts=[], st=N>600000?2:1;
    for(var i=0;i<N;i+=st){ if(A&&A[i]<0.12) continue; var vx=P[i*3]-o.x, vy=P[i*3+1]-o.y, vz=P[i*3+2]-o.z, t=vx*f.x+vy*f.y+vz*f.z; if(t<0.25*sc) continue; var p2=vx*vx+vy*vy+vz*vz-t*t, lim=t*0.026+0.01*sc; if(p2<lim*lim) ts.push(t); }
    ts.sort(function(x,y){ return x-y; }); if(ts.length<3){ var r=LA.cam?LA.cam.r:2.2; return Math.max(0,Math.min(1,Math.log(Math.max(0.3,r-0.4)/0.3)/Math.log(60))); }
    var m=ts[Math.min(ts.length-1,4)]/sc; return Math.log(Math.max(0.3,Math.min(18,m))/0.3)/Math.log(60); }
  function laRack(u){ var from=0.95, to=LA.focusTo!=null?LA.focusTo:0.5, el=$("vfAF"); if(u<=0){ if(el){ el.classList.remove("ok"); el.classList.add("hunt"); } return; }
    var v; if(u<0.72){ var k=laE(u/0.72); v=from+(to-0.045-from)*k; } else if(u<0.9){ v=to-0.045+0.065*laE((u-0.72)/0.18); } else v=to+0.02-0.02*laE((u-0.9)/0.1);   /* a long pull, a touch past, back onto it */
    setFocus(v); if(u>=1&&LA.focused<0) LA.focused=0; if(u>=1&&el&&!el.classList.contains("ok")){ el.classList.remove("hunt"); el.classList.add("ok"); } }
  // ---- the clock: the film's own time drives the marks and the wordmark ----
  function laTick(now){ if(!LA.on) return; LA.raf=requestAnimationFrame(laTick); var t=(now-LA.t0)/1000, p=LA.phase, e=LA.el, v=e.querySelector("video"), F=LA_F, back=laBack(now);
    if(t>2.5&&!LA.skipAsked){ LA.skipAsked=true; laCls("skip",true); }
    if(LA.warm&&back&&LA.warmT==null) LA.warmT=now;
    if(t>90&&!loaded){ laEnd(); return; }   /* the scan never came: out to the hub, where loading says what went wrong */
    if(p==="dark"){ if(LA.filmBad||(t>25&&!LA.playing)){ LA.warm=true; laCls("word",true); if(back&&LA.warmT!=null&&now-LA.warmT>700) laLive(); return; }   /* no film, or far too slow to arrive: the wordmark over the live scene once it's in */
      if(t<0.6) return;
      if(!LA.asked){ LA.asked=true; try{ v.currentTime=0; }catch(x){} var pr=v.play(); if(pr&&pr.catch) pr.catch(function(){ if(LA.on&&LA.phase==="dark"&&!LA.skipped) LA.filmBad=true; }); }   /* asked straight away: phones only fetch a film once it is asked to play */
      if(v.paused||v.currentTime<=0||v.readyState<3) return; LA.playing=true;
      if(LA.skipped){ try{ v.pause(); v.currentTime=Math.max(0,(v.duration||F.len)-0.02); }catch(x){} laCls("word",true); laPhase("hold"); return; }
      var q=v.getVideoPlaybackQuality&&v.getVideoPlaybackQuality(); LA.q0=q?[q.droppedVideoFrames,q.totalVideoFrames]:null; laPhase("film"); return; }
    if(p==="film"){ var vt=v.currentTime; if(!LA.cued&&vt>0&&!v.paused) laCue(vt);
      laCls("vf",vt>=F.vf&&vt<F.fire+0.06); laCls("af-hunt",vt>=F.rack&&vt<F.rack+1.4); laCls("af-ok",vt>=F.rack+1.4&&vt<F.fire+0.06); laCls("word",vt>=F.spin);
      if(v.ended||vt>=F.len-0.04) laPhase("hold"); return; }
    if(p==="hold"){ LA.warm=true; laCls("word",true); if(back&&LA.warmT!=null&&now-LA.warmT>700&&!laHeld()) laLive(); } }   /* the last frame waits for the scan, if it isn't in yet */
  /* the handover: the film's last frame is this exact view, so the video simply fades off the live scene */
  function laLive(){ laPhase("live"); laCls("vf",false); laCls("af-hunt",false); laCls("af-ok",false); laCls("word",true); laSpawn(); laFovMatch(); laEnd(); }
  /* the film fills the screen edge to edge: on a screen wider than it, the top and bottom are cut, so the live view starts
     at that same tighter framing and eases out to the walking lens */
  function laFovMatch(){ var v=LA.el&&LA.el.querySelector("video"), Av=v&&v.videoWidth?v.videoWidth/v.videoHeight:16/9, As=innerWidth/innerHeight; if(!camera||As<=Av+0.01) return;
    var f0=2*Math.atan(Math.tan(55*Math.PI/360)*Av/As)*180/Math.PI, t0=performance.now(); camera.fov=f0; camera.updateProjectionMatrix();
    (function ease(){ if(viewfinderOn) return; var k=laE((performance.now()-t0)/1600); camera.fov=f0+(55-f0)*k; camera.updateProjectionMatrix(); if(k<1) requestAnimationFrame(ease); })(); }   /* holds its course even if the meter resets the lens mid-way */
  function laEnd(){ if(!LA.on) return; LA.on=false; LAG.on=false; LA.warm=false; LA.starting=false; cancelAnimationFrame(LA.raf); var e=LA.el;
    try{ var fv=e.querySelector("video"), q=fv.getVideoPlaybackQuality(); if(LA.q0){ LA.quality={dropped:q.droppedVideoFrames-LA.q0[0], total:q.totalVideoFrames-LA.q0[1]}; console.info("opening film: "+LA.quality.dropped+" of "+LA.quality.total+" frames dropped"); } }catch(x){}   /* how smoothly it played here: F9 shows it too */ LA.welcome=Date.now(); (CH.pads||[]).forEach(function(P){ P.vis=0; });   /* the gold frames fade in once the wordmark has gone */
    if(typeof RLB!=="undefined"&&RLB) RLB.camP={x:camPos.x,y:camPos.y,z:camPos.z};   /* the light counts its next metre and a half from the starting spot */
    if(loaded){ hubShow("hud"); App.go("scene"); if(typeof updatePrompt==="function") updatePrompt(); } else showHub();
    sdAmbStop(sdNow()+1.6,1.2); if(LA.first&&loaded) LA.wcard=true;   /* first time: hold the tour and the gold frames for the welcome */
    if(e){ e.classList.add("out"); setTimeout(function(){ if(LA.on) return; e.className=""; try{ e.querySelector("video").pause(); }catch(x){} document.body.classList.remove("launching"); if(LA.wcard) laWelOpen(); },LA_T.word*1000); } else document.body.classList.remove("launching");
    if(LA.after) LA.after(); }
  // ---- the sound: all synthesised, scheduled on the audio clock so it keeps time even when frames drop ----
  /* every cue takes an absolute audio time t, so __ls.render() can lay the whole opening into an offline buffer to check */
  var SD={ctx:null, out:null, nb:null, verb:null, seq:null, amb:null, drone:null};
  function sdWire(c){ if(SD.ctx===c) return c; SD.ctx=c; SD.seq=null; SD.amb=null;
    var comp=c.createDynamicsCompressor(); comp.threshold.value=-16; comp.ratio.value=3; comp.attack.value=0.004; comp.release.value=0.2; comp.connect(c.destination);
    SD.out=c.createGain(); SD.out.gain.value=SD.off?1.0:Math.max(sfxVol(),0.0001); SD.out.connect(comp);
    var sr=c.sampleRate, len=sr*2, b=c.createBuffer(2,len,sr), ch, i, d; for(ch=0;ch<2;ch++){ d=b.getChannelData(ch); for(i=0;i<len;i++) d[i]=Math.random()*2-1; } SD.nb=b;
    var rl=Math.floor(sr*2.6), ir=c.createBuffer(2,rl,sr); for(ch=0;ch<2;ch++){ d=ir.getChannelData(ch); for(i=0;i<rl;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/rl,3.4); }   /* a soft dark room */
    SD.verb=c.createConvolver(); SD.verb.buffer=ir; var vl=c.createBiquadFilter(); vl.type="lowpass"; vl.frequency.value=4200; var vg=c.createGain(); vg.gain.value=0.32; SD.verb.connect(vl); vl.connect(vg); vg.connect(SD.out); return c; }
  function sdCtx(){ if(SD.off) return SD.ctx; if(typeof soundOn!=="undefined"&&!soundOn) return null;
    try{ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==="suspended") audioCtx.resume(); }catch(e){ return null; } return sdWire(audioCtx); }
  function sdNow(){ return SD.ctx?SD.ctx.currentTime:0; }
  function sdBus(send){ var c=SD.ctx, g=c.createGain(); g.connect(SD.out); if(send){ var s=c.createGain(); s.gain.value=send; g.connect(s); s.connect(SD.verb); } return g; }
  function sdSeq(){ if(!sdCtx()) return null; if(!SD.seq) SD.seq=sdBus(0.55); return SD.seq; }
  function sdSeqCut(){ if(!SD.seq||!SD.ctx) return; var s=SD.seq; SD.seq=null; s.gain.setTargetAtTime(0,SD.ctx.currentTime,0.05); setTimeout(function(){ try{ s.disconnect(); }catch(e){} },2000); }
  function sdBigCut(){ if(!SD.big||!SD.ctx) return; var b=SD.big; SD.big=null; b.gain.setTargetAtTime(0,SD.ctx.currentTime,0.05); setTimeout(function(){ try{ b.disconnect(); }catch(e){} },1500); }   /* a skip: the circle's sound, already laid on the clock, goes too */
  function sdEnv(g,t,a,peak,hold,r){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(peak,0.0002),t+a); g.gain.setValueAtTime(Math.max(peak,0.0002),t+a+hold); g.gain.exponentialRampToValueAtTime(0.0001,t+a+hold+r); }
  function sdOut(node,bus,pan,pan2,t,dur){ if(pan==null||!SD.ctx.createStereoPanner){ node.connect(bus); return; } var p=SD.ctx.createStereoPanner(); p.pan.setValueAtTime(pan,t); if(pan2!=null) p.pan.linearRampToValueAtTime(pan2,t+dur); node.connect(p); p.connect(bus); }
  function sdTone(bus,t,f,type,a,peak,hold,r,f2,pan){ var c=SD.ctx, o=c.createOscillator(), g=c.createGain(), T=a+hold+r; o.type=type||"sine"; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+T); sdEnv(g,t,a,peak,hold,r); o.connect(g); sdOut(g,bus,pan,null,t,T); o.start(t); o.stop(t+T+0.05); return o; }
  function sdNoise(bus,t,ft,f,q,a,peak,hold,r,f2,pan,pan2){ var c=SD.ctx, s=c.createBufferSource(), fl=c.createBiquadFilter(), g=c.createGain(), T=a+hold+r; s.buffer=SD.nb; s.loop=true; fl.type=ft; fl.frequency.setValueAtTime(f,t); if(f2) fl.frequency.exponentialRampToValueAtTime(f2,t+T); fl.Q.value=q||0.7; sdEnv(g,t,a,peak,hold,r); s.connect(fl); fl.connect(g); sdOut(g,bus,pan,pan2,t,T); s.start(t,Math.random()*1.5); s.stop(t+T+0.05); return fl; }
  function sdTick(bus,t,f,peak,pan){ sdNoise(bus,t,"bandpass",f,7,0.001,peak,0.003,0.028,null,pan); }
  // the bed: dark air and a low drone on A, breathing, under the whole opening
  function sdAmbStart(t){ var c=sdCtx(); if(!c||SD.amb) return; t=t==null?sdNow():t; if(sdVar("bed")) return sdVar("bed")(c,t); var bus=c.createGain(); bus.gain.setValueAtTime(0.0001,t); bus.gain.exponentialRampToValueAtTime(1,t+1.6); bus.connect(SD.out); SD.amb=bus;
    var s=c.createBufferSource(); s.buffer=SD.nb; s.loop=true; var lp=c.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=420; lp.Q.value=0.5; var hp=c.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=90; var g=c.createGain(); g.gain.value=0.02; s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(bus); s.start(t);
    SD.drone=[[55,"sine",0.034,0.012],[82.41,"sine",0.02,0.009],[110,"triangle",0.007,0.004]].map(function(v,i){ var o=c.createOscillator(), og=c.createGain(), lfo=c.createOscillator(), lg=c.createGain();
      o.type=v[1]; o.frequency.setValueAtTime(v[0],t); o.detune.value=(i-1)*5; og.gain.value=v[2]; lfo.frequency.value=0.07+i*0.045; lg.gain.value=v[3]; lfo.connect(lg); lg.connect(og.gain); o.connect(og); og.connect(bus); o.start(t); lfo.start(t); return o; });
    SD.ambSrc=[s].concat(SD.drone); }
  function sdDroneTo(k,t,tc){ if(!SD.drone) return; SD.drone.forEach(function(o,i){ o.frequency.setTargetAtTime([55,82.41,110][i]*k,t,tc); }); }
  function sdAmbStop(t,tc){ if(!SD.amb||!SD.ctx) return; var b=SD.amb, src=SD.ambSrc||[]; SD.amb=null; SD.drone=null; t=t==null?sdNow():t; b.gain.setTargetAtTime(0.0001,t,tc||1.2); src.forEach(function(o){ try{ o.stop(t+(tc||1.2)*6); }catch(e){} }); }
  // the point cloud: a shimmer rising with the line, a pad lifting a fifth, points settling as ticks, a glint when it resolves
  function sdScan(t){ var b=sdSeq(); if(!b) return; t=t==null?sdNow():t; if(sdVar("scan")) return sdVar("scan")(b,t,LA_T.scan); var D=LA_T.scan;
    sdNoise(b,t,"bandpass",420,3.5,0.7,0.065,D-1.0,1.0,5400);
    sdTone(b,t,220,"sine",0.9,0.026,D-1.3,1.8,329.6); sdTone(b,t,329.6,"sine",1.1,0.013,D-1.3,1.8,494);
    for(var i=0;i<52;i++){ var u=i/52; sdTick(b,t+D*Math.pow(u,0.8)+Math.random()*0.05,2200+u*5200+Math.random()*1400,0.045*(1-u*0.55)+0.008,(Math.random()*2-1)*0.85); }
    sdTone(b,t+D-0.05,1318.5,"sine",0.004,0.022,0.02,1.1); sdTone(b,t+D-0.03,1975.5,"sine",0.004,0.01,0.02,0.9); }
  // the camera coming up: cloth and air, the lens motor waking, it seats with a click
  function sdLensUp(t){ var b=sdSeq(); if(!b) return; t=t==null?sdNow():t; if(sdVar("lens")) return sdVar("lens")(b,t);
    sdNoise(b,t,"bandpass",600,0.9,0.08,0.03,0.08,0.3,1600,-0.2,0.2);   /* the camera lifting: cloth and air */
    sdTick(b,t+0.5,1500,0.05); sdTick(b,t+0.54,3000,0.03); }            /* it seats */
  // focus: the ring turning, quiet little detents speeding up and settling, then the two-tone confirm
  function sdRack(t,D){ var b=sdSeq(); if(!b) return; t=t==null?sdNow():t; if(sdVar("rack")) return sdVar("rack")(b,t,D);
    for(var i=0;i<16;i++){ var u=i/16, at=t+D*0.85*(1-Math.pow(1-u,1.7)); sdTick(b,at,3800+u*900,0.014+0.008*Math.sin(u*Math.PI),(u-0.5)*0.3); }
    sdTone(b,t+D,2730,"sine",0.003,0.04,0.045,0.03); sdTone(b,t+D+0.1,2730,"sine",0.003,0.04,0.045,0.05); }
  // ---- the shutter: five to choose from (?shut=1..5, or localStorage studium_open_shut); all on the audio clock ----
  var SD_SHN=["","Mirrorless","DSLR","Film SLR and wind-on","Rangefinder","Recorded"];
  var SD_SH=(function(){ var m=/[?&]shut=(\d+)/.exec(location.search); if(m) return +m[1]; try{ var v=localStorage.getItem("studium_open_shut"); if(v!=null) return +v; }catch(e){} return 5; })();   /* the recording is the default */
  function sdClk(b,t,f,q,peak,dec,pan){ var c=SD.ctx, s=c.createBufferSource(), fl=c.createBiquadFilter(), g=c.createGain(); s.buffer=SD.nb; fl.type="bandpass"; fl.frequency.value=f; fl.Q.value=q;   /* a mechanical click: a short burst of noise, shaped by the body it rings in */
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+0.0012); g.gain.exponentialRampToValueAtTime(0.0001,t+0.0012+dec); s.connect(fl); fl.connect(g); sdOut(g,b,pan,null,t,dec); s.start(t,Math.random()*1.5); s.stop(t+dec+0.02); }
  function sdBody(b,t,f,peak,dec){ sdTone(b,t,f,"sine",0.0015,peak,0.002,dec,f*0.92); }   /* the camera body's short ring */
  var SD_SHUT={
    1:function(b,t){ sdClk(b,t,3200,1.6,0.26,0.014,-0.05); sdClk(b,t,7200,2.2,0.09,0.008); sdBody(b,t,1150,0.035,0.03);   /* first curtain */
        sdClk(b,t+0.027,2900,1.6,0.2,0.016,0.05); sdClk(b,t+0.027,6600,2.2,0.07,0.008); sdBody(b,t+0.027,980,0.03,0.035); },   /* second curtain: crisp, modern, no mirror */
    2:function(b,t){ sdClk(b,t,1700,1.1,0.32,0.028); sdClk(b,t+0.002,3600,1.8,0.14,0.016); sdBody(b,t,190,0.11,0.06); sdBody(b,t,620,0.04,0.04);   /* the mirror flips up and the shutter fires */
        sdClk(b,t+0.072,2100,1.2,0.24,0.024,0.05); sdClk(b,t+0.073,4300,1.8,0.1,0.014); sdBody(b,t+0.072,150,0.08,0.07); },   /* and drops back: the clack-clack of a DSLR */
    3:function(b,t){ SD_SHUT[2](b,t); var c=SD.ctx, w=t+0.2, D=0.34, o=c.createOscillator(), fl=c.createBiquadFilter(), g=c.createGain(), am=c.createOscillator(), ag=c.createGain();   /* then the motor winds on */
        o.type="sawtooth"; o.frequency.setValueAtTime(88,w); o.frequency.linearRampToValueAtTime(104,w+D*0.7); o.frequency.linearRampToValueAtTime(70,w+D); fl.type="bandpass"; fl.frequency.value=1100; fl.Q.value=2.4;
        am.frequency.value=34; ag.gain.value=0.45; am.connect(ag); ag.connect(g.gain); g.gain.setValueAtTime(0.0001,w); g.gain.exponentialRampToValueAtTime(0.05,w+0.03); g.gain.setValueAtTime(0.05,w+D-0.06); g.gain.exponentialRampToValueAtTime(0.0001,w+D);
        o.connect(fl); fl.connect(g); g.connect(b); o.start(w); am.start(w); o.stop(w+D+0.02); am.stop(w+D+0.02); sdClk(b,w+D-0.01,2600,1.6,0.12,0.012); },
    4:function(b,t){ sdClk(b,t,4800,1.4,0.12,0.009); sdClk(b,t+0.011,4200,1.4,0.07,0.009); sdBody(b,t,1800,0.012,0.02); },   /* a rangefinder's quiet tsk */
    5:function(b,t){ var buf=SD.shBuf; if(!buf){ SD_SHUT[2](b,t); return; } var s=SD.ctx.createBufferSource(), g=SD.ctx.createGain(); s.buffer=buf; g.gain.value=0.75; s.connect(g); g.connect(b); s.start(t); } };   /* the recording the camera itself uses */
  function sdShutLoad(c){ if(SD.shBuf||!c||SD.shGet) return SD.shGet; SD.shGet=fetch(SHUTTER_SRC[0]).then(function(r){ return r.arrayBuffer(); }).then(function(ab){ return new Promise(function(ok,no){ c.decodeAudioData(ab,ok,no); }); }).then(function(bf){ SD.shBuf=bf; }).catch(function(){}); return SD.shGet; }
  function sdShutter(t){ var c=sdCtx(); if(!c) return; t=t==null?sdNow():t; var b=SD.shB&&SD.shB.context===c?SD.shB:(SD.shB=sdBus(0.22)); (SD_SHUT[SD_SH]||SD_SHUT[2])(b,t);   /* its own bus: a little room, not the music's big one */
    if(SD.drone){ sdDroneTo(1,t,0.05); } if(SD.vb){ SD.vb.gain.setTargetAtTime(0.0001,t+0.01,0.06); SD.vb=null; } if(sdVar("shot")) sdVar("shot")(sdSeq()||b,t); }
  // ---- the soundtrack options (?snd=0..11, or localStorage studium_open_snd): each brings its bed, the film's start, the lens,
  //      the focus and the shot; 6 to 11 also their own title moment. tools/openingsound.mjs lays each under the film to compare ----
  var SD_V=(function(){ var m=/[?&]snd=(\d+)/.exec(location.search); if(m) return +m[1]; try{ var v=localStorage.getItem("studium_open_snd"); if(v!=null) return +v; }catch(e){} return 3; })();   /* Strings is the default; ?snd=0..11 to compare */
  var SD_VN=["As it is","Felt","Air","Strings","Pulse","Glass","Cinematic","Lo-fi","Deep drone","Electronic","Bush","Piano and cello"];
  function sdVar(k){ var v=SDV[SD_V]; return v&&v[k]||null; }
  function sdVBus(c,t,send){ var b=c.createGain(); b.gain.value=1; b.connect(SD.out); if(send){ var s=c.createGain(); s.gain.value=send; b.connect(s); s.connect(SD.verb); } SD.vb=b; return b; }   /* the beginning's own music: the shutter cuts it */
  function sdAir(c,bus,t,g0,lpf){ var s=c.createBufferSource(); s.buffer=SD.nb; s.loop=true; var lp=c.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=lpf||500; var hp=c.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=120; var g=c.createGain(); g.gain.value=g0;
    var lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=0.11; lg.gain.value=g0*0.6; lfo.connect(lg); lg.connect(g.gain); s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(bus); s.start(t); lfo.start(t); return [s,lfo]; }
  function sdBedBus(c,t){ var bus=c.createGain(); bus.gain.setValueAtTime(0,t); bus.gain.linearRampToValueAtTime(1,t+6);   /* fades in slowly, so the air never arrives at once */ bus.connect(SD.out); SD.amb=bus; SD.drone=null; return bus; }
  function sdBell(b,t,f,peak,pan,dec){ sdTone(b,t,f,"sine",0.003,peak,0.01,dec||1.6,null,pan); sdTone(b,t,f*2.76,"sine",0.002,peak*0.28,0.005,(dec||1.6)*0.4,null,pan); }
  var SD_PENTA=[440,493.88,554.37,659.25,739.99,880,987.77,1108.73,1318.51,1479.98,1760,1975.53,2217.46,2637.02];
  var SDV={
    /* 1 · Felt: the beginning played on a felt piano, the same voice as the title chord */
    1:{ bed:function(c,t){ var bus=sdBedBus(c,t); SD.ambSrc=sdAir(c,bus,t,0.012,380); var vb=sdVBus(c,t,1.1); sdFelt(vb,t+0.7,220,0.07,-0.1); sdFelt(vb,t+0.72,110,0.05,0.1); },
        scan:function(b,t,D){ var vb=SD.vb||b, n=[220,277.18,329.63,440,554.37,659.25,880,1108.73,1318.51]; n.forEach(function(f,i){ sdFelt(vb,t+D*Math.pow(i/n.length,0.9),f,0.06-i*0.003,-0.6+i*0.15); });
          sdTone(vb,t,110,"triangle",1.2,0.03,D,2,null); sdTone(vb,t,164.81,"sine",1.4,0.02,D,2,null); sdFelt(vb,t+D,1318.51,0.04,0.2); sdFelt(vb,t+D+0.02,1661.22,0.03,-0.2); },
        lens:function(b,t){ sdNoise(b,t,"bandpass",600,0.9,0.08,0.02,0.08,0.3,1600); sdFelt(SD.vb||b,t+0.1,329.63,0.04,0); },
        rack:function(b,t,D){ for(var i=0;i<10;i++) sdTick(b,t+D*0.85*(1-Math.pow(1-i/10,1.7)),3600,0.01); sdFelt(SD.vb||b,t+D,659.25,0.05,-0.1); sdFelt(SD.vb||b,t+D+0.12,880,0.05,0.1); } },
    /* 2 · Air: no music. A park: wind in the trees, a few birds far off, and the camera, close and real */
    2:{ bed:function(c,t){ var bus=sdBedBus(c,t); var a=sdAir(c,bus,t,0.02,700), w=sdAir(c,bus,t,0.008,2400);   /* the air under the opening, kept low */ SD.ambSrc=a.concat(w); },
        scan:function(b,t,D){ sdDay(b,t,LA_T.glide+2.3); },
        lens:function(b,t){ sdNoise(b,t,"bandpass",500,0.8,0.1,0.1,0.12,0.35,1400,-0.3,0.2); sdNoise(b,t+0.3,"bandpass",1200,1.2,0.02,0.03,0.05,0.12,null,0.2); sdTick(b,t+0.52,1400,0.08); sdTick(b,t+0.56,2900,0.05); },
        rack:function(b,t,D){ var c=SD.ctx, o=c.createOscillator(), fl=c.createBiquadFilter(), g=c.createGain(); o.type="sawtooth"; o.frequency.setValueAtTime(420,t); o.frequency.linearRampToValueAtTime(560,t+D*0.8); fl.type="bandpass"; fl.frequency.value=5200; fl.Q.value=3; sdEnv(g,t,0.05,0.02,D*0.75,0.08); o.connect(fl); fl.connect(g); g.connect(b); o.start(t); o.stop(t+D+0.2);
          sdTone(b,t+D,2730,"sine",0.003,0.04,0.045,0.03); sdTone(b,t+D+0.1,2730,"sine",0.003,0.04,0.045,0.05); } },
    /* 3 · Strings: a low string swell builds from nothing, opening up toward the shot; the shutter cuts it dead */
    3:{ bed:function(c,t){ var bus=sdBedBus(c,t); SD.ambSrc=sdAir(c,bus,t,0.01,400); var vb=sdVBus(c,t,0.9), lp=c.createBiquadFilter(); lp.type="lowpass"; lp.Q.value=0.5; lp.frequency.setValueAtTime(260,t); lp.frequency.exponentialRampToValueAtTime(2400,t+8.5); lp.connect(vb);
          [[55,0.05,0],[110,0.035,1.2],[164.81,0.028,2.6],[220,0.02,4.2],[277.18,0.016,5.6],[329.63,0.013,6.6]].forEach(function(v,i){ [-6,6].forEach(function(dt){ var o=c.createOscillator(), g=c.createGain(), vib=c.createOscillator(), vg=c.createGain(); o.type="sawtooth"; o.frequency.value=v[0]; o.detune.value=dt; vib.frequency.value=4.6+i*0.3; vg.gain.value=v[0]*0.004; vib.connect(vg); vg.connect(o.frequency);
            g.gain.setValueAtTime(0.0001,t+v[2]); g.gain.exponentialRampToValueAtTime(v[1],t+v[2]+2.4); o.connect(g); g.connect(lp); o.start(t+v[2]); vib.start(t+v[2]); o.stop(t+16); vib.stop(t+16); }); }); },
        scan:function(b,t,D){ var vb=SD.vb||b; sdTone(vb,t+0.4,1318.51,"sine",1.4,0.012,D,1.6,null,0.3); sdNoise(b,t,"highpass",2500,0.7,1.2,0.012,D-1.4,1.0,8000); },
        lens:function(b,t){ sdNoise(b,t,"bandpass",600,0.9,0.08,0.025,0.08,0.3,1600); sdTick(b,t+0.5,1500,0.04); },
        rack:function(b,t,D){ for(var i=0;i<12;i++) sdTick(b,t+D*0.85*(1-Math.pow(1-i/12,1.7)),3800,0.012); sdTone(b,t+D,2730,"sine",0.003,0.035,0.045,0.03); sdTone(b,t+D+0.1,2730,"sine",0.003,0.035,0.045,0.05); },
        shot:function(b,t){ sdNoise(b,t+0.02,"lowpass",3000,0.7,0.002,0.06,0.02,1.4,300); } },
    /* 4 · Pulse: a slow low heartbeat that quickens toward the shot, glass notes as the points resolve; the shutter stops it */
    4:{ bed:function(c,t){ var bus=sdBedBus(c,t); SD.ambSrc=sdAir(c,bus,t,0.014,380); var vb=sdVBus(c,t,0.3), bt=t+0.9, gap=1.05;
          for(var i=0;i<14;i++){ sdTone(vb,bt,62,"sine",0.006,0.16,0.04,0.26,40); sdTone(vb,bt+0.2,58,"sine",0.006,0.09,0.03,0.22,38); bt+=gap; gap=Math.max(0.6,gap*0.95); } },
        scan:function(b,t,D){ var n=[440,659.25,554.37,880,739.99,1108.73,987.77,1318.51]; n.forEach(function(f,i){ sdBell(b,t+0.2+D*0.95*(i/n.length),f,0.03,(i%2?0.5:-0.5),2.2); }); },
        lens:function(b,t){ sdNoise(b,t,"bandpass",600,0.9,0.08,0.025,0.08,0.3,1600); sdTick(b,t+0.5,1500,0.045); },
        rack:function(b,t,D){ for(var i=0;i<12;i++) sdTick(b,t+D*0.85*(1-Math.pow(1-i/12,1.7)),3800,0.012); sdTone(b,t+D,2730,"sine",0.003,0.035,0.045,0.03); sdTone(b,t+D+0.1,2730,"sine",0.003,0.035,0.045,0.05); } },
    /* 5 · Glass: the point cloud as hundreds of tiny glass notes, a reversed swell, a bright chime when the stump resolves */
    5:{ bed:function(c,t){ var bus=sdBedBus(c,t); SD.ambSrc=sdAir(c,bus,t,0.01,400); var vb=sdVBus(c,t,1.2);
          [[880,0.016],[1318.51,0.01]].forEach(function(v){ var o=c.createOscillator(), g=c.createGain(), tr=c.createOscillator(), tg=c.createGain(); o.frequency.value=v[0]; tr.frequency.value=5.5; tg.gain.value=v[1]*0.5; tr.connect(tg); tg.connect(g.gain); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v[1],t+2); o.connect(g); g.connect(vb); o.start(t); tr.start(t); o.stop(t+16); tr.stop(t+16); }); },
        scan:function(b,t,D){ var vb=SD.vb||b; for(var i=0;i<70;i++){ var u=i/70, f=SD_PENTA[Math.floor(Math.random()*SD_PENTA.length)]*(u>0.6?2:1); sdTone(vb,t+D*Math.pow(u,0.75)+Math.random()*0.06,f,"sine",0.002,0.03+0.02*(1-u),0.005,0.35,null,(Math.random()*2-1)*0.9); }
          sdNoise(vb,t+D-1.1,"highpass",1500,0.7,1.05,0.04,0.01,0.04,9000); [1760,2217.46,2637.02,3951.07].forEach(function(f,i){ sdBell(vb,t+D+i*0.03,f,0.05,(i-1.5)*0.4,2.6); }); },
        lens:function(b,t){ sdNoise(b,t,"bandpass",600,0.9,0.08,0.02,0.08,0.3,1600); sdBell(SD.vb||b,t+0.5,2637.02,0.012,0,0.8); },
        rack:function(b,t,D){ for(var i=0;i<12;i++) sdTone(b,t+D*0.85*(1-Math.pow(1-i/12,1.7)),3520+i*40,"sine",0.001,0.016,0.002,0.04); sdBell(b,t+D,1760,0.05,-0.2,1.2); sdBell(b,t+D+0.11,2637.02,0.05,0.2,1.4); } },
    /* 6 · Cinematic: a low drone and a slow brass swell building under the glide, low drums gathering pace toward the shot;
       the shutter cuts it all to silence, then a trailer "braam" lands with the title */
    6:{ bed:function(c,t){ var bus=sdBedBus(c,t); SD.ambSrc=sdAir(c,bus,t,0.008,300); },
        scan:function(b,t){ var c=SD.ctx, F=LA_F, vb=sdVBus(c,t,0.9); sdDrone(vb,t,[55,82.41],F.fire+1,0.05,240,700);
          sdPad(vb,t+1.5,[110,130.81,164.81,220],F.fire-1.5,0.022,260,2600);   /* A minor, opening up */
          var at=t+4.2, gap=1.3; while(at<t+F.fire-0.25){ sdTom(vb,at,0.22*(0.5+0.5*(at-t)/F.fire)); at+=gap; gap=Math.max(0.32,gap*0.86); }   /* the drums gather pace */
          sdNoise(vb,t+F.fire-2.2,"highpass",1200,0.7,2.1,0.05,0.02,0.05,9000); },   /* a riser into the shot */
        lens:function(b,t){ sdNoise(b,t,"bandpass",600,0.9,0.08,0.02,0.08,0.3,1600); },
        rack:function(b,t,D){ for(var i=0;i<10;i++) sdTick(b,t+D*0.85*(1-Math.pow(1-i/10,1.7)),3600,0.01); },
        spin:function(b,t){ var w=t+0.7; sdNoise(b,t+0.15,"highpass",900,0.7,0.55,0.07,0.01,0.03,8000);   /* breath in */
          [55,82.41,110,164.81].forEach(function(f,i){ var c=SD.ctx, o=c.createOscillator(), o2=c.createOscillator(), lp=c.createBiquadFilter(), g=c.createGain(); o.type=o2.type="sawtooth"; o.frequency.value=f; o2.frequency.value=f*1.004;
            lp.type="lowpass"; lp.frequency.setValueAtTime(180,w); lp.frequency.exponentialRampToValueAtTime(2200,w+0.25); lp.frequency.exponentialRampToValueAtTime(260,w+4.5); sdEnv(g,w,0.03,[0.11,0.09,0.06,0.035][i],0.4,4.2);
            o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(b); o.start(w); o2.start(w); o.stop(w+5); o2.stop(w+5); });   /* the braam */
          sdTone(b,w,48,"sine",0.01,0.35,0.2,3,28); sdNoise(b,w,"lowpass",3000,0.7,0.004,0.12,0.03,1.6,200); } },
    /* 7 · Lo-fi: warm electric piano chords, vinyl crackle, a lazy boom-bap; the shot is a tape stop, the title a soft chord */
    7:{ bed:function(c,t){ var bus=sdBedBus(c,t); SD.ambSrc=sdAir(c,bus,t,0.006,500); },
        scan:function(b,t){ var c=SD.ctx, F=LA_F, vb=sdVBus(c,t,0.35), B=F.fire/24, i;   /* 24 beats to the shot */
          for(i=0;i<Math.floor(F.len*7);i++) sdTick(vb,t+Math.random()*F.len,1800+Math.random()*4000,0.006+Math.random()*0.01,(Math.random()*2-1)*0.5);   /* crackle */
          sdNoise(vb,t,"bandpass",2500,0.4,1,0.006,F.fire,0.3);   /* hiss */
          var ch=[[62,66,69,73],[61,64,68,71],[59,62,66,69],[64,68,71,74],[62,66,69,73],[61,64,68,71]];   /* Dmaj7 C#m7 Bm7 E7(9) Dmaj7 C#m7 */
          ch.forEach(function(nt,k){ var at=t+k*4*B; nt.forEach(function(m,j){ sdEP(vb,at+j*0.018,sdMidi(m),0.045,4*B); }); sdEP(vb,at,sdMidi(nt[0]-24),0.05,4*B); });
          for(i=4;i<24;i++){ var bt=t+i*B+(i%2?B*0.08:0); if(i%4===0) sdKick(vb,bt,0.3); if(i%4===2) sdKick(vb,bt+B*0.5,0.22); if(i%2===1) sdSnare(vb,bt,0.09); sdHat(vb,bt+B*0.5,0.025); } },
        lens:function(b,t){ sdNoise(b,t,"bandpass",600,0.9,0.08,0.015,0.08,0.3,1600); },
        rack:function(b,t,D){ for(var i=0;i<8;i++) sdTick(b,t+D*0.85*(1-Math.pow(1-i/8,1.7)),3200,0.01); },
        shot:function(b,t){ [62,66,69,73].forEach(function(m){ sdTone(b,t+0.02,sdMidi(m),"sine",0.005,0.035,0.05,0.6,sdMidi(m)*0.45); }); },   /* the tape winds down */
        spin:function(b,t){ var w=t+0.7; [57,64,68,71,76].forEach(function(m,j){ sdEP(b,w+j*0.05,sdMidi(m),0.05,3.5); }); sdEP(b,w,sdMidi(45),0.06,3.5); sdKick(b,w,0.25); for(var i=0;i<3;i++) sdTick(b,w+0.8+i*0.4,2400,0.02); } },
    /* 8 · Deep drone: one evolving drone, the whole way: low and dark in the dark, opening and shimmering through the glide,
       a held breath for the shot, and it blooms into the title */
    8:{ bed:function(c,t){ var bus=sdBedBus(c,t); SD.ambSrc=sdAir(c,bus,t,0.006,300); },
        scan:function(b,t){ var c=SD.ctx, F=LA_F, vb=sdVBus(c,t,1.3); sdDrone(vb,t,[36.71,73.42,110,146.83,164.81],F.len+2,0.045,150,1900);   /* D, open fifths and a ninth */
          [587.33,880,1174.66].forEach(function(f,i){ sdTone(vb,t+3+i*1.4,f,"sine",3,0.008,F.fire-6-i*1.4,2.5,null,(i-1)*0.6); });   /* the shimmer above */
          sdNoise(vb,t+2,"bandpass",900,6,4,0.012,F.fire-7,2,2600); },
        lens:function(b,t){ sdNoise(b,t,"bandpass",500,0.9,0.1,0.015,0.08,0.3,1400); },
        rack:function(b,t,D){ sdTone(b,t,1174.66,"sine",0.3,0.012,D-0.3,0.8,1318.51); },
        spin:function(b,t){ var w=t+0.7; [73.42,110,146.83,220,293.66,329.63,440].forEach(function(f,i){ sdTone(b,w+i*0.04,f,i<2?"triangle":"sine",0.6+i*0.1,[0.06,0.05,0.04,0.03,0.025,0.02,0.014][i],1.2,4.5,null,(i%2?0.35:-0.35)); });
          sdTone(b,w-0.05,36.71,"sine",0.4,0.2,1,4); [1174.66,1479.98,1760].forEach(function(f,i){ sdBell(b,w+0.3+i*0.12,f,0.018,(i-1)*0.5,3); }); } },
    /* 9 · Electronic: a pulsing arpeggio and a four-on-the-floor beat building, a riser, a hard cut on the shutter,
       and a big chord stab with the title */
    9:{ bed:function(c,t){ var bus=sdBedBus(c,t); SD.ambSrc=sdAir(c,bus,t,0.005,400); },
        scan:function(b,t){ var c=SD.ctx, F=LA_F, vb=sdVBus(c,t,0.3), B=F.fire/24, S=B/4, i, arp=[57,64,69,72,76,72,69,64], lp=c.createBiquadFilter();
          lp.type="lowpass"; lp.Q.value=6; lp.frequency.setValueAtTime(400,t); lp.frequency.exponentialRampToValueAtTime(4200,t+F.fire); lp.connect(vb);
          for(i=0;i<24*4;i++){ var at=t+i*S, m=arp[i%8]+(i>=48?(i%16<8?0:-2):0); sdPluck(lp,at,sdMidi(m),0.03+0.02*i/96,S*1.6,(i%2?0.3:-0.3)); }   /* the arpeggio, the filter opening */
          for(i=8;i<24;i++){ var bt=t+i*B; sdKick(vb,bt,0.42); if(i>=12) sdHat(vb,bt+B*0.5,0.04); if(i>=16&&i%2===1) sdClap(vb,bt,0.08); }
          sdTone(vb,t+8*B,sdMidi(33),"sawtooth",0.05,0.02,F.fire-8*B-0.1,0.05);   /* the bass comes in with the kick */
          sdNoise(vb,t+F.fire-4*B,"bandpass",800,2,4*B,0.06,0.01,0.02,9000); },   /* riser */
        lens:function(b,t){ sdTone(b,t,1760,"square",0.002,0.01,0.03,0.05); },
        rack:function(b,t,D){ for(var i=0;i<12;i++) sdTone(b,t+i*D/12,1760+i*120,"square",0.001,0.006,0.01,0.03); },
        spin:function(b,t){ var w=t+0.7; [45,57,64,69,72,76].forEach(function(m,j){ sdPluck(b,w,sdMidi(m),0.07,2.8,(j%2?0.4:-0.4)); sdTone(b,w,sdMidi(m),"sawtooth",0.01,0.025,0.4,2.6); });
          sdKick(b,w,0.5); sdNoise(b,w,"highpass",6000,0.7,0.002,0.05,0.02,1.4); } },
    /* 10 · Bush: no music. A New Zealand bush in the morning: wind moving through the canopy, a stream nearby, tūī and
       bellbird calling, a fantail close by; the title lands on a gust and a bellbird's phrase */
    10:{ bed:function(c,t){ var bus=sdBedBus(c,t); var a=sdAir(c,bus,t,0.02,900), w=sdAir(c,bus,t,0.012,3200); SD.ambSrc=a.concat(w); },
        scan:function(b,t){ var F=LA_F, i, T=F.len+1;
          for(i=0;i<T*22;i++) sdNoise(b,t+Math.random()*T,"bandpass",500+Math.random()*1300,3,0.02,0.006+Math.random()*0.008,0.03,0.08,null,-0.6+Math.random()*0.3);   /* the stream, off to the left */
          for(i=0;i<6;i++) sdTui(b,t+1.2+i*2.6+Math.random()*0.8,(Math.random()*2-1)*0.8);
          for(i=0;i<5;i++) sdBellbird(b,t+2.4+i*2.9+Math.random()*0.6,(Math.random()*2-1)*0.7);
          for(i=0;i<4;i++) sdFantail(b,t+3+i*3.3+Math.random(),(Math.random()*2-1)*0.6); },
        lens:function(b,t){ sdNoise(b,t,"bandpass",500,0.8,0.1,0.08,0.12,0.35,1400,-0.3,0.2); sdTick(b,t+0.52,1400,0.07); },
        rack:function(b,t,D){ for(var i=0;i<12;i++) sdTick(b,t+D*0.85*(1-Math.pow(1-i/12,1.7)),3800,0.01); },
        spin:function(b,t){ var w=t+0.7; sdNoise(b,t,"lowpass",500,0.6,1.2,0.07,0.4,1.8,1800,-0.6,0.6); sdBellbird(b,w,0); sdBellbird(b,w+1.1,0.4); sdTone(b,w,55,"sine",1.2,0.05,1,3); } },
    /* 11 · Piano and cello: a simple tune on a felt piano over a slow cello line, resolving as the title lands */
    11:{ bed:function(c,t){ var bus=sdBedBus(c,t); SD.ambSrc=sdAir(c,bus,t,0.006,400); },
        scan:function(b,t){ var c=SD.ctx, F=LA_F, vb=sdVBus(c,t,1.0), B=F.fire/16;   /* 16 slow beats to the shot */
          [[0,76,1.5],[1.5,73,0.5],[2,71,1],[3,69,1],[4,73,1.5],[5.5,74,0.5],[6,76,2],[8,78,1.5],[9.5,76,0.5],[10,74,1],[11,73,1],[12,71,2],[14,73,1],[15,76,1]].forEach(function(n){ sdFelt(vb,t+n[0]*B,sdMidi(n[1]),0.06,0.15); });
          [[0,57],[4,54],[8,50],[12,52]].forEach(function(n){ sdFelt(vb,t+n[0]*B,sdMidi(n[1]-12),0.05,-0.15); sdFelt(vb,t+n[0]*B+B,sdMidi(n[1]),0.035,-0.1); sdCello(vb,t+n[0]*B,sdMidi(n[1]-12),4*B,0.03); }); },
        lens:function(b,t){ sdNoise(b,t,"bandpass",600,0.9,0.08,0.015,0.08,0.3,1600); },
        rack:function(b,t,D){ for(var i=0;i<8;i++) sdTick(b,t+D*0.85*(1-Math.pow(1-i/8,1.7)),3400,0.008); },
        spin:function(b,t){ var w=t+0.7; [45,57,61,64,69,73,76].forEach(function(m,j){ sdFelt(b,w+j*0.07,sdMidi(m),0.06-j*0.004,(j-3)*0.12); }); sdCello(b,w,sdMidi(45),4,0.035); } } };
  // ---- the building blocks of 6 to 11 ----
  function sdMidi(m){ return 440*Math.pow(2,(m-69)/12); }
  function sdPad(b,t,fs,dur,peak,c0,c1){ var c=SD.ctx, lp=c.createBiquadFilter(), g=c.createGain(); lp.type="lowpass"; lp.Q.value=0.7; lp.frequency.setValueAtTime(c0,t); lp.frequency.exponentialRampToValueAtTime(c1,t+dur); sdEnv(g,t,dur*0.35,peak,dur*0.55,dur*0.25+0.6); lp.connect(g); g.connect(b);
    fs.forEach(function(f,i){ [-7,7].forEach(function(dt){ var o=c.createOscillator(); o.type="sawtooth"; o.frequency.value=f; o.detune.value=dt+i*2; o.connect(lp); o.start(t); o.stop(t+dur*1.2+0.8); }); }); }
  function sdDrone(b,t,fs,dur,peak,c0,c1){ var c=SD.ctx, lp=c.createBiquadFilter(), g=c.createGain(), lfo=c.createOscillator(), lg=c.createGain(); lp.type="lowpass"; lp.Q.value=1.2; lp.frequency.setValueAtTime(c0,t); lp.frequency.exponentialRampToValueAtTime(c1,t+dur*0.7);
    lfo.frequency.value=0.09; lg.gain.value=c0*0.4; lfo.connect(lg); lg.connect(lp.frequency); sdEnv(g,t,3,peak,dur-4,1.5); lp.connect(g); g.connect(b); lfo.start(t); lfo.stop(t+dur+0.5);
    fs.forEach(function(f,i){ [-5,0,5].forEach(function(dt){ var o=c.createOscillator(); o.type=i===0?"sine":"sawtooth"; o.frequency.value=f; o.detune.value=dt*(i?1:0); var og=c.createGain(); og.gain.value=i===0?2.5:1; o.connect(og); og.connect(lp); o.start(t); o.stop(t+dur+0.5); }); }); }
  function sdTom(b,t,peak){ sdTone(b,t,92,"sine",0.003,peak,0.02,0.5,46); sdNoise(b,t,"lowpass",900,0.7,0.002,peak*0.25,0.01,0.15,200); }
  function sdKick(b,t,peak){ sdTone(b,t,140,"sine",0.002,peak,0.01,0.28,42); sdTick(b,t,3000,peak*0.08); }
  function sdSnare(b,t,peak){ sdNoise(b,t,"bandpass",1900,0.8,0.002,peak,0.01,0.16,1200); sdTone(b,t,190,"triangle",0.002,peak*0.5,0.01,0.08,150); }
  function sdClap(b,t,peak){ for(var k=0;k<3;k++) sdNoise(b,t+k*0.011,"bandpass",1400,1.2,0.001,peak,0.002,0.03); sdNoise(b,t+0.033,"bandpass",1400,1.2,0.001,peak*0.8,0.01,0.14); }
  function sdHat(b,t,peak){ sdNoise(b,t,"highpass",7500,0.7,0.001,peak,0.004,0.045); }
  function sdEP(b,t,f,peak,dur){ sdTone(b,t,f,"sine",0.008,peak,dur*0.25,dur*0.75); sdTone(b,t,f*2,"sine",0.004,peak*0.18,0.02,dur*0.4); sdTone(b,t,f*7.03,"sine",0.001,peak*0.05,0.004,0.18); }   /* an electric piano: the note, its octave, the tine's ping */
  function sdPluck(b,t,f,peak,dur,pan){ var c=SD.ctx, o=c.createOscillator(), lp=c.createBiquadFilter(), g=c.createGain(); o.type="sawtooth"; o.frequency.value=f; lp.type="lowpass"; lp.frequency.setValueAtTime(f*8,t); lp.frequency.exponentialRampToValueAtTime(f*1.2,t+dur*0.6); sdEnv(g,t,0.003,peak,0.01,dur); o.connect(lp); lp.connect(g); sdOut(g,b,pan,null,t,dur); o.start(t); o.stop(t+dur+0.1); }
  function sdCello(b,t,f,dur,peak){ var c=SD.ctx, o=c.createOscillator(), lp=c.createBiquadFilter(), g=c.createGain(), v=c.createOscillator(), vg=c.createGain(); o.type="sawtooth"; o.frequency.value=f; v.frequency.value=5.2; vg.gain.value=f*0.006; v.connect(vg); vg.connect(o.frequency);
    lp.type="lowpass"; lp.frequency.value=900; lp.Q.value=0.8; sdEnv(g,t,0.6,peak,Math.max(0.1,dur-1.2),1.2); o.connect(lp); lp.connect(g); g.connect(b); o.start(t); v.start(t); o.stop(t+dur+1); v.stop(t+dur+1); }
  function sdTui(b,t,pan){ var seq=[[1900,0.06],[2700,0.05],[0,0.05],[1250,0.09],[3400,0.04],[0,0.03],[2200,0.07]], at=t;   /* a tūī: bell notes, a click, a gurgle */
    seq.forEach(function(s){ if(s[0]) sdTone(b,at,s[0],"sine",0.004,0.012,s[1]*0.5,s[1]*0.6,s[0]*(Math.random()<0.4?1.3:0.95),pan); else sdTick(b,at,3800,0.03,pan); at+=s[1]+0.03; }); }
  function sdBellbird(b,t,pan){ [1568,2093,1760].forEach(function(f,i){ sdBell(b,t+i*0.2,f*(0.98+Math.random()*0.04),0.014,pan,0.9); }); }   /* korimako: three pure bell notes */
  function sdFantail(b,t,pan){ for(var i=0;i<6;i++) sdTone(b,t+i*0.07,3600+((i%2)?500:-300),"sine",0.003,0.008,0.01,0.03,null,pan); }   /* pīwakawaka: a quick squeaky chatter */
  // ---- the day in sound (Air): crickets in the night, fading as it greys; the first bird at first light, a dawn chorus by
  //      golden hour. The rain is the weather's own sound, following the rain you see. t is the reveal, T the time to the shot ----
  function sdCricket(b,t,f,peak,pan){ for(var k=0;k<4;k++) sdTone(b,t+k*0.028,f,"sine",0.002,peak,0.008,0.012,null,pan); }
  function sdBird(b,t,kind,peak,pan){ var f0=2600+Math.random()*1600, i;
    if(kind===0){ sdTone(b,t,f0,"sine",0.01,peak,0.04,0.08,f0*1.45,pan); sdTone(b,t+0.16,f0*1.3,"sine",0.01,peak*0.8,0.03,0.1,f0*0.95,pan); }   /* a two-note whistle */
    else if(kind===1){ for(i=0;i<6+Math.floor(Math.random()*4);i++) sdTone(b,t+i*0.055,f0*(1+((i%2)?0.12:0)),"sine",0.004,peak*0.7,0.012,0.03,null,pan); }   /* a trill */
    else { sdTone(b,t,f0*1.2,"sine",0.006,peak,0.02,0.06,f0*0.7,pan); sdTone(b,t+0.12,f0*1.25,"sine",0.006,peak*0.85,0.02,0.06,f0*0.72,pan); sdTone(b,t+0.24,f0*1.3,"sine",0.006,peak*0.7,0.02,0.07,f0*0.75,pan); } }   /* falling chirps */
  function sdDay(b,t,T){ var i, at;
    for(i=0;i<40;i++){ at=t+Math.random()*T*0.52; var u=(at-t)/T; sdCricket(b,at,4300+(i%3)*260,0.012*Math.max(0,1-u/0.52),(i%3-1)*0.6); }
    for(i=0;i<34;i++){ var r=Math.pow(Math.random(),0.55); at=t+T*(0.5+0.5*r)+Math.random()*0.2; sdBird(b,at,i%3,0.008+0.012*r,(Math.random()*2-1)*0.85); } }
  function sdFelt(b,t,f,peak,pan){ var c=SD.ctx, g=c.createGain(), lp=c.createBiquadFilter(); lp.type="lowpass"; lp.frequency.setValueAtTime(f*5,t); lp.frequency.exponentialRampToValueAtTime(f*1.6,t+2.5);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+0.012); g.gain.exponentialRampToValueAtTime(peak*0.35,t+0.5); g.gain.exponentialRampToValueAtTime(0.0001,t+3.2); lp.connect(g); sdOut(g,b,pan,null,t,3.2);
    [[1,1],[2,0.32],[3,0.1],[4.02,0.05]].forEach(function(h){ var o=c.createOscillator(), og=c.createGain(); o.type="sine"; o.frequency.value=f*h[0]; og.gain.value=h[1]; o.connect(og); og.connect(lp); o.start(t); o.stop(t+3.3); }); }
  // the big circle: a whoosh round, the sub swelling, then the wordmark lands on a warm A chord with the letters glinting in
  function sdSpin(t,quick){ var b=sdCtx()&&sdBus(0.6); if(!b) return; t=t==null?sdNow():t; SD.big=b; if(sdVar("spin")) return sdVar("spin")(b,t,quick);   /* 6 to 11 bring their own title moment */ var D=quick?1.6:LA_T.spin, w=t+0.7;
    sdNoise(b,t,"lowpass",300,0.8,D*0.35,0.15,D*0.1,D*0.45,2000,-0.7,0.7); sdNoise(b,t+D*0.15,"bandpass",600,1.4,D*0.3,0.05,0.1,D*0.4,300,0.7,-0.5);   /* round we go */
    sdNoise(b,w-0.55,"highpass",900,0.8,0.5,0.06,0.02,0.04,7000);   /* a breath in before the hit */
    sdDroneTo(1,w,0.4);
    sdTone(b,w-0.02,78,"sine",0.008,0.4,0.08,1.9,30); sdTone(b,w-0.02,52,"sine",0.02,0.25,0.15,2.4,28); sdNoise(b,w-0.01,"lowpass",2400,0.7,0.003,0.12,0.02,0.6,150);   /* the hit: a sub drop and a soft thump */
    [55,110,164.81,207.65,246.94,277.18,329.63,415.3].forEach(function(f,i){ sdTone(b,w+i*0.022,f,i<3?"triangle":"sine",0.04+i*0.02,[0.05,0.065,0.05,0.036,0.034,0.03,0.025,0.014][i],0.5,4+i*0.3,null,(i%2?0.3:-0.3)); });
    [1318.5,1480,1760,1975.5,2217.5,2637,2960].forEach(function(f,i){ sdTone(b,w+0.04+i*0.06,f,"sine",0.005,0.022,0.01,0.8,null,-0.6+i*0.2); });
    sdNoise(b,w+0.6,"highpass",5200,0.7,0.35,0.016,0.3,1.0,9000,-0.5,0.5); }
  // the welcome card: a soft two-note chime; its buttons: a tick
  function sdChime(t){ var b=sdCtx()&&sdBus(0.7); if(!b) return; t=t==null?sdNow():t; sdTone(b,t,659.25,"sine",0.01,0.04,0.05,1.4); sdTone(b,t+0.12,880,"sine",0.01,0.035,0.05,1.6); sdTone(b,t+0.12,1318.5,"sine",0.01,0.008,0.05,1.2); }
  function sdTap(){ var b=sdCtx()&&sdBus(0.3); if(!b) return; var t=sdNow(); sdTick(b,t,2200,0.06); sdTone(b,t,520,"sine",0.003,0.03,0.01,0.12); }
  /* dev: lay the opening's whole soundtrack, for any sound option and shutter, into an offline buffer on the film's own
     clock and hand back a wav, to check levels without a GPU and to put each option under the film (tools/openingsound.mjs) */
  function sdWav(buf){ var n=buf.length, L=buf.getChannelData(0), R=buf.getChannelData(1), pk=0, i, sr=buf.sampleRate, dv=new DataView(new ArrayBuffer(44+n*4)); for(i=0;i<n;i++) pk=Math.max(pk,Math.abs(L[i]),Math.abs(R[i]));
    function ws(o,x){ for(var k=0;k<x.length;k++) dv.setUint8(o+k,x.charCodeAt(k)); } ws(0,"RIFF"); dv.setUint32(4,36+n*4,true); ws(8,"WAVEfmt "); dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,2,true); dv.setUint32(24,sr,true); dv.setUint32(28,sr*4,true); dv.setUint16(32,4,true); dv.setUint16(34,16,true); ws(36,"data"); dv.setUint32(40,n*4,true);
    for(i=0;i<n;i++){ dv.setInt16(44+i*4,Math.max(-1,Math.min(1,L[i]))*32767,true); dv.setInt16(46+i*4,Math.max(-1,Math.min(1,R[i]))*32767,true); }
    var bytes=new Uint8Array(dv.buffer), str=""; for(i=0;i<bytes.length;i+=32768) str+=String.fromCharCode.apply(null,bytes.subarray(i,i+32768));
    return {peak:+pk.toFixed(3), wav:btoa(str)}; }
  function sdRenderFilm(v,sh){ var wasV=SD_V, wasS=SD_SH, pc=SD.ctx, F=LA_F, sr=48000, oc=new OfflineAudioContext(2,Math.ceil(sr*(F.len+3)),sr); SD_V=v==null?SD_V:v; SD_SH=sh==null?SD_SH:sh;
    SD.off=true; SD.ctx=null; SD.vb=null; SD.shB=null; SD.big=null; SD.seq=null; SD.amb=null; sdWire(oc); var keep=SD.shBuf, kg=SD.shGet; SD.shBuf=null; SD.shGet=null;
    return Promise.resolve(SD_SH===5?sdShutLoad(oc):0).then(function(){ sdAmbStart(0); sdScan(0); sdLensUp(F.vf); sdRack(F.rack,1.4); sdShutter(F.fire); sdSpin(F.spin,false); sdAmbStop(F.len+0.3,1.0); return oc.startRendering(); })
      .then(function(buf){ SD_V=wasV; SD_SH=wasS; SD.off=false; SD.ctx=null; SD.seq=null; SD.amb=null; SD.vb=null; SD.shB=null; SD.big=null; SD.shBuf=keep; SD.shGet=kg; if(pc) sdWire(pc); return sdWav(buf); }); }
  function sdRender(){ return sdRenderFilm(); }
  if(/[?&]dev/.test(location.search)) window.__sd={ render:sdRender, film:sdRenderFilm, names:function(){ return {snd:SD_VN, shut:SD_SHN, now:[SD_V,SD_SH]}; } };
  // ---- the welcome: what Studium is, and that the camera comes first ----
  var LA_WEL=[["asset:assets/launch/shoot.jpg","Shoot"],["asset:assets/launch/select.jpg","Pick"],["asset:assets/launch/edit.jpg","Edit"],["asset:assets/launch/workbook.jpg","Make"],["asset:assets/launch/folio.jpg","Folio"],["asset:assets/launch/gallery.jpg","Show"]];
  function laWelOpen(){ var w=$("laWel"); if(!w){ w=document.createElement("div"); w.id="laWel";
      w.innerHTML='<div class="lw-in" role="dialog" aria-labelledby="lwH"><div class="lw-l"><div class="lw-k">WELCOME TO STUDIUM</div>'
        +'<h2 id="lwH"><span>Walk around a real place and take photos.</span></h2>'
        +'<p>Real places, scanned so you can stand in them with a camera in your hands. Shoot, pick your best frames, then edit them and put them into a folio and an exhibition, like a real photographer would.</p>'
        +'<p class="lw-first">First we’ll show you the camera and how to move around. It only takes a few minutes.</p>'
        +'<button class="lw-go" data-lw="go">Show me the camera <kbd>↵</kbd></button></div>'
        +'<div class="lw-table" aria-hidden="true">'+LA_WEL.map(function(x,i){ return '<figure style="--i:'+i+'"><img alt="" decoding="async" src="'+x[0]+'"><figcaption><b>0'+(i+1)+'</b> '+x[1].toUpperCase()+'</figcaption></figure>'; }).join("")+'</div></div>';
      document.body.appendChild(w);
      ["pointerdown","mousedown","click","wheel"].forEach(function(k){ w.addEventListener(k,function(ev){ ev.stopPropagation(); var b=ev.target.closest&&ev.target.closest("[data-lw]"); if(k==="click"&&b) laWelGo(b.getAttribute("data-lw")); }); });
      window.addEventListener("keydown",function(ev){ if(!LA.wcard||!$("laWel").classList.contains("show")) return; ev.stopImmediatePropagation(); ev.preventDefault(); if(ev.repeat) return; if(ev.code==="Enter"||ev.code==="NumpadEnter"||ev.code==="Space") laWelGo("go"); },true); }
    if(document.pointerLockElement){ try{ document.exitPointerLock(); }catch(e){} }
    w.className="show"; document.body.classList.add("la-wel-on"); sdChime(); var g=w.querySelector(".lw-go"); if(g) try{ g.focus({preventScroll:true}); }catch(e){} }
  function laWelClose(now){ var w=$("laWel"); LA.wcard=false; document.body.classList.remove("la-wel-on"); if(!w) return; if(now){ w.className=""; return; } w.className="show out"; setTimeout(function(){ if(!LA.wcard) w.className=""; },420); }
  function laWelGo(a){ if(!LA.wcard) return; sdTap(); laWelClose();
    if(a==="skip"){ LA.noIntro=true; try{ var id=Q.tracked, nx=id&&qNextStep(id); if(nx&&nx.tour) QU.auto[id+":"+nx.tour]=1; }catch(e){} return; }   /* exploring first: the warm-up waits for the quest board */
    LA.noIntro=true; LA.toTour=true; setTimeout(function(){ LA.toTour=false; },4000); setTimeout(function(){ if(typeof qAutoTour==="function") qAutoTour(); },350); }
  // ---- recording the film (tools/openingfilm.mjs, with ?dev&filmcap): the glide, the shot and the spin above, driven frame
  //      by frame on a fixed clock. Each frame is kept only once the scan has finished relighting, sorting and filling in its
  //      detail for that exact view, so the film has no half-drawn frames. Costs don't matter here, so the light really
  //      rises from early morning and the lens is wide open ----
  var FC={on:/[?&]filmcap/.test(location.search)&&/[?&]dev/.test(location.search), fps:60, lod:3, still:null, cv:null};
  function fcDraw(dt){ if(loaded) updateCamera(0); renderFrame(dt); }
  function fcCalm(){ var sp=viewer&&viewer.spark; if(sp&&(sp.sorting||sp.sortDirty||sp.lodDirty||sp.sortTimeoutId!==undefined||(sp.lodInitQueue&&sp.lodInitQueue.length)||(sp.pager&&sp.pager.hasQueued&&sp.pager.hasQueued()))) return false;
    return !(typeof RLB!=="undefined"&&RLB.dirty)&&!(typeof WE!=="undefined"&&WE.dirty); }
  function fcSettle(){ return new Promise(function(ok){ var n=0, calm=0; (function step(){ fcDraw(0); n++; calm=fcCalm()?calm+1:0; if((n>=4&&calm>=3)||n>600) return ok(n); setTimeout(function(){ requestAnimationFrame(step); },4); })(); }); }
  function fcPrep(){ if(!FC.started){ FC.started=true; soundOn=false; CH.hidden=true; var sc=(window.SPLAT_SCENES||[])[0]; App.go("landing"); loadBundled(sc); }
    if(!loaded||(CH.spec&&CH.spec.detail&&!(viewer&&viewer.detail))){ fcDraw(0); return "loading"; }
    if(!FC.lit){ FC.lit=true; setScale(dynMax()); viewer.spark.lodSplatScale=FC.lod; laCamInit(); LA.eye0=WK.eye; laShootCam(0); LA.focusTo=laFocusTarget(); laGlide(0);
      if(typeof rbDefaultOk==="function"&&rbDefaultOk()) rbDefaultLook(false,9*60+30); if(typeof WE!=="undefined"){ WE.wind=0; WE.rain=0; WE.dirty=true; } }   /* still air: the film has to land on the live scan exactly */
    if(typeof RLB!=="undefined"&&RLB.sunMode&&!RLB.built){ fcDraw(0); return "light"; }
    return "ready"; }
  function fcBez(x){ x=Math.max(0,Math.min(1,x)); var lo=0, hi=1, m; for(var i=0;i<32;i++){ m=(lo+hi)/2; if(3*(1-m)*(1-m)*m*0.4+3*(1-m)*m*m*0.2+m*m*m<x) lo=m; else hi=m; } m=(lo+hi)/2; return 3*(1-m)*m*m+m*m*m; }   /* cubic-bezier(.4,0,.2,1) */
  function fcState(t){ var F=LA_F, f=laE(t/1.6), m=1-laE(t/(F.glide+1.5)); LAG.on=true; LAG.e=f*(1-0.1*m); LAG.w=0.16*m; LAG.s=1-0.08*m; LAG.c=1+0.04*m;   /* the same grade as the live opening had */
    if(typeof RLB!=="undefined"&&RLB.look0!=null) rbLookEase(Math.min(1,t/(F.glide+2.2)));   /* early morning to the default look's 13:35, by the photo */
    if(t<F.glide){ laGlide(t/F.glide); return; }
    if(t<F.fire){ laShootCam(Math.min(1,(t-F.glide)/LA_T.shoot));
      if(t>=F.vf){ if(!LA.vf) laVfOn(); var k=1-Math.pow(1-Math.min(1,(t-F.vf)/LA_T.iris),2.4); camera.fov=LA.fovFrom+(LA.fovTo-LA.fovFrom)*k; camera.updateProjectionMatrix(); }
      if(t>=F.rack) laRack(Math.min(1,(t-F.rack)/1.4)); return; }
    if(FC.fireFov==null) FC.fireFov=camera.fov;
    if(t>=F.fire+0.06&&LA.vf) laVfOff();
    if(t<F.spin) return;
    if(!FC.spun){ FC.spun=true; LA.stillFov=FC.fireFov; laSpinStart(); }
    laSpin(Math.min(1,(t-F.spin)/LA_T.spin)); if(t>=F.end) laSpawn(); }
  function fcCompose(t){ var F=LA_F, src=renderer.domElement, W=innerWidth, H=innerHeight, c=FC.cv||(FC.cv=document.createElement("canvas")), g, k;   /* drawn at the screen's pixel ratio (twice over for the film), kept at the film's own size */
    if(c.width!==W||c.height!==H){ c.width=W; c.height=H; } g=c.getContext("2d"); g.imageSmoothingEnabled=true; g.imageSmoothingQuality="high"; g.globalAlpha=1; g.drawImage(src,0,0,W,H);
    if(!FC.still&&t>=F.fire){ FC.still=document.createElement("canvas"); FC.still.width=W; FC.still.height=H; var sg=FC.still.getContext("2d"); sg.imageSmoothingQuality="high"; sg.drawImage(src,0,0,W,H); }   /* the photo */
    if(t>=F.vf&&t<F.vf+LA_T.iris){ k=1-Math.pow(1-(t-F.vf)/LA_T.iris,2.4); var s=1+0.7*k; g.save(); g.globalAlpha=1-k; g.translate(W/2,H/2); g.scale(0.75*W*s,0.75*H*s);   /* the lens's dark edge easing open */
      var rg=g.createRadialGradient(0,0,0,0,0,1); rg.addColorStop(0.3,"rgba(4,3,2,0)"); rg.addColorStop(0.72,"rgba(4,3,2,0.92)"); rg.addColorStop(1,"rgba(4,3,2,0.92)"); g.fillStyle=rg; g.fillRect(-4,-4,8,8); g.restore(); }
    if(FC.still&&t>=F.fire+0.06){ var p=t<F.spin?0:fcBez((t-F.spin)/0.9); if(p<1){ var sc=1+0.08*p; g.save(); g.globalAlpha=1-p; g.translate(W/2,H/2); g.scale(sc,sc); g.drawImage(FC.still,-W/2,-H/2); g.restore(); } }   /* the photo holds a breath, then the world pulls away from it */
    var b=t-F.fire; if(b>=0&&b<0.4){ var eo=function(x){ return 1-(1-x)*(1-x); }, a=b<0.032?eo(b/0.032):b<0.12?1:1-eo((b-0.12)/0.28); g.globalAlpha=1; g.fillStyle="rgba(0,0,0,"+a.toFixed(4)+")"; g.fillRect(0,0,W,H); }   /* the shutter */
    return c.toDataURL("image/png"); }
  function fcFrame(i,keep){ var t=i/FC.fps; fcState(t); fcDraw(1/FC.fps); var need=keep||i%30===0||(!FC.still&&t>=LA_F.fire);   /* even skipping ahead, let the scan settle now and then: starved of it, its sort never catches up */
    if(!need) return Promise.resolve(null); return fcSettle().then(function(n){ var png=fcCompose(t); return keep?{n:n, png:png}:null; }); }
  if(FC.on){ var swm=/[?&]sw=([\d.]+),([\d.]+)/.exec(location.search); if(swm) LA_SW=[+swm[1],+swm[2]]; }   /* trying other swings: ?sw=out,up */
  if(FC.on) window.__fc={ prep:fcPrep, frame:fcFrame, frames:function(){ return Math.round(LA_F.len*FC.fps); }, why:function(){ var sp=viewer&&viewer.spark; return {sorting:sp&&sp.sorting, sortDirty:sp&&sp.sortDirty, lodDirty:sp&&sp.lodDirty, timer:sp&&sp.sortTimeoutId!==undefined, init:sp&&sp.lodInitQueue&&sp.lodInitQueue.length, pager:!!(sp&&sp.pager&&sp.pager.hasQueued&&sp.pager.hasQueued()), rb:typeof RLB!=="undefined"&&RLB.dirty, built:typeof RLB!=="undefined"&&RLB.built, we:typeof WE!=="undefined"&&WE.dirty, splats:sp&&sp.activeSplats, exp:fx.exposure, lag:[LAG.on,LAG.e], vf:viewfinderOn, expMult:expMult, eye:typeof rlbEye==="function"?rlbEye():-1, still:!!FC.still}; }, clear:function(o){ var P=viewer.P, A=viewer.A, N=P.length/3, out=[]; o.amps.forEach(function(sw){ LA_SW=sw; var worst=1e9, at=-1; for(var j=0;j<=120;j++){ laSpin(j/120); var x=camPos.x, y=camPos.y, z=camPos.z, d2=1e9; for(var i=0;i<N;i+=2){ if(A&&A[i]<0.3) continue; var dx=P[i*3]-x, dy=P[i*3+1]-y, dz=P[i*3+2]-z, d=dx*dx+dy*dy+dz*dz; if(d<d2) d2=d; } var d=Math.sqrt(d2); if(d<worst){ worst=d; at=j; } } out.push({sw:sw, nearest:+worst.toFixed(2), at:at}); }); return out; }, draw:function(){ var t=performance.now(), gl=renderer.getContext(), px=new Uint8Array(4); fcDraw(0); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); return Math.round(performance.now()-t); }, pose:function(){ return {x:camPos.x, y:camPos.y, z:camPos.z, yaw:yaw, pitch:pitch, fov:camera.fov}; } };
  LA.hold=/[?&]lahold/.test(location.search);
  if(/[?&]dev/.test(location.search)) window.__la={ start:launchStart, skip:laSkip, go:function(){ LA.wait=false; LA.pass=!LA.held; }, wel:function(){ return !!LA.wcard; }, welGo:laWelGo, state:function(){ var v=LA.el&&LA.el.querySelector("video"); return {on:LA.on, phase:LA.phase, loaded:loaded, log:LA.log||[], vt:v?+v.currentTime.toFixed(2):-1, playing:!!LA.playing, bad:!!LA.filmBad}; }, reset:function(){ try{ localStorage.removeItem(LA_KEY); }catch(e){} } };
