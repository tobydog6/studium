  // ================= GUIDE HELPERS =================
  // The step-by-step first-session guide (GD_FULL) and the old demo (GD_DEMO) are gone: quests replace both (quests.js).
  // What's left is shared: the demo's three gold frames, the popup element helper, and the read-first button lock.
  /* three frames, three different moves: wide and everything sharp; wide open and racing the shutter; film, slow and steady */
  var GD_DEMO_CH=[
    {id:"stump-fgbg", over:{title:"Wide and sharp", mm:38,
      brief:"The APS-C camera's smaller sensor crops the picture 1.6×, so even the zoom's widest setting looks tighter. Get low and close, then stop right down so the stump at your feet and the dead tree behind it are both sharp.",
      need:[{k:"body",id:"ml",label:"Swap to the APS-C mirrorless: Space, Bag, then pick it under Bodies"},
        {k:"mm",max:40,label:"24–70 zoomed right out: raise the camera (right click), scroll down"},
        {k:"f",min:11,label:"f/11 or smaller, so near and far both hold: on the camera back (Space)"},
        {k:"iso",max:400,label:"ISO 400 or lower, so the leaves don’t get grainy"},
        {k:"ev",tol:1,label:"Exposure within a stop: a small aperture needs a slower shutter, so trade until the needle centres"}]}},
    {id:"stump-dof", over:{title:"Blurry background",
      brief:"Back to the full-frame DSLR with the 85 mm portrait lens wide open. Focus on the stump so the background goes soft and blurry. Wide open lets in a lot of light, so you’ll need a fast shutter speed.",
      need:[{k:"body",id:"dslr",label:"Full-frame DSLR: Space, Bag, then pick it under Bodies"},
        {k:"lens",mm:85,label:"85 mm f/1.4: in the Bag (Space), under Lens"},
        {k:"f",max:1.4,label:"Wide open at f/1.4: on the camera back (Space)"},
        {k:"sh",max:1/500,label:"1/500 or faster, so it isn’t too bright"},
        {k:"ev",tol:1,label:"Exposure within a stop: if it's still too bright, drop the ISO"}]}},
    {id:"stump-67", over:{title:"Shooting on film",
      brief:"Now the 6×7 film camera. It has a big negative, only ten frames on a roll and no screen to check your shot. Turn it on its side, set ISO 100 and a slow shutter, and keep really still. Below about 1/60 your hands start to show.",
      need:[{k:"body",id:"67",label:"6×7 film SLR: Space, Bag, then pick it under Bodies"},
        {k:"lens",mm:105,label:"105 mm, its standard lens: in the Bag (Space), under Lens"},
        {k:"vert",label:"Turn the camera vertical: press X"},
        {k:"iso",max:100,label:"ISO 100, the slowest film"},
        {k:"sh",min:1/30,label:"1/30 or slower: brace yourself and watch the shake warning"},
        {k:"ev",tol:0.7,label:"Exposure within ⅔ of a stop: close the aperture down to balance the slow shutter"}]}}];
  function gdDemoChallenges(all){ return GD_DEMO_CH.map(function(d){ var c=all.filter(function(x){ return x.id===d.id; })[0]; if(!c) return null; var o={}, k; for(k in c) o[k]=c[k]; for(k in d.over) o[k]=d.over[k]; return o; }).filter(Boolean); }
  function gdEl(id, cls){ var e=$(id); if(!e){ e=document.createElement("div"); e.id=id; e.className=cls; document.body.appendChild(e); } return e; }
  // Read first: a popup's buttons wait a few seconds, with a gold bar filling across them, so it gets read rather than
  // clicked straight through. ?quick (for the tests) cuts it right down.
  var READ_MS=/[?&]quick(&|=|$)/.test(location.search)?250:(qDemo()?2000:5000);
  function readLock(b,ms){ ms=ms==null?READ_MS:ms; if(!b||ms<=0) return; b.disabled=true; b.classList.add("rl"); b.style.setProperty("--rl",ms+"ms");
    setTimeout(function(){ b.disabled=false; b.classList.remove("rl"); },ms); }
  function gdIsDemo(){ return qDemo(); }   /* the demo is a quest set now */
  if(/[?&]dev/.test(location.search)) window.__gd={ state:function(){ return {step:-1, demo:qDemo(), retired:true}; } };   /* kept for old scripts: the guide is retired */
