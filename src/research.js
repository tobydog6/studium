  // ================= RESEARCH: Punctum, rebuilt inside the studio =================
  // Artist packs from Punctum's Supabase (the same tables, so the old Punctum and this one share their data), played
  // two ways. The Punctum round: one photograph at a time, does anything in it prick you? If so, tap the detail and
  // answer three prompts. The Culling Game: two at a time, keep one, until you have your top three. Afterwards, what
  // your class thought, and one click turns a photograph and your answers into an Artist model page in the workbook.
  // No connection (or no packs yet): a sample pack built in, so the room always works.
  var RS_SB={url:"https://xddjfwoppmuhyagkhalk.supabase.co", key:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZGpmd29wcG11aHlhZ2toYWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNDQ5MzMsImV4cCI6MjEwMTkyMDkzM30.uXmvMIZHbmjj_beQVm3KawhbvwtisAAFB6e-9-D9JBU"};   // the public (anon) key, same as Punctum's
  var RS_PROMPTS=[["note","THE DETAIL","Name the detail, and try to say why it caught you and not something else."],
    ["prompt3","WHAT IT BRINGS UP","A memory, another image, a feeling..."],["prompt4","HOW IT WAS MADE","Angle, distance, light, framing, timing..."]];
  var RS_SAMPLE={id:"sample", name:"Sample pack · The Stump", links:"", sample:true, imgs:[
    {id:"s1", url:"asset:assets/research/sample-1.jpg"}, {id:"s2", url:"asset:assets/research/sample-2.jpg"}, {id:"s3", url:"asset:assets/research/sample-3.jpg"},
    {id:"s4", url:"asset:assets/research/sample-4.jpg"}, {id:"s5", url:"asset:assets/research/sample-5.jpg"}, {id:"s6", url:"asset:assets/research/sample-6.jpg"}]};
  var rs={packs:null, loading:false, offline:false, view:"shelf", pack:null, round:null, cull:null, res:null, done:{}};
  function rsWho(){ return String(studentName||"").trim()||"Studium guest"; }
  function rsClass(){ var w=typeof lsWho==="function"?lsWho():null; return (w&&w.code)||"Studium"; }
  function rsHead(json){ var h={apikey:RS_SB.key, Authorization:"Bearer "+RS_SB.key}; if(json){ h["Content-Type"]="application/json"; h.Prefer="return=minimal"; } return h; }
  function rsGet(path){ return fetch(RS_SB.url+"/rest/v1/"+path,{headers:rsHead()}).then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }); }
  function rsPost(table,rows){ if(rs.offline) return; try{ fetch(RS_SB.url+"/rest/v1/"+table,{method:"POST", headers:rsHead(true), body:JSON.stringify(rows)}).catch(function(){}); }catch(e){} }
  // Punctum keeps a pack's links as lines of "Label: url"
  function rsLinks(t){ return String(t||"").split(/\n+/).map(function(l){ var m=l.match(/^\s*([^:]+?)\s*:\s*(https?:\/\/\S+)/); return m?{label:m[1], url:m[2]}:null; }).filter(Boolean); }
  function rsLoad(force){ if(rs.loading||(rs.packs&&!force)) return; rs.loading=true; rsRender();
    rsGet("packs?select=id,name,links,type,created_at&type=neq.culling&order=created_at.desc").then(function(ps){
      if(!ps.length) return [];
      return rsGet("images?select=id,pack_id,url,position&pack_id=in.("+ps.map(function(p){ return p.id; }).join(",")+")&order=position").then(function(im){
        return ps.map(function(p){ return {id:p.id, name:p.name, links:p.links||"", imgs:im.filter(function(x){ return x.pack_id===p.id; }).map(function(x){ return {id:x.id, url:x.url}; })}; }).filter(function(p){ return p.imgs.length; }); }); })
    .then(function(list){ rs.packs=list.length?list:[RS_SAMPLE]; rs.offline=!list.length; try{ localStorage.setItem("studium_rs", JSON.stringify(list)); }catch(e){} })
    .catch(function(){ var c=null; try{ c=JSON.parse(localStorage.getItem("studium_rs")||"null"); }catch(e){} rs.packs=(c&&c.length?c:[]).concat([RS_SAMPLE]); rs.offline=true; })
    .then(function(){ rs.loading=false; rsRender(); }); }
  function rsPack(id){ return (rs.packs||[]).filter(function(p){ return String(p.id)===String(id); })[0]||null; }
  function rsShuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)), t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

  // ---- the Punctum round ----
  function rsStartRound(p){ if(!p) return; rs.pack=p; rs.view="round"; rs.round={imgs:p.imgs.slice(0,GD.demo?5:12), k:0, struck:{}, tap:{}, notes:{}, step:"ask"}; rsRender(); }
  function rsRoundAnswer(yes){ var r=rs.round, im=r.imgs[r.k]; r.struck[im.id]=!!yes; if(yes){ r.step="tap"; rsRender(); } else rsRoundNext(); }
  function rsRoundNext(){ var r=rs.round; r.k++; r.step="ask"; if(r.k>=r.imgs.length) return rsRoundEnd(); rsRender(); }
  function rsRoundEnd(){ var r=rs.round, p=rs.pack, who=rsWho(), cls=rsClass(), mine=r.imgs.filter(function(im){ return r.struck[im.id]; });
    if(!p.sample){ rsPost("responses", r.imgs.map(function(im){ return {image_id:im.id, pack_id:p.id, student_name:who, struck:!!r.struck[im.id]}; }));
      if(mine.length) rsPost("punctum_picks", mine.map(function(im){ var n=r.notes[im.id]||{}; return {student_name:who, class_name:cls, image_url:im.url, note:n.note||"", prompt3:n.prompt3||"", prompt4:n.prompt4||""}; }));
      rsPost("plays", [{student_name:who, class_name:cls, pack_id:p.id, pack_name:p.name, game:"punctum", detail:{struck:mine.map(function(im){ return im.id; })}}]); }
    rs.done[p.id+":punctum"]=1; rs.rounds=(rs.rounds||0)+1; rs.view="results"; rs.res={kind:"punctum", round:r, counts:null}; rsRender();
    if(!p.sample&&!rs.offline) rsGet("responses?select=image_id,struck&pack_id=eq."+p.id).then(function(rows){ var c={}; rows.forEach(function(x){ var o=c[x.image_id]||(c[x.image_id]={y:0,n:0}); o.n++; if(x.struck) o.y++; }); if(rs.res&&rs.res.round===r){ rs.res.counts=c; rsRender(); } }).catch(function(){}); }
  // ---- the Culling Game: two at a time; each newcomer finds its place in your top three by a few head-to-heads ----
  function rsStartCull(p){ if(!p) return; rs.pack=p; rs.view="cull"; var q=rsShuffle(p.imgs.slice(0,12)); rs.cull={queue:q.slice(1), top:[q[0]], cand:null, lo:0, hi:0, picks:0, flip:false}; rsCullNext(); }
  function rsCullNext(){ var c=rs.cull; if(!c.cand){ if(!c.queue.length) return rsCullEnd(); c.cand=c.queue.shift(); c.lo=0; c.hi=Math.min(c.top.length,3); }
    if(c.lo>=c.hi){ if(c.lo<3) c.top.splice(c.lo,0,c.cand); c.top=c.top.slice(0,3); c.cand=null; return rsCullNext(); }
    c.mid=(c.lo+c.hi)>>1; c.flip=Math.random()<0.5; rsRender(); }
  function rsCullPick(newWins){ var c=rs.cull; c.picks++; if(newWins) c.hi=c.mid; else c.lo=c.mid+1; rsCullNext(); }
  function rsCullEnd(){ var c=rs.cull, p=rs.pack, who=rsWho(), cls=rsClass(), ids=c.top.map(function(x){ return x.id; });
    if(!p.sample){ rsPost("cullings", [{pack_id:p.id, student_name:who, ranked:ids, class_name:cls}]); rsPost("plays", [{student_name:who, class_name:cls, pack_id:p.id, pack_name:p.name, game:"culling", detail:{ranked:ids}}]); }
    rs.done[p.id+":cull"]=1; rs.culls=(rs.culls||0)+1; rs.view="results"; rs.res={kind:"cull", top:c.top, cls:null}; rsRender();
    if(!p.sample&&!rs.offline) rsGet("cullings?select=ranked&pack_id=eq."+p.id).then(function(rows){ var sc={}; rows.forEach(function(r){ (r.ranked||[]).forEach(function(id,k){ sc[id]=(sc[id]||0)+3-k; }); });
      var best=Object.keys(sc).sort(function(a,b){ return sc[b]-sc[a]; }).slice(0,3); if(rs.res&&rs.res.top===c.top){ rs.res.cls={ids:best, n:rows.length}; rsRender(); } }).catch(function(){}); }
  // ---- into the workbook: an Artist model page with the photograph, an arrow to your detail, and your answers ----
  function rsToWorkbook(im){ var p=rs.pack, r=rs.round||{tap:{},notes:{}}, n=r.notes[im.id]||{}, tap=r.tap[im.id];
    var i=-1; photos.forEach(function(x,j){ if(x.url===im.url&&x.research) i=j; });
    if(i<0){ photos.push({url:im.url, t:new Date(), place:"Research", research:true, credit:p.name}); i=photos.length-1; if(typeof refreshCount==="function") refreshCount(); }
    var pid=stId(i), go=function(a){ var box={x:15,y:38,w:192,h:150}, f=bdFit(box,a), fh=f.w/a;
    f.y=box.y; var
      items=[{t:"text", role:"title", x:15, y:12, w:390, h:18, text:"Artist model: "+p.name}, {t:"photo", pid:pid, x:f.x, y:f.y, w:f.w, box:box},
        {t:"text", role:"caption", x:15, y:192, w:192, h:14, text:p.name},
        {t:"text", role:"text", x:228, y:38, w:177, h:70, text:n.note?"The detail: "+n.note:"", ph:"Name the detail, and say why it caught you."},
        {t:"text", role:"text", x:228, y:114, w:177, h:60, text:n.prompt3?"It brings up: "+n.prompt3:"", ph:"A memory, another image, a feeling..."},
        {t:"text", role:"text", x:228, y:180, w:177, h:60, text:n.prompt4?"How it was made: "+n.prompt4:"", ph:"Angle, distance, light, framing, timing..."},
        {t:"text", role:"text", x:15, y:214, w:192, h:68, text:"", ph:"How will you use this in your own photographs?"}];
      if(tap) items.push({t:"line", x:226, y:60, x2:f.x+tap.x*f.w, y2:f.y+tap.y*fh, head:"end", wt:0.6, color:"#e4552e"});
      wsEnsure(); wsB.applyTemplate({id:"research", name:"Artist model", build:function(){ return {bg:"white", items:items}; }}); rs.sent=(rs.sent||0)+1; stRoom("workshop"); };
    var probe=new Image(); probe.onload=function(){ go(probe.naturalWidth/Math.max(1,probe.naturalHeight)); }; probe.onerror=function(){ go(1.5); }; probe.src=im.url; }

  // ---- drawing ----
  function rsEsc(s){ return cbEsc(String(s==null?"":s)); }
  function rsDot(t){ return t?'<i class="rs-dot" style="left:'+(t.x*100).toFixed(2)+'%;top:'+(t.y*100).toFixed(2)+'%"></i>':''; }
  function rsShelf(){ var h='<div class="rs-head"><span class="eb">RESEARCH</span><h2>Look closely at other photographers</h2><p>Each pack is one photographer or idea. Play the Punctum round to find what pricks you, or the Culling Game to choose a top three. Then take it into your workbook.</p></div>';
    if(rs.loading&&!rs.packs) return h+'<div class="rs-none">Loading packs…</div>';
    return h+'<div class="rs-shelf">'+(rs.packs||[]).map(function(p){ var ln=rsLinks(p.links), d1=rs.done[p.id+":punctum"], d2=rs.done[p.id+":cull"];
      return '<div class="rs-pack" data-rs-pack="'+rsEsc(p.id)+'"><div class="rs-cover">'+p.imgs.slice(0,3).map(function(im){ return '<img src="'+rsEsc(im.url)+'" alt="" loading="lazy" draggable="false">'; }).join("")+'</div>'
        +'<div class="rs-meta"><b>'+rsEsc(p.name)+'</b><span>'+p.imgs.length+' photographs'+(ln.length?' · '+ln.map(function(l){ return '<a href="'+rsEsc(l.url)+'" target="_blank" rel="noopener">'+rsEsc(l.label)+'</a>'; }).join(' · '):'')+'</span></div>'
        +'<div class="rs-acts"><button class="rs-go" data-rs-act="round" data-rs-id="'+rsEsc(p.id)+'">'+(d1?'✓ ':'')+'PUNCTUM ROUND</button><button class="rs-go2" data-rs-act="cull" data-rs-id="'+rsEsc(p.id)+'">'+(d2?'✓ ':'')+'CULLING GAME</button></div></div>'; }).join("")+'</div>'
      +(rs.offline?'<p class="rs-off">Couldn\'t reach your class packs right now, so here\'s what this computer has saved, and a sample pack.</p>':''); }
  function rsRound(top){ var r=rs.round, im=r.imgs[r.k], tp=r.tap[im.id], n=r.notes[im.id]||{}, h=top+'<span class="rs-count">'+(r.k+1)+' / '+r.imgs.length+'</span></div><div class="rs-play"><div class="rs-stage'+(r.step==="tap"&&!tp?' tapping':'')+'"><div class="rs-imgw"><img class="rs-img" src="'+rsEsc(im.url)+'" alt="" draggable="false">'+rsDot(tp)+'</div></div><aside class="rs-side">';
    if(r.step==="ask") h+='<span class="eb">PUNCTUM</span><h3>Does anything in this photograph prick you?</h3><p class="rs-q">Barthes called it the punctum: the small detail that reaches out and catches you, not the subject everyone sees.</p>'
      +'<div class="rs-yn"><button class="rs-go" data-rs-act="yes">IT PRICKS ME</button><button class="rs-go2" data-rs-act="no">NOT THIS ONE</button></div>';
    else h+='<span class="eb">PUNCTUM</span><h3>'+(tp?'Now say why':'Tap the detail')+'</h3>'+(tp?'':'<p class="rs-q">Click right on the thing that caught you.</p>')
      +(tp?RS_PROMPTS.map(function(q){ return '<label class="rs-f"><span>'+q[1]+'</span><textarea data-rs-note="'+q[0]+'" placeholder="'+rsEsc(q[2])+'">'+rsEsc(n[q[0]]||"")+'</textarea></label>'; }).join("")
        +'<div class="rs-yn"><button class="rs-go" data-rs-act="next">'+(r.k+1<r.imgs.length?'NEXT PHOTOGRAPH ›':'FINISH ›')+'</button><button class="rs-go2" data-rs-act="retap">TAP AGAIN</button></div>':'');
    return h+'</aside></div>'; }
  function rsCullHTML(top){ var c=rs.cull, a=c.cand, b=c.top[c.mid], L=c.flip?b:a, R=c.flip?a:b;
    return top+'<span class="rs-count">CULLING · '+c.picks+' PICKS</span></div><div class="rs-cull"><p class="rs-q">Which is the stronger photograph? Go with your gut.</p><div class="rs-ab">'
      +'<button class="rs-card" data-rs-act="pick" data-rs-win="'+(L===a?1:0)+'"><img src="'+rsEsc(L.url)+'" alt="" draggable="false"><span>A</span></button>'
      +'<button class="rs-card" data-rs-act="pick" data-rs-win="'+(R===a?1:0)+'"><img src="'+rsEsc(R.url)+'" alt="" draggable="false"><span>B</span></button></div></div>'; }
  function rsResults(top){ var res=rs.res, p=rs.pack, h=top+'</div><div class="rs-res">';
    if(res.kind==="punctum"){ var rr=res.round, mine=rr.imgs.filter(function(im){ return rr.struck[im.id]; });
      h+='<div class="rs-rh"><span class="eb">YOUR PUNCTUMS</span><h3>'+(mine.length?mine.length+' of '+rr.imgs.length+' pricked you':'Nothing pricked you this time')+'</h3><p class="rs-q">'+(res.counts?'The numbers show how many in your class were caught by each one. ':'')+(mine.length?'Take one into your workbook to write it up.':'Try the Culling Game, or another pack.')+'</p></div><div class="rs-grid">'
        +rr.imgs.map(function(im){ var on=rr.struck[im.id], k=res.counts&&res.counts[im.id];
          return '<div class="rs-tile'+(on?' on':'')+'"><div class="rs-imgw"><img src="'+rsEsc(im.url)+'" alt="" loading="lazy">'+rsDot(rr.tap[im.id])+'</div>'
            +'<div class="rs-tm">'+(k?'<span>'+k.y+' of '+k.n+' caught</span>':'<span></span>')+(on?'<button class="rs-wb" data-rs-act="wb" data-rs-img="'+rsEsc(im.id)+'">INTO WORKBOOK ›</button>':'')+'</div></div>'; }).join("")+'</div>'; }
    else { var ct=res.cls, row=function(im,k){ return im?'<div class="rs-ri"><b>'+(k+1)+'</b><img src="'+rsEsc(im.url)+'" alt=""></div>':''; };
      h+='<div class="rs-rh"><span class="eb">YOUR TOP THREE</span><h3>Your ranking'+(ct&&ct.n>1?', next to your class':'')+'</h3><p class="rs-q">Where you and your class disagree is worth writing about.</p></div><div class="rs-rank"><div><span class="eb">YOU</span>'+res.top.map(row).join("")+'</div>'
        +(ct&&ct.n>1?'<div><span class="eb">CLASS · '+ct.n+' PLAYED</span>'+ct.ids.map(function(id,k){ return row(p.imgs.filter(function(x){ return String(x.id)===String(id); })[0],k); }).join("")+'</div>':'')+'</div>'; }
    return h+'<div class="rs-yn"><button class="rs-go2" data-rs-act="'+(res.kind==="punctum"?"cull":"round")+'" data-rs-id="'+rsEsc(p.id)+'">'+(res.kind==="punctum"?"NOW THE CULLING GAME":"NOW THE PUNCTUM ROUND")+'</button><button class="rs-go2" data-rs-act="shelf">ALL PACKS</button></div></div>'; }
  function rsRender(){ var box=$("st-research"); if(!box||!st.open||st.room!=="research") return;
    if(rs.view==="shelf"||!rs.pack){ if(!rs.packs&&!rs.loading) return rsLoad(); box.innerHTML=rsShelf(); return; }
    var top='<div class="rs-bar"><button class="rs-back" data-rs-act="shelf">‹ All packs</button><span class="rs-pn">'+rsEsc(rs.pack.name)+'</span>';
    box.innerHTML=rs.view==="round"?rsRound(top):rs.view==="cull"?rsCullHTML(top):rsResults(top);
    if(rs.view==="round") rsWireNotes(box); }
  function rsWireNotes(box){ Array.prototype.forEach.call(box.querySelectorAll("[data-rs-note]"),function(t){ t.addEventListener("input",function(){ var r=rs.round, im=r.imgs[r.k]; (r.notes[im.id]||(r.notes[im.id]={}))[t.getAttribute("data-rs-note")]=t.value; }); t.addEventListener("keydown",function(e){ e.stopPropagation(); }); }); }
  (function rsWire(){ var box=$("st-research"); if(!box) return;
    box.addEventListener("click",function(e){ var r=rs.round;
      if(rs.view==="round"&&r&&r.step==="tap"&&!r.tap[r.imgs[r.k].id]){ var w=e.target.closest(".rs-imgw"); if(w){ var b=w.getBoundingClientRect(); r.tap[r.imgs[r.k].id]={x:Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)), y:Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))}; rs.taps=(rs.taps||0)+1; rsRender(); var t0=box.querySelector("[data-rs-note]"); if(t0) t0.focus(); return; } }
      var t=e.target.closest("[data-rs-act]"); if(!t) return; var a=t.getAttribute("data-rs-act"), id=t.getAttribute("data-rs-id");
      if(a==="shelf"){ rs.view="shelf"; rs.pack=null; return rsRender(); }
      if(a==="round") return rsStartRound(rsPack(id)||rs.pack); if(a==="cull") return rsStartCull(rsPack(id)||rs.pack);
      if(a==="yes") return rsRoundAnswer(true); if(a==="no") return rsRoundAnswer(false); if(a==="next") return rsRoundNext();
      if(a==="retap"){ delete r.tap[r.imgs[r.k].id]; return rsRender(); }
      if(a==="pick") return rsCullPick(t.getAttribute("data-rs-win")==="1");
      if(a==="wb"){ var im=rs.res.round.imgs.filter(function(x){ return String(x.id)===t.getAttribute("data-rs-img"); })[0]; if(im) rsToWorkbook(im); } }); })();
  if(/[?&]dev/.test(location.search)) window.__rs={ state:function(){ return {view:rs.view, packs:(rs.packs||[]).map(function(p){ return {id:p.id, n:p.imgs.length}; }), offline:rs.offline, k:rs.round&&rs.round.k, step:rs.round&&rs.round.step, top:rs.cull&&rs.cull.top.length, rounds:rs.rounds||0, culls:rs.culls||0, sent:rs.sent||0, taps:rs.taps||0}; } };
