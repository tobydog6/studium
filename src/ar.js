// Studium AR (test): a scan floats in the room on the phone's live camera. The view turns with the phone (gyro),
// but doesn't follow you walking: real tracking needs a native app (ARKit). Photos are the camera frame with the
// scan drawn over it, saved through the share sheet so they land in Photos.
(function(){
  var $=function(id){ return document.getElementById(id); };
  var SCANS=[{id:"carpark", name:"The Car Park", data:"asset-b64:assets/scenes/carpark-preview.stm", up:"zup", scale:5, size:0.06}];
  var pick=0, renderer, scene, camera, spark, mesh, holder, video=$("cam"), shots=[], gyro={a:0,b:90,g:0,o:0,on:false}, base=0;

  SCANS.forEach(function(s,i){ var b=document.createElement("button"); b.textContent=s.name; if(i===0) b.className="on";
    b.onclick=function(){ pick=i; Array.prototype.forEach.call($("picks").children,function(x,j){ x.className=j===i?"on":""; }); }; $("picks").appendChild(b); });

  function bytes(v){ if(!/^@parts:/.test(v)) return fetch("data:application/octet-stream;base64,"+v).then(function(r){ return r.arrayBuffer(); });
    return Promise.all(v.slice(7).split(",").map(function(u){ return fetch(u).then(function(r){ return r.arrayBuffer(); }); })).then(function(L){ var n=0; L.forEach(function(b){ n+=b.byteLength; }); var o=new Uint8Array(n), k=0; L.forEach(function(b){ o.set(new Uint8Array(b),k); k+=b.byteLength; }); return o.buffer; }); }
  // .stm (Studium's packed scan) to .splat
  function unpack(buf){ var dv=new DataView(buf), n=dv.getUint32(4,true), f=new Float32Array(buf.slice(8,40)), b=new Uint8Array(buf,40), out=new ArrayBuffer(n*32), F=new Float32Array(out), U=new Uint8Array(out);
    var sx=[(f[3]-f[0])/65535,(f[4]-f[1])/65535,(f[5]-f[2])/65535], ss=(f[7]-f[6])/65535;
    for(var i=0;i<n;i++){ var fo=i*8, uo=i*32; for(var ch=0;ch<6;ch++){ var base_=ch*2*n, v=b[base_+i]|(b[base_+n+i]<<8); F[fo+ch]=ch<3?f[ch]+v*sx[ch]:Math.exp(f[6]+v*ss); }
      for(var k=0;k<8;k++) U[uo+24+k]=b[12*n+k*n+i]; } return out; }

  function start(){ $("go").disabled=true; $("go").textContent="STARTING…";
    // iPhone asks for motion access on a tap, and the camera needs https
    var motion=(typeof DeviceOrientationEvent!=="undefined"&&DeviceOrientationEvent.requestPermission)?DeviceOrientationEvent.requestPermission().catch(function(){ return "denied"; }):Promise.resolve("granted");
    var cam=navigator.mediaDevices&&navigator.mediaDevices.getUserMedia?navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}, width:{ideal:1920}, height:{ideal:1080}}, audio:false}):Promise.reject(new Error("no camera"));
    Promise.all([motion, cam]).then(function(r){ video.srcObject=r[1]; video.play(); if(r[0]!=="granted") alert("Motion access was turned down, so the scan won't turn with your phone. Drag still works.");
      $("start").style.display="none"; $("bar").style.display="flex"; $("hint").style.display="block"; setTimeout(function(){ $("hint").style.display="none"; },6000); init(); })
      .catch(function(e){ $("go").disabled=false; $("go").textContent="START THE CAMERA"; alert("Couldn't start the camera. Open this page over https (not as a file), and allow camera access. ("+(e&&e.message||e)+")"); }); }
  $("go").onclick=start;

  function init(){ var cv=$("gl"); renderer=new THREE.WebGLRenderer({canvas:cv, alpha:true, antialias:false, preserveDrawingBuffer:true}); renderer.setPixelRatio(Math.min(2,devicePixelRatio||1)); renderer.setClearColor(0x000000,0);
    scene=new THREE.Scene(); camera=new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.01, 100); scene.add(camera);
    spark=new Spark.SparkRenderer({renderer:renderer}); scene.add(spark);
    holder=new THREE.Group(); scene.add(holder);
    resize(); addEventListener("resize",resize);
    addEventListener("deviceorientation",function(e){ if(e.alpha==null) return; var first=!gyro.on; gyro.a=e.alpha; gyro.b=e.beta; gyro.g=e.gamma; gyro.on=true; if(first&&mesh){ aim(); placeHere(); } });
    addEventListener("orientationchange",function(){ gyro.o=screen.orientation?screen.orientation.angle:(window.orientation||0); });
    load(); gestures(); (function loop(){ requestAnimationFrame(loop); aim(); renderer.render(scene,camera); })(); }
  function resize(){ if(!renderer) return; renderer.setSize(innerWidth,innerHeight,false); camera.aspect=innerWidth/innerHeight;
    // match the phone's main camera: roughly a 26 mm lens, about 65 degrees across the long side
    camera.fov=innerHeight>innerWidth?62:40; camera.updateProjectionMatrix(); }
  // the standard device-orientation to camera mapping (as three.js used to ship it)
  var zee=new THREE.Vector3(0,0,1), q0=new THREE.Quaternion(), q1=new THREE.Quaternion(-Math.sqrt(0.5),0,0,Math.sqrt(0.5)), eul=new THREE.Euler();
  function aim(){ if(!gyro.on) return; var d=Math.PI/180; eul.set(gyro.b*d, (gyro.a-base)*d, -gyro.g*d, "YXZ"); camera.quaternion.setFromEuler(eul); camera.quaternion.multiply(q1); camera.quaternion.multiply(q0.setFromAxisAngle(zee,-gyro.o*d)); }

  function load(){ var s=SCANS[pick]; $("load").style.display="block";
    bytes(s.data).then(function(ab){ return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer(); })
      .then(function(raw){ var m=new Spark.SplatMesh({fileBytes:new Uint8Array(unpack(raw)), fileType:"splat", lod:true});
        var up=s.up==="zup"?new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2):new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI);
        m.quaternion.copy(up); m.scale.setScalar(s.scale||1); holder.add(m); holder.scale.setScalar(s.size); mesh=m; placeHere(); return m.initialized; })
      .then(function(){ $("load").style.display="none"; })
      .catch(function(e){ $("load").textContent="Couldn't load the scan."; console.warn(e); }); }
  // set it down a metre and a half in front of where the phone points, a little below eye level
  function placeHere(){ var f=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion); f.y=0; if(f.lengthSq()<1e-4) f.set(0,0,-1); f.normalize();
    holder.position.set(f.x*1.5,-0.45,f.z*1.5); holder.rotation.y=Math.atan2(f.x,f.z); }
  $("place").onclick=placeHere;

  // one finger spins, two fingers pinch to size and drag to move (left/right and nearer/further)
  function gestures(){ var t0=null, el=$("gl");
    function st(e){ var T=e.touches; if(T.length===1) return {n:1, x:T[0].clientX, y:T[0].clientY};
      return {n:2, x:(T[0].clientX+T[1].clientX)/2, y:(T[0].clientY+T[1].clientY)/2, d:Math.hypot(T[0].clientX-T[1].clientX,T[0].clientY-T[1].clientY)}; }
    el.addEventListener("touchstart",function(e){ e.preventDefault(); t0=st(e); },{passive:false});
    el.addEventListener("touchmove",function(e){ e.preventDefault(); var t=st(e); if(!t0||t.n!==t0.n){ t0=t; return; }
      if(t.n===1){ holder.rotation.y+=(t.x-t0.x)*0.01; }
      else { holder.scale.multiplyScalar(t.d/Math.max(1,t0.d));
        var r=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion); r.y=0; r.normalize(); var f=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion); f.y=0; f.normalize();
        holder.position.addScaledVector(r,(t.x-t0.x)*0.004).addScaledVector(f,-(t.y-t0.y)*0.006); }
      t0=t; },{passive:false});
    el.addEventListener("touchend",function(e){ t0=e.touches.length?st(e):null; }); }

  // the photo: this camera frame, cropped the way it's shown, with the scan drawn over it
  function snap(){ if(!renderer) return; renderer.render(scene,camera); var W=renderer.domElement.width, H=renderer.domElement.height, c=document.createElement("canvas"); c.width=W; c.height=H; var g=c.getContext("2d");
    var vw=video.videoWidth, vh=video.videoHeight; if(vw&&vh){ var s=Math.max(W/vw,H/vh), dw=vw*s, dh=vh*s; g.drawImage(video,(W-dw)/2,(H-dh)/2,dw,dh); }
    g.drawImage(renderer.domElement,0,0); var f=$("flash"); f.style.transition="none"; f.style.opacity="0.85"; requestAnimationFrame(function(){ f.style.transition=""; f.style.opacity="0"; });
    c.toBlob(function(b){ shots.push(b); var t=$("thumb"); t.src=URL.createObjectURL(b); t.style.display="block"; },"image/jpeg",0.92); }
  $("snap").onclick=snap;
  // saving: the share sheet (Save Image puts it in Photos); otherwise a download
  function save(){ if(!shots.length){ alert("Take a photo first."); return; } var files=shots.map(function(b,i){ return new File([b],"studium-ar-"+(i+1)+".jpg",{type:"image/jpeg"}); });
    if(navigator.canShare&&navigator.canShare({files:files})){ navigator.share({files:files}).catch(function(){}); return; }
    files.forEach(function(f){ var a=document.createElement("a"); a.href=URL.createObjectURL(f); a.download=f.name; a.click(); }); }
  $("save").onclick=save; $("thumb").onclick=save;
})();
