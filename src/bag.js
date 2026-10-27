  // ================= CAMERA BAG (B) =================
  // Choose a body, then a lens. Picking a lens zooms in on the camera: the menus drift off fast and sharp, the
  // lens releases, twists out and leaves along its axis, the new one slides in, twists (a sheen sweep) and clicks
  // home with a thunk. Swap as many as you like, then lock one in. Ported from the approved Bag board; the stage
  // is laid out at 1440 x 900 and scaled to fit the window.
  var BAG_A=function(n){ return BAG_ASSETS[n]; };
  var BAG_ASSETS={
    "body-dslr":"asset:assets/bag/body-dslr.webp", "body-ml":"asset:assets/bag/body-ml.webp", "body-67":"asset:assets/bag/body-67.webp",
    "lens-2470":"asset:assets/bag/lens-2470.webp", "thumb-2470":"asset:assets/bag/thumb-2470.webp",
    "lens-50":"asset:assets/bag/lens-50.webp", "thumb-50":"asset:assets/bag/thumb-50.webp",
    "lens-85":"asset:assets/bag/lens-85.webp", "thumb-85":"asset:assets/bag/thumb-85.webp",
    "lens-135":"asset:assets/bag/lens-135.webp", "thumb-135":"asset:assets/bag/thumb-135.webp",
    "lens-105":"asset:assets/bag/lens-105.webp", "thumb-105":"asset:assets/bag/thumb-105.webp",
    "lens-55":"asset:assets/bag/lens-55.webp", "thumb-55":"asset:assets/bag/thumb-55.webp",
    "lens-165":"asset:assets/bag/lens-165.webp", "thumb-165":"asset:assets/bag/thumb-165.webp"
  };
  // lens kits per system; hot = the lens's hit area on the 840 x 560 hero, measured off each render
  /* fmax / fmin: the widest and smallest f-number on the aperture ring; minFocus: closest focus in metres (the real lenses
     these are modelled on: a 24-70 f/2.8 zoom, 50 f/1.8, 85 f/1.4, 135 f/2, and Pentax 67 55 f/4, 105 f/2.4, 165 f/2.8) */
  var LENS_KITS={
    "35":[
      {id:"2470", label:"24–70", long:"24–70 mm f/2.8", kind:"ZOOM", mm:50, fmax:2.8, fmin:22, minFocus:0.38, zoom:[24,28,35,50,70], hot:[336,170,425,349], note:"A zoom for most situations. Go wide for places and longer for people, without changing lens. In the viewfinder, scroll to zoom."},
      {id:"50", label:"50", long:"50 mm f/1.8", kind:"NORMAL", mm:50, fmax:1.8, fmin:22, minFocus:0.45, hot:[335,170,327,297], note:"50 mm sees roughly what your eye does. It's small and light and gives sharp photos."},
      {id:"85", label:"85", long:"85 mm f/1.4", kind:"PORTRAIT", mm:85, fmax:1.4, fmin:22, minFocus:0.85, hot:[336,169,424,350], note:"85 mm pulls backgrounds closer and softer. Good for picking out one thing."},
      {id:"135", label:"135", long:"135 mm f/2", kind:"TELE", mm:135, fmax:2, fmin:22, minFocus:0.9, hot:[335,165,498,388], note:"135 mm isolates details from far away. Hold it steady."}],
    "67":[
      {id:"105", label:"105", long:"105 mm f/2.4", kind:"NORMAL", mm:105, fmax:2.4, fmin:32, minFocus:1.0, hot:[341,202,358,308], note:"The standard medium-format normal lens. On this huge negative it sees about what a 50 mm does on full frame."},
      {id:"55", label:"55", long:"55 mm f/4", kind:"WIDE", mm:55, fmax:4, fmin:32, minFocus:0.375, hot:[342,202,364,318], note:"The 6×7 wide. Frames like a 27 mm on full frame. Good for wide landscapes and big spaces."},
      {id:"165", label:"165", long:"165 mm f/2.8", kind:"PORTRAIT", mm:165, fmax:2.8, fmin:32, minFocus:1.6, hot:[341,201,469,345], note:"Frames like an 80 mm on full frame. A medium-format portrait lens."}]
  };
  var BAG_BODIES=[
    {id:"dslr", card:"Full-frame DSLR", fmt:"36×24 · OPTICAL", spec:"36 × 24 MM SENSOR · OPTICAL VIEWFINDER", note:"The camera in your school kit. You look through a mirror, not a screen, so the viewfinder will not show you the exposure. Read the meter before you shoot."},
    {id:"ml", card:"APS-C mirrorless", fmt:"1.6× CROP · ELECTRONIC", spec:"22.3 × 14.9 MM SENSOR · 1.6× CROP · ELECTRONIC VIEWFINDER", note:"Like your school mirrorless. No mirror, so the viewfinder shows the exposure before you shoot. The smaller sensor crops every lens tighter: a 50 mm frames like an 80 mm."},
    {id:"67", card:"6×7 film SLR", fmt:"0.49× CROP · 120 FILM", spec:"56 × 70 MM NEGATIVE · 0.49× CROP · 10 SHOTS A ROLL", note:"Medium-format film. The huge negative frames every lens wider: the 105 mm here sees about what a 50 mm does on full frame. You only get ten shots a roll, so think before each one."},
    {id:"", card:"35 mm SLR", fmt:"135 FILM · 36 EXP"},
    {id:"", card:"Waist-level 6×7", fmt:"120 FILM · MIRRORED"},
    {id:"", card:"4×5 view camera", fmt:"SHEET FILM · 1 EXP"}];
  var lensId="2470", zoomMM=50;
  function curLens(){ var k=LENS_KITS[curBody().sys||"35"]; for(var i=0;i<k.length;i++) if(k[i].id===lensId) return k[i]; return k[0]; }
  function lensFocal(l){ return l.zoom?zoomMM:l.mm; }
  // put a body and lens on the simulated camera
  function bagApply(bodyId, lid){ for(var i=0;i<BODIES.length;i++) if(BODIES[i].id===bodyId){ bodyIdx=i; break; }
    lensId=lid; var l=curLens(); lensId=l.id; focalMM=lensFocal(l); computeCam();   /* a new lens re-clamps the aperture and focus to what it can do (computeCam) */ applyFinder(); if(typeof vfRefresh==="function") vfRefresh(); }

  // ---- bag state (mirrors the mockup's component state) ----
  var bg={open:false, stage:"choose", body:"dslr", lens:"2470", orig:"2470", prev:null, outPhase:null, inPhase:null, instant:false, glint:false, hover:false, busy:false, thunk:false, cursor:0, ret:"scene", timers:[]};
  function bgLater(fn,ms){ bg.timers.push(setTimeout(fn,ms)); }
  function bgSys(){ return bg.body==="67"?"67":"35"; }
  function bgKit(){ return LENS_KITS[bgSys()]; }
  function bgCur(){ var k=bgKit(); for(var i=0;i<k.length;i++) if(k[i].id===bg.lens) return k[i]; return k[0]; }
  function bgSet(o){ for(var k in o) bg[k]=o[k]; bagRender(); }

  // ---- DOM: built once, then styles update so transitions run ----
  var bagEls=null;
  function bagBuild(){ if(bagEls) return; var root=$("bag"), st=$("bagStage"); var E={};
    function el(tag,cls,parent,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; (parent||st).appendChild(e); return e; }
    E.spot=el("div","bg-spot");
    E.head=el("div","bg-head",null,'<div><span class="eb"></span><span class="sub"></span></div><span class="close"></span>');
    E.hero=el("div","bg-hero"); E.thunk=el("div","bg-thunk",E.hero);
    el("div","bg-shadow",E.thunk);
    E.bodies={}; ["dslr","ml","67"].forEach(function(id){ var im=el("img","bg-body",E.thunk); im.src=BAG_A("body-"+id); im.alt=""; im.draggable=false; E.bodies[id]=im; });
    E.glint=el("div","bg-glint",E.thunk);
    E.layers={}; ["35","67"].forEach(function(s){ LENS_KITS[s].forEach(function(l){ var w=el("div","bg-layer",E.thunk), im=el("img","",w); im.src=BAG_A("lens-"+l.id); im.alt=""; im.draggable=false;
      var sh=el("div","sheen",w); sh.style.webkitMaskImage=sh.style.maskImage='url("'+BAG_A("lens-"+l.id)+'")'; E.layers[l.id]={w:w,sheen:sh,img:im}; }); });
    E.hot=el("button","bg-hot",E.hero,'<span class="tip">CHANGE LENS</span>'); E.hot.setAttribute("aria-label","Change lens");
    E.info=el("div","bg-info",null,'<h1></h1><span class="spec"></span><p></p>');
    E.right=el("div","bg-right",null,'<span class="lbl">BODIES</span><div class="grid"></div><span class="lbl" style="margin-top:14px">LENS</span>'
      +'<button class="lensbtn" data-bg="lens"><span class="th"><img alt=""></span><span class="tx"><span class="nm"></span><span class="kd"></span></span><span class="ch">CHANGE <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1.5 1l5 5-5 5"/></svg></span></button><p class="lnote"></p>');
    var grid=E.right.querySelector(".grid"); E.cards=[];
    BAG_BODIES.forEach(function(b){ var c=el("button","bg-card"+(b.id?"":" off"),grid,'<span class="im">'+(b.id?'<img alt="" src="'+BAG_A("body-"+b.id)+'">':'<span class="tc">Coming soon</span>')+'</span><span class="nm">'+b.card+'</span><span class="fm">'+b.fmt+'</span>');
      c.setAttribute("data-bg-body",b.id); c.setAttribute("aria-label","Choose "+b.card); if(!b.id) c.disabled=true; E.cards.push(c); });
    E.tag=el("div","bg-tag",null,'<span class="t"></span><span class="nm"></span><span class="nt"></span>');
    E.tray=el("div","bg-tray");
    E.actions=el("div","bg-actions",null,'<button class="ghost" data-bg="cancel">CANCEL</button><button class="gold" data-bg="done"></button>');
    E.hints=el("div","bg-hints");
    bagEls=E;
    root.addEventListener("click",bagClick);
    E.hot.addEventListener("mouseenter",function(){ if(bg.stage==="choose") bgSet({hover:true}); });
    E.hot.addEventListener("mouseleave",function(){ bgSet({hover:false}); });
    window.addEventListener("resize",function(){ if(bg.open) bagLayout(); }); }
  function bagLayout(){ var st=$("bagStage"); if(!st) return; var k=Math.min(window.innerWidth/1440, window.innerHeight/900);
    st.style.transform="translate("+((window.innerWidth-1440*k)/2).toFixed(1)+"px,"+((window.innerHeight-900*k)/2).toFixed(1)+"px) scale("+k.toFixed(4)+")"; }

  // ---- the lens swap timeline (release, twist out, leave, start, near, twist in, seat with a thunk) ----
  function bagSwap(id, then){ if(bg.busy||id===bg.lens){ if(then) then(); return; }
    bgSet({busy:true, prev:bg.lens, outPhase:"release", thunk:true});
    bgLater(function(){ bgSet({thunk:false, outPhase:"twist"}); },90);
    bgLater(function(){ bgSet({outPhase:"leave"}); },330);
    bgLater(function(){ bgSet({instant:true, lens:id, inPhase:"start"}); },520);
    bgLater(function(){ bgSet({instant:false, inPhase:"near"}); },550);
    bgLater(function(){ bgSet({inPhase:"twist"}); },830);
    bgLater(function(){ bgSet({inPhase:"seat", glint:true, thunk:true}); },1130);
    bgLater(function(){ bagClick.sound&&bagClick.sound(); },650);   /* the cue leads in, so its seat click lands at 1130 */
    bgLater(function(){ bgSet({thunk:false}); },1200);
    bgLater(function(){ bgSet({inPhase:null, prev:null, outPhase:null}); },1260);
    bgLater(function(){ bgSet({glint:false, busy:false}); if(then) then(); },1460); }
  function bagOpenLens(){ if(bg.stage!=="choose") return; var k=bgKit(), i=0; k.forEach(function(l,j){ if(l.id===bg.lens) i=j; }); bgSet({stage:"lens", orig:bg.lens, hover:false, cursor:i}); }
  function bagDone(){ if(bg.busy) return; bagApply(bg.body, bg.lens); bgSet({stage:"choose", orig:bg.lens}); }
  function bagCancel(){ if(bg.busy) return; bagSwap(bg.orig, function(){ bgSet({stage:"choose"}); }); }
  function bagPickBody(id){ if(!id||bg.stage!=="choose") return; var sysOf=function(b){ return b==="67"?"67":"35"; };
    if(sysOf(id)===sysOf(bg.body)) bgSet({body:id}); else { var d=id==="67"?"105":"2470"; bgSet({body:id, lens:d, orig:d}); }
    bagApply(bg.body, bg.lens); }

  // ---- open / close ----
  function openBag(from){ var root=$("bag"); if(!root||!loaded) return; bagBuild();
    bg.ret=from||(viewfinderOn?"viewfinder":"scene"); if(looking){ try{ document.exitPointerLock(); }catch(e){} } lowerCamera();
    var b=curBody(); bg.body=b.id; bg.lens=lensId; bg.orig=lensId; bg.stage="choose"; bg.open=true; bg.prev=null; bg.outPhase=bg.inPhase=null; bg.busy=false;
    bagLayout(); root.classList.remove("hidden","bg-out"); void root.offsetWidth; root.classList.add("bg-in"); App.go("bag"); bagRender(); updatePrompt(); }
  function closeBag(){ if(!bg.open) return; if(bg.stage==="lens"){ bagCancel(); return; }
    bg.timers.forEach(clearTimeout); bg.timers=[]; bg.open=false; bagApply(bg.body, bg.lens);
    var root=$("bag"); root.classList.remove("bg-in"); root.classList.add("bg-out"); setTimeout(function(){ if(!bg.open){ root.classList.add("hidden"); root.classList.remove("bg-out"); } },200);
    App.go("scene");
    if(bg.ret==="back"){ openBack(); }
    else { try{ renderer.domElement.requestPointerLock(); }catch(e){} if(bg.ret==="viewfinder") raiseCamera(); }
    updatePrompt(); }

  // ---- render: compute every style from state (same maths as the mockup) ----
  // what the gold frame you're standing in wants from the bag: a body, and a lens (a focal length, or the zoom)
  function bagWants(){ var P=typeof chActivePad==="function"?chActivePad():null; if(!P) return null; var W=chWants(P), out={body:W.body||null, lens:null, zoomTo:null, title:P.c.title||""};
    var sys=(out.body||bg.body)==="67"?"67":"35", kit=LENS_KITS[sys];
    if(W.lensMM){ kit.forEach(function(l){ if(!l.zoom&&l.mm===W.lensMM) out.lens=l.id; }); }
    else if(W.mm){ kit.forEach(function(l){ if(l.zoom){ var ok=l.zoom.some(function(z){ return (W.mm.max==null||z<=W.mm.max)&&(W.mm.min==null||z>=W.mm.min); }); if(ok&&!out.lens){ out.lens=l.id; out.zoomTo=W.mm.max!=null?Math.min.apply(null,l.zoom.filter(function(z){ return (W.mm.max==null||z<=W.mm.max)&&(W.mm.min==null||z>=W.mm.min); })):null; } } }); }
    if(!out.body&&!out.lens) return null; return out; }
  function bagRender(){ if(!bagEls||!bg.open) return; var E=bagEls, s=bg, inLens=s.stage==="lens", kit=bgKit(), cur=bgCur(), want=bagWants();
    var wantBodyOk=!want||!want.body||want.body===s.body, wantLensOk=!want||!want.lens||want.lens===s.lens;
    var OFF="translate(210px, 136px) scale(1.16)", NEAR="translate(24px, 15px) scale(1.012)";
    var glow="drop-shadow(0 0 1.5px rgba(246,206,140,0.95)) drop-shadow(0 0 12px rgba(227,173,87,0.5))";
    var outEase="cubic-bezier(.5,0,1,.5)", inEase="cubic-bezier(.16,1,.3,1)";
    Object.keys(E.layers).forEach(function(id){ var L=E.layers[id], t="none", op=0, tr="none", flt="none", sheen="sheen";
      var inKit=kit.some(function(l){ return l.id===id; });
      if(inKit && id===s.prev && s.outPhase){ var ph=s.outPhase; t=ph==="leave"?OFF:NEAR; op=ph==="leave"?0:1;
        tr=ph==="release"?"transform 80ms cubic-bezier(.2,.8,.3,1)":ph==="leave"?"transform 220ms cubic-bezier(.5,0,.9,.4), opacity 180ms ease-in":"none"; if(ph==="twist") sheen+=" twistOut"; }
      else if(inKit && id===s.lens){ var ph2=s.inPhase; op=ph2==="start"?0:1; t=ph2==="start"?OFF:(ph2==="near"||ph2==="twist")?NEAR:"none";
        tr=s.instant?"none":ph2==="near"?"transform 280ms cubic-bezier(.16,1,.3,1), opacity 160ms ease-out":ph2==="seat"?"transform 70ms cubic-bezier(.7,0,1,.6)":"transform 200ms ease";
        if(ph2==="twist") sheen+=" twistIn"; if(s.hover&&!inLens) flt=glow; }
      L.w.classList.toggle("cur", inKit&&id===s.lens); L.w.style.transition=(tr==="none"?"":tr+", ")+"filter 160ms ease"; L.w.style.transform=t; L.w.style.opacity=op; L.w.style.filter=flt;
      if(L.sheen.className!==sheen) L.sheen.className=sheen; L.img.alt=(inKit&&id===s.lens)?cur.long+" lens on the camera":""; });
    ["dslr","ml","67"].forEach(function(id){ var on=s.body===id, im=E.bodies[id]; im.style.opacity=on?1:0; im.style.transform=on?"none":(id==="dslr"?"translateX(-14px)":"translateX(14px)"); im.alt=on?(id==="dslr"?"Full-frame DSLR body":id==="ml"?"APS-C mirrorless body":"6×7 film SLR body")+", three-quarter view":""; });
    E.thunk.style.transform="translate("+(s.thunk?"-2px, 1.5px":"0, 0")+")"; E.thunk.style.transition="transform "+(s.thunk?"50ms":"160ms")+" cubic-bezier(.3,1.6,.5,1)";
    E.glint.style.opacity=s.glint?1:0; E.glint.style.transition="opacity "+(s.glint?"90ms":"380ms")+" ease";
    E.hero.style.transform=inLens?"translate(176px, -6px) scale(1.12)":"none"; E.hero.style.transition="transform "+(inLens?"240ms ":"320ms ")+inEase;
    E.spot.style.opacity=inLens?1:0;
    var hot=cur.hot||[336,170,400,330]; E.hot.style.left=hot[0]+"px"; E.hot.style.top=hot[1]+"px"; E.hot.style.width=hot[2]+"px"; E.hot.style.height=hot[3]+"px";
    E.hot.style.pointerEvents=inLens?"none":"auto"; E.hot.classList.toggle("on", s.hover&&!inLens);
    var slide=function(e,x){ e.style.transform="translateX("+(inLens?x:0)+"px)"; e.style.opacity=inLens?0:1; e.style.pointerEvents=inLens?"none":"auto";
      e.style.transition=inLens?"transform 170ms "+outEase+", opacity 110ms linear":"transform 340ms "+inEase+" 60ms, opacity 240ms ease 60ms"; };
    slide(E.info,-700); slide(E.right,560);
    var B=BAG_BODIES.filter(function(b){ return b.id===s.body; })[0]||BAG_BODIES[0], crop=s.body==="ml"?1.6:s.body==="67"?0.49:1;
    var equiv=function(l){ if(crop===1) return ""; return "FRAMES LIKE "+l.label.split("–").map(function(n){ return Math.round(parseInt(n,10)*crop); }).join("–")+" MM"; };
    E.head.querySelector(".eb").textContent=inLens?"CHANGE LENS":(want?"BAG · GOLD FRAME":"BAG");
    var wantWords=""; if(want){ var wb=want.body?BAG_BODIES.filter(function(b){ return b.id===want.body; })[0]:null, wl=want.lens?LENS_KITS[(want.body||s.body)==="67"?"67":"35"].filter(function(l){ return l.id===want.lens; })[0]:null;
      wantWords=(wantBodyOk&&wantLensOk)?"That's the kit the frame wants. Done takes you back to it.":"The frame wants "+(wb?"the "+wb.card:"this body")+(wl?" with the "+wl.long.replace(/ f\/.*$/,"")+(want.zoomTo?" at "+want.zoomTo+" mm":""):"")+"."; }
    var wantSys=(want&&want.body?want.body:s.body)==="67"?"67":"35", wantLbl=want&&want.lens?(LENS_KITS[wantSys].filter(function(l){ return l.id===want.lens; }).map(function(l){ return l.label; })[0]||""):"", sysOff=!!(want&&want.lens&&wantSys!==bgSys());
    E.head.querySelector(".sub").textContent=inLens?(want&&!wantLensOk&&want.lens?(sysOff?"Pick the frame's body first, then its lens.":"The frame wants the "+wantLbl+" mm. Click it, then lock it in."):"Swap as many as you like, then lock one in."):(wantWords||"Choose a body, then a lens.");
    E.head.classList.toggle("want", !!want);
    E.head.querySelector(".close").textContent=inLens?"ESC · CANCEL":"B · CLOSE";
    E.info.querySelector("h1").textContent=B.card; E.info.querySelector(".spec").textContent=B.spec+" · "+cur.long.toUpperCase(); E.info.querySelector("p").textContent=B.note;
    E.cards.forEach(function(c){ var id=c.getAttribute("data-bg-body"), w=!!(want&&want.body&&want.body===id); c.classList.toggle("on", id===s.body); c.classList.toggle("want", w&&id!==s.body); c.classList.toggle("want-ok", w&&id===s.body); c.classList.toggle("dim", !!(want&&want.body&&!w&&id!==s.body)); });
    var lb=E.right.querySelector(".lensbtn"); lb.querySelector("img").src=BAG_A("thumb-"+cur.id); lb.querySelector(".nm").textContent=cur.long;
    lb.querySelector(".kd").textContent=cur.kind+" · ON THE CAMERA"+(equiv(cur)?" · "+equiv(cur):""); E.right.querySelector(".lnote").textContent=cur.note;
    var lockedNew=s.lens!==s.orig;
    E.tag.querySelector(".t").textContent=s.busy?"SWAPPING":lockedNew?"NEW LENS":"ON THE CAMERA"; E.tag.querySelector(".nm").textContent=cur.long;
    E.tag.querySelector(".nt").textContent=cur.note+(equiv(cur)?" "+equiv(cur).charAt(0)+equiv(cur).slice(1).toLowerCase()+".":"");
    E.tag.classList.toggle("on",inLens);
    // tray: rebuilt only when the kit changes, then classes update
    if(E.tray.getAttribute("data-sys")!==bgSys()){ E.tray.setAttribute("data-sys",bgSys()); E.tray.innerHTML=kit.map(function(l){
      return '<button class="bg-cell" data-bg-lens="'+l.id+'" aria-label="Put on the '+l.long+' lens"><span class="im"><img alt="" src="'+BAG_A("thumb-"+l.id)+'"></span><span class="num">'+l.label+'<span class="u"> mm</span></span><span class="tg"></span></button>'; }).join(""); }
    Array.prototype.forEach.call(E.tray.querySelectorAll(".bg-cell"),function(c,i){ var id=c.getAttribute("data-bg-lens"), on=id===s.lens, l=kit[i], w=!!(want&&want.lens===id);
      c.classList.toggle("on",on); c.classList.toggle("cursor", inLens&&i===s.cursor&&!on); c.classList.toggle("want", w&&!on); c.querySelector(".tg").textContent=on?(w?"ON CAMERA ✓":"ON CAMERA"):(w?"THE FRAME WANTS THIS":l.kind); });
    lb.classList.toggle("want", !!(want&&want.lens&&!wantLensOk&&!sysOff)); lb.querySelector(".ch").firstChild.textContent=(want&&want.lens&&!wantLensOk&&!sysOff&&wantLbl)?"CHANGE TO "+wantLbl+" ":"CHANGE ";
    E.tray.classList.toggle("on",inLens); E.actions.classList.toggle("on",inLens);
    E.actions.querySelector(".gold").textContent=lockedNew?"LOCK IN "+cur.label+(cur.label.length>3?"":" MM")+(want&&want.lens===s.lens?" · BACK TO THE FRAME":""):"DONE";
    var hints=inLens?[["← →","Choose lens"],["Space","Put it on"],["Enter","Lock in"],["Esc","Cancel"]]:[["← →","Body"],["L","Change lens"],["B","Close the bag"]];
    E.hints.innerHTML=hints.map(function(h){ return '<span><kbd>'+h[0]+'</kbd>'+h[1]+'</span>'; }).join(""); }

  // ---- input ----
  function bagClick(e){ var t=e.target.closest("[data-bg],[data-bg-body],[data-bg-lens],.bg-hot"); if(!t) return;
    if(t.classList.contains("bg-hot")) return bagOpenLens();
    if(t.hasAttribute("data-bg-body")) return bagPickBody(t.getAttribute("data-bg-body"));
    if(t.hasAttribute("data-bg-lens")){ if(bg.stage!=="lens") return; var id=t.getAttribute("data-bg-lens"); bgKit().forEach(function(l,i){ if(l.id===id) bg.cursor=i; }); return bagSwap(id); }
    var a=t.getAttribute("data-bg"); if(a==="lens") bagOpenLens(); else if(a==="done") bagDone(); else if(a==="cancel") bagCancel(); }
  bagClick.sound=function(){ sfx("bagSeat"); };
  function bagKey(e){ var c=e.code; e.preventDefault();
    if(bg.stage==="choose"){ var ids=BAG_BODIES.filter(function(b){ return b.id; }).map(function(b){ return b.id; }), i=ids.indexOf(bg.body);
      if(c==="ArrowRight"||c==="ArrowDown") bagPickBody(ids[(i+1)%ids.length]); else if(c==="ArrowLeft"||c==="ArrowUp") bagPickBody(ids[(i+ids.length-1)%ids.length]);
      else if(c==="KeyL"||c==="Enter") bagOpenLens(); else if(c==="KeyB"||c==="Escape"||c==="Space") closeBag(); return true; }
    var kit=bgKit();
    if(c==="ArrowRight"){ bgSet({cursor:(bg.cursor+1)%kit.length}); } else if(c==="ArrowLeft"){ bgSet({cursor:(bg.cursor+kit.length-1)%kit.length}); }
    else if(c==="Space") bagSwap(kit[bg.cursor].id); else if(c==="Enter") bagDone(); else if(c==="Escape"||c==="KeyB") bagCancel();
    return true; }
