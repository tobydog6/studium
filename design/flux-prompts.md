# Studium camera and lens renders: Flux prompts

Every render needs to look like it came from the same studio shoot as the mirrorless renders already in `design/renders/`: matte black bodies, pebbled leatherette, knurled dials, warm brass/gold accents, warm key light on a black void.

## How to run these

1. **Do the 50 mm lens and the mirrorless body first.** If your Flux version takes a reference image (image prompt, Kontext or "style reference"), feed it `mirrorless-front-3q.png` for every later prompt so the materials and light stay locked.
2. **Same seed per family.** Once a seed gives you the right light, reuse it for every view of that object.
3. **Generate 4, pick 1.** Small things (wrong dial count, melted text) are cheaper to reroll than to fix.
4. **Mid-grey background, then send them to me.** Black on black can't be cut out cleanly (tested 16 Oct: the AI cutter ate part of the body). Swap every prompt's background sentence for: "The camera floats in front of a flat, seamless, evenly lit neutral mid-grey backdrop, lit separately so it stays one uniform grey with no gradient, no vignette, no floor, no horizon line and no shadow cast onto it." I cut out with `rembg` (isnet-general-use) and grade with `tools/grade_render.py`.
4b. **Richer light.** Swap the lighting sentence for the warm raking tungsten key (2800 K, grazing angle, golden edge highlights, crisp cool rim light) used in the final B0 prompt below, and frame the object at about 75 percent of the frame. I'll cut each one out to a transparent PNG, align it to the UI (screen corners, mount centre) and drop it into the canvas.
5. **Highest resolution you can.** At least 2048 px on the long edge. Aspect ratios are given per shot.
6. Flux ignores "no X" phrasing, so these prompts describe what *is* there ("blank smooth nameplate") rather than what isn't.

---

## Lenses (full-frame mirrorless mount)

All five share one family look: matte black anodised barrels, a fine diamond-knurled rubber focus ring, a thin brushed-brass accent ring near the mount, engraved distance scale in warm off-white, and multicoated glass with amber and green reflections.

### L1 · 50 mm f/1.8 "normal" · side profile (3:2)
```
Studio product photograph of a compact 50 mm f/1.8 camera lens shown in exact side profile, optical axis perfectly horizontal, mount end on the left and front element on the right, filling about 60 percent of the frame width and centred with generous black margin. The barrel is matte black anodised aluminium with a soft satin sheen, roughly as long as it is wide. A wide focus ring of fine diamond-knurled black rubber wraps the front half of the barrel. Behind it a narrow smooth band carries a crisp engraved distance scale in warm off-white numerals, with a single small brass index dot. At the rear sits a thin ring of brushed brass, then a polished black bayonet mount with three short lugs and a row of tiny gold electrical contacts. The front edge is a slim chamfered lip catching a thin line of warm light. The lens is completely unbranded, with smooth blank surfaces wherever a brand name would sit. Lighting: one large warm softbox high and to the left at about 3200 kelvin, a faint cool rim light from behind on the right tracing the top edge, deep soft shadows, pure black seamless background. Shot on a 150 mm macro lens at f/11, orthographic-looking with no perspective distortion, everything tack sharp from end to end, ultra-high detail, photorealistic, premium camera catalogue style.
```

### L2 · 50 mm f/1.8 · front-on (1:1)
```
Studio product photograph looking straight down the optical axis of a compact 50 mm f/1.8 camera lens, perfectly centred and perfectly circular in frame, filling about 70 percent of the frame. The front element is a deep multicoated glass dome showing layered internal reflections in warm amber, soft green and violet, with the aperture blades faintly visible inside as a dark hexagon. Around the glass, a matte black inner bezel carries a fine ring of engraved off-white text reduced to abstract tick marks and numerals only. Outside that, the diamond-knurled black rubber focus ring is seen edge-on as a textured halo, and the outermost rim is a thin brushed-brass ring catching warm light along its upper left arc. Completely unbranded. Lighting: one warm softbox upper left at 3200 kelvin producing a soft crescent highlight on the glass, faint cool rim on the lower right, pure black seamless background. Shot on a 150 mm macro lens, orthographic, no perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style.
```

### L3 · 24 mm f/1.4 "wide" · side profile (3:2)
```
Studio product photograph of a fast 24 mm f/1.4 wide-angle camera lens in exact side profile, optical axis perfectly horizontal, mount on the left and front on the right, centred with generous black margin. Shorter and stubbier than a standard lens, it flares outward toward the front to hold a large, strongly curved bulging front element that sits proud of the barrel and reflects warm amber and green highlights. The barrel is matte black anodised aluminium with a satin sheen. A broad diamond-knurled black rubber focus ring sits near the front, and behind it a smooth band carries a crisp engraved distance scale in warm off-white numerals with a small brass index dot. A thin brushed-brass accent ring sits near the polished black bayonet mount with three lugs and tiny gold contacts. Completely unbranded, with smooth blank surfaces where a brand name would be. Lighting: one large warm softbox high left at about 3200 kelvin, faint cool rim light from behind right along the top edge, deep soft shadows, pure black seamless background. Shot on a 150 mm macro lens at f/11, orthographic, no perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style, same lens family as a matching 50 mm.
```

### L4 · 35 mm f/2 "street" · side profile (3:2)
```
Studio product photograph of a small, discreet 35 mm f/2 camera lens in exact side profile, optical axis perfectly horizontal, mount on the left and front on the right, centred with generous black margin. A compact cylindrical barrel, slightly shorter than it is wide, with a gently recessed front element showing a warm amber reflection. Matte black anodised aluminium with a satin sheen, a slim diamond-knurled black rubber focus ring, a narrow band with a crisp engraved off-white distance scale and a small brass index dot, a thin brushed-brass accent ring, and a polished black bayonet mount with three lugs and tiny gold contacts. Understated, precise, quietly beautiful. Completely unbranded, with smooth blank surfaces where a brand name would be. Lighting: one large warm softbox high left at about 3200 kelvin, faint cool rim light from behind right, pure black seamless background. Shot on a 150 mm macro lens at f/11, orthographic, no perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style, same lens family as a matching 50 mm.
```

### L5 · 85 mm f/1.4 "portrait" · side profile (3:2)
```
Studio product photograph of a large, heavy 85 mm f/1.4 portrait lens in exact side profile, optical axis perfectly horizontal, mount on the left and front on the right, centred with generous black margin. A thick, substantial barrel about one and a half times longer than it is wide, widening slightly toward a big front element of deep multicoated glass glowing with warm amber and soft green reflections. Matte black anodised aluminium with a satin sheen, a very wide diamond-knurled black rubber focus ring across the middle, a smooth band with a crisp engraved off-white distance scale and a small brass index dot, a thin brushed-brass accent ring near the rear, and a polished black bayonet mount with three lugs and tiny gold contacts. Feels dense, expensive and serious. Completely unbranded, with smooth blank surfaces where a brand name would be. Lighting: one large warm softbox high left at about 3200 kelvin, faint cool rim light from behind right along the top edge, pure black seamless background. Shot on a 150 mm macro lens at f/11, orthographic, no perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style, same lens family as a matching 50 mm.
```

### L6 · 135 mm f/2 "tele" · side profile (3:2)
```
Studio product photograph of a long 135 mm f/2 telephoto camera lens in exact side profile, optical axis perfectly horizontal, mount on the left and front on the right, centred and filling about 75 percent of the frame width. A long straight cylindrical barrel about two and a half times longer than it is wide, ending in a built-in sliding lens hood with a subtle brushed-brass rim at its front edge. Matte black anodised aluminium with a satin sheen, a wide diamond-knurled black rubber focus ring in the front third, a smooth band with a long crisp engraved off-white distance scale and a small brass index dot, a thin brushed-brass accent ring near the rear, and a polished black bayonet mount with three lugs and tiny gold contacts. Completely unbranded, with smooth blank surfaces where a brand name would be. Lighting: one large warm softbox high left at about 3200 kelvin, faint cool rim light from behind right tracing the full top edge, pure black seamless background. Shot on a 150 mm macro lens at f/11, orthographic, no perspective distortion, tack sharp from end to end, ultra-high detail, photorealistic, premium camera catalogue style, same lens family as a matching 50 mm.
```

### L7 · The whole set, lined up (16:9), for the lens tray reference
```
Studio product photograph of five matching unbranded camera lenses standing upright on their mounts in a neat row on a pure black seamless surface, ordered left to right from shortest to longest: a stubby 24 mm with a bulging front element, a compact 35 mm, a small 50 mm, a thick 85 mm with a big front element, and a long 135 mm with a built-in hood. All share one family look: matte black anodised barrels with a satin sheen, fine diamond-knurled black rubber focus rings, crisp engraved off-white distance scales with small brass index dots, a thin brushed-brass accent ring near each mount, and multicoated glass glowing amber and green. Even spacing, all lenses tack sharp, shot straight on at eye level with a 150 mm lens so there is no perspective distortion. One large warm softbox from the upper left at about 3200 kelvin, a faint cool rim light from behind, soft reflections on the black surface fading to pure black. Ultra-high detail, photorealistic, premium camera catalogue style.
```

---

## Bodies

Each body needs three views so it works everywhere in the app:

- **Front three-quarter:** the bag hero and thumbnails.
- **Rear straight-on:** the camera back screen.
- **Front straight-on without lens:** the lens swap.

The full prompts below are the front three-quarter hero. Use the view templates after them for the other two views of each body.

### B0 · Full-frame DSLR (matches the school's Canon kit, unbranded) · front three-quarter (1:1)
Puts controls where students' real cameras have them: shutter and top status screen on the grip, mode dial on the opposite shoulder.
```
Studio product photograph of a professional full-frame digital SLR camera seen from a front three-quarter angle, matching the angle of a reference camera: the lens points toward the lower right of the frame, so we see the front of the camera and its left-hand end (the side opposite the hand grip), viewed from slightly above so the top plate is clearly visible, centred with generous margin on a pure black seamless background. Anatomy exactly like a real DSLR: there is only one hand grip, a deep sculpted grip on the left side of the image wrapped in fine pebbled black rubber, with the shutter button and a front control wheel on top of it. The small monochrome top status screen sits flush on the top plate directly beside the shutter button, on the grip side. The tall pentaprism housing is centred over the lens mount with a hot shoe on top, and a knurled mode dial with a locking button sits on the opposite shoulder, to the right of the prism. The end of the body on the right of the image is smooth and slim with a single brushed-steel strap lug. Satin matte black finish, the same as a premium mirrorless camera: deep black, slightly soft sheen, not grey. A slim brushed-brass ring around the bayonet mount. Mounted perfectly centred and coaxial is a 24-70 mm f/2.8 standard zoom with wide diamond-knurled zoom and focus rings, plain engraved tick marks instead of numbers, and multicoated glass glowing amber and green. Completely unbranded: the front of the prism is plain smooth matte black. Lighting: one large warm softbox high left at about 3200 kelvin, a faint cool rim light from behind right outlining the prism, pure black void with no visible floor, soft shadow fading to black. Shot with a 150 mm lens at f/11, minimal perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style.
```

### B1 · APS-C rangefinder-style digital · front three-quarter (1:1)
Revised after the first try came out straight-on, too close to a Leica M, and with the lens off-centre.
```
Studio product photograph of a compact rangefinder-style digital camera seen from a front three-quarter angle: the lens points toward the lower right of the frame, so we see its front face and its left-hand end panel at the same time, viewed from slightly above so a sliver of the top plate is visible, centred with generous margin on a pure black seamless background. A flat-topped, slightly slimmer-than-usual rectangular body with crisp straight edges and generously rounded ends, fine pebbled black leatherette between a plain matte black top plate and base plate. The front top plate is completely plain matte black with no badge or nameplate. A single small square viewfinder window of dark glass with a thin brushed-brass frame sits at the far upper left of the front, and there is no second window. On the top plate: a knurled black shutter speed dial with tiny engraved warm off-white numerals, a smaller knurled exposure compensation dial, a shutter button with a brushed-brass collar, and a slim hot shoe. A slim brushed-brass ring sits flush with the leatherette around the lens mount, and a very flat pancake lens, barely protruding, is perfectly centred and coaxial in it, its small multicoated front element glowing amber and green. Small brushed-steel strap lugs on each end. Completely unbranded. Lighting: one large warm softbox high left at about 3200 kelvin, a faint cool rim light from behind right outlining the top plate and end panel, pure black void with no visible floor, soft shadow fading to black. Shot with a 150 mm lens at f/11, minimal perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style.
```

Angle tip for every hero shot: Flux defaults to straight-on, so describe the turn concretely, and keep every body facing the same way as the mirrorless render (lens toward lower right) ("the lens points toward the lower right, so we see the front and the left-hand end") and use the mirrorless render as a reference image if you can.

### B2 · 35 mm film SLR · front three-quarter (1:1)
```
Studio product photograph of a classic 1970s-style 35 mm film SLR camera, front three-quarter view: the lens points toward the lower right of the frame, so we see the front of the camera and its left-hand end (the side opposite the hand grip), seen from about 10 degrees above, centred with generous black margin. A matte black enamel body with a tall angular pentaprism housing in the centre of the top plate, fine pebbled black leatherette across the front, and subtle honest wear where the black paint has rubbed through to warm brass on the prism edges and top plate corners. On the top plate: a film advance lever with a black plastic tip, a knurled shutter speed dial with tiny engraved off-white numerals, a shutter button with a threaded collar, a folding film rewind crank, and a cold accessory shoe on the prism. On the front: a self-timer lever and a brass-ringed bayonet mount holding a compact 50 mm lens with a scalloped black metal focus ring, an aperture ring with engraved numerals, and multicoated glass glowing amber. Brushed-steel strap lugs. Completely unbranded, with a smooth blank prism front where a brand would be. Lighting: one large warm softbox high left at about 3200 kelvin, faint cool rim light from behind right, pure black seamless background, soft shadow beneath. Shot with a 150 mm lens at f/11, minimal perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style.
```

### B3 · 6×7 medium-format SLR · front three-quarter (1:1)
```
Studio product photograph of a large 6x7 medium-format film SLR camera, front three-quarter view: the lens points toward the lower right of the frame, so we see the front of the camera and its left-hand end (the side opposite the hand grip), seen from about 10 degrees above, centred with generous black margin. It looks like an oversized 35 mm SLR scaled up to twice the size: a wide, heavy matte black body with a big angular pentaprism finder in the centre, fine pebbled black leatherette, and a sculpted dark walnut wooden hand grip bolted to the left side with brushed-brass screws. On the top plate: a large knurled shutter speed dial with engraved off-white numerals, a big film advance lever, and a shutter button with a brushed-brass collar. A massive brass-ringed bayonet mount holds a chunky 105 mm lens with a wide knurled focus ring, an aperture ring with engraved numerals, and a huge multicoated front element glowing amber and green. Heavy brushed-steel strap lugs. Completely unbranded, with a smooth blank prism front where a brand would be. Lighting: one large warm softbox high left at about 3200 kelvin, faint cool rim light from behind right, pure black seamless background, soft shadow beneath. Shot with a 150 mm lens at f/11, minimal perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style.
```

### B4 · Waist-level 6×7 modular camera · front three-quarter (1:1)
```
Studio product photograph of a modular medium-format studio camera with a waist-level finder, front three-quarter view: the lens points toward the lower right of the frame, so we see the front and the left-hand end, seen from about 20 degrees above so the top is clearly visible, centred with generous black margin. A boxy, squared-off matte black body built from distinct modules: a cube-shaped main body, a removable rectangular film magazine at the rear with a dark slide slot, and a large lens on the front. On top, the waist-level finder hood is folded open: four thin black metal panels stand up around a square of glowing ground glass with a fold-down magnifier. A side-mounted crank and a knurled focusing knob with a brushed-brass centre sit on the right side. The lens is a substantial 110 mm with a fine knurled focus ring, an engraved off-white aperture scale, a brass-ringed mount and multicoated glass glowing amber. Fine pebbled black leatherette panels, brushed-steel strap lugs. Completely unbranded, with smooth blank panels where a brand would be. Lighting: one large warm softbox high left at about 3200 kelvin, faint cool rim light from behind right, pure black seamless background, soft shadow beneath. Shot with a 150 mm lens at f/11, minimal perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style.
```

### B5 · 4×5 wooden field view camera · front three-quarter (1:1)
```
Studio product photograph of a handmade 4x5 large-format wooden field view camera, front three-quarter view: the lens points toward the lower right of the frame, so we see the front of the camera and its left-hand end (the side opposite the hand grip), seen from about 10 degrees above, centred with generous black margin. Frames of dark oiled walnut with visible fine grain, joined with crisp brushed-brass corner plates, knobs, rails and thumbscrews. Black pleated leather bellows extend between the rear standard and the front standard. The front standard holds a square wooden lens board with a polished black leaf-shutter lens, its multicoated glass glowing amber, and a small shutter cocking lever and aperture scale with engraved off-white numerals. At the rear, a ground glass focusing screen in a walnut frame, glowing faintly warm. The camera sits on a folded wooden bed with brass geared focusing rails. Completely unbranded. Lighting: one large warm softbox high left at about 3200 kelvin bringing out the wood grain and brass, faint cool rim light from behind right outlining the bellows, pure black seamless background, soft shadow beneath. Shot with a 150 mm lens at f/11, minimal perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style.
```

---

## View templates (use for every body)

Swap `[BODY DESCRIPTION]` for the body paragraph from its hero prompt above, minus the first sentence and the lighting sentences.

### V2 · Rear straight-on (3:2): for the camera back screen
```
Studio product photograph of the back of [BODY DESCRIPTION], seen perfectly straight-on from directly behind at the exact height of its centre, so the rear is flat to the camera with no perspective tilt, centred with generous black margin. The rear screen (or film door) is a perfectly rectangular, flat, matte, powered-off black panel with crisp edges and a thin bezel, evenly lit with no reflections or glare on it. Physical controls around it are crisp and clearly separated: round buttons, a knurled rear command dial, and an eyepiece with a soft black rubber eyecup if the camera has one. Completely unbranded, with blank smooth surfaces where any labels would be. Lighting: one large warm softbox high left at about 3200 kelvin, faint cool rim light outlining the top edge, pure black seamless background. Shot with a 200 mm lens at f/11, orthographic, no perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style.
```

### V3 · Front straight-on, lens removed (3:2): for the lens swap
```
Studio product photograph of the front of [BODY DESCRIPTION] with its lens removed, seen perfectly straight-on from directly in front at the height of the lens mount, centred with generous black margin. The empty lens mount is a polished brushed-brass bayonet ring with three lugs and a small red alignment dot, and through it the sensor (or film gate and mirror) is visible as a dark rectangle with a faint violet sheen, with a row of tiny gold contacts at the bottom of the throat. The mount sits exactly in the horizontal centre of the body. Completely unbranded. Lighting: one large warm softbox high left at about 3200 kelvin, faint cool rim light outlining the top edge, pure black seamless background. Shot with a 200 mm lens at f/11, orthographic, no perspective distortion, tack sharp, ultra-high detail, photorealistic, premium camera catalogue style.
```

---

## Shot list

| # | Shot | Ratio | Used in |
|---|---|---|---|
| L1–L6 | Lens side profiles | 3:2 | Lens tray, bag lens row |
| L2 | 50 mm front-on (repeat for each lens) | 1:1 | Lens swap |
| L7 | Lens lineup | 16:9 | Reference, marketing |
| B1–B5 | Body front three-quarter | 1:1 | Bag hero, thumbnails |
| V2 × 5 | Body rear straight-on | 3:2 | Camera back |
| V3 × 5 | Body front straight-on, no lens | 3:2 | Lens swap |

Film bodies (B2–B5) have no rear screen. How their camera back works is a design call for later: for example, a fold-out card for 35 mm, the ground glass for the waist-level and 4×5 cameras.
