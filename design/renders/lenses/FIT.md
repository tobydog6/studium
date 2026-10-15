# Lens swap master (16 Oct)
- **Master body:** `../dslr-hero-nolens.png` (1872×1248). This is the hero shot with the lens removed. Lens-off body plus `lens-2470-cut.png` recombine into `../dslr-front-3q.png` almost exactly (mean diff about 2/255), so the 24-70 is perfectly aligned already.
- **Lens angle that fits:** the original "as if just pulled straight off the camera" wording, with the axis pointing lower right and toward the viewer and the full barrel side visible (about 40°). `lens-50.png` fits at height = 1.02 × the zoom's rear-end height (630 px), top-left at (748, 380).
- `../dslr-3q-nolens.png` (the front-facing mount) is no longer the master. The 15° lens rule only applied to that body.

## Fitting (16 Oct, final method)
`tools/key_checker.py` recovers alpha from checkerboard exports, then `tools/fit_lens.py` scales and places each lens by matching the top and bottom silhouette of its rear section to the 24-70. Results: 50 mm at scale 1.415 (edge error 24 px, visually seated), 85 mm at 0.995 (2 px). The 135 mm is left as generated: it was already aligned, and refitting pushed it off the frame.
