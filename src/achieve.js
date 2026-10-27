  // ================= ACHIEVEMENTS: the photo is the badge =================
  // Optional things to hunt for, in the full version and the demo. Every one is earned by a real frame (or a real act),
  // and the frame that first earned it becomes its print on the wall. Tiered ones (bronze, silver, gold) earn a print
  // per tier. Secret ones stay undeveloped until found. They never gate quests or checkpoints.
  // State lives on the quest record (Q.ach), so the demo's are kept apart and reset with it.
  var ACH_CATS=[["light","Light"],["camera","Camera"],["seeing","Seeing"],["choosing","Choosing and editing"],["looking","Looking at others"],["own","Your own way"],["secret","Secret"]];
  var ACH_TIER=["","Bronze","Silver","Gold"];
  var ACH_BLUR=0.0025;   // the shake past which a frame reads as blurred (the shot tip uses the same)
  function achS(){ if(!Q.ach) Q.ach={earned:{}, showcase:[], nudge:0, ev:{bounds:0, bumps:0, culls:[]}, init:false}; var a=Q.ach; if(!a.ev) a.ev={bounds:0, bumps:0, culls:[]}; if(!a.ev.culls) a.ev.culls=[]; return a; }

  // ---- capture: what the light checks need, recorded at the shutter ----
  function achGelName(hex){ for(var i=0;i<RL_GELS.length;i++) if(RL_GELS[i][0]===hex) return RL_GELS[i][1]; return "None"; }
  function achCapture(){ try{
    var f=new THREE.Vector3(); camera.getWorldDirection(f); var hl=Math.hypot(f.x,f.z)||1, fx=f.x/hl, fz=f.z/hl, S=(typeof RL!=="undefined"&&RL.S)||1;
    var c={pos:[+camPos.x.toFixed(3),+camPos.y.toFixed(3),+camPos.z.toFixed(3)], yaw:+(Math.atan2(fx,fz)*180/Math.PI).toFixed(1), pitch:+(pitch*180/Math.PI).toFixed(1),
      low:typeof WK!=="undefined"&&WK.mode==="walk"&&WK.eye<=WK_EYE_MIN+0.03, focus:+focusDist.toFixed(3), vert:!!vertical, ms:Date.now(), still:achStill(), body:curBody().id, eq:Math.round(camEquiv()), S:S, lights:[], sunAng:null};
    if(typeof RL!=="undefined"&&RL.on){
      if(RL.sunPow>0&&RL.sunAz!=null){ var a=RL.sunAz*Math.PI/180; c.sunAng=Math.round(Math.acos(Math.max(-1,Math.min(1,fx*Math.sin(a)+fz*Math.cos(a))))*180/Math.PI); }
      var on=RL.lights.filter(function(L){ return L.on&&L.power>0; });
      if(on.length){ var T=RL.target||rlTarget(); c.subj=[+T.x.toFixed(3),+T.y.toFixed(3),+T.z.toFixed(3)];
        var cx=camPos.x-T.x, cz=camPos.z-T.z, cl=Math.hypot(cx,cz)||1;
        c.lights=on.map(function(L){ var lx=L.x-T.x, lz=L.z-T.z, ll=Math.hypot(lx,lz)||1, ang=Math.acos(Math.max(-1,Math.min(1,(cx*lx+cz*lz)/(cl*ll))))*180/Math.PI;
          return {fx:L.fx, gel:achGelName(L.gel), k:L.k, ang:Math.round(ang), h:+((L.y-T.y)/S).toFixed(2)}; }); } }
    return c; }catch(e){ return null; } }

  // ---- what the checks read ----
  function achOwn(){ return photos.filter(function(p){ return !p.research&&!p.uploaded&&!p.copy; }); }
  function achT(p){ return p.light?p.light.time||"day":"day"; }
  function achL(p){ return p.cap&&p.cap.lights?p.cap.lights:[]; }
  function achDark(p){ var t=achT(p); return t==="night"||t==="blue"; }
  function achHard(L){ return L.fx==="fresnel"||L.fx==="speed"||L.fx==="torch"; }
  function achWarm(L){ return L.gel==="Warm"||L.fx==="candle"||L.fx==="sodium"||(L.k&&L.k<=3500&&L.gel==="None"); }
  function achBold(L){ return ["Red","Green","Magenta","Blue"].indexOf(L.gel)>=0; }
  function achSec(p){ var i=SHUTTER_LABELS.indexOf(p.sh); return i>=0?SHUTTERS[i]:null; }
  function achSharp(p){ return (p.shake||0)<ACH_BLUR; }
  function achEv(p,n){ return p.ev!=null&&Math.abs(p.ev)<=n; }
  function achBriefStat(){ var o={}; BRIEFS.forEach(function(b){ o[b.t]={n:0, L:{}}; }); achOwn().forEach(function(p){ if(p.brief&&o[p.brief]){ o[p.brief].n++; if(p.lens) o[p.brief].L[p.lens]=1; } }); return o; }
  function achDevKey(d){ if(!d) return null; var o={}, k, any=false; for(k in EDEF){ if(DEV_CROP.indexOf(k)>=0||/^sec/.test(k)) continue; o[k]=d[k]; if(d[k]!==EDEF[k]&&d[k]!=null) any=true; } return any?JSON.stringify(o):null; }
  function achIn(h,a,b){ h=((h%360)+360)%360; return a<=b?h>=a&&h<=b:(h>=a||h<=b); }
  function achLast(list){ return list.length?list[list.length-1]:null; }
  function achAny(){ return achLast(achOwn()); }

  // ---- the catalogue. shot(p): earned by this frame. tier(): {lv, n, next, p}. once(): {p} when met (not tied to one shot). ----
  // near(p): a nudge when a frame just misses. hint: shown on an undeveloped secret.
  var ACH=[
    // Light
    {id:"golden-hour", cat:"light", name:"Golden Hour", how:"Take a frame at golden hour.", learn:"The hour after sunrise and before sunset. Low sun means long, warm, soft light, so photographers plan whole shoots around it.",
     shot:function(p){ return achT(p)==="golden"; }},
    {id:"into-the-sun", cat:"light", name:"Into the Sun", how:"At golden hour, point the camera within 35° of the sun.", learn:"Backlight. Shooting into a low sun turns edges gold and can flatten your subject to a silhouette, so watch the meter.",
     shot:function(p){ return achT(p)==="golden"&&p.cap&&p.cap.sunAng!=null&&p.cap.sunAng<=35; },
     near:function(p){ return achT(p)==="golden"&&p.cap&&p.cap.sunAng!=null&&p.cap.sunAng>35&&p.cap.sunAng<=55?"So close to Into the Sun: turn a little more towards the sun.":""; }},
    {id:"long-shadows", cat:"light", name:"Long Shadows", how:"At golden hour, keep the sun 60–120° off where you point.", learn:"Side light shows texture. Every bump throws a shadow, which is why landscape photographers love it.",
     shot:function(p){ var a=p.cap&&p.cap.sunAng; return achT(p)==="golden"&&a!=null&&a>=60&&a<=120; },
     near:function(p){ var a=p.cap&&p.cap.sunAng; return achT(p)==="golden"&&a!=null&&((a>=45&&a<60)||(a>120&&a<=135))?"Almost Long Shadows: put the sun more to your side.":""; }},
    {id:"blue-hour", cat:"light", name:"Blue Hour", how:"At blue hour with no lights of your own: 1/15 or slower, within a stop, and sharp.", learn:"The short blue glow after sunset. It needs slow shutters, so photographers brace themselves or use a tripod.",
     shot:function(p){ var s=achSec(p); return achT(p)==="blue"&&!achL(p).length&&s!=null&&s>=1/15-1e-6&&achEv(p,1)&&achSharp(p); },
     near:function(p){ var s=achSec(p); return achT(p)==="blue"&&!achL(p).length&&s!=null&&s>=1/15-1e-6&&achEv(p,1)&&!achSharp(p)?"So close to Blue Hour: brace and try again, or go a touch faster.":""; }},
    {id:"night-owl", cat:"light", name:"Night Owl", how:"Frames at night.", tiers:[5,25,75], learn:"Night photography is about controlling tiny amounts of light.",
     tier:function(){ return achCount(achOwn().filter(function(p){ return achT(p)==="night"; }), [5,25,75]); }},
    {id:"rembrandt", cat:"light", name:"Rembrandt", how:"After dark, one hard light only, 30–60° round from the camera and 0.4 m or more above your subject.", learn:"Named after the painter, who lit faces from high and to one side. Look for the small triangle of light on the shadow side.",
     shot:function(p){ var L=achL(p); return achDark(p)&&L.length===1&&achHard(L[0])&&L[0].ang>=30&&L[0].ang<=60&&L[0].h>=0.4; },
     near:function(p){ var L=achL(p); if(!achDark(p)||L.length!==1||!achHard(L[0])) return ""; var a=L[0].ang;
       if(a>=30&&a<=60&&L[0].h<0.4&&L[0].h>=0) return "So close to Rembrandt: raise the light higher.";
       if(a>=18&&a<30) return "So close to Rembrandt: bring the light further round."; if(a>60&&a<=75) return "So close to Rembrandt: bring the light back towards the camera."; return ""; }},
    {id:"split", cat:"light", name:"Split", how:"After dark, exactly one light, square to the side (75–105°).", learn:"Half lit, half in shadow. Split light is dramatic and a little mysterious, a favourite of film noir.",
     shot:function(p){ var L=achL(p); return achDark(p)&&L.length===1&&L[0].ang>=75&&L[0].ang<=105; },
     near:function(p){ var L=achL(p); return achDark(p)&&L.length===1&&((L[0].ang>=62&&L[0].ang<75)||(L[0].ang>105&&L[0].ang<=118))?"Almost Split: put the light square to the side.":""; }},
    {id:"halo", cat:"light", name:"Halo", how:"Any light 150° or more round, behind your subject.", learn:"Rim light traces the edge of a subject and lifts it off a dark background.",
     shot:function(p){ return achL(p).some(function(L){ return L.ang>=150; }); },
     near:function(p){ var L=achL(p); return !L.some(function(x){ return x.ang>=150; })&&L.some(function(x){ return x.ang>=128; })?"Almost a Halo: the light needs to be more behind.":""; }},
    {id:"moonlight", cat:"light", name:"Moonlight", how:"At night, every light gelled blue, one at least 1.5 m above your subject.", learn:"Film crews fake moonlight with blue light from above. Your eye reads cool and high as night.",
     shot:function(p){ var L=achL(p); return achT(p)==="night"&&L.length&&L.every(function(x){ return x.gel==="Blue"; })&&L.some(function(x){ return x.h>=1.5; }); },
     near:function(p){ var L=achL(p); return achT(p)==="night"&&L.length&&L.every(function(x){ return x.gel==="Blue"; })&&!L.some(function(x){ return x.h>=1.5; })&&L.some(function(x){ return x.h>=0.9; })?"So close to Moonlight: lift a blue light higher.":""; }},
    {id:"campfire", cat:"light", name:"Campfire", how:"At night, a warm light at or below your subject's height.", learn:"Light from below feels intimate or eerie, because we're used to light from above.",
     shot:function(p){ return achT(p)==="night"&&achL(p).some(function(L){ return achWarm(L)&&L.h<=0; }); }},
    {id:"two-tone", cat:"light", name:"Two-Tone", how:"A warm light and a blue-gelled light, both on.", learn:"Warm against cool is one of the strongest colour contrasts there is. Cinematographers use it constantly.",
     shot:function(p){ var L=achL(p); return L.some(achWarm)&&L.some(function(x){ return x.gel==="Blue"; }); }},
    {id:"neon-noir", cat:"light", name:"Neon Noir", how:"After dark, two different bold gels on.", learn:"Coloured gels on hard lights are the look of music videos and neon-lit city films.",
     shot:function(p){ var g={}; achL(p).forEach(function(L){ if(achBold(L)) g[L.gel]=1; }); return achDark(p)&&Object.keys(g).length>=2; }},
    {id:"streetlight", cat:"light", name:"Under the Streetlight", how:"At night, only streetlights on.", learn:"Sodium streetlights glow one orange colour, which is why old night photos of cities look orange.",
     shot:function(p){ var L=achL(p); return achT(p)==="night"&&L.length&&L.every(function(x){ return x.fx==="sodium"; }); }},
    {id:"candlelight", cat:"light", name:"Lamplight", how:"Only bare bulbs on, at 2700 K or warmer, exposed within a stop.", learn:"A warm household bulb is dim and orange, so you open up, slow down and raise the ISO all at once. Every setting is a trade.",
     shot:function(p){ var L=achL(p); return L.length&&L.every(function(x){ return x.fx==="candle"||(x.fx==="bare"&&x.k&&x.k<=2700); })&&achEv(p,1); }},   /* id kept so earlier progress stays */
    {id:"flash-freeze", cat:"light", name:"Flash Freeze", how:"At night, a speedlight on, at 1/250 or faster.", learn:"A flash lasts about a thousandth of a second, so it freezes motion even in the dark.",
     shot:function(p){ var s=achSec(p); return achT(p)==="night"&&achL(p).some(function(L){ return L.fx==="speed"; })&&s!=null&&s<=1/250+1e-6; }},
    {id:"director", cat:"light", name:"Lighting Director", how:"Lights on in one frame.", tiers:[2,4,6], learn:"Most professional lighting starts with two: a key light and a fill.",
     tier:function(){ var best=null, n=0; achOwn().forEach(function(p){ var k=achL(p).length; if(k>n){ n=k; best=p; } }); return achLv(n,[2,4,6],function(t){ return achOwn().filter(function(p){ return achL(p).length>=t; })[0]; }); }},
    {id:"four-skies", cat:"light", name:"One Spot, Four Skies", frame:"gold", how:"Four frames from one spot (within 0.5 m and 15°): day, golden hour, blue hour and night.", learn:"Light is the subject. Monet painted the same haystacks again and again for the same reason.",
     once:function(){ var P=achOwn().filter(function(p){ return p.cap; }), T=["day","golden","blue","night"];
       for(var i=0;i<P.length;i++){ var a=P[i], hit={}; hit[achT(a)]=a;
         P.forEach(function(b){ var t=achT(b); if(hit[t]) return; var d=Math.hypot(a.cap.pos[0]-b.cap.pos[0],a.cap.pos[2]-b.cap.pos[2])/(a.cap.S||1), dy=Math.abs(((a.cap.yaw-b.cap.yaw+540)%360)-180); if(d<=0.5&&dy<=15) hit[t]=b; });
         if(T.every(function(t){ return hit[t]; })) return {p:T.map(function(t){ return hit[t]; }).sort(function(x,y){ return x.cap.ms-y.cap.ms; })[3]}; } return null; }},
    // Camera
    {id:"lens-collector", cat:"camera", name:"Lens Collector", how:"Use different lenses: 2, then all four 35 mm lenses, then every lens.", tiers:[2,4,7], learn:"Every lens sees differently. Wide pushes things apart, long pulls them together.",
     tier:function(){ var seen={}, firsts=[]; achOwn().forEach(function(p){ if(p.lens&&!seen[p.lens]){ seen[p.lens]=1; firsts.push(p); } });
       var all=[].concat(LENS_KITS["35"],LENS_KITS["67"]).map(function(l){ return l.id; }), f35=LENS_KITS["35"].map(function(l){ return l.id; }), n=Object.keys(seen).length;
       var lv=n>=2?1:0; if(lv&&f35.every(function(k){ return seen[k]; })) lv=2; if(lv===2&&all.every(function(k){ return seen[k]; })) lv=3;
       return {lv:lv, n:n, next:[2,4,7][Math.min(lv,2)], p:achLast(firsts)}; }},
    {id:"body-double", cat:"camera", name:"Body Double", how:"A frame on every camera body in your bag.", learn:"A camera changes how you shoot. Film makes you careful, a small mirrorless makes you quick.",
     once:function(){ var need=BAG_BODIES.filter(function(b){ return b.id; }).map(function(b){ return b.id; }), seen={}, last=null; achOwn().forEach(function(p){ var id=p.cap&&p.cap.body; if(id&&!seen[id]){ seen[id]=1; last=p; } });
       return need.every(function(k){ return seen[k]; })?{p:last}:null; }},
    {id:"no-regrets", cat:"camera", name:"Ten Frames, No Regrets", how:"Ten frames in a row on the 6×7, each within a third of a stop.", learn:"Film photographers metered every frame because every frame cost money. It makes you slow down and look.",
     once:function(){ var run=0, P=achOwn().filter(function(p){ return p.cap&&p.cap.body==="67"; }); for(var i=0;i<P.length;i++){ run=achEv(P[i],0.34)?run+1:0; if(run>=10) return {p:P[i]}; } return null; }},
    {id:"whisper", cat:"camera", name:"Whisper", how:"The 85 mm wide open at f/1.4, focused as close as it goes.", learn:"The closer you focus, the thinner the slice that's sharp. At f/1.4 up close it can be millimetres.",
     shot:function(p){ return p.lens==="85"&&p.f<=1.4&&p.cap&&p.cap.focus<=0.1; },
     near:function(p){ return p.lens==="85"&&p.f<=1.4&&p.cap&&p.cap.focus>0.1&&p.cap.focus<=0.22?"So close to Whisper: focus even closer.":""; }},
    {id:"front-to-back", cat:"camera", name:"Front to Back", how:"f/16 on a lens as wide as 28 mm or wider.", learn:"Landscape photographers like Ansel Adams stopped right down so the rock at their feet and the mountain behind were both sharp.",
     shot:function(p){ return p.f>=16&&p.cap&&p.cap.eq<=28; }},
    {id:"steady-hands", cat:"camera", name:"Steady Hands", how:"1/8 or slower, and still sharp.", learn:"The old rule: your slowest safe shutter is about one over your focal length. Brace and breathe out.",
     shot:function(p){ var s=achSec(p); return s!=null&&s>=1/8-1e-6&&achSharp(p); }},
    {id:"long-reach", cat:"camera", name:"Long Reach", how:"The 135 mm on the APS-C mirrorless.", learn:"The crop sensor turns a 135 mm into about 216 mm. Long lenses compress distance, stacking near and far together.",
     shot:function(p){ return p.lens==="135"&&p.cap&&p.cap.body==="ml"; }},
    {id:"grain", cat:"camera", name:"Grain", how:"ISO 6400, exposed spot on.", learn:"Grain isn't always a mistake. Daido Moriyama made rough, grainy black and white his signature.",
     shot:function(p){ return p.iso===6400&&achEv(p,0.5); }},
    // Seeing
    {id:"worms-eye", cat:"seeing", name:"Worm's Eye", how:"Crouch as low as you go and tilt up 35° or more.", learn:"Low angles make things loom. Alexander Rodchenko shot up at buildings to make them feel new.",
     shot:function(p){ return p.cap&&p.cap.low&&p.cap.pitch>=35; },
     near:function(p){ return p.cap&&p.cap.pitch>=35&&!p.cap.low?"So close to Worm's Eye: crouch right down (Q) and shoot up.":p.cap&&p.cap.low&&p.cap.pitch>=20&&p.cap.pitch<35?"Almost Worm's Eye: tilt further up.":""; }},
    {id:"birds-eye", cat:"seeing", name:"Bird's Eye", how:"Point 70° or more straight down.", learn:"Looking straight down flattens the world into pattern and shape.",
     shot:function(p){ return p.cap&&p.cap.pitch<=-70; }},
    {id:"full-house", cat:"seeing", name:"Full House", how:"Every composition brief: once each, then 3 frames each, then each on 3 different lenses.", tiers:[1,3,3], learn:"Composition rules are starting points. Learn them, then break them on purpose.",
     tier:function(){ var o=achBriefStat(), k=Object.keys(o), lv=0; if(k.every(function(b){ return o[b].n>=1; })) lv=1; if(lv&&k.every(function(b){ return o[b].n>=3; })) lv=2; if(lv===2&&k.every(function(b){ return Object.keys(o[b].L).length>=3; })) lv=3;
       var done=k.filter(function(b){ return lv>=2?Object.keys(o[b].L).length>=3:lv>=1?o[b].n>=3:o[b].n>=1; }).length;
       return {lv:lv, n:done, next:k.length, p:achLast(achOwn().filter(function(p){ return p.brief; }))}; }},
    {id:"sideways", cat:"seeing", name:"Sideways", how:"Ten vertical frames.", learn:"Tall things and people often want a vertical frame, and a folio panel needs both.",
     once:function(){ var V=achOwn().filter(function(p){ return p.cap&&p.cap.vert; }); return V.length>=10?{p:V[9]}:null; }, prog:function(){ return [achOwn().filter(function(p){ return p.cap&&p.cap.vert; }).length,10]; }},
    // Choosing and editing
    {id:"ruthless", cat:"choosing", name:"Ruthless", how:"Frames rejected.", tiers:[10,50,150], learn:"Most photographers keep a tiny fraction of what they shoot. Choosing is half the job.",
     tier:function(){ return achCount(achOwn().filter(function(p){ return p.reject; }), qDemo()?[5,50,150]:[10,50,150]); }},   /* the demo is short, so bronze comes sooner */
    {id:"one-in-ten", cat:"choosing", name:"One in Ten", how:"At one place, 50 or more frames and only 1 to 5 picks.", learn:"Contact sheets from the greats are mostly misses. The skill is knowing the one.",
     once:function(){ var by={}; achOwn().forEach(function(p){ var k=p.place||"?"; (by[k]=by[k]||[]).push(p); });
       for(var k in by){ var pk=by[k].filter(function(p){ return p.pick; }); if(by[k].length>=50&&pk.length>=1&&pk.length<=5) return {p:pk[0]}; } return null; }},
    {id:"film-look", cat:"choosing", name:"Film Look", how:"Grade the shadows towards blue and the highlights towards orange.", learn:"Teal and orange is everywhere in film because skin and sky sit on opposite sides of the colour wheel.",
     once:function(){ var p=photos.filter(function(q){ var d=q.dev; return d&&d.secGrade!==0&&achIn(d.gShH||0,170,260)&&(d.gShS||0)>=12&&achIn(d.gHiH||0,15,60)&&(d.gHiS||0)>=12; })[0]; return p?{p:p}:null; }},
    {id:"monochrome", cat:"choosing", name:"Monochrome", how:"Five photos edited to black and white.", learn:"Without colour, light, shape and texture have to carry the photograph.",
     once:function(){ var M=photos.filter(function(q){ return q.dev&&(q.dev.mono>0||/mono|bw/i.test(q.dev.profile||"")); }); return M.length>=5?{p:M[4]}:null; },
     prog:function(){ return [photos.filter(function(q){ return q.dev&&(q.dev.mono>0||/mono|bw/i.test(q.dev.profile||"")); }).length,5]; }},
    {id:"family-likeness", cat:"choosing", name:"Family Likeness", how:"One look pasted or synced onto six photos.", learn:"A series should feel like it belongs together, and consistent editing is a big part of that.",
     once:function(){ var by={}; photos.forEach(function(q){ var k=achDevKey(q.dev); if(k) (by[k]=by[k]||[]).push(q); }); for(var k in by) if(by[k].length>=6) return {p:by[k][5]}; return null; }},
    {id:"published", cat:"choosing", name:"Published", how:"Export your book as a PDF.", learn:"Photographers have made books for over a century. Sequence turns photos into a story.",
     once:function(){ return Q.flags.bookPdf?{p:achLast(qPicks())||achAny()}:null; }},
    {id:"opening-night", cat:"choosing", name:"Opening Night", how:"A gallery show with 12 or more prints and a title.", learn:"Hanging a show is editing in space: what goes next to what, and what gets left out.",
     once:function(){ var P=typeof gaPrints==="function"?gaPrints():[]; return P.length>=12&&String(ga.title||"").trim()?{p:photos[P[0]]}:null; }},
    // Looking at others
    {id:"gut-instinct", cat:"looking", name:"Gut Instinct", how:"Finish a Culling Game in under 90 seconds.", learn:"Your first reaction is information. The next step is asking why.",
     once:function(){ return achS().ev.culls.some(function(c){ return c.s<90; })?{p:achAny()}:null; }},
    {id:"great-minds", cat:"looking", name:"Great Minds", sync:true, how:"Your #1 in a Culling Game is the class's #1 too.", learn:"Sometimes a photograph just works on everyone. Work out what it's doing.",
     once:function(){ return achS().ev.culls.some(function(c){ return c.same; })?{p:achAny()}:null; }},
    {id:"contrarian", cat:"looking", name:"Contrarian", sync:true, how:"Your #1 is the photograph the class ranked lowest (5 or more plays).", learn:"Taste is personal. Saying why you love what nobody else chose is a real skill.",
     once:function(){ return achS().ev.culls.some(function(c){ return c.contra; })?{p:achAny()}:null; }},
    {id:"every-pack", cat:"looking", name:"Every Pack", how:"Play every research pack there is.", learn:"The more photographs you've looked at, the more you have to draw on.",
     once:function(){ var P=(typeof rs!=="undefined"&&rs.packs||[]).filter(function(p){ return !p.sample; }); if(P.length<2) return null;
       var played=function(id){ return (Q.rs.cull&&Q.rs.cull[id])||(Q.rs.punctum&&Q.rs.punctum[id]); }; return P.every(function(p){ return played(p.id); })?{p:achAny()}:null; }},
    // Your own way
    {id:"noticer", cat:"own", name:"Noticer", how:"Picks with a why note of 20 or more characters.", tiers:[5,25,50], learn:"Writing down why a photo works is how you find out what you actually care about.",
     tier:function(){ return achCount(qPicks().filter(function(p){ return String(p.note||"").trim().length>=20; }), [5,25,50]); }},
    {id:"return-visit", cat:"own", name:"Return Visit", how:"Frames at the same place on three different days.", learn:"Photographers return to the same places for years. Each visit you see something new.",
     once:function(){ var by={}; achOwn().forEach(function(p){ var d=new Date(p.t), k=(p.place||"?"), day=d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate(); by[k]=by[k]||{}; if(!by[k][day]) by[k][day]=p; });
       for(var k in by){ var D=Object.keys(by[k]); if(D.length>=3) return {p:by[k][D[2]]}; } return null; }},
    {id:"own-project", cat:"own", name:"Your Own Project", how:"A project folder of your own with 20 or more frames.", learn:"A project is a question you keep asking with a camera.",
     once:function(){ var pr=((typeof st!=="undefined"&&st.projects)||[]).filter(function(x){ return (x.ids||[]).length>=20; })[0]; if(!pr) return null; var i=stById(pr.ids[0]); return {p:photos[i]||achAny()}; }},
    // Secret
    {id:"off-the-map", cat:"secret", hidden:true, name:"Off the Map", hint:"There's an edge to every world", how:"Walk to the edge of the scan.", learn:"A scan only holds what the camera saw. Everything past here was never captured.",
     once:function(){ return achS().ev.bounds>0?{p:achAny()}:null; }},
    {id:"lens-cap", cat:"secret", hidden:true, name:"Lens Cap", hint:"Some photographs are better unseen", how:"Four stops under.", learn:"Four stops under is 1/16 of the light the meter wanted.",
     shot:function(p){ return p.ev!=null&&p.ev<=-4; }},
    {id:"burnt", cat:"secret", hidden:true, name:"Burnt", hint:"Too much of a good thing", how:"Four stops over.", learn:"Blown highlights hold no detail at all. Editing can't bring back what was never recorded.",
     shot:function(p){ return p.ev!=null&&p.ev>=4; }},
    {id:"jelly-hands", cat:"secret", hidden:true, name:"Jelly Hands", hint:"Hold still. Or don't.", how:"A frame with four times the blur that reads as shake.", learn:"Some photographers use camera movement on purpose, painting with blur.",
     shot:function(p){ return (p.shake||0)>=ACH_BLUR*4; }},
    {id:"decisive-moment", cat:"secret", hidden:true, name:"The Decisive Moment", hint:"The best photographers wait", how:"Hold the viewfinder up and still for a minute, then shoot.", learn:"Henri Cartier-Bresson waited for the instant everything in the frame lined up. He called it the decisive moment.",
     shot:function(p){ return p.cap&&p.cap.still>=60; }},
    {id:"blink", cat:"secret", hidden:true, name:"Blink", hint:"Spray and pray", how:"Five frames inside two seconds.", learn:"Bursts help with fast action, but timing still beats volume.",
     shot:function(p){ var P=achOwn(), n=P.length; if(n<5) return false; return +new Date(P[n-1].t)-(+new Date(P[n-5].t))<=2000; }},
    {id:"tree-hugger", cat:"secret", hidden:true, name:"Tree Hugger", hint:"Some things won't move for you", how:"Walk into the scenery ten times.", learn:"Sometimes the shot you want isn't possible from where you can stand. Change lens instead.",
     once:function(){ return achS().ev.bumps>=10?{p:achAny()}:null; }}
  ];
  var ACH_BY={}; ACH.forEach(function(a){ ACH_BY[a.id]=a; });
  function achCount(list, th){ return achLv(list.length, th, function(t){ return list[t-1]; }); }
  function achLv(n, th, pick){ var lv=0; th.forEach(function(t,i){ if(n>=t) lv=i+1; }); return {lv:lv, n:n, next:th[Math.min(lv,th.length-1)], p:lv?pick(th[lv-1]):null}; }

  // ---- earning ----
  var ACHU={queue:[], card:null, full:false, t:0, wall:false, still:0, lastPose:null, rare:null, rareT:0};
  function achHas(key){ return !!achS().earned[key]; }
  function achPid(p){ if(!p) return null; var i=photos.indexOf(p); return i>=0?stId(i):null; }
  function achEarn(a, lv, p, quiet){ var key=a.id+(lv?":"+lv:""); if(achHas(key)) return false;
    achS().earned[key]={t:Date.now(), pid:achPid(p)}; if(!quiet) ACHU.queue.push({id:a.id, lv:lv}); return true; }
  function achLevel(id){ var a=ACH_BY[id]; if(!a) return 0; if(!a.tiers&&!a.tier) return achHas(id)?1:0; for(var lv=3;lv>=1;lv--) if(achHas(id+":"+lv)) return lv; return 0; }
  function achKeyOf(id){ var lv=achLevel(id); var a=ACH_BY[id]; return a.tier?id+":"+lv:id; }
  // a new frame: the shot checks against this frame, then everything else
  function achShot(p, quiet){ if(!p||p.research||p.uploaded) return; var nudge="";
    ACH.forEach(function(a){ if(!a.shot) return; var hit=false; try{ hit=a.shot(p); }catch(e){} if(hit) achEarn(a,0,p,quiet); else if(a.near&&!achHas(a.id)&&!nudge){ try{ nudge=a.near(p)||""; }catch(e){} } });
    achSweep(quiet);
    var s=achS(); if(nudge&&!quiet&&Date.now()-(s.nudge||0)>60000){ s.nudge=Date.now(); setTimeout(function(){ toast(nudge); }, 900); }
    qSave(); }
  function achSweep(quiet){ var any=false; ACH.forEach(function(a){ try{
      if(a.tier){ var r=a.tier(); for(var lv=1;lv<=r.lv;lv++) if(!achHas(a.id+":"+lv)){ var th=a.tiers&&a.tiers[lv-1]; any=achEarn(a,lv,lv===r.lv?r.p:r.p,quiet)||any; } }
      else if(a.once&&!achHas(a.id)){ var o=a.once(); if(o) any=achEarn(a,0,o.p||achAny(),quiet)||any; } }catch(e){} }); return any; }
  /* frames from before achievements existed: credit them quietly once, no cards */
  function achInit(){ var s=achS(); if(s.init) return; s.init=true; achOwn().forEach(function(p){ ACH.forEach(function(a){ if(a.shot){ try{ if(a.shot(p)) achEarn(a,0,p,true); }catch(e){} } }); }); achSweep(true); qSave(); }
  function achEvent(k, v){ var s=achS();
    if(k==="bounds") s.ev.bounds++;
    else if(k==="bump") s.ev.bumps++;
    else if(k==="cull") s.ev.culls.push(v);
    if(achSweep(false)) qSave(); }
  function achCountAll(){ return ACH.filter(function(a){ return achLevel(a.id)>0; }).length; }
  function achSound(){ if(typeof soundOn!=="undefined"&&!soundOn) return; try{ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); var c=audioCtx, t=c.currentTime;
      [659.25,987.77].forEach(function(f,i){ var o=c.createOscillator(), g=c.createGain(); o.type="sine"; o.frequency.value=f; g.gain.setValueAtTime(0,t+i*0.09); g.gain.linearRampToValueAtTime(0.06,t+i*0.09+0.02); g.gain.exponentialRampToValueAtTime(0.0008,t+i*0.09+0.9); o.connect(g); g.connect(c.destination); o.start(t+i*0.09); o.stop(t+i*0.09+1); }); }catch(e){} }

  // ---- the unlock card: small while the viewfinder's up, the full print when it's down or clicked ----
  function achPrintUrl(key){ var e=achS().earned[key]; if(!e) return null; var i=stById(e.pid); return i>=0?photos[i].url:null; }
  function achTierCls(a, lv){ return a.frame?a.frame:lv?["","bronze","silver","gold"][lv]:"plain"; }
  function achRare(id){ return ACHU.rare&&ACHU.rare[id]!=null?ACHU.rare[id]:null; }
  function achFullHtml(id, lv, fresh){ var a=ACH_BY[id], key=a.tier?id+":"+lv:id, url=achPrintUrl(key), rare=achRare(id), sh=achS().showcase.indexOf(id)>=0;
    return '<div class="ach-full'+(fresh?' fresh':'')+'"><div class="ach-print '+achTierCls(a,lv)+'"><div class="pp">'+(url?'<img src="'+url+'" alt="">':'<span class="nophoto">'+qEsc(a.name)+'</span>')+'<i class="dev"></i></div></div>'
      +'<div class="ach-tx"><span class="k">ACHIEVEMENT'+(lv?' · '+ACH_TIER[lv].toUpperCase():'')+(a.frame==="gold"?' · GOLD':'')+'</span><b class="t">'+qEsc(a.name)+'</b><p>'+qEsc(a.learn)+'</p>'
      +(rare!=null?'<span class="ach-rare">'+rare+'% of your class has this</span>':'')
      +'<div class="ach-acts"><button class="gd-skip" data-ach="show" data-ach-id="'+id+'">'+(sh?'On your profile ✓':'Show on my profile')+'</button><button class="gd-skip" data-ach="pin" data-ach-id="'+id+'" data-ach-lv="'+lv+'"'+(url?'':' disabled')+'>Pin to workbook</button><button class="gd-go" data-ach="close">NICE ›</button></div></div></div>'; }
  /* the unlock: one big flash, centred, that develops in and leaves by itself about two and a half seconds later. Nothing to click,
     the camera stays up, the pointer stays locked. The wall (quest board › Achievements) has the full card with its buttons. */
  var ACH_FLASH_MS=2600;
  function achFlashHtml(id, lv){ var a=ACH_BY[id], key=a.tier?id+":"+lv:id, url=achPrintUrl(key);
    return '<div class="ach-flash"><i class="ach-ring"></i><div class="ach-print '+achTierCls(a,lv)+'"><div class="pp">'+(url?'<img src="'+url+'" alt="">':'<span class="nophoto">'+qEsc(a.name)+'</span>')+'<i class="dev"></i></div></div>'
      +'<div class="ach-tx"><span class="k">ACHIEVEMENT'+(lv?' · '+ACH_TIER[lv].toUpperCase():'')+(a.frame==="gold"?' · GOLD':'')+'</span><b class="t">'+qEsc(a.name)+'</b><p>'+qEsc(a.learn)+'</p></div></div>'; }
  function achCardTick(){ var el=gdEl("achCard","ach-card");
    if(!ACHU.card&&ACHU.queue.length&&!QU.done&&!(typeof coActive==="function"&&coActive())){ ACHU.card=ACHU.queue.shift(); ACHU.full=false; ACHU.t=Date.now(); achSound();
      el.innerHTML=achFlashHtml(ACHU.card.id, ACHU.card.lv); el.className="ach-card show big flash"; }
    if(!ACHU.card){ el.classList.remove("show"); return; }
    if(!ACHU.card.wall&&Date.now()-ACHU.t>ACH_FLASH_MS) achNext();
    if(ACHU.full&&ACHU.card.wall&&!ACHU.hover&&Date.now()-ACHU.fullT>12000) achNext(); }
  function achOpenFull(){ var el=$("achCard"); if(!ACHU.card||!el) return; ACHU.full=true; el.innerHTML=achFullHtml(ACHU.card.id, ACHU.card.lv, true); el.className="ach-card show big"; ACHU.fullT=Date.now(); }
  (function(){ var el=gdEl("achCard","ach-card"); el.addEventListener("mouseenter",function(){ ACHU.hover=true; }); el.addEventListener("mouseleave",function(){ ACHU.hover=false; ACHU.fullT=Date.now()-5000; }); })();
  window.addEventListener("keydown",function(e){ if(e.code==="Escape"&&ACHU.card){ e.preventDefault(); e.stopImmediatePropagation(); achNext(); } },true);
  function achNext(){ ACHU.card=null; ACHU.full=false; ACHU.hover=false; var el=$("achCard"); if(el){ el.classList.remove("show"); setTimeout(function(){ if(!ACHU.card){ el.classList.remove("big","flash"); el.innerHTML=""; } },500); } }
  // the wall's own view of one print
  function achShowOne(id){ var lv=achLevel(id); if(!lv) return; var el=gdEl("achCard","ach-card"); ACHU.card={id:id, lv:ACH_BY[id].tier?lv:0, wall:true}; ACHU.full=true; el.innerHTML=achFullHtml(id, ACHU.card.lv, false); el.className="ach-card show big"; }

  // ---- pin to workbook: an Annotate page with the print, the name as its title and the learn line to start from ----
  function achPin(id, lv){ var a=ACH_BY[id], key=a.tier?id+":"+lv:id, e=achS().earned[key], i=e?stById(e.pid):-1; if(i<0){ toast("That print isn't in your photos any more."); return; }
    if(typeof wsEnsure==="function") wsEnsure(); if(!st.wsBoard){ st.wsBoard=wsB.doc_(); }
    var T=WS_TEMPLATES.filter(function(t){ return t.id==="annotate"; })[0], r=T.build(), firstText=true, pid=stId(i);
    var items=r.items.map(function(it){ var c=JSON.parse(JSON.stringify(it));
      if(c.t==="slot"){ var box={x:c.x,y:c.y,w:c.w,h:c.h}, f=bdFit(box, stAspect(i)||1.5); return {t:"photo", pid:pid, x:f.x, y:box.y, w:f.w, box:box}; }
      if(c.t==="text"&&c.role==="title") c.text=a.name+(lv?" · "+ACH_TIER[lv]:"");
      else if(c.t==="text"&&c.role==="text"&&firstText){ c.text=a.learn; firstText=false; } return c; });
    wsB.applyTemplate({id:"annotate", name:"Annotate", build:function(){ return {bg:"white", items:items}; }}); st.wsBoard=wsB.doc_(); saveSession(); toast("Pinned to your workbook: "+a.name); }

  // ---- the wall: a tab in the quest log ----
  function achWallHtml(){ var n=achCountAll();
    var h='<div class="ach-wall"><div class="ach-wh"><b>'+n+' / '+ACH.length+'</b><span>Every print here is one of your own frames. Blank paper says how to earn it.</span></div>';
    ACH_CATS.forEach(function(c){ var L=ACH.filter(function(a){ return a.cat===c[0]; }), got=L.filter(function(a){ return achLevel(a.id); }).length;
      h+='<div class="ach-cat"><span class="q-sh">'+c[1].toUpperCase()+' · '+got+' / '+L.length+'</span><div class="ach-grid">'+L.map(function(a){ var lv=achLevel(a.id), key=a.tier?a.id+":"+lv:a.id, url=lv?achPrintUrl(key):null, cls=lv?achTierCls(a,a.tier?lv:0):"blank";
        var r=null; if(a.tier){ try{ r=a.tier(); }catch(e){} } var pr=a.prog?a.prog():null;
        var sub=a.hidden&&!lv?qEsc(a.hint):lv?(a.tier?ACH_TIER[lv]:"")+(achRare(a.id)!=null?(a.tier?' · ':'')+achRare(a.id)+'%':''):qEsc(a.how);
        var bar=a.tier&&r&&r.lv<3?'<span class="ach-bar"><i style="width:'+Math.min(100,Math.round(100*r.n/Math.max(1,r.next)))+'%"></i><em>'+r.n+' / '+r.next+'</em></span>':pr&&!lv?'<span class="ach-bar"><i style="width:'+Math.min(100,Math.round(100*pr[0]/pr[1]))+'%"></i><em>'+Math.min(pr[0],pr[1])+' / '+pr[1]+'</em></span>':'';
        return '<button class="ach-tile '+(lv?'got':'')+(a.hidden&&!lv?' secret':'')+'" '+(lv?'data-ach="one" data-ach-id="'+a.id+'"':'')+' title="'+qEsc(a.hidden&&!lv?a.hint:a.how)+'"><span class="ach-print '+cls+'"><span class="pp">'+(url?'<img src="'+url+'" alt="" loading="lazy">':'')+'</span></span>'
          +'<b>'+qEsc(a.hidden&&!lv?"Undeveloped":a.name)+'</b><small>'+sub+'</small>'+bar+'</button>'; }).join("")+'</div></div>'; });
    return h+'</div>'; }
  // the demo's finish card: what they found, and how many are left
  function achFinishLine(){ var got=ACH.filter(function(a){ return achLevel(a.id); }); if(!got.length) return '<p class="q-achline">'+ACH.length+' achievements to find. Try the log next time.</p>';
    return '<p class="q-achline">You found <b>'+got.map(function(a){ return qEsc(a.name); }).join(", ")+'</b>. '+(ACH.length-got.length)+' more to find.</p>'; }

  // ---- clicks ----
  document.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("[data-ach]"); if(!b) return; e.stopPropagation(); var a=b.getAttribute("data-ach"), id=b.getAttribute("data-ach-id");
    if(a==="open") return achOpenFull();
    if(a==="close"){ var w=ACHU.card&&ACHU.card.wall; achNext(); if(w&&QU.log) qLogOpen(); return; }
    if(a==="one") return achShowOne(id);
    if(a==="pin") return achPin(id, +b.getAttribute("data-ach-lv")||0);
    if(a==="show"){ var s=achS(), k=s.showcase.indexOf(id); if(k>=0) s.showcase.splice(k,1); else { if(s.showcase.length>=3){ toast("Your profile shows three. Take one off first."); return; } s.showcase.push(id); } qSave();
      b.textContent=s.showcase.indexOf(id)>=0?"On your profile ✓":"Show on my profile"; return; } },true);

  // ---- the loop: the slow checks, the card, the still-camera clock, and class rarity when synced ----
  setInterval(function(){ if(!qMode()) return; achInit(); if(achSweep(false)) qSave(); }, 2500);
  setInterval(function(){ if(!qMode()){ var el=$("achCard"); if(el) el.classList.remove("show"); return; } achCardTick();
    var vf=typeof viewfinderOn!=="undefined"&&viewfinderOn, pose=[camPos.x,camPos.y,camPos.z,yaw,pitch];
    if(vf&&ACHU.lastPose){ var d=Math.hypot(pose[0]-ACHU.lastPose[0],pose[1]-ACHU.lastPose[1],pose[2]-ACHU.lastPose[2])/((typeof RL!=="undefined"&&RL.S)||1), r=Math.abs(pose[3]-ACHU.lastPose[3])+Math.abs(pose[4]-ACHU.lastPose[4]);
      if(d>0.03||r>0.012) ACHU.still=Date.now(); } else if(!vf) ACHU.still=0;
    if(vf&&!ACHU.still) ACHU.still=Date.now(); ACHU.lastPose=pose;
    if(typeof Sync!=="undefined"&&Sync.on()&&Date.now()-ACHU.rareT>120000){ ACHU.rareT=Date.now(); var w=lsWho(); if(w&&w.code&&Sync.rarity) Sync.rarity(w.code).then(function(r){ if(r){ ACHU.rare={}; r.forEach(function(x){ ACHU.rare[x.id]=x.pct; }); } }).catch(function(){}); } }, 400);
  function achStill(){ return ACHU.still?Math.round((Date.now()-ACHU.still)/1000):0; }

  if(/[?&]dev/.test(location.search)){ window.__ach={ state:function(){ var s=achS(); return {earned:Object.keys(s.earned), n:achCountAll(), of:ACH.length, showcase:s.showcase, ev:s.ev, queue:ACHU.queue.length, card:ACHU.card&&{id:ACHU.card.id, lv:ACHU.card.lv, full:ACHU.full}}; },
    event:achEvent, shot:function(p){ achShot(p||photos[photos.length-1]); }, pages:function(){ return qPages("annotate").length; }, last:function(){ var p=photos[photos.length-1]; return p&&p.cap; }, url:function(){ var p=photos.filter(function(x){ return x.cap; })[0]; return p&&p.url; }, sweep:function(){ return achSweep(false); }, wall:achWallHtml, pin:achPin, one:achShowOne, open:achOpenFull, next:achNext, still:function(s){ ACHU.still=Date.now()-s*1000; }, list:function(){ return ACH.map(function(a){ return a.id; }); }, cat:function(id){ return ACH_BY[id]&&ACH_BY[id].cat; } }; }
