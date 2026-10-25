---
name: ship
description: Build Studium, run the quick check, commit as Sam, push, and hand Sam the HTML to try. Use when a change is ready for Sam.
---
# Ship a build to Sam

1. `node tools/check-js.mjs` (instant). Fix anything it reports before building.
2. `node build.mjs && node build.mjs --web`, then zip: `cd dist/web && rm -f ../studium-web.zip && zip -qr ../studium-web.zip .`
3. `node tests/quick.mjs` must print `quick: OK`. If the change touched the warm-up tour, quests or the camera UI, run
   `node tests/quick.mjs --tour --shots <steps you changed>` instead, and **Read the screenshots** in `tests/out/`:
   check the thing you changed is visible, nothing important is covered (cards over sliders has happened), and the
   wording is right. Fix and repeat; don't hand Sam something you haven't looked at.
4. For a change of more than a few files, run the `reviewer` subagent on the diff before committing. Fix only what
   affects correctness or what Sam asked for.
5. Commit as Sam (attribution lines from the session go at the end of the message), then push:
   `git -c user.name="Sam Quinn" -c user.email="sapphirehound66@gmail.com" commit -m "..."` and `git push`.
6. Send `dist/studium.html` with SendUserFile (display attach). Tell Sam in a few bullets what changed and anything
   he should look at himself on his GPU (feel, timing, performance). No recap of the steps.
