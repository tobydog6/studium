  // ================= TONE CURVE panel, section resets, and the slider fill =================
  // The engine (crdev.js) already runs a point curve for RGB and each channel plus a parametric curve; this is the
  // panel in front of it. Point mode: an SVG box with the histogram behind, click to add a point, drag to shape,
  // double-click or right-click a point to remove it, the ends slide up and down. Parametric mode: four region sliders.
  // Also here, because they belong to the whole panel: a reset arrow on every section header, and the fill from the
  // centre on every slider (--lo/--hi on the input), with a .touched class on rows that have been moved.
  var cvMode="point", cvCh="M", cvSel=-1, cvDrag=null, cvHover=null;
  var CV_CH=[["M","RGB"],["R","R"],["G","G"],["B","B"]], CV_KEY={M:"cvM",R:"cvR",G:"cvG",B:"cvB"};
  var CV_PRESETS={linear:[[0,0],[255,255]], medium:[[0,0],[64,56],[128,128],[192,200],[255,255]], strong:[[0,0],[64,46],[128,128],[192,210],[255,255]]};
  var CV_PARAM=[["cvHi","Highlights"],["cvLi","Lights"],["cvDa","Darks"],["cvSh","Shadows"]];
  function cvPts(){ if(!edState) return CV_PRESETS.linear; var k=CV_KEY[cvCh]; if(!edState[k]||edState[k].length<2) edState[k]=[[0,0],[255,255]]; return edState[k]; }
  function cvClamp(v,a,b){ return v<a?a:v>b?b:v; }
  // the same monotone cubic the engine uses, so the line is the pixels
  function cvEval(pts,x){ var p=pts.slice().sort(function(a,b){ return a[0]-b[0]; }), m=p.length; if(m<2) return x;
    if(x<=p[0][0]) return p[0][1]; if(x>=p[m-1][0]) return p[m-1][1];
    var d=[],t=new Array(m).fill(0),k; for(k=0;k<m-1;k++) d.push((p[k+1][1]-p[k][1])/Math.max(p[k+1][0]-p[k][0],1e-6));
    t[0]=d[0]; t[m-1]=d[m-2]; for(k=1;k<m-1;k++) t[k]=d[k-1]*d[k]<=0?0:(d[k-1]+d[k])/2;
    for(k=0;k<m-1;k++){ if(d[k]===0){ t[k]=0; t[k+1]=0; continue; } var a=t[k]/d[k], b=t[k+1]/d[k], s=a*a+b*b; if(s>9){ var tau=3/Math.sqrt(s); t[k]=tau*a*d[k]; t[k+1]=tau*b*d[k]; } }
    var j=0; while(j<m-2&&x>p[j+1][0]) j++; var hh=p[j+1][0]-p[j][0], u=(x-p[j][0])/hh;
    return cvClamp((2*u*u*u-3*u*u+1)*p[j][1]+(u*u*u-2*u*u+u)*hh*t[j]+(-2*u*u*u+3*u*u)*p[j+1][1]+(u*u*u-u*u)*hh*t[j+1],0,255); }
  function cvHist(){ var L=crv&&crv.last; if(!L) return null; var H=new Float64Array(64), buf=L.data, need=L.w*L.h*4, step=Math.max(1,(L.w*L.h/20000)|0)*4, c=cvCh==="R"?0:cvCh==="G"?1:cvCh==="B"?2:-1;
    for(var i=0;i+2<need;i+=step){ var v=c<0?(buf[i]*0.299+buf[i+1]*0.587+buf[i+2]*0.114):buf[i+c]; H[(v>>2)&63]++; }
    var mx=1; for(var k=0;k<64;k++) if(H[k]>mx) mx=H[k]; var d="M0 256"; for(k=0;k<64;k++){ d+=" L"+(k/63*256).toFixed(1)+" "+(256-Math.pow(H[k]/mx,0.6)*236).toFixed(1); } return d+" L256 256 Z"; }
  function cvPath(pts){ var d=""; for(var i=0;i<=64;i++){ var x=i*4, y=cvEval(pts,x); d+=(i?" L":"M")+x+" "+(256-y).toFixed(2); } return d; }
  function cvRender(){ var el=$("lrCurve"); if(!el) return; var pts=cvPts(), hist=cvHist(), on=edState&&edState.secCurve!==0, ch=CV_CH.filter(function(c){ return c[0]===cvCh; })[0];
    var h='<div class="cv-tabs"><button data-cv-mode="param"'+(cvMode==="param"?' class="on"':'')+'>Parametric</button><button data-cv-mode="point"'+(cvMode==="point"?' class="on"':'')+'>Point</button>'
      +(cvMode==="point"?'<span class="cv-ch">'+CV_CH.map(function(c){ return '<button data-cv-ch="'+c[0]+'" class="c'+c[0]+(c[0]===cvCh?' on':'')+'">'+c[1]+'</button>'; }).join("")+'</span>':'')+'</div>';
    if(cvMode==="point"){ var col=cvCh==="R"?"#e0574a":cvCh==="G"?"#5bbf6a":cvCh==="B"?"#5a8cf0":"#f4f1ea";
      h+='<svg class="cv-box" viewBox="0 0 256 256" preserveAspectRatio="none" data-cv-box>'
        +'<rect x="0" y="0" width="256" height="256" class="bg"/>'
        +(hist?'<path class="hist" d="'+hist+'"/>':'')
        +'<path class="grid" d="M64 0V256M128 0V256M192 0V256M0 64H256M0 128H256M0 192H256"/><path class="diag" d="M0 256L256 0"/>'
        +'<path class="line" d="'+cvPath(pts)+'" style="stroke:'+col+'"/>'
        +pts.map(function(p,i){ return '<circle class="pt'+(i===cvSel?' sel':'')+'" data-cv-pt="'+i+'" cx="'+p[0]+'" cy="'+(256-p[1])+'" r="5"/>'; }).join("")+'</svg>'
        +'<div class="cv-read"><span>Input <b data-cv-in>–</b></span><span>Output <b data-cv-out>–</b></span><span class="cv-hint">Click to add · drag to shape · double-click to remove</span></div>'
        +'<div class="lr-row cv-preset"><span class="lr-n">Point curve</span><select class="lr-sel" data-cv-preset><option value="custom">Custom</option><option value="linear">Linear</option><option value="medium">Medium contrast</option><option value="strong">Strong contrast</option></select></div>'; }
    else { h+='<svg class="cv-box small" viewBox="0 0 256 256" preserveAspectRatio="none"><rect x="0" y="0" width="256" height="256" class="bg"/>'+(hist?'<path class="hist" d="'+hist+'"/>':'')+'<path class="grid" d="M64 0V256M128 0V256M192 0V256M0 64H256M0 128H256M0 192H256"/><path class="diag" d="M0 256L256 0"/><path class="line" d="'+cvParamPath()+'"/></svg>'
        +CV_PARAM.map(function(r){ var v=edState?(edState[r[0]]||0):0; return '<div class="lr-row'+(v?' touched':'')+'"><span class="lr-n">'+r[1]+'</span><input type="range" data-cv="'+r[0]+'" min="-100" max="100" value="'+v+'"><span class="lr-v" data-cvv="'+r[0]+'">'+v+'</span></div>'; }).join(""); }
    el.innerHTML=h; var sel=el.querySelector("[data-cv-preset]"); if(sel) sel.value=cvPresetOf(pts); cvFillAll(); }
  // the parametric curve as the engine draws it (crdev.js parametricLut), for the small preview
  function cvParamPath(){ var E=edState||{}, sp=[0.25,0.5,0.75], cen=[sp[0]/2,(sp[0]+sp[1])/2,(sp[1]+sp[2])/2,(sp[2]+1)/2], am=[E.cvSh||0,E.cvDa||0,E.cvLi||0,E.cvHi||0], wd=[0.25,0.25,0.25,0.25], d="";
    for(var i=0;i<=64;i++){ var x=i/64, y=x; for(var k=0;k<4;k++){ var q=(x-cen[k])/(wd[k]*1.2); y+=am[k]/100*0.25*Math.exp(-q*q*2)*x*(1-x)*4; } y=cvClamp(y,0,1); d+=(i?" L":"M")+(x*256).toFixed(1)+" "+(256-y*256).toFixed(1); } return d; }
  function cvPresetOf(pts){ var s=JSON.stringify(pts); for(var k in CV_PRESETS) if(JSON.stringify(CV_PRESETS[k])===s) return k; return "custom"; }
  function cvSync(){ if(!$("lrCurve")) return; cvRender(); }
  function cvCommit(){ queueRender(); }
  function cvSvgPoint(svg,e){ var r=svg.getBoundingClientRect(); return [cvClamp((e.clientX-r.left)/r.width*256,0,255), cvClamp(256-(e.clientY-r.top)/r.height*256,0,255)]; }
  function cvReadout(x,y){ var a=document.querySelector("[data-cv-in]"), b=document.querySelector("[data-cv-out]"); if(a) a.textContent=x==null?"–":Math.round(x); if(b) b.textContent=y==null?"–":Math.round(y); }
  (function cvWire(){ var el=$("lrCurve"); if(!el) return;
    el.addEventListener("click",function(e){ var b=e.target.closest("[data-cv-mode],[data-cv-ch]"); if(!b) return;
      if(b.hasAttribute("data-cv-mode")) cvMode=b.getAttribute("data-cv-mode"); else cvCh=b.getAttribute("data-cv-ch"); cvSel=-1; cvRender(); });
    el.addEventListener("change",function(e){ var s=e.target.closest&&e.target.closest("[data-cv-preset]"); if(s&&edState){ var v=s.value; if(CV_PRESETS[v]){ edState[CV_KEY[cvCh]]=JSON.parse(JSON.stringify(CV_PRESETS[v])); cvSel=-1; cvRender(); cvCommit(); edPushHist(); } return; }
      if(e.target.getAttribute&&e.target.getAttribute("data-cv")) edPushHist(); });
    el.addEventListener("input",function(e){ var k=e.target.getAttribute&&e.target.getAttribute("data-cv"); if(!k||!edState) return; edState[k]=+e.target.value; var o=el.querySelector('[data-cvv="'+k+'"]'); if(o) o.textContent=Math.round(edState[k]);
      var ln=el.querySelector(".cv-box .line"); if(ln) ln.setAttribute("d",cvParamPath()); cvCommit(); });
    el.addEventListener("dblclick",function(e){ var k=e.target.getAttribute&&e.target.getAttribute("data-cv"); if(k&&edState){ edState[k]=0; cvRender(); cvCommit(); edPushHist(); return; }
      var c=e.target.closest&&e.target.closest("[data-cv-pt]"); if(c&&edState){ var i=+c.getAttribute("data-cv-pt"), pts=cvPts(); if(i>0&&i<pts.length-1){ pts.splice(i,1); cvSel=-1; cvRender(); cvCommit(); edPushHist(); } } });
    el.addEventListener("contextmenu",function(e){ var c=e.target.closest&&e.target.closest("[data-cv-pt]"); if(!c) return; e.preventDefault(); var i=+c.getAttribute("data-cv-pt"), pts=cvPts(); if(i>0&&i<pts.length-1){ pts.splice(i,1); cvSel=-1; cvRender(); cvCommit(); edPushHist(); } });
    el.addEventListener("pointerdown",function(e){ var svg=e.target.closest&&e.target.closest("[data-cv-box]"); if(!svg||!edState||e.button!==0) return; e.preventDefault(); var pts=cvPts(), q=cvSvgPoint(svg,e), i=-1, best=12;
      pts.forEach(function(p,j){ var d=Math.hypot(p[0]-q[0],p[1]-q[1]); if(d<best){ best=d; i=j; } });
      if(i<0){ pts.push([Math.round(q[0]),Math.round(cvEval(pts,q[0]))]); pts.sort(function(a,b){ return a[0]-b[0]; }); i=pts.findIndex(function(p){ return p[0]===Math.round(q[0]); }); }
      cvSel=i; cvDrag={svg:svg,i:i}; try{ svg.setPointerCapture(e.pointerId); }catch(er){} cvRender(); });
    el.addEventListener("pointermove",function(e){ var svg=e.target.closest&&e.target.closest("[data-cv-box]"); if(!svg) return; var q=cvSvgPoint(svg,e);
      if(!cvDrag){ cvReadout(q[0],cvEval(cvPts(),q[0])); return; }
      var pts=cvPts(), i=cvDrag.i, p=pts[i], lo=i===0?0:pts[i-1][0]+1, hi=i===pts.length-1?255:pts[i+1][0]-1;
      p[0]=i===0?0:i===pts.length-1?255:Math.round(cvClamp(q[0],lo,hi)); p[1]=Math.round(q[1]);
      var ln=svg.querySelector(".line"); if(ln) ln.setAttribute("d",cvPath(pts)); var c=svg.querySelector('[data-cv-pt="'+i+'"]'); if(c){ c.setAttribute("cx",p[0]); c.setAttribute("cy",256-p[1]); }
      cvReadout(p[0],p[1]); var sel=el.querySelector("[data-cv-preset]"); if(sel) sel.value="custom"; cvCommit(); });
    var up=function(){ if(cvDrag){ cvDrag=null; edPushHist(); } }; el.addEventListener("pointerup",up); el.addEventListener("pointercancel",up);
    el.addEventListener("pointerleave",function(){ if(!cvDrag) cvReadout(null,null); }); })();

  // ---- a reset arrow on every section header: back to the defaults for just that section ----
  var ED_SECKEYS={light:["exposure","contrast","highlights","shadows","whites","blacks"], color:["temp","tint","vibrance","saturation","wb"], effects:["texture","clarity","dehaze","vignette","grain","grainSize","grainRough","glow","halation","halSpread","halThresh","halHue"],
    film:["film","filmBlend","skinBias","fade"], curve:["cvM","cvR","cvG","cvB","cvHi","cvLi","cvDa","cvSh"], mixer:[], grading:["gBlend","gBal"]};
  (function(){ for(var i=0;i<8;i++){ ED_SECKEYS.mixer.push("hH"+i,"hS"+i,"hL"+i); } ["gSh","gMi","gHi","gGl"].forEach(function(w){ ED_SECKEYS.grading.push(w+"H",w+"S",w+"L"); }); })();
  function edSectionReset(name){ if(!edState) return; (ED_SECKEYS[name]||[]).forEach(function(k){ edState[k]=Array.isArray(EDEF[k])?JSON.parse(JSON.stringify(EDEF[k])):EDEF[k]; });
    if(name==="mixer"&&typeof edpMixer==="function") edpMixer(); if(name==="grading"&&typeof edpGrade==="function") edpGrade(); syncEditUI(); queueRender(); edPushHist(); }
  (function wireSectionResets(){ Array.prototype.forEach.call(document.querySelectorAll("#editor .lr-sec"),function(sec){ var hd=sec.querySelector(".lr-sechdr"), eye=sec.querySelector(".lr-eye"); if(!hd||hd.querySelector(".lr-reset")) return;
      var b=document.createElement("button"); b.className="lr-reset"; b.type="button"; b.title="Reset this section"; b.setAttribute("aria-label","Reset this section"); b.innerHTML='<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3.2 6.5A5.2 5.2 0 1 1 3 9.8"/><path d="M2.6 3.4v3.3h3.3"/></svg>';
      b.addEventListener("click",function(ev){ ev.stopPropagation(); edSectionReset(sec.getAttribute("data-sec")); }); hd.insertBefore(b, eye||null); }); })();

  // ---- the fill from the centre on every slider, and .touched on moved rows ----
  function cvFill(r){ var mn=+r.min||0, mx=+r.max||100, v=+r.value, p=(v-mn)/(mx-mn)*100, z=mn<0?50:0, lo=Math.min(p,z), hi=Math.max(p,z);
    r.style.setProperty("--lo",lo.toFixed(2)+"%"); r.style.setProperty("--hi",hi.toFixed(2)+"%"); var row=r.closest(".lr-row"); if(row) row.classList.toggle("touched", Math.abs(p-z)>0.5); }
  function cvFillAll(){ Array.prototype.forEach.call(document.querySelectorAll("#editor input[type=range]"), cvFill); }
  (function wireFill(){ var ed=$("editor"); if(!ed) return; ed.addEventListener("input",function(e){ if(e.target&&e.target.type==="range") cvFill(e.target); },true);
    var base=syncEditUI; syncEditUI=function(){ base.apply(this,arguments); cvFillAll(); }; })();
