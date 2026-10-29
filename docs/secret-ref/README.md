# Secret layer: the signed-off option pages

The three.js pages Sam reviewed, kept here as the reference for the props and sequences (the live copies are on claude.ai, links in `docs/secret-handoff.md`). `__PHOTOS__` stands in for the sample photos; the geometry, materials, shaders and timings are the spec.

- `slab-designs.html`: the graded slab (case A, label on top, full bleed) and the finish shaders (`FRAGS`), now in `src/lighttable/secret/holo.js`.
- `vault-designs.html`: `keypadRig('rubber')` is the keypad; `tablePatch`, `reelRig`, `buttonRig`.
- `round2-designs.html`: `hardCase('pelican')` is the vault case (use graphite hardware, not chrome); `holeRig('lift')` + `roundTable` is the round opening; `labelV2` / `labelV2Vertical` the label (now in `slabmesh.js`); `parcelRig('courier')` the delivery; `sandRig` the dissolve grain.
- `the-pull.html`: the whole loot run: rail, prints, ticks, near miss, landings by tier, the flip reveal, the synthesised sound (`SFX`). This is the spec for `loot.js` and `holo.reveal`.
