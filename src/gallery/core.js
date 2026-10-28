// ================= GALLERY CORE: the game's state, clock, money and screens (docs/gallery-brief.md) =================
// Every gallery file is included into one script in src/gallery.html, so they share one scope. This file loads first:
// state (G), the student's photos (PH), the sites, the clock, the money and sales sim, the HUD and the screen router.
// Screens (map.js, plan.js, night.js) register themselves in GSCR; the 3D room is room.js.
var THREE=window.THREE;
function $g(id){ return document.getElementById(id); }
function gEl(tag, cls, html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function gCSS(css){ var s=document.createElement("style"); s.textContent=css; document.head.appendChild(s); }
function gMoney(n){ n=Math.round(n); return (n<0?"-$":"$")+Math.abs(n).toLocaleString("en-NZ"); }
function gEsc(s){ return String(s==null?"":s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function gHash(s){ var h=2166136261; s=String(s); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0)/4294967295; }
var GSCR={};   /* screens: map, plan, night (each {open(...)}, night also start() and review(result)) */

// ---------- the student's photos (from Studium through GAL_BRIDGE), or samples standalone ----------
var BR=null; try{ if(window.parent!==window&&window.parent.GAL_BRIDGE) BR=window.parent.GAL_BRIDGE; }catch(e){}
var GAL_SAMPLES=["asset:assets/research/sample-1.jpg","asset:assets/research/sample-2.jpg","asset:assets/research/sample-3.jpg",
  "asset:assets/research/sample-4.jpg","asset:assets/research/sample-5.jpg","asset:assets/research/sample-6.jpg"];
/* PH: [{id, url, name, folio, pick, q (0..1, hidden quality: folio and picks count, plus a stable bit of luck), asp (width/height once loaded)}] */
var PH=(function(){ var list=[];
  if(BR){ try{ list=(BR.data().photos||[]).filter(function(p){ return p&&p.url; }).map(function(p){ return {id:p.id, url:p.url, name:p.name, folio:!!p.folio, pick:!!p.pick}; }); }catch(e){} }
  if(list.length<4) list=GAL_SAMPLES.map(function(u,i){ return {id:"sample-"+(i+1), url:u, name:"Sample "+(i+1), sample:true}; });
  list.forEach(function(p){ p.q=Math.min(1, 0.35+(p.folio?0.3:0)+(p.pick?0.15:0)+gHash(p.id)*0.2); p.asp=1.5; });
  return list; })();
var PH_TEX={};
function phById(id){ for(var i=0;i<PH.length;i++) if(PH[i].id===id) return PH[i]; return null; }
/* a photo's texture, loaded once; its real aspect lands in p.asp and onAsp runs (frames resize) */
function phTex(p, onAsp){ if(PH_TEX[p.id]) return PH_TEX[p.id];
  var t=new THREE.TextureLoader().load(p.url, function(tx){ var im=tx.image; if(im&&im.width&&im.height){ p.asp=im.width/im.height; if(onAsp) onAsp(); if(typeof roomRefresh==="function") roomRefresh(); } });
  t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return (PH_TEX[p.id]=t); }

// ---------- sites: the places you can lease, laid out in metres around the origin ----------
// rect [width, depth]; walls: free-standing or inner walls [x1,z1,x2,z2] (hangable both sides); glass: which outer side
// is a shop window ("s" = the south side, nearest the street), not hangable.
var SITES=[
  {id:"warehouse", name:"The warehouse", street:"Foundry Lane", rent:180, traffic:1, rect:[18,13], h:4.2, floor:0x55524d, wall:0xe9e6df,
    walls:[[-3,-2.6,-3,2.6],[4,6.5,4,2]], blurb:"Cheap and huge, with concrete floors and high ceilings. Hardly anyone walks past, so you'll need to pull a crowd."},
  {id:"shopfront", name:"The shopfront", street:"High Street", rent:420, traffic:5, rect:[10,7], h:3.2, floor:0x6b5f52, wall:0xf1eee8, glass:"s",
    walls:[], blurb:"Right on the busy street, with a big front window. Small and pricey, but people wander in all day."},
  {id:"villa", name:"The villa", street:"Rata Terrace", rent:300, traffic:3, rect:[13,10], h:3.3, floor:0x7a5f45, wall:0xf3efe6,
    walls:[[1,-5,1,-1],[1,1.2,1,5]], blurb:"An old villa with wooden floors and two rooms. Lots of charm, and a doorway in the middle that breaks up the walls."},
  {id:"popup", name:"The pop-up", street:"Riverside Market", rent:60, traffic:3, rect:[8,6], h:3, floor:0x4d4a46, wall:0xeceae4, lease:4,
    walls:[], blurb:"An empty unit in the market, nearly free. You only get it for four weeks, then it's gone."}];
function siteById(id){ for(var i=0;i<SITES.length;i++) if(SITES[i].id===id) return SITES[i]; return null; }
/* every hangable face of a site: {id, a:[x,z] (left end, facing the wall), r:[x,z] (unit vector to the right), n:[x,z] (out of the wall,
   towards you), len, h, name}. Outer walls face in; inner walls have both sides. */
function siteFaces(s){ var w=s.rect[0]/2, d=s.rect[1]/2, out=[], segs=[["n",[-w,-d,w,-d]],["e",[w,-d,w,d]],["s",[w,d,-w,d]],["w",[-w,d,-w,-d]]];
  var NAMES={n:"Back wall", e:"Right wall", s:"Front wall", w:"Left wall"};
  function face(id, x1,z1,x2,z2, nx,nz, name){ var len=Math.hypot(x2-x1,z2-z1), rx=nz, rz=-nx, mx=(x1+x2)/2, mz=(z1+z2)/2;
    out.push({id:id, a:[mx-rx*len/2, mz-rz*len/2], r:[rx,rz], n:[nx,nz], len:len, h:s.h, name:name}); }
  segs.forEach(function(sg){ if(s.glass===sg[0]) return; var c=sg[1], mx=(c[0]+c[2])/2, mz=(c[1]+c[3])/2, L=Math.hypot(mx,mz)||1; face(sg[0], c[0],c[1],c[2],c[3], -mx/L*(Math.abs(mx)>Math.abs(mz)?1:0), -mz/L*(Math.abs(mz)>=Math.abs(mx)?1:0), NAMES[sg[0]]); });
  (s.walls||[]).forEach(function(c,i){ var dx=c[2]-c[0], dz=c[3]-c[1], L=Math.hypot(dx,dz), nx=-dz/L, nz=dx/L;
    face("i"+i+"a", c[0],c[1],c[2],c[3], nx,nz, "Inner wall "+(i+1)+", side A"); face("i"+i+"b", c[0],c[1],c[2],c[3], -nx,-nz, "Inner wall "+(i+1)+", side B"); });
  return out; }
function galFace(id){ var s=siteById(G.site); if(!s) return null; var f=siteFaces(s); for(var i=0;i<f.length;i++) if(f[i].id===id) return f[i]; return null; }

// ---------- prints: what a hung work is ----------
var PRINT={s:{name:"Small", long:0.45, cost:35, base:220}, m:{name:"Medium", long:0.75, cost:90, base:520}, l:{name:"Large", long:1.2, cost:220, base:1200}};
/* an item's printed width and height in metres */
function itemSize(it){ var p=phById(it.pid), a=p?p.asp:1.5, L=PRINT[it.size||"m"].long; return a>=1?[L, L/a]:[L*a, L]; }
/* what a collector thinks a work is worth: print size, the photo's quality, and your reputation */
function itemWorth(it){ var p=phById(it.pid); return PRINT[it.size||"m"].base*(0.55+(p?p.q:0.5))*(1+G.rep/40); }

// ---------- the game state, saved into Studium (st.galGame) or, standalone, localStorage ----------
// G.t is game minutes since Monday 00:00 of week 1. hung: [{id, pid, face, x (m from the face's left end, centre), y (centre
// height, m), size, price, sold, soldFor, soldDay}]. show: {title, openDay, phase:"hanging"|"booked"|"open"}. log: newest first.
var G=null;
function galNew(){ return {v:1, t:8*60, speed:1, cash:6000, rep:10, buzz:0, site:null, hung:[], show:{title:"", openDay:-1, phase:"hanging"}, shows:[], log:[], rentPaidWeek:0, stats:{sold:0, earned:0, visitors:0}}; }
function galLoad(){ var s=null; try{ s=BR?BR.data().state:JSON.parse(localStorage.getItem("studium_gallery_v1")||"null"); }catch(e){}
  G=(s&&s.v===1)?s:galNew(); }
var _saveT=0;
function galSave(now){ clearTimeout(_saveT); _saveT=setTimeout(function(){ var s=JSON.parse(JSON.stringify(G));
    try{ if(BR) BR.save(s); else localStorage.setItem("studium_gallery_v1", JSON.stringify(s)); }catch(e){} }, now?0:800); }
function galLog(msg, kind){ G.log.unshift({t:G.t, m:msg, k:kind||""}); if(G.log.length>60) G.log.length=60; galToast(msg, kind); }

// ---------- the clock (real time, pause and fast-forward) ----------
var DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
var OPEN=10*60, CLOSE=17*60, NIGHT=18*60, NIGHT_END=21*60, MORNING=8*60;
var SPEEDS=[0,1,2,4], GAME_MIN_PER_SEC=2;   /* at 1x a game minute takes half a second: a seven-hour day is about 3.5 minutes */
function gDay(t){ return Math.floor((t==null?G.t:t)/1440); }
function gMin(t){ return (t==null?G.t:t)%1440; }
function gWeek(t){ return Math.floor(gDay(t)/7)+1; }
function gClock(t){ var m=gMin(t), h=Math.floor(m/60), mm=m%60, ap=h<12?"am":"pm", h12=h%12||12; return h12+":"+String(mm).padStart(2,"0")+" "+ap; }
function gDate(t){ return "Week "+gWeek(t)+" · "+DAYS[gDay(t)%7].slice(0,3)+" "+gClock(t); }
var gHold=0;   /* screens that need the clock stopped (the wall plan, the map) count themselves in here */
function gIsOpen(){ var m=gMin(); return m>=OPEN&&m<CLOSE&&!!G.site; }

/* one game minute passes */
function gMinute(){ G.t++; var m=gMin(), day=gDay();
  if(m===MORNING&&day%7===0&&G.site&&gWeek()>G.rentPaidWeek){ var s=siteById(G.site); G.cash-=s.rent; G.rentPaidWeek=gWeek(); galLog("Rent paid for week "+gWeek()+": "+gMoney(s.rent)+".", "money");
    if(s.lease&&G.leaseStart!=null&&gWeek()-G.leaseStart>=s.lease) galLog("Your pop-up lease is up this week. Time to find a new space.", "warn"); }
  if(m===OPEN&&G.site) galLog("Doors open.", "quiet");
  if(m===CLOSE&&G.site) galLog("Doors closed for the day. "+gMoney(G.dayTake||0)+" in sales today.", "quiet");
  if(m===CLOSE) G.dayTake=0;
  if(m===NIGHT&&G.show.phase==="booked"&&G.show.openDay===day&&GSCR.night){ gNightOn=true; GSCR.night.start(); }
  if(m===0) gNewDay();
  if(gIsOpen()) gSell(1);
  /* the quiet hours skip: after closing (and any opening night) jump to the next morning */
  if(m===CLOSE+30&&!(G.show.phase==="booked"&&G.show.openDay===day)&&!gNightOn) gSkipToMorning();
  if(m===NIGHT_END+10&&!gNightOn) gSkipToMorning(); }
var gReviewDue=false, gNightOn=false;
function gSkipToMorning(){ var d=gDay()+1; G.t=d*1440+MORNING-1; gNewDay(); gFade(DAYS[d%7]+", week "+gWeek(d*1440)); }
function gNewDay(){ if(G._day===gDay(G.t+1)) return; G._day=gDay(G.t+1); G.buzz*=0.8; if(G.pendingReview) gReviewDue=true;
  /* a booked night that never happened (closed mid-evening): it moves to the next evening */
  if(G.show.phase==="booked"&&G.show.openDay<G._day) G.show.openDay=G._day; }

// ---------- visitors and sales ----------
/* how many people are in the gallery right now */
function gVisitorsNow(){ if(!G.site) return 0; var s=siteById(G.site), m=gMin();
  if(gNightOn) return gNightCrowd||0;
  if(!gIsOpen()) return 0;
  var shape=Math.sin(Math.PI*(m-OPEN)/(CLOSE-OPEN))*0.6+0.5;   /* busier mid-afternoon */
  var hung=G.hung.length?1:0.25;
  return Math.max(0, Math.round((s.traffic*2.2+G.rep/6+G.buzz)*shape*hung)); }
var gNightCrowd=0;
/* each visitor-minute is a small chance someone tries to buy; overpriced work rarely sells, a bargain sells fast */
function gSell(minutes){ var n=gVisitorsNow()*minutes; if(!n) return; G.stats.visitors+=n/45;
  var open=G.hung.filter(function(it){ return !it.sold; }); if(!open.length) return;
  for(var i=0;i<n;i++){ if(Math.random()>0.0016*(1+G.rep/50)) continue;
    var it=open[(Math.random()*open.length)|0], k=itemWorth(it)/Math.max(1,it.price);
    if(Math.random()<Math.min(0.85, 0.35*k*k)) gSold(it); } }
function gSold(it){ if(it.sold) return; it.sold=true; it.soldFor=it.price; it.soldDay=gDay(); G.cash+=it.price; G.dayTake=(G.dayTake||0)+it.price;
  G.stats.sold++; G.stats.earned+=it.price; var p=phById(it.pid); galLog("Sold: "+(p?p.name:"a print")+" for "+gMoney(it.price)+".", "sale");
  if(typeof roomRefresh==="function") roomRefresh(); galSave(); }

// ---------- actions the screens use ----------
function galSignLease(id){ var s=siteById(id); if(!s) return; var bond=s.rent*2;
  if(G.site&&G.bond){ G.cash+=G.bond; galLog("Your old bond came back: "+gMoney(G.bond)+".", "money"); }   /* moving out refunds the last bond */
  G.site=id; G.cash-=bond; G.bond=bond; G.leaseStart=gWeek(); G.rentPaidWeek=gWeek(); G.hung=[]; galLog("You signed the lease on "+s.name+", "+s.street+". Bond paid: "+gMoney(bond)+".", "money");
  if(typeof roomBuild==="function") roomBuild(s); galGo("floor"); galSave(true); }
/* hang a print: pays for printing, returns the item */
function galHang(o){ var it={id:"h"+Date.now().toString(36)+Math.floor(Math.random()*1e4), pid:o.pid, face:o.face, x:o.x, y:o.y==null?1.45:o.y, size:o.size||"m", price:o.price||0, sold:false};
  if(!it.price) it.price=Math.round(itemWorth(it)/10)*10;
  G.cash-=PRINT[it.size].cost; G.hung.push(it); galSave(); return it; }
function galUnhang(id){ G.hung=G.hung.filter(function(it){ return it.id!==id; }); galSave(); }
function galItem(id){ for(var i=0;i<G.hung.length;i++) if(G.hung[i].id===id) return G.hung[i]; return null; }
/* book tonight's opening (before 3 pm) or tomorrow's: invitations and catering */
var NIGHT_COST=250;
function galBookOpening(title){ if(!G.hung.length){ galToast("Hang some work first.", "warn"); return; }
  var day=gMin()<15*60?gDay():gDay()+1; G.show={title:title||"Untitled show", openDay:day, phase:"booked"}; G.cash-=NIGHT_COST;
  galLog("Opening night booked for "+(day===gDay()?"tonight":"tomorrow")+" at 6 pm. Invitations and catering: "+gMoney(NIGHT_COST)+".", "money"); galSave(); galHud(); }
/* night.js calls this when the evening ends; the review lands next morning */
function galNightDone(result){ gNightOn=false; gNightCrowd=0; G.show.phase="open"; G.pendingReview=result||{}; galSave(); }

// ---------- screens ----------
var gScreen="";
function galGo(name, opts){ gScreen=name; document.body.dataset.screen=name;
  if(name!=="floor"&&GSCR[name]&&GSCR[name].open) GSCR[name].open(opts||{});
  galHud(); }

// ---------- HUD: money, reputation, the clock ----------
gCSS(
  ".hud{position:fixed;top:12px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;z-index:5;pointer-events:none}"+
  ".hud>div{pointer-events:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}"+
  ".pill{background:rgba(20,18,14,.86);backdrop-filter:blur(8px);border-radius:12px;padding:8px 12px;display:flex;align-items:center;gap:8px;font:600 14px var(--body)}"+
  ".pill small{font:500 10px var(--mono);letter-spacing:.12em;color:var(--dim);text-transform:uppercase}"+
  ".pill b{font:500 15px var(--mono);font-variant-numeric:tabular-nums}.pill b.neg{color:var(--safelight)}"+
  ".spd{border:0;width:32px;height:32px;border-radius:50%;background:#2b2820;color:var(--text);font:600 12px var(--body);cursor:pointer}.spd.on{background:var(--gold);color:#17140d}"+
  ".clock{font:500 14px var(--mono);background:var(--gold);color:#17140d;border-radius:8px;padding:6px 10px;font-variant-numeric:tabular-nums}"+
  ".gbar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:8px;z-index:5;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px)}"+
  ".gbtn{border:0;border-radius:999px;background:rgba(20,18,14,.9);color:var(--text);padding:11px 18px;font:600 14px var(--body);cursor:pointer;backdrop-filter:blur(8px)}"+
  ".gbtn.gold{background:var(--gold);color:#17140d}.gbtn:disabled{opacity:.45;cursor:default}"+
  ".gbtn:focus-visible,.spd:focus-visible{outline:2px solid var(--text);outline-offset:2px}"+
  ".toasts{position:fixed;right:12px;bottom:70px;display:flex;flex-direction:column-reverse;gap:6px;z-index:6;pointer-events:none;max-width:min(360px,calc(100vw - 24px))}"+
  ".toast{background:rgba(20,18,14,.92);border-radius:10px;padding:8px 12px;font-size:13.5px;animation:tin .25s ease-out;border-left:3px solid #4a4536}"+
  ".toast.sale{border-left-color:var(--safelight)}.toast.money{border-left-color:var(--gold)}.toast.warn{border-left-color:#d08a2e}"+
  "@keyframes tin{from{opacity:0;transform:translateY(6px)}}"+
  ".fade{position:fixed;inset:0;background:#0c0b0a;display:grid;place-items:center;font:600 30px var(--display);z-index:20;opacity:0;pointer-events:none;transition:opacity .4s}.fade.on{opacity:1}"+
  "body[data-screen=map] .gbar,body[data-screen=plan] .gbar,body[data-screen=review] .gbar{display:none}"+
  "body[data-screen=map] .hud .spd,body[data-screen=plan] .hud .spd,body[data-screen=review] .hud .spd{display:none}"+
  "@media (prefers-reduced-motion:reduce){.toast{animation:none}.fade{transition:none}}");
var hud=gEl("div","hud"), bar=gEl("div","gbar"), toasts=gEl("div","toasts"), fade=gEl("div","fade");
document.body.appendChild(hud); document.body.appendChild(bar); document.body.appendChild(toasts); document.body.appendChild(fade);
function galToast(msg, kind){ if(kind==="quiet") return; var t=gEl("div","toast "+(kind||""), gEsc(msg)); toasts.appendChild(t); setTimeout(function(){ t.remove(); }, 5200);
  while(toasts.children.length>4) toasts.firstChild.remove(); }
function gFade(text){ fade.textContent=text; fade.classList.add("on"); setTimeout(function(){ fade.classList.remove("on"); }, 1100); }
function galHud(){ if(!G) return; var s=siteById(G.site);
  hud.innerHTML='<div><span class="pill"><small>Cash</small><b class="'+(G.cash<0?"neg":"")+'">'+gMoney(G.cash)+'</b></span>'+
    '<span class="pill"><small>Reputation</small><b>'+Math.round(G.rep)+'</b></span>'+
    (s?'<span class="pill"><small>'+gEsc(s.name)+'</small><b>'+gVisitorsNow()+' in</b></span>':'')+'</div>'+
    '<div>'+SPEEDS.map(function(v,i){ return '<button class="spd'+(G.speed===v?' on':'')+'" data-s="'+v+'" aria-label="'+(v?v+" times speed":"Pause")+'">'+(v?["","▶","▶▶","▶▶▶"][i]:"❚❚")+'</button>'; }).join("")+
    '<span class="clock">'+gDate()+'</span>'+(BR?'<button class="gbtn" id="g-back">Back to Studium</button>':'')+'</div>';
  hud.querySelectorAll(".spd").forEach(function(b){ b.onclick=function(){ G.speed=+b.dataset.s; galHud(); galSave(); }; });
  var bk=$g("g-back"); if(bk) bk.onclick=function(){ galSave(true); try{ BR.close(); }catch(e){} };
  galBar(); }
/* the floor's action bar */
var _barKey="";
function galBar(){ var key=gScreen+"|"+G.show.phase+"|"+G.show.openDay+"|"+G.hung.length+"|"+gDay()+"|"+(gMin()<15*60); if(key===_barKey) return; _barKey=key; bar.innerHTML="";
  if(gScreen!=="floor") return;
  var hangB=gEl("button","gbtn","Hang a wall"); hangB.onclick=function(){ galToast("Click any wall in the room to open its wall plan."); }; bar.appendChild(hangB);
  if(G.show.phase==="hanging"||G.show.phase==="open"&&!G.pendingReview){ var ob=gEl("button","gbtn gold","Book opening night"); ob.disabled=!G.hung.length;
    ob.onclick=function(){ if(GSCR.night&&GSCR.night.book) GSCR.night.book(); else galBookOpening(G.show.title||"Untitled show"); };   /* night.js asks for the show's name */ bar.appendChild(ob); }
  else if(G.show.phase==="booked") bar.appendChild(gEl("span","gbtn","Opening night: "+(G.show.openDay===gDay()?"tonight":"tomorrow")+", 6 pm"));
  var mp=gEl("button","gbtn","City map"); mp.onclick=function(){ galGo("map",{}); }; bar.appendChild(mp); }

// ---------- the loop: room.js calls gTick every frame ----------
var _acc=0, _hudAcc=0;
function gTick(dt){ if(!G) return;
  if(gReviewDue&&gMin()>=MORNING&&GSCR.night&&GSCR.night.review){ gReviewDue=false; var r=G.pendingReview; G.pendingReview=null; GSCR.night.review(r||{}); }
  var sp=gHold>0||gScreen==="review"?0:G.speed; if(!G.site) sp=0;
  _acc+=dt*sp*GAME_MIN_PER_SEC; var n=0; while(_acc>=1&&n<240){ _acc--; n++; gMinute(); }
  _hudAcc+=dt; if(_hudAcc>0.25){ _hudAcc=0; galHud(); }
  if(n&&gMin()%30===0) galSave(); }

galLoad();
