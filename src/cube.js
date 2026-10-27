  // ================= THE CUBE: press T, the world falls away to a glass cube in the dark; each side is a window =================
  // Each face of the cube looks into a place, with true parallax, like a diorama behind glass: turning the cube turns your
  // view through every window. Drag to turn it, click a side (or Enter for the one facing you) and you dive through it,
  // arriving at that place standing, looking at what matters there. T or Escape puts it away.
  // Faces are good spots in this scan for now (round the subject, looking at it); with more scans each face is a scan.
  // Each visible face is drawn by its own Spark renderer (three at most can face you), so none re-sorts another's view.
  var CU={open:false, phase:"", t0:0, k:0, grp:null, scene:null, cam:null, faces:[], sparks:[], rts:[], q:new THREE.Quaternion(), spin:new THREE.Vector2(0,0), yaw:0.62, pitch:-0.42,
    drag:null, hover:-1, dive:null, dist:4.2, stars:null, ui:null, ret:null};
  var CU_H=0.8, CU_K=2.2;   // half the cube's size (overlay units), and how many metres of world one unit is through the glass

  // ---- good spots: near the middle, a few metres from the subject, with a clear view of it ----
  function cuSpots(n){ var s=ptScale(), sj=CH.spec&&CH.spec.subject, cx=sj?sj[0]:camPos.x, cz=sj?sj[1]:camPos.z, gy=WK.col?wkGround(cx,cz):camPos.y-1.6*s, out=[];
    var clear=function(x,z){ if(!WK.col) return true; var g=wkGround(x,z); if(wkBlocked(x,z,g)||wkBlocked(x+0.45*s,z,g)||wkBlocked(x-0.45*s,z,g)||wkBlocked(x,z+0.45*s,g)||wkBlocked(x,z-0.45*s,g)) return false;
      for(var i=2;i<9;i++){ var u=i/10, px=x+(cx-x)*u, pz=z+(cz-z)*u, top=wkTop(px,pz); if(top&&top>wkGround(px,pz)+1.1*s) return false; } return true; };   // nothing taller than your chest in the way
    var cand=[]; for(var a=0;a<36;a++) for(var r=0;r<3;r++){ var an=a/36*Math.PI*2, d=(2.6+r*0.6)*s, x=cx+Math.sin(an)*d, z=cz+Math.cos(an)*d; if(clear(x,z)){ cand.push({x:x,z:z,an:an,d:d}); break; } }
    if(!cand.length){ for(var b=0;b<n;b++){ var an2=b/n*Math.PI*2; cand.push({x:cx+Math.sin(an2)*3*s, z:cz+Math.cos(an2)*3*s, an:an2, d:3*s}); } }
    // spread them round the subject
    var step=cand.length/n; for(var k=0;k<n;k++){ var c=cand[Math.floor(k*step)%cand.length]; out.push(c); }
    return out.map(function(c,i){ var eye=(WK.col?wkGround(c.x,c.z)+WK.eye*s:camPos.y), o=new THREE.Object3D(); o.position.set(c.x,eye,c.z);
      var M=new THREE.Matrix4().lookAt(o.position, new THREE.Vector3(cx,gy+0.7*s,cz), UPY); o.quaternion.setFromRotationMatrix(M); o.updateMatrixWorld(true);
      var deg=(c.an*180/Math.PI+360)%360, side=["north","north-east","east","south-east","south","south-west","west","north-west"][Math.round(deg/45)%8];
      return {o:o, name:((CH.spec&&CH.spec.name)||"The scan")+" · from the "+side}; }); }

  /* the faces: good spots round each world that's loaded (the one you're in first), six in all */
  /* the gold frames' eye points as viewpoints: each is a real photographer's position (low and close, back with the long lens, over the top), named for its shot */
  function cuFrameSpots(n){ var pads=(typeof CH!=="undefined"&&CH.pads)||[], out=[];
    pads.slice(0,n).forEach(function(P){ var o=new THREE.Object3D(); o.position.copy(P.E); var M=new THREE.Matrix4().lookAt(o.position, P.T, UPY); o.quaternion.setFromRotationMatrix(M); o.updateMatrixWorld(true);
      out.push({o:o, name:((CH.spec&&CH.spec.name)||"The scan")+" · "+(P.c.title||"a frame"), frame:P.c.id, mm:P.c.mm||50, hfov:2*Math.atan(18/Math.max(P.c.mm||50,8))*180/Math.PI}); });   /* each face sees through that shot's lens, so a wide and a tele read differently */
    return out; }
  function cuAllSpots(){ var W=(typeof WX!=="undefined"?WX.worlds:[]).filter(function(w){ return w.ready; }), others=W.filter(function(w){ return w!==WX.home; });
    if(!others.length){ var fs=cuFrameSpots(6); if(!fs.length) return cuSpots(6); var fill=cuSpots(6), seen={}, mix=fs.slice(), j=0;   /* this scan's viewpoints: the frames first, then good spots round the subject */
      fs.forEach(function(f){ seen[Math.round(f.o.position.x*2)+","+Math.round(f.o.position.z*2)]=1; });
      while(mix.length<6&&j<fill.length){ var c=fill[j++], k=Math.round(c.o.position.x*2)+","+Math.round(c.o.position.z*2); if(!seen[k]){ seen[k]=1; mix.push(c); } }
      return mix; }
    var home=cuSpots(3), rest=[]; others.forEach(function(w){ rest=rest.concat(wxSpots(w, Math.ceil(3/others.length))); });
    var out=[]; for(var i=0;i<6;i++){ var a=i%2?rest:home, k=i>>1; out.push(a[k%a.length]||home[k%home.length]); } return out; }

  // the caption on a face: what the shot is, and its lens, small along the bottom edge
  function cuLabelTex(sp){ var c=document.createElement("canvas"); c.width=512; c.height=512; var g=c.getContext("2d"); g.clearRect(0,0,512,512); if(!sp) return new THREE.CanvasTexture(c);
    var name=(sp.name||"").split(" · ")[1]||sp.name||"", lens=sp.mm?sp.mm+" MM":"";
    var grd=g.createLinearGradient(0,330,0,512); grd.addColorStop(0,"rgba(8,7,5,0)"); grd.addColorStop(1,"rgba(8,7,5,0.82)"); g.fillStyle=grd; g.fillRect(0,330,512,182);
    g.textBaseline="alphabetic"; g.fillStyle="#e3ad57"; g.font="500 17px 'Geist Mono', ui-monospace, monospace"; g.fillText((sp.frame?"GOLD FRAME":"VIEWPOINT")+(lens?"  ·  "+lens:""),34,432);
    g.fillStyle="#f4f1ea"; g.font="300 40px 'Fraunces', Georgia, serif"; var w=g.measureText(name).width; if(w>444){ g.font="300 "+Math.floor(40*444/w)+"px 'Fraunces', Georgia, serif"; } g.fillText(name,34,478);
    var t=new THREE.CanvasTexture(c); t.flipY=true; t.minFilter=THREE.LinearFilter; return t; }
  // ---- the cube itself ----
  function cuFaceMat(){ return new THREE.ShaderMaterial({ toneMapped:false, side:THREE.FrontSide,
    uniforms:{ tView:{value:null}, tLabel:{value:null}, lab:{value:0}, res:{value:new THREE.Vector2(1,1)}, live:{value:0}, hi:{value:0}, time:{value:0} },
    vertexShader:"varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }",
    fragmentShader:"uniform sampler2D tView; uniform sampler2D tLabel; uniform float lab; uniform vec2 res; uniform float live; uniform float hi; uniform float time; varying vec2 vUv; varying vec3 vN; varying vec3 vV;"
      +" void main(){ vec3 c=texture2D(tView,gl_FragCoord.xy/res).rgb; c=mix(vec3(0.06,0.06,0.08),c,live);"
      +" vec4 lb=texture2D(tLabel,vUv); c=mix(c,lb.rgb,lb.a*lab);"   // the shot's name, etched along the bottom of the glass
      +" float fr=pow(1.0-max(dot(vN,vV),0.0),3.0); c+=vec3(0.75,0.8,1.0)*fr*0.35;"   // a sheen of glass
      +" vec2 e=min(vUv,1.0-vUv); float edge=min(e.x,e.y); c+=vec3(1.0,0.95,0.85)*smoothstep(0.035,0.0,edge)*0.6; c+=vec3(1.0,0.9,0.7)*hi*0.10;"
      +" gl_FragColor=vec4(c,1.0); }" }); }
  function cuBuild(){ var g=new THREE.Group(), faces=[];
    var dirs=[[0,0,1,0,0],[0,0,-1,0,Math.PI],[1,0,0,0,Math.PI/2],[-1,0,0,0,-Math.PI/2],[0,1,0,-Math.PI/2,0],[0,-1,0,Math.PI/2,0]];
    dirs.forEach(function(d,i){ var m=new THREE.Mesh(new THREE.PlaneGeometry(CU_H*2,CU_H*2), cuFaceMat()); m.position.set(d[0]*CU_H,d[1]*CU_H,d[2]*CU_H); m.rotation.set(d[3],d[4],0,"YXZ"); m.userData.i=i;
      m.onBeforeRender=function(r){ var t=r.getRenderTarget(), w=t?t.width:r.domElement.width, h=t?t.height:r.domElement.height; m.material.uniforms.res.value.set(w,h); }; g.add(m); faces.push(m); });
    // the luminous edges
    var eg=new THREE.EdgesGeometry(new THREE.BoxGeometry(CU_H*2,CU_H*2,CU_H*2)), lines=new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color:0xfff2dc, transparent:true, opacity:0.95, toneMapped:false})); g.add(lines);
    var glow=new THREE.Mesh(new THREE.BoxGeometry(CU_H*2.04,CU_H*2.04,CU_H*2.04), new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.BackSide, toneMapped:false,
      vertexShader:"varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader:"varying vec3 p; uniform float H; void main(){ vec3 a=abs(p)/"+(CU_H*1.02).toFixed(3)+"; float e1=max(a.x,max(a.y,a.z)); vec3 b=a; float m2=0.0; if(b.x<b.y){ float t=b.x; b.x=b.y; b.y=t; } if(b.y<b.z){ float t=b.y; b.y=b.z; b.z=t; } if(b.x<b.y){ float t=b.x; b.x=b.y; b.y=t; }"
        +" float edge=b.y; float g=smoothstep(0.86,1.0,edge)*0.22; gl_FragColor=vec4(vec3(1.0,0.86,0.66)*g,1.0); }" }));
    g.add(glow); return {grp:g, faces:faces}; }
  function cuStars(){ var N=1400, p=new Float32Array(N*3), s=new Float32Array(N); for(var i=0;i<N;i++){ var v=new THREE.Vector3(Math.random()-0.5,Math.random()-0.5,Math.random()-0.5).normalize().multiplyScalar(30+Math.random()*30); p[i*3]=v.x; p[i*3+1]=v.y; p[i*3+2]=v.z; s[i]=Math.random(); }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(p,3)); g.setAttribute("seed",new THREE.BufferAttribute(s,1));
    return new THREE.Points(g,new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false, uniforms:{ time:{value:0}, fade:{value:0} },
      vertexShader:"attribute float seed; uniform float time; uniform float fade; varying float vA; void main(){ vA=fade*(0.25+0.75*seed)*(0.7+0.3*sin(time*1.5+seed*40.0)); vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=1.0+seed*1.6; gl_Position=projectionMatrix*mv; }",
      fragmentShader:"varying float vA; void main(){ float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(vec3(0.85,0.88,1.0)*smoothstep(0.5,0.0,d)*vA,1.0); }" })); }

  // ---- the backdrop: the world as you left it, dimmed and softly blurred ----
  function cuBgInit(){ CU.bgScene=new THREE.Scene(); CU.bgCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    CU.bgMat=new THREE.ShaderMaterial({ depthTest:false, depthWrite:false, toneMapped:false, uniforms:{ t:{value:null}, k:{value:0}, px:{value:new THREE.Vector2(1,1)} },
      vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }",
      fragmentShader:"uniform sampler2D t; uniform float k; uniform vec2 px; varying vec2 vUv;"
        +" void main(){ vec3 c=vec3(0.0); float w=0.0; float r=k*7.0;"
        +" for(int i=0;i<24;i++){ float a=float(i)*2.39996, rr=sqrt(float(i)/24.0)*r; vec2 o=vec2(cos(a),sin(a))*rr*px; float ww=1.0-float(i)/30.0; c+=texture2D(t,vUv+o).rgb*ww; w+=ww; }"
        +" c/=w; vec2 q=vUv-0.5; float vig=1.0-dot(q,q)*0.9*k; c*=mix(1.0,0.58,k)*vig; gl_FragColor=vec4(c,1.0); }" });
    CU.bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), CU.bgMat)); }
  function cuCapture(){ var W=renderer.domElement.width, H=renderer.domElement.height;
    if(!CU.bg) CU.bg=new THREE.WebGLRenderTarget(W,H,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter}); else if(CU.bg.width!==W||CU.bg.height!==H) CU.bg.setSize(W,H);
    renderBackdrop(CU.bg); CU.bgMat.uniforms.t.value=CU.bg.texture; CU.bgMat.uniforms.px.value.set(1/W,1/H); }

  // ---- open and close ----
  function cuToggle(){ if(!loaded) return; if(CU.open){ if(!CU.dive) cuClose(); return; } cuOpen(); }
  function cuOpen(){ if(CU.open) return; if(typeof PT!=="undefined"&&PT.on) ptDispose(); if(viewfinderOn) lowerCamera(); if(looking){ try{ document.exitPointerLock(); }catch(e){} }
    if(!CU.scene){ CU.scene=new THREE.Scene(); CU.cam=new THREE.PerspectiveCamera(38,1,0.01,200); var b=cuBuild(); CU.grp=b.grp; CU.faces=b.faces; CU.scene.add(CU.grp); cuBgInit(); }
    cuCapture();
    CU.spots=cuAllSpots(); CU.faces.forEach(function(f,i){ f.userData.spot=CU.spots[i]; var u=f.material.uniforms; if(u.tLabel){ if(u.tLabel.value) u.tLabel.value.dispose(); u.tLabel.value=cuLabelTex(CU.spots[i]); u.lab.value=1; } });
    CU.yaw=0.62; CU.pitch=-0.42; CU.q.setFromEuler(new THREE.Euler(CU.pitch,CU.yaw,0,"XYZ")); CU.spin.set(0.0,0.35); CU.dist=4.2; CU.open=true; CU.phase="opening"; CU.t0=performance.now(); CU.k=0; CU.dive=null; CU.hover=-1;
    cuUI(true); document.body.classList.add("cube-open"); ptSoundSafe(true); App.note&&App.note("cube"); }
  /* if anything goes wrong, put everything back: no cube, all the controls showing */
  function cuReset(){ CU.open=false; CU.phase=""; CU.dive=null; if(CU.grp) CU.grp.position.set(0,0,0); cuUI(false); document.body.classList.remove("cube-open"); }
  function cuClose(){ if(!CU.open) return; CU.phase="closing"; CU.t0=performance.now(); cuUI(false); ptSoundSafe(false); }
  function ptSoundSafe(up){ sfx(up?"views":"back"); }

  // ---- drawing: the cube in the dark, each face showing its place ----
  function cuRender(){ var now=performance.now(), t=(now-CU.t0)/1000;
    if(CU.phase==="opening"){ CU.k=Math.min(1,t/0.9); if(CU.k>=1) CU.phase="open"; }
    else if(CU.phase==="closing"){ CU.k=Math.max(0,1-t/0.6); if(CU.k<=0){ CU.open=false; CU.phase=""; document.body.classList.remove("cube-open"); return false; } }
    var e=1-Math.pow(1-CU.k,3), W=renderer.domElement.width, H=renderer.domElement.height;
    // spin: drag sets it, it eases off; a slow idle drift when untouched
    if(!CU.drag&&!CU.dive){ CU.spin.multiplyScalar(0.94); if(CU.spin.length()<0.0015) CU.spin.set(0,0.0015); }
    // a turntable, not a free spin: drag sideways to turn it, up and down to tilt it (within limits), and it never rolls, so nothing reads upside down
    CU.yaw+=CU.spin.y; CU.pitch=Math.max(-1.25,Math.min(1.25,CU.pitch+CU.spin.x));
    if(CU.dive){ var dd=CU.dive, du0=Math.min(1,(now-dd.t0)/dd.dur), dk=Math.min(1,0.08+du0*0.35), dy=((dd.yaw-CU.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI; CU.yaw+=dy*dk; CU.pitch+=(dd.pitch-CU.pitch)*dk; }
    CU.q.setFromEuler(new THREE.Euler(CU.pitch,CU.yaw,0,"XYZ")); CU.grp.quaternion.copy(CU.q); CU.grp.scale.setScalar(Math.max(0.001,e*(1+0.05*Math.sin(e*Math.PI))));
    CU.grp.rotation.y+=0; CU.cam.aspect=W/H; CU.cam.position.set(0,0,CU.dist); CU.cam.lookAt(0,0,0);
    // the dive: fly straight at the chosen face's middle
    if(CU.dive){ var d=CU.dive, u=Math.min(1,(now-d.t0)/d.dur), s0=u*u*(3-2*u), fall=u*u;
      CU.spin.set(0,0);
      // the chosen side swells to fill the view, then you're there
      CU.grp.position.set(d.to.x*s0, d.to.y*fall+0.25*Math.sin(u*Math.PI)*(1-u), 0); CU.grp.scale.setScalar(1+(d.scale-1)*s0); CU.k=1-s0; CU.bgMat.uniforms.k.value=1-s0;
      if(u>=1){ cuArrive(); return false; } }
    else CU.grp.position.set(0,0,0);
    CU.cam.updateProjectionMatrix(); CU.cam.updateMatrixWorld(true); CU.grp.updateMatrixWorld(true);
    CU.bgMat.uniforms.k.value=e;
    // which faces look at you: those get a pass, at most three
    var vis=[]; CU.faces.forEach(function(f){ var n=new THREE.Vector3(0,0,1).applyQuaternion(f.getWorldQuaternion(new THREE.Quaternion())), p=f.getWorldPosition(new THREE.Vector3()), v=CU.cam.position.clone().sub(p);
      f.material.uniforms.live.value=0; f.material.uniforms.hi.value=f.userData.i===CU.hover?1:0; if(n.dot(v)>0) vis.push({f:f, d:n.dot(v.normalize())}); });
    vis.sort(function(a,b){ return b.d-a.d; }); vis=vis.slice(0,3);
    var s=ptScale(), scale=CU.dive?0.75:0.5;
    vis.forEach(function(v,k){ var f=v.f, sp=f.userData.spot; if(!sp) return; var rt=CU.rts[k], w=Math.max(2,Math.round(W*scale)), h=Math.max(2,Math.round(H*scale));
      if(!rt) rt=CU.rts[k]=new THREE.WebGLRenderTarget(w,h,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true}); else if(rt.width!==w||rt.height!==h) rt.setSize(w,h);
      var B=CU.sparks[k]||(CU.sparks[k]=new SPARK.SparkRenderer({renderer:renderer})); B.lodSplatScale=viewer.spark.lodSplatScale; B.maxStdDev=viewer.spark.maxStdDev; B.apertureAngle=0;
      var c2=f.userData.cam||(f.userData.cam=new THREE.PerspectiveCamera()); var L=new THREE.Matrix4().copy(f.matrixWorld).invert().multiply(CU.cam.matrixWorld), lp=new THREE.Vector3(), lq=new THREE.Quaternion(), ls=new THREE.Vector3(); L.decompose(lp,lq,ls);
      // through the glass: your place in front of this face, scaled up, set down at its spot
      c2.position.copy(lp.multiplyScalar(CU_K*s)).applyQuaternion(sp.o.quaternion).add(sp.o.position); c2.quaternion.copy(sp.o.quaternion).multiply(lq);
      c2.fov=sp.hfov?2*Math.atan(Math.tan(sp.hfov*Math.PI/360)/CU.cam.aspect)*180/Math.PI:CU.cam.fov; c2.aspect=CU.cam.aspect; c2.far=camera.far;
      if(CU.dive&&CU.dive.f===f){ var du=Math.min(1,(now-CU.dive.t0)/CU.dive.dur), ds=du*du*(3-2*du); c2.position.lerp(sp.o.position,ds); c2.quaternion.slerp(sp.o.quaternion,ds); c2.fov+=(camera.fov-c2.fov)*ds; f.material.uniforms.lab.value=1-ds; }   /* by the end it IS where you land, looking how you'll look */
      var dir=new THREE.Vector3(); c2.updateMatrixWorld(true); c2.getWorldDirection(dir);
      c2.near=Math.max(0.02, sp.o.position.clone().sub(c2.position).dot(dir)*0.97); c2.updateProjectionMatrix(); c2.updateMatrixWorld(true);
      renderer.setRenderTarget(rt); renderer.setClearColor(0x0e0f13,1); renderer.clear(true,true,true);
      wxSkyFor(c2.position); try{ B.render(scene,c2); }catch(err){ if(!cuRender.warned){ cuRender.warned=1; console.warn("cube pass",err); } }
      f.material.uniforms.tView.value=rt.texture; f.material.uniforms.live.value=1; });
    renderer.setRenderTarget(null); renderer.setClearColor(0x05060a,1); renderer.clear(true,true,true);
    var ac=renderer.autoClear; renderer.autoClear=false; renderer.render(CU.bgScene,CU.bgCam); renderer.clearDepth(); renderer.render(CU.scene,CU.cam); renderer.autoClear=ac;
    return true; }
  // landing: become the camera that was looking through the glass
  function cuArrive(){ var f=CU.dive.f, c2=f.userData.cam, fwd=new THREE.Vector3(0,0,-1).applyQuaternion(c2.quaternion), sp=f.userData.spot;
    camPos.copy(sp.o.position); yaw=Math.atan2(-fwd.x,-fwd.z); pitch=Math.asin(Math.max(-1,Math.min(1,fwd.y))); _vel.set(0,0,0); if(PT) PT.prev=null;
    CU.open=false; CU.phase=""; CU.dive=null; cuUI(false); document.body.classList.remove("cube-open"); toast(sp.frame?"Standing where "+sp.name.split(" · ")[1].toLowerCase()+" is shot from. Raise the camera.":sp.name.split(" · from the ")[1]?"You're on the "+sp.name.split(" · from the ")[1]+" side":sp.name); }
  /* choosing a side: the cube turns that side to you and you fall into it, arriving where that side was looking from */
  function cuDiveInto(i){ var f=CU.faces[i]; if(!f||CU.dive) return; var n=new THREE.Vector3(0,0,1).applyQuaternion(f.quaternion);   /* the face's normal in the cube's own frame */
    var yaw=Math.abs(n.y)>0.9?CU.yaw:-Math.atan2(n.x,n.z), pitch=n.y>0.9?Math.PI/2:n.y<-0.9?-Math.PI/2:0;   /* the turn and tilt that bring this face square to you */
    CU.dive={f:f, yaw:yaw, pitch:pitch, t0:performance.now(), dur:1000, to:new THREE.Vector2(0,0), scale:Math.max(2.4,CU.dist/CU_H*1.6)}; cuUI(false, true); if(typeof ptSound==="function") ptSound(true, true); }

  // ---- input: drag to turn, click a side to go, wheel to come closer ----
  function cuUI(on, keepHidden){ var el=CU.ui; if(!el){ el=CU.ui=document.createElement("div"); el.id="cubeUI"; el.className="cu-ui";
      el.innerHTML='<div class="cu-name"></div><div class="cu-hint">DRAG TO TURN IT, UP AND DOWN TO TILT · CLICK A SIDE TO GO THERE · <b>T</b> TO PUT IT AWAY</div>'; document.body.appendChild(el);
      el.addEventListener("pointerdown",function(e){ if(CU.dive) return; CU.drag={x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, t:performance.now()}; el.setPointerCapture(e.pointerId); });
      el.addEventListener("pointermove",function(e){ if(CU.drag){ var dx=e.clientX-CU.drag.x, dy=e.clientY-CU.drag.y; CU.drag.x=e.clientX; CU.drag.y=e.clientY; CU.spin.set(dy*0.006, dx*0.006); } else cuHover(e); });
      el.addEventListener("pointerup",function(e){ var d=CU.drag; CU.drag=null; if(d&&Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<5){ var i=cuPick(e); if(i>=0) cuDiveInto(i); } });
      el.addEventListener("wheel",function(e){ e.preventDefault(); CU.dist=Math.max(2.6,Math.min(7,CU.dist+e.deltaY*0.003)); },{passive:false}); }
    el.classList.toggle("show", !!on&&!keepHidden); }
  function cuPick(e){ var r=new THREE.Raycaster(), m=new THREE.Vector2(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight)*2+1); r.setFromCamera(m,CU.cam); var h=r.intersectObjects(CU.faces,false); return h.length?h[0].object.userData.i:-1; }
  function cuHover(e){ var i=cuPick(e); CU.hover=i; var n=CU.ui.querySelector(".cu-name"); n.textContent=i>=0&&CU.faces[i].userData.spot?CU.faces[i].userData.spot.name:""; CU.ui.style.cursor=i>=0?"pointer":"grab"; }
  function cuFront(){ var best=-1, bd=-2; CU.faces.forEach(function(f,i){ var n=new THREE.Vector3(0,0,1).applyQuaternion(f.getWorldQuaternion(new THREE.Quaternion())); if(n.z>bd){ bd=n.z; best=i; } }); return best; }
  window.addEventListener("keydown",function(e){ if(!CU.open) return;
    if(e.code==="Escape"||e.code==="KeyT"){ e.preventDefault(); e.stopImmediatePropagation(); if(!CU.dive) cuClose(); return; }
    if(e.code==="Enter"){ e.preventDefault(); e.stopImmediatePropagation(); cuDiveInto(cuFront()); return; }
    var k={ArrowLeft:[0,-0.06],ArrowRight:[0,0.06],ArrowUp:[-0.06,0],ArrowDown:[0.06,0]}[e.code]; if(k){ e.preventDefault(); e.stopImmediatePropagation(); CU.spin.set(k[0],k[1]); return; }
    if(/^Key[WASDQEP]$|^Space$|^Tab$/.test(e.code)){ e.preventDefault(); e.stopImmediatePropagation(); } },true);

  if(/[?&]dev/.test(location.search)) window.__cu={ state:function(){ return {open:CU.open, phase:CU.phase, dive:!!CU.dive, spots:(CU.spots||[]).map(function(s){ return {name:s.name, p:s.o.position.toArray().map(function(v){ return +v.toFixed(2); })}; }), front:CU.open?cuFront():-1}; },
    toggle:cuToggle, dive:cuDiveInto, front:function(){ return cuFront(); }, spin:function(x,y){ CU.spin.set(x,y); } };
