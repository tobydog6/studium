  // ================= QUESTS: the student's side =================
  // "What's your focus today?" when you arrive, a card that tracks the quest you chose, a log of every quest, and a moment
  // when one's done. Tools are taught just in time: when the next step needs a tour you haven't done, the card offers it.
  var QU={pick:false, log:false, done:false, moments:[], open:{}, hubAsked:false, seen:{}, wasHub:false, hudHtml:"", hover:false, flashUntil:0, page:null};
  var Q_PAGE_NAMES={artist:"Artist model page", rank:"Rank page", annotate:"Annotate page", contact:"Contact sheet page", experiment:"Experiment page",
    mood:"Mood & ideas page", next:"What's next page", edit:"Before & after page", moodboard:"Moodboard"};
  var Q_TOUR_NAMES={basics:"the warm-up", select:"picking and rejecting", edit:"editing", workbook:"the workbook", folio:"the folio", book:"the book",
    gallery:"the gallery", research:"Research", library:"project folders", lighting:"the lighting rig"};
  function qMode(){ if(typeof GD!=="undefined"&&GD.demo&&GD.step>=0) return false; var w=typeof lsWho==="function"?lsWho():null; return !!w&&!w.demo&&w.role!=="teacher"; }
  function qToday(){ var d=new Date(); return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2); }
  function qPlanLive(){ var pl=typeof lsPlan==="function"&&lsPlan(); if(!pl) return false; var c=lsCur(pl); return c.i>=0&&c.i<pl.phases.length; }
  function qEsc(s){ return cbEsc(String(s==null?"":s)); }
  function qPillars(x){ return x.pillars||[x.pillar]; }
  function qPillarChip(x){ return qPillars(x).map(function(p){ return '<span class="q-pil p-'+p+'">'+((PILLARS[p]||{}).n||p).toUpperCase()+'</span>'; }).join(""); }
  function qDateNice(iso){ var d=new Date(iso+"T12:00:00"); return d.getDate()+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]; }
  function qCpLine(x){ var c=qCp(x.checkpoint); return c?"Checkpoint "+c.id.slice(2)+" · "+c.name+" · "+qDateNice(c.date):""; }
  // how far along each pillar is: required quests done out of required
  function qTally(){ var t={}; ["context","craft","environment","drive"].forEach(function(p){ t[p]={done:0, of:0}; });
    qAll().forEach(function(x){ if(x.type==="side") return; qPillars(x).forEach(function(p){ if(!t[p]) return; t[p].of++; if(qIsDone(x.id)) t[p].done++; }); }); return t; }
  // the suggestion: the next foundation; else the nearest checkpoint's unfinished quests, weakest pillar first, started first
  function qSuggest(){ var F=qFoundations().filter(function(f){ return !qIsDone(f.id); }); if(F.length) return F[0];
    var t=qTally(), frac=function(x){ return Math.min.apply(null, qPillars(x).map(function(p){ var a=t[p]; return a&&a.of?a.done/a.of:1; })); };
    var cps=qCheckpoints(); for(var i=0;i<cps.length;i++){ var c=qAll().filter(function(x){ return x.type==="main"&&x.checkpoint===cps[i].id&&!qIsDone(x.id)&&!qLockReason(x); });
      if(c.length){ c.sort(function(a,b){ return (frac(a)-frac(b))||((qState(b.id)?1:0)-(qState(a.id)?1:0)); }); return c[0]; } }
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
  function qCard(x, tag){ var p=qProgress(x.id), started=!!qState(x.id), cp=x.type==="main"?qCpLine(x):"";
    return '<button class="q-card'+(tag?' sug':'')+'" data-q-pick="'+x.id+'">'+(tag?'<span class="q-tag">'+tag+'</span>':'')
      +'<span class="q-pils">'+qPillarChip(x)+'</span><b>'+qEsc(x.title)+'</b><p>'+qEsc(x.blurb)+'</p>'
      +'<span class="q-meta"><span>'+(started?p.done+' / '+p.of+' steps':p.of+' steps')+'</span>'+(cp?'<span>'+qEsc(cp)+'</span>':'')+(x.page?'<span>Makes: '+qEsc(Q_PAGE_NAMES[x.page]||x.page)+'</span>':'')+'</span></button>'; }
  function qPickOpen(){ if(!qMode()) return; var el=gdEl("qPick","gd-pop q-pop"), F=qFoundations().filter(function(f){ return !qIsDone(f.id); }), cards=[], h;
    if(typeof looking!=="undefined"&&looking){ try{ document.exitPointerLock(); }catch(e){} }
    if(F.length){ var f=F[0], n=qFoundations().length-F.length+1;
      h='<div class="gd-card q-pickcard"><span class="k">WHAT\'S YOUR FOCUS TODAY?</span><b class="t">Foundation '+n+' of '+qFoundations().length+'</b><p>Foundations come first, in order. This unlocks your board.</p><div class="q-cards one">'+qCard(f, Q.tracked===f.id?"TRACKING":"NEXT")+'</div>'; }
    else { var sug=qSuggest(); if(sug) cards.push(qCard(sug, "SUGGESTED"));
      qAll().filter(function(x){ return qState(x.id)&&!qIsDone(x.id)&&!qLockReason(x)&&(!sug||x.id!==sug.id); }).slice(0,sug?3:4).forEach(function(x){ cards.push(qCard(x, Q.tracked===x.id?"TRACKING":"IN PROGRESS")); });
      if(!cards.length){ qAll().filter(function(x){ return !qIsDone(x.id)&&!qLockReason(x); }).slice(0,4).forEach(function(x){ cards.push(qCard(x)); }); }
      h='<div class="gd-card q-pickcard"><span class="k">WHAT\'S YOUR FOCUS TODAY?</span><b class="t">Choose a quest</b><p>'+(cards.length?'Pick one to track. You can switch any time, and your progress on every quest is kept.':'Everything on your board is done. Nice work.')+'</p><div class="q-cards">'+cards.join("")+'</div>'; }
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
      html='<div class="hd"><span class="k">'+(x.type==="foundation"?"FOUNDATION · ":"QUEST · ")+qEsc(x.title.toUpperCase())+'</span><span class="fr">'+d+' / '+st0.length+'</span><button data-q="how" title="Show me how">?</button><button class="q-logb" data-q="log" title="All your quests">LOG</button></div>'
        +'<div class="q-sub">'+qPillarChip(x)+(x.type==="main"?'<span>'+qEsc(qCpLine(x))+'</span>':'')+'</div>'
        +st0.map(function(c){ return '<div class="ck'+(c.ok?' ok':'')+'"><i>'+(c.ok?'✓':'')+'</i><span>'+qEsc(c.t)+'</span>'+(c.now?'<em>'+qEsc(c.now)+'</em>':'')+'</div>'; }).join("")
        +(how?'<button class="q-how" data-q="how">Show me how: '+qEsc(Q_TOUR_NAMES[nx.tour]||nx.tour)+' ›</button>':'')
        +'<div class="bar"><b style="width:'+(d/st0.length*100).toFixed(0)+'%"></b></div>'; }
    if(el._html!==html){ el.innerHTML=html; el._html=html; }
    var mini=!x||(!QU.hover&&Date.now()>QU.flashUntil);
    el.classList.toggle("min", mini&&!!x); el.classList.toggle("chip", vf); el.classList.add("show"); }
  (function(){ var el=gdEl("qHud","gd-track q-hud"); el.addEventListener("mouseenter",function(){ QU.hover=true; qHud(); }); el.addEventListener("mouseleave",function(){ QU.hover=false; setTimeout(qHud,1200); }); })();
  function qFlash(ms){ QU.flashUntil=Date.now()+(ms||6000); qHud(); }

  // ---- moments: a step ticks, a quest's done, the board opens ----
  qOn(function(kind,data){ if(!qMode()) return;
    if(kind==="step"){ var st0=data.steps, prev=QU.seen[data.id]||[]; st0.forEach(function(s,i){ if(s.ok&&!prev[i]) toast("✓ "+s.t); }); QU.seen[data.id]=st0.map(function(s){ return s.ok; }); qFlash(); }
    else if(kind==="complete") QU.moments.push({kind:"complete", id:data.id});
    else if(kind==="board") QU.moments.push({kind:"board"}); });
  function qMoment(){ if(QU.done||QU.pick||QU.log||!QU.moments.length) return; if(typeof viewfinderOn!=="undefined"&&viewfinderOn) return; if(typeof coActive==="function"&&coActive()) return;
    var hasBoard=QU.moments.some(function(m){ return m.kind==="board"; }), m=hasBoard?QU.moments.filter(function(m){ return m.kind==="board"; })[0]:QU.moments[0];
    QU.moments=hasBoard?QU.moments.filter(function(x){ return x.kind!=="complete"&&x!==m; }):QU.moments.slice(1);   // the board moment covers the foundation it finished
    if(typeof looking!=="undefined"&&looking){ try{ document.exitPointerLock(); }catch(e){} }
    var el=gdEl("qDone","gd-pop q-pop"), h;
    if(m.kind==="board"){ var cps=qCheckpoints();
      h='<div class="gd-card q-donecard big"><span class="k">FOUNDATIONS DONE</span><b class="t">Your board is open</b><p>From here, you choose. Main quests count toward your checkpoints, and you can switch between them any time.</p>'
        +'<div class="q-cps">'+cps.map(function(c){ return '<span><b>Checkpoint '+c.id.slice(2)+'</b>'+qEsc(c.name)+' · '+qDateNice(c.date)+'</span>'; }).join("")+'</div>'
        +'<div class="gd-acts"><button class="gd-skip" data-q="closedone">Later</button><button class="gd-go" data-q="next">CHOOSE YOUR FOCUS ›</button></div></div>'; }
    else { var x=qGet(m.id), F=qFoundations(), fd=F.filter(function(f){ return qIsDone(f.id); }).length;
      h='<div class="gd-card q-donecard"><span class="k">QUEST COMPLETE</span><b class="t">'+qEsc(x.title)+'</b><div class="q-pils">'+qPillarChip(x)+'</div>'
        +'<p>'+(x.page?'You made: '+qEsc(Q_PAGE_NAMES[x.page]||x.page)+'. ':'')+(x.type==="foundation"?'Foundation '+fd+' of '+F.length+' done.':'One more toward '+qEsc(qCpLine(x)||"your board")+'.')+'</p>'
        +'<div class="gd-acts"><button class="gd-skip" data-q="closedone">Keep going here</button><button class="gd-go" data-q="next">WHAT\'S NEXT ›</button></div></div>'; }
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
    var h='<div class="gd-card q-logcard"><div class="q-lh"><div><span class="k">QUEST LOG</span><b class="t">Your quests</b></div><button class="q-x" data-q="closelog" title="Close">✕</button></div><div class="q-tally">'+tally+'</div>';
    h+='<div class="q-sec"><span class="q-sh">FOUNDATIONS</span>'+qFoundations().map(qRow).join("")+'</div>';
    cps.forEach(function(c){ var M=qAll().filter(function(x){ return x.type==="main"&&x.checkpoint===c.id; }); if(!M.length) return;
      h+='<div class="q-sec'+(Q.boardOpen?'':' dim')+'"><span class="q-sh">CHECKPOINT '+c.id.slice(2)+' · '+qEsc(c.name.toUpperCase())+' · '+qDateNice(c.date).toUpperCase()+'</span>'+(Q.boardOpen?'':'<p class="q-lock">Finish the foundations to open your board.</p>')+M.map(qRow).join("")+'</div>'; });
    var S=qAll().filter(function(x){ return x.type==="side"; }); if(S.length) h+='<div class="q-sec"><span class="q-sh">SIDE QUESTS</span>'+S.map(qRow).join("")+'</div>';
    el.innerHTML=h+'</div>'; el.classList.add("show"); QU.log=true; qHud(); }
  function qLogClose(){ var el=$("qLog"); if(el) el.classList.remove("show"); QU.log=false; qHud(); }

  // ---- clicks ----
  document.addEventListener("click",function(e){ var t=e.target.closest&&e.target.closest("[data-q],[data-q-pick],[data-q-open],[data-q-track]"); if(!t) return; e.stopPropagation();
    if(t.hasAttribute("data-q-pick")){ var id=t.getAttribute("data-q-pick"); qPickClose(); qLogClose(); if(qTrack(id)){ qFlash(8000); QU.seen[id]=qSteps(id).map(function(s){ return s.ok; }); qGoQuest(id); } return; }
    if(t.hasAttribute("data-q-open")){ var k=t.getAttribute("data-q-open"); QU.open[k]=!QU.open[k]; qLogOpen(); return; }
    if(t.hasAttribute("data-q-track")){ var id2=t.getAttribute("data-q-track"); qLogClose(); if(qTrack(id2)){ qFlash(8000); qGoQuest(id2); } return; }
    var a=t.getAttribute("data-q");
    if(a==="skip"){ qPickClose(); return; } if(a==="log"){ qLogOpen(); return; } if(a==="closelog"){ qLogClose(); return; }
    if(a==="pick"){ qPickOpen(); return; } if(a==="how"){ qHow(); return; }
    if(a==="closedone"){ qDoneClose(); return; } if(a==="next"){ qDoneClose(); qPickOpen(); return; } },true);
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
  setInterval(function(){ if(!qMode()){ ["qHud","qPick","qLog","qDone"].forEach(function(k){ var e=$(k); if(e) e.classList.remove("show"); }); return; }
    var hub=$("hub"), atHub=App.is("hub")&&hub&&!hub.classList.contains("hidden");
    if(atHub&&!QU.wasHub) QU.hubAsked=false; QU.wasHub=atHub;
    if(atHub&&!QU.pick&&!QU.log&&!QU.done&&!qPlanLive()&&!(typeof lsMoveOpen==="function"&&lsMoveOpen())&&(Q.lastFocusAsk!==qToday()||(!Q.tracked&&!QU.hubAsked))){ QU.hubAsked=true; qPickOpen(); }
    qMoment(); qHud(); }, 700);
  if(/[?&]dev/.test(location.search)){ window.__qu={ state:function(){ var el=$("qHud"); return {mode:qMode(), pick:QU.pick, log:QU.log, done:QU.done, hud:!!(el&&el.classList.contains("show")), mini:!!(el&&el.classList.contains("min")), moments:QU.moments.length, suggest:(qSuggest()||{}).id||null, how:!!(el&&el.querySelector(".q-how"))}; },
    pick:qPickOpen, log:qLogOpen, how:qHow, closeAll:function(){ qPickClose(); qLogClose(); qDoneClose(); } }; }

  // the hub's "today" and the nav bar's task show the tracked quest when there's no live lesson plan
  var qHubBase=hubRender; hubRender=function(){ qHubBase.apply(this,arguments); var h=$("hub"); if(h) qHubRender(h); };
  var qNavBase=navScene; navScene=function(){ qNavBase.apply(this,arguments); var t=$("navTask"); if(t&&App.is("scene")) qNavTask(t); };
