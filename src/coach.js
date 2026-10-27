  // ================= COACH: hands-on tours, one prompt at a time =================
  // The way a game teaches its controls: one short prompt at the bottom of the screen (or beside the thing it's about),
  // the thing to click lit up, and the prompt ticks over by itself the moment it's done. Three tours, each run by a
  // guide step:
  //   basics  at the location, before the gold frames unlock: look, walk, crouch, the camera, the bag, the camera back
  //   select  on the light table: look at a photo, Pick, Reject, then choose your best
  //   edit    across the three picks: the Light sliders on the first, black and white by hand on the second, then
  //           a crop and the Color Grading wheels on the third
  // Progress and completion live per tour in the quest state (Q.tourStep, Q.tours), so a reload carries on from the same prompt.
  var CO={tour:null, i:0, on:false, s:{}, keys:{}, look:0, walked:0, lx:null, lz:null, lyaw:null, done:false, raf:0, html:"", okT:0, t0:0, seen:-1};
  function coK(k){ return '<kbd data-co-k="'+k+'"'+(CO.keys[k]?' class="on"':'')+'>'+k+'</kbd>'; }
  function coPickN(){ return qDemo()?5:8; }
  function coPicks(){ return photos.filter(function(p){ return p.pick; }).length; }
  function coEdIdx(){ return typeof devOpenIdx==="function"?devOpenIdx():-1; }
  function coInEditor(){ return typeof editor!=="undefined"&&editor&&!editor.classList.contains("hidden")&&!!edState; }
  // open a Develop panel section and bring it into view
  function coSec(name){ var s=document.querySelector('#editor .lr-sec[data-sec="'+name+'"]'); if(s) s.classList.remove("collapsed"); return s; }
  function coShow(sel){ setTimeout(function(){ var e=document.querySelector(sel); if(e&&e.scrollIntoView) try{ e.scrollIntoView({block:"center", behavior:"smooth"}); }catch(er){ e.scrollIntoView(); } },60); }
  function coRow(id){ return '#editor .lr-row:has(#'+id+')'; }
  // the boards (workbook, folio) and what's on them
  function coWs(){ return typeof wsB!=="undefined"?wsB.page():{items:[]}; }
  function coWsN(t){ return coWs().items.filter(function(it){ return it.t===t; }).length; }
  function coWsEl(test){ var pg=coWs(), k=-1; pg.items.forEach(function(it,j){ if(k<0&&test(it)) k=j; }); return k<0?null:document.querySelector('#st-workshop .bd-sheet [data-bd="'+k+'"]'); }
  function coArrow(){ var a=null; coWs().items.forEach(function(it){ if(it.t==="line"&&it.head!=="none") a=it; }); return a; }
  function coInPhoto(x,y){ return coWs().items.some(function(it){ if(it.t!=="photo") return false; var h=it.w/((typeof stAspect==="function"&&stById(it.pid)>=0)?stAspect(stById(it.pid)):1.5); return x>=it.x&&x<=it.x+it.w&&y>=it.y&&y<=it.y+h; }); }
  function coRanked(){ return coWs().items.filter(function(it){ return it.t==="text"&&it.rank&&String(it.text||"").trim().length>=8; }).length; }
  function coFoSec(){ return typeof foB!=="undefined"?foB.secItems("0.0"):[]; }
  function coRoom(r){ return typeof st!=="undefined"&&st.open&&st.room===r; }

  // ---- little clips for the camera settings: one Stump frame, the setting swept end to end and back ----
  // Each shows what the setting does to the light and what it costs: the shutter brightens but shakes, the aperture
  // brightens but melts the background, ISO brightens but grains. Drawn live on a canvas, so they cost nothing to ship.
  var CO_IMG=new Image(); CO_IMG.src="asset:assets/coach/stump.jpg";
  var CO_MEDIA={
    shutter:{vals:["1/1000","1/500","1/250","1/125","1/60","1/30","1/15","1/8"], lo:"Freezes everything, but darker", hi:"Brighter, but your hands smear it"},
    aperture:{vals:["f/1.4","f/2","f/2.8","f/4","f/5.6","f/8","f/16"], lo:"Bright, and the background melts away", hi:"Darker, but sharp front to back"},
    iso:{vals:["ISO 100","200","400","800","1600","3200","ISO 6400"], lo:"Clean, but it needs lots of light", hi:"Bright in the dark, but grainy"},
    meter:{vals:["−2","−1","0","+1","+2"], lo:"Too dark: shadows turn to mud", mid:"Just right", hi:"Too bright: the sky burns out"}};
  var coNoise=null;
  /* the practice scenes' target pictures: the Stump in full sun, at night, and with its background melted */
  var CO_SCENE={day:{f:"brightness(1.28) saturate(1.25) sepia(.12)", tag:"TARGET · FULL SUN"}, night:{f:"brightness(.32) saturate(.6) hue-rotate(185deg)", tag:"TARGET · NIGHT", tint:"rgba(40,60,120,.28)"}, blur:{f:"none", tag:"TARGET · SOFT BACKGROUND", ap:0}};
  function coSceneDraw(kind, cv){ var S=CO_SCENE[kind], img=(S.ap!=null&&CO_AP.ok)?CO_AP.im[S.ap]:CO_IMG; if(!cv||!img.complete||!img.naturalWidth) return;
    var dpr=Math.min(2,window.devicePixelRatio||1), W=cv.clientWidth||400, H=cv.clientHeight||240; if(cv.width!==Math.round(W*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
    var g=cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); var ir=img.naturalWidth/img.naturalHeight, dw=W, dh=W/ir; if(dh<H){ dh=H; dw=H*ir; }
    g.filter=S.f; g.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh); g.filter="none"; if(S.tint){ g.fillStyle=S.tint; g.fillRect(0,0,W,H); }
    g.fillStyle="rgba(12,11,10,.72)"; g.fillRect(10,10,g.measureText(S.tag).width+60,24); g.font="500 11px 'Geist Mono',ui-monospace,monospace"; g.fillStyle="#e3ad57"; g.fillText(S.tag,20,26); }
  /* the aperture clip: real frames from Studium's own depth of field, f/2 to f/16, focused on the stump */
  var CO_AP={im:[], ok:false}; (function(){ var n=0, srcs=["asset:assets/coach/ap-0.jpg","asset:assets/coach/ap-1.jpg","asset:assets/coach/ap-2.jpg","asset:assets/coach/ap-3.jpg","asset:assets/coach/ap-4.jpg","asset:assets/coach/ap-5.jpg","asset:assets/coach/ap-6.jpg"];
    srcs.forEach(function(s,i){ var im=new Image(); im.onload=function(){ if(++n===srcs.length) CO_AP.ok=true; }; im.src=s; CO_AP.im[i]=im; }); })();
  /* a nine-blade iris: wide open at t=0, closed down to a small hole at t=1, drawn over the aperture clip so the blades and the blur move together */
  function coIris(g,cx,cy,R,t){ var n=9, open=0.95-0.72*t, r=R*open, ang=Math.PI*0.55*t;   /* blade overlap grows as it closes */
    g.save(); g.translate(cx,cy); g.fillStyle="rgba(12,11,10,.8)"; g.beginPath(); g.arc(0,0,R+10,0,Math.PI*2); g.fill();
    g.fillStyle="#1a1712"; g.strokeStyle="rgba(244,241,234,.22)"; g.lineWidth=1; g.beginPath(); g.arc(0,0,R+2,0,Math.PI*2); g.fill(); g.stroke();
    g.fillStyle="#2a251c"; for(var i=0;i<n;i++){ var a=i/n*Math.PI*2; g.save(); g.rotate(a); g.beginPath();   /* each blade is a curved wedge pivoting on the rim; the hole is where they stop */
      g.moveTo(R+2,0); g.arc(0,0,R+2,0,Math.PI*2/n+0.25); g.lineTo(Math.cos(ang)*r,Math.sin(ang)*r); g.quadraticCurveTo(r*0.6,r*0.1,Math.cos(ang-0.9)*r,Math.sin(ang-0.9)*r); g.closePath(); g.fill(); g.restore(); }
    g.strokeStyle="#e3ad57"; g.lineWidth=1.5; g.beginPath(); for(var k=0;k<=n;k++){ var b=k/n*Math.PI*2+ang; g[k?"lineTo":"moveTo"](Math.cos(b)*r,Math.sin(b)*r); } g.stroke();
    var lg=g.createRadialGradient(0,0,0,0,0,r); lg.addColorStop(0,"rgba(255,240,210,.55)"); lg.addColorStop(1,"rgba(255,240,210,.08)"); g.fillStyle=lg; g.fill();
    g.restore(); }
  function coNoiseCanvas(){ if(coNoise) return coNoise; var c=document.createElement("canvas"); c.width=c.height=256; var g=c.getContext("2d"), d=g.createImageData(256,256);
    for(var i=0;i<d.data.length;i+=4){ var v=128+(Math.random()+Math.random()+Math.random()-1.5)*120; d.data[i]=d.data[i+1]=d.data[i+2]=v; d.data[i+3]=255; } g.putImageData(d,0,0); return (coNoise=c); }
  // 0 → 1 → 0 with a pause at each end, so there's time to see both
  function coSweep(now){ var T=5.6, u=(now/1000)%T/T, e=function(x){ return x<0?0:x>1?1:x*x*(3-2*x); };
    return u<0.12?0:u<0.45?e((u-0.12)/0.33):u<0.62?1:u<0.95?1-e((u-0.62)/0.33):0; }
  function coMediaDraw(kind, cv, now){ if(CO_SCENE[kind]) return coSceneDraw(kind, cv); var M=CO_MEDIA[kind]; if(!M||!cv||!CO_IMG.complete||!CO_IMG.naturalWidth) return;
    var dpr=Math.min(2,window.devicePixelRatio||1), W=cv.clientWidth||400, H=cv.clientHeight||240;
    if(cv.width!==Math.round(W*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
    var g=cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.globalAlpha=1; g.globalCompositeOperation="source-over"; g.filter="none";
    var t=coSweep(now), img=CO_IMG, ir=img.naturalWidth/img.naturalHeight, dw=W, dh=W/ir; if(dh<H){ dh=H; dw=H*ir; } var dx=(W-dw)/2, dy=(H-dh)/2;
    g.fillStyle="#0c0b0a"; g.fillRect(0,0,W,H);
    var ev=kind==="meter"?(t*4-2):0, bright;
    if(kind==="shutter"){ bright=0.5+0.85*t; var L=Math.pow(Math.max(0,(t-0.55)/0.45),1.5)*13;   // the shutter open while the hands wander
      g.filter="brightness("+bright.toFixed(3)+")";
      if(L<0.5) g.drawImage(img,dx,dy,dw,dh);
      else { var path=[[0,0],[0.3,0.2],[0.55,-0.1],[0.8,0.35],[1,0.15],[0.7,-0.25],[0.45,0.05],[0.2,-0.3]], wob=Math.sin(now/170)*0.15;
        for(var k=0;k<path.length;k++){ g.globalAlpha=1/(k+1); g.drawImage(img,dx+(path[k][0]-0.5+wob)*L,dy+(path[k][1])*L,dw,dh); } g.globalAlpha=1; } }
    else if(kind==="aperture"&&CO_AP.ok){ var fi=t*(CO_AP.im.length-1), a0=Math.floor(fi), a1=Math.min(CO_AP.im.length-1,a0+1), fr=fi-a0, im0=CO_AP.im[a0], r0=im0.naturalWidth/im0.naturalHeight, w0=W, h0=W/r0; if(h0<H){ h0=H; w0=H*r0; }
      g.filter="brightness("+(1.08-0.4*t).toFixed(3)+")";   /* the frames were metered; here the same shutter stays, so stopping down goes darker */
      g.drawImage(im0,(W-w0)/2,(H-h0)/2,w0,h0); if(fr>0.01){ g.globalAlpha=fr; g.drawImage(CO_AP.im[a1],(W-w0)/2,(H-h0)/2,w0,h0); g.globalAlpha=1; } g.filter="none"; coIris(g,W-52,50,34,t); }
    else if(kind==="aperture"){ bright=1.32-0.78*t; var B=(1-t)*7;
      g.filter="blur("+B.toFixed(2)+"px) brightness("+bright.toFixed(3)+")"; g.drawImage(img,dx-8,dy-8,dw+16,dh+16);
      // the stump stays sharp: it's what you focused on
      var o=coMediaDraw.o||(coMediaDraw.o=document.createElement("canvas")); o.width=cv.width; o.height=cv.height; var q=o.getContext("2d"); q.setTransform(dpr,0,0,dpr,0,0);
      q.filter="brightness("+bright.toFixed(3)+")"; q.drawImage(img,dx,dy,dw,dh); q.filter="none"; q.globalCompositeOperation="destination-in";
      q.save(); q.translate(W*0.43,H*0.6); q.scale(1,2.1); var rg=q.createRadialGradient(0,0,W*0.07,0,0,W*0.2); rg.addColorStop(0,"#000"); rg.addColorStop(1,"rgba(0,0,0,0)"); q.fillStyle=rg; q.fillRect(-W,-H,2*W,2*H); q.restore();
      g.filter="none"; g.setTransform(1,0,0,1,0,0); g.drawImage(o,0,0); g.setTransform(dpr,0,0,dpr,0,0); coIris(g,W-52,50,34,t); }
    else if(kind==="iso"){ bright=0.5+0.85*t; g.filter="brightness("+bright.toFixed(3)+") saturate("+(1-0.35*t).toFixed(3)+")"; g.drawImage(img,dx,dy,dw,dh); g.filter="none";
      var a=Math.pow(t,1.4)*0.75; if(a>0.02){ var n=coNoiseCanvas(); g.globalAlpha=a; g.globalCompositeOperation="overlay"; var ox=Math.random()*128, oy=Math.random()*128, sc=t>0.6?1.6:1.2;
        for(var y=-oy;y<H;y+=256/sc) for(var x=-ox;x<W;x+=256/sc) g.drawImage(n,x,y,256/sc,256/sc); g.globalAlpha=1; g.globalCompositeOperation="source-over"; } }
    else { bright=Math.pow(2,ev*0.6); g.filter="brightness("+bright.toFixed(3)+")"; g.drawImage(img,dx,dy,dw,dh); g.filter="none";
      // the needle, as on the back of the camera
      var cx=58, cy=H-24, R=38; g.fillStyle="rgba(12,11,10,.72)"; g.beginPath(); g.arc(cx,cy,R+12,Math.PI,2*Math.PI); g.fill();
      g.strokeStyle="rgba(244,241,234,.55)"; g.lineWidth=1.5; g.beginPath(); g.arc(cx,cy,R,Math.PI*1.1,Math.PI*1.9); g.stroke();
      var an=-Math.PI/2+ev/2*0.75; g.strokeStyle=Math.abs(ev)<0.4?"#e3ad57":"#f4f1ea"; g.lineWidth=2.5; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.cos(an)*R,cy+Math.sin(an)*R); g.stroke(); }
    // the readout: the value, a scale with a marker, and what it's doing to the photo
    var grd=g.createLinearGradient(0,H-64,0,H); grd.addColorStop(0,"rgba(12,11,10,0)"); grd.addColorStop(1,"rgba(12,11,10,.85)"); g.fillStyle=grd; g.fillRect(0,H-64,W,64);
    var n=M.vals.length, i=Math.round(t*(n-1)), x0=kind==="meter"?118:16, x1=W-16, yb=H-14;
    g.strokeStyle="rgba(244,241,234,.25)"; g.lineWidth=1; g.beginPath(); g.moveTo(x0,yb); g.lineTo(x1,yb); g.stroke();
    for(var j=0;j<n;j++){ var xx=x0+(x1-x0)*j/(n-1); g.beginPath(); g.moveTo(xx,yb-4); g.lineTo(xx,yb+2); g.stroke(); }
    var mx=x0+(x1-x0)*t; g.fillStyle="#e3ad57"; g.beginPath(); g.moveTo(mx,yb-3); g.lineTo(mx-5,yb-11); g.lineTo(mx+5,yb-11); g.fill();
    g.font="500 13px 'Geist Mono',ui-monospace,monospace"; g.fillStyle="#e3ad57"; g.textBaseline="alphabetic"; g.fillText(M.vals[i].replace(/^ISO (?=\d{3,4}$)/,""),x0,H-26);
    var words=t<0.25?M.lo:t>0.75?M.hi:(M.mid&&Math.abs(t-0.5)<0.12?M.mid:"");
    if(words){ g.font="400 13px 'Geist',ui-sans-serif,system-ui,sans-serif"; g.fillStyle="#f4f1ea"; g.textAlign="right"; g.fillText(words,x1,H-26); g.textAlign="left"; } }
  // the warm-up's practice scenes: a picture of the target, the sliders ringed, and the meter reading as if the light were different
  function coScene(kind, bias, line, sub, extra){ return {ch:"EXPOSE", media:kind, need:"back", dwell:1400, line:function(){ return line; }, sub:sub,
    target:'#camback .cb-meter', place:"side", targets:function(){ return Array.prototype.slice.call(document.querySelectorAll('#camback .cb-scale')); }, nodim:true,
    start:function(){ meterBias=bias; computeCam(); if(typeof cbRender==="function") cbRender(); },
    done:function(){ return Math.abs(evStops)<=0.5&&(!extra||extra()); } }; }
  // edit tour: drag a slider to the gold mark. It ticks once you've let go on it, so you can wiggle it back and
  // forth as much as you like first.
  function coMark(id,val){ coUnmark(); var inp=$(id); if(!inp) return; var row=inp.closest(".lr-row"); if(!row) return; row.classList.add("co-markrow");
    var mn=+inp.min, mx=+inp.max, f=(val-mn)/(mx-mn), th=7, m=document.createElement("i"); m.className="co-mark";
    m.style.left=(inp.offsetLeft+th+f*(inp.offsetWidth-2*th)).toFixed(1)+"px"; m.style.top=(inp.offsetTop+inp.offsetHeight/2)+"px"; row.appendChild(m); }
  function coUnmark(){ Array.prototype.forEach.call(document.querySelectorAll(".co-mark"),function(m){ m.parentNode.removeChild(m); }); Array.prototype.forEach.call(document.querySelectorAll(".co-markrow"),function(r){ r.classList.remove("co-markrow"); }); }
  function coFmt(key,v){ return key==="exposure"?fmtExp(v):(v>0?"+":"")+v; }
  function coSet(sec,id,key,val,tol,name,what){ return {ch:sec==="light"?"LIGHT":sec==="color"?"COLOUR":"EFFECTS",
      line:function(){ var v=edState?edState[key]:0, ok=Math.abs(v-val)<=tol; return 'Drag <b>'+name+'</b> to the gold mark: <b>'+coFmt(key,val)+'</b>'+(ok&&CO.down?' <span class="co-now ok">let go</span>':''); },
      sub:name+" "+what, target:coRow(id), mark:[id,val], dwell:500,
      prep:function(){ coSec(sec); coShow(coRow(id)); setTimeout(function(){ coMark(id,val); },120); },
      done:function(){ return !CO.down&&Math.abs(edState[key]-val)<=tol; },
      bar:function(){ var v=edState[key]; return Math.max(0,1-Math.abs(v-val)/Math.max(Math.abs(val),20)); }}; }
  function coEditTotal(){ return typeof devList==="function"?devList().length:0; }
  function coEditedN(){ var L=typeof devList==="function"?devList():[]; return L.filter(function(i){ if(edState&&edState.i===i) return !devIsDefault(edState); var p=photos[i]; return p&&!!p.dev; }).length; }
  document.addEventListener("pointerdown",function(){ CO.down=true; },true);
  window.addEventListener("pointerup",function(){ CO.down=false; },true);
  // a slider step on the camera back: the row lit up, drag it (or click a number) at least two stops
  function coDialVal(k){ return k==="sh"?shIdx:k==="ap"?apIdx:isoIdx; }
  function coDial(row,key,name,sub){ return {ch:"SETTINGS", line:function(){ return '<kbd>DRAG</kbd> the <b>'+name+'</b> slider'; }, sub:sub,
      target:'#camback [data-cb-row="'+row+'"]', place:"bottom", need:"back", dwell:1200,
      prep:function(){ cbTab="shoot"; cbRow=row; if(cbOpen) cbRender(); }, start:function(){ CO.s.v=coDialVal(key); },
      done:function(){ return Math.abs(coDialVal(key)-CO.s.v)>=2; }, bar:function(){ return Math.min(1,Math.abs(coDialVal(key)-CO.s.v)/2); }}; }
  var CO_TOURS={
    basics:{where:function(){ return loaded&&!App.is("hub")&&!(typeof st!=="undefined"&&st.open); }, steps:[
      {ch:"MOVE", line:function(){ return 'Click, then move the mouse to look around'; }, sub:"Esc lets go of the mouse. The sharp thing in front of you is the subject; if you lose it, a gold ring points the way back.",
        done:function(){ return CO.look>1.6; }, bar:function(){ return CO.look/1.6; }},
      {ch:"MOVE", line:function(){ var d=typeof chSubjectDist==="function"?chSubjectDist():Infinity; return isFinite(d)&&d>4.5?'Head for the gold ring: that\'s '+(typeof chSubjectName==="function"?chSubjectName():"the subject")+', your subject':coK("W")+coK("A")+coK("S")+coK("D")+' to walk'; },
        sub:"Have a wander, but stay close. A scan is only sharp near the thing it was made of; the edges always go soft.",
        start:function(){ CO.s.d0=typeof chSubjectDist==="function"?chSubjectDist():Infinity; },   /* a scene that starts you far from its subject only asks you to head its way */
        done:function(){ var d=typeof chSubjectDist==="function"?chSubjectDist():Infinity; return CO.walked>3&&(!isFinite(d)||d<4.5||d<CO.s.d0-2); }, bar:function(){ return Math.min(1,CO.walked/3); }},
      {ch:"MOVE", line:function(){ return coK("Q")+' to crouch, '+coK("E")+' to stand tall'; }, sub:"Where you hold the camera changes the picture.",
        done:function(){ return CO.keys.Q&&CO.keys.E; }},
      {ch:"SHOOT", line:function(){ return '<kbd>RIGHT CLICK</kbd> raises the camera to your eye'; }, sub:"Right click again to lower it. "+coK("P")+" does the same.",
        done:function(){ return viewfinderOn; }},
      {ch:"SHOOT", line:function(){ return 'Hold '+coK("F")+' to focus'; }, sub:"Point the square in the middle at the stump. It thinks for a moment, then turns green when it's sharp.",
        start:function(){ CO.s.af=afLocks; }, done:function(){ return afLocks>CO.s.af; }, need:"vf"},
      {ch:"SHOOT", line:function(){ return '<kbd>CLICK</kbd> to take a photo'; }, sub:"Anything you like. It goes into your studio.",
        start:function(){ CO.s.n=photos.length; }, done:function(){ return photos.length>CO.s.n; }, need:"vf"},
      {ch:"BAG", line:function(){ return coK("SPACE")+' opens your kit: choose <b>Bag</b>'; }, sub:"Or press "+coK("2")+" once the kit is open. Different cameras and lenses for different pictures.",
        kit:"bag", done:function(){ return bg.open; }},
      {ch:"BAG", line:function(){ return 'Click the <b>APS-C mirrorless</b>'; }, sub:"Its smaller sensor crops every lens 1.6× tighter.",
        target:'#bag [data-bg-body="ml"]', done:function(){ return bg.body==="ml"; }, need:"bag"},
      {ch:"BAG", line:function(){ return 'Now <b>change the lens</b>'; }, sub:"Click the lens on the camera, or the lens button.",
        lens:true, done:function(){ return bg.stage==="lens"; }, need:"bag"},
      {ch:"BAG", line:function(){ return 'Choose <b>one of these</b>'; }, sub:"Each lens sees differently: a wide one takes in more, a long one pulls far things close. Watch it twist off and the new one click on.",
        target:'#bag .bg-tray', targets:function(){ return Array.prototype.filter.call(document.querySelectorAll('#bag [data-bg-lens]'),function(c){ return c.getAttribute("data-bg-lens")!==CO.s.l0; }); },
        start:function(){ CO.s.l0=lensId; }, done:function(){ return bg.lens!==CO.s.l0&&!bg.busy; }, need:"lens", nodim:true},
      {ch:"BAG", line:function(){ return '<b>Lock it in</b>'; }, sub:"",
        target:'#bag [data-bg="done"]', done:function(){ return bg.stage==="choose"&&lensId===bg.lens; }, need:"lens"},
      {ch:"BAG", line:function(){ return coK("SPACE")+' closes the bag'; }, sub:"",
        done:function(){ return !bg.open; }},
      {ch:"SETTINGS", line:function(){ return coK("SPACE")+' opens your kit: choose <b>Settings</b>'; }, sub:"The back of the camera: shutter, aperture and ISO.",
        kit:"back", done:function(){ return cbOpen; }},
      {ch:"SETTINGS", media:"shutter", info:true, need:"back", line:function(){ return 'The <b>shutter speed</b> is how long the camera looks'; },
        sub:"Fast, like 1/1000, freezes everything but lets in less light. Slow, like 1/15, lets in lots of light, but any wobble in your hands smears the photo. The longer the lens, the faster you need."},
      coDial(0,"sh","shutter speed","Or click any number on it. Watch the needle at the bottom swing as you go."),
      {ch:"SETTINGS", media:"aperture", info:true, need:"back", line:function(){ return 'The <b>aperture</b> is how wide the lens opens'; },
        sub:"A small number, like f/2, is a wide hole: lots of light, and a soft background that makes your subject pop. A big number, like f/16, is a pinhole: darker, but sharp from front to back."},
      coDial(1,"ap","aperture","Small numbers open it up, big numbers close it down."),
      {ch:"SETTINGS", media:"iso", info:true, need:"back", line:function(){ return '<b>ISO</b> is how sensitive the sensor is'; },
        sub:"Low, like 100, is clean and smooth but needs plenty of light. Turn it up when it's dark, but the photo gets grainy. Photographers reach for it last."},
      coDial(2,"iso","ISO","Higher sees in the dark, lower keeps it clean."),
      {ch:"SETTINGS", media:"meter", info:true, need:"back", line:function(){ return 'The <b>light meter</b> adds them all up'; },
        sub:"Every setting moves the needle. Left of the middle is too dark, right is too bright. Get it near the middle, then trade one setting against another for the look you want."},
      coScene("day", 3, 'A <b>bright sunny day</b>: get the needle to the middle', "There's eight times more light than here. Turn the sliders until the needle sits in the middle.", null),
      coScene("night", -4, '<b>Night</b>: get the needle to the middle', "Sixteen times less light. You'll need to let a lot more in: slower, wider, or more sensitive.", null),
      coScene("blur", 0, 'A <b>blurred background</b>: f/2.8 or wider, needle in the middle', "Open the aperture to make the background melt, then balance the light with the other two.", function(){ return APERTURES[apIdx]<=2.8; }),
      {ch:"EXPOSE", line:function(){ return coK("SPACE")+' takes you back to the scene'; }, sub:"",
        done:function(){ return !cbOpen; }}]},
    select:{where:function(){ return typeof st!=="undefined"&&st.open&&st.room==="select"; }, steps:[
      {ch:"LOOK", line:function(){ return 'Every photo you took is on the <b>light table</b>'; }, sub:"Picking your best is half of photography. Take your time.",
        target:'#st-select .st-sheet', place:"column", col:'#st-select .st-loupe', info:true},
      {ch:"LOOK", line:function(){ return '<b>Click any photo</b> to see it big'; }, sub:"Whichever catches your eye. Or use "+'← →'+" to move along.",
        target:'#st-select .st-sheet', place:"column", col:'#st-select .st-loupe', start:function(){ CO.s.cur=st.cur; }, done:function(){ return st.cur!==CO.s.cur; }},
      {ch:"CHOOSE", line:function(){ return '<b>Pick</b> keeps it for your folio'; }, sub:"Click Pick, or press P. The pencil ring shows it's in.",
        target:'#st-select [data-st-act="pick"]', place:"column", done:function(){ var p=photos[st.cur]; return !!(p&&p.pick); }},
      {ch:"CHOOSE", line:function(){ return '<b>Reject</b> the ones you won\'t use'; }, sub:"Click a weaker photo first, then Reject (or press X). It's struck out, not deleted.",
        target:'#st-select [data-st-act="reject"]', place:"column", start:function(){ CO.s.r=photos.filter(function(p){ return p.reject; }).length; }, done:function(){ return photos.filter(function(p){ return p.reject; }).length>CO.s.r; }},
      {ch:"CHOOSE", line:function(){ return 'Now pick your best <b>'+coPickN()+'</b>'; }, sub:"Click a photo, then Pick. Click Pick again to change your mind.",
        target:'#st-select .st-loupe .brief', place:"column", nodim:true, done:function(){ return coPicks()===coPickN(); }, bar:function(){ return coPicks()/coPickN(); }}]},
    // One photo, every slider to a gold mark (the photo stays bright, and it only ticks once you let go on the mark),
    // then the image resets and it's yours: edit, Copy, next photo, Paste, and the rest of the picks.
    edit:{where:coInEditor, nodim:true, steps:[
      {ch:"LIGHT", line:function(){ return 'These are the <b>Light</b> sliders'; }, sub:"We'll set each one to its gold mark on this photo, so you see what it does. Then you're on your own.",
        target:'#editor .lr-sec[data-sec="light"]', prep:function(){ coSec("light"); coShow('#editor .lr-sec[data-sec="light"]'); }, info:true},
      coSet("light","pExposure","exposure",15,3,"Exposure","brightens or darkens everything at once."),
      coSet("light","pContrast","contrast",20,4,"Contrast","pushes the darks darker and the brights brighter."),
      coSet("light","pHighlights","highlights",-60,5,"Highlights","brings back detail in the brightest parts, like the sky."),
      coSet("light","pShadows","shadows",45,5,"Shadows","opens up the dark parts without touching the rest."),
      coSet("light","pWhites","whites",15,4,"Whites","sets how bright the very brightest point is."),
      coSet("light","pBlacks","blacks",-25,4,"Blacks","sets how deep the very darkest point is."),
      coSet("color","pTemp","temp",12,4,"Temperature","warms the photo up (right) or cools it down (left)."),
      coSet("color","pVibrance","vibrance",25,5,"Vibrance","lifts the dull colours more than the strong ones, so skin and sky stay natural."),
      coSet("effects","pClarity","clarity",20,4,"Clarity","adds punch to the mid-tones: bark, ivy, texture."),
      coSet("effects","pVignette","vignette",-25,5,"Vignette","darkens the corners to pull the eye in."),
      {ch:"GRADE", line:function(){ return '<b>Color Grading</b> tints the shadows, midtones and highlights'; }, sub:"Film looks, moods, sunsets. A little goes a long way.",
        target:'#lrGrade', prep:function(){ coSec("grading"); if(typeof cgTab!=="undefined"&&cgTab!=="3"){ cgTab="3"; edpGrade(); } coShow('#lrGrade .cg-pair'); }, info:true},
      {ch:"GRADE", line:function(){ return 'Drag in the <b>Shadows</b> wheel towards blue'; }, sub:"Further from the middle is stronger.",
        target:'#lrGrade .cg-disc[data-cg="gSh"]', done:function(){ return edState.gShS>=10&&!CO.down; }},
      {ch:"GRADE", line:function(){ return 'And the <b>Highlights</b> wheel towards orange'; }, sub:"Cool shadows, warm light: the classic film look.",
        target:'#lrGrade .cg-disc[data-cg="gHi"]', done:function(){ return edState.gHiS>=10&&!CO.down; }},
      {ch:"CROP", line:function(){ return 'Click <b>Crop</b>'; }, sub:"Or press "+coK("C")+". The whole photo comes back with a box over it.",
        target:'#eCrop', done:function(){ return cropActive(); }},
      {ch:"CROP", line:function(){ return 'Pick <b>4:5</b>'; }, sub:"A tall shape, like a print or a phone screen. Free lets you make any shape.",
        target:'#editor .lr-ct[data-a="0.8"]', done:function(){ return cropActive()&&edCrop.ratio===0.8; }, need:"crop"},
      {ch:"CROP", line:function(){ return '<b>Drag a corner</b> in, then drag inside the box to move it'; }, sub:"Put the stump a third of the way in, not dead centre.",
        target:'#cropUI .crop-box', place:"low", start:function(){ CO.s.w=edCrop?edCrop.w:1; }, done:function(){ return cropActive()&&!CO.down&&edCrop.w<CO.s.w-0.03; }, need:"crop"},   /* a corner drag makes the box smaller than it started; picking 4:5 already did, so measure from here */
      {ch:"CROP", line:function(){ return '<b>Apply</b> the crop'; }, sub:"Or press "+coK("ENTER")+". You can open it again any time and the box is where you left it.",
        target:'#eCropApply', done:function(){ return !cropActive()&&edState.aspect!=="free"; }},
      {ch:"COMPARE", line:function(){ return 'Click <b>Before / After</b> to see how far you\'ve come'; }, sub:"The "+coK("\\")+" key does the same. Click it again to come back.",
        target:'#eBefore', start:function(){ CO.s.saw=false; }, done:function(){ if(edShowOrig) CO.s.saw=true; return CO.s.saw&&!edShowOrig; }},
      {ch:"YOURS", line:function(){ return 'Now <b>try it on your own</b>'; }, sub:"We've reset the photo. Make it look the way you want: any sliders, any crop. There's no right answer.",
        prep:function(){ if(edState){ var i=edState.i, r=edState.rot; edState=defEd(i); edState.rot=r; buildRotated(); edResetView(); syncEditUI(); queueRender(); edPushHist(); setTimeout(drawHist,140); } }, info:true},
      {ch:"YOURS", line:function(){ return 'When you\'re happy, press <b>Copy</b>'; }, sub:"It copies your look so you can put it on another photo.",
        target:'#dvCopy', start:function(){ CO.s.clip=devClip; }, done:function(){ return !!devClip&&devClip!==CO.s.clip; }},
      {ch:"YOURS", line:function(){ return 'On to the next photo: <b>›</b>'; }, sub:"",
        target:'#dvNext', start:function(){ CO.s.i=coEdIdx(); }, done:function(){ return coEdIdx()!==CO.s.i; }},
      {ch:"YOURS", line:function(){ return '<b>Paste</b> your look onto this one'; }, sub:"Same light, same colour: that's how a set of photos starts to belong together.",
        target:'#dvPaste', start:function(){ CO.s.n=devPasteN; }, done:function(){ return devPasteN>CO.s.n; }},
      {ch:"YOURS", line:function(){ return 'Now edit <b>the rest of your picks</b>'; }, sub:"Click each one in the strip. Paste is a good start, then tweak each so it works on its own.",
        target:'#dvFilm', done:function(){ return coEditedN()>=coEditTotal(); }, bar:function(){ return coEditedN()/Math.max(1,coEditTotal()); }},
      {ch:"YOURS", line:function(){ return '<b>Done</b> takes you on to the workbook'; }, sub:"Your edits stay on each photo. Come back any time and the sliders are where you left them.",
        target:'#eSave', away:true, done:function(){ return !coInEditor(); }}]},
    workbook:{where:function(){ return coRoom("workshop"); }, steps:[
      {ch:"PAGE", line:function(){ return 'Your <b>workbook</b> is where you show your thinking'; }, sub:"Photos and writing on A3 pages, like the workbooks that win scholarships.",
        target:'#st-workshop .bd-sheet', info:true},
      {ch:"PAGE", line:function(){ return 'Start a page from the <b>Compare</b> template'; }, sub:"Two of your photos side by side, with an arrow between them.",
        target:function(){ var b=null; Array.prototype.forEach.call(document.querySelectorAll('#st-workshop [data-bd-tmpl]'),function(x){ if(!b&&/Compare/i.test(x.textContent)) b=x; }); return b; }, done:function(){ return coWs().tpl==="compare"; }},
      {ch:"PHOTOS", line:function(){ return '<b>Drag two of your photos</b> into the spaces'; }, sub:"Pick two that are alike but not the same: the same subject from two places, or two lenses, or two times of day.",
        target:'#st-workshop .bd-it.sl', done:function(){ return coWsN("photo")>=2; }, bar:function(){ return coWsN("photo")/2; }},
      {ch:"WHY", line:function(){ return '<b>One sentence</b>: what\'s the difference?'; }, sub:"Click the box and write it, then press Done. Eight words or more.",
        target:function(){ return coWsEl(function(it){ return it.t==="text"&&it.sentence; }); }, done:function(){ return !!Q.flags.compared; }}]},
    folio:{where:function(){ return coRoom("folio"); }, steps:[
      {ch:"BOARD", line:function(){ return 'Your <b>folio board</b>: three A1 panels, side by side'; }, sub:"Each panel is split into thirds, and each third packs itself edge to edge.",
        target:'#st-folio .bd-sheet', info:true},
      {ch:"BOARD", line:function(){ return 'Zoom into the <b>top third</b> of panel 1: ⤢'; }, sub:"You work on one third at a time.",
        target:'#st-folio [data-bd-zoom="0"]', done:function(){ return foB.view_()===0; }},
      {ch:"FILL", line:function(){ return '<b>Drag a photo</b> in from the left'; }, sub:"Or click one to add it.",
        target:'#st-folio .lib-grid', done:function(){ return coFoSec().length>=1; }},
      {ch:"FILL", line:function(){ return 'Fill it up: <b>5 photos</b>'; }, sub:"The same photo more than once is fine. They always fill the whole third: no white space.",
        target:'#st-folio .lib-grid', done:function(){ return coFoSec().length>=5; }, bar:function(){ return coFoSec().length/5; }},
      {ch:"ARRANGE", line:function(){ return '<b>Drag one photo onto another</b> to swap them'; }, sub:"The order changes how the third fills and reads.",
        target:'#st-folio .bd-sheet .bd-it.ph', start:function(){ CO.s.o=coFoSec().map(function(it){ return it.id; }).join(); }, done:function(){ return coFoSec().map(function(it){ return it.id; }).join()!==CO.s.o; }},
      {ch:"ARRANGE", line:function(){ return 'Click <b>SIZE</b> in the middle of a photo to make it bigger'; }, sub:"Click again for bigger still, and once more to go back. The rest make room.",
        target:'#st-folio .bd-sheet .bd-szb', start:function(){ CO.s.z=foB.sizes_(); }, done:function(){ return foB.sizes_()>CO.s.z; }},
      {ch:"ARRANGE", line:function(){ return 'Try <b>Rows</b>, <b>Columns</b> or <b>Hero</b>'; }, sub:"Same photos, a different arrangement. Hero gives your biggest photo its own block.",
        target:function(){ var b=document.querySelector('#st-folio .bd-side [data-bd-style]'); return b?b.parentNode:null; }, start:function(){ CO.s.st=foB.secStyle("0.0"); }, done:function(){ return foB.secStyle("0.0")!==CO.s.st; }},
      {ch:"ARRANGE", line:function(){ return '<b>Shuffle</b> mixes up the order and sizes'; }, sub:"Keep pressing until something surprises you.",
        target:'#st-folio [data-bd-shuffle]', start:function(){ CO.s.sh=foB.shuffles_(); }, done:function(){ return foB.shuffles_()>CO.s.sh; }},
      {ch:"ARRANGE", line:function(){ return 'Back out to the <b>whole board</b>: ⤡ or '+coK("ESC"); }, sub:"See how your third sits with the rest.",
        target:'#st-folio [data-bd-zoom="-1"]', done:function(){ return foB.view_()<0; }}]},
    book:{where:function(){ return coRoom("book"); }, steps:[
      {ch:"BOOK", line:function(){ return 'The <b>Book</b> lays your picks out as a photobook'; }, sub:"Spreads, sequence and a cover, ready to export as a PDF to print.",
        target:'#st-book .bk-stage', info:true},
      {ch:"BOOK", line:function(){ return 'Click a <b>page template</b> to change this page'; }, sub:"Full bleed, centred, two-up or a grid.",
        target:'#st-book .bk-tpls', click:'#st-book [data-bk-tpl]'},
      {ch:"BOOK", line:function(){ return 'Pages come in <b>spreads</b>, so pairs matter'; }, sub:"Drag pages along the strip to change the sequence.",
        target:'#st-book .bk-strip', info:true}]},
    gallery:{where:function(){ return coRoom("gallery"); }, steps:[
      {ch:"WALL", line:function(){ return 'The <b>Gallery</b> hangs your work on a real wall'; }, sub:"At eye height, at real print sizes, like a show.",
        target:'#st-gallery .ga-wall', info:true},
      {ch:"WALL", line:function(){ return '<b>Hang another photo</b>: click one in the library'; }, sub:"Or drag it onto the wall, right where you want it.",
        target:'#st-gallery .ga-lib .lib-grid', prep:function(){ LIB.key="all"; gaRender(); }, start:function(){ CO.s.n=gaPrints().length; }, done:function(){ return gaPrints().length>CO.s.n; }},
      {ch:"WALL", line:function(){ return '<b>Take one down</b>: the × on its corner'; }, sub:"A show is as much about what you leave out.",
        target:function(){ return document.querySelector('#st-gallery .ga-x'); }, start:function(){ CO.s.r=ga.removed||0; }, done:function(){ return (ga.removed||0)>CO.s.r; }},
      {ch:"FRAME", line:function(){ return 'Try a different <b>frame</b>'; }, sub:"",
        target:'#st-gallery .ga-frames:not(.ga-labels):not(.ga-lsizes)', click:'#st-gallery [data-ga-frame]'},
      {ch:"TITLE", line:function(){ return 'Give the <b>title card</b> a style'; }, sub:"Then drag it wherever it reads best. Click it to type the show's name.",
        target:'#st-gallery .ga-labels', start:function(){ CO.s.l=ga.labelStyles||0; }, done:function(){ return (ga.labelStyles||0)>CO.s.l; }},
      {ch:"TITLE", line:function(){ return '<b>Drag prints</b> along the wall to hang your show'; }, sub:"Spacing and sequence tell the story.",
        target:'#st-gallery .ga-hang', info:true}]},
    research:{where:function(){ return coRoom("research"); }, steps:[
      {ch:"LOOK", line:function(){ return '<b>Research</b>: look closely at other photographers'; }, sub:"The moodboard wall is every photograph at once. Each pack below is one photographer or idea. Start with one Culling Game: it's quick.",
        target:'#st-research .rs-shelf', info:true},
      {ch:"CULL", line:function(){ return 'Play the <b>Culling Game</b> on any pack'; }, sub:"",
        target:'#st-research [data-rs-act="cull"]', done:function(){ return rs.view==="cull"; }},
      {ch:"CULL", line:function(){ return 'Pick the <b>stronger photograph</b>, every time'; }, sub:"Go with your gut. It builds your top three as you go.",
        target:'#st-research .rs-ab', nodim:true, place:"low", done:function(){ return (rs.culls||0)>0; }},
      {ch:"MOOD", line:function(){ return 'Now make a <b>moodboard</b>'; }, sub:"Every photograph from every pack, in one place.",
        target:'#st-research [data-rs-act="mood"]', done:function(){ return rs.view==="mood"; }},
      {ch:"MOOD", line:function(){ return 'Pick <b>at least four</b> you love'; }, sub:"Light, colour, framing, mood: whatever you want to bring to your own shoot.",
        target:'#st-research .rs-mgrid', nodim:true, place:"low", done:function(){ return (rs.mood||[]).length>=4; }},
      {ch:"KEEP", line:function(){ return '<b>Make the A3 page</b>'; }, sub:"It lands in your workbook, with the photographers credited.",
        target:'#st-research [data-rs-act="moodmake"]', away:true, start:function(){ CO.s.m=rs.moods||0; }, done:function(){ return (rs.moods||0)>CO.s.m; }}]},
    /* lighting: the new rig, hands on. The order a photographer thinks: see round it, kill the daylight, a key at 45°,
       why light size matters, fill and the ratio, a rim, colour, then the frame. Every step checks the set itself. */
    lightrig:{where:function(){ return loaded&&typeof RL!=="undefined"&&App&&(App.is("scene")||App.is("viewfinder"))&&!(typeof st!=="undefined"&&st.open); }, steps:[
      {ch:"LIGHT", line:function(){ return '<b>Lighting</b>: you bring the light'; }, sub:"Your subject's in the middle. The kit is along the bottom, the time of day across the top, and the panel on the right works like Develop: what's on the set, and the light you've picked.",
        target:'#rbSide', info:true},
      coRig({ch:"LOOK", line:function(){ return '<b>Drag the ground</b> to walk round your subject'; }, sub:"Scroll to come closer or go back. Look at a set-up from anywhere, then step back to where you'll shoot.",
        start:function(){ CO.s.o0=RLB.orbitAmt||0; }, done:function(){ return (RLB.orbitAmt||0)-CO.s.o0>=420; }, bar:function(){ return ((RLB.orbitAmt||0)-CO.s.o0)/420; }}),
      coRig({ch:"TIME", line:function(){ return 'Drag the time across the top to <b>night</b>'; }, sub:"Studio lights are easiest to see once the daylight's gone. Click or drag along the bar, right past sunset, until it goes dark.",
        target:'#rbDay .rb-track', nodim:true, done:function(){ return RLB.sunMode&&rbSolar(RLB.mins).el<-10; }}),
      coRig({ch:"KEY", line:function(){ return rbFind("softbox")?'Drag the softbox\'s stand onto the gold <b>KEY</b> spot':'Drag the <b>softbox</b> from the kit onto the gold <b>KEY</b> spot'; }, sub:"This is your key light, the main one. The spot is 45° round from you and a metre or so out: one side of your subject lights up, the other falls into shadow, and that's what gives it shape. Lost it? Press F to fit the set.",
        spot:"key", place:"top", nodim:true,
        start:function(){ var B=rbFind("softbox"); rbHome(true); RLB.keySide=1; if(B&&rbAngle(B)!=null){ var H=rbHome(), T=rbTarget(), bx=B.x-T.x, bz=B.z-T.z; RLB.keySide=(H.x*bz-H.z*bx)>=0?1:-1; } rbFrame(rbHome()); },
        target:function(){ var B=rbFind("softbox"); if(!B) return document.querySelector('#rbKit [data-rb-fx="softbox"]'); var p=rbSpotAt("key"); return p?rbAnchor({x:p.x,y:p.y,z:p.z},90):null; },
        done:function(){ return rbNearSpot(rbFind("softbox"),"key"); }}),
      coRig({ch:"SIZE", place:function(){ var F=rbFind("fresnel"), B=rbFind("softbox"); return !F||(B&&Math.hypot(F.x-B.x,F.z-B.z)>0.6*(RL.S||1))?"top":null; }, spot:function(){ var F=rbFind("fresnel"), B=rbFind("softbox"); return !F||(B&&Math.hypot(F.x-B.x,F.z-B.z)>0.6*(RL.S||1))?"fresnel":null; }, start:function(){ rbFrame(rbHome()); },
        line:function(){ var F=rbFind("fresnel"), B=rbFind("softbox"); if(!F) return 'Drag the <b>Fresnel</b> onto the gold spot beside the softbox'; if(Math.hypot(F.x-B.x,F.z-B.z)>0.6*(RL.S||1)) return 'Drag the Fresnel\'s stand onto the gold <b>FRESNEL</b> spot'; return 'Now turn the softbox <b>off</b> with its ◉'; }, sub:"Same place, a much smaller light. Watch the edge of the stump's shadow.",
        target:function(){ var F=rbFind("fresnel"), B=rbFind("softbox"); if(!F) return document.querySelector('#rbKit [data-rb-fx="fresnel"]'); if(Math.hypot(F.x-B.x,F.z-B.z)>0.6*(RL.S||1)){ var p=rbSpotAt("fresnel"); return p?rbAnchor({x:p.x,y:p.y,z:p.z},90):null; } return document.querySelector('#rbSide [data-rb-on="'+RL.lights.indexOf(B)+'"]'); }, nodim:true,
        done:function(){ var F=rbFind("fresnel"), B=rbFind("softbox"); return !!(F&&F.on&&B&&!B.on&&Math.hypot(F.x-B.x,F.z-B.z)<=0.6*(RL.S||1)); }}, true),
      coRig({ch:"SIZE", line:function(){ return 'Hard edge. <b>Remove the Fresnel</b> and turn the softbox <b>back on</b>'; }, sub:"Big light, soft shadows. Small light, hard shadows. It's the light's size next to your subject that counts, so the same softbox moved further away gets harder.",
        target:function(){ var F=rbFind("fresnel"), B=rbFind("softbox"); if(F) return document.querySelector('#rbSide [data-rb-del="'+RL.lights.indexOf(F)+'"]'); return B?document.querySelector('#rbSide [data-rb-on="'+RL.lights.indexOf(B)+'"]'):null; }, nodim:true,
        done:function(){ var B=rbFind("softbox"); return !rbFind("fresnel")&&!!(B&&B.on); }}, true),
      coRig({ch:"FILL", line:function(){ return rbFind("reflector")?'Drag the reflector onto the gold <b>FILL</b> spot':'Drag a <b>reflector</b> onto the gold <b>FILL</b> spot, on the shadow side'; }, sub:"It's on the other side of you from the softbox, facing your subject. It catches some of the key and bounces it back into the shadows.",
        spot:"fill", place:"top", nodim:true, start:function(){ rbFrame(rbHome()); },
        target:function(){ if(!rbFind("reflector")) return document.querySelector('#rbKit [data-rb-fx="reflector"]'); var p=rbSpotAt("fill"); return p?rbAnchor({x:p.x,y:p.y,z:p.z},90):null; },
        done:function(){ return rbNearSpot(rbFind("reflector"),"fill"); }}, true),
      coRig({ch:"FILL", line:function(){ var r=rbRatioNow(); return 'Bring <b>key to fill</b> to about <b>3 : 1</b>'+(r?' <span style="opacity:.7">(now '+(r<10?r.toFixed(1):Math.round(r))+' : 1)</span>':''); }, sub:"Closer fills more, further fills less. 2 : 1 is soft and open, 4 : 1 is classic, 8 : 1 is moody. Silver bounces more than White.",
        target:'#rbSide .rb-diag .lr-rgb', nodim:true,
        start:function(){ var R=rbFind("reflector"); CO.s.r0=R?{x:R.x,z:R.z,s:R.surf,h:R.h}:null; },
        done:function(){ var R=rbFind("reflector"), r=rbRatioNow(), q=CO.s.r0; var touched=!q||!R||coMovedFrom(R,q)||R.surf!==q.s||Math.abs(R.h-q.h)>0.04; return touched&&r!=null&&r>=2.2&&r<=4.2; },
        bar:function(){ var r=rbRatioNow(); return r==null?0:1-Math.min(1,Math.abs(Math.log(r/3))/Math.log(4)); }}, true),
      coRig({ch:"RIM", line:function(){ return rbFind("strip")?'Drag the stripbox onto the gold <b>RIM</b> spot, behind your subject':'Drag the <b>stripbox</b> onto the gold <b>RIM</b> spot, behind your subject'; }, sub:"A rim light sits behind, pointing back towards you. The bright edge it draws pulls your subject away from the background.",
        spot:"rim", place:"top", nodim:true, start:function(){ rbFrame(rbHome()); },
        target:function(){ if(!rbFind("strip")) return document.querySelector('#rbKit [data-rb-fx="strip"]'); var p=rbSpotAt("rim"); return p?rbAnchor({x:p.x,y:p.y,z:p.z},90):null; },
        done:function(){ var S=rbFind("strip"); return rbNearSpot(S,"rim")||!!(S&&rbRoleOf(S)==="Rim"&&rbNearSpot(S,"rim",0.7)); }}),
      coRig({ch:"COLOUR", line:function(){ var B=rbFind("softbox"); return rbCur()===B?'Give the key a <b>Warm</b> gel, or drag its <b>Colour</b> to about 3200 K':'Click the <b>softbox</b> in the panel'; }, sub:"A warm key against a cooler rim is one of the oldest colour tricks in lighting.",
        target:function(){ var B=rbFind("softbox"); if(!B) return null; if(rbCur()!==B) return document.querySelector('#rbSide .rb-li[data-rb-pick="'+RL.lights.indexOf(B)+'"]'); var ki=document.querySelector('#rbSide [data-rb-k="k"]'); return ki&&ki.closest(".lr-row"); }, nodim:true,
        done:function(){ var B=rbFind("softbox"); return !!(B&&(B.k<=3800||B.gel==="#ffc98a")); }}, true),
      {ch:"SHOOT", line:function(){ return viewfinderOn?'Now <b>take the frame</b>':'<b>Right-click</b> to raise the camera, then take the frame'; }, sub:"Night, three pieces of kit and a ratio you chose. The shadows are meant to be dark, so meter for the lit side.",
        start:function(){ CO.s.n=photos.length; }, done:function(){ return photos.length>CO.s.n; }},
      coRig({ch:"SUNSET", line:function(){ var e=rbSolar(RLB.mins).el; return 'Drag the time back to <b>sunset</b>'+(RLB.sunMode&&e>3?' <span style="opacity:.7">(a little later)</span>':RLB.sunMode&&e<-2?' <span style="opacity:.7">(a little earlier)</span>':''); }, sub:"Keep your lights where they are. Now the low sun joins in, warm and from one side, and your kit has to work with it.",
        target:'#rbDay .rb-track', nodim:true, done:function(){ var e=rbSolar(RLB.mins).el; return RLB.sunMode&&e>=-2&&e<=3; }}),
      {ch:"SUNSET", line:function(){ return viewfinderOn?'Take <b>one more frame</b>':'<b>Right-click</b> to raise the camera and take one more'; }, sub:"Same set, different sky. Put the two frames side by side later and see what the daylight changed.",
        start:function(){ CO.s.n=photos.length; }, done:function(){ return photos.length>CO.s.n; }}]},
    /* golden hour: back into Lighting, the time to golden, then walk round until the sun is behind the subject */
    golden:{where:function(){ return loaded&&!App.is("hub")&&!(typeof st!=="undefined"&&st.open); }, steps:[
      {ch:"TIME", line:function(){ return 'One more: <b>'+coK("Space")+', then Lighting</b>'; }, sub:"The best light of the day is about to happen.",
        target:'#navActs [data-nav-act="kit"]', kit:"lights", nodim:true, done:function(){ return !!RL.ui; }},
      coRig({ch:"TIME", line:function(){ return 'Drag the time to <b>golden hour</b>'; }, sub:"The last hour before sunset: the sun's low, the light's warm and every shadow is long.",
        target:'#rbDay', nodim:true, done:function(){ var e=rbSolar(RLB.mins).el; return RLB.sunMode&&e>-0.5&&e<6; }}),
      coRig({ch:"SUN", line:function(){ var a=rbSunAngle(); return 'Walk round until the sun is <b>behind your subject</b>'+(a!=null?' <span style="opacity:.7">('+a+'° off)</span>':''); }, sub:"Drag the ground to orbit, and watch the sun in the diagram. Backlit, the stump gets a rim of gold and its shadow runs towards you.",
        target:'#rbSide .rb-diag', nodim:true, done:function(){ var a=rbSunAngle(); return a!=null&&a<=35; }, bar:function(){ var a=rbSunAngle(); return a==null?0:1-Math.min(1,Math.max(0,a-35)/145); }}),
      {ch:"SHOOT", line:function(){ return '<b>Right-click</b> to raise the camera and take the frame'; }, sub:"Shooting into the sun, so watch for flare and meter for the stump, not the sky.",
        start:function(){ CO.s.n=photos.length; }, done:function(){ return photos.length>CO.s.n; }}]},
    artist:{where:function(){ return coRoom("research")||coRoom("workshop"); }, steps:[
      {ch:"CHOOSE", line:function(){ return 'Open <b>See all the photos</b>'; }, sub:"The library: every photograph from every photographer, with a folder for each down the side.",
        target:function(){ return document.querySelector('#st-research [data-rs-act="all"]')||document.querySelector('#st-research [data-rs-act="cull"]'); }, done:function(){ return rs.view==="all"; }},
      {ch:"CHOOSE", line:function(){ return 'Choose <b>'+rsAmNeed()+' photographs</b> that show a way of seeing'; }, sub:"This photographer, or a mix from the folders on the left. Look for what keeps coming back: the light, the colour, where they stand, what they leave out.",
        target:'#st-research .rs-mgrid', nodim:true, place:"bottom", done:function(){ return rs.view==="all"&&(rs.am||[]).length>=rsAmNeed(); }, bar:function(){ return (rs.am||[]).length/Math.max(1,rsAmNeed()); }},
      {ch:"PAGE", line:function(){ return '<b>Make the page</b>'; }, sub:"Add more first if you like, up to twelve. It lands in your workbook with room to write what you noticed.",
        target:'#st-research [data-rs-act="amake"]', start:function(){ CO.s.m=rs.sent||0; }, done:function(){ return (rs.sent||0)>CO.s.m; }},
      {ch:"PAGE", line:function(){ return 'Try a <b>black page</b>'; }, sub:"Page colour, on the right. Photographs often sit better on black. Your call.",
        target:'#st-workshop [data-bd-bg="black"]', nodim:true, done:function(){ var pg=coWs(); return !!pg&&(pg.bg==="black"||pg.bg==="charcoal"); }},
      {ch:"PAGE", line:function(){ return '<b>Drag a photograph</b> somewhere new'; }, sub:"They're yours to arrange. Make one bigger, overlap two, leave space.",
        target:'#st-workshop .bd-sheet', nodim:true, place:"low", start:function(){ var pg=coWs(); CO.s.pos=pg?pg.items.filter(function(x){ return x.t==="photo"; }).map(function(x){ return x.x+","+x.y+","+x.w; }).join("|"):""; },
        done:function(){ var pg=coWs(); return !!pg&&pg.items.filter(function(x){ return x.t==="photo"; }).map(function(x){ return x.x+","+x.y+","+x.w; }).join("|")!==CO.s.pos; }},
      {ch:"PAGE", line:function(){ return 'Add more from the tray if you want, then press <b>Finished</b>'; }, sub:"Take your time. The page is done when you say it is.",
        target:'#wsDone', nodim:true, away:true, done:function(){ var pg=coWs(); return !!(pg&&pg.done); }}]},
    library:{where:function(){ return coRoom("select"); }, steps:[
      {ch:"YOURS", line:function(){ return 'Make a <b>folder</b> for your own project: + NEW'; }, sub:"A shoot, a theme, a series. Whatever you're working on.",
        target:'#st-select [data-lib-new]', start:function(){ CO.s.p=(st.projects||[]).length; }, done:function(){ return LIB.naming==="new"||(st.projects||[]).length>CO.s.p; }},
      {ch:"YOURS", line:function(){ return '<b>Name it</b>, then press '+coK("ENTER"); }, sub:"",
        target:'#st-select .lib-in', start:function(){ CO.s.p=(st.projects||[]).length; }, done:function(){ return (st.projects||[]).length>CO.s.p||((st.projects||[]).length&&LIB.naming!=="new"&&LIB.key.indexOf("proj:")===0); }},
      {ch:"YOURS", line:function(){ return 'That folder\'s yours. <b>Go and shoot</b>'; }, sub:"Then drag your photos onto it, or drop photos in from your computer. Everything you've learnt today works on them.",
        target:function(){ var a=document.querySelectorAll('#st-select .lib-f.proj'); return a.length?a[a.length-1]:null; }, info:true}]}};
  /* the lighting tours: whatever the student does mid-step (camera up, Lighting closed, the softbox deleted), the prompt says how to get back */
  function coRig(s, needSoft){ var line=s.line, target=s.target, done=s.done;
    s.line=function(){ if(viewfinderOn) return '<b>Right-click</b> to lower the camera and carry on'; if(!RL.ui) return 'Open Lighting again: '+coK("SPACE")+', then <b>Lighting</b>'; if(needSoft&&!rbFind("softbox")) return 'Bring the <b>softbox</b> back out of the kit'; return line(); };
    s.target=function(){ if(viewfinderOn) return null; if(!RL.ui) return document.querySelector('#navActs [data-nav-act="kit"]'); if(needSoft&&!rbFind("softbox")) return document.querySelector('#rbKit [data-rb-fx="softbox"]'); return typeof target==="function"?target():target?document.querySelector(target):null; };
    if(done) s.done=function(){ if(viewfinderOn&&!s.shoot) return false; if(!RL.ui||(needSoft&&!rbFind("softbox"))) return false; return done(); };
    return s; }
  function coMovedFrom(L,p){ return !!(L&&p&&Math.hypot(L.x-p.x,L.z-p.z)>0.15*(RL.S||1)); }
  function coSteps(){ return (CO_TOURS[CO.tour]||{steps:[]}).steps; }
  function coLen(id){ return (CO_TOURS[id]||{steps:[]}).steps.length; }
  var CO_STEPS=CO_TOURS.basics.steps;   // the guide's basics step counts these
  function coTourDone(id){ return !!Q.tours[id]; }
  function coProg(id){ return Q.tourStep[id]||0; }
  function coActive(){ return CO.on&&!CO.done; }
  // the gold frames wait until the warm-up's done
  function coHidesFrames(){ return CO.on&&CO.tour==="basics"; }   /* the gold frames wait until the warm-up's done */
  function coEl(){ var e=$("coCard"); if(!e){ e=document.createElement("div"); e.id="coCard"; e.className="co-card"; document.body.appendChild(e);
      var r=document.createElement("div"); r.id="coRing"; r.className="co-ring"; document.body.appendChild(r);
      e.addEventListener("click",function(ev){ if(ev.target.closest("[data-co-skipall]")){ ev.stopPropagation(); coFinish(true); return; }
        if(ev.target.closest("[data-co-skip]")){ ev.stopPropagation(); coSkipStep(); }
        if(ev.target.closest("[data-co-next]")){ ev.stopPropagation(); CO.s.ok=true; } }); } return e; }
  function coStart(tour){ tour=tour||"basics"; if(CO.on&&CO.tour===tour) return; if(CO.on) coStop(); CO.ticking=false;
    CO.tour=tour; CO.on=true; CO.done=false; CO.skipped=0; if(Q.tours[tour]&&(Q.tourStep[tour]||0)>=coLen(tour)) Q.tourStep[tour]=0; CO.i=Q.tourStep[tour]||0; CO.look=0; CO.walked=0; CO.lx=null; CO.seen=-1; coEnter(); coLoop(); }
  function coMultiOff(){ Array.prototype.forEach.call(document.querySelectorAll('.co-multi,.co-float'),function(e){ e.classList.remove('co-multi','co-float'); }); }
  function coEnter(){ coUnmark(); coMultiOff(); if(typeof meterBias!=="undefined"&&meterBias){ meterBias=0; computeCam(); if(typeof cbRender==="function") cbRender(); } var s=coSteps()[CO.i]; CO.s={}; CO.keys={}; CO.t0=performance.now(); CO.seen=-1; CO.lockTo=s&&s.info?CO.t0+READ_MS:0; if(s&&s.start) s.start(); CO.html=""; }
  function coStop(){ coMultiOff(); document.body.classList.remove("co-golden"); if(typeof RL!=="undefined"&&(RL.spots||RL.want)){ RL.spots=null; RL.want=null; if(typeof rlPlanUI==="function"){ rlPlanUI(); rlPanel(); } } if(typeof meterBias!=="undefined"&&meterBias){ meterBias=0; computeCam(); } setTimeout(function(){ if(typeof chMarkers==="function") chMarkers(); },0); coUnmark(); if(CO.tgt){ CO.tgt.classList.remove("co-target"); CO.tgt=null; } CO.on=false; document.body.removeAttribute("data-co-kit"); document.body.classList.remove("co-lens"); cancelAnimationFrame(CO.raf); var e=$("coCard"), r=$("coRing"); if(e) e.classList.remove("show","media"); if(r) r.classList.remove("show"); document.body.classList.remove("co-on","co-dial"); }
  /* SKIP moves past one prompt, not the whole tour: one click on the first step used to throw the warm-up away. Skip all is offered once you've skipped a step */
  function coSkipStep(){ if(!CO.on||CO.ticking) return; CO.skipped=(CO.skipped||0)+1; coUnmark(); CO.i++; Q.tourStep[CO.tour]=CO.i; qSave(); if(CO.i>=coSteps().length) coFinish(false); else coEnter(); }
  function coFinish(skipped){ CO.done=true; Q.tourStep[CO.tour]=coSteps().length; Q.tours[CO.tour]=true; qSave(); coStop();
    if(skipped) toast(CO.tour==="basics"?"Warm-up skipped. The gold frames are out.":"Tour skipped."); }
  function coLoop(){ cancelAnimationFrame(CO.raf); CO.raf=requestAnimationFrame(coLoop); if(!CO.on) return; var T=CO_TOURS[CO.tour], e0;
    var cur=coSteps()[CO.i], here=T&&T.where();
    if(!here){ e0=$("coCard"); if(e0) e0.classList.remove("show"); e0=$("coRing"); if(e0) e0.classList.remove("show"); document.body.classList.remove("co-on","co-dial","co-lens"); document.body.removeAttribute("data-co-kit");
      if(cur&&cur.away&&!CO.ticking&&cur.done()){ CO.ticking=true; CO.i++; Q.tourStep[CO.tour]=CO.i; qSave(); CO.ticking=false; if(CO.i>=coSteps().length) coFinish(false); else coEnter(); }   // a prompt that finishes by leaving (Done)
      return; }
    // what the student has done since the last frame
    if(looking&&CO.lyaw!=null){ var dy=Math.abs(yaw-CO.lyaw); if(dy<1) CO.look+=dy; } CO.lyaw=yaw;
    if(CO.lx!=null&&!(CH.pull>=0)){ var d=Math.hypot(camPos.x-CO.lx,camPos.z-CO.lz); if(d<0.5) CO.walked+=d; } CO.lx=camPos.x; CO.lz=camPos.z;
    var s=coSteps()[CO.i]; if(!s){ coFinish(false); return; }   // each prompt stays up long enough to read (dwell) before it ticks
    if(CO.seen!==CO.i){ CO.seen=CO.i; CO.lockTo=s.info?performance.now()+READ_MS:0; if(s.prep) s.prep(); }   // the read timer starts when the card first shows
    var isDone=(s.info||s.click)?CO.s.ok:s.done();
    if(!CO.ticking&&performance.now()-CO.t0>(s.info?0:(s.dwell||900))&&isDone){ coTicked(); return; }   // one tick per prompt, however late the timer runs
    coRender(s); }
  function coTicked(){ CO.ticking=true; var e=coEl(); e.classList.add("ok"); setTimeout(function(){ CO.ticking=false; e.classList.remove("ok"); CO.i++; Q.tourStep[CO.tour]=CO.i; qSave();
      if(CO.i>=coSteps().length){ coFinish(false); return; } coEnter(); }, 600); }
  function coRender(s){ var e=coEl(), ring=$("coRing"), steps=coSteps();
    var chs=[], prev=null; steps.forEach(function(x,i){ if(x.ch!==prev){ chs.push({ch:x.ch, first:i}); prev=x.ch; } });
    var inCh=steps.filter(function(x){ return x.ch===s.ch; }), k=inCh.indexOf(s);
    // a nudge when the step needs something open first
    var pre="";
    if(s.need==="vf"&&!viewfinderOn&&!bg.open&&!cbOpen) pre='Raise the camera first: '+coK("P");
    else if((s.need==="bag"||s.need==="lens")&&!bg.open) pre='Open the bag again: '+coK("SPACE")+', then <b>Bag</b>';
    else if(s.need==="back"&&!cbOpen) pre='Open the settings again: '+coK("SPACE")+', then <b>Settings</b>';
    else if(s.need==="crop"&&!cropActive()) pre='Open the crop again: click <b>Crop</b> or press '+coK("C");
    var b=s.bar?Math.max(0,Math.min(1,s.bar())):null;
    var html='<div class="co-top">'+chs.map(function(c){ var on=c.ch===s.ch, past=CO.i>c.first&&!on; return '<span class="co-ch'+(on?' on':'')+(past?' past':'')+'">'+c.ch+'</span>'; }).join('<i></i>')
      +(CO.skipped?'<button class="co-skip all" data-co-skipall title="Skip the rest of this tour">SKIP ALL</button>':'')+'<button class="co-skip" data-co-skip title="Skip this step">SKIP STEP</button></div>'
      +(s.media&&!pre?'<canvas class="co-media" data-co-media="'+s.media+'"></canvas>':'')
      +'<div class="co-line">'+(pre||s.line())+'</div>'+((pre?'':s.sub)?'<div class="co-sub">'+s.sub+'</div>':'')
      +'<div class="co-foot"><div class="co-dots">'+inCh.map(function(_,j){ return '<i class="'+(j<k?'d':j===k?'c':'')+'"></i>'; }).join("")+'</div>'
      +(s.info?(performance.now()<CO.lockTo?'<button class="co-next rl" data-co-next disabled style="--rl:'+Math.round(CO.lockTo-performance.now())+'ms">GOT IT ›</button>':'<button class="co-next" data-co-next>GOT IT ›</button>'):'')+'</div>'
      +(b!=null?'<div class="co-bar"><b style="width:'+(b*100).toFixed(0)+'%"></b></div>':'');
    if(html!==CO.html){ e.innerHTML=html; CO.html=html; }
    if(CO.riseI!==CO.i||CO.riseT!==CO.tour){ CO.riseI=CO.i; CO.riseT=CO.tour; e.classList.add("rise"); clearTimeout(CO.riseTm); CO.riseTm=setTimeout(function(){ e.classList.remove("rise"); },900); }   /* a new prompt rises in; edits to the same prompt don't */
    e.classList.add("show"); document.body.classList.add("co-on");
    e.classList.toggle("media", !!(s.media&&!pre)); document.body.classList.toggle("co-dial", !!(s.dial&&!pre&&cbOpen));
    var wantKit=pre?((s.need==="bag"||s.need==="lens")&&!bg.open?"bag":s.need==="back"&&!cbOpen?"back":""):(s.kit||"");
    if(document.body.getAttribute("data-co-kit")!==wantKit){ if(wantKit) document.body.setAttribute("data-co-kit",wantKit); else document.body.removeAttribute("data-co-kit"); }
    document.body.classList.toggle("co-lens", !!(s.lens&&!pre&&bg.open));
    if(s.media&&!pre) coMediaDraw(s.media, e.querySelector(".co-media"), performance.now());
    // light up the thing to click, and sit the card beside it: to its left for the side panels, else below or above
    var t=s.target&&!pre?(typeof s.target==="function"?s.target():document.querySelector(s.target)):null, r=t?t.getBoundingClientRect():null;
    if(CO.tgt!==t){ if(CO.tgt) CO.tgt.classList.remove("co-target"); CO.tgt=t; if(t) t.classList.add("co-target"); }
    ring.classList.toggle("nodim", !!(s.nodim||(CO_TOURS[CO.tour]||{}).nodim));
    if(s.mark&&!document.querySelector(".co-mark")) coMark(s.mark[0],s.mark[1]);
    /* several things to choose between: each gets its own ring; things that can be clicked bob gently */
    if(!pre&&s.targets){ var ts=s.targets()||[]; Array.prototype.forEach.call(document.querySelectorAll('.co-multi'),function(x){ if(ts.indexOf(x)<0) x.classList.remove('co-multi'); }); ts.forEach(function(x){ x.classList.add('co-multi'); }); }
    if(!pre&&s.float) Array.prototype.forEach.call(document.querySelectorAll(s.float),function(x){ x.classList.add('co-float'); });
    if(r&&r.width>2&&r.bottom>0&&r.top<window.innerHeight){ var p=6; ring.style.left=(r.left-p)+"px"; ring.style.top=(r.top-p)+"px"; ring.style.width=(r.width+2*p)+"px"; ring.style.height=(r.height+2*p)+"px"; ring.classList.add("show");
      var W=window.innerWidth, H=window.innerHeight, cw=e.offsetWidth||440, chh=e.offsetHeight||130, x, y;
      var pl=typeof s.place==="function"?s.place():s.place;
      var beside=r.left>W*0.55&&r.left-p-20-360>12; e.classList.toggle("beside", !!beside);
      if(beside){ e.style.width="360px"; cw=360; chh=e.offsetHeight||chh; x=r.left-p-20-cw; y=Math.max(12,Math.min(H-chh-12,r.top+r.height/2-chh/2)); }   /* beside a panel row: narrow, so the photo stays mostly clear */
      else { var below=r.bottom+p+16+chh<H-10; x=Math.max(12,Math.min(W-cw-12,r.left+r.width/2-cw/2)); y=below?r.bottom+p+16:Math.max(12,r.top-p-16-chh); }
      /* column: stay in the target's own column (its right edge), below it if there's room, else above: the light table stays clear */
      if(pl==="column"){ var col=t.closest(".st-loupe")||(s.col&&document.querySelector(s.col))||t, cr=col.getBoundingClientRect(), cwid=Math.min(cw,Math.max(300,cr.width)); e.style.width=cwid+"px"; cw=cwid; chh=e.offsetHeight||chh;
        x=Math.max(12,Math.min(W-cw-12,cr.right-cw)); var fitsBelow=r.bottom+p+16+chh<H-10; y=fitsBelow?r.bottom+p+16:Math.max(12,cr.top+12); }   /* no room below: over the top of the column (the big preview), never over the buttons */
      if(pl==="low"){ var stg=document.querySelector("#editStage"), sr=stg?stg.getBoundingClientRect():{left:0,width:W}; x=Math.max(12,Math.min(W-cw-12,sr.left+sr.width/2-cw/2)); y=H-chh-10; }   /* over the film strip, clear of the photo */
      if(pl==="bottom"){ x=Math.max(12,Math.min(W-cw-12,r.left+r.width/2-cw/2)); y=Math.max(r.bottom+p+16,H-chh-64); if(y+chh>H-8) y=H-chh-8; }   /* under the screen, clear of the rows */
      /* side: beside the camera screen, so the sliders and the meter stay clear to use */
      if(pl==="side"){ var rr=0; Array.prototype.forEach.call(document.querySelectorAll('#camback .cb-scale'),function(x){ rr=Math.max(rr,x.getBoundingClientRect().right); }); rr=Math.max(rr,r.right);
        var sw=Math.max(260,Math.min(440,W-rr-40)); e.style.width=sw+"px"; e.classList.add("side"); cw=sw; chh=e.offsetHeight||chh; x=Math.min(W-sw-12,rr+24); y=Math.max(12,Math.min(H-chh-12,H/2-chh/2)); }
      else if(e.classList.contains("side")){ e.classList.remove("side"); e.style.width=""; }
      else if(pl!=="column"&&!(r.left>W*0.55&&r.left-p-20-360>12)) e.style.width="";
      /* top: under the daylight bar in Lighting, clear of the kit strip and the floor where the lights go */
      if(pl==="top"){ var db=document.querySelector("#rbDay"), dr=db?db.getBoundingClientRect():{bottom:90}, sw2=typeof RLB_SIDE!=="undefined"?RLB_SIDE:0; e.style.width=""; cw=e.offsetWidth||cw; chh=e.offsetHeight||chh;
        x=Math.max(12,Math.min(W-sw2-cw-12,(W-sw2)/2-cw/2)); y=dr.bottom+14; e.classList.remove("beside"); }
      e.style.left=x+"px"; e.style.top=y+"px"; e.style.bottom="auto"; e.style.transform="none"; e.classList.add("pinned"); }
    else { ring.classList.remove("show"); e.style.left=""; e.style.top=""; e.style.bottom=""; e.style.transform=""; e.style.width=""; e.classList.remove("pinned","side","beside"); } }
  document.addEventListener("click",function(e){ if(!CO.on) return; var s=coSteps()[CO.i]; if(s&&s.click&&e.target.closest&&e.target.closest(s.click)) CO.s.ok=true; }, true);
  document.addEventListener("keydown",function(e){ if(!CO.on) return; var m={KeyW:"W",KeyA:"A",KeyS:"S",KeyD:"D",KeyQ:"Q",KeyE:"E",KeyP:"P",KeyB:"B",Space:"SPACE",Digit2:"2",Backslash:"\\",Escape:"ESC",Enter:"ENTER",KeyC:"C"}[e.code]; if(m) CO.keys[m]=true; }, true);
  if(/[?&]dev/.test(location.search)) window.__co={ state:function(){ var s=coSteps()[CO.i]; return {on:CO.on, tour:CO.tour, done:CO.done, i:CO.i, n:coSteps().length, ch:s&&s.ch, shown:!!document.querySelector("#coCard.show"), ed:edState?{i:edState.i, a:edState.aspect, cx:+edState.cx.toFixed(3), cy:+edState.cy.toFixed(3)}:null}; }, skip:function(){ coFinish(true); },
    start:coStart, stop:coStop, next:function(){ CO.s.ok=true; }, go:function(){ if(CO.on&&!CO.ticking) coTicked(); }, clip:function(kind,cv,ms){ coMediaDraw(kind,cv,ms); }, qclip:function(kind,cv,ms){ qClipDraw(kind,cv,ms); }, qmorph:qMorphOpen, nudge:function(o){ if(o.look) CO.look+=o.look; if(o.walk) CO.walked+=o.walk; if(o.keys) o.keys.forEach(function(k){ CO.keys[k]=true; }); } };
