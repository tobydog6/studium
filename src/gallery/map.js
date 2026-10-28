// ================= GALLERY MAP: the city, its sites, and "go inside" (Sam: "like the sims you can see a pop up view and then if you want go into it") =================
// A full-screen DOM/SVG map of a made-up Christchurch-like city with a pin for each of SITES. Tap a pin for its card; "Go inside"
// hides the map and builds the bare room in 3D (roomBuild preview) to turn and zoom; "Sign the lease" calls galSignLease.
// The clock is held (gHold) while the map or a preview is up. Two looks: night (default) and paper (?mapstyle=paper).
var MAP_W=1000, MAP_H=800;
var MAP_STYLE=(function(){ var q=location.search; try{ if(BR) q+="&"+parent.location.search; }catch(e){} var m=/[?&]mapstyle=(\w+)/.exec(q); return m&&m[1]==="paper"?"paper":"night"; })();
/* where each site sits on the map (viewBox units) */
var MAP_PIN={warehouse:[771,671], shopfront:[611,391], villa:[842,126], popup:[531,231]};
var MAP_RIVER="M-20 470 C60 430 110 520 190 470 S260 330 340 300 S450 250 480 180 S560 90 640 130 S700 290 790 300 S920 250 1020 300";
var MAP_HIGH="M471 251 L1010 790", MAP_RATA="M668 14 C700 70 760 150 842 126 S960 70 1010 58";

gCSS(
  ".gm{position:fixed;inset:0;z-index:7;display:flex;flex-direction:column;background:var(--m-table);color:var(--text);font-family:var(--body);touch-action:auto}"+
  ".gm[hidden]{display:none}"+
  ".gm.night{--m-table:#0a0908;--m-ground:#0f0e0b;--m-block:#1b1914;--m-bline:#25221b;--m-ind:#17150f;--m-indline:#2e2a20;--m-park:#121c12;--m-parkline:#1c2a1a;--m-tree:#1d2f1b;--m-leaf:#131810;--m-river:#3d8fb3;--m-riverbank:#0d1a20;--m-road:#14120e;--m-label:#8f8879;--m-district:#4a4538;--m-pin:var(--gold);--m-pinink:#17140d;--m-card:var(--panel);--m-cardtext:var(--text);--m-carddim:var(--dim)}"+
  ".gm.paper{--m-table:#cfc6b3;--m-ground:var(--paper);--m-block:#e3d9c5;--m-bline:#8a7f6c;--m-ind:#d8ccb4;--m-indline:#6f6553;--m-park:#d3dcb1;--m-parkline:#8e9a6a;--m-tree:#a9b880;--m-leaf:#e2e3c4;--m-river:#9cc0cd;--m-riverbank:#5f8796;--m-road:#f7f2e7;--m-label:var(--ink);--m-district:#9a8f7b;--m-pin:var(--safelight);--m-pinink:#fff8ee;--m-card:var(--paper);--m-cardtext:var(--ink);--m-carddim:#5e5648}"+
  ".gm-top{display:flex;align-items:center;gap:12px;padding:14px 16px 10px;flex-wrap:wrap;background:var(--bg);border-bottom:1px solid var(--line)}"+
  ".gm-top h2{margin:0;font:600 24px/1.1 var(--display);letter-spacing:-.01em}"+
  ".gm-top p{margin:0;color:var(--dim);font-size:14.5px;flex:1 1 260px;min-width:0}.gm-top p b{color:var(--gold);font-weight:600}"+
  ".gm-cash{font:500 14px var(--mono);background:#1f1c16;border-radius:10px;padding:7px 11px;white-space:nowrap}.gm-cash small{font:500 10px var(--mono);letter-spacing:.12em;color:var(--dim);margin-right:6px}"+
  ".gm-x{border:0;background:#2b2820;color:var(--text);width:36px;height:36px;border-radius:50%;font:500 20px/1 var(--body);cursor:pointer;flex:none}"+
  ".gm-scroll{flex:1;min-height:0;overflow:auto;display:grid;place-items:center;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-x pan-y}"+
  ".gm-stage{position:relative;flex:none;box-shadow:0 10px 40px rgba(0,0,0,.45)}.gm.paper .gm-stage{box-shadow:0 2px 0 #b7ad98,0 14px 34px rgba(40,30,15,.35)}"+
  ".gm-stage svg{position:absolute;inset:0;width:100%;height:100%;display:block}"+
  ".gm svg .lbl{font:500 13px var(--mono);letter-spacing:.14em;text-transform:uppercase;fill:var(--m-label)}"+
  ".gm.paper svg .lbl{font:italic 500 14px var(--display);letter-spacing:.02em;text-transform:none}"+
  ".gm svg .lbl.big{font-size:15px;font-weight:600}"+
  ".gm svg .dist{font:italic 400 30px var(--display);fill:var(--m-district);letter-spacing:.01em}.gm.paper svg .dist{font-size:22px;letter-spacing:.12em;text-transform:uppercase;font-style:normal}"+
  ".gm.paper .rv-glow{display:none}.gm svg .halo{paint-order:stroke;stroke:var(--m-ground);stroke-width:5px;stroke-linejoin:round}"+
  ".gm-pin{position:absolute;transform:translate(-50%,-100%);border:0;background:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;color:var(--m-label);font-family:var(--body)}"+
  ".gm-pin svg{position:static;width:30px;height:40px;overflow:visible;transition:transform .15s}.gm-pin:hover svg,.gm-pin.on svg{transform:scale(1.2) translateY(-3px)}"+
  ".gm-pin .head{fill:var(--m-pin);stroke:var(--m-pinink);stroke-width:2}.gm-pin .dot{fill:var(--m-pinink)}"+
  ".gm.night .gm-pin svg{filter:drop-shadow(0 0 8px rgba(227,173,87,.55)) drop-shadow(0 3px 3px rgba(0,0,0,.6))}.gm.paper .gm-pin svg{filter:drop-shadow(1px 2px 0 rgba(29,26,21,.35))}"+
  ".gm-pin .tag{position:absolute;top:100%;margin-top:4px;white-space:nowrap;font:600 12.5px var(--body);padding:3px 8px;border-radius:999px;background:rgba(12,11,10,.82);color:var(--text)}"+
  ".gm.paper .gm-pin .tag{background:var(--ink);color:var(--paper)}"+
  ".gm-pin.here .tag{background:var(--gold);color:#17140d}"+
  ".gm-pin:focus-visible{outline:2px solid var(--m-pin);outline-offset:4px;border-radius:8px}"+
  ".gm-card{position:fixed;z-index:8;width:min(330px,calc(100vw - 24px));background:var(--m-card);color:var(--m-cardtext);border-radius:16px;padding:16px 16px 14px;box-shadow:0 16px 48px rgba(0,0,0,.5);animation:gmin .18s ease-out}"+
  ".gm.night .gm-card{border:1px solid var(--line)}.gm.paper .gm-card{border:1.5px solid var(--ink);box-shadow:4px 5px 0 rgba(29,26,21,.25)}"+
  "@keyframes gmin{from{opacity:0;transform:translateY(6px) scale(.98)}}"+
  ".gm-card h3{margin:0 30px 2px 0;font:600 22px/1.15 var(--display)}"+
  ".gm-card .st{font:500 11px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--m-carddim)}"+
  ".gm-card p{margin:10px 0 12px;font-size:14px;line-height:1.45}"+
  ".gm-card .cx{position:absolute;top:10px;right:10px;border:0;background:none;color:var(--m-carddim);font:400 22px/1 var(--body);width:32px;height:32px;cursor:pointer;border-radius:50%}"+
  ".gm-facts{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0 0 12px;font-size:13.5px;align-items:center}"+
  ".gm-facts dt{font:500 10.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--m-carddim)}.gm-facts dd{margin:0;font:500 14px var(--mono);font-variant-numeric:tabular-nums}"+
  ".gm-meter{display:inline-flex;gap:3px;vertical-align:middle;margin-right:8px}.gm-meter i{width:14px;height:8px;border-radius:2px;background:currentColor;opacity:.18}.gm-meter i.on{opacity:1;background:var(--m-pin)}"+
  ".gm-meter+span{font:500 12px var(--body);color:var(--m-carddim)}"+
  ".gm-acts{display:flex;gap:8px;flex-wrap:wrap}.gm-acts .gbtn{flex:1 1 auto;padding:10px 14px}"+
  ".gm.paper .gm-card .gbtn:not(.gold){background:var(--ink);color:var(--paper)}"+
  ".gm-why{margin:8px 0 0;font-size:12.5px;color:var(--safelight)}.gm.paper .gm-why{color:#b23c1c}"+
  ".gm-here{display:inline-block;margin-top:2px;background:var(--gold);color:#17140d;border-radius:999px;padding:8px 14px;font:600 13.5px var(--body)}"+
  ".gm-ok{margin:0 0 10px;padding:10px 12px;border-radius:10px;background:rgba(228,85,46,.12);border:1px solid rgba(228,85,46,.45);font-size:13.5px;line-height:1.4}"+
  ".gm-pv{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:7;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px);background:rgba(20,18,14,.9);backdrop-filter:blur(8px);border-radius:18px;padding:8px}"+
  ".gm-pv[hidden]{display:none}.gm-pv .nm{font:600 16px var(--display);padding:0 8px 0 6px}.gm-pv .nm small{display:block;font:500 10px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}"+
  ".gm-pv .gbtn{background:#2b2820}.gm-pv .gbtn.gold{background:var(--gold)}"+
  ".gm-hint{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:6;background:rgba(20,18,14,.82);border-radius:999px;padding:7px 14px;font-size:13px;color:var(--dim);pointer-events:none;white-space:nowrap;max-width:calc(100vw - 24px);overflow:hidden;text-overflow:ellipsis}"+
  ".gm-hint[hidden]{display:none}"+
  ".gm-pv .gm-ok{flex-basis:100%;margin:0 0 2px}"+
  "@media (max-width:640px){.gm-top{padding:12px 12px 8px;gap:8px}.gm-top h2{font-size:20px}.gm-top p{font-size:13.5px;order:3;flex-basis:100%}"+
  ".gm-card{left:12px!important;right:12px;top:auto!important;bottom:12px;width:auto;max-height:70vh;overflow:auto}.gm-hint{top:96px}.gm-pv{left:12px;right:12px;transform:none;max-width:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px}.gm-pv .nm{grid-column:1/-1;padding:0 4px}.gm-pv .gbtn{padding:11px 8px}.gm-pv .gm-ok{grid-column:1/-1}}"+
  "@media (prefers-reduced-motion:reduce){.gm-card{animation:none}.gm-pin svg{transition:none}}");

var MAP={el:null, card:null, pv:null, hint:null, open:false, first:false, sel:null, previewing:null};

/* the city, drawn once: blocks on a street grid, the park, the leafy hill, the industrial flats, the river over the top */
function mapSVG(){ var o=[], i, x, y;
  function isLeafy(x,y){ return x>=640&&y<280; } function isInd(x,y){ return y>=600&&x>=500; }
  o.push('<defs><filter id="gm-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>'+
    '<pattern id="gm-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="var(--m-indline)" stroke-width="1.4"/></pattern>'+
    '<clipPath id="gm-clip"><rect width="'+MAP_W+'" height="'+MAP_H+'"/></clipPath></defs><g clip-path="url(#gm-clip)">');
  o.push('<rect width="'+MAP_W+'" height="'+MAP_H+'" fill="var(--m-ground)"/>');
  /* the leafy hill under Rata Terrace */
  o.push('<path d="M640 0 H1000 V286 Q900 300 820 282 Q720 262 640 280 Z" fill="var(--m-leaf)"/>');
  /* the street grid: blocks 62 units with 18-unit streets */
  for(x=340;x<=980;x+=80) for(y=40;y<=760;y+=80){ if(isLeafy(x,y)) continue;
    if(isInd(x,y)){ if((x-500)%160) continue; o.push('<rect x="'+x+'" y="'+y+'" width="142" height="62" rx="2" fill="var(--m-ind)" stroke="var(--m-indline)" stroke-width="1.2"/><rect x="'+(x+6)+'" y="'+(y+6)+'" width="130" height="50" fill="url(#gm-hatch)" opacity=".7"/>'); continue; }
    o.push('<rect x="'+x+'" y="'+y+'" width="62" height="62" rx="3" fill="var(--m-block)" stroke="var(--m-bline)" stroke-width="1"/>'); }
  /* the strip of blocks between the park and the river to the south-west */
  for(x=20;x<=260;x+=80) for(y=700;y<=780;y+=80) o.push('<rect x="'+x+'" y="'+y+'" width="62" height="62" rx="3" fill="var(--m-block)" stroke="var(--m-bline)" stroke-width="1"/>');
  /* the market square by the river */
  o.push('<rect x="500" y="200" width="62" height="62" rx="3" fill="var(--m-road)" stroke="var(--m-bline)"/>');
  for(i=0;i<9;i++) o.push('<rect x="'+(506+(i%3)*18)+'" y="'+(207+Math.floor(i/3)*18)+'" width="13" height="11" rx="1.5" fill="var(--m-pin)" opacity="'+(i%2?0.35:0.6)+'"/>');
  /* the park: lawns, a lake, paths and trees */
  o.push('<path d="M30 300 Q22 250 78 244 L270 236 Q318 236 316 286 L322 616 Q322 676 262 684 L84 690 Q30 690 30 640 Z" fill="var(--m-park)" stroke="var(--m-parkline)" stroke-width="1.5"/>');
  o.push('<ellipse cx="150" cy="590" rx="58" ry="30" fill="var(--m-river)" opacity=".55"/>');
  o.push('<path d="M60 300 C140 360 230 300 300 380 M80 660 C150 620 220 680 300 600 M180 250 C170 360 230 420 200 560" fill="none" stroke="var(--m-parkline)" stroke-width="2" stroke-dasharray="1 6" stroke-linecap="round"/>');
  for(i=0;i<70;i++){ x=48+gHash("tx"+i)*256; y=262+gHash("ty"+i)*410; if(Math.hypot((x-150)/66,(y-590)/38)<1) continue; o.push('<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(4+gHash("tr"+i)*5).toFixed(1)+'" fill="var(--m-tree)"/>'); }
  for(i=0;i<46;i++){ x=650+gHash("lx"+i)*350; y=8+gHash("ly"+i)*262; o.push('<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(3.5+gHash("lr"+i)*4).toFixed(1)+'" fill="var(--m-tree)"/>'); }
  /* villas along the terrace */
  [[690,74],[722,122],[770,162],[812,166],[870,142],[930,118],[972,100],[724,58],[770,98],[860,86],[928,52],[704,176],[960,170],[820,214],[880,210]].forEach(function(v,k){ o.push('<rect x="'+v[0]+'" y="'+v[1]+'" width="20" height="16" rx="2" fill="var(--m-block)" stroke="var(--m-bline)" transform="rotate('+((k%3)*9-8)+' '+(v[0]+10)+' '+(v[1]+8)+')"/>'); });
  /* main roads drawn over the blocks */
  o.push('<path d="'+MAP_HIGH+'" stroke="var(--m-road)" stroke-width="20" fill="none"/>');
  o.push('<path d="'+MAP_RATA+'" stroke="var(--m-road)" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M900 0 C890 60 940 140 1010 160" stroke="var(--m-road)" stroke-width="10" fill="none"/>');
  /* the railway along the industrial edge */
  o.push('<path d="M480 788 H1000" stroke="var(--m-label)" stroke-width="2" stroke-dasharray="10 6" opacity=".55"/>');
  /* the river: a glow at night, an inked line on paper */
  o.push('<path class="rv-glow" d="'+MAP_RIVER+'" stroke="var(--m-river)" stroke-width="34" fill="none" opacity=".45" filter="url(#gm-glow)"/>');
  o.push('<path d="'+MAP_RIVER+'" stroke="var(--m-riverbank)" stroke-width="30" fill="none" stroke-linecap="round"/><path d="'+MAP_RIVER+'" stroke="var(--m-river)" stroke-width="22" fill="none" stroke-linecap="round"/>');
  /* bridges where the main streets cross */
  [[411,256,-50],[571,104,30],[651,150,-75],[731,272,-20],[891,272,10],[331,304,-30]].forEach(function(b){ o.push('<rect x="'+(b[0]-6)+'" y="'+(b[1]-20)+'" width="12" height="40" fill="var(--m-road)" stroke="var(--m-bline)" transform="rotate('+b[2]+' '+b[0]+' '+b[1]+')"/>'); });
  /* names */
  o.push('<path id="gm-hp" d="M640 420 L880 660" fill="none"/><path id="gm-rp" d="'+MAP_RATA+'" fill="none"/><path id="gm-wp" d="M190 470 S260 330 340 300 S450 250 480 180" fill="none"/>');
  o.push('<text class="lbl big halo"><textPath href="#gm-hp" startOffset="14%">High Street</textPath></text>');
  o.push('<text class="lbl big halo" dy="-14"><textPath href="#gm-rp" startOffset="60%">Rata Terrace</textPath></text>');
  o.push('<text class="lbl" dy="-18" fill-opacity=".8"><textPath href="#gm-wp" startOffset="18%">Wairere River</textPath></text>');
  o.push('<text class="lbl big halo" x="560" y="676">Foundry Lane</text>');
  o.push('<text class="lbl big halo" x="572" y="196" text-anchor="start">Riverside Market</text>');
  o.push('<text class="lbl halo" x="420" y="356">Tui Street</text><text class="lbl halo" x="660" y="516">Matai Street</text><text class="lbl halo" x="740" y="436">Kauri Street</text>');
  o.push('<text class="lbl halo" transform="translate(336 560) rotate(-90)">Park Terrace</text><text class="lbl halo" transform="translate(496 520) rotate(-90)">Harakeke Street</text>');
  o.push('<text class="dist" x="96" y="420">Tōtara Park</text><text class="dist" x="790" y="760">The Flats</text><text class="dist" x="352" y="636">City centre</text><text class="dist" x="840" y="246" text-anchor="middle">Rata Hill</text>');
  /* compass and scale */
  o.push('<g transform="translate(60 80)"><circle r="26" fill="var(--m-ground)" stroke="var(--m-label)" stroke-width="1.2" opacity=".9"/><path d="M0 -20 L6 0 L0 20 L-6 0 Z" fill="var(--m-label)"/><path d="M0 -20 L6 0 L-6 0 Z" fill="var(--m-pin)"/><text class="lbl" y="-31" text-anchor="middle">N</text></g>');
  o.push('<g transform="translate(40 150)"><path d="M0 0 H120 M0 -5 V5 M60 -4 V4 M120 -5 V5" stroke="var(--m-label)" stroke-width="1.5"/><text class="lbl" x="0" y="20">0</text><text class="lbl" x="120" y="20" text-anchor="end">500 m</text></g>');
  o.push('</g>');
  return '<svg viewBox="0 0 '+MAP_W+' '+MAP_H+'" aria-hidden="true">'+o.join("")+'</svg>'; }

function mapPinHTML(s){ var p=MAP_PIN[s.id]||[500,400], here=G.site===s.id;
  return '<button class="gm-pin'+(here?' here':'')+'" data-id="'+s.id+'" style="left:'+(p[0]/MAP_W*100)+'%;top:'+(p[1]/MAP_H*100)+'%" aria-label="'+gEsc(s.name+", "+s.street+(here?", you're here":""))+'">'+
    '<svg viewBox="-15 -40 30 40"><path class="head" d="M0 -1 C-3 -10 -13 -15 -13 -26 A13 13 0 1 1 13 -26 C13 -15 3 -10 0 -1 Z"/><circle class="dot" cy="-26" r="'+(here?6:4.5)+'"/></svg>'+
    '<span class="tag">'+gEsc(here?"You're here":s.name)+'</span></button>'; }

/* build the overlay once */
function mapMake(){ if(MAP.el) return;
  var el=MAP.el=gEl("div","gm "+MAP_STYLE); el.hidden=true; el.setAttribute("role","dialog"); el.setAttribute("aria-label","City map"); el.dataset.nosnippet="";
  el.innerHTML='<div class="gm-top"><h2>The city</h2><p></p><span class="gm-cash"><small>CASH</small><b></b></span><button class="gm-x" aria-label="Close the map">×</button></div>'+
    '<div class="gm-scroll"><div class="gm-stage">'+mapSVG()+'<div class="gm-pins"></div></div></div>';
  document.body.appendChild(el);
  el.querySelector(".gm-x").onclick=function(){ mapExit(); };
  el.querySelector(".gm-scroll").addEventListener("click", function(e){ var b=e.target.closest(".gm-pin"); if(b){ mapCard(b.dataset.id); return; } if(!e.target.closest(".gm-card")) mapCardClose(); });
  MAP.pv=gEl("div","gm-pv"); MAP.pv.hidden=true; document.body.appendChild(MAP.pv);
  MAP.hint=gEl("div","gm-hint","Drag to turn the room. Scroll or pinch to zoom."); MAP.hint.hidden=true; document.body.appendChild(MAP.hint);
  addEventListener("resize", function(){ if(MAP.open&&!MAP.el.hidden){ mapFit(); if(MAP.sel) mapCard(MAP.sel); } });
  addEventListener("keydown", function(e){ if(!MAP.open||e.key!=="Escape") return; if(MAP.previewing) mapBackFromPreview(); else if(MAP.card) mapCardClose(); else if(!MAP.first) mapExit(); }); }

/* size the map to the space: whole on a big screen; on a phone it keeps a readable size and you scroll it */
function mapFit(){ var sc=MAP.el.querySelector(".gm-scroll"), st=MAP.el.querySelector(".gm-stage"), w=sc.clientWidth-24, h=sc.clientHeight-24;
  var k=Math.min(w/MAP_W, h/MAP_H); if(k<0.72) k=Math.max(0.72, Math.min(1.05, h/MAP_H));   /* a tall phone: fill the height and scroll sideways */ st.style.width=Math.round(MAP_W*k)+"px"; st.style.height=Math.round(MAP_H*k)+"px";
  sc.style.placeItems=MAP_W*k>w+24||MAP_H*k>h+24?"start":"center"; st.style.margin=MAP_W*k>w+24?"12px":"";
  /* on a narrow screen start the view centred on the pins */
  if(MAP_W*k>w+24) sc.scrollLeft=Math.max(0, 686*k+12-sc.clientWidth/2); }

function mapTop(){ var p=MAP.el.querySelector(".gm-top p");
  p.innerHTML=MAP.first?"Pick a space for your first gallery. You've got a <b>"+gMoney(G.cash)+"</b> start-up grant.":"Fancy a new space? Tap a pin to have a look around.";
  MAP.el.querySelector(".gm-cash b").textContent=gMoney(G.cash); MAP.el.querySelector(".gm-x").hidden=MAP.first;
  MAP.el.querySelector(".gm-pins").innerHTML=SITES.map(mapPinHTML).join(""); }

function mapWall(s){ return Math.round(siteFaces(s).reduce(function(a,f){ return a+f.len; },0)); }
var MAP_TRAFFIC=["Hardly anyone","A trickle","Steady","Busy","Bustling"];
/* can you sign here? returns "" or the reason you can't */
function mapWhyNot(s){ var bond=s.rent*2; if(G.cash<bond) return "You need "+gMoney(bond)+" for the bond (two weeks' rent), and you've got "+gMoney(G.cash)+"."; return ""; }

/* the Sims-style pop-up card for a site */
function mapCard(id, confirm){ var s=siteById(id); if(!s) return; mapCardClose(); MAP.sel=id; var here=G.site===id, why=mapWhyNot(s), bond=s.rent*2;
  MAP.el.querySelectorAll(".gm-pin").forEach(function(b){ b.classList.toggle("on", b.dataset.id===id); });
  var c=MAP.card=gEl("div","gm-card"); c.setAttribute("role","dialog"); c.setAttribute("aria-label", s.name);
  c.innerHTML='<button class="cx" aria-label="Close">×</button><h3>'+gEsc(s.name)+'</h3><div class="st">'+gEsc(s.street)+'</div><p>'+gEsc(s.blurb)+'</p>'+
    '<dl class="gm-facts"><dt>Rent</dt><dd>'+gMoney(s.rent)+' a week</dd>'+
    '<dt>Foot traffic</dt><dd><span class="gm-meter" aria-label="'+s.traffic+' out of 5">'+[1,2,3,4,5].map(function(n){ return '<i class="'+(n<=s.traffic?"on":"")+'"></i>'; }).join("")+'</span><span>'+MAP_TRAFFIC[s.traffic-1]+'</span></dd>'+
    '<dt>Wall space</dt><dd>'+mapWall(s)+' m</dd>'+(s.lease?'<dt>Lease</dt><dd>'+s.lease+' weeks only</dd>':'')+
    (here?'':'<dt>Bond</dt><dd>'+gMoney(bond)+'</dd>')+'</dl>'+
    (confirm?mapWarn(s):'')+
    '<div class="gm-acts">'+(here?'<span class="gm-here">You\'re here</span>':'<button class="gbtn" data-a="in">Go inside</button><button class="gbtn gold" data-a="sign"'+(why?' disabled':'')+'>'+(confirm?"Move here":"Sign the lease")+'</button>'+(confirm?'<button class="gbtn" data-a="stay">Stay put</button>':''))+'</div>'+
    (why&&!here?'<div class="gm-why">'+gEsc(why)+'</div>':'');
  MAP.el.appendChild(c);
  c.querySelector(".cx").onclick=mapCardClose;
  c.querySelectorAll("[data-a]").forEach(function(b){ b.onclick=function(){ var a=b.dataset.a;
    if(a==="in") mapPreview(id); else if(a==="stay") mapCard(id); else if(a==="sign"){ if(G.site&&!confirm) mapCard(id, true); else mapSign(id); } }; });
  /* sit beside the pin on a big screen (the phone layout pins it to the bottom in CSS) */
  var pin=MAP.el.querySelector('.gm-pin[data-id="'+id+'"]'), r=pin.getBoundingClientRect(), cw=c.offsetWidth, ch=c.offsetHeight, x=r.right+14, y=r.top+r.height/2-ch/2;
  if(x+cw>innerWidth-12) x=r.left-14-cw; x=Math.max(12,Math.min(innerWidth-cw-12,x)); y=Math.max(70,Math.min(innerHeight-ch-12,y));
  c.style.left=x+"px"; c.style.top=y+"px";
  var f=c.querySelector("[data-a=sign]:not([disabled])")||c.querySelector("[data-a]")||c.querySelector(".cx"); try{ f.focus({preventScroll:true}); }catch(e){} }
function mapWarn(s){ var n=G.hung.length;
  return '<div class="gm-ok">Moving means the walls come down: '+(n?'your '+n+' hung work'+(n===1?'':'s')+' come'+(n===1?'s':'')+' off and ':'')+'you start fresh at '+gEsc(s.name)+'. The bond is '+gMoney(s.rent*2)+'.</div>'; }
function mapCardClose(){ if(MAP.card){ MAP.card.remove(); MAP.card=null; } MAP.sel=null; if(MAP.el) MAP.el.querySelectorAll(".gm-pin.on").forEach(function(b){ b.classList.remove("on"); }); }

/* "Go inside": the bare room in 3D, with a small bar to come back or sign */
function mapPreview(id, confirm){ var s=siteById(id); if(!s) return; mapCardClose(); MAP.previewing=id; MAP.el.hidden=true; MAP.hint.hidden=false;
  if(RM.site!==s||!RM.preview) roomBuild(s, {preview:true});
  var why=mapWhyNot(s);
  MAP.pv.innerHTML=(confirm?mapWarn(s):'')+'<span class="nm"><small>'+gEsc(s.street)+' · '+gMoney(s.rent)+'/wk</small>'+gEsc(s.name)+'</span><button class="gbtn" data-a="back">Back to the map</button>'+
    (confirm?'<button class="gbtn" data-a="stay">Stay put</button>':'')+'<button class="gbtn gold" data-a="sign"'+(why?' disabled title="'+gEsc(why)+'"':'')+'>'+(confirm?"Move here":"Sign the lease")+'</button>';
  MAP.pv.hidden=false;
  MAP.pv.querySelectorAll("[data-a]").forEach(function(b){ b.onclick=function(){ var a=b.dataset.a;
    if(a==="back") mapBackFromPreview(); else if(a==="stay") mapPreview(id); else if(a==="sign"){ if(G.site&&!confirm) mapPreview(id, true); else mapSign(id); } }; });
  if(why) galToast(why, "warn"); }
function mapBackFromPreview(){ var id=MAP.previewing; MAP.previewing=null; MAP.pv.hidden=true; MAP.hint.hidden=true; MAP.el.hidden=false; mapTop(); mapFit(); if(id) mapCard(id); }

/* hide everything and give the clock back (once) */
function mapHide(){ mapCardClose(); MAP.previewing=null; if(MAP.el) MAP.el.hidden=true; if(MAP.pv) MAP.pv.hidden=true; if(MAP.hint) MAP.hint.hidden=true;
  if(MAP.open){ MAP.open=false; gHold=Math.max(0,gHold-1); } }
function mapSign(id){ var s=siteById(id); if(!s||mapWhyNot(s)) return; mapHide(); galSignLease(id); }
/* back out of the whole map to your own gallery */
function mapExit(){ if(!G.site) return; mapHide(); var s=siteById(G.site); if(RM.site!==s||RM.preview) roomBuild(s); galGo("floor"); }

GSCR.map={open:function(o){ o=o||{}; mapMake(); MAP.first=!!o.first||!G.site;
  if(!MAP.open){ MAP.open=true; gHold++; }
  MAP.previewing=null; MAP.pv.hidden=true; MAP.hint.hidden=true; MAP.el.hidden=false; mapTop(); mapCardClose(); mapFit();
  if(o.site) mapCard(o.site); },
  close:function(){ if(G.site) mapExit(); }};
if(/[?&]dev/.test(location.search)) window.__map={M:MAP, card:mapCard, preview:mapPreview, back:mapBackFromPreview, exit:mapExit, hold:function(){ return gHold; }};
