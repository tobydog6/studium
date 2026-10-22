  // ================= LIGHTING TEST (?relight): lights you place, relighting the splats =================
  // Splats carry no surfaces, but each one is a stretched blob, and on a surface it flattens like a disc: its thinnest
  // axis is a good guess at the surface normal. So every splat gets a normal and a "how flat is it" confidence. Each
  // light (a bare bulb, or a spot with a cone) scales a splat's own colour by how much it faces the light and how far
  // away it is (inverse square), on top of the daylight. No shadows yet. It recolours on the CPU and re-uploads the
  // colours, so it updates when something changes, not every frame.
  var RL={on:false, ready:false, busy:false, N:0, orig:null, P:null, Nrm:null, conf:null, S:1,
    dusk:0.25, ambK:6500, exp:0, bulbs:true, lights:[], sel:-1, nid:1, t:0};
  var RL_MAX=8;
  // colour temperature in kelvin to an RGB multiplier, normalised so 6500 K is white (Tanner Helland's fit)
  function rlKelvin(k){ var t=k/100, r, g, b;
    r=t<=66?255:329.698727446*Math.pow(t-60,-0.1332047592);
    g=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-0.0755148492);
    b=t>=66?255:(t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307);
    var c=function(v){ return Math.max(0,Math.min(255,v))/255; }; return [c(r),c(g),c(b)]; }
  var RL_WHITE=rlKelvin(6500);
  function rlRGB(k){ var c=rlKelvin(k); return [c[0]/RL_WHITE[0], c[1]/RL_WHITE[1], c[2]/RL_WHITE[2]]; }
  function rlGel(hex){ var n=parseInt((hex||"#ffffff").slice(1),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; }
  function rlLightRGB(L){ var k=rlRGB(L.k), g=rlGel(L.gel); return [k[0]*g[0],k[1]*g[1],k[2]*g[2]]; }
  function rlHex(c){ var m=Math.max(c[0],c[1],c[2],1e-6); return "#"+c.map(function(v){ return ("0"+Math.round(v/m*255).toString(16)).slice(-2); }).join(""); }
  function rlMesh(){ return viewer&&viewer.splatMesh; }
  // Bundled scenes are in metres with a walk map. Your own scans have neither (no ground to look up, and any scale: a
  // Spirula scan can be 2 units across), so there the ground is the bottom of the scan and every distance is scaled.
  function rlScale(){ return WK.col?1:Math.max(0.02,Math.min(50,(sceneMaxDim||8)/8)); }
  function rlGround(x,z){ var g=WK.col&&typeof wkGround==="function"?wkGround(x,z):NaN; if(g>-1e8&&g<1e8) return g; return WK.col?camPos.y-1.6:Math.min(boxMin.y,camPos.y-0.2*RL.S); }

  // read every splat once: its centre, a normal from its thinnest axis, and how flat (trustworthy) that axis is
  function rlPrepare(done){ var mesh=rlMesh(); if(!mesh||!mesh.splatDataTextures||!mesh.splatDataTextures.baseData.colors){ toast("Lighting test: the scan isn't ready yet"); return; }
    var N=mesh.getSplatCount(), base=mesh.splatDataTextures.baseData; RL.N=N; RL.orig=new Uint8Array(base.colors.subarray(0,N*4)); RL.S=rlScale();
    RL.P=new Float32Array(N*3); RL.Nrm=new Float32Array(N*3); RL.conf=new Float32Array(N);
    var c=new THREE.Vector3(), s=new THREE.Vector3(), q=new THREE.Quaternion(), ax=new THREE.Vector3(), i=0;
    RL.busy=true; rlStatus("Reading "+N.toLocaleString()+" splats…");
    (function chunk(){ var end=Math.min(N,i+60000);
      for(;i<end;i++){ mesh.getSplatCenter(i,c,true); mesh.getSplatScaleAndRotation(i,s,q,true);
        RL.P[i*3]=c.x; RL.P[i*3+1]=c.y; RL.P[i*3+2]=c.z;
        var sx=Math.abs(s.x), sy=Math.abs(s.y), sz=Math.abs(s.z), k=sx<=sy&&sx<=sz?0:sy<=sz?1:2, mn=Math.min(sx,sy,sz), md=sx+sy+sz-mn-Math.max(sx,sy,sz);
        ax.set(k===0?1:0,k===1?1:0,k===2?1:0).applyQuaternion(q).normalize();
        RL.Nrm[i*3]=ax.x; RL.Nrm[i*3+1]=ax.y; RL.Nrm[i*3+2]=ax.z; RL.conf[i]=Math.max(0,Math.min(1,1-mn/Math.max(md,1e-6)*1.4)); }   // a disc is flat: thin axis much smaller than the next
      if(i<N){ rlStatus("Reading splats… "+Math.round(i/N*100)+"%"); setTimeout(chunk,0); } else { RL.ready=true; RL.busy=false; rlStatus(""); done&&done(); } })(); }

  // recolour every splat for the current lights, then upload the colours
  function rlApply(){ if(!RL.ready) return; var mesh=rlMesh(), base=mesh.splatDataTextures.baseData, col=base.colors, o=RL.orig, N=RL.N, P=RL.P, Nm=RL.Nrm, cf=RL.conf;
    var E=Math.pow(2,RL.exp), A=rlRGB(RL.ambK), D=RL.dusk, ar=D*A[0]*E, ag=D*A[1]*E, ab=D*A[2]*E, iS2=1/(RL.S*RL.S), ex=camPos.x, ey=camPos.y, ez=camPos.z, t0=performance.now();
    // flatten the lights that are on into plain numbers for the hot loop
    var Ls=RL.lights.filter(function(L){ return L.on&&L.power>0; }).map(function(L){ var c=rlLightRGB(L), half=L.cone*Math.PI/360;
      return {x:L.x,y:L.y,z:L.z, r:c[0]*L.power*E, g:c[1]*L.power*E, b:c[2]*L.power*E, soft:L.soft, spot:L.type==="spot", dx:L.dir[0],dy:L.dir[1],dz:L.dir[2], co:Math.cos(half), ci:Math.cos(half*0.7)}; });
    var nL=Ls.length;
    for(var i=0;i<N;i++){ var j=i*3, r=ar, g=ag, b=ab, px=P[j], py=P[j+1], pz=P[j+2], nx=Nm[j], ny=Nm[j+1], nz=Nm[j+2], f=cf[i];
      if(nL&&nx*(ex-px)+ny*(ey-py)+nz*(ez-pz)<0){ nx=-nx; ny=-ny; nz=-nz; }   // a disc has two sides: take the one you can see
      for(var m=0;m<nL;m++){ var L=Ls[m], lx=L.x-px, ly=L.y-py, lz=L.z-pz, r2=lx*lx+ly*ly+lz*lz, d=Math.sqrt(r2)||1e-6;
        var lam=(nx*lx+ny*ly+nz*lz)/d; if(lam<0) lam=0; var sh=lam*f+0.45*(1-f);   // blobby splats get a soft half-light
        if(L.spot){ var ca=-(lx*L.dx+ly*L.dy+lz*L.dz)/d; if(ca<=L.co) continue; if(ca<L.ci){ var u=(ca-L.co)/(L.ci-L.co); sh*=u*u*(3-2*u); } }
        var I=sh/(r2*iS2+L.soft); r+=I*L.r; g+=I*L.g; b+=I*L.b; }
      var k=i*4; col[k]=Math.min(255,o[k]*r); col[k+1]=Math.min(255,o[k+1]*g); col[k+2]=Math.min(255,o[k+2]*b); col[k+3]=o[k+3]; }
    var cc=mesh.splatDataTextures.centerColors; mesh.constructor.updateCenterColorsPaddedData(0,N-1,base.centers,col,cc.data); cc.texture.needsUpdate=true;
    if(typeof SKY!=="undefined"&&SKY.mesh) SKY.mesh.material.uniforms.dim.value=Math.max(0.05,Math.min(1,D*E));   // the sky goes down with the daylight
    RL.ms=Math.round(performance.now()-t0); rlMarkers(); rlPanel(); }
  function rlRestore(){ if(!RL.ready) return; var mesh=rlMesh(), base=mesh.splatDataTextures.baseData; base.colors.set(RL.orig);
    var cc=mesh.splatDataTextures.centerColors; mesh.constructor.updateCenterColorsPaddedData(0,RL.N-1,base.centers,base.colors,cc.data); cc.texture.needsUpdate=true;
    if(typeof SKY!=="undefined"&&SKY.mesh) SKY.mesh.material.uniforms.dim.value=1; }

  // the splat under the crosshair: the nearest one close to the line you're looking down
  function rlPick(){ if(!RL.ready) return null; var f=new THREE.Vector3(); camera.getWorldDirection(f); var P=RL.P, N=RL.N, ox=camPos.x, oy=camPos.y, oz=camPos.z, best=-1, bt=1e30, mt=0.05*RL.S;
    for(var i=0;i<N;i++){ var vx=P[i*3]-ox, vy=P[i*3+1]-oy, vz=P[i*3+2]-oz, t=vx*f.x+vy*f.y+vz*f.z; if(t<mt||t>=bt) continue;
      var p2=vx*vx+vy*vy+vz*vz-t*t, lim=t*0.012+0.004*RL.S; if(p2<lim*lim){ bt=t; best=i; } }
    return best<0?null:{x:P[best*3], y:P[best*3+1], z:P[best*3+2], t:bt}; }
  function rlCur(){ return RL.lights[RL.sel]||null; }
  // a light on a stand, a step in front of you; or a little off the surface you're looking at
  function rlPut(L, where){ var S=RL.S, f=new THREE.Vector3(); camera.getWorldDirection(f);
    if(where==="look"){ var p=rlPick(); if(!p){ toast("Nothing under the crosshair to light"); return false; } var back=Math.min(0.35*S,p.t*0.5);
      L.x=p.x-f.x*back; L.y=p.y-f.y*back; L.z=p.z-f.z*back; L.g=rlGround(L.x,L.z); L.h=(L.y-L.g)/S; rlAimAt(L,p); return true; }
    var hl=Math.hypot(f.x,f.z)||1; L.x=camPos.x+f.x/hl*1.1*S; L.z=camPos.z+f.z/hl*1.1*S; L.g=rlGround(L.x,L.z);
    if(L.h==null) L.h=Math.min(0.7,(camPos.y-L.g)/S); L.y=L.g+L.h*S; return true; }
  function rlAimAt(L,p){ var dx=p.x-L.x, dy=p.y-L.y, dz=p.z-L.z, d=Math.hypot(dx,dy,dz)||1; L.dir=[dx/d,dy/d,dz/d]; }
  function rlAdd(where){ if(RL.lights.length>=RL_MAX){ toast("That's "+RL_MAX+" lights, the most for now"); return; }
    var prev=rlCur(), L={id:RL.nid++, on:true, type:prev?prev.type:"bulb", power:prev?prev.power:3, k:prev?prev.k:3200, gel:"#ffffff", soft:0.12, cone:50, h:null, dir:[0,-1,0]};
    if(!rlPut(L, where||"front")) return; if(where!=="look"){ var f=new THREE.Vector3(); camera.getWorldDirection(f); L.dir=[f.x,f.y,f.z]; }
    RL.lights.push(L); RL.sel=RL.lights.length-1; RL.placed=(RL.placed||0)+1; rlApply(); }

  // the bulbs: a sphere in the light's colour, a ring round the selected one, an arrow down a spot's beam.
  // Never in the picture: they hide when the camera is up.
  var rlGeo=null;
  function rlMarkers(){ if(typeof scene==="undefined") return; var S=RL.S, show=RL.on&&RL.bulbs&&!viewfinderOn;
    RL.lights.forEach(function(L,i){ if(!L.mk){ if(!rlGeo) rlGeo=new THREE.SphereGeometry(0.025,16,12);
        L.mk=new THREE.Group(); L.mk.add(new THREE.Mesh(rlGeo,new THREE.MeshBasicMaterial({color:0xffffff})));
        var ring=new THREE.Mesh(new THREE.RingGeometry(0.04,0.048,32),new THREE.MeshBasicMaterial({color:0xe3ad57,side:THREE.DoubleSide,transparent:true,opacity:.9,depthTest:false})); L.mk.add(ring); L.ring=ring;
        L.arrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),0.18,0xffe2a8,0.04,0.025); L.mk.add(L.arrow); scene.add(L.mk); }
      L.mk.position.set(L.x,L.y,L.z); L.mk.scale.setScalar(S); L.mk.visible=show;
      L.mk.children[0].material.color.set(L.on?rlHex(rlLightRGB(L)):"#3a3630");
      L.ring.visible=i===RL.sel; L.ring.quaternion.copy(camera.quaternion);
      L.arrow.visible=L.type==="spot"; L.arrow.setDirection(new THREE.Vector3(L.dir[0],L.dir[1],L.dir[2])); }); }
  function rlDrop(L){ if(L.mk){ scene.remove(L.mk); L.mk.traverse(function(o){ if(o.material) o.material.dispose(); }); L.mk=null; } }
  (function rlWatch(){ requestAnimationFrame(rlWatch); if(!RL.lights.length) return; var want=RL.on&&RL.bulbs&&!viewfinderOn;
    RL.lights.forEach(function(L){ if(L.mk){ L.mk.visible=want; if(L.ring.visible) L.ring.quaternion.copy(camera.quaternion); } }); })();

  function rlToggle(){ RL.on=!RL.on; if(RL.on){ rlPanel(); if(!RL.ready) rlPrepare(function(){ rlApply(); }); else rlApply(); }
    else { rlRestore(); rlMarkers(); rlPanel(); } }
  function rlReset(){ RL.lights.forEach(rlDrop); RL.lights=[]; RL.sel=-1; RL.dusk=0.25; RL.ambK=6500; RL.exp=0; rlApply(); }
  function rlStatus(t){ RL.status=t; rlPanel(); }

  // ---- the panel ----
  function rlSlider(scope,k,label,min,max,val,shown){ return '<label><span>'+label+'</span><input type="range" data-rl-s="'+scope+'" data-rl-k="'+k+'" min="'+min+'" max="'+max+'" value="'+val+'"><em>'+shown+'</em></label>'; }
  function rlShow(k,v){ return k==="dusk"?Math.round(v*100)+"%" : k==="ambK"||k==="k"?Math.round(v/100)*100+"K" : k==="exp"?(v>0?"+":"")+v.toFixed(1) : k==="cone"?Math.round(v)+"°" : k==="soft"?Math.round(v*100) : v.toFixed(1); }
  // slider positions <-> values
  var RL_SL={ dusk:[0,100,function(v){ return v/100; },function(x){ return Math.round(x*100); }],
    ambK:[2500,12000,function(v){ return v; },function(x){ return x; }], k:[1800,10000,function(v){ return v; },function(x){ return x; }],
    exp:[-30,30,function(v){ return v/10; },function(x){ return Math.round(x*10); }], power:[0,1000,function(v){ return v/100; },function(x){ return Math.round(x*100); }],
    soft:[2,100,function(v){ return v/100; },function(x){ return Math.round(x*100); }], h:[0,250,function(v){ return v/100; },function(x){ return Math.round(x*100); }],
    cone:[10,150,function(v){ return v; },function(x){ return x; }] };
  function rlSl(scope,k,label,obj){ var d=RL_SL[k]; return rlSlider(scope,k,label,d[0],d[1],d[3](obj[k]),rlShow(k,obj[k])); }
  function rlPanel(){ var p=$("rlPanel"); if(!p){ p=document.createElement("div"); p.id="rlPanel"; document.body.appendChild(p); p.addEventListener("input",rlInput); p.addEventListener("click",rlClick); p.addEventListener("keydown",function(e){ e.stopPropagation(); }); }
    p.classList.toggle("show", RL.on);
    if(!RL.on) return; var ae=document.activeElement; if(p.contains(ae)&&(ae.type==="range"||ae.type==="color")) return;   // don't rebuild under a dragging slider
    var L=rlCur(), h='<div class="rl-h"><b>LIGHTING</b><button data-rl="off" title="Close (L)">✕</button></div>'+(RL.status?'<p class="rl-s">'+RL.status+'</p>':'');
    h+='<div class="rl-sec">SCENE</div>'+rlSl("g","dusk","DAYLIGHT",RL)+rlSl("g","ambK","DAYLIGHT COLOUR",RL)+rlSl("g","exp","EXPOSURE",RL)
      +'<div class="rl-row"><button data-rl="bulbs" class="'+(RL.bulbs?'on':'')+'">'+(RL.bulbs?'BULBS SHOWN':'BULBS HIDDEN')+'</button><button data-rl="reset">RESET ALL</button></div>';
    h+='<div class="rl-sec">LIGHTS</div><div class="rl-list">'+RL.lights.map(function(l,i){ return '<button data-rl-pick="'+i+'" class="'+(i===RL.sel?'on':'')+(l.on?'':' off')+'"><i style="background:'+rlHex(rlLightRGB(l))+'"></i>'+(i+1)+(l.type==="spot"?' SPOT':'')+'</button>'; }).join("")
      +(RL.lights.length<RL_MAX?'<button data-rl="add" class="add">+ ADD</button>':'')+'</div>';
    if(!RL.lights.length) h+='<button class="rl-go" data-rl="add">PLACE A LIGHT HERE</button><button class="rl-go2" data-rl="addlook">PLACE ONE WHERE I\'M LOOKING</button>';
    if(L){ h+='<div class="rl-t2"><button data-rl-type="bulb" class="'+(L.type==="bulb"?'on':'')+'">BARE BULB</button><button data-rl-type="spot" class="'+(L.type==="spot"?'on':'')+'">SPOT</button></div>'
        +rlSl("l","power","POWER",L)+rlSl("l","k","COLOUR TEMP",L)
        +'<label><span>GEL</span><input type="color" data-rl-s="l" data-rl-k="gel" value="'+L.gel+'"><em><button data-rl="nogel" title="No gel">✕</button></em></label>'
        +rlSl("l","soft","SOFTNESS",L)+rlSl("l","h","HEIGHT",L)+(L.type==="spot"?rlSl("l","cone","BEAM",L):'')
        +'<div class="rl-row"><button data-rl="front">MOVE IN FRONT OF ME</button><button data-rl="look">MOVE TO CROSSHAIR</button></div>'
        +(L.type==="spot"?'<div class="rl-row"><button data-rl="aim" class="wide">AIM AT THE CROSSHAIR</button></div>':'')
        +'<div class="rl-row"><button data-rl="onoff">'+(L.on?'SWITCH OFF':'SWITCH ON')+'</button><button data-rl="dup">DUPLICATE</button><button data-rl="del" class="del">DELETE</button></div>'; }
    h+='<p class="rl-n">Lights relight the splats that face them, falling off with distance. A spot only lights inside its beam: look at what you want lit and aim it. Bulbs hide when you raise the camera. No shadows yet.'+(RL.ms!=null?' · '+RL.ms+' ms':'')+'</p>';
    p.innerHTML=h; }
  var rlT=0;
  function rlInput(e){ var k=e.target.getAttribute("data-rl-k"); if(!k) return; var sc=e.target.getAttribute("data-rl-s"), obj=sc==="l"?rlCur():RL; if(!obj) return;
    if(k==="gel") obj.gel=e.target.value;
    else { var v=RL_SL[k][2](+e.target.value); obj[k]=v; var em=e.target.parentNode.querySelector("em"); if(em) em.textContent=rlShow(k,v); if(k==="h"){ obj.y=obj.g+v*RL.S; } }
    clearTimeout(rlT); rlT=setTimeout(rlApply, RL.N>1500000?200:90); }
  function rlClick(e){ var b=e.target.closest("[data-rl],[data-rl-pick],[data-rl-type]"); if(!b) return; e.stopPropagation(); var L=rlCur();
    if(b.hasAttribute("data-rl-pick")){ RL.sel=+b.getAttribute("data-rl-pick"); rlMarkers(); b.blur(); rlPanel(); return; }
    if(b.hasAttribute("data-rl-type")){ if(L){ L.type=b.getAttribute("data-rl-type"); rlApply(); } return; }
    var a=b.getAttribute("data-rl"), go=function(fn){ if(!RL.ready) rlPrepare(fn); else fn(); };
    if(a==="off") rlToggle();
    else if(a==="add") go(function(){ rlAdd("front"); });
    else if(a==="addlook") go(function(){ rlAdd("look"); });
    else if(a==="bulbs"){ RL.bulbs=!RL.bulbs; rlMarkers(); rlPanel(); }
    else if(a==="reset") rlReset();
    else if(!L) return;
    else if(a==="front"||a==="look"){ if(rlPut(L,a)) rlApply(); }
    else if(a==="aim"){ var p=rlPick(); if(p){ rlAimAt(L,p); rlApply(); } else toast("Nothing under the crosshair to aim at"); }
    else if(a==="onoff"){ L.on=!L.on; rlApply(); }
    else if(a==="nogel"){ L.gel="#ffffff"; rlApply(); }
    else if(a==="dup"){ if(RL.lights.length>=RL_MAX) return; var c={}; for(var k in L) if(k!=="mk"&&k!=="ring"&&k!=="arrow") c[k]=L[k]; c.dir=L.dir.slice(); c.id=RL.nid++; c.x+=0.25*RL.S; RL.lights.push(c); RL.sel=RL.lights.length-1; rlApply(); }
    else if(a==="del"){ rlDrop(L); RL.lights.splice(RL.sel,1); RL.sel=Math.min(RL.sel,RL.lights.length-1); rlApply(); } }
  // a new scan: everything starts over
  function rlForget(){ RL.lights.forEach(rlDrop); RL.lights=[]; RL.sel=-1; RL.on=false; RL.ready=false; RL.orig=null; rlPanel(); }
  if(/[?&]relight(&|=|$)/.test(location.search)){
    window.addEventListener("keydown",function(e){ if(e.code==="KeyL"&&loaded&&(App.is("scene")||App.is("viewfinder"))&&!(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))){ e.preventDefault(); rlToggle(); } });
    setTimeout(function(){ toast("Lighting test is on: press L in the scene"); },1500); }
  if(/[?&]dev/.test(location.search)) window.__rl={ toggle:rlToggle, place:function(w){ rlAdd(w||"front"); }, pick:rlPick,
    set:function(o){ for(var k in o) RL[k]=o[k]; rlApply(); }, light:function(o){ var L=rlCur(); if(L){ for(var k in o) L[k]=o[k]; rlApply(); } },
    state:function(){ var L=RL.lights[0]; return {on:RL.on, ready:RL.ready, N:RL.N, n:RL.lights.length, sel:RL.sel, light:L?{x:L.x,y:L.y,z:L.z}:null, ms:RL.ms, placed:RL.placed||0, S:RL.S}; } };
