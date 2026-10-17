  // ================= IMPORT: drag photos or whole folders from the computer into a library folder =================
  // Drop image files (or a folder of them) onto the library down the left of the Studio, or onto Select's light table,
  // and they land in the folder that's open: a location, a location's picks, a project. Drop onto a folder's row to put
  // them there instead. Dropped into All frames or Picks, a dropped folder becomes a location of its own, named after it.
  // Camera settings come from the files' EXIF where they have it, so imported frames read like shot ones.
  var IMP_MAX=3000;   // long side kept; bigger photos are scaled down so a class's work fits in the browser
  function impZone(t){ if(!t||!t.closest||typeof st==="undefined"||!st.open) return null;
    var row=t.closest(".lib-f[data-lib-f]"); if(row) return {el:row, key:row.getAttribute("data-lib-f")};
    var z=t.closest(".lib-host")||t.closest("#st-select .st-sheet"); return z?{el:z, key:LIB.key}:null; }
  function impHasFiles(e){ var ty=e.dataTransfer&&e.dataTransfer.types; return !!ty&&Array.prototype.indexOf.call(ty,"Files")>=0; }
  var impHot=null;
  function impMark(el,key){ if(impHot===el) return; if(impHot){ impHot.classList.remove("imp-hot"); impHot.removeAttribute("data-imp"); } impHot=el;
    if(el){ el.classList.add("imp-hot"); if(!el.classList.contains("lib-f")) el.setAttribute("data-imp","DROP TO IMPORT INTO "+libName(key).toUpperCase()); } }
  // walk dropped entries (folders included) into a flat list of {file, dir}
  function impCollect(dt, cb){ var items=dt.items?Array.prototype.slice.call(dt.items):[], entries=[], out=[], pending=0, top=null;
    items.forEach(function(it){ var en=it.kind==="file"&&it.webkitGetAsEntry?it.webkitGetAsEntry():null; if(en) entries.push(en); });
    if(!entries.length){ Array.prototype.forEach.call(dt.files||[],function(f){ out.push({file:f, dir:null}); }); cb(out,null); return; }
    entries.forEach(function(en){ if(en.isDirectory&&!top) top=en.name; });
    function done(){ if(--pending===0) cb(out, top); }
    function walk(en, dir){ pending++;
      if(en.isFile){ en.file(function(f){ out.push({file:f, dir:dir}); done(); }, done); return; }
      if(en.isDirectory){ var rd=en.createReader(), all=[];
        (function more(){ rd.readEntries(function(list){ if(list.length){ all=all.concat(Array.prototype.slice.call(list)); more(); return; } all.forEach(function(c){ walk(c, dir||en.name); }); done(); }, done); })(); return; }
      done(); }
    pending++; entries.forEach(function(en){ walk(en, null); }); done(); }
  // camera settings from a JPEG's EXIF block (FNumber, ExposureTime, ISO, FocalLength, Model, DateTimeOriginal)
  function impExif(buf){ try{ var v=new DataView(buf), o=2, n=v.byteLength; if(v.getUint16(0)!==0xFFD8) return null;
      while(o+4<n){ var m=v.getUint16(o), len=v.getUint16(o+2); if(m===0xFFE1&&v.getUint32(o+4)===0x45786966) return impTiff(v,o+10); if((m&0xFF00)!==0xFF00) return null; o+=2+len; }
    }catch(e){} return null; }
  function impTiff(v,t){ var le=v.getUint16(t)===0x4949, u16=function(p){ return v.getUint16(p,le); }, u32=function(p){ return v.getUint32(p,le); }, r={};
    function ifd(p, into){ var cnt=u16(p); for(var i=0;i<cnt;i++){ var e=p+2+i*12, tag=u16(e), type=u16(e+2), num=u32(e+4), vo=e+8, val;
        if(type===5||type===10){ var q=t+u32(vo); val=u32(q)/(u32(q+4)||1); }
        else if(type===3) val=u16(vo); else if(type===4) val=u32(vo);
        else if(type===2){ var sp=num>4?t+u32(vo):vo, s=""; for(var k=0;k<num-1;k++) s+=String.fromCharCode(v.getUint8(sp+k)); val=s.trim(); }
        into[tag]=val; } }
    ifd(t+u32(t+4), r); if(r[0x8769]) ifd(t+r[0x8769], r); return r; }
  function impMeta(x, file){ var m={}; if(!x) return m;
    if(x[0x829D]) m.f=Math.round(x[0x829D]*10)/10;
    if(x[0x829A]){ var s=x[0x829A]; m.sh=s>=0.5?(Math.round(s*10)/10)+'"':"1/"+Math.round(1/s); }
    if(x[0x8827]) m.iso=x[0x8827]; if(x[0x920A]) m.mm=Math.round(x[0x920A]);
    if(x[0x0110]) m.body=String(x[0x0110]).slice(0,40);
    var d=x[0x9003]||x[0x0132]; if(d&&/^\d{4}:\d\d:\d\d \d\d:\d\d/.test(d)){ var t=new Date(d.slice(0,4)+"-"+d.slice(5,7)+"-"+d.slice(8,10)+"T"+d.slice(11,19)); if(!isNaN(t)) m.t=t; }
    return m; }
  function impOne(file, cb){ if(!/^image\//.test(file.type)&&!/\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(file.name)){ cb(null); return; }
    var rd=new FileReader(); rd.onerror=function(){ cb(null); };
    rd.onload=function(){ var meta=impMeta(impExif(rd.result), file), url=URL.createObjectURL(file), img=new Image();
      img.onload=function(){ var w=img.naturalWidth, h=img.naturalHeight, s=Math.min(1, IMP_MAX/Math.max(w,h)), c=document.createElement("canvas");
        c.width=Math.max(1,Math.round(w*s)); c.height=Math.max(1,Math.round(h*s)); var x=c.getContext("2d"); x.fillStyle="#000"; x.fillRect(0,0,c.width,c.height); x.imageSmoothingQuality="high"; x.drawImage(img,0,0,c.width,c.height);
        URL.revokeObjectURL(url); var out=null; try{ out=c.toDataURL("image/jpeg",0.92); }catch(e){} meta.url=out; cb(out?meta:null); };
      img.onerror=function(){ URL.revokeObjectURL(url); cb(null); }; img.src=url; };
    rd.readAsArrayBuffer(file.slice(0, 256*1024)); }
  // where a drop lands: place name, pick flag, project
  function impTarget(key, folderName){ var t={place:folderName||"Imported", pick:false, proj:null};
    if(key.indexOf("place:")===0){ var pl=key.slice(6); if(/\|picks$/.test(pl)){ pl=pl.slice(0,-6); t.pick=true; } t.place=pl; }
    else if(key==="picks") t.pick=true;
    else if(key.indexOf("proj:")===0) t.proj=key;
    return t; }
  function impFiles(list, key, folderName){ list=list.filter(function(o){ return !/^\./.test(o.file.name); })
      .sort(function(a,b){ return (a.dir||"").localeCompare(b.dir||"")||a.file.name.localeCompare(b.file.name,undefined,{numeric:true}); });
    if(!list.length){ toast("Nothing to import there."); return; }
    var T=impTarget(key, folderName), added=[], skipped=0, k=0, n=list.length;
    toast("Importing "+n+" file"+(n===1?"":"s")+"…");
    (function next(){ if(k>=n){ finish(); return; } var o=list[k++];
      impOne(o.file, function(m){ if(!m){ skipped++; next(); return; }
        var p={url:m.url, t:m.t||new Date(o.file.lastModified||Date.now()), f:m.f, sh:m.sh, iso:m.iso, mm:m.mm, body:m.body||"Imported", place:T.place, uploaded:true, imported:true, note:"", pick:T.pick, rating:0};
        photos.push(p); added.push(photos.length-1); if(k%4===0) toast("Importing "+k+" of "+n+"…"); setTimeout(next,0); }); })();
    function finish(){ if(T.proj) libAddTo(T.proj, added);
      if(added.length&&(key==="all"||key==="picks")&&folderName&&T.place===folderName) LIB.key="place:"+folderName;
      if(added.length&&typeof st!=="undefined"&&st.room==="select") st.cur=added[0];
      refreshCount(); saveSession(); if(typeof stRenderBar==="function") stRenderBar(); libRefresh();
      var where=T.proj?libName(T.proj):T.place+(T.pick?" · Picked photos":"");
      toast(added.length?"Imported "+added.length+" photo"+(added.length===1?"":"s")+" into "+where+(skipped?" ("+skipped+" skipped: not photos)":""):"Those weren't photos Studium can open (JPEG, PNG, WebP)."); } }
  // capture phase, so the drop is ours before the page-wide handler (which opens dropped .splat scans)
  document.addEventListener("dragover",function(e){ if(!impHasFiles(e)) return; var z=impZone(e.target); if(!z){ impMark(null); return; }
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect="copy"; impMark(z.el,z.key); }, true);
  document.addEventListener("dragleave",function(e){ if(impHot&&(!e.relatedTarget||!impHot.contains(e.relatedTarget))) impMark(null); }, true);
  document.addEventListener("drop",function(e){ if(!impHasFiles(e)) return; var z=impZone(e.target); impMark(null); if(!z) return;
    e.preventDefault(); e.stopPropagation(); impCollect(e.dataTransfer, function(list, folder){ impFiles(list, z.key, folder); }); }, true);
