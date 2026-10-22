  // ================= LIGHTING TEST (?relight): a light you place, relighting the splats =================
  // Splats carry no surfaces, but each one is a stretched blob, and on a surface it flattens like a disc: its thinnest
  // axis is a good guess at the surface normal. So every splat gets a normal and a "how flat is it" confidence. Place a
  // light and each splat's own colour is scaled by how much it faces the light and how far away it is (inverse square),
  // on top of the daylight turned down to dusk. No shadows yet. It recolours on the CPU and re-uploads the colours, so
  // it updates when you place or change the light, not every frame.
  var RL={on:false, ready:false, busy:false, N:0, orig:null, P:null, Nrm:null, conf:null, light:null, marker:null,
    dusk:0.25, power:3, temp:"tungsten", mode:"place", t:0};
  var RL_TEMPS={tungsten:[1.0,0.72,0.42], daylight:[1.0,0.97,0.92], cool:[0.75,0.86,1.0]};
  function rlMesh(){ return viewer&&viewer.splatMesh; }
  // read every splat once: its centre, a normal from its thinnest axis, and how flat (trustworthy) that axis is
  function rlPrepare(done){ var mesh=rlMesh(); if(!mesh||!mesh.splatDataTextures||!mesh.splatDataTextures.baseData.colors){ toast("Lighting test: the scan isn't ready yet"); return; }
    var N=mesh.getSplatCount(), base=mesh.splatDataTextures.baseData; RL.N=N; RL.orig=new Uint8Array(base.colors.subarray(0,N*4));
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
  // recolour every splat for the current light, then upload the colours
  function rlApply(){ if(!RL.ready) return; var mesh=rlMesh(), base=mesh.splatDataTextures.baseData, col=base.colors, o=RL.orig, N=RL.N, P=RL.P, Nm=RL.Nrm, cf=RL.conf;
    var L=RL.light, iS2=1/((RL.S||1)*(RL.S||1)), D=RL.dusk, W=RL.power, T=RL_TEMPS[RL.temp], ex=camPos.x, ey=camPos.y, ez=camPos.z, t0=performance.now();
    for(var i=0;i<N;i++){ var j=i*3, r=D, g=D, b=D;
      if(L){ var lx=L.x-P[j], ly=L.y-P[j+1], lz=L.z-P[j+2], r2=lx*lx+ly*ly+lz*lz, d2=r2*iS2+0.12, d=Math.sqrt(r2), nx=Nm[j], ny=Nm[j+1], nz=Nm[j+2];
        if(nx*(ex-P[j])+ny*(ey-P[j+1])+nz*(ez-P[j+2])<0){ nx=-nx; ny=-ny; nz=-nz; }   // a disc has two sides: take the one you can see
        var lam=(nx*lx+ny*ly+nz*lz)/d; if(lam<0) lam=0; var f=cf[i], sh=lam*f+0.45*(1-f), I=W*sh/d2;   // blobby splats get a soft half-light
        r+=I*T[0]; g+=I*T[1]; b+=I*T[2]; }
      var k=i*4; col[k]=Math.min(255,o[k]*r); col[k+1]=Math.min(255,o[k+1]*g); col[k+2]=Math.min(255,o[k+2]*b); col[k+3]=o[k+3]; }
    var cc=mesh.splatDataTextures.centerColors; mesh.constructor.updateCenterColorsPaddedData(0,N-1,base.centers,col,cc.data); cc.texture.needsUpdate=true;
    if(typeof SKY!=="undefined"&&SKY.mesh) SKY.mesh.material.uniforms.dim.value=Math.max(0.05,D);   // the sky goes down with the daylight
    RL.ms=Math.round(performance.now()-t0); rlPanel(); }
  function rlRestore(){ if(!RL.ready) return; var mesh=rlMesh(), base=mesh.splatDataTextures.baseData; base.colors.set(RL.orig);
    var cc=mesh.splatDataTextures.centerColors; mesh.constructor.updateCenterColorsPaddedData(0,RL.N-1,base.centers,base.colors,cc.data); cc.texture.needsUpdate=true;
    if(typeof SKY!=="undefined"&&SKY.mesh) SKY.mesh.material.uniforms.dim.value=1; }
  // the light: put it where you're standing, a little in front and above, like a light on a stand
  // Bundled scenes are in metres with a walk map. Your own scans have neither: no ground to look up (it reports -1e9)
  // and any scale (a Spirula scan can be 2 units across). So for those, the ground is the bottom of the scan and every
  // distance, the light's stand and its falloff are scaled to the scan's size.
  function rlScale(){ return WK.col?1:Math.max(0.02,Math.min(50,(sceneMaxDim||8)/8)); }
  function rlPlace(){ var f=new THREE.Vector3(); camera.getWorldDirection(f); var S=RL.S=rlScale(), lx=camPos.x+f.x*1.1*S, lz=camPos.z+f.z*1.1*S;
    var g=WK.col&&typeof wkGround==="function"?wkGround(lx,lz):NaN; if(!(g>-1e8&&g<1e8)) g=WK.col?camPos.y-1.6:Math.min(boxMin.y,camPos.y-0.2*S);
    RL.light={x:lx, y:Math.min(g+0.7*S,camPos.y), z:lz};   // a light on a short stand, a step in front of you
    if(!RL.marker){ RL.marker=new THREE.Mesh(new THREE.SphereGeometry(0.025,16,12), new THREE.MeshBasicMaterial({color:0xffe2a8})); scene.add(RL.marker); }
    RL.marker.scale.setScalar(S); RL.marker.position.set(RL.light.x,RL.light.y,RL.light.z); RL.marker.visible=true; RL.placed=(RL.placed||0)+1; rlApply(); }
  function rlToggle(){ RL.on=!RL.on; if(RL.on){ rlPanel(); if(!RL.ready) rlPrepare(function(){ rlApply(); }); else rlApply(); }
    else { rlRestore(); if(RL.marker) RL.marker.visible=false; rlPanel(); } }
  function rlStatus(t){ RL.status=t; rlPanel(); }
  function rlPanel(){ var p=$("rlPanel"); if(!p){ p=document.createElement("div"); p.id="rlPanel"; document.body.appendChild(p); p.addEventListener("input",rlInput); p.addEventListener("click",rlClick); p.addEventListener("keydown",function(e){ e.stopPropagation(); }); }
    p.classList.toggle("show", RL.on);
    if(!RL.on) return; if(p.contains(document.activeElement)&&document.activeElement.type==="range") return;   // don't rebuild under a dragging slider
    p.innerHTML='<div class="rl-h"><b>LIGHTING TEST</b><button data-rl="off">✕</button></div>'
      +(RL.status?'<p class="rl-s">'+RL.status+'</p>':'')
      +'<label><span>DAYLIGHT</span><input type="range" data-rl-k="dusk" min="0" max="100" value="'+Math.round(RL.dusk*100)+'"><em>'+Math.round(RL.dusk*100)+'%</em></label>'
      +'<label><span>LIGHT POWER</span><input type="range" data-rl-k="power" min="0" max="400" value="'+Math.round(RL.power*100)+'"><em>'+RL.power.toFixed(1)+'</em></label>'
      +'<div class="rl-t">'+["tungsten","daylight","cool"].map(function(t){ return '<button data-rl-t="'+t+'"'+(RL.temp===t?' class="on"':'')+'>'+t.toUpperCase()+'</button>'; }).join("")+'</div>'
      +'<button class="rl-go" data-rl="place">'+(RL.light?'MOVE THE LIGHT HERE':'PLACE A LIGHT HERE')+'</button>'
      +'<p class="rl-n">Look where you want the light and place it: it goes a step in front of you, at waist height. Splats facing it light up, falling off with distance. No shadows yet.'+(RL.ms?' · '+RL.ms+' ms':'')+'</p>'; }
  var rlT=0;
  function rlInput(e){ var k=e.target.getAttribute("data-rl-k"); if(!k) return; var v=+e.target.value/100; RL[k]=v; var em=e.target.parentNode.querySelector("em"); if(em) em.textContent=k==="dusk"?Math.round(v*100)+"%":v.toFixed(1);
    clearTimeout(rlT); rlT=setTimeout(rlApply,120); }
  function rlClick(e){ var b=e.target.closest("[data-rl],[data-rl-t]"); if(!b) return; e.stopPropagation();
    if(b.hasAttribute("data-rl-t")){ RL.temp=b.getAttribute("data-rl-t"); rlApply(); return; }
    var a=b.getAttribute("data-rl"); if(a==="off") rlToggle(); else if(a==="place"){ if(!RL.ready) rlPrepare(rlPlace); else rlPlace(); } }
  if(/[?&]relight(&|=|$)/.test(location.search)){
    window.addEventListener("keydown",function(e){ if(e.code==="KeyL"&&loaded&&(App.is("scene")||App.is("viewfinder"))&&!(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))){ e.preventDefault(); rlToggle(); } });
    setTimeout(function(){ toast("Lighting test is on: press L in the scene"); },1500); }
  if(/[?&]dev/.test(location.search)) window.__rl={ toggle:rlToggle, place:rlPlace, set:function(o){ for(var k in o) RL[k]=o[k]; rlApply(); }, state:function(){ return {on:RL.on, ready:RL.ready, N:RL.N, light:RL.light, ms:RL.ms, placed:RL.placed||0, S:RL.S, cam:[camPos.x,camPos.y,camPos.z], lo:boxMin.y}; } };
