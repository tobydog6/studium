var SPLAT_SCENES=[{id:"stump",name:"The Stump",desc:"An old stump gone to ivy, in a park clearing. Outdoor, overcast, full-detail scan.",up:"ydown",ext:"stm",thumb:"asset:assets/scenes/stump-card.webp",data:"asset-b64:assets/scenes/stump-hd.stm",collide:"asset-b64:assets/scenes/stump-collide.bin",sky:"asset:assets/scenes/stump-sky.webp",
challenges:[
  {id:"stump-worm",title:"Worm’s eye",brief:"Crouch right down at its foot and look up. Wide makes the stump tower over you.",eye:[0.75,0.35,-0.45],look:[0.55,1.45,-1.7],mm:24,
   need:[{k:"mm",max:28,label:"Zoom out to 24 mm (press 4 in the viewfinder, then scroll)"},{k:"f",min:8,label:"f/8 or smaller, so it’s all sharp"},{k:"ev",tol:1,label:"Exposure within a stop"}]},
  {id:"stump-ivy",title:"Lift the ivy out",brief:"Stand back with a long lens and open right up, so the ivy is sharp and everything behind melts.",eye:[-2.4,1.5,0.5],look:[0.55,0.8,-1.7],mm:85,
   need:[{k:"mm",min:80,label:"The 85 mm lens (camera bag, B)"},{k:"f",max:2.8,label:"Wide open, f/2.8 or wider"},{k:"ev",tol:1,label:"Exposure within a stop"}]},
  {id:"stump-above",title:"The overview",brief:"Stand tall and look down on it. Show where the stump sits in its clearing.",eye:[2.2,2.2,-0.3],look:[0.55,0.2,-1.7],mm:28,
   need:[{k:"mm",max:32,label:"Zoom out to 28 mm (press 4 in the viewfinder, then scroll)"},{k:"f",min:5.6,label:"f/5.6 or smaller"},{k:"ev",tol:1,label:"Exposure within a stop"}]}]}];
