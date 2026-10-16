var SPLAT_SCENES=[{id:"stump",name:"The Stump",desc:"An old stump gone to ivy, in a park clearing. Outdoor, overcast, full-detail scan.",up:"ydown",ext:"stm",thumb:"asset:assets/scenes/stump-card.webp",data:"asset-b64:assets/scenes/stump-hd.stm",collide:"asset-b64:assets/scenes/stump-collide.bin",sky:"asset:assets/scenes/stump-sky.webp",
challenges:[
  {id:"stump-worm",title:"Worm’s eye",brief:"Get right down at its foot and look up. A wide lens makes the stump tower over you.",at:[0.75,-0.25],look:[0.55,1.35,-1.7],
   need:[{k:"eye",max:0.55,label:"Crouch right down (hold Q)"},{k:"mm",max:35,label:"Wide lens, 35 mm or wider"},{k:"f",min:8,label:"f/8 or smaller, all sharp"},{k:"aim",tol:14,label:"Aim up at the top of the stump"},{k:"ev",tol:1,label:"Exposure within a stop"}]},
  {id:"stump-ivy",title:"Lift the ivy out",brief:"Stand back with a long lens and open right up, so the ivy is sharp and everything behind melts.",at:[-2.6,0.6],look:[0.55,0.8,-1.7],
   need:[{k:"mm",min:85,label:"Long lens, 85 mm or longer"},{k:"f",max:2.8,label:"Wide open, f/2.8 or wider"},{k:"aim",tol:6,label:"Aim at the ivy on the stump"},{k:"ev",tol:1,label:"Exposure within a stop"}]},
  {id:"stump-above",title:"The overview",brief:"Stand tall and look down on it. Show where the stump sits in its clearing.",at:[2.4,-0.4],look:[0.55,0.25,-1.7],
   need:[{k:"eye",min:2.0,label:"Stand tall (hold E)"},{k:"mm",max:35,label:"Wide lens, 35 mm or wider"},{k:"f",min:5.6,label:"f/5.6 or smaller"},{k:"aim",tol:12,label:"Aim down at the base of the stump"},{k:"ev",tol:1,label:"Exposure within a stop"}]}]}];
