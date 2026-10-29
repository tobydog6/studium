// RAIL (round 2 agent): the darkroom reel in the pit. See docs/secret-round2.md for S.rail and Sam's picks.
export function install(S) {
  S.rail = { group: null, landing: new S.THREE.Vector3(), pointer() { return false; }, key() { return false; }, frame() {},
    async run(slab, o) { await S.T.wait(0.3); return null; }, async close() {} };
}
