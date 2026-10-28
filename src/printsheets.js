  // ================= PRINT SHEETS: get folio frames onto paper for printing in Photoshop =================
  // A print mode over the folio board: everything else goes away, one A1 panel at a time on the left, the sheet big
  // in the middle, every sheet in a strip underneath. Photos keep their exact board size (in mm, as cropped on the
  // board). A whole third goes onto a landscape A2 exactly as laid out (a third is 594 mm wide, the width of A2), or
  // frames go onto A4/A3/A2 sheets: Aligned packs them upright with a trim gap, Custom lets you place and turn them
  // with snapping. Export builds one PDF at 300 ppi with crop marks, and marks the frames as printed.
  // Sheets and the printed marks live on the folio board (st.foBoard.print), so they're saved with the session.
  var PS_PAPER={A4:[210,297],A3:[297,420],A2:[420,594]}, PS_MARGIN=6, PS_GAP=5, PS_PW=594, PS_PH=841, PS_DPI=300;
  var ps={open:false, cur:0, panel:0, sel:{}, pick:null, showPrinted:false, bScale:1, pScale:1, drag:null};
  function psData(){ var d=foB.doc_(); if(!d.print) d.print={sheets:[psNew()], printed:{}}; if(!d.print.sheets.length) d.print.sheets.push(psNew()); return d.print; }
  var psHist=[], psHi=-1;
  function psSnapState(){ var d=psData(); return JSON.stringify({sheets:d.sheets, printed:d.printed}); }
  function psPush(){ var s=psSnapState(); if(psHist[psHi]===s) return; psHist=psHist.slice(0,psHi+1); psHist.push(s); if(psHist.length>80) psHist.shift(); psHi=psHist.length-1; }
  function psUndo(dir){ var j=psHi+dir; if(j<0||j>=psHist.length){ toast(dir<0?"Nothing to undo":"Nothing to redo"); return; } psHi=j; var o=JSON.parse(psHist[j]), d=psData(); d.sheets=o.sheets; d.printed=o.printed; ps.pick=null; ps.cur=Math.min(ps.cur,d.sheets.length-1); try{ st.foBoard=foB.doc_(); saveSession(); }catch(e){} psRender(); toast(dir<0?"Undo":"Redo"); }
  function psSave(){ psPush(); try{ st.foBoard=foB.doc_(); saveSession(); }catch(e){} }
  function psNew(from){ return {size:from?from.size:"A3", ori:from?from.ori:"portrait", mode:from&&from.mode!=="third"?from.mode:"aligned", items:[], done:false}; }
  function psSheets(){ return psData().sheets; }
  function psSheet(){ var S=psSheets(); ps.cur=Math.max(0,Math.min(S.length-1,ps.cur)); return S[ps.cur]; }
  // the folio's frames as print pieces: board id, photo, panel, third, size and place in mm
  function psFrames(){ var pg=foB.page(), out=[];
    pg.items.forEach(function(it,k){ if(it.t!=="photo"||it.hidden) return; var i=stById(it.pid); if(i<0) return;
      var h=(it.ch!=null&&it.sec)?it.ch:it.w/(stAspect(i)||1.5), p=Math.max(0,Math.min(2,Math.floor((it.x+it.w/2)/PS_PW))), r=it.sec?+String(it.sec).split(".")[1]:Math.floor((it.y+h/2)/(PS_PH/3));
      out.push({id:it.id||("k"+k), url:photos[i].url, pid:it.pid, f:it.f||"none", panel:p, third:r, x:it.x-p*PS_PW, y:it.y, w:+it.w.toFixed(1), h:+h.toFixed(1), n:"Frame "+(i+1)}); });
    return out; }
  var psF={}; function psFr(id){ return psF[id]; }
  function psRefreshFrames(){ psF={}; psFrames().forEach(function(f){ psF[f.id]=f; });
    psSheets().forEach(function(s){ s.items=s.items.filter(function(it){ return !!psF[it.fid]; }); }); }   /* frames taken off the board come off the sheets */
  function psDims(s){ var d=PS_PAPER[s.size]; return s.ori==="portrait"?[d[0],d[1]]:[d[1],d[0]]; }
  function psSz(it){ var f=psFr(it.fid); return it.rot?[f.h,f.w]:[f.w,f.h]; }
  function psClamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function psWhere(id){ var S=psSheets(); for(var i=0;i<S.length;i++) if(!S[i].done&&S[i].items.some(function(it){ return it.fid===id; })) return i; return -1; }   /* only sheets not yet exported: a printed frame can go on again for a reprint */
  function psThirdRect(t){ var h=(PS_PH-12-8)/3; return {y:6+t*(h+4)-3, h:h+6}; }   /* the board's 6 mm border and 4 mm gutters */

  // Aligned: shelf packing, upright, tallest first. Returns what didn't fit.
  function psPack(s){ var D=psDims(s), W=D[0]-2*PS_MARGIN, H=D[1]-2*PS_MARGIN, its=s.items.slice().sort(function(a,b){ return psSz(b)[1]-psSz(a)[1]||psSz(b)[0]-psSz(a)[0]; });
    var x=0,y=0,rowH=0, keep=[], over=[];
    its.forEach(function(it){ it.rot=0; var z=psSz(it); if(z[0]>W||z[1]>H){ over.push(it); return; }
      if(x>0&&x+z[0]>W){ x=0; y+=rowH+PS_GAP; rowH=0; }
      if(y+z[1]>H){ over.push(it); return; }
      it.x=PS_MARGIN+x; it.y=PS_MARGIN+y; x+=z[0]+PS_GAP; rowH=Math.max(rowH,z[1]); keep.push(it); });
    s.items=keep; return over; }
  function psFits(it,s){ var D=psDims(s), z=psSz(it); return z[0]<=D[0]-2*PS_MARGIN&&z[1]<=D[1]-2*PS_MARGIN; }
  function psBad(s,it){ if(s.mode==="third") return false; var D=psDims(s), z=psSz(it); if(it.x<PS_MARGIN-0.5||it.y<PS_MARGIN-0.5||it.x+z[0]>D[0]-PS_MARGIN+0.5||it.y+z[1]>D[1]-PS_MARGIN+0.5) return true;
    return s.items.some(function(o){ if(o===it) return false; var q=psSz(o); return it.x<o.x+q[0]+PS_GAP-0.5&&o.x<it.x+z[0]+PS_GAP-0.5&&it.y<o.y+q[1]+PS_GAP-0.5&&o.y<it.y+z[1]+PS_GAP-0.5; }); }
  function psBox(ids){ var x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; ids.forEach(function(id){ var f=psFr(id); x0=Math.min(x0,f.x); y0=Math.min(y0,f.y); x1=Math.max(x1,f.x+f.w); y1=Math.max(y1,f.y+f.h); }); return {x:x0,y:y0,w:x1-x0,h:y1-y0}; }
  // put frames on the current sheet; overflow rolls onto the following sheets
  function psAdd(ids, at){ var S=psSheets(); if(psSheet().mode==="third"||psSheet().done){ S.push(psNew(psSheet().done&&psSheet().mode!=="third"?psSheet():null)); ps.cur=S.length-1; at=null; }
    var s=psSheet(), big=[], dup=ids.filter(function(id){ return psWhere(id)>=0; }).length; ids=ids.filter(function(id){ return psWhere(id)<0; });
    if(!ids.length){ toast(dup>1?"Those frames are already on a sheet.":"That frame is already on a sheet."); return; }
    if(s.mode==="custom"){ var b=psBox(ids), D=psDims(s);
      ids.forEach(function(id){ var f=psFr(id), it={fid:id,rot:0,x:0,y:0}; if(!psFits(it,s)){ big.push(f.n); return; }
        it.x=psClamp(at?at[0]-b.w/2+(f.x-b.x):PS_MARGIN, 0, D[0]-f.w); it.y=psClamp(at?at[1]-b.h/2+(f.y-b.y):PS_MARGIN, 0, D[1]-f.h); s.items.push(it); }); }
    else { ids.forEach(function(id){ var it={fid:id,x:0,y:0,rot:0}; if(!psFits(it,s)){ big.push(psFr(id).n); return; } s.items.push(it); });
      var over=psPack(s), k=ps.cur, moved=0;
      while(over.length){ k++; if(!S[k]||S[k].mode!=="aligned") S.splice(k,0,psNew(s)); moved+=over.length; S[k].items=S[k].items.concat(over); over=psPack(S[k]); }
      if(moved) toast(moved+" frame"+(moved===1?"":"s")+" didn't fit, so "+(moved===1?"it went":"they went")+" onto the next sheet."); }
    if(big.length) toast(big.join(", ")+(big.length===1?" is":" are")+" too big for "+s.size+" "+s.ori+". Try a bigger sheet or turn the page.");
    ps.sel={}; psSave(); psRender(); }
  // a whole third on a landscape A2: same places and sizes as the board, edge to edge across the paper
  function psThird(k){ var ids=psFrames().filter(function(f){ return f.panel===ps.panel&&f.third===k; }).map(function(f){ return f.id; });
    if(!ids.length){ toast("That third is empty."); return; }
    var S=psSheets(), took=ids.some(function(id){ return psWhere(id)>=0; });
    S.forEach(function(sh){ if(sh.done) return; sh.items=sh.items.filter(function(it){ return ids.indexOf(it.fid)<0; }); if(sh.mode==="aligned") psPack(sh); });
    var R=psThirdRect(k), oy=(420-R.h)/2-R.y, t={size:"A2",ori:"landscape",mode:"third",panel:ps.panel,third:k,label:"Panel "+(ps.panel+1)+" · "+["top","middle","bottom"][k]+" third",items:[],done:false};
    ids.forEach(function(id){ var f=psFr(id); t.items.push({fid:id,x:f.x,y:f.y+oy,rot:0}); });
    var keep=S.filter(function(sh){ return sh.items.length||sh===S[ps.cur]&&sh.mode!=="third"; }); keep.push(t); psData().sheets=keep; ps.cur=keep.length-1; ps.pick=null; ps.sel={}; psSave(); psRender();
    toast("Panel "+(ps.panel+1)+", "+["top","middle","bottom"][k]+" third is on its own landscape A2, exactly as laid out."+(took?" Its frames came off the other sheets.":"")); }

  // ---- the print mode ----
  function psOpen(){ if(!foB||!foB.doc_) return; psRefreshFrames(); if(!psFrames().length){ toast("Put some photos on your folio board first."); return; }
    var u=$("psUI"); if(!u){ u=document.createElement("div"); u.id="psUI"; document.body.appendChild(u); u.innerHTML=psShell(); psWire(); }
    ps.open=true; u.classList.remove("hidden"); ps.sel={}; ps.pick=null; psHist=[]; psHi=-1; psPush(); requestAnimationFrame(psRender); }
  function psClose(){ ps.open=false; var u=$("psUI"); if(u) u.classList.add("hidden"); psSave(); }
  function psShell(){ return '<div class="ps-app">'
    +'<header class="ps-head"><button class="ps-btn" data-ps="back">‹ Back to the folio</button><h2>Print sheets</h2><span class="ps-sp"></span>'
    +'<button class="ps-btn" data-ps="printed" title="Show which frames have been exported">✓ Printed</button><button class="ps-btn go" data-ps="export">Export for print</button></header>'
    +'<section class="ps-boardcol"><div class="ps-seg" id="psPanels"></div><div class="ps-lbl"><span>A1 portrait · 594 × 841 mm</span><span id="psSelInfo"></span></div>'
    +'<div class="ps-boardwrap" id="psBoardWrap"><div id="psBoard"></div></div>'
    +'<p class="ps-hint">Drag one frame, or drag a box round several (or Ctrl-click) and drag them together. Double-click sends a frame to this sheet. Beside each third: the whole third on a landscape A2, or just its frames.</p></section>'
    +'<section class="ps-sheetcol"><div class="ps-tools" id="psTools"><div class="ps-seg" id="psSize"><button data-s="A4">A4</button><button data-s="A3">A3</button><button data-s="A2">A2</button></div>'
    +'<div class="ps-seg" id="psOri"><button data-o="portrait"><svg width="11" height="14" viewBox="0 0 11 14" fill="none" stroke="currentColor" stroke-width="1.4"><rect x=".7" y=".7" width="9.6" height="12.6" rx="1"/></svg>Portrait</button><button data-o="landscape"><svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" stroke-width="1.4"><rect x=".7" y=".7" width="12.6" height="9.6" rx="1"/></svg>Landscape</button></div>'
    +'<div class="ps-seg" id="psMode"><button data-m="aligned" title="Frames pack themselves, upright and lined up">Aligned</button><button data-m="custom" title="Place frames anywhere, with snapping. R turns one.">Custom</button></div>'
    +'<span class="ps-sp"></span><button class="ps-btn" data-ps="clear">Clear sheet</button></div>'
    +'<div class="ps-stage" id="psStage"><div id="psPaper"></div></div><div class="ps-readout" id="psReadout"></div></section>'
    +'<nav class="ps-strip" id="psStrip"></nav></div>'; }
  function psRender(){ if(!ps.open) return; psRefreshFrames(); psRenderBoard(); psRenderSheet(); psRenderStrip(); }
  function psBg(f){ return 'background-image:url('+f.url+');filter:'+(BD_FILTERS[f.f]?BD_FILTERS[f.f][1]:"none"); }
  function psRenderBoard(){ var wrap=$("psBoardWrap"), r=wrap.getBoundingClientRect(), s=Math.max(0.05,Math.min((r.width-104)/PS_PW, r.height/PS_PH)); ps.bScale=s;
    var b=$("psBoard"), dk=foB.doc_().paper==="black"; b.style.width=(PS_PW*s)+"px"; b.style.height=(PS_PH*s)+"px"; b.classList.toggle("showprinted",ps.showPrinted); b.classList.toggle("dark",dk);
    var pr=psData().printed, h="";
    for(var k=0;k<3;k++){ var R=psThirdRect(k); h+='<div class="ps-third" style="top:'+(R.y*s)+'px;height:'+(R.h*s)+'px"><div class="ps-thirdbtns"><button data-third="'+k+'" data-how="a2" title="The whole third, exactly as laid out, on a landscape A2">Third on A2</button><button data-third="'+k+'" data-how="add" title="Put this third\'s frames on the current sheet">Its frames</button></div></div>'; }
    psFrames().filter(function(f){ return f.panel===ps.panel; }).forEach(function(f){ var w=psWhere(f.id), p=pr[f.id];
      h+='<div class="ps-bp'+(ps.sel[f.id]?' sel':'')+(p?' printed':'')+'" data-bp="'+f.id+'" title="'+f.n+' · '+Math.round(f.w)+' × '+Math.round(f.h)+' mm" style="left:'+(f.x*s)+'px;top:'+(f.y*s)+'px;width:'+(f.w*s)+'px;height:'+(f.h*s)+'px"><i style="'+psBg(f)+'"></i>'
        +(p?'<span class="tick pr">✓ Printed</span>':w>=0?'<span class="tick">Sheet '+(w+1)+'</span>':'')+'</div>'; });
    b.innerHTML=h; var n=Object.keys(ps.sel).filter(function(k){ return ps.sel[k]; }).length; $("psSelInfo").textContent=n?n+" selected, drag them across":"Drag frames onto the sheet";
    $("psPanels").innerHTML=[0,1,2].map(function(p){ return '<button data-p="'+p+'"'+(p===ps.panel?' class="on"':'')+'>Panel '+(p+1)+'</button>'; }).join(""); }
  function psRenderSheet(){ var s=psSheet(), D=psDims(s), stg=$("psStage").getBoundingClientRect(), sc=Math.max(0.05,Math.min((stg.width-60)/D[0],(stg.height-60)/D[1])); ps.pScale=sc;
    var pp=$("psPaper"); pp.style.width=(D[0]*sc)+"px"; pp.style.height=(D[1]*sc)+"px";
    var h=s.mode==="third"?'':'<div class="ps-margin" style="inset:'+(PS_MARGIN*sc)+'px"></div>', used=0, bad=0;
    if(s.mode==="third"){ var R=psThirdRect(s.third), oy=(D[1]-R.h)/2; h+='<div class="ps-thirdbg'+(foB.doc_().paper==="black"?' dark':'')+'" style="top:'+(oy*sc)+'px;height:'+(R.h*sc)+'px"></div>'; }
    s.items.forEach(function(it,i){ var f=psFr(it.fid), z=psSz(it), isBad=psBad(s,it); used+=z[0]*z[1]; if(isBad) bad++;
      var inner=it.rot?'width:'+(f.w*sc)+'px;height:'+(f.h*sc)+'px;left:'+((z[0]-f.w)/2*sc)+'px;top:'+((z[1]-f.h)/2*sc)+'px;transform:rotate(90deg)':'inset:0';
      h+='<div class="ps-it'+(isBad?' bad':'')+(ps.pick===i?' pick':'')+'" data-si="'+i+'" style="left:'+(it.x*sc)+'px;top:'+(it.y*sc)+'px;width:'+(z[0]*sc)+'px;height:'+(z[1]*sc)+'px">'
        +'<i style="'+psBg(f)+';'+inner+'"></i>'+(s.mode==="third"?'':'<b class="cm tl"></b><b class="cm tr"></b><b class="cm bl"></b><b class="cm br"></b>')
        +'<span class="sz">'+f.n+' · '+Math.round(z[0])+' × '+Math.round(z[1])+' mm'+(it.rot?' · turned':'')+'</span></div>'; });
    pp.innerHTML=h; var pct=Math.round(used/(D[0]*D[1])*100);
    $("psReadout").innerHTML='<span>Sheet <b>'+(ps.cur+1)+'</b> of '+psSheets().length+'</span><span><b>'+s.size+'</b> '+s.ori+' · '+D[0]+' × '+D[1]+' mm</span><span>'+s.items.length+' frame'+(s.items.length===1?'':'s')+'</span><span><span class="ps-meter"><i style="width:'+pct+'%"></i></span> '+pct+'% of the paper used</span>'
      +(bad?'<span class="warn">'+bad+' frame'+(bad===1?' overlaps or sits':'s overlap or sit')+' off the safe area</span>':'')
      +(s.mode==="third"?'<span>'+s.label+' · edge to edge, as on the board. Drag to tweak, R turns one</span>':s.mode==="custom"?'<span>Drag to place · R turns the picked frame · Delete takes it off</span>':'<span>Packs itself upright · drag a frame off the paper to take it off</span>');
    ["psSize","psOri","psMode"].forEach(function(g){ Array.prototype.forEach.call($(g).children,function(b){ var v=b.dataset.s||b.dataset.o||b.dataset.m; b.classList.toggle("on",v===s.size||v===s.ori||v===s.mode); }); }); }
  function psRenderStrip(){ var S=psSheets();
    $("psStrip").innerHTML=S.map(function(s,i){ var D=psDims(s), k=56/Math.max(D[0],D[1]);
      return '<button class="ps-st'+(i===ps.cur?' cur':'')+'" data-st="'+i+'"><span class="pg" style="width:'+(D[0]*k)+'px;height:'+(D[1]*k)+'px">'
        +s.items.map(function(it){ var z=psSz(it), f=psFr(it.fid); return '<i style="left:'+(it.x*k)+'px;top:'+(it.y*k)+'px;width:'+(z[0]*k)+'px;height:'+(z[1]*k)+'px;background-image:url('+f.url+')"></i>'; }).join("")
        +(s.done?'<span class="done">✓</span>':'')+(S.length>1?'<span class="x" data-del="'+i+'" title="Remove this sheet">×</span>':'')+'</span>Sheet '+(i+1)+' · '+s.size+(s.mode==="third"?' third':'')+'</button>'; }).join("")
      +'<button class="ps-btn" data-ps="add">+ New sheet</button>'; }

  // ---- export: a layered PSD per sheet at 300 ppi, true size: paper, each frame its own layer, crop marks on top ----
  function psExport(){ var S=psSheets().filter(function(s){ return s.items.length&&!s.done; }), bad=0; S.forEach(function(s){ s.items.forEach(function(it){ if(psBad(s,it)) bad++; }); });
    if(!S.length){ toast(psSheets().some(function(s){ return s.done; })?"Every sheet is already exported. Add frames to a new sheet to print more.":"Put some frames on a sheet first."); return; }
    if(bad){ toast("Fix the frames outlined in red first: they overlap or sit outside the safe area."); return; }
    if(!window.agPsd){ toast("Couldn't load the Photoshop exporter."); return; }
    var ppm=PS_DPI/25.4, si=0, dk=foB.doc_().paper==="black"; toast("Building "+S.length+" Photoshop file"+(S.length===1?"":"s")+" at "+PS_DPI+" ppi…");
    (function nextSheet(){ if(si>=S.length){ var pr=psData().printed, now=Date.now(); S.forEach(function(s){ s.done=true; s.items.forEach(function(it){ pr[it.fid]=now; }); }); psSave(); psRender();
        toast("Saved "+S.length+" PSD"+(S.length===1?"":"s")+". Open in Photoshop: each frame is its own layer, at true size."); return; }
      var s=S[si++], num=psSheets().indexOf(s)+1, D=psDims(s), W=Math.round(D[0]*ppm), H=Math.round(D[1]*ppm), comp=psCanvas(W,H), cg=comp.getContext("2d"), layers=[];
      cg.fillStyle="#ffffff"; cg.fillRect(0,0,W,H); var paper=psCanvas(W,H), pgx=paper.getContext("2d"); pgx.fillStyle="#ffffff"; pgx.fillRect(0,0,W,H); layers.push({name:"Paper", canvas:paper});
      var j=0; (function nextIt(){ if(j>=s.items.length){ if(s.mode!=="third"){ var mk=psCanvas(W,H), mg=mk.getContext("2d"); s.items.forEach(function(it){ var z=psSz(it); psMarks(mg,it.x*ppm,it.y*ppm,z[0]*ppm,z[1]*ppm,ppm); }); cg.drawImage(mk,0,0); layers.push({name:"Crop marks", canvas:mk}); }
          var buf; try{ buf=agPsd.writePsd({width:W, height:H, children:layers, canvas:comp, imageResources:{resolutionInfo:{horizontalResolution:PS_DPI, horizontalResolutionUnit:"PPI", widthUnit:"Centimeters", verticalResolution:PS_DPI, verticalResolutionUnit:"PPI", heightUnit:"Centimeters"}}}, {generateThumbnail:false}); }
          catch(er){ console.warn("psd:",er); toast("Couldn't build sheet "+num+" as a PSD."); nextSheet(); return; }
          var url=URL.createObjectURL(new Blob([buf],{type:"image/vnd.adobe.photoshop"})), a=document.createElement("a"); a.href=url; a.download=namePrefix()+"folio-print-sheet-"+num+"-"+s.size+"-"+s.ori+".psd"; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} },8000); setTimeout(nextSheet,400); return; }
        var it=s.items[j++], f=psFr(it.fid), z=psSz(it), im=new Image();
        im.onload=function(){ var cw=f.w, ch=f.h, ia=im.naturalWidth/im.naturalHeight, ca=cw/ch, sx=0, sy=0, sw=im.naturalWidth, sh=im.naturalHeight;   /* cropped to its frame, like the board shows it */
          if(ia>ca){ sw=sh*ca; sx=(im.naturalWidth-sw)/2; } else { sh=sw/ca; sy=(im.naturalHeight-sh)/2; }
          var lw=Math.max(1,Math.round(z[0]*ppm)), lh=Math.max(1,Math.round(z[1]*ppm)), lc=psCanvas(lw,lh), g=lc.getContext("2d");
          g.filter=BD_FILTERS[f.f]?BD_FILTERS[f.f][1]:"none"; g.translate(lw/2,lh/2); if(it.rot) g.rotate(Math.PI/2); g.drawImage(im,sx,sy,sw,sh,-cw/2*ppm,-ch/2*ppm,cw*ppm,ch*ppm);
          var lx=Math.round(it.x*ppm), ly=Math.round(it.y*ppm); cg.drawImage(lc,lx,ly); layers.push({name:f.n+" · "+Math.round(z[0])+" × "+Math.round(z[1])+" mm", left:lx, top:ly, canvas:lc}); nextIt(); };
        im.onerror=nextIt; im.src=f.url; })(); })(); }
  function psCanvas(w,h){ var c=document.createElement("canvas"); c.width=w; c.height=h; return c; }
  function psMarks(g,x,y,w,h,ppm){ var o=1*ppm, L=4*ppm; g.save(); g.strokeStyle="#000"; g.lineWidth=Math.max(1,0.2*ppm); g.beginPath();
    [[x,y,-1,-1],[x+w,y,1,-1],[x,y+h,-1,1],[x+w,y+h,1,1]].forEach(function(c){ g.moveTo(c[0]+c[2]*o,c[1]); g.lineTo(c[0]+c[2]*(o+L),c[1]); g.moveTo(c[0],c[1]+c[3]*o); g.lineTo(c[0],c[1]+c[3]*(o+L)); });
    g.stroke(); g.restore(); }

  // ---- wiring ----
  function psOverPaper(e,pad){ var r=$("psPaper").getBoundingClientRect(); pad=pad||0; return e.clientX>r.left-pad&&e.clientX<r.right+pad&&e.clientY>r.top-pad&&e.clientY<r.bottom+pad; }
  function psSet(k,v){ var s=psSheet(); s[k]=v; ps.pick=null; if(k==="mode") delete s.label;
    if(s.mode==="aligned"){ var over=psPack(s); if(over.length){ var S=psSheets(), t=S[ps.cur+1]&&S[ps.cur+1].mode==="aligned"?S[ps.cur+1]:null; if(!t){ t=psNew(s); S.splice(ps.cur+1,0,t); } t.items=t.items.concat(over); psPack(t); toast(over.length+" frame"+(over.length===1?"":"s")+" moved to sheet "+(ps.cur+2)+" to fit."); } }
    else { var D=psDims(s); s.items.forEach(function(it){ var z=psSz(it); it.x=psClamp(it.x,0,D[0]-z[0]); it.y=psClamp(it.y,0,D[1]-z[1]); }); }
    psSave(); psRender(); }
  function psSnap(s,it,x,y,z,D){ var T=6/ps.pScale+1, xs=[PS_MARGIN,D[0]-PS_MARGIN-z[0],D[0]/2-z[0]/2], ys=[PS_MARGIN,D[1]-PS_MARGIN-z[1],D[1]/2-z[1]/2], gx=[PS_MARGIN,D[0]-PS_MARGIN,D[0]/2], gy=[PS_MARGIN,D[1]-PS_MARGIN,D[1]/2];
    s.items.forEach(function(o){ if(o===it) return; var q=psSz(o); xs.push(o.x,o.x+q[0]-z[0],o.x+q[0]+PS_GAP,o.x-PS_GAP-z[0]); ys.push(o.y,o.y+q[1]-z[1],o.y+q[1]+PS_GAP,o.y-PS_GAP-z[1]); gx.push(o.x,o.x+q[0],o.x+q[0]+PS_GAP,o.x-PS_GAP); gy.push(o.y,o.y+q[1],o.y+q[1]+PS_GAP,o.y-PS_GAP); });
    var g=[], bx=null, by=null; xs.forEach(function(v){ if(Math.abs(v-x)<T&&(bx===null||Math.abs(v-x)<Math.abs(bx-x))) bx=v; }); ys.forEach(function(v){ if(Math.abs(v-y)<T&&(by===null||Math.abs(v-y)<Math.abs(by-y))) by=v; });
    if(bx!==null){ x=bx; [x,x+z[0],x+z[0]/2].forEach(function(v){ if(gx.some(function(q){ return Math.abs(q-v)<0.5; })) g.push(["v",v]); }); }
    if(by!==null){ y=by; [y,y+z[1],y+z[1]/2].forEach(function(v){ if(gy.some(function(q){ return Math.abs(q-v)<0.5; })) g.push(["h",v]); }); }
    return {x:x,y:y,g:g}; }
  function psGuides(g){ Array.prototype.forEach.call(document.querySelectorAll("#psPaper .ps-guide"),function(e){ e.remove(); }); var pp=$("psPaper");
    (g||[]).forEach(function(q){ var d=document.createElement("i"); d.className="ps-guide"; if(q[0]==="v"){ d.style.left=(q[1]*ps.pScale)+"px"; d.style.top=0; d.style.bottom=0; d.style.width="1px"; } else { d.style.top=(q[1]*ps.pScale)+"px"; d.style.left=0; d.style.right=0; d.style.height="1px"; } pp.appendChild(d); }); }
  function psWire(){ var u=$("psUI");
    u.addEventListener("click",function(e){ var a=e.target.closest("[data-ps]"), t;
      if(a){ var w=a.getAttribute("data-ps");
        if(w==="back") psClose(); else if(w==="export") psExport(); else if(w==="clear"){ psSheet().items=[]; ps.pick=null; psSave(); psRender(); }
        else if(w==="add"){ psSheets().push(psNew(psSheet())); ps.cur=psSheets().length-1; ps.pick=null; psSave(); psRender(); }
        else if(w==="printed"){ ps.showPrinted=!ps.showPrinted; a.classList.toggle("on",ps.showPrinted); a.textContent=ps.showPrinted?"✓ Showing printed":"✓ Printed"; psRenderBoard();
          if(ps.showPrinted){ var all=psFrames(), pr=psData().printed, n=all.filter(function(f){ return pr[f.id]; }).length; toast(n?n+" of "+all.length+" frames printed. Green is printed, faded ones aren't yet.":"Nothing exported yet."); } }
        return; }
      if((t=e.target.closest("[data-del]"))){ e.stopPropagation(); psSheets().splice(+t.dataset.del,1); ps.cur=Math.min(ps.cur,psSheets().length-1); ps.pick=null; psSave(); psRender(); return; }
      if((t=e.target.closest("[data-st]"))){ ps.cur=+t.dataset.st; ps.pick=null; psRender(); return; }
      if((t=e.target.closest("[data-p]"))){ ps.panel=+t.dataset.p; ps.sel={}; psRenderBoard(); return; }
      if((t=e.target.closest("[data-third]"))){ var k=+t.dataset.third; if(t.dataset.how==="a2") psThird(k); else psAdd(psFrames().filter(function(f){ return f.panel===ps.panel&&f.third===k; }).map(function(f){ return f.id; })); return; }
      if((t=e.target.closest("#psSize button"))) psSet("size",t.dataset.s); else if((t=e.target.closest("#psOri button"))) psSet("ori",t.dataset.o);
      else if((t=e.target.closest("#psMode button"))){ if(t.dataset.m==="custom"&&psSheet().mode==="aligned") toast("Custom: drag frames anywhere. They snap to the edges, the middle and each other. R turns one."); psSet("mode",t.dataset.m); } });
    var bd=$("psBoard");
    bd.addEventListener("dblclick",function(e){ var b=e.target.closest("[data-bp]"); if(b) psAdd([b.dataset.bp]); });
    bd.addEventListener("pointerdown",function(e){ if(e.button!==0||e.target.closest(".ps-thirdbtns")) return; var b=e.target.closest("[data-bp]"), r=bd.getBoundingClientRect();
      if(b){ var id=b.dataset.bp; if(e.ctrlKey||e.metaKey||e.shiftKey){ ps.sel[id]=!ps.sel[id]; psRenderBoard(); return; } if(!ps.sel[id]){ ps.sel={}; ps.sel[id]=true; psRenderBoard(); }
        ps.drag={kind:"board", sx:e.clientX, sy:e.clientY, ids:Object.keys(ps.sel).filter(function(k){ return ps.sel[k]; }), started:false}; }
      else { ps.drag={kind:"marq", x0:e.clientX-r.left, y0:e.clientY-r.top, hit:{}}; if(!(e.ctrlKey||e.metaKey)) ps.sel={}; var m=document.createElement("div"); m.className="ps-marq"; bd.appendChild(m); ps.drag.m=m; }
      e.preventDefault(); });
    $("psPaper").addEventListener("pointerdown",function(e){ if(e.button!==0) return; var s=psSheet(), el=e.target.closest("[data-si]");
      if(!el){ ps.pick=null; psRenderSheet(); return; } var i=+el.dataset.si, it=s.items[i]; ps.pick=i; el.classList.add("pick");
      ps.drag={kind:"sheet", i:i, sx:e.clientX, sy:e.clientY, ox:it.x, oy:it.y, moved:false, el:el}; e.preventDefault(); });
    document.addEventListener("pointermove",function(e){ var d=ps.drag; if(!d||!ps.open) return;
      if(d.kind==="marq"){ var r=bd.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, L=Math.min(x,d.x0), T=Math.min(y,d.y0), W=Math.abs(x-d.x0), H=Math.abs(y-d.y0), s=ps.bScale;
        d.m.style.left=L+"px"; d.m.style.top=T+"px"; d.m.style.width=W+"px"; d.m.style.height=H+"px";
        psFrames().filter(function(f){ return f.panel===ps.panel; }).forEach(function(f){ var hit=f.x*s<L+W&&(f.x+f.w)*s>L&&f.y*s<T+H&&(f.y+f.h)*s>T; d.hit[f.id]=hit; var el=bd.querySelector('[data-bp="'+f.id+'"]'); if(el) el.classList.toggle("sel",hit||!!ps.sel[f.id]); }); return; }
      if(d.kind==="board"){ if(!d.started&&Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<5) return;
        if(!d.started){ d.started=true; var bb=psBox(d.ids), sc=ps.pScale; d.bb=bb; var g=document.createElement("div"); g.className="ps-ghost"; g.style.width=(bb.w*sc)+"px"; g.style.height=(bb.h*sc)+"px";
          g.innerHTML=d.ids.map(function(id){ var f=psFr(id); return '<i style="left:'+((f.x-bb.x)*sc)+'px;top:'+((f.y-bb.y)*sc)+'px;width:'+(f.w*sc)+'px;height:'+(f.h*sc)+'px;'+psBg(f)+'"></i>'; }).join(""); document.body.appendChild(g); d.g=g; }
        d.g.style.left=(e.clientX-d.bb.w*ps.pScale/2)+"px"; d.g.style.top=(e.clientY-d.bb.h*ps.pScale/2)+"px"; $("psPaper").classList.toggle("drop",psOverPaper(e)); return; }
      if(d.kind==="sheet"){ var s2=psSheet(), it=s2.items[d.i]; if(!it) return; var D=psDims(s2), z=psSz(it);
        if(!d.moved&&Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<4) return; d.moved=true;
        var nx=d.ox+(e.clientX-d.sx)/ps.pScale, ny=d.oy+(e.clientY-d.sy)/ps.pScale;
        if(s2.mode!=="aligned"){ var sn=psSnap(s2,it,nx,ny,z,D); nx=sn.x; ny=sn.y; psGuides(sn.g); }
        it.x=nx; it.y=ny; d.el.style.left=(nx*ps.pScale)+"px"; d.el.style.top=(ny*ps.pScale)+"px"; d.el.classList.toggle("bad",psBad(s2,it)); d.el.style.opacity=psOverPaper(e,40)?"1":".4"; } });
    document.addEventListener("pointerup",function(e){ var d=ps.drag; if(!d) return; ps.drag=null; $("psPaper").classList.remove("drop"); psGuides([]);
      if(d.kind==="marq"){ d.m.remove(); for(var k in d.hit) if(d.hit[k]) ps.sel[k]=true; psRenderBoard(); return; }
      if(d.kind==="board"){ if(d.g) d.g.remove(); if(d.started&&psOverPaper(e)){ var r=$("psPaper").getBoundingClientRect(); psAdd(d.ids,[(e.clientX-r.left)/ps.pScale,(e.clientY-r.top)/ps.pScale]); } return; }
      if(d.kind==="sheet"){ var s=psSheet(); if(d.moved&&!psOverPaper(e,40)){ var it=s.items[d.i]; s.items.splice(d.i,1); ps.pick=null; if(s.mode==="aligned") psPack(s); toast((psFr(it.fid)||{n:"That frame"}).n+" taken off the sheet."); }
        else if(d.moved&&s.mode==="aligned") psPack(s); psSave(); psRender(); } });
    window.addEventListener("keydown",function(e){ if(!ps.open) return; var tg=e.target&&e.target.tagName; if(tg==="INPUT"||tg==="TEXTAREA") return;
      if(e.key==="Escape"){ e.preventDefault(); e.stopImmediatePropagation(); if(ps.pick!=null){ ps.pick=null; psRenderSheet(); } else psClose(); return; }
      e.stopImmediatePropagation(); var mod=e.ctrlKey||e.metaKey;
      if(mod&&(e.key==="z"||e.key==="Z")){ e.preventDefault(); psUndo(e.shiftKey?1:-1); return; } if(mod&&(e.key==="y"||e.key==="Y")){ e.preventDefault(); psUndo(1); return; }
      var s=psSheet(); if(ps.pick==null||!s.items[ps.pick]) return; var it=s.items[ps.pick];
      if((e.key==="r"||e.key==="R")&&s.mode!=="aligned"){ it.rot=it.rot?0:1; var D=psDims(s), z=psSz(it); it.x=psClamp(it.x,0,D[0]-z[0]); it.y=psClamp(it.y,0,D[1]-z[1]); psSave(); psRenderSheet(); psRenderStrip(); }
      if(e.key==="Delete"||e.key==="Backspace"){ e.preventDefault(); var n=psFr(it.fid).n; s.items.splice(ps.pick,1); ps.pick=null; if(s.mode==="aligned") psPack(s); psSave(); psRender(); toast(n+" taken off the sheet."); } },true);
    var rz; window.addEventListener("resize",function(){ if(!ps.open) return; clearTimeout(rz); rz=setTimeout(psRender,80); }); }
  /* the way in: the board redraws its side panel often, so the Print sheets button is put back whenever it does.
     It's the main (gold) way to print; the board's own PDF export stays as a quiet quick export underneath. */
  function psEnsureBtn(){ var ex=document.querySelector("#st-folio .bd-side .bd-export:not(.ps-go)"); if(!ex||ex.previousElementSibling&&ex.previousElementSibling.id==="psGo") return;
    var old=document.getElementById("psGo"); if(old) old.remove(); var b=document.createElement("button"); b.id="psGo"; b.className="ws-gold ps-go"; b.innerHTML="Print sheets <span>for Photoshop</span>"; b.onclick=psOpen; ex.parentNode.insertBefore(b,ex);
    ex.classList.add("ps-quick"); if(!/Quick/.test(ex.textContent)) ex.textContent="Quick PDF of the panels (not for printing)"; }
  /* swaps and re-packs on the folio slide frames to their new places, so a swap is easy to see (only after a drop, never mid-drag) */
  var psFlip={rects:{}, w:0, up:0, down:false};
  document.addEventListener("pointerdown",function(){ psFlip.down=true; },true); document.addEventListener("pointerup",function(){ psFlip.down=false; psFlip.up=performance.now(); },true);
  function psFlipRun(){ var sh=document.querySelector("#st-folio .bd-sheet"); if(!sh||typeof foB==="undefined") return; var sr=sh.getBoundingClientRect(), pg=foB.page(), now={}, anim=!psFlip.down&&performance.now()-psFlip.up<700&&Math.abs(sr.width-psFlip.w)<1;
    Array.prototype.forEach.call(sh.querySelectorAll(".bd-it.ph[data-bd]"),function(el){ var it=pg.items[+el.getAttribute("data-bd")]; if(!it||!it.id) return; var r=el.getBoundingClientRect(), q={x:r.left-sr.left,y:r.top-sr.top,w:r.width,h:r.height}; now[it.id]=q;
      var o=psFlip.rects[it.id]; if(!anim||!o||el._flip) return; var dx=o.x-q.x, dy=o.y-q.y; if(Math.abs(dx)+Math.abs(dy)<4) return;
      el._flip=1; el.style.transition="none"; el.style.transformOrigin="0 0"; el.style.transform="translate("+dx+"px,"+dy+"px) scale("+(o.w/Math.max(1,q.w))+","+(o.h/Math.max(1,q.h))+")"; el.style.zIndex=50;
      requestAnimationFrame(function(){ el.style.transition="transform .32s cubic-bezier(.2,.75,.2,1)"; el.style.transform="none"; setTimeout(function(){ el.style.transition=""; el.style.zIndex=""; el._flip=0; },360); }); });
    psFlip.rects=now; psFlip.w=sr.width; }
  (function psHook(){ var room=document.getElementById("st-folio"); if(!room||typeof MutationObserver==="undefined") return; var q=false;
    new MutationObserver(function(){ if(q) return; q=true; requestAnimationFrame(function(){ q=false; psEnsureBtn(); psFlipRun(); }); }).observe(room,{childList:true,subtree:true}); })();
  if(/[?&]dev/.test(location.search)) window.__ps={ seed:function(n){ var pg=foB.page(); for(var i=0;i<n&&i<photos.length;i++) pg.items.push({id:bdUid(),t:"photo",pid:stId(i),sec:"0.0",x:20,y:20,w:180}); st.foBoard=foB.doc_(); foB.render(); }, open:psOpen, close:psClose, state:function(){ return {open:ps.open, sheets:psSheets().map(function(s){ return {size:s.size,ori:s.ori,mode:s.mode,n:s.items.length}; }), frames:psFrames().length, printed:Object.keys(psData().printed).length}; }, third:psThird, add:psAdd, frames:psFrames, exp:psExport };
