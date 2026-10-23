  // ================= PORTALS: press T, a hole tears open in front of you onto somewhere else; walk through and it closes =================
  // The opening shows the far place with true parallax: each frame the scene is drawn a second time from where you'd be
  // standing on the far side, and the opening shows that picture at the same screen pixels. Its edge is organic and
  // alive: a swirl of sparks spirals out, the hole grows to a ragged, breathing shape rimmed in iridescent light and
  // shedding glitter, and once you're through it shrinks away behind you. For now the far side is another spot in the
  // same scan; a portal to a different scan uses the same pieces, with the new scan loading behind it.
  // The far-side pass has its own Spark renderer, so neither view re-sorts the other's splats.
  var PT={on:false, o:null, far:null, rt:null, spark:null, cam:null, prev:null, t0:0, open:0, state:"", closeT:0, n:0, cool:0, live:false};
  var PT_R=1.0;   // the opening's radius, metres

  function ptScale(){ return (typeof RL!=="undefined"&&RL.S)||(WK.col?1:sceneScale()); }
  // the ragged, breathing edge, shared by the opening, its glow and its sparks so they all agree
  var PT_EDGE=[
    "float ph(float x){ return fract(sin(x*127.1)*43758.5453); }",
    "float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }",
    "float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+1.0),f.x),f.y); }",
    /* noise sampled round a circle, so the edge has no seam */
    "float cn(float a, float fq, float t){ return n2(vec2(cos(a),sin(a))*fq+vec2(t,-t*0.7)); }",
    "float edgeR(float a, float t, float o){",
    "  float big=0.26*(cn(a,1.3,t*0.25)-0.5)+0.14*(cn(a,2.6,t*0.4+3.0)-0.5);",
    "  float fine=0.07*(cn(a,7.0,t*1.4+7.0)-0.5)+0.04*(cn(a,19.0,t*2.6)-0.5);",
    "  return o*(0.86+big+fine*o);",
    "}",
    /* the reference's palette: white-hot core, pink and violet, with flashes of cyan */
    "vec3 irid(float h){ vec3 p=vec3(1.0,0.45,0.95), v=vec3(0.62,0.42,1.0), c=vec3(0.45,0.95,1.0); float k=fract(h); return k<0.5?mix(p,v,smoothstep(0.0,0.5,k)):mix(v,mix(c,p,smoothstep(0.75,1.0,k)),smoothstep(0.5,0.75,k)); }"].join("\n");
  function ptMat(){ return new THREE.ShaderMaterial({ transparent:false, depthWrite:true, side:THREE.DoubleSide, toneMapped:false,
    uniforms:{ tPortal:{value:null}, res:{value:new THREE.Vector2(1,1)}, time:{value:0}, open:{value:0}, live:{value:0} },
    vertexShader:"varying vec2 vUv; void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:["uniform sampler2D tPortal; uniform vec2 res; uniform float time; uniform float open; uniform float live; varying vec2 vUv;", PT_EDGE,
      "void main(){",
      "  float a=atan(vUv.y,vUv.x), r=length(vUv), R=edgeR(a,time,open);",
      "  if(r>R||open<0.02) discard;",
      "  float rim=smoothstep(R-0.16,R,r);",
      // light bends a little at the edge, like looking through the lip of a bubble
      "  vec2 suv=gl_FragCoord.xy/res - normalize(vUv+1e-5)*rim*rim*0.03*(0.6+0.4*sin(time*3.0+a*4.0));",
      "  vec3 c=texture2D(tPortal,suv).rgb;",
      "  c=mix(vec3(0.05,0.04,0.08),c,live);",
      "  float spark=cn(a,24.0,time*3.0);",
      "  vec3 ir=irid(cn(a,1.7,time*0.2)*1.6+r*0.4);",
      "  c=mix(c,mix(ir,vec3(1.0),0.22),pow(rim,3.0)*(0.65+0.35*spark));",
      "  c+=vec3(1.0)*pow(rim,12.0)*0.9;",
      "  gl_FragColor=vec4(c,1.0);",
      "}"].join("\n") }); }
  function ptGlow(){ return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, toneMapped:false,
    uniforms:{ time:{value:0}, open:{value:0} },
    vertexShader:"varying vec2 vUv; void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:["uniform float time; uniform float open; varying vec2 vUv;", PT_EDGE,
      "void main(){ float a=atan(vUv.y,vUv.x), r=length(vUv)*1.45, R=edgeR(a,time,open); if(r<R-0.02) discard;",
      "  float d=r-R, lum=0.45+0.9*cn(a,5.0,time*0.9), g=(exp(-d*d*1400.0)*0.8+exp(-d*d*70.0)*0.35)*lum;",
      "  vec3 c=mix(irid(cn(a,1.7,time*0.2)*1.6+0.15),vec3(1.0),0.12)*g*1.3*smoothstep(0.0,0.15,open);",
      "  gl_FragColor=vec4(c,1.0); }"].join("\n") }); }
  // glitter: sparks that live on the edge and drift off it; while opening they spiral out from the middle
  function ptSparks(){ var N=1600, g=new THREE.BufferGeometry(), p=new Float32Array(N*3), s=new Float32Array(N*2);
    for(var i=0;i<N;i++){ s[i*2]=Math.random(); s[i*2+1]=Math.random(); }
    g.setAttribute("position",new THREE.BufferAttribute(p,3)); g.setAttribute("seed",new THREE.BufferAttribute(s,2));
    var m=new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false, uniforms:{ time:{value:0}, open:{value:0}, swirl:{value:1}, R:{value:1}, px:{value:1} },
      vertexShader:["attribute vec2 seed; uniform float time; uniform float open; uniform float swirl; uniform float R; uniform float px; varying vec3 vC; varying float vA;", PT_EDGE,
        "void main(){",
        "  float life=fract(seed.y+time*(0.25+seed.x*0.35));",
        "  float a=seed.x*6.2832+swirl*(1.0-life)*7.0+time*0.15;",
        "  float Re=edgeR(a,time,max(open,0.04));",
        "  float out_=Re*(1.0+0.01+life*life*(0.12+0.4*ph(seed.x*91.0)*cn(a,4.0,time*0.5)))-0.05*ph(seed.y*37.0);",
        "  float rr=mix(out_, out_*life*1.1, swirl);",
        "  vec3 q=vec3(cos(a)*rr*R, sin(a)*rr*R, (ph(seed.x*13.0)-0.5)*0.25*R*life);",
        "  vA=sin(life*3.1416)*(0.25+0.75*ph(seed.y*7.0+floor(time*8.0)))*smoothstep(0.0,0.08,open+swirl*0.2);",
        "  vC=mix(irid(cn(a,1.7,time*0.2)*1.6+life*0.3),vec3(1.0),0.5);",
        "  vec4 mv=modelViewMatrix*vec4(q,1.0); gl_PointSize=(1.0+ph(seed.x*5.0)*2.6)*px/-mv.z; gl_Position=projectionMatrix*mv; }"].join("\n"),
      fragmentShader:"varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); a*=a; gl_FragColor=vec4(vC*a*vA*1.6,1.0); }" });
    var pts=new THREE.Points(g,m); pts.frustumCulled=false; return pts; }

  function ptMake(s){ var o=new THREE.Group(), disk=new THREE.Mesh(new THREE.CircleGeometry(PT_R*s*1.25,128), ptMat()), glow=new THREE.Mesh(new THREE.PlaneGeometry(PT_R*s*2.5*1.45,PT_R*s*2.5*1.45), ptGlow()), sp=ptSparks();
    glow.position.z=0.003*s; glow.renderOrder=5; sp.renderOrder=6; sp.material.uniforms.R.value=PT_R*s*1.25;
    disk.onBeforeRender=function(r){ var t=r.getRenderTarget(); if(t) disk.material.uniforms.res.value.set(t.width,t.height); sp.material.uniforms.px.value=(t?t.height:innerHeight)*0.012; };
    o.add(disk); o.add(glow); o.add(sp); o.userData={disk:disk, glow:glow, sp:sp}; return o; }

  // ---- where it leads: another good spot in the scan, a few metres off, looking back towards the subject ----
  /* a good spot near the middle, looking at the subject (the cube's spots): you come out of the far end walking towards it */
  function ptSpot(s){ var S=cuSpots(6), cur=new THREE.Vector3(camPos.x,0,camPos.z), best=null, bd=-1;
    S.forEach(function(sp){ var d=Math.hypot(sp.o.position.x-cur.x, sp.o.position.z-cur.z); if(d>bd){ bd=d; best=sp; } });   // the one furthest from here, so it feels like going somewhere
    var far=new THREE.Object3D(), fwd=new THREE.Vector3(0,0,-1).applyQuaternion(best.o.quaternion); fwd.y=0; fwd.normalize();
    far.position.copy(best.o.position).y-=0.3*s; far.rotation.y=Math.atan2(fwd.x,fwd.z); far.updateMatrixWorld(true); far.userData.name=best.name; return far; }   /* its front faces the subject: you step out along it */

  // ---- T: open in front of you; T again (or walking through) closes it ----
  function ptToggle(){ if(!loaded||!scene) return; if(PT.on&&PT.state!=="closing"){ ptClose(); return; } if(PT.on) return; ptOpen(); }
  function ptOpen(){ var s=ptScale(); ptDispose(); PT.n++;
    var f=new THREE.Vector3(); camera.getWorldDirection(f); f.y=0; if(f.lengthSq()<1e-6) f.set(0,0,-1); f.normalize();
    var o=ptMake(s), d=3.4*s; o.position.set(camPos.x+f.x*d, camPos.y-0.3*s, camPos.z+f.z*d); o.rotation.y=Math.atan2(-f.x,-f.z); o.updateMatrixWorld(true);
    scene.add(o); PT.o=o; PT.far=ptSpot(s); PT.on=true; PT.state="opening"; PT.t0=performance.now(); PT.open=0; PT.prev=camPos.clone(); PT.cool=performance.now()+500; ptSound(true); }
  function ptClose(){ if(!PT.on) return; PT.state="closing"; PT.closeT=performance.now(); PT.closeFrom=PT.open; ptSound(false); }
  function ptDispose(){ if(PT.o){ if(PT.o.parent) PT.o.parent.remove(PT.o); PT.o.traverse(function(c){ if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); }); } PT.o=null; PT.far=null; PT.on=false; PT.state=""; PT.live=false; }

  // ---- the far-side view ----
  var _flip=new THREE.Matrix4().makeRotationY(Math.PI);
  function ptXf(from,to){ return to.matrixWorld.clone().multiply(_flip).multiply(from.matrixWorld.clone().invert()); }
  function ptRender(){ if(!PT.on||!PT.o||!viewer) return; var now=performance.now(), t=(now-PT.t0)/1000;
    if(PT.state==="opening"){ var k=Math.min(1,Math.max(0,(t-0.55)/1.1)); PT.open=k<1?(1-Math.pow(1-k,3))*(1+0.06*Math.sin(k*9.0)*(1-k)):1; if(k>=1) PT.state="open"; }
    else if(PT.state==="closing"){ var c=Math.min(1,(now-PT.closeT)/900); PT.open=(PT.closeFrom||1)*(1-c*c); if(c>=1){ ptDispose(); return; } }
    var u=PT.o.userData, swirl=PT.state==="opening"?Math.max(0,1-t/1.2):0;
    u.disk.material.uniforms.time.value=t; u.disk.material.uniforms.open.value=PT.open; u.glow.material.uniforms.time.value=t; u.glow.material.uniforms.open.value=PT.open;
    u.sp.material.uniforms.time.value=t; u.sp.material.uniforms.open.value=PT.open; u.sp.material.uniforms.swirl.value=swirl;
    var s=ptScale(), vis=PT.open>0.02&&PT.o.position.distanceTo(camera.position)<80*s;
    if(vis){ var fr=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)); vis=fr.intersectsSphere(new THREE.Sphere(PT.o.position,PT_R*s*1.4)); }
    PT.live=vis; u.disk.material.uniforms.live.value=vis?1:0; if(!vis) return;
    var sz=new THREE.Vector2(sceneRT.width,sceneRT.height), w=Math.max(2,Math.round(sz.x*0.6)), h=Math.max(2,Math.round(sz.y*0.6));
    if(!PT.rt) PT.rt=new THREE.WebGLRenderTarget(w,h,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true}); else if(PT.rt.width!==w||PT.rt.height!==h) PT.rt.setSize(w,h);
    if(!PT.spark) PT.spark=new SPARK.SparkRenderer({renderer:renderer});
    var main=viewer.spark, B=PT.spark; B.lodSplatScale=main.lodSplatScale; B.maxStdDev=main.maxStdDev; B.apertureAngle=0;
    if(!PT.cam) PT.cam=camera.clone(); var c2=PT.cam; c2.fov=camera.fov; c2.aspect=camera.aspect; c2.far=camera.far;
    camera.updateMatrixWorld(true); var M=ptXf(PT.o,PT.far).multiply(camera.matrixWorld); M.decompose(c2.position,c2.quaternion,c2.scale); c2.scale.set(1,1,1);
    // the near plane sits just short of the far end, so nothing behind it (from there) gets in the way
    var dir=new THREE.Vector3(); c2.getWorldDirection(dir); var dep=PT.far.position.clone().sub(c2.position).dot(dir); c2.near=Math.max(camera.near,dep-PT_R*s*1.4);
    c2.updateProjectionMatrix(); c2.updateMatrixWorld(true);
    var keep=renderer.getRenderTarget(); PT.o.visible=false; renderer.setRenderTarget(PT.rt); renderer.setClearColor(0x0e0f13,1); renderer.clear(true,true,true);
    try{ B.render(scene,c2); }catch(e){ if(!ptRender.warned){ ptRender.warned=1; console.warn("portal pass",e); } }
    PT.o.visible=true; renderer.setRenderTarget(keep); u.disk.material.uniforms.tPortal.value=PT.rt.texture; }

  // ---- walking through: you're there, and the opening closes behind you ----
  function ptCross(){ if(!PT.on||!PT.prev||!PT.o){ PT.prev=camPos.clone(); return; } var s=ptScale(), a=PT.prev, b=camPos, o=PT.o;
    if(performance.now()<PT.cool||PT.open<0.5){ PT.prev.copy(camPos); return; }
    var n=new THREE.Vector3(0,0,1).applyQuaternion(o.quaternion), da=a.clone().sub(o.position).dot(n), db=b.clone().sub(o.position).dot(n);
    if(da!==0&&(da>0)!==(db>0)){ var tt=da/(da-db), p=a.clone().lerp(b,tt).sub(o.position);
      if(p.length()<=PT_R*s*0.95){
        var M=ptXf(o,PT.far), dy=PT.far.rotation.y+Math.PI-o.rotation.y; camPos.applyMatrix4(M); yaw+=dy;
        var v=new THREE.Vector3(_vel.x,_vel.y,_vel.z).applyAxisAngle(UPY,dy); _vel.x=v.x; _vel.y=v.y; _vel.z=v.z;
        // swap the ends: the opening now stands behind you, looking back where you came from, and closes
        var op=o.position.clone(), oy=o.rotation.y; o.position.copy(PT.far.position); o.rotation.y=PT.far.rotation.y; o.updateMatrixWorld(true);
        PT.far.position.copy(op); PT.far.rotation.y=oy; PT.far.updateMatrixWorld(true);
        PT.cool=performance.now()+1500; ptSound(true, true); ptClose(); if(typeof achEvent==="function") achEvent("portal"); } }
    PT.prev.copy(camPos); }
  // a rising shimmer to open, a falling one to close, a whoosh going through
  function ptSound(up, through){ if(typeof soundOn!=="undefined"&&!soundOn) return; try{ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); var c=audioCtx, t=c.currentTime, len=through?0.8:1.2;
      var b=c.createBuffer(1,Math.round(c.sampleRate*len),c.sampleRate), d=b.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(Math.sin(Math.PI*i/d.length),2);
      var src=c.createBufferSource(); src.buffer=b; var f=c.createBiquadFilter(); f.type="bandpass"; f.Q.value=through?1.0:4.0;
      f.frequency.setValueAtTime(up?400:2600,t); f.frequency.exponentialRampToValueAtTime(up?2800:350,t+len*0.8);
      var g=c.createGain(); g.gain.value=through?0.18:0.1; src.connect(f); f.connect(g); g.connect(c.destination); src.start(t);
      if(!through) [1318.5,1975.5,2637].forEach(function(fq,j){ var o=c.createOscillator(), gg=c.createGain(); o.type="sine"; o.frequency.value=up?fq:fq*0.75; var t1=t+j*0.07+(up?0.15:0);
        gg.gain.setValueAtTime(0,t1); gg.gain.linearRampToValueAtTime(0.025,t1+0.03); gg.gain.exponentialRampToValueAtTime(0.0005,t1+0.9); o.connect(gg); gg.connect(c.destination); o.start(t1); o.stop(t1+1); }); }catch(e){} }

  if(/[?&]dev/.test(location.search)) window.__pt={ state:function(){ return {on:PT.on, state:PT.state, open:+PT.open.toFixed(2), live:PT.live, o:PT.o&&PT.o.position.toArray().map(function(v){ return +v.toFixed(2); }), far:PT.far&&PT.far.position.toArray().map(function(v){ return +v.toFixed(2); })}; },
    toggle:ptToggle, open:ptOpen, close:ptClose,
    step:function(dist){ var f=new THREE.Vector3(0,0,-1).applyAxisAngle(UPY,yaw); camPos.addScaledVector(f,dist*ptScale()); },
    turn:function(r){ yaw+=r; },
    pos:function(){ return {x:camPos.x, y:camPos.y, z:camPos.z, yaw:yaw}; }, dbg:function(){ return {prev:PT.prev&&PT.prev.toArray(), cam:camPos.toArray()}; } };
