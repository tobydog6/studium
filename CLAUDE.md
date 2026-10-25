# Studium

A browser photography studio for NZ Years 11–13, built on Gaussian splats. Owner: Sam Quinn (Visual Art teacher, Christchurch).

## Build
- `node build.mjs` → `dist/studium.html` (single file, everything inlined).
- `node build.mjs --web` → `dist/web/` (big assets split into parts). Zip: `cd dist/web && zip -qr ../studium-web.zip .`
- `src/app.js` is the entry; other files are pulled in with `@@include name.js@@` (one shared scope, so functions are global to each other).
- Scenes live in `src/scenes.js`; assets are referenced as `asset:` / `asset-b64:` paths and inlined by the build.

## Engine
- three@0.180.0 + @sparkjsdev/spark@2.3.1 (`window.Spark`, see `src/engine.js`). One SparkRenderer for the session.
- Studium renders into its own target and grades in sRGB, so Spark's `encodeLinear` is forced off.
- Lighting/shadows: `src/relight.js` (a Spark worldModifier on the home scan). Scans with SH get `maxSh=0` while the rig is on.
- Worlds/cube/portals: `src/worlds.js`, `src/cube.js`, `src/portal.js`. Other scans load as light previews; stepping into one opens it properly.
- Quests and achievements: `src/quests.js`, `src/questui.js`, `src/achieve.js`. Brief: `docs/` (quest system brief).

## Scene tools (Python)
- `tools/build_scene.py` (the Stump), `tools/sog_decode.py`, `tools/build_collide.py` (walk maps), `tools/build_preview.py` (light previews of big scans).

## Working with Sam
- Be efficient. Don't run long test suites; build and hand Sam the file to try on his real GPU.
- Tests are Playwright scripts in `tests/*.mjs` (`node tests/x.mjs`), useful for targeted checks only. Dev hooks: `?dev`, `?quick`, `?noauto`, `window.__q`, `__qu`, `__ach`, `__pt`, `__cu`, `__wx`, `__rl`, `__wk`.
- Student-facing copy: NZ spelling, warm, second person, no em dashes in UI text.
- Use block comments `/* */` inside one-line code, never trailing `//` (it has swallowed code before).
- Commit as Sam: `git -c user.name="Sam Quinn" -c user.email="sapphirehound66@gmail.com" commit`.
- `assets/scenes/carpark.sog` is ~54 MB. `assets/scenes/maurice.sog` (~118 MB) lives as `.part0..2` (Git LFS uploads are blocked from the cloud sessions); the build joins `<asset>.partN` automatically, so split any further big scans the same way.
- Saint Maurice is CC BY-NC-ND (`licenses/maurice-CC-BY-NC-ND.txt`): format changes only, never crop or thin it, keep the credit.
