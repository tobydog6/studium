  // ================= LIGHTING TEST (?relight): lights you place, relighting the splats =================
  // Splats carry no surfaces, but each one is a stretched blob, and on a surface it flattens like a disc: its thinnest
  // axis is a good guess at the surface normal. So every splat gets a normal and a "how flat is it" confidence. Each
  // light (a bare bulb, or a spot with a cone) scales a splat's own colour by how much it faces the light and how far
  // away it is (inverse square), on top of the daylight. No shadows yet. It recolours on the CPU and re-uploads the
  // colours, so it updates when something changes, not every frame.
  var RL={on:false, ready:false, busy:false, N:0, orig:null, P:null, Nrm:null, conf:null, S:1,
    dusk:0.25, ambK:6500, exp:0, bulbs:true, shadows:true, plan:false, planH:1, lights:[], sel:-1, nid:1, t:0, grid:null};
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

  // ---- shadows: a density grid of the scan ----
  // Splats have no surfaces to cast shadows with, so the scan becomes a 3D grid of "how much stuff is here" (opacity
  // per cell, normalised so a typical surface cell is nearly opaque). From each lit splat we march to the light adding
  // up what it passes through: solid things block, leaves let some light through. Worked out once per light position.
  function rlGrid(){ if(RL.grid) return RL.grid; var N=RL.N, P=RL.P, o=RL.orig, mn=boxMin, mx=boxMax, pad=0.05*(sceneMaxDim||8);
    var x0=mn.x-pad, y0=mn.y-pad, z0=mn.z-pad, ex=mx.x-x0+pad, ey=mx.y-y0+pad, ez=mx.z-z0+pad, cell=Math.max(ex,ey,ez)/200;
    var nx=Math.max(1,Math.ceil(ex/cell)), ny=Math.max(1,Math.ceil(ey/cell)), nz=Math.max(1,Math.ceil(ez/cell)), raw=new Float32Array(nx*ny*nz), i;
    for(i=0;i<N;i++){ var gx=((P[i*3]-x0)/cell)|0, gy=((P[i*3+1]-y0)/cell)|0, gz=((P[i*3+2]-z0)/cell)|0;
      if(gx<0||gy<0||gz<0||gx>=nx||gy>=ny||gz>=nz) continue; raw[(gz*ny+gy)*nx+gx]+=o[i*4+3]/255; }
    var nzv=[]; for(i=0;i<raw.length;i+=7) if(raw[i]>0) nzv.push(raw[i]); nzv.sort(function(a,b){ return a-b; });
    var med=nzv.length?nzv[Math.floor(nzv.length*0.8)]:1, k=(RL.shK||0.35)/med;   // only the densest fifth of cells (solid stuff) come out near-opaque
    // soften by one cell each way so shadows don't come out pixelly
    var T=new Float32Array(raw.length), a=raw, b=T, d, x, y, z;
    for(d=0;d<3;d++){ var st=d===0?1:d===1?nx:nx*ny, len=d===0?nx:d===1?ny:nz;
      for(z=0;z<nz;z++) for(y=0;y<ny;y++) for(x=0;x<nx;x++){ var c=(z*ny+y)*nx+x, q=d===0?x:d===1?y:z;
        b[c]=a[c]*0.5+(q>0?a[c-st]:0)*0.25+(q<len-1?a[c+st]:0)*0.25; }
      var t=a; a=b; b=t; }
    for(i=0;i<a.length;i++) a[i]=Math.min(a[i]*k,6);
    RL.grid={x0:x0,y0:y0,z0:z0,cell:cell,nx:nx,ny:ny,nz:nz,tau:a}; return RL.grid; }
  // how much light gets from L to splat i (0 = fully shadowed)
  function rlMarch(G,px,py,pz,L){ var dx=L.x-px, dy=L.y-py, dz=L.z-pz, d=Math.sqrt(dx*dx+dy*dy+dz*dz), c=G.cell, st=c*0.8; if(d<c*2) return 1;
    dx/=d; dy/=d; dz/=d; var acc=0, tau=G.tau, nx=G.nx, ny=G.ny, nz=G.nz, iv=1/c;
    for(var t=c*(RL.shOff||3);t<d-c;t+=st){ var gx=((px+dx*t-G.x0)*iv)|0, gy=((py+dy*t-G.y0)*iv)|0, gz=((pz+dz*t-G.z0)*iv)|0;
      if(gx<0||gy<0||gz<0||gx>=nx||gy>=ny||gz>=nz) break; acc+=tau[(gz*ny+gy)*nx+gx]*0.8; if(acc>6) return 0; }
    return Math.exp(-acc); }

  // recolour every splat for the current lights, then upload the colours
  function rlApply(){ if(!RL.ready) return; var mesh=rlMesh(), base=mesh.splatDataTextures.baseData, col=base.colors, o=RL.orig, N=RL.N, P=RL.P, Nm=RL.Nrm, cf=RL.conf;
    var E=Math.pow(2,RL.exp), A=rlRGB(RL.ambK), D=RL.dusk, ar=D*A[0]*E, ag=D*A[1]*E, ab=D*A[2]*E, iS2=1/(RL.S*RL.S), ex=camPos.x, ey=camPos.y, ez=camPos.z, t0=performance.now();
    // flatten the lights that are on into plain numbers for the hot loop
    var Ls=RL.lights.filter(function(L){ return L.on&&L.power>0; }).map(function(L){ var c=rlLightRGB(L), half=L.cone*Math.PI/360;
      var key=L.x.toFixed(4)+','+L.y.toFixed(4)+','+L.z.toFixed(4); if(RL.shadows&&(!L.vis||L.vis.length!==N||L.visKey!==key)){ if(!L.vis||L.vis.length!==N) L.vis=new Float32Array(N); L.vis.fill(-1); L.visKey=key; }
      return {vis:RL.shadows?L.vis:null, x:L.x,y:L.y,z:L.z, r:c[0]*L.power*E, g:c[1]*L.power*E, b:c[2]*L.power*E, soft:L.soft, spot:L.type==="spot", dx:L.dir[0],dy:L.dir[1],dz:L.dir[2], co:Math.cos(half), ci:Math.cos(half*0.7)}; });
    var nL=Ls.length, G=RL.shadows&&nL?rlGrid():null, cut=RL.plan?RL.cutY:1e30;
    for(var i=0;i<N;i++){ var j=i*3, r=ar, g=ag, b=ab, px=P[j], py=P[j+1], pz=P[j+2], nx=Nm[j], ny=Nm[j+1], nz=Nm[j+2], f=cf[i];
      if(nL&&nx*(ex-px)+ny*(ey-py)+nz*(ez-pz)<0){ nx=-nx; ny=-ny; nz=-nz; }   // a disc has two sides: take the one you can see
      for(var m=0;m<nL;m++){ var L=Ls[m], lx=L.x-px, ly=L.y-py, lz=L.z-pz, r2=lx*lx+ly*ly+lz*lz, d=Math.sqrt(r2)||1e-6;
        var lam=(nx*lx+ny*ly+nz*lz)/d; if(lam<0) lam=0; var sh=lam*f+0.45*(1-f);   // blobby splats get a soft half-light
        if(L.spot){ var ca=-(lx*L.dx+ly*L.dy+lz*L.dz)/d; if(ca<=L.co) continue; if(ca<L.ci){ var u=(ca-L.co)/(L.ci-L.co); sh*=u*u*(3-2*u); } }
        if(L.vis&&G){ var v=L.vis[i]; if(v<0) v=L.vis[i]=rlMarch(G,px,py,pz,L); if(v<0.003) continue; sh*=v; }
        var I=sh/(r2*iS2+L.soft); r+=I*L.r; g+=I*L.g; b+=I*L.b; }
      var k=i*4; col[k]=Math.min(255,o[k]*r); col[k+1]=Math.min(255,o[k+1]*g); col[k+2]=Math.min(255,o[k+2]*b); col[k+3]=py>cut?0:o[k+3]; }
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
  // the kit: real fixtures are presets of the same controls
  var RL_FX={ fresnel:{n:"FRESNEL",type:"spot",k:3200,power:12,soft:0.05,cone:35,gel:"#ffffff",h:1.6},
    led:{n:"LED PANEL",type:"bulb",k:5600,power:9,soft:0.6,cone:90,gel:"#ffffff",h:1.4},
    speed:{n:"SPEEDLIGHT",type:"spot",k:5500,power:16,soft:0.15,cone:70,gel:"#ffffff",h:1.5},
    torch:{n:"TORCH",type:"spot",k:4500,power:7,soft:0.03,cone:18,gel:"#ffffff",h:1.2},
    candle:{n:"CANDLE",type:"bulb",k:1900,power:1.8,soft:0.08,cone:90,gel:"#ffffff",h:0.3},
    sodium:{n:"STREETLIGHT",type:"bulb",k:2000,power:14,soft:0.3,cone:90,gel:"#ffb050",h:2.4},
    rgb:{n:"RGB TUBE",type:"bulb",k:6500,power:7,soft:0.2,cone:90,gel:"#ff3df0",h:1}};
  var RL_TIMES={ day:{n:"DAY",dusk:1,ambK:6500}, golden:{n:"GOLDEN HOUR",dusk:0.55,ambK:3300}, blue:{n:"BLUE HOUR",dusk:0.18,ambK:11000}, night:{n:"NIGHT",dusk:0.04,ambK:9000} };
  function rlCur(){ return RL.lights[RL.sel]||null; }
  // a light on a stand, a step in front of you; or a little off the surface you're looking at
  function rlPut(L, where){ var S=RL.S, f=new THREE.Vector3(); camera.getWorldDirection(f);
    if(where==="look"){ var p=rlPick(); if(!p){ toast("Nothing under the crosshair to light"); return false; } var back=Math.min(0.35*S,p.t*0.5);
      L.x=p.x-f.x*back; L.y=p.y-f.y*back; L.z=p.z-f.z*back; L.g=rlGround(L.x,L.z); L.h=(L.y-L.g)/S; rlAimAt(L,p); return true; }
    var hl=Math.hypot(f.x,f.z)||1; L.x=camPos.x+f.x/hl*1.1*S; L.z=camPos.z+f.z/hl*1.1*S; L.g=rlGround(L.x,L.z);
    if(L.h==null) L.h=Math.min(0.7,(camPos.y-L.g)/S); L.y=L.g+L.h*S; if(L.type==="spot"){ var p=rlPick(); if(p) rlAimAt(L,p); } return true; }
  function rlAimAt(L,p){ var dx=p.x-L.x, dy=p.y-L.y, dz=p.z-L.z, d=Math.hypot(dx,dy,dz)||1; L.dir=[dx/d,dy/d,dz/d]; }
  function rlAdd(where,fx){ if(RL.lights.length>=RL_MAX){ toast("That's "+RL_MAX+" lights, the most for now"); return; }
    var F=RL_FX[fx]||RL_FX.fresnel, L={id:RL.nid++, on:true, fx:fx||"fresnel", name:F.n, type:F.type, power:F.power, k:F.k, gel:F.gel, soft:F.soft, cone:F.cone, h:F.h, dir:[0,-1,0]};
    if(!rlPut(L, where||"front")) return; 
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
  (function rlWatch(){ requestAnimationFrame(rlWatch); if(!RL.lights.length&&!RL.plan) return; var want=RL.on&&RL.bulbs&&!viewfinderOn;
    RL.lights.forEach(function(L){ if(L.mk){ L.mk.visible=want&&!RL.plan; if(L.ring.visible) L.ring.quaternion.copy(camera.quaternion); } }); if(RL.plan) rlPlanDraw(); })();

  // ---- plan view: fly up, look straight down, drag the lights around ----
  // Anything above head height is hidden while you're up there (like an architect's plan cut), so a canopy can't hide
  // the ground. The camera icon is where you were standing.
  var _rlRay=new THREE.Raycaster(), _rlV=new THREE.Vector3(), _rlPl=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  function rlPlanToggle(){ RL.plan=!RL.plan;
    if(RL.plan){ if(looking) document.exitPointerLock(); var S=RL.S, xs=[camPos.x], zs=[camPos.z]; RL.lights.forEach(function(L){ xs.push(L.x); zs.push(L.z); });
      var cx=(Math.min.apply(null,xs)+Math.max.apply(null,xs))/2, cz=(Math.min.apply(null,zs)+Math.max.apply(null,zs))/2, sp=Math.max(Math.max.apply(null,xs)-Math.min.apply(null,xs), Math.max.apply(null,zs)-Math.min.apply(null,zs));
      var f=new THREE.Vector3(); camera.getWorldDirection(f); RL.planEye={x:camPos.x,z:camPos.z,fx:f.x,fz:f.z};
      RL.planC={x:cx,z:cz}; RL.planExt=Math.max(6*S,sp*1.8); RL.planH=1; RL.gRef=rlGround(camPos.x,camPos.z); RL.cutY=RL.gRef+2.4*S; }
    rlPlanUI(); rlApply(); }
  function rlPlanCam(){ if(!RL.plan) return; var fov=camera.fov*Math.PI/180, h=RL.planExt*RL.planH/(2*Math.tan(fov/2)*Math.min(1,camera.aspect));
    camera.up.set(0,0,-1); camera.position.set(RL.planC.x, RL.gRef+h, RL.planC.z); camera.lookAt(RL.planC.x, RL.gRef, RL.planC.z); camera.updateMatrixWorld(); }
  function rlScr(x,y,z){ _rlV.set(x,y,z).project(camera); return {x:(_rlV.x*0.5+0.5)*innerWidth, y:(-_rlV.y*0.5+0.5)*innerHeight}; }
  function rlOnPlane(e,y){ _rlRay.setFromCamera({x:e.clientX/innerWidth*2-1, y:-(e.clientY/innerHeight)*2+1}, camera); _rlPl.constant=-y; var o=new THREE.Vector3(); return _rlRay.ray.intersectPlane(_rlPl,o)?o:null; }
  function rlPlanUI(){ var u=$("rlPlanUI"); if(!u){ u=document.createElement("div"); u.id="rlPlanUI"; document.body.appendChild(u);
      u.addEventListener("pointerdown",rlPlanDown); u.addEventListener("wheel",function(e){ e.preventDefault(); e.stopPropagation(); RL.planH=Math.max(0.3,Math.min(4,RL.planH*(e.deltaY>0?1.12:0.89))); },{passive:false}); }
    u.classList.toggle("show",RL.plan); if(!RL.plan) return;
    u.innerHTML='<svg></svg><div class="rlp-you" title="Where you were standing"><i></i><span>YOU</span></div>'+RL.lights.map(function(L,i){ return '<div class="rlp-l'+(i===RL.sel?' on':'')+(L.on?'':' off')+'" data-i="'+i+'"><i style="background:'+rlHex(rlLightRGB(L))+'"></i><span>'+(i+1)+' '+(L.name||'')+'</span></div>'+(L.type==="spot"?'<div class="rlp-h" data-i="'+i+'" title="Drag to aim"></div>':''); }).join("")
      +'<p class="rlp-tip">Drag a light to move it'+(RL.lights.some(function(L){ return L.type==="spot"; })?', drag its dot to aim it':'')+'. Scroll to zoom. <kbd>Esc</kbd> to go back down.</p>'; }
  function rlPlanDraw(){ var u=$("rlPlanUI"); if(!u||!RL.plan) return; var S=RL.S, R=0.11*RL.planExt*RL.planH, svg='';
    RL.lights.forEach(function(L,i){ var p=rlScr(L.x,L.y,L.z), el=u.querySelector('.rlp-l[data-i="'+i+'"]'); if(el) el.style.transform='translate('+p.x+'px,'+p.y+'px)';
      if(L.type==="spot"){ var hx=L.dir[0], hz=L.dir[2], hl=Math.hypot(hx,hz)||1, q=rlScr(L.x+hx/hl*R,L.y,L.z+hz/hl*R), hd=u.querySelector('.rlp-h[data-i="'+i+'"]');
        if(hd) hd.style.transform='translate('+q.x+'px,'+q.y+'px)';
        var a=Math.atan2(q.y-p.y,q.x-p.x), w=L.cone*Math.PI/360, len=Math.hypot(q.x-p.x,q.y-p.y)*1.6;
        svg+='<path d="M'+p.x+' '+p.y+' L'+(p.x+Math.cos(a-w)*len)+' '+(p.y+Math.sin(a-w)*len)+' L'+(p.x+Math.cos(a+w)*len)+' '+(p.y+Math.sin(a+w)*len)+' Z" class="beam'+(L.on?'':' off')+'"/><line x1="'+p.x+'" y1="'+p.y+'" x2="'+q.x+'" y2="'+q.y+'"/>'; }
      else { var rr=Math.abs(rlScr(L.x+R*0.6,L.y,L.z).x-p.x); svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="'+rr+'" class="beam'+(L.on?'':' off')+'"/>'; } });
    var E=RL.planEye, y=rlScr(E.x,RL.gRef,E.z), yf=rlScr(E.x+E.fx*R,RL.gRef,E.z+E.fz*R), you=u.querySelector(".rlp-you");
    if(you) you.style.transform='translate('+y.x+'px,'+y.y+'px) rotate('+(Math.atan2(yf.y-y.y,yf.x-y.x)*180/Math.PI+90)+'deg)';
    svg+='<line class="view" x1="'+y.x+'" y1="'+y.y+'" x2="'+yf.x+'" y2="'+yf.y+'"/>';
    var sv=u.querySelector("svg"); if(sv) sv.innerHTML=svg; }
  var rlDrag=null, rlDragT=0;
  function rlPlanDown(e){ var t=e.target.closest(".rlp-l,.rlp-h"); if(!t) return; e.preventDefault(); var i=+t.getAttribute("data-i"), L=RL.lights[i]; if(!L) return;
    RL.sel=i; rlDrag={L:L, aim:t.classList.contains("rlp-h")}; rlPlanUI(); rlPanel(); rlMarkers();
    window.addEventListener("pointermove",rlPlanMove); window.addEventListener("pointerup",rlPlanUp,{once:true}); }
  function rlPlanMove(e){ if(!rlDrag) return; var L=rlDrag.L, S=RL.S;
    if(rlDrag.aim){ var g=rlOnPlane(e,L.g); if(g) rlAimAt(L,{x:g.x,y:L.g+0.3*S,z:g.z}); }
    else { var p=rlOnPlane(e,L.y); if(p){ L.x=p.x; L.z=p.z; L.g=rlGround(L.x,L.z); L.y=L.g+L.h*S; } }
    var now=performance.now(); if(RL.N<1200000&&now-rlDragT>300){ rlDragT=now; rlApply(); } }   // big scans relight when you let go
  function rlPlanUp(){ window.removeEventListener("pointermove",rlPlanMove); rlDrag=null; rlApply(); }
  window.addEventListener("keydown",function(e){ if(RL.plan&&e.code==="Escape"){ e.preventDefault(); e.stopImmediatePropagation(); rlPlanToggle(); } },true);

  function rlToggle(){ if(RL.on&&RL.plan) rlPlanToggle(); RL.on=!RL.on; if(RL.on){ rlPanel(); if(!RL.ready) rlPrepare(function(){ rlApply(); }); else rlApply(); }
    else { rlRestore(); rlMarkers(); rlPanel(); } }
  function rlReset(){ RL.lights.forEach(rlDrop); RL.lights=[]; RL.sel=-1; RL.dusk=0.25; RL.ambK=6500; RL.exp=0; rlApply(); }
  function rlStatus(t){ RL.status=t; rlPanel(); }

  // ---- the panel ----
  function rlSlider(scope,k,label,min,max,val,shown){ return '<label><span>'+label+'</span><input type="range" data-rl-s="'+scope+'" data-rl-k="'+k+'" min="'+min+'" max="'+max+'" value="'+val+'"><em>'+shown+'</em></label>'; }
  function rlShow(k,v){ return k==="dusk"?Math.round(v*100)+"%" : k==="ambK"||k==="k"?Math.round(v/100)*100+"K" : k==="exp"?(v>0?"+":"")+v.toFixed(1) : k==="cone"?Math.round(v)+"°" : k==="soft"?Math.round(v*100) : v.toFixed(1); }
  // slider positions <-> values
  var RL_SL={ dusk:[0,100,function(v){ return v/100; },function(x){ return Math.round(x*100); }],
    ambK:[2500,12000,function(v){ return v; },function(x){ return x; }], k:[1800,10000,function(v){ return v; },function(x){ return x; }],
    exp:[-30,30,function(v){ return v/10; },function(x){ return Math.round(x*10); }], power:[0,400,function(v){ return v/10; },function(x){ return Math.round(x*10); }],
    soft:[2,100,function(v){ return v/100; },function(x){ return Math.round(x*100); }], h:[0,250,function(v){ return v/100; },function(x){ return Math.round(x*100); }],
    cone:[10,150,function(v){ return v; },function(x){ return x; }] };
  function rlSl(scope,k,label,obj){ var d=RL_SL[k]; return rlSlider(scope,k,label,d[0],d[1],d[3](obj[k]),rlShow(k,obj[k])); }
  function rlPanel(){ var p=$("rlPanel"); if(!p){ p=document.createElement("div"); p.id="rlPanel"; document.body.appendChild(p); p.addEventListener("input",rlInput); p.addEventListener("click",rlClick); p.addEventListener("keydown",function(e){ e.stopPropagation(); }); }
    p.classList.toggle("show", RL.on);
    if(!RL.on) return; var ae=document.activeElement; if(p.contains(ae)&&(ae.type==="range"||ae.type==="color")) return;   // don't rebuild under a dragging slider
    var L=rlCur(), h='<div class="rl-h"><b>LIGHTING</b><button data-rl="off" title="Close (L)">✕</button></div>'+(RL.status?'<p class="rl-s">'+RL.status+'</p>':'');
    h+='<button class="rl-plan" data-rl="plan">'+(RL.plan?'BACK TO EYE LEVEL':'PLAN VIEW · ARRANGE FROM ABOVE')+'</button>';
    h+='<div class="rl-sec">TIME OF DAY</div><div class="rl-row">'+Object.keys(RL_TIMES).map(function(t){ var T=RL_TIMES[t]; return '<button data-rl-time="'+t+'" class="'+(Math.abs(RL.dusk-T.dusk)<0.01&&RL.ambK===T.ambK?'on':'')+'">'+T.n+'</button>'; }).join("")+'</div>'
      +rlSl("g","dusk","DAYLIGHT",RL)+rlSl("g","ambK","DAYLIGHT COLOUR",RL)+rlSl("g","exp","EXPOSURE",RL)
      +'<div class="rl-row"><button data-rl="shadows" class="'+(RL.shadows?'on':'')+'">'+(RL.shadows?'SHADOWS ON':'SHADOWS OFF')+'</button><button data-rl="bulbs" class="'+(RL.bulbs?'on':'')+'">'+(RL.bulbs?'BULBS SHOWN':'BULBS HIDDEN')+'</button><button data-rl="reset">RESET</button></div>';
    h+='<div class="rl-sec">LIGHTS</div><div class="rl-list">'+RL.lights.map(function(l,i){ return '<button data-rl-pick="'+i+'" class="'+(i===RL.sel?'on':'')+(l.on?'':' off')+'"><i style="background:'+rlHex(rlLightRGB(l))+'"></i>'+(i+1)+' '+(l.name||'')+'</button>'; }).join("")+'</div>'
      +(RL.lights.length<RL_MAX?'<div class="rl-sub">ADD A LIGHT IN FRONT OF YOU</div><div class="rl-fx">'+Object.keys(RL_FX).map(function(f){ return '<button data-rl-fx="'+f+'">'+RL_FX[f].n+'</button>'; }).join("")+'</div>':'');
    if(L){ h+='<div class="rl-t2"><button data-rl-type="bulb" class="'+(L.type==="bulb"?'on':'')+'">BARE BULB</button><button data-rl-type="spot" class="'+(L.type==="spot"?'on':'')+'">SPOT</button></div>'
        +rlSl("l","power","POWER",L)+rlSl("l","k","COLOUR TEMP",L)
        +'<label><span>GEL</span><input type="color" data-rl-s="l" data-rl-k="gel" value="'+L.gel+'"><em><button data-rl="nogel" title="No gel">✕</button></em></label>'
        +rlSl("l","soft","SOFTNESS",L)+rlSl("l","h","HEIGHT",L)+(L.type==="spot"?rlSl("l","cone","BEAM",L):'')
        +'<div class="rl-row"><button data-rl="front">MOVE IN FRONT OF ME</button><button data-rl="look">MOVE TO CROSSHAIR</button></div>'
        +(L.type==="spot"?'<div class="rl-row"><button data-rl="aim" class="wide">AIM AT THE CROSSHAIR</button></div>':'')
        +'<div class="rl-row"><button data-rl="onoff">'+(L.on?'SWITCH OFF':'SWITCH ON')+'</button><button data-rl="dup">DUPLICATE</button><button data-rl="del" class="del">DELETE</button></div>'; }
    h+='<p class="rl-n">Pick a light from the kit and it goes on a stand in front of you; spots aim at your crosshair. Arrange them in plan view. Bulbs hide when you raise the camera.'+(RL.ms!=null?' · '+RL.ms+' ms':'')+'</p>';
    p.innerHTML=h; }
  var rlT=0;
  function rlInput(e){ var k=e.target.getAttribute("data-rl-k"); if(!k) return; var sc=e.target.getAttribute("data-rl-s"), obj=sc==="l"?rlCur():RL; if(!obj) return;
    if(k==="gel") obj.gel=e.target.value;
    else { var v=RL_SL[k][2](+e.target.value); obj[k]=v; var em=e.target.parentNode.querySelector("em"); if(em) em.textContent=rlShow(k,v); if(k==="h"){ obj.y=obj.g+v*RL.S; } }
    clearTimeout(rlT); rlT=setTimeout(rlApply, RL.N>1500000?200:90); }
  function rlClick(e){ var b=e.target.closest("[data-rl],[data-rl-pick],[data-rl-type],[data-rl-fx],[data-rl-time]"); if(!b) return; e.stopPropagation(); var L=rlCur();
    if(b.hasAttribute("data-rl-fx")){ var fx=b.getAttribute("data-rl-fx"); (RL.ready?function(f){ f(); }:rlPrepare)(function(){ rlAdd("front",fx); }); return; }
    if(b.hasAttribute("data-rl-time")){ var T=RL_TIMES[b.getAttribute("data-rl-time")]; RL.dusk=T.dusk; RL.ambK=T.ambK; rlApply(); return; }
    if(b.hasAttribute("data-rl-pick")){ RL.sel=+b.getAttribute("data-rl-pick"); rlMarkers(); b.blur(); rlPanel(); return; }
    if(b.hasAttribute("data-rl-type")){ if(L){ L.type=b.getAttribute("data-rl-type"); rlApply(); } return; }
    var a=b.getAttribute("data-rl"), go=function(fn){ if(!RL.ready) rlPrepare(fn); else fn(); };
    if(a==="off") rlToggle();
    else if(a==="add") go(function(){ rlAdd("front"); });
    else if(a==="addlook") go(function(){ rlAdd("look"); });
    else if(a==="shadows"){ RL.shadows=!RL.shadows; rlApply(); }
    else if(a==="plan") go(function(){ rlPlanToggle(); });
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
  function rlForget(){ if(RL.plan){ RL.plan=false; rlPlanUI(); } RL.grid=null; RL.lights.forEach(rlDrop); RL.lights=[]; RL.sel=-1; RL.on=false; RL.ready=false; RL.orig=null; rlPanel(); }
  {
    window.addEventListener("keydown",function(e){ if(e.code==="KeyL"&&loaded&&(App.is("scene")||App.is("viewfinder"))&&!(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))){ e.preventDefault(); rlToggle(); } });
  }
  if(/[?&]dev/.test(location.search)) window.__rl={ toggle:rlToggle, place:function(w){ rlAdd(w||"front"); }, pick:rlPick,
    set:function(o){ for(var k in o) RL[k]=o[k]; rlApply(); }, light:function(o){ var L=rlCur(); if(L){ for(var k in o) L[k]=o[k]; rlApply(); } },
    dbg:function(){ var out=RL.lights.map(function(L){ var v=L.vis, n=0, z=0, sum=0; if(v) for(var i=0;i<v.length;i++){ var P=RL.P, dd=Math.hypot(P[i*3]-L.x,P[i*3+1]-L.y,P[i*3+2]-L.z); if(v[i]>=0&&dd<3*RL.S){ n++; sum+=v[i]; if(v[i]<0.05) z++; } } return {x:L.x,y:L.y,z:L.z,g:L.g,n:n,dark:z,mean:n?sum/n:null}; }); var G=RL.grid; return {lights:out, grid:G?{cell:G.cell,nx:G.nx,ny:G.ny,nz:G.nz}:null, S:RL.S, box:[boxMin.y,boxMax.y]}; },
    state:function(){ var L=RL.lights[0]; return {on:RL.on, ready:RL.ready, N:RL.N, n:RL.lights.length, sel:RL.sel, light:L?{x:L.x,y:L.y,z:L.z}:null, ms:RL.ms, placed:RL.placed||0, S:RL.S}; } };
