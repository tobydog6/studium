// ================= GALLERY WALL PLAN: hang a wall flat, like a curator's elevation (to be built) =================
GSCR.plan={open:function(o){ /* stub until plan.js lands: hang the first few photos along the wall */ var f=galFace(o.face); if(f){ var n=Math.max(1,Math.min(PH.length, Math.floor(f.len/2.2)));
  for(var i=0;i<n;i++) galHang({pid:PH[i%PH.length].id, face:f.id, x:f.len*(i+0.5)/n, size:"m"}); roomRefresh(); } galGo("floor"); }};
