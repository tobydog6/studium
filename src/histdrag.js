  // ================= HISTOGRAM you can drag =================
  // Lightroom's trick: the histogram is five regions, Blacks, Shadows, Exposure, Highlights, Whites. Hover one and it
  // lights up with its name and value; drag left or right and the matching slider moves. Dragging in the middle of the
  // tones is Exposure, the ends are Blacks and Whites.
  var HD_REG=[["blacks","Blacks",0,0.12],["shadows","Shadows",0.12,0.32],["exposure","Exposure",0.32,0.68],["highlights","Highlights",0.68,0.88],["whites","Whites",0.88,1]];
  var hdHover=-1, hdDrag=null;
  function hdLabel(i){ var r=HD_REG[i], v=edState?edState[r[0]]:0; return r[1]+"  "+(r[0]==="exposure"?((v/100*2>0?"+":"")+(v/100*2).toFixed(2)):((v>0?"+":"")+v)); }
  function hdPaint(){ var c=$("lrHist"), wrap=c&&c.parentNode, lbl=$("lrHistLbl"), band=$("lrHistBand"); if(!c) return; var i=hdDrag?hdDrag.i:hdHover;
    if(band){ if(i<0) band.style.display="none"; else { var r=HD_REG[i]; band.style.display="block"; band.style.left=(c.offsetLeft+r[2]*c.offsetWidth)+"px"; band.style.width=((r[3]-r[2])*c.offsetWidth)+"px"; band.style.top=c.offsetTop+"px"; band.style.height=c.offsetHeight+"px"; } }
    if(lbl){ lbl.style.top=(c.offsetTop+c.offsetHeight-20)+"px"; }
    if(lbl){ lbl.textContent=i<0?"":hdLabel(i); lbl.style.display=i<0?"none":"block"; } c.style.cursor=i<0?"default":"ew-resize"; }
  (function hdWire(){ var c=$("lrHist"); if(!c) return; var wrap=c.parentNode; wrap.classList.add("hd-wrap");
    var band=document.createElement("i"); band.id="lrHistBand"; var lbl=document.createElement("span"); lbl.id="lrHistLbl"; wrap.insertBefore(band,c.nextSibling); wrap.insertBefore(lbl,band.nextSibling);
    function regionAt(e){ var r=c.getBoundingClientRect(), f=(e.clientX-r.left)/r.width; for(var i=0;i<HD_REG.length;i++) if(f<HD_REG[i][3]) return i; return HD_REG.length-1; }
    c.addEventListener("pointermove",function(e){ if(hdDrag){ var r=c.getBoundingClientRect(), dx=e.clientX-hdDrag.x, reg=HD_REG[hdDrag.i], key=reg[0], gain=key==="exposure"?80:110, v=Math.round(hdDrag.v0+dx/r.width*gain*2);
        v=Math.max(-100,Math.min(100,v)); if(edState[key]!==v){ edState[key]=v; var inp=$("p"+key.charAt(0).toUpperCase()+key.slice(1)); if(inp){ inp.value=v; if(typeof cvFill==="function") cvFill(inp); } var vv=$("v"+key.charAt(0).toUpperCase()+key.slice(1)); if(vv) vv.textContent=key==="exposure"?fmtExp(v):v; queueRender(); } hdPaint(); return; }
      var i=regionAt(e); if(i!==hdHover){ hdHover=i; hdPaint(); } });
    c.addEventListener("mouseleave",function(){ if(!hdDrag){ hdHover=-1; hdPaint(); } });
    c.addEventListener("pointerdown",function(e){ if(!edState||e.button!==0) return; e.preventDefault(); var i=regionAt(e); hdDrag={i:i,x:e.clientX,v0:edState[HD_REG[i][0]]||0}; try{ c.setPointerCapture(e.pointerId); }catch(er){} hdPaint(); });
    var up=function(){ if(!hdDrag) return; hdDrag=null; hdPaint(); edPushHist(); }; c.addEventListener("pointerup",up); c.addEventListener("pointercancel",up);
    c.addEventListener("dblclick",function(e){ if(!edState) return; var key=HD_REG[regionAt(e)][0]; edState[key]=0; syncEditUI(); queueRender(); edPushHist(); hdPaint(); }); })();
