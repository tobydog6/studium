  // ================= SYNC: Supabase (Sydney), shared with Punctum =================
  // Off until the page defines window.STUDIUM_SUPABASE = {url:"https://<ref>.supabase.co", anonKey:"..."} (the
  // build's --supabase flag writes it). With it on: school Google / Microsoft sign-in, class codes looked up on the
  // server, the teacher's plan pushed to the class, each student's presence every 20 s for the live view, and notes
  // both ways. Tables and row-level security are in docs/supabase.sql. Uses plain REST so the file stays offline-safe.
  var Sync=(function(){
    var cfg=window.STUDIUM_SUPABASE||null, session=null, dirty=false, busy=false;
    function on(){ return !!(cfg&&cfg.url&&cfg.anonKey); }
    try{ session=JSON.parse(sessionStorage.getItem("studium_sb")||"null"); }catch(e){}
    // OAuth comes back with the token in the hash
    (function readHash(){ if(!on()) return; var h=location.hash||""; if(h.indexOf("access_token=")<0) return; var q={};
      h.slice(1).split("&").forEach(function(kv){ var p=kv.split("="); q[p[0]]=decodeURIComponent(p[1]||""); });
      session={access_token:q.access_token, refresh_token:q.refresh_token, expires_at:Date.now()+(+q.expires_in||3600)*1000};
      try{ sessionStorage.setItem("studium_sb", JSON.stringify(session)); history.replaceState(null,"",location.pathname+location.search); }catch(e){} })();
    function req(path, opt){ opt=opt||{}; var h={apikey:cfg.anonKey, Authorization:"Bearer "+(session?session.access_token:cfg.anonKey), "Content-Type":"application/json"};
      if(opt.prefer) h.Prefer=opt.prefer;
      return fetch(cfg.url+path, {method:opt.method||"GET", headers:h, body:opt.body?JSON.stringify(opt.body):undefined})
        .then(function(r){ if(!r.ok) throw new Error("sync "+r.status); return r.status===204?null:r.json(); }); }
    function rest(t, opt){ return req("/rest/v1/"+t, opt); }
    function signIn(provider){ if(!on()) return; location.href=cfg.url+"/auth/v1/authorize?provider="+(provider==="microsoft"?"azure":"google")+"&redirect_to="+encodeURIComponent(location.href.split("#")[0]); }
    function me(){ return session?req("/auth/v1/user"):Promise.resolve(null); }
    function joinClass(code){ return rest("classes?code=eq."+encodeURIComponent(code)+"&select=code,name,teacher,period,start").then(function(r){ return r&&r[0]||null; }).catch(function(){ return null; }); }
    function pushPlan(pl){ return rest("plans?on_conflict=class_code,date",{method:"POST", prefer:"resolution=merge-duplicates", body:{class_code:pl.code, date:pl.date, body:pl}}).catch(function(e){ console.warn(e); }); }
    function pullPlan(code){ return rest("plans?class_code=eq."+encodeURIComponent(code)+"&date=eq."+lsToday()+"&select=body").then(function(r){ return r&&r[0]?r[0].body:null; }); }
    function presence(rec){ return rest("presence?on_conflict=class_code,student",{method:"POST", prefer:"resolution=merge-duplicates", body:rec}).catch(function(){}); }
    function roster(code){ return rest("presence?class_code=eq."+encodeURIComponent(code)+"&select=*"); }
    function sendNote(code, student, text){ return rest("notes",{method:"POST", body:{class_code:code, student:student, body:text}}); }
    function pullNotes(code, student){ return rest("notes?class_code=eq."+encodeURIComponent(code)+"&student=eq."+encodeURIComponent(student)+"&order=created_at.asc&select=*"); }
    // every 20 s: students send where they are and pull the plan and their notes; teachers pull the roster
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
          lsDB.notes[key]=have; }).catch(function(){})); }
      if(w.role==="teacher") jobs.push(roster(w.code).then(function(r){ if(typeof tc!=="undefined") tc.remote=r||null; }).catch(function(){}));
      if(w.role==="teacher"&&dirty){ var p=lsDB.plans[w.code]; if(p&&p.sent) jobs.push(pushPlan(p)); dirty=false; }
      Promise.all(jobs).then(function(){ busy=false; },function(){ busy=false; }); }
    if(on()) setInterval(beat, 20000);
    return {on:on, signIn:signIn, me:me, joinClass:joinClass, pushPlan:pushPlan, pullPlan:pullPlan, roster:roster, sendNote:sendNote, pullNotes:pullNotes, beat:beat, dirty:function(){ dirty=true; }};
  })();
