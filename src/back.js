  // ================= CAMERA BACK (Space) =================
  // The full-screen rear render IS the menu: the UI lives inside the camera's own screen and the
  // physical buttons work. Direction C "Analogue": lens-barrel tape scales with a safelight index,
  // a needle meter, a frame counter, mono caps and dashed gold rules. Tabs: Shoot, Review, Brief, Setup.
  //
  // Geometry is in the render's own pixels (assets/camera/dslr-back.webp is 1760 x 1328).
  // The rear screen's active area is 684 x 472 at (378, 598). The UI is drawn on a 780 x 538
  // design canvas and scaled into it, so type sizes match the approved mockup.
  var CB_RENDER="asset:assets/camera/dslr-back.webp";
  var CB_IMG={w:1760,h:1328}, CB_SCREEN={x:378,y:598,w:684,h:472}, CB_DESIGN={w:780,h:538};
  var CB_TABS=[["shoot","Shoot"]];   /* the back is the settings, nothing else: review lives in the Studio (ux-scene) */
  var CB_TABS_ALL=[["shoot","Shoot"],["review","Review"],["brief","Brief"],["setup","Setup"]];
  // physical controls on the body: [id, centre x, centre y, radius, printed label, label side]
  var CB_BUTTONS=[   // centres and radii measured off the render (Hough circles), so the hit areas sit exactly on the buttons
    ["bag",    385, 461, 37, "BAG",     "top"],
    ["photos", 499, 461, 40, "STUDIO",  "top"],
    ["shoot", 1272, 876, 48, "SET · SHOOT", "dial"],
    ["back",  1317,1061, 40, "BACK",    "bottom"]
  ];

  var cbOpen=false, cbTab="shoot", cbRow=0, cbReview=-1, cbBriefSel=0, cbSetupRow=0, cbWasVF=false, cbHideT=null;
  var cbHist={}, cbPlace="The Stump";

  function cbEsc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
  function cbPad(n){ return (n<10?"0":"")+n; }

  // ---- layout: scale the render so the screen dominates and the right-hand buttons stay in view ----
  function cbLayout(){ var st=$("cbStage"); if(!st) return;
    var vw=window.innerWidth, vh=window.innerHeight-44;
    var k=Math.min(vw*0.60/CB_SCREEN.w, vh*0.58/CB_SCREEN.h);   /* settings only now: the screen is most of the view, with the eyepiece showing above it */
    var cx=CB_SCREEN.x+CB_SCREEN.w/2, cy=CB_SCREEN.y+CB_SCREEN.h/2;
    var tx=vw*0.5-cx*k, ty=vh*0.555-cy*k;
    st.style.transform="translate("+tx.toFixed(1)+"px,"+ty.toFixed(1)+"px) scale("+k.toFixed(4)+")"; }
  function cbBuildBody(){ var st=$("cbStage"); if(!st||st.getAttribute("data-built")) return; st.setAttribute("data-built","1");
    var rd=$("cbRender"); if(rd&&!rd.getAttribute("src")) rd.src=CB_RENDER;
    var scr=$("cbScreen"); scr.style.left=CB_SCREEN.x+"px"; scr.style.top=CB_SCREEN.y+"px"; scr.style.width=CB_SCREEN.w+"px"; scr.style.height=CB_SCREEN.h+"px";
    var ui=$("cbUi"); ui.style.width=CB_DESIGN.w+"px"; ui.style.height=CB_DESIGN.h+"px"; ui.style.transform="scale("+(CB_SCREEN.w/CB_DESIGN.w).toFixed(5)+")";
    CB_BUTTONS.forEach(function(b){ var id=b[0], x=b[1], y=b[2], r=b[3], label=b[4], side=b[5];
      var h=document.createElement("button"); h.className="cb-hot"+(id==="shoot"?" dial":""); h.setAttribute("data-cb-btn",id); h.setAttribute("aria-label",label);
      h.style.animationDelay=(-(CB_BUTTONS.indexOf(b)*0.37)).toFixed(2)+"s";   // the pulse ripples across the body instead of blinking in unison
      h.style.left=(x-r)+"px"; h.style.top=(y-r)+"px"; h.style.width=(2*r)+"px"; h.style.height=(2*r)+"px"; st.appendChild(h);
      var p=document.createElement("span"); p.className="cb-print"; p.textContent=label;
      if(side==="top"){ p.style.left=x+"px"; p.style.top=(y+r+8)+"px"; p.style.transform="translateX(-50%)"; }
      else if(side==="right"){ p.style.left=(x+r+16)+"px"; p.style.top=(y-9)+"px"; }
      else if(side==="dial"){ p.style.left=x+"px"; p.style.top=(y+134)+"px"; p.style.transform="translateX(-50%)"; }
      else { p.style.left=x+"px"; p.style.top=(y+r+12)+"px"; p.style.transform="translateX(-50%)"; }
      p.setAttribute("data-cb-print",id); st.appendChild(p); });
  }
  function cbPress(id){ var h=document.querySelector('[data-cb-btn="'+id+'"]'); if(!h) return; h.classList.remove("press"); void h.offsetWidth; h.classList.add("press"); }

  // ---- open / close: the camera flips (a physical move, ~300 ms) ----
  function openBack(){ if(!loaded||cbOpen) return; var el=$("camback"); if(!el) return;
    cbWasVF=viewfinderOn; if(looking){ try{ document.exitPointerLock(); }catch(e){} } lowerCamera();
    cbBuildBody(); cbLayout(); cbOpen=true; cbReview=photos.length-1; if(activeBrief>=0) cbBriefSel=activeBrief+1;
    clearTimeout(cbHideT); el.classList.remove("hidden","cb-out"); void el.offsetWidth; el.classList.add("cb-in");
    App.go("back"); computeCam(); cbRender(); updatePrompt(); }
  function closeBack(toViewfinder){ if(!cbOpen) return; var el=$("camback"); cbOpen=false; sfx("kitClose");
    var nm=document.getElementById("cbName"); if(nm && document.activeElement===nm) nm.blur();
    el.classList.remove("cb-in"); el.classList.add("cb-out"); clearTimeout(cbHideT); cbHideT=setTimeout(function(){ el.classList.add("hidden"); el.classList.remove("cb-out"); },220);
    App.go("scene");
    if(toViewfinder!==false){ try{ renderer.domElement.requestPointerLock(); }catch(e){} if(cbWasVF) raiseCamera(); }
    updatePrompt(); }
  function toggleBack(){ if(cbOpen) closeBack(); else openBack(); }
  function cbSetTab(t){ if(CB_TABS.some(function(x){ return x[0]===t; })){ if(cbTab!==t) sfx("tab"); cbTab=t; cbPress(t); cbRender(); } }
  function cbCycleTab(d){ var i=0; CB_TABS.forEach(function(x,j){ if(x[0]===cbTab) i=j; }); cbSetTab(CB_TABS[(i+d+CB_TABS.length)%CB_TABS.length][0]); }

  // ---- the exposure the meter reads, in plain words ----
  function cbThirds(ev){ return evText(ev); }   /* 0, +⅓, −1, +1⅔: one formatter (app.js) for every readout */
  function cbMeterWords(){ var ev=evStops, n=Math.round(Math.abs(ev)*3), t=SHUTTERS[shIdx], head, body, F=cbFrameHold();
    if(n===0){ head="Spot on"; body=F?"The exposure's right and the frame's settings hold. Go back and take the photo.":"The exposure's right. Frame it and take the photo."; }
    else if(F&&F.free.length){   // a gold frame pins some settings: set those first, then trade with the ones it leaves free
      var dark=ev<0, names={sh:"the shutter", ap:"the aperture", iso:"the ISO"}, moves={sh:dark?"a slower shutter":"a faster shutter", ap:dark?"a wider aperture (smaller f-number)":"a smaller aperture (bigger f-number)", iso:dark?"a higher ISO":"a lower ISO"};
      head=(dark?"Too dark, ":"Too bright, ")+cbThirds(ev);
      var trade=(dark?"let more light in with ":"cut the light with ")+F.free.map(function(k){ return moves[k]; }).join(F.free.length>2?", ":" or ")+".";
      if(F.toSet.length) body="Set "+F.toSet.map(function(k){ return names[k]; }).join(" and ")+" to the gold band first, then "+trade;
      else body="Keep "+F.held.map(function(k){ return cbFmtKey(k); }).join(" and ")+" for the frame, and "+trade; }
    else if(filmIsoLocked()){ var lk=" The ISO is fixed for this roll.";   /* film: only the shutter and the aperture can move */
      if(ev>0){ head=(n<=2?"A touch bright, ":"Too bright, ")+cbThirds(ev); body=(n<=2?"Close down a little: a faster shutter or a smaller aperture.":"Highlights will blow out. Try a faster shutter or a smaller aperture.")+lk; }
      else { head=(n<=2?"A touch dark, ":"Too dark, ")+cbThirds(ev); body=(n<=2?"Open up a little: a slower shutter or a wider aperture.":"Shadows will turn to mud. Open the aperture or slow the shutter.")+lk; } }
    else if(ev>0 && n<=2){ head="A touch bright, "+cbThirds(ev); body="Close down a little: a faster shutter, a smaller aperture or a lower ISO."; }
    else if(ev>0){ head="Too bright, "+cbThirds(ev); body="Highlights will blow out. Try a faster shutter or a lower ISO first."; }
    else if(n<=2){ head="A touch dark, "+cbThirds(ev); body="Open up a little: a slower shutter, a wider aperture or a higher ISO."; }
    else { head="Too dark, "+cbThirds(ev); body="Shadows will turn to mud. Raise the ISO or open the aperture."; }
    var shake = t>1/Math.max(focalMM,1)+1e-9 ? "Slower than 1/"+focalMM+" at "+focalMM+" mm, so hold still or it will blur." : "";
    return {head:head, body:body, shake:shake}; }
  function cbFmtKey(k){ return k==="sh"?SHUTTER_LABELS[shIdx]:k==="ap"?"f/"+APERTURES[apIdx]:"ISO "+ISOS[isoIdx]; }
  // the gold frame you're standing in, and which of shutter / aperture / ISO it pins (held) and leaves to you (free)
  function cbFrameHold(){ var P=typeof chActivePad==="function"?chActivePad():null; if(!P) return null; var W=chWants(P), held=[], toSet=[], free=[], idx={sh:shIdx, ap:apIdx, iso:isoIdx};
    [["sh",W.sh],["ap",W.f],["iso",W.iso]].forEach(function(r){ if(!r[1]){ free.push(r[0]); return; } var b=cbBand(r[0],W); (b&&idx[r[0]]>=b[0]&&idx[r[0]]<=b[1]?held:toSet).push(r[0]); });
    return {P:P, W:W, held:held, toSet:toSet, free:free}; }
  // the stops a need allows on a row, as an index range [lo,hi] (or null when the row is free)
  function cbBand(key, W){ var n=key==="sh"?W.sh:key==="ap"?W.f:W.iso; if(!n) return null; var vals=key==="sh"?SHUTTERS:key==="ap"?APERTURES:ISOS, lo=-1, hi=-1;
    vals.forEach(function(v,i){ var ok=key==="sh"?((n.max==null||v<=n.max*1.001)&&(n.min==null||v>=n.min*0.999)):((n.max==null||v<=n.max)&&(n.min==null||v>=n.min)); if(ok){ if(lo<0) lo=i; hi=i; } });
    return lo<0?null:[lo,hi]; }

  // ---- tab bar + footer, shared by every tab ----
  function cbChrome(right, footL, footR, body){
    var tabs=CB_TABS.length>1?CB_TABS.map(function(t,i){ var on=t[0]===cbTab;
      return '<button class="cb-tab'+(on?' on':'')+'" data-cb-tab="'+t[0]+'"><span class="n">0'+(i+1)+'</span>'+t[1]+'</button>'; }).join(""):'<span class="cb-tab on cb-title"><span class="n">M</span>Settings</span>';
    return '<div class="cb-top"><div class="cb-tabs">'+tabs+'</div><div class="cb-right">'+right+'</div></div>'
      +'<div class="cb-body cb-'+cbTab+'">'+body+'</div>'
      +'<div class="cb-foot"><span>'+footL+'</span><span>'+footR+'</span></div><div class="cb-glass"></div>'; }
  function cbCounter(label,num,of){ return '<span class="cb-rec"></span><span>'+label+'</span><span class="cb-count">'+num+'</span>'+(of?'<span class="cb-of">of '+of+'</span>':''); }

  // ---- 01 SHOOT: three sliders and the meter ----
  // Every stop is printed along its track, so you can see the whole range and where you are in it. Click a stop, or
  // grab the knob (or anywhere on the track) and drag. Arrow keys still step.
  /* o: where the row starts in the full table. The aperture row shows only the stops the lens on the camera has; on film
     the ISO row is the roll's speed, set when a fresh roll goes in and locked after the first frame */
  function cbShootRows(){ var b=curBody(), film=!!b.film, iHi=film?FILM_ISO_MAX:ISOS.length-1;
    return [
    {key:"sh", cap:"Shutter", unit:"seconds", vals:SHUTTER_LABELS, o:0, idx:shIdx, lo:"Freezes motion · darker", hi:"Brighter · hands shake", dir:1},
    {key:"ap", cap:"Aperture", unit:"f-stop", vals:APERTURES.slice(apLo,apHi+1).map(function(a){ return String(a); }), o:apLo, idx:apIdx-apLo, lo:"Brighter · soft background", hi:"Darker · sharp all through", dir:-1},
    {key:"iso",cap:film?"Film ISO":"ISO", unit:film?"roll":"sensor", vals:ISOS.slice(0,iHi+1).map(String), o:0, idx:Math.min(isoIdx,iHi), lo:film?"Fine grain · needs light":"Clean · needs light", hi:film?"Faster film · grainier":"Brighter · grainy", dir:1,
      lock:film&&filmIsoLocked(), note:""}]; }
  var CB_ICON={sh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="13" r="8"/><path d="M12 13V8.5M12 13l3 2M9.5 2.5h5"/></svg>',
    ap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 3l3.6 7.2M21 12l-7.8 1.2M16.5 19.8L11 14.3M6 18.6l2.7-7.4M3.3 9.3l7.9 1.1M9 3.5l1.5 7.9"/></svg>',
    iso:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" stroke-width="2.4" stroke-linecap="round"/></svg>'};
  function cbFmt(r,v){ return r.key==="ap"?"f/"+v:v; }
  function cbShoot(){ var rows=cbShootRows(), html="", F=cbFrameHold(), offEv=Math.round(Math.abs(evStops)*3)>0;
    rows.forEach(function(r,ri){ var n=r.vals.length, stops="", pc=function(i){ return (n>1?i/(n-1)*100:50).toFixed(3)+"%"; };
      var band=F?cbBand(r.key,F.W):null; if(band){ band=[Math.max(0,band[0]-r.o),Math.min(n-1,band[1]-r.o)]; if(band[1]<band[0]) band=null; } var hit=band&&r.idx>=band[0]&&r.idx<=band[1], free=F&&!band&&offEv;
      r.vals.forEach(function(v,i){ stops+='<button class="cb-stop'+(i===r.idx?' cur':'')+(band&&i>=band[0]&&i<=band[1]?' want':'')+'" style="left:'+pc(i)+(r.lock&&i!==r.idx?';opacity:.3':'')+'"'+(r.lock?' disabled':' data-cb-set="'+r.key+':'+(i+r.o)+'"')+'><i></i><span>'+cbEsc(v)+'</span></button>'; });
      var bandHtml=band?'<span class="cb-band'+(hit?' hit':'')+'" style="left:'+pc(band[0])+';width:calc('+pc(band[1])+' - '+pc(band[0])+')"><em>'+(hit?'✓ FRAME':'THE FRAME WANTS')+'</em></span>':'';
      var more=(evStops<0)!==(r.dir<0), tag=band?'<span class="tag'+(hit?' ok':'')+'">'+(hit?'✓ SET FOR THE FRAME':'FOR THE FRAME')+'</span>':free?'<span class="tag free">'+(more?(evStops<0?'MORE LIGHT ›':'LESS LIGHT ›'):(evStops<0?'‹ MORE LIGHT':'‹ LESS LIGHT'))+'</span>':'';
      html+='<div class="cb-scale cb-'+r.key+(ri===cbRow?' sel':'')+(band?' held':'')+(hit?' hit':'')+(free?' free':'')+'" data-cb-row="'+ri+'"><div class="cb-cap"><span class="ic">'+CB_ICON[r.key]+'</span><span class="c">'+r.cap+'</span>'+tag+'<span class="now">'+cbEsc(cbFmt(r,r.vals[r.idx]))+'</span></div>'
        +'<div class="cb-track"'+(r.lock?' style="cursor:default"':' data-cb-track="'+r.key+'"')+'><div class="cb-line'+(r.dir<0?' rev':'')+'"><b style="width:'+pc(r.idx)+'"></b></div>'+bandHtml+stops+'<span class="cb-knob" style="left:'+pc(r.idx)+'"><i></i></span>'
        +(r.note?'<div class="cb-ends"><span style="color:#e3ad57">'+cbEsc(r.note)+'</span></div>':'<div class="cb-ends"><span>‹ '+cbEsc(r.lo)+'</span><span>'+cbEsc(r.hi)+' ›</span></div>')+'</div></div>'; });
    var m=cbMeterWords(), a=Math.max(-3,Math.min(3,evStops))/3*55*Math.PI/180;
    var nx=(66+48*Math.sin(a)).toFixed(1), ny=(66-48*Math.cos(a)).toFixed(1), b=curBody();
    html+='<div class="cb-meter"><svg width="132" height="72" viewBox="0 0 132 72" role="img" aria-label="Light meter: '+cbEsc(m.head)+'">'
      +'<path d="M14 66 A52 52 0 0 1 118 66" fill="none" stroke="rgba(240,232,214,0.18)"/>'
      +'<g stroke="rgba(240,232,214,0.45)"><path d="M14 66 l7 -2"/><path d="M24.5 33 l6 4"/><path d="M66 14 v7"/><path d="M107.5 33 l-6 4"/><path d="M118 66 l-7 -2"/></g>'
      +'<text x="9" y="58" fill="#6f695d" font-size="10" font-family="Geist Mono, monospace">−</text><text x="117" y="58" fill="#6f695d" font-size="10" font-family="Geist Mono, monospace">+</text>'
      +'<path d="M66 66 L'+nx+' '+ny+'" stroke="#e3ad57" stroke-width="1.6" stroke-linecap="round"/><circle cx="66" cy="66" r="3.5" fill="#e3ad57"/></svg>'
      +'<div class="cb-words"><span class="h">'+cbEsc(m.head)+'</span><span class="b">'+cbEsc(m.body)+'</span>'+(m.shake?'<span class="s">'+cbEsc(m.shake)+'</span>':'')+'</div>'
      +(cbTask()||'<div class="cb-info"><span>'+cbEsc((b.fmt||"").toUpperCase())+'</span><span>'+focalMM+' MM</span><span>FOCUS '+focusBars()+'</span></div>')+'</div>';
    return cbChrome(cbCounter("FRAME",cbPad(photos.length+1)), cbEsc(cbPlace.toUpperCase()), "SPACE · BACK TO THE SCENE", html); }
  // standing in a gold frame: its checklist comes onto the back with you, so you can see what to set
  function cbTask(){ if(typeof CH==="undefined"||!(CH.active>=0)||!CH.pads[CH.active]) return ""; var P=CH.pads[CH.active], ck=chChecks(P).slice(1), next=-1;
    ck.forEach(function(x,j){ if(next<0&&!x.ok) next=j; }); var all=next<0;
    return '<div class="cb-task'+(all?' all':'')+'"><span class="k">GOLD FRAME · '+cbEsc(P.c.title||"")+'</span>'+ck.map(function(x,j){ var w=x.where, here=w&&w.at==="back", chip="";
        if(!x.ok&&w){ if(w.at==="bag") chip='<kbd class="w" data-cb-btn="bag">B · BAG</kbd>'; else if(here) chip='<kbd class="w here">HERE</kbd>'; else if(w.at==="zoom") chip='<kbd class="w">SCROLL IN THE FINDER</kbd>'; else chip='<kbd class="w">'+cbEsc(w.key)+'</kbd>'; }
        return '<span class="r'+(x.ok?' ok':'')+(j===next?' next':'')+'"><i>'+(x.ok?'✓':'')+'</i><em>'+cbEsc(x.label.replace(/[:(].*$/,""))+'</em>'+chip+'<b>'+cbEsc(x.now||"")+'</b></span>'; }).join("")
      +(all?'<span class="go">ALL SET · SPACE, THEN SHOOT</span>':'')+'</div>'; }
  function cbShootStep(d){ var r=cbShootRows()[cbRow]; if(r.lock){ toast(r.note); return; } var i=Math.max(0,Math.min(r.vals.length-1,r.idx+d)); if(i===r.idx) return;
    i+=r.o; sfx("detent"); if(r.key==="sh") shIdx=i; else if(r.key==="ap") apIdx=apClamp(i); else isoIdx=i; computeCam(); cbRender(); }
  /* i is an index into the full table (SHUTTERS / AP_FULL / ISOS) */
  function cbShootSet(key,i){ if(key==="iso"&&filmIsoLocked()){ toast("This roll is ISO "+ISOS[isoIdx]+". Load a new roll to change it."); return; }
    sfx("detent"); if(key==="sh") shIdx=Math.max(0,Math.min(SHUTTERS.length-1,i)); else if(key==="ap") apIdx=apClamp(i); else isoIdx=Math.max(0,Math.min((curBody().film?FILM_ISO_MAX:ISOS.length-1),i));
    cbRow=key==="sh"?0:key==="ap"?1:2; computeCam(); cbRender(); }

  // ---- 02 REVIEW: the latest frames, a real histogram, ratings and picks ----
  function cbHistFor(ph){ var key=ph.url; if(cbHist[key]!==undefined) return cbHist[key]; cbHist[key]=null;
    var im=new Image(); im.onload=function(){ try{ var c=document.createElement("canvas"), W=96, H=64; c.width=W; c.height=H; var g=c.getContext("2d"); g.drawImage(im,0,0,W,H);
      var d=g.getImageData(0,0,W,H).data, bins=new Array(48).fill(0), i; for(i=0;i<d.length;i+=4){ var l=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; bins[Math.min(47,Math.floor(l/256*48))]++; }
      var mx=Math.max.apply(null,bins)||1, pts=bins.map(function(v,j){ return (j*198/47).toFixed(1)+" "+(70-v/mx*64).toFixed(1); });
      var total=W*H, lo=(bins[0]+bins[1])/total, hi=(bins[46]+bins[47])/total;
      cbHist[key]={d:"M0 70 L"+pts.join(" L")+" L198 70 Z", note: hi>0.04?"HIGHLIGHTS CLIPPING":lo>0.08?"SHADOWS BLOCKED":"ALL TONES IN RANGE", warn:hi>0.04||lo>0.08};
      if(cbOpen&&cbTab==="review") cbRender(); }catch(e){ cbHist[key]={d:"",note:"",warn:false}; } };
    im.src=ph.url; return null; }
  function cbReviewHtml(){ var n=photos.length;
    if(!n) return cbChrome(cbCounter("FRAME","00"), cbEsc(cbPlace.toUpperCase()), "SPACE · BACK TO THE VIEWFINDER",
      '<div class="cb-empty"><span class="h">Nothing on the card yet.</span><span class="b">Flip back with Space, raise the camera with P, then click to shoot.</span></div>');
    if(cbReview<0||cbReview>n-1) cbReview=n-1;
    var ph=photos[cbReview], h=cbHistFor(ph), rating=ph.rating||0, picked=!!ph.pick, nPicked=photos.filter(function(p){ return p.pick; }).length;
    var stars=""; for(var s=1;s<=5;s++) stars+='<button class="cb-star'+(s<=rating?' on':'')+'" data-cb-rate="'+s+'" aria-label="'+s+' stars"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l1.9 4.1 4.4.5-3.3 3 .9 4.4L8 11.3l-3.9 2.2.9-4.4-3.3-3 4.4-.5z"/></svg></button>';
    var lo=Math.max(0,Math.min(cbReview-4,n-8)), thumbs="";
    for(var i=lo;i<Math.min(n,lo+8);i++){ thumbs+='<button class="cb-thumb'+(i===cbReview?' cur':'')+(photos[i].pick?' pick':'')+'" data-cb-frame="'+i+'"><span class="im"><img src="'+photos[i].url+'" alt=""></span><span class="n">'+cbPad(i+1)+'</span></button>'; }
    var body='<div class="cb-rv"><div class="cb-shot"><img src="'+ph.url+'" alt="Frame '+(cbReview+1)+'">'
      +'<span class="pill tl">'+(ph.edited?"EDITED":ph.uploaded?"UPLOADED":"3:2 · RAW")+'</span>'
      +(h&&h.note?'<span class="pill br'+(h.warn?' warn':'')+'"><i></i>'+h.note+'</span>':'')+'</div>'
      +'<div class="cb-side"><span class="lbl">Histogram</span><svg width="198" height="70" viewBox="0 0 198 70" role="img" aria-label="Histogram of this frame"><path d="M0 69.5H198" stroke="rgba(240,232,214,0.2)"/><path d="M66 0V70M132 0V70" stroke="rgba(240,232,214,0.07)"/>'
      +(h&&h.d?'<path d="'+h.d+'" fill="rgba(227,173,87,0.22)" stroke="#e3ad57" stroke-width="1"/>':'')+'</svg>'
      +'<div class="cb-hl"><span>SHADOWS</span><span>HIGHLIGHTS</span></div>'
      +'<div class="cb-exif"><span>'+cbEsc(ph.sh||"-")+'</span><span>'+(ph.f?"f/"+ph.f:"-")+'</span><span>'+(ph.iso?"ISO "+ph.iso:"-")+'</span><span>'+(ph.mm?ph.mm+" mm":"-")+'</span></div>'
      +'<div class="cb-rate"><div class="stars">'+stars+'</div><button class="cb-pick'+(picked?' on':'')+'" data-cb-pick="1"><svg width="10" height="12" viewBox="0 0 10 12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1.5 11.5V1M1.5 1.5h7l-1.8 2.5 1.8 2.5h-7"/></svg>'+(picked?"PICKED":"PICK")+'</button></div></div></div>'
      +'<div class="cb-strip">'+thumbs+'<span class="hint">← → step · 1–5 rate · P pick</span></div>';
    return cbChrome(cbCounter("FRAME",cbPad(cbReview+1),cbPad(n)), cbEsc(cbPlace.toUpperCase()), nPicked+" PICKED · SAVED AS YOU GO", body); }
  function cbRate(s){ var ph=photos[cbReview]; if(!ph) return; ph.rating=(ph.rating===s?0:s); saveSession(); cbRender(); }
  function cbTogglePick(){ var ph=photos[cbReview]; if(!ph) return; ph.pick=!ph.pick; saveSession(); cbRender(); }

  // ---- 03 BRIEF: the challenge and progress through them ----
  function cbBriefHtml(){ var sel=cbBriefSel-1, b=sel>=0?BRIEFS[sel]:null, done=0; BRIEFS.forEach(function(x){ if(briefDone[x.id]>0) done++; });
    var shot=b?(briefDone[b.id]||0):0, active=(sel===activeBrief);
    var left='<div class="cb-bl"><span class="eb">'+cbEsc(cbPlace.toUpperCase())+(b?' · BRIEF '+cbPad(sel+1)+' OF '+cbPad(BRIEFS.length):' · FREE SHOOT')+'</span>'
      +'<h2>'+cbEsc(b?b.t:"Free shoot")+'</h2><p>'+cbEsc(b?b.tip+".":"No brief. Shoot whatever catches your eye, then pick your best in Review.")+'</p>'
      +(b?'<div class="cb-checks"><div class="row"><span class="box'+(shot>0?' done':'')+'"></span><span>Shoot it</span><span class="note">'+shot+' frame'+(shot===1?'':'s')+'</span></div>'
        +'<div class="row"><span class="box'+(shot>=3?' done':'')+'"></span><span>Try three different angles</span><span class="note">'+Math.min(shot,3)+' / 3</span></div></div>':'')
      +'<div class="cb-set'+(active?' on':'')+'">'+(active?'<span class="dot"></span>THIS IS YOUR ACTIVE BRIEF':'↵ MAKE THIS MY BRIEF')+'</div></div>';
    var rows='<button class="cb-brow'+(cbBriefSel===0?' sel':'')+(activeBrief<0?' act':'')+'" data-cb-brief="0"><span class="n">-</span><span class="t">Free shoot</span><span class="c"></span></button>';
    BRIEFS.forEach(function(x,i){ var c=briefDone[x.id]||0;
      rows+='<button class="cb-brow'+(cbBriefSel===i+1?' sel':'')+(activeBrief===i?' act':'')+'" data-cb-brief="'+(i+1)+'"><span class="n">'+cbPad(i+1)+'</span><span class="t">'+cbEsc(x.t)+'</span><span class="c'+(c?' done':'')+'">'+(c?"✓ "+c:"")+'</span></button>'; });
    return cbChrome(cbCounter("BRIEF",b?cbPad(sel+1):"-",cbPad(BRIEFS.length)), done+" OF "+BRIEFS.length+" BRIEFS SHOT", "↑ ↓ CHOOSE · ↵ SET",
      left+'<div class="cb-blist">'+rows+'</div>'); }
  function cbBriefPick(){ var i=cbBriefSel-1; setBrief(i); cbRender(); }

  // ---- 04 SETUP: handling, you, and leaving the location ----
  function cbLookVal(){ return Math.max(1,Math.min(100,Math.round((sens-0.0006)/0.00004))); }
  function cbSetupRows(){ return [
    {k:"name",  g:"YOU",      label:"Your name",          val:studentName},
    {k:"look",  g:"HANDLING", label:"Look speed",         val:cbLookVal(), bar:cbLookVal()/100},
    {k:"move",  g:"HANDLING", label:"Move speed",         val:Math.round(moveScale*100), bar:moveScale},
    {k:"invert",g:"HANDLING", label:"Invert look",        val:invertY?"ON":"OFF", on:invertY},
    {k:"bounds",g:"HANDLING", label:"Stay inside the scan",val:boundsOn?"ON":"OFF", on:boundsOn},
    {k:"sound", g:"HANDLING", label:"Sound",              val:sfxLevelName(), on:soundOn},
    {k:"grid",  g:"HANDLING", label:"Grid while walking", val:grid.classList.contains("hidden")?"OFF":"ON", on:!grid.classList.contains("hidden")},
    {k:"walk",  g:"HANDLING", label:"Getting about",      val:WK.mode==="walk"?"WALK":"FLY", on:WK.mode==="walk"},
    {k:"detail",g:"HANDLING", label:"Scan detail",        val:(DETAIL[sceneDetail]||DETAIL.full).label, on:sceneDetail!=="light"},
    {k:"upscale",g:"HANDLING", label:"Upscaling (faster)", val:upOn?"ON":"OFF", on:upOn},
    {k:"recentre",g:"PLACE",  label:"Back to the start point", val:"↵"},
    {k:"photos",g:"PLACE",    label:"Open the studio",    val:"↵"},
    {k:"leave", g:"PLACE",    label:"Leave location",     val:"↵", danger:true}].filter(function(r){ return !(r.k==="leave"&&typeof navNoHome==="function"&&navNoHome()); }); }   /* the demo has no Home to leave to */
  function cbSetupHtml(){ var rows=cbSetupRows(), html="", lastG="";
    rows.forEach(function(r,i){ if(r.g!==lastG){ html+='<span class="cb-g">'+r.g+'</span>'; lastG=r.g; }
      var right;
      if(r.k==="name") right='<input id="cbName" class="cb-in" type="text" maxlength="40" placeholder="Type your name" value="'+cbEsc(r.val)+'" spellcheck="false">';
      else if(r.bar!=null) right='<span class="cb-bar"><i style="width:'+(r.bar*100).toFixed(0)+'%"></i><b style="left:'+(r.bar*100).toFixed(0)+'%"></b></span><span class="v">'+r.val+'</span>';
      else right='<span class="v'+(r.on?' on':'')+(r.danger?' danger':'')+'">'+r.val+'</span>';
      html+='<div role="button" tabindex="-1" class="cb-srow'+(i===cbSetupRow?' sel':'')+(r.danger?' danger':'')+'" data-cb-setup="'+i+'"><span class="l">'+r.label+'</span>'+(i===cbSetupRow&&r.k!=="name"?'<span class="ch">‹</span>':'')+right+(i===cbSetupRow&&r.k!=="name"?'<span class="ch">›</span>':'')+'</div>'; });
    return cbChrome('<span class="cb-saved"></span><span>SAVED</span>', cbEsc((studentName||"Not signed in").toUpperCase()), "↑ ↓ CHOOSE · ← → CHANGE · ↵ DO", '<div class="cb-setup">'+html+'</div>'); }
  function cbSetupChange(d, enter){ var r=cbSetupRows()[cbSetupRow]; if(!r) return;
    if(r.k==="name"){ var nm=$("cbName"); if(nm){ nm.focus(); nm.select(); } return; }
    if(r.k==="look"||r.k==="move") sfx("detent"); else if(r.k!=="recentre"&&r.k!=="photos"&&r.k!=="leave"&&r.k!=="sound") sfx("toggle");
    if(r.k==="look"){ var v=Math.max(1,Math.min(100,cbLookVal()+d*4)); sens=0.0006+v*0.00004; }
    else if(r.k==="move"){ moveScale=Math.max(0.01,Math.min(1,Math.round(moveScale*100+d*4)/100)); }
    else if(r.k==="invert") invertY=!invertY;
    else if(r.k==="bounds") boundsOn=!boundsOn;
    else if(r.k==="sound"){ sfxLevelStep(d, !!enter); sfx("toggle"); }
    else if(r.k==="grid") toggleGrid();
    else if(r.k==="upscale"){ upOn=!upOn; try{ localStorage.setItem("studium_upscale",upOn?"on":"off"); }catch(e){} setScale(dynTop()); toast(upOn?"Upscaling on. This helps slower computers run smoothly.":"Upscaling off. Everything is drawn at full size."); }
    else if(r.k==="walk"){ wkSetMode(WK.mode==="walk"?"fly":"walk"); toast(WK.mode==="walk"?"Walking: feet on the ground. Q and E crouch and stand tall.":"Flying: Q and E go down and up. You still can't go through things."); }
    else if(r.k==="detail"){ var LV=["light","balanced","full"], li=LV.indexOf(sceneDetail); sceneDetail=LV[li<0?1:(li+(d<0?-1:1)+3)%3]; try{ localStorage.setItem("studium_detail",sceneDetail); }catch(e){}
      var sc=(window.SPLAT_SCENES||[]).filter(function(s){ return s.name===cbPlace; })[0]; if(sc&&loaded){ closeBack(false); toast({light:"Light detail, for slower computers", balanced:"Balanced detail, smooth and still sharp", full:"Full detail, for fast computers"}[sceneDetail]); loadBundled(sc); return; } }
    else if(enter && r.k==="recentre"){ closeBack(false); frameScene(); updateCamera(0); toast("Back to the start point"); return; }
    else if(enter && r.k==="photos"){ closeBack(false); openStudio("select"); return; }
    else if(enter && r.k==="leave"){ closeBack(false); showHub(); return; }
    else return;
    cbRender(); }

  // ---- render + hints ----
  function cbRender(){ var ui=$("cbUi"); if(!ui||!cbOpen) return;
    var focusName=document.activeElement&&document.activeElement.id==="cbName";
    if(focusName) return;   // don't rebuild under someone typing their name
    ui.innerHTML= cbTab==="shoot"?cbShoot() : cbTab==="review"?cbReviewHtml() : cbTab==="brief"?cbBriefHtml() : cbSetupHtml();
    Array.prototype.forEach.call(document.querySelectorAll("[data-cb-print]"),function(p){ p.classList.toggle("on", p.getAttribute("data-cb-print")===cbTab); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-cb-btn]"),function(h){ h.classList.toggle("on", h.getAttribute("data-cb-btn")===cbTab); });
    var hints={ shoot:[["Space","Back to the scene"],["Click / drag","Change a setting"],["↑ ↓","Row"],["← →","Step"],["B","Bag"],["Tab","Studio"]],
      review:[["Space","Viewfinder"],["Q E","Tabs"],["← →","Step"],["1–5","Rate"],["P","Pick"]],
      brief:[["Space","Viewfinder"],["Q E","Tabs"],["↑ ↓","Choose"],["↵","Set brief"]],
      setup:[["Space","Viewfinder"],["Q E","Tabs"],["↑ ↓","Choose"],["← →","Change"],["↵","Do"]] }[cbTab];
    $("cbHints").innerHTML=hints.map(function(h){ return '<span><kbd>'+h[0]+'</kbd>'+h[1]+'</span>'; }).join("");
    var nm=$("cbName"); if(nm){ nm.oninput=function(){ studentName=this.value; var m=$("mName"); if(m) m.value=studentName; saveSession(); };
      nm.onkeydown=function(e){ if(e.key==="Enter"||e.key==="Escape"){ e.preventDefault(); this.blur(); cbRender(); } e.stopPropagation(); }; } }

  // ---- input ----
  function cbKey(e){ var c=e.code, k=e.key;
    if(c==="Space"||c==="Escape"){ e.preventDefault(); closeBack(); return true; }
    if(c==="KeyQ"||c==="KeyE"){ if(CB_TABS.length>1) cbCycleTab(c==="KeyQ"?-1:1); return true; }
    if(c==="KeyB"){ e.preventDefault(); cbPress("bag"); closeBack(false); openBag("back"); return true; }
    if(c==="Tab"){ e.preventDefault(); closeBack(false); openStudio("select"); return true; }
    var up=c==="ArrowUp", dn=c==="ArrowDown", lf=c==="ArrowLeft", rt=c==="ArrowRight", en=(c==="Enter"||c==="NumpadEnter");
    if(up||dn||lf||rt||en) e.preventDefault();
    if(cbTab==="shoot"){ if(up) cbRow=(cbRow+2)%3, cbRender(); else if(dn) cbRow=(cbRow+1)%3, cbRender(); else if(lf) cbShootStep(-1); else if(rt) cbShootStep(1); }
    else if(cbTab==="review"){ if(lf&&cbReview>0){ cbReview--; cbRender(); } else if(rt&&cbReview<photos.length-1){ cbReview++; cbRender(); }
      else if(/^[0-5]$/.test(k)){ var s=+k; if(s===0){ var ph=photos[cbReview]; if(ph){ ph.rating=0; saveSession(); cbRender(); } } else cbRate(s); }
      else if(c==="KeyP"){ cbTogglePick(); } }
    else if(cbTab==="brief"){ if(up){ cbBriefSel=(cbBriefSel+BRIEFS.length)%(BRIEFS.length+1); cbRender(); } else if(dn){ cbBriefSel=(cbBriefSel+1)%(BRIEFS.length+1); cbRender(); } else if(en) cbBriefPick(); }
    else if(cbTab==="setup"){ var nr=cbSetupRows().length; if(up){ cbSetupRow=(cbSetupRow+nr-1)%nr; cbRender(); } else if(dn){ cbSetupRow=(cbSetupRow+1)%nr; cbRender(); }
      else if(lf) cbSetupChange(-1,false); else if(rt) cbSetupChange(1,false); else if(en) cbSetupChange(1,true); }
    return true; }
  function cbWheel(e){ if(!cbOpen) return; e.preventDefault(); var d=e.deltaY>0?1:-1;
    var now=performance.now(); if(now-(cbWheel._t||0)<70) return; cbWheel._t=now;   // one detent per notch, trackpads included
    if(cbTab==="shoot") return;   // settings are clicked or dragged now; the wheel was too fiddly
    cbPress("shoot");
    if(cbTab==="review"){ cbReview=Math.max(0,Math.min(photos.length-1,cbReview+d)); cbRender(); }
    else if(cbTab==="brief"){ cbBriefSel=Math.max(0,Math.min(BRIEFS.length,cbBriefSel+d)); cbRender(); }
    else { cbSetupChange(d,false); } }
  function cbClick(e){ var t=e.target.closest("[data-cb-tab],[data-cb-set],[data-cb-row],[data-cb-frame],[data-cb-rate],[data-cb-pick],[data-cb-brief],[data-cb-setup],[data-cb-btn]"); if(!t) return;
    if(t.hasAttribute("data-cb-btn")){ var id=t.getAttribute("data-cb-btn"); cbPress(id);
      if(id==="back") closeBack(); else if(id==="bag"){ closeBack(false); openBag("back"); } else if(id==="photos"){ closeBack(false); openStudio("select"); } else cbSetTab(id); return; }
    if(t.hasAttribute("data-cb-tab")) return cbSetTab(t.getAttribute("data-cb-tab"));
    if(t.hasAttribute("data-cb-set")){ var p=t.getAttribute("data-cb-set").split(":"); return cbShootSet(p[0],+p[1]); }
    if(t.hasAttribute("data-cb-row")){ cbRow=+t.getAttribute("data-cb-row"); return cbRender(); }
    if(t.hasAttribute("data-cb-frame")){ cbReview=+t.getAttribute("data-cb-frame"); return cbRender(); }
    if(t.hasAttribute("data-cb-rate")) return cbRate(+t.getAttribute("data-cb-rate"));
    if(t.hasAttribute("data-cb-pick")) return cbTogglePick();
    if(t.hasAttribute("data-cb-brief")){ var b=+t.getAttribute("data-cb-brief"); if(b===cbBriefSel) cbBriefPick(); else { cbBriefSel=b; cbRender(); } return; }
    if(t.hasAttribute("data-cb-setup")){ var r=+t.getAttribute("data-cb-setup"); if(r===cbSetupRow) cbSetupChange(1,true); else { cbSetupRow=r; cbRender(); if(cbSetupRows()[r].k==="name"){ var nm=$("cbName"); if(nm) nm.focus(); } } } }
  // drag along a track: the nearest stop to the pointer, live. The track is rebuilt on every change, so its
  // position is measured once when you grab it.
  var cbDrag=null;
  function cbDragTo(x){ var d=cbDrag, n=d.n, i=Math.max(0,Math.min(n-1,Math.round((x-d.l)/d.w*(n-1)))); if(i!==d.i){ d.i=i; cbShootSet(d.key,i+(d.o||0)); } }
  function cbDown(e){ var tr=e.target.closest&&e.target.closest("[data-cb-track]"); if(!tr||cbTab!=="shoot"||e.button!==0) return; e.preventDefault();
    var key=tr.getAttribute("data-cb-track"), r=cbShootRows().filter(function(x){ return x.key===key; })[0], b=tr.getBoundingClientRect();
    cbDrag={key:key, n:r.vals.length, i:r.idx, o:r.o, l:b.left, w:Math.max(1,b.width)}; cbRow=key==="sh"?0:key==="ap"?1:2; cbDragTo(e.clientX); $("camback").classList.add("dragging"); }
  window.addEventListener("pointermove",function(e){ if(cbDrag) cbDragTo(e.clientX); });
  window.addEventListener("pointerup",function(){ if(cbDrag){ cbDrag=null; var el=$("camback"); if(el) el.classList.remove("dragging"); cbRender(); } });
  (function wireBack(){ var el=$("camback"); if(!el) return;
    el.addEventListener("wheel",cbWheel,{passive:false}); el.addEventListener("click",cbClick); el.addEventListener("pointerdown",cbDown);
    window.addEventListener("resize",function(){ if(cbOpen) cbLayout(); }); })();
