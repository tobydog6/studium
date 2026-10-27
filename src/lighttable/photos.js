// Stand-in photographs painted on canvas, so the demo works with nothing attached.
// Each returns a canvas with the image only; print.js adds the paper border.

export function mulberry(seed){ let a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

let GRAIN=null;
function grain(){ if(GRAIN) return GRAIN; const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'), id=g.createImageData(256,256);
  for(let i=0;i<id.data.length;i+=4){ const v=128+(Math.random()-0.5)*110; id.data[i]=id.data[i+1]=id.data[i+2]=v; id.data[i+3]=255; } g.putImageData(id,0,0); GRAIN=c; return c; }

function lin(g,x0,y0,x1,y1,stops){ const gr=g.createLinearGradient(x0,y0,x1,y1); stops.forEach(s=>gr.addColorStop(s[0],s[1])); return gr; }
function rad(g,x,y,r0,r1,stops){ const gr=g.createRadialGradient(x,y,r0,x,y,r1); stops.forEach(s=>gr.addColorStop(s[0],s[1])); return gr; }
function ridgeArr(r,rough){ const n=256, a=new Float32Array(n+1); a[0]=r()*2-1; a[n]=r()*2-1; let step=n, sc=1;
  while(step>1){ const h=step>>1; for(let i=h;i<n;i+=step) a[i]=(a[i-h]+a[i+h])/2+(r()*2-1)*sc; step=h; sc*=rough; } return a; }
function ridge(g,W,H,y,amp,rough,fill,r){ const a=ridgeArr(r,rough); g.beginPath(); g.moveTo(0,H); for(let i=0;i<=256;i++) g.lineTo(i/256*W, y-a[i]*amp); g.lineTo(W,H); g.closePath(); g.fillStyle=fill; g.fill(); }
function mix(a,b,t){ const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16); const c=[16,8,0].map(s=>Math.round(((pa>>s)&255)*(1-t)+((pb>>s)&255)*t)); return 'rgb('+c.join(',')+')'; }

const SCENES={
  mountains(g,W,H,r){ const P=r()<0.5?['#1c2a47','#e8a46c','#f7d3a3']:['#0f2033','#6f93b5','#d7e3ea'];
    g.fillStyle=lin(g,0,0,0,H*0.62,[[0,P[0]],[0.75,P[1]],[1,P[2]]]); g.fillRect(0,0,W,H);
    ridge(g,W,H,H*0.46,H*0.13,0.56,'#5d6b86',r); ridge(g,W,H,H*0.54,H*0.09,0.55,'#3a455e',r); ridge(g,W,H,H*0.6,H*0.04,0.5,'#1d2536',r);
    const wy=H*0.62; g.fillStyle='#141b27'; g.fillRect(0,wy,W,H-wy);
    g.save(); g.translate(0,wy*2); g.scale(1,-1); g.globalAlpha=0.55; g.drawImage(g.canvas,0,0,W,wy,0,0,W,wy); g.restore();
    g.fillStyle=lin(g,0,wy,0,H,[[0,'rgba(10,14,22,0.25)'],[1,'rgba(6,8,14,0.75)']]); g.fillRect(0,wy,W,H-wy);
    for(let i=0;i<140;i++){ g.fillStyle='rgba(255,255,255,'+(0.03+r()*0.06)+')'; g.fillRect(r()*W, wy+r()*(H-wy), 20+r()*120, 1+r()*1.5); } },
  sea(g,W,H,r){ g.fillStyle=lin(g,0,0,0,H*0.6,[[0,'#24183a'],[0.55,'#c24f68'],[1,'#f59a4a']]); g.fillRect(0,0,W,H);
    const sx=W*(0.3+r()*0.4), sy=H*0.56; g.fillStyle=rad(g,sx,sy,0,H*0.35,[[0,'rgba(255,214,150,0.9)'],[0.12,'rgba(255,190,120,0.5)'],[1,'rgba(255,160,90,0)']]); g.fillRect(0,0,W,H);
    g.fillStyle='#ffe2b0'; g.beginPath(); g.arc(sx,sy,H*0.045,0,7); g.fill();
    ridge(g,W,H,H*0.59,H*0.025,0.5,'#2a1830',r);
    g.fillStyle=lin(g,0,H*0.6,0,H,[[0,'#3b2342'],[1,'#0f0a14']]); g.fillRect(0,H*0.6,W,H*0.4);
    for(let i=0;i<260;i++){ const y=H*0.6+Math.pow(r(),1.4)*H*0.4, spread=(y-H*0.6)/(H*0.4); const x=sx+(r()-0.5)*W*(0.06+spread*0.35);
      g.fillStyle='rgba(255,200,130,'+(0.5*(1-spread)+0.05)+')'; g.fillRect(x,y,8+r()*40,1.5); } },
  forest(g,W,H,r){ g.fillStyle=lin(g,0,0,0,H,[[0,'#e3e3e1'],[1,'#8f8f8d']]); g.fillRect(0,0,W,H);
    for(let k=0;k<5;k++){ const base=H*(0.45+k*0.13), shade=Math.round(190-k*42); g.fillStyle='rgb('+shade+','+shade+','+shade+')';
      for(let x=-20;x<W+20;x+=6+r()*(18+k*6)){ const th=H*(0.12+r()*0.22)*(1+k*0.35), tw=th*0.22; g.beginPath(); g.moveTo(x,base-th); g.lineTo(x+tw,base); g.lineTo(x-tw,base); g.fill(); g.fillRect(x-1.5,base-th*0.2,3,th*0.4); }
      g.fillRect(0,base,W,H); g.fillStyle=lin(g,0,base-H*0.15,0,base+H*0.05,[[0,'rgba(225,225,223,0)'],[1,'rgba(225,225,223,0.45)']]); g.fillRect(0,base-H*0.15,W,H*0.2); } },
  dunes(g,W,H,r){ g.fillStyle=lin(g,0,0,0,H*0.5,[[0,'#d98a52'],[1,'#f4cf9b']]); g.fillRect(0,0,W,H);
    for(let k=0;k<5;k++){ const y0=H*(0.42+k*0.12), ph=r()*6, f=1.5+r()*2, a=H*0.05;
      g.beginPath(); g.moveTo(0,H); for(let x=0;x<=W;x+=8){ g.lineTo(x, y0+Math.sin(x/W*f*3.1+ph)*a+Math.sin(x/W*f*7.3+ph*2)*a*0.3); } g.lineTo(W,H); g.closePath();
      g.fillStyle=lin(g,0,y0-a,W,y0+a,[[0,mix('#f0b47a','#c76a35',k/5)],[0.5,mix('#d98b4b','#8a3f1e',k/5)],[1,mix('#a65a2d','#4a1f10',k/5)]]); g.fill(); } },
  city(g,W,H,r){ g.fillStyle=lin(g,0,0,0,H,[[0,'#0a1322'],[1,'#1e2b45']]); g.fillRect(0,0,W,H);
    for(let x=0;x<W;){ const bw=W*(0.05+r()*0.08), bh=H*(0.25+r()*0.45); g.fillStyle='#0b0f18'; g.fillRect(x,H*0.72-bh,bw,bh);
      for(let wy=H*0.72-bh+8;wy<H*0.7;wy+=10) for(let wx=x+4;wx<x+bw-6;wx+=9) if(r()<0.28){ g.fillStyle='rgba(255,'+(170+r()*60|0)+',90,'+(0.5+r()*0.5)+')'; g.fillRect(wx,wy,4,5); }
      x+=bw+2; }
    g.fillStyle='#090c12'; g.fillRect(0,H*0.72,W,H); g.globalCompositeOperation='lighter';
    for(let i=0;i<55;i++){ const x=r()*W, y=H*(0.3+r()*0.6), rr=H*(0.015+r()*0.05), warm=r()<0.7; g.fillStyle=rad(g,x,y,0,rr,[[0,warm?'rgba(255,170,80,0.55)':'rgba(120,170,255,0.45)'],[0.8,warm?'rgba(255,150,60,0.25)':'rgba(90,140,255,0.2)'],[1,'rgba(0,0,0,0)']]); g.fillRect(x-rr,y-rr,rr*2,rr*2); }
    for(let i=0;i<70;i++){ const x=r()*W; g.fillStyle='rgba(255,180,100,'+(0.05+r()*0.12)+')'; g.fillRect(x,H*0.74,2+r()*3,H*0.26*r()); }
    g.globalCompositeOperation='source-over'; },
  tree(g,W,H,r){ g.fillStyle=lin(g,0,0,0,H,[[0,'#3a4867'],[0.7,'#d7a07c'],[1,'#e9c29a']]); g.fillRect(0,0,W,H);
    ridge(g,W,H,H*0.8,H*0.02,0.4,'#1c1815',r); g.strokeStyle='#16110e'; g.lineCap='round';
    const tx=W*(0.35+r()*0.3);
    (function br(x,y,len,ang,d,w){ if(d===0||len<2) return; const x2=x+Math.cos(ang)*len, y2=y+Math.sin(ang)*len; g.lineWidth=w; g.beginPath(); g.moveTo(x,y); g.lineTo(x2,y2); g.stroke();
      const n=d>6?2:2+(r()<0.4?1:0); for(let i=0;i<n;i++) br(x2,y2,len*(0.68+r()*0.14),ang+(r()-0.5)*1.1+(i-(n-1)/2)*0.45,d-1,w*0.68); })(tx,H*0.8,H*0.17,-Math.PI/2,10,H*0.03); },
  hills(g,W,H,r){ g.fillStyle=lin(g,0,0,0,H*0.6,[[0,'#f0ae66'],[1,'#f9dcae']]); g.fillRect(0,0,W,H);
    g.fillStyle='rgba(255,240,210,0.9)'; g.beginPath(); g.arc(W*(0.25+r()*0.5),H*0.33,H*0.05,0,7); g.fill();
    for(let k=0;k<7;k++){ const y=H*(0.42+k*0.075); ridge(g,W,H,y,H*0.05,0.42,mix('#d9a070','#2a1a16',k/6),r);
      g.fillStyle=lin(g,0,y-H*0.06,0,y+H*0.04,[[0,'rgba(250,220,180,0)'],[1,'rgba(250,220,180,'+(0.35-k*0.04)+')']]); g.fillRect(0,y-H*0.06,W,H*0.1); } },
  stump(g,W,H,r){ const cx=W*(0.45+r()*0.1), cy=H*(0.45+r()*0.1), R=Math.max(W,H)*0.6;
    g.fillStyle=rad(g,cx,cy,0,R,[[0,'#c99a68'],[0.6,'#8a5b35'],[1,'#3b2414']]); g.fillRect(0,0,W,H);
    for(let i=1;i<60;i++){ const rr=i*R/62; g.beginPath(); for(let a=0;a<=64;a++){ const t=a/64*Math.PI*2, w=rr*(1+0.05*Math.sin(t*3+i*0.3)+0.02*Math.sin(t*9+i)); const x=cx+Math.cos(t)*w, y=cy+Math.sin(t)*w*0.92; a?g.lineTo(x,y):g.moveTo(x,y); }
      g.strokeStyle=i%2?'rgba(60,32,16,0.35)':'rgba(230,190,140,0.18)'; g.lineWidth=1+r()*2.2; g.stroke(); }
    g.strokeStyle='rgba(25,12,6,0.7)'; for(let i=0;i<7;i++){ const a=r()*7; g.lineWidth=1+r()*3; g.beginPath(); g.moveTo(cx+Math.cos(a)*R*0.05,cy+Math.sin(a)*R*0.05); g.lineTo(cx+Math.cos(a+0.1)*R*(0.3+r()*0.5),cy+Math.sin(a+0.1)*R*(0.3+r()*0.5)); g.stroke(); }
    for(let i=0;i<40;i++){ const a=r()*7, d=R*(0.75+r()*0.3); g.fillStyle='rgba(90,120,50,'+(0.2+r()*0.3)+')'; g.beginPath(); g.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d,H*(0.02+r()*0.05),0,7); g.fill(); } },
  still(g,W,H,r){ g.fillStyle=lin(g,0,0,W,0,[[0,'#3a3128'],[0.5,'#17130f'],[1,'#0c0a08']]); g.fillRect(0,0,W,H);
    g.fillStyle='#1d1813'; g.fillRect(0,H*0.68,W,H); const cx=W*(0.42+r()*0.16), cy=H*0.5, rr=H*0.16;
    g.fillStyle='rgba(0,0,0,0.55)'; g.beginPath(); g.ellipse(cx+rr*0.6,H*0.69,rr*1.4,rr*0.18,0,0,7); g.fill();
    g.fillStyle=rad(g,cx-rr*0.45,cy-rr*0.4,rr*0.05,rr*1.25,[[0,'#f0dcc0'],[0.35,'#b0794a'],[1,'#1a0f08']]);
    g.beginPath(); g.moveTo(cx-rr*0.25,cy-rr*1.6); g.lineTo(cx+rr*0.25,cy-rr*1.6); g.quadraticCurveTo(cx+rr*0.2,cy-rr*0.9,cx+rr,cy); g.quadraticCurveTo(cx+rr*0.95,H*0.69,cx,H*0.69); g.quadraticCurveTo(cx-rr*0.95,H*0.69,cx-rr,cy); g.quadraticCurveTo(cx-rr*0.2,cy-rr*0.9,cx-rr*0.25,cy-rr*1.6); g.fill(); }
};
export const KINDS=Object.keys(SCENES);

export function paintPhoto(kind, seed, W, H, bw){
  const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d'), r=mulberry(seed);
  SCENES[kind](g,W,H,r);
  g.fillStyle=rad(g,W/2,H/2,Math.min(W,H)*0.35,Math.hypot(W,H)*0.6,[[0,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,0.45)']]); g.fillRect(0,0,W,H);
  g.globalCompositeOperation='overlay'; g.globalAlpha=0.32; g.fillStyle=g.createPattern(grain(),'repeat'); g.fillRect(0,0,W,H); g.globalAlpha=1; g.globalCompositeOperation='source-over';
  if(bw){ const o=document.createElement('canvas'); o.width=W; o.height=H; const og=o.getContext('2d'); og.filter='grayscale(1) contrast(1.12)'; og.drawImage(c,0,0); return o; }
  return c;
}
