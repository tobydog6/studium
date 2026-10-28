// ================= GALLERY OPENING NIGHT and the review (docs/gallery-brief.md, "the reception") =================
// book(): name the show and book the night (galBookOpening). start(): core calls it at 6 pm on the opening day; the night
// runs live in the room (gNightCrowd guests) with a small panel, moments as toasts and night sales, until NIGHT_END or
// "Wrap up the night", then galNightDone(result). review(r): next morning, the newspaper clipping with the reception and
// "What the critic noticed" (the teachable part). Two clipping designs: ?review=local (default) or ?review=broadsheet.
// Scoring (ntScore) is plain on purpose so students can see why: quality, hang, coherence, pricing and turnout.
var NT={on:false, guests:[], lastT:0, sold:0, take:0, arrived:0, critic:null, nextMoment:0, said:{}, raf:0, panel:null};
var NT_CRITICS=[{name:"Hinemoa Pāora", role:"Visual arts writer"}, {name:"Graeme Lusk", role:"Arts editor"},
  {name:"Priya Naidoo-Hart", role:"Photography critic"}, {name:"Tom Fairweather", role:"Arts reporter"}];
function ntQs(){ var q=location.search; try{ if(BR) q+="&"+parent.location.search; }catch(e){} return q; }
function ntStyle(){ var m=ntQs().match(/[?&]review=(\w+)/); return m&&m[1]==="broadsheet"?"broadsheet":"local"; }
function ntClamp(v){ return Math.max(0, Math.min(1, v)); }
function ntPlace(p){ return String(p&&p.name||"Untitled").replace(/\s*\d+$/,"").trim()||"Untitled"; }
function ntReal(pl){ return !!pl&&!/^(sample|uploads|untitled)$/i.test(pl); }   /* a real place name, not a stand-in */
function ntNum(n){ return n>=0&&n<=10?["no","one","two","three","four","five","six","seven","eight","nine","ten"][n]:String(n); }
function ntCap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function ntName(it){ var p=phById(it.pid); return p?p.name:"Untitled"; }
function ntQ(s){ return "‘"+s+"’"; }
function ntPick(arr, seed){ return arr[Math.floor(gHash(seed)*arr.length)%arr.length]; }

gCSS(
  /* the booking dialog */
  ".ntdlg{position:fixed;inset:0;z-index:12;display:grid;place-items:center;background:rgba(8,7,6,.62);padding:16px;backdrop-filter:blur(3px)}"+
  ".ntdlg .box{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px 20px 18px;width:min(440px,100%);box-shadow:0 20px 60px rgba(0,0,0,.5)}"+
  ".ntdlg h2{margin:0 0 4px;font:600 24px var(--display)}.ntdlg p{margin:0 0 14px;color:var(--dim);font-size:14px;line-height:1.45}"+
  ".ntdlg label{display:block;font:500 10px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}"+
  ".ntdlg input{width:100%;box-sizing:border-box;background:#0f0e0b;border:1px solid var(--line);border-radius:10px;color:var(--text);font:500 17px var(--body);padding:11px 12px;user-select:text;-webkit-user-select:text}"+
  ".ntdlg input:focus{outline:2px solid var(--gold);outline-offset:1px}"+
  ".ntdlg .ideas{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px}.ntdlg .ideas button{border:1px solid var(--line);background:transparent;color:var(--text);border-radius:999px;padding:5px 10px;font-size:12.5px;cursor:pointer}"+
  ".ntdlg .ideas button:hover{border-color:var(--gold)}"+
  ".ntdlg .cost{display:flex;gap:10px;align-items:flex-start;background:#0f0e0b;border-radius:10px;padding:10px 12px;font-size:13.5px;line-height:1.45;margin-bottom:16px}.ntdlg .cost b{color:var(--gold);font:500 14px var(--mono)}"+
  ".ntdlg .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}"+
  /* the live panel during the night */
  ".ntpanel{position:fixed;left:12px;top:70px;z-index:5;width:min(250px,calc(100vw - 24px));background:rgba(20,18,14,.9);backdrop-filter:blur(8px);border-radius:14px;padding:12px 14px;border:1px solid #3a3424}"+
  ".ntpanel h3{margin:0;font:600 16px var(--display);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ntpanel .k{font:500 10px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}"+
  ".ntpanel .nums{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}.ntpanel .nums div{background:#0f0e0b;border-radius:8px;padding:6px 8px}"+
  ".ntpanel .nums b{display:block;font:500 17px var(--mono);font-variant-numeric:tabular-nums}.ntpanel .nums small{font-size:11px;color:var(--dim)}"+
  ".ntpanel .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#d8321e;margin-right:4px;vertical-align:1px}"+
  ".ntpanel .bar{height:4px;background:#0f0e0b;border-radius:2px;overflow:hidden;margin-bottom:10px}.ntpanel .bar i{display:block;height:100%;background:var(--gold)}"+
  ".ntpanel .gbtn{width:100%;padding:9px 12px;font-size:13px}"+
  "body[data-night=on] .gbar{display:none}"+
  "@media (max-width:560px){.ntpanel{padding:10px 12px}.ntpanel .nums{margin:8px 0}}"+
  /* the review: shared frame */
  ".ntrev{position:fixed;inset:0;z-index:15;background:rgba(8,7,6,.86);overflow:auto;padding:20px 16px 28px;backdrop-filter:blur(4px);touch-action:pan-y;-webkit-overflow-scrolling:touch}"+
  ".ntrev .wrap{max-width:1020px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.75fr) minmax(250px,1fr);gap:22px;align-items:start}"+
  ".ntrev .lead{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}"+
  ".ntrev .lead .k{font:500 11px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}"+
  ".ntrev .styles{display:flex;gap:4px}.ntrev .styles button{border:1px solid var(--line);background:transparent;color:var(--dim);border-radius:999px;padding:4px 10px;font-size:12px;cursor:pointer}.ntrev .styles button.on{color:#17140d;background:var(--gold);border-color:var(--gold)}"+
  ".ntrev .clip{color:var(--ink);position:relative;user-select:text;-webkit-user-select:text}"+
  ".ntrev .stars{position:relative;display:inline-block;letter-spacing:2px;line-height:1}.ntrev .stars .bg{opacity:.22}.ntrev .stars .fg{position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap}"+
  ".ntrev .clip img{display:block;width:100%;filter:grayscale(1) contrast(1.12) brightness(1.02);mix-blend-mode:multiply}"+
  ".ntrev figure{margin:0}.ntrev figcaption{font:italic 12px/1.35 Georgia,serif;opacity:.75;margin-top:5px}"+
  /* side strip */
  ".ntrev .side{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}"+
  ".ntrev .side h4{margin:0 0 10px;font:500 10px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}"+
  ".ntrev .figs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}.ntrev .figs div{background:#0f0e0b;border-radius:10px;padding:8px 10px}"+
  ".ntrev .figs b{display:block;font:500 19px var(--mono);font-variant-numeric:tabular-nums}.ntrev .figs small{font-size:11.5px;color:var(--dim)}.ntrev .figs .up{color:#8fcf8a}.ntrev .figs .dn{color:#e59a6b}"+
  ".ntrev .parts{display:grid;gap:7px;margin-bottom:16px}.ntrev .parts div{display:grid;grid-template-columns:86px 1fr 30px;gap:8px;align-items:center;font-size:12.5px}"+
  ".ntrev .parts span.b{height:6px;background:#0f0e0b;border-radius:3px;overflow:hidden}.ntrev .parts span.b i{display:block;height:100%;background:var(--gold);border-radius:3px}.ntrev .parts em{font:normal 500 12px var(--mono);color:var(--dim);text-align:right}"+
  ".ntrev ul.notes{list-style:none;margin:0 0 16px;padding:0;display:grid;gap:8px}.ntrev ul.notes li{font-size:13.5px;line-height:1.45;padding-left:22px;position:relative}"+
  ".ntrev ul.notes li:before{position:absolute;left:0;top:0;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;font:700 11px/16px var(--mono);text-align:center}"+
  ".ntrev ul.notes li.up:before{content:'+';background:#2c4a2a;color:#a9e0a3}.ntrev ul.notes li.down:before{content:'!';background:#4f3220;color:#f0b48a}.ntrev ul.notes li.tip:before{content:'i';background:#3a3424;color:var(--gold)}"+
  ".ntrev .side .gbtn{width:100%}"+
  "@media (max-width:760px){.ntrev .wrap{grid-template-columns:minmax(0,1fr)}.ntrev{padding:14px 12px 24px}}"+
  /* design 1, local: a community-paper arts page, warm and chatty, cut out a bit wonky */
  ".ntrev .clip.local{background:#efe6cf;background-image:radial-gradient(rgba(80,60,20,.06) 1px,transparent 1px);background-size:3px 3px;padding:20px 22px 24px;transform:rotate(-.6deg);box-shadow:0 14px 40px rgba(0,0,0,.45);"+
    "clip-path:polygon(0 1%,4% 0,11% .8%,19% 0,27% .6%,36% 0,45% .9%,53% .1%,62% .7%,71% 0,80% .8%,89% .2%,96% .9%,100% 0,99.4% 25%,100% 52%,99.3% 78%,100% 100%,92% 99.2%,83% 100%,74% 99.3%,64% 100%,55% 99.1%,45% 100%,35% 99.4%,26% 100%,16% 99.2%,7% 100%,0 99.3%,.6% 74%,0 49%,.5% 23%)}"+
  ".ntrev .local .mast{display:flex;justify-content:space-between;align-items:baseline;border-bottom:3px double var(--ink);padding-bottom:6px;margin-bottom:12px;gap:8px;flex-wrap:wrap}"+
  ".ntrev .local .mast b{font:800 22px/1 Georgia,var(--display);letter-spacing:.06em}.ntrev .local .mast span{font:600 10.5px var(--body);letter-spacing:.12em;text-transform:uppercase;opacity:.7}"+
  ".ntrev .local .kick{display:inline-block;background:#c8432a;color:#fff6e8;font:700 11px var(--body);letter-spacing:.12em;text-transform:uppercase;padding:3px 7px;border-radius:2px;margin-bottom:8px}"+
  ".ntrev .local h1{font:800 clamp(25px,4.4vw,36px)/1.08 Georgia,var(--display);margin:0 0 10px;letter-spacing:-.01em}"+
  ".ntrev .local .stars{font-size:24px;color:#c8432a}.ntrev .local .sline{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}.ntrev .local .sline small{font:600 12px var(--body);opacity:.75}"+
  ".ntrev .local .cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:16px;align-items:start}"+
  ".ntrev .local figure{background:#fff;padding:6px 6px 8px;transform:rotate(1.2deg);box-shadow:0 2px 6px rgba(0,0,0,.18)}"+
  ".ntrev .local .body p{font:16px/1.55 Georgia,serif;margin:0 0 10px}.ntrev .local .body p:first-child:first-letter{font-weight:800}"+
  ".ntrev .local .by{display:flex;align-items:center;gap:10px;border-top:1px dashed rgba(29,26,21,.4);padding-top:10px;margin-top:6px;font:600 13px var(--body)}"+
  ".ntrev .local .by i{width:34px;height:34px;border-radius:50%;background:#c8432a;color:#fff6e8;display:grid;place-items:center;font:700 13px var(--body);font-style:normal;flex:none}.ntrev .local .by small{display:block;font-weight:500;opacity:.7}"+
  "@media (max-width:560px){.ntrev .local .cols{grid-template-columns:1fr}.ntrev .clip.local{padding:16px 16px 20px;transform:none}.ntrev .local figure{transform:none}}"+
  /* design 2, broadsheet: tight serif, rules and columns, a serious review */
  ".ntrev .clip.broadsheet{background:#f3f0e8;padding:18px 22px 22px;box-shadow:0 14px 40px rgba(0,0,0,.45)}"+
  ".ntrev .broadsheet .mast{text-align:center;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink);padding:6px 0 5px;margin-bottom:4px;font:700 13px Georgia,serif;letter-spacing:.32em}"+
  ".ntrev .broadsheet .date{display:flex;justify-content:space-between;font:10px Georgia,serif;letter-spacing:.08em;text-transform:uppercase;border-bottom:3px double var(--ink);padding-bottom:5px;margin-bottom:14px;opacity:.85}"+
  ".ntrev .broadsheet .kick{font:italic 13px Georgia,serif;margin-bottom:4px}"+
  ".ntrev .broadsheet h1{font:400 clamp(26px,4.6vw,40px)/1.05 Georgia,var(--display);margin:0 0 8px;letter-spacing:-.015em}"+
  ".ntrev .broadsheet .stand{font:italic 16px/1.4 Georgia,serif;margin:0 0 10px;opacity:.88}"+
  ".ntrev .broadsheet .sline{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink);padding:5px 0;margin-bottom:14px;font:600 11px var(--body);letter-spacing:.1em;text-transform:uppercase;gap:8px;flex-wrap:wrap}"+
  ".ntrev .broadsheet .stars{font-size:17px;color:var(--ink)}"+
  ".ntrev .broadsheet .body{columns:3 170px;column-gap:20px;column-rule:1px solid rgba(29,26,21,.25)}"+
  ".ntrev .broadsheet .body p{font:14px/1.5 Georgia,serif;margin:0 0 8px;text-align:justify;hyphens:auto}"+
  ".ntrev .broadsheet .body p:first-of-type:first-letter{float:left;font:400 46px/.8 Georgia,serif;padding:4px 6px 0 0}"+
  ".ntrev .broadsheet figure{break-inside:avoid;margin:0 0 10px}"+
  ".ntrev .broadsheet .by{font:700 11px var(--body);letter-spacing:.1em;text-transform:uppercase;margin:0 0 8px}.ntrev .broadsheet .by small{display:block;font:italic 12px Georgia,serif;letter-spacing:0;text-transform:none;opacity:.75}");

// ---------- 1. book: name the show ----------
function ntIdeas(){ var c={}, best=null; G.hung.forEach(function(it){ var pl=ntPlace(phById(it.pid)); c[pl]=(c[pl]||0)+1; if(!best||c[pl]>c[best]) best=pl; });
  var s=siteById(G.site), out=[]; if(ntReal(best)) out.push(best, "Light on "+best); out.push("Small Hours", "Close to Home"); if(s) out.push("Notes from "+s.street); return out.slice(0,5); }
function ntBook(){ if(document.querySelector(".ntdlg")) return; if(!G.hung.length){ galToast("Hang some work first.", "warn"); return; }
  var tonight=gMin()<15*60, when=tonight?"tonight":"tomorrow night";
  var d=gEl("div","ntdlg"); d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-labelledby","nt-h");
  d.innerHTML='<div class="box"><h2 id="nt-h">Book your opening night</h2><p>Give your show a name. It goes on the invitations, and the critic will use it in the review.</p>'+
    '<label for="nt-t">Show title</label><input id="nt-t" maxlength="48" autocomplete="off" placeholder="Name your show" value="'+gEsc(G.show.title||"")+'">'+
    '<div class="ideas">'+ntIdeas().map(function(s){ return '<button type="button">'+gEsc(s)+'</button>'; }).join("")+'</div>'+
    '<div class="cost"><span><b>'+gMoney(NIGHT_COST)+'</b></span><span>for invitations and catering. It\'s '+gClock()+', so your doors open <b style="font-family:var(--body)">'+when+' at 6 pm</b>'+
    (tonight?'.':' (bookings for tonight close at 3 pm).')+' You\'ve got '+G.hung.length+' work'+(G.hung.length===1?'':'s')+' on the walls.</span></div>'+
    '<div class="row"><button class="gbtn" type="button" data-x="no">Not yet</button><button class="gbtn gold" type="button" data-x="yes">Book it</button></div></div>';
  document.body.appendChild(d); gHold++; var inp=d.querySelector("input"), done=false;
  function close(ok){ if(done) return; done=true; gHold=Math.max(0,gHold-1); d.remove(); if(ok){ var t=inp.value.trim().replace(/\s+/g," ")||"Untitled show"; galBookOpening(t); } }
  d.querySelectorAll(".ideas button").forEach(function(b){ b.onclick=function(){ inp.value=b.textContent; inp.focus(); }; });
  d.querySelector("[data-x=no]").onclick=function(){ close(false); }; d.querySelector("[data-x=yes]").onclick=function(){ close(true); };
  d.addEventListener("keydown", function(e){ if(e.key==="Escape") close(false); else if(e.key==="Enter"&&e.target===inp) close(true); e.stopPropagation(); });
  d.addEventListener("pointerdown", function(e){ if(e.target===d) close(false); });
  setTimeout(function(){ inp.focus(); inp.select(); }, 30); }

// ---------- 2. the night ----------
/* who you can expect: the site's foot traffic, your reputation and buzz, and whether there's enough on the walls to talk about */
function ntTurnout(){ var s=siteById(G.site)||{traffic:1}, n=G.hung.length, draw=0.45+0.55*Math.min(1, n/8);
  return Math.max(4, Math.round((14+s.traffic*5+G.rep*0.9+G.buzz*2.5)*draw*(0.88+Math.random()*0.24))); }
function ntStart(){ var N=NT, total=ntTurnout(); N.on=true; N.guests=[]; N.sold=0; N.take=0; N.arrived=0; N.said={}; N.lastT=G.t; N.nextMoment=gMin()+6; N.expected=total; N.title=G.show.title||"Untitled show";
  for(var i=0;i<total;i++){ var a=NIGHT+Math.round(Math.pow(Math.random(),1.6)*80), stay=55+Math.random()*120; N.guests.push({a:a, l:Math.min(NIGHT_END, Math.round(a+stay))}); }
  var ca=NIGHT+30+Math.round(Math.random()*50); N.critic={a:ca, l:ca+45+Math.round(Math.random()*30)};
  document.body.dataset.night="on"; ntPanel(); galLog("Opening night for "+ntQ(N.title)+" begins. Doors are open.", "money"); ntLoop(); }
function ntPresent(m){ var c=0; NT.guests.forEach(function(g){ if(m>=g.a&&m<g.l) c++; }); if(NT.critic&&m>=NT.critic.a&&m<NT.critic.l) c++; return c; }
/* one game minute of the night */
function ntMinute(m){ var N=NT, here=ntPresent(m); gNightCrowd=here; N.arrived=N.guests.filter(function(g){ return g.a<=m; }).length+(N.critic&&m>=N.critic.a?1:0);
  /* night sales: people come to buy, so the chance is a few times the daytime one; price still matters */
  var open=G.hung.filter(function(it){ return !it.sold; }), p=0.0019*(1+G.rep/50);
  for(var i=0;i<here&&open.length;i++){ if(Math.random()>p) continue; var it=open[(Math.random()*open.length)|0], k=itemWorth(it)/Math.max(1,it.price);
    if(Math.random()<Math.min(0.9, 0.42*k*k)){ gSold(it); N.sold++; N.take+=it.price; open=open.filter(function(x){ return !x.sold; }); } }
  if(N.critic&&m===N.critic.a) galLog("The critic from The Press has arrived.", "money");
  if(N.critic&&m===N.critic.l) galLog("The critic from The Press slips out, notebook full.", "quiet");
  if(m===NIGHT+60&&here>0) galLog("You say a few words of thanks. Warm applause.");
  if(m===NIGHT_END-20) galLog("The last guests are drifting out into the night.");
  if(!N.said.first&&here>0){ N.said.first=1; galLog("The first guests are through the door."); }
  if(m>=N.nextMoment&&here>0&&m<NIGHT_END-25){ N.nextMoment=m+14+Math.round(Math.random()*16); var mo=ntMoment(); if(mo) galLog(mo); } }
/* a little moment in the room; some of them hint at what the critic will notice */
function ntMoment(){ var hung=G.hung.filter(function(it){ return phById(it.pid); }); if(!hung.length) return null;
  var best=hung.slice().sort(function(a,b){ return phById(b.pid).q-phById(a.pid).q; }), any=hung[(Math.random()*hung.length)|0], fav=best[Math.min(best.length-1, (Math.random()*Math.min(3,best.length))|0)];
  var opts=["Someone's lingering by "+ntQ(ntName(fav))+".", "Someone asks who printed "+ntQ(ntName(fav))+". Good sign.", "Someone's photographing "+ntQ(ntName(any))+" for their story.",
    "Glasses are clinking. The room's warming up.", "A couple are quietly debating which work is best."];
  var dear=hung.filter(function(it){ return !it.sold&&it.price>itemWorth(it)*1.35; }); if(dear.length) opts.push("Someone checks the price of "+ntQ(ntName(dear[0]))+" and raises an eyebrow.");
  var off=hung.filter(function(it){ return Math.abs(it.y-1.45)>0.35; }); if(off.length) opts.push("A guest is craning to see "+ntQ(ntName(off[0]))+".");
  var h=ntHang(hung); if(h.crowdFace) opts.push("It's a bit of a squeeze along the "+h.crowdFace.toLowerCase()+".");
  for(var t=0;t<6;t++){ var o=opts[(Math.random()*opts.length)|0]; if(!NT.said[o]){ NT.said[o]=1; return o; } } return null; }
function ntPanel(){ if(!NT.panel){ NT.panel=gEl("div","ntpanel"); NT.panel.setAttribute("aria-live","polite"); document.body.appendChild(NT.panel); } ntPanelDraw(); }
function ntPanelDraw(){ var P=NT.panel; if(!P) return; var m=Math.max(NIGHT, Math.min(NIGHT_END, gMin())), here=gNightCrowd||0;
  P.style.display=gScreen==="floor"?"":"none"; var hb=document.querySelector(".hud"); if(hb){ var r=hb.getBoundingClientRect(); P.style.top=Math.round(r.top+Math.max(44, hb.scrollHeight)+8)+"px"; }
  var html='<div class="k">Opening night · until 9 pm</div><h3>'+gEsc(NT.title)+'</h3>'+
    '<div class="nums"><div><b>'+here+'</b><small>here now</small></div><div><b>'+NT.arrived+'</b><small>came</small></div><div><b><span class="dot"></span>'+NT.sold+'</b><small>'+gMoney(NT.take)+'</small></div></div>'+
    '<div class="bar"><i style="width:'+Math.round((m-NIGHT)/(NIGHT_END-NIGHT)*100)+'%"></i></div><button class="gbtn" type="button">Wrap up the night</button>';
  if(P._html!==html){ P._html=html; P.innerHTML=html; P.querySelector("button").onclick=function(){ ntEnd(true); }; } }
function ntLoop(){ cancelAnimationFrame(NT.raf); (function step(){ if(!NT.on) return; NT.raf=requestAnimationFrame(step);
  var endT=gDay(NT.lastT)*1440+NIGHT_END; while(NT.lastT<G.t&&NT.lastT<endT){ NT.lastT++; ntMinute(gMin(NT.lastT)); }
  if(G.t>=endT) ntEnd(false); else ntPanelDraw(); })(); }
function ntEnd(early){ if(!NT.on) return; NT.on=false; cancelAnimationFrame(NT.raf); delete document.body.dataset.night; if(NT.panel){ NT.panel.remove(); NT.panel=null; }
  var r=ntScore(NT.arrived); r.sold=NT.sold; r.take=NT.take; r.title=NT.title; r.day=gDay(); r.early=!!early;
  galLog("That's a wrap. "+NT.arrived+" guest"+(NT.arrived===1?"":"s")+", "+NT.sold+" red dot"+(NT.sold===1?"":"s")+". The review lands in the morning.", "money");
  galNightDone(r); if(early&&gMin()<NIGHT_END){ gSkipToMorning(); gMinute(); }   /* on to 8 am, so the paper arrives even with the clock paused */ }

// ---------- 3. scoring: the reception ----------
/* the hang, wall by wall: spacing, the 145 cm centre line, and how full each wall is for its length */
function ntHang(hung){ var by={}, out={even:1, dens:1, centre:1, crowdFace:null, bareFace:null, unevenFace:null, offLine:0, overlap:false, faces:0};
  hung.forEach(function(it){ (by[it.face]=by[it.face]||[]).push(it); });
  var ev=0, de=0, wsum=0;
  Object.keys(by).forEach(function(fid){ var f=galFace(fid); if(!f) return; out.faces++; var L=by[fid].map(function(it){ var w=itemSize(it)[0]; return {l:it.x-w/2, r:it.x+w/2, w:w}; }).sort(function(a,b){ return a.l-b.l; });
    var gaps=[], tot=0; for(var i=0;i<L.length;i++){ tot+=L[i].w; if(i) gaps.push(L[i].l-L[i-1].r); }
    var ml=Math.max(0,L[0].l), mr=Math.max(0,f.len-L[L.length-1].r), sym=1-Math.min(1, Math.abs(ml-mr)/Math.max(0.01, ml+mr)), even=sym;
    if(gaps.length>=2){ var mean=gaps.reduce(function(a,b){ return a+b; },0)/gaps.length, sd=Math.sqrt(gaps.reduce(function(a,g){ return a+(g-mean)*(g-mean); },0)/gaps.length);
      even=0.65*(1-Math.min(1, mean>0.05?sd/mean*1.5:1))+0.35*sym; }
    var tight=gaps.some(function(g){ return g<0.12; }), frac=tot/f.len, d;
    if(frac<0.1) d=0.45+frac/0.1*0.4; else if(frac<0.18) d=0.85+(frac-0.1)/0.08*0.15; else if(frac<=0.55) d=1; else d=Math.max(0, 1-(frac-0.55)/0.35);
    if(tight){ d*=0.55; out.overlap=true; }
    if((frac>0.6||tight)&&!out.crowdFace) out.crowdFace=f.name; if(frac<0.1&&f.len>3&&!out.bareFace) out.bareFace=f.name; if(L.length>1&&even<0.6&&!out.unevenFace) out.unevenFace=f.name;
    var k=L.length; ev+=even*k; de+=d*k; wsum+=k; });
  if(wsum){ out.even=ev/wsum; out.dens=de/wsum; }
  var c=0; hung.forEach(function(it){ var off=Math.abs(it.y-1.45); c+=Math.max(0, 1-off/0.45); if(off>0.2) out.offLine++; }); out.centre=hung.length?c/hung.length:1;
  out.score=Math.round(100*(0.4*out.even+0.35*out.dens+0.25*out.centre)); return out; }
function ntScore(turnout){ turnout=turnout||0; var hung=G.hung.filter(function(it){ return phById(it.pid)&&galFace(it.face); }), n=hung.length, notes=[], kinds=[];
  function note(k, s){ kinds.push(k); notes.push(s); }
  if(!n) return {critic:20, stars:1, public:20, sold:0, take:0, turnout:turnout, parts:{quality:0, hang:0, coherence:0, pricing:0, turnout:0}, notes:["There wasn't any work on the walls by opening night. Hang a wall before you book."], noteKinds:["tip"]};
  /* quality: the photos' own strength (Folio and picks count) */
  var avgQ=hung.reduce(function(a,it){ return a+phById(it.pid).q; },0)/n, qS=Math.round(100*ntClamp((avgQ-0.25)/0.7));
  var top=hung.slice().sort(function(a,b){ return phById(b.pid).q-phById(a.pid).q; })[0];
  /* hang */
  var H=ntHang(hung), hS=H.score;
  /* coherence: a series from one place, or a jumble of many */
  var grp={}; hung.forEach(function(it){ var pl=ntPlace(phById(it.pid)); grp[pl]=(grp[pl]||0)+1; });
  var places=Object.keys(grp).sort(function(a,b){ return grp[b]-grp[a]; }), share=grp[places[0]]/n, cS=Math.round(100*(0.3+0.7*share)); if(n===1) cS=Math.min(cS,60);
  var sizes={}; hung.forEach(function(it){ sizes[it.size||"m"]=1; }); var nSizes=Object.keys(sizes).length;
  /* pricing: what you asked against what collectors think it's worth */
  var ratios=hung.map(function(it){ return it.price/Math.max(1,itemWorth(it)); }), avgR=ratios.reduce(function(a,b){ return a+b; },0)/n, dear=ratios.filter(function(r){ return r>1.35; }).length;
  var pS=Math.round(100*ntClamp(1-Math.max(0, avgR-1.05)*1.4));
  var tS=Math.round(100*ntClamp(turnout/40)), full=Math.min(1, n/6);
  var critic=Math.round((0.4*qS+0.32*hS+0.28*cS)*(0.72+0.28*full)), pub=Math.round(0.25*qS+0.15*hS+0.3*pS+0.3*tS);
  var stars=Math.max(1, Math.min(5, Math.round(critic/10)/2));
  /* what the critic noticed: the good first, then what to try next time */
  if(qS>=65) note("up", "Strong photos. "+ntQ(ntName(top))+" and your other Folio picks carry the show.");
  else if(qS>=40) note("tip", "Solid photos. A tighter edit, with only your very best, would lift the whole show.");
  else note("down", "The critic wanted stronger images. Hang your Folio photos and picks: your best work is your best argument.");
  if(H.even>=0.75&&!H.overlap) note("up", "Even spacing. Steady gaps between frames made the walls feel calm and considered.");
  else if(H.unevenFace) note("down", "Uneven gaps on the "+H.unevenFace.toLowerCase()+". Try keeping the space between frames the same.");
  if(H.crowdFace) note("down", "The "+H.crowdFace.toLowerCase()+" felt crowded. Leave room between frames so each work can breathe.");
  else if(H.bareFace) note("down", "The "+H.bareFace.toLowerCase()+" looked a bit bare for its length. Group the works closer, or use a shorter wall.");
  if(H.offLine===0) note("up", "Everything sat on the 145 cm centre line, right at eye level.");
  else note("down", ntCap(ntNum(H.offLine))+" work"+(H.offLine===1?"":"s")+" hung off the 145 cm centre line (the middle of a picture at eye height), so guests had to crane or stoop.");
  if(n<4) note("down", "Only "+ntNum(n)+" work"+(n===1?"":"s")+" on show. Six or more gives a show enough to say.");
  if(n>=3&&share>=0.7) note("up", "A clear series: "+(grp[places[0]]===n?"all "+n+" works":grp[places[0]]+" of "+n+" works")+(ntReal(places[0])?" come from "+places[0]:" belong together")+", so the show tells one story.");
  else if(places.length>=3&&share<0.5) note("down", "A mix of "+places.length+" different places. Shows read better as a series around one place or idea.");
  if(nSizes>1&&hS>=60) note("up", "Mixing print sizes gave the hang some rhythm.");
  if(dear) note("down", ntCap(ntNum(dear))+" work"+(dear===1?" was":"s were")+" priced well above what collectors think "+(dear===1?"it's":"they're")+" worth. Guests noticed, and fewer bought.");
  else if(avgR<0.75) note("tip", "Prices ran low. Guests loved the bargains, but you left money on the table.");
  else note("up", "Fair prices. Guests felt welcome to buy.");
  if(tS>=75) note("up", "A full room: "+turnout+" guests came.");
  else if(tS<40) note("tip", "A small crowd of "+turnout+". Reputation, buzz and a busier site all bring more people in.");
  if(kinds.indexOf("up")<0){ kinds.unshift("up"); notes.unshift("You hung a show and opened your doors to the public. That's the hardest step, and now you know what to try next."); }
  return {critic:critic, stars:stars, public:pub, sold:0, take:0, turnout:turnout, parts:{quality:qS, hang:hS, coherence:cS, pricing:pS, turnout:tS},
    notes:notes, noteKinds:kinds, top:top.pid, series:share>=0.6?places[0]:"", realSeries:share>=0.6&&ntReal(places[0]), places:places.length, n:n, crowd:H.crowdFace, bare:H.bareFace, uneven:H.unevenFace, offLine:H.offLine, dear:dear, cheap:avgR<0.75}; }

// ---------- 4. the review ----------
function ntHeadline(r, t){ var s=r.stars, k=t+"|"+s;
  if(s>=4.5) return ntPick([t+" is the show of the season", "Go and see "+t+". Really.", "A gallery arrives with "+t], k);
  if(s>=3.5) return ntPick([t+" rewards a slow look", r.realSeries?r.series+", seen with fresh eyes":"Quiet confidence in "+t, "A new gallery finds its feet with "+t], k);
  if(s>=2.5) return ntPick(["Promising "+t+" has plenty to like", t+" shows a gallery on its way", "Good bones in "+t], k);
  if(s>=1.5) return ntPick([t+" has moments worth the trip", "Early days, but "+t+" has heart"], k);
  return ntPick(["A brave first step with "+t, t+": a gallery finding its voice"], k); }
function ntStand(r){ var p=r.parts||{}, best="quality", worst="quality"; ["hang","coherence","pricing"].forEach(function(k){ if(p[k]>p[best]) best=k; if(p[k]<p[worst]) worst=k; });
  var B={quality:"strong photographs", hang:"a careful hang", coherence:"a show that holds together", pricing:"prices that welcome buyers"},
    W={quality:"a tighter edit", hang:"more care on the walls", coherence:"a clearer thread", pricing:"friendlier prices"};
  return r.stars>=4?"Built on "+B[best]+", this is a show that knows what it wants to say.":"There's "+B[best]+" here. With "+W[worst]+", the next one could really sing."; }
function ntBody(r, voice){ var s=siteById(G.site)||{name:"the gallery", street:"town"}, t=ntQ(r.title), top=ntQ(phById(r.top)?phById(r.top).name:"the opening work"), out=[], st=r.stars, k=r.title;
  out.push(voice==="local"
    ? "Popped along to "+s.name+" on "+s.street+" last night for the opening of "+t+", and I wasn't the only one: "+r.turnout+" of us squeezed in for the bubbles and a good look."
    : "A crowd of "+r.turnout+" came to "+s.name+", "+s.street+", last night for the opening of "+t+": "+(r.n===1?"a single work":ntNum(r.n)+" works")+(r.realSeries?", most of them drawn from "+r.series:r.series?" that sit together as one series":"")+".");
  out.push((r.parts.quality>=65?"The standout is "+top+", which held a small crowd for most of the evening.":r.parts.quality>=40?top+" is the one I keep thinking about, and it hints at what this photographer can do.":
    top+" shows real promise, and a stronger edit around it would let the whole show sing."));
  if(r.crowd) out.push("The "+r.crowd.toLowerCase()+" feels crowded, though; a little more breathing room would let each image speak for itself.");
  else if(r.bare) out.push("The "+r.bare.toLowerCase()+" feels a touch bare for its size, so the eye wanders looking for the next work.");
  else if(r.offLine) out.push("A few prints sit well off eye level, which makes them harder to spend time with.");
  else if(r.uneven) out.push("The spacing on the "+r.uneven.toLowerCase()+" is a little uneven, but the bones of a good hang are there.");
  else out.push(voice==="local"?"Everything's hung beautifully, nice and even and right at eye level, which makes it an easy, lovely room to wander.":"The hang is calm and generous: even gaps, everything at eye level.");
  if(r.series&&r.places<=2&&r.n>=3) out.push("Together the works read as a proper series, and that focus is the show's quiet strength.");
  else if(r.places>=3) out.push("Pulling from "+r.places+" different places, it doesn't quite add up to one story yet, but the eye behind it is clear.");
  out.push(r.dear?"Prices sit a little high for a young gallery, so the red dots were slow to come; "+(r.sold?r.sold+" found a home all the same.":"I'd love to see that change."):
    r.sold?r.sold+" red dot"+(r.sold===1?"":"s")+" by the end of the night say"+(r.sold===1?"s":"")+" the public agrees.":"No red dots on the night, but plenty of people lingered.");
  var close=st>=4.5?["Don't miss it.","The best night out in the arts this month."]:st>=3.5?["Well worth the trip.","One to watch."]:st>=2.5?["I'll be back for the next one.","A gallery worth keeping an eye on."]:["Every gallery starts somewhere, and this one has heart.","I'm already curious about the next show."];
  out.push((voice==="local"?"My verdict? ":"")+ntPick(close, k));
  if(out.length>5) out.splice(3,1);   /* five sentences at most: the series line gives way */
  return out; }
function ntStars(v, ch){ ch=ch||"★"; var s=ch+ch+ch+ch+ch; return '<span class="stars" role="img" aria-label="'+v+' out of 5 stars"><span class="bg">'+s+'</span><span class="fg" style="width:'+(v/5*100)+'%">'+s+'</span></span>'; }
function ntClip(r, style){ var t=r.title, H=ntHeadline(r, t), body=ntBody(r, style).map(function(p){ return "<p>"+gEsc(p)+"</p>"; }).join(""), c=r.criticWho, p=phById(r.top),
    fig=p?'<figure><img src="'+gEsc(p.url)+'" alt=""><figcaption>'+gEsc(p.name)+', at '+gEsc((siteById(G.site)||{}).name||"the gallery")+'.</figcaption></figure>':"", day=DAYS[(gDay())%7]+", week "+gWeek();
  if(style==="broadsheet") return '<article class="clip broadsheet"><div class="mast">THE PRESS · ARTS</div><div class="date"><span>'+day+'</span><span>Exhibitions</span></div>'+
    '<div class="kick">Review</div><h1>'+gEsc(H)+'</h1><p class="stand">'+gEsc(ntStand(r))+'</p>'+
    '<div class="sline"><span>'+gEsc(t)+'</span>'+ntStars(r.stars)+'</div>'+
    '<div class="body"><div class="by">'+gEsc(c.name)+'<small>'+gEsc(c.role)+'</small></div>'+fig+body+'</div></article>';
  return '<article class="clip local"><div class="mast"><b>THE PRESS · ARTS</b><span>'+day+'</span></div><div class="kick">Out and about</div><h1>'+gEsc(H)+'</h1>'+
    '<div class="sline">'+ntStars(r.stars)+'<small>'+gEsc(t)+' · '+gEsc((siteById(G.site)||{}).name||"")+'</small></div>'+
    '<div class="cols">'+fig+'<div class="body">'+body+'<div class="by"><i>'+gEsc(c.name.split(" ").map(function(w){ return w[0]; }).join("").slice(0,2))+'</i><span>'+gEsc(c.name)+'<small>'+gEsc(c.role)+'</small></span></div></div></div></article>'; }
function ntReview(r){ r=r||{}; if(r.stars==null){ var x=ntScore(r.turnout||0); for(var k in x) if(r[k]==null) r[k]=x[k]; }
  r.title=r.title||G.show.title||"Untitled show"; r.sold=r.sold||0; r.take=r.take||0; r.parts=r.parts||{}; r.notes=r.notes||[]; r.noteKinds=r.noteKinds||[];
  if(!phById(r.top)&&G.hung.length) r.top=G.hung[0].pid;
  r.criticWho=NT_CRITICS[Math.floor(gHash(r.title+"|"+gDay())*NT_CRITICS.length)%NT_CRITICS.length];
  /* the effects land as the paper does */
  var dRep=Math.round(r.stars*2-3), dBuzz=Math.round(r.stars*1.6*10)/10; G.rep=Math.max(0, G.rep+dRep); G.buzz+=dBuzz;
  G.shows.push({title:r.title, stars:r.stars, critic:r.criticWho.name, criticScore:r.critic, public:r.public, sold:r.sold, take:r.take, turnout:r.turnout, day:r.day!=null?r.day:gDay()-1});
  gScreen="review"; document.body.dataset.screen="review"; galHud();
  var style=ntStyle(), dev=/[?&]dev/.test(ntQs()), d=gEl("div","ntrev"); d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-label","Your review in The Press");
  var parts=[["quality","Quality"],["hang","The hang"],["coherence","Coherence"],["pricing","Pricing"],["turnout","Turnout"]].map(function(p){ var v=Math.round(r.parts[p[0]]||0);
    return '<div><span>'+p[1]+'</span><span class="b"><i style="width:'+v+'%"></i></span><em>'+v+'</em></div>'; }).join("");
  function draw(style){ d.innerHTML='<div class="wrap"><div class="lead"><span class="k">The morning paper · '+gEsc(r.title)+'</span>'+
      (dev?'<span class="styles"><button type="button" data-st="local"'+(style==="local"?' class="on"':'')+'>Local</button><button type="button" data-st="broadsheet"'+(style==="broadsheet"?' class="on"':'')+'>Broadsheet</button></span>':'')+'</div>'+
    ntClip(r, style)+
    '<aside class="side"><h4>The night in numbers</h4><div class="figs"><div><b>'+r.turnout+'</b><small>guests came</small></div><div><b>'+r.sold+'</b><small>works sold</small></div>'+
      '<div><b>'+gMoney(r.take)+'</b><small>takings</small></div><div><b class="'+(dRep>=0?"up":"dn")+'">'+(dRep>=0?"+":"")+dRep+'</b><small>reputation</small></div>'+
      '<div><b>'+Math.round(r.critic)+'</b><small>critic score</small></div><div><b>'+Math.round(r.public)+'</b><small>public mood</small></div></div>'+
      '<h4>How the show scored</h4><div class="parts">'+parts+'</div>'+
      '<h4>What the critic noticed</h4><ul class="notes">'+r.notes.map(function(n,i){ return '<li class="'+(r.noteKinds[i]||"tip")+'">'+gEsc(n)+'</li>'; }).join("")+'</ul>'+
      '<button class="gbtn gold" type="button" data-x="close">Plan your next show</button></aside></div>';
    d.querySelector("[data-x=close]").onclick=close;
    d.querySelectorAll("[data-st]").forEach(function(b){ b.onclick=function(){ draw(b.dataset.st); }; }); }
  function close(){ d.remove(); removeEventListener("keydown", key); galGo("floor"); }
  function key(e){ if(e.key==="Escape") close(); }
  draw(style); document.body.appendChild(d); addEventListener("keydown", key); d.scrollTop=0;
  G.show={title:"", openDay:-1, phase:"hanging"}; galLog("The Press gave "+ntQ(r.title)+" "+r.stars+" star"+(r.stars===1?"":"s")+". Reputation "+(dRep>=0?"+":"")+dRep+".", "money"); galSave(); }

GSCR.night={book:ntBook, start:ntStart, review:ntReview, score:ntScore, end:function(){ ntEnd(true); }};
