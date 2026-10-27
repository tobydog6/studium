  // ================= sound: one system for everything after the opening =================
  /* Sam's mix (27 Oct 2026, from the sound sampler). Directions: A Felt (felt piano, wood ticks), B Mechanism (camera and paper foley),
     C Air (breath and glints). Everything is synthesised from the same parts as the opening in launch.js: the A major of the score
     and the same soft dark room. sfx(id) plays a cue; Setup > Sound sets the level (OFF / LOW / MEDIUM / FULL). */
  var SFX={ctx:null, out:null, verb:null, nb:null, last:0, at:{}, hoverEl:null, lv:2};
  var SFX_LV=[0,0.35,0.65,1], SFX_LV_NAME=["OFF","LOW","MEDIUM","FULL"], SFX_SEND={A:0.55,B:0.18,C:0.75};
  try{ var _sl=localStorage.getItem("studium_sound_lv"); if(_sl!=null&&SFX_LV[+_sl]!=null) SFX.lv=+_sl; }catch(e){}
  soundOn=SFX.lv>0;
  function sfxVol(){ if(!soundOn) return 0; return SFX_LV[SFX.lv]||SFX_LV[2]; }
  function sfxLevelStep(d, wrap){ var n=SFX_LV.length; SFX.lv=d<0?Math.max(0,SFX.lv-1):wrap?(SFX.lv+1)%n:Math.min(n-1,SFX.lv+1); soundOn=SFX.lv>0; try{ localStorage.setItem("studium_sound_lv",SFX.lv); }catch(e){} sfxApplyVol(); }
  function sfxLevelName(){ return soundOn?SFX_LV_NAME[SFX.lv||2]:"OFF"; }
  function sfxApplyVol(){ var v=sfxVol(); if(SFX.out&&SFX.ctx) SFX.out.gain.setTargetAtTime(v,SFX.ctx.currentTime,0.05); if(typeof SD!=="undefined"&&SD&&SD.out&&SD.ctx&&!SD.off) SD.out.gain.setTargetAtTime(Math.max(v,0.0001),SD.ctx.currentTime,0.05); }
  function sfxCtx(){ if(!soundOn) return null;
    try{ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==="suspended") audioCtx.resume(); }catch(e){ return null; }
    if(SFX.ctx===audioCtx) return audioCtx; var c=SFX.ctx=audioCtx;
    var comp=c.createDynamicsCompressor(); comp.threshold.value=-16; comp.ratio.value=3; comp.attack.value=0.004; comp.release.value=0.2; comp.connect(c.destination);
    SFX.out=c.createGain(); SFX.out.gain.value=sfxVol(); SFX.out.connect(comp);
    var sr=c.sampleRate, len=sr*2, ch, i, d; SFX.nb=c.createBuffer(2,len,sr); for(ch=0;ch<2;ch++){ d=SFX.nb.getChannelData(ch); for(i=0;i<len;i++) d[i]=Math.random()*2-1; }
    var rl=Math.floor(sr*2.6), ir=c.createBuffer(2,rl,sr); for(ch=0;ch<2;ch++){ d=ir.getChannelData(ch); for(i=0;i<rl;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/rl,3.4); }   /* the opening's soft dark room */
    SFX.verb=c.createConvolver(); SFX.verb.buffer=ir; var vl=c.createBiquadFilter(); vl.type="lowpass"; vl.frequency.value=4200; var vg=c.createGain(); vg.gain.value=0.32; SFX.verb.connect(vl); vl.connect(vg); vg.connect(SFX.out);
    return c; }

  // ---- the voice kit (same shapes as launch.js) ----
  function sxBus(send){ var c=SFX.ctx, g=c.createGain(); g.connect(SFX.out); if(send){ var s=c.createGain(); s.gain.value=send; g.connect(s); s.connect(SFX.verb); } return g; }
  function sxEnv(g,t,a,pk,h,r){ pk=Math.max(pk,0.0002); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(pk,t+a); g.gain.setValueAtTime(pk,t+a+h); g.gain.exponentialRampToValueAtTime(0.0001,t+a+h+r); }
  function sxOut(node,b,pan,pan2,t,T){ var c=SFX.ctx; if(pan==null||!c.createStereoPanner){ node.connect(b); return; } var p=c.createStereoPanner(); p.pan.setValueAtTime(pan,t); if(pan2!=null) p.pan.linearRampToValueAtTime(pan2,t+T); node.connect(p); p.connect(b); }
  function sxTone(b,t,f,type,a,pk,h,r,f2,pan){ var c=SFX.ctx, o=c.createOscillator(), g=c.createGain(), T=a+h+r; o.type=type||"sine"; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+T); sxEnv(g,t,a,pk,h,r); o.connect(g); sxOut(g,b,pan,null,t,T); o.start(t); o.stop(t+T+0.05); return T; }
  function sxNoise(b,t,ft,f,q,a,pk,h,r,f2,pan,pan2){ var c=SFX.ctx, s=c.createBufferSource(), fl=c.createBiquadFilter(), g=c.createGain(), T=a+h+r; s.buffer=SFX.nb; s.loop=true; fl.type=ft; fl.frequency.setValueAtTime(f,t); if(f2) fl.frequency.exponentialRampToValueAtTime(f2,t+T); fl.Q.value=q||0.7; sxEnv(g,t,a,pk,h,r); s.connect(fl); fl.connect(g); sxOut(g,b,pan,pan2,t,T); s.start(t,Math.random()*1.5); s.stop(t+T+0.05); return T; }
  function sxTick(b,t,f,pk,pan){ return sxNoise(b,t,"bandpass",f,7,0.001,pk,0.003,0.028,null,pan); }
  function sxWood(b,t,f,pk,pan){ sxNoise(b,t,"bandpass",f,4,0.001,pk,0.002,0.05,null,pan); return sxTone(b,t,f*0.5,"sine",0.002,pk*0.5,0.005,0.05); }
  function sxFelt(b,t,f,pk,pan,len){ var c=SFX.ctx, g=c.createGain(), lp=c.createBiquadFilter(); len=len||3.2; lp.type="lowpass"; lp.frequency.setValueAtTime(f*5,t); lp.frequency.exponentialRampToValueAtTime(f*1.6,t+Math.min(2.5,len));
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(pk,t+0.012); g.gain.exponentialRampToValueAtTime(pk*0.35,t+0.5); g.gain.exponentialRampToValueAtTime(0.0001,t+len); lp.connect(g); sxOut(g,b,pan,null,t,len);
    [[1,1],[2,0.32],[3,0.1],[4.02,0.05]].forEach(function(h){ var o=c.createOscillator(), og=c.createGain(); o.frequency.value=f*h[0]; og.gain.value=h[1]; o.connect(og); og.connect(lp); o.start(t); o.stop(t+len+0.1); }); return len; }
  function sxGlint(b,t,f,pk,pan,r){ return sxTone(b,t,f,"sine",0.004,pk,0.01,r||0.9,null,pan); }
  function sxThump(b,t,f,pk){ return sxTone(b,t,f,"sine",0.004,pk,0.01,0.22,f*0.45); }
  function sxPaper(b,t,pk,up,pan){ return sxNoise(b,t,"highpass",up?1800:3200,0.6,up?0.06:0.01,pk,0.03,up?0.14:0.09,up?4200:1400,pan); }
  var SN={A2:110,E3:164.81,Gs3:207.65,B3:246.94,Cs4:277.18,A3:220,E4:329.63,A4:440,Cs5:554.37,E5:659.25,Gs5:830.61,A5:880,B5:987.77,Cs6:1108.73,E6:1318.51,Fs6:1479.98,A6:1760,B6:1975.53,Cs7:2217.46,E7:2637.02,Fs7:2959.96};

  // ---- the cues, in Sam's picks: [direction, play(bus, t)] ----
  var SFX_CUES={
    /* moving round the interface */
    hover:   ["A",function(b,t){ sxWood(b,t,2600,0.018); }],
    select:  ["A",function(b,t){ sxTone(b,t,110,"sine",0.01,0.028,0.02,0.22); sxWood(b,t,1200,0.013); }],   /* drone touch (round 2 pick), quieter */
    back:    ["C",function(b,t){ sxNoise(b,t,"bandpass",3000,1.2,0.02,0.018,0.02,0.2,900); }],
    toggle:  ["A",function(b,t){ sxTone(b,t,110,"sine",0.01,0.028,0.02,0.22); sxWood(b,t,1200,0.013); }],   /* same as a click: no dings in the interface */
    blocked: ["B",function(b,t){ sxTick(b,t,900,0.06); sxTick(b,t+0.07,880,0.05); sxThump(b,t,90,0.06); }],
    /* the kit */
    kitOpen: ["B",function(b,t){ sxNoise(b,t,"bandpass",700,0.9,0.05,0.025,0.05,0.2,1500,-0.2,0.2); [0,1,2,3].forEach(function(i){ sxTick(b,t+0.08+i*0.05,1800+i*250,0.035,(i-1.5)*0.3); }); }],
    kitClose:["B",function(b,t){ sxTick(b,t,2200,0.04); sxNoise(b,t,"bandpass",1400,0.9,0.02,0.02,0.03,0.15,500); sxTick(b,t+0.1,1300,0.05); }],
    tab:     ["B",function(b,t){ sxTick(b,t,2800,0.05); sxTick(b,t+0.02,2100,0.03); }],
    detent:  ["B",function(b,t){ sxTick(b,t,3600,0.05); sxTick(b,t+0.006,1500,0.03); }],
    bagSeat: ["B",function(b,t){ sxNoise(b,t,"bandpass",900,1.4,0.15,0.02,0.15,0.1,1800); for(var i=0;i<3;i++) sxTick(b,t+0.3+i*0.04,2600,0.03); sxTick(b,t+0.48,1500,0.07); sxThump(b,t+0.48,120,0.08); }],
    /* shooting */
    raise:   ["C",function(b,t){ sxNoise(b,t,"bandpass",400,1.0,0.25,0.03,0.05,0.3,2400); }],
    focus:   ["B",function(b,t){ for(var i=0;i<10;i++) sxTick(b,t+0.3*(1-Math.pow(1-i/10,1.7)),3800+i*90,0.014); sxTone(b,t+0.34,2730,"sine",0.003,0.04,0.045,0.03); sxTone(b,t+0.44,2730,"sine",0.003,0.04,0.045,0.05); }],
    shutterAir:["C",function(b,t){ sxNoise(b,t+0.05,"highpass",2000,0.7,0.02,0.015,0.02,0.4,6000); }],   /* the recorded shutter plays first, from app.js */
    roll:    ["B",function(b,t){ for(var i=0;i<6;i++) sxTick(b,t+i*0.045,2000-i*40,0.03,0.3); sxNoise(b,t,"lowpass",800,0.7,0.05,0.02,0.18,0.1,300,0.3); }],
    bounds:  ["B",function(b,t){ sxTone(b,t,60,"triangle",0.3,0.03,0.6,0.6); for(var i=0;i<4;i++) sxTick(b,t+0.1+i*0.25,700,0.025); }],
    views:   ["C",function(b,t){ sxNoise(b,t,"bandpass",400,1.2,0.25,0.03,0.05,0.4,3000,-0.4,0.4); sxGlint(b,t+0.25,SN.Fs6,0.012,0,0.8); }],
    portal:  ["C",function(b,t){ sxNoise(b,t,"bandpass",400,4,0.4,0.05,0.2,0.4,2800); [SN.E6,SN.B6,SN.E7].forEach(function(f,i){ sxGlint(b,t+0.15+i*0.07,f,0.022); }); }],
    /* guidance and rewards */
    tour:    ["A",function(b,t){ sxTone(b,t,110,"sine",0.18,0.038,0.1,0.7); sxTone(b,t,164.81,"sine",0.22,0.022,0.1,0.7); sxNoise(b,t,"lowpass",400,0.6,0.15,0.0075,0.05,0.4); }],   /* drone lift (round 2 pick), a touch under the sampler level */
    qPick:   ["A",function(b,t){ [SN.A3,SN.E4,SN.Cs5].forEach(function(f,i){ sxFelt(b,t+i*0.04,f,0.04,(i-1)*0.25,2.4); }); }],
    qStep:   ["C",function(b,t){ sxGlint(b,t,SN.E6,0.016,-0.2,0.7); sxGlint(b,t+0.08,SN.A6,0.016,0.2,0.8); }],
    qDone:   ["A",function(b,t){ [SN.A2,SN.E3,SN.Gs3,SN.B3,SN.Cs4].forEach(function(f,i){ sxTone(b,t+i*0.03,f,i<2?"triangle":"sine",0.08,[0.05,0.04,0.03,0.025,0.025][i],0.4,2.4,null,(i-2)*0.2); });
      [SN.Cs5,SN.E5,SN.Gs5,SN.B5,SN.Cs6].forEach(function(f,i){ sxFelt(b,t+0.1+i*0.09,f,0.035,(i-2)*0.25,2.0); }); }],
    ach:     ["A",function(b,t){ var w=t+0.25; sxNoise(b,t,"highpass",900,0.8,0.22,0.04,0.01,0.04,7000); sxTone(b,w,78,"sine",0.008,0.25,0.06,1.2,30);
      [55,110,164.81,207.65,246.94,277.18].forEach(function(f,i){ sxTone(b,w+i*0.02,f,i<3?"triangle":"sine",0.03+i*0.02,[0.04,0.05,0.04,0.03,0.028,0.025][i],0.3,2+i*0.2,null,(i%2?0.3:-0.3)); });
      [SN.E6,SN.Fs6,SN.A6,SN.B6,SN.Cs7].forEach(function(f,i){ sxGlint(b,w+0.04+i*0.05,f,0.016,-0.5+i*0.25); }); }],
    /* editing */
    grab:    ["C",function(b,t){ sxTick(b,t,5600,0.012); }],
    reset:   ["C",function(b,t){ sxNoise(b,t,"bandpass",4000,1.5,0.15,0.015,0.01,0.03,1200); }],
    beforeAfter:["C",function(b,t){ sxNoise(b,t,"bandpass",2400,1.4,0.04,0.016,0.02,0.12,4000,-0.6,0.6); }],
    /* light table (all Air) */
    lift:    ["C",function(b,t){ sxNoise(b,t,"highpass",3000,0.6,0.08,0.012,0.02,0.15,6000); }],
    drop:    ["C",function(b,t){ sxPaper(b,t,0.025,false); sxNoise(b,t,"lowpass",400,0.7,0.005,0.03,0.01,0.12); }],
    pin:     ["C",function(b,t){ sxTick(b,t,6000,0.015); sxGlint(b,t+0.01,SN.Fs6,0.01,0,0.5); }],
    copier:  ["A",function(b,t){ sxThump(b,t,110,0.07); sxTick(b,t,1200,0.05); sxTone(b,t+0.2,SN.A2,"sawtooth",0.2,0.008,1.6,0.3); sxNoise(b,t+0.2,"bandpass",500,1.2,0.3,0.02,1.4,0.3,2500,-0.6,0.6);
      sxPaper(b,t+2.1,0.035,true,0.5); sxFelt(b,t+2.2,SN.E5,0.03,0.4,1.2); }],   /* fired as the lid shuts: hum under the scan bar, the copy slides out at ~2.1 s */
    reject:  ["C",function(b,t){ sxNoise(b,t,"bandpass",3000,1.2,0.04,0.02,0.04,0.3,700); }],
    binder:  ["C",function(b,t){ sxNoise(b,t,"highpass",3500,0.6,0.15,0.015,0.1,0.15,7000,-0.3,0.3); }],
    /* ---- test 2 picks (28 Oct). The number is the reverb send. ---- */
    chPull:  [0.55,function(b,t){ sxTone(b,t,SN.A2,"sine",0.5,0.04,0.7,0.5,SN.E3); sxNoise(b,t,"lowpass",300,0.6,0.6,0.012,0.4,0.6,900); sxFelt(b,t+1.5,SN.A3,0.035,0,2); }],   /* drone draw */
    chIntro: [0.6,function(b,t){ sxNoise(b,t,"bandpass",200,0.7,4,0.025,1,2,900); sxFelt(b,t,SN.A2,0.03,0,3); }],   /* slow swell, the 7 s orbit */
    chDone:  [0.6,function(b,t){ [SN.A2,SN.E3,SN.A3].forEach(function(f,i){ sxTone(b,t+i*0.05,f,"sine",0.25,[0.05,0.035,0.025][i],0.5,1.4,null,(i-1)*0.3); }); }],   /* drone resolve */
    chMiss:  [0.2,function(b,t){ sxTick(b,t,900,0.05); sxTick(b,t+0.09,800,0.04); }],
    step:    [0.25,function(b,t,o){ var p=o&&o.right?0.25:-0.25; sxNoise(b,t,"bandpass",900,1.5,0.002,0.04,0.005,0.06,null,p); sxThump(b,t,140,0.05); sxTick(b,t+0.09,1300,0.012,p); }],   /* concrete */
    crouch:  [0.5,function(b,t){ sxNoise(b,t,"bandpass",400,0.8,0.12,0.015,0.02,0.2,800); }],
    arrive:  [0.2,function(b,t){ sxTick(b,t,1100,0.07); sxThump(b,t,120,0.07); sxNoise(b,t+0.05,"bandpass",300,1,0.3,0.012,0.6,0.8); sxTick(b,t+0.25,1400,0.04); }],   /* slide projector */
    lPlace:  [0.25,function(b,t){ sxTick(b,t,1700,0.04); sxThump(b,t,150,0.08); sxTone(b,t,410,"sine",0.002,0.012,0.01,0.35); sxTone(b,t,1130,"sine",0.002,0.004,0.01,0.25); }],
    lOn:     [0.2,function(b,t,o){ var on=!(o&&o.off); sxTick(b,t,on?1500:1100,0.06); sxThump(b,t,on?120:90,0.07); }],
    lRemove: [0.2,function(b,t){ for(var i=0;i<3;i++) sxTick(b,t+i*0.06,1600-i*250,0.03); sxThump(b,t+0.2,110,0.05); }],
    lTime:   [0.3,function(b,t){ sxWood(b,t,1000+Math.random()*240,0.02); }],
    lGolden: [0.5,function(b,t){ sxTone(b,t,SN.A2,"sine",0.4,0.04,0.6,1.2); sxTone(b,t+0.3,SN.E3,"sine",0.5,0.03,0.5,1.2); }],
    stMark:  [0.2,function(b,t,o){ sxNoise(b,t,"lowpass",o&&o.k==="reject"?350:o&&o.k==="star"?600:500,0.7,0.003,0.04,0.01,0.07); }],   /* soft press */
    bkTurn:  [0.3,function(b,t){ sxNoise(b,t,"bandpass",800,0.8,0.15,0.03,0.05,0.2,1600,-0.5,0.5); sxThump(b,t+0.38,80,0.06); sxTick(b,t+0.38,900,0.03); }],   /* heavy card */
    gaHang:  [0.2,function(b,t){ sxNoise(b,t,"lowpass",450,0.7,0.003,0.04,0.01,0.08); }],
    crop:    [0.35,function(b,t){ sxWood(b,t,1100,0.04); }],
    heal:    [0.5,function(b,t){ sxNoise(b,t,"lowpass",500,0.7,0.05,0.014,0.03,0.12); }],
    imported:[0.5,function(b,t){ [SN.A3,SN.Cs4,SN.E4].forEach(function(f,i){ sxFelt(b,t+i*0.09,f,0.03,(i-1)*0.3,1.6); }); }],
    cullPick:[0.35,function(b,t){ sxWood(b,t,1200,0.035); }],
    cullEnd: [0.5,function(b,t){ sxTone(b,t,SN.A2,"sine",0.3,0.04,0.5,1.2); sxTone(b,t,SN.E3,"sine",0.35,0.025,0.5,1.2); }],
    lsMove:  [0.45,function(b,t){ [[1,1],[2.76,0.3],[5.4,0.08]].forEach(function(h){ sxTone(b,t,SN.A3*h[0],"sine",0.003,0.05*h[1],0.02,1.8); sxTone(b,t+0.9,SN.E3*h[0],"sine",0.003,0.05*h[1],0.02,1.8); }); }],   /* low bell */
    shPan:   [0.5,function(b,t){ sxTone(b,t,SN.E3,"sine",0.3,0.03,0.4,0.6,SN.A2); }],   /* shredder: drone slide down the table edge */
    shRun:   [0.5,function(b,t,o){ var D=Math.max(0.6,(o&&o.D)||2); sxNoise(b,t,"lowpass",300,0.8,0.12,0.03,D,0.25); sxTone(b,t,82.41,"sine",0.12,0.02,D,0.25); }],   /* the motor under one photo; faded out the moment the photo is through */
    shBite:  [0.4,function(b,t){ sxNoise(b,t,"bandpass",900,1,0.02,0.014,0.06,0.09,500); }],   /* one bite of the cutter, fired as the paper moves */
    shFall:  [0.6,function(b,t){ [SN.A2,SN.E3,SN.A3].forEach(function(f,i){ sxTone(b,t+i*0.05,f,"sine",0.25,[0.045,0.03,0.02][i],0.4,1.3,null,(i-1)*0.3); }); }],   /* drone resolve */
    /* light table, the last eleven: Sam's picks (28 Oct) */
    ltInspect:[0.5,function(b,t){ sxTone(b,t,110,"sine",0.05,0.03,0.05,0.4); sxNoise(b,t,"lowpass",450,0.7,0.12,0.01,0.03,0.2); }],   /* drone touch */
    ltPutDown:[0.6,function(b,t){ sxNoise(b,t,"bandpass",1200,0.9,0.05,0.016,0.03,0.25,350); }],   /* air down */
    ltLoupe: [0.3,function(b,t,o){ if(!(o&&o.off)){ sxNoise(b,t,"bandpass",900,1,0.05,0.012,0.02,0.1,1600); sxTone(b,t+0.02,260,"sine",0.003,0.012,0.01,0.2); return; } sxWood(b,t,900,0.03); sxNoise(b,t,"lowpass",350,0.7,0.003,0.03,0.01,0.08); }],
    ltString:[0.3,function(b,t){ sxNoise(b,t,"bandpass",1800,2.5,0.08,0.012,0.05,0.08,2600,-0.2,0.2); }],
    ltStringTie:[0.4,function(b,t){ sxTick(b,t,4000,0.012); sxTone(b,t,98,"triangle",0.003,0.03,0.02,0.35); sxTone(b,t,196,"sine",0.003,0.01,0.02,0.25); }],
    ltUnpin: [0.6,function(b,t){ sxNoise(b,t,"bandpass",500,0.9,0.12,0.016,0.03,0.2,1800); }],   /* air up */
    ltView:  [0.5,function(b,t,o){ var up=!(o&&o.off); sxTone(b,t,up?110:164.81,"sine",0.25,0.03,0.1,0.5,up?164.81:110); }],   /* drone shift: up to the wall, down to the table */
    ltUnreject:[0.6,function(b,t){ sxNoise(b,t,"bandpass",500,0.9,0.1,0.016,0.03,0.2,1800); }],
    ltUndo:  [0.35,function(b,t){ sxWood(b,t,1000,0.03); }],   /* wood tap */
    ltMenu:  [0.5,function(b,t){ sxTone(b,t,110,"sine",0.01,0.025,0.02,0.2); sxWood(b,t,1200,0.012); }],
    capture: [0.6,function(b,t){ sxNoise(b,t,"bandpass",400,0.9,0.03,0.03,0.02,0.4,2400); }]   /* air flash */
  };
  var SFX_GAP={shBite:40, step:150, lTime:35, heal:70, stMark:50, hover:45, detent:22, grab:60, select:60, back:60, toggle:40, lift:60, drop:60};   /* ms between repeats of the same cue */
  var SFX_GAIN={ach:0.75};   /* per-cue trims Sam asked for: the achievement a touch quieter */
  function sfx(id, o){ var cue=SFX_CUES[id]; if(!cue||!soundOn) return; if(navigator.userActivation&&!navigator.userActivation.hasBeenActive) return;   /* nothing before the first click, or it all plays late in a burst */ var now=performance.now(); if(SFX.at[id]&&now-SFX.at[id]<(SFX_GAP[id]||30)) return;
    SFX.at[id]=now; if(id!=="hover") SFX.last=now;
    var c=sfxCtx(); if(!c) return; try{ var b=sxBus(typeof cue[0]==="number"?cue[0]:SFX_SEND[cue[0]]); if(SFX_GAIN[id]) b.gain.value=SFX_GAIN[id]; var t=c.currentTime+0.005+((o&&o.delay)||0); cue[1](b,t,o); setTimeout(function(){ try{ b.disconnect(); }catch(e){} },(((o&&o.delay)||0)+8)*1000); return b; }catch(e){} }
  window.studiumSfx=sfx;

  // ---- scene ambience: soft air and the odd bird under a scan (Sam's pick, "Birds and air"); weather.js drives it with the scene's on/off ----
  function sfxAmbTick(on){ SFX.ambSeen=performance.now(); if(on&&soundOn&&!SFX.amb){ var c=sfxCtx(); if(!c||(navigator.userActivation&&!navigator.userActivation.hasBeenActive)) return;
      var s=c.createBufferSource(); s.buffer=SFX.nb; s.loop=true; var lp=c.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=500; lp.Q.value=0.5; var g=c.createGain(); g.gain.value=0.0001; g.gain.setTargetAtTime(0.014,c.currentTime,0.8);
      s.connect(lp); lp.connect(g); g.connect(SFX.out); s.start(0,Math.random()*1.5); var bb=sxBus(0.35);
      SFX.amb={s:s, g:g, bb:bb, iv:setInterval(function(){ if(!SFX.amb||Math.random()>=0.55) return; var t=c.currentTime+0.03, f=1800+Math.random()*900, n=2+Math.floor(Math.random()*3), p=Math.random()*1.4-0.7;
        for(var i=0;i<n;i++) sxTone(bb,t+i*0.11,f*(1+i*0.04),"sine",0.01,0.006,0.02,0.07,f*(1.18+i*0.04),p); },1700)}; }
    else if((!on||!soundOn)&&SFX.amb){ var A=SFX.amb; SFX.amb=null; clearInterval(A.iv); try{ A.g.gain.setTargetAtTime(0.0001,SFX.ctx.currentTime,0.5); setTimeout(function(){ try{ A.s.stop(); A.bb.disconnect(); }catch(e){} },3000); }catch(e){} } }

  /* if the scene stops drawing (hub, studio rooms), nothing calls the tick: fade the ambience and any weather out */
  setInterval(function(){ if(performance.now()-(SFX.ambSeen||0)<700) return; if(SFX.amb) sfxAmbTick(false);
    if(typeof WE!=="undefined"&&WE&&WE.snd){ try{ var t=WE.snd.c.currentTime; ["rain","patter","wind"].forEach(function(k){ WE.snd[k].g.gain.setTargetAtTime(0.0001,t,0.4); }); }catch(e){} } },500);

  // ---- footsteps: one every stride while walking on the ground ----
  function sfxStepTick(dt, speed){ if(!(speed>0.4)){ SFX.stride=0; return; } SFX.stride=(SFX.stride||0)+dt*speed; var L=0.75*(typeof sceneScale==="function"?sceneScale():1);
    if(SFX.stride>=L){ SFX.stride=0; SFX.foot=!SFX.foot; sfx("step",{right:SFX.foot}); } }

  // ---- the generic layer: every button gets hover, click and back; specific cues above take over where they fire ----
  (function sfxWire(){
    var HOV="button,[role=button],a[href],.switch,.kit-card,.q-tile,[data-hub],[data-kit],.cb-srow";
    function off(el){ return el.disabled||el.getAttribute("aria-disabled")==="true"; }
    function isBack(el){ if(el.hasAttribute("data-hub")) return true; var cl=(el.className&&el.className.baseVal==null?el.className:"")+"", lab=(el.getAttribute("aria-label")||"")+" "+(el.textContent||"").trim().slice(0,12);
      return /(^|\s|-)(back|close|x-?btn)(\s|-|$)/i.test(cl)||/^\s*(‹|←|×|✕|back\b|close\b)/i.test(lab.trim())||/\bback\b|\bclose\b/i.test(el.getAttribute("aria-label")||""); }
    document.addEventListener("pointerover",function(e){ if(typeof looking!=="undefined"&&looking) return; var el=e.target.closest&&e.target.closest(HOV); if(el===SFX.hoverEl) return; SFX.hoverEl=el; if(el&&!off(el)) sfx("hover"); },true);
    document.addEventListener("pointerdown",function(e){ var t=e.target; if(!t.closest) return;
      if(t.closest("button[disabled],[aria-disabled=true]")) return sfx("blocked");
      if(t.matches&&t.matches("input[type=range]")||t.closest(".cg-disc,[data-cv-box]")) sfx("grab"); },true);
    document.addEventListener("dblclick",function(e){ var t=e.target; if(t.matches&&(t.matches("input[type=range],[data-cv],[data-edp]")||t.closest(".cg-disc"))) sfx("reset"); },true);
    document.addEventListener("click",function(e){ var el=e.target.closest&&e.target.closest("button,[role=button],a[href],.switch"); if(!el||off(el)) return;
      var t0=performance.now();
      setTimeout(function(){ if(SFX.last>=t0-90) return;   /* a specific cue already played for this click, before or during its handlers */
        if(el.classList.contains("switch")) return sfx("toggle",{off:!el.classList.contains("on")});
        sfx(isBack(el)?"back":"select"); },0); });
  })();
