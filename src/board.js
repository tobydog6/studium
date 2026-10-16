  // ================= BOARD: a free layout page, used by Workshop (A3 landscape) and Folio (A0 portrait) =================
  // Everything sits on the page in millimetres. Photos always keep their own shape (3:2 stays 3:2, 6x7 stays 6x7):
  // you size them from a corner, never crop them. Workshop pages also take text. Every item is a layer you can
  // hide, lock and reorder. Layouts are starting points: they place the frames on the page (true aspect, fitted
  // into rows or cells) and then you move them about. Pages hold different versions, so students can play.
  var BD_FILTERS={none:["ORIGINAL","none"], bw:["B&W","grayscale(1) contrast(1.25)"], faded:["FADED","contrast(.8) brightness(1.08) saturate(.7) sepia(.12)"], warm:["WARM","sepia(.22) saturate(1.15)"], punch:["PUNCH","contrast(1.2) saturate(1.2)"]};
  var BD_FONTS={serif:["SERIF","'Fraunces', Georgia, serif"], sans:["SANS","'Geist', system-ui, sans-serif"], mono:["MONO","'Geist Mono', ui-monospace, monospace"]};
  function bdUid(){ return Math.random().toString(36).slice(2,9); }
  // justified rows: frames keep their shape, rows share a height, the whole block fits the box
  function bdRows(box, asp, gap){ var n=asp.length, best=null; if(!n) return [];
    var total=asp.reduce(function(a,b){ return a+b; },0);
    for(var r=1;r<=n;r++){ var rows=[], cur=[], acc=0, k=1;
      asp.forEach(function(a,i){ cur.push(i); acc+=a; var leftItems=n-i-1, leftRows=r-rows.length-1;
        if(leftRows>0&&leftItems>=leftRows&&(acc>=total*k/r-a/2||leftItems===leftRows)){ rows.push(cur); cur=[]; k++; } });
      if(cur.length) rows.push(cur);
      var hs=rows.map(function(row){ var s=row.reduce(function(a,i){ return a+asp[i]; },0); return (box.w-gap*(row.length-1))/s; }), H=hs.reduce(function(a,b){ return a+b; },0)+gap*(rows.length-1);
      var kk=Math.min(1, box.h/H), score=kk<1?1-kk:(box.h-H)/box.h;
      if(!best||score<best.score) best={score:score, rows:rows, hs:hs, k:kk, H:H}; }
    var out=[], y=box.y+(box.h-best.H*best.k)/2;
    best.rows.forEach(function(row,ri){ var h=best.hs[ri]*best.k, rw=row.reduce(function(a,i){ return a+asp[i]*h; },0)+gap*(row.length-1), x=box.x+(box.w-rw)/2;
      row.forEach(function(i){ out[i]={x:x, y:y, w:asp[i]*h}; x+=asp[i]*h+gap; }); y+=h+gap; });
    return out; }
  // uniform cells, each frame fitted inside its cell at its own shape
  function bdCells(box, asp, gap, cols){ var n=asp.length; if(!n) return []; cols=cols||Math.max(1,Math.round(Math.sqrt(n*box.w/box.h/1.4))); var rows=Math.ceil(n/cols),
      cw=(box.w-gap*(cols-1))/cols, ch=(box.h-gap*(rows-1))/rows;
    return asp.map(function(a,i){ var c=i%cols, r=Math.floor(i/cols), w=Math.min(cw, ch*a), h=w/a; return {x:box.x+c*(cw+gap)+(cw-w)/2, y:box.y+r*(ch+gap)+(ch-h)/2, w:w}; }); }
  function bdFit(box, a){ var w=Math.min(box.w, box.h*a); return {x:box.x+(box.w-w)/2, y:box.y+(box.h-w/a)/2, w:w}; }

  function Board(o){
    var B={o:o, doc:null, sel:[], hist:[], hi:-1, s:1, bound:false, edit:-1};
    function doc(){ if(!B.doc){ B.doc=o.load()||{pages:[{id:bdUid(), items:[]}], cur:0, paper:"white"}; } if(!B.doc.pages.length) B.doc.pages.push({id:bdUid(), items:[]}); return B.doc; }
    function page(){ var d=doc(); d.cur=Math.max(0,Math.min(d.pages.length-1,d.cur)); return d.pages[d.cur]; }
    function snap(){ return JSON.stringify(doc()); }
    function push(){ var s=snap(); if(B.hist[B.hi]===s) return; B.hist=B.hist.slice(0,B.hi+1); B.hist.push(s); if(B.hist.length>60) B.hist.shift(); B.hi=B.hist.length-1; }
    function commit(){ o.save(doc()); push(); render(); }
    function undo(d){ var j=B.hi+d; if(j<0||j>=B.hist.length) return; B.hi=j; B.doc=JSON.parse(B.hist[j]); B.sel=[]; o.save(B.doc); render(); toast(d<0?"Undo":"Redo"); }
    function idxOf(it){ return stById(it.pid); }
    function asp(it){ var i=idxOf(it); return i>=0?stAspect(i):1.5; }
    function hOf(it){ return it.t==="photo"?it.w/asp(it):it.h; }
    function name(it){ if(it.t==="photo"){ var i=idxOf(it); return i>=0?"Frame "+cbPad(i+1):"Missing frame"; } return "Text · "+(String(it.text||"").trim().slice(0,22)||"empty"); }
    function src(it){ var i=idxOf(it); return i>=0?photos[i].url:""; }
    // ---- drawing ----
    function itemHTML(it,k,s){ var sel=B.sel.indexOf(k)>=0, h=hOf(it), st_='left:'+(it.x*s).toFixed(1)+'px;top:'+(it.y*s).toFixed(1)+'px;width:'+(it.w*s).toFixed(1)+'px;height:'+(h*s).toFixed(1)+'px;z-index:'+(k+1);
      var handles=sel&&B.sel.length===1&&!it.locked?'<i class="bd-h nw" data-bd-h="nw"></i><i class="bd-h ne" data-bd-h="ne"></i><i class="bd-h sw" data-bd-h="sw"></i><i class="bd-h se" data-bd-h="se"></i>':'';
      var cls='bd-it '+(it.t==="photo"?'ph':'tx')+(sel?' sel':'')+(it.locked?' locked':'');
      if(it.t==="photo") return '<div class="'+cls+'" data-bd="'+k+'" style="'+st_+'"><img src="'+src(it)+'" alt="" draggable="false" style="filter:'+BD_FILTERS[it.f||"none"][1]+'">'+(sel&&B.sel.length===1?'<span class="bd-sz">'+Math.round(it.w)+' × '+Math.round(h)+' MM</span>':'')+handles+'</div>';
      var f=BD_FONTS[it.font||"serif"][1], fs=(it.size||14)*0.3528*s;
      return '<div class="'+cls+'" data-bd="'+k+'" style="'+st_+'"><div class="bd-tx" style="font-family:'+f+';font-size:'+fs.toFixed(2)+'px;color:'+(it.color||"#1c1915")+';text-align:'+(it.align||"left")+'"'+(B.edit===k?' contenteditable="true"':'')+'>'+cbEsc(it.text||"")+'</div>'+handles+'</div>'; }
    function render(){ var box=$(o.el); if(!box||box.classList.contains("hidden")) return; bind(); var d=doc(), pg=page(), stage=box.querySelector(".bd-stage");
      var aw=stage.clientWidth-48, ah=stage.clientHeight-28, s=Math.max(0.05,Math.min(aw/o.W, ah/o.H)); B.s=s;
      var sh=box.querySelector(".bd-sheet"); sh.style.width=(o.W*s).toFixed(1)+"px"; sh.style.height=(o.H*s).toFixed(1)+"px"; sh.className="bd-sheet "+(d.paper||"white");
      B.sel=B.sel.filter(function(k){ return k<pg.items.length&&!pg.items[k].hidden; });
      var html=""; pg.items.forEach(function(it,k){ if(!it.hidden) html+=itemHTML(it,k,s); });
      if(!pg.items.length) html+='<div class="bd-empty"><b>'+o.emptyTitle+'</b><span>'+o.emptyBody+'</span></div>';
      sh.innerHTML=html+'<div class="bd-guides"></div>';
      if(B.edit>=0){ var ed=sh.querySelector('[data-bd="'+B.edit+'"] .bd-tx'); if(ed){ ed.focus(); try{ var r=document.createRange(); r.selectNodeContents(ed); r.collapse(false); var sl=window.getSelection(); sl.removeAllRanges(); sl.addRange(r); }catch(e){} wireText(ed); } }
      box.querySelector(".bd-cap").textContent=o.cap(d);
      renderPages(); renderSide(); renderTray(); }
    function wireText(ed){ ed.addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Escape"){ e.preventDefault(); ed.blur(); } });
      ed.addEventListener("input",function(){ var it=page().items[B.edit]; if(it){ it.text=ed.innerText; o.save(doc()); } });
      ed.addEventListener("blur",function(){ B.edit=-1; push(); render(); }); }
    function mini(pg, w){ var h=w*o.H/o.W, k=w/o.W;
      return '<span class="bd-mini '+(doc().paper||"white")+'" style="width:'+w+'px;height:'+h.toFixed(1)+'px">'+pg.items.map(function(it){ if(it.hidden) return ""; var hh=hOf(it);
        return it.t==="photo"?'<img src="'+src(it)+'" alt="" style="left:'+(it.x*k).toFixed(1)+'px;top:'+(it.y*k).toFixed(1)+'px;width:'+(it.w*k).toFixed(1)+'px;height:'+(hh*k).toFixed(1)+'px">'
          :'<i style="left:'+(it.x*k).toFixed(1)+'px;top:'+(it.y*k).toFixed(1)+'px;width:'+(it.w*k).toFixed(1)+'px;height:'+Math.max(1,hh*k*0.5).toFixed(1)+'px"></i>'; }).join("")+'</span>'; }
    function renderPages(){ var d=doc(), el=$(o.el).querySelector(".bd-pages"), mw=o.W>o.H?64:40;
      el.innerHTML=d.pages.map(function(pg,i){ return '<button class="bd-pg'+(i===d.cur?' on':'')+'" data-bd-page="'+i+'">'+mini(pg,mw)+'<span>'+o.pageWord+' '+(i+1)+'</span></button>'; }).join("")
        +'<span class="bd-pgacts"><button data-bd-act="newpage" title="New blank '+o.pageWord.toLowerCase()+'">+ NEW</button><button data-bd-act="dup" title="Copy this '+o.pageWord.toLowerCase()+' to try another version">⧉ COPY</button>'+(d.pages.length>1?'<button data-bd-act="delpage">DELETE</button>':'')+'</span>'; }
    function tplPreview(t){ var sample=[1.5,0.667,1.5,1.25,1.5,0.8,1.5], n=Math.min(6,Math.max(3,page().items.filter(function(i){ return i.t==="photo"; }).length||5)), r=t.place(o.W,o.H,sample.slice(0,n),[0,0,0,1,1,2].slice(0,n)), k=56/o.W;
      return '<svg width="56" height="'+(o.H*k).toFixed(0)+'" viewBox="0 0 '+o.W+' '+o.H+'" aria-hidden="true"><rect width="'+o.W+'" height="'+o.H+'" class="pg"/>'+r.map(function(q,i){ return q?'<rect x="'+q.x.toFixed(0)+'" y="'+q.y.toFixed(0)+'" width="'+q.w.toFixed(0)+'" height="'+(q.w/sample[i]).toFixed(0)+'"/>':''; }).join("")+'</svg>'; }
    function renderSide(){ var el=$(o.el).querySelector(".bd-side"), pg=page(), d=doc(), one=B.sel.length===1?pg.items[B.sel[0]]:null, h="";
      h+='<div class="bd-sec"><span class="eb">LAYOUTS <i>THEN MOVE THINGS</i></span><div class="bd-tpls">'+o.layouts.map(function(t,i){ return '<button data-bd-tpl="'+i+'" title="'+cbEsc(t.name)+'">'+tplPreview(t)+'<span>'+t.name.toUpperCase()+'</span></button>'; }).join("")+'</div></div>';
      h+='<div class="bd-sec"><div class="bd-row"><span class="eb">LAYERS</span><span class="bd-add">'+(o.text?'<button data-bd-act="text">+ TEXT</button>':'')+'</span></div><div class="bd-layers">';
      if(!pg.items.length) h+='<p class="bd-none">Nothing on this '+o.pageWord.toLowerCase()+' yet.</p>';
      for(var k=pg.items.length-1;k>=0;k--){ var it=pg.items[k];
        h+='<div class="bd-ly'+(B.sel.indexOf(k)>=0?' on':'')+(it.hidden?' off':'')+'" data-bd-ly="'+k+'"><button class="eye" data-bd-eye="'+k+'" title="'+(it.hidden?'Show':'Hide')+'">'+(it.hidden?'◌':'◉')+'</button>'
          +(it.t==="photo"?'<img src="'+src(it)+'" alt="">':'<span class="tt">T</span>')+'<span class="nm">'+cbEsc(name(it))+'</span>'
          +'<button class="lk'+(it.locked?' on':'')+'" data-bd-lock="'+k+'" title="'+(it.locked?'Unlock':'Lock')+'">'+(it.locked?'⊠':'⊡')+'</button>'
          +'<button class="mv" data-bd-up="'+k+'" title="Bring forward" '+(k===pg.items.length-1?'disabled':'')+'>↑</button><button class="mv" data-bd-down="'+k+'" title="Send back" '+(k===0?'disabled':'')+'>↓</button></div>'; }
      h+='</div></div>';
      if(one){ h+='<div class="bd-sec"><span class="eb">SELECTED · '+cbEsc(name(one).toUpperCase())+'</span>';
        if(one.t==="photo"){ h+='<div class="bd-sizes">'+o.sizes.map(function(w){ return '<button data-bd-w="'+w+'" class="'+(Math.round(one.w)===w?'on':'')+'">'+w+'</button>'; }).join("")+'<span>MM WIDE</span></div>';
          if(o.filters) h+='<div class="bd-chips">'+Object.keys(BD_FILTERS).map(function(f){ return '<button data-bd-f="'+f+'" class="'+((one.f||"none")===f?'on':'')+'">'+BD_FILTERS[f][0]+'</button>'; }).join("")+'</div>'; }
        else { h+='<div class="bd-chips">'+Object.keys(BD_FONTS).map(function(f){ return '<button data-bd-font="'+f+'" class="'+((one.font||"serif")===f?'on':'')+'">'+BD_FONTS[f][0]+'</button>'; }).join("")+'</div>'
          +'<div class="bd-sizes"><button data-bd-fs="-1">A−</button><b>'+(one.size||14)+' PT</b><button data-bd-fs="1">A+</button><button data-bd-al="left" class="'+((one.align||"left")==="left"?'on':'')+'">⇤</button><button data-bd-al="center" class="'+(one.align==="center"?'on':'')+'">↔</button></div>'; }
        h+='<div class="bd-chips"><button data-bd-act="front">TO FRONT</button><button data-bd-act="back">TO BACK</button><button data-bd-act="dupitem">DUPLICATE</button><button data-bd-act="del" class="del">DELETE</button></div></div>'; }
      if(o.papers) h+='<div class="bd-sec"><span class="eb">PAPER</span><div class="bd-chips">'+o.papers.map(function(p){ return '<button data-bd-paper="'+p+'" class="'+((d.paper||"white")===p?'on':'')+'"><i class="sw '+p+'"></i>'+p.toUpperCase()+'</button>'; }).join("")+'</div></div>';
      h+='<button class="ws-gold bd-export" data-bd-act="export">'+o.exportLabel+'</button>';
      el.innerHTML=h; }
    function renderTray(){ var el=$(o.el).querySelector(".bd-tray"), pg=page(), on={}, pk=stPicks(), rest=photos.map(function(_,i){ return i; }).filter(function(i){ return !photos[i].pick&&!photos[i].reject; });
      pg.items.forEach(function(it){ if(it.t==="photo") on[it.pid]=1; });
      var pic=function(i){ var id=stId(i); return '<div class="bd-pic" draggable="true" data-bd-pic="'+i+'" title="Drag onto the page, or click to add"><img src="'+(typeof hubThumb==="function"?hubThumb(i):photos[i].url)+'" alt="Frame '+(i+1)+'" draggable="false"><span class="m"><span>'+cbPad(i+1)+'</span>'+(on[id]?'<span class="in">ON PAGE</span>':'')+'</span></div>'; };
      el.innerHTML=(pk.length?'<span class="eb">YOUR PICKS</span>'+pk.map(pic).join(""):'')+(rest.length?'<span class="eb">'+(pk.length?'OTHER FRAMES':'YOUR FRAMES')+'</span>'+rest.map(pic).join(""):''); }
    // ---- editing ----
    function add(i, x, y, w){ var pg=page(), a=stAspect(i); w=w||o.defW; var it={id:bdUid(), t:"photo", pid:stId(i), w:w, x:0, y:0};
      it.x=Math.max(0,Math.min(o.W-w,(x==null?o.W/2:x)-w/2)); it.y=Math.max(0,Math.min(o.H-w/a,(y==null?o.H/2:y)-w/a/2)); pg.items.push(it); B.sel=[pg.items.length-1]; commit(); }
    function addText(){ var pg=page(); pg.items.push({id:bdUid(), t:"text", x:o.margin, y:o.margin, w:o.W*0.4, h:o.H*0.12, text:"", size:16, font:"serif"}); B.sel=[pg.items.length-1]; B.edit=pg.items.length-1; commit(); }
    function applyLayout(t){ var pg=page(), ph=pg.items.filter(function(it){ return it.t==="photo"&&idxOf(it)>=0; }), ids, fresh=false;
      if(!ph.length){ var pk=stPicks(); if(!pk.length) pk=photos.map(function(_,i){ return i; }).slice(-8); ids=pk.slice(0,o.maxAuto).map(stId); fresh=true; } else ids=ph.map(function(it){ return it.pid; });
      var idx=ids.map(stById), A=idx.map(stAspect), groups=idx.map(function(i){ return stPlaceOf(photos[i]); }), gi={}, gn=0; groups=groups.map(function(g){ if(gi[g]==null) gi[g]=gn++; return gi[g]; });
      var r=t.place(o.W,o.H,A,groups);
      if(fresh){ ids.forEach(function(id,k){ if(r[k]) pg.items.push({id:bdUid(), t:"photo", pid:id, x:r[k].x, y:r[k].y, w:r[k].w}); }); }
      else { ph.forEach(function(it,k){ if(r[k]&&!it.locked){ it.x=r[k].x; it.y=r[k].y; it.w=r[k].w; it.hidden=false; } }); }
      B.sel=[]; commit(); toast(t.name+" layout. Drag anything to change it."); }
    function delSel(){ var pg=page(); B.sel.sort(function(a,b){ return b-a; }).forEach(function(k){ if(!pg.items[k].locked) pg.items.splice(k,1); }); B.sel=[]; commit(); }
    function dupSel(){ var pg=page(), add_=[]; B.sel.forEach(function(k){ var c=JSON.parse(JSON.stringify(pg.items[k])); c.id=bdUid(); c.x+=8; c.y+=8; c.locked=false; add_.push(c); });
      add_.forEach(function(c){ pg.items.push(c); }); B.sel=add_.map(function(_,j){ return pg.items.length-add_.length+j; }); commit(); }
    function reorder(k, to){ var pg=page(); to=Math.max(0,Math.min(pg.items.length-1,to)); if(to===k) return; var it=pg.items.splice(k,1)[0]; pg.items.splice(to,0,it); B.sel=[to]; commit(); }
    function nudge(dx,dy){ var pg=page(); B.sel.forEach(function(k){ var it=pg.items[k]; if(it.locked) return; it.x+=dx; it.y+=dy; }); commit(); }
    // ---- pointer: move, resize, snap ----
    function snapLines(skip){ var pg=page(), xs=[0,o.W/2,o.W,o.margin,o.W-o.margin], ys=[0,o.H/2,o.H,o.margin,o.H-o.margin];
      pg.items.forEach(function(it,k){ if(skip.indexOf(k)>=0||it.hidden) return; var h=hOf(it); xs.push(it.x,it.x+it.w/2,it.x+it.w); ys.push(it.y,it.y+h/2,it.y+h); }); return {xs:xs, ys:ys}; }
    function bestSnap(vals, lines, th){ var best=null; vals.forEach(function(v,vi){ lines.forEach(function(l){ var d=l-v; if(Math.abs(d)<=th&&(!best||Math.abs(d)<Math.abs(best.d))) best={d:d, at:l}; }); }); return best; }
    function guides(gx, gy){ var g=$(o.el).querySelector(".bd-guides"), s=B.s; if(!g) return; g.innerHTML=(gx!=null?'<i class="v" style="left:'+(gx*s).toFixed(1)+'px"></i>':'')+(gy!=null?'<i class="h" style="top:'+(gy*s).toFixed(1)+'px"></i>':''); }
    function down(e){ if(e.button!==0) return; var sh=$(o.el).querySelector(".bd-sheet"), pg=page(), hd=e.target.closest("[data-bd-h]"), el=e.target.closest("[data-bd]");
      if(B.edit>=0&&el&&+el.getAttribute("data-bd")===B.edit) return;   // typing in a text box
      if(!el){ if(B.sel.length){ B.sel=[]; render(); } return; }
      var k=+el.getAttribute("data-bd"), it=pg.items[k];
      if(e.shiftKey||e.ctrlKey||e.metaKey){ var j=B.sel.indexOf(k); if(j>=0) B.sel.splice(j,1); else B.sel.push(k); render(); return; }
      if(B.sel.indexOf(k)<0) B.sel=[k];
      if(it.locked){ render(); return; }
      e.preventDefault(); var s=B.s, x0=e.clientX, y0=e.clientY, moved=false, start=B.sel.map(function(q){ var a=pg.items[q]; return {k:q, x:a.x, y:a.y, w:a.w, h:hOf(a)}; }), L=snapLines(B.sel), th=6/s;
      var mode=hd?hd.getAttribute("data-bd-h"):"move", st0=start[0];
      if(B.sel.length===1&&!hd) render();   // show handles now
      function mv(ev){ var dx=(ev.clientX-x0)/s, dy=(ev.clientY-y0)/s; if(!moved&&Math.abs(dx)+Math.abs(dy)<3/s) return; moved=true;
        var els=$(o.el).querySelectorAll(".bd-sheet [data-bd]"), byK={}; Array.prototype.forEach.call(els,function(n){ byK[n.getAttribute("data-bd")]=n; });
        if(mode==="move"){ var a=start[0], nx=a.x+dx, ny=a.y+dy, sx=bestSnap([nx,nx+a.w/2,nx+a.w],L.xs,th), sy=bestSnap([ny,ny+a.h/2,ny+a.h],L.ys,th);
          if(sx){ dx+=sx.d; } if(sy){ dy+=sy.d; } guides(sx?sx.at:null, sy?sy.at:null);
          start.forEach(function(q){ var it2=pg.items[q.k]; it2.x=q.x+dx; it2.y=q.y+dy; var n=byK[q.k]; if(n){ n.style.left=(it2.x*s)+"px"; n.style.top=(it2.y*s)+"px"; } }); }
        else { var it3=pg.items[st0.k], ar=it3.t==="photo"?asp(it3):null, right=mode.indexOf("e")>=0, bottom=mode.indexOf("s")>=0;
          var w=Math.max(it3.t==="photo"?15:20, st0.w+(right?dx:-dx)), h=ar?w/ar:Math.max(8, st0.h+(bottom?dy:-dy));
          if(ar&&!right){ /* anchor right edge */ } it3.w=w; if(!ar) it3.h=h;
          it3.x=right?st0.x:st0.x+st0.w-w; it3.y=bottom?st0.y:st0.y+st0.h-h;
          var n2=byK[st0.k]; if(n2){ n2.style.left=(it3.x*s)+"px"; n2.style.top=(it3.y*s)+"px"; n2.style.width=(w*s)+"px"; n2.style.height=(h*s)+"px"; var sz=n2.querySelector(".bd-sz"); if(sz) sz.textContent=Math.round(w)+" × "+Math.round(h)+" MM"; } } }
      function up(){ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); guides(null,null); if(moved) commit(); }
      window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); }
    function bind(){ if(B.bound) return; B.bound=true; var box=$(o.el), sh=box.querySelector(".bd-sheet");
      sh.addEventListener("pointerdown",down);
      sh.addEventListener("dblclick",function(e){ var el=e.target.closest("[data-bd]"); if(!el) return; var k=+el.getAttribute("data-bd"), it=page().items[k]; if(it.t==="text"&&!it.locked){ B.edit=k; B.sel=[k]; render(); } });
      box.addEventListener("dragstart",function(e){ var p=e.target.closest&&e.target.closest("[data-bd-pic]"); if(!p) return; e.dataTransfer.setData("text/plain","bd:"+p.getAttribute("data-bd-pic")); e.dataTransfer.effectAllowed="copy"; });
      sh.addEventListener("dragover",function(e){ e.preventDefault(); e.dataTransfer.dropEffect="copy"; sh.classList.add("drop"); });
      sh.addEventListener("dragleave",function(){ sh.classList.remove("drop"); });
      sh.addEventListener("drop",function(e){ sh.classList.remove("drop"); var d=e.dataTransfer.getData("text/plain")||""; if(d.slice(0,3)!=="bd:") return; e.preventDefault(); var r=sh.getBoundingClientRect(); add(+d.slice(3),(e.clientX-r.left)/B.s,(e.clientY-r.top)/B.s); });
      box.addEventListener("click",function(e){ var t=e.target.closest("[data-bd-pic],[data-bd-page],[data-bd-act],[data-bd-tpl],[data-bd-ly],[data-bd-eye],[data-bd-lock],[data-bd-up],[data-bd-down],[data-bd-w],[data-bd-f],[data-bd-font],[data-bd-fs],[data-bd-al],[data-bd-paper]"); if(!t) return; act(t); }); }
    function act(t){ var pg=page(), d=doc(), one=B.sel.length===1?pg.items[B.sel[0]]:null, g=function(a){ return t.getAttribute(a); };
      if(t.hasAttribute("data-bd-pic")) return add(+g("data-bd-pic"));
      if(t.hasAttribute("data-bd-page")){ d.cur=+g("data-bd-page"); B.sel=[]; o.save(d); return render(); }
      if(t.hasAttribute("data-bd-tpl")) return applyLayout(o.layouts[+g("data-bd-tpl")]);
      if(t.hasAttribute("data-bd-eye")){ var a=pg.items[+g("data-bd-eye")]; a.hidden=!a.hidden; return commit(); }
      if(t.hasAttribute("data-bd-lock")){ var b=pg.items[+g("data-bd-lock")]; b.locked=!b.locked; return commit(); }
      if(t.hasAttribute("data-bd-up")){ var u=+g("data-bd-up"); return reorder(u,u+1); }
      if(t.hasAttribute("data-bd-down")){ var dn=+g("data-bd-down"); return reorder(dn,dn-1); }
      if(t.hasAttribute("data-bd-ly")){ B.sel=[+g("data-bd-ly")]; return render(); }
      if(t.hasAttribute("data-bd-w")&&one){ var cx=one.x+one.w/2, cy=one.y+hOf(one)/2; one.w=+g("data-bd-w"); one.x=cx-one.w/2; one.y=cy-hOf(one)/2; return commit(); }
      if(t.hasAttribute("data-bd-f")&&one){ one.f=g("data-bd-f"); return commit(); }
      if(t.hasAttribute("data-bd-font")&&one){ one.font=g("data-bd-font"); return commit(); }
      if(t.hasAttribute("data-bd-fs")&&one){ one.size=Math.max(6,Math.min(120,(one.size||14)+(+g("data-bd-fs"))*(one.size>=30?4:2))); return commit(); }
      if(t.hasAttribute("data-bd-al")&&one){ one.align=g("data-bd-al"); return commit(); }
      if(t.hasAttribute("data-bd-paper")){ d.paper=g("data-bd-paper"); return commit(); }
      var a2=g("data-bd-act");
      if(a2==="newpage"){ d.pages.splice(d.cur+1,0,{id:bdUid(), items:[]}); d.cur++; B.sel=[]; return commit(); }
      if(a2==="dup"){ var c=JSON.parse(JSON.stringify(pg)); c.id=bdUid(); c.items.forEach(function(it){ it.id=bdUid(); }); d.pages.splice(d.cur+1,0,c); d.cur++; B.sel=[]; toast("Copied. Try another version on this one."); return commit(); }
      if(a2==="delpage"){ if(d.pages.length<2) return; d.pages.splice(d.cur,1); d.cur=Math.max(0,d.cur-1); B.sel=[]; return commit(); }
      if(a2==="text") return addText();
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
      if(c==="Delete"||c==="Backspace"){ e.preventDefault(); delSel(); return true; }
      var st_=e.shiftKey?10:1; if(c==="ArrowLeft"){ e.preventDefault(); nudge(-st_,0); return true; } if(c==="ArrowRight"){ e.preventDefault(); nudge(st_,0); return true; }
      if(c==="ArrowUp"){ e.preventDefault(); nudge(0,-st_); return true; } if(c==="ArrowDown"){ e.preventDefault(); nudge(0,st_); return true; }
      if(c==="BracketRight"&&B.sel.length===1){ reorder(B.sel[0],B.sel[0]+1); return true; } if(c==="BracketLeft"&&B.sel.length===1){ reorder(B.sel[0],B.sel[0]-1); return true; }
      return false; }
    // ---- export: draw a page to a canvas at a given px-per-mm ----
    function draw(pg, ppm, cb){ var cv=document.createElement("canvas"); cv.width=Math.round(o.W*ppm); cv.height=Math.round(o.H*ppm); var g=cv.getContext("2d"), d=doc();
      g.fillStyle=(d.paper==="black")?"#0f0e0c":"#f4f1ea"; g.fillRect(0,0,cv.width,cv.height); var items=pg.items.filter(function(it){ return !it.hidden; }), i=0;
      (function next(){ if(i>=items.length){ cb(cv); return; } var it=items[i++];
        if(it.t==="photo"){ var im=new Image(); im.onload=function(){ g.save(); g.filter=BD_FILTERS[it.f||"none"][1]; g.drawImage(im, it.x*ppm, it.y*ppm, it.w*ppm, hOf(it)*ppm); g.restore(); next(); }; im.onerror=next; im.src=src(it); return; }
        var fs=(it.size||14)*0.3528*ppm, lh=fs*1.3, words=String(it.text||"").split(/(\s+)/), line="", y=it.y*ppm+fs, maxW=it.w*ppm;
        g.fillStyle=it.color||"#1c1915"; g.font=fs+"px "+BD_FONTS[it.font||"serif"][1]; g.textAlign=it.align==="center"?"center":"left"; var ax=it.align==="center"?(it.x+it.w/2)*ppm:it.x*ppm;
        String(it.text||"").split("\n").forEach(function(par){ line=""; par.split(/\s+/).forEach(function(w){ var t2=line?line+" "+w:w; if(g.measureText(t2).width>maxW&&line){ g.fillText(line,ax,y); y+=lh; line=w; } else line=t2; }); g.fillText(line,ax,y); y+=lh; });
        next(); })(); }
    B.render=render; B.key=key; B.doc_=doc; B.page=page; B.draw=draw; B.add=add; B.applyLayout=applyLayout; B.reset=function(d){ B.doc=d; B.sel=[]; B.hist=[]; B.hi=-1; push(); };
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
  var FO_LAYOUTS=[
    {name:"Series", place:function(W,H,A,G){ var n=Math.max(1,Math.max.apply(null,G.concat([0]))+1), m=60, gap=40, bh=(H-2*m-gap*2)/3, out=[];
      for(var g=0;g<Math.min(3,n);g++){ var ix=[]; G.forEach(function(v,i){ if(v===g) ix.push(i); }); var r=bdRows({x:m,y:m+g*(bh+gap),w:W-2*m,h:bh},ix.map(function(i){ return A[i]; }),18); ix.forEach(function(i,k){ out[i]=r[k]; }); } return out; }},
    {name:"Salon", place:function(W,H,A){ return bdRows({x:60,y:60,w:W-120,h:H-120},A,18); }},
    {name:"Hero", place:function(W,H,A){ if(A.length<2) return [bdFit({x:60,y:60,w:W-120,h:H-120},A[0])]; return [bdFit({x:60,y:60,w:W-120,h:H*0.46},A[0])].concat(bdRows({x:60,y:H*0.46+90,w:W-120,h:H*0.54-150},A.slice(1),18)); }},
    {name:"Grid", place:function(W,H,A){ return bdCells({x:60,y:60,w:W-120,h:H-120},A,24); }},
    {name:"Column", place:function(W,H,A){ return bdCells({x:W*0.22,y:60,w:W*0.56,h:H-120},A,24,1); }}];
  function bdDownload(blob, fname){ var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=fname; document.body.appendChild(a); a.click(); a.remove(); }
  var wsB=Board({el:"st-workshop", W:420, H:297, margin:15, defW:120, maxAuto:6, text:true, filters:true, papers:null, pageWord:"PAGE", sizes:[60,90,120,180,260],
    emptyTitle:"Your page, your way.", emptyBody:"Drag frames in from the left, add text, or pick a layout to start from.",
    cap:function(d){ return "A3 LANDSCAPE · 420 × 297 MM · PAGE "+(d.cur+1)+" OF "+d.pages.length; },
    load:function(){ return st.wsBoard||null; }, save:function(d){ st.wsBoard=d; saveSession(); },
    layouts:WS_LAYOUTS, exportLabel:"EXPORT PAGES AS PDF",
    exportFn:function(B){ var d=B.doc_(), out=[], i=0; toast("Building your workshop PDF…"); (function next(){ if(i>=d.pages.length){ pbBuildPDF(out, "workshop.pdf", "Workshop PDF downloaded"); return; } B.draw(d.pages[i++], 150/25.4, function(cv){ out.push(cv); next(); }); })(); }});
  var foB=Board({el:"st-folio", W:841, H:1189, margin:60, defW:260, maxAuto:12, text:false, filters:false, papers:["white","black"], pageWord:"LAYOUT", sizes:[150,200,260,360,500,700],
    emptyTitle:"One A0 panel. No text.", emptyBody:"Drag frames in, or pick Series to lay out each location as its own band. Every frame keeps its shape.",
    cap:function(d){ return "A0 PORTRAIT · 841 × 1189 MM · LAYOUT "+(d.cur+1)+" OF "+d.pages.length; },
    load:function(){ return st.foBoard||null; }, save:function(d){ st.foBoard=d; saveSession(); },
    layouts:FO_LAYOUTS, exportLabel:"EXPORT THIS LAYOUT · A0 PNG",
    exportFn:function(B){ toast("Building your A0 panel…"); B.draw(B.page(), 3508/841, function(cv){ cv.toBlob(function(b){ bdDownload(b, namePrefix()+"folio-A0.png"); toast("A0 panel downloaded"); },"image/png"); }); }});
  // old workshop pages (fixed template) come across as editable boards
  function wsMigrate(old){ return {cur:0, paper:"white", pages:old.map(function(pg){ var items=[], ia=photos.map(function(p){ return p.url; }).indexOf(pg.a), ib=photos.map(function(p){ return p.url; }).indexOf(pg.b);
      if(ia>=0) items.push({id:bdUid(), t:"photo", pid:stId(ia), x:15, y:40, w:180}); if(ib>=0&&ib!==ia) items.push({id:bdUid(), t:"photo", pid:stId(ib), x:215, y:40, w:180});
      if(pg.title) items.push({id:bdUid(), t:"text", x:15, y:12, w:300, h:20, text:pg.title, size:24, font:"serif"});
      var notes=[pg.n1,pg.n2,pg.next].filter(Boolean).join("\n\n"); if(notes) items.push({id:bdUid(), t:"text", x:15, y:180, w:390, h:100, text:notes, size:11, font:"sans"});
      return {id:bdUid(), items:items}; })}; }
