# Studium

A browser photography studio for NZ secondary students (Years 11–13). Students walk through Gaussian-splat scans of real places, shoot with a simulated camera, edit, select and present their work. Punctum, the companion culling and critique game, is embedded as a separate app.

## Build

```
npm install
npm run build      # -> dist/studium.html (one self-contained file, ~8 MB)
npm test           # build + headless smoke test (screenshots in tests/out/)
```

Open `dist/studium.html` directly in Chrome (file:// works). Add `?dev` to expose `window.__ed` for testing.

## Layout

| Path | What it is |
|---|---|
| `src/index.html` | Page shell: all markup. `@@include x@@` lines pull in the files below. |
| `src/styles/main.css` | The whole stylesheet (darkroom tokens live in `:root`). |
| `src/styles/fonts.css` | Fraunces, Geist and Geist Mono `@font-face` rules. |
| `src/app.js` | The app: movement, camera sim, menu, editor, folio, photobook, gallery, hub, save/resume. |
| `src/engine.js` | Entry for three.js + @mkkellogg/gaussian-splats-3d, bundled by esbuild. |
| `src/scenes.js` | `SPLAT_SCENES` list (metadata; data comes from `assets/scenes/`). |
| `src/punctum.js` | Loads Punctum into its iframe from `vendor/punctum.html`. |
| `assets/` | Binary files (fonts, camera renders, scene `.splat` files and thumbnails). |
| `vendor/punctum.html` | Punctum build, maintained in its own project. Drop a newer one here to update it. |
| `build.mjs` | Assembles everything into one HTML file. |

In any source file, `asset:path/to/file` becomes a base64 `data:` URI, and `asset-b64:path/to/file` becomes the bare base64. Paths are relative to the repo root.

## Pinned engine

`three@0.160.0`, `@mkkellogg/gaussian-splats-3d@0.4.7` and `esbuild@0.24.2` rebuild the original engine byte-for-byte. Upgrade them on purpose, never by accident.

## Adding a scene

1. Put `name.splat` and `name-thumb.jpg` in `assets/scenes/`.
2. Add an entry to `src/scenes.js` with `thumb:"asset:assets/scenes/name-thumb.jpg"` and `data:"asset-b64:assets/scenes/name.splat"`.

## Rebuild plan

See `docs/rebuild-brief.md`. Decisions so far: keyboard and mouse first, Supabase (Sydney) for class logins and data, a Review tab on the camera back, and mockups before code.
