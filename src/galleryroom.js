  // ---------- Gallery: the end-of-year tycoon bonus game (src/gallery.html + gallery.js, docs/gallery-brief.md) ----------
  // Like the light table it runs in its own iframe (its own three.js and WebGL context), shown full-screen over
  // everything, and talks to Studium only through GAL_BRIDGE: it reads the student's own photos and saves its state
  // into the session (st.galGame). For now it opens only from the ?dev hook __gal.
  var GAL_B64="@@gallery-b64@@", GAL={on:false, frame:null, box:null};
  function galFolio(){ var s={}, b=typeof st!=="undefined"&&st.foBoard; if(!b||!b.pages) return s;
    b.pages.forEach(function(pg){ (pg.items||[]).forEach(function(it){ if(it.t==="photo"&&it.pid&&!it.hidden) s[it.pid]=1; }); }); return s; }
  function galPhotos(){ var n={}, fo=galFolio(), out=[];
    photos.forEach(function(p,i){ if(p.research||!p.url) return; var pl=stPlaceOf(p)||"Uploads", id=stId(i); n[pl]=(n[pl]||0)+1;
      out.push({id:id, url:p.url, name:pl+" "+String(n[pl]).padStart(2,"0"), place:pl, pick:!!p.pick, folio:!!fo[id]}); });
    return out; }
  function galData(){ return {photos:galPhotos(), state:(typeof st!=="undefined"&&st.galGame)||null}; }
  window.GAL_BRIDGE={
    data:galData,
    save:function(s){ if(typeof st==="undefined") return; st.galGame=s; saveSession(); },
    close:function(){ galClose(); }
  };
  function galApp(){ try{ return GAL.frame&&GAL.frame.contentWindow&&GAL.frame.contentWindow.GALapp||null; }catch(e){ return null; } }
  function galOpen(){ if(!GAL.box){ GAL.box=document.createElement("div"); GAL.box.id="gal-room"; GAL.box.className="hidden"; document.body.appendChild(GAL.box); }
    if(!GAL.frame){ var html; try{ html=decodeURIComponent(escape(atob(GAL_B64))); }catch(e){ GAL.box.innerHTML='<p class="gal-err">The gallery didn’t load. Try reloading Studium.</p>'; GAL.box.classList.remove("hidden"); GAL.on=true; return; }
      if(typeof ltFonts==="function") html=html.replace("</head>","<style>"+ltFonts()+"</style></head>");   /* Studium's own fonts, as the light table does */
      GAL.frame=document.createElement("iframe"); GAL.frame.className="gal-frame"; GAL.frame.title="Gallery"; GAL.frame.srcdoc=html; GAL.box.appendChild(GAL.frame);
      GAL.frame.addEventListener("load", function(){ try{ GAL.frame.contentWindow.focus(); }catch(e){} }); }
    else { var a=galApp(); if(a) try{ a.pause(false); }catch(e){} try{ GAL.frame.contentWindow.focus(); }catch(e){} }
    GAL.box.classList.remove("hidden"); GAL.on=true; }
  /* closing drops the frame: the next open starts fresh with the photos (and the student) signed in now, never a previous one's */
  function galClose(){ if(!GAL.on) return; GAL.on=false; var a=galApp(), f=GAL.frame; if(a) try{ a.pause(true); }catch(e){} GAL.frame=null; if(GAL.box) GAL.box.classList.add("hidden");
    setTimeout(function(){ if(f&&f.parentNode) f.parentNode.removeChild(f); },0); try{ window.focus(); }catch(e){} }
  if(/[?&]dev/.test(location.search)) window.__gal={ open:galOpen, close:galClose, on:function(){ return GAL.on; }, frame:function(){ return GAL.frame; }, data:galData };
