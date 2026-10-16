  // ================= WALK: solid ground and things you can't walk through =================
  // Each bundled scan can carry a small collision map, worked out from its splats: the ground height on a 10 cm grid
  // and how tall any solid thing (stump, posts, trunks) stands above it. Walk keeps your eyes a set height above
  // the ground and stops you at obstacles (you slide along them); Q and E crouch and stand tall. Fly keeps free
  // movement but you still can't go under the ground or through anything solid.
  var WK={col:null, mode:(function(){ try{ return localStorage.getItem("studium_move")||"walk"; }catch(e){ return "walk"; } })(), eye:1.6, r:0.22, toastT:0};
  var WK_EYE_MIN=0.3, WK_EYE_MAX=2.4, WK_STEP=0.3;
  function wkLoad(b64){ WK.col=null; if(!b64) return Promise.resolve();
    return fetch("data:application/octet-stream;base64,"+b64).then(function(r){ return r.arrayBuffer(); })
      .then(function(ab){ return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer(); })
      .then(function(buf){ var dv=new DataView(buf), nx=dv.getInt32(20,true), nz=dv.getInt32(24,true);
        WK.col={x0:dv.getFloat32(4,true), z0:dv.getFloat32(8,true), cell:dv.getFloat32(12,true), plane:dv.getFloat32(16,true), nx:nx, nz:nz,
          g:new Int16Array(buf,28,nx*nz), t:new Uint8Array(buf,28+nx*nz*2,nx*nz)}; })
      .catch(function(e){ console.warn("collision map", e); WK.col=null; }); }
  function wkG(ix,iz){ var C=WK.col; ix=Math.max(0,Math.min(C.nx-1,ix)); iz=Math.max(0,Math.min(C.nz-1,iz)); return C.g[iz*C.nx+ix]/1000; }
  function wkGround(x,z){ var C=WK.col; if(!C) return -1e9; var fx=(x-C.x0)/C.cell-0.5, fz=(z-C.z0)/C.cell-0.5;
    if(fx<-2||fz<-2||fx>C.nx+1||fz>C.nz+1) return C.plane;
    var ix=Math.floor(fx), iz=Math.floor(fz), tx=fx-ix, tz=fz-iz;
    return (wkG(ix,iz)*(1-tx)+wkG(ix+1,iz)*tx)*(1-tz)+(wkG(ix,iz+1)*(1-tx)+wkG(ix+1,iz+1)*tx)*tz; }
  function wkTop(x,z){ var C=WK.col, ix=Math.floor((x-C.x0)/C.cell), iz=Math.floor((z-C.z0)/C.cell);
    if(ix<0||iz<0||ix>=C.nx||iz>=C.nz) return 0; var t=C.t[iz*C.nx+ix]; return t?C.g[iz*C.nx+ix]/1000+t*0.02:0; }
  // is a body at (x,z), standing on `feet`, inside something solid?
  function wkBlocked(x,z,feet){ var r=WK.r;
    for(var a=0;a<9;a++){ var sx=x, sz=z; if(a){ var an=(a-1)*Math.PI/4; sx+=Math.cos(an)*r; sz+=Math.sin(an)*r; }
      var top=wkTop(sx,sz); if(top&&top>feet+WK_STEP) return true; }
    return false; }
  function wkFeet(){ return WK.mode==="walk"?wkGround(camPos.x,camPos.z):camPos.y-0.15; }
  // move by velocity * dt, sliding along anything solid
  function wkMove(dt){ var nx=camPos.x+_vel.x*dt, nz=camPos.z+_vel.z*dt, feet=wkFeet(), stuck=wkBlocked(camPos.x,camPos.z,feet);
    if(stuck||!wkBlocked(nx,nz,feet)){ camPos.x=nx; camPos.z=nz; }
    else if(!wkBlocked(nx,camPos.z,feet)){ camPos.x=nx; _vel.z=0; }
    else if(!wkBlocked(camPos.x,nz,feet)){ camPos.z=nz; _vel.x=0; }
    else { _vel.x=0; _vel.z=0; }
    if(WK.mode==="fly"){ camPos.y+=_vel.y*dt; var gmin=wkGround(camPos.x,camPos.z)+0.15; if(camPos.y<gmin){ camPos.y=gmin; _vel.y=0; } } }
  function wkSettle(dt){ if(!WK.col||WK.mode!=="walk") return; var tgt=wkGround(camPos.x,camPos.z)+WK.eye; camPos.y+=(tgt-camPos.y)*(1-Math.exp(-10*Math.min(dt,0.05))); }
  function wkEye(d, dt){ var e=Math.max(WK_EYE_MIN,Math.min(WK_EYE_MAX,WK.eye+d*dt*0.9)); if(e===WK.eye) return; WK.eye=e;
    var now=performance.now(); if(now-WK.toastT>500){ WK.toastT=now; toast(e<0.7?"Crouching · eyes "+e.toFixed(1)+" m":e>1.9?"Standing tall · eyes "+e.toFixed(1)+" m":"Eyes "+e.toFixed(1)+" m off the ground"); } }
  // start a little back from the subject, on open ground, looking at it
  function wkSpawn(center){ if(!WK.col) return; var best=null;
    for(var d=3;d<=7&&!best;d+=0.5) for(var a=0;a<16;a++){ var an=a/16*Math.PI*2, x=center.x+Math.sin(an)*d, z=center.z+Math.cos(an)*d, g=wkGround(x,z);
      if(!wkBlocked(x,z,g)&&!wkBlocked(x,z,g-0.5)){ best={x:x,z:z,an:an}; break; } }
    if(!best) return; camPos.x=best.x; camPos.z=best.z; camPos.y=wkGround(best.x,best.z)+(WK.mode==="walk"?WK.eye:1.6); yaw=best.an; pitch=-0.12; }
  function wkSetMode(m){ WK.mode=m; try{ localStorage.setItem("studium_move",m); }catch(e){} _vel.set(0,0,0); }
  if(/[?&]dev/.test(location.search)) window.__wk={ pos:function(){ return {x:camPos.x, y:camPos.y, z:camPos.z, yaw:yaw, mode:WK.mode, eye:WK.eye, col:!!WK.col, ground:WK.col?wkGround(camPos.x,camPos.z):null}; },
    top:function(x,z){ return wkTop(x,z); }, setPos:function(x,z,yw){ camPos.x=x; camPos.z=z; if(yw!=null) yaw=yw; _vel.set(0,0,0); }, mode:wkSetMode };
