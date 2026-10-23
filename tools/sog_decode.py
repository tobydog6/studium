import json, numpy as np, sys
from PIL import Image
D=sys.argv[1]; m=json.load(open(D+'/meta.json')); n=m['count']
rd=lambda f: np.asarray(Image.open(D+'/'+f).convert('RGBA')).reshape(-1,4)[:n].astype(np.uint32)
L=rd('means_l.webp'); U=rd('means_u.webp')
v=((U[:,:3]<<8)|L[:,:3])/65535.0; mn=np.array(m['means']['mins']); mx=np.array(m['means']['maxs'])
nn=mn+v*(mx-mn); xyz=np.sign(nn)*(np.exp(np.abs(nn))-1)
S=rd('scales.webp'); cb=np.array(m['scales']['codebook']); sc=np.exp(cb[S[:,:3]])
C=rd('sh0.webp'); cb0=np.array(m['sh0']['codebook']); col=np.clip((0.5+0.28209479*cb0[C[:,:3]])*255,0,255).astype(np.uint8); a=C[:,3].astype(np.uint8)
Q=rd('quats.webp'); big=Q[:,3]-252; comp=(Q[:,:3]/255.0*2-1)/np.sqrt(2); q=np.zeros((n,4))
for k in range(4):
    sel=big==k; idx=[j for j in range(4) if j!=k]
    for t,j in enumerate(idx): q[sel,j]=comp[sel,t]
    q[sel,k]=np.sqrt(np.clip(1-(comp[sel]**2).sum(1),0,1))
print('n',n,'xyz pct',np.percentile(xyz,[2,50,98],0).round(2).tolist(),'scale med',np.median(sc,0),'alpha med',np.median(a),'big counts',np.bincount(big.astype(int),minlength=4))
out=np.zeros((n,32),np.uint8); out[:,0:12]=xyz.astype(np.float32).view(np.uint8).reshape(-1,12); out[:,12:24]=sc.astype(np.float32).view(np.uint8).reshape(-1,12)
out[:,24:27]=col; out[:,27]=a; out[:,28:32]=np.clip(q*128+128,0,255).astype(np.uint8)   # quat order as stored (w,x,y,z?)
keep=(a>8)&(sc.max(1)<1)
out[keep].tofile(D+'/office.splat'); print('kept',keep.sum())
