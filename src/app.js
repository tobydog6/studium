(function(){
  "use strict";
  var THREE=window.THREE, GS=window.GaussianSplats3D;
  var $=function(id){return document.getElementById(id);};
@@include state.js@@
  var viewport=$("viewport"), landing=$("landing"), menu=$("menu"), gallery=$("gallery"),
      hud=$("hud"), crosshair=$("crosshair"), grid=$("grid"), prompt=$("prompt"),
      viewfinder=$("viewfinder"), loader=$("loader"), loadmsg=$("loadmsg"), loadsub=$("loadsub"),
      toastEl=$("toast"), photoNum=$("photoNum"), landingNote=$("landingNote"), editor=$("editor");

  if(!THREE||!GS){ landingNote.innerHTML="<b style='color:#ff6b6b'>The 3D engine did not load.</b> Please re-download this file and open it directly in Google Chrome."; return; }

  var FMT={ply:GS.SceneFormat.Ply, splat:GS.SceneFormat.Splat, ksplat:GS.SceneFormat.KSplat};
  var UPY=new THREE.Vector3(0,1,0);

  // ---- camera-sim tables ----
  var APERTURES=[1.4,2,2.8,4,5.6,8,11,16];
  var SHUTTERS=[1/1000,1/500,1/250,1/125,1/60,1/30,1/15,1/8,1/4,1/2];
  var SHUTTER_LABELS=["1/1000","1/500","1/250","1/125","1/60","1/30","1/15","1/8","1/4","1/2"];
  var ISOS=[100,200,400,800,1600,3200,6400];
  var apIdx=2, shIdx=3, isoIdx=2, focalMM=50;
  // ---- camera bodies + lenses (physical cameras) ----
  // bodies match the camera bag (src/bag.js); lenses come from its kits. sensorW sets the crop factor.
  var BODIES=[
    {id:"dslr", name:"Full-frame DSLR",  fmt:"Full-frame",  sensorW:36,   aspect:1.5,  sys:"35", lenses:[50,50,85,135], grain:0.00, warm:0.00, finder:"eye", optical:true},
    {id:"ml",   name:"APS-C mirrorless", fmt:"APS-C 1.6×",  sensorW:22.3, aspect:1.5,  sys:"35", lenses:[50,50,85,135], grain:0.02, warm:0.02, finder:"eye"},
    {id:"67",   name:"6×7 film SLR",     fmt:"6×7 film",    sensorW:70,   aspect:1.25, sys:"67", lenses:[105,55,165],   grain:0.06, warm:0.05, finder:"eye", film:true, roll:10}
  ];
  var bodyIdx=0, lensIdx=2, camGrain=0, camWarm=0, focusDist=0.5;
  var expMult=1, evStops=0, isoGrain=0, apVig=0.16, dofStrength=0;
  var audioCtx=null, soundOn=true;
  var gBloom=1, gDof=1, gWarm=0, gCon=1, gSat=1, gGrain=1;   // user "look" grade

  // ---- state ----
  var renderer,camera,scene=null,viewer=null,loaded=false,looking=false,viewfinderOn=false;
  var camPos=new THREE.Vector3(), yaw=0, pitch=0, sceneMaxDim=8;
  var boxMin=new THREE.Vector3(-1e9,-1e9,-1e9), boxMax=new THREE.Vector3(1e9,1e9,1e9), boundsOn=true;
  var keys={}, sens=0.0009, invertY=false, moveScale=0.12;
  var photos=[], clock=new THREE.Clock();
  var _vel=new THREE.Vector3();
  var lastSource=null, lastFormat=null, lastUp="ydown";

  // ---- photo briefs (the lesson layer) ----
  var BRIEFS=[
    {id:"thirds",  t:"Rule of thirds",       tip:"Put your subject on a third-line, not dead centre"},
    {id:"leading", t:"Leading lines",        tip:"Use lines to pull the eye toward your subject"},
    {id:"fill",    t:"Fill the frame",       tip:"Get in close so your subject fills the shot"},
    {id:"symmetry",t:"Symmetry",             tip:"Find a balanced, mirrored composition"},
    {id:"frame",   t:"Frame within a frame", tip:"Shoot through a doorway, window or gap"},
    {id:"low",     t:"Low angle",            tip:"Get low and shoot upward for drama"},
    {id:"negative",t:"Negative space",       tip:"Leave lots of empty space around a small subject"},
    {id:"detail",  t:"Close detail",         tip:"Zoom in on a texture or detail most people miss"}
  ];
  var activeBrief=-1, briefDone={}, studentName="";
  function briefProgText(){ var d=0; for(var k in briefDone){ if(briefDone[k]>0) d++; } return d+" / "+BRIEFS.length+" done"; }
  function buildBriefList(){
    var el=$("briefList"); if(!el) return; el.innerHTML="";
    var free=document.createElement("button"); free.className="chip"+(activeBrief<0?" on":""); free.textContent="Free shoot"; free.onclick=function(){ setBrief(-1); }; el.appendChild(free);
    BRIEFS.forEach(function(brf,i){ var b=document.createElement("button"); b.className="chip"+(activeBrief===i?" on":""); b.textContent=(briefDone[brf.id]?"✓ ":"")+brf.t; b.title=brf.tip; b.onclick=function(){ setBrief(i); }; el.appendChild(b); });
    var pg=$("briefProg"); if(pg) pg.textContent=briefProgText();
  }
  function setBrief(i){ activeBrief=i; updateBriefUI(); buildBriefList(); if(typeof vfRenderChips==="function") vfRenderChips(); if(i>=0) toast("Brief: "+BRIEFS[i].t+" — "+BRIEFS[i].tip); }
  function updateBriefUI(){
    var chip=$("briefChip"), ct=$("briefChipText"), vb=$("vfBrief"); if(!chip) return;
    if(activeBrief>=0){ var b=BRIEFS[activeBrief]; ct.textContent=b.t; chip.classList.remove("hidden"); vb.textContent=b.t+" — "+b.tip; vb.classList.remove("hidden"); }
    else { chip.classList.add("hidden"); vb.classList.add("hidden"); }
  }

  // ---- renderer / camera ----
  renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setClearColor(0x0e0f13,1);
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.autoClear=false;
  viewport.appendChild(renderer.domElement);
  camera=new THREE.PerspectiveCamera(50,window.innerWidth/window.innerHeight,0.05,3000);

  // ---- post-process pipeline (render splat -> RT, then effect pass -> screen) ----
  var _sz=new THREE.Vector2(); renderer.getDrawingBufferSize(_sz);
  var sceneRT=new THREE.WebGLRenderTarget(_sz.x,_sz.y,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
  var fsScene=new THREE.Scene();
  var fsCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  var fsMat=new THREE.ShaderMaterial({
    uniforms:{ tDiffuse:{value:sceneRT.texture}, exposure:{value:1}, filmic:{value:0}, vignette:{value:0.1}, grain:{value:0}, dof:{value:0}, focus:{value:0.5}, seed:{value:0},
      gCon:{value:1}, gSat:{value:1}, gWarm:{value:0}, gBloom:{value:1}, gDof:{value:1}, gGrain:{value:1}, resolution:{value:new THREE.Vector2(_sz.x,_sz.y)} },
    vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }",
    fragmentShader:[
      "precision highp float;",
      "varying vec2 vUv;",
      "uniform sampler2D tDiffuse; uniform float exposure,filmic,vignette,grain,dof,focus,seed,gCon,gSat,gWarm,gBloom,gDof,gGrain; uniform vec2 resolution;",
      "float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+34.345); return fract(p.x*p.y); }",
      "void main(){",
      "  vec2 dc=vUv-vec2(0.5); float r=length(dc); vec2 tx=1.0/resolution;",
      "  float ca=0.0020*filmic*smoothstep(0.06,0.85,r);",   // chromatic aberration toward the edges
      "  float band=abs(vUv.y-focus);",                       // manual focus: rack the sharp plane up/down the frame
      "  float dofB=dof*gDof*smoothstep(0.05,0.55,band);",     // sharp at the focus plane, blurs away from it
      "  vec3 c;",
      "  if(dofB>0.002){ float rad=dofB*13.0; vec3 s=vec3(0.0); float wsum=0.0;",
      "    for(int i=0;i<16;i++){ float a=float(i)*2.3999632; float rr=sqrt((float(i)+0.5)/16.0)*rad;",
      "      vec2 off=vec2(cos(a),sin(a))*rr*tx;",
      "      vec3 sm=vec3(texture2D(tDiffuse,vUv+off+dc*ca).r, texture2D(tDiffuse,vUv+off).g, texture2D(tDiffuse,vUv+off-dc*ca).b);",
      "      float w=1.0+max(sm.r+sm.g+sm.b-1.2,0.0)*2.5;",   // brighter out-of-focus points bloom into bokeh
      "      s+=sm*w; wsum+=w; }",
      "    c=s/wsum; }",
      "  else { c=vec3(texture2D(tDiffuse,vUv+dc*ca).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-dc*ca).b); }",
      "  c*=exposure;",
      "  if(filmic>0.01){ vec3 bl=vec3(0.0);",                // soft highlight bloom (lens/sensor glow)
      "    for(int i=0;i<12;i++){ float a=float(i)*2.3999632+1.2; float rr=(float(i)+1.0)/12.0*7.0;",
      "      vec3 sm=texture2D(tDiffuse, vUv+vec2(cos(a),sin(a))*rr*tx).rgb*exposure; bl+=max(sm-0.72,0.0); }",
      "    c+=bl/12.0*1.5*filmic*gBloom; }",
      "  vec3 x=max(c,0.0); vec3 aces=clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);",  // ACES filmic tonemap
      "  c=mix(clamp(c,0.0,1.0),aces,filmic);",
      "  c=(c-0.5)*gCon+0.5;",                               // grade: contrast
      "  float lum=dot(c,vec3(0.299,0.587,0.114)); c=mix(vec3(lum),c,gSat);",  // grade: saturation
      "  c+=vec3(gWarm,gWarm*0.05,-gWarm)*0.14;",            // grade: warmth
      "  c*=1.0-vignette*smoothstep(0.35,0.85,r);",          // lens vignette
      "  c+=(hash(vUv*resolution+seed)-0.5)*grain*gGrain;",  // film grain
      "  gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);",
      "}"
    ].join("\n")
  });
  fsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), fsMat));
  var fx={exposure:1,filmic:0,vignette:0.1,grain:0,dof:0}, seedCounter=0;

  function resize(){
    camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
    renderer.getDrawingBufferSize(_sz); sceneRT.setSize(_sz.x,_sz.y); fsMat.uniforms.resolution.value.set(_sz.x,_sz.y);
  }
  window.addEventListener("resize",resize);

  // ---- helpers ----
  function show(el){el.classList.remove("hidden");} function hide(el){el.classList.add("hidden");}
  function anyOutputOpen(){ return ["folio","photobook","galleryshow"].some(function(id){ var e=document.getElementById(id); return e && !e.classList.contains("hidden"); }); }
  function menuOpen(){ return (typeof cbOpen!=="undefined"&&cbOpen)||(typeof bg!=="undefined"&&bg.open)||(typeof st!=="undefined"&&st.open)||!menu.classList.contains("hidden")||!gallery.classList.contains("hidden")||!landing.classList.contains("hidden")||!editor.classList.contains("hidden")||anyOutputOpen(); }
  var toastTimer=null;
  function toast(m){ toastEl.textContent=m; toastEl.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(function(){toastEl.classList.remove("show");},3200); }
  function updatePrompt(){ if(loaded && !looking && !viewfinderOn && !menuOpen()) show(prompt); else hide(prompt); }
  function updateCrosshair(){ crosshair.classList.toggle("hidden", !(looking && !viewfinderOn)); }

  // ---- camera-sim math ----
  function computeCam(){
    var N=APERTURES[apIdx], t=SHUTTERS[shIdx], iso=ISOS[isoIdx];
    var base=(1/125)*400/(2.8*2.8), cur=t*iso/(N*N);
    expMult=cur/base; evStops=Math.log(expMult)/Math.LN2;
    var body=BODIES[bodyIdx]||BODIES[0]; camGrain=body.grain||0; camWarm=body.warm||0;
    isoGrain=Math.min(Math.max((iso-100)/6300,0),1)*0.11 + camGrain;
    var wide=Math.min(Math.max((5.6-N)/(5.6-1.4),0),1); apVig=0.16+wide*0.22;
    dofStrength=Math.min(Math.max((8-N)/6.6,0),1);          // f/8+ = all sharp, f/1.4 = maximum background blur
    // walking: a natural eye. Camera up: the lens's horizontal angle of view fills the viewfinder frame,
    // so sensor size (crop factor) and focal length frame exactly like the real camera would.
    var fov=viewfinderOn?vfFovFor(body.sensorW,focalMM):55; camera.fov=Math.max(4,Math.min(112,fov)); camera.updateProjectionMatrix();
    updateCamLabels();
  }
  function updateCamLabels(){
    if($("mApVal")){ $("mApVal").textContent="f/"+APERTURES[apIdx]; $("mShVal").textContent=SHUTTER_LABELS[shIdx];
      $("mIsoVal").textContent=ISOS[isoIdx];
      $("mExpNdl").style.left=(Math.min(Math.max((evStops+3)/6,0),1)*100)+"%"; }
    var ev=(evStops>=0?"+":"")+evStops.toFixed(1)+" EV";
    $("vfSettings").textContent="f/"+APERTURES[apIdx]+" · "+SHUTTER_LABELS[shIdx]+" · ISO "+ISOS[isoIdx];
    $("vfExp").textContent=ev; $("vfLens").textContent=focalMM+"mm";
    if($("tagCam")) updateHoloTags();
    updateLcd(evStops);
    if(typeof vfRefresh==="function") vfRefresh();
  }

  // ---- physical camera: bodies, lenses, finder ----
  function curBody(){ return BODIES[bodyIdx]||BODIES[0]; }
  function selectBody(i){ bodyIdx=Math.max(0,Math.min(BODIES.length-1,i)); var b=curBody(); if(lensIdx>b.lenses.length-1) lensIdx=Math.min(2,b.lenses.length-1); focalMM=b.lenses[lensIdx]; buildBodyPicker(); buildLensPicker(); computeCam(); applyFinder(); updateCamArt(); updateHoloTags(); }
  function selectLens(i){ var b=curBody(); lensIdx=Math.max(0,Math.min(b.lenses.length-1,i)); focalMM=b.lenses[lensIdx]; buildLensPicker(); computeCam(); applyFinder(); updateHoloTags(); }
  function buildBodyPicker(){ var el=$("bodyList"); if(!el) return; el.innerHTML="";
    BODIES.forEach(function(b,i){ var d=document.createElement("button"); d.className="bodybtn"+(i===bodyIdx?" on":"");
      d.innerHTML="<span class='bn'>"+b.name+"</span><span class='bf'>"+b.fmt+"</span>"; d.onclick=function(){ selectBody(i); }; el.appendChild(d); }); }
  function buildLensPicker(){ var el=$("lensList"); if(!el) return; el.innerHTML=""; var b=curBody();
    b.lenses.forEach(function(mm,i){ var c=document.createElement("button"); c.className="chip"+(i===lensIdx?" on":""); c.textContent=mm+"mm"; c.onclick=function(){ selectLens(i); }; el.appendChild(c); }); }
  function captureAspect(A){ var src=renderer.domElement, W=src.width, H=src.height, cw=W, ch=H;
    if(W/H>A){ cw=H*A; } else { ch=W/A; }
    var sx=(W-cw)/2, sy=(H-ch)/2, o=document.createElement("canvas");
    if(viewfinderOn){ var r=vfRect(), kx=W/window.innerWidth, ky=H/window.innerHeight; sx=r.x*kx; sy=r.y*ky; cw=r.w*kx; ch=r.h*ky; }   // exactly what the frame shows
    o.width=Math.max(2,Math.round(cw)); o.height=Math.max(2,Math.round(ch));
    o.getContext("2d").drawImage(src, sx,sy,cw,ch, 0,0,o.width,o.height); return o.toDataURL("image/png"); }
  function sizeFinder(){ if(typeof vfLayout==="function"){ vfLayout(); vfRefresh(); } }
  function applyFinder(){ var b=curBody(), cv=renderer&&renderer.domElement, bl=$("vfBody"), md=$("vfMode"), vfEl=$("viewfinder");
    if(bl) bl.textContent=b.name;
    if(md) md.textContent=(b.finder==="waist"?"◉ WAIST-LEVEL":(b.finder==="ground"?"◉ GROUND GLASS":"◉ CAPTURE"));
    if(cv){ cv.classList.toggle("finderFlipH", viewfinderOn && b.finder==="waist"); cv.classList.toggle("finderFlipHV", viewfinderOn && b.finder==="ground"); }
    var film=!!b.film; if(vfEl) vfEl.classList.toggle("filmfinder", viewfinderOn && film);
    var vf=$("vfFocus"); if(vf) vf.textContent="FOCUS "+focusBars();
    sizeFinder(); }
  function switchCamTab(name){ Array.prototype.forEach.call(document.querySelectorAll("#menu .mtab"),function(b){ b.classList.toggle("on", b.getAttribute("data-tab")===name); });
    Array.prototype.forEach.call(document.querySelectorAll("#menu .campane"),function(p){ p.classList.toggle("hidden", p.getAttribute("data-pane")!==name); }); }
  function initCameraUI(){ buildBodyPicker(); buildLensPicker();
    Array.prototype.forEach.call(document.querySelectorAll("#menu .mtab"),function(b){ b.onclick=function(){ switchCamTab(b.getAttribute("data-tab")); }; });
    var mf=$("mFocus"); if(mf) mf.addEventListener("input",function(){ setFocus((+this.value)/100); });
    initHolo(); updateCamArt(); updateHoloTags();
    window.addEventListener("resize",function(){ if(viewfinderOn) sizeFinder(); }); }
  function initHolo(){ var stage=$("holoStage"), scene=$("holoScene"); if(!stage||!scene) return;
    stage.addEventListener("mousemove",function(e){ var r=stage.getBoundingClientRect(); var nx=(e.clientX-r.left)/r.width-0.5, ny=(e.clientY-r.top)/r.height-0.5;
      scene.style.transform="rotateX("+(-ny*11).toFixed(2)+"deg) rotateY("+(nx*15).toFixed(2)+"deg)";
      stage.style.setProperty("--px",nx.toFixed(3)); stage.style.setProperty("--py",ny.toFixed(3));
      var sp=stage.querySelector(".cspec"); if(sp){ sp.style.setProperty("--lx",(35-nx*60).toFixed(1)+"%"); sp.style.setProperty("--ly",(25-ny*50).toFixed(1)+"%"); } });
    stage.addEventListener("mouseleave",function(){ scene.style.transform="rotateX(0deg) rotateY(0deg)"; stage.style.setProperty("--px","0"); stage.style.setProperty("--py","0"); });
    var fb=document.createElement("button"); fb.type="button"; fb.className="cflipbtn"; fb.id="cFlipBtn"; fb.textContent="Flip camera"; fb.hidden=true;
    fb.addEventListener("click",function(ev){ ev.stopPropagation(); toggleCamFlip(); }); stage.appendChild(fb); }
  var CAM_FRONT_IMG="asset:assets/camera/front.webp", CAM_BACK_IMG="asset:assets/camera/back.webp", camFlipped=false, lcdEv=0;
  function toggleCamFlip(){ camFlipped=!camFlipped; var f=$("cFlip"); if(f) f.classList.toggle("flipped",camFlipped);
    var b=$("cFlipBtn"); if(b) b.textContent=camFlipped?"Show front":"Flip camera"; updateLcd(); }
  function updateLcd(ev){ if(typeof ev==="number") lcdEv=ev; var l=$("cLcd"); if(!l) return; var b=curBody();
    var pos=Math.min(Math.max((lcdEv+3)/6,0),1)*100;
    l.innerHTML='<div class="lcd-row"><span><b>&#9679;</b> Ready</span><span>'+(photos?photos.length:0)+' shots</span></div>'
      +'<div><div class="lcd-name">'+b.name+'</div><div class="lcd-row" style="margin-top:4%"><span>'+b.fmt+'</span><span>'+focalMM+'mm</span></div></div>'
      +'<div class="lcd-meter" aria-hidden="true"><i style="left:'+pos.toFixed(1)+'%"></i></div>'
      +'<div class="lcd-grid"><div><span>Aperture</span><b>f/'+APERTURES[apIdx]+'</b></div><div><span>Shutter</span><b>'+SHUTTER_LABELS[shIdx]+'</b></div><div><span>ISO</span><b>'+ISOS[isoIdx]+'</b></div><div><span>EV</span><b>'+(lcdEv>=0?"+":"")+lcdEv.toFixed(1)+'</b></div></div>'; }
  function updateHoloTags(){ var e, b=curBody();
    e=$("mHeroName"); if(e) e.textContent=b.name;
    e=$("mHeroSpec"); if(e) e.textContent=b.fmt+"  ·  "+focalMM+"mm  ·  f/"+APERTURES[apIdx]+"  ·  ISO"+ISOS[isoIdx]; updateLcd(); }
  // ---- high-fidelity camera illustration (shaded SVG, varies per body) ----
  function camType(){ var id=curBody().id; if(id==="rz67") return "waist"; if(id==="lf45") return "view"; if(id==="pentax67"||id==="film35") return "slr"; return "mirrorless"; }
  function updateCamArt(){ var host=$("camArt"); if(!host) return; var stage=$("holoStage"), fb=$("cFlipBtn");
    if(camType()==="mirrorless"){
      host.classList.add("photo"); if(stage) stage.classList.add("photo"); if(fb) fb.hidden=false;
      host.innerHTML='<div class="cflip'+(camFlipped?' flipped':'')+'" id="cFlip" role="img" aria-label="'+curBody().name+'">'
        +'<div class="cface cfront"><div class="cwrap"><img src="'+CAM_FRONT_IMG+'" alt="" draggable="false"><div class="cspec"></div></div></div>'
        +'<div class="cface cback"><div class="cbwrap"><img src="'+CAM_BACK_IMG+'" alt="" draggable="false"><div class="clcd" id="cLcd"></div></div></div></div>';
      var sp=host.querySelector(".cspec"); if(sp){ sp.style.webkitMaskImage="url("+CAM_FRONT_IMG+")"; sp.style.maskImage="url("+CAM_FRONT_IMG+")"; }
      $("cFlip").addEventListener("click",toggleCamFlip); if(fb) fb.textContent=camFlipped?"Show front":"Flip camera"; updateLcd();
    } else {
      host.classList.remove("photo"); if(stage) stage.classList.remove("photo"); if(fb) fb.hidden=true;
      host.innerHTML=camArtSVG(camType());
    } }
  function caDefs(){ return '<defs>'
    +'<linearGradient id="caBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c414b"/><stop offset=".12" stop-color="#2b3038"/><stop offset=".58" stop-color="#1b1f26"/><stop offset="1" stop-color="#0d0f13"/></linearGradient>'
    +'<linearGradient id="caBody2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#333841"/><stop offset="1" stop-color="#111318"/></linearGradient>'
    +'<linearGradient id="caGrip" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b3038"/><stop offset=".5" stop-color="#191d23"/><stop offset="1" stop-color="#0a0c10"/></linearGradient>'
    +'<radialGradient id="caMetal" cx=".5" cy=".3" r=".85"><stop offset="0" stop-color="#f4f6f9"/><stop offset=".4" stop-color="#bcc1ca"/><stop offset=".75" stop-color="#676c75"/><stop offset="1" stop-color="#2f323a"/></radialGradient>'
    +'<radialGradient id="caBarrel" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#4a4f59"/><stop offset=".55" stop-color="#242830"/><stop offset="1" stop-color="#08090c"/></radialGradient>'
    +'<radialGradient id="caGlass" cx=".42" cy=".36" r=".82"><stop offset="0" stop-color="#dcefff"/><stop offset=".15" stop-color="#5ea0c8"/><stop offset=".42" stop-color="#173c56"/><stop offset=".68" stop-color="#161a34"/><stop offset=".86" stop-color="#3b2348"/><stop offset="1" stop-color="#7d4763"/></radialGradient>'
    +'<radialGradient id="caSpec" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity=".92"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>'
    +'<radialGradient id="caCsh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000000" stop-opacity=".5"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>'
    +'<linearGradient id="caRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".5"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>'
    +'<linearGradient id="caTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#565c67"/><stop offset=".5" stop-color="#3a3f49"/><stop offset="1" stop-color="#262a31"/></linearGradient>'
    +'<pattern id="caLeather" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#181b20"/><circle cx="1.2" cy="1.2" r="0.7" fill="#22262d"/><circle cx="3.7" cy="3.7" r="0.7" fill="#22262d"/></pattern>'
    +'</defs>'; }
  function caDial(cx,cy,rx,ry){ // top dial: domed metal cap + knurled body + top highlight
    var s='<path d="M'+(cx-rx)+' '+(cy-ry*0.5)+' L'+(cx-rx)+' '+(cy+ry*0.4)+' Q'+(cx-rx)+' '+(cy+ry)+' '+cx+' '+(cy+ry)+' Q'+(cx+rx)+' '+(cy+ry)+' '+(cx+rx)+' '+(cy+ry*0.4)+' L'+(cx+rx)+' '+(cy-ry*0.5)+' Z" fill="url(#caMetal)" stroke="#22252b" stroke-width="1"/>';
    s+='<ellipse cx="'+cx+'" cy="'+(cy-ry*0.5)+'" rx="'+rx+'" ry="'+(ry*0.5).toFixed(1)+'" fill="url(#caMetal)" stroke="#22252b" stroke-width="1"/>';
    for(var i=0;i<11;i++){ var x=cx-rx+2+i*((2*rx-4)/10); s+='<line x1="'+x.toFixed(1)+'" y1="'+(cy-ry*0.2).toFixed(1)+'" x2="'+x.toFixed(1)+'" y2="'+(cy+ry*0.85).toFixed(1)+'" stroke="rgba(16,18,22,.5)" stroke-width="1"/>'; }
    s+='<ellipse cx="'+cx+'" cy="'+(cy-ry*0.55).toFixed(1)+'" rx="'+(rx*0.62).toFixed(1)+'" ry="'+(ry*0.3).toFixed(1)+'" fill="rgba(255,255,255,.4)"/>'; return s; }
  function caLens(cx,cy,r){ var s='';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="url(#caBarrel)" stroke="#04050a" stroke-width="1.5"/>';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.9).toFixed(1)+'" fill="none" stroke="#0a0c10" stroke-width="'+(r*0.13).toFixed(1)+'"/>';
    for(var a=0;a<44;a++){ var ang=a/44*Math.PI*2, c=Math.cos(ang), si=Math.sin(ang); s+='<line x1="'+(cx+c*r*0.84).toFixed(1)+'" y1="'+(cy+si*r*0.84).toFixed(1)+'" x2="'+(cx+c*r*0.965).toFixed(1)+'" y2="'+(cy+si*r*0.965).toFixed(1)+'" stroke="rgba(128,136,148,.32)" stroke-width="1"/>'; }
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.76).toFixed(1)+'" fill="#14171c" stroke="#000" stroke-width="1"/>';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.69).toFixed(1)+'" fill="none" stroke="#e3ad57" stroke-width="'+(r*0.035).toFixed(1)+'" opacity=".9"/>';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.62).toFixed(1)+'" fill="url(#caGlass)"/>';
    s+='<ellipse cx="'+(cx-r*0.15).toFixed(1)+'" cy="'+(cy-r*0.2).toFixed(1)+'" rx="'+(r*0.36).toFixed(1)+'" ry="'+(r*0.24).toFixed(1)+'" fill="url(#caSpec)" opacity=".5"/>';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.45).toFixed(1)+'" fill="none" stroke="rgba(150,200,235,.16)" stroke-width="1.2"/>';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.3).toFixed(1)+'" fill="none" stroke="rgba(130,95,155,.2)" stroke-width="1"/>';
    s+='<ellipse cx="'+(cx-r*0.25).toFixed(1)+'" cy="'+(cy-r*0.29).toFixed(1)+'" rx="'+(r*0.13).toFixed(1)+'" ry="'+(r*0.075).toFixed(1)+'" fill="#ffffff" opacity=".85"/>';
    return s; }
  function camArtSVG(type){
    var s='<svg viewBox="0 0 440 300" xmlns="http://www.w3.org/2000/svg">'+caDefs();
    s+='<ellipse cx="216" cy="262" rx="150" ry="14" fill="url(#caCsh)"/>';
    if(type==="waist"){
      s+='<rect x="150" y="70" width="150" height="26" rx="4" fill="url(#caBody2)"/>';               // finder hood back
      s+='<path d="M150 72 L120 40 L330 40 L300 72 Z" fill="#0c0e12" stroke="#05060a" stroke-width="1.2"/>'; // open hood
      s+='<path d="M150 72 L120 40 L225 40 L225 72 Z" fill="#20242b" opacity=".6"/>';
      s+='<rect x="118" y="92" width="204" height="150" rx="12" fill="url(#caBody)" stroke="#05060a" stroke-width="1.5"/>';
      s+='<rect x="124" y="96" width="192" height="12" rx="6" fill="url(#caRim)" opacity=".45"/>';
      s+='<rect x="118" y="150" width="204" height="7" fill="#000" opacity=".3"/>';                    // body seam
      s+=caDial(300,120,15,12);
      s+=caLens(210,178,62);
      s+='</svg>'; return s;
    }
    if(type==="view"){
      s+='<rect x="70" y="232" width="300" height="12" rx="4" fill="url(#caMetal)"/>';                  // rail
      s+='<rect x="108" y="238" width="26" height="18" rx="3" fill="#2a2e35"/><rect x="306" y="238" width="26" height="18" rx="3" fill="#2a2e35"/>'; // standards feet
      s+='<rect x="300" y="96" width="40" height="150" rx="6" fill="url(#caBody)" stroke="#05060a" stroke-width="1.4"/>';  // rear standard (ground glass)
      s+='<rect x="306" y="104" width="28" height="120" rx="3" fill="#3a4b52" opacity=".55"/>';
      s+='<path d="M150 118 L300 104 L300 238 L150 224 Z" fill="url(#caBody2)"/>';                      // bellows body
      var rib=''; for(var i=1;i<9;i++){ var x=150+i*((300-150)/9); rib+='<line x1="'+x.toFixed(1)+'" y1="'+(118+ (i*0)).toFixed(1)+'" x2="'+x.toFixed(1)+'" y2="238" stroke="rgba(0,0,0,.35)" stroke-width="2"/>'; }
      s+=rib;
      s+='<rect x="96" y="96" width="70" height="150" rx="8" fill="url(#caBody)" stroke="#05060a" stroke-width="1.5"/>'; // front standard (lens board)
      s+=caLens(131,171,52);
      s+='</svg>'; return s;
    }
    // mirrorless + slr share a molded body; slr gets a pentaprism (and film lever)
    s+='<path d="M104 116 l-11 -5 l0 13 l11 -5 z" fill="#22262d"/><path d="M344 116 l11 -5 l0 13 l-11 -5 z" fill="#22262d"/>'; // strap lugs
    if(type==="slr"){
      s+='<path d="M176 106 L208 56 L240 56 L268 106 Z" fill="url(#caBody2)" stroke="#04050a" stroke-width="1.2"/>';   // pentaprism
      s+='<path d="M176 106 L208 56 L212 58 L192 106 Z" fill="#474d57" opacity=".5"/>';
      s+='<rect x="206" y="52" width="34" height="9" rx="2" fill="#23272e" stroke="#0a0c10" stroke-width="1"/>';
      if(curBody().id==="film35"){ s+='<path d="M328 92 q24 1 24 18 q0 11 -12 13" fill="none" stroke="url(#caMetal)" stroke-width="5" stroke-linecap="round"/>'; } // advance lever
    } else {
      s+='<path d="M188 108 L198 76 Q200 70 208 70 L248 70 Q256 70 258 76 L268 108 Z" fill="url(#caBody2)" stroke="#0a0c10" stroke-width="1"/>'; // EVF hump
      s+='<rect x="214" y="66" width="30" height="9" rx="2" fill="#23272e" stroke="#0a0c10" stroke-width="1"/>';                          // hot shoe
      s+='<ellipse cx="210" cy="91" rx="15" ry="8" fill="#0c0e12"/>';                                                                    // eyecup
    }
    // molded body (single silhouette incl. grip bulge)
    s+='<path d="M112 104 L300 104 Q334 104 346 122 Q374 150 368 186 Q362 220 330 238 L120 238 Q95 238 93 214 L93 128 Q93 104 112 104 Z" fill="url(#caBody)" stroke="#04050a" stroke-width="1.5"/>';
    s+='<path d="M104 132 L332 132 Q348 138 350 168 L350 210 Q346 232 322 234 L118 234 Q104 234 104 218 Z" fill="url(#caLeather)"/>';    // front leatherette band
    s+='<path d="M110 104 L300 104 Q328 104 338 120 L334 130 L108 130 Q104 130 104 120 Q104 104 118 104 Z" fill="url(#caTop)"/>';         // top plate
    s+='<rect x="104" y="129" width="238" height="2" fill="rgba(0,0,0,.34)"/>';                                                          // plate groove
    s+='<rect x="110" y="105" width="220" height="3.5" rx="2" fill="url(#caRim)" opacity=".65"/>';                                       // top rim light
    s+='<path d="M340 120 Q366 136 361 184 Q357 214 332 232" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="2.5" stroke-linecap="round"/>'; // grip outer highlight
    s+='<path d="M300 130 Q315 152 313 196 Q311 218 300 232" fill="none" stroke="rgba(0,0,0,.34)" stroke-width="9" stroke-linecap="round" opacity=".5"/>'; // grip/lens shadow channel
    s+=caDial(118,98,20,11);
    s+=caDial(320,100,16,10);
    s+='<circle cx="336" cy="94" r="7" fill="url(#caMetal)" stroke="#22252b"/><circle cx="336" cy="94" r="3" fill="#1a1c20"/>';          // shutter button
    // silver bayonet mount ring behind the lens
    s+='<circle cx="208" cy="176" r="76" fill="url(#caMetal)"/><circle cx="208" cy="176" r="76" fill="none" stroke="#191b1f" stroke-width="1.5"/>';
    s+='<circle cx="208" cy="104" r="2.4" fill="#33363d"/><circle cx="150" cy="228" r="2.4" fill="#33363d"/><circle cx="266" cy="228" r="2.4" fill="#33363d"/>'; // mount screws
    s+='<rect x="126" y="168" width="9" height="20" rx="3" fill="#2a2e35" stroke="#0a0c10"/>';                                           // lens-release
    s+='<circle cx="130" cy="152" r="5" fill="#e3ad57" opacity=".85"/><rect x="150" y="152" width="10" height="7" rx="2" fill="#2a2e35"/>'; // af lamp + button
    s+='<ellipse cx="208" cy="240" rx="60" ry="9" fill="rgba(0,0,0,.22)"/>';                                                             // AO under lens
    s+=caLens(208,176,70);
    s+='</svg>'; return s;
  }
  function focusBars(){ var n=Math.round(focusDist*5), s=""; for(var i=0;i<5;i++){ s+=(i<n?"▮":"▯"); } return s; }
  function setFocus(v){ focusDist=Math.max(0,Math.min(1,v)); var s=$("mFocus"); if(s) s.value=Math.round(focusDist*100); var fv=$("mFocusVal"); if(fv) fv.textContent=Math.round(focusDist*100); var vf=$("vfFocus"); if(vf) vf.textContent="FOCUS "+focusBars(); }

  // ---- camera basis (level FPS) ----
  var _fwd=new THREE.Vector3(), _right=new THREE.Vector3(), _qy=new THREE.Quaternion(), _qp=new THREE.Quaternion(), _mv=new THREE.Vector3();
  function basis(){
    _fwd.set(0,0,-1); _qy.setFromAxisAngle(UPY,yaw); _fwd.applyQuaternion(_qy);
    _right.crossVectors(_fwd,UPY).normalize();
    _qp.setFromAxisAngle(_right,pitch); _fwd.applyQuaternion(_qp).normalize();
  }
  function updateCamera(dt){
    basis();
    if(dt>0){
      var moving=(looking && !menuOpen());
      var maxV=sceneMaxDim*(0.02+moveScale*1.0); if(moving && (keys["ShiftLeft"]||keys["ShiftRight"])) maxV*=3.0;
      _mv.set(0,0,0);
      if(moving){
        var fb=(viewfinderOn?curBody().finder:""), rs=(fb==="waist"||fb==="ground")?-1:1, us=(fb==="ground")?-1:1;
        var walking=!!(WK.col&&WK.mode==="walk"), fw=walking?_fwd.clone().setY(0).normalize():_fwd;
        if(keys["KeyW"]) _mv.addScaledVector(fw,1); if(keys["KeyS"]) _mv.addScaledVector(fw,-1);
        if(keys["KeyD"]) _mv.addScaledVector(_right,rs); if(keys["KeyA"]) _mv.addScaledVector(_right,-rs);
        if(walking){ if(keys["KeyE"]) wkEye(us,dt); if(keys["KeyQ"]) wkEye(-us,dt); }
        else { if(keys["KeyE"]) _mv.addScaledVector(UPY,us); if(keys["KeyQ"]) _mv.addScaledVector(UPY,-us); }
      }
      if(_mv.lengthSq()>0) _mv.normalize().multiplyScalar(maxV);   // target velocity
      // frame-rate-independent smoothing: ease velocity toward target (smooth accel + glide to stop)
      var resp=moving?11.0:8.0, t=1-Math.exp(-resp*Math.min(dt,0.05));
      _vel.x+=(_mv.x-_vel.x)*t; _vel.y+=(_mv.y-_vel.y)*t; _vel.z+=(_mv.z-_vel.z)*t;
      if(WK.col&&WK.mode==="walk") _vel.y=0;
      if(_vel.lengthSq()>1e-10){
        if(WK.col) wkMove(dt); else camPos.addScaledVector(_vel, dt);
        if(boundsOn){ camPos.x=Math.min(Math.max(camPos.x,boxMin.x),boxMax.x); camPos.y=Math.min(Math.max(camPos.y,boxMin.y),boxMax.y); camPos.z=Math.min(Math.max(camPos.z,boxMin.z),boxMax.z); }
      }
    }
    if(dt>0) wkSettle(dt);
    camera.up.set(0,1,0); camera.position.copy(camPos);
    camera.lookAt(camPos.x+_fwd.x, camPos.y+_fwd.y, camPos.z+_fwd.z);
  }

  // ---- render ----
  function renderFrame(dt){
    var tgtE=viewfinderOn?(curBody().optical?1:expMult):1, tgtF=viewfinderOn?1:0, tgtV=viewfinderOn?apVig:0.1, tgtG=viewfinderOn?isoGrain:0, tgtD=viewfinderOn?dofStrength:0;
    var k=1-Math.pow(0.0015, Math.max(dt,0.0001));
    fx.exposure+=(tgtE-fx.exposure)*k; fx.filmic+=(tgtF-fx.filmic)*k; fx.vignette+=(tgtV-fx.vignette)*k; fx.grain+=(tgtG-fx.grain)*k; fx.dof+=(tgtD-fx.dof)*k;
    renderer.setRenderTarget(sceneRT); renderer.setClearColor(0x0e0f13,1); renderer.clear(true,true,true);
    if(viewer){ try{ viewer.update(); viewer.render(); }catch(e){} }
    renderer.setRenderTarget(null);
    fsMat.uniforms.tDiffuse.value=sceneRT.texture;
    fsMat.uniforms.exposure.value=fx.exposure; fsMat.uniforms.filmic.value=fx.filmic;
    fsMat.uniforms.vignette.value=fx.vignette; fsMat.uniforms.grain.value=fx.grain; fsMat.uniforms.dof.value=fx.dof; fsMat.uniforms.focus.value=focusDist;
    fsMat.uniforms.gCon.value=gCon; fsMat.uniforms.gSat.value=gSat; fsMat.uniforms.gWarm.value=gWarm+camWarm;
    fsMat.uniforms.gBloom.value=gBloom; fsMat.uniforms.gDof.value=gDof; fsMat.uniforms.gGrain.value=gGrain;
    seedCounter=(seedCounter+1)%9973; fsMat.uniforms.seed.value=seedCounter;
    renderer.render(fsScene,fsCam);
  }
  function animate(){ requestAnimationFrame(animate); var dt=Math.min(clock.getDelta(),0.1);
    if((typeof cbOpen!=="undefined" && cbOpen) || (typeof bg!=="undefined" && bg.open) || (typeof st!=="undefined" && st.open)) return;   // the camera back covers the scene: stop drawing it (big win on school PCs)
    if(loaded) updateCamera(dt); renderFrame(dt); if(viewfinderOn) vfLevelTick(); }
  animate();

  // ---- loading ----
  function showLoader(m){ loadmsg.textContent=m||"Loading scene…"; loadsub.textContent=""; loader.classList.add("show"); }
  function hideLoader(){ loader.classList.remove("show"); }
  function updateLoader(p,label){ loadsub.textContent=label||(Math.round(p||0)+"%"); }
  function upQuat(mode){ var q=new THREE.Quaternion();
    if(mode==="ydown") q.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI);
    else if(mode==="zup") q.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    else if(mode==="zdown") q.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
    return q; }
  function highlightUp(mode){ Array.prototype.forEach.call(document.querySelectorAll("#upSeg .btn"),function(b){ b.classList.toggle("on", b.getAttribute("data-up")===mode); }); }

  function frameScene(){
    // Robust placement: floaters wildly inflate the raw bounding box and drag its
    // centre off the subject, so we place the camera at the *median* of the splat
    // cloud (dense subject) and set the walls from the 2nd..98th percentile.
    var center=new THREE.Vector3(0,0,0), size=new THREE.Vector3(16,16,16), maxDim=8;
    var rmin=new THREE.Vector3(-8,-8,-8), rmax=new THREE.Vector3(8,8,8), robust=false;
    var pctVal=function(h,mn,rng,p){ var T=0,k,L=h.length; for(k=0;k<L;k++)T+=h[k]; if(T<=0) return mn+0.5*rng;
      var tgt=T*p,acc=0; for(k=0;k<L;k++){ acc+=h[k]; if(acc>=tgt) return mn+(k+0.5)/L*rng; } return mn+0.5*rng; };
    try{
      var mesh=viewer&&viewer.splatMesh, N=(mesh&&mesh.getSplatCount)?mesh.getSplatCount():0;
      if(N>200){
        var stride=Math.max(1,Math.floor(N/250000)), tmp=new THREE.Vector3(), i;
        var mnx=1e30,mny=1e30,mnz=1e30,mxx=-1e30,mxy=-1e30,mxz=-1e30,cnt=0;
        for(i=0;i<N;i+=stride){ mesh.getSplatCenter(i,tmp,true); if(!isFinite(tmp.x))continue;
          if(tmp.x<mnx)mnx=tmp.x; if(tmp.y<mny)mny=tmp.y; if(tmp.z<mnz)mnz=tmp.z;
          if(tmp.x>mxx)mxx=tmp.x; if(tmp.y>mxy)mxy=tmp.y; if(tmp.z>mxz)mxz=tmp.z; cnt++; }
        if(cnt>50 && mxx>mnx && mxy>mny && mxz>mnz){
          var B=200, hx=new Float64Array(B), hy=new Float64Array(B), hz=new Float64Array(B);
          var rx=(mxx-mnx)||1, ry=(mxy-mny)||1, rz=(mxz-mnz)||1, b;
          for(i=0;i<N;i+=stride){ mesh.getSplatCenter(i,tmp,true); if(!isFinite(tmp.x))continue;
            b=((tmp.x-mnx)/rx*(B-1))|0; hx[b<0?0:(b>B-1?B-1:b)]++;
            b=((tmp.y-mny)/ry*(B-1))|0; hy[b<0?0:(b>B-1?B-1:b)]++;
            b=((tmp.z-mnz)/rz*(B-1))|0; hz[b<0?0:(b>B-1?B-1:b)]++; }
          center.set(pctVal(hx,mnx,rx,0.5), pctVal(hy,mny,ry,0.5), pctVal(hz,mnz,rz,0.5));
          rmin.set(pctVal(hx,mnx,rx,0.02), pctVal(hy,mny,ry,0.02), pctVal(hz,mnz,rz,0.02));
          rmax.set(pctVal(hx,mnx,rx,0.98), pctVal(hy,mny,ry,0.98), pctVal(hz,mnz,rz,0.98));
          size.subVectors(rmax,rmin); maxDim=Math.max(size.x,size.y,size.z)||8; robust=true;
        }
      }
    }catch(e){ console.warn("robust frame failed",e); }
    if(!robust){
      try{ var box=viewer.splatMesh.computeBoundingBox(true);
        if(box && isFinite(box.min.x) && isFinite(box.max.x)){ box.getCenter(center); box.getSize(size); maxDim=Math.max(size.x,size.y,size.z)||8;
          rmin.copy(box.min); rmax.copy(box.max); }
      }catch(e2){ console.warn("bbox unavailable",e2); }
    }
    sceneMaxDim=maxDim;
    boxMin.copy(rmin); boxMax.copy(rmax);
    camPos.copy(center);
    camPos.y = center.y + (rmax.y-rmin.y)*0.12;   // lift off the ground to a natural standing eye height
    yaw=0; pitch=0; if(WK.col) wkSpawn(center);
    camera.near=Math.max(maxDim*0.0006,0.01); camera.far=maxDim*12+100; camera.updateProjectionMatrix();
  }

  function loadSplat(source, up, keepCol){ if(!keepCol) WK.col=null;
    var isFile=(source instanceof File), url=source, format;
    if(isFile){ var ext=source.name.split(".").pop().toLowerCase(); format=FMT[ext];
      if(format===undefined){ toast("Unsupported file. Use a .ply, .splat or .ksplat."); return; } url=URL.createObjectURL(source);
    } else { var e2=source.split("?")[0].split(".").pop().toLowerCase(); format=(FMT[e2]!==undefined)?FMT[e2]:GS.SceneFormat.Splat; }
    lastSource=source; lastFormat=format; lastUp=up||"yup"; highlightUp(lastUp);
    viewfinderOn=false; viewfinder.classList.remove("on");
    hide(landing); hide(menu); hide(gallery); hide(prompt); showLoader("Loading scene…");
    var q=upQuat(lastUp);
    var disposeOld=viewer?Promise.resolve(viewer.dispose()).catch(function(){}):Promise.resolve();
    disposeOld.then(function(){
      viewer=null; loaded=false; scene=new THREE.Scene();
      viewer=new GS.Viewer({selfDrivenMode:false,useBuiltInControls:false,renderer:renderer,camera:camera,threeScene:scene,sharedMemoryForWorkers:false});
      return viewer.addSplatScene(url,{format:format, rotation:[q.x,q.y,q.z,q.w], showLoadingUI:false, progressiveLoad:false, splatAlphaRemovalThreshold:5, onProgress:function(p,l){updateLoader(p,l);}});
    }).then(function(){
      frameScene(); loaded=true; hideLoader(); show(hud); App.go("scene"); updateCamera(0); computeCam(); refreshCount(); updateCrosshair(); updatePrompt(); updateBriefUI();
      var fo=$("fadeover"); if(fo){ fo.style.transition="none"; fo.style.opacity="1"; requestAnimationFrame(function(){ fo.style.transition=""; fo.style.opacity="0"; }); }
      if(!tutSeen()){ setTimeout(function(){ showTutorial(0); }, 750); } else { toast("Click to look around · P raises the camera · Space for the menu"); }
    }).catch(function(err){
      console.error("Load failed:",err); hideLoader();
      if(viewer){ try{viewer.dispose();}catch(e){} viewer=null; } loaded=false; show(landing);
      var m=String(err&&err.message||err||"");
      if(/fetch|network|Failed to fetch|CORS/i.test(m)) toast("Couldn't download that sample — check the connection, or load a file from this computer instead.");
      else toast("Couldn't load that splat ("+m.slice(0,80)+")");
    });
  }
  function reloadWithUp(up){ if(lastSource!==null) loadSplat(lastSource,up); }
  // ---- bundled scenes (embedded in the file) ----
  // .stm: Studium's packed scan (zlib, 16-bit positions and log scales, byte planes), unpacked to .splat here.
  // Light detail keeps the more solid half of the splats for slower school computers.
  var sceneDetail=(function(){ try{ return localStorage.getItem("studium_detail")||"full"; }catch(e){ return "full"; } })();
  function stmUnpack(buf, light){ var step=light==="test"?10:2; var dv=new DataView(buf), n=dv.getUint32(4,true), f=new Float32Array(buf.slice(8,40)), b=new Uint8Array(buf,40), N=n;
    var keep=null; if(light){ keep=new Uint8Array(n); N=0; var A=12*n+3*n; for(var j=0;j<n;j++){ if(b[A+j]>=40&&j%step===0){ keep[j]=1; N++; } } }
    var out=new ArrayBuffer(N*32), F=new Float32Array(out), U=new Uint8Array(out), o=0, k, ch;
    var sx=[(f[3]-f[0])/65535,(f[4]-f[1])/65535,(f[5]-f[2])/65535], ss=(f[7]-f[6])/65535;
    for(var i=0;i<n;i++){ if(keep&&!keep[i]) continue; var fo=o*8, uo=o*32;
      for(ch=0;ch<6;ch++){ var base=ch*2*n, v=b[base+i]|(b[base+n+i]<<8); F[fo+ch]=ch<3?f[ch]+v*sx[ch]:Math.exp(f[6]+v*ss); }
      for(k=0;k<8;k++) U[uo+24+k]=b[12*n+k*n+i]; o++; }
    return out; }
  function loadBundled(sc){ if(sc&&sc.name) cbPlace=sc.name; showLoader("Opening "+(sc.name||"the scan")+"…");
    fetch("data:application/octet-stream;base64,"+sc.data).then(function(r){ return r.arrayBuffer(); }).then(function(ab){
      if(sc.ext!=="stm") return {buf:ab, ext:sc.ext||"splat"};
      var ds=new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream("deflate")));
      return ds.arrayBuffer().then(function(raw){ return {buf:stmUnpack(raw, sceneDetail==="full"?false:sceneDetail), ext:"splat"}; }); })
    .then(function(r){ return wkLoad(sc.collide).then(function(){ return r; }); })
    .then(function(r){ var f=new File([r.buf],(sc.id||"scene")+"."+r.ext,{type:"application/octet-stream"}); loadSplat(f, sc.up||"ydown", true); })
    .catch(function(e){ console.warn(e); hideLoader(); toast("Couldn't open that scene."); }); }
  function buildScenePicker(){ var host=$("sceneRow"); if(!host) return; var list=(window.SPLAT_SCENES||[]);
    if(!list.length){ host.style.display="none"; var h=$("sceneHead"),o=$("orSep"); if(h)h.style.display="none"; if(o)o.style.display="none"; return; }
    host.innerHTML=""; list.forEach(function(sc){ var c=document.createElement("button"); c.className="scenecard";
      var shot=photos.filter(function(p){ return (p.place||"")===sc.name; }).length;
      c.innerHTML="<div class='sc-thumb'>"+(sc.thumb?"<img src='"+sc.thumb+"' alt=''>":"")+"</div><div class='sc-meta'><div class='sc-name'>"+esc(sc.name||"Scene")+"</div><div class='sc-desc'>"+esc(sc.desc||"")+"</div><div class='sc-foot'><span>"+(shot?shot+" FRAME"+(shot===1?"":"S")+" SHOT HERE":"NOT SHOT YET")+"</span><span class='go'>WALK IN <kbd>↵</kbd></span></div></div>";
      c.onclick=function(){ loadBundled(sc); }; host.appendChild(c); });
    var nx=document.createElement("div"); nx.className="scenecard next"; nx.innerHTML="<div class='sc-thumb'><span>NEXT LOCATION</span></div><div class='sc-meta'><div class='sc-name'>More places</div><div class='sc-desc'>Your folio panel wants three series. New scans arrive here; your teacher can add their own.</div></div>"; host.appendChild(nx); }
  // ---- suite hub navigation ----
  var suiteFrom="scene", punctumLoaded=false;
  function hubHide(id){ var e=$(id); if(e) e.classList.add("hidden"); }
  function hubShow(id){ var e=$(id); if(e) e.classList.remove("hidden"); }
  function showHub(){ suiteFrom="scene"; if(looking){ try{document.exitPointerLock();}catch(e){} }
    viewfinderOn=false; var vf=$("viewfinder"); if(vf) vf.classList.remove("on");
    if(typeof cbOpen!=="undefined"&&cbOpen) closeBack(false);
    ["landing","studio","punctum","menu","gallery","editor","folio","photobook","galleryshow","hud","prompt","signin","teacher"].forEach(hubHide); hubShow("hub"); if(!App.go("hub")&&typeof hubRender==="function") hubRender(); }
  function openSplatViewer(){ suiteFrom="scene"; hubHide("hub"); App.go(loaded?"scene":"landing"); if(loaded){ hubShow("hud"); if(typeof updatePrompt==="function") updatePrompt(); } else { buildScenePicker(); hubShow("landing"); } }
  function openStudioHome(){ hubHide("hub"); hubShow("studio"); studioSync(); App.go("studio"); }
  function openPunctum(){ hubHide("hub"); hubShow("punctum"); App.go("punctum");
    if(!punctumLoaded){ var fr=$("punctumFrame"); if(fr && window.PUNCTUM_B64){ try{ var bin=atob(window.PUNCTUM_B64), by=new Uint8Array(bin.length), i; for(i=0;i<bin.length;i++) by[i]=bin.charCodeAt(i); fr.srcdoc=new TextDecoder("utf-8").decode(by); punctumLoaded=true; }catch(e){ toast("Couldn't open Punctum."); } } } }
  function studioSync(){ var c=$("stCount"); if(c) c.textContent=(photos.length? photos.length+" photo"+(photos.length>1?"s":"")+" ready" : "No photos yet — shoot some in the Splat viewer, or upload below"); }
  function studioReturn(){ if(suiteFrom==="studio"){ suiteFrom="scene"; hubShow("studio"); studioSync(); } }

  // ---- session persistence (IndexedDB — survives closing the tab, fully offline) ----
  var _db=null, _saveT=null, sessionRestored=false;
  function idb(cb){ if(_db){ cb(_db); return; } try{ var r=indexedDB.open("splatstudio",1);
    r.onupgradeneeded=function(e){ try{ e.target.result.createObjectStore("state"); }catch(_){} };
    r.onsuccess=function(e){ _db=e.target.result; cb(_db); }; r.onerror=function(){ cb(null); }; }catch(e){ cb(null); } }
  function sessionData(){ return { v:1, savedAt:Date.now(), studentName:studentName, briefDone:briefDone,
    photos:photos.map(function(p){ return {url:p.url,orig:p.orig||null,dev:p.dev||null,id:p.id||null,copy:!!p.copy,t:p.t,f:p.f,sh:p.sh,iso:p.iso,mm:p.mm,body:p.body,brief:p.brief,edited:p.edited,uploaded:p.uploaded,rating:p.rating||0,pick:!!p.pick,reject:!!p.reject,note:p.note||"",place:p.place||null,order:p.order==null?null:p.order}; }),
    workshop:(typeof st!=="undefined"?st.wsPages:[]), wsBoard:(typeof st!=="undefined"?st.wsBoard:null), foBoard:(typeof st!=="undefined"?st.foBoard:null), galleryPrefs:(typeof ga!=="undefined"?{frame:ga.frame,gap:ga.gap,sizes:ga.sizes,pos:ga.pos,title:ga.title}:null), book:(typeof bk!=="undefined"&&bk.pages.length?{size:bk.size,pages:bk.pages}:null),
    folio:(typeof foItems!=="undefined"&&foItems?foItems.map(function(it){ return {url:it.url,size:it.size}; }):[]),
    pbPages:(typeof pbPages!=="undefined"&&pbPages&&pbPages.length?pbPages.map(function(pg){ return pg.cover?{cover:true}:{frames:(pg.frames||[]).map(function(f){ return {url:f.url,x:f.x,y:f.y,w:f.w,h:f.h}; })}; }):null) }; }
  function saveSessionNow(){ if(!photos.length && !(typeof foItems!=="undefined"&&foItems&&foItems.length)) return; idb(function(db){ if(!db) return; try{ db.transaction("state","readwrite").objectStore("state").put(sessionData(),"session"); }catch(e){} }); }
  function saveSession(){ clearTimeout(_saveT); _saveT=setTimeout(saveSessionNow, 700); }
  function loadSession(cb){ idb(function(db){ if(!db){ cb&&cb(false); return; } try{ var rq=db.transaction("state","readonly").objectStore("state").get("session");
    rq.onsuccess=function(){ var d=rq.result; if(d&&d.photos&&d.photos.length){ applySession(d); cb&&cb(true,d.photos.length); } else cb&&cb(false); };
    rq.onerror=function(){ cb&&cb(false); }; }catch(e){ cb&&cb(false); } }); }
  function applySession(d){ try{
    if(d.studentName){ studentName=d.studentName; var nm=$("mName"); if(nm) nm.value=studentName; }
    if(d.briefDone) briefDone=d.briefDone;
    if(d.workshop&&d.workshop.length&&typeof st!=="undefined") st.wsPages=d.workshop;
    if(d.book&&d.book.pages&&typeof bk!=="undefined"){ bk.size=d.book.size||"20x25"; bk.pages=d.book.pages; }
    if(d.galleryPrefs&&typeof ga!=="undefined"){ ga.frame=d.galleryPrefs.frame||"black"; ga.gap=d.galleryPrefs.gap||250; ga.sizes=d.galleryPrefs.sizes||{}; ga.pos=d.galleryPrefs.pos||{}; ga.title=d.galleryPrefs.title||""; }
    if(d.wsBoard&&typeof st!=="undefined"){ st.wsBoard=d.wsBoard; wsB.reset(d.wsBoard); }
    if(d.foBoard&&typeof st!=="undefined"){ st.foBoard=d.foBoard; foB.reset(d.foBoard); }
    (d.photos||[]).forEach(function(p){ p.t=p.t?new Date(p.t):new Date(); photos.push(p); });
    if(d.folio&&d.folio.length&&typeof foItems!=="undefined") foItems=d.folio.map(function(x){ return {url:x.url,size:x.size}; });
    if(d.pbPages&&d.pbPages.length&&typeof pbPages!=="undefined") pbPages=d.pbPages.map(function(pg){ return pg.cover?{cover:true}:{frames:(pg.frames||[]).map(function(f){ return {url:f.url,x:f.x,y:f.y,w:f.w,h:f.h}; })}; });
    sessionRestored=true; refreshCount();
  }catch(e){} }
  function clearSession(){ idb(function(db){ if(db){ try{ db.transaction("state","readwrite").objectStore("state").delete("session"); }catch(e){} } });
    photos.length=0; if(typeof foItems!=="undefined") foItems=[]; if(typeof pbPages!=="undefined") pbPages=[];
    if(typeof foClearBoard==="function") try{ foClearBoard(); }catch(e){} refreshCount(); }

  // ---- teach-as-you-shoot: a plain photography nudge tied to the settings just used ----
  var _tipT=null;
  function showTip(h,b){ var e=$("shotTip"); if(!e) return; e.querySelector(".st-h").textContent=h; e.querySelector(".st-b").textContent=b;
    e.classList.remove("hidden"); void e.offsetWidth; e.classList.add("show"); clearTimeout(_tipT); _tipT=setTimeout(function(){ e.classList.remove("show"); }, 6500); }
  function photoTip(){ var ap=APERTURES[apIdx], mm=focalMM, sh=SHUTTER_LABELS[shIdx], iso=ISOS[isoIdx], tips=[];
    if(ap<=2.0) tips.push(["Wide aperture · f/"+ap,"The background melts into soft blur so your subject pops — classic for portraits and detail."]);
    else if(ap>=11) tips.push(["Small aperture · f/"+ap,"Sharp from front to back — everything stays in focus. Great for landscapes and architecture."]);
    var m=/^1\/(\d+)/.exec(sh), den=m?+m[1]:0;
    if(sh==="1/2"||sh==="1/4"||(den&&den<=15)) tips.push(["Slow shutter · "+sh,"Anything moving smears into blur — hold very still, or use it on purpose for motion streaks."]);
    else if(den>=500) tips.push(["Fast shutter · "+sh,"Freezes motion crisp and sharp — good for anything that moves."]);
    if(iso>=3200) tips.push(["High ISO · "+iso,"Brighter in low light, but you'll see more grain. Bring it down when there's enough light."]);
    if(mm<=24) tips.push(["Wide lens · "+mm+"mm","Takes in a lot and exaggerates depth — step in close to your subject for real drama."]);
    else if(mm>=100) tips.push(["Telephoto · "+mm+"mm","Compresses distance and lifts your subject cleanly off the background."]);
    if(!tips.length) tips.push(["Balanced exposure","A clean, neutral setup. Now change one dial — aperture, shutter or ISO — and watch what it does to the shot."]);
    if(viewfinderOn && typeof vfToast==="function") vfToast(tips[0][1]); else showTip(tips[0][0], tips[0][1]); }

  // ---- first-run tutorial (coach-marks) ----
  var TUT=[
    {ico:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="6" y="13" width="36" height="27" rx="4"/><circle cx="24" cy="26" r="8"/><path d="M17 13l3-5h8l3 5"/></svg>', s:"Step inside", b:"You're standing inside a real place, captured in 3D. Move around and look closely — you can walk right up to things."},
    {ico:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="16" y="6" width="16" height="27" rx="8"/><path d="M24 6v9"/></svg>', s:"Look around", b:"Click the scene, then move your mouse to look. Press Esc to let the mouse go again."},
    {ico:'<span class="kc"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>', s:"Walk through it", b:"W A S D to move, E and Q for up and down, and hold Shift to move faster."},
    {ico:'<span class="kc"><kbd>P</kbd></span>', s:"Raise the camera", b:"Press P to bring the camera up to your eye — the viewfinder frame appears."},
    {ico:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="12" width="38" height="28" rx="3"/><path d="M5 21.3h38M5 30.6h38M17.6 12v28M30.3 12v28"/></svg>', s:"Frame and shoot", b:"Aim, then click or press Enter to take the shot. Press G to cycle composition guides like the rule of thirds."},
    {ico:'<span class="kc"><kbd style="min-width:72px">Space</kbd></span>', s:"Flip the camera", b:"Press Space to flip to the camera back. Set shutter, aperture and ISO with the arrows or the scroll wheel and watch the meter. Press B for the camera bag to change body or lens."},
    {ico:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="6" y="9" width="24" height="18" rx="2"/><rect x="17" y="20" width="25" height="17" rx="2"/></svg>', s:"Make something", b:"Your photos save automatically. Open Photo studio from the hub to build a folio, a photobook or a gallery show."}
  ];
  var tutI=0;
  function tutSeen(){ try{ return localStorage.getItem("splat_tut_v1")==="1"; }catch(e){ return false; } }
  function setTutSeen(){ try{ localStorage.setItem("splat_tut_v1","1"); }catch(e){} }
  function renderTut(){ var t=TUT[tutI]; if(!$("tutIco")) return; $("tutIco").innerHTML=t.ico; $("tutStep").textContent="Step "+(tutI+1)+" of "+TUT.length; $("tutTitle").innerHTML=t.s; $("tutBody").innerHTML=t.b;
    var d="",i; for(i=0;i<TUT.length;i++) d+='<i class="'+(i===tutI?"on":"")+'"></i>'; $("tutDots").innerHTML=d;
    $("tutBack").style.visibility=(tutI===0)?"hidden":"visible"; $("tutNext").textContent=(tutI===TUT.length-1)?"Start shooting":"Next"; }
  function showTutorial(i){ tutI=i||0; renderTut(); var e=$("tutorial"); if(e) e.classList.remove("hidden"); }
  function endTutorial(){ var e=$("tutorial"); if(e) e.classList.add("hidden"); setTutSeen(); }

  // ---- viewfinder + photos ----
  function raiseCamera(){ if(!loaded) return; App.note("viewfinder"); viewfinderOn=true; viewfinder.classList.add("on"); updateCrosshair(); updatePrompt(); computeCam(); applyFinder(); drawComp(); }
  function lowerCamera(){ if(App.state==="viewfinder") App.note("scene"); var was=viewfinderOn; viewfinderOn=false; viewfinder.classList.remove("on"); updateCrosshair(); updatePrompt(); applyFinder(); if(was) computeCam(); }
  // ---- composition / framing guides (in-frame, teach composition in any scene) ----
  var COMP=["off","thirds","phi","center","diagonal","grid"], compIdx=1;
  var COMP_NAMES={off:"",thirds:"Rule of thirds",phi:"Golden ratio",center:"Centre",diagonal:"Diagonals",grid:"Grid"};
  function drawComp(){ var svg=$("vfComp"), lbl=$("vfCompLbl"); if(!svg) return; var m=COMP[compIdx], s="";
    function ln(a,b,c,d){ return '<line x1="'+a+'" y1="'+b+'" x2="'+c+'" y2="'+d+'"/>'; }
    function pt(x,y){ return '<circle class="pp" cx="'+x+'" cy="'+y+'" r="1.5"/>'; }
    if(m==="thirds"){ s+=ln(33.33,0,33.33,100)+ln(66.66,0,66.66,100)+ln(0,33.33,100,33.33)+ln(0,66.66,100,66.66); }
    else if(m==="phi"){ s+=ln(38.2,0,38.2,100)+ln(61.8,0,61.8,100)+ln(0,38.2,100,38.2)+ln(0,61.8,100,61.8); }
    else if(m==="center"){ s+=ln(50,0,50,100)+ln(0,50,100,50)+'<circle class="ctr" cx="50" cy="50" r="7"/>'; }
    else if(m==="diagonal"){ s+=ln(0,0,100,100)+ln(100,0,0,100)+ln(0,0,50,100)+ln(100,0,50,100)+ln(0,100,50,0)+ln(100,100,50,0); }
    else if(m==="grid"){ [25,50,75].forEach(function(v){ s+=ln(v,0,v,100)+ln(0,v,100,v); }); }
    svg.innerHTML=s; svg.style.opacity=(m==="off")?"0":"1";
    if(lbl){ lbl.textContent=COMP_NAMES[m]||""; lbl.style.opacity=(m==="off")?"0":"1"; }
    if(typeof vfRenderChips==="function") vfRenderChips(); }
  function cycleComp(){ compIdx=(compIdx+1)%COMP.length; drawComp(); }
  // ---- capture flourish: the shot flies to the photo counter ----
  function captureFX(url){ try{
    var frame=$("vfFrame"); if(!frame) return; var fr=frame.getBoundingClientRect();
    var target=$("photoCount"), tg=target?target.getBoundingClientRect():{left:innerWidth-46,top:16,width:24,height:24};
    var img=$("captureFly"); if(!img){ img=document.createElement("img"); img.id="captureFly"; document.body.appendChild(img); }
    img.src=url; img.style.transition="none"; img.style.left=fr.left+"px"; img.style.top=fr.top+"px"; img.style.width=fr.width+"px"; img.style.height=fr.height+"px"; img.style.opacity="1"; img.style.transform="none"; img.style.transformOrigin="center";
    void img.offsetWidth;
    var tx=(tg.left+tg.width/2)-(fr.left+fr.width/2), ty=(tg.top+tg.height/2)-(fr.top+fr.height/2);
    img.style.transition="transform .58s cubic-bezier(.5,0,.15,1),opacity .58s ease";
    img.style.transform="translate("+tx+"px,"+ty+"px) scale(0.05)"; img.style.opacity="0.15";
    clearTimeout(img._t); img._t=setTimeout(function(){ img.style.opacity="0"; if(target){ target.classList.remove("pulse"); void target.offsetWidth; target.classList.add("pulse"); } }, 560);
  }catch(e){} }
  function toggleViewfinder(){ if(viewfinderOn) lowerCamera(); else raiseCamera(); }
  function fireFlash(){ var f=$("flash"); f.classList.remove("fire"); void f.offsetWidth; f.classList.add("fire");
    var b=$("shutterBlade"); b.classList.remove("fire"); void b.offsetWidth; b.classList.add("fire"); }
  function shutterSound(){
    if(!soundOn) return;
    try{
      if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==="suspended") audioCtx.resume();
      var sr=audioCtx.sampleRate, len=Math.floor(sr*0.05), buf=audioCtx.createBuffer(1,len,sr), d=buf.getChannelData(0);
      for(var i=0;i<len;i++){ var e=1-i/len; d[i]=(Math.random()*2-1)*e*e; }
      function click(at,gain){ var s=audioCtx.createBufferSource(); s.buffer=buf; var g=audioCtx.createGain(); g.gain.value=gain; s.connect(g); g.connect(audioCtx.destination); s.start(at); }
      var t=audioCtx.currentTime; click(t,0.28); click(t+0.055,0.2);   // mirror-up / mirror-down slap
    }catch(e){}
  }
  function refreshCount(){ photoNum.textContent=photos.length; var m=$("menuPhotoCount"); if(m)m.textContent=photos.length; }
  function shutter(){
    if(!loaded) return;
    if(!viewfinderOn){ raiseCamera(); return; }        // first press raises the camera
    var keepE=fx.exposure; fx.exposure=expMult; renderFrame(0);   // the sensor always records the real exposure, even when an optical finder hid it
    var url; try{ url=captureAspect(curBody().aspect); }catch(e){ fx.exposure=keepE; toast("Couldn't capture this shot."); return; }
    fx.exposure=keepE;
    var brf=activeBrief>=0?BRIEFS[activeBrief]:null;
    photos.push({url:url,t:new Date(),f:APERTURES[apIdx],sh:SHUTTER_LABELS[shIdx],iso:ISOS[isoIdx],mm:focalMM,body:curBody().name,brief:brf?brf.t:null,place:cbPlace});
    if(brf){ briefDone[brf.id]=(briefDone[brf.id]||0)+1; buildBriefList(); }
    refreshCount(); fireFlash(); shutterSound(); captureFX(url); vfRefresh();
    if(brf) toast("“"+brf.t+"” captured ✓");
    if(curBody().film){ var onBody=photos.filter(function(p){ return p.body===curBody().name; }).length; if(onBody%(curBody().roll||10)===0) toast("Roll finished. A fresh roll is loaded."); }
    photoTip(); saveSession();
  }
  function namePrefix(){ return studentName?studentName.replace(/[^\w -]/g,"").trim().replace(/\s+/g,"-")+"-":""; }
  function fileName(i){ return namePrefix()+"splat-photo-"+String(i+1).padStart(2,"0")+".png"; }

  function buildGallery(){
    $("galHeadCount").textContent=photos.length; var body=$("galBody"); body.innerHTML="";
    if(photos.length===0){ body.innerHTML="<div class='empty'>No photos yet. Press <b>P</b> to raise the camera, aim, then click or press <b>Enter</b> to shoot.</div>"; return; }
    var g=document.createElement("div"); g.className="grid-photos";
    photos.forEach(function(ph,i){ var el=document.createElement("div"); el.className="shot"; var fn=fileName(i);
      el.innerHTML="<img src='"+ph.url+"' alt='photo "+(i+1)+"'>"+
        "<div class='meta'><span class='mono'>"+(ph.edited?"✎ ":"")+"f/"+ph.f+" · "+ph.sh+" · ISO"+ph.iso+"</span><span>"+(ph.brief?ph.brief:ph.t.toLocaleTimeString())+"</span></div>"+
        "<div class='acts'>"+
          "<button class='iconbtn edit' title='Edit' data-i='"+i+"'>✎</button>"+
          "<a class='iconbtn' title='Download' download='"+fn+"' href='"+ph.url+"'>⭳</a>"+
          "<button class='iconbtn del' title='Delete' data-i='"+i+"'>✕</button>"+
        "</div>";
      g.appendChild(el); });
    body.appendChild(g);
    Array.prototype.forEach.call(g.querySelectorAll(".del"),function(b){ b.onclick=function(){ photos.splice(+b.dataset.i,1); refreshCount(); buildGallery(); }; });
    Array.prototype.forEach.call(g.querySelectorAll(".edit"),function(b){ b.onclick=function(){ openEditor(+b.dataset.i); }; });
  }
  function openGallery(){ if(looking) document.exitPointerLock(); lowerCamera(); App.note("studio.photos"); buildGallery(); hide(menu); hide(editor); show(gallery); updatePrompt(); }

  function exportContactSheet(){
    if(!photos.length){ toast("No photos yet."); return; }
    toast("Building contact sheet…");
    var cols=3, pad=26, gap=20, cellW=440, thumbH=Math.round(cellW*0.66), capH=54, headH=96;
    var rows=Math.ceil(photos.length/cols);
    var W=pad*2+cols*cellW+(cols-1)*gap, H=headH+rows*(thumbH+capH+gap)-gap+pad;
    var cv=document.createElement("canvas"); cv.width=W; cv.height=H; var c=cv.getContext("2d");
    c.fillStyle="#14161c"; c.fillRect(0,0,W,H);
    c.fillStyle="#eef1f6"; c.font="700 30px system-ui,sans-serif"; c.fillText("Splat Explorer — contact sheet", pad, 50);
    c.fillStyle="#9aa3b2"; c.font="500 17px system-ui,sans-serif";
    c.fillText((studentName?studentName+"   ·   ":"")+new Date().toLocaleDateString()+"   ·   "+photos.length+" photo"+(photos.length>1?"s":""), pad, 78);
    var loaded=0, imgs=[];
    photos.forEach(function(ph,i){ var img=new Image(); imgs[i]=img; img.onload=function(){ draw(i); done(); }; img.onerror=function(){ done(); }; img.src=ph.url; });
    function draw(i){
      var ph=photos[i], img=imgs[i], col=i%cols, row=Math.floor(i/cols);
      var x=pad+col*(cellW+gap), y=headH+row*(thumbH+capH+gap);
      c.fillStyle="#0c0d11"; c.fillRect(x,y,cellW,thumbH);
      var s=Math.min(cellW/img.naturalWidth, thumbH/img.naturalHeight), iw=img.naturalWidth*s, ih=img.naturalHeight*s;
      c.drawImage(img, x+(cellW-iw)/2, y+(thumbH-ih)/2, iw, ih);
      c.strokeStyle="rgba(255,255,255,0.12)"; c.strokeRect(x+0.5,y+0.5,cellW-1,thumbH-1);
      c.fillStyle="#eef1f6"; c.font="700 16px system-ui,sans-serif"; c.fillText("#"+(i+1)+(ph.brief?"   ·   "+ph.brief:"")+(ph.edited?"   ·   edited":""), x, y+thumbH+24);
      c.fillStyle="#9aa3b2"; c.font="500 14px ui-monospace,Menlo,Consolas,monospace"; c.fillText("f/"+ph.f+"   "+ph.sh+"   ISO"+ph.iso+"   "+ph.mm+"mm", x, y+thumbH+44);
    }
    function done(){ loaded++; if(loaded>=photos.length){ var url; try{url=cv.toDataURL("image/png");}catch(e){toast("Couldn't build the sheet.");return;} var a=document.createElement("a"); a.href=url; a.download=namePrefix()+"contact-sheet.png"; document.body.appendChild(a); a.click(); a.remove(); toast("Contact sheet downloaded"); } }
  }

  // ---- editor (Lightroom-style Develop panel, WebGL processing) ----
  var edState=null, edSrc=null, edRC=null, rcW=1, rcH=1;
  var edShowOrig=false, edVZoom=1, edVX=0, edVY=0, edHist=[], edHistI=-1, edRestoring=false;
  var egl=null, glc=null, eglProg=null, eglTex=null, eglBuf=null, eglU={}, eglBad=false, eglReadBuf=null;
  var edRafPending=false, edHistTimer=0, edHover=false;
  var PROFILES={ color:{sat:0,con:0,warm:0}, mono:{sat:0,con:0,warm:0}, vivid:{sat:0.18,con:0.10,warm:0}, flat:{sat:-0.25,con:-0.12,warm:0}, portrait:{sat:-0.05,con:-0.03,warm:0.12} };
  var EDEF={ exposure:0,contrast:0,highlights:0,shadows:0,whites:0,blacks:0, temp:0,tint:0,vibrance:0,saturation:0,
    texture:0,clarity:0,dehaze:0,vignette:0,grain:0,grainSize:25,grainRough:50,glow:0,
    mono:0,hdr:0,profile:"color",wb:"asshot", aspect:"free",zoom:1,rot:0,cx:0.5,cy:0.5, secLight:1,secColor:1,secEffects:1 };
  function defEd(i){ var o={},k; for(k in EDEF) o[k]=EDEF[k]; o.i=i; return o; }
  var EV_VS="attribute vec2 aPos;varying vec2 vUv;void main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }";
  var EV_FS=[
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D tex;",
    "uniform vec2 cropOff, cropScale, uTexel;",
    "uniform float exposure, contrast, highlights, shadows, whites, blacks;",
    "uniform float temp, tint, vibrance, saturation;",
    "uniform float texturef, clarity, dehaze, vignette, grain, grainSize, grainRough, glow;",
    "uniform float mono, hdr, seed, pSat, pCon, pWarm, bypass;",
    "float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }",
    "float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }",
    "vec2 sUV(vec2 uv){ return cropOff + uv*cropScale; }",
    "vec3 blurRing(vec2 uv, float rad){ vec2 s=sUV(uv); vec3 a=texture2D(tex,s).rgb; for(int i=0;i<8;i++){ float an=float(i)*0.785398; vec2 o=vec2(cos(an),sin(an))*rad*uTexel; a+=texture2D(tex,s+o).rgb; } return a*0.111111; }",
    "void main(){",
    "  vec3 c = texture2D(tex, sUV(vUv)).rgb;",
    "  if(bypass>0.5){ gl_FragColor=vec4(c,1.0); return; }",
    "  c *= exp2(exposure*2.0);",
    "  c.r += temp*0.09; c.b -= temp*0.09;",
    "  c.r += tint*0.04; c.b += tint*0.04; c.g -= tint*0.06;",
    "  c.r += pWarm*0.06; c.b -= pWarm*0.06;",
    "  c = max(c, 0.0);",
    "  float l = luma(c);",
    "  float nl = l;",
    "  nl += highlights*0.16*smoothstep(0.25,1.0,l)*(1.0-0.5*smoothstep(0.9,1.0,l));",
    "  nl += shadows*0.16*(1.0-smoothstep(0.0,0.6,l));",
    "  nl += whites*0.13*smoothstep(0.55,1.0,l);",
    "  nl += blacks*0.13*(1.0-smoothstep(0.0,0.30,l));",
    "  nl = max(nl,0.0); c *= (l>0.0008)? nl/l : 1.0;",
    "  float con = contrast + pCon;",
    "  if(con>0.001){ vec3 s=clamp(c,0.0,1.0); s=s*s*(3.0-2.0*s); c=mix(c,s,con*0.45); }",
    "  else if(con<-0.001){ c=(c-0.5)*(1.0+con*0.6)+0.5; }",
    "  if(abs(dehaze)>0.001){ c=(c-0.5)*(1.0+dehaze*0.35)+0.5; c.b -= dehaze*0.025; }",
    "  if(abs(texturef)>0.001){ vec3 lo=blurRing(vUv,2.2); c += (c-lo)*texturef*0.9; }",
    "  if(abs(clarity)>0.001){ vec3 lo=blurRing(vUv,7.0); float mw=1.0-abs(luma(c)*2.0-1.0); c += (c-lo)*clarity*0.75*(0.4+0.6*mw); }",
    "  if(glow>0.001){ vec3 b=blurRing(vUv,11.0); vec3 hi=max(b-0.6,0.0); c += hi*glow*1.3; }",
    "  c = max(c,0.0);",
    "  float l2=luma(c);",
    "  c = mix(vec3(l2), c, 1.0+(saturation+pSat)*0.8);",
    "  float mx=max(max(c.r,c.g),c.b), mn=min(min(c.r,c.g),c.b);",
    "  c = mix(vec3(luma(c)), c, 1.0+vibrance*(1.0-(mx-mn))*0.9);",
    "  c = c/(1.0+max(c-0.72,0.0)*1.3);",
    "  if(hdr>0.5){ vec3 x=max(c,0.0); c=(x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14); c*=1.06; }",
    "  if(mono>0.5){ c=vec3(luma(c)); }",
    "  float d=distance(vUv, vec2(0.5))*1.42;",
    "  c *= 1.0 + vignette*0.9*smoothstep(0.35,1.0,d);",
    "  if(grain>0.001){ float sc=mix(1.0,4.0,1.0-grainSize); float n=hash(floor(gl_FragCoord.xy/max(sc,0.5))+seed); n=mix(0.5,n,0.55+0.9*grainRough); c += (n-0.5)*grain*0.28; }",
    "  gl_FragColor = vec4(clamp(c,0.0,1.0), 1.0);",
    "}"
  ].join("\n");
  function eglInit(){
    if(egl||eglBad) return;
    try{
      glc=document.createElement("canvas");
      egl=glc.getContext("webgl",{preserveDrawingBuffer:true,antialias:false,premultipliedAlpha:false})||glc.getContext("experimental-webgl",{preserveDrawingBuffer:true});
      if(!egl){ eglBad=true; return; }
      var mk=function(t,s){ var sh=egl.createShader(t); egl.shaderSource(sh,s); egl.compileShader(sh);
        if(!egl.getShaderParameter(sh,egl.COMPILE_STATUS)){ console.warn("edit shader:",egl.getShaderInfoLog(sh)); throw "compile"; } return sh; };
      var p=egl.createProgram(); egl.attachShader(p,mk(egl.VERTEX_SHADER,EV_VS)); egl.attachShader(p,mk(egl.FRAGMENT_SHADER,EV_FS));
      egl.bindAttribLocation(p,0,"aPos"); egl.linkProgram(p);
      if(!egl.getProgramParameter(p,egl.LINK_STATUS)){ console.warn("edit link:",egl.getProgramInfoLog(p)); throw "link"; }
      eglProg=p; egl.useProgram(p);
      eglBuf=egl.createBuffer(); egl.bindBuffer(egl.ARRAY_BUFFER,eglBuf);
      egl.bufferData(egl.ARRAY_BUFFER,new Float32Array([-1,-1, 3,-1, -1,3]),egl.STATIC_DRAW);
      egl.enableVertexAttribArray(0); egl.vertexAttribPointer(0,2,egl.FLOAT,false,0,0);
      eglTex=egl.createTexture(); egl.bindTexture(egl.TEXTURE_2D,eglTex);
      egl.texParameteri(egl.TEXTURE_2D,egl.TEXTURE_WRAP_S,egl.CLAMP_TO_EDGE);
      egl.texParameteri(egl.TEXTURE_2D,egl.TEXTURE_WRAP_T,egl.CLAMP_TO_EDGE);
      egl.texParameteri(egl.TEXTURE_2D,egl.TEXTURE_MIN_FILTER,egl.LINEAR);
      egl.texParameteri(egl.TEXTURE_2D,egl.TEXTURE_MAG_FILTER,egl.LINEAR);
      egl.uniform1i(egl.getUniformLocation(p,"tex"),0);
      ["cropOff","cropScale","uTexel","exposure","contrast","highlights","shadows","whites","blacks","temp","tint","vibrance","saturation","texturef","clarity","dehaze","vignette","grain","grainSize","grainRough","glow","mono","hdr","bypass","seed","pSat","pCon","pWarm"].forEach(function(n){ eglU[n]=egl.getUniformLocation(p,n); });
    }catch(e){ console.warn("edit gl init failed",e); eglBad=true; egl=null; }
  }
  function buildRotated(){
    var iw=edSrc.naturalWidth, ih=edSrc.naturalHeight, rot=edState?edState.rot:0;
    var rw=(rot%180===0)?iw:ih, rh=(rot%180===0)?ih:iw;
    edRC=document.createElement("canvas"); edRC.width=rw; edRC.height=rh;
    var c=edRC.getContext("2d"); c.save(); c.translate(rw/2,rh/2); c.rotate(rot*Math.PI/180); c.drawImage(edSrc,-iw/2,-ih/2); c.restore();
    rcW=rw; rcH=rh;
    if(egl && !eglBad && eglTex){ egl.bindTexture(egl.TEXTURE_2D,eglTex); egl.pixelStorei(egl.UNPACK_FLIP_Y_WEBGL,true);
      try{ egl.texImage2D(egl.TEXTURE_2D,0,egl.RGBA,egl.RGBA,egl.UNSIGNED_BYTE,edRC); }catch(e){ console.warn("tex upload",e); } }
  }
  function cropRect(){
    var rw=rcW, rh=rcH;
    var A=(edState.aspect==="free")?(rw/rh):parseFloat(edState.aspect);
    var fw,fh; if(rw/rh>A){ fh=rh; fw=rh*A; } else { fw=rw; fh=rw/A; }
    fw/=edState.zoom; fh/=edState.zoom;
    var x=edState.cx*rw-fw/2, y=edState.cy*rh-fh/2;
    x=Math.min(Math.max(x,0),rw-fw); y=Math.min(Math.max(y,0),rh-fh);
    return {x:x,y:y,w:fw,h:fh};
  }
  function setEglUniforms(cr){
    var E=edState, U=eglU, g=egl, prof=PROFILES[E.profile]||PROFILES.color;
    var lm=E.secLight?1:0, cm=E.secColor?1:0, fm=E.secEffects?1:0;
    g.uniform2f(U.cropOff, cr.x/rcW, 1-(cr.y+cr.h)/rcH);
    g.uniform2f(U.cropScale, cr.w/rcW, cr.h/rcH);
    g.uniform2f(U.uTexel, 1/rcW, 1/rcH);
    g.uniform1f(U.exposure, (E.exposure/100)*lm);
    g.uniform1f(U.contrast, (E.contrast/100)*lm);
    g.uniform1f(U.highlights, (E.highlights/100)*lm);
    g.uniform1f(U.shadows, (E.shadows/100)*lm);
    g.uniform1f(U.whites, (E.whites/100)*lm);
    g.uniform1f(U.blacks, (E.blacks/100)*lm);
    g.uniform1f(U.temp, (E.temp/100)*cm);
    g.uniform1f(U.tint, (E.tint/100)*cm);
    g.uniform1f(U.vibrance, (E.vibrance/100)*cm);
    g.uniform1f(U.saturation, (E.saturation/100)*cm);
    g.uniform1f(U.texturef, (E.texture/100)*fm);
    g.uniform1f(U.clarity, (E.clarity/100)*fm);
    g.uniform1f(U.dehaze, (E.dehaze/100)*fm);
    g.uniform1f(U.vignette, (E.vignette/100)*fm);
    g.uniform1f(U.grain, (E.grain/100)*fm);
    g.uniform1f(U.grainSize, E.grainSize/100);
    g.uniform1f(U.grainRough, E.grainRough/100);
    g.uniform1f(U.glow, (E.glow/100)*fm);
    g.uniform1f(U.mono, E.mono?1:0);
    g.uniform1f(U.bypass, edShowOrig?1:0);
    g.uniform1f(U.hdr, E.hdr?1:0);
    g.uniform1f(U.seed, Math.random()*80);
    g.uniform1f(U.pSat, prof.sat*cm);
    g.uniform1f(U.pCon, prof.con*lm);
    g.uniform1f(U.pWarm, prof.warm*cm);
  }
  function editRender(){
    if(!edState||!edRC) return; eglInit();
    var cr=cropRect(), cap=980, s=Math.min(cap/cr.w, cap/cr.h, 1.7); if(!isFinite(s)||s<=0) s=1;
    var ow=Math.max(2,Math.round(cr.w*s)), oh=Math.max(2,Math.round(cr.h*s)), vcnv=$("editCanvas");
    if(egl && !eglBad){
      if(glc.width!==ow||glc.height!==oh){ glc.width=ow; glc.height=oh; }
      egl.viewport(0,0,ow,oh); egl.useProgram(eglProg); egl.bindTexture(egl.TEXTURE_2D,eglTex);
      setEglUniforms(cr); egl.drawArrays(egl.TRIANGLES,0,3);
      if(vcnv.width!==ow||vcnv.height!==oh){ vcnv.width=ow; vcnv.height=oh; }
      var vc=vcnv.getContext("2d"); vc.clearRect(0,0,ow,oh); vc.drawImage(glc,0,0);
    } else { edRender2D(cr,ow,oh); }
    scheduleHist();
  }
  function queueRender(){ if(edRafPending) return; edRafPending=true; requestAnimationFrame(function(){ edRafPending=false; editRender(); }); }
  function scheduleHist(){ if(edHistTimer) return; edHistTimer=setTimeout(function(){ edHistTimer=0; drawHist(); }, 90); }
  function drawHist(){
    var hc=$("lrHist"); if(!hc||!edState) return;
    var w=(egl&&!eglBad)?glc.width:$("editCanvas").width, h=(egl&&!eglBad)?glc.height:$("editCanvas").height;
    if(w<2||h<2) return;
    var rH=new Float64Array(64), gH=new Float64Array(64), bH=new Float64Array(64), sr=0,sg=0,sb=0,ns=0, need=w*h*4, i;
    if(egl && !eglBad){
      if(!eglReadBuf||eglReadBuf.length<need) eglReadBuf=new Uint8Array(need);
      try{ egl.bindTexture(egl.TEXTURE_2D,eglTex); egl.readPixels(0,0,w,h,egl.RGBA,egl.UNSIGNED_BYTE,eglReadBuf); }catch(e){ return; }
      var buf=eglReadBuf, step=Math.max(1,(w*h/26000)|0)*4;
      for(i=0;i+2<need;i+=step){ var r=buf[i],gg=buf[i+1],bb=buf[i+2]; rH[r>>2]++; gH[gg>>2]++; bH[bb>>2]++; sr+=r; sg+=gg; sb+=bb; ns++; }
    } else {
      var im; try{ im=$("editCanvas").getContext("2d").getImageData(0,0,w,h).data; }catch(e2){ return; }
      var st=Math.max(1,(w*h/26000)|0)*4;
      for(i=0;i+2<im.length;i+=st){ var r2=im[i],g2=im[i+1],b2=im[i+2]; rH[r2>>2]++; gH[g2>>2]++; bH[b2>>2]++; sr+=r2; sg+=g2; sb+=b2; ns++; }
    }
    var x=hc.getContext("2d"), W=hc.width, H=hc.height; x.clearRect(0,0,W,H); x.fillStyle="#161719"; x.fillRect(0,0,W,H);
    var mx=1,k; for(k=0;k<64;k++){ if(rH[k]>mx)mx=rH[k]; if(gH[k]>mx)mx=gH[k]; if(bH[k]>mx)mx=bH[k]; } mx=Math.pow(mx,0.9);
    var area=function(hh,col){ x.beginPath(); x.moveTo(0,H); for(var q=0;q<64;q++){ var xx=q/63*W, yy=H-Math.pow(hh[q],0.9)/mx*(H-6); x.lineTo(xx,yy); } x.lineTo(W,H); x.closePath(); x.fillStyle=col; x.fill(); };
    x.globalCompositeOperation="lighter"; area(rH,"rgba(255,74,74,0.5)"); area(gH,"rgba(86,220,120,0.5)"); area(bH,"rgba(86,150,255,0.5)"); x.globalCompositeOperation="source-over";
    if(ns>0 && !edHover){ setTxt("lrR",Math.round(sr/ns)); setTxt("lrG",Math.round(sg/ns)); setTxt("lrB",Math.round(sb/ns)); }
  }
  function hoverReadout(e){
    if(!eglReadBuf||!egl||eglBad) return; var cnv=$("editCanvas"), r=cnv.getBoundingClientRect(); if(r.width<1) return;
    var px=Math.floor((e.clientX-r.left)/r.width*glc.width), py=Math.floor((e.clientY-r.top)/r.height*glc.height);
    if(px<0||py<0||px>=glc.width||py>=glc.height) return;
    var idx=((glc.height-1-py)*glc.width+px)*4; if(idx+2>=eglReadBuf.length) return;
    edHover=true; setTxt("lrR",eglReadBuf[idx]); setTxt("lrG",eglReadBuf[idx+1]); setTxt("lrB",eglReadBuf[idx+2]);
  }
  function edRender2D(cr,ow,oh,outCanvas){
    var E=edState, out=outCanvas||$("editCanvas"); out.width=ow; out.height=oh; var c=out.getContext("2d");
    var bri=1+(E.exposure/100)*0.35+E.shadows/500, con=1+E.contrast/120, sat=Math.max(0,1+E.saturation/100+(E.mono?-1:0));
    c.filter="brightness("+bri+") contrast("+con+") saturate("+sat+")"+(E.mono?" grayscale(1)":"");
    c.drawImage(edRC, cr.x,cr.y,cr.w,cr.h, 0,0,ow,oh); c.filter="none";
    if(E.temp!==0){ c.globalCompositeOperation="soft-light"; var a=Math.abs(E.temp)/100*0.5; c.fillStyle=E.temp>0?"rgba(255,150,40,"+a+")":"rgba(60,140,255,"+a+")"; c.fillRect(0,0,ow,oh); c.globalCompositeOperation="source-over"; }
    if(E.vignette<0){ var g=c.createRadialGradient(ow/2,oh/2,Math.min(ow,oh)*0.3,ow/2,oh/2,Math.max(ow,oh)*0.72); g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,"rgba(0,0,0,"+(Math.abs(E.vignette)/100*0.8)+")"); c.fillStyle=g; c.fillRect(0,0,ow,oh); }
  }
  function autoTone(){
    var mr=+txt("lrR")||120, mg=+txt("lrG")||120, mb=+txt("lrB")||120;
    var ml=(0.299*mr+0.587*mg+0.114*mb)/255; if(ml<0.02) ml=0.02;
    var stops=Math.max(-1.3,Math.min(1.3, Math.log(0.46/ml)/Math.log(2)));
    var E=edState; E.exposure=Math.round(stops*100); E.contrast=12; E.highlights=-22; E.shadows=22; E.whites=12; E.blacks=-8; E.vibrance=12;
    syncEditUI(); queueRender(); setTimeout(drawHist,140);
  }
  function autoWB(){
    var mr=+txt("lrR")||120, mg=+txt("lrG")||120, mb=+txt("lrB")||120, E=edState;
    E.temp=Math.round(Math.max(-60,Math.min(60,(mb-mr)/255*140)));
    E.tint=Math.round(Math.max(-50,Math.min(50,(mg-(mr+mb)/2)/255*120)));
    syncEditUI(); queueRender();
  }
  function saveEdit(){   // "Make a copy": a second, separate frame with this edit (the original keeps its own)
    if(!edState) return; var cr=cropRect(), ow=Math.max(2,Math.round(cr.w)), oh=Math.max(2,Math.round(cr.h)), url=null;
    if(egl && !eglBad){
      glc.width=ow; glc.height=oh; egl.viewport(0,0,ow,oh); egl.useProgram(eglProg); egl.bindTexture(egl.TEXTURE_2D,eglTex);
      setEglUniforms(cr); egl.drawArrays(egl.TRIANGLES,0,3);
      try{ url=glc.toDataURL("image/png"); }catch(e){ url=null; }
    }
    if(!url){ var out=document.createElement("canvas"); edRender2D(cr,ow,oh,out); try{ url=out.toDataURL("image/png"); }catch(e2){ toast("Couldn't save the edit."); return; } }
    var o=photos[edState.i]||{}; photos.push({url:url,t:new Date(),f:o.f,sh:o.sh,iso:o.iso,mm:o.mm,body:o.body,brief:o.brief,place:o.place,edited:true,copy:true,
      pick:false, rating:o.rating||0, note:o.note||"", order:null});
    refreshCount(); devSel={}; openEditor(photos.length-1); if(typeof st!=="undefined"&&st.open) st.cur=photos.length-1;
    toast("Copy made. You're now editing the copy; the original is left as it was.");
    if(!eglBad&&egl) editRender();
    saveSession();
  }
  function txt(id){ var e=$(id); return e?e.textContent:""; }
  function setTxt(id,v){ var e=$(id); if(e) e.textContent=v; }
  function setS(id,vid,val,disp){ var a=$(id),b=$(vid); if(a)a.value=val; if(b)b.textContent=(disp!=null?disp:(""+val)); }
  function fmtExp(v){ var n=v/100*2; return (n>0?"+":"")+n.toFixed(2); }
  function syncEditUI(){
    var E=edState; if(!E) return;
    setS("pExposure","vExposure",E.exposure,fmtExp(E.exposure));
    setS("pContrast","vContrast",E.contrast); setS("pHighlights","vHighlights",E.highlights); setS("pShadows","vShadows",E.shadows);
    setS("pWhites","vWhites",E.whites); setS("pBlacks","vBlacks",E.blacks);
    setS("pTemp","vTemp",E.temp); setS("pTint","vTint",E.tint); setS("pVibrance","vVibrance",E.vibrance); setS("pSaturation","vSaturation",E.saturation);
    setS("pTexture","vTexture",E.texture); setS("pClarity","vClarity",E.clarity); setS("pDehaze","vDehaze",E.dehaze); setS("pVignette","vVignette",E.vignette);
    setS("pGrain","vGrain",E.grain); setS("pGrainSize","vGrainSize",E.grainSize); setS("pGrainRough","vGrainRough",E.grainRough); setS("pGlow","vGlow",E.glow);
    if($("eBW")) $("eBW").classList.toggle("on",!!E.mono);
    if($("eHDR")) $("eHDR").classList.toggle("on",!!E.hdr);
    if($("eProfile")) $("eProfile").value=E.profile; if($("eWB")) $("eWB").value=E.wb;
    var gs=$("grainSub"); if(gs) gs.style.opacity=(E.grain>0?1:0.4);
    Array.prototype.forEach.call(document.querySelectorAll("#editor .lr-ct[data-a]"),function(b){ b.classList.toggle("on", b.getAttribute("data-a")===E.aspect); });
    var eyes={light:E.secLight,color:E.secColor,effects:E.secEffects};
    Array.prototype.forEach.call(document.querySelectorAll("#editor .lr-sec"),function(sec){ var n=sec.getAttribute("data-sec"), ey=sec.querySelector(".lr-eye"); if(ey) ey.classList.toggle("off",!eyes[n]); });
  }
  function openEditor(i){
    if(looking) document.exitPointerLock();
    var p=photos[i]; if(!p) return; var E=p.dev?devClone(p.dev):defEd(i); E.i=i;   // edits live on the frame (develop.js)
    var img=new Image();
    img.onload=function(){ edState=E; edSrc=img; hide(gallery); hide(menu); show(editor); eglInit(); buildRotated(); edShowOrig=false; edResetView(); syncEditUI(); editRender(); edHist=[JSON.stringify(edState)]; edHistI=0; setTimeout(drawHist,150); devStrip(); };
    img.onerror=function(){ toast("Couldn't open that photo to edit."); };
    img.src=p.orig||p.url;
  }
  function closeEditor(){ hide(editor); }

  // ---- menu ----
  // ---- the "look" (grade) ----
  var LOOKS={
    natural:{bloom:100,dof:100,warm:0,con:100,sat:100,grain:100},
    cinematic:{bloom:135,dof:120,warm:12,con:112,sat:94,grain:115},
    warm:{bloom:115,dof:100,warm:38,con:106,sat:108,grain:100},
    cool:{bloom:105,dof:100,warm:-32,con:106,sat:100,grain:100},
    film:{bloom:125,dof:100,warm:14,con:92,sat:80,grain:165},
    bw:{bloom:115,dof:100,warm:0,con:118,sat:0,grain:135}
  };
  function lookLabels(){
    $("lkBloomV").textContent=Math.round(gBloom*100)+"%"; $("lkDofV").textContent=Math.round(gDof*100)+"%";
    $("lkWarmV").textContent=Math.round(gWarm*100); $("lkConV").textContent=Math.round(gCon*100)+"%";
    $("lkSatV").textContent=Math.round(gSat*100)+"%"; $("lkGrainV").textContent=Math.round(gGrain*100)+"%";
  }
  function syncLook(){
    $("lkBloom").value=Math.round(gBloom*100); $("lkDof").value=Math.round(gDof*100); $("lkWarm").value=Math.round(gWarm*100);
    $("lkCon").value=Math.round(gCon*100); $("lkSat").value=Math.round(gSat*100); $("lkGrain").value=Math.round(gGrain*100); lookLabels();
  }
  function highlightLook(name){ Array.prototype.forEach.call(document.querySelectorAll("#lookPresets .chip"),function(b){ b.classList.toggle("on", b.getAttribute("data-look")===name); }); }
  function clearLookPreset(){ Array.prototype.forEach.call(document.querySelectorAll("#lookPresets .chip"),function(b){ b.classList.remove("on"); }); }
  function applyLook(name){ var l=LOOKS[name]; if(!l) return; gBloom=l.bloom/100; gDof=l.dof/100; gWarm=l.warm/100; gCon=l.con/100; gSat=l.sat/100; gGrain=l.grain/100; syncLook(); highlightLook(name); }

  function syncMenu(){
    $("mAp").value=apIdx; $("mSh").value=shIdx; $("mIso").value=isoIdx; buildBodyPicker(); buildLensPicker();
    $("mSpeed").value=Math.round(moveScale*100); $("mSpeedVal").textContent=$("mSpeed").value;
    $("mSens").value=Math.round((sens-0.0006)/0.00004); $("mSensVal").textContent=$("mSens").value;
    $("mInvert").classList.toggle("on",invertY); $("mBounds").classList.toggle("on",boundsOn); $("mSound").classList.toggle("on",soundOn);
    $("mGrid").classList.toggle("on",!grid.classList.contains("hidden"));
    highlightUp(lastUp); computeCam(); refreshCount();
    $("mName").value=studentName; buildBriefList(); syncLook();
  }
  function openMenu(){ App.note("bag"); suiteFrom="scene"; if(looking) document.exitPointerLock(); lowerCamera(); syncMenu(); show(menu); if(menu){ menu.classList.remove("flipin"); void menu.offsetWidth; menu.classList.add("flipin"); } updatePrompt(); }
  function closeMenu(){ hide(menu); if(App.state==="bag") App.note("scene"); updatePrompt(); }
  function toggleMenu(){ if(!menu.classList.contains("hidden")) closeMenu(); else openMenu(); }
@@include back.js@@
@@include finder.js@@
@@include bag.js@@
@@include studio.js@@
@@include develop.js@@
@@include board.js@@
@@include nav.js@@
@@include walk.js@@
@@include sync.js@@
@@include lesson.js@@
@@include hub.js@@
@@include teacher.js@@
  function toggleGrid(){ grid.classList.toggle("hidden"); var s=$("mGrid"); if(s)s.classList.toggle("on",!grid.classList.contains("hidden")); }

  // ---- wire: landing ----
  var dropzone=$("dropzone"), fileInput=$("fileInput");
  dropzone.onclick=function(){ fileInput.click(); };
  fileInput.onchange=function(e){ if(e.target.files&&e.target.files[0]) loadSplat(e.target.files[0],"ydown"); };
  ["dragenter","dragover"].forEach(function(ev){ dropzone.addEventListener(ev,function(e){e.preventDefault();dropzone.classList.add("hot");}); });
  ["dragleave","drop"].forEach(function(ev){ dropzone.addEventListener(ev,function(e){e.preventDefault();dropzone.classList.remove("hot");}); });
  dropzone.addEventListener("drop",function(e){ var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) loadSplat(f,"ydown"); });
  window.addEventListener("dragover",function(e){e.preventDefault();});
  window.addEventListener("drop",function(e){ e.preventDefault(); if(menuOpen())return; var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) loadSplat(f,lastUp||"ydown"); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-sample]"),function(b){ b.onclick=function(){ loadSplat(b.getAttribute("data-sample"), b.getAttribute("data-up")||"ydown"); }; });

  // ---- wire: menu controls ----
  $("btnResume").onclick=closeMenu;
  $("btnRecenter").onclick=function(){ if(loaded){ frameScene(); updateCamera(0); closeMenu(); toast("Back to the centre of the scene"); } };
  $("btnMenuPhotos").onclick=openGallery;
  $("btnMenuLoad").onclick=function(){ hide(menu); show(landing); updatePrompt(); };
  // suite hub wiring
  if($("btnMenuHub")) $("btnMenuHub").onclick=function(){ hide(menu); showHub(); };
  Array.prototype.forEach.call(document.querySelectorAll("[data-hub]"),function(b){ b.onclick=showHub; });
  if($("stEdit")) $("stEdit").onclick=function(){ suiteFrom="studio"; hubHide("studio"); openGallery(); };
  if($("stFolio")) $("stFolio").onclick=function(){ if(!anyPhotos()){ toast("Add photos first — Upload below, or shoot in the Splat viewer."); return; } suiteFrom="studio"; hubHide("studio"); openFolio(); };
  if($("stBook")) $("stBook").onclick=function(){ if(!anyPhotos()){ toast("Add photos first — Upload below, or shoot in the Splat viewer."); return; } suiteFrom="studio"; hubHide("studio"); openPhotobook(); };
  if($("stGallery")) $("stGallery").onclick=function(){ if(!anyPhotos()){ toast("Add photos first — Upload below, or shoot in the Splat viewer."); return; } suiteFrom="studio"; hubHide("studio"); openGalleryShow(); };
  if($("stUpload")) $("stUpload").onclick=function(){ if($("stFile")) $("stFile").click(); };
  if($("stFile")) $("stFile").onchange=function(){ var self=this; importPhotoFiles(self.files,function(n){ if(n) toast(n+" photo"+(n>1?"s":"")+" added"); studioSync(); saveSession(); }); self.value=""; };
  if($("stClear")) $("stClear").onclick=function(){ if(!photos.length){ toast("Nothing to clear yet."); return; } if(confirm("Start fresh? This clears the photos and layouts saved on this computer. This can't be undone.")){ clearSession(); studioSync(); foBuildTray&&foBuildTray(); toast("Cleared — fresh start."); } };
  if($("tutNext")) $("tutNext").onclick=function(){ if(tutI>=TUT.length-1) endTutorial(); else { tutI++; renderTut(); } };
  if($("tutBack")) $("tutBack").onclick=function(){ if(tutI>0){ tutI--; renderTut(); } };
  if($("tutSkip")) $("tutSkip").onclick=endTutorial;
  if($("btnHelp")) $("btnHelp").onclick=function(){ showTutorial(0); };
  $("mAp").addEventListener("input",function(){ apIdx=+this.value; computeCam(); });
  $("mSh").addEventListener("input",function(){ shIdx=+this.value; computeCam(); });
  $("mIso").addEventListener("input",function(){ isoIdx=+this.value; computeCam(); });
  // focal length is now driven by the per-body lens picker (buildLensPicker / selectLens)
  $("mSpeed").addEventListener("input",function(){ moveScale=(+this.value)/100; $("mSpeedVal").textContent=this.value; });
  $("mSens").addEventListener("input",function(){ sens=0.0006+(+this.value)*0.00004; $("mSensVal").textContent=this.value; });
  $("mInvert").onclick=function(){ invertY=!invertY; this.classList.toggle("on",invertY); };
  $("mBounds").onclick=function(){ boundsOn=!boundsOn; this.classList.toggle("on",boundsOn); };
  $("mSound").onclick=function(){ soundOn=!soundOn; this.classList.toggle("on",soundOn); };
  $("lkBloom").addEventListener("input",function(){ gBloom=(+this.value)/100; $("lkBloomV").textContent=this.value+"%"; clearLookPreset(); });
  $("lkDof").addEventListener("input",function(){ gDof=(+this.value)/100; $("lkDofV").textContent=this.value+"%"; clearLookPreset(); });
  $("lkWarm").addEventListener("input",function(){ gWarm=(+this.value)/100; $("lkWarmV").textContent=this.value; clearLookPreset(); });
  $("lkCon").addEventListener("input",function(){ gCon=(+this.value)/100; $("lkConV").textContent=this.value+"%"; clearLookPreset(); });
  $("lkSat").addEventListener("input",function(){ gSat=(+this.value)/100; $("lkSatV").textContent=this.value+"%"; clearLookPreset(); });
  $("lkGrain").addEventListener("input",function(){ gGrain=(+this.value)/100; $("lkGrainV").textContent=this.value+"%"; clearLookPreset(); });
  Array.prototype.forEach.call(document.querySelectorAll("#lookPresets .chip"),function(b){ b.onclick=function(){ applyLook(b.getAttribute("data-look")); }; });
  $("mGrid").onclick=function(){ toggleGrid(); };
  Array.prototype.forEach.call(document.querySelectorAll("#upSeg .btn"),function(b){ b.onclick=function(){ reloadWithUp(b.getAttribute("data-up")); }; });
  $("mName").addEventListener("input",function(){ studentName=this.value.slice(0,40); saveSession(); });
  $("btnContact").onclick=exportContactSheet;
  $("btnDownloadAll").onclick=function(){ if(!photos.length){toast("No photos yet.");return;} photos.forEach(function(ph,i){ setTimeout(function(){ var a=document.createElement("a"); a.href=ph.url; a.download=fileName(i); document.body.appendChild(a); a.click(); a.remove(); }, i*350); }); toast("Downloading "+photos.length+" photo"+(photos.length>1?"s":"")+"…"); };
  $("btnCloseGallery").onclick=function(){ hide(gallery); updatePrompt(); studioReturn(); };

  // ---- editor: view zoom + undo history ----
  function edApplyView(){ var c=$("editCanvas"); if(c){ c.style.transformOrigin="center center"; c.style.transform="translate("+edVX.toFixed(1)+"px,"+edVY.toFixed(1)+"px) scale("+edVZoom.toFixed(3)+")"; }
    var h=$("editHint"); if(h) h.textContent=(edVZoom>1.01? (Math.round(edVZoom*100)+"% · drag to pan · press 0 to fit") : "drag to reposition · scroll to zoom · \\ compares before/after"); }
  function edResetView(){ edVZoom=1; edVX=0; edVY=0; edApplyView(); }
  function edZoomBy(f){ edVZoom=Math.max(1,Math.min(8,edVZoom*f)); if(edVZoom<=1.001){ edVX=0; edVY=0; } edApplyView(); }
  function edPushHist(){ if(edRestoring||!edState) return; try{ var s=JSON.stringify(edState); if(edHist[edHistI]===s) return; edHist=edHist.slice(0,edHistI+1); edHist.push(s); if(edHist.length>60) edHist.shift(); edHistI=edHist.length-1; }catch(e){} }
  function edRestore(s){ edRestoring=true; try{ edState=JSON.parse(s); }catch(e){} edRestoring=false; buildRotated(); syncEditUI(); queueRender(); setTimeout(drawHist,120); }
  function edUndo(){ if(edHistI>0){ edHistI--; edRestore(edHist[edHistI]); toast("Undo"); } }
  function edRedo(){ if(edHistI<edHist.length-1){ edHistI++; edRestore(edHist[edHistI]); toast("Redo"); } }

  // ---- wire: editor (Lightroom develop panel) ----
  (function(){
    var em=[["pExposure","exposure","vExposure",fmtExp],["pContrast","contrast","vContrast"],["pHighlights","highlights","vHighlights"],["pShadows","shadows","vShadows"],["pWhites","whites","vWhites"],["pBlacks","blacks","vBlacks"],["pTemp","temp","vTemp"],["pTint","tint","vTint"],["pVibrance","vibrance","vVibrance"],["pSaturation","saturation","vSaturation"],["pTexture","texture","vTexture"],["pClarity","clarity","vClarity"],["pDehaze","dehaze","vDehaze"],["pVignette","vignette","vVignette"],["pGrain","grain","vGrain"],["pGrainSize","grainSize","vGrainSize"],["pGrainRough","grainRough","vGrainRough"],["pGlow","glow","vGlow"]];
    em.forEach(function(m){ var el=$(m[0]); if(!el) return;
      el.addEventListener("input",function(){ edState[m[1]]=+this.value; var vv=$(m[2]); if(vv) vv.textContent=m[3]?m[3](+this.value):this.value; if(m[1]==="grain"){ var gs=$("grainSub"); if(gs) gs.style.opacity=(+this.value>0)?1:0.4; } queueRender(); });
      el.addEventListener("change", edPushHist);
      el.addEventListener("dblclick",function(){ var dv=EDEF[m[1]]; edState[m[1]]=dv; this.value=dv; var vv=$(m[2]); if(vv) vv.textContent=m[3]?m[3](dv):dv; if(m[1]==="grain"){ var gs=$("grainSub"); if(gs) gs.style.opacity=(dv>0)?1:0.4; } edPushHist(); queueRender(); }); });
    if($("eAuto")) $("eAuto").onclick=function(){ autoTone(); edPushHist(); };
    if($("eBW")) $("eBW").onclick=function(){ edState.mono=edState.mono?0:1; edState.profile=edState.mono?"mono":"color"; syncEditUI(); queueRender(); edPushHist(); };
    if($("eHDR")) $("eHDR").onclick=function(){ edState.hdr=edState.hdr?0:1; syncEditUI(); queueRender(); edPushHist(); };
    if($("eProfile")) $("eProfile").addEventListener("change",function(){ edState.profile=this.value; edState.mono=(this.value==="mono")?1:0; syncEditUI(); queueRender(); edPushHist(); });
    if($("eWB")) $("eWB").addEventListener("change",function(){ edState.wb=this.value; if(this.value==="asshot"){ edState.temp=0; edState.tint=0; } else if(this.value==="auto"){ autoWB(); } syncEditUI(); queueRender(); edPushHist(); });
    Array.prototype.forEach.call(document.querySelectorAll("#editor .lr-sec"),function(sec){
      var name=sec.getAttribute("data-sec"), hdr=sec.querySelector(".lr-sechdr"), eye=sec.querySelector(".lr-eye");
      if(hdr) hdr.addEventListener("click",function(ev){ if(eye&&(ev.target===eye||eye.contains(ev.target))) return; sec.classList.toggle("collapsed"); });
      if(eye) eye.addEventListener("click",function(ev){ ev.stopPropagation(); var key=name==="light"?"secLight":name==="color"?"secColor":"secEffects"; edState[key]=edState[key]?0:1; eye.classList.toggle("off",!edState[key]); queueRender(); edPushHist(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("#editor .lr-ct[data-a]"),function(b){ b.onclick=function(){ edState.aspect=b.getAttribute("data-a"); edState.cx=0.5; edState.cy=0.5; syncEditUI(); queueRender(); edPushHist(); }; });
    if($("eRotL")) $("eRotL").onclick=function(){ edState.rot=(edState.rot+270)%360; edState.cx=0.5; edState.cy=0.5; buildRotated(); queueRender(); edPushHist(); };
    if($("eRotR")) $("eRotR").onclick=function(){ edState.rot=(edState.rot+90)%360; edState.cx=0.5; edState.cy=0.5; buildRotated(); queueRender(); edPushHist(); };
    if($("eReset")) $("eReset").onclick=function(){ var i=edState.i; edState=defEd(i); buildRotated(); edResetView(); syncEditUI(); queueRender(); edPushHist(); setTimeout(drawHist,140); };
    if($("eCancel")) $("eCancel").onclick=function(){ devCommit(); closeEditor(); buildGallery(); show(gallery); };
    if($("eSave")) $("eSave").onclick=function(){ devCommit(); if(typeof st!=="undefined"&&st.open){ stRoom("select"); } else { closeEditor(); buildGallery(); show(gallery); } };
    if($("eCopy")) $("eCopy").onclick=function(){ devCommit(); saveEdit(); };
    var cnv=$("editCanvas"), dragging=false, lx=0, ly=0;
    if(cnv){
      cnv.addEventListener("pointerdown",function(e){ dragging=true; lx=e.clientX; ly=e.clientY; try{cnv.setPointerCapture(e.pointerId);}catch(err){} });
      cnv.addEventListener("pointermove",function(e){ hoverReadout(e); if(!dragging) return; var dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY;
        if(edVZoom>1.001){ edVX+=dx; edVY+=dy; edApplyView(); }
        else { if(!edState||!edRC) return; var r=cnv.getBoundingClientRect(); if(r.width<1) return; var cr=cropRect(); edState.cx-=(dx/r.width)*(cr.w/rcW); edState.cy-=(dy/r.height)*(cr.h/rcH); edState.cx=Math.min(Math.max(edState.cx,0),1); edState.cy=Math.min(Math.max(edState.cy,0),1); queueRender(); } });
      var endd=function(){ if(dragging && edVZoom<=1.001) edPushHist(); dragging=false; }; cnv.addEventListener("pointerup",endd); cnv.addEventListener("pointercancel",endd);
      cnv.addEventListener("mouseleave",function(){ edHover=false; });
      cnv.addEventListener("wheel",function(e){ if(!edState) return; e.preventDefault(); edZoomBy(e.deltaY<0?1.18:0.85); },{passive:false});
    }
    window.addEventListener("keydown",function(e){ if(!editor || editor.classList.contains("hidden")) return; var mod=e.ctrlKey||e.metaKey;
      if(mod && (e.key==="z"||e.key==="Z")){ e.preventDefault(); if(e.shiftKey) edRedo(); else edUndo(); return; }
      if(mod && (e.key==="y"||e.key==="Y")){ e.preventDefault(); edRedo(); return; }
      if(e.key==="\\"){ e.preventDefault(); edShowOrig=!edShowOrig; queueRender(); toast(edShowOrig?"Before · original":"After · edited"); return; }
      if(e.key==="0"){ e.preventDefault(); edResetView(); return; }
      if(e.key==="+"||e.key==="="){ e.preventDefault(); edZoomBy(1.25); return; }
      if(e.key==="-"||e.key==="_"){ e.preventDefault(); edZoomBy(0.8); return; }
    });
  })();
  window.addEventListener("resize",function(){ if(!editor.classList.contains("hidden")) queueRender(); });

  // ---- wire: look / shutter (pointer lock) ----
  viewport.addEventListener("click",function(){ if(menuOpen()||!loaded) return; if(document.pointerLockElement!==renderer.domElement){ try{renderer.domElement.requestPointerLock();}catch(e){} } });
  document.addEventListener("mousedown",function(e){ if(looking && viewfinderOn && e.button===0) shutter(); });
  document.addEventListener("pointerlockchange",function(){ looking=(document.pointerLockElement===renderer.domElement); if(!looking) lowerCamera(); updateCrosshair(); updatePrompt(); });
  document.addEventListener("mousemove",function(e){ if(!looking) return; var fb=(viewfinderOn?curBody().finder:""), ys=(fb==="waist"||fb==="ground")?-1:1, ps=(fb==="ground")?-1:1; yaw-=e.movementX*sens*ys; var dp=e.movementY*sens*ps; pitch+=invertY?dp:-dp; var lim=1.553; if(pitch>lim)pitch=lim; if(pitch<-lim)pitch=-lim; });
  document.addEventListener("wheel",function(e){ if(!looking||menuOpen()) return; e.preventDefault(); var nv=Math.max(1,Math.min(100,Math.round(moveScale*100)+(e.deltaY<0?6:-6))); moveScale=nv/100; if($("mSpeed")){$("mSpeed").value=nv;$("mSpeedVal").textContent=nv;} },{passive:false});

  // ---- keyboard ----
  window.addEventListener("keydown",function(e){
    if(e.target && (e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")) return;
    if(lsKey(e)) return;                                          // the move-on card holds the keys while it's up
    if(App.is("teacher")||App.is("signin")) return;
    if(App.is("landing")&&!landing.classList.contains("hidden")){ if(e.code==="Escape"){ e.preventDefault(); showHub(); } else if(e.code==="Enter"){ var sc0=(window.SPLAT_SCENES||[])[0]; if(sc0){ e.preventDefault(); loadBundled(sc0); } } return; }
    if(cbOpen){ cbKey(e); return; }
    if(bg.open){ bagKey(e); return; }
    if(st.open && stKey(e)) return;
    if(viewfinderOn && !menuOpen() && /^Digit[1-4]$/.test(e.code)){ var dl=vfDials()[+e.code.slice(5)-1]; if(dl) vfPickDial(dl[0]); return; }
    keys[e.code]=true;
    if(e.code==="Escape" && anyOutputOpen()){ e.preventDefault(); ["folio","photobook","galleryshow"].forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.add("hidden"); }); return; }
    if(e.code==="Space"){ e.preventDefault(); if(!loaded || anyOutputOpen() || !gallery.classList.contains("hidden") || !editor.classList.contains("hidden")) return;
      if(!menu.classList.contains("hidden")) closeMenu(); else openBack(); return; }
    if(e.code==="KeyB" && loaded && !menuOpen()){ e.preventDefault(); openBag(); return; }
    if(menuOpen()){ if(e.code==="Escape"){ if(!editor.classList.contains("hidden")){ closeEditor(); buildGallery(); show(gallery); } else if(!gallery.classList.contains("hidden")){hide(gallery);updatePrompt();} else if(!menu.classList.contains("hidden")){closeMenu();} } return; }
    if(e.code==="KeyP"){ e.preventDefault(); toggleViewfinder(); }
    else if(e.code==="Enter"){ e.preventDefault(); shutter(); }
    else if(e.code==="KeyG"){ if(viewfinderOn) cycleComp(); else toggleGrid(); }
    else if(e.code==="Tab"){ e.preventDefault(); openStudio("select"); }
    else if(e.code==="ArrowUp"){ e.preventDefault(); setFocus(focusDist+0.05); }
    else if(e.code==="ArrowDown"){ e.preventDefault(); setFocus(focusDist-0.05); }
    else if(e.code==="Escape"){ if(viewfinderOn) lowerCamera(); }
  });
  window.addEventListener("keyup",function(e){ keys[e.code]=false; });
  window.addEventListener("blur",function(){ keys={}; });

  landingNote.innerHTML="Scans open on this computer. Nothing is uploaded.";
  // ================= OUTPUTS: folio board / photobook / gallery =================
  function esc(s){ return (s||"").replace(/[&<>\"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
  function openOverlayOnly(el){ if(looking) document.exitPointerLock(); hide(menu); el.classList.remove("hidden"); }
  function anyPhotos(){ return photos && photos.length>0; }
  // read image files from disk into the photo pool (no save/account feature yet)
  function importPhotoFiles(files, done){ var arr=Array.prototype.slice.call(files||[]).filter(function(f){ return /^image\//.test(f.type); });
    if(!arr.length){ if(done) done(0); return; } var left=arr.length, added=0;
    arr.forEach(function(f){ var r=new FileReader(); r.onload=function(){ photos.push({url:r.result,t:new Date(),uploaded:true}); added++; if(--left===0&&done) done(added); }; r.onerror=function(){ if(--left===0&&done) done(added); }; r.readAsDataURL(f); }); }
  // ---------- Folio board: magnetic masonry, click-to-resize, drag-to-reorder ----------
  var foItems=[], foBW=0, foBH=0, foDrag=null, foDragging=false, foCols=3, foFill=1;
  var FO_SIZES=["S","M","L","XL"];
  function openFolio(){ if(!anyPhotos()){ toast("Take some photos first — press P, then click to shoot."); return; }
    openOverlayOnly($("folio")); foBuildTray();
    requestAnimationFrame(function(){ foSizeBoard(); if(!foItems.length) foSeed(); foPack(false); }); }
  function foSizeBoard(){ var st=$("folio").querySelector(".outstage"); var mw=Math.max(160,st.clientWidth-48), mh=Math.max(160,st.clientHeight-48), A=1/1.41421;
    var w=mw, h=w/A; if(h>mh){ h=mh; w=h*A; } foBW=Math.round(w); foBH=Math.round(h); var b=$("foBoard"); b.style.width=foBW+"px"; b.style.height=foBH+"px"; }
  function foBuildTray(){ var t=$("foTray"); if(!t) return; t.innerHTML=""; if(!anyPhotos()){ t.innerHTML="<div class='tempty'>No photos yet</div>"; return; }
    photos.forEach(function(ph){ var im=document.createElement("img"); im.className="tphoto"; im.src=ph.url; im.title="Add to board"; im.onclick=function(){ foItems.push({url:ph.url,size:"M"}); foPack(true); }; t.appendChild(im); }); }
  function foSeed(){ foItems=[]; var pat=["L","M","S","M","S","XL","S","M","S","L","M","S"]; photos.slice(0,12).forEach(function(ph,i){ foItems.push({url:ph.url,size:pat[i%pat.length]}); }); }
  // pack the visible items (excluding a dragged one) into `cols` columns; croppable frames per size class
  function foLay(list, cols, availW, gut){
    var colW=(availW-(cols-1)*gut)/cols, span2W=cols>=2?(2*colW+gut):colW, colH=[], c; for(c=0;c<cols;c++) colH[c]=0;
    var pos=[];
    list.forEach(function(it){ var span=((it.size==="L"||it.size==="XL")&&cols>=2)?2:1, w,h;
      if(it.size==="XL"){ w=span2W; h=(cols>=2?span2W*0.96:colW*1.72); }
      else if(it.size==="L"){ w=span2W; h=(cols>=2?span2W*0.6:colW*1.34); }
      else if(it.size==="M"){ w=colW; h=colW*1.3; }
      else { w=colW; h=colW*0.9; }
      var bestC=0,bestTop=Infinity,c2;
      if(span===1){ for(c2=0;c2<cols;c2++){ if(colH[c2]<bestTop-0.5){ bestTop=colH[c2]; bestC=c2; } } }
      else { for(c2=0;c2<=cols-2;c2++){ var tt=Math.max(colH[c2],colH[c2+1]); if(tt<bestTop-0.5){ bestTop=tt; bestC=c2; } } }
      pos.push({it:it,x:bestC*(colW+gut),y:bestTop,w:w,h:h,col:bestC,span:span});
      if(span===1){ colH[bestC]=bestTop+h+gut; } else { colH[bestC]=colH[bestC+1]=bestTop+h+gut; } });
    var contentH=Math.max.apply(null,colH.concat([1]))-gut; if(contentH<1) contentH=1;
    return {pos:pos, contentH:contentH}; }
  // pack + vertical fill + flush-bottom justify so columns reach the board edge (no blank strips); returns coverage for scoring
  function foComputeFilled(list, availW, availH, gut, forceCols, forceFill){
    var N=list.length; if(!N) return {pos:[],cols:forceCols||3,fill:1,coverage:0};
    var cols, lay, fill;
    if(forceCols){ cols=forceCols; lay=foLay(list,cols,availW,gut); fill=forceFill||Math.max(0.72,Math.min(1.6,availH/lay.contentH)); }
    else { var cands=(foBW<460 ? (N<=3?[2]:[2,3]) : (N<=2?[1,2] : N<=4?[2,3] : [3,4])), best=null;
      cands.forEach(function(cc){ var L=foLay(list,cc,availW,gut), f=availH/L.contentH, sc=Math.abs(Math.log(f)); if(!best||sc<best.sc){ best={cols:cc,L:L,f:f,sc:sc}; } });
      cols=best.cols; lay=best.L; fill=Math.max(0.72,Math.min(1.6,best.f)); }
    lay.pos.forEach(function(p){ p.X=p.x; p.Y=p.y*fill; p.W=p.w; p.H=p.h*fill; });
    if(!foDragging){ var gb=0; lay.pos.forEach(function(p){ gb=Math.max(gb,p.Y+p.H); });
      lay.pos.forEach(function(p){ var bottom=p.Y+p.H, blocked=false;
        lay.pos.forEach(function(q){ if(q===p) return; if(q.Y>=bottom-0.5){ var a0=p.col,a1=p.col+p.span,b0=q.col,b1=q.col+q.span; if(a0<b1&&b0<a1) blocked=true; } });
        if(!blocked && bottom<gb-0.5) p.H=gb-p.Y; }); }
    var area=0; lay.pos.forEach(function(p){ area+=p.W*p.H; });
    return {pos:lay.pos, cols:cols, fill:fill, coverage:area/(availW*availH)}; }
  function foPack(animate){ if(!foBW) return; var b=$("foBoard"); if(!b) return;
    var list=foItems.filter(function(o){return o!==foDrag;}); if(!list.length){ foRenderPacked(animate); return; }
    var m=Math.round(foBW*0.045), gut=Math.round(foBW*0.016), availW=foBW-2*m, availH=foBH-2*m, r;
    if(foDragging) r=foComputeFilled(list, availW, availH, gut, foCols, foFill);
    else { r=foComputeFilled(list, availW, availH, gut, 0, 0); foCols=r.cols; foFill=r.fill; }
    var ox=m, oy=m;
    r.pos.forEach(function(p){ var it=p.it; it.X=ox+p.X; it.Y=oy+p.Y; it.W=p.W; it.H=p.H; });
    foRenderPacked(animate); }
  function foRenderPacked(animate){ var b=$("foBoard"); if(!b) return;
    foItems.forEach(function(it){ var d=it._el;
      if(!d){ d=document.createElement("div"); d.className="foItem"; d.innerHTML="<img src='"+it.url+"' draggable='false'><button class='del' title='Remove'>✕</button><span class='sz'></span>"; it._el=d; b.appendChild(d); foBindItem(it,d); }
      var szl=d.querySelector(".sz"); if(szl) szl.textContent=it.size;
      if(it!==foDrag && it.X!=null){ d.style.transition=animate?"left .26s cubic-bezier(.2,.8,.25,1),top .26s cubic-bezier(.2,.8,.25,1),width .26s cubic-bezier(.2,.8,.25,1),height .26s cubic-bezier(.2,.8,.25,1)":"none";
        d.style.left=it.X+"px"; d.style.top=it.Y+"px"; d.style.width=it.W+"px"; d.style.height=it.H+"px"; } }); }
  function foBindItem(it,d){ var sx,sy,offX,offY,moved,dragging;
    var del=d.querySelector(".del"); del.addEventListener("pointerdown",function(e){ e.stopPropagation(); });
    del.onclick=function(e){ e.stopPropagation(); var i=foItems.indexOf(it); if(i>=0) foItems.splice(i,1); if(it._el&&it._el.parentNode) it._el.parentNode.removeChild(it._el); it._el=null; foPack(true); };
    d.addEventListener("pointerdown",function(e){ if(e.button!==0||e.target===del) return; sx=e.clientX; sy=e.clientY; moved=false; dragging=false;
      var r=d.getBoundingClientRect(); offX=e.clientX-r.left; offY=e.clientY-r.top; try{d.setPointerCapture(e.pointerId);}catch(err){}
      function mv(ev){ var dx=ev.clientX-sx, dy=ev.clientY-sy; if(!moved && Math.sqrt(dx*dx+dy*dy)>7){ moved=true; dragging=true; foDrag=it; foDragging=true; d.classList.add("dragging"); d.style.transition="none"; d.style.zIndex="60"; }
        if(dragging){ var br=$("foBoard").getBoundingClientRect(); var x=ev.clientX-br.left-offX, y=ev.clientY-br.top-offY; d.style.left=x+"px"; d.style.top=y+"px"; foLiveReorder(it, x+it.W/2, y+it.H/2); } }
      function up(ev){ try{d.releasePointerCapture(ev.pointerId);}catch(err){} d.removeEventListener("pointermove",mv); d.removeEventListener("pointerup",up); d.removeEventListener("pointercancel",up);
        if(dragging){ foDrag=null; foDragging=false; d.classList.remove("dragging"); d.style.zIndex=""; foPack(true); } else { it.size=FO_SIZES[(FO_SIZES.indexOf(it.size)+1)%FO_SIZES.length]; foPack(true); } }
      d.addEventListener("pointermove",mv); d.addEventListener("pointerup",up); d.addEventListener("pointercancel",up); }); }
  function foLiveReorder(it, cx, cy){ var others=foItems.filter(function(o){ return o!==it && o._el && o.X!=null; }); if(!others.length) return;
    var best=null,bestD=Infinity; others.forEach(function(o){ var ox=o.X+o.W/2, oy=o.Y+o.H/2, dd=(ox-cx)*(ox-cx)+(oy-cy)*(oy-cy); if(dd<bestD){ bestD=dd; best=o; } });
    if(!best) return; var bi=foItems.indexOf(best), bcx=best.X+best.W/2, bcy=best.Y+best.H/2;
    // hysteresis: only reorder on a clear crossing so it doesn't thrash
    var after; if(Math.abs(cy-bcy) > best.H*0.34){ after = cy>bcy; } else { if(Math.abs(cx-bcx) < best.W*0.20) return; after = cx>bcx; }
    var target=after?bi+1:bi; var cur=foItems.indexOf(it); if(cur<target) target--;
    if(target<0||target===cur) return;
    foItems.splice(cur,1); foItems.splice(target,0,it); foPack(true); }
  function foShuffle(){ if(!foItems.length) foSeed();
    var m=Math.round(foBW*0.045), gut=Math.round(foBW*0.016), availW=foBW-2*m, availH=foBH-2*m, N=foItems.length, best=null, i;
    // try many random size/order arrangements, keep the one that fills densest (fewest blank gaps)
    for(var t=0;t<30;t++){
      var sizes=[]; for(i=0;i<N;i++){ var r=Math.random(); sizes.push(r<0.09?"XL":(r<0.28?"L":(r<0.63?"M":"S"))); }
      if(N>=4 && sizes.indexOf("L")<0 && sizes.indexOf("XL")<0) sizes[0]="L";
      var order=[]; for(i=0;i<N;i++) order.push(i);
      for(i=N-1;i>0;i--){ var j=(Math.random()*(i+1))|0, tm=order[i]; order[i]=order[j]; order[j]=tm; }
      var list=order.map(function(idx,k){ return {size:sizes[k]}; });
      var rr=foComputeFilled(list, availW, availH, gut, 0, 0);
      if(!best || rr.coverage>best.cov){ best={cov:rr.coverage, order:order.slice(), sizes:sizes.slice()}; }
    }
    var mapped=best.order.map(function(idx,k){ var it=foItems[idx]; it.size=best.sizes[k]; return it; });
    foItems=mapped; foPack(true); }
  function foClearBoard(){ foItems.forEach(function(it){ if(it._el&&it._el.parentNode) it._el.parentNode.removeChild(it._el); }); foItems=[]; }
  function foDownload(){ if(!foItems.length){ toast("Add some photos to the board first."); return; }
    var scale=2200/foBW, cv=document.createElement("canvas"); cv.width=Math.round(foBW*scale); cv.height=Math.round(foBH*scale);
    var ctx=cv.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height); var loaded=0, N=foItems.length;
    foItems.forEach(function(it){ var im=new Image(); im.onload=function(){ var dw=it.W*scale,dh=it.H*scale,dx=it.X*scale,dy=it.Y*scale,ar=im.naturalWidth/im.naturalHeight,tar=dw/dh,sw,sh,sxx,syy;
        if(ar>tar){ sh=im.naturalHeight; sw=sh*tar; sxx=(im.naturalWidth-sw)/2; syy=0; } else { sw=im.naturalWidth; sh=sw/tar; sxx=0; syy=(im.naturalHeight-sh)/2; }
        ctx.drawImage(im,sxx,syy,sw,sh,dx,dy,dw,dh); fin(); }; im.onerror=fin; im.src=it.url; });
    function fin(){ loaded++; if(loaded<N) return; var url; try{ url=cv.toDataURL("image/png"); }catch(e){ toast("Couldn't export the board."); return; }
      var a=document.createElement("a"); a.href=url; a.download=(namePrefix()||"")+"folio-board.png"; document.body.appendChild(a); a.click(); a.remove(); toast("Folio board downloaded"); } }
  // ---------- Photobook editor (InDesign-style spreads, frames, snapping) ----------
  var pbPages=[], pbIdx=0, pbFocus=1, pbAR=1/1.3;
  var PB_LAYOUTS=[
    {id:"full",name:"Full",slots:[{x:0.04,y:0.04,w:0.92,h:0.92}]},
    {id:"center",name:"Centre",slots:[{x:0.13,y:0.15,w:0.74,h:0.7}]},
    {id:"stack",name:"Stack",slots:[{x:0.1,y:0.08,w:0.8,h:0.42},{x:0.1,y:0.52,w:0.8,h:0.4}]},
    {id:"pair",name:"Pair",slots:[{x:0.06,y:0.22,w:0.43,h:0.56},{x:0.51,y:0.22,w:0.43,h:0.56}]},
    {id:"grid",name:"Grid",slots:[{x:0.08,y:0.08,w:0.4,h:0.4},{x:0.52,y:0.08,w:0.4,h:0.4},{x:0.08,y:0.52,w:0.4,h:0.4},{x:0.52,y:0.52,w:0.4,h:0.4}]},
    {id:"feature",name:"Feature",slots:[{x:0.06,y:0.08,w:0.56,h:0.84},{x:0.66,y:0.08,w:0.28,h:0.4},{x:0.66,y:0.52,w:0.28,h:0.4}]}
  ];
  function pbBlank(){ return {frames:[]}; }
  function openPhotobook(){ if(!anyPhotos()){ toast("Take some photos first."); return; } openOverlayOnly($("photobook"));
    if(!pbPages.length) pbInit(); pbBuildTray(); pbBuildLayouts(); requestAnimationFrame(pbRender); }
  function pbInit(){ pbPages=[{cover:true}]; var ph=photos.slice(0); for(var i=0;i<ph.length;i+=2){ var pg=pbBlank();
      if(ph[i]) pg.frames.push({url:ph[i].url,x:0.1,y:0.08,w:0.8,h:(ph[i+1]?0.42:0.84)});
      if(ph[i+1]) pg.frames.push({url:ph[i+1].url,x:0.1,y:0.52,w:0.8,h:0.4}); pbPages.push(pg); }
    while(pbPages.length<3) pbPages.push(pbBlank()); pbIdx=0; pbFocus=1; }
  function pbSpreadCount(){ return 1+Math.ceil((pbPages.length-1)/2); }
  function pbSpreadPages(){ if(pbIdx===0) return [0]; var a=[], l=pbIdx*2-1, r=pbIdx*2; if(pbPages[l]!=null)a.push(l); if(pbPages[r]!=null)a.push(r); return a; }
  function pbBuildTray(){ var t=$("pbTray"); if(!t) return; t.innerHTML=""; photos.forEach(function(ph){ var im=document.createElement("img"); im.className="tphoto"; im.src=ph.url; im.title="Click to place on the focused page"; im.setAttribute("draggable","false"); im.onclick=function(){ pbAddToPage(pbFocus, ph.url); }; t.appendChild(im); }); }
  function pbBuildLayouts(){ var el=$("pbLayouts"); if(!el) return; el.innerHTML=""; PB_LAYOUTS.forEach(function(L){ var b=document.createElement("button"); b.className="btn sm"; b.textContent=L.name; b.title="Apply to the focused page"; b.onclick=function(){ pbApplyLayout(pbFocus,L); }; el.appendChild(b); }); }
  function pbAddToPage(pi, url){ var pg=pbPages[pi]; if(!pg||pg.cover){ toast("Pick an interior page first."); return; } if(pg.frames.length>=6){ toast("That page is full."); return; }
    var k=pg.frames.length; pg.frames.push({url:url,x:0.16+k*0.05,y:0.16+k*0.05,w:0.52,h:0.42}); pbRender(); }
  function pbApplyLayout(pi, L){ var pg=pbPages[pi]; if(!pg||pg.cover){ toast("Layouts apply to interior pages."); return; }
    var existing=pg.frames.slice(), used={}; existing.forEach(function(f){ used[f.url]=1; }); var pool=photos.map(function(p){return p.url;}).filter(function(u){ return !used[u]; });
    pg.frames=[]; L.slots.forEach(function(s,i){ var url=existing[i]?existing[i].url:(pool.shift()||(photos.length?photos[i%photos.length].url:null)); if(url) pg.frames.push({url:url,x:s.x,y:s.y,w:s.w,h:s.h}); }); pbRender(); }
  function pbMarkFocus(){ Array.prototype.forEach.call(document.querySelectorAll("#pbBook .pbPage2"),function(p){ p.classList.toggle("focus", (+p.getAttribute("data-pi"))===pbFocus); }); }
  function pbClearSel(){ Array.prototype.forEach.call(document.querySelectorAll("#pbBook .pbFrame"),function(f){ f.classList.remove("sel"); }); }
  function pbRender(){ var book=$("pbBook"), stage=$("photobook")&&$("photobook").querySelector(".outstage"); if(!book||!stage) return;
    var pages=pbSpreadPages(); var availW=stage.clientWidth-56, availH=stage.clientHeight-56;
    var ph=availH, pw=ph*pbAR, gap=pages.length>1?2:0, totalW=pw*pages.length+gap;
    if(totalW>availW){ var s=availW/totalW; ph*=s; pw*=s; }
    book.innerHTML=""; book.style.height=Math.round(ph)+"px";
    pages.forEach(function(pi){ var pg=pbPages[pi]; var pageEl=document.createElement("div"); pageEl.className="pbPage2"+(pg.cover?" cover":""); pageEl.style.width=Math.round(pw)+"px"; pageEl.style.height=Math.round(ph)+"px"; pageEl.setAttribute("data-pi",pi);
      var guides=document.createElement("div"); guides.className="pbGuides"; pageEl.appendChild(guides);
      if(pg.cover){ var cov=document.createElement("div"); cov.className="pbCover"; cov.innerHTML="<div class='ct'>"+esc(studentName||"My Photobook")+"</div><div class='cs'>Photographs</div>"; pageEl.appendChild(cov); }
      else pg.frames.forEach(function(fr){ var f=document.createElement("div"); f.className="pbFrame"; f.style.left=(fr.x*100)+"%"; f.style.top=(fr.y*100)+"%"; f.style.width=(fr.w*100)+"%"; f.style.height=(fr.h*100)+"%"; f.innerHTML="<img src='"+fr.url+"' draggable='false'><button class='del' title='Remove'>✕</button><span class='rs'></span>"; pageEl.appendChild(f); pbBindFrame(f, fr, pi, pageEl); });
      pageEl.addEventListener("pointerdown",function(e){ if(e.target===pageEl||e.target.classList.contains("pbGuides")||e.target.classList.contains("pbCover")){ pbFocus=pi; pbMarkFocus(); pbClearSel(); } });
      book.appendChild(pageEl); });
    var lbl=$("pbPageLbl"); if(lbl) lbl.textContent=(pbIdx===0?"Cover":("Spread "+pbIdx+" / "+(pbSpreadCount()-1))); pbMarkFocus(); }
  function pbBindFrame(f, fr, pi, pageEl){ var del=f.querySelector(".del"), rs=f.querySelector(".rs");
    del.addEventListener("pointerdown",function(e){ e.stopPropagation(); }); del.onclick=function(e){ e.stopPropagation(); var i=pbPages[pi].frames.indexOf(fr); if(i>=0) pbPages[pi].frames.splice(i,1); pbRender(); };
    function start(e, mode){ e.preventDefault(); e.stopPropagation(); pbFocus=pi; pbMarkFocus(); pbClearSel(); f.classList.add("sel"); f.style.zIndex="40";
      var pr=pageEl.getBoundingClientRect(), sx=e.clientX, sy=e.clientY, o={x:fr.x,y:fr.y,w:fr.w,h:fr.h}; try{f.setPointerCapture(e.pointerId);}catch(err){}
      function mv(ev){ var dx=(ev.clientX-sx)/pr.width, dy=(ev.clientY-sy)/pr.height;
        if(mode==="mv"){ fr.x=o.x+dx; fr.y=o.y+dy; } else { fr.w=Math.max(0.08,o.w+dx); fr.h=Math.max(0.08,o.h+dy); }
        var g=pbSnap(fr, pbPages[pi].frames, mode); pbDrawGuides(pageEl, g);
        f.style.left=(fr.x*100)+"%"; f.style.top=(fr.y*100)+"%"; f.style.width=(fr.w*100)+"%"; f.style.height=(fr.h*100)+"%"; }
      function up(ev){ try{f.releasePointerCapture(ev.pointerId);}catch(err){} f.removeEventListener("pointermove",mv); f.removeEventListener("pointerup",up); f.removeEventListener("pointercancel",up); pbDrawGuides(pageEl,[]); f.style.zIndex=""; }
      f.addEventListener("pointermove",mv); f.addEventListener("pointerup",up); f.addEventListener("pointercancel",up); }
    f.addEventListener("pointerdown",function(e){ if(e.button!==0||e.target===del) return; start(e, e.target===rs?"rs":"mv"); }); }
  function pbSnap(fr, sibs, mode){ var TH=0.016, guides=[], xT=[0,0.06,0.5,0.94,1], yT=[0,0.08,0.5,0.92,1];
    sibs.forEach(function(s){ if(s===fr) return; xT.push(s.x, s.x+s.w/2, s.x+s.w); yT.push(s.y, s.y+s.h/2, s.y+s.h); });
    function snap1(v, targets){ var best=null,bd=TH; targets.forEach(function(t){ var d=Math.abs(v-t); if(d<bd){ bd=d; best=t; } }); return best; }
    if(mode==="mv"){ var xc=[["l",fr.x],["c",fr.x+fr.w/2],["r",fr.x+fr.w]], i, t;
      for(i=0;i<3;i++){ t=snap1(xc[i][1],xT); if(t!=null){ fr.x=(xc[i][0]==="l")?t:(xc[i][0]==="c")?t-fr.w/2:t-fr.w; guides.push({axis:"x",pos:t}); break; } }
      var yc=[["t",fr.y],["m",fr.y+fr.h/2],["b",fr.y+fr.h]];
      for(i=0;i<3;i++){ t=snap1(yc[i][1],yT); if(t!=null){ fr.y=(yc[i][0]==="t")?t:(yc[i][0]==="m")?t-fr.h/2:t-fr.h; guides.push({axis:"y",pos:t}); break; } }
    } else { var tr=snap1(fr.x+fr.w,xT); if(tr!=null){ fr.w=tr-fr.x; guides.push({axis:"x",pos:tr}); } var tb=snap1(fr.y+fr.h,yT); if(tb!=null){ fr.h=tb-fr.y; guides.push({axis:"y",pos:tb}); } }
    return guides; }
  function pbDrawGuides(pageEl, guides){ var g=pageEl.querySelector(".pbGuides"); if(!g) return; g.innerHTML=""; guides.forEach(function(gu){ var l=document.createElement("div"); l.className="pbGuide "+gu.axis; if(gu.axis==="x") l.style.left=(gu.pos*100)+"%"; else l.style.top=(gu.pos*100)+"%"; g.appendChild(l); }); }
  function pbFlip(d){ pbIdx=Math.max(0,Math.min(pbSpreadCount()-1,pbIdx+d)); pbFocus=(pbIdx===0)?0:pbIdx*2-1; pbRender(); }
  function pbAddSpread(){ pbPages.push(pbBlank()); pbPages.push(pbBlank()); pbIdx=pbSpreadCount()-1; pbFocus=pbIdx*2-1; pbRender(); }
  function pbDownload(){ var pages=pbSpreadPages(), PW=1400, PH=Math.round(PW/pbAR), gap=pages.length>1?8:0;
    var cv=document.createElement("canvas"); cv.width=PW*pages.length+gap; cv.height=PH; var ctx=cv.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height);
    var tasks=[]; pages.forEach(function(pi,idx){ var ox=idx*(PW+gap), pg=pbPages[pi];
      if(pg.cover){ ctx.fillStyle="#20232a"; ctx.fillRect(ox,0,PW,PH); ctx.fillStyle="#f3efe7"; ctx.textAlign="center"; ctx.font="600 "+Math.round(PW*0.085)+"px Georgia,serif"; ctx.fillText(studentName||"My Photobook", ox+PW/2, PH*0.52); }
      else pg.frames.forEach(function(fr){ tasks.push({fr:fr,ox:ox}); }); });
    var loaded=0, N=tasks.length; if(!N){ pbSaveCanvas(cv); return; }
    tasks.forEach(function(t){ var im=new Image(); im.onload=function(){ var dx=t.ox+t.fr.x*PW, dy=t.fr.y*PH, dw=t.fr.w*PW, dh=t.fr.h*PH, ar=im.naturalWidth/im.naturalHeight, tar=dw/dh, sw,sh,sxx,syy;
        if(ar>tar){ sh=im.naturalHeight; sw=sh*tar; sxx=(im.naturalWidth-sw)/2; syy=0; } else { sw=im.naturalWidth; sh=sw/tar; sxx=0; syy=(im.naturalHeight-sh)/2; }
        ctx.drawImage(im,sxx,syy,sw,sh,dx,dy,dw,dh); if(++loaded>=N) pbSaveCanvas(cv); }; im.onerror=function(){ if(++loaded>=N) pbSaveCanvas(cv); }; im.src=t.fr.url; }); }
  function pbSaveCanvas(cv){ var url; try{ url=cv.toDataURL("image/png"); }catch(e){ toast("Couldn't export."); return; } var a=document.createElement("a"); a.href=url; a.download=(namePrefix()||"")+"photobook-"+pbIdx+".png"; document.body.appendChild(a); a.click(); a.remove(); toast("Spread downloaded"); }
  // ---------- Photobook PDF export: every spread as its own page ----------
  function pbPagesForSpread(s){ if(s<=0) return [0]; var l=s*2-1,r=s*2,a=[]; if(pbPages[l]!=null)a.push(l); if(pbPages[r]!=null)a.push(r); return a; }
  function pbRenderPagesToCanvas(pageIdxs, cb){ var PW=1240, PH=Math.round(PW/pbAR);
    var cv=document.createElement("canvas"); cv.width=PW*Math.max(1,pageIdxs.length); cv.height=PH;
    var ctx=cv.getContext("2d"); ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,cv.width,cv.height); var tasks=[];
    pageIdxs.forEach(function(pi,idx){ var ox=idx*PW, pg=pbPages[pi]; if(!pg) return;
      if(pg.cover){ ctx.fillStyle="#20232a"; ctx.fillRect(ox,0,PW,PH); ctx.textAlign="center"; ctx.textBaseline="alphabetic";
        ctx.fillStyle="#f3efe7"; ctx.font="600 "+Math.round(PW*0.082)+"px Georgia,'Times New Roman',serif"; ctx.fillText(studentName||"My Photobook", ox+PW/2, PH*0.5);
        ctx.fillStyle="#b7b1a5"; ctx.font="400 "+Math.round(PW*0.03)+"px Georgia,'Times New Roman',serif"; ctx.fillText("Photographs", ox+PW/2, PH*0.5+Math.round(PW*0.058)); }
      else pg.frames.forEach(function(fr){ tasks.push({fr:fr,ox:ox}); }); });
    var loaded=0,N=tasks.length; if(!N){ cb(cv); return; }
    tasks.forEach(function(t){ var im=new Image(); im.onload=function(){ var dx=t.ox+t.fr.x*PW, dy=t.fr.y*PH, dw=t.fr.w*PW, dh=t.fr.h*PH, ar=im.naturalWidth/im.naturalHeight, tar=dw/dh, sw,sh,sxx,syy;
      if(ar>tar){ sh=im.naturalHeight; sw=sh*tar; sxx=(im.naturalWidth-sw)/2; syy=0; } else { sw=im.naturalWidth; sh=sw/tar; sxx=0; syy=(im.naturalHeight-sh)/2; }
      ctx.drawImage(im,sxx,syy,sw,sh,dx,dy,dw,dh); if(++loaded>=N) cb(cv); }; im.onerror=function(){ if(++loaded>=N) cb(cv); }; im.src=t.fr.url; }); }
  function pbExportPDF(){ if(!pbPages.length) pbInit(); toast("Building PDF…");
    var n=pbSpreadCount(), specs=[], s; for(s=0;s<n;s++) specs.push(pbPagesForSpread(s));
    var cans=new Array(specs.length), done=0;
    specs.forEach(function(pl,i){ pbRenderPagesToCanvas(pl,function(cv){ cans[i]=cv; if(++done>=specs.length) pbBuildPDF(cans); }); }); }
  function pbBuildPDF(canvases, fname, msg){ var imgs=[], i, durl, b64;
    for(i=0;i<canvases.length;i++){ try{ durl=canvases[i].toDataURL("image/jpeg",0.9); }catch(e){ toast("Couldn't export PDF (image blocked)."); return; }
      b64=durl.substring(durl.indexOf(",")+1); imgs.push({bin:atob(b64), w:canvases[i].width, h:canvases[i].height}); }
    if(!imgs.length){ toast("Nothing to export."); return; }
    var K=72/150, pdf="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", offsets=[], N=2+imgs.length*3;
    var pageObjs=[]; for(i=0;i<imgs.length;i++) pageObjs.push(5+i*3);
    function objStart(nn){ offsets[nn]=pdf.length; }
    objStart(1); pdf+="1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
    objStart(2); pdf+="2 0 obj\n<< /Type /Pages /Kids ["; pageObjs.forEach(function(pn){ pdf+=" "+pn+" 0 R"; }); pdf+=" ] /Count "+imgs.length+" >>\nendobj\n";
    imgs.forEach(function(g,idx){ var imgN=3+idx*3, contN=4+idx*3, pgN=5+idx*3, wpt=(g.w*K).toFixed(2), hpt=(g.h*K).toFixed(2);
      objStart(imgN); pdf+=imgN+" 0 obj\n<< /Type /XObject /Subtype /Image /Width "+g.w+" /Height "+g.h+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+g.bin.length+" >>\nstream\n"+g.bin+"\nendstream\nendobj\n";
      var cs="q "+wpt+" 0 0 "+hpt+" 0 0 cm /Im0 Do Q\n";
      objStart(contN); pdf+=contN+" 0 obj\n<< /Length "+cs.length+" >>\nstream\n"+cs+"endstream\nendobj\n";
      objStart(pgN); pdf+=pgN+" 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+wpt+" "+hpt+"] /Resources << /XObject << /Im0 "+imgN+" 0 R >> >> /Contents "+contN+" 0 R >>\nendobj\n"; });
    var xref=pdf.length; pdf+="xref\n0 "+(N+1)+"\n0000000000 65535 f \n";
    for(i=1;i<=N;i++){ var off=(offsets[i]||0).toString(); while(off.length<10) off="0"+off; pdf+=off+" 00000 n \n"; }
    pdf+="trailer\n<< /Size "+(N+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";
    var bytes=new Uint8Array(pdf.length); for(i=0;i<pdf.length;i++) bytes[i]=pdf.charCodeAt(i)&0xFF;
    var blob=new Blob([bytes],{type:"application/pdf"}), url=URL.createObjectURL(blob);
    var a=document.createElement("a"); a.href=url; a.download=(namePrefix()||"")+(fname||"photobook.pdf"); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} },5000);
    toast((msg||"Photobook PDF downloaded")+" · "+imgs.length+" page"+(imgs.length>1?"s":"")); }
  var GXL=[{id:"single",name:"Single row"},{id:"salon",name:"Salon hang"},{id:"triptych",name:"Feature trio"},{id:"wrap",name:"Wrap-around"}];
  var gxLayout="single", gxRX=0, gxRY=0, gxDragBound=false;
  function openGalleryShow(){ if(!anyPhotos()){ toast("Take some photos first."); return; } openOverlayOnly($("galleryshow")); gxBuildLayouts(); gxBindDrag(); requestAnimationFrame(gxRender); }
  function gxBuildLayouts(){ var el=$("gxLayouts"); if(!el) return; el.innerHTML=""; GXL.forEach(function(l){ var b=document.createElement("button"); b.className="btn"+(l.id===gxLayout?" primary":""); b.textContent=l.name; b.onclick=function(){ gxLayout=l.id; gxBuildLayouts(); gxRender(); }; el.appendChild(b); }); }
  function gxWorldTransform(){ var w=$("gxWorld"); if(w) w.style.transform="translateZ(-40px) rotateX("+gxRX.toFixed(2)+"deg) rotateY("+gxRY.toFixed(2)+"deg)"; }
  function gxBindDrag(){ if(gxDragBound) return; var room=$("gxRoom"); if(!room) return; gxDragBound=true; var dragging=false,sx=0,sy=0,rx0=0,ry0=0;
    room.addEventListener("pointerdown",function(e){ dragging=true; room.classList.add("drag"); sx=e.clientX; sy=e.clientY; rx0=gxRX; ry0=gxRY; try{room.setPointerCapture(e.pointerId);}catch(err){} });
    room.addEventListener("pointermove",function(e){ if(!dragging) return; gxRY=Math.max(-20,Math.min(20,ry0+(e.clientX-sx)*0.05)); gxRX=Math.max(-8,Math.min(11,rx0-(e.clientY-sy)*0.04)); gxWorldTransform(); });
    function up(){ dragging=false; room.classList.remove("drag"); } room.addEventListener("pointerup",up); room.addEventListener("pointercancel",up); }
  function gxFrame(host,HW,HH,url,cx,cy,w,h,plate){ var d=document.createElement("div"); d.className="gxart";
    d.style.left=((cx-w/2)/HW*100).toFixed(2)+"%"; d.style.top=((cy-h/2)/HH*100).toFixed(2)+"%"; d.style.width=(w/HW*100).toFixed(2)+"%"; d.style.height=(h/HH*100).toFixed(2)+"%";
    d.innerHTML="<div class='mat'><div class='ph'><img src='"+url+"' draggable='false'></div></div>"+(plate?"<div class='plate'>"+esc(plate)+"</div>":""); host.appendChild(d); }
  function gxClear(){ ["gxWallBack","gxLeft","gxRight"].forEach(function(id){ var h=$(id); if(h) Array.prototype.slice.call(h.querySelectorAll(".gxart")).forEach(function(f){ f.remove(); }); }); }
  function gxRender(){ if(!$("gxWallBack")) return; gxClear(); gxWorldTransform();
    var ph=photos.slice(0,12), nm=studentName||"", back=$("gxWallBack"), left=$("gxLeft"), right=$("gxRight");
    var BW=1600, BH=540, SW=1300, eye=250, i;
    if(gxLayout==="single"){ var n=Math.min(ph.length,5)||1, w=210, h=286, gap=(BW-n*w)/(n+1);
      for(i=0;i<n;i++){ gxFrame(back,BW,BH,ph[i].url, gap+i*(w+gap)+w/2, eye, w, h, nm); } }
    else if(gxLayout==="triptych"){ var m=Math.min(ph.length,3)||1, w2=300, g2=(BW-m*w2)/(m+1);
      for(i=0;i<m;i++){ gxFrame(back,BW,BH,ph[i].url, g2+i*(w2+g2)+w2/2, eye, w2, w2*1.28, nm); } }
    else if(gxLayout==="salon"){ var cols=Math.min(Math.max(Math.ceil(ph.length/2),3),6), gc=BW/(cols+1);
      ph.forEach(function(p,idx){ var col=idx%cols, row=Math.floor(idx/cols); if(row>1) return; var w=150+((idx*47)%90), h=w*(1.05+((idx*29)%7)/10); var cx=gc*(col+1); var cy=(row?348:170); gxFrame(back,BW,BH,p.url,cx,cy,w,h,""); }); }
    else { var b=Math.min(ph.length,3), gb=(BW-3*230)/4;
      for(i=0;i<b;i++){ gxFrame(back,BW,BH,ph[i].url, gb+i*(230+gb)+115, eye, 230, 300, nm); }
      if(left) for(i=0;i<2 && b+i<ph.length;i++){ gxFrame(left,SW,BH,ph[b+i].url, 360+i*470, eye, 300, 300, ""); }
      if(right) for(i=0;i<2 && b+2+i<ph.length;i++){ gxFrame(right,SW,BH,ph[b+2+i].url, 360+i*470, eye, 300, 300, ""); } }
  }
  if($("btnFolio")) $("btnFolio").onclick=openFolio;
  if($("btnPhotobook")) $("btnPhotobook").onclick=openPhotobook;
  if($("btnGalleryShow")) $("btnGalleryShow").onclick=openGalleryShow;
  if($("foBack")) $("foBack").onclick=function(){ hide($("folio")); studioReturn(); };
  if($("foAuto")) $("foAuto").onclick=foShuffle;
  if($("foClear")) $("foClear").onclick=function(){ foClearBoard(); foPack(false); };
  if($("foDownload")) $("foDownload").onclick=foDownload;
  if($("foUpload")) $("foUpload").onclick=function(){ if($("foFile")) $("foFile").click(); };
  if($("foFile")) $("foFile").onchange=function(){ var self=this; importPhotoFiles(self.files,function(n){ if(!n){ toast("No images added."); return; }
    photos.slice(-n).forEach(function(ph){ foItems.push({url:ph.url,size:"M"}); }); foBuildTray(); foPack(true); toast(n+" photo"+(n>1?"s":"")+" added to the board"); saveSession(); }); self.value=""; };
  if($("pbBack")) $("pbBack").onclick=function(){ hide($("photobook")); studioReturn(); };
  if($("pbPrev")) $("pbPrev").onclick=function(){ pbFlip(-1); };
  if($("pbNext")) $("pbNext").onclick=function(){ pbFlip(1); };
  if($("pbAdd")) $("pbAdd").onclick=pbAddSpread;
  if($("pbUpload")) $("pbUpload").onclick=function(){ if($("pbFile")) $("pbFile").click(); };
  if($("pbFile")) $("pbFile").onchange=function(){ var self=this; importPhotoFiles(self.files,function(n){ if(!n){ toast("No images added."); return; } pbBuildTray(); toast(n+" photo"+(n>1?"s":"")+" added — click one to place it"); saveSession(); }); self.value=""; };
  if($("pbDownload")) $("pbDownload").onclick=pbExportPDF;
  if($("gxBack")) $("gxBack").onclick=function(){ hide($("galleryshow")); studioReturn(); };
  window.addEventListener("resize",function(){ var f=$("folio"); if(f&&!f.classList.contains("hidden")){ foSizeBoard(); foPack(false); } var pb=$("photobook"); if(pb&&!pb.classList.contains("hidden")) pbRender(); var g=$("galleryshow"); if(g&&!g.classList.contains("hidden")) gxRender(); });

  initCameraUI();
  buildScenePicker();
  loadSession(function(ok,n){ if(ok){ if(typeof studioSync==="function") studioSync(); if(lsWho()) toast("Restored your last session · "+n+" photo"+(n>1?"s":"")); } if(App.is("hub")) hubRender(); });
  if(!lsWho()) siShow(); else if(lsRole()==="teacher") openTeacher("plan"); else { if(lsWho().name) studentName=lsWho().name; hubRender(); }
  window.addEventListener("beforeunload", saveSessionNow);
  document.addEventListener("visibilitychange", function(){ if(document.hidden) saveSessionNow(); });
  setInterval(function(){ if(photos.length||(typeof foItems!=="undefined"&&foItems&&foItems.length)) saveSessionNow(); }, 9000);
  if(/[?&]dev/.test(location.search)){ try{ window.__ed={openEditor:openEditor,eglInit:eglInit,photos:photos,defEd:defEd,editRender:editRender,selectBody:selectBody,BODIES:BODIES,openFolio:openFolio,openPhotobook:openPhotobook,openGalleryShow:openGalleryShow,
    foPack:foPack,foShuffle:foShuffle,foSeed:foSeed,importPhotoFiles:importPhotoFiles,pbExportPDF:pbExportPDF,pbBuildPDF:pbBuildPDF,pbInit:pbInit,updateCamArt:updateCamArt,switchCamTab:switchCamTab,camArtSVG:camArtSVG,gxRender:gxRender,gxBuildLayouts:gxBuildLayouts,gxBindDrag:gxBindDrag,loadSplat:loadSplat,showHub:showHub,openSplatViewer:openSplatViewer,openStudioHome:openStudioHome,openPunctum:openPunctum,photoTip:photoTip,saveSessionNow:saveSessionNow,loadSession:loadSession,clearSession:clearSession,showTutorial:showTutorial,cycleComp:cycleComp,drawComp:drawComp,raiseCamera:raiseCamera,shutter:shutter,get foItems(){return foItems;},get pbPages(){return pbPages;},get foBW(){return foBW;},get foBH(){return foBH;}}; }catch(e){} }
  if(/[?&]dev/.test(location.search)){ window.__ls={db:function(){ return lsDB; }, setClock:function(hm){ var m=/^(\d+):(\d+)$/.exec(hm), d=new Date(); d.setHours(+m[1],+m[2],0,0); lsClockOff=d.getTime()-Date.now(); lsTick(); }, tick:lsTick, who:lsWho, plan:lsPlan, cur:function(){ var p=lsPlan(); return p?lsCur(p):null; }, count:lsCount, moveOpen:lsMoveOpen, pill:function(){ return ls.pill; }, tc:tc, tcPlan:tcPlan, roster:function(){ return tcRoster(tcPlan()); }}; }
  if(/[?&]dev/.test(location.search)){ window.__cb={open:openBack, close:closeBack, tab:cbSetTab, state:function(){ return App.state; },
    cam:function(){ return {ap:APERTURES[apIdx], sh:SHUTTER_LABELS[shIdx], iso:ISOS[isoIdx], ev:+evStops.toFixed(2), mm:focalMM, body:curBody().id, lens:lensId}; }, bag:function(){ return {open:bg.open, stage:bg.stage, body:bg.body, lens:bg.lens, busy:bg.busy}; }, studio:function(){ var bd=function(B){ var d=B.doc_(); return {cur:d.cur, paper:d.paper, pages:d.pages.map(function(p){ return p.items.map(function(it){ return {t:it.t, i:it.pid?stById(it.pid):-1, x:Math.round(it.x), y:Math.round(it.y), w:Math.round(it.w), h:Math.round(B.hOf(it)), hidden:!!it.hidden, locked:!!it.locked, f:it.f||null, text:it.text||null}; }); }), sel:B.selected()}; };
      return {open:st.open, room:st.room, cur:st.cur, ws:bd(wsB), fo:bd(foB), book:{size:bk.size, spread:bk.spread, focus:bk.focus, sel:bk.sel, pages:bk.pages.map(function(p){ return {tpl:p.tpl, imgs:p.imgs.map(stById)}; })}}; }, addPhoto:function(p){ p.t=new Date(); photos.push(p); refreshCount(); }, open_:function(){ return cbOpen; }, photos:photos, fov:function(){ return camera.fov; }, dial:function(){ return vfDial; }, focus:function(){ return focusDist; } }; }
})();

