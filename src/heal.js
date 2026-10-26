  // ================= HEAL (the bandaid) =================
  // Spot removal the Lightroom way: click a mark or paint over it, and the patch is filled from a nearby piece of the
  // photograph that matches its surroundings, melted in by matching the brightness round the edge (heal, not clone).
  // Each stroke is stored on the frame as {p:[[u,v],…], r, s:[u,v]}: stamp centres and the source centre in fractions
  // of the unrotated photo, radius as a fraction of its short side. Heals are baked into the source before developing,
  // so every other edit runs on the healed photograph, at full resolution for exports too.
  var healOn=false, healSel=-1, healStroke=null, healDragSrc=null, healCur=null, healRaf=0, healCache={key:"",cv:null}, healSmall={key:"",d:null}, healDirty=false, edRC0=null;
  function healSize(){ var s=$("healSize"); return (s?+s.value:18)/1000; }
  function healHash(E){ var h=E&&E.heals; if(!h||!h.length) return "0"; var s=JSON.stringify(h), x=0; for(var i=0;i<s.length;i++) x=(x*31+s.charCodeAt(i))|0; return h.length+"."+x; }
  function healToSrc(U,V,rot){ rot=((rot||0)%360+360)%360; return rot===90?[V,1-U]:rot===180?[1-U,1-V]:rot===270?[1-V,U]:[U,V]; }
  function healToRot(u,v,rot){ rot=((rot||0)%360+360)%360; return rot===90?[1-v,u]:rot===180?[1-u,1-v]:rot===270?[v,1-u]:[u,v]; }
  // the photograph with its heals applied (cached per frame and heal set); falls back to the plain image
  function healSource(img,E){ var h=E&&E.heals; if(!h||!h.length||!img||!img.naturalWidth) return img; var key=(img.src?img.src.length+img.src.slice(-40):"")+"|"+healHash(E); if(healCache.key===key&&healCache.cv) return healCache.cv;
    var iw=img.naturalWidth, ih=img.naturalHeight, c=document.createElement("canvas"); c.width=iw; c.height=ih; var x=c.getContext("2d",{willReadFrequently:true}); x.drawImage(img,0,0);
    try{ for(var i=0;i<h.length;i++) healOne(x,iw,ih,h[i]); }catch(e){ console.warn("heal:",e); }
    healCache={key:key,cv:c}; return c; }
  function healBox(st,iw,ih,R){ var pts=st.p, minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9, cx=0, cy=0, n=pts.length, i;
    for(i=0;i<n;i++){ var px=pts[i][0]*iw, py=pts[i][1]*ih; cx+=px; cy+=py; if(px<minx)minx=px; if(px>maxx)maxx=px; if(py<miny)miny=py; if(py>maxy)maxy=py; }
    var pad=Math.ceil(R*1.7); return {x:Math.floor(minx-pad), y:Math.floor(miny-pad), w:Math.ceil(maxx+pad)-Math.floor(minx-pad), h:Math.ceil(maxy+pad)-Math.floor(miny-pad), cx:cx/n, cy:cy/n}; }
  // the stamp mask over a box: 1 inside each stamp, feathered to 0 at its edge; 2 marks the ring just outside (used for matching)
  function healMask(st,iw,ih,R,bx,by,W,H){ var M=new Float32Array(W*H), ring=new Uint8Array(W*H), pts=st.p, i, j, R2=R*1.5;
    for(i=0;i<pts.length;i++){ var qx=pts[i][0]*iw-bx, qy=pts[i][1]*ih-by, x0=Math.max(0,Math.floor(qx-R2)), x1=Math.min(W-1,Math.ceil(qx+R2)), y0=Math.max(0,Math.floor(qy-R2)), y1=Math.min(H-1,Math.ceil(qy+R2));
      for(var yy=y0;yy<=y1;yy++) for(var xx=x0;xx<=x1;xx++){ var d=Math.hypot(xx-qx,yy-qy); j=yy*W+xx; if(d<=R2) ring[j]=1; if(d>=R) continue; var v=d<R*0.75?1:1-((d/R-0.75)/0.25); v=v*v*(3-2*v); if(v>M[j]) M[j]=v; } }
    for(j=0;j<W*H;j++) if(M[j]>0.02) ring[j]=0; return {M:M,ring:ring}; }
  // seamless fill: the source patch is bent to meet the photograph round the edge of the spot. We solve for a smooth
  // "membrane" that equals (photo − source) on the ring and is harmonic inside, then add it to the source: the texture
  // comes from the source, the colour and shading come from the pixels round the spot (Pérez's Poisson cloning).
  function healSolve(v,inside,w,h,iters){ for(var it=0;it<iters;it++){ var fwd=(it&1)===0; for(var yy=0;yy<h;yy++){ var y=fwd?yy:h-1-yy; for(var xx=0;xx<w;xx++){ var x=fwd?xx:w-1-xx, i=y*w+x; if(!inside[i]) continue;
        var l=x>0?i-1:i, r=x<w-1?i+1:i, u=y>0?i-w:i, d=y<h-1?i+w:i; for(var c=0;c<3;c++) v[i*3+c]=(v[l*3+c]+v[r*3+c]+v[u*3+c]+v[d*3+c])*0.25; } } } }
  function healMembrane(dd,sd,M,W,H){ var N=W*H, fine=new Float32Array(N*3), inside=new Uint8Array(N), i, c, x, y;
    for(i=0;i<N;i++){ inside[i]=M[i]>0.001?1:0; for(c=0;c<3;c++) fine[i*3+c]=dd[i*4+c]-sd[i*4+c]; }
    var f=Math.max(1,Math.ceil(Math.max(W,H)/40)), cw=Math.ceil(W/f), ch=Math.ceil(H/f), cv=new Float32Array(cw*ch*3), cin=new Uint8Array(cw*ch), cnt=new Float32Array(cw*ch);
    for(i=0;i<N;i++){ if(inside[i]) continue; x=i%W; y=(i/W)|0; var ci=((y/f)|0)*cw+((x/f)|0); cnt[ci]++; for(c=0;c<3;c++) cv[ci*3+c]+=fine[i*3+c]; }
    var mean=[0,0,0], mn=0; for(i=0;i<cw*ch;i++){ if(cnt[i]>0){ for(c=0;c<3;c++){ cv[i*3+c]/=cnt[i]; mean[c]+=cv[i*3+c]; } mn++; } else cin[i]=1; }
    if(mn) for(c=0;c<3;c++) mean[c]/=mn; for(i=0;i<cw*ch;i++) if(cin[i]) for(c=0;c<3;c++) cv[i*3+c]=mean[c];
    healSolve(cv,cin,cw,ch,f>1?260:0);
    if(f>1) for(i=0;i<N;i++){ if(!inside[i]) continue; x=i%W; y=(i/W)|0; var gx=Math.min(cw-1,Math.max(0,(x+0.5)/f-0.5)), gy=Math.min(ch-1,Math.max(0,(y+0.5)/f-0.5)), x0=gx|0, y0=gy|0, x1=Math.min(cw-1,x0+1), y1=Math.min(ch-1,y0+1), tx=gx-x0, ty=gy-y0;
      for(c=0;c<3;c++) fine[i*3+c]=(cv[(y0*cw+x0)*3+c]*(1-tx)+cv[(y0*cw+x1)*3+c]*tx)*(1-ty)+(cv[(y1*cw+x0)*3+c]*(1-tx)+cv[(y1*cw+x1)*3+c]*tx)*ty; }
    healSolve(fine,inside,W,H,f>1?10:60); return fine; }
  function healOne(x,iw,ih,st){ var m=Math.min(iw,ih), R=Math.max(st.r*m,1.5), B=healBox(st,iw,ih,R), ox=Math.round(st.s[0]*iw-B.cx), oy=Math.round(st.s[1]*ih-B.cy);
    var dx0=Math.max(B.x,0,-ox), dy0=Math.max(B.y,0,-oy), dx1=Math.min(B.x+B.w,iw,iw-ox), dy1=Math.min(B.y+B.h,ih,ih-oy); if(dx1-dx0<2||dy1-dy0<2) return;
    var W=dx1-dx0, H=dy1-dy0, D=x.getImageData(dx0,dy0,W,H), S=x.getImageData(dx0+ox,dy0+oy,W,H), dd=D.data, sd=S.data, M=healMask(st,iw,ih,R,dx0,dy0,W,H).M, mem=healMembrane(dd,sd,M,W,H), j, k;
    for(j=0;j<W*H;j++){ var mv=M[j]; if(mv<=0) continue; k=j*4; for(var c=0;c<3;c++){ var t=Math.min(255,Math.max(0,sd[k+c]+mem[j*3+c])); dd[k+c]+=(t-dd[k+c])*mv; } }
    x.putImageData(D,dx0,dy0); }
  // pick the source: try a ring of candidates round the spot, score each by how well its surroundings match the spot's
  // surroundings and how flat its middle is, take the best. Done on a small copy so it is instant.
  function healSmallOf(img){ var key=img.src?img.src.length+img.src.slice(-40):""; if(healSmall.key===key&&healSmall.d) return healSmall.d; var sc=Math.min(1,480/Math.max(img.naturalWidth,img.naturalHeight)), w=Math.max(2,Math.round(img.naturalWidth*sc)), h=Math.max(2,Math.round(img.naturalHeight*sc));
    var c=document.createElement("canvas"); c.width=w; c.height=h; var x=c.getContext("2d",{willReadFrequently:true}); x.drawImage(img,0,0,w,h); var d=null; try{ d=x.getImageData(0,0,w,h); }catch(e){} healSmall={key:key,d:d?{w:w,h:h,data:d.data,sc:sc}:null}; return healSmall.d; }
  function healPick(st,img){ var sm=healSmallOf(img); if(!sm) return [st.p[0][0],st.p[0][1]]; var iw=sm.w, ih=sm.h, m=Math.min(iw,ih), R=Math.max(st.r*m,1.2), B=healBox(st,iw,ih,R), bx=Math.max(B.x,0), by=Math.max(B.y,0), W=Math.min(B.x+B.w,iw)-bx, H=Math.min(B.y+B.h,ih)-by; if(W<2||H<2) return [st.p[0][0],st.p[0][1]];
    var mk=healMask(st,iw,ih,R,bx,by,W,H), M=mk.M, ring=mk.ring, d=sm.data, ext=Math.hypot(B.w,B.h)/2, best=null, bs=1e18, j, k;
    var rr=0,rg=0,rb=0,rn=0; for(j=0;j<W*H;j++){ if(!ring[j]) continue; k=((by+(j/W|0))*iw+bx+(j%W))*4; rr+=d[k]; rg+=d[k+1]; rb+=d[k+2]; rn++; } if(rn){ rr/=rn; rg/=rn; rb/=rn; }
    for(var di=0;di<3;di++) for(var a=0;a<12;a++){ var ang=a/12*Math.PI*2+di*0.26, dist=ext*[1.25,1.9,2.8][di], ox=Math.round(Math.cos(ang)*dist), oy=Math.round(Math.sin(ang)*dist);
      if(bx+ox<0||by+oy<0||bx+W+ox>iw||by+H+oy>ih) continue; var sc=0, sn=0, fc=0, fn=0;
      for(j=0;j<W*H;j+=2){ var yy=(j/W|0), xx=j%W, kd=((by+yy)*iw+bx+xx)*4, ks=((by+yy+oy)*iw+bx+xx+ox)*4;
        if(ring[j]){ var e0=d[kd]-d[ks], e1=d[kd+1]-d[ks+1], e2=d[kd+2]-d[ks+2]; sc+=e0*e0+e1*e1+e2*e2; sn++; }
        else if(M[j]>0.5){ var f0=d[ks]-rr, f1=d[ks+1]-rg, f2=d[ks+2]-rb; fc+=f0*f0+f1*f1+f2*f2; fn++; } }
      var score=(sn?sc/sn:1e9)+(fn?fc/fn:0)*0.6+di*40; if(score<bs){ bs=score; best=[ox,oy]; } }
    if(!best) return [Math.min(1,st.p[0][0]+st.r*3),st.p[0][1]];
    return [(B.cx+best[0])/iw,(B.cy+best[1])/ih]; }
  // ---- mode, overlay and pointer work ----
  function healStart(){ if(!edState||!edRC||healOn) return; if(typeof edCrop!=="undefined"&&edCrop) cropEnd(true); if(!edState.heals) edState.heals=[]; healOn=true; healSel=-1; healStroke=null; healDragSrc=null; editor.classList.add("healing"); var b=$("eHeal"); if(b) b.classList.add("on");
    var o=$("healOverlay"); if(o) o.classList.remove("hidden"); healHint(); healLoop(); }
  function healEnd(){ if(!healOn) return; healOn=false; healStroke=null; healDragSrc=null; editor.classList.remove("healing"); var b=$("eHeal"); if(b) b.classList.remove("on"); var o=$("healOverlay"); if(o) o.classList.add("hidden"); cancelAnimationFrame(healRaf); if(typeof edApplyView==="function") edApplyView(); }
  function healHint(){ var h=$("editHint"); if(!h||!healOn) return; h.textContent=(edState&&edState.heals&&edState.heals.length?"click a spot to select it, drag its pin to move the source, Delete removes it":"click or paint over a mark · [ ] size · Enter when you're done"); }
  function healCommit(){ if(!edState) return; buildRotated(); if(typeof crv!=="undefined") crv.sent=[]; queueRender(); edPushHist(); healHint(); }
  function healGeom(){ var cnv=$("editCanvas"), stg=$("editStage"); if(!cnv||!stg||!edState) return null; var r=cnv.getBoundingClientRect(), sr=stg.getBoundingClientRect(); if(r.width<2) return null;
    var cr=cropRect(), iw=edSrc.naturalWidth, ih=edSrc.naturalHeight, m=Math.min(iw,ih), rot=edState.rot||0;
    return {r:r, sr:sr, cr:cr, iw:iw, ih:ih, m:m, rot:rot, scale:r.width/cr.w,
      toOv:function(u,v){ var p=healToRot(u,v,rot); return [(p[0]*rcW-cr.x)*this.scale,(p[1]*rcH-cr.y)*this.scale]; },
      fromEv:function(e){ var X=(e.clientX-r.left)/r.width*cr.w+cr.x, Y=(e.clientY-r.top)/r.height*cr.h+cr.y; return healToSrc(X/rcW,Y/rcH,rot); } }; }
  function healDraw(){ var o=$("healOverlay"), g=healGeom(); if(!o||!g) return; var dpr=window.devicePixelRatio||1, W=Math.round(g.r.width), H=Math.round(g.r.height);
    o.style.left=(g.r.left-g.sr.left)+"px"; o.style.top=(g.r.top-g.sr.top)+"px"; o.style.width=W+"px"; o.style.height=H+"px"; if(o.width!==Math.round(W*dpr)||o.height!==Math.round(H*dpr)){ o.width=Math.round(W*dpr); o.height=Math.round(H*dpr); }
    var x=o.getContext("2d"); x.setTransform(dpr,0,0,dpr,0,0); x.clearRect(0,0,W,H); var hs=edState.heals||[], i, k;
    var circ=function(p,R,sel,fill){ x.beginPath(); x.arc(p[0],p[1],R,0,Math.PI*2); if(fill){ x.fillStyle=fill; x.fill(); } x.lineWidth=sel?1.5:1; x.strokeStyle=sel?"#e3ad57":"rgba(244,241,234,.75)"; x.setLineDash(sel?[]:[3,3]); x.stroke(); x.setLineDash([]); };
    for(i=0;i<hs.length;i++){ var st=hs[i], R=st.r*g.m*g.scale, sel=i===healSel; if(st.p.length===1) circ(g.toOv(st.p[0][0],st.p[0][1]),R,sel);
      else { x.beginPath(); for(k=0;k<st.p.length;k++){ var q=g.toOv(st.p[k][0],st.p[k][1]); if(k) x.lineTo(q[0],q[1]); else x.moveTo(q[0],q[1]); } x.lineCap="round"; x.lineJoin="round"; x.lineWidth=R*2; x.strokeStyle=sel?"rgba(227,173,87,.22)":"rgba(244,241,234,.14)"; x.stroke(); x.lineWidth=sel?1.5:1; x.strokeStyle=sel?"#e3ad57":"rgba(244,241,234,.7)"; x.setLineDash(sel?[]:[3,3]); x.stroke(); x.setLineDash([]); }
      if(sel){ var c0=g.toOv(st.p[0][0],st.p[0][1]), cx=0, cy=0; for(k=0;k<st.p.length;k++){ var qq=g.toOv(st.p[k][0],st.p[k][1]); cx+=qq[0]; cy+=qq[1]; } cx/=st.p.length; cy/=st.p.length; var sp=g.toOv(st.s[0],st.s[1]);
        x.beginPath(); x.moveTo(cx,cy); x.lineTo(sp[0],sp[1]); x.lineWidth=1; x.strokeStyle="rgba(227,173,87,.7)"; x.stroke(); circ(sp,Math.max(R,6),true,"rgba(227,173,87,.12)"); x.beginPath(); x.arc(sp[0],sp[1],3,0,Math.PI*2); x.fillStyle="#e3ad57"; x.fill(); } }
    if(healStroke){ x.beginPath(); for(k=0;k<healStroke.p.length;k++){ var q2=g.toOv(healStroke.p[k][0],healStroke.p[k][1]); if(k) x.lineTo(q2[0],q2[1]); else x.moveTo(q2[0],q2[1]); } x.lineCap="round"; x.lineJoin="round"; x.lineWidth=healStroke.r*g.m*g.scale*2; x.strokeStyle="rgba(244,241,234,.35)"; x.stroke();
      if(healStroke.p.length===1) circ(g.toOv(healStroke.p[0][0],healStroke.p[0][1]),healStroke.r*g.m*g.scale,false,"rgba(244,241,234,.35)"); }
    if(healCur&&!healStroke&&!healDragSrc){ circ(healCur,healSize()*g.m*g.scale,false); } }
  function healLoop(){ if(!healOn) return; healDraw(); healRaf=requestAnimationFrame(healLoop); }
  function healHit(u,v,g){ var hs=edState.heals||[]; for(var i=hs.length-1;i>=0;i--){ var st=hs[i]; for(var k=0;k<st.p.length;k++){ var du=(u-st.p[k][0])*g.iw/g.m, dv=(v-st.p[k][1])*g.ih/g.m; if(Math.hypot(du,dv)<=st.r*1.2) return i; } } return -1; }
  (function healWire(){ var cnv=$("editCanvas"), b; if(!cnv) return;
    if((b=$("eHeal"))) b.onclick=function(){ if(healOn) healEnd(); else healStart(); };
    if((b=$("eHealDone"))) b.onclick=function(){ healEnd(); };
    if((b=$("eHealClear"))) b.onclick=function(){ if(!edState||!edState.heals||!edState.heals.length) return; edState.heals=[]; healSel=-1; healCommit(); };
    if((b=$("healSize"))) b.addEventListener("input",function(){ healDraw(); });
    if((b=$("eCrop"))) b.addEventListener("click",function(){ if(healOn) healEnd(); },true);
    cnv.addEventListener("pointerdown",function(e){ if(!healOn||!edState||e.button!==0) return; e.stopImmediatePropagation(); e.preventDefault(); var g=healGeom(); if(!g) return; var uv=g.fromEv(e), hs=edState.heals;
      if(healSel>=0&&hs[healSel]){ var sp=g.toOv(hs[healSel].s[0],hs[healSel].s[1]), px=e.clientX-g.r.left, py=e.clientY-g.r.top; if(Math.hypot(px-sp[0],py-sp[1])<=Math.max(hs[healSel].r*g.m*g.scale,6)+4){ healDragSrc={i:healSel,moved:false}; try{ cnv.setPointerCapture(e.pointerId); }catch(er){} return; } }
      var hit=healHit(uv[0],uv[1],g); if(hit>=0){ healSel=hit; healHint(); return; }
      healSel=-1; healStroke={p:[uv],r:healSize()}; try{ cnv.setPointerCapture(e.pointerId); }catch(er){} },true);
    cnv.addEventListener("pointermove",function(e){ if(!healOn) return; var g=healGeom(); if(!g) return; healCur=[e.clientX-g.r.left,e.clientY-g.r.top];
      if(healDragSrc){ e.stopImmediatePropagation(); var st=edState.heals[healDragSrc.i]; if(st){ st.s=g.fromEv(e); healDragSrc.moved=true; } return; }
      if(healStroke){ e.stopImmediatePropagation(); var uv=g.fromEv(e), L=healStroke.p[healStroke.p.length-1], d=Math.hypot((uv[0]-L[0])*g.iw/g.m,(uv[1]-L[1])*g.ih/g.m); if(d>=healStroke.r*0.45) healStroke.p.push(uv); } },true);
    var up=function(e){ if(!healOn) return; if(healDragSrc){ var mv=healDragSrc.moved; healDragSrc=null; if(mv) healCommit(); return; }
      if(healStroke){ var st=healStroke; healStroke=null; st.s=healPick(st,edSrc); edState.heals.push(st); healSel=edState.heals.length-1; healCommit(); } };
    cnv.addEventListener("pointerup",up,true); cnv.addEventListener("pointercancel",up,true); cnv.addEventListener("mouseleave",function(){ healCur=null; });
    window.addEventListener("keydown",function(e){ if(!editor||editor.classList.contains("hidden")) return; var t=e.target, typing=t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)&&t.type!=="range"); if(typing||e.ctrlKey||e.metaKey||e.altKey) return;
      if(e.key==="b"||e.key==="B"){ e.preventDefault(); e.stopImmediatePropagation(); if(healOn) healEnd(); else healStart(); return; }
      if(!healOn) return;
      if(e.key==="Escape"||e.key==="Enter"){ e.preventDefault(); e.stopImmediatePropagation(); healEnd(); return; }
      if(e.key==="c"||e.key==="C"){ healEnd(); return; }
      if((e.key==="Delete"||e.key==="Backspace")&&healSel>=0&&edState.heals[healSel]){ e.preventDefault(); e.stopImmediatePropagation(); edState.heals.splice(healSel,1); healSel=-1; healCommit(); return; }
      if(e.key==="["||e.key==="]"){ e.preventDefault(); e.stopImmediatePropagation(); var s=$("healSize"); if(s){ s.value=Math.max(+s.min,Math.min(+s.max,+s.value*(e.key==="]"?1.2:0.83))); } return; } },true);
    // leaving the frame or the editor leaves heal mode too
    var _oe=openEditor; openEditor=function(i){ healEnd(); return _oe.apply(this,arguments); };
    var _av=edApplyView; edApplyView=function(){ _av.apply(this,arguments); if(healOn) healHint(); }; })();
