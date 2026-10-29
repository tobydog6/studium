  // ================= LAUNCH: the opening =================
  // Dark while the scan loads, and everything heavy happens there, unseen: the light is set for good, the lens is raised
  // once to warm it up, the focus for the shot is worked out, and the camera waits at its first spot while the detail
  // fills in. Then one long, slow glide round the stump in the morning light. The real viewfinder comes up on the 85,
  // racks focus onto the bark and fires; the photo holds a breath and the world pulls away from it in one big circle as
  // the wordmark lands, settling on the starting spot. Any click or key skips to the short circle. After the first time
  // it's the short version: dark, circle, settle.
  // Smooth by design: once the dark lifts the scan never changes. No relighting, no wind or fog rebuilds, no resolution
  // steps, nothing loading behind it (laHolds). Only the camera moves; the mood is a grade on the finished frame (LAG).
  var LA={on:false, t0:0, raf:0, phase:"", fast:false, after:null, el:null, cam:null, hold:false};
  var LA_KEY="studium_launch_seen";
  var LA_T={glide:9.0, scan:2.6, shoot:2.6, iris:0.9, spin:4.6, word:1.7};
  var LA_AP=2.8;   /* the shot's aperture: shallow enough to read as a portrait of the bark, without the huge soft splats f/1.8 costs to draw */
  var LAG={on:false, e:1, w:0, s:1, c:1};   /* the opening's grade, read by renderFrame: exposure, warmth, saturation, contrast */
  function laSeen(){ try{ return localStorage.getItem(LA_KEY)==="1"; }catch(e){ return false; } }
  function laHolds(){ return typeof LA!=="undefined"&&!!LA&&LA.on&&LA.phase!=="dark"; }   /* the light, the weather and the auto resolution leave the scan alone while this is true */
  function laEl(){ var e=$("launch"); if(e) return e; e=document.createElement("div"); e.id="launch"; e.setAttribute("data-nosnippet","");
    e.innerHTML='<div class="la-dark"><b>Studium</b></div><div class="la-still"><canvas></canvas></div><div class="la-iris"></div><div class="la-snap"></div>'
      +'<div class="la-word"><span class="la-kick">WELCOME TO</span><b>'+"Studium".split("").map(function(c,i){ return '<i style="--n:'+i+'">'+c+'</i>'; }).join("")+'</b><em></em><span class="la-tag">A PHOTOGRAPHY STUDIO FOR YEARS 11 TO 13</span></div><div class="la-skip">CLICK TO SKIP</div>';
    document.body.appendChild(e);
    e.addEventListener("pointerdown",function(ev){ ev.stopPropagation(); laSkip(); });
    window.addEventListener("keydown",function(ev){ if(!LA.on) return; ev.stopImmediatePropagation(); ev.preventDefault(); if(!ev.repeat) laSkip(); },true);
    window.addEventListener("keyup",function(ev){ if(LA.on) ev.stopImmediatePropagation(); },true);
    return e; }
  function laPhase(p){ if(LA.phase===p) return; LA.phase=p; LA.pt=performance.now(); LA.log=(LA.log||[]).concat([p]); LA.held=false; if(LA.el){ LA.el.className="on p-"+p+(LA.skipAsked?" skip":"")+(LA.el.classList.contains("held")?" held":""); } }
  function laHeld(){ if(!LA.hold) return false; if(!LA.held){ LA.held=true; if(LA.pass){ LA.pass=false; return false; } LA.wait=true; } return LA.wait; }   /* tests: ?lahold parks a phase until __la.go() */
  function launchStart(after){ if(LA.on) return; LA.on=true; LA.after=after||null; LA.fast=laSeen(); LA.t0=performance.now(); LA.cam=null; LA.skipAsked=false; LA.log=[]; LA.vf=false; LA.fired=false; LA.racked=false; LA.focused=-1; LA.firedT=0; LA.quick=false; LA.first=!LA.fast; LA.eye0=WK.eye; LA.prep=null; LA.focusTo=null; LA.revT=null; LA.glideT=null; LA.stillFov=null; LA.fovA=null; document.body.classList.remove("la-warm"); laWelClose(true); SD.seq=null;
    LAG.on=true; LAG.e=0; LAG.w=0; LAG.s=1; LAG.c=1;   /* black on the frame itself, until the reveal fades it up */
    var e=laEl(); LA.el=e; document.body.classList.add("launching"); laPhase("dark");
    ["hub","landing","studio","punctum","signin","teacher"].forEach(hubHide);
    if(!loaded){ var sc=(window.SPLAT_SCENES||[])[0]; if(sc){ App.go("landing"); loadBundled(sc); } }   /* the scan loads behind the dark */
    try{ localStorage.setItem(LA_KEY,"1"); }catch(x){}
    sdAmbStart(); laSoundIn();
    cancelAnimationFrame(LA.raf); LA.raf=requestAnimationFrame(laTick); }
  function laSkip(){ if(!LA.on) return; if(LA.phase==="dark"){ LA.fast=true; return; }   /* before the scan is in, skipping just drops the long bits */
    if(LA.phase!=="spin") laLockStart(); }
  // ---- the dark: one heavy job per frame, all of it before anything is seen ----
  function laPrep(t){ if(!loaded) return false; var P=LA.prep||(LA.prep={step:0});
    if(P.step===0){ P.loadT=t; laCamInit(); laGlide(LA.fast?1:0); P.step=1; return false; }   /* straight to the first spot, so the detail fills in where the glide starts */
    if(P.step===1){ var det=!(CH.spec&&CH.spec.detail)||!!(viewer&&viewer.detail)||t-P.loadT>8; if(!det) return false;   /* the stump's own detail piece first, so the light goes onto it too */
      P.looked=typeof rbDefaultOk==="function"&&CH.spec&&CH.spec.id==="stump"&&rbDefaultOk(); if(P.looked) rbDefaultLook(); P.lookT=t; P.step=2; return false; }   /* the default look, at its own time of day, once and for good */
    if(P.step===2){ if(P.looked&&!(RLB.built&&!RLB.dirty)&&t-P.lookT<10) return false; P.step=LA.fast?6:3; P.readyT=t; return false; }
    if(P.step===3){ laShootCam(0); LA.focusTo=laFocusTarget(); laGlide(0); P.step=4; return false; }   /* the shot's focus: a pass over every point, done now rather than as the lens comes up */
    if(P.step===4){ document.body.classList.add("la-warm"); laVfOn(); P.warmT=t; P.step=5; return false; }   /* the viewfinder raised once, unseen, so the real raise doesn't hitch */
    if(P.step===5){ if(t-P.warmT<0.35) return false; laVfOff(); laGlide(0); P.step=6; P.readyT=t; setTimeout(function(){ document.body.classList.remove("la-warm"); },120); return false; }
    return t-P.readyT>0.8&&t-P.loadT>1.4&&t>(LA.fast?0.6:1.2); }   /* a moment more at the first spot: the sort and the level of detail settle, and the auto resolution finds its level */
  // ---- the grade: fades up from black at the reveal, warm early light easing into the default look by the shot ----
  function laGrade(now){ if(!LAG.on) return; var f=LA.revT==null?0:laE((now-LA.revT)/1600), m=LA.glideT==null?0:1-laE((now-LA.glideT)/((LA_T.glide+1.5)*1000));
    LAG.e=f*(1-0.1*m); LAG.w=0.16*m; LAG.s=1-0.08*m; LAG.c=1+0.04*m; }
  /* everything that makes a sound comes up from silence over three seconds as the opening starts, so nothing arrives at once */
  function laSoundIn(){ [typeof SFX!=="undefined"&&SFX.out, SD.out].forEach(function(o){ if(!o||!o.context) return; try{ var c=o.context, t=c.currentTime, v=Math.max(o.gain.value,0.0002); o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(0,t); o.gain.linearRampToValueAtTime(v,t+3); }catch(e){} }); }
  // ---- the camera ----
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
  // ---- the spin: one big circle from wherever the camera is, landing exactly on the starting spot ----
  function laSpinStart(){ var sp=CH.spec&&CH.spec.spawn, S=laSubject(), walk=!!(WK.col&&WK.mode==="walk"); laVfOff(); laPhase("spin"); sdSpin(null,LA.quick); var ir=LA.el.querySelector(".la-iris"); if(ir){ ir.style.opacity=0; ir.style.transform=""; }   /* a skip mid-shot: the lens edge goes with it */
    if(LA.revT==null) LA.revT=performance.now();   /* straight from the dark: the frame fades up as it swings round */
    LA.fovA=LA.stillFov||(camera?camera.fov:null); LA.fovB=55;   /* the world under the photo starts at the photo's framing */
    var a0=LA.cam?LA.cam.a:Math.atan2(camPos.x-S[0], camPos.z-S[1]), r0=LA.cam?LA.cam.r:Math.hypot(camPos.x-S[0], camPos.z-S[1]), e0=LA.cam?LA.cam.eye:WK.eye;
    if(!sp){ LA.sp=null; LA.spinA=a0; LA.spinR=r0; LA.spinE=e0; LA.spinD=Math.PI*2; return; }
    var eye=sp[4]||1.65, aS=Math.atan2(sp[0]-S[0], sp[1]-S[1]), rS=Math.hypot(sp[0]-S[0], sp[1]-S[1]), d=aS-a0; d=Math.atan2(Math.sin(d),Math.cos(d)); if(d<0) d+=Math.PI*2;
    if(!walk) eye=LA.eye0!=null?LA.eye0:WK.eye; LA.sp={x:sp[0], z:sp[1], yaw:sp[2]||0, pitch:sp[3]||-0.1, eye:eye, y:WK.col?wkGround(sp[0],sp[1])+eye:camPos.y};   /* exactly where the app's own start puts you */ LA.spinA=a0; LA.spinR=r0; LA.spinE=e0; LA.spinD=d+Math.PI*2*(d>Math.PI*0.5?0:1); LA.spinRS=rS; }
  function laSpin(u){ var k=laE(u), T=LA.sp; if(LA.fovA){ laFov(LA.fovA+(LA.fovB-LA.fovA)*laE(Math.min(1,u/0.55))); }   /* the lens widens out as it swings round */ if(!T){ laPlace(LA.spinA+k*LA.spinD, LA.spinR, LA.spinE); return; }
    var sw=Math.sin(Math.PI*Math.min(1,k*1.15)); laPlace(LA.spinA+k*LA.spinD, LA.spinR+(LA.spinRS-LA.spinR)*k+sw*2.8, LA.spinE+(T.eye-LA.spinE)*k+sw*1.1);   /* from close it swings out wide on the way round, looking at the stump all the way */
    var m=laE((u-0.72)/0.28); if(m<=0) return;   /* the last stretch eases onto the exact spot and the way it faces */
    var dy=T.yaw-yaw; dy=Math.atan2(Math.sin(dy),Math.cos(dy)); yaw+=dy*m; pitch+=(T.pitch-pitch)*m; camPos.x+=(T.x-camPos.x)*m; camPos.z+=(T.z-camPos.z)*m; camPos.y+=(T.y-camPos.y)*m; if(WK.col&&WK.mode==="walk") WK.eye+=(T.eye-WK.eye)*m; if(typeof basis==="function") basis(); }
  function laLockStart(){ sdSeqCut(); LA.quick=true; laSpinStart(); }   /* a skip: the same landing, just the short way round */
  // ---- the shot: the real viewfinder comes up on the 85, racks focus onto the bark, and fires ----
  function laVfOn(){ if(LA.vf) return; LA.vf=true; LA.ap=apIdx; LA.lens=lensIdx; var b=curBody(), li=b.lenses.indexOf(85); if(li>=0) selectLens(li);
    var bi=apIdx, bd=1e9; APERTURES.forEach(function(N,i){ var d=Math.abs(Math.log(N/LA_AP)); if(d<bd){ bd=d; bi=i; } }); apIdx=typeof apClamp==="function"?apClamp(bi):bi;
    computeCam(); setFocus(0.95); try{ raiseCamera(); }catch(e){} afPending=false; LA.fovTo=camera.fov; LA.fovFrom=25; }
  function laIris(u){ var cv=LA.el.querySelector(".la-iris"); if(u>=1){ cv.style.opacity=0; if(camera){ camera.fov=LA.fovTo; camera.updateProjectionMatrix(); } return; }
    var k=1-Math.pow(1-u,2.4); cv.style.opacity=(1-k).toFixed(3); cv.style.transform="scale("+(1+0.7*k).toFixed(3)+")";   /* a soft dark edge easing open as the lens comes up: transform and opacity only, nothing to repaint */
    if(camera){ camera.fov=LA.fovFrom+(LA.fovTo-LA.fovFrom)*k; camera.updateProjectionMatrix(); } }
  function laVfOff(){ if(!LA.vf) return; LA.vf=false; try{ lowerCamera(); }catch(e){} if(LA.ap!=null){ apIdx=LA.ap; computeCam(); } if(LA.lens!=null) selectLens(LA.lens); afPending=false; var el=$("vfAF"); if(el) el.classList.remove("hunt","ok"); }
  function laFocusTarget(){ var P=viewer&&viewer.P, A=viewer&&viewer.A; if(!P) return 0.5; if(typeof basis==="function") basis(); if(typeof updateCamera==="function") updateCamera(0); camera.updateMatrixWorld();   /* the camera's own autofocus: what's in the middle of the frame */
    var f=new THREE.Vector3(); camera.getWorldDirection(f); var o=camera.position, N=P.length/3, sc=typeof sceneScale==="function"?sceneScale():1, ts=[], st=N>600000?2:1;
    for(var i=0;i<N;i+=st){ if(A&&A[i]<0.12) continue; var vx=P[i*3]-o.x, vy=P[i*3+1]-o.y, vz=P[i*3+2]-o.z, t=vx*f.x+vy*f.y+vz*f.z; if(t<0.25*sc) continue; var p2=vx*vx+vy*vy+vz*vz-t*t, lim=t*0.026+0.01*sc; if(p2<lim*lim) ts.push(t); }
    ts.sort(function(x,y){ return x-y; }); if(ts.length<3){ var r=LA.cam?LA.cam.r:2.2; return Math.max(0,Math.min(1,Math.log(Math.max(0.3,r-0.4)/0.3)/Math.log(60))); }
    var m=ts[Math.min(ts.length-1,4)]/sc; return Math.log(Math.max(0.3,Math.min(18,m))/0.3)/Math.log(60); }
  function laRack(u){ var from=0.95, to=LA.focusTo!=null?LA.focusTo:0.5, el=$("vfAF"); if(u<=0){ if(el){ el.classList.remove("ok"); el.classList.add("hunt"); } return; }
    var v; if(u<0.72){ var k=laE(u/0.72); v=from+(to-0.045-from)*k; } else if(u<0.9){ v=to-0.045+0.065*laE((u-0.72)/0.18); } else v=to+0.02-0.02*laE((u-0.9)/0.1);   /* a long pull, a touch past, back onto it */
    setFocus(v); if(u>=1&&LA.focused<0) LA.focused=0; if(u>=1&&el&&!el.classList.contains("ok")){ el.classList.remove("hunt"); el.classList.add("ok"); } }
  function laGrab(){ var src=renderer.domElement, W=src.width, H=src.height, sx=0, sy=0, cw=W, ch=H;
    if(viewfinderOn&&typeof vfRect==="function"){ var r=vfRect(), kx=W/window.innerWidth, ky=H/window.innerHeight; sx=r.x*kx; sy=r.y*ky; cw=r.w*kx; ch=r.h*ky;
      var sa=innerWidth/innerHeight, ra=r.w/r.h, vh=ra>sa?r.h*sa/ra:r.h; LA.stillFov=2*Math.atan(Math.tan(camera.fov*Math.PI/360)*vh/innerHeight)*180/Math.PI; }   /* the photo, filling the screen, is this narrow a view */
    var c=LA.el.querySelector(".la-still canvas"), w=Math.min(1600,Math.round(cw)), h=Math.max(2,Math.round(w*ch/cw)); c.width=w; c.height=h; c.getContext("2d").drawImage(src,sx,sy,cw,ch,0,0,w,h); }
  function laFire(){ LA.el.classList.add("snap"); sdShutter(null,true);
    setTimeout(function(){ try{ laGrab(); }catch(e){} LA.el.classList.add("held"); laVfOff(); },60); }   /* the photo is read off the screen under the black, where its hitch can't be seen; the lens goes down behind it */
  // ---- the clock ----
  function laTick(now){ if(!LA.on) return; LA.raf=requestAnimationFrame(laTick); laGrade(now); var t=(now-LA.t0)/1000, p=LA.phase, pt=(now-(LA.pt||LA.t0))/1000, e=LA.el;
    if(p==="dark"){ if(t>2.5&&!LA.skipAsked){ LA.skipAsked=true; e.classList.add("skip"); }
      if(!laPrep(t)) return; LA.revT=now; if(LA.fast){ laLockStart(); return; } LA.glideT=now; laPhase("glide"); sdScan(); return; }
    if(p==="glide"){ laGlide(Math.min(1,pt/LA_T.glide)); if(pt>LA_T.glide&&!laHeld()) laPhase("shoot"); return; }
    if(p==="shoot"){ if(!LA.fired) laShootCam(Math.min(1,pt/LA_T.shoot)); if(!LA.vf&&!LA.fired&&pt>0.05){ laShootCam(0); laVfOn(); sdLensUp(); }
      if(LA.vf&&!LA.fired) laIris(Math.min(1,(pt-0.05)/LA_T.iris));
      if(LA.vf&&pt>0.75){ if(!LA.racked){ LA.racked=true; sdRack(null,1.4); } laRack(Math.min(1,(pt-0.75)/1.4)); }
      if(LA.focused>=0) LA.focused++; if(LA.vf&&!LA.fired&&pt>2.3&&LA.focused>=3){ LA.fired=true; laFire(); }   /* fire only once the focus has been on screen a few frames */
      if(LA.fired&&!LA.firedT) LA.firedT=pt; if(LA.firedT&&pt-LA.firedT>0.42&&!laHeld()) laSpinStart(); return; }   /* the still holds a breath, then the world pulls away from it */
    if(p==="spin"){ var su=Math.min(1,pt/(LA.quick?1.6:LA_T.spin)); laSpin(su); if(su>=1&&(LA.quick||!laHeld())) laEnd(); } }
  function laEnd(){ if(!LA.on) return; LA.on=false; LAG.on=false; cancelAnimationFrame(LA.raf); var e=LA.el; LA.welcome=Date.now(); laVfOff(); if(typeof RLB!=="undefined"&&RLB) RLB.camP={x:camPos.x,y:camPos.y,z:camPos.z};   /* the light counts its next metre and a half from where the opening lands, not from the dark */ (CH.pads||[]).forEach(function(P){ P.vis=0; });   /* the gold frames fade in once the wordmark has gone */
    if(loaded){ hubShow("hud"); App.go("scene"); if(typeof updatePrompt==="function") updatePrompt(); } else showHub();
    sdAmbStop(sdNow()+1.6,1.2); if(LA.first&&loaded) LA.wcard=true;   /* first time: hold the tour and the gold frames for the welcome */
    if(e){ e.className="on out"; setTimeout(function(){ e.className=""; document.body.classList.remove("launching"); if(LA.wcard) laWelOpen(); },LA_T.word*1000); } else document.body.classList.remove("launching");
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
  function sdShutter(t,live){ var b=sdSeq(); if(!b) return; t=t==null?sdNow():t;
    if(live&&typeof shutterSound==="function"){ try{ shutterSound(); }catch(e){} } else { sdTick(b,t,2400,0.25); sdTick(b,t+0.055,1900,0.18); }
    sdTone(b,t,96,"sine",0.003,0.2,0.01,0.2,38); sdNoise(b,t,"lowpass",900,0.7,0.002,0.05,0.02,0.2,200);
    if(SD.drone){ sdDroneTo(1,t,0.05); } if(SD.vb){ SD.vb.gain.setTargetAtTime(0.0001,t+0.01,0.06); SD.vb=null; } if(sdVar("shot")) sdVar("shot")(b,t); }
  // ---- five sound options for the beginning (?snd=1..5): the bed, the point cloud, the lens, the focus, the shot.
  //      The spin and the title are the same in all of them. ----
  var SD_V=(function(){ var m=/[?&]snd=(\d)/.exec(location.search); if(m) return +m[1]; try{ var v=localStorage.getItem("studium_open_snd"); if(v!=null) return +v; }catch(e){} return 2; })();   /* Air is the default; ?snd=0..5 to compare */
  var SD_VN=["As it is","Felt","Air","Strings","Pulse","Glass"];
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
        rack:function(b,t,D){ for(var i=0;i<12;i++) sdTone(b,t+D*0.85*(1-Math.pow(1-i/12,1.7)),3520+i*40,"sine",0.001,0.016,0.002,0.04); sdBell(b,t+D,1760,0.05,-0.2,1.2); sdBell(b,t+D+0.11,2637.02,0.05,0.2,1.4); } } };
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
  function sdSpin(t,quick){ var b=sdCtx()&&sdBus(0.6); if(!b) return; t=t==null?sdNow():t; SD.big=b; var D=quick?1.6:LA_T.spin, w=t+0.7;
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
  /* dev: lay the whole opening into an offline buffer and hand back a wav, to check levels without a GPU */
  function sdRender(){ return sdRenderBegin(SD_V); }
  function sdRenderBegin(v){ var was=SD_V; SD_V=v; var sr=44100, dur=20, oc=new OfflineAudioContext(2,sr*dur,sr), pc=SD.ctx; SD.off=true; SD.ctx=null; SD.vb=null; sdWire(oc);
    var D0=1.4, S0=D0+LA_T.glide, F=S0+2.3, P0=F+0.42, E0=P0+LA_T.spin;
    sdAmbStart(0); sdScan(D0); sdLensUp(S0+0.05); sdRack(S0+0.75,1.4); sdShutter(F,false); sdSpin(P0,false); sdAmbStop(E0+1.6,1.2); sdChime(E0+LA_T.word);
    return oc.startRendering().then(function(buf){ SD_V=was; SD.off=false; SD.ctx=null; SD.seq=null; SD.amb=null; SD.vb=null; if(pc) sdWire(pc);
      var n=buf.length, L=buf.getChannelData(0), R=buf.getChannelData(1), pk=0, i, dv=new DataView(new ArrayBuffer(44+n*4)); for(i=0;i<n;i++) pk=Math.max(pk,Math.abs(L[i]),Math.abs(R[i]));
      function ws(o,x){ for(var k=0;k<x.length;k++) dv.setUint8(o+k,x.charCodeAt(k)); } ws(0,"RIFF"); dv.setUint32(4,36+n*4,true); ws(8,"WAVEfmt "); dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,2,true); dv.setUint32(24,sr,true); dv.setUint32(28,sr*4,true); dv.setUint16(32,4,true); dv.setUint16(34,16,true); ws(36,"data"); dv.setUint32(40,n*4,true);
      for(i=0;i<n;i++){ dv.setInt16(44+i*4,Math.max(-1,Math.min(1,L[i]))*32767,true); dv.setInt16(46+i*4,Math.max(-1,Math.min(1,R[i]))*32767,true); }
      var bytes=new Uint8Array(dv.buffer), str=""; for(i=0;i<bytes.length;i+=32768) str+=String.fromCharCode.apply(null,bytes.subarray(i,i+32768));
      return {peak:+pk.toFixed(3), wav:btoa(str)}; }); }
  if(/[?&]dev/.test(location.search)) window.__sd={ render:sdRender, begin:sdRenderBegin };
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
  LA.hold=/[?&]lahold/.test(location.search);
  if(/[?&]dev/.test(location.search)) window.__la={ start:launchStart, skip:laSkip, go:function(){ LA.wait=false; LA.pass=!LA.held; }, wel:function(){ return !!LA.wcard; }, welGo:laWelGo, state:function(){ return {on:LA.on, phase:LA.phase, fast:LA.fast, loaded:loaded, log:LA.log||[], prep:LA.prep?LA.prep.step:-1, focus:LA.focusTo}; }, reset:function(){ try{ localStorage.removeItem(LA_KEY); }catch(e){} } };
