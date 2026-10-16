# The Stump: clean floaters, build a walkable ground map and an obstacle map, re-pack as .stm
import numpy as np, zlib, struct
from PIL import Image
SRC='/mnt/user-data/uploads/STUMP_1.splat'
d=np.fromfile(SRC,dtype=np.uint8).reshape(-1,32)
p=d[:,:12].copy().view(np.float32).reshape(-1,3); sc=d[:,12:24].copy().view(np.float32).reshape(-1,3); a=d[:,27]
w=np.stack([p[:,0],-p[:,1],-p[:,2]],1).astype(np.float64)          # world space after the 'ydown' flip
c=np.median(p,0); r=np.linalg.norm(p-c,axis=1)
keep=(a>=10)&(r<25)&np.isfinite(p).all(1)&(sc>0).all(1)
print('start',len(d),'after alpha/outliers',keep.sum())
# ---- floaters: splats with almost nothing around them (0.15 voxels, 27-neighbourhood) ----
V=0.15; vi=np.floor(w/V).astype(np.int64); off=1<<20
key=((vi[:,0]+off)<<42)|((vi[:,1]+off)<<21)|(vi[:,2]+off)
km=key[keep]; uk,cnt=np.unique(km,return_counts=True)
nb=np.zeros(len(uk),np.int64)
for dx in (-1,0,1):
  for dy in (-1,0,1):
    for dz in (-1,0,1):
      q=uk+(dx<<42)+(dy<<21)+dz; j=np.searchsorted(uk,q); j[j>=len(uk)]=0; hit=uk[j]==q; nb+=np.where(hit,cnt[j],0)
vox_nb=nb[np.searchsorted(uk,km)]
lonely=vox_nb<6
idx=np.where(keep)[0]; keep[idx[lonely]]=False
print('floaters removed',lonely.sum(),'kept',keep.sum())
# ---- ground and obstacles on a 0.1 grid, 24 x 24 around the stump ----
cell=0.1; x0,z0=-12.0,-12.0; nx=nz=240
W=w[keep]; A=a[keep]; S=sc[keep].max(1)
inb=(W[:,0]>x0)&(W[:,0]<x0+nx*cell)&(W[:,2]>z0)&(W[:,2]<z0+nz*cell)
sel=inb&(A>60)&(S<0.3); Ws=W[sel]
k=((Ws[:,2]-z0)/cell).astype(int)*nx+((Ws[:,0]-x0)/cell).astype(int)
order=np.lexsort((Ws[:,1],k)); ks=k[order]; ys=Ws[order,1]
st=np.searchsorted(ks,np.arange(nx*nz)); en=np.searchsorted(ks,np.arange(nx*nz),side='right')
g=np.full(nx*nz,np.nan)
for i in np.where(en-st>=5)[0]: g[i]=ys[st[i]+int((en[i]-st[i])*0.04)]
g=g.reshape(nz,nx)
plane=float(np.nanmedian(g[100:140,100:140])); print('ground plane y',plane)
g[(g>plane+0.6)|(g<plane-0.6)]=np.nan                  # canopy-only cells are not ground
from scipy import ndimage
mask=np.isnan(g); ii=ndimage.distance_transform_edt(mask,return_distances=False,return_indices=True)
gf=g[tuple(ii)]
# the ground is the lower envelope: an opening wipes out anything narrower than ~1.3 m standing on it (the stump,
# posts, trunks) so they become obstacles rather than raised ground; then keep it gentle
gf=ndimage.grey_opening(gf,size=(13,13)); gf=np.clip(gf,plane-0.3,plane+0.3); gf=ndimage.gaussian_filter(gf,3)
far=ndimage.distance_transform_edt(mask)>15; gf[far]=plane    # far from any data: the plane
# obstacles: solid stuff 0.35 m to 2.5 m above the local ground
gi=gf.reshape(-1)[k]; hh=Ws[:,1]-gi
ob=(hh>0.35)&(hh<2.5)&(np.repeat(True,len(hh)))
cntO=np.bincount(k[ob],minlength=nx*nz).reshape(nz,nx)
top=np.zeros(nx*nz); np.maximum.at(top,k[ob],hh[ob]); top=top.reshape(nz,nx)
block=cntO>=8
block=ndimage.binary_opening(block,iterations=1)|(cntO>=25)
block=ndimage.binary_closing(block,iterations=1)
top[~block]=0
print('blocked cells',block.sum(), 'stump cell top', top[118:123,118:123].max())
# pack: header + int16 ground (mm) + uint8 top (2 cm units)
G=np.round(gf*1000).astype(np.int16); T=np.clip(np.round(top/0.02),0,255).astype(np.uint8)
blob=b'COL1'+struct.pack('<ffffi',x0,z0,cell,plane,nx)+struct.pack('<i',nz)+G.tobytes()+T.tobytes()
open('stump-collide.bin','wb').write(zlib.compress(blob,9)); print('collide bytes',len(zlib.compress(blob,9)))
img=np.zeros((nz,nx,3),np.uint8); gg=(gf-plane); img[...,1]=np.clip(80+gg*300,0,255); img[block]=(230,90,40)
Image.fromarray(img[::-1]).resize((720,720),Image.NEAREST).save('collide.png')
# ---- re-pack the kept splats as .stm (same as enc.py) ----
dd=d[keep]; pos=p[keep]; s3=sc[keep]
lo=pos.min(0); hi=pos.max(0); q=np.round((pos-lo)/(hi-lo)*65535).astype(np.uint32)
def spread(v):
    v=v&0x3ff; v=(v|(v<<16))&0x030000FF; v=(v|(v<<8))&0x0300F00F; v=(v|(v<<4))&0x030C30C3; v=(v|(v<<2))&0x09249249; return v
m=spread(q[:,0]>>6)|(spread(q[:,1]>>6)<<1)|(spread(q[:,2]>>6)<<2)
o=np.argsort(m,kind='stable'); dd=dd[o]; q=q[o].astype(np.uint16); s3=s3[o]
ls=np.log(s3); slo,shi=float(ls.min()),float(ls.max()); qs=np.clip(np.round((ls-slo)/(shi-slo)*65535),0,65535).astype(np.uint16)
n=len(dd); planes=[np.ascontiguousarray(q[:,i]).view(np.uint8).reshape(-1,2) for i in range(3)]+[np.ascontiguousarray(qs[:,i]).view(np.uint8).reshape(-1,2) for i in range(3)]
body=b''.join([pp[:,0].tobytes()+pp[:,1].tobytes() for pp in planes])+b''.join(dd[:,24+i].tobytes() for i in range(8))
hdr=b'STM1'+struct.pack('<I',n)+struct.pack('<8f',*lo,*hi,slo,shi)
z=zlib.compress(hdr+body,9); open('stump-hd.stm','wb').write(z); print('stm',n,len(z)/1e6,'MB')
