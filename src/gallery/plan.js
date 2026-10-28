// ================= GALLERY WALL PLAN: hang a wall flat, like a curator's elevation =================
// Click a wall in the room and it opens flat, drawn to scale over the room: a metre ruler, the dashed 145 cm centre line, and
// the works at their real printed size. Drag photos up from the tray (or tap one to hang it in the biggest gap); they land
// centred on the line. Drag hung works along the wall (off the line too; they snap back within 8 cm) and the gaps show in cm.
// Select a work to change its print size (pays the difference), set its price or take it down. Sold work stays put.
// The clock stops while the plan is open (gHold). Uses core.js: G, PH, PRINT, galFace, itemSize, itemWorth, galHang, galUnhang.
var PL={el:null, face:null, k:40, z:0, sel:null, size:"m", drag:null, els:{}, ghost:null, float:null, gaps:false, held:false, justDragged:false};
var PL_ZOOM=[1, 1.5, 2.25, 3.4];   /* zoom steps over the whole-wall fit, capped where the wall fills the height */
var PL_LINE=1.45, PL_SNAP=0.08, PL_GAP=0.05, PL_FLOOR=0.2, PL_TOP=0.1, PL_KMIN=34;   /* metres: the centre line, its snap, the least gap between frames, clear floor and ceiling */

gCSS(
  ".gp{position:fixed;inset:0;z-index:4;background:var(--bg);display:none;flex-direction:column;padding-top:var(--gp-top,64px);color:var(--text);font-family:var(--body)}.gp.on{display:flex}"+
  ".gp-head{display:flex;align-items:center;gap:8px;padding:4px 16px 10px;flex-wrap:wrap}.gp-ttl{flex:1;min-width:170px}"+
  ".gp-ttl h2{margin:0;font:600 24px/1.1 var(--display)}.gp-ttl small{display:block;margin-top:4px;font:500 10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}"+
  ".gp-btn{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:999px;padding:9px 16px;font:600 13.5px var(--body);cursor:pointer}"+
  ".gp-btn.gold{background:var(--gold);border-color:var(--gold);color:#17140d}.gp-btn:disabled{opacity:.4;cursor:default}"+
  ".gp button:focus-visible,.gp-ph:focus-visible{outline:2px solid var(--text);outline-offset:2px}"+
  ".gp-main{flex:1;min-height:0;display:flex;position:relative}"+
  ".gp-zoom{position:absolute;left:16px;top:8px;z-index:6;display:flex;gap:6px}.gp-zoom button{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--text);font:600 17px var(--body);cursor:pointer}.gp-zoom button:disabled{opacity:.35;cursor:default}"+
  ".gp-done{float:right;margin-top:10px;border:0;background:none;color:var(--gold);font:600 13px var(--body);cursor:pointer;padding:4px 0}"+
  ".gp-stage{flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;display:flex;align-items:center;touch-action:pan-x;scrollbar-width:thin}"+
  ".gp-wrap{position:relative;margin:auto;flex:none}"+
  ".gp-wall{position:relative;box-shadow:inset 0 22px 30px -24px rgba(0,0,0,.35),0 24px 40px -24px #000}"+
  ".gp-floor{height:10px;box-shadow:inset 0 3px 4px rgba(0,0,0,.35)}"+
  ".gp-line{position:absolute;left:0;right:0;height:0;border-top:1.5px dashed #b98a3e;z-index:1;pointer-events:none}"+
  ".gp-line span{position:absolute;left:6px;top:4px;font:600 10.5px var(--mono);color:#8a5f1c;white-space:nowrap}"+
  ".gp-ruler{position:relative;height:30px;margin-top:6px;border-top:1px solid var(--line)}"+
  ".gp-tick{position:absolute;top:0;width:1px;height:6px;background:var(--dim)}.gp-tick.mj{height:10px}"+
  ".gp-tick b{position:absolute;top:12px;left:0;transform:translateX(-50%);font:500 10px var(--mono);color:var(--dim);white-space:nowrap}"+
  ".gp-work{position:absolute;z-index:2;background:#9c968b center/cover no-repeat;box-shadow:0 0 0 var(--fw,3px) #1b1a18,0 7px 14px rgba(0,0,0,.32);cursor:grab;touch-action:none}"+
  ".gp-work.sel{z-index:3;outline:2px solid var(--gold);outline-offset:calc(var(--fw,3px) + 3px)}"+
  ".gp-work.drag{z-index:5;cursor:grabbing;box-shadow:0 0 0 var(--fw,3px) #1b1a18,0 14px 26px rgba(0,0,0,.45)}"+
  ".gp-work.sold{cursor:pointer}.gp-work.ghost{z-index:5;opacity:.8;pointer-events:none}"+
  ".gp-dot{position:absolute;bottom:0;left:calc(100% + var(--fw,3px) + 5px);width:9px;height:9px;border-radius:50%;background:#d8321e}.gp-work:not(.sold) .gp-dot{display:none}"+
  ".gp-tag{position:absolute;left:50%;bottom:100%;transform:translate(-50%,-10px);background:var(--gold);color:#17140d;font:600 11px var(--mono);padding:3px 7px;border-radius:6px;white-space:nowrap}"+
  ".gp-gaps{position:absolute;inset:0;pointer-events:none;z-index:4}"+
  ".gp-gap{position:absolute;height:0;border-top:1.5px solid #a86f1d}.gp-gap:before,.gp-gap:after{content:'';position:absolute;top:-5px;width:1.5px;height:9px;background:#a86f1d}.gp-gap:before{left:0}.gp-gap:after{right:0}"+
  ".gp-gap b{position:absolute;left:50%;bottom:4px;transform:translateX(-50%);background:var(--gold);color:#17140d;font:600 10.5px var(--mono);padding:2px 6px;border-radius:5px;white-space:nowrap}"+
  ".gp-gap.end{border-top:1.5px dotted rgba(29,26,21,.5)}.gp-gap.end:before,.gp-gap.end:after{background:rgba(29,26,21,.5)}.gp-gap.end b{background:rgba(29,26,21,.75);color:var(--paper)}"+
  ".gp-float{position:fixed;z-index:7;pointer-events:none;transform:translate(-50%,-50%);background:#9c968b center/cover no-repeat;box-shadow:0 0 0 3px #1b1a18,0 12px 26px rgba(0,0,0,.5);display:none}"+
  ".gp-float.bad{box-shadow:0 0 0 3px var(--safelight),0 12px 26px rgba(0,0,0,.5)}.gp-float.bad .gp-tag{background:var(--safelight);color:var(--text)}"+
  ".gp-side{width:290px;flex:none;border-left:1px solid var(--line);background:var(--panel);padding:6px 18px 18px;overflow-y:auto;font-size:14px;line-height:1.45}"+
  ".gp-side h3{margin:0;font:600 19px/1.2 var(--display)}.gp-side p{margin:8px 0}"+
  ".gp-k{margin:16px 0 7px!important;font:500 10.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}"+
  ".gp-sw{display:flex;gap:12px;align-items:center}.gp-sw img{width:64px;height:48px;object-fit:cover;border-radius:3px;box-shadow:0 0 0 2px #1b1a18;flex:none}"+
  ".gp-sw small{display:block;margin-top:3px;font:500 11px var(--mono);color:var(--dim)}"+
  ".gp-sizes{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}"+
  ".gp-sizes button{border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:10px;padding:8px;cursor:pointer;text-align:left;font:inherit}"+
  ".gp-sizes button.on{border-color:var(--gold);box-shadow:inset 0 0 0 1px var(--gold)}"+
  ".gp-sizes b{display:block;font:600 13px var(--body)}.gp-sizes small{display:block;font:500 10.5px var(--mono);color:var(--dim)}.gp-sizes em{display:block;margin-top:3px;font:600 11px var(--mono);font-style:normal;color:var(--gold)}"+
  ".gp-price{display:flex;align-items:center;gap:6px}"+
  ".gp-price button{width:40px;height:40px;flex:none;border-radius:50%;border:1px solid var(--line);background:var(--bg);color:var(--text);font:600 19px var(--body);cursor:pointer}"+
  ".gp-price label{flex:1;min-width:0;display:flex;align-items:center;gap:4px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0 10px;font:500 16px var(--mono);color:var(--dim)}"+
  ".gp-price label:focus-within{border-color:var(--gold)}"+
  ".gp-price input{flex:1;min-width:0;width:100%;background:none;border:0;color:var(--text);font:500 16px var(--mono);padding:9px 0;outline:none;-moz-appearance:textfield;-webkit-user-select:text;user-select:text}"+
  ".gp-price input::-webkit-inner-spin-button,.gp-price input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}"+
  ".gp-note{font-size:13px;color:var(--dim)}.gp-note b{color:var(--text);font-weight:600}"+
  ".gp-sold{display:flex;align-items:center;gap:8px;font:600 16px var(--body);margin:16px 0 4px!important}.gp-sold i{width:11px;height:11px;border-radius:50%;background:#d8321e}"+
  ".gp-down{margin-top:16px;width:100%;border-color:rgba(228,85,46,.55);color:#f2a68f}"+
  ".gp-traybox{flex:none;border-top:1px solid var(--line);background:var(--panel);padding:10px 0 calc(8px + env(safe-area-inset-bottom))}"+
  ".gp-hint{display:flex;align-items:center;gap:10px;padding:0 16px 8px;flex-wrap:wrap;font-size:13px;color:var(--dim)}.gp-hint b{color:var(--gold);font:600 13px var(--mono)}"+
  ".gp-seg{display:inline-flex;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:2px}"+
  ".gp-seg button{border:0;background:none;color:var(--dim);font:600 12.5px var(--body);padding:6px 11px;border-radius:999px;cursor:pointer}.gp-seg button.on{background:var(--gold);color:#17140d}"+
  ".gp-tray{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;padding:2px 16px 6px;overscroll-behavior:contain;scrollbar-width:thin}"+
  ".gp-ph{flex:none;width:96px;cursor:grab;touch-action:pan-x;border-radius:6px}"+
  ".gp-ph img{display:block;width:96px;height:66px;object-fit:cover;border-radius:5px;pointer-events:none;-webkit-user-drag:none}"+
  ".gp-ph span{display:block;margin-top:4px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"+
  ".gp-ph em{display:block;font:500 10px var(--mono);font-style:normal;color:var(--gold)}"+
  "@media (max-width:760px){.gp-main{flex-direction:column}.gp-stage{flex:1 0 250px}.gp-side{width:auto;flex:0 1 auto;min-height:0;border-left:0;border-top:1px solid var(--line);padding:2px 16px 12px}.gp-side.empty{display:none}.gp.has-sel .gp-traybox{display:none}"+
  ".gp-ttl h2{font-size:20px}.gp-btn{padding:8px 13px;font-size:13px}.gp-k{margin:10px 0 5px!important}.gp-hint .long{display:none}.gp-ph{width:84px}.gp-ph img{width:84px;height:58px}}");

function plFace(){ return PL.face?galFace(PL.face):null; }
function plItems(){ return G.hung.filter(function(it){ return it.face===PL.face; }); }
function plCm(m){ return Math.round(m*100); }
function plRound(n){ return Math.max(10, Math.round(n/10)*10); }
function plSnapY(y){ return Math.abs(y-PL_LINE)<PL_SNAP?PL_LINE:y; }
function plNarrow(){ return window.matchMedia&&matchMedia("(max-width:760px)").matches; }
function plHex(n){ return "#"+(n>>>0).toString(16).padStart(6,"0"); }

/* does a w by h print centred at (x,y) sit inside the wall without touching another frame? */
function plFits(id, x, y, w, h){ var f=plFace(); if(!f) return false;
  if(x-w/2<-1e-6||x+w/2>f.len+1e-6||y-h/2<PL_FLOOR-1e-6||y+h/2>f.h-PL_TOP+1e-6) return false;
  return !plItems().some(function(o){ if(o.id===id) return false; var s=itemSize(o); return Math.abs(x-o.x)<(w+s[0])/2+PL_GAP-1e-6&&Math.abs(y-o.y)<(h+s[1])/2+PL_GAP-1e-6; }); }
/* the nearest free spot to (x,y): kept inside the wall, and slid along it to the closest gap; null if there's no room at that height */
function plPlace(id, x, y, w, h){ var f=plFace(); x=Math.max(w/2, Math.min(f.len-w/2, x)); y=Math.max(PL_FLOOR+h/2, Math.min(f.h-PL_TOP-h/2, y));
  if(plFits(id,x,y,w,h)) return {x:x, y:y}; var best=null;
  plItems().forEach(function(o){ if(o.id===id) return; var s=itemSize(o); [o.x-(s[0]+w)/2-PL_GAP, o.x+(s[0]+w)/2+PL_GAP].forEach(function(c){ if(plFits(id,c,y,w,h)&&(!best||Math.abs(c-x)<Math.abs(best.x-x))) best={x:c, y:y}; }); });
  return best; }
/* the middle of the widest free stretch of the centre line (tap a photo in the tray) */
function plFreeSpot(w, h){ var f=plFace(), xs=[[0,0]], best=null;
  plItems().forEach(function(o){ var s=itemSize(o); if(Math.abs(o.y-PL_LINE)<(s[1]+h)/2+PL_GAP) xs.push([o.x-s[0]/2, o.x+s[0]/2]); }); xs.push([f.len,f.len]); xs.sort(function(a,b){ return a[0]-b[0]; });
  for(var i=1;i<xs.length;i++){ var a=xs[i-1][1], b=xs[i][0]; if(!best||b-a>best[1]-best[0]) best=[a,b]; }
  return best?plPlace(null, (best[0]+best[1])/2, PL_LINE, w, h):null; }

// ---------- the overlay ----------
function plBuild(){ if(PL.el) return; var el=PL.el=gEl("div","gp"); el.setAttribute("role","dialog"); el.setAttribute("aria-label","Wall plan"); el.setAttribute("data-nosnippet","");
  el.innerHTML='<div class="gp-head"><div class="gp-ttl"><h2 id="gp-name"></h2><small id="gp-sub"></small></div>'+
    '<button class="gp-btn" id="gp-even">Space evenly</button><button class="gp-btn gold" id="gp-back">Back to the room</button></div>'+
    '<div class="gp-main"><div class="gp-zoom"><button id="gp-zo" aria-label="Zoom out">−</button><button id="gp-zi" aria-label="Zoom in">+</button></div><div class="gp-stage" id="gp-stage"><div class="gp-wrap" id="gp-wrap"><div class="gp-wall" id="gp-wall"><div class="gp-line" id="gp-line"><span>145 cm centre line</span></div><div class="gp-gaps" id="gp-gaps"></div></div>'+
    '<div class="gp-floor" id="gp-floor"></div><div class="gp-ruler" id="gp-ruler"></div></div></div><aside class="gp-side" id="gp-side"></aside></div>'+
    '<div class="gp-traybox"><div class="gp-hint"><span class="gp-seg" id="gp-seg" role="group" aria-label="Print size for new work"></span><span id="gp-cost"></span></div><div class="gp-tray" id="gp-tray"></div></div>';
  document.body.appendChild(el); PL.float=gEl("div","gp-float",'<span class="gp-tag"></span>'); document.body.appendChild(PL.float);
  $g("gp-back").onclick=plClose; $g("gp-even").onclick=plSpace; $g("gp-zi").onclick=function(){ plZoom(1); }; $g("gp-zo").onclick=function(){ plZoom(-1); };
  var wall=$g("gp-wall"); wall.addEventListener("pointerdown", plDownWork);
  wall.addEventListener("click", function(e){ if(PL.justDragged||e.target.closest(".gp-work")) return; PL.sel=null; PL.gaps=false; plPanel(); });
  var tray=$g("gp-tray"); tray.addEventListener("pointerdown", plDownTray);
  tray.addEventListener("keydown", function(e){ var c=e.target.closest(".gp-ph"); if(c&&(e.key==="Enter"||e.key===" ")){ e.preventDefault(); plQuickHang(c.dataset.pid); } });
  addEventListener("resize", function(){ if(PL.face) plLayout(); }); }

function plOpen(o){ var f=galFace(o&&o.face); if(!f){ galGo("floor"); return; } plBuild();
  PL.face=f.id; PL.sel=null; PL.gaps=false; PL.z=0; PL.drag=null; PL.els={}; Array.prototype.slice.call($g("gp-wall").querySelectorAll(".gp-work")).forEach(function(e){ e.remove(); });
  if(!PL.held){ PL.held=true; gHold++; document.addEventListener("keydown", plKey); }
  PL.el.classList.add("on"); $g("gp-stage").scrollLeft=0; plSeg(); plTray(); plPanel(); plAsp(); galHud(); }

function plClose(){ if(!PL.el) return; plEndDrag(); PL.el.classList.remove("on");
  if(PL.held){ PL.held=false; gHold--; document.removeEventListener("keydown", plKey); }
  PL.face=null; PL.sel=null; galSave(); roomRefresh(); galGo("floor"); }

/* the photos' real shapes, so prints draw at their true size before the room has loaded their textures */
function plAsp(){ PH.forEach(function(p){ if(p._aspOk) return; var im=new Image(); im.onload=function(){ p._aspOk=1;
  if(im.naturalWidth&&im.naturalHeight){ var a=im.naturalWidth/im.naturalHeight; if(Math.abs(a-p.asp)>0.01){ p.asp=a; if(PL.face) plDraw(); } } }; im.src=p.url; }); }

/* scale the wall to fit (a long wall on a phone keeps a usable scale and scrolls sideways), then the ruler and line */
function plLayout(){ var f=plFace(); if(!f||!PL.el) return; PL.el.style.setProperty("--gp-top", Math.round(hud.getBoundingClientRect().bottom+6)+"px");
  var st=$g("gp-stage"), pad=innerWidth<560?16:32, aw=st.clientWidth-pad*2, ah=st.clientHeight-40-56, fh=ah/f.h;
  var k=Math.min(aw/f.len, fh); if(k<PL_KMIN) k=Math.min(PL_KMIN, fh); var k0=Math.max(10, Math.min(160, k)), kmax=Math.max(k0, Math.min(160, fh));
  PL.z=Math.max(0, Math.min(PL.z, PL_ZOOM.length-1)); while(PL.z>0&&k0*PL_ZOOM[PL.z-1]>=kmax) PL.z--; k=PL.k=Math.min(kmax, k0*PL_ZOOM[PL.z]);
  $g("gp-zo").disabled=PL.z===0; $g("gp-zi").disabled=PL.z>=PL_ZOOM.length-1||k>=kmax-0.5; $g("gp-zi").parentNode.style.display=$g("gp-zo").disabled&&$g("gp-zi").disabled?"none":"";
  var s=siteById(G.site)||{wall:0xe9e6df, floor:0x55524d}, W=f.len*k+"px";
  $g("gp-wrap").style.padding="40px "+pad+"px 10px"; var wall=$g("gp-wall"); wall.style.width=W; wall.style.height=f.h*k+"px"; wall.style.background=plHex(s.wall);
  var fl=$g("gp-floor"); fl.style.width=W; fl.style.background=plHex(s.floor); $g("gp-line").style.bottom=PL_LINE*k+"px";
  var step=k>=30?1:2, html="";
  for(var m=0;m<=f.len+1e-6;m+=k>=70?0.5:1){ var mj=Math.abs(m-Math.round(m))<1e-6&&Math.round(m)%step===0;
    html+='<i class="gp-tick'+(mj?" mj":"")+'" style="left:'+(m*k)+'px">'+(mj?"<b>"+(m===0?"0":Math.round(m)+" m")+"</b>":"")+'</i>'; }
  if(Math.abs(f.len-Math.round(f.len))>0.05) html+='<i class="gp-tick mj" style="left:'+(f.len*k)+'px"><b>'+(Math.round(f.len*10)/10)+' m</b></i>';
  var ru=$g("gp-ruler"); ru.style.width=W; ru.innerHTML=html;
  $g("gp-name").textContent=f.name; plDraw(); }

/* zoom in or out, keeping the selected work (or the middle of the view) where it was */
function plZoom(dz){ var st=$g("gp-stage"), it=PL.sel&&galItem(PL.sel), wall=$g("gp-wall"), wx=wall.offsetLeft+$g("gp-wrap").offsetLeft;
  var m=it?it.x:(st.scrollLeft+st.clientWidth/2-wx)/PL.k; PL.z+=dz; plLayout(); wx=wall.offsetLeft+$g("gp-wrap").offsetLeft; st.scrollLeft=wx+m*PL.k-st.clientWidth/2; }
/* place every work on this wall (elements are kept, so dragging stays smooth), the drop ghost and the gaps */
function plPos(e, x, y, sz){ var k=PL.k; e.style.left=(x-sz[0]/2)*k+"px"; e.style.bottom=(y-sz[1]/2)*k+"px"; e.style.width=sz[0]*k+"px"; e.style.height=sz[1]*k+"px"; e.style.setProperty("--fw", Math.max(2, 0.025*k)+"px"); }
function plDraw(){ var f=plFace(); if(!f) return; var wall=$g("gp-wall"), its=plItems(), seen={}, d=PL.drag;
  its.forEach(function(it){ var e=PL.els[it.id], p=phById(it.pid); seen[it.id]=1;
    if(!e){ e=PL.els[it.id]=gEl("div","gp-work",'<i class="gp-dot"></i>'); e.dataset.id=it.id; if(p) e.style.backgroundImage='url("'+p.url+'")'; wall.appendChild(e); }
    plPos(e, it.x, it.y, itemSize(it)); e.classList.toggle("sel", PL.sel===it.id); e.classList.toggle("sold", !!it.sold); e.classList.toggle("drag", !!(d&&d.id===it.id&&d.moved));
    e.title=(p?p.name:"Print")+(it.sold?", sold":", "+gMoney(it.price)); });
  Object.keys(PL.els).forEach(function(id){ if(!seen[id]){ PL.els[id].remove(); delete PL.els[id]; } });
  var g=PL.ghost; if(d&&!d.id&&d.moved&&d.at){ var p=phById(d.pid);
    if(!g){ g=PL.ghost=gEl("div","gp-work ghost",'<span class="gp-tag"></span>'); } if(g.parentNode!==wall) wall.appendChild(g);
    if(g.dataset.pid!==d.pid){ g.dataset.pid=d.pid; g.style.backgroundImage=p?'url("'+p.url+'")':""; }
    plPos(g, d.at.x, d.at.y, itemSize({pid:d.pid, size:d.size})); g.firstChild.textContent=PRINT[d.size].name+" print · "+gMoney(PRINT[d.size].cost); }
  else if(g&&g.parentNode) g.remove();
  plGaps(); var n=its.length, sold=its.filter(function(it){ return it.sold; }).length;
  $g("gp-sub").textContent=(Math.round(f.len*10)/10)+" m long · "+(Math.round(f.h*10)/10)+" m high · "+(n?n+(n===1?" work":" works")+(sold?", "+sold+" sold":""):"empty");
  $g("gp-even").disabled=n-sold<1; }

/* gap labels in cm: around the work you're dragging, or along the whole wall after Space evenly */
function plGaps(){ var lay=$g("gp-gaps"), f=plFace(), d=PL.drag, focus=null, bx=plItems().map(function(it){ var s=itemSize(it); return {id:it.id, x:it.x, y:it.y, w:s[0], h:s[1]}; });
  if(d&&d.moved){ if(d.id) focus=d.id; else if(d.at){ var s=itemSize({pid:d.pid, size:d.size}); bx.push({id:"_new", x:d.at.x, y:d.at.y, w:s[0], h:s[1]}); focus="_new"; } }
  if(!focus&&!PL.gaps){ lay.innerHTML=""; return; } var html="";
  bx.forEach(function(a){ if(focus&&a.id!==focus) return; var L=null, R=null, l=a.x-a.w/2, r=a.x+a.w/2;
    bx.forEach(function(b){ if(b===a||Math.abs(a.y-b.y)>=(a.h+b.h)/2) return; var bl=b.x-b.w/2, br=b.x+b.w/2;
      if(br<=l+1e-6&&(L==null||br>L)) L=br; if(bl>=r-1e-6&&(R==null||bl<R)) R=bl; });
    if(focus||L==null) html+=plGap(L==null?0:L, l, a.y, L==null); html+=plGap(r, R==null?f.len:R, a.y, R==null); });
  lay.innerHTML=html; }
function plGap(x1, x2, y, end){ var cm=plCm(x2-x1); if(cm<1) return ""; var k=PL.k;
  return '<div class="gp-gap'+(end?" end":"")+'" style="left:'+x1*k+'px;width:'+(x2-x1)*k+'px;bottom:'+y*k+'px"><b>'+cm+' cm</b></div>'; }

// ---------- the tray and the print size for new work ----------
function plSeg(){ var sg=$g("gp-seg"); sg.innerHTML=["s","m","l"].map(function(s){ return '<button data-s="'+s+'" class="'+(PL.size===s?"on":"")+'" aria-pressed="'+(PL.size===s)+'">'+PRINT[s].name+'</button>'; }).join("");
  sg.querySelectorAll("button").forEach(function(b){ b.onclick=function(){ PL.size=b.dataset.s; plSeg(); }; });
  $g("gp-cost").innerHTML=PRINT[PL.size].name+" print: <b>"+gMoney(PRINT[PL.size].cost)+"</b><span class=\"long\">. Drag a photo onto the wall, or tap it to hang it in the biggest gap.</span>"; }
function plTray(){ var on={}; plItems().forEach(function(it){ on[it.pid]=1; });
  $g("gp-tray").innerHTML=PH.map(function(p){ return '<div class="gp-ph" tabindex="0" role="button" data-pid="'+gEsc(p.id)+'" aria-label="Hang '+gEsc(p.name)+'"><img src="'+gEsc(p.url)+'" alt="" draggable="false"><span>'+gEsc(p.name)+'</span>'+(on[p.id]?"<em>On this wall</em>":"<em>&nbsp;</em>")+'</div>'; }).join(""); }
function plDoHang(pid, size, at){ var it=galHang({pid:pid, face:PL.face, x:at.x, y:at.y, size:size}); PL.sel=plNarrow()?null:it.id;   /* on a phone the panel would cover the tray, so keep hanging */ PL.gaps=false; galHud(); plTray(); plPanel(); }
function plQuickHang(pid){ var s=itemSize({pid:pid, size:PL.size}), at=plFreeSpot(s[0], s[1]);
  if(at) plDoHang(pid, PL.size, at); else galToast("This wall is full at that size. Try a smaller print, or take one down.", "warn"); }

// ---------- dragging (pointer events: mouse, pen and touch) ----------
function plM(e){ var r=$g("gp-wall").getBoundingClientRect(); return {x:(e.clientX-r.left)/PL.k, y:(r.bottom-e.clientY)/PL.k, over:e.clientX>r.left-24&&e.clientX<r.right+24&&e.clientY>r.top-36&&e.clientY<r.bottom+44}; }
function plListen(on){ var f=on?"addEventListener":"removeEventListener"; window[f]("pointermove", plMove); window[f]("pointerup", plUp); window[f]("pointercancel", plUp); }
function plDownTray(e){ var c=e.target.closest(".gp-ph"); if(!c||e.button>0||PL.drag) return; PL.drag={pid:c.dataset.pid, size:PL.size, sx:e.clientX, sy:e.clientY, moved:false}; plListen(true); }
function plDownWork(e){ var c=e.target.closest(".gp-work"); if(!c||e.button>0||PL.drag||!c.dataset.id) return; var it=galItem(c.dataset.id); if(!it) return; e.preventDefault();
  var m=plM(e); PL.drag={id:it.id, dx:m.x-it.x, dy:m.y-it.y, sx:e.clientX, sy:e.clientY, moved:false, sold:!!it.sold}; plListen(true); }
function plMove(e){ var d=PL.drag; if(!d) return;
  if(!d.moved){ if(d.sold||Math.abs(e.clientX-d.sx)+Math.abs(e.clientY-d.sy)<6) return; d.moved=true; PL.gaps=false; }
  e.preventDefault(); plAutoScroll(e); var m=plM(e), s;
  if(d.id){ var it=galItem(d.id); if(!it) return; s=itemSize(it); var at=plPlace(it.id, m.x-d.dx, plSnapY(m.y-d.dy), s[0], s[1]); if(at){ it.x=at.x; it.y=at.y; } }
  else { s=itemSize({pid:d.pid, size:d.size}); d.over=m.over; d.at=m.over?plPlace(null, m.x, PL_LINE, s[0], s[1]):null; d.bad=m.over&&!d.at; plFloat(e, s); }
  plDraw(); }
function plUp(e){ var d=PL.drag; plEndDrag(); if(!d) return;
  if(d.id){ if(d.moved){ galSave(); PL.justDragged=true; setTimeout(function(){ PL.justDragged=false; }, 0); } PL.sel=d.id; plPanel(); return; }
  if(e.type!=="pointerup"){ plDraw(); return; }
  if(!d.moved) plQuickHang(d.pid);
  else if(d.at) plDoHang(d.pid, d.size, d.at);
  else if(d.bad) galToast("There's no room for that print there. Try a wider gap or a smaller size.", "warn");
  plDraw(); }
function plEndDrag(){ plListen(false); PL.drag=null; if(PL.float) PL.float.style.display="none"; }
/* the photo under your finger while it's off the wall (or can't fit), at true scale once it's over the wall */
function plFloat(e, s){ var fl=PL.float, d=PL.drag; if(!d||d.at){ fl.style.display="none"; return; } var p=phById(d.pid), k=PL.k, big=d.over;
  fl.style.display="block"; fl.style.left=e.clientX+"px"; fl.style.top=e.clientY+"px"; fl.style.width=Math.max(44, big?s[0]*k:90)+"px"; fl.style.height=Math.max(44*s[1]/s[0], big?s[1]*k:90*s[1]/s[0])+"px";
  if(fl.dataset.pid!==d.pid){ fl.dataset.pid=d.pid; fl.style.backgroundImage=p?'url("'+p.url+'")':""; }
  fl.classList.toggle("bad", !!d.bad); fl.firstChild.textContent=d.bad?"No room here":PRINT[d.size].name+" print · "+gMoney(PRINT[d.size].cost); }
function plAutoScroll(e){ var st=$g("gp-stage"), r=st.getBoundingClientRect(); if(st.scrollWidth<=st.clientWidth+1||e.clientY<r.top||e.clientY>r.bottom) return;
  if(e.clientX<r.left+40) st.scrollLeft-=14; else if(e.clientX>r.right-40) st.scrollLeft+=14; }
function plKey(e){ if(!PL.face) return; if(e.key==="Escape"){ e.preventDefault(); if(PL.drag){ plEndDrag(); plDraw(); } else plClose(); return; }
  if(/input|textarea/i.test(e.target.tagName||"")) return; var it=PL.sel&&galItem(PL.sel), dx=e.key==="ArrowLeft"?-1:e.key==="ArrowRight"?1:0; if(!it||it.sold||!dx) return;
  e.preventDefault(); var s=itemSize(it), at=plPlace(it.id, it.x+dx*(e.shiftKey?0.01:0.05), it.y, s[0], s[1]); if(at){ it.x=at.x; it.y=at.y; galSave(); } plDraw(); }   /* arrows nudge 5 cm, shift 1 cm */

// ---------- Space evenly: equal gaps between the works (sold work stays where it is) ----------
function plSpace(){ var f=plFace(), its=plItems(), keep=its.map(function(it){ return [it, it.x, it.y]; }), byX=function(a,b){ return a.x-b.x; };
  var sold=its.filter(function(it){ return it.sold; }).sort(byX), free=its.filter(function(it){ return !it.sold; }).sort(byX); if(!free.length) return;
  var cuts=[0]; sold.forEach(function(it){ var w=itemSize(it)[0]; cuts.push(it.x-w/2, it.x+w/2); }); cuts.push(f.len);
  var segs=[], ok=true; for(var i=0;i<cuts.length;i+=2) segs.push({a:cuts[i], b:cuts[i+1], w:[]});
  free.forEach(function(it){ var best=segs[0], bd=1e9; segs.forEach(function(sg){ var dd=it.x<sg.a?sg.a-it.x:it.x>sg.b?it.x-sg.b:0; if(dd<bd){ bd=dd; best=sg; } }); best.w.push(it); });
  segs.forEach(function(sg){ if(!sg.w.length) return; var tot=sg.w.reduce(function(a,it){ return a+itemSize(it)[0]; }, 0), gap=(sg.b-sg.a-tot)/(sg.w.length+1); if(gap<PL_GAP-1e-6){ ok=false; return; }
    var x=sg.a+gap; sg.w.forEach(function(it){ var w=itemSize(it)[0]; it.x=x+w/2; it.y=PL_LINE; x+=w+gap; }); });
  if(ok) ok=its.every(function(it){ var s=itemSize(it); return plFits(it.id, it.x, it.y, s[0], s[1]); });
  if(!ok){ keep.forEach(function(r){ r[0].x=r[1]; r[0].y=r[2]; }); galToast("These works won't all fit in one row. Try smaller prints, or take one down.", "warn"); plDraw(); return; }
  PL.gaps=true; galSave(); plDraw(); }

// ---------- the side panel: the selected work, or hanging tips ----------
function plPanel(){ var side=$g("gp-side"), it=PL.sel?galItem(PL.sel):null; if(it&&it.face!==PL.face) it=null; if(!it) PL.sel=null; side.classList.toggle("empty", !it); PL.el.classList.toggle("has-sel", !!it);
  if(!it){ side.innerHTML='<p class="gp-k">Hanging tips</p><h3>Eye level is 145 cm</h3><p>Galleries hang work so the middle of each piece sits 145 cm off the floor, about where most people\'s eyes land. Your prints snap to that line.</p>'+
      '<p>Even gaps help a wall feel calm. Drag works along the wall and watch the gaps in centimetres, or try Space evenly.</p><p class="gp-note">Tap a work on the wall to set its print size and price.</p>'; plLayout(); return; }
  var p=phById(it.pid), sz=itemSize(it), P=PRINT[it.size], f=plFace(), h='<button class="gp-done" id="gp-done">Done</button><p class="gp-k">On the '+gEsc(f.name.toLowerCase())+', '+(Math.round(it.x*10)/10)+' m along</p>'+
    '<div class="gp-sw">'+(p?'<img src="'+gEsc(p.url)+'" alt="">':'')+'<div><h3>'+gEsc(p?p.name:"Print")+'</h3><small>'+P.name+' print · '+plCm(sz[0])+' × '+plCm(sz[1])+' cm</small></div></div>';
  if(it.sold) h+='<p class="gp-sold"><i></i>Sold for '+gMoney(it.soldFor||it.price)+'</p><p class="gp-note">Sold work stays on the wall until the show comes down, so visitors can see the red dot.</p>';
  else h+='<p class="gp-k">Print size</p><div class="gp-sizes">'+["s","m","l"].map(function(s){ var dd=PRINT[s].cost-P.cost;
      return '<button data-s="'+s+'" class="'+(s===it.size?"on":"")+'" aria-pressed="'+(s===it.size)+'"><b>'+PRINT[s].name+'</b><small>'+plCm(PRINT[s].long)+' cm</small><em>'+(s===it.size?"Current":dd>0?"+"+gMoney(dd):"No charge")+'</em></button>'; }).join("")+'</div>'+
    '<p class="gp-k">Price</p><div class="gp-price"><button data-d="-1" aria-label="Lower the price">−</button><label>$<input id="gp-pr" type="number" inputmode="numeric" min="0" step="10" value="'+Math.round(it.price)+'" aria-label="Price in dollars"></label><button data-d="1" aria-label="Raise the price">+</button></div>'+
    '<p class="gp-note">Collectors think this is worth about <b>'+gMoney(plRound(itemWorth(it)))+'</b>. Price it well above that and it may wait a while for a buyer.</p>'+
    '<button class="gp-btn gp-down" id="gp-down">Take it down</button>';
  side.innerHTML=h; $g("gp-done").onclick=function(){ PL.sel=null; plPanel(); };
  if(!it.sold){ side.querySelectorAll(".gp-sizes button").forEach(function(b){ b.onclick=function(){ plResize(it, b.dataset.s); }; });
    var inp=$g("gp-pr"); inp.oninput=function(){ var v=Math.round(+inp.value); if(isFinite(v)&&inp.value!==""){ it.price=Math.max(0,v); galSave(); plDraw(); } };
    inp.onchange=function(){ inp.value=Math.round(it.price); };
    side.querySelectorAll(".gp-price button").forEach(function(b){ b.onclick=function(){ it.price=Math.max(0, Math.round(it.price/10)*10+(+b.dataset.d)*10); inp.value=it.price; galSave(); plDraw(); }; });
    $g("gp-down").onclick=function(){ galUnhang(it.id); PL.sel=null; galHud(); plTray(); plPanel(); }; }
  plLayout(); }

/* a bigger or smaller print: stays where it is if it fits, or slides to the nearest gap; going up pays the difference in printing
   (going down is free, with no refund); a price left at the old suggestion follows the new one */
function plResize(it, size){ if(it.sold||it.size===size) return; var old=it.size, oldSug=Math.round(itemWorth(it)/10)*10; it.size=size; var s=itemSize(it), at=plPlace(it.id, it.x, it.y, s[0], s[1]);
  if(!at){ it.size=old; galToast("A "+PRINT[size].name.toLowerCase()+" print won't fit there. Make a bit of room first.", "warn"); return; }
  it.x=at.x; it.y=at.y; var dd=PRINT[size].cost-PRINT[old].cost; if(dd>0) G.cash-=dd;
  if(Math.round(it.price)===oldSug) it.price=Math.round(itemWorth(it)/10)*10;
  galSave(); galHud(); plPanel(); }

GSCR.plan={open:plOpen, close:plClose};
