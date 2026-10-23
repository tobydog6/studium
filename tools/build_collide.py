# A walk map (ground heights + obstacles) for any scan, from a decoded .splat, in Studium's world space.
# python3 tools/build_collide.py in.splat out-collide.bin --up zup --scale 5 --cx 0 --cz 0 --size 40
# (same packing as build_scene.py: header, int16 ground in mm, uint8 obstacle top in 2 cm units, zlib)
import numpy as np, zlib, struct, argparse
from scipy import ndimage
ap=argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('--up',default='zup'); ap.add_argument('--scale',type=float,default=1)
ap.add_argument('--cx',type=float,default=0); ap.add_argument('--cz',type=float,default=0); ap.add_argument('--size',type=float,default=40); ap.add_argument('--cell',type=float,default=0.1)
A=ap.parse_args()
d=np.fromfile(A.src,dtype=np.uint8).reshape(-1,32); p=d[:,:12].copy().view(np.float32).reshape(-1,3).astype(np.float64); a=d[:,27]; sc=d[:,12:24].copy().view(np.float32).reshape(-1,3)
if A.up=='zup': w=np.stack([p[:,0],p[:,2],-p[:,1]],1)
elif A.up=='ydown': w=np.stack([p[:,0],-p[:,1],-p[:,2]],1)
else: w=p.copy()
w*=A.scale; S=sc.max(1)*A.scale
cell=A.cell; nx=nz=int(A.size/cell); x0=A.cx-A.size/2; z0=A.cz-A.size/2
inb=(w[:,0]>x0)&(w[:,0]<x0+nx*cell)&(w[:,2]>z0)&(w[:,2]<z0+nz*cell)
sel=inb&(a>60)&(S<0.3); Ws=w[sel]
k=((Ws[:,2]-z0)/cell).astype(int)*nx+((Ws[:,0]-x0)/cell).astype(int)
order=np.lexsort((Ws[:,1],k)); ks=k[order]; ys=Ws[order,1]
st=np.searchsorted(ks,np.arange(nx*nz)); en=np.searchsorted(ks,np.arange(nx*nz),side='right')
g=np.full(nx*nz,np.nan)
for i in np.where(en-st>=5)[0]: g[i]=ys[st[i]+int((en[i]-st[i])*0.04)]
g=g.reshape(nz,nx); c=nz//2
plane=float(np.nanmedian(g[c-40:c+40,c-40:c+40])); print('ground plane y',plane)
g[(g>plane+0.6)|(g<plane-0.6)]=np.nan
mask=np.isnan(g); ii=ndimage.distance_transform_edt(mask,return_distances=False,return_indices=True); gf=g[tuple(ii)]
gf=ndimage.grey_opening(gf,size=(13,13)); gf=np.clip(gf,plane-0.3,plane+0.3); gf=ndimage.gaussian_filter(gf,3)
far=ndimage.distance_transform_edt(mask)>15; gf[far]=plane
gi=gf.reshape(-1)[k]; hh=Ws[:,1]-gi
ob=(hh>0.35)&(hh<2.5)
cntO=np.bincount(k[ob],minlength=nx*nz).reshape(nz,nx)
top=np.zeros(nx*nz); np.maximum.at(top,k[ob],hh[ob]); top=top.reshape(nz,nx)
block=cntO>=8; block=ndimage.binary_opening(block,iterations=1)|(cntO>=25); block=ndimage.binary_closing(block,iterations=1); top[~block]=0
print('blocked cells',block.sum(),'of',nx*nz)
G=np.round(gf*1000).astype(np.int16); T=np.clip(np.round(top/0.02),0,255).astype(np.uint8)
blob=b'COL1'+struct.pack('<ffffi',x0,z0,cell,plane,nx)+struct.pack('<i',nz)+G.tobytes()+T.tobytes()
z=zlib.compress(blob,9); open(A.out,'wb').write(z); print('collide bytes',len(z))
from PIL import Image
img=np.zeros((nz,nx,3),np.uint8); img[...,1]=np.clip(80+(gf-plane)*300,0,255); img[block]=(230,90,40); Image.fromarray(img[::-1]).save(A.out+'.png')
