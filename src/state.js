  // ---- app state machine ----
  // Studium has five places: hub, bag, viewfinder (in the scene), back (camera back) and studio.*.
  // Every move between places goes through App.go so there is one source of truth and no stacked overlays.
  // States: "hub" | "landing" | "scene" | "viewfinder" | "back" | "bag" | "studio" | "studio.<room>" | "punctum"
  // Places not yet rebuilt (studio rooms, bag) report their state with App.note() until their own session.
  var App=(function(){
    var state="hub", prev=null, handlers=[];
    function set(next){ if(next===state) return false; prev=state; state=next; document.body.setAttribute("data-state",next);
      for(var i=0;i<handlers.length;i++){ try{ handlers[i](next,prev); }catch(e){ console.warn("state handler",e); } } return true; }
    return {
      get state(){ return state; },
      get prev(){ return prev; },
      is:function(s){ return state===s || state.indexOf(s+".")===0; },
      go:function(next){ return set(next); },          // a place change the app is making
      note:function(next){ return set(next); },        // record a change made by legacy code
      on:function(fn){ handlers.push(fn); }
    };
  })();
  document.body.setAttribute("data-state","hub");
