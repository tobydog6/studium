  // ================= DEVELOP PANELS: Color Mixer and Color Grading =================
  // The two Camera Raw panels after Effects, as in Lightroom and PhotoCraft. The Color Mixer moves the hue, saturation
  // or luminance of one band of colour (the blues of a sky, the greens of the bush) without touching the rest. Color
  // Grading tints the shadows, midtones and highlights separately: drag the dot round a wheel for the colour and out
  // from the middle for how much, with Blending (how much the three overlap) and Balance (where shadows end).
  var MX_BANDS=[["Red",0],["Orange",30],["Yellow",60],["Green",120],["Aqua",180],["Blue",240],["Purple",270],["Magenta",300]];
  var MX_TABS=[["h","Hue","hH"],["s","Saturation","hS"],["l","Luminance","hL"]], mxTab="h";
  var CG_WHEELS=[["sh","Shadows","gSh"],["mi","Midtones","gMi"],["hi","Highlights","gHi"],["gl","Global","gGl"]], cgTab="3";
  function edpHsl(h,s,l){ return "hsl("+Math.round(((h%360)+360)%360)+","+s+"%,"+l+"%)"; }
  function edpTrack(tab,hue){   // each band's slider shows what it does
    if(tab==="h") return "linear-gradient(90deg,"+edpHsl(hue-30,70,52)+","+edpHsl(hue,70,52)+","+edpHsl(hue+30,70,52)+")";
    if(tab==="s") return "linear-gradient(90deg,hsl(0,0%,48%),"+edpHsl(hue,80,50)+")";
    return "linear-gradient(90deg,"+edpHsl(hue,60,14)+","+edpHsl(hue,70,50)+","+edpHsl(hue,70,86)+")"; }
  function edpRow(key,label,min,max,trk){ return '<div class="lr-row"><span class="lr-n">'+label+'</span><input type="range" data-edp="'+key+'" min="'+min+'" max="'+max+'" value="0"'+(trk?' class="trk-var" style="--trk:'+trk+'"':'')+'><span class="lr-v" data-edpv="'+key+'">0</span></div>'; }
  function edpMixer(){ var el=$("lrMixer"); if(!el) return; var T=MX_TABS.filter(function(t){ return t[0]===mxTab; })[0];
    el.innerHTML='<div class="lr-tabs">'+MX_TABS.map(function(t){ return '<button data-mx="'+t[0]+'"'+(t[0]===mxTab?' class="on"':'')+'>'+t[1]+'</button>'; }).join("")+'</div>'
      +MX_BANDS.map(function(b,i){ return edpRow(T[2]+i,b[0],-100,100,edpTrack(mxTab,b[1])); }).join("")
      +'<p class="lr-note">'+(mxTab==="h"?'Shift one colour towards its neighbours: turn the greens more yellow, or the blues more aqua.':mxTab==="s"?'Make one colour richer or quieter, leaving the rest alone.':'Brighten or darken one colour. In black and white this is how much each colour lightens its grey.')+'</p>';
    edpSync(); }
  // a colour wheel: hue round it, saturation out from the middle
  function edpWheel(w,size,noLum){ var k=w[2];
    return '<div class="cg-w" style="--d:'+size+'px"><span class="cg-t">'+w[1]+'</span><div class="cg-disc" data-cg="'+k+'"><i class="cg-dot"></i></div>'
      +'<span class="cg-hs" data-cghs="'+k+'">–</span>'
      +(noLum?'':'<input type="range" class="cg-lum" data-edp="'+k+'L" min="-100" max="100" value="0" title="Luminance (double-click resets)">')+'</div>'; }
  function edpGrade(){ var el=$("lrGrade"); if(!el) return;
    var tabs=[["3","3-way"]].concat(CG_WHEELS.map(function(w){ return [w[0],w[1]]; }));
    var h='<div class="lr-tabs">'+tabs.map(function(t){ return '<button data-cgt="'+t[0]+'"'+(t[0]===cgTab?' class="on"':'')+'>'+t[1]+'</button>'; }).join("")+'</div>';
    if(cgTab==="3"){ var W=function(id){ return CG_WHEELS.filter(function(w){ return w[0]===id; })[0]; };
      h+='<div class="cg-three"><div class="cg-top">'+edpWheel(W("mi"),132)+'</div><div class="cg-pair">'+edpWheel(W("sh"),132)+edpWheel(W("hi"),132)+'</div></div>'; }
    else { var w=CG_WHEELS.filter(function(x){ return x[0]===cgTab; })[0];
      h+='<div class="cg-one">'+edpWheel(w,200,true)+'</div>'+edpRow(w[2]+"H","Hue",0,359,"linear-gradient(90deg,hsl(0,70%,52%),hsl(60,70%,52%),hsl(120,70%,52%),hsl(180,70%,52%),hsl(240,70%,52%),hsl(300,70%,52%),hsl(360,70%,52%))")
        +edpRow(w[2]+"S","Saturation",0,100)+edpRow(w[2]+"L","Luminance",-100,100); }
    h+=edpRow("gBlend","Blending",0,100)+edpRow("gBal","Balance",-100,100);
    el.innerHTML=h; edpSync(); }
  function edpDot(k){ var d=document.querySelector('#lrGrade .cg-disc[data-cg="'+k+'"]'); if(!d||!edState) return; var hue=edState[k+"H"]||0, sat=edState[k+"S"]||0, a=hue*Math.PI/180, r=sat/100*50;
    var dot=d.querySelector(".cg-dot"); dot.style.left=(50+Math.cos(a)*r)+"%"; dot.style.top=(50-Math.sin(a)*r)+"%"; dot.style.background=sat>0?edpHsl(hue,70,55):"#d8d2c6";
    var hs=document.querySelector('#lrGrade [data-cghs="'+k+'"]'); if(hs) hs.textContent=sat>0?"H "+Math.round(hue)+" · S "+Math.round(sat):"–"; }
  // put edState's values on every control in the two panels
  function edpSync(){ if(!edState) return;
    Array.prototype.forEach.call(document.querySelectorAll("#lrMixer [data-edp], #lrGrade [data-edp]"),function(inp){ var k=inp.getAttribute("data-edp"), v=edState[k]==null?EDEF[k]:edState[k]; inp.value=v;
      var o=document.querySelector('[data-edpv="'+k+'"]'); if(o) o.textContent=Math.round(v); });
    CG_WHEELS.forEach(function(w){ edpDot(w[2]); }); }
  function edpSet(k,v){ edState[k]=v; var o=document.querySelector('[data-edpv="'+k+'"]'); if(o) o.textContent=Math.round(v);
    var w=k.slice(0,3); if(/^g(Sh|Mi|Hi|Gl)[HS]$/.test(k)) edpDot(w); queueRender(); }
  (function edpWire(){ var mx=$("lrMixer"), cg=$("lrGrade"); if(!mx||!cg) return; edpMixer(); edpGrade();
    [mx,cg].forEach(function(el){
      el.addEventListener("input",function(e){ var k=e.target.getAttribute&&e.target.getAttribute("data-edp"); if(k&&edState) edpSet(k,+e.target.value); });
      el.addEventListener("change",function(e){ if(e.target.getAttribute&&e.target.getAttribute("data-edp")) edPushHist(); });
      el.addEventListener("dblclick",function(e){ var k=e.target.getAttribute&&e.target.getAttribute("data-edp"); if(k&&edState){ e.target.value=EDEF[k]; edpSet(k,EDEF[k]); edPushHist(); return; }
        var d=e.target.closest&&e.target.closest(".cg-disc"); if(d&&edState){ var g=d.getAttribute("data-cg"); edState[g+"H"]=0; edState[g+"S"]=0; edpSync(); queueRender(); edPushHist(); } }); });
    mx.addEventListener("click",function(e){ var b=e.target.closest("[data-mx]"); if(b){ mxTab=b.getAttribute("data-mx"); edpMixer(); } });
    cg.addEventListener("click",function(e){ var b=e.target.closest("[data-cgt]"); if(b){ cgTab=b.getAttribute("data-cgt"); edpGrade(); } });
    // drag on a wheel: angle is the hue, distance from the middle the saturation (Shift keeps the hue, for just more or less)
    var drag=null;
    function at(e){ var r=drag.d.getBoundingClientRect(), dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height/2), R=r.width/2;
      var sat=Math.min(100,Math.hypot(dx,dy)/R*100), hue=(Math.atan2(-dy,dx)*180/Math.PI+360)%360;
      if(e.shiftKey&&edState[drag.k+"S"]>0) hue=edState[drag.k+"H"];
      edState[drag.k+"H"]=Math.round(hue); edState[drag.k+"S"]=Math.round(sat); edpSync(); queueRender(); }
    cg.addEventListener("pointerdown",function(e){ var d=e.target.closest(".cg-disc"); if(!d||!edState) return; e.preventDefault(); drag={d:d,k:d.getAttribute("data-cg")}; try{ d.setPointerCapture(e.pointerId); }catch(er){} at(e); });
    cg.addEventListener("pointermove",function(e){ if(drag) at(e); });
    var end=function(){ if(drag){ drag=null; edPushHist(); } }; cg.addEventListener("pointerup",end); cg.addEventListener("pointercancel",end); })();
