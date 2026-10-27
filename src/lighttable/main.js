import * as THREE from 'three';
import { paintPhoto, KINDS, mulberry } from './photos.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ================= open design options (everything else is locked to Sam's picks) ================= */
const OPTS = { board:{ A:'Magnetic rows', B:'Free layout' }, marker:{ A:'Mat', B:'Corner number', C:'Nothing' } };
const LABEL = { board:'Sequence board', marker:'Pair marker' };
const pick = { board:'B', marker:'A' };
const HOST=(()=>{ try{ return window.parent!==window&&window.parent.LT_BRIDGE||null; }catch(e){ return null; } })();
if(!HOST) try{ const s=JSON.parse(localStorage.getItem('lt_pick7')||'null'); if(s) Object.keys(pick).forEach(k=>{ if(s[k]&&OPTS[k][s[k]]) pick[k]=s[k]; }); }catch(e){}
const TOP=78;
const F={ lift:0.55, tiltK:0.10, maxTilt:0.32, k:170, c:13, follow:20, jitter:0.05, sag:0.035 };
const SPEC=[0.10,46,0.035,6];
const $=id=>document.getElementById(id);
if(HOST) document.documentElement.classList.add('in-studium');

/* ================= geometry ================= */
const W_T=42, H_T=24, LAYER=0.024;
const BW=17.4, BH=BW/1.4142, BX=W_T/2-BW/2-1.2, BZ=-0.6, BOARD_Y=0.02;   /* the board keeps A1's 841 × 594 proportions */
const ROWS=4, ROW_X0=BX-BW/2+0.6, GAP=0.24;
const rowZ=i=>BZ-BH/2+BH*(i+0.5)/ROWS;
const SC={ x:-17.4, z:-8.9, w:4.2, d:3.3, h:0.55 };
const GLASS={ x:SC.x-0.38, z:SC.z+0.12, w:2.9, d:2.4 };
const PILE={ x0:-16.4, x1:BX-BW/2-1.5, z0:-6.4, z1:8.0 };
const BOX={ x:-18.6, z:10.2, w:3.3, d:2.7, h:0.75 };
const BINDER={ x:-13.9, z:10.4, w:3.1, d:2.35, h:0.34, rot:0.08 };
const ZX0=SC.x+SC.w/2+1.4, ZX1=W_T/2-1;
const WALL_Z=-H_T/2-0.7, WALL_W=W_T+10, WALL_Y0=-1.2, WALL_Y1=21, WM=0.3, WALL_FLOOR=0.45;
const PINZONE={ z:-H_T/2+0.55, d:0.9 };

/* ================= renderer, scene, camera ================= */
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x1b1a19);
const camera=new THREE.PerspectiveCamera(36, 1, 0.8, 220); scene.add(camera);
const MAXANI=renderer.capabilities.getMaxAnisotropy();
const hemi=new THREE.HemisphereLight(0xffffff, 0x221c16, 0.9); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff1dd, 1.6); sun.position.set(-4,10,6); scene.add(sun);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const radTex=(stops)=>{ const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'); const gr=g.createRadialGradient(128,128,stops[0],128,128,128);
  stops[1].forEach(s=>gr.addColorStop(s[0],s[1])); g.fillStyle=gr; g.fillRect(0,0,256,256); return new THREE.CanvasTexture(c); };
const softShadow=radTex([50,[[0,'rgba(0,0,0,0.55)'],[1,'rgba(0,0,0,0)']]]);
function blobShadow(w,d,parent,ox,oz){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d), new THREE.MeshBasicMaterial({ map:softShadow, transparent:true, depthWrite:false })); m.rotation.x=-Math.PI/2; m.position.set(ox||0.2,0.002,oz||0.3); parent.add(m); return m; }

const floor=new THREE.Mesh(new THREE.PlaneGeometry(400,400), new THREE.MeshBasicMaterial({ color:0x1b1a19 })); floor.rotation.x=-Math.PI/2; floor.position.y=-1.2; scene.add(floor);
const spill=new THREE.Mesh(new THREE.PlaneGeometry(W_T*2.6,H_T*3.2), new THREE.MeshBasicMaterial({ map:radTex([10,[[0,'rgba(255,255,255,1)'],[0.45,'rgba(255,255,255,0.35)'],[1,'rgba(255,255,255,0)']]]), transparent:true, opacity:0.1, depthWrite:false, blending:THREE.AdditiveBlending }));
spill.rotation.x=-Math.PI/2; spill.position.y=-1.19; scene.add(spill);
const bodyMat=new THREE.MeshLambertMaterial({ color:0x1b1a19 });
const tableBody=new THREE.Mesh(new THREE.BoxGeometry(W_T+0.9, 1.15, H_T+0.9), bodyMat); tableBody.position.y=-0.6; scene.add(tableBody);
const rimMat=new THREE.MeshLambertMaterial({ color:0x2e2d2b });
[[0,-(H_T/2+0.2),W_T+0.9,0.4],[0,(H_T/2+0.2),W_T+0.9,0.4],[-(W_T/2+0.2),0,0.4,H_T],[(W_T/2+0.2),0,0.4,H_T]].forEach(([x,z,w,d])=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,0.06,d), rimMat); m.position.set(x,0,z); scene.add(m); });
const surfMat=new THREE.ShaderMaterial({
  uniforms:{ uCol:{value:new THREE.Vector3(0.95,0.95,0.94)}, uSize:{value:new THREE.Vector2(W_T,H_T)} },
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform vec3 uCol; uniform vec2 uSize; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    void main(){ vec2 e=(0.5-abs(vUv-0.5))*uSize; float d=min(e.x,e.y);
      float g=mix(0.74,1.0,smoothstep(0.0,1.6,d)); g*=0.97+0.03*smoothstep(1.0,0.0,length((vUv-0.5)*vec2(1.0,1.6)));
      vec3 c=uCol*g + (h(floor(vUv*uSize*90.0))-0.5)*0.012;
      gl_FragColor=vec4(c,1.0);
      #include <colorspace_fragment>
    }` });
const surface=new THREE.Mesh(new THREE.PlaneGeometry(W_T,H_T), surfMat); surface.rotation.x=-Math.PI/2; scene.add(surface);

/* --- A1 board --- */
const boardCv=document.createElement('canvas'); boardCv.width=2400; boardCv.height=Math.round(2400*BH/BW);
const boardTex=new THREE.CanvasTexture(boardCv); boardTex.colorSpace=THREE.SRGBColorSpace; boardTex.anisotropy=MAXANI;
function drawBoard(){ const g=boardCv.getContext('2d'), W=boardCv.width, H=boardCv.height, sx=W/BW; g.textAlign='left';
  g.fillStyle='#151311'; g.fillRect(0,0,W,H);
  const n=g.createImageData(W,H); for(let i=0;i<n.data.length;i+=4){ const v=(Math.random()*9)|0; n.data[i]=n.data[i+1]=n.data[i+2]=v; n.data[i+3]=60; } const t=document.createElement('canvas'); t.width=W; t.height=H; t.getContext('2d').putImageData(n,0,0); g.globalCompositeOperation='lighter'; g.drawImage(t,0,0); g.globalCompositeOperation='source-over';
  g.strokeStyle='rgba(244,241,234,0.12)'; g.lineWidth=2;
  if(pick.board==='A') for(let r=0;r<ROWS;r++){ const y=(rowZ(r)-(BZ-BH/2))*sx; g.setLineDash([6,14]); g.beginPath(); g.moveTo(0.35*sx,y); g.lineTo(W-0.35*sx,y); g.stroke(); g.setLineDash([]);
    g.fillStyle='rgba(244,241,234,0.32)'; g.font='500 22px "Geist Mono", ui-monospace, monospace'; g.fillText(String(r+1).padStart(2,'0'), 0.14*sx, y+8); }
  else { g.fillStyle='rgba(244,241,234,0.16)'; const st=0.6*sx; for(let x=st;x<W-2;x+=st) for(let y=st;y<H-2;y+=st) g.fillRect(x-1.5,y-1.5,3,3); }
  g.font='500 22px "Geist Mono", ui-monospace, monospace';
  g.strokeStyle='rgba(244,241,234,0.5)'; const k=0.35*sx;
  [[0,0,1,1],[W,0,-1,1],[0,H,1,-1],[W,H,-1,-1]].forEach(([x,y,dx,dy])=>{ g.beginPath(); g.moveTo(x+dx*14,y+dy*(14+k)); g.lineTo(x+dx*14,y+dy*14); g.lineTo(x+dx*(14+k),y+dy*14); g.stroke(); });
  g.fillStyle='rgba(244,241,234,0.36)'; g.textAlign='right'; g.fillText('A1  ·  841 × 594 MM  ·  SEQUENCE BOARD', W-0.4*sx, H-0.18*sx);
  boardTex.needsUpdate=true; }
drawBoard();
const board=new THREE.Mesh(new THREE.BoxGeometry(BW,BOARD_Y,BH), [0,1,2,3,4,5].map(i=>i===2?new THREE.MeshBasicMaterial({ map:boardTex }):new THREE.MeshLambertMaterial({ color:0x0d0c0b })));
board.position.set(BX,BOARD_Y/2,BZ); scene.add(board);
{ const s=new THREE.Mesh(new THREE.PlaneGeometry(BW+1.2,BH+1.2), new THREE.MeshBasicMaterial({ map:radTex([60,[[0,'rgba(0,0,0,0.5)'],[1,'rgba(0,0,0,0)']]]), transparent:true, depthWrite:false })); s.rotation.x=-Math.PI/2; s.position.set(BX+0.12,0.001,BZ+0.18); scene.add(s); }
const ghostCv=document.createElement('canvas'); ghostCv.width=512; ghostCv.height=512; { const g=ghostCv.getContext('2d'); g.fillStyle='rgba(244,241,234,0.08)'; g.fillRect(6,6,500,500); g.strokeStyle='rgba(244,241,234,0.75)'; g.lineWidth=5; g.setLineDash([22,14]); g.strokeRect(6,6,500,500); }
const ghost=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(ghostCv), transparent:true, depthWrite:false }));
ghost.rotation.x=-Math.PI/2; ghost.visible=false; scene.add(ghost);

/* --- reject box --- */
const boxCv=document.createElement('canvas'); boxCv.width=1024; boxCv.height=232;
const boxTex=new THREE.CanvasTexture(boxCv); boxTex.colorSpace=THREE.SRGBColorSpace;
const boxMat=new THREE.MeshLambertMaterial({ color:0x5d4f3e }), boxIn=new THREE.MeshLambertMaterial({ color:0x352c22, side:THREE.DoubleSide });
const boxGroup=new THREE.Group(); scene.add(boxGroup); boxGroup.position.set(BOX.x,0,BOX.z);
{ const t=0.06, H=BOX.h;
  const fl=new THREE.Mesh(new THREE.BoxGeometry(BOX.w,0.04,BOX.d), boxIn); fl.position.y=0.02; boxGroup.add(fl);
  const front=new THREE.Mesh(new THREE.BoxGeometry(BOX.w,H,t), [boxMat,boxMat,boxMat,boxMat,new THREE.MeshLambertMaterial({ map:boxTex }),boxIn]); front.position.set(0,H/2,BOX.d/2); boxGroup.add(front);
  const back=new THREE.Mesh(new THREE.BoxGeometry(BOX.w,H,t), boxMat); back.position.set(0,H/2,-BOX.d/2); boxGroup.add(back);
  [-1,1].forEach(s=>{ const side=new THREE.Mesh(new THREE.BoxGeometry(t,H,BOX.d), boxMat); side.position.set(s*BOX.w/2,H/2,0); boxGroup.add(side); });
  blobShadow(BOX.w+1.4,BOX.d+1.4,boxGroup,0.25,0.35); }
const boxGlow=new THREE.Mesh(new THREE.PlaneGeometry(BOX.w+0.3,BOX.d+0.3), new THREE.MeshBasicMaterial({ color:0xe4552e, transparent:true, opacity:0, depthWrite:false }));
boxGlow.rotation.x=-Math.PI/2; boxGlow.position.set(BOX.x,0.003,BOX.z); scene.add(boxGlow);
function drawBoxLabel(n){ const g=boxCv.getContext('2d'); g.fillStyle='#5d4f3e'; g.fillRect(0,0,1024,232); g.fillStyle='rgba(0,0,0,0.12)'; for(let i=0;i<60;i++) g.fillRect(Math.random()*1024,0,1,232);
  g.fillStyle='#f1ede5'; g.fillRect(250,62,524,108); g.fillStyle='#2a2218'; g.font='600 46px "Geist Mono", ui-monospace, monospace'; g.textAlign='center'; g.fillText('REJECTS  ·  '+n, 512, 132); boxTex.needsUpdate=true; }

/* --- pin-to-wall strip --- */
const zoneCv=document.createElement('canvas'); zoneCv.width=2048; zoneCv.height=96; { const g=zoneCv.getContext('2d'); g.fillStyle='rgba(30,28,26,0.10)'; g.fillRect(4,4,2040,88); g.strokeStyle='rgba(30,28,26,0.55)'; g.lineWidth=3; g.setLineDash([18,12]); g.strokeRect(4,4,2040,88);
  g.fillStyle='rgba(30,28,26,0.75)'; g.font='600 38px "Geist Mono", ui-monospace, monospace'; g.textAlign='center'; g.fillText('↑  DROP HERE TO PIN TO THE WALL  ↑', 1024, 61); }
const zone=new THREE.Mesh(new THREE.PlaneGeometry(ZX1-ZX0,PINZONE.d), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(zoneCv), transparent:true, opacity:0, depthWrite:false }));
zone.rotation.x=-Math.PI/2; zone.position.set((ZX0+ZX1)/2,0.004,PINZONE.z); scene.add(zone);

/* --- the wall: dark studio, no text --- */
const wallCv=document.createElement('canvas'); wallCv.width=4096; wallCv.height=Math.round(4096*(WALL_Y1-WALL_Y0)/WALL_W);
const wallTex=new THREE.CanvasTexture(wallCv); wallTex.colorSpace=THREE.SRGBColorSpace; wallTex.anisotropy=MAXANI;
const WALLS=[['studio','Dark studio'],['cork','Cork'],['white','Gallery white'],['concrete','Concrete'],['ply','Birch ply'],['linen','Linen']];
let wallStyle='studio'; try{ const w=localStorage.getItem('lt_wallstyle'); if(WALLS.some(x=>x[0]===w)) wallStyle=w; }catch(e){}
// tileable value noise, so a 1024px tile repeats across the wall without seams
function makeNoise(seed,P){ const r=mulberry(seed), g=new Float32Array(P*P); for(let i=0;i<g.length;i++) g[i]=r();
  return (x,y)=>{ const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi, X0=((xi%P)+P)%P, Y0=((yi%P)+P)%P, X1=(X0+1)%P, Y1=(Y0+1)%P;
    const a=g[Y0*P+X0], b=g[Y0*P+X1], c=g[Y1*P+X0], d=g[Y1*P+X1], u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }; }
function fbm(n,x,y,oct){ let s=0,a=0.5,f=1,t=0; for(let o=0;o<oct;o++){ s+=a*n(x*f,y*f); t+=a; a*=0.5; f*=2; } return s/t; }
const TILE=1024, TILE_W=12, wallTiles={};
function wallTile(style){ if(wallTiles[style]) return wallTiles[style]; const c=document.createElement('canvas'); c.width=c.height=TILE; const g=c.getContext('2d'), id=g.createImageData(TILE,TILE), D=id.data, S=TILE;
  const n1=makeNoise(11,6), n2=makeNoise(23,64), n3=makeNoise(37,12), n4=makeNoise(51,96), r=mulberry(7);
  const put=(i,R,G,B)=>{ D[i]=R<0?0:R>255?255:R; D[i+1]=G<0?0:G>255?255:G; D[i+2]=B<0?0:B>255?255:B; D[i+3]=255; };
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){ const i=(y*S+x)*4, u=x/S, v=y/S; let R,G,B;
    if(style==='studio'){ const m=fbm(n1,u*6,v*6,5), t=fbm(n3,u*12,v*12*0.25+u*2,3), f=n2(u*64,v*64)-0.5; const k=0.78+0.36*m+0.08*(t-0.5)+0.05*f; R=29*k; G=27*k; B=25*k; }
    else if(style==='white'){ const m=fbm(n1,u*6,v*6,5), f=n4(u*96,v*96)-0.5; const k=0.955+0.07*m+0.018*f; R=238*k; G=235*k; B=229*k; }
    else if(style==='concrete'){ const m=fbm(n1,u*6,v*6,6), d=fbm(n3,u*12,v*12,4), f=n4(u*96,v*96)-0.5; const k=0.74+0.42*m+0.08*(d-0.5)+0.06*f; R=148*k; G=145*k; B=139*k; }
    else if(style==='cork'){ const k=0.9+0.2*fbm(n1,u*6,v*6,3); R=150*k; G=104*k; B=62*k; }
    else if(style==='ply'){ const warp=fbm(n1,u*6,v*6,4), m=fbm(n3,u*12,v*12,3), fine=fbm(n2,u*64*0.25,v*64,2); const s=0.5+0.5*Math.sin((v*58+warp*1.6+fine*0.5)*Math.PI*2), grain=Math.pow(s,16)*0.09+Math.pow(s,3)*0.025;
      const k=(0.95+0.08*m)*(1-grain)+(n4(u*96,v*96)-0.5)*0.025; R=228*k; G=210*k; B=174*k; }
    else { const cx=x%6, cy=y%6, over=((x/6|0)+(y/6|0))%2===0, wv=over?Math.sin(cx/6*Math.PI):Math.sin(cy/6*Math.PI), slub=fbm(n3,u*12*0.2,v*12,3), f=n4(u*96,v*96)-0.5;
      const k=0.84+0.18*wv+0.12*(slub-0.5)+0.05*f; R=72*k; G=80*k; B=92*k; }
    put(i,R,G,B); }
  g.putImageData(id,0,0);
  if(style==='concrete'){ g.strokeStyle='rgba(60,58,54,0.35)'; g.lineWidth=2; g.strokeRect(1,1,S-2,S-2);
    [[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75]].forEach(([a,b])=>{ const x=a*S, y=b*S, gr=g.createRadialGradient(x,y,2,x,y,13); gr.addColorStop(0,'rgba(28,26,24,0.95)'); gr.addColorStop(0.55,'rgba(40,38,35,0.75)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.beginPath(); g.arc(x,y,13,0,7); g.fill(); });
    for(let k=0;k<70;k++){ g.fillStyle='rgba(40,38,35,'+(0.25+r()*0.4)+')'; g.beginPath(); g.arc(r()*S,r()*S,1+r()*2.2,0,7); g.fill(); } }
  if(style==='ply'){ g.fillStyle='rgba(120,92,58,0.45)'; g.fillRect(0,0,S,2); g.fillRect(0,0,2,S);
    [[18,18]].forEach(([x,y])=>{ g.fillStyle='rgba(120,120,118,0.9)'; g.beginPath(); g.arc(x,y,5.5,0,7); g.fill(); g.strokeStyle='rgba(60,60,58,0.9)'; g.lineWidth=1.5; g.beginPath(); g.moveTo(x-3.5,y); g.lineTo(x+3.5,y); g.stroke(); }); }
  if(style==='cork'){ const pal=[[92,56,28],[118,76,40],[150,104,62],[176,128,80],[204,158,104],[222,182,128]], wts=[0.12,0.18,0.24,0.22,0.16,0.08];
    for(let i=0;i<90000;i++){ let q=r(), j=0; while(j<wts.length-1&&q>wts[j]){ q-=wts[j]; j++; } const c=pal[j], x=r()*S, y=r()*S, rx=1.2+r()*r()*5.5, ry=rx*(0.45+r()*0.6), rot=r()*Math.PI;
      g.fillStyle='rgba('+c[0]+','+c[1]+','+c[2]+','+(0.55+r()*0.45)+')';
      for(const ox of (x<8?[0,S]:x>S-8?[0,-S]:[0])) for(const oy of (y<8?[0,S]:y>S-8?[0,-S]:[0])){ g.beginPath(); g.ellipse(x+ox,y+oy,rx,ry,rot,0,7); g.fill(); } }
    for(let i=0;i<5000;i++){ g.fillStyle='rgba(50,30,14,'+(0.3+r()*0.4)+')'; g.beginPath(); g.arc(r()*S,r()*S,0.6+r()*1.4,0,7); g.fill(); } }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=MAXANI; t.repeat.set(WALL_W/TILE_W,(WALL_Y1-WALL_Y0)/TILE_W);
  const th=document.createElement('canvas'); th.width=th.height=72; th.getContext('2d').drawImage(c,0,0,S/3,S/3,0,0,72,72);
  return wallTiles[style]={ tex:t, thumb:th.toDataURL('image/jpeg',0.85) }; }
// light that falls on the wall: warm pools from above, darker towards the floor
const wallShade=(()=>{ const c=document.createElement('canvas'); c.width=1024; c.height=512; const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,512); gr.addColorStop(0,'rgba(0,0,0,0.25)'); gr.addColorStop(0.18,'rgba(0,0,0,0)'); gr.addColorStop(0.6,'rgba(0,0,0,0.06)'); gr.addColorStop(1,'rgba(0,0,0,0.55)'); g.fillStyle=gr; g.fillRect(0,0,1024,512);
  const sg=g.createLinearGradient(0,0,1024,0); sg.addColorStop(0,'rgba(0,0,0,0.45)'); sg.addColorStop(0.12,'rgba(0,0,0,0)'); sg.addColorStop(0.88,'rgba(0,0,0,0)'); sg.addColorStop(1,'rgba(0,0,0,0.45)'); g.fillStyle=sg; g.fillRect(0,0,1024,512); return new THREE.CanvasTexture(c); })();
const wallPools=(()=>{ const c=document.createElement('canvas'); c.width=1024; c.height=512; const g=c.getContext('2d');
  for(let i=0;i<7;i++){ const x=1024*(i+0.5)/7, gr=g.createRadialGradient(x,-40,10,x,170,280); gr.addColorStop(0,'rgba(255,226,180,0.55)'); gr.addColorStop(0.45,'rgba(255,220,170,0.18)'); gr.addColorStop(1,'rgba(255,220,170,0)'); g.fillStyle=gr; g.fillRect(0,0,1024,512); }
  return new THREE.CanvasTexture(c); })();

const wallMat=new THREE.MeshBasicMaterial({ map:wallTile(wallStyle).tex });
const wall=new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_Y1-WALL_Y0), wallMat); wall.position.set(0,(WALL_Y0+WALL_Y1)/2,WALL_Z); scene.add(wall);
const wallShadeM=new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_Y1-WALL_Y0), new THREE.MeshBasicMaterial({ map:wallShade, transparent:true, depthWrite:false })); wallShadeM.position.set(0,(WALL_Y0+WALL_Y1)/2,WALL_Z+0.004); scene.add(wallShadeM);
const wallPoolM=new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_Y1-WALL_Y0), new THREE.MeshBasicMaterial({ map:wallPools, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending })); wallPoolM.position.set(0,(WALL_Y0+WALL_Y1)/2,WALL_Z+0.006); scene.add(wallPoolM);
const POOL={ studio:0.24, white:0.2, concrete:0.3, cork:0.26, ply:0.2, linen:0.3 };
function drawWall(){ wallMat.map=wallTile(wallStyle).tex; wallMat.needsUpdate=true; wallPoolM.material.opacity=POOL[wallStyle]; }
drawWall();

/* --- the copier: a proper flatbed copier with a lid that closes while it scans; prints come out the right side --- */
const scanner=new THREE.Group(); scanner.position.set(SC.x,0,SC.z); scene.add(scanner);
const scanGlow=new THREE.Mesh(new THREE.PlaneGeometry(SC.w+0.6,SC.d+0.6), new THREE.MeshBasicMaterial({ color:0xf4f1ea, transparent:true, opacity:0, depthWrite:false }));
const scanBar=new THREE.Group(); const lidHinge=new THREE.Group(); let lidLeak=null, scanLCD=null, scanLCDcv=null;
{ const std=(c,r,m)=>new THREE.MeshStandardMaterial({ color:c, roughness:r??0.6, metalness:m??0 });
  const shell=std(0xc9c5bd,0.55), shellDark=std(0x4a4743,0.5), trim=std(0x2a2826,0.45), rubber=std(0x161514,0.9);
  const FOOT=0.05, H=SC.h;
  // feet
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>{ const f=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.12,FOOT,16), rubber); f.position.set(a*(SC.w/2-0.3),FOOT/2,b*(SC.d/2-0.3)); scanner.add(f); });
  // lower body (darker plinth) + upper body (light shell), both rounded
  const plinth=new THREE.Mesh(new RoundedBoxGeometry(SC.w,0.16,SC.d,4,0.06), shellDark); plinth.position.y=FOOT+0.08; scanner.add(plinth);
  const body=new THREE.Mesh(new RoundedBoxGeometry(SC.w-0.04,H-0.16,SC.d-0.04,5,0.1), shell); body.position.y=FOOT+0.16+(H-0.16)/2-0.02; scanner.add(body);
  const top=FOOT+H; scanner.userData.top=top;
  // glass well: dark bezel, glass, sheen, ruler marks
  const bez=new THREE.Mesh(new RoundedBoxGeometry(GLASS.w+0.22,0.04,GLASS.d+0.22,3,0.02), trim); bez.position.set(GLASS.x-SC.x,top-0.005,GLASS.z-SC.z); scanner.add(bez);
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(GLASS.w,GLASS.d), new THREE.MeshStandardMaterial({ color:0x0b1113, roughness:0.08, metalness:0.2 })); glass.rotation.x=-Math.PI/2; glass.position.set(GLASS.x-SC.x,top+0.017,GLASS.z-SC.z); scanner.add(glass);
  const sheenCv=document.createElement('canvas'); sheenCv.width=sheenCv.height=256; { const g=sheenCv.getContext('2d'); const gr=g.createLinearGradient(0,0,256,256); gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(0.42,'rgba(255,255,255,0.10)'); gr.addColorStop(0.5,'rgba(255,255,255,0.02)'); gr.addColorStop(0.58,'rgba(255,255,255,0.07)'); gr.addColorStop(0.7,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,256,256);
    g.fillStyle='rgba(244,241,234,0.35)'; for(let i=0;i<=20;i++){ g.fillRect(i*256/20,0,1,i%5?5:10); g.fillRect(0,i*256/20,i%5?5:10,1); } }
  const sheen=new THREE.Mesh(new THREE.PlaneGeometry(GLASS.w,GLASS.d), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(sheenCv), transparent:true, depthWrite:false })); sheen.rotation.x=-Math.PI/2; sheen.position.set(GLASS.x-SC.x,top+0.019,GLASS.z-SC.z); scanner.add(sheen);
  // control panel along the right of the top: LCD, start button, two small buttons, status LED
  const panel=new THREE.Mesh(new RoundedBoxGeometry(0.7,0.05,SC.d-0.5,3,0.02), trim); panel.position.set(SC.w/2-0.42,top+0.005,0); scanner.add(panel);
  scanLCDcv=document.createElement('canvas'); scanLCDcv.width=256; scanLCDcv.height=128; scanLCD=new THREE.CanvasTexture(scanLCDcv); scanLCD.colorSpace=THREE.SRGBColorSpace;
  const lcd=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.25), new THREE.MeshBasicMaterial({ map:scanLCD })); lcd.rotation.x=-Math.PI/2; lcd.position.set(SC.w/2-0.42,top+0.032,-SC.d/2+0.65); scanner.add(lcd);
  const startB=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.05,28), std(0xd9d4ca,0.4)); startB.position.set(SC.w/2-0.42,top+0.04,0.25); scanner.add(startB);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.012,8,36), new THREE.MeshBasicMaterial({ color:0x63c27a })); ring.rotation.x=Math.PI/2; ring.position.set(SC.w/2-0.42,top+0.066,0.25); scanner.add(ring); scanner.userData.led=ring;
  [-0.16,0.16].forEach(dx=>{ const b=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.04,18), std(0x6b6762,0.5)); b.position.set(SC.w/2-0.42+dx,top+0.035,0.75); scanner.add(b); });
  // lid on two hinges at the back; it closes over the glass while scanning
  lidHinge.position.set(0,top+0.05,-SC.d/2+0.06); lidHinge.rotation.x=-1.95; scanner.add(lidHinge);
  const LD=SC.d-0.14, LW=SC.w-0.82;
  const lid=new THREE.Mesh(new RoundedBoxGeometry(LW,0.1,LD,4,0.04), shell); lid.position.set(-0.36,0.05,LD/2); lidHinge.add(lid);
  const lidTrim=new THREE.Mesh(new RoundedBoxGeometry(LW-0.3,0.012,0.08,2,0.005), trim); lidTrim.position.set(-0.36,0.106,LD-0.18); lidHinge.add(lidTrim);
  const pad=new THREE.Mesh(new THREE.PlaneGeometry(LW-0.12,LD-0.12), std(0xf2efe8,0.9)); pad.rotation.x=Math.PI/2; pad.position.set(-0.36,-0.002,LD/2); lidHinge.add(pad);
  [-1,1].forEach(s=>{ const h=new THREE.Mesh(new RoundedBoxGeometry(0.34,0.14,0.18,2,0.03), trim); h.position.set(-0.36+s*(LW/2-0.45),-0.01,0.02); lidHinge.add(h); });
  // light that leaks round the closed lid while scanning
  lidLeak=new THREE.Mesh(new THREE.PlaneGeometry(LW+0.7,LD+0.7), new THREE.MeshBasicMaterial({ map:radTex([60,[[0,'rgba(215,236,255,0.9)'],[0.75,'rgba(215,236,255,0.35)'],[1,'rgba(215,236,255,0)']]]), transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
  lidLeak.rotation.x=-Math.PI/2; lidLeak.position.set(-0.36,top+0.03,-SC.d/2+0.06+LD/2); scanner.add(lidLeak);
  // output slot + small tray on the right side, where copies come out
  const slot=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.05,2.5), new THREE.MeshBasicMaterial({ color:0x050505 })); slot.position.set(SC.w/2+0.003,FOOT+0.3,0.05); scanner.add(slot);
  const tray=new THREE.Mesh(new RoundedBoxGeometry(0.42,0.025,2.5,2,0.01), shellDark); tray.position.set(SC.w/2+0.19,FOOT+0.22,0.05); scanner.add(tray);
  // side vents and a small front label
  const vent=document.createElement('canvas'); vent.width=256; vent.height=64; { const g=vent.getContext('2d'); g.fillStyle='#c9c5bd'; g.fillRect(0,0,256,64); g.fillStyle='#3a3835'; for(let i=0;i<14;i++) g.fillRect(14+i*17,16,8,32); }
  const vm=new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.22), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(vent) })); vm.rotation.y=-Math.PI/2; vm.position.set(-SC.w/2-0.001,FOOT+0.36,0); scanner.add(vm);
  const lab=document.createElement('canvas'); lab.width=512; lab.height=96; { const g=lab.getContext('2d'); g.fillStyle='#c9c5bd'; g.fillRect(0,0,512,96); g.fillStyle='rgba(30,28,26,0.7)'; g.font='600 34px "Geist Mono", ui-monospace, monospace'; g.fillText('STUDIUM  COPY', 16, 60); }
  const lt=new THREE.CanvasTexture(lab); lt.colorSpace=THREE.SRGBColorSpace; const lm=new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.28), new THREE.MeshBasicMaterial({ map:lt })); lm.position.set(-SC.w/2+0.95,FOOT+0.36,SC.d/2+0.001); scanner.add(lm);
  blobShadow(SC.w+1.5,SC.d+1.5,scanner,0.25,0.35);
  // the moving scan light under the glass
  const bar=new THREE.Mesh(new THREE.PlaneGeometry(0.07,GLASS.d), new THREE.MeshBasicMaterial({ color:0xeaf6ff })); bar.rotation.x=-Math.PI/2; scanBar.add(bar);
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(0.9,GLASS.d+0.3), new THREE.MeshBasicMaterial({ map:radTex([0,[[0,'rgba(210,235,255,0.9)'],[1,'rgba(210,235,255,0)']]]), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending })); halo.rotation.x=-Math.PI/2; scanBar.add(halo);
  scanBar.position.set(GLASS.x,top+0.022,GLASS.z); scanBar.visible=false; scene.add(scanBar); }
function drawLCD(text){ const g=scanLCDcv.getContext('2d'); g.fillStyle='#16201b'; g.fillRect(0,0,256,128); g.fillStyle='rgba(160,230,180,0.9)'; g.font='600 34px "Geist Mono", ui-monospace, monospace'; g.fillText(text,18,58); g.font='500 20px "Geist Mono", ui-monospace, monospace'; g.fillStyle='rgba(160,230,180,0.5)'; g.fillText('A4  ·  1:1  ·  LUSTRE',18,98); scanLCD.needsUpdate=true; }
drawLCD('READY');
scanGlow.rotation.x=-Math.PI/2; scanGlow.position.set(SC.x,0.003,SC.z); scene.add(scanGlow);

/* ================= prints ================= */
const shadowTex=(()=>{ const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'); g.filter='blur(14px)'; g.fillStyle='#000'; g.fillRect(34,34,188,188); return new THREE.CanvasTexture(c); })();
const printVS=`uniform float uBow; uniform vec2 uHalf; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main(){ vUv=uv; vec3 p=position; float nx=p.x/uHalf.x, nz=p.z/uHalf.y;
    p.y+=uBow*(0.6*nx*nx+0.4*nz*nz);
    vec3 n=normalize(vec3(-uBow*1.2*nx/uHalf.x,1.0,-uBow*0.8*nz/uHalf.y));
    vN=normalize(mat3(modelMatrix)*n); vec4 w=modelMatrix*vec4(p,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const printFS=`uniform sampler2D map; uniform vec3 uLamp; uniform vec4 uSpec; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main(){ vec3 N=normalize(vN); vec3 col;
    if(gl_FrontFacing){ col=texture2D(map,vUv).rgb; } else { col=vec3(0.80,0.78,0.74); N=-N; }
    vec3 V=normalize(cameraPosition-vW), L=normalize(uLamp-vW), H=normalize(L+V); float nh=max(dot(N,H),0.0);
    float spec=uSpec.x*pow(nh,uSpec.y)+uSpec.z*pow(nh,uSpec.w);
    vec3 c=col*(0.9+0.1*max(N.y,N.z))+vec3(spec)*vec3(1.0,0.97,0.92);
    gl_FragColor=vec4(c,1.0);
    #include <colorspace_fragment>
  }`;
const lamp=new THREE.Vector3(0,4,2);
const prints=[]; let orderN=0, idN=0;
function borderCanvas(img, longPx, number){
  const iw=img.width, ih=img.height, land=iw>=ih, b=Math.round(longPx*0.045);
  const W=land?longPx:Math.round(longPx*iw/ih), H=land?Math.round(longPx*ih/iw):longPx;
  const c=document.createElement('canvas'); c.width=W+b*2; c.height=H+b*2; const g=c.getContext('2d');
  g.fillStyle='#f1ede5'; g.fillRect(0,0,c.width,c.height); g.drawImage(img,b,b,W,H);
  g.strokeStyle='rgba(0,0,0,0.25)'; g.lineWidth=1; g.strokeRect(b+0.5,b+0.5,W-1,H-1);
  if(number){ g.fillStyle='rgba(60,55,50,0.45)'; g.font=Math.round(b*0.42)+'px "Geist Mono", ui-monospace, monospace'; g.textAlign='right'; g.fillText(number, c.width-b, c.height-b*0.35); }
  return c;
}
function makeTex(c){ const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=MAXANI; t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; return t; }
const pinHead=new THREE.MeshLambertMaterial({ color:0xb89a5e }), pinMetal=new THREE.MeshLambertMaterial({ color:0x9a9590 });
const pinGeo=new THREE.SphereGeometry(0.036,14,10), neckGeo=new THREE.CylinderGeometry(0.012,0.012,0.05,8);
function makePins(w,h){ const g=new THREE.Group(), top=-h/2; [-1,1].forEach(s=>{ const hd=new THREE.Mesh(pinGeo,pinHead); hd.position.set(s*(w/2-0.13),0.06,top+0.13); const nk=new THREE.Mesh(neckGeo,pinMetal); nk.position.set(s*(w/2-0.13),0.025,top+0.13); g.add(hd,nk); }); g.visible=false; return g; }
function printStats(cv){ const s=document.createElement('canvas'); s.width=s.height=16; const g=s.getContext('2d'); const b=cv.width*0.06; g.drawImage(cv,b,b,cv.width-2*b,cv.height-2*b,0,0,16,16);
  const d=g.getImageData(0,0,16,16).data; let r=0,gg=0,bb=0,l=0; for(let i=0;i<d.length;i+=4){ r+=d[i]; gg+=d[i+1]; bb+=d[i+2]; l+=0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; }
  const n=d.length/4; return { r:r/n, g:gg/n, b:bb/n, lum:l/n/255 }; }
function addPrint(cnv, longWorld, kind, id){
  const aspect=cnv.width/cnv.height, w=aspect>=1?longWorld:longWorld*aspect, h=aspect>=1?longWorld/aspect:longWorld;
  const geo=new THREE.PlaneGeometry(w,h,14,14); geo.rotateX(-Math.PI/2);
  const mat=new THREE.ShaderMaterial({ uniforms:{ map:{value:makeTex(cnv)}, uBow:{value:0.01}, uHalf:{value:new THREE.Vector2(w/2,h/2)}, uLamp:{value:lamp}, uSpec:{value:new THREE.Vector4(...SPEC)} },
    vertexShader:printVS, fragmentShader:printFS, side:THREE.DoubleSide });
  const mesh=new THREE.Mesh(geo,mat); const group=new THREE.Group(); group.add(mesh); scene.add(group);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(w*1.33,h*1.33), new THREE.MeshBasicMaterial({ map:shadowTex, transparent:true, depthWrite:false, opacity:0.4 }));
  shadow.rotation.order='YXZ'; scene.add(shadow);
  const p={ id, mesh, group, mat, shadow, w, h, w0:w, h0:h, szi:1, x:0, z:0, tx:0, tz:0, yaw:0, yawT:0, base:0, y:LAYER*0.5, vy:0, tiltX:0, tiltZ:0, vx:0, vz:0, order:++orderN, insp:0, inspT:0, kind, canvas:cnv, scale:1,
    onBoard:false, rejected:false, wg:null, wallA:0, wx:0, wy:0, locked:false, stats:printStats(cnv) };
  p.pins=makePins(w,h); group.add(p.pins);
  mesh.userData.p=p; prints.push(p); return p;
}
const byId=id=>prints.find(p=>p.id===id);
const SIZES=[0.72,1,1.35,1.75], SIZE_NAMES=['Small','Medium','Large','Extra large'];
function setSize(p,i){ i=THREE.MathUtils.clamp(i,0,SIZES.length-1); if(i===p.szi) return; p.szi=i; const k=SIZES[i]; p.w=p.w0*k; p.h=p.h0*k;
  p.mesh.geometry.dispose(); const geo=new THREE.PlaneGeometry(p.w,p.h,14,14); geo.rotateX(-Math.PI/2); p.mesh.geometry=geo; p.mat.uniforms.uHalf.value.set(p.w/2,p.h/2);
  p.shadow.geometry.dispose(); p.shadow.geometry=new THREE.PlaneGeometry(p.w*1.33,p.h*1.33);
  p.group.remove(p.pins); p.pins=makePins(p.w,p.h); p.group.add(p.pins); }
function resizePrint(p,d){ if(!p||p.locked) return; const to=THREE.MathUtils.clamp((p.szi??1)+d,0,SIZES.length-1); if(to===p.szi){ toast(d>0?'That\u2019s the biggest print size.':'That\u2019s the smallest print size.'); return; }
  pushUndo(); setSize(p,to); if(p.wg) layoutGroup(p.wg); if(p.rejected) layoutRejects(); if(p.onBoard){ if(FREE()){ const t=freeTarget(p,p.tx,p.tz); p.tx=t.x; p.tz=t.z; } else layoutRows(null); }
  restack(); updateChains(false); saveAll(); tourEv('size'); toast('Print size: '+SIZE_NAMES[p.szi]+'.','Undo',undo); }

/* ================= the library (Studium's folders: locations, picks, projects) ================= */
const library=[], PROJ=[];
function libAdd(canvas, kind, long, id, data){ const it={ id:id||('lt'+(++idN)), canvas, kind, long, data:data||null, thumb:null, name:'', place:'Uploads', pick:false, copyOf:null, url:null, sample:false }; library.push(it); return it; }
const libById=id=>library.find(i=>i.id===id);
function ensurePrint(id){ const p=byId(id); if(p) return p; const it=libById(id); if(!it||!it.canvas) return null; return addPrint(it.canvas, it.long, it.kind, it.id); }
function itemStatus(it){ const p=byId(it.id); if(!p||p.locked&&p.tx===BINDER.x) return 'in'; if(p.wg) return 'wall'; if(p.rejected) return 'rejects'; if(p.onBoard) return 'board'; return 'table'; }
function rawRemove(p){ scene.remove(p.group); scene.remove(p.shadow); p.mat.uniforms.map.value.dispose(); p.mesh.geometry.dispose(); const i=prints.indexOf(p); if(i>=0) prints.splice(i,1); if(HOV.p===p) HOV.p=null; }
function removePrint(p){ removeFromBoard(p); const ri=rejects.indexOf(p); if(ri>=0){ rejects.splice(ri,1); layoutRejects(); drawBoxLabel(rejects.length); drawBoxBtn(); } rawRemove(p); layoutBoard(null); restack(); updateChains(false); drawBinderCover(); }
function folders(){ const f=[{ key:'all', name:'All frames', kind:'all' },{ key:'picks', name:'Picks', kind:'picks' }], places=[];
  library.forEach(i=>{ if(!places.includes(i.place)) places.push(i.place); });
  places.forEach(pl=>{ f.push({ key:'place:'+pl, name:pl, kind:'place' }); if(library.some(i=>i.place===pl&&i.pick)) f.push({ key:'place:'+pl+'|picks', name:'Picked', kind:'sub' }); });
  PROJ.forEach(pr=>f.push({ key:'proj:'+pr.id, name:pr.name, kind:'proj' })); return f; }
function folderItems(key){ if(key==='picks') return library.filter(i=>i.pick);
  if(key.startsWith('place:')){ let pl=key.slice(6); const pk=pl.endsWith('|picks'); if(pk) pl=pl.slice(0,-6); return library.filter(i=>i.place===pl&&(!pk||i.pick)); }
  if(key.startsWith('proj:')){ const pr=PROJ.find(x=>'proj:'+x.id===key); return pr?pr.ids.map(libById).filter(Boolean):[]; }
  return library; }
function folderName(key){ const f=folders().find(x=>x.key===key); if(!f) return 'All frames'; if(f.kind==='sub') return key.slice(6,-6)+' · Picked'; return f.name; }

const rnd=mulberry(7), photoCanvases=[];
function seedLibrary(sample){
  for(let i=0;i<(sample?12:30);i++){
    const kind=KINDS[i%KINDS.length], shape=rnd(); let W=1024,H=683; if(shape<0.2){ W=683; H=1024; } else if(shape<0.3){ W=900; H=900; }
    const img=paintPhoto(kind, 100+i*13, W, H, rnd()<0.22 || kind==='forest'); photoCanvases.push(img);
    const it=libAdd(borderCanvas(img, 1024, 'No. '+String(i+1).padStart(2,'0')), 'print', W<H?2.35:2.2, sample?'s'+(i+1):null); it.raw=img; it.name='No. '+String(i+1).padStart(2,'0');
    it.place=i%3===2?'Car Park':'Stump'; it.pick=[1,4,6,10,13,17,22,25,26].includes(i); if(sample){ it.place='Samples'; it.pick=false; it.sample=true; } }
  if(sample) return;
  const s0=libAdd(contactSheet(0),'sheet',3.3); s0.name='Roll 3'; s0.place='Stump'; const s1=libAdd(contactSheet(1),'sheet',3.3); s1.name='Roll 4'; s1.place='Car Park';
  PROJ.push({ id:'edges', name:'Edges of things', ids:[3,8,14,20,27].map(i=>library[i].id) }, { id:'low', name:'Low light', ids:[5,11,19,23,28].map(i=>library[i].id) });
}
function contactSheet(n){
  const c=document.createElement('canvas'); c.width=1400; c.height=1700; const g=c.getContext('2d'); g.fillStyle='#f3f0ea'; g.fillRect(0,0,c.width,c.height);
  const rows=6, cols=5, fw=232, fh=156, sx=70, sy=120, r=mulberry(50+n);
  g.fillStyle='#2a2622'; g.font='600 30px "Geist Mono", ui-monospace, monospace'; g.fillText('ROLL '+(n+3)+'  ·  '+(n?'CAR PARK':'STUMP')+'  ·  HP5+ 400', sx, 72);
  for(let ro=0; ro<rows; ro++){ const y=sy+ro*250; g.fillStyle='#0e0d0c'; g.fillRect(sx-24,y-34,cols*fw+cols*14+34,fh+70);
    for(let k=0;k<cols*7;k++){ g.fillStyle='#e8e2d4'; g.fillRect(sx-14+k*36,y-26,16,11); g.fillRect(sx-14+k*36,y+fh+18,16,11); }
    for(let co=0; co<cols; co++){ const x=sx+co*(fw+14), src=photoCanvases[(n*11+ro*cols+co)%photoCanvases.length];
      const o=document.createElement('canvas'); o.width=fw; o.height=fh; const og=o.getContext('2d'); og.filter='grayscale(1) contrast(1.15)';
      const sc=Math.max(fw/src.width, fh/src.height); og.drawImage(src,(fw-src.width*sc)/2,(fh-src.height*sc)/2,src.width*sc,src.height*sc);
      g.drawImage(o,x,y); g.fillStyle='#e7a44a'; g.font='18px "Geist Mono", ui-monospace, monospace'; g.fillText((ro*cols+co+1)+'A', x+4, y+fh+44); } }
  g.strokeStyle='rgba(206,40,34,0.85)'; g.lineWidth=7; g.lineCap='round';
  for(let i=0;i<3;i++){ const ro=(r()*rows)|0, co=(r()*cols)|0, x=sx+co*(fw+14)+fw/2, y=sy+ro*250+fh/2; g.beginPath();
    for(let a=0;a<=1.08;a+=0.02){ const t=a*Math.PI*2; g.lineTo(x+Math.cos(t)*(fw*0.62+Math.sin(t*3)*6), y+Math.sin(t)*(fh*0.68+Math.cos(t*2)*5)); } g.stroke(); }
  return c;
}
const loose=p=>!p.onBoard&&!p.rejected&&!p.wg&&!p.locked;
function toPile(p){ p.order=++orderN; p.tx=PILE.x0+Math.random()*(PILE.x1-PILE.x0); p.tz=PILE.z0+Math.random()*(PILE.z1-PILE.z0); p.yawT=(Math.random()-0.5)*0.9; }
function scatter(instant){ const L=prints.filter(loose).sort(()=>Math.random()-0.5); L.forEach(p=>{ toPile(p); if(instant){ p.x=p.tx; p.z=p.tz; p.yaw=p.yawT; } }); restack(); if(instant) prints.forEach(p=>{ p.y=p.base+LAYER*0.5; }); }

/* ================= board rows ================= */
const rows=[[],[],[],[]], freeB=[];
const FREE=()=>pick.board==='B';
function removeFromBoard(p){ rows.forEach(r=>{ const i=r.indexOf(p); if(i>=0) r.splice(i,1); }); const fi=freeB.indexOf(p); if(fi>=0) freeB.splice(fi,1); p.onBoard=false; }
function boardContains(x,z,pad){ return Math.abs(x-BX)<BW/2+(pad||0) && Math.abs(z-BZ)<BH/2+(pad||0); }
function rowTarget(x,z,p){ const r=THREE.MathUtils.clamp(Math.floor((z-(BZ-BH/2))/(BH/ROWS)),0,ROWS-1); const L=rows[r].filter(q=>q!==p); let i=0; while(i<L.length&&L[i].tx<x) i++; return { row:r, index:i }; }
function placeOnBoard(p,row,index){ removeFromBoard(p); p.onBoard=true; p.yawT=0; rows[row].splice(Math.min(index,rows[row].length),0,p); }
function placeFree(p,x,z){ removeFromBoard(p); p.onBoard=true; p.yawT=0; p.tx=x; p.tz=z; p.base=BOARD_Y; freeB.push(p); }
const SNAP=0.2;
function freeTarget(p,x,z){ const sn=v=>Math.round(v/SNAP)*SNAP; let tx=sn(x), tz=sn(z), bx=0.34, bz=0.34;
  freeB.forEach(q=>{ if(q===p) return; const ql=q.tx-q.w/2, qr=q.tx+q.w/2, qt=q.tz-q.h/2, qb=q.tz+q.h/2;
    [qr+GAP+p.w/2, ql-GAP-p.w/2, ql+p.w/2, qr-p.w/2, q.tx].forEach(c=>{ const d=Math.abs(c-x); if(d<bx){ bx=d; tx=c; } });
    [qb+GAP+p.h/2, qt-GAP-p.h/2, qt+p.h/2, qb-p.h/2, q.tz].forEach(c=>{ const d=Math.abs(c-z); if(d<bz){ bz=d; tz=c; } }); });
  tx=THREE.MathUtils.clamp(tx,BX-BW/2+p.w/2+0.15,BX+BW/2-p.w/2-0.15); tz=THREE.MathUtils.clamp(tz,BZ-BH/2+p.h/2+0.15,BZ+BH/2-p.h/2-0.15);
  return { x:tx, z:tz, w:p.w, h:p.h, free:true }; }
function touching(a,b){ const gx=Math.abs(a.tx-b.tx)-(a.w+b.w)/2, gz=Math.abs(a.tz-b.tz)-(a.h+b.h)/2;
  if(gx>-0.06&&gx<0.6&&-gz>0.3*Math.min(a.h,b.h)) return true; if(gz>-0.06&&gz<0.6&&-gx>0.3*Math.min(a.w,b.w)) return true; return false; }
function freeGroups(){ const L=freeB.slice(), seen=new Set(), out=[];
  L.forEach(s=>{ if(seen.has(s)) return; const comp=[], st=[s]; seen.add(s); while(st.length){ const a=st.pop(); comp.push(a); L.forEach(b=>{ if(!seen.has(b)&&touching(a,b)){ seen.add(b); st.push(b); } }); }
    if(comp.length>=2){ const band=Math.min(...comp.map(p=>p.h))*0.5; comp.sort((a,b)=>Math.abs(a.tz-b.tz)<band?a.tx-b.tx:a.tz-b.tz); out.push(comp); } });
  return out; }
function switchBoardMode(){ if(FREE()){ rows.forEach(r=>{ r.forEach(p=>freeB.push(p)); r.length=0; }); }
  else { const L=freeB.splice(0); L.sort((a,b)=>a.tx-b.tx); L.forEach(p=>{ const r=THREE.MathUtils.clamp(Math.floor((p.tz-(BZ-BH/2))/(BH/ROWS)),0,ROWS-1); rows[r].push(p); }); layoutRows(null); }
  drawBoard(); restack(); updateChains(false); }
function layoutBoard(pv){ if(!FREE()) layoutRows(pv); }
function layoutRows(pv){ rows.forEach((r,ri)=>{ const items=r.slice(); const ws=items.map(p=>p.w); if(pv&&pv.row===ri) ws.splice(pv.index,0,pv.w);
  const tot=ws.reduce((a,b)=>a+b,0), gap=Math.max(0.06,Math.min(GAP,(BW-1.2-tot)/Math.max(1,ws.length-1))); let x=ROW_X0, k=0;
  ws.forEach((w,wi)=>{ const cx=x+w/2; if(pv&&pv.row===ri&&wi===pv.index){ pv.x=cx; pv.z=rowZ(ri); } else { const p=items[k++]; p.tx=cx; p.tz=rowZ(ri); p.yawT=0; p.base=BOARD_Y; } x+=w+gap; }); }); }

/* ================= reject box ================= */
const rejects=[];
function inBox(x,z){ return Math.abs(x-BOX.x)<BOX.w/2+0.2 && Math.abs(z-BOX.z)<BOX.d/2+0.2; }
function reject(p){ removeFromBoard(p); if(!rejects.includes(p)) rejects.push(p); p.rejected=true; layoutRejects(); drawBoxLabel(rejects.length); drawBoxBtn(); layoutBoard(null); restack(); updateChains(false); saveAll(); tourEv('reject'); }
function unreject(p){ const i=rejects.indexOf(p); if(i>=0) rejects.splice(i,1); p.rejected=false; layoutRejects(); drawBoxLabel(rejects.length); drawBoxBtn(); }
function layoutRejects(){ const r=mulberry(3); rejects.forEach((p,i)=>{ p.tx=BOX.x+(r()-0.5)*Math.max(0,BOX.w-p.w*0.95-0.1); p.tz=BOX.z+(r()-0.5)*Math.max(0,BOX.d-p.h*0.95-0.1); p.yawT=(r()-0.5)*0.35; p.base=0.04+i*LAYER; p.order=i; }); }

/* ================= wall ================= */
const wallGroups=[]; let wgN=0;
function groupWidth(g){ return g.members.reduce((a,p)=>a+p.w,0)+0.28*(g.members.length-1); }
function groupHeight(g){ return Math.max(...g.members.map(p=>p.h)); }
function clampGroup(g){ const w=groupWidth(g)/2, h=groupHeight(g)/2; g.x=THREE.MathUtils.clamp(g.x,-WALL_W/2+WM+w,WALL_W/2-WM-w); g.y=THREE.MathUtils.clamp(g.y,WALL_FLOOR+h,WALL_Y1-WM-h); }
function layoutGroup(g){ clampGroup(g); let x=g.x-groupWidth(g)/2; g.members.forEach(p=>{ p.wx=x+p.w/2; p.wy=g.y; x+=p.w+0.28; }); }
function rectOf(g,pad){ const w=groupWidth(g), h=groupHeight(g); return { x0:g.x-w/2-pad, x1:g.x+w/2+pad, y0:g.y-h/2-pad, y1:g.y+h/2+pad }; }
function freeSpot(g){ const w=groupWidth(g), h=groupHeight(g), cx=wallFocusX(), cy=9; let best=null, bd=1e9;
  for(let y=WALL_FLOOR+h/2+0.4; y<=WALL_Y1-WM-h/2; y+=0.5) for(let x=-WALL_W/2+WM+w/2; x<=WALL_W/2-WM-w/2; x+=0.5){
    const a=rectOf({ ...g, x, y },0.35); if(!(a.x1<SHELF.x-SHELF.w/2-0.3||a.x0>SHELF.x+SHELF.w/2+0.3||a.y0>SHELF.y+0.9)) continue; if(!(a.x1<SW.x-2.6||a.x0>SW.x+2.6||a.y1<SW.y-1.3)) continue; if(!wallGroups.every(o=>{ if(o===g) return true; const b=rectOf(o,0.35); return a.x1<b.x0||b.x1<a.x0||a.y1<b.y0||b.y1<a.y0; })) continue;
    const d=(x-cx)*(x-cx)+(y-cy)*(y-cy)*2; if(d<bd){ bd=d; best={ x, y }; } }
  return best||{ x:cx, y:cy }; }
function wallFocusX(){ if(!wallGroups.length) return -2; return wallGroups.reduce((a,g)=>a+g.x,0)/wallGroups.length; }
function pinGroup(members, note, kind, at, silent){
  members.forEach(p=>{ removeFromBoard(p); if(p.rejected) unreject(p); });
  const g={ id:++wgN, members:members.slice(), note:note?{ why:new Set(note.why), text:note.text||'' }:null, kind, date:new Date().toLocaleDateString('en-NZ',{ day:'numeric', month:'short' }), x:0, y:0 };
  members.forEach(p=>{ p.wg=g; p.inspT=0; });
  const s=at||freeSpot(g); g.x=s.x; g.y=s.y; wallGroups.push(g); layoutGroup(g);
  layoutBoard(null); restack(); updateChains(false); saveAll(); if(!silent&&kind!=='single'){ tourEv('pin'); if(wallSeries()>=2) tourEv('pin2'); }
  if(!silent) toast((kind==='single'?'Pinned to the wall.':'Pinned the '+(kind==='pair'?'pair':'sequence')+' to the wall.')+' Press W to see it.', 'Undo', undo);
  return g; }
function unlink(g){ pushUndo(); const i=wallGroups.indexOf(g); if(i<0) return; wallGroups.splice(i,1);
  g.members.forEach(p=>{ const ng={ id:++wgN, members:[p], note:null, kind:'single', date:g.date, x:p.wx, y:p.wy }; p.wg=ng; wallGroups.push(ng); layoutGroup(ng); });
  hideActs(); saveAll(); toast('Unlinked. Each print moves on its own now.','Undo',undo); }
function unpin(g){ g.members.forEach(p=>{ p.wg=null; toPile(p); }); wallGroups.splice(wallGroups.indexOf(g),1); hideActs(); restack(); saveAll(); }

/* ================= saving: the whole table, wall and binder state, to Studium's session (or this browser) ================= */
const SAVE='lt_v6', HIST_KEY='lt_wallhist_v5', BOOK_KEY='lt_book_v5';
let LOADING=false, saveT=0;
function serialize(){ return { v:2, idN,
  out:prints.filter(p=>!(p.locked&&p.tx===BINDER.x)).map(p=>({ id:p.id, x:+p.tx.toFixed(3), z:+p.tz.toFixed(3), r:+(p.yawT||0).toFixed(3), s:p.szi })),
  free:freeB.map(p=>p.id), rows:rows.map(r=>r.map(p=>p.id)), rejects:rejects.map(p=>p.id),
  walls:wallGroups.map(g=>({ ids:g.members.map(p=>p.id), x:g.x, y:g.y, kind:g.kind, date:g.date, note:g.note?{ why:[...g.note.why], text:g.note.text }:null })),
  strings:strSnap(), copies:library.filter(i=>i.copyOf).map(i=>({ id:i.id, copyOf:i.copyOf, name:i.name })),
  notes:[...notes].map(([k,n])=>[k,{ why:[...n.why], text:n.text||'' }]), hist:hist.slice(-20), wallStyle, stringsOn, tour:TOUR.done,
  samples:library.some(i=>i.sample), adopted:library.filter(i=>i.sample&&i.realId).map(i=>[i.id,i.realId]) }; }
function saveAll(){ if(LOADING) return; clearTimeout(saveT); saveT=setTimeout(saveNow,350); }
function saveNow(){ if(LOADING||!READY) return; const s=serialize();
  if(HOST){ try{ HOST.save(s); }catch(e){} return; }
  try{ s.own=library.filter(i=>i.kind==='own'&&i.data).slice(-24).map(i=>({ id:i.id, data:i.data, long:i.long, name:i.name })); localStorage.setItem(SAVE, JSON.stringify(s)); }catch(e){} }
function applyState(s, cb){ if(!s||s.v!==2){ cb(false); return; } LOADING=true;
  if(typeof s.idN==='number') idN=Math.max(idN,s.idN);
  (s.copies||[]).forEach(c=>{ const src=libById(c.copyOf); if(!src||libById(c.id)) return; const it=libAdd(null,src.kind,src.long,c.id); it.copyOf=c.copyOf; it.name=c.name; it.place=src.place; it.url=src.url; });
  const ids=[...new Set((s.out||[]).map(o=>o.id))].filter(id=>libById(id));
  prepare(ids,()=>{
    (s.out||[]).forEach(o=>{ const p=ensurePrint(o.id); if(!p) return; setSize(p,o.s??1); p.tx=p.x=o.x; p.tz=p.z=o.z; p.yawT=p.yaw=o.r||0; });
    (s.rows||[]).forEach((r,i)=>r.forEach(id=>{ const p=byId(id); if(p&&rows[i]){ rows[i].push(p); p.onBoard=true; p.base=BOARD_Y; p.yawT=p.yaw=0; } }));
    (s.free||[]).forEach(id=>{ const p=byId(id); if(p&&!p.onBoard){ freeB.push(p); p.onBoard=true; p.base=BOARD_Y; p.yawT=p.yaw=0; } });
    (s.rejects||[]).forEach(id=>{ const p=byId(id); if(p){ rejects.push(p); p.rejected=true; } }); layoutRejects(); drawBoxLabel(rejects.length);
    (s.walls||[]).forEach(w=>{ const m=w.ids.map(byId).filter(Boolean); if(!m.length) return; const g=pinGroup(m,w.note,w.kind,{ x:w.x, y:w.y },true); g.date=w.date||g.date; m.forEach(p=>p.wallA=1); });
    setStrings(s.strings); notes.clear(); (s.notes||[]).forEach(([k,n])=>notes.set(k,{ why:new Set(n.why||[]), text:n.text||'' }));
    if(s.hist){ hist.length=0; s.hist.forEach(e=>hist.push(e)); }
    if(s.wallStyle&&WALLS.some(w=>w[0]===s.wallStyle)){ wallStyle=s.wallStyle; drawWall(); buildWallPick(); }
    if(s.stringsOn===false) setStringsOn(false);
    TOUR.done=!!s.tour;
    layoutBoard(null); restack(); prints.forEach(p=>{ if(!p.wg) p.y=p.base+LAYER*0.5; });
    LOADING=false; cb(true); }); }
function loadLocal(done){ let d=null; try{ d=JSON.parse(localStorage.getItem(SAVE)||'null'); }catch(e){} if(!d){ done(false); return; }
  const owns=d.own||[]; let left=owns.length; const fin=()=>applyState(d,done);
  if(!left) fin(); else owns.forEach(o=>{ const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; c.getContext('2d').drawImage(img,0,0); const it=libAdd(c,'own',o.long,o.id,o.data); it.name=o.name||'Imported'; it.place='Uploads'; if(--left===0) fin(); }; img.onerror=()=>{ if(--left===0) fin(); }; img.src=o.data; }); }

/* ================= photos load when they're needed (Studium can hold hundreds) ================= */
function loadItem(it,cb){ if(it.canvas){ cb(); return; }
  if(it.copyOf){ const s=libById(it.copyOf); if(s){ loadItem(s,()=>{ it.canvas=s.canvas; it.long=s.long; cb(); }); return; } }
  const img=new Image(); img.onload=()=>{ it.canvas=borderCanvas(img,900,null); it.long=img.width<img.height?2.35:2.2; cb(); };
  img.onerror=()=>{ const c=document.createElement('canvas'); c.width=900; c.height=620; const g=c.getContext('2d'); g.fillStyle='#f1ede5'; g.fillRect(0,0,900,620); g.fillStyle='#bdb8ae'; g.fillRect(40,40,820,540); it.canvas=c; it.long=2.2; cb(); };
  img.src=it.url; }
function prepare(ids,cb){ const L=ids.map(libById).filter(Boolean); let left=L.length; if(!left){ cb(); return; } L.forEach(it=>loadItem(it,()=>{ if(--left===0) cb(); })); }

/* ================= undo ================= */
const undoStack=[];
function snap(){ return { lib:library.map(i=>i.id), prints:prints.filter(p=>!(p.locked&&p.tx===BINDER.x)).map(p=>({ id:p.id, tx:p.tx, tz:p.tz, yawT:p.yawT, order:p.order, szi:p.szi })), rows:rows.map(r=>r.map(p=>p.id)), free:freeB.map(p=>p.id), rejects:rejects.map(p=>p.id),
  walls:wallGroups.map(g=>({ id:g.id, ids:g.members.map(p=>p.id), x:g.x, y:g.y, kind:g.kind, date:g.date, note:g.note?{ why:[...g.note.why], text:g.note.text }:null })), strings:strSnap() }; }
function pushUndo(){ undoStack.push(snap()); if(undoStack.length>40) undoStack.shift(); }
function undo(){ if(drag.p||SCAN.busy||prints.some(p=>p.locked)){ toast('Hang on, something is still moving.'); return; }
  const s=undoStack.pop(); if(!s){ toast('Nothing to undo.'); return; } restore(s); toast('Undone.'); }
function restore(s){ closeInspect(); closeNote(); hideActs(); closeCtx();
  const keepLib=new Set(s.lib); for(let i=library.length-1;i>=0;i--){ if(!keepLib.has(library[i].id)){ const p=byId(library[i].id); if(p) rawRemove(p); library.splice(i,1); } }
  const keep=new Set(s.prints.map(q=>q.id));
  prints.slice().forEach(p=>{ if(!keep.has(p.id)){ p.wg=null; p.onBoard=false; p.rejected=false; p.locked=true; p.tx=BINDER.x; p.tz=BINDER.z; p.yawT=BINDER.rot; p.base=BINDER.h+0.05; setTimeout(()=>rawRemove(p),360); } });
  rows.forEach(r=>r.length=0); freeB.length=0; rejects.length=0; wallGroups.length=0;
  s.prints.forEach(q=>{ let p=byId(q.id); if(!p){ p=ensurePrint(q.id); if(!p) return; p.x=BINDER.x; p.z=BINDER.z; p.y=BINDER.h+0.1; } p.onBoard=false; p.rejected=false; p.wg=null; setSize(p,q.szi??1); p.tx=q.tx; p.tz=q.tz; p.yawT=q.yawT; p.order=q.order; });
  s.rows.forEach((r,i)=>r.forEach(id=>{ const p=byId(id); if(p&&rows[i]){ rows[i].push(p); p.onBoard=true; } }));
  (s.free||[]).forEach(id=>{ const p=byId(id); if(p){ freeB.push(p); p.onBoard=true; } });
  s.rejects.forEach(id=>{ const p=byId(id); if(p){ rejects.push(p); p.rejected=true; } });
  s.walls.forEach(w=>{ const m=w.ids.map(byId).filter(Boolean); if(!m.length) return; const g={ id:w.id, members:m, note:w.note?{ why:new Set(w.note.why), text:w.note.text }:null, kind:w.kind, date:w.date, x:w.x, y:w.y }; m.forEach(p=>p.wg=g); wallGroups.push(g); layoutGroup(g); });
  setStrings(s.strings);
  layoutBoard(null); layoutRejects(); restack(); updateChains(false); drawBoxLabel(rejects.length); drawBoxBtn(); drawBinderCover(); saveAll(); }

/* ================= stacking ================= */
function corners(p,shrink){ const c=Math.cos(p.yawT), s=Math.sin(p.yawT), hw=p.w/2*shrink, hh=p.h/2*shrink;
  return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([a,b])=>[p.tx+a*c+b*s, p.tz-a*s+b*c]); }
function overlap(a,b){ const A=corners(a,0.985), B=corners(b,0.985);
  for(const P of [A,B]) for(let i=0;i<4;i++){ const p1=P[i], p2=P[(i+1)%4], nx=-(p2[1]-p1[1]), nz=p2[0]-p1[0];
    let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9; A.forEach(q=>{ const d=q[0]*nx+q[1]*nz; a0=Math.min(a0,d); a1=Math.max(a1,d); }); B.forEach(q=>{ const d=q[0]*nx+q[1]*nz; b0=Math.min(b0,d); b1=Math.max(b1,d); });
    if(a1<b0||b1<a0) return false; } return true; }
const boardRect={ tx:BX, tz:BZ, w:BW, h:BH, yawT:0 };
const PROPS=()=>[{ tx:SC.x, tz:SC.z, w:SC.w+0.1, h:SC.d+0.1, yawT:0, top:(scanner.userData.top||0.6)+0.06 },{ tx:BOX.x, tz:BOX.z, w:BOX.w, h:BOX.d, yawT:0, top:BOX.h+0.02 },{ tx:BINDER.x, tz:BINDER.z, w:BINDER.w, h:BINDER.d, yawT:BINDER.rot, top:BINDER.h+0.01 },{ tx:loupeProp.position.x, tz:loupeProp.position.z, w:1.1, h:1.1, yawT:0, top:0.66 }];
function propTop(p){ let t=0; PROPS().forEach(o=>{ if(overlap(p,o)) t=Math.max(t,o.top); }); return t; }
function restack(){ const L=prints.filter(p=>p!==drag.p && p.inspT===0 && !p.rejected && !p.wg && !p.locked).sort((a,b)=>(a.onBoard?0:1)-(b.onBoard?0:1)||a.order-b.order);
  for(let i=0;i<L.length;i++){ const p=L[i]; if(p.onBoard&&!FREE()){ p.base=BOARD_Y; continue; }
    let base=Math.max(overlap(p,boardRect)?BOARD_Y:0, propTop(p)); for(let j=0;j<i;j++) if(overlap(p,L[j])) base=Math.max(base,L[j].base+LAYER); p.base=base; } }

/* ================= camera ================= */
const cam={ tx:0, ty:0, tz:0.3, d:30, dT:30, pitch:TOP, view:'table' };
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(), tmpV=new THREE.Vector3(), tmpCam=new THREE.PerspectiveCamera();
function placeCam(c, s){ const p=THREE.MathUtils.degToRad(s.pitch); c.position.set(s.tx, s.ty+s.d*Math.sin(p), s.tz+s.d*Math.cos(p)); c.up.set(0,1,0); if(s.pitch>89) c.up.set(0,0,-1); c.lookAt(s.tx,s.ty,s.tz); c.updateMatrixWorld(); }
function setNDC(e){ const r=canvas.getBoundingClientRect(); ndc.set((e.clientX-r.left)/r.width*2-1, -((e.clientY-r.top)/r.height)*2+1); }
function planeHit(c, n, y){ ray.setFromCamera(n, c); const t=(y-ray.ray.origin.y)/ray.ray.direction.y; if(!(t>0)) return null; return ray.ray.origin.clone().addScaledVector(ray.ray.direction,t); }
function wallHit(c, n){ ray.setFromCamera(n, c); const t=(WALL_Z-ray.ray.origin.z)/ray.ray.direction.z; if(!(t>0)) return null; return ray.ray.origin.clone().addScaledVector(ray.ray.direction,t); }
const viewHit=(c,n)=>cam.view==='wall'?wallHit(c,n):planeHit(c,n,0);
let zoomAnchor=null;
function clampCam(){ if(cam.view==='wall'){ cam.tx=THREE.MathUtils.clamp(cam.tx,-WALL_W/2+2,WALL_W/2-2); cam.ty=THREE.MathUtils.clamp(cam.ty,2,WALL_Y1-2); }
  else { cam.tx=THREE.MathUtils.clamp(cam.tx,-W_T/2,W_T/2); cam.tz=THREE.MathUtils.clamp(cam.tz,-H_T/2,H_T/2+1); } }
function fitDist(w,h,pitch){ const vf=THREE.MathUtils.degToRad(camera.fov), hf=2*Math.atan(Math.tan(vf/2)*camera.aspect), pr=THREE.MathUtils.degToRad(pitch);
  return Math.max((w/2)/Math.tan(hf/2), (h*Math.sin(pr)/2)/Math.tan(vf/2)+h*0.5*Math.cos(pr))*1.06; }
function focus(which){ zoomAnchor=null; const was=cam.view; cam.view=which==='wall'?'wall':'table';
  if(was==='wall'&&cam.view!=='wall'){ recordHist(); setHist(-1); dropString(); }
  if(which==='wall'){ cam.pitch=4; cam.tx=wallFocusX(); cam.ty=10; cam.tz=WALL_Z; cam.dT=(23/2)/Math.tan(THREE.MathUtils.degToRad(camera.fov/2)); }
  else { cam.pitch=TOP; cam.ty=0;
    if(which==='board'){ cam.tx=BX; cam.tz=BZ+0.3; cam.dT=fitDist(BW+1.6,BH+1.6,cam.pitch); } else { cam.tx=0; cam.tz=0.3; cam.dT=fitDist(W_T+1.5,H_T+1,cam.pitch); } }
  ['bTable','bBoard','bWall'].forEach(id=>$(id).classList.toggle('on', id==='b'+which[0].toUpperCase()+which.slice(1)));
  document.body.dataset.view=cam.view; hideActs(); renderHist(); if(was!==cam.view) tourEv(cam.view); }

/* ================= pointer ================= */
const mouse={ x:0, y:0, in:false, n:new THREE.Vector2() };
const drag={ p:null, pending:null, sx:0, sy:0, ox:0, oz:0, h:0, wx:0, wz:0, pileYaw:0, preview:null, wall:null, target:null, ctx:null };
const pan={ on:false, start:null };
const HOV={ p:null };
let inspected=null;
function hitPrint(e){ setNDC(e); ray.setFromCamera(ndc,camera); const hits=ray.intersectObjects(prints.filter(p=>p!==drag.p&&!p.locked&&(p.wallA<0.02||(p.wallA>0.98&&histIdx<0))).map(p=>p.mesh),false); return hits.length?hits[0].object.userData.p:null; }
canvas.addEventListener('pointerdown', e=>{
  if(e.button!==0 && e.button!==2) return; canvas.setPointerCapture(e.pointerId); setNDC(e); closeNote(); closeCtx();
  if(inspected){ closeInspect(); return; }
  if(loupe.on&&e.button===2){ setLoupe(false); return; }
  if(cam.view==='wall'&&histIdx<0&&stringPointer(e)) return;
  if(e.button===0 && loupeHit(e)){ setLoupe(!loupe.on); return; }
  if(e.button===0 && binderHit(e)){ openBinder(); return; }
  const p=hitPrint(e);
  if(p&&e.button===2){ drag.ctx={ p, x:e.clientX, y:e.clientY }; return; }
  if(p&&p.wg){ drag.pending=p; drag.sx=e.clientX; drag.sy=e.clientY; const h=wallHit(camera,ndc)||V(p.wg.x,p.wg.y,0); drag.ox=p.wg.x-h.x; drag.oz=p.wg.y-h.y; }
  else if(p){ drag.pending=p; drag.sx=e.clientX; drag.sy=e.clientY; drag.h=F.lift*0.6+p.base; const hp=planeHit(camera,ndc,drag.h)||V(p.x,0,p.z); drag.ox=p.x-hp.x; drag.oz=p.z-hp.z; }
  else { pan.on=true; zoomAnchor=null; pan.start=viewHit(camera,ndc); canvas.style.cursor='grabbing'; }
});
canvas.addEventListener('pointermove', e=>{
  setNDC(e); mouse.x=e.clientX; mouse.y=e.clientY; mouse.in=true; mouse.n.copy(ndc); mouse.t=performance.now();
  if(drag.ctx&&Math.hypot(e.clientX-drag.ctx.x,e.clientY-drag.ctx.y)>6) drag.ctx=null;
  if(drag.pending && !drag.p && !drag.wall && Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>5){ if(drag.pending.wg){ pushUndo(); drag.wall=drag.pending.wg; hideActs(); canvas.style.cursor='grabbing'; } else startDrag(drag.pending); }
  if(drag.wall){ const h=wallHit(camera,ndc); if(h){ const g=drag.wall; g.x=h.x+drag.ox; g.y=h.y+drag.oz; layoutGroup(g); } }
  else if(drag.p){ const hp=planeHit(camera,ndc,drag.h); if(hp){ drag.wx=THREE.MathUtils.clamp(hp.x+drag.ox,-W_T/2-0.5,W_T/2+0.5); drag.wz=THREE.MathUtils.clamp(hp.z+drag.oz,-H_T/2-0.6,H_T/2+0.5); } updatePreview(); }
  else if(pan.on && pan.start){ placeCam(tmpCam, cam); tmpCam.fov=camera.fov; tmpCam.aspect=camera.aspect; tmpCam.updateProjectionMatrix(); const h=viewHit(tmpCam,ndc);
    if(h){ cam.tx+=pan.start.x-h.x; if(cam.view==='wall') cam.ty+=pan.start.y-h.y; else cam.tz+=pan.start.z-h.z; clampCam(); } }
  else if(STR.hold){ canvas.style.cursor='crosshair'; }
  else if(GD.on){ }
  else if(!inspected){ const p=hitPrint(e); const hs=(cam.view==='wall'&&!p&&stringsOn)?hitString():null; STR.hov=hs?hs.s:null; setHover(p); canvas.style.cursor=loupe.on?'none':(p||loupeHit(e))?'grab':(binderHit(e)||(cam.view==='wall'&&(hitSpool()!=null||STR.hov||hitSwatch())))?'pointer':'default'; }
});
window.addEventListener('pointerup', e=>{
  if(drag.ctx){ const c=drag.ctx; drag.ctx=null; openCtx(c.p,c.x,c.y); }
  else if(drag.wall){ saveAll(); drag.wall=null; }
  else if(drag.p){ endDrag(); }
  else if(drag.pending){ openInspect(drag.pending); }
  drag.pending=null; pan.on=false; canvas.style.cursor=loupe.on?'none':'default';
});
canvas.addEventListener('pointerleave', ()=>{ mouse.in=false; setHover(null); });
canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.addEventListener('wheel', e=>{ e.preventDefault(); setNDC(e); closeCtx();
  if(drag.p){ if(!drag.preview){ drag.pileYaw-=e.deltaY*0.0022; drag.p.yawT=drag.pileYaw; } return; }
  if(inspected){ inspZoom=THREE.MathUtils.clamp(inspZoom*Math.exp(-e.deltaY*0.0012),0.7,2.6); return; }
  cam.dT=THREE.MathUtils.clamp(cam.dT*Math.exp(e.deltaY*0.0011),3.2,cam.view==='wall'?72:48);
  placeCam(tmpCam,cam); tmpCam.fov=camera.fov; tmpCam.aspect=camera.aspect; tmpCam.updateProjectionMatrix();
  zoomAnchor={ n:ndc.clone(), w:viewHit(tmpCam,ndc) };
  ['bTable','bBoard'].forEach(id=>$(id).classList.remove('on'));
},{ passive:false });

function startDrag(p){ pushUndo(); hideActs(); drag.p=p; p.order=++orderN; drag.wx=p.x; drag.wz=p.z; drag.pileYaw=p.onBoard||p.rejected?(Math.random()-0.5)*0.4:p.yawT;
  if(p.rejected) unreject(p);
  const was=p.onBoard; removeFromBoard(p); if(was) layoutBoard(null); canvas.style.cursor='grabbing'; updateChains(false); }
function inScanner(x,z){ return Math.abs(x-SC.x)<SC.w/2+0.2 && Math.abs(z-SC.z)<SC.d/2+0.2; }
function updatePreview(){ const p=drag.p; let pv=null; drag.target=null;
  if(boardContains(drag.wx,drag.wz,0.2)){ if(FREE()) pv=freeTarget(p,drag.wx,drag.wz); else { const t=rowTarget(drag.wx,drag.wz,p); pv={ row:t.row, index:t.index, w:p.w, h:p.h }; } }
  else if(inBinder(drag.wx,drag.wz)) drag.target='binder';
  else if(inBox(drag.wx,drag.wz)) drag.target='box';
  else if(inScanner(drag.wx,drag.wz)) drag.target='scan';
  else if(drag.wz<PINZONE.z+PINZONE.d/2+0.2&&drag.wx>ZX0) drag.target='wall';
  drag.preview=pv; layoutBoard(pv);
  if(pv){ p.yawT=0; ghost.visible=true; ghost.position.set(pv.x,BOARD_Y+0.003,pv.z); ghost.scale.set(pv.w+0.08,pv.h+0.08,1); }
  else { p.yawT=drag.pileYaw; ghost.visible=false; } }
function endDrag(){ const p=drag.p, pv=drag.preview, tg=drag.target; ghost.visible=false; drag.p=null; drag.preview=null; drag.target=null;
  if(pv){ if(pv.free) placeFree(p,pv.x,pv.z); else { placeOnBoard(p,pv.row,pv.index); p.tx=pv.x; p.tz=pv.z; } tourEv('board'); }
  else if(tg==='binder'){ p.x=drag.wx; p.z=drag.wz; fileBack(p); return; }
  else if(tg==='box'){ p.x=drag.wx; p.z=drag.wz; reject(p); return; }
  else if(tg==='scan'){ p.x=drag.wx; p.z=drag.wz; undoStack.pop(); copyPrint(p); return; }
  else if(tg==='wall'){ p.tx=drag.wx; p.tz=drag.wz; pinGroup([p], null, 'single'); return; }
  else { p.tx=drag.wx; p.tz=drag.wz; p.yawT=drag.pileYaw+(Math.random()-0.5)*F.jitter; }
  layoutBoard(null); restack(); updateChains(true); saveAll(); }

/* ================= inspect ================= */
let inspZoom=1;
const dim=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0, depthTest:false, depthWrite:false }));
dim.renderOrder=10; camera.add(dim);
function openInspect(p){ hideActs(); inspected=p; p.inspT=1; inspZoom=1; if(!p.wg) p.order=++orderN; p.mat.transparent=true; p.mat.depthTest=false; p.mesh.renderOrder=11; hint('Move the mouse to tilt · scroll to bring it closer · click anywhere to put it down'); }
function closeInspect(){ if(!inspected) return; inspected.inspT=0; inspected=null; hint(null); }

/* ================= loupe (glass) ================= */
const loupe={ on:false };
const rt=new THREE.WebGLRenderTarget(512,512,{ type:THREE.HalfFloatType, samples:4 });
const zoomCam=new THREE.PerspectiveCamera(10,1,0.8,220);
const ovScene=new THREE.Scene(), ovCam=new THREE.OrthographicCamera(0,1,0,-1,-1,1);
const loupeMat=new THREE.ShaderMaterial({ uniforms:{ tex:{value:rt.texture} }, transparent:true, depthTest:false,
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform sampler2D tex; varying vec2 vUv;
    void main(){ vec2 c=vUv*2.0-1.0; float r=length(c); if(r>1.0) discard;
      vec2 b=c*(0.80+0.20*r*r); float ca=0.018*r*r;
      vec3 col=vec3(texture2D(tex,b*(1.0+ca)*0.5+0.5).r, texture2D(tex,b*0.5+0.5).g, texture2D(tex,b*(1.0-ca)*0.5+0.5).b);
      col*=1.0-0.45*smoothstep(0.72,0.9,r);
      float g=smoothstep(0.07,0.0,abs(r-0.74))*pow(max(0.0,dot(c/max(r,0.001),normalize(vec2(-0.6,0.8)))),6.0); col+=vec3(0.22)*g;
      float rim=smoothstep(0.885,0.9,r); vec3 metal=mix(vec3(0.05,0.045,0.04),vec3(0.28,0.26,0.24),pow(max(0.0,dot(c/max(r,0.001),normalize(vec2(-0.5,0.85)))),2.0)*smoothstep(1.0,0.93,r));
      col=mix(col,metal,rim);
      gl_FragColor=vec4(col,1.0);
      #include <colorspace_fragment>
    }` });
const loupeQuad=new THREE.Mesh(new THREE.PlaneGeometry(1,1), loupeMat); ovScene.add(loupeQuad);
const loupeShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ map:radTex([30,[[0,'rgba(0,0,0,0.55)'],[1,'rgba(0,0,0,0)']]]), transparent:true, depthTest:false })); loupeShadow.renderOrder=-1; ovScene.add(loupeShadow);
const loupeProp=new THREE.Group();
{ const m1=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.5,0.62,40,1,true), new THREE.MeshLambertMaterial({ color:0x2b2926, side:THREE.DoubleSide }));
  const m2=new THREE.Mesh(new THREE.CylinderGeometry(0.43,0.43,0.04,40), new THREE.MeshBasicMaterial({ color:0xcfd8de, transparent:true, opacity:0.35 }));
  m1.position.y=0.31; m2.position.y=0.62; const m3=new THREE.Mesh(new THREE.TorusGeometry(0.44,0.035,10,40), new THREE.MeshLambertMaterial({ color:0x8a8580 })); m3.rotation.x=Math.PI/2; m3.position.y=0.62;
  loupeProp.add(m1,m2,m3); blobShadow(1.5,1.5,loupeProp,0.1,0.12); }
loupeProp.position.set(BOX.x+0.1,0,BOX.z-BOX.d/2-1.25); scene.add(loupeProp);
function loupeHit(e){ setNDC(e); ray.setFromCamera(ndc,camera); return loupeProp.visible && ray.intersectObject(loupeProp,true).length>0; }
function setLoupe(on){ loupe.on=on; loupeProp.visible=!on; canvas.style.cursor=on?'none':'default'; $('bLoupe').classList.toggle('on',on); }

/* ================= pairs & sequences: marker, rhythm strip, notes ================= */
let chains=[]; const threads=new THREE.Group(); scene.add(threads);
const tagLayer=$('tags'); let tags=[];
const notes=new Map();
const WHY=['Shape','Colour','Light','Story','Contrast','Mood','Subject'];
const chainKey=ch=>ch.map(p=>p.id).join('-');
const matTex=(()=>{ const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'); g.filter='blur(4px)'; g.fillStyle='#fff'; g.fillRect(10,10,236,236); const t=new THREE.CanvasTexture(c); return t; })();
function updateChains(user){ const before=new Set(chains.map(chainKey)); chains=FREE()?freeGroups():rows.filter(r=>r.length>=2).map(r=>r.slice()); drawChains();
  if(user&&chains.length) tourEv('pair');
  if(user){ const fresh=chains.find(ch=>!before.has(chainKey(ch))&&!notes.has(chainKey(ch)));
    if(fresh) toast(fresh.length===2?'That’s a pair. Right-click one (or use its cog) to say what joins them.':'That’s a sequence of '+fresh.length+'. Check the rhythm strip above it.'); }
  }
function bboxOf(ch){ let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; ch.forEach(p=>{ x0=Math.min(x0,p.tx-p.w/2); x1=Math.max(x1,p.tx+p.w/2); z0=Math.min(z0,p.tz-p.h/2); z1=Math.max(z1,p.tz+p.h/2); }); return { x0,x1,z0,z1 }; }
function rhythmTexture(ch, x0, x1){ const W=1024, H=96, c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d'), single=ch.every(p=>Math.abs(p.tz-ch[0].tz)<0.3), n=ch.length;
  const span=p=>{ if(single) return [(p.tx-p.w/2-x0)/(x1-x0)*W,(p.tx+p.w/2-x0)/(x1-x0)*W]; const i=ch.indexOf(p); return [i*W/n+5,(i+1)*W/n-5]; }, X=p=>{ const s=span(p); return (s[0]+s[1])/2; };
  ch.forEach(p=>{ const [a,b]=span(p); g.fillStyle='rgb('+(p.stats.r|0)+','+(p.stats.g|0)+','+(p.stats.b|0)+')'; g.fillRect(a,H-26,b-a,18); });
  const pts=ch.map(p=>[X(p), 8+(1-p.stats.lum)*(H-46)]);
  g.strokeStyle='rgba(244,241,234,0.85)'; g.lineWidth=3; g.lineJoin='round'; g.beginPath(); pts.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])); g.stroke();
  pts.forEach(q=>{ g.fillStyle='#f4f1ea'; g.beginPath(); g.arc(q[0],q[1],6,0,7); g.fill(); });
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=MAXANI; return t; }
function drawChains(){
  threads.children.forEach(m=>{ if(m.material&&m.material.map&&m.material.map!==matTex) m.material.map.dispose(); });
  threads.clear(); tags.forEach(t=>t.el.remove()); tags=[];
  chains.forEach(ch=>{ const bb=bboxOf(ch), maxH=bb.z1-bb.z0, top=BOARD_Y+LAYER*2;
    const x0=bb.x0, x1=bb.x1, zc=(bb.z0+bb.z1)/2, above=bb.z0-0.26;
    const flat=m=>{ m.rotation.x=-Math.PI/2; threads.add(m); return m; };
    if(pick.marker==='A'){ const m=flat(new THREE.Mesh(new THREE.PlaneGeometry(x1-x0+0.44,maxH+0.44), new THREE.MeshBasicMaterial({ map:matTex, color:0x3b3631, transparent:true, opacity:0, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 })));
      m.position.set((x0+x1)/2,BOARD_Y+0.004,zc); m.userData.fade=0.9; m.renderOrder=-1; }
    else if(pick.marker==='B') ch.forEach((p,i)=>addTag(String(i+1), V(p.tx-p.w/2+0.2,top,p.tz-p.h/2+0.2), 'num'));
    const rh=flat(new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,0.4), new THREE.MeshBasicMaterial({ map:rhythmTexture(ch,x0,x1), transparent:true, depthWrite:false })));
    rh.position.set((x0+x1)/2, top, above-(pick.marker==='A'?0.06:0));
    const n=notes.get(chainKey(ch)); if(n&&(n.why.size||n.text)) addTag(noteSummary(n), V(x0,top,zc+maxH/2+0.3), 'nsum'); });
  drawBoxBtn(); }
function addTag(text, world, cls){ const el=document.createElement('div'); el.className='tag '+cls; if(text) el.textContent=text; tagLayer.appendChild(el); const t={ el, w:world }; tags.push(t); return el; }
function noteSummary(n){ if(!n) return ''; const w=[...n.why]; return w.join(' · ')+(n.text?(w.length?' · ':'')+'“'+n.text+'”':''); }
let boxBtn=null;
function drawBoxBtn(){ if(boxBtn){ boxBtn.el.remove(); tags=tags.filter(t=>t!==boxBtn); boxBtn=null; } if(!rejects.length) return;
  const el=addTag('', V(BOX.x,0,BOX.z+BOX.d/2+0.55), 'boxbtn'); boxBtn=tags[tags.length-1];
  const b=document.createElement('button'); b.type='button'; b.textContent='Empty into binder'; b.onpointerdown=e=>e.stopPropagation(); b.onclick=e=>{ e.stopPropagation(); emptyBox(); }; el.appendChild(b); }
function emptyBox(){ if(!rejects.length) return; pushUndo(); const L=rejects.slice(); L.forEach((p,i)=>setTimeout(()=>fileBack(p,true),i*80)); setTimeout(()=>toast('Emptied '+L.length+' back into the binder.','Undo',undo), L.length*80+360); }
const pop=$('notePop');
function openNote(ch, x, y){ hideActs(); closeCtx(); const k=chainKey(ch); const n=notes.get(k)||{ why:new Set(), text:'' };
  pop.querySelector('h3').textContent=ch.length===2?'What joins these two?':'Why this order?';
  const box=pop.querySelector('.why'); box.innerHTML='';
  WHY.forEach(w=>{ const b=document.createElement('button'); b.type='button'; b.className='wchip'+(n.why.has(w)?' on':''); b.textContent=w; b.onclick=()=>{ n.why.has(w)?n.why.delete(w):n.why.add(w); b.classList.toggle('on'); notes.set(k,n); saveAll(); if(n.why.size) tourEv('note'); }; box.appendChild(b); });
  const ta=$('noteText'); ta.value=n.text; ta.oninput=()=>{ n.text=ta.value.trim(); notes.set(k,n); saveAll(); if(n.text.length>2) tourEv('note'); };
  pop.style.left=Math.min(window.innerWidth-316,Math.max(12,x))+'px'; pop.style.top=Math.min(window.innerHeight-260,Math.max(12,y))+'px';
  pop.classList.add('on'); notes.set(k,n); }
function closeNote(){ if(!pop.classList.contains('on')) return; pop.classList.remove('on'); drawChains(); }
$('noteDone').onclick=closeNote;

/* ================= hover icons + right-click menu ================= */
const ICON={ grip:'<circle cx="6" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="12" r="1"/>', pin:'<path d="M6 2.5h4"/><path d="M7 2.5v3.5L4.8 8.8h6.4L9 6V2.5"/><path d="M8 8.8v4.7"/>', cog:'<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1"/>', note:'<path d="M3 13l.8-3.2L10.6 3l2.4 2.4-6.8 6.8z"/><path d="M9.4 4.2l2.4 2.4"/>', 
  book:'<path d="M8 4.2C6.8 3.4 5 3 2.5 3v9.5c2.5 0 4.3.4 5.5 1.2 1.2-.8 3-1.2 5.5-1.2V3C11 3 9.2 3.4 8 4.2z"/><path d="M8 4.2v9.5"/>', down:'<path d="M8 3v9"/><path d="M4.8 8.8L8 12l3.2-3.2"/><path d="M4 14h8"/>', why:'<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/>' };
const ACTS={ el:$('acts'), key:null, anchor:null, t:0 };
function ib(icon,label,fn){ const b=document.createElement('button'); b.type='button'; b.className='ib'; b.title=label; b.setAttribute('aria-label',label); b.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true">'+ICON[icon]+'</svg>';
  b.onpointerdown=e=>e.stopPropagation(); b.onclick=e=>{ e.stopPropagation(); const r=b.getBoundingClientRect(); fn(r); }; return b; }
function hoverKey(p){ if(p.wg) return 'g'+p.wg.id; if(p.onBoard){ const ch=chains.find(c=>c.includes(p)); if(ch) return 'c'+chainKey(ch); } return 'p'+p.id; }
function nearCog(){ if(!ACTS.el.classList.contains('on')) return false; const r=ACTS.el.getBoundingClientRect(); const dx=Math.max(r.left-mouse.x,0,mouse.x-r.right), dy=Math.max(r.top-mouse.y,0,mouse.y-r.bottom); return Math.hypot(dx,dy)<46; }
function setHover(p){ HOV.p=p; if(inspected||drag.p||drag.wall||histIdx>=0||STR.hold||CTX.classList.contains('on')){ hideActs(); return; }
  if(p&&!p.locked){ clearTimeout(ACTS.t); const key=hoverKey(p); ACTS.p=p;
    if(key!==ACTS.key){ ACTS.key=key; ACTS.el.innerHTML='';
      if(key[0]==='c'&&FREE()){ const ch=chains.find(c=>c.includes(p)); const g=ib('grip','Drag to move the whole '+(ch.length===2?'pair':'sequence'),()=>{}); g.classList.add('grip'); g.onpointerdown=e=>{ e.stopPropagation(); e.preventDefault(); startGroupDrag(ch,e); }; ACTS.el.appendChild(g); }
      ACTS.el.appendChild(ib('cog','Options',r=>openCtx(ACTS.p,r.left,r.bottom+6)));
      if(key[0]!=='g'){ const ch=key[0]==='c'?chains.find(c=>c.includes(p)):null; ACTS.el.appendChild(ib('pin',ch?'Pin the '+(ch.length===2?'pair':'sequence')+' to the wall':'Pin to the wall',()=>act('pin',ACTS.p))); }
      if(key[0]==='g'){ const g=p.wg; ACTS.anchor=()=>V(g.x, g.y+groupHeight(g)/2+0.42, WALL_Z+0.08); }
      else if(key[0]==='c'){ const ch=chains.find(c=>c.includes(p)); ACTS.anchor=()=>{ const bb=bboxOf(ch); return V((bb.x0+bb.x1)/2, BOARD_Y+LAYER*2, bb.z0-0.84); }; }
      else ACTS.anchor=()=>{ const c=Math.cos(p.yaw), s=Math.sin(p.yaw), lz=-p.h/2-0.42; return V(p.x+lz*s, p.y+0.02, p.z+lz*c); }; }
    ACTS.el.classList.add('on'); }
  else if(ACTS.key!==null&&!nearCog()){ clearTimeout(ACTS.t); ACTS.t=setTimeout(()=>{ if(!ACTS.el.matches(':hover')&&!nearCog()&&!HOV.p) hideActs(); },350); } }
const GD={ on:false, ch:null, off:[] };
function startGroupDrag(ch,e){ pushUndo(); hideActs(); GD.on=true; GD.ch=ch.slice(); setNDC(e); const h=planeHit(camera,ndc,BOARD_Y)||V(ch[0].tx,0,ch[0].tz);
  GD.off=GD.ch.map(p=>[p.tx-h.x,p.tz-h.z]); GD.ch.forEach(p=>{ p.gLift=true; p.order=++orderN; }); document.body.style.cursor='grabbing'; }
window.addEventListener('pointermove', e=>{ if(!GD.on) return; setNDC(e); mouse.x=e.clientX; mouse.y=e.clientY; mouse.n.copy(ndc); const h=planeHit(camera,ndc,BOARD_Y); if(!h) return;
  const a=GD.ch[0], ax=h.x+GD.off[0][0], az=h.z+GD.off[0][1], dx=Math.round(ax/SNAP)*SNAP-ax, dz=Math.round(az/SNAP)*SNAP-az;
  let bb={ x0:1e9,x1:-1e9,z0:1e9,z1:-1e9 }; GD.ch.forEach((p,i)=>{ const x=h.x+GD.off[i][0]+dx, z=h.z+GD.off[i][1]+dz; bb.x0=Math.min(bb.x0,x-p.w/2); bb.x1=Math.max(bb.x1,x+p.w/2); bb.z0=Math.min(bb.z0,z-p.h/2); bb.z1=Math.max(bb.z1,z+p.h/2); });
  const cx=Math.max(-W_T/2-bb.x0,0)+Math.min(W_T/2-bb.x1,0), cz=Math.max(-H_T/2-bb.z0,0)+Math.min(H_T/2-bb.z1,0);
  GD.ch.forEach((p,i)=>{ p.tx=h.x+GD.off[i][0]+dx+cx; p.tz=h.z+GD.off[i][1]+dz+cz; }); drawChains(); });
window.addEventListener('pointerup', ()=>{ if(!GD.on) return; GD.on=false; document.body.style.cursor='';
  const bb=bboxOf(GD.ch), cx=(bb.x0+bb.x1)/2, cz=(bb.z0+bb.z1)/2, on=boardContains(cx,cz,0);
  GD.ch.forEach(p=>{ p.gLift=false; if(on){ p.tx=THREE.MathUtils.clamp(p.tx,BX-BW/2+p.w/2+0.1,BX+BW/2-p.w/2-0.1); p.tz=THREE.MathUtils.clamp(p.tz,BZ-BH/2+p.h/2+0.1,BZ+BH/2-p.h/2-0.1); } else { removeFromBoard(p); } });
  restack(); updateChains(false); saveAll(); if(!on) toast('Moved off the board onto the table.','Undo',undo); });
function hideActs(){ clearTimeout(ACTS.t); ACTS.el.classList.remove('on'); ACTS.key=null; ACTS.anchor=null; }
ACTS.el.addEventListener('pointerleave',()=>{ clearTimeout(ACTS.t); ACTS.t=setTimeout(()=>{ if(!HOV.p) hideActs(); },300); });
const CTX=$('ctx');
function openCtx(p,x,y){ hideActs(); const items=[];
  if(p.wg){ const g=p.wg;
    if(g.note&&(g.note.why.size||g.note.text)) items.push(['Why these go together','',()=>toast(noteSummary(g.note))]);
    if(g.members.length>1) items.push(['Send to photobook','',()=>sendToBook(g.members.map(q=>q.id), g.note)]);
    if(g.members.length>1) items.push(['Unlink so each print moves on its own','',()=>unlink(g)]);
    items.push(['Run string from here','',()=>startString(STR.last,{ id:p.id })]);
    items.push(['Bigger print',']',()=>resizePrint(p,1)]); items.push(['Smaller print','[',()=>resizePrint(p,-1)]);
    items.push(['Take down','',()=>{ pushUndo(); unpin(g); toast('Taken down onto the pile.','Undo',undo); }]);
  } else { const ch=p.onBoard?chains.find(c=>c.includes(p)):null;
    if(ch){ items.push([ch.length===2?'What joins these?':'Why this order?','',()=>openNote(ch,x,y)]);
      items.push(['Pin '+(ch.length===2?'pair':'sequence')+' to the wall','Shift P',()=>{ pushUndo(); pinGroup(ch, notes.get(chainKey(ch)), ch.length===2?'pair':'sequence'); }]);
      items.push(['Send to photobook','',()=>sendToBook(ch.map(q=>q.id), notes.get(chainKey(ch)))]); items.push(null); }
    items.push(['Print another copy','C',()=>copyPrint(p)]);
    items.push(['Bigger print',']',()=>resizePrint(p,1)]); items.push(['Smaller print','[',()=>resizePrint(p,-1)]);
    items.push([ch?'Pin just this one':'Pin to the wall','P',()=>act('pin1',p)]);
    items.push(['Reject','X',()=>act('reject',p)]);
    items.push(['File in binder','F',()=>act('file',p)]); }
  CTX.innerHTML=''; items.forEach(it=>{ if(!it){ const s=document.createElement('hr'); CTX.appendChild(s); return; } const b=document.createElement('button'); b.type='button'; b.innerHTML='<span></span><kbd></kbd>'; b.firstChild.textContent=it[0]; b.lastChild.textContent=it[1]; if(!it[1]) b.lastChild.remove();
    b.onclick=()=>{ closeCtx(); it[2](); }; CTX.appendChild(b); });
  CTX.classList.add('on'); const r=CTX.getBoundingClientRect(); CTX.style.left=Math.min(window.innerWidth-r.width-10,x)+'px'; CTX.style.top=Math.min(window.innerHeight-r.height-10,y)+'px'; }
function closeCtx(){ CTX.classList.remove('on'); }
document.addEventListener('pointerdown', e=>{ if(!CTX.contains(e.target)) closeCtx(); }, true);
function act(kind,p){ if(!p||p.locked||drag.p) return;
  if(kind==='reject'){ if(p.wg) return; pushUndo(); reject(p); toast('Rejected.','Undo',undo); }
  else if(kind==='file'){ if(p.wg) return; pushUndo(); fileBack(p); }
  else if(kind==='copy'){ if(p.wg){ toast('Take it off the wall to copy it.'); return; } copyPrint(p); }
  else if(kind==='pin1'){ if(p.wg) return; pushUndo(); pinGroup([p],null,'single'); }
  else if(kind==='pin'){ if(p.wg) return; const ch=p.onBoard?chains.find(c=>c.includes(p)):null; pushUndo(); if(ch) pinGroup(ch, notes.get(chainKey(ch)), ch.length===2?'pair':'sequence'); else pinGroup([p],null,'single'); } }

/* ================= string on the wall (spools on a ledge; pin coloured thread between prints) ================= */
const STR_COLORS=[['Red',0xb3322b],['Ochre',0xc99a3c],['Bone',0xe9e3d6],['Blue',0x3d6fa8],['Green',0x5f8a5a],['Black',0x161514]];
const SHELF={ x:-13.6, y:4.3, w:5.4 };
const strings=[]; let strN=0; const STR={ hold:null, tube:null, last:0, hov:null }; const strGroup=new THREE.Group(); scene.add(strGroup);
const spools=new THREE.Group(); scene.add(spools);
{ const wood=new THREE.MeshStandardMaterial({ color:0x6b4a2e, roughness:0.7 });
  const ledge=new THREE.Mesh(new RoundedBoxGeometry(SHELF.w,0.12,0.6,2,0.03), wood); ledge.position.set(SHELF.x, SHELF.y, WALL_Z+0.3); spools.add(ledge);
  [-1,1].forEach(s=>{ const br=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.4,0.5), wood); br.position.set(SHELF.x+s*(SHELF.w/2-0.4), SHELF.y-0.24, WALL_Z+0.27); spools.add(br); });
  const flange=new THREE.MeshStandardMaterial({ color:0xb08a5c, roughness:0.6 });
  STR_COLORS.forEach(([name,col],i)=>{ const g=new THREE.Group(); g.position.set(SHELF.x-SHELF.w/2+0.55+i*(SHELF.w-1.1)/(STR_COLORS.length-1), SHELF.y+0.06, WALL_Z+0.32);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.36,24), new THREE.MeshStandardMaterial({ color:col, roughness:0.85 })); body.position.y=0.22;
    const f1=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,0.05,24), flange); f1.position.y=0.025; const f2=f1.clone(); f2.position.y=0.425;
    g.add(body,f1,f2); g.userData.color=i; g.traverse(o=>{ o.userData.spool=i; }); spools.add(g); });
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(SHELF.w+0.9,1.2), new THREE.MeshBasicMaterial({ map:softShadow, transparent:true, depthWrite:false, opacity:0.8 })); sh.position.set(SHELF.x+0.1,SHELF.y-0.15,WALL_Z+0.01); spools.add(sh); }
function endPos(e){ if(e.id!=null){ const p=byId(e.id); if(!p||!p.wg||p.wallA<0.6) return null; return V(p.wx, p.wy+p.h/2-0.17, WALL_Z+0.022); } return V(e.x,e.y,WALL_Z+0.022); }
function stringCurve(a,b){ const d=a.distanceTo(b), sag=THREE.MathUtils.clamp(d*0.1,0.12,1.4); const m=a.clone().add(b).multiplyScalar(0.5); m.y-=sag; return new THREE.QuadraticBezierCurve3(a,m,b); }
const pinGeoS=new THREE.SphereGeometry(0.07,14,10);
function makeStringMesh(color,a,b){ const g=new THREE.Group(); const mat=new THREE.MeshStandardMaterial({ color, roughness:0.75, emissive:0x000000 });
  g.add(new THREE.Mesh(new THREE.TubeGeometry(stringCurve(a,b),48,0.026,8,false), mat));
  [a,b].forEach(pt=>{ const h=new THREE.Mesh(pinGeoS, mat); h.position.copy(pt); h.position.z+=0.075; g.add(h); }); g.userData.mat=mat; return g; }
function disposeGroup(g){ g.traverse(o=>{ if(o.geometry&&o.geometry!==pinGeoS) o.geometry.dispose(); }); }
function clearStringMeshes(){ strings.forEach(s=>{ if(s.mesh){ strGroup.remove(s.mesh); disposeGroup(s.mesh); s.mesh=null; } }); }
function updateStrings(){ for(let i=strings.length-1;i>=0;i--){ const s=strings[i];
    const gone=[s.a,s.b].some(e=>{ if(e.id==null) return false; const p=byId(e.id); return !p||!p.wg; });
    if(gone){ if(s.mesh){ strGroup.remove(s.mesh); disposeGroup(s.mesh); } strings.splice(i,1); continue; }
    const a=endPos(s.a), b=endPos(s.b); if(!a||!b){ if(s.mesh) s.mesh.visible=false; s.pts=null; continue; }
    const key=[a.x,a.y,b.x,b.y,s.c].map(v=>(+v).toFixed(2)).join();
    if(key!==s.key){ if(s.mesh){ strGroup.remove(s.mesh); disposeGroup(s.mesh); } s.mesh=makeStringMesh(STR_COLORS[s.c][1],a,b); strGroup.add(s.mesh); s.key=key; s.pts=stringCurve(a,b).getPoints(28); }
    s.mesh.visible=histIdx<0; s.mesh.userData.mat.emissive.setHex(STR.hov===s?0x3a3328:0x000000); } }
function startString(c, from, orig){ STR.hold={ c, from:from||null, orig:orig||null }; STR.last=c; canvas.style.cursor='crosshair'; hideActs();
  toast(orig?'Moving the string. Click to pin it, Delete to cut it, right-click to put it back.':from?'Click another print, or a spot on the wall. Right-click to let go.':'Picked up '+STR_COLORS[c][0].toLowerCase()+' string. Click a print to pin one end. Right-click to put it back.'); }
function dropString(putBack){ const h=STR.hold; STR.hold=null; if(STR.tube){ strGroup.remove(STR.tube); disposeGroup(STR.tube); STR.tube=null; }
  if(h&&h.orig&&putBack!==false){ strings.push({ id:++strN, c:h.orig.c, a:h.orig.a, b:h.orig.b, mesh:null, key:'' }); undoStack.pop(); }
  canvas.style.cursor='default'; }
function holdFrame(){ if(STR.tube){ strGroup.remove(STR.tube); disposeGroup(STR.tube); STR.tube=null; } if(!STR.hold||cam.view!=='wall'||!mouse.in) return;
  const h=wallHit(camera,mouse.n); if(!h) return; const end=V(h.x,h.y,WALL_Z+0.35);
  let start; if(STR.hold.from) start=endPos(STR.hold.from); else { const sp=spools.children.find(o=>o.userData.color===STR.hold.c); start=sp.position.clone(); start.y+=0.22; start.z+=0.2; }
  if(!start) return; STR.tube=makeStringMesh(STR_COLORS[STR.hold.c][1],start,end); strGroup.add(STR.tube); }
function hitSpool(){ ray.setFromCamera(ndc,camera); const h=ray.intersectObject(spools,true).find(x=>x.object.userData.spool!=null); return h?h.object.userData.spool:null; }
// strings are thin, so hit them in screen space with a generous margin
function hitString(){ if(cam.view!=='wall'||histIdx>=0||!stringsOn) return null; const W=window.innerWidth, H=window.innerHeight; let best=null, bd=14;
  strings.forEach(s=>{ if(!s.pts||!s.mesh||!s.mesh.visible) return; const P=s.pts.map(q=>{ tmpV.copy(q).project(camera); return [(tmpV.x+1)/2*W,(1-tmpV.y)/2*H]; });
    for(let i=0;i<P.length-1;i++){ const [ax,ay]=P[i],[bx,by]=P[i+1], vx=bx-ax, vy=by-ay, L=vx*vx+vy*vy||1; let t=((mouse.x-ax)*vx+(mouse.y-ay)*vy)/L; t=Math.max(0,Math.min(1,t)); const d=Math.hypot(ax+vx*t-mouse.x, ay+vy*t-mouse.y);
      if(d<bd){ bd=d; best={ s, end:(i+t)<(P.length-1)/2?'a':'b' }; } } });
  return best; }
function cutString(s){ const i=strings.indexOf(s); if(i<0) return; strings.splice(i,1); if(s.mesh){ strGroup.remove(s.mesh); disposeGroup(s.mesh); } if(STR.hov===s) STR.hov=null; saveAll(); }
function stringPointer(e){ setNDC(e);
  if(e.button===2){ if(STR.hold){ dropString(); return true; } const hs=hitPrint(e)?null:hitString(); if(hs){ const s=hs.s; showMenu([['Cut this string','Del',()=>{ pushUndo(); cutString(s); toast('String cut.','Undo',undo); }],null,
      ...STR_COLORS.map(([n],i)=>i===s.c?null:['Make it '+n.toLowerCase(),'',()=>{ pushUndo(); s.c=i; s.key=''; saveAll(); }]).filter(Boolean)], e.clientX, e.clientY); return true; } return false; }
  if(swatchPointer()) return true;
  const sp=hitSpool();
  if(sp!=null&&!stringsOn){ setStringsOn(true); }
  if(sp!=null){ if(STR.hold&&!STR.hold.from){ STR.hold.c=sp; STR.last=sp; return true; } if(!STR.hold){ startString(sp,null); return true; } }
  if(!STR.hold){ if(hitPrint(e)) return false; const hs=hitString(); if(hs){ const s=hs.s; pushUndo(); const keep=hs.end==='a'?s.b:s.a; const i=strings.indexOf(s); strings.splice(i,1); if(s.mesh){ strGroup.remove(s.mesh); disposeGroup(s.mesh); }
      startString(s.c, keep, { c:s.c, a:s.a, b:s.b }); return true; } return false; }
  const p=hitPrint(e); let end=null;
  if(p&&p.wg) end={ id:p.id }; else { const h=wallHit(camera,ndc); if(h) end={ x:+h.x.toFixed(3), y:+h.y.toFixed(3) }; }
  if(!end) return true;
  if(!STR.hold.from){ STR.hold.from=end; toast('Now click another print, or a spot on the wall.'); return true; }
  if(end.id!=null&&end.id===STR.hold.from.id) return true;
  if(!STR.hold.orig) pushUndo(); strings.push({ id:++strN, c:STR.hold.c, a:STR.hold.from, b:end, mesh:null, key:'' }); dropString(false); saveAll(); tourEv('string'); { const s0=strings[strings.length-1], pa=s0.a.id!=null&&byId(s0.a.id), pb=s0.b.id!=null&&byId(s0.b.id); if(pa&&pb&&pa.wg&&pb.wg&&pa.wg!==pb.wg&&HOST&&HOST.flag) try{ HOST.flag('ltString'); }catch(e){} } return true; }
function showMenu(items,x,y){ hideActs(); CTX.innerHTML=''; items.forEach(it=>{ if(!it){ CTX.appendChild(document.createElement('hr')); return; } const b=document.createElement('button'); b.type='button'; b.innerHTML='<span></span><kbd></kbd>'; b.firstChild.textContent=it[0]; b.lastChild.textContent=it[1]; if(!it[1]) b.lastChild.remove();
    b.onclick=()=>{ closeCtx(); it[2](); }; CTX.appendChild(b); });
  CTX.classList.add('on'); const r=CTX.getBoundingClientRect(); CTX.style.left=Math.min(window.innerWidth-r.width-10,x)+'px'; CTX.style.top=Math.min(window.innerHeight-r.height-10,y)+'px'; }
const strSnap=()=>strings.map(s=>({ c:s.c, a:s.a, b:s.b }));
const DEMO_END=e=>e&&e.id==null&&((e.x===3.2&&e.y===12.6)||(e.x===4.6&&e.y===12.4));
function setStrings(list){ clearStringMeshes(); strings.length=0; (list||[]).filter(s=>!DEMO_END(s.a)&&!DEMO_END(s.b)).forEach(s=>strings.push({ id:++strN, c:s.c, a:s.a, b:s.b, mesh:null, key:'' })); }

/* ================= wall finish: a swatch card pinned top left of the wall ================= */
const SW={ x:-13.6, y:16.6 };
const swatch=new THREE.Group(); swatch.position.set(SW.x,SW.y,WALL_Z+0.05); scene.add(swatch);
{ const cv=document.createElement('canvas'); cv.width=1024; cv.height=420; const g=cv.getContext('2d'); g.fillStyle='#ede8de'; g.fillRect(0,0,1024,420); g.fillStyle='rgba(0,0,0,0.05)'; for(let i=0;i<4000;i++) g.fillRect(Math.random()*1024,Math.random()*420,2,2);
  g.fillStyle='#3a342c'; g.font='600 34px "Geist Mono", ui-monospace, monospace'; g.fillText('WALL FINISH', 40, 62);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; const card=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.9), new THREE.MeshBasicMaterial({ map:t })); swatch.add(card);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(4.6*1.12,1.9*1.25), new THREE.MeshBasicMaterial({ map:shadowTex, transparent:true, opacity:0.45, depthWrite:false })); sh.position.set(0.08,-0.12,-0.03); swatch.add(sh);
  const pins=makePins(4.6,1.9); pins.visible=true; pins.rotation.x=Math.PI/2; swatch.add(pins); }
const swatchChips=[];
function buildSwatches(){ scene.remove(swatch); return; WALLS.forEach(([key,name],i)=>{ const c=document.createElement('canvas'); c.width=c.height=160; paintWall(c.getContext('2d'),160,160,key,mulberry(3+i),true);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; const m=new THREE.Mesh(new THREE.PlaneGeometry(0.62,0.62), new THREE.MeshBasicMaterial({ map:t }));
    m.position.set(-2.3+0.45+i*0.74,-0.18,0.02); m.userData.wall=key; swatch.add(m); swatchChips.push(m);
    const lc=document.createElement('canvas'); lc.width=256; lc.height=48; const lg=lc.getContext('2d'); lg.fillStyle='#ede8de'; lg.fillRect(0,0,256,48); lg.fillStyle='rgba(58,52,44,0.85)'; lg.font='500 26px "Geist", system-ui, sans-serif'; lg.textAlign='center'; lg.fillText(name,128,34);
    const lt=new THREE.CanvasTexture(lc); lt.colorSpace=THREE.SRGBColorSpace; const lm=new THREE.Mesh(new THREE.PlaneGeometry(0.72,0.135), new THREE.MeshBasicMaterial({ map:lt })); lm.position.set(m.position.x,-0.62,0.021); swatch.add(lm); });
  const frame=new THREE.Mesh(new THREE.PlaneGeometry(0.72,0.72), new THREE.MeshBasicMaterial({ color:0x2a241c })); frame.position.z=0.01; swatch.add(frame); swatch.userData.frame=frame; markSwatch(); }
function markSwatch(){ const m=swatchChips.find(c=>c.userData.wall===wallStyle); if(m&&swatch.userData.frame){ swatch.userData.frame.position.x=m.position.x; swatch.userData.frame.position.y=m.position.y; } }
function hitSwatch(){ return null; ray.setFromCamera(ndc,camera); const h=ray.intersectObjects(swatchChips,false)[0]; return h?h.object.userData.wall:null; }
function swatchPointer(){ const k=hitSwatch(); if(!k) return false; if(k!==wallStyle){ wallStyle=k; saveAll(); drawWall(); markSwatch(); toast('Wall finish: '+WALLS.find(w=>w[0]===k)[1]+'.'); } return true; }

/* ================= wall finish + string toggle (small panel, only on the wall) ================= */
const WALL_SWATCH={ studio:'#24211e', cork:'#a87a4c', white:'#ece9e3', concrete:'#8f8c87', ply:'#e0cba3', linen:'#4d5560' };
function buildWallPick(){ const host=$('wpChips'); host.innerHTML='';
  WALLS.forEach(([key,name])=>{ const b=document.createElement('button'); b.type='button'; b.className='wchip2'+(key===wallStyle?' on':''); b.title=name; b.setAttribute('aria-label',name); if(wallTiles[key]) b.style.backgroundImage='url('+wallTiles[key].thumb+')'; else b.style.backgroundColor=WALL_SWATCH[key];
    b.onclick=()=>{ if(key===wallStyle) return; wallStyle=key; saveAll(); drawWall(); buildWallPick(); }; host.appendChild(b); });
  $('wpName').textContent=WALLS.find(w=>w[0]===wallStyle)[1]; }
let stringsOn=true; try{ stringsOn=localStorage.getItem('lt_strings')!=='off'; }catch(e){}
function setStringsOn(on){ stringsOn=on; strGroup.visible=on; $('wpStr').textContent=on?'String on':'String off'; $('wpStr').classList.toggle('on',on); saveAll(); if(!on) dropString(); }
$('wpStr').onclick=()=>setStringsOn(!stringsOn);

/* ================= move between table and wall by pushing the mouse to the edge ================= */
const EDGE={ t:0, dir:null };
function edgeFrame(dt){ const H=window.innerHeight; let dir=null;
  if(mouse.in&&mouse.t&&performance.now()-mouse.t<1500&&!drag.p&&!drag.wall&&!pan.on&&!inspected&&!BD.el.classList.contains('on')&&!CTX.classList.contains('on')){
    if(cam.view==='table'&&mouse.y<46) dir='up'; else if(cam.view==='wall'&&mouse.y>H*0.86) dir='down'; }
  if(dir&&dir===EDGE.dir) EDGE.t+=dt; else { EDGE.t=0; EDGE.dir=dir; }
  const up=$('edgeUp'), dn=$('edgeDown'); const th=tourHot(), tw=0.45+0.3*Math.sin(performance.now()/240); up.style.opacity=EDGE.dir==='up'?Math.min(1,0.25+EDGE.t*2.2):th==='edge'&&cam.view==='table'?tw:0; dn.style.opacity=EDGE.dir==='down'?Math.min(1,0.25+EDGE.t*2.2):th==='edgeDown'&&cam.view==='wall'?tw:0;
  if(EDGE.dir&&EDGE.t>0.42){ const d=EDGE.dir; EDGE.t=0; EDGE.dir=null; focus(d==='up'?'wall':'table'); } }
// leaving the window off the top or bottom edge also moves you
document.addEventListener('mouseout', e=>{ if(e.relatedTarget||(HOST&&e.clientY<=8)||drag.p||drag.wall||BD.el.classList.contains('on')) return;
  if(cam.view==='wall'&&e.clientY>=window.innerHeight-8) focus('table'); else if(cam.view==='table'&&e.clientY<=8) focus('wall'); });

/* ================= binder ================= */
const binder=new THREE.Group(); binder.position.set(BINDER.x,0,BINDER.z); binder.rotation.y=BINDER.rot; scene.add(binder);
const binderCv=document.createElement('canvas'); binderCv.width=1024; binderCv.height=Math.round(1024*BINDER.d/BINDER.w);
const binderTex=new THREE.CanvasTexture(binderCv); binderTex.colorSpace=THREE.SRGBColorSpace; binderTex.anisotropy=MAXANI;
{ const edgeCv=document.createElement('canvas'); edgeCv.width=512; edgeCv.height=64; const g=edgeCv.getContext('2d'); g.fillStyle='#1b2621'; g.fillRect(0,0,512,64); g.fillStyle='#e9e2d2'; g.fillRect(10,10,492,44); for(let y=12;y<54;y+=3){ g.fillStyle='rgba(0,0,0,'+(0.05+Math.random()*0.08)+')'; g.fillRect(10,y,492,1); }
  const tabsC=['#7f9a86','#e3ad57','#c0714f','#8a8478']; tabsC.forEach((c,i)=>{ g.fillStyle=c; g.fillRect(60+i*110,8,60,8); });
  const edgeTex=new THREE.CanvasTexture(edgeCv); edgeTex.colorSpace=THREE.SRGBColorSpace;
  const dark=new THREE.MeshLambertMaterial({ color:0x1b2621 }), edge=new THREE.MeshLambertMaterial({ map:edgeTex });
  const body=new THREE.Mesh(new THREE.BoxGeometry(BINDER.w,BINDER.h,BINDER.d), [edge,dark,new THREE.MeshBasicMaterial({ map:binderTex }),dark,edge,edge]); body.position.y=BINDER.h/2; binder.add(body);
  [['#7f9a86',-0.75],['#e3ad57',-0.2],['#c0714f',0.35]].forEach(([c,z])=>{ const t=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.2,0.36), new THREE.MeshLambertMaterial({ color:c })); t.position.set(BINDER.w/2+0.06,BINDER.h*0.55,z); binder.add(t); });
  blobShadow(BINDER.w+1.3,BINDER.d+1.3,binder,0.2,0.3); }
const binderGlow=new THREE.Mesh(new THREE.PlaneGeometry(BINDER.w+0.5,BINDER.d+0.5), new THREE.MeshBasicMaterial({ color:0xf4f1ea, transparent:true, opacity:0, depthWrite:false }));
binderGlow.rotation.x=-Math.PI/2; binderGlow.position.y=0.003; binder.add(binderGlow);
function hotRing(w,d,pad){ const W=w+pad*2, D=d+pad*2, k=56, c=document.createElement('canvas'); c.width=Math.round(W*k); c.height=Math.round(D*k); const g=c.getContext('2d'), m=0.55*k;
  g.shadowColor='rgba(214,140,30,.95)'; g.shadowBlur=0.45*k; g.strokeStyle='#d48a1c'; g.lineWidth=0.13*k; g.beginPath(); g.roundRect(m,m,c.width-2*m,c.height-2*m,0.35*k); g.stroke(); g.stroke(); g.shadowBlur=0; g.strokeStyle='#f0b85a'; g.lineWidth=0.05*k; g.stroke();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  const r=new THREE.Mesh(new THREE.PlaneGeometry(W,D), new THREE.MeshBasicMaterial({ map:t, transparent:true, opacity:0, depthWrite:false })); r.rotation.x=-Math.PI/2; r.renderOrder=5; return r; }
const RINGS={ binder:hotRing(BINDER.w,BINDER.d,0.75), box:hotRing(BOX.w,BOX.d,0.75), scan:hotRing(SC.w,SC.d,0.75), board:hotRing(BW,BH,0.55) };
RINGS.binder.position.y=0.012; binder.add(RINGS.binder); RINGS.box.position.set(BOX.x,0.012,BOX.z); RINGS.scan.position.set(SC.x,0.012,SC.z); RINGS.board.position.set(BX,0.03,BZ); scene.add(RINGS.box,RINGS.scan,RINGS.board);
const boardGlow=new THREE.Mesh(new THREE.PlaneGeometry(BW+0.7,BH+0.7), new THREE.MeshBasicMaterial({ color:0xe3ad57, transparent:true, opacity:0, depthWrite:false }));
boardGlow.rotation.x=-Math.PI/2; boardGlow.position.set(BX,0.002,BZ); scene.add(boardGlow);
const spoolGlow=new THREE.Mesh(new THREE.PlaneGeometry(SHELF.w+1,1.5), new THREE.MeshBasicMaterial({ color:0xe3ad57, transparent:true, opacity:0, depthWrite:false }));
spoolGlow.position.set(SHELF.x,SHELF.y+0.35,WALL_Z+0.012); scene.add(spoolGlow);
let binderBump=0;
function drawBinderCover(){ const g=binderCv.getContext('2d'), W=binderCv.width, H=binderCv.height, r=mulberry(5);
  g.fillStyle='#1d2a24'; g.fillRect(0,0,W,H); for(let i=0;i<14000;i++){ g.fillStyle=r()<0.5?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.025)'; g.fillRect(r()*W,r()*H,2,2); }
  g.fillStyle='#141d19'; g.fillRect(0,0,70,H); g.fillStyle='rgba(255,255,255,0.05)'; g.fillRect(70,0,3,H);
  g.strokeStyle='rgba(244,241,234,0.3)'; g.lineWidth=3; g.strokeRect(110,36,W-146,H-72);
  g.fillStyle='#efe9dc'; g.fillRect(W/2-190+35,H/2-92,380,184); g.strokeStyle='rgba(0,0,0,0.2)'; g.lineWidth=2; g.strokeRect(W/2-190+35+8,H/2-84,364,168);
  g.fillStyle='#2a241c'; g.textAlign='center'; g.font='400 56px "Fraunces", Georgia, serif'; g.fillText('Binder', W/2+35, H/2+4);
  const out=library.filter(i=>itemStatus(i)!=='in').length;
  g.font='500 22px "Geist Mono", ui-monospace, monospace'; g.fillStyle='#7a6a52'; g.fillText(library.length+' PHOTOS  ·  '+out+' OUT', W/2+35, H/2+52); g.textAlign='left';
  binderTex.needsUpdate=true; }
function inBinder(x,z){ const c=Math.cos(BINDER.rot), s=Math.sin(BINDER.rot), dx=x-BINDER.x, dz=z-BINDER.z, lx=dx*c-dz*s, lz=dx*s+dz*c; return Math.abs(lx)<BINDER.w/2+0.3 && Math.abs(lz)<BINDER.d/2+0.3; }
function binderHit(e){ setNDC(e); ray.setFromCamera(ndc,camera); return ray.intersectObject(binder,true).some(h=>h.object!==binderGlow); }
function importImage(img){ const c=borderCanvas(img,1600,null); const k=Math.min(1,900/Math.max(c.width,c.height)), s=document.createElement('canvas'); s.width=c.width*k; s.height=c.height*k; s.getContext('2d').drawImage(c,0,0,s.width,s.height);
  const it=libAdd(c,'own',img.width<img.height?2.35:2.2,null,s.toDataURL('image/jpeg',0.84)); it.name='Imported'; it.place='Uploads'; saveAll(); drawBinderCover(); return it; }
function pullOut(ids){ if(!ids.length) return; prepare(ids,()=>pullOutNow(ids.filter(id=>{ const it=libById(id); return it&&it.canvas; }))); }
function pullOutNow(ids){ if(!ids.length) return; pushUndo(); if(cam.view==='wall') focus('table'); binderBump=0.06;
  ids.forEach((id,i)=>{ const p=ensurePrint(id); if(!p) return; p.order=++orderN; p.x=p.tx=BINDER.x+(Math.random()-0.5)*0.8; p.z=p.tz=BINDER.z-0.3; p.y=BINDER.h+0.2+i*0.02; p.vy=2.5; p.yaw=p.yawT=BINDER.rot+(Math.random()-0.5)*0.2; p.base=BINDER.h; p.locked=true;
    setTimeout(()=>{ p.locked=false; toPile(p); restack(); }, 120+i*70); });
  setTimeout(()=>{ restack(); drawBinderCover(); saveAll(); }, 160+ids.length*70); tourEv('pull');
  toast(ids.length===1?'Pulled one out onto the pile.':'Pulled '+ids.length+' out onto the pile.','Undo',undo); }
function fileBack(p,quiet){ if(p.locked&&!quiet) return; if(p.rejected) unreject(p); removeFromBoard(p); layoutBoard(null); updateChains(false);
  p.locked=true; p.tx=BINDER.x; p.tz=BINDER.z; p.yawT=BINDER.rot; p.base=BINDER.h+0.05; binderBump=0.05;
  setTimeout(()=>{ removePrint(p); binderBump=0.07; saveAll(); if(!quiet) toast('Filed back in the binder.','Undo',undo); }, 340); }

const BD={ el:$('bd'), s:0, key:'all', sel:new Set(), busy:false };
const thumbOf=it=>{ if(it.thumb) return it.thumb; if(!it.canvas) return it.url||''; const c=it.canvas, k=Math.min(1,460/Math.max(c.width,c.height)), t=document.createElement('canvas'); t.width=c.width*k; t.height=c.height*k; t.getContext('2d').drawImage(c,0,0,t.width,t.height); return it.thumb=t.toDataURL('image/jpeg',0.82); };
const PER=6;
const nSpreads=()=>Math.max(1,Math.ceil(folderItems(BD.key).length/(PER*2)));
const WHERE={ table:'On the table', board:'On the board', wall:'On the wall', rejects:'In rejects' };
function pageHTML(pi){ const all=folderItems(BD.key), items=all.slice(pi*PER,(pi+1)*PER);
  let h='<div class="bd-head">SLEEVE '+String(pi+1).padStart(2,'0')+'</div><div class="bd-grid">';
  for(let k=0;k<PER;k++){ const it=items[k];
    if(!it){ h+='<div class="pk empty"></div>'; continue; }
    const st=itemStatus(it), sel=BD.sel.has(it.id);
    h+='<button type="button" class="pk '+(st==='in'?'in':'out')+(sel?' sel':'')+'" data-id="'+it.id+'" aria-pressed="'+sel+'" title="'+(st==='in'?'Click to pick, double-click to pull out now':WHERE[st])+'">'
      +'<span class="ph">'+(st==='in'?'<img alt="" src="'+thumbOf(it)+'">':'<span class="where">'+WHERE[st]+'</span>')+'</span>'
      +'<span class="lab">'+(it.pick?'<i>★</i> ':'')+(it.name||'')+'</span></button>'; }
  return h+'</div>'; }
const TABC={ all:'#8a8478', picks:'#e3ad57', place:'#7f9a86', sub:'#7f9a86', proj:'#c0714f' };
function bdRender(){ const n=nSpreads(); BD.s=Math.min(BD.s,n-1);
  $('bdL').innerHTML=pageHTML(BD.s*2); $('bdR').innerHTML=pageHTML(BD.s*2+1);
  const tabs=$('bdTabs'); tabs.innerHTML=''; let lastKind='';
  folders().forEach(f=>{ if(f.kind==='proj'&&lastKind!=='proj'){ const s=document.createElement('div'); s.className='tab-sep'; s.textContent='Projects'; tabs.appendChild(s); } lastKind=f.kind;
    const b=document.createElement('button'); b.type='button'; b.className='tab '+f.kind+(f.key===BD.key?' on':''); b.style.setProperty('--tc',TABC[f.kind]);
    const n=folderItems(f.key), inn=n.filter(i=>itemStatus(i)==='in').length; b.innerHTML='<span></span><em>'+inn+'</em>'; b.firstChild.textContent=f.name; b.title=n.length+' photos, '+inn+' in the binder';
    b.onclick=()=>{ if(BD.key===f.key) return; BD.key=f.key; BD.s=0; const book=BD.el.querySelector('.bd-book'); book.classList.remove('swap'); void book.offsetWidth; book.classList.add('swap'); bdRender(); }; tabs.appendChild(b); });
  bdFoot(); }
function bdFoot(){ const all=folderItems(BD.key), out=all.filter(i=>itemStatus(i)!=='in').length, n=nSpreads();
  $('bdFolder').textContent=folderName(BD.key); $('bdInfo').textContent=all.length+' photos  ·  '+out+' out';
  $('bdPage').textContent=(BD.s+1)+' / '+n; $('bdPrev').disabled=BD.s<=0; $('bdNext').disabled=BD.s>=n-1;
  const inn=all.length-out; $('bdTip').disabled=!inn; $('bdTip').textContent=inn?'Tip out this folder ('+inn+')':'All of this folder is out';
  const b=$('bdPull'); b.textContent=BD.sel.size?'Pull out '+BD.sel.size:'Pull out'; b.disabled=!BD.sel.size; }
function bdTurn(d){ if(BD.busy) return; const n=nSpreads(), to=BD.s+d; if(to<0||to>=n) return; BD.busy=true;
  const leaf=$('bdLeaf'), L=$('bdL'), Rr=$('bdR');
  leaf.className='bd-leaf '+(d>0?'fwd':'back'); leaf.style.transition='none'; leaf.style.transform='rotateY(0deg)';
  leaf.querySelector('.front').innerHTML=d>0?pageHTML(BD.s*2+1):pageHTML(BD.s*2);
  leaf.querySelector('.back').innerHTML=d>0?pageHTML(to*2):pageHTML(to*2+1);
  if(d>0) Rr.innerHTML=pageHTML(to*2+1); else L.innerHTML=pageHTML(to*2);
  leaf.hidden=false; void leaf.offsetWidth; leaf.style.transition=''; leaf.style.transform=d>0?'rotateY(-180deg)':'rotateY(180deg)';
  setTimeout(()=>{ if(d>0) L.innerHTML=pageHTML(to*2); else Rr.innerHTML=pageHTML(to*2+1); leaf.hidden=true; BD.s=to; BD.busy=false; bdFoot(); }, 760); }
function openBinder(){ if(BD.el.classList.contains('on')) return; closeInspect(); closeNote(); closeCtx(); hideActs(); BD.sel.clear(); binderBump=0.05; bdRender(); BD.el.classList.add('on'); tourEv('binder'); }
function closeBinder(){ BD.el.classList.remove('on'); }
BD.el.addEventListener('click', e=>{ const pk=e.target.closest('.pk'); if(!pk||!pk.dataset.id||e.target.closest('.bd-leaf')) return; const id=pk.dataset.id, it=libById(id), st=itemStatus(it);
  if(st!=='in'){ toast('That one’s '+WHERE[st].toLowerCase()+'.'); return; }
  BD.sel.has(id)?BD.sel.delete(id):BD.sel.add(id); pk.classList.toggle('sel'); pk.setAttribute('aria-pressed',BD.sel.has(id)); bdFoot(); });
BD.el.addEventListener('dblclick', e=>{ const pk=e.target.closest('.pk.in'); if(!pk) return; const id=pk.dataset.id; BD.sel.delete(id); closeBinder(); pullOut([id]); });
$('bdPrev').onclick=()=>bdTurn(-1); $('bdNext').onclick=()=>bdTurn(1);
$('bdClose').onclick=closeBinder; BD.el.querySelector('.bd-backdrop').onclick=closeBinder;
$('bdSelPage').onclick=()=>{ folderItems(BD.key).slice(BD.s*2*PER,(BD.s*2+2)*PER).forEach(it=>{ if(itemStatus(it)==='in') BD.sel.add(it.id); }); bdRender(); };
$('bdPull').onclick=()=>{ const ids=[...BD.sel]; if(!ids.length) return; BD.sel.clear(); closeBinder(); pullOut(ids); };
$('bdTip').onclick=()=>{ const ids=folderItems(BD.key).filter(i=>itemStatus(i)==='in').map(i=>i.id); if(!ids.length) return; BD.sel.clear(); closeBinder(); pullOut(ids); };
$('bdFile').onchange=e=>{ const files=[...e.target.files].filter(f=>/^image\//.test(f.type)); let left=files.length;
  if(HOST){ if(files.length){ HOST.importFiles(files); toast('Adding '+files.length+' photo'+(files.length>1?'s':'')+' to your library. They\u2019ll be in the binder in a moment.'); } e.target.value=''; return; }
  files.forEach(f=>{ const url=URL.createObjectURL(f), img=new Image(); img.onload=()=>{ importImage(img); URL.revokeObjectURL(url); if(--left===0){ BD.key='place:Uploads'; BD.s=nSpreads()-1; bdRender(); toast(files.length+' photo'+(files.length>1?'s':'')+' filed under Uploads.'); } }; img.src=url; });
  e.target.value=''; };
$('bBinder').onclick=openBinder;

/* ================= the copier ================= */
const SCAN={ busy:false, t:0, p:null, q:null, made:false, done:false };
function copyPrint(p){ if(SCAN.busy){ toast('The copier is busy. One at a time.'); return; } if(!p||p.wg) return;
  pushUndo(); SCAN.busy=true; SCAN.made=false; SCAN.done=false; SCAN.q=null; SCAN.p=p; SCAN.t=-0.9; hideActs();
  if(p.rejected) unreject(p); removeFromBoard(p); layoutBoard(null); updateChains(false);
  p.locked=true; p.order=++orderN; p.tx=GLASS.x; p.tz=GLASS.z; p.yawT=0; p.base=scanner.userData.top+0.022; restack();
  if(cam.view==='wall') focus('table'); }
function scanFrame(dt){ const top=scanner.userData.top, open=-1.95;
  let lidT=cam.view==='wall'?0:open, leak=0;
  if(SCAN.busy){ SCAN.t+=dt/1.35; const t=SCAN.t;
    if(t>-0.5&&t<1.12) lidT=0;
    scanBar.visible=t>=0&&t<=1; if(scanBar.visible){ scanBar.position.x=GLASS.x-GLASS.w/2+t*GLASS.w; leak=0.55+0.25*Math.sin(t*30); }
    if(t>-0.05&&!SCAN.lcd1){ SCAN.lcd1=true; drawLCD('SCANNING'); }
    if(t>1&&!SCAN.made){ SCAN.made=true; drawLCD('PRINTING'); const p=SCAN.p, src=libById(p.id);
      const nth=library.filter(i=>(i.copyOf||i.id)===(src.copyOf||src.id)).length+1, base=(src.copyOf?libById(src.copyOf):src)||src;
      const it=libAdd(src.canvas, src.kind, src.long, null, src.data); it.copyOf=src.copyOf||src.id; it.place=src.place; it.url=src.url; it.sample=src.sample; it.name=(base.name||'Print')+' · '+(nth===2?'2nd':nth===3?'3rd':nth+'th');
      const q=ensurePrint(it.id); q.locked=true; q.order=++orderN; q.x=SC.x+SC.w/2-q.w/2-0.1; q.z=SC.z+0.05; q.y=0.3; q.base=0.27; q.yaw=q.yawT=0; q.tx=SC.x+SC.w/2+0.35+q.w/2; q.tz=SC.z+0.05; SCAN.q=q; }
    if(t>1.6&&SCAN.q&&SCAN.q.base>0.1){ SCAN.q.base=0; SCAN.q.tz=SC.z+0.4; SCAN.q.yawT=0.06; }
    if(t>1.95&&!SCAN.done){ SCAN.done=true; const p=SCAN.p, q=SCAN.q;
      q.locked=false; p.locked=false; p.tx=SC.x+0.2; p.tz=SC.z+SC.d/2+0.4+p.h/2; p.yawT=(Math.random()-0.5)*0.12; restack();
      SCAN.busy=false; SCAN.lcd1=false; drawLCD('READY'); saveAll(); tourEv('copy'); drawBinderCover(); toast('Printed another copy. It’s filed in the binder too.','Undo',undo); } }
  else scanBar.visible=false;
  lidHinge.rotation.x+=(lidT-lidHinge.rotation.x)*(1-Math.exp(-dt*(lidT===0?6:4.5)));
  lidLeak.material.opacity+=(leak-lidLeak.material.opacity)*(1-Math.exp(-dt*12)); }

/* ================= wall history ================= */
let hist=[], histIdx=-1; const ghosts=new THREE.Group(); scene.add(ghosts); const ghostTex=new Map();
function wallSig(){ return JSON.stringify([wallGroups.map(g=>[g.members.map(p=>p.id),Math.round(g.x*4),Math.round(g.y*4)]),strings.map(s=>[s.c,s.a,s.b])]); }
function saveHist(){ saveAll(); }
function recordHist(){ if(!wallGroups.length) return; const sig=wallSig(); const last=hist[hist.length-1]; if(last&&last.sig===sig) return;
  const e={ t:Date.now(), sig, groups:wallGroups.map(g=>({ ids:g.members.map(p=>p.id), x:g.x, y:g.y })), strings:strings.map(s=>{ const a=endPos(s.a), b=endPos(s.b); return a&&b?{ c:s.c, ax:a.x, ay:a.y, bx:b.x, by:b.y }:null; }).filter(Boolean) };
  if(last&&!last.seed&&e.t-last.t<3600e3) hist[hist.length-1]=e; else hist.push(e); saveHist(); }
function histList(){ const cur=wallSig(); return hist.filter(e=>e.sig!==cur); }
function setHist(i){ if(i>=0){ const L0=histList(), e0=L0[L0.length-1-Math.min(i,L0.length-1)]; if(e0){ const need=[].concat(...e0.groups.map(g=>g.ids)).filter(id=>{ const it=libById(id); return it&&!it.canvas; }); if(need.length){ prepare(need,()=>setHist(i)); return; } } }
  const L=histList(); histIdx=Math.max(-1,Math.min(i,L.length-1)); ghosts.children.forEach(o=>{ if(o.isGroup) disposeGroup(o); }); ghosts.clear(); if(histIdx>=0) dropString();
  if(histIdx>=0){ hideActs(); const e=L[L.length-1-histIdx];
    e.groups.forEach(gr=>{ const its=gr.ids.map(libById).filter(it=>it&&it.canvas); if(!its.length) return; const dims=its.map(it=>{ const a=it.canvas.width/it.canvas.height; return a>=1?[it.long,it.long/a]:[it.long*a,it.long]; });
      let x=gr.x-(dims.reduce((s,d)=>s+d[0],0)+0.28*(its.length-1))/2;
      its.forEach((it,k)=>{ const [w,h]=dims[k]; let tx=ghostTex.get(it.id); if(!tx){ tx=makeTex(it.canvas); ghostTex.set(it.id,tx); }
        const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({ map:tx })); m.position.set(x+w/2,gr.y,WALL_Z+0.05); ghosts.add(m);
        const s=new THREE.Mesh(new THREE.PlaneGeometry(w*1.33,h*1.33), new THREE.MeshBasicMaterial({ map:shadowTex, transparent:true, opacity:0.5, depthWrite:false })); s.position.set(x+w/2+0.09,gr.y-0.14,WALL_Z+0.02); ghosts.add(s);
        const pins=makePins(w,h); pins.visible=true; pins.rotation.x=Math.PI/2; pins.position.set(x+w/2,gr.y,WALL_Z+0.05); ghosts.add(pins); x+=w+0.28; }); });
    (e.strings||[]).forEach(s=>ghosts.add(makeStringMesh(STR_COLORS[s.c][1],V(s.ax,s.ay,WALL_Z+0.12),V(s.bx,s.by,WALL_Z+0.12)))); }
  renderHist(); }
const fmtDay=t=>new Date(t).toLocaleDateString('en-NZ',{ weekday:'short', day:'numeric', month:'short' });
function renderHist(){ const L=histList(); $('hLab').textContent=histIdx<0?'Now':fmtDay(L[L.length-1-histIdx].t); $('hPrev').disabled=histIdx>=L.length-1; $('hNext').disabled=histIdx<0;
  const b=$('histBanner'); if(histIdx>=0){ b.querySelector('span').textContent='Your wall on '+fmtDay(L[L.length-1-histIdx].t)+'. Look back at what you thought worked then.'; b.classList.add('on'); } else b.classList.remove('on');
  document.body.classList.toggle('past', histIdx>=0); }
$('hPrev').onclick=()=>{ if(histIdx<0) recordHist(); setHist(histIdx+1); }; $('hNext').onclick=()=>setHist(histIdx-1); $('hNow').onclick=()=>setHist(-1);
document.addEventListener('visibilitychange',()=>{ if(document.hidden) recordHist(); });

/* ================= photobook + workbook ================= */
let BOOK=[]; try{ BOOK=JSON.parse(localStorage.getItem(BOOK_KEY)||'[]'); }catch(e){ BOOK=[]; }
function sendToBook(ids, note){
  if(HOST){ const own=ids.map(realId).filter(Boolean); if(!own.length){ toast('Hmm, those prints couldn\u2019t go to the book. Try pulling them out of the binder again.'); return; }
    HOST.sendToBook(own, note?noteSummary(note):''); toast('Added to your photobook in this order.','Open book',()=>HOST.room('book')); return; }
  BOOK.push({ ids:ids.slice(), date:new Date().toLocaleDateString('en-NZ',{ day:'numeric', month:'short' }), note:note?noteSummary(note):'' }); try{ localStorage.setItem(BOOK_KEY, JSON.stringify(BOOK)); }catch(e){}
  renderWorkbook(); const b=$('bBook'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); toast('Sent to the photobook in this order. The builder lays it out as spreads.'); }
const workbook=[];
const capCam=new THREE.OrthographicCamera(-BW/2*1.03, BW/2*1.03, BH/2*1.03, -BH/2*1.03, 1, 60);
capCam.position.set(BX,30,BZ); capCam.up.set(0,0,-1); capCam.lookAt(BX,0,BZ); capCam.updateMatrixWorld();
function captureBoard(){
  if(!prints.some(p=>p.onBoard)){ toast('Put some prints on the board first.'); return; }
  if(HOST){ closeNote(); hideActs(); const pg=hostPage(); if(!pg){ toast('Hmm, those prints couldn\u2019t go to your workbook. Try pulling them out of the binder again.'); return; }
    HOST.addWorkbookPage(pg); const fl=$('flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); tourEv('capture');
    toast('Added to your workbook as a new page. Write on it there.','Open workbook',()=>HOST.room('workshop')); return; }
  tourEv('capture');
  closeNote(); closeInspect(); hideActs();
  const cw=2400, ch=Math.round(2400*BH/BW);
  const vis=[ghost.visible, loupeProp.visible, dim.visible]; ghost.visible=false; loupeProp.visible=false; dim.visible=false;
  const lampWas=lamp.clone(); lamp.set(BX-4,14,BZ-6);
  const pr=renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(cw,ch,false);
  renderer.setRenderTarget(null); renderer.render(scene,capCam);
  const shot=document.createElement('canvas'); shot.width=cw; shot.height=ch; shot.getContext('2d').drawImage(renderer.domElement,0,0);
  renderer.setPixelRatio(pr); resize(); lamp.copy(lampWas); ghost.visible=vis[0]; loupeProp.visible=vis[1]; dim.visible=vis[2];
  const g=shot.getContext('2d'), sx=cw/(BW*1.03), toPx=(x,z)=>[(x-(BX-BW*1.03/2))*sx, (z-(BZ-BH*1.03/2))*sx];
  chains.forEach((c,ci)=>{ const bb=bboxOf(c); const [lx,ly]=toPx(bb.x0, bb.z1); g.fillStyle='rgba(244,241,234,0.85)'; g.font='500 26px "Geist Mono", ui-monospace, monospace'; g.fillText(String.fromCharCode(65+ci), lx, ly+40); });
  const page=buildPage(shot); workbook.push(page); flyToWorkbook(page); renderWorkbook(); }
function buildPage(shot){
  const date=new Date().toLocaleDateString('en-NZ',{ day:'numeric', month:'long', year:'numeric' });
  const list=chains.map((c,i)=>({ tag:String.fromCharCode(65+i), kind:c.length===2?'Pair':'Sequence of '+c.length, note:notes.get(chainKey(c)), prints:c.map(p=>p.canvas) }));
  const P=document.createElement('canvas'); const g=P.getContext('2d');
  const serif='"Fraunces", Georgia, serif', sans='"Geist", system-ui, sans-serif', mono='"Geist Mono", ui-monospace, monospace';
  const wrap=(t,x,y,w,lh)=>{ let line=''; t.split(' ').forEach(wd=>{ const tt=line?line+' '+wd:wd; if(g.measureText(tt).width>w&&line){ g.fillText(line,x,y); y+=lh; line=wd; } else line=tt; }); if(line){ g.fillText(line,x,y); y+=lh; } return y; };
  P.width=4960; P.height=3508; g.fillStyle='#f5f2ec'; g.fillRect(0,0,P.width,P.height);
  const gut=g.createLinearGradient(P.width/2-90,0,P.width/2+90,0); gut.addColorStop(0,'rgba(0,0,0,0)'); gut.addColorStop(0.5,'rgba(0,0,0,0.09)'); gut.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gut; g.fillRect(P.width/2-90,0,180,P.height);
  const iw=P.width/2-360, ih=iw*shot.height/shot.width, iy=(P.height-ih)/2; g.fillStyle='rgba(0,0,0,0.18)'; g.fillRect(190,iy+14,iw,ih); g.drawImage(shot,180,iy,iw,ih);
  g.fillStyle='#8a7f6e'; g.font='500 30px '+mono; g.fillText('A1 BOARD  ·  '+date.toUpperCase()+'  ·  '+rejects.length+' IN THE REJECT BOX', 180, iy-50);
  const X=P.width/2+180; let y=330; g.fillText('WORKBOOK  ·  SELECTION AND SEQUENCE', X, y-100);
  g.fillStyle='#1b1814'; g.font='400 92px '+serif; g.fillText('Why these go together', X, y); y+=150;
  list.forEach(it=>{ let tx=X; const th=220; it.prints.forEach(cv=>{ const tw=th*cv.width/cv.height; g.fillStyle='rgba(0,0,0,0.15)'; g.fillRect(tx+6,y+8,tw,th); g.drawImage(cv,tx,y,tw,th); tx+=tw+24; });
    g.fillStyle='#8a6a2e'; g.font='600 34px '+mono; g.fillText(it.tag+'  ·  '+it.kind.toUpperCase(), X, y+th+70);
    g.fillStyle='#2c2822'; g.font='400 40px '+sans; let yy=wrap(it.note?noteSummary(it.note):'No note yet.', X, y+th+130, P.width/2-380, 56);
    g.strokeStyle='rgba(0,0,0,0.12)'; g.lineWidth=2; for(let l=0;l<2;l++){ yy+=22; g.beginPath(); g.moveTo(X,yy); g.lineTo(P.width-200,yy); g.stroke(); yy+=40; }
    y=yy+70; });
  return { canvas:P, date, url:P.toDataURL('image/jpeg',0.86) }; }
function flyToWorkbook(page){
  const fl=$('flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  const img=document.createElement('img'); img.className='fly'; img.src=page.url; document.body.appendChild(img);
  const t=$('bBook').getBoundingClientRect(), W=window.innerWidth, H=window.innerHeight, w=Math.min(W*0.6,900);
  img.style.cssText='left:'+(W/2-w/2)+'px; top:'+(H/2-w*page.canvas.height/page.canvas.width/2)+'px; width:'+w+'px;';
  setTimeout(()=>{ img.style.transform='translate('+(t.left+t.width/2-(W/2))+'px,'+(t.top+t.height/2-(H/2))+'px) scale(0.05)'; img.style.opacity='0.2'; }, 650);
  setTimeout(()=>{ img.remove(); const b=$('bBook'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); toast('Added to your workbook as page '+workbook.length+'.'); }, 1450); }
function renderWorkbook(){ if(HOST) return; $('bookN').textContent=workbook.length+BOOK.length;
  const bk=$('wbBook'); bk.innerHTML=''; if(!BOOK.length) bk.innerHTML='<p class="empty">Nothing sent yet. Hover a pair or sequence and choose Send to photobook.</p>';
  BOOK.forEach((s,si)=>{ const row=document.createElement('div'); row.className='bkrow'; const strip=document.createElement('div'); strip.className='bkstrip';
    s.ids.forEach(id=>{ const it=libById(id); if(!it) return; const im=document.createElement('img'); im.alt=''; im.src=thumbOf(it); strip.appendChild(im); });
    const meta=document.createElement('div'); meta.className='bkmeta'; meta.innerHTML='<span></span>'; meta.firstChild.textContent=(s.ids.length===2?'Pair':'Sequence of '+s.ids.length)+' · '+s.date+(s.note?' · '+s.note:'');
    const rm=document.createElement('button'); rm.type='button'; rm.className='btn'; rm.textContent='Remove'; rm.onclick=()=>{ BOOK.splice(si,1); try{ localStorage.setItem(BOOK_KEY, JSON.stringify(BOOK)); }catch(e){} renderWorkbook(); }; meta.appendChild(rm);
    row.appendChild(strip); row.appendChild(meta); bk.appendChild(row); });
  const g=$('wbGrid'); g.innerHTML='';
  if(!workbook.length){ g.innerHTML='<p class="empty">No pages yet. Arrange the board, then choose Add board to workbook.</p>'; return; }
  workbook.forEach((pg,i)=>{ const f=document.createElement('button'); f.type='button'; f.className='wbp'; f.innerHTML='<img alt="Workbook page '+(i+1)+'" src="'+pg.url+'"><span>Page '+(i+1)+' · '+pg.date+'</span>';
    f.onclick=()=>{ const v=$('wbView'); v.querySelector('img').src=pg.url; v.classList.add('on'); }; g.appendChild(f); }); }
$('bBook').onclick=()=>{ if(HOST){ HOST.room('workshop'); return; } renderWorkbook(); $('wb').classList.toggle('on'); };
$('wbClose').onclick=()=>$('wb').classList.remove('on');
$('wbView').onclick=e=>e.currentTarget.classList.remove('on');
$('bCapture').onclick=captureBoard;

/* ================= UI ================= */
function hint(t){ const h=$('inspectHint'); if(t){ h.textContent=t; h.classList.add('on'); } else h.classList.remove('on'); }
let toastT=0; function toast(t,label,fn){ const el=$('toast'); el.querySelector('span').textContent=t; const b=$('toastAct'); if(label){ b.hidden=false; b.textContent=label; b.onclick=()=>{ el.classList.remove('on'); fn(); }; } else b.hidden=true;
  el.classList.toggle('act',!!label); el.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('on'),label?5200:4200); }
function buildPanel(){ const host=$('opts'); host.innerHTML='';
  Object.keys(OPTS).forEach(k=>{ const row=document.createElement('div'); row.className='opt';
    const lab=document.createElement('div'); lab.className='opt-l'; lab.innerHTML='<span>'+LABEL[k]+'</span><em id="n_'+k+'"></em>'; row.appendChild(lab);
    const chips=document.createElement('div'); chips.className='chips';
    Object.keys(OPTS[k]).forEach(letter=>{ const b=document.createElement('button'); b.className='chip'; b.type='button'; b.id='o_'+k+'_'+letter; b.textContent=letter; b.title=OPTS[k][letter];
      b.onclick=()=>{ if(k==='board'&&pick.board===letter) return; pick[k]=letter; const was=pick[k]; try{ localStorage.setItem('lt_pick7',JSON.stringify(pick)); }catch(e){} if(k==='board') switchBoardMode(); applyOpts(); }; chips.appendChild(b); });
    row.appendChild(chips); host.appendChild(row); });
  applyOpts(); }
function applyOpts(){ Object.keys(OPTS).forEach(k=>{ Object.keys(OPTS[k]).forEach(l=>$('o_'+k+'_'+l).classList.toggle('on',pick[k]===l)); $('n_'+k).textContent=OPTS[k][pick[k]]; });
  hideActs(); drawChains(); $('summary').textContent=Object.keys(pick).map(k=>pick[k]).join(''); }
$('bScatter').onclick=()=>{ closeInspect(); pushUndo(); scatter(false); saveAll(); };
$('bClear').onclick=()=>{ const on=prints.filter(p=>p.onBoard); if(!on.length) return; pushUndo(); on.forEach(p=>{ removeFromBoard(p); toPile(p); }); restack(); updateChains(false); saveAll(); toast('Board cleared.','Undo',undo); };
$('bLoupe').onclick=()=>setLoupe(!loupe.on);
$('bBoard').onclick=()=>focus('board'); $('bTable').onclick=()=>focus('table'); $('bWall').onclick=()=>focus(cam.view==='wall'?'table':'wall');
$('bPanel').onclick=()=>document.body.classList.toggle('panel-closed');
$('bCopy').onclick=()=>{ const t=Object.keys(pick).map(k=>LABEL[k]+' '+pick[k]).join(', '); const done=()=>toast('Copied: '+t); try{ navigator.clipboard.writeText(t).then(done,()=>toast(t)); }catch(e){ toast(t); } };
window.addEventListener('keydown', e=>{ if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT') return;
  if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')){ e.preventDefault(); undo(); return; }
  if(BD.el.classList.contains('on')){ if(e.key==='Escape') closeBinder(); else if(e.key==='ArrowRight') bdTurn(1); else if(e.key==='ArrowLeft') bdTurn(-1); return; }
  if(e.key==='Escape'&&STR.hold){ dropString(); return; }
  if(e.key==='Escape'){ closeCtx(); if(pop.classList.contains('on')) closeNote(); else if(inspected) closeInspect(); else if(loupe.on) setLoupe(false); else if(histIdx>=0) setHist(-1); else if(HOST&&!CTX.classList.contains('on')) HOST.key('Escape'); return; }
  const k=e.key.toLowerCase(), p=HOV.p;
  if(e.key==='?'){ TOUR.on?tourEnd(false):tourStart(); return; }
  if(HOST&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(k==='q'||k==='e')){ HOST.key(e.key); return; }
  if(k==='l') setLoupe(!loupe.on); else if(k==='w') focus(cam.view==='wall'?'table':'wall'); else if(k==='b') openBinder();
  else if((k==='delete'||k==='backspace')&&STR.hold&&STR.hold.orig){ STR.hold.orig=null; dropString(false); saveAll(); toast('String cut.','Undo',undo); }
  else if((k==='delete'||k==='backspace')&&STR.hov){ pushUndo(); cutString(STR.hov); toast('String cut.','Undo',undo); }
  else if(p&&!inspected&&(k===']'||k==='[')) resizePrint(p,k===']'?1:-1);
  else if(p&&!inspected){ if(k==='x') act('reject',p); else if(k==='f') act('file',p); else if(k==='c') act('copy',p); else if(k==='p') act(e.shiftKey?'pin':'pin1',p); } });
window.addEventListener('dragover', e=>{ e.preventDefault(); document.body.classList.add('dropping'); });
window.addEventListener('dragleave', e=>{ if(e.target===document.documentElement||e.clientX<=0) document.body.classList.remove('dropping'); });
window.addEventListener('drop', e=>{ e.preventDefault(); document.body.classList.remove('dropping'); if(cam.view==='wall') focus('table'); setNDC(e); const at=planeHit(camera,ndc,0)||V((PILE.x0+PILE.x1)/2,0,0);
  const files=[...(e.dataTransfer.files||[])].filter(f=>/^image\//.test(f.type));
  if(HOST){ if(files.length){ HOST.importFiles(files); toast('Adding '+files.length+' photo'+(files.length>1?'s':'')+' to your library. Find them in the binder.'); } return; }
  if(files.length) pushUndo();
  files.forEach((f,i)=>{ const url=URL.createObjectURL(f), img=new Image();
    img.onload=()=>{ const it=importImage(img); const p=ensurePrint(it.id); p.tx=p.x=THREE.MathUtils.clamp(at.x+(i%4)*0.5-0.75,PILE.x0,PILE.x1); p.tz=p.z=THREE.MathUtils.clamp(at.z+Math.floor(i/4)*0.5,PILE.z0,PILE.z1); p.yawT=p.yaw=(Math.random()-0.5)*0.5; p.y=2+i*0.1; restack(); drawBinderCover(); URL.revokeObjectURL(url); };
    img.src=url; });
  if(files.length) toast(files.length+' photo'+(files.length>1?'s':'')+' added to the pile and filed under Uploads.'); });

/* ================= frame loop ================= */
const qYaw=new THREE.Quaternion(), qTilt=new THREE.Quaternion(), qInsp=new THREE.Quaternion(), qA=new THREE.Quaternion(), qWall0=new THREE.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI/2), eul=new THREE.Euler();
const mBasis=new THREE.Matrix4(), vR=V(0,0,0), vU=V(0,0,0), vB=V(0,0,0), vF=V(0,0,0);
const insPos=V(0,0,0), tabPos=V(0,0,0), wallPos=V(0,0,0), basePos=V(0,0,0), baseQ=new THREE.Quaternion(), up=V(0,1,0);
const wrapPI=a=>{ a=(a+Math.PI)%(Math.PI*2); if(a<0) a+=Math.PI*2; return a-Math.PI; };
let tilt={x:0,y:0}, last=performance.now();
function resize(){ const w=window.innerWidth, h=window.innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); ovCam.right=w; ovCam.bottom=-h; ovCam.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();
let PAUSED=false, looping=false, READY=false;
function frame(now){
  if(PAUSED){ looping=false; return; }
  const dt=Math.min(0.033,(now-last)/1000); last=now;
  const k6=1-Math.exp(-dt*5.5), snap=pan.on||zoomAnchor;
  cam.d+=(cam.dT-cam.d)*k6;
  if(cam.curPitch===undefined){ cam.curPitch=cam.pitch; cam.cx=cam.tx; cam.cy=cam.ty; cam.cz=cam.tz; }
  cam.curPitch+=(cam.pitch-cam.curPitch)*k6;
  cam.cx+=(cam.tx-cam.cx)*(snap?1:k6); cam.cy+=(cam.ty-cam.cy)*(snap?1:k6); cam.cz+=(cam.tz-cam.cz)*(snap?1:k6);
  const s={ tx:cam.cx, ty:cam.cy, tz:cam.cz, d:cam.d, pitch:cam.curPitch }; placeCam(camera,s);
  if(zoomAnchor&&zoomAnchor.w){ const h=viewHit(camera,zoomAnchor.n); if(h){ cam.tx+=zoomAnchor.w.x-h.x; if(cam.view==='wall') cam.ty+=zoomAnchor.w.y-h.y; else cam.tz+=zoomAnchor.w.z-h.z; clampCam(); cam.cx=cam.tx; cam.cy=cam.ty; cam.cz=cam.tz; s.tx=cam.tx; s.ty=cam.ty; s.tz=cam.tz; placeCam(camera,s); } if(Math.abs(cam.d-cam.dT)<0.002) zoomAnchor=null; }
  let lt;
  if(cam.view==='wall'){ const h=mouse.in?wallHit(camera,mouse.n):null; lt=h?h.clone().add(V(-0.6,0.9,3.2)):V(0,9,WALL_Z+4); }
  else { const h=mouse.in?planeHit(camera,mouse.n,0):null; lt=h?h.clone().add(V(-0.8,3.2,-1.4)):V(-2,4,-2); }
  lamp.lerp(lt,1-Math.exp(-dt*8));
  camera.matrixWorld.extractBasis(vR,vU,vB); vF.copy(vB).negate();
  mBasis.makeBasis(vR, vB, vU.clone().negate()); qInsp.setFromRotationMatrix(mBasis);
  const tx=(inspected?mouse.n.x:0), ty=(inspected?mouse.n.y:0); tilt.x+=(tx-tilt.x)*(1-Math.exp(-dt*7)); tilt.y+=(ty-tilt.y)*(1-Math.exp(-dt*7));
  let dimTarget=0, dimDist=4;
  const carrying=!!drag.p, kk=1-Math.exp(-dt*10);
  zone.material.opacity+=((carrying?(drag.target==='wall'?1:0.5):0)-zone.material.opacity)*kk;
  const hot=tourHot(), tp=0.16+0.12*Math.sin(now/240);
  binderGlow.material.opacity+=((carrying?(drag.target==='binder'?0.5:0.1):hot==='binder'?tp*1.6:0)-binderGlow.material.opacity)*kk;
  scanGlow.material.opacity+=((carrying?(drag.target==='scan'?0.5:0.1):SCAN.busy?0.18:hot==='scan'?tp*1.6:0)-scanGlow.material.opacity)*kk;
  boxGlow.material.opacity+=((carrying&&drag.target==='box'?0.3:hot==='box'?tp:0)-boxGlow.material.opacity)*kk;
  boardGlow.material.opacity+=((hot==='board'?tp*0.5:0)-boardGlow.material.opacity)*kk; const rp=0.6+0.4*Math.sin(now/220);
  for(const k in RINGS){ const want=hot===k&&!carrying?rp:carrying&&drag.target===(k==='box'?'box':k==='scan'?'scan':k==='binder'?'binder':'')?1:0; RINGS[k].material.opacity+=(want-RINGS[k].material.opacity)*kk; }
  tourPlace(); spoolGlow.material.opacity+=((hot==='spools'&&cam.view==='wall'?tp*1.4:0)-spoolGlow.material.opacity)*kk;
  binder.scale.setScalar(1+binderBump); binderBump*=Math.exp(-dt*9);
  scanner.userData.led.material.color.setHex(SCAN.busy?((now%500<250)?0xe3ad57:0x7a5a22):0x63c27a);
  scanFrame(dt); updateStrings(); holdFrame(); edgeFrame(dt);
  threads.children.forEach(m=>{ if(m.userData.fade!==undefined) m.material.opacity+=(m.userData.fade-m.material.opacity)*(1-Math.exp(-dt*5)); });
  const past=histIdx>=0;
  for(const p of prints){
    const held=drag.p===p;
    if(held){ const k=1-Math.exp(-dt*F.follow); const nx=p.x+(drag.wx-p.x)*k, nz=p.z+(drag.wz-p.z)*k; p.vx+=((nx-p.x)/dt-p.vx)*0.35; p.vz+=((nz-p.z)/dt-p.vz)*0.35; p.x=nx; p.z=nz; }
    else if(!p.wg){ const k=1-Math.exp(-dt*(p.locked?7:9)); p.x+=(p.tx-p.x)*k; p.z+=(p.tz-p.z)*k; p.vx*=0.8; p.vz*=0.8; }
    p.yaw+=wrapPI(p.yawT-p.yaw)*(1-Math.exp(-dt*10));
    if(held){ const sx=p.tx, sz=p.tz; p.tx=p.x; p.tz=p.z; const pt=propTop(p); p.tx=sx; p.tz=sz; p.heldBase=Math.max(p.base,pt); }
    const yT=(held?p.heldBase:p.base)+LAYER*0.5+(held?F.lift:0)+(p.gLift?F.lift*0.7:0);
    if(!p.wg){ p.vy+=((yT-p.y)*F.k - p.vy*F.c)*dt; p.y+=p.vy*dt; if(p.y<p.base+LAYER*0.5-0.002&&!held){ p.y=p.base+LAYER*0.5; p.vy=Math.abs(p.vy)*0.2; } }
    const tz=held?THREE.MathUtils.clamp(-p.vx*F.tiltK,-F.maxTilt,F.maxTilt):0, txx=held?THREE.MathUtils.clamp(p.vz*F.tiltK,-F.maxTilt,F.maxTilt):0;
    p.tiltX+=(txx-p.tiltX)*kk; p.tiltZ+=(tz-p.tiltZ)*kk;
    p.insp+=(p.inspT-p.insp)*(1-Math.exp(-dt*(p.inspT?7:9)));
    if(p.inspT===0&&p.insp<0.003&&p.mat.transparent){ p.insp=0; p.mat.transparent=false; p.mat.depthTest=true; p.mesh.renderOrder=0; restack(); }
    p.wallA+=((p.wg?1:0)-p.wallA)*(1-Math.exp(-dt*3.6)); if(Math.abs(p.wallA-(p.wg?1:0))<0.002) p.wallA=p.wg?1:0;
    const liftH=Math.max(0,p.y-p.base-LAYER*0.5);
    qYaw.setFromAxisAngle(up,p.yaw); eul.set(p.tiltX,0,p.tiltZ); qTilt.setFromEuler(eul); qA.copy(qTilt).multiply(qYaw);
    tabPos.set(p.x,p.y,p.z); basePos.copy(tabPos); baseQ.copy(qA);
    if(p.wallA>0.0005){ const e=p.wallA*p.wallA*(3-2*p.wallA); wallPos.set(p.wx, p.wy, WALL_Z+0.04+(p.order%5)*0.002);
      basePos.lerpVectors(tabPos,wallPos,e); basePos.y+=Math.sin(Math.PI*e)*2.2; basePos.z+=Math.sin(Math.PI*e)*1.5; baseQ.copy(qA).slerp(qWall0,e); }
    if(p.insp>0.0005){ const e=p.insp*p.insp*(3-2*p.insp);
      const tq=new THREE.Quaternion().setFromAxisAngle(vU,tilt.x*0.32).multiply(new THREE.Quaternion().setFromAxisAngle(vR,-tilt.y*0.24));
      const fit=Math.max(p.h, p.w/camera.aspect)/0.74, D=fit/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))/inspZoom; insPos.copy(camera.position).addScaledVector(vF,D); const q=tq.multiply(qInsp.clone()); dimTarget=0.62*e; dimDist=D+0.6;
      p.group.position.lerpVectors(basePos,insPos,e); p.group.quaternion.copy(baseQ).slerp(q,e);
    } else { p.group.position.copy(basePos); p.group.quaternion.copy(baseQ); }
    const hide=past&&p.wallA>0.5; p.group.visible=!hide;
    p.mat.uniforms.uBow.value=(p.kind==='sheet'?0.006:(p.onBoard||p.wg)?0.004:0.011)+F.sag*Math.min(1,liftH/F.lift)+(p.insp*0.004);
    p.pins.visible=p.wallA>0.98&&p.insp<0.05;
    const sh=p.shadow;
    if(p.wallA>0.5){ sh.rotation.set(0,0,0); sh.position.set(p.wx+0.09, p.wy-0.14, WALL_Z+0.02); sh.scale.setScalar(1.02); sh.material.opacity=(wallStyle==='white'?0.32:wallStyle==='studio'?0.5:0.42)*(p.wallA*2-1)*(1-p.insp); }
    else { sh.rotation.set(-Math.PI/2,p.yaw,0); const off=liftH*0.55; sh.position.set(p.x+off*0.45, p.base+0.0015, p.z+off*0.7); sh.scale.setScalar(1+liftH*0.45);
      sh.material.opacity=(p.onBoard?0.6:0.42)/(1+liftH*2.4)*(1-p.insp)*Math.max(0,1-p.wallA*2); }
    sh.visible=sh.material.opacity>0.01&&!hide;
  }
  dim.material.opacity+=(dimTarget-dim.material.opacity)*(1-Math.exp(-dt*8));
  if(dim.material.opacity>0.002){ const hh=2*dimDist*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*1.1; dim.position.set(0,0,-dimDist); dim.scale.set(hh*camera.aspect,hh,1); dim.visible=true; } else dim.visible=false;
  threads.visible=!inspected;
  renderer.setRenderTarget(null); renderer.render(scene,camera);
  if(loupe.on&&mouse.in){
    const R=118, mag=3.1, D=R*2, vh=window.innerHeight;
    zoomCam.fov=2*THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*(D/vh)/mag)); zoomCam.aspect=1; zoomCam.updateProjectionMatrix();
    ray.setFromCamera(mouse.n,camera); zoomCam.position.copy(camera.position); zoomCam.up.copy(vU); zoomCam.lookAt(tmpV.copy(camera.position).add(ray.ray.direction)); zoomCam.updateMatrixWorld();
    const px=Math.round(D*renderer.getPixelRatio()); if(rt.width!==px) rt.setSize(px,px);
    renderer.setRenderTarget(rt); renderer.render(scene,zoomCam); renderer.setRenderTarget(null);
    loupeQuad.scale.set(D,D,1); loupeQuad.position.set(mouse.x,-mouse.y,0); loupeShadow.scale.set(D*1.35,D*1.35,1); loupeShadow.position.set(mouse.x+10,-mouse.y-16,0);
    renderer.autoClear=false; renderer.clearDepth(); renderer.render(ovScene,ovCam); renderer.autoClear=true; }
  const W=window.innerWidth, H=window.innerHeight, tableish=cam.curPitch>30;
  tags.forEach(t=>{ tmpV.copy(t.w).project(camera); const vis=tmpV.z<1&&!inspected&&tableish&&Math.abs(tmpV.x)<1.1&&Math.abs(tmpV.y)<1.1; t.el.style.opacity=vis?'':'0'; t.el.style.pointerEvents=vis?'':'none'; t.el.style.transform='translate('+((tmpV.x+1)/2*W).toFixed(1)+'px,'+((1-tmpV.y)/2*H).toFixed(1)+'px)'; });
  if(ACTS.anchor){ tmpV.copy(ACTS.anchor()).project(camera); ACTS.el.style.transform='translate('+((tmpV.x+1)/2*W).toFixed(1)+'px,'+((1-tmpV.y)/2*H).toFixed(1)+'px) translate(-50%,-50%)'; }
  requestAnimationFrame(frame);
}

/* ================= inside Studium: the library is the student's own photos, and keepers go to the workbook and book ================= */
function realId(id){ const it=libById(id); if(!it) return id; const b=it.copyOf?(libById(it.copyOf)||it):it;
  if(b.sample&&!b.realId&&b.raw&&HOST&&HOST.adopt){ try{ b.realId=HOST.adopt(b.raw.toDataURL('image/jpeg',0.86), b.name); saveAll(); }catch(e){} }
  return b.sample?b.realId||null:b.id; }
function hostLibrary(d, adopted){ const seen=new Set(), stale=[];
  if((d.photos||[]).length<4||(d.state&&d.state.samples)||library.some(i=>i.sample)){ if(!library.some(i=>i.sample)) seedLibrary(true); }
  (adopted||[]).forEach(([sid,rid])=>{ const it=libById(sid); if(it) it.realId=rid; });
  const taken=new Set(library.filter(i=>i.sample&&i.realId).map(i=>i.realId));
  (d.photos||[]).forEach(ph=>{ seen.add(ph.id); if(taken.has(ph.id)) return; let it=libById(ph.id);
    if(!it){ it=libAdd(null,'print',2.2,ph.id); it.url=ph.url; }
    else if(it.url!==ph.url){ it.url=ph.url; it.canvas=null; it.thumb=null; stale.push(it.id); }
    it.name=ph.name; it.place=ph.place||'Uploads'; it.pick=!!ph.pick; });
  library.forEach(i=>{ if(i.sample&&i.realId&&!seen.has(i.realId)) i.realId=null; });
  for(let i=library.length-1;i>=0;i--){ const it=library[i]; if(it.sample||it.copyOf) continue; if(!seen.has(it.id)){ const p=byId(it.id); if(p){ if(p.wg){ const g=p.wg; g.members.splice(g.members.indexOf(p),1); if(!g.members.length) wallGroups.splice(wallGroups.indexOf(g),1); else layoutGroup(g); } removePrint(p); } library.splice(i,1); } }
  for(let i=library.length-1;i>=0;i--){ const it=library[i]; if(!it.copyOf) continue; const s=libById(it.copyOf); if(!s){ const p=byId(it.id); if(p) removePrint(p); library.splice(i,1); } else if(stale.includes(s.id)){ it.canvas=null; it.url=s.url; stale.push(it.id); } }
  PROJ.length=0; (d.projects||[]).forEach(p=>PROJ.push({ id:p.id, name:p.name, ids:p.ids.slice() }));
  const onTable=stale.filter(id=>byId(id));
  prepare(onTable,()=>onTable.forEach(id=>{ const p=byId(id), it=libById(id); if(!p||!it.canvas) return; p.mat.uniforms.map.value.dispose(); p.mat.uniforms.map.value=makeTex(it.canvas); p.canvas=it.canvas; p.stats=printStats(it.canvas); }));
  drawBinderCover(); if(BD.el.classList.contains('on')) bdRender(); updateChains(false); }
// a workbook page in Studium's own format (A3 landscape, millimetres): the board's frames where they sit, a title, and a caption under each pair
function hostPage(){ const on=prints.filter(p=>p.onBoard&&realId(p.id)); if(!on.length) return null;
  const pad=0.4, bb=bboxOf(on); bb.x0-=pad; bb.x1+=pad; bb.z0-=pad; bb.z1+=pad;
  const W=420, H=297, M=15, top=44, foot=8, s=Math.min((W-2*M)/(bb.x1-bb.x0), (H-top-foot-12)/(bb.z1-bb.z0)), ox=M+((W-2*M)-(bb.x1-bb.x0)*s)/2, oy=top;
  const X=x=>ox+(x-bb.x0)*s, Y=z=>oy+(z-bb.z0)*s, inner=1/1.09, items=[];
  items.push({ t:'text', role:'title', x:M, y:12, w:W*0.6, h:H*0.08, text:'Sequence board', size:30, font:'serif', ph:'Title' });
  items.push({ t:'text', role:'caption', x:W-M-150, y:18, w:150, h:H*0.06, text:new Date().toLocaleDateString('en-NZ',{ day:'numeric', month:'long', year:'numeric' })+' · '+rejects.length+' in the reject box', size:11, font:'type', ph:'' });
  on.forEach(p=>{ const w=p.w*inner*s, h=p.h*inner*s; items.push({ t:'photo', pid:realId(p.id), x:X(p.tx)-w/2, y:Y(p.tz)-h/2, w }); });
  chains.forEach(ch=>{ if(!ch.some(p=>on.includes(p))) return; const b=bboxOf(ch), n=notes.get(chainKey(ch));
    items.push({ t:'text', role:'caption', x:X(b.x0), y:Math.min(H-foot-12,Y(b.z1)+1.5), w:Math.max(60,(b.x1-b.x0)*s), h:H*0.05, text:n&&(n.why.size||n.text)?noteSummary(n):'', size:11, font:'type', ph:ch.length===2?'What joins these two?':'Why this order?' }); });
  return { items, tpl:'sequence' }; }

/* ================= the tour: one prompt at a time, ticks over when you've done it (Studium's coach style) ================= */
const TSTEPS=[
  { ch:'PULL', line:'This is your <b>light table</b>.', sub:'Every frame you shoot lives in the binder, the glowing folder at the front. Pull prints out, try them next to each other, and pin the keepers to the wall.', hot:'binder', next:true },
  { ch:'PULL', line:'Open the <b>binder</b>.', sub:'Click it, or press <kbd>B</kbd>.', hot:'binder', ev:'binder' },
  { ch:'PULL', line:'Pick a few frames, then <b>Pull out</b>.', sub:'Click to pick. The tabs down the side are your folders.', hot:'pull', ev:'pull' },
  { ch:'PAIR', line:'Drag a print onto the <b>board</b>.', sub:'It straightens and lines up when you let go.', hot:'board', ev:'board' },
  { ch:'PAIR', line:'Put another one <b>right beside it</b>.', sub:'Side by side or one above the other. Touching makes a pair.', hot:'board', ev:'pair' },
  { ch:'PAIR', line:'Say <b>what joins them</b>.', sub:'Hover the pair and click the cog above it, or right-click one of them.', hot:'chain', ev:'note' },
  { ch:'PAIR', line:'Make one <b>bigger</b>.', sub:'Hover a print and press <kbd>]</kbd>. <kbd>[</kbd> makes it smaller.', hot:'chain', ev:'size' },
  { ch:'CULL', line:'Not working? Drop one in the <b>reject box</b>.', sub:'Drag a print into the glowing box. Nothing is lost, you can pull it back out any time.', hot:'box', ev:'reject', skip:true },
  { ch:'CULL', line:'Want it twice? Use the <b>copier</b>.', sub:'Drag a print onto its glass. A copy prints out beside it.', hot:'scan', ev:'copy', skip:true },
  { ch:'WALL', line:'<b>Pin</b> your pair to the wall.', sub:'Hover the pair and click the pin next to the cog.', hot:'chain', ev:'pin' },
  { ch:'WALL', line:'Make <b>another series</b> and pin that too.', sub:'Another pair or a run of three on the board, then the pin. Strings need two things to join.', hot:'board', ev:'pin2', skip:true, ok:()=>wallSeries()>=2 },
  { ch:'WALL', line:'Push the mouse to the <b>top edge</b> to look up.', sub:'Or press <kbd>W</kbd>.', hot:'edge', ev:'wall' },
  { ch:'WALL', line:'Run a <b>string</b> between your series.', sub:'Click a spool on the ledge, then click a print in each series.', hot:'spools', ev:'string', skip:true },
  { ch:'WALL', line:'Come back down to the <b>table</b>.', sub:'Move the mouse to the bottom of the screen.', hot:'edgeDown', ev:'table' },
  { ch:'KEEP', line:'Add the board to your <b>workbook</b>.', sub:'It becomes a new page with a caption under each pair for you to write in.', hot:'capture', ev:'capture', skip:true },
  { ch:'KEEP', line:'That’s the <b>light table</b>.', sub:'Live with your series on the wall for a while. Press <kbd>?</kbd> to see this again.', next:true, last:true } ];
const wallSeries=()=>wallGroups.filter(g=>g.members.length>1).length;
const TOUR={ on:false, i:0, done:false, okT:0, seen:{} };
const CHAPS=['PULL','PAIR','CULL','WALL','KEEP'];
function tourStart(){ clearTimeout(TOUR.okT); TOUR.okT=0; if(BD.el.classList.contains('on')) closeBinder(); TOUR.on=true; TOUR.i=0; tourShow(); }
function tourEnd(finished){ clearTimeout(TOUR.okT); TOUR.okT=0; TOUR.on=false; $('co').classList.remove('show','ok'); document.querySelectorAll('.co-hot').forEach(e=>e.classList.remove('co-hot')); if(finished!==false||!TOUR.done){ TOUR.done=true; saveAll(); if(finished!==false&&HOST&&HOST.tourDone) try{ HOST.tourDone(); }catch(e){} if(library.every(i=>i.sample||i.copyOf)) try{ localStorage.setItem('lt_tour_done','1'); }catch(e){} } }
function tourShow(){ const s=TSTEPS[TOUR.i], el=$('co'); if(!s){ tourEnd(true); return; }
  el.querySelector('.co-top').innerHTML=CHAPS.map((c,k)=>'<span class="co-ch'+(c===s.ch?' on':CHAPS.indexOf(s.ch)>k?' past':'')+'">'+c+'</span>').join('<i></i>')
    +(s.skip?'<button class="co-skip" type="button" data-co="step">SKIP</button>':'')+'<button class="co-skip all" type="button" data-co="all">END TOUR</button>';
  el.querySelector('.co-line').innerHTML=s.line; el.querySelector('.co-sub').innerHTML=s.sub;
  el.querySelector('.co-dots').innerHTML=TSTEPS.map((_,k)=>'<i class="'+(k<TOUR.i?'past':k===TOUR.i?'on':'')+'"></i>').join('');
  const nb=el.querySelector('.co-next'); nb.hidden=!s.next; nb.textContent=s.last?'Done':'Next';
  el.classList.remove('ok'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  document.querySelectorAll('.co-hot').forEach(e=>e.classList.remove('co-hot'));
  const dom={ pull:'#bdPull', capture:'#bCapture' }[s.hot]; if(dom){ const t=document.querySelector(dom); if(t) t.classList.add('co-hot'); }
  if(s.ev&&(performance.now()-(TOUR.seen[s.ev]||-1e9)<1500||(s.ok&&s.ok()))) tourEv(s.ev); TP.x=null; }
function tourEv(name){ TOUR.seen[name]=performance.now(); if(!TOUR.on) return; const s=TSTEPS[TOUR.i]; if(!s||s.ev!==name||TOUR.okT) return;
  $('co').classList.add('ok'); TOUR.okT=setTimeout(()=>{ TOUR.okT=0; TOUR.i++; tourShow(); },900); }
$('co').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return;
  if(b.classList.contains('co-next')){ if(TSTEPS[TOUR.i].last) tourEnd(true); else { TOUR.i++; tourShow(); } }
  else if(b.dataset.co==='step'){ TOUR.i++; tourShow(); } else if(b.dataset.co==='all') tourEnd(false); });
$('bTour').onclick=()=>{ if(TOUR.on) tourEnd(false); else tourStart(); };
const TP={ x:null, y:null };
function tourAnchor(hot){ switch(hot){
  case 'binder': return { at:V(BINDER.x+BINDER.w/2+0.3,BINDER.h,BINDER.z), side:'right' };
  case 'box': return { at:V(BOX.x+BOX.w/2+0.4,BOX.h,BOX.z), side:'right' };
  case 'scan': return { at:V(SC.x+SC.w/2+0.4,SC.h,SC.z), side:'right' };
  case 'board': return { at:V(BX-BW/2-0.3,0,BZ), side:'left' };
  case 'chain': { const L=chains.length?chains[chains.length-1]:prints.filter(p=>p.onBoard); if(!L.length) return { at:V(BX-BW/2-0.3,0,BZ), side:'left' }; const b=bboxOf(L); return { at:V(b.x0-0.4,0,(b.z0+b.z1)/2), side:'left' }; }
  case 'spools': return cam.view==='wall'?{ at:V(SHELF.x+SHELF.w/2+0.4,SHELF.y+0.3,WALL_Z), side:'right' }:null;
  case 'edge': return { top:true };
  case 'capture': return { dom:'#bCapture' };
  default: return null; } }
function tourPlace(){ const el=$('co'); if(!TOUR.on||!el.classList.contains('show')) return; const s=TSTEPS[TOUR.i];
  const a=s&&s.hot&&!BD.el.classList.contains('on')?tourAnchor(s.hot):null;
  if(!a){ if(el.classList.contains('placed')){ el.classList.remove('placed'); el.style.left=el.style.top=''; } TP.x=null; return; }
  const W=window.innerWidth, H=window.innerHeight, cw=el.offsetWidth, ch=el.offsetHeight, gap=28; let x, y;
  if(a.top){ x=W/2-cw/2; y=64; }
  else if(a.dom){ const t=document.querySelector(a.dom); if(!t) return; const r=t.getBoundingClientRect(); x=r.right-cw; y=r.top-ch-56; }
  else { tmpV.copy(a.at).project(camera); if(tmpV.z>1) return; const sx=(tmpV.x+1)/2*W, sy=(1-tmpV.y)/2*H; x=a.side==='left'?sx-gap-cw:sx+gap; y=sy-ch/2;
    if(x+cw>W-12) x=sx-gap-cw-60; if(x<12) x=sx+gap; }
  x=Math.max(12,Math.min(W-cw-12,x)); y=Math.max(12,Math.min(H-ch-112,y));
  if(TP.x==null){ TP.x=x; TP.y=y; } else { TP.x+=(x-TP.x)*0.18; TP.y+=(y-TP.y)*0.18; }
  el.classList.add('placed'); el.style.left=TP.x.toFixed(1)+'px'; el.style.top=TP.y.toFixed(1)+'px'; }
function tourHot(){ return TOUR.on&&TSTEPS[TOUR.i]?TSTEPS[TOUR.i].hot:null; }

/* ================= start ================= */
function finishBoot(){ restack(); updateChains(false); drawBoxBtn(); applyOpts(); focus('table'); cam.d=cam.dT; drawBinderCover(); renderWorkbook(); document.body.classList.add('ready');
  READY=true; last=performance.now(); looping=true; requestAnimationFrame(frame);
  setTimeout(()=>{ let i=0; const next=()=>{ while(i<WALLS.length&&wallTiles[WALLS[i][0]]) i++; if(i>=WALLS.length){ buildWallPick(); return; } wallTile(WALLS[i][0]); i++; setTimeout(next,120); }; next(); },1600);
  /* a student with no photos yet can't save a session, so remember the finished tour in this browser for them */
  if(library.every(i=>i.sample||i.copyOf)) try{ if(localStorage.getItem('lt_tour_done')) TOUR.done=true; }catch(e){}
  if(!TOUR.done||WANT_TOUR) setTimeout(()=>{ WANT_TOUR=false; if(!TOUR.on) tourStart(); },900); }
let WANT_TOUR=false;
window.LTapp={ tour(){ if(READY){ if(!TOUR.on) tourStart(); } else WANT_TOUR=true; }, kill(){ READY=false; PAUSED=true; clearTimeout(saveT); },
  sync(d){ if(!READY||LOADING) return; hostLibrary(d); },
  pause(on){ on=!!on; if(on===PAUSED) return; PAUSED=on; if(on){ clearTimeout(saveT); saveNow(); recordHist(); closeBinder(); dropString(); }
    else if(READY&&!looping){ last=performance.now(); looping=true; requestAnimationFrame(frame); } } };
drawBoxLabel(0); buildPanel(); buildSwatches(); buildWallPick(); setStringsOn(stringsOn);
if(HOST){ $('bBook').textContent='Open workbook'; $('bBook').title='Go to the Workbook room'; }
if(HOST){ const d=HOST.data()||{}; hostLibrary(d, d.state&&d.state.adopted); if(d.startTour) WANT_TOUR=true;
  requestAnimationFrame(()=>applyState(d.state, had=>{ if(had){ finishBoot(); return; }
    const own=library.filter(i=>!i.copyOf&&!i.sample), pool=own.length>=4?own:library.filter(i=>!i.copyOf), first=pool.slice(0,Math.min(3,Math.max(0,pool.length-3))).map(i=>i.id); prepare(first,()=>{ first.forEach(ensurePrint); scatter(true); finishBoot(); }); })); }
else { seedLibrary();
requestAnimationFrame(()=>{
  [0,2,4,5,9,13,16,21,24].forEach(i=>ensurePrint(library[i].id)); ensurePrint(library[30].id);
  scatter(true);
  loadLocal(had=>{
    if(!had){
      const land=library.filter(i=>i.kind==='print'&&i.canvas.width>i.canvas.height&&!byId(i.id)).slice(0,4).map(i=>ensurePrint(i.id));
      [land[0],land[1]].forEach((p,i)=>placeOnBoard(p,0,i)); layoutRows(null); if(FREE()){ rows.forEach(r=>{ r.forEach(p=>freeB.push(p)); r.length=0; }); } prints.filter(p=>p.onBoard).forEach(p=>{ p.x=p.tx; p.z=p.tz; p.yaw=0; p.y=BOARD_Y+LAYER*0.5; });
      const g=pinGroup([land[2],land[3]], { why:['Light'], text:'same low sun, one warm and one cold' }, 'pair', { x:-3, y:9.5 }, true); g.members.forEach(p=>p.wallA=1);
      if(!hist.length){ const L=library; hist.push({ t:Date.now()-7*864e5, seed:true, sig:'seed', groups:[{ ids:[L[6].id,L[7].id], x:-9, y:11 },{ ids:[L[12].id,L[15].id,L[18].id], x:3, y:13.5 },{ ids:[L[3].id], x:10, y:8 }] }); }
    }
    finishBoot();
  });
}); }
let DEV=/[?&]dev/.test(location.search); try{ if(HOST) DEV=/[?&]dev/.test(window.parent.location.search); }catch(e){}
if(DEV) window.__lt={ prints, pick, applyOpts, openInspect, mouse, cam, rows, placeOnBoard, layoutBoard, restack, updateChains, chains:()=>chains, captureBoard, workbook, notes, chainKey, focus, pinGroup, setSize, placeFree, freeTarget, startGroupDrag, unlink, wallTile, wallGroups, reject, rejects, openBinder, library, BD, fileBack, copyPrint, undo, setHist, hist, setHover, openCtx, SCAN, BOOK, sendToBook, emptyBox, TOUR, tourStart, tourEnd, tourEv, serialize, applyState, hostPage, saveNow };
