  // ================= COACH: hands-on tours, one prompt at a time =================
  // The way a game teaches its controls: one short prompt at the bottom of the screen (or beside the thing it's about),
  // the thing to click lit up, and the prompt ticks over by itself the moment it's done. Three tours, each run by a
  // guide step:
  //   basics  at the location, before the gold frames unlock: look, walk, crouch, the camera, the bag, the camera back
  //   select  on the light table: look at a photo, Pick, Reject, then choose your best
  //   edit    across the three picks: the Light sliders on the first, black and white by hand on the second, then
  //           a crop and the Color Grading wheels on the third
  // Progress lives in the guide step's flags (GD.flags.co), so a reload carries on from the same prompt.
  var CO={tour:null, i:0, on:false, s:{}, keys:{}, look:0, walked:0, lx:null, lz:null, lyaw:null, done:false, raf:0, html:"", okT:0, t0:0, seen:-1};
  function coK(k){ return '<kbd data-co-k="'+k+'"'+(CO.keys[k]?' class="on"':'')+'>'+k+'</kbd>'; }
  function coPickN(){ return GD.demo?3:8; }
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
  function coFoSec(){ return typeof foB!=="undefined"?foB.secItems("0.0"):[]; }
  function coRoom(r){ return typeof st!=="undefined"&&st.open&&st.room===r; }

  // ---- little clips for the camera settings: one Stump frame, the setting swept end to end and back ----
  // Each shows what the setting does to the light and what it costs: the shutter brightens but shakes, the aperture
  // brightens but melts the background, ISO brightens but grains. Drawn live on a canvas, so they cost nothing to ship.
  var CO_IMG=new Image(); CO_IMG.src="asset:assets/coach/stump.jpg";
  var CO_MEDIA={
    shutter:{vals:["1/1000","1/500","1/250","1/125","1/60","1/30","1/15","1/8"], lo:"Freezes everything, but darker", hi:"Brighter, but your hands smear it"},
    aperture:{vals:["f/2","f/2.8","f/4","f/5.6","f/8","f/11","f/16"], lo:"Bright, and the background melts away", hi:"Darker, but sharp front to back"},
    iso:{vals:["ISO 100","200","400","800","1600","3200","ISO 6400"], lo:"Clean, but it needs lots of light", hi:"Bright in the dark, but grainy"},
    meter:{vals:["−2","−1","0","+1","+2"], lo:"Too dark: shadows turn to mud", mid:"Just right", hi:"Too bright: the sky burns out"}};
  var coNoise=null;
  function coNoiseCanvas(){ if(coNoise) return coNoise; var c=document.createElement("canvas"); c.width=c.height=256; var g=c.getContext("2d"), d=g.createImageData(256,256);
    for(var i=0;i<d.data.length;i+=4){ var v=128+(Math.random()+Math.random()+Math.random()-1.5)*120; d.data[i]=d.data[i+1]=d.data[i+2]=v; d.data[i+3]=255; } g.putImageData(d,0,0); return (coNoise=c); }
  // 0 → 1 → 0 with a pause at each end, so there's time to see both
  function coSweep(now){ var T=5.6, u=(now/1000)%T/T, e=function(x){ return x<0?0:x>1?1:x*x*(3-2*x); };
    return u<0.12?0:u<0.45?e((u-0.12)/0.33):u<0.62?1:u<0.95?1-e((u-0.62)/0.33):0; }
  function coMediaDraw(kind, cv, now){ var M=CO_MEDIA[kind]; if(!M||!cv||!CO_IMG.complete||!CO_IMG.naturalWidth) return;
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
    else if(kind==="aperture"){ bright=1.32-0.78*t; var B=(1-t)*7;
      g.filter="blur("+B.toFixed(2)+"px) brightness("+bright.toFixed(3)+")"; g.drawImage(img,dx-8,dy-8,dw+16,dh+16);
      // the stump stays sharp: it's what you focused on
      var o=coMediaDraw.o||(coMediaDraw.o=document.createElement("canvas")); o.width=cv.width; o.height=cv.height; var q=o.getContext("2d"); q.setTransform(dpr,0,0,dpr,0,0);
      q.filter="brightness("+bright.toFixed(3)+")"; q.drawImage(img,dx,dy,dw,dh); q.filter="none"; q.globalCompositeOperation="destination-in";
      q.save(); q.translate(W*0.43,H*0.6); q.scale(1,2.1); var rg=q.createRadialGradient(0,0,W*0.07,0,0,W*0.2); rg.addColorStop(0,"#000"); rg.addColorStop(1,"rgba(0,0,0,0)"); q.fillStyle=rg; q.fillRect(-W,-H,2*W,2*H); q.restore();
      g.filter="none"; g.setTransform(1,0,0,1,0,0); g.drawImage(o,0,0); g.setTransform(dpr,0,0,dpr,0,0); }
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
  // a dial step on the camera back: the row lit up, the dial lit up, scroll to turn it
  function coDialVal(k){ return k==="sh"?shIdx:k==="ap"?apIdx:isoIdx; }
  function coDial(row,key,name,sub){ return {ch:"SETTINGS", line:function(){ return '<kbd>SCROLL</kbd> to turn the dial and change the <b>'+name+'</b>'; }, sub:sub,
      target:'#camback [data-cb-row="'+row+'"]', dial:true, place:"bottom", need:"back", dwell:1200,
      prep:function(){ cbTab="shoot"; cbRow=row; if(cbOpen) cbRender(); }, start:function(){ CO.s.v=coDialVal(key); },
      done:function(){ return Math.abs(coDialVal(key)-CO.s.v)>=2; }, bar:function(){ return Math.min(1,Math.abs(coDialVal(key)-CO.s.v)/2); }}; }
  var CO_TOURS={
    basics:{where:function(){ return loaded&&!App.is("hub")&&!(typeof st!=="undefined"&&st.open); }, steps:[
      {ch:"MOVE", line:function(){ return 'Click, then move the mouse to look around'; }, sub:"Esc lets go of the mouse.",
        done:function(){ return CO.look>1.6; }, bar:function(){ return CO.look/1.6; }},
      {ch:"MOVE", line:function(){ return coK("W")+coK("A")+coK("S")+coK("D")+' to walk'; }, sub:"Have a wander. You can't walk through the stump.",
        done:function(){ return CO.walked>3; }, bar:function(){ return CO.walked/3; }},
      {ch:"MOVE", line:function(){ return coK("Q")+' to crouch, '+coK("E")+' to stand tall'; }, sub:"Where you hold the camera changes the picture.",
        done:function(){ return CO.keys.Q&&CO.keys.E; }},
      {ch:"SHOOT", line:function(){ return coK("P")+' raises the camera to your eye'; }, sub:"You're looking through the viewfinder now.",
        done:function(){ return viewfinderOn; }},
      {ch:"SHOOT", line:function(){ return '<kbd>CLICK</kbd> to take a photo'; }, sub:"Anything you like. It goes into your studio.",
        start:function(){ CO.s.n=photos.length; }, done:function(){ return photos.length>CO.s.n; }, need:"vf"},
      {ch:"SHOOT", line:function(){ return coK("2")+' then <kbd>SCROLL</kbd> to change the aperture'; }, sub:"1 is shutter, 2 aperture, 3 ISO, 4 zoom. Watch the numbers along the bottom.",
        start:function(){ CO.s.ap=apIdx; }, done:function(){ return apIdx!==CO.s.ap; }, need:"vf"},
      {ch:"BAG", line:function(){ return coK("B")+' opens your camera bag'; }, sub:"Different cameras and lenses for different pictures.",
        done:function(){ return bg.open; }},
      {ch:"BAG", line:function(){ return 'Click the <b>APS-C mirrorless</b>'; }, sub:"Its smaller sensor crops every lens 1.6× tighter.",
        target:'#bag [data-bg-body="ml"]', done:function(){ return bg.body==="ml"; }, need:"bag"},
      {ch:"BAG", line:function(){ return 'Now <b>change the lens</b>'; }, sub:"",
        target:'#bag .lensbtn', done:function(){ return bg.stage==="lens"; }, need:"bag"},
      {ch:"BAG", line:function(){ return 'Try the <b>50 mm</b>'; }, sub:"Watch it twist off and the new one click on.",
        target:'#bag [data-bg-lens="50"]', done:function(){ return bg.lens==="50"&&!bg.busy; }, need:"lens"},
      {ch:"BAG", line:function(){ return '<b>Lock it in</b>'; }, sub:"",
        target:'#bag [data-bg="done"]', done:function(){ return bg.stage==="choose"&&lensId==="50"; }, need:"lens"},
      {ch:"BAG", line:function(){ return coK("B")+' closes the bag'; }, sub:"",
        done:function(){ return !bg.open; }},
      {ch:"SETTINGS", line:function(){ return coK("SPACE")+' opens the back of the camera'; }, sub:"All your settings, and the photos you've taken.",
        done:function(){ return cbOpen; }},
      {ch:"SETTINGS", media:"shutter", info:true, need:"back", line:function(){ return 'The <b>shutter speed</b> is how long the camera looks'; },
        sub:"Fast, like 1/1000, freezes everything but lets in less light. Slow, like 1/15, lets in lots of light, but any wobble in your hands smears the photo. The longer the lens, the faster you need."},
      coDial(0,"sh","shutter speed","Or click a number. Watch the needle at the bottom swing as you go."),
      {ch:"SETTINGS", media:"aperture", info:true, need:"back", line:function(){ return 'The <b>aperture</b> is how wide the lens opens'; },
        sub:"A small number, like f/2, is a wide hole: lots of light, and a soft background that makes your subject pop. A big number, like f/16, is a pinhole: darker, but sharp from front to back."},
      coDial(1,"ap","aperture","Small numbers open it up, big numbers close it down."),
      {ch:"SETTINGS", media:"iso", info:true, need:"back", line:function(){ return '<b>ISO</b> is how sensitive the sensor is'; },
        sub:"Low, like 100, is clean and smooth but needs plenty of light. Turn it up when it's dark, but the photo gets grainy. Photographers reach for it last."},
      coDial(2,"iso","ISO","Higher sees in the dark, lower keeps it clean."),
      {ch:"SETTINGS", media:"meter", info:true, need:"back", line:function(){ return 'The <b>light meter</b> adds them all up'; },
        sub:"Every setting moves the needle. Left of the middle is too dark, right is too bright. Get it near the middle, then trade one setting against another for the look you want."},
      {ch:"SETTINGS", line:function(){ return 'Get the needle to the <b>middle</b>'; }, sub:"Turn any of the three. Click a row to choose which one the dial turns.",
        target:'#camback .cb-meter', place:"bottom", dwell:2000, done:function(){ return Math.abs(evStops)<=0.5; }, need:"back"},
      {ch:"SETTINGS", line:function(){ return coK("SPACE")+' takes you back to the scene'; }, sub:"",
        done:function(){ return !cbOpen; }}]},
    select:{where:function(){ return typeof st!=="undefined"&&st.open&&st.room==="select"; }, steps:[
      {ch:"LOOK", line:function(){ return 'Every photo you took is on the <b>light table</b>'; }, sub:"Picking your best is half of photography. Take your time.",
        target:'#st-select .st-sheet', info:true},
      {ch:"LOOK", line:function(){ return '<b>Click a photo</b> to see it big'; }, sub:"Or use "+'← →'+" to move along.",
        target:'#st-select .st-cell:not(.cur)', start:function(){ CO.s.cur=st.cur; }, done:function(){ return st.cur!==CO.s.cur; }},
      {ch:"CHOOSE", line:function(){ return '<b>Pick</b> keeps it for your folio'; }, sub:"Click Pick, or press P. The pencil ring shows it's in.",
        target:'#st-select [data-st-act="pick"]', done:function(){ var p=photos[st.cur]; return !!(p&&p.pick); }},
      {ch:"CHOOSE", line:function(){ return '<b>Reject</b> the ones you won\'t use'; }, sub:"Click a weaker photo first, then Reject (or press X). It's struck out, not deleted.",
        target:'#st-select [data-st-act="reject"]', start:function(){ CO.s.r=photos.filter(function(p){ return p.reject; }).length; }, done:function(){ return photos.filter(function(p){ return p.reject; }).length>CO.s.r; }},
      {ch:"CHOOSE", line:function(){ return 'Now pick your best <b>'+coPickN()+'</b>'; }, sub:"Click a photo, then Pick. Click Pick again to change your mind.",
        target:'#st-select .st-loupe .brief', done:function(){ return coPicks()===coPickN(); }, bar:function(){ return coPicks()/coPickN(); }}]},
    edit:{where:coInEditor, steps:[
      {ch:"LIGHT", line:function(){ return 'These are the <b>Light</b> sliders'; }, sub:"They brighten and darken parts of the photo without wrecking the colour.",
        target:'#editor .lr-sec[data-sec="light"]', prep:function(){ coSec("light"); coShow('#editor .lr-sec[data-sec="light"]'); }, info:true},
      {ch:"LIGHT", line:function(){ return 'Drag <b>Exposure</b> to brighten or darken the whole photo'; }, sub:"Double-click any slider to put it back to zero.",
        target:coRow("pExposure"), prep:function(){ coSec("light"); }, done:function(){ return edState.exposure!==0; }},
      {ch:"LIGHT", line:function(){ return 'Pull <b>Highlights</b> down to bring back the bright parts'; }, sub:"Watch the sky and anything white get detail back.",
        target:coRow("pHighlights"), done:function(){ return edState.highlights<0; }},
      {ch:"LIGHT", line:function(){ return 'Push <b>Shadows</b> up to open up the dark parts'; }, sub:"",
        target:coRow("pShadows"), done:function(){ return edState.shadows>0; }},
      {ch:"LIGHT", line:function(){ return 'Press '+coK("\\")+' to see before and after'; }, sub:"Press it again to come back to your edit.",
        done:function(){ return CO.keys["\\"]; }},
      {ch:"LIGHT", line:function(){ return 'On to your second photo: <b>›</b>'; }, sub:"Or press →. Your edit stays on this one.",
        target:'#dvNext', start:function(){ CO.s.i=coEdIdx(); }, done:function(){ return coEdIdx()!==CO.s.i; }},
      {ch:"B&W", line:function(){ return 'Black and white by hand: drag <b>Saturation</b> all the way left'; }, sub:"No colour left, just light.",
        target:coRow("pSaturation"), prep:function(){ coSec("color"); coShow(coRow("pSaturation")); }, done:function(){ return edState.saturation<=-90; }},
      {ch:"B&W", line:function(){ return 'Push <b>Contrast</b> up to give the greys some punch'; }, sub:"Black and white lives on contrast.",
        target:coRow("pContrast"), prep:function(){ coShow(coRow("pContrast")); }, done:function(){ return edState.contrast>=20; }},
      {ch:"B&W", line:function(){ return 'Pull <b>Blacks</b> down for deep shadows'; }, sub:"And try Whites up for clean brights.",
        target:coRow("pBlacks"), done:function(){ return edState.blacks<0; }},
      {ch:"B&W", line:function(){ return 'On to your third photo: <b>›</b>'; }, sub:"",
        target:'#dvNext', start:function(){ CO.s.i=coEdIdx(); }, done:function(){ return coEdIdx()!==CO.s.i; }},
      {ch:"CROP", line:function(){ return 'Crop: <b>pick a shape</b>'; }, sub:"Square, 4:5 for a portrait feel, 16:9 for cinema.",
        target:'#editor .lr-croptools', done:function(){ return edState.aspect!=="free"; }},
      {ch:"CROP", line:function(){ return '<b>Drag the photo</b> to choose what\'s in the crop'; }, sub:"Put the stump where it looks best: try a third of the way in.",
        target:'#editCanvas', start:function(){ CO.s.cx=edState.cx; CO.s.cy=edState.cy; }, done:function(){ return Math.abs(edState.cx-CO.s.cx)+Math.abs(edState.cy-CO.s.cy)>0.02; }},
      {ch:"GRADE", line:function(){ return '<b>Color Grading</b> tints the shadows, midtones and highlights'; }, sub:"Film looks, moods, sunsets. A little goes a long way.",
        target:'#lrGrade', prep:function(){ coSec("grading"); if(typeof cgTab!=="undefined"&&cgTab!=="3"){ cgTab="3"; edpGrade(); } coShow('#lrGrade .cg-pair'); }, info:true},
      {ch:"GRADE", line:function(){ return 'Drag in the <b>Shadows</b> wheel towards blue'; }, sub:"Further from the middle is stronger.",
        target:'#lrGrade .cg-disc[data-cg="gSh"]', done:function(){ return edState.gShS>=10; }},
      {ch:"GRADE", line:function(){ return 'And the <b>Highlights</b> wheel towards orange'; }, sub:"Cool shadows, warm light: the classic film look.",
        target:'#lrGrade .cg-disc[data-cg="gHi"]', done:function(){ return edState.gHiS>=10; }},
      {ch:"GRADE", line:function(){ return '<b>Done</b> saves your edits'; }, sub:"They stay on each photo. Come back any time and the sliders are where you left them.",
        target:'#eSave', away:true, done:function(){ return !coInEditor(); }}]},
    workbook:{where:function(){ return coRoom("workshop"); }, steps:[
      {ch:"PAGE", line:function(){ return 'Your <b>workbook</b> is where you show your thinking'; }, sub:"Photos, notes and arrows on A3 pages, like the workbooks that win scholarships.",
        target:'#st-workshop .bd-sheet', info:true},
      {ch:"PAGE", line:function(){ return 'Start a page from the <b>Compare</b> template'; }, sub:"Templates give you a layout with questions already in the text boxes.",
        target:'#st-workshop [data-bd-tmpl="0"]', done:function(){ return coWs().tpl==="compare"; }},
      {ch:"PHOTOS", line:function(){ return '<b>Drag a photo</b> from the left into Photo A'; }, sub:"Or click the space, then click a photo.",
        target:'#st-workshop .bd-it.sl', done:function(){ return coWsN("photo")>=1; }},
      {ch:"PHOTOS", line:function(){ return 'And another into <b>Photo B</b>'; }, sub:"Two you'd like to compare: different angles, light or lenses.",
        target:'#st-workshop .bd-it.sl', done:function(){ return coWsN("photo")>=2; }},
      {ch:"ARROW", line:function(){ return 'Add an <b>arrow</b> from the rail'; }, sub:"Arrows tie what you write to the exact part of a photo.",
        target:'#st-workshop .bd-tools [data-bd-act="arrow"]', start:function(){ CO.s.n=coWsN("line"); }, done:function(){ return coWsN("line")>CO.s.n; }},
      {ch:"ARROW", line:function(){ return 'Drag the <b>arrow\'s tip</b> onto one thing in a photo'; }, sub:"A shadow, a line, a texture: something you could talk about.",
        target:'#st-workshop [data-bd-h="b"]', start:function(){ var a=coArrow(); CO.s.a=a?{x:a.x,y:a.y,x2:a.x2,y2:a.y2}:null; },
        done:function(){ var a=coArrow(), s=CO.s.a; return !!(a&&s&&(Math.abs(a.x2-s.x2)+Math.abs(a.y2-s.y2)+Math.abs(a.x-s.x)+Math.abs(a.y-s.y)>4)&&coInPhoto(a.x2,a.y2)); }},
      {ch:"WRITE", line:function(){ return '<b>Write a caption</b> about what your arrow points at'; }, sub:"Click the caption box and say what it is and what it does in the photo.",
        target:function(){ return coWsEl(function(it){ return it.t==="text"&&it.role==="caption"; }); }, done:function(){ return coWs().items.some(function(it){ return it.t==="text"&&String(it.text||"").trim().length>=15; }); }},
      {ch:"WRITE", line:function(){ return '<b>Save the page</b> when you\'re happy with it'; }, sub:"Your workbook keeps every page. Add more with the templates any time.",
        target:'#st-workshop [data-bd-act="save"]', start:function(){ CO.s.v=wsB.saves_(); }, done:function(){ return wsB.saves_()>CO.s.v; }}]},
    folio:{where:function(){ return coRoom("folio"); }, steps:[
      {ch:"BOARD", line:function(){ return 'Your <b>folio board</b>: three A1 panels, side by side'; }, sub:"Each panel is split into thirds, and each third packs itself edge to edge.",
        target:'#st-folio .bd-sheet', info:true},
      {ch:"BOARD", line:function(){ return 'Zoom into the <b>top third</b> of panel 1: ⤢'; }, sub:"You work on one third at a time.",
        target:'#st-folio [data-bd-zoom="0"]', done:function(){ return foB.view_()===0; }},
      {ch:"FILL", line:function(){ return '<b>Drag a photo</b> in from the left'; }, sub:"Or click one to add it.",
        target:'#st-folio .lib-grid', done:function(){ return coFoSec().length>=1; }},
      {ch:"FILL", line:function(){ return 'Fill it up: <b>5 photos</b>'; }, sub:"The same photo more than once is fine. Watch them pack to fill the space.",
        target:'#st-folio .lib-grid', done:function(){ return coFoSec().length>=5; }, bar:function(){ return coFoSec().length/5; }},
      {ch:"ARRANGE", line:function(){ return '<b>Drag one photo onto another</b> to swap them'; }, sub:"The order changes how the third fills and reads.",
        target:'#st-folio .bd-sheet .bd-it.ph', start:function(){ CO.s.o=coFoSec().map(function(it){ return it.id; }).join(); }, done:function(){ return coFoSec().map(function(it){ return it.id; }).join()!==CO.s.o; }},
      {ch:"ARRANGE", line:function(){ return 'Try <b>Rows</b>, <b>Columns</b> or <b>Hero</b>'; }, sub:"Same photos, a different arrangement.",
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
      {ch:"GALLERY", line:function(){ return 'The <b>Gallery</b> hangs your work on a real wall'; }, sub:"At eye height, at real print sizes, like a show.",
        target:'#st-gallery .ga-wall', info:true},
      {ch:"GALLERY", line:function(){ return 'Try a different <b>frame</b>'; }, sub:"",
        target:'#st-gallery .ga-frames', click:'#st-gallery [data-ga-frame]'},
      {ch:"GALLERY", line:function(){ return '<b>Drag prints</b> along the wall to hang your show'; }, sub:"Spacing and sequence tell the story.",
        target:'#st-gallery .ga-hang', info:true}]},
    library:{where:function(){ return coRoom("select"); }, steps:[
      {ch:"YOURS", line:function(){ return 'Make a <b>folder</b> for your own project: + NEW'; }, sub:"A shoot, a theme, a series. Whatever you're working on.",
        target:'#st-select [data-lib-new]', start:function(){ CO.s.p=(st.projects||[]).length; }, done:function(){ return LIB.naming==="new"||(st.projects||[]).length>CO.s.p; }},
      {ch:"YOURS", line:function(){ return '<b>Name it</b>, then press '+coK("ENTER"); }, sub:"",
        target:'#st-select .lib-in', start:function(){ CO.s.p=(st.projects||[]).length; }, done:function(){ return (st.projects||[]).length>CO.s.p||((st.projects||[]).length&&LIB.naming!=="new"&&LIB.key.indexOf("proj:")===0); }},
      {ch:"YOURS", line:function(){ return 'That folder\'s yours. <b>Go and shoot</b>'; }, sub:"Then drag your photos onto it, or drop photos in from your computer. Everything you've learnt today works on them.",
        target:function(){ var a=document.querySelectorAll('#st-select .lib-f.proj'); return a.length?a[a.length-1]:null; }, info:true}]}};
  function coSteps(){ return (CO_TOURS[CO.tour]||{steps:[]}).steps; }
  function coLen(id){ return (CO_TOURS[id]||{steps:[]}).steps.length; }
  var CO_STEPS=CO_TOURS.basics.steps;   // the guide's basics step counts these
  function coTourDone(id){ return (GD.flags.co||0)>=coLen(id); }
  function coActive(){ return CO.on&&!CO.done; }
  // the gold frames wait until the warm-up's done
  function coHidesFrames(){ return typeof gdActive==="function"&&gdActive()&&GD_STEPS[GD.step]&&GD_STEPS[GD.step].id==="basics"; }
  function coEl(){ var e=$("coCard"); if(!e){ e=document.createElement("div"); e.id="coCard"; e.className="co-card"; document.body.appendChild(e);
      var r=document.createElement("div"); r.id="coRing"; r.className="co-ring"; document.body.appendChild(r);
      e.addEventListener("click",function(ev){ if(ev.target.closest("[data-co-skip]")){ ev.stopPropagation(); coFinish(true); }
        if(ev.target.closest("[data-co-next]")){ ev.stopPropagation(); CO.s.ok=true; } }); } return e; }
  function coStart(tour){ tour=tour||"basics"; if(CO.on&&CO.tour===tour) return; if(CO.on) coStop(); CO.ticking=false;
    CO.tour=tour; CO.on=true; CO.done=false; if(GD.flags.co==null) GD.flags.co=0; CO.i=GD.flags.co; CO.look=0; CO.walked=0; CO.lx=null; CO.seen=-1; coEnter(); coLoop(); }
  function coEnter(){ var s=coSteps()[CO.i]; CO.s={}; CO.keys={}; CO.t0=performance.now(); CO.seen=-1; if(s&&s.start) s.start(); CO.html=""; }
  function coStop(){ if(CO.tgt){ CO.tgt.classList.remove("co-target"); CO.tgt=null; } CO.on=false; cancelAnimationFrame(CO.raf); var e=$("coCard"), r=$("coRing"); if(e) e.classList.remove("show","media"); if(r) r.classList.remove("show"); document.body.classList.remove("co-on","co-dial"); }
  function coFinish(skipped){ CO.done=true; GD.flags.co=coSteps().length; if(typeof gdSave==="function") gdSave(); coStop();
    if(skipped) toast(CO.tour==="basics"?"Warm-up skipped. The gold frames are out.":"Tour skipped."); }
  function coLoop(){ cancelAnimationFrame(CO.raf); CO.raf=requestAnimationFrame(coLoop); if(!CO.on) return; var T=CO_TOURS[CO.tour], e0;
    var cur=coSteps()[CO.i], here=T&&T.where()&&!GD.open;
    if(!here){ e0=$("coCard"); if(e0) e0.classList.remove("show"); e0=$("coRing"); if(e0) e0.classList.remove("show"); document.body.classList.remove("co-on","co-dial");
      if(cur&&cur.away&&!CO.ticking&&cur.done()){ CO.ticking=true; CO.i++; GD.flags.co=CO.i; CO.ticking=false; if(typeof gdSave==="function") gdSave(); if(CO.i>=coSteps().length) coFinish(false); else coEnter(); }   // a prompt that finishes by leaving (Done)
      return; }
    // what the student has done since the last frame
    if(looking&&CO.lyaw!=null){ var dy=Math.abs(yaw-CO.lyaw); if(dy<1) CO.look+=dy; } CO.lyaw=yaw;
    if(CO.lx!=null&&!(CH.pull>=0)){ var d=Math.hypot(camPos.x-CO.lx,camPos.z-CO.lz); if(d<0.5) CO.walked+=d; } CO.lx=camPos.x; CO.lz=camPos.z;
    var s=coSteps()[CO.i]; if(!s){ coFinish(false); return; }   // each prompt stays up long enough to read (dwell) before it ticks
    if(CO.seen!==CO.i){ CO.seen=CO.i; if(s.prep) s.prep(); }
    var isDone=(s.info||s.click)?CO.s.ok:s.done();
    if(!CO.ticking&&performance.now()-CO.t0>(s.info?0:(s.dwell||900))&&isDone){ coTicked(); return; }   // one tick per prompt, however late the timer runs
    coRender(s); }
  function coTicked(){ CO.ticking=true; var e=coEl(); e.classList.add("ok"); setTimeout(function(){ CO.ticking=false; e.classList.remove("ok"); CO.i++; GD.flags.co=CO.i; if(typeof gdSave==="function") gdSave();
      if(CO.i>=coSteps().length){ coFinish(false); return; } coEnter(); }, 600); }
  function coRender(s){ var e=coEl(), ring=$("coRing"), steps=coSteps();
    var chs=[], prev=null; steps.forEach(function(x,i){ if(x.ch!==prev){ chs.push({ch:x.ch, first:i}); prev=x.ch; } });
    var inCh=steps.filter(function(x){ return x.ch===s.ch; }), k=inCh.indexOf(s);
    // a nudge when the step needs something open first
    var pre="";
    if(s.need==="vf"&&!viewfinderOn&&!bg.open&&!cbOpen) pre='Raise the camera first: '+coK("P");
    else if((s.need==="bag"||s.need==="lens")&&!bg.open) pre='Open the bag again: '+coK("B");
    else if(s.need==="back"&&!cbOpen) pre='Open the camera back again: '+coK("SPACE");
    var b=s.bar?Math.max(0,Math.min(1,s.bar())):null;
    var html='<div class="co-top">'+chs.map(function(c){ var on=c.ch===s.ch, past=CO.i>c.first&&!on; return '<span class="co-ch'+(on?' on':'')+(past?' past':'')+'">'+c.ch+'</span>'; }).join('<i></i>')
      +'<button class="co-skip" data-co-skip title="Skip this tour">SKIP</button></div>'
      +(s.media&&!pre?'<canvas class="co-media" data-co-media="'+s.media+'"></canvas>':'')
      +'<div class="co-line">'+(pre||s.line())+'</div>'+((pre?'':s.sub)?'<div class="co-sub">'+s.sub+'</div>':'')
      +'<div class="co-foot"><div class="co-dots">'+inCh.map(function(_,j){ return '<i class="'+(j<k?'d':j===k?'c':'')+'"></i>'; }).join("")+'</div>'
      +(s.info?'<button class="co-next" data-co-next>GOT IT ›</button>':'')+'</div>'
      +(b!=null?'<div class="co-bar"><b style="width:'+(b*100).toFixed(0)+'%"></b></div>':'');
    if(html!==CO.html){ e.innerHTML=html; CO.html=html; }
    e.classList.add("show"); document.body.classList.add("co-on");
    e.classList.toggle("media", !!(s.media&&!pre)); document.body.classList.toggle("co-dial", !!(s.dial&&!pre&&cbOpen));
    if(s.media&&!pre) coMediaDraw(s.media, e.querySelector(".co-media"), performance.now());
    // light up the thing to click, and sit the card beside it: to its left for the side panels, else below or above
    var t=s.target&&!pre?(typeof s.target==="function"?s.target():document.querySelector(s.target)):null, r=t?t.getBoundingClientRect():null;
    if(CO.tgt!==t){ if(CO.tgt) CO.tgt.classList.remove("co-target"); CO.tgt=t; if(t) t.classList.add("co-target"); }
    if(r&&r.width>2&&r.bottom>0&&r.top<window.innerHeight){ var p=6; ring.style.left=(r.left-p)+"px"; ring.style.top=(r.top-p)+"px"; ring.style.width=(r.width+2*p)+"px"; ring.style.height=(r.height+2*p)+"px"; ring.classList.add("show");
      var W=window.innerWidth, H=window.innerHeight, cw=e.offsetWidth||440, chh=e.offsetHeight||130, x, y;
      if(r.left>W*0.55&&r.left-p-20-cw>12){ x=r.left-p-20-cw; y=Math.max(12,Math.min(H-chh-12,r.top+r.height/2-chh/2)); }
      else { var below=r.bottom+p+16+chh<H-10; x=Math.max(12,Math.min(W-cw-12,r.left+r.width/2-cw/2)); y=below?r.bottom+p+16:Math.max(12,r.top-p-16-chh); }
      if(s.place==="bottom"){ x=Math.max(12,Math.min(W-cw-12,r.left+r.width/2-cw/2)); y=Math.max(r.bottom+p+16,H-chh-64); if(y+chh>H-8) y=H-chh-8; }   // under the screen, clear of the rows
      e.style.left=x+"px"; e.style.top=y+"px"; e.style.bottom="auto"; e.style.transform="none"; e.classList.add("pinned"); }
    else { ring.classList.remove("show"); e.style.left=""; e.style.top=""; e.style.bottom=""; e.style.transform=""; e.classList.remove("pinned"); } }
  document.addEventListener("click",function(e){ if(!CO.on) return; var s=coSteps()[CO.i]; if(s&&s.click&&e.target.closest&&e.target.closest(s.click)) CO.s.ok=true; }, true);
  document.addEventListener("keydown",function(e){ if(!CO.on) return; var m={KeyW:"W",KeyA:"A",KeyS:"S",KeyD:"D",KeyQ:"Q",KeyE:"E",KeyP:"P",KeyB:"B",Space:"SPACE",Digit2:"2",Backslash:"\\",Escape:"ESC",Enter:"ENTER"}[e.code]; if(m) CO.keys[m]=true; }, true);
  if(/[?&]dev/.test(location.search)) window.__co={ state:function(){ var s=coSteps()[CO.i]; return {on:CO.on, tour:CO.tour, done:CO.done, i:CO.i, n:coSteps().length, ch:s&&s.ch, shown:!!document.querySelector("#coCard.show"), ed:edState?{i:edState.i, a:edState.aspect, cx:+edState.cx.toFixed(3), cy:+edState.cy.toFixed(3)}:null}; }, skip:function(){ coFinish(true); },
    next:function(){ CO.s.ok=true; }, clip:function(kind,cv,ms){ coMediaDraw(kind,cv,ms); }, nudge:function(o){ if(o.look) CO.look+=o.look; if(o.walk) CO.walked+=o.walk; if(o.keys) o.keys.forEach(function(k){ CO.keys[k]=true; }); } };
