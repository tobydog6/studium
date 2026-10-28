  // ================= STUDIO (Tab, or Photos on the camera back) =================
  // The darkroom. Rooms in workflow order: Select, Edit, Workbook, Folio, Book, Gallery (Q / E to switch, Esc back
  // to the location). Edit hosts the develop panel under the studio bar; every other room is drawn here, and
  // Gallery's "walk the show" opens the 3D gallery show.
  var ST_ROOMS=[["research","Research"],["select","Library"],["edit","Edit"],["table","Light table"],["workshop","Workbook"],["folio","Folio"],["book","Book"],["gallery","Gallery"]];
  var st={open:false, room:"select", cur:-1, cols:4, wsPages:[], wsBoard:null, foBoard:null, projects:[], lightTable:null, galGame:null, thumb:"m", hideRej:false, cmp:-1};

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
  // a stable id per frame, so layouts survive edits and reloads without copying the image data
  function stId(i){ var p=photos[i]; if(!p) return null; if(!p.id) p.id="p"+Date.now().toString(36)+Math.random().toString(36).slice(2,7); return p.id; }
  function stById(id){ if(!id) return -1; for(var i=0;i<photos.length;i++) if(photos[i].id===id) return i; return -1; }
  var stDims={};
  function stAspect(i){ var u=photos[i].url, d=stDims[u]; if(d) return d; if(d===undefined){ stDims[u]=0; var im=new Image();
      im.onload=function(){ stDims[u]=im.width/im.height; stRerender(); }; im.src=u; } return 1.5; }

  // ---- open / close / rooms ----
  var ST_LEGACY={edit:"editor"};
  function openStudio(room){ var el=$("studioX"); if(!el) return;
    if(looking){ try{ document.exitPointerLock(); }catch(e){} } if(viewfinderOn) lowerCamera();
    ["hub","studio","gallery","landing","prompt"].forEach(hubHide);
    st.open=true; if(st.cur<0||st.cur>photos.length-1) st.cur=photos.length-1;
    el.classList.remove("hidden"); stRoom(room||st.room||"select"); updatePrompt(); }
  function closeStudio(){ if(!st.open) return; if(st.zoom) stZoom(false); ltPause(); stHideLegacy(); st.open=false; $("studioX").classList.add("hidden");
    if(loaded){ hubShow("hud"); App.go("scene"); updatePrompt(); } else showHub(); }
  function stHideLegacy(){ var ed=$("editor"); if(ed&&!ed.classList.contains("hidden")&&typeof devCommit==="function") devCommit(); Object.keys(ST_LEGACY).forEach(function(k){ var e=$(ST_LEGACY[k]); if(e) e.classList.add("hidden"); }); document.body.classList.remove("st-legacy"); }
  function stRoom(r){ if(r!=="edit"&&typeof devScope!=="undefined") devScope=null; if(st.zoom) stZoom(false); if(st.room==="table"&&r!=="table") ltPause(); st.room=r; App.go("studio."+r); stHideLegacy();
    ["research","select","table","workshop","folio","book","gallery"].forEach(function(k){ var c=$("st-"+k); if(c) c.classList.toggle("hidden", k!==r); });
    var empty=!photos.length;
    if(ST_LEGACY[r]){ document.body.classList.add("st-legacy");
      if(empty){ document.body.classList.remove("st-legacy"); }
      else if(r==="edit"){ var i=st.cur>=0?st.cur:photos.length-1; openEditor(i); } }
    $("stEmpty").classList.toggle("hidden", !(empty && r!=="select"&&r!=="research"&&r!=="table"));
    stRenderBar(); if(r==="research") rsRender(); else if(r==="select") stRenderSelect(); else if(r==="table") ltOpen(); else if(r==="workshop"){ wsEnsure(); wsB.render(); } else if(r==="folio") foB.render(); else if(r==="book") bkRender(); else if(r==="gallery") gaRender(); }
  function stCycle(d){ var i=0; ST_ROOMS.forEach(function(x,j){ if(x[0]===st.room) i=j; }); stRoom(ST_ROOMS[(i+d+ST_ROOMS.length)%ST_ROOMS.length][0]); }
  function stRenderBar(){ var bar=$("stBar"); if(!bar) return; var places={}; photos.forEach(function(p){ places[stPlaceOf(p)]=1; });
    bar.querySelector(".st-tabs").innerHTML=ST_ROOMS.map(function(r,i){ return '<button class="st-tab'+(r[0]===st.room?' on':'')+'" data-st-room="'+r[0]+'"><span class="n">0'+(i+1)+'</span>'+r[1]+'</button>'; }).join("");
    bar.querySelector(".st-sub").textContent=Object.keys(places).join(", ")+(photos.length?", "+photos.length+" frame"+(photos.length===1?"":"s"):"No frames yet");
    var hints={ select:[["← →","Move"],["P","Pick"],["X","Reject"],["1-5","Rate"],["V","Compare"],["Z","Full screen"],["Enter","Edit this frame"],["Q E","Rooms"]],
      edit:[["\\","Before / after"],["⌘Z","Undo"],["Q E","Rooms"],["Esc","Back to the library"]],
      table:[["B","Binder"],["Drag","Prints onto the board"],["Right-click","Options"],["Top edge","The wall"],["?","Tour"],["Q E","Rooms"]],
      workshop:[["Drag","Frames onto the page"],["Click","Write in a text box"],["Del","Remove"],["⌘D","Duplicate"],["⌘Z","Undo"],["Q E","Rooms"]],
      folio:[["Drag","Frames or folders into a section"],["⤢","Zoom into a section"],["Drag across","Select several"],["Del","Remove"],["⌘Z","Undo"],["Q E","Rooms"]],
      research:[["Click","Pick photographs for your moodboard"],["Q E","Rooms"]], book:[["← →","Spread"],["Drag","Place a frame"],["Click two","Swap"],["T","Template"],["B","Full bleed"],["Q E","Rooms"]], gallery:[["Click a print","Size"],["← →","Spacing"],["F","Frame"],["W","Walk the show"],["Q E","Rooms"]] }[st.room];
    $("stHints").innerHTML=hints.map(function(h){ return '<span><kbd>'+h[0]+'</kbd>'+h[1]+'</span>'; }).join(""); }

  // ---- 01 SELECT: the light table ----
  function stMeta(p){ return (p.f?"f/"+p.f:"")+(p.sh?" · "+p.sh:""); }
  function stRenderSelect(){ var box=$("st-select"); if(!box) return; var sheet=box.querySelector(".st-sheet"), side=box.querySelector(".st-loupe");
    if(!photos.length){ sheet.innerHTML='<div class="st-none"><span class="h">The light table is empty.</span><span class="b">Shoot some frames in a location, then come back to pick your best.</span></div>'; side.innerHTML=""; return; }
    if(st.cur<0||st.cur>photos.length-1) st.cur=photos.length-1;
    libRender(box.querySelector(".st-lib"), "select"); var shown=libItems(LIB.key);
    if(!shown.length){ sheet.innerHTML='<div class="st-none"><span class="h">This folder is empty.</span><span class="b">'+(LIB.key.indexOf("proj:")===0?'Drag frames from another folder onto the project to add them.':'Pick another folder on the left.')+'</span></div>'; stRenderLoupe(); return; }
    var allShown=shown; if(st.hideRej) shown=shown.filter(function(i){ return !photos[i].reject; }); if(!shown.length) shown=allShown;
    if(shown.indexOf(st.cur)<0) st.cur=shown[0];
    var nRej=allShown.filter(function(i){ return photos[i].reject; }).length;
    sheet.setAttribute("data-thumb", st.thumb||"m");
    sheet.innerHTML='<div class="st-sheet-h"><span class="eb">'+cbEsc(libName(LIB.key).toUpperCase())+' · '+allShown.length+(nRej?' · '+nRej+' REJECTED':'')+'</span><span class="sp"></span>'
      +(nRej?'<button class="st-hb'+(st.hideRej?' on':'')+'" data-st-hiderej>'+(st.hideRej?'Show rejects':'Hide rejects')+'</button>':'')
      +'<span class="st-sizes"><button class="st-hb'+(st.thumb==="s"?' on':'')+'" data-st-size="s" title="Small thumbnails">S</button><button class="st-hb'+(st.thumb==="m"?' on':'')+'" data-st-size="m" title="Medium thumbnails">M</button><button class="st-hb'+(st.thumb==="l"?' on':'')+'" data-st-size="l" title="Large thumbnails">L</button></span></div>'
      +shown.map(function(i){ var p=photos[i], n=i+1, r=p.rating||0, stars="";
      for(var s=1;s<=5;s++) stars+='<i class="'+(s<=r?'on':'')+'">★</i>';
      return '<div class="st-cell'+(i===st.cur?' cur':'')+(LIB.sel[i]?' msel':'')+(p.pick?' pick':'')+(p.reject?' rej':'')+'" data-st-frame="'+i+'" draggable="true">'
        +'<div class="edge"><span>▸'+n+'</span><span>'+n+'A</span><span>'+cbEsc(stPlaceOf(p).toUpperCase().slice(0,10))+'</span></div>'
        +'<div class="fr"><img src="'+p.url+'" alt="Frame '+n+'" loading="lazy">'
        +(p.pick?'<svg class="loop" viewBox="0 0 214 148" preserveAspectRatio="none" aria-hidden="true"><path d="'+stPencil(n*7+3)+'"/></svg>':'')
        +(p.reject?'<svg class="strike" viewBox="0 0 100 66" preserveAspectRatio="none" aria-hidden="true"><path d="M8 7 L92 59"/></svg>':'')
        +(p.edited?'<span class="ed">EDITED</span>':'')+'</div>'
        +'<div class="meta"><span>'+stMeta(p)+'</span><span class="stars">'+stars+'</span></div></div>'; }).join("");
    var cells=sheet.querySelectorAll(".st-cell"); if(cells.length>1){ var y0=cells[0].offsetTop, c=0; for(var k=0;k<cells.length&&cells[k].offsetTop===y0;k++) c++; st.cols=Math.max(1,c); }
    if(st.cmp>=0&&st.cmp<photos.length){ var cc=sheet.querySelector('.st-cell[data-st-frame="'+st.cmp+'"]'); if(cc) cc.classList.add("ref"); }
    var cur=sheet.querySelector(".st-cell.cur"); if(cur&&cur.scrollIntoView) cur.scrollIntoView({block:"nearest"});
    stRenderLoupe(); }
  function stExif(p){ return (p.mm?p.mm+" MM · ":"")+(p.f?"f/"+p.f+" · ":"")+(p.sh||"")+(p.iso?" · ISO "+p.iso:""); }
  function stRenderLoupe(){ var side=$("st-select").querySelector(".st-loupe"), p=photos[st.cur]; if(!p){ side.innerHTML=""; return; }
    var r=p.rating||0, stars=""; for(var s=1;s<=5;s++) stars+='<button class="st-star'+(s<=r?' on':'')+'" data-st-rate="'+s+'" aria-label="'+s+' stars">★</button>';
    var picks=stPicks(), brief=activeBrief>=0?BRIEFS[activeBrief]:null, target=5, slots="";
    for(var j=0;j<target;j++){ var pi=picks[j]; slots+='<span class="slot'+(pi!=null?' on':'')+'">'+(pi!=null?'<img src="'+photos[pi].url+'" alt="">':'')+'</span>'; }
    /* compare: the frame you marked with V on the left, the one under the cursor on the right (Lightroom's select and candidate) */
    var ref=st.cmp>=0&&st.cmp<photos.length&&st.cmp!==st.cur?photos[st.cmp]:null, lp;
    if(ref) lp='<div class="lp cmp" data-st-zoom><div class="half"><img src="'+ref.url+'" alt="Frame '+(st.cmp+1)+'"><span class="tag">SELECT · FRAME '+cbPad(st.cmp+1)+'</span><span class="ex">'+stExif(ref)+'</span></div><div class="half cand"><img src="'+p.url+'" alt="Frame '+(st.cur+1)+'"><span class="tag">CANDIDATE · FRAME '+cbPad(st.cur+1)+'</span><span class="ex">'+stExif(p)+'</span></div></div>';
    else lp='<div class="lp" data-st-zoom><img src="'+p.url+'" alt="Frame '+(st.cur+1)+'"></div>';
    side.innerHTML=lp
      +'<div class="row1"><span class="fn">Frame '+cbPad(st.cur+1)+(ref?' <i>against '+cbPad(st.cmp+1)+'</i>':'')+'</span><span class="ml">'+stExif(p)+'</span></div>'
      +'<div class="row2"><button class="st-btn'+(p.pick?' on':'')+'" data-st-act="pick">Pick <span>P</span></button><button class="st-btn'+(p.reject?' on':'')+'" data-st-act="reject">Reject <span>X</span></button><button class="st-btn cmpb'+(ref||st.cmp===st.cur?' on':'')+'" data-st-act="compare" title="'+(ref?'Make this frame the select':st.cmp===st.cur?'Stop comparing':'Hold this frame, then arrow to another to compare')+'">'+(ref?'Swap':'Compare')+' <span>V</span></button><button class="st-btn" data-st-act="edit">Edit <span>↵</span></button><div class="stars">'+stars+'</div></div>'
      +'<div class="brief"><span class="eb">'+(brief?"BRIEF "+cbPad(activeBrief+1)+" · "+cbEsc(brief.t.toUpperCase()):"YOUR FOLIO")+'</span>'
      +'<div class="t"><span>Pick '+(['zero','one','two','three','four','five','six','seven','eight'][target]||target)+' frames for your folio.</span><span class="n">'+Math.min(picks.length,99)+' / '+target+'</span></div><div class="slots">'+slots+'</div></div>'
      +'<label class="why"><span class="eb">WHY THIS ONE?</span><textarea id="stWhy" rows="3" placeholder="'+(p.pick?"Say what this frame does that the others don’t.":"Pick this frame, then write why you chose it.")+'">'+cbEsc(p.note||"")+'</textarea></label>'
      +'<button class="st-punctum" data-st-act="punctum"><span><b>Send picks to Punctum</b><i>Your class critiques them anonymously</i></span><svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="#e3ad57" stroke-width="1.6" aria-hidden="true"><path d="M1.5 1l5 5-5 5"/></svg></button>';
    var w=$("stWhy"); if(w){ w.oninput=function(){ var ph=photos[st.cur]; if(ph){ ph.note=this.value; saveSession(); } }; w.onkeydown=function(e){ e.stopPropagation(); if(e.key==="Escape") this.blur(); }; } }
  function stTogglePick(){ var p=photos[st.cur]; if(!p) return; p.pick=!p.pick; sfx("stMark",{k:"pick"}); if(p.pick) p.reject=false; saveSession(); stRenderSelect(); }
  function stToggleReject(){ var p=photos[st.cur]; if(!p) return; p.reject=!p.reject; sfx("stMark",{k:"reject"}); if(p.reject) p.pick=false; saveSession(); stRenderSelect(); }
  function stRate(s){ var p=photos[st.cur]; if(!p) return; p.rating=(p.rating===s?0:s); sfx("stMark",{k:"star"}); saveSession(); stRenderSelect(); }
  function stCompare(){ if(!photos.length) return; if(st.cmp===st.cur) st.cmp=-1; else st.cmp=st.cur; stRenderSelect(); }
  function stZoom(on){ st.zoom=on==null?!st.zoom:!!on; document.body.classList.toggle("st-zoom", !!(st.zoom&&photos.length)); }   /* Z: the frame fills the screen */   /* V: hold this frame; V again on it lets go; V on another makes that the select */
  function stMove(d){ if(!photos.length) return; var L=libItems(LIB.key); if(st.hideRej){ var L2=L.filter(function(i){ return !photos[i].reject; }); if(L2.length) L=L2; } if(!L.length) return; var j=L.indexOf(st.cur); st.cur=L[Math.max(0,Math.min(L.length-1,(j<0?0:j)+d))]; stRenderSelect(); }

  // ---- 03 WORKBOOK and 04 FOLIO are free layout boards (board.js) ----
  function stBoard(){ return st.room==="workshop"?wsB:st.room==="folio"?foB:null; }
  function wsEnsure(){ if(!st.wsBoard&&st.wsPages&&st.wsPages.length){ st.wsBoard=wsMigrate(st.wsPages); st.wsPages=[]; wsB.reset(st.wsBoard); } }
  function stRerender(){ if(!st.open) return; if(st.room==="research") rsRender(); else if(st.room==="gallery") gaRender(); else if(st.room==="book") bkRender(); else if(st.room==="workshop") wsB.render(); else if(st.room==="folio") foB.render(); }

  // ---- 05 BOOK: a lay-flat photobook, spread by spread ----
  // Pages hold a template (blank, full bleed, centred, two-up, grid) and frame ids. Centred and two-up frames keep
  // their own shape; bleed and grid crop to fill. The cover and back stand alone; interior pages come in spreads.
  var BK_SIZES={"20x25":[200,250,"PORTRAIT"],"25x20":[250,200,"LANDSCAPE"],"21x21":[210,210,"SQUARE"]};
  var BK_TPL=["blank","bleed","centre","two","grid"], BK_TPL_NAME={blank:"BLANK",bleed:"FULL BLEED",centre:"CENTRED",two:"TWO-UP",grid:"GRID"};
  var bk={size:"20x25", pages:[], spread:1, sel:null, focus:1, bound:false};
  function bkSource(){ var pk=stPicks(); if(!pk.length) pk=photos.map(function(_,i){ return i; }).filter(function(i){ return (photos[i].rating||0)>=3; });
    if(!pk.length) pk=photos.map(function(_,i){ return i; }); return pk; }
  function bkMM(){ return BK_SIZES[bk.size]||BK_SIZES["20x25"]; }
  function bkBoxes(tpl){ var a=bkMM(), land=a[0]>a[1];
    if(tpl==="bleed") return [[0,0,1,1,"cover"]];
    if(tpl==="centre") return [[0.15,0.2,0.7,0.6,"fit"]];
    if(tpl==="two") return land?[[0.07,0.16,0.4,0.68,"fit"],[0.53,0.16,0.4,0.68,"fit"]]:[[0.13,0.07,0.74,0.41,"fit"],[0.13,0.52,0.74,0.41,"fit"]];
    if(tpl==="grid") return [[0.1,0.1,0.38,0.37,"cover"],[0.52,0.1,0.38,0.37,"cover"],[0.1,0.53,0.38,0.37,"cover"],[0.52,0.53,0.38,0.37,"cover"]];
    return []; }
  function bkRects(pi){ var pg=bk.pages[pi], a=bkMM(), W=a[0], H=a[1];
    return bkBoxes(pg.tpl).map(function(b,s){ var i=stById(pg.imgs[s]), r={x:b[0],y:b[1],w:b[2],h:b[3],i:i,s:s};
      if(b[4]==="fit"&&i>=0){ var ar=stAspect(i), bw=b[2]*W, bh=b[3]*H, w=Math.min(bw,bh*ar), h=w/ar; r.w=w/W; r.h=h/H; r.x=b[0]+(b[2]-r.w)/2; r.y=b[1]+(b[3]-r.h)/2; }
      r.mmw=Math.round(r.w*W); r.mmh=Math.round(r.h*H); return r; }); }
  function bkEnsure(){ if(bk.pages.length||!photos.length) return; var src=bkSource().slice(), hero=src[0];
    src.forEach(function(i){ if((photos[i].rating||0)>(photos[hero].rating||0)) hero=i; });
    var rest=src.filter(function(i){ return i!==hero; }).map(stId), k=0, pages=[{tpl:"bleed", imgs:[stId(hero)]}];
    ["blank","centre","centre","bleed","bleed","centre","two","centre","blank","bleed"].forEach(function(t){ var im=[]; bkBoxes(t).forEach(function(){ im.push(rest[k++]||null); }); pages.push({tpl:t, imgs:im}); });
    while(k<rest.length&&pages.length<41){ pages.push({tpl:"centre", imgs:[rest[k++]||null]}); pages.push({tpl:"bleed", imgs:[rest[k++]||null]}); }
    pages.push({tpl:"blank", imgs:[], back:true}); bk.pages=pages; bk.spread=1; bk.focus=1; bk.sel=null; }
  function bkSpreads(){ var L=bk.pages.length-1, s=[[0]]; for(var i=1;i<L;i+=2) s.push(i+1<L?[i,i+1]:[i]); s.push([L]); return s; }
  function bkLabel(s,j,all){ return j===0?"COVER":j===all.length-1?"BACK":(s[0]+1)+(s.length>1?"-"+(s[1]+1):""); }
  function bkPageHTML(pi, mini){ var pg=bk.pages[pi], h="";
    bkRects(pi).forEach(function(r){ var p=r.i>=0?photos[r.i]:null, sel=!mini&&bk.sel&&bk.sel[0]===pi&&bk.sel[1]===r.s;
      var sty='left:'+(r.x*100).toFixed(2)+'%;top:'+(r.y*100).toFixed(2)+'%;width:'+(r.w*100).toFixed(2)+'%;height:'+(r.h*100).toFixed(2)+'%';
      if(mini){ h+=p?'<img style="'+sty+'" src="'+p.url+'" alt="">':'<i style="'+sty+'"></i>'; return; }
      h+='<button class="bk-slot'+(p?'':' empty')+(sel?' sel':'')+'" data-bk-slot="'+pi+':'+r.s+'" style="'+sty+'">'
        +(p?'<img src="'+p.url+'" alt="Frame '+(r.i+1)+'" draggable="false">':'<span>DROP A FRAME</span>')
        +(sel?'<i class="h tl"></i><i class="h tr"></i><i class="h bl"></i><i class="h br"></i><span class="sz">'+r.mmw+' × '+r.mmh+' MM · '+BK_TPL_NAME[pg.tpl]+'</span>':'')+'</button>'; });
    return h; }
  function bkTip(cur){ var a=bk.pages[cur[0]], b=cur[1]!=null?bk.pages[cur[1]]:null, full=function(p){ return p&&p.imgs.some(function(id){ return stById(id)>=0; }); };
    if(cur[0]===0) return "Pick a cover frame that sets the mood of the book. It doesn't have to be your best one.";
    if(a.back) return "You can leave the back cover blank, or put one small frame on it.";
    if(b&&full(a)&&full(b)&&a.tpl!==b.tpl) return "You have a wide shot facing a close-up. Think about what you get from seeing them together.";
    if(b&&full(a)&&full(b)) return "These two frames sit side by side. What do they show together that one on its own can't?";
    if(b&&(full(a)!==full(b))) return "Try a blank page just before a frame you want people to notice.";
    return "Drag a pick onto a page, or press T to try a different template."; }
  function bkRender(){ var box=$("st-book"); if(!box) return; bkEnsure(); bkBind(); if(!bk.pages.length) return;
    var sp=bkSpreads(); bk.spread=Math.max(0,Math.min(sp.length-1,bk.spread)); var cur=sp[bk.spread]; if(cur.indexOf(bk.focus)<0) bk.focus=cur[cur.length>1&&bk.pages[cur[0]].tpl==="blank"?1:0];
    var stage=box.querySelector(".bk-stage"), aw=stage.clientWidth, ah=stage.clientHeight, a=bkMM(), ar=a[0]/a[1], n=cur.length, ph=ah, pw=ph*ar;
    if(pw*Math.max(n,2)>aw){ pw=aw/Math.max(n,2); ph=pw/ar; }
    box.querySelector(".bk-spread").innerHTML=cur.map(function(pi,k){ var pg=bk.pages[pi], side=n===1?"single":(k===0?"l":"r");
      return '<div class="bk-page '+side+(pi===bk.focus?' focus':'')+(pg.tpl==="bleed"?' bleed':'')+'" data-bk-page="'+pi+'" style="width:'+pw.toFixed(1)+'px;height:'+ph.toFixed(1)+'px">'
        +bkPageHTML(pi)+'<i class="gut"></i>'+(pi>0&&!pg.back&&pg.tpl!=="bleed"?'<span class="pn">'+(pi+1)+'</span>':'')+'</div>'; }).join("");
    box.querySelector(".bk-cap").innerHTML='<span>'+(bk.spread===0?"COVER":cur[0]===bk.pages.length-1?"BACK COVER":"PAGES "+bkLabel(cur,bk.spread,sp))+' · '+a[0]+' × '+a[1]+' MM '+a[2]+'</span><span>LAY-FLAT · MATTE</span>';
    var tw=Math.round(50*Math.min(1,ar)), th=Math.round(50/Math.max(1,ar));
    box.querySelector(".bk-strip").innerHTML=sp.map(function(s,j){ return '<button class="bk-thumb'+(j===bk.spread?' on':'')+'" data-bk-spread="'+j+'"><span class="pp">'
        +s.map(function(pi){ return '<span class="mp'+(bk.pages[pi].tpl==="bleed"?' bl':'')+'" style="width:'+tw+'px;height:'+th+'px">'+bkPageHTML(pi,true)+'</span>'; }).join("")
        +'</span><span class="l">'+bkLabel(s,j,sp)+'</span></button>'; }).join("")+'<button class="bk-add" data-bk-act="add" aria-label="Add a spread" style="height:'+th+'px">+</button>';
    var used={}; bk.pages.forEach(function(pg){ pg.imgs.forEach(function(id){ if(id) used[id]=1; }); });
    var tray=box.querySelector(".bk-tray"); tray.classList.add("st-lib"); libRender(tray, "book");   /* the same library rail as Library, Workbook and Folio */
    Array.prototype.forEach.call(tray.querySelectorAll("[data-bd-pic]"),function(c){ var i=+c.getAttribute("data-bd-pic"); if(!used[stId(i)]) return; var m=c.querySelector(".m"); if(!m) return;
      var k=m.querySelector(".pk"); if(k) k.remove(); var t=document.createElement("span"); t.className="in"; t.textContent="IN BOOK"; m.appendChild(t); });
    Array.prototype.forEach.call(box.querySelectorAll("[data-bk-size]"),function(b){ b.classList.toggle("on", b.getAttribute("data-bk-size")===bk.size); });
    var ft=bk.pages[bk.focus].tpl; Array.prototype.forEach.call(box.querySelectorAll("[data-bk-tpl]"),function(b){ b.classList.toggle("on", b.getAttribute("data-bk-tpl")===ft); });
    box.querySelector(".bk-pages").textContent=bk.pages.length; box.querySelector(".bk-tip").textContent=bkTip(cur); }
  function bkSave(){ saveSession(); bkRender(); }
  function bkSlotClick(pi,s){ bk.focus=pi;
    if(!bk.sel) bk.sel=[pi,s]; else if(bk.sel[0]===pi&&bk.sel[1]===s) bk.sel=null;
    else { var A=bk.pages[bk.sel[0]].imgs, B=bk.pages[pi].imgs, tmp=A[bk.sel[1]]||null; A[bk.sel[1]]=B[s]||null; B[s]=tmp; bk.sel=null; return bkSave(); }
    bkRender(); }
  function bkPlace(i, pi, s){ var id=stId(i);
    if(s==null&&pi==null&&bk.sel){ pi=bk.sel[0]; s=bk.sel[1]; bk.sel=null; }
    if(pi==null) pi=bk.focus; var pg=bk.pages[pi], n=bkBoxes(pg.tpl).length;
    if(s==null){ if(!n){ pg.tpl="centre"; n=1; } for(var k=0;k<n;k++){ if(stById(pg.imgs[k])<0){ s=k; break; } } }
    if(s==null){ toast("This page is full. Click a frame on it first, then the pick that replaces it."); return; }
    pg.imgs[s]=id; bk.focus=pi; bkSave(); }
  function bkSetTpl(t){ var pg=bk.pages[bk.focus]; if(!pg) return; pg.tpl=t; bk.sel=null; bkSave(); }
  function bkCycleTpl(){ var pg=bk.pages[bk.focus]; bkSetTpl(BK_TPL[(BK_TPL.indexOf(pg.tpl)+1)%BK_TPL.length]); }
  function bkAddSpread(){ var L=bk.pages.length-1; bk.pages.splice(L,0,{tpl:"centre",imgs:[null]},{tpl:"centre",imgs:[null]}); bk.spread=bkSpreads().length-2; bk.focus=L; bkSave(); }
  function bkBind(){ if(bk.bound) return; bk.bound=true; var box=$("st-book");
    box.addEventListener("dragstart",function(e){ var p=e.target.closest&&e.target.closest("[data-bk-pic]"); if(!p) return; e.dataTransfer.setData("text/plain","bk:"+p.getAttribute("data-bk-pic")); e.dataTransfer.effectAllowed="copy"; });
    box.addEventListener("dragover",function(e){ if(e.target.closest("[data-bk-page]")){ e.preventDefault(); e.dataTransfer.dropEffect="copy"; } });
    box.addEventListener("drop",function(e){ var d=e.dataTransfer.getData("text/plain")||"", list=d.slice(0,3)==="bk:"?[+d.slice(3)]:libParse(d); if(!list.length) return;
      var sl=e.target.closest("[data-bk-slot]"), pg=e.target.closest("[data-bk-page]"); if(!sl&&!pg) return; e.preventDefault(); bk.sel=null;
      if(sl){ var q=sl.getAttribute("data-bk-slot").split(":"); bkPlaceMany(list,+q[0],+q[1]); } else bkPlaceMany(list,+pg.getAttribute("data-bk-page")); }); }
  /* several frames dropped (a selection or a whole folder): the first goes where it lands, the rest fill the empty slots on that page and the pages after it */
  function bkPlaceMany(list, pi, s){ if(list.length===1) return bkPlace(list[0], pi, s); var k=0, ids=list.map(stId), last=bk.pages.length-1;
    if(s!=null) bk.pages[pi].imgs[s]=ids[k++];
    for(var p=pi;p<last&&k<ids.length;p++){ var pg=bk.pages[p]; if(pg.back) break; var n=bkBoxes(pg.tpl).length;
      if(!n&&p===pi){ pg.tpl="centre"; n=1; }
      for(var j=0;j<n&&k<ids.length;j++){ if(stById(pg.imgs[j])<0) pg.imgs[j]=ids[k++]; } }
    bk.focus=pi; bkSave();
    if(k<ids.length) toast((ids.length-k)+" frame"+(ids.length-k===1?"":"s")+" didn't fit. Add a spread with + or swap some out."); }
  // export: every spread as one PDF page at 150 dpi, trimmed to the book size
  function bkExport(){ if(!bk.pages.length) return; var sp=bkSpreads(), a=bkMM(), k=150/25.4, PW=Math.round(a[0]*k), PH=Math.round(a[1]*k), cans=[], left=0, started=false; toast("Building your book PDF…"); qFlag("bookPdf");
    sp.forEach(function(s,j){ var cv=document.createElement("canvas"); cv.width=PW*s.length; cv.height=PH; var g=cv.getContext("2d"); g.fillStyle="#f4f1ea"; g.fillRect(0,0,cv.width,cv.height); cans[j]=cv;
      s.forEach(function(pi,c){ var pg=bk.pages[pi];
        if(pi>0&&!pg.back&&pg.tpl!=="bleed"){ g.fillStyle="#9a9384"; g.font=Math.round(3*k)+"px Geist Mono, monospace"; g.textAlign=c===0&&s.length>1?"left":"right"; g.fillText(String(pi+1), c===0&&s.length>1?c*PW+14*k:c*PW+PW-14*k, PH-12*k); }
        bkRects(pi).forEach(function(r){ if(r.i<0) return; left++; started=true; var im=new Image();
          im.onload=function(){ var x=c*PW+r.x*PW, y=r.y*PH, w=r.w*PW, h=r.h*PH, q=Math.max(w/im.width,h/im.height), sw=w/q, sh=h/q; g.drawImage(im,(im.width-sw)/2,(im.height-sh)/2,sw,sh,x,y,w,h); if(--left===0) pbBuildPDF(cans); };
          im.onerror=function(){ if(--left===0) pbBuildPDF(cans); }; im.src=photos[r.i].url; }); }); });
    if(!started) pbBuildPDF(cans); }

  // ---- 06 GALLERY: hang the picks at true size on a rendered gallery wall ----
  // The wall render's view is 1100 x 735 (design px); the ceiling is taken as 3.2 m, so 0.1818 px per mm and the
  // floor line at y 658.4. Prints are centred on the 1450 mm eye line, matted and framed, spaced as you set.
  var GA_WALL="asset:assets/gallery/wall-a.webp", GA_G=0.1818, GA_FLOOR=658.4, GA_SIZES=[400,600,900,1200];
  var ga={frame:"black", gap:250, sizes:{}, pos:{}, title:"", list:null, label:{x:null, y:null, style:"vinyl", size:1}, drag:null, justDragged:false};
  // what's on the wall: your own list once you've added or taken anything down, until then your picks
  function gaPrints(){ if(ga.list) return ga.list.map(stById).filter(function(i){ return i>=0; }); return gaDefault(); }
  function gaListInit(){ if(!ga.list) ga.list=gaDefault().map(stId); }
  function gaAdd(i, at){ gaListInit(); var u=stId(i); if(ga.list.indexOf(u)<0){ ga.list.push(u); sfx("gaHang"); } else if(!at){ toast("That one's already on the wall"); return; }
    if(at) ga.pos[u]={x:at.x, y:at.y}; saveSession(); gaRender(); }
  function gaRemove(i){ gaListInit(); var u=stId(i); ga.list=ga.list.filter(function(x){ return x!==u; }); delete ga.pos[u]; delete ga.sizes[u]; ga.removed=(ga.removed||0)+1; saveSession(); gaRender(); }
  function gaDefault(){ var pk=stPicks(); if(!pk.length) pk=photos.map(function(_,i){ return i; }).filter(function(i){ return (photos[i].rating||0)>=3; });
    if(!pk.length) pk=photos.map(function(_,i){ return i; }).slice(-5); return pk.slice(0,7); }
  function gaLayout(){ var pr=gaPrints(), mat=ga.frame==="float"?0:55, fw=ga.frame==="float"?0:15, wallMM=1100/GA_G;
    var items=pr.slice(0,12).map(function(i,k){ var a=stAspect(i), s=ga.sizes[stId(i)]; if(s==null) s=(k===Math.floor((pr.length-1)/2))?3:1;
      var L=GA_SIZES[s], w=a>=1?L:Math.round(L*a), h=a>=1?Math.round(L/a):L; return {i:i, s:s, w:w, h:h, W:w+2*(mat+fw), H:h+2*(mat+fw), mat:mat, fw:fw}; });
    var total=items.reduce(function(a,it){ return a+it.W; },0)+ga.gap*Math.max(0,items.length-1), k=Math.min(1,(wallMM*0.9)/Math.max(total,1));
    var x=(wallMM-total*k)/2, eye=GA_FLOOR-1450*GA_G;
    items.forEach(function(it){ it.x=x*GA_G; it.pw=it.W*k*GA_G; it.ph=it.H*k*GA_G; it.y=eye-it.ph/2; it.k=k; x+=(it.W+ga.gap)*k;
      var p=ga.pos[stId(it.i)]; if(p){ it.x=p.x*GA_G-it.pw/2; it.y=GA_FLOOR-p.y*GA_G-it.ph/2; it.moved=true; } });   // dragged prints stay where you hung them
    var endX=items.reduce(function(m,it){ return Math.max(m,it.x+it.pw); },0);
    return {items:items, eye:eye, endX:endX}; }
  // drag a print anywhere on the wall; its centre snaps to the 1450 mm eye line and to other prints' centres
  function gaDown(e){ var b=e.target.closest("[data-ga-print]"); if(!b||e.button!==0) return; var i=+b.getAttribute("data-ga-print"), box=$("st-gallery"), inner=box.querySelector(".ga-in");
    var s=inner.getBoundingClientRect().width/1100, L=gaLayout(), it=L.items.filter(function(q){ return q.i===i; })[0]; if(!it) return;
    var x0=e.clientX, y0=e.clientY, cx0=it.x+it.pw/2, cy0=it.y+it.ph/2, others=L.items.filter(function(q){ return q.i!==i; }).map(function(q){ return {x:q.x+q.pw/2, y:q.y+q.ph/2}; }), eyeEl=inner.querySelector(".ga-eye");
    ga.drag={i:i, moved:false}; e.preventDefault();
    function mv(ev){ var dx=(ev.clientX-x0)/s, dy=(ev.clientY-y0)/s; if(!ga.drag.moved&&Math.abs(dx)+Math.abs(dy)<5) return; ga.drag.moved=true; b.classList.add("dragging");
      var cx=cx0+dx, cy=cy0+dy, th=10, snapY=false; if(Math.abs(cy-L.eye)<th){ cy=L.eye; snapY=true; }
      others.forEach(function(o){ if(Math.abs(cx-o.x)<th) cx=o.x; if(!snapY&&Math.abs(cy-o.y)<th) cy=o.y; });
      cx=Math.max(it.pw/2, Math.min(1100-it.pw/2, cx)); cy=Math.max(it.ph/2+20, Math.min(GA_FLOOR-it.ph/2, cy));
      b.style.left=(cx-it.pw/2).toFixed(1)+"px"; b.style.top=(cy-it.ph/2).toFixed(1)+"px"; eyeEl.classList.toggle("hot", snapY);
      ga.drag.cx=cx; ga.drag.cy=cy; }
    function up(){ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); eyeEl.classList.remove("hot"); b.classList.remove("dragging");
      if(ga.drag&&ga.drag.moved){ ga.pos[stId(i)]={x:ga.drag.cx/GA_G, y:(GA_FLOOR-ga.drag.cy)/GA_G}; ga.justDragged=true; setTimeout(function(){ ga.justDragged=false; },60); saveSession(); gaRender(); }
      ga.drag=null; }
    window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); }
  function gaRender(){ var box=$("st-gallery"); if(!box) return; var lb0=ga.label||(ga.label={style:"vinyl",size:1}); if(!lb0.picked&&(!lb0.style||lb0.style==="card")) lb0.style="vinyl";   /* lettered on the wall unless the student chose a style (saves from before kept "card" as the old default) */
    var view=box.querySelector(".ga-wall"); var bgi=box.querySelector(".ga-bg"); if(bgi&&!bgi.getAttribute("src")) bgi.src=GA_WALL;
    var area=box.querySelector(".ga-area"), aw=area.clientWidth, ah=area.clientHeight-30, s=Math.min(aw/1100, ah/735);
    view.style.width=(1100*s)+"px"; view.style.height=(735*s)+"px"; var inner=view.querySelector(".ga-in"); inner.style.transform="scale("+s+")";
    var L=gaLayout(), fc={black:"#151311",oak:"#8a6a45",white:"#f4f1ea",float:"transparent"}[ga.frame], html="";
    L.items.forEach(function(it){ var p=photos[it.i], pad=it.fw*it.k*GA_G, mp=it.mat*it.k*GA_G;
      html+='<span class="ga-spot" style="left:'+(it.x+it.pw/2-170)+'px;top:'+(it.y-150)+'px;height:'+(it.ph+300)+'px"></span>'
        +'<button class="ga-print'+(ga.frame==="float"?' float':'')+'" data-ga-print="'+it.i+'" style="left:'+it.x.toFixed(1)+'px;top:'+it.y.toFixed(1)+'px;width:'+it.pw.toFixed(1)+'px;height:'+it.ph.toFixed(1)+'px;padding:'+pad.toFixed(1)+'px;background:'+fc+'">'
        +'<span class="mat" style="padding:'+mp.toFixed(1)+'px"><img src="'+p.url+'" alt="" draggable="false"></span><span class="sz">'+it.w+' × '+it.h+' MM</span><i class="ga-x" data-ga-del="'+it.i+'" title="Take it down">×</i></button>'; });
    var lx=Math.min(L.endX+10, 1100-80); box.querySelector(".ga-rehang").classList.toggle("hidden", !Object.keys(ga.pos).length);
    if(!ga.bound){ ga.bound=true; inner.querySelector(".ga-hang").addEventListener("pointerdown",gaDown); inner.querySelector(".ga-hang").addEventListener("pointerdown",gaLabelDown);
      // drop frames from the library onto the wall: they hang where you let go
      view.addEventListener("dragover",function(e){ e.preventDefault(); view.classList.add("drop"); }); view.addEventListener("dragleave",function(){ view.classList.remove("drop"); });
      view.addEventListener("drop",function(e){ e.preventDefault(); view.classList.remove("drop"); var idx=libPayload(e); if(!idx.length) return; var r=inner.getBoundingClientRect(), sc=r.width/1100, x=(e.clientX-r.left)/sc, y=(e.clientY-r.top)/sc;
        idx.slice(0,8).forEach(function(i,j){ gaAdd(i, {x:(x+j*60)/GA_G, y:(GA_FLOOR-y)/GA_G}); }); });
      var lib0=box.querySelector(".ga-lib"); if(lib0) lib0.addEventListener("click",function(e){ var p=e.target.closest("[data-bd-pic]"); if(!p||e.ctrlKey||e.metaKey||e.shiftKey) return; gaAdd(+p.getAttribute("data-bd-pic")); }); }
    libRender(box.querySelector(".ga-lib"), "gallery");
    Array.prototype.forEach.call(box.querySelectorAll("[data-ga-label]"),function(b){ b.classList.toggle("on", b.getAttribute("data-ga-label")===(ga.label.style||"vinyl")); });
    Array.prototype.forEach.call(box.querySelectorAll("[data-ga-lsize]"),function(b){ b.classList.toggle("on", +b.getAttribute("data-ga-lsize")===(ga.label.size||1)); });
    var lb=ga.label, lxx=lb.x!=null?lb.x*GA_G:lx, lyy=lb.y!=null?GA_FLOOR-lb.y*GA_G:GA_FLOOR-1300*GA_G;
    if(lb.style!=="none") html+='<div class="ga-label '+lb.style+' s'+(lb.size||1)+'" style="left:'+lxx.toFixed(1)+'px;top:'+lyy.toFixed(1)+'px" title="Drag to move it"><i class="ga-grip">⠿</i><div class="ga-t" contenteditable="true" data-ph="Title of the show">'+cbEsc(ga.title)+'</div><span>'+cbEsc((studentName||"YOUR NAME").toUpperCase())+'<br>'+new Date().getFullYear()+' · '+L.items.length+' PRINTS</span></div>';
    inner.querySelector(".ga-hang").innerHTML=html; inner.querySelector(".ga-eye").style.top=L.eye+"px";
    var t=inner.querySelector(".ga-t"); if(t){ t.oninput=function(){ ga.title=t.textContent; saveSession(); }; t.onkeydown=function(e){ e.stopPropagation(); if(e.key==="Enter"||e.key==="Escape"){ e.preventDefault(); t.blur(); } }; }
    Array.prototype.forEach.call(box.querySelectorAll("[data-ga-frame]"),function(b){ b.classList.toggle("on", b.getAttribute("data-ga-frame")===ga.frame); });
    box.querySelector(".ga-gapv").textContent=ga.gap+" mm"; box.querySelector(".ga-gapbar i").style.width=((ga.gap-100)/400*100)+"%"; box.querySelector(".ga-gapbar b").style.left=((ga.gap-100)/400*100)+"%";
    box.querySelector(".ga-plan").innerHTML=L.items.map(function(it){ return '<rect x="'+(14+it.x/1100*200).toFixed(1)+'" y="17" width="'+Math.max(3,it.pw/1100*200).toFixed(1)+'" height="3" fill="#e3ad57"/>'; }).join(""); }
  // the title card: drag it by its edge (the text itself is for typing)
  function gaLabelDown(e){ var lb=e.target.closest(".ga-label"); if(!lb||e.button!==0) return; if(e.target.closest(".ga-t")&&document.activeElement===e.target.closest(".ga-t")) return;
    var inner=$("st-gallery").querySelector(".ga-in"), s=inner.getBoundingClientRect().width/1100, x0=e.clientX, y0=e.clientY, l0=parseFloat(lb.style.left), t0=parseFloat(lb.style.top), moved=false;
    function mv(ev){ var dx=(ev.clientX-x0)/s, dy=(ev.clientY-y0)/s; if(!moved&&Math.abs(dx)+Math.abs(dy)<4) return; if(!moved){ moved=true; lb.classList.add("dragging"); }
      lb.style.left=Math.max(0,Math.min(1100-lb.offsetWidth,l0+dx)).toFixed(1)+"px"; lb.style.top=Math.max(10,Math.min(GA_FLOOR-lb.offsetHeight,t0+dy)).toFixed(1)+"px"; }
    function up(){ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); lb.classList.remove("dragging");
      if(moved){ ga.label.x=parseFloat(lb.style.left)/GA_G; ga.label.y=(GA_FLOOR-parseFloat(lb.style.top))/GA_G; ga.labelMoves=(ga.labelMoves||0)+1; saveSession(); gaRender(); }
      else { var t=lb.querySelector(".ga-t"); if(t){ t.focus(); } } }
    window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); }
  function gaCycleSize(i){ var u=stId(i), cur=ga.sizes[u]; if(cur==null){ var L=gaLayout(); L.items.forEach(function(it){ if(it.i===i) cur=it.s; }); } ga.sizes[u]=((cur||0)+1)%GA_SIZES.length; saveSession(); gaRender(); }
  function gaCycleFrame(){ var F=["black","oak","white","float"]; ga.frame=F[(F.indexOf(ga.frame)+1)%F.length]; saveSession(); gaRender(); }
  function gaExport(){ var L=gaLayout(), W=2200, H=1470, sc=W/1100, cv=document.createElement("canvas"); cv.width=W; cv.height=H; var g=cv.getContext("2d"), wall=new Image();
    wall.onload=function(){ g.drawImage(wall,0,0,W,H); var left=L.items.length; if(!left) done();
      L.items.forEach(function(it){ var im=new Image(); im.onload=function(){ var x=it.x*sc, y=it.y*sc, w=it.pw*sc, h=it.ph*sc, pad=it.fw*it.k*GA_G*sc, mp=it.mat*it.k*GA_G*sc;
          g.save(); g.shadowColor="rgba(0,0,0,.45)"; g.shadowBlur=24; g.shadowOffsetY=14; g.fillStyle=ga.frame==="float"?"#000":{black:"#151311",oak:"#8a6a45",white:"#f4f1ea"}[ga.frame]; g.fillRect(x,y,w,h); g.restore();
          if(mp){ g.fillStyle="#f7f4ee"; g.fillRect(x+pad,y+pad,w-2*pad,h-2*pad); }
          var ix=x+pad+mp, iy=y+pad+mp, iw=w-2*(pad+mp), ih=h-2*(pad+mp), r=Math.max(iw/im.width, ih/im.height), sw=iw/r, sh=ih/r; g.drawImage(im,(im.width-sw)/2,(im.height-sh)/2,sw,sh,ix,iy,iw,ih);
          if(--left===0) done(); }; im.onerror=function(){ if(--left===0) done(); }; im.src=photos[it.i].url; }); };
    function label(){ var lb=ga.label||{}, el=$("st-gallery").querySelector(".ga-label"); if(lb.style==="none"||!el) return; var x=parseFloat(el.style.left)*sc, y=parseFloat(el.style.top)*sc, w=el.offsetWidth*sc, h=el.offsetHeight*sc, k=(lb.size||1);
      if(lb.style!=="vinyl"){ g.fillStyle=lb.style==="plaque"?"#151311":"#f7f4ee"; g.fillRect(x,y,w,h); }
      g.fillStyle=lb.style==="plaque"?"#f4f1ea":"#1c1915"; g.font=Math.round((lb.style==="vinyl"?26:11)*k*sc)+"px Fraunces, Georgia, serif"; g.textBaseline="top"; g.fillText(ga.title||"",x+8*sc,y+7*sc); }
    wall.src=GA_WALL;
    function done(){ try{ label(); }catch(e){} cv.toBlob(function(b){ var a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=namePrefix()+"gallery-wall.png"; document.body.appendChild(a); a.click(); a.remove(); toast("Gallery wall saved"); },"image/png"); } }

  // ---- input ----
  function stKey(e){ var c=e.code, typing=e.target&&(e.target.tagName==="TEXTAREA"||e.target.tagName==="INPUT"||e.target.isContentEditable);
    if(typing) return true;
    if(c==="KeyQ"&&!e.ctrlKey&&!e.metaKey){ stCycle(-1); return true; } if(c==="KeyE"&&!e.ctrlKey&&!e.metaKey){ stCycle(1); return true; }
    var bd=stBoard(); if(bd&&c!=="KeyQ"&&c!=="KeyE"&&bd.key(e)) return true;
    if(c==="Escape"){ e.preventDefault(); if(st.room==="select"&&st.zoom) stZoom(false); else if(st.room==="select"&&st.cmp>=0){ st.cmp=-1; stRenderSelect(); } else if(st.room==="select") closeStudio(); else stRoom("select"); return true; }
    if(ST_LEGACY[st.room]) return false;   // the editor and builders keep their own keys
    if(st.room==="select"){ if(c==="ArrowRight") stMove(1); else if(c==="ArrowLeft") stMove(-1); else if(c==="ArrowDown") stMove(st.cols); else if(c==="ArrowUp") stMove(-st.cols);
      else if(c==="KeyP") stTogglePick(); else if(c==="KeyX") stToggleReject(); else if(c==="KeyV") stCompare(); else if(c==="KeyZ") stZoom(); else if(/^Digit[0-5]$/.test(c)){ var s=+c.slice(5); if(s===0){ var p=photos[st.cur]; if(p){ p.rating=0; saveSession(); stRenderSelect(); } } else stRate(s); }
      else if(c==="Enter"&&photos.length) stRoom("edit"); else return true; e.preventDefault(); return true; }
    if(st.room==="book"){ var sn=bkSpreads().length;
      if(c==="ArrowRight"){ if(bk.spread<sn-1) sfx("bkTurn"); bk.spread=Math.min(sn-1,bk.spread+1); bk.sel=null; bkRender(); } else if(c==="ArrowLeft"){ if(bk.spread>0) sfx("bkTurn"); bk.spread=Math.max(0,bk.spread-1); bk.sel=null; bkRender(); }
      else if(c==="KeyT") bkCycleTpl(); else if(c==="KeyB"){ bkSetTpl(bk.pages[bk.focus].tpl==="bleed"?"centre":"bleed"); }
      else if((c==="Delete"||c==="Backspace")&&bk.sel){ bk.pages[bk.sel[0]].imgs[bk.sel[1]]=null; bk.sel=null; bkSave(); } else return true; e.preventDefault(); return true; }
    if(st.room==="gallery"){ if(c==="KeyF") gaCycleFrame(); else if(c==="ArrowRight"){ ga.gap=Math.min(500,ga.gap+50); gaRender(); } else if(c==="ArrowLeft"){ ga.gap=Math.max(100,ga.gap-50); gaRender(); }
      else if(c==="KeyW"&&photos.length){ openGalleryShow(); document.body.classList.add("st-legacy"); } return true; }
    return true; }
  function stClick(e){ var bp=st.room==="book"&&e.target.closest&&e.target.closest("#st-book [data-bd-pic]"); if(bp){ if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey) bkPlace(+bp.getAttribute("data-bd-pic")); return; }   /* click a frame in the rail: it goes on the page in focus */
    var t=e.target.closest("[data-bk-slot],[data-bk-pic],[data-bk-spread],[data-bk-size],[data-bk-tpl],[data-bk-act],[data-bk-page],[data-ga-print],[data-ga-frame],[data-ga-act],[data-ga-label],[data-ga-lsize],[data-st-room],[data-st-frame],[data-st-rate],[data-st-act],[data-st-close],[data-st-size],[data-st-hiderej],[data-st-zoom]"); if(!t) return;
    if(t.hasAttribute("data-st-zoom")) return stZoom();
    if(t.hasAttribute("data-st-size")){ st.thumb=t.getAttribute("data-st-size"); return stRenderSelect(); }
    if(t.hasAttribute("data-st-hiderej")){ st.hideRej=!st.hideRej; return stRenderSelect(); }
    if(t.hasAttribute("data-st-close")) return closeStudio();
    if(t.hasAttribute("data-bk-slot")){ var q=t.getAttribute("data-bk-slot").split(":"); return bkSlotClick(+q[0],+q[1]); }
    if(t.hasAttribute("data-bk-page")){ bk.focus=+t.getAttribute("data-bk-page"); bk.sel=null; return bkRender(); }
    if(t.hasAttribute("data-bk-pic")) return bkPlace(+t.getAttribute("data-bk-pic"));
    if(t.hasAttribute("data-bk-spread")){ if(+t.getAttribute("data-bk-spread")!==bk.spread) sfx("bkTurn"); bk.spread=+t.getAttribute("data-bk-spread"); bk.sel=null; return bkRender(); }
    if(t.hasAttribute("data-bk-size")){ bk.size=t.getAttribute("data-bk-size"); return bkSave(); }
    if(t.hasAttribute("data-bk-tpl")) return bkSetTpl(t.getAttribute("data-bk-tpl"));
    if(t.hasAttribute("data-bk-act")){ var ba=t.getAttribute("data-bk-act"); if(ba==="add") bkAddSpread(); else if(ba==="export") bkExport(); else if(ba==="rebuild"){ bk.pages=[]; bkSave(); } return; }
    if(e.target.closest("[data-ga-del]")){ return gaRemove(+e.target.closest("[data-ga-del]").getAttribute("data-ga-del")); }
    if(t.hasAttribute("data-ga-label")){ ga.label.style=t.getAttribute("data-ga-label"); ga.label.picked=true; ga.labelStyles=(ga.labelStyles||0)+1; saveSession(); return gaRender(); }
    if(t.hasAttribute("data-ga-lsize")){ ga.label.size=+t.getAttribute("data-ga-lsize"); saveSession(); return gaRender(); }
    if(t.hasAttribute("data-ga-print")){ if(ga.justDragged) return; return gaCycleSize(+t.getAttribute("data-ga-print")); }
    if(t.hasAttribute("data-ga-frame")){ ga.frame=t.getAttribute("data-ga-frame"); saveSession(); return gaRender(); }
    if(t.hasAttribute("data-ga-act")){ var ga_=t.getAttribute("data-ga-act"); if(ga_==="rehang"){ ga.pos={}; if(ga.label){ ga.label.x=null; ga.label.y=null; } saveSession(); return gaRender(); } if(ga_==="walk"&&photos.length){ openGalleryShow(); document.body.classList.add("st-legacy"); } else if(ga_==="export") gaExport(); return; }
    if(t.hasAttribute("data-st-room")) return stRoom(t.getAttribute("data-st-room"));
    if(t.hasAttribute("data-st-frame")&&(e.ctrlKey||e.metaKey||e.shiftKey)){ var j=+t.getAttribute("data-st-frame");   // select several, to drag into a project or start one
      if(e.shiftKey){ var L=libItems(LIB.key), a=L.indexOf(st.cur), b=L.indexOf(j); for(var q=Math.min(a,b);q<=Math.max(a,b);q++) if(q>=0) LIB.sel[L[q]]=true; } else LIB.sel[j]=!LIB.sel[j];
      LIB.sel[st.cur]=LIB.sel[st.cur]||e.shiftKey; return stRenderSelect(); }
    if(t.hasAttribute("data-st-frame")){ var i=+t.getAttribute("data-st-frame"); if(e.detail>=2&&i===st.cur) return stRoom("edit"); st.cur=i; return stRenderSelect(); }
    if(t.hasAttribute("data-st-rate")) return stRate(+t.getAttribute("data-st-rate"));
    if(t.hasAttribute("data-st-act")){ var a=t.getAttribute("data-st-act"); if(a==="pick") stTogglePick(); else if(a==="reject") stToggleReject(); else if(a==="compare") stCompare(); else if(a==="edit"&&photos.length) stRoom("edit"); else if(a==="punctum"){ closeStudio(); openPunctum(); } return; } }
  (function wireStudio(){ var el=$("studioX"); if(!el) return; el.addEventListener("click",stClick);
    el.addEventListener("dragstart",function(e){ var c=e.target.closest&&e.target.closest("[data-st-frame]"); if(!c) return; var i=+c.getAttribute("data-st-frame"), list=LIB.sel[i]?libSelList():[i];
      e.dataTransfer.setData("text/plain","bd:"+list.join(",")); e.dataTransfer.effectAllowed="copy"; });
    window.addEventListener("resize",function(){ stRerender(); });
    // the legacy builders' own Back buttons return to the studio's Select room
    ["eCancel"].forEach(function(id){ var b=$(id); if(!b) return; b.addEventListener("click",function(ev){ if(!st.open) return; ev.stopImmediatePropagation(); stRoom("select"); },true); });
    var gx=$("gxBack"); if(gx) gx.addEventListener("click",function(ev){ if(!st.open) return; ev.stopImmediatePropagation(); $("galleryshow").classList.add("hidden"); document.body.classList.remove("st-legacy"); stRoom("gallery"); },true); })();

  // ---- Finished: a glowing button on the pages a quest asks for. Compare pages need an eight-word sentence; artist model pages need
  //      their photos. Nothing counts until it's pressed, so nobody gets hurried off a page, and once pressed it leaves. ----
  (function wsDoneWire(){ var btn=null, MIN=8;
    function words(s){ return String(s||"").trim().split(/\s+/).filter(Boolean).length; }
    function pageKind(pg){ return !pg?null:pg.tpl==="compare"?"compare":(pg.tpl==="artist"||pg.tpl==="research")?"artist":null; }
    function tick(){ var show=false, pg=null, kind=null, anchor=null, n=0, ok=false;
      if(st.open&&st.room==="workshop"&&typeof wsB!=="undefined"){ pg=wsB.page(); kind=pageKind(pg); }
      if(kind==="compare"){ var k=-1, it=null; pg.items.forEach(function(x,j){ if(k<0&&x.t==="text"&&x.sentence){ k=j; it=x; } }); anchor=k>=0?document.querySelector('#st-workshop .bd-sheet [data-bd="'+k+'"]'):null; n=it?words(it.text):0; ok=n>=MIN; }
      else if(kind==="artist"){ anchor=document.querySelector('#st-workshop .bd-sheet'); n=pg.items.filter(function(x){ return x.t==="photo"; }).length; ok=n>=1;
        var aq=pg.items.filter(function(x){ return x.t==="text"&&x.sentence; })[0]; if(aq&&ok){ n=words(String(aq.text||"").replace(aq.ph||"","")); ok=n>=MIN; kind="answer"; } }   /* a page with a question to answer waits for the answer */
      var r=anchor?anchor.getBoundingClientRect():null;
      if(r&&r.width>4&&r.bottom>0&&r.top<innerHeight){ show=true;
        if(!btn){ btn=document.createElement("button"); btn.id="wsDone"; btn.className="ws-done"; document.body.appendChild(btn);
          btn.addEventListener("click",function(e){ e.stopPropagation(); var pg2=wsB.page(), kd=pageKind(pg2); if(!pg2||pg2.done) return;
            var t=pg2.items.filter(function(x){ return x.t==="text"&&x.sentence; })[0]; if((kd==="compare"||t)&&(!t||words(kd==="compare"?t.text:String(t.text||"").replace(t.ph||"",""))<MIN)) return;
            pg2.done=true; if(kd==="compare"&&typeof qFlag==="function") qFlag("compared"); try{ if(typeof wsB.save==="function") wsB.save(); }catch(er){} btn.classList.add("ok");
            toast(kd==="compare"?"Finished. Your comparison is saved in the workbook.":"Finished. Your artist model page is in the workbook."); if(typeof qTick==="function") qTick(); }); }
        var done=!!pg.done;
        if(done&&!btn._doneAt) btn._doneAt=Date.now(); if(!done) btn._doneAt=0;
        if(done&&Date.now()-btn._doneAt>1600) show=false;   /* a finished page doesn't keep a button on it */
        btn.disabled=!ok||done; btn.classList.toggle("ok",done); btn.classList.toggle("ready",ok&&!done); btn.classList.toggle("count",!ok&&!done);
        btn.innerHTML=done?'✓ FINISHED':ok?'FINISHED ›':(kind==="compare"||kind==="answer")?'<small>'+n+' / '+MIN+' WORDS</small>':'<small>ADD A PHOTO</small>';
        var x, y; if(kind==="compare"){ x=Math.min(innerWidth-btn.offsetWidth-12, r.right+12); y=r.bottom-btn.offsetHeight; if(x<r.right+4){ x=r.right-btn.offsetWidth; y=r.bottom+10; } }
        else { x=r.right-btn.offsetWidth-14; y=r.bottom+14; if(y+btn.offsetHeight>innerHeight-8) y=r.bottom-btn.offsetHeight-14; }
        btn.style.left=x+"px"; btn.style.top=Math.max(8,y)+"px"; }
      if(btn) btn.classList.toggle("show",show); }
    setInterval(tick, 200); })();
  /* ?dev: fill the darkroom with n plain test frames (half picked, two locations) and open a room, for checking layouts headless */
  if(/[?&]dev/.test(location.search)) window.__st={ fake:function(n){ for(var i=0;i<(n||8);i++){ var c=document.createElement("canvas"); c.width=i%3?600:400; c.height=i%3?400:600; var g=c.getContext("2d"); g.fillStyle="hsl("+(i*40)+",40%,45%)"; g.fillRect(0,0,c.width,c.height);
      photos.push({url:c.toDataURL("image/jpeg",0.8), pick:i<6, rating:3, place:i<4?"Riverbank":"Studio"}); } return photos.length; }, open:openStudio, room:stRoom, tour:coStart, ga:function(){ return ga; }, bk:function(){ return bk; } };
