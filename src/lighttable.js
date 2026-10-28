  // ---------- Light table room: a 3D table, board and wall for pairing and sequencing (src/lighttable/) ----------
  // The table runs in its own iframe (its own three.js and WebGL context). It talks to Studium only through LT_BRIDGE:
  // it reads the student's frames and projects, saves its state into the session, and hands finished boards to the
  // Workbook and finished sequences to the Book.
  var LT_B64="@@lighttable-b64@@", ltFrame=null, ltWant=false;
  function ltPhotos(){ var n={}, out=[];
    photos.forEach(function(p,i){ if(p.research||!p.url) return; var pl=stPlaceOf(p); n[pl]=(n[pl]||0)+1;
      out.push({id:stId(i), url:p.url, name:pl+" "+String(n[pl]).padStart(2,"0"), place:pl, pick:!!p.pick}); });
    return out; }
  function ltData(){ var want=ltWant; ltWant=false; return {photos:ltPhotos(), projects:(st.projects||[]).map(function(p){ return {id:p.id, name:p.name, ids:(p.ids||[]).slice()}; }), state:st.lightTable||null, startTour:want}; }
  window.LT_BRIDGE={
    data:ltData,
    /* the artist packs for the secret layer's pulls: live if Research has loaded them, else the cache, else the sample pack. URLs absolute, the table is a srcdoc iframe. */
    packs:function(){ var list=null; try{ if(typeof rs!=="undefined"&&rs.packs&&rs.packs.length) list=rs.packs; }catch(e){}
      if(!list){ try{ list=JSON.parse(localStorage.getItem("studium_rs")||"null"); }catch(e){ list=null; } }
      if((!list||!list.length)&&typeof RS_SAMPLE!=="undefined") list=[RS_SAMPLE];
      return (list||[]).map(function(p){ return {id:p.id, name:p.name, imgs:(p.imgs||[]).map(function(im){ var u=im.url; try{ u=new URL(u, document.baseURI).href; }catch(e){} return {id:im.id, url:u}; })}; }); },
    sfx:function(id,o){ return sfx(id,o); },
    shutter:function(){ try{ if(typeof shutterSound==="function") shutterSound(); else sfx("capture"); }catch(e){} },
    save:function(s){ st.lightTable=s; saveSession(); },
    tourDone:function(){ ltWant=false; if(typeof Q!=="undefined"&&Q&&Q.tours){ Q.tours.lighttable=true; if(typeof qSave==="function") qSave(); } },
    flag:function(k){ if(typeof qFlag==="function") qFlag(k); },
    adopt:function(url, name){ photos.push({url:url, t:new Date(), place:"Samples", uploaded:true, body:"Sample", note:name||""}); var id=stId(photos.length-1); saveSession(); stRenderBar(); return id; },
    room:function(r){ if(st.open) stRoom(r); },
    key:function(k){ if(k==="q"||k==="Q") stCycle(-1); else if(k==="e"||k==="E") stCycle(1); else if(k==="Escape") stRoom("select"); },
    importFiles:function(files){ importPhotoFiles(files, function(n){ if(!n) return; saveSession(); stRenderBar(); ltSync(); }); },
    addWorkbookPage:function(pg){ sfx("capture"); wsEnsure(); if(!st.wsBoard||!st.wsBoard.pages) st.wsBoard={cur:0, paper:"white", pages:[]};
      var doc=st.wsBoard, page={id:bdUid(), tpl:pg.tpl||"sequence", bg:pg.bg||undefined, items:pg.items.map(function(it){ var c={}; for(var k in it) c[k]=it[k]; c.id=bdUid(); return c; })};
      if(doc.pages.length===1&&!(doc.pages[0].items||[]).length) doc.pages[0]=page; else doc.pages.push(page);
      doc.cur=doc.pages.length-1; wsB.reset(doc); saveSession(); },
    sendToBook:function(ids, note){ ids=ids.filter(function(id){ return stById(id)>=0; }); if(!ids.length) return;
      if(!bk.pages.length){ bk.pages.push({tpl:"bleed", imgs:[ids[0]]}); ids.forEach(function(id){ bk.pages.push({tpl:"centre", imgs:[id]}); }); bk.pages.push({tpl:"blank", imgs:[], back:true}); }
      else { var at=bk.pages.length; if(bk.pages[at-1].back) at--; ids.forEach(function(id,k){ bk.pages.splice(at+k,0,{tpl:"centre", imgs:[id]}); }); }
      saveSession(); }
  };
  function ltSync(){ try{ if(ltFrame&&ltFrame.contentWindow&&ltFrame.contentWindow.LTapp) ltFrame.contentWindow.LTapp.sync(ltData()); }catch(e){} }
  function ltFonts(){ var css=""; try{ Array.prototype.forEach.call(document.styleSheets, function(sh){ var rules; try{ rules=sh.cssRules; }catch(e){ return; }
      Array.prototype.forEach.call(rules||[], function(r){ if(r.type===5) css+=r.cssText+"\n"; }); }); }catch(e){} return css; }
  function ltOpen(){ var box=$("st-table"); if(!box) return;
    if(!ltFrame){ var html; try{ html=decodeURIComponent(escape(atob(LT_B64))); }catch(e){ box.innerHTML='<p class="lt-err">The light table didn’t load. Try reloading Studium.</p>'; return; }
      html=html.replace("</head>","<style>"+ltFonts()+"</style></head>");
      ltFrame=document.createElement("iframe"); ltFrame.className="lt-frame"; ltFrame.title="Light table"; ltFrame.setAttribute("allow","clipboard-write");
      ltFrame.srcdoc=html; box.appendChild(ltFrame);
      ltFrame.addEventListener("load", function(){ try{ ltFrame.contentWindow.focus(); }catch(e){} }); }
    else { try{ ltFrame.contentWindow.LTapp.pause(false); }catch(e){} ltSync(); try{ ltFrame.contentWindow.focus(); }catch(e){} } }
  function ltPause(){ try{ if(ltFrame&&ltFrame.contentWindow&&ltFrame.contentWindow.LTapp) ltFrame.contentWindow.LTapp.pause(true); }catch(e){} }
  function ltReset(){ if(!ltFrame) return; try{ ltFrame.contentWindow.LTapp.kill(); }catch(e){} ltFrame.remove(); ltFrame=null; if(st.open&&st.room==="table") ltOpen(); }
  /* the quest's "Show me how": open the room and run the table's own tour */
  function ltTour(){ ltWant=true; try{ if(ltFrame&&ltFrame.contentWindow&&ltFrame.contentWindow.LTapp){ ltFrame.contentWindow.LTapp.tour(); ltWant=false; } }catch(e){} }
