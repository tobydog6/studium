  // ================= RACK-IN: the launch page =================
  // A still of the Stump rendered from the scan with its own depth map (assets/launch/rack-stump.jpg, rack-depth.png),
  // drawn by a small shader so it never lags: wherever the pointer goes, the lens racks to that depth (blur by real
  // distance), leaves sway in light wind, and the ivy nearer than the name passes over the letters. The name hangs a few
  // metres back with a warm halation; the Launch the demo button sits in the foreground, so each is only sharp when you
  // focus on it. The scan itself loads behind the page but isn't drawn until the demo's opening takes over.
  var RF={on:false, el:null, f:0.9, ft:0.9, idle:true, t0:0, raf:0, px:-1, py:-1, going:false, over:null, gl:null, last:0, failed:false};
  var RF_WORD=1.6, RF_BTN=0.95, RF_INV=[0.0166667,1.0716332], RF_IA=1.6;   /* depth png holds 1/metres between these; the still is 16:10 */
  var RF_SUB="Shoot, edit, research and build your folio, all in one place";
  function rfEl(){ var e=$("rackin"); if(e) return e; e=document.createElement("div"); e.id="rackin";
    e.innerHTML='<canvas class="rf-cv"></canvas><div class="rf-dark"></div>'
      +'<h1 class="rf-sr">Studium. '+RF_SUB+'.</h1>'
      +'<button class="rf-go" type="button"><span class="face sharp"><span class="t">Launch the demo</span><span class="s">ABOUT 40 MIN</span></span><span class="face soft" aria-hidden="true"><span class="t">Launch the demo</span><span class="s">ABOUT 40 MIN</span></span></button>'
      +'<button class="rf-fresh" type="button" title="Start the demo as if you have never opened Studium on this computer">START FRESH<span>FIRST VISIT AGAIN</span></button><div class="rf-hint">MOVE TO FOCUS</div><div class="rf-wait">OPENING THE STUMP</div><div class="rf-acct"></div>';
    document.body.appendChild(e);
    e.addEventListener("pointermove",function(ev){ RF.px=ev.clientX; RF.py=ev.clientY; RF.idle=false; });
    e.addEventListener("pointerleave",function(){ RF.px=-1; });
    var b=e.querySelector(".rf-go");
    b.addEventListener("pointerenter",function(){ RF.over="btn"; }); b.addEventListener("pointerleave",function(){ RF.over=null; });
    b.addEventListener("focus",function(){ RF.over="btn"; }); b.addEventListener("blur",function(){ RF.over=null; });
    b.addEventListener("click",function(ev){ ev.stopPropagation(); rfPlay(); });
    e.querySelector(".rf-acct").addEventListener("click",function(ev){ var a=ev.target.closest("[data-rf]"); if(!a) return; ev.stopPropagation();
      if(a.getAttribute("data-rf")==="in") siDemoSignIn(); else siSignOut(function(){ rfAcct(e); }); });
    window.addEventListener("keydown",function(ev){ if(!RF.on) return; ev.stopImmediatePropagation(); if(ev.key==="Enter"&&!ev.repeat){ ev.preventDefault(); var f=document.activeElement; if(f&&f.closest&&f.closest(".rf-acct")) f.click(); else rfPlay(); } else if(ev.key!=="Tab") ev.preventDefault(); },true);
    e.querySelector(".rf-fresh").addEventListener("click",function(ev){ ev.stopPropagation(); rfFresh(); });
    window.addEventListener("keyup",function(ev){ if(RF.on) ev.stopImmediatePropagation(); },true);
    return e; }

  // ---- the lens: one full-screen pass over the still ----
  var RF_FS="precision highp float; varying vec2 v;\n"+
    "uniform sampler2D img, dep, word; uniform vec2 res, px; uniform vec4 wr; uniform float focus, scale, wordD, time, fade;\n"+
    "vec4 wt(vec2 u){ return texture2D(word,(u-wr.xy)/(wr.zw-wr.xy)); }\n"+
    "vec2 cover(vec2 s){ float sa=res.x/res.y; vec2 u=s; if(sa>"+RF_IA.toFixed(2)+") u.y=(s.y-.5)*"+RF_IA.toFixed(2)+"/sa+.5; else u.x=(s.x-.5)*sa/"+RF_IA.toFixed(2)+"+.5; return u; }\n"+
    "float metres(vec2 u){ return 1./("+RF_INV[0]+"+texture2D(dep,u).r*"+(RF_INV[1]-RF_INV[0]).toFixed(6)+"); }\n"+
    "float coc(float d){ return clamp(abs(1./d-1./focus)*scale,0.,22.); }\n"+
    "float leafy(vec3 c){ return smoothstep(.012,.085,c.g-max(c.r,c.b)*.93); }\n"+
    "vec2 wind(vec2 s){ vec3 c=texture2D(img,s).rgb; float g=leafy(c); float gust=.55+.45*sin(time*.55+s.x*2.3)*sin(time*.31+1.7);\n"+
    "  float k=g*(.55+.9*(1.-s.y))*gust; return vec2(sin(time*1.7+s.y*46.+s.x*21.)*1.1+.9, cos(time*2.1+s.x*39.+s.y*13.)*.55)*k*1.9*px; }\n"+
    "void main(){ vec2 u=cover(v); float c0=coc(metres(u)); vec3 acc=vec3(0.); float wsum=0., vine=0.;\n"+
    "  if(c0<.6){ vec3 sc=texture2D(img,u-wind(u)).rgb; acc=sc; wsum=1.; vine=leafy(sc)*(1.-smoothstep(wordD-.32,wordD-.1,metres(u))); } else\n"+
    "  for(int i=0;i<24;i++){ float fi=float(i); float r=sqrt((fi+.5)/24.); float a=fi*2.39996; vec2 su=u+vec2(cos(a),sin(a))*r*c0*px;\n"+
    "    float cs=coc(metres(su)); float w=smoothstep(r*c0-1.5, r*c0+.5, max(cs,c0*.35)+1.);\n"+
    "    vec3 sc=texture2D(img,su-wind(su)).rgb; acc+=sc*w; wsum+=w; vine+=w*leafy(sc)*(1.-smoothstep(wordD-.32,wordD-.1,metres(su))); }\n"+
    "  vec3 col=acc/max(wsum,1e-3);\n"+
    "  float cw=min(coc(wordD),7.); float halo=0., hal=0.; vec4 wa=vec4(0.);\n"+
    "  for(int i=0;i<12;i++){ float fi=float(i); float r=sqrt((fi+.5)/12.); float a=fi*2.39996; vec2 o=vec2(cos(a),sin(a))*r;\n"+
    "    halo+=wt(u+o*(cw+40.)*px).a; hal+=wt(u+o*(cw+14.)*px).a; }\n"+
    "  halo/=12.; hal/=12.;\n"+
    "  if(cw<.4) wa=wt(u); else { for(int i=0;i<16;i++){ float fi=float(i); float r=sqrt((fi+.5)/16.); float a=fi*2.39996; wa+=wt(u+vec2(cos(a),sin(a))*r*cw*px); } wa/=16.; }\n"+
    "   float occ=1.-clamp(vine/max(wsum,1e-3)*1.25,0.,.96); occ=mix(occ,1.,smoothstep(.352,.362,u.y));\n"+
    "  col*=1.-halo*.5*occ; col+=vec3(1.,.6,.24)*hal*.42*occ; col=mix(col,vec3(1.,.95,.85),wa.a*occ); col+=vec3(.9,.55,.2)*wa.a*.08;\n"+
    "  col*=mix(.62,1.,smoothstep(1.25,.35,length((v-.5)*vec2(1.2,1.)))); col=pow(col,vec3(1.04));\n"+
    "  gl_FragColor=vec4(col*(1.-fade),1.); }";
  var RF_WR=[0.14,0.12,0.86,0.44];   /* the part of the still the name and its line sit in (u0, v0, u1, v1) */
  function rfWordCanvas(Wp){ var W=Math.max(256,Math.min(4096,Math.round(Wp||3600))), Hh=Math.round(W*(RF_WR[3]-RF_WR[1])/((RF_WR[2]-RF_WR[0])*RF_IA)), c=document.createElement("canvas"); c.width=W; c.height=Hh; var x=c.getContext("2d",{willReadFrequently:true});   /* kept in memory, not on the GPU: reading it back for the focus box and uploading it as a texture are both instant */
    var k=W/((RF_WR[2]-RF_WR[0])*2048); x.setTransform(k,0,0,k,-RF_WR[0]*2048*k,-RF_WR[1]*1280*k);   /* drawn in the still's 2048 x 1280 space, at much higher resolution */
    x.fillStyle="#fff"; x.textAlign="center"; x.textBaseline="alphabetic"; x.font="400 300px 'Fraunces', Georgia, serif"; x.fillText("Studium",1024,1280*0.35);
    x.font="500 22px 'Geist Mono', ui-monospace, monospace"; if(x.letterSpacing!==undefined) x.letterSpacing="6px"; x.fillText(RF_SUB.toUpperCase(),1024,1280*0.35+78); return c; }
  /* the name and its line, padded, in the still's own coordinates: pointing anywhere near it focuses on it */
  function rfBox(c){ var m=document.createElement("canvas"); m.width=256; m.height=160; var mx=m.getContext("2d",{willReadFrequently:true}); mx.drawImage(c,0,0,256,160); var B=rfBoxRaw(mx); if(!B) return null; var sx=RF_WR[2]-RF_WR[0], sy=RF_WR[3]-RF_WR[1]; return [RF_WR[0]+B[0]*sx, RF_WR[1]+B[1]*sy, RF_WR[0]+B[2]*sx, RF_WR[1]+B[3]*sy]; }
  function rfBoxRaw(mx){ var d=mx.getImageData(0,0,256,160).data, x0=256,y0=160,x1=-1,y1=-1;
    for(var y=0;y<160;y++) for(var x=0;x<256;x++) if(d[(y*256+x)*4+3]>20){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
    return x1<0?null:[x0/256-0.06,y0/160-0.14,(x1+1)/256+0.06,(y1+1)/160+0.14]; }
  function rfGL(){ if(RF.gl) return RF.gl; var cv=RF.el.querySelector(".rf-cv"), gl=cv.getContext("webgl",{antialias:false,premultipliedAlpha:false,alpha:false}); if(!gl) return null;
    function sh(t,src){ var o=gl.createShader(t); gl.shaderSource(o,src); gl.compileShader(o); if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)){ RF.glErr="shader: "+gl.getShaderInfoLog(o); console.warn("rack-in",RF.glErr); } return o; }
    var pr=gl.createProgram(); gl.attachShader(pr,sh(gl.VERTEX_SHADER,"attribute vec2 p; varying vec2 v; void main(){ v=p*.5+.5; v.y=1.-v.y; gl_Position=vec4(p,0.,1.); }")); gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,RF_FS)); gl.linkProgram(pr); if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){ RF.glErr="shader: "+(gl.getProgramInfoLog(pr)||"link failed"); return null; } gl.useProgram(pr);
    var bf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,bf); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW); var lp=gl.getAttribLocation(pr,"p"); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp,2,gl.FLOAT,false,0,0);
    var U={}; function u(n){ return U[n]||(U[n]=gl.getUniformLocation(pr,n)); }
    function tex(unit,src,name){ var t=gl.createTexture(); gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.uniform1i(u(name),unit); return t; }
    RF.gl={gl:gl, cv:cv, u:u, tex:tex, ready:false}; return RF.gl; }
  function rfImg(src){ return new Promise(function(ok,no){ var i=new Image(); i.onload=function(){ ok(i); }; i.onerror=no; i.src=src; }); }
  function rfLoad(){ var G=rfGL(); if(!G) return Promise.reject(new Error(RF.glErr||"no WebGL"));
    var fonts=document.fonts?Promise.all([document.fonts.load("400 300px 'Fraunces'"),document.fonts.load("500 22px 'Geist Mono'")]).catch(function(){}):Promise.resolve();
    return Promise.all([rfImg("asset:assets/launch/rack-stump.jpg"),rfImg("asset:assets/launch/rack-depth.png"),fonts]).then(function(r){
      G.tex(0,r[0],"img"); G.tex(1,r[1],"dep"); var wc=rfWordCanvas(); RF.wTex=G.tex(2,wc,"word"); RF.box=rfBox(wc); RF.wW=0;
      var dc=document.createElement("canvas"); dc.width=r[1].width; dc.height=r[1].height; var dx=dc.getContext("2d",{willReadFrequently:true}); dx.drawImage(r[1],0,0); RF.dd=dx.getImageData(0,0,dc.width,dc.height).data; RF.dw=dc.width; RF.dh=dc.height;
      G.ready=true; }); }

  /* top right: sign in with Google so the demo saves to their account, or who's signed in. A signed-in player with progress carries on */
  function rfAcct(e){ var a=e.querySelector(".rf-acct"), on=typeof Sync!=="undefined"&&Sync.providers().indexOf("google")>=0, inn=typeof siDemoSignedIn==="function"&&siDemoSignedIn(), w=lsWho()||{};
    var nm=String(w.name||"").trim().split(/\s+/), short=nm[0]?nm[0]+(nm.length>1?" "+nm[nm.length-1].charAt(0)+".":""):"You";
    a.innerHTML=!on?"":inn?'<span>'+short.replace(/[<>&"]/g,"")+' · saving to Google</span><button type="button" data-rf="out">Sign out</button>':'<button type="button" data-rf="in">Sign in with Google to save your progress</button>';
    var carry=inn&&typeof siDemoHasWork==="function"&&siDemoHasWork(); e.querySelectorAll(".rf-go .t").forEach(function(t){ t.textContent=carry?"Carry on":"Launch the demo"; }); }
  function rfShow(){ if(RF.on) return; RF.on=true; RF.going=false; RF.idle=true; RF.f=RF.ft=0.9; RF.over=null; RF.last=0;
    var e=rfEl(); RF.el=e; e.className="on"+(typeof laSeen==="function"&&laSeen()?" been":"");   /* START FRESH only shows once there's something to forget */ document.body.classList.add("rackin"); rfAcct(e);
    ["hub","landing","studio","punctum","signin","teacher","hud"].forEach(function(k){ try{ hubHide(k); }catch(x){} });
    rfLoad().then(function(){ if(!RF.on) return; RF.t0=performance.now(); e.classList.add("ready"); },function(err){ console.warn("rack-in",err); if(!RF.on) return; rfClose(); RF.failed=true; siShow(); var h=$("signin")&&$("signin").querySelector(".si-sub"); if(h) h.textContent="(The title page couldn't start: "+String(err&&err.message||err).slice(0,80)+")"; });
    /* the scan loads behind the page, so the demo's opening doesn't have to wait for it; drawn at a fraction of the pixels meanwhile */
    if(!loaded&&typeof setScale==="function"){ try{ setScale(0.3); RF.scaled=true; }catch(x){} }
    if(!loaded){ var sc=(window.SPLAT_SCENES||[])[0]; if(sc){ App.go("landing"); loadBundled(sc); } }
    cancelAnimationFrame(RF.raf); RF.raf=requestAnimationFrame(rfTick); }
  /* leave without the fade (a ?demo link, or the demo starting some other way) */
  function rfClose(){ if(!RF.on) return; RF.on=false; cancelAnimationFrame(RF.raf); document.body.classList.remove("rackin"); if(RF.el) RF.el.className=""; if(RF.scaled&&typeof setScale==="function"&&typeof dynTop==="function"){ RF.scaled=false; try{ setScale(dynTop()); }catch(x){} } }
  /* START FRESH: forget the "already seen it" marks on this computer (the long opening and welcome card, the hints, the
     lighting tour's pop-up, walk or fly, hidden frames), then launch. The demo already starts its work and quests over;
     a student's saved work, sign-in, presets, the detail setting and the FEEL switches stay */
  var RF_SEEN=["studium_launch_seen","studium_looked","studium_lighttour","studium_lighttourB","studium_frames_off","studium_move","splat_tut_v1","studium_guide_v1","studium_quests_demo_v1"];
  function rfFresh(){ if(!RF.on||RF.going) return; RF_SEEN.forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });
    if(typeof CH!=="undefined") CH.hidden=false; if(typeof WK!=="undefined"){ WK.mode="walk"; } rfPlay(); }
  function rfPlay(){ if(!RF.on||RF.going) return; RF.going=true; RF.over="word"; RF.el.classList.add("going"); RF.fadeT=performance.now()+450; }
  /* pointer to the still's coordinates, the same cover fit the shader uses */
  function rfToImg(x,y){ var w=innerWidth, h=innerHeight, sa=w/h, u=x/w, v=y/h; if(sa>RF_IA) v=(v-0.5)*RF_IA/sa+0.5; else u=(u-0.5)*sa/RF_IA+0.5; return [u,v]; }
  function rfDepth(u,v){ if(!RF.dd) return 2; var x=Math.max(0,Math.min(RF.dw-1,Math.floor(u*RF.dw))), y=Math.max(0,Math.min(RF.dh-1,Math.floor(v*RF.dh))); return 1/(RF_INV[0]+RF.dd[(y*RF.dw+x)*4]/255*(RF_INV[1]-RF_INV[0])); }
  function rfCoc(d){ return Math.abs(1/d-1/RF.f)*7.5; }
  function rfSoft(el,k){ if(!el) return; k=Math.round(k*40)/40; if(el._k===k) return; el._k=k; el.style.setProperty("--soft",k.toFixed(3)); }
  function rfTick(now){ if(!RF.on) return; RF.raf=requestAnimationFrame(rfTick); var G=RF.gl; if(!G||!G.ready||document.hidden) return;
    var e=RF.el, t=(now-RF.t0)/1000, dt=Math.min(0.1,Math.max(0,(now-(RF.last||now))/1000)); RF.last=now;
    if(RF.going) RF.ft=RF_WORD;
    else if(RF.over==="btn") RF.ft=RF_BTN;
    else if(RF.px>=0){ var iu=rfToImg(RF.px,RF.py), B=RF.box; RF.ft=(B&&iu[0]>=B[0]&&iu[0]<=B[2]&&iu[1]>=B[1]&&iu[1]<=B[3])?RF_WORD:rfDepth(iu[0],iu[1]); }
    else if(RF.idle) RF.ft = t<1.4?0.9 : 0.9+(1.7-0.9)*Math.min(1,(t-1.4)/2.8);   /* before you touch it, it drifts onto the stump by itself */
    var lf=Math.log(RF.f), lt=Math.log(RF.ft); RF.f=Math.exp(lf+(lt-lf)*(1-Math.exp(-dt*7)));
    var fade=RF.going?Math.max(0,Math.min(1,(now-RF.fadeT)/350)):0;
    if(RF.going&&fade>=1) e.classList.toggle("wait",!loaded);
    if(RF.going&&fade>=1&&loaded&&!RF.handed){ RF.handed=true; setTimeout(function(){ RF.handed=false; rfClose(); if(typeof siAct==="function") siAct("demo"); },0); }
    var gl=G.gl, d=Math.min(window.devicePixelRatio||1,1.5), w=Math.max(2,Math.round(innerWidth*d)), h=Math.max(2,Math.round(innerHeight*d));
    if(G.cv.width!==w||G.cv.height!==h){ G.cv.width=w; G.cv.height=h; } gl.viewport(0,0,w,h);
    var sa=w/h; if(sa>RF_IA) gl.uniform2f(G.u("px"),1/w,(1/h)*(RF_IA/sa)); else gl.uniform2f(G.u("px"),(1/w)*(sa/RF_IA),1/h);
    var still=RF_STILL?RF_STILL.matches:false;
    var iw=(w/h>RF_IA?w:h*RF_IA), want=Math.round((RF_WR[2]-RF_WR[0])*iw); if(!RF.wW||Math.abs(RF.wW-want)>2){ RF.wW=want; try{ var wc=rfWordCanvas(want); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,RF.wTex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,wc); }catch(e){} }   /* the name is redrawn at exactly the size it lands on screen, so it's crisp at any window size */
    gl.uniform4f(G.u("wr"),RF_WR[0],RF_WR[1],RF_WR[2],RF_WR[3]); gl.uniform2f(G.u("res"),w,h); gl.uniform1f(G.u("focus"),RF.f); gl.uniform1f(G.u("scale"),30*w/1440); gl.uniform1f(G.u("wordD"),RF_WORD); gl.uniform1f(G.u("time"),still?0:now/1000); gl.uniform1f(G.u("fade"),fade);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    rfSoft(RF.go||(RF.go=e.querySelector(".rf-go")), Math.min(1,rfCoc(RF_BTN)/7)); }
  var RF_STILL=window.matchMedia?matchMedia("(prefers-reduced-motion: reduce)"):null;   /* asked once; .matches stays live */
  if(/[?&]dev/.test(location.search)) window.__rf={ show:rfShow, close:rfClose, play:rfPlay, state:function(){ return {on:RF.on, f:+RF.f.toFixed(2), ft:+RF.ft.toFixed(2), ready:!!(RF.gl&&RF.gl.ready), loaded:loaded}; }, focus:function(d){ RF.idle=false; RF.px=-1; RF.ft=d; } };
