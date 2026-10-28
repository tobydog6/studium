# Secret collector layer: handoff

Sam's full brief is the "Studium secret collector layer" spec (unlock with `=` + "secret", vault, loot, rarity, finishes, Rare library folder, dev panel, 2 rounds of 2-3 worktree agents, one test build per round).

## Done so far (this branch, `secret-collector`)
- `secret/tween.js`: easings, `tween()` promises driven by the frame loop, `to()`, `wait`, `par`, `cancelAll`, `setTimeScale` (slow-mo), seeded `rng`.
- `secret/sm.js`: one state machine, dotted states (`vault.rising`), events/pointer/key/frame bubble to parents then `*`, `run.alive()` for cancelling async sequences.
- `secret/particles.js`: MeshSurfaceSampler clouds, `dissolve` / `reform` / `morph`, modes vortex / scatter / sand.
- `secret/slabs.js`: tiers, odds, grades, variants, finishes, `roll()`, the `store` (localStorage `studium_secret_v1`: unlocked, code, pulls, vault, binder pages of 9, table, points).
- `secret/slabmesh.js`: the acrylic slab (PMREM room env on the secret materials only), label canvas, photo card, variants, `registerFinish` registry.
- `secret/holo.js`: the nine finish shaders Sam signed off on the Slab Designs page (foil, etch, glitter, gold, prism, chrome, lenticular, latent, thermal). `reveal()` is still a stub.
- `secret/inspect.js`: shared slab inspect (float to camera, drag to turn, wheel zoom, action bar, resolves with the action id).
- `secret/devpanel.js`: hidden dev panel (backquote, or "dev" in the = box), every option from the brief, actions, persisted in `studium_secret_dev`.
- `secret/index.js`: `installSecret(ctx)`: the = box, "secret" unlock/lock, the three buttons (loot on the kit / clamp, mini case by the binder, keyhole by the wall pad), hover, `S.cam`, `S.hole`, `S.clearPrints`, `S.table`, `S.rollToTable`, the machine (`locked`, `idle`, `room.knock`, `*` CLOSE), stubs installed.
- `main.js` hooks are in (import, HOLE uniforms + discard on the surface and body, pointer/key/frame/pause routing, `STAND.lock`, ctx at the end). `LT_BRIDGE.packs()` serves the artist packs.
- Stubs waiting for agents: `vault.js`, `binder.js`, `loot.js`, `arm.js` (and the rest of `holo.js`). Each has its brief in its header.

## Sam's design picks (from the options pages)
- Slab Designs (https://claude.ai/artifact/RE7qg9WAk2k3e5iCeTWD6x): Case A clear acrylic · Label L1 top strip · Mount M2 full bleed. Finishes: the integrated versions (bands along the photo's tones, etch on its contours, flakes in its highlights, prism off its edges); flat washes read as cheap.
- Vault and Loot Designs (https://claude.ai/artifact/C45kJ6jaFauCgepUnRcgit): case / hole / keypad / reel / button / dissolve, picks pending.

## What the repo looks like
- Light table = iframe app, `src/lighttable/main.js` (one ES module, esbuild bundles it, so new files under `secret/` can be imported).
- Table surface: `surfMat` shader plane (W_T 42 × H_T 24). Table body `tableBody` box under it, top at y≈-0.025.
- Sequence board: black felt box `board` at BX≈11.1, BZ -0.6 (BW 17.4).
- Binder: 3D group `binder` at BINDER (-13.9, 10.4) plus HTML page-flip overlay `#bd` (`openBinder`, `bdTurn`).
- Copy stand: kit box `kit` at KIT (18.7, 9.3); arm = `stand` › `clampG` › `poleG` › `yawJ` › `j1` › `j2`, camera `aim`, 2-bone IK `solveArm()`, `poseStand(u)`, `setStand(on)`, `standFrame(dt)` (only poses while `STAND.dir`≠0).
- Wall: plane at WALL_Z; sticky pad on wall `padW` at PAD_W (≈-9.55, 4.85). Shelf/spools at SHELF.
- Frame loop `frame(now)`, pointer handlers on `canvas`, keydown on `window` (~line 1189), `window.LTapp` (sync/pause) at the end.
- Library rail lives in the parent page: `src/library.js` (`libFolders`, `libRender`). Bridge: `window.LT_BRIDGE` in `src/lighttable.js`.
- Artist packs: `src/research.js` (Supabase packs; cached in localStorage `studium_rs`). Painted fallbacks: `paintPhoto(kind, seed)` in `src/lighttable/photos.js`.
- Design mockups: Artifact canvas "Studium Holo Prints" (https://claude.ai/artifact/5NeoToHftCxoipVoGftWqZ), boards Main, Toggles, Rarity, Opening, Rare, Finishes, Materials. Tier colours: common #9aa0aa, uncommon #4f8cff, rare #9b5cff, epic #ff4fae, legendary #ff6a3d, mythic #e8c26a. Grades: 10 GEM MINT, 9 MINT, 8 NM-MT, 7 NEAR MINT, 6 EX-MT, 5 EXCELLENT, 4 VG-EX.

## Plan for the rest of the foundation
1. `secret/particles.js`: sample meshes with MeshSurfaceSampler into a Points cloud with aFrom/aTo/aSeed; modes vortex/scatter/sand; `dissolve(obj)`, `reform(obj)`, `morph(a, b)`.
2. `secret/slabs.js`: TIERS (odds 55/25/12/5.5/2/0.5, finish per tier), grade 1-10 rolled separately, 12% variant (full, misprint, negative, clear, stamped x/50), mythic 1/1, cert numbers, photo from artist packs or painted fallback. Store in localStorage `studium_secret_v1` (srcdoc iframe shares the parent's origin, so `library.js` can read it): `{unlocked, code:'1234', pulls, vault, binder, points}`.
3. `secret/slabmesh.js`: acrylic slab + "Studium Graded" label canvas (never the PSA name) + photo card; finish registry `registerFinish(id, {make, update})` with matte as default.
4. `secret/devpanel.js`: hidden panel (toggle with backquote once unlocked), options persisted in localStorage: case, hole, clearing, keypad, dissolve, reel, test finish.
5. `secret/index.js`: `installSecret(ctx)`; `=` opens a subtle text box, "secret" + Enter unlocks; 3 diegetic buttons (loot on the kit when folded / clamp when up, mini case beside the binder, keyhole beside the wall sticky pad with a "coming soon" wiggle); routes pointer/key/frame to the machine; camera push/pop.
6. `main.js` hooks: `let SECRET=null`; frame → `SECRET.frame(dt,now)`; pointer down/move/up/wheel and keydown → `SECRET.pointer/key` first; hole uniform (uHole/uHoleOn) discarding inside a rect on `surfMat` and `bodyMat` (onBeforeCompile); `STAND.lock` checked in `setStand` and `standFrame`; `LTapp.sync/pause` → SECRET; build the ctx object at the end of the file.
7. Stub files `vault.js`, `binder.js`, `holo.js`, `loot.js`, `arm.js`, each exporting `install(S)`, so agents each own one file.
8. Then round 1 agents (vault rise + keypad + lid / dissolve + slab binder / holo shaders + rarity reveals), merge, ship one build.
