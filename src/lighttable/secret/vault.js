// VAULT (round 1 agent): the miniature case by the binder opens the real vault in the middle of the table.
// Build here, in this file only. S is the shared object from index.js (S.M machine, S.T tweens, S.P particles,
// S.SL slab data + store, S.SM slab meshes, S.inspect, S.dev options, S.hole, S.clearPrints, S.cam, S.ctx table internals).
//
// States to define on S.M (index.js sends VAULT from idle, and CLOSE on =):
//   vault.open     prints in the middle sweep out (S.clearPrints(rect, S.dev.opt('clearing'))), the hole opens
//                  (S.hole.open + your doors/tiles/sink meshes per S.dev.opt('hole')), the case rises, table flush.
//   vault.keypad   click the case front → camera pushes in (S.cam.push), 4-digit keypad (style S.dev.opt('keypad')),
//                  code from S.store.get().code (default 1234) → lid opens, slabs stand inside (S.SM.makeSlab for
//                  each id in S.store.get().vault).
//   vault.lid      click a slab → S.inspect.open(obj, { actions:[back, table] }); 'table' → S.table.place + store.
//   vault.binder   the case-front button dissolves the case (S.P.morph, mode S.dev.opt('dissolve')) into binder.js's binder.
//   CLOSE (=)      everything reverses and the case sinks back into its hole; S.hole.close(); S.cam.pop(); M.go('idle').
// Case styles for S.dev.opt('case'): hard / safe / walnut / vitrine. Define new options with S.dev.define().
export function install(S) { /* not built yet */ }
