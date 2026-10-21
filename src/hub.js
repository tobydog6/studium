  // ================= HUB (class wall) and SIGN-IN =================
  // The hub leads with today's job: the teacher's current phase (or a self-paced step with no class), the steps
  // around it with real counts, and one action. Behind it, a wall of frames: yours in colour with your picks framed
  // in gold, the rest dim. With a school connected the wall is the whole class's week; on its own it's yours.
  var HUB_FILL=["asset:assets/hub/f0.webp","asset:assets/hub/f1.webp","asset:assets/hub/f2.webp","asset:assets/hub/f3.webp","asset:assets/hub/f4.webp","asset:assets/hub/f5.webp","asset:assets/hub/f6.webp","asset:assets/hub/f7.webp"];
  var hubThumbs={}, hubWallKey="", D7_KIT="asset:assets/hub/kit.webp";
  // small JPEG thumbnails of your frames for the wall (a full frame per tile would be heavy on school PCs)
  function hubThumb(i){ var p=photos[i], id=stId(i); if(hubThumbs[id]) return hubThumbs[id]; hubThumbs[id]=p.url;
    var im=new Image(); im.onload=function(){ try{ var s=200/Math.max(im.width,im.height), c=document.createElement("canvas"); c.width=Math.round(im.width*s); c.height=Math.round(im.height*s);
      c.getContext("2d").drawImage(im,0,0,c.width,c.height); hubThumbs[id]=c.toDataURL("image/jpeg",0.7); }catch(e){} }; im.src=p.url; return p.url; }
  function hubRand(seed){ var x=Math.sin(seed*99.13+7.7)*43758.5453; return x-Math.floor(x); }
  function hubWall(){ var w=$("hub"); if(!w) return; var el=w.querySelector(".h6-wall"), W=window.innerWidth, H=window.innerHeight;
    var picks=stPicks().slice(-6), key=W+"x"+H+":"+photos.length+":"+picks.join(","); if(key===hubWallKey) return; hubWallKey=key;
    var tw=118, th=79, gx=8, gy=8, cols=Math.ceil(W/(tw+gx))+2, rows=Math.ceil(H/(th+gy))+1, own=photos.map(function(_,i){ return i; }), html="", slots=[];
    for(var r=0;r<rows;r++) for(var c=0;c<cols;c++) slots.push([r,c]);
    // picks land on the right-hand side of the wall, away from the words
    var gold={}; picks.forEach(function(pi,k){ var tries=0, s; do{ s=Math.floor(hubRand(k*7+tries+1)*slots.length); tries++; }
      while(tries<40&&(slots[s][1]*(tw+gx)<W*0.62||slots[s][1]*(tw+gx)>W-tw*1.2||slots[s][0]<1||slots[s][0]>rows-3||gold[s]!=null||gold[s-1]!=null||gold[s+1]!=null)); gold[s]=pi; });
    slots.forEach(function(rc,s){ var r=rc[0], c=rc[1], x=c*(tw+gx)-30-(r%2?tw*0.45:0), y=r*(th+gy)-20, src, cls="t";
      if(gold[s]!=null){ src=hubThumb(gold[s]); cls="t gold"; }
      else if(own.length&&hubRand(s*3.1)<0.55) src=hubThumb(own[Math.floor(hubRand(s+0.5)*own.length)]);
      else src=HUB_FILL[Math.floor(hubRand(s*1.7)*HUB_FILL.length)];
      html+='<span class="'+cls+'" style="left:'+x.toFixed(0)+'px;top:'+y+'px"><img src="'+src+'" alt="" draggable="false"'+(hubRand(s*5.3)<0.5&&cls==="t"?' class="fl"':'')+'></span>'; });
    el.innerHTML=html; }
  function hubSteps(list, cur){ return list.map(function(ph,j){ var k=lsKind(ph), have=lsCount(k), done=j<cur||(j===cur&&lsDone(ph)), on=j===cur;
      var right=k!=="none"&&ph.n>0?Math.min(have,ph.n)+' / '+ph.n:(j<cur?'':'');
      if(k==="shots"&&j<cur) right=String(have);
      return '<div class="h6-step'+(done?' done':'')+(on?' on':'')+'"><span class="b">'+(done?'✓':on?'●':'○')+'</span><span class="tt">'+cbEsc(ph.title)+'</span><span class="r">'+right+'</span></div>'; }).join(""); }
  // which of the three things on the desk a phase belongs to, and where it sits on the five-step rail
  var D7_OBJ={shoot:"shoot", punctum:"critique", gallery:"studio"}, D7_STEP={shoot:0, select:1, edit:2, workshop:3, folio:3, book:3, gallery:4, punctum:4};
  var D7_RAIL=["Shoot","Pick","Edit","Make","Show"];
  function hubFit(){ var h=$("hub"); if(!h) return; var sg=h.querySelector(".d7-stage"), W=window.innerWidth, H=window.innerHeight, s=Math.min(W/1440, (H-60)/840);
    sg.style.transform="translate(-50%,0) scale("+s.toFixed(4)+")"; }
  function hubRender(){ var h=$("hub"); if(!h) return; var who=lsWho()||{name:studentName||"", role:"solo"}, cls=lsClass(), pl=lsPlan(), steps, cur, ph, c=null;
    if(pl){ c=lsCur(pl); var n=pl.phases.length; steps=pl.phases; cur=Math.max(0,Math.min(n-1,c.i)); ph=steps[cur]; }
    else { steps=lsSoloSteps(); cur=steps.length-1; for(var j=0;j<steps.length;j++){ if(!lsDone(steps[j])){ cur=j; break; } } ph=steps[cur]; }
    var obj=D7_OBJ[ph.opens]||"studio", place=(window.SPLAT_SCENES&&SPLAT_SCENES[0]&&SPLAT_SCENES[0].name)||"The location";
    h.setAttribute("data-next", obj);
    h.querySelector(".h6-eb").textContent=pl?(c.i<0?"STARTS "+lsHM(pl.start):c.i>=pl.phases.length?"THAT’S THE PERIOD":"TODAY"):(photos.length?"NEXT":"START HERE");
    h.querySelector(".h6-h").textContent=ph.title+".";
    h.querySelector(".h6-words").textContent=ph.words?"“"+ph.words.replace(/\.$/,"")+"”":"";
    // the camera
    var shots=lsCount("shots"); h.querySelector(".d7-cam .kit").src=D7_KIT;
    h.querySelector(".d7-cam small").textContent=(loaded?cbPlace:place).toUpperCase()+" · "+shots+" FRAME"+(shots===1?"":"S")+(obj!=="shoot"&&shots?" · DONE ✓":"");
    // the prints: your picks first (circled), then your latest frames; blank paper before you've shot
    var pk=stPicks().slice(-3), others=photos.map(function(_,i){ return i; }).filter(function(i){ return !photos[i].pick&&!photos[i].reject; }).slice(-5), show=pk.concat(others).slice(0,5);
    var POS=[[30,60,230,-7],[210,20,240,5],[90,170,250,-2],[260,190,210,8],[10,250,200,4]], order=[1,0,3,4,2], html="";
    for(var q=0;q<5;q++){ var P=POS[q], i=show[order[q]], pic=i!=null&&photos[i];
      html+='<span class="pr" style="left:'+P[0]+'px;top:'+P[1]+'px;width:'+P[2]+'px;height:'+Math.round(P[2]*2/3)+'px;transform:rotate('+P[3]+'deg);z-index:'+(q===2?3:q===1?2:1)+'">'
        +(pic?'<img src="'+hubThumb(i)+'" alt="" draggable="false">'+(photos[i].pick?'<svg class="ring" viewBox="0 0 100 66" preserveAspectRatio="none" aria-hidden="true"><path d="M18 9 C50 -3 104 6 103 36 C102 72 30 74 3 46 C-2 23 25 3 60 5" fill="none" stroke="#d2462a" stroke-width="2.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>':''):'<i></i>')+'</span>'; }
    h.querySelector(".d7-stack").innerHTML=html;
    // the loupe
    var lp=stPicks(), li=lp.length?lp[lp.length-1]:(photos.length?photos.length-1:-1); h.querySelector(".d7-loupe img").src=li>=0?hubThumb(li):HUB_FILL[5];
    var crit=""; if(pl){ var T=lsTimes(pl); pl.phases.forEach(function(p,j){ if(!crit&&p.opens==="punctum"&&j>=cur) crit=j===cur?"OPEN NOW":"OPENS AT "+lsHM(T[j].s); }); }
    h.querySelector(".d7-loupe small").textContent=crit||"LOOK CLOSELY AT OTHER PHOTOGRAPHERS";
    // one action, under whichever thing is next
    var k=lsKind(ph), cta=h.querySelector(".h6-cta"); cta.innerHTML=lsCta(ph)+' <kbd>↵</kbd>'; cta.setAttribute("data-h6-go", ph.opens);
    h.querySelector(".h6-status").textContent=k!=="none"&&ph.n?Math.min(lsCount(k),ph.n)+" OF "+ph.n+" "+(k==="shots"?"SHOT":k==="picks"?"PICKED":k==="edits"?"EDITED":"DONE"):"";
    // the five steps
    var at=D7_STEP[ph.opens]!=null?D7_STEP[ph.opens]:1, rail="";
    D7_RAIL.forEach(function(n,i){ rail+='<span class="st'+(i<at?' done':i===at?' on':'')+'" style="left:'+(i*25)+'%"><i>'+(i<at?'✓':'')+'</i><b>'+(i+1)+' · '+n.toUpperCase()+'</b></span>'; });
    h.querySelector(".d7-rail").innerHTML='<span class="ln"></span><span class="ln fill" style="width:'+(at*25)+'%"></span>'+rail;
    // bar
    h.querySelector(".h6-cls").textContent=cls?(cls.name+" · "+(cls.teacher||"")).toUpperCase():(who.demo?"DEMO":who.role==="solo"?"FREE TRIAL":"");
    var nm=who.name||"Guest"; h.querySelector(".h6-me .av").textContent=lsInitials(nm); h.querySelector(".h6-me b").textContent=nm;
    h.querySelector(".h6-me small").textContent=who.preview?"PREVIEW · BACK TO TEACHER":(who.role==="solo"?"SIGN IN":"NOT YOU? SIGN OUT");
    h.querySelector(".h6-tch").classList.toggle("hidden", !(who.role==="teacher"||who.preview));
    // teacher's note
    var nt=hubNote(), ne=h.querySelector(".h6-note");
    if(nt){ ne.innerHTML='<span class="k">NOTE FROM '+cbEsc(((cls&&cls.teacher)||"YOUR TEACHER").toUpperCase())+' · '+cbEsc(nt.when)+'</span><p>'+cbEsc(nt.text)+'</p><button data-h6="read">GOT IT</button>'; ne.classList.remove("hidden"); }
    else ne.classList.add("hidden");
    hubFit(); hubTick(); }
  function hubTick(){ var h=$("hub"); if(!h||h.classList.contains("hidden")) return; var pl=lsPlan(), ck=h.querySelector(".h6-clock"), d=lsNow();
    if(pl){ var c=lsCur(pl), tot=lsTotal(pl), done=Math.max(0,Math.min(1,(c.now-pl.start)/tot)), left=Math.max(0,Math.ceil(pl.start+tot-c.now)), cls=lsClass()||{};
      ck.innerHTML='<span>'+(cls.period?'PERIOD '+cbEsc(String(cls.period)):'TODAY')+'</span><span class="tr"><i style="width:'+(done*100).toFixed(1)+'%"></i><b style="left:'+(done*100).toFixed(1)+'%"></b></span><span class="w">'+(pl.paused?'PAUSED':c.i<0?'STARTS '+lsHM(pl.start):c.i>=pl.phases.length?'DONE':left+' MIN LEFT')+'</span>';
      if(ls.phase!==null&&h.getAttribute("data-phase")!==String(c.i)){ h.setAttribute("data-phase",String(c.i)); hubRender(); } }
    else ck.innerHTML='<span class="w">'+d.toLocaleDateString("en-NZ",{weekday:"short",day:"numeric",month:"short"}).toUpperCase()+' · '+lsHM(lsMinOf(d))+'</span>';
    var sv=h.querySelector(".h6-saved"); if(sv) sv.classList.toggle("off", !photos.length); }
  function hubNote(){ var w=lsWho(); if(!w||!w.code) return null; var list=(lsDB.notes[w.code+"/"+w.name]||[]).filter(function(n){ return !n.read; }); return list[list.length-1]||null; }
  function hubAct(a, el){ var who=lsWho();
    if(a==="go") return lsGo(el.getAttribute("data-h6-go")||"shoot");
    if(a==="me"){ if(who&&who.preview){ lsSetWho({role:"teacher", name:who.teacherName||"Teacher", code:who.code}); return openTeacher("plan"); } if(who&&who.role==="student") lsSetWho(null); return siShow(); }
    if(a==="teacher") return openTeacher("plan");
    if(a==="read"){ var w=lsWho(), L=lsDB.notes[w.code+"/"+w.name]||[]; L.forEach(function(n){ n.read=true; }); lsSave(); return hubRender(); } }
  (function wireHub(){ var h=$("hub"); if(!h) return;
    h.addEventListener("click",function(e){ var b=e.target.closest("[data-h6]"); if(b) hubAct(b.getAttribute("data-h6"), b); });
    window.addEventListener("keydown",function(e){ if(!App.is("hub")||h.classList.contains("hidden")||lsMoveOpen()) return; if(e.target&&(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")) return;
      if(e.code==="Enter"){ e.preventDefault(); var b=h.querySelector(".h6-cta"); if(b) hubAct("go", b); } });
    window.addEventListener("resize",function(){ if(App.is("hub")) hubFit(); });
    h.addEventListener("click",function(e){ var o=e.target.closest("[data-d7]"); if(!o) return; var w=o.getAttribute("data-d7");
      if(w==="shoot") openSplatViewer(); else if(w==="critique") lsGo("punctum");
      else { var pl=lsPlan(), ph=null; if(pl){ var c=lsCur(pl); ph=c.ph; } var room=ph&&LS_PLACES[ph.opens]&&["select","edit","workshop","folio","book","gallery"].indexOf(ph.opens)>=0?ph.opens:"select"; hubHide("hub"); openStudio(room); } });
    App.on(function(next){ if(next==="hub") hubRender(); }); })();

  // ---- sign-in (a shared school computer) ----
  function siShow(){ ["hub","landing","studio","punctum","teacher","hud"].forEach(hubHide); var s=$("signin"); if(!s) return; s.classList.remove("hidden"); App.go("signin");
    var cls=null; Object.keys(lsDB.classes).forEach(function(k){ cls=lsDB.classes[k]; });
    var pl=cls?lsPlanFor(cls.code):null;
    s.querySelector(".si-eb").textContent=cls?((cls.period?"PERIOD "+cls.period+" · ":"")+cls.name+" WITH "+(cls.teacher||"")).toUpperCase():"A PHOTOGRAPHY STUDIO FOR YEARS 11–13";
    s.querySelector(".si-sub").textContent=pl?"Starts "+lsHM(pl.start)+". Sign in with your school account.":"Sign in with your school account.";
    // the playtest build: only the demo. ?full brings back school sign-in, class codes and the teacher view
    s.classList.toggle("demo-only", SI_DEMO_ONLY);
    if(SI_DEMO_ONLY){ s.querySelector(".si-eb").textContent="A PHOTOGRAPHY STUDIO FOR YEARS 11–13"; s.querySelector(".si-sub").textContent="Walk into a real place, shoot it with a real camera, then edit your photos and lay out a folio."; }
    s.querySelector(".si-name").classList.add("hidden"); s.querySelector(".si-code").classList.remove("hidden"); $("siCode").value=""; siTime(); }
  function siTime(){ var t=$("signin")&&$("signin").querySelector(".si-time"); if(!t) return; var d=lsNow(); t.textContent=d.toLocaleDateString("en-NZ",{weekday:"short",day:"numeric",month:"short"}).toUpperCase()+" · "+lsHM(lsMinOf(d)); }
  var siPending=null, siDemoAsk=false, SI_DEMO_ONLY=!/[?&]full(&|=|$)/.test(location.search);
  var SI_DEMO_LABEL='<span class="t">Play the demo</span><span class="d">ABOUT 10 MINUTES · SHOOT · PICK · EDIT · MAKE</span><span class="go">→</span>';
  function siAct(a){ var s=$("signin");
    if(a==="google"||a==="microsoft"){ if(typeof Sync!=="undefined"&&Sync.on()) return Sync.signIn(a); toast("School sign-in isn't connected on this computer yet. Join with a class code, or try it on your own."); return; }
    if(a==="join"){ var code=($("siCode").value||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
      if(code.length<6){ toast("Class codes are six letters and numbers."); return; }
      var hit=lsDB.classes[code]; if(!hit&&typeof Sync!=="undefined"&&Sync.on()){ Sync.joinClass(code).then(function(c){ if(c){ lsDB.classes[code]=c; lsSave(); siPending=code; siAskName(); } else toast("We couldn't find that code. Check the board?"); }); return; }
      if(!hit){ toast("We couldn't find that code. Check the board?"); return; } siPending=code; return siAskName(); }
    if(a==="name"){ var nm=($("siName").value||"").trim(); if(nm.length<2){ toast("Type your name the way your teacher knows it."); return; }
      lsSetWho({role:"student", name:nm, code:siPending}); return siDone(); }
    if(a==="solo"){ lsSetWho({role:"solo", name:studentName||""}); return siDone(); }
    if(a==="demo"){   // the ten-minute demo for playtesters: a clean start, straight into the Stump
      var b=s.querySelector('[data-si="demo"]');
      if(photos.length&&!siDemoAsk){ siDemoAsk=true; b.classList.add("ask"); b.innerHTML='<span class="t">Start again?</span><span class="d">THE DEMO STARTS FRESH AND CLEARS THE PHOTOS ON THIS COMPUTER · CLICK AGAIN</span><span class="go">→</span>'; return; }
      siDemoAsk=false; b.classList.remove("ask"); b.innerHTML=SI_DEMO_LABEL;
      clearSession(); if(typeof st!=="undefined"){ st.wsBoard=null; st.foBoard=null; st.projects=[]; st.wsPages=[]; if(typeof wsB!=="undefined") wsB.reset(null); if(typeof foB!=="undefined") foB.reset(null); }
      lsSetWho({role:"solo", name:"", demo:true}); siDone(); gdStartDemo();
      lsGo("shoot"); if(loaded&&typeof chAttach==="function") chAttach(); return; }   // already at the Stump: hang just the demo's two frames
    if(a==="teacher"){ return openTeacher("plan"); } }
  function siAskName(){ var s=$("signin"); s.querySelector(".si-code").classList.add("hidden"); s.querySelector(".si-name").classList.remove("hidden");
    var c=lsDB.classes[siPending]; s.querySelector(".si-help").textContent="Joining "+c.name+(c.teacher?" with "+c.teacher:"")+"."; setTimeout(function(){ $("siName").focus(); },30); }
  function siDone(){ var s=$("signin"); s.classList.add("hidden"); s.querySelector(".si-help").textContent="Your teacher has it on the board. You only need it once."; showHub(); }
  (function wireSignIn(){ var s=$("signin"); if(!s) return;
    s.addEventListener("click",function(e){ var b=e.target.closest("[data-si]"); if(b) siAct(b.getAttribute("data-si")); });
    $("siCode").addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Enter") siAct("join"); });
    $("siName").addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Enter") siAct("name"); });
    setInterval(siTime, 15000); })();
