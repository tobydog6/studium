  // ================= NAV: always a way home, and every key has a button =================
  // Four places a student goes: Home, Shoot, Studio, Critique. The dock sits at the bottom of the hub, Locations
  // and Punctum; the studio carries Home and Shoot in its bar. In a location the dock gives way to the camera's own
  // buttons (raise camera, camera back, bag, studio), a Home pill top-left and today's task top-right. They fade
  // while you're looking around and come back when you stop. H goes home and C opens critique from anywhere.
  var NAV_PLACES=[["home","HOME","H",'<path d="M3 9.5 10 4l7 5.5V17H3z" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ["shoot","SHOOT","P",'<rect x="2.5" y="6" width="15" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="11" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 6l1.2-2h3.6L13 6" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ["studio","STUDIO","Tab",'<rect x="3" y="3" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="3" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="11" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="11" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ["critique","RESEARCH","C",'<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="2" fill="currentColor"/>']];
  function navHere(){ var s=App.state; if(s==="hub") return "home"; if(s==="punctum"||s==="studio.research") return "critique"; if(s.indexOf("studio")===0) return "studio"; if(s==="landing"||s==="scene"||s==="viewfinder"||s==="back"||s==="bag") return "shoot"; return ""; }
  /* Home is for signed-in school accounts (the teacher's plan, notes, sign-out). The demo has no Home: the Space menu covers it */
  function navNoHome(){ return typeof qDemo==="function"&&qDemo(); }
  function navGo(p){ if(lsMoveOpen()) return; if(p==="home"&&navNoHome()) return;
    if(p==="home"){ if(st.open){ stHideLegacy(); st.open=false; $("studioX").classList.add("hidden"); } return showHub(); }
    if(p==="shoot") return lsGo("shoot");
    if(p==="critique"){ if(typeof cbOpen!=="undefined"&&cbOpen) closeBack(false); if(bg.open) closeBag(); hubHide("punctum"); hubHide("landing"); return openStudio("research"); }   // Punctum lives in the studio now, as Research
    if(p==="studio"){ if(typeof cbOpen!=="undefined"&&cbOpen) closeBack(false); if(bg.open) closeBag(); hubHide("punctum"); hubHide("landing"); return openStudio(st.room&&st.room!=="edit"?st.room:"select"); } }
  /* the dock only shows over a place that's actually on screen: at page open the state is already "hub" behind the launch page and sign-in, so it used to pop up before the home card */
  function navUp(id){ var e=$(id); return !!e&&!e.classList.contains("hidden"); }
  function navRender(){ var d=$("dock"); if(!d) return; var here=navHere(), B=document.body.classList, busy=B.contains("launching")||B.contains("rackin")||navUp("signin")||(typeof LA!=="undefined"&&LA.on),
      show=!busy&&((App.is("hub")&&navUp("hub"))||(App.is("landing")&&navUp("landing"))||(App.is("punctum")&&navUp("punctum")));
    document.body.classList.toggle("no-home", navNoHome());
    d.classList.toggle("show", show);
    if(show) d.innerHTML=NAV_PLACES.filter(function(p){ return !(p[0]==="home"&&navNoHome()); }).map(function(p){ return '<button class="'+(p[0]===here?'on':'')+'" data-nav="'+p[0]+'"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">'+p[3]+'</svg>'+p[1]+'<span>'+p[2]+'</span></button>'; }).join("");
    navScene(); }
  // in a location
  function navScene(){ var on=App.is("scene"), top=$("navTop"), acts=$("navActs"), task=$("navTask"); if(!top) return;
    [top,acts,task].forEach(function(e){ e.classList.toggle("show", on); });
    if(!on) return;
    document.body.classList.toggle("nav-looking", !!looking);
    top.querySelector(".pl").textContent=(cbPlace||"").toUpperCase(); top.querySelector(".fr").textContent=photos.length?"· "+photos.length+" FRAME"+(photos.length===1?"":"S"):"";
    // today's step, from the teacher's plan or the self-paced run
    var pl=lsPlan(), ph=null; if(pl){ var c=lsCur(pl); ph=c.ph||null; } if(!ph){ var S=lsSoloSteps(); for(var i=0;i<S.length;i++){ if(!lsDone(S[i])){ ph=S[i]; break; } } }
    if(typeof ownLoaded!=="undefined"&&ownLoaded) ph=null;   // your own scan: no lesson task on it
    if(ph){ var k=lsKind(ph); task.innerHTML='<i></i><span class="t">'+cbEsc(ph.title)+'</span>'+(k!=="none"&&ph.n?'<span class="n">· '+Math.min(lsCount(k),ph.n)+' / '+ph.n+'</span>':''); task.classList.remove("empty"); } else task.classList.add("empty");
    var coach=$("navCoach"); if(coach) coach.classList.toggle("show", !looking&&!navSeenLook()); }
  function navSeenLook(){ try{ return localStorage.getItem("studium_looked")==="1"; }catch(e){ return true; } }
  function navAct(a){ if(a==="raise"){ toggleViewfinder(); } else if(a==="back"){ openBack(); } else if(a==="bag"){ openBag(); } else if(a==="studio"){ openStudio("select"); } else if(a==="vert"){ setVertical(!vertical); } else if(a==="kit"){ kitToggle(); } else if(a==="lights"){ if(typeof rlToggle==="function"&&loaded) rlToggle(); } navRender(); }
  (function wireNav(){
    document.addEventListener("click",function(e){ var b=e.target.closest("[data-nav]"); if(b){ e.preventDefault(); navGo(b.getAttribute("data-nav")); return; }
      var a=e.target.closest("[data-nav-act]"); if(a){ e.preventDefault(); e.stopPropagation(); navAct(a.getAttribute("data-nav-act")); } });
    App.on(function(){ navRender(); });
    document.addEventListener("pointerlockchange",function(){ if(document.pointerLockElement){ try{ localStorage.setItem("studium_looked","1"); }catch(e){} } setTimeout(navScene,0); });
    window.addEventListener("keydown",function(e){ var t=e.target, tag=t&&t.tagName; if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||(t&&t.isContentEditable)) return;
      if(e.ctrlKey||e.metaKey||e.altKey||lsMoveOpen()) return; if(App.is("teacher")||App.is("signin")) return;
      var ed=$("editor"); if(ed&&!ed.classList.contains("hidden")) return;
      if(e.code==="KeyH"&&!navNoHome()){ e.preventDefault(); e.stopImmediatePropagation(); navGo("home"); }
      else if(e.code==="KeyC"&&!App.is("punctum")){ e.preventDefault(); e.stopImmediatePropagation(); navGo("critique"); } }, true);
    /* overlays come and go without a state change (launch, sign-in, the hub card), so the dock re-checks when they do */
    var navQ=0, navObs=function(){ if(navQ) return; navQ=requestAnimationFrame(function(){ navQ=0; navRender(); }); };
    if(window.MutationObserver){ var mo=new MutationObserver(navObs); mo.observe(document.body,{attributes:true, attributeFilter:["class"]});
      ["hub","landing","punctum","signin"].forEach(function(id){ var e=$(id); if(e) mo.observe(e,{attributes:true, attributeFilter:["class"]}); }); }
    /* Space in the studio: close it and go back to shooting */
    window.addEventListener("keydown",function(e){ if(e.code!=="Space"||e.repeat||!st.open) return; var t=e.target, tag=t&&t.tagName;
      if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||(t&&t.isContentEditable)||e.ctrlKey||e.metaKey||e.altKey||lsMoveOpen()) return;
      if(typeof anyOutputOpen==="function"&&anyOutputOpen()) return;
      e.preventDefault(); e.stopImmediatePropagation(); closeStudio(); if(!loaded) lsGo("shoot"); navRender(); }, true);
    navRender(); })();
  /* in a location the bar refreshes every couple of seconds (frame count, today's task); anywhere else it stops */
  var navTimer=0;
  function navTimerSet(){ var on=App.is("scene"); if(on&&!navTimer) navTimer=setInterval(function(){ if(App.is("scene")) navScene(); else navTimerSet(); }, 2000); else if(!on&&navTimer){ clearInterval(navTimer); navTimer=0; } }
  App.on(navTimerSet); navTimerSet();

  // ================= KIT MENU (Space in the scene) =================
  // One key for everything you carry: the camera back, the bag and the lights. Space again closes it. B and L stay as shortcuts.
  var KIT={open:false, sel:0};
  var KIT_ITEMS=[["back","Settings","SHUTTER · APERTURE · ISO","1"],["bag","Bag","BODIES · LENSES","2"],["lights","Lighting","TIME OF DAY · LIGHTS · PLAN","3"],["studio","Studio","PICK · EDIT · MAKE · SHOW","4"]];
  /* the studio card: your latest frames as a loose stack of prints (blank paper before you've shot) */
  function kitStudioArt(){ var L=photos.filter(function(p){ return !p.research; }).slice(-3).reverse(), h="";
    for(var i=0;i<3;i++){ var p=L[i]; h+=p?'<img class="ka-p ka-p'+(i+1)+'" src="'+p.url+'" alt="" draggable="false">':'<i class="ka-p ka-p'+(i+1)+'"></i>'; } return h; }
  var KIT_ART={
    back:'<span class="ka-cam"><img class="ka-back" src="asset:assets/camera/dslr-back.webp" alt="" draggable="false"><span class="ka-scr"></span></span>',
    bag:'<i class="ka-shelf"></i><i class="ka-bspot"></i><img class="ka-t ka-t1" src="asset:assets/bag/thumb-2470.webp" alt="" draggable="false"><img class="ka-t ka-t3" src="asset:assets/bag/thumb-85.webp" alt="" draggable="false"><img class="ka-t ka-t2" src="asset:assets/bag/thumb-50.webp" alt="" draggable="false">',
    lights:'<i class="ka-floor"></i><i class="ka-glow"></i><img class="ka-soft" src="asset:assets/kit/softbox.webp" alt="" draggable="false">'};
  function kitRender(){ var k=$("kitMenu"); if(!k){ k=document.createElement("div"); k.id="kitMenu"; document.body.appendChild(k);
      k.addEventListener("click",function(e){ var r=e.target.closest("[data-kit-reset]"); if(r){ e.stopPropagation(); kitReset(r); return; } var b=e.target.closest("[data-kit]"); if(b){ e.stopPropagation(); kitGo(b.getAttribute("data-kit")); } else if(!e.target.closest(".kit-card")) kitClose(); });
      k.addEventListener("mouseover",function(e){ var b=e.target.closest("[data-kit-i]"); if(b&&+b.getAttribute("data-kit-i")!==KIT.sel){ KIT.sel=+b.getAttribute("data-kit-i"); kitMark(); } }); }
    k.classList.toggle("show",KIT.open); if(!KIT.open) return;
    k.innerHTML=(typeof qDemo==="function"&&qDemo()?'<button class="kit-reset" data-kit-reset><svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 1 0 2-4.5M4 3v3.5h3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>RESET DEMO</span></button>':'')+'<div class="kit-wrap"><div class="kit-top"><span class="kit-eb">MENU</span><h2>What do you need?</h2><em>Press Space any time to open this.</em></div>'
      +'<div class="kit-row">'+KIT_ITEMS.map(function(it,i){ return '<button class="kit-card" data-kit="'+it[0]+'" data-kit-i="'+i+'" style="--w:'+((i>>1)+(i&1))+'"><div class="kit-art ka-'+it[0]+'">'+(it[0]==="studio"?kitStudioArt():KIT_ART[it[0]])+'</div><div class="kit-meta"><b>'+it[1]+'</b><span>'+it[2]+'</span></div><kbd>'+it[3]+'</kbd></button>'; }).join("")+'</div>'
      +(typeof weKitHTML==="function"?weKitHTML():"")+'<div class="kit-foot"><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> or click to choose</span><span><kbd>5</kbd><kbd>6</kbd><kbd>7</kbd> weather</span><span><kbd>Space</kbd> or <kbd>Esc</kbd> back to the scene</span></div></div>';
    kitScreen(); kitMark();
    /* the tiles come in on a short wave; if a busy GPU stalls the animation (a Mac's Retina screen behind the scan), they still land */
    clearTimeout(KIT.settleT); k.classList.remove("settled"); KIT.settleT=setTimeout(function(){ k.classList.add("settled"); },900); }
  /* the camera back's own screen on the Settings tile: what the camera is set to right now */
  function kitScreen(){ var e=document.querySelector("#kitMenu .ka-scr"); if(!e) return;
    try{ e.innerHTML='<span class="t">SETTINGS</span><span class="v"><b>'+cbEsc(SHUTTER_LABELS[shIdx])+'</b><b>f/'+cbEsc(APERTURES[apIdx])+'</b><b>ISO '+cbEsc(ISOS[isoIdx])+'</b></span><span class="t">'+cbEsc(curBody().name.toUpperCase())+' · '+focalMM+' MM</span>'; }catch(x){ e.innerHTML=""; } }
  /* the demo's reset, for the next person: click once to ask, again to wipe and start the opening over */
  function kitReset(b){ if(!b.classList.contains("ask")){ b.classList.add("ask"); b.querySelector("span").textContent="CLICK AGAIN TO START OVER"; clearTimeout(KIT.resetT);
      KIT.resetT=setTimeout(function(){ if(b.isConnected){ b.classList.remove("ask"); b.querySelector("span").textContent="RESET DEMO"; } },4000); return; }
    clearTimeout(KIT.resetT); KIT.open=false; KIT.vf=KIT.look=false; kitRender(); if(typeof qDemoRestart==="function") qDemoRestart(); }
  function kitMark(){ Array.prototype.forEach.call(document.querySelectorAll("#kitMenu .kit-card"),function(c,i){ c.classList.toggle("on", i===KIT.sel); }); }
  /* the menu remembers whether you were looking round or had the camera up, so closing it puts you straight back (like the bag does) */
  function kitOpen(){ if(!loaded||(typeof st!=="undefined"&&st.open)) return; KIT.vf=!!viewfinderOn; KIT.look=!!looking||KIT.vf; if(looking) document.exitPointerLock(); KIT.open=true; KIT.sel=0; kitRender(); sfx("kitOpen"); }
  function kitClose(){ var was=KIT.open; if(was) sfx("kitClose"); KIT.open=false; kitRender(); if(!was) return;
    if(KIT.look){ try{ var pl=renderer.domElement.requestPointerLock(); if(pl&&pl.catch) pl.catch(function(){}); }catch(e){} } if(KIT.vf&&!viewfinderOn) raiseCamera(); KIT.vf=KIT.look=false; }
  function kitToggle(){ if(KIT.open) kitClose(); else kitOpen(); }
  function kitGo(a){ KIT.open=false; kitRender(); sfx("select");
    var vf=!!KIT.vf; KIT.vf=KIT.look=false;
    if(a==="back"){ openBack(); if(vf&&cbOpen) cbWasVF=true; } else if(a==="bag") openBag(vf?"viewfinder":undefined);   /* closing Settings or the Bag brings the camera back up if it was */
    else if(a==="studio"&&typeof openStudio==="function"){ if(looking) document.exitPointerLock(); openStudio("select"); }
    else if(a==="lights"&&typeof rlOpen==="function"){ if(!RL.ui) rlOpen(); }
    navRender(); }
  window.addEventListener("keydown",function(e){ if(!KIT.open) return; var c=e.code, n={Digit1:0,Digit2:1,Digit3:2,Digit4:3}[c];
    if(n!=null||c==="Space"||c==="Enter"||c==="Escape"||c==="ArrowLeft"||c==="ArrowRight"||c==="ArrowUp"||c==="ArrowDown"||c==="Tab"){ e.preventDefault(); e.stopImmediatePropagation(); } else return;
    if(n!=null) kitGo(KIT_ITEMS[n][0]); else if(c==="Enter") kitGo(KIT_ITEMS[KIT.sel][0]); else if(c==="Escape"||c==="Space") kitClose(); else if(c==="Tab") kitGo("studio");
    else { var N=KIT_ITEMS.length, d=c==="ArrowRight"?1:c==="ArrowLeft"?N-1:2; KIT.sel=(KIT.sel+d)%N; kitMark(); } },true);   /* a 2 by 2: left and right step, up and down swap rows */
