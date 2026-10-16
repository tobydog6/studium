var SPLAT_SCENES=[{id:"stump",name:"The Stump",desc:"An old stump gone to ivy, in a park clearing. Outdoor, overcast, full-detail scan.",up:"ydown",ext:"stm",thumb:"asset:assets/scenes/stump-card.webp",data:"asset-b64:assets/scenes/stump-hd.stm",collide:"asset-b64:assets/scenes/stump-collide.bin",sky:"asset:assets/scenes/stump-sky.webp",
subject:[0.55,-1.7],
challenges:[
  {id:"stump-worm",title:"Worm’s eye",brief:"Get down at its foot and look up. Wide makes the stump tower over you.",az:10,dist:1.15,h:0.35,look:[0,1.45,0],mm:24,
   need:[{k:"mm",max:28,label:"Zoom out to 24 mm (press 4 in the viewfinder, then scroll)"},{k:"f",min:8,label:"f/8 or smaller, so it’s all sharp"},{k:"ev",tol:1,label:"Exposure within a stop"}]},
  {id:"stump-ivy",title:"Lift the ivy out",brief:"Stand back with a long lens and open right up, so the ivy is sharp and everything behind melts.",az:-75,dist:3.0,h:1.4,look:[0,0.8,0],mm:85,
   need:[{k:"mm",min:80,label:"The 85 mm lens (camera bag, B)"},{k:"f",max:2.8,label:"Wide open, f/2.8 or wider"},{k:"ev",tol:1,label:"Exposure within a stop"}]},
  {id:"stump-above",title:"The overview",brief:"Stand tall and look down on it. Show where the stump sits in its clearing.",az:70,dist:2.1,h:2.25,look:[0,0.15,0],mm:28,
   need:[{k:"mm",max:32,label:"Zoom out to 28 mm (press 4 in the viewfinder, then scroll)"},{k:"f",min:5.6,label:"f/5.6 or smaller"},{k:"ev",tol:1,label:"Exposure within a stop"}]},
  {id:"stump-bark",title:"Fill the frame",brief:"Go close round the back. Let the bark and ivy fill every corner, nothing else.",az:175,dist:1.05,h:1.0,look:[0,0.9,0],mm:50,
   need:[{k:"mm",min:45,max:55,label:"50 mm (the zoom at 50, or the 50 in the bag)"},{k:"f",min:5.6,label:"f/5.6 or smaller, for detail"},{k:"ev",tol:1,label:"Exposure within a stop"}]},
  {id:"stump-sky",title:"Against the sky",brief:"Crouch low on the far side and put the broken top against the bright sky.",az:-140,dist:1.6,h:0.55,look:[0,1.75,0],mm:35,
   need:[{k:"mm",max:38,label:"Zoom to 35 mm (press 4, then scroll)"},{k:"ev",tol:1,label:"Expose for the sky: within a stop"}]}]}];
