  // ================= WEATHER: rain, wind, fog and wet ground, live on the graphics card =================
  // Rain is its own little splat cloud (Spark sorts it in with the scan, so drops pass in front of and behind things
  // properly). Each drop is a thin splat stretched along the way it falls, and the stretch is how far a drop falls while
  // the shutter is open: 1/1000 freezes beads in the air, 1/30 drags them into streaks. That's the lesson.
  // Wind, fog and wet ground are one Spark object modifier on the scan: trees bend from the root and leaves flutter; flat upward
  // surfaces darken and catch a sheen; everything fades to grey with distance in fog; rain or fog greys the light.
  var WE={field:null, rain:0, wind:0, fog:0,   /* clear and still by default: wind and fog are the scan's biggest costs */ mesh:null, U:null, scanU:null, scanMeshes:[], t0:performance.now(), lastCam:null, dirty:true, snd:null, sndT:0};
  var WE_LV=["Off","Light","Heavy"], WE_DROPS=22000, WE_SPLASH=2400;
  var WE_ITEMS=[["rain","Rain","5"],["wind","Wind","6"],["fog","Fog","7"]];
  var WE_ICON={
    rain:'<svg viewBox="0 0 24 24"><path d="M7 14.5a4 4 0 0 1 .4-8 5 5 0 0 1 9.6 1.3 3.4 3.4 0 0 1-.6 6.7Z"/><path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/></svg>',
    wind:'<svg viewBox="0 0 24 24"><path d="M3 9h11.5a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 13h15.5a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 17h7"/></svg>',
    fog:'<svg viewBox="0 0 24 24"><path d="M4 8h16M3 12h18M5 16h14M8 20h8"/></svg>'};
  function weAny(){ return WE.rain>0||WE.wind>0||WE.fog>0; }
  function weState(){ return {rain:WE.rain, wind:WE.wind, fog:WE.fog}; }
  function weAmt(k){ return k<=0?0:k<=1?0.45*k:0.45+0.55*Math.min(1,k-1); }   /* levels 0, 1, 2; in between too, so weather can creep in and out */
  function weSet(k, lv){ WE[k]=Math.max(0,Math.min(2,lv|0)); WE.dirty=true; if(typeof sfx==="function") sfx("toggle"); weKitMark(); }
  function weCycle(k){ weSet(k, (WE[k]+1)%3); }
  function weS(){ return typeof rlScale==="function"?rlScale():1; }
  function weGround(){ var g=typeof rlGround==="function"?rlGround(camPos.x,camPos.z):camPos.y-1.6; return isFinite(g)?g:camPos.y-1.6; }
  /* how long the shutter is open for what you're seeing: the real setting through the camera, about 1/60 for your eyes */
  function weShutter(){ return viewfinderOn&&typeof SHUTTERS!=="undefined"?SHUTTERS[shIdx]:1/60; }
  function weWindDir(){ var a=0.7; return [Math.sin(a), Math.cos(a)]; }

  var WE_GLSL=[
    "vec3 weRot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }",
    "vec3 weRotInv(vec4 q, vec3 v){ return weRot(vec4(-q.xyz,q.w), v); }",
    "float weH(float n){ return fract(sin(n*12.9898)*43758.5453); }",
    "vec4 weFromY(vec3 d){ vec3 a=cross(vec3(0.0,1.0,0.0),d); float w=1.0+d.y; if(w<1e-4) return vec4(1.0,0.0,0.0,0.0); return normalize(vec4(a,w)); }"].join("\n");

  // ---- the rain: drops on a world-anchored lattice, wrapped into a box that follows you ----
  // Plain three.js, not splats: one instanced draw of thin camera-facing streaks, worked out entirely on the graphics
  // card from the time and a random seed each. Nothing about the scan changes, so Spark never re-sorts for the rain.
  // Splats don't write depth, so a drop checks it isn't behind something solid by stepping through the wind map's
  // solidity on its way to your eye (a few texture reads per drop).
  var WE_RAIN_VS=[
    "precision highp float; precision highp sampler3D;",
    "uniform float t, amt, len, th, al, S, gy, pxk, fok; uniform vec3 cam, box, vel, fo, finv; uniform sampler3D fld;",
    "attribute vec4 seed; varying vec2 vq; varying float va; varying float vk;",
    "float weH(float n){ return fract(sin(n*12.9898)*43758.5453); }",
    "void hide(){ gl_Position=vec4(2.0,2.0,2.0,1.0); va=0.0; }",
    "void main(){ vq=position.xy; vk=seed.w>=1.0?1.0:0.0; float h=fract(seed.w); if(h>=amt){ hide(); return; }",
    "  vec3 org=vec3(cam.x-box.x*0.5, gy, cam.z-box.z*0.5); vec3 p; float a;",
    "  if(vk<0.5){",
    "    vec3 q=seed.xyz*box+vel*t*(0.85+0.3*h); p=org+mod(q-org,box);",
    "    vec2 e=min(p.xz-org.xz, org.xz+box.xz-p.xz)/(box.xz*0.18); a=al*clamp(min(e.x,e.y),0.0,1.0)*clamp((gy+box.y-p.y)/(box.y*0.2),0.0,1.0);",
    "    a*=smoothstep(0.45*S,1.3*S,length(p-cam));",
    "  } else {",
    "    float rate=2.6+1.4*h; float ph=fract(t*rate+h*7.0); float cyc=floor(t*rate+h*7.0);",
    "    vec2 xz=fract(seed.xz+vec2(weH(cyc+seed.y*31.0),weH(cyc*1.7+seed.y*17.0)));",
    "    p=vec3(org.x+(0.15+0.7*xz.x)*box.x, gy+0.006*S, org.z+(0.15+0.7*xz.y)*box.z);",
    "    a=ph<0.22?(1.0-ph/0.22)*0.45*al:0.0; vq=vec2(position.x, position.y*2.0-1.0);",
    "    a*=smoothstep(0.6*S,1.5*S,length(p-cam));",
    "  }",
    "  if(a<0.004){ hide(); return; }",
    /* behind something solid? step through the solidity on the way to the eye */
    "  float dc=length(cam-p); if(fok>0.5&&dc>1.2*S){ float oc=0.0, f1=1.0-0.7*S/dc; for(int i=0;i<7;i++){ vec3 s=mix(p,cam,mix(0.12,f1,(float(i)+0.5)/7.0)); vec3 uv=(s-fo)*finv; if(all(greaterThanEqual(uv,vec3(0.0)))&&all(lessThanEqual(uv,vec3(1.0)))) oc+=texture(fld,uv).b; }",   /* skip the air right round the drop and round you (grass at your feet is not a wall) */
    "    a*=clamp(1.0-(oc-1.2)/1.0,0.0,1.0); if(a<0.004){ hide(); return; } }",
    "  if(vk<0.5){",
    "    vec3 dir=normalize(vel); vec4 A=viewMatrix*vec4(p-dir*len*0.5,1.0), B=viewMatrix*vec4(p+dir*len*0.5,1.0);",
    "    float dep=-mix(A.z,B.z,0.5); if(dep<0.05){ hide(); return; }",
    "    float w=max(th, dep*pxk*0.75); a*=sqrt(th/w);",   /* a far drop is drawn a pixel wide, so it's fainter */
    "    vec2 d2=B.xy-A.xy; float dl=length(d2); vec2 dd=dl>1e-6?d2/dl:vec2(0.0,1.0); vec2 sd=vec2(-dd.y,dd.x);",
    "    vec3 P=mix(A.xyz,B.xyz,position.y)+vec3(sd*position.x*w*1.6+dd*(position.y-0.5)*2.0*w,0.0);",
    "    gl_Position=projectionMatrix*vec4(P,1.0);",
    "  } else {",
    "    float r=(0.012+0.05*fract(t*(2.6+1.4*h)+h*7.0))*S;",
    "    gl_Position=projectionMatrix*viewMatrix*vec4(p+vec3(position.x*r,0.0,(position.y*2.0-1.0)*r),1.0);",
    "  }",
    "  va=a; }"].join("\n");
  var WE_RAIN_FS=[
    "precision highp float; uniform float lit; varying vec2 vq; varying float va; varying float vk;",
    "void main(){ float a;",
    "  if(vk<0.5){ a=va*exp(-vq.x*vq.x*2.2)*smoothstep(0.0,0.12,vq.y)*(1.0-smoothstep(0.88,1.0,vq.y)); }",
    "  else { float d=length(vq); a=va*(1.0-smoothstep(0.7,1.0,d))*smoothstep(0.35,0.85,d); }",
    "  if(a<0.003) discard; gl_FragColor=vec4(vec3(0.8,0.84,0.89)*lit, a); }"].join("\n");
  function weRainBuild(){ var n=WE_DROPS+WE_SPLASH, g=new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1,0,0, 1,0,0, 1,1,0, -1,1,0]),3)); g.setIndex([0,1,2, 0,2,3]);
    var sd=new Float32Array(n*4); for(var i=0;i<n;i++){ sd[i*4]=Math.random(); sd[i*4+1]=Math.random(); sd[i*4+2]=Math.random(); sd[i*4+3]=(i<WE_DROPS?0:1)+Math.random()*0.999; }
    g.setAttribute("seed", new THREE.InstancedBufferAttribute(sd,4)); g.instanceCount=n;
    var dummy=new THREE.Data3DTexture(new Uint8Array(4),1,1,1); dummy.format=THREE.RGBAFormat; dummy.type=THREE.UnsignedByteType; dummy.needsUpdate=true;
    var u={t:{value:0}, amt:{value:0}, len:{value:0.1}, th:{value:0.002}, al:{value:0.5}, S:{value:1}, gy:{value:0}, pxk:{value:0.001}, fok:{value:0}, lit:{value:1},
      cam:{value:new THREE.Vector3()}, box:{value:new THREE.Vector3(11,6,11)}, vel:{value:new THREE.Vector3(0,-8,0)}, fo:{value:new THREE.Vector3()}, finv:{value:new THREE.Vector3(1,1,1)}, fld:{value:dummy}};
    var m=new THREE.ShaderMaterial({uniforms:u, vertexShader:WE_RAIN_VS, fragmentShader:WE_RAIN_FS, transparent:true, depthWrite:false, depthTest:false, side:THREE.DoubleSide});   /* splats write no depth anyway; the solidity check does the hiding */
    var mesh=new THREE.Mesh(g,m); mesh.frustumCulled=false; mesh.renderOrder=20; WE.mesh=mesh; WE.U=u; }

  // ---- what bends in the wind: a map of the scan, worked out once from its own splats ----
  // A 3D grid over the place. Each cell says how much it bends (trees: nothing at the root, more and more up the trunk
  // into the canopy, so a whole tree leans together) and how much it flutters (leaves and grass). Solid things stay put:
  // a cell inside a wall, a fence post, the stump or the ground is dense across a wide neighbourhood, while a branch is a
  // thin thing with air all round it. Leafiness comes from each splat's colour (green over red and blue).
  // Worked out a little at a time in idle moments after the scan opens (no slice over ~8 ms), so turning wind or rain on
  // never freezes the page. Turned on before it's ready, the wind fades in once it is.
  var WE_BUDGET=6;   /* aim under 8 ms a slice, with room for the odd overrun */
  /* a box blur, one axis at a time, resumable: J holds where it got to */
  function weBlurJob(src, nx, ny, nz, r){ var J={a:src, b:null, d:0, line:0, out:null, done:false};
    if(r<1){ J.out=src.slice(); J.done=true; return J; }
    J.step=function(dl){ if(!J.b){ J.a=src.slice(); J.b=new Float32Array(src.length); if(performance.now()>dl) return false; }   /* the copies are made in their own slice */
      var st=[1,nx,nx*ny], ln=[nx,ny,nz], w=1/(2*r+1), a=J.a, b=J.b;
      while(J.d<3){ var d=J.d, s=st[d], L=ln[d], o=[nx,ny,nz]; o[d]=1; var lines=o[0]*o[1]*o[2];
        while(J.line<lines){ var li=J.line++, x=li%o[0], y=((li/o[0])|0)%o[1], z=(li/(o[0]*o[1]))|0, base=(z*ny+y)*nx+x, acc=0, k;
          for(k=-r;k<=r;k++){ var q=Math.max(0,Math.min(L-1,k)); acc+=a[base+q*s]; }
          for(k=0;k<L;k++){ b[base+k*s]=acc*w; var qa=Math.min(L-1,k+r+1), qr=Math.max(0,k-r); acc+=a[base+qa*s]-a[base+qr*s]; }
          if((li&15)===0&&performance.now()>dl) return false; }
        var t=J.a; J.a=J.b; J.b=t; a=J.a; b=J.b; J.d++; J.line=0; }
      J.out=J.a; J.b=null; J.done=true; return true; };
    return J; }
  /* the p-th value of the positive entries, from a log-spaced histogram (no big sort on the main thread) */
  function wePctJob(arr, p){ var J={i:0, ph:0, lo:Infinity, hi:0, h:null, n:0, out:1, done:false}, st=Math.max(1,Math.floor(arr.length/200000)), B=4096;
    J.step=function(dl){ var i, v;
      if(J.ph===0){ for(i=J.i;i<arr.length;i+=st){ v=arr[i]; if(v>0){ if(v<J.lo) J.lo=v; if(v>J.hi) J.hi=v; } if(((i/st)&4095)===0&&performance.now()>dl){ J.i=i+st; return false; } }
        if(!(J.hi>0)){ J.out=1; J.done=true; return true; } J.ph=1; J.i=0; J.h=new Float64Array(B); J.l0=Math.log(J.lo); J.lr=Math.max(1e-9,Math.log(J.hi)-J.l0); }
      if(J.ph===1){ var h=J.h; for(i=J.i;i<arr.length;i+=st){ v=arr[i]; if(v>0){ h[Math.min(B-1,((Math.log(v)-J.l0)/J.lr*B)|0)]++; J.n++; } if(((i/st)&4095)===0&&performance.now()>dl){ J.i=i+st; return false; } }
        var tgt=J.n*p, acc=0; for(var k=0;k<B;k++){ acc+=h[k]; if(acc>tgt){ J.out=Math.exp(J.l0+(k+0.5)/B*J.lr); break; } } if(acc<=tgt) J.out=J.hi; J.out=J.out||1; J.done=true; return true; }
      return true; };
    return J; }
  /* the whole map, as a list of resumable stages; the last one hands over the texture */
  function weFieldJob(){ var P=viewer&&viewer.P; if(!P) return null;
    var A=viewer.A, G=viewer.Gr, N=P.length/3, S=weS(), V={}, J={P:P, k:0, done:false, field:null};
    var stages=[
      /* the box: almost everything (the treeline at the edge is what should move most), not the walls' tight 2 to 98%; from a histogram per axis */
      function(dl){ if(!V.bx){ V.bx={ax:0, i:0, st:Math.max(1,Math.floor(N/150000)), mn:[Infinity,Infinity,Infinity], mx:[-Infinity,-Infinity,-Infinity], ph:0}; } var X=V.bx, i;
        if(X.ph===0){ for(i=X.i;i<N;i+=X.st){ for(var a=0;a<3;a++){ var v=P[i*3+a]; if(v<X.mn[a]) X.mn[a]=v; if(v>X.mx[a]) X.mx[a]=v; } if(((i/X.st)&1023)===0&&performance.now()>dl){ X.i=i+X.st; return false; } }
          X.ph=1; X.i=0; X.H=[new Float64Array(16384),new Float64Array(16384),new Float64Array(16384)]; X.n=0; }
        for(i=X.i;i<N;i+=X.st){ for(var b=0;b<3;b++){ var r=(X.mx[b]-X.mn[b])||1; X.H[b][Math.min(16383,((P[i*3+b]-X.mn[b])/r*16384)|0)]++; } X.n++; if(((i/X.st)&1023)===0&&performance.now()>dl){ X.i=i+X.st; return false; } }
        var lo=[0,0,0], hi=[0,0,0]; for(var c=0;c<3;c++){ var H=X.H[c], rr=(X.mx[c]-X.mn[c])||1, acc=0, k, tl=X.n*0.004, th=X.n*0.996; lo[c]=X.mn[c]; hi[c]=X.mx[c];
          for(k=0;k<16384;k++){ acc+=H[k]; if(acc>tl){ lo[c]=X.mn[c]+k/16384*rr; break; } } acc=0; for(k=0;k<16384;k++){ acc+=H[k]; if(acc>=th){ hi[c]=X.mn[c]+(k+1)/16384*rr; break; } } }
        var pad=0.4*S; for(c=0;c<3;c++){ lo[c]-=pad; hi[c]+=pad; }
        var ex=hi[0]-lo[0], ey=hi[1]-lo[1], ez=hi[2]-lo[2], cell=Math.max(Math.cbrt(ex*ey*ez/1.6e6), Math.max(ex,ey,ez)/256, 0.08*S);
        V.lo=lo; V.pad=pad; V.cell=cell; V.nx=Math.max(2,Math.ceil(ex/cell)); V.ny=Math.max(2,Math.ceil(ey/cell)); V.nz=Math.max(2,Math.ceil(ez/cell)); V.M=V.nx*V.ny*V.nz;
        V.i=0; return true; },
      /* every splat into its cell: how much is there, and how green */
      function(dl){ if(!V.occ){ V.occ=new Float32Array(V.M); V.grn=new Float32Array(V.M); return false; }   /* the grids get their own slice */
        var lo=V.lo, cell=V.cell, nx=V.nx, ny=V.ny, nz=V.nz, occ=V.occ, grn=V.grn;
        for(var i=V.i;i<N;i++){ var a=A?A[i]:1; if(a>=0.05){ var gx=((P[i*3]-lo[0])/cell)|0, gy=((P[i*3+1]-lo[1])/cell)|0, gz=((P[i*3+2]-lo[2])/cell)|0;
            if(gx>=0&&gy>=0&&gz>=0&&gx<nx&&gy<ny&&gz<nz){ var c=(gz*ny+gy)*nx+gx; occ[c]+=a; if(G) grn[c]+=a*G[i]/255; } }
          if((i&2047)===0&&performance.now()>dl){ V.i=i+1; return false; } }
        V.b1=weBlurJob(V.occ,V.nx,V.ny,V.nz,1); V.b2=weBlurJob(V.grn,V.nx,V.ny,V.nz,1); V.b3=weBlurJob(V.occ,V.nx,V.ny,V.nz,Math.max(2,Math.round(0.6*S/V.cell))); return true; },
      function(dl){ return V.b1.done||V.b1.step(dl); },
      function(dl){ return V.b2.done||V.b2.step(dl); },
      function(dl){ if(V.b3.done||V.b3.step(dl)){ V.occL=V.b1.out; V.grnL=V.b2.out; V.occW=V.b3.out; V.occ=V.grn=null; V.p1=wePctJob(V.occL,0.85); V.p2=wePctJob(V.occW,0.85); return true; } return false; },
      function(dl){ return V.p1.done||V.p1.step(dl); },
      function(dl){ if(V.p2.done||V.p2.step(dl)){ V.mL=V.p1.out; V.mW=V.p2.out; V.out=new Uint8Array(V.M*4); V.col=0; return true; } return false; },
      /* each column of cells: how much it bends and flutters */
      function(dl){ var nx=V.nx, ny=V.ny, nz=V.nz, lo=V.lo, cell=V.cell, pad=V.pad, occL=V.occL, grnL=V.grnL, occW=V.occW, mL=V.mL, mW=V.mW, out=V.out, y;
        for(var cc=V.col;cc<nx*nz;cc++){ var x=cc%nx, z=(cc/nx)|0, wx=lo[0]+(x+0.5)*cell, wz=lo[2]+(z+0.5)*cell, g=WK.col&&typeof wkGround==="function"?wkGround(wx,wz):NaN;
          if(!(g>-1e8&&g<1e8)){ g=lo[1]+pad; for(y=0;y<ny;y++){ if(occL[(z*ny+y)*nx+x]>0.15*mL){ g=lo[1]+(y+0.5)*cell; break; } } }   /* no walk map: the lowest solid thing in the column is the ground */
          for(y=0;y<ny;y++){ var ci=(z*ny+y)*nx+x, h=(lo[1]+(y+0.5)*cell-g)/S;
            var solidW=Math.min(1,occW[ci]/mW), solidL=Math.min(1,occL[ci]/mL), gf=occL[ci]>1e-6?grnL[ci]/occL[ci]:0;
            var hf=Math.pow(Math.max(0,Math.min(1,(h-0.3)/6)),1.2);   /* rooted: nothing at the ground, most at the top of a tall tree */
            var leafy=Math.max(0,Math.min(1,(gf-0.04)/0.2));
            var rigid=Math.pow(solidW,1.5)*(1-leafy);   /* a wall or a post is dense all round and not leafy; a thick canopy is dense but leafy, so it still moves */
            var bend=hf*(1-0.9*rigid);
            var flut=leafy*(1-0.4*solidL)+0.45*hf*(1-0.5*solidL);   /* leaves and grass, and bare twigs up high */
            flut*=0.35+0.65*Math.max(0,Math.min(1,(h-0.4)/1.6));   /* low things (ivy on a stump, grass) only shiver; it builds up into the canopy */
            flut*=1-0.6*solidW;   /* stuck to something solid */
            if(h<0.03) flut*=0.2;
            out[ci*4]=Math.round(Math.max(0,Math.min(1,bend))*255); out[ci*4+1]=Math.round(Math.max(0,Math.min(1,flut))*255); out[ci*4+2]=Math.round(Math.min(1,Math.max(0,(solidL-0.25)/0.6))*255); }   /* blue: how solid, so rain can tell it's behind the stump */
          if((cc&3)===0&&performance.now()>dl){ V.col=cc+1; return false; } }
        var nx2=V.nx, ny2=V.ny, nz2=V.nz, tex=new THREE.Data3DTexture(out,nx2,ny2,nz2); tex.format=THREE.RGBAFormat; tex.type=THREE.UnsignedByteType; tex.minFilter=tex.magFilter=THREE.LinearFilter;
        tex.wrapS=tex.wrapT=tex.wrapR=THREE.ClampToEdgeWrapping; tex.unpackAlignment=1; tex.needsUpdate=true;
        J.field={P:P, tex:tex, out:out, nx:nx2, ny:ny2, nz:nz2, cell:cell, lo:lo, o:new THREE.Vector3(lo[0],lo[1],lo[2]), inv:new THREE.Vector3(1/(nx2*cell),1/(ny2*cell),1/(nz2*cell))}; V=null; return true; }];
    J.step=function(dl){ while(J.k<stages.length){ if(!stages[J.k](dl)) return false; J.k++; if(performance.now()>dl&&J.k<stages.length) return false; } J.done=true; return true; };
    return J; }
  function weFieldReady(){ return !!(WE.field&&viewer&&WE.field.P===viewer.P); }
  function weFieldDone(J){ if(WE.job!==J) return; WE.job=null; if(!J.field) return; if(WE.field&&WE.field.tex) try{ WE.field.tex.dispose(); }catch(e){} WE.field=J.field; WE.fieldT=performance.now(); WE.dirty=true; }
  /* run the job in slices: in idle time normally, sooner (every task, still in slices) once you've asked for wind or rain */
  function weFieldPump(){ WE.pumpOn=false; var J=WE.job; if(!J||!viewer||J.P!==viewer.P){ if(J) WE.job=null; return; }
    var go=function(dl){ WE.pumpOn=false; if(WE.job!==J) return; var ok=false; try{ ok=J.step(dl); }catch(e){ console.warn("wind field",e); WE.job=null; WE.fieldFail=J.P; return; } if(ok) weFieldDone(J); else weFieldPump(); };
    WE.pumpOn=true; var want=WE.wind>0||WE.rain>0;
    if(!want&&typeof requestIdleCallback==="function") requestIdleCallback(function(d){ go(performance.now()+Math.max(2,Math.min(WE_BUDGET,d.timeRemaining()))); },{timeout:1500});
    else setTimeout(function(){ go(performance.now()+WE_BUDGET); }, want?0:30); }
  function weFieldStart(){ if(WE.job||weFieldReady()||!viewer||!viewer.P||WE.fieldFail===viewer.P) return; WE.job=weFieldJob(); if(WE.job) weFieldPump(); }
  /* sync, for the dev tools only: finish it now */
  function weField(){ if(weFieldReady()) return WE.field; var J=WE.job&&WE.job.P===(viewer&&viewer.P)?WE.job:weFieldJob(); if(!J) return null; WE.job=J; J.step(Infinity); weFieldDone(J); return WE.field; }
  /* a new scan: drop the old map, its texture and any half-made one */
  function weForget(){ WE.job=null; WE.fieldFail=null; if(WE.field&&WE.field.tex) try{ WE.field.tex.dispose(); }catch(e){} WE.field=null; WE.scanMeshes=[]; WE.lastCam=null; WE.dirty=true;
    if(WE.scanU) WE.scanU.fok.value=0; if(WE.U) WE.U.fok.value=0; if(WE.mesh&&WE.mesh.parent) WE.mesh.parent.remove(WE.mesh); }

  // ---- wind, wet and fog on the scan ----
  function weScanMod(){ var D=SPARK.dyno, U=WE.scanU;
    if(!U){ U=WE.scanU={}; var dummy=new THREE.Data3DTexture(new Uint8Array(4),1,1,1); dummy.format=THREE.RGBAFormat; dummy.type=THREE.UnsignedByteType; dummy.needsUpdate=true;
      U.on=D.dynoFloat(0); U.t=D.dynoFloat(0); U.wind=D.dynoVec3(new THREE.Vector3()); U.wet=D.dynoFloat(0); U.fog=D.dynoFloat(0); U.ovc=D.dynoFloat(0);
      U.cam=D.dynoVec3(new THREE.Vector3()); U.q=D.dynoVec4(new THREE.Vector4(0,0,0,1)); U.s=D.dynoFloat(1); U.S=D.dynoFloat(1); U.fc=D.dynoVec3(new THREE.Vector3(0.7,0.72,0.74));
      U.fok=D.dynoFloat(0); U.dbg=D.dynoFloat(0); U.fld=D.dynoSampler3D(dummy); U.fo=D.dynoVec3(new THREE.Vector3()); U.finv=D.dynoVec3(new THREE.Vector3(1,1,1)); }
    var types={gsplat:D.Gsplat, on:"float", t:"float", wind:"vec3", wet:"float", fog:"float", ovc:"float", cam:"vec3", q:"vec4", s:"float", S:"float", fc:"vec3", fok:"float", dbg:"float", fld:"sampler3D", fo:"vec3", finv:"vec3"};
    return D.dynoBlock({gsplat:D.Gsplat},{gsplat:D.Gsplat},function(io){ var ins={gsplat:io.gsplat}; for(var k in U) ins[k]=U[k];
      var dd=D.dyno({inTypes:types, outTypes:{gsplat:D.Gsplat}, inputs:ins, globals:function(){ return ["precision highp sampler3D;", WE_GLSL]; },
        statements:function(c){ var i=c.inputs, o=c.outputs.gsplat; return [
          o+" = "+i.gsplat+";",
          "if("+i.on+">0.5 && isGsplatActive("+o+".flags)){",
          "  vec3 cw=weRot("+i.q+", "+o+".center*"+i.s+"); vec3 col="+o+".rgba.rgb; vec3 sc=abs("+o+".scales)*"+i.s+";",
          "  float mx=max(sc.x,max(sc.y,sc.z)), mn=min(sc.x,min(sc.y,sc.z)), md=sc.x+sc.y+sc.z-mn-mx;",
          "  float ws=length("+i.wind+");",
          "  if(ws>0.0 && "+i.fok+">0.5){ vec3 uv=(cw-"+i.fo+")*"+i.finv+";",
          "    if(all(greaterThanEqual(uv,vec3(0.0)))&&all(lessThanEqual(uv,vec3(1.0)))){ vec2 fl=texture("+i.fld+",uv).rg; float S="+i.S+";",
          "      vec3 wd="+i.wind+"/ws; vec3 pp=vec3(-wd.z,0.0,wd.x); float tt="+i.t+";",
          /* gusts roll across the place downwind, so neighbouring trees move together, then the next ones */
          "      float ph=dot(cw.xz,wd.xz)/(7.0*S)-tt*0.32; float g1=sin(ph*6.2832), g2=sin(ph*14.1+1.7+cw.x*0.07/S+cw.z*0.05/S);",
          "      float gust=clamp(0.55+0.3*g1+0.15*g2,0.0,1.0);",
          "      float lean=0.4+0.6*gust; float rock=sin(tt*0.95+dot(cw.xz,vec2(0.11,0.17))/S)*0.35+sin(tt*1.7+cw.z*0.23/S)*0.15;",
          "      float Ab=fl.r*ws*0.42*S; vec3 dw=wd*Ab*(lean+rock*0.6)+pp*Ab*0.22*sin(tt*0.8+cw.x*0.3/S);",
          "      dw.y-=0.18*Ab*lean*fl.r;",   /* a bent tree drops its top a little */
          /* flutter: each splat on its own quick little path, harder in a gust */
          "      if(fl.g>0.004){ float h1=weH(dot("+o+".center,vec3(12.7,31.1,7.4))), h2=weH(h1*91.7+3.1), h3=weH(h2*57.3+1.9);",
          "        vec3 rd=normalize(vec3(h1-0.5,(h2-0.5)*0.6,h3-0.5)+wd*0.3); float fr=5.0+5.0*h1;",
          "        float fa=fl.g*ws*(0.008+0.022*gust)*S*(1.0-smoothstep(0.03*S,0.25*S,mx));",
          "        dw+=rd*fa*sin(tt*fr+h2*6.2832)+wd*fl.g*ws*0.012*S*gust; }",
          "      if("+i.dbg+">0.5) col=vec3(fl.r,fl.g,0.15);",   /* dev: see the map, red bends and green flutters */
          "      "+o+".center+=weRotInv("+i.q+",dw)/"+i.s+"; } }",
          /* wet: flat surfaces facing up go dark and rich, and catch the sky at a low angle */
          "  if("+i.wet+">0.0){ int k=(sc.x<=sc.y&&sc.x<=sc.z)?0:((sc.y<=sc.z)?1:2); vec3 ax=k==0?vec3(1.0,0.0,0.0):(k==1?vec3(0.0,1.0,0.0):vec3(0.0,0.0,1.0));",
          "    vec3 n=normalize(weRot("+i.q+",weRot("+o+".quaternion,ax))); float fl2=clamp(1.0-mn/max(md,1e-6)*1.4,0.0,1.0);",
          "    float upf=smoothstep(0.45,0.9,abs(n.y))*fl2; float wk="+i.wet+"*(0.35+0.65*upf);",
          "    float lum=dot(col,vec3(0.299,0.587,0.114)); vec3 rich=pow(max(col,vec3(0.0)),vec3(1.45))*0.92; rich=mix(vec3(dot(rich,vec3(0.299,0.587,0.114))),rich,1.18);",
          "    col=mix(col,rich,wk*0.9);",
          "    vec3 V=normalize("+i.cam+"-cw); float fr2=pow(1.0-abs(dot(n,V)),4.0); col+=vec3(0.62,0.66,0.7)*fr2*upf*"+i.wet+"*0.32*(0.4+lum); }",
          "  col*=mix(vec3(1.0),vec3(0.84,0.87,0.92),"+i.ovc+");",
          "  if("+i.fog+">0.0){ float d=max(0.0,length(cw-"+i.cam+")/"+i.S+"-2.5); float ff=1.0-exp(-d*"+i.fog+"); col=mix(col,"+i.fc+",ff*0.94); }",   /* clear air for the first couple of metres: what you're photographing stays crisp */
          "  "+o+".rgba.rgb=clamp(col,0.0,1.0);",
          "}"]; } });
      return {gsplat:dd.outputs.gsplat}; }); }
  function weHook(m){ if(!m||WE.scanMeshes.indexOf(m)>=0) return; try{ m.objectModifier=weScanMod(); m.updateGenerator(); WE.scanMeshes.push(m); }catch(e){ console.warn("weather hook",e); } }

  // ---- every frame, before the scene draws ----
  // The scan is only rebuilt when it has to be (each rebuild means Spark re-sorts millions of splats): every frame while
  // the wind blows, when a setting changes, and in fog every metre and a half you walk. Rain never touches it.
  function weTick(dt){ if(!viewer||!loaded||!scene||typeof SPARK==="undefined") return;
    var now=performance.now(), S=weS(), gy=weGround(), t=(now-WE.t0)/1000, any=weAny();
    for(var si=WE.scanMeshes.length-1;si>=0;si--){ var sm=WE.scanMeshes[si]; if(sm!==viewer.mesh&&sm!==viewer.detail) WE.scanMeshes.splice(si,1); }   /* no new array every frame */
    if(viewer.P&&!weFieldReady()) weFieldStart();
    if(any||WE.scanMeshes.length){ weHook(viewer.mesh); if(viewer.detail) weHook(viewer.detail); }
    var U=WE.scanU, wd=weWindDir(), ra=weAmt(WE.rain), wa=weAmt(WE.wind), fa=weAmt(WE.fog);
    if(U){ var wasOn=U.on.value>0.5; U.on.value=any?1:0; U.t.value=WE.tAt!=null?WE.tAt:t;   /* tAt: a photo's slow shutter steps the wind through the exposure (weExposure); the rain keeps its own clock, its streaks already are the exposure */
      if(wa>0&&U.fok.value<0.5&&weFieldReady()){ var F=WE.field; U.fld.value=F.tex; U.fo.value.copy(F.o); U.finv.value.copy(F.inv); U.fok.value=1; WE.dirty=true; WE.windIn=now; }   /* ready: the wind fades in over a second and a half */
      if(!weFieldReady()){ U.fok.value=0; }
      var wk=WE.windIn?Math.min(1,(now-WE.windIn)/1500):1; if(wk>=1) WE.windIn=0;
      U.wind.value.set(wd[0]*wa*wk,0,wd[1]*wa*wk); U.wet.value=Math.max(Math.min(1,ra*1.1),WE.wetX||0); if(WE.fcol) U.fc.value.set(WE.fcol[0],WE.fcol[1],WE.fcol[2]); else U.fc.value.set(0.7,0.72,0.74);   /* wetX, fcol: the opening keeps the ground wet after the rain and tints the fog with the time of day */ U.fog.value=fa?0.035+fa*0.11:0; U.ovc.value=Math.min(1,ra*0.85+fa*0.4);
      U.S.value=S; var m0=viewer.mesh; U.q.value.set(m0.quaternion.x,m0.quaternion.y,m0.quaternion.z,m0.quaternion.w); U.s.value=m0.scale.x||1;
      var far=!WE.lastCam||(fa>0&&WE.lastCam.distanceToSquared(camera.position)>2.25*S*S);   /* only fog cares where you are, and it starts 2.5 m out: every metre and a half is plenty */
      var blow=wa>0&&U.fok.value>0.5&&now-(WE.verT||0)>=(wa<0.9?90:50);   /* light wind moves gently, so 11 rebuilds a second is plenty; heavy wind keeps 20 */   /* the wind moves the scan 20 times a second: each rebuild re-sorts millions of splats */
      if(any&&(blow||far||WE.dirty)||(wasOn&&!any)){ WE.verT=now; if(far||WE.dirty||!WE.lastCam){ U.cam.value.copy(camera.position); WE.lastCam=(WE.lastCam||new THREE.Vector3()).copy(camera.position); }
        WE.scanMeshes.forEach(function(m){ m.updateVersion(); }); } }
    /* the rain */
    if(ra>0&&!WE.mesh){ try{ weRainBuild(); }catch(e){ console.warn("rain",e); WE.rain=0; ra=0; } }
    if(WE.mesh){ if(WE.mesh.parent!==scene){ if(WE.mesh.parent) WE.mesh.parent.remove(WE.mesh); scene.add(WE.mesh); }
      WE.mesh.visible=ra>0;
      if(ra>0){ var R=WE.U, fall=8.5*S, wv=(wa*3.2+0.35)*S, sh=weShutter(), lit=1, F2=weFieldReady()?WE.field:null;   /* until the map is ready, drops just don't hide behind things */
        if(F2){ R.fld.value=F2.tex; R.fo.value.copy(F2.o); R.finv.value.copy(F2.inv); R.fok.value=1; } else R.fok.value=0;
        if(typeof RL!=="undefined"&&RL.on&&typeof rlTimeIs==="function"){ lit=rlTimeIs("night")?0.25:rlTimeIs("blue")?0.45:rlTimeIs("golden")?0.85:1; }
        R.t.value=t; R.amt.value=ra; R.cam.value.copy(camera.position); R.gy.value=gy; R.box.value.set(11*S,6*S,11*S);
        R.vel.value.set(wd[0]*wv,-fall,wd[1]*wv); var spd=Math.hypot(fall,wv), th=0.0024*S, L=Math.max(th*4, spd*sh);
        R.len.value=L; R.th.value=th; R.al.value=0.75*Math.max(0.14,Math.min(1,Math.sqrt(0.012*S/L)))*(WE.rain===2?1:0.85); R.S.value=S; R.lit.value=lit;
        var Hh=(renderer&&renderer.domElement&&renderer.domElement.height)||1080; R.pxk.value=2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,Hh)/Math.max(0.01,camera.zoom||1); } }
    var sk=typeof SKY!=="undefined"&&SKY.mesh&&SKY.mesh.material.uniforms.wfog; if(sk){ var fcl=WE.fcol||[0.7,0.72,0.74]; sk.value.set(fcl[0],fcl[1],fcl[2], Math.max(fa*0.9, ra*0.42)); }
    WE.dirty=false; weSound(); }

  // ---- a slow shutter blurs the leaves: the wind's moments across the exposure, for the capture to average ----
  // How many moments: none at 1/500 and faster (the leaves freeze), 3 at 1/250 rising to 6 by about 1/8.
  function weWindSteps(ts){ if(!(weAmt(WE.wind)>0)||!WE.scanU||WE.scanU.fok.value<0.5||!(ts>1/400)) return 0; return Math.max(3,Math.min(6,Math.round(3+Math.log2(ts*250)*0.6))); }
  /* draw the scene with the wind as it was at offset u (0 to 1) through an exposure of ts seconds, starting now */
  function weExposureAt(u, ts){ var now=(performance.now()-WE.t0)/1000; WE.tAt=now+u*ts; WE.dirty=true; }
  function weExposureEnd(){ if(WE.tAt==null) return; WE.tAt=null; WE.dirty=true; }

  // ---- sound: rain on the ground and a soft wind, made from the same noise the interface sounds use ----
  function weSound(){ var now=performance.now(); if(now-WE.sndT<120) return; WE.sndT=now;
    var rf=typeof RF!=="undefined"&&RF.on, want=(typeof App!=="undefined"&&!rf&&(App.is("scene")||(typeof LA!=="undefined"&&LA.on))&&loaded&&soundOn)?1:0, ra=weAmt(WE.rain)*want, wa=weAmt(WE.wind)*want*(typeof LA!=="undefined"&&LA.on?0.4:1);   /* silent under the title page, soft under the opening */
    if(typeof sfxAmbTick==="function") sfxAmbTick(!!want&&App.is("scene")&&!(typeof LA!=="undefined"&&LA.on));   /* birds and air under the scan */
    if(!WE.snd){ if(!(ra||wa)) return; var c=typeof sfxCtx==="function"?sfxCtx():null; if(!c||!SFX.nb) return;
      if(navigator.userActivation&&!navigator.userActivation.hasBeenActive) return;
      var mk=function(type,f,q){ var s=c.createBufferSource(); s.buffer=SFX.nb; s.loop=true; var fl=c.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=q; var g=c.createGain(); g.gain.value=0.0001; s.connect(fl); fl.connect(g); g.connect(SFX.out); s.start(0,Math.random()*1.5); return {f:fl,g:g}; };
      WE.snd={c:c, rain:mk("bandpass",2500,0.5), patter:mk("highpass",5000,0.5), wind:mk("bandpass",500,1.2), drops:sxBus(0.3)}; }
    /* Sam's picks (28 Oct): rain = light drizzle (a soft hiss and scattered drops), wind = gusty (a band of air that swells and moves) */
    var S2=WE.snd, t=S2.c.currentTime, k=now/1000;
    S2.rain.g.gain.setTargetAtTime(0.0001+ra*0.075,t,0.6); S2.patter.g.gain.setTargetAtTime(0.0001+ra*0.035,t,0.5);   /* rain you can hear: a steady hiss, the patter on top */
    if(ra>0){ var nd=Math.round(ra*6); for(var i=0;i<nd;i++) if(Math.random()<0.75) sxTick(S2.drops,t+0.03+Math.random()*0.12,1800+Math.random()*3200,(0.01+Math.random()*0.02)*Math.min(1,ra*1.6),Math.random()*1.6-0.8); }   /* drops on leaves, close and far */
    var gust=0.5+0.5*Math.sin(k*2*Math.PI*0.13);
    S2.wind.g.gain.setTargetAtTime(0.0001+wa*0.016*(0.6+0.4*gust),t,2.5); S2.wind.f.frequency.setTargetAtTime(220+560*gust,t,0.6); }

  // ---- the strip of weather squares under the kit ----
  function weKitHTML(){ return '<div class="kit-wx"><span class="kit-wx-l">WEATHER</span>'+WE_ITEMS.map(function(it){ var lv=WE[it[0]];
      return '<button class="wx-sq'+(lv?" on":"")+'" data-we="'+it[0]+'" title="'+it[1]+': '+WE_LV[lv]+' ('+it[2]+')">'+WE_ICON[it[0]]+'<i class="wx-dots"><b class="'+(lv>=1?"y":"")+'"></b><b class="'+(lv>=2?"y":"")+'"></b></i><kbd>'+it[2]+'</kbd></button>'; }).join("")
    +'<span class="kit-wx-s">'+weSummary()+'</span></div>'; }
  function weSummary(){ var o=[]; WE_ITEMS.forEach(function(it){ if(WE[it[0]]) o.push(WE_LV[WE[it[0]]]+" "+it[1].toLowerCase()); }); return o.length?o.join(" · "):"Clear"; }
  function weKitMark(){ var k=document.getElementById("kitMenu"); if(!k) return; var s=k.querySelector(".kit-wx"); if(!s) return;   /* updated in place, so the strip doesn't replay its entrance */
    WE_ITEMS.forEach(function(it){ var b=s.querySelector('[data-we="'+it[0]+'"]'), lv=WE[it[0]]; if(!b) return; b.classList.toggle("on",lv>0); b.title=it[1]+": "+WE_LV[lv]+" ("+it[2]+")";
      var d=b.querySelectorAll(".wx-dots b"); if(d[0]) d[0].className=lv>=1?"y":""; if(d[1]) d[1].className=lv>=2?"y":""; });
    var t=s.querySelector(".kit-wx-s"); if(t) t.textContent=weSummary(); }
  document.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("#kitMenu [data-we]"); if(!b) return; e.preventDefault(); e.stopPropagation(); weCycle(b.getAttribute("data-we")); }, true);
  window.addEventListener("keydown",function(e){ if(typeof KIT==="undefined"||!KIT.open) return; var n={Digit5:"rain",Digit6:"wind",Digit7:"fog"}[e.code]; if(!n) return; e.preventDefault(); e.stopImmediatePropagation(); weCycle(n); }, true);
  if(/[?&]dev/.test(location.search)) window.__we={ set:function(o){ for(var k in o) if(k in WE) WE[k]=o[k]; WE.dirty=true; }, state:weState, diag:function(){ var m=WE.mesh, pr=m&&renderer.properties.get(m.material); return {loaded:loaded, mesh:!!m, vis:!!(m&&m.visible), inScene:!!(m&&m.parent===scene), amt:WE.U&&WE.U.amt.value, al:WE.U&&WE.U.al.value, len:WE.U&&WE.U.len.value, fok:WE.U&&WE.U.fok.value, gy:WE.U&&WE.U.gy.value, cam:camera.position.toArray(), prog:!!(pr&&pr.currentProgram), calls:renderer.info.render.calls}; }, sample:function(x,y,z){ var f=weField(); if(!f) return null; var ix=Math.floor((x-f.lo[0])/f.cell), iy=Math.floor((y-f.lo[1])/f.cell), iz=Math.floor((z-f.lo[2])/f.cell); if(ix<0||iy<0||iz<0||ix>=f.nx||iy>=f.ny||iz>=f.nz) return null; var c=((iz*f.ny+iy)*f.nx+ix)*4; return [f.out[c]/255, f.out[c+1]/255]; }, splats:function(){ var f=weField(), P=viewer.P, n=P.length/3, st=Math.max(1,Math.floor(n/4000)), r=[]; for(var i=0;i<n;i+=st){ var v=this.sample(P[i*3],P[i*3+1],P[i*3+2]); if(v) r.push([+P[i*3].toFixed(2),+P[i*3+1].toFixed(2),+P[i*3+2].toFixed(2),+v[0].toFixed(2),+v[1].toFixed(2)]); } return r; }, map:function(on){ if(WE.scanU){ WE.scanU.dbg.value=on?1:0; WE.dirty=true; } }, field:function(){ var f=weField(); return f?{o:f.o.toArray(), inv:f.inv.toArray(), size:[f.tex.image.width,f.tex.image.height,f.tex.image.depth]}:null; } };
