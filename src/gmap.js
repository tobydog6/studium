  // ================= GRADIENT MAP panel =================
  // Photoshop's gradient map the way Sam uses it: a ramp of colours, the photograph's luminance picks a colour off it,
  // and the result is blended over, Soft Light by default, at an opacity. The ramp: click a stop to pick its colour,
  // drag it along, double-click the bar to add a stop, double-click a stop to remove it (two always stay). Presets
  // are just ramps. Stored on the frame as gmStops [[position, hex], …], gmMode and gmOpacity (0 = off).
  var GM_PRESETS=[["Teal & orange",[[0,"#1c2b4a"],[0.5,"#8a6a56"],[1,"#f1c27a"]]],["Sepia",[[0,"#2b1d12"],[1,"#e8d2a6"]]],["Cyanotype",[[0,"#0b1f3a"],[1,"#dfe9ee"]]],
    ["Dusk",[[0,"#2a1a3e"],[0.55,"#b2496a"],[1,"#f7c27c"]]],["Forest",[[0,"#101d14"],[0.6,"#4f6b3a"],[1,"#e9e2b9"]]],["Silver",[[0,"#000000"],[1,"#ffffff"]]]];
  var GM_MODES=[["softlight","Soft light"],["overlay","Overlay"],["color","Color"],["multiply","Multiply"],["screen","Screen"],["normal","Normal"]];
  var gmSel=0, gmDrag=null;
  function gmStops(){ if(!edState) return GM_PRESETS[0][1]; if(!edState.gmStops||edState.gmStops.length<2) edState.gmStops=JSON.parse(JSON.stringify(GM_PRESETS[0][1])); return edState.gmStops; }
  function gmCss(st){ return "linear-gradient(90deg,"+st.slice().sort(function(a,b){ return a[0]-b[0]; }).map(function(s){ return s[1]+" "+(s[0]*100).toFixed(1)+"%"; }).join(",")+")"; }
  function gmPresetOf(st){ var s=JSON.stringify(st); for(var i=0;i<GM_PRESETS.length;i++) if(JSON.stringify(GM_PRESETS[i][1])===s) return i; return -1; }
  function gmRender(){ var el=$("lrGmap"); if(!el) return; var st=gmStops(), op=edState?(edState.gmOpacity||0):0, mode=edState?(edState.gmMode||"softlight"):"softlight", cur=gmPresetOf(st);
    if(gmSel>=st.length) gmSel=st.length-1;
    el.innerHTML='<div class="gm-presets">'+GM_PRESETS.map(function(p,i){ return '<button data-gm-preset="'+i+'" class="'+(i===cur?'on':'')+'" title="'+p[0]+'"><i style="background:'+gmCss(p[1])+'"></i><span>'+p[0]+'</span></button>'; }).join("")+'</div>'
      +'<div class="gm-bar" data-gm-bar><div class="gm-ramp" style="background:'+gmCss(st)+'"></div>'
      +st.map(function(s,i){ return '<button class="gm-stop'+(i===gmSel?' sel':'')+'" data-gm-stop="'+i+'" style="left:'+(s[0]*100).toFixed(2)+'%;--c:'+s[1]+'" aria-label="Stop '+(i+1)+'"></button>'; }).join("")+'</div>'
      +'<div class="lr-row gm-pick"><span class="lr-n">Stop colour</span><label class="gm-swatch" style="--c:'+st[gmSel][1]+'"><input type="color" data-gm-color value="'+st[gmSel][1]+'"></label><span class="gm-hex">'+st[gmSel][1].toUpperCase()+' · '+Math.round(st[gmSel][0]*100)+'%</span>'
      +(st.length>2?'<button class="gm-del" data-gm-del title="Remove this stop">Remove</button>':'')+'</div>'
      +'<div class="lr-row wb"><span class="lr-n">Blend</span><select class="lr-sel sm" data-gm-mode>'+GM_MODES.map(function(m){ return '<option value="'+m[0]+'"'+(m[0]===mode?' selected':'')+'>'+m[1]+'</option>'; }).join("")+'</select></div>'
      +'<div class="lr-row'+(op?' touched':'')+'"><span class="lr-n">Opacity</span><input type="range" data-gm-op min="0" max="100" value="'+op+'"><span class="lr-v" data-gm-opv>'+op+'</span></div>'
      +'<p class="lr-note">Double-click the bar for a new stop. Soft light at 20 to 40 is the classic: it colours the shadows and the lights without flattening the photograph.</p>';
    if(typeof cvFillAll==="function") cvFillAll(); }
  function gmSync(){ if($("lrGmap")) gmRender(); }
  function gmCommit(){ queueRender(); }
  (function gmWire(){ var el=$("lrGmap"); if(!el) return;
    el.addEventListener("click",function(e){ if(!edState) return; var b=e.target.closest("[data-gm-preset],[data-gm-stop],[data-gm-del]"); if(!b) return;
      if(b.hasAttribute("data-gm-preset")){ edState.gmStops=JSON.parse(JSON.stringify(GM_PRESETS[+b.getAttribute("data-gm-preset")][1])); if(!edState.gmOpacity) edState.gmOpacity=30; gmSel=0; gmRender(); gmCommit(); edPushHist(); return; }
      if(b.hasAttribute("data-gm-del")){ var st=gmStops(); if(st.length>2){ st.splice(gmSel,1); gmSel=Math.max(0,gmSel-1); gmRender(); gmCommit(); edPushHist(); } return; }
      if(b.hasAttribute("data-gm-stop")&&!gmDrag){ gmSel=+b.getAttribute("data-gm-stop"); gmRender(); } });
    el.addEventListener("dblclick",function(e){ if(!edState) return; var s=e.target.closest("[data-gm-stop]"), bar=e.target.closest("[data-gm-bar]");
      if(s){ var st=gmStops(), i=+s.getAttribute("data-gm-stop"); if(st.length>2){ st.splice(i,1); gmSel=Math.max(0,i-1); gmRender(); gmCommit(); edPushHist(); } return; }
      if(bar){ var r=bar.getBoundingClientRect(), x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)), st2=gmStops(), S=st2.slice().sort(function(a,b){ return a[0]-b[0]; }), j=0; while(j<S.length-2&&x>S[j+1][0]) j++;
        var a=S[j], b2=S[j+1], t=(x-a[0])/Math.max(b2[0]-a[0],1e-6), hx=function(c){ var n=parseInt(c.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }, A=hx(a[1]), B=hx(b2[1]), C=A.map(function(v,k){ return Math.round(v+(B[k]-v)*t); });
        st2.push([+x.toFixed(3),"#"+C.map(function(v){ return ("0"+v.toString(16)).slice(-2); }).join("")]); gmSel=st2.length-1; gmRender(); gmCommit(); edPushHist(); } });
    el.addEventListener("input",function(e){ if(!edState) return; var t=e.target;
      if(t.hasAttribute("data-gm-color")){ gmStops()[gmSel][1]=t.value; var sw=el.querySelector(".gm-swatch"), sp=el.querySelector('[data-gm-stop="'+gmSel+'"]'), rp=el.querySelector(".gm-ramp"), hx=el.querySelector(".gm-hex"); if(sw) sw.style.setProperty("--c",t.value); if(sp) sp.style.setProperty("--c",t.value); if(rp) rp.style.background=gmCss(gmStops()); if(hx) hx.textContent=t.value.toUpperCase()+" · "+Math.round(gmStops()[gmSel][0]*100)+"%"; gmCommit(); return; }
      if(t.hasAttribute("data-gm-op")){ edState.gmOpacity=+t.value; var o=el.querySelector("[data-gm-opv]"); if(o) o.textContent=t.value; gmCommit(); } });
    el.addEventListener("change",function(e){ if(!edState) return; var t=e.target; if(t.hasAttribute("data-gm-mode")){ edState.gmMode=t.value; gmCommit(); edPushHist(); } else if(t.hasAttribute("data-gm-color")||t.hasAttribute("data-gm-op")) edPushHist(); });
    // drag a stop along the bar
    el.addEventListener("pointerdown",function(e){ var s=e.target.closest("[data-gm-stop]"); if(!s||!edState||e.button!==0) return; var bar=s.closest("[data-gm-bar]"); gmSel=+s.getAttribute("data-gm-stop"); gmDrag={i:gmSel,bar:bar,moved:false,x0:e.clientX}; try{ s.setPointerCapture(e.pointerId); }catch(er){} });
    el.addEventListener("pointermove",function(e){ if(!gmDrag) return; var r=gmDrag.bar.getBoundingClientRect(), x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); if(!gmDrag.moved&&Math.abs(e.clientX-gmDrag.x0)<3) return; gmDrag.moved=true;
      var st=gmStops(); st[gmDrag.i][0]=+x.toFixed(3); var sp=el.querySelector('[data-gm-stop="'+gmDrag.i+'"]'), rp=el.querySelector(".gm-ramp"), hx=el.querySelector(".gm-hex"); if(sp) sp.style.left=(x*100).toFixed(2)+"%"; if(rp) rp.style.background=gmCss(st); if(hx) hx.textContent=st[gmDrag.i][1].toUpperCase()+" · "+Math.round(x*100)+"%"; gmCommit(); });
    var up=function(){ if(!gmDrag) return; var mv=gmDrag.moved; gmDrag=null; if(mv){ gmRender(); edPushHist(); } else gmRender(); }; el.addEventListener("pointerup",up); el.addEventListener("pointercancel",up); })();
