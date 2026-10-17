  // ================= BOARD: a free layout page, used by Workshop (A3 landscape) and Folio (A0 portrait) =================
  // Everything sits on the page in millimetres. Photos always keep their own shape (3:2 stays 3:2, 6x7 stays 6x7):
  // you size them from a corner, never crop them. Workshop pages also take text. Every item is a layer you can
  // hide, lock and reorder. Layouts are starting points: they place the frames on the page (true aspect, fitted
  // into rows or cells) and then you move them about. Pages hold different versions, so students can play.
  var BD_FILTERS={none:["ORIGINAL","none"], bw:["B&W","grayscale(1) contrast(1.25)"], faded:["FADED","contrast(.8) brightness(1.08) saturate(.7) sepia(.12)"], warm:["WARM","sepia(.22) saturate(1.15)"], punch:["PUNCH","contrast(1.2) saturate(1.2)"]};
  var BD_FONTS={serif:["SERIF","'Fraunces', Georgia, serif"], sans:["SANS","'Geist', system-ui, sans-serif"], type:["TYPEWRITER","'Courier Prime', 'Courier New', Courier, monospace"], mono:["MONO","'Geist Mono', ui-monospace, monospace"]};
  // page colours for workbook pages; text, lines and arrows default to whichever ink reads on them
  var BD_BGS={white:["WHITE","#f7f5f0"], cream:["CREAM","#e9e2d2"], grey:["GREY","#8e8b86"], charcoal:["CHARCOAL","#2f2f31"], black:["BLACK","#0f0e0c"]};
  var BD_INKS={ink:["#1c1915","INK"], bone:["#f4f1ea","WHITE"], grey:["#8d8678","GREY"], gold:["#d9a24a","GOLD"], red:["#d94a2b","RED"]};
  function bdDark(bg){ return bg==="grey"||bg==="charcoal"||bg==="black"; }
  function bdUid(){ return Math.random().toString(36).slice(2,9); }
  // justified rows: frames keep their shape, rows share a height, the whole block fits the box. With up to a dozen
  // frames it tries every way of breaking them into rows and keeps the one that fills the box most completely.
  function bdRows(box, asp, gap){ var n=asp.length, best=null; if(!n) return [];
    function judge(rows){ var hs=rows.map(function(row){ var s=row.reduce(function(a,i){ return a+asp[i]; },0); return (box.w-gap*(row.length-1))/s; }), H=hs.reduce(function(a,b){ return a+b; },0)+gap*(rows.length-1);
      var kk=Math.min(1, (box.h-gap*(rows.length-1))/(H-gap*(rows.length-1))), fill=kk<1?kk*kk:(H/box.h);   // fraction of the box covered
      var crowd=rows.reduce(function(a,r){ return a+Math.max(0,r.length-4)*0.04; },0), lonely=rows.length>2?rows.filter(function(r){ return r.length===1; }).length*0.02:0;
      var score=fill-crowd-lonely; if(!best||score>best.score) best={score:score, rows:rows, hs:hs, k:kk, H:kk<1?box.h:H}; }
    if(n<=12){ for(var m=0;m<(1<<(n-1));m++){ var rows=[], cur=[0]; for(var i=1;i<n;i++){ if(m&(1<<(i-1))){ rows.push(cur); cur=[i]; } else cur.push(i); } rows.push(cur); judge(rows); } }
    else { var total=asp.reduce(function(a,b){ return a+b; },0);
      for(var r=1;r<=n;r++){ var rr=[], cc=[], acc=0, k=1;
        asp.forEach(function(a,i){ cc.push(i); acc+=a; var leftItems=n-i-1, leftRows=r-rr.length-1;
          if(leftRows>0&&leftItems>=leftRows&&(acc>=total*k/r-a/2||leftItems===leftRows)){ rr.push(cc); cc=[]; k++; } });
        if(cc.length) rr.push(cc); judge(rr); } }
    var out=[], y=box.y+(box.h-best.H)/2, kk=best.k;
    best.rows.forEach(function(row,ri){ var h=best.hs[ri]*kk, rw=row.reduce(function(a,i){ return a+asp[i]*h; },0)+gap*(row.length-1), x=box.x+(box.w-rw)/2;
      row.forEach(function(i){ out[i]={x:x, y:y, w:asp[i]*h}; x+=asp[i]*h+gap; }); y+=h+gap; });
    return out; }
  // a tight contact-sheet grid: equal 3:2 cells, as many columns as makes the frames biggest, block centred
  function bdGrid(box, asp, gap, cols, minC){ var n=asp.length; if(!n) return []; var best=null;
    for(var c=(cols||Math.min(n,minC||1));c<=(cols||n);c++){ var rows=Math.ceil(n/c), cw=(box.w-gap*(c-1))/c, ch=cw/1.5, H=rows*ch+gap*(rows-1), k=Math.min(1,box.h/H), area=cw*ch*k*k;
      if(!best||area>best.area) best={c:c, rows:rows, cw:cw*k, ch:ch*k, area:area}; }
    var bw=best.c*best.cw+gap*(best.c-1), bh=best.rows*best.ch+gap*(best.rows-1), x0=box.x+(box.w-bw)/2, y0=box.y+(box.h-bh)/2;
    return asp.map(function(a,i){ var c=i%best.c, r=Math.floor(i/best.c), w=Math.min(best.cw, best.ch*a), h=w/a; return {x:x0+c*(best.cw+gap)+(best.cw-w)/2, y:y0+r*(best.ch+gap)+(best.ch-h)/2, w:w}; }); }
  // uniform cells, each frame fitted inside its cell at its own shape
  function bdCells(box, asp, gap, cols){ var n=asp.length; if(!n) return []; cols=cols||Math.max(1,Math.round(Math.sqrt(n*box.w/box.h/1.4))); var rows=Math.ceil(n/cols),
      cw=(box.w-gap*(cols-1))/cols, ch=(box.h-gap*(rows-1))/rows;
    return asp.map(function(a,i){ var c=i%cols, r=Math.floor(i/cols), w=Math.min(cw, ch*a), h=w/a; return {x:box.x+c*(cw+gap)+(cw-w)/2, y:box.y+r*(ch+gap)+(ch-h)/2, w:w}; }); }
  function bdFit(box, a){ var w=Math.min(box.w, box.h*a); return {x:box.x+(box.w-w)/2, y:box.y+(box.h-w/a)/2, w:w}; }

  function Board(o){
    var B={o:o, doc:null, sel:[], hist:[], hi:-1, s:1, bound:false, edit:-1, caret:null};
    function doc(){ if(!B.doc){ B.doc=o.load()||{pages:[{id:bdUid(), items:[]}], cur:0, paper:"white"}; } var d=B.doc; if(!d.pages.length) d.pages.push({id:bdUid(), items:[]});
      if(o.panelW){   // a board of A1 panels side by side; older single-A0 boards come across scaled onto the first panel
        if(!d.panels){ var k=o.H/1189; d.pages.forEach(function(pg){ pg.items.forEach(function(it){ it.x*=k; it.y*=k; it.w*=k; if(it.h) it.h*=k; }); }); d.panels=3; }
        o.W=d.panels*o.panelW; }
      return d; }
    function page(){ var d=doc(); d.cur=Math.max(0,Math.min(d.pages.length-1,d.cur)); return d.pages[d.cur]; }
    function bgOf(pg){ return (o.bgs&&pg&&pg.bg)||doc().paper||"white"; }
    function inkOf(pg){ return bdDark(bgOf(pg))?"#f4f1ea":"#1c1915"; }
    function snap(){ return JSON.stringify(doc()); }
    function push(){ var s=snap(); if(B.hist[B.hi]===s) return; B.hist=B.hist.slice(0,B.hi+1); B.hist.push(s); if(B.hist.length>60) B.hist.shift(); B.hi=B.hist.length-1; }
    function commit(){ o.save(doc()); push(); render(); }
    function undo(d){ var j=B.hi+d; if(j<0||j>=B.hist.length) return; B.hi=j; B.doc=JSON.parse(B.hist[j]); B.sel=[]; B.edit=-1; o.save(B.doc); render(); toast(d<0?"Undo":"Redo"); }
    function idxOf(it){ return stById(it.pid); }
    function asp(it){ var i=idxOf(it); return i>=0?stAspect(i):1.5; }
    function hOf(it){ return it.t==="photo"?it.w/asp(it):it.t==="line"?Math.abs(it.y2-it.y):it.h; }
    function bb(it){ if(it.t==="line") return {x:Math.min(it.x,it.x2), y:Math.min(it.y,it.y2), w:Math.abs(it.x2-it.x), h:Math.abs(it.y2-it.y)}; return {x:it.x, y:it.y, w:it.w, h:hOf(it)}; }
    function name(it){ if(it.t==="photo"){ var i=idxOf(it); return i>=0?"Frame "+cbPad(i+1):"Missing frame"; }
      if(it.t==="line") return it.head==="none"?"Line":"Arrow"; if(it.t==="shape") return "Box"; if(it.t==="slot") return it.label||"Photo space";
      return (it.role==="title"?"Title":it.role==="caption"?"Caption":"Text")+" · "+(String(it.text||"").trim().slice(0,20)||"empty"); }
    function src(it){ var i=idxOf(it); return i>=0?photos[i].url:""; }
    // ---- drawing ----
    function arrowSVG(it,s,P){ var b=bb(it), ox=(b.x-P), oy=(b.y-P), x1=(it.x-ox)*s, y1=(it.y-oy)*s, x2=(it.x2-ox)*s, y2=(it.y2-oy)*s, c=it.color||inkOf(page()), wt=Math.max(1,(it.wt||0.7)*s);
      var heads="", hs=Math.max(6,wt*4.2);
      function head(ax,ay,bx,by){ var dx=bx-ax, dy=by-ay, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L; return '<polygon points="'+bx.toFixed(1)+','+by.toFixed(1)+' '+(bx-ux*hs-uy*hs*0.45).toFixed(1)+','+(by-uy*hs+ux*hs*0.45).toFixed(1)+' '+(bx-ux*hs+uy*hs*0.45).toFixed(1)+','+(by-uy*hs-ux*hs*0.45).toFixed(1)+'" fill="'+c+'"/>'; }
      if(it.head!=="none") heads+=head(x1,y1,x2,y2); if(it.head==="both") heads+=head(x2,y2,x1,y1);
      return '<svg width="'+((b.w+2*P)*s).toFixed(1)+'" height="'+((b.h+2*P)*s).toFixed(1)+'"><line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="'+c+'" stroke-width="'+wt.toFixed(1)+'" stroke-linecap="round"/>'+heads
        +'<line class="hit" x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'"/></svg>'; }
    function itemHTML(it,k,s){ var sel=B.sel.indexOf(k)>=0, one=sel&&B.sel.length===1&&!it.locked;
      if(it.t==="line"){ var P=4, b=bb(it);
        return '<div class="bd-it ln'+(sel?' sel':'')+(it.locked?' locked':'')+'" data-bd="'+k+'" style="left:'+((b.x-P)*s).toFixed(1)+'px;top:'+((b.y-P)*s).toFixed(1)+'px;z-index:'+(k+1)+'">'+arrowSVG(it,s,P)
          +(one?'<i class="bd-h pt" data-bd-h="a" style="left:'+((it.x-b.x+P)*s-5).toFixed(1)+'px;top:'+((it.y-b.y+P)*s-5).toFixed(1)+'px"></i><i class="bd-h pt" data-bd-h="b" style="left:'+((it.x2-b.x+P)*s-5).toFixed(1)+'px;top:'+((it.y2-b.y+P)*s-5).toFixed(1)+'px"></i>':'')+'</div>'; }
      var h=hOf(it), st_='left:'+(it.x*s).toFixed(1)+'px;top:'+(it.y*s).toFixed(1)+'px;width:'+(it.w*s).toFixed(1)+'px;height:'+(h*s).toFixed(1)+'px;z-index:'+(k+1);
      var handles=one?'<i class="bd-h nw" data-bd-h="nw"></i><i class="bd-h ne" data-bd-h="ne"></i><i class="bd-h sw" data-bd-h="sw"></i><i class="bd-h se" data-bd-h="se"></i>':'';
      var cls='bd-it '+({photo:'ph',text:'tx',shape:'sh',slot:'sl'}[it.t]||'tx')+(sel?' sel':'')+(it.locked?' locked':'');
      if(it.t==="photo") return '<div class="'+cls+'" data-bd="'+k+'" style="'+st_+'"><img src="'+src(it)+'" alt="" draggable="false" style="filter:'+BD_FILTERS[it.f||"none"][1]+'">'+(sel&&B.sel.length===1?'<span class="bd-sz">'+Math.round(it.w)+' × '+Math.round(h)+' MM</span>':'')+handles+'</div>';
      if(it.t==="shape") return '<div class="'+cls+'" data-bd="'+k+'" style="'+st_+';'+(it.outline?'border:'+Math.max(1,0.7*s).toFixed(1)+'px solid '+(it.fill||inkOf(page())):'background:'+(it.fill||"#2f2f31"))+'">'+handles+'</div>';
      if(it.t==="slot") return '<div class="'+cls+'" data-bd="'+k+'" style="'+st_+'"><span><b>'+cbEsc(it.label||"Photo")+'</b>Drag a frame here</span>'+handles+'</div>';
      var f=BD_FONTS[it.font||"serif"][1], fs=(it.size||14)*0.3528*s;
      return '<div class="'+cls+'" data-bd="'+k+'" style="'+st_+'"><div class="bd-tx" data-ph="'+cbEsc(it.ph||"Click to write")+'" style="font-family:'+f+';font-size:'+fs.toFixed(2)+'px;color:'+(it.color||inkOf(page()))+';text-align:'+(it.align||"left")+(it.bold?';font-weight:600':'')+'"'+(B.edit===k?' contenteditable="true"':'')+'>'+cbEsc(it.text||"")+'</div>'+handles+'</div>'; }
    function render(){ var box=$(o.el); if(!box||box.classList.contains("hidden")) return; bind(); var d=doc(), pg=page(), stage=box.querySelector(".bd-stage");
      var aw=stage.clientWidth-(o.tools?130:48), ah=stage.clientHeight-28, s=Math.max(0.05,Math.min(aw/o.W, ah/o.H)); B.s=s;
      var sh=box.querySelector(".bd-sheet"), bg=bgOf(pg); sh.style.width=(o.W*s).toFixed(1)+"px"; sh.style.height=(o.H*s).toFixed(1)+"px"; sh.className="bd-sheet "+(bdDark(bg)?"black":"white");
      sh.style.background=o.bgs?BD_BGS[bg][1]:"";
      pg.items.forEach(function(it){ if(it.t==="photo"&&it.box){ var r=bdTop(it.box, asp(it)); it.x=r.x; it.y=r.y; it.w=r.w; } });
      B.sel=B.sel.filter(function(k){ return k<pg.items.length&&!pg.items[k].hidden; });
      var html=""; pg.items.forEach(function(it,k){ if(!it.hidden) html+=itemHTML(it,k,s); });
      if(o.panelW) for(var p=1;p<d.panels;p++) html+='<i class="bd-seam" style="left:'+(p*o.panelW*s).toFixed(1)+'px"></i>';
      if(!pg.items.length) html+='<div class="bd-empty"><b>'+o.emptyTitle+'</b><span>'+o.emptyBody+'</span></div>';
      sh.innerHTML=html+'<div class="bd-guides"></div>';
      renderTools();
      if(B.edit>=0){ var ed=sh.querySelector('[data-bd="'+B.edit+'"] .bd-tx'); if(ed){ ed.focus(); try{ var r=null, c=B.caret; B.caret=null;
          if(c&&document.caretRangeFromPoint){ r=document.caretRangeFromPoint(c.x,c.y); if(r&&!ed.contains(r.startContainer)) r=null; }
          if(!r){ r=document.createRange(); r.selectNodeContents(ed); r.collapse(false); } var sl=window.getSelection(); sl.removeAllRanges(); sl.addRange(r); }catch(e){} wireText(ed); } }
      box.querySelector(".bd-cap").textContent=o.cap(d);
      renderPages(); renderSide(); renderTray(); }
    function wireText(ed){ ed.addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Escape"){ e.preventDefault(); ed.blur(); } });
      ed.addEventListener("paste",function(e){ e.preventDefault(); var t=(e.clipboardData||window.clipboardData).getData("text/plain"); document.execCommand("insertText",false,t); });
      ed.addEventListener("input",function(){ var it=page().items[B.edit]; if(it){ it.text=ed.innerText.replace(/\n$/,""); o.save(doc()); } });
      ed.addEventListener("blur",function(){ B.edit=-1; push(); render(); }); }
    // the slim rail of things to add, down the left of the page (workbook only)
    function renderTools(){ if(!o.tools) return; var st=$(o.el).querySelector(".bd-stage"), r=st.querySelector(".bd-tools");
      if(!r){ r=document.createElement("div"); r.className="bd-tools"; st.appendChild(r);
        r.innerHTML=[["title","T","TITLE"],["text","¶","TEXT"],["caption","a","CAPTION"],["arrow","↗","ARROW"],["line","╱","LINE"],["box","▭","BOX"],["slot","⊞","PHOTO SPACE"]]
          .map(function(t){ return '<button data-bd-act="'+t[0]+'" title="Add '+t[2].toLowerCase()+'"><b class="i-'+t[0]+'">'+t[1]+'</b><span>'+t[2]+'</span></button>'; }).join(""); } }
    function mini(pg, w){ var h=w*o.H/o.W, k=w/o.W, bg=bgOf(pg);
      return '<span class="bd-mini '+(bdDark(bg)?"black":"white")+'" style="width:'+w+'px;height:'+h.toFixed(1)+'px'+(o.bgs?';background:'+BD_BGS[bg][1]:'')+'">'+pg.items.map(function(it){ if(it.hidden||it.t==="line") return ""; var b=bb(it);
        var pos='left:'+(b.x*k).toFixed(1)+'px;top:'+(b.y*k).toFixed(1)+'px;width:'+(b.w*k).toFixed(1)+'px;height:'+Math.max(1,b.h*k*(it.t==="text"?0.5:1)).toFixed(1)+'px';
        return it.t==="photo"?'<img src="'+src(it)+'" alt="" style="'+pos+'">':'<i class="'+it.t+'" style="'+pos+(it.t==="shape"&&!it.outline?';background:'+(it.fill||"#2f2f31"):'')+'"></i>'; }).join("")+'</span>'; }
    function renderPages(){ var d=doc(), el=$(o.el).querySelector(".bd-pages"), mw=o.W>o.H?(o.panelW?96:64):40;
      el.innerHTML=d.pages.map(function(pg,i){ return '<button class="bd-pg'+(i===d.cur?' on':'')+'" data-bd-page="'+i+'">'+mini(pg,mw)+'<span>'+o.pageWord+' '+(i+1)+'</span></button>'; }).join("")
        +'<span class="bd-pgacts"><button data-bd-act="newpage" title="New blank '+o.pageWord.toLowerCase()+'">+ NEW</button><button data-bd-act="dup" title="Copy this '+o.pageWord.toLowerCase()+' to try another version">⧉ COPY</button>'+(d.pages.length>1?'<button data-bd-act="delpage">DELETE</button>':'')+'</span>'; }
    function tplPreview(t){ var sample=[1.5,0.667,1.5,1.25,1.5,0.8,1.5,1.5,0.667,1.5,1.5,1.25], n=o.panelW?Math.min(12,Math.max(6,page().items.filter(function(i){ return i.t==="photo"; }).length||9)):Math.min(6,Math.max(3,page().items.filter(function(i){ return i.t==="photo"; }).length||5)),
        G=sample.slice(0,n).map(function(_,i){ return Math.floor(i*3/n); }), r=t.place(o.W,o.H,sample.slice(0,n),G), wpx=o.panelW?84:56, k=wpx/o.W;
      return '<svg width="'+wpx+'" height="'+(o.H*k).toFixed(0)+'" viewBox="0 0 '+o.W+' '+o.H+'" aria-hidden="true"><rect width="'+o.W+'" height="'+o.H+'" class="pg"/>'+r.map(function(q,i){ return q?'<rect x="'+q.x.toFixed(0)+'" y="'+q.y.toFixed(0)+'" width="'+q.w.toFixed(0)+'" height="'+(q.w/sample[i]).toFixed(0)+'"/>':''; }).join("")+'</svg>'; }
    function tmplPreview(t){ var r=t.build(o.W,o.H), k=96/o.W, bgc=BD_BGS[r.bg||"white"][1], ink=bdDark(r.bg)?"#f4f1ea":"#1c1915";
      return '<svg width="96" height="'+(o.H*k).toFixed(0)+'" viewBox="0 0 '+o.W+' '+o.H+'" aria-hidden="true"><rect width="'+o.W+'" height="'+o.H+'" fill="'+bgc+'"/>'+r.items.map(function(it){
        if(it.t==="slot") return '<rect x="'+it.x+'" y="'+it.y+'" width="'+it.w+'" height="'+it.h+'" fill="#7d7466" opacity=".75"/>';
        if(it.t==="shape") return '<rect x="'+it.x+'" y="'+it.y+'" width="'+it.w+'" height="'+it.h+'" fill="'+(it.fill||"#2f2f31")+'"/>';
        if(it.t==="line") return '<line x1="'+it.x+'" y1="'+it.y+'" x2="'+it.x2+'" y2="'+it.y2+'" stroke="'+ink+'" stroke-width="2" opacity=".6"/>';
        var lines="", lh=it.role==="title"?10:7, th=it.role==="title"?6:3, nl=Math.max(1,Math.min(it.role==="title"?1:6,Math.floor(it.h/lh)));
        for(var j=0;j<nl;j++) lines+='<rect x="'+it.x+'" y="'+(it.y+2+j*lh)+'" width="'+(it.w*(j===nl-1&&nl>1?0.6:0.92))+'" height="'+th+'" fill="'+ink+'" opacity=".45"/>';
        return lines; }).join("")+'</svg>'; }
    function swatch(c){ return '<i class="sw" style="background:'+c+'"></i>'; }
    function renderSide(){ var el=$(o.el).querySelector(".bd-side"), pg=page(), d=doc(), one=B.sel.length===1?pg.items[B.sel[0]]:null, h="";
      if(o.templates) h+='<div class="bd-sec"><span class="eb">PAGE TEMPLATES <i>ADDS A NEW PAGE</i></span><div class="bd-tmpls">'+o.templates.map(function(t,i){ return '<button data-bd-tmpl="'+i+'" title="'+cbEsc(t.tip||t.name)+'">'+tmplPreview(t)+'<span>'+t.name.toUpperCase()+'</span></button>'; }).join("")+'</div></div>';
      if(o.panelW) h+='<div class="bd-sec"><span class="eb">BOARD</span><div class="bd-chips">'+[2,3].map(function(n){ return '<button data-bd-panels="'+n+'" class="'+(d.panels===n?'on':'')+'">'+n+' × A1 PANELS</button>'; }).join("")+'</div></div>';
      h+='<div class="bd-sec"><span class="eb">'+(o.templates?'ARRANGE PHOTOS':'LAYOUTS')+' <i>THEN MOVE THINGS</i></span><div class="bd-tpls'+(o.panelW?' wide':'')+'">'+o.layouts.map(function(t,i){ return '<button data-bd-tpl="'+i+'" title="'+cbEsc(t.tip||t.name)+'">'+tplPreview(t)+'<span>'+t.name.toUpperCase()+'</span></button>'; }).join("")+'</div></div>';
      if(o.bgs) h+='<div class="bd-sec"><span class="eb">PAGE COLOUR</span><div class="bd-chips">'+Object.keys(BD_BGS).map(function(b){ return '<button data-bd-bg="'+b+'" class="'+(bgOf(pg)===b?'on':'')+'" title="'+BD_BGS[b][0]+'">'+swatch(BD_BGS[b][1])+BD_BGS[b][0]+'</button>'; }).join("")+'</div></div>';
      var top=h; h="";   // whatever is selected goes first, so its controls are always in reach
      if(one){ h+='<div class="bd-sec"><span class="eb">SELECTED · '+cbEsc(name(one).toUpperCase())+'</span>';
        if(one.t==="photo"){ h+='<div class="bd-sizes">'+o.sizes.map(function(w){ return '<button data-bd-w="'+w+'" class="'+(Math.round(one.w)===w?'on':'')+'">'+w+'</button>'; }).join("")+'<span>MM WIDE</span></div>';
          if(o.filters) h+='<div class="bd-chips">'+Object.keys(BD_FILTERS).map(function(f){ return '<button data-bd-f="'+f+'" class="'+((one.f||"none")===f?'on':'')+'">'+BD_FILTERS[f][0]+'</button>'; }).join("")+'</div>'; }
        else if(one.t==="text"){ h+='<div class="bd-chips">'+Object.keys(BD_FONTS).map(function(f){ return '<button data-bd-font="'+f+'" class="'+((one.font||"serif")===f?'on':'')+'">'+BD_FONTS[f][0]+'</button>'; }).join("")+'</div>'
          +'<div class="bd-sizes"><button data-bd-fs="-1">A−</button><b>'+(one.size||14)+' PT</b><button data-bd-fs="1">A+</button><button data-bd-bold class="'+(one.bold?'on':'')+'"><b>B</b></button><button data-bd-al="left" class="'+((one.align||"left")==="left"?'on':'')+'">⇤</button><button data-bd-al="center" class="'+(one.align==="center"?'on':'')+'">↔</button></div>'
          +inkChips(one)
          +(one.ph&&!String(one.text||"").trim()?'<div class="bd-prompts"><span class="eb">QUESTIONS TO ANSWER</span><p>'+cbEsc(one.ph).replace(/\n/g,"<br>")+'</p><button data-bd-act="usepr">WRITE UNDER EACH QUESTION</button></div>':''); }
        else if(one.t==="line"){ h+='<div class="bd-chips"><button data-bd-head="end" class="'+((one.head||"end")==="end"?'on':'')+'">→ ARROW</button><button data-bd-head="both" class="'+(one.head==="both"?'on':'')+'">↔ BOTH</button><button data-bd-head="none" class="'+(one.head==="none"?'on':'')+'">— LINE</button></div>'
          +'<div class="bd-sizes"><button data-bd-wt="-1">THINNER</button><b>'+(one.wt||0.7).toFixed(1)+' MM</b><button data-bd-wt="1">THICKER</button></div>'+inkChips(one); }
        else if(one.t==="shape"){ h+='<div class="bd-chips"><button data-bd-outline="0" class="'+(!one.outline?'on':'')+'">FILLED</button><button data-bd-outline="1" class="'+(one.outline?'on':'')+'">OUTLINE</button></div>'
          +'<div class="bd-chips">'+Object.keys(BD_BGS).map(function(b){ return '<button data-bd-fill="'+BD_BGS[b][1]+'" class="'+(one.fill===BD_BGS[b][1]?'on':'')+'">'+swatch(BD_BGS[b][1])+'</button>'; }).join("")
          +Object.keys(BD_INKS).filter(function(c){ return c==="gold"||c==="red"; }).map(function(c){ return '<button data-bd-fill="'+BD_INKS[c][0]+'" class="'+(one.fill===BD_INKS[c][0]?'on':'')+'">'+swatch(BD_INKS[c][0])+'</button>'; }).join("")+'</div>'; }
        else if(one.t==="slot") h+='<p class="bd-none">Drag a frame from the left onto this space, or click a frame while it’s selected. For an artist’s work, upload the image.</p><div class="bd-chips"><button data-bd-act="upload">⇪ UPLOAD AN IMAGE</button></div>';
        h+='<div class="bd-chips"><button data-bd-act="front">TO FRONT</button><button data-bd-act="back">TO BACK</button><button data-bd-act="dupitem">DUPLICATE</button><button data-bd-act="del" class="del">DELETE</button></div></div>'; }
      h=h+top;
      h+='<div class="bd-sec"><div class="bd-row"><span class="eb">LAYERS</span><span class="bd-add">'+(o.text&&!o.tools?'<button data-bd-act="text">+ TEXT</button>':'')+'</span></div><div class="bd-layers">';
      if(!pg.items.length) h+='<p class="bd-none">Nothing on this '+o.pageWord.toLowerCase()+' yet.</p>';
      for(var k=pg.items.length-1;k>=0;k--){ var it=pg.items[k], ic=it.t==="photo"?'<img src="'+src(it)+'" alt="">':'<span class="tt">'+({text:"T",line:it.head==="none"?"╱":"↗",shape:"▭",slot:"⊞"}[it.t]||"T")+'</span>';
        h+='<div class="bd-ly'+(B.sel.indexOf(k)>=0?' on':'')+(it.hidden?' off':'')+'" data-bd-ly="'+k+'"><button class="eye" data-bd-eye="'+k+'" title="'+(it.hidden?'Show':'Hide')+'">'+(it.hidden?'◌':'◉')+'</button>'
          +ic+'<span class="nm">'+cbEsc(name(it))+'</span>'
          +'<button class="lk'+(it.locked?' on':'')+'" data-bd-lock="'+k+'" title="'+(it.locked?'Unlock':'Lock')+'">'+(it.locked?'⊠':'⊡')+'</button>'
          +'<button class="mv" data-bd-up="'+k+'" title="Bring forward" '+(k===pg.items.length-1?'disabled':'')+'>↑</button><button class="mv" data-bd-down="'+k+'" title="Send back" '+(k===0?'disabled':'')+'>↓</button></div>'; }
      h+='</div></div>';
      if(o.papers) h+='<div class="bd-sec"><span class="eb">PAPER</span><div class="bd-chips">'+o.papers.map(function(p){ return '<button data-bd-paper="'+p+'" class="'+((d.paper||"white")===p?'on':'')+'"><i class="sw '+p+'"></i>'+p.toUpperCase()+'</button>'; }).join("")+'</div></div>';
      h+='<button class="ws-gold bd-export" data-bd-act="export">'+o.exportLabel+'</button>';
      el.innerHTML=h; }
    function inkChips(one){ var cur=one.color||inkOf(page()); return '<div class="bd-chips">'+Object.keys(BD_INKS).map(function(c){ return '<button data-bd-ink="'+BD_INKS[c][0]+'" class="'+(cur===BD_INKS[c][0]?'on':'')+'" title="'+BD_INKS[c][1]+'">'+swatch(BD_INKS[c][0])+'</button>'; }).join("")+'</div>'; }
    function renderTray(){ var el=$(o.el).querySelector(".bd-tray"), pg=page(), on={}, pk=stPicks(), rest=photos.map(function(_,i){ return i; }).filter(function(i){ return !photos[i].pick&&!photos[i].reject; });
      pg.items.forEach(function(it){ if(it.t==="photo") on[it.pid]=1; });
      var pic=function(i){ var id=stId(i); return '<div class="bd-pic" draggable="true" data-bd-pic="'+i+'" title="Drag onto the page, or click to add"><img src="'+(typeof hubThumb==="function"?hubThumb(i):photos[i].url)+'" alt="Frame '+(i+1)+'" draggable="false"><span class="m"><span>'+cbPad(i+1)+'</span>'+(on[id]?'<span class="in">ON PAGE</span>':'')+'</span></div>'; };
      el.innerHTML=(pk.length?'<span class="eb">YOUR PICKS</span>'+pk.map(pic).join(""):'')+(rest.length?'<span class="eb">'+(pk.length?'OTHER FRAMES':'YOUR FRAMES')+'</span>'+rest.map(pic).join(""):''); }
    // ---- editing ----
    function add(i, x, y, w){ var pg=page(), a=stAspect(i);
      var sl=B.sel.length===1&&pg.items[B.sel[0]]&&pg.items[B.sel[0]].t==="slot"?B.sel[0]:-1;   // a photo space is selected: fill it
      if(x==null&&sl>=0) return fillSlot(sl, i);
      w=w||o.defW; var it={id:bdUid(), t:"photo", pid:stId(i), w:w, x:0, y:0};
      it.x=Math.max(0,Math.min(o.W-w,(x==null?o.W/2:x)-w/2)); it.y=Math.max(0,Math.min(o.H-w/a,(y==null?o.H/2:y)-w/a/2)); pg.items.push(it); B.sel=[pg.items.length-1]; commit(); }
    function bdTop(b,a){ var r=bdFit(b,a); r.y=b.y; return r; }
    function fillSlot(k, i){ var pg=page(), sl=pg.items[k], r=bdTop({x:sl.x,y:sl.y,w:sl.w,h:sl.h}, stAspect(i));
      pg.items[k]={id:bdUid(), t:"photo", pid:stId(i), x:r.x, y:r.y, w:r.w, box:{x:sl.x,y:sl.y,w:sl.w,h:sl.h}}; B.sel=[k]; commit(); }
    var TEXT_ROLE={title:{size:30, font:"serif", h:0.08, ph:"Title"}, text:{size:16, font:"sans", h:0.22, ph:"Click to write"}, caption:{size:11, font:"type", h:0.06, ph:"Caption: settings, place, date"}};
    function addText(role){ role=role||"text"; var pg=page(), R=TEXT_ROLE[role], n=pg.items.length;
      pg.items.push({id:bdUid(), t:"text", role:role, x:o.margin+(n%4)*6, y:o.margin+(n%4)*6, w:o.W*(role==="title"?0.6:0.36), h:o.H*R.h, text:"", size:R.size, font:R.font, ph:R.ph});
      B.sel=[pg.items.length-1]; B.edit=pg.items.length-1; commit(); }
    function addLine(head){ var pg=page(); pg.items.push({id:bdUid(), t:"line", x:o.W*0.38, y:o.H*0.56, x2:o.W*0.56, y2:o.H*0.42, head:head, wt:0.7}); B.sel=[pg.items.length-1]; commit(); }
    function addBox(){ var pg=page(); pg.items.unshift({id:bdUid(), t:"shape", x:o.W*0.3, y:o.H*0.3, w:o.W*0.4, h:o.H*0.4, fill:bdDark(bgOf(pg))?BD_BGS.white[1]:BD_BGS.charcoal[1]}); B.sel=[0]; commit(); toast("Box added behind everything. Use it as a panel to group work on."); }
    function addSlot(){ var pg=page(); pg.items.push({id:bdUid(), t:"slot", x:o.W*0.35, y:o.H*0.3, w:o.W*0.3, h:o.H*0.4, label:"Photo"}); B.sel=[pg.items.length-1]; commit(); }
    function applyLayout(t){ B.lastTpl=t; var pg=page(), ph=pg.items.filter(function(it){ return it.t==="photo"&&idxOf(it)>=0; }), ids, fresh=false;
      if(!ph.length){ var pk=stPicks(); if(!pk.length) pk=photos.map(function(_,i){ return i; }).slice(-o.maxAuto); ids=pk.slice(0,o.maxAuto).map(stId); fresh=true; } else ids=ph.map(function(it){ return it.pid; });
      var idx=ids.map(stById), A=idx.map(stAspect), groups=idx.map(function(i){ return stPlaceOf(photos[i]); }), gi={}, gn=0; groups=groups.map(function(g){ if(gi[g]==null) gi[g]=gn++; return gi[g]; });
      var r=t.place(o.W,o.H,A,groups);
      if(fresh){ ids.forEach(function(id,k){ if(r[k]) pg.items.push({id:bdUid(), t:"photo", pid:id, x:r[k].x, y:r[k].y, w:r[k].w}); }); }
      else { ph.forEach(function(it,k){ if(r[k]&&!it.locked){ delete it.box; it.x=r[k].x; it.y=r[k].y; it.w=r[k].w; it.hidden=false; } }); }
      B.sel=[]; commit(); toast(t.name+" layout. Drag anything to change it."); }
    // a page template: titles, prompted text boxes, arrows and photo spaces, filled with picks you haven't used yet
    function applyTemplate(t){ var d=doc(), r=t.build(o.W,o.H), used={};
      d.pages.forEach(function(pg){ pg.items.forEach(function(it){ if(it.pid) used[it.pid]=1; }); });
      var pool=stPicks().concat(photos.map(function(_,i){ return i; }).filter(function(i){ return !photos[i].pick&&!photos[i].reject; })).filter(function(i){ return !used[stId(i)]; });
      var items=r.items.map(function(it){ var c=JSON.parse(JSON.stringify(it)); c.id=bdUid();
        if(c.t==="slot"&&!c.keep&&pool.length){ var i=pool.shift(), f=bdTop({x:c.x,y:c.y,w:c.w,h:c.h}, stAspect(i)); return {id:c.id, t:"photo", pid:stId(i), x:f.x, y:f.y, w:f.w, box:{x:c.x,y:c.y,w:c.w,h:c.h}}; }
        if(c.t==="text"){ var R=TEXT_ROLE[c.role||"text"]; c.text=c.text||""; c.size=c.size||R.size; c.font=c.font||R.font; } return c; });
      var cur=page(), blank=!cur.items.length, pg={id:bdUid(), bg:r.bg||"white", items:items};
      if(blank) d.pages[d.cur]=pg; else { d.pages.splice(d.cur+1,0,pg); d.cur++; }
      B.sel=[]; B.edit=-1; commit(); toast(t.name+": click any text box to start writing."); }
    function delSel(){ var pg=page(); B.sel.sort(function(a,b){ return b-a; }).forEach(function(k){ if(!pg.items[k].locked) pg.items.splice(k,1); }); B.sel=[]; commit(); }
    function dupSel(){ var pg=page(), add_=[]; B.sel.forEach(function(k){ var c=JSON.parse(JSON.stringify(pg.items[k])); c.id=bdUid(); c.x+=8; c.y+=8; if(c.t==="line"){ c.x2+=8; c.y2+=8; } c.locked=false; add_.push(c); });
      add_.forEach(function(c){ pg.items.push(c); }); B.sel=add_.map(function(_,j){ return pg.items.length-add_.length+j; }); commit(); }
    function reorder(k, to){ var pg=page(); to=Math.max(0,Math.min(pg.items.length-1,to)); if(to===k) return; var it=pg.items.splice(k,1)[0]; pg.items.splice(to,0,it); B.sel=[to]; commit(); }
    function nudge(dx,dy){ var pg=page(); B.sel.forEach(function(k){ var it=pg.items[k]; if(it.locked) return; delete it.box; it.x+=dx; it.y+=dy; if(it.t==="line"){ it.x2+=dx; it.y2+=dy; } }); commit(); }
    // ---- pointer: move, resize, snap ----
    function snapLines(skip){ var pg=page(), xs=[0,o.W/2,o.W,o.margin,o.W-o.margin], ys=[0,o.H/2,o.H,o.margin,o.H-o.margin];
      if(o.panelW) for(var p=0;p<=doc().panels;p++){ var px=p*o.panelW; xs.push(px, px+o.margin, px-o.margin, px+o.panelW/2); }
      pg.items.forEach(function(it,k){ if(skip.indexOf(k)>=0||it.hidden||it.t==="line") return; var b=bb(it); xs.push(b.x,b.x+b.w/2,b.x+b.w); ys.push(b.y,b.y+b.h/2,b.y+b.h); }); return {xs:xs, ys:ys}; }
    function bestSnap(vals, lines, th){ var best=null; vals.forEach(function(v,vi){ lines.forEach(function(l){ var d=l-v; if(Math.abs(d)<=th&&(!best||Math.abs(d)<Math.abs(best.d))) best={d:d, at:l}; }); }); return best; }
    function guides(gx, gy){ var g=$(o.el).querySelector(".bd-guides"), s=B.s; if(!g) return; g.innerHTML=(gx!=null?'<i class="v" style="left:'+(gx*s).toFixed(1)+'px"></i>':'')+(gy!=null?'<i class="h" style="top:'+(gy*s).toFixed(1)+'px"></i>':''); }
    function down(e){ if(e.button!==0) return; var pg=page(), hd=e.target.closest("[data-bd-h]"), el=e.target.closest("[data-bd]");
      if(B.edit>=0&&el&&+el.getAttribute("data-bd")===B.edit) return;   // typing in a text box
      if(!el){ if(B.sel.length){ B.sel=[]; render(); } return; }
      var k=+el.getAttribute("data-bd"), it=pg.items[k], wasSel=B.sel.length===1&&B.sel[0]===k;
      if(e.shiftKey||e.ctrlKey||e.metaKey){ var j=B.sel.indexOf(k); if(j>=0) B.sel.splice(j,1); else B.sel.push(k); render(); return; }
      if(B.sel.indexOf(k)<0) B.sel=[k];
      if(it.locked){ render(); return; }
      e.preventDefault(); var s=B.s, x0=e.clientX, y0=e.clientY, moved=false, start=B.sel.map(function(q){ var a=pg.items[q]; return {k:q, x:a.x, y:a.y, x2:a.x2, y2:a.y2, w:a.w, h:hOf(a)}; }), L=snapLines(B.sel), th=6/s;
      var mode=hd?hd.getAttribute("data-bd-h"):"move", st0=start[0], boxy=pg.items[st0.k].t!=="line";
      if(B.sel.length===1&&!hd&&!wasSel) render();   // show handles now
      function redraw(q){ var n=$(o.el).querySelector('.bd-sheet [data-bd="'+q+'"]'); if(n) n.outerHTML=itemHTML(pg.items[q],q,s); }
      function mv(ev){ var dx=(ev.clientX-x0)/s, dy=(ev.clientY-y0)/s; if(!moved&&Math.abs(dx)+Math.abs(dy)<3/s) return; if(!moved) start.forEach(function(q){ delete pg.items[q.k].box; }); moved=true;
        if(mode==="move"){ var a=start[0];
          if(boxy){ var nx=a.x+dx, ny=a.y+dy, sx=bestSnap([nx,nx+a.w/2,nx+a.w],L.xs,th), sy=bestSnap([ny,ny+a.h/2,ny+a.h],L.ys,th); if(sx){ dx+=sx.d; } if(sy){ dy+=sy.d; } guides(sx?sx.at:null, sy?sy.at:null); }
          start.forEach(function(q){ var it2=pg.items[q.k]; it2.x=q.x+dx; it2.y=q.y+dy; if(it2.t==="line"){ it2.x2=q.x2+dx; it2.y2=q.y2+dy; } redraw(q.k); }); }
        else if(mode==="a"||mode==="b"){ var it4=pg.items[st0.k], px=(mode==="a"?st0.x:st0.x2)+dx, py=(mode==="a"?st0.y:st0.y2)+dy, ox=mode==="a"?it4.x2:it4.x, oy=mode==="a"?it4.y2:it4.y;
          if(ev.shiftKey){ var an=Math.atan2(py-oy,px-ox), L2=Math.hypot(px-ox,py-oy), q15=Math.round(an/(Math.PI/12))*(Math.PI/12); px=ox+Math.cos(q15)*L2; py=oy+Math.sin(q15)*L2; }   // shift: straight, or 15° steps
          if(mode==="a"){ it4.x=px; it4.y=py; } else { it4.x2=px; it4.y2=py; } redraw(st0.k); }
        else { var it3=pg.items[st0.k], ar=it3.t==="photo"?asp(it3):null, right=mode.indexOf("e")>=0, bottom=mode.indexOf("s")>=0;
          var w=Math.max(it3.t==="photo"?15:12, st0.w+(right?dx:-dx)), h=ar?w/ar:Math.max(6, st0.h+(bottom?dy:-dy));
          it3.w=w; if(!ar) it3.h=h; it3.x=right?st0.x:st0.x+st0.w-w; it3.y=bottom?st0.y:st0.y+st0.h-h; redraw(st0.k); } }
      function up(ev){ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); guides(null,null);
        if(moved){ commit(); return; }
        if(it.t==="text"&&(wasSel||!String(it.text||"").trim())){ B.edit=k; B.sel=[k]; B.caret={x:ev.clientX, y:ev.clientY}; render(); } }   // click a text box to type in it
      window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); }
    function bind(){ if(B.bound) return; B.bound=true; var box=$(o.el), sh=box.querySelector(".bd-sheet");
      sh.addEventListener("pointerdown",down);
      sh.addEventListener("dblclick",function(e){ var el=e.target.closest("[data-bd]"); if(!el) return; var k=+el.getAttribute("data-bd"), it=page().items[k]; if(it&&it.t==="text"&&!it.locked&&B.edit!==k){ B.edit=k; B.sel=[k]; B.caret={x:e.clientX, y:e.clientY}; render(); } });
      box.addEventListener("dragstart",function(e){ var p=e.target.closest&&e.target.closest("[data-bd-pic]"); if(!p) return; e.dataTransfer.setData("text/plain","bd:"+p.getAttribute("data-bd-pic")); e.dataTransfer.effectAllowed="copy"; });
      sh.addEventListener("dragover",function(e){ e.preventDefault(); e.dataTransfer.dropEffect="copy"; sh.classList.add("drop");
        var t=e.target.closest&&e.target.closest(".bd-it.sl"); Array.prototype.forEach.call(sh.querySelectorAll(".bd-it.sl.hot"),function(n){ if(n!==t) n.classList.remove("hot"); }); if(t) t.classList.add("hot"); });
      sh.addEventListener("dragleave",function(){ sh.classList.remove("drop"); });
      sh.addEventListener("drop",function(e){ sh.classList.remove("drop"); var d=e.dataTransfer.getData("text/plain")||""; if(d.slice(0,3)!=="bd:") return; e.preventDefault();
        var slot=e.target.closest&&e.target.closest(".bd-it.sl"); if(slot) return fillSlot(+slot.getAttribute("data-bd"), +d.slice(3));
        var r=sh.getBoundingClientRect(); add(+d.slice(3),(e.clientX-r.left)/B.s,(e.clientY-r.top)/B.s); });
      box.addEventListener("click",function(e){ var t=e.target.closest("[data-bd-pic],[data-bd-page],[data-bd-act],[data-bd-tpl],[data-bd-tmpl],[data-bd-ly],[data-bd-eye],[data-bd-lock],[data-bd-up],[data-bd-down],[data-bd-w],[data-bd-f],[data-bd-font],[data-bd-fs],[data-bd-al],[data-bd-paper],[data-bd-bg],[data-bd-ink],[data-bd-head],[data-bd-wt],[data-bd-fill],[data-bd-outline],[data-bd-bold],[data-bd-panels]"); if(!t) return; act(t); }); }
    function act(t){ var pg=page(), d=doc(), one=B.sel.length===1?pg.items[B.sel[0]]:null, g=function(a){ return t.getAttribute(a); }, has=function(a){ return t.hasAttribute(a); };
      if(has("data-bd-pic")) return add(+g("data-bd-pic"));
      if(has("data-bd-page")){ d.cur=+g("data-bd-page"); B.sel=[]; o.save(d); return render(); }
      if(has("data-bd-tpl")) return applyLayout(o.layouts[+g("data-bd-tpl")]);
      if(has("data-bd-tmpl")) return applyTemplate(o.templates[+g("data-bd-tmpl")]);
      if(has("data-bd-eye")){ var a=pg.items[+g("data-bd-eye")]; a.hidden=!a.hidden; return commit(); }
      if(has("data-bd-lock")){ var b=pg.items[+g("data-bd-lock")]; b.locked=!b.locked; return commit(); }
      if(has("data-bd-up")){ var u=+g("data-bd-up"); return reorder(u,u+1); }
      if(has("data-bd-down")){ var dn=+g("data-bd-down"); return reorder(dn,dn-1); }
      if(has("data-bd-ly")){ B.sel=[+g("data-bd-ly")]; return render(); }
      if(has("data-bd-panels")){ d.panels=+g("data-bd-panels"); o.W=d.panels*o.panelW; B.sel=[];
        if(pg.items.some(function(it){ return it.x+it.w>o.W+1; })){ B.lastTpl=B.lastTpl||o.layouts[0]; return applyLayout(B.lastTpl); }   // frames on a panel that's gone: reflow them
        return commit(); }
      if(has("data-bd-bg")){ pg.bg=g("data-bd-bg"); pg.items.forEach(function(it){ if(it.color&&(it.color==="#1c1915"||it.color==="#f4f1ea")) delete it.color; }); return commit(); }
      if(has("data-bd-w")&&one){ delete one.box; var cx=one.x+one.w/2, cy=one.y+hOf(one)/2; one.w=+g("data-bd-w"); one.x=cx-one.w/2; one.y=cy-hOf(one)/2; return commit(); }
      if(has("data-bd-f")&&one){ one.f=g("data-bd-f"); return commit(); }
      if(has("data-bd-font")&&one){ one.font=g("data-bd-font"); return commit(); }
      if(has("data-bd-fs")&&one){ one.size=Math.max(6,Math.min(120,(one.size||14)+(+g("data-bd-fs"))*(one.size>=30?4:(one.size>=12?2:1)))); return commit(); }
      if(has("data-bd-bold")&&one){ one.bold=!one.bold; return commit(); }
      if(has("data-bd-al")&&one){ one.align=g("data-bd-al"); return commit(); }
      if(has("data-bd-ink")&&one){ one.color=g("data-bd-ink"); return commit(); }
      if(has("data-bd-head")&&one){ one.head=g("data-bd-head"); return commit(); }
      if(has("data-bd-wt")&&one){ one.wt=Math.max(0.3,Math.min(4,(one.wt||0.7)+(+g("data-bd-wt"))*0.3)); return commit(); }
      if(has("data-bd-fill")&&one){ one.fill=g("data-bd-fill"); return commit(); }
      if(has("data-bd-outline")&&one){ one.outline=g("data-bd-outline")==="1"; return commit(); }
      if(has("data-bd-paper")){ d.paper=g("data-bd-paper"); return commit(); }
      var a2=g("data-bd-act");
      if(a2==="newpage"){ d.pages.splice(d.cur+1,0,{id:bdUid(), items:[], bg:pg.bg}); d.cur++; B.sel=[]; return commit(); }
      if(a2==="dup"){ var c=JSON.parse(JSON.stringify(pg)); c.id=bdUid(); c.items.forEach(function(it){ it.id=bdUid(); }); d.pages.splice(d.cur+1,0,c); d.cur++; B.sel=[]; toast("Copied. Try another version on this one."); return commit(); }
      if(a2==="delpage"){ if(d.pages.length<2) return; d.pages.splice(d.cur,1); d.cur=Math.max(0,d.cur-1); B.sel=[]; return commit(); }
      if(a2==="text"||a2==="title"||a2==="caption") return addText(a2);
      if(a2==="arrow") return addLine("end");
      if(a2==="line") return addLine("none");
      if(a2==="box") return addBox();
      if(a2==="slot") return addSlot();
      if(a2==="upload"&&one&&one.t==="slot"){ var k0=B.sel[0], inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
        inp.onchange=function(){ var fl=inp.files&&inp.files[0]; if(!fl) return; var rd=new FileReader(); rd.onload=function(){ photos.push({url:rd.result, t:new Date(), place:"Uploaded", uploaded:true, body:"Uploaded", note:fl.name});
          var i=photos.length-1; stAspect(i); setTimeout(function(){ fillSlot(k0, i); saveSession(); }, 120); }; rd.readAsDataURL(fl); }; inp.click(); return; }
      if(a2==="usepr"&&one){ one.text=String(one.ph||"").split(/\n+/).filter(Boolean).join("\n\n\n")+"\n"; B.edit=B.sel[0]; return commit(); }
      if(a2==="front"&&B.sel.length===1) return reorder(B.sel[0], pg.items.length-1);
      if(a2==="back"&&B.sel.length===1) return reorder(B.sel[0], 0);
      if(a2==="dupitem") return dupSel();
      if(a2==="del") return delSel();
      if(a2==="export") return o.exportFn(B); }
    function key(e){ var c=e.code, mod=e.ctrlKey||e.metaKey, pg=page();
      if(mod&&c==="KeyZ"){ e.preventDefault(); undo(e.shiftKey?1:-1); return true; }
      if(mod&&c==="KeyY"){ e.preventDefault(); undo(1); return true; }
      if(mod&&c==="KeyA"){ e.preventDefault(); B.sel=pg.items.map(function(_,k){ return k; }).filter(function(k){ return !pg.items[k].hidden; }); render(); return true; }
      if(mod&&c==="KeyD"){ e.preventDefault(); if(B.sel.length) dupSel(); return true; }
      if(c==="Escape"&&B.sel.length){ e.preventDefault(); B.sel=[]; render(); return true; }
      if(!B.sel.length) return false;
      if(c==="Enter"&&B.sel.length===1&&pg.items[B.sel[0]].t==="text"){ e.preventDefault(); B.edit=B.sel[0]; render(); return true; }
      if(c==="Delete"||c==="Backspace"){ e.preventDefault(); delSel(); return true; }
      var st_=e.shiftKey?10:1; if(c==="ArrowLeft"){ e.preventDefault(); nudge(-st_,0); return true; } if(c==="ArrowRight"){ e.preventDefault(); nudge(st_,0); return true; }
      if(c==="ArrowUp"){ e.preventDefault(); nudge(0,-st_); return true; } if(c==="ArrowDown"){ e.preventDefault(); nudge(0,st_); return true; }
      if(c==="BracketRight"&&B.sel.length===1){ reorder(B.sel[0],B.sel[0]+1); return true; } if(c==="BracketLeft"&&B.sel.length===1){ reorder(B.sel[0],B.sel[0]-1); return true; }
      return false; }
    // ---- export: draw a page (or one panel of it) to a canvas at a given px-per-mm ----
    function draw(pg, ppm, cb, part){ var x0=part?part.x:0, W=part?part.w:o.W, cv=document.createElement("canvas"); cv.width=Math.round(W*ppm); cv.height=Math.round(o.H*ppm); var g=cv.getContext("2d"), bg=bgOf(pg), ink=inkOf(pg);
      g.fillStyle=o.bgs?BD_BGS[bg][1]:(bg==="black"?"#0f0e0c":"#f4f1ea"); g.fillRect(0,0,cv.width,cv.height); g.translate(-x0*ppm,0);
      var items=pg.items.filter(function(it){ return !it.hidden&&it.t!=="slot"; }), i=0;
      (function next(){ if(i>=items.length){ cb(cv); return; } var it=items[i++];
        if(it.t==="photo"){ var im=new Image(); im.onload=function(){ g.save(); g.filter=BD_FILTERS[it.f||"none"][1]; g.drawImage(im, it.x*ppm, it.y*ppm, it.w*ppm, hOf(it)*ppm); g.restore(); next(); }; im.onerror=next; im.src=src(it); return; }
        if(it.t==="shape"){ if(it.outline){ g.strokeStyle=it.fill||ink; g.lineWidth=0.7*ppm; g.strokeRect(it.x*ppm,it.y*ppm,it.w*ppm,it.h*ppm); } else { g.fillStyle=it.fill||"#2f2f31"; g.fillRect(it.x*ppm,it.y*ppm,it.w*ppm,it.h*ppm); } return next(); }
        if(it.t==="line"){ var c=it.color||ink, wt=(it.wt||0.7)*ppm, hs=Math.max(2.2*ppm,wt*4.2); g.strokeStyle=c; g.fillStyle=c; g.lineWidth=wt; g.lineCap="round";
          g.beginPath(); g.moveTo(it.x*ppm,it.y*ppm); g.lineTo(it.x2*ppm,it.y2*ppm); g.stroke();
          var head=function(ax,ay,bx,by){ var dx=bx-ax, dy=by-ay, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L; g.beginPath(); g.moveTo(bx,by); g.lineTo(bx-ux*hs-uy*hs*0.45, by-uy*hs+ux*hs*0.45); g.lineTo(bx-ux*hs+uy*hs*0.45, by-uy*hs-ux*hs*0.45); g.closePath(); g.fill(); };
          if(it.head!=="none") head(it.x*ppm,it.y*ppm,it.x2*ppm,it.y2*ppm); if(it.head==="both") head(it.x2*ppm,it.y2*ppm,it.x*ppm,it.y*ppm); return next(); }
        var fs=(it.size||14)*0.3528*ppm, lh=fs*1.3, line="", y=it.y*ppm+fs, maxW=it.w*ppm;
        g.fillStyle=it.color||ink; g.font=(it.bold?"600 ":"")+fs+"px "+BD_FONTS[it.font||"serif"][1]; g.textAlign=it.align==="center"?"center":"left"; var ax=it.align==="center"?(it.x+it.w/2)*ppm:it.x*ppm;
        String(it.text||"").split("\n").forEach(function(par){ line=""; par.split(/\s+/).forEach(function(w){ var t2=line?line+" "+w:w; if(g.measureText(t2).width>maxW&&line){ g.fillText(line,ax,y); y+=lh; line=w; } else line=t2; }); g.fillText(line,ax,y); y+=lh; });
        next(); })(); }
    B.render=render; B.key=key; B.doc_=doc; B.page=page; B.draw=draw; B.add=add; B.applyLayout=applyLayout; B.applyTemplate=applyTemplate; B.reset=function(d){ B.doc=d; B.sel=[]; B.hist=[]; B.hi=-1; push(); };
    B.selected=function(){ return B.sel.slice(); }; B.hOf=hOf;
    push();
    return B; }

  // ---- the two boards ----
  var WS_LAYOUTS=[
    {name:"Rows", place:function(W,H,A){ return bdRows({x:15,y:15,w:W-30,h:H-30},A,6); }},
    {name:"Hero", place:function(W,H,A){ if(A.length<2) return [bdFit({x:15,y:15,w:W-30,h:H-30},A[0])]; var r=[bdFit({x:15,y:15,w:W*0.58,h:H-30},A[0])]; return r.concat(bdRows({x:W*0.58+25,y:15,w:W*0.42-40,h:H-30},A.slice(1),6)); }},
    {name:"Compare", place:function(W,H,A){ var top=bdRows({x:15,y:15,w:W-30,h:H*0.62},A.slice(0,2),10); return top.concat(bdRows({x:15,y:H*0.62+25,w:W-30,h:H*0.38-40},A.slice(2),6)); }},
    {name:"Process", place:function(W,H,A){ return bdRows({x:15,y:15,w:W-30,h:H*0.45},A,6).map(function(r){ return r; }); }},
    {name:"Grid", place:function(W,H,A){ return bdCells({x:15,y:15,w:W-30,h:H-30},A,8); }}];

  // Workbook page templates (A3 landscape), modelled on how strong NCEA and Scholarship workbook pages are put together:
  // a title, photos with room to annotate beside them, arrows tying words to images, and questions in every text box
  // so students know what to write about. Photo spaces fill with picks not yet used in the workbook.
  function wsT(x,y,w,h,role,ph,o){ var t={t:"text", role:role, x:x, y:y, w:w, h:h, ph:ph}; for(var k in (o||{})) t[k]=o[k]; return t; }
  function wsS(x,y,w,h,label,keep){ return {t:"slot", x:x, y:y, w:w, h:h, label:label||"Photo", keep:!!keep}; }
  function wsA(x,y,x2,y2,head){ return {t:"line", x:x, y:y, x2:x2, y2:y2, head:head||"end", wt:0.6}; }
  var WS_TEMPLATES=[
    {name:"Photo + notes", tip:"One strong image with questions beside it", build:function(){ return {bg:"white", items:[
      wsT(15,12,390,18,"title","Title: what is this page about?"),
      wsS(15,38,258,172,"Your best frame"),
      wsT(15,214,258,14,"caption","Settings: lens · aperture · shutter · ISO · light"),
      wsT(15,236,258,46,"text","How does this link to your theme, or to the photographers you are looking at?"),
      wsT(288,40,117,242,"text","What did you do?\n(where you stood, the lens, the light)\n\nWhat is working in this image, and why?\n\nWhat would you change, or try next?"),
      wsA(285,64,276,76)]}; }},
    {name:"Compare two", tip:"Two versions side by side, and which is stronger", build:function(){ return {bg:"white", items:[
      wsT(15,12,390,18,"title","Compare: what changed between these two?"),
      wsS(15,38,192,128,"Version A"), wsS(213,38,192,128,"Version B"),
      wsT(15,170,192,14,"caption","A: lens · f-stop · shutter · ISO"), wsT(213,170,192,14,"caption","B: lens · f-stop · shutter · ISO"),
      wsT(15,194,390,88,"text","Which is stronger, and why?\nTalk about composition, light and focus, and how each one makes you feel.\n\nWhat will you take into your next shoot?")]}; }},
    {name:"Contact sheet", tip:"A full shoot, and what you chose from it", build:function(){ var it=[wsT(15,12,390,18,"title","Contact sheet: name the shoot")], cw=(258-12)/3, ch=cw/1.5;
      for(var r=0;r<3;r++) for(var c=0;c<3;c++) it.push(wsS(15+c*(cw+6),38+r*(ch+6),cw,ch,"Frame "+(r*3+c+1)));
      it.push(wsT(15,214,258,68,"text","Circle or star your strongest frames.\nWhat made them stand out from the rest?"));
      it.push(wsT(288,40,117,242,"text","Which frames are you taking forward?\n\nWhy did you reject the others?\n\nWhat pattern do you notice across the shoot?\n\nWhat will you reshoot, and how?"));
      return {bg:"white", items:it}; }},
    {name:"Experiment", tip:"Testing an idea or technique, then reflecting on it", build:function(){ return {bg:"grey", items:[
      wsT(15,12,390,18,"title","Experiment: name the idea or technique",{font:"type"}),
      wsT(15,34,390,24,"text","What were you exploring? What sparked it (an artist, a quote, a technique)?",{font:"type"}),
      wsS(15,62,126,84,"Test 1"), wsS(147,62,126,84,"Test 2"), wsS(279,62,126,84,"Test 3"),
      wsT(15,150,126,24,"caption","What you tried, and the settings"), wsT(147,150,126,24,"caption","What you tried, and the settings"), wsT(279,150,126,24,"caption","What you tried, and the settings"),
      wsT(15,184,390,98,"text","What did you discover?\n\nWhich test is strongest, and why?\n\nWill you keep developing this idea? Why, or why not?",{font:"type"})]}; }},
    {name:"Artist model", tip:"A photographer's work beside your response to it", build:function(){ return {bg:"white", items:[
      wsT(15,12,390,18,"title","Artist model: name the photographer"),
      wsS(15,38,192,128,"Their work (upload it)",true), wsS(213,38,192,128,"Your response"),
      wsT(15,172,192,110,"text","Who are they, and what are they known for?\n\nWhich conventions do they use?\n(light, framing, subject, colour, time)"),
      wsT(213,172,192,110,"text","What did you take from them?\n\nWhat did you make your own, and why?"),
      wsA(201,102,219,102,"both")]}; }},
    {name:"Not on the board", tip:"Work you left out, and what it taught you", build:function(){ return {bg:"black", items:[
      wsT(15,12,390,18,"title","Photos that I did not use on the board",{font:"type"}),
      wsS(15,38,114,76,"Frame"), wsS(135,38,114,76,"Frame"), wsS(15,120,114,76,"Frame"), wsS(135,120,114,76,"Frame"),
      wsT(266,40,139,156,"text","Why didn't these make the board?\n\nWhat were you trying with them?\n\nDo they open up any new ideas?",{font:"type"}),
      wsA(262,100,253,100),
      wsS(15,206,114,76,"Frame"), wsT(140,208,265,74,"text","Which photographer or idea inspired these?\nWhy did they feel less connected to the rest of the board?",{font:"type"})]}; }},
    {name:"What's next?", tip:"Looking back at the board and planning ahead", build:function(){ return {bg:"charcoal", items:[
      wsT(15,12,240,20,"title","What is next?",{font:"type", size:38}),
      wsS(15,40,120,80,"Board so far",true), wsS(141,40,120,80,"Board so far",true), wsS(15,126,120,80,"Frame"), wsS(141,126,120,80,"Frame"),
      wsT(15,214,246,68,"text","Where has your work come from? What has it grown into?",{font:"type"}),
      wsT(278,40,127,242,"text","1. What has worked so far, and why?\n\n2. Which idea will you push further?\n\n3. Which photographers could you look at next?\n\n4. What will you shoot next, and how?",{font:"type"}),
      wsA(274,64,265,78), wsA(274,170,265,160)]}; }}];

  // Folio: A1 portrait panels side by side, read left to right. Layouts work panel by panel, photos in order (or one
  // location per panel when the shoot had one per panel), filling each panel edge to edge with thin white gutters.
  var FO_M=14, FO_G=6;
  function foSplit(A,G,P){ var n=A.length, groups=Math.max.apply(null,G.concat([0]))+1, out=[];
    for(var p=0;p<P;p++) out.push([]);
    if(groups===P){ G.forEach(function(g,i){ out[g].push(i); }); return out; }
    for(var i=0;i<n;i++) out[Math.min(P-1,Math.floor(i*P/n))].push(i); return out; }
  function foEach(W,H,A,G,fn){ var P=Math.max(1,Math.round(W/594)), pw=W/P, parts=foSplit(A,G,P), out=[];
    parts.forEach(function(ix,p){ if(!ix.length) return; var box={x:p*pw+FO_M, y:FO_M, w:pw-2*FO_M, h:H-2*FO_M}, r=fn(box, ix.map(function(i){ return A[i]; }), p, P); ix.forEach(function(i,k){ out[i]=r[k]; }); }); return out; }
  var FO_LAYOUTS=[
    {name:"Rows", tip:"Each panel filled with rows of frames", place:function(W,H,A,G){ return foEach(W,H,A,G,function(b,a){ return bdRows(b,a,FO_G); }); }},
    {name:"Hero + rows", tip:"A large frame heads each panel", place:function(W,H,A,G){ return foEach(W,H,A,G,function(b,a){ if(a.length<2) return [bdFit(b,a[0])];
      var hh=b.h*0.46, top=bdFit({x:b.x,y:b.y,w:b.w,h:hh},a[0]); return [top].concat(bdRows({x:b.x,y:b.y+top.w/a[0]+FO_G,w:b.w,h:b.h-top.w/a[0]-FO_G},a.slice(1),FO_G)); }); }},
    {name:"Contact + finale", tip:"Contact grid first, big frames to finish", place:function(W,H,A,G){ return foEach(W,H,A,G,function(b,a,p,P){
      if(p===0) return bdGrid(b,a,FO_G,0,3); if(p===P-1) return bdRows(b,a.slice(0),FO_G*2); return bdRows(b,a,FO_G); }); }},
    {name:"Grid", tip:"Even grid in every panel", place:function(W,H,A,G){ return foEach(W,H,A,G,function(b,a){ return bdGrid(b,a,FO_G,0,2); }); }},
    {name:"Sequence", tip:"One column per panel, read top to bottom", place:function(W,H,A,G){ return foEach(W,H,A,G,function(b,a){ return bdCells(b,a,FO_G*2,1); }); }}];
  function bdDownload(blob, fname){ var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=fname; document.body.appendChild(a); a.click(); a.remove(); }
  var wsB=Board({el:"st-workshop", W:420, H:297, margin:15, defW:120, maxAuto:6, text:true, tools:true, filters:true, papers:null, bgs:true, pageWord:"PAGE", sizes:[60,90,120,180,260],
    emptyTitle:"Your page, your way.", emptyBody:"Start from a page template on the right, drag frames in from the left, or add text and arrows from the rail.",
    cap:function(d){ return "A3 LANDSCAPE · 420 × 297 MM · PAGE "+(d.cur+1)+" OF "+d.pages.length; },
    load:function(){ return st.wsBoard||null; }, save:function(d){ st.wsBoard=d; saveSession(); },
    layouts:WS_LAYOUTS, templates:WS_TEMPLATES, exportLabel:"EXPORT PAGES AS PDF",
    exportFn:function(B){ var d=B.doc_(), out=[], i=0; toast("Building your workshop PDF…"); (function next(){ if(i>=d.pages.length){ pbBuildPDF(out, "workshop.pdf", "Workshop PDF downloaded"); return; } B.draw(d.pages[i++], 150/25.4, function(cv){ out.push(cv); next(); }); })(); }});
  var foB=Board({el:"st-folio", W:1782, H:841, panelW:594, margin:FO_M, defW:180, maxAuto:18, text:false, filters:false, papers:["white","black"], pageWord:"LAYOUT", sizes:[100,150,200,280,400,560],
    emptyTitle:"Your folio board. No text.", emptyBody:"A1 panels side by side, read left to right. Drag frames in, or pick a layout to fill each panel. Every frame keeps its shape.",
    cap:function(d){ return d.panels+" × A1 PORTRAIT PANELS · "+(d.panels*594)+" × 841 MM · LAYOUT "+(d.cur+1)+" OF "+d.pages.length; },
    load:function(){ return st.foBoard||null; }, save:function(d){ st.foBoard=d; saveSession(); },
    layouts:FO_LAYOUTS, exportLabel:"EXPORT PANELS AS PDF",
    exportFn:function(B){ var d=B.doc_(), out=[], p=0, dpi=110; toast("Building your folio panels…");
      (function next(){ if(p>=d.panels){ pbBuildPDF(out, namePrefix()+"folio-panels.pdf", "Folio panels downloaded, one A1 page each", dpi); return; } B.draw(B.page(), dpi/25.4, function(cv){ out.push(cv); next(); }, {x:594*(p++), w:594}); })(); }});
  // old workshop pages (fixed template) come across as editable boards
  function wsMigrate(old){ return {cur:0, paper:"white", pages:old.map(function(pg){ var items=[], ia=photos.map(function(p){ return p.url; }).indexOf(pg.a), ib=photos.map(function(p){ return p.url; }).indexOf(pg.b);
      if(ia>=0) items.push({id:bdUid(), t:"photo", pid:stId(ia), x:15, y:40, w:180}); if(ib>=0&&ib!==ia) items.push({id:bdUid(), t:"photo", pid:stId(ib), x:215, y:40, w:180});
      if(pg.title) items.push({id:bdUid(), t:"text", x:15, y:12, w:300, h:20, text:pg.title, size:24, font:"serif"});
      var notes=[pg.n1,pg.n2,pg.next].filter(Boolean).join("\n\n"); if(notes) items.push({id:bdUid(), t:"text", x:15, y:180, w:390, h:100, text:notes, size:11, font:"sans"});
      return {id:bdUid(), items:items}; })}; }
