# A light preview of a big scan, for the cube's windows and the far side of portals: the most solid ~600k splats
# near the middle, packed as .stm in the scan's own coordinates (the loader applies its up-axis and scale).
# python3 tools/build_preview.py decoded.splat out.stm --n 600000 --cx 0 --cy 0 --r 6
import numpy as np, zlib, struct, argparse
ap=argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('--n',type=int,default=600000)
ap.add_argument('--cx',type=float,default=0); ap.add_argument('--cy',type=float,default=0); ap.add_argument('--r',type=float,default=6); ap.add_argument('--up',default='zup')   # ydown scans are level in x and z
A=ap.parse_args()
d=np.fromfile(A.src,dtype=np.uint8).reshape(-1,32); p=d[:,:12].copy().view(np.float32).reshape(-1,3); sc=d[:,12:24].copy().view(np.float32).reshape(-1,3); a=d[:,27].astype(np.float64)
near=(np.hypot(p[:,0]-A.cx,p[:,2]-A.cy) if A.up=='ydown' else np.hypot(p[:,0]-A.cx,p[:,1]-A.cy))<A.r
score=np.where(near,a*np.cbrt(sc.prod(1)+1e-30),-1)
keep=np.argsort(-score)[:A.n]; keep=keep[score[keep]>0]
dd=d[keep]; pos=p[keep]; s3=sc[keep]; print('kept',len(dd))
lo=pos.min(0); hi=pos.max(0); q=np.round((pos-lo)/(hi-lo)*65535).astype(np.uint32)
def spread(v):
    v=v&0x3ff; v=(v|(v<<16))&0x030000FF; v=(v|(v<<8))&0x0300F00F; v=(v|(v<<4))&0x030C30C3; v=(v|(v<<2))&0x09249249; return v
m=spread(q[:,0]>>6)|(spread(q[:,1]>>6)<<1)|(spread(q[:,2]>>6)<<2)
o=np.argsort(m,kind='stable'); dd=dd[o]; q=q[o].astype(np.uint16); s3=s3[o]
ls=np.log(np.maximum(s3,1e-12)); slo,shi=float(ls.min()),float(ls.max()); qs=np.clip(np.round((ls-slo)/(shi-slo)*65535),0,65535).astype(np.uint16)
n=len(dd); planes=[np.ascontiguousarray(q[:,i]).view(np.uint8).reshape(-1,2) for i in range(3)]+[np.ascontiguousarray(qs[:,i]).view(np.uint8).reshape(-1,2) for i in range(3)]
body=b''.join([pp[:,0].tobytes()+pp[:,1].tobytes() for pp in planes])+b''.join(dd[:,24+i].tobytes() for i in range(8))
hdr=b'STM1'+struct.pack('<I',n)+struct.pack('<8f',*lo,*hi,slo,shi)
z=zlib.compress(hdr+body,9); open(A.out,'wb').write(z); print('stm',n,len(z)/1e6,'MB')
