  // ================= GUIDE HELPERS =================
  // The step-by-step first-session guide (GD_FULL) and the old demo (GD_DEMO) are gone: quests replace both (quests.js).
  // What's left is shared: the demo's three gold frames, the popup element helper, and the read-first button lock.
  var GD_DEMO_CH=[
    {id:"stump-fgbg", over:{title:"Wide and close, on a crop sensor", mm:38,
      brief:"The APS-C camera's smaller sensor crops the picture 1.6×, so even the zoom's widest setting looks tighter. Get low and close: the stump fills the left, the dead tree stands behind it, and f/11 keeps both sharp.",
      need:[{k:"body",id:"ml",label:"Swap to the APS-C mirrorless: Space, Camera bag, then pick it under Bodies"},
        {k:"mm",max:40,label:"24–70 zoomed right out: raise the camera (right click), scroll down"},
        {k:"f",min:11,label:"Aperture f/11 or smaller: on the camera back (Space)"},
        {k:"ev",tol:1,label:"Exposure within a stop: change the shutter on the back until the needle centres"}]}},
    {id:"stump-dof", over:{title:"Shallow depth of field",
      brief:"Back to the full-frame DSLR, with the 85 mm portrait lens wide open. Focus on the stump and let everything behind it melt away.",
      need:[{k:"body",id:"dslr",label:"Full-frame DSLR: Space, Camera bag, then pick it under Bodies"},
        {k:"lens",mm:85,label:"85 mm f/1.4: in the camera bag (Space), under Lens"},
        {k:"f",max:1.4,label:"Wide open at f/1.4: on the camera back (Space)"},
        {k:"ev",tol:1,label:"Exposure within a stop: wide open lets in lots of light, so pick a faster shutter on the back"}]}},
    {id:"stump-67", over:{title:"Medium format, vertical",
      brief:"Now the 6×7 film camera: a big negative and only ten frames to a roll. Turn it on its side and stop down. Meter carefully, because film doesn't give you a second go.",
      need:[{k:"body",id:"67",label:"6×7 film SLR: Space, Camera bag, then pick it under Bodies"},
        {k:"lens",mm:105,label:"105 mm, its standard lens: in the camera bag (Space), under Lens"},
        {k:"vert",label:"Turn the camera vertical: press X"},
        {k:"f",min:8,label:"f/8 or smaller: on the camera back (Space)"},
        {k:"ev",tol:0.7,label:"Exposure within ⅔ of a stop: shutter or ISO on the camera back"}]}}];
  function gdDemoChallenges(all){ return GD_DEMO_CH.map(function(d){ var c=all.filter(function(x){ return x.id===d.id; })[0]; if(!c) return null; var o={}, k; for(k in c) o[k]=c[k]; for(k in d.over) o[k]=d.over[k]; return o; }).filter(Boolean); }
  function gdEl(id, cls){ var e=$(id); if(!e){ e=document.createElement("div"); e.id=id; e.className=cls; document.body.appendChild(e); } return e; }
  // Read first: a popup's buttons wait a few seconds, with a gold bar filling across them, so it gets read rather than
  // clicked straight through. ?quick (for the tests) cuts it right down.
  var READ_MS=/[?&]quick(&|=|$)/.test(location.search)?250:(qDemo()?2000:5000);
  function readLock(b,ms){ ms=ms==null?READ_MS:ms; if(!b||ms<=0) return; b.disabled=true; b.classList.add("rl"); b.style.setProperty("--rl",ms+"ms");
    setTimeout(function(){ b.disabled=false; b.classList.remove("rl"); },ms); }
  function gdIsDemo(){ return qDemo(); }   /* the demo is a quest set now */
  if(/[?&]dev/.test(location.search)) window.__gd={ state:function(){ return {step:-1, demo:qDemo(), retired:true}; } };   /* kept for old scripts: the guide is retired */
