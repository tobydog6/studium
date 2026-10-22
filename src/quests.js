  // ================= QUESTS: a student-led path through the term =================
  // Foundations (in order) teach the loop; finishing them opens a board of main quests, each due at a teacher's checkpoint.
  // Every quest is data: steps with a check(q) that reads the work itself (photos, pages, frames...) and an optional now(q)
  // for "2 / 3". Counts toward a quest start when the student first tracks it (q.base); permanent things (a tour done, a page
  // that exists, a gold frame) read everything. A step that has ticked stays ticked, and a finished quest stays finished.
  var PILLARS={ context:{n:"Context", d:"history, photographers, taste"}, drive:{n:"Drive", d:"your own why"}, craft:{n:"Craft", d:"camera, lens, composition, editing"},
    environment:{n:"Environment", d:"light, time of day, place"}, all:{n:"All"} };
  var Q_KEY="studium_quests_v1";

  // ---- what the checks read ----
  function qPhotosSince(q){ var t=q&&q.base?q.base.t:Infinity; return photos.filter(function(p){ return !p.research&&!p.uploaded&&+new Date(p.t)>=t; }); }
  function qDistinct(list,key){ var s={}; list.forEach(function(p){ if(p[key]!=null) s[p[key]]=1; }); return Object.keys(s).length; }
  function qPicks(){ return photos.filter(function(p){ return p.pick&&!p.research; }); }
  function qPages(tpl){ var pgs=(typeof st!=="undefined"&&st.wsBoard&&st.wsBoard.pages)||[]; return pgs.filter(function(pg){ return pg.tpl===tpl; }); }
  function qPagePhotos(pg){ return (pg.items||[]).filter(function(it){ return it.t==="photo"; }).length; }
  function qTour(id){ return !!Q.tours[id]; }
  function qChDone(){ return (CH.list||[]).filter(function(c){ return CH.done[c.id]; }).length; }
  function qTime(p){ return p.light?p.light.time:"day"; }   // no rig: the scan's own daylight
  function qLightsOn(p){ return p.light&&p.light.lights?p.light.lights.length:0; }
  function qPacks(kind){ return Object.keys(Q.rs[kind]||{}); }
  function qCount(n,of){ return Math.min(n,of)+" / "+of; }
  var Q_LENSES=["2470","50","85","135"];

  // ---- Term 1: in the splats ----
  var QUEST_SETS={ term1:{ name:"Term 1 · In the splats", checkpoints:[{id:"cp1", name:"Ready", week:3}, {id:"cp2", name:"Underway", week:6}, {id:"cp3", name:"Term's end", week:10}], quests:[
    // foundations: each unlocks the next
    {id:"f1", type:"foundation", order:1, checkpoint:"cp1", pillar:"craft", title:"Step inside", blurb:"Learn to move, shoot and set the camera, then take three gold-frame shots.", go:"scene",
     steps:[{t:"Do the warm-up", tour:"basics", go:"scene", check:function(){ return qTour("basics"); }},
       {t:"Complete 3 gold frames", go:"scene", check:function(){ return qChDone()>=3; }, now:function(){ return qCount(qChDone(),3); }}]},
    {id:"f2", type:"foundation", order:2, checkpoint:"cp1", pillar:"craft", title:"Shoot it your way", blurb:"Fifteen frames of your own, using every lens and pushing every setting.", go:"scene",
     steps:[{t:"Take 15 photos", check:function(q){ return qPhotosSince(q).length>=15; }, now:function(q){ return qCount(qPhotosSince(q).length,15); }},
       {t:"Use all four lenses", check:function(q){ return qLensesUsed(q)>=4; }, now:function(q){ return qCount(qLensesUsed(q),4); }},
       {t:"At least 3 apertures", check:function(q){ return qDistinct(qPhotosSince(q),"f")>=3; }, now:function(q){ return qCount(qDistinct(qPhotosSince(q),"f"),3); }},
       {t:"At least 3 shutter speeds", check:function(q){ return qDistinct(qPhotosSince(q),"sh")>=3; }, now:function(q){ return qCount(qDistinct(qPhotosSince(q),"sh"),3); }},
       {t:"At least 2 ISOs", check:function(q){ return qDistinct(qPhotosSince(q),"iso")>=2; }, now:function(q){ return qCount(qDistinct(qPhotosSince(q),"iso"),2); }}]},
    {id:"f3", type:"foundation", order:3, checkpoint:"cp1", pillar:"craft", title:"Choose and edit", blurb:"Pick your strongest eight, then edit them so they belong together.", go:"select",
     steps:[{t:"Learn to pick and reject", tour:"select", go:"select", check:function(){ return qTour("select"); }},
       {t:"Pick at least 8 frames", go:"select", check:function(){ return qPicks().length>=8; }, now:function(){ return qCount(qPicks().length,8); }},
       {t:"Edit with the tour", tour:"edit", go:"edit", check:function(){ return qTour("edit"); }},
       {t:"Sync a look across frames", go:"edit", check:function(){ return !!Q.flags.synced; }}]},
    {id:"f4", type:"foundation", order:4, checkpoint:"cp1", pillar:"context", title:"Look at others", blurb:"Rank a photographer's work, find what pricks you, and make an artist model page.", go:"research", page:"artist",
     steps:[{t:"Take the Research tour", tour:"research", go:"research", check:function(){ return qTour("research"); }},
       {t:"Play a Culling Game", go:"research", check:function(){ return qPacks("cull").length>=1; }},
       {t:"Play a Punctum round", go:"research", check:function(){ return qPacks("punctum").length>=1; }},
       {t:"Make an Artist model page", go:"research", check:function(){ return qPages("artist").length>=1; }}]},
    {id:"f5", type:"foundation", order:5, checkpoint:"cp1", pillar:"drive", title:"Show your thinking", blurb:"Rank your picks on a workbook page and start a project folder of your own.", go:"workshop", page:"rank",
     steps:[{t:"Take the workbook tour", tour:"workbook", go:"workshop", check:function(){ return qTour("workbook"); }},
       {t:"Make a Rank page", go:"workshop", check:function(){ return qPages("rank").length>=1; }},
       {t:"Make a project folder", tour:"library", go:"select", check:function(){ return qTour("library")||((typeof st!=="undefined"&&st.projects)||[]).length>=1; }}]},
    // main quests, due at checkpoint 2
    {id:"m1", type:"main", checkpoint:"cp2", pillar:"craft", title:"The gold frames", blurb:"Every gold frame in the scene, then annotate one.", go:"scene", page:"annotate",
     steps:[{t:"Complete every gold frame here", go:"scene", check:function(){ var n=(CH.list||[]).length; return n>0&&qChDone()>=n; }, now:function(){ return qCount(qChDone(),(CH.list||[]).length||6); }},
       {t:"Make an Annotate page", go:"workshop", check:function(){ return qPages("annotate").length>=1; }}]},
    {id:"m2", type:"main", checkpoint:"cp2", pillar:"craft", title:"Composition set", blurb:"Three frames on every composition brief, then a contact sheet.", go:"scene", page:"contact",
     steps:[{t:"3 frames on each of the 8 briefs", go:"scene", check:function(){ return qBriefs()>=BRIEFS.length; }, now:function(){ return qCount(qBriefs(),BRIEFS.length); }},
       {t:"Make a Contact sheet page", go:"workshop", check:function(){ return qPages("contact").length>=1; }}]},
    {id:"m3", type:"main", checkpoint:"cp2", pillar:"environment", title:"Bring the light", blurb:"One place at day, golden hour and night, then light it yourself.", go:"scene", page:"experiment",
     steps:[{t:"Open the lighting rig", tour:"lighting", go:"scene", check:function(){ return qTour("lighting")||!!Q.flags.rlOpened; }},
       {t:"3 frames each at day, golden hour and night", go:"scene", check:function(q){ return qTimes(q)>=3; }, now:function(q){ return qCount(qTimes(q),3)+" times"; }},
       {t:"A night frame with 2 or more of your lights", go:"scene", check:function(q){ return qPhotosSince(q).some(function(p){ return qTime(p)==="night"&&qLightsOn(p)>=2; }); }},
       {t:"Make an Experiment page", go:"workshop", check:function(){ return qPages("experiment").length>=1; }}]},
    {id:"m4", type:"main", checkpoint:"cp2", pillar:"context", title:"Two photographers", blurb:"Two more photographers, looked at closely, on artist model pages.", go:"research", page:"artist",
     steps:[{t:"Culling Game on 3 packs in all", go:"research", check:function(){ return qPacks("cull").length>=3; }, now:function(){ return qCount(qPacks("cull").length,3); }},
       {t:"Punctum round on 3 packs in all", go:"research", check:function(){ return qPacks("punctum").length>=3; }, now:function(){ return qCount(qPacks("punctum").length,3); }},
       {t:"3 Artist model pages in all", go:"research", check:function(){ return qPages("artist").length>=3; }, now:function(){ return qCount(qPages("artist").length,3); }}]},
    // main quests, due at checkpoint 3
    {id:"m5", type:"main", checkpoint:"cp3", pillar:"context", title:"Your taste", blurb:"A moodboard of photographs you love, then what they mean for you.", go:"research", page:"mood",
     steps:[{t:"A moodboard with 8 or more photos", go:"research", check:function(){ return qPages("moodboard").some(function(pg){ return qPagePhotos(pg)>=8; }); }},
       {t:"Make a Mood & ideas page", go:"workshop", check:function(){ return qPages("mood").length>=1; }}]},
    {id:"m6", type:"main", checkpoint:"cp3", pillar:"drive", title:"Find your theme", blurb:"Say why your picks work, then plan what comes next.", go:"select", page:"next",
     steps:[{t:"A why note on 10 picks", go:"select", check:function(){ return qNoted()>=10; }, now:function(){ return qCount(qNoted(),10); }},
       {t:"Make a What's next page", go:"workshop", check:function(){ return qPages("next").length>=1; }}]},
    {id:"m7", type:"main", checkpoint:"cp3", pillar:"craft", pillars:["craft","environment"], title:"Three series", blurb:"Three places, six strong frames from each, edited as sets.", go:"scene", page:"edit",
     locked:function(){ return (window.SPLAT_SCENES||[]).length<3?"Needs more locations":""; },
     steps:[{t:"6 picks from each of 3 places", go:"select", check:function(){ return qSeries().length>=3; }, now:function(){ return qCount(qSeries().length,3); }},
       {t:"Edit every one of those picks", go:"edit", check:function(){ var s=qSeries(); return s.length>=3&&s.every(function(pl){ return qPicks().filter(function(p){ return p.place===pl; }).every(function(p){ return p.edited; }); }); }},
       {t:"Make a Before & after page", go:"workshop", check:function(){ return qPages("edit").length>=1; }}]},
    {id:"m8", type:"main", checkpoint:"cp3", pillar:"all", title:"The folio", blurb:"All three A1 panels filled, and each arrangement tried.", go:"folio",
     steps:[{t:"A photo in all 9 sections", go:"folio", check:function(){ return qFolioSecs()>=9; }, now:function(){ return qCount(qFolioSecs(),9); }},
       {t:"Try 2 arrangements on each panel", go:"folio", check:function(){ return qFolioArr()>=3; }, now:function(){ return qCount(qFolioArr(),3)+" panels"; }}]},
    {id:"m9", type:"main", checkpoint:"cp3", pillar:"all", title:"Show it", blurb:"Your work as a book, and hung as a show.", go:"book",
     steps:[{t:"A book: cover and 6 spreads", go:"book", check:function(){ return qBookSpreads()>=6&&qBookCover(); }, now:function(){ return qCount(qBookSpreads(),6)+" spreads"; }},
       {t:"Export the book as a PDF", go:"book", check:function(){ return !!Q.flags.bookPdf; }},
       {t:"Hang 8 or more prints in the gallery", go:"gallery", check:function(){ return qPrints()>=8; }, now:function(){ return qCount(qPrints(),8); }},
       {t:"Give the show a title", go:"gallery", check:function(){ return typeof ga!=="undefined"&&!!String(ga.title||"").trim(); }}]}
  ]} };
  function qLensesUsed(q){ var L={}; qPhotosSince(q).forEach(function(p){ if(p.lens) L[p.lens]=1; }); return Q_LENSES.filter(function(k){ return L[k]; }).length; }
  function qBriefs(){ return BRIEFS.filter(function(b){ return (briefDone[b.id]||0)>=3; }).length; }
  function qTimes(q){ var c={day:0, golden:0, night:0}; qPhotosSince(q).forEach(function(p){ var t=qTime(p); if(c[t]!=null) c[t]++; }); return ["day","golden","night"].filter(function(t){ return c[t]>=3; }).length; }
  function qNoted(){ return qPicks().filter(function(p){ return String(p.note||"").trim().length>=20; }).length; }
  function qSeries(){ var by={}; qPicks().forEach(function(p){ if(p.place) by[p.place]=(by[p.place]||0)+1; }); return Object.keys(by).filter(function(k){ return by[k]>=6; }); }
  function qFolioSecs(){ var b=typeof st!=="undefined"&&st.foBoard; if(!b||!b.pages) return 0; var s={}; b.pages.forEach(function(pg){ (pg.items||[]).forEach(function(it){ if(it.t==="photo"&&it.sec&&!it.hidden) s[it.sec]=1; }); }); return Object.keys(s).length; }
  function qFolioArr(){ var a=Q.flags.foArr||{}; return [0,1,2].filter(function(p){ return (a[p]||0)>=2; }).length; }
  function qBookCover(){ return typeof bk!=="undefined"&&bk.pages.length>2&&qBookHas(bk.pages[0]); }
  function qBookHas(pg){ return !!pg&&(pg.imgs||[]).some(function(x){ return x!=null&&x!==""; }); }
  function qBookSpreads(){ if(typeof bk==="undefined"||bk.pages.length<3) return 0; var s=bkSpreads(), n=0; s.slice(1,-1).forEach(function(sp){ if(sp.some(function(i){ return qBookHas(bk.pages[i]); })) n++; }); return n; }
  function qPrints(){ return typeof gaPrints==="function"?gaPrints().length:0; }

  // ---- state ----
  function qFresh(set){ return {v:1, set:set||"term1", tracked:null, quests:{}, tours:{}, tourStep:{}, boardOpen:null, lastFocusAsk:null, flags:{}, rs:{cull:{}, punctum:{}, details:0}, first:Date.now(), cps:null}; }
  var Q=qLoad();
  function qLoad(){ var raw=null; try{ raw=JSON.parse(localStorage.getItem(Q_KEY)||"null"); }catch(e){}
    var s=qFresh("term1"); if(raw&&raw.v){ for(var k in raw) s[k]=raw[k]; ["quests","tours","tourStep","flags"].forEach(function(k){ if(!s[k]) s[k]={}; }); if(!s.rs) s.rs={cull:{}, punctum:{}, details:0}; }
    else qFromGuide(s); return s; }
  function qSave(){ try{ localStorage.setItem(Q_KEY, JSON.stringify(Q)); }catch(e){} if(typeof saveSession==="function") saveSession(); }
  function qSet(){ return QUEST_SETS[Q.set]||QUEST_SETS.term1; }
  function qAll(){ return qSet().quests; }
  function qGet(id){ return qAll().filter(function(x){ return x.id===id; })[0]||null; }
  function qState(id){ return Q.quests[id]||null; }
  // a student partway through the old guided path: finished guide steps become finished foundations and tours
  function qFromGuide(s){ var g=null; try{ g=JSON.parse(localStorage.getItem("studium_guide_v1")||"null"); }catch(e){} if(!g||!(g.step>0)||g.demo) return;
    // guide steps: basics 0, challenges 1, shoot 2, select 3, edit 4, workbook 5, folio 6, book 7, gallery 8, research 9, yours 10, done 11
    var at=g.step, now=Date.now(), tourAfter={basics:1, select:4, edit:5, workbook:6, folio:7, book:8, gallery:9, research:10, library:11};
    Object.keys(tourAfter).forEach(function(t){ if(at>=tourAfter[t]) s.tours[t]=true; });
    var done={f1:2, f2:3, f3:5, f4:10, f5:11}; Object.keys(done).forEach(function(f){ if(at>=done[f]) s.quests[f]={started:now, base:{photos:0, t:0}, done:now, stepDone:{}, migrated:true}; });
    if(at>=11) s.boardOpen=now; if(g.flags&&g.flags.synced) s.flags.synced=1; }

  // ---- checkpoints: the class's dates, or weeks 3, 6 and 10 from this student's first session ----
  /* the class's dates win (set by the teacher, carried on the plan when synced), then this student's own, then weeks from their start */
  function qClassCps(){ try{ var w=lsWho(); if(!w||!w.code) return null; var c=lsDB.classes[w.code], p=lsDB.plans[w.code]; return (c&&c.cps)||(p&&p.cps)||null; }catch(e){ return null; } }
  function qCheckpoints(){ var set=qSet(), cc=qClassCps(); return (set.checkpoints||[]).map(function(c){ var d=(cc&&cc[c.id])||(Q.cps&&Q.cps[c.id]);
      if(!d){ var t=new Date(Q.first||Date.now()); t.setDate(t.getDate()+c.week*7); d=t.getFullYear()+"-"+("0"+(t.getMonth()+1)).slice(-2)+"-"+("0"+t.getDate()).slice(-2); }   /* local date, not UTC */ return {id:c.id, name:c.name, date:d}; }); }
  function qCp(id){ return qCheckpoints().filter(function(c){ return c.id===id; })[0]||null; }

  // ---- the engine ----
  function qFoundations(){ return qAll().filter(function(x){ return x.type==="foundation"; }).sort(function(a,b){ return a.order-b.order; }); }
  function qIsDone(id){ var s=qState(id); return !!(s&&s.done); }
  function qLockReason(x){ if(x.type==="foundation"){ var prev=qFoundations().filter(function(f){ return f.order<x.order; }); var miss=prev.filter(function(f){ return !qIsDone(f.id); })[0]; return miss?"Finish "+miss.title+" first":""; }
    if(!Q.boardOpen) return "Finish the foundations to open your board"; return x.locked?x.locked():""; }
  function qStatus(id){ var x=qGet(id); if(!x) return "none"; if(qIsDone(id)) return "done"; if(qLockReason(x)) return "locked"; return qState(id)?"active":"new"; }
  function qSteps(id){ var x=qGet(id), s=qState(id)||null, done=s&&s.done;
    return x.steps.map(function(st0,i){ var ok=!!done||!!(s&&s.stepDone[i]); if(!ok&&s){ try{ ok=!!st0.check(s); }catch(e){ ok=false; } if(ok) s.stepDone[i]=true; }
      var now=null; if(!ok&&st0.now&&s){ try{ now=st0.now(s); }catch(e){} } return {t:st0.t, ok:ok, now:now, tour:st0.tour||null, go:st0.go||x.go}; }); }
  function qProgress(id){ var st=qSteps(id); return {done:st.filter(function(s){ return s.ok; }).length, of:st.length}; }
  function qTrack(id){ var x=qGet(id); if(!x||qLockReason(x)) return false; if(!Q.quests[id]) Q.quests[id]={started:Date.now(), base:{photos:photos.length, t:Date.now()}, done:null, stepDone:{}};
    Q.tracked=id; qSave(); if(typeof qUI==="function") qUI(); return true; }
  // once a second-ish: tick the tracked quest (and any started one) and finish what's finished
  var Q_EVENTS=[];
  function qOn(fn){ Q_EVENTS.push(fn); }
  function qEmit(kind,data){ Q_EVENTS.forEach(function(fn){ try{ fn(kind,data); }catch(e){ console.warn("quest event",e); } }); }
  function qTick(){ var changed=false;
    Object.keys(Q.quests).forEach(function(id){ var s=Q.quests[id], x=qGet(id); if(!x||s.done) return;
      var before=Object.keys(s.stepDone).length, st=qSteps(id), after=Object.keys(s.stepDone).length;
      if(after>before){ changed=true; qEmit("step",{id:id, steps:st}); }
      if(st.every(function(t){ return t.ok; })){ s.done=Date.now(); changed=true; qEmit("complete",{id:id});
        if(x.type==="foundation"&&qFoundations().every(function(f){ return qIsDone(f.id); })&&!Q.boardOpen){ Q.boardOpen=Date.now(); qEmit("board",{}); }
        if(Q.tracked===id) Q.tracked=null; } });
    /* a teacher can tick a foundation off outright, so the board can also open here */
    if(!Q.boardOpen&&qFoundations().every(function(f){ return qIsDone(f.id); })){ Q.boardOpen=Date.now(); changed=true; qEmit("board",{}); }
    if(Q.tracked&&qIsDone(Q.tracked)){ Q.tracked=null; changed=true; }
    if(changed) qSave(); return changed; }

  // ---- hooks the rest of Studium calls ----
  function qTourDone(id){ Q.tours[id]=true; Q.tourStep[id]=coLen(id); qSave(); }
  function qResearch(kind, packId, n){ if(kind==="details"){ Q.rs.details=(Q.rs.details||0)+(n||1); } else if(packId!=null){ (Q.rs[kind]||(Q.rs[kind]={}))[packId]=(Q.rs[kind][packId]||0)+1; } qSave(); }
  function qFlag(k,v){ Q.flags[k]=v==null?1:v; qSave(); }
  function qFolioArranged(panel){ var a=Q.flags.foArr||(Q.flags.foArr={}); a[panel]=(a[panel]||0)+1; qSave(); }
  // the old research moodboard reused the "mood" template id: a "mood" page that's only photos and a "Photographs:" credit is a moodboard
  function qFixMoodboards(){ var n=0; ((typeof st!=="undefined"&&st.wsBoard&&st.wsBoard.pages)||[]).forEach(function(pg){ if(pg.tpl!=="mood") return; var its=pg.items||[];
      var ok=its.length&&its.every(function(it){ return it.t==="photo"||(it.t==="text"&&(it.role==="title"&&/^Moodboard$/.test(it.text||"")||/^Photographs:/.test(it.text||""))); });
      if(ok&&its.some(function(it){ return /^Photographs:/.test(it.text||""); })){ pg.tpl="moodboard"; n++; } }); return n; }
  setInterval(qTick, 900);
  if(/[?&]dev/.test(location.search)) window.__q={
    state:function(){ return {set:Q.set, tracked:Q.tracked, board:!!Q.boardOpen, tours:Object.keys(Q.tours), flags:Q.flags, rs:Q.rs, checkpoints:qCheckpoints(),
      quests:qAll().map(function(x){ var p=qProgress(x.id); return {id:x.id, type:x.type, status:qStatus(x.id), lock:qLockReason(x), done:p.done, of:p.of, steps:qSteps(x.id).map(function(s){ return [s.ok?1:0, s.t, s.now]; })}; })}; },
    track:qTrack, tick:qTick, complete:function(id,i){ var s=Q.quests[id]||(Q.quests[id]={started:Date.now(), base:{photos:photos.length, t:Date.now()}, done:null, stepDone:{}}); if(i==null){ s.done=Date.now(); } else s.stepDone[i]=true; qTick(); qSave(); },
    setCheckpoints:function(o){ Q.cps=o; qSave(); },
    // test helpers: a scripted session without walking anywhere
    frames:function(n){ (CH.list||[]).slice(0,n).forEach(function(c){ CH.done[c.id]=1; }); return qChDone(); },
    page:function(tpl,n){ var b=st.wsBoard||wsB.doc_(); if(!st.wsBoard) st.wsBoard=b; var items=[]; for(var i=0;i<(n||0);i++) items.push({id:"t"+i, t:"photo", pid:"x"+i, x:0, y:0, w:10}); b.pages.push({id:"pg"+Date.now()+Math.random(), bg:"white", items:items, tpl:tpl}); return b.pages.length; },
    tour:function(id){ Q.tours[id]=true; qSave(); },
    last:function(){ var p=photos[photos.length-1]; return p?{light:p.light, ev:p.ev}:null; }, reset:function(){ Q=qFresh(Q.set); qSave(); }, raw:function(){ return Q; }, flag:qFlag, research:qResearch, fixMoodboards:qFixMoodboards };
