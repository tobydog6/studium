  // ================= VIEWFINDER (P) =================
  // EVF style: the scene sits in the body's frame (3:2 for 35 mm, 5:4 for 6x7 and 4x5) on black, and every
  // readout lives on the black strip below it. Only guides, focus brackets, the level and small chips touch the
  // scene, each with a halo or a blurred plate so they read over any location. Keys 1 2 3 pick a dial and the
  // scroll wheel turns it; Shift+scroll racks focus. What you frame is exactly what the shutter captures.
  var vfDial="sh", vfToastT=null;
  var VF_DIALS=[["sh","SHUTTER"],["ap","APERTURE"],["iso","ISO"]];
  function vfDials(){ var d=VF_DIALS.slice(); var l=(typeof curLens==="function")?curLens():null; if(l&&l.zoom) d.push(["mm","ZOOM"]); else if(vfDial==="mm") vfDial="sh"; return d; }

  // the frame rectangle in CSS pixels, from the window size and the body's aspect
  function vfRect(){ var W=window.innerWidth, H=window.innerHeight, A=curAspect();
    var top=Math.round(Math.max(16,H*0.029)), below=12+54+34;
    var fw=Math.min(W*0.81,(H-top-below)*A), fh=fw/A;
    return {x:Math.round((W-fw)/2), y:top, w:Math.round(fw), h:Math.round(fh)}; }
  // the lens's horizontal angle of view fills the frame, not the whole window
  function vfFovFor(sensorW, mm){ var W=window.innerWidth, H=window.innerHeight, r=vfRect(); if(vertical) sensorW=(sensorW||36)/(curBody().aspect||1.5);   // turned on its side, the short edge runs across
    var halfLens=Math.atan((sensorW||36)/(2*Math.max(mm,1))), halfCanvasH=Math.atan(Math.tan(halfLens)*W/r.w);
    return 2*Math.atan(Math.tan(halfCanvasH)/(W/H))*180/Math.PI; }

  function vfLayout(){ var r=vfRect(), f=$("vfFrame"), s=$("vfStrip"), h=$("vfHints"); if(!f) return;
    f.style.left=r.x+"px"; f.style.top=r.y+"px"; f.style.width=r.w+"px"; f.style.height=r.h+"px";
    if(s){ s.style.left=r.x+"px"; s.style.width=r.w+"px"; s.style.top=(r.y+r.h+12)+"px"; }
    if(h){ h.style.top=(r.y+r.h+12+54+10)+"px"; } }

  function vfScale(key){ if(key==="mm"){ var z=curLens().zoom; return {vals:z.map(String), idx:Math.max(0,z.indexOf(zoomMM))}; }
    return key==="sh"?{vals:SHUTTER_LABELS,idx:shIdx} : key==="ap"?{vals:APERTURES.map(function(a){ return String(a); }),idx:apIdx} : {vals:ISOS.map(String),idx:isoIdx}; }
  function vfValue(key){ if(key==="mm") return zoomMM+" MM"; return key==="sh"?SHUTTER_LABELS[shIdx] : key==="ap"?"f/"+APERTURES[apIdx] : String(ISOS[isoIdx]); }
  function vfRenderStrip(){ var s=$("vfStrip"); if(!s) return;
    var dl=vfDials(), dials=dl.map(function(d,i){ var on=d[0]===vfDial, body;
      if(on){ var sc=vfScale(d[0]), cells="";
        for(var o=-2;o<=2;o++){ var j=sc.idx+o, v=(j>=0&&j<sc.vals.length)?sc.vals[j]:""; cells+='<span class="'+(o===0?'cur':'')+'">'+v+'</span>'; }
        body='<div class="vf-tape">'+cells+'<i></i></div>'; }
      else body='<span class="vf-val">'+vfValue(d[0])+'</span>';
      var warn=(d[0]==="sh"&&shakeRisk())?'<em class="vf-shake" title="Slower than you can hand-hold this lens">SHAKE · '+handheldLimit().label+'+</em>':'';
      return '<div class="vf-dial'+(on?' on':'')+'"><span class="vf-lbl"><b>'+(i+1)+'</b>'+d[1]+warn+'</span>'+body+'</div>'; }).join("");
    var mark=Math.round(evStops*3), ticks="";
    for(var t=-6;t<=6;t++){ ticks+='<span class="tk'+(t===0?' zero':'')+(t%3===0?' whole':'')+'">'+(t===Math.max(-6,Math.min(6,mark))?'<em class="'+(Math.abs(mark)>6?'over':'')+'"></em>':'')+'</span>'; }
    s.innerHTML='<div class="vf-mode"><span class="vf-lbl">MODE</span><span class="m">M</span></div>'+dials
      +'<div class="vf-meter"><span class="vf-lbl">METER<b class="ev">'+cbThirds(evStops).replace("+0","0").replace("−0","0")+'</b></span><div class="ticks">'+ticks+'</div></div>'
      +'<div class="vf-frame"><span class="vf-lbl">'+(curBody().film?"ROLL":"FRAME")+'</span><span class="vf-val gold">'+vfFrameCount()+'</span></div>'; }
  function vfFrameCount(){ var b=curBody(); if(!b.film) return cbPad(photos.length+1);
    var n=photos.filter(function(p){ return p.body===b.name; }).length, r=b.roll||10; return cbPad(n%r+1)+'<small>/'+r+'</small>'; }
  function vfRenderChips(){ var bc=$("vfBriefChip"), gc=$("vfGuideChip");
    if(bc){ if(activeBrief>=0){ var b=BRIEFS[activeBrief], n=Math.min(4,briefDone[b.id]||0), dots="";
        for(var i=0;i<4;i++) dots+='<i class="'+(i<n?'on':'')+'"></i>';
        bc.innerHTML='<span class="k">BRIEF '+cbPad(activeBrief+1)+'</span><span class="t">'+cbEsc(b.t)+'</span><span class="d">'+dots+'</span>'; bc.classList.remove("hidden"); }
      else bc.classList.add("hidden"); }
    if(gc){ var m=COMP[compIdx]; gc.innerHTML='<span class="k">G</span><span>'+(m==="off"?"NO GUIDES":(COMP_NAMES[m]||m).toUpperCase())+'</span>'; } }
  function vfRefresh(){ if(!viewfinderOn) return; vfLayout(); vfRenderStrip(); vfRenderChips(); }
  function vfLevelTick(){ var lv=$("vfLevel"); if(lv&&viewfinderOn) lv.classList.toggle("level", Math.abs(pitch)<0.02); }
  function vfPickDial(k){ vfDial=k; vfRenderStrip(); }
  function vfTurn(d){ var sc=vfScale(vfDial), i=Math.max(0,Math.min(sc.vals.length-1,sc.idx+d)); if(i===sc.idx) return;
    if(vfDial==="mm"){ zoomMM=curLens().zoom[i]; focalMM=zoomMM; computeCam(); return; }
    if(vfDial==="sh") shIdx=i; else if(vfDial==="ap") apIdx=i; else isoIdx=i; computeCam(); }
  function vfToast(text){ var t=$("vfToast"); if(!t) return;
    t.innerHTML='<i></i><span class="k">SHOT '+cbPad(photos.length)+'</span><span>'+cbEsc(text)+'</span>';
    t.classList.remove("show"); void t.offsetWidth; t.classList.add("show"); clearTimeout(vfToastT); vfToastT=setTimeout(function(){ t.classList.remove("show"); },4200); }
  window.addEventListener("wheel",function(e){ if(!viewfinderOn||menuOpen()) return; e.preventDefault(); e.stopImmediatePropagation();
    var now=performance.now(); if(now-(vfTurn._t||0)<70) return; vfTurn._t=now; var d=e.deltaY>0?1:-1;
    if(e.shiftKey) setFocus(focusDist-d*0.05); else vfTurn(d); },{passive:false, capture:true});
  window.addEventListener("resize",function(){ if(viewfinderOn){ vfRefresh(); computeCam(); } });
