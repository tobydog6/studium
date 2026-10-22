  // ================= PORTALS: a window into somewhere else that you can walk through =================
  // A disk standing in the scene shows another place, with true parallax: each frame the scene is drawn a second time
  // from where you'd be standing on the far side, and the disk shows that picture at the same screen pixels. Walk into
  // it and you're there, with nothing in between. For now both ends are in the same scan (the far side of the clearing);
  // a portal to a different scan uses the same pieces, with the far side loading in behind it.
  // The far-side pass uses its own Spark renderer (sharing the main one's level-of-detail picks) so neither re-sorts.
  var PT={on:false, ends:[], rt:null, behind:null, cam:null, prev:null, t0:0, live:-1, cool:0, grp:null};
  var PT_R=1.05;   // disk radius, metres

  function ptScale(){ return (typeof RL!=="undefined"&&RL.S)||(WK.col?1:sceneScale()); }
  function ptMat(){ return new THREE.ShaderMaterial({ transparent:false, depthWrite:true, side:THREE.DoubleSide, toneMapped:false,
    uniforms:{ tPortal:{value:null}, res:{value:new THREE.Vector2(1,1)}, time:{value:0}, open:{value:0}, live:{value:0} },
    vertexShader:"varying vec2 vUv; void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:[
      "uniform sampler2D tPortal; uniform vec2 res; uniform float time; uniform float open; uniform float live; varying vec2 vUv;",
      "float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }",
      "float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.0),f.x),f.y); }",
      "void main(){",
      "  float a=atan(vUv.y,vUv.x), r=length(vUv);",
      // the edge breathes: a slow, uneven ripple so it reads as a living opening, not a cut-out
      "  float edge=open*(0.985+0.007*sin(a*5.0+time*1.3)+0.006*(n(vec2(a*3.0,time*0.7))-0.5));",
      "  if(r>edge) discard;",
      "  float rim=smoothstep(edge-0.06,edge,r);",
      "  vec2 suv=gl_FragCoord.xy/res; suv+=normalize(vUv+1e-5)*rim*rim*0.006*sin(time*2.0+r*30.0);",
      "  vec3 c=texture2D(tPortal,suv).rgb;",
      "  vec3 haze=mix(vec3(0.10,0.09,0.07),vec3(0.95,0.78,0.48),0.35+0.35*n(vUv*3.0+time*0.3));",
      "  c=mix(haze,c,live);",
      "  vec3 glow=vec3(1.0,0.86,0.62);",
      "  c=mix(c,glow,pow(rim,4.0)*0.75);",
      "  gl_FragColor=vec4(c,1.0);",
      "}"].join("\n") }); }
  function ptHalo(){ return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, toneMapped:false,
    uniforms:{ time:{value:0}, open:{value:0} },
    vertexShader:"varying vec2 vUv; void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:"uniform float time; uniform float open; varying vec2 vUv; void main(){ float r=length(vUv)*1.15/max(open,0.001), a=atan(vUv.y,vUv.x);"
      +" float g=exp(-pow((r-1.0)*14.0,2.0))*(0.32+0.12*sin(a*7.0-time*2.2)+0.08*sin(a*3.0+time*1.1)); g+=exp(-pow((r-1.0)*5.0,2.0))*0.07; g*=smoothstep(1.15,1.05,length(vUv));"
      +" gl_FragColor=vec4(vec3(1.0,0.82,0.55)*g*open,1.0); }" }); }
  // drifting motes round the rim
  function ptMotes(){ var N=40, g=new THREE.BufferGeometry(), p=new Float32Array(N*3), s=new Float32Array(N);
    for(var i=0;i<N;i++){ s[i]=Math.random(); p[i*3]=0; p[i*3+1]=0; p[i*3+2]=0; }
    g.setAttribute("position",new THREE.BufferAttribute(p,3)); g.setAttribute("seed",new THREE.BufferAttribute(s,1));
    var m=new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false, uniforms:{ time:{value:0}, open:{value:0}, R:{value:1} },
      vertexShader:"attribute float seed; uniform float time; uniform float open; uniform float R; varying float vA;"
        +" void main(){ float a=seed*6.2832+time*(0.12+seed*0.25)*(seed>0.5?1.0:-1.0), life=fract(seed*7.3+time*0.11);"
        +" float rr=R*open*(1.0+0.05+life*0.22); vec3 q=vec3(cos(a)*rr, sin(a)*rr, (seed-0.5)*0.12*R);"
        +" vA=sin(life*3.1416)*open; vec4 mv=modelViewMatrix*vec4(q,1.0); gl_PointSize=(1.5+seed*2.0)*(24.0/-mv.z); gl_Position=projectionMatrix*mv; }",
      fragmentShader:"varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d)*vA; gl_FragColor=vec4(vec3(1.0,0.86,0.6)*a*0.7,1.0); }" });
    var pts=new THREE.Points(g,m); pts.frustumCulled=false; return pts; }

  // ---- placing the two ends ----
  function ptEnd(x,z,face,s){ var o=new THREE.Group(), y=(WK.col?wkGround(x,z):camPos.y-1.6*s)+(PT_R+0.18)*s;
    o.position.set(x,y,z); o.rotation.y=face; o.updateMatrixWorld(true);
    var disk=new THREE.Mesh(new THREE.CircleGeometry(PT_R*s,96), ptMat()), halo=new THREE.Mesh(new THREE.PlaneGeometry(PT_R*s*2.3,PT_R*s*2.3), ptHalo()), motes=ptMotes();
    halo.position.z=0.002*s; halo.renderOrder=5; motes.material.uniforms.R.value=PT_R*s; o.add(disk); o.add(halo); o.add(motes);
    o.userData={disk:disk, halo:halo, motes:motes};
    disk.onBeforeRender=function(r){ var t=r.getRenderTarget(); if(t) disk.material.uniforms.res.value.set(t.width,t.height); };   /* photos render at their own size */
    return o; }
  function ptClear(){ if(PT.grp&&PT.grp.parent) PT.grp.parent.remove(PT.grp); PT.ends=[]; PT.grp=null; PT.on=false; PT.live=-1; }
  /* one end a few metres from where you start, facing you; the other across the clearing, facing back at the subject */
  function ptSetup(){ ptClear(); if(!loaded||!scene||/[?&]noportal/.test(location.search)) return; var s=ptScale(), sj=CH.spec&&CH.spec.subject, cx=sj?sj[0]:camPos.x, cz=sj?sj[1]:camPos.z;
    var f=new THREE.Vector3(); camera.getWorldDirection(f); f.y=0; f.normalize(); var r=new THREE.Vector3(-f.z,0,f.x);
    var spot=function(x,z){ if(!WK.col) return true; var g=wkGround(x,z); return !wkBlocked(x,z,g)&&!wkBlocked(x+0.6*s,z,g)&&!wkBlocked(x-0.6*s,z,g); };
    var ex=null, ez=null; for(var k=0;k<12&&ex==null;k++){ var d=(3.2+k*0.3)*s, side=k%2?1:-1, x=camPos.x+f.x*d+r.x*side*1.8*s, z=camPos.z+f.z*d+r.z*side*1.8*s; if(spot(x,z)){ ex=x; ez=z; } }
    if(ex==null){ ex=camPos.x+f.x*3*s; ez=camPos.z+f.z*3*s; }
    var bx=null, bz=null, dx=cx-camPos.x, dz=cz-camPos.z, dl=Math.hypot(dx,dz)||1; dx/=dl; dz/=dl;
    for(var j=0;j<16&&bx==null;j++){ var dd=(5+j*0.35)*s, an=(j%2?1:-1)*(1.75+(j>>1)*0.08), ux=dx*Math.cos(an)-dz*Math.sin(an), uz=dx*Math.sin(an)+dz*Math.cos(an), x2=cx+ux*dd, z2=cz+uz*dd; if(spot(x2,z2)&&Math.hypot(x2-ex,z2-ez)>=5.5*s){ bx=x2; bz=z2; } }
    if(bx==null){ bx=cx+dx*5*s; bz=cz+dz*5*s; }
    var A=ptEnd(ex,ez,Math.atan2(camPos.x-ex,camPos.z-ez),s), B=ptEnd(bx,bz,Math.atan2(cx-bx,cz-bz),s);
    PT.grp=new THREE.Group(); PT.grp.add(A); PT.grp.add(B); scene.add(PT.grp); PT.ends=[A,B]; PT.on=true; PT.t0=performance.now(); PT.prev=camPos.clone(); }

  // ---- the far-side view ----
  var _flip=new THREE.Matrix4().makeRotationY(Math.PI);
  function ptXf(from,to){ return to.matrixWorld.clone().multiply(_flip).multiply(from.matrixWorld.clone().invert()); }
  function ptVisible(o){ var c=o.position, s=ptScale(), d=c.distanceTo(camera.position); if(d>60*s) return 1e9;
    var fr=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    return fr.intersectsSphere(new THREE.Sphere(c,PT_R*s*1.2))?d:1e9; }
  /* each end you can see gets its own far-side pass (the nearer one sharper), each with its own Spark renderer so
     it keeps its own sort and picks its own detail for where that view really stands */
  function ptPass(o, other, scale){ var u=o.userData, sz=new THREE.Vector2(sceneRT.width,sceneRT.height), w=Math.max(2,Math.round(sz.x*scale)), h=Math.max(2,Math.round(sz.y*scale));
    if(!u.rt) u.rt=new THREE.WebGLRenderTarget(w,h,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true}); else if(u.rt.width!==w||u.rt.height!==h) u.rt.setSize(w,h);
    if(!u.spark) u.spark=new SPARK.SparkRenderer({renderer:renderer});
    var main=viewer.spark, B=u.spark; B.lodSplatScale=main.lodSplatScale; B.maxStdDev=main.maxStdDev; B.apertureAngle=0;
    if(!u.cam) u.cam=camera.clone(); var c2=u.cam; c2.fov=camera.fov; c2.aspect=camera.aspect; c2.far=camera.far;
    var M=ptXf(o,other).multiply(camera.matrixWorld); M.decompose(c2.position,c2.quaternion,c2.scale); c2.scale.set(1,1,1);
    // the near plane sits just short of the far end's disk, so nothing between you and it (behind it, from there) gets in
    var dir=new THREE.Vector3(); c2.getWorldDirection(dir); var dep=other.position.clone().sub(c2.position).dot(dir); c2.near=Math.max(camera.near,dep-PT_R*ptScale()*1.05);
    c2.updateProjectionMatrix(); c2.updateMatrixWorld(true);
    renderer.setRenderTarget(u.rt); renderer.setClearColor(0x0e0f13,1); renderer.clear(true,true,true);
    try{ B.render(scene,c2); }catch(e){ if(!ptRender.warned){ ptRender.warned=1; console.warn("portal pass",e); } }
    u.disk.material.uniforms.tPortal.value=u.rt.texture; u.disk.material.uniforms.live.value=1; }
  function ptRender(){ if(!PT.on||!viewer||!PT.ends.length) return; var t=(performance.now()-PT.t0)/1000, open=Math.min(1,Math.max(0,(t-0.4)/1.6)), ease=1-Math.pow(1-open,3);
    PT.ends.forEach(function(o){ var u=o.userData; u.disk.material.uniforms.time.value=t; u.disk.material.uniforms.open.value=ease; u.disk.material.uniforms.live.value=0;
      u.halo.material.uniforms.time.value=t; u.halo.material.uniforms.open.value=ease; u.motes.material.uniforms.time.value=t; u.motes.material.uniforms.open.value=ease; });
    camera.updateMatrixWorld(true);
    var vis=PT.ends.map(function(o,i){ return {i:i, d:ptVisible(o)}; }).filter(function(v){ return v.d<1e9; }).sort(function(a,b){ return a.d-b.d; });
    PT.live=vis.length?vis[0].i:-1; if(!vis.length) return;
    var keepRT=renderer.getRenderTarget(); PT.ends.forEach(function(o){ o.visible=false; });
    vis.forEach(function(v,k){ ptPass(PT.ends[v.i], PT.ends[1-v.i], k===0?0.6:0.4); });
    PT.ends.forEach(function(o){ o.visible=true; }); renderer.setRenderTarget(keepRT); }

  // ---- walking through ----
  function ptCross(){ if(!PT.on||!PT.prev){ PT.prev=camPos.clone(); return; } var s=ptScale(), a=PT.prev, b=camPos;
    if(performance.now()<PT.cool){ PT.prev.copy(camPos); return; }
    for(var i=0;i<PT.ends.length;i++){ var o=PT.ends[i], n=new THREE.Vector3(0,0,1).applyQuaternion(o.quaternion), da=a.clone().sub(o.position).dot(n), db=b.clone().sub(o.position).dot(n);
      if(da===0||(da>0)===(db>0)) continue; var tt=da/(da-db), p=a.clone().lerp(b,tt), off=p.sub(o.position); off.y-=0; if(off.length()>PT_R*s) continue;
      // through: move to the same spot at the other end, turned the same way, and carry on walking
      var to=PT.ends[1-i], M=ptXf(o,to); camPos.applyMatrix4(M); var dy=to.rotation.y+Math.PI-o.rotation.y; yaw+=dy;
      var v=new THREE.Vector3(_vel.x,_vel.y,_vel.z).applyAxisAngle(UPY,dy); _vel.x=v.x; _vel.y=v.y; _vel.z=v.z;
      PT.cool=performance.now()+400; ptWhoosh(); if(typeof achEvent==="function") achEvent("portal"); break; }
    PT.prev.copy(camPos); }
  function ptWhoosh(){ if(typeof soundOn!=="undefined"&&!soundOn) return; try{ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); var c=audioCtx, t=c.currentTime, len=0.7;
      var b=c.createBuffer(1,Math.round(c.sampleRate*len),c.sampleRate), d=b.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/d.length);
      var src=c.createBufferSource(); src.buffer=b; var f=c.createBiquadFilter(); f.type="bandpass"; f.Q.value=1.2; f.frequency.setValueAtTime(300,t); f.frequency.exponentialRampToValueAtTime(2400,t+len*0.6);
      var g=c.createGain(); g.gain.value=0.16; src.connect(f); f.connect(g); g.connect(c.destination); src.start(t); }catch(e){} }

  if(/[?&]dev/.test(location.search)) window.__pt={ state:function(){ return {on:PT.on, n:PT.ends.length, live:PT.live, ends:PT.ends.map(function(o){ return {x:+o.position.x.toFixed(2), y:+o.position.y.toFixed(2), z:+o.position.z.toFixed(2), ry:+o.rotation.y.toFixed(3)}; })}; },
    setup:ptSetup, clear:ptClear,
    /* stand a few metres in front of an end and face it */
    face:function(i,d){ var o=PT.ends[i||0], s=ptScale(), n=new THREE.Vector3(0,0,1).applyQuaternion(o.quaternion); camPos.copy(o.position).addScaledVector(n,(d||3)*s); camPos.y=o.position.y+0.35*s; yaw=o.rotation.y; pitch=0; PT.prev=camPos.clone(); PT.cool=performance.now()+300; },
    step:function(dist){ var f=new THREE.Vector3(0,0,-1).applyAxisAngle(UPY,yaw); camPos.addScaledVector(f,dist*ptScale()); },
    pos:function(){ return {x:camPos.x, y:camPos.y, z:camPos.z, yaw:yaw}; }, dbg:function(){ return {prev:PT.prev&&PT.prev.toArray(), cool:PT.cool-performance.now(), cam:camPos.toArray(), S:ptScale()}; } };
