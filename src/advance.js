  // ================= FILM ADVANCE: moving between studio rooms winds the film on =================
  // A strip of film (sprocket holes along both edges, the frame numbers going by) sweeps across the studio, the
  // room changes underneath it while it covers the screen, then it carries on off the other side. Later rooms
  // wind in from the right, earlier ones from the left. Skipped for reduced motion and when the studio first opens.
  var ADV={busy:false, el:null};
  function advEl(){ if(ADV.el) return ADV.el; var e=document.createElement("div"); e.id="stAdvance"; e.setAttribute("aria-hidden","true");
    e.innerHTML='<div class="adv-strip top"></div><div class="adv-frame"><span class="adv-from"></span><span class="adv-to"></span></div><div class="adv-strip bot"></div>'; document.body.appendChild(e); ADV.el=e; return e; }
  (function advHook(){ if(typeof stRoom!=="function") return; var _room=stRoom;
    stRoom=function(r){ var from=st.room, ord=ST_ROOMS.map(function(x){ return x[0]; }), a=ord.indexOf(from), b=ord.indexOf(r), reduce=false;
      try{ reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}
      if(ADV.busy||!st.open||!from||from===r||a<0||b<0||reduce){ return _room.apply(this,arguments); }
      var args=arguments, self=this, dir=b>a?1:-1, e=advEl(), bar=$("stBar"), top=bar?Math.round(bar.getBoundingClientRect().bottom):0;
      e.style.top=top+"px"; e.querySelector(".adv-from").textContent=String(a+1).padStart(2,"0")+" "+ST_ROOMS[a][1].toUpperCase();
      e.querySelector(".adv-to").textContent=String(b+1).padStart(2,"0")+" "+ST_ROOMS[b][1].toUpperCase(); ADV.busy=true;
      var out=_room.apply(self,args);   /* the room changes straight away (tours and quests rely on it), under the film */
      e.style.transition="none"; e.style.transform="translateX(0)"; e.classList.add("on"); void e.offsetWidth;
      var fr=e.querySelector(".adv-frame"); fr.style.transition="none"; fr.style.transform="translateX("+(dir*8)+"%)"; void fr.offsetWidth; fr.style.transition="transform .44s cubic-bezier(.5,0,.2,1)"; fr.style.transform="translateX("+(-dir*8)+"%)";
      e.style.transition="transform .44s cubic-bezier(.62,0,.25,1)"; e.style.transform="translateX("+(-dir*100)+"%)";
      if(typeof sfx==="function") try{ sfx("roll"); }catch(er){}
      setTimeout(function(){ e.classList.remove("on"); ADV.busy=false; },470); return out; }; })();
