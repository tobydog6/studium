// LOOT (round 2 agent): the button on the copy stand. The stand camera dissolves (S.P.dissolve(S.ctx.aim, ...)), the
// arm moves aside (arm.js), the black felt board (S.ctx.board at BX, BZ) flips to a screen, three locked cases float
// above it, pick one, a reel runs (S.dev.opt('reel'): horizontal / drum / wheel), a hole opens above the screen, the
// arm reaches in (arm.js reach/grab), lays the slab on the table (S.table.place). Then inspect / add to vault / open
// another / done. Done reverses it all and the camera reforms (S.P.reform).
// Roll with S.SL.roll({ pack }), S.store.addPull(slab), S.hud(); await holo.reveal(S, obj) for the rarity reveal.
// States: loot.open, loot.pick, loot.reel, loot.grab, loot.result; CLOSE reverses. S.lockStand(true) while open.
export function install(S) { /* not built yet */ }
