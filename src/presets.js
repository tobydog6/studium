  // ================= PRESETS: save the edit you're on as a named look, kept in folders =================
  // A fold-out drawer from a slim rail beside the develop panel. A preset is every develop setting except the crop,
  // the heal spots and the panel toggles. Hover a preset to see it on the photo, click to apply it (Ctrl+Z undoes it),
  // and with more frames selected in the strip it goes on all of them. Right-click to rename, move or delete.
  // Presets are kept in localStorage and in the session (saveSession), so they travel with the student's save.
  var PR_SKIP=["heals","secLight","secColor","secEffects","secMix","secGrade","secDetail","secFilm","secGmap","secCurve"];
  var PR_STARTER=[];   /* no starter looks: students build their own */
  var PR={v:1, folders:[{id:"mine",name:"My looks",open:true}], items:[]};
  var prRenderLater=false, prOpen=false, prHover=null, prKeep=null, prThumbs={}, prThumbQ=[], prThumbBusy=false, prThumbSrc=null, prThumbFor=-1, prMenuEl=null, prAppliedN=0, prSavedN=0;
  function prId(){ return "p"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
  function prStarters(){ return PR_STARTER.map(function(s){ return {id:s[0],name:s[1],folder:"studium",fixed:true,set:s[2]}; }); }
  function prAll(){ return prStarters().concat(PR.items); }
  function prFind(id){ return prAll().filter(function(p){ return p.id===id; })[0]; }
  function prFolder(id){ return PR.folders.filter(function(f){ return f.id===id; })[0]; }
  // what a preset holds: every develop setting but the crop, the spots and the panel toggles
  function prCapture(E){ var o={}; for(var k in EDEF){ if(DEV_CROP.indexOf(k)>=0||PR_SKIP.indexOf(k)>=0) continue; var v=E[k]; o[k]=(v&&typeof v==="object")?JSON.parse(JSON.stringify(v)):v; } return o; }
  // put a preset on an edit: a full look replaces the settings, a starter is laid over the defaults
  function prOnto(E,p){ var o=devClone(E), k, base=p.fixed?prCapture(EDEF):{}, s=p.set||{};
    for(k in base) o[k]=(base[k]&&typeof base[k]==="object")?JSON.parse(JSON.stringify(base[k])):base[k];
    for(k in s){ if(DEV_CROP.indexOf(k)>=0||PR_SKIP.indexOf(k)>=0) continue; o[k]=(s[k]&&typeof s[k]==="object")?JSON.parse(JSON.stringify(s[k])):s[k]; } return o; }
  function prSave(){ try{ localStorage.setItem("studium_presets_v1",JSON.stringify({v:1,folders:PR.folders,items:PR.items})); }catch(e){} if(typeof saveSession==="function") saveSession(); }
  function prLoad(d){ if(!d||!d.items) return; var f=(d.folders||[]).filter(function(x){ return x&&x.id; });
    f=f.filter(function(x){ return x.id!=="studium"; });   /* older saves had a Studium starter folder */
    PR.folders.forEach(function(x){ if(!x.fixed&&!f.some(function(y){ return y.id===x.id; })) f.push(x); });   /* folders only this browser has are kept */
    PR.folders=f;
    PR.items=d.items.filter(function(p){ return p&&p.id&&p.set&&!/^st-/.test(p.id); }).concat(PR.items.filter(function(p){ return !d.items.some(function(q){ return q.id===p.id; }); }));
    PR.items.forEach(function(p){ if(!prFolder(p.folder)) p.folder=prMine(); }); }
  function prMine(){ var f=PR.folders.filter(function(x){ return !x.fixed; })[0]; if(!f){ f={id:"mine",name:"My looks",open:true}; PR.folders.push(f); } return f.id; }
  function prData(){ return {v:1,folders:PR.folders.map(function(f){ return {id:f.id,name:f.name,open:f.open}; }),items:PR.items}; }   /* for sessionData */
  try{ var _pr=JSON.parse(localStorage.getItem("studium_presets_v1")||"null"); if(_pr) prLoad(_pr); }catch(e){}

  // ---- the drawer ----
  function prEsc(s){ return String(s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function prSelN(){ var n=0, cur=devOpenIdx(); for(var k in devSel) if(devSel[k]&&+k!==cur) n++; return n; }
  function prRender(){ var el=$("prList"); if(!el) return; if(el.querySelector(".pr-ren")){ prRenderLater=true; return; } var h="";   /* never rebuild under a rename in progress */
    PR.folders.forEach(function(f){ var its=prAll().filter(function(p){ return p.folder===f.id; });
      h+='<div class="pr-fold'+(f.open?' open':'')+'" data-pr-fold="'+f.id+'"><button class="pr-fh" data-pr-ft="'+f.id+'"><span class="pr-chev">›</span><span class="pr-fn">'+prEsc(f.name)+'</span><small>'+its.length+'</small></button>'
        +'<div class="pr-grid">'+(its.length?its.map(function(p){ var t=prThumbs[prTkey(p)];
          return '<button class="pr-it" data-pr="'+p.id+'" title="'+prEsc(p.name)+'"><span class="pr-th"'+(t?' style="background-image:url('+t+')"':'')+'></span><span class="pr-nm">'+prEsc(p.name)+'</span></button>'; }).join("")
        :'<p class="pr-empty">'+(PR.items.length?'Right-click a preset to move it here, or save a new one into this folder.':'Nothing here yet. Edit a photo until you love it, then press + to save that look.')+'</p>')+'</div></div>'; });
    el.innerHTML=h; var n=prSelN(), sb=$("prSel"); if(sb){ sb.textContent=n?"Click a preset to put it on this photo and "+n+" more selected":""; sb.classList.toggle("on",!!n); }
    prThumbsQueue(); }
  function prToggle(on){ prOpen=on==null?!prOpen:!!on; var d=$("prDrawer"), b=$("prRailBtn"); if(d) d.classList.toggle("open",prOpen); if(b) b.classList.toggle("on",prOpen); if(editor) editor.classList.toggle("pr-on",prOpen); prMenuClose(); prSaveClose();
    if(prOpen){ prPlace(); prThumbFor=-1; prRender(); } else prPreviewEnd(); }

  // ---- thumbnails: this photo with each preset, small, one at a time so real renders aren't held up ----
  function prTkey(p){ return devOpenIdx()+"|"+p.id+"|"+JSON.stringify(p.set); }
  function prThumbsQueue(){ if(!prOpen||!edState||!edRC) return; var cur=devOpenIdx();
    if(prThumbFor!==cur||!prThumbSrc){ prThumbFor=cur; prThumbSrc=null; prThumbs={}; var cr=cropRect(), W=220, H=Math.max(2,Math.round(W*cr.h/cr.w)), c=document.createElement("canvas"); c.width=W; c.height=H;
      c.getContext("2d").drawImage(edRC0||edRC,cr.x,cr.y,cr.w,cr.h,0,0,W,H); var img=new Image(); img.onload=function(){ if(prThumbFor===cur){ prThumbSrc=img; prThumbsQueue(); } }; img.src=c.toDataURL("image/jpeg",0.85); return; }
    prThumbQ=prAll().filter(function(p){ return !prThumbs[prTkey(p)]; }); prThumbNext(); }
  function prThumbNext(){ if(prThumbBusy||!prThumbQ.length||!prThumbSrc||!prOpen) return; var p=prThumbQ.shift(), key=prTkey(p), cur=prThumbFor;
    var E=prOnto(defEd(cur),p); E.aspect="free"; E.zoom=1; E.cx=0.5; E.cy=0.5; E.rot=0; E.heals=[]; prThumbBusy=true;
    crBake(prThumbSrc,E,function(url){ prThumbBusy=false; if(url&&cur===prThumbFor){ prThumbs[key]=url; var b=document.querySelector('#prList [data-pr="'+p.id+'"] .pr-th'); if(b) b.style.backgroundImage="url("+url+")"; } prThumbNext(); }); }

  // ---- hover: see the preset on the photo; leaving puts your edit back ----
  function prPreview(id){ var p=prFind(id); if(!p||!edState) return; if(!prKeep) prKeep=edState; prHover=id; edState=prOnto(prKeep,p); edState.i=prKeep.i; queueRender(); }
  function prPreviewEnd(){ if(!prKeep) return; edState=prKeep; prKeep=null; prHover=null; queueRender(); }
  // ---- apply: this frame (undo works), and every other frame selected in the strip ----
  function prApply(id){ var p=prFind(id); if(!p) return; prPreviewEnd(); if(!edState) return;
    var keepI=edState.i, out=prOnto(edState,p); out.i=keepI; edState=out; syncEditUI(); queueRender(); edPushHist(); setTimeout(drawHist,140); prAppliedN++;
    var q=[], cur=devOpenIdx(); for(var k in devSel) if(devSel[k]&&+k!==cur) q.push(+k);
    if(q.length){ devCommit(); q.forEach(function(i){ var ph=photos[i]; if(!ph) return; var E=prOnto(ph.dev?devClone(ph.dev):defEd(i),p);
        if(devIsDefault(E)){ if(ph.orig){ ph.url=ph.orig; delete ph.orig; delete ph.dev; delete ph.baked; ph.edited=false; devChanged(ph); } return; }
        if(!ph.orig) ph.orig=ph.url; ph.dev=devClone(E); ph.edited=true; devSyncN++; devQueue(i); });
      toast("“"+p.name+"” on this photo and "+q.length+" more"); devStrip(); }
    else toast("“"+p.name+"” applied. Ctrl+Z undoes it."); }

  // ---- save the edit you're on ----
  function prSaveOpen(){ prMenuClose(); var bx=$("prSaveBox"); if(!bx||!edState) return; var sel=$("prSaveFold");
    sel.innerHTML=PR.folders.filter(function(f){ return !f.fixed; }).map(function(f){ return '<option value="'+f.id+'">'+prEsc(f.name)+'</option>'; }).join("")+'<option value="__new">New folder…</option>';
    sel.value=prLastFold&&prFolder(prLastFold)?prLastFold:prMine(); $("prNewFold").classList.add("hidden");
    var nm=$("prSaveName"); nm.value=""; nm.placeholder="My look "+(PR.items.length+1); bx.classList.remove("hidden"); setTimeout(function(){ nm.focus(); },30); }
  var prLastFold=null;
  function prSaveClose(){ var bx=$("prSaveBox"); if(bx) bx.classList.add("hidden"); }
  function prSaveDo(){ if(!edState) return; var nm=($("prSaveName").value||$("prSaveName").placeholder).trim().slice(0,40), fid=$("prSaveFold").value;
    if(fid==="__new"){ var fn=($("prNewFold").value||"").trim().slice(0,30); if(!fn){ $("prNewFold").focus(); return; } fid=prAddFolder(fn); }
    var src=prKeep||edState; PR.items.push({id:prId(),name:nm,folder:fid,set:prCapture(src)}); prLastFold=fid; var f=prFolder(fid); if(f) f.open=true; prSavedN++;
    prSave(); prSaveClose(); prRender(); toast("Saved “"+nm+"” in "+(f?f.name:"your presets")); }
  function prAddFolder(name){ var f={id:"f"+prId(),name:name,open:true}; PR.folders.push(f); prSave(); return f.id; }

  // ---- right-click: rename, move, delete ----
  function prMenuClose(){ if(prMenuEl){ prMenuEl.remove(); prMenuEl=null; } }
  function prMenu(e,kind,id){ e.preventDefault(); prMenuClose(); prPreviewEnd(); var m=document.createElement("div"); m.className="pr-menu"; var h="";
    if(kind==="preset"){ var p=prFind(id); if(!p) return;
      if(p.fixed) h='<div class="pr-mh">'+prEsc(p.name)+'</div><button data-pm="dup">Save a copy to change</button>';
      else h='<div class="pr-mh">'+prEsc(p.name)+'</div><button data-pm="rename">Rename</button><button data-pm="update">Update with this edit</button><div class="pr-msep"></div><div class="pr-mh sm">Move to</div>'
        +PR.folders.filter(function(f){ return !f.fixed; }).map(function(f){ return '<button data-pm="move" data-pf="'+f.id+'"'+(f.id===p.folder?' class="cur"':'')+'>'+prEsc(f.name)+'</button>'; }).join("")
        +'<button data-pm="movenew">New folder…</button><div class="pr-msep"></div><button data-pm="del" class="danger">Delete</button>'; }
    else { var f=prFolder(id); if(!f||f.fixed) return; h='<div class="pr-mh">'+prEsc(f.name)+'</div><button data-pm="frename">Rename folder</button><button data-pm="fdel" class="danger">Delete folder</button>'; }
    m.innerHTML=h; document.body.appendChild(m); var r=m.getBoundingClientRect(), x=Math.min(e.clientX,innerWidth-r.width-8), y=Math.min(e.clientY,innerHeight-r.height-8); m.style.left=x+"px"; m.style.top=y+"px"; prMenuEl=m;
    m.addEventListener("click",function(ev){ var b=ev.target.closest("[data-pm]"); if(!b) return; var a=b.getAttribute("data-pm"); prMenuClose(); prMenuAct(a,kind,id,b.getAttribute("data-pf")); }); }
  function prInline(sel,val,cb){ var el=document.querySelector(sel); if(!el){ return; } var inp=document.createElement("input"); inp.className="pr-ren"; inp.value=val; inp.maxLength=40;
    /* an input inside a button: Space would press the button, so the button becomes a plain block while you type */
    var btn=el.closest("button"); if(btn){ var blk=document.createElement("div"); blk.className=btn.className+" renaming"; blk.innerHTML=btn.innerHTML; btn.replaceWith(blk); el=blk.querySelector("."+el.className.split(" ")[0]); }
    el.replaceWith(inp); inp.focus(); inp.select(); var done=false, fin=function(ok){ if(done) return; done=true; var v=inp.value.trim(); if(ok&&v) cb(v); inp.remove(); prRenderLater=false; prRender(); };
    inp.addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Enter") fin(true); else if(e.key==="Escape") fin(false); }); inp.addEventListener("blur",function(){ fin(true); }); inp.addEventListener("click",function(e){ e.stopPropagation(); }); }
  function prNameFolder(id){ var f=prFolder(id); if(!f) return; var el=document.querySelector('#prList [data-pr-fold="'+id+'"]'); if(el&&el.scrollIntoView) el.scrollIntoView({block:"nearest"});
    prInline('#prList [data-pr-fold="'+id+'"] .pr-fn',f.name,function(v){ f.name=v.slice(0,30); prSave(); }); }
  /* the drawer sits over the right of the photo, between the top bar and the filmstrip */
  function prPlace(){ var d=$("prDrawer"), stg=$("editStage"), dock=d&&d.parentNode; if(!d||!stg||!dock) return; var a=stg.getBoundingClientRect(), b=dock.getBoundingClientRect();
    /* a floating window over the top right of the photo, down to about the Exposure slider; it sits left of the next-photo arrow (CSS) */
    var top=a.top+12, ex=$("pExposure"), er=ex?ex.closest(".lr-row").getBoundingClientRect():null, bot=er&&er.height?er.bottom+8:a.top+a.height*0.5;
    bot=Math.max(bot,top+260);
    d.style.top=(top-b.top)+"px"; d.style.height=(bot-top)+"px"; d.style.bottom="auto"; }
  function prMenuAct(a,kind,id,fid){ var p=kind==="preset"?prFind(id):null, f=kind==="folder"?prFolder(id):null;
    if(a==="dup"&&p){ PR.items.push({id:prId(),name:p.name+" copy",folder:prMine(),set:prCapture(prOnto(defEd(0),p))}); prFolder(prMine()).open=true; prSave(); prRender(); toast("Copied into "+prFolder(prMine()).name+". Right-click it to rename or update."); }
    else if(a==="rename"&&p) prInline('#prList [data-pr="'+id+'"] .pr-nm',p.name,function(v){ p.name=v; prSave(); });
    else if(a==="update"&&p&&edState){ p.set=prCapture(edState); prSave(); prRender(); toast("“"+p.name+"” now holds this edit"); }
    else if(a==="move"&&p&&fid){ p.folder=fid; prFolder(fid).open=true; prSave(); prRender(); }
    else if(a==="movenew"&&p){ p.folder=prAddFolder("New folder"); prSave(); prRender(); prNameFolder(p.folder); }
    else if(a==="del"&&p){ PR.items=PR.items.filter(function(x){ return x.id!==id; }); prSave(); prRender(); toast("Deleted “"+p.name+"”"); }
    else if(a==="frename"&&f) prInline('#prList [data-pr-fold="'+id+'"] .pr-fn',f.name,function(v){ f.name=v.slice(0,30); prSave(); });
    else if(a==="fdel"&&f){ var its=PR.items.filter(function(x){ return x.folder===id; });
      if(its.length&&!confirm("Delete “"+f.name+"” and the "+its.length+" preset"+(its.length===1?"":"s")+" in it?")) return;
      PR.items=PR.items.filter(function(x){ return x.folder!==id; }); PR.folders=PR.folders.filter(function(x){ return x.id!==id; }); prMine(); prSave(); prRender(); } }

  (function prWire(){ var b, list=$("prList");
    if((b=$("prRailBtn"))) b.onclick=function(){ prToggle(); };
    if((b=$("prClose"))) b.onclick=function(){ prToggle(false); };
    if((b=$("prAdd"))) b.onclick=prSaveOpen;
    if((b=$("prAddFold"))) b.onclick=function(){ var id=prAddFolder("New folder"); prRender(); prNameFolder(id); };
    if((b=$("prSaveGo"))) b.onclick=prSaveDo;
    if((b=$("prSaveCancel"))) b.onclick=prSaveClose;
    if((b=$("prSaveFold"))) b.addEventListener("change",function(){ var nf=$("prNewFold"); nf.classList.toggle("hidden",this.value!=="__new"); if(this.value==="__new") nf.focus(); });
    ["prSaveName","prNewFold"].forEach(function(id){ var i=$(id); if(i) i.addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Enter") prSaveDo(); else if(e.key==="Escape") prSaveClose(); }); });
    if(!list) return;
    list.addEventListener("click",function(e){ var ft=e.target.closest("[data-pr-ft]"); if(ft){ var f=prFolder(ft.getAttribute("data-pr-ft")); if(f){ f.open=!f.open; prSave(); ft.parentNode.classList.toggle("open",f.open); } return; }
      var it=e.target.closest("[data-pr]"); if(it) prApply(it.getAttribute("data-pr")); });
    list.addEventListener("mouseover",function(e){ var it=e.target.closest("[data-pr]"); if(it&&it.getAttribute("data-pr")!==prHover) prPreview(it.getAttribute("data-pr")); });
    list.addEventListener("mouseleave",prPreviewEnd);
    list.addEventListener("mouseout",function(e){ var it=e.target.closest("[data-pr]"); if(it&&!it.contains(e.relatedTarget)&&!(e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest("[data-pr]"))) prPreviewEnd(); });
    list.addEventListener("contextmenu",function(e){ var it=e.target.closest("[data-pr]"); if(it){ prMenu(e,"preset",it.getAttribute("data-pr")); return; } var fh=e.target.closest("[data-pr-ft]"); if(fh) prMenu(e,"folder",fh.getAttribute("data-pr-ft")); });
    document.addEventListener("pointerdown",function(e){ if(prMenuEl&&!prMenuEl.contains(e.target)) prMenuClose(); },true);
    window.addEventListener("keydown",function(e){ if(prKeep) prPreviewEnd(); if(e.key!=="Escape"||!editor||editor.classList.contains("hidden")) return;
      if(typeof edCrop!=="undefined"&&edCrop) return;   /* Escape still cancels a crop */
      var bx=$("prSaveBox"), handled=true; if(prMenuEl) prMenuClose(); else if(document.querySelector("#prList .pr-ren")) handled=false; else if(bx&&!bx.classList.contains("hidden")) prSaveClose(); else if(prOpen) prToggle(false); else handled=false;
      if(handled){ e.preventDefault(); e.stopImmediatePropagation(); } },true);   /* Escape closes the menu, the save box, then the drawer: never the editor behind it */
    /* a new frame, a new filmstrip selection: fresh thumbnails and the selection line */
    var _ds=devStrip; devStrip=function(){ _ds.apply(this,arguments); if(prOpen) prRender(); };
    window.addEventListener("resize",function(){ if(prOpen) prPlace(); });
    var _ce=closeEditor; closeEditor=function(){ prPreviewEnd(); prMenuClose(); _ce.apply(this,arguments); }; })();
  if(/[?&]dev/.test(location.search)) window.__pr={ state:function(){ return {open:prOpen,items:PR.items.length,folders:PR.folders.length,applied:prAppliedN,saved:prSavedN,hover:prHover,hist:[edHistI,edHist.length],keep:!!prKeep}; }, apply:prApply, toggle:prToggle, data:prData };
