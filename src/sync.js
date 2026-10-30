  // ================= SYNC: Supabase, the Studium project =================
  // Off until the page defines window.STUDIUM_SUPABASE = {url, anonKey, providers:["google"]} (build.mjs writes it from
  // studium.config.json). With it on: school Google sign-in, class codes looked up on the server, the teacher's plan
  // pushed to the class, each student's presence and the teacher's notes both ways, and the workbook saved page by page
  // so the studium-drive function can rebuild the student's Google Slides deck in the teacher's Drive on sign-out.
  // Studium's tables are all studium_* so they sit beside Punctum's. Schema: docs/supabase.sql. Uses plain REST.
  var Sync=(function(){
    var cfg=window.STUDIUM_SUPABASE||null, session=null, user=null, dirty=false, busy=false, back=false, wbSig="", wbBusy=null, lastWb=0;
    var BUCKET="studium-workbooks";
    function on(){ return !!(cfg&&cfg.url&&cfg.anonKey); }
    function providers(){ return on()?(cfg.providers||["google"]):[]; }
    function keep(){ try{ if(session) sessionStorage.setItem("studium_sb", JSON.stringify(session)); else sessionStorage.removeItem("studium_sb"); }catch(e){} }
    try{ session=JSON.parse(sessionStorage.getItem("studium_sb")||"null"); }catch(e){}
    // OAuth comes back with the token in the hash
    (function readHash(){ if(!on()) return; var h=location.hash||""; if(h.indexOf("access_token=")<0) return; var q={};
      h.slice(1).split("&").forEach(function(kv){ var p=kv.split("="); q[p[0]]=decodeURIComponent(p[1]||""); });
      session={access_token:q.access_token, refresh_token:q.refresh_token, expires_at:Date.now()+(+q.expires_in||3600)*1000}; back=true; keep();
      try{ history.replaceState(null,"",location.pathname+location.search); }catch(e){} })();
    // the access token lasts an hour; a period can be longer, so swap it with the refresh token a minute before it runs out
    var refreshing=null;
    function fresh(){ if(!session||!session.refresh_token||Date.now()<session.expires_at-60000) return Promise.resolve();
      if(refreshing) return refreshing;
      refreshing=fetch(cfg.url+"/auth/v1/token?grant_type=refresh_token",{method:"POST", headers:{apikey:cfg.anonKey, "Content-Type":"application/json"}, body:JSON.stringify({refresh_token:session.refresh_token})})
        .then(function(r){ return r.ok?r.json():null; }).then(function(j){ refreshing=null;
          if(j&&j.access_token){ session={access_token:j.access_token, refresh_token:j.refresh_token, expires_at:Date.now()+(+j.expires_in||3600)*1000}; keep(); }
          else { session=null; user=null; keep(); } },function(){ refreshing=null; });
      return refreshing; }
    function req(path, opt){ opt=opt||{};
      return fresh().then(function(){ var h={apikey:cfg.anonKey, Authorization:"Bearer "+(session?session.access_token:cfg.anonKey)};
        if(!opt.raw) h["Content-Type"]="application/json"; if(opt.prefer) h.Prefer=opt.prefer; if(opt.headers) for(var k in opt.headers) h[k]=opt.headers[k];
        return fetch(cfg.url+path, {method:opt.method||"GET", headers:h, body:opt.raw?opt.raw:opt.body?JSON.stringify(opt.body):undefined, keepalive:!!opt.keepalive}); })
        .then(function(r){ if(!r.ok) throw new Error("sync "+r.status); return r.text().then(function(t){ try{ return t?JSON.parse(t):null; }catch(e){ return null; } }); }); }
    function rest(t, opt){ return req("/rest/v1/"+t, opt); }
    function enc(s){ return encodeURIComponent(s); }

    // ---- signing in ----
    // after = "student" or "teacher": where to land when Google sends them back
    function signIn(provider, after){ if(!on()) return; try{ sessionStorage.setItem("studium_after", after||"student"); }catch(e){}
      location.href=cfg.url+"/auth/v1/authorize?provider="+(provider==="microsoft"?"azure":"google")+"&redirect_to="+enc(location.href.split("#")[0])+(provider==="microsoft"?"":"&scopes=email%20profile"); }
    function signedIn(){ return on()&&!!session; }
    /* a fresh access token for the live connection (duel.js); null when signed out */
    function token(){ if(!signedIn()) return Promise.resolve(null); return fresh().then(function(){ return session?session.access_token:null; }); }
    function justBack(){ var b=back; back=false; var a=null; try{ a=sessionStorage.getItem("studium_after"); sessionStorage.removeItem("studium_after"); }catch(e){} return b?(a||"student"):null; }
    function me(){ if(!session) return Promise.resolve(null); if(user) return Promise.resolve(user);
      return req("/auth/v1/user").then(function(u){ var m=(u&&u.user_metadata)||{}; user=u?{id:u.id, email:u.email||"", name:m.full_name||m.name||(u.email||"").split("@")[0]}:null; return user; }); }
    function forget(){ session=null; user=null; csReady=false; clearTimeout(csT); csT=null; csSig=""; clearTimeout(csRetry); keep(); }

    // ---- classes ----
    function joinClass(code){ return rest("rpc/studium_class_by_code",{method:"POST", body:{c:code}}).then(function(r){ return r&&r[0]||null; }).catch(function(){ return null; }); }
    function myMembership(){ return me().then(function(u){ if(!u) return null; return rest("studium_members?user_id=eq."+u.id+"&select=class_code,name&order=joined_at.desc&limit=1").then(function(r){ return r&&r[0]||null; }); }).catch(function(){ return null; }); }
    /* names are unique in a class (teacher notes find a student by name): a second "Sam Smith" joins with their email name added. Resolves to the name used. */
    function addMember(code, name){ return me().then(function(u){ var put=function(nm){ return rest("studium_members",{method:"POST", body:{class_code:code, user_id:u.id, name:nm, email:u.email}}).then(function(){ return nm; }); };
      return put(name).catch(function(){ return myMembership().then(function(m){ if(m&&m.class_code===code) return m.name; return put(name+" ("+(u.email||"").split("@")[0]+")"); }); }); }); }
    function myClasses(){ return me().then(function(u){ if(!u) return []; return rest("studium_classes?teacher_id=eq."+u.id+"&select=code,name,teacher,period,start&order=created_at.asc"); }).catch(function(){ return []; }); }
    var classT=0;
    function pushClass(c){ if(!signedIn()||!c) return; clearTimeout(classT);   /* typing in the class popup: send once it settles */
      classT=setTimeout(function(){ rest("studium_classes?on_conflict=code",{method:"POST", prefer:"resolution=merge-duplicates", body:{code:c.code, name:c.name||"My class", teacher:c.teacher||null, period:c.period?String(c.period):null, start:c.start|0}}).catch(function(e){ console.warn(e); }); }, 600); }

    // ---- the lesson ----
    function pushPlan(pl){ return rest("studium_plans?on_conflict=class_code,date",{method:"POST", prefer:"resolution=merge-duplicates", body:{class_code:pl.code, date:pl.date, body:pl}}).catch(function(e){ console.warn(e); }); }
    function pullPlan(code){ return rest("studium_plans?class_code=eq."+enc(code)+"&date=eq."+lsToday()+"&select=body").then(function(r){ return r&&r[0]?r[0].body:null; }); }
    function presence(rec){ return rest("studium_presence?on_conflict=class_code,student",{method:"POST", prefer:"resolution=merge-duplicates", body:rec}).catch(function(){}); }
    function roster(code){ return rest("studium_presence?class_code=eq."+enc(code)+"&select=*"); }
    function rarity(code){ return rest("rpc/studium_ach_rarity",{method:"POST", body:{code:code}}); }
    function sendFeedback(rec){ return rest("studium_feedback",{method:"POST", body:rec}).catch(function(){}); }
    function sendNote(code, student, text){ return rest("studium_notes",{method:"POST", body:{class_code:code, student:student, body:text}}); }
    function pullNotes(code, student){ return rest("studium_notes?class_code=eq."+enc(code)+"&student=eq."+enc(student)+"&order=created_at.asc&select=*"); }

    // ---- the workbook: each page as a JPEG, only the ones that changed ----
    function wbDoc(){ if(typeof wsEnsure==="function") wsEnsure(); return (typeof st!=="undefined"&&st.wsBoard)||null; }
    function wbSignature(){ var d=wbDoc(); if(!d) return ""; var s=JSON.stringify(d.pages||[]); return s.length+":"+s.slice(0,64)+s.slice(-256); }
    function sha(blob){ if(!(window.crypto&&crypto.subtle)) return Promise.resolve(String(Date.now())+Math.random());
      return blob.arrayBuffer().then(function(b){ return crypto.subtle.digest("SHA-256", b); }).then(function(h){ return Array.prototype.map.call(new Uint8Array(h),function(x){ return ("0"+x.toString(16)).slice(-2); }).join("").slice(0,32); }); }
    function pageJpeg(pg){ return new Promise(function(res){ wsB.draw(pg, 120/25.4, function(cv){ cv.toBlob(function(b){ res(b); }, "image/jpeg", 0.85); }); }); }
    function saveWorkbook(){ if(wbBusy) return wbBusy;
      var w=lsWho(), d=wbDoc(); if(!signedIn()||!w||w.role!=="student"||!w.code||typeof wsB==="undefined") return Promise.resolve(false);
      var pages=((d&&d.pages)||[]).filter(function(p){ return p.items&&p.items.some(function(it){ return !it.hidden&&it.t!=="slot"; }); }), sig=wbSignature();
      wbBusy=me().then(function(u){ if(!u) return false;
        /* the workbook lives on this computer: it only ever goes into the deck of the student who started it here */
        if(!lsDB.wbOwner){ lsDB.wbOwner=u.id; lsSave(); } else if(lsDB.wbOwner!==u.id){ console.warn("workbook on this computer belongs to another student"); return false; }
        return rest("studium_workbooks?user_id=eq."+u.id+"&select=pages").then(function(r){ var had={}; ((r&&r[0]&&r[0].pages)||[]).forEach(function(p){ had[p.id]=p.hash; });
          var out=[], i=0;
          function next(){ if(i>=pages.length) return Promise.resolve();
            var pg=pages[i++], id=String(pg.id||("p"+i)).replace(/[^A-Za-z0-9_-]/g,"");
            return pageJpeg(pg).then(function(b){ if(!b) return; return sha(b).then(function(h){ var path=u.id+"/"+id+".jpg"; out.push({id:id, path:path, hash:h});
              if(had[id]===h) return;   /* unchanged since the last save */
              return req("/storage/v1/object/"+BUCKET+"/"+path,{method:"POST", raw:b, headers:{"Content-Type":"image/jpeg", "x-upsert":"true", "cache-control":"60"}}); }); }).then(next); }
          return next().then(function(){
            return rest("studium_workbooks?on_conflict=user_id",{method:"POST", prefer:"resolution=merge-duplicates", body:{user_id:u.id, class_code:w.code, student:w.name, pages:out, updated_at:new Date().toISOString()}}); })
            .then(function(){ wbSig=sig; lastWb=Date.now(); return true; }); }); })
        .catch(function(e){ console.warn("workbook save", e); return false; })
        .then(function(v){ wbBusy=null; return v; });
      return wbBusy; }

    // ---- the teacher's Google Drive (the studium-drive function) ----
    function drive(action, body){ if(!signedIn()) return Promise.reject(new Error("not signed in")); body=body||{}; body.action=action;
      return fresh().then(function(){ return fetch(cfg.url+"/functions/v1/studium-drive",{method:"POST", keepalive:action==="build", headers:{apikey:cfg.anonKey, Authorization:"Bearer "+session.access_token, "Content-Type":"application/json"}, body:JSON.stringify(body)}); })
        .then(function(r){ return r.json().catch(function(){ return {ok:false}; }); }); }
    function driveStatus(){ return drive("status"); }
    function driveConnect(){ return drive("link",{back:location.href.split("#")[0]}).then(function(j){ if(j&&j.url) location.href=j.url; return j; }); }
    function driveRebuild(code){ return drive("build",{class_code:code}); }

    // ---- the whole session in the cloud: a signed-in student's photos, edits, presets, boards and quests follow their
    // Google account to any computer. <uid>/session.json is the session with every image swapped for an "sb:<path>"
    // reference; each image is its own file at <uid>/i/<hash>.<ext>, uploaded once, so a save only sends what's new.
    var SAVES="studium-saves", csWarned=false, csBusy=null, csAgain=false, csT=null, csReady=false, csRestoring=null, csSig="", csRetry=null;
    function csOk(){ var w=lsWho(); return signedIn()&&!!w&&((w.role==="student"&&!w.demo)||(!!w.demo&&!!w.google)); }   /* a signed-in demo player's demo follows them too */
    /* the demo saves apart from real work, in the cloud as on this computer: <uid>/demo.json, with its own owner */
    function csDemo(){ var w=lsWho(); return !!(w&&w.demo); }
    function csFile(){ return csDemo()?"demo.json":"session.json"; }
    function csOwnKey(){ return csDemo()?"csDemoOwner":"csOwner"; }
    function csHave(uid){ try{ return JSON.parse(localStorage.getItem("studium_cs_"+uid)||"{}")||{}; }catch(e){ return {}; } }
    function csKeep(uid,h){ try{ localStorage.setItem("studium_cs_"+uid, JSON.stringify(h)); }catch(e){} }
    function csExt(t){ return /png/.test(t||"")?"png":/webp/.test(t||"")?"webp":"jpg"; }
    function csWalk(o, fn){ if(typeof o==="string") return fn(o);
      if(Array.isArray(o)){ for(var i=0;i<o.length;i++) o[i]=csWalk(o[i],fn); return o; }
      if(o&&typeof o==="object"){ for(var k in o) if(Object.prototype.hasOwnProperty.call(o,k)) o[k]=csWalk(o[k],fn); }
      return o; }
    function csImg(s){ return s.length>100&&(/^data:image\//.test(s)||/^blob:/.test(s)); }
    /* run jobs a few at a time */
    function csPool(items, n, fn){ var i=0; function lane(){ if(i>=items.length) return Promise.resolve(); var k=i++; return Promise.resolve(fn(items[k],k)).then(lane); }
      var ls=[]; for(var j=0;j<Math.min(n,items.length);j++) ls.push(lane()); return Promise.all(ls); }
    function csGet(path){ return fresh().then(function(){ return fetch(cfg.url+"/storage/v1/object/authenticated/"+SAVES+"/"+path,{cache:"no-store", headers:{apikey:cfg.anonKey, Authorization:"Bearer "+session.access_token}}); }); }
    function csPut(path, blob, type){ return req("/storage/v1/object/"+SAVES+"/"+path,{method:"POST", raw:blob, headers:{"Content-Type":type, "x-upsert":"true", "cache-control":path.slice(-5)===".json"?"no-cache":"31536000"}}); }
    /* this student's own fresh start: nothing of whoever used this computer before (photos, boards, quests, presets) */
    /* theirs: the work here is another Google player's, so their Blades collection goes too (a cloud copy that brings
       its own replaces it in applySession; an older copy without one leaves this computer's alone) */
    function csBlank(theirs){ wipeWorkspace(); if(theirs) try{ localStorage.removeItem(typeof ltSecretKey==="function"?ltSecretKey():"studium_secret_v1"); }catch(e){}
      try{ localStorage.removeItem(csDemo()?"studium_quests_demo_v1":"studium_quests_v1"); }catch(e){} if(typeof qLoad==="function") Q=qLoad();
      try{ localStorage.removeItem("studium_presets_v1"); }catch(e){} if(typeof PR!=="undefined"){ PR.items=[]; PR.folders=PR.folders.filter(function(x){ return x.fixed; }).concat([{id:"mine",name:"My looks",open:true}]); }   /* set directly: prLoad merges in what's already here */
      if(typeof studioSync==="function") studioSync(); }
    function cloudSave(){ if(!csOk()||!csReady) return Promise.resolve(false);
      if(csBusy){ csAgain=true; return csBusy; }
      csBusy=me().then(function(u){ if(!u) return false;
        if(lsDB[csOwnKey()]!==u.id) return false;   /* this computer's work belongs to someone else */
        var d=JSON.parse(JSON.stringify(sessionData())); if(!d.photos.length&&!(d.folio&&d.folio.length)) return false;
        var have=csHave(u.id), urls=[], at={}, finger=[];
        csWalk(d, function(s){ if(!csImg(s)) return s; if(!(s in at)){ at[s]=urls.length; urls.push(s); finger.push(s.length+":"+s.slice(-40)); } return "\u0000cs"+at[s]; });
        var saved=d.savedAt; delete d.savedAt; var sig=JSON.stringify(d)+finger.join("|"); d.savedAt=saved;
        if(sig===csSig) return true;   /* nothing changed since the last upload */
        var paths=[];
        return csPool(urls, 3, function(s,k){ return fetch(s).then(function(r){ return r.blob(); }).then(function(b){ return sha(b).then(function(h){
            var p=u.id+"/i/"+h+"."+csExt(b.type); paths[k]=p; if(have[h]) return; return csPut(p, b, b.type||"image/jpeg").then(function(){ have[h]=1; }); }); }); })
          .then(function(){ csWalk(d, function(s){ return s.slice(0,3)==="\u0000cs"?"sb:"+paths[+s.slice(3)]:s; });
            d.owner=u.id; return csPut(u.id+"/"+csFile(), new Blob([JSON.stringify(d)],{type:"application/json"}), "application/json"); })
          .then(function(){ csKeep(u.id, have); csSig=sig; return true; }); })
        .catch(function(e){ console.warn("cloud save", e); return false; })
        .then(function(v){ csBusy=null; if(csAgain){ csAgain=false; cloudSoon(); } return v; });
      return csBusy; }
    /* about 20 s after a change; a timer already waiting is left alone, so steady saving can't keep pushing it back */
    function cloudSoon(){ if(!csOk()||csT) return; csT=setTimeout(function(){ csT=null; cloudSave(); }, 20000); }
    /* the saved session, or "none" when there isn't one yet. Anything else (offline, a server error) throws, so a
       hiccup is never mistaken for an empty account and saved over */
    function cloudHead(u){ return csGet(u.id+"/"+csFile()).then(function(r){ if(r.ok) return r.json();
        return r.text().then(function(t){ if(r.status===404||(r.status===400&&/not.?found|404/i.test(t))) return "none"; throw new Error("session "+r.status); }); }); }
    function cloudImages(u, d){ var refs=[], at={}, have=csHave(u.id), got={};
      csWalk(d, function(s){ if(s.slice(0,3)==="sb:"&&!(s in at)){ at[s]=refs.length; refs.push(s); } return s; });
      return csPool(refs, 4, function(s){ return csGet(s.slice(3)).then(function(r){ if(!r.ok) throw new Error("image "+r.status); return r.blob(); })
          .then(function(b){ return new Promise(function(res,rej){ var fr=new FileReader(); fr.onload=function(){ got[s]=fr.result; res(); }; fr.onerror=function(){ rej(new Error("image read")); }; fr.readAsDataURL(b); }); })
          .then(function(){ var h=/\/i\/([0-9a-f]+)\./.exec(s); if(h) have[h[1]]=1; }); })
        .then(function(){ csKeep(u.id, have); return csWalk(d, function(s){ return (s in got)?got[s]:s; }); }); }
    /* signing in on any computer: the newer of this computer's work and the cloud's wins; another student's work here is never uploaded as yours */
    function cloudRestore(){ if(!csOk()) return Promise.resolve(false); if(csRestoring) return csRestoring; clearTimeout(csRetry);
      csRestoring=me().then(function(u){ if(!u) return false;
        return new Promise(function(res){ (function wait(){ if(typeof sessionLoaded!=="undefined"&&sessionLoaded) res(); else setTimeout(wait,150); })(); })
          .then(function(){ var ok=csOwnKey(), mine=lsDB[ok]===u.id, theirs=!!lsDB[ok]&&!mine, localAt=sessionLocalAt||0;   /* unowned work here (no Google) is adopted only when the account has none yet */
            return cloudHead(u).then(function(d){
              if(d!=="none"&&(!mine||!photos.length||(d.savedAt||0)>localAt)){
                toast("Bringing your work back…");
                return cloudImages(u, d).then(function(full){
                  csBlank(theirs); applySession(full, true); lsDB[ok]=u.id; lsSave(); csReady=true; saveSessionNow();
                  if(typeof studioSync==="function") studioSync(); if(typeof App!=="undefined"&&App.is("hub")&&typeof hubRender==="function") hubRender();
                  var n=photos.length; toast("Your work is back · "+n+" photo"+(n===1?"":"s")); return true; }); }
              if(theirs) csBlank(true);   /* another student's work was on this computer: start this student clean */
              lsDB[ok]=u.id; lsSave(); csReady=true; cloudSave(); return false; }); }); })
        .catch(function(e){ console.warn("cloud restore", e);
          if(!csWarned){ csWarned=true; toast("We couldn't reach your saved work. Anything you do now stays on this computer until it connects."); }
          csRetry=setTimeout(cloudRestore, 60000); return false; })   /* not ready: nothing is uploaded over the cloud copy until a restore succeeds */
        .then(function(v){ csRestoring=null; return v; });
      return csRestoring; }
    /* a reload in the same tab keeps the sign-in: pick the cloud back up once the page has settled (not straight after
       Google sends someone back, which routes itself) */
    if(on()&&session&&!back) setTimeout(function(){ if(csOk()) cloudRestore(); }, 3000);

    // ---- signing out: the session and workbook go up, the deck is rebuilt, then the session is forgotten ----
    function signOut(){ if(!signedIn()){ forget(); return Promise.resolve(); }
      clearTimeout(csT); csT=null; if(typeof saveSessionNow==="function") saveSessionNow();
      var w=lsWho(), job=(w&&w.role==="student")?(csBusy||Promise.resolve()).then(function(){ return cloudSave(); }).then(function(){ return saveWorkbook(); }).then(function(){ return drive("build"); })
        :csOk()?(csBusy||Promise.resolve()).then(function(){ return cloudSave(); }):Promise.resolve();   /* a demo player: their demo goes up */
      if(typeof Duel!=="undefined") Duel.stop();
      var cap=new Promise(function(res){ setTimeout(res, 30000); });   /* a slow network never strands someone on a shared computer */
      return Promise.race([job.catch(function(){}), cap]).then(forget); }

    // every 20 s: students send where they are and pull the plan and their notes; teachers pull the roster.
    // The workbook goes up at most every 10 minutes, and only when it has changed.
    function beat(){ if(!on()||busy) return; var w=lsWho(); if(!w||!w.code) return; busy=true;
      var jobs=[];
      if(w.role==="student"){
        jobs.push(presence({class_code:w.code, student:w.name, state:App.state, frames:photos.length, picks:stPicks().length, edits:lsCount("edits"), quest:(typeof qMode==="function"&&qMode())?qSummary():null, seen_at:new Date().toISOString()}));
        jobs.push(pullPlan(w.code).then(function(p){ if(p){ lsDB.plans[w.code]=p; try{ localStorage.setItem(LS_KEY, JSON.stringify(lsDB)); }catch(e){} } }).catch(function(){}));
        jobs.push(pullNotes(w.code, w.name).then(function(r){ var key=w.code+"/"+w.name, have=lsDB.notes[key]||[];
          (r||[]).forEach(function(n){ if(have.some(function(h){ return h.id===n.id; })) return;
            /* "§tick:m3" or "§tick:m3:1" is the teacher ticking a quest or one step off; applied once, never shown as a note */
            var tk=/^§tick:(\w+)(?::(\d+))?$/.exec(n.body||""); if(tk){ if(typeof qTeacherTick==="function") qTeacherTick(tk[1], tk[2]!=null?+tk[2]:null); have.push({id:n.id, tick:true, read:true, text:""}); return; }
            have.push({id:n.id, text:n.body, when:new Date(n.created_at).toLocaleDateString("en-NZ",{weekday:"short"}).toUpperCase(), read:false}); });
          lsDB.notes[key]=have; }).catch(function(){}));
        if(signedIn()&&Date.now()-lastWb>600000&&wbSignature()!==wbSig){ lastWb=Date.now(); saveWorkbook(); } }
      if(w.role==="teacher") jobs.push(roster(w.code).then(function(r){ if(typeof tc!=="undefined") tc.remote=r||null; }).catch(function(){}));
      if(w.role==="teacher"&&dirty){ var p=lsDB.plans[w.code]; if(p&&p.sent) jobs.push(pushPlan(p)); dirty=false; }
      Promise.all(jobs).then(function(){ busy=false; },function(){ busy=false; }); }
    if(on()) setInterval(beat, 20000);
    return {on:on, providers:providers, signIn:signIn, signedIn:signedIn, justBack:justBack, me:me, signOut:signOut, token:token, cfg:function(){ return cfg; },
      joinClass:joinClass, myMembership:myMembership, addMember:addMember, myClasses:myClasses, pushClass:pushClass,
      pushPlan:pushPlan, pullPlan:pullPlan, roster:roster, sendNote:sendNote, sendFeedback:sendFeedback, rarity:rarity, pullNotes:pullNotes,
      saveWorkbook:saveWorkbook, cloudSave:cloudSave, cloudSoon:cloudSoon, cloudRestore:cloudRestore, driveStatus:driveStatus, driveConnect:driveConnect, driveRebuild:driveRebuild,
      beat:beat, dirty:function(){ dirty=true; }};
  })();
  if(/[?&]dev(&|=|$)/.test(location.search)) window.__sy={Sync:Sync, who:function(){ return lsWho(); }, st:function(){ return st; }, hub:function(a){ return hubAct(a); }, si:function(a){ return siAct(a); }, pop:function(o){ return tcPop(o); }};   /* dev hook for the sign-in / workbook checks */
