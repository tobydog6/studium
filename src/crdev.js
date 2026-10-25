  // ================= DEVELOP ENGINE: Camera Raw–style processing =================
  // A JavaScript port of the Camera Raw pipeline in PhotoCraft (github.com/storytold/photocraft, crates/algo/src/
  // camera_raw*.rs). Copyright (c) 2026 ArtCraft Team and the PhotoCraft contributors; used under the MIT License,
  // see licenses/photocraft-MIT.txt. Checked pixel for pixel against their Rust build. Their notes, kept short:
  // white balance and exposure in linear light; Dehaze by the dark channel prior (He, Sun, Tang 2009);
  // Highlights and Shadows as a local Laplacian filter on log luminance (Paris, Hasinoff, Kautz 2011;
  // Aubry et al. 2014), strengths fitted to Photoshop's Camera Raw by black-box measurement; Contrast,
  // Clarity and Texture on luminance with colour ratios kept; Whites and Blacks as measured,
  // image-adaptive curves; Vibrance and Saturation; vignette and grain. No Adobe code or data.
  // Lives in one function so it can run both on the page and inside a Web Worker (CRENGINE.toString()).
  function CRENGINE(){
    "use strict";
    var F32=Float32Array;
    function s2lx(v){ return v<=0.04045? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }
    function l2sx(v){ return v<=0.0031308? v*12.92 : 1.055*Math.pow(v,1/2.4)-0.055; }
    // Table versions (well under 1e-5 from the exact curves): s2l by value, l2s by the square root of the value.
    var LN=4096, S2L=new F32(LN+2), L2S=new F32(LN+2);
    for(var li=0;li<=LN+1;li++){ var lt=Math.min(li/LN,1); S2L[li]=s2lx(lt); L2S[li]=l2sx(lt*lt); }
    function s2l(v){ if(v<=0.04045||v>1) return s2lx(v); var x=v*LN, i=x|0; return S2L[i]+(S2L[i+1]-S2L[i])*(x-i); }
    function l2s(v){ if(v<=0.0031308||v>1) return l2sx(v); var x=Math.sqrt(v)*LN, i=x|0; return L2S[i]+(L2S[i+1]-L2S[i])*(x-i); }
    function luma(r,g,b){ return 0.2126*r+0.7152*g+0.0722*b; }
    function clamp(v,a,b){ return v<a?a:v>b?b:v; }
    function smoothstep(e0,e1,x){ var t=clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); }
    function bilinear(buf,w,h,x,y){ x=clamp(x,0,w-1); y=clamp(y,0,h-1); var x0=Math.floor(x), y0=Math.floor(y), x1=Math.min(x0+1,w-1), y1=Math.min(y0+1,h-1), tx=x-x0, ty=y-y0;
      var a=buf[y0*w+x0], b=buf[y0*w+x1], c=buf[y1*w+x0], d=buf[y1*w+x1], top=a+(b-a)*tx, bot=c+(d-c)*tx; return top+(bot-top)*ty; }
    // ---- box mean, gaussian, guided filters ----
    function boxMean(v,w,h,r){ if(r===0||!w||!h) return new F32(v); var n=2*r+1, tmp=new F32(w*h), out=new F32(w*h), x, y, acc;
      for(y=0;y<h;y++){ var o=y*w; acc=0; for(var k=-r;k<=r;k++) acc+=v[o+clamp(k,0,w-1)];
        for(x=0;x<w;x++){ tmp[o+x]=acc/n; acc+=v[o+Math.min(x+r+1,w-1)]-v[o+Math.max(x-r,0)]; } }
      var col=new Float64Array(w);
      for(var k2=-r;k2<=r;k2++){ var ro=clamp(k2,0,h-1)*w; for(x=0;x<w;x++) col[x]+=tmp[ro+x]; }
      for(y=0;y<h;y++){ var oo=y*w, ad=Math.min(y+r+1,h-1)*w, su=Math.max(y-r,0)*w; for(x=0;x<w;x++){ out[oo+x]=col[x]/n; col[x]+=tmp[ad+x]-tmp[su+x]; } }
      return out; }
    function boxRadii(sigma){ var n=3, wi=Math.sqrt(12*sigma*sigma/n+1), wl=Math.floor(wi); if(wl%2===0) wl--; wl=Math.max(wl,1); var wu=wl+2;
      var m=clamp(Math.round((12*sigma*sigma-n*wl*wl-4*n*wl-3*n)/(-4*wl-4)),0,n), r=[0,1,2].map(function(i){ return i<m?(wl-1)/2:(wu-1)/2; });
      if(r.every(function(x){ return x===0; })) r[0]=1; return r; }
    function gauss(v,w,h,sigma){ if(sigma<0.3) return new F32(v); var o=v; boxRadii(sigma).forEach(function(r){ o=boxMean(o,w,h,r); }); return o; }
    function guided(I,P,w,h,r,eps){ var N=w*h, mi=boxMean(I,w,h,r), mp=boxMean(P,w,h,r), ip=new F32(N), ii=new F32(N), k;
      for(k=0;k<N;k++){ ip[k]=I[k]*P[k]; ii[k]=I[k]*I[k]; } var mip=boxMean(ip,w,h,r), mii=boxMean(ii,w,h,r), a=new F32(N), b=new F32(N);
      for(k=0;k<N;k++){ a[k]=(mip[k]-mi[k]*mp[k])/(mii[k]-mi[k]*mi[k]+eps); b[k]=mp[k]-a[k]*mi[k]; }
      var ma=boxMean(a,w,h,r), mb=boxMean(b,w,h,r), out=new F32(N); for(k=0;k<N;k++) out[k]=ma[k]*I[k]+mb[k]; return out; }
    function guidedFast(I,P,w,h,r,eps){ var s=clamp(Math.floor(r/8),1,8); if(s===1) return guided(I,P,w,h,r,eps);
      var sw=Math.ceil(w/s), sh=Math.ceil(h/s);
      function down(v){ var o=new F32(sw*sh), c=new F32(sw*sh); for(var y=0;y<h;y++) for(var x=0;x<w;x++){ var k=Math.floor(y/s)*sw+Math.floor(x/s); o[k]+=v[y*w+x]; c[k]+=1; } for(var q=0;q<o.length;q++) o[q]/=Math.max(c[q],1); return o; }
      var si=down(I), sp=down(P), rs=Math.max(Math.floor(r/s),1), M=sw*sh, mi=boxMean(si,sw,sh,rs), mp=boxMean(sp,sw,sh,rs), ip=new F32(M), ii=new F32(M), k;
      for(k=0;k<M;k++){ ip[k]=si[k]*sp[k]; ii[k]=si[k]*si[k]; } var mip=boxMean(ip,sw,sh,rs), mii=boxMean(ii,sw,sh,rs), a=new F32(M), b=new F32(M);
      for(k=0;k<M;k++){ a[k]=(mip[k]-mi[k]*mp[k])/(mii[k]-mi[k]*mi[k]+eps); b[k]=mp[k]-a[k]*mi[k]; }
      var ma=boxMean(a,sw,sh,rs), mb=boxMean(b,sw,sh,rs), out=new F32(w*h);
      for(var y=0;y<h;y++){ var fy=(y+0.5)/s-0.5; for(var x=0;x<w;x++){ var fx=(x+0.5)/s-0.5; out[y*w+x]=bilinear(ma,sw,sh,fx,fy)*I[y*w+x]+bilinear(mb,sw,sh,fx,fy); } }
      return out; }
    // The q-quantile as a sort would give it (quickselect on a copy).
    function quantile(v,q){ var a=new F32(v), k=Math.round((a.length-1)*q), lo=0, hi=a.length-1;
      while(hi>lo){ var piv=a[(lo+hi)>>1], i=lo, j=hi; while(i<=j){ while(a[i]<piv) i++; while(a[j]>piv) j--; if(i<=j){ var t=a[i]; a[i]=a[j]; a[j]=t; i++; j--; } }
        if(k<=j) hi=j; else if(k>=i) lo=i; else break; }
      return a[k]; }
    // ---- local Laplacian (Highlights and Shadows) ----
    var TAPS=[1/16,4/16,6/16,4/16,1/16];
    function mirror(i,n){ if(n===1) return 0; var p=2*(n-1), m=((i%p)+p)%p; return m>=n?p-m:m; }
    function blurStep(P,step,out,tmp){ var w=P.w, h=P.h, v=P.v, w2=Math.ceil(w/step), h2=Math.ceil(h/step), x, y, k; tmp=tmp||new F32(w*h2); out=out||new F32(w2*h2);
      var A=TAPS[0], B=TAPS[1], C=TAPS[2];
      for(var y2=0;y2<h2;y2++){ var yy=y2*step, r0=mirror(yy-2,h)*w, r1=mirror(yy-1,h)*w, r2=mirror(yy,h)*w, r3=mirror(yy+1,h)*w, r4=mirror(yy+2,h)*w, o=y2*w;
        for(x=0;x<w;x++) tmp[o+x]=A*v[r0+x]+B*v[r1+x]+C*v[r2+x]+B*v[r3+x]+A*v[r4+x]; }
      for(y=0;y<h2;y++){ var ro=y*w, oo=y*w2; for(var x2=0;x2<w2;x2++){ var xx=x2*step, s2;
          if(xx>=2&&xx+2<w){ var b0=ro+xx; s2=A*tmp[b0-2]+B*tmp[b0-1]+C*tmp[b0]+B*tmp[b0+1]+A*tmp[b0+2]; }
          else { s2=0; for(k=0;k<5;k++) s2+=TAPS[k]*tmp[ro+mirror(xx+k-2,w)]; }
          out[oo+x2]=s2; } }
      return {w:w2, h:h2, v:out}; }
    // Expansion taps per output index: up to 3 (source index, weight) pairs, the rest weight 0.
    var upCache={};
    function upTaps(n,lim){ var key=n+":"+lim; if(upCache[key]) return upCache[key]; var I=new Int32Array(n*3), W=new F32(n*3);
      for(var i=0;i<n;i++){ var c=0; for(var k=0;k<5;k++){ var m=mirror(i+k-2,n); if(m%2===0&&m/2<lim&&c<3){ I[i*3+c]=m/2; W[i*3+c]=TAPS[k]; c++; } } }
      var r={I:I,W:W}; upCache[key]=r; return r; }
    function up(P,w,h,out,tmp){ var lh=Math.min(P.h,Math.ceil(h/2)), lw=Math.min(P.w,Math.ceil(w/2)), x, y, pv=P.v, pw=P.w; tmp=tmp||new F32(lw*h); out=out||new F32(w*h);
      if(lw>0){ var ty=upTaps(h,lh), TI=ty.I, TW=ty.W;
        for(y=0;y<h;y++){ var o=y*lw, a0=TI[y*3]*pw, a1=TI[y*3+1]*pw, a2=TI[y*3+2]*pw, w0=TW[y*3]*4, w1=TW[y*3+1]*4, w2=TW[y*3+2]*4;
          for(var j=0;j<lw;j++) tmp[o+j]=w0*pv[a0+j]+w1*pv[a1+j]+w2*pv[a2+j]; } }
      var tx=upTaps(w,lw), XI=tx.I, XW=tx.W;
      var A=TAPS[0], B=TAPS[1], C=TAPS[2], xe=Math.min(w-2,2*lw-2);
      for(y=0;y<h;y++){ var to=y*lw, oo=y*w;
        for(x=0;x<w;x++){ if(x>=2&&x<xe){ var hx=to+(x>>1); out[oo+x]=(x&1)? B*(tmp[hx]+tmp[hx+1]) : A*(tmp[hx-1]+tmp[hx+1])+C*tmp[hx]; continue; }
          var x3=x*3; out[oo+x]=XW[x3]*tmp[to+XI[x3]]+XW[x3+1]*tmp[to+XI[x3+1]]+XW[x3+2]*tmp[to+XI[x3+2]]; } }
      return {w:w, h:h, v:out}; }
    function depth(w,h){ var s=Math.min(w,h), n=1; while(s>2){ s=Math.ceil(s/2); n++; } return n; }
    function gaussian(P,n){ var g=[P]; for(var i=1;i<n;i++) g.push(blurStep(g[g.length-1],2)); return g; }
    // remap(r, src, dst): fills dst with the remapped plane for reference level r.
    function llf(u,remap,refStep){ var n=depth(u.w,u.h), g=gaussian({w:u.w,h:u.h,v:new F32(u.v)},n), hi=-Infinity, i, l;
      for(i=0;i<u.v.length;i++) if(u.v[i]>hi) hi=u.v[i];
      var lo=Math.min(quantile(u.v,0.001),hi); if(!(hi-lo>1e-6)) return {w:u.w,h:u.h,v:new F32(u.v)};
      var refs=clamp(Math.ceil((hi-lo)/refStep)+1,2,96), step=(hi-lo)/(refs-1), lap=[], pos=[], gr=[], co=[], tb=Math.max(u.w*u.h,1);
      for(l=0;l<n;l++){ gr.push({w:g[l].w,h:g[l].h,v:new F32(g[l].v.length)}); if(l<n-1){ lap.push(new F32(g[l].v.length)); co.push(new F32(g[l].v.length));
          var gl=g[l].v, ps=new F32(gl.length); for(i=0;i<gl.length;i++) ps[i]=(clamp(gl[i],lo,hi)-lo)/step; pos.push(ps); } }
      var tmp=new F32(tb);
      for(var k=0;k<refs;k++){ var r=lo+step*k; remap(r,u.v,gr[0].v);
        for(l=1;l<n;l++) blurStep(gr[l-1],2,gr[l].v,tmp);
        for(l=0;l<n-1;l++){ var coarse=up(gr[l+1],gr[l].w,gr[l].h,co[l],tmp).v, fine=gr[l].v, L=lap[l], P=pos[l];
          for(i=0;i<L.length;i++){ var dd=P[i]-k; if(dd>-1&&dd<1){ var wg=dd<0?1+dd:1-dd; L[i]+=wg*(fine[i]-coarse[i]); } } } }
      var o={w:g[n-1].w,h:g[n-1].h,v:new F32(g[n-1].v)};
      for(l=n-2;l>=0;l--){ var nx=up(o,g[l].w,g[l].h); for(i=0;i<nx.v.length;i++) nx.v[i]+=lap[l][i]; o=nx; }
      return o; }
    function lrange(u){ var f=Math.max(Math.ceil(Math.max(u.w,u.h)/256),1), sw=Math.ceil(u.w/f), sh=Math.ceil(u.h/f), sum=new Float64Array(sw*sh), cnt=new Uint32Array(sw*sh);
      for(var y=0;y<u.h;y++) for(var x=0;x<u.w;x++){ var c=Math.floor(y/f)*sw+Math.floor(x/f); sum[c]+=u.v[y*u.w+x]; cnt[c]++; }
      var cells=[]; for(var i=0;i<sum.length;i++) if(cnt[i]) cells.push(sum[i]/cnt[i]); return [quantile(cells,0.01), quantile(cells,0.99)]; }
    function excess(d,sigma){ var t=d/sigma; return d-sigma*Math.tanh(t); }
    function knot(t,k){ var x=clamp(t,0,1)*4, i=Math.min(Math.floor(x),3); return k[i]+(k[i+1]-k[i])*(x-i); }
    var SH={own:[-0.017,0.466,0.886,1.221,-0.081], around:[4.566,4.067,1.088,0.149,0.878], sigma:0.571, down:0.808};
    var HL={pull:[0.179,0.141,0.196,0.629,2.07], push:[0.156,0.08,0.175,0.049,1.261], sigma:0.05};
    function highlightsPass(u,amount,refStep){ var R=lrange(u), lo=R[0], span=Math.max(R[1]-lo,1), st=amount<0?HL.pull:HL.push, sg=HL.sigma;
      var o=llf(u,function(g,src,dst){ var kk=knot((g-lo)/span,st)*amount; for(var i=0;i<src.length;i++){ var x=src[i], d=x-g; dst[i]=d>0? x+kk*(d-sg*Math.tanh(d/sg)) : x; } },refStep);
      var shift=quantile(u.v,0.01)-quantile(o.v,0.01); for(var i=0;i<o.v.length;i++) o.v[i]+=shift; return o; }
    function shadowsPass(u,amount,refStep){ var R=lrange(u), lo=R[0], span=Math.max(R[1]-lo,1), k=amount>0?amount:amount*SH.down, own=new F32(u.v.length), sg=SH.sigma;
      for(var j=0;j<own.length;j++) own[j]=knot((u.v[j]-lo)/span,SH.own);
      var o=llf(u,function(g,src,dst){ var ka=k*knot((g-lo)/span,SH.around); for(var i=0;i<src.length;i++){ var x=src[i], below=(g-x)/sg; if(below<=0){ dst[i]=x; continue; } if(below>1) below=1;
          dst[i]=x+ka*own[i]*below*below*(3-2*below); } },refStep);
      var shift=quantile(u.v,0.99)-quantile(o.v,0.99); for(var i=0;i<o.v.length;i++) o.v[i]+=shift; return o; }
    function shrink(u,f){ var sw=Math.ceil(u.w/f), sh=Math.ceil(u.h/f), v=new F32(sw*sh);
      for(var y=0;y<sh;y++) for(var x=0;x<sw;x++){ var x0=x*f, y0=y*f, x1=Math.min(x0+f,u.w), y1=Math.min(y0+f,u.h), s=0;
        for(var yy=y0;yy<y1;yy++) for(var xx=x0;xx<x1;xx++) s+=u.v[yy*u.w+xx]; v[y*sw+x]=s/((x1-x0)*(y1-y0)); }
      return {w:sw,h:sh,v:v}; }
    function guidedUpsample(small,d,full){ var sw=small.w, sh=small.h, r=2, eps=0.01, M=sw*sh, ud=new F32(M), uu=new F32(M), i;
      for(i=0;i<M;i++){ ud[i]=small.v[i]*d[i]; uu[i]=small.v[i]*small.v[i]; }
      var mu=boxMean(small.v,sw,sh,r), md=boxMean(d,sw,sh,r), mud=boxMean(ud,sw,sh,r), muu=boxMean(uu,sw,sh,r), a=new F32(M), b=new F32(M);
      for(i=0;i<M;i++){ a[i]=(mud[i]-mu[i]*md[i])/(muu[i]-mu[i]*mu[i]+eps); b[i]=md[i]-a[i]*mu[i]; }
      var ma=boxMean(a,sw,sh,r), mb=boxMean(b,sw,sh,r), fx=sw/full.w, fy=sh/full.h, out=new F32(full.w*full.h);
      for(var y=0;y<full.h;y++){ var sy=(y+0.5)*fy-0.5; for(var x=0;x<full.w;x++){ var sx=(x+0.5)*fx-0.5, k=y*full.w+x; out[k]=bilinear(ma,sw,sh,sx,sy)*full.v[k]+bilinear(mb,sw,sh,sx,sy); } }
      return out; }
    function localTone(px,w,h,shadows,highlights,workSide,refStep){ if((shadows===0&&highlights===0)||w<2||h<2) return;
      var FLOOR=1/65536, N=w*h, u={w:w,h:h,v:new F32(N)}, i;
      for(i=0;i<N;i++){ var j=i*3; u.v[i]=Math.log2(Math.max(luma(s2l(px[j]),s2l(px[j+1]),s2l(px[j+2])),0)+FLOOR); }
      var f=Math.max(Math.ceil(Math.max(w,h)/workSide),1), small=f===1?{w:w,h:h,v:new F32(u.v)}:shrink(u,f), o={w:small.w,h:small.h,v:new F32(small.v)};
      if(highlights!==0) o=highlightsPass(o,clamp(highlights,-100,100)/100,refStep);
      if(shadows!==0) o=shadowsPass(o,clamp(shadows,-100,100)/100,refStep);
      var change;
      if(f===1){ change=new F32(N); for(i=0;i<N;i++) change[i]=o.v[i]-u.v[i]; }
      else { var d=new F32(o.v.length); for(i=0;i<d.length;i++) d[i]=o.v[i]-small.v[i]; change=guidedUpsample(small,d,u); }
      for(i=0;i<N;i++){ var gain=Math.pow(2,change[i]), q=i*3; for(var c=0;c<3;c++) px[q+c]=l2s(s2l(px[q+c])*gain); } }
    // ---- Whites and Blacks: measured curves (tables filled in below) ----
    var WB=null;
    function wbCurve(rows,from,x,v){ if(v>=1) return 1; var r=clamp((x-from)/10,0,rows.length-1), i=Math.min(Math.floor(r),rows.length-2), t=r-i;
      function at(row){ var p=Math.max(v,0)*32, j=Math.min(Math.floor(p),31), s=p-j; return row[j]+(row[j+1]-row[j])*s; }
      return at(rows[i])*(1-t)+at(rows[i+1])*t; }
    function adapt(table,bp,wp){ function idx(grid,v){ v=clamp(v,grid[0],grid[grid.length-1]); var i=0; while(i<grid.length-2&&v>grid[i+1]) i++; return [i,(v-grid[i])/(grid[i+1]-grid[i])]; }
      var a=idx(WB.BPS,bp), b=idx(WB.WPS,wp), i=a[0], s=a[1], j=b[0], t=b[1]; function row(i){ return table[i][j]*(1-t)+table[i][j+1]*t; } return row(i)*(1-s)+row(i+1)*s; }
    function lumPoints(px,w,h){ var f=Math.max(Math.ceil(Math.max(w,h)/256),1), sw=Math.ceil(w/f), sh=Math.ceil(h/f), sum=new Float64Array(sw*sh*4);
      for(var y=0;y<h;y++) for(var x=0;x<w;x++){ var q=(y*w+x)*3, s=(Math.floor(y/f)*sw+Math.floor(x/f))*4; for(var c=0;c<3;c++) sum[s+c]+=clamp(s2l(px[q+c]),0,1); sum[s+3]+=1; }
      var L=[], M=[]; for(var k=0;k<sw*sh;k++){ var n=sum[k*4+3]; if(!n) continue; var r=sum[k*4]/n, g=sum[k*4+1]/n, b=sum[k*4+2]/n; L.push(luma(r,g,b)); M.push(Math.max(r,g,b)); }
      if(!L.length) return [0,1]; return [l2s(quantile(L,0.03)), l2s(quantile(M,0.995))]; }
    function whitesBlacks(px,w,h,wv,bv){ var P=lumPoints(px,w,h), bp=P[0], wp=P[1];
      var xw=wv>0?wv*adapt(WB.AW,bp,wp):wv, xb=bv<0?bv*Math.max(adapt(WB.AB,bp,wp),1.2):bv; xw=clamp(xw,-100,270); xb=clamp(xb,-100,100);
      if(xw===0&&xb===0) return;
      function grey(v){ if(xw!==0) v=wbCurve(WB.WHITES,-100,xw,v); if(xb!==0) v=wbCurve(WB.BLACKS,-100,xb,v); return v; }
      var per=xw>0||xb<0, N=w*h;
      for(var i=0;i<N;i++){ var q=i*3, r=s2l(px[q]), g=s2l(px[q+1]), b=s2l(px[q+2]);
        if(per){ var lin=[r,g,b]; for(var c=0;c<3;c++){ var over=Math.max(lin[c]-1,0); px[q+c]=l2s(s2l(grey(l2s(Math.min(lin[c],1))))+over); } }
        else { var y=Math.max(luma(r,g,b),0); if(y<=1e-7) continue; var y2=s2l(grey(l2s(Math.min(y,1))))+Math.max(y-1,0), k=y2/y; px[q]=l2s(r*k); px[q+1]=l2s(g*k); px[q+2]=l2s(b*k); } } }
    // ---- dehaze ----
    function dehaze(px,w,h,amount){ var k=Math.max(Math.ceil(Math.max(w,h)/768),1), sw=Math.ceil(w/k), sh=Math.ceil(h/k), M=sw*sh, small=new F32(M*3), cnt=new F32(M), i, c;
      for(var y=0;y<h;y++) for(var x=0;x<w;x++){ var s=Math.floor(y/k)*sw+Math.floor(x/k), q=(y*w+x)*3; for(c=0;c<3;c++) small[s*3+c]+=clamp(px[q+c],0,1); cnt[s]+=1; }
      for(i=0;i<M;i++) for(c=0;c<3;c++) small[i*3+c]/=Math.max(cnt[i],1);
      var r=Math.max(Math.floor(Math.max(sw,sh)/60),2);
      function minf(v){ var a=new F32(M), b=new F32(M), x, y, xx, yy, m;
        for(y=0;y<sh;y++) for(x=0;x<sw;x++){ m=Infinity; for(xx=Math.max(x-r,0);xx<=Math.min(x+r,sw-1);xx++) m=Math.min(m,v[y*sw+xx]); a[y*sw+x]=m; }
        for(y=0;y<sh;y++) for(x=0;x<sw;x++){ m=Infinity; for(yy=Math.max(y-r,0);yy<=Math.min(y+r,sh-1);yy++) m=Math.min(m,a[yy*sw+x]); b[y*sw+x]=m; }
        return b; }
      var dc=new F32(M); for(i=0;i<M;i++) dc[i]=Math.min(small[i*3],small[i*3+1],small[i*3+2]); var dark=minf(dc);
      var idx=new Uint32Array(M); for(i=0;i<M;i++) idx[i]=i; idx.sort(function(a,b){ return dark[b]-dark[a]; });
      var top=Math.max(Math.floor(M/1000),1), air=[0,0,0]; for(i=0;i<top;i++) for(c=0;c<3;c++) air[c]+=small[idx[i]*3+c]/top; air=air.map(function(v){ return Math.max(v,0.2); });
      var nd=new F32(M); for(i=0;i<M;i++) nd[i]=Math.min(small[i*3]/air[0],small[i*3+1]/air[1],small[i*3+2]/air[2]); var nds=minf(nd);
      var traw=new F32(M), guide=new F32(M); for(i=0;i<M;i++){ traw[i]=1-0.95*nds[i]; guide[i]=luma(small[i*3],small[i*3+1],small[i*3+2]); }
      var t=guided(guide,traw,sw,sh,r*2,1e-3);
      for(var y2=0;y2<h;y2++) for(var x2=0;x2<w;x2++){ var tv=clamp(bilinear(t,sw,sh,(x2+0.5)/k-0.5,(y2+0.5)/k-0.5),0.1,1), q2=(y2*w+x2)*3;
        for(c=0;c<3;c++){ var I=px[q2+c], J=(I-air[c])/tv+air[c]; px[q2+c]=amount>=0? I+(J-I)*amount : I+(air[c]-I)*(-amount)*0.5*(1-tv*0.5); } } }
    // ---- grain noise ----
    function hashFast(x,y,seed){ var h=Math.imul(x|0,0x27d4eb2d)^Math.imul(y|0,0x165667b1)^Math.imul(seed|0,0x9e3779b1); h=Math.imul(h^(h>>>15),0x85ebca6b); h=Math.imul(h^(h>>>13),0xc2b2ae35); h^=h>>>16; return (h>>>8)/16777216; }
    function vnoise(x,y,seed){ var xi=Math.floor(x), yi=Math.floor(y), tx=x-xi, ty=y-yi, sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
      var a=hashFast(xi,yi,seed), b=hashFast(xi+1,yi,seed), c=hashFast(xi,yi+1,seed), d=hashFast(xi+1,yi+1,seed), top=a+(b-a)*sx, bot=c+(d-c)*sx; return top+(bot-top)*sy; }
    // ---- tone curves, colour mixer, grading, detail, vignette ----
    function isLinear(c){ return !c||c.length<2||c.every(function(p){ return Math.abs(p[0]-p[1])<1e-3; }); }
    function lutEval(lut,v){ if(v<0) return v+lut[0]; if(v>1) return lut[lut.length-1]+(v-1); var x=v*(lut.length-1), i=Math.min(Math.floor(x),lut.length-2), t=x-i; return lut[i]+(lut[i+1]-lut[i])*t; }
    function curveLut(pts,n){ var p=pts.map(function(q){ return [q[0]/255,q[1]/255]; }).sort(function(a,b){ return a[0]-b[0]; }), dd=[];
      p=p.filter(function(q,i){ return i===0||Math.abs(q[0]-p[i-1][0])>=1e-6; });
      var out=new F32(n), k; if(p.length<2){ for(k=0;k<n;k++) out[k]=k/(n-1); return out; }
      var m=p.length, d=[], t=new Array(m).fill(0); for(k=0;k<m-1;k++) d.push((p[k+1][1]-p[k][1])/Math.max(p[k+1][0]-p[k][0],1e-6));
      t[0]=d[0]; t[m-1]=d[m-2]; for(k=1;k<m-1;k++) t[k]=d[k-1]*d[k]<=0?0:(d[k-1]+d[k])/2;
      for(k=0;k<m-1;k++){ if(d[k]===0){ t[k]=0; t[k+1]=0; continue; } var a=t[k]/d[k], b=t[k+1]/d[k], s=a*a+b*b; if(s>9){ var tau=3/Math.sqrt(s); t[k]=tau*a*d[k]; t[k+1]=tau*b*d[k]; } }
      for(var i=0;i<n;i++){ var x=i/(n-1); if(x<=p[0][0]){ out[i]=p[0][1]; continue; } if(x>=p[m-1][0]){ out[i]=p[m-1][1]; continue; }
        var j=0; while(j<m-2&&x>p[j+1][0]) j++; var hh=p[j+1][0]-p[j][0], u=(x-p[j][0])/hh;
        out[i]=clamp((2*u*u*u-3*u*u+1)*p[j][1]+(u*u*u-2*u*u+u)*hh*t[j]+(-2*u*u*u+3*u*u)*p[j+1][1]+(u*u*u-u*u)*hh*t[j+1],0,1); }
      return out; }
    function parametricLut(p,n){ var sp=(p.curveSplits||[25,50,75]).map(function(v){ return clamp(v,5,95)/100; }), cen=[sp[0]/2,(sp[0]+sp[1])/2,(sp[1]+sp[2])/2,(sp[2]+1)/2];
      var am=[p.curveShadows||0,p.curveDarks||0,p.curveLights||0,p.curveHighlights||0], wd=[Math.max(sp[0],0.1),Math.max(sp[1]-sp[0],0.1),Math.max(sp[2]-sp[1],0.1),Math.max(1-sp[2],0.1)], lut=new F32(n);
      for(var i=0;i<n;i++){ var x=i/(n-1), y=x; for(var k=0;k<4;k++){ var d=(x-cen[k])/(wd[k]*1.2); y+=am[k]/100*0.25*Math.exp(-d*d*2)*x*(1-x)*4; } lut[i]=clamp(y,0,1); if(i) lut[i]=Math.max(lut[i],lut[i-1]); }
      return lut; }
    function hueOf(r,g,b){ var mx=Math.max(r,g,b), d=mx-Math.min(r,g,b); if(d<=1e-9) return 0; if(mx===r) return 60*((((g-b)/d)%6+6)%6); if(mx===g) return 60*((b-r)/d+2); return 60*((r-g)/d+4); }
    function hsv2rgb(h,s,v){ h=((h%360)+360)%360/60; var c=v*s, x=c*(1-Math.abs((h%2)-1)), m=v-c, k=Math.floor(h), r, g, b;
      if(k===0){ r=c; g=x; b=0; } else if(k===1){ r=x; g=c; b=0; } else if(k===2){ r=0; g=c; b=x; } else if(k===3){ r=0; g=x; b=c; } else if(k===4){ r=x; g=0; b=c; } else { r=c; g=0; b=x; }
      return [r+m,g+m,b+m]; }
    // Band centres in OKLCH hue, so pixels sort by the colour people see, not by RGB arithmetic: grass lands under Green,
    // a banana under Yellow (in HSV, foliage sat halfway to yellow and warm yellows a third of the way to orange).
    var BANDS=[29,62,110,142,195,264,302,335];
    function okHue(r,g,b){ var lr=s2l(clamp(r,0,1)), lg=s2l(clamp(g,0,1)), lb=s2l(clamp(b,0,1));
      var l=Math.cbrt(0.4122214708*lr+0.5363325363*lg+0.0514459929*lb), m=Math.cbrt(0.2119034982*lr+0.6806995451*lg+0.1073969566*lb), s_=Math.cbrt(0.0883024619*lr+0.2817188376*lg+0.6299787005*lb);
      var A=1.9779984951*l-2.4285922050*m+0.4505937099*s_, B=0.0259040371*l+0.7827717662*m-0.8086757660*s_; return (Math.atan2(B,A)*180/Math.PI+360)%360; }
    var BW=new Array(8);
    function bandWeights(h){ var w=BW; for(var k=0;k<8;k++){ var c=BANDS[k], pv=BANDS[(k+7)%8], nx=BANDS[(k+1)%8], diff=((h-c+540)%360)-180;
        var span=diff>=0?(((nx-c)%360)+360)%360:(((c-pv)%360)+360)%360; w[k]=Math.max(1-Math.abs(diff)/Math.max(span,1e-3),0); } return w; }
    function detail(px,w,h,p,ps){ var N=w*h, y=new F32(N), cb=new F32(N), cr=new F32(N), i;
      for(i=0;i<N;i++){ var q=i*3; y[i]=luma(px[q],px[q+1],px[q+2]); cb[i]=px[q+2]-y[i]; cr[i]=px[q]-y[i]; }
      var nlum=p.noiseLuminance||0, ncol=p.noiseColor||0, sh=p.sharpenAmount||0;
      if(nlum>0){ var n=nlum/100, r=Math.max(Math.round((1+3*n)*ps),1), sm=guided(y,y,w,h,r,Math.pow(n*0.06,2)+1e-6), keep=(p.noiseLuminanceDetail==null?50:p.noiseLuminanceDetail)/100*0.5;
        for(i=0;i<N;i++) y[i]=sm[i]+(y[i]-sm[i])*keep; }
      if(ncol>0){ var sg=Math.max(ncol/100*6*ps,0.3), bcb=gauss(cb,w,h,sg), bcr=gauss(cr,w,h,sg), kc=(p.noiseColorDetail==null?50:p.noiseColorDetail)/100*0.3;
        for(i=0;i<N;i++){ cb[i]=bcb[i]+(cb[i]-bcb[i])*kc; cr[i]=bcr[i]+(cr[i]-bcr[i])*kc; } }
      if(sh>0){ var sig=Math.max(clamp(p.sharpenRadius==null?1:p.sharpenRadius,0.5,3)*ps,0.3), blur=gauss(y,w,h,sig), mask=null, msk=p.sharpenMasking||0;
        if(msk>0){ var s=gauss(y,w,h,Math.max(ps,0.5)), t=msk/100*0.08; mask=new F32(N);
          for(i=0;i<N;i++){ var x=i%w, yy=(i/w)|0, gx=s[yy*w+Math.min(x+1,w-1)]-s[yy*w+Math.max(x-1,0)], gy=s[Math.min(yy+1,h-1)*w+x]-s[Math.max(yy-1,0)*w+x]; mask[i]=smoothstep(t*0.5,t+1e-4,Math.hypot(gx,gy)); } }
        var amt=sh/100*1.2, det=(p.sharpenDetail==null?25:p.sharpenDetail)/100, lim=0.03+det*0.3;
        for(i=0;i<N;i++){ var hp=clamp(y[i]-blur[i],-lim,lim)*(0.5+0.5*det); y[i]+=amt*hp*(mask?mask[i]:1); } }
      for(i=0;i<N;i++){ var L=y[i], rr=cr[i]+L, bb=cb[i]+L, q2=i*3; px[q2]=rr; px[q2+1]=(L-0.2126*rr-0.0722*bb)/0.7152; px[q2+2]=bb; } }
    function vignette(px,w,h,p){ var amt=p.vignetteAmount/100, mid=clamp(p.vignetteMidpoint==null?50:p.vignetteMidpoint,0,100)/100, feather=clamp(p.vignetteFeather==null?50:p.vignetteFeather,0,100)/100;
      var round=clamp(p.vignetteRoundness||0,-100,100)/100, hl=clamp(p.vignetteHighlights||0,0,100)/100, style=p.vignetteStyle||"highlightPriority", cx=w/2, cy=h/2, ax=cx, ay=cy;
      if(round>=0){ var rr=Math.min(cx,cy)+(Math.max(cx,cy)-Math.min(cx,cy))*(1-round); ax=cx>=cy?rr:cx; ay=cy>cx?rr:cy; }
      var pw=2+Math.max(-round,0)*6, inner=1-mid*0.8, e0=inner-feather*0.5*inner, e1=inner+feather*0.5*(1.4-inner)+0.02;
      for(var y=0;y<h;y++) for(var x=0;x<w;x++){ var dx=Math.abs((x+0.5-cx)/ax), dy=Math.abs((y+0.5-cy)/ay), r=pw===2?Math.sqrt(dx*dx+dy*dy):Math.pow(Math.pow(dx,pw)+Math.pow(dy,pw),1/pw), m=smoothstep(e0,e1,r);
        if(m<=0) continue; var q=(y*w+x)*3, l=clamp(luma(px[q],px[q+1],px[q+2]),0,1), c;
        if(style==="paintOverlay"){ var tg=amt<0?0:1, k=m*Math.abs(amt); for(c=0;c<3;c++) px[q+c]+=(tg-px[q+c])*k; continue; }
        var kk=Math.pow(2,amt*2*m); if(amt<0&&hl>0) kk+=(1-kk)*smoothstep(0.6,1,l)*hl;
        if(style==="colorPriority"){ var nl=l*kk; for(c=0;c<3;c++) px[q+c]+=nl-l; } else { for(c=0;c<3;c++) px[q+c]*=kk; } } }
    // ---- the pipeline ----
    // px: Float32Array of sRGB-encoded RGB (0..1), modified in place. p: Camera Raw slider values.
    // opt.workSide / opt.refStep trade accuracy for speed on previews (Camera Raw's own: 1600 and 1/8 stop).
    function develop(px,w,h,p,opt){ opt=opt||{}; var N=w*h, i, q, c, ws=opt.workSide||1600, rs=opt.refStep||0.125, ps=clamp(opt.pixelScale||1,0.01,1), long=Math.max(w,h);
      var T=function(k){ return p[k]||0; };
      // Previews re-run often with only later sliders moving: keep the result of the slow stages (1–3a).
      var ck=opt.cache?[T("temperature"),T("tint"),T("exposure"),T("dehaze"),T("highlights"),T("shadows"),ws,rs,w,h].join(","):null, hit=null;
      if(ck){ opt.cache.list=opt.cache.list||[]; for(i=0;i<opt.cache.list.length;i++) if(opt.cache.list[i].k===ck) hit=opt.cache.list[i]; }
      if(hit) px.set(hit.v); else {
      if(T("temperature")||T("tint")||T("exposure")){ var g=[1+0.35*T("temperature")/100, 1-0.25*T("tint")/100, 1-0.35*T("temperature")/100], nl=luma(g[0],g[1],g[2]), e=Math.pow(2,T("exposure"));
        g=g.map(function(v){ return v/nl*e; }); for(i=0;i<N;i++){ q=i*3; for(c=0;c<3;c++) px[q+c]=l2s(Math.max(s2l(px[q+c])*g[c],0)); } }
      if(T("dehaze")) dehaze(px,w,h,T("dehaze")/100);
      if(T("highlights")||T("shadows")) localTone(px,w,h,T("shadows"),T("highlights"),ws,rs);
      if(ck){ opt.cache.list.unshift({k:ck,v:new F32(px)}); opt.cache.list.length=Math.min(opt.cache.list.length,2); } }
      if(T("contrast")||T("texture")||T("clarity")){ var L=new F32(N), lc=new F32(N);
        for(i=0;i<N;i++){ q=i*3; L[i]=Math.max(luma(px[q],px[q+1],px[q+2]),0); lc[i]=Math.min(L[i],1); }
        var clar=T("clarity")?guidedFast(lc,lc,w,h,Math.max(Math.floor(long*0.02),3),0.005):null, tex=T("texture")?gauss(lc,w,h,Math.max(long*0.002,1.5*ps)):null, kc=T("contrast")/100*0.6, TAU=Math.PI*2;
        for(i=0;i<N;i++){ var l0=L[i], lv=lc[i];
          if(clar){ var mw=1-Math.pow(2*clamp(lv,0,1)-1,2); lv+=T("clarity")/100*0.8*(lc[i]-clar[i])*mw; }
          if(tex) lv+=T("texture")/100*0.9*clamp(lc[i]-tex[i],-0.1,0.1);
          if(kc!==0){ var xx=clamp(lv,0,1); lv+=-kc*Math.sin(TAU*xx)/TAU; }
          lv=Math.max(lv,0)+(l0-lc[i]); q=i*3;
          if(l0>1e-5){ var ratio=lv/l0; px[q]*=ratio; px[q+1]*=ratio; px[q+2]*=ratio; } else { px[q]+=lv-l0; px[q+1]+=lv-l0; px[q+2]+=lv-l0; } } }
      if(T("whites")||T("blacks")) whitesBlacks(px,w,h,clamp(T("whites"),-100,100),clamp(T("blacks"),-100,100));
      var curvesOn=T("curveHighlights")||T("curveLights")||T("curveDarks")||T("curveShadows")||!isLinear(p.pointCurve)||!isLinear(p.pointCurveRed)||!isLinear(p.pointCurveGreen)||!isLinear(p.pointCurveBlue);
      var hslOn=[p.hslHue,p.hslSat,p.hslLum].some(function(a){ return a&&a.some(function(v){ return v; }); });
      var W=function(k){ var o=p[k]||{}; return {hue:o.hue||0, sat:o.sat||0, lum:o.lum||0}; }, wheels=[W("gradeShadows"),W("gradeMidtones"),W("gradeHighlights"),W("gradeGlobal")];
      var gradeOn=wheels.some(function(o){ return o.sat||o.lum; });
      var mono=!!p.mono, hdr=!!p.hdr;
      if(T("vibrance")||T("saturation")||curvesOn||hslOn||gradeOn||mono||hdr){ var sa=T("saturation")/100, vi=T("vibrance")/100, vs=sa||vi;
        var par=(T("curveHighlights")||T("curveLights")||T("curveDarks")||T("curveShadows"))?parametricLut(p,1024):null;
        function pts(c){ return isLinear(c)?null:curveLut(c,1024); }
        var cm=pts(p.pointCurve), cr=pts(p.pointCurveRed), cg=pts(p.pointCurveGreen), cb=pts(p.pointCurveBlue);
        var hh=p.hslHue||[0,0,0,0,0,0,0,0], hs=p.hslSat||[0,0,0,0,0,0,0,0], hl=p.hslLum||[0,0,0,0,0,0,0,0];
        var tints=wheels.map(function(o){ var c=hsv2rgb(o.hue,1,1), l=luma(c[0],c[1],c[2]); return [c[0]-l,c[1]-l,c[2]-l].map(function(v){ return v*o.sat/100*0.3; }); });
        var blend=0.15+clamp(p.gradeBlending==null?50:p.gradeBlending,0,100)/100*0.35, bal=clamp(T("gradeBalance"),-100,100)/100*0.25, lums=wheels.map(function(o){ return o.lum; });
        var C=[0,0,0];
        for(i=0;i<N;i++){ q=i*3; C[0]=px[q]; C[1]=px[q+1]; C[2]=px[q+2];
          if(vs){ var l=luma(C[0],C[1],C[2]), mx=Math.max(C[0],C[1],C[2]), mn=Math.min(C[0],C[1],C[2]), sat=mx>1e-6?(mx-mn)/mx:0, hue=hueOf(C[0],C[1],C[2]);
            var skin=clamp(1-Math.abs(hue-25)/25,0,1)*0.5, k=Math.max(1+sa+vi*(1-sat)*(1-skin),0);
            for(c=0;c<3;c++) C[c]=l+(C[c]-l)*k; }
          if(par) for(c=0;c<3;c++) C[c]=lutEval(par,C[c]);
          if(cm) for(c=0;c<3;c++) C[c]=lutEval(cm,C[c]);
          if(cr) C[0]=lutEval(cr,C[0]); if(cg) C[1]=lutEval(cg,C[1]); if(cb) C[2]=lutEval(cb,C[2]);
          if(hslOn){ var r0=Math.max(C[0],0), g0=Math.max(C[1],0), b0=Math.max(C[2],0), v0=Math.max(r0,g0,b0), d0=v0-Math.min(r0,g0,b0), s0=v0>1e-9?d0/v0:0;
            if(s0>1e-4){ var h0=hueOf(r0,g0,b0), wt=bandWeights(okHue(r0,g0,b0)), dh=0, ds=0, dl=0; for(var b8=0;b8<8;b8++){ dh+=wt[b8]*hh[b8]; ds+=wt[b8]*hs[b8]; dl+=wt[b8]*hl[b8]; }
              var out=hsv2rgb(h0+dh/100*30, clamp(s0*(1+ds/100),0,1), v0), L0=luma(C[0],C[1],C[2]), L1=luma(out[0],out[1],out[2]);
              if(L1>1e-6) for(c=0;c<3;c++) out[c]*=L0/L1;
              var kl=Math.pow(2,dl/100*s0); for(c=0;c<3;c++) C[c]=out[c]*kl; } }
          if(mono){ var lmo=luma(C[0],C[1],C[2]); C[0]=C[1]=C[2]=lmo; }   // B&W after the mixer, so its luminance column mixes the grey
          if(gradeOn){ var lg0=clamp(luma(C[0],C[1],C[2]),0,1), shm=1-smoothstep(0,0.5+bal+blend,lg0), him=smoothstep(0.5+bal-blend,1,lg0), masks=[shm,Math.max(1-shm-him,0),him,1];
            for(var w4=0;w4<4;w4++){ for(c=0;c<3;c++) C[c]+=masks[w4]*tints[w4][c]; if(lums[w4]){ var fl=Math.pow(2,masks[w4]*lums[w4]/100*0.6); for(c=0;c<3;c++) C[c]*=fl; } } }
          if(hdr) for(c=0;c<3;c++){ var xh=Math.max(C[c],0); C[c]=(xh*(2.51*xh+0.03))/(xh*(2.43*xh+0.59)+0.14)*1.06; }   // Studium's HDR look: a filmic shoulder
          px[q]=C[0]; px[q+1]=C[1]; px[q+2]=C[2]; } }
      if(T("noiseLuminance")>0||T("noiseColor")>0||T("sharpenAmount")>0) detail(px,w,h,p,ps);
      if(T("filmBlend")>0&&FILM[p.filmLook]) filmLook(px,N,FILM[p.filmLook],T("filmBlend")/100,T("skinBias")/100,T("fade")/100);
      if(T("gmapOpacity")>0&&p.gmapStops&&p.gmapStops.length>=2) gradientMap(px,N,p.gmapStops,p.gmapMode||"softlight",T("gmapOpacity")/100);
      if(T("glow")>0){ var gl=new F32(N); for(i=0;i<N;i++){ q=i*3; gl[i]=Math.max(Math.max(px[q],px[q+1],px[q+2])-0.6,0); }   // Studium's Glow: a soft bloom from the brights
        var gb=gauss(gl,w,h,Math.max(long*0.008,1)), ka=T("glow")/100*1.3; for(i=0;i<N;i++){ var gv=gb[i]*ka; q=i*3; px[q]+=gv; px[q+1]+=gv; px[q+2]+=gv; } }
      if(T("halation")>0){   // Studium's Halation: film's red bleed round the brights (light scattering back through the emulsion into the red layer).
        // Threshold picks what counts as bright (soft knee), Spread sets the radius; the glow is a tight core plus a wide tail, like
        // the real thing, screened on in the tint so it shows on the dark side of an edge and never clips the highlight itself.
        var th=0.15+(p.halationThreshold==null?70:p.halationThreshold)/100*0.8, knee=Math.min(th+0.2,1), hl=new F32(N);
        for(i=0;i<N;i++){ q=i*3; var hm=Math.max(px[q]*0.5+px[q+1]*0.4+px[q+2]*0.1, px[q]*0.9); hl[i]=smoothstep(th,knee,hm)*Math.min(hm,1.5); }
        var hsg=Math.max(long*(0.002+(p.halationSpread==null?40:p.halationSpread)/100*0.022),1), hb1=gauss(hl,w,h,hsg), hb2=gauss(hl,w,h,hsg*3.2);
        var hk=T("halation")/100*2.4, hu=(p.halationHue==null?30:p.halationHue)/100, tg=0.16+hu*0.5, tb=0.02+hu*0.12;
        for(i=0;i<N;i++){ var hv=Math.min((hb1[i]*0.7+hb2[i]*0.5)*hk,1); if(hv<=0.0005) continue; q=i*3; px[q]+=hv*(1-Math.min(px[q],1)); px[q+1]+=tg*hv*(1-Math.min(px[q+1],1)); px[q+2]+=tb*hv*(1-Math.min(px[q+2],1)); } }
      if(T("vignetteAmount")) vignette(px,w,h,p);
      if(T("grainAmount")>0){ var cell=1+(p.grainSize==null?25:p.grainSize)/25, rough=(p.grainRoughness==null?50:p.grainRoughness)/100, ga=T("grainAmount")/100*0.12, sd=p.seed||0, pscale=1/ps;
        for(var y3=0;y3<h;y3++) for(var x3=0;x3<w;x3++){ var fx=x3*pscale/cell, fy=y3*pscale/cell, n=vnoise(fx,fy,sd)*(1-rough)+vnoise(fx*2.3,fy*2.3,sd+7)*rough; q=(y3*w+x3)*3;
          var lgr=clamp(luma(px[q],px[q+1],px[q+2]),0,1), gn=(n-0.5)*2*ga*(0.4+2.4*lgr*(1-lgr)); px[q]+=gn; px[q+1]+=gn; px[q+2]+=gn; } }
      for(i=0;i<N*3;i++) px[i]=clamp(px[i],0,1); }
    // ---- Studium's film looks: a stack of sliders, not a LUT. Each look is a toe, an S curve, subtractive saturation
    // (strong colours get denser, not brighter), richness (more colour in the mids and shadows than the highlights) and a
    // split tone; Blend mixes the whole look in; Skin bias protects (+) or exposes (−) skin tones to it, and warms or cools them.
    var FILM={ cinematic:{toe:0.02,s:0.35,sub:0.22,rich:0.12,sh:[-0.03,0.0,0.05],hi:[0.05,0.02,-0.03],warm:0.01},
      faded:{toe:0.07,s:-0.15,sub:0.3,rich:0.0,sh:[0.0,0.02,0.04],hi:[0.05,0.035,0.0],warm:0.02},
      chrome:{toe:0.0,s:0.55,sub:0.1,rich:0.25,sh:[-0.02,0.0,0.06],hi:[0.0,0.0,0.0],warm:0.0},
      warm:{toe:0.03,s:0.2,sub:0.18,rich:0.15,sh:[0.02,0.01,-0.02],hi:[0.06,0.03,-0.02],warm:0.035},
      noir:{toe:0.01,s:0.6,sub:1.0,rich:0.0,sh:[0,0,0],hi:[0,0,0],warm:0.0,mono:1,red:1} };
    function filmLook(px,N,L,blend,skin,fade){ var toe=L.toe+fade*0.12, sc=L.s, sub=L.sub, rich=L.rich, sh=L.sh, hi=L.hi;
      for(var i=0;i<N;i++){ var q=i*3, r0=px[q], g0=px[q+1], b0=px[q+2], r=r0, g=g0, b=b0, c, C=[r,g,b];
        var lm0=clamp(luma(r0,g0,b0),0,1), mx=Math.max(r0,g0,b0), mn=Math.min(r0,g0,b0), st=mx>1e-5?(mx-mn)/mx:0;
        if(L.mono){ var lw=L.red?clamp(0.5*r0+0.4*g0+0.1*b0,0,1):lm0; C=[lw,lw,lw]; }
        for(c=0;c<3;c++){ var x=clamp(C[c],0,1), s3=x*x*(3-2*x), y=x+(s3-x)*sc; C[c]=toe+(1-toe)*y; }   // toe and S curve
        var lm=clamp(luma(C[0],C[1],C[2]),0,1), den=Math.max(C[0],C[1],C[2])-lm;
        for(c=0;c<3;c++){ C[c]=lm+(C[c]-lm)*(1-sub*0.45)-sub*0.35*den;   // subtractive saturation: colour comes off as density
          C[c]=lm+(C[c]-lm)*(1+rich*(1-lm)*1.2); }                       // richness: more colour where it's darker
        var wsh=(1-lm)*(1-lm), whi=lm*lm; for(c=0;c<3;c++) C[c]+=sh[c]*wsh+hi[c]*whi+L.warm*(c===0?1:c===1?0.35:-0.6)*0.5;   // split tone and warmth
        // skin: hue 10..45°, some colour, mid tones. Positive bias keeps the look off skin and warms it; negative lets it through and cools it.
        var hue=0; if(mx-mn>1e-5){ if(mx===r0) hue=((g0-b0)/(mx-mn)+6)%6; else if(mx===g0) hue=(b0-r0)/(mx-mn)+2; else hue=(r0-g0)/(mx-mn)+4; hue*=60; }
        var sm=(hue>=8&&hue<=48&&st>0.1&&lm0>0.15&&lm0<0.92)?smoothstep(0.1,0.3,st)*(1-Math.abs(hue-28)/22):0, kb=blend*(1-Math.max(skin,0)*sm);
        for(c=0;c<3;c++){ var v=[r0,g0,b0][c]+(C[c]-[r0,g0,b0][c])*kb; v+=sm*skin*0.04*(c===0?1:c===1?0.25:-0.5); px[q+c]=v; } } }
    // ---- Gradient Map, as in Photoshop: the luminance picks a colour off the ramp, then that colour is blended over ----
    function gradientMap(px,N,stops,mode,op){ var S=stops.slice().sort(function(a,b){ return a[0]-b[0]; }), L=new F32(256*3), i, c;
      for(i=0;i<256;i++){ var x=i/255, j=0; while(j<S.length-2&&x>S[j+1][0]) j++; var a=S[j], b=S[j+1], t=clamp((x-a[0])/Math.max(b[0]-a[0],1e-6),0,1); for(c=0;c<3;c++) L[i*3+c]=a[1+c]+(b[1+c]-a[1+c])*t; }
      function soft(bs,cl){ return cl<=0.5?bs-(1-2*cl)*bs*(1-bs):bs+(2*cl-1)*((bs<=0.25?((16*bs-12)*bs+4)*bs:Math.sqrt(bs))-bs); }
      function over(bs,cl){ return bs<=0.5?2*bs*cl:1-2*(1-bs)*(1-cl); }
      for(i=0;i<N;i++){ var q=i*3, r=clamp(px[q],0,1), g=clamp(px[q+1],0,1), bb=clamp(px[q+2],0,1), lm=clamp(luma(r,g,bb),0,1), k=Math.round(lm*255)*3, B=[r,g,bb], out=[0,0,0];
        if(mode==="color"){ var lc=luma(L[k],L[k+1],L[k+2]), kk=lc>1e-4?lm/lc:0; for(c=0;c<3;c++) out[c]=clamp(L[k+c]*kk,0,1); }
        else for(c=0;c<3;c++){ var cl=L[k+c], bs=B[c]; out[c]=mode==="normal"?cl:mode==="multiply"?bs*cl:mode==="screen"?1-(1-bs)*(1-cl):mode==="overlay"?over(bs,cl):soft(bs,cl); }
        for(c=0;c<3;c++) px[q+c]=B[c]+(out[c]-B[c])*op; } }
    return {develop:develop, setTables:function(t){ WB=t; }};
  }

  // ---- page side: Studium's sliders → Camera Raw settings, and the workers that run them ----
  var CR_PROF={ color:{sat:0,con:0,warm:0,vib:0}, mono:{sat:0,con:0,warm:0,vib:0}, vivid:{sat:12,con:10,warm:0,vib:15}, flat:{sat:-20,con:-25,warm:0,vib:0}, portrait:{sat:-5,con:-5,warm:10,vib:0} };
  function crParams(E){ var lm=E.secLight?1:0, cm=E.secColor?1:0, fm=E.secEffects?1:0, pr=CR_PROF[E.profile]||CR_PROF.color;
    return { exposure:E.exposure/50*lm, contrast:(E.contrast+pr.con)*lm, highlights:E.highlights*lm, shadows:E.shadows*lm, whites:E.whites*lm, blacks:E.blacks*lm,
      temperature:(E.temp+pr.warm)*cm, tint:E.tint*cm, vibrance:(E.vibrance+pr.vib)*cm, saturation:(E.saturation+pr.sat)*cm,
      texture:E.texture*fm, clarity:E.clarity*fm, dehaze:E.dehaze*fm, vignetteAmount:E.vignette*fm, glow:(E.glow||0)*fm,
      grainAmount:E.grain*fm, grainSize:E.grainSize, grainRoughness:E.grainRough, mono:E.mono?1:0, hdr:E.hdr?1:0, seed:7,
      gmapOpacity:(E.secGmap==null||E.secGmap)?(E.gmOpacity||0):0, gmapMode:E.gmMode||"softlight", gmapStops:crStops(E.gmStops),
      filmLook:E.film||"none", filmBlend:(E.film&&E.film!=="none"&&(E.secFilm==null||E.secFilm)?(E.filmBlend==null?100:E.filmBlend):0), skinBias:E.skinBias||0, fade:E.fade||0,
      halation:(E.halation||0)*fm, halationSpread:E.halSpread==null?40:E.halSpread, halationThreshold:E.halThresh==null?70:E.halThresh, halationHue:E.halHue==null?30:E.halHue,
      hslHue:crBands(E,"hH",E.secMix), hslSat:crBands(E,"hS",E.secMix), hslLum:crBands(E,"hL",E.secMix),
      gradeShadows:crWheel(E,"gSh",E.secGrade), gradeMidtones:crWheel(E,"gMi",E.secGrade), gradeHighlights:crWheel(E,"gHi",E.secGrade), gradeGlobal:crWheel(E,"gGl",E.secGrade),
      gradeBlending:E.gBlend==null?50:E.gBlend, gradeBalance:(E.gBal||0),
      pointCurve:crCurve(E.cvM,E.secCurve), pointCurveRed:crCurve(E.cvR,E.secCurve), pointCurveGreen:crCurve(E.cvG,E.secCurve), pointCurveBlue:crCurve(E.cvB,E.secCurve),
      curveHighlights:crOn(E.cvHi,E.secCurve), curveLights:crOn(E.cvLi,E.secCurve), curveDarks:crOn(E.cvDa,E.secCurve), curveShadows:crOn(E.cvSh,E.secCurve) }; }
  function crOn(v,on){ return (on==null||on)?(v||0):0; }
  function crStops(st){ if(!st||st.length<2) return null; return st.map(function(s){ var h=String(s[1]||"#000000").replace("#",""); if(h.length===3) h=h.replace(/./g,function(ch){ return ch+ch; }); var n=parseInt(h,16)||0; return [+s[0]||0,((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]; }); }
  function crCurve(c,on){ return (on==null||on)&&c&&c.length>=2?c:null; }
  function crBands(E,k,on){ var a=[]; for(var i=0;i<8;i++) a.push((E[k+i]||0)*(on==null||on?1:0)); return a; }
  function crWheel(E,k,on){ var m=(on==null||on)?1:0; return {hue:E[k+"H"]||0, sat:(E[k+"S"]||0)*m, lum:(E[k+"L"]||0)*m}; }
  function CRWORKER(self, E){   // message handler shared by the Web Worker and the main-thread fallback
    var srcs=[], cache={};
    function rgb(d,n){ var o=new Float32Array(n*3); for(var i=0,j=0;i<n;i++,j+=4){ o[i*3]=d[j]/255; o[i*3+1]=d[j+1]/255; o[i*3+2]=d[j+2]/255; } return o; }
    function rgba(px,n){ var o=new Uint8ClampedArray(n*4); for(var i=0,j=0;i<n;i++,j+=4){ o[j]=px[i*3]*255+0.5; o[j+1]=px[i*3+1]*255+0.5; o[j+2]=px[i*3+2]*255+0.5; o[j+3]=255; } return o; }
    return function(m, post){ var px, out, n;
      if(m.t==="src"){ srcs=srcs.filter(function(s){ return s.key!==m.key; }); srcs.unshift({key:m.key,w:m.w,h:m.h,v:rgb(m.data,m.w*m.h)}); srcs.length=Math.min(srcs.length,3); return; }
      if(m.t==="run"){ var s=null; srcs.forEach(function(x){ if(x.key===m.key) s=x; }); if(!s){ post({id:m.id,miss:1}); return; }
        for(var ck in cache) if(!srcs.some(function(x){ return x.key===ck; })) delete cache[ck];
        var c=cache[m.key]||(cache[m.key]={});
        px=new Float32Array(s.v); var o=m.opt||{}; o.cache=c; E.develop(px,s.w,s.h,m.p,o); n=s.w*s.h; out=rgba(px,n); post({id:m.id,w:s.w,h:s.h,data:out},[out.buffer]); return; }
      if(m.t==="bake"){ n=m.w*m.h; px=rgb(m.data,n); m.data=null; E.develop(px,m.w,m.h,m.p,m.opt||{}); out=rgba(px,n); post({id:m.id,w:m.w,h:m.h,data:out},[out.buffer]); } }; }
  function crMakeWorker(){ var w=null;
    try{ var code="var CR_TABLES="+JSON.stringify(CR_TABLES)+";var E=("+CRENGINE.toString()+")();E.setTables(CR_TABLES);var H=("+CRWORKER.toString()+")(self,E);"
        +"onmessage=function(ev){ try{ H(ev.data,function(r,t){ postMessage(r,t||[]); }); }catch(e){ postMessage({id:ev.data.id,err:String(e)}); } };";
      w=new Worker(URL.createObjectURL(new Blob([code],{type:"text/javascript"}))); }catch(e){ w=null; }
    if(w) return w;
    // no workers here: same engine on the main thread, one message per tick
    var E=CRENGINE(); E.setTables(CR_TABLES); var H=CRWORKER(null,E), fake={onmessage:null};
    fake.postMessage=function(m){ setTimeout(function(){ H(m,function(r){ if(fake.onmessage) fake.onmessage({data:r}); }); },0); }; return fake; }
  // A small pool: messages carry an id, replies come back to the callback registered for it.
  function crPool(size){ var ws=[], cbs={}, nid=1, rr=0;
    function get(k){ if(!ws[k]){ ws[k]=crMakeWorker(); ws[k].onmessage=function(ev){ var r=ev.data, f=cbs[r.id]; delete cbs[r.id]; if(f) f(r); }; ws[k].onerror=function(e){ console.warn("develop worker",e&&e.message); }; } return ws[k]; }
    return { send:function(m,cb,k,tr){ m.id=nid++; if(cb) cbs[m.id]=cb; var w=get(k==null?(rr++%size):k); w.postMessage(m,tr||[]); return m.id; }, size:size }; }
  var crPrev=null, crBakePool=null;
  // ---- live preview: a draft while a slider moves, the full preview once it settles ----
  // Three passes, each shown only if nothing newer is waiting: a draft (≤900 px) while a slider moves, the full
  // preview at the stage's size when it rests, then a sharp pass at the screen's real pixels (retina, and zoomed in).
  var crv={sent:[], busy:false, pend:null, settle:0, last:null, zt:0};
  function crSrcFor(cr,ow,oh){ var c=document.createElement("canvas"); c.width=ow; c.height=oh; var x=c.getContext("2d"); x.imageSmoothingQuality="high"; x.drawImage(edRC,cr.x,cr.y,cr.w,cr.h,0,0,ow,oh); return x.getImageData(0,0,ow,oh); }
  // the canvas fills the stage (fitted to the crop); returns css size and the pixel scales for each pass
  function crView(cr){ var stg=$("editStage"), W=stg?stg.clientWidth-28:0, H=stg?stg.clientHeight-28:0;
    var s=(W>40&&H>40)?Math.min(W/cr.w,H/cr.h):Math.min(980/cr.w,980/cr.h); if(!isFinite(s)||s<=0) s=1;
    var dpr=Math.min(window.devicePixelRatio||1,3), hi=Math.min(1,s*dpr*Math.max(1,edVZoom)), cap=Math.sqrt(10e6/(cr.w*cr.h)); if(hi>cap) hi=cap;
    return {cw:cr.w*s, ch:cr.h*s, hi:hi, fin:Math.min(hi,s), dr:Math.min(hi,s,900/Math.max(cr.w,cr.h))}; }
  function crRequest(mode){ if(!edState||!edRC) return; if(!crPrev) crPrev=crPool(1);
    var cr=cropRect(), V=crView(cr), sc=mode==="draft"?V.dr:mode==="final"?V.fin:V.hi;
    var ow=Math.max(2,Math.round(cr.w*V.hi)), oh=Math.max(2,Math.round(cr.h*V.hi)), dw=Math.max(2,Math.round(cr.w*sc)), dh=Math.max(2,Math.round(cr.h*sc));
    if(mode==="hires"&&dw<=Math.round(cr.w*V.fin)*1.1) return;   // the full preview is already sharp enough
    var cv=$("editCanvas"); if(cv){ cv.style.width=V.cw.toFixed(1)+"px"; cv.style.height=V.ch.toFixed(1)+"px"; }
    var key=[edState.i,edState.rot,Math.round(cr.x),Math.round(cr.y),Math.round(cr.w),Math.round(cr.h),dw,dh,edSrc&&edSrc.src.length,edSrc&&edSrc.src.slice(-40)].join("|");
    crv.pend={mode:mode,key:key,cr:cr,ow:ow,oh:oh,dw:dw,dh:dh,p:crParams(edState),orig:edShowOrig}; crPump(); }
  function crZoomed(){ clearTimeout(crv.zt); crv.zt=setTimeout(function(){ if(!crv.pend) crRequest("hires"); },260); }
  function crPump(){ if(crv.busy||!crv.pend) return; var r=crv.pend; crv.pend=null;
    if(r.orig){ var v0=$("editCanvas"); if(v0.width!==r.ow||v0.height!==r.oh){ v0.width=r.ow; v0.height=r.oh; } var x0=v0.getContext("2d"); x0.imageSmoothingQuality="high"; x0.drawImage(edRC,r.cr.x,r.cr.y,r.cr.w,r.cr.h,0,0,r.ow,r.oh);
      try{ var id0=x0.getImageData(0,0,r.ow,r.oh); crv.last={w:r.ow,h:r.oh,data:id0.data}; }catch(e){} crv.shown="orig"; scheduleHist(); return; }
    if(crv.sent.indexOf(r.key)<0){ var im=crSrcFor(r.cr,r.dw,r.dh); crPrev.send({t:"src",key:r.key,w:r.dw,h:r.dh,data:im.data},null,0,[im.data.buffer]); crv.sent.unshift(r.key); crv.sent.length=Math.min(crv.sent.length,3); }
    crv.busy=true; var t0=performance.now(), ps=r.dw/r.cr.w;
    crPrev.send({t:"run",key:r.key,mode:r.mode,p:r.p,opt:r.mode==="draft"?{workSide:320,refStep:0.25,pixelScale:ps}:{workSide:800,pixelScale:ps}},function(res){ crv.busy=false;
      if(res.miss){ crv.sent=[]; if(!crv.pend) crv.pend=r; crPump(); return; }
      if(res.err){ console.warn("develop:",res.err); crPump(); return; }
      if(!crv.pend||crv.pend.mode==="draft"||r.mode!=="draft") crShow(res,r);
      crv.ms=performance.now()-t0; if(r.mode==="final"&&!crv.pend) crRequest("hires"); crPump(); },0); }
  function crShow(res,r){ var v=$("editCanvas"); if(v.width!==r.ow||v.height!==r.oh){ v.width=r.ow; v.height=r.oh; } var x=v.getContext("2d"), id=new ImageData(res.data,res.w,res.h);
    if(res.w===r.ow&&res.h===r.oh) x.putImageData(id,0,0);
    else { var t=document.createElement("canvas"); t.width=res.w; t.height=res.h; t.getContext("2d").putImageData(id,0,0); x.imageSmoothingQuality="high"; x.drawImage(t,0,0,r.ow,r.oh); }
    crv.last={w:res.w,h:res.h,data:res.data}; crv.shown=r.mode; scheduleHist(); }
  // ---- full-resolution renders (leaving a frame, Sync, Make a copy) ----
  function crRotCrop(img,E){ var iw=img.naturalWidth, ih=img.naturalHeight, rot=E.rot||0, rw=(rot%180===0)?iw:ih, rh=(rot%180===0)?ih:iw;
    var c=document.createElement("canvas"); c.width=rw; c.height=rh; var x=c.getContext("2d"); x.translate(rw/2,rh/2); x.rotate(rot*Math.PI/180); x.drawImage(img,-iw/2,-ih/2);
    var cr=cropRectFor(E,rw,rh), ow=Math.max(2,Math.round(cr.w)), oh=Math.max(2,Math.round(cr.h)), o=document.createElement("canvas"); o.width=ow; o.height=oh;
    var ox=o.getContext("2d"); ox.drawImage(c,cr.x,cr.y,cr.w,cr.h,0,0,ow,oh); return o; }
  function crBake(img,E,cb){ if(!crBakePool) crBakePool=crPool(Math.max(1,Math.min(3,((navigator.hardwareConcurrency||2)-2)||1)));
    var o=crRotCrop(img,E), x=o.getContext("2d"), id; try{ id=x.getImageData(0,0,o.width,o.height); }catch(e){ cb(null); return; }
    crBakePool.send({t:"bake",w:o.width,h:o.height,data:id.data,p:crParams(E),opt:{}},function(r){ if(!r||r.err||!r.data){ if(r&&r.err) console.warn("bake:",r.err); cb(null); return; }
      x.putImageData(new ImageData(r.data,r.w,r.h),0,0); var url=null; try{ url=o.toDataURL("image/jpeg",0.92); }catch(e){} cb(url); },null,[id.data.buffer]); }
