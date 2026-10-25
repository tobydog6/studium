  // ================= QUESTS: the student's side =================
  // "What's your focus today?" when you arrive, a card that tracks the quest you chose, a log of every quest, and a moment
  // when one's done. Tools are taught just in time: when the next step needs a tour you haven't done, the card offers it.
  var QU={pick:false, log:false, done:false, moments:[], open:{}, hubAsked:false, seen:{}, wasHub:false, hudHtml:"", hover:false, flashUntil:0, page:null};
  var Q_PAGE_NAMES={artist:"Artist model page", rank:"Rank page", annotate:"Annotate page", contact:"Contact sheet page", experiment:"Experiment page",
    mood:"Mood & ideas page", next:"What's next page", edit:"Before & after page", moodboard:"Moodboard", compare:"Compare page"};
  var Q_TOUR_NAMES={basics:"the warm-up", select:"picking and rejecting", edit:"editing", workbook:"the workbook", folio:"the folio", book:"the book",
    gallery:"the gallery", research:"Research", library:"project folders", lighting:"the lighting rig", artist:"the artist model page"};
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

  // ---- the focus picker ----
  /* one quest, one big full-width button: title and what it asks on the left, how far along and how long on the right */
  function qCard(x, tag, lock){ var p=qProgress(x.id), started=!!qState(x.id), mins=x.mins?x.mins+" MIN":"";
    return '<button class="q-big'+(tag==="SUGGESTED"||tag==="NEXT"||tag==="TRACKING"?' sug':'')+(lock?' lock':'')+'"'+(lock?' disabled':' data-q-pick="'+x.id+'"')+'>'
      +'<span class="q-bl"><span class="q-bk">'+(tag?'<em>'+qEsc(tag)+'</em>':'')+qPillarChip(x)+'</span><b>'+qEsc(x.title)+'</b><span class="q-bp">'+qEsc(lock||x.blurb)+'</span></span>'
      +'<span class="q-br"><span class="q-bn">'+(started?p.done+' / '+p.of:p.of)+'<small>'+(started?'STEPS DONE':p.of===1?'STEP':'STEPS')+'</small></span>'+(mins?'<span class="q-bm">'+mins+'</span>':'')+'<i>›</i></span></button>'; }
  function qPickOpen(){ if(!qMode()) return; var el=gdEl("qPick","gd-pop q-pop"), F=qFoundations().filter(function(f){ return !qIsDone(f.id); }), h;
    if(typeof looking!=="undefined"&&looking){ try{ document.exitPointerLock(); }catch(e){} }
    if(F.length){ var f=F[0], n=qFoundations().length-F.length+1;
      h='<div class="gd-card q-pickcard"><span class="k">FOUNDATION '+n+' OF '+qFoundations().length+'</span><b class="t">What\'s next</b><p>Foundations come first, in order. They open your board.</p><div class="q-list">'+qCard(f, Q.tracked===f.id?"TRACKING":"NEXT")+'</div>'; }
    else { var sug=qSuggest(), open=qAll().filter(function(x){ return x.type==="main"&&!qIsDone(x.id)&&!qLockReason(x); }), locked=qAll().filter(function(x){ return x.type==="main"&&!qIsDone(x.id)&&qLockReason(x)&&Q.boardOpen; });
      open.sort(function(a,b){ var r=function(x){ return x.id===Q.tracked?0:sug&&x.id===sug.id?1:qState(x.id)?2:3; }; return r(a)-r(b); });
      var cards=open.map(function(x){ return qCard(x, x.id===Q.tracked?"TRACKING":sug&&x.id===sug.id?"SUGGESTED":qState(x.id)?"IN PROGRESS":""); }).concat(locked.map(function(x){ return qCard(x, "", qLockReason(x)); }));
      var left=qAll().filter(function(x){ return x.type==="main"&&!qIsDone(x.id); }).length;
      h='<div class="gd-card q-pickcard"><span class="k">YOUR BOARD · '+left+' TO GO</span><b class="t">Choose a quest</b><p>'+(cards.length?'Any order you like. You can switch whenever you want, and your progress is kept.':'Everything on your board is done. Nice work.')+'</p><div class="q-list">'+cards.join("")+'</div>'; }
    h+='<div class="gd-acts"><button class="gd-skip" data-q="skip">Not now</button><button class="gd-skip q-all" data-q="log">See all quests ›</button></div></div>';
    el.innerHTML=h; el.classList.add("show"); QU.pick=true; Q.lastFocusAsk=qToday(); qSave(); qHud(); }
  function qPickClose(){ var el=$("qPick"); if(el) el.classList.remove("show"); QU.pick=false; qHud(); }

  // ---- the tracked quest card (the HUD) ----
  function qHudShow(){ if(!qMode()||QU.pick||QU.log||QU.done) return false; if(App.is("hub")||App.is("signin")||App.is("teacher")||App.is("landing")) return false;
    var hub=$("hub"); if(hub&&!hub.classList.contains("hidden")) return false; if(typeof coActive==="function"&&coActive()) return false; return loaded||(typeof st!=="undefined"&&st.open); }
  function qHud(){ var el=gdEl("qHud","gd-track q-hud"); if(!qHudShow()){ el.classList.remove("show"); return; }
    var id=Q.tracked, x=id&&qGet(id), vf=typeof viewfinderOn!=="undefined"&&viewfinderOn, html;
    if(!x){ html='<button class="q-choose" data-q="pick">CHOOSE YOUR FOCUS ›</button>'; }
    else { var st0=qSteps(id), d=st0.filter(function(s){ return s.ok; }).length, nx=qNextStep(id), how=nx&&nx.tour&&!coTourDone(nx.tour);
      var late=qDemo()&&nx;   /* in the demo any step can be skipped, so nobody gets stuck */
      html='<div class="hd"><span class="k">'+(qDemo()?'<em class="q-tm">'+qTook()+'</em>':'')+qEsc(x.title.toUpperCase())+'</span><span class="fr">'+d+' / '+st0.length+'</span><button data-q="how" title="Show me how">?</button><button class="q-logb" data-q="log" title="All your quests">LOG</button></div>'
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
    else if(kind==="board") QU.moments.push({kind:"board"});
    else if(kind==="finish") QU.moments.push({kind:"finish"}); });
  function qMoment(){ if(QU.done||QU.pick||QU.log||!QU.moments.length) return; if(typeof viewfinderOn!=="undefined"&&viewfinderOn) return; if(typeof coActive==="function"&&coActive()) return;
    var hasBoard=QU.moments.some(function(m){ return m.kind==="board"; }), m=hasBoard?QU.moments.filter(function(m){ return m.kind==="board"; })[0]:QU.moments[0];
    QU.moments=hasBoard?QU.moments.filter(function(x){ return x.kind!=="complete"&&x!==m; }):QU.moments.slice(1);   // the board moment covers the foundation it finished
    if(typeof looking!=="undefined"&&looking){ try{ document.exitPointerLock(); }catch(e){} }
    var el=gdEl("qDone","gd-pop q-pop"), h;
    if(m.kind==="board"&&qSet().finish){
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
            return nf?'<div class="gd-acts"><button class="gd-skip" data-q="closedone">Keep going here</button><button class="gd-go" data-q-pick="'+nf.id+'">NEXT: '+qEsc(nf.title.toUpperCase())+' ›</button></div></div>'
              :'<div class="gd-acts"><button class="gd-skip" data-q="closedone">Keep going here</button><button class="gd-go" data-q="next">WHAT\'S NEXT ›</button></div></div>'; })(); }
    el.innerHTML=h; el.classList.add("show"); QU.done=true; qHud();
    Array.prototype.forEach.call(el.querySelectorAll("[data-q]"),function(b){ readLock(b, Math.min(READ_MS,1500)); }); }
  function qDoneClose(){ var el=$("qDone"); if(el) el.classList.remove("show"); QU.done=false; qHud(); }

  // ---- the quest log ----
  function qStatusWord(id){ return {done:"COMPLETE", active:"IN PROGRESS", "new":"NOT STARTED", locked:"LOCKED"}[qStatus(id)]||""; }
  function qRow(x){ var s=qStatus(x.id), p=qProgress(x.id), open=QU.open[x.id], lock=qLockReason(x), tr=Q.tracked===x.id;
    return '<div class="q-row s-'+s+(open?' open':'')+'"><button class="q-rh" data-q-open="'+x.id+'"><i class="q-dot"></i><b>'+qEsc(x.title)+'</b><span class="q-pils">'+qPillarChip(x)+'</span>'
      +'<span class="q-st">'+(tr?'TRACKING':qStatusWord(x.id))+'</span><span class="q-pr">'+(s==="done"?"✓":p.done+' / '+p.of)+'</span></button>'
      +(open?'<div class="q-body"><p>'+qEsc(x.blurb)+'</p>'+(lock?'<p class="q-lock">'+qEsc(lock)+'</p>':'')
        +qSteps(x.id).map(function(c){ return '<div class="ck'+(c.ok?' ok':'')+'"><i>'+(c.ok?'✓':'')+'</i><span>'+qEsc(c.t)+'</span>'+(c.now?'<em>'+qEsc(c.now)+'</em>':'')+'</div>'; }).join("")
        +(x.page?'<p class="q-mk">Makes: '+qEsc(Q_PAGE_NAMES[x.page]||x.page)+'</p>':'')
        +(!lock&&s!=="done"&&!tr?'<button class="gd-go q-track" data-q-track="'+x.id+'">TRACK THIS QUEST</button>':'')+'</div>':'')+'</div>'; }
  function qLogOpen(){ if(!qMode()) return; qPickClose(); var el=gdEl("qLog","gd-pop q-pop"), t=qTally(), cps=qCheckpoints();
    var tally=["context","craft","environment","drive"].map(function(p){ return '<span class="p-'+p+'"><b>'+PILLARS[p].n+'</b> '+t[p].done+'/'+t[p].of+'</span>'; }).join("");
    var wall=QU.tab==="ach"&&typeof achWallHtml==="function";
    var h='<div class="gd-card q-logcard'+(wall?' wide':'')+'"><div class="q-lh"><div><span class="k">QUEST LOG</span><b class="t">'+(wall?'Achievements':'Your quests')+'</b></div><button class="q-x" data-q="closelog" title="Close">✕</button></div>'
      +(typeof achWallHtml==="function"?'<div class="q-tabs"><button data-q="tabq" class="'+(wall?'':'on')+'">QUESTS</button><button data-q="taba" class="'+(wall?'on':'')+'">ACHIEVEMENTS · '+achCountAll()+' / '+ACH.length+'</button></div>':'');
    if(wall){ el.innerHTML=h+achWallHtml()+'</div>'; el.classList.add("show"); QU.log=true; qHud(); return; }
    h+='<div class="q-tally">'+tally+'</div>';
    h+='<div class="q-sec"><span class="q-sh">FOUNDATIONS</span>'+qFoundations().map(qRow).join("")+'</div>';
    cps.forEach(function(c){ var M=qAll().filter(function(x){ return x.type==="main"&&x.checkpoint===c.id; }); if(!M.length) return;
      h+='<div class="q-sec'+(Q.boardOpen?'':' dim')+'"><span class="q-sh">CHECKPOINT '+c.id.slice(2)+' · '+qEsc(c.name.toUpperCase())+' · '+qDateNice(c.date).toUpperCase()+'</span>'+(Q.boardOpen?'':'<p class="q-lock">Finish the foundations to open your board.</p>')+M.map(qRow).join("")+'</div>'; });
    if(!cps.length){ var B=qAll().filter(function(x){ return x.type==="main"; });
      h+='<div class="q-sec'+(Q.boardOpen?'':' dim')+'"><span class="q-sh">YOUR BOARD'+(qSet().finish?' · FINISH ALL '+(qSet().finish===4?'FOUR':qSet().finish):'')+'</span>'+(Q.boardOpen?'':'<p class="q-lock">Finish the foundations to open your board.</p>')+B.map(qRow).join("")+'</div>'; }
    if(qDemo()) h+='<div class="q-demo"><span>DEMO · '+qTook()+'</span><button class="gd-skip" data-q="restart">Restart demo</button></div>';
    var S=qAll().filter(function(x){ return x.type==="side"; }); if(S.length) h+='<div class="q-sec"><span class="q-sh">SIDE QUESTS</span>'+S.map(qRow).join("")+'</div>';
    el.innerHTML=h+'</div>'; el.classList.add("show"); QU.log=true; qHud(); }
  function qLogClose(){ var el=$("qLog"); if(el) el.classList.remove("show"); QU.log=false; qHud(); }

  // ---- clicks ----
  document.addEventListener("click",function(e){ var t=e.target.closest&&e.target.closest("[data-q],[data-q-pick],[data-q-open],[data-q-track]"); if(!t) return; e.stopPropagation();
    if(t.hasAttribute("data-q-pick")){ var id=t.getAttribute("data-q-pick"); qPickClose(); qLogClose(); qDoneClose(); if(qTrack(id)){ qFlash(8000); QU.seen[id]=qSteps(id).map(function(s){ return s.ok; }); qGoQuest(id); } return; }
    if(t.hasAttribute("data-q-open")){ var k=t.getAttribute("data-q-open"); QU.open[k]=!QU.open[k]; qLogOpen(); return; }
    if(t.hasAttribute("data-q-track")){ var id2=t.getAttribute("data-q-track"); qLogClose(); if(qTrack(id2)){ qFlash(8000); qGoQuest(id2); } return; }
    var a=t.getAttribute("data-q");
    if(a==="tabq"||a==="taba"){ QU.tab=a==="taba"?"ach":"q"; qLogOpen(); return; }
    if(a==="skip"){ qPickClose(); return; } if(a==="log"){ qLogOpen(); return; } if(a==="closelog"){ qLogClose(); return; }
    if(a==="pick"){ qPickOpen(); return; } if(a==="how"){ qHow(); return; }
    if(a==="closedone"){ qDoneClose(); return; } if(a==="restart"){ qDemoRestart(); return; } if(a==="explore"){ qDoneClose(); qPickOpen(); return; }
    if(a==="skipstep"){ qSkipStep(); return; } if(a==="fbsend"){ qFeedbackSend(); return; } if(a==="next"){ qDoneClose(); qPickOpen(); return; } },true);
  window.addEventListener("keydown",function(e){ if(e.code!=="Escape") return; if(QU.log){ e.preventDefault(); e.stopImmediatePropagation(); qLogClose(); } else if(QU.pick){ e.preventDefault(); e.stopImmediatePropagation(); qPickClose(); } },true);

  // ---- the hub and the nav bar follow the tracked quest ----
  function qHubRender(h){ if(!qMode()||qPlanLive()) return; var x=Q.tracked&&qGet(Q.tracked), p=x&&qProgress(x.id);
    h.querySelector(".h6-eb").textContent=x?"YOUR FOCUS":"CHOOSE YOUR FOCUS";
    h.querySelector(".h6-h").textContent=(x?x.title:"What's your focus today?")+(x?".":"");
    h.querySelector(".h6-words").textContent=x?x.blurb:"Pick a quest to track. You can switch any time.";
    var cta=h.querySelector(".h6-cta"); cta.innerHTML=(x?"CARRY ON":"CHOOSE A QUEST")+' <kbd>↵</kbd>';
    h.querySelector(".h6-status").textContent=x?p.done+" OF "+p.of+" STEPS":"";
    var qb=h.querySelector(".h6-quests"); if(!qb){ qb=document.createElement("button"); qb.className="h6-quests"; qb.setAttribute("data-q","log"); var act=h.querySelector(".d7-act"); if(act) act.appendChild(qb); }
    qb.textContent="YOUR QUESTS ›"; }
  function qHubGo(){ if(Q.tracked&&!qIsDone(Q.tracked)) qGoQuest(Q.tracked); else qPickOpen(); }
  function qNavTask(task){ if(!qMode()||qPlanLive()) return false; var x=Q.tracked&&qGet(Q.tracked);
    if(x){ var p=qProgress(x.id); task.innerHTML='<i></i><span class="t">'+qEsc(x.title)+'</span><span class="n">· '+p.done+' / '+p.of+'</span>'; } else task.innerHTML='<i></i><span class="t">Choose your focus</span>';
    task.classList.remove("empty"); task.setAttribute("data-q", x?"log":"pick"); return true; }

  // ---- the loop ----
  setInterval(function(){ if(!qMode()){ document.body.classList.remove("q-on"); ["qHud","qPick","qLog","qDone"].forEach(function(k){ var e=$(k); if(e) e.classList.remove("show"); }); return; }
    var hub=$("hub"), atHub=App.is("hub")&&hub&&!hub.classList.contains("hidden");
    if(atHub&&!QU.wasHub) QU.hubAsked=false; QU.wasHub=atHub;
    if(atHub&&!QU.pick&&!QU.log&&!QU.done&&!qPlanLive()&&!(typeof lsMoveOpen==="function"&&lsMoveOpen())&&(Q.lastFocusAsk!==qToday()||(!Q.tracked&&!QU.hubAsked))){ QU.hubAsked=true; qPickOpen(); }
    qMoment(); qAutoTour(); qHud(); document.body.classList.toggle("q-on", true); }, 700);
  /* seamless: when the step you're on needs a tour you haven't done, it starts by itself (foundations, and the whole demo) */
  QU.auto={};
  var Q_NOAUTO=/[?&]noauto/.test(location.search);   /* scripted tests drive the tours themselves */
  function qAutoTour(){ if(Q_NOAUTO) return; var id=Q.tracked, x=id&&qGet(id); if(!x||!(qDemo()||x.type==="foundation")) return;
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
    lsGo("shoot"); if(loaded&&typeof chAttach==="function") chAttach(); }
  function qDemoRestart(){ qPickClose(); qLogClose(); qDoneClose(); qDemoStart(); toast("Fresh demo. Over to the next person."); }
  /* leaving the demo for a real sign-in: reload so the real session and quests come back exactly as saved */
  var qSetWhoBase=lsSetWho; lsSetWho=function(w){ var was=qDemo(); qSetWhoBase(w); if(was&&!(w&&w.demo)){ wipeWorkspace(); try{ localStorage.setItem(LS_KEY, JSON.stringify(lsDB)); }catch(e){} var u=location.href.replace(/([?&])demo(=[^&#]*)?(&|$)/,function(m,a,b,c){ return c?a:""; }); if(u===location.href) location.reload(); else location.replace(u); } };   /* drop ?demo so it doesn't start again */
  function qSkipStep(){ var id=Q.tracked, s=id&&qState(id); if(!s) return; var st0=qSteps(id); for(var i=0;i<st0.length;i++) if(!st0[i].ok){ s.stepDone[i]=true; s.skipped=(s.skipped||0)+1; break; }
    qSave(); qTick(); qHud(); }
  function qFinishCard(){ var fr=photos.filter(function(p){ return !p.research&&!p.uploaded; }).length, pk=qPicks().length, pg=((typeof st!=="undefined"&&st.wsBoard&&st.wsBoard.pages)||[]).length,
      ch=qAll().filter(function(x){ return x.type==="main"&&qIsDone(x.id); }).sort(function(a,b){ return qState(a.id).done-qState(b.id).done; });
    var made=[fr+" frame"+(fr===1?"":"s"), pk+" pick"+(pk===1?"":"s"), pg+" workbook page"+(pg===1?"":"s")]; if(qFolioTop()) made.push("a third of a folio panel");
    var ach=typeof achFinishLine==="function"?achFinishLine():"";
    return '<div class="gd-card q-donecard big q-finish"><span class="k">DEMO · DONE IN '+qEsc(qTook().toUpperCase())+'</span><b class="t">Now go and shoot more</b><p class="q-go">Your folder is ready. Head back out, take more photos, and load them into it. Everything you learnt today works on them.</p>'
      +'<p>You shot a real place, chose and edited your best, then picked your own way in: '+ch.map(function(x){ return '<b>'+qEsc(x.title)+'</b>'; }).join(" then ")+'. In class, the board keeps going all term.</p>'
      +'<div class="q-made">'+made.map(function(m){ return '<span>'+qEsc(m)+'</span>'; }).join("")+'</div>'+ach
      +'<div class="q-fb"><span class="k">THREE QUICK QUESTIONS · OPTIONAL</span>'
      +'<label>What was the best moment?<textarea data-fb="best" rows="2" maxlength="400"></textarea></label>'
      +'<label>Where did you get stuck?<textarea data-fb="stuck" rows="2" maxlength="400"></textarea></label>'
      +'<div class="q-rate"><span>Would you want this in class?</span>'+[1,2,3,4,5].map(function(n){ return '<button data-fb-rate="'+n+'">'+n+'</button>'; }).join("")+'</div>'
      +'<button class="gd-skip q-fbsend" data-q="fbsend">Send answers</button></div>'
      +'<div class="gd-acts"><button class="gd-skip" data-q="restart">Restart demo</button><button class="gd-go" data-q="explore">KEEP EXPLORING ›</button></div></div>'; }
  document.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("[data-fb-rate]"); if(!b) return; e.stopPropagation();
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
