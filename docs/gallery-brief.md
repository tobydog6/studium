# Gallery: the end-of-year bonus game (working brief)

A gallery tycoon game that unlocks when a student has finished the year's work in Studium. You run your own art
gallery. You hang your own photographs, take on other artists (your classmates), throw opening nights, fire pots in
the studio out back, chase grants, read the reviews and grow from a borrowed shopfront to a landmark gallery.

Working title: **Gallery**. It is a separate page in this repo (`src/gallery.html`, built to `dist/gallery.html`)
that reads the student's Studium work. It does not live inside the photography app.

## What Sam asked for (his words, trimmed)
- "a secret bonus at the end of the year when we finish all our work"
- "you live the full daily life of an owner, choosing your site like Sims when you choose a house"
- advertising, open calls, meetings with prospective artists, exhibitions and opening nights, income, grants,
  donations, community events and charity
- "hold your own shows with your own photos imported", other artists, sculptures can be the Studium scans,
  artist packs can come in, sell pieces
- "a pottery studio out back where you can make vases ... put them into the gallery and sell them too"
- upgrade, move to bigger spaces, hire staff
- like movie tycoon: "scores back from how the movie is received", "react to what's trending", "going through the art
  decades and years like Civ"
- "could go on forever but definitely enough content for a lot of replayability and a good gameplay loop and progression"
- classmates are the other artists, all linked, "they can message another student and collaborate"
- shared features, definitely
- the look: "try variations for the balance of quality and speed" (see the look lab below)

## The core loop
**A day** (a few real minutes):
- **Morning, the inbox.** Open-call submissions, artist pitches, grant deadlines, donor emails, a critic asking for
  a preview, a burst pipe.
- **Day, the floor.** Hang and curate, price work, run the pottery studio, assign staff, buy advertising.
- **Evening, events.** Opening nights, artist talks, community workshops, charity auctions. Visitors, sales and
  reputation land here.

**A show** (a few days): choose the artists and works, hang them, set the opening, then get **the reception**. This is
the movie-tycoon moment. A results card shows critic scores (two or three named fictional critics with short quotes),
public turnout, sales, press and the trend fit. The scores come from things the student controls:
- **coherence**: do the works belong together (shared theme, tags, palette)
- **hang**: spacing, sightlines, lighting, how crowded the walls are
- **quality**: the students' own photos carry their Studium marks and achievements as a quality signal
- **trend fit**: how well the show matches what's hot this season
- **promotion**: advertising spend, the guest list, the opening night

**A season** (a term in game time): trends shift, grants open and close, rent is due, staff ask for raises.

## Eras and trends (the Civ layer)
The game walks through art history in eras, each a few seasons long, and each with its own trending movements,
media and prices. For example: 1960s pop and conceptual art, 1970s land art and the photobook, 1980s
appropriation and big colour photography, 1990s YBAs and installation, 2000s digital, 2010s Instagram and
selfies, 2020s AI and craft revival. Every era also has a NZ thread (the McCahon era, Toi Māori resurgence,
the post-quake Christchurch art scene).
- Trends are tags (portrait, landscape, abstract, documentary, craft, political, colour, monochrome, ...). Each
  season some rise and some fall. A small "what's hot" board shows them, and a show's trend fit scores against it.
- Each era opens with a short lesson card: a real movement and one or two real artists to look up, linking back
  to the Research room. This is where the learning sneaks in.
- Moving into the next era unlocks new media (video works, installations, digital screens) and new event types.

## Money
In: commission on sales (40 to 50%, as at a real dealer gallery, and you choose the split when signing an artist),
sales of your own photos and pots, door sales and ticketed events, grants (a fictional national arts council, a
city council fund and a few trusts), donations and patrons.

Out: rent, wages, framing and printing, insurance, advertising, kiln firings, clay and glaze, event catering.

Grants are short applications. The student writes a two or three sentence proposal and picks a budget, and the
score comes from a simple rubric (does it say who it's for, what happens and why it matters). That's real
practice at a skill art students will need.

## Sites (choosing like the Sims house picker)
Three or four starting sites in a made-up Christchurch-like city, each with clear trade-offs:
- **The warehouse**: cheap, huge walls, no foot traffic, cold in winter
- **The shopfront**: busy street, small, expensive
- **The villa**: heritage charm, awkward rooms, a garden for events
- **The pop-up**: nearly free, but only for one season

Growth means moving to bigger sites and building out: a second room, a project space, a café (more foot
traffic), the pottery studio, a shop.

## People
- **Artists.** Classmates are the roster: with consent, a student's Folio picks become their artist
  portfolio that others can invite. Generated artists (with names, personalities, demands and styles) fill out the
  roster when the class is small. Artist pack photographers can appear as visiting "big name" shows. Studium
  scans can be shown as sculptures on plinths (Saint Maurice whole and credited, never cropped or thinned).
- **Meetings.** Short dialogue scenes with an artist: what they want (a solo show, a bigger split, a wall to
  themselves), and you choose how to answer. Relationship and loyalty carry over.
- **Staff.** Gallery assistant, installer, curator, PR, potter's assistant. Each has a couple of skills and a wage.
- **Visitors.** White silhouettes with simple needs (look, sit, buy, gossip). Critics and collectors look different.

## The pottery studio
The wheel: you draw the profile and it spins into a vase (a lathe shape in three.js). Then you choose a glaze
and fire it. The kiln has risk and surprise: cracks, crawling and the occasional beautiful accident. Fired pieces
go into stock with a quality and a style, and can be hung or plinthed and priced like any other work. Sam knows
kilns, so the firing rules can be properly real.

## Shared and social (Supabase, the same project as Punctum and cloud save)
- **Your classmates' galleries.** Visit them, sign the guest book, attend their opening nights.
- **Collaboration.** Invite a classmate as an artist and agree a split, or co-curate a two-person show where both
  galleries get the reception.
- **Messaging.** Students message each other about deals and shows. This is a school product, so start with
  structured messages (offers, invitations, reactions and a short free-text note) that teachers can see in
  `teacher.js`, with a report button. Open chat can come later if Sam wants it.
- **The class season.** Optional leaderboards (reputation, best-reviewed show, most generous charity night)
  rather than just money.

## The unlock
The door is hidden until the year's work is done. Use the quests and achievements already in Studium (or a teacher
switch in `teacher.js` so Sam can open it for the whole class on the last week). When unlocked, a key appears on
the hub desk.

## The look (the lab)
`dist/gallery.html` is the look lab: an isometric gallery room with sample photos, a pot on a plinth and
wandering visitors. It has three looks (Fast, Balanced, Rich), three crowd sizes and a live frame rate, so Sam can
test on school laptops and his own GPU. The plan is an isometric floor view for running the gallery (the first
reference image) and the existing splat walk for walking through your show on opening night (the second
reference image).

## Slices (each one playable)
1. **One room.** Pick a site, hang your own Folio photos, set prices, hold an opening, get the reception card.
2. **Other artists.** Classmates' portfolios as artists, open calls, meetings, commission deals, generated artists.
3. **Eras and trends.** The what's-hot board, the season clock, era lessons.
4. **Pottery.** Wheel, glaze, kiln, sell.
5. **Business.** Staff, grants, donations, advertising, community and charity events.
6. **Shared.** Visiting galleries, collaborations, messages, class season.
7. **Growth.** Moving and building out.

## Open questions
- How does the unlock work: completion only, a teacher switch, or both?
- Is classmate consent per student (a toggle in Studium) or set for the whole class by the teacher?
- Pick the Fast, Balanced or Rich look (or a mix) after trying the lab on real school laptops.
