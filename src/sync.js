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
    function justBack(){ var b=back; back=false; var a=null; try{ a=sessionStorage.getItem("studium_after"); sessionStorage.removeItem("studium_after"); }catch(e){} return b?(a||"student"):null; }
    function me(){ if(!session) return Promise.resolve(null); if(user) return Promise.resolve(user);
      return req("/auth/v1/user").then(function(u){ var m=(u&&u.user_metadata)||{}; user=u?{id:u.id, email:u.email||"", name:m.full_name||m.name||(u.email||"").split("@")[0]}:null; return user; }); }
    function forget(){ session=null; user=null; keep(); }

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

    // ---- signing out: the workbook goes up, the deck is rebuilt, then the session is forgotten ----
    function signOut(){ if(!signedIn()){ forget(); return Promise.resolve(); }
      var w=lsWho(), job=(w&&w.role==="student")?saveWorkbook().then(function(){ return drive("build"); }):Promise.resolve();
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
    return {on:on, providers:providers, signIn:signIn, signedIn:signedIn, justBack:justBack, me:me, signOut:signOut,
      joinClass:joinClass, myMembership:myMembership, addMember:addMember, myClasses:myClasses, pushClass:pushClass,
      pushPlan:pushPlan, pullPlan:pullPlan, roster:roster, sendNote:sendNote, sendFeedback:sendFeedback, rarity:rarity, pullNotes:pullNotes,
      saveWorkbook:saveWorkbook, driveStatus:driveStatus, driveConnect:driveConnect, driveRebuild:driveRebuild,
      beat:beat, dirty:function(){ dirty=true; }};
  })();
  if(/[?&]dev(&|=|$)/.test(location.search)) window.__sy={Sync:Sync, who:function(){ return lsWho(); }, st:function(){ return st; }, hub:function(a){ return hubAct(a); }, si:function(a){ return siAct(a); }, pop:function(o){ return tcPop(o); }};   /* dev hook for the sign-in / workbook checks */
