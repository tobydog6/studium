  // ================= COACH: hands-on tours, one prompt at a time =================
  // The way a game teaches its controls: one short prompt at the bottom of the screen (or beside the thing it's about),
  // the thing to click lit up, and the prompt ticks over by itself the moment it's done. Three tours, each run by a
  // guide step:
  //   basics  at the location, before the gold frames unlock: look, walk, crouch, the camera, the bag, the camera back
  //   select  on the light table: look at a photo, Pick, Reject, then choose your best
  //   edit    across the three picks: the Light sliders on the first, black and white by hand on the second, then
  //           a crop and the Color Grading wheels on the third
  // Progress lives in the guide step's flags (GD.flags.co), so a reload carries on from the same prompt.
  var CO={tour:null, i:0, on:false, s:{}, keys:{}, look:0, walked:0, lx:null, lz:null, lyaw:null, done:false, raf:0, html:"", okT:0, t0:0, seen:-1};
  function coK(k){ return '<kbd data-co-k="'+k+'"'+(CO.keys[k]?' class="on"':'')+'>'+k+'</kbd>'; }
  function coPickN(){ return GD.demo?3:8; }
  function coPicks(){ return photos.filter(function(p){ return p.pick; }).length; }
  function coEdIdx(){ return typeof devOpenIdx==="function"?devOpenIdx():-1; }
  function coInEditor(){ return typeof editor!=="undefined"&&editor&&!editor.classList.contains("hidden")&&!!edState; }
  // open a Develop panel section and bring it into view
  function coSec(name){ var s=document.querySelector('#editor .lr-sec[data-sec="'+name+'"]'); if(s) s.classList.remove("collapsed"); return s; }
  function coShow(sel){ setTimeout(function(){ var e=document.querySelector(sel); if(e&&e.scrollIntoView) try{ e.scrollIntoView({block:"center", behavior:"smooth"}); }catch(er){ e.scrollIntoView(); } },60); }
  function coRow(id){ return '#editor .lr-row:has(#'+id+')'; }
  // the boards (workbook, folio) and what's on them
  function coWs(){ return typeof wsB!=="undefined"?wsB.page():{items:[]}; }
  function coWsN(t){ return coWs().items.filter(function(it){ return it.t===t; }).length; }
  function coWsEl(test){ var pg=coWs(), k=-1; pg.items.forEach(function(it,j){ if(k<0&&test(it)) k=j; }); return k<0?null:document.querySelector('#st-workshop .bd-sheet [data-bd="'+k+'"]'); }
  function coArrow(){ var a=null; coWs().items.forEach(function(it){ if(it.t==="line"&&it.head!=="none") a=it; }); return a; }
  function coInPhoto(x,y){ return coWs().items.some(function(it){ if(it.t!=="photo") return false; var h=it.w/((typeof stAspect==="function"&&stById(it.pid)>=0)?stAspect(stById(it.pid)):1.5); return x>=it.x&&x<=it.x+it.w&&y>=it.y&&y<=it.y+h; }); }
  function coFoSec(){ return typeof foB!=="undefined"?foB.secItems("0.0"):[]; }
  function coRoom(r){ return typeof st!=="undefined"&&st.open&&st.room===r; }
  var CO_TOURS={
    basics:{where:function(){ return loaded&&!App.is("hub")&&!(typeof st!=="undefined"&&st.open); }, steps:[
      {ch:"MOVE", line:function(){ return 'Click, then move the mouse to look around'; }, sub:"Esc lets go of the mouse.",
        done:function(){ return CO.look>1.6; }, bar:function(){ return CO.look/1.6; }},
      {ch:"MOVE", line:function(){ return coK("W")+coK("A")+coK("S")+coK("D")+' to walk'; }, sub:"Have a wander. You can't walk through the stump.",
        done:function(){ return CO.walked>3; }, bar:function(){ return CO.walked/3; }},
      {ch:"MOVE", line:function(){ return coK("Q")+' to crouch, '+coK("E")+' to stand tall'; }, sub:"Where you hold the camera changes the picture.",
        done:function(){ return CO.keys.Q&&CO.keys.E; }},
      {ch:"SHOOT", line:function(){ return coK("P")+' raises the camera to your eye'; }, sub:"You're looking through the viewfinder now.",
        done:function(){ return viewfinderOn; }},
      {ch:"SHOOT", line:function(){ return '<kbd>CLICK</kbd> to take a photo'; }, sub:"Anything you like. It goes into your studio.",
        start:function(){ CO.s.n=photos.length; }, done:function(){ return photos.length>CO.s.n; }, need:"vf"},
      {ch:"SHOOT", line:function(){ return coK("2")+' then <kbd>SCROLL</kbd> to change the aperture'; }, sub:"1 is shutter, 2 aperture, 3 ISO, 4 zoom. Watch the numbers along the bottom.",
        start:function(){ CO.s.ap=apIdx; }, done:function(){ return apIdx!==CO.s.ap; }, need:"vf"},
      {ch:"BAG", line:function(){ return coK("B")+' opens your camera bag'; }, sub:"Different cameras and lenses for different pictures.",
        done:function(){ return bg.open; }},
      {ch:"BAG", line:function(){ return 'Click the <b>APS-C mirrorless</b>'; }, sub:"Its smaller sensor crops every lens 1.6× tighter.",
        target:'#bag [data-bg-body="ml"]', done:function(){ return bg.body==="ml"; }, need:"bag"},
      {ch:"BAG", line:function(){ return 'Now <b>change the lens</b>'; }, sub:"",
        target:'#bag .lensbtn', done:function(){ return bg.stage==="lens"; }, need:"bag"},
      {ch:"BAG", line:function(){ return 'Try the <b>50 mm</b>'; }, sub:"Watch it twist off and the new one click on.",
        target:'#bag [data-bg-lens="50"]', done:function(){ return bg.lens==="50"&&!bg.busy; }, need:"lens"},
      {ch:"BAG", line:function(){ return '<b>Lock it in</b>'; }, sub:"",
        target:'#bag [data-bg="done"]', done:function(){ return bg.stage==="choose"&&lensId==="50"; }, need:"lens"},
      {ch:"BAG", line:function(){ return coK("B")+' closes the bag'; }, sub:"",
        done:function(){ return !bg.open; }},
      {ch:"SETTINGS", line:function(){ return coK("SPACE")+' opens the back of the camera'; }, sub:"All your settings, and the photos you've taken.",
        done:function(){ return cbOpen; }},
      {ch:"SETTINGS", line:function(){ return '<b>Shutter speed</b>: click a different one'; }, sub:"How long light gets in. Fast freezes movement, slow lets it blur.",
        target:'#camback [data-cb-row="0"]', start:function(){ CO.s.sh=shIdx; }, done:function(){ return shIdx!==CO.s.sh; }, need:"back"},
      {ch:"SETTINGS", line:function(){ return 'The <b>light meter</b>: get the needle to the middle'; }, sub:"Left is too dark, right too bright. Shutter, aperture and ISO all move it.",
        target:'#camback .cb-meter', dwell:2600, done:function(){ return Math.abs(evStops)<=0.5; }, need:"back"},
      {ch:"SETTINGS", line:function(){ return coK("SPACE")+' takes you back to the scene'; }, sub:"",
        done:function(){ return !cbOpen; }}]},
    select:{where:function(){ return typeof st!=="undefined"&&st.open&&st.room==="select"; }, steps:[
      {ch:"LOOK", line:function(){ return 'Every photo you took is on the <b>light table</b>'; }, sub:"Picking your best is half of photography. Take your time.",
        target:'#st-select .st-sheet', info:true},
      {ch:"LOOK", line:function(){ return '<b>Click a photo</b> to see it big'; }, sub:"Or use "+'← →'+" to move along.",
        target:'#st-select .st-cell:not(.cur)', start:function(){ CO.s.cur=st.cur; }, done:function(){ return st.cur!==CO.s.cur; }},
      {ch:"CHOOSE", line:function(){ return '<b>Pick</b> keeps it for your folio'; }, sub:"Click Pick, or press P. The pencil ring shows it's in.",
        target:'#st-select [data-st-act="pick"]', done:function(){ var p=photos[st.cur]; return !!(p&&p.pick); }},
      {ch:"CHOOSE", line:function(){ return '<b>Reject</b> the ones you won\'t use'; }, sub:"Click a weaker photo first, then Reject (or press X). It's struck out, not deleted.",
        target:'#st-select [data-st-act="reject"]', start:function(){ CO.s.r=photos.filter(function(p){ return p.reject; }).length; }, done:function(){ return photos.filter(function(p){ return p.reject; }).length>CO.s.r; }},
      {ch:"CHOOSE", line:function(){ return 'Now pick your best <b>'+coPickN()+'</b>'; }, sub:"Click a photo, then Pick. Click Pick again to change your mind.",
        target:'#st-select .st-loupe .brief', done:function(){ return coPicks()===coPickN(); }, bar:function(){ return coPicks()/coPickN(); }}]},
    edit:{where:coInEditor, steps:[
      {ch:"LIGHT", line:function(){ return 'These are the <b>Light</b> sliders'; }, sub:"They brighten and darken parts of the photo without wrecking the colour.",
        target:'#editor .lr-sec[data-sec="light"]', prep:function(){ coSec("light"); coShow('#editor .lr-sec[data-sec="light"]'); }, info:true},
      {ch:"LIGHT", line:function(){ return 'Drag <b>Exposure</b> to brighten or darken the whole photo'; }, sub:"Double-click any slider to put it back to zero.",
        target:coRow("pExposure"), prep:function(){ coSec("light"); }, done:function(){ return edState.exposure!==0; }},
      {ch:"LIGHT", line:function(){ return 'Pull <b>Highlights</b> down to bring back the bright parts'; }, sub:"Watch the sky and anything white get detail back.",
        target:coRow("pHighlights"), done:function(){ return edState.highlights<0; }},
      {ch:"LIGHT", line:function(){ return 'Push <b>Shadows</b> up to open up the dark parts'; }, sub:"",
        target:coRow("pShadows"), done:function(){ return edState.shadows>0; }},
      {ch:"LIGHT", line:function(){ return 'Press '+coK("\\")+' to see before and after'; }, sub:"Press it again to come back to your edit.",
        done:function(){ return CO.keys["\\"]; }},
      {ch:"LIGHT", line:function(){ return 'On to your second photo: <b>›</b>'; }, sub:"Or press →. Your edit stays on this one.",
        target:'#dvNext', start:function(){ CO.s.i=coEdIdx(); }, done:function(){ return coEdIdx()!==CO.s.i; }},
      {ch:"B&W", line:function(){ return 'Black and white by hand: drag <b>Saturation</b> all the way left'; }, sub:"No colour left, just light.",
        target:coRow("pSaturation"), prep:function(){ coSec("color"); coShow(coRow("pSaturation")); }, done:function(){ return edState.saturation<=-90; }},
      {ch:"B&W", line:function(){ return 'Push <b>Contrast</b> up to give the greys some punch'; }, sub:"Black and white lives on contrast.",
        target:coRow("pContrast"), prep:function(){ coShow(coRow("pContrast")); }, done:function(){ return edState.contrast>=20; }},
      {ch:"B&W", line:function(){ return 'Pull <b>Blacks</b> down for deep shadows'; }, sub:"And try Whites up for clean brights.",
        target:coRow("pBlacks"), done:function(){ return edState.blacks<0; }},
      {ch:"B&W", line:function(){ return 'On to your third photo: <b>›</b>'; }, sub:"",
        target:'#dvNext', start:function(){ CO.s.i=coEdIdx(); }, done:function(){ return coEdIdx()!==CO.s.i; }},
      {ch:"CROP", line:function(){ return 'Crop: <b>pick a shape</b>'; }, sub:"Square, 4:5 for a portrait feel, 16:9 for cinema.",
        target:'#editor .lr-croptools', done:function(){ return edState.aspect!=="free"; }},
      {ch:"CROP", line:function(){ return '<b>Drag the photo</b> to choose what\'s in the crop'; }, sub:"Put the stump where it looks best: try a third of the way in.",
        target:'#editCanvas', start:function(){ CO.s.cx=edState.cx; CO.s.cy=edState.cy; }, done:function(){ return Math.abs(edState.cx-CO.s.cx)+Math.abs(edState.cy-CO.s.cy)>0.02; }},
      {ch:"GRADE", line:function(){ return '<b>Color Grading</b> tints the shadows, midtones and highlights'; }, sub:"Film looks, moods, sunsets. A little goes a long way.",
        target:'#lrGrade', prep:function(){ coSec("grading"); if(typeof cgTab!=="undefined"&&cgTab!=="3"){ cgTab="3"; edpGrade(); } coShow('#lrGrade .cg-pair'); }, info:true},
      {ch:"GRADE", line:function(){ return 'Drag in the <b>Shadows</b> wheel towards blue'; }, sub:"Further from the middle is stronger.",
        target:'#lrGrade .cg-disc[data-cg="gSh"]', done:function(){ return edState.gShS>=10; }},
      {ch:"GRADE", line:function(){ return 'And the <b>Highlights</b> wheel towards orange'; }, sub:"Cool shadows, warm light: the classic film look.",
        target:'#lrGrade .cg-disc[data-cg="gHi"]', done:function(){ return edState.gHiS>=10; }},
      {ch:"GRADE", line:function(){ return '<b>Done</b> saves your edits'; }, sub:"They stay on each photo. Come back any time and the sliders are where you left them.",
        target:'#eSave', away:true, done:function(){ return !coInEditor(); }}]},
    workbook:{where:function(){ return coRoom("workshop"); }, steps:[
      {ch:"PAGE", line:function(){ return 'Your <b>workbook</b> is where you show your thinking'; }, sub:"Photos, notes and arrows on A3 pages, like the workbooks that win scholarships.",
        target:'#st-workshop .bd-sheet', info:true},
      {ch:"PAGE", line:function(){ return 'Start a page from the <b>Compare</b> template'; }, sub:"Templates give you a layout with questions already in the text boxes.",
        target:'#st-workshop [data-bd-tmpl="0"]', done:function(){ return coWs().tpl==="compare"; }},
      {ch:"PHOTOS", line:function(){ return '<b>Drag a photo</b> from the left into Photo A'; }, sub:"Or click the space, then click a photo.",
        target:'#st-workshop .bd-it.sl', done:function(){ return coWsN("photo")>=1; }},
      {ch:"PHOTOS", line:function(){ return 'And another into <b>Photo B</b>'; }, sub:"Two you'd like to compare: different angles, light or lenses.",
        target:'#st-workshop .bd-it.sl', done:function(){ return coWsN("photo")>=2; }},
      {ch:"ARROW", line:function(){ return 'Add an <b>arrow</b> from the rail'; }, sub:"Arrows tie what you write to the exact part of a photo.",
        target:'#st-workshop .bd-tools [data-bd-act="arrow"]', start:function(){ CO.s.n=coWsN("line"); }, done:function(){ return coWsN("line")>CO.s.n; }},
      {ch:"ARROW", line:function(){ return 'Drag the <b>arrow\'s tip</b> onto one thing in a photo'; }, sub:"A shadow, a line, a texture: something you could talk about.",
        target:'#st-workshop [data-bd-h="b"]', start:function(){ var a=coArrow(); CO.s.a=a?{x:a.x,y:a.y,x2:a.x2,y2:a.y2}:null; },
        done:function(){ var a=coArrow(), s=CO.s.a; return !!(a&&s&&(Math.abs(a.x2-s.x2)+Math.abs(a.y2-s.y2)+Math.abs(a.x-s.x)+Math.abs(a.y-s.y)>4)&&coInPhoto(a.x2,a.y2)); }},
      {ch:"WRITE", line:function(){ return '<b>Write a caption</b> about what your arrow points at'; }, sub:"Click the caption box and say what it is and what it does in the photo.",
        target:function(){ return coWsEl(function(it){ return it.t==="text"&&it.role==="caption"; }); }, done:function(){ return coWs().items.some(function(it){ return it.t==="text"&&String(it.text||"").trim().length>=15; }); }},
      {ch:"WRITE", line:function(){ return '<b>Save the page</b> when you\'re happy with it'; }, sub:"Your workbook keeps every page. Add more with the templates any time.",
        target:'#st-workshop [data-bd-act="save"]', start:function(){ CO.s.v=wsB.saves_(); }, done:function(){ return wsB.saves_()>CO.s.v; }}]},
    folio:{where:function(){ return coRoom("folio"); }, steps:[
      {ch:"BOARD", line:function(){ return 'Your <b>folio board</b>: three A1 panels, side by side'; }, sub:"Each panel is split into thirds, and each third packs itself edge to edge.",
        target:'#st-folio .bd-sheet', info:true},
      {ch:"BOARD", line:function(){ return 'Zoom into the <b>top third</b> of panel 1: ⤢'; }, sub:"You work on one third at a time.",
        target:'#st-folio [data-bd-zoom="0"]', done:function(){ return foB.view_()===0; }},
      {ch:"FILL", line:function(){ return '<b>Drag a photo</b> in from the left'; }, sub:"Or click one to add it.",
        target:'#st-folio .lib-grid', done:function(){ return coFoSec().length>=1; }},
      {ch:"FILL", line:function(){ return 'Fill it up: <b>5 photos</b>'; }, sub:"The same photo more than once is fine. Watch them pack to fill the space.",
        target:'#st-folio .lib-grid', done:function(){ return coFoSec().length>=5; }, bar:function(){ return coFoSec().length/5; }},
      {ch:"ARRANGE", line:function(){ return '<b>Drag one photo onto another</b> to swap them'; }, sub:"The order changes how the third fills and reads.",
        target:'#st-folio .bd-sheet .bd-it.ph', start:function(){ CO.s.o=coFoSec().map(function(it){ return it.id; }).join(); }, done:function(){ return coFoSec().map(function(it){ return it.id; }).join()!==CO.s.o; }},
      {ch:"ARRANGE", line:function(){ return 'Try <b>Rows</b>, <b>Columns</b> or <b>Hero</b>'; }, sub:"Same photos, a different arrangement.",
        target:function(){ var b=document.querySelector('#st-folio .bd-side [data-bd-style]'); return b?b.parentNode:null; }, start:function(){ CO.s.st=foB.secStyle("0.0"); }, done:function(){ return foB.secStyle("0.0")!==CO.s.st; }},
      {ch:"ARRANGE", line:function(){ return '<b>Shuffle</b> mixes up the order and sizes'; }, sub:"Keep pressing until something surprises you.",
        target:'#st-folio [data-bd-shuffle]', start:function(){ CO.s.sh=foB.shuffles_(); }, done:function(){ return foB.shuffles_()>CO.s.sh; }},
      {ch:"ARRANGE", line:function(){ return 'Back out to the <b>whole board</b>: ⤡ or '+coK("ESC"); }, sub:"See how your third sits with the rest.",
        target:'#st-folio [data-bd-zoom="-1"]', done:function(){ return foB.view_()<0; }}]},
    book:{where:function(){ return coRoom("book"); }, steps:[
      {ch:"BOOK", line:function(){ return 'The <b>Book</b> lays your picks out as a photobook'; }, sub:"Spreads, sequence and a cover, ready to export as a PDF to print.",
        target:'#st-book .bk-stage', info:true},
      {ch:"BOOK", line:function(){ return 'Click a <b>page template</b> to change this page'; }, sub:"Full bleed, centred, two-up or a grid.",
        target:'#st-book .bk-tpls', click:'#st-book [data-bk-tpl]'},
      {ch:"BOOK", line:function(){ return 'Pages come in <b>spreads</b>, so pairs matter'; }, sub:"Drag pages along the strip to change the sequence.",
        target:'#st-book .bk-strip', info:true}]},
    gallery:{where:function(){ return coRoom("gallery"); }, steps:[
      {ch:"GALLERY", line:function(){ return 'The <b>Gallery</b> hangs your work on a real wall'; }, sub:"At eye height, at real print sizes, like a show.",
        target:'#st-gallery .ga-wall', info:true},
      {ch:"GALLERY", line:function(){ return 'Try a different <b>frame</b>'; }, sub:"",
        target:'#st-gallery .ga-frames', click:'#st-gallery [data-ga-frame]'},
      {ch:"GALLERY", line:function(){ return '<b>Drag prints</b> along the wall to hang your show'; }, sub:"Spacing and sequence tell the story.",
        target:'#st-gallery .ga-hang', info:true}]},
    library:{where:function(){ return coRoom("select"); }, steps:[
      {ch:"YOURS", line:function(){ return 'Make a <b>folder</b> for your own project: + NEW'; }, sub:"A shoot, a theme, a series. Whatever you're working on.",
        target:'#st-select [data-lib-new]', start:function(){ CO.s.p=(st.projects||[]).length; }, done:function(){ return LIB.naming==="new"||(st.projects||[]).length>CO.s.p; }},
      {ch:"YOURS", line:function(){ return '<b>Name it</b>, then press '+coK("ENTER"); }, sub:"",
        target:'#st-select .lib-in', start:function(){ CO.s.p=(st.projects||[]).length; }, done:function(){ return (st.projects||[]).length>CO.s.p||((st.projects||[]).length&&LIB.naming!=="new"&&LIB.key.indexOf("proj:")===0); }},
      {ch:"YOURS", line:function(){ return 'That folder\'s yours. <b>Go and shoot</b>'; }, sub:"Then drag your photos onto it, or drop photos in from your computer. Everything you've learnt today works on them.",
        target:function(){ var a=document.querySelectorAll('#st-select .lib-f.proj'); return a.length?a[a.length-1]:null; }, info:true}]}};
  function coSteps(){ return (CO_TOURS[CO.tour]||{steps:[]}).steps; }
  function coLen(id){ return (CO_TOURS[id]||{steps:[]}).steps.length; }
  var CO_STEPS=CO_TOURS.basics.steps;   // the guide's basics step counts these
  function coTourDone(id){ return (GD.flags.co||0)>=coLen(id); }
  function coActive(){ return CO.on&&!CO.done; }
  // the gold frames wait until the warm-up's done
  function coHidesFrames(){ return typeof gdActive==="function"&&gdActive()&&GD_STEPS[GD.step]&&GD_STEPS[GD.step].id==="basics"; }
  function coEl(){ var e=$("coCard"); if(!e){ e=document.createElement("div"); e.id="coCard"; e.className="co-card"; document.body.appendChild(e);
      var r=document.createElement("div"); r.id="coRing"; r.className="co-ring"; document.body.appendChild(r);
      e.addEventListener("click",function(ev){ if(ev.target.closest("[data-co-skip]")){ ev.stopPropagation(); coFinish(true); }
        if(ev.target.closest("[data-co-next]")){ ev.stopPropagation(); CO.s.ok=true; } }); } return e; }
  function coStart(tour){ tour=tour||"basics"; if(CO.on&&CO.tour===tour) return; if(CO.on) coStop(); CO.ticking=false;
    CO.tour=tour; CO.on=true; CO.done=false; if(GD.flags.co==null) GD.flags.co=0; CO.i=GD.flags.co; CO.look=0; CO.walked=0; CO.lx=null; CO.seen=-1; coEnter(); coLoop(); }
  function coEnter(){ var s=coSteps()[CO.i]; CO.s={}; CO.keys={}; CO.t0=performance.now(); CO.seen=-1; if(s&&s.start) s.start(); CO.html=""; }
  function coStop(){ if(CO.tgt){ CO.tgt.classList.remove("co-target"); CO.tgt=null; } CO.on=false; cancelAnimationFrame(CO.raf); var e=$("coCard"), r=$("coRing"); if(e) e.classList.remove("show"); if(r) r.classList.remove("show"); document.body.classList.remove("co-on"); }
  function coFinish(skipped){ CO.done=true; GD.flags.co=coSteps().length; if(typeof gdSave==="function") gdSave(); coStop();
    if(skipped) toast(CO.tour==="basics"?"Warm-up skipped. The gold frames are out.":"Tour skipped."); }
  function coLoop(){ cancelAnimationFrame(CO.raf); CO.raf=requestAnimationFrame(coLoop); if(!CO.on) return; var T=CO_TOURS[CO.tour], e0;
    var cur=coSteps()[CO.i], here=T&&T.where()&&!GD.open;
    if(!here){ e0=$("coCard"); if(e0) e0.classList.remove("show"); e0=$("coRing"); if(e0) e0.classList.remove("show"); document.body.classList.remove("co-on");
      if(cur&&cur.away&&!CO.ticking&&cur.done()){ CO.ticking=true; CO.i++; GD.flags.co=CO.i; CO.ticking=false; if(typeof gdSave==="function") gdSave(); if(CO.i>=coSteps().length) coFinish(false); else coEnter(); }   // a prompt that finishes by leaving (Done)
      return; }
    // what the student has done since the last frame
    if(looking&&CO.lyaw!=null){ var dy=Math.abs(yaw-CO.lyaw); if(dy<1) CO.look+=dy; } CO.lyaw=yaw;
    if(CO.lx!=null&&!(CH.pull>=0)){ var d=Math.hypot(camPos.x-CO.lx,camPos.z-CO.lz); if(d<0.5) CO.walked+=d; } CO.lx=camPos.x; CO.lz=camPos.z;
    var s=coSteps()[CO.i]; if(!s){ coFinish(false); return; }   // each prompt stays up long enough to read (dwell) before it ticks
    if(CO.seen!==CO.i){ CO.seen=CO.i; if(s.prep) s.prep(); }
    var isDone=(s.info||s.click)?CO.s.ok:s.done();
    if(!CO.ticking&&performance.now()-CO.t0>(s.info?0:(s.dwell||900))&&isDone){ coTicked(); return; }   // one tick per prompt, however late the timer runs
    coRender(s); }
  function coTicked(){ CO.ticking=true; var e=coEl(); e.classList.add("ok"); setTimeout(function(){ CO.ticking=false; e.classList.remove("ok"); CO.i++; GD.flags.co=CO.i; if(typeof gdSave==="function") gdSave();
      if(CO.i>=coSteps().length){ coFinish(false); return; } coEnter(); }, 600); }
  function coRender(s){ var e=coEl(), ring=$("coRing"), steps=coSteps();
    var chs=[], prev=null; steps.forEach(function(x,i){ if(x.ch!==prev){ chs.push({ch:x.ch, first:i}); prev=x.ch; } });
    var inCh=steps.filter(function(x){ return x.ch===s.ch; }), k=inCh.indexOf(s);
    // a nudge when the step needs something open first
    var pre="";
    if(s.need==="vf"&&!viewfinderOn&&!bg.open&&!cbOpen) pre='Raise the camera first: '+coK("P");
    else if((s.need==="bag"||s.need==="lens")&&!bg.open) pre='Open the bag again: '+coK("B");
    else if(s.need==="back"&&!cbOpen) pre='Open the camera back again: '+coK("SPACE");
    var b=s.bar?Math.max(0,Math.min(1,s.bar())):null;
    var html='<div class="co-top">'+chs.map(function(c){ var on=c.ch===s.ch, past=CO.i>c.first&&!on; return '<span class="co-ch'+(on?' on':'')+(past?' past':'')+'">'+c.ch+'</span>'; }).join('<i></i>')
      +'<button class="co-skip" data-co-skip title="Skip this tour">SKIP</button></div>'
      +'<div class="co-line">'+(pre||s.line())+'</div>'+((pre?'':s.sub)?'<div class="co-sub">'+s.sub+'</div>':'')
      +'<div class="co-foot"><div class="co-dots">'+inCh.map(function(_,j){ return '<i class="'+(j<k?'d':j===k?'c':'')+'"></i>'; }).join("")+'</div>'
      +(s.info?'<button class="co-next" data-co-next>GOT IT ›</button>':'')+'</div>'
      +(b!=null?'<div class="co-bar"><b style="width:'+(b*100).toFixed(0)+'%"></b></div>':'');
    if(html!==CO.html){ e.innerHTML=html; CO.html=html; }
    e.classList.add("show"); document.body.classList.add("co-on");
    // light up the thing to click, and sit the card beside it: to its left for the side panels, else below or above
    var t=s.target&&!pre?(typeof s.target==="function"?s.target():document.querySelector(s.target)):null, r=t?t.getBoundingClientRect():null;
    if(CO.tgt!==t){ if(CO.tgt) CO.tgt.classList.remove("co-target"); CO.tgt=t; if(t) t.classList.add("co-target"); }
    if(r&&r.width>2&&r.bottom>0&&r.top<window.innerHeight){ var p=6; ring.style.left=(r.left-p)+"px"; ring.style.top=(r.top-p)+"px"; ring.style.width=(r.width+2*p)+"px"; ring.style.height=(r.height+2*p)+"px"; ring.classList.add("show");
      var W=window.innerWidth, H=window.innerHeight, cw=e.offsetWidth||440, chh=e.offsetHeight||130, x, y;
      if(r.left>W*0.55&&r.left-p-20-cw>12){ x=r.left-p-20-cw; y=Math.max(12,Math.min(H-chh-12,r.top+r.height/2-chh/2)); }
      else { var below=r.bottom+p+16+chh<H-10; x=Math.max(12,Math.min(W-cw-12,r.left+r.width/2-cw/2)); y=below?r.bottom+p+16:Math.max(12,r.top-p-16-chh); }
      e.style.left=x+"px"; e.style.top=y+"px"; e.style.bottom="auto"; e.style.transform="none"; e.classList.add("pinned"); }
    else { ring.classList.remove("show"); e.style.left=""; e.style.top=""; e.style.bottom=""; e.style.transform=""; e.classList.remove("pinned"); } }
  document.addEventListener("click",function(e){ if(!CO.on) return; var s=coSteps()[CO.i]; if(s&&s.click&&e.target.closest&&e.target.closest(s.click)) CO.s.ok=true; }, true);
  document.addEventListener("keydown",function(e){ if(!CO.on) return; var m={KeyW:"W",KeyA:"A",KeyS:"S",KeyD:"D",KeyQ:"Q",KeyE:"E",KeyP:"P",KeyB:"B",Space:"SPACE",Digit2:"2",Backslash:"\\",Escape:"ESC",Enter:"ENTER"}[e.code]; if(m) CO.keys[m]=true; }, true);
  if(/[?&]dev/.test(location.search)) window.__co={ state:function(){ var s=coSteps()[CO.i]; return {on:CO.on, tour:CO.tour, done:CO.done, i:CO.i, n:coSteps().length, ch:s&&s.ch, shown:!!document.querySelector("#coCard.show"), ed:edState?{i:edState.i, a:edState.aspect, cx:+edState.cx.toFixed(3), cy:+edState.cy.toFixed(3)}:null}; }, skip:function(){ coFinish(true); },
    next:function(){ CO.s.ok=true; }, nudge:function(o){ if(o.look) CO.look+=o.look; if(o.walk) CO.walked+=o.walk; if(o.keys) o.keys.forEach(function(k){ CO.keys[k]=true; }); } };
