// SOUND (round 2 agent): every sound the pull makes, synthesised with Web Audio (no files). See docs/secret-round2.md.
//   S.snd = { play(id, o), loop(id, o) → { stop() }, tick(vel, back) }   unknown ids stay silent
export function install(S) { S.snd = { play() { return null; }, loop() { return { stop() {} }; }, tick() {} }; }
