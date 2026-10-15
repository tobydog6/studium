# Studium: menu and navigation rebuild brief

Paste this into a fresh chat, attach the latest `splat-explorer.html`, and answer the open questions at the bottom first.

## What Studium is
A browser-based photography studio for NZ secondary photography students (Years 11–13). Students walk through 3D Gaussian-splat scans of real locations in first person, shoot with a simulated camera (7 bodies with real lenses, aperture, shutter, ISO, focus), edit in a built-in Lightroom-style develop panel, select their best work, and lay it out as an A0 folio panel, a photobook (PDF) or a virtual gallery show. Companion tool: **Punctum**, a class-login culling and critique game. Teachers can see student progress and engagement and leave feedback. Pricing: free trial, then $10 per student per year.

**Goal:** it must feel like a real camera in a real place, and look like a team of experts made it (Leica or Photoshop level, never generic or AI-looking). It should make students fall in love with photography while learning camera settings, composition, editing, sequencing and critique.

## Current build (what exists)
- One self-contained HTML file (~8 MB): three.js and @mkkellogg/gaussian-splats-3d bundled via esbuild, WebGL2, scenes embedded as base64 `.splat`.
- Originally assembled from separate parts: `part1.html` (layout and CSS) + `bundle.js` + `scenes.js` + `punctum.js` (Punctum as an iframe `srcdoc`) + `app.js`. Those source files may need to be re-split out of the built HTML.
- Working features: smooth damped WASD movement, P raises the viewfinder, Space opens the menu, G cycles framing guides, per-shot teaching tips, first-run tutorial, save and resume (IndexedDB), the develop panel, folio, photobook and gallery builders, and a hub with three tiles (Punctum / Splat Viewer / Photo Studio).
- Menu now: a horizontal two-tab panel (Camera: body and lens picker; Settings: exposure and handling). It has new photographic camera renders (front, plus a back view whose rear screen shows live settings), a flip interaction and parallax.
- Design system: "darkroom" tokens (`--bg #0c0b0a`, `--text #f4f1ea`, `--accent #e3ad57` gold, `--safelight #e4552e`), Fraunces + Geist + Geist Mono. Rule: apply Apple-level restraint and discipline, but never copy Apple's look.
- Headless test setup: Playwright with SwiftShader and a `?dev` hook.

## The rebuild: five places, each with one job
1. **Viewfinder (shooting):** no menu. Exposure is changed directly with dials (scroll or keys), with a thin settings readout and a quick strip for brief and guides.
2. **Camera back (Space flips):** the full-screen rear render *is* the menu. The UI sits inside the rear screen and the physical buttons work. Tabs: Shoot, Review (recent shots with histogram), Brief (challenge and progress), Setup.
3. **Camera bag (B):** choose body and lens. Cameras laid out with parallax renders, plus a lens-swap animation.
4. **Studio (Esc / leave location):** Edit, Select (Punctum), Folio, Photobook, Gallery. Remove these from the camera menu.
5. **Hub:** location library (contact sheet or map) and student progress. The teacher dashboard is a separate login.

Architecture: a single app-state machine (`hub | bag | viewfinder | back | studio.*`), with every transition going through it and no stacked overlays. Motion rule: physical moves (flip, raise, lift) take about 300 ms, and everything else snaps.

## How to work
1. **Session 1 (setup):** re-split the source files, add a one-command build back to a single HTML file, and set up git (GitHub or a linked local folder). Make no feature changes.
2. **Mock up** all five screens on a design canvas using the real renders, and iterate the look before writing code.
3. **Build one stage per session**, in this order: camera back, viewfinder dials, camera bag, studio, hub. Test each stage in a browser and keep the app working at the end of every session.
4. Use high effort for setup and structural stages, and normal effort for polish. Work in bounded steps (credits are limited).

## Assets
- Camera renders: front three-quarter view, back view (rear screen at 10.7%–64.6% across and 35.1%–91.2% down the trimmed image), and separated parts (lens, body without lens, top plate).
- Renders still to make for the other bodies: APS-C rangefinder, 35mm SLR, 6×7 SLR, waist-level medium format, 4×5 view camera.

## Open questions (answer before building)
1. Devices: school laptops with keyboard and mouse, or touchscreens and Chromebooks too?
2. Include Review on the camera back? (Recommended.)
3. Mockups first? (Recommended.)
4. Hosting: the earlier plan was an offline Windows installer with licence keys and no accounts. The current direction is browser-based with cloud class logins. Confirm the browser and cloud direction, and where student data is hosted.

## Answers (15 Oct 2026)
1. Devices: keyboard and mouse first (school PCs and laptops); touch comes later.
2. Review tab on the camera back: yes.
3. Mockups first: yes.
4. Hosting: browser-based with cloud class logins, and student data in Supabase (Sydney region), shared with Punctum.

## Session 1 status: done
Source re-split, `npm run build` reproduces the original v15 file byte-for-byte (sha256 prefix f9847a6488c8), and the smoke test passes. Next up: mockups of the five screens.
