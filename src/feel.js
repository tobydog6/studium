  // ================= FEEL: looking and moving in a place =================
  // Drag swings you round the subject, always facing it: side to side goes round, up and down raises and lowers your
  // eye. Walk with W A S D and the mouse locks to look around, like a game; click and drag again and it lets go, back
  // to swinging round. Raising the camera locks the mouse too, so it aims. A little ease on the look, and the aim
  // slows a touch as it crosses the subject. Each idea has its own switch in the FEEL panel (?dev), remembered on
  // this computer, so Sam can feel them one at a time.
  var FL_DEF={orbit:true, smooth:true, pull:true};
  var FL_NAMES=[["orbit","Drag swings you round the subject; W A S D locks the mouse to look"],["smooth","Look smoothing"],["pull","Aim slows a little over the subject"]];
  var FL=(function(){ var o={}, s=null; try{ s=JSON.parse(localStorage.getItem("studium_feel")||"null"); }catch(e){}
    for(var k in FL_DEF) o[k]=s&&s[k]!=null?!!s[k]:FL_DEF[k]; if(/[?&]feel=off/.test(location.search)) for(var j in FL_DEF) o[j]=false; return o; })();
  var FLX={dn:null, py:0, pp:0, look:0, orb:0, face:null};
  var FL_TAU=0.04, FL_PULL=0.4, FL_FACE=0.09;
  function flSave(){ try{ localStorage.setItem("studium_feel", JSON.stringify(FL)); }catch(e){} }

  // ---- when the student is free to look and walk without the pointer locked ----
  function flBusy(){ return (typeof QU!=="undefined"&&!!(QU.done||QU.pick||QU.log))||(typeof lsMoveOpen==="function"&&lsMoveOpen())||(typeof LA!=="undefined"&&!!(LA.on||LA.wcard))
      ||(typeof CU!=="undefined"&&!!CU.open)||(typeof RF!=="undefined"&&!!RF.on)||(typeof RLB!=="undefined"&&!!RLB&&!!RLB.open); }
  function flHere(){ return loaded&&(App.is("scene")||App.is("viewfinder"))&&!menuOpen()&&!flBusy(); }
  /* the walk keys work in a place without the pointer locked (app.js asks) */
  function flWalks(){ return FL.orbit&&flHere(); }

  // ---- looking: every locked mouse move comes through here ----
  function flApply(dy,dp){ yaw+=dy; pitch+=dp; var lim=1.553; if(pitch>lim) pitch=lim; if(pitch<-lim) pitch=-lim; }
  /* the point everything turns round: the subject, a little off the ground */
  function flSubj(){ var S=CH.spec&&CH.spec.subject; if(!S) return null; return {x:S[0], z:S[1], y:(WK.col?wkGround(S[0],S[1]):camPos.y-1.6)+0.45}; }
  /* how much the aim slows as it crosses the subject: a touch, never a stop, and only near enough to see it */
  function flPullK(){ var S=FL.pull&&camera?flSubj():null; if(!S) return 1; var dx=S.x-camPos.x, dy=S.y-camPos.y, dz=S.z-camPos.z, L=Math.hypot(dx,dy,dz);
    if(L<0.6||L>12) return 1; var c=(dx*_fwd.x+dy*_fwd.y+dz*_fwd.z)/L, a=Math.acos(Math.max(-1,Math.min(1,c))), w=Math.max(0.05,Math.min(0.12,0.5/L));   /* the subject's own size on screen sets how wide the slow patch is */
    var u=Math.max(0,Math.min(1,(w-a)/(w*0.8))); return 1-FL_PULL*u*u*(3-2*u); }
  function flLook(dy,dp){ if(Math.abs(dy)>0.5||Math.abs(dp)>0.5) return;   /* a lock's first move can be a wild jump */
    var k=flPullK(); dy*=k; dp*=k; var was=FLX.look; FLX.look+=Math.abs(dy)+Math.abs(dp); FLX.face=null; if(was<=0.6&&FLX.look>0.6) updatePrompt();
    if(FL.smooth){ FLX.py+=dy; FLX.pp+=dp; } else flApply(dy,dp); }
  /* each frame, from updateCamera: the eased look, and turning to face the subject while you swing round it */
  function flTick(dt){ var hold=chHold()||(typeof LA!=="undefined"&&LA.on)||(CH&&CH.intro);
    if(FLX.py||FLX.pp){ if(hold){ FLX.py=FLX.pp=0; }
      else { var tau=FL_TAU*(viewfinderOn&&chEquivMM()>100?1.6:1), k=dt>0?1-Math.exp(-dt/tau):0, a=FLX.py*k, b=FLX.pp*k; flApply(a,b); FLX.py-=a; FLX.pp-=b; if(Math.abs(FLX.py)+Math.abs(FLX.pp)<1e-6) FLX.py=FLX.pp=0; } }
    var F=FLX.face; if(F){ if(hold){ FLX.face=null; return; } var q=dt>0?1-Math.exp(-dt/FL_FACE):0, dy=chWrap(F.yaw-yaw), dp=F.pitch-pitch; yaw+=dy*q; pitch+=dp*q;
      if(!FLX.dn&&Math.abs(dy)+Math.abs(dp)<0.002) FLX.face=null; } }

  // ---- drag: round the subject ----
  /* side to side goes round at about a turn per screen width; up and down moves your eye about a metre per half a screen */
  function flOrbit(mx,my){ var S=flSubj(), W=Math.max(1,window.innerWidth), H=Math.max(1,window.innerHeight);
    if(!S){ var k=(camera?camera.fov:55)*Math.PI/180/H; flLook(mx*k, my*k); return; }   /* no subject (your own scan): drag just looks */
    var ox=camPos.x-S.x, oz=camPos.z-S.z, r=Math.hypot(ox,oz), a=r>1e-3?Math.atan2(ox,oz):yaw;
    var da=-mx*Math.PI*2/W, a2=a+da, nx=S.x+Math.sin(a2)*r, nz=S.z+Math.cos(a2)*r, walk=!!(WK.col&&WK.mode==="walk");
    if(r>0.3&&!(WK.col&&wkBlocked(nx,nz,wkFeet()))){ camPos.x=nx; camPos.z=nz; }   /* standing right over it: you only turn; something solid in the way: you stop there */
    var de=my*2.2/H; if(walk) WK.eye=Math.max(WK_EYE_MIN,Math.min(WK_EYE_MAX,WK.eye+de)); else { camPos.y+=de; if(WK.col) camPos.y=Math.max(camPos.y,wkGround(camPos.x,camPos.z)+0.15); }
    _vel.set(0,0,0); FLX.py=FLX.pp=0; FLX.orb+=Math.abs(da)+Math.abs(de);
    var ey=walk?wkGround(camPos.x,camPos.z)+WK.eye:camPos.y, rr=Math.hypot(camPos.x-S.x,camPos.z-S.z);
    FLX.face={yaw:Math.atan2(camPos.x-S.x,camPos.z-S.z), pitch:Math.atan2(S.y-ey,Math.max(0.3,rr))}; if(FLX.orb-Math.abs(da)<=0.6&&FLX.orb>0.6) updatePrompt(); }
  /* a press on the picture: with the camera down it's a drag round the subject (letting go of the mouse if it was locked) */
  document.addEventListener("pointerdown",function(e){ if(!FL.orbit||e.button!==0||!renderer||!flHere()) return;
    var onPic=e.target===renderer.domElement||(looking&&document.pointerLockElement===renderer.domElement); if(!onPic) return;
    if(viewfinderOn&&looking) return;   /* camera up and locked: the click is the shutter (app.js) */
    if(looking){ try{ document.exitPointerLock(); }catch(er){} }
    FLX.dn={id:e.pointerId, acc:0, moved:false, vf:!!viewfinderOn}; if(!looking) try{ e.target.setPointerCapture(e.pointerId); }catch(er){} });
  document.addEventListener("pointermove",function(e){ var D=FLX.dn; if(!D||e.pointerId!==D.id) return; var mx=e.movementX||0, my=e.movementY||0;
    if(!D.moved){ D.acc+=Math.abs(mx)+Math.abs(my); if(D.acc<4) return; D.moved=true; document.body.classList.add("fl-dragging"); try{ localStorage.setItem("studium_looked","1"); }catch(er){} }
    if(!flHere()||chHold()) return;
    if(D.vf){ var fb=curBody().finder, ys=(fb==="waist"||fb==="ground")?-1:1, ps=(fb==="ground")?-1:1, k=(camera?camera.fov:55)*Math.PI/180/Math.max(1,window.innerHeight); flLook(mx*k*ys, my*k*ps); return; }   /* the camera's up but the lock didn't take: dragging aims it */
    flOrbit(mx,my); });
  function flUp(e){ var D=FLX.dn; if(!D||e.pointerId!==D.id) return; FLX.dn=null; document.body.classList.remove("fl-dragging"); try{ renderer.domElement.releasePointerCapture(e.pointerId); }catch(er){}
    if(D.vf&&!D.moved&&e.type==="pointerup"&&viewfinderOn&&!looking&&flHere()) shutter(); }   /* camera up without the lock: a click shoots, a drag aims */
  document.addEventListener("pointerup",flUp); document.addEventListener("pointercancel",flUp);
  /* W A S D: the mouse locks and looks around as you walk */
  window.addEventListener("keydown",function(e){ if(!FL.orbit||e.repeat||looking||FLX.dn||!renderer) return; if(e.code!=="KeyW"&&e.code!=="KeyA"&&e.code!=="KeyS"&&e.code!=="KeyD") return;
    var t=e.target, tag=t&&t.tagName; if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||(t&&t.isContentEditable)||e.ctrlKey||e.metaKey||e.altKey) return; if(!flHere()) return;
    try{ var p=renderer.domElement.requestPointerLock(); if(p&&p.catch) p.catch(function(){}); }catch(er){} });
  /* the camera comes up: the pointer locks so the mouse aims it (raiseCamera asks) */
  function flLockForCamera(){ if(!FL.orbit||looking||!renderer) return; try{ var p=renderer.domElement.requestPointerLock(); if(p&&p.catch) p.catch(function(){}); }catch(e){} }

  // ---- the FEEL panel (?dev): one switch per idea ----
  function flPanel(){ if(!/[?&]dev/.test(location.search)) return; var b=document.createElement("button"); b.id="flBtn"; b.textContent="FEEL"; document.body.appendChild(b);
    var p=document.createElement("div"); p.id="flPanel"; document.body.appendChild(p);
    function draw(){ p.innerHTML='<b>Looking and moving</b>'+FL_NAMES.map(function(n){ return '<label><input type="checkbox" data-fl="'+n[0]+'"'+(FL[n[0]]?' checked':'')+'><span>'+n[1]+'</span></label>'; }).join("")
      +'<div class="fl-row"><button data-fl-do="all">ALL ON</button><button data-fl-do="none">ALL OFF</button><button data-fl-do="warm">REPLAY WARM-UP</button></div>'; }
    draw(); b.addEventListener("click",function(){ p.classList.toggle("show"); draw(); });
    p.addEventListener("change",function(e){ var k=e.target.getAttribute("data-fl"); if(!k) return; FL[k]=!!e.target.checked; flSave(); flApplyAll(); });
    p.addEventListener("click",function(e){ var d=e.target.closest("[data-fl-do]"); if(!d) return; var a=d.getAttribute("data-fl-do");
      if(a==="all"||a==="none"){ for(var k in FL_DEF) FL[k]=a==="all"; flSave(); flApplyAll(); draw(); }
      else if(a==="warm"){ p.classList.remove("show"); if(typeof coStart==="function") coStart("basics",true); } }); }
  function flApplyAll(){ document.body.classList.toggle("fl-orbit", !!FL.orbit);
    var pr=$("prompt"), pl=pr&&pr.querySelector(".pill"); if(pl) pl.innerHTML='<span class="dot"></span>'+(FL.orbit?'Drag to go round · <b>W A S D</b> to walk':'Click to look around');
    var nc=$("navCoach"), ns=nc&&nc.querySelector("span"); if(ns) ns.innerHTML=FL.orbit?'Drag to go round the subject. <em>Walk with</em> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>':'Click to look around. <em>Walk with</em> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>';
    if(!FL.orbit&&FLX.dn){ FLX.dn=null; document.body.classList.remove("fl-dragging"); } if(!FL.smooth){ flApply(FLX.py,FLX.pp); FLX.py=FLX.pp=0; }
    if(typeof updatePrompt==="function") updatePrompt(); }
  flPanel(); flApplyAll();
  if(/[?&]dev/.test(location.search)) window.__fl={ state:function(){ return {FL:FL, look:+FLX.look.toFixed(2), orb:+FLX.orb.toFixed(2), face:!!FLX.face, drag:!!FLX.dn}; }, set:function(k,v){ FL[k]=!!v; flSave(); flApplyAll(); }, orbit:function(mx,my){ flOrbit(mx,my||0); }, look:function(dy,dp){ flLook(dy,dp||0); } };
