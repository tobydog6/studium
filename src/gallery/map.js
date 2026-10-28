// ================= GALLERY MAP: the city as a little 3D diorama, like the Sims world map (Sam: "you can see a pop up view and then if you want go into it") =================
// Its own three.js renderer on its own canvas: a green island with the Wairere River, Tōtara Park, the street grid and Rata Hill,
// the four SITES as outlined lots with their buildings, and a few landmarks. Drag to pan, wheel or pinch to zoom; HTML pins ride
// above the lots. Tap a lot or pin for a white Sims-style card; "Go inside" hides the map and builds the bare room in 3D (roomBuild
// preview); "Sign the lease" calls galSignLease. The clock is held (gHold) while the map or a preview is up. The map only draws
// when something changes (and the room is blanked with roomBuild(null) underneath), so school laptops stay cool.
// Two moods: day (default) and golden hour (?mapstyle=golden).
var MAP_MOOD=(function(){ var q=location.search; try{ if(BR) q+="&"+parent.location.search; }catch(e){} var m=/[?&]mapstyle=(\w+)/.exec(q); return m&&m[1]==="golden"?"golden":"day"; })();
var MOODS={
  day:{bg:0xbfe3f2, sea:0x5fc2dc, sun:0xfff4e2, sunI:2.3, sunDir:[-0.5,0.8,0.32], sky:0xd6ecff, gnd:0x6f8f50, hemiI:1.15, exp:1.0},
  golden:{bg:0xf3cfa6, sea:0x86cad6, sun:0xffbe78, sunI:2.5, sunDir:[-0.84,0.36,0.22], sky:0xffe6c8, gnd:0x8c8a62, hemiI:1.3, exp:1.18}};
var MAP_S=0.55;   /* metres of a site's rect to diorama units */
/* where each site's lot sits (front of the building faces +z after turning by r), and what kind of place it is */
var MAP_LOT={warehouse:{x:25, z:39, r:0, type:"Industrial"}, shopfront:{x:15, z:19, r:-Math.PI/4, type:"Retail"},
  villa:{x:40, z:-29.5, r:0.12, type:"Heritage villa"}, popup:{x:-13, z:-0.5, r:0.22, type:"Market unit"}};
var MAP_LM=[
  {id:"cafe", name:"Kōwhai Café", type:"Café · High Street", x:35, z:29, icon:"cup", h:3.2, k:6, blurb:"Good coffee and the best people-watching in town. Gallery-goers drop in after a show."},
  {id:"school", name:"The art school", type:"School · Harakeke Street", x:-15, z:29, icon:"school", h:5, k:9, blurb:"Where a lot of your visitors learnt to look. Students come to every opening they can."},
  {id:"library", name:"City library", type:"Library · Tui Street", x:-5, z:9, icon:"book", h:4.4, k:8, blurb:"Quiet, free and full of photobooks. A good place to find your next idea."},
  {id:"rotunda", name:"Park rotunda", type:"Landmark · Tōtara Park", x:-34, z:22, icon:"note", h:3.6, k:6, blurb:"Bands play here on summer Sundays, and half the city wanders past."}];
var MAP_ICON={
  frame:'<rect x="4" y="5" width="16" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7 16.5l3.5-4.2 2.6 3 2-2.2 2.4 3.4z" fill="currentColor"/>',
  cup:'<path d="M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 10.5h1.5a2 2 0 0 1 0 4H16" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  school:'<path d="M3 9.5l9-4.5 9 4.5-9 4.5z M7 11.5v4c3 2.2 7 2.2 10 0v-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
  book:'<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
  note:'<path d="M9 17V6.5l10-2.2V15" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="6.8" cy="17" r="2.6" fill="currentColor"/><circle cx="16.8" cy="15" r="2.6" fill="currentColor"/>'};
var MAP_TRAFFIC=["Hardly anyone","A trickle","Steady","Busy","Bustling"];

gCSS(
  ".gm{position:fixed;inset:0;z-index:7;display:flex;flex-direction:column;background:var(--bg);color:var(--text);font-family:var(--body)}.gm[hidden]{display:none}"+
  ".gm-top{display:flex;align-items:center;gap:12px;padding:14px 16px 10px;flex-wrap:wrap;background:var(--bg);border-bottom:1px solid var(--line);position:relative;z-index:2}"+
  ".gm-top h2{margin:0;font:600 24px/1.1 var(--display);letter-spacing:-.01em}"+
  ".gm-top p{margin:0;color:var(--dim);font-size:14.5px;flex:1 1 260px;min-width:0}.gm-top p b{color:var(--gold);font-weight:600}"+
  ".gm-cash{font:500 14px var(--mono);background:#1f1c16;border-radius:10px;padding:7px 11px;white-space:nowrap}.gm-cash small{font:500 10px var(--mono);letter-spacing:.12em;color:var(--dim);margin-right:6px}"+
  ".gm-x{border:0;background:#2b2820;color:var(--text);width:36px;height:36px;border-radius:50%;font:500 20px/1 var(--body);cursor:pointer;flex:none}"+
  ".gm-view{position:relative;flex:1;min-height:0;overflow:hidden;touch-action:none}"+
  ".gm-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab}.gm-view canvas.hov{cursor:pointer}.gm-view canvas.drag{cursor:grabbing}"+
  ".gm-pins{position:absolute;inset:0;pointer-events:none;z-index:1}"+
  ".gm-pin{position:absolute;left:0;top:0;border:0;background:none;padding:0;cursor:pointer;pointer-events:auto;display:flex;flex-direction:column;align-items:center;font-family:var(--body);will-change:transform}"+
  ".gm-pin svg.tp{width:42px;height:52px;overflow:visible;filter:drop-shadow(0 4px 5px rgba(20,40,60,.35));transition:transform .15s}.gm-pin:hover svg.tp,.gm-pin.on svg.tp{transform:translateY(-4px) scale(1.12)}"+
  ".gm-pin .ic{position:absolute;top:7px;left:50%;width:24px;height:24px;margin-left:-12px;color:#2a7bd4;pointer-events:none;transition:transform .15s}.gm-pin:hover .ic,.gm-pin.on .ic{transform:translateY(-4px) scale(1.12)}"+
  ".gm-pin.here .ic{color:#c98a1c}"+
  ".gm-pin .tag{margin-top:2px;white-space:nowrap;font:700 12px var(--body);padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.94);color:#1d2a38;box-shadow:0 2px 6px rgba(20,40,60,.25)}"+
  ".gm-pin.here .tag{background:var(--gold);color:#17140d}"+
  ".gm-pin.lm .bd{width:30px;height:30px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 3px 6px rgba(20,40,60,.35);color:#4d6a86;transition:transform .15s}.gm-pin.lm .bd svg{width:18px;height:18px}"+
  ".gm-pin.lm:hover .bd,.gm-pin.lm.on .bd{transform:scale(1.15)}"+
  ".gm-pin:focus-visible{outline:none}.gm-pin:focus-visible svg.tp,.gm-pin:focus-visible .bd{outline:3px solid #47d6ff;outline-offset:2px;border-radius:50%}"+
  ".gm-hint{position:absolute;z-index:2;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(20,18,14,.78);border-radius:999px;padding:7px 14px;font-size:13px;color:#e9e4d8;pointer-events:none;white-space:nowrap;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis}"+
  ".gm-card{position:fixed;z-index:10;width:300px;background:#fff;color:#1d2733;border-radius:16px;padding:14px 16px 14px;box-shadow:0 18px 50px rgba(15,30,45,.35),0 2px 6px rgba(15,30,45,.2);animation:gmin .18s ease-out;font-family:var(--body)}"+
  "@keyframes gmin{from{opacity:0;transform:scale(.96)}}"+
  ".gm-card .tail{position:absolute;width:16px;height:16px;background:#fff;transform:rotate(45deg);top:var(--ty,40px);margin-top:-8px}.gm-card.r .tail{left:-7px}.gm-card.l .tail{right:-7px}"+
  ".gm-card .nm{margin:0 30px 0 0;font:700 21px/1.15 var(--body);font-variant:small-caps;letter-spacing:.03em;color:#1f6fd1}"+
  ".gm-card .ty{font:500 12.5px var(--body);color:#6a7480;margin-top:2px}"+
  ".gm-card .th{display:block;width:100%;aspect-ratio:268/128;object-fit:cover;border-radius:10px;margin:10px 0 0;background:#dfeee6}"+
  ".gm-card p{margin:10px 0 10px;font-size:13.5px;line-height:1.45;color:#2b3540}"+
  ".gm-card .cx{position:absolute;top:8px;right:8px;border:0;background:#eef2f6;color:#4d5966;font:400 20px/1 var(--body);width:30px;height:30px;cursor:pointer;border-radius:50%}"+
  ".gm-facts{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;margin:0 0 12px;align-items:center}"+
  ".gm-facts dt{font:600 10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:#7b8590}.gm-facts dd{margin:0;font:600 14px var(--body);font-variant-numeric:tabular-nums;color:#1d2733}"+
  ".gm-meter{display:inline-flex;gap:3px;vertical-align:middle;margin-right:8px}.gm-meter i{width:14px;height:8px;border-radius:2px;background:#d9e1e8}.gm-meter i.on{background:#2fb36b}"+
  ".gm-meter+span{font:500 12px var(--body);color:#6a7480}"+
  ".gm-acts{display:flex;gap:8px;flex-wrap:wrap}.gm-card .gbtn{flex:1 1 auto;padding:10px 14px;background:#e9eef3;color:#1d2733;backdrop-filter:none}.gm-card .gbtn.gold{background:var(--gold);color:#17140d}"+
  ".gm-card .gbtn:focus-visible{outline:2px solid #1f6fd1}"+
  ".gm-why{margin:8px 0 0;font-size:12.5px;color:#c2411c}"+
  ".gm-here{display:inline-block;background:var(--gold);color:#17140d;border-radius:999px;padding:8px 14px;font:600 13.5px var(--body)}"+
  ".gm-ok{margin:0 0 10px;padding:10px 12px;border-radius:10px;background:#fff1e8;border:1px solid #f3b796;font-size:13.5px;line-height:1.4;color:#5a2a12}"+
  ".gm-pv{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:7;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px);background:rgba(20,18,14,.9);backdrop-filter:blur(8px);border-radius:18px;padding:8px}"+
  ".gm-pv[hidden],.gm-pvh[hidden]{display:none}.gm-pv .nm{font:600 16px var(--display);padding:0 8px 0 6px}.gm-pv .nm small{display:block;font:500 10px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}"+
  ".gm-pv .gbtn{background:#2b2820}.gm-pv .gbtn.gold{background:var(--gold)}.gm-pv .gm-ok{flex-basis:100%;margin:0 0 2px;background:rgba(228,85,46,.14);border-color:rgba(228,85,46,.5);color:var(--text)}"+
  ".gm-pvh{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:6;background:rgba(20,18,14,.82);border-radius:999px;padding:7px 14px;font-size:13px;color:var(--dim);pointer-events:none;white-space:nowrap;max-width:calc(100vw - 24px);overflow:hidden;text-overflow:ellipsis}"+
  "@media (max-width:640px){.gm-top{padding:12px 12px 8px;gap:8px}.gm-top h2{font-size:20px}.gm-top p{font-size:13.5px;order:3;flex-basis:100%}"+
  ".gm-card{left:10px!important;right:10px;top:auto!important;bottom:10px;width:auto;max-height:74vh;overflow:auto;padding:12px 14px}.gm-card .tail{display:none}.gm-card .th{aspect-ratio:268/100}"+
  ".gm-pvh{top:96px}.gm-pv{left:12px;right:12px;transform:none;max-width:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px}.gm-pv .nm{grid-column:1/-1;padding:0 4px}.gm-pv .gbtn{padding:11px 8px}.gm-pv .gm-ok{grid-column:1/-1}"+
  ".gm-pin svg.tp{width:36px;height:45px}.gm-pin .ic{top:6px;width:21px;height:21px;margin-left:-10.5px}.gm-pin .tag{font-size:11px;padding:2px 7px}}"+
  "@media (prefers-reduced-motion:reduce){.gm-card{animation:none}.gm-pin svg.tp,.gm-pin .ic,.gm-pin .bd{transition:none}}");

var MAP={el:null, card:null, pv:null, pvh:null, open:false, first:false, sel:null, hover:null, previewing:null, gl:null, run:false, dirty:true, thumbs:{}, pins:[]};

// ---------- building the diorama: unit shapes, merged into one mesh per colour so the whole city is a few dozen draws ----------
var MG=null;   /* unit geometries, made once */
function mapUnits(){ if(MG) return MG; var T=THREE;
  function prism(pts){ var s=new T.Shape(); s.moveTo(pts[0],pts[1]); for(var i=2;i<pts.length;i+=2) s.lineTo(pts[i],pts[i+1]); var g=new T.ExtrudeGeometry(s,{depth:1, bevelEnabled:false}); g.translate(0,0,-0.5); return g; }
  return (MG={box:new T.BoxGeometry(1,1,1).translate(0,0.5,0), gable:prism([-0.5,0, 0.5,0, 0,1]), tooth:prism([0,0, 1,0, 0,1]),
    hip:new T.ConeGeometry(Math.SQRT1_2,1,4).rotateY(Math.PI/4).translate(0,0.5,0), cyl:new T.CylinderGeometry(0.5,0.5,1,8).translate(0,0.5,0),
    cone:new T.ConeGeometry(0.5,1,8).translate(0,0.5,0), oct:new T.CylinderGeometry(0.5,0.5,1,8).translate(0,0.5,0)}); }
var MB={};   /* colour (+ "f" for flat things that cast no shadow) -> transformed geometries waiting to merge */
var _m4=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _v=new THREE.Vector3(), _s=new THREE.Vector3();
function mPut(geo, mat, col, flat){ var g=geo.clone().applyMatrix4(mat); if(g.index) g=g.toNonIndexed(); var k=col+(flat?"|f":""); (MB[k]=MB[k]||[]).push(g); }
/* a frame: a lot's place on the island */
function mF(x,z,r){ return new THREE.Matrix4().makeRotationY(r||0).setPosition(x,0,z); }
function mAt(F, x,y,z, w,h,d, ry, rx){ _e.set(rx||0, ry||0, 0); _q.setFromEuler(_e); _m4.compose(_v.set(x,y,z), _q, _s.set(w,h,d)); return new THREE.Matrix4().multiplyMatrices(F,_m4); }
function mBox(F, w,h,d, col, x,y,z, ry, rx){ mPut(mapUnits().box, mAt(F,x,y,z,w,h,d,ry,rx), col); }
function mGable(F, w,h,d, col, x,y,z, ry){ mPut(mapUnits().gable, mAt(F,x,y,z,w,h,d,ry), col); }
function mHip(F, w,h,d, col, x,y,z, ry){ mPut(mapUnits().hip, mAt(F,x,y,z,w,h,d,ry), col); }
function mCyl(F, r,h, col, x,y,z){ mPut(mapUnits().cyl, mAt(F,x,y,z,r*2,h,r*2), col); }
function mCone(F, r,h, col, x,y,z){ mPut(mapUnits().cone, mAt(F,x,y,z,r*2,h,r*2), col); }
function mFlush(sc, mats){ Object.keys(MB).forEach(function(k){ var list=MB[k], n=0, o=0; list.forEach(function(g){ n+=g.attributes.position.count; });
    var P=new Float32Array(n*3), N=new Float32Array(n*3); list.forEach(function(g){ P.set(g.attributes.position.array,o); N.set(g.attributes.normal.array,o); o+=g.attributes.position.count*3; g.dispose(); });
    var geo=new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(P,3)); geo.setAttribute("normal", new THREE.BufferAttribute(N,3)); geo.computeBoundingSphere();
    var flat=k.slice(-2)==="|f", m=new THREE.Mesh(geo, mats(flat?k.slice(0,-2):k)); m.castShadow=!flat; m.receiveShadow=true; sc.add(m); }); MB={}; }
/* a flat ribbon along points [[x,z],...] (a road, the river), y up; ys optional per point */
function mRibbon(pts, w, col, y, ys){ var n=pts.length, P=[], N=[], i;
  for(i=0;i<n;i++){ var a=pts[Math.max(0,i-1)], b=pts[Math.min(n-1,i+1)], tx=b[0]-a[0], tz=b[1]-a[1], L=Math.hypot(tx,tz)||1, nx=-tz/L*w/2, nz=tx/L*w/2, yy=ys?ys[i]:y;
    P.push(pts[i][0]+nx, yy, pts[i][1]+nz, pts[i][0]-nx, yy, pts[i][1]-nz); }
  var pos=[], nor=[]; for(i=0;i<n-1;i++){ var q=[i*2, i*2+2, i*2+1, i*2+1, i*2+2, i*2+3]; q.forEach(function(j){ pos.push(P[j*3],P[j*3+1],P[j*3+2]); nor.push(0,1,0); }); }
  var g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor,3));
  var k=col+"|f"; (MB[k]=MB[k]||[]).push(g); }
function mCurve(ctrl, step){ var c=new THREE.CatmullRomCurve3(ctrl.map(function(p){ return new THREE.Vector3(p[0],0,p[1]); })), n=Math.max(2,Math.round(c.getLength()/(step||1)));
  return c.getSpacedPoints(n).map(function(v){ return [v.x, v.z]; }); }
function mDistSeg(px,pz, a,b){ var dx=b[0]-a[0], dz=b[1]-a[1], L=dx*dx+dz*dz, t=L?Math.max(0,Math.min(1,((px-a[0])*dx+(pz-a[1])*dz)/L)):0; return Math.hypot(px-a[0]-t*dx, pz-a[1]-t*dz); }
function mDist(px,pz, pts){ var d=1e9; for(var i=0;i<pts.length-1;i++) d=Math.min(d, mDistSeg(px,pz,pts[i],pts[i+1])); return d; }
function mFlatShape(pts, col, y){ var s=new THREE.Shape(); s.moveTo(pts[0][0], -pts[0][1]); for(var i=1;i<pts.length;i++) s.lineTo(pts[i][0], -pts[i][1]);
  var g=new THREE.ShapeGeometry(s, 6).rotateX(-Math.PI/2).translate(0,y,0); mPut(g, new THREE.Matrix4(), col, true); g.dispose(); }
function mRound(cx,cz, w,d, r, n){ var o=[]; for(var i=0;i<n;i++){ var a=i/n*Math.PI*2, c=Math.cos(a), s=Math.sin(a); o.push([cx+Math.sign(c)*Math.pow(Math.abs(c),r)*w/2, cz+Math.sign(s)*Math.pow(Math.abs(s),r)*d/2]); } return o; }
/* a seeded random, so the city is the same every time */
function mRand(seed){ var s=seed>>>0||1; return function(){ s^=s<<13; s^=s>>>17; s^=s<<5; return ((s>>>0)%100000)/100000; }; }

var MAP_RIVER_CTRL=[[-84,12],[-58,10],[-46,13],[-36,6],[-26,-4],[-14,-9],[-4,-12],[4,-19],[13,-23],[21,-15],[27,-6],[36,-5],[48,-11],[60,-10],[88,-6]];
/* the island's edge: a squarish blob */
function mapIsland(){ var o=[], n=72; for(var i=0;i<n;i++){ var a=i/n*Math.PI*2, c=Math.cos(a), s=Math.sin(a), p=3.2, wob=1+0.035*Math.sin(a*5+1)+0.025*Math.sin(a*9+2);
    o.push([6+Math.sign(c)*Math.pow(Math.abs(c),2/p)*67*wob, 5+Math.sign(s)*Math.pow(Math.abs(s),2/p)*53*wob]); } return o; }
function mInside(px,pz, poly){ var c=false; for(var i=0,j=poly.length-1;i<poly.length;j=i++){ var a=poly[i], b=poly[j]; if((a[1]>pz)!==(b[1]>pz)&&px<(b[0]-a[0])*(pz-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; }

/* each site's building, in its lot's frame (front faces +z) */
function mapSiteBuilding(id, F){
  if(id==="warehouse"){ mBox(F,9,3,5.8,"#b7c2c9",0,0,0); for(var i=0;i<4;i++){ mPut(mapUnits().tooth, mAt(F,-4.5+i*2.25,3,0,2.25,1.4,5.8), "#6d7a86"); mBox(F,0.08,1.25,5.6,"#9fd6f2",-4.46+i*2.25,3,0); }
    mBox(F,2.4,2.3,0.08,"#6f7b84",-1.6,0,2.92); mBox(F,1,2,0.08,"#2f3b45",2.2,0,2.92); mBox(F,3.6,0.5,0.08,"#1f2a33",1.6,2.4,2.93);
    mBox(F,1.2,0.3,1.2,"#b98f5a",3.6,0,3.9); mBox(F,1.2,0.3,1.2,"#b98f5a",3.6,0.3,3.9); mBox(F,1.2,0.3,1.2,"#b98f5a",-4,0,4); return 4.4; }
  if(id==="shopfront"){ mBox(F,4.6,4.6,3.2,"#ead3b0",0,0,0); mBox(F,4.8,0.45,3.4,"#cdb084",0,4.6,0); mBox(F,3.4,1.7,0.06,"#a9dcf0",-0.4,0.25,1.62); mBox(F,0.8,2,0.06,"#2f3b45",1.7,0,1.62);
    mBox(F,4.6,0.12,1.3,"#2a9d8f",0,2.25,2.2,0,0.28); mBox(F,3.8,0.42,0.06,"#1d1a15",0,2.6,1.62); for(var j=0;j<3;j++) mBox(F,0.75,1,0.06,"#a9dcf0",-1.4+j*1.4,3.2,1.62);
    mCyl(F,0.35,0.6,"#3f8f3a",2.6,0,2.3); return 5.1; }
  if(id==="villa"){ mBox(F,4.8,2.2,3.4,"#fbf7ee",0.3,0,-0.4); mHip(F,5.4,1.7,4.0,"#b8473a",0.3,2.2,-0.4); mBox(F,1.7,2,1,"#fbf7ee",-1.35,0,1.6); mHip(F,1.9,0.9,1.2,"#b8473a",-1.35,2,1.6);
    mBox(F,1.1,1.2,0.06,"#a9dcf0",-1.35,0.7,2.12); mBox(F,2.9,0.1,1.3,"#b8473a",1.3,2.05,1.95,0,0.16); for(var k=0;k<4;k++) mCyl(F,0.07,2.05,"#ffffff",0.05+k*0.85,0,2.5);
    mBox(F,2.9,0.18,1.3,"#d9cbb0",1.3,0,1.95); mBox(F,0.7,1.6,0.06,"#3a6ea5",1.3,0.2,1.32); mBox(F,0.4,1,0.4,"#9a5a44",2,3,-1.2);
    for(var p=-3.4;p<=3.4;p+=0.32){ if(Math.abs(p-1.3)<0.5) continue; mBox(F,0.08,0.55,0.08,"#ffffff",p,0,3.25); } mBox(F,6.8,0.06,0.06,"#ffffff",0,0.42,3.25);
    mBox(F,0.9,0.03,0.9,"#e8dcc0",1.3,0.02,2.95); return 4.2; }
  /* popup: a little yellow unit and three striped stalls */
  mBox(F,2.6,2.2,2,"#f2c75e",-0.6,0,-0.4); mBox(F,2.7,0.2,2.1,"#d9a93d",-0.6,2.2,-0.4); mBox(F,1.6,1.7,0.06,"#7a6a4a",-0.6,0,0.62);
  [["#e85d4a",-1.6,1.4],["#3c8fd6",0.3,1.6],["#f0a03c",1.6,0.4]].forEach(function(t){ mBox(F,1,0.8,0.7,"#c99e6a",t[1],0,t[2]); for(var q=0;q<4;q++) mCyl(F,0.04,1.5,"#ffffff",t[1]+(q%2?0.5:-0.5),0,t[2]+(q<2?0.35:-0.35)); mHip(F,1.4,0.6,1.1,t[0],t[1],1.5,t[2]); });
  return 3.2; }
function mapLandmark(lm){ var F=mF(lm.x, lm.z, 0);
  if(lm.id==="cafe"){ mBox(F,3.4,2.4,2.8,"#e07a5f",0,0,-0.6); mBox(F,3.6,0.2,3,"#f4e3c3",0,2.4,-0.6); mBox(F,2.4,1.2,0.06,"#a9dcf0",0,0.5,0.82); mBox(F,3.4,0.1,0.9,"#2f6f5f",0,1.9,1.2,0,0.3);
    [[-1.2,2.4],[0.4,2.6],[1.6,1.9]].forEach(function(u){ mCyl(F,0.05,1.4,"#ffffff",u[0],0,u[1]); mCone(F,0.8,0.45,"#f4f0e6",u[0],1.3,u[1]); mCyl(F,0.35,0.6,"#8a6a4a",u[0],0,u[1]); }); }
  else if(lm.id==="school"){ mBox(F,7,4,3.6,"#b85c4a",0,0,-1.6); mBox(F,3.2,4,5.6,"#b85c4a",-1.9,0,1.6); for(var i=0;i<3;i++) mPut(mapUnits().tooth, mAt(F,-3.5+i*2.33,4,-1.6,2.33,1.1,3.6), "#5b6670");
    for(var r=0;r<2;r++) for(var c=0;c<5;c++) mBox(F,0.7,0.9,0.06,"#a9dcf0",-3+c*1.5,0.8+r*1.7,0.22); mBox(F,3,0.2,5.6,"#7c3b2f",-1.9,4,1.6); mBox(F,1.6,0.6,0.6,"#f2c75e",2.2,0,1.2); }
  else if(lm.id==="library"){ mBox(F,6,3.2,3.6,"#ece5d3",0,0,-0.6); mBox(F,6.4,0.4,4,"#d8cfb7",0,3.2,-0.6); mBox(F,5,0.3,1.4,"#d8cfb7",0,0,1.8); for(var k=0;k<5;k++) mCyl(F,0.18,2.9,"#ffffff",-2+k,0.3,1.9);
    mGable(F,5.2,1,1.5,"#e3dac4",0,3.2,1.9,Math.PI/2); mBox(F,6.4,0.03,0.03,"#d8cfb7",0,3.2,2.6); }
  else { mCyl(F,1.8,0.35,"#f1ece0",0,0,0); for(var a=0;a<8;a++) mCyl(F,0.08,2.2,"#ffffff",Math.cos(a/8*Math.PI*2)*1.5,0.35,Math.sin(a/8*Math.PI*2)*1.5); mCone(F,2,1.3,"#5aa38f",0,2.5,0); mCyl(F,0.1,0.5,"#5aa38f",0,3.7,0); } }
function mHouse(F, rnd, x,z, w,d, ry){ var walls=["#f3ead8","#e9d4b6","#d9e4ea","#f1dccb","#cfdcc8","#e8c9a6","#f6efe2"], roofs=["#b5543c","#5f6e7d","#8a9aa6","#c46a4a","#4f6a5b"];
  var h=1.6+rnd()*0.8, wc=walls[(rnd()*walls.length)|0], rc=roofs[(rnd()*roofs.length)|0]; mBox(F,w,h,d,wc,x,0,z,ry); mGable(F,w+0.3,1+rnd()*0.5,d+0.3,rc,x,h,z,ry+(rnd()<0.5?0:Math.PI/2)); }
function mBlock(F, rnd, x,z, w,d, h){ var walls=["#efe6d3","#e5d2b8","#cfd9de","#e8cdb7","#d6d0c4","#f2e2c4","#c9d4c0","#e4b99c"];
  var wc=walls[(rnd()*walls.length)|0]; mBox(F,w,h,d,wc,x,0,z); mBox(F,w+0.2,0.25,d+0.2,"#bdb4a3",x,h,z); if(h>2.5) for(var y=1;y<h-0.6;y+=1.3) mBox(F,w*0.8,0.5,d+0.04,"#a9cfe0",x,y,z); }

/* the whole scene: returns {sc, lots:{id:{outline, glow, hit}}, lms:[{hit}], pins:[{kind,id,p}]} */
function mapScene(){ var T=THREE, sc=new T.Scene(), M=MOODS[MAP_MOOD], rnd=mRand(20261028), mats={}, out={sc:sc, lots:{}, hits:[], pins:[]}, I=new T.Matrix4();
  function mat(c){ return mats[c]||(mats[c]=new T.MeshLambertMaterial({color:c, flatShading:true})); }
  sc.background=new T.Color(M.bg); sc.fog=new T.Fog(M.bg, 170, 360);
  var hemi=new T.HemisphereLight(M.sky, M.gnd, M.hemiI); sc.add(hemi);
  var sun=new T.DirectionalLight(M.sun, M.sunI), sd=new T.Vector3().fromArray(M.sunDir).normalize(); sun.position.set(6+sd.x*130, sd.y*130, 5+sd.z*130); sun.target.position.set(6,0,5); sc.add(sun); sc.add(sun.target);
  sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); var sh=sun.shadow.camera; sh.left=-78; sh.right=78; sh.top=62; sh.bottom=-62; sh.near=20; sh.far=280; sun.shadow.bias=-0.0008; sun.shadow.normalBias=0.04;
  if(MAP_MOOD==="golden"){ sh.left=-90; sh.right=90; sh.top=80; sh.bottom=-80; }
  /* sea and island */
  var sea=new T.Mesh(new T.PlaneGeometry(900,900).rotateX(-Math.PI/2), new T.MeshLambertMaterial({color:M.sea})); sea.position.y=-1.3; sc.add(sea);
  var isl=mapIsland(), shp=new T.Shape(); shp.moveTo(isl[0][0], -isl[0][1]); isl.forEach(function(p){ shp.lineTo(p[0], -p[1]); });
  var ig=new T.ExtrudeGeometry(shp,{depth:2.4, bevelEnabled:true, bevelThickness:0.8, bevelSize:2.2, bevelSegments:2, curveSegments:4}).rotateX(-Math.PI/2).translate(0,-2.4-0.8,0);
  var land=new T.Mesh(ig, [new T.MeshLambertMaterial({color:"#7dbb4c"}), new T.MeshLambertMaterial({color:"#d9c68e", flatShading:true})]); land.receiveShadow=true; sc.add(land);
  /* fields: a few paler patches of grass */
  [[-30,-30,22,14],[52,14,14,18],[-48,40,16,10],[-2,-34,18,10]].forEach(function(f){ mFlatShape(mRound(f[0],f[1],f[2],f[3],0.5,24), "#93c95a", 0.008); });
  /* the river: a soft pale edge, then the water; it dips into the sea at both ends */
  var rv=mCurve(MAP_RIVER_CTRL, 0.8), i0=-1, i1=-1; rv.forEach(function(p,i){ if(mInside(p[0],p[1],isl)){ if(i0<0) i0=i; i1=i; } });
  var rin=rv.slice(Math.max(0,i0-2), Math.min(rv.length,i1+3)), ry=rin.map(function(p){ return mInside(p[0],p[1],isl)?0.06:-1.5; }), rye=ry.map(function(y){ return y>0?0.045:-1.52; });
  mRibbon(rin, 7.4, "#cfeee2", 0, rye); mRibbon(rin, 5, "#3fa3df", 0, ry); out.river=rin;
  /* Tōtara Park: a mowed lawn, a pond, paths, the rotunda */
  mFlatShape(mRound(-39,15,32,40,0.35,40), "#8fd05c", 0.012); mFlatShape(mRound(-45,28,10,7,1,24), "#cfeee2", 0.03); mFlatShape(mRound(-45,28,8.4,5.6,1,24), "#3fa3df", 0.05);
  var paths=[mCurve([[-23,12],[-29,17],[-34,22],[-40,26],[-46,33]],1), mCurve([[-28,34],[-31,28],[-34,22],[-40,12],[-48,0]],1), mCurve([[-54,18],[-44,18],[-34,22]],1)];
  paths.forEach(function(p){ mRibbon(p, 1, "#efe6cc", 0.025); });
  /* roads: the grid, High Street, the road over the river to Rata Terrace and one to the north-west */
  var roads=[], RC="#ece5d2", gx=[-20,-10,0,10,20,30,40,50], gz=[4,14,24,34,44];
  gx.forEach(function(x){ roads.push({p:[[x,4],[x,46]], w:1.7}); }); gz.forEach(function(z){ roads.push({p:[[-20,z],[51,z]], w:1.7}); });
  roads.push({p:[[-5,4],[37,46]], w:2.4, main:true});
  roads.push({p:mCurve([[30,4],[28,-6],[26,-14],[32,-21],[40,-23.5],[50,-22],[62,-27],[70,-30]],1), w:1.7});
  roads.push({p:mCurve([[0,4],[-2,-8],[-5,-22],[-10,-36],[-14,-48]],1), w:1.7});
  roads.push({p:mCurve([[-20,4],[-21,0],[-19,-3]],1), w:1.4});
  roads.forEach(function(r){ r.p=r.p.filter(function(p){ return mInside(p[0],p[1],isl); }); if(r.p.length>1) mRibbon(r.p, r.w, RC, 0.03); });
  /* bridges where a road or path crosses the river */
  function bridges(pts, w, col){ for(var i=0;i<pts.length-1;i++) for(var j=0;j<rin.length-1;j++){ var a=pts[i], b=pts[i+1], c=rin[j], d=rin[j+1];
      var den=(b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0]); if(!den) continue; var t=((c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0]))/den, u=((c[0]-a[0])*(b[1]-a[1])-(c[1]-a[1])*(b[0]-a[0]))/den;
      if(t<0||t>1||u<0||u>1) continue; var x=a[0]+t*(b[0]-a[0]), z=a[1]+t*(b[1]-a[1]), ang=Math.atan2(b[0]-a[0], b[1]-a[1]), B=mF(x,z,ang);
      mBox(B, w+0.6, 0.35, 8.6, col, 0,0.05,0); mBox(B,0.15,0.5,8.6,"#ffffff",(w+0.6)/2-0.08,0.4,0); mBox(B,0.15,0.5,8.6,"#ffffff",-(w+0.6)/2+0.08,0.4,0); return; } }
  roads.forEach(function(r){ if(r.p.length>1) bridges(r.p, r.w, "#e2dccb"); }); paths.forEach(function(p){ bridges(p, 1, "#c8a77a"); });
  /* the lots for our sites: a pale parcel, a white outline, a cyan glow for hover, and the building */
  var keep=[];   /* circles nothing else may stand in: [x,z,r] */
  SITES.forEach(function(s){ var L=MAP_LOT[s.id]; if(!L) return; var w=s.rect[0]*MAP_S+1.4, d=s.rect[1]*MAP_S+1.4, F=mF(L.x,L.z,L.r);
    mBox(F, w, 0.04, d, s.id==="warehouse"?"#cfcabd":s.id==="popup"?"#e2d6bd":"#c5e39a", 0,0.0,0);
    var g=new T.Group(); g.position.set(L.x,0,L.z); g.rotation.y=L.r; sc.add(g);
    var om=new T.MeshBasicMaterial({color:0xf4fbff, transparent:true, opacity:0.95}), t=0.16;
    [[w,t,0,d/2],[w,t,0,-d/2],[t,d,w/2,0],[t,d,-w/2,0]].forEach(function(e){ var m=new T.Mesh(mapUnits().box, om); m.scale.set(e[0]+t,0.06,e[1]); m.position.set(e[2],0.05,e[3]); g.add(m); });
    var gl=new T.Mesh(new T.PlaneGeometry(w/0.62, d/0.62).rotateX(-Math.PI/2), new T.MeshBasicMaterial({map:mapGlowTex(), transparent:true, depthWrite:false, opacity:0.95})); gl.position.y=0.07; gl.visible=false; g.add(gl);
    var top=mapSiteBuilding(s.id, F);
    var hit=new T.Mesh(mapUnits().box, new T.MeshBasicMaterial({visible:false})); hit.scale.set(w, top, d); hit.userData.site=s.id; g.add(hit); out.hits.push(hit);
    out.lots[s.id]={om:om, glow:gl, top:top}; out.pins.push({kind:"site", id:s.id, p:new T.Vector3(L.x, top+1.2, L.z)}); keep.push([L.x,L.z,Math.hypot(w,d)/2+0.6]); });
  MAP_LM.forEach(function(lm, i){ mapLandmark(lm); var hit=new T.Mesh(mapUnits().box, new T.MeshBasicMaterial({visible:false})); hit.scale.set(lm.k*0.75, lm.h, lm.k*0.75); hit.position.set(lm.x,0,lm.z); hit.userData.lm=i; sc.add(hit); out.hits.push(hit);
    out.pins.push({kind:"lm", id:lm.id, i:i, p:new T.Vector3(lm.x, lm.h+0.8, lm.z)}); keep.push([lm.x,lm.z,lm.k/2+0.5]); });
  function clear(x,z,r){ for(var i=0;i<keep.length;i++) if(Math.hypot(x-keep[i][0],z-keep[i][1])<keep[i][2]+r) return false; if(mDist(x,z,rin)<3.8+r) return false;
    for(var j=0;j<roads.length;j++) if(roads[j].p.length>1&&mDist(x,z,roads[j].p)<roads[j].w/2+r+0.2) return false; return mInside(x,z,isl); }
  /* the city blocks: shops and flats, sheds on the industrial edge */
  for(var bx=-15;bx<=45;bx+=10) for(var bz=9;bz<=39;bz+=10){ var B=mF(0,0,0);
    if(bz===39&&bx>=5){ if(clear(bx,bz,3.2)) { mBox(B,7,2.4,5.5,["#aab6bf","#c2b8a6","#9eb0a4"][(rnd()*3)|0],bx,0,bz); mGable(B,7.3,1,5.8,"#6d7a86",bx,2.4,bz,Math.PI/2); keep.push([bx,bz,4.3]); } continue; }
    [[-2.1,-2.1],[2.1,-2.1],[-2.1,2.1],[2.1,2.1]].forEach(function(o){ var x=bx+o[0], z=bz+o[1]; if(rnd()<0.12||!clear(x,z,1.35)) return;
      var h=bx>=-5&&bx<=25&&bz<=29?2.2+rnd()*4.2:1.8+rnd()*2; if(rnd()<0.3) mHouse(B,rnd,x,z,3,3,0); else mBlock(B,rnd,x,z,3.2,3.2,h); keep.push([x,z,1.6]); }); }
  /* houses on Rata Hill and in the north-west, and farm sheds in the fields */
  var rata=roads[roads.length-3].p; for(var hi=0;hi<rata.length;hi+=4){ var a=rata[hi], b=rata[Math.min(rata.length-1,hi+1)], tx=b[0]-a[0], tz=b[1]-a[1], L2=Math.hypot(tx,tz)||1;
    [-4.2,4.2].forEach(function(side){ var x=a[0]-tz/L2*side, z=a[1]+tx/L2*side; if(rnd()<0.35||!clear(x,z,2)) return; mHouse(mF(0,0,0),rnd,x,z,3,2.6,Math.atan2(tx,tz)); keep.push([x,z,2.2]); }); }
  var nw=roads[roads.length-2].p; for(var ni=0;ni<nw.length;ni+=4){ var c1=nw[ni]; [-4.4,4.4].forEach(function(side){ var x=c1[0]+side, z=c1[1]; if(rnd()<0.45||!clear(x,z,2)) return; mHouse(mF(0,0,0),rnd,x,z,2.8,2.6,0.2); keep.push([x,z,2.2]); }); }
  [[-30,-30],[52,14],[-48,40]].forEach(function(f){ if(clear(f[0]+5,f[1],2.5)){ mBox(mF(0,0,0),3.6,2,2.6,"#b5543c",f[0]+5,0,f[1]); mGable(mF(0,0,0),3.9,1.2,2.9,"#e9e2d0",f[0]+5,2,f[1],Math.PI/2); keep.push([f[0]+5,f[1],3]); } });
  /* boats on the river */
  [0.2, 0.74].forEach(function(t){ var i=Math.floor(t*(rin.length-2)), a=rin[i], b=rin[i+1], ang=Math.atan2(b[0]-a[0], b[1]-a[1]), F=mF(a[0],a[1],ang);
    mBox(F,0.9,0.35,2.4,"#ffffff",0.6,0.0,0); mBox(F,0.7,0.45,0.9,"#3a6ea5",0.6,0.35,-0.2); });
  /* trees: one instanced crown mesh and one trunk mesh */
  var tp=[], tries=0; while(tp.length<330&&tries<5000){ tries++; var x=-62+rnd()*136, z=-50+rnd()*106, p=0.12;
    if(x<-23&&x>-55&&z>-5&&z<35) p=0.7; else if(z<-14&&x>14) p=0.75; else if(x>-20&&x<52&&z>4&&z<46) p=0.06; else if(z<-14) p=0.3;
    if(rnd()>p) continue; var s=0.6+rnd()*0.65; if(!clear(x,z,s*0.9)) continue; tp.push([x,z,s, (x<-23&&x>-55&&z>-5&&z<35||(Math.hypot(x-40,z+29)<9))&&rnd()<0.22]); }
  [[36.2,-26.4,1],[44,-26.2,0.9]].forEach(function(t){ tp.push([t[0],t[1],t[2],true]); });
  var crowns=new T.InstancedMesh(new T.IcosahedronGeometry(1,0), new T.MeshLambertMaterial({color:0xffffff, flatShading:true}), tp.length), trunks=new T.InstancedMesh(new T.CylinderGeometry(0.16,0.24,1,5).translate(0,0.5,0), mat("#7a5a3c"), tp.length);
  var greens=["#3f8f3a","#4fa044","#2f7a35","#5aa646","#367f3c"], col=new T.Color();
  tp.forEach(function(t,i){ var s=t[2], th=0.9*s; _m4.compose(_v.set(t[0],0,t[1]), _q.identity(), _s.set(s,th,s)); trunks.setMatrixAt(i,_m4);
    _e.set(rnd()*0.5, rnd()*6, 0); _q.setFromEuler(_e); _m4.compose(_v.set(t[0],th+s*0.95,t[1]), _q, _s.set(s*1.25,s*1.35,s*1.25)); crowns.setMatrixAt(i,_m4);
    crowns.setColorAt(i, col.set(t[3]?(rnd()<0.5?"#f4a7c4":"#f7bfd4"):greens[(rnd()*greens.length)|0])); });
  crowns.castShadow=trunks.castShadow=true; crowns.receiveShadow=true; sc.add(crowns); sc.add(trunks);
  mFlush(sc, mat); out.sun=sun; return out; }
var _glowTex=null;
function mapGlowTex(){ if(_glowTex) return _glowTex; var c=document.createElement("canvas"); c.width=c.height=128; var x=c.getContext("2d");
  x.shadowColor="#3fe0ff"; x.shadowBlur=14; x.strokeStyle="#7ff0ff"; x.lineWidth=5; x.strokeRect(24.4,24.4,79.2,79.2); x.shadowBlur=0; x.fillStyle="rgba(90,230,255,.16)"; x.fillRect(24.4,24.4,79.2,79.2);
  _glowTex=new THREE.CanvasTexture(c); _glowTex.colorSpace=THREE.SRGBColorSpace; return _glowTex; }

// ---------- the renderer, camera and input ----------
function mapGLMake(){ if(MAP.gl) return; var T=THREE, view=MAP.el.querySelector(".gm-view"), cv=document.createElement("canvas"); view.insertBefore(cv, view.firstChild);
  var r=new T.WebGLRenderer({canvas:cv, antialias:true, powerPreference:"high-performance"}); r.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
  r.outputColorSpace=T.SRGBColorSpace; r.toneMapping=T.NeutralToneMapping||T.ACESFilmicToneMapping; r.toneMappingExposure=MOODS[MAP_MOOD].exp;
  r.shadowMap.enabled=true; r.shadowMap.type=T.PCFSoftShadowMap; r.shadowMap.autoUpdate=false; r.shadowMap.needsUpdate=true;   /* nothing moves: draw the shadows once */
  var S=mapScene(), cam=new T.PerspectiveCamera(30, 1, 1, 600);
  MAP.gl={r:r, cv:cv, sc:S.sc, cam:cam, lots:S.lots, hits:S.hits, pinsW:S.pins, tx:12, tz:6, d:105, yaw:-0.18, pitch:0.92};
  mapPinsMake(); mapSize(); mapFrameAll(); mapInput(cv); MAP.dirty=true; if(!MAP.raf) MAP.raf=requestAnimationFrame(mapLoop); }
function mapGLKill(){ var L=MAP.gl; if(!L) return; MAP.gl=null; MAP.run=false; if(MAP.raf){ cancelAnimationFrame(MAP.raf); MAP.raf=0; }
  L.sc.traverse(function(o){ if(o.geometry&&!mIsUnit(o.geometry)) o.geometry.dispose(); var m=o.material; if(m) (Array.isArray(m)?m:[m]).forEach(function(x){ if(x.map&&x.map!==_glowTex) x.map.dispose(); x.dispose(); }); });
  if(L.sc.environment) L.sc.environment.dispose(); L.r.dispose(); try{ L.r.forceContextLoss(); }catch(e){} L.cv.remove(); MAP.el.querySelector(".gm-pins").innerHTML=""; MAP.pins=[]; }
function mIsUnit(g){ if(!MG) return false; for(var k in MG) if(MG[k]===g) return true; return false; }
function mapSize(){ var L=MAP.gl; if(!L) return; var v=MAP.el.querySelector(".gm-view"), w=v.clientWidth||innerWidth, h=v.clientHeight||innerHeight; L.W=w; L.H=h; L.r.setSize(w,h,false); L.cam.aspect=w/h; L.cam.updateProjectionMatrix(); MAP.dirty=true; }
/* frame the four sites: far enough back that they all fit, whatever the screen's shape */
function mapFrameAll(){ var L=MAP.gl, a=L.W/L.H; L.tx=a>=1.2?14:8; L.tz=a>=1.2?4:8; L.d=a>=1.2?138:Math.min(190, 138*1.2/Math.max(0.45,a)*0.8); mapClamp(); }
function mapClamp(){ var L=MAP.gl; L.d=Math.max(28, Math.min(190, L.d)); L.tx=Math.max(-50, Math.min(60, L.tx)); L.tz=Math.max(-40, Math.min(46, L.tz)); }
function mapCam(){ var L=MAP.gl, c=L.cam, cp=Math.cos(L.pitch); c.position.set(L.tx+Math.sin(L.yaw)*cp*L.d, Math.sin(L.pitch)*L.d, L.tz+Math.cos(L.yaw)*cp*L.d); c.lookAt(L.tx,0,L.tz); }
var _ray=new THREE.Raycaster(), _nv=new THREE.Vector2();
function mapPick(cx, cy){ var L=MAP.gl; if(!L) return null; var rc=L.cv.getBoundingClientRect(); _nv.set((cx-rc.left)/rc.width*2-1, -((cy-rc.top)/rc.height)*2+1); _ray.setFromCamera(_nv, L.cam);
  var h=_ray.intersectObjects(L.hits, false)[0]; if(!h) return null; return h.object.userData.site!=null?{site:h.object.userData.site}:{lm:h.object.userData.lm}; }
function mapInput(cv){ var pts={}, drag=null, pinch=null;
  cv.addEventListener("pointerdown", function(e){ pts[e.pointerId]=e; try{ cv.setPointerCapture(e.pointerId); }catch(er){} drag={x:e.clientX, y:e.clientY, lx:e.clientX, ly:e.clientY, moved:false}; });
  cv.addEventListener("pointermove", function(e){ var L=MAP.gl; if(!L) return;
    if(!pts[e.pointerId]){ MAP.hq=[e.clientX, e.clientY]; return; } pts[e.pointerId]=e; var k=Object.keys(pts);
    if(k.length===2){ var a=pts[k[0]], b=pts[k[1]], dd=Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); if(pinch){ L.d=pinch.d*pinch.dd/Math.max(10,dd); mapClamp(); MAP.dirty=true; } else pinch={dd:dd, d:L.d}; if(drag) drag.moved=true; return; }
    if(!drag) return; if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>6) drag.moved=true; if(!drag.moved) return; cv.classList.add("drag");
    var wpp=2*L.d*Math.tan(L.cam.fov*Math.PI/360)/L.H, dx=e.clientX-drag.lx, dy=e.clientY-drag.ly; drag.lx=e.clientX; drag.ly=e.clientY;
    L.tx-=(Math.cos(L.yaw)*dx - Math.sin(L.yaw)*dy/Math.sin(L.pitch))*wpp; L.tz-=(-Math.sin(L.yaw)*dx - Math.cos(L.yaw)*dy/Math.sin(L.pitch))*wpp; mapClamp(); MAP.dirty=true; });
  function up(e){ var d=drag; delete pts[e.pointerId]; pinch=null; if(Object.keys(pts).length) return; drag=null; cv.classList.remove("drag");
    if(d&&!d.moved&&e.type==="pointerup"){ var p=mapPick(e.clientX, e.clientY); if(p&&p.site) mapCard(p.site); else if(p&&p.lm!=null) mapLmCard(p.lm); else mapCardClose(); } }
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("pointerleave", function(){ if(!drag){ MAP.hq=null; mapHover(null); } });
  cv.addEventListener("wheel", function(e){ e.preventDefault(); var L=MAP.gl; if(!L) return; L.d*=Math.exp(e.deltaY*0.0012); mapClamp(); MAP.dirty=true; }, {passive:false}); }
function mapHover(id){ if(MAP.hover===id) return; MAP.hover=id; mapLight(); if(MAP.gl) MAP.gl.cv.classList.toggle("hov", !!id); }
/* outline the hovered or chosen lot in glowing cyan */
function mapLight(){ var L=MAP.gl; if(!L) return; Object.keys(L.lots).forEach(function(id){ var o=L.lots[id], on=id===MAP.hover||id===MAP.sel; o.glow.visible=on; o.om.color.set(on?0x8ff4ff:0xf4fbff); });
  MAP.pins.forEach(function(p){ p.el.classList.toggle("on", p.id===MAP.sel||p.id===MAP.hover); }); MAP.dirty=true; }

// ---------- pins (HTML, projected from 3D every time the view changes) ----------
function mapPinsMake(){ var box=MAP.el.querySelector(".gm-pins"); box.innerHTML=""; MAP.pins=[];
  MAP.gl.pinsW.forEach(function(w){ var b=document.createElement("button"), here=w.kind==="site"&&G.site===w.id, s=w.kind==="site"?siteById(w.id):MAP_LM[w.i];
    b.className="gm-pin"+(w.kind==="lm"?" lm":"")+(here?" here":""); b.setAttribute("aria-label", s.name+(here?", you're here":"")+(w.kind==="site"?", "+s.street:""));
    b.innerHTML=w.kind==="site"?'<svg class="tp" viewBox="-21 -50 42 52"><path d="M0 0 C-4 -9 -19 -18 -19 -31 A19 19 0 1 1 19 -31 C19 -18 4 -9 0 0 Z" fill="#fff"/></svg><svg class="ic" viewBox="0 0 24 24">'+MAP_ICON.frame+'</svg><span class="tag">'+gEsc(here?"You're here":s.name)+'</span>'
      :'<span class="bd"><svg viewBox="0 0 24 24">'+MAP_ICON[s.icon]+'</svg></span>';
    b.onclick=function(e){ e.stopPropagation(); if(w.kind==="site") mapCard(w.id); else mapLmCard(w.i); };
    b.onmouseenter=function(){ if(w.kind==="site") mapHover(w.id); }; b.onmouseleave=function(){ if(w.kind==="site") mapHover(null); };
    box.appendChild(b); MAP.pins.push({el:b, w:w, id:w.id, kind:w.kind}); }); }
var _pv=new THREE.Vector3();
function mapPinsPlace(){ var L=MAP.gl; MAP.pins.forEach(function(p){ _pv.copy(p.w.p).project(L.cam); var x=(_pv.x+1)/2*L.W, y=(1-_pv.y)/2*L.H, off=_pv.z>1||x<-40||x>L.W+40||y<-20||y>L.H+80;
    p.x=x; p.y=y; p.el.style.display=off?"none":""; if(off) return; var e=p.el, w=e.offsetWidth||40;
    e.style.transform="translate("+(x-w/2).toFixed(1)+"px,"+(y-(p.kind==="site"?50:30)).toFixed(1)+"px)"; e.style.zIndex=String(1000+Math.round(y)); }); }

function mapLoop(){ MAP.raf=requestAnimationFrame(mapLoop); var L=MAP.gl; if(!L||!MAP.run) return;
  if(MAP.hq){ var p=mapPick(MAP.hq[0], MAP.hq[1]); MAP.hq=null; mapHover(p&&p.site||null); if(MAP.gl) MAP.gl.cv.classList.toggle("hov", !!p); }
  if(!MAP.dirty&&!MAP.spin) return; MAP.dirty=false; if(MAP.spin){ L.yaw+=0.004; MAP.frames=(MAP.frames||0)+1; }
  mapCam(); L.r.render(L.sc, L.cam); mapPinsPlace(); if(MAP.card) mapCardPlace(); }

/* a little picture of a lot, drawn once from the diorama and kept */
function mapThumb(key, x,z, k, ry){ if(MAP.thumbs[key]) return MAP.thumbs[key]; var L=MAP.gl; if(!L) return "";
  var r=L.r, pr=r.getPixelRatio(), w=268, h=128, c=new THREE.PerspectiveCamera(32, w/h, 0.5, 400), o=new THREE.Vector3(k*0.5, k*0.85, k*0.95).applyAxisAngle(new THREE.Vector3(0,1,0), ry||0);
  c.position.set(x+o.x, o.y, z+o.z); c.lookAt(x, k*0.12, z); c.near=Math.max(0.5, o.length()-k*0.6); c.updateProjectionMatrix();   /* clip away whatever stands between us and the lot */
  var vis=[]; Object.keys(L.lots).forEach(function(id){ vis.push(L.lots[id].glow.visible); L.lots[id].glow.visible=false; });
  r.setScissorTest(true); r.setViewport(0,0,w,h); r.setScissor(0,0,w,h); r.render(L.sc, c);
  var cv=document.createElement("canvas"); cv.width=Math.round(w*pr); cv.height=Math.round(h*pr); cv.getContext("2d").drawImage(r.domElement, 0, r.domElement.height-cv.height, cv.width, cv.height, 0, 0, cv.width, cv.height);
  r.setScissorTest(false); r.setViewport(0,0,L.W,L.H); Object.keys(L.lots).forEach(function(id,i){ L.lots[id].glow.visible=vis[i]; });
  mapCam(); r.render(L.sc, L.cam);   /* put the map straight back before the screen sees it */
  return (MAP.thumbs[key]=cv.toDataURL("image/jpeg", 0.86)); }

// ---------- the overlay ----------
function mapMake(){ if(MAP.el) return;
  var el=MAP.el=gEl("div","gm "+MAP_MOOD); el.hidden=true; el.setAttribute("role","dialog"); el.setAttribute("aria-label","City map"); el.dataset.nosnippet="";
  el.innerHTML='<div class="gm-top"><h2>The city</h2><p></p><span class="gm-cash"><small>CASH</small><b></b></span><button class="gm-x" aria-label="Close the map">×</button></div>'+
    '<div class="gm-view"><div class="gm-pins"></div><div class="gm-hint">Drag to look around. Scroll or pinch to zoom.</div></div>';
  document.body.appendChild(el);
  el.querySelector(".gm-x").onclick=function(){ mapExit(); };
  MAP.pv=gEl("div","gm-pv"); MAP.pv.hidden=true; document.body.appendChild(MAP.pv);
  MAP.pvh=gEl("div","gm-pvh","Drag to turn the room. Scroll or pinch to zoom."); MAP.pvh.hidden=true; document.body.appendChild(MAP.pvh);
  addEventListener("resize", function(){ if(MAP.gl&&MAP.run){ mapSize(); } });
  addEventListener("keydown", function(e){ if(!MAP.open||e.key!=="Escape") return; if(MAP.previewing) mapBackFromPreview(); else if(MAP.card) mapCardClose(); else if(!MAP.first) mapExit(); }); }
function mapTop(){ var p=MAP.el.querySelector(".gm-top p");
  p.innerHTML=MAP.first?"Pick a space for your first gallery. You've got a <b>"+gMoney(G.cash)+"</b> start-up grant.":"Fancy a new space? Tap a lot to have a look around.";
  MAP.el.querySelector(".gm-cash b").textContent=gMoney(G.cash); MAP.el.querySelector(".gm-x").hidden=MAP.first; }
function mapWall(s){ return Math.round(siteFaces(s).reduce(function(a,f){ return a+f.len; },0)); }
/* can you sign here? returns "" or the reason you can't */
function mapWhyNot(s){ var bond=s.rent*2; if(G.cash<bond) return "You need "+gMoney(bond)+" for the bond (two weeks' rent), and you've got "+gMoney(G.cash)+"."; return ""; }

/* the white Sims-style card for a site */
function mapCard(id, confirm){ var s=siteById(id), Lt=MAP_LOT[id]; if(!s||!Lt) return; mapCardClose(); MAP.sel=id; mapLight(); var here=G.site===id, why=mapWhyNot(s), bond=s.rent*2;
  var c=MAP.card=gEl("div","gm-card"); c.setAttribute("role","dialog"); c.setAttribute("aria-label", s.name); c.dataset.for=id;
  var th=mapThumb(id, Lt.x, Lt.z, Math.max(s.rect[0],s.rect[1])*MAP_S+3, Lt.r);
  c.innerHTML='<i class="tail"></i><button class="cx" aria-label="Close">×</button><div class="nm">'+gEsc(s.name)+'</div><div class="ty">'+gEsc(Lt.type+" · "+s.street)+'</div>'+
    (th?'<img class="th" alt="" src="'+th+'">':'')+'<p>'+gEsc(s.blurb)+'</p>'+
    '<dl class="gm-facts"><dt>Lot size</dt><dd>'+s.rect[0]+' × '+s.rect[1]+' m</dd><dt>Rent</dt><dd>'+gMoney(s.rent)+' a week</dd>'+
    '<dt>Foot traffic</dt><dd><span class="gm-meter" aria-label="'+s.traffic+' out of 5">'+[1,2,3,4,5].map(function(n){ return '<i class="'+(n<=s.traffic?"on":"")+'"></i>'; }).join("")+'</span><span>'+MAP_TRAFFIC[s.traffic-1]+'</span></dd>'+
    '<dt>Wall space</dt><dd>'+mapWall(s)+' m</dd>'+(s.lease?'<dt>Lease</dt><dd>'+s.lease+' weeks only</dd>':'')+(here?'':'<dt>Bond</dt><dd>'+gMoney(bond)+'</dd>')+'</dl>'+
    (confirm?mapWarn(s):'')+
    '<div class="gm-acts">'+(here?'<span class="gm-here">You\'re here</span>':'<button class="gbtn" data-a="in">Go inside</button><button class="gbtn gold" data-a="sign"'+(why?' disabled':'')+'>'+(confirm?"Move here":"Sign the lease")+'</button>'+(confirm?'<button class="gbtn" data-a="stay">Stay put</button>':''))+'</div>'+
    (why&&!here?'<div class="gm-why">'+gEsc(why)+'</div>':'');
  MAP.el.appendChild(c); c.querySelector(".cx").onclick=mapCardClose;
  c.querySelectorAll("[data-a]").forEach(function(b){ b.onclick=function(){ var a=b.dataset.a;
    if(a==="in") mapPreview(id); else if(a==="stay") mapCard(id); else if(a==="sign"){ if(G.site&&!confirm) mapCard(id, true); else mapSign(id); } }; });
  mapCardPlace(); var f=c.querySelector("[data-a=sign]:not([disabled])")||c.querySelector("[data-a]")||c.querySelector(".cx"); try{ f.focus({preventScroll:true}); }catch(e){} }
/* a landmark just gets a name card */
function mapLmCard(i){ var lm=MAP_LM[i]; if(!lm) return; mapCardClose(); MAP.sel=lm.id; mapLight();
  var c=MAP.card=gEl("div","gm-card"); c.setAttribute("role","dialog"); c.setAttribute("aria-label", lm.name); c.dataset.for=lm.id; var th=mapThumb(lm.id, lm.x, lm.z, lm.k*1.5, 0);
  c.innerHTML='<i class="tail"></i><button class="cx" aria-label="Close">×</button><div class="nm">'+gEsc(lm.name)+'</div><div class="ty">'+gEsc(lm.type)+'</div>'+(th?'<img class="th" alt="" src="'+th+'">':'')+'<p style="margin-bottom:2px">'+gEsc(lm.blurb)+'</p>';
  MAP.el.appendChild(c); c.querySelector(".cx").onclick=mapCardClose; mapCardPlace(); try{ c.querySelector(".cx").focus({preventScroll:true}); }catch(e){} }
/* beside its pin, with the tail pointing at it (a bottom sheet on a phone, from the CSS) */
function mapCardPlace(){ var c=MAP.card, L=MAP.gl; if(!c||!L) return; var pin=null; MAP.pins.forEach(function(p){ if(p.id===c.dataset.for) pin=p; }); if(!pin||innerWidth<=640) return;
  var vr=L.cv.getBoundingClientRect(), px=vr.left+pin.x, py=vr.top+pin.y-(pin.kind==="site"?30:14), cw=c.offsetWidth, ch=c.offsetHeight, right=px+26+cw<innerWidth-12, x=right?px+26:px-26-cw, y=py-ch*0.35;
  y=Math.max(vr.top+8, Math.min(innerHeight-ch-12, y)); x=Math.max(12, Math.min(innerWidth-cw-12, x));
  c.style.left=x+"px"; c.style.top=y+"px"; c.classList.toggle("r", right); c.classList.toggle("l", !right); c.style.setProperty("--ty", Math.max(24, Math.min(ch-24, py-y))+"px"); }
function mapWarn(s){ var n=G.hung.length;
  return '<div class="gm-ok">Moving means the walls come down: '+(n?'your '+n+' hung work'+(n===1?'':'s')+' come'+(n===1?'s':'')+' off and ':'')+'you start fresh at '+gEsc(s.name)+'. Your old bond comes back, and the new one is '+gMoney(s.rent*2)+'.</div>'; }
function mapCardClose(){ if(MAP.card){ MAP.card.remove(); MAP.card=null; } MAP.sel=null; mapLight(); }

/* "Go inside": the bare room in 3D, with a small bar to come back or sign; the map stops drawing meanwhile */
function mapPreview(id, confirm){ var s=siteById(id); if(!s) return; mapCardClose(); MAP.previewing=id; MAP.run=false; MAP.el.hidden=true; MAP.pvh.hidden=false;
  if(RM.site!==s||!RM.preview) roomBuild(s, {preview:true});
  var why=mapWhyNot(s);
  MAP.pv.innerHTML=(confirm?mapWarn(s):'')+'<span class="nm"><small>'+gEsc(s.street)+' · '+gMoney(s.rent)+'/wk</small>'+gEsc(s.name)+'</span><button class="gbtn" data-a="back">Back to the map</button>'+
    (confirm?'<button class="gbtn" data-a="stay">Stay put</button>':'')+'<button class="gbtn gold" data-a="sign"'+(why?' disabled title="'+gEsc(why)+'"':'')+'>'+(confirm?"Move here":"Sign the lease")+'</button>';
  MAP.pv.hidden=false;
  MAP.pv.querySelectorAll("[data-a]").forEach(function(b){ b.onclick=function(){ var a=b.dataset.a;
    if(a==="back") mapBackFromPreview(); else if(a==="stay") mapPreview(id); else if(a==="sign"){ if(G.site&&!confirm) mapPreview(id, true); else mapSign(id); } }; });
  if(why) galToast(why, "warn"); }
function mapBackFromPreview(){ var id=MAP.previewing; MAP.previewing=null; MAP.pv.hidden=true; MAP.pvh.hidden=true; roomBuild(null); MAP.el.hidden=false; MAP.run=true; mapTop(); mapSize(); if(id) mapCard(id); }

/* hide everything, let go of the map's GPU memory, and give the clock back (once) */
function mapHide(){ mapCardClose(); MAP.previewing=null; MAP.hover=null; if(MAP.el) MAP.el.hidden=true; if(MAP.pv) MAP.pv.hidden=true; if(MAP.pvh) MAP.pvh.hidden=true; mapGLKill();
  if(MAP.open){ MAP.open=false; gHold=Math.max(0,gHold-1); } }
function mapSign(id){ var s=siteById(id); if(!s||mapWhyNot(s)) return; mapHide(); galSignLease(id); }
/* back out of the whole map to your own gallery */
function mapExit(){ if(!G.site) return; mapHide(); roomBuild(siteById(G.site)); galGo("floor"); }

GSCR.map={open:function(o){ o=o||{}; mapMake(); MAP.first=!!o.first||!G.site;
  if(!MAP.open){ MAP.open=true; gHold++; }
  if(RM.site) roomBuild(null);   /* the room underneath stops drawing while the map is up */
  MAP.previewing=null; MAP.pv.hidden=true; MAP.pvh.hidden=true; MAP.el.hidden=false; mapTop(); mapCardClose();
  if(MAP.gl) mapPinsMake(); else mapGLMake(); MAP.run=true; mapSize();
  if(o.site) mapCard(o.site); },
  close:function(){ if(G.site) mapExit(); }};
if(/[?&]dev/.test(location.search)) window.__map={M:MAP, card:mapCard, lm:mapLmCard, preview:mapPreview, back:mapBackFromPreview, exit:mapExit, hold:function(){ return gHold; },
  hover:mapHover, view:function(o){ Object.assign(MAP.gl,o||{}); mapClamp(); MAP.dirty=true; return {tx:MAP.gl.tx, tz:MAP.gl.tz, d:MAP.gl.d}; },
  /* frames per second while the view keeps changing (a slow turn), over ms */
  fps:function(ms){ MAP.frames=0; MAP.spin=true; var t0=performance.now(); return new Promise(function(res){ setTimeout(function(){ MAP.spin=false; MAP.dirty=true; res(MAP.frames*1000/(performance.now()-t0)); }, ms||3000); }); }};
