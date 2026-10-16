  // ================= LESSON: the teacher's plan for the period, and the student's side of it =================
  // A plan is a run of phases for one period. Each phase says what students do, the teacher's own words, which
  // place it opens, what "done" means (a count of shots, picks, edits, pages or book frames) and what happens when
  // time is up (a nudge they can stay through, or everyone moves). Students get a heads-up pill two minutes before a
  // change and a move-on card at the change, with a minute to finish the shot they're on.
  // Everything lives in localStorage ("studium_v1") on this computer; Sync (sync.js) mirrors it to Supabase when a
  // school is connected.
  var LS_KEY="studium_v1";
  var LS_PLACES={shoot:"Shoot", select:"Select", edit:"Edit", workshop:"Workshop", folio:"Folio", book:"Book", gallery:"Gallery", punctum:"Punctum"};
  var LS_KIND={shoot:"shots", select:"picks", edit:"edits", workshop:"pages", folio:"picks", book:"book", gallery:"none", punctum:"none"};
  var LS_UNIT={shots:["frame shot","frames shot"], picks:["frame picked","frames picked"], edits:["frame edited","frames edited"], pages:["page made","pages made"], book:["frame in the book","frames in the book"], none:["",""]};
  var LS_VERB={shots:"SHOOT", picks:"PICK", edits:"EDIT", pages:"MAKE", book:"PLACE"};
  var LS_WORDS=["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve"];
  var LS_TEMPLATES={
    shoot:{name:"Shoot day", phases:[
      {title:"Shoot the place", does:"Shoot The Stump, all the way round", words:"Shoot it from places nobody else stands.", opens:"shoot", n:20, dur:30},
      {title:"First look", does:"Pick your five strongest frames", words:"Pick with your gut first, then check.", opens:"select", n:5, dur:15},
      {title:"Edit one", does:"Edit one of your picks", words:"Small moves, then stop.", opens:"edit", n:1, dur:15}]},
    edit:{name:"Edit day", phases:[
      {title:"Pick five", does:"Finish your Stump picks", words:"Pick the frames that feel uneasy.", opens:"select", n:5, dur:20},
      {title:"Edit two", does:"Edit two of your picks", words:"Edit for mood, not for correctness.", opens:"edit", n:2, dur:20},
      {title:"Critique", does:"Read each other's work in Punctum", words:"Say what you see before what you think.", opens:"punctum", n:0, dur:20, firm:true}]},
    critique:{name:"Critique day", phases:[
      {title:"Make a page", does:"Build a workshop page from your picks", words:"Show your thinking, not just your best frame.", opens:"workshop", n:1, dur:15},
      {title:"Critique", does:"Critique in Punctum", words:"Say what you see before what you think.", opens:"punctum", n:0, dur:30, firm:true},
      {title:"Respond", does:"Answer the critique on a second page", words:"What will you try next time?", opens:"workshop", n:2, dur:15}]}
  };

  var lsDB=lsLoad(), lsClockOff=0;
  function lsLoad(){ var d; try{ d=JSON.parse(localStorage.getItem(LS_KEY)); }catch(e){} d=d||{}; d.classes=d.classes||{}; d.plans=d.plans||{}; d.notes=d.notes||{}; return d; }
  function lsSave(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(lsDB)); }catch(e){} if(typeof Sync!=="undefined") Sync.dirty(); }
  function lsNow(){ return new Date(Date.now()+lsClockOff); }
  function lsToday(d){ d=d||lsNow(); return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2); }
  function lsMinOf(d){ return d.getHours()*60+d.getMinutes()+d.getSeconds()/60; }
  function lsHM(m){ m=Math.round(m); var h=Math.floor(m/60)%24, mm=m%60; return h+":"+("0"+mm).slice(-2); }
  function lsWord(n){ return LS_WORDS[n]||String(n); }
  function lsUid(){ return Math.random().toString(36).slice(2,8); }
  function lsCode(){ var A="ABCDEFGHJKMNPQRSTUVWXYZ23456789", s=""; for(var i=0;i<6;i++) s+=A[Math.floor(Math.random()*A.length)]; return s; }

  // ---- who is at this computer ----
  function lsWho(){ return lsDB.who||null; }
  function lsRole(){ var w=lsWho(); return w?w.role:null; }
  function lsClass(){ var w=lsWho(); return w&&w.code?lsDB.classes[w.code]||null:null; }
  function lsInitials(name){ var p=String(name||"?").trim().split(/\s+/); return ((p[0]||"?")[0]+(p.length>1?p[p.length-1][0]:"")).toUpperCase(); }
  function lsSetWho(w){ lsDB.who=w; if(w&&w.name&&w.role==="student"){ studentName=w.name; var nm=$("mName"); if(nm) nm.value=w.name; } lsSave(); ls.phase=null; ls.pending=-1; lsHideMove(); lsHidePill(); }

  // ---- plans ----
  function lsNewPlan(cls, tpl){ var T=LS_TEMPLATES[tpl||"edit"];
    return {code:cls.code, date:lsToday(), start:cls.start||640, tpl:tpl||"edit", paused:null, sent:false,
      phases:T.phases.map(function(p){ var q={id:lsUid(), title:p.title, does:p.does, words:p.words, opens:p.opens, n:p.n, dur:p.dur, firm:!!p.firm}; return q; })}; }
  function lsPlanFor(code){ var p=code&&lsDB.plans[code]; return p&&p.sent&&p.date===lsToday()?p:null; }
  function lsPlan(){ var w=lsWho(); return w&&w.role==="student"?lsPlanFor(w.code):null; }
  function lsKind(ph){ return ph.opens==="folio"?"picks":LS_KIND[ph.opens]||"none"; }
  function lsTotal(pl){ return pl.phases.reduce(function(a,p){ return a+p.dur; },0); }
  function lsTimes(pl){ var t=pl.start; return pl.phases.map(function(p){ var r={s:t, e:t+p.dur}; t+=p.dur; return r; }); }
  function lsNowMin(pl, clock){ if(pl&&pl.paused) return lsMinOf(new Date(pl.paused)); return clock!=null?clock:lsMinOf(lsNow()); }
  // where the period is: i = phase index (-1 before it starts, n after it ends), left = minutes left in the phase
  function lsCur(pl, clock){ var now=lsNowMin(pl, clock), T=lsTimes(pl), n=pl.phases.length;
    if(!n||now<T[0].s) return {i:-1, now:now, left:n?T[0].s-now:0, T:T};
    for(var i=0;i<n;i++){ if(now<T[i].e) return {i:i, now:now, left:T[i].e-now, ph:pl.phases[i], next:pl.phases[i+1]||null, T:T}; }
    return {i:n, now:now, left:0, T:T}; }
  // teacher controls during class
  function lsPlus5(pl, clock){ var c=lsCur(pl, clock); if(c.i<0||c.i>=pl.phases.length) return; pl.phases[c.i].dur+=5; lsSave(); }
  function lsTogglePause(pl){ if(pl.paused){ var gone=(Date.now()-pl.paused)/60000, c; pl.paused=null; c=lsCur(pl); var i=Math.max(0,Math.min(pl.phases.length-1,c.i)); pl.phases[i].dur+=gone; } else pl.paused=Date.now(); lsSave(); }
  function lsMoveOn(pl, clock){ var c=lsCur(pl, clock); if(c.i<0){ pl.start=Math.floor(c.now); } else if(c.i<pl.phases.length){ pl.phases[c.i].dur=Math.max(0.1, c.now-c.T[c.i].s); } lsSave(); }

  // ---- what a student has done (whole session, so it never goes backwards) ----
  function lsCount(kind){ if(kind==="shots") return photos.filter(function(p){ return !p.uploaded&&!p.copy&&!(p.edited&&!p.orig); }).length;
    if(kind==="picks") return stPicks().length;
    if(kind==="edits") return photos.filter(function(p){ return p.edited; }).length;
    if(kind==="pages"){ var d=st.wsBoard; return d?d.pages.filter(function(p){ return p.items.length; }).length:0; }
    if(kind==="book"){ var u={}; (bk.pages||[]).forEach(function(pg){ pg.imgs.forEach(function(id){ if(stById(id)>=0) u[id]=1; }); }); return Object.keys(u).length; }
    return 0; }
  function lsDone(ph){ var k=lsKind(ph); return k!=="none"&&ph.n>0&&lsCount(k)>=ph.n; }
  // with no teacher's plan, a self-paced run through the whole workflow
  function lsSoloSteps(){ var place=(window.SPLAT_SCENES&&SPLAT_SCENES[0]&&SPLAT_SCENES[0].name)||"a location";
    return [{title:"Shoot "+place, does:"Shoot "+place, words:"Walk all the way round before you shoot anything.", opens:"shoot", n:12},
      {title:"Pick five", does:"Pick your five strongest frames", words:"Pick the frames that make you look twice.", opens:"select", n:5},
      {title:"Edit two", does:"Edit two of your picks", words:"Edit for mood, not for correctness.", opens:"edit", n:2},
      {title:"Make a workshop page", does:"Make a workshop page from your picks", words:"Show your thinking, not just your best frame.", opens:"workshop", n:1},
      {title:"Lay out the book", does:"Put six frames in your book", words:"Pairs matter. Think in spreads.", opens:"book", n:6}]; }
  function lsCta(ph){ var k=lsKind(ph), have=lsCount(k), r=ph.n-have;
    if(k==="none"||ph.n<=0) return "OPEN "+LS_PLACES[ph.opens].toUpperCase();
    if(r<=0) return ph.opens==="shoot"?"KEEP SHOOTING":"OPEN "+LS_PLACES[ph.opens].toUpperCase();
    if(ph.opens==="shoot"&&!loaded) return "GO SHOOT";
    return LS_VERB[k]+" "+(r===1?"ONE":lsWord(r).toUpperCase())+" MORE"; }

  // ---- go to the place a phase opens ----
  function lsAt(o){ if(o==="shoot") return App.is("scene")||App.is("viewfinder")||App.is("back")||App.is("bag")||App.is("landing");
    if(o==="punctum") return App.is("punctum"); return App.state==="studio."+o; }
  function lsGo(o){ lsHideMove(); ls.pending=-1; ls.graceUntil=0;
    if(typeof cbOpen!=="undefined"&&cbOpen) closeBack(false); if(bg.open) closeBag();
    if(o==="shoot"){ if(st.open){ stHideLegacy(); st.open=false; $("studioX").classList.add("hidden"); }
      ["hub","punctum","teacher"].forEach(hubHide);
      if(loaded){ hubShow("hud"); App.go("scene"); updatePrompt(); }
      else { var sc=(window.SPLAT_SCENES||[])[0]; if(sc){ App.go("landing"); loadBundled(sc); } else openSplatViewer(); } return; }
    if(o==="punctum"){ if(st.open){ stHideLegacy(); st.open=false; $("studioX").classList.add("hidden"); } if(viewfinderOn) lowerCamera(); hubHide("hud"); openPunctum(); return; }
    if(o==="hub"){ if(st.open) closeStudio(); showHub(); return; }
    hubHide("hub"); hubHide("punctum"); openStudio(o); }

  // ---- the student's side: heads-up pill and move-on card ----
  var ls={phase:null, pending:-1, cardAt:0, graceUntil:0, stay:false, pill:false};
  function lsPillHTML(pl,c){ var nx=c.next, k=lsKind(c.ph), m=Math.max(1,Math.ceil(c.left)), prog="";
    if(k!=="none"&&c.ph.n>0) prog='<span class="pg">· '+Math.min(lsCount(k),c.ph.n)+' / '+c.ph.n+' '+(k==="shots"?"SHOT":k==="picks"?"PICKED":k==="edits"?"EDITED":"DONE")+'</span>';
    return '<i class="ring"></i><span class="k">'+m+' MIN</span><span class="sep"></span><span class="t">Then <em>'+cbEsc(nx.does.charAt(0).toLowerCase()+nx.does.slice(1))+'</em></span>'+prog; }
  function lsShowPill(pl,c){ var p=$("lsPill"); if(!p) return; p.innerHTML=lsPillHTML(pl,c); if(!ls.pill){ ls.pill=true; p.classList.add("show"); } }
  function lsHidePill(){ var p=$("lsPill"); if(p&&ls.pill){ ls.pill=false; p.classList.remove("show"); } }
  function lsMoveHTML(pl,c){ var ph=c.ph, i=c.i, n=pl.phases.length, cls=lsDB.classes[pl.code]||{}, T=c.T, prev=pl.phases[i-1], rows="", fin="";
    if(prev){ var pk=lsKind(prev), ph_=lsCount(pk), ok=lsDone(prev);
      rows+='<div class="row'+(ok?' done':'')+'"><span class="b">'+(ok?'✓':'○')+'</span><span class="tt">'+cbEsc(prev.title)+'</span><span class="r">'+(pk!=="none"&&prev.n?Math.min(ph_,prev.n)+' / '+prev.n+(ok?'':' · YOU CAN FINISH IT IN '+LS_PLACES[ph.opens].toUpperCase()):'')+'</span></div>'; }
    rows+='<div class="row cur"><span class="b">●</span><span class="tt">'+cbEsc(ph.title)+'</span><span class="r gold">UNTIL '+lsHM(T[i].e)+'</span></div>';
    var left=Math.max(0,60-Math.floor((Date.now()-ls.cardAt)/1000));
    if(ls.stay||left<=0) fin=ph.firm?'<button class="ls-b2" data-ls="go2">MOVING ON…</button>':'<button class="ls-b2" data-ls="stay">STAY HERE <kbd>ESC</kbd></button>';
    else fin='<button class="ls-b2" data-ls="finish">FINISH THIS SHOT <b>'+Math.floor(left/60)+':'+("0"+left%60).slice(-2)+'</b></button>';
    var nextFirm=null; pl.phases.forEach(function(p,j){ if(j>i&&p.firm&&!nextFirm) nextFirm=lsHM(T[j].s)+" · "+p.title.toUpperCase(); });
    return '<div class="ls-card"><div class="hd"><i class="ring"></i><span class="k">'+lsHM(T[i].s)+' · '+cbEsc((cls.teacher||"YOUR TEACHER").toUpperCase())+'’S PLAN</span><span class="of">'+(i+1)+' OF '+n+'</span></div>'
      +'<h2>Time to '+cbEsc(ph.title.charAt(0).toLowerCase()+ph.title.slice(1))+'.</h2>'
      +'<p>'+cbEsc(ph.does)+'.'+(ph.words?' <em>“'+cbEsc(ph.words)+'”</em>':'')+'</p><div class="rows">'+rows+'</div>'
      +'<div class="bt"><button class="ls-b1" data-ls="go">GO TO '+LS_PLACES[ph.opens].toUpperCase()+' <kbd>↵</kbd></button>'+fin+'</div>'
      +'<div class="ft">'+(ph.firm?'THE WHOLE CLASS MOVES ON TOGETHER':'YOU CAN STAY IF YOU’RE MID-SHOT')+(nextFirm?' · '+nextFirm:'')+'</div></div>'; }
  function lsShowMove(pl,c){ var m=$("lsMove"); if(!m) return; if(!ls.cardAt){ ls.cardAt=Date.now(); if(looking){ try{ document.exitPointerLock(); }catch(e){} } }
    var left=60-(Date.now()-ls.cardAt)/1000; if(left<=0&&c.ph.firm){ lsGo(c.ph.opens); return; }
    m.innerHTML=lsMoveHTML(pl,c); m.classList.add("show"); document.body.classList.add("ls-moving"); }
  function lsHideMove(){ var m=$("lsMove"); if(m&&m.classList.contains("show")){ m.classList.remove("show"); document.body.classList.remove("ls-moving"); } }
  function lsMoveOpen(){ var m=$("lsMove"); return !!(m&&m.classList.contains("show")); }
  function lsFinish(){ var left=Math.max(5,60-(Date.now()-ls.cardAt)/1000); ls.graceUntil=Date.now()+left*1000; ls.stay=true; lsHideMove(); toast("Finish your shot. The plan moves on in "+Math.round(left)+" s."); }
  function lsAct(a){ var pl=lsPlan(); if(!pl) return; var c=lsCur(pl);
    if(a==="go"||a==="go2"){ if(c.ph) lsGo(c.ph.opens); } else if(a==="finish") lsFinish(); else if(a==="stay"){ ls.pending=-1; ls.stay=false; lsHideMove(); } }
  function lsKey(e){ if(!lsMoveOpen()) return false; if(e.code==="Enter"||e.code==="NumpadEnter"){ e.preventDefault(); lsAct("go"); return true; }
    if(e.code==="Escape"){ e.preventDefault(); var b=$("lsMove").querySelector("[data-ls=finish],[data-ls=stay]"); if(b) lsAct(b.getAttribute("data-ls")); return true; }
    return true; }   // the card holds the keyboard while it's up
  function lsTick(){ var pl=lsPlan();
    if(!pl){ lsHidePill(); lsHideMove(); ls.phase=null; ls.pending=-1; }
    else { var c=lsCur(pl), n=pl.phases.length;
      if(ls.phase===null) ls.phase=c.i;   // the phase you arrive in never throws a card
      else if(c.i!==ls.phase){ var was=ls.phase; ls.phase=c.i; ls.pending=(c.i>was&&c.i<n)?c.i:-1; ls.cardAt=0; ls.graceUntil=0; ls.stay=false; }
      if(c.i>=0&&c.i<n-1&&c.left<=2&&!pl.paused&&!lsMoveOpen()) lsShowPill(pl,c); else lsHidePill();
      if(ls.pending>=0){
        if(ls.pending!==c.i||lsAt(c.ph.opens)){ ls.pending=-1; lsHideMove(); }
        else if(ls.graceUntil&&Date.now()<ls.graceUntil){}
        else { if(ls.graceUntil){ ls.graceUntil=0; if(c.ph.firm){ lsGo(c.ph.opens); return; } } lsShowMove(pl,c); } } }
    if(App.is("hub")&&typeof hubTick==="function") hubTick();
    if(App.is("teacher")&&typeof tcTick==="function") tcTick(); }
  (function wireLesson(){ var m=$("lsMove"); if(m) m.addEventListener("click",function(e){ var b=e.target.closest("[data-ls]"); if(b) lsAct(b.getAttribute("data-ls")); });
    setInterval(lsTick, 1000); })();
