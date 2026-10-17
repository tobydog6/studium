  // ================= GUIDE: the first session, step by step =================
  // A run of short popups that walks a new student through the whole loop once: the challenges at the location,
  // a free shoot across every lens, picking a top 8, editing them, a workbook page, the top of a folio panel, then
  // the book and gallery to explore on their own. A small checklist card keeps the current step in view, and each
  // step moves on by itself once its boxes are ticked. Off for students in a teacher's lesson plan (the plan leads).
  // The DEMO (from the sign-in page) is the same loop cut down to about ten minutes for playtesters: two challenges,
  // five photos, a top 3, a quick edit, one workbook page and the top of a folio panel.
  var GD_KEY="studium_guide_v1";
  var GD={step:-1, base:0, flags:{}, shown:-1, timer:0, open:false, demo:false, t0:0};
  function gdLoad(){ var raw=null; try{ raw=localStorage.getItem(GD_KEY); }catch(e){}
    if(raw==="off"){ GD.step=-1; GD.demo=false; GD_STEPS=GD_FULL; return; }
    try{ var d=JSON.parse(raw||"null"); if(d&&typeof d.step==="number"){ GD.step=d.step; GD.base=d.base||0; GD.flags=d.flags||{}; GD.shown=d.shown; GD.demo=!!d.demo; GD.t0=d.t0||0; GD_STEPS=GD.demo?GD_DEMO:GD_FULL; return; } }catch(e){}
    GD.step=0; GD.shown=-1; }
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
    {id:"challenges", where:"scene", title:"Welcome to the Stump",
     body:"Walk the clearing and find the gold frames. Each one is a challenge: step up to it, let it draw you in, set the camera the way the card asks, and take the shot. Do all six.",
     controls:[["Click","Look around (Esc to let go)"],["W A S D","Walk"],["Q / E","Crouch, stand taller"],["P","Raise the camera"],["Click or ↵","Take the photo"],["1 2 3 4, scroll","Pick a dial, turn it"],["B","Camera bag: bodies and lenses"],["X","Turn the camera vertical"],["Space","Camera back: settings and your shots"],["Tab","Studio"]],
     btn:"START EXPLORING",
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
     body:"Time for the light table. Look at everything you shot and pick your strongest 8. Press P to pick, X to reject the ones you won't use, and use the stars if it helps you decide. Be ruthless: only 8.",
     btn:"OPEN SELECT", go:function(){ LIB.key="all"; openStudio("select"); },
     checks:function(){ var n=gdPicked().length; return [{t:"Open Select in the studio (Tab)", ok:st.open&&st.room==="select"||GD.flags.sel, now:""}, {t:"Pick exactly 8 frames", ok:n===8, now:n+" / 8"}]; },
     tick:function(){ if(st.open&&st.room==="select") GD.flags.sel=1; }},
    {id:"edit", where:"edit", title:"Edit your picks",
     body:"Your 8 picks are waiting in The Stump › Picked photos. Work through them: get the light right on one, then copy those settings across the others with Sync. Try one in black and white, and crop one to tighten the composition.",
     btn:"OPEN EDIT", go:function(){ var key=null; libFolders().forEach(function(f){ if(f.kind==="sub"&&!key) key=f.key; }); var ids=key?libItems(key):stPicks(); if(key) LIB.key=key; devScope=ids.slice(); st.cur=ids[0]; openStudio("edit"); },
     checks:function(){ return [
       {t:"Change the light on a frame (exposure, contrast, highlights or shadows)", ok:gdDev(function(d){ return d.exposure||d.contrast||d.highlights||d.shadows||d.whites||d.blacks; })},
       {t:"Sync your settings to other frames (select several in the strip, then Sync)", ok:!!GD.flags.synced},
       {t:"Make one black and white", ok:gdDev(function(d){ return d.mono||d.profile==="bw"||d.profile==="mono"; })},
       {t:"Crop one (aspect, zoom or straighten)", ok:gdDev(function(d){ return (d.aspect&&d.aspect!=="free")||d.zoom>1.01||Math.abs(d.rot||0)>0.2; })}]; }},
    {id:"workbook", where:"workbook", title:"Make a workbook page",
     body:"The workbook is where you show your thinking. Start a page from a template on the right: it brings in your photos and puts questions in the text boxes. Click a box to answer, and use an arrow to point at the exact part of a photo you're talking about.",
     btn:"OPEN THE WORKBOOK", go:function(){ openStudio("workshop"); },
     checks:function(){ return [
       {t:"Start a page from a template", ok:gdWsItems(function(it){ return it.t==="text"&&it.ph; })>0},
       {t:"Have at least 2 photos on your pages", ok:gdWsItems(function(it){ return it.t==="photo"; })>=2},
       {t:"Write about them (a few sentences)", ok:gdWsItems(function(it){ return it.t==="text"&&String(it.text||"").trim().length>=40; })>0},
       {t:"Point to something with an arrow", ok:gdWsItems(function(it){ return it.t==="line"&&it.head!=="none"; })>0}]; }},
    {id:"folio", where:"folio", title:"Start your folio board",
     body:"A folio board is A1 panels side by side, filled edge to edge. Zoom into the top section of the first panel (the ⤢ button) and lay it out with your edited photos: drag them in from the library, then try Best fit, Rows, Columns and Hero until it feels right.",
     btn:"OPEN THE FOLIO", go:function(){ openStudio("folio"); },
     checks:function(){ var top=gdFoTop(), ed=top.filter(function(it){ var i=stById(it.pid); return i>=0&&photos[i].dev; }).length;
       return [{t:"Zoom into panel 1, top section", ok:!!GD.flags.zoomed},
         {t:"Lay out at least 3 photos in it", ok:top.length>=3, now:Math.min(top.length,3)+" / 3"},
         {t:"Use at least 2 edited photos", ok:ed>=2, now:Math.min(ed,2)+" / 2"}]; },
     tick:function(){ if(typeof foB!=="undefined"&&st.open&&st.room==="folio"&&foB.view_()===0) GD.flags.zoomed=1; }},
    {id:"done", where:"any", title:"You've done the whole loop",
     body:"Shoot, select, edit, workbook, folio: that's how a photography project runs. Two more rooms are yours to explore whenever you like. The Book lays your work out as a photobook, and the Gallery hangs it on the walls of a show you can walk through.",
     btn:"FINISH", final:true, checks:function(){ return []; }}];
  // the ten-minute demo: the same rooms, less of each
  var GD_DEMO_CH=["stump-fgbg","stump-dof"];   // wide and close at f/11, then the 85 wide open: lens and aperture side by side
  var GD_DEMO=[
    {id:"challenges", where:"scene", title:"Welcome to the Stump",
     body:"This is a ten-minute taste of Studium. Walk the clearing and find the two gold frames. Step into the glow around one and it draws you in. Set the camera the way its card asks, then take the shot.",
     controls:GD_FULL[0].controls, btn:"START EXPLORING",
     checks:function(){ var n=CH.list.length, d=CH.list.filter(function(c){ return CH.done[c.id]; }).length; return [{t:"Complete the two gold-frame challenges", ok:n>0&&d>=n, now:d+" / "+(n||2)}]; }},
    {id:"shoot", where:"scene", title:"Five of your own",
     body:"Now take 5 photos your way. Swap lenses at least once (B opens the camera bag), and try a wide aperture and a narrow one to see what changes.",
     btn:"KEEP SHOOTING", onStart:function(){ GD.base=photos.length; },
     checks:function(){ var n=gdNew().length, lc=Object.keys(gdLensCount()).length;
       return [{t:"Take 5 photos", ok:n>=5, now:Math.min(n,5)+" / 5"}, {t:"Use 2 different lenses", ok:lc>=2, now:Math.min(lc,2)+" / 2"}, {t:"Use 2 different apertures", ok:gdDistinct("f")>=2, now:Math.min(gdDistinct("f"),2)+" / 2"}]; }},
    {id:"select", where:"select", title:"Pick your best 3",
     body:"The light table shows everything you shot. Press P to pick your 3 strongest frames, X to reject the rest. Be choosy.",
     btn:"OPEN SELECT", go:GD_FULL[2].go,
     checks:function(){ var n=gdPicked().length; return [{t:"Open Select in the studio (Tab)", ok:st.open&&st.room==="select"||GD.flags.sel, now:""}, {t:"Pick 3 frames", ok:n===3, now:n+" / 3"}]; },
     tick:GD_FULL[2].tick},
    {id:"edit", where:"edit", title:"Edit your picks",
     body:"Your picks are in The Stump › Picked photos. Get the light right on one (try pulling Highlights down and Shadows up), then make one black and white or crop it tighter.",
     btn:"OPEN EDIT", go:GD_FULL[3].go,
     checks:function(){ return [GD_FULL[3].checks()[0],
       {t:"Make one black and white, or crop one", ok:gdDev(function(d){ return d.mono||d.profile==="mono"||(d.aspect&&d.aspect!=="free")||d.zoom>1.01; })}]; }},
    {id:"workbook", where:"workbook", title:"One workbook page",
     body:"The workbook is where you explain your thinking. Start a page from a template on the right, then click a text box and write a sentence about why your best photo works.",
     btn:"OPEN THE WORKBOOK", go:GD_FULL[4].go,
     checks:function(){ return [GD_FULL[4].checks()[0], {t:"Write a sentence about a photo", ok:gdWsItems(function(it){ return it.t==="text"&&String(it.text||"").trim().length>=20; })>0}]; }},
    {id:"folio", where:"folio", title:"The top of a folio panel",
     body:"A folio board is big panels filled edge to edge. Zoom into the top section of the first panel (the ⤢ button) and drag in two of your photos from the library. Try Best fit, Rows and Hero.",
     btn:"OPEN THE FOLIO", go:GD_FULL[5].go,
     checks:function(){ var top=gdFoTop(); return [{t:"Zoom into panel 1, top section", ok:!!GD.flags.zoomed}, {t:"Lay out 2 photos in it", ok:top.length>=2, now:Math.min(top.length,2)+" / 2"}]; },
     tick:GD_FULL[5].tick},
    {id:"done", where:"any", title:"That's the demo",
     body:"Shoot, select, edit, workbook, folio: that's a photography project from start to finish. The Book and the Gallery are there to explore if you'd like to keep going.",
     btn:"FINISH", final:true, checks:function(){ return []; }}];
  var GD_STEPS=GD_FULL;
  function gdIsDemo(){ return GD.demo&&GD.step>=0; }
  // from the sign-in page: a fresh demo from the first step
  function gdStartDemo(){ GD.demo=true; GD_STEPS=GD_DEMO; GD.step=0; GD.flags={}; GD.shown=-1; GD.base=photos.length; GD.t0=Date.now(); gdSave(); clearInterval(GD.timer); GD.timer=setInterval(gdTick, 700); }
  function gdTook(){ if(!GD.t0) return ""; var s=Math.round((Date.now()-GD.t0)/1000); return Math.floor(s/60)+" min "+(s%60<10?"0":"")+(s%60)+" s"; }
  // ---- popup + checklist card ----
  function gdEl(id, cls){ var e=$(id); if(!e){ e=document.createElement("div"); e.id=id; e.className=cls; document.body.appendChild(e); } return e; }
  function gdPop(){ var s=GD_STEPS[GD.step]; if(!s) return; var el=gdEl("gdPop","gd-pop");
    if(typeof looking!=="undefined"&&looking){ try{ document.exitPointerLock(); }catch(e){} } if(typeof viewfinderOn!=="undefined"&&viewfinderOn) lowerCamera();
    var checks=s.checks();
    el.innerHTML='<div class="gd-card"><span class="k">'+(GD.demo?'DEMO · ':'')+(s.final?(GD.demo?'DONE IN '+gdTook().toUpperCase():'FIRST SESSION · DONE'):'STEP '+(GD.step+1)+' OF '+(GD_STEPS.length-1))+'</span><b class="t">'+cbEsc(s.title)+'</b><p>'+cbEsc(s.body)+'</p>'
      +(s.controls?'<div class="gd-keys">'+s.controls.map(function(c){ return '<span><kbd>'+c[0]+'</kbd>'+c[1]+'</span>'; }).join("")+'</div>':'')
      +(checks.length?'<div class="gd-list">'+checks.map(function(c){ return '<span><i></i>'+cbEsc(c.t)+'</span>'; }).join("")+'</div>':'')
      +(s.final?'<div class="gd-two"><button data-gd="book">OPEN THE BOOK</button><button data-gd="gallery">OPEN THE GALLERY</button></div>':'')
      +'<div class="gd-acts"><button class="gd-skip" data-gd="skip">'+(s.final?'':'Skip the guide')+'</button>'+(s.final?'':'<button class="gd-skip gd-next" data-gd="next" title="Move on to the next step without doing this one">Skip this step ›</button>')+'<button class="gd-go" data-gd="go">'+s.btn+'</button></div></div>';
    el.classList.add("show"); GD.open=true; GD.shown=GD.step; gdSave(); }
  function gdClose(){ var el=$("gdPop"); if(el) el.classList.remove("show"); GD.open=false; gdCard(); }
  function gdCard(){ var el=gdEl("gdCard","gd-track"), s=GD_STEPS[GD.step];
    if(!gdActive()||!s||s.final||GD.open){ el.classList.remove("show"); return; }
    var checks=s.checks(), done=checks.filter(function(c){ return c.ok; }).length;
    var html='<div class="hd"><span class="k">'+(GD.demo?'DEMO · ':'')+'STEP '+(GD.step+1)+' · '+cbEsc(s.title.toUpperCase())+'</span><span class="fr">'+done+' / '+checks.length+'</span><button data-gd="help" title="Show this step again">?</button><button class="nx" data-gd="next" title="Skip this step">SKIP ›</button></div>'
      +checks.map(function(c){ return '<div class="ck'+(c.ok?' ok':'')+'"><i>'+(c.ok?'✓':'')+'</i><span>'+cbEsc(c.t)+'</span>'+(c.now?'<em>'+c.now+'</em>':'')+'</div>'; }).join("")
      +'<div class="bar"><b style="width:'+(checks.length?done/checks.length*100:0).toFixed(0)+'%"></b></div>';
    if(el._html!==html){ el.innerHTML=html; el._html=html; }   // only when it changes, so its buttons stay clickable
    el.classList.add("show"); }
  function gdNext(){ GD.step++; GD.flags={}; var s=GD_STEPS[GD.step]; if(s&&s.onStart) s.onStart(); gdSave(); if(s) setTimeout(gdPop, 500); else gdCard(); }
  function gdTick(){ if(!gdActive()){ var c=$("gdCard"); if(c) c.classList.remove("show"); return; } var s=GD_STEPS[GD.step];
    if(s.where==="scene"&&!loaded&&!st.open) return;   // waits for a location to load
    if(s.tick) s.tick();
    if(GD.shown!==GD.step&&!GD.open){ gdPop(); return; }
    var checks=s.checks(); if(!GD.open) gdCard();
    if(!s.final&&checks.length&&checks.every(function(c){ return c.ok; })&&!GD.open){ toast("Step done: "+s.title); gdNext(); } }
  function gdStart(){ gdLoad(); if(GD.step<0) return; clearInterval(GD.timer); GD.timer=setInterval(gdTick, 700); }
  document.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("[data-gd]"); if(!b) return; var a=b.getAttribute("data-gd"), s=GD_STEPS[GD.step];
    if(a==="skip"){ GD.step=-1; GD.demo=false; gdSave(); gdClose(); toast("Guide off. Turn it back on from the ? button."); return; }
    if(a==="help"){ gdPop(); return; }
    if(a==="next"){ if(!s||s.final) return; gdClose(); toast("Skipped: "+s.title); gdNext(); return; }   // move on without doing it (handy for trying the steps out)
    if(a==="book"||a==="gallery"){ GD.step=-1; gdSave(); gdClose(); openStudio(a); return; }
    if(a==="go"){ gdClose(); if(s&&s.final){ GD.step=-1; gdSave(); return; } if(s&&s.go) s.go(); } });
  // the ? button: show the current step, or start the guide again
  function gdHelp(){ if(gdActive()){ gdPop(); return; } GD.step=0; GD.flags={}; GD.shown=-1; gdSave(); gdStart(); gdPop(); }
  if(/[?&]dev/.test(location.search)) window.__gd={ state:function(){ return {step:GD.step, demo:GD.demo, n:GD_STEPS.length, id:GD_STEPS[GD.step]&&GD_STEPS[GD.step].id, open:GD.open, checks:gdActive()?GD_STEPS[GD.step].checks():[]}; },
    set:function(n){ GD.step=n; GD.flags={}; GD.shown=-1; var s=GD_STEPS[n]; if(s&&s.onStart) s.onStart(); gdSave(); }, flag:function(k){ GD.flags[k]=1; } };
