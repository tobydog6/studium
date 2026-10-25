# Studium

A browser photography studio for NZ Years 11–13, built on Gaussian splats. Owner: Sam Quinn (Visual Art teacher, Christchurch).

## Build and check
- `node build.mjs` → `dist/studium.html` (one file, everything inlined). `node build.mjs --web` → `dist/web/` (big assets in parts).
- `node tools/check-js.mjs`: instant syntax check of the assembled page. A hook runs it after every edit in `src/`.
- `node tests/quick.mjs` (needs `--web` build): loads the app headless, fails on any page error. `--tour --shots 4,13`
  walks the warm-up tour and screenshots those steps to `tests/out/`. Read the screenshots for any UI change.
- IMPORTANT: Sam doesn't want long test runs. Use check-js + quick, then hand him the build to try on his real GPU.
  The other `tests/*.mjs` are targeted Playwright scripts, several outdated; run one only when it covers what you changed.
- Shipping (build, check, commit, push, send): the `ship` skill. New scans: the `add-scan` skill. Multi-file changes
  get the `reviewer` subagent on the diff before shipping.

## Code
- `src/index.html` pulls in files with `@@include name.js@@`; they share one scope, so functions are global to each other.
  A global used in a file that loads earlier, or before its state exists, throws every frame: guard it.
- Use block comments `/* */` inside one-line code, never trailing `//` (it has swallowed code before).
- Scenes: `src/scenes.js`. Assets are `asset:` / `asset-b64:` paths the build inlines. Big assets live as
  `<asset>.part0..N` (GitHub's 100 MB limit; Git LFS is blocked from cloud sessions); the build joins them.
- Dev hooks with `?dev`: `__q` quests, `__qu` quest UI, `__co` warm-up tour (`go()` skips a step), `__cam` camera
  settings, `__ach`, `__pt`, `__cu` cube, `__wx`, `__rl` relight, `__wk` walk. Also `?quick`, `?noauto`.

## Engine
- three@0.180.0 + @sparkjsdev/spark@2.3.1 (`window.Spark`, `src/engine.js`). One SparkRenderer for the session.
- Studium renders into its own target and grades in sRGB, so Spark's `encodeLinear` is forced off. Per-scene look
  (`clarity`, `contrast`) is opt-in; the default look is the original one Sam likes.
- Lighting/shadows: `src/relight.js` (worldModifier). Tour: `src/coach.js`. Gold frames: `src/challenge.js`.
  Quests: `src/quests.js`, `src/questui.js`, `src/achieve.js` (brief in `docs/`).
- Python scene tools in `tools/` (walk maps, previews, SOG decode, offline renders).

## Sam's rules
- Student-facing copy: NZ spelling, warm, second person, no em dashes in UI text.
- Commit as Sam: `git -c user.name="Sam Quinn" -c user.email="sapphirehound66@gmail.com" commit`.
- Saint Maurice is CC BY-NC-ND (`licenses/maurice-CC-BY-NC-ND.txt`): format changes only, never crop or thin it, keep the credit.

## When compacting
Keep: the list of files changed and not yet shipped, whether the last build was sent to Sam, Sam's open requests
in his words, and any check that failed.
