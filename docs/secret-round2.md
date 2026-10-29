# Secret layer, round 2: the pull

The contract for the files built in parallel. Each file has one owner. Nobody edits another owner's file or `main.js`;
`index.js` is the integrator's. Everything crosses through `S` (see `index.js`). Every cross-file call is guarded
(`S.snd && S.snd.play(...)` or the stub already installed), so a file that is not finished never breaks the others.

## Sam's picks, in his words and ours
- The rail "needs to be absolutely epic, that's where all the dopamine comes from". CS:GO case opening is the reference:
  thinner bezels, higher quality effects, the ticking builds suspense, great sound. The ticker sometimes rolls back the
  other way. Prints go by **face down** (you cannot see the photo); the landed print needs a **click to flip**; the
  **hover glow says the finish or variant** (new information), never the tier. Hearthstone's flip + glow is the model.
- Environment: **Darkroom** (red safelight, trays on the bench, prints still dripping on a line as they go past).
  Transition in: **the table top rolls up like a blind and the rail rises out of the dark underneath**. No haze.
- Locked cases: **35 mm film canister** (the lid pops off and a tongue of film curls out at you). **Three on pedestals**,
  each hovering over its own plinth; move across them and the light follows your hand.
- Unboxing (the graded parcel): **tape cut, flaps fold back, tissue parts, the slab rises to meet you**.
  First look: **count up** (the slab lands flat and the grade ticks up from 1 to its number, the last tick the loudest).
- Flip: **turn on its vertical axis with a burst of light at the edge-on moment**. Prompt: **soft pulse** (the print
  breathes in place with a faint rim of light; the rim brightens when the pointer arrives).
- Raw print (front): **hairline 2 mm white border**, **bright white** stock, **straight cut**, **glossy** surface.
  Back: **blind emboss** (the Studium roundel embossed, no ink) with the **tier colour as a solid bar along the foot**.
- Delivery: courier box. Dissolve: fine sand. Pulls come out raw (no grade) and go away for grading
  (`S.gradingWait()` ms; the dev panel makes it a minute or instant; "Skip the wait" brings parcels back now).
- Reveal scaled by tier (The Pull page, `docs/secret-ref/the-pull.html`): common settles · uncommon foil sweep ·
  rare spin + glints · epic starburst, sparks, flood · legendary slow-mo gold flood, embers, slam · mythic blackout,
  eclipse corona, 1 OF 1 stamp, flash.
- Student copy: NZ spelling, warm, second person, no em dashes. Block comments only inside one-line code.

## The spec pages (read the one for your file)
`docs/secret-ref/the-pull.html` (the rail, landings, sound sketch), `pull-environments.html` (darkroom, blind
transition), `cases-unboxing.html` (canister, pedestals, unboxing, count up), `flip-glows.html` (glow per finish,
variant tells, the turn, the pulse), `card-backs.html` (the back and the raw front), `slab-designs.html`,
`round2-designs.html` (courier box, sand). They are self-contained three.js pages: lift their geometry and shader ideas.

## Objects
A **print object** (raw, from `print.js`) and a **slab object** (graded, from `slabmesh.js`) share one shape so the
table, inspect, arm and particles treat them alike:
```
{ group, inner, slab, w, h, th, photoW, photoH, land, built, ready: Promise<obj>, parts: {photo, ...},
  tilt: Vector2, pointer: Vector2, update(dt, pointer?), setFinish(id), setTop(on), dispose() }
```
`w`, `h`, `th` are set synchronously in `make()` for prints (`th` = 0.03); `ready` resolves after the photo arrives and
the meshes exist (`built` true). The group's local +Z is the face; the caller rotates the group (lying flat on the
table = `quaternion` from `-PI/2` about X; face down = a further PI about the group's Y). Prints add:
`setGlow(amount 0..1)` (the rim light in the finish colour, off at 0) and `parts.back`.

Objects are built at slab scale (a portrait slab is about 2.9 wide); Sam found that massive on the table, so
`S.table.adopt` shows every table object at `S.TABLE_K` (0.42, a card beside the 3.3 wide prints) and inspect scales it
back to 1 while it floats. The rail and the parcel can show theirs at whatever scale reads best; the table rescales
what it is handed. The vault shows slabs at its own 0.28 inside the case.

`S.objFor(slab)` makes the right one (`slab.graded` → slab, else print) and registers it so `update` runs each frame;
`S.slabs.drop(obj)` disposes either. `S.table.place(slab, x, z, yaw, {drop})` lays either kind on the table and
`S.table.remove(obj)` takes it off. `S.sendForGrading(obj)` (index.js) sends a raw table print away.

## S additions by owner
- `sound.js` → `S.snd = { play(id, o), loop(id, o) → { stop() }, tick(vel 0..1, back?) }`. Web Audio, synthesised,
  no files. Ids: `tick`, `tickBack`, `rumble`, `land`, `slam`, `flip`, `burst`, `chime` (o.tier), `pop`, `film`,
  `tape`, `cardboard`, `tissue`, `countTick`, `countFinal`, `blind`, `rise`, `sink`, `servo`, `hum` (loop),
  `safelight` (loop), `glow`. Unknown ids are silent. Resume the context on first pointer/key.
- `print.js` → `S.print = { make(slab) → obj }` and export `makePrint(slab, S)`.
- `holo.js` → `S.holo = { glowOf(slab) → { color: Color, color2: Color, kind: 'steady'|'cycle'|'sparkle'|'pulse'|'cold'|'hot' },
  burst(obj, o) → Promise (the edge-on flash of the flip), reveal(obj, o) → Promise (the tier-scaled landing after
  the flip; o.tier defaults to slab.tier) }`; `export async function reveal(S, obj, o)` stays for callers.
  Also keep improving the finish shaders (Sam: integrated into the photo, never flat washes).
- `rail.js` → `S.rail = { run(slab, o) → Promise<obj|null>, pointer(kind, e) → bool, key(e) → bool, frame(dt),
  close() → Promise, group }`. `run` takes `o.rect = [x0, z0, x1, z1]` (the pit loot opened in the table surface,
  y 0 is the table top; build everything below it, from y about -0.6 down) and `o.decoys` (slabs to show going by, already
  rolled by loot). It builds the darkroom in the pit, rises, runs the reel with ticking sound and the roll-back,
  lands the winner face down under the marker, pulses the prompt, glows on hover, flips on click (burst at edge-on,
  then `S.holo.reveal`), and resolves with the winner's print object left in the world, face up, at
  `S.rail.landing` (a world Vector3) for the arm. Resolves null if closed first. loot forwards pointer/key/frame.
- `arm.js` → `S.arm = { aside(o) → Promise, reachTo(worldPoint, o) → Promise, carry(obj, fromWorld, toWorld, o) → Promise,
  rest(o) → Promise, hand() → Vector3 }`; `S.lockStand(true)` is on while loot drives it. Joints and lengths are in
  `S.ctx` (`clampG › poleG › yawJ › j1 › j2 › aim`, `L1`, `L2`, `POLE`, `CL`, `solveArm`, `poseStand`).
- `parcel.js` → `S.parcel = { check(), pointer(kind, e) → bool, frame(dt) }` and the states `parcel.open`
  (busy; the unboxing and count up, then the graded slab lands on the table with `S.table.place`). Pulls whose
  `S.SL.gradingState(p) === 'back'` get a courier box on the table (`S.table.freeSpot()`); click it to open.
  `S.SL.receiveGraded(slab)` once opened. A slab's label canvas bakes the grade in, so count up over it.
- `loot.js` → states `loot.open`, `loot.pick`, `loot.reel`, `loot.lay`, `loot.result`, `loot.closing`; `CLOSE` from any
  of them reverses everything. `S.lockStand(true)`, the stand camera dissolves (`S.P.dissolve(S.ctx.aim, ...)`), the
  arm goes aside (`S.arm.aside()`), the table top rolls back like a blind (animate `S.hole.open` from a line at the far
  edge of the rect to the whole rect while a rolled-up cylinder of table top travels with the edge), three pedestals
  rise with the film canisters, pick one (hover light follows), the lid pops and the film curls, `S.rail.run(slab,
  {rect, decoys})`, then `S.arm.carry(obj, S.rail.landing, tableSpot)` lays the raw print on the table
  (`S.table.place(slab, x, z, yaw, {quiet:true})` style registration: use `S.table.adopt(obj, x, z, yaw)` from index.js),
  result bar (Look closer · Send for grading · Open another · Done), Done closes: rail sinks (`S.rail.close()`),
  the blind rolls back over, the camera reforms (`S.P.reform`), `S.arm.rest()`, `S.lockStand(false)`.
  The roll: `S.SL.roll({ pack })` for the winner, `S.store.addPull(slab)`, `S.hud()`; decoys are `S.SL.roll()` results
  not added to the store.

## Testing (every owner)
`node tools/check-js.mjs` then `node build.mjs --web`, then your own `tests/<file>-shots.mjs` modelled on
`tests/binder-shots.mjs` (it unlocks, jumps states through `__lt.secret.S`, sets `S.T.setTimeScale(3)`, hides the parent
hub, waits on conditions, screenshots to `tests/out/`). Read your screenshots. Keep the run under ten minutes and
run only your own script; the headless GPU is slow and other agents are using it too. Commit in your worktree as Sam
(see CLAUDE.md), one file plus your test script.
