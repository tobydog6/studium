# Build an equirectangular "sky map" for the scan from its own far-away splats, holes filled, sky on top.
import numpy as np, sys
from PIL import Image
from scipy import ndimage
d=np.fromfile('/mnt/user-data/uploads/STUMP_1.splat',dtype=np.uint8).reshape(-1,32)
p=d[:,:12].copy().view(np.float32).reshape(-1,3).astype(np.float64); col=d[:,24:27].astype(np.float64); a=d[:,27].astype(np.float64)/255
w=np.stack([p[:,0],-p[:,1],-p[:,2]],1)
C=np.array([0.0,1.6,-0.5])
v=w-C; dist=np.linalg.norm(v,axis=1)
m=(dist>4)&(dist<60)&(a>0.15)
v=v[m]/dist[m,None]; col=col[m]; a=a[m]; dist=dist[m]
W,H=1024,512
u=(np.arctan2(v[:,0],-v[:,2])/(2*np.pi)+0.5)*W; el=np.arcsin(np.clip(v[:,1],-1,1)); vv=(0.5-el/np.pi)*H
iu=np.clip(u.astype(int),0,W-1); iv=np.clip(vv.astype(int),0,H-1)
wt=a*np.clip(dist/10,0.4,2.0)
acc=np.zeros((H,W,3)); cov=np.zeros((H,W))
np.add.at(cov,(iv,iu),wt)
for k in range(3): np.add.at(acc[...,k],(iv,iu),wt*col[:,k])
# push-pull fill
def pull(acc,cov):
    levels=[(acc,cov)]
    while levels[-1][1].shape[1]>8:
        A,Cv=levels[-1]; h,w_=Cv.shape
        A2=A[:h//2*2,:w_//2*2].reshape(h//2,2,w_//2,2,3).sum((1,3)); C2=Cv[:h//2*2,:w_//2*2].reshape(h//2,2,w_//2,2).sum((1,3)); levels.append((A2,C2))
    A,Cv=levels[-1]; img=A/np.maximum(Cv,1e-6)[...,None]; conf=np.minimum(Cv,1)
    for A,Cv in reversed(levels[:-1]):
        up=np.repeat(np.repeat(img,2,0),2,1); up=ndimage.gaussian_filter(up,(1,1,0),mode=['nearest','wrap','nearest'])
        h,w_=Cv.shape; up=np.pad(up,((0,h-up.shape[0]),(0,w_-up.shape[1]),(0,0)),mode='edge')
        own=A/np.maximum(Cv,1e-6)[...,None]; t=np.clip(Cv/2.0,0,1)[...,None]
        img=own*t+up*(1-t)
    return img
img=pull(acc,cov)
covs=ndimage.gaussian_filter(cov,6,mode=['nearest','wrap'])
# sky: overcast, from the brightest upward splats
upm=(v[:,1]>0.35); lum=col[upm]@[0.299,0.587,0.114]
skyc=np.percentile(col[upm][lum>=np.percentile(lum,97)],50,axis=0) if upm.sum()>100 else np.array([215,220,222.])
skyc=np.clip(skyc*0.9,0,236); print('sky colour',skyc,'coverage frac',(cov>0).mean())
yy=np.linspace(1,-1,H)[:,None]
sky=np.ones((H,W,3))*skyc; sky=sky*(0.92+0.08*np.clip(yy,0,1))[...,None]   # a touch brighter overhead
gnd=np.percentile(col[v[:,1]<-0.1],50,axis=0) if (v[:,1]<-0.1).sum()>100 else np.array([70,65,50.])
mix=np.clip(covs/0.6,0,1)
# columns the scan never saw borrow the treeline from columns it did, mirrored back and forth so it reads as one wood
colcov=mix[int(H*0.30):int(H*0.55)].mean(0); good=colcov>0.35
if good.any() and not good.all():
    idx=np.where(good)[0]
    # longest covered run (circular)
    g2=np.concatenate([good,good]); best=(0,0); s=None
    for i,gv in enumerate(g2):
        if gv and s is None: s=i
        if (not gv or i==len(g2)-1) and s is not None:
            e=i if not gv else i+1
            if e-s>best[1]-best[0]: best=(s,e)
            s=None
    s,e=best; L=min(e-s,W)
    mapc=np.arange(W)
    for c in range(W):
        if good[c]: continue
        k=(c-s)%W; per=2*L; r=k%per; mapc[c]=(s+(r if r<L else per-1-r))%W
    img=img[:,mapc]; mix=np.maximum(mix, mix[:,mapc]*0.9)
mix=ndimage.gaussian_filter(mix,(4,10),mode=['nearest','wrap'])[...,None]
hz=np.clip((yy+0.02)/0.12,0,1)[...,None]; fill=sky*hz+gnd*np.ones((H,W,3))*(1-hz)
out=img*mix+fill*(1-mix)
out=ndimage.gaussian_filter(out,(2.5,4,0),mode=["nearest","wrap","nearest"])
Image.fromarray(np.clip(out,0,255).astype(np.uint8)).save(sys.argv[1] if len(sys.argv)>1 else 'sky.png')
