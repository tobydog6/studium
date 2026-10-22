  // ================= GUIDE: the first session, step by step =================
  // A run of short popups that walks a new student through the whole loop once: the challenges at the location,
  // a free shoot across every lens, picking a top 8, editing them, a workbook page, the top of a folio panel, then
  // the book and gallery to explore on their own. A small checklist card keeps the current step in view, and each
  // step moves on by itself once its boxes are ticked. Off for students in a teacher's lesson plan (the plan leads).
  var GD_KEY="studium_guide_v1";
  var GD={step:-1, base:0, flags:{}, shown:-1, timer:0, open:false, demo:false, t0:0};
  function gdLoad(){ var raw=null; try{ raw=localStorage.getItem(GD_KEY); }catch(e){}
    if(raw==="off"){ GD.step=-1; GD.demo=false; GD_STEPS=GD_FULL; return; }
    try{ var d=JSON.parse(raw||"null"); if(d&&typeof d.step==="number"){ GD.step=d.step; GD.base=d.base||0; GD.flags=d.flags||{}; GD.shown=d.shown; GD.demo=!!d.demo; GD.t0=d.t0||0; GD_STEPS=GD_FULL; GD.step=-1; GD.demo=false; return; } }catch(e){}
    GD.step=-1; GD.shown=-1; }   // quests replace the full guided path; only the demo still runs here
  function gdSave(){ try{ localStorage.setItem(GD_KEY, GD.step<0?"off":JSON.stringify({step:GD.step, base:GD.base, flags:GD.flags, shown:GD.shown, demo:GD.demo, t0:GD.t0})); }catch(e){} }
  function gdActive(){ return GD.step>=0&&GD.step<GD_STEPS.length&&!(typeof lsPlan==="function"&&lsPlan()); }
  function gdNew(){ return photos.slice(GD.base); }
  function gdLensCount(){ var L={}; gdNew().forEach(function(p){ if(p.lens) L[p.lens]=1; }); return L; }
  function gdDistinct(key){ var s={}; gdNew().forEach(function(p){ if(p[key]!=null) s[p[key]]=1; }); return Object.keys(s).length; }
  function gdPicked(){ return photos.filter(function(p){ return p.pick; }); }
  function gdDev(test){ return gdPicked().some(function(p){ return p.dev&&test(p.dev); }); }
  function gdWs(){ return (typeof wsB!=="undefined"&&st.wsBoard)?st.wsBoard.pages:[]; }
  function gdWsItems(t){ var n=0; gdWs().forEach(function(pg){ pg.items.forEach(function(it){ if(t(it)) n++; }); }); return n; }
  function gdFoTop(){ if(typeof foB==="undefined"||!st.foBoard) return []; var pg=st.foBoard.pages[st.foBoard.cur||0]; return pg?pg.items.filter(function(it){ return it.t==="photo"&&it.sec==="0.0"; }):[]; }
  var GD_FULL=[
    {id:"basics", where:"scene", title:"Welcome to the Stump",
     body:"You're standing in a real place, scanned in 3D. Before the challenges, a two-minute warm-up: how to move, how to use the camera, and what's in your bag. Just follow the prompts at the bottom of the screen.",
     btn:"LET'S GO", go:function(){ coStart("basics"); },
     checks:function(){ var n=coProg("basics"); return [{t:"Warm up: moving, shooting, the bag and the settings", ok:n>=CO_STEPS.length, now:Math.min(n,CO_STEPS.length)+" / "+CO_STEPS.length}]; },
     tick:function(){ gdTour("basics", true); }},
    {id:"challenges", where:"scene", title:"The gold frames",
     body:"Six gold frames hang around the clearing, each one a shot to take. Walk into a frame's glow and it draws you in, then set the camera the way its card asks and shoot. The markers point the way.",
     btn:"FIND THEM",
     checks:function(){ var n=CH.list.length, d=CH.list.filter(function(c){ return CH.done[c.id]; }).length; return [{t:"Complete the gold-frame challenges", ok:n>0&&d>=n, now:d+" / "+(n||6)}]; }},
    {id:"shoot", where:"scene", title:"Now shoot it your way",
     body:"Challenges done. Now make 15 photographs of your own. Use every lens in the bag at least once, and push the settings around: wide open and stopped down, fast and slow shutter, low and high ISO. Notice what each one does.",
     btn:"KEEP SHOOTING", onStart:function(){ GD.base=photos.length; },
     checks:function(){ var n=gdNew().length, L=gdLensCount(), lc=["2470","50","85","135"].filter(function(k){ return L[k]; }).length;
       return [{t:"Take 15 photos", ok:n>=15, now:Math.min(n,15)+" / 15"},
         {t:"Use all four lenses (24–70, 50, 85, 135)", ok:lc>=4, now:lc+" / 4"},
         {t:"At least 3 different apertures", ok:gdDistinct("f")>=3, now:gdDistinct("f")+" / 3"},
         {t:"At least 3 different shutter speeds", ok:gdDistinct("sh")>=3, now:gdDistinct("sh")+" / 3"},
         {t:"At least 2 different ISOs", ok:gdDistinct("iso")>=2, now:gdDistinct("iso")+" / 2"}]; }},
    {id:"select", where:"select", title:"Choose your best 8",
     body:"Time for the light table, where you choose. A quick tour shows you how to pick and reject, then it's over to you: your strongest 8, and be ruthless.",
     btn:"OPEN SELECT", go:function(){ LIB.key="all"; openStudio("select"); coStart("select"); },
     checks:function(){ var n=gdPicked().length; return [{t:"Learn to pick and reject", ok:coTourDone("select")}, {t:"Pick exactly 8 frames", ok:n===8, now:n+" / 8"}]; },
     tick:function(){ gdTour("select", st.open&&st.room==="select"); }},
    {id:"edit", where:"edit", title:"Edit your picks",
     body:"Your picks are in The Stump › Picked photos. A tour takes you through one photo slider by slider, then you edit it your own way, copy the look onto the next and edit the rest. Select several in the strip and Sync to share a look across them.",
     btn:"OPEN EDIT", go:function(){ var key=null; libFolders().forEach(function(f){ if(f.kind==="sub"&&!key) key=f.key; }); var ids=key?libItems(key):stPicks(); if(key) LIB.key=key; devScope=ids.slice(); st.cur=ids[0]; openStudio("edit"); coStart("edit"); },
     checks:function(){ return [{t:"Do the edit tour", ok:coTourDone("edit")},
       {t:"Sync your settings to other frames (select several in the strip, then Sync)", ok:!!GD.flags.synced}]; },
     tick:function(){ gdTour("edit", coInEditor()); }},
    {id:"workbook", where:"workbook", title:"Make a workbook page",
     body:"The workbook is where you show your thinking. You'll make one page: your picks ranked from 5 up to your best, with why each one sits where it does.",
     btn:"OPEN THE WORKBOOK", go:function(){ openStudio("workshop"); coStart("workbook"); },
     checks:function(){ return [{t:"Make a Rank page with the tour", ok:coTourDone("workbook")}]; }, tick:function(){ gdTour("workbook", coRoom("workshop")); }},
    {id:"folio", where:"folio", title:"Start your folio board",
     body:"Your folio board is three A1 panels, filled edge to edge. You'll fill the top third of the first panel and try its arrangements.",
     btn:"OPEN THE FOLIO", go:function(){ openStudio("folio"); coStart("folio"); },
     checks:function(){ return [{t:"Fill a third of the board with the tour", ok:coTourDone("folio")}]; }, tick:function(){ gdTour("folio", coRoom("folio")); }},
    {id:"book", where:"book", title:"The Book",
     body:"Two more places your work can go. First the Book: your picks as a photobook you can export and print.",
     btn:"OPEN THE BOOK", go:function(){ openStudio("book"); coStart("book"); },
     checks:function(){ return [{t:"Look round the Book", ok:coTourDone("book")}]; }, tick:function(){ gdTour("book", coRoom("book")); }},
    {id:"gallery", where:"gallery", title:"The Gallery",
     body:"And the Gallery: your photos hung on a wall at real size, the way a show is planned.",
     btn:"OPEN THE GALLERY", go:function(){ openStudio("gallery"); coStart("gallery"); },
     checks:function(){ return [{t:"Look round the Gallery", ok:coTourDone("gallery")}]; }, tick:function(){ gdTour("gallery", coRoom("gallery")); }},
    {id:"research", where:"research", title:"Research",
     body:"Every photographer looks closely at other people's work. Research is where you do it: find the detail in a photograph that pricks you, say why, and take it into your workbook.",
     btn:"OPEN RESEARCH", go:function(){ openStudio("research"); coStart("research"); },
     checks:function(){ return [{t:"Play a Punctum round and take one photo into your workbook", ok:coTourDone("research")}]; }, tick:function(){ gdTour("research", coRoom("research")); }},
    {id:"yours", where:"select", title:"Now make it yours",
     body:"Last thing: a folder for your own project, ready for the photos you take next.",
     btn:"OPEN THE LIBRARY", go:function(){ LIB.key="all"; openStudio("select"); coStart("library"); },
     checks:function(){ return [{t:"Make a folder for your own project", ok:coTourDone("library")}]; }, tick:function(){ gdTour("library", coRoom("select")); }},
    {id:"done", where:"any", title:"You've done the whole loop",
     body:"Shoot, select, edit, workbook, folio: that's how a photography project runs. Your folder's waiting. Go and shoot something of your own.",
     btn:"FINISH", final:true, checks:function(){ return []; }}];
  // the ten-minute demo: the same rooms, less of each
  // The demo's three challenges, each on a different camera from the bag, so every tester learns the bag, the dials
  // and turning the camera. Same spots as the full set; the cards say exactly which key does what.
  var GD_DEMO_CH=[
    {id:"stump-fgbg", over:{title:"Wide and close, on a crop sensor", mm:38,
      brief:"The APS-C camera's smaller sensor crops the picture 1.6×, so even the zoom's widest setting looks tighter. Get low and close: the stump fills the left, the dead tree stands behind it, and f/11 keeps both sharp.",
      need:[{k:"body",id:"ml",label:"Swap to the APS-C mirrorless: press B, pick it under Bodies"},
        {k:"mm",max:40,label:"24–70 zoomed right out: raise the camera (right click), scroll down"},
        {k:"f",min:11,label:"Aperture f/11 or smaller: on the camera back (Space)"},
        {k:"ev",tol:1,label:"Exposure within a stop: change the shutter on the back until the needle centres"}]}},
    {id:"stump-dof", over:{title:"Shallow depth of field",
      brief:"Back to the full-frame DSLR, with the 85 mm portrait lens wide open. Focus on the stump and let everything behind it melt away.",
      need:[{k:"body",id:"dslr",label:"Full-frame DSLR: press B, pick it under Bodies"},
        {k:"lens",mm:85,label:"85 mm f/1.4: in the bag (B), under Lens"},
        {k:"f",max:1.4,label:"Wide open at f/1.4: on the camera back (Space)"},
        {k:"ev",tol:1,label:"Exposure within a stop: wide open lets in lots of light, so pick a faster shutter on the back"}]}},
    {id:"stump-67", over:{title:"Medium format, vertical",
      brief:"Now the 6×7 film camera: a big negative and only ten frames to a roll. Turn it on its side and stop down. Meter carefully, because film doesn't give you a second go.",
      need:[{k:"body",id:"67",label:"6×7 film SLR: press B, pick it under Bodies"},
        {k:"lens",mm:105,label:"105 mm, its standard lens: in the bag (B), under Lens"},
        {k:"vert",label:"Turn the camera vertical: press X"},
        {k:"f",min:8,label:"f/8 or smaller: on the camera back (Space)"},
        {k:"ev",tol:0.7,label:"Exposure within ⅔ of a stop: shutter or ISO on the camera back"}]}}];
  function gdDemoChallenges(all){ return GD_DEMO_CH.map(function(d){ var c=all.filter(function(x){ return x.id===d.id; })[0]; if(!c) return null; var o={}, k; for(k in c) o[k]=c[k]; for(k in d.over) o[k]=d.over[k]; return o; }).filter(Boolean); }
  function gdById(id){ return GD_FULL.filter(function(s){ return s.id===id; })[0]; }
  var GD_STEPS=GD_FULL;
  function gdIsDemo(){ return qDemo(); }   /* the demo is a quest set now (quests.js) */
  // ---- popup + checklist card ----
  function gdEl(id, cls){ var e=$(id); if(!e){ e=document.createElement("div"); e.id=id; e.className=cls; document.body.appendChild(e); } return e; }
  function gdPop(){ var s=GD_STEPS[GD.step]; if(!s) return; var el=gdEl("gdPop","gd-pop");
    if(typeof looking!=="undefined"&&looking){ try{ document.exitPointerLock(); }catch(e){} } if(typeof viewfinderOn!=="undefined"&&viewfinderOn) lowerCamera();
    var checks=s.checks();
    el.innerHTML='<div class="gd-card"><span class="k">'+(GD.demo?'DEMO · ':'')+(s.final?'FIRST SESSION · DONE':'STEP '+(GD.step+1)+' OF '+(GD_STEPS.length-1))+'</span><b class="t">'+cbEsc(s.title)+'</b><p>'+cbEsc(s.body)+'</p>'
      +(s.controls?'<div class="gd-keys">'+s.controls.map(function(c){ return '<span><kbd>'+c[0]+'</kbd>'+c[1]+'</span>'; }).join("")+'</div>':'')
      +(checks.length?'<div class="gd-list">'+checks.map(function(c){ return '<span><i></i>'+cbEsc(c.t)+'</span>'; }).join("")+'</div>':'')
      +(s.final?'<div class="gd-two"><button data-gd="shootown">GO AND SHOOT YOUR OWN</button></div>':'')
      +'<div class="gd-acts"><button class="gd-skip" data-gd="skip">'+(s.final?'':'Skip the guide')+'</button>'+(s.final?'':'<button class="gd-skip gd-next" data-gd="next" title="Move on to the next step without doing this one">Skip this step ›</button>')+'<button class="gd-go" data-gd="go">'+s.btn+'</button></div></div>';
    el.classList.add("show"); GD.open=true; GD.shown=GD.step; gdSave();
    Array.prototype.forEach.call(el.querySelectorAll("[data-gd]"),function(b){ readLock(b); }); }
  // Read first: a popup's buttons wait a few seconds, with a gold bar filling across them, so it gets read rather than
  // clicked straight through. ?quick (for the tests) cuts it right down.
  var READ_MS=/[?&]quick(&|=|$)/.test(location.search)?250:(qDemo()?2000:5000);
  function readLock(b,ms){ ms=ms==null?READ_MS:ms; if(!b||ms<=0) return; b.disabled=true; b.classList.add("rl"); b.style.setProperty("--rl",ms+"ms");
    setTimeout(function(){ b.disabled=false; b.classList.remove("rl"); },ms); }
  function gdClose(){ var el=$("gdPop"); if(el) el.classList.remove("show"); GD.open=false; gdCard(); }
  function gdCard(){ var el=gdEl("gdCard","gd-track"), s=GD_STEPS[GD.step];
    if(!gdActive()||!s||s.final||GD.open||s.id==="basics"||coActive()){ el.classList.remove("show"); return; }
    var checks=s.checks(), done=checks.filter(function(c){ return c.ok; }).length;
    var html='<div class="hd"><span class="k">'+(GD.demo?'DEMO · ':'')+'STEP '+(GD.step+1)+' · '+cbEsc(s.title.toUpperCase())+'</span><span class="fr">'+done+' / '+checks.length+'</span><button data-gd="help" title="Show this step again">?</button><button class="nx" data-gd="next" title="Skip this step">SKIP ›</button></div>'
      +checks.map(function(c){ return '<div class="ck'+(c.ok?' ok':'')+'"><i>'+(c.ok?'✓':'')+'</i><span>'+cbEsc(c.t)+'</span>'+(c.now?'<em>'+c.now+'</em>':'')+'</div>'; }).join("")
      +'<div class="bar"><b style="width:'+(checks.length?done/checks.length*100:0).toFixed(0)+'%"></b></div>';
    if(el._html!==html){ el.innerHTML=html; el._html=html; }   // only when it changes, so its buttons stay clickable
    el.classList.add("show"); }
  function gdTour(id, here){ if(here&&!GD.open&&GD.shown===GD.step&&!coTourDone(id)&&!(CO.on&&CO.tour===id)) coStart(id); }
  function gdNext(){ if(CO.on) coStop(); GD.step++; GD.flags={}; var s=GD_STEPS[GD.step]; if(s&&s.onStart) s.onStart(); gdSave(); if(s) setTimeout(function(){ if(GD.shown!==GD.step&&!GD.open) gdPop(); }, 500); else gdCard(); }   // unless the tracker already showed it
  function gdTick(){ if(!gdActive()){ var c=$("gdCard"); if(c) c.classList.remove("show"); return; } var s=GD_STEPS[GD.step];
    if(s.where==="scene"&&!loaded&&!st.open) return;   // waits for a location to load
    if(s.tick) s.tick();
    if(GD.shown!==GD.step&&!GD.open){ gdPop(); return; }
    var checks=s.checks(); if(!GD.open) gdCard();
    if(!s.final&&checks.length&&checks.every(function(c){ return c.ok; })&&!GD.open){ toast("Step done: "+s.title); gdNext(); } }
  function gdStart(){ gdLoad(); if(GD.step<0) return; clearInterval(GD.timer); GD.timer=setInterval(gdTick, 700); }
  document.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("[data-gd]"); if(!b) return; var a=b.getAttribute("data-gd"), s=GD_STEPS[GD.step];
    if(a==="skip"){ if(CO.on) coStop(); GD.step=-1; GD.demo=false; gdSave(); gdClose(); toast("Guide off. Turn it back on from the ? button."); return; }
    if(a==="help"){ gdPop(); return; }
    if(a==="next"){ if(!s||s.final) return; if(coActive()){ coFinish(false); } gdClose(); toast("Skipped: "+s.title); gdNext(); return; }   // move on without doing it (handy for trying the steps out)
    if(a==="shootown"){ GD.step=-1; GD.demo=false; gdSave(); gdClose(); if(typeof lsGo==="function") lsGo("shoot"); return; }
    if(a==="go"){ gdClose(); if(s&&s.final){ GD.step=-1; gdSave(); return; } if(s&&s.go) s.go(); } });
  // the ? button: show the current step, or start the guide again
  function gdHelp(){ if(gdActive()){ gdPop(); return; } GD.step=0; GD.flags={}; GD.shown=-1; gdSave(); gdStart(); gdPop(); }
  if(/[?&]dev/.test(location.search)) window.__gd={ state:function(){ return {step:GD.step, demo:GD.demo, n:GD_STEPS.length, id:GD_STEPS[GD.step]&&GD_STEPS[GD.step].id, open:GD.open, checks:gdActive()?GD_STEPS[GD.step].checks():[]}; },
    set:function(n){ GD.step=n; GD.flags={}; GD.shown=-1; var s=GD_STEPS[n]; if(s&&s.onStart) s.onStart(); gdSave(); }, flag:function(k){ GD.flags[k]=1; } };
