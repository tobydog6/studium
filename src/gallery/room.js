// ================= GALLERY ROOM: the isometric 3D floor (three.js, the Rich look Sam picked) =================
// Builds the leased site from core.js's SITES (walls nearest the camera cut away, like a tycoon game), hangs G.hung with
// spotlights and red dots for sold work, and walks white-silhouette visitors (as many as gVisitorsNow says). Clicking a
// wall opens its wall plan (plan.js). If the computer can't keep up, the look steps down to Balanced, then Fast.
var LOOKS={
  fast:{name:"Fast", dpr:1, aa:false, std:false, shadows:false, env:false, spots:false, crowd:40},
  balanced:{name:"Balanced", dpr:1.5, aa:true, std:true, shadows:1024, env:false, spots:false, crowd:60},
  rich:{name:"Rich", dpr:2, aa:true, std:true, shadows:2048, env:true, spots:true, crowd:90}};
var T=0.2;   /* wall thickness */
var RM={look:"rich", renderer:null, scene:null, cam:null, site:null, preview:false, outer:[], inner:[], artG:null, art:[], people:[], faces:[], hits:[],
  yaw:Math.PI/4, zoom:1, paused:false, canvas:document.getElementById("gl"), slow:0, settled:0};
try{ var _lk=localStorage.getItem("studium_gallery_look"); if(LOOKS[_lk]) RM.look=_lk; }catch(e){}

function rmMat(hex, rough){ var L=LOOKS[RM.look]; return L.std?new THREE.MeshStandardMaterial({color:hex, roughness:rough==null?0.85:rough, metalness:0}):new THREE.MeshLambertMaterial({color:hex}); }
function rmBox(w,h,d, hex, rough){ var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), rmMat(hex,rough)); m.castShadow=m.receiveShadow=!!LOOKS[RM.look].shadows; return m; }

function rmRenderer(){ var L=LOOKS[RM.look];
  if(RM.renderer){ RM.renderer.dispose(); try{ RM.renderer.forceContextLoss(); }catch(e){} var c2=RM.canvas.cloneNode(false); RM.canvas.parentNode.replaceChild(c2,RM.canvas); RM.canvas=c2; rmInput(); }
  var r=RM.renderer=new THREE.WebGLRenderer({canvas:RM.canvas, antialias:L.aa, powerPreference:"high-performance"});
  r.setPixelRatio(Math.min(window.devicePixelRatio||1, L.dpr)); r.setSize(innerWidth, innerHeight, false);
  r.outputColorSpace=THREE.SRGBColorSpace; r.toneMapping=L.std?THREE.ACESFilmicToneMapping:THREE.NoToneMapping; r.toneMappingExposure=1.05;
  r.shadowMap.enabled=!!L.shadows; r.shadowMap.type=THREE.PCFSoftShadowMap; }

/* build a site's room: preview=true leaves the walls bare (the map's "go inside") */
function roomBuild(site, opts){ opts=opts||{}; var L=LOOKS[RM.look]; RM.site=site; RM.preview=!!opts.preview; rmRenderer();
  var sc=RM.scene=new THREE.Scene(); sc.background=new THREE.Color(0x14120f); RM.outer=[]; RM.inner=[]; RM.people=[]; RM.hits=[];
  if(!site){ RM.cam=new THREE.OrthographicCamera(-1,1,1,-1,0.1,100); return; }
  var W=site.rect[0], D=site.rect[1], H=site.h;
  if(L.env){ var pm=new THREE.PMREMGenerator(RM.renderer); sc.environment=pm.fromScene(new window.RoomEnvironment(),0.04).texture; sc.environmentIntensity=0.35; }
  sc.add(new THREE.HemisphereLight(0xfff6ea, 0x3a342c, L.std?(L.env?0.5:1.1):0.9));
  var sun=new THREE.DirectionalLight(0xfff0dc, L.std?1.6:0.9); sun.position.set(-W*0.4,14,D*0.4); sc.add(sun);
  if(L.shadows){ sun.castShadow=true; sun.shadow.mapSize.set(L.shadows,L.shadows); var c=sun.shadow.camera, R=Math.max(W,D)*0.75; c.left=-R; c.right=R; c.top=R; c.bottom=-R; c.near=1; c.far=40; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03; }
  var fl=rmBox(W, 0.1, D, site.floor, 0.55); fl.position.y=-0.05; sc.add(fl);
  var base=rmBox(W+8, 0.06, D+8, 0x23201c); base.position.y=-0.14; sc.add(base);
  // outer walls: each side its own group with an outward normal, hidden when it stands between you and the room
  [["n",0,-D/2,W,true,0,-1],["s",0,D/2,W,true,0,1],["w",-W/2,0,D,false,-1,0],["e",W/2,0,D,false,1,0]].forEach(function(w){
    var g=new THREE.Group(), glass=site.glass===w[0], m;
    if(glass){ m=new THREE.Mesh(new THREE.BoxGeometry(w[4]?w[3]:0.06, H, w[4]?0.06:w[3]), new THREE.MeshStandardMaterial({color:0xbfd3dc, roughness:0.05, metalness:0.1, transparent:true, opacity:0.18}));
      var sill=rmBox(w[4]?w[3]:T, 0.5, w[4]?T:w[3], site.wall, 0.9); sill.position.y=0.25; g.add(sill); }
    else { m=rmBox(w[4]?w[3]+T:T, H, w[4]?T:w[3]+T, site.wall, 0.95); m.userData.face=w[0]; RM.hits.push(m); }
    m.position.y=H/2; g.add(m); g.position.set(w[1],0,w[2]); g.userData.n=new THREE.Vector3(w[5],0,w[6]); g.userData.side=w[0]; sc.add(g); RM.outer.push(g); });
  (site.walls||[]).forEach(function(c,i){ var dx=c[2]-c[0], dz=c[3]-c[1], len=Math.hypot(dx,dz), m=rmBox(len, H*0.92, T, site.wall, 0.95);
    m.position.set((c[0]+c[2])/2, H*0.46, (c[1]+c[3])/2); m.rotation.y=-Math.atan2(dz,dx); m.userData.inner=i; m.userData.n=new THREE.Vector3(-dz/len,0,dx/len); RM.hits.push(m); sc.add(m); RM.inner.push(m); });
  RM.faces=siteFaces(site);
  RM.cam=new THREE.OrthographicCamera(-1,1,1,-1,0.1,120); rmResize();
  roomRefresh(); }

/* (re)hang the art: frames, spotlights in the Rich look, red dots on sold work */
function roomRefresh(){ if(!RM.scene||!RM.site) return; var L=LOOKS[RM.look];
  if(RM.artG){ RM.scene.remove(RM.artG); RM.artG.traverse(function(o){ if(o.geometry) o.geometry.dispose(); }); }
  var g=RM.artG=new THREE.Group(); RM.art=[]; RM.scene.add(g);
  var items=RM.preview?[]:G.hung, nSpots=0;
  items.forEach(function(it){ var f=null; for(var i=0;i<RM.faces.length;i++) if(RM.faces[i].id===it.face) f=RM.faces[i]; var p=phById(it.pid); if(!f||!p) return;
    var sz=itemSize(it), w=sz[0], h=sz[1], off=T/2+0.03, x=f.a[0]+f.r[0]*it.x+f.n[0]*off, z=f.a[1]+f.r[1]*it.x+f.n[1]*off;
    var fr=new THREE.Group(); fr.position.set(x, it.y, z); fr.rotation.y=Math.atan2(f.n[0], f.n[1]);
    var back=rmBox(w+0.05, h+0.05, 0.04, 0x1b1a18, 0.6); fr.add(back);
    var pic=new THREE.Mesh(new THREE.PlaneGeometry(w,h), L.std?new THREE.MeshStandardMaterial({map:phTex(p), roughness:0.7}):new THREE.MeshLambertMaterial({map:phTex(p)})); pic.position.z=0.025; fr.add(pic);
    if(it.sold){ var dot=new THREE.Mesh(new THREE.CircleGeometry(0.035,16), new THREE.MeshBasicMaterial({color:0xd8321e})); dot.position.set(w/2+0.08, -h/2+0.03, 0.01); fr.add(dot); }
    fr.userData.face=f.id; g.add(fr);
    var wp=new THREE.Vector3(x, it.y, z), n=new THREE.Vector3(f.n[0],0,f.n[1]); RM.art.push({p:wp, spot:wp.clone().addScaledVector(n, 1.2+w*0.6).setY(0)});
    if(L.spots&&nSpots<14){ nSpots++; var s=new THREE.SpotLight(0xfff1dc, 9, 6, 0.42, 0.6, 1.4); s.position.copy(wp).addScaledVector(n,1.1); s.position.y=RM.site.h-0.05; s.target.position.copy(wp); s.userData.face=f.id; g.add(s); g.add(s.target); } });
  if(!RM.art.length) RM.art.push({p:new THREE.Vector3(0,1.4,0), spot:new THREE.Vector3(0,0,0)}); }

function rmPerson(){ var L=LOOKS[RM.look], g=new THREE.Group(), m=L.std?new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.6, transparent:L.env, opacity:L.env?0.88:1}):new THREE.MeshLambertMaterial({color:0xffffff});
  var b=new THREE.Mesh(new THREE.CapsuleGeometry(0.2,0.85,4,L.std?10:6), m); b.position.y=0.72; var h=new THREE.Mesh(new THREE.SphereGeometry(0.15,L.std?14:8,L.std?10:6), m); h.position.y=1.5;
  b.castShadow=h.castShadow=!!L.shadows; g.add(b); g.add(h); g.scale.setScalar(0.92+Math.random()*0.16); RM.scene.add(g);
  /* walk in from the door side (the front of the room) */
  var D=RM.site.rect[1]; g.position.set((Math.random()-0.5)*2, 0, D/2-0.6);
  return {g:g, to:null, wait:0, sp:0.7+Math.random()*0.5, ph:Math.random()*6, leaving:false}; }
function rmCrowd(){ if(!RM.site||RM.preview) return; var want=Math.min(LOOKS[RM.look].crowd, typeof gVisitorsNow==="function"?gVisitorsNow():0);
  var here=RM.people.filter(function(p){ return !p.leaving; });
  if(here.length<want&&Math.random()<0.08) RM.people.push(rmPerson());
  else if(here.length>want&&Math.random()<0.08){ var p=here[(Math.random()*here.length)|0]; p.leaving=true; p.to=new THREE.Vector3(0,0,RM.site.rect[1]/2-0.4); p.wait=0; } }
function rmStep(p, dt){ if(p.wait>0){ p.wait-=dt; return; }
  if(!p.to){ var a=RM.art[(Math.random()*RM.art.length)|0]; p.to=a.spot.clone().add(new THREE.Vector3((Math.random()-0.5)*1.2,0,(Math.random()-0.5)*1.2)); p.look=a.p; }
  var d=new THREE.Vector3(p.to.x-p.g.position.x,0,p.to.z-p.g.position.z), L2=d.length();
  if(L2<0.1){ if(p.leaving){ RM.scene.remove(p.g); p.gone=true; return; } p.to=null; p.wait=3+Math.random()*6; if(p.look) p.g.rotation.y=Math.atan2(p.look.x-p.g.position.x, p.look.z-p.g.position.z); p.g.position.y=0; return; }
  d.multiplyScalar(Math.min(L2, p.sp*dt)/L2); p.g.position.add(d); p.g.rotation.y=Math.atan2(d.x,d.z); p.ph+=dt*8; p.g.position.y=Math.abs(Math.sin(p.ph))*0.03; }

function rmResize(){ if(!RM.renderer||!RM.cam) return; RM.renderer.setSize(innerWidth, innerHeight, false); var a=innerWidth/innerHeight, s=RM.site, span=s?Math.max(s.rect[0],s.rect[1]):16, v=span*0.6/RM.zoom;
  if(a<1) v/=a*0.9; RM.cam.left=-v*a; RM.cam.right=v*a; RM.cam.top=v; RM.cam.bottom=-v; RM.cam.updateProjectionMatrix(); }
function rmPlaceCam(){ var r=40, pitch=0.62, c=RM.cam; c.position.set(Math.sin(RM.yaw)*Math.cos(pitch)*r, Math.sin(pitch)*r, Math.cos(RM.yaw)*Math.cos(pitch)*r); c.lookAt(0,0.6,0);
  var to=new THREE.Vector3(c.position.x,0,c.position.z).normalize(); var off={}; RM.outer.forEach(function(g){ g.visible=g.userData.n.dot(to)<0.2; if(!g.visible) off[g.userData.side]=1; });
  if(RM.artG) RM.artG.children.forEach(function(o){ if(o.userData.face) o.visible=!off[o.userData.face]; }); }   /* art on a cut-away wall goes with it */

/* click (not drag) a wall: which face did you hit? */
function rmPick(cx, cy){ if(!RM.site||RM.preview) return null; var ray=new THREE.Raycaster(), v=new THREE.Vector2(cx/innerWidth*2-1, -(cy/innerHeight)*2+1); ray.setFromCamera(v, RM.cam);
  var vis=RM.hits.filter(function(m){ var o=m; while(o){ if(!o.visible) return false; o=o.parent; } return true; }), hit=ray.intersectObjects(vis, false)[0]; if(!hit) return null;
  var m=hit.object; if(m.userData.face) return m.userData.face;
  if(m.userData.inner!=null){ var n=m.userData.n, side=new THREE.Vector3().subVectors(RM.cam.position, hit.point).dot(n)>0?"a":"b"; return "i"+m.userData.inner+side; } return null; }

var _drag=null, _pinch=null, _pts={};
function rmInput(){ var cv=RM.canvas;
  cv.addEventListener("pointerdown", function(e){ _pts[e.pointerId]=e; cv.setPointerCapture(e.pointerId); _drag={x:e.clientX, y:e.clientY, yaw:RM.yaw, moved:false}; });
  cv.addEventListener("pointermove", function(e){ if(!_pts[e.pointerId]) return; _pts[e.pointerId]=e; var k=Object.keys(_pts);
    if(k.length===2){ var a=_pts[k[0]], b=_pts[k[1]], dd=Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); if(_pinch){ RM.zoom=Math.max(0.6,Math.min(2.6,_pinch.z*dd/_pinch.d)); rmResize(); } else _pinch={d:dd, z:RM.zoom}; if(_drag) _drag.moved=true; return; }
    if(_drag){ if(Math.abs(e.clientX-_drag.x)+Math.abs(e.clientY-_drag.y)>5) _drag.moved=true; RM.yaw=_drag.yaw-(e.clientX-_drag.x)*0.006; } });
  function up(e){ var d=_drag; delete _pts[e.pointerId]; _pinch=null; _drag=null;
    if(d&&!d.moved&&e.type==="pointerup"&&typeof gScreen!=="undefined"&&gScreen==="floor"){ var f=rmPick(e.clientX, e.clientY); if(f&&GSCR.plan) galGo("plan",{face:f}); } }
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("wheel", function(e){ e.preventDefault(); RM.zoom=Math.max(0.6,Math.min(2.6,RM.zoom*Math.exp(-e.deltaY*0.0012))); rmResize(); }, {passive:false});
  cv.style.cursor="grab"; }
rmInput(); addEventListener("resize", rmResize);

/* step the look down if this computer can't hold about 24 fps for a few seconds */
function rmWatch(dt){ RM.settled+=dt; if(RM.settled<3) return; if(dt>1/24) RM.slow+=dt; else RM.slow=Math.max(0,RM.slow-dt*0.5);
  if(RM.slow>3){ RM.slow=0; RM.settled=0; var next=RM.look==="rich"?"balanced":RM.look==="balanced"?"fast":null; if(!next) return;
    RM.look=next; try{ localStorage.setItem("studium_gallery_look", next); }catch(e){} galToast("Switched to the "+LOOKS[next].name+" look so the gallery runs smoothly on this computer.");
    roomBuild(RM.site, {preview:RM.preview}); } }

var _last=performance.now();
function rmFrame(now){ requestAnimationFrame(rmFrame); var dt=Math.min(0.1,(now-_last)/1000); _last=now; if(RM.paused) return;
  gTick(dt); if(!RM.site){ RM.renderer&&RM.renderer.clear(); return; }
  rmCrowd(); RM.people.forEach(function(p){ rmStep(p,dt); }); RM.people=RM.people.filter(function(p){ return !p.gone; });
  rmPlaceCam(); RM.renderer.render(RM.scene, RM.cam); rmWatch(dt); }
/* Studium's handle on this page (galleryroom.js): pause while the gallery is closed */
window.GALapp={pause:function(on){ RM.paused=!!on; _last=performance.now(); }};
