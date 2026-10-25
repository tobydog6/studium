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
  function navGo(p){ if(lsMoveOpen()) return;
    if(p==="home"){ if(st.open){ stHideLegacy(); st.open=false; $("studioX").classList.add("hidden"); } return showHub(); }
    if(p==="shoot") return lsGo("shoot");
    if(p==="critique"){ if(typeof cbOpen!=="undefined"&&cbOpen) closeBack(false); if(bg.open) closeBag(); hubHide("punctum"); hubHide("landing"); return openStudio("research"); }   // Punctum lives in the studio now, as Research
    if(p==="studio"){ if(typeof cbOpen!=="undefined"&&cbOpen) closeBack(false); if(bg.open) closeBag(); hubHide("punctum"); hubHide("landing"); return openStudio(st.room&&st.room!=="edit"?st.room:"select"); } }
  function navRender(){ var d=$("dock"); if(!d) return; var here=navHere(), show=App.is("hub")||App.is("landing")||App.is("punctum");
    d.classList.toggle("show", show);
    if(show) d.innerHTML=NAV_PLACES.map(function(p){ return '<button class="'+(p[0]===here?'on':'')+'" data-nav="'+p[0]+'"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">'+p[3]+'</svg>'+p[1]+'<span>'+p[2]+'</span></button>'; }).join("");
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
      if(e.code==="KeyH"){ e.preventDefault(); e.stopImmediatePropagation(); navGo("home"); }
      else if(e.code==="KeyC"&&!App.is("punctum")){ e.preventDefault(); e.stopImmediatePropagation(); navGo("critique"); } }, true);
    setInterval(function(){ if(App.is("scene")) navScene(); }, 2000);
    navRender(); })();

  // ================= KIT MENU (Space in the scene) =================
  // One key for everything you carry: the camera back, the bag and the lights. Space again closes it. B and L stay as shortcuts.
  var KIT={open:false, sel:0};
  var KIT_ITEMS=[["back","Settings","SHUTTER · APERTURE · ISO","1"],["bag","Bag","BODIES · LENSES","2"],["lights","Lighting","TIME OF DAY · LIGHTS · PLAN","3"],["studio","Studio","PICK · EDIT · MAKE · SHOW","4"]];
  /* the studio card: your latest frames as a loose stack of prints (blank paper before you've shot) */
  function kitStudioArt(){ var L=photos.filter(function(p){ return !p.research; }).slice(-3).reverse(), h="";
    for(var i=0;i<3;i++){ var p=L[i]; h+=p?'<img class="ka-p ka-p'+(i+1)+'" src="'+p.url+'" alt="" draggable="false">':'<i class="ka-p ka-p'+(i+1)+'"></i>'; } return h; }
  var KIT_ART={
    back:'<img class="ka-back" src="asset:assets/camera/dslr-back.webp" alt="" draggable="false">',
    bag:'<img class="ka-l1" src="asset:assets/bag/lens-2470.webp" alt="" draggable="false"><img class="ka-l2" src="asset:assets/bag/lens-85.webp" alt="" draggable="false"><img class="ka-l3" src="asset:assets/bag/lens-50.webp" alt="" draggable="false">',
    lights:'<i class="ka-floor"></i><i class="ka-glow"></i><img class="ka-soft" src="asset:assets/kit/softbox.webp" alt="" draggable="false">'};
  function kitRender(){ var k=$("kitMenu"); if(!k){ k=document.createElement("div"); k.id="kitMenu"; document.body.appendChild(k);
      k.addEventListener("click",function(e){ var b=e.target.closest("[data-kit]"); if(b){ e.stopPropagation(); kitGo(b.getAttribute("data-kit")); } else if(!e.target.closest(".kit-card")) kitClose(); });
      k.addEventListener("mouseover",function(e){ var b=e.target.closest("[data-kit-i]"); if(b&&+b.getAttribute("data-kit-i")!==KIT.sel){ KIT.sel=+b.getAttribute("data-kit-i"); kitMark(); } }); }
    k.classList.toggle("show",KIT.open); if(!KIT.open) return;
    k.innerHTML='<div class="kit-wrap"><div class="kit-top"><span class="kit-eb">YOUR KIT</span><h2>What do you need?</h2><em>&ldquo;Everything you carry, one key away&rdquo;</em></div>'
      +'<div class="kit-row">'+KIT_ITEMS.map(function(it,i){ return '<button class="kit-card" data-kit="'+it[0]+'" data-kit-i="'+i+'"><div class="kit-art ka-'+it[0]+'">'+(it[0]==="studio"?kitStudioArt():KIT_ART[it[0]])+'</div><div class="kit-meta"><b>'+it[1]+'</b><span>'+it[2]+'</span></div><kbd>'+it[3]+'</kbd></button>'; }).join("")+'</div>'
      +'<div class="kit-foot"><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> or click to choose</span><span><kbd>Space</kbd> or <kbd>Esc</kbd> back to the scene</span></div></div>';
    kitMark(); }
  function kitMark(){ Array.prototype.forEach.call(document.querySelectorAll("#kitMenu .kit-card"),function(c,i){ c.classList.toggle("on", i===KIT.sel); }); }
  function kitOpen(){ if(!loaded||(typeof st!=="undefined"&&st.open)) return; if(looking) document.exitPointerLock(); KIT.open=true; KIT.sel=0; kitRender(); }
  function kitClose(){ KIT.open=false; kitRender(); }
  function kitToggle(){ if(KIT.open) kitClose(); else kitOpen(); }
  function kitGo(a){ kitClose();
    if(a==="back") openBack(); else if(a==="bag") openBag();
    else if(a==="studio"&&typeof openStudio==="function"){ if(looking) document.exitPointerLock(); openStudio("select"); }
    else if(a==="lights"&&typeof rlOpen==="function"){ if(!RL.ui) rlOpen(); }
    navRender(); }
  window.addEventListener("keydown",function(e){ if(!KIT.open) return; var c=e.code, n={Digit1:0,Digit2:1,Digit3:2,Digit4:3}[c];
    if(n!=null||c==="Space"||c==="Enter"||c==="Escape"||c==="ArrowLeft"||c==="ArrowRight"||c==="ArrowUp"||c==="ArrowDown"||c==="Tab"){ e.preventDefault(); e.stopImmediatePropagation(); } else return;
    if(n!=null) kitGo(KIT_ITEMS[n][0]); else if(c==="Enter") kitGo(KIT_ITEMS[KIT.sel][0]); else if(c==="Escape"||c==="Space") kitClose(); else if(c==="Tab") kitGo("studio");
    else { var N=KIT_ITEMS.length, d=c==="ArrowRight"?1:c==="ArrowLeft"?N-1:2; KIT.sel=(KIT.sel+d)%N; kitMark(); } },true);   /* a 2 by 2: left and right step, up and down swap rows */
