  // ================= WORLDS: more than one scan, side by side, for the cube and its portals =================
  // When a scan is open, the other bundled scans load quietly in the background into the same 3D space, each set far off
  // where the others can't see it (past the camera's reach). The cube's faces and the portals look into them like any
  // other spot, and walking through a portal simply puts you there. Each world keeps its own way of moving (walking on
  // the Stump's ground, floating round the Fly), its own sky, and its own place name on the photos you take there.
  var WX={worlds:[], here:null, loading:false, home:null, sky:{}};
  var WX_GAP=600;   // how far apart worlds sit, in scene units (beyond the camera's far plane)

  function wxStudioSky(){ var c=document.createElement("canvas"); c.width=8; c.height=256; var g=c.getContext("2d"), gr=g.createLinearGradient(0,0,0,256);
    gr.addColorStop(0,"#a9b2b8"); gr.addColorStop(0.5,"#8c969c"); gr.addColorStop(1,"#5c6469"); g.fillStyle=gr; g.fillRect(0,0,8,256); return c.toDataURL(); }
  function wxTex(url){ if(WX.sky[url]) return WX.sky[url]; var t=new THREE.TextureLoader().load(url); t.generateMipmaps=false; t.minFilter=THREE.LinearFilter; t.magFilter=THREE.LinearFilter; t.wrapS=THREE.RepeatWrapping; return (WX.sky[url]=t); }

  /* the world you're standing in when the scan opens; the others load after it */
  function wxHome(sc){ var s=ptScale(), sj=sc&&sc.subject, home={id:sc&&sc.id||"scan", name:sc&&sc.name||"The scan", off:new THREE.Vector3(0,0,0), walk:!!WK.col, studio:!!(sc&&sc.studio), sc:sc,
      c:new THREE.Vector3(sj?sj[0]:camPos.x, (WK.col?wkGround(sj?sj[0]:camPos.x,sj?sj[1]:camPos.z):camPos.y-1.6*s)+0.7*s, sj?sj[1]:camPos.z), mesh:viewer&&viewer.mesh, ready:true};
    if(sc&&sc.studio){ home.c.set(0,0,0); }
    WX.home=home; WX.here=home; WX.worlds=[home]; WX.saved={mode:WK.mode, bounds:boundsOn}; }
  function wxLoadOthers(){ if(WX.loading||!WX.home||!scene) return; var me=WX.home.id, list=(window.SPLAT_SCENES||[]).filter(function(s){ return s.id!==me&&s.ext==="stm"; }); if(!list.length) return; WX.loading=true;
    var keepScene=scene;
    list.forEach(function(sc,i){ var off=new THREE.Vector3(WX_GAP*(i+1),0,0), w={id:sc.id, name:sc.name, off:off, walk:false, studio:!!sc.studio, sc:sc, c:off.clone().add(new THREE.Vector3(0,1.6,0)), ready:false}; WX.worlds.push(w);
      assetBytes(sc.data).then(function(ab){ return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer(); })
        .then(function(raw){ if(scene!==keepScene) return; var buf=stmUnpack(raw, sceneDetail), m=new SPARK.SplatMesh({fileBytes:new Uint8Array(buf), fileType:"splat"});   /* no level-of-detail tree: a second LoD scan shares the detail budget badly, and these are small enough to draw whole */
          m.quaternion.copy(upQuat(sc.up||"ydown")); m.position.copy(w.c); scene.add(m); w.mesh=m; return m.initialized; })
        .then(function(){ w.ready=!!w.mesh; })
        .catch(function(e){ console.warn("world", sc.id, e); }); }); }

  /* good spots in a world that isn't a walkable scan: round its middle at eye level, plus one from above */
  function wxSpots(w, n){ var s=ptScale(), out=[], C=w.c, views=[[0.6,0,"close up"],[2.2,0,"side on"],[3.6,0,"from behind"],[-1.2,0.55,"from above"],[1.4,-0.25,"from below"],[4.9,0.2,"three-quarter"]];
    for(var i=0;i<n;i++){ var v=views[i%views.length], d=4.4*s, an=v[0], el=v[1], o=new THREE.Object3D();
      o.position.set(C.x+Math.sin(an)*Math.cos(el)*d, C.y+Math.sin(el)*d, C.z+Math.cos(an)*Math.cos(el)*d);
      var M=new THREE.Matrix4().lookAt(o.position, C, UPY); o.quaternion.setFromRotationMatrix(M); o.updateMatrixWorld(true); out.push({o:o, name:w.name+" · "+v[2], world:w.id}); }
    return out; }

  /* which world is this point in */
  function wxAt(p){ var best=WX.home, bd=Infinity; WX.worlds.forEach(function(w){ var d=Math.hypot(p.x-w.c.x,p.z-w.c.z); if(d<bd){ bd=d; best=w; } }); return best; }
  /* every frame: when you've crossed into another world, take on its way of moving, its sky and its name */
  function wxTick(){ if(!WX.home||!loaded) return; var w=wxAt(camPos); if(w===WX.here) return; var was=WX.here; WX.here=w;
    if(w===WX.home){ WK.mode=WX.saved.mode; boundsOn=WX.saved.bounds; }
    else { if(was===WX.home) WX.saved={mode:WK.mode, bounds:boundsOn}; WK.mode="fly"; boundsOn=false; }
    cbPlace=w.name; wxSkyFor(camPos); }
  /* the sky for wherever a camera stands (main view, or a portal or cube pass) */
  function wxSkyFor(p){ if(!WX.home) return; var w=wxAt(p);
    if(typeof SKY==="undefined"||!SKY.mesh) return; var url=w.studio?wxStudioSky.url||(wxStudioSky.url=wxStudioSky()):(w.sc&&w.sc.sky)||null;
    if(!url&&w===WX.home) url=SKY.url; if(!url) return; var t=wxTex(url); if(SKY.mesh.material.uniforms.map.value!==t) SKY.mesh.material.uniforms.map.value=t; SKY.mesh.position.copy(p); }

  if(/[?&]dev/.test(location.search)) window.__wx={ stats:function(){ var P=viewer&&viewer.P; if(!P) return null; var n=P.length/3, st=Math.max(1,Math.floor(n/200000)), ax=[[],[],[]]; for(var i=0;i<n;i+=st){ ax[0].push(P[i*3]); ax[1].push(P[i*3+1]); ax[2].push(P[i*3+2]); }
      return ax.map(function(a){ a.sort(function(x,y){ return x-y; }); return [0.02,0.1,0.5,0.9,0.98].map(function(q){ return +a[Math.floor(q*(a.length-1))].toFixed(2); }); }); },
    mesh:function(){ var m=viewer&&viewer.mesh; return m&&{wm:!!m.worldModifier, wms:m.worldModifiers?m.worldModifiers.length:0, maxSh:m.maxSh, ext:!!m.extSplats, paged:!!m.paged, packed:!!m.packedSplats, lod:!!m.enableLod, n:m.numSplats}; },
    sh:function(n){ var m=viewer.mesh; m.maxSh=n; m.updateGenerator(); },
    place:function(x,y,z,yw,pt){ camPos.set(x,y,z); yaw=yw||0; pitch=pt||0; if(typeof PT!=="undefined") PT.prev=null; },
    state:function(){ return {here:WX.here&&WX.here.id, worlds:WX.worlds.map(function(w){ return {id:w.id, ready:w.ready, c:w.c.toArray().map(function(v){ return +v.toFixed(2); })}; }), mode:WK.mode, bounds:boundsOn, place:cbPlace}; } };
