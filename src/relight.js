  // ================= LIGHTING: lights you place, relighting the splats =================
  // Splats carry no surfaces, but each one is a stretched blob, and on a surface it flattens like a disc: its thinnest
  // axis is a good guess at the surface normal. So every splat gets a normal and a "how flat is it" confidence. Each
  // light (a bare bulb, or a spot with a cone) scales a splat's own colour by how much it faces the light and how far
  // away it is (inverse square), on top of the daylight. No shadows yet. It recolours on the CPU and re-uploads the
  // colours, so it updates when something changes, not every frame.
  var RL={on:false, ready:false, busy:false, N:0, orig:null, P:null, Nrm:null, conf:null, S:1,
    dusk:1, ambK:6500, exp:0, ui:false, view:"eye", shadows:true, plan:false, planH:1, lights:[], sel:-1, nid:1, t:0, grid:null};
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
    for(d=0;d<6;d++){ var st=d%3===0?1:d%3===1?nx:nx*ny, len=d%3===0?nx:d%3===1?ny:nz;
      for(z=0;z<nz;z++) for(y=0;y<ny;y++) for(x=0;x<nx;x++){ var c=(z*ny+y)*nx+x, q=d%3===0?x:d%3===1?y:z;
        b[c]=a[c]*0.5+(q>0?a[c-st]:0)*0.25+(q<len-1?a[c+st]:0)*0.25; }
      var t=a; a=b; b=t; }
    for(i=0;i<a.length;i++) a[i]=Math.min(a[i]*k,6);
    RL.grid={x0:x0,y0:y0,z0:z0,cell:cell,nx:nx,ny:ny,nz:nz,tau:a}; return RL.grid; }
  // how much light gets from L to splat i (0 = fully shadowed)
  function rlMarch(G,px,py,pz,L){ var dx=L.x-px, dy=L.y-py, dz=L.z-pz, d=Math.sqrt(dx*dx+dy*dy+dz*dz), c=G.cell, st=c*0.8; if(d<c*2) return 1;
    dx/=d; dy/=d; dz/=d; var acc=0, tau=G.tau, nx=G.nx, ny=G.ny, nz=G.nz, iv=1/c;
    for(var t=c*(RL.shOff||3);t<d-c;t+=st){ var fx=(px+dx*t-G.x0)*iv-0.5, fy=(py+dy*t-G.y0)*iv-0.5, fz=(pz+dz*t-G.z0)*iv-0.5, gx=Math.floor(fx), gy=Math.floor(fy), gz=Math.floor(fz);
      if(gx<0||gy<0||gz<0||gx>=nx-1||gy>=ny-1||gz>=nz-1) break; var ux=fx-gx, uy=fy-gy, uz=fz-gz, o=(gz*ny+gy)*nx+gx, sy=nx, sz=nx*ny;   // trilinear: no blocky cells
      var v=((tau[o]*(1-ux)+tau[o+1]*ux)*(1-uy)+(tau[o+sy]*(1-ux)+tau[o+sy+1]*ux)*uy)*(1-uz)+((tau[o+sz]*(1-ux)+tau[o+sz+1]*ux)*(1-uy)+(tau[o+sz+sy]*(1-ux)+tau[o+sz+sy+1]*ux)*uy)*uz;
      acc+=v*0.8; if(acc>4) break; }
    return 0.22+0.78*Math.exp(-acc); }   // never pitch black: light bounces, so shadows keep some fill

  // recolour every splat for the current lights, then upload the colours
  function rlApply(){ if(!RL.ready) return; var mesh=rlMesh(), base=mesh.splatDataTextures.baseData, col=base.colors, o=RL.orig, N=RL.N, P=RL.P, Nm=RL.Nrm, cf=RL.conf;
    var E=Math.pow(2,RL.exp), A=rlRGB(RL.ambK), D=RL.plan?Math.max(RL.dusk,0.4):RL.dusk, ar=D*A[0]*E, ag=D*A[1]*E, ab=D*A[2]*E, iS2=1/(RL.S*RL.S), ex=camPos.x, ey=camPos.y, ez=camPos.z, t0=performance.now();
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
        if(L.vis&&G){ var v=L.vis[i]; if(v<0) v=L.vis[i]=rlMarch(G,px,py,pz,L); sh*=v; }
        var I=sh/(r2*iS2+L.soft); r+=I*L.r; g+=I*L.g; b+=I*L.b; }
      var k=i*4; col[k]=Math.min(255,o[k]*r); col[k+1]=Math.min(255,o[k+1]*g); col[k+2]=Math.min(255,o[k+2]*b); col[k+3]=py>cut?0:o[k+3]; }
    var cc=mesh.splatDataTextures.centerColors; mesh.constructor.updateCenterColorsPaddedData(0,N-1,base.centers,col,cc.data); cc.texture.needsUpdate=true;
    if(typeof SKY!=="undefined"&&SKY.mesh) SKY.mesh.material.uniforms.dim.value=Math.max(0.05,Math.min(1,D*E));   // the sky goes down with the daylight
    RL.ms=Math.round(performance.now()-t0); rlMarkers(); rlPlanUI(); rlPanel(); }
  function rlRestore(){ if(!RL.ready) return; var mesh=rlMesh(), base=mesh.splatDataTextures.baseData; base.colors.set(RL.orig);
    var cc=mesh.splatDataTextures.centerColors; mesh.constructor.updateCenterColorsPaddedData(0,RL.N-1,base.centers,base.colors,cc.data); cc.texture.needsUpdate=true;
    if(typeof SKY!=="undefined"&&SKY.mesh) SKY.mesh.material.uniforms.dim.value=1; }

  // the splat under the crosshair: the nearest one close to the line you're looking down
  function rlPick(){ if(!RL.ready) return null; var f=new THREE.Vector3(); camera.getWorldDirection(f); var P=RL.P, N=RL.N, ox=camPos.x, oy=camPos.y, oz=camPos.z, best=-1, bt=1e30, mt=0.05*RL.S;
    for(var i=0;i<N;i++){ var vx=P[i*3]-ox, vy=P[i*3+1]-oy, vz=P[i*3+2]-oz, t=vx*f.x+vy*f.y+vz*f.z; if(t<mt||t>=bt) continue;
      var p2=vx*vx+vy*vy+vz*vz-t*t, lim=t*0.012+0.004*RL.S; if(p2<lim*lim){ bt=t; best=i; } }
    return best<0?null:{x:P[best*3], y:P[best*3+1], z:P[best*3+2], t:bt}; }
  // ---- the kit: real fixtures are presets ----
  var RL_FX={ fresnel:{n:"Fresnel",d:"Hard, warm spot",type:"spot",k:3200,power:12,soft:0.05,cone:35,h:1.6},
    led:{n:"LED panel",d:"Big and soft",type:"bulb",k:5600,power:9,soft:0.6,cone:90,h:1.4},
    speed:{n:"Speedlight",d:"Punchy flash",type:"spot",k:5500,power:16,soft:0.15,cone:70,h:1.5},
    torch:{n:"Torch",d:"Tight little beam",type:"spot",k:4500,power:7,soft:0.03,cone:18,h:1.2},
    candle:{n:"Candle",d:"Low and orange",type:"bulb",k:1900,power:1.8,soft:0.08,cone:90,h:0.3},
    sodium:{n:"Streetlight",d:"Sodium, overhead",type:"bulb",k:2000,power:14,soft:0.3,cone:90,h:2.4,gel:"#ffb050"},
    rgb:{n:"RGB tube",d:"Any colour",type:"bulb",k:6500,power:7,soft:0.2,cone:90,h:1,gel:"#ff3df0"}};
  var RL_TIMES={ day:{n:"Day",dusk:1,ambK:6500}, golden:{n:"Golden hour",dusk:0.55,ambK:3300}, blue:{n:"Blue hour",dusk:0.18,ambK:11000}, night:{n:"Night",dusk:0.04,ambK:9000} };
  var RL_GELS=[["#ffffff","None"],["#ffc98a","Warm"],["#9cc4ff","Blue"],["#ff5a4a","Red"],["#6dff9a","Green"],["#ff3df0","Magenta"]];
  function rlCur(){ return RL.lights[RL.sel]||null; }
  function rlAimAt(L,p){ var dx=p.x-L.x, dy=p.y-L.y, dz=p.z-L.z, d=Math.hypot(dx,dy,dz)||1; L.dir=[dx/d,dy/d,dz/d]; L.aimT={x:p.x,y:p.y,z:p.z}; }
  function rlSetPos(L,x,z){ L.x=x; L.z=z; L.g=rlGround(x,z); L.y=L.g+L.h*RL.S; if(L.aimT) rlAimAt(L,L.aimT); }

  // what you were looking at when you opened Lighting: new lights land around it, in the classic places
  function rlTarget(){ var f=new THREE.Vector3(); camera.getWorldDirection(f); var p=rlPick(), S=RL.S;
    var sj=typeof CH!=="undefined"&&CH.spec&&CH.spec.subject; if(sj&&Math.hypot(sj[0]-camPos.x,sj[1]-camPos.z)<10*S&&!(p&&p.t<4*S)) return {x:sj[0], y:rlGround(sj[0],sj[1])+0.4*S, z:sj[1]};   // a scene with a known subject: light that
    if(p&&p.t<12*S) return {x:p.x,y:p.y,z:p.z};
    var hl=Math.hypot(f.x,f.z)||1, x=camPos.x+f.x/hl*2*S, z=camPos.z+f.z/hl*2*S; return {x:x, y:rlGround(x,z)+0.5*S, z:z}; }
  var RL_SPOTS=[[45,1.5],[-55,1.9],[160,1.4],[-150,1.8],[100,2.2],[-100,2.2],[20,2.6],[-20,2.6]];   // angle from the camera side, distance: key, fill, rim, back...
  function rlAdd(fx){ if(RL.lights.length>=RL_MAX){ toast("That's "+RL_MAX+" lights, the most for now"); return; }
    var F=RL_FX[fx]||RL_FX.fresnel, T=RL.target||rlTarget(), E=RL.eye||{x:camPos.x,z:camPos.z}, S=RL.S;
    var ax=E.x-T.x, az=E.z-T.z, al=Math.hypot(ax,az)||1; ax/=al; az/=al;
    var sp=RL_SPOTS[RL.lights.length%RL_SPOTS.length], a=sp[0]*Math.PI/180, d=sp[1]*S, ca=Math.cos(a), sa=Math.sin(a);
    var L={id:RL.nid++, on:true, fx:fx, name:F.n, type:F.type, power:F.power, k:F.k, gel:F.gel||"#ffffff", soft:F.soft, cone:F.cone, h:F.h, dir:[0,-1,0]};
    rlSetPos(L, T.x+(ax*ca-az*sa)*d, T.z+(ax*sa+az*ca)*d); rlAimAt(L,T);
    RL.lights.push(L); RL.sel=RL.lights.length-1; RL.placed=(RL.placed||0)+1; rlApply(); }

  // ---- bulbs in the scene: only while you're arranging, never in a photo ----
  var rlGeo=null;
  function rlMarkers(){ if(typeof scene==="undefined") return; var S=RL.S;
    RL.lights.forEach(function(L,i){ if(!L.mk){ if(!rlGeo) rlGeo=new THREE.SphereGeometry(0.03,16,12);
        L.mk=new THREE.Group(); L.mk.add(new THREE.Mesh(rlGeo,new THREE.MeshBasicMaterial({color:0xffffff})));
        L.arrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),0.22,0xffe2a8,0.05,0.03); L.mk.add(L.arrow); scene.add(L.mk); }
      L.mk.position.set(L.x,L.y,L.z); L.mk.scale.setScalar(S*(i===RL.sel?1.4:1));
      L.mk.children[0].material.color.set(L.on?rlHex(rlLightRGB(L)):"#3a3630");
      L.arrow.visible=L.type==="spot"; L.arrow.setDirection(new THREE.Vector3(L.dir[0],L.dir[1],L.dir[2])); }); rlVis(); }
  function rlVis(){ var show=RL.ui&&RL.view==="eye"&&!viewfinderOn; RL.lights.forEach(function(L){ if(L.mk) L.mk.visible=show; }); }
  function rlDrop(L){ if(L.mk){ scene.remove(L.mk); L.mk.traverse(function(o){ if(o.material) o.material.dispose(); }); L.mk=null; } }
  var rlLastT=0;
  (function rlWatch(t){ requestAnimationFrame(rlWatch); var dt=Math.min(0.05,((t||0)-rlLastT)/1000); rlLastT=t||0;
    if(RL.ui&&viewfinderOn) rlClose();   // raising the camera puts the lighting away
    rlVis(); if(!RL.ui||RL.view!=="plan") return;
    var k=typeof keys!=="undefined"?keys:{}, vx=(k.KeyD||k.ArrowRight?1:0)-(k.KeyA||k.ArrowLeft?1:0), vz=(k.KeyS||k.ArrowDown?1:0)-(k.KeyW||k.ArrowUp?1:0);
    if((vx||vz)&&dt>0){ var sp=RL.planExt*RL.planH*0.6*dt; RL.planC.x+=vx*sp; RL.planC.z+=vz*sp; }
    rlPlanDraw(); })();

  // ---- the two views: from above (arrange) and through your eyes (check it, walk around) ----
  // From above, anything over head height is hidden like an architect's plan cut, so a canopy can't hide the ground.
  var _rlRay=new THREE.Raycaster(), _rlV=new THREE.Vector3(), _rlPl=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  function rlView(v){ if(v==="plan"){ if(looking) document.exitPointerLock(); var f=new THREE.Vector3(); camera.getWorldDirection(f);
      RL.eye={x:camPos.x,z:camPos.z,fx:f.x,fz:f.z}; if(!RL.target) RL.target=rlTarget();
      var T=RL.target; RL.planC={x:(T.x*2+camPos.x)/3, z:(T.z*2+camPos.z)/3}; RL.planExt=Math.max(6*RL.S, Math.hypot(T.x-camPos.x,T.z-camPos.z)*2.6); RL.planH=1;
      RL.gRef=rlGround(T.x,T.z); RL.cutY=RL.gRef+2.4*RL.S; }
    RL.view=v; RL.plan=v==="plan"; rlPlanUI(); rlApply(); }
  function rlPlanCam(){ if(!RL.plan) return; var fov=camera.fov*Math.PI/180, h=RL.planExt*RL.planH/(2*Math.tan(fov/2)*Math.min(1,camera.aspect));
    camera.up.set(0,0,-1); camera.position.set(RL.planC.x, RL.gRef+h, RL.planC.z); camera.lookAt(RL.planC.x, RL.gRef, RL.planC.z); camera.updateMatrixWorld(); }
  function rlScr(x,y,z){ _rlV.set(x,y,z).project(camera); return {x:(_rlV.x*0.5+0.5)*innerWidth, y:(-_rlV.y*0.5+0.5)*innerHeight}; }
  function rlOnPlane(e,y){ _rlRay.setFromCamera({x:e.clientX/innerWidth*2-1, y:-(e.clientY/innerHeight)*2+1}, camera); _rlPl.constant=-y; var o=new THREE.Vector3(); return _rlRay.ray.intersectPlane(_rlPl,o)?o:null; }
  function rlHandle(L){ var R=0.09*RL.planExt*RL.planH, hx=L.dir[0], hz=L.dir[2], hl=Math.hypot(hx,hz)||1; return {x:L.x+hx/hl*R, z:L.z+hz/hl*R}; }
  function rlPlanUI(){ var u=$("rlPlanUI"); if(!u){ u=document.createElement("div"); u.id="rlPlanUI"; document.body.appendChild(u);
      u.addEventListener("pointerdown",rlPlanDown); u.addEventListener("wheel",function(e){ e.preventDefault(); e.stopPropagation(); RL.planH=Math.max(0.25,Math.min(5,RL.planH*(e.deltaY>0?1.12:0.89))); },{passive:false}); }
    u.classList.toggle("show",!!(RL.ui&&RL.plan)); if(!(RL.ui&&RL.plan)) return;
    u.innerHTML='<svg></svg><div class="rlp-t"><i></i><span>SUBJECT</span></div><div class="rlp-you"><i></i><span>YOU</span></div>'+RL.lights.map(function(L,i){ return '<div class="rlp-l'+(i===RL.sel?' on':'')+(L.on?'':' off')+'" data-i="'+i+'"><i style="background:'+rlHex(rlLightRGB(L))+'"></i><span>'+(i+1)+' · '+L.name+'</span></div>'+(L.type==="spot"?'<div class="rlp-h" data-i="'+i+'"></div>':''); }).join("")
      +'<p class="rlp-tip">'+(RL.lights.length?'<b>Drag a light</b> to move it'+(RL.lights.some(function(L){ return L.type==="spot"; })?' · <b>drag its gold dot</b> to aim':'')+' · ':'Add a light from the panel · ')+'<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or drag the ground to move around · scroll to zoom</p>'; }
  function rlPlanDraw(){ var u=$("rlPlanUI"); if(!u||!RL.plan) return; var svg='';
    RL.lights.forEach(function(L,i){ var p=rlScr(L.x,L.y,L.z), el=u.querySelector('.rlp-l[data-i="'+i+'"]'); if(el) el.style.transform='translate('+p.x.toFixed(1)+'px,'+p.y.toFixed(1)+'px)';
      if(L.type==="spot"){ var H=rlHandle(L), q=rlScr(H.x,L.y,H.z), hd=u.querySelector('.rlp-h[data-i="'+i+'"]'); if(hd) hd.style.transform='translate('+q.x.toFixed(1)+'px,'+q.y.toFixed(1)+'px)';
        var a=Math.atan2(q.y-p.y,q.x-p.x), w=L.cone*Math.PI/360, len=Math.hypot(q.x-p.x,q.y-p.y)*2.2;
        svg+='<path d="M'+p.x+' '+p.y+' L'+(p.x+Math.cos(a-w)*len)+' '+(p.y+Math.sin(a-w)*len)+' L'+(p.x+Math.cos(a+w)*len)+' '+(p.y+Math.sin(a+w)*len)+' Z" class="beam'+(L.on?'':' off')+'"/><line x1="'+p.x+'" y1="'+p.y+'" x2="'+q.x+'" y2="'+q.y+'"/>'; }
      else { var rr=Math.abs(rlScr(L.x+0.06*RL.planExt*RL.planH,L.y,L.z).x-p.x); svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="'+rr+'" class="beam'+(L.on?'':' off')+'"/>'; } });
    var E=RL.eye, R=0.08*RL.planExt*RL.planH, y=rlScr(E.x,RL.gRef,E.z), yf=rlScr(E.x+E.fx*R,RL.gRef,E.z+E.fz*R), you=u.querySelector(".rlp-you"), T=RL.target, tt=rlScr(T.x,T.y,T.z), te=u.querySelector(".rlp-t");
    if(you) you.style.transform='translate('+y.x.toFixed(1)+'px,'+y.y.toFixed(1)+'px) rotate('+(Math.atan2(yf.y-y.y,yf.x-y.x)*180/Math.PI+90).toFixed(1)+'deg)';
    if(te) te.style.transform='translate('+tt.x.toFixed(1)+'px,'+tt.y.toFixed(1)+'px)';
    svg+='<line class="view" x1="'+y.x+'" y1="'+y.y+'" x2="'+tt.x+'" y2="'+tt.y+'"/>';
    var sv=u.querySelector("svg"); if(sv) sv.innerHTML=svg; }
  // what's under the pointer: the nearest light or aim dot within a generous reach, otherwise the ground (pan)
  var rlDrag=null, rlDragT=0;
  function rlPlanDown(e){ e.preventDefault(); var best=null, bd=38;
    RL.lights.forEach(function(L,i){ var p=rlScr(L.x,L.y,L.z), d=Math.hypot(p.x-e.clientX,p.y-e.clientY); if(d<bd){ bd=d; best={i:i,aim:false}; }
      if(L.type==="spot"){ var H=rlHandle(L), q=rlScr(H.x,L.y,H.z), d2=Math.hypot(q.x-e.clientX,q.y-e.clientY); if(d2<Math.min(bd,26)){ bd=d2; best={i:i,aim:true}; } } });
    if(best){ RL.sel=best.i; var L=RL.lights[best.i], p0=rlOnPlane(e,L.y); rlDrag={L:L, aim:best.aim, ox:p0?L.x-p0.x:0, oz:p0?L.z-p0.z:0}; rlPlanUI(); rlPanel(); }
    else { var g=rlOnPlane(e,RL.gRef); rlDrag={pan:true, sx:e.clientX, sy:e.clientY, c:{x:RL.planC.x,z:RL.planC.z}, g:g}; }
    window.addEventListener("pointermove",rlPlanMove); window.addEventListener("pointerup",rlPlanUp,{once:true}); }
  function rlPlanMove(e){ if(!rlDrag) return;
    if(rlDrag.pan){ var k=RL.planExt*RL.planH/Math.min(innerWidth,innerHeight)*1.15; RL.planC.x=rlDrag.c.x-(e.clientX-rlDrag.sx)*k; RL.planC.z=rlDrag.c.z-(e.clientY-rlDrag.sy)*k; return; }
    var L=rlDrag.L;
    if(rlDrag.aim){ var g=rlOnPlane(e,RL.target.y); if(g) rlAimAt(L,{x:g.x,y:RL.target.y,z:g.z}); }
    else { var p=rlOnPlane(e,L.y); if(p) rlSetPos(L,p.x+rlDrag.ox,p.z+rlDrag.oz); }
    rlDrag.moved=true; var now=performance.now(); if(RL.N<1200000&&now-rlDragT>250){ rlDragT=now; rlApply(); } }   // big scans relight when you let go
  function rlPlanUp(){ window.removeEventListener("pointermove",rlPlanMove); var d=rlDrag; rlDrag=null; if(d&&!d.pan){ if(d.moved) RL.moved=(RL.moved||0)+1; rlApply(); } }

  // ---- open and close: Lighting is one place. Done keeps your lights; "Natural light" takes them all away ----
  function rlOpen(){ if(!loaded) return; RL.ui=true; RL.on=true; rlPanel();
    if(typeof coStart==="function"&&!CO.on){ var seen="1"; try{ seen=localStorage.getItem("studium_lighttour"); localStorage.setItem("studium_lighttour","1"); }catch(e){} if(seen!=="1"){ GD.flags.col=0; coStart("lighting"); } }
    var go=function(){ RL.target=null; rlView("plan"); }; if(!RL.ready){ if(!RL.busy) rlPrepare(go); } else go(); }
  function rlClose(){ if(!RL.ui) return; RL.ui=false; if(RL.plan){ RL.plan=false; RL.view="eye"; rlApply(); } rlPlanUI(); rlPanel(); rlVis(); }
  function rlToggle(){ if(RL.ui) rlClose(); else rlOpen(); }
  function rlNatural(){ RL.lights.forEach(rlDrop); RL.lights=[]; RL.sel=-1; RL.dusk=1; RL.ambK=6500; RL.exp=0; rlRestore(); RL.on=false; rlClose(); }
  function rlStatus(t){ RL.status=t; rlPanel(); }

  // ---- the panel ----
  function rlShow(k,v){ return k==="k"?Math.round(v/100)*100+"K" : k==="exp"?(v>0?"+":"")+v.toFixed(1) : k==="cone"?Math.round(v)+"°" : k==="h"?v.toFixed(1)+" m" : v.toFixed(1); }
  var RL_SL={ k:[1800,10000,function(v){ return v; },function(x){ return x; }], exp:[-30,30,function(v){ return v/10; },function(x){ return Math.round(x*10); }],
    power:[0,400,function(v){ return v/10; },function(x){ return Math.round(x*10); }], h:[0,250,function(v){ return v/100; },function(x){ return Math.round(x*100); }], cone:[10,120,function(v){ return v; },function(x){ return x; }] };
  function rlSl(scope,k,label,obj){ var d=RL_SL[k]; return '<label><span>'+label+'</span><input type="range" data-rl-s="'+scope+'" data-rl-k="'+k+'" min="'+d[0]+'" max="'+d[1]+'" value="'+d[3](obj[k])+'"><em>'+rlShow(k,obj[k])+'</em></label>'; }
  function rlPanel(){ var p=$("rlPanel"); if(!p){ p=document.createElement("div"); p.id="rlPanel"; document.body.appendChild(p); p.addEventListener("input",rlInput); p.addEventListener("click",rlClick); p.addEventListener("keydown",function(e){ e.stopPropagation(); }); }
    p.classList.toggle("show", !!RL.ui); if(!RL.ui) return; var ae=document.activeElement; if(p.contains(ae)&&ae.type==="range") return;   // don't rebuild under a dragging slider
    var L=rlCur(), h='<div class="rl-h"><div><span class="rl-eb">LIGHTING</span><b>Light the scene</b></div><button class="rl-done" data-rl="done" title="Keep these lights (Esc)">DONE</button></div>'+(RL.status?'<p class="rl-s">'+RL.status+'</p>':'');
    h+='<div class="rl-seg"><button data-rl-view="plan" class="'+(RL.view==="plan"?'on':'')+'">FROM ABOVE</button><button data-rl-view="eye" class="'+(RL.view==="eye"?'on':'')+'">THROUGH MY EYES</button></div>';
    h+='<div class="rl-sec">TIME OF DAY</div><div class="rl-times">'+Object.keys(RL_TIMES).map(function(t){ var T=RL_TIMES[t]; return '<button data-rl-time="'+t+'" class="t-'+t+(Math.abs(RL.dusk-T.dusk)<0.01&&RL.ambK===T.ambK?' on':'')+'"><i></i>'+T.n+'</button>'; }).join("")+'</div>';
    h+='<div class="rl-sec">ADD A LIGHT</div><div class="rl-fx">'+Object.keys(RL_FX).map(function(f){ return '<button data-rl-fx="'+f+'"><b>'+RL_FX[f].n+'</b><span>'+RL_FX[f].d+'</span></button>'; }).join("")+'</div>';
    if(RL.lights.length) h+='<div class="rl-sec">YOUR LIGHTS</div><div class="rl-list">'+RL.lights.map(function(l,i){ return '<button data-rl-pick="'+i+'" class="'+(i===RL.sel?'on':'')+(l.on?'':' off')+'"><i style="background:'+rlHex(rlLightRGB(l))+'"></i>'+(i+1)+' · '+l.name+'</button>'; }).join("")+'</div>';
    if(L){ h+='<div class="rl-card"><div class="rl-ch"><i style="background:'+rlHex(rlLightRGB(L))+'"></i><b>'+(RL.sel+1)+' · '+L.name+'</b><button data-rl="onoff">'+(L.on?'ON':'OFF')+'</button><button data-rl="del" title="Delete this light">✕</button></div>'
        +rlSl("l","power","POWER",L)+rlSl("l","k","COLOUR",L)+rlSl("l","h","HEIGHT",L)+(L.type==="spot"?rlSl("l","cone","BEAM",L):'')
        +'<div class="rl-gels"><span>GEL</span>'+RL_GELS.map(function(g){ return '<button data-rl-gel="'+g[0]+'" title="'+g[1]+'" class="'+(L.gel===g[0]?'on':'')+'" style="--g:'+g[0]+'"></button>'; }).join("")+'</div></div>'; }
    h+='<div class="rl-foot">'+rlSl("g","exp","EXPOSURE",RL)+'<div class="rl-row"><button data-rl="shadows" class="'+(RL.shadows?'on':'')+'">SHADOWS '+(RL.shadows?'ON':'OFF')+'</button><button data-rl="natural">NATURAL LIGHT</button></div></div>';
    p.innerHTML=h; }
  var rlT=0;
  function rlInput(e){ var k=e.target.getAttribute("data-rl-k"); if(!k) return; var obj=e.target.getAttribute("data-rl-s")==="l"?rlCur():RL; if(!obj) return;
    var v=RL_SL[k][2](+e.target.value); obj[k]=v; var em=e.target.parentNode.querySelector("em"); if(em) em.textContent=rlShow(k,v); if(k==="h") rlSetPos(obj,obj.x,obj.z);
    clearTimeout(rlT); rlT=setTimeout(rlApply, RL.N>1500000?200:90); }
  function rlClick(e){ var b=e.target.closest("[data-rl],[data-rl-pick],[data-rl-fx],[data-rl-time],[data-rl-view],[data-rl-gel]"); if(!b) return; e.stopPropagation(); var L=rlCur();
    if(!RL.ready&&!b.hasAttribute("data-rl")) return;
    if(b.hasAttribute("data-rl-fx")) return rlAdd(b.getAttribute("data-rl-fx"));
    if(b.hasAttribute("data-rl-time")){ var T=RL_TIMES[b.getAttribute("data-rl-time")]; RL.dusk=T.dusk; RL.ambK=T.ambK; return rlApply(); }
    if(b.hasAttribute("data-rl-view")) return rlView(b.getAttribute("data-rl-view"));
    if(b.hasAttribute("data-rl-pick")){ RL.sel=+b.getAttribute("data-rl-pick"); rlMarkers(); rlPlanUI(); return rlPanel(); }
    if(b.hasAttribute("data-rl-gel")){ if(L){ L.gel=b.getAttribute("data-rl-gel"); rlPlanUI(); rlApply(); } return; }
    var a=b.getAttribute("data-rl");
    if(a==="done") rlClose(); else if(a==="natural") rlNatural(); else if(a==="shadows"){ RL.shadows=!RL.shadows; rlApply(); }
    else if(!L) return; else if(a==="onoff"){ L.on=!L.on; rlPlanUI(); rlApply(); }
    else if(a==="del"){ rlDrop(L); RL.lights.splice(RL.sel,1); RL.sel=Math.min(RL.sel,RL.lights.length-1); rlPlanUI(); rlApply(); } }
  // a new scan: everything starts over
  function rlForget(){ RL.ui=false; RL.plan=false; rlPlanUI(); RL.grid=null; RL.target=null; RL.lights.forEach(rlDrop); RL.lights=[]; RL.sel=-1; RL.on=false; RL.ready=false; RL.orig=null; rlPanel(); }
  window.addEventListener("keydown",function(e){ if(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if(RL.ui&&e.code==="Escape"){ e.preventDefault(); e.stopImmediatePropagation(); rlClose(); return; }
    if(e.code==="KeyL"&&loaded&&(App.is("scene")||App.is("viewfinder"))){ e.preventDefault(); rlToggle(); } },true);
  if(/[?&]dev/.test(location.search)) window.__rl={ toggle:rlToggle, open:rlOpen, close:rlClose, add:rlAdd, view:rlView, pick:rlPick, scr:function(i){ var L=RL.lights[i]; return L?rlScr(L.x,L.y,L.z):null; },
    set:function(o){ for(var k in o) RL[k]=o[k]; rlApply(); }, light:function(o){ var L=rlCur(); if(L){ for(var k in o) L[k]=o[k]; rlApply(); } },
    state:function(){ var L=RL.lights[0]; return {on:RL.on, ui:!!RL.ui, view:RL.view, ready:RL.ready, N:RL.N, n:RL.lights.length, sel:RL.sel, light:L?{x:L.x,y:L.y,z:L.z}:null, ms:RL.ms, placed:RL.placed||0, moved:RL.moved||0, S:RL.S, planC:RL.planC?{x:RL.planC.x,z:RL.planC.z}:null}; } };
