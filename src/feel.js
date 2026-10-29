  // ================= FEEL: the first minute in a place =================
  // How it feels to look and move before anyone has taught you anything. Drag to look (the world sticks to the
  // pointer, like a panorama), click the ground to walk there, and the pointer only locks once the camera's up.
  // A little ease on the look, a gentle slow-down as the aim crosses the subject, R to glide back to it, a soft
  // slow-down near the scan's blurry edges, and a bigger first raise and first frame. Each idea has its own switch
  // in the FEEL panel (?dev), remembered on this computer, so Sam can feel them one at a time.
  var FL_DEF={tour:true, drag:true, smooth:true, pull:true, home:true, edge:true, hand:true, first:true};
  var FL_NAMES=[["tour","New warm-up: 4 steps, lessons inside the frames"],["drag","Drag to look, click the ground to walk"],["smooth","Look smoothing"],["pull","Aim slows a little over the subject"],
    ["home","R glides back to the subject"],["edge","Slow down near the soft edges"],["hand","Launch page racks into the opening"],["first","Big first raise and first frame"]];
  var FL=(function(){ var o={}, s=null; try{ s=JSON.parse(localStorage.getItem("studium_feel")||"null"); }catch(e){}
    for(var k in FL_DEF) o[k]=s&&s[k]!=null?!!s[k]:FL_DEF[k]; if(/[?&]feel=off/.test(location.search)) for(var j in FL_DEF) o[j]=false; return o; })();
  var FLX={dn:null, py:0, pp:0, look:0, used:"", glide:null, edgeSaid:false, fx:null, ring:null, ghost:null, slowAF:false};
  var FL_TAU=0.04, FL_PULL=0.4;
  function flSave(){ try{ localStorage.setItem("studium_feel", JSON.stringify(FL)); }catch(e){} }

  // ---- when the student is free to look and walk without the pointer locked ----
  function flBusy(){ return (typeof QU!=="undefined"&&!!(QU.done||QU.pick||QU.log))||(typeof lsMoveOpen==="function"&&lsMoveOpen())||(typeof LA!=="undefined"&&!!(LA.on||LA.wcard))
      ||(typeof CU!=="undefined"&&!!CU.open)||(typeof RF!=="undefined"&&!!RF.on)||(typeof RLB!=="undefined"&&!!RLB&&!!RLB.open); }
  function flHere(){ return loaded&&(App.is("scene")||App.is("viewfinder"))&&!menuOpen()&&!flBusy(); }
  /* the walk keys work in a place without the pointer locked (app.js asks) */
  function flWalks(){ return FL.drag&&flHere(); }

  // ---- looking: every mouse or drag move comes through here ----
  function flApply(dy,dp){ yaw+=dy; pitch+=dp; var lim=1.553; if(pitch>lim) pitch=lim; if(pitch<-lim) pitch=-lim; }
  /* how much the aim slows as it crosses the subject: a touch, never a stop, and only near enough to see it */
  function flPullK(){ if(!FL.pull||!CH.spec||!CH.spec.subject||!camera) return 1; var S=CH.spec.subject, gy=WK.col?wkGround(S[0],S[1]):camPos.y-1.6, dx=S[0]-camPos.x, dy=gy+0.45-camPos.y, dz=S[1]-camPos.z, L=Math.hypot(dx,dy,dz);
    if(L<0.6||L>12) return 1; var c=(dx*_fwd.x+dy*_fwd.y+dz*_fwd.z)/L, a=Math.acos(Math.max(-1,Math.min(1,c))), w=Math.max(0.05,Math.min(0.12,0.5/L));   /* the subject's own size on screen sets how wide the slow patch is */
    var u=Math.max(0,Math.min(1,(w-a)/(w*0.8))); return 1-FL_PULL*u*u*(3-2*u); }
  function flLook(dy,dp){ if(Math.abs(dy)>0.5||Math.abs(dp)>0.5) return;   /* a lock's first move can be a wild jump */
    var k=flPullK(); dy*=k; dp*=k; var was=FLX.look; FLX.look+=Math.abs(dy)+Math.abs(dp); if(was<=0.6&&FLX.look>0.6) updatePrompt();
    if(FL.smooth){ FLX.py+=dy; FLX.pp+=dp; } else flApply(dy,dp); }
  /* each frame, from updateCamera: the eased look, the glides */
  function flTick(dt){ if(FLX.py||FLX.pp){ if(chHold()||(typeof LA!=="undefined"&&LA.on)||(CH&&CH.intro)){ FLX.py=FLX.pp=0; }
      else { var tau=FL_TAU*(viewfinderOn&&chEquivMM()>100?1.6:1), k=dt>0?1-Math.exp(-dt/tau):0, a=FLX.py*k, b=FLX.pp*k; flApply(a,b); FLX.py-=a; FLX.pp-=b; if(Math.abs(FLX.py)+Math.abs(FLX.pp)<1e-6) FLX.py=FLX.pp=0; } }
    if(FLX.glide) flGlideTick(dt); }

  // ---- drag to look, click to walk ----
  function flRadPx(){ var v=(camera?camera.fov:55)*Math.PI/180; return v/Math.max(1,window.innerHeight); }   /* the world sticks to the pointer: a drag the height of the screen turns you one field of view */
  document.addEventListener("pointerdown",function(e){ if(!FL.drag||e.button!==0||looking||!renderer||e.target!==renderer.domElement||!flHere()) return;
    FLX.dn={x:e.clientX, y:e.clientY, lx:e.clientX, ly:e.clientY, t:performance.now(), id:e.pointerId, moved:false}; try{ e.target.setPointerCapture(e.pointerId); }catch(er){} });
  document.addEventListener("pointermove",function(e){ var D=FLX.dn; if(!D||e.pointerId!==D.id) return;
    if(!D.moved){ if(Math.abs(e.clientX-D.x)+Math.abs(e.clientY-D.y)<5) return; D.moved=true; D.lx=e.clientX; D.ly=e.clientY; document.body.classList.add("fl-dragging"); try{ localStorage.setItem("studium_looked","1"); }catch(er){} return; }
    if(!flHere()||chHold()) { D.lx=e.clientX; D.ly=e.clientY; return; }
    var fb=(viewfinderOn?curBody().finder:""), ys=(fb==="waist"||fb==="ground")?-1:1, ps=(fb==="ground")?-1:1, k=flRadPx();
    flLook((e.clientX-D.lx)*k*ys, (e.clientY-D.ly)*k*ps); D.lx=e.clientX; D.ly=e.clientY; });
  function flUp(e){ var D=FLX.dn; if(!D||e.pointerId!==D.id) return; FLX.dn=null; document.body.classList.remove("fl-dragging"); try{ renderer.domElement.releasePointerCapture(e.pointerId); }catch(er){}
    if(!D.moved&&e.type==="pointerup"&&performance.now()-D.t<450&&!viewfinderOn&&flHere()) flClickGo(e.clientX,e.clientY); }
  document.addEventListener("pointerup",flUp); document.addEventListener("pointercancel",flUp);
  /* with the pointer locked and the camera down, a click walks you to the spot under the crosshair */
  document.addEventListener("mousedown",function(e){ if(!FL.drag||e.button!==0||!looking||viewfinderOn||!flHere()) return; flClickGo(window.innerWidth/2, window.innerHeight/2); });
  /* the camera comes up: the pointer locks so the mouse aims it (raiseCamera asks) */
  function flLockForCamera(){ if(!FL.drag||looking||!renderer) return; try{ var p=renderer.domElement.requestPointerLock(); if(p&&p.catch) p.catch(function(){}); }catch(e){} }

  // where a point on the screen meets the ground (or the first solid thing), from the scan's walk map
  var _flV=new THREE.Vector3();
  function flHit(cx,cy){ if(!WK.col||!camera) return null; _flV.set(cx/window.innerWidth*2-1, -(cy/window.innerHeight)*2+1, 0.5).unproject(camera).sub(camera.position).normalize();
    var o=camera.position, d=_flV, t=0.25, step=0.04;
    for(;t<30;t+=step){ var x=o.x+d.x*t, y=o.y+d.y*t, z=o.z+d.z*t, top=wkTop(x,z); if(top&&y<top) return {x:x, z:z, solid:true}; if(y<=wkGround(x,z)) return {x:x, z:z, solid:false}; step=Math.min(0.15,0.04+t*0.008); }
    return null; }
  /* the furthest clear point along the straight line from here to (x,z), a body's width short of anything solid */
  function flClear(x,z){ var x0=camPos.x, z0=camPos.z, dx=x-x0, dz=z-z0, L=Math.hypot(dx,dz), feet=wkFeet(), best=0; if(L<0.05) return null;
    for(var s=0.1;s<=L+1e-6;s+=0.1){ var u=Math.min(1,s/L); if(wkBlocked(x0+dx*u, z0+dz*u, feet)) break; best=s; }
    best=Math.min(L,best>=L-1e-6?L:Math.max(0,best-0.15)); if(best<0.25) return null;
    if(BND.on&&boundsOn){ var r=BND.r-0.3, ex=x0+dx*best/L-BND.cx, ez=z0+dz*best/L-BND.cz, ed=Math.hypot(ex,ez); if(ed>r){ /* stop at the boundary, along the same line */ for(var b=best;b>0;b-=0.1){ var qx=x0+dx*b/L-BND.cx, qz=z0+dz*b/L-BND.cz; if(Math.hypot(qx,qz)<=r){ best=b; break; } if(b<=0.1) return null; } } }
    return {x:x0+dx*best/L, z:z0+dz*best/L, d:best}; }
  function flClickGo(cx,cy){ var h=flHit(cx,cy); if(!h){ return; } var c=flClear(h.x,h.z); if(!c) return;
    FLX.used="click"; FLX.clicks=(FLX.clicks||0)+1;
    flGlideTo({x:c.x, z:c.z, dur:Math.max(0.55,Math.min(1.8,0.45+c.d*0.32))}); flRing(c.x,c.z); sfx("select"); }
  /* a glide: position (and, going home, the way you face and how high your eyes are), eased in and out; any walk key takes over */
  function flGlideTo(o){ var walk=!!(WK.col&&WK.mode==="walk"); FLX.glide={x0:camPos.x, z0:camPos.z, x1:o.x, z1:o.z, t:0, dur:o.dur||1, yaw0:yaw, dyaw:o.yaw!=null?chWrap(o.yaw-yaw):null, p0:pitch, p1:o.pitch, e0:walk?WK.eye:camPos.y, e1:o.eye, walk:walk}; _vel.set(0,0,0); }
  function flGlideTick(dt){ var G=FLX.glide; if(chHold()||(typeof LA!=="undefined"&&LA.on)||(CH&&CH.intro)||keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD||keys.KeyQ||keys.KeyE){ FLX.glide=null; return; }
    G.t=Math.min(1,G.t+dt/G.dur); var x=G.t, s=x*x*x*(x*(x*6-15)+10); _vel.set(0,0,0);
    camPos.x=G.x0+(G.x1-G.x0)*s; camPos.z=G.z0+(G.z1-G.z0)*s;
    if(G.dyaw!=null) yaw=G.yaw0+G.dyaw*s; if(G.p1!=null) pitch=G.p0+(G.p1-G.p0)*s;
    if(G.e1!=null){ if(G.walk) WK.eye=G.e0+(G.e1-G.e0)*s; else camPos.y=G.e0+(G.e1-G.e0)*s; }
    if(G.t>=1){ FLX.glide=null; if(WK.col&&!wkBlocked(camPos.x,camPos.z,wkFeet())) wkFree(); } }

  // ---- R: back to a good view of the subject (the scene's own starting spot) ----
  function flHome(){ if(!FL.home||!flHere()||chHold()) return; var sp=CH.spec&&CH.spec.spawn, S=CH.spec&&CH.spec.subject; if(!sp&&!S) return;
    var walk=!!(WK.col&&WK.mode==="walk"), x, z, yw, pt, eye;
    if(sp){ x=sp[0]; z=sp[1]; yw=sp[2]||0; pt=sp[3]||-0.1; eye=walk?(sp[4]||1.6):(WK.col?wkGround(x,z)+(sp[4]||1.6):camPos.y); }
    else { var a=Math.atan2(camPos.x-S[0],camPos.z-S[1]); x=S[0]+Math.sin(a)*2.5; z=S[1]+Math.cos(a)*2.5; yw=a; pt=-0.2; eye=walk?1.6:camPos.y; }
    var d=Math.hypot(x-camPos.x,z-camPos.z); flGlideTo({x:x, z:z, yaw:yw, pitch:pt, eye:eye, dur:Math.max(1.0,Math.min(2.6,0.9+d*0.28))}); sfx("select"); }
  window.addEventListener("keydown",function(e){ if(e.code!=="KeyR"||e.repeat||e.ctrlKey||e.metaKey||e.altKey) return; var t=e.target, tag=t&&t.tagName; if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||(t&&t.isContentEditable)) return;
    if(!FL.home||!flHere()) return; e.preventDefault(); flHome(); });

  // ---- the soft edges: walking out towards the blurry part slows you, and once a session it says why ----
  function flEdge(mv){ if(!FL.edge||!BND.on||!boundsOn) return; var dx=camPos.x-BND.cx, dz=camPos.z-BND.cz, d=Math.hypot(dx,dz), r0=BND.r*0.6; if(d<r0||d<1e-3) return;
    var out=(mv.x*dx+mv.z*dz)/d; if(out<=0) return; var u=Math.min(1,(d-r0)/(BND.r-r0)), k=0.75*u*u*(3-2*u); mv.x-=dx/d*out*k; mv.z-=dz/d*out*k;
    if(!FLX.edgeSaid&&u>0.55){ FLX.edgeSaid=true; toast("Out here the scan goes soft. It's only sharp close to "+chSubjectName().replace(/^The /,"the ")+"."); } }

  // ---- marks in the world: where a click is taking you, and the warm-up's low frame ----
  function flFx(){ if(FLX.fx) return FLX.fx; FLX.fx=new THREE.Scene(); return FLX.fx; }
  function flRing(x,z){ var fx=flFx(); if(!FLX.ring){ var m=new THREE.MeshBasicMaterial({color:0xf2c068, transparent:true, opacity:0, depthTest:false, depthWrite:false, side:THREE.DoubleSide});
      FLX.ring=new THREE.Mesh(new THREE.RingGeometry(0.15,0.19,48), m); FLX.ring.rotation.x=-Math.PI/2; fx.add(FLX.ring); }
    FLX.ring.position.set(x, wkGround(x,z)+0.02, z); FLX.ring.userData.t=0; FLX.ring.visible=true; }
  /* the warm-up's guided shot: a gold frame hung low in front of the subject, the same kind as the challenge frames */
  function flGhostOn(){ if(FLX.ghost||!WK.col||!CH.spec||!CH.spec.subject) return FLX.ghost; var S=CH.spec.subject, sp=CH.spec.spawn, a=sp?Math.atan2(sp[0]-S[0],sp[1]-S[1]):0, x, z;
    for(var tries=0;tries<12;tries++){ var aa=a+(tries%2?1:-1)*Math.ceil(tries/2)*0.3; x=S[0]+Math.sin(aa)*1.5; z=S[1]+Math.cos(aa)*1.5; if(!wkBlocked(x,z,wkGround(x,z))) break; }
    var E=new THREE.Vector3(x, wkGround(x,z)+0.45, z), T=new THREE.Vector3(S[0], wkGround(S[0],S[1])+0.75, S[1]), d=T.clone().sub(E).normalize(), D=0.45, mm=35;
    var w=2*D*Math.tan(Math.atan(18/mm))*0.97, h=w/1.5, pad=w*0.16, size=new THREE.Vector2(w,h);
    var m=new THREE.ShaderMaterial({uniforms:{t:{value:0},done:{value:0},lock:{value:0},fade:{value:0},glow:{value:0.4},pad:{value:pad},size:{value:size}}, vertexShader:CH_VS, fragmentShader:CH_FRAME_FS, transparent:true, depthTest:false, depthWrite:false, side:THREE.DoubleSide});
    var fr=new THREE.Mesh(new THREE.PlaneGeometry(w+2*pad,h+2*pad), m), F=E.clone().addScaledVector(d,D); fr.position.copy(F); fr.up.set(0,1,0); fr.lookAt(E); flFx().add(fr);
    FLX.ghost={E:E, T:T, d:d, F:F, frame:fr, vis:0, t:0}; return FLX.ghost; }
  function flGhostOff(){ var G=FLX.ghost; if(!G) return; FLX.ghost=null; try{ flFx().remove(G.frame); G.frame.geometry.dispose(); G.frame.material.dispose(); }catch(e){} }
  /* how well you're lined up with the low frame: near its eye point, low enough, facing through it */
  function flGhostFit(){ var G=FLX.ghost; if(!G) return {ok:false, hz:Infinity, dy:0, ang:180}; var hz=Math.hypot(camPos.x-G.E.x,camPos.z-G.E.z), dy=camPos.y-G.E.y, ang=Math.acos(Math.max(-1,Math.min(1,G.d.dot(_fwd))))*180/Math.PI;
    return {hz:hz, dy:dy, ang:ang, near:hz<0.6, low:dy<0.3, ok:hz<0.6&&dy<0.3&&ang<14}; }
  function flRender(dt){ if(!FLX.fx||CH.capturing) return; var any=false;
    var R=FLX.ring; if(R&&R.visible){ R.userData.t+=dt||0.016; var u=R.userData.t; R.material.opacity=Math.max(0,0.9*Math.min(1,u/0.12)*(FLX.glide?1:Math.max(0,1-(u-0.2)*2.5))); var s=1+0.25*Math.min(1,u/0.5); R.scale.set(s,s,1); if(R.material.opacity<=0&&!FLX.glide&&u>0.3) R.visible=false; else any=true; }
    var G=FLX.ghost; if(G){ G.t+=dt||0.016; G.vis+=(1-G.vis)*(1-Math.exp(-(dt||0.016)*1.5)); var f=flGhostFit(), U=G.frame.material.uniforms; U.t.value=G.t; U.lock.value+=((f.ok?1:0)-U.lock.value)*0.2;
      U.glow.value=f.ok?0.9:0.35; U.fade.value=G.vis*(viewfinderOn?0.45:Math.max(0.5,Math.min(1,1.4-G.F.distanceTo(camPos)/12))); any=true; }
    if(!any) return; var ac=renderer.autoClear; renderer.autoClear=false; renderer.render(FLX.fx, camera); renderer.autoClear=ac; }

  // ---- the first raise and the first frame, once per student (the demo reset brings them back) ----
  /* raiseCamera calls this first: the finder comes up slowly, the edges close in, focus starts soft and hunts onto the subject */
  function flRaise(){ if(FL.drag) flLockForCamera(); if(!FL.first||(typeof LA!=="undefined"&&LA.on)||Q.flags.vf1) return false; Q.flags.vf1=1; qSave();
    var b=document.body; b.classList.add("fl-raise1"); void b.offsetWidth; clearTimeout(FLX.raiseT); FLX.raiseT=setTimeout(function(){ b.classList.remove("fl-raise1"); },1900); sfx("raise");
    setFocus(focusMin()); FLX.slowAF=true; setTimeout(function(){ if(viewfinderOn) afPending=true; },700); return true; }
  /* shutter calls this: the first photo develops in the middle of the screen, then goes into your studio */
  function flShot(url){ if(FLX.ghost&&flGhostFit().ok) FLX.ghostHit=true;
    if(!FL.first||Q.flags.shot1) return; Q.flags.shot1=1; qSave(); var fly=$("captureFly"); if(fly) fly.style.opacity="0";
    var e=$("flPrint"); if(!e){ e=document.createElement("div"); e.id="flPrint"; e.innerHTML='<div class="fp-card"><img alt=""><span class="fp-k">YOUR FIRST PHOTO</span><b>It\'s in your studio now</b><em>Press Tab any time to see your photos</em></div>'; document.body.appendChild(e); }
    var img=e.querySelector("img"); img.src=url; e.className=""; e.style.transform=""; e.style.opacity=""; void e.offsetWidth; e.className="show";
    clearTimeout(FLX.printT); FLX.printT=setTimeout(function(){ var t=$("photoCount"), r=t?t.getBoundingClientRect():{left:window.innerWidth-46,top:16,width:24,height:24}, c=e.querySelector(".fp-card").getBoundingClientRect();
      e.className="show fly"; e.style.transform="translate("+((r.left+r.width/2)-(c.left+c.width/2)).toFixed(0)+"px,"+((r.top+r.height/2)-(c.top+c.height/2)).toFixed(0)+"px) scale(.06)"; e.style.opacity="0";
      setTimeout(function(){ e.className=""; e.style.transform=""; e.style.opacity=""; },900); },3200); }

  // ---- the FEEL panel (?dev): one switch per idea ----
  function flPanel(){ if(!/[?&]dev/.test(location.search)) return; var b=document.createElement("button"); b.id="flBtn"; b.textContent="FEEL"; document.body.appendChild(b);
    var p=document.createElement("div"); p.id="flPanel"; document.body.appendChild(p);
    function draw(){ p.innerHTML='<b>The first minute</b>'+FL_NAMES.map(function(n){ return '<label><input type="checkbox" data-fl="'+n[0]+'"'+(FL[n[0]]?' checked':'')+'><span>'+n[1]+'</span></label>'; }).join("")
      +'<div class="fl-row"><button data-fl-do="all">ALL ON</button><button data-fl-do="none">ALL OFF</button></div><div class="fl-row"><button data-fl-do="warm">REPLAY WARM-UP</button><button data-fl-do="fresh">FIRST TIME AGAIN</button></div>'
      +'<em>The launch page switch takes effect next time it plays. FIRST TIME AGAIN brings back the big first raise and shot, and the lessons in the frames.</em>'; }
    draw(); b.addEventListener("click",function(){ p.classList.toggle("show"); draw(); });
    p.addEventListener("change",function(e){ var k=e.target.getAttribute("data-fl"); if(!k) return; FL[k]=!!e.target.checked; flSave(); flApplyAll(); });
    p.addEventListener("click",function(e){ var d=e.target.closest("[data-fl-do]"); if(!d) return; var a=d.getAttribute("data-fl-do");
      if(a==="all"||a==="none"){ for(var k in FL_DEF) FL[k]=a==="all"; flSave(); flApplyAll(); draw(); }
      else if(a==="warm"){ p.classList.remove("show"); if(typeof coStart==="function") coStart("basics",true); }
      else if(a==="fresh"){ delete Q.flags.vf1; delete Q.flags.shot1; ["kbag","kback"].forEach(function(t){ delete Q.tours[t]; delete Q.tourStep[t]; }); qSave(); toast("First-time moments and frame lessons are back"); } }); }
  function flApplyAll(){ document.body.classList.toggle("fl-drag", !!FL.drag); var hb=$("navHomeV"); if(hb) hb.classList.toggle("hidden", !FL.home);
    var pr=$("prompt"), pl=pr&&pr.querySelector(".pill"); if(pl) pl.innerHTML='<span class="dot"></span>'+(FL.drag?'Drag to look around · click the ground to walk there':'Click to look around');
    var nc=$("navCoach"), ns=nc&&nc.querySelector("span"); if(ns) ns.innerHTML=FL.drag?'Drag to look around. <em>Click the ground to walk, or use</em> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>':'Click to look around. <em>Walk with</em> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>';
    if(!FL.drag&&FLX.dn){ FLX.dn=null; document.body.classList.remove("fl-dragging"); } if(!FL.smooth){ flApply(FLX.py,FLX.pp); FLX.py=FLX.pp=0; }
    if(typeof coBasicsPick==="function") coBasicsPick(); if(typeof updatePrompt==="function") updatePrompt(); }
  (function flInit(){ var acts=$("navActs"); if(acts&&!$("navHomeV")){ var hb=document.createElement("button"); hb.id="navHomeV"; hb.setAttribute("data-nav-act","subject"); hb.innerHTML='BACK TO SUBJECT <span>R</span>'; acts.insertBefore(hb, acts.children[1]||null); }
    flPanel(); flApplyAll(); })();
  if(/[?&]dev/.test(location.search)) window.__fl={ state:function(){ return {FL:FL, look:+FLX.look.toFixed(2), used:FLX.used, glide:!!FLX.glide, ghost:FLX.ghost?flGhostFit():null, hit:!!FLX.ghostHit}; }, set:function(k,v){ FL[k]=!!v; flSave(); flApplyAll(); }, go:function(x,y){ flClickGo(x,y); }, hit:function(x,y){ var h=flHit(x,y); return h?{h:h, c:flClear(h.x,h.z), cam:[camPos.x,camPos.z]}:null; }, home:flHome, _g:function(){ var G=FLX.ghost; return G?{E:{x:G.E.x, z:G.E.z}, d:{x:G.d.x, y:G.d.y, z:G.d.z}}:null; }, look:function(dy,dp){ flLook(dy,dp||0); } };
