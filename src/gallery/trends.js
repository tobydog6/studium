// ================= GALLERY ERAS AND TRENDS: the season clock, what's hot, era lessons (docs/gallery-brief.md, "Eras and trends") =================
// The calendar walks from the 1960s to the 2020s, then on into an endless "today". A season is SEASON_WEEKS game weeks and an era
// is ERA_SEASONS seasons. Each era has trend tags whose weights drift season to season (seeded by G.trendSeed, so a save replays
// the same). Each photo gets tags from its own pixels (tone, colour, contrast) and its Studium place. gTrendFit(items) scores a
// show against this season (night.js), gTrendMult(item) nudges what a work is worth (core.js itemWorth). Wraps core's gDate (the
// HUD date), galBar (the "What's hot" button) and gTick (season toasts and the era lesson card, which holds the clock).
var SEASON_WEEKS=2, ERA_SEASONS=4;
var TR_SEASONS=["Spring","Summer","Autumn","Winter"];
/* tags: a label for the board, a phrase for the season toast (pl: plural), and hints for rising and falling */
var TR_TAGS={
  mono:{l:"Black and white", n:"black and white", up:"Black and white is in. Collectors want drama and shape.", dn:"Black and white is cooling off. Buyers are after colour."},
  colour:{l:"Colour", n:"colour", up:"Colour is having a moment. Let it sing.", dn:"Colour on its own isn't enough to catch the eye right now."},
  vivid:{l:"Vivid colour", n:"vivid colour", up:"Bold, saturated colour is in. Turn it up.", dn:"Loud colour feels a bit much this season."},
  muted:{l:"Muted tones", n:"muted tones", pl:1, up:"Quiet, muted tones are in. Subtle sells.", dn:"Muted tones are slipping. People want more punch."},
  moody:{l:"Moody and dark", n:"moody work", up:"Dark, moody images are in. Shadows sell.", dn:"Dark and moody is fading. Let some light in."},
  airy:{l:"Light and airy", n:"light and airy work", up:"Light and airy is in. Bright, open frames feel fresh.", dn:"Bright and airy feels a little safe now."},
  contrast:{l:"High contrast", n:"high contrast", up:"High contrast is in. Deep blacks, bright whites.", dn:"Hard contrast is going out. Softer is creeping back."},
  soft:{l:"Soft contrast", n:"soft contrast", up:"Soft, gentle tones are in. Hush is the new loud.", dn:"Soft and gentle is out of step this season."},
  warm:{l:"Warm tones", n:"warm tones", pl:1, up:"Warm tones are in. Golden light wins hearts.", dn:"Warm tones are cooling off, funnily enough."},
  cool:{l:"Cool tones", n:"cool tones", pl:1, up:"Cool blues and greys are in. Calm and crisp.", dn:"Cool tones feel a bit chilly to buyers right now."},
  landscape:{l:"Landscape", n:"landscape", up:"Landscape is in. People want wide open space.", dn:"Landscape is resting this season."},
  nature:{l:"Nature", n:"nature", up:"Nature is in. Leaves, bark and weather.", dn:"Nature is quieter this season."},
  urban:{l:"The city", n:"the city", up:"The city is in. Concrete, signs and streets.", dn:"City scenes are cooling off."},
  street:{l:"Street", n:"street photography", up:"Street photography is in. Catch life as it happens.", dn:"Street photography is out of the spotlight for now."},
  sculpture:{l:"Sculpture", n:"sculpture", up:"Sculpture and objects are in. Give them room.", dn:"Sculpture is less of a draw this season."},
  heritage:{l:"Heritage", n:"heritage", up:"Heritage is in. Old buildings, old stories.", dn:"Heritage feels a bit dusty to buyers right now."},
  documentary:{l:"Documentary", n:"documentary", up:"Documentary is in. Show the world as it is.", dn:"Documentary is slipping. People want something staged or strange."},
  drama:{l:"Drama", n:"drama", up:"Drama is in. Strong light, strong shadow.", dn:"Big drama is going out. Quiet is coming in."},
  minimal:{l:"Minimal", n:"minimalism", up:"Minimal is in. Less in the frame, more to think about.", dn:"Minimal feels too bare for buyers this season."},
  pop:{l:"Pop", n:"pop", up:"Pop is in. Bright, bold and fun.", dn:"Pop is fading. The party's winding down."}};
/* the eras: tags with base weights (0..1) and the lesson card. Look-up names are real; claims are kept to what's well known. */
var TR_ERAS=[
  {y:1960, name:"The 1960s: pop and the street", tags:{street:0.9, mono:0.85, documentary:0.75, pop:0.7, urban:0.7, contrast:0.6, vivid:0.5, colour:0.3},
    move:"Pop art and street photography",
    lesson:"Pop artists borrowed from ads, comics and supermarket shelves, while street photographers took their cameras into crowds to catch life as it happened. Look up Andy Warhol's screen prints, and Ans Westra, who photographed everyday life across Aotearoa from the late 1950s.",
    look:["Andy Warhol","Ans Westra"]},
  {y:1970, name:"The 1970s: land and the new colour", tags:{landscape:0.85, colour:0.7, documentary:0.65, nature:0.65, muted:0.6, warm:0.55, minimal:0.45, soft:0.4},
    move:"Land art and New Colour photography",
    lesson:"Artists headed out into the land, and photographers began to treat colour as serious art rather than something for holiday snaps. Look up William Eggleston, whose colour photographs were shown at New York's Museum of Modern Art in 1976, and Marti Friedlander, who photographed people and life in New Zealand for decades.",
    look:["William Eggleston","Marti Friedlander"]},
  {y:1980, name:"The 1980s: big colour and borrowed images", tags:{vivid:0.85, colour:0.75, pop:0.7, contrast:0.65, urban:0.6, drama:0.55, heritage:0.4, mono:0.3},
    move:"Appropriation and staged photography",
    lesson:"Artists borrowed images from film and advertising and staged their own scenes to ask who is really telling the story. Look up Cindy Sherman's Untitled Film Stills, and Laurence Aberhart, whose slow black and white photographs of New Zealand buildings and memorials take a very different path.",
    look:["Cindy Sherman","Laurence Aberhart"]},
  {y:1990, name:"The 1990s: installation and identity", tags:{sculpture:0.85, heritage:0.65, moody:0.65, drama:0.6, cool:0.55, documentary:0.5, muted:0.5, mono:0.4},
    move:"Installation art and the Young British Artists",
    lesson:"Galleries filled with installations, sculpture and work about who we are and where we come from. Look up Gillian Wearing's photographs of strangers holding signs they wrote themselves, and Michael Parekowhai, whose sculpture went on to represent New Zealand at the Venice Biennale in 2011.",
    look:["Gillian Wearing","Michael Parekowhai"]},
  {y:2000, name:"The 2000s: digital and the big print", tags:{colour:0.75, cool:0.7, contrast:0.6, urban:0.65, minimal:0.6, airy:0.5, landscape:0.45, vivid:0.4},
    move:"Digital photography and the gallery-sized print",
    lesson:"Digital cameras and huge prints changed what a photograph could be, and staged, cinematic images filled the walls. Look up Andreas Gursky's giant, detailed prints, and Yvonne Todd, the first winner of New Zealand's Walters Prize in 2002.",
    look:["Andreas Gursky","Yvonne Todd"]},
  {y:2010, name:"The 2010s: the phone in every pocket", tags:{warm:0.8, airy:0.75, vivid:0.6, street:0.55, nature:0.55, soft:0.5, pop:0.45, heritage:0.4},
    move:"Social media and the selfie",
    lesson:"Instagram arrived in 2010 and suddenly everyone was a photographer, sharing filtered, warm, everyday moments. Look up Amalia Ulman, who made a whole artwork out of an Instagram account, and Fiona Pardington, whose careful still lifes and photographs of taonga ask you to slow right down.",
    look:["Amalia Ulman","Fiona Pardington"]},
  {y:2020, name:"The 2020s: AI and the hand-made", tags:{nature:0.75, soft:0.65, muted:0.65, sculpture:0.6, documentary:0.55, landscape:0.5, mono:0.45, vivid:0.35},
    move:"AI images and the craft revival",
    lesson:"As AI made pictures in seconds, many artists turned back to the hand-made, the real and the slow. Look up Boris Eldagsen, who turned down a photography award in 2023 because his winning image was made with AI, and Yuki Kihara, who represented Aotearoa New Zealand at the Venice Biennale in 2022.",
    look:["Boris Eldagsen","Yuki Kihara"]}];
var TR_TODAY={name:"Today: anything goes", move:"The art of right now",
  lesson:"There's no textbook for now. Trends come and go faster than ever, so watch the board, trust your eye and make the work only you can make.", look:[]};

// ---------- the calendar ----------
function trS(t){ return Math.floor((gWeek(t)-1)/SEASON_WEEKS); }                 /* seasons since the start */
function gEra(t){ return Math.floor(trS(t)/ERA_SEASONS); }                        /* 0 = the 1960s; 7 and on = today */
function gSeason(t){ return trS(t)%ERA_SEASONS; }                                 /* the season within the era */
function trEraInfo(e){ return e<TR_ERAS.length?TR_ERAS[e]:TR_TODAY; }
function trYear(t){ var e=gEra(t), si=gSeason(t); if(e>=TR_ERAS.length) return 2026+Math.floor(((e-TR_ERAS.length)*ERA_SEASONS+si)/4);
  var last=e===TR_ERAS.length-1; return TR_ERAS[e].y+(last?0:2)+Math.round(si*(last?5:7)/Math.max(1,ERA_SEASONS-1)); }   /* seasons spread across the decade (1962, 1964, 1967, 1969); the 2020s stop at 2025 */
function trSeasonName(t){ return TR_SEASONS[trS(t)%4]; }
var _gDate0=gDate;
gDate=function(t){ return [trYear(t), trSeasonName(t)].concat(_gDate0(t).split(" · ")).map(function(x){ return String(x).replace(/ /g,"\u00a0"); }).join(" · "); };   /* a narrow HUD wraps only between the parts */

// ---------- this season's trends (seeded drift) ----------
/* a well-mixed 0..1 from a string (gHash alone barely moves when only the last character changes) */
function trRnd(str){ var h=Math.floor(gHash(str)*4294967295)>>>0; h^=h>>>16; h=Math.imul(h,0x85ebca6b); h^=h>>>13; h=Math.imul(h,0xc2b2ae35); h^=h>>>16; return (h>>>0)/4294967296; }
function trSeed(){ if(G.trendSeed==null){ G.trendSeed=Math.floor(Math.random()*1e9); galSave(); } return G.trendSeed; }
/* the tags of the endless "today" eras: seven picked at random per era */
function trTodayTags(e){ var keys=Object.keys(TR_TAGS), out={}, seed=trSeed();
  keys.slice().sort(function(a,b){ return trRnd(seed+"|"+e+"|"+a)-trRnd(seed+"|"+e+"|"+b); }).slice(0,7).forEach(function(k,i){ out[k]=0.9-i*0.08; }); return out; }
/* tag weights for season index s (seasons since the start): each era's base, plus a drift that carries over a season */
var _trW={};
function trWeights(s){ if(s<0) s=0; var key=trSeed()+"|"+s; if(_trW[key]) return _trW[key]; var e=Math.floor(s/ERA_SEASONS), base=e<TR_ERAS.length?TR_ERAS[e].tags:trTodayTags(e), out={}, seed=trSeed();
  for(var k in base){ var h=function(i){ return trRnd(seed+"|"+k+"|"+i)*2-1; }, w=base[k]+0.32*(0.65*h(s)+0.35*h(s-1)); out[k]=Math.max(0.05, Math.min(1, w)); }
  return (_trW[key]=out); }
/* the board: this season's tags, heaviest first, with how they moved since last season ("new" if they weren't trending then) */
function trBoard(){ var s=trS(), now=trWeights(s), prev=s>0?trWeights(s-1):TR_ERAS[0].tags;   /* the very first season moves against the era's starting point */
  return Object.keys(now).map(function(k){ var d=prev[k]==null?null:now[k]-prev[k]; return {k:k, w:now[k], d:d, dir:d==null?"new":d>0.04?"up":d<-0.04?"down":"flat"}; })
    .sort(function(a,b){ return b.w-a.w; }); }

// ---------- tags for the student's photos, from their pixels and their place ----------
/* Studium places that say something about the subject (galleryroom.js names photos "<place> 03") */
var TR_PLACES={"the stump":["landscape","nature"], "the car park":["urban","street"], "saint maurice":["sculpture","heritage"], "maurice":["sculpture","heritage"]};
function trPlace(p){ return String(p&&p.name||"").replace(/\s*\d+$/,"").trim().toLowerCase(); }
var _trBusy={};
function trTagPhoto(p){ if(p.tags||_trBusy[p.id]) return; _trBusy[p.id]=1; var im=new Image();
  im.onload=function(){ try{ p.tags=trAnalyse(im, p); }catch(e){ p.tags=TR_PLACES[trPlace(p)]||[]; } };
  im.onerror=function(){ p.tags=TR_PLACES[trPlace(p)]||[]; };
  im.src=p.url; }
/* draw small, then measure: colourfulness, saturation, brightness, contrast, warmth and detail */
function trAnalyse(im, p){ var W=64, H=Math.max(8, Math.round(64*im.height/Math.max(1,im.width))), c=document.createElement("canvas"); c.width=W; c.height=H;
  var x=c.getContext("2d", {willReadFrequently:true}); x.drawImage(im, 0, 0, W, H); var d=x.getImageData(0,0,W,H).data, n=W*H, L=new Float32Array(n), sL=0, sL2=0, sS=0, sC=0, sWarm=0, edges=0;
  for(var i=0;i<n;i++){ var r=d[i*4]/255, g=d[i*4+1]/255, b=d[i*4+2]/255, mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=0.2126*r+0.7152*g+0.0722*b;
    L[i]=l; sL+=l; sL2+=l*l; sC+=mx-mn; sS+=mx>0?(mx-mn)/mx:0; sWarm+=r-b; }
  for(var yy=0;yy<H;yy++) for(var xx=1;xx<W;xx++) edges+=Math.abs(L[yy*W+xx]-L[yy*W+xx-1]);
  var mL=sL/n, sd=Math.sqrt(Math.max(0, sL2/n-mL*mL)), chroma=sC/n, sat=sS/n, warm=sWarm/n, edge=edges/(H*(W-1)), t=[];
  var mono=chroma<0.05; t.push(mono?"mono":"colour");
  if(!mono){ if(sat>0.42) t.push("vivid"); else if(sat<0.22) t.push("muted"); if(warm>0.05) t.push("warm"); else if(warm<-0.03) t.push("cool"); }
  if(mL<0.36) t.push("moody"); else if(mL>0.6) t.push("airy");
  if(sd>0.25) t.push("contrast"); else if(sd<0.15) t.push("soft");
  (TR_PLACES[trPlace(p)]||[]).forEach(function(k){ t.push(k); });
  /* a few readings that combine the others */
  if(t.indexOf("moody")>=0&&t.indexOf("contrast")>=0) t.push("drama");
  if(edge<0.035&&sd<0.22) t.push("minimal");
  if(t.indexOf("vivid")>=0&&(sd>0.2||sat>0.55)) t.push("pop");
  if((mono||t.indexOf("muted")>=0)&&(t.indexOf("urban")>=0||t.indexOf("street")>=0||t.indexOf("heritage")>=0||sd>0.2)) t.push("documentary");
  p.tagInfo={bright:+mL.toFixed(2), contrast:+sd.toFixed(2), sat:+sat.toFixed(2), warm:+warm.toFixed(2), detail:+edge.toFixed(3)};
  return t; }
PH.forEach(function(p, i){ setTimeout(function(){ trTagPhoto(p); }, 300+i*60); });

// ---------- the effects ----------
/* one photo against this season: 0..1, or null while its tags are still loading */
function trPhotoFit(p){ if(!p||!p.tags) return null; var w=trWeights(trS()), miss=1;
  p.tags.forEach(function(k){ if(w[k]) miss*=1-0.62*w[k]; }); return 1-miss; }
/* a show's trend fit, 0..100: the average of its photos (one not yet read counts as middling) */
function gTrendFit(items){ items=(items||[]).filter(function(it){ return phById(it.pid); }); if(!items.length) return 0;
  var f=items.reduce(function(a,it){ var v=trPhotoFit(phById(it.pid)); return a+(v==null?0.4:v); },0)/items.length;
  return Math.round(100*Math.min(1, f/0.85)); }
/* what a work is worth swings with the trends: about 0.8 (out of fashion) to 1.3 (right on trend) */
function gTrendMult(it){ var v=trPhotoFit(phById(it&&it.pid)); return v==null?1:0.8+0.5*v; }

// ---------- the "What's hot" board and the era lesson card ----------
gCSS(
  ".trdlg{position:fixed;inset:0;z-index:12;display:grid;place-items:center;background:rgba(8,7,6,.62);padding:16px;backdrop-filter:blur(3px);overflow:auto}"+
  ".trdlg .box{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px 20px 16px;width:min(460px,100%);box-sizing:border-box;box-shadow:0 20px 60px rgba(0,0,0,.5);max-height:calc(100vh - 32px);overflow:auto}"+
  ".trdlg .k{font:500 10.5px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}"+
  ".trdlg h2{margin:4px 0 6px;font:600 23px/1.15 var(--display)}.trdlg p{margin:0 0 12px;color:var(--dim);font-size:14px;line-height:1.5}"+
  ".trdlg ul{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:8px}"+
  ".trdlg li{display:grid;grid-template-columns:22px 1fr 54px;gap:4px 8px;align-items:center;background:#0f0e0b;border-radius:10px;padding:8px 10px}"+
  ".trdlg li .ar{font:700 15px var(--mono);text-align:center}.trdlg li .ar.up{color:#8fcf8a}.trdlg li .ar.down{color:#e59a6b}.trdlg li .ar.new{color:var(--gold);font-size:10px;letter-spacing:.05em}.trdlg li .ar.flat{color:var(--dim)}"+
  ".trdlg li b{font:600 14px var(--body)}.trdlg li small{grid-column:2/4;font-size:12.5px;line-height:1.4;color:var(--dim)}"+
  ".trdlg li .b{height:6px;background:#2b2820;border-radius:3px;overflow:hidden}.trdlg li .b i{display:block;height:100%;background:var(--gold);border-radius:3px}"+
  ".trdlg .fit{display:flex;gap:10px;align-items:center;background:#0f0e0b;border-radius:10px;padding:10px 12px;font-size:13.5px;line-height:1.45;margin-bottom:14px}.trdlg .fit b{color:var(--gold);font:500 20px var(--mono)}"+
  ".trdlg .look{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}.trdlg .look span{border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:13px}"+
  ".trdlg .lesson .move{font:600 15px var(--body);color:var(--text);margin:0 0 8px}.trdlg .lesson p{color:var(--text);font-size:15px}"+
  ".trdlg .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}"+
  "@media (max-width:560px){.hud .clock{white-space:normal;text-align:right;text-wrap:balance}}"+
  "@media (max-width:480px){.trdlg{padding:10px;align-items:start}.trdlg .box{padding:16px 14px 14px}.trdlg h2{font-size:21px}}");
var TR={open:null};
function trClose(){ if(!TR.open) return; TR.open.remove(); TR.open=null; gHold=Math.max(0,gHold-1); removeEventListener("keydown", trKey); }
function trKey(e){ if(e.key==="Escape") trClose(); }
function trDialog(html, label){ trClose(); var d=gEl("div","trdlg"); d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-label",label);
  d.innerHTML='<div class="box">'+html+'</div>'; d.onclick=function(e){ if(e.target===d) trClose(); }; document.body.appendChild(d); TR.open=d; gHold++; addEventListener("keydown", trKey);
  d.querySelectorAll("[data-x]").forEach(function(b){ b.onclick=function(){ var x=b.dataset.x; if(x==="close") trClose(); else if(x==="lesson") trLesson(false); else if(x==="hot") trHot(); }; });
  var f=d.querySelector(".gbtn.gold"); if(f) f.focus({preventScroll:true}); return d; }
function trHot(){ var e=gEra(), E=trEraInfo(e), rows=trBoard(), fit=G.hung.length?gTrendFit(G.hung.filter(function(it){ return !it.sold; }).length?G.hung.filter(function(it){ return !it.sold; }):G.hung):null;
  var AR={up:"↑", down:"↓", flat:"→", "new":"NEW"};
  trDialog('<span class="k">What\'s hot · '+trSeasonName()+' '+trYear()+'</span><h2>'+gEsc(E.name)+'</h2>'+
    '<p>Collectors and the public follow the trends. Hang work that fits them and it sells for more and pulls a happier crowd. Critics care a little, but not much.</p>'+
    '<ul>'+rows.map(function(r){ var T=TR_TAGS[r.k], hint=r.dir==="down"?T.dn:T.up;
      return '<li><span class="ar '+r.dir+'" aria-label="'+(r.dir==="new"?"new this season":r.dir==="up"?"rising":r.dir==="down"?"falling":"steady")+'">'+AR[r.dir]+'</span><b>'+gEsc(T.l)+'</b><span class="b"><i style="width:'+Math.round(r.w*100)+'%"></i></span><small>'+gEsc(hint)+'</small></li>'; }).join("")+'</ul>'+
    (fit!=null?'<div class="fit"><b>'+fit+'</b><span>Trend fit of the work on your walls right now, out of 100.</span></div>':'<div class="fit"><span>Hang some work and you\'ll see how well it fits the trends.</span></div>')+
    '<div class="row"><button class="gbtn" type="button" data-x="lesson">About this era</button><button class="gbtn gold" type="button" data-x="close">Back to the floor</button></div>', "What's hot this season"); }
function trLesson(auto){ var e=gEra(), E=trEraInfo(e);
  trDialog('<span class="k">'+(auto?'A new era':'This era')+' · '+trSeasonName()+' '+trYear()+'</span><h2>'+gEsc(E.name)+'</h2><div class="lesson"><p class="move">'+gEsc(E.move)+'</p><p>'+gEsc(E.lesson)+'</p></div>'+
    (E.look.length?'<span class="k">Look them up</span><div class="look" style="margin-top:6px">'+E.look.map(function(n){ return '<span>'+gEsc(n)+'</span>'; }).join("")+'</div>':'')+
    '<div class="row"><button class="gbtn" type="button" data-x="hot">See what\'s hot</button><button class="gbtn gold" type="button" data-x="close">Let\'s go</button></div>', "A new era: "+E.name); }

/* the floor bar gets a "What's hot" button */
var _galBar0=galBar;
galBar=function(){ _galBar0(); if(gScreen!=="floor"||bar.querySelector(".trbtn")) return; var b=gEl("button","gbtn trbtn","What's hot"); b.onclick=trHot; bar.insertBefore(b, bar.lastChild); };

// ---------- season and era changes ----------
/* the season toast names the biggest riser and the biggest faller */
function trSeasonLine(){ var rows=trBoard(), up=rows.filter(function(r){ return r.d==null||r.d>0.01; }).sort(function(a,b){ return (b.d==null?0.5:b.d)-(a.d==null?0.5:a.d); })[0],
    dn=rows.filter(function(r){ return r.d!=null&&r.d<-0.01; }).sort(function(a,b){ return a.d-b.d; })[0], bits=[];
  function v(k, w){ var T=TR_TAGS[k]; return T.n+(T.pl?" are ":" is ")+w; }
  if(dn) bits.push(v(dn.k, "cooling off")); if(up) bits.push(v(up.k, "rising")); if(!bits.length) bits.push("the trends are holding steady");
  return trSeasonName()+" "+trYear()+": "+bits.join(", ")+"."; }
/* runs every frame: announce a new season, and open the lesson card once at the start of each era (on the floor, between events) */
function trCheck(){ if(!G||!G.site) return; var s=trS(), e=gEra();
  if(G.trSeason==null){ G.trSeason=s; galSave(); }
  if(s!==G.trSeason){ G.trSeason=s; galLog(trSeasonLine(), "money"); galSave(); }
  if((G.trEra==null||G.trEra<e)&&gScreen==="floor"&&!gNightOn&&!TR.open&&!document.querySelector(".ntdlg,.ntrev")){ G.trEra=e; galSave(); trLesson(true); } }
var _gTick0=gTick;
gTick=function(dt){ _gTick0(dt); trCheck(); };

if(/[?&]dev/.test(location.search)) window.__tr={hot:trHot, lesson:trLesson, board:trBoard, weights:trWeights, fit:gTrendFit, mult:gTrendMult, era:gEra, season:gSeason, year:trYear, line:trSeasonLine, close:trClose,
  tags:function(){ return PH.map(function(p){ return {name:p.name, tags:p.tags, info:p.tagInfo}; }); }};
