// ================= GALLERY START: loads last, once every screen has registered =================
roomBuild(siteById(G.site)); galGo(G.site?"floor":"map", {first:!G.site}); requestAnimationFrame(rmFrame);
if(/[?&]dev/.test(location.search)||(BR&&/[?&]dev/.test(parent.location.search))) window.__g={G:function(){ return G; }, go:galGo, tick:function(min){ for(var i=0;i<min;i++) gMinute(); galHud(); }, RM:RM, sell:gSold, faces:function(){ return RM.faces; }};
