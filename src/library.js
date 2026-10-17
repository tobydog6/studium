  // ================= LIBRARY: the folders down the left of Select, Workbook and Folio =================
  // Like a photo app's library panel. Shortcuts (all frames, picks), one folder per location you shot in, and
  // projects students make themselves (a shoot, a theme, a series). Click a folder to see its frames. Click a frame
  // to use it, Ctrl/⌘ or Shift-click to select several, and drag frames (or a whole folder) onto a page, a cluster,
  // or a project. EDIT on a folder opens the develop panel on just that group, so it can be edited and synced together.
  var LIB={key:"all", sel:{}, anchor:-1, naming:null, delAsk:null};
  function libProjects(){ if(!st.projects) st.projects=[]; return st.projects; }
  function libFolders(){ var places=[], seen={}; photos.forEach(function(p){ var k=stPlaceOf(p)||"Uploads"; if(!seen[k]){ seen[k]=1; places.push(k); } });
    var f=[{key:"all", name:"All frames", kind:"all"}, {key:"picks", name:"Picks", kind:"picks"}];
    places.forEach(function(p){ f.push({key:"place:"+p, name:p, kind:"place"});
      if(photos.some(function(x){ return x.pick&&(stPlaceOf(x)||"Uploads")===p; })) f.push({key:"place:"+p+"|picks", name:"Picked photos", kind:"sub"}); });   // the picks from a location get their own folder inside it
    libProjects().forEach(function(pr){ f.push({key:"proj:"+pr.id, name:pr.name, kind:"proj", pr:pr}); });
    return f; }
  function libItems(key){ if(key==="picks") return stPicks();
    if(key.indexOf("place:")===0){ var pl=key.slice(6), pk=/\|picks$/.test(pl), a=[]; if(pk) pl=pl.slice(0,-6); photos.forEach(function(p,i){ if((stPlaceOf(p)||"Uploads")===pl&&(!pk||p.pick)) a.push(i); }); return a; }
    if(key.indexOf("proj:")===0){ var pr=libProjects().filter(function(x){ return "proj:"+x.id===key; })[0]; return pr?pr.ids.map(stById).filter(function(i){ return i>=0; }):[]; }
    return photos.map(function(_,i){ return i; }); }
  function libName(key){ var f=libFolders().filter(function(x){ return x.key===key; })[0]; return f?f.name:"All frames"; }
  function libSelList(){ return Object.keys(LIB.sel).filter(function(k){ return LIB.sel[k]; }).map(Number).filter(function(i){ return i<photos.length; }); }
  var LIB_ICON={all:'<svg viewBox="0 0 16 16"><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></svg>',
    picks:'<svg viewBox="0 0 16 16"><path d="M8 2l1.8 3.9 4.2.4-3.2 2.8.9 4.1L8 11.1 4.3 13.2l.9-4.1L2 6.3l4.2-.4z"/></svg>',
    place:'<svg viewBox="0 0 16 16"><path d="M1.5 4.5h4.5l1.5 1.5h7v7.5h-13z"/></svg>',
    sub:'<svg viewBox="0 0 16 16"><path d="M3 2v6.5h3.5"/><path d="M10.5 6l1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3z"/></svg>',
    proj:'<svg viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9"/><path d="M5 3.5V2h6v1.5"/></svg>'};
  // ctx: "board" (Workbook, Folio) or "select"
  function libRender(el, ctx){ if(!el) return; var folders=libFolders(), key=LIB.key;
    if(!folders.some(function(f){ return f.key===key; })) key=LIB.key="all";
    var items=libItems(key), sel=libSelList(), onPage={};
    if(ctx==="board"){ var B=stBoard(); if(B) B.page().items.forEach(function(it){ if(it.pid) onPage[it.pid]=1; }); }
    function row(f){ var n=libItems(f.key).length, on=f.key===key, pr=f.kind==="proj";
      if(pr&&LIB.naming===f.key) return '<div class="lib-f on naming"><span class="ic">'+LIB_ICON.proj+'</span><input class="lib-in" value="'+cbEsc(f.name)+'" data-lib-rename="'+f.key+'"></div>';
      return '<div class="lib-f'+(on?' on':'')+(pr?' proj':'')+(f.kind==="sub"?' sub':'')+'" data-lib-f="'+cbEsc(f.key)+'" draggable="true" title="'+(pr?'Drop frames here to add them. Drag the folder onto a page to place them all.':'Drag the folder onto a page to place them all')+'"><span class="ic">'+LIB_ICON[f.kind]+'</span><span class="nm">'+cbEsc(f.name)+'</span><i>'+n+'</i>'
        +(on&&n&&f.kind!=="all"?'<button class="ed" data-lib-edit="'+cbEsc(f.key)+'" title="Edit just this group">EDIT</button>':'')
        +(pr?'<button class="x'+(LIB.delAsk===f.key?' ask':'')+'" data-lib-del="'+cbEsc(f.key)+'" title="Delete project (frames stay in your library)">'+(LIB.delAsk===f.key?'DELETE?':'×')+'</button>':'')+'</div>'; }
    var h='<div class="lib-list"><span class="eb">LIBRARY</span>'+folders.filter(function(f){ return f.kind==="all"||f.kind==="picks"; }).map(row).join("")
      +'<span class="eb">LOCATIONS</span>'+(folders.some(function(f){ return f.kind==="place"; })?folders.filter(function(f){ return f.kind==="place"||f.kind==="sub"; }).map(row).join(""):'<p class="lib-none">Shoot somewhere to start a folder.</p>')
      +'<div class="lib-row"><span class="eb">PROJECTS</span><button data-lib-new title="New project'+(sel.length?' from the '+sel.length+' selected frames':'')+'">+ NEW</button></div>'
      +(LIB.naming==="new"?'<div class="lib-f on naming"><span class="ic">'+LIB_ICON.proj+'</span><input class="lib-in" placeholder="Name the project" data-lib-rename="new"></div>':'')
      +folders.filter(function(f){ return f.kind==="proj"; }).map(row).join("")
      +(libProjects().length||LIB.naming?'':'<p class="lib-none">Group a shoot or theme. Select frames, then + NEW.</p>')+'</div>';
    if(ctx==="select"){ h+='<div class="lib-grid-h"><span class="eb">'+cbEsc(libName(key).toUpperCase())+' · '+items.length+'</span>'+(sel.length?'<button data-lib-clear>'+sel.length+' SELECTED ✕</button>':'')+'</div>'
      +'<p class="lib-tip">Ctrl-click frames on the light table to select several, then <b>+ NEW</b> to make a project, or drag them onto one.</p>';
      el.innerHTML=h; el.classList.add("lib-host","lib-sel"); var i0=el.querySelector(".lib-in"); if(i0){ i0.focus(); i0.select(); } libWire(el, ctx); return; }
    h+='<div class="lib-grid-h"><span class="eb">'+cbEsc(libName(key).toUpperCase())+' · '+items.length+'</span>'+(sel.length?'<button data-lib-clear>'+sel.length+' SELECTED ✕</button>':'')+'</div><div class="lib-grid">'
      +(items.length?items.map(function(i){ var id=stId(i);
        return '<div class="bd-pic'+(LIB.sel[i]?' sel':'')+(ctx==="select"&&i===st.cur?' cur':'')+'" draggable="true" data-bd-pic="'+i+'" title="Frame '+(i+1)+(ctx==="board"?' · click to add, Ctrl-click to select':'')+'"><img src="'+(typeof hubThumb==="function"?hubThumb(i):photos[i].url)+'" alt="Frame '+(i+1)+'" draggable="false"><span class="m"><span>'+cbPad(i+1)+'</span>'+(onPage[id]?'<span class="in">ON PAGE</span>':photos[i].pick?'<span class="pk">★</span>':'')+'</span></div>'; }).join("")
        :'<p class="lib-none">'+(key.indexOf("proj:")===0?'Empty. Drag frames onto this project to add them.':'Nothing here yet.')+'</p>')+'</div>';
    el.innerHTML=h; el.classList.add("lib-host");
    var inp=el.querySelector(".lib-in"); if(inp){ inp.focus(); inp.select(); }
    libWire(el, ctx); }
  function libRefresh(){ if(!st.open) return; if(st.room==="select") stRenderSelect(); else stRerender(); }
  function libPayload(e){ var d=(e.dataTransfer&&e.dataTransfer.getData("text/plain"))||""; return libParse(d); }
  function libParse(d){ if(d.indexOf("lib:")===0) return libItems(d.slice(4)); if(d.indexOf("bd:")===0) return d.slice(3).split(",").map(Number).filter(function(i){ return i>=0&&i<photos.length; }); return []; }
  function libAddTo(key, idx){ var pr=libProjects().filter(function(x){ return "proj:"+x.id===key; })[0]; if(!pr) return 0; var n=0;
    idx.forEach(function(i){ var id=stId(i); if(pr.ids.indexOf(id)<0){ pr.ids.push(id); n++; } }); saveSession(); return n; }
  function libWire(el, ctx){ if(el._libWired) return; el._libWired=true;
    el.addEventListener("click",function(e){
      var t=e.target.closest("[data-lib-f],[data-lib-new],[data-lib-edit],[data-lib-del],[data-lib-clear],[data-bd-pic]"); if(!t||t.closest(".naming")) return;
      if(t.hasAttribute("data-bd-pic")){ var i=+t.getAttribute("data-bd-pic");
        if(e.ctrlKey||e.metaKey){ e.stopPropagation(); LIB.sel[i]=!LIB.sel[i]; LIB.anchor=i; libRefresh(); return; }
        if(e.shiftKey){ e.stopPropagation(); var list=libItems(LIB.key), a=list.indexOf(LIB.anchor>=0?LIB.anchor:i), b=list.indexOf(i); if(a<0) a=b; for(var k=Math.min(a,b);k<=Math.max(a,b);k++) LIB.sel[list[k]]=true; libRefresh(); return; }
        if(ctx==="select"){ e.stopPropagation(); st.cur=i; stRenderSelect(); }
        return; }   // plain click on a board: the board adds it
      e.stopPropagation();
      if(t.hasAttribute("data-lib-clear")){ LIB.sel={}; libRefresh(); return; }
      if(t.hasAttribute("data-lib-new")){ LIB.naming="new"; libRefresh(); return; }
      if(t.hasAttribute("data-lib-edit")){ var ids=libItems(t.getAttribute("data-lib-edit")); if(!ids.length) return; devScope=ids.slice(); st.cur=ids[0]; stRoom("edit"); toast("Editing "+libName(t.getAttribute("data-lib-edit"))+": ← → move through the group, select them all and Sync to match."); return; }
      if(t.hasAttribute("data-lib-del")){ var dk=t.getAttribute("data-lib-del"); if(LIB.delAsk!==dk){ LIB.delAsk=dk; libRefresh(); return; }
        st.projects=libProjects().filter(function(x){ return "proj:"+x.id!==dk; }); LIB.delAsk=null; if(LIB.key===dk) LIB.key="all"; saveSession(); libRefresh(); return; }
      if(t.hasAttribute("data-lib-f")){ var k2=t.getAttribute("data-lib-f"); LIB.delAsk=null; if(t.classList.contains("proj")&&LIB.key===k2&&e.detail>1) return; LIB.key=k2; libRefresh(); } });
    el.addEventListener("dblclick",function(e){ var t=e.target.closest(".lib-f.proj"); if(!t) return; LIB.naming=t.getAttribute("data-lib-f"); libRefresh(); });
    el.addEventListener("keydown",function(e){ var inp=e.target.closest(".lib-in"); if(!inp) return; e.stopPropagation();
      if(e.key==="Escape"){ LIB.naming=null; libRefresh(); return; }
      if(e.key!=="Enter") return; var nm=inp.value.trim(), k=inp.getAttribute("data-lib-rename");
      if(k==="new"){ if(nm){ var pr={id:"j"+Date.now().toString(36), name:nm, ids:[]}; libProjects().push(pr); libAddTo("proj:"+pr.id, libSelList()); LIB.sel={}; LIB.key="proj:"+pr.id; toast("Project “"+nm+"” made. Drag frames onto it to add more."); } }
      else if(nm){ libProjects().forEach(function(x){ if("proj:"+x.id===k) x.name=nm; }); }
      LIB.naming=null; saveSession(); libRefresh(); }, true);
    el.addEventListener("focusout",function(e){ if(e.target.classList&&e.target.classList.contains("lib-in")) setTimeout(function(){ if(LIB.naming){ LIB.naming=null; libRefresh(); } }, 150); });
    el.addEventListener("dragstart",function(e){ var f=e.target.closest&&e.target.closest("[data-lib-f]"), p=e.target.closest&&e.target.closest("[data-bd-pic]");
      if(f){ e.dataTransfer.setData("text/plain","lib:"+f.getAttribute("data-lib-f")); e.dataTransfer.effectAllowed="copy"; return; }
      if(p){ var i=+p.getAttribute("data-bd-pic"), list=LIB.sel[i]?libSelList():[i]; e.dataTransfer.setData("text/plain","bd:"+list.join(",")); e.dataTransfer.effectAllowed="copy";
        if(list.length>1){ var g=document.createElement("div"); g.className="lib-ghost"; g.textContent=list.length+" FRAMES"; document.body.appendChild(g); e.dataTransfer.setDragImage(g,40,16); setTimeout(function(){ g.remove(); },0); } } });
    el.addEventListener("dragover",function(e){ var f=e.target.closest&&e.target.closest(".lib-f.proj"); if(!f) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect="copy"; f.classList.add("hot"); });
    el.addEventListener("dragleave",function(e){ var f=e.target.closest&&e.target.closest(".lib-f.proj"); if(f) f.classList.remove("hot"); });
    el.addEventListener("drop",function(e){ var f=e.target.closest&&e.target.closest(".lib-f.proj"); if(!f) return; e.preventDefault(); e.stopPropagation();
      var n=libAddTo(f.getAttribute("data-lib-f"), libPayload(e)); toast(n?n+" frame"+(n===1?"":"s")+" added to "+libName(f.getAttribute("data-lib-f")):"Already in that project"); libRefresh(); }); }
