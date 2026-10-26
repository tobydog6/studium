  // ================= QUESTS: the student's side =================
  // "What's your focus today?" when you arrive, a card that tracks the quest you chose, a log of every quest, and a moment
  // when one's done. Tools are taught just in time: when the next step needs a tour you haven't done, the card offers it.
  var QU={pick:false, log:false, done:false, moments:[], open:{}, hubAsked:false, seen:{}, wasHub:false, hudHtml:"", hover:false, flashUntil:0, page:null};
  var Q_PAGE_NAMES={artist:"Artist model page", rank:"Rank page", annotate:"Annotate page", contact:"Contact sheet page", experiment:"Experiment page",
    mood:"Mood & ideas page", next:"What's next page", edit:"Before & after page", moodboard:"Moodboard", compare:"Compare page"};
  var Q_TOUR_NAMES={basics:"the warm-up", select:"picking and rejecting", edit:"editing", workbook:"the workbook", folio:"the folio", book:"the book",
    gallery:"the gallery", research:"Research", library:"project folders", lighting:"the lighting rig", golden:"golden hour", artist:"the artist model page"};
  function qMode(){ var w=typeof lsWho==="function"?lsWho():null; return !!w&&w.role!=="teacher"&&Q.set===(w.demo?"demo":"term1"); }
  function qToday(){ var d=new Date(); return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2); }
  function qPlanLive(){ var pl=typeof lsPlan==="function"&&lsPlan(); if(!pl) return false; var c=lsCur(pl); return c.i>=0&&c.i<pl.phases.length; }
  function qEsc(s){ return cbEsc(String(s==null?"":s)); }
  function qPillars(x){ return x.pillars||[x.pillar]; }
  function qPillarChip(x){ return qPillars(x).map(function(p){ return '<span class="q-pil p-'+p+'">'+((PILLARS[p]||{}).n||p).toUpperCase()+'</span>'; }).join(""); }
  function qDateNice(iso){ var d=new Date(iso+"T12:00:00"); return d.getDate()+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]; }
  function qCpLine(x){ if(qSet().sampleCp&&x.type==="main") return "Due: Checkpoint 1 (in class)"; var c=qCp(x.checkpoint); return c?"Checkpoint "+c.id.slice(2)+" · "+c.name+" · "+qDateNice(c.date):""; }
  // how far along each pillar is: required quests done out of required
  function qTally(){ var t={}; ["context","craft","environment","drive"].forEach(function(p){ t[p]={done:0, of:0}; });
    qAll().forEach(function(x){ if(x.type==="side") return; qPillars(x).forEach(function(p){ if(!t[p]) return; t[p].of++; if(qIsDone(x.id)) t[p].done++; }); }); return t; }
  // the suggestion: the next foundation; else the nearest checkpoint's unfinished quests, weakest pillar first, started first
  function qSuggest(){ var F=qFoundations().filter(function(f){ return !qIsDone(f.id); }); if(F.length) return F[0];
    var t=qTally(), frac=function(x){ return Math.min.apply(null, qPillars(x).map(function(p){ var a=t[p]; return a&&a.of?a.done/a.of:1; })); };
    var cps=qCheckpoints(); for(var i=0;i<cps.length;i++){ var c=qAll().filter(function(x){ return x.type==="main"&&x.checkpoint===cps[i].id&&!qIsDone(x.id)&&!qLockReason(x); });
      if(c.length){ c.sort(function(a,b){ return (frac(a)-frac(b))||((qState(b.id)?1:0)-(qState(a.id)?1:0)); }); return c[0]; } }
    if(!cps.length){ var M=qAll().filter(function(x){ return x.type==="main"&&!qIsDone(x.id)&&!qLockReason(x); }); M.sort(function(a,b){ return ((qState(b.id)?1:0)-(qState(a.id)?1:0))||(frac(a)-frac(b)); }); return M[0]||null; }
    return null; }

  // ---- where a quest or step takes you ----
  function qGoDest(dest){ if(typeof viewfinderOn!=="undefined"&&viewfinderOn) lowerCamera();
    if(!dest||dest==="scene"){ lsGo("shoot"); return; }
    if(dest==="research"){ lsGo("punctum"); return; }
    if(dest==="select"){ if(typeof LIB!=="undefined") LIB.key="all"; lsGo("select"); return; }
    if(dest==="edit"){ var key=null; libFolders().forEach(function(f){ if(f.kind==="sub"&&!key) key=f.key; }); var ids=key?libItems(key):stPicks(); if(!ids.length){ lsGo("select"); return; }
      if(key) LIB.key=key; devScope=ids.slice(); st.cur=ids[0]; hubHide("hub"); openStudio("edit"); return; }
    lsGo(dest); }
  function qNextStep(id){ var st0=qSteps(id); for(var i=0;i<st0.length;i++) if(!st0[i].ok) return st0[i]; return null; }
  function qGoQuest(id){ var x=qGet(id), s=qNextStep(id); qGoDest(s?s.go:x.go); }
  // "Show me how": go where the tour lives, then run it once its place is open
  function qHow(){ var id=Q.tracked, s=id&&qNextStep(id); if(!s||!s.tour){ toast("No tour for this step. Have a go, the checklist ticks itself."); return; } var tour=s.tour;
    if(CO.on) coStop(); if(tour==="lighting"){ qGoDest("scene"); var t0=Date.now(); (function w(){ if(loaded&&App.is("scene")){ if(!RL.ui) rlOpen(); setTimeout(function(){ coStart("lighting"); },400); return; } if(Date.now()-t0<20000) setTimeout(w,300); })(); return; }
    qGoDest(s.go); var T=CO_TOURS[tour], t1=Date.now(); (function wait(){ if(T&&T.where()){ coStart(tour); return; } if(Date.now()-t1<20000) setTimeout(wait,300); })(); }

  // ---- the quest board: rows of three. One tile per quest; a row opens when the row above is done. Click a tile for its page. ----
  function qTile(x){ var s=qStatus(x.id), p=qProgress(x.id), lock=qLockReason(x), tr=Q.tracked===x.id, sug=!tr&&!lock&&s!=="done"&&(qSuggest()||{}).id===x.id, mins=x.mins?x.mins+" MIN":"";
    var dots=qSteps(x.id).map(function(c){ return '<i class="'+(c.ok?'ok':'')+'"></i>'; }).join("");
    var word=tr?"TRACKING":s==="done"?"DONE":s==="active"?"IN PROGRESS":lock?"LOCKED":sug?"SUGGESTED":"";
    var tst=qClipKind(x)==="lighting";   /* testing: jump straight into the lighting rig, even while it's locked */
    return '<button class="q-tile s-'+s+(tr?' tr':'')+(sug?' sug':'')+'"'+(lock?(tst?' aria-disabled="true"':' disabled'):' data-q-see="'+x.id+'"')+'>'+(tst?'<span class="q-test" data-q-test="'+x.id+'" title="Testing: skip ahead to the lighting rig">TEST</span>':'')
      +'<span class="q-tk">'+qPillarChip(x)+(mins?'<em>'+mins+'</em>':'')+'</span>'
      +'<b>'+qEsc(x.title)+'</b><p>'+qEsc(lock||x.blurb)+'</p>'
      +'<span class="q-tf"><span class="q-dots">'+dots+'</span><span class="q-tw">'+(s==="done"?'✓ ':'')+word+(s!=="done"&&!lock&&qState(x.id)?' · '+p.done+' / '+p.of:'')+'</span></span>'
      +(s==="done"?'<span class="q-stamp">✓</span>':lock?'<span class="q-lockic">🔒</span>':'')+'</button>'; }
  function qBoardOpen(tab){ if(!qMode()) return; qDoneClose(); var el=gdEl("qLog","gd-pop q-pop"), wall=(tab||QU.tab)==="ach"&&typeof achWallHtml==="function"; QU.tab=wall?"ach":"q";
    if(typeof looking!=="undefined"&&looking){ try{ document.exitPointerLock(); }catch(e){} }
    var R=qRows(), all=qAll().filter(function(x){ return x.type!=="side"; }), nd=all.filter(function(x){ return qIsDone(x.id); }).length;
    var h='<div class="gd-card q-board'+(wall?' wide':'')+'"><div class="q-lh"><div><span class="k">'+(qDemo()?'DEMO · '+qTook().toUpperCase()+' · ':'')+nd+' OF '+all.length+' DONE</span><b class="t">'+(wall?'Achievements':'Your quests')+'</b></div>'
      +(typeof achWallHtml==="function"?'<div class="q-tabs"><button data-q="tabq" class="'+(wall?'':'on')+'">QUESTS</button><button data-q="taba" class="'+(wall?'on':'')+'">ACHIEVEMENTS · '+achCountAll()+' / '+ACH.length+'</button></div>':'')
      +'<button class="q-x" data-q="closelog" title="Close">✕</button></div>';
    if(wall){ el.innerHTML=h+achWallHtml()+'</div>'; el.classList.add("show"); QU.log=true; qHud(); return; }
    h+='<p class="q-bp0">'+(Q.tracked?'You can switch quests whenever you like. Your progress is kept.':'Pick one to see what it looks like, then track it. Any order within a row.')+'</p>';
    R.forEach(function(r,i){ var done=r.quests.filter(function(x){ return qIsDone(x.id); }).length, open=i===0||qRowDone(i-1), newly=open&&!QU.rowSeen[i];
      h+='<div class="q-rowh'+(open?'':' shut')+'"><span class="q-rn">'+(i+1)+'</span><span class="q-rt">'+qEsc(r.n.toUpperCase())+'</span><span class="q-rp">'+(open?done+' / '+r.quests.length:'OPENS WHEN ROW '+i+' IS DONE')+'</span><i class="q-rl"><b style="width:'+(done/Math.max(1,r.quests.length)*100).toFixed(0)+'%"></b></i></div>'
        +'<div class="q-grid'+(newly?' rise':'')+'">'+r.quests.map(qTile).join("")+'</div>'; if(open) QU.rowSeen[i]=1; });
    if(qDemo()) h+='<div class="q-demo"><span>DEMO · '+qTook()+'</span><button class="gd-skip" data-q="restart">Restart demo</button></div>';
    el.innerHTML=h+'</div>'; el.classList.add("show"); QU.log=true; qHud(); }
  QU.rowSeen={};
  function qPickOpen(){ qBoardOpen("q"); }
  function qPickClose(){ qLogClose(); }
  function qLogOpen(){ qBoardOpen(); }
  /* testing: close the board, put the gold frames away and open the lighting rig in the scene */
  function qTestLighting(){ qLogClose(); if(typeof CO!=="undefined"&&CO.on) coStop(); try{ localStorage.setItem("studium_lighttour","1"); }catch(e){}
    if(!loaded||!App.is("scene")) qGoDest("scene"); var t0=Date.now();
    (function w(){ if(loaded&&App.is("scene")&&!menuOpen()){ if(typeof chSetHidden==="function") chSetHidden(true); if(typeof rlOpen==="function"&&!RL.ui) rlOpen(); return; } if(Date.now()-t0<30000) setTimeout(w,300); })(); }
  function qLogClose(){ var el=$("qLog"); if(el) el.classList.remove("show"); QU.log=false; QU.pick=false; qHud(); if(typeof qMorphHide==="function") qMorphHide(); }

  // ---- the tracked quest card (the HUD) ----
  function qHudShow(){ if(!qMode()||QU.pick||QU.log||QU.done) return false; if(App.is("hub")||App.is("signin")||App.is("teacher")||App.is("landing")) return false;
    var hub=$("hub"); if(hub&&!hub.classList.contains("hidden")) return false; if(typeof coActive==="function"&&coActive()) return false; return loaded||(typeof st!=="undefined"&&st.open); }
  function qHud(){ var el=gdEl("qHud","gd-track q-hud"); if(!qHudShow()){ el.classList.remove("show"); return; }
    var id=Q.tracked, x=id&&qGet(id), vf=typeof viewfinderOn!=="undefined"&&viewfinderOn, html;
    if(!x){ var all=qAll().filter(function(y){ return y.type!=="side"; }), nd=all.filter(function(y){ return qIsDone(y.id); }).length; html='<button class="q-choose" data-q="log">YOUR QUESTS · '+nd+' / '+all.length+' ›</button>'; }
    else { var st0=qSteps(id), d=st0.filter(function(s){ return s.ok; }).length, nx=qNextStep(id), how=nx&&nx.tour&&!coTourDone(nx.tour);
      var late=qDemo()&&nx;   /* in the demo any step can be skipped, so nobody gets stuck */
      html='<div class="hd"><span class="k">'+(qDemo()?'<em class="q-tm">'+qTook()+'</em>':'')+qEsc(x.title.toUpperCase())+'</span><span class="fr">'+d+' / '+st0.length+'</span><button data-q="how" title="Show me how">?</button><button class="q-logb" data-q="log" title="All your quests">QUESTS</button></div>'
        +'<div class="q-sub">'+(x.type==="foundation"?'<span>FOUNDATION '+x.order+' OF '+qFoundations().length+'</span>':'')+qPillarChip(x)+(x.type==="main"?'<span>'+qEsc(qCpLine(x))+'</span>':'')+'</div>'
        +st0.map(function(c){ return '<div class="ck'+(c.ok?' ok':'')+'"><i>'+(c.ok?'✓':'')+'</i><span>'+qEsc(c.t)+'</span>'+(c.now?'<em>'+qEsc(c.now)+'</em>':'')+'</div>'; }).join("")
        +(how?'<button class="q-how" data-q="how">Show me how: '+qEsc(Q_TOUR_NAMES[nx.tour]||nx.tour)+' ›</button>':'')
        +(late?'<button class="q-skipst" data-q="skipstep">Skip this step ›</button>':'')
        +'<div class="bar"><b style="width:'+(d/st0.length*100).toFixed(0)+'%"></b></div>'; }
    if(el._html!==html){ el.innerHTML=html; el._html=html; }
    var mini=false;   /* the card stays open: the steps are the instructions */
    el.classList.toggle("min", mini&&!!x); el.classList.toggle("chip", vf); el.classList.add("show"); }
  (function(){ var el=gdEl("qHud","gd-track q-hud"); el.addEventListener("mouseenter",function(){ QU.hover=true; qHud(); }); el.addEventListener("mouseleave",function(){ QU.hover=false; setTimeout(qHud,1200); }); })();
  function qFlash(ms){ QU.flashUntil=Date.now()+(ms||6000); qHud(); }

  // ---- moments: a step ticks, a quest's done, the board opens ----
  qOn(function(kind,data){ if(!qMode()) return;
    if(kind==="step"){ var st0=data.steps, prev=QU.seen[data.id]||[]; st0.forEach(function(s,i){ if(s.ok&&!prev[i]) toast("✓ "+s.t); }); QU.seen[data.id]=st0.map(function(s){ return s.ok; }); qFlash(); }
    else if(kind==="complete") QU.moments.push({kind:"complete", id:data.id});
    else if(kind==="finish") QU.moments.push({kind:"finish"}); });
  function qMoment(){ if(QU.done||QU.pick||QU.log||!QU.moments.length) return; if(typeof viewfinderOn!=="undefined"&&viewfinderOn) return; if(typeof coActive==="function"&&coActive()) return;
    var fin=QU.moments.filter(function(m){ return m.kind==="finish"; })[0], C=QU.moments.filter(function(m){ return m.kind==="complete"; }), m=fin||C[C.length-1]||QU.moments[0];
    QU.moments=QU.moments.filter(function(x){ return x!==m&&x.kind!=="complete"; });   /* completes that never got their moment are folded into the newest */
    if(typeof looking!=="undefined"&&looking){ try{ document.exitPointerLock(); }catch(e){} }
    var el=gdEl("qDone","gd-pop q-pop"), h;
    if(false){
      h='<div class="gd-card q-donecard big"><span class="k">FOUNDATIONS DONE</span><b class="t">Your board is open</b><p>From here, you choose the order, one at a time. Your own project comes last. In class, each one counts toward a checkpoint your teacher sets.</p>'
        +'<div class="q-cps">'+qAll().filter(function(x){ return x.type==="main"; }).map(function(x){ return '<span><b>'+qEsc(x.title)+'</b>'+qPillarChip(x)+'</span>'; }).join("")+'</div>'
        +'<div class="gd-acts"><button class="gd-skip" data-q="closedone">Later</button><button class="gd-go" data-q="next">CHOOSE YOUR FIRST ›</button></div></div>'; }
    else if(m.kind==="finish"){ h=qFinishCard(); }
    else if(m.kind==="board"){ var cps=qCheckpoints();
      h='<div class="gd-card q-donecard big"><span class="k">FOUNDATIONS DONE</span><b class="t">Your board is open</b><p>From here, you choose. Main quests count toward your checkpoints, and you can switch between them any time.</p>'
        +'<div class="q-cps">'+cps.map(function(c){ return '<span><b>Checkpoint '+c.id.slice(2)+'</b>'+qEsc(c.name)+' · '+qDateNice(c.date)+'</span>'; }).join("")+'</div>'
        +'<div class="gd-acts"><button class="gd-skip" data-q="closedone">Later</button><button class="gd-go" data-q="next">CHOOSE YOUR FOCUS ›</button></div></div>'; }
    else { var x=qGet(m.id), F=qFoundations(), fd=F.filter(function(f){ return qIsDone(f.id); }).length;
      h='<div class="gd-card q-donecard"><span class="k">QUEST COMPLETE</span><b class="t">'+qEsc(x.title)+'</b><div class="q-pils">'+qPillarChip(x)+'</div>'
        +'<p>'+(x.page?'You made: '+qEsc(Q_PAGE_NAMES[x.page]||x.page)+'. ':'')+(x.type==="foundation"?'Foundation '+fd+' of '+F.length+' done.':qSet().finish?'That\'s '+qAll().filter(function(y){ return y.type==="main"&&qIsDone(y.id); }).length+' of '+qSet().finish+' for the demo.':'One more toward '+qEsc(qCpLine(x)||"your board")+'.')+'</p>'
        +(function(){ var nf=x.type==="foundation"&&F.filter(function(f){ return !qIsDone(f.id); })[0];   /* the next foundation is one click away, no picker */
            var ri=qSet().rows?qRowOf(x.id):-1, opened=ri>=0&&qRowDone(ri)&&qRows()[ri+1];
            return nf?'<div class="gd-acts"><button class="gd-skip" data-q="closedone">Keep going here</button><button class="gd-go" data-q-pick="'+nf.id+'">NEXT: '+qEsc(nf.title.toUpperCase())+' ›</button></div></div>'
              :'<div class="gd-acts"><button class="gd-skip" data-q="closedone">Keep going here</button><button class="gd-go" data-q="next">'+(opened?'ROW '+(ri+2)+' IS OPEN ›':'YOUR QUESTS ›')+'</button></div></div>'; })(); }
    el.innerHTML=h; el.classList.add("show"); QU.done=true; qHud();
    Array.prototype.forEach.call(el.querySelectorAll("[data-q]"),function(b){ readLock(b, Math.min(READ_MS,1500)); }); }
  function qDoneClose(){ var el=$("qDone"); if(el) el.classList.remove("show"); QU.done=false; qHud(); }

  // ---- quest morph: the card grows into the quest's page, with a live clip of what the quest looks like ----
  var QM={on:false, id:null, src:null, from:null, raf:0, t0:0};
  function qMorphEl(){ var e=$("qMorph"); if(!e){ e=document.createElement("div"); e.id="qMorph"; document.body.appendChild(e);
      e.addEventListener("click",function(ev){ if(ev.target.closest("[data-qm-close]")){ ev.stopPropagation(); qMorphClose(); } });
      window.addEventListener("keydown",function(ev){ if(QM.on&&ev.code==="Escape"){ ev.stopImmediatePropagation(); qMorphClose(); } },true); } return e; }
  function qMorphBox(e,b){ e.style.left=b.x+"px"; e.style.top=b.y+"px"; e.style.width=b.w+"px"; e.style.height=b.h+"px"; }
  function qClipKind(x){ if(x.clip) return x.clip; if((x.steps||[]).some(function(s){ return s.tour==="lighting"; })||/\blight(ing|s)?\b/i.test(x.title)) return "lighting";
    var g=x.go||"scene"; return g==="workshop"?"workbook":g==="scene"?"shoot":g; }
  function qMorphOpen(id, src){ var x=qGet(id); if(!x) return; var e=qMorphEl(); if(QM.on) qMorphHide();
    var r=src?src.getBoundingClientRect():null, W=window.innerWidth, H=window.innerHeight, tw=Math.min(1240,W*0.94), th=Math.min(680,H*0.9);
    var to={x:(W-tw)/2,y:(H-th)/2,w:tw,h:th}, from=(r&&r.width>10)?{x:r.left,y:r.top,w:r.width,h:r.height}:{x:to.x+to.w*0.1,y:to.y+to.h*0.1,w:to.w*0.8,h:to.h*0.8};
    QM.id=id; QM.src=src||null; QM.from=from; var st=qSteps(id), lock=qLockReason(x), tr=Q.tracked===id, done=qIsDone(id), kind=qClipKind(x);
    e.innerHTML='<div class="qm-in"><div class="qm-media"><canvas class="qm-clip" data-qclip="'+kind+'"></canvas><span class="qm-cap">WHAT THIS QUEST LOOKS LIKE</span></div><div class="qm-text"><span class="qm-k">'+qPillars(x).map(function(p){ return ((PILLARS[p]||{}).n||p).toUpperCase(); }).join(" · ")+' · '+(x.type==="side"?"SIDE QUEST":x.type==="foundation"?"FOUNDATION":"QUEST")+(x.mins?' · '+x.mins+' MIN':'')+'</span>'
      +'<h3>'+qEsc(x.title)+'</h3><p class="qm-p">'+qEsc(x.blurb)+'</p>'+(lock?'<p class="q-lock">'+qEsc(lock)+'</p>':'')
      +'<div class="qm-steps">'+st.map(function(c){ return '<span><i class="'+(c.ok?'ok':'')+'">'+(c.ok?'✓':'')+'</i>'+qEsc(c.t)+'</span>'; }).join("")+'</div>'
      +(x.page?'<p class="q-mk">Makes: '+qEsc(Q_PAGE_NAMES[x.page]||x.page)+'</p>':'')
      +'<div class="qm-acts">'+(!lock&&!done?'<button class="gd-go" data-q-pick="'+id+'">'+(tr?'GO TO THIS QUEST ›':'TRACK THIS QUEST ›')+'</button>':'')+'<button class="gd-skip" data-qm-close>Back</button></div></div></div><button class="qm-x" data-qm-close title="Close">✕</button>';
    e.style.transition="none"; qMorphBox(e,from); e.style.borderRadius="14px"; e.style.opacity=1; e.classList.add("on"); e.classList.remove("live"); if(src) src.style.visibility="hidden";
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ var E="cubic-bezier(.2,.8,.2,1)"; e.style.transition="left .5s "+E+",top .5s "+E+",width .5s "+E+",height .5s "+E+",border-radius .5s"; qMorphBox(e,to); e.style.borderRadius="18px"; e.classList.add("live"); }); });
    QM.on=true; QM.t0=performance.now(); cancelAnimationFrame(QM.raf);
    (function loop(){ if(!QM.on) return; QM.raf=requestAnimationFrame(loop); var cv=e.querySelector(".qm-clip"); if(cv) qClipDraw(cv.getAttribute("data-qclip"), cv, performance.now()-QM.t0); })(); }
  function qMorphClose(){ var e=$("qMorph"); if(!e||!QM.on) return; QM.on=false; cancelAnimationFrame(QM.raf); e.classList.remove("live"); var src=QM.src, from=QM.from;
    if(src&&document.body.contains(src)){ var r=src.getBoundingClientRect(); if(r.width>10) from={x:r.left,y:r.top,w:r.width,h:r.height}; }
    qMorphBox(e,from); e.style.borderRadius="14px"; setTimeout(function(){ if(QM.on) return; e.style.opacity=0; e.classList.remove("on"); if(src) src.style.visibility=""; },480); }
  function qMorphHide(){ var e=$("qMorph"); if(!e) return; QM.on=false; cancelAnimationFrame(QM.raf); e.classList.remove("on","live"); e.style.opacity=0; if(QM.src) QM.src.style.visibility=""; }
  // the clips: one Stump frame and a few shapes, drawn live, looping about every five seconds. Each shows the quest's core move.
  function qcE(x){ return x<0?0:x>1?1:x*x*(3-2*x); }
  function qcS(u,a,b){ return qcE((u-a)/(b-a)); }
  function qcL(a,b,k){ return a+(b-a)*k; }
  function qcImg(g,x,y,w,h,f){ var im=CO_IMG; g.save(); g.beginPath(); g.rect(x,y,w,h); g.clip(); if(f) g.filter=f;
    if(im.complete&&im.naturalWidth){ var ir=im.naturalWidth/im.naturalHeight, dw=w, dh=w/ir; if(dh<h){ dh=h; dw=h*ir; } g.drawImage(im,x+(w-dw)/2,y+(h-dh)/2,dw,dh); } else { g.fillStyle="#3a3024"; g.fillRect(x,y,w,h); } g.restore(); }
  function qcCur(g,x,y){ g.save(); g.translate(x,y); g.fillStyle="#f4f1ea"; g.strokeStyle="#0c0b0a"; g.lineWidth=1.5; g.beginPath(); g.moveTo(0,0); g.lineTo(0,17); g.lineTo(4.5,13); g.lineTo(7.5,19); g.lineTo(10,18); g.lineTo(7,12); g.lineTo(12,12); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  function qcTag(g,t){ g.font="500 10.5px 'Geist Mono',ui-monospace,monospace"; var w=g.measureText(t).width; g.fillStyle="rgba(12,11,10,.74)"; g.fillRect(10,10,w+20,22); g.fillStyle="#e3ad57"; g.textBaseline="alphabetic"; g.textAlign="left"; g.fillText(t,20,25); }
  function qcFrame(g,x,y,w,h,c){ g.strokeStyle=c||"#e3ad57"; g.lineWidth=2; g.strokeRect(x+1,y+1,w-2,h-2); }
  function qClipDraw(kind, cv, ms){ var dpr=Math.min(2,window.devicePixelRatio||1), W=cv.clientWidth||340, H=cv.clientHeight||227; if(cv.width!==Math.round(W*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
    var g=cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.globalAlpha=1; g.filter="none"; g.fillStyle="#0c0b0a"; g.fillRect(0,0,W,H); var T=5200, u=(ms%T)/T, k, i;
    if(kind==="shoot"){ qcImg(g,0,0,W,H); k=qcS(u,.05,.3); var ih=qcL(H,H*0.6,k), iw=qcL(W,W*0.6,k); g.fillStyle="rgba(8,7,6,.78)"; g.fillRect(0,0,W,(H-ih)/2); g.fillRect(0,(H+ih)/2,W,(H-ih)/2); g.fillRect(0,(H-ih)/2,(W-iw)/2,ih); g.fillRect((W+iw)/2,(H-ih)/2,(W-iw)/2,ih);
      if(k>.95){ var af=u<.56?"#e3ad57":"#5fe08a", s=u<.56?22+Math.sin(ms/40)*2:20; g.strokeStyle=af; g.lineWidth=2; g.strokeRect(W/2-s/2,H/2-s/2,s,s); }
      var fl=u>.62&&u<.7?1-qcS(u,.62,.7):0; if(fl){ g.fillStyle="rgba(255,255,255,"+fl*0.9+")"; g.fillRect(0,0,W,H); }
      if(u>.68){ var fk=qcS(u,.68,.95); var pw=qcL(iw,54,fk), ph=qcL(ih,36,fk), px=qcL((W-iw)/2,W-66,fk), py=qcL((H-ih)/2,12,fk); qcImg(g,px,py,pw,ph); qcFrame(g,px,py,pw,ph,"#f4f1ea"); }
      qcTag(g,u<.3?"RIGHT CLICK · RAISE":u<.56?"HOLD F · FOCUS":u<.68?"CLICK · SHOOT":"INTO YOUR STUDIO"); }
    else if(kind==="select"){ var cw=(W-40)/3, ch=cw*0.67, gx=16, gy=34; for(i=0;i<6;i++){ var cx=gx+(i%3)*(cw+4), cy=gy+Math.floor(i/3)*(ch+4); qcImg(g,cx,cy,cw,ch,"brightness("+(0.6+0.15*(i%4))+") saturate("+(0.7+0.1*i)+")");
        if(i===1&&u>.4){ qcFrame(g,cx,cy,cw,ch); g.fillStyle="#e3ad57"; g.fillRect(cx+6,cy+6,34,14); g.fillStyle="#17140d"; g.font="600 8px 'Geist Mono',ui-monospace,monospace"; g.fillText("PICK",cx+10,cy+16); }
        if(i===5&&u>.78){ g.strokeStyle="#e4552e"; g.lineWidth=3; g.beginPath(); g.moveTo(cx+10,cy+10); g.lineTo(cx+cw-10,cy+ch-10); g.moveTo(cx+cw-10,cy+10); g.lineTo(cx+10,cy+ch-10); g.stroke(); } }
      var c1x=gx+cw*1.5, c1y=gy+ch*0.5, c2x=gx+2*(cw+4)+cw*0.5, c2y=gy+ch+4+ch*0.5; k=u<.5?qcS(u,.08,.38):qcS(u,.5,.74); qcCur(g,u<.5?qcL(W*0.8,c1x,k):qcL(c1x,c2x,k),u<.5?qcL(H+10,c1y,k):qcL(c1y,c2y,k));
      qcTag(g,u<.4?"YOUR LIGHT TABLE":u<.5?"P · PICK":u<.78?"NOW A WEAK ONE":"X · REJECT"); }
    else if(kind==="edit"){ k=qcS(u,.2,.62); var b=1+0.38*k, pw=W*0.6; qcImg(g,0,0,pw,H,"brightness("+b.toFixed(3)+")"); g.fillStyle="#14110d"; g.fillRect(pw,0,W-pw,H);
      var rows=["EXPOSURE","CONTRAST","HIGHLIGHTS","SHADOWS"]; for(i=0;i<4;i++){ var ry=38+i*42, x0=pw+16, x1=W-16; g.fillStyle="#8d8678"; g.font="500 8px 'Geist Mono',ui-monospace,monospace"; g.fillText(rows[i],x0,ry-8); g.strokeStyle="rgba(244,241,234,.2)"; g.lineWidth=2; g.beginPath(); g.moveTo(x0,ry+8); g.lineTo(x1,ry+8); g.stroke();
        var f=i===0?0.5+0.4*k:0.5, kx=x0+(x1-x0)*f; g.strokeStyle=i===0?"#e3ad57":"#8d8678"; g.lineWidth=2; g.beginPath(); g.arc(kx,ry+8,5,0,Math.PI*2); g.stroke(); if(i===0){ g.fillStyle="#e3ad57"; g.textAlign="right"; g.fillText("+"+(1.4*k).toFixed(1),x1,ry-8); g.textAlign="left"; qcCur(g,kx+2,ry+10); } }
      qcTag(g,"DRAG · THE LIGHT SLIDERS"); }
    else if(kind==="workbook"){ var pw2=W*0.62, ph2=pw2*0.707, px2=W-pw2-14, py2=(H-ph2)/2; g.fillStyle="#f4f1ea"; g.fillRect(px2,py2,pw2,ph2); g.fillStyle="rgba(0,0,0,.35)"; g.fillRect(px2+3,py2+ph2,pw2,4);
      k=qcS(u,.1,.46); var tw=qcL(70,pw2*0.46,k), th=tw*0.67, tx=qcL(14,px2+16,k), ty=qcL(H-th-14,py2+16,k), bump=u>.46&&u<.56?Math.sin((u-.46)/.1*Math.PI)*4:0; qcImg(g,tx,ty-bump,tw,th); g.fillStyle="rgba(0,0,0,"+(0.25*(1-k)+.1)+")"; if(k<1) g.fillRect(tx+4,ty+th,tw,3); if(k<1) qcCur(g,tx+tw*0.55,ty+th*0.5);
      var t2=qcS(u,.56,.92); for(i=0;i<4;i++){ var lw=(pw2-tw-48)*[1,.86,.94,.5][i]*qcE(t2*4-i); if(lw>0){ g.fillStyle="#5a5348"; g.fillRect(px2+tw+30,py2+22+i*13,lw,4); } }
      if(t2>0&&t2<1){ var li=Math.min(3,Math.floor(t2*4)); g.fillStyle="#e3ad57"; g.fillRect(px2+tw+30+(pw2-tw-48)*[1,.86,.94,.5][li]*qcE(t2*4-li)+2,py2+19+li*13,2,10); }
      qcTag(g,u<.5?"DRAG A PHOTO ONTO THE PAGE":"WRITE WHAT YOU SEE"); }
    else if(kind==="folio"){ var pw3=(W-56)/3, ph3=pw3*1.41, py3=(H-ph3)/2; for(i=0;i<3;i++){ g.fillStyle="#f4f1ea"; g.fillRect(16+i*(pw3+12),py3,pw3,ph3); }
      var cells=[[0,0,.55,.4],[.58,0,.42,.26],[.58,.29,.42,.11],[0,.43,.3,.28],[.33,.43,.67,.28],[0,.74,1,.26]]; for(i=0;i<6;i++){ var c=cells[i], a=qcS(u,.1+i*.12,.2+i*.12); if(a<=0) continue; var cx3=16+4+c[0]*(pw3-8), cy3=py3+4+c[1]*(ph3-8), cw3=c[2]*(pw3-8)-2, ch3=c[3]*(ph3-8)-2; g.save(); g.globalAlpha=a; g.translate(cx3+cw3/2,cy3+ch3/2); g.scale(qcL(.85,1,a),qcL(.85,1,a)); qcImg(g,-cw3/2,-ch3/2,cw3,ch3,"brightness("+(0.7+0.12*i)+")"); g.restore(); }
      if(u<.84){ var ci=Math.min(5,Math.floor((u-.05)/.12)), cc=cells[Math.max(0,ci)]; qcCur(g,16+4+cc[0]*(pw3-8)+cc[2]*(pw3-8)/2,py3+4+cc[1]*(ph3-8)+cc[3]*(ph3-8)/2); }
      qcTag(g,"FILL A THIRD · EDGE TO EDGE"); }
    else if(kind==="book"){ var bw=W*0.78, bh=bw*0.5, bx=(W-bw)/2, by=(H-bh)/2; g.fillStyle="#f4f1ea"; g.fillRect(bx,by,bw,bh); g.fillStyle="rgba(0,0,0,.18)"; g.fillRect(bx+bw/2-1,by,2,bh);
      qcImg(g,bx+14,by+14,bw/2-28,bh-28,"brightness(.8)"); k=qcS(u,.3,.72); var fx=Math.cos(k*Math.PI);
      if(fx>0){ qcImg(g,bx+bw/2+14,by+14,bw/2-28,bh-28,"brightness(1.05)"); g.save(); g.translate(bx+bw/2,0); g.scale(fx,1); g.fillStyle="#f4f1ea"; g.fillRect(0,by,bw/2,bh); qcImg(g,14,by+14,bw/2-28,bh-28,"brightness(1.05)"); g.fillStyle="rgba(0,0,0,"+(0.25*(1-fx))+")"; g.fillRect(0,by,bw/2,bh); g.restore(); }
      else { qcImg(g,bx+bw/2+14,by+14,bw/2-28,bh-28,"brightness(1.05) saturate(.7)"); g.save(); g.translate(bx+bw/2,0); g.scale(fx,1); g.fillStyle="#ece8df"; g.fillRect(0,by,bw/2,bh); g.fillStyle="#5a5348"; for(i=0;i<5;i++) g.fillRect(16,by+22+i*12,bw/2-40,3); g.restore(); }
      g.fillStyle="rgba(0,0,0,.4)"; g.fillRect(bx+3,by+bh,bw,5); qcTag(g,u<.3?"YOUR PICKS AS SPREADS":"TURN THE PAGE"); }
    else if(kind==="gallery"){ g.fillStyle="#e9e4da"; g.fillRect(0,0,W,H*0.78); g.fillStyle="#6e5a40"; g.fillRect(0,H*0.78,W,H*0.22); var fw=W*0.22, fh=fw*0.67, fy=H*0.3;
      var sp=g.createRadialGradient(W/2,H*0.1,10,W/2,H*0.35,W*0.5); sp.addColorStop(0,"rgba(255,235,200,.55)"); sp.addColorStop(1,"rgba(255,235,200,0)"); g.fillStyle=sp; g.fillRect(0,0,W,H*0.78);
      for(i=0;i<3;i++){ var fx2=W*0.14+i*(fw+W*0.08), fy2=fy; if(i===1){ k=qcS(u,.2,.55); fy2=qcL(-fh-20,fy,k); } g.fillStyle="rgba(0,0,0,.22)"; g.fillRect(fx2+4,fy2+6,fw+12,fh+12); g.fillStyle="#17140d"; g.fillRect(fx2-6,fy2-6,fw+12,fh+12); g.fillStyle="#f4f1ea"; g.fillRect(fx2-2,fy2-2,fw+4,fh+4); qcImg(g,fx2,fy2,fw,fh,"brightness("+(0.85+0.1*i)+")"); }
      g.fillStyle="#17140d"; g.font="500 7px 'Geist Mono',ui-monospace,monospace"; g.fillText("STUMP · 2026",W*0.14,fy+fh+22); qcTag(g,u<.55?"HANG ANOTHER":"SPACE AND SEQUENCE"); }
    else if(kind==="research"){ var aw=(W-36)/2, ah=aw*0.7, ay=(H-ah)/2+8, fa=u>.72&&u<.78?1-qcS(u,.72,.78):u>=.78&&u<.84?qcS(u,.78,.84):1; g.globalAlpha=fa;
      qcImg(g,12,ay,aw,ah,u<.78?"brightness(.95)":"brightness(.8) sepia(.3)"); qcImg(g,24+aw,ay,aw,ah,u<.78?"brightness(.7) saturate(.6)":"brightness(1.05)"); g.globalAlpha=1;
      g.fillStyle="#8d8678"; g.font="500 9px 'Geist Mono',ui-monospace,monospace"; g.fillText("A",12,ay-6); g.fillText("B",24+aw,ay-6);
      k=qcS(u,.12,.4); if(u<.72){ qcCur(g,qcL(W/2,12+aw*0.5,k),qcL(H-10,ay+ah*0.55,k)); if(u>.42){ qcFrame(g,12,ay,aw,ah); g.fillStyle="#e3ad57"; g.fillRect(12,ay+ah-18,78,18); g.fillStyle="#17140d"; g.font="600 8px 'Geist Mono',ui-monospace,monospace"; g.fillText("STRONGER",18,ay+ah-6); } }
      qcTag(g,u<.42?"WHICH IS STRONGER?":u<.72?"GO WITH YOUR GUT":"NEXT PAIR"); }
    else if(kind==="lighting"){ g.strokeStyle="rgba(244,241,234,.06)"; g.lineWidth=1; for(i=0;i<W;i+=24){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,H); g.stroke(); } for(i=0;i<H;i+=24){ g.beginPath(); g.moveTo(0,i); g.lineTo(W,i); g.stroke(); }
      var sx=W*0.56, sy=H*0.5; k=qcS(u,.15,.5); var lx=qcL(W*0.1,W*0.34,k), ly=qcL(H*0.82,H*0.3,k), on=u>.5?1:0.35;
      var cone=g.createRadialGradient(lx,ly,2,lx,ly,W*0.42); cone.addColorStop(0,"rgba(255,220,160,"+(0.5*on)+")"); cone.addColorStop(1,"rgba(255,220,160,0)"); g.fillStyle=cone; g.fillRect(0,0,W,H);
      g.strokeStyle="#e3ad57"; g.lineWidth=2; g.beginPath(); g.arc(sx,sy,16,0,Math.PI*2); g.stroke(); g.fillStyle="rgba(227,173,87,.25)"; g.fill();
      g.fillStyle="#f4f1ea"; g.beginPath(); g.moveTo(sx,sy+56); g.lineTo(sx-7,sy+72); g.lineTo(sx+7,sy+72); g.closePath(); g.fill();
      g.fillStyle="#ffe6b4"; g.beginPath(); g.arc(lx,ly,7,0,Math.PI*2); g.fill(); g.strokeStyle="rgba(255,230,180,.5)"; g.setLineDash([3,4]); g.beginPath(); g.moveTo(lx,ly); g.lineTo(sx,sy); g.stroke(); g.setLineDash([]); if(k<1) qcCur(g,lx+6,ly+8);
      var tw4=W*0.3, th4=tw4*0.67; qcImg(g,W-tw4-10,H-th4-10,tw4,th4,"brightness("+(0.3+0.9*k*on).toFixed(2)+")"); qcFrame(g,W-tw4-10,H-th4-10,tw4,th4,"#f4f1ea"); qcTag(g,u<.15?"MAKE IT NIGHT":u<.5?"DRAG THE LIGHT IN":"SEE IT THROUGH THE LENS"); }
    else { qcImg(g,0,0,W,H); qcTag(g,"QUEST"); } }

  // ---- clicks ----
  document.addEventListener("click",function(e){ var t=e.target.closest&&e.target.closest("[data-q],[data-q-pick],[data-q-open],[data-q-track],[data-q-see],[data-q-test]"); if(!t) return; e.stopPropagation();
    if(t.closest(".q-tile[aria-disabled]")&&!e.target.closest("[data-q-test]")) return;
    if(e.target.closest("[data-q-test]")){ qTestLighting(); return; }
    if(t.hasAttribute("data-q-see")){ qMorphOpen(t.getAttribute("data-q-see"), t.classList.contains("q-tile")?t:t.closest(".q-tile")||t); return; }
    if(t.hasAttribute("data-q-pick")){ var id=t.getAttribute("data-q-pick"); qMorphHide(); qPickClose(); qLogClose(); qDoneClose(); if(qTrack(id)){ qFlash(8000); QU.seen[id]=qSteps(id).map(function(s){ return s.ok; }); qGoQuest(id); } return; }
    if(t.hasAttribute("data-q-open")){ var k=t.getAttribute("data-q-open"); QU.open[k]=!QU.open[k]; qLogOpen(); return; }
    if(t.hasAttribute("data-q-track")){ var id2=t.getAttribute("data-q-track"); qLogClose(); if(qTrack(id2)){ qFlash(8000); qGoQuest(id2); } return; }
    var a=t.getAttribute("data-q");
    if(a==="tabq"||a==="taba"){ QU.tab=a==="taba"?"ach":"q"; qLogOpen(); return; }
    if(a==="skip"){ qPickClose(); return; } if(a==="log"){ qLogOpen(); return; } if(a==="closelog"){ qLogClose(); return; }
    if(a==="pick"){ qBoardOpen("q"); return; } if(a==="how"){ qHow(); return; }
    if(a==="closedone"){ qDoneClose(); return; } if(a==="restart"){ qDemoRestart(); return; } if(a==="explore"){ qDoneClose(); qGoDest("scene"); return; }
    if(a==="skipstep"){ qSkipStep(); return; } if(a==="fbsend"){ qFeedbackSend(); return; } if(a==="next"){ qDoneClose(); qBoardOpen("q"); return; } if(a==="board"){ qBoardOpen("q"); return; } },true);
  window.addEventListener("keydown",function(e){ if(e.code!=="Escape") return; if(QU.log){ e.preventDefault(); e.stopImmediatePropagation(); qLogClose(); } else if(QU.pick){ e.preventDefault(); e.stopImmediatePropagation(); qPickClose(); } },true);

  // ---- the hub and the nav bar follow the tracked quest ----
  function qHubRender(h){ if(!qMode()||qPlanLive()) return; var x=Q.tracked&&qGet(Q.tracked), p=x&&qProgress(x.id);
    var wel=typeof LA!=="undefined"&&LA.welcome&&Date.now()-LA.welcome<20000;
    h.querySelector(".h6-eb").textContent=(wel?"WELCOME TO STUDIUM · ":"")+(x?"YOUR FOCUS":"CHOOSE YOUR FOCUS");
    h.querySelector(".h6-h").textContent=(x?x.title:"What's your focus today?")+(x?".":"");
    h.querySelector(".h6-words").textContent=x?x.blurb:"Open your quests and pick one. You can switch any time.";
    var cta=h.querySelector(".h6-cta"); cta.innerHTML=(x?"CARRY ON":"YOUR QUESTS")+' <kbd>↵</kbd>';
    h.querySelector(".h6-status").textContent=x?p.done+" OF "+p.of+" STEPS":"";
    var qb=h.querySelector(".h6-quests"); if(!qb){ qb=document.createElement("button"); qb.className="h6-quests"; qb.setAttribute("data-q","log"); var act=h.querySelector(".d7-act"); if(act) act.appendChild(qb); }
    qb.textContent="YOUR QUESTS ›"; }
  function qHubGo(){ if(Q.tracked&&!qIsDone(Q.tracked)) qGoQuest(Q.tracked); else qBoardOpen("q"); }
  function qNavTask(task){ if(!qMode()||qPlanLive()) return false; var x=Q.tracked&&qGet(Q.tracked);
    if(x){ var p=qProgress(x.id); task.innerHTML='<i></i><span class="t">'+qEsc(x.title)+'</span><span class="n">· '+p.done+' / '+p.of+'</span>'; } else task.innerHTML='<i></i><span class="t">Choose your focus</span>';
    task.classList.remove("empty"); task.setAttribute("data-q", "log"); return true; }

  // ---- the loop ----
  setInterval(function(){ if(!qMode()){ document.body.classList.remove("q-on"); ["qHud","qPick","qLog","qDone"].forEach(function(k){ var e=$(k); if(e) e.classList.remove("show"); }); return; }
    var hub=$("hub"), atHub=App.is("hub")&&hub&&!hub.classList.contains("hidden");
    if(atHub&&!QU.wasHub) QU.hubAsked=false; QU.wasHub=atHub;
    qMoment(); qAutoTour(); qHud(); document.body.classList.toggle("q-on", true); }, 700);
  /* seamless: when the step you're on needs a tour you haven't done, it starts by itself (foundations, and the whole demo) */
  QU.auto={};
  var Q_NOAUTO=/[?&]noauto/.test(location.search);   /* scripted tests drive the tours themselves */
  function qAutoTour(){ if(Q_NOAUTO||QU.moments.length||(typeof LA!=="undefined"&&LA.on)) return; var id=Q.tracked, x=id&&qGet(id); if(!x||!(qDemo()||x.type==="foundation")) return;
    if(QU.pick||QU.log||QU.done||qPlanLive()||(typeof CO!=="undefined"&&CO.on)||(typeof viewfinderOn!=="undefined"&&viewfinderOn)) return;
    if(App.is("hub")||App.is("signin")||App.is("landing")||App.is("teacher")) return; if(typeof ACHU!=="undefined"&&ACHU.full) return;
    var nx=qNextStep(id); if(!nx||!nx.tour||coTourDone(nx.tour)) return; var k=id+":"+nx.tour; if(QU.auto[k]) return; QU.auto[k]=1; qHow(); }
  if(/[?&]dev/.test(location.search)){ window.__qu={ state:function(){ var el=$("qHud"); return {mode:qMode(), pick:QU.pick, log:QU.log, done:QU.done, hud:!!(el&&el.classList.contains("show")), mini:!!(el&&el.classList.contains("min")), moments:QU.moments.length, suggest:(qSuggest()||{}).id||null, how:!!(el&&el.querySelector(".q-how"))}; },
    pick:qPickOpen, log:qLogOpen, how:qHow, closeAll:function(){ qPickClose(); qLogClose(); qDoneClose(); } }; }

  // the hub's "today" and the nav bar's task show the tracked quest when there's no live lesson plan
  var qHubBase=hubRender; hubRender=function(){ qHubBase.apply(this,arguments); var h=$("hub"); if(h) qHubRender(h); };
  var qNavBase=navScene; navScene=function(){ qNavBase.apply(this,arguments); var t=$("navTask"); if(t&&App.is("scene")) qNavTask(t); };

  // ================= teacher side: a student's quests in a few numbers, and where that puts them =================
  // qSummary goes out with presence; qStanding reads one back against the class's checkpoint dates.
  function qSummary(){ var t=qTally(), tl={}; Object.keys(t).forEach(function(p){ tl[p]=[t[p].done, t[p].of]; });
    var tr=Q.tracked&&qGet(Q.tracked), sp=tr?qProgress(Q.tracked):null;
    return {tracked:Q.tracked||null, title:tr?tr.title:null, step:sp?[sp.done, sp.of]:null, f:qFoundations().filter(function(f){ return qIsDone(f.id); }).length,
      done:qAll().filter(function(x){ return qIsDone(x.id); }).map(function(x){ return x.id; }), tally:tl, by:Object.keys(Q.quests).filter(function(k){ return Q.quests[k].by==="teacher"; }),
      ach:typeof ACH!=="undefined"?{n:achCountAll(), ids:ACH.filter(function(a){ return achLevel(a.id); }).map(function(a){ return a.id; }), show:achS().showcase.slice()}:null }; }
  function qTallyOf(done){ var t={}; ["context","craft","environment","drive"].forEach(function(p){ t[p]=[0,0]; });
    qAll().forEach(function(x){ if(x.type==="side") return; qPillars(x).forEach(function(p){ if(!t[p]) return; t[p][1]++; if(done.indexOf(x.id)>=0) t[p][0]++; }); }); return t; }
  function qIso(d){ return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2); }
  /* status against the next checkpoint: what's due there (foundations count toward the first), how much of it is done,
     and how much of the time to it has gone. Anything left from a checkpoint already past is behind. */
  function qStanding(done, cps, today){ today=today||qIso(new Date()); var set=qSet(), defs=set.checkpoints||[];
    var due=function(id){ return qAll().filter(function(x){ return x.type!=="side"&&x.checkpoint===id&&!(x.type==="main"&&x.locked&&x.locked()); }); };
    var start=new Date(cps[0].date+"T00:00"); start.setDate(start.getDate()-(defs[0]?defs[0].week:3)*7);
    for(var i=0;i<cps.length;i++){ var D=due(cps[i].id), n=D.filter(function(x){ return done.indexOf(x.id)>=0; }).length;
      if(cps[i].date<today){ if(n<D.length) return {s:"behind", cp:cps[i], n:n, of:D.length, why:(D.length-n)+" left from "+cps[i].name}; continue; }
      var a=i?new Date(cps[i-1].date+"T00:00"):start, b=new Date(cps[i].date+"T00:00"), now=new Date(today+"T12:00"),
        e=Math.max(0,Math.min(1,(now-a)/Math.max(1,b-a))), f=D.length?n/D.length:1, s;
      if(f>=1) s=e<0.8?"ahead":"on"; else if(f>=e-0.15) s="on"; else if(f>=e-0.4) s="close"; else s="behind";
      return {s:s, cp:cps[i], n:n, of:D.length, e:e}; }
    return {s:"done", cp:null, n:0, of:0}; }
  var Q_STANDING={ahead:"AHEAD", on:"ON TRACK", close:"CLOSE", behind:"BEHIND", done:"ALL DONE"};
  // a teacher's tick: a whole quest, or one step of it, marked done from the teacher's side
  function qTeacherTick(id, i){ var x=qGet(id); if(!x) return false; var s=Q.quests[id]||(Q.quests[id]={started:Date.now(), base:{photos:photos.length, t:Date.now()}, done:null, stepDone:{}});
    if(i==null){ if(!s.done){ s.done=Date.now(); s.by="teacher"; qEmit("complete",{id:id}); } } else s.stepDone[i]=true;
    qSave(); qTick(); return true; }

  // ================= the demo: start, the clock, the finish card, feedback, restart =================
  var Q_FB_KEY="studium_demo_feedback";
  function qTook(){ var t0=Q.t0||Q.first, s=Math.max(0,Math.round(((Q.finished||Date.now())-t0)/1000)); return Math.floor(s/60)+" min"; }
  /* a fresh demo: the workspace empties in memory, demo state and the demo's saved session are cleared, real work stays saved */
  function qDemoStart(){ if(!qDemo()&&typeof saveSessionNow==="function") saveSessionNow();
    wipeWorkspace(); if(!qDemo()) lsSetWho({role:"solo", name:"", demo:true});
    try{ localStorage.removeItem(Q_DEMO_KEY); }catch(e){} clearSession();
    Q=qLoad(); Q.t0=Date.now(); Q.lastFocusAsk=qToday(); qTrack("d1"); qSave(); QU.flashUntil=Date.now()+10000; READ_MS=Math.min(READ_MS,2000);
    QU.moments=[]; QU.seen={}; QU.hubAsked=false; if(typeof __qu!=="undefined"&&window.__qu) window.__qu.closeAll(); else { qPickClose(); qLogClose(); qDoneClose(); }
    if(typeof CO!=="undefined"&&CO.on) coStop(); if(typeof RL!=="undefined"&&RL.ui) rlClose();
    if(typeof launchStart==="function") launchStart(); else lsGo("shoot"); if(loaded&&typeof chAttach==="function") chAttach(); }
  function qDemoRestart(){ qPickClose(); qLogClose(); qDoneClose(); qDemoStart(); toast("Fresh demo. Over to the next person."); }
  /* leaving the demo for a real sign-in: reload so the real session and quests come back exactly as saved */
  var qSetWhoBase=lsSetWho; lsSetWho=function(w){ var was=qDemo(); qSetWhoBase(w); if(was&&!(w&&w.demo)){ wipeWorkspace(); try{ localStorage.setItem(LS_KEY, JSON.stringify(lsDB)); }catch(e){} var u=location.href.replace(/([?&])demo(=[^&#]*)?(&|$)/,function(m,a,b,c){ return c?a:""; }); if(u===location.href) location.reload(); else location.replace(u); } };   /* drop ?demo so it doesn't start again */
  function qSkipStep(){ var id=Q.tracked, s=id&&qState(id); if(!s) return; var st0=qSteps(id); for(var i=0;i<st0.length;i++) if(!st0[i].ok){ s.stepDone[i]=true; s.skipped=(s.skipped||0)+1; break; }
    qSave(); qTick(); qHud(); }
  function qFinishCard(){ var fr=photos.filter(function(p){ return !p.research&&!p.uploaded; }).length, pk=qPicks().length, pg=((typeof st!=="undefined"&&st.wsBoard&&st.wsBoard.pages)||[]).length,
      ch=qAll().filter(function(x){ return x.type==="main"&&qIsDone(x.id); }).sort(function(a,b){ return qState(a.id).done-qState(b.id).done; });
    var made=[fr+" frame"+(fr===1?"":"s"), pk+" pick"+(pk===1?"":"s"), pg+" workbook page"+(pg===1?"":"s")]; if(qFolioTop()) made.push("a third of a folio panel");
    var ach=typeof achFinishLine==="function"?achFinishLine():"";
    return '<div class="gd-card q-donecard big q-finish"><span class="k">EVERY QUEST DONE · '+qEsc(qTook().toUpperCase())+'</span><b class="t">That\'s the whole loop</b><p class="q-go">Studium stays open. Keep shooting the Stump, pick and edit more, fill the rest of the folio, hang a bigger show. Everything you learnt today keeps working, and there are more quests to come.</p>'
      +'<div class="q-made">'+made.map(function(m){ return '<span>'+qEsc(m)+'</span>'; }).join("")+'</div>'+ach
      +'<div class="q-rooms"><button class="q-room" data-q-go="scene"><b>Shoot</b><span>More frames, any settings</span></button><button class="q-room" data-q-go="select"><b>Edit</b><span>Your library and the develop room</span></button><button class="q-room" data-q-go="folio"><b>Folio</b><span>Two more thirds to fill</span></button><button class="q-room" data-q-go="gallery"><b>Gallery</b><span>Hang a bigger show</span></button></div>'
      +'<div class="q-fb"><span class="k">THREE QUICK QUESTIONS · OPTIONAL</span>'
      +'<label>What was the best moment?<textarea data-fb="best" rows="2" maxlength="400"></textarea></label>'
      +'<label>Where did you get stuck?<textarea data-fb="stuck" rows="2" maxlength="400"></textarea></label>'
      +'<div class="q-rate"><span>Would you want this in class?</span>'+[1,2,3,4,5].map(function(n){ return '<button data-fb-rate="'+n+'">'+n+'</button>'; }).join("")+'</div>'
      +'<button class="gd-skip q-fbsend" data-q="fbsend">Send answers</button></div>'
      +'<div class="gd-acts"><button class="gd-skip" data-q="restart">Restart demo</button><button class="gd-skip" data-q="board">Your quests</button><button class="gd-go" data-q="explore">KEEP SHOOTING ›</button></div></div>'; }
  document.addEventListener("click",function(e){ var g=e.target.closest&&e.target.closest("[data-q-go]"); if(g){ e.stopPropagation(); qDoneClose(); qGoDest(g.getAttribute("data-q-go")); return; }
    var b=e.target.closest&&e.target.closest("[data-fb-rate]"); if(!b) return; e.stopPropagation();
    Array.prototype.forEach.call(b.parentNode.querySelectorAll("button"),function(x){ x.classList.toggle("on", x===b); }); },true);
  document.addEventListener("keydown",function(e){ if(e.target&&e.target.closest&&e.target.closest(".q-fb")) e.stopPropagation(); },true);
  function qFeedbackSend(){ var el=$("qDone"); if(!el) return; var g=function(k){ var t=el.querySelector('[data-fb="'+k+'"]'); return t?t.value.trim():""; }, r=el.querySelector("[data-fb-rate].on");
    var rec={t:Date.now(), best:g("best"), stuck:g("stuck"), rate:r?+r.getAttribute("data-fb-rate"):null, took:qTook(), quests:qAll().filter(function(x){ return x.type==="main"&&qIsDone(x.id); }).map(function(x){ return x.id; })};
    if(!rec.best&&!rec.stuck&&rec.rate==null){ toast("Nothing to send yet. Skip it if you like."); return; }
    var L=[]; try{ L=JSON.parse(localStorage.getItem(Q_FB_KEY)||"[]"); }catch(e){} L.push(rec); try{ localStorage.setItem(Q_FB_KEY, JSON.stringify(L)); }catch(e){}
    if(typeof Sync!=="undefined"&&Sync.on()) Sync.sendFeedback({body:rec});
    var f=el.querySelector(".q-fb"); if(f) f.innerHTML='<span class="k">THANK YOU</span><p>That really helps.</p>'; }
  if(qDemo()) READ_MS=Math.min(READ_MS,2000);
  if(window.__q){ window.__q.feedback=function(){ try{ return JSON.parse(localStorage.getItem(Q_FB_KEY)||"[]"); }catch(e){ return []; } };
    window.__q.demo={start:qDemoStart, restart:qDemoRestart, skip:qSkipStep, took:qTook, on:qDemo}; }
