  // ================= SKY: the scan's own surroundings, wrapped round you =================
  // Where the scan has holes you'd see black. Behind everything sits a sphere that always follows the camera (so
  // it reads as infinitely far away), painted with an equirectangular map built from the scan's own far-away
  // splats (tools/build_sky.py): the treeline all the way round, overcast sky above, ground below. Like an HDRI
  // dome in Octane, but made from the place itself. Scans with no map get a soft overcast gradient instead.
  var SKY={tex:null, mesh:null, url:null};
  var SKY_VS="varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
  var SKY_FS="uniform sampler2D map; uniform float dim; uniform vec3 tint; varying vec3 vDir; void main(){ vec3 d=normalize(vDir); float u=atan(d.x,-d.z)/6.2831853+0.5; float t=0.5+asin(clamp(d.y,-1.0,1.0))/3.14159265; gl_FragColor=vec4(texture2D(map,vec2(u,t)).rgb*dim*tint,1.0); }";
  function skyFallback(){ var c=document.createElement("canvas"); c.width=8; c.height=256; var g=c.getContext("2d"), gr=g.createLinearGradient(0,0,0,256);
    gr.addColorStop(0,"#dcdcda"); gr.addColorStop(0.47,"#c9c8c2"); gr.addColorStop(0.53,"#6d6656"); gr.addColorStop(1,"#4a4436"); g.fillStyle=gr; g.fillRect(0,0,8,256); return c.toDataURL(); }
  function skySet(url){ SKY.url=url||null; }
  function skyAttach(sc){ var url=SKY.url||skyFallback(), tex=new THREE.TextureLoader().load(url, function(){ tex.needsUpdate=true; });
    tex.generateMipmaps=false; tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter; tex.wrapS=THREE.RepeatWrapping;
    var mat=new THREE.ShaderMaterial({uniforms:{map:{value:tex}, dim:{value:1}, tint:{value:new THREE.Vector3(1,1,1)}}, vertexShader:SKY_VS, fragmentShader:SKY_FS, side:THREE.BackSide, depthWrite:false, depthTest:false});
    var m=new THREE.Mesh(new THREE.SphereGeometry(1,48,24), mat); m.frustumCulled=false; m.renderOrder=-1000; sc.add(m); SKY.mesh=m; SKY.tex=tex; }
  function skyFollow(){ if(!SKY.mesh) return; SKY.mesh.position.copy(camera.position); var r=camera.far*0.5; SKY.mesh.scale.set(r,r,r); }
