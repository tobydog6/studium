// HOLO FINISHES + RARITY REVEALS (round 1 agent). Register one finish per id in S.SL.FINISHES with
// S.SM.registerFinish(id, { make(ctx), update(mesh, ctx) }) — see slabmesh.js for ctx (w, h, photoTex, photoCanvas,
// tier, envMap) and the tilt (-1..1 x/y from the inspect drag) and pointer (0..1 uv) the update gets. The mockups are
// on Sam's "Studium Holo Prints" canvas: matte / rainbow foil / rainbow etch / glitter / full gold / prism black for
// the six tiers, then chrome, lenticular, latent, thermal, cyanotype, eclipse, steel, glass, porcelain, kintsugi,
// raku, carved stone, polychrome, colour keys and highlight leaf as test finishes. Until a finish is registered the
// slab shows slabmesh.js's basic foil.
// Also export reveal(S, slabObj, tier) → promise: the rarity reveal around a freshly pulled slab (common plain,
// rare spin + glints, epic starburst, legendary slow-mo gold flood with a rolling shine (S.T.setTimeScale), mythic
// room blackout then an eclipse corona and the 1/1 stamp). loot.js awaits it.
export function install(S) { /* not built yet */ }
export async function reveal(S, obj) { /* not built yet: a plain pause so loot.js can await it */ await S.T.wait(0.4); }
