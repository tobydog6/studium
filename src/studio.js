  // ================= STUDIO (Tab, or Photos on the camera back) =================
  // The darkroom. Rooms in workflow order: Select, Edit, Workshop, Folio, Book, Gallery (Q / E to switch, Esc back
  // to the location). Select, Workshop and Folio are drawn here; Edit, Book and Gallery host the existing develop
  // panel, photobook designer and gallery show under the studio bar until their own restyle.
  var ST_ROOMS=[["select","Select"],["edit","Edit"],["workshop","Workshop"],["folio","Folio"],["book","Book"],["gallery","Gallery"]];
  var st={open:false, room:"select", cur:-1, cols:4, wsPage:0, wsPages:[], foPaper:"white", foPresets:["hero","grid","strip"], foBand:0, foSel:null};

  function stPencil(seed){   // a loose grease-pencil loop on a superellipse, overshooting where it started
    var cx=107, cy=74, a=102, b=69, n=7, N=54, k0=seed*1.7, pts=[];
    for(var i=0;i<=N;i++){ var u=i/N, th=-0.8*Math.PI+u*2*Math.PI*1.13, c=Math.cos(th), s=Math.sin(th);
      var x=(c<0?-1:1)*Math.pow(Math.abs(c),2/n), y=(s<0?-1:1)*Math.pow(Math.abs(s),2/n);
      var w=1.6*Math.sin(u*2*Math.PI*2+k0)+0.9*Math.sin(u*2*Math.PI*5+k0*2)+(u>0.86?(u-0.86)*26:0)-1.2, L=Math.hypot(x*a,y*b)||1;
      pts.push([cx+x*a+(x*a/L)*w, cy+y*b+(y*b/L)*w]); }
    var d="M"+pts[0][0].toFixed(1)+" "+pts[0][1].toFixed(1);
    for(var j=0;j<pts.length-1;j++){ var p0=pts[Math.max(0,j-1)], p1=pts[j], p2=pts[j+1], p3=pts[Math.min(pts.length-1,j+2)];
      d+=" C"+(p1[0]+(p2[0]-p0[0])/6).toFixed(1)+" "+(p1[1]+(p2[1]-p0[1])/6).toFixed(1)+" "+(p2[0]-(p3[0]-p1[0])/6).toFixed(1)+" "+(p2[1]-(p3[1]-p1[1])/6).toFixed(1)+" "+p2[0].toFixed(1)+" "+p2[1].toFixed(1); }
    return d; }
  function stPicks(){ var a=[]; photos.forEach(function(p,i){ if(p.pick) a.push(i); }); return a; }
  function stPlaceOf(p){ return p.place||cbPlace; }

  // ---- open / close / rooms ----
  var ST_LEGACY={edit:"editor", book:"photobook", gallery:"galleryshow"};
  function openStudio(room){ var el=$("studioX"); if(!el) return;
    if(looking){ try{ document.exitPointerLock(); }catch(e){} } if(viewfinderOn) lowerCamera();
    ["hub","studio","gallery","landing","prompt"].forEach(hubHide);
    st.open=true; if(st.cur<0||st.cur>photos.length-1) st.cur=photos.length-1;
    el.classList.remove("hidden"); stRoom(room||st.room||"select"); updatePrompt(); }
  function closeStudio(){ if(!st.open) return; stHideLegacy(); st.open=false; $("studioX").classList.add("hidden");
    if(loaded){ hubShow("hud"); App.go("scene"); updatePrompt(); } else showHub(); }
  function stHideLegacy(){ Object.keys(ST_LEGACY).forEach(function(k){ var e=$(ST_LEGACY[k]); if(e) e.classList.add("hidden"); }); document.body.classList.remove("st-legacy"); }
  function stRoom(r){ st.room=r; App.go("studio."+r); stHideLegacy();
    ["select","workshop","folio"].forEach(function(k){ var c=$("st-"+k); if(c) c.classList.toggle("hidden", k!==r); });
    var empty=!photos.length;
    if(ST_LEGACY[r]){ document.body.classList.add("st-legacy");
      if(empty){ document.body.classList.remove("st-legacy"); }
      else if(r==="edit"){ var i=st.cur>=0?st.cur:photos.length-1; openEditor(i); }
      else if(r==="book"){ openPhotobook(); } else if(r==="gallery"){ openGalleryShow(); } }
    $("stEmpty").classList.toggle("hidden", !(empty && r!=="select"));
    stRenderBar(); if(r==="select") stRenderSelect(); else if(r==="workshop") wsRender(); else if(r==="folio") foRender(); }
  function stCycle(d){ var i=0; ST_ROOMS.forEach(function(x,j){ if(x[0]===st.room) i=j; }); stRoom(ST_ROOMS[(i+d+ST_ROOMS.length)%ST_ROOMS.length][0]); }
  function stRenderBar(){ var bar=$("stBar"); if(!bar) return; var places={}; photos.forEach(function(p){ places[stPlaceOf(p)]=1; });
    bar.querySelector(".st-tabs").innerHTML=ST_ROOMS.map(function(r,i){ return '<button class="st-tab'+(r[0]===st.room?' on':'')+'" data-st-room="'+r[0]+'"><span class="n">0'+(i+1)+'</span>'+r[1]+'</button>'; }).join("");
    bar.querySelector(".st-sub").textContent=Object.keys(places).join(", ")+(photos.length?", "+photos.length+" frame"+(photos.length===1?"":"s"):"No frames yet");
    var hints={ select:[["← →","Move"],["P","Pick"],["X","Reject"],["1–5","Rate"],["Enter","Edit this frame"],["Q E","Rooms"]],
      edit:[["\\","Before / after"],["⌘Z","Undo"],["Q E","Rooms"],["Esc","Back to Select"]],
      workshop:[["T","Use this frame"],["N","New page"],["← →","Pages"],["Q E","Rooms"]],
      folio:[["Click","Choose a series"],["L","Series layout"],["Click two frames","Swap"],["Q E","Rooms"]],
      book:[["Q E","Rooms"],["Esc","Back to Select"]], gallery:[["Q E","Rooms"],["Esc","Back to Select"]] }[st.room];
    $("stHints").innerHTML=hints.map(function(h){ return '<span><kbd>'+h[0]+'</kbd>'+h[1]+'</span>'; }).join(""); }

  // ---- 01 SELECT: the light table ----
  function stMeta(p){ return (p.f?"f/"+p.f:"")+(p.sh?" · "+p.sh:""); }
  function stRenderSelect(){ var box=$("st-select"); if(!box) return; var sheet=box.querySelector(".st-sheet"), side=box.querySelector(".st-loupe");
    if(!photos.length){ sheet.innerHTML='<div class="st-none"><span class="h">The light table is empty.</span><span class="b">Shoot some frames in a location, then come back to pick your best.</span></div>'; side.innerHTML=""; return; }
    if(st.cur<0||st.cur>photos.length-1) st.cur=photos.length-1;
    sheet.innerHTML=photos.map(function(p,i){ var n=i+1, r=p.rating||0, stars="";
      for(var s=1;s<=5;s++) stars+='<i class="'+(s<=r?'on':'')+'">★</i>';
      return '<div class="st-cell'+(i===st.cur?' cur':'')+(p.pick?' pick':'')+(p.reject?' rej':'')+'" data-st-frame="'+i+'">'
        +'<div class="edge"><span>▸'+n+'</span><span>'+n+'A</span><span>'+cbEsc(stPlaceOf(p).toUpperCase().slice(0,10))+'</span></div>'
        +'<div class="fr"><img src="'+p.url+'" alt="Frame '+n+'" loading="lazy">'
        +(p.pick?'<svg class="loop" viewBox="0 0 214 148" preserveAspectRatio="none" aria-hidden="true"><path d="'+stPencil(n*7+3)+'"/></svg>':'')
        +(p.reject?'<svg class="strike" viewBox="0 0 100 66" preserveAspectRatio="none" aria-hidden="true"><path d="M8 7 L92 59"/></svg>':'')
        +(p.edited?'<span class="ed">EDITED</span>':'')+'</div>'
        +'<div class="meta"><span>'+stMeta(p)+'</span><span class="stars">'+stars+'</span></div></div>'; }).join("");
    var cells=sheet.querySelectorAll(".st-cell"); if(cells.length>1){ var y0=cells[0].offsetTop, c=0; for(var k=0;k<cells.length&&cells[k].offsetTop===y0;k++) c++; st.cols=Math.max(1,c); }
    var cur=sheet.querySelector(".st-cell.cur"); if(cur&&cur.scrollIntoView) cur.scrollIntoView({block:"nearest"});
    stRenderLoupe(); }
  function stRenderLoupe(){ var side=$("st-select").querySelector(".st-loupe"), p=photos[st.cur]; if(!p){ side.innerHTML=""; return; }
    var r=p.rating||0, stars=""; for(var s=1;s<=5;s++) stars+='<button class="st-star'+(s<=r?' on':'')+'" data-st-rate="'+s+'" aria-label="'+s+' stars">★</button>';
    var picks=stPicks(), brief=activeBrief>=0?BRIEFS[activeBrief]:null, target=5, slots="";
    for(var j=0;j<target;j++){ var pi=picks[j]; slots+='<span class="slot'+(pi!=null?' on':'')+'">'+(pi!=null?'<img src="'+photos[pi].url+'" alt="">':'')+'</span>'; }
    side.innerHTML='<div class="lp"><img src="'+p.url+'" alt="Frame '+(st.cur+1)+'"></div>'
      +'<div class="row1"><span class="fn">Frame '+cbPad(st.cur+1)+'</span><span class="ml">'+(p.mm?p.mm+" MM · ":"")+(p.f?"f/"+p.f+" · ":"")+(p.sh||"")+(p.iso?" · ISO "+p.iso:"")+'</span></div>'
      +'<div class="row2"><button class="st-btn'+(p.pick?' on':'')+'" data-st-act="pick">PICK <span>P</span></button><button class="st-btn'+(p.reject?' on':'')+'" data-st-act="reject">REJECT <span>X</span></button><div class="stars">'+stars+'</div></div>'
      +'<div class="brief"><span class="eb">'+(brief?"BRIEF "+cbPad(activeBrief+1)+" · "+cbEsc(brief.t.toUpperCase()):"YOUR FOLIO")+'</span>'
      +'<div class="t"><span>Pick five frames for your folio.</span><span class="n">'+Math.min(picks.length,99)+' / '+target+'</span></div><div class="slots">'+slots+'</div></div>'
      +'<label class="why"><span class="eb">WHY THIS ONE?</span><textarea id="stWhy" rows="3" placeholder="'+(p.pick?"Say what this frame does that the others don’t.":"Pick this frame, then write why it earns a place.")+'">'+cbEsc(p.note||"")+'</textarea></label>'
      +'<button class="st-punctum" data-st-act="punctum"><span><b>SEND PICKS TO PUNCTUM</b><i>Your class critiques them anonymously</i></span><svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="#e3ad57" stroke-width="1.6" aria-hidden="true"><path d="M1.5 1l5 5-5 5"/></svg></button>';
    var w=$("stWhy"); if(w){ w.oninput=function(){ var ph=photos[st.cur]; if(ph){ ph.note=this.value; saveSession(); } }; w.onkeydown=function(e){ e.stopPropagation(); if(e.key==="Escape") this.blur(); }; } }
  function stTogglePick(){ var p=photos[st.cur]; if(!p) return; p.pick=!p.pick; if(p.pick) p.reject=false; saveSession(); stRenderSelect(); }
  function stToggleReject(){ var p=photos[st.cur]; if(!p) return; p.reject=!p.reject; if(p.reject) p.pick=false; saveSession(); stRenderSelect(); }
  function stRate(s){ var p=photos[st.cur]; if(!p) return; p.rating=(p.rating===s?0:s); saveSession(); stRenderSelect(); }
  function stMove(d){ if(!photos.length) return; st.cur=Math.max(0,Math.min(photos.length-1,st.cur+d)); stRenderSelect(); }

  // ---- 03 WORKSHOP: an A3 development page, laid out from your frames ----
  var WS_PROMPTS=["Try it in black and white. What do you lose?","Crop it three ways. Which one feels uneasy?","Which frame is weakest, and why?"];
  function wsEnsure(){ if(!st.wsPages.length){ var pk=stPicks(), a=pk.length?pk[0]:Math.max(0,st.cur), b=pk.length>1?pk[1]:a;
      if(photos[a]) st.wsPages.push({a:photos[a].url, b:(photos[b]||photos[a]).url, title:"", n1:"", n2:"", next:""}); }
    if(st.wsPage>st.wsPages.length-1) st.wsPage=st.wsPages.length-1; }
  function wsRender(){ var box=$("st-workshop"); if(!box) return; wsEnsure(); var pg=st.wsPages[st.wsPage];
    if(!pg){ box.querySelector(".ws-sheet").innerHTML=""; return; }
    var tests=[["ORIGINAL","none"],["COLOUR","saturate(1.15) contrast(1.06)"],["B&W","grayscale(1) contrast(1.3)"],["FADED","contrast(.78) brightness(1.1) saturate(.7) sepia(.12)"]];
    var ed=function(k,ph,cls){ return '<div class="ws-ed '+(cls||"")+'" contenteditable="true" data-ws="'+k+'" data-ph="'+ph+'">'+cbEsc(pg[k]||"")+'</div>'; };
    box.querySelector(".ws-sheet").innerHTML='<div class="ws-head"><span class="eb">WORKSHOP · '+cbEsc(cbPlace.toUpperCase())+' · DEVELOPMENT</span>'+ed("title","What are you testing?","ws-title")
      +'<span class="who">'+cbEsc((studentName||"YOUR NAME").toUpperCase())+'</span></div>'
      +'<div class="ws-sec"><span class="no">01</span><span>SAME FRAME, FOUR WAYS</span></div>'
      +'<div class="ws-tests">'+tests.map(function(t){ return '<figure><img src="'+pg.a+'" alt="" style="filter:'+t[1]+'"><figcaption>'+t[0]+'</figcaption></figure>'; }).join("")+'</div>'
      +ed("n1","Which one works, and what does the other version lose?","ws-note")
      +'<div class="ws-sec"><span class="no">02</span><span>CROP IT THREE WAYS</span></div>'
      +'<div class="ws-crops"><div class="study"><img src="'+pg.b+'" alt=""><i class="g11"></i><i class="g45"></i><b class="l11">1:1</b><b class="l45">4:5</b></div>'
      +'<figure class="c32"><img src="'+pg.b+'" alt=""><figcaption>3:2 · AS SHOT</figcaption></figure><figure class="c11"><img src="'+pg.b+'" alt=""><figcaption>1:1</figcaption></figure><figure class="c45"><img src="'+pg.b+'" alt=""><figcaption>4:5</figcaption></figure></div>'
      +'<div class="ws-two">'+ed("n2","Which crop wins, and why?","ws-note")+'<div class="ws-next"><span class="eb">NEXT</span>'+ed("next","What will you try next time you shoot?","ws-note")+'</div></div>'
      +'<span class="ws-pg">PAGE '+(st.wsPage+1)+' OF '+st.wsPages.length+'</span>';
    Array.prototype.forEach.call(box.querySelectorAll("[data-ws]"),function(e){ e.oninput=function(){ pg[e.getAttribute("data-ws")]=e.textContent; saveSession(); };
      e.onkeydown=function(ev){ ev.stopPropagation(); if(ev.key==="Escape") e.blur(); }; });
    box.querySelector(".ws-pages").innerHTML=st.wsPages.map(function(_,i){ return '<button class="'+(i===st.wsPage?'on':'')+'" data-ws-page="'+i+'">'+(i+1)+'</button>'; }).join("")+'<button data-ws-act="new">+</button>';
    box.querySelector(".ws-try").innerHTML=WS_PROMPTS.map(function(q){ return '<li>'+q+'</li>'; }).join(""); }
  function wsUseFrame(){ wsEnsure(); var pg=st.wsPages[st.wsPage], p=photos[st.cur]; if(!pg||!p) return; pg.a=p.url; saveSession(); wsRender(); toast("Frame "+(st.cur+1)+" is now the test frame"); }
  function wsNewPage(){ var p=photos[st.cur]||photos[photos.length-1]; if(!p) return; st.wsPages.push({a:p.url, b:p.url, title:"", n1:"", n2:"", next:""}); st.wsPage=st.wsPages.length-1; saveSession(); wsRender(); }
  function wsPrint(){ document.body.classList.add("print-ws"); setTimeout(function(){ window.print(); setTimeout(function(){ document.body.classList.remove("print-ws"); },400); },60); }

  // ---- 04 FOLIO: one A0 portrait panel, no text, built in series (one band per location) ----
  function foSeries(){ var order=[], by={}; photos.forEach(function(p,i){ var k=stPlaceOf(p); if(!by[k]){ by[k]=[]; order.push(k); } by[k].push(i); });
    return order.slice(0,3).map(function(k){ var all=by[k], pk=all.filter(function(i){ return photos[i].pick; });
      if(!pk.length) pk=all.filter(function(i){ return (photos[i].rating||0)>=3; }); if(!pk.length) pk=all.slice(-8);
      pk.sort(function(x,y){ var ox=photos[x].order==null?x:photos[x].order, oy=photos[y].order==null?y:photos[y].order; return ox-oy; });
      return {place:k, frames:pk.slice(0,9)}; }); }
  // cells for a band (fractions of the band box) from a preset and a frame count
  function foCells(preset, n){ var c=[], g=0.022;
    if(!n) return c;
    if(preset==="hero"&&n>1){ var hw=0.5; c.push([0,0,hw-g/2,1]); var rest=n-1, cols=rest>4?3:2, rows=Math.ceil(rest/cols), cw=(1-hw-g/2-(cols-1)*g)/cols, ch=(1-(rows-1)*g)/rows;
      for(var i=0;i<rest;i++) c.push([hw+g/2+(i%cols)*(cw+g), Math.floor(i/cols)*(ch+g), cw, ch]); return c; }
    if(preset==="strip"){ var m=Math.min(n,5), w=(1-(m-1)*g)/m, h=Math.min(1, w*1.5*0.66); for(var j=0;j<m;j++) c.push([j*(w+g),(1-h)/2,w,h]); return c; }
    var cl=n<=3?n:n<=4?2:n<=6?3:n<=8?4:3, rw=Math.ceil(n/cl), w2=(1-(cl-1)*g)/cl, h2=(1-(rw-1)*g)/rw;
    for(var k=0;k<n;k++) c.push([(k%cl)*(w2+g), Math.floor(k/cl)*(h2+g), w2, h2]); return c; }
  function foLayout(W,H){ var mx=W*0.07, top=H*0.045, gap=H*0.03, bandH=(H-top*2-gap*2)/3, out=[];
    for(var b=0;b<3;b++) out.push({x:mx, y:top+b*(bandH+gap), w:W-2*mx, h:bandH}); return out; }
  function foRender(){ var box=$("st-folio"); if(!box) return; var area=box.querySelector(".fo-area"), sheet=box.querySelector(".fo-sheet");
    var ah=area.clientHeight-30, aw=area.clientWidth-40, H=Math.max(200,Math.min(ah, aw*1189/841)), W=H*841/1189;
    sheet.style.width=W+"px"; sheet.style.height=H+"px"; sheet.classList.toggle("black", st.foPaper==="black");
    var series=foSeries(), bands=foLayout(W,H), html="";
    bands.forEach(function(bd,b){ var s=series[b], sel=b===st.foBand;
      html+='<div class="fo-band'+(sel?' sel':'')+(s?'':' empty')+'" data-fo-band="'+b+'" style="left:'+bd.x+'px;top:'+bd.y+'px;width:'+bd.w+'px;height:'+bd.h+'px">';
      if(s){ foCells(st.foPresets[b], s.frames.length).forEach(function(c,i){ var pi=s.frames[i], on=st.foSel&&st.foSel[0]===b&&st.foSel[1]===i;
          html+='<button class="fo-cell'+(on?' on':'')+'" data-fo-cell="'+b+':'+i+'" style="left:'+(c[0]*100)+'%;top:'+(c[1]*100)+'%;width:'+(c[2]*100)+'%;height:'+(c[3]*100)+'%"><img src="'+photos[pi].url+'" alt=""></button>'; }); }
      else html+='<span class="fo-ghost">+ SERIES '+(b+1)+' · NEXT LOCATION</span>';
      html+='</div>'; });
    sheet.innerHTML=html;
    var idx=box.querySelector(".fo-index"); idx.innerHTML=[0,1,2].map(function(b){ var s=series[b];
      return '<div class="fo-ix'+(s?' done':'')+(b===st.foBand?' sel':'')+'" data-fo-band="'+b+'"><span class="n">0'+(b+1)+'</span><span class="t">'+(s?cbEsc(s.place):"Next location")+'</span><span class="m">'+(s?s.frames.length+" FRAMES · "+st.foPresets[b].toUpperCase():"NOT SHOT YET")+'</span></div>'; }).join("");
    Array.prototype.forEach.call(box.querySelectorAll("[data-fo-paper]"),function(e){ e.classList.toggle("on", e.getAttribute("data-fo-paper")===st.foPaper); });
    Array.prototype.forEach.call(box.querySelectorAll("[data-fo-preset]"),function(e){ e.classList.toggle("on", e.getAttribute("data-fo-preset")===st.foPresets[st.foBand]); });
    box.querySelector(".fo-check").textContent=series.length>=3?"Three series on the panel. Check each band reads as its own place.":(series.length===1?"Your first series fills the top band. Two more locations and the panel is done.":"Two series down. One more location to go."); }
  function foCyclePreset(){ var P=["hero","grid","strip"], b=st.foBand; st.foPresets[b]=P[(P.indexOf(st.foPresets[b])+1)%P.length]; foRender(); }
  function foClickCell(b,i){ var series=foSeries(); if(st.foSel&&st.foSel[0]===b&&st.foSel[1]!==i){ var s=series[b], a=s.frames[st.foSel[1]], c=s.frames[i];
      // swap two frames by swapping their order keys
      var pa=photos[a], pc=photos[c], ta=pa.order==null?a:pa.order, tc=pc.order==null?c:pc.order; pa.order=tc; pc.order=ta; st.foSel=null; saveSession(); foRender(); return; }
    st.foBand=b; st.foSel=[b,i]; foRender(); }
  function foExport(){ var series=foSeries(); if(!series.length) return; var W=3508, H=Math.round(W*1189/841), cv=document.createElement("canvas"); cv.width=W; cv.height=H; var g=cv.getContext("2d");
    g.fillStyle=st.foPaper==="black"?"#0f0e0c":"#eeeae1"; g.fillRect(0,0,W,H); var bands=foLayout(W,H), jobs=[];
    bands.forEach(function(bd,b){ var s=series[b]; if(!s) return; foCells(st.foPresets[b], s.frames.length).forEach(function(c,i){ jobs.push({url:photos[s.frames[i]].url, x:bd.x+c[0]*bd.w, y:bd.y+c[1]*bd.h, w:c[2]*bd.w, h:c[3]*bd.h}); }); });
    var left=jobs.length; toast("Building your A0 panel…");
    jobs.forEach(function(j){ var im=new Image(); im.onload=function(){ var r=Math.max(j.w/im.width, j.h/im.height), sw=j.w/r, sh=j.h/r; g.drawImage(im,(im.width-sw)/2,(im.height-sh)/2,sw,sh,j.x,j.y,j.w,j.h); if(--left===0) done(); };
      im.onerror=function(){ if(--left===0) done(); }; im.src=j.url; });
    function done(){ cv.toBlob(function(b){ var a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=namePrefix()+"folio-A0.png"; document.body.appendChild(a); a.click(); a.remove(); toast("A0 panel downloaded"); },"image/png"); } }

  // ---- input ----
  function stKey(e){ var c=e.code, typing=e.target&&(e.target.tagName==="TEXTAREA"||e.target.tagName==="INPUT"||e.target.isContentEditable);
    if(typing) return true;
    if(c==="KeyQ"&&!e.ctrlKey&&!e.metaKey){ stCycle(-1); return true; } if(c==="KeyE"&&!e.ctrlKey&&!e.metaKey){ stCycle(1); return true; }
    if(c==="Escape"){ e.preventDefault(); if(st.room==="select") closeStudio(); else stRoom("select"); return true; }
    if(ST_LEGACY[st.room]) return false;   // the editor and builders keep their own keys
    if(st.room==="select"){ if(c==="ArrowRight") stMove(1); else if(c==="ArrowLeft") stMove(-1); else if(c==="ArrowDown") stMove(st.cols); else if(c==="ArrowUp") stMove(-st.cols);
      else if(c==="KeyP") stTogglePick(); else if(c==="KeyX") stToggleReject(); else if(/^Digit[0-5]$/.test(c)){ var s=+c.slice(5); if(s===0){ var p=photos[st.cur]; if(p){ p.rating=0; saveSession(); stRenderSelect(); } } else stRate(s); }
      else if(c==="Enter"&&photos.length) stRoom("edit"); else return true; e.preventDefault(); return true; }
    if(st.room==="workshop"){ if(c==="KeyT") wsUseFrame(); else if(c==="KeyN") wsNewPage(); else if(c==="ArrowRight"){ st.wsPage=Math.min(st.wsPages.length-1,st.wsPage+1); wsRender(); } else if(c==="ArrowLeft"){ st.wsPage=Math.max(0,st.wsPage-1); wsRender(); } return true; }
    if(st.room==="folio"){ if(c==="KeyL") foCyclePreset(); else if(/^Digit[1-3]$/.test(c)){ st.foBand=+c.slice(5)-1; foRender(); } return true; }
    return true; }
  function stClick(e){ var t=e.target.closest("[data-st-room],[data-st-frame],[data-st-rate],[data-st-act],[data-ws-page],[data-ws-act],[data-fo-cell],[data-fo-band],[data-fo-paper],[data-fo-preset],[data-fo-act],[data-st-close]"); if(!t) return;
    if(t.hasAttribute("data-st-close")) return closeStudio();
    if(t.hasAttribute("data-st-room")) return stRoom(t.getAttribute("data-st-room"));
    if(t.hasAttribute("data-st-frame")){ var i=+t.getAttribute("data-st-frame"); if(e.detail>=2&&i===st.cur) return stRoom("edit"); st.cur=i; return stRenderSelect(); }
    if(t.hasAttribute("data-st-rate")) return stRate(+t.getAttribute("data-st-rate"));
    if(t.hasAttribute("data-st-act")){ var a=t.getAttribute("data-st-act"); if(a==="pick") stTogglePick(); else if(a==="reject") stToggleReject(); else if(a==="punctum"){ closeStudio(); openPunctum(); } else if(a==="ws-use") wsUseFrame(); else if(a==="ws-print") wsPrint(); return; }
    if(t.hasAttribute("data-ws-page")){ st.wsPage=+t.getAttribute("data-ws-page"); return wsRender(); }
    if(t.hasAttribute("data-ws-act")) return wsNewPage();
    if(t.hasAttribute("data-fo-cell")){ var p=t.getAttribute("data-fo-cell").split(":"); e.stopPropagation(); return foClickCell(+p[0],+p[1]); }
    if(t.hasAttribute("data-fo-band")){ st.foBand=+t.getAttribute("data-fo-band"); st.foSel=null; return foRender(); }
    if(t.hasAttribute("data-fo-paper")){ st.foPaper=t.getAttribute("data-fo-paper"); return foRender(); }
    if(t.hasAttribute("data-fo-preset")){ st.foPresets[st.foBand]=t.getAttribute("data-fo-preset"); return foRender(); }
    if(t.hasAttribute("data-fo-act")) return foExport(); }
  (function wireStudio(){ var el=$("studioX"); if(!el) return; el.addEventListener("click",stClick);
    window.addEventListener("resize",function(){ if(st.open&&st.room==="folio") foRender(); });
    // the legacy builders' own Back buttons return to the studio's Select room
    ["eCancel","pbBack","gxBack"].forEach(function(id){ var b=$(id); if(!b) return; b.addEventListener("click",function(ev){ if(!st.open) return; ev.stopImmediatePropagation(); stRoom("select"); },true); }); })();
