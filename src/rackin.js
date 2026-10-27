  // ================= RACK-IN: the launch page =================
  // The live scan, close on the stump with the 85 wide open. Wherever the pointer goes, the lens racks to that depth
  // (Spark's real depth of field). The name hangs in the scene a few metres back, and the Launch the demo button sits in
  // the foreground, so each one is only sharp when you focus on it. Light wind moves the leaves. Play racks onto the name,
  // goes to dark, and the demo's opening takes over. Shown instead of the sign-in card in the demo-only build.
  var RF={on:false, el:null, f:0.9, ft:0.9, idle:true, t0:0, raf:0, pick:0, px:-1, py:-1, going:false, fov:null, wind:null, over:null};
  var RF_WORD=4.5, RF_BTN=1.0, RF_MM=85, RF_N=1.4;
  function rfEl(){ var e=$("rackin"); if(e) return e; e=document.createElement("div"); e.id="rackin";
    e.innerHTML='<div class="rf-dark"></div><div class="rf-vig"></div>'
      +'<div class="rf-word" aria-hidden="true"><b>Studium</b><span>Shoot, edit, research and build your folio, all in one place</span></div>'
      +'<h1 class="rf-sr">Studium. Shoot, edit, research and build your folio, all in one place.</h1>'
      +'<button class="rf-go" type="button"><span class="t">Launch the demo</span><span class="s">ABOUT 30 MIN</span></button>'
      +'<div class="rf-hint">MOVE TO FOCUS</div><div class="rf-load">OPENING THE STUMP</div>';
    document.body.appendChild(e);
    e.addEventListener("pointermove",function(ev){ RF.px=ev.clientX; RF.py=ev.clientY; RF.idle=false; });
    e.addEventListener("pointerleave",function(){ RF.px=-1; });
    var b=e.querySelector(".rf-go");
    b.addEventListener("pointerenter",function(){ RF.over="btn"; }); b.addEventListener("pointerleave",function(){ RF.over=null; });
    b.addEventListener("focus",function(){ RF.over="btn"; }); b.addEventListener("blur",function(){ RF.over=null; });
    b.addEventListener("click",function(ev){ ev.stopPropagation(); rfPlay(); });
    window.addEventListener("keydown",function(ev){ if(!RF.on) return; ev.stopImmediatePropagation(); if(ev.key==="Enter"&&!ev.repeat){ ev.preventDefault(); rfPlay(); } else if(ev.key!=="Tab") ev.preventDefault(); },true);
    window.addEventListener("keyup",function(ev){ if(RF.on) ev.stopImmediatePropagation(); },true);
    return e; }
  function rfShow(){ if(RF.on) return; RF.on=true; RF.going=false; RF.idle=true; RF.f=RF.ft=0.9; RF.t0=performance.now(); RF.over=null;
    var e=rfEl(); RF.el=e; e.className="on"; document.body.classList.add("rackin");
    ["hub","landing","studio","punctum","signin","teacher","hud"].forEach(function(k){ try{ hubHide(k); }catch(x){} });
    if(typeof WE!=="undefined"){ RF.wind=WE.wind; WE.wind=Math.max(1,WE.wind); WE.dirty=true; }
    if(!loaded){ var sc=(window.SPLAT_SCENES||[])[0]; if(sc){ App.go("landing"); loadBundled(sc); } }
    cancelAnimationFrame(RF.raf); RF.raf=requestAnimationFrame(rfTick); }
  /* leave without the fade (a ?demo link, or the demo starting some other way) */
  function rfClose(){ if(!RF.on) return; RF.on=false; cancelAnimationFrame(RF.raf); document.body.classList.remove("rackin");
    if(RF.el) RF.el.className=""; var sp=viewer&&viewer.spark; if(sp) sp.apertureAngle=0;
    if(typeof WE!=="undefined"&&RF.wind!=null){ WE.wind=RF.wind; WE.dirty=true; RF.wind=null; }
    if(camera&&RF.fov!=null){ camera.fov=RF.fov; camera.updateProjectionMatrix(); RF.fov=null; } }
  function rfPlay(){ if(!RF.on||RF.going||!loaded) return; RF.going=true; RF.over="word"; RF.el.classList.add("going");
    setTimeout(function(){ RF.el.classList.add("out"); },520);
    setTimeout(function(){ rfClose(); if(typeof siAct==="function") siAct("demo"); },1250); }
  // ---- where the lens should be: the nearest solid splats under the pointer, like the AF point but anywhere ----
  function rfSample(){ var P=viewer&&viewer.P, A=viewer&&viewer.A; if(!P) return null; if(RF.sP===P) return RF.sI;
    var N=P.length/3, want=150000, st=Math.max(1,Math.floor(N/want/1.6)), I=[]; for(var i=0;i<N;i+=st){ if(!A||A[i]>=0.3) I.push(i); }
    RF.sP=P; RF.sI=new Uint32Array(I); return RF.sI; }
  function rfPickAt(x,y){ var P=viewer&&viewer.P, I=rfSample(); if(!P||!I||!camera) return null;
    var v=new THREE.Vector3((x/innerWidth)*2-1, -(y/innerHeight)*2+1, 0.5).unproject(camera), o=camera.position, f=v.sub(o).normalize();
    var sc=sceneScale(), mt=0.25*sc, ts=[];
    for(var k=0;k<I.length;k++){ var i=I[k]*3, vx=P[i]-o.x, vy=P[i+1]-o.y, vz=P[i+2]-o.z, t=vx*f.x+vy*f.y+vz*f.z; if(t<mt) continue; var p2=vx*vx+vy*vy+vz*vz-t*t, lim=t*0.03+0.01*sc; if(p2<lim*lim) ts.push(t); }
    if(ts.length<3) return 18; ts.sort(function(a,b){ return a-b; }); return Math.max(0.3,Math.min(18,ts[Math.min(ts.length-1,3)]/sc)); }
  function rfOverWord(x,y){ var w=RF.el&&RF.el.querySelector(".rf-word"); if(!w) return false; var r=w.getBoundingClientRect(), px=r.width*0.06, py=r.height*0.22; return x>r.left-px&&x<r.right+px&&y>r.top-py&&y<r.bottom+py; }
  /* blur in screen pixels for something at d metres, matching what the lens does to the splats around it */
  function rfCoc(d){ var k=34*innerWidth/1440; return Math.abs(1/d-1/RF.f)*k; }
  /* the Stump scan is y-down on disk and turned the right way up in the world (x, -y, -z); this is the test page's shot */
  var RF_EYE=[-1.435,0.55,-0.80], RF_AT=[0.35,0.12,-0.15], RF_FOV=48;
  function rfPlace(){ camPos.set(RF_EYE[0],RF_EYE[1],RF_EYE[2]); if(typeof _vel!=="undefined") _vel.set(0,0,0);
    var dx=RF_AT[0]-RF_EYE[0], dy=RF_AT[1]-RF_EYE[1], dz=RF_AT[2]-RF_EYE[2]; yaw=Math.atan2(-dx,-dz); pitch=Math.atan2(dy,Math.hypot(dx,dz)); }
  /* called by sparkLens while the launch page is up: the 85 wide open, focused where the pointer says */
  function rfLens(sp){ if(camera){ if(RF.fov==null) RF.fov=camera.fov; camera.position.set(RF_EYE[0],RF_EYE[1],RF_EYE[2]); camera.up.set(0,1,0); camera.lookAt(RF_AT[0],RF_AT[1],RF_AT[2]);
      var asp=Math.max(1.3,innerWidth/Math.max(1,innerHeight)), vf=2*Math.atan(Math.tan(RF_FOV*Math.PI/360)/asp)*180/Math.PI; if(Math.abs(camera.fov-vf)>0.01){ camera.fov=vf; camera.updateProjectionMatrix(); }   /* RF_FOV is across the frame, like the test render */ camera.updateMatrixWorld(true); }
    var sc=sceneScale(), S=RF.f*sc, fm=RF_MM/1000*sc; sp.focalDistance=S; sp.apertureAngle=2*Math.atan(fm/RF_N/2/S)*Math.max(gDof,0.6); }
  function rfTick(now){ if(!RF.on) return; RF.raf=requestAnimationFrame(rfTick); var e=RF.el, t=(now-RF.t0)/1000;
    if(loaded){ if(!e.classList.contains("ready")){ e.classList.add("ready"); RF.t0=now; t=0; } rfPlace(); if(App.state!=="scene") App.go("scene"); }
    else return;
    if(RF.going) RF.ft=RF_WORD;
    else if(RF.over==="btn") RF.ft=RF_BTN;
    else if(RF.px>=0){ if(rfOverWord(RF.px,RF.py)) RF.ft=RF_WORD; else if(now-RF.pick>90){ RF.pick=now; var d=rfPickAt(RF.px,RF.py); if(d) RF.ft=d; } }
    else if(RF.idle) RF.ft = t<1.4?0.9 : 0.9+(2.1-0.9)*Math.min(1,(t-1.4)/2.8);   /* before you touch it, it drifts onto the stump by itself */
    var lf=Math.log(RF.f), lt=Math.log(RF.ft); RF.f=Math.exp(lf+(lt-lf)*0.075);
    var wb=Math.min(7,rfCoc(RF_WORD)), bb=Math.min(7,rfCoc(RF_BTN)*0.8), w=e.querySelector(".rf-word"), b=e.querySelector(".rf-go");
    w.style.filter=wb>0.15?"blur("+wb.toFixed(2)+"px)":"none"; b.style.filter=bb>0.15?"blur("+bb.toFixed(2)+"px)":"none"; b.style.opacity=(1-Math.min(0.25,bb*0.04)).toFixed(3); }
  if(/[?&]dev/.test(location.search)) window.__rf={ show:rfShow, close:rfClose, play:rfPlay, dbg:function(){ var P=viewer&&viewer.P, n=P?P.length/3:0, near=0, cx=0,cy=0,cz=0; for(var i=0;i<n;i+=50){ var x=P[i*3],y=P[i*3+1],z=P[i*3+2]; if(x*x+z*z<0.6){ near++; cx+=x; cy+=y; cz+=z; } } return {cam:camera.position.toArray().map(function(v){return +v.toFixed(2);}), fov:camera.fov, mesh:viewer&&viewer.mesh?viewer.mesh.position.toArray():null, q:viewer&&viewer.mesh?viewer.mesh.quaternion.toArray().map(function(v){return +v.toFixed(2);}):null, stump:near?[cx/near,cy/near,cz/near].map(function(v){return +v.toFixed(2);}):null, n:n}; }, state:function(){ return {on:RF.on, f:+RF.f.toFixed(2), ft:+RF.ft.toFixed(2), ready:!!(RF.el&&RF.el.classList.contains("ready"))}; }, focus:function(d){ RF.idle=false; RF.px=-1; RF.ft=d; } };
