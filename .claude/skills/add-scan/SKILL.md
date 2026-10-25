---
name: add-scan
description: Add a new Gaussian splat scan (.ply/.splat/.sog) to Studium as a scene, with walk map, light preview, card and licence. Use when Sam gives a new scan.
---
# Add a scan

1. **Licence first.** Read the scan's licence. Copy it to `licenses/<id>-<LICENCE>.txt`. If it's ND (no derivatives),
   format changes only: never crop, thin or recolour it, and keep the credit in the scene `desc`.
2. **Convert** to SOG with splat-transform (`-g cpu`; add `-H 1` to drop to one SH band if k-means is too slow).
   Over ~90 MB: split into `assets/scenes/<id>.sog.part0..N` (under 100 MB each, GitHub limit; LFS is blocked from
   cloud sessions). The build joins parts automatically.
3. **Orientation:** check which way is up (`up:"ydown"` for most captures from phones/Polycam-style pipelines).
4. **Walk map:** `python3 tools/build_collide.py <scan> assets/scenes/<id>-collide.bin --up ydown` (see `--help`; `--below 0.2` rejects under-floor noise,
   `--band`/`--clip` for tall interiors). Note the ground height for `ground:`.
5. **Light preview** for the cube/portals: `python3 tools/build_preview.py <scan> assets/scenes/<id>-preview.stm --up ydown` → `<id>-preview.stm`.
6. **Card:** render a 16:9 thumbnail from a good spot (`python3 tools/render_splat.py <scan.splat> out.jpg --eye X Y Z --at X Y Z`,
   y down) and save as `assets/scenes/<id>-card.webp`. Look at it before using it.
7. **Scene entry** in `src/scenes.js`, copying the shape of an existing one (Saint Maurice is a full example):
   `id, name, desc (with credit), up, ext, thumb, data, collide, preview, ground, spots, subject, spawn, challenges`.
   Big scans get `fullRes:true`.
8. Then use the `ship` skill. Ask Sam to judge performance on his GPU; swiftshader can't.
