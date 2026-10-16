  // ================= TEACHER: plan the period, run it live, project it =================
  // Plan: a timeline of phases you drag to length, each edited below (what they do, your words, the place it opens,
  // what counts as done, and nudge or move everyone). Live: the class at a glance with who needs you, notes, and the
  // during-class controls. Board: the current phase and its clock, big enough for the back row.
  // With no school connected the live roster is a rehearsal class, clearly marked, plus this computer's preview student.
  var TC_PREVIEW="Preview student";
  var TC_DEMO=["Mia T","Aroha H","Jack W","Sione K","Lucy T","Ruby M","Eli P","Hana S","Noah B","Tama R","Ella C","Finn D","Zoe L","Kauri N","Leo F","Isla G","Ben A","Mere W","Oscar J","Amelia R","Nikau P","Chloe V","Theo E","Maia K"];
  var TC_ACT={shoot:"SHOOTING", select:"PICKING", edit:"EDITING", workshop:"MAKING", folio:"FOLIO", book:"BOOK", gallery:"GALLERY", punctum:"CRITIQUE"};
  var tc={tab:"plan", sel:0, drag:null, rehearse:0, rPause:0, filter:"all", pick:null, look:null};

  function tcClass(){ var w=lsWho(); return w&&w.code?lsDB.classes[w.code]:null; }
  function tcPlan(){ var c=tcClass(); if(!c) return null; var p=lsDB.plans[c.code], today=lsToday();
    if(!p) p=lsDB.plans[c.code]=lsNewPlan(c,"edit");
    else if(p.date!==today){ p.date=today; p.sent=false; p.paused=null; p.start=c.start||p.start; }
    return p; }
  function openTeacher(tab){ var w=lsWho();
    if(!w||w.role!=="teacher"){ var cls=null; Object.keys(lsDB.classes).forEach(function(k){ cls=lsDB.classes[k]; });
      if(!cls){ var d=lsNow(), st_=Math.floor(lsMinOf(d)/5)*5; cls={code:lsCode(), name:"My class", teacher:"Teacher", period:"", start:st_}; lsDB.classes[cls.code]=cls; }
      lsSetWho({role:"teacher", name:cls.teacher, code:cls.code}); }
    ["hub","signin","landing","studio","punctum","hud"].forEach(hubHide); if(st.open){ stHideLegacy(); st.open=false; $("studioX").classList.add("hidden"); }
    var t=$("teacher"); t.classList.remove("hidden"); tcTab(tab||tc.tab); }
  function tcTab(t){ tc.tab=t; App.go("teacher."+t); var el=$("teacher"); el.querySelector(".tc-plan").classList.toggle("hidden", t!=="plan"); el.querySelector(".tc-live").classList.toggle("hidden", t!=="live");
    Array.prototype.forEach.call(el.querySelectorAll("[data-tc-tab]"),function(b){ b.classList.toggle("on", b.getAttribute("data-tc-tab")===t); });
    if(t==="live"&&!tc.rehearse) tc.rehearse=Date.now(); tcRender(); }
  // live when the plan is sent for today and we're inside the period; otherwise a rehearsal clock 18 minutes in
  function tcLive(pl){ if(!pl||!pl.sent) return false; var now=lsMinOf(lsNow()), tot=lsTotal(pl); return now>=pl.start-10&&now<=pl.start+tot+10; }
  function tcClock(pl){ if(tcLive(pl)) return null; var t=tc.rPause||Date.now(); return pl.start+18+(t-(tc.rehearse||t))/60000; }

  // ---- bar ----
  function tcRenderBar(){ var el=$("teacher"), c=tcClass(), pl=tcPlan(), d=lsNow(); if(!c) return;
    var live=tcLive(pl);
    el.querySelector(".tc-cls").innerHTML=(tc.tab==="live"?'<i class="'+(live?'on':'')+'"></i>'+(live?'LIVE · ':'REHEARSAL · '):'')+cbEsc(c.name.toUpperCase())+' · '+d.toLocaleDateString("en-NZ",{weekday:"short",day:"numeric",month:"short"}).toUpperCase()+(c.period?' · PERIOD '+cbEsc(String(c.period)):'')+' · CODE '+cbEsc(c.code)+' <b>▾</b>';
    el.querySelector(".tc-who").textContent=c.teacher||"Teacher"; }
  function tcPop(open){ var p=$("teacher").querySelector(".tc-pop"), c=tcClass(); if(open===false||!p.classList.contains("hidden")&&open==null){ p.classList.add("hidden"); return; }
    p.innerHTML='<label>CLASS<input data-cf="name" value="'+cbEsc(c.name)+'"></label><label>TEACHER<input data-cf="teacher" value="'+cbEsc(c.teacher||"")+'" placeholder="Mr Quinn"></label>'
      +'<div class="two"><label>PERIOD<input data-cf="period" value="'+cbEsc(String(c.period||""))+'" placeholder="3"></label><label>STARTS<input data-cf="start" type="time" value="'+("0"+Math.floor((c.start||600)/60)).slice(-2)+':'+("0"+(c.start||600)%60).slice(-2)+'"></label></div>'
      +'<div class="code"><span>CLASS CODE</span><b>'+cbEsc(c.code)+'</b><small>Students type this once, on the sign-in screen.</small></div>';
    p.classList.remove("hidden");
    Array.prototype.forEach.call(p.querySelectorAll("input"),function(i){ i.addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Enter"||e.key==="Escape") tcPop(false); });
      i.addEventListener("input",function(){ var f=i.getAttribute("data-cf"), v=i.value;
        if(f==="start"){ var m=/^(\d\d):(\d\d)$/.exec(v); if(!m) return; c.start=+m[1]*60+ +m[2]; var pl=tcPlan(); if(pl) pl.start=c.start; } else c[f]=v;
        if(f==="teacher"){ var w=lsWho(); w.name=v; } lsSave(); tcRenderBar(); if(tc.tab==="plan") tcRenderPlan(true); }); }); }

  // ---- plan ----
  function tcUnit(ph){ var k=lsKind(ph); return k==="none"?"":LS_UNIT[k][ph.n===1?0:1]; }
  function tcRenderPlan(keepEditor){ var el=$("teacher").querySelector(".tc-plan"), pl=tcPlan(), c=tcClass(); if(!pl) return;
    tc.sel=Math.max(0,Math.min(pl.phases.length-1,tc.sel));
    Array.prototype.forEach.call(el.querySelectorAll("[data-tc-tpl]"),function(b){ b.classList.toggle("on", b.getAttribute("data-tc-tpl")===pl.tpl); });
    var tl=el.querySelector(".tc-tl"), W=tl.clientWidth-56, tot=lsTotal(pl), span=Math.max(tot+10, 60), k=W/span, T=lsTimes(pl), cur=lsCur(pl, tcClock(pl)), ticks="";
    for(var m=0;m<=span;m+=5){ var abs=pl.start+m; ticks+='<span class="'+(abs%10===0?'maj':'')+'" style="left:'+(m*k).toFixed(1)+'px">'+(abs%10===0?lsHM(abs):'')+'</span>'; }
    el.querySelector(".tc-ticks").innerHTML=ticks;
    el.querySelector(".tc-blocks").innerHTML=pl.phases.map(function(p,j){ var on=j===cur.i&&(tcLive(pl)), cls="tc-blk"+(j===tc.sel?' sel':'')+(on?' now':'')+(p.firm?' firm':'');
        return '<button class="'+cls+'" data-tc-blk="'+j+'" style="left:'+((T[j].s-pl.start)*k).toFixed(1)+'px;width:'+(p.dur*k-4).toFixed(1)+'px"><b>'+cbEsc(p.title)+'</b><span>'+LS_PLACES[p.opens].toUpperCase()+' · '+(p.firm?'EVERYONE':'SOFT')+'</span><i class="edge" data-tc-edge="'+j+'"></i></button>'; }).join("")
      +'<button class="tc-blk add" data-tc="add" style="left:'+(tot*k).toFixed(1)+'px;width:44px" aria-label="Add a phase">+</button>';
    var nowEl=el.querySelector(".tc-now"); if(cur.now>=pl.start-0.01&&cur.now<=pl.start+span){ nowEl.style.left=(28+(cur.now-pl.start)*k).toFixed(1)+"px"; nowEl.innerHTML='<span>'+(tcLive(pl)?'NOW ':'REHEARSAL ')+lsHM(cur.now)+'</span>'; nowEl.classList.remove("hidden"); } else nowEl.classList.add("hidden");
    var ph=pl.phases[tc.sel];
    if(!keepEditor){ var opens=Object.keys(LS_PLACES).map(function(o){ return '<button data-tc-open="'+o+'" class="'+(ph.opens===o?'on':'')+'">'+LS_PLACES[o].toUpperCase()+'</button>'; }).join("");
      el.querySelector(".tc-ed").innerHTML='<div class="tc-ph-h"><span class="tm"></span><input class="tc-title" data-pf="title" value="'+cbEsc(ph.title)+'" aria-label="Phase name"></div>'
        +'<div class="tc-two"><label><span class="eb">WHAT THEY DO</span><input data-pf="does" value="'+cbEsc(ph.does)+'" placeholder="Edit two of your picks"></label><label><span class="eb">IN YOUR WORDS</span><input data-pf="words" value="'+cbEsc(ph.words||"")+'" placeholder="Edit for mood, not for correctness."></label></div>'
        +'<span class="eb">OPENS</span><div class="tc-chips">'+opens+'</div>'
        +'<div class="tc-two"><div><span class="eb">DONE WHEN</span><div class="tc-step"></div></div><div><span class="eb">WHEN TIME’S UP</span><div class="tc-chips"><button data-tc-firm="0" class="'+(ph.firm?'':'on')+'">NUDGE · THEY CAN STAY</button><button data-tc-firm="1" class="'+(ph.firm?'on':'')+'">MOVE EVERYONE</button></div></div></div>'
        +(pl.phases.length>1?'<button class="tc-del" data-tc="del">Remove this phase</button>':'');
      Array.prototype.forEach.call(el.querySelectorAll("[data-pf]"),function(i){ i.addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Enter") i.blur(); });
        i.addEventListener("input",function(){ pl.phases[tc.sel][i.getAttribute("data-pf")]=i.value; lsSave(); tcRenderPlan(true); }); }); }
    el.querySelector(".tc-ph-h .tm").textContent=lsHM(T[tc.sel].s)+' – '+lsHM(T[tc.sel].e)+' · '+Math.round(ph.dur)+' MIN';
    el.querySelector(".tc-step").innerHTML=lsKind(ph)==="none"?'<span class="none">Nothing to count. Time decides.</span>':'<button data-tc="n-" aria-label="Fewer">−</button><b>'+ph.n+'</b><button data-tc="n+" aria-label="More">+</button><span>'+tcUnit(ph)+'</span>';
    el.querySelector(".tc-see").innerHTML='<div class="mini"><span class="k">'+lsHM(T[tc.sel].s)+' · '+cbEsc((c.teacher||"YOUR TEACHER").toUpperCase())+'’S PLAN</span><h3>Time to '+cbEsc(ph.title.charAt(0).toLowerCase()+ph.title.slice(1))+'.</h3><p>'+cbEsc(ph.does||"")+'.</p><div class="bt"><span class="g">GO TO '+LS_PLACES[ph.opens].toUpperCase()+'</span><span class="o">'+(ph.firm?'MOVES IN 1 MIN':'FINISH SHOT')+'</span></div></div>';
    var live=tcLive(pl); el.querySelector(".tc-during").innerHTML='<div class="h"><span class="eb">DURING CLASS</span><span class="st"><i class="'+(live?'on':'')+'"></i>'+(live?'LIVE':pl.sent?'SENT · NOT IN PERIOD':'NOT SENT YET')+'</span></div>'
      +'<div class="bt"><button data-tc="plus5"'+(live?'':' disabled')+'>+5 MIN</button><button data-tc="pause"'+(live?'':' disabled')+'>'+(pl.paused?'RESUME':'PAUSE')+'</button><button class="o" data-tc="moveon"'+(live?'':' disabled')+'>MOVE ON NOW</button></div>';
    el.querySelector(".tc-send").textContent=pl.sent?'SENT TO '+c.name.toUpperCase()+' ✓':'SEND TO '+c.name.toUpperCase(); el.querySelector(".tc-send").classList.toggle("sent", !!pl.sent); }
  function tcEdgeDrag(e, j){ e.preventDefault(); e.stopPropagation(); var pl=tcPlan(), tl=$("teacher").querySelector(".tc-tl"), W=tl.clientWidth-56, span=Math.max(lsTotal(pl)+10,60), k=W/span, x0=e.clientX, d0=pl.phases[j].dur;
    tc.drag=j; function mv(ev){ var d=Math.max(5, Math.round((d0+(ev.clientX-x0)/k)/5)*5); if(d!==pl.phases[j].dur){ pl.phases[j].dur=d; tc.sel=j; tcRenderPlan(true); } }
    function up(){ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); tc.drag=null; lsSave(); tcRenderPlan(); }
    window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); }

  // ---- live: the class roster (school roster when connected; a rehearsal class otherwise) ----
  function tcRnd(a,b){ var x=Math.sin(a*12.9898+b*78.233)*43758.5453; return x-Math.floor(x); }
  function tcRoster(pl){ var c=lsCur(pl, tcClock(pl)), T=c.T, el=c.now-pl.start, n=pl.phases.length, out=[], ci=Math.max(0,Math.min(n-1,c.i));
    // this computer's preview student, from real work
    var me=null; (function(){ var nm=TC_PREVIEW, k=lsKind(pl.phases[ci]); me={name:nm, real:true, initials:"PS", act:TC_ACT[pl.phases[ci].opens], frames:photos.length, picks:stPicks().length, edits:lsCount("edits"),
      prog:pl.phases[ci].n?Math.min(1,lsCount(k)/pl.phases[ci].n):0, idle:0, status:"now", thumb:photos.length?hubThumb(photos.length-1):HUB_FILL[0], pthumbs:stPicks().slice(0,5).map(hubThumb), where:"This computer"}; })();
    out.push(me);
    TC_DEMO.forEach(function(nm,j){ var notIn=(j===8||j===16||j===21), speed=0.7+tcRnd(j,1)*0.65, stall=(j===2||j===11)?6+tcRnd(j,2)*4:null;
      if(notIn){ out.push({name:nm, status:"out", prog:0, frames:0, picks:0, edits:0}); return; }
      var v=Math.max(0,(stall!=null?Math.min(el,stall):el))*speed, idle=stall!=null&&el>stall?el-stall:Math.floor(tcRnd(j,Math.floor(el))*2), s=ci, f;
      // which phase this student's own pace has them in, and how far through
      var acc=0, at=n-1; for(var q=0;q<n;q++){ if(v<acc+pl.phases[q].dur){ at=q; break; } acc+=pl.phases[q].dur; }
      f=Math.max(0,Math.min(1,(v-acc)/Math.max(1,pl.phases[at].dur)));
      var status, prog; if(at<ci){ status="behind"; prog=0; s=at; } else if(at>ci){ status="ahead"; prog=1; } else { prog=Math.min(1,f*1.25); status=prog>=1?"done":"now"; }
      if(idle>5) status="needs";
      var ph=pl.phases[s], k=lsKind(ph), base=Math.floor(8+tcRnd(j,3)*10);
      out.push({name:nm, initials:lsInitials(nm), status:status, prog:prog, idle:Math.round(idle), act:TC_ACT[ph.opens], frames:base, picks:Math.min(5,Math.round((ci>0?1:f)*5*(0.6+tcRnd(j,4)*0.5))), edits:k==="edits"?Math.round(prog*ph.n):0,
        thumb:HUB_FILL[j%HUB_FILL.length], pthumbs:[0,1,2,3].slice(0,Math.min(4,1+Math.floor(tcRnd(j,5)*4))).map(function(z){ return HUB_FILL[(j+z*3)%HUB_FILL.length]; }), where:LS_PLACES[ph.opens]+", frame "+(1+Math.floor(tcRnd(j,6)*base))}); });
    return out; }
  function tcRenderLive(){ var el=$("teacher").querySelector(".tc-live"), pl=tcPlan(), c=tcClass(); if(!pl) return;
    var live=tcLive(pl), cur=lsCur(pl, tcClock(pl)), T=cur.T, n=pl.phases.length, R=tcRoster(pl), inC=R.filter(function(s){ return s.status!=="out"; }).length;
    el.querySelector(".tl-status").innerHTML='<i class="'+(live?'on':'')+'"></i>'+(live?'LIVE':'REHEARSAL')+' · '+inC+' / '+R.length+' IN'+(live?'':' · <span class="dim">SEND THE PLAN AND OPEN THIS IN THE PERIOD TO GO LIVE</span>');
    el.querySelector("[data-tc=pause]").textContent=(live?pl.paused:tc.rPause)?'RESUME':'PAUSE';
    var tot=lsTotal(pl), W=el.querySelector(".tl-strip").clientWidth, k=W/tot;
    el.querySelector(".tl-strip").innerHTML=pl.phases.map(function(p,j){ var dn=R.filter(function(s){ return s.status==="done"||s.status==="ahead"; }).length;
      return '<span class="'+(j<cur.i?'past':j===cur.i?'now':'')+(p.firm?' firm':'')+'" style="width:'+(p.dur*k-3).toFixed(1)+'px">'+cbEsc(p.title.toUpperCase())+(j===cur.i?' · '+dn+' / '+inC+' DONE':'')+(p.firm?' · '+LS_PLACES[p.opens].toUpperCase():'')+'</span>'; }).join("");
    var nx=cur.next, nowX=Math.max(0,Math.min(W,(cur.now-pl.start)*k));
    el.querySelector(".tl-now").style.left=nowX.toFixed(1)+"px"; el.querySelector(".tl-now").innerHTML='<span>'+lsHM(cur.now)+(nx?' · '+cbEsc(nx.title.toUpperCase())+' IN '+Math.max(1,Math.ceil(cur.left))+' MIN':cur.i>=n?' · DONE':'')+'</span>';
    var cnt={all:inC, needs:0, behind:0, ahead:0, out:0}; R.forEach(function(s){ if(cnt[s.status]!=null) cnt[s.status]++; });
    el.querySelector(".tl-filters").innerHTML=[["all","EVERYONE"],["needs","NEEDS YOU"],["behind","BEHIND"],["ahead","AHEAD"],["out","NOT IN"]].map(function(f){ return '<button data-tc-f="'+f[0]+'" class="'+f[0]+(tc.filter===f[0]?' on':'')+'">'+(f[0]!=="all"?'<i></i>':'')+f[1]+' '+cnt[f[0]]+'</button>'; }).join("");
    var show=R.filter(function(s){ return tc.filter==="all"?true:s.status===tc.filter; }); if(!tc.pick) tc.pick=R[0].name;
    el.querySelector(".tl-grid").innerHTML=show.map(function(s){ var segN=5, seg=""; for(var q=0;q<segN;q++) seg+='<i class="'+(q<Math.round(s.prog*segN)?'on':'')+'"></i>';
      if(s.status==="out") return '<button class="tl-st out" data-tc-st="'+cbEsc(s.name)+'"><span class="th"><span>NOT SIGNED IN</span></span><span class="nm"><b>'+cbEsc(s.name)+'</b><small>NOT IN</small></span><span class="seg">'+seg+'</span></button>';
      var right=s.status==="needs"?'IDLE '+s.idle+' MIN':s.status==="ahead"?'AHEAD':s.status==="done"?'DONE':s.status==="behind"?'BEHIND':s.real?'THIS PC':(s.idle?s.idle+' MIN':'NOW');
      return '<button class="tl-st '+s.status+(tc.pick===s.name?' pick':'')+'" data-tc-st="'+cbEsc(s.name)+'"><span class="th"><img src="'+s.thumb+'" alt="" draggable="false"><em>'+(s.status==="needs"?'NEEDS YOU':s.act||'')+'</em></span><span class="nm"><b>'+cbEsc(s.real?"You (preview)":s.name)+'</b><small>'+right+'</small></span><span class="seg">'+seg+'</span></button>'; }).join("");
    // the selected student
    var P=R.filter(function(s){ return s.name===tc.pick; })[0]||R[0], key=c.code+"/"+P.name, notes=(lsDB.notes[key]||[]).slice(-3).reverse(), side=el.querySelector(".tl-side"), keepDraft=side.querySelector(".tl-in")&&side.getAttribute("data-who")===P.name?side.querySelector(".tl-in").value:"";
    var needs=R.filter(function(s){ return s.status==="needs"; });
    side.setAttribute("data-who",P.name);
    side.innerHTML='<span class="eb">SELECTED</span><div class="who"><h2>'+cbEsc(P.real?"You (preview)":P.name)+'</h2><span>'+(P.status==="out"?"NOT IN":P.status==="needs"?"NEEDS YOU":(P.act||""))+'</span></div>'
      +'<p class="desc">'+(P.status==="out"?'Not signed in yet.':'On '+cbEsc(P.where||"")+'. '+(P.idle>1?'Idle '+P.idle+' minutes. ':'Active just now. ')+P.frames+' frames, '+P.picks+' picked, '+P.edits+' edited.')+'</p>'
      +'<div class="pk">'+(P.pthumbs||[]).slice(0,5).map(function(u){ return '<img src="'+u+'" alt="">'; }).join("")+(P.status!=="out"&&(P.pthumbs||[]).length<5?'<span></span>':'')+'</div>'
      +(P.status!=="out"?'<button class="tl-look" data-tc="look">LOOK OVER THEIR SHOULDER <span>LIVE VIEW →</span></button>':'')
      +'<span class="eb nt">NOTES</span>'+(notes.length?notes.map(function(x){ return '<div class="note"><span>'+cbEsc(x.when)+' · '+(x.read?'READ':'SENT')+'</span><p>'+cbEsc(x.text)+'</p></div>'; }).join(""):'<p class="none">No notes yet.</p>')
      +'<input class="tl-in" placeholder="Leave a note for '+cbEsc((P.real?"your preview student":P.name.split(" ")[0]))+'…" maxlength="200">'
      +'<div class="qk">'+["Strong pick","Try it in B&W","Get closer","Watch your highlights"].map(function(q){ return '<button data-tc-q="'+q+'">'+q+'</button>'; }).join("")+'</div>'
      +(needs.length?'<div class="alert"><span class="h"><b>'+needs.length+' NEED'+(needs.length===1?'S':'')+' YOU</b><span>'+needs.map(function(s){ return cbEsc(s.name.toUpperCase()); }).join(" · ")+'</span></span><p>Idle '+needs.map(function(s){ return s.idle; }).sort(function(a,b){ return a-b; }).filter(function(v,i,a){ return i===0||i===a.length-1; }).join("–")+' minutes. A word from you usually gets them going.</p></div>':'');
    var inp=side.querySelector(".tl-in"); inp.value=keepDraft; inp.addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Enter"&&inp.value.trim()){ tcNote(P.name, inp.value.trim()); inp.value=""; } }); }
  function tcNote(name, text){ var c=tcClass(), key=c.code+"/"+name, d=lsNow(); (lsDB.notes[key]=lsDB.notes[key]||[]).push({text:text, when:d.toLocaleDateString("en-NZ",{weekday:"short"}).toUpperCase(), at:Date.now(), read:false}); lsSave(); if(typeof Sync!=="undefined"&&Sync.on()) Sync.sendNote(c.code, name, text).catch(function(){}); tcRenderLive(); toast("Note sent to "+(name===TC_PREVIEW?"your preview student":name)); }
  function tcLook(){ var pl=tcPlan(), P=tcRoster(pl).filter(function(s){ return s.name===tc.pick; })[0]; if(!P) return; var b=$("teacher").querySelector(".tc-board");
    var big=P.real&&photos.length?photos[photos.length-1].url:P.thumb;
    b.innerHTML='<div class="look"><img src="'+big+'" alt=""><div class="cap"><b>'+cbEsc(P.real?"You (preview)":P.name)+'</b><span>'+cbEsc((P.where||"").toUpperCase())+(P.real?'':' · REHEARSAL PREVIEW')+'</span></div><button data-tc="unboard">CLOSE <kbd>ESC</kbd></button></div>'; b.classList.remove("hidden"); }
  // ---- board: the phase and its clock, for the projector ----
  function tcBoard(){ var b=$("teacher").querySelector(".tc-board"); b.classList.remove("hidden"); b.setAttribute("data-mode","board"); tcBoardTick(); try{ b.requestFullscreen&&b.requestFullscreen(); }catch(e){} }
  function tcBoardTick(){ var b=$("teacher").querySelector(".tc-board"); if(b.classList.contains("hidden")||b.getAttribute("data-mode")!=="board") return; var pl=tcPlan(), c=tcClass(), cur=lsCur(pl, tcClock(pl)), ph=cur.ph, nx=cur.next;
    var s=Math.max(0,Math.round(cur.left*60)); b.innerHTML='<div class="brd"><span class="k">'+cbEsc(c.name.toUpperCase())+(ph?' · '+(cur.i+1)+' OF '+pl.phases.length:'')+'</span>'
      +(ph?'<h1>'+cbEsc(ph.title)+'.</h1><p>'+cbEsc(ph.does)+'.'+(ph.words?' <em>“'+cbEsc(ph.words)+'”</em>':'')+'</p><div class="clk">'+Math.floor(s/60)+':'+("0"+s%60).slice(-2)+'</div>'+(nx?'<span class="nx">THEN '+cbEsc(nx.title.toUpperCase())+' AT '+lsHM(cur.T[cur.i].e)+'</span>':''):'<h1>'+(cur.i<0?'Starting soon.':'That’s the period.')+'</h1>')
      +'<span class="cd">JOIN WITH CODE <b>'+cbEsc(c.code)+'</b></span><button data-tc="unboard">CLOSE <kbd>ESC</kbd></button></div>'; }
  function tcUnboard(){ var b=$("teacher").querySelector(".tc-board"); b.classList.add("hidden"); b.removeAttribute("data-mode"); try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(e){} }

  function tcRender(){ tcRenderBar(); if(tc.tab==="plan") tcRenderPlan(); else tcRenderLive(); }
  var _tcTick=0;
  function tcTick(){ if(++_tcTick%5===0||tc.tab==="live"){ if(tc.drag==null&&!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest("#teacher input"))){ tcRenderBar(); if(tc.tab==="plan") tcRenderPlan(true); else tcRenderLive(); } } tcBoardTick(); }
  function tcAct(a, b){ var pl=tcPlan(), c=tcClass(), live=tcLive(pl);
    if(a==="cls") return tcPop();
    if(a==="add"){ pl.phases.push({id:lsUid(), title:"New phase", does:"", words:"", opens:"select", n:0, dur:10, firm:false}); tc.sel=pl.phases.length-1; lsSave(); return tcRenderPlan(); }
    if(a==="del"){ pl.phases.splice(tc.sel,1); tc.sel=Math.max(0,tc.sel-1); lsSave(); return tcRenderPlan(); }
    if(a==="n-"||a==="n+"){ var ph=pl.phases[tc.sel]; ph.n=Math.max(1,Math.min(40,ph.n+(a==="n+"?1:-1))); lsSave(); return tcRenderPlan(true); }
    if(a==="send"){ pl.sent=true; pl.date=lsToday(); lsSave(); if(typeof Sync!=="undefined"&&Sync.on()) Sync.pushPlan(pl); toast("Sent to "+c.name+". Students see it on their hub."); return tcRender(); }
    if(a==="plus5"){ lsPlus5(pl, tcClock(pl)); return tcRender(); }
    if(a==="pause"){ if(live) lsTogglePause(pl); else { if(tc.rPause){ tc.rehearse+=Date.now()-tc.rPause; tc.rPause=0; } else tc.rPause=Date.now(); } return tcRender(); }
    if(a==="moveon"){ lsMoveOn(pl, tcClock(pl)); return tcRender(); }
    if(a==="board") return tcBoard();
    if(a==="unboard") return tcUnboard();
    if(a==="look") return tcLook();
    if(a==="preview"){ lsSetWho({role:"student", name:TC_PREVIEW, code:c.code, preview:true, teacherName:c.teacher}); $("teacher").classList.add("hidden"); return showHub(); }
    if(a==="out"){ lsSetWho(null); $("teacher").classList.add("hidden"); return siShow(); } }
  (function wireTeacher(){ var t=$("teacher"); if(!t) return;
    t.addEventListener("click",function(e){ var b=e.target.closest("[data-tc],[data-tc-tab],[data-tc-tpl],[data-tc-blk],[data-tc-open],[data-tc-firm],[data-tc-f],[data-tc-st],[data-tc-q]"); if(!b) return; var pl=tcPlan();
      if(b.hasAttribute("data-tc")) return tcAct(b.getAttribute("data-tc"), b);
      if(b.hasAttribute("data-tc-tab")) return tcTab(b.getAttribute("data-tc-tab"));
      if(b.hasAttribute("data-tc-tpl")){ var keep=pl.start; var np=lsNewPlan(tcClass(), b.getAttribute("data-tc-tpl")); np.start=keep; np.sent=pl.sent; lsDB.plans[pl.code]=np; tc.sel=0; lsSave(); return tcRenderPlan(); }
      if(b.hasAttribute("data-tc-blk")){ tc.sel=+b.getAttribute("data-tc-blk"); return tcRenderPlan(); }
      if(b.hasAttribute("data-tc-open")){ var ph=pl.phases[tc.sel]; ph.opens=b.getAttribute("data-tc-open"); if(lsKind(ph)==="none") ph.n=0; else if(!ph.n) ph.n=lsKind(ph)==="shots"?12:2; lsSave(); return tcRenderPlan(); }
      if(b.hasAttribute("data-tc-firm")){ pl.phases[tc.sel].firm=b.getAttribute("data-tc-firm")==="1"; lsSave(); return tcRenderPlan(); }
      if(b.hasAttribute("data-tc-f")){ tc.filter=b.getAttribute("data-tc-f"); return tcRenderLive(); }
      if(b.hasAttribute("data-tc-st")){ tc.pick=b.getAttribute("data-tc-st"); return tcRenderLive(); }
      if(b.hasAttribute("data-tc-q")) return tcNote(tc.pick, b.getAttribute("data-tc-q")+"."); });
    t.addEventListener("pointerdown",function(e){ var g=e.target.closest("[data-tc-edge]"); if(g) tcEdgeDrag(e, +g.getAttribute("data-tc-edge")); });
    window.addEventListener("keydown",function(e){ if(!App.is("teacher")) return; if(e.target&&e.target.tagName==="INPUT") return;
      if(e.code==="Escape"){ var b=t.querySelector(".tc-board"); if(!b.classList.contains("hidden")){ e.preventDefault(); tcUnboard(); } else tcPop(false); }
      else if(e.code==="Tab"){ e.preventDefault(); tcTab(tc.tab==="plan"?"live":"plan"); } }, true);
    window.addEventListener("resize",function(){ if(App.is("teacher")) tcRender(); }); })();
