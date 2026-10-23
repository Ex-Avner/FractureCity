# Builds apps/fracture-city-game/shop-catalog.json from the workshop finishes
# (city-build.js) and the furniture catalogue (furniture-catalogue.js).
# Usage: python3 _build/build-shop-catalog.py <repo root>
import json,re,sys
root=sys.argv[1];g=root+'/apps/fracture-city-game/'
s=open(g+'city-build.js').read()
i=s.find('const catalog=');j=s.find('].map(',i)
rows=re.findall(r"\['([^']+)','(#[0-9a-f]{6})','([a-z]+)'\]",s[i:j])
price={'plaster':1,'concrete':1,'brick':2,'tile':2,'check':2,'wood':2,'speckle':3,'flute':3,'panel':3,'light':4,'glass':3,'door':12}
blocks=[{'sku':'b:%d'%(120+k),'id':120+k,'name':n,'color':c,'pattern':p,'price':price[p],'stack':16 if p!='door' else 2} for k,(n,c,p) in enumerate(rows)]
f=open(g+'furniture-catalogue.js').read()
items=re.findall(r"add\('([^']+)','([^']+)'",f)
cat={'Seating':60,'Tables':50,'Storage':70,'Bedroom':90,'Lighting':40,'Kitchen':80,'Bathroom':90,'Studio':110,'Plants & décor':25}
furn=[{'sku':'f:%d'%k,'id':k,'name':n,'category':c,'price':cat[c]} for k,(n,c) in enumerate(items)]
out={'version':1,'currency':'credits','startingBalance':300,'blocks':blocks,'furniture':furn}
open(g+'shop-catalog.json','w').write(json.dumps(out,indent=1,ensure_ascii=False)+'\n')
print(len(blocks),len(furn))
