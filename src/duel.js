  // ================= DUEL: Blades duels between signed-in players, live =================
  // Anyone signed in with Google joins a lobby on Supabase Realtime while Studium is open: a class's students and teacher
  // share their class's lobby (studium-lobby:<code>), everyone else (the public demo) the open one, so a stranger on the
  // demo never sees or invites a school student.
  // Blades (the light table's secret layer) opens the list of who's on; an invite pops up wherever the other player is
  // in Studium, and accepting takes them to the stadium. Each duel runs on its own channel, studium-duel:<host>:<guest>;
  // blades.js plays it, this file is only the wire (LT_BRIDGE.duel). Private channels: only signed-in players can join
  // the lobby, and only the two players can join a duel (docs/supabase.sql, the realtime.messages policies). Names show
  // as first name and initial, never an email, and anyone can hide from the list. Plain WebSocket, Phoenix 1.0.0.
  var Duel=(function(){
    var ws=null, open=false, dialing=false, refN=0, hb=0, tokT=0, retry=0, wait=1000, tok=null, me=null, chans={}, people={}, L=null, denied=false;
    var started=false, hide=false, busy=null, out=null, inbox=null, listEl=null, invEl=null;
    try{ hide=localStorage.getItem("studium_duel_hide")==="1"; }catch(e){}
    function cfg(){ return typeof Sync!=="undefined"&&Sync.cfg?Sync.cfg():null; }
    function can(){ var c=cfg(); return !!(c&&c.url&&c.anonKey&&Sync.signedIn()&&window.WebSocket); }
    function short(n){ var p=String(n||"").trim().split(/\s+/); if(!p[0]) return "Someone"; return p[0]+(p.length>1?" "+p[p.length-1].charAt(0).toUpperCase()+".":""); }
    function esc(t){ return String(t==null?"":t).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
    function ref(){ return String(++refN); }
    function raw(m){ if(!open) return false; try{ ws.send(JSON.stringify(m)); return true; }catch(e){ return false; } }
    function topicOf(c){ return "realtime:"+c.topic; }

    // ---- the socket: one for the page, every channel rides on it; it comes back on its own after a drop ----
    function connect(){ if(ws||dialing||!can()) return; dialing=true;
      Sync.token().then(function(t){ dialing=false; if(!t||ws||!started) return; tok=t; var c=cfg();
        try{ ws=new WebSocket(c.url.replace(/^http/,"ws")+"/realtime/v1/websocket?apikey="+encodeURIComponent(c.anonKey)+"&vsn=1.0.0"); }catch(e){ ws=null; again(); return; }
        var me_ws=ws;
        ws.onopen=function(){ if(ws!==me_ws) return; open=true; wait=1000; for(var k in chans) join(chans[k]);
          clearInterval(hb); hb=setInterval(function(){ raw({topic:"phoenix", event:"heartbeat", payload:{}, ref:ref()}); }, 25000);
          clearInterval(tokT); tokT=setInterval(retoken, 60000); };
        ws.onmessage=function(e){ if(ws!==me_ws) return; var m; try{ m=JSON.parse(e.data); }catch(x){ return; } got(m); };
        ws.onclose=function(){ if(ws!==me_ws) return; open=false; ws=null; clearInterval(hb); clearInterval(tokT); for(var k in chans) chans[k].joined=false; paint(); if(started) again(); };
        ws.onerror=function(){}; },function(){ dialing=false; again(); }); }
    function again(){ clearTimeout(retry); retry=setTimeout(connect, wait); wait=Math.min(30000, wait*2); }
    /* the sign-in token lasts an hour: each channel gets the new one when Sync swaps it */
    function retoken(){ Sync.token().then(function(t){ if(!t){ stop(); return; } if(t===tok) return; tok=t;
      for(var k in chans){ var c=chans[k]; if(c.joined) raw({topic:topicOf(c), event:"access_token", payload:{access_token:t}, ref:ref(), join_ref:c.jr}); } }); }

    // ---- channels ----
    function channel(topic, h){ var c=chans[topic]; if(c){ c.h=h||c.h; return c; }
      c=chans[topic]={topic:topic, h:h||{}, jr:null, joined:false, q:[], meta:null}; if(open) join(c); else connect(); return c; }
    function join(c){ c.jr=ref(); c.joined=false;
      raw({topic:topicOf(c), event:"phx_join", payload:{config:{broadcast:{self:false, ack:false}, presence:{key:me.id, enabled:true}, postgres_changes:[], private:true}, access_token:tok}, ref:c.jr, join_ref:c.jr}); }
    function got(m){ var c=null; for(var k in chans) if(topicOf(chans[k])===m.topic) c=chans[k]; if(!c) return;
      if(m.event==="phx_reply"&&m.ref===c.jr){
        if(m.payload&&m.payload.status==="ok"){ c.joined=true; if(c===L) denied=false; if(c.meta) push(c,"presence",{type:"presence", event:"track", payload:c.meta});
          var q=c.q; c.q=[]; q.forEach(function(x){ push(c, x[0], x[1]); }); if(c.h.joined) c.h.joined(); }
        else { console.warn("duel: couldn't join", c.topic, m.payload); if(c===L) denied=true; if(c.h.denied) c.h.denied(); paint(); }
        return; }
      if(m.event==="phx_error"){ c.joined=false; setTimeout(function(){ if(chans[c.topic]===c&&open) join(c); }, 2000); return; }
      if(m.event==="broadcast"&&m.payload){ if(c.h.msg) try{ c.h.msg(m.payload.event, m.payload.payload||{}); }catch(e){ console.error(e); } }
      else if(m.event==="presence_state"){ if(c.h.state) c.h.state(m.payload||{}); }
      else if(m.event==="presence_diff"){ if(c.h.diff) c.h.diff(m.payload||{}); }
      else if(m.event==="system"&&m.payload&&m.payload.status==="error") console.warn("duel:", c.topic, m.payload.message); }
    /* waiting to join: keep what matters. A full queue drops a position update or heartbeat before a launch or a round's end */
    function push(c, event, payload){ if(!c.joined){ if(c.q.length>=60){ var k=-1; for(var i=0;i<c.q.length;i++){ var e=c.q[i][1]&&c.q[i][1].event; if(e==="snap"||e==="hi"){ k=i; break; } } if(k<0) return; c.q.splice(k,1); } c.q.push([event, payload]); return; }
      raw({topic:topicOf(c), event:event, payload:payload, ref:ref(), join_ref:c.jr}); }
    function send(c, ev, p){ push(c, "broadcast", {type:"broadcast", event:ev, payload:p}); }
    function track(c, meta){ c.meta=meta; if(c.joined) raw({topic:topicOf(c), event:"presence", payload:{type:"presence", event:"track", payload:meta}, ref:ref(), join_ref:c.jr}); }
    function untrack(c){ c.meta=null; if(c.joined) raw({topic:topicOf(c), event:"presence", payload:{type:"presence", event:"untrack"}, ref:ref(), join_ref:c.jr}); }
    function leave(c){ if(!c||chans[c.topic]!==c) return; if(c.joined) raw({topic:topicOf(c), event:"phx_leave", payload:{}, ref:ref(), join_ref:c.jr}); delete chans[c.topic]; }

    // ---- the lobby: who's on (presence), and invites addressed to one player ----
    function lobbyTopic(){ var w=(typeof lsWho==="function"&&lsWho())||{}; return w.code&&!w.demo?"studium-lobby:"+String(w.code).toUpperCase():"studium-lobby:open"; }
    function lobby(){ L=channel(lobbyTopic(), {
        state:function(p){ people={}; for(var k in p) people[k]=(p[k].metas||[]).slice(); paint(); },
        diff:function(p){ var k;
          for(k in p.joins||{}) people[k]=(people[k]||[]).concat(p.joins[k].metas||[]);
          for(k in p.leaves||{}){ var gone=(p.leaves[k].metas||[]).map(function(x){ return x.phx_ref; }); people[k]=(people[k]||[]).filter(function(x){ return gone.indexOf(x.phx_ref)<0; }); if(!people[k].length) delete people[k]; }
          paint(); },
        msg:lobbyMsg }); meta(); }
    function meta(){ if(!L||!me) return; if(hide) untrack(L); else track(L, {n:me.n, busy:busy?1:0}); }
    function online(){ var out0=[]; for(var k in people){ if(me&&k===me.id) continue; var ms=people[k]; if(!ms||!ms.length) continue; var m=ms[ms.length-1]; out0.push({id:k, n:short(m.n), busy:ms.some(function(x){ return x.busy; })}); }
      return out0.sort(function(a,b){ return a.n.localeCompare(b.n); }); }
    function lobbyMsg(ev, p){ if(!me||p.to!==me.id) return;
      if(ev==="inv"){ if(busy||inbox){ send(L,"inv-re",{to:p.from, from:me.id, id:p.id, ok:false, why:"busy"}); return; } showInvite({from:p.from, n:short(p.n), id:p.id}); }
      else if(ev==="inv-re"){ if(!out||out.id!==p.id) return; var o=out; clearOut();
        if(p.ok) begin({role:"host", foe:{id:o.to, n:o.n}}); else { toast(o.n+(p.why==="busy"?" is in a duel already. Try again soon.":" can't duel right now.")); paint(); } }
      else if(ev==="inv-x"){ if(inbox&&inbox.id===p.id){ closeInvite(); toast(short(p.n)+" took the invite back."); } } }
    function invite(k){ if(!me||!L) return; if(busy){ toast("Finish this duel first."); return; } if(out){ toast("Waiting on "+out.n+" first."); return; }
      var p=online().filter(function(x){ return x.id===k; })[0]; if(!p) return; if(p.busy){ toast(p.n+" is in a duel already."); return; }
      out={to:k, n:p.n, id:Math.random().toString(36).slice(2,10)}; send(L,"inv",{to:k, from:me.id, n:me.n, id:out.id});
      out.t=setTimeout(function(){ if(!out) return; var n=out.n; cancel(); toast("No answer from "+n+". Try again in a bit."); }, 30000); paint(); }
    function clearOut(){ if(out) clearTimeout(out.t); out=null; }
    function cancel(){ if(!out) return; send(L,"inv-x",{to:out.to, from:me.id, n:me.n, id:out.id}); clearOut(); paint(); }

    // ---- an invite arriving, wherever they are in Studium ----
    function showInvite(i){ inbox=i; if(!invEl){ invEl=document.createElement("div"); invEl.id="duelInv"; invEl.className="duel-inv"; invEl.setAttribute("role","alertdialog"); invEl.setAttribute("data-nosnippet",""); document.body.appendChild(invEl);
        invEl.addEventListener("click",function(e){ var b=e.target.closest("[data-d]"); if(!b||!inbox) return; var i0=inbox, yes=b.getAttribute("data-d")==="yes"; closeInvite();
          send(L,"inv-re",{to:i0.from, from:me.id, id:i0.id, ok:yes}); if(yes) begin({role:"guest", foe:{id:i0.from, n:i0.n}}); }); }
      invEl.innerHTML='<span class="eb">BLADES DUEL</span><b>'+esc(i.n)+' wants a duel</b><p>You’ll both head to the stadium under the light table. Bring your best three slabs.</p><div class="row"><button type="button" data-d="no">Not now</button><button type="button" class="primary" data-d="yes">Let’s go</button></div>';
      invEl.classList.add("on"); if(typeof sfx==="function") try{ sfx("kitOpen"); }catch(e){}
      clearTimeout(i.t); i.t=setTimeout(function(){ if(inbox===i){ closeInvite(); send(L,"inv-re",{to:i.from, from:me.id, id:i.id, ok:false}); } }, 30000); }
    function closeInvite(){ if(inbox) clearTimeout(inbox.t); var was=inbox; inbox=null; if(invEl) invEl.classList.remove("on"); return was; }

    // ---- into the duel: the light table opens, the secret layer takes them to the stadium, blades.js plays it ----
    function begin(info){ var host=info.role==="host"?me.id:info.foe.id, guest=info.role==="host"?info.foe.id:me.id;
      busy={role:info.role, foe:info.foe, me:{id:me.id, n:me.n}, topic:"studium-duel:"+host+":"+guest}; meta(); closeList(); closeInvite();
      var d=busy, t0=Date.now();
      try{ if(typeof st!=="undefined"&&!(st.open&&st.room==="table")){ if(st.open) stRoom("table"); else openStudio("table"); } }catch(e){ console.warn("duel: table", e); }
      (function hand(){ if(busy!==d) return; var lt=null; try{ lt=ltFrame&&ltFrame.contentWindow&&ltFrame.contentWindow.LTapp; }catch(e){}
        if(lt&&lt.duel&&lt.duel(d)) return;
        if(Date.now()-t0>45000){ toast("The light table didn't open in time, so the duel is off."); end(); return; }
        setTimeout(hand, 300); })(); }
    function end(){ busy=null; meta(); paint(); }

    // ---- the list (opened from Blades) ----
    function openList(){ if(!listEl){ listEl=document.createElement("div"); listEl.id="duelList"; listEl.className="duel-list"; listEl.setAttribute("data-nosnippet",""); document.body.appendChild(listEl);
        listEl.addEventListener("click",function(e){ if(e.target===listEl){ closeList(); return; } var b=e.target.closest("[data-d]"); if(!b) return; var a=b.getAttribute("data-d");
          if(a==="close") closeList(); else if(a==="inv") invite(b.getAttribute("data-k")); else if(a==="cancel") cancel(); else if(a==="in"){ closeList(); siDemoSignIn(); } });
        listEl.addEventListener("change",function(e){ if(e.target.getAttribute("data-d")!=="show") return; hide=!e.target.checked; try{ localStorage.setItem("studium_duel_hide", hide?"1":"0"); }catch(x){} meta(); });
        document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&listEl.classList.contains("on")){ e.stopPropagation(); closeList(); } }, true); }
      if(can()&&!started) start(); listEl.classList.add("on"); paint(); }
    function closeList(){ if(!listEl||!listEl.classList.contains("on")) return; listEl.classList.remove("on"); try{ if(ltFrame&&ltFrame.contentWindow) ltFrame.contentWindow.focus(); }catch(e){} }
    function paint(){ if(!listEl||!listEl.classList.contains("on")) return; var h='<div class="dl-card" role="dialog" aria-label="Duel someone"><button type="button" class="dl-x" data-d="close" aria-label="Close">×</button><span class="eb">BLADES · ONLINE</span><h2>Duel someone</h2>';
      if(!can()){ var w=lsWho()||{};
        h+='<p class="dl-sub">Sign in with Google to duel other players who are in Studium right now.</p>'+(w.demo?'<button type="button" class="primary dl-in" data-d="in">Sign in with Google</button><p class="dl-note">Your demo progress saves to your account too.</p>':'<p class="dl-note">Sign in from the start page with your school Google account.</p>'); }
      else if(denied) h+='<p class="dl-sub">Online duels aren’t switched on here yet. Ask your teacher.</p>';
      else if(!L||!L.joined) h+='<p class="dl-sub">Connecting…</p>';
      else { var list=online(); h+='<p class="dl-sub">'+(L.topic==="studium-lobby:open"?'Signed in and playing the demo right now.':'From your class, in Studium right now.')+'</p><div class="dl-rows">';
        if(!list.length) h+='<p class="dl-none">Nobody else is on right now. When a friend signs in with Google and opens Studium, they’ll show up here.</p>';
        list.forEach(function(p){ var wt=out&&out.to===p.id; h+='<div class="dl-row"><span class="dl-n">'+esc(p.n)+'</span><span class="dl-s">'+(wt?'Waiting for an answer':p.busy?'In a duel':'Free')+'</span>'
          +(wt?'<button type="button" data-d="cancel">Cancel</button>':'<button type="button" class="primary" data-d="inv" data-k="'+esc(p.id)+'"'+(p.busy||out?' disabled':'')+'>Invite</button>')+'</div>'; });
        h+='</div><label class="dl-me"><input type="checkbox" data-d="show"'+(hide?'':' checked')+'> Show me in other players’ lists</label>'; }
      listEl.innerHTML=h+'</div>'; }

    // ---- on while signed in, off when not ----
    function start(){ if(started||!can()) return; started=true;
      Sync.me().then(function(u){ if(!u||!started){ started=false; return; } me={id:u.id, n:short(u.name)}; lobby(); connect(); },function(){ started=false; }); }
    function stop(){ started=false; clearTimeout(retry); clearOut(); closeInvite(); for(var k in chans) leave(chans[k]); chans={}; L=null; people={}; busy=null; me=null;
      if(ws){ var w=ws; ws=null; open=false; try{ w.close(); }catch(e){} } clearInterval(hb); clearInterval(tokT); paint(); }
    setInterval(function(){ if(can()&&!started) start(); else if(!can()&&started) stop();
      else if(started&&L&&me&&L.topic!==lobbyTopic()){ untrack(L); leave(L); L=null; people={}; denied=false; lobby(); paint(); } }, 15000);   /* joined a class, or left the demo: the right lobby */
    setTimeout(function(){ if(can()) start(); }, 4000);

    var css=document.createElement("style"); css.textContent=
      ".duel-inv{position:fixed;left:50%;top:calc(18px + env(safe-area-inset-top,0px));transform:translate(-50%,-12px);width:min(380px,calc(100vw - 32px));box-sizing:border-box;padding:16px 18px;border-radius:14px;background:var(--panel-solid);border:1px solid rgba(227,173,87,.5);box-shadow:var(--shadow);color:var(--text);font-family:var(--sans);z-index:400;opacity:0;pointer-events:none;transition:opacity .3s,transform .4s cubic-bezier(.2,.8,.2,1)}"+
      ".duel-inv.on{opacity:1;pointer-events:auto;transform:translate(-50%,0)}"+
      ".duel-inv .eb,.duel-list .eb{font:500 10px/1 var(--mono);letter-spacing:.18em;color:var(--accent)}"+
      ".duel-inv b{display:block;margin:8px 0 4px;font:500 19px/1.2 var(--serif)}.duel-inv p{margin:0 0 14px;font-size:13px;line-height:1.45;color:var(--muted)}"+
      ".duel-inv .row{display:flex;gap:8px;justify-content:flex-end}"+
      ".duel-inv button,.duel-list button{appearance:none;font:500 11px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--text);background:transparent;border:1px solid rgba(244,241,234,.28);border-radius:999px;padding:10px 14px;cursor:pointer;white-space:nowrap}"+
      ".duel-inv button:hover,.duel-list button:hover{border-color:rgba(244,241,234,.65)}"+
      ".duel-inv button.primary,.duel-list button.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}"+
      ".duel-list button:disabled{opacity:.4;cursor:default}"+
      ".duel-list{position:fixed;inset:0;z-index:390;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(5,4,3,.55);font-family:var(--sans);color:var(--text)}"+
      ".duel-list.on{display:flex}"+
      ".dl-card{position:relative;width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;padding:22px 22px 18px;border-radius:16px;background:var(--panel-solid);border:1px solid var(--line);box-shadow:var(--shadow)}"+
      ".dl-card h2{margin:8px 0 4px;font:500 26px/1.15 var(--serif)}.dl-sub{margin:0 0 14px;font-size:13.5px;line-height:1.45;color:var(--muted)}"+
      ".dl-x{position:absolute;top:12px;right:12px;width:34px;height:34px;padding:0!important;font-size:18px!important;line-height:1!important;border-radius:50%!important}"+
      ".dl-rows{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}"+
      ".dl-row{display:flex;align-items:center;gap:10px;padding:10px 10px 10px 14px;border-radius:12px;background:var(--s3)}"+
      ".dl-n{flex:1;min-width:0;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dl-s{font:500 10px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}"+
      ".dl-none,.dl-note{font-size:13px;line-height:1.45;color:var(--faint);margin:0 0 6px}.dl-in{margin:4px 0 10px}"+
      ".dl-me{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);cursor:pointer}.dl-me input{accent-color:var(--accent);width:16px;height:16px}"+
      "@media (max-width:480px){.dl-s{display:none}}";
    document.head.appendChild(css);

    return {start:start, stop:stop, list:openList, end:end, can:can,
      /* the bridge for blades.js (via LT_BRIDGE.duel): a duel channel it can send on, and leave */
      channel:function(topic, h){ var c=channel(topic, h); return {send:function(ev,p){ send(c,ev,p); }, leave:function(){ leave(c); }, get joined(){ return c.joined; }}; },
      who:function(){ return me; }};
  })();
