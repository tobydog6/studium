  // ================= DEVELOP: edits live on the frame, move between frames, copy / paste / sync =================
  // Like Lightroom: an edit is a set of settings kept on the photo. Leaving a frame renders it, and the rendered
  // frame is what every room shows (the original stays underneath, so reopening carries on from the same sliders).
  // The filmstrip moves between frames (← →, or click). Ctrl/Cmd-click or Shift-click selects more frames, and
  // SYNC puts this frame's settings (not its crop) on all of them. Copy and paste settings with Ctrl+C / Ctrl+V.
  var DEV_CROP=["aspect","zoom","cx","cy","rot","cropRatio"], DEV_VIEW=["secLight","secColor","secEffects","secMix","secGrade"], devClip=null, devSel={}, devAnchor=-1, devBusy=false, devScope=null;   // devScope: just one library folder's frames, when edited as a group
  function devList(){ return devScope&&devScope.length?devScope.filter(function(i){ return i<photos.length; }):photos.map(function(_,i){ return i; }); }
  function devClone(E){ var o={}; for(var k in EDEF) o[k]=E[k]==null?EDEF[k]:E[k]; return o; }   // older edits get today's defaults for newer controls
  function devIsDefault(E){ for(var k in EDEF){ if(DEV_VIEW.indexOf(k)>=0) continue; if(E[k]!==EDEF[k]) return false; } return true; }
  function devSettings(E){ var o={}; for(var k in EDEF){ if(DEV_CROP.indexOf(k)<0) o[k]=E[k]; } return o; }
  // Rendering at full size runs in background workers (crdev.js): the frame keeps its settings at once and its
  // picture updates a moment later. p.baked records which settings the current picture was made with.
  var devTok=typeof WeakMap!=="undefined"?new WeakMap():null, devPendingN=0, devSyncN=0;
  function devPending(){ return devPendingN; }
  function devQueue(i){ var p=photos[i]; if(!p||!p.dev||!p.orig) return; var key=JSON.stringify(p.dev); if(devTok) devTok.set(p,key); devPendingN++;
    var img=new Image(); img.onload=function(){ crBake(img,p.dev,function(url){ devPendingN--;
        if(url&&(!devTok||devTok.get(p)===key)&&p.dev&&JSON.stringify(p.dev)===key){ p.url=url; p.baked=key; p.edited=true; devChanged(p); devAfterBake(); } else if(!devPendingN) devAfterBake(); }); };
    img.onerror=function(){ devPendingN--; }; img.src=p.orig; }
  function devAfterBake(){ if(editor&&!editor.classList.contains("hidden")) devStrip();
    if(typeof st!=="undefined"&&st.open&&st.room==="select"&&typeof stRenderSelect==="function"&&!(editor&&!editor.classList.contains("hidden"))) stRenderSelect();
    if(!devPendingN&&devSyncN){ toast("Synced "+devSyncN+" frame"+(devSyncN===1?"":"s")); devSyncN=0; } }
  function devResume(){ photos.forEach(function(p,i){ if(p.dev&&p.orig&&p.baked!==JSON.stringify(p.dev)) devQueue(i); }); }
  function devChanged(p){ if(p.id&&typeof hubThumbs!=="undefined") delete hubThumbs[p.id]; saveSession(); }
  // write the open frame's edit into the photo
  function devCommit(){ if(!edState||!edRC) return; var p=photos[edState.i]; if(!p) return;
    if(devIsDefault(edState)){ if(p.orig){ p.url=p.orig; delete p.orig; delete p.dev; delete p.baked; p.edited=false; devChanged(p); } return; }
    var d=devClone(edState); if(p.dev&&p.orig&&JSON.stringify(p.dev)===JSON.stringify(d)) return;
    if(!p.orig) p.orig=p.url; p.dev=d; p.edited=true; devChanged(p); devQueue(edState.i); }
  function devOpenIdx(){ return edState?edState.i:-1; }
  function devGo(to){ if(devBusy||to<0||to>=photos.length||to===devOpenIdx()) return; devCommit(); if(typeof st!=="undefined"&&st.open) st.cur=to; openEditor(to); }
  function devStep(d){ devSel={}; var L=devList(), j=L.indexOf(devOpenIdx()); if(j<0){ devGo(L[0]); return; } var to=L[j+d]; if(to!=null) devGo(to); }
  function devStrip(){ var f=$("dvFilm"); if(!f) return; var cur=devOpenIdx(); devSel[cur]=true;
    var L=devList(); f.innerHTML=L.map(function(i){ var p=photos[i], th=typeof hubThumb==="function"?hubThumb(i):p.url;
      return '<button class="dv-fr'+(i===cur?' cur':'')+(devSel[i]&&i!==cur?' sel':'')+'" data-dv="'+i+'" title="Frame '+(i+1)+'"><img src="'+th+'" alt="Frame '+(i+1)+'" draggable="false">'
        +(p.dev?'<i class="ed" title="Edited">●</i>':'')+(p.pick?'<i class="pk"></i>':'')+'<span>'+(i+1)+'</span></button>'; }).join("");
    var n=0; for(var s in devSel) if(devSel[s]) n++;
    var sy=$("dvSync"); if(sy){ sy.disabled=n<2; sy.innerHTML=n<2?'SYNC':'SYNC TO '+(n-1)+' <kbd>⇧⌘S</kbd>'; }
    var pa=$("dvPaste"); if(pa) pa.disabled=!devClip;
    var lb=$("dvCount"); if(lb) lb.textContent=(devScope?'GROUP · ':'')+'FRAME '+(L.indexOf(cur)+1)+' OF '+L.length+(n>1?' · '+n+' SELECTED':'');
    var c=f.querySelector(".cur"); if(c&&c.scrollIntoView) try{ c.scrollIntoView({block:"nearest",inline:"center"}); }catch(e){} }
  function devClick(i, e){ var cur=devOpenIdx();
    if(e.shiftKey){ var a=devAnchor>=0?devAnchor:cur, L=devList(), ia=L.indexOf(a), ib=L.indexOf(i); devSel={}; for(var k=Math.min(ia,ib);k<=Math.max(ia,ib);k++) if(k>=0) devSel[L[k]]=true; devSel[cur]=true; devStrip(); return; }
    if(e.ctrlKey||e.metaKey){ if(i!==cur){ devSel[i]=!devSel[i]; devAnchor=i; } devStrip(); return; }
    devSel={}; devAnchor=i; devGo(i); }
  function devCopy(){ if(!edState) return; devClip=devSettings(edState); devStrip(); toast("Settings copied. Ctrl+V pastes them onto another frame."); }
  var devPasteN=0;
  function devPaste(){ if(!edState||!devClip) return; devPasteN++; for(var k in devClip) edState[k]=devClip[k]; syncEditUI(); queueRender(); edPushHist(); setTimeout(drawHist,140); toast("Settings pasted"); if(typeof qFlag==="function"&&!Q.flags.pasted) qFlag("pasted"); }
  function devSelectAll(){ devSel={}; devList().forEach(function(i){ devSel[i]=true; }); devStrip(); }
  // render other frames with this frame's settings, one at a time, then put the open frame back
  // put this frame's settings (not its crop) on the selected frames; they render in the background
  function devSync(){ if(!edState) return; var cur=devOpenIdx(), set=devSettings(edState), q=[];
    for(var k in devSel) if(devSel[k]&&+k!==cur) q.push(+k); if(!q.length) return;
    devCommit(); toast("Syncing "+q.length+" frame"+(q.length===1?"":"s")+"…");
    q.forEach(function(i){ var p=photos[i]; if(!p) return; var E=p.dev?devClone(p.dev):defEd(i); for(var s in set) E[s]=set[s];
      if(devIsDefault(E)){ if(p.orig){ p.url=p.orig; delete p.orig; delete p.dev; delete p.baked; p.edited=false; devChanged(p); } return; }
      if(!p.orig) p.orig=p.url; p.dev=devClone(E); p.edited=true; devSyncN++; devQueue(i); });
    if(!devSyncN) toast("Synced"); if(!Q.flags.synced) qFlag("synced"); devStrip(); }
  (function wireDevelop(){ var f=$("dvFilm"); if(f) f.addEventListener("click",function(e){ var b=e.target.closest("[data-dv]"); if(b) devClick(+b.getAttribute("data-dv"), e); });
    var b; if((b=$("dvCopy"))) b.onclick=devCopy; if((b=$("dvPaste"))) b.onclick=devPaste; if((b=$("dvSync"))) b.onclick=devSync;
    if((b=$("dvPrev"))) b.onclick=function(){ devStep(-1); }; if((b=$("dvNext"))) b.onclick=function(){ devStep(1); };
    window.addEventListener("keydown",function(e){ if(!editor||editor.classList.contains("hidden")) return; var t=e.target, tag=t&&t.tagName, mod=e.ctrlKey||e.metaKey;
      if(tag==="TEXTAREA"||(tag==="INPUT"&&t.type!=="range")||tag==="SELECT") return;
      if(mod&&e.shiftKey&&(e.key==="s"||e.key==="S")){ e.preventDefault(); devSync(); return; }
      if(mod&&(e.key==="c"||e.key==="C")&&!window.getSelection().toString()){ e.preventDefault(); devCopy(); return; }
      if(mod&&(e.key==="v"||e.key==="V")){ e.preventDefault(); devPaste(); return; }
      if(mod&&(e.key==="a"||e.key==="A")){ e.preventDefault(); devSelectAll(); return; }
      if(tag==="INPUT") return;   // arrows on a focused slider move the slider
      if(e.key==="ArrowRight"){ e.preventDefault(); devStep(1); } else if(e.key==="ArrowLeft"){ e.preventDefault(); devStep(-1); } }); })();
  if(/[?&]dev/.test(location.search)) window.__crv=function(){ return {busy:crv.busy,pend:!!crv.pend,shown:crv.shown,ms:crv.ms,w:crv.last&&crv.last.w}; };
  if(/[?&]dev/.test(location.search)) window.__dev={ pending:devPending, params:function(o){ var E=devClone(edState||defEd(0)); for(var k in o) E[k]=o[k]; return crParams(E); },
    bake:function(o,cb){ if(!edState||!edSrc) return null; var E=devClone(edState); for(var k in o) E[k]=o[k]; crBake(edSrc,E,cb); } };
