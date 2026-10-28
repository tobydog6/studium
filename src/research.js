  // ================= RESEARCH: Punctum, rebuilt inside the studio =================
  // For now students see the moodboard wall and the Culling Game (then every photo in the pack); the Punctum round's
  // code stays here, switched off, until it comes back.
  // Artist packs from Punctum's Supabase (the same tables, so the old Punctum and this one share their data), played
  // two ways. The Punctum round: one photograph at a time, does anything in it prick you? If so, tap the detail and
  // answer three prompts. The Culling Game: two at a time, keep one, until you have your top five. Afterwards, what
  // your class thought, and one click turns a photograph and your answers into an Artist model page in the workbook.
  // No connection (or no packs yet): a sample pack built in, so the room always works.
  var RS_SB={url:"https://xddjfwoppmuhyagkhalk.supabase.co", key:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZGpmd29wcG11aHlhZ2toYWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNDQ5MzMsImV4cCI6MjEwMTkyMDkzM30.uXmvMIZHbmjj_beQVm3KawhbvwtisAAFB6e-9-D9JBU"};   // the public (anon) key, same as Punctum's
  var RS_PROMPTS=[["note","THE DETAIL","Name the detail, and try to say why it caught you and not something else."],
    ["prompt3","WHAT IT BRINGS UP","Does it remind you of anything?"],["prompt4","HOW IT WAS MADE","Angle, distance, light, framing, timing..."]];
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
  function rsStartRound(p){ if(!p) return; rs.pack=p; rs.view="round"; rs.round={imgs:qDemo()?p.imgs.slice(0,5):p.imgs.slice(), k:0, struck:{}, tap:{}, notes:{}, step:"ask"}; rsRender(); }
  function rsRoundAnswer(yes){ sfx("cullPick"); var r=rs.round, im=r.imgs[r.k]; r.struck[im.id]=!!yes; if(yes){ r.step="tap"; rsRender(); } else rsRoundNext(); }
  function rsRoundNext(){ var r=rs.round; r.k++; r.step="ask"; if(r.k>=r.imgs.length) return rsRoundEnd(); rsRender(); }
  function rsRoundEnd(){ sfx("cullEnd",{delay:0.15}); var r=rs.round, p=rs.pack, who=rsWho(), cls=rsClass(), mine=r.imgs.filter(function(im){ return r.struck[im.id]; });
    if(!p.sample){ rsPost("responses", r.imgs.map(function(im){ return {image_id:im.id, pack_id:p.id, student_name:who, struck:!!r.struck[im.id]}; }));
      if(mine.length) rsPost("punctum_picks", mine.map(function(im){ var n=r.notes[im.id]||{}; return {student_name:who, class_name:cls, image_url:im.url, note:n.note||"", prompt3:n.prompt3||"", prompt4:n.prompt4||""}; }));
      rsPost("plays", [{student_name:who, class_name:cls, pack_id:p.id, pack_name:p.name, game:"punctum", detail:{struck:mine.map(function(im){ return im.id; })}}]); }
    rs.done[p.id+":punctum"]=1; qResearch("punctum", p.id); qResearch("details", null, mine.filter(function(im){ var n=r.notes[im.id]; return n&&String(n.note||"").trim(); }).length); rs.rounds=(rs.rounds||0)+1; rs.view="results"; rs.res={kind:"punctum", round:r, counts:null}; rsRender();
    if(!p.sample&&!rs.offline) rsGet("responses?select=image_id,struck&pack_id=eq."+p.id).then(function(rows){ var c={}; rows.forEach(function(x){ var o=c[x.image_id]||(c[x.image_id]={y:0,n:0}); o.n++; if(x.struck) o.y++; }); if(rs.res&&rs.res.round===r){ rs.res.counts=c; rsRender(); } }).catch(function(){}); }
  // ---- the Culling Game: two at a time; each newcomer finds its place in your top five by a few head-to-heads ----
  var RS_TOP=5;   /* the Culling Game keeps your top five */
  function rsStartCull(p){ if(!p) return; rs.pack=p; rs.view="cull"; var q=rsShuffle(p.imgs);   /* every photograph in the pack goes through */ rs.cull={queue:q.slice(1), top:[q[0]], cand:null, lo:0, hi:0, picks:0, flip:false, t0:Date.now()}; rsCullNext(); }
  function rsCullNext(){ var c=rs.cull; if(!c.cand){ if(!c.queue.length) return rsCullEnd(); c.cand=c.queue.shift(); c.lo=0; c.hi=Math.min(c.top.length,RS_TOP); }
    if(c.lo>=c.hi){ if(c.lo<RS_TOP) c.top.splice(c.lo,0,c.cand); c.top=c.top.slice(0,RS_TOP); c.cand=null; return rsCullNext(); }
    c.mid=(c.lo+c.hi)>>1; c.flip=Math.random()<0.5; rsRender(); }
  function rsCullPick(newWins){ sfx("cullPick"); var c=rs.cull; c.picks++; if(newWins) c.hi=c.mid; else c.lo=c.mid+1; rsCullNext(); }
  function rsCullEnd(){ sfx("cullEnd",{delay:0.15}); var c=rs.cull, p=rs.pack, who=rsWho(), cls=rsClass(), ids=c.top.map(function(x){ return x.id; });
    if(!p.sample) rsPost("cullings", [{pack_id:p.id, student_name:who, ranked:ids, class_name:cls}]);   /* the play itself (with the why) goes when the page is made, or when they move on: rsCullPost */
    var cev={pack:p.id, s:Math.round((Date.now()-(c.t0||Date.now()))/1000), top:ids[0], n:p.imgs.length}; if(typeof achEvent==="function") achEvent("cull", cev);
    rs.done[p.id+":cull"]=1; qResearch("cull", p.id); rs.culls=(rs.culls||0)+1; try{ localStorage.setItem("studium_culled","1"); }catch(e){} rs.view="results"; rs.res={kind:"cull", top:c.top, cls:null, pack:p, ids:ids, why:"", why23:"", posted:false}; rsRender();
    if(!p.sample&&!rs.offline) rsGet("cullings?select=ranked&pack_id=eq."+p.id).then(function(rows){ var sc={}; rows.forEach(function(r){ (r.ranked||[]).forEach(function(id,k){ sc[id]=(sc[id]||0)+RS_TOP-k; }); });
      var best=Object.keys(sc).sort(function(a,b){ return sc[b]-sc[a]; }).slice(0,RS_TOP); if(rs.res&&rs.res.top===c.top){ rs.res.cls={ids:best, n:rows.length}; rsRender(); }
      /* the class's #1, and its least-liked, for Great Minds and Contrarian */
      var all=p.imgs.map(function(im){ return im.id; }), low=all.slice().sort(function(a,b){ return (sc[a]||0)-(sc[b]||0); })[0];
      cev.same=!!best.length&&String(best[0])===String(ids[0]); cev.contra=rows.length>=5&&String(low)===String(ids[0]); if(typeof achEvent==="function") achEvent("recheck"); }).catch(function(){}); }
  /* the Culling Game's play row: once, with the why if they wrote one */
  function rsCullPost(why, why23){ var res=rs.res; if(!res||res.kind!=="cull"||res.posted) return; res.posted=true; var p=res.pack; if(!p||p.sample) return;
    var d={ranked:res.ids}; if(why) d.why=why; if(why23) d.why23=why23; rsPost("plays", [{student_name:rsWho(), class_name:rsClass(), pack_id:p.id, pack_name:p.name, game:"culling", detail:d}]); }
  /* "a few words": at least four words and twenty characters */
  function rsWhyOk(t){ t=String(t||"").trim(); return t.length>=20&&t.split(/\s+/).length>=4; }
  function rsWhyHint(t){ t=String(t||"").trim(); if(!t) return "Write a sentence or two. Then it can go straight into your workbook."; if(rsWhyOk(t)) return "Lovely. That's ready for your workbook."; return "Keep going, a few more words."; }
  /* one move: the top three on an Artist model page, #1 big with an arrow from your why, then off to the workbook */
  function rsCullWorkbook(){ var res=rs.res; if(!res||res.kind!=="cull"||!rsWhyOk(res.why)||res.sent) return; res.sent=true; /* one page per game, however many clicks */ var p=res.pack, top=res.top.slice(0,RS_TOP), why=String(res.why).trim(), why23=String(res.why23||"").trim();
    rsCullPost(why, why23);
    var pids=top.map(function(im){ var i=-1; photos.forEach(function(x,j){ if(x.url===im.url&&x.research) i=j; }); if(i<0){ photos.push({url:im.url, t:new Date(), place:"Research", research:true, credit:p.name}); i=photos.length-1; } return stId(i); });
    if(typeof refreshCount==="function") refreshCount();
    var box=$("st-research"); if(box) box.classList.add("rs-leaving");
    Promise.all(top.map(function(im){ return new Promise(function(r){ var pr=new Image(); pr.onload=function(){ r(pr.naturalWidth/Math.max(1,pr.naturalHeight)); }; pr.onerror=function(){ r(1.5); }; pr.src=im.url; }); }))
      .then(function(A){ var items=[{t:"text", role:"title", x:15, y:12, w:390, h:18, text:"Artist model: "+p.name}],
          B=[{x:15,y:38,w:250,h:160},{x:277,y:38,w:128,h:38},{x:277,y:80,w:128,h:38},{x:277,y:122,w:128,h:38},{x:277,y:164,w:128,h:38}], F=[];
        A.forEach(function(a,k){ var f=bdFit(B[k],a); f.y=B[k].y; f.h=f.w/a; F.push(f); items.push({t:"photo", pid:pids[k], x:f.x, y:f.y, w:f.w, box:B[k]}); });
        var f1=F[0]||{x:15,y:38,w:250,h:160}, cy=f1.y+f1.h+3;
        items.push({t:"text", role:"caption", x:15, y:cy, w:250, h:14, text:"My #1 · "+p.name});
        items.push({t:"text", role:"text", x:15, y:cy+26, w:250, h:Math.max(50,282-(cy+26)), text:"Why it's my #1: "+why});
        items.push({t:"line", x:22, y:cy+23, x2:f1.x+f1.w*0.22, y2:f1.y+f1.h*0.78, head:"end", wt:0.6, color:"#e4552e"});
        if(F.length>1) items.push({t:"text", role:"caption", x:277, y:214, w:128, h:14, text:"My #2"+(F.length>2?" to #"+F.length:"")});
        items.push({t:"text", role:"text", x:277, y:232, w:128, h:50, text:why23?"The rest of my top "+F.length+": "+why23:"", ph:"Why do you like one over the other?"});
        setTimeout(function(){ wsEnsure(); wsB.applyTemplate({id:"artist", name:"Artist model", build:function(){ return {bg:"white", items:items}; }}); rs.sent=(rs.sent||0)+1;
          if(box) box.classList.remove("rs-leaving"); stRoom("workshop"); setTimeout(function(){ toast("Added to your workbook. Your why is on the page."); },120); }, 260); }); }
  // ---- into the workbook: an Artist model page with the photograph, an arrow to your detail, and your answers ----
  function rsToWorkbook(im){ var p=rs.pack, r=rs.round||{tap:{},notes:{}}, n=r.notes[im.id]||{}, tap=r.tap[im.id];
    var i=-1; photos.forEach(function(x,j){ if(x.url===im.url&&x.research) i=j; });
    if(i<0){ photos.push({url:im.url, t:new Date(), place:"Research", research:true, credit:p.name}); i=photos.length-1; if(typeof refreshCount==="function") refreshCount(); }
    var pid=stId(i), go=function(a){ var box={x:15,y:38,w:192,h:150}, f=bdFit(box,a), fh=f.w/a;
    f.y=box.y; var
      items=[{t:"text", role:"title", x:15, y:12, w:390, h:18, text:"Artist model: "+p.name}, {t:"photo", pid:pid, x:f.x, y:f.y, w:f.w, box:box},
        {t:"text", role:"caption", x:15, y:192, w:192, h:14, text:p.name},
        {t:"text", role:"text", x:228, y:38, w:177, h:70, text:n.note?"The detail: "+n.note:"", ph:"Name the detail, and say why it caught you."},
        {t:"text", role:"text", x:228, y:114, w:177, h:60, text:n.prompt3?"It brings up: "+n.prompt3:"", ph:"Does it remind you of anything?"},
        {t:"text", role:"text", x:228, y:180, w:177, h:60, text:n.prompt4?"How it was made: "+n.prompt4:"", ph:"Angle, distance, light, framing, timing..."},
        {t:"text", role:"text", x:15, y:214, w:192, h:68, text:"", ph:"How will you use this in your own photographs?"}];
      if(tap) items.push({t:"line", x:226, y:60, x2:f.x+tap.x*f.w, y2:f.y+tap.y*fh, head:"end", wt:0.6, color:"#e4552e"});
      wsEnsure(); wsB.applyTemplate({id:"research", name:"Artist model", build:function(){ return {bg:"white", items:items}; }}); rs.sent=(rs.sent||0)+1; stRoom("workshop"); };
    var probe=new Image(); probe.onload=function(){ go(probe.naturalWidth/Math.max(1,probe.naturalHeight)); }; probe.onerror=function(){ go(1.5); }; probe.src=im.url; }

  // ---- moodboard: every pack's photographs in one place; pick favourites, get an A3 page ----
  function rsFirstCull(){ if(rs.culls) return false; try{ return localStorage.getItem("studium_culled")!=="1"; }catch(e){ return false; } }
  function rsAll(){ var seen={}, out=[]; (rs.packs||[]).forEach(function(p){ p.imgs.forEach(function(im){ if(seen[im.url]) return; seen[im.url]=1; out.push({id:im.id, url:im.url, pack:p.name}); }); }); return out; }
  var RS_MOOD_MAX=16;
  function rsMoodToggle(url){ var m=rs.mood||(rs.mood=[]), i=m.indexOf(url); if(i>=0) m.splice(i,1); else if(m.length<RS_MOOD_MAX) m.push(url); else toast("That's "+RS_MOOD_MAX+": take one off first"); rsRender(); }
  /* every photograph from every pack, shuffled once per visit so the wall feels new and nothing gets favoured by position */
  function rsMoodOrder(){ var all=rsAll(); if(!rs.moodOrder||rs.moodOrder.length!==all.length) rs.moodOrder=rsShuffle(all); return rs.moodOrder; }
  function rsMoodHTML(top){ var m=rs.mood||[], all=rsMoodOrder();
    return top+'<span class="rs-count">MOODBOARD · '+m.length+' / '+RS_MOOD_MAX+'</span></div><div class="rs-moodw"><p class="rs-q">Pick the photographs you want to bring to your own shoot. They\'ll be laid out on one A3 page in your workbook.</p>'
      +'<div class="rs-mgrid rs-masonry">'+all.map(function(im){ var k=m.indexOf(im.url); return '<button class="rs-mt'+(k>=0?' on':'')+'" data-rs-act="mpick" data-rs-url="'+rsEsc(im.url)+'"><img src="'+rsEsc(im.url)+'" alt="" loading="lazy" draggable="false">'+(k>=0?'<b>'+(k+1)+'</b>':'')+'<span>'+rsEsc(im.pack)+'</span></button>'; }).join("")+'</div>'
      +'<div class="rs-mbar"><button class="rs-go" data-rs-act="moodmake"'+(m.length<2?' disabled':'')+'>Make my A3 moodboard ›</button><button class="rs-go2" data-rs-act="mclear">Clear</button></div></div>'; }
  function rsMoodMake(){ var m=(rs.mood||[]).slice(), all=rsAll(), by={}; all.forEach(function(im){ by[im.url]=im; }); if(m.length<2) return;
    var pids=[], packs=[];
    m.forEach(function(url){ var im=by[url]; if(!im) return; var i=-1; photos.forEach(function(x,j){ if(x.url===url&&x.research) i=j; });
      if(i<0){ photos.push({url:url, t:new Date(), place:"Research", research:true, credit:im.pack}); i=photos.length-1; }
      pids.push(stId(i)); if(packs.indexOf(im.pack)<0) packs.push(im.pack); });
    if(typeof refreshCount==="function") refreshCount();
    Promise.all(m.map(function(url){ return new Promise(function(res){ var pr=new Image(); pr.onload=function(){ res(pr.naturalWidth/Math.max(1,pr.naturalHeight)); }; pr.onerror=function(){ res(1.5); }; pr.src=url; }); }))
      .then(function(A){ var box={x:15,y:32,w:390,h:236}, g=3, items=[{t:"text", role:"title", x:15, y:10, w:390, h:18, text:"Moodboard"}], n=A.length, best=null;
        // justified rows: try every row count, split the photos into rows of even width, keep the one that fills the page best
        for(var k=1;k<=n;k++){ var rows=[], per=n/k, at=0; for(var j=0;j<k;j++){ var end=Math.round((j+1)*per); rows.push(A.slice(at,end).map(function(a,q){ return at+q; })); at=end; }
          var hs=rows.map(function(r){ var sa=0; r.forEach(function(i){ sa+=A[i]; }); return (box.w-g*(r.length-1))/sa; }), H=hs.reduce(function(x,y){ return x+y; },0)+g*(k-1);
          var f=Math.min(1,box.h/H), score=Math.abs(1-H*f/box.h)+(1-f)*0.3; if(!best||score<best.s) best={s:score, rows:rows, hs:hs, f:f, H:H*f}; }
        var y=box.y+(box.h-best.H)/2;
        best.rows.forEach(function(r,j){ var h=best.hs[j]*best.f, rw=0; r.forEach(function(i){ rw+=A[i]*h; }); rw+=g*(r.length-1); var x=box.x+(box.w-rw)/2;
          r.forEach(function(i){ items.push({t:"photo", pid:pids[i], x:x, y:y, w:A[i]*h}); x+=A[i]*h+g; }); y+=h+g; });
        items.push({t:"text", role:"caption", x:15, y:274, w:390, h:14, text:"Photographs: "+packs.join(", ")});
        wsEnsure(); wsB.applyTemplate({id:"moodboard", name:"Moodboard", build:function(){ return {bg:"white", items:items}; }}); rs.moods=(rs.moods||0)+1; rs.mood=[]; stRoom("workshop"); }); }

  // ---- drawing ----
  function rsEsc(s){ return cbEsc(String(s==null?"":s)); }
  function rsDot(t){ return t?'<i class="rs-dot" style="left:'+(t.x*100).toFixed(2)+'%;top:'+(t.y*100).toFixed(2)+'%"></i>':''; }
  function rsWall(){ var all=rsAll(); if(!all.length) return ""; if(!rs.wall||rs.wall.n!==all.length) rs.wall={n:all.length, imgs:rsShuffle(all).slice(0,24)};
    return '<section class="rs-hero"><div class="rs-hero-t"><span class="eb">MOODBOARD</span><h2>All the photographs together</h2><p>Every pack in one place. Pick the ones you love and they become an A3 moodboard in your workbook.</p><button class="rs-go2" data-rs-act="mood">Make your moodboard ›</button></div>'
      +'<button class="rs-wall" data-rs-act="mood" aria-label="Open the moodboard"><span class="rs-masonry">'+rs.wall.imgs.map(function(im){ return '<img src="'+rsEsc(im.url)+'" alt="" loading="lazy" draggable="false">'; }).join("")+'</span></button></section>'; }
  /* about two head-to-heads a photograph, five seconds or so each: a 12-photo pack is about two minutes, a 40-photo pack about seven */
  function rsCullTime(p){ var n=p&&p.imgs?p.imgs.length:12, m=Math.round(Math.max(1,2*(n-1))*5/60); return m<=1?"about a minute":"about "+(m<=10?["","","two","three","four","five","six","seven","eight","nine","ten"][m]:m)+" minutes"; }
  function rsShelf(){ var h='';
    if(rs.loading&&!rs.packs) return '<div class="rs-head"><span class="eb">RESEARCH</span><h2>Look closely at other photographers</h2></div><div class="rs-none">Loading packs…</div>';
    /* split in half: the artist packs on the left (where to start), the moodboard on the right */
    var glow=rsFirstCull(), p0=(rs.packs||[])[0];
    h+='<div class="rs-split"><div class="rs-sl'+(glow?' rs-slglow':'')+'"><div class="rs-head"><span class="eb">'+(glow?'START HERE':'ARTIST PACKS')+'</span><h2>Choose an artist pack</h2><p>Each pack is one photographer or idea. Play its Culling Game: two photographs at a time, pick the stronger one. It takes '+(p0?rsCullTime(p0):'a few minutes')+', and at the end you have your top five.</p><button class="rs-go2 rs-libgo" data-rs-act="all">Open the archive ›</button></div>';
    return h+'<div class="rs-shelf'+(glow?' rs-glow':'')+'">'+(rs.packs||[]).map(function(p){ var ln=rsLinks(p.links), d1=rs.done[p.id+":punctum"], d2=rs.done[p.id+":cull"];
      return '<div class="rs-pack" data-rs-pack="'+rsEsc(p.id)+'"><div class="rs-cover">'+p.imgs.slice(0,3).map(function(im){ return '<img src="'+rsEsc(im.url)+'" alt="" loading="lazy" draggable="false">'; }).join("")+'</div>'
        +'<div class="rs-meta"><b>'+rsEsc(p.name)+'</b><span>'+p.imgs.length+' photographs'+(ln.length?' · '+ln.map(function(l){ return '<a href="'+rsEsc(l.url)+'" target="_blank" rel="noopener">'+rsEsc(l.label)+'</a>'; }).join(' · '):'')+'</span></div>'
        +'<div class="rs-acts"><button class="'+(d2?'rs-go2':'rs-go')+'" data-rs-act="cull" data-rs-id="'+rsEsc(p.id)+'">'+(d2?'✓ PLAY AGAIN':'CULLING GAME')+'</button>'+(d2?'<button class="rs-go" data-rs-act="all" data-rs-id="'+rsEsc(p.id)+'">See all the photos ›</button>':'')+'</div></div>'; }).join("")+'</div>'
      +(rs.offline?'<p class="rs-off">Couldn\'t reach your class packs right now, so here\'s what this computer has saved, and a sample pack.</p>':'')+'</div><div class="rs-sr">'+rsWall()+'</div></div>'; }
  function rsRound(top){ var r=rs.round, im=r.imgs[r.k], tp=r.tap[im.id], n=r.notes[im.id]||{}, h=top+'<span class="rs-count">'+(r.k+1)+' / '+r.imgs.length+'</span></div><div class="rs-play"><div class="rs-stage'+(r.step==="tap"&&!tp?' tapping':'')+'"><div class="rs-imgw"><img class="rs-img" src="'+rsEsc(im.url)+'" alt="" draggable="false">'+rsDot(tp)+'</div></div><aside class="rs-side">';
    if(r.step==="ask") h+='<span class="eb">PUNCTUM</span><h3>Does anything in this photograph prick you?</h3><p class="rs-q">Barthes called it the punctum, a small detail that catches your eye and stays with you.</p>'
      +'<div class="rs-yn"><button class="rs-go" data-rs-act="yes">Yes, something</button><button class="rs-go2" data-rs-act="no">Not this one</button></div>';
    else h+='<span class="eb">PUNCTUM</span><h3>'+(tp?'Now say why':'Click the detail')+'</h3>'+(tp?'':'<p class="rs-q">Click right on the thing that caught you.</p>')
      +(tp?RS_PROMPTS.map(function(q){ return '<label class="rs-f"><span>'+q[1]+'</span><textarea data-rs-note="'+q[0]+'" placeholder="'+rsEsc(q[2])+'">'+rsEsc(n[q[0]]||"")+'</textarea></label>'; }).join("")
        +'<div class="rs-yn"><button class="rs-go" data-rs-act="next">'+(r.k+1<r.imgs.length?'Next photograph ›':'Finish ›')+'</button><button class="rs-go2" data-rs-act="retap">Click again</button></div>':'');
    return h+'</aside></div>'; }
  function rsCullHTML(top){ var c=rs.cull, a=c.cand, b=c.top[c.mid], L=c.flip?b:a, R=c.flip?a:b;
    return top+'<span class="rs-count">CULLING · '+c.picks+' PICKS · '+(c.queue.length+(c.cand?1:0))+' TO GO</span></div><div class="rs-cull"><p class="rs-q">Which is the stronger photograph? Go with your gut.</p><div class="rs-ab">'
      +'<button class="rs-card" data-rs-act="pick" data-rs-win="'+(L===a?1:0)+'"><img src="'+rsEsc(L.url)+'" alt="" draggable="false"><span>A</span></button>'
      +'<button class="rs-card" data-rs-act="pick" data-rs-win="'+(R===a?1:0)+'"><img src="'+rsEsc(R.url)+'" alt="" draggable="false"><span>B</span></button></div></div>'; }
  /* the library: every photograph from every photographer, with a rail of folders down the side. Choose three from one photographer, then four more from anyone (up to twelve),
     from one photographer or across several, and they become an artist model page. Opened from the Culling Game's results, it starts
     on the pack you just culled, with your top three badged. */
  var RS_AM_MAX=12, RS_AM_PACK=3, RS_AM_MORE=4, RS_AM_Q="Why do you like one over the other?";
  /* three from the pack you just culled, then four more from All artists */
  function rsAmNeed(){ return Math.min(RS_AM_PACK+RS_AM_MORE, rsAll().length||7); }
  function rsAmPack(){ var p=rs.pack; return p&&p.id!=null&&p.id!=="*"?rsPack(p.id):null; }
  function rsAmFromPack(){ var p=rsAmPack(); if(!p) return 0; var ids={}; p.imgs.forEach(function(im){ ids[String(im.id)]=1; }); return (rs.am||[]).filter(function(id){ return ids[id]; }).length; }
  function rsAmStage(){ var am=rs.am||[], need=rsAmNeed(); if(am.length>=need) return "write"; var pk=rsAmPack(); if(pk&&rsAmFromPack()<Math.min(RS_AM_PACK,pk.imgs.length)) return "pack"; return rs.lib==="*"?"more":"toall"; }
  function rsAmReady(){ return (rs.am||[]).length>=rsAmNeed(); }
  function rsFind(id){ var P=rs.packs||[]; for(var i=0;i<P.length;i++){ var im=P[i].imgs.filter(function(x){ return String(x.id)===String(id); })[0]; if(im) return {im:im, pack:P[i]}; } return null; }
  function rsLibItems(){ var q=String(rs.q||"").trim().toLowerCase(), out=[]; (rs.packs||[]).forEach(function(p){ if(rs.lib&&rs.lib!=="*"&&String(p.id)!==String(rs.lib)) return; if(q&&p.name.toLowerCase().indexOf(q)<0) return; p.imgs.forEach(function(im){ out.push({im:im, pack:p}); }); }); return out; }
  function rsAllHTML(top){ var p=rs.pack, am=rs.am||(rs.am=[]), need=rsAmNeed(), P=rs.packs||[], items=rsLibItems(), total=rsAll().length;
    if(rs.lib==null) rs.lib=p?String(p.id):"*";
    var ranked=(rs.res&&rs.res.kind==="cull"&&rs.res.top)?rs.res.top.map(function(x){ return String(x.id); }):[];
    var rail='<aside class="rs-libr"><input class="rs-search" type="search" placeholder="Search artists" value="'+rsEsc(rs.q||"")+'" data-rs-q>'
      +'<button class="rs-libf'+(rs.lib==="*"?' on':'')+(rsAmStage()==="toall"?' rs-nudge':'')+'" data-rs-lib="*"><b>All artists</b><em>'+total+'</em></button><span class="eb">ARTISTS</span>'
      +P.map(function(k){ var culled=!!(typeof Q!=="undefined"&&Q.rs&&Q.rs.cull&&Q.rs.cull[k.id]); return '<button class="rs-libf'+(String(k.id)===String(rs.lib)?' on':'')+'" data-rs-lib="'+rsEsc(k.id)+'"><b>'+rsEsc(k.name)+'</b>'+(culled?'<i title="Culled">✓</i>':'')+'<em>'+k.imgs.length+'</em></button>'; }).join("")+'</aside>';
    var stg=rsAmStage(), pk=rsAmPack(), fp=rsAmFromPack(), more=Math.max(0,need-am.length);
    var lead=stg==="pack"?'<b>Choose '+RS_AM_PACK+' photographs from '+rsEsc(pk.name)+'</b> that show how they work. '+Math.max(0,Math.min(RS_AM_PACK,pk.imgs.length)-fp)+' to go.'
      :stg==="toall"?'<b>Now click All artists</b>, on the left, and choose '+more+' more from any photographer.'
      :stg==="more"?'<b>Choose '+more+' more</b> from any photographer. Look for ones that feel different to the first ones you picked.'
      :'That\'s enough for a page. Make it, then answer the question on the page.';
    return top+'<span class="rs-count">CHOSEN · '+am.length+' / '+need+'</span></div><div class="rs-lib">'+rail+'<div class="rs-libm"><p class="rs-q rs-amlead">'+lead+'</p>'
      +'<div class="rs-mgrid rs-masonry"'+(items.length?'':' style="display:none"')+'>'+items.map(function(e){ var im=e.im, k=am.indexOf(String(im.id)), r=(rs.pack&&e.pack===rs.pack)?ranked.indexOf(String(im.id)):-1;
          return '<button class="rs-mt rs-at'+(k>=0?' on':'')+'" data-rs-act="ampick" data-rs-img="'+rsEsc(im.id)+'"><img src="'+rsEsc(im.url)+'" alt="" loading="lazy" draggable="false">'+(k>=0?'<b>'+(k+1)+'</b>':'')+'<span>'+(r>=0?'YOUR #'+(r+1)+' · ':'')+rsEsc(e.pack.name)+'</span></button>'; }).join("")+'</div><div class="rs-none"'+(items.length?' style="display:none"':'')+'>No photographer called that.</div>' 
      +'<div class="rs-mbar">'
      +'<button class="rs-go" data-rs-act="amake"'+(rsAmReady()?'':' disabled')+'>Make my artist model page ›</button><button class="rs-go2" data-rs-act="amclear">CLEAR</button></div></div></div>'; }
  function rsAmToggle(id){ var am=rs.am||(rs.am=[]), i=am.indexOf(String(id)), was=rsAmStage(); if(i>=0) am.splice(i,1); else if(am.length<RS_AM_MAX) am.push(String(id)); else toast("That's "+RS_AM_MAX+": take one off first"); rsRender();
    var now=rsAmStage(), box=$("st-research"); if(!box||now===was) return;
    if(now==="toall") toast("That's three. Now click All artists.");
    if(now==="write") toast("That's seven. Make your page."); }
  function rsAmMake(){ var ids=(rs.am||[]).slice(); if(!rsAmReady()) return; var hits=ids.map(rsFind).filter(Boolean), ims=hits.map(function(h){ return h.im; }), names=[];
    hits.forEach(function(h){ if(names.indexOf(h.pack.name)<0) names.push(h.pack.name); });
    var pids=hits.map(function(h){ var im=h.im, i=-1; photos.forEach(function(x,j){ if(x.url===im.url&&x.research) i=j; }); if(i<0){ photos.push({url:im.url, t:new Date(), place:"Research", research:true, credit:h.pack.name}); i=photos.length-1; } return stId(i); });
    if(typeof refreshCount==="function") refreshCount();
    Promise.all(ims.map(function(im){ return new Promise(function(res){ var pr=new Image(); pr.onload=function(){ res(pr.naturalWidth/Math.max(1,pr.naturalHeight)); }; pr.onerror=function(){ res(1.5); }; pr.src=im.url; }); }))
      .then(function(A){ var box={x:15,y:34,w:262,h:228}, g=3, items=[{t:"text", role:"title", x:15, y:10, w:390, h:18, text:"Artist models: "+names.join(", ")}], n=A.length, best=null;
        for(var k=1;k<=n;k++){ var rows=[], per=n/k, at=0; for(var j=0;j<k;j++){ var end=Math.round((j+1)*per); rows.push(A.slice(at,end).map(function(a,q){ return at+q; })); at=end; }
          var hs=rows.map(function(r){ var sa=0; r.forEach(function(i){ sa+=A[i]; }); return (box.w-g*(r.length-1))/sa; }), H=hs.reduce(function(x,y){ return x+y; },0)+g*(k-1);
          var f=Math.min(1,box.h/H), score=Math.abs(1-H*f/box.h)+(1-f)*0.3; if(!best||score<best.s) best={s:score, rows:rows, hs:hs, f:f, H:H*f}; }
        var y=box.y+(box.h-best.H)/2;
        best.rows.forEach(function(r,j){ var h=best.hs[j]*best.f, rw=0; r.forEach(function(i){ rw+=A[i]*h; }); rw+=g*(r.length-1); var x=box.x+(box.w-rw)/2;
          r.forEach(function(i){ items.push({t:"photo", pid:pids[i], x:x, y:y, w:A[i]*h}); x+=A[i]*h+g; }); y+=h+g; });
        items.push({t:"text", role:"caption", x:15, y:268, w:262, h:14, text:"Photographs: "+names.join(", ")});
        /* one text box on the right with the question in it: they write their answer on the page (Finished waits for it) */
        items.push({t:"text", role:"text", x:288, y:34, w:117, h:228, text:"", ph:RS_AM_Q, sentence:true});
        wsEnsure(); wsB.applyTemplate({id:"artist", name:"Artist model", build:function(){ return {bg:"white", items:items}; }}); rs.sent=(rs.sent||0)+1; rs.am=[]; stRoom("workshop"); setTimeout(function(){ toast("Now answer the question on the page: "+RS_AM_Q); },200); }); }
  function rsResults(top){ var res=rs.res, p=rs.pack, h=top+'</div><div class="rs-res">';
    if(res.kind==="punctum"){ var rr=res.round, mine=rr.imgs.filter(function(im){ return rr.struck[im.id]; });
      h+='<div class="rs-rh"><span class="eb">YOUR PUNCTUMS</span><h3>'+(mine.length?mine.length+' of '+rr.imgs.length+' pricked you':'Nothing pricked you this time')+'</h3><p class="rs-q">'+(res.counts?'The numbers show how many in your class were caught by each one. ':'')+(mine.length?'Take one into your workbook to write it up.':'Try the Culling Game, or another pack.')+'</p></div><div class="rs-grid">'
        +rr.imgs.map(function(im){ var on=rr.struck[im.id], k=res.counts&&res.counts[im.id];
          return '<div class="rs-tile'+(on?' on':'')+'"><div class="rs-imgw"><img src="'+rsEsc(im.url)+'" alt="" loading="lazy">'+rsDot(rr.tap[im.id])+'</div>'
            +'<div class="rs-tm">'+(k?'<span>'+k.y+' of '+k.n+' caught</span>':'<span></span>')+(on?'<button class="rs-wb" data-rs-act="wb" data-rs-img="'+rsEsc(im.id)+'">INTO WORKBOOK ›</button>':'')+'</div></div>'; }).join("")+'</div>'; }
    else { var ct=res.cls, row=function(im,k){ return im?'<div class="rs-ri"><b>'+(k+1)+'</b><img src="'+rsEsc(im.url)+'" alt=""></div>':''; };
      h+='<div class="rs-rh"><span class="eb">YOUR TOP FIVE</span><h3>Your ranking'+(ct&&ct.n>1?', next to your class':'')+'</h3><p class="rs-q">'+(ct&&ct.n>1?'Look at where your picks differ from your class. ':'')+'Then say what it is about your #1.</p></div><div class="rs-cullw"><div class="rs-rank"><div><span class="eb">YOU</span>'+res.top.map(row).join("")+'</div>'
        +(ct&&ct.n>1?'<div><span class="eb">CLASS · '+ct.n+' PLAYED</span>'+ct.ids.map(function(id,k){ return row(p.imgs.filter(function(x){ return String(x.id)===String(id); })[0],k); }).join("")+'</div>':'')+'</div>'
        +(res.top.length?'<div class="rs-why"><span class="eb">PUNCTUM · YOUR #1</span><h3>What is it in your #1 that holds you?</h3><p class="rs-q">Name the detail and say why it caught you. Barthes called it the punctum, the small thing that pricks you and stays.</p>'
          +'<label class="rs-f"><span>WHY IT\'S YOUR #1</span><textarea data-rs-why="why" rows="3" placeholder="The detail I keep coming back to is...">'+rsEsc(res.why)+'</textarea></label><p class="rs-whyhint'+(rsWhyOk(res.why)?' ok':'')+'">'+rsEsc(rsWhyHint(res.why))+'</p>'
          +(res.top.length>1?'<label class="rs-f rs-f2"><span>AND #2'+(res.top.length>2?' TO #'+res.top.length:'')+' · OPTIONAL</span><input type="text" data-rs-why="why23" maxlength="200" placeholder="One line, if you like" value="'+rsEsc(res.why23)+'"></label>':'')
          +'<button class="rs-go rs-whygo" data-rs-act="cullwb"'+(rsWhyOk(res.why)&&!res.sent?'':' disabled')+'>'+(res.sent?'In your workbook ✓':'Put it in my workbook ›')+'</button></div>':'')+'</div>'; }
    return h+'<div class="rs-yn"><button class="rs-go2" data-rs-act="'+(res.kind==="punctum"?"cull":"all")+'" data-rs-id="'+rsEsc(p.id)+'">'+(res.kind==="punctum"?"Now the Culling Game":"See all the photos ›")+'</button><button class="rs-go2" data-rs-act="shelf">All packs</button></div></div>'; }
  function rsRender(){ if(rs.res&&rs.res.kind==="cull"&&!rs.res.posted&&rs.view!=="results") rsCullPost("");
    var box=$("st-research"); if(!box||!st.open||st.room!=="research") return;
    var fa=document.activeElement, fk=fa&&box.contains(fa)&&fa.getAttribute&&(fa.getAttribute("data-rs-why")||(fa.hasAttribute("data-rs-amwhy")?"*am":null)), fs=fk?fa.selectionStart:0;
    if(rs.view==="mood"&&!rs.pack) rs.pack={name:"Every pack", imgs:[]};
    if(rs.view==="all"&&!rs.pack) rs.pack={name:"All artists", imgs:[], id:"*"};
    if(rs.view==="shelf"||!rs.pack){ if(!rs.packs&&!rs.loading) return rsLoad(); box.innerHTML=rsShelf(); return; }
    var top='<div class="rs-bar"><button class="rs-back" data-rs-act="shelf">‹ All packs</button><span class="rs-pn">'+rsEsc(rs.view==="all"?"The archive":rs.pack.name)+'</span>';
    box.innerHTML=rs.view==="round"?rsRound(top):rs.view==="cull"?rsCullHTML(top):rs.view==="mood"?rsMoodHTML(top):rs.view==="all"?rsAllHTML(top):rsResults(top);
    if(rs.view==="round") rsWireNotes(box);
    if(fk){ var re=box.querySelector(fk==="*am"?'[data-rs-amwhy]':'[data-rs-why="'+fk+'"]'); if(re){ re.focus(); try{ re.setSelectionRange(fs,fs); }catch(e){} } } }
  function rsWireNotes(box){ Array.prototype.forEach.call(box.querySelectorAll("[data-rs-note]"),function(t){ t.addEventListener("input",function(){ var r=rs.round, im=r.imgs[r.k]; (r.notes[im.id]||(r.notes[im.id]={}))[t.getAttribute("data-rs-note")]=t.value; }); t.addEventListener("keydown",function(e){ e.stopPropagation(); }); }); }
  (function rsWire(){ var box=$("st-research"); if(!box) return;
    box.addEventListener("input",function(e){ var wf=e.target.closest&&e.target.closest("[data-rs-why]");
      if(wf&&rs.res&&rs.res.kind==="cull"){ rs.res[wf.getAttribute("data-rs-why")]=wf.value; var ok=rsWhyOk(rs.res.why), hb=box.querySelector(".rs-whyhint"), gb=box.querySelector(".rs-whygo");
        if(hb){ hb.textContent=rsWhyHint(rs.res.why); hb.classList.toggle("ok",ok); } if(gb){ if(ok) gb.removeAttribute("disabled"); else gb.setAttribute("disabled",""); } return; }
      var aw=e.target.closest&&e.target.closest("[data-rs-amwhy]");
      if(aw){ rs.amWhy=aw.value; var ok2=rsWhyOk(rs.amWhy), hb2=box.querySelector(".rs-amq .rs-whyhint"), gb2=box.querySelector('[data-rs-act="amake"]');
        if(hb2){ hb2.textContent=ok2?"Lovely. That goes on the page next to the photographs.":rsWhyHint(rs.amWhy); hb2.classList.toggle("ok",ok2); } if(gb2){ if(rsAmReady()) gb2.removeAttribute("disabled"); else gb2.setAttribute("disabled",""); } return; }
      var q=e.target.closest&&e.target.closest("[data-rs-q]"); if(!q) return; rs.q=q.value; var m=box.querySelector(".rs-libm"); if(!m) return;
      var items=rsLibItems(), am=rs.am||[], ranked=(rs.res&&rs.res.kind==="cull"&&rs.res.top)?rs.res.top.map(function(x){ return String(x.id); }):[], grid=m.querySelector(".rs-mgrid"), none=m.querySelector(".rs-none");
      var h=items.map(function(e2){ var im=e2.im, k=am.indexOf(String(im.id)), r=(rs.pack&&e2.pack===rs.pack)?ranked.indexOf(String(im.id)):-1; return '<button class="rs-mt rs-at'+(k>=0?' on':'')+'" data-rs-act="ampick" data-rs-img="'+rsEsc(im.id)+'"><img src="'+rsEsc(im.url)+'" alt="" loading="lazy" draggable="false">'+(k>=0?'<b>'+(k+1)+'</b>':'')+'<span>'+(r>=0?'YOUR #'+(r+1)+' · ':'')+rsEsc(e2.pack.name)+'</span></button>'; }).join("");
      if(grid){ grid.innerHTML=h; grid.style.display=items.length?"":"none"; } if(none) none.style.display=items.length?"none":""; });
    box.addEventListener("keydown",function(e){ if(e.target.closest&&e.target.closest("[data-rs-q],[data-rs-why],[data-rs-amwhy]")) e.stopPropagation(); },true);
    box.addEventListener("click",function(e){ var r=rs.round;
      if(rs.view==="round"&&r&&r.step==="tap"&&!r.tap[r.imgs[r.k].id]){ var w=e.target.closest(".rs-imgw"); if(w){ var b=w.getBoundingClientRect(); r.tap[r.imgs[r.k].id]={x:Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)), y:Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))}; rs.taps=(rs.taps||0)+1; rsRender(); var t0=box.querySelector("[data-rs-note]"); if(t0) t0.focus(); return; } }
      var lb=e.target.closest("[data-rs-lib]"); if(lb){ rs.lib=lb.getAttribute("data-rs-lib"); var m=box.querySelector(".rs-libm"); if(m) m.scrollTop=0; return rsRender(); }
      var t=e.target.closest("[data-rs-act]"); if(!t) return; var a=t.getAttribute("data-rs-act"), id=t.getAttribute("data-rs-id");
      if(a==="shelf"){ rs.view="shelf"; rs.pack=null; return rsRender(); }
      if(a==="mood"){ rs.view="mood"; rs.pack=null; rs.moodOrder=null; box.scrollTop=0; return rsRender(); }
      if(a==="all"){ var pk=rsPack(id)||rs.pack; rs.pack=pk||rs.pack||null; rs.lib=pk?String(pk.id):"*"; rs.q=""; rs.view="all"; box.scrollTop=0; return rsRender(); }
      if(a==="ampick") return rsAmToggle(t.getAttribute("data-rs-img")); if(a==="amclear"){ rs.am=[]; return rsRender(); } if(a==="amake") return rsAmMake(); if(a==="mpick") return rsMoodToggle(t.getAttribute("data-rs-url"));
      if(a==="mclear"){ rs.mood=[]; return rsRender(); } if(a==="moodmake") return rsMoodMake();
      if(a==="round") return rsStartRound(rsPack(id)||rs.pack); if(a==="cull") return rsStartCull(rsPack(id)||rs.pack);
      if(a==="yes") return rsRoundAnswer(true); if(a==="no") return rsRoundAnswer(false); if(a==="next") return rsRoundNext();
      if(a==="retap"){ delete r.tap[r.imgs[r.k].id]; return rsRender(); }
      if(a==="pick") return rsCullPick(t.getAttribute("data-rs-win")==="1");
      if(a==="cullwb"){ if(!t.disabled) rsCullWorkbook(); return; }
      if(a==="wb"){ var im=rs.res.round.imgs.filter(function(x){ return String(x.id)===t.getAttribute("data-rs-img"); })[0]; if(im) rsToWorkbook(im); } }); })();
  if(/[?&]dev/.test(location.search)) window.__rs={ state:function(){ return {view:rs.view, packs:(rs.packs||[]).map(function(p){ return {id:p.id, n:p.imgs.length}; }), offline:rs.offline, k:rs.round&&rs.round.k, step:rs.round&&rs.round.step, top:rs.cull&&rs.cull.top.length, rounds:rs.rounds||0, culls:rs.culls||0, mood:(rs.mood||[]).length, moods:rs.moods||0, sent:rs.sent||0, taps:rs.taps||0}; } };
