// ================= GALLERY START: loads last, once every screen has registered =================
roomBuild(siteById(G.site)); galGo(G.site?"floor":"map", {first:!G.site}); requestAnimationFrame(rmFrame);
/* reloaded in the middle of an opening night: pick the night back up */
if(G.site&&G.show.phase==="booked"&&G.show.openDay===gDay()&&gMin()>=NIGHT&&gMin()<NIGHT_END&&GSCR.night){ gNightOn=true; GSCR.night.start(); }
if(/[?&]dev/.test(location.search)||(BR&&/[?&]dev/.test(parent.location.search))) window.__g={G:function(){ return G; }, go:galGo, tick:function(min){ for(var i=0;i<min;i++) gMinute(); galHud(); }, RM:RM, sell:gSold, faces:function(){ return RM.faces; }};
