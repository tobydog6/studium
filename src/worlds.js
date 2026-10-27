  // ================= WORLDS: more than one scan, side by side, for the cube and its portals =================
  // When a scan is open, the other bundled scans load quietly in the background into the same 3D space, each set far off
  // where the others can't see it (past the camera's reach). The cube's faces and the portals look into them like any
  // other spot, and walking through a portal simply puts you there. Each world keeps its own way of moving (walking on
  // the ground where a scan has one, floating where it doesn't), its own sky, and its own place name on the photos you take there.
  var WX={worlds:[], here:null, loading:false, home:null, sky:{}};
  var WX_GAP=600;   // how far apart worlds sit, in scene units (beyond the camera's far plane)

  function wxTex(url){ if(WX.sky[url]) return WX.sky[url]; var t=new THREE.TextureLoader().load(url); t.generateMipmaps=false; t.minFilter=THREE.LinearFilter; t.magFilter=THREE.LinearFilter; t.wrapS=THREE.RepeatWrapping; return (WX.sky[url]=t); }

  /* the world you're standing in when the scan opens; the others load after it */
  function wxHome(sc){ var s=ptScale(), sj=sc&&sc.subject, home={id:sc&&sc.id||"scan", name:sc&&sc.name||"The scan", off:new THREE.Vector3(0,0,0), walk:!!WK.col, sc:sc,
      c:new THREE.Vector3(sj?sj[0]:camPos.x, (WK.col?wkGround(sj?sj[0]:camPos.x,sj?sj[1]:camPos.z):camPos.y-1.6*s)+0.7*s, sj?sj[1]:camPos.z), mesh:viewer&&viewer.mesh, ready:true};
    WX.home=home; WX.here=home; WX.worlds=[home]; WX.loading=false; WX.saved={mode:WK.mode, bounds:boundsOn}; }
  /* the other scans load as light previews (the most solid splats only, no level-of-detail tree), far enough apart
     that they never see each other; big scans ship their own preview */
  function wxMeshPos(w){ return w.off.clone(); }
  function wxLoadOthers(){ if(WX.loading||!WX.home||!scene) return; var me=WX.home.id, list=(window.SPLAT_SCENES||[]).filter(function(s){ return s.id!==me&&(s.preview||s.ext==="stm"); }); if(!list.length) return; WX.loading=true;
    var keepScene=scene;
    list.forEach(function(sc,i){ var off=new THREE.Vector3(WX_GAP*(i+1),0,0), g=sc.ground||0, sj=sc.subject||[0,0], w={id:sc.id, name:sc.name, off:off, walk:!!sc.collide, sc:sc, ready:false};
      w.c=off.clone().add(new THREE.Vector3(sj[0], g+0.7, sj[1])); WX.worlds.push(w);
      assetBytes(sc.preview||sc.data).then(function(ab){ return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer(); })
        .then(function(raw){ if(scene!==keepScene||WX.worlds.indexOf(w)<0) return; var buf=stmUnpack(raw, sc.preview?"full":"light"), m=new SPARK.SplatMesh({fileBytes:new Uint8Array(buf), fileType:"splat"});
          m.quaternion.copy(upQuat(sc.up||"ydown")); m.scale.setScalar(sc.scale||1); m.position.copy(wxMeshPos(w)); m.visible=!!WX.show; scene.add(m); w.mesh=m; wxWatch(true); return m.initialized; })
        .then(function(){ w.ready=!!w.mesh; })
        .catch(function(e){ console.warn("world", sc.id, e); }); }); }

  /* good spots in another world: the scene's own if it lists them, then a ring round the subject at eye level */
  function wxSpots(w, n){ var C=w.c, sc=w.sc||{}, g=sc.ground||0;
    var L=(sc.spots||[]).slice(0,n), compass=["north","north-east","east","south-east","south","south-west","west","north-west"];
      for(var r=L.length;r<n;r++){ var an=r/n*Math.PI*2+0.6; L.push([C.x-w.off.x+Math.sin(an)*3.5, C.z-w.off.z+Math.cos(an)*3.5, 0, "from the "+compass[Math.round(((an*180/Math.PI)%360)/45)%8]]); }
      return L.map(function(p,i){ var o=new THREE.Object3D(); o.position.set(w.off.x+p[0], w.off.y+g+1.6, w.off.z+p[1]);
        var M=new THREE.Matrix4().lookAt(o.position, C, UPY); o.quaternion.setFromRotationMatrix(M); o.updateMatrixWorld(true);
        return {o:o, name:w.name+" · "+(p[3]||"a good spot"), world:w.id}; }); }

  /* the other places are only drawn while you could see them (the cube is up, or a portal is open): the rest of the
     time they'd cost frame rate, and so sharpness, for nothing */
  function wxShowOthers(on){ WX.show=!!on; WX.worlds.forEach(function(w){ if(w!==WX.home&&w.mesh) w.mesh.visible=!!on; }); }
  /* checked every 200 ms only while there's somewhere else to show (other worlds loaded), and stopped with the scan */
  var wxTimer=0;
  function wxWatch(on){ if(on&&!wxTimer) wxTimer=setInterval(function(){ if(!WX.home){ wxWatch(false); return; } var want=(typeof CU!=="undefined"&&CU.open)||(typeof PT!=="undefined"&&PT.on)||WX.here!==WX.home; if(want!==!!WX.show) wxShowOthers(want); }, 200); else if(!on&&wxTimer){ clearInterval(wxTimer); wxTimer=0; } }
  /* the old scan's other worlds: their preview splats go, and the watcher stops */
  function wxDispose(){ wxWatch(false); WX.worlds.forEach(function(w){ if(w!==WX.home&&w.mesh){ if(w.mesh.parent) w.mesh.parent.remove(w.mesh); try{ w.mesh.dispose(); }catch(e){} w.mesh=null; } w.ready=false; });
    WX.worlds=[]; WX.home=null; WX.here=null; WX.show=false; WX.loading=false; }

  /* which world is this point in */
  function wxAt(p){ var best=WX.home, bd=Infinity; WX.worlds.forEach(function(w){ var d=Math.hypot(p.x-w.c.x,p.z-w.c.z); if(d<bd){ bd=d; best=w; } }); return best; }
  /* every frame: when you've crossed into another world, take on its way of moving, its sky and its name */
  function wxTick(){ if(!WX.home||!loaded) return; var w=wxAt(camPos); if(w===WX.here) return; var was=WX.here; WX.here=w;
    if(w===WX.home){ WK.mode=WX.saved.mode; boundsOn=WX.saved.bounds; }
    else { if(was===WX.home) WX.saved={mode:WK.mode, bounds:boundsOn}; WK.mode="fly"; boundsOn=false; }
    cbPlace=w.name; wxSkyFor(camPos);
    /* once you've stepped into another world, it becomes the open scan (full detail, its walk map, the lighting rig):
       the portal closes behind you first, then it loads with you standing exactly where you are */
    if(w!==WX.home&&w.sc&&!WX.switching){ WX.switching=true; setTimeout(function(){ var mp=wxMeshPos(w);
        WX.arrive={x:camPos.x-mp.x, y:camPos.y-mp.y, z:camPos.z-mp.z, yaw:yaw, pitch:pitch}; loadBundled(w.sc); }, 1100); } }
  /* called when a scan finishes opening: arriving from a portal, stand where you were */
  function wxArrival(){ var a=WX.arrive; WX.arrive=null; WX.switching=false; WX.loading=false; if(!a) return false;
    camPos.set(a.x, WK.col?wkGround(a.x,a.z)+WK.eye:a.y, a.z); yaw=a.yaw; pitch=a.pitch; return true; }
  /* the sky for wherever a camera stands (main view, or a portal or cube pass) */
  function wxSkyFor(p){ if(!WX.home) return; var w=wxAt(p);
    if(typeof SKY==="undefined"||!SKY.mesh) return; var url=(w.sc&&w.sc.sky)||null;
    if(!url&&w===WX.home) url=SKY.url; if(!url) return; var t=wxTex(url); if(SKY.mesh.material.uniforms.map.value!==t) SKY.mesh.material.uniforms.map.value=t; SKY.mesh.position.copy(p); }

  if(/[?&]dev/.test(location.search)) window.__wx={ stats:function(){ var P=viewer&&viewer.P; if(!P) return null; var n=P.length/3, st=Math.max(1,Math.floor(n/200000)), ax=[[],[],[]]; for(var i=0;i<n;i+=st){ ax[0].push(P[i*3]); ax[1].push(P[i*3+1]); ax[2].push(P[i*3+2]); }
      return ax.map(function(a){ a.sort(function(x,y){ return x-y; }); return [0.02,0.1,0.5,0.9,0.98].map(function(q){ return +a[Math.floor(q*(a.length-1))].toFixed(2); }); }); },
    mesh:function(){ var m=viewer&&viewer.mesh; return m&&{wm:!!m.worldModifier, wms:m.worldModifiers?m.worldModifiers.length:0, maxSh:m.maxSh, ext:!!m.extSplats, paged:!!m.paged, packed:!!m.packedSplats, lod:!!m.enableLod, n:m.numSplats}; },
    sh:function(n){ var m=viewer.mesh; m.maxSh=n; m.updateGenerator(); },
    place:function(x,y,z,yw,pt){ camPos.set(x,y,z); yaw=yw||0; pitch=pt||0; if(typeof PT!=="undefined") PT.prev=null; },
    state:function(){ return {here:WX.here&&WX.here.id, worlds:WX.worlds.map(function(w){ return {id:w.id, ready:w.ready, c:w.c.toArray().map(function(v){ return +v.toFixed(2); })}; }), mode:WK.mode, bounds:boundsOn, place:cbPlace}; } };
