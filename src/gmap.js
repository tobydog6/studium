  // ================= GRADIENT MAP panel =================
  // Photoshop's gradient map the way Sam uses it: a ramp of colours, the photograph's luminance picks a colour off it,
  // and the result is blended over, Soft Light by default, at an opacity. The ramp: click a stop to select it, double-click
  // it for the colour picker, drag it along, double-click the bar to add a stop, right-click a stop to remove it (two stay). Presets
  // are just ramps. Stored on the frame as gmStops [[position, hex], …], gmMode and gmOpacity (0 = off).
  var GM_PRESETS=[["Teal & orange",[[0,"#1c2b4a"],[0.5,"#8a6a56"],[1,"#f1c27a"]]],["Sepia",[[0,"#2b1d12"],[1,"#e8d2a6"]]],["Cyanotype",[[0,"#0b1f3a"],[1,"#dfe9ee"]]],
    ["Dusk",[[0,"#2a1a3e"],[0.55,"#b2496a"],[1,"#f7c27c"]]],["Forest",[[0,"#101d14"],[0.6,"#4f6b3a"],[1,"#e9e2b9"]]],["Silver",[[0,"#000000"],[1,"#ffffff"]]]];
  var GM_MODES=[["softlight","Soft light"],["overlay","Overlay"],["color","Color"],["multiply","Multiply"],["screen","Screen"],["normal","Normal"]];
  var gmSel=0, gmDrag=null;
  function gmStops(){ if(!edState) return GM_PRESETS[0][1]; if(!edState.gmStops||edState.gmStops.length<2) edState.gmStops=JSON.parse(JSON.stringify(GM_PRESETS[0][1])); return edState.gmStops; }
  function gmCss(st){ return "linear-gradient(90deg,"+st.slice().sort(function(a,b){ return a[0]-b[0]; }).map(function(s){ return s[1]+" "+(s[0]*100).toFixed(1)+"%"; }).join(",")+")"; }
  function gmPresetOf(st){ var s=JSON.stringify(st); for(var i=0;i<GM_PRESETS.length;i++) if(JSON.stringify(GM_PRESETS[i][1])===s) return i; return -1; }
  function gmRender(){ var el=$("lrGmap"); if(!el) return; gmClosePicker(); var st=gmStops(), op=edState?(edState.gmOpacity||0):0, mode=edState?(edState.gmMode||"softlight"):"softlight", cur=gmPresetOf(st);
    if(gmSel>=st.length) gmSel=st.length-1;
    el.innerHTML='<div class="gm-presets">'+GM_PRESETS.map(function(p,i){ return '<button data-gm-preset="'+i+'" class="'+(i===cur?'on':'')+'" title="'+p[0]+'"><i style="background:'+gmCss(p[1])+'"></i><span>'+p[0]+'</span></button>'; }).join("")+'</div>'
      +'<div class="gm-bar" data-gm-bar><div class="gm-ramp" style="background:'+gmCss(st)+'"></div>'
      +st.map(function(s,i){ return '<button class="gm-stop'+(i===gmSel?' sel':'')+'" data-gm-stop="'+i+'" style="left:'+(s[0]*100).toFixed(2)+'%;--c:'+s[1]+'" aria-label="Stop '+(i+1)+'"></button>'; }).join("")+'</div>'
      +'<div class="lr-row gm-pick"><span class="lr-n">Stop colour</span><label class="gm-swatch" style="--c:'+st[gmSel][1]+'"><input type="color" data-gm-color value="'+st[gmSel][1]+'"></label><span class="gm-hex">'+st[gmSel][1].toUpperCase()+' · '+Math.round(st[gmSel][0]*100)+'%</span>'
      +(st.length>2?'<button class="gm-del" data-gm-del title="Remove this stop">Remove</button>':'')+'</div>'
      +'<div class="lr-row wb"><span class="lr-n">Blend</span><select class="lr-sel sm" data-gm-mode>'+GM_MODES.map(function(m){ return '<option value="'+m[0]+'"'+(m[0]===mode?' selected':'')+'>'+m[1]+'</option>'; }).join("")+'</select></div>'
      +'<div class="lr-row'+(op?' touched':'')+'"><span class="lr-n">Opacity</span><input type="range" data-gm-op min="0" max="100" value="'+op+'"><span class="lr-v" data-gm-opv>'+op+'</span></div>'
      +'<p class="lr-note">Double-click a stop for its colour, double-click the bar for a new stop, right-click a stop to remove it. Soft light at 20 to 40 is the classic: it colours the shadows and the lights without flattening the photograph.</p>';
    if(typeof cvFillAll==="function") cvFillAll(); }
  function gmSync(){ if($("lrGmap")) gmRender(); }
  function gmCommit(){ queueRender(); }
  var gmTap=0, gmTapI=-1, gmPop=null, gmPopDrag=null;
  // ---- the stop's colour picker: a small popover under the stop (saturation/value square, hue strip, hex), ours rather than
  // the browser's dialog so it matches the panel and works inside any frame.
  function gmHexHsv(hex){ var n=parseInt(hex.slice(1),16), r=((n>>16)&255)/255, g=((n>>8)&255)/255, b=(n&255)/255, v=Math.max(r,g,b), d=v-Math.min(r,g,b), s=v?d/v:0, h=0;
    if(d){ h=v===r?((g-b)/d)%6:v===g?(b-r)/d+2:(r-g)/d+4; h=(h*60+360)%360; } return [h,s,v]; }
  function gmHsvHex(h,s,v){ var c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c, o=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return "#"+o.map(function(q){ return ("0"+Math.round((q+m)*255).toString(16)).slice(-2); }).join(""); }
  function gmClosePicker(){ if(gmPop&&gmPop.parentNode) gmPop.parentNode.removeChild(gmPop); gmPop=null; gmPopDrag=null; }
  function gmApplyColour(hex,fromInput){ var el=$("lrGmap"), st=gmStops(); if(!el||!st[gmSel]) return; st[gmSel][1]=hex;
    var sw=el.querySelector(".gm-swatch"), inp=el.querySelector("[data-gm-color]"), sp=el.querySelector('[data-gm-stop="'+gmSel+'"]'), rp=el.querySelector(".gm-ramp"), hx=el.querySelector(".gm-hex");
    if(sw) sw.style.setProperty("--c",hex); if(inp) inp.value=hex; if(sp) sp.style.setProperty("--c",hex); if(rp) rp.style.background=gmCss(st); if(hx) hx.textContent=hex.toUpperCase()+" · "+Math.round(st[gmSel][0]*100)+"%";
    if(gmPop){ var chip=gmPop.querySelector(".gm-chip"), hin=gmPop.querySelector(".gm-hexin"); if(chip) chip.style.background=hex; if(hin&&!fromInput) hin.value=hex.toUpperCase(); } gmCommit(); }
  function gmPopPaint(){ if(!gmPop) return; var h=gmPop._h, s=gmPop._s, v=gmPop._v, sv=gmPop.querySelector(".gm-sv"), hs=gmPop.querySelector(".gm-hue");
    sv.style.background="linear-gradient(180deg,rgba(0,0,0,0),#000),linear-gradient(90deg,#fff,"+gmHsvHex(h,1,1)+")"; sv.firstChild.style.left=(s*100)+"%"; sv.firstChild.style.top=((1-v)*100)+"%"; hs.firstChild.style.left=(h/360*100)+"%"; }
  function gmOpenPicker(){ var el=$("lrGmap"), st=gmStops(); if(!el||!st[gmSel]) return; gmClosePicker(); var bar=el.querySelector("[data-gm-bar]"); if(!bar) return;
    var hsv=gmHexHsv(st[gmSel][1]), pop=document.createElement("div"); pop.className="gm-pop"; pop._h=hsv[0]; pop._s=hsv[1]; pop._v=hsv[2];
    pop.innerHTML='<div class="gm-sv" data-gm-sv><i></i></div><div class="gm-hue" data-gm-hue><i></i></div><div class="gm-pop-r"><span class="gm-chip" style="background:'+st[gmSel][1]+'"></span><input class="gm-hexin" data-gm-hexin maxlength="7" spellcheck="false" autocomplete="off" value="'+st[gmSel][1].toUpperCase()+'"><button type="button" class="gm-pop-x" data-gm-popx aria-label="Close">Done</button></div>';
    bar.appendChild(pop); gmPop=pop; var bw=bar.clientWidth, pw=pop.offsetWidth||216, x=st[gmSel][0]*bw-pw/2; pop.style.left=Math.max(0,Math.min(bw-pw,x))+"px"; gmPopPaint(); }
  function gmPopSet(e){ var d=gmPopDrag, r=d.el.getBoundingClientRect(), fx=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)), fy=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
    if(d.kind==="hue") gmPop._h=fx*359.99; else { gmPop._s=fx; gmPop._v=1-fy; } gmPopPaint(); gmApplyColour(gmHsvHex(gmPop._h,gmPop._s,gmPop._v)); }
  (function gmWire(){ var el=$("lrGmap"); if(!el) return;
    el.addEventListener("click",function(e){ if(!edState) return; var b=e.target.closest("[data-gm-preset],[data-gm-stop],[data-gm-del]"); if(!b) return;
      if(b.hasAttribute("data-gm-preset")){ edState.gmStops=JSON.parse(JSON.stringify(GM_PRESETS[+b.getAttribute("data-gm-preset")][1])); if(!edState.gmOpacity) edState.gmOpacity=30; gmSel=0; gmRender(); gmCommit(); edPushHist(); return; }
      if(b.hasAttribute("data-gm-del")){ var st=gmStops(); if(st.length>2){ st.splice(gmSel,1); gmSel=Math.max(0,gmSel-1); gmRender(); gmCommit(); edPushHist(); } return; }
      if(b.hasAttribute("data-gm-stop")&&!gmDrag){ gmSelect(+b.getAttribute("data-gm-stop")); } });
    // select a stop in place: swap classes and the colour row, no rebuild, so the stop button survives for a double-click
    function gmSelect(i){ var st=gmStops(); if(i<0||i>=st.length) return; gmSel=i; el.querySelectorAll("[data-gm-stop]").forEach(function(n){ n.classList.toggle("sel",+n.getAttribute("data-gm-stop")===i); });
      var sw=el.querySelector(".gm-swatch"), inp=el.querySelector("[data-gm-color]"), hx=el.querySelector(".gm-hex"); if(sw) sw.style.setProperty("--c",st[i][1]); if(inp) inp.value=st[i][1]; if(hx) hx.textContent=st[i][1].toUpperCase()+" · "+Math.round(st[i][0]*100)+"%"; if(gmPop) gmOpenPicker(); }
    el.addEventListener("dblclick",function(e){ if(!edState) return; var s=e.target.closest("[data-gm-stop]"), bar=e.target.closest("[data-gm-bar]");
      if(s){ gmSelect(+s.getAttribute("data-gm-stop")); gmOpenPicker(); return; }
      if(bar){ var r=bar.getBoundingClientRect(), x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)), st2=gmStops(), S=st2.slice().sort(function(a,b){ return a[0]-b[0]; }), j=0; while(j<S.length-2&&x>S[j+1][0]) j++;
        var a=S[j], b2=S[j+1], t=(x-a[0])/Math.max(b2[0]-a[0],1e-6), hx=function(c){ var n=parseInt(c.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }, A=hx(a[1]), B=hx(b2[1]), C=A.map(function(v,k){ return Math.round(v+(B[k]-v)*t); });
        st2.push([+x.toFixed(3),"#"+C.map(function(v){ return ("0"+v.toString(16)).slice(-2); }).join("")]); gmSel=st2.length-1; gmRender(); gmCommit(); edPushHist(); } });
    el.addEventListener("input",function(e){ if(!edState) return; var t=e.target;
      if(t.hasAttribute("data-gm-color")){ gmApplyColour(t.value); return; }
      if(t.hasAttribute("data-gm-hexin")){ var hv=t.value.trim(); if(hv[0]!=="#") hv="#"+hv; if(/^#[0-9a-fA-F]{6}$/.test(hv)){ var hs=gmHexHsv(hv.toLowerCase()); if(gmPop){ gmPop._h=hs[0]; gmPop._s=hs[1]; gmPop._v=hs[2]; gmPopPaint(); } gmApplyColour(hv.toLowerCase(),true); } return; }
      if(t.hasAttribute("data-gm-op")){ edState.gmOpacity=+t.value; var o=el.querySelector("[data-gm-opv]"); if(o) o.textContent=t.value; gmCommit(); } });
    el.addEventListener("change",function(e){ if(!edState) return; var t=e.target; if(t.hasAttribute("data-gm-mode")){ edState.gmMode=t.value; gmCommit(); edPushHist(); } else if(t.hasAttribute("data-gm-color")||t.hasAttribute("data-gm-op")||t.hasAttribute("data-gm-hexin")) edPushHist(); });
    // the swatch in the colour row opens our picker too (the hidden native input stays for keyboard users)
    el.addEventListener("click",function(e){ var sw=e.target.closest(".gm-swatch"); if(sw&&edState){ e.preventDefault(); gmOpenPicker(); } if(e.target.closest("[data-gm-popx]")) gmClosePicker(); });
    // picker drags: square sets saturation and value, strip sets hue
    el.addEventListener("pointerdown",function(e){ if(!gmPop||e.button!==0) return; var sv=e.target.closest("[data-gm-sv]"), hu=e.target.closest("[data-gm-hue]"); if(!sv&&!hu) return; e.preventDefault(); e.stopPropagation();
      gmPopDrag={el:sv||hu,kind:sv?"sv":"hue"}; try{ gmPopDrag.el.setPointerCapture(e.pointerId); }catch(er){} gmPopSet(e); });
    el.addEventListener("pointermove",function(e){ if(gmPopDrag) gmPopSet(e); });
    var popUp=function(){ if(!gmPopDrag) return; gmPopDrag=null; edPushHist(); }; el.addEventListener("pointerup",popUp); el.addEventListener("pointercancel",popUp);
    document.addEventListener("pointerdown",function(e){ if(gmPop&&!e.target.closest(".gm-pop")&&!e.target.closest("[data-gm-stop]")&&!e.target.closest(".gm-swatch")) gmClosePicker(); },true);
    document.addEventListener("keydown",function(e){ if(gmPop&&e.key==="Escape"){ gmClosePicker(); e.stopPropagation(); } },true);
    el.addEventListener("contextmenu",function(e){ var s=e.target.closest("[data-gm-stop]"); if(!s||!edState) return; e.preventDefault(); var st=gmStops(), i=+s.getAttribute("data-gm-stop"); if(st.length>2){ st.splice(i,1); gmSel=Math.max(0,i-1); gmRender(); gmCommit(); edPushHist(); } });
    // drag a stop along the bar
    el.addEventListener("pointerdown",function(e){ var s=e.target.closest("[data-gm-stop]"); if(!s||!edState||e.button!==0||e.target.closest(".gm-pop")) return; var bar=s.closest("[data-gm-bar]"); var i=+s.getAttribute("data-gm-stop"), now=Date.now(); gmSelect(i);
      if(gmTapI===i&&now-gmTap<450){ gmTap=0; gmTapI=-1; e.preventDefault(); gmOpenPicker(); return; } gmTap=now; gmTapI=i;
      gmDrag={i:i,bar:bar,moved:false,x0:e.clientX}; try{ s.setPointerCapture(e.pointerId); }catch(er){} });
    el.addEventListener("pointermove",function(e){ if(!gmDrag) return; var r=gmDrag.bar.getBoundingClientRect(), x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); if(!gmDrag.moved&&Math.abs(e.clientX-gmDrag.x0)<3) return; gmDrag.moved=true;
      var st=gmStops(); st[gmDrag.i][0]=+x.toFixed(3); var sp=el.querySelector('[data-gm-stop="'+gmDrag.i+'"]'), rp=el.querySelector(".gm-ramp"), hx=el.querySelector(".gm-hex"); if(sp) sp.style.left=(x*100).toFixed(2)+"%"; if(rp) rp.style.background=gmCss(st); if(hx) hx.textContent=st[gmDrag.i][1].toUpperCase()+" · "+Math.round(x*100)+"%"; gmCommit(); });
    var up=function(){ if(!gmDrag) return; var mv=gmDrag.moved; gmDrag=null; if(mv){ gmRender(); edPushHist(); } }; el.addEventListener("pointerup",up); el.addEventListener("pointercancel",up); })();
