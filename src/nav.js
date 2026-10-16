  // ================= NAV: always a way home, and every key has a button =================
  // Four places a student goes: Home, Shoot, Studio, Critique. The dock sits at the bottom of the hub, Locations
  // and Punctum; the studio carries Home and Shoot in its bar. In a location the dock gives way to the camera's own
  // buttons (raise camera, camera back, bag, studio), a Home pill top-left and today's task top-right. They fade
  // while you're looking around and come back when you stop. H goes home and C opens critique from anywhere.
  var NAV_PLACES=[["home","HOME","H",'<path d="M3 9.5 10 4l7 5.5V17H3z" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ["shoot","SHOOT","P",'<rect x="2.5" y="6" width="15" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="11" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 6l1.2-2h3.6L13 6" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ["studio","STUDIO","Tab",'<rect x="3" y="3" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="3" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="11" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="11" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ["critique","CRITIQUE","C",'<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="2" fill="currentColor"/>']];
  function navHere(){ var s=App.state; if(s==="hub") return "home"; if(s==="punctum") return "critique"; if(s.indexOf("studio")===0) return "studio"; if(s==="landing"||s==="scene"||s==="viewfinder"||s==="back"||s==="bag") return "shoot"; return ""; }
  function navGo(p){ if(lsMoveOpen()) return;
    if(p==="home"){ if(st.open){ stHideLegacy(); st.open=false; $("studioX").classList.add("hidden"); } return showHub(); }
    if(p==="shoot") return lsGo("shoot");
    if(p==="critique") return lsGo("punctum");
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
    if(ph){ var k=lsKind(ph); task.innerHTML='<i></i><span class="t">'+cbEsc(ph.title)+'</span>'+(k!=="none"&&ph.n?'<span class="n">· '+Math.min(lsCount(k),ph.n)+' / '+ph.n+'</span>':''); task.classList.remove("empty"); } else task.classList.add("empty");
    var coach=$("navCoach"); if(coach) coach.classList.toggle("show", !looking&&!navSeenLook()); }
  function navSeenLook(){ try{ return localStorage.getItem("studium_looked")==="1"; }catch(e){ return true; } }
  function navAct(a){ if(a==="raise"){ toggleViewfinder(); } else if(a==="back"){ openBack(); } else if(a==="bag"){ openBag(); } else if(a==="studio"){ openStudio("select"); } else if(a==="vert"){ setVertical(!vertical); } navRender(); }
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
