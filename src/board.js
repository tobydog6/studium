  // ================= BOARD: a free layout page, used by the Workbook (A3 landscape) and Folio (A1 panels) =================
  // Everything sits on the page in millimetres. Photos always keep their own shape (3:2 stays 3:2, 6x7 stays 6x7):
  // you size them from a corner, never crop them. Workbook pages also take text. Every item is a layer you can
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

  // ---- filling a folio section edge to edge ----
  // Frames never crop, so a section is filled by finding the arrangement of rows (or columns) whose shapes add up
  // closest to the section's own shape, then easing any last sliver into the gutters. Returns the rects in the order
  // given and how much of the box they cover.
  function bdPartitions(n, cb){ if(n<=11){ for(var m=0;m<(1<<(n-1));m++){ var rows=[], cur=[0]; for(var i=1;i<n;i++){ if(m&(1<<(i-1))){ rows.push(cur); cur=[i]; } else cur.push(i); } rows.push(cur); cb(rows); } return; }
    for(var r=1;r<=n;r++){ var rr=[], per=Math.ceil(n/r); for(var j=0;j<n;j+=per){ var row=[]; for(var q=j;q<Math.min(n,j+per);q++) row.push(q); rr.push(row); } cb(rr); } }
  function bdPackRows(b, A, gap){ var n=A.length, best=null; if(!n) return {r:[], cover:0};
    bdPartitions(n, function(rows){ var hs=rows.map(function(row){ return (b.w-gap*(row.length-1))/row.reduce(function(a,i){ return a+A[i]; },0); }), G=gap*(rows.length-1), H=hs.reduce(function(a,x){ return a+x; },0);
      var k=Math.min(1,(b.h-G)/H), cover=k<1?k*k*(H*b.w)/(b.w*b.h)+0:(H/(b.h-G))*(b.h-G)/b.h;   // share of the box under photographs
      if(k<1){ var used=0; rows.forEach(function(row,ri){ used+=hs[ri]*k*(row.reduce(function(a,i){ return a+A[i]; },0)*hs[ri]*k); }); cover=used/(b.w*b.h); }
      var tiny=rows.some(function(row,ri){ return hs[ri]*k<b.h*0.12; })?0.05:0, score=cover-tiny;
      if(!best||score>best.score) best={score:score, cover:cover, rows:rows, hs:hs, k:k, H:H, G:G}; });
    var out=[], k=best.k, rowsH=best.H*k, slack=b.h-best.G-rowsH, nr=best.rows.length, gy=gap+(nr>1?Math.min(gap*1.2, slack/(nr-1)):0), restY=b.h-rowsH-gy*(nr-1), y=b.y+Math.max(0,restY)/2;
    best.rows.forEach(function(row,ri){ var h=best.hs[ri]*k, rw=row.reduce(function(a,i){ return a+A[i]*h; },0), gx=k<1?gap:(row.length>1?(b.w-rw)/(row.length-1):0), tot=rw+gx*(row.length-1), x=b.x+(b.w-tot)/2;
      row.forEach(function(i){ out[i]={x:x, y:y, w:A[i]*h, h:h}; x+=A[i]*h+gx; }); y+=h+gy; });
    return {r:out, cover:best.cover}; }
  function bdPackCols(b, A, gap){ var t=bdPackRows({x:b.y, y:b.x, w:b.h, h:b.w}, A.map(function(a){ return 1/a; }), gap); return {r:t.r.map(function(q){ return {x:q.y, y:q.x, w:q.h, h:q.w}; }), cover:t.cover}; }
  function bdPackHero(b, A, gap){ if(A.length<2) return bdPackRows(b, A, gap); var best=null, rest=A.slice(1);
    [["l",1],["t",1]].forEach(function(o_){ for(var f=0.38;f<=0.8;f+=0.06){ var hb, rb;
      if(o_[0]==="l"){ var hw=Math.min(b.w*f, b.h*A[0]); hb={x:b.x, y:b.y+(b.h-hw/A[0])/2, w:hw, h:hw/A[0]}; rb={x:b.x+hw+gap, y:b.y, w:b.w-hw-gap, h:b.h}; }
      else { var hh=Math.min(b.h*f, b.w/A[0]); hb={x:b.x+(b.w-hh*A[0])/2, y:b.y, w:hh*A[0], h:hh}; rb={x:b.x, y:b.y+hh+gap, w:b.w, h:b.h-hh-gap}; }
      if(rb.w<20||rb.h<20) continue; var p1=bdPackRows(rb, rest, gap), p2=bdPackCols(rb, rest, gap), p=p1.cover>=p2.cover?p1:p2, cover=(hb.w*hb.h+p.cover*rb.w*rb.h)/(b.w*b.h);
      if(!best||cover>best.cover) best={cover:cover, r:[hb].concat(p.r)}; } });
    return best||bdPackRows(b, A, gap); }
  function bdPack(b, A, gap, style){ if(style==="rows") return bdPackRows(b,A,gap); if(style==="cols") return bdPackCols(b,A,gap); if(style==="hero") return bdPackHero(b,A,gap);
    var p=bdPackRows(b,A,gap), q=bdPackCols(b,A,gap); return q.cover>p.cover+0.01?q:p; }
  // the order of frames that fills the section best (tries every order for a handful, sensible ones beyond)
  function bdBestOrder(b, A, gap, style){ var n=A.length, idx=A.map(function(_,i){ return i; }), best={o:idx, c:bdPack(b,A,gap,style).cover};
    function tryO(o){ var c=bdPack(b, o.map(function(i){ return A[i]; }), gap, style).cover; if(c>best.c+0.002) best={o:o.slice(), c:c}; }
    if(n<=6){ (function perm(a,l){ if(l===a.length){ tryO(a); return; } for(var i=l;i<a.length;i++){ var t=a[l]; a[l]=a[i]; a[i]=t; perm(a,l+1); t=a[l]; a[l]=a[i]; a[i]=t; } })(idx.slice(),0); }
    else { var byA=idx.slice().sort(function(x,y){ return A[x]-A[y]; }); tryO(byA); tryO(byA.slice().reverse());
      var inter=[]; for(var i=0,j=n-1;i<=j;i++,j--){ inter.push(byA[j]); if(i!==j) inter.push(byA[i]); } tryO(inter); }
    return best.o; }


  // ---- filling a folio third completely: no white space, each photo cropped a little to its cell ----
  // The third is cut into cells guillotine-style (each cut runs the full height or width of what's left), with each
  // photo's share of the area set by its size (1, 2 or 3). Every way of cutting is tried, and the one that crops the
  // photos least wins: a cell's shape against its photo's shape, squared on a log scale, weighted by the photo's size.
  // Rows and Columns make every cut run the same way; Hero gives the biggest photo its own block first.
  var BD_SZW=[0,1,2.3,4.2];
  function bdCellCost(c, a, w, tiny){ var l=Math.log((c.w/Math.max(c.h,1e-6))/a); return w*l*l+(Math.min(c.w,c.h)<tiny?4:0); }
  function bdTree(b, A, W, gap, i, j, tiny, dir){ var n=j-i; if(n===1) return {r:[b], c:bdCellCost(b,A[i],W[i],tiny)};
    var tot=0, k, best=null; for(k=i;k<j;k++) tot+=W[k];
    if(n>9){ var acc=0, mid=i+1; for(k=i;k<j-1;k++){ acc+=W[k]; if(acc>=tot/2){ mid=k+1; break; } } return bdSplit(b,A,W,gap,i,mid,j,tot,dir||(b.w>=b.h?"v":"h"),tiny,dir); }
    var acc2=0; for(k=i+1;k<j;k++){ acc2+=W[k-1]; (dir?[dir]:["v","h"]).forEach(function(d){ var t=bdSplit(b,A,W,gap,i,k,j,tot,d,tiny,dir,acc2); if(t&&(!best||t.c<best.c)) best=t; }); }
    return best; }
  function bdSplit(b,A,W,gap,i,k,j,tot,d,tiny,dir,accK){ var acc=accK; if(acc==null){ acc=0; for(var q=i;q<k;q++) acc+=W[q]; } var f=acc/tot, b1, b2;
    if(d==="v"){ var w1=(b.w-gap)*f; if(w1<1||b.w-gap-w1<1) return null; b1={x:b.x,y:b.y,w:w1,h:b.h}; b2={x:b.x+w1+gap,y:b.y,w:b.w-gap-w1,h:b.h}; }
    else { var h1=(b.h-gap)*f; if(h1<1||b.h-gap-h1<1) return null; b1={x:b.x,y:b.y,w:b.w,h:h1}; b2={x:b.x,y:b.y+h1+gap,w:b.w,h:b.h-gap-h1}; }
    var L=bdTree(b1,A,W,gap,i,k,tiny,dir), R=bdTree(b2,A,W,gap,k,j,tiny,dir); if(!L||!R) return null; return {r:L.r.concat(R.r), c:L.c+R.c}; }
  // rows: the photos split into rows, each row as tall as its photos need, then every row stretched to fill
  function bdRowsFill(b, A, W, gap, tiny){ var n=A.length, best=null;
    bdPartitions(n, function(rows){ var hs=rows.map(function(row){ return (b.w-gap*(row.length-1))/row.reduce(function(s,i){ return s+A[i]*Math.sqrt(W[i]); },0); }), H=hs.reduce(function(s,x){ return s+x; },0), k=(b.h-gap*(rows.length-1))/H, out=[], c=0, y=b.y;
      rows.forEach(function(row,ri){ var h=hs[ri]*k, x=b.x; row.forEach(function(i,qi){ var w=qi===row.length-1?b.x+b.w-x:A[i]*Math.sqrt(W[i])*hs[ri]; out[i]={x:x,y:y,w:w,h:h}; c+=bdCellCost(out[i],A[i],W[i],tiny); x+=w+gap; }); y+=h+gap; });
      if(!best||c<best.c) best={r:out,c:c}; });
    return best; }
  function bdFill(b, A, W, gap, style){ var n=A.length; if(!n) return {r:[], c:0}; W=W||A.map(function(){ return 1; }); var tiny=Math.min(b.w,b.h)*0.14, key=[style,b.w.toFixed(1),b.h.toFixed(1),A.map(function(a){ return a.toFixed(3); }).join(","),W.join(",")].join("|"), hit=bdFill.cache[key], res;
    if(hit) return {r:hit.r.map(function(q){ return {x:q.x+b.x,y:q.y+b.y,w:q.w,h:q.h}; }), c:hit.c};
    var b0={x:0,y:0,w:b.w,h:b.h};
    if(style==="rows") res=bdRowsFill(b0,A,W,gap,tiny);
    else if(style==="cols"){ var t=bdRowsFill({x:0,y:0,w:b.h,h:b.w},A.map(function(a){ return 1/a; }),W,gap,tiny); res={r:t.r.map(function(q){ return {x:q.y,y:q.x,w:q.h,h:q.w}; }), c:t.c}; }
    else if(style==="hero"&&n>1){ var hi=0; W.forEach(function(w,i){ if(w>W[hi]) hi=i; }); var rest=[], RA=[], RW=[]; A.forEach(function(a,i){ if(i!==hi){ rest.push(i); RA.push(a); RW.push(W[i]); } });
      [0.5,0.56,0.62,0.68].forEach(function(f){ ["l","t"].forEach(function(side){ var hb, rb;
        if(side==="l"){ hb={x:0,y:0,w:(b.w-gap)*f,h:b.h}; rb={x:hb.w+gap,y:0,w:b.w-gap-hb.w,h:b.h}; } else { hb={x:0,y:0,w:b.w,h:(b.h-gap)*f}; rb={x:0,y:hb.h+gap,w:b.w,h:b.h-gap-hb.h}; }
        var p=bdTree(rb,RA,RW,gap,0,RA.length,tiny); if(!p) return; var c=bdCellCost(hb,A[hi],W[hi]*1.5,tiny)+p.c, out=[]; out[hi]=hb; rest.forEach(function(i,q){ out[i]=p.r[q]; });
        if(!res||c<res.c) res={r:out,c:c}; }); }); }
    else res=bdTree(b0,A,W,gap,0,n,tiny);
    bdFill.cache[key]=res; if(++bdFill.n>400){ bdFill.cache={}; bdFill.n=0; }
    return {r:res.r.map(function(q){ return {x:q.x+b.x,y:q.y+b.y,w:q.w,h:q.h}; }), c:res.c}; }
  bdFill.cache={}; bdFill.n=0;
  // the order that crops least (every order for a handful, sensible ones beyond)
  function bdFillOrder(b, A, W, gap, style){ var n=A.length, idx=A.map(function(_,i){ return i; }), best={o:idx, c:bdFill(b,A,W,gap,style).c};
    function tryO(o){ var c=bdFill(b, o.map(function(i){ return A[i]; }), o.map(function(i){ return W[i]; }), gap, style).c; if(c<best.c-1e-4) best={o:o.slice(), c:c}; }
    if(n<=5){ (function perm(a,l){ if(l===a.length){ tryO(a); return; } for(var i=l;i<a.length;i++){ var t=a[l]; a[l]=a[i]; a[i]=t; perm(a,l+1); t=a[l]; a[l]=a[i]; a[i]=t; } })(idx.slice(),0); }
    else { var byA=idx.slice().sort(function(x,y){ return A[x]-A[y]; }); tryO(byA); tryO(byA.slice().reverse()); var inter=[]; for(var i=0,j=n-1;i<=j;i++,j--){ inter.push(byA[j]); if(i!==j) inter.push(byA[i]); } tryO(inter); }
    return best.o; }

  function Board(o){
    var B={o:o, doc:null, sel:[], hist:[], hi:-1, s:1, bound:false, edit:-1, caret:null, view:-1};
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
    function hOf(it){ return it.t==="photo"?(it.ch!=null&&it.sec?it.ch:it.w/asp(it)):it.t==="line"?Math.abs(it.y2-it.y):it.h; }
    function szOf(it){ return Math.max(1,Math.min(3,it.sz||1)); }
    function bb(it){ if(it.t==="line") return {x:Math.min(it.x,it.x2), y:Math.min(it.y,it.y2), w:Math.abs(it.x2-it.x), h:Math.abs(it.y2-it.y)}; return {x:it.x, y:it.y, w:it.w, h:hOf(it)}; }
    // folio sections: each A1 panel in thirds, top to bottom. Click ⤢ (or double-click empty space) to work on one up close.
    var SEC_NAMES=["TOP","MIDDLE","BOTTOM"];
    var BD_RATIOS=[1, 4/5, 5/4, 2/3, 3/2, 16/9, 9/16];
    var FO_SPLITS={thirds:[1,1,1], top:[2,1], bottom:[1,2], halves:[1,1], whole:[1]}, FO_SPLIT_NAMES={thirds:"THIRDS", top:"BIG TOP", bottom:"BIG BOTTOM", halves:"HALVES", whole:"WHOLE PANEL"};
    var SEC_BORDER=6, SEC_GAP=4;   // white border round each panel, and the gutter between frames and sections, in mm
    function secs(){ if(!o.sections) return []; var d=doc(), out=[]; page().splits=page().splits||{};
      for(var p=0;p<d.panels;p++){ var sp=FO_SPLITS.thirds, U=sp.reduce(function(a,x){ return a+x; },0), x=p*o.panelW+SEC_BORDER, w=o.panelW-2*SEC_BORDER, h=o.H-2*SEC_BORDER-SEC_GAP*(sp.length-1), y=SEC_BORDER;
        sp.forEach(function(u,r){ var hh=h*u/U, nm=sp.length===1?"WHOLE":sp.length===2?(r?"BOTTOM":"TOP"):SEC_NAMES[r];
          out.push({key:p+"."+r, p:p, x:x, y:y, w:w, h:hh, label:"PANEL "+(p+1)+" · "+nm}); y+=hh+SEC_GAP; }); }
      return out; }
    function secAt(x,y){ var S=secs(), bi=-1, bd=1e9; for(var i=0;i<S.length;i++){ var q=S[i]; if(x>=q.x-SEC_GAP&&x<q.x+q.w+SEC_GAP&&y>=q.y-SEC_GAP&&y<q.y+q.h+SEC_GAP){ var dd=Math.hypot(x-(q.x+q.w/2),y-(q.y+q.h/2)); if(dd<bd){ bd=dd; bi=i; } } } return bi; }
    function secIdx(key){ var S=secs(); for(var i=0;i<S.length;i++) if(S[i].key===key) return i; return -1; }
    function secStyle(key){ var d=doc(); page().secStyle=page().secStyle||{}; return page().secStyle[key]||"auto"; }
    function secItems(key){ var pg=page(), a=[]; pg.items.forEach(function(it,k){ if(it.t==="photo"&&it.sec===key&&!it.hidden) a.push(k); }); return a; }
    // every folio frame lives in a section, and each section is packed to fill edge to edge
    function repack(){ if(!o.sections) return; var pg=page(), S=secs(), keys={}; B.fill={};
      S.forEach(function(q){ keys[q.key]=q; });
      pg.items.forEach(function(it){ if(it.t!=="photo") return; if(!it.sec||!keys[it.sec]){ var b=bb(it), i=secAt(b.x+b.w/2, b.y+b.h/2); it.sec=(S[i>=0?i:0]||{}).key; } });
      S.forEach(function(q){ var ks=secItems(q.key); if(!ks.length) return; var r=bdFill(q, ks.map(function(k){ return asp(pg.items[k]); }), ks.map(function(k){ return BD_SZW[szOf(pg.items[k])]; }), SEC_GAP, secStyle(q.key));
        ks.forEach(function(k,j){ var it=pg.items[k], rr=r.r[j]; if(!rr) return; delete it.box;
          /* frames only ever come in standard print ratios: the packed cell's shape snaps to the nearest one, centred in its space */
          var a=rr.w/Math.max(rr.h,1e-6), T=BD_RATIOS.reduce(function(b,c){ return Math.abs(Math.log(c/a))<Math.abs(Math.log(b/a))?c:b; }, BD_RATIOS[0]), w=rr.w, h=rr.h, x=rr.x, y=rr.y;
          if(a>T){ w=h*T; x+=(rr.w-w)/2; } else { h=w/T; y+=(rr.h-h)/2; }
          it.x=x; it.y=y; it.w=w; it.ch=h; }); B.fill[q.key]=1; }); }
    function bestOrderSec(key){ var pg=page(), q=secs()[secIdx(key)], ks=secItems(key); if(!q||ks.length<2) return; var A=ks.map(function(k){ return asp(pg.items[k]); }), ord=bdFillOrder(q, A, ks.map(function(k){ return BD_SZW[szOf(pg.items[k])]; }), SEC_GAP, secStyle(key));
      var moved=ord.map(function(j){ return pg.items[ks[j]]; }); ks.forEach(function(k,j){ pg.items[k]=moved[j]; }); }
    var SEC_STYLES=["auto","rows","cols","hero"];
    function shuffleSec(key){ var pg=page(), q=secs()[secIdx(key)], ks=secItems(key); if(!q||ks.length<2){ toast("Put two or more frames in this section to shuffle"); return; }
      var look=function(o2,stl){ return o2.map(function(j){ return pg.items[ks[j]].pid; }).join()+"|"+stl; }, cur=look(ks.map(function(_,j){ return j; }),secStyle(key)), tries=[], best=0;   // what it looks like: which photo where, and how it packs
      best=1e9; for(var t=0;t<24;t++){ var o2=ks.map(function(_,j){ return j; }); for(var i=o2.length-1;i>0;i--){ var r=Math.floor(Math.random()*(i+1)), tmp=o2[i]; o2[i]=o2[r]; o2[r]=tmp; }
        var sz=ks.map(function(){ return 1; }), nb=Math.random()<0.8?1+Math.floor(Math.random()*Math.min(2,ks.length-1)):0; for(var bz=0;bz<nb;bz++) sz[Math.floor(Math.random()*ks.length)]=2+Math.floor(Math.random()*2);   // a size or two changes too
        var stl=SEC_STYLES[Math.floor(Math.random()*SEC_STYLES.length)], cst=bdFill(q, o2.map(function(j){ return asp(pg.items[ks[j]]); }), o2.map(function(j){ return BD_SZW[sz[j]]; }), SEC_GAP, stl).c;
        tries.push({o:o2, s:stl, c:cst, sz:sz}); if(cst<best) best=cst; }
      var ok=tries.filter(function(x){ return x.c<=best*1.6+0.08&&look(x.o,x.s)!==cur; }); if(!ok.length) ok=tries.filter(function(x){ return look(x.o,x.s)!==cur; }); var pick=(ok.length?ok:tries)[Math.floor(Math.random()*(ok.length||tries.length))];
      var moved=pick.o.map(function(j){ var m=pg.items[ks[j]]; m.sz=pick.sz[j]; return m; }); ks.forEach(function(k,j){ pg.items[k]=moved[j]; });
      page().secStyle=page().secStyle||{}; page().secStyle[key]=pick.s; B.shuffles=(B.shuffles||0)+1; if(o.sections&&typeof qFolioArranged==="function") qFolioArranged(parseInt(key,10)); commit(); }
    function curSec(){ var S=secs(); if(B.view>=0&&S[B.view]) return S[B.view].key; if(B.sel.length){ var it=page().items[B.sel[0]]; if(it&&it.sec) return it.sec; } return null; }
    function targetSec(){ var k=curSec(); if(k) return k; var S=secs(), best=null, bn=1e9; S.forEach(function(q){ var n=secItems(q.key).length; if(n<bn){ bn=n; best=q.key; } }); return best; }
    // put frames into a section (moving them if they're already on the board), then find the order that fills it best
    function intoSec(key, list, before){ var pg=page(), add_=[];   // always a new copy: the same frame can appear more than once
      list.forEach(function(i){ add_.push({id:bdUid(), t:"photo", pid:stId(i), x:0, y:0, w:10}); });
      add_.forEach(function(it){ it.sec=key; });
      var at=before>=0?before:-1; if(at<0){ var ks=secItems(key); at=ks.length?ks[ks.length-1]+1:pg.items.length; }
      Array.prototype.splice.apply(pg.items,[Math.min(at,pg.items.length),0].concat(add_));
      if(list.length>1) bestOrderSec(key);
      B.sel=add_.map(function(it){ return pg.items.indexOf(it); }); commit(); }
    // fill the whole board: frames shared across the sections (a location per panel when it fits), every section packed
    function fillBoard(style){ var pg=page(), d=doc(), ph=pg.items.filter(function(it){ return it.t==="photo"&&idxOf(it)>=0; }), idx;
      if(ph.length) idx=ph.map(function(it){ return idxOf(it); }); else { idx=stPicks(); if(!idx.length) idx=photos.map(function(_,i){ return i; }).slice(-o.maxAuto); idx=idx.slice(0,o.maxAuto); }
      pg.items=pg.items.filter(function(it){ return it.t!=="photo"; }); page().secStyle={}; page().splits=page().splits||{};
      var n=idx.length, P=d.panels, places=[], byP={}; idx.forEach(function(i){ var pl=stPlaceOf(photos[i]); if(!byP[pl]){ byP[pl]=[]; places.push(pl); } byP[pl].push(i); });
      var perPanel=[]; for(var p=0;p<P;p++) perPanel.push([]);
      if(places.length===P) places.forEach(function(pl,p){ perPanel[p]=byP[pl]; }); else idx.forEach(function(i,j){ perPanel[Math.min(P-1,Math.floor(j*P/n))].push(i); });
      // for each panel, try every way of splitting it and keep the one its frames fill best
      perPanel.forEach(function(list,p){ if(!list.length) return; var best=null;
        Object.keys(FO_SPLITS).forEach(function(sk){ page().splits[p]=sk; var ss=secs().filter(function(q){ return q.p===p; }), area=ss.reduce(function(a,q){ return a+q.w*q.h; },0), m=ss.length;
          if(list.length<m) return; var groups=ss.map(function(){ return []; }), acc=0, gi=0;
          list.forEach(function(i,j){ var share=(j+0.5)/list.length; while(gi<m-1&&share>(acc+ss[gi].w*ss[gi].h)/area){ acc+=ss[gi].w*ss[gi].h; gi++; } groups[gi].push(i); });
          if(groups.some(function(g){ return !g.length; })) return;
          var cover=0; groups.forEach(function(g,k){ var A=g.map(stAspect), o2=bdBestOrder(ss[k],A,SEC_GAP,style); g.splice.apply(g,[0,g.length].concat(o2.map(function(j){ return g[j]; }))); cover+=bdPack(ss[k], g.map(stAspect), SEC_GAP, style).cover*ss[k].w*ss[k].h/area; });
          if(!best||cover>best.cover+0.005) best={cover:cover, sk:sk, groups:groups, keys:ss.map(function(q){ return q.key; })}; });
        if(!best){ page().splits[p]="whole"; best={sk:"whole", groups:[list], keys:[p+".0"]}; }
        page().splits[p]=best.sk; best.groups.forEach(function(g,k){ page().secStyle[best.keys[k]]=style; g.forEach(function(i){ pg.items.push({id:bdUid(), t:"photo", pid:stId(i), x:0, y:0, w:10, sec:best.keys[k]}); }); }); });
      B.sel=[]; B.view=-1; commit();
      var f=B.fill||{}, ks=Object.keys(f), avg=ks.length?ks.reduce(function(a,k){ return a+f[k]; },0)/ks.length:0;
      toast(avg>0.86?"Board filled edge to edge. Drag frames between sections to rearrange.":"Board filled as far as these frames allow ("+Math.round(avg*100)+"%). More frames per panel fill it out, like a finished folio."); }
    function secRect(q,s){ return 'left:'+(q.x*s).toFixed(1)+'px;top:'+(q.y*s).toFixed(1)+'px;width:'+(q.w*s).toFixed(1)+'px;height:'+(q.h*s).toFixed(1)+'px'; }
    function zoom(i){ B.view=i; B.sel=[]; render(); }
    function gidSel(k){ var pg=page(), g=pg.items[k]&&pg.items[k].gid; if(!g) return [k]; var a=[]; pg.items.forEach(function(it,j){ if(it.gid===g&&!it.hidden) a.push(j); }); return a; }
    function selBox(list){ var pg=page(), x0=1e9, y0=1e9, x1=-1e9, y1=-1e9; (list||B.sel).forEach(function(k){ var b=bb(pg.items[k]); x0=Math.min(x0,b.x); y0=Math.min(y0,b.y); x1=Math.max(x1,b.x+b.w); y1=Math.max(y1,b.y+b.h); }); return {x:x0, y:y0, w:x1-x0, h:y1-y0}; }
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
      var handles=one&&!it.sec?'<i class="bd-h nw" data-bd-h="nw"></i><i class="bd-h ne" data-bd-h="ne"></i><i class="bd-h sw" data-bd-h="sw"></i><i class="bd-h se" data-bd-h="se"></i>':'';
      var cls='bd-it '+({photo:'ph',text:'tx',shape:'sh',slot:'sl'}[it.t]||'tx')+(sel?' sel':'')+(it.locked?' locked':'');
      if(it.t==="photo") return '<div class="'+cls+'" data-bd="'+k+'" style="'+st_+'"><img src="'+src(it)+'" alt="" draggable="false" style="filter:'+BD_FILTERS[it.f||"none"][1]+'">'+(sel&&B.sel.length===1?'<span class="bd-sz">'+Math.round(it.w)+' × '+Math.round(h)+' MM</span>':'')
        +(it.sec?'<button class="bd-szb" data-bd-size="'+k+'" title="Make it bigger or smaller">'+[1,2,3].map(function(z){ return '<i class="'+(z<=szOf(it)?'on':'')+'"></i>'; }).join("")+'<span>SIZE</span></button>':'')+handles+'</div>';
      if(it.t==="shape") return '<div class="'+cls+'" data-bd="'+k+'" style="'+st_+';'+(it.outline?'border:'+Math.max(1,0.7*s).toFixed(1)+'px solid '+(it.fill||inkOf(page())):'background:'+(it.fill||"#2f2f31"))+'">'+handles+'</div>';
      if(it.t==="slot") return '<div class="'+cls+'" data-bd="'+k+'" style="'+st_+'"><span><b>'+cbEsc(it.label||"Photo")+'</b>Drag a frame here</span>'+handles+'</div>';
      var f=BD_FONTS[it.font||"serif"][1], fs=(it.size||14)*0.3528*s;
      return '<div class="'+cls+'" data-bd="'+k+'" style="'+st_+'"><div class="bd-tx" data-ph="'+cbEsc(it.ph||"Click to write")+'" style="font-family:'+f+';font-size:'+fs.toFixed(2)+'px;color:'+(it.color||inkOf(page()))+';text-align:'+(it.align||"left")+(it.bold?';font-weight:600':'')+'"'+(B.edit===k?' contenteditable="true"':'')+'>'+cbEsc(it.text||"")+'</div>'+handles+'</div>'; }
    function render(){ var box=$(o.el); if(!box||box.classList.contains("hidden")) return; bind(); var d=doc(), pg=page(), stage=box.querySelector(".bd-stage");
      var S=secs(); if(B.view>=S.length) B.view=-1; var v=B.view>=0?S[B.view]:{x:0,y:0,w:o.W,h:o.H}, padL=o.tools?74:0, zb=o.sections?30:0;
      var aw=stage.clientWidth-padL-48, ah=stage.clientHeight-28-zb, s=Math.max(0.05,Math.min(aw/v.w, ah/v.h)); B.s=s;
      var sh=box.querySelector(".bd-sheet"), bg=bgOf(pg); sh.style.width=(o.W*s).toFixed(1)+"px"; sh.style.height=(o.H*s).toFixed(1)+"px"; sh.className="bd-sheet "+(bdDark(bg)?"black":"white")+(B.view>=0?" zoomed":"");
      sh.style.left=(padL+24+(aw-v.w*s)/2-v.x*s).toFixed(1)+"px"; sh.style.top=(14+zb+(ah-v.h*s)/2-v.y*s).toFixed(1)+"px";
      sh.style.background=o.bgs?BD_BGS[bg][1]:"";
      pg.items.forEach(function(it){ if(it.t==="photo"&&it.box){ var r=bdTop(it.box, asp(it)); it.x=r.x; it.y=r.y; it.w=r.w; } }); repack();
      B.sel=B.sel.filter(function(k){ return k<pg.items.length&&!pg.items[k].hidden; });
      var html=""; pg.items.forEach(function(it,k){ if(!it.hidden) html+=itemHTML(it,k,s); });
      if(o.panelW) for(var p=1;p<d.panels;p++) html+='<i class="bd-seam" style="left:'+(p*o.panelW*s).toFixed(1)+'px"></i>';
      S.forEach(function(q,i){ var f=B.fill&&B.fill[q.key], empty=!secItems(q.key).length;
        if(empty) html+='<div class="bd-secempty" style="'+secRect(q,s)+'"><span>'+q.label+'</span><b>Drop frames here</b></div>';
        html+='<div class="bd-secg'+(B.view>=0&&B.view!==i?' dim':'')+(B.view===i?' cur':'')+'" style="'+secRect(q,s)+'">'
        +(B.view<0?'<button data-bd-zoom="'+i+'" title="Zoom into '+q.label.toLowerCase()+'">⤢</button>':'')+(!empty?'<span>'+q.label+' · '+Math.round((f||0)*100)+'% FILLED</span>':'')+'</div>'; });
      if(!pg.items.length&&B.view<0&&!o.sections) html+='<div class="bd-empty"><b>'+o.emptyTitle+'</b><span>'+o.emptyBody+'</span></div>';
      sh.innerHTML=html+'<div class="bd-guides"></div>';
      renderTools(); renderZoomBar(stage, S);
      if(B.edit>=0){ var ed=sh.querySelector('[data-bd="'+B.edit+'"] .bd-tx'); if(ed){ ed.focus(); try{ var r=null, c=B.caret; B.caret=null;
          if(c&&document.caretRangeFromPoint){ r=document.caretRangeFromPoint(c.x,c.y); if(r&&!ed.contains(r.startContainer)) r=null; }
          if(!r){ r=document.createRange(); r.selectNodeContents(ed); r.collapse(false); } var sl=window.getSelection(); sl.removeAllRanges(); sl.addRange(r); }catch(e){} wireText(ed); } }
      box.querySelector(".bd-cap").textContent=o.cap(d);
      renderPages(); renderSide(); renderTray(); }
    function wireText(ed){ ed.addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Escape"){ e.preventDefault(); ed.blur(); } });
      ed.addEventListener("paste",function(e){ e.preventDefault(); var t=(e.clipboardData||window.clipboardData).getData("text/plain"); document.execCommand("insertText",false,t); });
      ed.addEventListener("input",function(){ var it=page().items[B.edit]; if(it){ it.text=ed.innerText.replace(/\n$/,""); o.save(doc()); } });
      ed.addEventListener("blur",function(){ B.edit=-1; push(); render(); }); }
    function renderZoomBar(stage, S){ if(!o.sections) return; var z=stage.querySelector(".bd-zbar"); if(!z){ z=document.createElement("div"); z.className="bd-zbar"; stage.appendChild(z); }
      z.innerHTML=B.view<0?'<span class="hint">⤢ ZOOM INTO A SECTION TO WORK ON IT UP CLOSE · DRAG ACROSS THE BOARD TO SELECT SEVERAL</span>'
        :'<button data-bd-zoom="-1">⤡ WHOLE BOARD <kbd>ESC</kbd></button><button data-bd-zstep="-1"'+(B.view<=0?' disabled':'')+'>‹</button><b>'+S[B.view].label+'</b><button data-bd-zstep="1"'+(B.view>=S.length-1?' disabled':'')+'>›</button>'; }
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
    function clPreview(c){ var bx={x:0,y:0,w:594,h:280}, r=c.slots(bx);
      return '<svg width="72" height="34" viewBox="0 0 594 280" aria-hidden="true"><rect width="594" height="280" class="pg"/>'+r.map(function(q){ return '<rect x="'+q.x.toFixed(0)+'" y="'+q.y.toFixed(0)+'" width="'+q.w.toFixed(0)+'" height="'+q.h.toFixed(0)+'"/>'; }).join("")+'</svg>'; }
    function swatch(c){ return '<i class="sw" style="background:'+c+'"></i>'; }
    function renderSide(){ var el=$(o.el).querySelector(".bd-side"), pg=page(), d=doc(), one=B.sel.length===1?pg.items[B.sel[0]]:null, h="";
      if(o.templates) h+='<button class="ws-gold bd-save" data-bd-act="save">✓ SAVE PAGE</button>';
      if(o.templates) h+='<div class="bd-sec"><span class="eb">PAGE TEMPLATES <i>ADDS A NEW PAGE</i></span><div class="bd-tmpls">'+o.templates.map(function(t,i){ return '<button data-bd-tmpl="'+i+'" title="'+cbEsc(t.tip||t.name)+'">'+tmplPreview(t)+'<span>'+t.name.toUpperCase()+'</span></button>'; }).join("")+'</div></div>';
      if(!o.sections) h+='<div class="bd-sec"><span class="eb">ARRANGE PHOTOS <i>THEN MOVE THINGS</i></span><div class="bd-tpls">'+o.layouts.map(function(t,i){ return '<button data-bd-tpl="'+i+'" title="'+cbEsc(t.tip||t.name)+'">'+tplPreview(t)+'<span>'+t.name.toUpperCase()+'</span></button>'; }).join("")+'</div></div>';
      if(o.bgs) h+='<div class="bd-sec"><span class="eb">PAGE COLOUR</span><div class="bd-chips">'+Object.keys(BD_BGS).map(function(b){ return '<button data-bd-bg="'+b+'" class="'+(bgOf(pg)===b?'on':'')+'" title="'+BD_BGS[b][0]+'">'+swatch(BD_BGS[b][1])+BD_BGS[b][0]+'</button>'; }).join("")+'</div></div>';
      if(o.clusters) h='<div class="bd-sec"><span class="eb">CLUSTERS <i>'+(B.view>=0?'ADDS TO THIS SECTION':'ADDS TO AN EMPTY SECTION')+'</i></span><div class="bd-cls">'+o.clusters.map(function(c,i){ return '<button data-bd-cl="'+i+'" title="'+cbEsc(c.name)+'">'+clPreview(c)+'<span>'+c.name.toUpperCase()+'</span></button>'; }).join("")+'</div></div>'+h;
      if(o.sections){ var ck=curSec(), S4=secs(), cq=ck?S4[secIdx(ck)]:null, sp=(page().splits||{});
        if(cq){ var stl=secStyle(ck), n4=secItems(ck).length;
          h='<div class="bd-sec"><span class="eb">'+cq.label+' <i>'+n4+' FRAME'+(n4===1?'':'S')+' · '+Math.round(((B.fill||{})[ck]||0)*100)+'% FILLED</i></span>'
            +'<div class="bd-chips">'+[["auto","BEST FIT"],["rows","ROWS"],["cols","COLUMNS"],["hero","HERO"]].map(function(x){ return '<button data-bd-style="'+x[0]+'" data-bd-key="'+ck+'" class="'+(stl===x[0]?'on':'')+'">'+x[1]+'</button>'; }).join("")+'</div>'
            +'<div class="bd-chips"><button data-bd-shuffle="'+ck+'" class="gold" title="A new random order and arrangement that still fills the section">⤮ SHUFFLE</button><button data-bd-bestorder="'+ck+'" title="Try every order and keep the one that fills the section most">⇄ BEST ORDER</button><button data-bd-clearsec="'+ck+'" class="del">EMPTY</button></div>'
            +'<p class="bd-none">Every section fills edge to edge, with no white space: photos crop a little to fit. Click SIZE in the middle of a photo to make it bigger. Drag one onto another to swap them. The same frame can go in more than once.</p></div>'+h; }
        else h='<div class="bd-sec"><span class="eb">SECTIONS</span><p class="bd-none">Each A1 panel is split into thirds that fill themselves edge to edge, like a finished folio board. You work on one third at a time: zoom into it with ⤢.</p></div>'+h; }
      var top=h; h="";   // whatever is selected goes first, so its controls are always in reach
      if(B.sel.length>1&&o.sections){ h+='<div class="bd-sec"><span class="eb">'+B.sel.length+' SELECTED</span><div class="bd-chips"><button data-bd-act="del" class="del">REMOVE FROM BOARD</button></div><p class="bd-none">Drag any of them to move the lot into another section.</p></div>'; }
      else if(B.sel.length>1){ var grouped=B.sel.every(function(k){ return pg.items[k].gid&&pg.items[k].gid===pg.items[B.sel[0]].gid; }), anyPh=B.sel.some(function(k){ return pg.items[k].t==="photo"; });
        h+='<div class="bd-sec"><span class="eb">'+B.sel.length+' SELECTED'+(grouped?' · GROUP':'')+'</span>'
          +'<div class="bd-sizes"><button data-bd-multi="down">− SMALLER</button><button data-bd-multi="up">+ BIGGER</button><button data-bd-multi="sh" title="Same height as the first one">SAME HEIGHT</button><button data-bd-multi="sw" title="Same width as the first one">SAME WIDTH</button></div>'
          +'<div class="bd-chips bd-align"><button data-bd-multi="a:l" title="Align left">⇤</button><button data-bd-multi="a:c" title="Centre">↔</button><button data-bd-multi="a:r" title="Align right">⇥</button><button data-bd-multi="a:t" title="Align top">⤒</button><button data-bd-multi="a:m" title="Middle">↕</button><button data-bd-multi="a:b" title="Align bottom">⤓</button><button data-bd-multi="dh" title="Space evenly across">⋯</button><button data-bd-multi="dv" title="Space evenly down">⋮</button></div>'
          +(anyPh&&o.filters?'<div class="bd-chips">'+Object.keys(BD_FILTERS).map(function(f){ return '<button data-bd-multi="f:'+f+'">'+BD_FILTERS[f][0]+'</button>'; }).join("")+'</div>':'')
          +'<div class="bd-chips">'+(grouped?'<button data-bd-multi="ungroup">UNGROUP</button>':'<button data-bd-multi="group">GROUP</button>')+'<button data-bd-act="dupitem">DUPLICATE</button><button data-bd-act="del" class="del">DELETE</button></div>'
          +'<p class="bd-none">Drag any of them to move the lot. Alt-click picks one out of a group.</p></div>'; }
      if(one){ h+='<div class="bd-sec"><span class="eb">SELECTED · '+cbEsc(name(one).toUpperCase())+'</span>';
        if(one.t==="photo"&&o.sections){ h+='<p class="bd-none">Click SIZE in its middle to make it bigger or smaller. Drag it onto another frame to swap them, or into another section.</p>'; }
        else if(one.t==="photo"){ h+='<div class="bd-sizes">'+o.sizes.map(function(w){ return '<button data-bd-w="'+w+'" class="'+(Math.round(one.w)===w?'on':'')+'">'+w+'</button>'; }).join("")+'<span>MM WIDE</span></div>';
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
    function renderTray(){ libRender($(o.el).querySelector(".bd-tray"), "board"); }
    // ---- editing ----
    function add(i, x, y, w){ var pg=page(), a=stAspect(i);
      var sl=B.sel.length===1&&pg.items[B.sel[0]]&&pg.items[B.sel[0]].t==="slot"?B.sel[0]:-1;   // a photo space is selected: fill it
      if(x==null&&sl>=0) return fillSlot(sl, i);
      if(o.sections){ var ck0=curSec(); if(!ck0){ toast("Zoom into a section first (⤢), then click frames to add them there."); return; } return intoSec(ck0, [i]); }
      w=w||o.defW; var it={id:bdUid(), t:"photo", pid:stId(i), w:w, x:0, y:0};
      it.x=Math.max(0,Math.min(o.W-w,(x==null?o.W/2:x)-w/2)); it.y=Math.max(0,Math.min(o.H-w/a,(y==null?o.H/2:y)-w/a/2)); pg.items.push(it); B.sel=[pg.items.length-1]; commit(); }
    function bdTop(b,a){ var r=bdFit(b,a); r.y=b.y; return r; }
    function fillSlot(k, i){ var pg=page(), sl=pg.items[k], r=bdTop({x:sl.x,y:sl.y,w:sl.w,h:sl.h}, stAspect(i));
      pg.items[k]={id:bdUid(), t:"photo", pid:stId(i), x:r.x, y:r.y, w:r.w, box:{x:sl.x,y:sl.y,w:sl.w,h:sl.h}, gid:sl.gid}; B.sel=[k]; commit(); }
    // several frames dropped on a cluster (or one of its spaces): fill its empty spaces in reading order
    function fillCluster(k, list){ var pg=page(), g=pg.items[k].gid, ks=g?gidSel(k):[k], empty=ks.filter(function(j){ return pg.items[j].t==="slot"; });
      empty.sort(function(a,b){ return a===k?-1:b===k?1:(Math.abs(pg.items[a].y-pg.items[b].y)>4?pg.items[a].y-pg.items[b].y:pg.items[a].x-pg.items[b].x); });
      var n=Math.min(empty.length, list.length);
      for(var q=0;q<n;q++){ var sl=pg.items[empty[q]], i=list[q], r=bdTop({x:sl.x,y:sl.y,w:sl.w,h:sl.h}, stAspect(i)); pg.items[empty[q]]={id:bdUid(), t:"photo", pid:stId(i), x:r.x, y:r.y, w:r.w, box:{x:sl.x,y:sl.y,w:sl.w,h:sl.h}, gid:sl.gid}; }
      B.sel=g?gidSel(k):[k]; commit(); toast(n?n+" frame"+(n===1?"":"s")+" placed"+(list.length>n?" · "+(list.length-n)+" didn't fit, the cluster is full":""):"That cluster is already full"); }
    // several frames dropped on open space: set them in justified rows inside the section (or a patch of page) under the pointer, as a group
    function placeMany(list, x, y){ var pg=page(), si=secAt(x,y), S=secs(), box;
      if(si>=0){ var q=S[si]; box={x:q.x+10, y:q.y+10, w:q.w-20, h:q.h-20}; }
      else { var w=o.W*0.5, h=o.H*0.45; box={x:Math.max(o.margin,Math.min(o.W-o.margin-w,x-w/2)), y:Math.max(o.margin,Math.min(o.H-o.margin-h,y-h/2)), w:w, h:h}; }
      var A=list.map(stAspect), r=bdRows(box, A, o.panelW?6:5), g=bdUid(), first=pg.items.length;
      list.forEach(function(i,k){ if(r[k]) pg.items.push({id:bdUid(), t:"photo", pid:stId(i), x:r[k].x, y:r[k].y, w:r[k].w, gid:g}); });
      B.sel=pg.items.map(function(_,j){ return j; }).slice(first); commit(); toast(list.length+" frames placed as a group. Alt-click one to move it on its own."); }
    // clusters: ready-made arrangements of photo spaces you drop into a section, then fill
    function addCluster(c){ var S=secs(), si=B.view;
      if(si<0&&B.sel.length){ var b0=bb(page().items[B.sel[0]]); si=secAt(b0.x+b0.w/2, b0.y+b0.h/2); }
      if(si<0){ var pg=page(); for(var i=0;i<S.length;i++){ var q=S[i]; if(!pg.items.some(function(it){ var b=bb(it), cx=b.x+b.w/2, cy=b.y+b.h/2; return cx>=q.x&&cx<q.x+q.w&&cy>=q.y&&cy<q.y+q.h; })){ si=i; break; } } }
      var q=si>=0?S[si]:{x:o.margin,y:o.margin,w:o.W-2*o.margin,h:o.H-2*o.margin}, box={x:q.x+10,y:q.y+10,w:q.w-20,h:q.h-20}, rects=c.slots(box), g=bdUid(), pg2=page(), first=pg2.items.length;
      rects.forEach(function(r){ pg2.items.push({id:bdUid(), t:"slot", x:r.x, y:r.y, w:r.w, h:r.h, label:"", gid:g}); });
      B.sel=pg2.items.map(function(_,j){ return j; }).slice(first); commit(); toast(c.name+" added"+(si>=0?" to "+S[si].label.toLowerCase():"")+". Drag frames, or a whole folder, onto it."); }
    // working on several at once
    function scaleSel(f){ var pg=page(), b=selBox(), cx=b.x+b.w/2, cy=b.y+b.h/2;
      B.sel.forEach(function(k){ var it=pg.items[k]; if(it.locked) return; delete it.box; it.x=cx+(it.x-cx)*f; it.y=cy+(it.y-cy)*f; if(it.t==="line"){ it.x2=cx+(it.x2-cx)*f; it.y2=cy+(it.y2-cy)*f; } else { it.w*=f; if(it.h) it.h*=f; } }); commit(); }
    function alignSel(m){ var pg=page(), b=selBox();
      B.sel.forEach(function(k){ var it=pg.items[k]; if(it.locked||it.t==="line") return; delete it.box; var ib=bb(it);
        if(m==="l") it.x=b.x; if(m==="c") it.x=b.x+(b.w-ib.w)/2; if(m==="r") it.x=b.x+b.w-ib.w; if(m==="t") it.y=b.y; if(m==="m") it.y=b.y+(b.h-ib.h)/2; if(m==="b") it.y=b.y+b.h-ib.h; }); commit(); }
    function distSel(ax){ var pg=page(), ks=B.sel.filter(function(k){ return pg.items[k].t!=="line"&&!pg.items[k].locked; }); if(ks.length<3) return toast("Select three or more to space them evenly");
      var b=selBox(ks), key=ax==="h"?"x":"y", dim=ax==="h"?"w":"h"; ks.sort(function(a,c){ return bb(pg.items[a])[key]-bb(pg.items[c])[key]; });
      var tot=ks.reduce(function(a,k){ return a+bb(pg.items[k])[dim]; },0), gap=(b[dim]-tot)/(ks.length-1), at=b[key];
      ks.forEach(function(k){ var it=pg.items[k]; delete it.box; it[key]=at; at+=bb(it)[dim]+gap; }); commit(); }
    function matchSel(m){ var pg=page(), ref=pg.items[B.sel[0]], rb=bb(ref);
      B.sel.forEach(function(k){ var it=pg.items[k]; if(it.locked||it.t==="line") return; delete it.box; if(it.t==="photo"){ it.w=m==="h"?rb.h*asp(it):rb.w; } else { if(m==="h") it.h=rb.h; else it.w=rb.w; } }); commit(); }
    var TEXT_ROLE={title:{size:30, font:"serif", h:0.08, ph:"Title"}, text:{size:16, font:"sans", h:0.22, ph:"Click to write"}, caption:{size:11, font:"type", h:0.06, ph:"Caption: settings, place, date"}};
    function addText(role){ role=role||"text"; var pg=page(), R=TEXT_ROLE[role], n=pg.items.length;
      pg.items.push({id:bdUid(), t:"text", role:role, x:o.margin+(n%4)*6, y:o.margin+(n%4)*6, w:o.W*(role==="title"?0.6:0.36), h:o.H*R.h, text:"", size:R.size, font:R.font, ph:R.ph});
      B.sel=[pg.items.length-1]; B.edit=pg.items.length-1; commit(); }
    function addLine(head){ var pg=page(); pg.items.push({id:bdUid(), t:"line", x:o.W*0.38, y:o.H*0.56, x2:o.W*0.56, y2:o.H*0.42, head:head, wt:head==="none"?0.7:1.4}); B.sel=[pg.items.length-1]; commit(); }
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
      var cur=page(), blank=!cur.items.length, pg={id:bdUid(), bg:r.bg||"white", items:items, tpl:t.id||null};
      if(blank) d.pages[d.cur]=pg; else { d.pages.splice(d.cur+1,0,pg); d.cur++; }
      B.sel=[]; B.edit=-1; commit(); toast(t.name+": click any text box to start writing."); }
    function delSel(){ var pg=page(); B.sel.sort(function(a,b){ return b-a; }).forEach(function(k){ if(!pg.items[k].locked) pg.items.splice(k,1); }); B.sel=[]; commit(); }
    function dupSel(){ var pg=page(), add_=[], gm={}; B.sel.forEach(function(k){ var c=JSON.parse(JSON.stringify(pg.items[k])); c.id=bdUid(); if(c.gid){ gm[c.gid]=gm[c.gid]||bdUid(); c.gid=gm[c.gid]; } delete c.box; c.x+=8; c.y+=8; if(c.t==="line"){ c.x2+=8; c.y2+=8; } c.locked=false; add_.push(c); });
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
      var szb=e.target.closest("[data-bd-size]"), szIt=szb?pg.items[+szb.getAttribute("data-bd-size")]:null;   // the size button: a click resizes, a drag still moves the photo
      if(B.edit>=0&&el&&+el.getAttribute("data-bd")===B.edit) return;   // typing in a text box
      if(!el){ if(e.target.closest("[data-bd-zoom]")) return; return marquee(e); }
      var k=+el.getAttribute("data-bd"), it=pg.items[k], wasSel=B.sel.length===1&&B.sel[0]===k;
      if(e.shiftKey||e.ctrlKey||e.metaKey){ var grp=e.altKey?[k]:gidSel(k), on=B.sel.indexOf(k)>=0; grp.forEach(function(q){ var j=B.sel.indexOf(q); if(on&&j>=0) B.sel.splice(j,1); else if(!on&&j<0) B.sel.push(q); }); render(); return; }
      if(B.sel.indexOf(k)<0) B.sel=e.altKey?[k]:gidSel(k);   // a cluster or placed group moves together; Alt picks one out
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
        if(moved&&o.sections&&mode==="move"){ var shr=$(o.el).querySelector(".bd-sheet").getBoundingClientRect(), px=(ev.clientX-shr.left)/s, py=(ev.clientY-shr.top)/s, si=secAt(px,py), S2=secs();
          if(si>=0){ var key=S2[si].key, movers=start.map(function(q){ return pg.items[q.k]; }).filter(function(m){ return m.t==="photo"; }), tgt=-1;
            pg.items.forEach(function(o2,j){ if(tgt<0&&o2.t==="photo"&&o2.sec===key&&movers.indexOf(o2)<0){ var b2=bb(o2); var sq=start.map(function(q){ return q.k; }); if(px>=b2.x&&px<=b2.x+b2.w&&py>=b2.y&&py<=b2.y+b2.h) tgt=j; } });
            var tObj=tgt>=0?pg.items[tgt]:null; movers.forEach(function(m){ pg.items.splice(pg.items.indexOf(m),1); m.sec=key; });
            var at=tObj?pg.items.indexOf(tObj):-1; if(at<0){ var ks=secItems(key); at=ks.length?ks[ks.length-1]+1:pg.items.length; }
            Array.prototype.splice.apply(pg.items,[at,0].concat(movers)); B.sel=movers.map(function(m){ return pg.items.indexOf(m); }); }
          commit(); return; }
        if(moved){ commit(); return; }
        if(szIt){ szIt.sz=szOf(szIt)%3+1; B.sel=[pg.items.indexOf(szIt)]; B.sizes=(B.sizes||0)+1; commit(); return; }
        if(it.t==="text"&&(wasSel||!String(it.text||"").trim())){ B.edit=k; B.sel=[k]; B.caret={x:ev.clientX, y:ev.clientY}; render(); } }   // click a text box to type in it
      window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); }
    // drag on empty page: a marquee that selects everything it touches
    function marquee(e){ var sh=$(o.el).querySelector(".bd-sheet"), r0=sh.getBoundingClientRect(), s=B.s, x0=(e.clientX-r0.left)/s, y0=(e.clientY-r0.top)/s, add_=e.shiftKey||e.ctrlKey||e.metaKey, base=add_?B.sel.slice():[], m=null, moved=false;
      if(B.edit>=0) return;
      function mv(ev){ var x1=(ev.clientX-r0.left)/s, y1=(ev.clientY-r0.top)/s; if(!moved&&Math.abs(x1-x0)+Math.abs(y1-y0)<4/s) return; moved=true;
        if(!m){ m=document.createElement("div"); m.className="bd-marq"; sh.appendChild(m); }
        var rx=Math.min(x0,x1), ry=Math.min(y0,y1), rw=Math.abs(x1-x0), rh=Math.abs(y1-y0); m.style.cssText="left:"+(rx*s)+"px;top:"+(ry*s)+"px;width:"+(rw*s)+"px;height:"+(rh*s)+"px";
        var pg=page(), hit=base.slice(); pg.items.forEach(function(it,k){ if(it.hidden||it.locked) return; var b=bb(it); if(b.x<rx+rw&&b.x+b.w>rx&&b.y<ry+rh&&b.y+b.h>ry&&hit.indexOf(k)<0) hit.push(k); });
        B.sel=hit; Array.prototype.forEach.call(sh.querySelectorAll("[data-bd]"),function(n){ n.classList.toggle("sel", hit.indexOf(+n.getAttribute("data-bd"))>=0); }); }
      function up(){ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); if(m) m.remove(); if(!moved&&!add_) B.sel=[]; render(); }
      window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); }
    function bind(){ if(B.bound) return; B.bound=true; var box=$(o.el), sh=box.querySelector(".bd-sheet");
      sh.addEventListener("pointerdown",down);
      sh.addEventListener("dblclick",function(e){ var el=e.target.closest("[data-bd]");
        if(!el&&o.sections){ var r=sh.getBoundingClientRect(), si=secAt((e.clientX-r.left)/B.s,(e.clientY-r.top)/B.s); zoom(B.view>=0?-1:si); return; }
        if(!el) return; var k=+el.getAttribute("data-bd"), it=page().items[k]; if(it&&it.t==="text"&&!it.locked&&B.edit!==k){ B.edit=k; B.sel=[k]; B.caret={x:e.clientX, y:e.clientY}; render(); } });
      sh.addEventListener("dragover",function(e){ e.preventDefault(); e.dataTransfer.dropEffect="copy"; sh.classList.add("drop");
        var t=e.target.closest&&e.target.closest(".bd-it.sl"); Array.prototype.forEach.call(sh.querySelectorAll(".bd-it.sl.hot"),function(n){ if(n!==t) n.classList.remove("hot"); }); if(t) t.classList.add("hot"); });
      sh.addEventListener("dragleave",function(){ sh.classList.remove("drop"); });
      sh.addEventListener("drop",function(e){ sh.classList.remove("drop"); var d=e.dataTransfer.getData("text/plain")||"", list=libParse(d); if(!list.length) return; e.preventDefault();
        var r=sh.getBoundingClientRect(), x=(e.clientX-r.left)/B.s, y=(e.clientY-r.top)/B.s, hit=e.target.closest&&e.target.closest("[data-bd]"), pg=page(), hk=hit?+hit.getAttribute("data-bd"):-1, hi=hk>=0?pg.items[hk]:null;
        if(hi&&hi.t==="slot") return list.length>1||d.indexOf("lib:")===0?fillCluster(hk,list):fillSlot(hk,list[0]);
        if(hi&&hi.gid&&(list.length>1||d.indexOf("lib:")===0)&&gidSel(hk).some(function(j){ return pg.items[j].t==="slot"; })) return fillCluster(hk,list);
        if(hi&&hi.t==="photo"&&hi.box&&list.length===1){ hi.pid=stId(list[0]); B.sel=[hk]; return commit(); }   // swap the frame in a cluster space
        if(o.sections){ var si=secAt(x,y), S3=secs(); if(si<0) return; return intoSec(S3[si].key, list, hi&&hi.t==="photo"&&hi.sec===S3[si].key?hk:-1); }
        if(list.length>1||d.indexOf("lib:")===0) return placeMany(list,x,y);
        add(list[0],x,y); });
      box.addEventListener("click",function(e){ var t=e.target.closest("[data-bd-pic],[data-bd-page],[data-bd-act],[data-bd-tpl],[data-bd-tmpl],[data-bd-ly],[data-bd-eye],[data-bd-lock],[data-bd-up],[data-bd-down],[data-bd-w],[data-bd-f],[data-bd-font],[data-bd-fs],[data-bd-al],[data-bd-paper],[data-bd-bg],[data-bd-ink],[data-bd-head],[data-bd-wt],[data-bd-fill],[data-bd-outline],[data-bd-bold],[data-bd-panels],[data-bd-zoom],[data-bd-zstep],[data-bd-cl],[data-bd-multi],[data-bd-split],[data-bd-style],[data-bd-bestorder],[data-bd-clearsec],[data-bd-shuffle]"); if(!t||t.disabled) return; act(t); }); }
    function act(t){ var pg=page(), d=doc(), one=B.sel.length===1?pg.items[B.sel[0]]:null, g=function(a){ return t.getAttribute(a); }, has=function(a){ return t.hasAttribute(a); };
      if(has("data-bd-pic")) return add(+g("data-bd-pic"));
      if(has("data-bd-zoom")) return zoom(+g("data-bd-zoom"));
      if(has("data-bd-zstep")) return zoom(Math.max(0,Math.min(secs().length-1,B.view+(+g("data-bd-zstep")))));
      if(has("data-bd-cl")) return addCluster(o.clusters[+g("data-bd-cl")]);
      if(has("data-bd-multi")){ var mm=g("data-bd-multi");
        if(mm==="up") return scaleSel(1.1); if(mm==="down") return scaleSel(1/1.1);
        if(mm==="sh"||mm==="sw") return matchSel(mm==="sh"?"h":"w");
        if(mm==="dh"||mm==="dv") return distSel(mm==="dh"?"h":"v");
        if(mm==="group"){ var ng=bdUid(); B.sel.forEach(function(k){ pg.items[k].gid=ng; }); toast("Grouped. They now move together."); return commit(); }
        if(mm==="ungroup"){ B.sel.forEach(function(k){ delete pg.items[k].gid; }); toast("Ungrouped"); return commit(); }
        if(mm.indexOf("f:")===0){ B.sel.forEach(function(k){ if(pg.items[k].t==="photo") pg.items[k].f=mm.slice(2); }); return commit(); }
        return alignSel(mm.slice(2)); }
      if(has("data-bd-page")){ d.cur=+g("data-bd-page"); B.sel=[]; o.save(d); return render(); }
      if(has("data-bd-tpl")) return o.sections?fillBoard(o.layouts[+g("data-bd-tpl")].style):applyLayout(o.layouts[+g("data-bd-tpl")]);
      if(has("data-bd-split")){ page().splits=page().splits||{}; page().splits[+g("data-bd-p")]=g("data-bd-split"); B.view=-1; pg.items.forEach(function(it){ if(it.sec&&it.sec.split(".")[0]===g("data-bd-p")) delete it.sec; }); return commit(); }
      if(has("data-bd-style")){ page().secStyle=page().secStyle||{}; page().secStyle[g("data-bd-key")]=g("data-bd-style"); if(o.sections&&typeof qFolioArranged==="function") qFolioArranged(parseInt(g("data-bd-key"),10)); return commit(); }
      if(has("data-bd-shuffle")) return shuffleSec(g("data-bd-shuffle"));
      if(has("data-bd-bestorder")){ bestOrderSec(g("data-bd-bestorder")); toast("Reordered for the fullest fit"); return commit(); }
      if(has("data-bd-clearsec")){ var ck=g("data-bd-clearsec"); pg.items=pg.items.filter(function(it){ return it.sec!==ck; }); B.sel=[]; return commit(); }
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
      if(a2==="save"){ o.save(doc()); B.saves=(B.saves||0)+1; toast(o.pageWord==="PAGE"?"Page saved. It's in your workbook.":"Saved"); return render(); }
      if(a2==="export") return o.exportFn(B); }
    function key(e){ var c=e.code, mod=e.ctrlKey||e.metaKey, pg=page();
      if(mod&&c==="KeyZ"){ e.preventDefault(); undo(e.shiftKey?1:-1); return true; }
      if(mod&&c==="KeyY"){ e.preventDefault(); undo(1); return true; }
      if(mod&&c==="KeyA"){ e.preventDefault(); B.sel=pg.items.map(function(_,k){ return k; }).filter(function(k){ return !pg.items[k].hidden; }); render(); return true; }
      if(mod&&c==="KeyD"){ e.preventDefault(); if(B.sel.length) dupSel(); return true; }
      if(c==="Escape"&&B.sel.length){ e.preventDefault(); B.sel=[]; render(); return true; }
      if(c==="Escape"&&B.view>=0){ e.preventDefault(); zoom(-1); return true; }
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
        if(it.t==="photo"){ var im=new Image(); im.onload=function(){ g.save(); g.filter=BD_FILTERS[it.f||"none"][1]; var cw=it.w, ch=hOf(it), ia=im.naturalWidth/im.naturalHeight, ca=cw/ch, sx=0, sy=0, sw=im.naturalWidth, sh2=im.naturalHeight;   // cropped to its cell, like the board shows it
            if(ia>ca){ sw=sh2*ca; sx=(im.naturalWidth-sw)/2; } else { sh2=sw/ca; sy=(im.naturalHeight-sh2)/2; }
            g.drawImage(im, sx, sy, sw, sh2, it.x*ppm, it.y*ppm, cw*ppm, ch*ppm); g.restore(); next(); }; im.onerror=next; im.src=src(it); return; }
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
    B.selected=function(){ return B.sel.slice(); }; B.secItems=function(k){ return secItems(k).map(function(j){ return page().items[j]; }); }; B.secStyle=secStyle; B.shuffles_=function(){ return B.shuffles||0; }; B.sizes_=function(){ return B.sizes||0; }; B.saves_=function(){ return B.saves||0; }; B.hOf=hOf; B.view_=function(){ return B.view; }; B.fill_=function(){ var o2={}; for(var k in (B.fill||{})) o2[k]=+B.fill[k].toFixed(3); return o2; };
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
  function wsA(x,y,x2,y2,head){ return {t:"line", x:x, y:y, x2:x2, y2:y2, head:head||"end", wt:1.2}; }
  var WS_TEMPLATES=[
    {id:"rank", name:"Rank", tip:"Your five picks ranked from 5 up to your best, and why each sits where it does", build:function(){ var it=[wsT(15,10,390,18,"title","Ranking my five: from 5 up to my best")];
      for(var k=0;k<5;k++){ var y=38+k*49.6, n=5-k;
        it.push(wsT(13,y+8,26,30,"title","",{text:String(n), size:30}));
        it.push(wsS(42,y,70,46.6,n===1?"Your best":"#"+n,true));
        it.push(wsT(120,y,285,46.6,"text",n===1?"Why is this your best? What does it do that the others don't?":n===5?"Why is this last of the five? What holds it back?":"Why does it sit at #"+n+"? What's stronger or weaker than the ones around it?",{rank:n})); }
      return {bg:"white", items:it}; }},
    {id:"compare", name:"Compare", tip:"Two photos side by side, a big arrow between them, and one sentence on the difference", build:function(){ return {bg:"white", items:[
      wsT(15,12,390,18,"title","Compare: what changed between these two?"),
      wsS(15,40,170,150,"Photo A",true), wsS(235,40,170,150,"Photo B",true),
      {t:"line", x:191, y:115, x2:229, y2:115, head:"end", wt:2.4},
      wsT(15,206,390,70,"text","In one sentence: what's the difference between A and B, and which works better?",{sentence:true, size:16})]}; }},
    {id:"annotate", name:"Annotate", tip:"One photo, with notes and arrows pointing into it", build:function(){ return {bg:"white", items:[
      wsT(15,12,390,18,"title","Title: what is this photo about?"),
      wsS(15,40,252,168,"Your strongest frame"),
      wsT(15,212,252,14,"caption","Lens · aperture · shutter · ISO · light"),
      wsT(15,232,252,50,"text","Why does this photo work? What would you change next time?"),
      wsT(290,40,115,62,"text","What leads your eye into the frame?"), wsA(288,62,232,86),
      wsT(290,110,115,62,"text","Where is the light coming from? What is it doing?"), wsA(288,132,200,128),
      wsT(290,180,115,62,"text","What's in focus, and what isn't? Why?"), wsA(288,202,150,170)]}; }},
    {id:"edit", name:"Before & after", tip:"Straight from the camera beside your edit, and what you changed", build:function(){ return {bg:"white", items:[
      wsT(15,12,390,18,"title","Editing: from the camera to the final image"),
      wsS(15,40,190,127,"Straight from the camera",true), wsS(215,40,190,127,"Your edit",true), wsA(196,104,224,104),
      wsT(15,171,190,14,"caption","Before"), wsT(215,171,190,14,"caption","After: the settings you changed"),
      wsT(15,194,390,88,"text","What did you change in Edit, and why?\n(exposure, highlights, shadows, contrast, colour, crop)\n\nHow does the edit change the mood?")]}; }},
    {id:"contact", name:"Contact sheet", tip:"A whole shoot, and what you chose from it", build:function(){ var it=[wsT(15,12,390,18,"title","Contact sheet: name the shoot")], cw=(258-12)/3, ch=cw/1.5;
      for(var r=0;r<3;r++) for(var c=0;c<3;c++) it.push(wsS(15+c*(cw+6),38+r*(ch+6),cw,ch,"Frame "+(r*3+c+1)));
      it.push(wsT(15,214,258,68,"text","Circle or star your strongest frames.\nWhat made them stand out from the rest?"));
      it.push(wsT(288,40,117,242,"text","Which frames are you taking forward?\n\nWhy did you reject the others?\n\nWhat pattern do you notice across the shoot?\n\nWhat will you reshoot, and how?"));
      return {bg:"white", items:it}; }},
    {id:"artist", name:"Artist model", tip:"A photographer's work beside your response to it", build:function(){ return {bg:"white", items:[
      wsT(15,12,390,18,"title","Artist model: name the photographer"),
      wsS(15,38,192,128,"Their work (upload it)",true), wsS(213,38,192,128,"Your response"),
      wsT(15,172,192,110,"text","Who are they, and what are they known for?\n\nWhich conventions do they use?\n(light, framing, subject, colour, time)"),
      wsT(213,172,192,110,"text","What did you take from them?\n\nWhat did you make your own, and why?"),
      wsA(201,102,219,102,"both")]}; }},
    {id:"experiment", name:"Experiment", tip:"Testing an idea or technique three ways, then reflecting", build:function(){ return {bg:"grey", items:[
      wsT(15,12,390,18,"title","Experiment: name the idea or technique",{font:"type"}),
      wsT(15,34,390,24,"text","What were you exploring? What sparked it (an artist, a quote, a technique)?",{font:"type"}),
      wsS(15,62,126,84,"Test 1"), wsS(147,62,126,84,"Test 2"), wsS(279,62,126,84,"Test 3"),
      wsT(15,150,126,24,"caption","What you tried, and the settings"), wsT(147,150,126,24,"caption","What you tried, and the settings"), wsT(279,150,126,24,"caption","What you tried, and the settings"),
      wsT(15,184,390,98,"text","What did you discover?\n\nWhich test is strongest, and why?\n\nWill you keep developing this idea? Why, or why not?",{font:"type"})]}; }},
    {id:"mood", name:"Mood & ideas", tip:"Planning a shoot: images, words and colours", build:function(){ return {bg:"charcoal", items:[
      wsT(15,12,260,20,"title","Ideas for my next shoot",{font:"type"}),
      wsS(15,40,160,107,"Image"), wsS(181,40,104,70,"Image"), wsS(181,116,104,70,"Image"), wsS(15,153,104,70,"Image"), wsS(125,153,50,70,"Detail"),
      wsT(300,40,105,146,"text","Words for the mood\n\nColours and light\n\nWhere, when, who?",{font:"type"}),
      wsT(15,232,390,50,"text","What do I want people to feel? Which photographers am I looking at?",{font:"type"})]}; }},
    {id:"next", name:"What's next?", tip:"Looking back at the board and planning ahead", build:function(){ return {bg:"charcoal", items:[
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
  // folio fills: how every section packs its frames (the previews show three panels in thirds)
  function foFill(style){ return function(W,H,A){ var P=Math.max(1,Math.round(W/594)), S=[], out=[], n=A.length;
      for(var p=0;p<P;p++) for(var r=0;r<3;r++) S.push({x:p*594+6, y:6+r*(H-20)/3+r*4, w:582, h:(H-20)/3});
      var per=S.map(function(){ return []; }); A.forEach(function(_,i){ per[Math.min(S.length-1,Math.floor(i*S.length/n))].push(i); });
      per.forEach(function(ix,si){ if(!ix.length) return; var r=bdPack(S[si], ix.map(function(i){ return A[i]; }), 4, style).r; ix.forEach(function(i,j){ out[i]=r[j]; }); }); return out; }; }
  var FO_LAYOUTS=[{name:"Best fit", style:"auto", tip:"Each section packed whichever way fills it most", place:foFill("auto")},
    {name:"Rows", style:"rows", tip:"Rows across every section", place:foFill("rows")},
    {name:"Columns", style:"cols", tip:"Columns down every section, good for portraits", place:foFill("cols")},
    {name:"Hero", style:"hero", tip:"One big frame leads each section", place:foFill("hero")}];
  // clusters: rows of 3:2 (or portrait) spaces sized to a section, or a hero with smaller frames beside it
  function clRows(rows, gap){ return function(b){ var hs=rows.map(function(r){ return (b.w-gap*(r.length-1))/r.reduce(function(a,x){ return a+x; },0); }), H=hs.reduce(function(a,x){ return a+x; },0), G=gap*(rows.length-1), k=Math.min(1,(b.h-G)/H), out=[], y=b.y+(b.h-(H*k+G))/2;
    rows.forEach(function(r,ri){ var h=hs[ri]*k, rw=r.reduce(function(a,x){ return a+x*h; },0)+gap*(r.length-1), x=b.x+(b.w-rw)/2; r.forEach(function(a){ out.push({x:x, y:y, w:a*h, h:h}); x+=a*h+gap; }); y+=h+gap; }); return out; }; }
  function clHero(cols, gap){ return function(b){ var H=Math.min(b.h,(b.w-gap*cols)/(1.5+cols*0.75)), h2=(H-gap)/2, w=1.5*H+gap+cols*1.5*h2+(cols-1)*gap, x=b.x+(b.w-w)/2, y=b.y+(b.h-H)/2, out=[{x:x,y:y,w:1.5*H,h:H}];
    for(var c=0;c<cols;c++) for(var r=0;r<2;r++) out.push({x:x+1.5*H+gap+c*(1.5*h2+gap), y:y+r*(h2+gap), w:1.5*h2, h:h2}); return out; }; }
  var FO_CLUSTERS=[
    {name:"Single", slots:clRows([[1.5]],5)}, {name:"Pair", slots:clRows([[1.5,1.5]],5)}, {name:"Trio", slots:clRows([[1.5,1.5,1.5]],5)},
    {name:"Portraits", slots:clRows([[0.667,0.667,0.667,0.667]],5)}, {name:"Hero + 2", slots:clHero(1,5)}, {name:"Hero + 4", slots:clHero(2,5)},
    {name:"Strip of 4", slots:clRows([[1.5,1.5,1.5,1.5]],4)}, {name:"2 × 2", slots:clRows([[1.5,1.5],[1.5,1.5]],5)}, {name:"Contact 3 × 3", slots:clRows([[1.5,1.5,1.5],[1.5,1.5,1.5],[1.5,1.5,1.5]],3)}];
  function bdDownload(blob, fname){ var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=fname; document.body.appendChild(a); a.click(); a.remove(); }
  var wsB=Board({el:"st-workshop", W:420, H:297, margin:15, defW:120, maxAuto:6, text:true, tools:true, filters:true, papers:null, bgs:true, pageWord:"PAGE", sizes:[60,90,120,180,260],
    emptyTitle:"Your page, your way.", emptyBody:"Start from a page template on the right, drag frames in from the left, or add text and arrows from the rail.",
    cap:function(d){ return "A3 LANDSCAPE · 420 × 297 MM · PAGE "+(d.cur+1)+" OF "+d.pages.length; },
    load:function(){ return st.wsBoard||null; }, save:function(d){ st.wsBoard=d; saveSession(); },
    layouts:WS_LAYOUTS, templates:WS_TEMPLATES, exportLabel:"EXPORT PAGES AS PDF",
    exportFn:function(B){ var d=B.doc_(), out=[], i=0; toast("Building your workbook PDF…"); (function next(){ if(i>=d.pages.length){ pbBuildPDF(out, namePrefix()+"workbook.pdf", "Workbook PDF downloaded"); return; } B.draw(d.pages[i++], 150/25.4, function(cv){ out.push(cv); next(); }); })(); }});
  var foB=Board({el:"st-folio", W:1782, H:841, panelW:594, sections:true, margin:FO_M, defW:180, maxAuto:18, text:false, filters:false, papers:["white","black"], pageWord:"LAYOUT", sizes:[100,150,200,280,400,560],
    emptyTitle:"Your folio board. No text.", emptyBody:"A1 panels side by side, read left to right. Drag frames or whole folders into the sections and they pack themselves edge to edge, or fill the whole board in one go. Every frame keeps its shape.",
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
