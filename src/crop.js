  // ================= CROP: a crop box over the whole photo, the way Photoshop and Lightroom do it =================
  // C (or the CROP button, or any ratio) opens it. The canvas shows the whole photo; the box sits over it with eight
  // handles: drag a corner or an edge to resize, drag inside to move. Free, Original or a fixed ratio (⇄ swaps
  // portrait and landscape), a rule-of-thirds grid while you work. Enter or ✓ applies, Esc puts it back. The result is
  // stored the way every other part of Studium already reads a crop (aspect, zoom, centre), so bakes, Sync and
  // Copy/Paste carry it over unchanged.
  var edCrop=null;   // {x,y,w,h} as fractions of the rotated photo, ratio "free"|"orig"|number (width/height), was:{...}
  var CROP_MIN=0.04;
  function cropActive(){ return !!edCrop; }
  function cropRn(){ if(!edCrop||edCrop.ratio==="free") return 0; var R=edCrop.ratio==="orig"?rcW/rcH:edCrop.ratio; return R*rcH/rcW; }   // locked ratio in fractions
  function cropStart(ratio){ if(!edState||!edRC) return; if(edCrop){ if(ratio!=null) cropSetRatio(ratio); return; }
    var cr=cropRectFor(edState,rcW,rcH), was={aspect:edState.aspect, zoom:edState.zoom, cx:edState.cx, cy:edState.cy, cropRatio:edState.cropRatio};
    edCrop={x:cr.x/rcW, y:cr.y/rcH, w:cr.w/rcW, h:cr.h/rcH, ratio:edState.cropRatio!=null?edState.cropRatio:(edState.aspect==="free"?"free":parseFloat(edState.aspect)), was:was};
    if(typeof edResetView==="function") edResetView();
    editor.classList.add("cropping"); if(ratio!=null) cropSetRatio(ratio); cropUI(); queueRender(); cropLoop(); }
  // the largest box of that ratio, centred where the crop is now
  function cropSetRatio(r){ if(!edCrop) return; edCrop.ratio=r; var Rn=cropRn();
    if(Rn){ var cx=edCrop.x+edCrop.w/2, cy=edCrop.y+edCrop.h/2, w=1, h=w/Rn; if(h>1){ h=1; w=Rn; }
      edCrop.w=w; edCrop.h=h; edCrop.x=Math.min(Math.max(cx-w/2,0),1-w); edCrop.y=Math.min(Math.max(cy-h/2,0),1-h); }
    cropUI(); }
  function cropSwap(){ if(!edCrop) return; var r=edCrop.ratio;
    if(r==="free"){ var cx=edCrop.x+edCrop.w/2, cy=edCrop.y+edCrop.h/2, pw=edCrop.w*rcW, ph=edCrop.h*rcH, w=ph/rcW, h=pw/rcH, s=Math.min(1,1/w,1/h); w*=s; h*=s;
      edCrop.w=w; edCrop.h=h; edCrop.x=Math.min(Math.max(cx-w/2,0),1-w); edCrop.y=Math.min(Math.max(cy-h/2,0),1-h); cropUI(); return; }
    var R=r==="orig"?rcW/rcH:r; if(Math.abs(R-1)<1e-3) return; cropSetRatio(1/R); }
  function cropReset(){ if(!edCrop) return; edCrop.x=0; edCrop.y=0; edCrop.w=1; edCrop.h=1; edCrop.ratio="free"; cropUI(); }
  function cropEnd(apply){ if(!edCrop) return; var c=edCrop; edCrop=null; editor.classList.remove("cropping");
    if(apply) sfx("crop");
    if(apply){ var pw=c.w*rcW, ph=c.h*rcH, A=pw/ph, full=c.w>0.995&&c.h>0.995;
      if(full){ edState.aspect="free"; edState.zoom=1; edState.cx=0.5; edState.cy=0.5; edState.cropRatio="free"; }
      else { var fw, fh; if(rcW/rcH>A){ fh=rcH; fw=rcH*A; } else { fw=rcW; fh=rcW/A; }
        edState.aspect=(typeof c.ratio==="number"&&Math.abs(c.ratio-A)<0.01)?String(+c.ratio.toFixed(5)):String(+A.toFixed(5));
        edState.zoom=fw/pw; edState.cx=c.x+c.w/2; edState.cy=c.y+c.h/2; edState.cropRatio=c.ratio; }
      edPushHist(); }
    else { for(var k in c.was) edState[k]=c.was[k]; }
    cropUI(); syncEditUI(); queueRender(); }
  // ---- drawing: the box over wherever the canvas sits right now ----
  function cropUI(){ var ui=$("cropUI"); if(!ui) return; ui.classList.toggle("hidden", !edCrop);
    Array.prototype.forEach.call(document.querySelectorAll("#editor .lr-ct[data-a]"),function(b){ var a=b.getAttribute("data-a"), on;
      if(edCrop) on=(a==="free"||a==="orig")?edCrop.ratio===a:(typeof edCrop.ratio==="number"&&Math.abs(parseFloat(a)-edCrop.ratio)<0.002);
      else on=edState&&(edState.cropRatio!=null?String(edState.cropRatio)===a||(typeof edState.cropRatio==="number"&&Math.abs(parseFloat(a)-edState.cropRatio)<0.002):a===edState.aspect);
      b.classList.toggle("on", !!on); });
    var cb=$("eCrop"); if(cb) cb.classList.toggle("on", !!edCrop);
    if(!edCrop) return; cropPlace(); }
  function cropPlace(){ var ui=$("cropUI"), cv=$("editCanvas"), stg=$("editStage"); if(!ui||!cv||!stg||!edCrop) return;
    var r=cv.getBoundingClientRect(), s=stg.getBoundingClientRect(), box=ui.querySelector(".crop-box"), x=r.left-s.left, y=r.top-s.top;
    box.style.left=(x+edCrop.x*r.width).toFixed(1)+"px"; box.style.top=(y+edCrop.y*r.height).toFixed(1)+"px";
    box.style.width=(edCrop.w*r.width).toFixed(1)+"px"; box.style.height=(edCrop.h*r.height).toFixed(1)+"px";
    var lab=ui.querySelector(".crop-size"); if(lab) lab.textContent=Math.round(edCrop.w*rcW)+" × "+Math.round(edCrop.h*rcH); }
  function cropLoop(){ if(!edCrop) return; cropPlace(); requestAnimationFrame(cropLoop); }
  // ---- dragging: move, or resize from a handle, kept inside the photo and to the ratio ----
  var cropDrag=null;
  function cropPt(e){ var r=$("editCanvas").getBoundingClientRect(); return {x:(e.clientX-r.left)/Math.max(1,r.width), y:(e.clientY-r.top)/Math.max(1,r.height)}; }
  function cropResize(h,p){ var c=cropDrag.c, Rn=cropRn();
    var hx=h.indexOf("w")>=0?"w":h.indexOf("e")>=0?"e":"", hy=h.indexOf("n")>=0?"n":h.indexOf("s")>=0?"s":"";
    var ax=hx==="w"?c.x+c.w:hx==="e"?c.x:c.x+c.w/2, ay=hy==="n"?c.y+c.h:hy==="s"?c.y:c.y+c.h/2;
    var w=hx?Math.abs(p.x-ax):c.w, h2=hy?Math.abs(p.y-ay):c.h;
    if(hx&&((hx==="e"&&p.x<ax)||(hx==="w"&&p.x>ax))) w=CROP_MIN; if(hy&&((hy==="s"&&p.y<ay)||(hy==="n"&&p.y>ay))) h2=CROP_MIN;
    if(Rn){ if(hx&&hy){ w=Math.max(w,h2*Rn); h2=w/Rn; } else if(hx) h2=w/Rn; else w=h2*Rn; }
    var mw=hx==="w"?ax:hx==="e"?1-ax:2*Math.min(ax,1-ax), mh=hy==="n"?ay:hy==="s"?1-ay:2*Math.min(ay,1-ay);
    if(Rn){ var k=Math.min(1,mw/w,mh/h2); w*=k; h2*=k; var m=Math.max(CROP_MIN/w,CROP_MIN/h2,1); if(m>1){ w*=m; h2*=m; } }
    else { w=Math.min(Math.max(w,CROP_MIN),mw); h2=Math.min(Math.max(h2,CROP_MIN),mh); }
    edCrop.w=w; edCrop.h=h2; edCrop.x=hx==="w"?ax-w:hx==="e"?ax:ax-w/2; edCrop.y=hy==="n"?ay-h2:hy==="s"?ay:ay-h2/2;
    edCrop.x=Math.min(Math.max(edCrop.x,0),1-edCrop.w); edCrop.y=Math.min(Math.max(edCrop.y,0),1-edCrop.h); }
  (function wireCrop(){ var ui=$("cropUI"); if(!ui) return;
    ui.addEventListener("pointerdown",function(e){ if(!edCrop||e.button!==0) return; var hd=e.target.closest("[data-crop-h]"); if(!hd&&!e.target.closest(".crop-box")) return;
      e.preventDefault(); e.stopPropagation(); cropDrag={h:hd?hd.getAttribute("data-crop-h"):"move", p:cropPt(e), c:{x:edCrop.x,y:edCrop.y,w:edCrop.w,h:edCrop.h}};
      try{ ui.setPointerCapture(e.pointerId); }catch(er){} ui.classList.add("drag"); });
    ui.addEventListener("pointermove",function(e){ if(!cropDrag) return; var p=cropPt(e);
      if(cropDrag.h==="move"){ var c=cropDrag.c; edCrop.x=Math.min(Math.max(c.x+p.x-cropDrag.p.x,0),1-c.w); edCrop.y=Math.min(Math.max(c.y+p.y-cropDrag.p.y,0),1-c.h); }
      else cropResize(cropDrag.h,p);
      cropPlace(); });
    var end=function(){ if(cropDrag){ cropDrag=null; ui.classList.remove("drag"); } }; ui.addEventListener("pointerup",end); ui.addEventListener("pointercancel",end);
    ui.addEventListener("dblclick",function(e){ if(e.target.closest(".crop-box")) cropEnd(true); });
    var b;
    if((b=$("eCrop"))) b.onclick=function(){ if(edCrop) cropEnd(true); else cropStart(); };
    if((b=$("eCropApply"))) b.onclick=function(){ cropEnd(true); };
    if((b=$("eCropCancel"))) b.onclick=function(){ cropEnd(false); };
    if((b=$("eCropReset"))) b.onclick=cropReset;
    if((b=$("eCropSwap"))) b.onclick=cropSwap;
    Array.prototype.forEach.call(document.querySelectorAll("#editor .lr-ct[data-a]"),function(bt){ bt.onclick=function(){ var a=bt.getAttribute("data-a"), r=(a==="free"||a==="orig")?a:parseFloat(a); if(edCrop) cropSetRatio(r); else cropStart(r); }; });
    // anything else in the editor (a slider, another frame, Done) applies the crop first
    editor.addEventListener("pointerdown",function(e){ if(!edCrop) return; if(e.target.closest("#cropUI,.lr-croptools,#eBefore")) return; cropEnd(true); },true);
    window.addEventListener("keydown",function(e){ if(!editor||editor.classList.contains("hidden")) return; var t=e.target, typing=t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)&&t.type!=="range");
      if(typing) return;
      if(edCrop&&(e.key==="Enter"||e.key==="Escape")){ e.preventDefault(); e.stopImmediatePropagation(); cropEnd(e.key==="Enter"); return; }
      if((e.key==="c"||e.key==="C")&&!e.ctrlKey&&!e.metaKey){ e.preventDefault(); if(edCrop) cropEnd(true); else cropStart(); } },true);
    window.addEventListener("resize",function(){ if(edCrop) cropPlace(); }); })();
  if(/[?&]dev/.test(location.search)) window.__crop={ state:function(){ return {on:!!edCrop, box:edCrop?{x:+edCrop.x.toFixed(3),y:+edCrop.y.toFixed(3),w:+edCrop.w.toFixed(3),h:+edCrop.h.toFixed(3),r:edCrop.ratio}:null,
    aspect:edState&&edState.aspect, zoom:edState&&+(+edState.zoom).toFixed(3), cx:edState&&+edState.cx.toFixed(3), cy:edState&&+edState.cy.toFixed(3), px:edState?Math.round(rcW)+"x"+Math.round(rcH):null}; } };
