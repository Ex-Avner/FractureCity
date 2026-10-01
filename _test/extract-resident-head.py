import json,sys
v=[];fs=[];group=''
for l in open(sys.argv[1]):
 if l.startswith('v '):v.append(list(map(float,l.split()[1:])))
 if l.startswith('g '):group=l.strip()[2:]
 if l.startswith('f ') and group=='body':
  face=[int(x.split('/')[0])-1 for x in l.split()[1:]]
  if min(v[i][1] for i in face)>5.95:fs.append(face)
ids=sorted(set(i for f in fs for i in f));mapping={a:b for b,a in enumerate(ids)}
pos=[];idx=[]
for i in ids:
 x,y,z=v[i];pos.extend([round(x*.1,6),round((y-6.8)*.11,6),round(z*.1-.04,6)])
for f in fs:
 for j in range(1,len(f)-1):idx.extend([mapping[f[0]],mapping[f[j]],mapping[f[j+1]]])
open(sys.argv[2],'w').write('// Human head derived from MakeHuman hm08, CC0. See assets/MAKEHUMAN-LICENSE.md.\nwindow.FCResidentHead='+json.dumps({'position':pos,'index':idx},separators=(',',':'))+';\n')
print(len(ids),'vertices',len(idx)//3,'triangles',min(pos[::3]),max(pos[::3]))
