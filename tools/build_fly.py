# The Fly: a Postshot .ply of a cluster fly, scaled up 13x so it stands about 3.5 m across, packed as .stm
# (same packing as build_scene.py). No walk map: the fly is a studio world you float around.
import numpy as np, zlib, struct, sys
SRC=sys.argv[1] if len(sys.argv)>1 else '/mnt/user-data/uploads/cluster_fly_XL.ply'
f=open(SRC,'rb'); hdr=b''
while True:
    l=f.readline(); hdr+=l
    if l.strip()==b'end_header': break
props=[l.split()[-1].decode() for l in hdr.split(b'\n') if l.startswith(b'property')]
n=int([l for l in hdr.split(b'\n') if l.startswith(b'element vertex')][0].split()[-1])
d=np.fromfile(f,dtype=np.float32,count=n*len(props)).reshape(n,len(props)); P={k:i for i,k in enumerate(props)}
SH=0.28209479177387814
xyz=d[:,[P['x'],P['y'],P['z']]].astype(np.float64); sc=np.exp(d[:,[P['scale_0'],P['scale_1'],P['scale_2']]])
col=np.clip((0.5+SH*d[:,[P['f_dc_0'],P['f_dc_1'],P['f_dc_2']]])*255,0,255).astype(np.uint8)
a=(1/(1+np.exp(-d[:,P['opacity']]))*255).clip(0,255).astype(np.uint8)
q=d[:,[P['rot_0'],P['rot_1'],P['rot_2'],P['rot_3']]]; q=q/np.linalg.norm(q,axis=1,keepdims=True); qb=np.clip(q*128+128,0,255).astype(np.uint8)
keep=(a>=8)&np.isfinite(xyz).all(1)&(sc>0).all(1)
S=13.0; c=np.median(xyz[keep],0); pos=((xyz-c)*S)[keep].astype(np.float32); s3=(sc*S)[keep].astype(np.float32)
dd=np.zeros((keep.sum(),32),np.uint8); dd[:,24:27]=col[keep]; dd[:,27]=a[keep]; dd[:,28:32]=qb[keep]
print('kept',len(dd),'bounds',pos.min(0),pos.max(0))
lo=pos.min(0); hi=pos.max(0); qq=np.round((pos-lo)/(hi-lo)*65535).astype(np.uint32)
def spread(v):
    v=v&0x3ff; v=(v|(v<<16))&0x030000FF; v=(v|(v<<8))&0x0300F00F; v=(v|(v<<4))&0x030C30C3; v=(v|(v<<2))&0x09249249; return v
m=spread(qq[:,0]>>6)|(spread(qq[:,1]>>6)<<1)|(spread(qq[:,2]>>6)<<2)
o=np.argsort(m,kind='stable'); dd=dd[o]; qq=qq[o].astype(np.uint16); s3=s3[o]
ls=np.log(s3); slo,shi=float(ls.min()),float(ls.max()); qs=np.clip(np.round((ls-slo)/(shi-slo)*65535),0,65535).astype(np.uint16)
N=len(dd); planes=[np.ascontiguousarray(qq[:,i]).view(np.uint8).reshape(-1,2) for i in range(3)]+[np.ascontiguousarray(qs[:,i]).view(np.uint8).reshape(-1,2) for i in range(3)]
body=b''.join([pp[:,0].tobytes()+pp[:,1].tobytes() for pp in planes])+b''.join(dd[:,24+i].tobytes() for i in range(8))
hdr=b'STM1'+struct.pack('<I',N)+struct.pack('<8f',*lo,*hi,slo,shi)
z=zlib.compress(hdr+body,9); open('assets/scenes/fly.stm','wb').write(z); print('stm',N,len(z)/1e6,'MB')
