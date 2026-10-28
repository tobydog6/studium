  // ================= QUESTS: a student-led path through the term =================
  // Foundations (in order) teach the loop; finishing them opens a board of main quests, each due at a teacher's checkpoint.
  // Every quest is data: steps with a check(q) that reads the work itself (photos, pages, frames...) and an optional now(q)
  // for "2 / 3". Counts toward a quest start when the student first tracks it (q.base); permanent things (a tour done, a page
  // that exists, a gold frame) read everything. A step that has ticked stays ticked, and a finished quest stays finished.
  var PILLARS={ context:{n:"Context", d:"history, photographers, taste"}, drive:{n:"Drive", d:"your own why"}, craft:{n:"Craft", d:"camera, lens, composition, editing"},
    environment:{n:"Environment", d:"light, time of day, place"}, all:{n:"All"} };
  var Q_KEY="studium_quests_v1", Q_DEMO_KEY="studium_quests_demo_v1";
  /* the playtest demo keeps its own quest state (and its own saved session), so it never touches a real student's work */
  function qDemo(){ try{ var w=lsWho(); return !!(w&&w.demo); }catch(e){ return false; } }
  function qKey(){ return qDemo()?Q_DEMO_KEY:Q_KEY; }

  // ---- what the checks read ----
  function qPhotosSince(q){ var t=q&&q.base?q.base.t:Infinity; return photos.filter(function(p){ return !p.research&&!p.uploaded&&+new Date(p.t)>=t; }); }
  function qDistinct(list,key){ var s={}; list.forEach(function(p){ if(p[key]!=null) s[p[key]]=1; }); return Object.keys(s).length; }
  function qPicks(){ return photos.filter(function(p){ return p.pick&&!p.research; }); }
  function qPages(tpl){ var pgs=(typeof st!=="undefined"&&st.wsBoard&&st.wsBoard.pages)||[]; return pgs.filter(function(pg){ return pg.tpl===tpl||(tpl==="artist"&&pg.tpl==="research"); }); }   /* Research's "send to workbook" makes artist model pages as "research" */
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
    {id:"f1", type:"foundation", order:1, checkpoint:"cp1", pillar:"craft", title:"Getting started", blurb:"Learn to move, shoot and set the camera, then take three gold-frame shots.", go:"scene",
     steps:[{t:"Do the warm-up", tour:"basics", go:"scene", check:function(){ return qTour("basics"); }},
       {t:"Complete 3 gold frames", go:"scene", check:function(){ return qChDone()>=3; }, now:function(){ return qCount(qChDone(),3); }}]},
    {id:"f2", type:"foundation", order:2, checkpoint:"cp1", pillar:"craft", title:"Shoot it your way", blurb:"Take fifteen frames of your own, trying all four lenses and changing your settings a lot.", go:"scene",
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
    {id:"f4", type:"foundation", order:4, checkpoint:"cp1", pillar:"context", title:"Look at others", blurb:"Rank a photographer's work, then make an artist model page.", go:"research", page:"artist",
     steps:[{t:"Take the Research tour", tour:"research", go:"research", check:function(){ return qTour("research"); }},
       {t:"Play a Culling Game", go:"research", check:function(){ return qPacks("cull").length>=1; }},
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
    {id:"m3", type:"main", checkpoint:"cp2", pillar:"environment", title:"Lighting", blurb:"One place at day, golden hour and night, then light it yourself.", go:"scene", page:"experiment",
     steps:[{t:"Open the lighting rig", tour:"lightrig", go:"scene", check:function(){ return qTour("lightrig")||qTour("lighting")||!!Q.flags.rlOpened; }},
       {t:"3 frames each at day, golden hour and night", go:"scene", check:function(q){ return qTimes(q)>=3; }, now:function(q){ return qCount(qTimes(q),3)+" times"; }},
       {t:"A night frame with 2 or more of your lights", go:"scene", check:function(q){ return qPhotosSince(q).some(function(p){ return qTime(p)==="night"&&qLightsOn(p)>=2; }); }},
       {t:"Make an Experiment page", go:"workshop", check:function(){ return qPages("experiment").length>=1; }}]},
    {id:"m4", type:"main", checkpoint:"cp2", pillar:"context", title:"Two photographers", blurb:"Look closely at two more photographers and make artist model pages.", go:"research", page:"artist",
     steps:[{t:"Culling Game on 3 packs in all", go:"research", check:function(){ return qPacks("cull").length>=3; }, now:function(){ return qCount(qPacks("cull").length,3); }},
       {t:"3 Artist model pages in all", go:"research", check:function(){ return qPages("artist").length>=3; }, now:function(){ return qCount(qPages("artist").length,3); }}]},
    // main quests, due at checkpoint 3
    {id:"m5", type:"main", checkpoint:"cp3", pillar:"context", title:"Your taste", blurb:"A moodboard of photographs you love, then what they mean for you.", go:"research", page:"mood",
     steps:[{t:"A moodboard with 8 or more photos", go:"research", check:function(){ return qPages("moodboard").some(function(pg){ return qPagePhotos(pg)>=8; }); }},
       {t:"Make a Mood & ideas page", go:"workshop", check:function(){ return qPages("mood").length>=1; }}]},
    {id:"m6", type:"main", checkpoint:"cp3", pillar:"drive", title:"Find your theme", blurb:"Say why your picks work, then plan what comes next.", go:"select", page:"next",
     steps:[{t:"A why note on 10 picks", go:"select", check:function(){ return qNoted()>=10; }, now:function(){ return qCount(qNoted(),10); }},
       {t:"Make a What's next page", go:"workshop", check:function(){ return qPages("next").length>=1; }}]},
    {id:"m7", type:"main", checkpoint:"cp3", pillar:"craft", pillars:["craft","environment"], title:"Three series", blurb:"Pick six good frames from each of three places and edit each set together.", go:"scene", page:"edit",
     locked:function(){ return (window.SPLAT_SCENES||[]).length<3?"Needs more locations":""; },
     steps:[{t:"6 picks from each of 3 places", go:"select", check:function(){ return qSeries().length>=3; }, now:function(){ return qCount(qSeries().length,3); }},
       {t:"Edit every one of those picks", go:"edit", check:function(){ return qSeries().filter(function(pl){ return qPicks().filter(function(p){ return p.place===pl; }).every(function(p){ return p.edited; }); }).length>=3; }},
       {t:"Make a Before & after page", go:"workshop", check:function(){ return qPages("edit").length>=1; }}]},
    {id:"m10", type:"main", checkpoint:"cp3", pillar:"drive", title:"Pairs and sequences", blurb:"Put your frames on the light table, pair them up, string two series together on the wall and save two sequence boards to your workbook.", go:"table", page:"sequence", try:true,
     steps:[{t:"Take the light table tour", tour:"lighttable", go:"table", check:function(){ return qTour("lighttable"); }},
       {t:"String two series together on the wall", go:"table", check:function(){ return !!Q.flags.ltString; }},
       {t:"2 sequence boards in your workbook", go:"table", check:function(){ return qPages("sequence").length>=2; }, now:function(){ return qCount(qPages("sequence").length,2); }}]},
    {id:"m8", type:"main", checkpoint:"cp3", pillar:"all", title:"The folio", blurb:"Fill all three A1 panels and try different layouts on each.", go:"folio",
     steps:[{t:"A photo in all 9 sections", go:"folio", check:function(){ return qFolioSecs()>=9; }, now:function(){ return qCount(qFolioSecs(),9); }},
       {t:"Try 2 arrangements on each panel", go:"folio", check:function(){ return qFolioArr()>=3; }, now:function(){ return qCount(qFolioArr(),3)+" panels"; }}]},
    {id:"m9", type:"main", checkpoint:"cp3", pillar:"all", title:"Show it", blurb:"Make a book of your work and hang a show.", go:"book",
     steps:[{t:"A book: cover and 6 spreads", go:"book", check:function(){ return qBookSpreads()>=6&&qBookCover(); }, now:function(){ return qCount(qBookSpreads(),6)+" spreads"; }},
       {t:"Export the book as a PDF", go:"book", check:function(){ return !!Q.flags.bookPdf; }},
       {t:"Hang 8 or more prints in the gallery", go:"gallery", check:function(){ return qPrints()>=8; }, now:function(){ return qCount(qPrints(),8); }},
       {t:"Give the show a title", go:"gallery", check:function(){ return typeof ga!=="undefined"&&!!String(ga.title||"").trim(); }}]}
  ]} };
  // ---- the demo: about 40 minutes for someone who's never seen Studium. Three foundations, then all four board quests, in any order. ----
  function qFolioTop(){ var b=typeof st!=="undefined"&&st.foBoard; if(!b||!b.pages) return 0; var n=0; b.pages.forEach(function(pg){ (pg.items||[]).forEach(function(it){ if(it.t==="photo"&&it.sec==="0.0"&&!it.hidden) n++; }); }); return n; }
  /* the board is rows of three: a row opens once the row above it is done. Row 1 keeps its order (each foundation unlocks the next). */
  QUEST_SETS.demo={ name:"Demo", checkpoints:[], sampleCp:true, finish:7, rows:[{n:"Start here", ids:["d1","d2","d3"]}, {n:"Then choose", ids:["d6","d5","d4"]}, {n:"Your own work", ids:["d7","d10","d8","d9"]}], quests:[
    {id:"d1", type:"foundation", order:1, pillar:"craft", mins:8, title:"Getting started", blurb:"Learn to move, shoot and set the camera, then take the three gold-frame shots.", go:"scene",
     steps:[{t:"Do the warm-up", tour:"basics", go:"scene", check:function(){ return qTour("basics"); }},
       {t:"Complete the 3 gold frames", go:"scene", check:function(){ return qChDone()>=3; }, now:function(){ return qCount(qChDone(),3); }}]},
    {id:"d2", type:"foundation", order:2, pillar:"craft", mins:4, title:"Shoot it your way", blurb:"Take at least five frames of your own, then swap to a different camera from the bag.", go:"scene",
     steps:[{t:"Take 5 photos", check:function(q){ return qPhotosSince(q).length>=5; }, now:function(q){ return qCount(qPhotosSince(q).length,5); }},
       {t:"Try another camera", check:function(q){ return qOtherBody(q); }}]},
    {id:"d3", type:"foundation", order:3, pillar:"craft", mins:7, title:"Choose and edit", blurb:"Pick your strongest five, edit one, then copy that look onto another.", go:"select",
     steps:[{t:"Learn to pick and reject", tour:"select", go:"select", check:function(){ return qTour("select"); }},
       {t:"Pick 5 frames", go:"select", check:function(){ return qPicks().length>=5; }, now:function(){ return qCount(qPicks().length,5); }},
       {t:"Edit one with the tour", tour:"edit", go:"edit", check:function(){ return qTour("edit"); }},
       {t:"Copy the look onto one more", go:"edit", check:function(){ return !!(Q.flags.synced||Q.flags.pasted); }}]},
    {id:"d4", type:"main", pillar:"environment", mins:6, title:"Lighting", blurb:"Light the stump yourself with a key and a fill, then catch it at golden hour.", go:"scene", page:null,
     steps:[{t:"Set up a key and a fill with the lighting tour", tour:"lightrig", go:"scene", check:function(){ return qTour("lightrig")||qTour("lighting"); }},
       {t:"A night frame with both your lights on", go:"scene", check:function(q){ return qPhotosSince(q).some(function(p){ return qTime(p)==="night"&&qLightsOn(p)>=2; }); }},
       {t:"A frame at golden hour", tour:"golden", go:"scene", check:function(q){ return qPhotosSince(q).some(function(p){ return qTime(p)==="golden"; }); }}]},
    {id:"d5", type:"main", pillar:"context", mins:5, title:"Look at others", blurb:"Rank a photographer's work in the Culling Game, then choose seven photographs from the archive for an artist model page.", go:"research", page:"artist",
     steps:[{t:"Play a Culling Game", go:"research", check:function(){ return qPacks("cull").length>=1; }},
       {t:"Make an Artist model page and press Finished", tour:"artist", go:"research", check:function(){ return qPages("artist").some(function(pg){ return !!pg.done; }); }}]},
    {id:"d6", type:"main", pillar:"drive", mins:4, title:"Show your thinking", blurb:"Put two of your photos side by side and say, in one sentence, what makes them different.", go:"workshop", page:"compare",
     steps:[{t:"Start a Compare page", tour:"workbook", go:"workshop", check:function(){ return qPages("compare").length>=1; }},
       {t:"Write a sentence about the difference", go:"workshop", check:function(){ return !!Q.flags.compared; }}]},
    {id:"d7", type:"main", pillar:"all", mins:5, title:"The folio", blurb:"Fill the top third of your first A1 panel and try its arrangements.", go:"folio",
     steps:[{t:"Take the folio tour", tour:"folio", go:"folio", check:function(){ return qTour("folio"); }},
       {t:"Fill the top third of panel 1", go:"folio", check:function(){ return qFolioTop()>=3; }, now:function(){ return qCount(qFolioTop(),3)+" photos"; }}]},
    {id:"d10", type:"main", pillar:"drive", mins:6, title:"Pairs and sequences", blurb:"On the light table, pair your frames, pin two series to the wall, string them together, and send the board to your workbook.", go:"table", page:"sequence", try:true,
     steps:[{t:"Take the light table tour", tour:"lighttable", go:"table", check:function(){ return qTour("lighttable"); }},
       {t:"String two series together on the wall", go:"table", check:function(){ return !!Q.flags.ltString; }},
       {t:"Add a sequence board to your workbook", go:"table", check:function(){ return qPages("sequence").length>=1; }}]},
    {id:"d8", type:"main", pillar:"all", mins:4, title:"Hang a show", blurb:"Choose prints for the gallery wall, lay them out, and give the show a title.", go:"gallery",
     steps:[{t:"Take the gallery tour", tour:"gallery", go:"gallery", check:function(){ return qTour("gallery"); }},
       {t:"Hang 3 prints on the wall", go:"gallery", check:function(){ return qPrints()>=3; }, now:function(){ return qCount(qPrints(),3); }}]},
    {id:"d9", type:"main", pillar:"drive", mins:2, title:"Your own project", blurb:"Make a folder of your own in the Library. You'll use it for the rest of the term.", go:"select", last:true,
     locked:function(){ var o=qAll().filter(function(x){ return x.type==="main"&&x.id!=="d9"&&!qIsDone(x.id); }); return o.length?"Finish the other quests first":""; },
     steps:[{t:"Make your own folder", tour:"library", go:"select", check:function(){ return ((typeof st!=="undefined"&&st.projects)||[]).length>=1; }}]}
  ]};
  /* any frame on a camera other than the one you start with */
  /* a different camera from the one you had when the quest started: photos already taken with other bodies don't count */
  function qOtherBody(q){ if(!q||!q.base||typeof curBody!=="function") return false; var id=curBody().id; if(!q.base.body){ q.base.body=id; qSave(); return false; } return id!==q.base.body; }
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
  function qLoad(){ var raw=null, demo=qDemo(); try{ raw=JSON.parse(localStorage.getItem(qKey())||"null"); }catch(e){}
    var s=qFresh(demo?"demo":"term1"); if(raw&&raw.v){ for(var k in raw) s[k]=raw[k]; ["quests","tours","tourStep","flags"].forEach(function(k){ if(!s[k]) s[k]={}; }); if(!s.rs) s.rs={cull:{}, punctum:{}, details:0}; }
    else if(!demo) qFromGuide(s); return s; }
  function qSave(){ try{ localStorage.setItem(qKey(), JSON.stringify(Q)); }catch(e){} if(typeof saveSession==="function") saveSession(); }
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
  // the board as rows of three: the set's own rows, or foundations then each checkpoint's quests chunked in threes
  function qRows(){ var set=qSet(); if(set.rows) return set.rows.map(function(r){ return {n:r.n, quests:r.ids.map(qGet).filter(Boolean)}; });
    var rows=[], chunk=function(n,list){ for(var i=0;i<list.length;i+=3) rows.push({n:n+(list.length>3?" "+(i/3+1):""), quests:list.slice(i,i+3)}); };
    chunk("Foundations", qFoundations()); var cps=qCheckpoints();
    cps.forEach(function(c){ var M=qAll().filter(function(x){ return x.type==="main"&&x.checkpoint===c.id; }); if(M.length) chunk("Checkpoint "+c.id.slice(2)+" · "+c.name, M); });
    if(!cps.length) chunk("Your board", qAll().filter(function(x){ return x.type==="main"; }));
    var S=qAll().filter(function(x){ return x.type==="side"; }); if(S.length) chunk("Side quests", S); return rows; }
  function qRowOf(id){ var R=qRows(); for(var i=0;i<R.length;i++) if(R[i].quests.some(function(x){ return x.id===id; })) return i; return -1; }
  function qRowDone(i){ var r=qRows()[i]; return !!r&&r.quests.every(function(x){ return qIsDone(x.id); }); }
  function qLockReason(x){ if(x.type==="foundation"){ var prev=qFoundations().filter(function(f){ return f.order<x.order; }); var miss=prev.filter(function(f){ return !qIsDone(f.id); })[0]; return miss?"Finish "+miss.title+" first":""; }
    if(qSet().rows){ var ri=qRowOf(x.id); if(ri>0&&!qRowDone(ri-1)) return "Opens when the row above is done"; return x.locked?x.locked():""; }
    if(!Q.boardOpen) return "Finish the foundations to open your board"; return x.locked?x.locked():""; }
  function qStatus(id){ var x=qGet(id); if(!x) return "none"; if(qIsDone(id)) return "done"; if(qLockReason(x)) return "locked"; return qState(id)?"active":"new"; }
  function qSteps(id){ var x=qGet(id), s=qState(id)||null, done=s&&s.done;
    return x.steps.map(function(st0,i){ var ok=!!done||!!(s&&s.stepDone[i]); if(!ok&&s){ try{ ok=!!st0.check(s); }catch(e){ ok=false; } if(ok) s.stepDone[i]=true; }
      var now=null; if(!ok&&st0.now&&s){ try{ now=st0.now(s); }catch(e){} } return {t:st0.t, ok:ok, now:now, tour:st0.tour||null, go:st0.go||x.go}; }); }
  function qProgress(id){ var st=qSteps(id); return {done:st.filter(function(s){ return s.ok; }).length, of:st.length}; }
  function qTrack(id){ var x=qGet(id); if(!x||qLockReason(x)) return false; if(typeof QU!=="undefined"&&QU.replay&&QU.replay.id!==id&&typeof qReplayEnd==="function") qReplayEnd(false); /* tracking another quest ends a replay */ if(Q.tracked!==id) sfx("qPick"); if(!Q.quests[id]) Q.quests[id]={started:Date.now(), base:{photos:photos.length, t:Date.now(), body:(typeof curBody==="function"?curBody().id:null)}, done:null, stepDone:{}};
    Q.tracked=id; qSave(); if(typeof qUI==="function") qUI(); return true; }
  // once a second-ish: tick the tracked quest (and any started one) and finish what's finished
  var Q_EVENTS=[];
  function qOn(fn){ Q_EVENTS.push(fn); }
  function qEmit(kind,data){ Q_EVENTS.forEach(function(fn){ try{ fn(kind,data); }catch(e){ console.warn("quest event",e); } }); }
  function qTick(){ var changed=false, snd=null;
    Object.keys(Q.quests).forEach(function(id){ var s=Q.quests[id], x=qGet(id); if(!x||s.done) return;
      var before=Object.keys(s.stepDone).length, st=qSteps(id), after=Object.keys(s.stepDone).length;
      if(after>before){ changed=true; snd=snd||"qStep"; qEmit("step",{id:id, steps:st}); }
      if(st.every(function(t){ return t.ok; })){ s.done=Date.now(); changed=true; snd="qDone"; qEmit("complete",{id:id});
        if(x.type==="foundation"&&qFoundations().every(function(f){ return qIsDone(f.id); })&&!Q.boardOpen){ Q.boardOpen=Date.now(); qEmit("board",{}); }
        if(Q.tracked===id) Q.tracked=null; } });
    /* a teacher can tick a foundation off outright, so the board can also open here */
    if(!Q.boardOpen&&qFoundations().every(function(f){ return qIsDone(f.id); })){ Q.boardOpen=Date.now(); changed=true; qEmit("board",{}); }
    if(Q.tracked&&qIsDone(Q.tracked)){ Q.tracked=null; changed=true; }
    /* the demo's board rule: every board quest, in whatever order you choose, and it's finished */
    var fin=qSet().finish; if(fin&&!Q.finished&&qAll().filter(function(x){ return x.type==="main"&&qIsDone(x.id); }).length>=fin){ Q.finished=Date.now(); changed=true; qEmit("finish",{}); }
    if(snd) sfx(snd); if(changed) qSave(); return changed; }

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
    track:qTrack, tick:qTick, complete:function(id,i){ var s=Q.quests[id]||(Q.quests[id]={started:Date.now(), base:{photos:photos.length, t:Date.now(), body:(typeof curBody==="function"?curBody().id:null)}, done:null, stepDone:{}}); if(i==null){ s.done=Date.now(); } else s.stepDone[i]=true; qTick(); qSave(); },
    setCheckpoints:function(o){ Q.cps=o; qSave(); },
    // test helpers: a scripted session without walking anywhere
    frames:function(n){ (CH.list||[]).slice(0,n).forEach(function(c){ CH.done[c.id]=1; }); return qChDone(); },
    page:function(tpl,n){ var b=st.wsBoard||wsB.doc_(); if(!st.wsBoard) st.wsBoard=b; var items=[]; for(var i=0;i<(n||0);i++) items.push({id:"t"+i, t:"photo", pid:"x"+i, x:0, y:0, w:10}); b.pages.push({id:"pg"+Date.now()+Math.random(), bg:"white", items:items, tpl:tpl}); return b.pages.length; },
    tour:function(id){ Q.tours[id]=true; qSave(); },
    briefs:function(n){ BRIEFS.forEach(function(b){ briefDone[b.id]=n||3; }); return qBriefs(); },
    folioAll:function(){ var b=st.foBoard||(st.foBoard={pages:[]}); if(!b.pages.length) b.pages.push({items:[]}); for(var p=0;p<3;p++) for(var r=0;r<3;r++) b.pages[0].items.push({id:"fa"+p+r, t:"photo", sec:p+"."+r}); [0,1,2].forEach(function(k){ qFolioArranged(k); qFolioArranged(k); }); return [qFolioSecs(), qFolioArr()]; },
    book:function(spreads){ var id=stId(0); bk.pages=[]; for(var i=0;i<2*spreads+2;i++) bk.pages.push({tpl:"full", imgs:[id]}); return [qBookSpreads(), qBookCover()]; },
    gallery:function(n,title){ var L=[]; for(var i=0;i<n&&i<photos.length;i++) L.push(stId(i)); ga.list=L; ga.title=title||""; return qPrints(); },
    folio:function(n){ var b=st.foBoard||(st.foBoard={pages:[]}); if(!b.pages.length) b.pages.push({items:[]}); for(var i=0;i<(n||1);i++) b.pages[0].items.push({id:"fo"+i+Date.now(), t:"photo", sec:"0.0"}); return qFolioTop(); },
    photos:function(){ return photos.length; },
    last:function(){ var p=photos[photos.length-1]; return p?{light:p.light, ev:p.ev}:null; }, reset:function(){ Q=qFresh(Q.set); qSave(); }, raw:function(){ return Q; }, flag:qFlag, research:qResearch, fixMoodboards:qFixMoodboards };
