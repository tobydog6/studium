# Slab extras: Sam's picks and the brainstorm

Running notes for the next layer on top of finishes. Nothing here is built yet except Breakout and Liquid-filled
(`src/lighttable/secret/fxvariants.js`). Keep this file up to date as Sam picks.

## Sam's picks so far (30 Oct)
From the first variation list:
- Signed (6), Numbered (7)
- Tally: a counter on the slab, like a stat tracker in a shooter (Sam: "stat track like csg")
- Sand timer (9), Snow globe (10), Pressed flower (11), Floating dust (12), Bubble trapped (13), Cracked case (14), Tinted case (15)
- Glowing edge (16), Gold-leaf edges (17)
- Back art (18), Hidden message under UV (19)
- Reacts to sound (21), Evolving (24)

New ideas from Sam:
- **Stacking.** Extras are separate pieces that can stack (a gold card with a cracked case), but it must not go overboard.
  Split them into categories with their own chances.
- **Seals.** Like seals in deck builders: a gold seal and friends.
- **Jump scare card.** Turn it over, turn it back, and something pops out at you.

Not picked (leave out unless Sam asks): Pop-out frame, Cut-out window, Double exposure, Misprint, Off-centre,
Fingerprint, Day and night, Rare shimmer, Sleeper, Twin.

Second round of picks (30 Oct):
- Seals: Gold, Green, Blue, Purple (not Red, Silver, Black).
- Tally: all of them (times inspected, days owned, Blades wins, photos shot since pulling, times traded).
- Jump scare: pressed against the acrylic (1), moth or crow bursts out (2), foggy handprints inside the case (4).
- Label variations: yes (black label 10, handwritten, error label).
- Trade history on the back: yes, if it's etched nicely.

Third round (30 Oct):
- Teacher-signed slab and Photo of the week: liked, but later.
- Peel-off film on new slabs, dust on slabs left alone (wipe it off), Visitor (a bird, cat or leaf now and then),
  weather from outside (the photo's weather matches Christchurch today), heavy parcel (shakes or glows when rare).
- Sam wants emergent ideas next: systems that interact.

Fourth round (30 Oct):
- Corrupted slab: very rare and cursed. It glitches the light table (other slabs flicker, the UI tears); once you
  "debug" it, it becomes one of the best finishes.
- Class feed ("Mere just pulled a Mythic...") and a showcase shelf friends can visit.
- Binder sets: empty grey outlines for what's missing, a progress bar, a reward for a finished page.
- Pity: a guaranteed rare every so many pulls, but kept quiet. Sam: don't let them know it's pseudo random
  (no visible pity counter).
- Sam wants more slab looks in the same spirit as the finishes: cool, not game breaking.

Fifth round (30 Oct), finishes and extras:
- Finishes: Stained glass (leaded panes along depth edges, coloured light on the table), Mosaic (raised grout, tiles
  catch light differently), Marble statue (veined marble rising out of a rough block), Ice sculpture (clear ice,
  background bent through it, frosty edges), Thermal camera (hot subject, cold purple background, temperature readout).
- Extra: Prism edges (case edges throw a little rainbow on the table).
- Sam wants ideas borrowed from other games next (Balatro and the like), spread wide.

Sixth round (30 Oct), from other games:
- Negative (dark inverted film with an oily shimmer), Galaxy foil (stars in the foil that twinkle on tilt),
  Animated card (the whole photo gently moves), Walkout reveal (mythic: tier colour, then place, then finish, then card).
- Sam already has most of the borrowed ideas in; he wants fresher ones.
- Note: Thermal, Cyanotype, Polychrome, Carved stone and Glass already exist as finishes (slabs.js); a pick of one of
  those means a depth-based refresh of the existing finish, not a new id.

Seventh round (30 Oct), photo and acrylic ideas:
- Amber (photo in golden resin, a tiny insect suspended in front), Terrarium (moss garden and a tiny fern along the
  case bottom), Torn and taped (torn in half and taped back, the tape catches the light), Slow film (arrives blank,
  develops a little more each real day owned, complete after a week).
- One more batch, then Sam wants to start building.

Eighth round (30 Oct), last before building:
- Goldfish (only with Liquid-filled), Growing crystals (grow from the corners over real days), Geode case (photo set in
  a split geode), Two-faced (a different photo on the back), Mimic (a plain slab that very rarely snaps open like a
  mouth full of teeth; goes with the jump scares).

## Structure (draft for Sam)
A pull = one finish + up to a few extras, each from a different slot. Slots roll on their own, then a cap trims.

| Slot | What lives there | Chance per pull | Shows raw? |
|---|---|---|---|
| Case | Liquid-filled, Sand timer, Snow globe, Pressed flower, Floating dust, Bubble, Cracked, Tinted | 10% | No, "?" hint, revealed by grading |
| Edge | Glowing edge, Gold-leaf edges | 6% | Yes |
| Mark | Signed, Numbered, Tally | 7% | Yes |
| Back | Back art, Hidden message (UV) | 6% | Yes |
| Seal | the seals | 4% | Yes |
| Photo | Breakout | 4% | Yes, shallow |
| Behaviour | Reacts to sound, Evolving, Jump scare | 3% | Yes |

Balance rules:
- Each extra has a weight (1 common, 2 rare, 3 very rare). A pull's extras can add up to 4 at most; extra rolls past that
  are dropped, rarest kept.
- Roughly: no extras about 66%, one about 27%, two about 6%, three about 1%.
- Clash list per extra (Snow globe not with First snow, Tinted not with Inside the scan, Liquid not with Sand timer...).
- Finish tier nudges chances a little (mythic finishes get +25% on each slot), so the best pulls feel loaded.
- Name: the rarest extra becomes a prefix ("Cracked Gold repoussé"), the rest are listed on the label.

## Brainstorm still open (30 Oct, waiting on Sam's picks)
Seals (a wax seal pressed with an aperture mark, bottom corner; each does something in the secret layer):
- Gold: sells for double on the market. Green: earns a few coins each day you own it.
- Blue: grading never comes back under a 9. Purple: bin it and you get a free pull.
- Red: in Blades, its blade spins back up once after being knocked out.
- Silver: a duplicate of the same photo melts into it and levels it up.
- Black (very rare): can't be sold or traded, but its finish is pushed up a tier.

Tally (amber digits on the case label; each tally slab rolls what it counts and the label names it):
- times inspected, days owned, Blades wins, photos you've shot since pulling it, times traded.
- Count travels with the slab when traded. Milestones (100, 1000) make the digits glow.

Jump scare (playful, not gory; a gentle mode in settings softens it):
- The subject is suddenly pressed flat against the inside of the acrylic, with a thud and a camera shake.
- A moth or a crow bursts out of the photo at you and off screen.
- The subject has turned round to face you when the card comes back.
- Foggy handprints on the inside of the case.
- Rules: about one flip in five, never twice in a row, never on the first flip.

More ideas:
- Wear and history: an op shop price sticker, sticker residue, scratches you can polish out, acrylic yellowed with age.
- Labels: black label for a perfect 10, a handwritten label, an error label.
- Provenance: the first owner's name etched on the edge, a trade history on the back.
- Sets: collect all four seasons, or all the seals, for a bonus.
- Display: lit from below like a shop stand, a holographic security sticker.
- Sound: something loose rattles in the case, a chime when tilted.
- Specials: Time capsule (sealed until a date), Negative (inverted colours), Glow in the dark (charges under the lamp,
  glows when the dark side's lights go off).

## Build notes and risks (30 Oct)
Every new finish or extra gets its own glow (holo.js GLOWS / VARIANT_GLOWS) and reveal theme (reveals.js THEMES,
THEME_OF) as it is built, not afterwards. New themes likely: amber, marble, glass (stained glass, mosaic), galaxy,
corrupted, mimic.

Already in the game: Negative, Full art, Misprint, Clear and Stamped (numbered, one of 50) are variants; Thermal,
Cyanotype, Polychrome, Carved stone and Glass are finishes. Numbered = Stamped; Negative pick = refresh.

Risks and the plan for each:
- Flashing (Thunderstorm, Lightning in a bottle, Corrupted, jump scares): keep under 3 flashes a second, honour
  prefers-reduced-motion, a gentle mode that turns scares and flashes soft.
- Jump scares and Mimic: mild, never the first flip, never twice in a row, gentle mode.
- Corrupted: the glitch stays inside the light table (never the workbook or the studio), always escapable, and reads
  as deliberate so nobody thinks Studium is broken.
- Stacking cost: extras simplified on the table, full detail only when inspected; a per-table budget.
- Transparency inside the case: one case-contents extra per slab (Liquid, Snow globe, Sand timer, Amber, Terrarium,
  dust, bubble...). Goldfish is a Liquid sub-variant, not its own extra.
- Back slot: one thing on the back (Back art, UV message, Trade history or Two-faced).
- Case shape: Geode, thick blocks (crystal, scan3d) exclude case-slot extras and case colours.
- Real-time extras (Slow film, Growing crystals, Evolving, Dust, Anniversary): stamp times when pulled, clamp clock
  jumps so changing the computer's clock can't skip them.
- Slow film hides the finish for a week: excludes other photo-changing extras; the finish shows on the label.
- Weather from outside: a weather service call that a school network may block; falls back to the photo's own weather.
- Reacts to sound: Studium's own sounds only, never the microphone.
- Seals change the economy (Gold doubles value, Green pays daily, Blue grade floor, Purple free pull): caps on Green
  income and Purple chains.
- Tally "photos shot since pulling": needs a bridge event from the studio to the light table.
- Animated card: depth drift and sway only (no true video); animate only when inspected or near the camera.
- Class feed, pop counts, trade history: need the server (Supabase) and show first name and initial only.
- Slabs use the research packs' photos (real photographers' work): heavy alterations like Torn and taped are
  derivatives of their photos; fine for class use, but keep credits on the label.

## Who Shot It and readability (30 Oct)
Sam: students must be able to read the photo at least a little, because of Who Shot It. In a round the developing
print covers the slab until the round ends, so players always guess from the plain photo, whatever the finish.
The print now draws over everything on the slab (relief finishes, Breakout, the scan); before, relief stood in front
of it. Any new finish or extra that stands proud of the photo must stay under the developer (order 45, no depth test).
Outside the game, the hardest to read are Inside the scan (shows the scan, not the photo), Crystal etch, Struck coin,
Terminal, Kaleidoscope, Tiny planet and Event horizon: fine as rare looks.
Flashing: Thunderstorm's strike flicker was about 11 a second, now about 2. Keep every new flash under 3 a second.
