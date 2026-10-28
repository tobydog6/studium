// ================= GALLERY LOOK LAB: the tycoon game's floor view, in three looks =================
// An isometric gallery room (walls nearest the camera cut away, as in a tycoon game) with photos hung, a pot on a
// plinth, benches and wandering visitors. Fast, Balanced and Rich trade quality for speed so Sam can try them on school
// laptops; the crowd buttons add visitors to see how numbers cost. See docs/gallery-brief.md.
(function(){
  var THREE=window.THREE;
  var PHOTOS=["asset:assets/research/sample-1.jpg","asset:assets/research/sample-2.jpg","asset:assets/research/sample-3.jpg",
    "asset:assets/research/sample-4.jpg","asset:assets/research/sample-5.jpg","asset:assets/research/sample-6.jpg"];
  var LOOKS={
    fast:{name:"Fast", dpr:1, aa:false, std:false, shadows:false, env:false, spots:false},
    balanced:{name:"Balanced", dpr:1.5, aa:true, std:true, shadows:1024, env:false, spots:false},
    rich:{name:"Rich", dpr:2, aa:true, std:true, shadows:2048, env:true, spots:true}};
  var CROWDS={quiet:["Quiet",6], busy:["Busy",30], packed:["Packed",90]};
  var W=16, D=12, H=3.4, T=0.2;   /* room width (x), depth (z), wall height, wall thickness */
  var look="balanced", crowd="busy", renderer=null, scene=null, cam=null, walls=[], art=[], people=[], tex=[];
  var yaw=Math.PI/4, zoom=1, canvas=document.getElementById("gl");
  PHOTOS.forEach(function(u){ var t=new THREE.TextureLoader().load(u); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; tex.push(t); });

  function mat(L, hex, rough){ return L.std?new THREE.MeshStandardMaterial({color:hex, roughness:rough==null?0.85:rough, metalness:0}):new THREE.MeshLambertMaterial({color:hex}); }
  function box(L, w,h,d, hex, rough){ var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(L,hex,rough)); m.castShadow=m.receiveShadow=!!L.shadows; return m; }

  function makeRenderer(L){
    if(renderer){ renderer.dispose(); renderer.forceContextLoss&&renderer.forceContextLoss(); var c2=canvas.cloneNode(false); canvas.parentNode.replaceChild(c2,canvas); canvas=c2; bindInput(); }
    renderer=new THREE.WebGLRenderer({canvas:canvas, antialias:L.aa, powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, L.dpr));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=L.std?THREE.ACESFilmicToneMapping:THREE.NoToneMapping; renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=!!L.shadows; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    var gl=renderer.getContext(), dbg=gl.getExtension("WEBGL_debug_renderer_info");
    document.getElementById("gpu").textContent=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):"";
  }

  // walls carry their own hung works, so a cut-away wall takes its art with it
  function wall(L, x,z, len, horiz, nx,nz){ var g=new THREE.Group(), m=box(L, horiz?len:T, H, horiz?T:len, 0xefece6, 0.95); m.position.y=H/2; g.add(m);
    g.position.set(x,0,z); g.userData.n=new THREE.Vector3(nx,0,nz); scene.add(g); walls.push(g); return g; }
  function hang(L, g, along, horiz, side, ti, wide){ var w=wide||1.9, h=w*(400/600), f=new THREE.Group();
    var fr=box(L, w+0.12, h+0.12, 0.05, 0x1b1a18, 0.6); f.add(fr);
    var pic=new THREE.Mesh(new THREE.PlaneGeometry(w,h), L.std?new THREE.MeshStandardMaterial({map:tex[ti%tex.length], roughness:0.7}):new THREE.MeshLambertMaterial({map:tex[ti%tex.length]}));
    pic.position.z=0.03; f.add(pic);
    var off=T/2+0.03; if(horiz){ f.position.set(along,1.65,side*off); f.rotation.y=side>0?0:Math.PI; } else { f.position.set(side*off,1.65,along); f.rotation.y=side>0?Math.PI/2:-Math.PI/2; }
    g.add(f);
    var wp=new THREE.Vector3(), n=new THREE.Vector3(0,0,1).applyQuaternion(f.getWorldQuaternion(new THREE.Quaternion())); f.updateWorldMatrix(true,false); f.getWorldPosition(wp);
    art.push({p:wp, n:n, spot:wp.clone().addScaledVector(n,1.7)});
    if(L.spots&&art.length<=10){ var s=new THREE.SpotLight(0xfff1dc, 9, 6, 0.42, 0.6, 1.4); s.position.copy(wp).addScaledVector(n,1.1); s.position.y=H-0.05; s.target.position.copy(wp); scene.add(s); scene.add(s.target); } }

  function vase(L){ var pts=[], prof=[[0,0],[0.16,0],[0.2,0.05],[0.26,0.22],[0.24,0.42],[0.13,0.6],[0.1,0.72],[0.14,0.8],[0.13,0.82]];
    prof.forEach(function(p){ pts.push(new THREE.Vector2(p[0],p[1])); });
    var m=new THREE.Mesh(new THREE.LatheGeometry(pts,L.std?48:20), L.std?new THREE.MeshStandardMaterial({color:0x2f5d62, roughness:0.25, metalness:0.05}):new THREE.MeshLambertMaterial({color:0x2f5d62}));
    m.castShadow=!!L.shadows; return m; }

  function person(L){ var g=new THREE.Group(), m=L.std?new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.6, transparent:L.env, opacity:L.env?0.88:1}):new THREE.MeshLambertMaterial({color:0xffffff});
    var b=new THREE.Mesh(new THREE.CapsuleGeometry(0.2,0.85,4,L.std?10:6), m); b.position.y=0.72; var h=new THREE.Mesh(new THREE.SphereGeometry(0.15,L.std?14:8,L.std?10:6), m); h.position.y=1.5;
    b.castShadow=h.castShadow=!!L.shadows; g.add(b); g.add(h); g.scale.setScalar(0.92+Math.random()*0.16); scene.add(g);
    var a=art[(Math.random()*art.length)|0]; g.position.set(a.spot.x+(Math.random()-0.5)*2, 0, a.spot.z+(Math.random()-0.5)*2);
    return {g:g, to:null, wait:Math.random()*4, sp:0.7+Math.random()*0.5, ph:Math.random()*6}; }

  function build(){ var L=LOOKS[look]; makeRenderer(L); walls=[]; art=[]; people=[];
    scene=new THREE.Scene(); scene.background=new THREE.Color(0x14120f);
    if(L.env){ var pm=new THREE.PMREMGenerator(renderer); scene.environment=pm.fromScene(new window.RoomEnvironment(),0.04).texture; scene.environmentIntensity=0.35; }
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x3a342c, L.std?(L.env?0.5:1.1):0.9));
    var sun=new THREE.DirectionalLight(0xfff0dc, L.std?1.6:0.9); sun.position.set(-6,12,5); scene.add(sun);
    if(L.shadows){ sun.castShadow=true; sun.shadow.mapSize.set(L.shadows,L.shadows); var sc=sun.shadow.camera; sc.left=-11; sc.right=11; sc.top=11; sc.bottom=-11; sc.near=1; sc.far=30; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03; }
    var fl=box(L, W, 0.1, D, 0x5d5a55, 0.55); fl.position.y=-0.05; scene.add(fl);
    var base=box(L, W+6, 0.06, D+6, 0x23201c); base.position.y=-0.14; scene.add(base);
    // outer walls (outward normals) and a free-standing partition with art both sides
    var n=wall(L, 0,-D/2, W, true, 0,0,-1), s=wall(L, 0,D/2, W, true, 0,0,1), w=wall(L, -W/2,0, D, false, -1,0), e=wall(L, W/2,0, D, false, 1,0);
    hang(L,n,-4.5,true,1,0); hang(L,n,0,true,1,1,2.6); hang(L,n,4.5,true,1,2);
    hang(L,s,-4.5,true,-1,3); hang(L,s,0,true,-1,4,2.6); hang(L,s,4.5,true,-1,5);
    hang(L,w,-2.5,false,1,2); hang(L,w,2.5,false,1,3);
    hang(L,e,-2.5,false,-1,4); hang(L,e,2.5,false,-1,0);
    var pg=new THREE.Group(), pw=box(L, T, H*0.85, 4.2, 0xefece6, 0.95); pw.position.y=H*0.85/2; pg.add(pw); pg.position.set(-1.5,0,0); scene.add(pg);
    hang(L,pg,0,false,1,1,1.6); hang(L,pg,0,false,-1,5,1.6);
    var pl=box(L, 0.6,1.0,0.6, 0xf6f4f0, 0.9); pl.position.set(3.2,0.5,0); scene.add(pl); var v=vase(L); v.position.set(3.2,1.0,0); scene.add(v);
    [[3.2,-2.2],[3.2,2.2],[-5,0]].forEach(function(p,i){ var b=box(L, i<2?1.8:0.5, 0.42, i<2?0.5:1.8, 0x2a2622, 0.5); b.position.set(p[0],0.21,p[1]); scene.add(b); });
    cam=new THREE.OrthographicCamera(-1,1,1,-1,0.1,100); resize();
    for(var i=0;i<CROWDS[crowd][1];i++) people.push(person(L));
  }
  function addPeople(){ var L=LOOKS[look], want=CROWDS[crowd][1];
    while(people.length>want){ var p=people.pop(); scene.remove(p.g); }
    while(people.length<want) people.push(person(L)); }

  function resize(){ if(!renderer) return; renderer.setSize(innerWidth, innerHeight, false); var a=innerWidth/innerHeight, v=9.5/zoom;
    cam.left=-v*a; cam.right=v*a; cam.top=v; cam.bottom=-v; cam.updateProjectionMatrix(); }
  function placeCam(){ var r=30, pitch=0.62; cam.position.set(Math.sin(yaw)*Math.cos(pitch)*r, Math.sin(pitch)*r, Math.cos(yaw)*Math.cos(pitch)*r); cam.lookAt(0,0.6,0);
    var to=new THREE.Vector3(cam.position.x,0,cam.position.z).normalize();
    walls.forEach(function(g){ g.visible=g.userData.n.dot(to)<0.2; }); }   /* hide the walls between you and the room */

  function step(p, dt){ if(p.wait>0){ p.wait-=dt; return; }
    if(!p.to){ var a=art[(Math.random()*art.length)|0]; p.to=a.spot.clone().add(new THREE.Vector3((Math.random()-0.5)*1.4,0,(Math.random()-0.5)*1.4)); p.look=a.p; }
    var d=new THREE.Vector3(p.to.x-p.g.position.x,0,p.to.z-p.g.position.z), L2=d.length();
    if(L2<0.1){ p.to=null; p.wait=3+Math.random()*6; p.g.rotation.y=Math.atan2(p.look.x-p.g.position.x, p.look.z-p.g.position.z); p.g.position.y=0; return; }
    d.multiplyScalar(Math.min(L2, p.sp*dt)/L2); p.g.position.add(d); p.g.rotation.y=Math.atan2(d.x,d.z);
    p.ph+=dt*8; p.g.position.y=Math.abs(Math.sin(p.ph))*0.03; }

  var last=performance.now(), acc=0, frames=0;
  function frame(now){ requestAnimationFrame(frame); var dt=Math.min(0.1,(now-last)/1000); last=now;
    people.forEach(function(p){ step(p,dt); }); placeCam(); renderer.render(scene,cam);
    acc+=dt; frames++; if(acc>=0.5){ document.getElementById("fps").textContent=Math.round(frames/acc)+" fps";
      document.getElementById("ms").textContent=(acc/frames*1000).toFixed(1)+" ms a frame · "+LOOKS[look].name+" · "+people.length+" visitors"; acc=0; frames=0; } }

  // input: drag turns the room, wheel or pinch zooms
  var drag=null, pinch=null, pts={};
  function bindInput(){
    canvas.addEventListener("pointerdown", function(e){ pts[e.pointerId]=e; canvas.setPointerCapture(e.pointerId); drag={x:e.clientX, yaw:yaw}; });
    canvas.addEventListener("pointermove", function(e){ if(!pts[e.pointerId]) return; pts[e.pointerId]=e; var k=Object.keys(pts);
      if(k.length===2){ var a=pts[k[0]], b=pts[k[1]], dd=Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); if(pinch){ zoom=Math.max(0.6,Math.min(2.6,pinch.z*dd/pinch.d)); resize(); } else pinch={d:dd, z:zoom}; return; }
      if(drag) yaw=drag.yaw-(e.clientX-drag.x)*0.006; });
    function up(e){ delete pts[e.pointerId]; pinch=null; drag=null; }
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", function(e){ e.preventDefault(); zoom=Math.max(0.6,Math.min(2.6,zoom*Math.exp(-e.deltaY*0.0012))); resize(); }, {passive:false});
  }
  bindInput(); addEventListener("resize", resize);

  function buttons(id, set, cur, pick){ var row=document.getElementById(id);
    Object.keys(set).forEach(function(k){ var b=document.createElement("button"); b.textContent=set[k].name||set[k][0]; b.dataset.k=k; if(k===cur) b.classList.add("on");
      b.onclick=function(){ row.querySelectorAll("button").forEach(function(x){ x.classList.toggle("on", x===b); }); pick(k); }; row.appendChild(b); }); }
  buttons("looks", LOOKS, look, function(k){ look=k; build(); });
  buttons("crowds", CROWDS, crowd, function(k){ crowd=k; addPeople(); });
  function sync(){ document.querySelectorAll("#looks button,#crowds button").forEach(function(x){ x.classList.toggle("on", x.dataset.k===look||x.dataset.k===crowd); }); }
  window.__gl={set:function(l,c){ if(c){ crowd=c; } look=l||look; sync(); build(); }, info:function(){ return renderer.info.render; }};
  build(); requestAnimationFrame(frame);
})();
