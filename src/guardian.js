  // ================= BOUNDARY: a circle round the subject, and a soft mesh wall when you get near it =================
  // A scan is only good near the thing it was made of, so you stay within a few metres of the subject (scene `bound`,
  // metres; 5 by default). Like a VR guardian, the wall is invisible until you're close, then a fine gold mesh fades
  // in just around you and goes again as you step back. The clamp is a circle, so you slide along it rather than stop.
  var BND={mesh:null, r:0, cx:0, cz:0, on:false};
  var BND_VS="varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }";
  var BND_FS="uniform vec3 eye; uniform float t; uniform float gy; varying vec3 vW;"
    +"void main(){ float d=distance(vW.xz,eye.xz); float near=1.0-smoothstep(0.35,2.2,d);"
    +" vec2 g=abs(fract(vec2(vW.x+vW.z,vW.y-gy)*vec2(1.6,2.4)+vec2(0.0,t*0.03))-0.5); float line=1.0-smoothstep(0.0,0.07,min(g.x,g.y));"
    +" float fade=1.0-smoothstep(1.6,3.2,vW.y-gy);"   /* taller than you, fading out overhead */
    +" float a=near*(line*0.55+0.08)*fade; gl_FragColor=vec4(0.93,0.74,0.42,a); }";
  function bndRadius(){ var sp=typeof CH!=="undefined"&&CH.spec; if(!sp||!sp.subject) return 0; return sp.bound!=null?sp.bound:5; }
  function bndAttach(){ bndDispose(); var r=bndRadius(); if(!r||typeof scene==="undefined") { BND.on=false; return; }
    var S=CH.spec.subject, gy=typeof wkGround==="function"?wkGround(S[0],S[1]):0;
    BND.r=r; BND.cx=S[0]; BND.cz=S[1]; BND.on=true;
    var geo=new THREE.CylinderGeometry(r,r,3.6,96,1,true), mat=new THREE.ShaderMaterial({uniforms:{eye:{value:new THREE.Vector3()}, t:{value:0}, gy:{value:gy}}, vertexShader:BND_VS, fragmentShader:BND_FS, transparent:true, depthTest:false, depthWrite:false, side:THREE.DoubleSide});
    BND.mesh=new THREE.Mesh(geo,mat); BND.mesh.position.set(S[0], gy+1.8, S[1]); BND.mesh.frustumCulled=false; }
  function bndDispose(){ if(BND.mesh){ try{ BND.mesh.geometry.dispose(); BND.mesh.material.dispose(); }catch(e){} } BND.mesh=null; }
  // keep the camera inside the circle (slides along the edge); the walk map's own obstacles still apply
  function bndClamp(){ if(!BND.on||!boundsOn) return false; var dx=camPos.x-BND.cx, dz=camPos.z-BND.cz, d=Math.hypot(dx,dz), lim=BND.r-0.15; if(d<=lim) return false;
    camPos.x=BND.cx+dx/d*lim; camPos.z=BND.cz+dz/d*lim; var vr=(_vel.x*dx+_vel.z*dz)/d; if(vr>0){ _vel.x-=dx/d*vr; _vel.z-=dz/d*vr; } return true; }
  function bndRender(dt){ if(!BND.on||!BND.mesh||viewfinderOn&&CH.capturing) return; var d=Math.hypot(camPos.x-BND.cx,camPos.z-BND.cz); if(BND.r-d>2.4) return;   /* nowhere near it: draw nothing */
    var u=BND.mesh.material.uniforms; u.eye.value.copy(camPos); u.t.value+=dt||0.016;
    var ac=renderer.autoClear; renderer.autoClear=false; renderer.render(BND.mesh, camera); renderer.autoClear=ac; }
  if(/[?&]dev/.test(location.search)) window.__bnd={ state:function(){ return {on:BND.on, r:BND.r, d:BND.on?Math.hypot(camPos.x-BND.cx,camPos.z-BND.cz):null}; } };
