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
        target:'#eSave', away:true, done:function(){ return !coInEditor(); }}]}};
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
  function coStop(){ CO.on=false; cancelAnimationFrame(CO.raf); var e=$("coCard"), r=$("coRing"); if(e) e.classList.remove("show"); if(r) r.classList.remove("show"); document.body.classList.remove("co-on"); }
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
    var isDone=s.info?CO.s.ok:s.done();
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
    var t=s.target&&!pre?document.querySelector(s.target):null, r=t?t.getBoundingClientRect():null;
    if(r&&r.width>2&&r.bottom>0&&r.top<window.innerHeight){ var p=6; ring.style.left=(r.left-p)+"px"; ring.style.top=(r.top-p)+"px"; ring.style.width=(r.width+2*p)+"px"; ring.style.height=(r.height+2*p)+"px"; ring.classList.add("show");
      var W=window.innerWidth, H=window.innerHeight, cw=e.offsetWidth||440, chh=e.offsetHeight||130, x, y;
      if(r.left>W*0.55&&r.left-p-20-cw>12){ x=r.left-p-20-cw; y=Math.max(12,Math.min(H-chh-12,r.top+r.height/2-chh/2)); }
      else { var below=r.bottom+p+16+chh<H-10; x=Math.max(12,Math.min(W-cw-12,r.left+r.width/2-cw/2)); y=below?r.bottom+p+16:Math.max(12,r.top-p-16-chh); }
      e.style.left=x+"px"; e.style.top=y+"px"; e.style.bottom="auto"; e.style.transform="none"; e.classList.add("pinned"); }
    else { ring.classList.remove("show"); e.style.left=""; e.style.top=""; e.style.bottom=""; e.style.transform=""; e.classList.remove("pinned"); } }
  document.addEventListener("keydown",function(e){ if(!CO.on) return; var m={KeyW:"W",KeyA:"A",KeyS:"S",KeyD:"D",KeyQ:"Q",KeyE:"E",KeyP:"P",KeyB:"B",Space:"SPACE",Digit2:"2",Backslash:"\\"}[e.code]; if(m) CO.keys[m]=true; }, true);
  if(/[?&]dev/.test(location.search)) window.__co={ state:function(){ var s=coSteps()[CO.i]; return {on:CO.on, tour:CO.tour, done:CO.done, i:CO.i, n:coSteps().length, ch:s&&s.ch, shown:!!document.querySelector("#coCard.show"), ed:edState?{i:edState.i, a:edState.aspect, cx:+edState.cx.toFixed(3), cy:+edState.cy.toFixed(3)}:null}; }, skip:function(){ coFinish(true); },
    next:function(){ CO.s.ok=true; }, nudge:function(o){ if(o.look) CO.look+=o.look; if(o.walk) CO.walked+=o.walk; if(o.keys) o.keys.forEach(function(k){ CO.keys[k]=true; }); } };
