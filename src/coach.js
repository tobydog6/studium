  // ================= COACH: the first-time warm-up at a location =================
  // Before the gold frames unlock, one prompt at a time, the way a game teaches its controls: look, walk, crouch,
  // raise the camera, shoot, turn a dial, then the camera bag and the camera back with the thing to click lit up.
  // Each prompt ticks over by itself the moment it's done; nothing to read twice. The guide's "basics" step runs it,
  // and the frames stay hidden until it's finished (or skipped).
  var CO={i:0, on:false, s:{}, keys:{}, look:0, walked:0, lx:null, lz:null, lyaw:null, done:false, raf:0, html:"", tgt:null, okT:0};
  function coK(k){ return '<kbd data-co-k="'+k+'"'+(CO.keys[k]?' class="on"':'')+'>'+k+'</kbd>'; }
  var CO_STEPS=[
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
      done:function(){ return !cbOpen; }}];
  function coActive(){ return CO.on&&!CO.done; }
  // the gold frames wait until the warm-up's done
  function coHidesFrames(){ return typeof gdActive==="function"&&gdActive()&&GD_STEPS[GD.step]&&GD_STEPS[GD.step].id==="basics"; }
  function coEl(){ var e=$("coCard"); if(!e){ e=document.createElement("div"); e.id="coCard"; e.className="co-card"; document.body.appendChild(e);
      var r=document.createElement("div"); r.id="coRing"; r.className="co-ring"; document.body.appendChild(r);
      e.addEventListener("click",function(ev){ if(ev.target.closest("[data-co-skip]")){ ev.stopPropagation(); coFinish(true); } }); } return e; }
  function coStart(){ if(CO.on) return; CO.on=true; CO.done=false; if(GD.flags.co==null) GD.flags.co=0; CO.i=GD.flags.co; CO.look=0; CO.walked=0; CO.lx=null; coEnter(); coLoop(); }
  function coEnter(){ var s=CO_STEPS[CO.i]; CO.s={}; CO.keys={}; CO.t0=performance.now(); if(s&&s.start) s.start(); CO.html=""; }
  function coStop(){ CO.on=false; cancelAnimationFrame(CO.raf); var e=$("coCard"), r=$("coRing"); if(e) e.classList.remove("show"); if(r) r.classList.remove("show"); document.body.classList.remove("co-on"); }
  function coFinish(skipped){ CO.done=true; GD.flags.co=CO_STEPS.length; if(typeof gdSave==="function") gdSave(); coStop();
    if(skipped) toast("Warm-up skipped. The gold frames are out."); }
  function coLoop(){ CO.raf=requestAnimationFrame(coLoop); if(!CO.on) return;
    if(!loaded||App.is("hub")||(typeof st!=="undefined"&&st.open)){ var e0=$("coCard"); if(e0) e0.classList.remove("show"); return; }
    // what the student has done since the last frame
    if(looking&&CO.lyaw!=null){ var dy=Math.abs(yaw-CO.lyaw); if(dy<1) CO.look+=dy; } CO.lyaw=yaw;
    if(CO.lx!=null&&!(CH.pull>=0)){ var d=Math.hypot(camPos.x-CO.lx,camPos.z-CO.lz); if(d<0.5) CO.walked+=d; } CO.lx=camPos.x; CO.lz=camPos.z;
    var s=CO_STEPS[CO.i]; if(!s){ coFinish(false); return; }   // each prompt stays up long enough to read (dwell) before it ticks
    if(performance.now()>CO.okT&&performance.now()-CO.t0>(s.dwell||900)&&s.done()){ CO.okT=performance.now()+650; coTicked(); return; }
    coRender(s); }
  function coTicked(){ var e=coEl(); e.classList.add("ok"); setTimeout(function(){ e.classList.remove("ok"); CO.i++; GD.flags.co=CO.i; if(typeof gdSave==="function") gdSave();
      if(CO.i>=CO_STEPS.length){ coFinish(false); return; } coEnter(); }, 600); }
  function coRender(s){ var e=coEl(), ring=$("coRing");
    var chs=[], prev=null; CO_STEPS.forEach(function(x,i){ if(x.ch!==prev){ chs.push({ch:x.ch, first:i}); prev=x.ch; } });
    var inCh=CO_STEPS.filter(function(x){ return x.ch===s.ch; }), k=inCh.indexOf(s);
    // a nudge when the step needs something open first
    var pre="";
    if(s.need==="vf"&&!viewfinderOn&&!bg.open&&!cbOpen) pre='Raise the camera first: '+coK("P");
    else if((s.need==="bag"||s.need==="lens")&&!bg.open) pre='Open the bag again: '+coK("B");
    else if(s.need==="back"&&!cbOpen) pre='Open the camera back again: '+coK("SPACE");
    var b=s.bar?Math.max(0,Math.min(1,s.bar())):null;
    var html='<div class="co-top">'+chs.map(function(c){ var on=c.ch===s.ch, past=CO.i>c.first&&!on; return '<span class="co-ch'+(on?' on':'')+(past?' past':'')+'">'+c.ch+'</span>'; }).join('<i></i>')
      +'<button class="co-skip" data-co-skip title="Skip the warm-up">SKIP</button></div>'
      +'<div class="co-line">'+(pre||s.line())+'</div>'+((pre?'':s.sub)?'<div class="co-sub">'+s.sub+'</div>':'')
      +'<div class="co-dots">'+inCh.map(function(_,j){ return '<i class="'+(j<k?'d':j===k?'c':'')+'"></i>'; }).join("")+'</div>'
      +(b!=null?'<div class="co-bar"><b style="width:'+(b*100).toFixed(0)+'%"></b></div>':'');
    if(html!==CO.html){ e.innerHTML=html; CO.html=html; }
    e.classList.add("show"); document.body.classList.add("co-on");
    // light up the thing to click (bag and camera back), and sit the card near it
    var t=s.target&&!pre?document.querySelector(s.target):null, r=t?t.getBoundingClientRect():null;
    if(r&&r.width>2){ var p=8; ring.style.left=(r.left-p)+"px"; ring.style.top=(r.top-p)+"px"; ring.style.width=(r.width+2*p)+"px"; ring.style.height=(r.height+2*p)+"px"; ring.classList.add("show");
      var cw=e.offsetWidth||420, ch=e.offsetHeight||120, below=r.bottom+p+16+ch<window.innerHeight-10, x=Math.max(12,Math.min(window.innerWidth-cw-12,r.left+r.width/2-cw/2));
      e.style.left=x+"px"; e.style.top=(below?r.bottom+p+16:Math.max(12,r.top-p-16-ch))+"px"; e.style.bottom="auto"; e.style.transform="none"; e.classList.add("pinned"); }
    else { ring.classList.remove("show"); e.style.left=""; e.style.top=""; e.style.bottom=""; e.style.transform=""; e.classList.remove("pinned"); } }
  document.addEventListener("keydown",function(e){ if(!CO.on) return; var m={KeyW:"W",KeyA:"A",KeyS:"S",KeyD:"D",KeyQ:"Q",KeyE:"E",KeyP:"P",KeyB:"B",Space:"SPACE",Digit2:"2"}[e.code]; if(m) CO.keys[m]=true; }, true);
  if(/[?&]dev/.test(location.search)) window.__co={ state:function(){ return {on:CO.on, done:CO.done, i:CO.i, n:CO_STEPS.length, ch:CO_STEPS[CO.i]&&CO_STEPS[CO.i].ch}; }, skip:function(){ coFinish(true); },
    nudge:function(o){ if(o.look) CO.look+=o.look; if(o.walk) CO.walked+=o.walk; if(o.keys) o.keys.forEach(function(k){ CO.keys[k]=true; }); } };
